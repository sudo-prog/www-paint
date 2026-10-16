/**
 * App Controller — the main orchestrator that wires together the engine,
 * canvas manager, controls panel, layers panel, and export dialog.
 *
 * Warm Dark Creative Tool: uses CSS tokens from :root.
 *
 * @module app
 */

import { PaintingEngine } from "../engine/engine.js";
import { CanvasManager } from "./canvas.js";
import { ControlsManager } from "./controls.js";
import { LayersManager } from "./layers.js";
import { ExportManager } from "./export.js";
import { MotionController } from "./motion.js";
import { PaintBrushEngine } from "../engine/paint-brush.js";

/**
 * WWW_PAINT Application Controller.
 *
 * @param {object} opts
 * @param {HTMLCanvasElement} opts.canvas
 * @param {HTMLElement} opts.controlsRoot — controls panel container
 * @param {HTMLElement} opts.layersRoot — layers panel container
 * @param {HTMLElement} opts.exportRoot — export dialog container
 * @param {HTMLElement} [opts.statusBar] — status bar element
 */
export class App {
  constructor(opts = {}) {
    if (!opts.canvas) throw new Error("App requires a canvas element");
    if (!opts.controlsRoot) throw new Error("App requires a controls root");
    if (!opts.layersRoot) throw new Error("App requires a layers root");
    if (!opts.exportRoot) throw new Error("App requires an export root");

    /** @type {HTMLCanvasElement} */
    this.canvasEl = opts.canvas;
    /** @type {HTMLElement} */
    this.controlsRoot = opts.controlsRoot;
    /** @type {HTMLElement} */
    this.layersRoot = opts.layersRoot;
    /** @type {HTMLElement} */
    this.exportRoot = opts.exportRoot;
    /** @type {HTMLElement|null} */
    this.statusBar = opts.statusBar || null;

    /** @type {PaintingEngine|null} */
    this.engine = null;
    /** @type {CanvasManager|null} */
    this.canvasMgr = null;
    /** @type {ControlsManager|null} */
    this.controls = null;
    /** @type {LayersManager|null} */
    this.layers = null;
    /** @type {ExportManager|null} */
    this.exportMgr = null;

    /** @type {boolean} */
    this._generating = false;
    /** @type {number|null} */
    this._statusTimeout = null;

    this._init();
    window.__app = this; // debug hook
  }

  /* ─── Initialization ────────────────────────────────────────── */

  /**
   * Initialize all managers and bind cross-module events.
   * @private
   */
  _init() {
    // Resolve background from CSS token
    this._background = getComputedStyle(document.documentElement)
      .getPropertyValue("--editor-bg").trim() || "#121212";

    // Create canvas manager
    this.canvasMgr = new CanvasManager(this.canvasEl, {
      dpr: window.devicePixelRatio || 1,
      background: this._background,
    });

    // Create engine
    this.engine = new PaintingEngine({
      canvas: this.canvasEl,
      width: this.canvasEl.width,
      height: this.canvasEl.height,
      useWorker: true,
      background: this._background,
    });

    // Wire canvas manager's renderer to engine
    this.engine.renderer = this.canvasMgr.renderer;
    // Re-register styles onto the swapped renderer (the engine's constructor
    // populated its ORIGINAL renderer, which we just replaced).
    this.engine._registerAllStyles();

    // Create UI managers
    this.controls = new ControlsManager(this.controlsRoot, {
      initialSettings: this.engine.settings,
    });
    this.layers = new LayersManager(this.layersRoot);
    this.exportMgr = new ExportManager(this.exportRoot);

    // Create motion controller (playback controls for stroke animation)
    const motionContainer = document.getElementById('motion-controls') || null;
    if (motionContainer) {
      this.motion = new MotionController({
        canvasMgr: this.canvasMgr,
        container: motionContainer,
      });
    }

    // Create PaintBrushEngine for freehand painting
    this.paintBrush = new PaintBrushEngine({
      renderer: this.engine.renderer,
      width: this.canvasEl.width,
      height: this.canvasEl.height,
    });

    // Hook paint surfaces into the renderer so strokes are composited
    this.engine.renderer._paintSurfaceProvider = (layerId) => {
      return this.paintBrush.exportLayer(layerId);
    };

    // Sync renderer layers so paint surfaces composite during render
    this.engine.renderer.setLayers(this.engine.layers);

    // Paint mode state
    this._paintMode = false;
    this._painting = false;
    this._brushPreset = 'HB';
    this._brushColor = '#222222';
    this._brushWeight = 1;

    // Sync layers to engine

    // Bind events
    this._bindAllEvents();

    // Setup drag-and-drop
    this._setupDragDrop();

    // Update status
    this._updateStatus();
  }

