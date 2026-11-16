/**
 * Track R4 — clean-room feature-parity seam (Mac half: outlines / order / shaping).
 *
 * R4 is the only Track R milestone that is still open after R0–R3. Its four
 * items map one-to-one onto three Mac-owned modules that already exist and are
 * **inert** — nothing outside their own test files imports them:
 *
 * | R4 item | Module | Status |
 * |---|---|---|
 * | outlines | `js/engine/outlines.js` (M7) | extracted, unlanded |
 * | path/order modes | `js/engine/order.js` (M8) | 11 modes, unlanded |
 * | per-style shaping | `js/styles/shaping.js` (M9) | 51-style table, unlanded |
 * | region-fill | `js/engine/optimizer.js` `regionFillPass` | **BE, landed** (`regionFill`, opt-in, default off) |
 *
 * This module is the **adapter** that puts the three Mac modules behind one
 * frozen, dependency-free, node-testable surface, so the BE-owned engine spine
 * (`optimizer.js` / `generator.js`) can call ONE function instead of three —
 * and so the adapter is verifiable without a browser.
 *
 * **Nothing here mutates a profile and nothing here invents a key.** Every
 * function is pure: same input → same output, no DOM, no canvas, no RNG. That is
 * the project's standing rule for a new option (HANDOFF.md §2.5).
 *
 * Honest scope, stated up front:
 * - The adapter produces **data** (order mode, shaping geometry, outline plan).
 *   It does NOT paint. Applying the plan to the optimiser is BE's spine work.
 * - The three source modules are NOT reimplemented here — only re-exported and
 *   validated. A rename in `outlines.js` / `order.js` / `shaping.js` fails a
 *   test rather than silently degrading.
 *
 * @module r4
 */

import { extractOutlines, OUTLINE_DEFAULTS, percentilePeak } from './outlines.js';
import { orderShapes, ORDER_MODES, ORDER_DEFAULTS } from './order.js';
import {
  resolveShaping, SHAPING_TABLE, SHAPING_DEFAULTS, STYLE_CATEGORIES, unshapedStyles,
} from '../styles/shaping.js';
import { getAllStyles, getStyleInfo } from '../styles/index.js';

/* ─── Frozen vocabulary ──────────────────────────────────────────────────── */

/**
 * R4 outline *intents*. These are a NEW, smaller vocabulary than the legacy
 * painter's `off | first | last` — R4 is feature parity with a clean-room
 * derivation, not a copy of `Painter.OUTL`.
 */
export const OUTLINE_MODES = ['off', 'first', 'last'];

/**
 * R4 paint-order modes = the M8 module's eleven modes **plus** the three modes
 * the legacy `generator.js` `orderShapes` understands (`top-bottom`,
 * `edges-first`, `one-line`) and which `js/engine/profile.js` still validates
 * against. They are listed as EXTENSIONS: `order.js` deliberately returns
 * `free` for an unknown mode, so an extension must be spelled out rather than
 * left to fall through silently.
 *
 * @type {string[]}
 */
export const ORDER_EXTENSIONS = ['top-bottom', 'edges-first', 'one-line'];

/**
 * Every order mode R4 can name, canonical order first.
 * @type {string[]}
 */
export const R4_ORDER_MODES = [...ORDER_MODES, ...ORDER_EXTENSIONS];

export { ORDER_MODES, ORDER_DEFAULTS, OUTLINE_DEFAULTS };

/* ─── Order ─────────────────────────────────────────────────────────────── */

/**
 * Is `mode` a mode the M8 module itself implements?
 * @param {string} mode
 * @returns {boolean}
 */
export function isNativeOrderMode(mode) {
  return ORDER_MODES.includes(mode);
}

/**
 * Is `mode` any mode R4 can name (native or legacy extension)?
 * @param {string} mode
 * @returns {boolean}
 */
export function isR4OrderMode(mode) {
  return R4_ORDER_MODES.includes(mode);
}

/**
 * The M8 module's own contract for a mode it does not implement.
 *
 * `orderShapes(shapes, mode)` falls back to `free` — which for that module means
 * *input order untouched*, not a shuffle. That differs from
 * `generator.js`'s `free` (a deterministic shuffle) and from
 * `painter.js`'s `free` (skip ordering). Callers must know which one they are
 * getting, so the distinction is a named constant rather than a comment.
 */
export const UNKNOWN_ORDER_FALLBACK = ORDER_DEFAULTS.mode;

/**
 * Plan a paint order WITHOUT touching the caller's shapes.
 *
 * Returns the mode to use, whether it is native or an extension, the ordering
 * centre that will be used, and the resulting `order` index per shape.
 *
 * @param {Array<object>} shapes
 * @param {string} mode
 * @param {object} [opts] - `{ cx, cy }` or `{ width, height }`
 * @returns {{
 *   mode: string, native: boolean, centre: {cx: number, cy: number},
 *   order: number[], changed: boolean
 * }}
 */
