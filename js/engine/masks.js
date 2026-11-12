/**
 * Tonal masks: soft background / shadows / midtones / highlights separation.
 *
 * Phase 2.1 (IF-1). Consumes an existing `analyzeImage()` result and produces
 * four soft, overlapping tonal masks plus coverage statistics.
 *
 * The masks are *soft*: a pixel belongs to a band by degree, not by hard
 * threshold, because a hard cut would show a visible seam where the band edge
 * lands. Each band is a smooth window over luminance and the four windows sum
 * to 1 at every pixel (a partition of unity), so the coverage fractions sum to
 * ~1 and any downstream layer-aware generation can blend the four contributions
 * without gaps or double-weighting.
 *
 * Technique roots: tonal separation is the standard painterly approach to
 * value structure — a wash is laid in large flat value shapes first (Zorn /
 * Reilly abstraction), then the value ranges are refined. Here the four bands
 * are the machine-readable version of that: shadows, midtones, highlights,
 * plus `background` for the untouched paper / largest flat region.
 *
 * @module masks
 */

/**
 * Default band edges, in 0..255 luminance.
 * `lo` separates shadows from midtones; `hi` separates midtones from highlights.
 */
const DEFAULT_LO = 85;
const DEFAULT_HI = 170;

/**
 * Softness of each band edge, in luminance units. Larger = wider transition.
 */
const DEFAULT_SOFTNESS = 28;

/**
 * Smoothstep: 0 at `edge0`, 1 at `edge1`, with zero derivative at both ends.
 * @param {number} x
 * @param {number} edge0
 * @param {number} edge1
 * @returns {number}
 */
function smoothstep(x, edge0, edge1) {
  if (edge1 === edge0) return x < edge0 ? 0 : 1;
  let t = (x - edge0) / (edge1 - edge0);
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return t * t * (3 - 2 * t);
}

/**
 * Compute soft tonal masks from an `analyzeImage()` result.
 *
 * Returns the frozen IF-1 shape:
 * ```
 * {
 *   width, height,
 *   masks: { background, shadows, midtones, highlights },  // Float32Array 0..1
 *   coverage: { background, shadows, midtones, highlights }, // fractions ~ sum 1
 *   threshold: { lo, hi }
 * }
 * ```
 *
 * **Additive only.** Reads `analysis.luminance` (a `Uint8ClampedArray`) and
 * nothing else; requires no DOM, no canvas, no RNG. The same `analysis` object
 * always produces the same masks.
 *
 * @param {object} analysis - Result of `analyzeImage(pixels, w, h, ...)`.
 * @param {object} [opts]
 * @param {number} [opts.lo=85] - Shadow/midtone edge, 0..255.
 * @param {number} [opts.hi=170] - Midtone/highlight edge, 0..255.
 * @param {number} [opts.softness=28] - Edge softness in luminance units.
 * @param {number} [opts.backgroundThreshold=0.15] - Max luminance for the
 *   background band to claim a pixel (paper / large flat dark area).
 * @returns {{
 *   width: number, height: number,
 *   masks: { background: Float32Array, shadows: Float32Array,
 *            midtones: Float32Array, highlights: Float32Array },
 *   coverage: { background: number, shadows: number, midtones: number,
 *               highlights: number },
 *   threshold: { lo: number, hi: number }
 * }}
 */
