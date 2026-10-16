/**
 * PaintBrushEngine — freehand painting on one transparent 2D canvas per
 * paint layer.  Strokes are drawn with the Canvas 2D API and composited
 * onto the app Renderer's 2D context at render time.
 *
 * @module paint-brush
 */

/**
 * Compute a brush scale factor from canvas dimensions.
 *
 * p5.brush defaults to a 500×500 reference canvas.  Brushes that look natural at
 * 500 px look too small on a 1920×1080 canvas, so we scale them up.  We use
 * `min(width, height) / 200` (giving 1.0 at 200 px and ~5.0 at 1000 px) and
 * round to an integer for deterministic brush parameter scaling.  A floor of 1
 * keeps small canvases from shrinking brushes below their designed size.
 *
 * @param {number} width  Canvas width in CSS px.
 * @param {number} height Canvas height in CSS px.
 * @returns {number} Scale factor for `brush.scaleBrushes()`.
 */
function scaleForSize(width, height) {
  return Math.max(1, Math.round(Math.min(width, height) / 200));
}

/**
 * Compute Euclidean distance between two points.
 * @param {number} x1
 * @param {number} y1
 * @param {number} x2
 * @param {number} y2
 * @returns {number}
 */
function dist(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.hypot(dx, dy);
}

/**
 * Compute the bearing angle (in degrees) from point A to point B.
 *
 * brush.move expects an angle in degrees (when `brush.angleMode` is DEGREES).
 * The angle represents the heading of the stroke segment.
 *
 * @param {number} x1
 * @param {number} y1
 * @param {number} x2
 * @param {number} y2
 * @returns {number} Angle in degrees [0, 360).
 */
function angleBetween(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let deg = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (deg < 0) deg += 360;
  return deg;
}

/**
 * @typedef {object} Surface
 * @property {HTMLCanvasElement} canvas — 2D canvas for paint strokes.
 * @property {CanvasRenderingContext2D} ctx — 2D context for drawing.
 */

/**
 * PaintBrushEngine manages per-layer 2D canvas surfaces for freehand painting.
 *
 * Each paint layer gets its own transparent canvas stored in `this.surfaces`
 * and composited onto the app Renderer's 2D context at render time.
 */
export class PaintBrushEngine {
  /**
   * @param {object} opts
   * @param {object} [opts.renderer]  — The app's Renderer instance.
   * @param {number} [opts.width=1024]  — Painting dimensions in CSS px.
   * @param {number} [opts.height=768]  — Painting dimensions in CSS px.
   */
  constructor({ renderer = null, width = 1024, height = 768 } = {}) {
    if (typeof document === 'undefined') {
      throw new Error('PaintBrushEngine requires a browser environment (document)');
    }

    this.renderer = renderer;
    this.width = width;
    this.height = height;

    /**
     * Map of layerId → { canvas, ctx }.
     * @type {Map<number, Surface>}
     */
    this.surfaces = new Map();

    /**
     * Active stroke state.
     * @type {{ layerId: number, x: number, y: number, color: string, weight: number } | null}
     */
    this._active = null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Surface management
  // ─────────────────────────────────────────────────────────────────────────

  getSurface(layerId) {
    let surface = this.surfaces.get(layerId);
    if (!surface) {
      const canvas = document.createElement('canvas');
      canvas.width = this.width;
      canvas.height = this.height;
      const ctx = canvas.getContext('2d');
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      surface = { canvas, ctx };
      this.surfaces.set(layerId, surface);
    }
    return surface;
  }

  hasSurface(layerId) {
    return this.surfaces.has(layerId);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Stroking
  // ─────────────────────────────────────────────────────────────────────────

  beginStroke(layerId, { x, y, color = '#222222', weight = 1, brushName = 'HB' }) {
    const surface = this.getSurface(layerId);
    const ctx = surface.ctx;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = weight;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = 0.85;
    ctx.globalCompositeOperation = 'source-over';

    // Draw a dot at the start point
    ctx.beginPath();
    ctx.arc(x, y, weight / 2, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(x, y);

    this._active = { layerId, x, y, color, weight, ctx };
  }

  moveStroke(x, y) {
    if (!this._active) return;
    const length = Math.hypot(x - this._active.x, y - this._active.y);
    if (length < 0.5) return;

    const ctx = this._active.ctx;
    ctx.lineTo(x, y);
    ctx.stroke();

    this._active.x = x;
    this._active.y = y;
  }

  endStroke(x, y) {
    if (!this._active) return;
    const length = Math.hypot(x - this._active.x, y - this._active.y);
    if (length >= 0.5) {
      this._active.ctx.lineTo(x, y);
      this._active.ctx.stroke();
    }
    this._active.ctx.restore();
    this._active = null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Compositing & lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  renderLayer(layer, progress = 1, ctx) {
    if (!layer.visible) return;
    if (!ctx) return;

    const surface = this.surfaces.get(layer.id);
    if (!surface) return;

    ctx.save();
    ctx.globalAlpha = layer.opacity !== undefined ? layer.opacity : 1;
    if (layer.blendMode && layer.blendMode !== 'normal') {
      ctx.globalCompositeOperation = layer.blendMode;
    }
    ctx.drawImage(surface.canvas, 0, 0);
    ctx.restore();
  }

  clearLayer(layerId) {
    const surface = this.surfaces.get(layerId);
    if (!surface) return;
    surface.ctx.clearRect(0, 0, this.width, this.height);
  }

  removeLayer(layerId) {
    const surface = this.surfaces.get(layerId);
    if (surface && surface.canvas.parentNode) {
      surface.canvas.parentNode.removeChild(surface.canvas);
    }
    this.surfaces.delete(layerId);
  }

  exportLayer(layerId) {
    const surface = this.surfaces.get(layerId);
    return surface ? surface.canvas : null;
  }

  resize(width, height) {
    if (this.surfaces.size > 0) {
      console.warn(`[PaintBrushEngine] resize() will lose all existing brush content on ${this.surfaces.size} layer(s).`);
    }
    this.width = width;
    this.height = height;
    for (const [layerId, surface] of this.surfaces) {
      surface.canvas.width = width;
      surface.canvas.height = height;
      surface.ctx.lineCap = 'round';
      surface.ctx.lineJoin = 'round';
    }
  }
}

export default PaintBrushEngine;
