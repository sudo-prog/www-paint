/**
 * Outline extraction — Round 2 / M7, frozen interface **IF-3**.
 *
 * Edge-following outline extraction so the optimiser can lay outline strokes
 * first (Track R4, "outlines"). Given an `analyzeImage()` result, walk the
 * Sobel edge field along connected high-gradient paths and return the longest
 * open polylines, largest first.
 *
 * Clean-room derivation of the classical **edge-following / boundary tracing**
 * step of stroke-based rendering: threshold the gradient magnitude, then walk
 * from each unvisited edge pixel to its strongest edge neighbour, advancing
 * along the ridge of the gradient. No identifier, table or control flow is
 * taken from any implementation.
 *
 * Pure typed-array work — no canvas, no DOM, no randomness — so it is
 * unit-testable under plain `node` and safe to call from a worker.
 *
 * @module outlines
 */

/** Default options for {@link extractOutlines}. */
export const OUTLINE_DEFAULTS = {
  threshold: 0.3,   // edge magnitude (normalised 0..1) above which a pixel is an edge
  minLength: 12,    // drop walks shorter than this many points
  maxOutlines: 64,  // safety cap on the returned list
  maxSteps: 4096,   // safety cap on a single walk (prevents a spiral runaway)
  minStrength: 0.4, // drop walks whose mean edge magnitude is below this
};

/** 8-connected neighbour offsets, clockwise from north. */
const NEIGHBOURS = [
  [0, -1], [1, -1], [1, 0], [1, 1],
  [0, 1], [-1, 1], [-1, 0], [-1, -1],
];

/** Opposite-direction index: stepping `k` forbids stepping `(k + 4) % 8` next. */
const opposite = (k) => (k + 4) % 8;

/**
 * Boolean edge mask plus the retained magnitudes.
 *
 * The walk needs the *magnitudes*, not just a binary mask: a binary mask makes
 * every thresholded pixel equal, so the walk cannot tell a contour ridge from
 * an isolated noise pixel.
 *
 * @returns {{mask: Uint8Array, mag: Float32Array, edgeCount: number}}
 */
function buildEdgeMask(analysis, threshold) {
  const { width: w, height: h, edges } = analysis;
  const n = w * h;
  const mask = new Uint8Array(n);
  const mag = new Float32Array(n);
  let edgeCount = 0;
  for (let i = 0; i < n; i++) {
    if (edges[i] >= threshold) {
      mask[i] = 1;
      mag[i] = edges[i];
      edgeCount++;
    }
  }
  return { mask, mag, edgeCount };
}

/**
 * Best next step from `(x, y)`: the unvisited edge neighbour with the highest
 * edge magnitude, excluding the direction the walk arrived from.
 *
 * @returns {[number, number, number]|null} `[nx, ny, dirIndex]` or `null`.
 */
function pickNext(mask, mag, width, height, x, y, prevDir, visited) {
  let best = null;
  let bestMag = -1;

  for (let k = 0; k < NEIGHBOURS.length; k++) {
    if (k === prevDir) continue; // never step straight back
    const nx = x + NEIGHBOURS[k][0];
    const ny = y + NEIGHBOURS[k][1];
    if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
    const j = ny * width + nx;
    if (!mask[j] || visited.has(j)) continue;

    if (mag[j] > bestMag) {
      bestMag = mag[j];
      best = [nx, ny, k];
    }
  }

  return best;
}

/**
 * Strongest edge neighbour of `(x, y)` regardless of direction.
 *
 * Used to decide whether a pixel is worth seeding a walk from: a genuine
 * contour pixel sits on a ridge and has a strong edge neighbour, while an
 * isolated noise pixel does not.
 *
 * @returns {[number, number, number]|null} `[nx, ny, magnitude]` or `null`.
 */
function strongestNeighbour(mask, mag, width, height, x, y) {
  let best = null;
  let bestMag = -1;
  for (let k = 0; k < NEIGHBOURS.length; k++) {
    const nx = x + NEIGHBOURS[k][0];
    const ny = y + NEIGHBOURS[k][1];
    if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
    const j = ny * width + nx;
    if (!mask[j]) continue;
    if (mag[j] > bestMag) {
      bestMag = mag[j];
      best = [nx, ny, mag[j]];
    }
  }
  return best;
}

/**
 * Walk one outline starting at `(sx, sy)`.
 *
 * The walk uses its **own** visited set, not the shared one. If it shared, a
 * pixel claimed by an earlier walk would terminate the next walk at its first
 * step — which silently truncates a closed contour into a handful of fragments
 * (observed: a square's left edge went completely untraced). The caller unions
 * the private set into the shared one afterwards, so no pixel is walked twice
 * across *different* walks while a single walk is free to close its loop.
 *
 * @returns {{points: number[][], strength: number, visited: Set<number>}}
 */
