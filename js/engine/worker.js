/**
 * Web Worker host for the deterministic bake / batch path (Phase 6 / Track-S S7).
 *
 * This worker runs the **engine of record** (via `bake.js`) off the main thread
 * so a batch of images can be baked — with progress and a clean cancel — without
 * blocking the UI.
 *
 * Load it as a module worker:
 *
 *   const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
 *
 * Protocol
 * --------
 * Main → worker:
 *   { type: 'bake',   id, profile, seed, jobs: [{ id, pixels, width, height }], bake? }
 *   { type: 'cancel', id }
 *   { type: 'ping' }
 *
 * Worker → main:
 *   { type: 'ready' }
 *   { type: 'progress', id, index, total, jobId, digest }   // index -1 = starting
 *   { type: 'result',   id, jobId, index, digest, count, score, imageHash, shapes }
 *   { type: 'complete', id, cancelled, completed, total }
 *   { type: 'error',    id, message }
 *
 * `pixels` may arrive as a `Uint8ClampedArray`, a `Uint8Array`, or a plain array.
 *
 * **Cancellability.** A worker's message loop is blocked while it computes, so a
 * single synchronous batch could never receive a `cancel`. The loop here bakes
 * ONE job then yields to the event loop (`setTimeout 0`) before the next, so a
 * queued `cancel` is delivered between jobs and the batch stops cleanly.
 *
 * @module worker
 */

import { bakeImage, BAKE_DEFAULTS } from './bake.js';

const post = (msg) => self.postMessage(msg);

/** Cancellation flags keyed by batch id, so a `cancel` lands mid-loop. */
const cancelFlags = new Set();

/** Yield to the event loop so queued `cancel`/`ping` messages get processed. */
const yieldToLoop = () => new Promise((r) => setTimeout(r, 0));

/**
 * Normalise the pixel payload of one job into a `Uint8ClampedArray`.
 * @param {object} job
 * @returns {object}
 */
function normaliseJob(job) {
  let pixels = job.pixels;
  if (pixels && pixels.data) pixels = pixels.data;      // an ImageData
  if (pixels && !(pixels instanceof Uint8ClampedArray)) pixels = new Uint8ClampedArray(pixels);
  return { ...job, pixels };
}

/**
 * Bake a batch, streaming progress and per-job results, honouring `cancel`.
 * @param {object} msg
 */
async function handleBake(msg) {
  const id = msg.id !== undefined ? msg.id : 0;
  try {
    const jobs = (msg.jobs || []).map(normaliseJob);
    const total = jobs.length;
    const baseBake = { ...BAKE_DEFAULTS, ...(msg.bake || {}) };
    cancelFlags.delete(id);
    post({ type: 'progress', id, index: -1, total, jobId: null, digest: null });

    let completed = 0;
    for (let i = 0; i < total; i++) {
      if (cancelFlags.has(id)) {
        post({ type: 'complete', id, cancelled: true, completed, total });
        return;
      }
      const job = jobs[i];
      const jobId = job.id !== undefined ? job.id : i;
      const bakeOpts = msg.seed !== undefined ? { ...baseBake, seed: msg.seed + i } : baseBake;
      const baked = bakeImage(msg.profile || {}, job, bakeOpts);
      post({
        type: 'result', id, jobId, index: i, digest: baked.digest,
        count: baked.count, score: baked.score, imageHash: baked.imageHash, shapes: baked.shapes,
      });
      completed++;
      post({ type: 'progress', id, index: i, total, jobId, digest: baked.digest });
      await yieldToLoop();
    }
    post({ type: 'complete', id, cancelled: false, completed, total });
  } catch (err) {
    post({ type: 'error', id, message: (err && err.message) || String(err) });
  }
}

self.onmessage = function (e) {
  const msg = e.data;
  if (!msg || !msg.type) return;
  switch (msg.type) {
    case 'bake': handleBake(msg); break;                       // async on purpose
    case 'cancel': cancelFlags.add(msg.id !== undefined ? msg.id : 0); break;
    case 'ping': post({ type: 'ready' }); break;
    case 'init': post({ type: 'ready' }); break;
  }
};

/**
 * Create a worker from this module's source for main-thread instantiation.
 * @returns {Worker}
 */
export function createWorker() {
  return new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
}

// Signal readiness on load.
post({ type: 'ready' });
