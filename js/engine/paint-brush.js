/**
 * PaintBrushEngine — freehand painting with p5.brush on one transparent
 * WebGL2 canvas per paint layer.
 *
 * p5.brush (the standalone ESM build) is a single-global-target state machine:
 * `brush.load(canvas)` claims an HTMLCanvasElement as a WebGL2 context, so each
 * canvas can ONLY be used through brush afterwards.  To composite onto the main
 * 2D canvas we rely on `preserveDrawingBuffer:true` (set inside brush.load) so
 * `ctx2d.drawImage(brushCanvas, 0, 0)` preserves per-pixel alpha.
 *
 * Each paint layer gets its own brush canvas stored in `this.surfaces` and
 * composited onto the app Renderer's 2D context at render time.
 *
 * @module paint-brush
 */

// Vendored p5.brush standalone build (ESM, no p5.js required).
// Committed under js/vendor/ so it ships with the app — the original
// _p5brush/ checkout is gitignored and must never be a runtime dependency.
import * as brush from '../vendor/brush.esm.js';

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
 * @property {HTMLCanvasElement} canvas — WebGL2 canvas claimed by brush.
 */

/**
 * PaintBrushEngine manages per-layer p5.brush surfaces for freehand painting.
 *
 * Construction:
 * ```js
 * const pbe = new PaintBrushEngine({
 *   renderer: appRenderer,
 *   width: 1920,
 *   height: 1080,
 * });
 * ```
 */
