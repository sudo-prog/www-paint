/**
 * Stroke generation orchestrator.
 *
 * The Generator produces candidate shapes based on style parameters and the
 * current image analysis.  It does NOT score — that's the Scorer's job.
 * It produces a flat list of candidate shapes, which are then passed to
 * `selectBest` or `selectGreedyResidual`.
 *
 * @module generator
 */

import { rng } from '../utils/rng.js';
import { clamp } from '../utils/math.js';
import { quantizeColor } from '../utils/color.js';
import { createShape, centroid } from './shapes.js';
import { sampleRegion, sampleLuminance, sampleEdge } from './analyzer.js';

/**
 * Default settings for shape generation.
 *
 * @type {object}
 */
export const DEFAULT_SETTINGS = {
  style: 'pencil',
  strokeSize: { min: 2, max: 8, random: true },
  spacing: 0.5,
  scatter: 0.3,
  strokeCount: 1000,
  detailLevel: 0.7,
  randomness: 0.3,
  styleStrength: 0.8,   // 0..1 — strength of the chosen style's effect
  opacity: 0.85,        // 0..1 — default stroke opacity
  colorMode: 'exact',   // exact | quantized | palette
  paletteSize: 8,
  pathOrder: 'free',    // free | top-bottom | spiral | one-line | edges-first
  shapeBias: { E: 0.1, B: 0.15, T: 0.05, R: 0.3, S: 0.4 },
};

/**
 * Merge user settings over defaults.
 *
 * @param {object} [userSettings]
 * @returns {object}
 */
export function resolveSettings(userSettings = {}) {
  const out = { ...DEFAULT_SETTINGS };
  for (const key of Object.keys(userSettings)) {
    const val = userSettings[key];
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      out[key] = { ...out[key], ...val };
    } else {
      out[key] = val;
    }
  }
  return out;
}

/**
 * Generate candidate shapes from an analysis result.
 *
 * @param {object} analysis - AnalysisResult from analyzeImage.
 * @param {object} settings - Resolved settings (see resolveSettings).
 * @param {number} seed - Master random seed.
 * @param {number} [maxCandidates=5000] - Safety cap on generated candidates.
 * @returns {Array<object>} Candidate shape objects.
 */
export function generateCandidates(analysis, settings, seed, maxCandidates = 5000) {
  const { width, height, pixels, luminance: lumMap, edges, palette } = analysis;
  const s = resolveSettings(settings);
  const random = rng(seed);
  const candidates = [];

  const count = clamp(s.strokeCount, 1, 100000);
  const targetCount = Math.min(maxCandidates, Math.ceil(count / (1 - s.detailLevel + 0.01)));

  // Pre-compute importance map for non-uniform sampling
  const importance = s.pathOrder === 'edges-first'
    ? null  // computed per-candidate below for edge-first
    : null;

  // Determine grid sampling density from spacing
  const minSize = s.strokeSize.min;
  const maxSize = s.strokeSize.max;

  for (let i = 0; i < targetCount; i++) {
    // --- Position ---
    let x, y;
    if (s.pathOrder === 'edges-first' && edges) {
      // Bias toward edge pixels
      [x, y] = sampleEdgePixel(edges, width, height, random, s.detailLevel);
    } else if (s.pathOrder === 'spiral') {
      [x, y] = sampleSpiral(width, height, i / targetCount);
    } else if (s.pathOrder === 'top-bottom') {
      const frac = random.next();
      y = random.range(0, height);
      x = random.range(0, width);
      // Slight top-bias
      y = y * (0.3 + 0.7 * frac);
    } else if (s.pathOrder === 'one-line') {
      // One-line: horizontal scan with slight vertical jitter, simulating
      // a single continuous pen stroke across the image
      const frac = i / targetCount;
      y = frac * height + random.range(-maxSize, maxSize);
      x = random.range(0, width);
    } else {
      // Free (random)
      x = random.range(0, width);
      y = random.range(0, height);
    }

    // Scatter
    const scatter = s.scatter * maxSize;
    x += random.range(-scatter, scatter);
    y += random.range(-scatter, scatter);
    x = clamp(x, 0, width - 1);
    y = clamp(y, 0, height - 1);

    // --- Size ---
    const size = s.strokeSize.random
      ? random.range(minSize, maxSize)
      : random.range(minSize, maxSize);
    const adjustedSize = size * random.range(1 - s.randomness, 1 + s.randomness);

    // --- Color ---
    const regionAvg = sampleRegion(pixels, width, height,
      Math.max(0, x - adjustedSize),
      Math.max(0, y - adjustedSize),
      Math.min(width - 1, x + adjustedSize),
      Math.min(height - 1, y + adjustedSize)
    );

    let color0, color1;
    if (s.colorMode === 'palette' && palette && palette.length > 0) {
      color0 = random.pick(palette);
      color1 = random.pick(palette);
    } else if (s.colorMode === 'quantized') {
      const levels = Math.max(2, s.paletteSize || 4);
      color0 = quantizeColor(regionAvg, levels);
      color1 = quantizeColor(regionAvg, levels);
      // Slight variation between c0 and c1
      color1[0] += random.range(-10, 10);
      color1[1] += random.range(-10, 10);
      color1[2] += random.range(-10, 10);
      color1 = color1.map(v => clamp(v, 0, 255));
    } else {
      color0 = regionAvg.map(v => clamp(v + random.range(-15, 15), 0, 255));
      color1 = regionAvg.map(v => clamp(v + random.range(-15, 15), 0, 255));
    }

    // --- Shape type ---
    const type = weightedPick(s.shapeBias, random);

    // --- Generate params based on type ---
    const params = generateParams(type, x, y, adjustedSize, random, s);

    // --- Alpha ---
    const alpha = clamp(random.range(0.5, 1.0) * (0.7 + 0.3 * s.styleStrength), 0, 1);

    // --- Seed for this shape ---
    const shapeSeed = random.next() * 0xFFFFFFFF;

    const shape = createShape({
      id: `cand_${i}_${shapeSeed.toString(36).slice(2, 10)}`,
      type,
      params,
      color0: color0.map(Math.round),
      color1: color1.map(Math.round),
      alpha,
      style: s.style,
      layer: 0,
      order: i,
      seed: shapeSeed,
    });

    candidates.push(shape);

    if (candidates.length >= targetCount) break;
  }

  return candidates;
}

