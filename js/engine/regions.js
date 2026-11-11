/**
 * Connected-component regions + principal-axis analysis — Track R3.
 *
 * A clean-room, independently-derived implementation of the classical
 * **CCL + PCA** stroke-initialisation step in stroke-based rendering: quantise
 * the target image into a small colour codebook, label its connected components
 * (connected-component labelling), and fit each component's principal axis
 * (principal-component analysis of the component's pixel coordinates) so a
 * stroke can be initialised with the *orientation*, *size* and *colour* of the
 * region it belongs to. Re-derived from the published technique; no identifier,
 * table or control flow is taken from any implementation.
 *
 * Everything here runs on plain pixel buffers (no canvas, no DOM), uses no
 * randomness, and is deterministic — so it is unit-testable under plain `node`
 * and safe to call from a worker.
 *
 * Region fields returned by {@link buildRegions}:
 * - `area`  — component size in pixels
 * - `cx,cy` — centroid
 * - `l1,l2` — principal / secondary eigenvalues of the coordinate covariance
 * - `angle` — major-axis orientation in radians
 * - `elong` — sqrt(l1 / l2); 1 = isotropic, > 1 = elongated
 * - `fill`  — area / bounding-box area; ~1 = convex/filled, low = ring-like
 * - `color` — component mean RGB
 * - `bbox`  — `[minX, minY, maxX, maxY]`
 *
 * @module regions
 */

/**
 * Default options for {@link buildRegions}.
 * @type {object}
 */
export const REGION_DEFAULTS = {
  levels: 6,          // quantization levels per RGB channel (levels^3 colour bins)
  connectivity: 8,    // 4- or 8-neighbour connected-component labelling
  minArea: 10,        // ignore components smaller than this many pixels
  maxAreaFrac: 0.30,  // ignore components larger than this fraction of the image
  maxRegions: 4096,   // safety cap on the region list length
};

/**
 * Quantise RGB pixels into an integer colour-bin id per pixel.
 *
 * The image is split into `levels³` uniform-colour bins (levels per channel).
 * A coarse codebook (default 6³ = 216 bins) groups near-identical colours so
 * that CCL segments the image into flat fields rather than one component per
 * pixel. Deterministic and dependency-free.
 *
 * @param {Uint8ClampedArray} pixels - RGBA buffer (length w·h·4).
 * @param {number} w
 * @param {number} h
 * @param {number} [levels=6] - Bins per channel (clamped to >= 2).
 * @returns {Int32Array} Bin id per pixel (length w·h).
 */
export function quantizeBins(pixels, w, h, levels = 6) {
  const n = w * h;
  const L = Math.max(2, levels | 0);
  const step = 256 / L;
  const bins = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const qr = Math.min(L - 1, (pixels[o] / step) | 0);
    const qg = Math.min(L - 1, (pixels[o + 1] / step) | 0);
    const qb = Math.min(L - 1, (pixels[o + 2] / step) | 0);
    bins[i] = (qr * L + qg) * L + qb;
  }
  return bins;
}

/**
 * Two-pass connected-component labelling over an integer bin map.
 *
 * Pass 1 walks the image row-major and, for each pixel, unions it with any
 * already-labelled neighbour that shares the same bin id (a fixed neighbour
 * order keeps the labelling deterministic). Pass 2 flattens the union-find and
 * renumbers the labels 1..count while accumulating per-component moments
 * (count, Σx, Σy, Σx², Σxy, Σy², bounding box) so PCA and fill ratio need no
 * second scan.
 *
 * @param {Int32Array} bins - Bin id per pixel.
 * @param {number} w
 * @param {number} h
 * @param {number} [connectivity=8] - 4 or 8.
 * @returns {{labels: Int32Array, count: number, stats: Array<object>}}
 */
export function labelComponents(bins, w, h, connectivity = 8) {
  const n = w * h;
  const labels = new Int32Array(n);
  const parent = [0];
  const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  const union = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[Math.max(a, b)] = Math.min(a, b); };

  // Neighbour offsets for the "already visited" half of the window.
  const neigh = connectivity === 4
    ? [[-1, 0], [0, -1]]
    : [[-1, 0], [0, -1], [-1, -1], [1, -1]];

  let next = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const b = bins[i];
      let lab = 0;
      for (let k = 0; k < neigh.length; k++) {
        const nx = x + neigh[k][0];
        const ny = y + neigh[k][1];
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
        const j = ny * w + nx;
        if (labels[j] !== 0 && bins[j] === b) {
          const lj = find(labels[j]);
          if (lab === 0) lab = lj;
          else union(lab, lj);
        }
      }
      if (lab === 0) { lab = ++next; parent[lab] = lab; }
      labels[i] = lab;
    }
  }

  // Flatten + renumber, accumulating moments in one scan.
  const remap = new Int32Array(next + 1);
  const stats = [];
  for (let i = 0; i < n; i++) {
    const root = find(labels[i]);
    let id = remap[root];
    if (id === 0) {
      remap[root] = id = stats.length + 1;
      stats.push({
        area: 0, sumX: 0, sumY: 0, sumXX: 0, sumXY: 0, sumYY: 0,
        minX: w, minY: h, maxX: -1, maxY: -1,
      });
    }
    labels[i] = id;
    const s = stats[id - 1];
    const x = i % w;
    const y = (i - x) / w;
    s.area++;
    s.sumX += x; s.sumY += y;
    s.sumXX += x * x; s.sumXY += x * y; s.sumYY += y * y;
    if (x < s.minX) s.minX = x;
    if (x > s.maxX) s.maxX = x;
    if (y < s.minY) s.minY = y;
    if (y > s.maxY) s.maxY = y;
  }
  return { labels, count: stats.length, stats };
}

