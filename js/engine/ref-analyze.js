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
      meanCoherence: cohMean / K,
      meanDensity: densMean / K,
      meanLuma: lumaMean / K,
      meanEnergy: enMean / K,
    },
    meta: {
      deterministic: true,
      seed: o.seed,
      structureRadius: o.structureRadius,
      densityThreshold: o.densityThreshold,
    },
  };
}

export default {
  analyzeReference,
  chooseGridSize,
  SCALE_BINS,
  ORIENTATION_BINS,
  BAND_NAMES,
  REF_DEFAULTS,
};
