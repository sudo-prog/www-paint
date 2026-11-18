/**
 * Clean-room optimiser core — Track R1 → R2.
 *
 * The optimiser is the quality engine of record (see `docs/CLEANROOM.md` §4).
 * It is built from classical, independently-derived ideas in stroke-based
 * rendering (Hertzmann 1998) and runs on plain pixel buffers (no canvas, no
 * DOM), so it stays deterministic and unit-testable under plain `node`.
 *
 * R1 — residual/error-driven placement + per-stroke local hill-climb:
 *   1. **Residual / error-driven placement** — each stroke is anchored where
 *      the running canvas carries the most error, drawn from the high-error set
 *      with a *seeded weighted sample* (not the argmax, which walks a single
 *      boundary), so paint goes where it is *needed*.
 *   2. **Per-stroke local refinement (our own hill-climb)** — before a stroke is
 *      committed, a coordinate-ascent search nudges position, size, rotation and
 *      colour, keeping whichever change lowers the local error.
 *   3. **Honest objective** — every candidate is scored by the signed error
 *      delta `D = Σ(new − current)` over its own footprint. `D` is invariant to
 *      the window extent, so a candidate can neither "win" by shrinking its
 *      evaluation window nor by dragging the dab off-image. Dab size is clamped
 *      to a small band and the centre to a small drift radius, so the search
 *      stays a *dab*, not a blanket.
 *   4. **Local colour sampling** — a dab takes its colour from a *small core* at
 *      the anchor, not its whole footprint (averaging a footprint that straddles
 *      an edge yields a muddy colour that *creates* error).
 *
 * R2 — structure-guided multi-scale (coarse → fine):
 *   5. **Multi-scale passes.** Instead of one pass of uniform dabs, the optimiser
 *      now paints in a small number of passes from COARSE to FINE. Each pass
 *      works against a progressively less-blurred copy of the target: the coarse
 *      pass lays broad, low-frequency colour fields with large dabs, and each
 *      finer pass sharpens the result with smaller dabs against a sharper
 *      reference. This is the classic coarse-to-fine SBR schedule that lets fine
 *      strokes resolve contours instead of smearing them.
 *   6. **Scale-aware structure guidance.** Stroke elongation along the structure
 *      tensor tangent is *weak* at the coarse scales (broad coverage should stay
 *      roughly round) and *strong* at the fine scales, so the final, smallest
 *      strokes are the ones that lie along edges.
 *
 * S4 — explicit hierarchical passes (`passes[]`, opt-in):
 *   7. **The schedule can be authored, not only interpolated.** The R2 schedule
 *      is a geometric coarse→fine interpolation. A Style Profile may instead
 *      declare its passes explicitly (`{ id, scale, layers, radius, blur,
 *      elongation, weight, alpha, detail }`) — `resolvePassPlan` maps them onto
 *      the *same* pass machinery, so a profile can say "background → masses →
 *      edges → accents" as first-class, tunable steps. A pass that names
 *      `layers` (tonal roles) has its residual anchoring *biased* onto those
 *      bands (`buildPassMask`); no band is ever a hard gate, so every pass stays
 *      residual-driven. With no explicit passes the geometric plan runs verbatim
 *      — byte-identical output.
 *
 * A stroke is modelled as an anti-aliased filled ellipse ("brush dab") whose
 * colour is the local average of the current scale's target, with
 * `color0 === color1` so the dab renders as a flat patch in *any* renderer that
 * supports the engine's shape format (the search objective and the final render
 * then agree).
 *
 * @module optimizer
 */

import { rng } from '../utils/rng.js';
import { clamp, lerp } from '../utils/math.js';
import { createShape, bounds } from './shapes.js';
import { sampleEdge, sampleStructure } from './analyzer.js';
import { buildRegions } from './regions.js';
import { computeTonalMasks } from './masks.js';
import { mixStrokeLanguage } from './primitives.js';
import { planOrder, planOutlines, resolveEffectiveShaping } from './r4.js';
// Read-only: the shaping table is the registry of style names a shaping request
// can name. Imported directly (not through `r4.js`) because `r4.js` re-exports
// it only on its default export object.
import { SHAPING_TABLE } from '../styles/shaping.js';

/**
 * The three scale keywords an explicit pass may declare (Track-S S4). They map
 * onto the same coarse→fine interpolation the geometric schedule uses:
 * `coarse` = the coarsest radii / blurriest reference, `fine` = the finest,
 * `medium` = the midpoint. Any of them can be overridden per pass with an
 * explicit `radius` / `blur` / `elongation`.
 * @type {string[]}
 */
export const PASS_SCALES = ['coarse', 'medium', 'fine'];

/** scale keyword → position on the coarse(0) → fine(1) axis. */
const SCALE_T = { coarse: 0, medium: 0.5, fine: 1 };

/**
 * Floor applied to a band mask. A hard 0 would freeze a gated pass out of the
 * residual wherever its band is thin, defeating the "residual drives every
 * pass" rule; the floor keeps the pass residual-driven while the band still
 * dominates where it is present. Measured effect: a gated pass places the
 * overwhelming majority of its strokes inside its band (see S4 tests).
 */
const BAND_MASK_FLOOR = 0.05;

/**
 * Default options for {@link optimise}.
 *
 * @type {object}
 */