/**
 * Principal-axis fit of a component from its accumulated coordinate moments.
 *
 * The 2×2 coordinate covariance's eigen-decomposition gives the major-axis
 * angle (orientation) and the eigenvalue ratio (elongation). `l1 >= l2 >= 0`.
 *
 * @param {object} s - A `stats` entry from {@link labelComponents}.
 * @returns {{cx:number, cy:number, l1:number, l2:number, angle:number, elong:number}}
 */
export function pcaFromStats(s) {
  const a = Math.max(1, s.area);
  const mx = s.sumX / a;
  const my = s.sumY / a;
  const cxx = s.sumXX / a - mx * mx;
  const cyy = s.sumYY / a - my * my;
  const cxy = s.sumXY / a - mx * my;
  const tr = cxx + cyy;
  const det = cxx * cyy - cxy * cxy;
  const disc = Math.sqrt(Math.max(0, (tr * tr) / 4 - det));
  const l1 = Math.max(0, tr / 2 + disc);
  const l2 = Math.max(1e-6, tr / 2 - disc);
  const angle = 0.5 * Math.atan2(2 * cxy, cxx - cyy);
  const elong = Math.sqrt((l1 + 1e-6) / l2);
  return { cx: mx, cy: my, l1, l2, angle, elong };
}

/**
 * Build the significant regions of an analysed image.
 *
 * Quantise → label → PCA → filter. Components smaller than `minArea` or larger
 * than `maxAreaFrac·W·H` (the whole-canvas background) are dropped; the rest
 * carry enough geometry for stroke initialisation. Returned largest-first so a
 * caller can spend a fixed stroke budget on the most salient regions.
 *
 * @param {object} analysis - Result of `analyzer.analyzeImage` (needs `pixels`,
 *   `width`, `height`).
 * @param {object} [options] - See {@link REGION_DEFAULTS}.
 * @returns {Array<{id:number, area:number, cx:number, cy:number, l1:number,
 *   l2:number, angle:number, elong:number, fill:number,
 *   color:number[], bbox:number[]}>}
 */
export function buildRegions(analysis, options = {}) {
  const o = { ...REGION_DEFAULTS, ...options };
  const { width: w, height: h, pixels } = analysis;
  const n = w * h;
  const minArea = Math.max(1, o.minArea | 0);
  const maxArea = o.maxAreaFrac * n;

  const bins = quantizeBins(pixels, w, h, o.levels);
  const { labels, count, stats } = labelComponents(bins, w, h, o.connectivity);

  // Per-component colour sums (bins carry no colour).
  const sumR = new Float64Array(count + 1);
  const sumG = new Float64Array(count + 1);
  const sumB = new Float64Array(count + 1);
  for (let i = 0; i < n; i++) {
    const id = labels[i];
    const o4 = i * 4;
    sumR[id] += pixels[o4];
    sumG[id] += pixels[o4 + 1];
    sumB[id] += pixels[o4 + 2];
  }

  const regions = [];
  for (let id = 1; id <= count; id++) {
    const s = stats[id - 1];
    if (s.area < minArea || s.area > maxArea) continue;
    const p = pcaFromStats(s);
    const bw = s.maxX - s.minX + 1;
    const bh = s.maxY - s.minY + 1;
    regions.push({
      id,
      area: s.area,
      cx: p.cx,
      cy: p.cy,
      l1: p.l1,
      l2: p.l2,
      angle: p.angle,
      elong: p.elong,
      fill: s.area / Math.max(1, bw * bh),
      color: [sumR[id] / s.area, sumG[id] / s.area, sumB[id] / s.area],
      bbox: [s.minX, s.minY, s.maxX, s.maxY],
    });
  }
  regions.sort((a, b) => (b.area - a.area) || (a.id - b.id));
  return o.maxRegions > 0 ? regions.slice(0, o.maxRegions) : regions;
}

/**
 * Geometry of a fitted stroke for one region, in the engine's ellipse-dab
 * model. Returns the major/minor half-extents (derived from the eigenvalue
 * spreads, `extent = sqrt(12·λ)` for a uniform bar) and the axis orientation.
 *
 * @param {object} rg - A region from {@link buildRegions}.
 * @returns {{halfMajor:number, halfMinor:number, angle:number}}
 */
export function fitEllipse(rg) {
  return {
    halfMajor: 0.5 * Math.sqrt(12 * rg.l1),
    halfMinor: 0.5 * Math.sqrt(12 * rg.l2),
    angle: rg.angle,
  };
}

export default {
  REGION_DEFAULTS,
  quantizeBins,
  labelComponents,
  pcaFromStats,
  buildRegions,
  fitEllipse,
};