export function planOrder(shapes, mode, opts = {}) {
  const list = Array.isArray(shapes) ? shapes : [];
  const native = isNativeOrderMode(mode);
  const centre = resolveCentre(list, opts);

  if (!native) {
    // Extension or unknown: the M8 module leaves the list untouched, so the
    // plan reports input order and `native: false`. The caller (BE) either
    // implements the extension in the spine or treats it as `free`.
    return { mode, native, centre, order: list.map((_, i) => i), changed: false };
  }

  // Work on a COPY. `orderShapes` sets `order` on the shape objects it is
  // handed, and its contract is "a new array of the SAME objects" — so a
  // planner that hands over the caller's objects writes into the caller's
  // state. Planning must be side-effect free: the spine decides whether to
  // commit, and a rejected plan must not have already stamped `order`.
  const working = list.map((s) => (s && typeof s === 'object' ? { ...s } : s));
  const ordered = orderShapes(working, mode, opts);

  // `orderShapes` writes `order` as the shape's POSITION in the returned array,
  // so reading `order` back per input slot is the identity by construction
  // (slot i always reads i). The permutation is the ARRAY order: `order[i]` is
  // the original index of the shape that paints at position i.
  const order = ordered.map((s) => {
    const at = working.indexOf(s);
    return at >= 0 ? at : 0;
  });
  let changed = order.length !== list.length;
  for (let i = 0; i < order.length && !changed; i++) if (order[i] !== i) changed = true;

  return { mode, native, centre, order, changed };
}

/**
 * Resolve the ordering centre with the same precedence as `order.js`
 * (explicit `cx/cy` → `width/height` → the shapes' own bounding box), so the
 * plan can report it and a test can pin it.
 *
 * @param {Array<object>} shapes
 * @param {object} opts
 * @returns {{cx: number, cy: number}}
 */
export function resolveCentre(shapes, opts = {}) {
  if (opts.cx !== undefined && opts.cy !== undefined) {
    return { cx: opts.cx, cy: opts.cy };
  }
  if (opts.width !== undefined && opts.height !== undefined) {
    return { cx: opts.width / 2, cy: opts.height / 2 };
  }
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const s of shapes) {
    const p = Array.isArray(s?.params) ? s.params : [];
    if (typeof p[0] === 'number') { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); }
    if (typeof p[1] === 'number') { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  }
  if (!Number.isFinite(x0)) return { cx: 0, cy: 0 };
  return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}

/* ─── Shaping ───────────────────────────────────────────────────────────── */

/**
 * The shaping fields R4 consumes, with their documented types.
 * @type {Array<{key: string, type: string, min: number}>}
 */
export const SHAPING_FIELDS = [
  { key: 'minSize', type: 'number', min: 0 },
  { key: 'maxSize', type: 'number', min: 0 },
  { key: 'elongation', type: 'number', min: 1 },
  { key: 'order', type: 'string', min: 0 },
  { key: 'regionFill', type: 'number', min: 0 },
];

/**
 * Per-style shaping for the **live** registry: `{ name: shaping }`.
 *
 * Built by iterating the registry rather than exporting the raw table, so a
 * style registered at runtime is covered too, and a style missing from the
 * table is reported by the validator below instead of silently defaulting.
 *
 * @returns {Record<string, object>}
 */
export function shapingForRegistry() {
  const out = {};
  for (const s of getAllStyles()) out[s.name] = resolveShaping(s.name);
  return out;
}

/**
 * Validate the shaping table against the live registry + the frozen vocabulary.
 *
 * @returns {{ok: boolean, errors: string[]}}
 */
export function validateShaping() {
  const errors = [];
  const missing = unshapedStyles();
  if (missing.length) errors.push(`styles missing from SHAPING_TABLE: ${missing.join(', ')}`);

  for (const s of getAllStyles()) {
    const sh = resolveShaping(s.name);
    for (const f of SHAPING_FIELDS) {
      const v = sh[f.key];
      if (f.type === 'number' && !(typeof v === 'number' && Number.isFinite(v) && v >= f.min)) {
        errors.push(`${s.name}.${f.key} must be a number >= ${f.min}, got ${v}`);
      }
      if (f.type === 'string' && typeof v !== 'string') {
        errors.push(`${s.name}.${f.key} must be a string, got ${v}`);
      }
    }
    if (sh.maxSize < sh.minSize) {
      errors.push(`${s.name}: maxSize ${sh.maxSize} < minSize ${sh.minSize}`);
    }
    if (sh.regionFill > 1) errors.push(`${s.name}: regionFill ${sh.regionFill} > 1`);
    if (!isR4OrderMode(sh.order)) {
      errors.push(`${s.name}.order "${sh.order}" is not an R4 order mode`);
    }
    if (!Object.prototype.hasOwnProperty.call(STYLE_CATEGORIES, s.category)) {
      errors.push(`${s.name}: category "${s.category}" missing from STYLE_CATEGORIES`);
    }
  }
  return { ok: errors.length === 0, errors };
}

