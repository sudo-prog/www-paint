/**
 * App Controller — the main orchestrator that wires together the engine,
 * canvas manager, controls panel, layers panel, and export dialog.
 *
 * Nothing Design System: inline styles removed, tokens used via CSS.
 *
 * This module is the single entry point initialized from index.html's
 * top-level module script. It owns application state, coordinates async
 * generation runs, updates the status bar, and dispatches UI events.
 *
 * @module app
 */

import { PaintingEngine } from '../engine/engine.js';
import { CanvasManager } from './canvas.js';
import { ControlsManager } from './controls.js';
import { LayersManager } from './layers.js';
import { ExportManager } from './export.js';

/**
 * WWW_PAINT Application Controller.
 *
 * Nothing Design: background uses --black token, borders use --border.
 *
 * @param {object} opts
 * @param {HTMLCanvasElement} opts.canvas
 * @param {HTMLElement} opts.controlsRoot - Controls panel container
 * @param {HTMLElement} opts.layersRoot - Layers panel container
 * @param {HTMLElement} opts.exportRoot - Export dialog container
 * @param {HTMLElement} [opts.statusBar] - Status bar element
 */
export class App {
  constructor(opts = {}) {
    if (!opts.canvas) throw new Error('App requires a canvas element');
    if (!opts.controlsRoot) throw new Error('App requires a controls root');
    if (!opts.layersRoot) throw new Error('App requires a layers root');
    if (!opts.exportRoot) throw new Error('App requires an export root');

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
    this._generateAbort = null;

    this._init();
  }

  // ─── Initialization ───────────────────────────────────────────

  /**
   * Initialize all managers and bind cross-module events.
   * Private — called from constructor.
   */
  _init() {
    // Create canvas manager
    // Nothing Design: OLED black background
    this.canvasMgr = new CanvasManager(this.canvasEl, {
      background: getComputedStyle(document.documentElement)
        .getPropertyValue('--black').trim() || '#000000',
      dpr: window.devicePixelRatio || 1,
    });

    // Create engine
    this.engine = new PaintingEngine({
      canvas: this.canvasEl,
      width: this.canvasEl.width,
      height: this.canvasEl.height,
      useWorker: false,
      background: getComputedStyle(document.documentElement)
        .getPropertyValue('--black').trim() || '#000000',
    });

    // Wire canvas manager's renderer to engine's renderer
    this.engine.renderer = this.canvasMgr.renderer;

    // Create controls
    this.controls = new ControlsManager(this.controlsRoot, {
      initialSettings: this.engine.settings,
    });

    // Create layers
    this.layers = new LayersManager(this.layersRoot);

    // Create export
    this.exportMgr = new ExportManager(this.exportRoot);

    // Sync layers to engine
    this.layers.setLayers(this.engine.layers);

    // Bind events
    this._bindAllEvents();

    // Setup drag-and-drop on the main canvas area
    this._setupDragDrop();

    // Update status
    this._updateStatus();
  }

  /**
   * Bind all cross-module event listeners.
   * Private.
   */
  _bindAllEvents() {
    // Controls → App
    this.controls.root.addEventListener('settings-change', (e) => {
      this._onSettingsChange(e.detail);
    });

    this.controls.root.addEventListener('generate', () => {
      this.generate();
    });

    // Layers → App
    this.layers.root.addEventListener('layer-add', () => {
      const layer = this.engine.addLayer();
      this.layers.setLayers(this.engine.layers);
    });

    this.layers.root.addEventListener('layer-delete', (e) => {
      this.engine.removeLayer(e.detail.layerId);
      this.layers.setLayers(this.engine.layers);
    });

    this.layers.root.addEventListener('layer-duplicate', (e) => {
      this.engine.duplicateLayer(e.detail.layerId);
      this.layers.setLayers(this.engine.layers);
    });

    this.layers.root.addEventListener('layer-toggle-visibility', (e) => {
      const layer = this.engine.getLayer(e.detail.layerId);
      if (layer) {
        layer.visible = !layer.visible;
        this.engine.renderer.setLayers(this.engine.layers);
        this.engine.render();
      }
    });

    this.layers.root.addEventListener('layer-opacity-change', (e) => {
      const layer = this.engine.getLayer(e.detail.layerId);
      if (layer) {
        layer.opacity = e.detail.opacity;
        this.engine.render();
      }
    });

    this.layers.root.addEventListener('layer-blend-change', (e) => {
      const layer = this.engine.getLayer(e.detail.layerId);
      if (layer) {
        layer.blendMode = e.detail.blendMode;
        this.engine.render();
      }
    });

    // Export → App
    this.exportMgr.root.addEventListener('export-image', (e) => {
      this._handleExportImage(e.detail);
    });
    this.exportMgr.root.addEventListener('export-html', () => {
      this._handleExportHTML();
    });
    this.exportMgr.root.addEventListener('save-project', () => {
      this._handleSaveProject();
    });
    this.exportMgr.root.addEventListener('load-project', () => {
      this._handleLoadProjectClick();
    });
    this.exportMgr.root.addEventListener('load-project-file', (e) => {
      this._handleLoadProjectFile(e.detail.file);
    });
  }

