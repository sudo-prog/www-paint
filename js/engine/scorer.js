/**
 * Candidate scoring and selection.
 *
 * The Scorer compares a candidate shape against the source image (via the
 * AnalysisResult) and produces a score that reflects how well that shape
 * "captures" the image data — color fidelity, edge alignment, and coverage.
 * The Generator proposes candidates; the Scorer decides which survive.
 *
 * @module scorer
 */

import { colorDistance, colorDistanceLab, rgbToLab } from '../utils/color.js';
import { area, centroid, bounds, pointAt } from './shapes.js';
import { sampleRegion, sampleEdge, sampleLuminance } from './analyzer.js';

// ─── Residual Map ─────────────────────────────────────────────────────────

/**
 * Per-pixel error map that tracks the difference between the target image
 * and the current canvas state.  After each stroke is "applied" the residual
 * is updated so subsequent candidates are scored against what *remains* to be
 * painted, not the original image.
 *
 * The map stores an error magnitude in [0, 255] per pixel.  Initially it is
 * zero (nothing painted yet) — `initialise()` seeds it from the source.
 *
 * @class ResidualMap
 */
export class ResidualMap {
  /**
   * @param {number} width
   * @param {number} height
   */
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.n = width * height;
    /** @type {Float32Array} Per-pixel error magnitude [0, 255]. */
    this.error = new Float32Array(this.n);
    /** @type {Float32Array} Per-pixel "paint coverage" [0, 1] (how much paint has been applied). */
    this.coverage = new Float32Array(this.n);
    this._maxError = 255;
  }

  /**
   * Seed the residual from source pixel data so the initial error equals
   * the difference between the (empty) canvas and the target.
   *
   * @param {Uint8ClampedArray} pixels - RGBA source data.
   * @param {number} width
   * @param {number} height
   */
  initialise(pixels, width, height) {
    const n = width * height;
    for (let i = 0; i < n; i++) {
      const idx = i * 4;
      // Error = luminance of source (canvas starts blank / background)
      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];
      this.error[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }
    this._maxError = this._computeMaxError();
  }

  /**
   * Recompute the maximum error value (for normalisation).
   * @private
   */
  _computeMaxError() {
    let max = 0;
    for (let i = 0; i < this.n; i++) {
      if (this.error[i] > max) max = this.error[i];
    }
    return max > 0 ? max : 1;
  }

  /**
   * Bilinear sample of the normalised error [0, 1] at (x, y).
   *
   * @param {number} x
   * @param {number} y
   * @returns {number} Normalised error 0..1.
   */
  sampleError(x, y) {
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(this.width - 1, x0 + 1);
    const y1 = Math.min(this.height - 1, y0 + 1);
    const fx = x - x0;
    const fy = y - y0;
    const a = this.error[y0 * this.width + x0];
    const b = this.error[y0 * this.width + x1];
    const c = this.error[y1 * this.width + x0];
    const d = this.error[y1 * this.width + x1];
    const val = a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy;
    return val / this._maxError;
  }

  /**
   * Bilinear sample of the paint coverage [0, 1] at (x, y).
   *
   * @param {number} x
   * @param {number} y
   * @returns {number} Coverage 0..1.
   */
  sampleCoverage(x, y) {
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(this.width - 1, x0 + 1);
    const y1 = Math.min(this.height - 1, y0 + 1);
    const fx = x - x0;
    const fy = y - y0;
    const a = this.coverage[y0 * this.width + x0];
    const b = this.coverage[y0 * this.width + x1];
    const c = this.coverage[y1 * this.width + x0];
    const d = this.coverage[y1 * this.width + x1];
    return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy;
  }

  /**
   * Average normalised error over a rectangular region (sampled at step).
   *
   * @param {number} x0
   * @param {number} y0
   * @param {number} x1
   * @param {number} y1
   * @param {number} [step=2]
   * @returns {number} Average error 0..1.
   */
  averageError(x0, y0, x1, y1, step = 2) {
    let sum = 0;
    let count = 0;
    for (let y = y0; y <= y1; y += step) {
      for (let x = x0; x <= x1; x += step) {
        const i = y * this.width + x;
        if (i < this.n) {
          sum += this.error[i];
          count++;
        }
      }
    }
    return count > 0 ? (sum / count) / this._maxError : 0;
  }

  /**
   * Average coverage over a rectangular region.
   *
   * @param {number} x0
   * @param {number} y0
   * @param {number} x1
   * @param {number} y1
   * @param {number} [step=2]
   * @returns {number} Average coverage 0..1.
   */
  averageCoverage(x0, y0, x1, y1, step = 2) {
    let sum = 0;
    let count = 0;
    for (let y = y0; y <= y1; y += step) {
      for (let x = x0; x <= x1; x += step) {
        const i = y * this.width + x;
        if (i < this.n) {
          sum += this.coverage[i];
          count++;
        }
      }
    }
    return count > 0 ? sum / count : 0;
  }

  /**
   * Mark a pixel region as partially painted, reducing the local error.
   *
   * The reduction factor controls how much error is removed per application.
   * Higher coverage → more error removed.
   *
   * @param {number} x0  Bounding box of the stroke footprint.
   * @param {number} y0
   * @param {number} x1
   * @param {number} y1
   * @param {number} [coverage=0.5] - How much this stroke covers [0, 1].
   * @param {number} [falloff=0.3] - Feather fraction for edge falloff.
   */
  applyStroke(x0, y0, x1, y1, coverage = 0.5, falloff = 0.3) {
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const hw = (x1 - x0) / 2;
    const hh = (y1 - y0) / 2;
    const falloffX = Math.max(1, hw * falloff);
    const falloffY = Math.max(1, hh * falloff);

    for (let y = Math.max(0, y0); y <= Math.min(this.height - 1, y1); y++) {
      for (let x = Math.max(0, x0); x <= Math.min(this.width - 1, x1); x++) {
        const i = y * this.width + x;
        // Distance-based falloff from center
        const dx = x - cx;
        const dy = y - cy;
        const nx = Math.abs(dx) / (hw + falloffX);
        const ny = Math.abs(dy) / (hh + falloffY);
        const distFactor = Math.max(0, 1 - Math.max(nx, ny));
        const effectiveCoverage = coverage * distFactor;
        // Increase coverage, reduce error
        this.coverage[i] = Math.min(1, this.coverage[i] + effectiveCoverage);
        this.error[i] = Math.max(0, this.error[i] * (1 - effectiveCoverage));
      }
    }
    this._maxError = this._computeMaxError();
  }

  /**
   * Reset the residual to its initial state (all error = source, no coverage).
   */
  reset() {
    this.error.fill(0);
    this.coverage.fill(0);
    this._maxError = 255;
  }
}

