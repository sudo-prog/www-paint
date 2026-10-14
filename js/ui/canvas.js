/**
 * Canvas Manager — manages the main painting canvas, OffscreenCanvas
 * rendering loop, and progressive reveal animation.
 *
 * Nothing Design System: canvas container uses --black background,
 * drop zone border uses --border-visible (dashed when active).
 *
 * Responsibilities:
 * - Wraps a canvas element and its 2D context
 * - Provides a render loop (requestAnimationFrame) for progressive animation
 * - Supports OffscreenCanvas for high-DPI export
 * - Exposes convenience methods for resizing, clearing, and capturing
 *
 * @module canvas
 */

import { createRenderer } from '../engine/renderer.js';

/**
 * CanvasManager — owns the visible canvas and orchestrates rendering.
 *
 * Nothing Design: background from CSS --black token, no shadows,
 * flat surfaces with border separation.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {object} [opts]
 * @param {number} [opts.dpr=1] - Device pixel ratio
 * @param {string} [opts.background=#000000]
 */
export class CanvasManager {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {object} [opts]
   */
  constructor(canvas, opts = {}) {
    if (!canvas) throw new Error('CanvasManager requires a canvas element');

    /** @type {HTMLCanvasElement} */
    this.canvas = canvas;
    /** @type {CanvasRenderingContext2D} */
    this.ctx = canvas.getContext('2d');
    /** @type {number} */
    this.dpr = opts.dpr || window.devicePixelRatio || 1;
    /** @type {string} */
    // Nothing Design: resolve background from CSS token at runtime
    this.background = opts.background ||
      (getComputedStyle(document.documentElement).getPropertyValue('--black').trim() || '#000000');

    /** @type {Renderer} */
    this.renderer = createRenderer(canvas, {
      width: canvas.width,
      height: canvas.height,
      background: this.background,
    });

    /** @type {number|null} */
    this._rafId = null;
    /** @type {function|null} */
    this._onFrame = null;
    /** @type {boolean} */
    this._animating = false;

    // Apply DPR
    this._updateDPR();
  }

