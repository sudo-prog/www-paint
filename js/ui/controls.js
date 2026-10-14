/**
 * Controls Panel — binds all UI controls (style picker, sliders, selectors)
 * to the PaintingEngine settings.
 *
 * Nothing Design System patterns:
 * - Style picker: segmented control
 * - Path order / color mode: segmented control
 * - Sliders: styled as discrete segments
 * - Labels: Space Mono ALL CAPS
 * - Buttons: pill (999px) or technical
 *
 * The controls panel provides:
 * - Style picker (segmented)
 * - Sliders: stroke size (min/max), density/count, detail, strength,
 *   opacity, randomness
 * - Path order selector
 * - Color mode selector
 *
 * All controls dispatch change events that the App controller can observe.
 *
 * @module controls
 */

import { getAllStyles, getStyleInfo } from '../../styles/index.js';
import { DEFAULT_SETTINGS } from '../../engine/generator.js';

/** Style metadata for the built-in styles. */
const STYLE_PRESETS = {
  pencil:    { label: 'Pencil',    icon: '✏️', category: 'draw' },
  ink:       { label: 'Ink',       icon: '🖋️', category: 'paint' },
  watercolor:{ label: 'Watercolor',icon: '🎨', category: 'paint' },
  oil:       { label: 'Oil',       icon: '🖌️', category: 'paint' },
  graffiti:  { label: 'Graffiti',  icon: '🎨', category: 'paint' },
  graphic:   { label: 'Graphic',   icon: '■',  category: 'graphic' },
};

/** Path order options. */
const PATH_ORDER_OPTIONS = [
  { value: 'free',        label: 'Free' },
  { value: 'top-bottom',  label: 'Top ↓' },
  { value: 'spiral',      label: 'Spiral' },
  { value: 'one-line',    label: 'One Line' },
  { value: 'edges-first', label: 'Edges' },
];

/** Color mode options. */
const COLOR_MODE_OPTIONS = [
  { value: 'exact',        label: 'Exact' },
  { value: 'quantized',    label: 'Quantized' },
  { value: 'palette',      label: 'Palette' },
];

/**
 * ControlsManager — manages the control panel UI.
 *
 * Nothing Design: segmented controls for pickers, discrete-segmented sliders,
 * Space Mono ALL CAPS labels.
 *
 * @param {HTMLElement} root - The controls container element
 * @param {object} [opts]
 * @param {object} [opts.initialSettings] - Starting settings
 */
export class ControlsManager {
  /**
   * @param {HTMLElement} root
   * @param {object} [opts]
   */
  constructor(root, opts = {}) {
    if (!root) throw new Error('ControlsManager requires a root element');

    /** @type {HTMLElement} */
    this.root = root;
    /** @type {object} */
    this.settings = { ...DEFAULT_SETTINGS, ...opts.initialSettings };
    /** @type {Array<string>} */
    this.styles = getAllStyles().map(s => s.name);

    // Cache of created input elements
    this._inputs = {};

    this._render();
    this._bindEvents();
    this._syncToUI();
  }

  // ─── Rendering ───────────────────────────────────────────────

  /**
   * Build the entire controls panel DOM.
   */
  _render() {
    this.root.classList.add('controls-panel');
    this.root.innerHTML = '';

    // Container for each section
    const sections = [
      { id: 'style-section',   title: 'STYLE',    render: () => this._renderStylePicker() },
      { id: 'brush-section',   title: 'BRUSH',    render: () => this._renderBrushControls() },
      { id: 'path-section',    title: 'PATH ORDER', render: () => this._renderPathOrder() },
      { id: 'color-section',   title: 'COLOR',    render: () => this._renderColorMode() },
    ];

    for (const s of sections) {
      const section = document.createElement('section');
      section.className = 'control-section';
      section.id = s.id;

      const header = document.createElement('h3');
      header.className = 'section-title';
      header.textContent = s.title;
      section.appendChild(header);

      const body = document.createElement('div');
      body.className = 'section-body';
      body.appendChild(s.render());
      section.appendChild(body);

      this.root.appendChild(section);
    }

    // Generate button at the bottom
    const genSection = document.createElement('section');
    genSection.className = 'control-section control-section--full';
    genSection.id = 'generate-section';

    const generateBtn = document.createElement('button');
    generateBtn.className = 'btn btn--primary btn--generate';
    generateBtn.type = 'button';
    generateBtn.textContent = 'GENERATE PAINTING';
    generateBtn.dataset.action = 'generate';
    genSection.appendChild(generateBtn);

    this.root.appendChild(genSection);
  }

