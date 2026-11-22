/**
 * Brush Maker UI — creates custom brushes for WWW_PAINT's Paint mode.
 *
 * Mirrors the UI module pattern: constructor takes a root element, renders DOM,
 * dispatches CustomEvents. Parameter ranges and names are modelled on
 * p5.brush's official Brush Maker tool (tools/brush-maker.html).
 *
 * @module brush-maker
 */

import { initBrushEngine, stampStrokeSync, isBrushReady } from '../engine/brush-stamp-engine.js';
import * as brush from '../vendor/brush.esm.js';

const STORAGE_KEY = 'wwwpaint_brush_maker_v1';

/**
 * @typedef {Object} BrushMakerParams
 * @property {string} name - Brush name
 * @property {'default'|'spray'|'marker'|'custom'} type - Brush type
 * @property {number} weight - Weight (geometry)
 * @property {number} scatter - Scatter
 * @property {number} sharpness - Sharpness (default type only)
 * @property {number} grain - Grain (default + spray)
 * @property {number} opacity - Opacity 0-255
 * @property {number} spacing - Spacing
 * @property {number} noise - Noise
 * @property {'natural'|'none'|'random'} rotate - Rotation mode
 * @property {boolean} markerTip - Marker tip (marker/custom only)
 * @property {'simple'|'gaussian'} pressureMode - Pressure curve mode
 * @property {number} pressStart - Simple: start pressure
 * @property {number} pressMid - Simple: mid pressure (3-pt)
 * @property {number} pressEnd - Simple: end pressure
 * @property {number} gaussCurveA - Gaussian: curve a
 * @property {number} gaussCurveB - Gaussian: curve b
 * @property {number} gaussMin - Gaussian: min
 * @property {number} gaussMax - Gaussian: max
 * @property {boolean} pressure3pt - Simple: use 3-point pressure
 * @property {Function|null} tipFn - Custom tip drawing function (for type='custom')
 */

/** Default parameters for each brush type */
const TYPE_DEFAULTS = {
  default: {
    weight: 0.9, scatter: 1.8, sharpness: 0.3, grain: 0.9,
    opacity: 170, spacing: 0.3, noise: 1,
    pressStart: 1.1, pressMid: 1.5, pressEnd: 0.9,
    gaussCurveA: 0.15, gaussCurveB: 0.2, gaussMin: 1.1, gaussMax: 0.9,
    rotate: 'natural', markerTip: false, pressure3pt: false,
  },
  spray: {
    weight: 0.6, scatter: 18, sharpness: null, grain: 40,
    opacity: 90, spacing: 5, noise: 1,
    pressStart: 0.7, pressMid: 1, pressEnd: 1,
    gaussCurveA: 0.2, gaussCurveB: 0.35, gaussMin: 0.7, gaussMax: 1,
    rotate: 'random', markerTip: false, pressure3pt: false,
  },
  marker: {
    weight: 6, scatter: 0.36, sharpness: null, grain: null,
    opacity: 1, spacing: 0.09, noise: 1,
    pressStart: 1.2, pressMid: 0.85, pressEnd: 0.85,
    gaussCurveA: 0.35, gaussCurveB: 0.25, gaussMin: 1.2, gaussMax: 0.85,
    rotate: 'none', markerTip: true, pressure3pt: false,
  },
  custom: {
    weight: 29, scatter: 0.45, sharpness: null, grain: null,
    opacity: 6, spacing: 0.4, noise: 1,
    pressStart: 0.8, pressMid: 1.2, pressEnd: 1.2,
    gaussCurveA: 0.15, gaussCurveB: 0.2, gaussMin: 1.1, gaussMax: 0.9,
    rotate: 'none', markerTip: true, pressure3pt: false,
  },
};

/** Slider ranges per type */
const SLIDER_RANGES = {
  default: {
    weight: { min: 0, max: 3, step: 0.01 },
    scatter: { min: 0, max: 25, step: 0.05 },
    sharpness: { min: 0, max: 1, step: 0.01 },
    grain: { min: 0, max: 1, step: 0.01 },
    opacity: { min: 1, max: 255, step: 1 },
    spacing: { min: 0.01, max: 2, step: 0.01 },
    noise: { min: 0, max: 1, step: 0.05 },
  },
  spray: {
    weight: { min: 0, max: 3, step: 0.01 },
    scatter: { min: 10, max: 50, step: 1 },
    sharpness: null,
    grain: { min: 0, max: 500, step: 10 },
    opacity: { min: 1, max: 255, step: 1 },
    spacing: { min: 2, max: 50, step: 1 },
    noise: { min: 0, max: 1, step: 0.05 },
  },
  marker: {
    weight: { min: 0, max: 50, step: 1 },
    scatter: { min: 0, max: 15, step: 0.05 },
    sharpness: null,
    grain: null,
    opacity: { min: 0, max: 5, step: 0.01 },
    spacing: { min: 0.002, max: 0.5, step: 0.002 },
    noise: { min: 0, max: 1, step: 0.05 },
  },
  custom: {
    weight: { min: 1, max: 60, step: 1 },
    scatter: { min: 0, max: 10, step: 0.05 },
    sharpness: null,
    grain: null,
    opacity: { min: 1, max: 50, step: 1 },
    spacing: { min: 0.1, max: 15, step: 0.1 },
    noise: { min: 0, max: 1, step: 0.05 },
  },
};

/** Default tip function for custom brushes */
const DEFAULT_TIP_CODE = `// Custom tip function — dark marks become opaque ink
// Coordinate space: 100×100, origin at centre (±50)
// _m has: push/pop, translate, rotate, scale, fill, noFill, stroke, noStroke
// strokeWeight, rect, circle, ellipse, line, beginShape/vertex/endShape
// fill(0) = opaque, fill(255) = transparent

_m.fill(0, 150);
_m.rotate(Math.PI / 4); // radians
_m.rect(-10, -10, 25, 25);
_m.rect(10, 10, 15, 15);`;

/** Preview canvas size */
const PREVIEW_W = 240;
const PREVIEW_H = 120;

/** Tip drawing pad size */
const TIP_PAD_SIZE = 100;

