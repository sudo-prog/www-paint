/**
 * brush-stamp-engine.js — Wraps vendored p5.brush for the auto-paint pipeline.
 *
 * Initializes p5.brush in standalone 2D mode on an offscreen canvas, then
 * stamps strokes using the real brush pressure/grain/scatter engine.
 *
 * ─── API note (2026-11-11 rewrite) ────────────────────────────────────────
 * The vendored `js/vendor/brush.esm.js` is the **modern p5.brush build**. Its
 * public surface is the drawing API — `initStandaloneRuntime`, `load`, `set`,
 * `add`, `seed`, `line`, `moveTo`, `stroke`, `hatch`, `wash`, `fill`, `mass`,
 * `field` — NOT the old internal runtime hooks this module previously called
 * (`brush.h(...)`, `brush.f(...)`, `brush.u = {...}`, `brush.b = {...}`).
 *
 * Those old calls threw `TypeError: brush.h is not a function`, so
 * `initBrushEngine()` always failed, `_ready` stayed false, and every style
 * silently used its canvas fallback. The enhanced path has effectively never
 * run. This rewrite targets the real API:
 *
 *   initStandaloneRuntime()   register the runtime callbacks + adapter
 *   load(canvas)              bind the offscreen target
 *   add(name, params)         register/extend a brush tip
 *   set(name, color, weight)  select tip + colour + weight
 *   moveTo/line/stroke        draw a mark
 *   seed(n)                   deterministic RNG
 *
 * Usage:
 *   import { initBrushEngine, stampStrokeSync, isBrushReady } from './brush-stamp-engine.js';
 *   await initBrushEngine(width, height);
 *   // In style renderers:
 *   stampStrokeSync(ctx, shape, { brushName: 'cpencil', color: [180,120,80], ... });
 *
 * @module brush-stamp-engine
 */

// ── lazy-loaded p5.brush API ─────────────────────────────────────────────
let _brush = null;
let _ready = false;
let _loadFailed = false;
let _lastError = null;

async function _loadBrush() {
  if (_brush) return _brush;
  if (_loadFailed) return null;
  try {
    _brush = await import('../vendor/brush.esm.js');
  } catch (err) {
    _brush = null;
    _loadFailed = true;
  }
  return _brush;
}

// ── offscreen canvas state ────────────────────────────────────────────────
let _offscreen = null;
let _offCtx = null;
let _width = 0;
let _height = 0;

/** Brush tips we register/override on top of the vendor defaults. */
const BRUSH_DEFAULTS = {
  cpencil: { weight: 0.35, scatter: 0.55, sharpness: 0.8, grain: 0.7, spacing: 0.1 },
  HB:      { weight: 0.3,  scatter: 0.6,  sharpness: 0.3, grain: 0.7, spacing: 0.1 },
  pen:     { weight: 0.3,  scatter: 0.15, sharpness: 0.9, grain: 0.7, spacing: 0.1 },
  charcoal:{ weight: 0.35, scatter: 1.5,  sharpness: 0.68, grain: 2, spacing: 0.03 },
  pastel:  { weight: 0.7,  scatter: 5,    sharpness: 0.91, grain: 1, spacing: 0.085 / 3 },
  marker:  { weight: 2,    scatter: 0.2,  sharpness: 1,    grain: 1, spacing: 0.03 },
  spray:   { weight: 0.2,  scatter: 6,    sharpness: 15,   grain: 40, spacing: 0.5 },
  round:   { weight: 0.5,  scatter: 0.5,  sharpness: 0.4,  grain: 0.3, spacing: 0.15 },
  flat:    { weight: 0.5,  scatter: 0.3,  sharpness: 0.6,  grain: 0.2, spacing: 0.15 },
};

/**
 * Tips to register via `brush.add()` at init. Empty by default: every tip we
 * need is already shipped by the vendor, and re-adding one clobbers its param
 * object (see the warning in initBrushEngine). Add an entry only for a tip the
 * vendor does not provide, and always include `type: 'default'`.
 */
const BRUSH_OVERRIDES = [];

