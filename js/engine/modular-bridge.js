/**
 * Track R — modular-engine bridge for the app path (Mac half, R5/R6).
 *
 * Track R made the **modular engine** (`analyzer.js` + `optimizer.js` +
 * `regions.js` + `scorer.js`) the engine of record (see `docs/CLEANROOM.md`),
 * and R1–R5 landed its primitives + Style Profiles + wet media. What is still
 * missing is the **app path**: `js/engine/engine.js#generate()` runs the
 * legacy `painter.js`, so none of R1–R5's work is reachable from the UI until
 * the app can generate with the modular engine.
 *
 * This module is the **adapter** that makes that switch possible without any
 * edit to a ThinkPad-owned file. `js/engine/engine.js` is BE-owned
 * (`HANDOFF.md` §6), so the seam is designed to be a **zero-diff wiring point**:
 *
 * ```js
 * // in engine.js#generate(), alongside the existing `new Painter(...)` call:
 * const plan = buildModularPlan(this._analysis, {
 *   style, count, seed, layerStyles, width: this.width, height: this.height,
 * });
 * if (plan.shapes.length) { /* assign layers + return, exactly as the Painter path does *\/ }
 * ```
 *
 * With `opts` absent (the shipped default) `buildModularPlan` returns
 * `{ used: false, shapes: [] }` — a caller can therefore add the two lines
 * above and the app stays **byte-identical** until an opt-in flips it.
 *
 * ## What it does
 *
 * 1. runs the modular optimiser (`optimizer.optimise`) over the analysis;
 * 2. converts the optimiser's raw shape records into the SAME engine-format
 *    shape `_convertShape` produces (`{id, type, params, color0, color1,
 *    alpha, style, layer, order, seed, flat}`) — so the Renderer, the layer
 *    panel, the motion playback and the exporter all consume it unchanged;
 * 3. applies the R4 seam (`r4.buildR4Plan`) for **per-style shaping** — the
 *    R4 item the app can reach without a spine edit;
 * 4. applies Phase 2.2 **per-layer styles** (`layer-styles.applyLayerStyles`).
 *
 * ## Honest scope
 *
 * - It is a **planner**: it returns shapes. It does not paint, and it does not
 *   touch a canvas. `engine.js` decides what to do with the shapes.
 * - It does **not** claim parity with `painter.js`. The parity gate is
 *   `scripts/parity-bench.cjs` (BE-owned) and is a separate decision.
 * - `optimise` is called with `useWorker`-independent, pure options; no DOM.
 *
 * @module modular-bridge
 */

import { optimise, resolveOptions } from './optimizer.js';
import { applyLayerStyles } from './layer-styles.js';
import { buildR4Plan, resolveEffectiveShaping } from './r4.js';
import { aliasStyle } from './style-alias.js';

/**
 * Default bridge options.
 *
 * `enabled` is the opt-in switch. Everything else mirrors the optimiser's own
 * defaults so an explicit call and a default call agree.
 */
export const BRIDGE_DEFAULTS = {
  enabled: false,
  /** Fraction of the stroke budget the outline lay-in may consume. */
  outlineBudgetFrac: 0.35,
  /** Cap on a single outline lay-in (safety, mirrors `painter.js`'s own cap). */
  outlineMax: 64,
  /** Deterministic seed. */
  seed: 12345,
};

/**
 * Does an engine-format shape carry a finite position?
 * @param {object} s
 * @returns {boolean}
 */
function hasPosition(s) {
  const p = s?.params;
  return Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]);
}