/**
 * What the optimiser should use for a style, given an explicit override.
 *
 * An explicit override wins (the S4/S5 precedent); absent → the style's own
 * shaping; unknown style → documented defaults. Never mutates either input.
 *
 * @param {string} styleName
 * @param {object} [override] - any subset of the shaping fields
 * @returns {{source: string, shaping: object}}
 */
export function resolveEffectiveShaping(styleName, override = null) {
  const base = resolveShaping(styleName);
  if (!override || typeof override !== 'object') return { source: 'table', shaping: { ...base } };
  const shaping = { ...base };
  for (const f of SHAPING_FIELDS) {
    if (override[f.key] !== undefined) shaping[f.key] = override[f.key];
  }
  return { source: 'override', shaping };
}

/* ─── Outlines ──────────────────────────────────────────────────────────── */

/**
 * A high percentile of an edge field — the "peak" for the relative threshold.
 *
 * Re-exported from `outlines.js` so a caller can report the threshold a plan
 * actually used without a second implementation that could drift.
 *
 * @param {Float32Array|Array<number>} edges
 * @param {number} percentile - 0..1
 * @returns {number}
 */
export { percentilePeak };

/**
 * Plan an outline lay-in from an `analyzeImage()` result, WITHOUT painting.
 *
 * Converts the extracted polylines into a paint-order plan: the longest,
 * strongest contours first (the classical *draw the contours before the
 * masses* step), capped by budget.
 *
 * @param {object} analysis - `analyzeImage()` result (`edges`, `width`, `height`)
 * @param {object} [options] - `OUTLINE_DEFAULTS` plus `{ budget }`
 * @returns {{
 *   mode: string, count: number, skipped: number, budget: number,
 *   threshold: number, peak: number,
 *   outlines: Array<{index:number, length:number, strength:number, points:number}>,
 *   points: Array<Array<[number, number]>>
 * }}
 */
export function planOutlines(analysis, options = {}) {
  const o = { ...OUTLINE_DEFAULTS, ...options };
  const budget = Number.isFinite(o.budget) ? Math.max(0, o.budget | 0) : Infinity;

  // `mode` is carried for reporting only — the extractor's defaults are the
  // OUTLINE_DEFAULTS contract. Defaulting it to `'off'` here would silently
  // turn a requested `first` lay-in into no lay-in at all.
  const mode = o.mode === undefined ? 'first' : o.mode;

  // A missing/empty analysis is an empty plan, not a throw: `buildR4Plan` calls
  // this only when an analysis exists, but the seam is a public API and a
  // caller must be able to ask "what would the outlines be?" without guarding.
  // `analysis.edges` is a TYPED ARRAY (Float32Array from `analyzeImage`), so the
  // check must be length-based — `Array.isArray` would reject every real
  // analysis and silently return an empty plan.
  const hasEdges = Array.isArray(analysis?.edges)
    || (analysis?.edges && typeof analysis.edges.length === 'number' && analysis.edges.length > 0);
  if (!analysis || !hasEdges || !(analysis.width > 0) || !(analysis.height > 0)) {
    return { mode, count: 0, skipped: 0, budget, outlines: [], points: [] };
  }

  const res = extractOutlines(analysis, o);
  const all = Array.isArray(res.outlines) ? res.outlines : [];
  const used = budget === Infinity ? all : all.slice(0, budget);
  // The effective cut and the scale it was derived from. With the shipped
  // absolute threshold the cut IS the requested threshold and the scale is 1;
  // the fields exist so a plan is self-describing if a derived cut is ever
  // introduced, without a second code path today.
  const resolved = { threshold: o.threshold, peak: 1 };
  return {
    mode,
    count: used.length,
    skipped: all.length - used.length,
    budget,
    threshold: resolved.threshold,
    peak: resolved.peak,
    outlines: used.map((ol, i) => ({
      index: i,
      length: Array.isArray(ol.points) ? ol.points.length : 0,
      strength: typeof ol.strength === 'number' ? ol.strength : 0,
      points: Array.isArray(ol.points) ? ol.points.length : 0,
    })),
    points: used.map(ol => (Array.isArray(ol.points) ? ol.points.slice() : [])),
  };
}

