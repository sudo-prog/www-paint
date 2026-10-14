/**
 * Image analysis: luminance maps, edge detection, color statistics.
 *
 * The Analyzer converts a source image into a set of typed arrays that the
 * Scorer and Generator use to make decisions about where, how large, and at
 * what color to place shape primitives.
 *
 * @module analyzer
 */

/// Sobel kernels for horizontal and vertical edge detection.
const SOBEL_X = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
const SOBEL_Y = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

/**
 * Analysis result object.
 *
 * @typedef {object} AnalysisResult
 * @property {Uint8ClampedArray} luminance - Grayscale luminance [0..255] per pixel.
 * @property {Float32Array} edges - Edge magnitude [0..1] per pixel.
 * @property {Float32Array} edgeX - Sobel X gradient per pixel.
 * @property {Float32Array} edgeY - Sobel Y gradient per pixel.
 * @property {Uint8ClampedArray} pixels - Original RGBA pixel data.
 * @property {number} width
 * @property {number} height
 * @property {Array<[number, number, number]>} palette - Quantized color palette.
 * @property {Array<number>} regionMap - Per-pixel region label (simplified).
 */

/**
 * Analyze raw RGBA pixel data and produce derived maps.
 *
 * @param {Uint8ClampedArray} pixels - RGBA pixel buffer.
 * @param {number} width
 * @param {number} height
 * @param {object} [options]
 * @param {number} [options.edgeThreshold=0.15] - Minimum edge magnitude to count.
 * @param {number} [options.paletteSize=16] - Number of quantized colors.
 * @returns {AnalysisResult}
 */
export function analyzeImage(pixels, width, height, options = {}) {
  const {
    edgeThreshold = 0.15,
    paletteSize = 16,
  } = options;

  const n = width * height;
  const luminance = new Uint8ClampedArray(n);
  const edgesX = new Float32Array(n);
  const edgesY = new Float32Array(n);
  const edges = new Float32Array(n);
  const regionMap = new Int32Array(n);

  // 1. Compute luminance and store RGB for palette extraction
  const rgbSamples = new Array(n);
  for (let i = 0; i < n; i++) {
    const idx = i * 4;
    const r = pixels[idx];
    const g = pixels[idx + 1];
    const b = pixels[idx + 2];
    // Rec. 709 luminance
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    luminance[i] = Math.round(l);
    rgbSamples[i] = [r, g, b];
  }

  // 2. Sobel edge detection
  let maxEdge = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const gx =
        sobelPixel(luminance, width, height, x, y, SOBEL_X);
      const gy =
        sobelPixel(luminance, width, height, x, y, SOBEL_Y);
      edgesX[idx] = gx;
      edgesY[idx] = gy;
      const mag = Math.sqrt(gx * gx + gy * gy);
      edges[idx] = mag;
      if (mag > maxEdge) maxEdge = mag;
    }
  }

  // Normalize edge magnitudes to [0, 1]
  if (maxEdge > 0) {
    for (let i = 0; i < n; i++) {
      edges[i] /= maxEdge;
    }
  }

  // 3. Simple region labeling (threshold-based flood-fill stub)
  // For now, label by luminance bucket
  for (let i = 0; i < n; i++) {
    regionMap[i] = Math.floor(luminance[i] / 32); // 8 buckets
  }

  // 4. Extract palette via simple k-means (lightweight)
  const palette = extractPalette(rgbSamples, paletteSize);

  return {
    luminance,
    edges,
    edgeX: edgesX,
    edgeY: edgesY,
    pixels: new Uint8ClampedArray(pixels), // copy
    width,
    height,
    palette,
    regionMap: Array.from(regionMap),
  };
}

/**
 * Apply a Sobel kernel at pixel (x, y) using luminance data.
 *
 * @param {Uint8ClampedArray} lum - Luminance array.
 * @param {number} w - Image width.
 * @param {number} h - Image height.
 * @param {number} x
 * @param {number} y
 * @param {number[]} kernel - 3x3 Sobel kernel.
 * @returns {number}
 */
function sobelPixel(lum, w, h, x, y, kernel) {
  let sum = 0;
  let ki = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const px = Math.max(0, Math.min(w - 1, x + dx));
      const py = Math.max(0, Math.min(h - 1, y + dy));
      sum += lum[py * w + px] * kernel[ki++];
    }
  }
  return sum;
}