  /**
   * Render the style picker as a segmented control.
   * @returns {HTMLElement}
   */
  _renderStylePicker() {
    const wrapper = document.createElement('div');
    wrapper.className = 'style-segmented';

    const segmented = document.createElement('div');
    segmented.className = 'segmented-control';
    segmented.setAttribute('role', 'radiogroup');
    segmented.setAttribute('aria-label', 'Style');

    const styleList = getAllStyles();
    for (const { name, label, category, instance } of styleList) {
      const btn = document.createElement('button');
      btn.className = 'segmented-control__button style-segmented__button';
      btn.type = 'button';
      btn.dataset.style = name;
      btn.id = `style-${name}`;
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-label', label);

      // Safe: icon is from a fixed lookup table, label/category are style metadata strings
      btn.innerHTML = `
        <span class="style-icon" aria-hidden="true">${this._getStyleIcon(name)}</span>
      `;

      this._inputs[`style-${name}`] = btn;
      segmented.appendChild(btn);
    }

    wrapper.appendChild(segmented);
    return wrapper;
  }

  /**
   * Get an emoji/icon for a style.
   * @param {string} name
   * @returns {string}
   */
  _getStyleIcon(name) {
    const presets = STYLE_PRESETS;
    return (presets[name]?.icon) || '🎨';
  }

  /**
   * Render brush/stroke controls (sliders).
   * @returns {HTMLElement}
   */
  _renderBrushControls() {
    const wrapper = document.createElement('div');
    wrapper.className = 'brush-controls';

    const controls = [
      {
        key: 'strokeSizeMin',
        label: 'Stroke Size (Min)',
        type: 'range',
        min: 0.5,
        max: 50,
        step: 0.5,
        value: this.settings.strokeSize?.min || DEFAULT_SETTINGS.strokeSize.min,
      },
      {
        key: 'strokeSizeMax',
        label: 'Stroke Size (Max)',
        type: 'range',
        min: 0.5,
        max: 100,
        step: 0.5,
        value: this.settings.strokeSize?.max || DEFAULT_SETTINGS.strokeSize.max,
      },
      {
        key: 'strokeCount',
        label: 'Density',
        type: 'range',
        min: 100,
        max: 5000,
        step: 50,
        value: this.settings.strokeCount || DEFAULT_SETTINGS.strokeCount,
      },
      {
        key: 'detailLevel',
        label: 'Detail',
        type: 'range',
        min: 0,
        max: 1,
        step: 0.05,
        value: this.settings.detailLevel || DEFAULT_SETTINGS.detailLevel,
        display: 'percent',
      },
      {
        key: 'styleStrength',
        label: 'Style Strength',
        type: 'range',
        min: 0,
        max: 1,
        step: 0.05,
        value: this.settings.styleStrength || 0.8,
        display: 'percent',
      },
      {
        key: 'opacity',
        label: 'Stroke Opacity',
        type: 'range',
        min: 0,
        max: 1,
        step: 0.05,
        value: this.settings.opacity !== undefined ? this.settings.opacity : 0.8,
        display: 'percent',
      },
      {
        key: 'randomness',
        label: 'Randomness',
        type: 'range',
        min: 0,
        max: 1,
        step: 0.05,
        value: this.settings.randomness || DEFAULT_SETTINGS.randomness,
        display: 'percent',
      },
      {
        key: 'spacing',
        label: 'Spacing',
        type: 'range',
        min: 0,
        max: 1,
        step: 0.05,
        value: this.settings.spacing || DEFAULT_SETTINGS.spacing,
        display: 'percent',
      },
      {
        key: 'scatter',
        label: 'Scatter',
        type: 'range',
        min: 0,
        max: 1,
        step: 0.05,
        value: this.settings.scatter || DEFAULT_SETTINGS.scatter,
        display: 'percent',
      },
    ];

    for (const c of controls) {
      wrapper.appendChild(this._renderSlider(c));
    }

    return wrapper;
  }

