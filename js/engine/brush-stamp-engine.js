/**
 * brush-stamp-engine.js — Wraps vendored p5.brush for the auto-paint pipeline.
 *
 * Initializes p5.brush in standalone 2D mode on an offscreen canvas,
 * then stamps strokes using the real brush pressure/grain/scatter engine.
 *
 * Usage:
 *   import { initBrushEngine, stampStroke, isBrushReady } from './brush-stamp-engine.js';
 *   initBrushEngine(width, height);
 *   // In style renderers:
 *   stampStroke(ctx, shape, { brushName: 'cpencil', color: [180,120,80], ... });
 */

import { rgbToHex } from '../styles/base.js';

// ── lazy-loaded p5.brush API ─────────────────────────────────────────────
let _brush = null;
let _ready = false;

async function _loadBrush() {
  if (_brush) return _brush;
  try {
    _brush = await import('../vendor/brush.esm.js');
  } catch (err) {
    _brush = null;
  }
  return _brush;
}

// ── offscreen canvas state ────────────────────────────────────────────────
let _offscreen = null;
let _offCtx = null;
let _adapter = null;
let _width = 0;
let _height = 0;

/**
 * Initialize p5.brush standalone runtime.
 * @param {number} width
 * @param {number} height
 */
export async function initBrushEngine(width, height) {
  _width = width;
  _height = height;

  const brush = await _loadBrush();
  if (!brush) {
    _ready = false;
    return false;
  }

  // Create offscreen canvas for p5.brush to render into
  if (typeof OffscreenCanvas !== 'undefined') {
    _offscreen = new OffscreenCanvas(width, height);
  } else {
    _offscreen = document.createElement('canvas');
    _offscreen.width = width;
    _offscreen.height = height;
  }
  _offCtx = _offscreen.getContext('2d');
  if (!_offCtx) {
    console.warn('[brush] cannot get 2d context from offscreen canvas');
    _ready = false;
    return false;
  }

  // Build runtime adapter — this is the bridge p5.brush needs
  _adapter = _makeAdapter(brush, _offCtx, width, height);

  // Register runtime callbacks with p5.brush
  brush.h({
    createColor: _adapter.createColor,
    getAffineMatrix: _adapter.getAffineMatrix,
    notifyDraw: _adapter.notifyDraw,
    usesRadians: false,
    fromDegrees: d => d,
  });

  // Provide config
  brush.f({ Cwidth: width, Cheight: height, Density: 1 });

  // Replace stub runtime/compositor with our implementations
  brush.u = {
    load: () => {},
    syncDensity: () => _adapter.Density,
    isCanvasReady: () => true,
    instance: (opts = {}) => _adapter.instance(opts),
    activateInstance: inst => _adapter.activateInstance(inst),
    deactivateInstance: () => _adapter.deactivateInstance(),
    getActiveFramebuffer: () => null,
    isFramebufferTarget: () => false,
  };

  brush.b = {
    clearTarget: () => {},
    ensureBlendShaderProgram: () => {},
    ensureBlendSourceFramebuffer: () => ({}),
    createFramebuffer: (w, h) => _makeFbo(_offCtx, w, h),
    runBlendShaderPass: () => {},
    blitSourceToFramebuffer: () => {},
  };

  // Initialize standalone runtime
  try {
    brush.load(_offscreen);
  } catch (e) {
    // Some builds expect load(canvas, density)
    try { brush.load(_offscreen, 1); } catch (e2) {
      console.warn('[brush] standalone load failed, continuing without init:', e2.message);
    }
  }

  _ready = true;
  return true;
}

/**
 * Resize the offscreen buffer.
 */
export function resizeBrushEngine(width, height) {
  if (!_offscreen) return;
  _width = width;
  _height = height;
  _offscreen.width = width;
  _offscreen.height = height;
  if (_offCtx) {
    _offCtx.setTransform(1, 0, 0, 1, 0, 0);
    _offCtx.clearRect(0, 0, width, height);
  }
  // Re-init with new dimensions
  return initBrushEngine(width, height);
}

/**
 * Stamp a stroke shape onto `mainCtx` using p5.brush.
 * Falls back to the caller's renderer if p5.brush isn't loaded.
 *
 * @param {CanvasRenderingContext2D} mainCtx
 * @param {object} shape - {type, params, seed, color, alpha, brushName}
 * @param {object} opts - brush overrides
 * @returns {boolean} true if p5.brush was used, false if fallback
 */
