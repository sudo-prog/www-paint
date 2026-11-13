/**
 * Reference analysis — the analysis grid + structured `RefPacket` (Track S, S1).
 *
 * `analyzeReference()` turns a reference image into a structured, **JSON-safe**
 * `RefPacket`: an adaptive coarse grid whose every cell carries the local
 * structure (the tangent orientation and how strongly it holds, coherence, edge
 * density, local contrast) and an *implied stroke scale* in relative units —
 * plus whole-image summaries: a stroke-scale histogram, a per-tonal-band stroke
 * scale, an orientation histogram, and the tonal / depth-proxy coverage.
 *
 * Why it exists. The eval harness scores **content reconstruction** (MAE / SSIM):
 * "does the render look like the photo". It does not score **style match to the
 * references** — "does the stroke language match". Track S is the style-accuracy
 * track; this module is its first step: a machine-readable description of a
 * reference's stroke language, so a Style-Match Score (S2) has something to
 * compare against. It is deliberately **additive** — it consumes `analyzer.js`
 * (structure tensor) and `masks.js` (tonal bands) and changes neither.
 *
 * Roots. Structure-tensor orientation steering (Hertzmann 1998; the Image
 * Painter CCL+PCA family) and the classic value-first painterly order (Zorn /
 * Reilly abstraction) — see `docs/REFERENCES.md`. Every expression here is our
 * own; cite the published technique, never an implementation.
 *
 * Pure. No DOM, no canvas, and no randomness beyond `analyzer.js`'s
 * deterministic seeded palette, so the same source always yields the same
 * packet and the packet round-trips through `JSON.parse(JSON.stringify(...))`.
 *
 * @module ref-analyze
 */

import { analyzeImage, computeStructureTensor } from './analyzer.js';
import { computeTonalMasks } from './masks.js';
// S2's comparison primitives, reused by S3's fusion so a reference is judged by
// the *same* measure a render is — there is exactly one style distance in the repo.
import { refPacketDistance, histogramDistance, orientationMatch } from './metrics.js';

/// Resolution of the stroke-scale histogram (bin i covers
/// `[i/BINS, (i+1)/BINS)` of the relative stroke scale; 0 = finest, top = coarsest).
export const SCALE_BINS = 8;

/// Resolution of the orientation histogram over the PI-periodic tangent angle.
export const ORIENTATION_BINS = 12;

/// Cell band order — shared with `masks.js`.
export const BAND_NAMES = Object.freeze(['background', 'shadows', 'midtones', 'highlights']);

export const REF_DEFAULTS = Object.freeze({
  minGrid: 8,
  maxGrid: 32,
  targetCell: 24, // aim for ~24 px cells, then clamp to [minGrid, maxGrid]
  structureRadius: 3,
  densityThreshold: 0.15, // structure.energy above this counts as "structure present"
  scaleFloor: 0.08, // smallest implied stroke scale (finest detail)
  seed: 12345,
});