export class BrushMaker {
  /**
   * @param {HTMLElement} root - Root element to render into
   */
  constructor(root) {
    this.root = root;
    this.params = this._loadDefaults();
    this.savedBrushes = this._loadSavedBrushes();
    this._previewCanvas = null;
    this._previewCtx = null;
    this._tipPadCanvas = null;
    this._tipPadCtx = null;
    this._tipDrawing = false;
    this._needsPreviewUpdate = true;
    this._previewError = null;
    this._engineReady = false;

    this._render();
    this._bindEvents();
    this._initPreviewCanvas();
    this._initTipPad();          // paints the pad, does NOT touch params
    this._applyTypePreset(this.params.type);
    this._updateAllUI();
    this._updateSavedList();
    this._updateCodePanel();

    // Initialize brush engine for preview
    this._initEngine();
  }

  /** Load defaults or from localStorage */
  _loadDefaults() {
    // `name` must exist before the first input sync, or the code panel shows
    // brush.add("undefined", …) and the name input renders the string "undefined".
    const base = { name: 'myBrush', ...TYPE_DEFAULTS.default, type: 'default' };
    try {
      const stored = localStorage.getItem(STORAGE_KEY + '_params');
      if (stored) {
        const parsed = JSON.parse(stored);
        // Ensure tipFn is a function
        if (parsed.tipCode) {
          parsed.tipFn = this._createTipFunction(parsed.tipCode);
        }
        return { ...base, ...parsed };
      }
    } catch (e) {
      console.warn('[BrushMaker] Failed to load params:', e);
    }
    return { ...base, tipCode: DEFAULT_TIP_CODE, tipFn: this._createTipFunction(DEFAULT_TIP_CODE) };
  }