/**
 * Map the legacy app's outline setting onto an R4 mode.
 *
 * The legacy painter's `off | first | last` is a *timing* knob; R4's
 * `off | first | last` is the same idea over the extracted contours, so the
 * mapping is identity for the two live values and everything else is `off`.
 *
 * @param {string} legacy - `'off' | 'first' | 'last'` (app) or `'off' | 'on' | 'edges'` (profile)
 * @returns {'off'|'first'|'last'}
 */
export function outlineModeFromLegacy(legacy) {
  if (legacy === 'first' || legacy === 'edges') return 'first';
  if (legacy === 'last') return 'last';
  return 'off';
}

/**
 * Does an outline mode actually lay strokes?
 * @param {string} mode
 * @returns {boolean}
 */
export function isOutlineActive(mode) {
  return OUTLINE_MODES.includes(mode) && mode !== 'off';
}

/* ─── Aggregate ─────────────────────────────────────────────────────────── */

/**
 * The whole R4 plan for one (style, image, options) triple.
 *
 * This is the ONE call the BE spine should make. It is pure and total: no
 * option is dropped, no key is invented, and every field is either data copied
 * from the three Mac modules or a documented default.
 *
 * @param {object} args
 * @param {string} [args.style] - registry style name
 * @param {object} [args.analysis] - `analyzeImage()` result (needed for outlines)
 * @param {Array<object>} [args.shapes] - shape list (needed for ordering)
 * @param {string} [args.order] - desired paint-order mode
 * @param {string} [args.outline] - `'off' | 'first' | 'last'`
 * @param {object} [args.shapingOverride] - per-call shaping override
 * @param {object} [args.outlineOptions] - forwarded to `planOutlines`
 * @returns {object} the frozen R4 plan
 */
export function buildR4Plan(args = {}) {
  const style = typeof args.style === 'string' ? args.style : 'pencil';
  const shaping = resolveEffectiveShaping(style, args.shapingOverride);
  const orderMode = typeof args.order === 'string' ? args.order : shaping.shaping.order;
  const order = planOrder(args.shapes || [], orderMode, {
    width: args.analysis?.width,
    height: args.analysis?.height,
  });
  // The caller speaks either vocabulary: the app/profile's legacy setting OR an
  // R4 mode. `outlineModeFromLegacy` is total (anything unrecognised ⇒ `off`),
  // but it must not be fed an already-R4 mode and lose it, so an explicit R4
  // mode is honoured first. This was a real defect: `buildR4Plan({outline:
  // 'first'})` returned `off` because the value was run through the legacy
  // mapper, which only knows `first`/`edges` by coincidence and `last` by
  // identity — any future R4 mode would have been silently dropped.
  const requested = args.outline === undefined || args.outline === null ? 'off' : args.outline;
  const outlineMode = OUTLINE_MODES.includes(requested)
    ? requested
    : outlineModeFromLegacy(requested);
  const outline = args.analysis && isOutlineActive(outlineMode)
    ? planOutlines(args.analysis, { ...(args.outlineOptions || {}), mode: outlineMode })
    : {
      mode: outlineMode, count: 0, skipped: 0, budget: 0, outlines: [], points: [],
      threshold: args.outlineOptions?.threshold ?? OUTLINE_DEFAULTS.threshold, peak: 1,
    };

  return {
    style,
    shaping: shaping.shaping,
    shapingSource: shaping.source,
    order: { mode: order.mode, native: order.native, changed: order.changed, centre: order.centre },
    outline: {
      mode: outline.mode, count: outline.count, skipped: outline.skipped, budget: outline.budget,
      // The effective cut and the scale it was derived from. A plan that uses a
      // derived threshold must report it, or the result is not reproducible from
      // the plan alone.
      threshold: outline.threshold, peak: outline.peak,
    },
    outlines: outline.outlines,
    outlinePoints: outline.points,
  };
}

/**
 * Styles registered but absent from the shaping table.
 * @returns {string[]}
 */
export function shapingCoverageGaps() {
  return unshapedStyles();
}

export default {
  OUTLINE_MODES, ORDER_EXTENSIONS, R4_ORDER_MODES, UNKNOWN_ORDER_FALLBACK, SHAPING_FIELDS,
  isNativeOrderMode, isR4OrderMode, planOrder, resolveCentre,
  shapingForRegistry, validateShaping, resolveEffectiveShaping,
  planOutlines, outlineModeFromLegacy, isOutlineActive,
  buildR4Plan, shapingCoverageGaps,
  SHAPING_DEFAULTS, SHAPING_TABLE, STYLE_CATEGORIES,
  ORDER_MODES, ORDER_DEFAULTS, OUTLINE_DEFAULTS,
  extractOutlines, orderShapes, resolveShaping,
};
