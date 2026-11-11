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
import { createWetSim } from './wetsim.js';

/**
 * An offscreen 2D canvas, or null where none can be created.
 * @param {number} w
 * @param {number} h
 * @returns {OffscreenCanvas|HTMLCanvasElement|null}
 */
function makeCanvas(w, h) {
  const c = typeof OffscreenCanvas !== 'undefined'
    ? new OffscreenCanvas(w, h)
    : (typeof document !== 'undefined' ? document.createElement('canvas') : null);
  if (c) { c.width = w; c.height = h; }
  return c;
}

/**
 * Map a Style Profile `mediaModel` (Phase 4 / `docs/STYLE_PROFILE.md`) onto
 * `createWetSim` options (Phase 3.3). `kind: 'dry'` (or a missing model) returns
 * `null` → the wet pass stays off and output is byte-identical.
 *
 * @param {object} [m] profile media model
 * @param {number} [seed]
 * @returns {object|null} wetsim opts, or null
 */
export function mediaModelToWetOpts(m, seed) {
  if (!m || typeof m !== 'object') return null;
  const kind = m.kind || 'dry';
  if (kind === 'dry') return null;
  return {
    seed: (Number(seed) >>> 0) || 12345,
    maxWet: 0.6 + 1.4 * (typeof m.wetness === 'number' ? m.wetness : 0.5),
    flowRate: Math.min(1, 0.15 + 0.8 * (typeof m.bleed === 'number' ? m.bleed : 0.4)),
    dryRate: Math.max(0.05, typeof m.drying === 'number' ? m.drying : 1),
    granulation: Math.min(1, Math.max(0, typeof m.granulation === 'number' ? m.granulation : 0)),
    heightScale: 0.5 + 1.5 * (typeof m.height === 'number' ? m.height : 0.5),
  };
}

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
    /** Multi-layer mode: render each layer to a separate offscreen canvas, then composite. */
    this.multiLayer = false;
    /** Map of layer name to offscreen canvas for multi-layer rendering. */
    this._layerCanvases = new Map();
    /** Optional wet-media pass (Phase 3.3): `{ sim, canvas, ctx, opts }` or null. */
    this._wet = null;
    /** Optional smudge/blend amount (Phase 1.5). 0 = off (byte-identical). */
    this._smudge = 0;
    // Opt-in: an explicit `wetMedia` wetsim-opts object, or a profile
    // `mediaModel` mapped through mediaModelToWetOpts. Absent → no wet pass.
    const wetOpts = opts.wetMedia !== undefined
      ? opts.wetMedia
      : mediaModelToWetOpts(opts.mediaModel, opts.seed);
    if (wetOpts) this.setWetMedia(wetOpts);
    if (opts.smudge) this._smudge = Math.min(1, Math.max(0, Number(opts.smudge) || 0));
  }

  /**
   * Enable, replace or disable the wet-media pass (Phase 3.3).
   * The sim and its offscreen canvas are sized to the render target, so they are
   * rebuilt on every `setSize`.
   *
   * @param {object|null} opts - `createWetSim` options, or null/undefined to disable.
   * @returns {object|null} the wet state, or null.
   */
  setWetMedia(opts) {
    if (!opts) { this._wet = null; return null; }
    const canvas = makeCanvas(this.width, this.height);
    if (!canvas) { this._wet = null; return null; }
    const ctx = canvas.getContext('2d');
    if (!ctx) { this._wet = null; return null; }
    const sim = createWetSim(this.width, this.height, opts);
    this._wet = { sim, canvas, ctx, opts };
    return this._wet;
  }

  /**
   * Set the smudge/blend amount (Phase 1.5). 0 disables it (the default, so
   * existing output is byte-identical).
   * @param {number} amount 0..1
   * @returns {number} the clamped amount
   */
  setSmudge(amount) {
    const a = Number(amount) || 0;
    this._smudge = a <= 0 ? 0 : Math.min(1, a);
    return this._smudge;
  }

  /**
   * The wet sim's paper-height field (the Phase 1.5 optional height buffer),
   * or null when wet media is off.
   * @returns {Float32Array|null}
   */
  getHeightBuffer() {
    return this._wet ? this._wet.sim.paperHeight : null;
  }

  /**
   * Deposit one stroke's pigment into the wet sim (Phase 3.3).
   * @param {object} shape engine-format shape
   * @private
   */
  _wetDeposit(shape) {
    if (!shape || !this._wet) return;
    const p = shape.params || [];
    const cx = p[0], cy = p[1];
    if (!Number.isFinite(cx) || !Number.isFinite(cy)) return;
    const rx = Math.abs(p[2]) || 1, ry = Math.abs(p[3]) || 1;
    const alpha = shape.alpha !== undefined && shape.alpha !== null ? shape.alpha : 1;
    if (alpha <= 0) return;
    // Per-stroke pigment is deliberately small: `compositeInto` saturates
    // (coverage 1−e^(−6m)) by m≈0.5, so a several-hundred-stroke wash must
    // deposit a fraction of a normal stroke or it multiplies to solid black.
    // 0.004 is calibrated so a ~400-stroke wash stays translucent and the
    // painting reads through it (probe: mean luminance 160→119), not a film.
    // See docs/checkpoints/P3.3.md.
    this._wet.sim.deposit(cx, cy, Math.max(1, Math.max(rx, ry)), shape.color0 || [0, 0, 0], {
      amount: alpha * 0.004,
      water: 0.4 + 0.6 * alpha,
    });
  }

  /**
   * Dry the sim, composite the wash, and MULTIPLY it over the layer. White
   * paper multiplies to identity and pigment darkens, so the wash adds
   * absorption on top of the strokes already drawn instead of wiping them.
   * @param {CanvasRenderingContext2D} ctx
   * @private
   */
  _wetComposite(ctx) {
    const wet = this._wet;
    if (!wet) return;
    if (wet.canvas.width !== this.width || wet.canvas.height !== this.height) return;
    wet.sim.dry(1 / 60);
    wet.sim.compositeInto(wet.ctx);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(wet.canvas, 0, 0);
    ctx.restore();
  }

  /**
   * A cheap, deterministic 3×3 blend pass (Phase 1.5 smudge). No RNG — the same
   * input always yields the same output.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} w
   * @param {number} h
   * @param {number} amount 0..1
   * @private
   */
  _applySmudge(ctx, w, h, amount) {
    if (typeof ctx.getImageData !== 'function') return;
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    const out = new Uint8ClampedArray(d);
    const k = amount * 0.25;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = (y * w + x) * 4;
        for (let c = 0; c < 3; c++) {
          const n = d[i - 4 + c] + d[i + 4 + c] + d[i - w * 4 + c] + d[i + w * 4 + c];
          out[i + c] = d[i + c] * (1 - k) + (n / 4) * k;
        }
      }
    }
    ctx.putImageData(new ImageData(out, w, h), 0, 0);
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
    // The wet sim grid must match the render target — rebuild it at the new size.
    if (this._wet) this.setWetMedia(this._wet.opts);
  }

  /**
   * Create or retrieve an offscreen canvas for a named layer.
   * Used when multiLayer mode is active.
   *
   * @param {string} layerName
   * @returns {OffscreenCanvas|HTMLCanvasElement}
   */
  _getLayerCanvas(layerName) {
    if (!this._layerCanvases.has(layerName)) {
      var canvas = typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(this.width, this.height)
        : (typeof document !== 'undefined' ? document.createElement('canvas') : null);
      if (canvas) {
        canvas.width = this.width;
        canvas.height = this.height;
        var ctx2 = canvas.getContext('2d');
        if (ctx2) {
          ctx2.fillStyle = this.background;
          ctx2.fillRect(0, 0, this.width, this.height);
        }
      }
      this._layerCanvases.set(layerName, canvas);
    }
    return this._layerCanvases.get(layerName);
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

    // The wet sim accumulates pigment across deposits, so start every render
    // pass from a fresh sheet — this keeps render() idempotent (same input →
    // same output), which the deterministic contract requires.
    if (this._wet && !this.multiLayer) this.setWetMedia(this._wet.opts);

    // Sort layers by index, render in order
    const sorted = [...(layers || [])].sort((a, b) => a.id - b.id);

    if (this.multiLayer) {
      // Multi-layer mode: render each layer to its own offscreen canvas,
      // then composite all canvases onto the main canvas in layer order.
      this._layerCanvases.clear();
      for (const layer of sorted) {
        if (!layer.visible) continue;
        var layerName = layer._name || layer.name || ('layer_' + layer.id);
        var layerCanvas = this._getLayerCanvas(layerName);
        if (!layerCanvas) continue;
        var layerCtx = layerCanvas.getContext('2d');
        if (!layerCtx) continue;
        // Clear the layer canvas with transparent background
        layerCtx.clearRect(0, 0, this.width, this.height);
        // Temporarily swap ctx to render to the layer canvas
        var oldCtx = this.ctx;
        this.ctx = layerCtx;
        this.renderLayer(layer, progress);
        this.ctx = oldCtx;
      }
      // Composite all layer canvases onto the main canvas
      for (const layer of sorted) {
        if (!layer.visible) continue;
        var ln = layer._name || layer.name || ('layer_' + layer.id);
        var lc = this._layerCanvases.get(ln);
        if (!lc) continue;
        this.ctx.save();
        this.ctx.globalAlpha = (layer.opacity !== undefined ? layer.opacity : 1);
        if (layer.blendMode) {
          var bm = layer.blendMode === 'normal' ? 'source-over' : layer.blendMode;
          this.ctx.globalCompositeOperation = bm;
        }
        this.ctx.drawImage(lc, 0, 0);
        this.ctx.restore();
      }
    } else {
      for (const layer of sorted) {
        this.renderLayer(layer, progress);
      }
      // Phase 3.3 — wet-media wash, then Phase 1.5 — smudge, ONCE for the pass
      // (multi-layer mode is skipped: the sim is a single shared grid, so
      // per-layer wet rendering is a later refinement). Default state: neither.
      if (this._wet) this._wetComposite(this.ctx);
      if (this._smudge > 0) this._applySmudge(this.ctx, this.width, this.height, this._smudge);
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
      if (this._wet && !this.multiLayer) this._wetDeposit(shape);
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

    // The wet wash and the smudge are composited ONCE per pass, in renderAll,
    // after every layer's deposits — not here (that would composite once per
    // layer). Both live in renderAll's single-layer path only.

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

    // Encode and return the blob. (This method is documented @returns
    // {Promise<Blob>} but historically returned undefined, which silently
    // broke engine.exportPNG()/exportJPG().)
    // Normalise the MIME type: callers pass `image/${format}` where format is
    // 'png' | 'jpg'; the canvas API expects 'image/jpeg', not 'image/jpg'.
    let type = opts.type || 'image/png';
    if (type === 'image/jpg') type = 'image/jpeg';
    if (exportCanvas.convertToBlob) {
      return exportCanvas.convertToBlob({ type, quality: opts.quality });
    }
    return new Promise(function (resolve) {
      exportCanvas.toBlob(resolve, type, opts.quality);
    });
  }

  /**
   * Export a single named layer as a PNG blob.
   *
   * @param {Array<object>} layers - Layer list.
   * @param {string} layerName - The named layer to export.
   * @param {number} width
   * @param {number} height
   * @param {object} [opts]
   * @returns {Promise<Blob>} PNG blob of the isolated layer.
   */
  async exportLayerImage(layers, layerName, width, height, opts = {}) {
    var background = opts.background || this.background;
    var exportCanvas = typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(width, height)
      : (typeof document !== 'undefined' ? document.createElement('canvas') : null);

    if (!exportCanvas) throw new Error('Cannot create canvas for export (no document)');

    exportCanvas.width = width;
    exportCanvas.height = height;
    var exportCtx = exportCanvas.getContext('2d');
    if (!exportCtx) throw new Error('Cannot get 2D context for export');

    var oldW = this.width;
    var oldH = this.height;
    var oldCtx = this.ctx;
    var oldBg = this.background;

    this.ctx = exportCtx;
    this.setSize(width, height);
    this.background = background;
    this.clear();

    // Render only the requested named layer
    var target = (layers || []).find(function(l) { return (l._name || l.name) === layerName; });
    if (target && target.visible) {
      this.renderLayer(target, 1);
    }

    // Restore
    this.ctx = oldCtx;
    this.setSize(oldW, oldH);
    this.background = oldBg;

    // Convert canvas to blob
    if (exportCanvas.convertToBlob) {
      return exportCanvas.convertToBlob({ type: 'image/png' });
    }
    return new Promise(function(resolve) { exportCanvas.toBlob(resolve, 'image/png'); });
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