/**
 * Extract a color palette from RGB samples using simple k-means++.
 *
 * @param {Array<[number, number, number]>} samples
 * @param {number} k
 * @returns {Array<[number, number, number]>}
 */
function extractPalette(samples, k) {
  if (samples.length === 0) return [[0, 0, 0]];

  // Subsample for performance
  const step = Math.max(1, Math.floor(samples.length / 5000));
  const data = [];
  for (let i = 0; i < samples.length; i += step) {
    const s = samples[i];
    data.push(s[0], s[1], s[2]);
  }

  // K-means with fixed iterations
  const clusters = k;
  const centroids = new Array(clusters);
  // Initialize: pick spread-out samples
  const used = new Set();
  for (let c = 0; c < clusters; c++) {
    let idx;
    do { idx = Math.floor(Math.random() * (data.length / 3)) * 3; }
    while (used.has(idx));
    used.add(idx);
    centroids[c] = [data[idx], data[idx + 1], data[idx + 2]];
  }

  for (let iter = 0; iter < 10; iter++) {
    const sums = new Array(clusters).fill(0).map(() => [0, 0, 0, 0]);
    for (let i = 0; i < data.length; i += 3) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      let best = 0, bestDist = Infinity;
      for (let c = 0; c < clusters; c++) {
        const d = Math.hypot(r - centroids[c][0], g - centroids[c][1], b - centroids[c][2]);
        if (d < bestDist) { bestDist = d; best = c; }
      }
      sums[best][0] += r; sums[best][1] += g; sums[best][2] += b; sums[best][3]++;
    }
    for (let c = 0; c < clusters; c++) {
      if (sums[c][3] > 0) {
        centroids[c] = [sums[c][0] / sums[c][3], sums[c][1] / sums[c][3], sums[c][2] / sums[c][3]];
      }
    }
  }

  return centroids.map(c => [Math.round(c[0]), Math.round(c[1]), Math.round(c[2])]);
}

/**
 * Sample the average color of a rectangular region.
 *
 * @param {Uint8ClampedArray} pixels - RGBA data.
 * @param {number} width
 * @param {number} height
 * @param {number} x0
 * @param {number} y0
 * @param {number} x1
 * @param {number} y1
 * @returns {[number, number, number]} Average RGB.
 */
export function sampleRegion(pixels, width, height, x0, y0, x1, y1) {
  x0 = Math.max(0, Math.floor(x0));
  y0 = Math.max(0, Math.floor(y0));
  x1 = Math.min(width - 1, Math.ceil(x1));
  y1 = Math.min(height - 1, Math.ceil(y1));

  let sr = 0, sg = 0, sb = 0, n = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = (y * width + x) * 4;
      sr += pixels[i];
      sg += pixels[i + 1];
      sb += pixels[i + 2];
      n++;
    }
  }
  if (n === 0) return [128, 128, 128];
  return [sr / n, sg / n, sb / n];
}

/**
 * Sample luminance at a point (bilinear).
 *
 * @param {Uint8ClampedArray} lum
 * @param {number} width
 * @param {number} height
 * @param {number} x
 * @param {number} y
 * @returns {number} Luminance 0..255.
 */
export function sampleLuminance(lum, width, height, x, y) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(width - 1, x0 + 1);
  const y1 = Math.min(height - 1, y0 + 1);
  const fx = x - x0;
  const fy = y - y0;
  const a = lum[y0 * width + x0];
  const b = lum[y0 * width + x1];
  const c = lum[y1 * width + x0];
  const d = lum[y1 * width + x1];
  return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy;
}

/**
 * Sample edge magnitude at a point (bilinear).
 *
 * @param {Float32Array} edges
 * @param {number} width
 * @param {number} height
 * @param {number} x
 * @param {number} y
 * @returns {number} Edge magnitude 0..1.
 */
export function sampleEdge(edges, width, height, x, y) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(width - 1, x0 + 1);
  const y1 = Math.min(height - 1, y0 + 1);
  const fx = x - x0;
  const fy = y - y0;
  const a = edges[y0 * width + x0];
  const b = edges[y0 * width + x1];
  const c = edges[y1 * width + x0];
  const d = edges[y1 * width + x1];
  return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy;
}

export default {
  analyzeImage,
  sampleRegion,
  sampleLuminance,
  sampleEdge,
  SOBEL_X,
  SOBEL_Y,
};