/**
 * Initialize p5.brush standalone runtime.
 *
 * Returns true when the enhanced path is usable. Never throws — a failure
 * leaves `_ready` false so callers fall back to their canvas renderers.
 *
 * **WebGL2 is required.** The vendored build's `load(target)` calls
 * `target.getContext('webgl2', { preserveDrawingBuffer: true })` and throws if
 * the canvas cannot provide one. The target canvas must never have been touched
 * with `getContext('2d')` first — a canvas can only hand out one context type,
 * and a 2D context makes the WebGL2 request fail permanently.
 *
 * The mark is composited back onto the caller's 2D canvas with `drawImage`,
 * the same pattern `js/engine/relief.js` uses.
 *
 * @param {number} width
 * @param {number} height
 * @returns {Promise<boolean>}
 */
export async function initBrushEngine(width, height) {
  _width = width;
  _height = height;

  const brush = await _loadBrush();
  if (!brush) {
    _ready = false;
    return false;
  }

  // A dedicated WebGL2 canvas. Do NOT getContext('2d') on this element.
  if (typeof OffscreenCanvas !== 'undefined') {
    _offscreen = new OffscreenCanvas(width, height);
  } else if (typeof document !== 'undefined') {
    _offscreen = document.createElement('canvas');
    _offscreen.width = width;
    _offscreen.height = height;
  }
  if (!_offscreen) {
    _ready = false;
    return false;
  }

  // Verify a WebGL2 context is obtainable before handing the canvas over.
  let probeCtx = null;
  try {
    probeCtx = _offscreen.getContext('webgl2', { preserveDrawingBuffer: true });
  } catch (e) {
    probeCtx = null;
  }
  if (!probeCtx) {
    _ready = false;
    return false;
  }
  _offCtx = probeCtx;

  try {
    // 1. Register the standalone runtime (callbacks + target adapter).
    if (typeof brush.initStandaloneRuntime === 'function') {
      brush.initStandaloneRuntime();
    }

    // 2. Bind the offscreen canvas as the draw target.
    if (typeof brush.load === 'function') {
      brush.load(_offscreen);
    }

    // 3. Register brush-tip overrides.
    //    ⚠ Do NOT call brush.add() for a tip the vendor already ships.
    //    `add(name, params)` overwrites the tip's registered param object, and
    //    a param without a `type` field makes every subsequent stroke throw
    //    "Cannot read properties of undefined (reading 'type')". The vendor
    //    does not export a brush list, so there is no safe way to detect which
    //    tips are built in — the only safe policy is to leave them alone.
    //    Tips we genuinely add (none today) must include `type: 'default'`.
    if (typeof brush.add === 'function' && BRUSH_OVERRIDES.length > 0) {
      for (const { name, params } of BRUSH_OVERRIDES) {
        try {
          brush.add(name, { type: 'default', ...params });
        } catch (e) { /* tip already registered — leave the vendor default */ }
      }
    }

    _ready = true;
    return true;
  } catch (e) {
    // Any failure means the enhanced path is unavailable — fall back.
    _ready = false;
    return false;
  }
}

/**
 * Resize the offscreen buffer.
 * @param {number} width
 * @param {number} height
 * @returns {Promise<boolean>}
 */
export function resizeBrushEngine(width, height) {
  if (!_offscreen) return false;
  _width = width;
  _height = height;
  _offscreen.width = width;
  _offscreen.height = height;
  if (_offCtx) {
    _offCtx.setTransform(1, 0, 0, 1, 0, 0);
    _offCtx.clearRect(0, 0, width, height);
  }
  return initBrushEngine(width, height);
}

/** True when the enhanced p5.brush path is available. */
export function isBrushReady() {
  return _ready && !!_brush;
}

/** Reason the last stampStrokeSync returned false, for diagnostics. */
export function lastStampError() {
  return _lastError || null;
}

/**
 * Convert an internal shape to a normalized colour for p5.brush.
 * @param {Array<number>|string} color
 * @returns {Array<number>}
 */
function _normColor(color) {
  if (Array.isArray(color)) {
    return [
      Math.max(0, Math.min(255, Math.round(color[0] || 0))),
      Math.max(0, Math.min(255, Math.round(color[1] || 0))),
      Math.max(0, Math.min(255, Math.round(color[2] || 0))),
    ];
  }
  return [0, 0, 0];
}

/**
 * Draw a quadratic bezier stroke into the offscreen buffer.
 */