export const OPTIMISER_DEFAULTS = {
  count: 400,          // total stroke budget (split across the scales)
  seed: 12345,         // master RNG seed (determinism)
  coverage: 0.8,       // dab radius ≈ coverage · sqrt(W·H / count)
  detail: 0.7,         // 0..1 — how much smaller dabs get in high-edge areas
  elongation: 1.2,     // extra radius along the structure tangent at coherence 1
  structureAlign: true,// orient + elongate dabs along the structure tensor
  alpha: 0.9,          // per-stroke opacity
  rounds: 3,           // hill-climb sweeps per stroke
  posStep: 0.6,        // position move, as a fraction of the dab radius
  sizeStep: 1.2,       // size move multiplier (and its reciprocal)
  rotStep: 0.26,       // rotation move (± ~15°)
  colorStep: 10,       // per-channel colour move
  spread: 0.6,         // how strongly already-covered pixels are deprioritised
  anchorThreshold: 0.5,// anchor sampling cutoff, as a fraction of the max score
  minSize: 2.5,
  maxSize: 96,
  minSizeFactor: 0.5,  // size clamp, as a fraction of the proposed dab
  maxSizeFactor: 2.0,  // size clamp, as a multiple of the proposed dab
  maxDrift: 1.2,       // max centre drift, as a multiple of the dab radius

  // ── R2 multi-scale ──────────────────────────────────────────────────────
  scales: 3,           // number of coarse→fine passes (1 = legacy single pass)
  coarseRadius: 1.6,   // coarsest dab radius, as a multiple of the base radius
  fineRadius: 0.64,    // finest dab radius, as a multiple of the base radius
  coarseBlur: 0.6,     // coarsest reference blur, as a fraction of the base radius
  fineElongation: 1.6, // elongation weight at the finest scale (coarse is x0.5)
  weightBias: 2.0,     // coarse→fine budget weighting: pass k gets 1/(k + bias)

  // ── R3 region init (CCL + PCA stroke initialisation) ─────────────────────
  // Only *clearly elongated* regions (≥ regionMinElong) are axis-filled: those
  // are the ones where one oriented, region-sized stroke beats several residual
  // dabs. Compact/isotropic and ring-like components are left to the residual
  // schedule, which handles them better — measurement showed patch-filling them
  // costs fidelity, so there is no patch path. Defaults tuned on the parity
  // bench (see docs/checkpoints/R3.md).
  regionInit: true,      // seed strokes from connected-component principal axes
  regionLevels: 6,       // colour-codebook bins per channel for the CCL pass
  regionMinArea: 10,     // min component area (pixels) to consider
  regionMaxAreaFrac: 0.30,// max component area, as a fraction of the image
  regionMinElong: 2.5,   // elongation at/above which a region is "elongated"
  regionShare: 0.08,     // fraction of the stroke budget for the init pass
  regionMaxSegments: 3,  // max segments one elongated region may spend
  regionMargin: 1.3,     // dab inflation over the fitted region extent
  regionAlpha: 1.0,      // opacity of an init (fill) stroke

  // ── R4 region fill (feature parity: block in the big flat areas first) ────
  // Opt-in — default 0 → output is byte-identical to R3. When > 0, a fraction
  // of the stroke budget lays ONE broad flat ellipse per connected component
  // (largest first) at the component's mean colour, before the R3 init and the
  // coarse→fine schedule refine it: the classical "wash in the large flat
  // values before detail" step, re-derived (see docs/checkpoints/R4.md).
  regionFill: 0,           // fraction of the stroke budget for the region-fill pass
  regionFillMinArea: 24,   // min component area (pixels) to block in
  regionFillMaxAreaFrac: 0.30, // max component area, as a fraction of the image
  regionFillMargin: 1.05,  // dab inflation over the fitted region extent
  regionFillAlpha: 1.0,    // opacity of a fill stroke

  // ── S4 explicit hierarchical passes ──────────────────────────────────────
  // Opt-in — `null` (default) → the geometric `buildScalePlan` schedule runs
  // exactly as before, byte-identical. When an array is supplied it REPLACES
  // that schedule: each entry is one explicit pass `{ id, scale, layers,
  // radius, blur, elongation, weight, alpha, detail }`, in paint order, and
  // the residual still drives every pass (each pass resets `err` against its
  // own blurred reference and anchors by residual, exactly as before). A pass
  // that names `layers` (tonal roles) has its anchoring *biased* onto those
  // bands — the profile's bg → masses → edges → accents, as first-class steps.
  passes: null,

  // ── S5 stroke-language primitives ────────────────────────────────────────
  // Opt-in — `null` (default) → every pass keeps the geometry it had,
  // byte-identical. When a mix (`{ primitive: weight }`, see
  // `js/engine/primitives.js`) is supplied, it is the DEFAULT stroke language
  // for the schedule: each pass's radius multiplier / reference blur /
  // elongation / dab alpha / detail response come from the weighted mix, and an
  // explicit per-pass `radius`/`blur`/`elongation`/`alpha`/`detail` still wins.
  // A pass may override the profile-level mix with its own `primitives`.
  primitives: null,

  // ── R4 paint order (feature parity: path/order modes) ────────────────────
  // Opt-in — `null` (default) → the emitted shapes keep their emission order,
  // byte-identical to R3. When set, the R4 order mode permutes the PAINT ORDER
  // of the returned shapes via `js/engine/r4.js` `planOrder` (which plans over a
  // COPY, so no shape's own fields are touched). Accepts the plan object from
  // `buildR4Plan()` (`{ order: { mode } }`), a `{ order }` object, or a bare
  // mode string (`free|down|up|left|right|diag|spiral|spiralin|rings|ringsin|
  // clock). An unknown / extension mode is a safe no-op.
  r4: null,

  // ── R4 outlines (feature parity: edge-following outline lay-in) ──────────
  // Opt-in — `null`/`'off'` (default) → no outline pass runs and the R3 output
  // is byte-identical. `'first'` lays the contour strokes BEFORE the region /
  // schedule passes (the classical "draw the contours, then the masses" step);
  // `'last'` reserves the same budget but paints them AFTER the schedule.
  // Accepts a bare mode string, a `{ mode }` object, or the plan object from
  // `buildR4Plan()` (`{ outline: { mode } }`). The contours come from
  // `js/engine/r4.js` `planOutlines()` over the same `analysis`.
  r4Outline: null,
  r4OutlineShare: 0.08,    // outline strokes as a fraction of `count`
  r4OutlineRadius: 0.6,    // dab radius, as a fraction of the pass's base radius
  r4OutlineAlpha: 0.9,     // opacity of an outline dab
  r4OutlineOptions: null,  // forwarded to `planOutlines()` (threshold, scale, …)

  // ── R4 per-style shaping (feature parity: style-dependent stroke geometry) ─
  // Opt-in — `null` (default) → every stroke keeps the geometry it had and the
  // output is byte-identical to R3. When set, the optimiser reads the style's
  // own shaping entry (`js/styles/shaping.js`, through the `r4.js` seam) and
  // retunes the stroke language it emits: the stroke SIZE band, the elongation
  // target, the paint ORDER and the flat-region FILL share.
  //
  // Accepts a bare style name (`'pencil'`), a `{ style, parts, …override }`
  // object, or the plan object from `buildR4Plan()` (`{ style, shaping, … }`).
  // An explicitly supplied option ALWAYS wins over the style's value (the
  // S4/S5 precedent), and `parts` restricts which of the four apply. Anything
  // unrecognised resolves to nothing at all, so a stale or future value is a
  // safe no-op rather than a silent restyle.
  r4Shaping: null,

  // ── Per-stroke gradient by weighted least squares (Track-S, worker lever 1) ─
  // Opt-in — `false` (default) → every stroke is flat (color0 === color1),
  // byte-identical to the legacy schedule. When `true`, each committed stroke
  // solves its two endpoint colours (c0, c1) by α²-weighted LSQ over its own
  // coverage footprint, with a small ridge toward c0 == c1 so a flat stroke
  // wins unless the pixels genuinely ask for a gradient. This directly targets
  // the teacher's "2-colour gradient on every stroke" stat (996/996).
  //
  // The solver runs once per stroke AFTER its geometry is fixed (post hill-climb),
  // using the current scale's reference (`levelTarget`) and the stroke's alpha
  // weights. It is pure, deterministic, and adds ~O(N_pixels) work per stroke.
  gradientLSQ: false,
  /** Ridge toward flat (c0 == c1). Larger = more reluctant to add a gradient. */
  gradientLSQRidge: 1e-3,

  // ── Saliency-weighted placement (Track-S, worker lever 2) ──────────────────
  // Opt-in — `false` (default) → anchors are residual-error-driven only,
  // byte-identical to the legacy schedule. When `true`, a FOCUS MAP multiplies
  // the scoring weights in the anchor selection, so strokes are biased toward
  // visually salient regions. The focus map combines:
  //   - local contrast (standard deviation in a 15×15 window)
  //   - edge magnitude (Sobel from analyzer)
  //   - skin-tone likelihood (Cb≈102, Cr≈153 Gaussians, identical to the worker)
  //   - gentle centre bias (cosine falloff, normalised to mean weight 1)
  // All four channels are min-max normalised to [0,1] then weighted and
  // renormalised so the map's mean weight is exactly 1 — the total number
  // of strokes and the error reduction per stroke are preserved.
  //
  // PLUS subject detection: a border k-means (k=2) on the focus map splits
  // the image into "subject" vs "background" using Otsu's method on the
  // border distribution, then clamps the subject to 12–65% of the frame.
  // Strokes inside the subject get a small bonus weight (1.15×).
  //
  // Re-derived from the Code Paint worker's `focus` + `subject` logic;
  // never translates identifiers.
  saliencyWeighted: false,
  /**
   * Saliency strength [0..1]. 0 = no saliency bias (current behaviour
   * when `saliencyWeighted` is false, so byte-identical). 1 = full
   * saliency bias (the original behaviour when `saliencyWeighted` is
   * true and this is 1.0). Values between 0 and 1 blend the focus map
   * with uniform placement: `score *= (1 - s) + s * focus[i]`.
   * This lets low-saliency regions receive strokes, preserving structure
   * in the background where residual error lives.
   */
  saliencyStrength: 1.0,
  /** Weight for local contrast in the focus map [0..1]. */
  saliencyContrast: 0.35,
  /** Weight for edge magnitude in the focus map [0..1]. */
  saliencyEdges: 0.35,
  /** Weight for skin-tone likelihood in the focus map [0..1]. */
  saliencySkin: 0.20,
  /** Weight for centre bias in the focus map [0..1]. */
  saliencyCentre: 0.10,
  /** Subject bonus multiplier for anchors inside the detected subject. */
  saliencySubjectBonus: 1.15,
  /** Subject area clamp: min fraction of frame that counts as subject. */
  saliencySubjectMin: 0.12,
  /** Subject area clamp: max fraction of frame that counts as subject. */
  saliencySubjectMax: 0.65,

  // ── Palette-locked colour pair (Track-S, worker lever 3) ───────────────────
  // Opt-in — `false` (default) → post-hoc quantise snap (quantiseColour),
  // byte-identical to the legacy schedule. When `true`, the best-fitting
  // PAIR of palette colours is solved analytically from the SAME LSQ sums
  // that `solveStrokeGradientLSQ` computes (the worker's `PAL` branch).
  // This replaces our post-hoc quantise: instead of solving a continuous
  // c0/c1 then snapping each to the nearest palette entry, we evaluate
  // every pair of palette entries against the LSQ normal equations and
  // pick the pair that minimises the weighted error. This keeps every
  // stroke strictly on-palette and avoids the "two-tone blob" failure mode
  // where endpoint sampling jumped between distant palette buckets.
  //
  // Requires `gradientLSQ: true` and `quantiseColours: true` + a palette.
  // When enabled, `solveStrokeGradientLSQ` returns the palette-locked pair
  // directly, bypassing the continuous solve + quantise round-trip.
  paletteLockedPair: false,
};

/**
 * Merge user options over the defaults.
 * @param {object} [o]
 * @returns {object}
 */
export function resolveOptions(o = {}) {
  return { ...OPTIMISER_DEFAULTS, ...o };
}

/**
 * Resolve the R4 outline mode from the `r4Outline` option.
 *
 * Accepts a bare mode string (`'first' | 'last' | 'off'`), a `{ mode }` object,
 * or the plan object from `js/engine/r4.js` `buildR4Plan()` (`{ outline: { mode } }`).
 * Anything unrecognised resolves to `'off'`, so a stale or future value is a
 * safe no-op rather than a silent lay-in.
 *
 * @param {*} v
 * @returns {'off'|'first'|'last'}
 */
export function resolveR4OutlineMode(v) {
  const raw = typeof v === 'string' ? v : (v && (v.outline?.mode ?? v.mode));
  return raw === 'first' || raw === 'last' ? raw : 'off';
}

/**
 * The four parts of a style's shaping entry the optimiser can apply, in the
 * order they are documented. `parts` names any subset of these.
 * @type {string[]}
 */
export const SHAPING_PARTS = ['size', 'elongation', 'order', 'fill'];

/** part name → the `js/styles/shaping.js` field it reads. */
const SHAPING_PART_FIELD = {
  size: 'maxSize',           // (minSize travels with it — a band needs both ends)
  elongation: 'elongation',
  order: 'order',
  fill: 'regionFill',
};

/**
 * Resolve the R4 shaping intent from the `r4Shaping` option.
 *
 * Accepts a bare style name (`'pencil'`), a `{ style, parts, shaping }` object,
 * or the plan object from `js/engine/r4.js` `buildR4Plan()` (which carries both
 * `style` and the resolved `shaping`). Returns `null` — a complete no-op —
 * for anything it cannot read, including a style name that is not in the
 * shaping table, so a stale, future or mistyped value never restyles.
 *
 * The returned object is flat and fresh: `{ style, source, parts, minSize,
 * maxSize, elongation, order, regionFill }`.
 *
 * @param {*} v
 * @returns {null|{style: string|null, source: string, parts: string[],
 *   minSize: number, maxSize: number, elongation: number, order: string,
 *   regionFill: number}}
 */
export function resolveR4Shaping(v) {
  if (v === null || v === undefined || v === false) return null;
  let style = null;
  let override = null;
  let requested = null;
  // A `buildR4Plan()` plan reports where its own shaping came from; a plan that
  // took the TABLE's values must not be re-reported as a caller override.
  let declaredSource = null;

  if (typeof v === 'string') {
    style = v;
  } else if (typeof v === 'object') {
    style = typeof v.style === 'string' ? v.style : null;
    // A plan object (`buildR4Plan()`) carries the resolved fields under
    // `shaping`; a caller may equally hand its own partial override there.
    if (v.shaping && typeof v.shaping === 'object') override = v.shaping;
    if (Array.isArray(v.parts)) requested = v.parts;
    if (typeof v.shapingSource === 'string') declaredSource = v.shapingSource;
  } else {
    return null;
  }

  // A caller may pass an override with no style name at all (a hand-built plan)
  // — then the table's documented defaults are the base. With neither a known
  // style nor a single known field there is nothing to apply.
  const hasOverride = !!override
    && SHAPING_PARTS.some((p) => override[SHAPING_PART_FIELD[p]] !== undefined);
  if (!style && !hasOverride) return null;
  // An UNKNOWN style name is a no-op, not the table's fallback entry: a typo
  // must not silently restyle the run with somebody else's stroke language.
  // (`SHAPING_TABLE` covers the whole registry — `r4.js` `shapingCoverageGaps()`
  // is the completeness check, and it is empty.)
  if (style && !Object.prototype.hasOwnProperty.call(SHAPING_TABLE, style)) return null;

  // Values first, then provenance: a plan whose own `shapingSource` says the
  // table supplied it keeps `source: 'table'` (identical values either way).
  const useOverride = hasOverride && declaredSource !== 'table';
  const { source, shaping } = resolveEffectiveShaping(
    style || undefined,
    useOverride ? override : null,
  );
  // `parts` defaults to all four; an unrecognised name is dropped, and a list
  // that resolves to nothing is a no-op rather than a restyle of nothing.
  const parts = requested === null
    ? SHAPING_PARTS.slice()
    : SHAPING_PARTS.filter((p) => requested.includes(p));
  if (parts.length === 0) return null;

  return {
    style,
    source,
    parts,
    minSize: shaping.minSize,
    maxSize: shaping.maxSize,
    elongation: shaping.elongation,
    order: shaping.order,
    regionFill: shaping.regionFill,
  };
}