function walkOutline(mask, mag, width, height, sx, sy, maxSteps) {
  const points = [[sx, sy]];
  const visited = new Set([sy * width + sx]);

  let x = sx;
  let y = sy;
  let prevDir = -1; // no arrival direction at the seed
  let sumMag = mag[sy * width + sx];
  let steps = 0;

  while (steps < maxSteps) {
    const next = pickNext(mask, mag, width, height, x, y, prevDir, visited);
    if (!next) break;
    const [nx, ny, dir] = next;

    visited.add(ny * width + nx);
    points.push([nx, ny]);
    sumMag += mag[ny * width + nx];
    prevDir = opposite(dir);
    x = nx;
    y = ny;
    steps++;
  }

  const strength = points.length > 0 ? sumMag / points.length : 0;
  return { points, strength, visited };
}

/**
 * Extract outlines from an analysed image.
 *
 * Returns the frozen IF-3 shape:
 * ```
 * {
 *   width, height,
 *   outlines: Array<{ points: Array<[x, y]>, strength: number }>  // open polylines, largest first
 * }
 * ```
 *
 * @param {object} analysis - Result of `analyzer.analyzeImage` (needs `edges`,
 *   `width`, `height`).
 * @param {object} [options] - See {@link OUTLINE_DEFAULTS}.
 * @returns {{width: number, height: number, outlines: Array<object>}}
 */
export function extractOutlines(analysis, options = {}) {
  const o = { ...OUTLINE_DEFAULTS, ...options };
  const width = analysis.width;
  const height = analysis.height;

  if (!analysis.edges || width <= 0 || height <= 0) {
    return { width, height, outlines: [] };
  }

  const { mask, mag, edgeCount } = buildEdgeMask(analysis, o.threshold);
  if (edgeCount === 0) return { width, height, outlines: [] };

  const visited = new Set();
  const outlines = [];
  const maxSteps = Math.max(1, o.maxSteps | 0);

  // A pixel seeds a walk only if it sits on a ridge — its strongest edge
  // neighbour is at least as strong as it is. This is what separates a real
  // contour (a chain of mutually-strong neighbours) from noise speckle.
  const isSeed = new Uint8Array(width * height);
  for (let sy = 0; sy < height; sy++) {
    for (let sx = 0; sx < width; sx++) {
      const i = sy * width + sx;
      if (!mask[i]) continue;
      const nb = strongestNeighbour(mask, mag, width, height, sx, sy);
      if (nb && nb[2] >= mag[i]) isSeed[i] = 1;
    }
  }

  // Row-major seed order is fixed, so the result is deterministic.
  for (let sy = 0; sy < height; sy++) {
    for (let sx = 0; sx < width; sx++) {
      const i = sy * width + sx;
      if (!isSeed[i] || visited.has(i)) continue;

      const walk = walkOutline(mask, mag, width, height, sx, sy, maxSteps);
      // Claim this walk's pixels only after it finishes, so the walk itself is
      // free to close its loop; a later walk then cannot re-trace the same
      // contour from a different seed.
      for (const j of walk.visited) visited.add(j);
      if (walk.points.length >= o.minLength && walk.strength >= o.minStrength) {
        outlines.push({ points: walk.points, strength: walk.strength });
      }
    }
  }

  // A closed contour walked from several seeds yields near-duplicate polylines.
  // Drop any outline whose point set is already covered by a longer one.
  const kept = [];
  for (const o of outlines) {
    const mine = new Set(o.points.map(p => p[1] * width + p[0]));
    const dup = kept.some(k => {
      const theirs = k._set || (k._set = new Set(k.points.map(p => p[1] * width + p[0])));
      let shared = 0;
      for (const j of mine) if (theirs.has(j)) shared++;
      // Same contour if at least 80% of this outline's pixels are already kept.
      return mine.size > 0 && shared / mine.size >= 0.8;
    });
    if (!dup) kept.push(o);
  }
  for (const k of kept) delete k._set;

  // Largest first; ties broken by first point for a stable, reproducible order.
  kept.sort((a, b) => {
    if (b.points.length !== a.points.length) return b.points.length - a.points.length;
    const pa = a.points[0];
    const pb = b.points[0];
    return (pa[1] - pb[1]) || (pa[0] - pb[0]);
  });

  const capped = o.maxOutlines > 0 ? kept.slice(0, o.maxOutlines) : kept;
  return { width, height, outlines: capped };
}

export default { extractOutlines, OUTLINE_DEFAULTS };