  /**
   * Set up drag-and-drop image upload on the canvas area.
   * Private.
   */
  _setupDragDrop() {
    const dropZone = this.canvasEl.parentElement;
    if (!dropZone) return;

    const handlers = this.canvasMgr.setupDropZone(dropZone, async (file) => {
      if (!file.type.startsWith('image/')) {
        this._showError('Please drop an image file (PNG, JPG, etc.)');
        return;
      }

      try {
        this._setStatus('Loading image...', true);
        await this.engine.loadImageFile(file);

        // Update canvas size display
        this.canvasMgr.renderer.setSize(this.engine.width, this.engine.height);
        this.canvasMgr.clear();
        this._updateStatus();

        // Hide placeholder overlay if present
        const overlay = dropZone.querySelector('.canvas-placeholder');
        if (overlay) overlay.style.display = 'none';
      } catch (err) {
        console.error(err);
        this._showError(`Failed to load image: ${err.message}`);
      }
    });

    // Also handle click-to-open file picker
    const fileInput = dropZone.querySelector('.file-input-picker');
    if (fileInput) {
      fileInput.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';
        handlers.unhighlight();
        if (!file.type.startsWith('image/')) {
          this._showError('Please select an image file (PNG, JPG, etc.)');
          return;
        }
        try {
          this._setStatus('Loading image...', true);
          await this.engine.loadImageFile(file);
          this.canvasMgr.renderer.setSize(this.engine.width, this.engine.height);
          this.canvasMgr.clear();
          this._updateStatus();
          const overlay = dropZone.querySelector('.canvas-placeholder');
          if (overlay) overlay.style.display = 'none';
        } catch (err) {
          console.error(err);
          this._showError(`Failed to load image: ${err.message}`);
        }
      });
    }
  }

  // ─── Event Handlers ───────────────────────────────────────────

  /**
   * Handle settings changes from the controls panel.
   * @param {{key: string, value: *, settings: object}} detail
   * @private
   */
  _onSettingsChange(detail) {
    if (detail.key === 'style') {
      this._setStatus(`Style: ${detail.value}`, false, 2000);
    }
    // Re-render if we have existing strokes and the change is visual
    if (this.engine.getTotalStrokes() > 0 && detail.key !== 'style') {
      this.engine.render();
    }
  }

  // ─── Core Actions ─────────────────────────────────────────────

  /**
   * Run the painting generation pipeline.
   * Updates settings from controls, generates strokes, renders progressively.
   */
  async generate() {
    if (this._generating) {
      this._showError('Generation already in progress');
      return;
    }

    if (!this.engine._sourceImage) {
      this._showError('No image loaded');
      return;
    }

    this._generating = true;
    this.controls.root.querySelector('[data-action="generate"]')
      ?.setAttribute('disabled', 'disabled');
    this._setStatus('Generating strokes...', true);

    try {
      const settings = this.controls.getSettings();
      this.engine.setSettings(settings);

      const startTime = performance.now();

      const strokes = await this.engine.generate({
        style: settings.style,
        count: settings.strokeCount,
        layer: 0,
      });

      const elapsed = performance.now() - startTime;
      const totalStrokes = strokes.length;

      // Update layers panel
      this.layers.setLayers(this.engine.layers);

      // Animate the render
      this.engine.render({ progress: 0 });
      await this.canvasMgr.renderAnimated({
        duration: Math.min(3000, Math.max(1000, totalStrokes * 5)),
        onFrame: (progress) => {
          this._setStatus(`Rendering strokes... ${Math.round(progress * totalStrokes)} / ${totalStrokes}`, true, 0, true);
        },
      });

      this._setStatus(
        `Done — ${totalStrokes.toLocaleString()} strokes in ${Math.round(elapsed)}ms`,
        false,
        5000
      );
    } catch (err) {
      console.error(err);
      this._showError(`Generation failed: ${err.message}`);
      this._setStatus('Generation failed', false, 5000);
    } finally {
      this._generating = false;
      this.controls.root.querySelector('[data-action="generate"]')
        ?.removeAttribute('disabled');
    }
  }

  // ─── Export Handlers ──────────────────────────────────────────

  /**
   * Export the painting as an image (PNG or JPG).
   * @param {object} opts
   * @private
   */
  async _handleExportImage(opts) {
    if (!this.engine._sourceImage) {
      this._showError('No painting to export');
      return;
    }

    try {
      this.exportMgr._emit('export-start');
      const blob = opts.format === 'jpg'
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

      this._downloadBlob(blob, `www-paint-export.${opts.format}`);
      this.exportMgr.hide();
    } catch (err) {
      console.error(err);
      this._showError(`Export failed: ${err.message}`);
    }
  }

  /**
   * Export as self-contained HTML.
   * @private
   */
  async _handleExportHTML() {
    if (!this.engine._sourceImage) {
      this._showError('No painting to export');
      return;
    }

    try {
      const html = this.engine.exportHTML({
        format: 'packed',
        width: this.engine.width,
        height: this.engine.height,
        background: this.engine.background,
      });

      const blob = new Blob([html], { type: 'text/html' });
      this._downloadBlob(blob, 'www-paint-export.html');
      this.exportMgr.hide();
    } catch (err) {
      console.error(err);
      this._showError(`HTML export failed: ${err.message}`);
    }
  }

  /**
   * Save the current project as JSON.
   * @private
   */
  _handleSaveProject() {
    if (!this.engine._sourceImage) {
      this._showError('No project to save');
      return;
    }

    try {
      const json = this.engine.exportProject({ embedImage: true });
      const blob = new Blob([json], { type: 'application/json' });
      this._downloadBlob(blob, 'www-paint-project.json');
      this.exportMgr.hide();
    } catch (err) {
      console.error(err);
      this._showError(`Project save failed: ${err.message}`);
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
      const text = await file.text();
      await this.engine.importProject(text);

      // Update all panels
      this.layers.setLayers(this.engine.layers);
      this.controls.setSettings(this.engine.settings);
      this.canvasMgr.setSize(this.engine.width, this.engine.height);
      this.canvasMgr.setBackground(this.engine.background);
      this.engine.render();

      this._updateStatus();
      this._showError('Project loaded successfully', false);
      this.exportMgr.hide();
    } catch (err) {
      console.error(err);
      this._showError(`Failed to load project: ${err.message}`);
    }
  }

  // ─── Utility ──────────────────────────────────────────────────

  /**
   * Download a blob as a file.
   * @param {Blob} blob
   * @param {string} filename
   * @private
   */
  _downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Update the status bar with current information.
   * Nothing Design: Space Mono data/readout pairs.
   * @private
   */
  _updateStatus() {
    if (!this.statusBar) return;

    const totalStrokes = this.engine.getTotalStrokes();
    const style = this.engine.settings.style || 'pencil';
    const layerCount = this.engine.layers.length;
    const visibleLayers = this.engine.layers.filter(l => l.visible).length;

    // Safe: status bar uses fixed labels and number.toLocaleString() (no raw user input)
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
        <span class="status-value status__message" id="status-message">Ready</span>
      </span>
    `;
  }

  /**
   * Set the status bar message.
   * @param {string} message
   * @param {boolean} [loading=false] - Show loading indicator
   * @param {number} [duration=0] - Auto-clear after ms (0 = no auto-clear)
   * @param {boolean} [append=false] - Append to existing message
   * @private
   */
  _setStatus(message, loading = false, duration = 0, append = false) {
    if (!this.statusBar) return;

    let msgEl = this.statusBar.querySelector('#status-message');
    if (!msgEl) {
      const item = document.createElement('span');
      item.className = 'status-item status-item--spacer';
      msgEl = document.createElement('span');
      msgEl.className = 'status-value status__message';
      msgEl.id = 'status-message';
      item.appendChild(msgEl);
      this.statusBar.appendChild(item);
    }

    msgEl.textContent = message;
    msgEl.classList.toggle('status__loading', loading);

    // Clear any existing timeout
    if (this._statusTimeout) clearTimeout(this._statusTimeout);

    if (duration > 0) {
      this._statusTimeout = setTimeout(() => {
        msgEl.textContent = 'Ready';
        msgEl.classList.remove('status__loading');
      }, duration);
    }
  }

  /**
   * Show an error message (temporarily).
   * Nothing Design: inline status text with accent color.
   * @param {string} message
   * @param {boolean} [isError=true]
   * @private
   */
  _showError(message, isError = true) {
    if (!this.statusBar) return;

    let msgEl = this.statusBar.querySelector('#status-message');
    if (!msgEl) {
      const item = document.createElement('span');
      item.className = 'status-item status-item--spacer';
      msgEl = document.createElement('span');
      msgEl.className = 'status-value status__message';
      msgEl.id = 'status-message';
      item.appendChild(msgEl);
      this.statusBar.appendChild(item);
    }

    msgEl.textContent = message;
    msgEl.classList.toggle('status__error', isError);

    if (this._statusTimeout) clearTimeout(this._statusTimeout);
    this._statusTimeout = setTimeout(() => {
      msgEl.textContent = 'Ready';
      msgEl.classList.remove('status__error', 'status__loading');
    }, 4000);
  }

  // ─── Teardown ─────────────────────────────────────────────────

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
  }
}

/**
 * Initialize the WWW_PAINT application from the DOM.
 * Call this from the main module script once the DOM is ready.
 *
 * @returns {App|null}
 */
export function initApp() {
  const canvas = document.getElementById('paint-canvas');
  const controlsRoot = document.getElementById('controls-root');
  const layersRoot = document.getElementById('layers-root');
  const exportRoot = document.getElementById('export-root');
  const statusBar = document.getElementById('status-bar');

  if (!canvas || !controlsRoot || !layersRoot || !exportRoot) {
    console.error('WWW_PAINT: Required DOM elements missing. ' +
      'Ensure #paint-canvas, #controls-root, #layers-root, and #export-root exist.');
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