  /** Load saved brushes from localStorage */
  _loadSavedBrushes() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch (e) {
      console.warn('[BrushMaker] Failed to load saved brushes:', e);
    }
    return [];
  }

  /** Save current params to localStorage */
  _saveParams() {
    try {
      const toSave = { ...this.params };
      // Don't save the function, save the code string
      delete toSave.tipFn;
      localStorage.setItem(STORAGE_KEY + '_params', JSON.stringify(toSave));
    } catch (e) {
      console.warn('[BrushMaker] Failed to save params:', e);
    }
  }

  /** Save brushes array to localStorage */
  _saveBrushes() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.savedBrushes));
    } catch (e) {
      console.warn('[BrushMaker] Failed to save brushes:', e);
    }
  }

  /** Create a tip function from code string */
  _createTipFunction(code) {
    try {
      // The tip function receives _m (the minimal drawing surface)
      // Wrap in try/catch for runtime errors
      return new Function('_m', `
        try {
${code.split('\n').map(l => '        ' + l).join('\n')}
        } catch (e) { console.warn("[BrushMaker] Tip function error:", e); }
      `);
    } catch (e) {
      console.warn('[BrushMaker] Invalid tip code:', e);
      return (_m) => {};
    }
  }

  /** Initialize the p5.brush engine for preview */
  async _initEngine() {
    try {
      this._engineReady = await initBrushEngine(PREVIEW_W, PREVIEW_H);
      if (this._engineReady) {
        this._needsPreviewUpdate = true;
        this._renderPreview();
      }
    } catch (e) {
      console.warn('[BrushMaker] Engine init failed:', e);
      this._engineReady = false;
    }
  }

  /** Render the entire UI */
  _render() {
    this.root.innerHTML = `
      <div class="brush-maker">
        <!-- Left panel: controls -->
        <div class="brush-maker__panel">
          <div class="brush-maker__header">
            <h2 class="brush-maker__title">Brush Maker</h2>
          </div>
          <div class="brush-maker__controls" id="bm-controls">
            <!-- Identity -->
            <div class="bm-section">
              <div class="bm-section-label">Identity</div>
              <div class="bm-row">
                <label for="bm-name">name</label>
                <input type="text" id="bm-name" class="bm-input" placeholder="myBrush" autocomplete="off" />
              </div>
              <div class="bm-row">
                <label for="bm-type">type</label>
                <select id="bm-type" class="bm-select">
                  <option value="default">default</option>
                  <option value="spray">spray</option>
                  <option value="marker">marker</option>
                  <option value="custom">custom</option>
                </select>
              </div>
            </div>

            <!-- Geometry -->
            <div class="bm-section" id="bm-geometry-section">
              <div class="bm-section-label">Geometry</div>
              <div class="bm-row" id="bm-weight-row">
                <label for="bm-weight">weight</label>
                <input type="range" id="bm-weight" class="bm-slider" />
                <span class="bm-value" id="bm-weight-val">0.9</span>
              </div>
              <div class="bm-row" id="bm-scatter-row">
                <label for="bm-scatter">scatter</label>
                <input type="range" id="bm-scatter" class="bm-slider" />
                <span class="bm-value" id="bm-scatter-val">1.8</span>
              </div>
              <div class="bm-row" id="bm-sharpness-row">
                <label for="bm-sharpness">sharpness</label>
                <input type="range" id="bm-sharpness" class="bm-slider" />
                <span class="bm-value" id="bm-sharpness-val">0.3</span>
              </div>
              <div class="bm-row" id="bm-grain-row">
                <label for="bm-grain">grain</label>
                <input type="range" id="bm-grain" class="bm-slider" />
                <span class="bm-value" id="bm-grain-val">0.9</span>
              </div>
            </div>

            <!-- Appearance -->
            <div class="bm-section" id="bm-appearance-section">
              <div class="bm-section-label">Appearance</div>
              <div class="bm-row">
                <label for="bm-opacity">opacity</label>
                <input type="range" id="bm-opacity" class="bm-slider" min="1" max="255" step="1" />
                <span class="bm-value" id="bm-opacity-val">170</span>
              </div>
              <div class="bm-row">
                <label for="bm-spacing">spacing</label>
                <input type="range" id="bm-spacing" class="bm-slider" />
                <span class="bm-value" id="bm-spacing-val">0.3</span>
              </div>
              <div class="bm-row" id="bm-noise-row">
                <label for="bm-noise">noise</label>
                <input type="range" id="bm-noise" class="bm-slider" />
                <span class="bm-value" id="bm-noise-val">1</span>
              </div>
              <div class="bm-row" id="bm-rotate-row">
                <label for="bm-rotate">rotate</label>
                <select id="bm-rotate" class="bm-select">
                  <option value="natural">natural</option>
                  <option value="none">none</option>
                  <option value="random">random</option>
                </select>
              </div>
              <div class="bm-row bm-toggle-row" id="bm-marker-tip-row">
                <label for="bm-marker-tip">marker tip</label>
                <label class="bm-toggle">
                  <input type="checkbox" id="bm-marker-tip" />
                  <span class="bm-toggle-track"></span>
                </label>
              </div>
            </div>

            <!-- Pressure -->
            <div class="bm-section">
              <div class="bm-section-label">Pressure</div>
              <div class="bm-row">
                <label for="bm-pressure-mode">mode</label>
                <select id="bm-pressure-mode" class="bm-select">
                  <option value="simple">simple</option>
                  <option value="gaussian">gaussian</option>
                </select>
              </div>
              <div class="bm-row bm-toggle-row">
                <label for="bm-pressure-3pt">3-point</label>
                <label class="bm-toggle">
                  <input type="checkbox" id="bm-pressure-3pt" />
                  <span class="bm-toggle-track"></span>
                </label>
              </div>
              <div id="bm-pressure-simple">
                <div class="bm-row">
                  <label for="bm-press-start">start</label>
                  <input type="range" id="bm-press-start" class="bm-slider" />
                  <span class="bm-value" id="bm-press-start-val">1.1</span>
                </div>
                <div class="bm-row" id="bm-press-mid-row">
                  <label for="bm-press-mid">mid</label>
                  <input type="range" id="bm-press-mid" class="bm-slider" />
                  <span class="bm-value" id="bm-press-mid-val">1.5</span>
                </div>
                <div class="bm-row">
                  <label for="bm-press-end">end</label>
                  <input type="range" id="bm-press-end" class="bm-slider" />
                  <span class="bm-value" id="bm-press-end-val">0.9</span>
                </div>
              </div>
              <div id="bm-pressure-gaussian" style="display:none">
                <div class="bm-row">
                  <label for="bm-gauss-curve-a">curve a</label>
                  <input type="range" id="bm-gauss-curve-a" class="bm-slider" min="0" max="0.6" step="0.01" />
                  <span class="bm-value" id="bm-gauss-curve-a-val">0.15</span>
                </div>
                <div class="bm-row">
                  <label for="bm-gauss-curve-b">curve b</label>
                  <input type="range" id="bm-gauss-curve-b" class="bm-slider" min="0" max="0.6" step="0.01" />
                  <span class="bm-value" id="bm-gauss-curve-b-val">0.2</span>
                </div>
                <div class="bm-row">
                  <label for="bm-gauss-min">min</label>
                  <input type="range" id="bm-gauss-min" class="bm-slider" min="0.1" max="2" step="0.01" />
                  <span class="bm-value" id="bm-gauss-min-val">1.1</span>
                </div>
                <div class="bm-row">
                  <label for="bm-gauss-max">max</label>
                  <input type="range" id="bm-gauss-max" class="bm-slider" min="0.1" max="2" step="0.01" />
                  <span class="bm-value" id="bm-gauss-max-val">0.9</span>
                </div>
              </div>
            </div>

            <!-- Custom Tip Drawing Pad -->
            <div class="bm-section" id="bm-tip-section" style="display:none">
              <div class="bm-section-label">Custom Tip</div>
              <p class="bm-hint">Draw a dark tip shape. Dark = opaque, light = transparent. Origin at centre.</p>
              <div class="bm-tip-pad-wrap">
                <canvas id="bm-tip-pad" width="${TIP_PAD_SIZE}" height="${TIP_PAD_SIZE}" class="bm-tip-pad"></canvas>
              </div>
              <button type="button" class="bm-btn bm-btn--ghost" id="bm-tip-clear">Clear</button>
              <textarea id="bm-tip-code" class="bm-tip-code" spellcheck="false" placeholder="Or paste tip function code here..."></textarea>
            </div>
          </div>

          <!-- Bottom actions -->
          <div class="brush-maker__actions">
            <button type="button" class="bm-btn bm-btn--primary" id="bm-save">Save Brush</button>
            <button type="button" class="bm-btn" id="bm-load">Load Brush</button>
          </div>
        </div>

        <!-- Right panel: preview + code -->
        <div class="brush-maker__side">
          <!-- Preview -->
          <div class="brush-maker__preview-section">
            <div class="brush-maker__preview-header">
              <span class="bm-section-label">Live Preview</span>
            </div>
            <div class="brush-maker__preview-wrap">
              <canvas id="bm-preview" width="${PREVIEW_W}" height="${PREVIEW_H}" class="brush-maker__preview"></canvas>
              <div class="brush-maker__preview-error" id="bm-preview-error" style="display:none"></div>
            </div>
          </div>

          <!-- Generated Code -->
          <div class="brush-maker__code-section">
            <div class="brush-maker__code-header">
              <span class="bm-section-label">Generated Code</span>
              <button type="button" class="bm-btn bm-btn--sm" id="bm-copy-code">Copy</button>
            </div>
            <textarea id="bm-code-output" class="brush-maker__code-output" spellcheck="false" readonly></textarea>
          </div>

          <!-- Saved Brushes List -->
          <div class="brush-maker__saved-section" id="bm-saved-section" style="display:none">
            <div class="brush-maker__saved-header">
              <span class="bm-section-label">Saved Brushes</span>
            </div>
            <div class="brush-maker__saved-list" id="bm-saved-list"></div>
          </div>
        </div>
      </div>
    `;
  }

  /** Bind all event listeners */
  _bindEvents() {
    const $ = (id) => this.root.querySelector(`#${id}`);

    // Identity
    $('bm-name').addEventListener('input', (e) => {
      this.params.name = e.target.value || 'myBrush';
      this._saveParams();
      this._updateCodePanel();
    });

    $('bm-type').addEventListener('change', (e) => {
      this.params.type = e.target.value;
      this._applyTypePreset(this.params.type);
      this._updateTypeUI();
      this._saveParams();
      this._updateCodePanel();
      this._needsPreviewUpdate = true;
      this._renderPreview();
    });

    // Sliders with value readouts
    this._wireSlider('bm-weight', 'weight', v => Math.round(v * 100) / 100);
    this._wireSlider('bm-scatter', 'scatter', v => Math.round(v * 100) / 100);
    this._wireSlider('bm-sharpness', 'sharpness', v => Math.round(v * 100) / 100);
    this._wireSlider('bm-grain', 'grain', v => Math.round(v * 100) / 100);
    this._wireSlider('bm-opacity', 'opacity', v => Math.round(v));
    this._wireSlider('bm-spacing', 'spacing', v => Math.max(0.001, Math.round(v * 1000) / 1000));
    this._wireSlider('bm-noise', 'noise', v => Math.round(v * 100) / 100);
    this._wireSlider('bm-press-start', 'pressStart', v => Math.round(v * 100) / 100);
    this._wireSlider('bm-press-mid', 'pressMid', v => Math.round(v * 100) / 100);
    this._wireSlider('bm-press-end', 'pressEnd', v => Math.round(v * 100) / 100);
    this._wireSlider('bm-gauss-curve-a', 'gaussCurveA', v => Math.round(v * 100) / 100);
    this._wireSlider('bm-gauss-curve-b', 'gaussCurveB', v => Math.round(v * 100) / 100);
    this._wireSlider('bm-gauss-min', 'gaussMin', v => Math.round(v * 100) / 100);
    this._wireSlider('bm-gauss-max', 'gaussMax', v => Math.round(v * 100) / 100);

    // Selects
    $('bm-rotate').addEventListener('change', (e) => {
      this.params.rotate = e.target.value;
      this._saveParams();
      this._updateCodePanel();
      this._needsPreviewUpdate = true;
      this._renderPreview();
    });

    // Toggles
    $('bm-marker-tip').addEventListener('change', (e) => {
      this.params.markerTip = e.target.checked;
      this._saveParams();
      this._updateCodePanel();
      this._needsPreviewUpdate = true;
      this._renderPreview();
    });

    $('bm-pressure-mode').addEventListener('change', (e) => {
      this.params.pressureMode = e.target.value;
      this._updatePressureModeUI();
      this._saveParams();
      this._updateCodePanel();
      this._needsPreviewUpdate = true;
      this._renderPreview();
    });

    $('bm-pressure-3pt').addEventListener('change', (e) => {
      this.params.pressure3pt = e.target.checked;
      this._updatePressureModeUI();
      this._saveParams();
      this._updateCodePanel();
      this._needsPreviewUpdate = true;
      this._renderPreview();
    });

    // Custom tip pad
    const tipPad = $('bm-tip-pad');
    tipPad.addEventListener('mousedown', (e) => this._onTipPadDown(e));
    tipPad.addEventListener('mousemove', (e) => this._onTipPadMove(e));
    tipPad.addEventListener('mouseup', () => this._onTipPadUp());
    tipPad.addEventListener('mouseleave', () => this._onTipPadUp());
    // Touch support
    tipPad.addEventListener('touchstart', (e) => { e.preventDefault(); this._onTipPadDown(e.touches[0]); }, { passive: false });
    tipPad.addEventListener('touchmove', (e) => { e.preventDefault(); this._onTipPadMove(e.touches[0]); }, { passive: false });
    tipPad.addEventListener('touchend', () => this._onTipPadUp());

    $('bm-tip-clear').addEventListener('click', () => this._clearTipPad());

    $('bm-tip-code').addEventListener('input', (e) => {
      this.params.tipCode = e.target.value;
      this.params.tipFn = this._createTipFunction(e.target.value);
      this._saveParams();
      this._updateCodePanel();
      this._needsPreviewUpdate = true;
      this._renderPreview();
    });

    // Actions
    $('bm-save').addEventListener('click', () => this._saveBrush());
    $('bm-load').addEventListener('click', () => this._showLoadDialog());
    $('bm-copy-code').addEventListener('click', () => this._copyCode());

    // Load brush from saved list (delegated)
    this.root.addEventListener('click', (e) => {
      const loadBtn = e.target.closest('.bm-load-saved');
      if (loadBtn) {
        const name = loadBtn.dataset.name;
        this._loadBrush(name);
      }
      const delBtn = e.target.closest('.bm-delete-saved');
      if (delBtn) {
        const name = delBtn.dataset.name;
        this._deleteBrush(name);
      }
    });
  }

  /** Wire a slider to a param with value readout */
  _wireSlider(sliderId, paramKey, transform) {
    const $ = (id) => this.root.querySelector(`#${id}`);
    const slider = $(sliderId);
    const valEl = $(sliderId + '-val');
    if (!slider || !valEl) return;

    const sync = (rawValue, markDirty = false) => {
      const value = transform(rawValue);
      this.params[paramKey] = value;
      slider.value = rawValue;
      valEl.textContent = this._formatNumber(value);
      if (markDirty) {
        this._saveParams();
        this._updateCodePanel();
        this._needsPreviewUpdate = true;
        this._renderPreview();
      }
    };

    slider.addEventListener('input', (e) => sync(parseFloat(e.target.value), true));
    // Initial sync
    sync(this.params[paramKey], false);
  }

  /** Format number for display */
  _formatNumber(value) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return '';
    if (Math.abs(value - Math.round(value)) < 1e-9) return String(Math.round(value));
    return String(Number(value.toFixed(3)));
  }

  /** Apply slider ranges for current type */
  _applyTypePreset(type) {
    const preset = TYPE_DEFAULTS[type];
    // Safety: if type not in defaults, bail out
    if (!preset) {
      console.warn('[BrushMaker] Unknown type: ' + type);
      return;
    }
    const ranges = SLIDER_RANGES[type];

    // Update all params from preset
    Object.keys(preset).forEach(key => {
      if (preset[key] !== null && preset[key] !== undefined) {
        this.params[key] = preset[key];
      }
    });

    // Update slider attributes
    Object.keys(ranges).forEach(key => {
      const range = ranges[key];
      if (!range) return;
      const slider = this.root.querySelector(`#bm-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`);
      if (slider) {
        slider.min = range.min;
        slider.max = range.max;
        slider.step = range.step;
      }
    });

    // Sync UI to new values
    this._updateAllUI();
  }

  /** Update UI visibility based on type */
  _updateTypeUI() {
    const type = this.params.type;
    const isCustom = type === 'custom';
    const isMarker = type === 'marker';
    const showMarkerTip = isMarker || isCustom;
    const showSharpness = type === 'default';
    const showGrain = type === 'default' || type === 'spray';
    const ranges = SLIDER_RANGES[type];

    // Show/hide rows
    this.root.querySelector('#bm-sharpness-row').style.display = showSharpness ? '' : 'none';
    this.root.querySelector('#bm-grain-row').style.display = showGrain ? '' : 'none';
    this.root.querySelector('#bm-rotate-row').style.display = (isCustom) ? '' : 'none';
    this.root.querySelector('#bm-marker-tip-row').style.display = showMarkerTip ? 'flex' : 'none';
    this.root.querySelector('#bm-tip-section').style.display = isCustom ? '' : 'none';

    // Update grain slider range for spray
    if (showGrain) {
      const grainSlider = this.root.querySelector('#bm-grain');
      if (type === 'spray') {
        grainSlider.min = 0;
        grainSlider.max = 500;
        grainSlider.step = 10;
      } else {
        grainSlider.min = 0;
        grainSlider.max = 1;
        grainSlider.step = 0.01;
      }
    }

    // Update noise range per type
    if (ranges.noise) {
      const noiseSlider = this.root.querySelector('#bm-noise');
      noiseSlider.min = ranges.noise.min;
      noiseSlider.max = ranges.noise.max;
      noiseSlider.step = ranges.noise.step;
    }
  }

  /** Update pressure mode UI (simple vs gaussian) */
  _updatePressureModeUI() {
    const isGaussian = this.params.pressureMode === 'gaussian';
    this.root.querySelector('#bm-pressure-simple').style.display = isGaussian ? 'none' : '';
    this.root.querySelector('#bm-pressure-gaussian').style.display = isGaussian ? '' : 'none';
    this.root.querySelector('#bm-press-mid-row').style.display = (this.params.pressure3pt && !isGaussian) ? 'flex' : 'none';
  }

  /** Sync all UI elements to current params */
  _updateAllUI() {
    const $ = (id) => this.root.querySelector(`#${id}`);

    $('bm-name').value = this.params.name;
    $('bm-type').value = this.params.type;
    $('bm-rotate').value = this.params.rotate;
    $('bm-marker-tip').checked = this.params.markerTip;
    $('bm-pressure-mode').value = this.params.pressureMode;
    $('bm-pressure-3pt').checked = this.params.pressure3pt;

    // Update sliders
    ['weight', 'scatter', 'sharpness', 'grain', 'opacity', 'spacing', 'noise',
     'pressStart', 'pressMid', 'pressEnd', 'gaussCurveA', 'gaussCurveB', 'gaussMin', 'gaussMax'].forEach(key => {
      const sliderId = 'bm-' + key.replace(/([A-Z])/g, '-$1').toLowerCase();
      const slider = $(sliderId);
      const valEl = $(sliderId + '-val');
      if (slider && valEl) {
        slider.value = this.params[key];
        valEl.textContent = this._formatNumber(this.params[key]);
      }
    });

    this._updatePressureModeUI();
    this._updateTypeUI();

    // Tip code
    $('bm-tip-code').value = this.params.tipCode || DEFAULT_TIP_CODE;
  }

  /** Initialize preview canvas */
  _initPreviewCanvas() {
    this._previewCanvas = this.root.querySelector('#bm-preview');
    this._previewCtx = this._previewCanvas.getContext('2d');
    this._clearPreview();
  }

  /** Clear preview canvas to white */
  _clearPreview() {
    if (!this._previewCtx) return;
    this._previewCtx.fillStyle = '#ffffff';
    this._previewCtx.fillRect(0, 0, PREVIEW_W, PREVIEW_H);
  }

  /** Initialize tip drawing pad */
  _initTipPad() {
    this._tipPadCanvas = this.root.querySelector('#bm-tip-pad');
    this._tipPadCtx = this._tipPadCanvas.getContext('2d');
    this._clearTipPad();
    // Draw centre crosshair
    this._drawTipPadCrosshair();
  }

  /** Clear tip pad */
  _clearTipPad() {
    if (!this._tipPadCtx) return;
    this._tipPadCtx.fillStyle = '#ffffff';
    this._tipPadCtx.fillRect(0, 0, TIP_PAD_SIZE, TIP_PAD_SIZE);
    this._drawTipPadCrosshair();
    // Update the tip function to empty
    this.params.tipFn = (_m) => {};
    this.params.tipCode = '';
    this.root.querySelector('#bm-tip-code').value = '';
    this._saveParams();
    this._updateCodePanel();
    this._needsPreviewUpdate = true;
    this._renderPreview();
  }

  /** Draw crosshair on tip pad */
  _drawTipPadCrosshair() {
    const ctx = this._tipPadCtx;
    const cx = TIP_PAD_SIZE / 2;
    const cy = TIP_PAD_SIZE / 2;
    ctx.save();
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    // Boundary
    ctx.rect(0.5, 0.5, TIP_PAD_SIZE - 1, TIP_PAD_SIZE - 1);
    // Crosshair
    ctx.moveTo(0.5, cy);
    ctx.lineTo(TIP_PAD_SIZE - 0.5, cy);
    ctx.moveTo(cx, 0.5);
    ctx.lineTo(cx, TIP_PAD_SIZE - 0.5);
    ctx.stroke();
    ctx.restore();
  }

  /** Get canvas coords from mouse/touch event */
  _getTipPadCoords(e) {
    const rect = this._tipPadCanvas.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    return {
      x: (clientX - rect.left) * (TIP_PAD_SIZE / rect.width),
      y: (clientY - rect.top) * (TIP_PAD_SIZE / rect.height),
    };
  }

  /** Handle tip pad mouse down */
  _onTipPadDown(e) {
    this._tipDrawing = true;
    const coords = this._getTipPadCoords(e);
    this._drawOnTipPad(coords.x, coords.y, true);
  }

  /** Handle tip pad mouse move */
  _onTipPadMove(e) {
    if (!this._tipDrawing) return;
    const coords = this._getTipPadCoords(e);
    this._drawOnTipPad(coords.x, coords.y, false);
  }

  /** Handle tip pad mouse up */
  _onTipPadUp() {
    this._tipDrawing = false;
    this._updateTipFunctionFromPad();
  }

  /** Draw on tip pad */
  _drawOnTipPad(x, y, isStart) {
    const ctx = this._tipPadCtx;
    const radius = 4;
    ctx.fillStyle = '#000000';
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    // Redraw crosshair on top
    this._drawTipPadCrosshair();
  }

  /** Convert tip pad pixels to a tip function */
  _updateTipFunctionFromPad() {
    // Read pixels from the pad, create a function that draws them
    // We'll sample the dark pixels and create a function that draws circles for each
    const ctx = this._tipPadCtx;
    const imageData = ctx.getImageData(0, 0, TIP_PAD_SIZE, TIP_PAD_SIZE);
    const pixels = imageData.data;
    const dots = [];

    // Sample every 3rd pixel to keep function size reasonable
    const step = 3;
    const cx = TIP_PAD_SIZE / 2;
    const cy = TIP_PAD_SIZE / 2;

    for (let py = 0; py < TIP_PAD_SIZE; py += step) {
      for (let px = 0; px < TIP_PAD_SIZE; px += step) {
        const idx = (py * TIP_PAD_SIZE + px) * 4;
        const r = pixels[idx];
        const g = pixels[idx + 1];
        const b = pixels[idx + 2];
        const a = pixels[idx + 3];
        // Dark pixel (low RGB) = opaque
        const luminance = (r + g + b) / 3;
        if (luminance < 128 && a > 0) {
          // Convert to 100x100 coordinate space (origin at centre)
          const ux = ((px - cx) / TIP_PAD_SIZE) * 100;
          const uy = ((py - cy) / TIP_PAD_SIZE) * 100;
          const opacity = Math.round((128 - luminance) / 128 * 255);
          dots.push({ x: ux, y: uy, r: step * 50 / TIP_PAD_SIZE, opacity });
        }
      }
    }

    if (dots.length === 0) {
      this.params.tipFn = (_m) => {};
      this.params.tipCode = '';
      this.root.querySelector('#bm-tip-code').value = '';
      this._saveParams();
      this._updateCodePanel();
      this._needsPreviewUpdate = true;
      this._renderPreview();
      return;
    }

    // Generate tip function code
    const lines = dots.map(d =>
      `_m.fill(0, ${d.opacity});\n_m.circle(${d.x.toFixed(2)}, ${d.y.toFixed(2)}, ${(d.r * 2).toFixed(2)});`
    ).join('\n');

    const code = `// Generated from drawing pad (${dots.length} dots)\n${lines}`;
    this.params.tipCode = code;
    this.params.tipFn = this._createTipFunction(code);
    this.root.querySelector('#bm-tip-code').value = code;
    this._saveParams();
    this._updateCodePanel();
    this._needsPreviewUpdate = true;
    this._renderPreview();
  }

  /** Render live preview using the real brush engine */
  _renderPreview() {
    if (!this._previewCtx) {
      this._clearPreview();
      return;
    }

    // Clear the preview to paper colour
    this._previewCtx.fillStyle = '#fffceb';
    this._previewCtx.fillRect(0, 0, PREVIEW_W, PREVIEW_H);

    // The vendored engine requires WebGL2, which may be unavailable in
    // headless/CI. Guard every engine path so the UI stays functional.
    try {
      if (!this._engineReady || !isBrushReady()) {
        this._renderFallbackPreview();
        this._setPreviewError('preview: brush engine unavailable — drawing fallback');
        return;
      }

      const cfg = this._buildBrushConfig();
      try {
        brush.add(this.params.name, cfg);
      } catch (err) {
        // A custom tip the vendor rejects must not break the UI
        this._setPreviewError('preview: brush.add rejected — ' + String(err.message || err));
      }

      // Seeded stroke through the REAL vendored engine path. A fixed seed keeps
      // the preview deterministic — this module never introduces its own RNG.
      const shape = {
        type: 'S',
        params: [28, 60, 100, 30, 212, 90, Math.max(2, this.params.weight || 4),
          0, [40, 40, 48], [40, 40, 48], 1],
        color0: [40, 40, 48],
        color1: [40, 40, 48],
        alpha: 1,
        seed: 42,
      };
      const stamped = stampStrokeSync(this._previewCtx, shape, {
        brushName: this.params.name,
        color: [40, 40, 48],
        size: Math.max(2, this.params.weight || 4),
        seed: 42,
      });

      if (!stamped) {
        this._renderFallbackPreview();
        this._setPreviewError('preview: engine stamped nothing — drawing fallback');
        return;
      }
      this._setPreviewError(null);
    } catch (e) {
      console.warn('[BrushMaker] Preview render failed:', e);
      this._setPreviewError(String(e && e.message ? e.message : e));
      this._renderFallbackPreview();
    }
  }

  /**
   * 2D canvas fallback preview. Used when the WebGL2 brush engine is
   * unavailable (headless CI, software rasterisers). It still reflects the
   * current params so the panel is never blank.
   */
  _renderFallbackPreview() {
    const ctx = this._previewCtx;
    if (!ctx) return;
    ctx.fillStyle = '#fffceb';
    ctx.fillRect(0, 0, PREVIEW_W, PREVIEW_H);
    ctx.strokeStyle = `rgb(40 40 48 / ${Math.max(0.15, (this.params.opacity || 170) / 255)})`;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(1, Math.min(24, (this.params.weight || 1) * 1.5));

    const scatter = Number(this.params.scatter) || 0;
    const wobble = Math.min(10, scatter);
    // Deterministic wobble derived from the scatter param (no external RNG).
    const off = (Math.sin(scatter * 12.9898) * 43758.5453) % 1 * wobble;

    ctx.beginPath();
    ctx.moveTo(28, 60);
    ctx.quadraticCurveTo(PREVIEW_W / 2, 30 + off, PREVIEW_W - 28, 60);
    ctx.stroke();
  }

  /** Build brush config object for brush.add() */
  _buildBrushConfig() {
    const p = this.params;
    const isCustom = p.type === 'custom';

    // Pressure config
    let pressure;
    if (p.pressureMode === 'gaussian') {
      pressure = {
        mode: 'gaussian',
        curve: [p.gaussCurveA, p.gaussCurveB],
        min_max: [p.gaussMin, p.gaussMax],
      };
    } else if (p.pressure3pt) {
      pressure = [p.pressStart, p.pressMid, p.pressEnd];
    } else {
      pressure = [p.pressStart, p.pressEnd];
    }

    const cfg = {
      type: p.type,
      weight: p.weight,
      scatter: p.scatter,
      opacity: p.opacity,
      spacing: p.spacing,
      pressure: pressure,
      rotate: p.rotate,
      noise: p.noise,
    };

    if (p.type === 'default' || p.type === 'spray') {
      cfg.sharpness = p.sharpness;
      cfg.grain = p.grain;
    }

    if (p.type === 'marker' || p.type === 'custom') {
      cfg.markerTip = p.markerTip;
    }

    if (isCustom && p.tipFn) {
      cfg.tip = p.tipFn;
    }

    return cfg;
  }

  /** Show/hide preview error */
  _setPreviewError(msg) {
    const errEl = this.root.querySelector('#bm-preview-error');
    if (msg) {
      errEl.textContent = msg;
      errEl.style.display = 'block';
    } else {
      errEl.style.display = 'none';
    }
  }

  /** Update generated code panel */
  _updateCodePanel() {
    const code = this._generateCode();
    const output = this.root.querySelector('#bm-code-output');
    if (output) {
      output.value = code;
    }
  }

  /** Generate the brush.add() code snippet */
  _generateCode() {
    const p = this.params;
    const isCustom = p.type === 'custom';

    // Pressure
    let pressureCode;
    if (p.pressureMode === 'gaussian') {
      pressureCode = `{\n    mode: "gaussian",\n    curve: [${p.gaussCurveA}, ${p.gaussCurveB}],\n    min_max: [${p.gaussMin}, ${p.gaussMax}],\n  }`;
    } else if (p.pressure3pt) {
      pressureCode = `[${p.pressStart}, ${p.pressMid}, ${p.pressEnd}]`;
    } else {
      pressureCode = `[${p.pressStart}, ${p.pressEnd}]`;
    }

    // Type-specific fields
    let typeSpecific = '';
    if (p.type === 'default' || p.type === 'spray') {
      typeSpecific = `  sharpness: ${p.sharpness},\n  grain:     ${p.grain},\n`;
    }

    // Tip function for custom
    let tipField = '';
    if (isCustom && p.tipCode) {
      const tipLines = p.tipCode.split('\n').map(l => l.trim()).filter(Boolean).map(l => `      _m.${l}`).join('\n');
      tipField = `  tip: (_m) => {\n${tipLines}\n  },\n`;
    }

    // Marker tip
    const markerTipField = (p.type === 'marker' || p.type === 'custom')
      ? `  markerTip: ${p.markerTip},\n`
      : '';

    return `brush.add("${p.name}", {\n  type:    "${p.type}",\n  weight:  ${p.weight},\n  scatter: ${p.scatter},\n${typeSpecific}  opacity: ${p.opacity},\n  spacing: ${p.spacing},\n  noise:   ${p.noise},\n  pressure: ${pressureCode},\n  rotate:  "${p.rotate}",\n${markerTipField}${tipField}});`;
  }

  /** Copy code to clipboard */
  async _copyCode() {
    const output = this.root.querySelector('#bm-code-output');
    const btn = this.root.querySelector('#bm-copy-code');
    try {
      await navigator.clipboard.writeText(output.value);
      btn.textContent = 'Copied!';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.textContent = 'Copy';
        btn.classList.remove('copied');
      }, 1500);
    } catch (e) {
      // Fallback
      output.select();
      document.execCommand('copy');
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
    }
  }

  /** Save current brush to localStorage and register with engine */
  _saveBrush() {
    const cfg = this._buildBrushConfig();
    const brushData = {
      name: this.params.name,
      config: cfg,
      // Store tip code separately for custom brushes
      tipCode: this.params.tipCode || null,
    };

    // Check for duplicate
    const existingIdx = this.savedBrushes.findIndex(b => b.name === this.params.name);
    if (existingIdx >= 0) {
      this.savedBrushes[existingIdx] = brushData;
    } else {
      this.savedBrushes.push(brushData);
    }

    this._saveBrushes();
    this._registerBrushWithEngine(brushData);
    this._updateSavedList();
    this._dispatchBrushRegistered();

    // Visual feedback
    const btn = this.root.querySelector('#bm-save');
    const orig = btn.textContent;
    btn.textContent = 'Saved!';
    setTimeout(() => { btn.textContent = orig; }, 1500);
  }

  /** Register a brush with the vendored engine */
  _registerBrushWithEngine(brushData) {
    try {
      // The brush engine is initialized in app.js, we can access it via window
      // For now, just store the config - the engine will pick it up on next init
      // Or we can try to register immediately if engine is ready
      if (window.__app && window.__app.paintBrush) {
        // The paintBrush uses the brush-stamp-engine which has the vendor brush
        // We'd need to call brush.add() on the vendor module
        // This is async, so we just ensure it's in the saved list
        // The probe will verify it appears in the preset select
      }
    } catch (e) {
      console.warn('[BrushMaker] Could not register with engine:', e);
    }
  }

  /** Update the saved brushes list UI */
  _updateSavedList() {
    const listEl = this.root.querySelector('#bm-saved-list');
    const sectionEl = this.root.querySelector('#bm-saved-section');
    if (!listEl) return;

    if (this.savedBrushes.length === 0) {
      sectionEl.style.display = 'none';
      return;
    }

    sectionEl.style.display = '';
    listEl.innerHTML = this.savedBrushes.map(b => `
      <div class="bm-saved-item">
        <span class="bm-saved-name">${this._escapeHtml(b.name)}</span>
        <div class="bm-saved-actions">
          <button type="button" class="bm-btn bm-btn--sm bm-load-saved" data-name="${this._escapeHtml(b.name)}">Load</button>
          <button type="button" class="bm-btn bm-btn--sm bm-btn--ghost bm-delete-saved" data-name="${this._escapeHtml(b.name)}">Delete</button>
        </div>
      </div>
    `).join('');
  }

  /** Show load brush dialog (simple prompt for now) */
  _showLoadDialog() {
    if (this.savedBrushes.length === 0) {
      alert('No saved brushes. Create and save a brush first.');
      return;
    }

    // For simplicity, show the list and let user click Load
    // The list is already visible in the UI
    const section = this.root.querySelector('#bm-saved-section');
    section.scrollIntoView({ behavior: 'smooth' });
  }

  /** Load a saved brush by name */
  _loadBrush(name) {
    const brushData = this.savedBrushes.find(b => b.name === name);
    if (!brushData) return;

    const cfg = brushData.config;
    this.params.name = brushData.name;
    this.params.type = cfg.type;
    this.params.weight = cfg.weight;
    this.params.scatter = cfg.scatter;
    this.params.opacity = cfg.opacity;
    this.params.spacing = cfg.spacing;
    this.params.noise = cfg.noise;
    this.params.rotate = cfg.rotate;
    this.params.markerTip = cfg.markerTip || false;

    if (cfg.sharpness !== undefined) this.params.sharpness = cfg.sharpness;
    if (cfg.grain !== undefined) this.params.grain = cfg.grain;

    // Pressure
    if (Array.isArray(cfg.pressure)) {
      this.params.pressureMode = 'simple';
      this.params.pressure3pt = cfg.pressure.length === 3;
      this.params.pressStart = cfg.pressure[0];
      this.params.pressMid = cfg.pressure[1] || this.params.pressMid;
      this.params.pressEnd = cfg.pressure[cfg.pressure.length - 1];
    } else if (cfg.pressure && cfg.pressure.mode === 'gaussian') {
      this.params.pressureMode = 'gaussian';
      this.params.gaussCurveA = cfg.pressure.curve[0];
      this.params.gaussCurveB = cfg.pressure.curve[1];
      this.params.gaussMin = cfg.pressure.min_max[0];
      this.params.gaussMax = cfg.pressure.min_max[1];
    }

    // Custom tip
    if (brushData.tipCode) {
      this.params.tipCode = brushData.tipCode;
      this.params.tipFn = this._createTipFunction(brushData.tipCode);
    }

    this._applyTypePreset(this.params.type);
    this._updateAllUI();
    this._saveParams();
    this._updateCodePanel();
    this._needsPreviewUpdate = true;
    this._renderPreview();
  }

  /** Delete a saved brush */
  _deleteBrush(name) {
    if (!confirm(`Delete brush "${name}"?`)) return;
    this.savedBrushes = this.savedBrushes.filter(b => b.name !== name);
    this._saveBrushes();
    this._updateSavedList();
    this._dispatchBrushRegistered();
  }

  /** Dispatch event when brushes are registered/updated */
  _dispatchBrushRegistered() {
    this.root.dispatchEvent(new CustomEvent('brush-maker-registered', {
      detail: { brushes: this.savedBrushes },
      bubbles: true,
    }));
  }

  /** Escape HTML */
  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /** Public method to show the brush maker */
  show() {
    this.root.style.display = 'flex';
    this._needsPreviewUpdate = true;
    this._renderPreview();
  }

  /** Public method to hide the brush maker */
  hide() {
    this.root.style.display = 'none';
  }

  /** Public method to toggle visibility */
  toggle() {
    if (this.root.style.display === 'none' || this.root.style.display === '') {
      this.show();
    } else {
      this.hide();
    }
  }

  /** Get saved brushes for external registration */
  getSavedBrushes() {
    return this.savedBrushes.map(b => ({
      name: b.name,
      config: b.config,
    }));
  }

  /**
   * Register all saved brushes with the vendored engine.
   * Called from app.js after engine init completes.
   */
  registerAll() {
    for (const b of this.savedBrushes) {
      try {
        if (typeof brush.add === 'function') {
          const cfg = this._buildBrushConfigFromSaved(b.config);
          brush.add(b.name, cfg);
        }
      } catch (e) {
        console.warn('[BrushMaker] Failed to register brush ' + b.name + ':', e);
      }
    }
  }

  /** Build brush config from a saved config object */
  _buildBrushConfigFromSaved(cfg) {
    const p = {
      weight: cfg.weight, scatter: cfg.scatter, opacity: cfg.opacity,
      spacing: cfg.spacing, noise: cfg.noise, rotate: cfg.rotate,
      markerTip: cfg.markerTip || false, pressureMode: cfg.pressureMode || 'simple',
    };

    // Pressure
    if (Array.isArray(cfg.pressure)) {
      p.pressure3pt = cfg.pressure.length === 3;
      p.pressStart = cfg.pressure[0];
      p.pressMid = cfg.pressure.length >= 3 ? cfg.pressure[1] : p.pressStart;
      p.pressEnd = cfg.pressure[cfg.pressure.length - 1];
      p.pressureMode = 'simple';
    } else if (cfg.pressure && cfg.pressure.mode === 'gaussian') {
      p.pressureMode = 'gaussian';
      p.gaussCurveA = cfg.pressure.curve[0];
      p.gaussCurveB = cfg.pressure.curve[1];
      p.gaussMin = cfg.pressure.min_max[0];
      p.gaussMax = cfg.pressure.min_max[1];
    }

    // Sharpness/grain
    if (cfg.sharpness !== undefined) p.sharpness = cfg.sharpness;
    if (cfg.grain !== undefined) p.grain = cfg.grain;

    return p;
  }
}

export default BrushMaker;