  /**
   * Update canvas resolution for device pixel ratio.
   */
  _updateDPR() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.round(rect.width * this.dpr);
    this.canvas.height = Math.round(rect.height * this.dpr);
    this.ctx.scale(this.dpr, this.dpr);
    this.renderer.width = this.canvas.width;
    this.renderer.height = this.canvas.height;
  }

  /**
   * Set canvas display size and update resolution.
   *
   * @param {number} width - CSS pixels
   * @param {number} height - CSS pixels
   */
  setSize(width, height) {
    this.canvas.style.width = width + 'px';
    this.canvas.style.height = height + 'px';
    this._updateDPR();
    return this;
  }

  /**
   * Resize canvas to fill a container element.
   * @param {HTMLElement} container
   */
  fillContainer(container) {
    const rect = container.getBoundingClientRect();
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = rect.height + 'px';
    this._updateDPR();
    return this;
  }

  /**
   * Set the background color and clear the canvas.
   * Nothing Design: background is --black (OLED) by default.
   * @param {string} color - CSS color string
   */
  setBackground(color) {
    this.background = color;
    this.renderer.background = color;
    this.clear();
  }

  /**
   * Update layers on the renderer.
   * @param {Array<object>} layers
   */
  setLayers(layers) {
    this.renderer.setLayers(layers);
  }

  /**
   * Clear the canvas with the background color.
   */
  clear() {
    this.renderer.clear();
  }

  /**
   * Render all layers immediately at a given progress.
   *
   * @param {object} [opts]
   * @param {number} [opts.progress=1]
   * @param {boolean} [opts.clear=true]
   */
  render(opts = {}) {
    const progress = opts.progress !== undefined ? opts.progress : 1;
    this.renderer.renderAll({
      progress,
      clear: opts.clear !== false,
      layers: opts.layers,
    });
  }

  /**
   * Render the painting progressively (animated reveal) from 0 to 1.
   *
   * @param {object} [opts]
   * @param {number} [opts.duration=2000] - Animation duration in ms
   * @param {number} [opts.easing='easeOutCubic']
   * @param {function} [opts.onFrame] - Called with progress each frame
   * @returns {Promise<void>}
   */
  async renderAnimated(opts = {}) {
    const duration = opts.duration || 2000;
    this._animating = true;

    return new Promise((resolve) => {
      const start = performance.now();

      const step = (now) => {
        const elapsed = now - start;
        const t = Math.min(1, elapsed / duration);
        const progress = opts.easing === 'linear'
          ? t
          : 1 - Math.pow(1 - t, 3); // easeOutCubic

        this.render({ progress });
        if (opts.onFrame) opts.onFrame(progress);

        if (t < 1 && this._animating) {
          this._rafId = requestAnimationFrame(step);
        } else {
          this._animating = false;
          this.render({ progress: 1 });
          resolve();
        }
      };

      this._rafId = requestAnimationFrame(step);
    });
  }

  /**
   * Stop any ongoing animation.
   */
  stopAnimation() {
    this._animating = false;
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  /**
   * Start a render loop that calls onFrame each frame.
   * Useful for live previews.
   *
   * @param {function(progress:number)} onFrame
   */
  startRenderLoop(onFrame) {
    this._onFrame = onFrame;
    const loop = (t) => {
      if (this._onFrame) this._onFrame(t);
      this._rafId = requestAnimationFrame(loop);
    };
    this._rafId = requestAnimationFrame(loop);
  }

  /**
   * Stop the render loop.
   */
  stopRenderLoop() {
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    this._onFrame = null;
  }

  /**
   * Create an offscreen canvas for export, copied from the visible canvas.
   * @param {number} [width] - Override width (CSS pixels)
   * @param {number} [height] - Override height (CSS pixels)
   * @returns {HTMLCanvasElement}
   */
  createExportCanvas(width, height) {
    const w = width ? Math.round(width * this.dpr) : this.canvas.width;
    const h = height ? Math.round(height * this.dpr) : this.canvas.height;
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = w;
    exportCanvas.height = h;
    const exportCtx = exportCanvas.getContext('2d');
    exportCtx.scale(this.dpr, this.dpr);
    exportCtx.drawImage(this.canvas, 0, 0, w / this.dpr, h / this.dpr);
    return exportCanvas;
  }

  /**
   * Export the canvas content as a data URL.
   * @param {string} [type='image/png']
   * @param {number} [quality=1.0]
   * @param {number} [dpr] - Export resolution multiplier
   * @returns {string}
   */
  toDataURL(type = 'image/png', quality = 1.0, dpr = 1) {
    if (dpr === 1) {
      return this.canvas.toDataURL(type, quality);
    }
    // Export at higher resolution
    const exportCanvas = this.createExportCanvas(
      this.canvas.width / this.dpr * dpr,
      this.canvas.height / this.dpr * dpr
    );
    return exportCanvas.toDataURL(type, quality);
  }

  /**
   * Get canvas dimensions in CSS pixels.
   * @returns {{width: number, height: number}}
   */
  getDimensions() {
    return {
      width: this.canvas.width / this.dpr,
      height: this.canvas.height / this.dpr,
    };
  }

  /**
   * Handle canvas drag-and-drop events.
   *
   * Nothing Design: drop zone uses border separation (1px dashed --border-visible),
   * brightens on drag-over. No shadows, flat surfaces.
   *
   * @param {HTMLElement} dropZone - Element to attach drop handlers to
   * @param {function(File)} onFile - Called with each dropped file
   */
  setupDropZone(dropZone, onFile) {
    const preventDefaults = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const highlight = () => dropZone.classList.add('drag-over');
    const unhighlight = () => dropZone.classList.remove('drag-over');

    dropZone.addEventListener('dragenter', preventDefaults);
    dropZone.addEventListener('dragover', (e) => {
      preventDefaults(e);
      // Only accept files
      const hasFiles = e.dataTransfer && e.dataTransfer.types.includes('Files');
      if (hasFiles) {
        e.dataTransfer.dropEffect = 'copy';
        highlight();
      }
    });
    dropZone.addEventListener('dragleave', unhighlight);
    dropZone.addEventListener('drop', preventDefaults);

    dropZone.addEventListener('drop', (e) => {
      preventDefaults(e);
      unhighlight();
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        onFile(files[0]);
      }
    });

    return {
      highlight,
      unhighlight,
    };
  }

  /**
   * Destroy the canvas manager (clean up animations).
   */
  destroy() {
    this.stopAnimation();
    this.stopRenderLoop();
  }
}

export default CanvasManager;