// ─── Scoring ────────────────────────────────────────────────────────────────

/**
 * Compute a composite score for a candidate shape against image data.
 *
 * When a {@link ResidualMap} is supplied (opts.residual) the score is
 * computed against the *residual* error rather than the original image.
 * High-error regions are prioritised and already-covered areas penalised.
 *
 * @param {object} shape - Shape object (has params, color0, color1, type).
 * @param {object} analysis - AnalysisResult from analyzeImage.
 * @param {object} [opts]
 * @param {number} [opts.colorWeight=0.5] - Weight for color matching.
 * @param {number} [opts.edgeWeight=0.3]   - Weight for edge alignment.
 * @param {number} [opts.coverageWeight=0.2] - Weight for region coverage.
 * @param {number} [opts.edgeBonus=1.5]    - Multiplier when shape aligns with strong edges.
 * @param {ResidualMap} [opts.residual] - Optional residual map for adaptive scoring.
 * @param {number} [opts.residualWeight=0.4] - How much to bias toward high-residual regions.
 * @returns {number} Score in [0, 1].
 */
export function scoreShape(shape, analysis, opts = {}) {
  const {
    colorWeight = 0.5,
    edgeWeight = 0.3,
    coverageWeight = 0.2,
    edgeBonus = 1.5,
    residual,
    residualWeight = 0.4,
  } = opts;

  const { pixels, width, height, luminance: lumMap, edges } = analysis;
  const [bx0, by0, bx1, by1] = bounds(shape);

  // Clamp bounds to image dimensions
  const x0 = Math.max(0, Math.floor(bx0));
  const y0 = Math.max(0, Math.floor(by0));
  const x1 = Math.min(width - 1, Math.ceil(bx1));
  const y1 = Math.min(height - 1, Math.ceil(by1));

  if (x1 <= x0 || y1 <= y0) return 0;

  // 1. Color score: using CIELAB for perceptual accuracy
  const regionAvg = sampleRegion(pixels, width, height, x0, y0, x1, y1);
  const regionLab = rgbToLab(regionAvg);
  const c0Lab = rgbToLab(shape.color0);
  const c1Lab = rgbToLab(shape.color1);
  const c0Dist = colorDistanceLab(regionLab, c0Lab);
  const c1Dist = colorDistanceLab(regionLab, c1Lab);
  const avgLabDist = (c0Dist + c1Dist) / 2;
  const maxLabDist = 100; // Typical max ΔE
  const colorScore = 1 - Math.min(1, avgLabDist / maxLabDist);

  // 2. Edge alignment score
  let edgeSum = 0;
  let edgeMax = 0;
  let count = 0;
  for (let y = y0; y <= y1; y += 2) {
    for (let x = x0; x <= x1; x += 2) {
      const idx = y * width + x;
      const e = edges[idx] || 0;
      edgeSum += e;
      if (e > edgeMax) edgeMax = e;
      count++;
    }
  }
  const avgEdge = count > 0 ? edgeSum / count : 0;
  const edgeScore = avgEdge;

  // 3. Coverage score: ratio of shape area to bounding box area
  const shapeArea = area(shape);
  const boxArea = (x1 - x0) * (y1 - y0);
  const coverageScore = boxArea > 0 ? shapeArea / boxArea : 0;

  // Base score
  let score = colorWeight * colorScore + edgeWeight * edgeScore + coverageWeight * coverageScore;

  // Bonus for aligning with strong edges
  if (edgeMax > 0.3) {
    score *= edgeBonus;
  }

  // 4. Residual-based scoring (if residual map provided)
  if (residual) {
    const avgError = residual.averageError(x0, y0, x1, y1, 2);
    const avgCoverage = residual.averageCoverage(x0, y0, x1, y1, 2);
    // Reward high-error regions, penalise already-covered regions
    const residualBias = avgError * (1 - avgCoverage);
    score = score * (1 - residualWeight) + residualBias * residualWeight;
  }

  return Math.max(0, Math.min(1, score));
}