  /**
   * Bind all cross-module event listeners.
   * @private
   */
  _bindAllEvents() {
    // Controls → App
    this.controls.root.addEventListener("settings-change", (e) => {
      this._onSettingsChange(e.detail);
    });

    this.controls.root.addEventListener("generate", () => {
      this.generate();
    });

    // Layers → App
    this.layers.root.addEventListener("layer-add", () => {
      const layer = this.engine.addLayer();
      this.layers.setLayers(this.engine.layers);
    });

    this.layers.root.addEventListener("layer-delete", (e) => {
      this.engine.removeLayer(e.detail.layerId);
      this.layers.setLayers(this.engine.layers);
      this.engine.render();
    });

    this.layers.root.addEventListener("layer-duplicate", (e) => {
      this.engine.duplicateLayer(e.detail.layerId);
      this.layers.setLayers(this.engine.layers);
      this.engine.render();
    });

    this.layers.root.addEventListener("layer-toggle-visibility", (e) => {
      const layer = this.engine.getLayer(e.detail.layerId);
      if (layer) {
        layer.visible = !layer.visible;
        this.engine.renderer.setLayers(this.engine.layers);
        this.engine.render();
      }
    });

    this.layers.root.addEventListener("layer-opacity-change", (e) => {
      const layer = this.engine.getLayer(e.detail.layerId);
      if (layer) {
        layer.opacity = e.detail.opacity;
        this.engine.render();
      }
    });

    this.layers.root.addEventListener("layer-blend-change", (e) => {
      const layer = this.engine.getLayer(e.detail.layerId);
      if (layer) {
        layer.blendMode = e.detail.blendMode;
        this.engine.render();
      }
    });

    // Export → App
    this.exportMgr.root.addEventListener("export-image", (e) => {
      this._handleExportImage(e.detail);
    });
    this.exportMgr.root.addEventListener("export-html", () => {
      this._handleExportHTML();
    });
    this.exportMgr.root.addEventListener("export-svg", () => {
      this._handleExportSVG();
    });
    this.exportMgr.root.addEventListener("save-project", () => {
      this._handleSaveProject();
    });
    this.exportMgr.root.addEventListener("load-project", () => {
      this._handleLoadProjectClick();
    });
    this.exportMgr.root.addEventListener("load-project-file", (e) => {
      this._handleLoadProjectFile(e.detail.file);
    });

    // Paint mode toggle
    const paintToggle = document.getElementById("btn-paint-mode");
    if (paintToggle) {
      paintToggle.addEventListener("click", () => {
        this._togglePaintMode();
      });
    }

    // Paint toolbar controls
    const presetSelect = document.getElementById("paint-preset");
    if (presetSelect) {
      presetSelect.addEventListener("change", () => {
        this._brushPreset = presetSelect.value;
        this._updatePaintStatus();
      });
    }
    const colorInput = document.getElementById("paint-color");
    if (colorInput) {
      colorInput.addEventListener("input", () => {
        this._brushColor = colorInput.value;
        this._updatePaintStatus();
      });
    }
    const weightInput = document.getElementById("paint-weight");
    if (weightInput) {
      weightInput.addEventListener("input", () => {
        this._brushWeight = parseFloat(weightInput.value);
        this._updatePaintStatus();
      });
    }
    const clearBtn = document.getElementById("paint-clear");
    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        this._clearPaintLayer();
      });
    }

    // Mouse/touch events for freehand painting
    this._bindPaintEvents();
  }

  /**
   * Bind mouse/touch events on the canvas for freehand painting in Paint mode.
   * @private
   */
  _bindPaintEvents() {
    const canvas = this.canvasEl;
    if (!canvas) return;

    const handleDown = (e) => {
      if (!this._paintMode) return;
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (this.engine.renderer.width / rect.width);
      const y = (e.clientY - rect.top) * (this.engine.renderer.height / rect.height);
      const layer = this.engine.getActiveLayer() || this.engine.layers[0];
      if (!layer) return;
      this._painting = true;
      this.paintBrush.beginStroke(layer.id, {
        x, y, brushName: this._brushPreset, color: this._brushColor,
        weight: this._brushWeight,
      });
    };

    const handleMove = (e) => {
      if (!this._paintMode || !this._painting) return;
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (this.engine.renderer.width / rect.width);
      const y = (e.clientY - rect.top) * (this.engine.renderer.height / rect.height);
      this.paintBrush.moveStroke(x, y);
    };

    const handleUp = (e) => {
      if (!this._paintMode || !this._painting) return;
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (this.engine.renderer.width / rect.width);
      const y = (e.clientY - rect.top) * (this.engine.renderer.height / rect.height);
      this.paintBrush.endStroke(x, y);
      this._painting = false;
      // Composite onto main canvas
      const layer = this.engine.getActiveLayer() || this.engine.layers[0];
      if (layer) {
        this.paintBrush.renderLayer(layer, 1, this.canvasMgr.ctx);
      }
      // Hide the placeholder overlay so the stroke is visible
      const placeholder = document.getElementById('canvas-placeholder');
      if (placeholder) placeholder.style.display = 'none';
    };

    const handleLeave = () => {
      if (this._painting) {
        this._painting = false;
      }
    };

    canvas.addEventListener('mousedown', handleDown);
    canvas.addEventListener('mousemove', handleMove);
    canvas.addEventListener('mouseup', handleUp);
    canvas.addEventListener('mouseleave', handleLeave);
    canvas.addEventListener('mouseout', handleLeave);

    // Touch events
    canvas.addEventListener('touchstart', handleDown, { passive: false });
    canvas.addEventListener('touchmove', handleMove, { passive: false });
    canvas.addEventListener('touchend', (e) => {
      if (!this._paintMode || !this._painting) return;
      e.preventDefault();
      const touch = e.touches[0] || e.changedTouches[0];
      if (!touch) { this._painting = false; return; }
      const rect = canvas.getBoundingClientRect();
      const x = (touch.clientX - rect.left) * (this.engine.renderer.width / rect.width);
      const y = (touch.clientY - rect.top) * (this.engine.renderer.height / rect.height);
      this.paintBrush.endStroke(x, y);
      this._painting = false;
      const layer = this.engine.getActiveLayer() || this.engine.layers[0];
      if (layer) {
        this.paintBrush.renderLayer(layer, 1, this.canvasMgr.ctx);
      }
      const placeholder = document.getElementById('canvas-placeholder');
      if (placeholder) placeholder.style.display = 'none';
    }, { passive: false });
    canvas.addEventListener('touchcancel', handleLeave);

    // Store handlers for cleanup
    this._paintHandlers = { handleDown, handleMove, handleUp, handleLeave,
      touchEnd: canvas.addEventListener  // placeholder, actual cleanup in destroy
    };
  }

  /**
   * Toggle between Generate mode and Paint mode.
   * @private
   */
  _togglePaintMode() {
    this._paintMode = !this._paintMode;
    const btn = document.getElementById('btn-paint-mode');
    if (btn) {
      btn.classList.toggle('nav-btn--active', this._paintMode);
    }
    const toolbar = document.getElementById('paint-toolbar');
    if (toolbar) {
      toolbar.classList.toggle('paint-toolbar--active', this._paintMode);
    }
    // Hide placeholder overlay when entering paint mode
    const placeholder = document.getElementById('canvas-placeholder');
    if (placeholder) {
      placeholder.style.display = this._paintMode ? 'none' : '';
    }
    this._setStatus(
      this._paintMode ? 'Paint mode — freehand on active layer' : 'Generate mode',
      false, this._paintMode ? 0 : 2000
    );
  }

  /**
   * Update the status bar with current brush info.
   * @private
   */
  _updatePaintStatus() {
    if (this._paintMode) {
      this._setStatus(
        `Brush: ${this._brushPreset} | Color: ${this._brushColor} | Weight: ${this._brushWeight}`,
        false, 0
      );
    }
  }

  /**
   * Clear the active layer's brush surface.
   * @private
   */
  _clearPaintLayer() {
    const layer = this.engine.getActiveLayer() || this.engine.layers[0];
    if (layer) {
      this.paintBrush.clearLayer(layer.id);
      this.paintBrush.renderLayer(layer, 1, this.canvasMgr.ctx);
      this._setStatus('Paint layer cleared', false, 2000);
      const placeholder = document.getElementById('canvas-placeholder');
      if (placeholder) placeholder.style.display = '';
    }
  }

  /* ─── Drag and Drop ────────────────────────────────────────────── */

  /**
   * Set up drag-and-drop image upload on the canvas area.
   * @private
   */
  _setupDragDrop() {
    const dropZone = document.getElementById("canvas-area");
    if (!dropZone) return;

    const handlers = this.canvasMgr.setupDropZone(dropZone, async (file) => {
      if (!file.type.startsWith("image/")) {
        this._showError("Please drop an image file (PNG, JPG, etc.)");
        return;
      }

      try {
        this._setStatus("Loading image...", true);
        await this.engine.loadImageFile(file);
        this.canvasMgr.setSize(this.engine.width, this.engine.height);
        this.paintBrush.resize(this.engine.width, this.engine.height);
        this._updateStatus();

        const placeholder = document.getElementById("canvas-placeholder");
        if (placeholder) placeholder.style.display = "none";

        this.engine.render();
      } catch (err) {
        console.error(err);
        this._showError("Failed to load image: " + err.message);
      }
    });

    // Click-to-open via placeholder
    const picker = dropZone.querySelector(".file-input-picker");
    if (picker) {
      picker.addEventListener("change", async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = "";
        handlers.unhighlight();
        if (!file.type.startsWith("image/")) {
          this._showError("Please select an image file");
          return;
        }
        try {
          this._setStatus("Loading image...", true);
          await this.engine.loadImageFile(file);
          this.canvasMgr.setSize(this.engine.width, this.engine.height);
          this.paintBrush.resize(this.engine.width, this.engine.height);
          this._updateStatus();
          const placeholder = document.getElementById("canvas-placeholder");
          if (placeholder) placeholder.style.display = "none";
          this.engine.render();
        } catch (err) {
          console.error(err);
          this._showError("Failed to load image: " + err.message);
        }
      });
    }
  }

  /* ─── Event Handlers ────────────────────────────────────────── */

  /**
   * Handle settings changes from the controls panel.
   * Re-renders if there are existing strokes (for non-style changes).
   * @param {{key: string, value: *, settings: object}} detail
   * @private
   */
  _onSettingsChange(detail) {
    if (detail.key === "style") {
      this._setStatus("Style: " + detail.value, false, 2000);
    }

    // Re-render if we have existing strokes and the change is visual
    if (this.engine.getTotalStrokes() > 0 && detail.key !== "style") {
      this.engine.render();
    }
  }

  /* ─── Core Actions ──────────────────────────────────────────── */

  /**
   * Run the painting generation pipeline.
   * Updates settings from controls, generates strokes, renders progressively.
   */
  async generate() {
    if (this._generating) {
      this._showError("Generation already in progress");
      return;
    }

    if (!this.engine._sourceImage) {
      this._showError("No image loaded");
      return;
    }

    this._generating = true;
    const genBtn = this.controls.root.querySelector('[data-action="generate"]');
    if (genBtn) genBtn.setAttribute("disabled", "disabled");
    this._setStatus("Generating strokes...", true);

    try {
      const settings = this.controls.getSettings();
      this.engine.setSettings(settings);

      const startTime = performance.now();

      // Clear the canvas once so we start from the background, then stream each
      // generated stroke live onto the canvas.
      this.canvasMgr.render({ progress: 0, clear: true });

      let strokeCount = 0;
      const strokes = await this.engine.generate({
        style: settings.style,
        count: settings.strokeCount,
        layer: 0,
        smart: settings.smart,
        order: settings.order,
        onShape: (shape) => {
          this.canvasMgr.drawStroke(shape, 1);
          strokeCount++;
          if (strokeCount % 50 === 0) {
            this._setStatus(
              "Generating… " + strokeCount.toLocaleString() + " strokes",
              true,
              0,
              true
            );
          }
        },
      });

      // Safety re-render so the finished painting is fully consistent with the
      // stored strokes (cheap, not an animation).
      this.engine.render();

      const elapsed = performance.now() - startTime;
      const totalStrokes = strokes.length;

      // Update layers panel
      this.layers.setLayers(this.engine.layers);

      // Refresh the motion playback counter so it reflects the new stroke count
      this.motion?.refreshStrokeCount?.();

      this._setStatus(
        "Done — " + totalStrokes.toLocaleString() + " strokes in " + Math.round(elapsed) + "ms",
        false,
        5000
      );
    } catch (err) {
      console.error(err);
      this._showError("Generation failed: " + err.message);
      this._setStatus("Generation failed", false, 5000);
    } finally {
      this._generating = false;
      const genBtn = this.controls.root.querySelector('[data-action="generate"]');
      if (genBtn) genBtn.removeAttribute("disabled");
    }
  }

  /* ─── Export Handlers ───────────────────────────────────────── */

  /**
   * Export the painting as an image (PNG or JPG).
   * @param {object} opts
   * @private
   */
  async _handleExportImage(opts) {
    if (!this.engine._sourceImage) {
      this._showError("No painting to export");
      return;
    }

    try {
      const blob = opts.format === "jpg"
        ? await this.engine.exportJPG({
            width: opts.width || this.engine.width,
            height: opts.height || this.engine.height,
            quality: opts.quality,
            background: opts.background,
          })
        : await this.engine.exportPNG({
            width: opts.width || this.engine.width,
            height: opts.height || this.engine.height,
            quality: opts.quality,
            background: opts.background,
          });

      this._downloadBlob(blob, "www-paint-export." + opts.format);
      this.exportMgr.hide();
    } catch (err) {
      console.error(err);
      this._showError("Export failed: " + err.message);
    }
  }

  /**
   * Export as self-contained HTML.
   * @private
   */
  async _handleExportHTML() {
    if (!this.engine._sourceImage) {
      this._showError("No painting to export");
      return;
    }

    try {
      const html = this.engine.exportHTML({
        format: "packed",
        width: this.engine.width,
        height: this.engine.height,
        background: this.engine.background,
      });

      const blob = new Blob([html], { type: "text/html" });
      this._downloadBlob(blob, "www-paint-export.html");
      this.exportMgr.hide();
    } catch (err) {
      console.error(err);
      this._showError("HTML export failed: " + err.message);
    }
  }

  /**
   * Export as SVG.
   * @private
   */
  async _handleExportSVG() {
    if (!this.engine._sourceImage) {
      this._showError("No painting to export");
      return;
    }

    try {
      const svg = this.engine.exportSVG({
        width: this.engine.width,
        height: this.engine.height,
        background: this.engine.background,
      });

      const blob = new Blob([svg], { type: "image/svg+xml" });
      this._downloadBlob(blob, "www-paint-export.svg");
      this.exportMgr.hide();
    } catch (err) {
      console.error(err);
      this._showError("SVG export failed: " + err.message);
    }
  }

  /**
   * Save the current project as JSON.
   * @private
   */
  _handleSaveProject() {
    if (!this.engine._sourceImage) {
      this._showError("No project to save");
      return;
    }

    try {
      const json = this.engine.exportProject({ embedImage: true });
      const blob = new Blob([json], { type: "application/json" });
      this._downloadBlob(blob, "www-paint-project.json");
      this.exportMgr.hide();
    } catch (err) {
      console.error(err);
      this._showError("Project save failed: " + err.message);
    }
  }

  /**
   * Handle the Load Project button click.
   * @private
   */
  _handleLoadProjectClick() {
    const fileInput = this.exportRoot.querySelector('[data-action="load-project-file"]');
    if (fileInput) fileInput.click();
  }

  /**
   * Handle loading a project file.
   * @param {File} file
   * @private
   */
  async _handleLoadProjectFile(file) {
    if (!file) return;

    try {
      this._setStatus("Loading project...", true);
      const text = await file.text();
      await this.engine.importProject(text);

      // Update all panels
      this.layers.setLayers(this.engine.layers);
      this.controls.setSettings(this.engine.settings);
      this.canvasMgr.setSize(this.engine.width, this.engine.height);
      this.paintBrush.resize(this.engine.width, this.engine.height);
      this.canvasMgr.setBackground(this.engine.background);
      this.engine.render();

      this._updateStatus();
      this._setStatus("Project loaded successfully", false, 2000);
      this.exportMgr.hide();
    } catch (err) {
      console.error(err);
      this._showError("Failed to load project: " + err.message);
    }
  }

  /* ─── Utility ───────────────────────────────────────────────── */

  /**
   * Download a blob as a file.
   * @param {Blob} blob
   * @param {string} filename
   * @private
   */
  _downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Update the status bar with current painting information.
   * @private
   */
  _updateStatus() {
    if (!this.statusBar) return;

    const totalStrokes = this.engine.getTotalStrokes();
    const style = this.engine.settings.style || "pencil";
    const layerCount = this.engine.layers.length;
    const visibleLayers = this.engine.layers.filter((l) => l.visible).length;

    this.statusBar.innerHTML = `
      <span class="status-item">
        <span class="status-label">Style</span>
        <span class="status-value">${style}</span>
      </span>
      <span class="status-item">
        <span class="status-label">Strokes</span>
        <span class="status-value">${totalStrokes.toLocaleString()}</span>
      </span>
      <span class="status-item">
        <span class="status-label">Layers</span>
        <span class="status-value">${visibleLayers}/${layerCount}</span>
      </span>
      <span class="status-item status-item--spacer">
        <span class="status__message" id="status-message">Ready</span>
      </span>
    `;
  }

  /**
   * Set the status bar message.
   * @param {string} message
   * @param {boolean} [loading=false]
   * @param {number} [duration=0] — auto-clear after ms (0 = no auto-clear)
   * @private
   */
  _setStatus(message, loading = false, duration = 0) {
    if (!this.statusBar) return;

    let msgEl = this.statusBar.querySelector("#status-message");
    if (!msgEl) {
      const item = document.createElement("span");
      item.className = "status-item status-item--spacer";
      msgEl = document.createElement("span");
      msgEl.className = "status__message";
      msgEl.id = "status-message";
      item.appendChild(msgEl);
      this.statusBar.appendChild(item);
    }

    msgEl.textContent = message;
    msgEl.classList.toggle("status__loading", loading);

    if (this._statusTimeout) clearTimeout(this._statusTimeout);

    if (duration > 0) {
      this._statusTimeout = setTimeout(() => {
        msgEl.textContent = "Ready";
        msgEl.classList.remove("status__loading", "status__error");
      }, duration);
    }
  }

  /**
   * Show an error message (temporarily).
   * @param {string} message
   * @private
   */
  _showError(message) {
    if (!this.statusBar) return;

    let msgEl = this.statusBar.querySelector("#status-message");
    if (!msgEl) {
      const item = document.createElement("span");
      item.className = "status-item status-item--spacer";
      msgEl = document.createElement("span");
      msgEl.className = "status__message";
      msgEl.id = "status-message";
      item.appendChild(msgEl);
      this.statusBar.appendChild(item);
    }

    msgEl.textContent = message;
    msgEl.classList.add("status__error");
    msgEl.classList.remove("status__loading");

    if (this._statusTimeout) clearTimeout(this._statusTimeout);
    this._statusTimeout = setTimeout(() => {
      msgEl.textContent = "Ready";
      msgEl.classList.remove("status__error", "status__loading");
    }, 4000);
  }

  /* ─── Teardown ──────────────────────────────────────────────── */

  /**
   * Clean up all managers and event listeners.
   */
  destroy() {
    if (this._statusTimeout) clearTimeout(this._statusTimeout);
    this.canvasMgr?.destroy();
    this.engine?.destroy();
    this.controls?.destroy();
    this.layers?.destroy();
    this.exportMgr?.destroy();
    this.motion?.destroy();
    if (this.paintBrush) {
      for (const [layerId] of this.paintBrush.surfaces) {
        this.paintBrush.removeLayer(layerId);
      }
    }
  }
}

/**
 * Initialize the WWW_PAINT application from the DOM.
 * Call this from the main module script once the DOM is ready.
 *
 * @returns {App|null}
 */
export function initApp() {
  const canvas = document.getElementById("paint-canvas");
  const controlsRoot = document.getElementById("controls-root");
  const layersRoot = document.getElementById("layers-root");
  const exportRoot = document.getElementById("export-root");
  const statusBar = document.getElementById("status-bar");

  if (!canvas || !controlsRoot || !layersRoot || !exportRoot) {
    console.error(
      "WWW_PAINT: Required DOM elements missing. " +
        "Ensure #paint-canvas, #controls-root, #layers-root, and #export-root exist."
    );
    return null;
  }

  return new App({
    canvas,
    controlsRoot,
    layersRoot,
    exportRoot,
    statusBar,
  });
}

export default App;
