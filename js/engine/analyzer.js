/**
 * Image analysis: luminance maps, edge detection, color statistics.
 *
 * The Analyzer converts a source image into a set of typed arrays that the
 * Scorer and Generator use to make decisions about where, how large, and at
 * what color to place shape primitives.
 *
 * @module analyzer
 */

import { createRNG } from '../utils/rng.js';

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
 * @property {object|null} structure - Structure tensor maps: `{ orientation,
 *   coherence, energy, Jxx, Jyy, Jxy, width, height }`, or null when disabled.
 *   `orientation` is the TANGENT (edge-following) angle in [0, PI).
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
 * @param {boolean} [options.structure=true] - Compute the structure tensor maps.
 * @param {number} [options.structureRadius=3] - Tensor integration window half-size.
 * @returns {AnalysisResult}
 */
export function analyzeImage(pixels, width, height, options = {}) {
  const {
    edgeThreshold = 0.15,
    paletteSize = 16,
    seed = 12345,
    structure = true,
    structureRadius = 3,
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

  // 2b. Structure tensor → orientation (tangent) + coherence + energy maps.
  // Computed from the RAW Sobel gradients (edgesX/edgesY) before normalization,
  // so it is unaffected by the edge-magnitude scaling above.
  const structureResult = structure
    ? computeStructureTensor(edgesX, edgesY, width, height, { radius: structureRadius })
    : null;

  // 3. Simple region labeling (threshold-based flood-fill stub)
  // For now, label by luminance bucket
  for (let i = 0; i < n; i++) {
    regionMap[i] = Math.floor(luminance[i] / 32); // 8 buckets
  }

  // 4. Extract palette via simple k-means (lightweight)
  const palette = extractPalette(rgbSamples, paletteSize, seed);

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
    structure: structureResult,
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
 * Extract a color palette from RGB samples using simple k-means++ clustering.
 *
 * Uses a deterministic seeded PRNG (mulberry32) for centroid initialization,
 * so the same input + seed always produces the same palette. This is critical
 * for reproducible painting generation.
 *
 * @param {Array<[number, number, number]>} samples
 * @param {number} k
 * @param {number} [seed=12345] - Seeded PRNG state for deterministic initialization.
 * @returns {Array<[number, number, number]>}
 */
function extractPalette(samples, k, seed = 12345) {
  if (samples.length === 0) return [[0, 0, 0]];

  // Deterministic PRNG (mulberry32) — replaces non-deterministic Math.random()
  // in centroid initialization for reproducible palette extraction.
  const rnd = createRNG(seed >>> 0);

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
  // Initialize: pick spread-out samples (deterministically via seeded RNG)
  const used = new Set();
  for (let c = 0; c < clusters; c++) {
    let idx;
    do { idx = Math.floor(rnd() * (data.length / 3)) * 3; }
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

/// Epsilon guarding coherence / orientation math against a zero tensor.
const STRUCT_EPS = 1e-6;

/**
 * Separable box blur over a Float32Array (clamped edges).
 *
 * Used to integrate the structure tensor over a local window — a cheap,
 * deterministic stand-in for the Gaussian weighting used in the literature.
 *
 * @param {Float32Array} src
 * @param {number} w
 * @param {number} h
 * @param {number} radius - Half-window size in pixels (>=1).
 * @returns {Float32Array} Blurred copy.
 */
function boxBlur(src, w, h, radius) {
  const r = Math.max(0, Math.floor(radius));
  if (r === 0) return src.slice();
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  const win = r * 2 + 1;

  // Horizontal pass
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let acc = 0;
    for (let k = -r; k <= r; k++) acc += src[row + Math.max(0, Math.min(w - 1, k))];
    for (let x = 0; x < w; x++) {
      tmp[row + x] = acc / win;
      acc += src[row + Math.min(w - 1, x + r + 1)] - src[row + Math.max(0, x - r)];
    }
  }
  // Vertical pass
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let k = -r; k <= r; k++) acc += tmp[Math.max(0, Math.min(h - 1, k)) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc / win;
      acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
    }
  }
  return out;
}

/**
 * Wrap an angle into [0, PI). Line orientation is PI-periodic.
 * @param {number} a
 * @returns {number}
 */
function wrapPi(a) {
  const p = Math.PI;
  let x = a % p;
  if (x < 0) x += p;
  return x;
}

/**
 * Compute the structure tensor of a gradient field and derive the orientation,
 * coherence and energy maps used to steer strokes along image structure.
 *
 * The structure tensor J = W * (∇I ∇Iᵀ) integrates the outer product of the
 * image gradient over a window W. Its eigenvectors describe the dominant local
 * orientation of image structure and how anisotropic it is:
 *
 * - **orientation** — the TANGENT (edge-following) direction, i.e. the
 *   principal gradient orientation rotated by 90°, wrapped to [0, PI). Strokes
 *   aligned to this lie ALONG edges / iso-brightness lines (Hertzmann-style
 *   edge-following), which is the classic painterly behaviour.
 * - **coherence** — (λ₁ − λ₂) / (λ₁ + λ₂) in [0, 1]. 1 = a single strong
 *   orientation (a clean edge), 0 = isotropic (flat area or textured noise).
 * - **energy** — λ₁ normalised to [0, 1] against the image maximum; a proxy for
 *   how much structure is present at the pixel.
 *
 * @param {Float32Array} gx - Raw Sobel X gradient per pixel.
 * @param {Float32Array} gy - Raw Sobel Y gradient per pixel.
 * @param {number} width
 * @param {number} height
 * @param {object} [options]
 * @param {number} [options.radius=3] - Integration window half-size (pixels).
 * @returns {{orientation: Float32Array, coherence: Float32Array,
 *   energy: Float32Array, Jxx: Float32Array, Jyy: Float32Array,
 *   Jxy: Float32Array, width: number, height: number}}
 */
export function computeStructureTensor(gx, gy, width, height, options = {}) {
  const { radius = 3 } = options;
  const n = width * height;
  const jxx = new Float32Array(n);
  const jyy = new Float32Array(n);
  const jxy = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = gx[i];
    const b = gy[i];
    jxx[i] = a * a;
    jyy[i] = b * b;
    jxy[i] = a * b;
  }
  const sxx = boxBlur(jxx, width, height, radius);
  const syy = boxBlur(jyy, width, height, radius);
  const sxy = boxBlur(jxy, width, height, radius);

  const orientation = new Float32Array(n);
  const coherence = new Float32Array(n);
  const energy = new Float32Array(n);

  let maxE = 0;
  for (let i = 0; i < n; i++) {
    const a = sxx[i];
    const b = syy[i];
    const c = sxy[i];
    const diff = a - b;
    const disc = Math.sqrt(diff * diff + 4 * c * c);
    const l1 = (a + b + disc) * 0.5;
    const l2 = (a + b - disc) * 0.5;
    coherence[i] = (l1 - l2) / (l1 + l2 + STRUCT_EPS);
    // Principal GRADIENT orientation → rotate 90° for the tangent.
    const grad = 0.5 * Math.atan2(2 * c, diff);
    orientation[i] = wrapPi(grad + Math.PI / 2);
    energy[i] = l1;
    if (l1 > maxE) maxE = l1;
  }
  if (maxE > 0) {
    for (let i = 0; i < n; i++) energy[i] /= maxE;
  }

  return { orientation, coherence, energy, Jxx: sxx, Jyy: syy, Jxy: sxy, width, height };
}