/**
 * Pick a weighted random key from a bias map.
 * @param {object} bias - { E: 0.1, B: 0.15, ... }
 * @param {object} random - RNG instance.
 * @returns {string}
 */
function weightedPick(bias, random) {
  const entries = Object.entries(bias);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  const r = random.next() * total;
  let acc = 0;
  for (const [k, w] of entries) {
    acc += w;
    if (r <= acc) return k;
  }
  return entries[entries.length - 1][0];
}

/**
 * Sample a position biased toward edge pixels.
 * @param {Float32Array} edges
 * @param {number} width
 * @param {number} height
 * @param {object} random - RNG
 * @param {number} detailLevel
 * @returns {[number, number]}
 */
function sampleEdgePixel(edges, width, height, random, detailLevel) {
  // Random sampling with rejection (edge-weighted)
  for (let attempt = 0; attempt < 50; attempt++) {
    const x = random.range(0, width - 1);
    const y = random.range(0, height - 1);
    const e = sampleEdge(edges, width, height, x, y);
    if (e > detailLevel * 0.3) {
      return [x, y];
    }
  }
  // Fallback to uniform
  return [random.range(0, width - 1), random.range(0, height - 1)];
}

/**
 * Sample a position along a spiral from center outward.
 * @param {number} width
 * @param {number} height
 * @param {number} frac - 0..1 position in the spiral.
 * @returns {[number, number]}
 */
function sampleSpiral(width, height, frac) {
  const cx = width / 2;
  const cy = height / 2;
  const maxR = Math.max(width, height) * 0.45;
  const r = frac * maxR;
  const angle = frac * Math.PI * 2 * 4; // 2 full rotations
  return [
    cx + r * Math.cos(angle),
    cy + r * Math.sin(angle),
  ];
}

/**
 * Generate shape-specific parameters.
 *
 * @param {string} type - E | B | T | R | S
 * @param {number} x
 * @param {number} y
 * @param {number} size
 * @param {object} random - RNG instance
 * @param {object} settings - Resolved settings
 * @returns {Array<number>} 8-element params array.
 */
