/**
 * Canvas rendering with all style support.
 *
 * The Renderer is UI-agnostic — it only requires a `CanvasRenderingContext2D`
 * (or an `OffscreenCanvas` context).  It handles progressive reveal,
 * layer compositing, and style-specific rendering hooks.
 *
 * @module renderer
 */

import { drawShape, getRuntimeSource } from './shapes.js';

/**
 * Create a renderer bound to a canvas context.
 *
 * @param {CanvasRenderingContext2D} ctx - 2D canvas context.
 * @param {object} [opts]
 * @param {number} [opts.width=0]
 * @param {number} [opts.height=0]
 * @param {string} [opts.background='#ffffff']
 */
export class Renderer {
  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} [opts]
   */
  constructor(ctx, opts = {}) {
    if (!ctx) throw new Error('Renderer requires a canvas context');
    this.ctx = ctx;
    this.width = opts.width || 0;
    this.height = opts.height || 0;
    this.background = opts.background || '#ffffff';
    this._layers = [];
    this._styles = {}; // style name → style module
  }

  /**
   * Register a style module that provides custom rendering.
   * @param {string} name
   * @param {object} styleModule - Must expose draw(ctx, shape, progress).
   */
  registerStyle(name, styleModule) {
    this._styles[name] = styleModule;
  }

  /**
   * Set the canvas dimensions (also calls canvas.width/height if available).
   * @param {number} w
   * @param {number} h
   */
  setSize(w, h) {
    this.width = w;
    this.height = h;
    if (this.ctx.canvas) {
      this.ctx.canvas.width = w;
      this.ctx.canvas.height = h;
    }
  }

  /**
   * Clear the entire canvas with the background color.
   */
  clear() {
    const ctx = this.ctx;
    const prev = ctx.fillStyle;
    ctx.fillStyle = this.background;
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.fillStyle = prev;
  }

  /**
   * Set or replace the layer list.
   * @param {Array<object>} layers
   */
  setLayers(layers) {
    this._layers = layers || [];
  }

  /**
   * Render all layers to the canvas.
   *
   * @param {object} [opts]
   * @param {number} [opts.progress=1] - Global reveal 0..1.
   * @param {Array<object>} [opts.layers] - Override layer list.
   * @param {boolean} [opts.clear=true] - Clear canvas first.
   */
  renderAll(opts = {}) {
    const { progress = 1, layers = this._layers, clear: doClear = true } = opts;

    if (doClear) this.clear();

    // Sort layers by index, render in order
    const sorted = [...(layers || [])].sort((a, b) => a.id - b.id);
    for (const layer of sorted) {
      this.renderLayer(layer, progress);
    }
  }

  /**
   * Render a single layer at a given progress.
   *
   * @param {object} layer - { id, name, visible, opacity, blendMode, strokes }
   * @param {number} progress - 0..1
   */
  renderLayer(layer, progress = 1) {
    if (!layer.visible) return;

    const ctx = this.ctx;
    // Sort strokes by order field
    const strokes = [...(layer.strokes || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
    const total = strokes.length;

    const visibleCount = Math.ceil(total * progress);

    ctx.save();
    ctx.globalAlpha = (layer.opacity !== undefined ? layer.opacity : 1);
    if (layer.blendMode) {
      // Map blend mode names
      const bm = layer.blendMode === 'normal' ? 'source-over' : layer.blendMode;
      ctx.globalCompositeOperation = bm;
    }

    for (let i = 0; i < visibleCount; i++) {
      const shape = strokes[i];
      this.drawShapeAt(shape, 1);
    }

    // Composite paint surface for this layer (freehand painting)
    if (this._paintSurfaceProvider) {
      const paintCanvas = this._paintSurfaceProvider(layer.id);
      if (paintCanvas) {
        const prevTransform = ctx.getTransform();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(paintCanvas, 0, 0);
        ctx.setTransform(prevTransform);
      }
    }

    ctx.restore();
  }

  /**
   * Draw a single shape using the registered style or default renderer.
   *
   * @param {object} shape - Shape object.
   * @param {number} [progress=1] - Per-shape reveal progress 0..1.
   */
  drawShapeAt(shape, progress = 1) {
    if (!shape) return;

    const styleMod = this._styles[shape.style];
    if (styleMod && typeof styleMod.draw === 'function') {
      styleMod.draw(this.ctx, shape, progress);
    } else {
      // Fall back to the default shape renderer
      drawShape(this.ctx, shape, progress);
    }
  }

  /**
   * Render a flat (merged) image at arbitrary resolution.
   *
   * @param {Array<object>} layers
   * @param {number} width
   * @param {number} height
   * @param {object} [opts]
   * @returns {Promise<Blob>} Resolves with a PNG blob.
   */
  async exportImage(layers, width, height, opts = {}) {
    // Create an offscreen canvas for export
    const exportCanvas = typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(width, height)
      : (typeof document !== 'undefined' ? document.createElement('canvas') : null);

    if (!exportCanvas) throw new Error('Cannot create canvas for export (no document)');

    exportCanvas.width = width;
    exportCanvas.height = height;
    const exportCtx = exportCanvas.getContext('2d');

    if (!exportCtx) throw new Error('Cannot get 2D context for export');

    const oldW = this.width;
    const oldH = this.height;
    const oldCtx = this.ctx;
    const oldBg = this.background;

    this.ctx = exportCtx;
    this.setSize(width, height);
    this.background = opts.background || oldBg;
    this.setLayers(layers);
    this.clear();
    this.renderAll({ progress: 1, clear: false });

    // Restore original context
    this.ctx = oldCtx;
    this.setSize(oldW, oldH);
    this.background = oldBg;

    if (exportCanvas.convertToBlob) {
      return exportCanvas.convertToBlob(opts);
    }
    return new Promise(resolve => {
      exportCanvas.toBlob(blob => resolve(blob), opts.type || 'image/png', opts.quality);
    });
  }

  /**
   * Get the runtime source for embedding in self-contained HTML exports.
   * @returns {string}
   */
  static getRuntimeSource() {
    return getRuntimeSource();
  }
}

/**
 * Create a standalone renderer from a canvas element or context.
 *
 * @param {HTMLCanvasElement|CanvasRenderingContext2D} target
 * @param {object} [opts]
 * @returns {Renderer}
 */
export function createRenderer(target, opts = {}) {
  let ctx;
  if (target && target.getContext) {
    ctx = target.getContext('2d');
    opts.width = opts.width || target.width;
    opts.height = opts.height || target.height;
  } else if (target && target instanceof CanvasRenderingContext2D) {
    ctx = target;
  } else {
    throw new Error('createRenderer requires a canvas element or 2D context');
  }
  return new Renderer(ctx, opts);
}

export default { Renderer, createRenderer };