  /**
   * Render a single slider control with a value display.
   * Nothing Design: discrete-segmented slider, Space Mono labels.
   * @param {object} spec
   * @returns {HTMLElement}
   */
  _renderSlider(spec) {
    const id = `ctrl-${spec.key}`;
    const container = document.createElement('div');
    container.className = 'control-slider slider-container';
    container.dataset.key = spec.key;

    const label = document.createElement('label');
    label.className = 'slider-label';
    label.htmlFor = id;
    label.textContent = spec.label;

    const row = document.createElement('div');
    row.className = 'slider-row';

    const input = document.createElement('input');
    input.type = spec.type;
    input.id = id;
    input.min = spec.min;
    input.max = spec.max;
    input.step = spec.step;
    input.value = spec.value;
    input.dataset.display = spec.display || 'none';

    const valueSpan = document.createElement('span');
    valueSpan.className = 'slider-value';
    valueSpan.textContent = this._formatSliderValue(spec, spec.value);

    input.addEventListener('input', (e) => {
      valueSpan.textContent = this._formatSliderValue(spec, e.target.value);
      this._dispatchChange(spec.key, e.target.value, spec);
    });
    input.addEventListener('change', (e) => {
      this._dispatchChange(spec.key, e.target.value, spec);
    });

    this._inputs[spec.key] = { input, valueSpan, spec };

    row.appendChild(input);
    row.appendChild(valueSpan);
    container.appendChild(label);
    container.appendChild(row);

    return container;
  }

  /**
   * Format a slider value for display.
   * @param {object} spec
   * @param {string|number} value
   * @returns {string}
   */
  _formatSliderValue(spec, value) {
    const v = parseFloat(value);
    if (spec.display === 'percent') {
      return `${Math.round(v * 100)}%`;
    }
    return spec.key === 'strokeCount' ? Math.round(v).toLocaleString() : v.toFixed(1);
  }

  /**
   * Render the path order selector as a segmented control.
   * @returns {HTMLElement}
   */
  _renderPathOrder() {
    return this._renderSegmentedControl(
      'pathOrder',
      'path-order-segmented',
      PATH_ORDER_OPTIONS
    );
  }

  /**
   * Render the color mode selector as a segmented control.
   * @returns {HTMLElement}
   */
  _renderColorMode() {
    return this._renderSegmentedControl(
      'colorMode',
      'color-mode-segmented',
      COLOR_MODE_OPTIONS
    );
  }

  /**
   * Render a segmented control from options.
   * @param {string} key
   * @param {string} cls
   * @param {Array<{value, label}>} options
   * @returns {HTMLElement}
   */
  _renderSegmentedControl(key, cls, options) {
    const wrapper = document.createElement('div');
    wrapper.className = 'control-select';

    const segmented = document.createElement('div');
    segmented.className = `segmented-control ${cls}`;
    segmented.setAttribute('role', 'radiogroup');
    segmented.setAttribute('aria-label', key);

    for (const opt of options) {
      const btn = document.createElement('button');
      btn.className = 'segmented-control__button';
      btn.type = 'button';
      btn.textContent = opt.label;
      btn.dataset.value = opt.value;
      btn.dataset.key = key;
      btn.setAttribute('role', 'radio');

      if (opt.value === this.settings[key]) {
        btn.classList.add('segmented-control__button--active');
        btn.setAttribute('aria-checked', 'true');
      } else {
        btn.setAttribute('aria-checked', 'false');
      }

      segmented.appendChild(btn);
    }

    this._inputs[key] = { segmented, key };
    wrapper.appendChild(segmented);
    return wrapper;
  }