export class PaintBrushEngine {
  /**
   * @param {object} opts
   * @param {object} [opts.renderer]  — The app's Renderer instance (from renderer.js).  Stored for reference; compositing is done via the `ctx` argument passed to `renderLayer`.
   * @param {number} [opts.width=1024]  — Painting dimensions in CSS px.
   * @param {number} [opts.height=768]  — Painting dimensions in CSS px.
   */
  constructor({ renderer = null, width = 1024, height = 768 } = {}) {
    if (typeof document === 'undefined') {
      throw new Error('PaintBrushEngine requires a browser environment (document)');
    }

    /** @type {object|null} Reference to the app Renderer. */
    this.renderer = renderer;

    /** @type {number} Canvas width in CSS px. */
    this.width = width;

    /** @type {number} Canvas height in CSS px. */
    this.height = height;

    /**
     * Map of layerId → { canvas }.
     * The canvas is an HTMLCanvasElement claimed by brush (WebGL2 context).
     * We do NOT call getContext('2d') on it.
     * @type {Map<number, Surface>}
     */
    this.surfaces = new Map();

    /**
     * Active stroke state (populated by beginStroke, consumed by moveStroke/endStroke).
     * @type {{ layerId: number, x: number, y: number, brushName: string, color: string, weight: number, seed: number|null } | null}
     */
    this._active = null;

    /** Scale factor applied to brush parameters on first surface creation. */
    this._scale = scaleForSize(width, height);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Surface management
  // ─────────────────────────────────────────────────────────────

  /**
   * Lazily create (or re-activate) the brush surface for a layer.
   *
   * First call for `layerId`:
   *   1. Create an HTMLCanvasElement sized to this.width × this.height.
   *   2. Register it via `brush.load(canvas)` (claims it as WebGL2).
   *   3. Scale brushes, set angle mode to degrees, clear to transparent.
   *   4. Store the surface and return it.
   *
   * Subsequent calls simply `brush.load(existingCanvas)` to make it the active
   * draw target again, then return it.
   *
   * @param {number} layerId
   * @returns {Surface}
   */
  getSurface(layerId) {
    let surface = this.surfaces.get(layerId);
    if (!surface) {
      const canvas = document.createElement('canvas');
      canvas.width = this.width;
      canvas.height = this.height;

      // brush.load claims the canvas as a WebGL2 context with preserveDrawingBuffer:true
      brush.load(canvas);

      // Scale brushes appropriately for the canvas size (done once per surface)
      brush.scaleBrushes(this._scale);
      brush.angleMode(brush.DEGREES);

      // Clear to fully transparent (no argument = transparent, NOT a colour)
      brush.clear();
      brush.render();

      surface = { canvas };
      this.surfaces.set(layerId, surface);
    } else {
      // Re-activate this surface as the brush draw target
      brush.load(surface.canvas);
    }
    return surface;
  }

  /**
   * Check whether a brush surface has been created for a layer.
   * @param {number} layerId
   * @returns {boolean}
   */
  hasSurface(layerId) {
    return this.surfaces.has(layerId);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Stroking
  // ─────────────────────────────────────────────────────────────

  /**
   * Begin a freehand stroke on the given layer.
   *
   * Sets up the brush, colour, and weight, then starts a "curve" path at (x, y).
   * The active stroke state is stored in `this._active` so `moveStroke` and
   * `endStroke` can continue the path without re-setting brush attributes each
   * time.
   *
   * @param {number} layerId
   * @param {object} opts
   * @param {number} opts.x
   * @param {number} opts.y
   * @param {string} [opts.brushName='HB'] — p5.brush brush preset (e.g. 'HB', '2B', 'pen', 'charcoal').
   * @param {string} [opts.color='#222222'] — Any CSS colour string.
   * @param {number} [opts.weight=1]
   * @param {number|null} [opts.seed=null] — If provided, seeds p5.brush PRNG for deterministic output.
   */
  beginStroke(layerId, { x, y, brushName = 'HB', color = '#222222', weight = 1, seed = null }) {
    const surface = this.getSurface(layerId);
    // brush.load makes this surface the active target
    brush.load(surface.canvas);
    brush.angleMode(brush.DEGREES);

    if (seed !== null) {
      brush.seed(seed);
    }

    brush.set(brushName, color, weight);
    brush.beginStroke('curve', x, y);

    this._active = { layerId, x, y, brushName, color, weight, seed };
  }

  /**
   * Continue the active stroke to a new point.
   *
   * Computes the bearing angle and segment length from the last point to
   * (x, y), then calls `brush.move(angle, length, 1)`.  Segments shorter than
   * 0.5 px are skipped to avoid redundant micro-strokes.
   *
   * @param {number} x
   * @param {number} y
   */
  moveStroke(x, y) {
    if (!this._active) return;

    const length = dist(this._active.x, this._active.y, x, y);
    if (length < 0.5) return;

    const angle = angleBetween(this._active.x, this._active.y, x, y);
    brush.move(angle, length, 1);

    this._active.x = x;
    this._active.y = y;
  }

  /**
   * Finish the active stroke at (x, y).
   *
   * Moves to the final point (if there is non-trivial distance), ends the
   * brush stroke path, and flushes via `brush.render()`.
   *
   * @param {number} x
   * @param {number} y
   */
  endStroke(x, y) {
    if (!this._active) return;

    const length = dist(this._active.x, this._active.y, x, y);
    if (length >= 0.5) {
      const angle = angleBetween(this._active.x, this._active.y, x, y);
      brush.move(angle, length, 1);
    }

    // endStroke(angle, pressure) — angle finalises the last segment heading
    const endAngle = length >= 0.5
      ? angleBetween(this._active.x, this._active.y, x, y)
      : 0;
    brush.endStroke(endAngle, 1);
    brush.render();

    this._active = null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // One-shot shapes
  // ─────────────────────────────────────────────────────────────

  /**
   * Draw a one-shot shape on a layer.
   *
   * @param {number} layerId
   * @param {'line'|'circle'|'rect'|'spline'} kind
   * @param {object} params — Shape parameters:
   *   - `line`:   `{ x1, y1, x2, y2 }`
   *   - `circle`: `{ x, y, r, irregularity=0 }`
   *   - `rect`:   `{ x, y, w, h, mode='corner' }`
   *   - `spline`: `{ points: [x,y,pressure][], curvature=0.5 }`
   * @param {object} [style]
   * @param {string} [style.brushName='HB']
   * @param {string} [style.color='#222222']
   * @param {number} [style.weight=1]
   */
  drawShape(layerId, kind, params, style = {}) {
    const { brushName = 'HB', color = '#222222', weight = 1 } = style;

    const surface = this.getSurface(layerId);
    brush.load(surface.canvas);
    brush.angleMode(brush.DEGREES);
    brush.set(brushName, color, weight);

    switch (kind) {
      case 'line':
        brush.line(params.x1, params.y1, params.x2, params.y2);
        break;
      case 'circle':
        brush.circle(params.x, params.y, params.r, params.irregularity || 0);
        break;
      case 'rect':
        brush.rect(params.x, params.y, params.w, params.h, params.mode || 'corner');
        break;
      case 'spline':
        brush.spline(params.points, params.curvature || 0.5);
        break;
      default:
        console.warn(`PaintBrushEngine.drawShape: unknown shape kind "${kind}"`);
    }

    brush.render();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Persistent brush state
  // ─────────────────────────────────────────────────────────────

  /**
   * Set the persistent brush configuration for a surface so subsequent strokes
   * on that layer use it.
   *
   * Unlike `beginStroke`, this does NOT start a path and does NOT call
   * `render()`.
   *
   * @param {number} layerId
   * @param {object} state
   * @param {string} [state.brushName]
   * @param {string} [state.color]
   * @param {number} [state.weight]
   * @param {{color:string, opacity:number}|null} [state.fill]
   * @param {{dist:number, angle:number, options:object}|null} [state.hatch]
   * @param {string|null} [state.field]
   */
  applyBrushState(layerId, state) {
    const surface = this.getSurface(layerId);
    brush.load(surface.canvas);

    if (state.brushName !== undefined || state.color !== undefined || state.weight !== undefined) {
      brush.set(
        state.brushName || 'HB',
        state.color || '#222222',
        state.weight || 1,
      );
    }

    if (state.fill) {
      brush.fill(state.fill.color, state.fill.opacity);
    } else {
      brush.noFill();
    }

    if (state.hatch) {
      brush.hatch(state.hatch.dist, state.hatch.angle, state.hatch.options);
    } else {
      brush.noHatch();
    }

    if (state.field) {
      brush.field(state.field);
    } else {
      brush.noField();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Compositing & lifecycle
  // ─────────────────────────────────────────────────────────────

  /**
   * Composite the brush surface for a layer onto a 2D canvas context.
   *
   * @param {object} layer     — The app layer object ({ id, visible, opacity, blendMode, … }).
   * @param {number} [progress=1] — Unused for brush surfaces (strokes are already final on the WebGL canvas); kept for API symmetry.
   * @param {CanvasRenderingContext2D} ctx — 2D context to draw onto.
   */
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

    // The brush surface was created with preserveDrawingBuffer:true,
    // so drawImage preserves per-pixel alpha including transparency.
    ctx.drawImage(surface.canvas, 0, 0, this.width, this.height);
    ctx.restore();
  }

  /**
   * Clear all content on a layer's brush surface (to fully transparent).
   * @param {number} layerId
   */
  clearLayer(layerId) {
    const surface = this.surfaces.get(layerId);
    if (!surface) return;
    brush.load(surface.canvas);
    brush.clear(); // no argument → transparent
    brush.render();
  }

  /**
   * Remove a layer's brush surface entirely.
   * @param {number} layerId
   */
  removeLayer(layerId) {
    const surface = this.surfaces.get(layerId);
    if (!surface) return;
    if (surface.canvas.parentNode) {
      surface.canvas.parentNode.removeChild(surface.canvas);
    }
    this.surfaces.delete(layerId);
  }

  /**
   * Export the raw brush canvas for a layer (for saving / external compositing).
   * @param {number} layerId
   * @returns {HTMLCanvasElement|null}
   */
  exportLayer(layerId) {
    const surface = this.surfaces.get(layerId);
    return surface ? surface.canvas : null;
  }

  /**
   * Resize all brush surfaces to a new dimension.
   *
   * Content is lost (the WebGL canvas cannot be resized in-place).  A warning
   * is logged.  Each surface is re-registered with `brush.load`.
   *
   * @param {number} width
   * @param {number} height
   */
  resize(width, height) {
    if (this.surfaces.size > 0) {
      console.warn(
        `[PaintBrushEngine] resize() will lose all existing brush content on ${this.surfaces.size} layer(s).`,
      );
    }

    this.width = width;
    this.height = height;
    this._scale = scaleForSize(width, height);

    for (const [layerId, surface] of this.surfaces) {
      surface.canvas.width = width;
      surface.canvas.height = height;
      brush.load(surface.canvas);
      brush.scaleBrushes(this._scale);
      brush.angleMode(brush.DEGREES);
      brush.clear();
      brush.render();
    }
  }
}

export default PaintBrushEngine;
