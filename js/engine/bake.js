/**
 * Deterministic bake + batch driver (Phase 6 / Track-S S7).
 *
 * The automation path: `(profile, image | imageBatch, seed?) -> { shapes, score }`
 * over the **engine of record** (the modular optimiser), with progress, a clean
 * cancel, and a *re-bake guarantee* — the same `(profile, seed, image)` produces
 * the same shapes (and therefore the same rendered PNG) every time.
 *
 * Two layers:
 *
 *   - `bakeImage(profile, image, opts)` — one deterministic bake. Pure: plain
 *     pixel buffers, no DOM, no canvas, so it runs under `node` AND inside a
 *     worker. Returns the shapes plus a `digest` that pins the bake.
 *   - `runBakeBatch(jobs, opts)` — a cancellable batch loop with progress.
 *
 * `js/engine/worker.js` hosts `runBakeBatch`; the headless PNG is the caller's
 * `engine.exportPNG()` on the returned shapes (a canvas concern, not this module).
 *
 * @module bake
 */

import { analyzeImage } from './analyzer.js';
import { optimise } from './optimizer.js';
import { profileToOptimiserOptions } from './score.js';
import { rasterizeShapes, averageColor, metricsVsTarget } from './metrics.js';

/** Default bake options. @type {object} */
export const BAKE_DEFAULTS = Object.freeze({
  seed: 12345,
  score: true,      // measure simMae for the baked shapes (independent raster)
  background: null, // fill; defaults to the image mean
});

/**
 * A fast, deterministic content hash of a pixel buffer (FNV-1a 32-bit over a
 * strided sample + the buffer size). Not a cryptographic hash — a *re-bake key*:
 * two buffers that differ anywhere sampled produce different hashes, and the
 * same buffer always produces the same one.
 *
 * @param {Uint8ClampedArray} pixels RGBA
 * @param {number} width
 * @param {number} height
 * @returns {string} 8-hex-char hash
 */
export function contentHash(pixels, width, height) {
  let h = 0x811c9dc5;
  const n = pixels.length;
  // Stride so the cost is independent of image size but the whole frame is
  // sampled: ~64 KiB of pixels is plenty to distinguish any two real images.
  const stride = Math.max(1, Math.floor(n / 65536));
  for (let i = 0; i < n; i += stride) {
    h ^= pixels[i];
    h = Math.imul(h, 0x01000193);
  }
  h ^= (width * 73856093) ^ (height * 19349663);
  h = Math.imul(h, 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * A deterministic digest over a bake's *inputs and outputs* — the re-bake
 * guarantee in one string: hash of `seed`, the image content hash and every
 * shape's geometry/colour in emitted order.
 *
 * @param {{seed: number, imageHash: string, shapes: Array<object>}} bake
 * @returns {string} 8-hex-char digest
 */
export function contentDigest({ seed, imageHash, shapes }) {
  let h = 0x811c9dc5;
  const mix = (x) => {
    const s = typeof x === 'number' ? (Number.isInteger(x) ? x.toString() : x.toFixed(6)) : String(x);
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  };
  mix(seed); mix(imageHash); mix(shapes.length);
  for (const s of shapes) {
    mix(s.type);
    const p = s.params || [];
    for (let i = 0; i < p.length; i++) mix(p[i]);
    const c0 = s.color0, c1 = s.color1;
    if (Array.isArray(c0)) mix(c0.join(',')); else mix(c0);
    if (Array.isArray(c1)) mix(c1.join(',')); else mix(c1);
    mix(s.alpha);
    mix(s.style);
    mix(s.layer);
    mix(s.order);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * Bake one image with a Style Profile, deterministically.
 *
 * @param {object} profile - a Style Profile (or anything `profileToOptimiserOptions` accepts).
 * @param {{pixels: Uint8ClampedArray, width: number, height: number}} image
 * @param {object} [opts] - see {@link BAKE_DEFAULTS}.
 * @returns {{shapes: Array<object>, count: number, imageHash: string,
 *   digest: string, score: number|null, options: object, stats: object}}
 */
export function bakeImage(profile, image, opts = {}) {
  const o = { ...BAKE_DEFAULTS, ...opts };
  const { pixels, width: w, height: h } = image;
  if (!pixels || !w || !h) throw new Error('bakeImage: image {pixels,width,height} is required');

  const analysis = analyzeImage(new Uint8ClampedArray(pixels), w, h);
  const engineOpts = profileToOptimiserOptions(profile, o.optimiser || {});
  engineOpts.seed = engineOpts.seed !== undefined ? engineOpts.seed : o.seed;
  const { shapes, stats } = optimise(analysis, engineOpts);

  const imageHash = contentHash(pixels, w, h);
  const digest = contentDigest({ seed: engineOpts.seed, imageHash, shapes });

  let score = null;
  if (o.score) {
    const bg = o.background || averageColor(pixels);
    const rendered = rasterizeShapes(shapes, w, h, bg);
    score = metricsVsTarget(rendered, pixels, w, h).simMae;
  }

  return { shapes, count: shapes.length, imageHash, digest, score, options: engineOpts, stats };
}

/**
 * Run a batch of images through {@link bakeImage}, sequentially, with progress
 * and a clean cancel.
 *
 * @param {Array<{id?: (string|number), pixels: Uint8ClampedArray, width: number, height: number}>} jobs
 * @param {object} [opts]
 * @param {object} [opts.profile] - the Style Profile every job is baked with.
 * @param {number} [opts.seed]
 * @param {(p: {index: number, total: number, id: (string|number), digest: string}) => void} [opts.onProgress]
 *   called after each job (and once at index -1 before the first).
 * @param {() => boolean} [opts.shouldCancel] - polled before each job AND between
 *   progress ticks; returning true stops the batch cleanly.
 * @param {object} [opts.bake] - forwarded to {@link bakeImage}.
 * @returns {{results: Array<object>, total: number, completed: number, cancelled: boolean}}
 */
export function runBakeBatch(jobs, opts = {}) {
  const list = Array.isArray(jobs) ? jobs : [];
  const profile = opts.profile || {};
  const seed = opts.seed;
  const bakeOpts = { ...(opts.bake || {}) };
  if (seed !== undefined) bakeOpts.seed = seed;

  const results = [];
  let cancelled = false;

  if (typeof opts.onProgress === 'function') {
    opts.onProgress({ index: -1, total: list.length, id: null, digest: null });
  }

  for (let i = 0; i < list.length; i++) {
    if (typeof opts.shouldCancel === 'function' && opts.shouldCancel()) { cancelled = true; break; }
    const job = list[i];
    const id = job.id !== undefined ? job.id : i;
    // A per-job seed keeps each image independent yet reproducible.
    const perJob = seed !== undefined ? (seed + i) : undefined;
    const baked = bakeImage(profile, job, perJob !== undefined ? { ...bakeOpts, seed: perJob } : bakeOpts);
    const rec = { id, index: i, ...baked };
    results.push(rec);
    if (typeof opts.onProgress === 'function') {
      opts.onProgress({ index: i, total: list.length, id, digest: baked.digest });
    }
  }

  return { results, total: list.length, completed: results.length, cancelled };
}

export default { BAKE_DEFAULTS, contentHash, contentDigest, bakeImage, runBakeBatch };
