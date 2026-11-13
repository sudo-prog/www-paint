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
import {
  rasterizeShapes, averageColor, metricsVsTarget, toFloatRGB, maskedMetrics, simMae,
  toRGBA, refPacketDistance, STYLE_MATCH_WEIGHTS,
} from './metrics.js';
import { computeTonalMasks } from './masks.js';
import { analyzeReference } from './ref-analyze.js';
import { createStyleRasteriser, stampShapeStyles, isStyleRenderAvailable } from './style-render.js';

/**
 * The default style-aware render backend for {@link scoreProfileStyle} (H-S6).
 * It renders the shapes through the real style registry where a canvas exists,
 * and transparently falls back to the plain `rasterizeShapes` under plain
 * `node`, so nothing changes off-browser.
 */
const styleRasteriser = createStyleRasteriser();

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

/**
 * The four tonal bands, in the order `masks.js` (IF-1) emits them.
 * @type {string[]}
 */
export const TONAL_BANDS = ['background', 'shadows', 'midtones', 'highlights'];

/**
 * Layer-aware scoring (Phase 2.2 closer).
 *
 * `scoreProfile` measures the whole frame. This measures the engine of record
 * **per tonal band**: it computes the same soft masks the layer system renders
 * with (`masks.js`, IF-1), then scores the rendered image against the target
 * *within each band* (weighted by the mask), and returns a coverage-weighted
 * composite. A band that reproduces its tonal range badly can no longer hide
 * behind three good ones — which is exactly what per-layer styles need to be
 * optimised against.
 *
 * Honest scope: the headless engine of record emits a **single** shape list
 * (multi-layer *rendering* is the canvas engine's job, Phase 2.3), so this
 * decomposes the composite render by tonal band rather than scoring separately
 * rasterised layers. Per-band *render* scoring arrives with the multi-layer
 * headless path.
 *
 * @param {object} profile - a Style Profile.
 * @param {{pixels: Uint8ClampedArray, width: number, height: number}} image
 * @param {object} [options]
 * @param {number} [options.seed=12345]
 * @param {object} [options.optimiser] - engine-option overrides (wins over the profile).
 * @param {number[]} [options.background] - fill; defaults to the image mean.
 * @param {object} [options.masks] - overrides for `computeTonalMasks` (lo/hi/softness).
 * @returns {{composite: {mae: number, simMae: number, ssim: number},
 *   overall: {mae: number, simMae: number, ssim: number},
 *   layers: Record<string, {mae: number, simMae: number, ssim: number, coverage: number}>,
 *   coverage: Record<string, number>, strokes: number, options: object, stats: object}}
 */
export function scoreProfileLayers(profile, image, options = {}) {
  const { pixels, width: w, height: h } = image;
  const seed = options.seed !== undefined ? options.seed : 12345;
  const analysis = analyzeImage(new Uint8ClampedArray(pixels), w, h);
  const optOpts = profileToOptimiserOptions(profile, options.optimiser || {});
  optOpts.seed = optOpts.seed !== undefined ? optOpts.seed : seed;
  const { shapes, stats } = optimise(analysis, optOpts);
  const bg = options.background || averageColor(pixels);
  const rendered = rasterizeShapes(shapes, w, h, bg);
  const target = toFloatRGB(pixels, w, h);
  const tonal = computeTonalMasks(analysis, options.masks || {});

  const layers = {};
  let cNum = 0, cDen = 0;
  for (const band of TONAL_BANDS) {
    const m = maskedMetrics(rendered, target, tonal.masks[band], w, h);
    layers[band] = { mae: m.mae, simMae: m.simMae, ssim: m.ssim, coverage: tonal.coverage[band], support: m.support };
    cNum += tonal.coverage[band] * m.mae;
    cDen += tonal.coverage[band];
  }
  const compositeMae = cDen > 0 ? cNum / cDen : 0;
  const overall = metricsVsTarget(rendered, pixels, w, h);

  return {
    composite: { mae: compositeMae, simMae: simMae(compositeMae), ssim: overall.ssim },
    overall,
    layers,
    coverage: tonal.coverage,
    strokes: shapes.length,
    options: optOpts,
    stats,
  };
}

/**
 * Composite policy for {@link scoreProfileStyle}. `styleWeight` trades the style
 * term against the reconstruction term; 1 = pure style, 0 = pure photo fidelity.
 * @type {object}
 */
export const STYLE_PROFILE_DEFAULTS = Object.freeze({
  styleWeight: 0.7,
});