function _strokeBezier(brush, a, progress) {
  const x0 = a[0], y0 = a[1], x1 = a[2], y1 = a[3], x2 = a[4], y2 = a[5];
  const steps = 50;
  const upto = Math.max(1, Math.floor(steps * progress));

  // The modern API: beginStroke(type, curvature, ...) then move()/line().
  if (typeof brush.beginStroke === 'function') brush.beginStroke('curve', 0, 1);
  if (typeof brush.move === 'function') brush.move(x0, y0);
  for (let i = 1; i <= upto; i++) {
    const t = i / steps;
    const mt = 1 - t;
    const x = mt * mt * x0 + 2 * mt * t * x1 + t * t * x2;
    const y = mt * mt * y0 + 2 * mt * t * y1 + t * t * y2;
    brush.line(x, y);
  }
  if (typeof brush.endStroke === 'function') brush.endStroke();
  _flush(brush);
}

/**
 * Fill an area shape with hatch lines into the offscreen buffer.
 */
function _fillArea(brush, shape) {
  const poly = _shapePoly(shape);
  if (!poly || poly.length < 3) return;

  const bbox = _bbox(poly);
  const gap = Math.max(1.5, Math.min(bbox.w, bbox.h) * 0.03);
  const angle = -0.95;

  try {
    if (typeof brush.hatch === 'function') {
      brush.hatch(gap, angle, { rand: true, continuous: false });
    }
    const lines = _scanPoly(poly, gap);
    for (const [sx, sy, ex, ey] of lines) {
      if (typeof brush.beginStroke === 'function') brush.beginStroke('segments', 0, 1);
      if (typeof brush.move === 'function') brush.move(sx, sy);
      brush.line(ex, ey);
      if (typeof brush.endStroke === 'function') brush.endStroke();
    }
    if (typeof brush.noHatch === 'function') brush.noHatch();
    _flush(brush);
  } catch (e) {
    // Hatch unsupported for this tip — leave the core stroke only.
  }
}

/** Ask p5.brush to composite its mask onto the target canvas. */
function _flush(brush) {
  if (typeof brush.render === 'function') {
    try { brush.render(); } catch (e) { /* best effort */ }
  }
}

/**
 * Stamp a stroke shape onto `mainCtx` using p5.brush.
 *
 * Synchronous: the Renderer draws shapes synchronously, so the module must be
 * already initialised (`await initBrushEngine(...)` at app start). When it is
 * not, returns false and the caller uses its own canvas renderer.
 *
 * @param {CanvasRenderingContext2D} mainCtx
 * @param {object} shape - {type, params, color0, color1, alpha, seed}
 * @param {object} [opts] - brush overrides
 * @returns {boolean} true if p5.brush stamped, false if the caller should fall back
 */
export function stampStrokeSync(mainCtx, shape, opts = {}) {
  if (!isBrushReady()) return false;

  const brush = _brush;
  const a = shape.params || [];
  const brushName = opts.brushName || shape.brushName || 'cpencil';
  const colorArr = Array.isArray(shape.color)
    ? shape.color
    : (Array.isArray(shape.color0) ? shape.color0 : [0, 0, 0]);
  const alpha = shape.alpha ?? opts.alpha ?? 1;
  // opts.size may arrive as a scalar or as a {min,max,default} schema object.
  const sizeOpt = opts.size;
  const sizeDefault = sizeOpt && typeof sizeOpt === 'object'
    ? (sizeOpt.default ?? sizeOpt.max ?? 10)
    : sizeOpt;
  const size = Math.max(1.5, Math.min(40, a[6] || sizeDefault || 10));
  const progress = opts.progress ?? 1;

  const color = _normColor(colorArr);

  // Clear the offscreen target.
  // ⚠ Do NOT call brush.clear() here: the vendored build's clear() paints the
  //   whole target opaque (it is a canvas background, not a transparent wipe),
  //   which then covers the caller's canvas when we drawImage() it. Wiping the
  //   GL backbuffer directly keeps the target transparent.
  try {
    _offCtx.setTransform(1, 0, 0, 1, 0, 0);
    _offCtx.clearColor(0, 0, 0, 0);
    _offCtx.clear(_offCtx.COLOR_BUFFER_BIT);
  } catch (e) {
    try { _offCtx.clearRect(0, 0, _width, _height); } catch (e2) { /* best effort */ }
  }

  try {
    // Select the tip + colour + weight. `set` is the modern API.
    if (typeof brush.set === 'function') {
      brush.set(brushName, color, size);
    } else if (typeof brush.stroke === 'function') {
      // Older fallback: stroke(color, weight) + pick(brushName)
      brush.stroke(color, size);
    }

    // Optional deterministic seed for reproducible stamps.
    if (opts.seed !== undefined && typeof brush.seed === 'function') {
      try { brush.seed(opts.seed); } catch (e) { /* optional */ }
    }

    if (shape.type === 'S') {
      _strokeBezier(brush, a, progress);
    } else {
      _fillArea(brush, shape);
    }
  } catch (e) {
    // Stamp failed — report so the caller can fall back.
    _lastError = e;
    return false;
  }

  // Composite the offscreen mark onto the caller's canvas.
  mainCtx.save();
  mainCtx.globalAlpha = alpha;
  mainCtx.drawImage(_offscreen, 0, 0);
  mainCtx.restore();

  return true;
}

