/**
 * Style-aware headless render backend (Track-S hygiene **H-S6**).
 *
 * The problem this file solves
 * ----------------------------
 * `score.js` used to render the modular engine's shape list with
 * `metrics.rasterizeShapes()` — an independent rasteriser that draws *plain
 * anti-aliased ellipses* and never reads a shape's `style`. So a pencil profile
 * and an ink profile scored **byte-identically**: the "style match" measured the
 * optimiser's stroke *geometry*, not the profile's style at all
 * (`docs/checkpoints/S3.md` §7, defect **B**; the blunt finding is that
 * `scoreProfileStyle` could only ever report a margin of +0.0027).
 *
 * This module adds the missing half: a render backend that pushes the same
 * shapes through the **real style registry** (`js/styles/index.js`) on a canvas,
 * so a shape's `style` actually changes the pixels — and therefore the score.
 *
 * Two layers, deliberately separated so the pure part stays `node`-testable:
 *
 *   - `toStyledShape` / `stampShapeStyles` — pure. Convert an engine-format
 *     shape (the optimiser's `[x,y,rx,ry,rot,rot,0,0]` ellipse) into the format
 *     the style modules read (colours at the tail of `params`), and stamp the
 *     profile's style name onto it. No canvas, no DOM.
 *   - `createStyleRasteriser` — the canvas half. Builds an `OffscreenCanvas`
 *     (or a `document` canvas), registers every style on a `Renderer`, draws the
 *     shapes through it, and returns an interleaved RGB `Float32Array` — the same
 *     shape of output as `rasterizeShapes`, so it is a drop-in backend for
 *     `scoreProfileStyle`.
 *
 * Fallback contract (the reason this is safe to enable by default):
 *   `createStyleRasteriser()` returns a function that **falls back to the plain
 *   `rasterizeShapes`** wherever no canvas can be created (plain `node`, a
 *   worker without `OffscreenCanvas`). Under `node` the score is therefore
 *   byte-identical to before — the style-aware path only ever engages where a
 *   canvas exists, which is exactly where a style *can* be rendered.
 *
 * No randomness of its own, no DOM at import time: importing this module under
 * `node` is safe (the 51 style modules import cleanly), only *calling* the
 * rasteriser needs a canvas.
 *
 * @module style-render
 */

import { Renderer } from './renderer.js';
import { getAllStyles } from '../styles/index.js';
import { aliasStyle } from './style-alias.js';
import { rasterizeShapes } from './metrics.js';

/** Defaults for {@link createStyleRasteriser}. */
export const STYLE_RENDER_DEFAULTS = Object.freeze({
  background: [255, 255, 255],
  /** The plain, style-agnostic rasteriser used where no canvas exists. */
  fallback: rasterizeShapes,
});

/**
 * Can a 2D canvas be created here? True in a browser / worker, false under
 * plain `node`.
 * @returns {boolean}
 */
export function isStyleRenderAvailable() {
  if (typeof OffscreenCanvas !== 'undefined') return true;
  return typeof document !== 'undefined' && typeof document.createElement === 'function';
}

function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }
  return null;
}

const cssRgb = (c) => `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`;

/**
 * Convert ONE engine-format shape into the form a style module reads — the same
 * layout `PaintingEngine._convertShape` produces. For `E`/`B`/`R` the colours
 * ride at `params[5]`, `params[6]`, `params[7]`; for `S`/`T` they are appended.
 * Geometry (`params[0..4]`) is never touched, so the plain rasteriser sees the
 * exact same geometry it always did.
 *
 * Returns a NEW shape (the input is never mutated).
 *
 * @param {object} shape engine-format shape
 * @param {string} [styleName] style to stamp (defaults to the shape's own)
 * @returns {object} a style-module-ready copy
 */
export function toStyledShape(shape, styleName) {
  if (!shape) return shape;
  const p = (shape.params || []).slice();
  const c0 = shape.color0 || [0, 0, 0];
  const c1 = shape.color1 || c0;
  const a = shape.alpha !== undefined ? shape.alpha : 1;
  if (shape.type === 'E' || shape.type === 'B' || shape.type === 'R') {
    p[5] = c0; p[6] = c1; p[7] = a;
  } else {
    p.push(c0, c1, a);
  }
  return { ...shape, params: p, style: styleName || shape.style };
}

/**
 * Pure: stamp every shape with `styleName`, returning a NEW list of NEW shapes.
 * An empty/absent `styleName` is a no-op (returns a shallow copy).
 *
 * @param {Array<object>} shapes
 * @param {string|undefined} styleName
 * @returns {Array<object>}
 */
export function stampShapeStyles(shapes, styleName) {
  const list = Array.isArray(shapes) ? shapes : [];
  if (!styleName) return list.slice();
  return list.map((s) => toStyledShape(s, styleName));
}

/**
 * Register every built-in style (and its Painter alias) onto a renderer, so
 * `renderer.drawShapeAt(shape)` dispatches on `shape.style` exactly as the app
 * does. Mirrors `PaintingEngine._registerAllStyles`.
 * @param {Renderer} renderer
 */
function registerAllStyles(renderer) {
  for (const { name, instance } of getAllStyles()) {
    renderer.registerStyle(name, { draw: (c, sh, pr) => instance.render(c, sh, pr) });
    const painterName = aliasStyle(name);
    if (painterName !== name) {
      renderer.registerStyle(painterName, { draw: (c, sh, pr) => instance.render(c, sh, pr) });
    }
  }
}

/**
 * Build a style-aware render backend with the same signature as
 * `metrics.rasterizeShapes`: `(shapes, w, h, background) => Float32Array`.
 *
 * Where no canvas is available (plain `node`) it transparently falls back to
 * `opts.fallback` (default the plain rasteriser), so a caller can enable it
 * unconditionally without changing `node` output.
 *
 * @param {object} [opts]
 * @param {number[]} [opts.background=[255,255,255]] default fill
 * @param {Function} [opts.fallback=rasterizeShapes] backend used without a canvas
 * @returns {(shapes: Array<object>, w: number, h: number, background?: number[]) => Float32Array}
 */
export function createStyleRasteriser(opts = {}) {
  const fallback = typeof opts.fallback === 'function' ? opts.fallback : STYLE_RENDER_DEFAULTS.fallback;
  const defaultBg = opts.background || STYLE_RENDER_DEFAULTS.background;

  return function renderStyledShapes(shapes, w, h, background) {
    const canvas = makeCanvas(w, h);
    if (!canvas) return fallback(shapes, w, h, background || defaultBg);
    const ctx = typeof canvas.getContext === 'function' ? canvas.getContext('2d') : null;
    if (!ctx) return fallback(shapes, w, h, background || defaultBg);

    const bg = background || defaultBg;
    const renderer = new Renderer(ctx, { width: w, height: h, background: cssRgb(bg) });
    registerAllStyles(renderer);
    renderer.setSize(w, h);
    renderer.clear(); // fills the background
    for (const s of shapes || []) renderer.drawShapeAt(s, 1);

    const img = ctx.getImageData(0, 0, w, h);
    const n = w * h;
    const out = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const o = i * 4;
      out[i * 3] = img.data[o];
      out[i * 3 + 1] = img.data[o + 1];
      out[i * 3 + 2] = img.data[o + 2];
    }
    return out;
  };
}

export default {
  STYLE_RENDER_DEFAULTS,
  isStyleRenderAvailable,
  toStyledShape,
  stampShapeStyles,
  createStyleRasteriser,
};