/** @returns {number} x clamped to [0, 1]. */
function clamp01(x) {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/** Wrap an angle into [0, PI). Line orientation is PI-periodic. */
function wrapPi(a) {
  const p = Math.PI;
  let x = a % p;
  if (x < 0) x += p;
  return x;
}

/**
 * Pick the grid resolution for an image: aim for ~`targetCell` px cells, then
 * clamp to `[minGrid, maxGrid]`. Deterministic in `(width, height, opts)`.
 *
 * @param {number} width
 * @param {number} height
 * @param {object} [opts]
 * @returns {number} N for an NxN grid.
 */
export function chooseGridSize(width, height, opts = {}) {
  const {
    minGrid = REF_DEFAULTS.minGrid,
    maxGrid = REF_DEFAULTS.maxGrid,
    targetCell = REF_DEFAULTS.targetCell,
  } = opts;
  const md = Math.min(width, height);
  let n = Math.round(md / Math.max(1, targetCell));
  if (!Number.isFinite(n) || n < minGrid) n = minGrid;
  if (n > maxGrid) n = maxGrid;
  return n;
}

/**
 * Accept either raw pixels or an existing `analyzeImage()` result and return an
 * analysis that carries a structure tensor.
 * @param {object} source
 * @param {object} opts
 * @returns {object} AnalysisResult with a non-null `structure`.
 */
function coerceAnalysis(source, opts) {
  if (source && source.width && source.height && source.luminance) {
    if (source.structure) return source;
    if (source.edgeX && source.edgeY) {
      const structure = computeStructureTensor(source.edgeX, source.edgeY, source.width, source.height, {
        radius: opts.structureRadius,
      });
      return { ...source, structure };
    }
    // An analysis with neither structure nor gradients cannot be gridded.
    throw new Error('analyzeReference: analysis result has no structure tensor or gradients');
  }
  if (source && source.pixels && source.width && source.height) {
    return analyzeImage(source.pixels, source.width, source.height, {
      structure: true,
      structureRadius: opts.structureRadius,
      seed: opts.seed,
    });
  }
  throw new Error('analyzeReference requires {pixels,width,height} or an analyzeImage() result');
}

/**
 * Analyse one reference image into a structured `RefPacket`.
 *
 * @param {object} source - `{ pixels: Uint8ClampedArray|Uint8Array, width, height }`
 *   or an `analyzeImage()` result.
 * @param {object} [opts] - Overrides for `REF_DEFAULTS` plus `toneOptions`
 *   (forwarded to `computeTonalMasks`).
 * @returns {object} A JSON-safe `RefPacket`.
 */
export function analyzeReference(source, opts = {}) {
  const o = { ...REF_DEFAULTS, ...opts };
  const analysis = coerceAnalysis(source, o);
  const { width, height, luminance } = analysis;
  const st = analysis.structure;
  const { orientation, coherence, energy } = st;

  const tones = computeTonalMasks(analysis, opts.toneOptions || {});
  const bandMasks = BAND_NAMES.map((b) => tones.masks[b]);

  const gridSize = chooseGridSize(width, height, o);
  const cellW = width / gridSize;
  const cellH = height / gridSize;
  const K = gridSize * gridSize;

  // Per-cell accumulators (single pass over the pixels).
  const acc = new Array(K);
  for (let k = 0; k < K; k++) {
    acc[k] = {
      count: 0, lumaSum: 0, lumaSq: 0,
      cohSum: 0, energySum: 0, density: 0,
      ox: 0, oy: 0, oW: 0, // energy-weighted double-angle orientation accumulator
      band: [0, 0, 0, 0],
    };
  }

  for (let y = 0; y < height; y++) {
    let gy = Math.floor(y / cellH);
    if (gy >= gridSize) gy = gridSize - 1;
    for (let x = 0; x < width; x++) {
      let gx = Math.floor(x / cellW);
      if (gx >= gridSize) gx = gridSize - 1;
      const i = y * width + x;
      const a = acc[gy * gridSize + gx];
      const L = luminance[i];
      a.count++;
      a.lumaSum += L;
      a.lumaSq += L * L;
      a.cohSum += coherence[i];
      a.energySum += energy[i];
      if (energy[i] > o.densityThreshold) a.density++;
      const wgt = energy[i] + 1e-6;
      const th = orientation[i];
      a.ox += Math.cos(2 * th) * wgt;
      a.oy += Math.sin(2 * th) * wgt;
      a.oW += wgt;
      for (let b = 0; b < 4; b++) a.band[b] += bandMasks[b][i];
    }
  }

  // Collapse the accumulators into cells + whole-image summaries.
  const cells = new Array(K);
  const scaleHistogram = new Array(SCALE_BINS).fill(0);
  const orientationBins = new Array(ORIENTATION_BINS).fill(0);
  let scaleSum = 0, cohMean = 0, densMean = 0, lumaMean = 0, enMean = 0, obTot = 0;
  const bandScale = [0, 0, 0, 0];
  const bandMass = [0, 0, 0, 0];

  for (let k = 0; k < K; k++) {
    const a = acc[k];
    const gx = k % gridSize;
    const gy = (k - gx) / gridSize;
    const count = Math.max(1, a.count);

    const lumaCell = a.lumaSum / count / 255;
    const varL = Math.max(0, a.lumaSq / count - (a.lumaSum / count) ** 2);
    const contrast = Math.sqrt(varL) / 255; // ~0..0.5
    const density = a.density / count;
    const coh = a.cohSum / count;
    const en = a.energySum / count;

    // Energy-weighted circular mean over the PI-periodic tangent angle.
    const meanAng = wrapPi(0.5 * Math.atan2(a.oy, a.ox));
    const R = a.oW > 0 ? Math.hypot(a.ox, a.oy) / a.oW : 0;

    // Implied stroke scale: a busy cell (many edges, high local contrast) wants
    // fine strokes; a flat cell wants coarse strokes. Relative units, 0..1.
    const detail = clamp01(0.65 * density + 0.35 * clamp01(contrast * 2.5));
    const strokeScale = Math.max(o.scaleFloor, 1 - detail);
    let scaleBin = Math.floor(strokeScale * SCALE_BINS);
    if (scaleBin >= SCALE_BINS) scaleBin = SCALE_BINS - 1;
    if (scaleBin < 0) scaleBin = 0;

    cells[k] = {
      gx, gy,
      x0: Math.round(gx * cellW), y0: Math.round(gy * cellH),
      x1: Math.round((gx + 1) * cellW), y1: Math.round((gy + 1) * cellH),
      orientation: meanAng,
      orientationStrength: clamp01(R),
      coherence: coh,
      energy: en,
      density,
      contrast,
      luma: lumaCell,
      strokeScale,
      scaleBin,
      bandMass: a.band.map((v) => v / count), // avg tonal band weight per pixel
    };

    scaleHistogram[scaleBin]++;
    scaleSum += strokeScale;
    cohMean += coh;
    densMean += density;
    lumaMean += lumaCell;
    enMean += en;

    const w = en * count + 1e-9;
    let bi = Math.floor((meanAng / Math.PI) * ORIENTATION_BINS);
    if (bi >= ORIENTATION_BINS) bi = ORIENTATION_BINS - 1;
    if (bi < 0) bi = 0;
    orientationBins[bi] += w;
    obTot += w;

    for (let b = 0; b < 4; b++) {
      bandScale[b] += strokeScale * a.band[b];
      bandMass[b] += a.band[b];
    }
  }

  const strokeScaleByBand = {};
  BAND_NAMES.forEach((name, b) => {
    strokeScaleByBand[name] = bandMass[b] > 0 ? bandScale[b] / bandMass[b] : 0;
  });

  // S3 support — a compact `styleDNA` derived from the same single pass, so a
  // multi-reference fusion (S3) has a palette and a wetness figure to merge.
  // Additive: nothing above reads these, and the packet stays JSON-safe.
  const meanCoherence = cohMean / K;
  const meanContrast = cells.reduce((s, c) => s + c.contrast, 0) / K;
  const paletteHex = Array.isArray(analysis.palette)
    ? analysis.palette.slice(0, 16).map(rgbToHex)
    : [];
  const styleDNA = {
    palette: paletteHex,
    edgeDensity: K > 0 ? densMean / K : 0,
    contrast: meanContrast,
    // PROXY, not a measurement: wet media bleeds, so it destroys the crisp
    // directional anisotropy dry hatching holds. Low coherence ⇒ wetter-looking.
    wetnessEstimate: clamp01(1 - meanCoherence),
    tones: {
      background: tones.coverage.background || 0,
      shadows: tones.coverage.shadows || 0,
      midtone: tones.coverage.midtones || 0,
      highlights: tones.coverage.highlights || 0,
    },
  };

  let domBin = 0, domVal = -1;
  orientationBins.forEach((v, i) => {
    if (v > domVal) { domVal = v; domBin = i; }
  });

  return {
    version: 1,
    module: 'ref-analyze',
    width,
    height,
    gridSize,
    cellSize: [cellW, cellH],
    cells,
    scaleBins: SCALE_BINS,
    scaleHistogram,
    strokeScaleByBand,
    orientationField: {
      binCount: ORIENTATION_BINS,
      bins: orientationBins.map((v) => (obTot > 0 ? v / obTot : 0)),
      dominant: ((domBin + 0.5) / ORIENTATION_BINS) * Math.PI,
      strength: clamp01(cohMean / K),
    },
    coverage: { ...tones.coverage },
    depthProxy: {
      // The largest flat dark region reads as paper / "far"; the rest is subject.
      background: tones.coverage.background,
      foreground: 1 - tones.coverage.background,
    },
    stats: {
      cells: K,
      gridSize,
      meanStrokeScale: scaleSum / K,
      meanCoherence,
      meanDensity: densMean / K,
      meanLuma: lumaMean / K,
      meanEnergy: enMean / K,
    },
    styleDNA,
    meta: {
      deterministic: true,
      seed: o.seed,
      structureRadius: o.structureRadius,
      densityThreshold: o.densityThreshold,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// S3 — multi-reference fusion
//
// A profile built from ONE reference inherits that reference's accidents. S3
// fuses 1–4 references into a single `RefPacket`-shaped object (module
// `ref-fusion`) so the same `refPacketDistance` / `scoreProfileStyle` machinery
// can score against "the style the references agree on", and a reference that
// disagrees with the others is DOWN-WEIGHTED rather than allowed to drag the
// consensus. Everything here is pure arithmetic on already-computed packets:
// no second analyser, no randomness, so the fusion is deterministic.
// ─────────────────────────────────────────────────────────────────────────────

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

export const FUSION_DEFAULTS = Object.freeze({
  maxRefs: 4,
  /// A reference is an outlier when its mean distance to the others exceeds
  /// THIS absolute bound AND `outlierRatio × median` deviation. For the common
  /// "two inliers + one black sheep" case the sheep's deviation is exactly
  /// `2 × median`, so `outlierRatio` must be < 2 for the rule to fire at all —
  /// 2.0 would silently never flag anything. The absolute floor keeps a tight
  /// cluster (small deviations, big ratio) from being split by noise; the AND
  /// means a genuinely scattered reference set flags nobody (see `spread`).
  outlierThreshold: 0.25,
  outlierRatio: 1.5,
  /// Weight multiplier for an outlier (down-weight, never drop).
  outlierWeight: 0.25,
  paletteSize: 16,
});

/** `[r,g,b]` (0..255) → `#rrggbb`. */
function rgbToHex(c) {
  const ch = (v) => {
    const n = Number.isFinite(v) ? Math.max(0, Math.min(255, Math.round(v))) : 0;
    return n.toString(16).padStart(2, '0');
  };
  return `#${ch(c && c[0])}${ch(c && c[1])}${ch(c && c[2])}`;
}

/** Weights → a distribution summing to 1 (all-zero ⇒ equal weights). */
function normaliseWeights(ws) {
  const s = ws.reduce((a, w) => a + (w > 0 ? w : 0), 0);
  if (s > 0) return ws.map((w) => (w > 0 ? w / s : 0));
  const n = ws.length || 1;
  return ws.map(() => 1 / n);
}

/** Median of a numeric array (0 for an empty array). */
function median(a) {
  const s = a.slice().sort((x, y) => x - y);
  const n = s.length;
  if (!n) return 0;
  const m = Math.floor(n / 2);
  return n % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Weighted mean of several histograms *as distributions* (each renormalised
 * first, so a raw-count histogram and a frequency histogram weigh the same),
 * renormalised so the result sums to 1.
 */
function weightedHistogram(hists, weights, bins) {
  const out = new Array(bins).fill(0);
  let wsum = 0;
  for (let h = 0; h < hists.length; h++) {
    const w = weights[h];
    if (!(w > 0)) continue;
    wsum += w;
    const hist = hists[h] || [];
    const tot = hist.reduce((s, v) => s + (v > 0 ? v : 0), 0);
    for (let i = 0; i < bins; i++) {
      out[i] += w * (tot > 0 ? (hist[i] > 0 ? hist[i] : 0) / tot : 1 / bins);
    }
  }
  const tot = out.reduce((s, v) => s + v, 0);
  if (tot > 0) for (let i = 0; i < bins; i++) out[i] /= tot;
  return out;
}

/** Weighted mean of `{key: number}` maps over a fixed key list. */
function weightedValueMap(maps, weights, keys) {
  const out = {};
  let wsum = 0;
  for (let h = 0; h < maps.length; h++) {
    const w = weights[h];
    if (!(w > 0)) continue;
    wsum += w;
    const m = maps[h] || {};
    for (const k of keys) out[k] = (out[k] || 0) + w * (m[k] > 0 ? m[k] : 0);
  }
  for (const k of keys) out[k] = wsum > 0 ? out[k] / wsum : 0;
  return out;
}

/** Weighted mean of a numeric series (non-finite entries skipped). */
function weightedMean(vals, weights) {
  let num = 0, den = 0;
  for (let i = 0; i < vals.length; i++) {
    const w = weights[i];
    if (!(w > 0)) continue;
    const v = vals[i];
    if (!Number.isFinite(v)) continue;
    num += w * v;
    den += w;
  }
  return den > 0 ? num / den : 0;
}

/** PI-periodic weighted circular mean over doubled angles. */
function weightedAngle(angles, weights) {
  let x = 0, y = 0, w = 0;
  for (let i = 0; i < angles.length; i++) {
    const wi = weights[i];
    if (!(wi > 0)) continue;
    const a = angles[i];
    if (!Number.isFinite(a)) continue;
    x += Math.cos(2 * a) * wi;
    y += Math.sin(2 * a) * wi;
    w += wi;
  }
  if (w <= 0) return 0;
  return wrapPi(0.5 * Math.atan2(y, x));
}

/** Mean of `fn(a, b)` over all unordered pairs (0 for < 2 items). */
function pairwiseMean(items, fn) {
  const n = items.length;
  if (n < 2) return 0;
  let s = 0, c = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) { s += fn(items[i], items[j]); c++; }
  }
  return c > 0 ? s / c : 0;
}

/**
 * Merge per-reference palettes: a colour's weight is the reference's own weight
 * scaled by its rank in that palette (earlier = more dominant), summed across
 * references, then the strongest `cap` colours, ties broken by hex for
 * determinism.
 */
function mergePalettes(palettes, weights, cap) {
  const acc = new Map();
  for (let i = 0; i < palettes.length; i++) {
    const w = weights[i];
    if (!(w > 0)) continue;
    const list = palettes[i] || [];
    for (let k = 0; k < list.length; k++) {
      const hex = list[k];
      const rankW = w * (1 - k / (list.length + 1));
      acc.set(hex, (acc.get(hex) || 0) + rankW);
    }
  }
  return [...acc.entries()]
    .sort((a, b) => (b[1] - a[1]) || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .slice(0, cap)
    .map(([hex]) => hex);
}

/**
 * Fuse 1–4 reference packets into one packet-shaped consensus.
 *
 * @param {Array<object|{packet: object, weight?: number}>} refs - `RefPacket`s
 *   (from `analyzeReference`) or `{ packet, weight }` wrappers.
 * @param {object} [opts] - overrides for {@link FUSION_DEFAULTS}.
 * @returns {object} a JSON-safe fused packet, `module: 'ref-fusion'`, usable as
 *   the `reference` argument of `refPacketDistance` / `scoreProfileStyle`.
 */
export function fuseReferences(refs, opts = {}) {
  const o = { ...FUSION_DEFAULTS, ...opts };
  if (!Array.isArray(refs) || refs.length === 0) {
    throw new Error('fuseReferences: at least one reference is required');
  }
  if (refs.length > o.maxRefs) {
    throw new Error(`fuseReferences: at most ${o.maxRefs} references (got ${refs.length})`);
  }

  const entries = refs.map((r) => {
    const packet = (r && r.packet) ? r.packet : r;
    const weight = (r && Number.isFinite(r.weight)) ? r.weight : 1;
    if (!packet || !Array.isArray(packet.scaleHistogram) || !isObj(packet.orientationField)) {
      throw new Error('fuseReferences: each reference must be a RefPacket (or {packet, weight})');
    }
    return { packet, weight };
  });
  const N = entries.length;
  const packets = entries.map((e) => e.packet);
  const base = normaliseWeights(entries.map((e) => e.weight));

  // Pairwise style distance → each reference's deviation from the others.
  const dist = packets.map((pi, i) =>
    packets.map((pj, j) => (i === j ? 0 : refPacketDistance(pi, pj).distance)));
  const deviation = dist.map((row, i) => {
    if (N === 1) return 0;
    let s = 0, c = 0;
    for (let j = 0; j < N; j++) if (j !== i) { s += row[j]; c++; }
    return c > 0 ? s / c : 0;
  });
  const med = median(deviation);
  const isOutlier = deviation.map((d) =>
    N > 1 && d > o.outlierThreshold && d > o.outlierRatio * med);

  const rawW = base.map((w, i) => w * (isOutlier[i] ? o.outlierWeight : 1));
  const w = normaliseWeights(rawW);

  const scaleHistogram = weightedHistogram(packets.map((p) => p.scaleHistogram), w, SCALE_BINS);
  const obins = weightedHistogram(
    packets.map((p) => (p.orientationField && p.orientationField.bins) || []), w, ORIENTATION_BINS);
  const strokeScaleByBand = weightedValueMap(packets.map((p) => p.strokeScaleByBand), w, BAND_NAMES);
  const coverage = weightedValueMap(packets.map((p) => p.coverage), w, BAND_NAMES);

  const dnas = packets.map((p) => p.styleDNA || {});
  const styleDNA = {
    palette: mergePalettes(dnas.map((d) => d.palette), w, o.paletteSize),
    edgeDensity: weightedMean(dnas.map((d) => d.edgeDensity), w),
    contrast: weightedMean(dnas.map((d) => d.contrast), w),
    wetnessEstimate: weightedMean(dnas.map((d) => d.wetnessEstimate), w),
    tones: weightedValueMap(dnas.map((d) => d.tones), w, ['background', 'shadows', 'midtone', 'highlights']),
  };

  const stats = (key) => weightedMean(packets.map((p) => (p.stats && p.stats[key])), w);
  const cohs = packets.map((p) => (p.stats && p.stats.meanCoherence) || 0);
  const cohMean = weightedMean(cohs, w);
  const cohVar = weightedMean(cohs.map((v) => (v - cohMean) ** 2), w);

  const agreeDist = pairwiseMean(packets, (a, b) => refPacketDistance(a, b).distance);
  const spread = {
    agreement: clamp01(1 - agreeDist),
    scale: pairwiseMean(packets, (a, b) => histogramDistance(a.scaleHistogram, b.scaleHistogram)),
    orientation: pairwiseMean(packets, (a, b) =>
      1 - orientationMatch(a.orientationField && a.orientationField.bins,
        b.orientationField && b.orientationField.bins)),
    coherence: Math.sqrt(Math.max(0, cohVar)) * 2, // ±1σ spread of mean coherence
  };

  return {
    version: 1,
    module: 'ref-fusion',
    method: 'weighted-mean',
    refCount: N,
    refs: entries.map((e, i) => ({
      index: i,
      weight: w[i],
      baseWeight: base[i],
      deviation: deviation[i],
      outlier: isOutlier[i],
    })),
    scaleBins: SCALE_BINS,
    scaleHistogram,
    strokeScaleByBand,
    orientationField: {
      binCount: ORIENTATION_BINS,
      bins: obins,
      dominant: weightedAngle(packets.map((p) => p.orientationField && p.orientationField.dominant), w),
      strength: weightedMean(packets.map((p) => p.orientationField && p.orientationField.strength), w),
    },
    coverage,
    depthProxy: {
      background: coverage.background,
      foreground: clamp01(1 - coverage.background),
    },
    stats: {
      cells: packets.reduce((s, p) => s + ((p.stats && p.stats.cells) || 0), 0),
      refs: N,
      meanStrokeScale: stats('meanStrokeScale'),
      meanCoherence: cohMean,
      meanDensity: stats('meanDensity'),
      meanLuma: stats('meanLuma'),
      meanEnergy: stats('meanEnergy'),
    },
    styleDNA,
    spread,
    meta: {
      deterministic: true,
      outlierThreshold: o.outlierThreshold,
      outlierRatio: o.outlierRatio,
      outlierWeight: o.outlierWeight,
    },
  };
}

export default {
  analyzeReference,
  chooseGridSize,
  fuseReferences,
  SCALE_BINS,
  ORIENTATION_BINS,
  BAND_NAMES,
  REF_DEFAULTS,
  FUSION_DEFAULTS,
};