/**
 * Convert one raw optimiser shape into the engine's shape format.
 *
 * `optimizer.js` emits `{ type, params, color0, color1, alpha, ... }` with
 * params already in the shape-type's own order. `_convertShape` in
 * `engine.js` embeds colours at the indices the style renderers expect
 * (`E/B/R`: index 5 becomes `c0`, then `c1`, `alpha` are appended; `S/T`:
 * `c0`, `c1`, `alpha` are appended). The Renderer and every style module read
 * THOSE indices, so this function performs the same embedding — otherwise a
 * modular shape would be drawn with the wrong colour.
 *
 * @param {object} raw - raw optimiser shape (`{type, params, color0, color1, alpha}`)
 * @param {number} order - paint order (position in the emitted list)
 * @param {number} layerIdx
 * @param {number} seed
 * @returns {object} engine-format shape
 */
export function toEngineShape(raw, order, layerIdx = 0, seed = 0) {
  const t = raw.type;
  const p = Array.isArray(raw.params) ? raw.params.slice() : [];
  const c0 = Array.isArray(raw.color0) ? raw.color0.slice() : [0, 0, 0];
  const c1 = Array.isArray(raw.color1) ? raw.color1.slice() : c0.slice();
  const a = typeof raw.alpha === 'number' ? raw.alpha : 1;

  if (t === 'E' || t === 'B' || t === 'R') {
    // index 5 is the gradient angle / feather — overwritten by c0, as in
    // engine.js `_convertShape`.
    p[5] = c0;
    p.push(c1, a);
  } else {
    p.push(c0, c1, a);
  }

  return {
    id: `stroke_${layerIdx}_${order}`,
    type: t,
    params: p,
    color0: c0,
    color1: c1,
    alpha: a,
    style: typeof raw.style === 'string' ? raw.style : 'painterly',
    layer: layerIdx,
    order,
    seed,
    flat: !!raw.flat,
  };
}

/**
 * Derive the optimiser options for a modular run.
 *
 * Deliberately does NOT pass anything the optimiser does not accept: an
 * unknown key would be ignored silently, which is how a "wired but inert"
 * option ships. Only documented `resolveOptions` keys are set.
 *
 * @param {object} args
 * @returns {object}
 */
export function modularOptions({
  style = 'pencil',
  count = 400,
  seed = BRIDGE_DEFAULTS.seed,
  regionFill = 0,
  passes = null,
  primitives = null,
} = {}) {
  const opts = {
    style: style,
    // `count` is the optimiser's own budget key. `maxShapes` is NOT read by
    // `resolveOptions`/`optimise` (measured: `optimise(an,{maxShapes:10})`
    // returned 400 shapes) — passing it would silently paint the default.
    count: Math.max(1, Math.round(count)),
    seed: Math.round(seed),
    regionFill: Math.max(0, Math.min(1, Number(regionFill) || 0)),
  };
  if (Array.isArray(passes) && passes.length) opts.passes = passes;
  if (primitives && typeof primitives === 'object') opts.primitives = primitives;
  return opts;
}

/**
 * Plan a modular-engine painting. Pure: no DOM, no canvas, no mutation of its
 * arguments. Returns `used:false` when the bridge is not enabled, so a caller
 * can wire it in without changing today's output.
 *
 * @param {object} analysis - `analyzeImage()` result (`edges`, `width`, `height`)
 * @param {object} [args]
 * @param {boolean} [args.enabled=false] - the opt-in switch
 * @param {string} [args.style='pencil'] - registry style name
 * @param {number} [args.count=400] - stroke budget
 * @param {number} [args.seed=12345]
 * @param {Array<object>} [args.layerStyles] - Phase 2.2 per-layer style spec
 * @param {Array<object>} [args.passes] - S4 explicit pass schedule
 * @param {object} [args.primitives] - S5 primitive mix
 * @param {object} [args.shapingOverride] - R4 per-style shaping override
 * @param {number} [args.width] - image width (ordering centre + outline cap)
 * @param {number} [args.height]
 * @returns {{
 *   used: boolean, reason: string, shapes: object[],
 *   shaping: object|null, plan: object|null, options: object|null,
 *   rawCount: number, outlineCount: number
 * }}
 */