  // ─── Events ─────────────────────────────────────────────────────

  /**
   * Dispatch a synthetic change event with the updated settings.
   * @param {string} key
   * @param {string|number} value
   * @param {object} spec
   * @private
   */
  _dispatchChange(key, value, spec) {
    const numValue = spec.type !== 'select' ? parseFloat(value) : value;
    let settings = {};

    if (key === 'strokeSizeMin') {
      settings.strokeSize = { ...this.settings.strokeSize, min: numValue };
    } else if (key === 'strokeSizeMax') {
      settings.strokeSize = { ...this.settings.strokeSize, max: numValue };
    } else {
      settings[key] = numValue;
    }

    // Merge into our settings
    Object.assign(this.settings, settings);

    // Dispatch a custom event
    const event = new CustomEvent('settings-change', {
      detail: { key, value: numValue, settings: { ...this.settings } },
    });
    this.root.dispatchEvent(event);
  }

  /**
   * Bind event listeners.
   */
  _bindEvents() {
    // Style selection (segmented control)
    this.root.addEventListener('click', (e) => {
      const btn = e.target.closest('.style-segmented__button');
      if (btn) {
        const styleName = btn.dataset.style;
        if (styleName) {
          this._selectStyle(styleName);
        }
      }

      // Segmented control buttons
      const segBtn = e.target.closest('.segmented-control__button');
      if (segBtn && !segBtn.classList.contains('style-segmented__button')) {
        const container = segBtn.parentElement;
        const key = segBtn.dataset.key;
        const value = segBtn.dataset.value;
        if (key && value) {
          // Update active state
          container.querySelectorAll('.segmented-control__button').forEach(b => {
            b.classList.remove('segmented-control__button--active');
            b.setAttribute('aria-checked', 'false');
          });
          segBtn.classList.add('segmented-control__button--active');
          segBtn.setAttribute('aria-checked', 'true');

          // Update settings
          this.settings[key] = value;

          const event = new CustomEvent('settings-change', {
            detail: { key, value, settings: { ...this.settings } },
          });
          this.root.dispatchEvent(event);
        }
      }
    });

    // Generate button
    const genBtn = this.root.querySelector('[data-action="generate"]');
    if (genBtn) {
      genBtn.addEventListener('click', () => {
        const event = new CustomEvent('generate', {
          detail: { settings: { ...this.settings } },
        });
        this.root.dispatchEvent(event);
      });
    }
  }

  /**
   * Select a style and update UI.
   * @param {string} name
   */
  _selectStyle(name) {
    // Deselect all style buttons
    const allBtns = this.root.querySelectorAll('.style-segmented__button');
    allBtns.forEach(b => b.classList.remove('segmented-control__button--active'));

    // Select the chosen one
    const target = this.root.querySelector(`[data-style="${name}"]`);
    if (target) target.classList.add('segmented-control__button--active');

    this.settings.style = name;
    const event = new CustomEvent('settings-change', {
      detail: { key: 'style', value: name, settings: { ...this.settings } },
    });
    this.root.dispatchEvent(event);
  }

  // ─── Public API ────────────────────────────────────────────────