/**
 * Bilinear sample of a structure map (orientation / coherence / energy).
 * Mirrors `sampleEdge`; a distinct export keeps call sites self-documenting.
 *
 * @param {Float32Array} arr
 * @param {number} width
 * @param {number} height
 * @param {number} x
 * @param {number} y
 * @returns {number}
 */
export function sampleStructure(arr, width, height, x, y) {
  // Clamp to the valid range: unlike sampleEdge (only ever called with
  // in-bounds points), structure samples are taken at stroke centroids which
  // may fall outside the image, and an out-of-range index yields NaN.
  const cx = x < 0 ? 0 : x > width - 1 ? width - 1 : x;
  const cy = y < 0 ? 0 : y > height - 1 ? height - 1 : y;
  return sampleEdge(arr, width, height, cx, cy);
}

/**
 * Minimal HSL→RGB (h in degrees, s/l in [0, 1]). Kept local so the analyzer
 * stays dependency-free and worker-safe.
 */
function hslToRgbLocal(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = l - c / 2;
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

/**
 * Build a debug visualization of a structure tensor as an RGBA buffer.
 *
 * Hue encodes the tangent orientation (full wheel), saturation encodes
 * coherence, and lightness encodes energy — so edges read as vivid, oriented
 * colour and flat areas read as dark neutral. Node-safe (no canvas required):
 * callers blit the result with `ctx.putImageData(new ImageData(rgba, w, h), 0, 0)`.
 *
 * @param {object} structure - Result of computeStructureTensor.
 * @returns {Uint8ClampedArray} RGBA buffer of length width*height*4.
 */
export function structureDebugRGBA(structure) {
  const { orientation, coherence, energy, width, height } = structure;
  const n = width * height;
  const out = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) {
    const hue = (orientation[i] / Math.PI) * 360; // 0..180° → full wheel
    const sat = coherence[i];
    const lig = 0.12 + 0.76 * energy[i];
    const [r, g, b] = hslToRgbLocal(hue, sat, lig);
    const o = i * 4;
    out[o] = r;
    out[o + 1] = g;
    out[o + 2] = b;
    out[o + 3] = 255;
  }
  return out;
}

export default {
  analyzeImage,
  sampleRegion,
  sampleLuminance,
  sampleEdge,
  sampleStructure,
  computeStructureTensor,
  structureDebugRGBA,
  SOBEL_X,
  SOBEL_Y,
};