/**
 * Style-match scoring (Track-S S2).
 *
 * `scoreProfile` optimises **photo fidelity**: how much the render looks like
 * the photo. That is the wrong objective for a style task — a "sref" request
 * asks the render to look like the *reference's stroke language*, on content the
 * reference does not share. This renders the profile on `image` and measures the
 * render's stroke language against a reference **RefPacket** (Track-S S1) built
 * from a reference image.
 *
 * Both sides go through the SAME analyser: the rendered frames are rasterised
 * and then analysed exactly as the reference image is. So the comparison never
 * compares different feature definitions, and any improvement in `styleMatch`
 * is an improvement under one fixed measure.
 *
 * **H-S6 — the render honours the profile's `style`.** The default backend is a
 * style-aware rasteriser (`style-render.js`) that pushes the shapes through the
 * real style registry, so a pencil profile and an ink profile no longer render
 * byte-identically. Where no canvas exists (`node`) it falls back to the plain
 * style-agnostic rasteriser, so `node` output is unchanged — a style can only be
 * rendered where one can be rendered. Pass `options.render` to inject a backend,
 * `options.applyStyle: false` to skip stamping, `options.style` to override the
 * style name.
 *
 * `composite` mixes the two objectives (`options.styleWeight`, default 0.7):
 * the style term dominates, but the reconstruction term stays in the loop so a
 * profile cannot win by painting something unrelated.
 *
 * Deterministic and headless: no DOM, no randomness beyond the seed; a canvas is
 * used only when one is available (and then only through the style registry).
 *
 * @param {object} profile - a Style Profile.
 * @param {{pixels: Uint8ClampedArray, width: number, height: number}} image
 *   the CONTENT to paint.
 * @param {object} reference - a reference image `{pixels,width,height}` **or** an
 *   already-built RefPacket (anything with `module === 'ref-analyze'`).
 * @param {object} [options]
 * @param {number} [options.seed=12345]
 * @param {object} [options.optimiser] - engine-option overrides (win over the profile).
 * @param {number[]} [options.background] - fill; defaults to the image mean.
 * @param {number} [options.styleWeight] - style vs reconstruction (default 0.7).
 * @param {object} [options.weights] - overrides for the packet term weights.
 * @param {object} [options.refOptions] - `analyzeReference` options for the reference.
 * @param {object} [options.packetOptions] - `analyzeReference` options for the render.
 * @returns {{styleMatch: number, styleDistance: number, styleParts: object,
 *   reconstruction: {mae: number, simMae: number, ssim: number},
 *   composite: number, strokes: number, options: object, stats: object,
 *   refPacket: object, resultPacket: object}}
 */
export function scoreProfileStyle(profile, image, reference, options = {}) {
  const { pixels, width: w, height: h } = image;
  const seed = options.seed !== undefined ? options.seed : 12345;
  const styleWeight = options.styleWeight !== undefined
    ? clamp(options.styleWeight, 0, 1)
    : STYLE_PROFILE_DEFAULTS.styleWeight;

  if (!reference) throw new Error('scoreProfileStyle: a reference image or RefPacket is required');

  const analysis = analyzeImage(new Uint8ClampedArray(pixels), w, h);
  const optOpts = profileToOptimiserOptions(profile, options.optimiser || {});
  optOpts.seed = optOpts.seed !== undefined ? optOpts.seed : seed;
  const { shapes, stats } = optimise(analysis, optOpts);
  const bg = options.background || averageColor(pixels);

  // H-S6 — render through the profile's *style*, not only its stroke geometry.
  // The style name comes from the profile (defaulting to the engine's own
  // default), every shape is stamped with it, and the render goes through the
  // style registry where a canvas exists (plain rasteriser otherwise).
  const styleName = options.style !== undefined
    ? options.style
    : (normalizeProfile(profile).global.style || 'pencil');
  const render = typeof options.render === 'function' ? options.render : styleRasteriser;
  const renderShapes = options.applyStyle === false ? shapes : stampShapeStyles(shapes, styleName);
  const rendered = render(renderShapes, w, h, bg);

  const refPacket = reference.module === 'ref-analyze'
    ? reference
    : analyzeReference(reference, options.refOptions || {});
  const resultPacket = analyzeReference(
    { pixels: toRGBA(rendered, w, h), width: w, height: h },
    options.packetOptions || {},
  );

  const { distance, parts } = refPacketDistance(refPacket, resultPacket, options.weights || {});
  const recon = metricsVsTarget(rendered, pixels, w, h);
  const reconstruction = { mae: recon.mae, simMae: recon.simMae, ssim: recon.ssim };
  const composite = styleWeight * (1 - distance) + (1 - styleWeight) * (recon.simMae / 100);

  return {
    styleMatch: 1 - distance,
    styleDistance: distance,
    styleParts: parts,
    reconstruction,
    composite,
    strokes: shapes.length,
    style: styleName,
    // 'style' = the registry-backed backend ran; 'plain' = the style-agnostic
    // fallback (no canvas); 'custom' = the caller injected options.render.
    renderBackend: typeof options.render === 'function'
      ? 'custom'
      : (isStyleRenderAvailable() ? 'style' : 'plain'),
    options: { ...optOpts, styleWeight },
    stats,
    refPacket,
    resultPacket,
  };
}

export default {
  KNOB_SET, getKnobDefaults, clampKnobs, profileToOptimiserOptions, scoreProfile,
  TONAL_BANDS, scoreProfileLayers,
  STYLE_PROFILE_DEFAULTS, STYLE_MATCH_WEIGHTS, scoreProfileStyle,
};
