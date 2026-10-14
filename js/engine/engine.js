/**
 * PaintingEngine — top-level orchestrator that unifies the individual engine
 * modules (analyzer, generator, scorer, renderer, exporter) into a single
 * class with the API documented in ARCHITECTURE.md.
 *
 * The engine is UI-agnostic: it accepts a canvas (or context), manages image
 * state, runs generation+scoring (optionally via a Web Worker), and renders
 * layers through the Renderer.
 *
 * @module engine
 */

import { analyzeImage } from './analyzer.js';
import {
  generateCandidates,
  resolveSettings,
  estimateShapeCount,
  orderShapes,
  DEFAULT_SETTINGS,
} from './generator.js';
import { selectBest, selectGreedyResidual, selectWithResidual, ResidualMap } from './scorer.js';
import { Renderer, createRenderer } from './renderer.js';
import {
  exportImage,
  exportHTML,
  exportProject,
  importProject,
} from './exporter.js';
import { getStyle, getAllStyles } from '../styles/index.js';

/**
 * @typedef {object} Layer
 * @property {string} id
 * @property {string} name
 * @property {boolean} visible
 * @property {number} opacity
 * @property {string} blendMode
 * @property {object[]} strokes
 * @property {boolean} locked
 */

/**
 * PaintingEngine — the main entry point for stroke-based image painting.
 *
 * Construction:
 *   const engine = new PaintingEngine({
 *     canvas: document.getElementById('canvas'),
 *     width: 1920, height: 1080,
 *     useWorker: true
 *   });
 */
export class PaintingEngine {
  /**
   * @param {object} opts
   * @param {HTMLCanvasElement} opts.canvas
   * @param {number} [opts.width]
   * @param {number} [opts.height]
   * @param {boolean} [opts.useWorker]
   * @param {string} [opts.background='#ffffff']
   */
  constructor(opts = {}) {
    if (!opts.canvas) throw new Error('PaintingEngine requires a canvas element');

    this.canvas = opts.canvas;
    this.width = opts.width || opts.canvas.width || 1024;
    this.height = opts.height || opts.canvas.height || 768;
    this.background = opts.background || '#ffffff';
    this.useWorker = opts.useWorker || false;

    // Create renderer from the canvas
    this.renderer = createRenderer(this.canvas, {
      width: this.width,
      height: this.height,
      background: this.background,
    });

    // Register all available styles into the renderer
    const styles = getAllStyles();
    this._styleList = styles.map(s => s.name);
    for (const { name, instance } of styles) {
      // The renderer expects a module with a ` draw(ctx, shape, progress)` method.
      // Style classes have `render(ctx, shape, progress)` — adapt it.
      this.renderer.registerStyle(name, {
        draw: (ctx, shape, progress) => instance.render(ctx, shape, progress),
      });
    }

    // Image state
    this._imageData = null;   // ImageData
    this._analysis = null;    // AnalysisResult
    this._sourceImage = null; // HTMLImageElement

    // Layer & settings state
    this.layers = [];
    this.settings = { ...DEFAULT_SETTINGS };
    this._seed = 0x1337BEEF;
    this._worker = null;
    this._pendingWorkerId = 0;

    this._initLayers();
    this._initWorker();
  }

  // ─── Initialization ───────────────────────────────────────────────

  _initLayers() {
    this.layers = [
      {
        id: 0,
        name: 'Background',
        visible: true,
        opacity: 1,
        blendMode: 'normal',
        strokes: [],
        locked: false,
      },
      {
        id: 1,
        name: 'Layer 1',
        visible: true,
        opacity: 1,
        blendMode: 'normal',
        strokes: [],
        locked: false,
      },
    ];
  }

  _initWorker() {
    if (!this.useWorker) return;
    if (typeof Worker === 'undefined') {
      console.warn('PaintingEngine: Web Workers not available, falling back to main thread');
      this.useWorker = false;
      return;
    }
    try {
      this._worker = new Worker(
        new URL('./worker.js', import.meta.url),
        { type: 'module' }
      );
      this._worker.onmessage = this._onWorkerMessage.bind(this);
      this._worker.onerror = (err) => console.error('Worker error:', err);
    } catch (e) {
      console.warn('PaintingEngine: worker creation failed, using main thread', e);
      this.useWorker = false;
      this._worker = null;
    }
  }

  // ─── Image Loading ────────────────────────────────────────────────

