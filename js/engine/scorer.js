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

import { colorDistance } from '../utils/color.js';
import { area, centroid, bounds } from './shapes.js';
import { sampleRegion } from './analyzer.js';

/**
 * Compute a composite score for a candidate shape against image data.
 *
 * @param {object} shape - Shape object (has params, color0, color1, type).
 * @param {object} analysis - AnalysisResult from analyzeImage.
 * @param {object} [opts]
 * @param {number} [opts.colorWeight=0.5] - Weight for color matching.
 * @param {number} [opts.edgeWeight=0.3]   - Weight for edge alignment.
 * @param {number} [opts.coverageWeight=0.2] - Weight for region coverage.
 * @param {number} [opts.edgeBonus=1.5]    - Multiplier when shape aligns with strong edges.
 * @returns {number} Score in [0, 1].
 */
export function scoreShape(shape, analysis, opts = {}) {
  const {
    colorWeight = 0.5,
    edgeWeight = 0.3,
    coverageWeight = 0.2,
    edgeBonus = 1.5,
  } = opts;

  const { pixels, width, height, luminance: lumMap, edges } = analysis;
  const [bx0, by0, bx1, by1] = bounds(shape);

  // Clamp bounds to image dimensions
  const x0 = Math.max(0, Math.floor(bx0));
  const y0 = Math.max(0, Math.floor(by0));
  const x1 = Math.min(width - 1, Math.ceil(bx1));
  const y1 = Math.min(height - 1, Math.ceil(by1));

  if (x1 <= x0 || y1 <= y0) return 0;

  // 1. Color score: average color distance between shape colors and region
  const regionAvg = sampleRegion(pixels, width, height, x0, y0, x1, y1);
  const c0Dist = colorDistance(shape.color0, regionAvg);
  const c1Dist = colorDistance(shape.color1, regionAvg);
  const avgDist = (c0Dist + c1Dist) / 2;
  const maxDist = 441.6; // sqrt(255^2 * 3)
  const colorScore = 1 - Math.min(1, avgDist / maxDist);

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
  // Prefer shapes that cover high-edge regions
  const edgeScore = avgEdge;

  // 3. Coverage score: ratio of shape area to bounding box area
  const shapeArea = area(shape);
  const boxArea = (x1 - x0) * (y1 - y0);
  const coverageScore = boxArea > 0 ? shapeArea / boxArea : 0;

  // Combine
  let score = colorWeight * colorScore + edgeWeight * edgeScore + coverageWeight * coverageScore;

  // Bonus for aligning with strong edges
  if (edgeMax > 0.3) {
    score *= edgeBonus;
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
  scoreShape,
  selectBest,
  selectGreedyResidual,
  computeImportanceMap,
  sampleImportance,
};