export function buildModularPlan(analysis, args = {}) {
  const o = { ...BRIDGE_DEFAULTS, ...args };
  const width = o.width ?? analysis?.width ?? 0;
  const height = o.height ?? analysis?.height ?? 0;

  if (!o.enabled) {
    return {
      used: false, reason: 'disabled', shapes: [], shaping: null, plan: null,
      options: null, rawCount: 0, outlineCount: 0,
    };
  }
  if (!analysis || !(width > 0) || !(height > 0)) {
    return {
      used: false, reason: 'no-analysis', shapes: [], shaping: null, plan: null,
      options: null, rawCount: 0, outlineCount: 0,
    };
  }

  // R4 per-style shaping: the style's own row, or an explicit override.
  const shaping = resolveEffectiveShaping(o.style, o.shapingOverride);

  const options = modularOptions({
    style: o.style,
    count: o.count,
    seed: o.seed,
    regionFill: shaping.shaping.regionFill || 0,
    passes: o.passes,
    primitives: o.primitives,
  });
  // `resolveOptions` is the optimiser's own normaliser — use it so the bridge
  // and a direct `optimise()` call cannot drift apart.
  const resolved = resolveOptions(options);

  const raw = optimise(analysis, resolved);
  const list = Array.isArray(raw?.shapes) ? raw.shapes : [];
  const usable = list.filter(hasPosition);

  // Outline lay-in from the R4 seam, budget-capped. Laid FIRST (classical
  // contour-before-masses), so the outlines occupy the low `order` values.
  const outlineBudget = Math.min(
    o.outlineMax,
    Math.max(0, Math.round(o.count * o.outlineBudgetFrac)),
  );
  let outlines = [];
  try {
    const r4 = buildR4Plan({
      style: o.style,
      analysis,
      order: shaping.shaping.order,
      outline: 'first',
      outlineOptions: { budget: outlineBudget },
      width, height,
    });
    outlines = Array.isArray(r4?.outlinePoints) ? r4.outlinePoints : [];
  } catch {
    outlines = [];
  }

  const shapes = [];
  let order = 0;
  for (const pts of outlines) {
    if (!Array.isArray(pts) || pts.length < 2) continue;
    const a = pts[0];
    const b = pts[pts.length - 1];
    const mid = pts[pts.length >> 1];
    shapes.push(toEngineShape({
      type: 'S',
      // [x0,y0, cx,cy, x1,y1, width, angle]
      params: [
        a[0], a[1],
        2 * mid[0] - (a[0] + b[0]) / 2, 2 * mid[1] - (a[1] + b[1]) / 2,
        b[0], b[1],
        Math.max(1, Math.min(width, height) * 0.0028),
        Math.atan2(b[1] - a[1], b[0] - a[0]),
      ],
      color0: [30, 30, 30],
      color1: [30, 30, 30],
      alpha: 0.9,
      style: o.style,
      flat: true,
    }, order++, 0, o.seed));
  }
  for (const r of usable) {
    // The RAW registry name, never the Painter alias: `aliasStyle('watercolor')
    // → 'watercolour'`, and `watercolour` is NOT in the registry, so the
    // Renderer would fall back to the flat `drawShape` and silently paint every
    // stroke in the generic renderer. The engine registers aliases on its own
    // renderer (engine.js `_registerAllStyles`), but the shape's `style` field
    // must still name a real style.
    shapes.push(toEngineShape({ ...r, style: o.style }, order++, 0, o.seed));
  }

  // Phase 2.2 — per-layer styles. Applied LAST, exactly where `engine.js`
  // applies it on the Painter path.
  if (o.layerStyles) applyLayerStyles(shapes, o.layerStyles);

  return {
    used: shapes.length > 0,
    reason: shapes.length > 0 ? 'ok' : 'empty',
    shapes,
    shaping: shaping.shaping,
    plan: null,
    options: resolved,
    rawCount: usable.length,
    outlineCount: outlines.length,
  };
}

export default {
  BRIDGE_DEFAULTS, buildModularPlan, toEngineShape, modularOptions,
};
