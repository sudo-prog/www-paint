/**
 * Web Worker for heavy computation (scoring, generation).
 *
 * This file is designed to be loaded as a worker blob URL or via
 * `new Worker(new URL('./worker.js', import.meta.url))`.
 *
 * Communication protocol:
 *
 *   Main → Worker messages:
 *   { type: 'start', w, h, imageData (Uint8ClampedArray | ImageData), settings, seed }
 *   { type: 'stop' }
 *   { type: 'ping' }
 *
 *   Worker → Main messages:
 *   { type: 'ready' }        — worker is initialized
 *   { type: 'shape', ... }   — a scored shape candidate
 *   { type: 'progress', done, total, shapesGenerated }
 *   { type: 'complete', totalShapes }
 *   { type: 'error', message }
 *
 * @module worker
 */

// Import analysis and generation modules.
// In a worker context, these are loaded via importScripts or static import.
// For maximum compatibility, we use static imports (modern browsers support ES modules in workers).

import { analyzeImage } from './analyzer.js';
import { generateCandidates } from './generator.js';
import { selectBest, selectGreedyResidual, selectWithResidual } from './scorer.js';

let active = false;
let cancelled = false;

/**
 * Send a message to the main thread.
 * @param {object} msg
 */
function post(msg) {
  self.postMessage(msg);
}

/**
 * Handle an incoming message from the main thread.
 * @param {MessageEvent} e
 */
self.onmessage = function (e) {
  const msg = e.data;
  if (!msg || !msg.type) return;

  switch (msg.type) {
    case 'start':
      active = true;
      cancelled = false;
      startProcessing(msg);
      break;
    case 'stop':
      cancelled = true;
      active = false;
      break;
    case 'ping':
      post({ type: 'ready' });
      break;
    case 'init':
      // Initialize — just signal readiness
      post({ type: 'ready' });
      break;
  }
};

/**
 * Main processing entry point.
 *
 * @param {object} msg - { id, w, h, imageData, settings, seed }
 */
async function startProcessing(msg) {
  try {
    const { id, w, h, imageData, settings, seed } = msg;

    if (!imageData || !w || !h) {
      post({ type: 'error', message: 'Missing image data' });
      return;
    }

    // Normalize pixel data
    let pixels;
    if (imageData instanceof Uint8ClampedArray) {
      pixels = imageData;
    } else if (imageData.data) {
      pixels = new Uint8ClampedArray(imageData.data);
    } else if (Array.isArray(imageData)) {
      pixels = new Uint8ClampedArray(imageData);
    } else {
      post({ type: 'error', message: 'Invalid image data format' });
      return;
    }

    // 1. Analyze the image
    const analysis = analyzeImage(pixels, w, h, {
      paletteSize: settings.paletteSize || 8,
      edgeThreshold: 0.15,
    });

    // 2. Generate candidates
    const candidates = generateCandidates(analysis, settings, seed, 10000);

    // 3. Score and select
    post({
      type: 'progress',
      id,
      generated: candidates.length,
      total: settings.strokeCount || candidates.length,
    });

    let selected;
    if (settings.useResidual) {
      selected = selectWithResidual(candidates, analysis, settings.strokeCount, {
        residualWeight: 0.6,
        minResidual: 0.02,
      });
    } else if (settings.useGreedy) {
      selected = selectGreedyResidual(candidates, analysis, settings.strokeCount, {});
    } else {
      selected = selectBest(candidates, analysis, settings.strokeCount, {});
    }

    if (cancelled) {
      post({ type: 'cancelled', id });
      return;
    }

    // 4. Post shapes back in batches
    const batchSize = 200;
    for (let i = 0; i < selected.length; i += batchSize) {
      if (cancelled) {
        post({ type: 'cancelled', id });
        return;
      }
      const batch = selected.slice(i, i + batchSize);
      post({
        type: 'shapes',
        id,
        batch: batch.map(s => ({
          id: s.id,
          type: s.type,
          params: s.params,
          color0: s.color0,
          color1: s.color1,
          alpha: s.alpha,
          style: s.style,
          layer: s.layer,
          order: s.order,
          seed: s.seed,
          score: s.score,
        })),
      });
    }

    post({
      type: 'complete',
      id,
      totalShapes: selected.length,
    });
  } catch (err) {
    post({ type: 'error', message: err.message || String(err) });
  }
}

/**
 * Create a worker from this module's source for main-thread instantiation.
 *
 * Usage:
 *   const worker = createWorker();
 *   worker.onmessage = (e) => { ... };
 *   worker.postMessage({ type: 'start', ... });
 *
 * @returns {Worker}
 */
export function createWorker() {
  // Modern approach: load this file as an ES module worker
  return new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
}

/**
 * Serialize this worker source for blob-based loading (fallback).
 * @returns {string}
 */
function getWorkerSource() {
  return '';
}

// Signal readiness on load
post({ type: 'ready' });