  /**
   * Load an image from an HTMLImageElement, HTMLCanvasElement, or data URL.
   * Performs analysis and populates the generator's internal state.
   *
   * @param {HTMLImageElement|HTMLCanvasElement|string} source
   * @returns {Promise<void>}
   */
  async loadImage(source) {
    return new Promise((resolve, reject) => {
      const handleImage = (img) => {
        this._sourceImage = img;
        this.width = img.width;
        this.height = img.height;
        this.renderer.setSize(this.width, this.height);

        // Extract pixel data
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = img.width;
        tempCanvas.height = img.height;
        const ctx = tempCanvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        this._imageData = ctx.getImageData(0, 0, img.width, img.height);

        // Analyze
        this._analysis = analyzeImage(
          this._imageData.data,
          img.width,
          img.height,
          {
            paletteSize: this.settings.paletteSize || 8,
            edgeThreshold: 0.15,
          }
        );

        // Auto-set stroke count if not specified
        if (!this.settings.strokeCount || this.settings.strokeCount === DEFAULT_SETTINGS.strokeCount) {
          this.settings.strokeCount = estimateShapeCount(
            img.width, img.height, this.settings.style
          );
        }

        resolve();
      };

      if (typeof source === 'string') {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => { handleImage(img); };
        img.onerror = reject;
        img.src = source;
      } else if (source instanceof HTMLImageElement) {
        handleImage(source);
      } else if (source instanceof HTMLCanvasElement) {
        const img = new Image();
        img.onload = () => { handleImage(img); };
        img.src = source.toDataURL();
      } else {
        reject(new Error('loadImage: unsupported source type'));
      }
    });
  }

  /**
   * Load an image from a File object (from drag-and-drop or file input).
   *
   * @param {File} file
   * @returns {Promise<void>}
   */
  async loadImageFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          this._sourceImage = img;
          this.width = img.width;
          this.height = img.height;
          this.renderer.setSize(this.width, this.height);

          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = img.width;
          tempCanvas.height = img.height;
          const ctx = tempCanvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          this._imageData = ctx.getImageData(0, 0, img.width, img.height);

          this._analysis = analyzeImage(
            this._imageData.data,
            img.width,
            img.height,
            {
              paletteSize: this.settings.paletteSize || 8,
              edgeThreshold: 0.15,
            }
          );

          if (!this.settings.strokeCount || this.settings.strokeCount === DEFAULT_SETTINGS.strokeCount) {
            this.settings.strokeCount = estimateShapeCount(
              img.width, img.height, this.settings.style
            );
          }

          resolve();
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // ─── Generation ───────────────────────────────────────────────────

  /**
   * Generate stroke candidates and select the best ones.
   *
   * When `opts.useResidual` is true (or `settings.useResidual === true`),
   * the engine uses a {@link ResidualMap} to track painting progress and
   * scores candidates against the residual error.  This produces better
   * coverage but is slower.
   *
   * @param {object} opts
   * @param {string} [opts.style]
   * @param {number} [opts.count]
   * @param {number} [opts.layer]
   * @param {boolean} [opts.useGreedy] - Use greedy residual selection.
   * @param {boolean} [opts.useResidual] - Use true residual map selection.
   * @param {boolean} [opts.useWorker] - Override worker usage for this call.
   * @returns {Promise<Array<object>>} Selected shape objects.
   */
  async generate(opts = {}) {
    const style = opts.style || this.settings.style || 'pencil';
    const count = opts.count || this.settings.strokeCount || 1000;
    const layerIdx = opts.layer !== undefined ? opts.layer : 0;
    const useResidual = opts.useResidual || this.settings.useResidual || false;

    // Update settings
    if (opts.style) this.settings.style = style;
    if (opts.count) this.settings.strokeCount = count;

    if (!this._analysis) {
      throw new Error('No image loaded. Call loadImage first.');
    }

    const resolved = resolveSettings({ ...this.settings, style });
    const seed = this._seed;

    let selected;
    if (opts.useWorker === true && this._worker) {
      selected = await this._generateInWorker(resolved, seed, count, layerIdx, opts);
    } else {
      // Main-thread path
      const candidates = generateCandidates(this._analysis, resolved, seed);
      if (useResidual) {
        selected = selectWithResidual(candidates, this._analysis, count, {
          residualWeight: 0.6,
          minResidual: 0.02,
        });
      } else if (opts.useGreedy) {
        selected = selectGreedyResidual(candidates, this._analysis, count);
      } else {
        selected = selectBest(candidates, this._analysis, count);
      }
    }

    // Apply ordering (pass analysis for edges-first mode)
    selected = orderShapes(selected, resolved, this._analysis);

    // Assign to layer
    const layer = this.getLayer(layerIdx);
    if (layer) {
      layer.strokes = selected.map(s => ({ ...s, layer: layerIdx }));
    }

    // Notify renderer of updated layers
    this.renderer.setLayers(this.layers);

    return selected;
  }