export function computeTonalMasks(analysis, opts = {}) {
  const {
    lo = DEFAULT_LO,
    hi = DEFAULT_HI,
    softness = DEFAULT_SOFTNESS,
    backgroundThreshold = 0.15,
  } = opts;

  if (!analysis || !analysis.luminance) {
    throw new Error('computeTonalMasks requires an analysis with luminance');
  }

  const width = analysis.width;
  const height = analysis.height;
  const luminance = analysis.luminance;
  const n = width * height;
  if (luminance.length !== n) {
    throw new Error(
      `computeTonalMasks: luminance length ${luminance.length} != ${width}x${height}`,
    );
  }

  // Guard the band edges: lo must sit below hi, and softness must be > 0.
  const loC = Math.min(Math.max(lo, 0), 255);
  const hiC = Math.min(Math.max(hi, loC + 1), 255);
  const soft = Math.max(1e-3, softness);

  const background = new Float32Array(n);
  const shadows = new Float32Array(n);
  const midtones = new Float32Array(n);
  const highlights = new Float32Array(n);

  let bgSum = 0, shSum = 0, mdSum = 0, hlSum = 0;
  let minSum = Infinity, maxSum = -Infinity;

  for (let i = 0; i < n; i++) {
    const L = luminance[i];

    // --- Background: the paper / largest flat region. Modelled as the very
    //     darkest band, fading out before the shadows proper take over. It is
    //     a real band, not a residual — a residual is always 0 because the
    //     three tonal windows already tile the range.
    const bg = 1 - smoothstep(L, 0, 255 * backgroundThreshold);

    // --- Shadows: dark, but below the background band. ---
    const shFull = 1 - smoothstep(L, loC - soft, loC + soft);
    const sh = shFull * (1 - bg);

    // --- Highlights: ramps up from `hi` toward white. ---
    const hl = smoothstep(L, hiC - soft, hiC + soft);

    // --- Midtones: the band between the two edges, tapering at both ends. ---
    // Peaks inside [lo, hi] and falls to 0 outside it, so it never fights the
    // shadow/highlight bands.
    const md = smoothstep(L, loC - soft, loC + soft) * (1 - smoothstep(L, hiC - soft, hiC + soft));

    background[i] = bg;
    shadows[i] = sh;
    midtones[i] = md;
    highlights[i] = hl;

    bgSum += bg;
    shSum += sh;
    mdSum += md;
    hlSum += hl;

    const total = bg + sh + md + hl;
    if (total < minSum) minSum = total;
    if (total > maxSum) maxSum = total;
  }

  const coverage = {
    background: bgSum / n,
    shadows: shSum / n,
    midtones: mdSum / n,
    highlights: hlSum / n,
  };

  return {
    width,
    height,
    masks: { background, shadows, midtones, highlights },
    coverage,
    threshold: { lo: loC, hi: hiC },
    // Extra diagnostics (additive, not part of IF-1): how far the partition of
    // unity strays from 1.0. 0 means the four masks tile every pixel exactly.
    _partition: { min: minSum, max: maxSum },
  };
}

/**
 * Read a mask as an RGBA buffer. Node-safe (no canvas) — used for debug views.
 * The mask is drawn as a grayscale value in all three channels.
 *
 * @param {Float32Array} mask
 * @param {number} width
 * @param {number} height
 * @returns {Uint8ClampedArray} RGBA buffer of length width*height*4.
 */
export function maskToRGBA(mask, width, height) {
  const n = width * height;
  const out = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) {
    const v = Math.max(0, Math.min(1, mask[i])) * 255;
    const o = i * 4;
    out[o] = v;
    out[o + 1] = v;
    out[o + 2] = v;
    out[o + 3] = 255;
  }
  return out;
}

/**
 * Stack masks as an RGBA composite: background=red, shadows=green,
 * midtones=blue, highlights=amber. Overlaps read as colour mixes, which makes
 * the soft edges and any partition-of-unity gaps obvious at a glance.
 *
 * @param {object} masks - The `masks` field from computeTonalMasks.
 * @param {number} width
 * @param {number} height
 * @param {object} [bands] - Optional per-band enable flags
 *   (`{background, shadows, midtones, highlights}`). A band set to `false`
 *   contributes nothing, so the composite reflects exactly the bands the UI
 *   shows as on. Omitted / undefined -> every band enabled (the historical
 *   behaviour, so existing callers are unaffected).
 * @returns {Uint8ClampedArray} RGBA buffer.
 */
export function masksCompositeRGBA(masks, width, height, bands = undefined) {
  const n = width * height;
  const on = (name) => (bands === undefined ? true : bands[name] !== false);
  const out = new Uint8ClampedArray(n * 4);
  const bg = on("background") ? masks.background : null;
  const sh = on("shadows") ? masks.shadows : null;
  const md = on("midtones") ? masks.midtones : null;
  const hl = on("highlights") ? masks.highlights : null;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    // Additive-ish colour mix: each band contributes its own channel weight.
    out[o] = Math.min(255, (bg ? bg[i] * 255 : 0) + (hl ? hl[i] * 200 : 0));
    out[o + 1] = Math.min(255, (sh ? sh[i] * 255 : 0) + (hl ? hl[i] * 160 : 0));
    out[o + 2] = Math.min(255, (md ? md[i] * 255 : 0) + (hl ? hl[i] * 40 : 0));
    out[o + 3] = 255;
  }
  return out;
}

export default {
  computeTonalMasks,
  maskToRGBA,
  masksCompositeRGBA,
  DEFAULT_LO,
  DEFAULT_HI,
  DEFAULT_SOFTNESS,
};
