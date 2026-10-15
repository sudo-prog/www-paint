/**
 * Canvas Manager — manages the main painting canvas, rendering loop,
 * progressive reveal animation, and drag-and-drop image upload.
 *
 * Warm Dark Creative Tool: canvas background uses the --editor-bg token.
 */

import { createRenderer } from "../engine/renderer.js";

/**
 * CanvasManager — owns the visible canvas and orchestrates rendering.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {object} [opts]
 * @param {number} [opts.dpr=1]       — device pixel ratio
 * @param {string} [opts.background]   — CSS color for canvas background
 */
export class CanvasManager {
  constructor(canvas, opts = {}) {
    if (!canvas) throw new Error("CanvasManager requires a canvas element");

    /** @type {HTMLCanvasElement} */
    this.canvas = canvas;
    /** @type {CanvasRenderingContext2D} */
    this.ctx = canvas.getContext("2d");
    /** @type {number} */
    this.dpr = opts.dpr || window.devicePixelRatio || 1;
    /** @type {string} */
    this.background = opts.background ||
      (getComputedStyle(document.documentElement).getPropertyValue("--editor-bg").trim() || "#121212");

    /** @type {Renderer} */
    this.renderer = createRenderer(canvas, {
      width: canvas.width,
      height: canvas.height,
      background: this.background,
    });

    /** @type {number|null} */
    this._rafId = null;
    /** @type {boolean} */
    this._animating = false;

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
   * @param {number} width  — CSS pixels
   * @param {number} height — CSS pixels
   * @returns {this}
   */
  setSize(width, height) {
    this.canvas.style.width = width + "px";
    this.canvas.style.height = height + "px";
    this._updateDPR();
    return this;
  }

  /**
   * Resize canvas to fill a container element.
   * @param {HTMLElement} container
   */
  fillContainer(container) {
    const rect = container.getBoundingClientRect();
    this.canvas.style.width = rect.width + "px";
    this.canvas.style.height = rect.height + "px";
    this._updateDPR();
    return this;
  }

  /**
   * Set the background color and clear the canvas.
   * @param {string} color — CSS color string
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
   * Draw one stroke directly onto the canvas, on top of what is already there.
   * Used for live streaming during generation (no clear, no full re-render).
   * @param {object} shape — engine-format shape
   * @param {number} [progress=1]
   */
  drawStroke(shape, progress = 1) {
    if (!shape) return;
    try {
      this.renderer.drawShapeAt(shape, progress);
    } catch (e) { /* ignore a single bad stroke */ }
  }

  /**
   * Render the painting progressively (animated reveal) from 0 to 1.
   * @param {object} [opts]
   * @param {number} [opts.duration=2000] — animation duration in ms
   * @param {function} [opts.onFrame] — called with progress each frame
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
        const progress = 1 - Math.pow(1 - t, 3); // easeOutCubic

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

  /** Stop any ongoing animation. */
  stopAnimation() {
    this._animating = false;
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  /**
   * Handle canvas drag-and-drop events.
   * @param {HTMLElement} dropZone — element to attach drop handlers to
   * @param {function(File)} onFile — called with each dropped file
   */
  setupDropZone(dropZone, onFile) {
    const preventDefaults = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const highlight = () => dropZone.classList.add("drag-over");
    const unhighlight = () => dropZone.classList.remove("drag-over");

    dropZone.addEventListener("dragenter", preventDefaults);
    dropZone.addEventListener("dragover", (e) => {
      preventDefaults(e);
      const hasFiles = e.dataTransfer && e.dataTransfer.types.includes("Files");
      if (hasFiles) {
        e.dataTransfer.dropEffect = "copy";
        highlight();
      }
    });
    dropZone.addEventListener("dragleave", unhighlight);
    dropZone.addEventListener("drop", preventDefaults);

    dropZone.addEventListener("drop", (e) => {
      preventDefaults(e);
      unhighlight();
      const files = e.dataTransfer.files;
      if (files.length > 0) onFile(files[0]);
    });

    // Also handle click-to-open file picker
    const picker = dropZone.querySelector(".file-input-picker");
    if (picker) {
      picker.addEventListener("change", (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = "";
        if (file.type.startsWith("image/")) onFile(file);
      });
    }

    return { highlight, unhighlight };
  }

  /**
   * Destroy the canvas manager (clean up animations).
   */
  destroy() {
    this.stopAnimation();
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }
}

export default CanvasManager;