  _generateInWorker(settings, seed, count, layerIdx, opts) {
    return new Promise((resolve, reject) => {
      const id = ++this._pendingWorkerId;
      const batch = [];

      const handler = (e) => {
        const msg = e.data;
        if (msg.id !== id) return;

        if (msg.type === 'shapes') {
          batch.push(...msg.batch);
        } else if (msg.type === 'complete') {
          this._worker.removeEventListener('message', handler);
          // Post-process: order shapes (pass analysis for path ordering)
          const resolved = resolveSettings(settings);
          const ordered = orderShapes(batch, resolved, this._analysis);
          const layer = this.getLayer(layerIdx);
          if (layer) {
            layer.strokes = ordered.map(s => ({ ...s, layer: layerIdx }));
          }
          this.renderer.setLayers(this.layers);
          resolve(ordered);
        } else if (msg.type === 'error') {
          this._worker.removeEventListener('message', handler);
          reject(new Error(msg.message));
        }
      };

      this._worker.addEventListener('message', handler);
      this._worker.postMessage({
        type: 'start',
        id,
        w: this.width,
        h: this.height,
        imageData: this._imageData,
        settings: { ...settings, strokeCount: count, seed, useResidual: opts.useResidual },
        seed,
      });
    });
  }

  // ─── Rendering ────────────────────────────────────────────────────

  /**
   * Render all visible layers to the canvas.
   *
   * @param {object} [opts]
   * @param {number} [opts.progress=1]
   */
  render(opts = {}) {
    const progress = opts.progress !== undefined ? opts.progress : 1;
    this.renderer.setLayers(this.layers);
    this.renderer.renderAll({
      progress,
      clear: opts.clear !== false,
    });
    return this.canvas;
  }

  // ─── Export ───────────────────────────────────────────────────────

  /**
   * Export the current painting as a PNG or JPG blob.
   *
   * @param {object} [opts]
   * @param {number} [opts.width]
   * @param {number} [opts.height]
   * @param {string} [opts.format='png']
   * @param {number} [opts.quality=0.92]
   * @param {string} [opts.background]
   * @returns {Promise<Blob>}
   */
  async exportPNG(opts = {}) {
    return exportImage(this.renderer, this.layers, {
      width: opts.width || this.width,
      height: opts.height || this.height,
      format: 'png',
      quality: opts.quality || 0.92,
      background: opts.background || this.background,
    });
  }

  /**
   * Export as JPG blob.
   */
  async exportJPG(opts = {}) {
    return exportImage(this.renderer, this.layers, {
      width: opts.width || this.width,
      height: opts.height || this.height,
      format: 'jpg',
      quality: opts.quality || 0.92,
      background: opts.background || this.background,
    });
  }

  /**
   * Export as a self-contained HTML document string.
   *
   * @param {object} [opts]
   * @param {string} [opts.format='packed']
   * @param {number} [opts.strokeDuration=0.5]
   * @param {number} [opts.width]
   * @param {number} [opts.height]
   * @param {string} [opts.background]
   * @returns {string} HTML document string.
   */
  exportHTML(opts = {}) {
    return exportHTML(this.layers, {
      width: opts.width || this.width,
      height: opts.height || this.height,
      format: opts.format || 'packed',
      strokeDuration: opts.strokeDuration || 0.5,
      background: opts.background || this.background,
      styleList: this._styleList,
    });
  }

  /**
   * Export the current project as a JSON string.
   *
   * @param {object} [opts]
   * @param {number} [opts.width]
   * @param {number} [opts.height]
   * @param {string} [opts.background]
   * @param {boolean} [opts.embedImage=true] - Embed the source image as base64.
   * @returns {string} JSON string.
   */
  exportProject(opts = {}) {
    let imageData = null;
    if (opts.embedImage !== false && this._sourceImage) {
      const canvas = document.createElement('canvas');
      canvas.width = this._sourceImage.width;
      canvas.height = this._sourceImage.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(this._sourceImage, 0, 0);
      imageData = canvas.toDataURL('image/png');
    }

    return exportProject(this.layers, this.settings, {
      width: opts.width || this.width,
      height: opts.height || this.height,
      background: opts.background || this.background,
      imageData,
    });
  }

  /**
   * Import a project from a JSON string.
   *
   * @param {string} jsonStr
   * @returns {Promise<object>} Parsed project object.
   */
  async importProject(jsonStr) {
    const project = importProject(jsonStr);

    // Restore settings
    this.settings = { ...DEFAULT_SETTINGS, ...project.settings };
    this.width = project.width;
    this.height = project.height;
    this.background = project.background;
    this.renderer.setSize(this.width, this.height);
    this.renderer.background = this.background;

    // Restore layers
    this.layers = project.layers.map(l => ({
      id: l.id,
      name: l.name || `Layer ${l.id}`,
      visible: l.visible !== undefined ? l.visible : true,
      opacity: l.opacity !== undefined ? l.opacity : 1,
      blendMode: l.blendMode || 'normal',
      strokes: l.strokes || [],
      locked: l.locked || false,
    }));

    // Restore image if embedded
    if (project.image) {
      await this.loadImage(project.image);
    }

    this.renderer.setLayers(this.layers);
    this.render();
    return project;
  }