export async function stampStroke(mainCtx, shape, opts = {}) {
  const brush = await _loadBrush();
  if (!brush || !_ready || !_adapter) {
    return false; // caller must fall back to custom stamping
  }

  const a = shape.params || [];
  const brushName = opts.brushName || shape.brushName || 'cpencil';
  const colorArr = Array.isArray(shape.color) ? shape.color : [0, 0, 0];
  const alpha = shape.alpha ?? opts.alpha ?? 1;
  const size = Math.max(1.5, Math.min(40, a[6] || opts.size || 10));

  // Create brush color via p5.brush adapter
  const brushColor = _adapter.createColor(
    clamp255(colorArr[0]),
    clamp255(colorArr[1]),
    clamp255(colorArr[2]),
    alpha
  );

  // Clear offscreen
  _offCtx.setTransform(1, 0, 0, 1, 0, 0);
  _offCtx.clearRect(0, 0, _width, _height);

  // Create and activate a brush instance
  const inst = brush.instance({
    brushName,
    color: brushColor,
    size,
    opacity: alpha,
    angle: opts.angle || 0,
    scatter: opts.scatter ?? 0.4,
    spacing: opts.spacing ?? 0.15,
    grain: opts.grain ?? 0.25,
    pressure: opts.pressure || { curve: [0.15, 0.2], min_max: [0.6, 1.05] },
  });
  brush.activateInstance(inst);
  _adapter._active = inst;

  try {
    if (shape.type === 'S') {
      _stampBezierStroke(brush, a, opts.progress || 1);
    } else {
      // For area shapes, try hatch fill
      _stampAreaFill(brush, shape, brushColor, alpha);
    }
  } catch (e) {
    console.warn('[brush] stamp error, falling back:', e.message);
    return false;
  } finally {
    brush.deactivateInstance();
    _adapter._active = null;
  }

  // Composite onto main canvas
  mainCtx.save();
  mainCtx.globalAlpha = alpha;
  mainCtx.drawImage(_offscreen, 0, 0);
  mainCtx.restore();

  return true;
}

/**
 * Walk a quadratic bezier and stamp along it.
 */
function _stampBezierStroke(brush, a, progress) {
  const [x0, y0, x1, y1, x2, y2] = [a[0], a[1], a[2], a[3], a[4], a[5]];
  const steps = 50;

  brush.moveTo(x0, y0);

  for (let i = 1; i <= Math.floor(steps * progress); i++) {
    const t = i / steps;
    const mt = 1 - t;
    const x = mt * mt * x0 + 2 * mt * t * x1 + t * t * x2;
    const y = mt * mt * y0 + 2 * mt * t * y1 + t * t * y2;
    brush.line(x, y);
  }

  brush.endStroke();
}

/**
 * Fill area shapes using p5.brush's hatch system.
 */
function _stampAreaFill(brush, shape, color, alpha) {
  try {
    if (typeof brush.hatch !== 'function' || typeof brush.hatchStyle !== 'function') return;

    const poly = _shapePoly(shape);
    if (!poly || poly.length < 3) return;

    const bbox = _bbox(poly);
    const gap = Math.max(1.5, Math.min(bbox.w, bbox.h) * 0.03);

    brush.hatchStyle('cpencil', color, 3);
    brush.hatch(gap, -0.95, { rand: true, continuous: false });

    // Generate horizontal scanlines through the polygon
    const lines = _scanPoly(poly, gap);
    for (const [x1, y1, x2, y2] of lines) {
      brush.moveTo(x1, y1);
      brush.lineTo(x2, y2);
      brush.endStroke();
    }

    brush.noHatch();
  } catch (e) {
    // Silently fail — caller handles fallback
  }
}

/**
 * Convert shape to polygon vertex array.
 */
function _shapePoly(shape) {
  const t = shape.type;
  const a = shape.params;
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
    const corners = [[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]];
    return corners.map(([px,py]) => [x + px*c - py*s, y + px*s + py*c]);
  }
  if (t === 'T') return [[a[0],a[1]], [a[2],a[3]], [a[4],a[5]]];
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
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, cx: (x0+x1)/2, cy: (y0+y1)/2 };
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
      xs.sort((a, b) => a - b);
      for (let k = 0; k < xs.length - 1; k += 2) {
        lines.push([xs[k], y, xs[k + 1], y]);
      }
    }
  }
  return lines;
}