/**
 * Apply a style's shaping to the optimiser options (R4 per-style shaping).
 *
 * Pure and **default-off**: with `r4Shaping` unset (or unresolvable) the very
 * same object is returned, so every earlier result stays byte-identical. Each
 * part is applied only when the CALLER did not set that option explicitly
 * (`raw` is the caller's own object, before defaults were merged), which keeps
 * an explicit option winning over the style's value.
 *
 * | part | option it sets | when |
 * |---|---|---|
 * | `size` | `minSize` / `maxSize` | the style's stroke-size band |
 * | `elongation` | `elongation` | so aspect reaches the style's value at coherence 1 |
 * | `order` | `r4` | the style's preferred paint order |
 * | `fill` | `regionFill` | the flat-region share the style can carry |
 *
 * @param {object} opts - Resolved options (defaults already merged in).
 * @param {object} [raw] - The caller's own options object (explicitness test).
 * @returns {object} `opts`, or a shaped copy of it.
 */
export function applyR4Shaping(opts, raw = {}) {
  const sh = resolveR4Shaping(opts.r4Shaping);
  if (!sh) return opts;
  const set = new Set(sh.parts);
  const out = { ...opts };
  if (set.has('size')) {
    if (raw.minSize === undefined) out.minSize = Math.max(opts.minSize, sh.minSize);
    if (raw.maxSize === undefined) out.maxSize = Math.min(opts.maxSize, sh.maxSize);
  }
  if (set.has('elongation') && raw.elongation === undefined) {
    // `paintPass` builds the aspect as `1 + elongation·elongMul·coherence`, so
    // the option that makes a fully coherent stroke reach the style's value is
    // one less than it. Rounded to 6 dp so a style whose value lands on the
    // optimiser's own default (2.2 → 1.2) is bit-identical to it, not 1.2+2e-16.
    out.elongation = clamp(+(sh.elongation - 1).toFixed(6), 0, 8);
  }
  if (set.has('order') && raw.r4 === undefined) out.r4 = sh.order;
  if (set.has('fill') && raw.regionFill === undefined) out.regionFill = clamp(sh.regionFill, 0, 1);
  out.shaping = sh;
  return out;
}

/**
 * Anti-aliased coverage of a point by an ellipse.
 *
 * The signed coverage falls off over ~1 device pixel at the ellipse boundary,
 * so the implicit dab rasteriser behaves like an anti-aliased fill.
 *
 * @param {number} dx - Point X minus ellipse centre X.
 * @param {number} dy - Point Y minus ellipse centre Y.
 * @param {number} rx - Ellipse radius along its local X axis.
 * @param {number} ry - Ellipse radius along its local Y axis.
 * @param {number} cos - cos(rotation).
 * @param {number} sin - sin(rotation).
 * @returns {number} Coverage in [0, 1].
 */
function ellipseCoverage(dx, dy, rx, ry, cos, sin) {
  const u = dx * cos + dy * sin;
  const v = -dx * sin + dy * cos;
  const r = Math.sqrt((u * u) / (rx * rx) + (v * v) / (ry * ry));
  const soft = 1 / Math.max(0.5, Math.min(rx, ry));
  return clamp(0.5 + (1 - r) * soft, 0, 1);
}

/**
 * Separable box blur over a channel-interleaved RGB float buffer (clamped
 * edges). A cheap, deterministic stand-in for the Gaussian pyramid used in the
 * classical coarse-to-fine SBR schedule; the aim is a *region average* the
 * coarse strokes can lay down, not a photometric filter.
 *
 * @param {Float32Array} src - RGB buffer, length w·h·3.
 * @param {number} w
 * @param {number} h
 * @param {number} radius - Half-window size in pixels (>= 1 blurs; < 1 copies).
 * @returns {Float32Array}
 */
function blurRGB(src, w, h, radius) {
  const r = Math.max(0, Math.round(radius));
  if (r < 1) return src.slice();
  const n = w * h;
  const tmp = new Float32Array(n * 3);
  const out = new Float32Array(n * 3);
  const win = r * 2 + 1;
  // Horizontal pass
  for (let y = 0; y < h; y++) {
    const row = y * w;
    const acc = [0, 0, 0];
    for (let k = -r; k <= r; k++) {
      const o = (row + Math.max(0, Math.min(w - 1, k))) * 3;
      acc[0] += src[o]; acc[1] += src[o + 1]; acc[2] += src[o + 2];
    }
    for (let x = 0; x < w; x++) {
      const o = (row + x) * 3;
      tmp[o] = acc[0] / win; tmp[o + 1] = acc[1] / win; tmp[o + 2] = acc[2] / win;
      const addO = (row + Math.min(w - 1, x + r + 1)) * 3;
      const subO = (row + Math.max(0, x - r)) * 3;
      acc[0] += src[addO] - src[subO];
      acc[1] += src[addO + 1] - src[subO + 1];
      acc[2] += src[addO + 2] - src[subO + 2];
    }
  }
  // Vertical pass
  for (let x = 0; x < w; x++) {
    const acc = [0, 0, 0];
    for (let k = -r; k <= r; k++) {
      const o = (Math.max(0, Math.min(h - 1, k)) * w + x) * 3;
      acc[0] += tmp[o]; acc[1] += tmp[o + 1]; acc[2] += tmp[o + 2];
    }
    for (let y = 0; y < h; y++) {
      const o = (y * w + x) * 3;
      out[o] = acc[0] / win; out[o + 1] = acc[1] / win; out[o + 2] = acc[2] / win;
      const addO = (Math.min(h - 1, y + r + 1) * w + x) * 3;
      const subO = (Math.max(0, y - r) * w + x) * 3;
      acc[0] += tmp[addO] - tmp[subO];
      acc[1] += tmp[addO + 1] - tmp[subO + 1];
      acc[2] += tmp[addO + 2] - tmp[subO + 2];
    }
  }
  return out;
}

/**
 * Build the coarse→fine pass schedule for the multi-scale painter.
 *
 * Returns one entry per pass, ordered COARSE first. Each entry carries the dab
 * radius multiplier, the reference-blur radius (in pixels), the elongation
 * weight and the pass's share of the stroke budget. Radii, blur and elongation
 * interpolate linearly from coarse to fine; the budget weights decrease
 * geometrically so the coarse pass gets the largest share.
 *
 * @param {object} opts - Resolved options.
 * @param {number} baseR - Base dab radius (≈ coverage·√(W·H/count)).
 * @returns {Array<{radiusMul: number, blurR: number, elongMul: number, weight: number}>}
 */
export function buildScalePlan(opts, baseR) {
  const n = Math.max(1, opts.scales | 0);
  const plan = [];
  if (n === 1) {
    plan.push({ radiusMul: 1, blurR: 0, elongMul: 1, weight: 1 });
  } else {
    let wsum = 0;
    for (let k = 0; k < n; k++) {
      const t = k / (n - 1); // 0 coarse → 1 fine
      const weight = 1 / (k + Math.max(0.1, opts.weightBias)); // decreasing share, coarse-first
      plan.push({
        radiusMul: lerp(opts.coarseRadius, opts.fineRadius, t),
        blurR: baseR * lerp(opts.coarseBlur, 0, t),
        elongMul: lerp(0.5, 1, t),
        weight,
      });
      wsum += weight;
    }
    for (const p of plan) p.weight /= wsum;
  }
  // S5 — a profile-level primitive mix retunes the geometric schedule. It is a
  // no-op (`null` → nothing at all) unless the profile opted in, so the default
  // schedule stays byte-identical.
  applyPrimitiveLanguage(plan, opts.primitives, baseR);
  return plan;
}

/**
 * Overwrite a plan's stroke language with a primitive mix's weighted geometry
 * (Track-S S5). A no-op when the mix resolves to nothing — which is what keeps
 * every pre-S5 profile byte-identical.
 *
 * @param {Array<object>} plan - plan entries, mutated in place.
 * @param {object|Array|null} mix - a primitive mix, or null/absent.
 * @param {number} baseR - Base dab radius (blur is a fraction of it).
 * @returns {Array<object>} the same plan.
 */
export function applyPrimitiveLanguage(plan, mix, baseR) {
  const lang = mix ? mixStrokeLanguage(mix) : null;
  if (!lang) return plan;
  for (const entry of plan) {
    entry.radiusMul = lang.radiusMul;
    entry.blurR = baseR * lang.blur;
    entry.elongMul = lang.elongMul;
    entry.alpha = lang.alpha;
    entry.detail = lang.detail;
    entry.primitives = { ...lang.primitives };
    entry.style = lang.style;
  }
  return plan;
}

/**
 * Build the pass schedule the optimiser will run — the geometric coarse→fine
 * plan, OR the profile's explicit `passes[]` when one is supplied (Track-S S4).
 *
 * This is the single place the two schedules meet, so `optimise()` has one
 * code path and the default is provably untouched: with no explicit passes it
 * returns `buildScalePlan(opts, baseR)` **verbatim** (same objects, same
 * numbers), and every explicit entry is normalised to the same shape the
 * geometric plan uses (`radiusMul`, `blurR`, `elongMul`, `weight`) plus its own
 * `id` / `scale` / `bands`.
 *
 * Explicit entry semantics:
 * - `scale` — `coarse|medium|fine`; picks the `radiusMul`, `blurR` and
 *   `elongMul` by the same coarse→fine interpolation `buildScalePlan` uses.
 * - `radius` (a multiplier of the base dab radius), `blur` (a fraction of the
 *   base radius), `elongation` — explicit overrides of the above.
 * - `weight` — the pass's relative share of the stroke budget; the plan's
 *   weights are normalised to sum to 1, so `weight` is a ratio, not a fraction.
 * - `bands` (= the profile pass's `layers`) — tonal roles the pass is biased
 *   toward (`background|shadows|outline|midtone|highlights`; `outline` reads
 *   the edge field). Empty = no bias, a plain pass.
 * - `alpha` / `detail` — per-pass overrides of the global dab opacity / detail
 *   response.
 *
 * @param {object} opts - Resolved optimiser options.
 * @param {number} baseR - Base dab radius.
 * @returns {Array<object>} the pass plan, in paint order.
 */