function generateParams(type, x, y, size, random, settings) {
  const w = size;
  const h = size * random.range(0.6, 1.4);
  const rot = random.range(0, Math.PI * 2);
  const gradAngle = random.range(0, Math.PI * 2);

  switch (type) {
    case 'E': // Ellipse: [x, y, rx, ry, rot, gradAngle, 0, 0]
      return [x, y, w / 2, h / 2, rot, gradAngle, 0, 0];

    case 'B': // Blob: [x, y, rx, ry, rot, feather, 0, 0]
      return [x, y, w / 2, h / 2, rot, random.range(0.3, 0.7), 0, 0];

    case 'T': { // Triangle: [x1,y1, x2,y2, x3,y3, gradAngle, 0]
      const r = w / 2;
      const a1 = random.range(0, Math.PI * 2);
      const a2 = a1 + (2 * Math.PI) / 3;
      const a3 = a2 + (2 * Math.PI) / 3;
      const p1 = [x + r * Math.cos(a1), y + r * Math.sin(a1)];
      const p2 = [x + r * Math.cos(a2), y + r * Math.sin(a2)];
      const p3 = [x + r * Math.cos(a3), y + r * Math.sin(a3)];
      return [p1[0], p1[1], p2[0], p2[1], p3[0], p3[1], gradAngle, 0];
    }

    case 'R': // Bar: [x, y, w, h, rot, gradAngle, 0, 0]
      return [x, y, w, h, rot, gradAngle, 0, 0];

    case 'S': { // Stroke: [x0,y0, x1,y1, x2,y2, w, gradAngle]
      const len = w * random.range(1, 3);
      const angle = random.range(0, Math.PI * 2);
      const dx = Math.cos(angle) * len;
      const dy = Math.sin(angle) * len;
      const cx = x + random.range(-w, w);
      const cy = y + random.range(-w, w);
      // Control point for quadratic bezier
      const ctrlX = cx + dx / 2 + random.range(-w, w);
      const ctrlY = cy + dy / 2 + random.range(-w, w);
      return [cx, cy, ctrlX, ctrlY, cx + dx, cy + dy, Math.max(1, w * random.range(0.3, 0.8)), gradAngle];
    }

    default:
      return [x, y, w, h, rot, gradAngle, 0, 0];
  }
}

/**
 * Estimate the number of shapes based on image size and style.
 * Mirrors Code Painter's autoShapes formula.
 *
 * @param {number} width
 * @param {number} height
 * @param {string} style
 * @param {object} [opts]
 * @param {number} [opts.sizeFactor] - Scale factor (larger = more detail).
 * @returns {number}
 */
export function estimateShapeCount(width, height, style, opts = {}) {
  const { sizeFactor = 1 } = opts;
  // Size factor: smaller images need proportionally fewer strokes
  const diagonal = Math.sqrt(width * width + height * height);
  const k = diagonal / 500;

  // Style factor: thin styles (pencil, charcoal) get more strokes
  const thinStyles = ['pencil', 'charcoal', 'pastel', 'marker', 'hatch', 'stitch'];
  const sf = thinStyles.includes(style) ? 2.4 : 1.0;

  const raw = 1000 * k * sf * sizeFactor;
  return clamp(Math.round(raw / 50) * 50, 150, 20000);
}

/**
 * Apply progressive ordering to a list of shapes based on settings.pathOrder.
 * @param {Array<object>} shapes
 * @param {object} settings
 * @returns {Array<object>}
 */
export function orderShapes(shapes, settings) {
  const s = resolveSettings(settings);
  const out = shapes.map(sh => ({ ...sh }));

  switch (s.pathOrder) {
    case 'free':
      // Randomize
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      break;
    case 'top-bottom':
      out.sort((a, b) => {
        const ca = centroid(a);
        const cb = centroid(b);
        return ca[1] - cb[1] || ca[0] - cb[0];
      });
      break;
    case 'spiral':
      out.sort((a, b) => {
        const ca = centroid(a);
        const cb = centroid(b);
        const ra = Math.atan2(ca[1], ca[0]);
        const rb = Math.atan2(cb[1], cb[0]);
        return ra - rb;
      });
      break;
    case 'one-line':
      // Sort left-to-right, then top-to-bottom (continuous stroke feel)
      out.sort((a, b) => {
        const ca = centroid(a);
        const cb = centroid(b);
        return ca[1] - cb[1] || ca[0] - cb[0];
      });
      break;
    case 'edges-first':
      // Sort by descending score (if available) so high-edge shapes paint first
      out.sort((a, b) => (b.score || 0) - (a.score || 0));
      break;
  }

  // Reassign order field
  out.forEach((sh, i) => { sh.order = i; });

  return out;
}

export default {
  DEFAULT_SETTINGS,
  resolveSettings,
  generateCandidates,
  estimateShapeCount,
  orderShapes,
};