function clamp255(v) {
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
}

// ── Runtime adapter factory ───────────────────────────────────────────────
function _makeAdapter(brush, ctx, width, height) {
  let activeInstance = null;

  function createColor(r, g, b, a = 1) {
    return { r: r/255, g: g/255, b: b/255, a };
  }
  function getAffineMatrix() {
    return { a: 1, b: 0, c: 0, d: 1, x: 0, y: 0 };
  }
  function notifyDraw() { /* no-op for 2D pipeline */ }
  function instance(opts = {}) {
    return {
      canvas: _offscreen,
      ctx: ctx,
      width, height,
      brushName: opts.brushName || 'cpencil',
      color: opts.color,
      size: opts.size || 10,
      opacity: opts.opacity ?? 1,
      angle: opts.angle || 0,
      scatter: opts.scatter || 0,
      spacing: opts.spacing || 0.2,
      pressure: opts.pressure || [],
      grain: opts.grain || 0,
      _x: 0, _y: 0,
      _step: 0, _total: 0,
    };
  }
  function activateInstance(inst) { activeInstance = inst; }
  function deactivateInstance() { activeInstance = null; }
  function makeFbo(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  return {
    createColor, getAffineMatrix, notifyDraw,
    Density: 1,
    instance, activateInstance, deactivateInstance,
    _active: null,
  };
}

/**
 * Synchronous version of stampStroke — used by style renderers that run
 * in a sync call chain (the Renderer draws shapes synchronously).
 *
 * When p5.brush is NOT ready, returns false immediately so the caller
 * can fall back to its custom renderer. When the brush IS ready, the
 * module is already loaded (initBrushEngine was called) so we can
 * stamp without awaiting.
 *
 * @param {CanvasRenderingContext2D} mainCtx
 * @param {object} shape
 * @param {object} opts
 * @returns {boolean} true if p5.brush stamped, false if fallback needed
 */
export function stampStrokeSync(mainCtx, shape, opts = {}) {
  if (!_ready || !_adapter || !_brush) {
    return false;
  }

  const a = shape.params || [];
  const brushName = opts.brushName || shape.brushName || 'cpencil';
  const colorArr = Array.isArray(shape.color)
    ? shape.color
    : (shape.color0 && Array.isArray(shape.color0) ? shape.color0 : [0, 0, 0]);
  const alpha = shape.alpha ?? opts.alpha ?? 1;
  const size = Math.max(1.5, Math.min(40, a[6] || opts.size || 10));

  const brushColor = _adapter.createColor(
    clamp255(colorArr[0]),
    clamp255(colorArr[1]),
    clamp255(colorArr[2]),
    alpha
  );

  // Clear offscreen
  _offCtx.setTransform(1, 0, 0, 1, 0, 0);
  _offCtx.clearRect(0, 0, _width, _height);

  // Create and activate a brush instance
  const inst = _brush.instance({
    brushName,
    color: brushColor,
    size,
    opacity: alpha,
    angle: opts.angle || 0,
    scatter: opts.scatter ?? 0.4,
    spacing: opts.spacing ?? 0.15,
    grain: opts.grain ?? 0.25,
    pressure: opts.pressure || { curve: [0.15, 0.2], min_max: [0.6, 1.05] },
  });
  _brush.activateInstance(inst);
  _adapter._active = inst;

  try {
    if (shape.type === 'S') {
      _stampBezierStroke(_brush, a, opts.progress || 1);
    } else {
      _stampAreaFill(_brush, shape, brushColor, alpha);
    }
  } catch (e) {
    console.warn('[brush] stamp error, falling back:', e.message);
    return false;
  } finally {
    _brush.deactivateInstance();
    _adapter._active = null;
  }

  // Composite onto main canvas
  mainCtx.save();
  mainCtx.globalAlpha = alpha;
  mainCtx.drawImage(_offscreen, 0, 0);
  mainCtx.restore();

  return true;
}

export function isBrushReady() {
  return _ready;
}