export function resolvePassPlan(opts, baseR) {
  const passes = opts.passes;
  if (!Array.isArray(passes) || passes.length === 0) return buildScalePlan(opts, baseR);
  const plan = passes.map((p, i) => {
    const scale = PASS_SCALES.includes(p.scale) ? p.scale : 'medium';
    const t = SCALE_T[scale];
    // S5 — the pass's own primitive mix, else the profile-level one. An explicit
    // per-pass radius/blur/elongation/alpha/detail still wins over the mix.
    const lang = mixStrokeLanguage(p.primitives !== undefined ? p.primitives : opts.primitives);
    const entry = {
      id: p.id !== undefined && p.id !== null ? String(p.id) : `pass${i}`,
      scale,
      bands: Array.isArray(p.layers) ? p.layers.slice()
        : (Array.isArray(p.bands) ? p.bands.slice() : []),
      radiusMul: p.radius !== undefined ? p.radius
        : (lang ? lang.radiusMul : lerp(opts.coarseRadius, opts.fineRadius, t)),
      blurR: (p.blur !== undefined ? p.blur : (lang ? lang.blur : lerp(opts.coarseBlur, 0, t))) * baseR,
      elongMul: p.elongation !== undefined ? p.elongation : (lang ? lang.elongMul : lerp(0.5, 1, t)),
      weight: p.weight !== undefined ? p.weight : 1,
      alpha: p.alpha !== undefined ? p.alpha : (lang ? lang.alpha : undefined),
      detail: p.detail !== undefined ? p.detail : (lang ? lang.detail : undefined),
    };
    if (lang) {
      entry.primitives = { ...lang.primitives };
      entry.style = lang.style;
    }
    return entry;
  });
  // Same convention as buildScalePlan: the weights are normalised to sum to 1,
  // so `weight` reads as a ratio between passes rather than an absolute share.
  const wsum = plan.reduce((a, p) => a + Math.max(0, p.weight), 0) || 1;
  for (const p of plan) p.weight = Math.max(0, p.weight) / wsum;
  return plan;
}

/**
 * Build the per-pixel anchoring bias for one band-scoped pass (Track-S S4), or
 * `null` when the pass names no bands (the common case → no computation, no
 * behaviour change).
 *
 * Tonal roles resolve to the same soft masks the layer system renders with
 * (`masks.js`, IF-1): `background`/`shadows`/`midtone`/`highlights` map onto
 * the four tonal bands (`midtone` → `midtones`), and `outline` reads the
 * analyser's own edge field (a stroke-language "edges" band has no tonal
 * window). Several roles combine by `max`, so a pass may span bands.
 *
 * The result is normalised to a `[BAND_MASK_FLOOR, 1]` range — a soft bias, not
 * a hard cut — so the pass is still anchored by *residual* and cannot be frozen
 * out of the image where its band happens to be absent.
 *
 * @param {object} analysis - `analyzeImage` result (`width`, `height`,
 *   `luminance`, `edges`).
 * @param {string[]} bands - profile layer roles.
 * @returns {Float32Array|null}
 */
function buildPassMask(analysis, bands) {
  if (!Array.isArray(bands) || bands.length === 0) return null;
  const n = analysis.width * analysis.height;
  const tonal = bands.some((b) => b !== 'outline') ? computeTonalMasks(analysis).masks : null;
  const mask = new Float32Array(n);
  let any = false;
  for (const b of bands) {
    const m = b === 'outline'
      ? analysis.edges
      : (tonal ? tonal[b === 'midtone' ? 'midtones' : b] : null);
    if (!m) continue;
    any = true;
    for (let i = 0; i < n; i++) if (m[i] > mask[i]) mask[i] = m[i];
  }
  if (!any) return null;
  let maxv = 0;
  for (let i = 0; i < n; i++) if (mask[i] > maxv) maxv = mask[i];
  if (maxv <= 0) return null;
  const inv = 1 / maxv;
  for (let i = 0; i < n; i++) {
    mask[i] = BAND_MASK_FLOOR + (1 - BAND_MASK_FLOOR) * mask[i] * inv;
  }
  return mask;
}

/**
 * Run the optimiser over an analysis of the target image.
 *
 * @param {object} analysis - Result of `analyzer.analyzeImage` (needs
 *   `pixels`, `width`, `height`, `edges`, `edgeX`, `edgeY` and optionally
 *   `structure`).
 * @param {object} [options] - See {@link OPTIMISER_DEFAULTS}.
 * @returns {{shapes: Array<object>, stats: object}} The chosen shapes (engine
 *   shape format, ready to render with `shapes.drawShape`) plus error stats
 *   measured on the optimiser's own paint buffer against the ORIGINAL target.
 */