  /**
   * Sync internal settings to the UI controls.
   * Call this after externally updating settings.
   */
  _syncToUI() {
    // Style
    const styleBtn = this.root.querySelector(`[data-style="${this.settings.style}"]`);
    if (styleBtn) styleBtn.classList.add('segmented-control__button--active');

    // Sliders
    if (this._inputs['strokeSizeMin']) {
      this._inputs['strokeSizeMin'].input.value = this.settings.strokeSize?.min || DEFAULT_SETTINGS.strokeSize.min;
      this._inputs['strokeSizeMin'].valueSpan.textContent = this._formatSliderValue(this._inputs['strokeSizeMin'].spec, this.settings.strokeSize?.min || 0);
    }
    if (this._inputs['strokeSizeMax']) {
      this._inputs['strokeSizeMax'].input.value = this.settings.strokeSize?.max || DEFAULT_SETTINGS.strokeSize.max;
      this._inputs['strokeSizeMax'].valueSpan.textContent = this._formatSliderValue(this._inputs['strokeSizeMax'].spec, this.settings.strokeSize?.max || 0);
    }
    if (this._inputs['strokeCount']) {
      this._inputs['strokeCount'].input.value = this.settings.strokeCount || DEFAULT_SETTINGS.strokeCount;
      this._inputs['strokeCount'].valueSpan.textContent = this._formatSliderValue(this._inputs['strokeCount'].spec, this.settings.strokeCount || 0);
    }
    if (this._inputs['detailLevel']) {
      this._inputs['detailLevel'].input.value = this.settings.detailLevel || DEFAULT_SETTINGS.detailLevel;
      this._inputs['detailLevel'].valueSpan.textContent = this._formatSliderValue(this._inputs['detailLevel'].spec, this.settings.detailLevel || 0);
    }
    if (this._inputs['styleStrength']) {
      this._inputs['styleStrength'].input.value = this.settings.styleStrength || 0.8;
      this._inputs['styleStrength'].valueSpan.textContent = this._formatSliderValue(this._inputs['styleStrength'].spec, this.settings.styleStrength || 0.8);
    }
    if (this._inputs['opacity']) {
      this._inputs['opacity'].input.value = this.settings.opacity !== undefined ? this.settings.opacity : 0.8;
      this._inputs['opacity'].valueSpan.textContent = this._formatSliderValue(this._inputs['opacity'].spec, this.settings.opacity || 0);
    }
    if (this._inputs['randomness']) {
      this._inputs['randomness'].input.value = this.settings.randomness || DEFAULT_SETTINGS.randomness;
      this._inputs['randomness'].valueSpan.textContent = this._formatSliderValue(this._inputs['randomness'].spec, this.settings.randomness || 0);
    }
    if (this._inputs['spacing']) {
      this._inputs['spacing'].input.value = this.settings.spacing || DEFAULT_SETTINGS.spacing;
      this._inputs['spacing'].valueSpan.textContent = this._formatSliderValue(this._inputs['spacing'].spec, this.settings.spacing || 0);
    }
    if (this._inputs['scatter']) {
      this._inputs['scatter'].input.value = this.settings.scatter || DEFAULT_SETTINGS.scatter;
      this._inputs['scatter'].valueSpan.textContent = this._formatSliderValue(this._inputs['scatter'].spec, this.settings.scatter || 0);
    }

    // Segmented selectors
    for (const key of ['pathOrder', 'colorMode']) {
      if (this._inputs[key]) {
        const container = this._inputs[key].segmented;
        const value = this.settings[key] || DEFAULT_SETTINGS[key];
        container.querySelectorAll('.segmented-control__button').forEach(b => {
          b.classList.toggle('segmented-control__button--active', b.dataset.value === value);
          b.setAttribute('aria-checked', b.dataset.value === value ? 'true' : 'false');
        });
      }
    }
  }

  /**
   * Get current settings.
   * @returns {object}
   */
  getSettings() {
    return { ...this.settings };
  }

  /**
   * Set settings externally and sync UI.
   * @param {object} settings
   */
  setSettings(settings) {
    Object.assign(this.settings, settings);
    this._syncToUI();
  }

  /**
   * Get the currently selected style name.
   * @returns {string}
   */
  getSelectedStyle() {
    return this.settings.style || 'pencil';
  }

  /**
   * Destroy the controls manager.
   */
  destroy() {
    this.root.innerHTML = '';
  }
}

export { STYLE_PRESETS, PATH_ORDER_OPTIONS, COLOR_MODE_OPTIONS };
export default ControlsManager;
