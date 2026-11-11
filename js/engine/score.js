/**
 * Parameter surface + headless scoring (Phase 5 / Harness H1).
 *
 * The AI style loop (`docs/AI_STYLE_HARNESS.md`) needs two things from the
 * engine: a **bounded, machine-readable action space** (the knobs an AI may
 * turn) and a **headless `score(profile, image) -> metrics` primitive** it can
 * call to measure a proposal. This module provides both.
 *
 * - `KNOB_SET` — the JSON descriptor of every tunable: name, type, range or
 *   enum, default and the engine surface it drives. This is the action space
 *   (Tier A of the harness).
 * - `scoreProfile(profile, image, opts)` — run the modular engine of record on
 *   a plain pixel buffer and return independent metrics (MAE, `simMae`, SSIM).
 *   No browser, no canvas → fast and deterministic.
 *
 * No randomness, no DOM: unit-testable under plain `node`.
 *
 * @module score
 */

import { clamp } from '../utils/math.js';
import { analyzeImage } from './analyzer.js';
import { optimise, OPTIMISER_DEFAULTS } from './optimizer.js';
import { normalizeProfile } from './profile.js';
import { rasterizeShapes, averageColor, metricsVsTarget } from './metrics.js';

/**
 * The tunable action space, as a JSON-serialisable descriptor list.
 *
 * `path` is where the knob lives (`global.*` = a Style Profile field;
 * `optimiser.*` = a modular-engine option) and `target` names the surface it
 * ultimately drives. `clampKnobs()` bounds values against these descriptors.
 *
 * @type {Array<object>}
 */
export const KNOB_SET = [
  { name: 'strokeCount', path: 'global.strokeCount', target: 'optimiser.count', type: 'integer', min: 1, max: 200000, default: 400, group: 'density' },
  { name: 'detailLevel', path: 'global.detailLevel', target: 'optimiser.detail', type: 'number', min: 0, max: 1, step: 0.05, default: 0.7, group: 'detail' },
  { name: 'opacity', path: 'global.opacity', target: 'optimiser.alpha', type: 'number', min: 0, max: 1, step: 0.05, default: 0.9, group: 'media' },
  { name: 'smart', path: 'global.smart', target: 'optimiser.structureAlign', type: 'boolean', default: false, group: 'structure' },
  { name: 'coverage', path: 'optimiser.coverage', target: 'optimiser.coverage', type: 'number', min: 0.1, max: 3, step: 0.05, default: OPTIMISER_DEFAULTS.coverage, group: 'stroke' },
  { name: 'elongation', path: 'optimiser.elongation', target: 'optimiser.elongation', type: 'number', min: 0, max: 4, step: 0.1, default: OPTIMISER_DEFAULTS.elongation, group: 'structure' },
  { name: 'scales', path: 'optimiser.scales', target: 'optimiser.scales', type: 'integer', min: 1, max: 5, default: OPTIMISER_DEFAULTS.scales, group: 'schedule' },
  { name: 'regionShare', path: 'optimiser.regionShare', target: 'optimiser.regionShare', type: 'number', min: 0, max: 0.5, step: 0.01, default: OPTIMISER_DEFAULTS.regionShare, group: 'init' },
  { name: 'style', path: 'global.style', target: 'engine.style', type: 'string', default: 'pencil', group: 'style', description: 'Registry style name (docs/STYLE_INVENTORY.md)' },
  { name: 'pathOrder', path: 'global.pathOrder', target: 'engine.pathOrder', type: 'string', default: 'free', group: 'order' },
  { name: 'multiLayer', path: 'global.multiLayer', target: 'engine.multiLayer', type: 'boolean', default: false, group: 'layers' },
];

/** @returns {Record<string, (number|boolean|string)>} every knob's default value. */
export function getKnobDefaults() {
  const out = {};
  for (const k of KNOB_SET) out[k.name] = k.default;
  return out;
}

/**
 * Bound a set of proposed knob values against {@link KNOB_SET}. Unknown keys are
 * dropped; numbers are clamped to `[min, max]` (integers rounded); booleans and
 * strings are coerced; a string knob with `values` is restricted to its enum.
 *
 * @param {object} vals
 * @returns {object} a safe, bounded subset of `vals`
 */
export function clampKnobs(vals = {}) {
  const out = {};
  for (const k of KNOB_SET) {
    if (vals[k.name] === undefined) continue;
    let v = vals[k.name];
    if (k.type === 'boolean') v = !!v;
    else if (k.type === 'integer') v = Math.round(clamp(Number(v), k.min, k.max));
    else if (k.type === 'number') v = clamp(Number(v), k.min, k.max);
    else if (k.type === 'string') { if (!Array.isArray(k.values) || k.values.includes(v)) v = String(v); else continue; }
    out[k.name] = v;
  }
  return out;
}

/**
 * Map a Style Profile onto modular-engine options (only the knobs the engine
 * actually honours). `overrides` (e.g. from `clampKnobs`) win.
 *
 * @param {object} profile
 * @param {object} [overrides]
 * @returns {object} options for `optimizer.optimise()`
 */
export function profileToOptimiserOptions(profile, overrides = {}) {
  const p = normalizeProfile(profile);
  const g = p.global;
  const o = {};
  if (g.strokeCount !== undefined) o.count = clamp(g.strokeCount, 1, 200000);
  if (g.opacity !== undefined) o.alpha = g.opacity;
  if (g.detailLevel !== undefined) o.detail = g.detailLevel;
  if (g.smart !== undefined) o.structureAlign = g.smart;
  return { ...o, ...overrides };
}

/**
 * Headless scoring primitive: run the engine of record on an image and measure
 * the render with independent metrics.
 *
 * @param {object} profile - a Style Profile.
 * @param {{pixels: Uint8ClampedArray, width: number, height: number}} image
 * @param {object} [options]
 * @param {number} [options.seed=12345]
 * @param {object} [options.optimiser] - engine-option overrides (wins over the profile).
 * @param {number[]} [options.background] - fill; defaults to the image mean.
 * @returns {{mae: number, simMae: number, ssim: number, strokes: number,
 *   options: object, stats: object}}
 */
export function scoreProfile(profile, image, options = {}) {
  const { pixels, width: w, height: h } = image;
  const seed = options.seed !== undefined ? options.seed : 12345;
  const analysis = analyzeImage(new Uint8ClampedArray(pixels), w, h);
  const optOpts = profileToOptimiserOptions(profile, options.optimiser || {});
  optOpts.seed = optOpts.seed !== undefined ? optOpts.seed : seed;
  const { shapes, stats } = optimise(analysis, optOpts);
  const bg = options.background || averageColor(pixels);
  const rendered = rasterizeShapes(shapes, w, h, bg);
  const m = metricsVsTarget(rendered, pixels, w, h);
  return {
    mae: m.mae,
    simMae: m.simMae,
    ssim: m.ssim,
    strokes: shapes.length,
    options: optOpts,
    stats,
  };
}

export default {
  KNOB_SET, getKnobDefaults, clampKnobs, profileToOptimiserOptions, scoreProfile,
};