/**
 * Async variant of stampStrokeSync, for callers that can await.
 * @param {CanvasRenderingContext2D} mainCtx
 * @param {object} shape
 * @param {object} [opts]
 * @returns {Promise<boolean>}
 */
export async function stampStroke(mainCtx, shape, opts = {}) {
  await _loadBrush();
  return stampStrokeSync(mainCtx, shape, opts);
}

/* ── shape → polygon helpers ──────────────────────────────────────────── */

function _shapePoly(shape) {
  const t = shape.type;
  const a = shape.params;
  if (!a) return [];
  if (t === 'S') return [[a[0], a[1]], [a[4], a[5]], [a[2], a[3]]];
  if (t === 'E') {
    const [cx, cy, rx, ry] = [a[0], a[1], a[2], a[3]];
    const pts = [];
    for (let i = 0; i < 24; i++) {
      const th = (i / 24) * Math.PI * 2;
      pts.push([cx + Math.cos(th) * rx, cy + Math.sin(th) * ry]);
    }
    return pts;
  }
  if (t === 'R') {
    const [x, y, w, h, rot] = [a[0], a[1], a[2], a[3], a[4] || 0];
    const c = Math.cos(rot), s = Math.sin(rot);
    const corners = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]];
    return corners.map(([px, py]) => [x + px * c - py * s, y + px * s + py * c]);
  }
  if (t === 'T') return [[a[0], a[1]], [a[2], a[3]], [a[4], a[5]]];
  if (t === 'B') {
    const [cx, cy, rx, ry, feather] = [a[0], a[1], a[2], a[3], a[4] || 0];
    const pts = [];
    for (let i = 0; i < 24; i++) {
      const th = (i / 24) * Math.PI * 2;
      const wobble = 1 + Math.sin(th * 3) * feather * 0.3;
      pts.push([cx + Math.cos(th) * rx * wobble, cy + Math.sin(th) * ry * wobble]);
    }
    return pts;
  }
  return [];
}

function _bbox(poly) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of poly) {
    if (x < x0) x0 = x; if (y < y0) y0 = y;
    if (x > x1) x1 = x; if (y > y1) y1 = y;
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}

function _scanPoly(poly, gap) {
  const lines = [];
  let minY = Infinity, maxY = -Infinity;
  for (const p of poly) {
    if (p[1] < minY) minY = p[1];
    if (p[1] > maxY) maxY = p[1];
  }
  for (let y = Math.floor(minY); y <= Math.ceil(maxY); y += gap) {
    const xs = [];
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > y) !== (yj > y)) {
        xs.push(xj + (y - yj) * (xi - xj) / (yi - yj));
      }
    }
    if (xs.length >= 2) {
      xs.sort((p, q) => p - q);
      for (let k = 0; k < xs.length - 1; k += 2) {
        lines.push([xs[k], y, xs[k + 1], y]);
      }
    }
  }
  return lines;
}

export default {
  initBrushEngine,
  resizeBrushEngine,
  stampStroke,
  stampStrokeSync,
  isBrushReady,
  BRUSH_DEFAULTS,
};