/**
 * Score and select the best N candidates from a list.
 *
 * @param {Array<object>} candidates - Shape objects.
 * @param {object} analysis - AnalysisResult.
 * @param {number} count - Number of shapes to select.
 * @param {object} [opts] - Scoring options (see scoreShape).
 * @returns {Array<object>} Selected shapes (sorted by score descending).
 */
export function selectBest(candidates, analysis, count, opts = {}) {
  const scored = candidates.map(s => ({ shape: s, score: scoreShape(s, analysis, opts) }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, count).map(s => ({ ...s.shape, score: s.score }));
}

/**
 * Select candidates using a greedy residual approach: select the best,
 * "subtract" its contribution from the image, then pick the next best.
 *
 * This is more expensive but produces better coverage for fixed stroke counts.
 *
 * @param {Array<object>} candidates
 * @param {object} analysis
 * @param {number} count
 * @param {object} [opts]
 * @param {number} [opts.subtractive=0.5] - How much a selected shape reduces nearby candidates' scores.
 * @returns {Array<object>} Selected shapes with scores.
 */
export function selectGreedyResidual(candidates, analysis, count, opts = {}) {
  const { subtractive = 0.5, ...scoreOpts } = opts;
  const result = [];
  const selected = [];
  const remaining = [...candidates];

  for (let i = 0; i < count && remaining.length > 0; i++) {
    // Score all remaining
    const scored = remaining.map(s => ({
      shape: s,
      score: scoreShape(s, analysis, scoreOpts),
    }));

    // Apply subtraction penalties from already-selected shapes
    for (const sel of selected) {
      const selCentroid = centroid(sel.shape);
      const selArea = area(sel.shape);
      scored.forEach(s => {
        const [cx, cy] = centroid(s.shape);
        const dist = Math.hypot(cx - selCentroid[0], cy - selCentroid[1]);
        const penalty = subtractive * Math.exp(-dist / (Math.sqrt(selArea) + 10));
        s.score *= (1 - penalty);
      });
    }

    scored.sort((a, b) => b.score - a.score);
    const winner = scored[0];
    result.push({ ...winner.shape, score: winner.score });
    selected.push(winner);
    remaining.splice(remaining.indexOf(winner.shape), 1);
  }

  return result;
}

/**
 * Select candidates using a true residual map.  After each selection the
 * residual is updated by applying the stroke's effect, so subsequent
 * candidates are scored against what remains unpainted.
 *
 * This produces the best coverage for a fixed stroke budget but is
 * O(n × k) where n is candidate count and k is the selection count.
 *
 * @param {Array<object>} candidates
 * @param {object} analysis - AnalysisResult.
 * @param {number} count - Number of shapes to select.
 * @param {object} [opts]
 * @param {number} [opts.residualWeight=0.6] - Weight for residual bias.
 * @param {number} [opts.minResidual=0.02] - Minimum error to still be worth painting.
 * @returns {Array<object>} Selected shapes with scores.
 */
export function selectWithResidual(candidates, analysis, count, opts = {}) {
  const {
    residualWeight = 0.6,
    minResidual = 0.02,
  } = opts;

  const { width, height, pixels } = analysis;
  const residual = new ResidualMap(width, height);
  residual.initialise(pixels, width, height);

  const result = [];
  const remaining = [...candidates];

  for (let i = 0; i < count && remaining.length > 0; i++) {
    // Score all remaining against residual
    const scored = remaining.map(s => ({
      shape: s,
      score: scoreShape(s, analysis, { residual, residualWeight, minResidual }),
    }));

    // Skip if no region has enough residual error
    const maxScore = Math.max(...scored.map(s => s.score));
    if (maxScore < minResidual) break;

    scored.sort((a, b) => b.score - a.score);
    const winner = scored[0];
    result.push({ ...winner.shape, score: winner.score });
    remaining.splice(remaining.indexOf(winner.shape), 1);

    // Update residual: apply the winning stroke
    const [bx0, by0, bx1, by1] = bounds(winner.shape);
    const x0 = Math.max(0, Math.floor(bx0));
    const y0 = Math.max(0, Math.floor(by0));
    const x1 = Math.min(width - 1, Math.ceil(bx1));
    const y1 = Math.min(height - 1, Math.ceil(by1));
    const strokeArea = Math.max(1, area(winner.shape));
    // Estimate coverage: stroke area / bbox area, clamped
    const boxArea = Math.max(1, (x1 - x0) * (y1 - y0));
    const coverage = Math.min(1, strokeArea / boxArea);
    residual.applyStroke(x0, y0, x1, y1, coverage, 0.3);
  }

  return result;
}

/**
 * Compute a spatial importance map: regions of high color/luminance variance
 * are more important to capture.
 *
 * @param {Uint8ClampedArray} pixels - RGBA data.
 * @param {number} width
 * @param {number} height
 * @param {number} blockSize - Block size for variance grid.
 * @returns {Float32Array} Importance per block, [0, 1].
 */
export function computeImportanceMap(pixels, width, height, blockSize = 8) {
  const blocksX = Math.ceil(width / blockSize);
  const blocksY = Math.ceil(height / blockSize);
  const map = new Float32Array(blocksX * blocksY);

  for (let by = 0; by < blocksY; by++) {
    for (let bx = 0; bx < blocksX; bx++) {
      let sum = 0;
      let sumSq = 0;
      let count = 0;
      const x0 = bx * blockSize;
      const y0 = by * blockSize;
      const x1 = Math.min(x0 + blockSize, width);
      const y1 = Math.min(y0 + blockSize, height);

      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * width + x) * 4;
          const l = 0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2];
          sum += l;
          sumSq += l * l;
          count++;
        }
      }

      const mean = sum / count;
      const variance = (sumSq / count) - (mean * mean);
      map[by * blocksX + bx] = Math.min(1, variance / 1000); // normalize
    }
  }

  return map;
}

/**
 * Get the importance value at a pixel coordinate.
 *
 * @param {Float32Array} map - Importance from computeImportanceMap.
 * @param {number} width
 * @param {number} height
 * @param {number} blockSize
 * @param {number} x
 * @param {number} y
 * @returns {number}
 */
export function sampleImportance(map, width, height, blockSize, x, y) {
  const bx = Math.floor(x / blockSize);
  const by = Math.floor(y / blockSize);
  const blocksX = Math.ceil(width / blockSize);
  return map[Math.min(map.length - 1, by * blocksX + bx)] || 0;
}

export default {
  ResidualMap,
  scoreShape,
  selectBest,
  selectGreedyResidual,
  selectWithResidual,
  computeImportanceMap,
  sampleImportance,
};