export function optimise(analysis, options = {}) {
  // R4 per-style shaping is applied over the merged options, but reads the
  // CALLER's own object to tell an explicit option from a defaulted one. With
  // `r4Shaping` unset this returns the identical object — byte-identical path.
  const opts = applyR4Shaping(resolveOptions(options), options);
  const { width: W, height: H, pixels, edges, edgeX, edgeY } = analysis;
  const structure = opts.structureAlign ? analysis.structure : null;
  const n = W * H;
  const random = rng(opts.seed | 0);

  // ── state buffers (channel-interleaved RGB, float) ───────────────────────
  const target = new Float32Array(n * 3);
  let br = 0, bg = 0, bb = 0;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    target[i * 3] = pixels[o];
    target[i * 3 + 1] = pixels[o + 1];
    target[i * 3 + 2] = pixels[o + 2];
    br += pixels[o]; bg += pixels[o + 1]; bb += pixels[o + 2];
  }
  // The canvas starts as the flat average colour (the harness clears with it).
  const background = [br / n, bg / n, bb / n];

  const paint = new Float32Array(n * 3);
  const err = new Float32Array(n);   // current per-pixel error (mean |ΔRGB|)
  const cov = new Float32Array(n);   // accumulated coverage [0, 1]
  for (let i = 0; i < n; i++) {
    paint[i * 3] = background[0];
    paint[i * 3 + 1] = background[1];
    paint[i * 3 + 2] = background[2];
    err[i] = (
      Math.abs(background[0] - target[i * 3]) +
      Math.abs(background[1] - target[i * 3 + 1]) +
      Math.abs(background[2] - target[i * 3 + 2])
    ) / 3;
  }

  /** Mean per-pixel error of the running paint buffer vs a reference buffer. */
  const meanErrorVs = (ref) => {
    let s = 0;
    for (let i = 0; i < n; i++) {
      s += (Math.abs(paint[i * 3] - ref[i * 3]) +
        Math.abs(paint[i * 3 + 1] - ref[i * 3 + 1]) +
        Math.abs(paint[i * 3 + 2] - ref[i * 3 + 2])) / 3;
    }
    return s / n;
  };
  const initialError = meanErrorVs(target);

  // Dab radius ≈ coverage · √(W·H / count): more strokes → smaller dabs.
  const baseR = clamp(opts.coverage * Math.sqrt((W * H) / Math.max(1, opts.count)),
    opts.minSize, opts.maxSize);

  // The reference buffer and elongation weight for the pass currently running.
  // The closures below read these, so the same per-stroke body can serve every
  // scale of the coarse→fine schedule.
  let levelTarget = target;
  let elongMul = 1;

  // ── Saliency focus map + subject detection (worker lever 2) ────────────────
  // Computed ONCE at the start when `saliencyWeighted` is on. The focus map
  // combines local contrast + edges + skin-tone likelihood + centre bias,
  // normalised to mean weight 1. The subject mask is a binary region from
  // border k-means on the focus map (Otsu threshold), clamped to 12–65%.
  let focusMap = null;
  let subjectMask = null;
  if (opts.saliencyWeighted) {
    focusMap = buildFocusMap(pixels, W, H, edges, opts);
    subjectMask = detectSubject(focusMap, W, H, opts);
  }

  /**
   * Signed error delta produced by compositing a candidate dab, evaluated over
   * its own (padded) footprint window against the current scale's reference:
   *
   *     D = Σ_win (newErr − curErr)
   *
   * Pixels the dab does not touch contribute exactly 0, so D is invariant to
   * the window extent — a candidate can neither "win" by shrinking its window
   * nor by dragging the dab off-image. Because the total image error changes by
   * exactly D, a smaller D is always a genuine improvement. When `write` is
   * true the composite is committed into `paint`/`err`/`cov`.
   *
   * @returns {number} Signed error delta (negative = improvement).
   */
  function evaluate(p, win, write) {
    const cos = Math.cos(p.rot), sin = Math.sin(p.rot);
    const rx = p.rx, ry = p.ry, alpha = p.alpha;
    const mR = Math.max(0.5, Math.min(rx, ry));
    let d = 0;
    for (let py = win.y0; py <= win.y1; py++) {
      const dyBase = py + 0.5 - p.y;
      const rowBase = py * W;
      for (let px = win.x0; px <= win.x1; px++) {
        const i = rowBase + px;
        const dx = px + 0.5 - p.x;
        const u = dx * cos + dyBase * sin;
        const v = -dx * sin + dyBase * cos;
        const rr = Math.sqrt((u * u) / (rx * rx) + (v * v) / (ry * ry));
        const a = clamp(0.5 + (1 - rr) * mR, 0, 1) * alpha;
        if (a <= 0.0005) continue; // untouched → delta 0
        const o3 = i * 3;
        const nr = paint[o3] * (1 - a) + p.r * a;
        const ng = paint[o3 + 1] * (1 - a) + p.g * a;
        const nb = paint[o3 + 2] * (1 - a) + p.b * a;
        const e = (Math.abs(nr - levelTarget[o3]) + Math.abs(ng - levelTarget[o3 + 1]) + Math.abs(nb - levelTarget[o3 + 2])) / 3;
        d += e - err[i];
        if (write) {
          paint[o3] = nr; paint[o3 + 1] = ng; paint[o3 + 2] = nb;
          err[i] = e;
          cov[i] = cov[i] + a * (1 - cov[i]);
        }
      }
    }
    return d;
  }

  /** Bounding window [x0,y0,x1,y1] of a dab, padded and clamped to the image. */
  function windowOf(p, pad) {
    const R = Math.max(p.rx, p.ry) + pad;
    return {
      x0: Math.max(0, Math.floor(p.x - R)),
      y0: Math.max(0, Math.floor(p.y - R)),
      x1: Math.min(W - 1, Math.ceil(p.x + R)),
      y1: Math.min(H - 1, Math.ceil(p.y + R)),
    };
  }

  /**
   * Average colour in a small disc around (x, y) of the CURRENT scale's
   * reference.
   *
   * The dab's colour is sampled from a *small core* at the anchor rather than
   * its whole (possibly edge-straddling) footprint: averaging the full
   * footprint blends two regions into a muddy colour that then *creates* error
   * instead of removing it. A small local sample gives the dab the colour of
   * the place it actually marks.
   */
  function localColor(x, y, r) {
    const x0 = Math.max(0, Math.floor(x - r)), x1 = Math.min(W - 1, Math.ceil(x + r));
    const y0 = Math.max(0, Math.floor(y - r)), y1 = Math.min(H - 1, Math.ceil(y + r));
    const r2 = r * r;
    let sr = 0, sg = 0, sb = 0, wsum = 0;
    for (let py = y0; py <= y1; py++) {
      for (let px = x0; px <= x1; px++) {
        const dx = px + 0.5 - x, dy = py + 0.5 - y;
        const d2 = dx * dx + dy * dy;
        if (d2 > r2) continue;
        const o3 = (py * W + px) * 3;
        const w = 1 - 0.4 * Math.sqrt(d2) / (r + 1e-6);
        sr += levelTarget[o3] * w; sg += levelTarget[o3 + 1] * w; sb += levelTarget[o3 + 2] * w; wsum += w;
      }
    }
    if (wsum <= 0) {
      const i = clamp(Math.round(y), 0, H - 1) * W + clamp(Math.round(x), 0, W - 1);
      return [levelTarget[i * 3], levelTarget[i * 3 + 1], levelTarget[i * 3 + 2]];
    }
    return [sr / wsum, sg / wsum, sb / wsum];
  }

  /**
   * Build the saliency FOCUS MAP (worker lever 2).
   *
   * Combines four channels (all min-max normalised to [0,1], then weighted and
   * renormalised so the map's mean weight is exactly 1):
   *   1. Local contrast — std dev of luminance in a 15×15 window
   *   2. Edge magnitude — Sobel from `edges` (analyzer)
   *   3. Skin-tone likelihood — Cb≈102, Cr≈153 Gaussians (identical to worker)
   *   4. Centre bias — cosine falloff from image centre
   *
   * Pure, deterministic, O(N) using integral images for the local contrast.
   *
   * @param {Uint8Array|Uint8ClampedArray} pixels - RGBA source
   * @param {number} W - image width
   * @param {number} H - image height
   * @param {Float32Array|null} edges - Sobel magnitude from analyzer (or null)
   * @param {object} opts - resolved optimiser options
   * @returns {Float32Array} focus map, length W×H, mean weight = 1
   */
  function buildFocusMap(pixels, W, H, edges, opts) {
    const n = W * H;
    const lum = new Float32Array(n);
    const cb = new Float32Array(n);
    const cr = new Float32Array(n);

    // 1. Luminance + YCbCr (for skin tone)
    for (let i = 0; i < n; i++) {
      const o = i * 4;
      const r = pixels[o], g = pixels[o + 1], b = pixels[o + 2];
      // BT.601 luminance
      lum[i] = 0.299 * r + 0.587 * g + 0.114 * b;
      // YCbCr (full-range) for skin-tone Gaussians
      cb[i] = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
      cr[i] = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
    }

    // 2. Local contrast via integral image of luminance and luminance²
    // 15×15 window → radius 7
    const winR = 7;
    const intL = new Float32Array((W + 1) * (H + 1));
    const intL2 = new Float32Array((W + 1) * (H + 1));
    for (let y = 0; y < H; y++) {
      let rowSum = 0, rowSum2 = 0;
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        rowSum += lum[i];
        rowSum2 += lum[i] * lum[i];
        intL[(y + 1) * (W + 1) + (x + 1)] = intL[y * (W + 1) + (x + 1)] + rowSum;
        intL2[(y + 1) * (W + 1) + (x + 1)] = intL2[y * (W + 1) + (x + 1)] + rowSum2;
      }
    }
    const contrast = new Float32Array(n);
    for (let y = 0; y < H; y++) {
      const y0 = Math.max(0, y - winR);
      const y1 = Math.min(H, y + winR + 1);
      for (let x = 0; x < W; x++) {
        const x0 = Math.max(0, x - winR);
        const x1 = Math.min(W, x + winR + 1);
        const area = (y1 - y0) * (x1 - x0);
        const getSum = (arr) =>
          arr[y1 * (W + 1) + x1] - arr[y0 * (W + 1) + x1] - arr[y1 * (W + 1) + x0] + arr[y0 * (W + 1) + x0];
        const sum = getSum(intL);
        const sum2 = getSum(intL2);
        const mean = sum / area;
        const variance = Math.max(0, sum2 / area - mean * mean);
        contrast[y * W + x] = Math.sqrt(variance);
      }
    }

    // 3. Edge magnitude (from analyzer's Sobel)
    const edgeMag = edges || new Float32Array(n);

    // 4. Skin-tone likelihood (Cb≈102, Cr≈153 Gaussians, σ≈15 each)
    // Identical to the Code Paint worker's constants
    const skin = new Float32Array(n);
    const cbMu = 102, crMu = 153, sigma = 15;
    const inv2s2 = 1 / (2 * sigma * sigma);
    for (let i = 0; i < n; i++) {
      const dcb = cb[i] - cbMu;
      const dcr = cr[i] - crMu;
      skin[i] = Math.exp(-(dcb * dcb + dcr * dcr) * inv2s2);
    }

    // 5. Centre bias (cosine falloff, normalised to [0,1])
    const centre = new Float32Array(n);
    const cx = (W - 1) * 0.5;
    const cy = (H - 1) * 0.5;
    const maxDist = Math.hypot(cx, cy);
    for (let y = 0; y < H; y++) {
      const dy = y - cy;
      for (let x = 0; x < W; x++) {
        const dx = x - cx;
        const d = Math.hypot(dx, dy) / maxDist;
        centre[y * W + x] = Math.max(0, Math.cos(d * Math.PI * 0.5));
      }
    }

    // 6. Min-max normalise each channel to [0,1]
    function minmaxNorm(arr) {
      let mn = Infinity, mx = -Infinity;
      for (let i = 0; i < n; i++) {
        if (arr[i] < mn) mn = arr[i];
        if (arr[i] > mx) mx = arr[i];
      }
      if (mx <= mn) return new Float32Array(n); // flat → zero
      const scale = 1 / (mx - mn);
      const out = new Float32Array(n);
      for (let i = 0; i < n; i++) out[i] = (arr[i] - mn) * scale;
      return out;
    }
    const cContrast = minmaxNorm(contrast);
    const cEdge = minmaxNorm(edgeMag);
    const cSkin = minmaxNorm(skin);
    const cCentre = minmaxNorm(centre);

    // 7. Weighted sum → renormalise to mean = 1
    const wC = opts.saliencyContrast, wE = opts.saliencyEdges, wS = opts.saliencySkin, wCe = opts.saliencyCentre;
    const wSum = wC + wE + wS + wCe || 1;
    const focus = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      focus[i] = (wC * cContrast[i] + wE * cEdge[i] + wS * cSkin[i] + wCe * cCentre[i]) / wSum;
    }
    // Renormalise so mean weight = 1 (preserves total stroke count / error budget)
    let mean = 0;
    for (let i = 0; i < n; i++) mean += focus[i];
    mean /= n;
    if (mean > 0) {
      const inv = 1 / mean;
      for (let i = 0; i < n; i++) focus[i] *= inv;
    }
    return focus;
  }

  /**
   * Detect the SUBJECT region from the focus map (worker lever 2).
   *
   * Border k-means (k=2) on focus values at the image border → two clusters
   * (subject vs background). Otsu's method on the border histogram finds the
   * split threshold. The larger cluster is "subject", then clamped to
   * 12–65% of the frame.
   *
   * @param {Float32Array} focusMap - from buildFocusMap
   * @param {number} W
   * @param {number} H
   * @param {object} opts - resolved optimiser options
   * @returns {Uint8Array} subject mask (1 = subject, 0 = background)
   */
  function detectSubject(focusMap, W, H, opts) {
    const n = W * H;
    const subject = new Uint8Array(n);

    // Collect border pixels (top + bottom + left + right edges)
    const border = [];
    for (let x = 0; x < W; x++) border.push(focusMap[x], focusMap[(H - 1) * W + x]);
    for (let y = 1; y < H - 1; y++) border.push(focusMap[y * W], focusMap[y * W + (W - 1)]);

    if (border.length < 4) return subject;

    // Otsu's threshold on border values
    const hist = new Array(256).fill(0);
    for (const v of border) {
      const b = Math.min(255, Math.max(0, Math.round(v * 255)));
      hist[b]++;
    }
    let sum = 0, sumB = 0, wB = 0, wF = 0, varMax = 0, threshold = 0;
    for (let t = 0; t < 256; t++) sum += t * hist[t];
    for (let t = 0; t < 256; t++) {
      wB += hist[t];
      if (wB === 0) continue;
      wF = border.length - wB;
      if (wF === 0) break;
      sumB += t * hist[t];
      const mB = sumB / wB;
      const mF = (sum - sumB) / wF;
      const varBetween = wB * wF * (mB - mF) * (mB - mF);
      if (varBetween > varMax) { varMax = varBetween; threshold = t; }
    }

    // Classify whole image: above threshold = subject candidate
    let subjectCount = 0;
    for (let i = 0; i < n; i++) {
      const b = Math.min(255, Math.max(0, Math.round(focusMap[i] * 255)));
      if (b > threshold) { subject[i] = 1; subjectCount++; }
    }

    // Clamp to 12–65% of frame (worker's exact bounds)
    const minCount = Math.round(opts.saliencySubjectMin * n);
    const maxCount = Math.round(opts.saliencySubjectMax * n);
    if (subjectCount < minCount) {
      // Too small → expand by lowering threshold
      for (let t = threshold; t >= 0 && subjectCount < minCount; t--) {
        for (let i = 0; i < n; i++) {
          const b = Math.min(255, Math.max(0, Math.round(focusMap[i] * 255)));
          if (b === t && subject[i] === 0) { subject[i] = 1; subjectCount++; }
        }
      }
    } else if (subjectCount > maxCount) {
      // Too large → shrink by raising threshold
      for (let t = threshold + 1; t < 256 && subjectCount > maxCount; t++) {
        for (let i = 0; i < n; i++) {
          const b = Math.min(255, Math.max(0, Math.round(focusMap[i] * 255)));
          if (b === t && subject[i] === 1) { subject[i] = 0; subjectCount--; }
        }
      }
    }
    return subject;
  }

  /**
   * Solve the two endpoint colours (c0, c1) of a stroke by α²-weighted
   * least squares over the stroke's own coverage footprint.
   *
   * Model: the stroke is an elliptical dab with a linear gradient along its
   * rotation axis. For each pixel, the gradient parameter t ∈ [-1, 1] maps
   * to the colour c(t) = (c0 + c1)/2 + t·(c1 - c0)/2. The coverage α_p of
   * the dab at pixel p weights the squared error. A small Tikhonov ridge
   * (opts.gradientLSQRidge) penalises (c1 - c0) so a flat stroke wins unless
   * the pixels genuinely demand a gradient.
   *
   * This is the classical LSQ for a two-endpoint gradient, re-derived from
   * the Code Paint worker's `evaluate()` (which solves it analytically).
   * Runs once per stroke AFTER geometry is fixed (post hill-climb).
   *
   * When `opts.paletteLockedPair` is true AND a palette is provided via the
   * closure scope, the best-fitting PAIR of palette colours is solved
   * analytically from the SAME LSQ sums (the worker's `PAL` branch). This
   * replaces the continuous solve + post-hoc quantise round-trip, keeping
   * every stroke strictly on-palette.
   *
   * @param {object} p - the committed dab {x, y, rx, ry, rot, alpha}
   * @param {object} win - windowOf(p, 1)
   * @param {Array<Array<number>>|null} palette - optional palette for locked pair
   * @returns {[number,number,number][]} [[c0r,c0g,c0b], [c1r,c1g,c1b]]
   */
  function solveStrokeGradientLSQ(p, win, palette = null) {
    const cos = Math.cos(p.rot), sin = Math.sin(p.rot);
    const rx = p.rx, ry = p.ry, alpha = p.alpha;
    const mR = Math.max(0.5, Math.min(rx, ry));
    const ridge = opts.gradientLSQRidge || 1e-3;

    // Accumulators for the 3 channels independently
    let Sw0 = 0, Sw1 = 0, Sw2 = 0;          // Σ w, Σ w·t, Σ w·t²
    let Sr0 = 0, Sr1 = 0, Sg0 = 0, Sg1 = 0, Sb0 = 0, Sb1 = 0; // Σ w·L, Σ w·t·L

    for (let py = win.y0; py <= win.y1; py++) {
      const dyBase = py + 0.5 - p.y;
      const rowBase = py * W;
      for (let px = win.x0; px <= win.x1; px++) {
        const i = rowBase + px;
        const dx = px + 0.5 - p.x;
        const u = dx * cos + dyBase * sin;
        const v = -dx * sin + dyBase * cos;
        const rr = Math.sqrt((u * u) / (rx * rx) + (v * v) / (ry * ry));
        const a = clamp(0.5 + (1 - rr) * mR, 0, 1) * alpha;
        if (a <= 0.0005) continue;
        const w = a * a; // α² weighting (worker uses coverage²)
        const o3 = i * 3;
        const Lr = levelTarget[o3];
        const Lg = levelTarget[o3 + 1];
        const Lb = levelTarget[o3 + 2];

        // Gradient parameter t in [-1, 1] along the stroke's rotation axis
        const t = u / (rx + 1e-6); // normalised along major axis

        Sw0 += w;
        Sw1 += w * t;
        Sw2 += w * t * t;

        Sr0 += w * Lr;
        Sr1 += w * t * Lr;
        Sg0 += w * Lg;
        Sg1 += w * t * Lg;
        Sb0 += w * Lb;
        Sb1 += w * t * Lb;
      }
    }

    if (Sw0 <= 0) {
      // Degenerate: fall back to a flat colour at the anchor
      const col = localColor(p.x, p.y, Math.max(1, Math.min(p.rx, p.ry) * 0.4));
      return [col.slice(), col.slice()];
    }

    // Solve [c0, c1] for each channel:
    // We have: L(t) = c0 * (1-t)/2 + c1 * (1+t)/2 = (c0+c1)/2 + t*(c1-c0)/2
    // Let m = (c0+c1)/2 (midpoint), d = (c1-c0)/2 (half-diff)
    // Then: L = m + t·d
    // LSQ: Σ w (m + t·d - L)² + ridge·d²
    // Normal equations:
    //   Σ w (m + t·d - L) = 0           → Sw0·m + Sw1·d = S0
    //   Σ w t (m + t·d - L) + ridge·d = 0  → Sw1·m + (Sw2+ridge)·d = S1
    // where S0 = Σ w·L, S1 = Σ w·t·L

    const det = Sw0 * (Sw2 + ridge) - Sw1 * Sw1;
    if (Math.abs(det) < 1e-12) {
      const m0 = Sr0 / Sw0;
      const m1 = Sg0 / Sw0;
      const m2 = Sb0 / Sw0;
      return [[m0, m1, m2], [m0, m1, m2]];
    }

    const invDet = 1 / det;
    // m = ( (Sw2+ridge)*S0 - Sw1*S1 ) / det
    // d = ( -Sw1*S0 + Sw0*S1 ) / det
    const r_m = ((Sw2 + ridge) * Sr0 - Sw1 * Sr1) * invDet;
    const r_d = (-Sw1 * Sr0 + Sw0 * Sr1) * invDet;
    const g_m = ((Sw2 + ridge) * Sg0 - Sw1 * Sg1) * invDet;
    const g_d = (-Sw1 * Sg0 + Sw0 * Sg1) * invDet;
    const b_m = ((Sw2 + ridge) * Sb0 - Sw1 * Sb1) * invDet;
    const b_d = (-Sw1 * Sb0 + Sw0 * Sb1) * invDet;

    const c0 = [clamp(r_m - r_d, 0, 255), clamp(g_m - g_d, 0, 255), clamp(b_m - b_d, 0, 255)];
    const c1 = [clamp(r_m + r_d, 0, 255), clamp(g_m + g_d, 0, 255), clamp(b_m + b_d, 0, 255)];

    // ── Palette-locked pair (worker lever 3): evaluate all palette pairs
    // against the LSQ normal equations and pick the pair that minimises
    // the weighted error. This uses the SAME normal-equation coefficients
    // (Sw0, Sw1, Sw2, Sr0, Sr1, ...) so it's exact and avoids the
    // continuous-solve + quantise round-trip that produced two-tone blobs.
    if (palette && Array.isArray(palette) && palette.length >= 2 && opts.paletteLockedPair) {
      // The LSQ error for a given (c0, c1) is:
      // Σ w [ (m + t·d - L)² ] + ridge·d²  where m=(c0+c1)/2, d=(c1-c0)/2
      // For a palette pair (pA, pB) we can compute m,d and the error directly.
      // Since channels are independent, we evaluate per-channel and sum.
      let bestPair = null, bestErr = Infinity;
      for (let i = 0; i < palette.length; i++) {
        const pA = palette[i];
        for (let j = i + 1; j < palette.length; j++) {
          const pB = palette[j];
          // m = (pA+pB)/2, d = (pB-pA)/2
          const m0 = (pA[0] + pB[0]) * 0.5;
          const m1 = (pA[1] + pB[1]) * 0.5;
          const m2 = (pA[2] + pB[2]) * 0.5;
          const d0 = (pB[0] - pA[0]) * 0.5;
          const d1 = (pB[1] - pA[1]) * 0.5;
          const d2 = (pB[2] - pA[2]) * 0.5;
          // Weighted error: Σ w (m + t·d - L)² + ridge·d²
          // = Sw0·m² + 2·Sw1·m·d + (Sw2+ridge)·d² - 2·(Sr0·m + Sr1·d) + const
          // (const = Σ w·L² doesn't depend on the pair, so we can drop it)
          const errR = Sw0 * m0 * m0 + 2 * Sw1 * m0 * d0 + (Sw2 + ridge) * d0 * d0 - 2 * (Sr0 * m0 + Sr1 * d0);
          const errG = Sw0 * m1 * m1 + 2 * Sw1 * m1 * d1 + (Sw2 + ridge) * d1 * d1 - 2 * (Sg0 * m1 + Sg1 * d1);
          const errB = Sw0 * m2 * m2 + 2 * Sw1 * m2 * d2 + (Sw2 + ridge) * d2 * d2 - 2 * (Sb0 * m2 + Sb1 * d2);
          const totalErr = errR + errG + errB;
          if (totalErr < bestErr) {
            bestErr = totalErr;
            bestPair = [pA.slice(), pB.slice()];
          }
        }
      }
      if (bestPair) return bestPair;
    }

    return [c0, c1];
  }

  const shapes = [];
  let strokeIndex = 0;

  /**
   * Composite a chosen dab into `paint`/`err`/`cov` and emit its shape. Shared
   * by the region-init pass (R3) — the coarse→fine passes push inline so their
   * original ordering/ids are untouched.
   */
  function commitShape(p) {
    evaluate(p, windowOf(p, 1), true);
    if (opts.onStroke) opts.onStroke(strokeIndex, meanErrorVs(target));
    const win = windowOf(p, 1);
    let c0, c1;
    if (opts.gradientLSQ) {
      const palette = opts.palette || null;
      const [g0, g1] = solveStrokeGradientLSQ(p, win, palette);
      c0 = [Math.round(clamp(g0[0], 0, 255)), Math.round(clamp(g0[1], 0, 255)), Math.round(clamp(g0[2], 0, 255))];
      c1 = [Math.round(clamp(g1[0], 0, 255)), Math.round(clamp(g1[1], 0, 255)), Math.round(clamp(g1[2], 0, 255))];
    } else {
      const cr = Math.round(clamp(p.r, 0, 255));
      const cg = Math.round(clamp(p.g, 0, 255));
      const cb = Math.round(clamp(p.b, 0, 255));
      c0 = [cr, cg, cb];
      c1 = [cr, cg, cb];
    }
    shapes.push(createShape({
      id: `r3_${strokeIndex}_${((strokeIndex * 2654435761) >>> 0).toString(36)}`,
      type: 'E',
      params: [p.x, p.y, p.rx, p.ry, p.rot, p.rot, 0, 0],
      color0: c0,
      color1: c1,
      alpha: p.alpha,
      style: 'painterly',
      layer: 0,
      order: strokeIndex,
      seed: strokeIndex,
    }));
    strokeIndex++;
  }

  /**
   * R3 region-init pass — CCL + PCA stroke initialisation.
   *
   * Segment the target into connected components (by a coarse colour codebook),
   * fit each component's principal axis, and seed strokes from the geometry of
   * the region it belongs to. Only **clearly elongated** components (elongation
   * ≥ `regionMinElong`) are seeded, each as a short chain of ellipse dabs laid
   * along its principal axis and sized to the region's cross-section — the case
   * where one oriented stroke does the work of several residual dabs.
   * Compact/isotropic and ring-like components are skipped: the residual
   * schedule fits them better (measured — a patch-fill path cost fidelity, so
   * there is none), and skipping keeps the pass from blanketing the canvas
   * (the R0 failure mode).
   *
   * Every dab takes the component's *mean* colour, so a flat region is
   * initialised with one near-exact mark. Regions are visited largest-first and
   * `budget` caps the spend, so a small share of the total is used. No
   * randomness is used, so the pass is deterministic.
   *
   * @param {number} budget - Max strokes this pass may emit.
   * @returns {number} Strokes actually emitted.
   */
  function regionInitPass(budget) {
    if (budget <= 0) return 0;
    levelTarget = target; // component means are local averages of the raw target
    elongMul = 1;
    const regions = buildRegions(analysis, {
      levels: opts.regionLevels,
      minArea: opts.regionMinArea,
      maxAreaFrac: opts.regionMaxAreaFrac,
    });
    let emitted = 0;
    for (let ri = 0; ri < regions.length && emitted < budget; ri++) {
      const rg = regions[ri];
      if (rg.elong < opts.regionMinElong) continue; // only clearly elongated regions
      const r = clamp(rg.color[0], 0, 255);
      const g = clamp(rg.color[1], 0, 255);
      const b = clamp(rg.color[2], 0, 255);
      const halfMajor = 0.5 * Math.sqrt(12 * rg.l1);
      const halfMinor = 0.5 * Math.sqrt(12 * rg.l2);
      const segs = clamp(Math.round(halfMajor / Math.max(1, halfMinor)), 1, opts.regionMaxSegments);
      const segHalf = clamp(halfMajor / segs, opts.minSize / 2, opts.maxSize);
      const ry = clamp(halfMinor * opts.regionMargin, opts.minSize / 2, opts.maxSize);
      const ca = Math.cos(rg.angle);
      const sa = Math.sin(rg.angle);
      for (let k = 0; k < segs && emitted < budget; k++) {
        const t = segs === 1 ? 0 : (k / (segs - 1)) * 2 - 1; // -1 … +1 along the axis
        const off = t * Math.max(0, halfMajor - segHalf);
        commitShape({
          x: rg.cx + ca * off,
          y: rg.cy + sa * off,
          rx: clamp(segHalf * opts.regionMargin, opts.minSize / 2, opts.maxSize),
          ry,
          rot: rg.angle,
          r, g, b, alpha: opts.regionAlpha,
        });
        emitted++;
      }
    }
    return emitted;
  }

  /**
   * R4 region-fill pass — block in the big flat areas first.
   *
   * Feature parity with the legacy painter's region fill, re-derived:
   * segment the target into connected components (the same CCL + PCA as the R3
   * init), then lay ONE broad flat ellipse per component — sized and oriented
   * to the component's principal axis and coloured with its mean — largest
   * areas first. The classical "wash in the large flat values before detail"
   * step; the R3 init and the coarse→fine schedule refine on top of it.
   *
   * Opt-in (`regionFill > 0`, default 0) so the R3 result is untouched otherwise.
   * Deterministic — no RNG.
   *
   * @param {number} budget - Max strokes this pass may emit.
   * @returns {number} Strokes actually emitted.
   */
  function regionFillPass(budget) {
    if (budget <= 0) return 0;
    levelTarget = target;
    elongMul = 1;
    const regions = buildRegions(analysis, {
      levels: opts.regionLevels,
      minArea: opts.regionFillMinArea,
      maxAreaFrac: opts.regionFillMaxAreaFrac,
    });
    let emitted = 0;
    for (let ri = 0; ri < regions.length && emitted < budget; ri++) {
      const rg = regions[ri];
      if (rg.area < opts.regionFillMinArea) continue;
      const halfMajor = 0.5 * Math.sqrt(12 * rg.l1);
      const halfMinor = 0.5 * Math.sqrt(12 * rg.l2);
      commitShape({
        x: rg.cx,
        y: rg.cy,
        rx: clamp(halfMajor * opts.regionFillMargin, opts.minSize / 2, opts.maxSize),
        ry: clamp(halfMinor * opts.regionFillMargin, opts.minSize / 2, opts.maxSize),
        rot: rg.angle,
        r: clamp(rg.color[0], 0, 255),
        g: clamp(rg.color[1], 0, 255),
        b: clamp(rg.color[2], 0, 255),
        alpha: opts.regionFillAlpha,
      });
      emitted++;
    }
    return emitted;
  }

  /**
   * R4 outline pass — lay contour strokes along the extracted edges.
   *
   * Feature parity with the legacy painter's edge-following outline lay-in,
   * re-derived from the clean-room seam: `r4.planOutlines()` walks the
   * structure-tensor edge field into polylines (longest / strongest first) and
   * this pass samples them into small dabs of the LOCAL colour, establishing the
   * contours before (mode `first`) or after (mode `last`) the masses.
   *
   * The sample is spread evenly across EVERY contour (a stride over the
   * concatenated walk) rather than clustered on the first one, the budget is
   * capped, and the pass is deterministic — no RNG.
   *
   * @param {number} budget - Max strokes this pass may emit.
   * @param {Array<Array<[number,number]>>} points - polylines from `planOutlines`.
   * @returns {number} Strokes actually emitted.
   */
  function outlinePass(budget, points) {
    if (budget <= 0 || !Array.isArray(points) || points.length === 0) return 0;
    levelTarget = target;
    elongMul = 1;
    let total = 0;
    for (const pl of points) total += Array.isArray(pl) ? pl.length : 0;
    if (total === 0) return 0;
    const stride = Math.max(1, Math.ceil(total / budget));
    const r = clamp(baseR * opts.r4OutlineRadius, opts.minSize / 2, opts.maxSize);
    const sampleR = Math.max(1, r * 0.75);
    let emitted = 0;
    let seen = 0;
    for (const pl of points) {
      if (!Array.isArray(pl)) continue;
      for (let k = 0; k < pl.length && emitted < budget; k++, seen++) {
        if (seen % stride !== 0) continue;
        const x = pl[k][0];
        const y = pl[k][1];
        if (!(x >= 0 && x < W && y >= 0 && y < H)) continue;
        const c = localColor(x, y, sampleR);
        commitShape({
          x, y,
          rx: r, ry: r, rot: 0,
          r: clamp(c[0], 0, 255), g: clamp(c[1], 0, 255), b: clamp(c[2], 0, 255),
          alpha: opts.r4OutlineAlpha,
        });
        emitted++;
      }
    }
    return emitted;
  }

  /**
   * Paint one coarse→fine pass: place up to `budget` dabs of radius
   * `baseR·radiusMul` against `levelTarget`, refining each with the local
   * hill-climb, committing into the shared `paint` buffer.
   *
   * @returns {number} Number of strokes actually emitted (can be < budget when
   *   the pass runs out of error to remove).
   */
  function paintPass(passTarget, radiusBase, elongScale, budget, mask, passAlpha, passDetail) {
    levelTarget = passTarget;
    elongMul = elongScale;
    // Per-pass overrides (S4) fall back to the global options, so a pass that
    // declares neither is byte-identical to the pre-S4 pass body.
    const alpha = passAlpha !== undefined ? passAlpha : opts.alpha;
    const detail = passDetail !== undefined ? passDetail : opts.detail;
    let emitted = 0;

    for (let s = 0; s < budget; s++) {
      // ── 1. residual-driven placement ──────────────────────────────────────
      // Score every pixel by its residual error, damped by how much paint it has
      // already received, then draw the anchor from the high-residual set with a
      // seeded weighted sample. Sampling (rather than always taking the argmax)
      // spreads strokes across the whole error region instead of walking a single
      // boundary — the deterministic RNG keeps it reproducible. A band-scoped
      // pass (S4) multiplies the score by its band mask, biasing (never
      // forcing) the residual sample onto that band.
      // Saliency-weighted placement (worker lever 2): when enabled, the focus
      // map multiplies the score so strokes are biased toward visually salient
      // regions; the subject mask adds a small bonus inside the detected subject.
      let best = -1, maxScore = 0;
      for (let i = 0; i < n; i++) {
        let score = err[i] * (1 - opts.spread * clamp(cov[i], 0, 1)) * (mask ? mask[i] : 1);
        if (opts.saliencyWeighted && focusMap) {
          // Blend rather than replace: `saliencyStrength` (default 1.0 =
          // current behaviour) scales the focus map toward uniform
          // placement, so low-saliency regions keep receiving strokes and
          // the background's residual error still gets resolved.
          const s = clamp(opts.saliencyStrength, 0, 1);
          score *= (1 - s) + s * focusMap[i];
          if (subjectMask && subjectMask[i]) score *= opts.saliencySubjectBonus;
        }
        if (score > maxScore) { maxScore = score; best = i; }
      }
      if (best < 0 || maxScore <= 1e-4) break;
      const thr = opts.anchorThreshold * maxScore;
      for (let attempt = 0; attempt < 24; attempt++) {
        const i = Math.floor(random.next() * n);
        let score = err[i] * (1 - opts.spread * clamp(cov[i], 0, 1)) * (mask ? mask[i] : 1);
        if (opts.saliencyWeighted && focusMap) {
          const s = clamp(opts.saliencyStrength, 0, 1);
          score *= (1 - s) + s * focusMap[i];
          if (subjectMask && subjectMask[i]) score *= opts.saliencySubjectBonus;
        }
        if (score >= thr) { best = i; break; }
      }
      const ax = (best % W) + 0.5;
      const ay = Math.floor(best / W) + 0.5;

      // ── 2. propose a dab at the anchor ────────────────────────────────────
      const edgeMag = edges ? sampleEdge(edges, W, H, ax, ay) : 0;
      const detailFactor = 1 - detail * clamp(edgeMag, 0, 1);
      let radius = radiusBase * detailFactor * random.range(0.85, 1.15);
      radius = clamp(radius, opts.minSize, opts.maxSize);

      let rot = 0, elong = 1;
      if (structure) {
        const coh = clamp(sampleStructure(structure.coherence, W, H, ax, ay), 0, 1);
        if (coh > 0.05) {
          rot = sampleStructure(structure.orientation, W, H, ax, ay);
          // Scale-aware: broad coarse dabs stay round, fine dabs hug edges.
          elong = 1 + opts.elongation * elongMul * coh;
        }
      } else if (edgeX && edgeY) {
        const gx = sampleEdge(edgeX, W, H, ax, ay);
        const gy = sampleEdge(edgeY, W, H, ax, ay);
        if (gx !== 0 || gy !== 0) rot = Math.atan2(gy, gx) + Math.PI / 2;
      }

      let p = {
        x: ax, y: ay, rx: radius * elong, ry: radius, rot,
        r: 0, g: 0, b: 0, alpha,
      };
      const col = localColor(ax, ay, clamp(0.45 * Math.min(p.rx, p.ry), 1.2, 3.5));
      p.r = col[0]; p.g = col[1]; p.b = col[2];

      // ── 3. per-stroke local hill-climb (coordinate ascent) ────────────────
      // The dab stays a *dab*: size is clamped to a small band around the
      // proposal and the centre may only drift a little, so the search cannot
      // degenerate into one giant colour-averaged sweep (the R0 failure mode).
      const rx0 = p.rx, ry0 = p.ry;
      const maxR = Math.max(rx0, ry0);
      const stepPos = opts.posStep * maxR;
      const clampSize = (c) => {
        c.rx = clamp(c.rx, rx0 * opts.minSizeFactor, rx0 * opts.maxSizeFactor);
        c.ry = clamp(c.ry, ry0 * opts.minSizeFactor, ry0 * opts.maxSizeFactor);
        c.x = clamp(c.x, Math.max(0, ax - opts.maxDrift * maxR), Math.min(W - 1, ax + opts.maxDrift * maxR));
        c.y = clamp(c.y, Math.max(0, ay - opts.maxDrift * maxR), Math.min(H - 1, ay + opts.maxDrift * maxR));
        c.r = clamp(c.r, 0, 255); c.g = clamp(c.g, 0, 255); c.b = clamp(c.b, 0, 255);
        return c;
      };
      let bestD = evaluate(p, windowOf(p, 1), false);

      for (let round = 0; round < opts.rounds; round++) {
        const moves = [
          { x: p.x + stepPos }, { x: p.x - stepPos },
          { y: p.y + stepPos }, { y: p.y - stepPos },
          { rx: p.rx * opts.sizeStep, ry: p.ry * opts.sizeStep },
          { rx: p.rx / opts.sizeStep, ry: p.ry / opts.sizeStep },
          { rot: p.rot + opts.rotStep }, { rot: p.rot - opts.rotStep },
          { r: p.r + opts.colorStep }, { r: p.r - opts.colorStep },
          { g: p.g + opts.colorStep }, { g: p.g - opts.colorStep },
          { b: p.b + opts.colorStep }, { b: p.b - opts.colorStep },
        ];
        for (const mv of moves) {
          const cand = clampSize({ ...p, ...mv });
          const d = evaluate(cand, windowOf(cand, 1), false);
          if (d < bestD - 1e-6) { p = cand; bestD = d; }
        }
      }

      // ── 4. commit ─────────────────────────────────────────────────────────
      evaluate(p, windowOf(p, 1), true);
      if (opts.onStroke) opts.onStroke(strokeIndex, meanErrorVs(target));

      const win = windowOf(p, 1);
      let c0, c1;
      if (opts.gradientLSQ) {
        const palette = opts.palette || null;
        const [g0, g1] = solveStrokeGradientLSQ(p, win, palette);
        c0 = [Math.round(clamp(g0[0], 0, 255)), Math.round(clamp(g0[1], 0, 255)), Math.round(clamp(g0[2], 0, 255))];
        c1 = [Math.round(clamp(g1[0], 0, 255)), Math.round(clamp(g1[1], 0, 255)), Math.round(clamp(g1[2], 0, 255))];
      } else {
        const cr = Math.round(p.r), cg = Math.round(p.g), cb = Math.round(p.b);
        c0 = [cr, cg, cb];
        c1 = [cr, cg, cb];
      }
      shapes.push(createShape({
        id: `r2_${strokeIndex}_${((strokeIndex * 2654435761) >>> 0).toString(36)}`,
        type: 'E',
        params: [p.x, p.y, p.rx, p.ry, p.rot, p.rot, 0, 0],
        color0: c0,
        color1: c1,
        alpha: p.alpha,
        style: 'painterly',
        layer: 0,
        order: strokeIndex,
        seed: strokeIndex,
      }));
      strokeIndex++;
      emitted++;
    }
    return emitted;
  }

  // ── R4 outlines — the edge-following contour lay-in (opt-in, default off) ──
  // `first` lays the contours here, before the region passes and the coarse→fine
  // schedule; `last` reserves the same budget now but paints them after the
  // schedule. Either way the budget is carved out of `count` so the total stays
  // exact, and the default (`off`) runs nothing at all — output is byte-identical.
  const r4OutlineMode = resolveR4OutlineMode(opts.r4Outline);
  const outlineActive = r4OutlineMode === 'first' || r4OutlineMode === 'last';
  const outlineBudget = outlineActive
    ? Math.round(opts.count * clamp(opts.r4OutlineShare, 0, 1))
    : 0;
  let outlineUsed = 0;
  let outlinePoints = null;
  if (outlineActive) {
    outlinePoints = planOutlines(analysis, {
      ...(opts.r4OutlineOptions || {}),
      mode: r4OutlineMode,
    }).points;
    if (r4OutlineMode === 'first') outlineUsed = outlinePass(outlineBudget, outlinePoints);
  }

  // ── R4 region fill — block in the big flat areas first (opt-in) ───────────
  const fillBudget = opts.regionFill > 0
    ? Math.round(opts.count * clamp(opts.regionFill, 0, 1))
    : 0;
  const fillUsed = regionFillPass(fillBudget);

  // ── R3 region init (CCL + PCA) ────────────────────────────────────────────
  // Seed strokes from connected-component principal axes *before* the residual
  // schedule, so elongated / flat regions start nearly right and the coarse→fine
  // passes spend their budget on what the init did not already cover.
  const regionBudget = opts.regionInit
    ? Math.round(opts.count * clamp(opts.regionShare, 0, 1))
    : 0;
  const regionUsed = regionInitPass(regionBudget);

  // ── pass schedule: geometric coarse→fine, OR the Style Profile's explicit
  //    passes[] (Track-S S4). `resolvePassPlan` returns `buildScalePlan(opts,
  //    baseR)` verbatim when no explicit passes are supplied, so the default
  //    schedule is byte-identical; either way every pass stays residual-driven
  //    and resets `err` against its own (blurrier / sharper) reference.
  const plan = resolvePassPlan(opts, baseR);
  // Band masks are built only when some pass declares layers — nothing at all
  // is computed for the geometric schedule or a plain explicit schedule.
  const passMasks = plan.some((p) => p.bands && p.bands.length > 0)
    ? plan.map((p) => buildPassMask(analysis, p.bands))
    : null;
  // The outline budget is reserved up front for BOTH modes, so `last` still has
  // capacity left after the greedy schedule has taken its share of `count`.
  const outlineReserved = outlineActive
    ? (r4OutlineMode === 'first' ? outlineUsed : outlineBudget)
    : 0;
  let remaining = opts.count - outlineReserved - fillUsed - regionUsed;
  // The schedule's own total (what the init left) drives the budget split, so
  // the pass weights still describe the schedule and the sum stays exact.
  const scheduleTotal = Math.max(1, remaining);

  for (let k = 0; k < plan.length; k++) {
    if (remaining <= 0) break;
    const level = plan[k];
    const isLast = k === plan.length - 1;
    // This pass's share of the budget; the last pass takes whatever is left so
    // the total is exact. Any budget a coarse pass leaves unspent (because it
    // ran out of error) carries forward to the next, finer pass.
    let budget = isLast ? remaining : Math.min(remaining, Math.round(scheduleTotal * level.weight));
    const passTarget = level.blurR >= 1 ? blurRGB(target, W, H, level.blurR) : target;
    // Reset the residual map to measure the running canvas against this scale's
    // (progressively sharper) reference.
    for (let i = 0; i < n; i++) {
      err[i] = (
        Math.abs(paint[i * 3] - passTarget[i * 3]) +
        Math.abs(paint[i * 3 + 1] - passTarget[i * 3 + 1]) +
        Math.abs(paint[i * 3 + 2] - passTarget[i * 3 + 2])
      ) / 3;
    }
    const used = paintPass(passTarget, baseR * level.radiusMul, level.elongMul, budget,
      passMasks ? passMasks[k] : null, level.alpha, level.detail);
    remaining -= used;
  }

  // ── R4 outlines `last` — lay the reserved contour strokes after the masses ─
  // The budget was reserved before the schedule, so this keeps the total at
  // `count` whenever the schedule was greedy.
  if (r4OutlineMode === 'last') {
    outlineUsed = outlinePass(
      Math.min(outlineBudget, Math.max(0, opts.count - shapes.length)),
      outlinePoints,
    );
  }

  // ── R4 paint order — consume the plan's order mode (opt-in, default off) ──
  // The R4 plan (js/engine/r4.js) names a paint order for the shape set. Applying
  // it here just PERMUTES the returned array — the array order is the composite
  // order the renderer paints in. `planOrder` plans over a COPY of the shapes, so
  // no shape's own fields (`seed`, `order`) are mutated; only the sequence the
  // renderer walks changes. `stats` still describe the optimiser's own
  // emission-order paint buffer — the shape SET is unchanged by a reorder, so
  // the reported error remains the optimiser's objective value for that set.
  const r4Order = typeof opts.r4 === 'string' ? opts.r4 : (opts.r4 && opts.r4.order);
  const r4Mode = typeof r4Order === 'string' ? r4Order : (r4Order && r4Order.mode);
  let paintOrder = null;
  if (r4Mode) {
    const planned = planOrder(shapes, r4Mode, { width: W, height: H });
    paintOrder = planned.mode;
    if (planned.native && planned.changed) {
      const permuted = planned.order.map((i) => shapes[i]);
      shapes.length = 0;
      for (const s of permuted) shapes.push(s);
    }
  }

  const finalError = meanErrorVs(target);
  return {
    shapes,
    stats: {
      count: shapes.length,
      scales: plan.length,
      fill: fillUsed,
      regions: regionUsed,
      initialError: +initialError.toFixed(4),
      finalError: +finalError.toFixed(4),
      mae: +finalError.toFixed(4),
      simMae: +(100 * (1 - finalError / 255)).toFixed(2),
      ...(outlineActive ? { outline: outlineUsed, outlineMode: r4OutlineMode } : {}),
      ...(paintOrder ? { paintOrder } : {}),
      // Reported only when a style's shaping actually retuned the run.
      ...(opts.shaping ? { shaping: opts.shaping.style || null, shapingParts: opts.shaping.parts } : {}),
    },
  };
}

export default {
  OPTIMISER_DEFAULTS, resolveOptions, resolveR4OutlineMode, buildScalePlan, applyPrimitiveLanguage,
  PASS_SCALES, resolvePassPlan, optimise,
  SHAPING_PARTS, resolveR4Shaping, applyR4Shaping,
};