  // ─── Layer Management ─────────────────────────────────────────────

  /**
   * Get a layer by index.
   * @param {number} index
   * @returns {Layer|undefined}
   */
  getLayer(index) {
    return this.layers.find(l => l.id === index);
  }

  /**
   * Add a new layer above the current top layer.
   * @param {string} [name]
   * @returns {Layer}
   */
  addLayer(name) {
    const id = this.layers.length > 0
      ? Math.max(...this.layers.map(l => l.id)) + 1
      : 0;
    const layer = {
      id,
      name: name || `Layer ${id}`,
      visible: true,
      opacity: 1,
      blendMode: 'normal',
      strokes: [],
      locked: false,
    };
    this.layers.push(layer);
    this.renderer.setLayers(this.layers);
    return layer;
  }

  /**
   * Remove a layer by index.
   * @param {number} index
   */
  removeLayer(index) {
    const idx = this.layers.findIndex(l => l.id === index);
    if (idx === -1) return false;
    if (this.layers.length <= 1) return false; // Keep at least one layer
    this.layers.splice(idx, 1);
    this.renderer.setLayers(this.layers);
    return true;
  }

  /**
   * Move a layer up or down in z-order.
   * @param {number} index
   * @param {number} direction - 1 = up, -1 = down
   */
  moveLayer(index, direction) {
    const idx = this.layers.findIndex(l => l.id === index);
    if (idx === -1) return;
    const target = idx + direction;
    if (target < 0 || target >= this.layers.length) return;
    const [layer] = this.layers.splice(idx, 1);
    this.layers.splice(target, 0, layer);
    this.renderer.setLayers(this.layers);
  }

  /**
   * Duplicate a layer.
   * @param {number} index
   * @returns {Layer}
   */
  duplicateLayer(index) {
    const layer = this.getLayer(index);
    if (!layer) return null;
    const id = this.layers.length > 0
      ? Math.max(...this.layers.map(l => l.id)) + 1
      : 0;
    const dup = {
      id,
      name: `${layer.name} (Copy)`,
      visible: layer.visible,
      opacity: layer.opacity,
      blendMode: layer.blendMode,
      strokes: layer.strokes.map(s => ({ ...s })),
      locked: false,
    };
    this.layers.push(dup);
    this.renderer.setLayers(this.layers);
    return dup;
  }

  // ─── Settings / Utility ───────────────────────────────────────────

  /**
   * Update settings and recompute derived values.
   * @param {object} settings
   */
  setSettings(settings) {
    this.settings = resolveSettings({ ...this.settings, ...settings });
  }

  /**
   * Get the list of available style names.
   * @returns {string[]}
   */
  getStyleList() {
    return this._styleList;
  }

  /**
   * Get all style metadata for UI rendering.
   * @returns {Array<{name, label, category, description}>}
   */
  getStyleInfo() {
    return getAllStyles().map(s => ({
      name: s.name,
      label: s.label,
      category: s.category,
      description: s.instance.description,
    }));
  }

  /**
   * Get the total stroke count across all layers.
   * @returns {number}
   */
  getTotalStrokes() {
    return this.layers.reduce((sum, l) => sum + (l.strokes?.length || 0), 0);
  }

  /**
   * Get the analysis result (for previews, etc.).
   * @returns {object|null}
   */
  getAnalysis() {
    return this._analysis;
  }

  /**
   * Get the source image data URL.
   * @returns {string|null}
   */
  getImageDataURL() {
    if (!this._sourceImage) return null;
    const canvas = document.createElement('canvas');
    canvas.width = this._sourceImage.width;
    canvas.height = this._sourceImage.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(this._sourceImage, 0, 0);
    return canvas.toDataURL('image/png');
  }

  /**
   * Clear all strokes from a layer (or all layers).
   * @param {number} [layerIndex]
   */
  clearStrokes(layerIndex) {
    if (layerIndex !== undefined) {
      const layer = this.getLayer(layerIndex);
      if (layer) layer.strokes = [];
    } else {
      for (const layer of this.layers) {
        layer.strokes = [];
      }
    }
    this.renderer.setLayers(this.layers);
  }

  /**
   * Re-render at a new resolution (for high-DPI export).
   * Convenience method.
   */
  setSize(w, h) {
    this.width = w;
    this.height = h;
    this.renderer.setSize(w, h);
  }

  /**
   * Destroy the engine (clean up worker).
   */
  destroy() {
    if (this._worker) {
      this._worker.terminate();
      this._worker = null;
    }
  }
}

export default PaintingEngine;
