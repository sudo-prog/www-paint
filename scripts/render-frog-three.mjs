#!/usr/bin/env node
/**
 * Render the frog through the REAL app path under three lever configurations.
 *
 * SUPERSEDED 2026-11-19 — the previous version of this script had two bugs that
 * made the deliverable look like "blobs of mess":
 *
 *   1. it read `test-images/frog.png`, which is a SYNTHETIC TEST PATTERN
 *      (blue square / red circle / green triangle / "TEST" text), NOT a frog.
 *      The real fixture is `test-images/frog-source.jpg`.
 *   2. it called `optimise()` directly and painted the raw dabs with
 *      `drawShape()` from `js/engine/shapes.js`. The optimiser emits filled
 *      ellipse dabs (type 'E'), and the style renderers hatch filled shapes, so
 *      painting them directly yields black scribble mud. The real path converts
 *      each dab to a brush stroke via `dabToStrokeShape` in
 *      `js/engine/modular-bridge.js`.
 *
 * The correct render now lives in `scripts/frog-levers-probe.cjs`, which drives
 * `PaintingEngine` (js/engine/engine.js, `useWorker:true` — app.js's exact
 * config), calls `engine.loadImage()` then `engine.generate({modular:true,...})`
 * and paints via the engine's own renderer. This file simply delegates to it so
 * anyone running the old entry point gets the fixed output instead of blobs.
 *
 * Usage:
 *   NODE_PATH=/home/thinkpad/.hermes/hermes-agent/node_modules \
 *     node scripts/render-frog-three.mjs
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const probe = path.join(here, 'frog-levers-probe.cjs');

const r = spawnSync(process.execPath, [probe], { stdio: 'inherit' });
if (r.status !== 0) {
  console.error('\nrender-frog-three: the real app-path probe failed.');
  console.error('It needs NODE_PATH pointing at playwright-core, e.g.');
  console.error('  NODE_PATH=/home/thinkpad/.hermes/hermes-agent/node_modules node scripts/render-frog-three.mjs');
}
process.exit(r.status ?? 1);
