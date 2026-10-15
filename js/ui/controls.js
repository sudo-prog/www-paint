/**
 * Controls Panel — binds all UI controls (style picker, sliders, selectors)
 * to the PaintingEngine settings via the Painter-based engine.
 *
 * Warm Dark Creative Tool: uses CSS tokens from :root, DM Sans / DM Mono typography.
 *
 * @module controls
 */

import { getAllStyles } from "../styles/index.js";
import { DEFAULT_SETTINGS } from "../engine/generator.js";

/**
 * Default settings surfaced by the controls panel.
 *
 * These flow into PaintingEngine.generate() which passes them to the Painter:
 *   - style      → Painter style selection
 *   - smart      → enables structure tensor, focus map, subject detection
 *   - order      → Painter.orderSetup kind (down, up, right, left, diag,
 *                  spiral, spiralin, rings, ringsin, clock, free)
 *
 * shapeBias, adaptiveSize, alignToGradient are intentionally NOT exposed —
 * the Painter handles those internally.
 *
 * @type {object}
 */
const PAINTER_DEFAULT_SETTINGS = {
  style: DEFAULT_SETTINGS.style || 'pencil',
  strokeSize: { min: 6, max: 28, random: true },
  strokeCount: DEFAULT_SETTINGS.strokeCount || 5000,
  detailLevel: DEFAULT_SETTINGS.detailLevel ?? 0.7,
  styleStrength: DEFAULT_SETTINGS.styleStrength ?? 0.8,
  opacity: DEFAULT_SETTINGS.opacity ?? 0.85,
  randomness: DEFAULT_SETTINGS.randomness ?? 0.3,
  scatter: DEFAULT_SETTINGS.scatter ?? 0.3,
  colorMode: DEFAULT_SETTINGS.colorMode || 'exact',
  paletteSize: DEFAULT_SETTINGS.paletteSize || 8,
  pathOrder: 'free',       // legacy — kept in settings for backward compat
  smart: true,             // Painter smart mode on by default
  order: 'free',           // maps to Painter.orderSetup kinds
  oneLine: false,            // Painter one-line pen mode
  outline: 'off',            // Painter outline mode: off | first | last
  rfill: 'off',              // Painter region fill: off | scribble | rows
};

/** Style metadata for the built-in styles. */
const STYLE_PRESETS = {
  pencil:     { label: "Pencil",       category: "draw" },
  ink:        { label: "Ink",          category: "paint" },
  watercolor: { label: "Watercolor",   category: "paint" },
  oil:        { label: "Oil",          category: "paint" },
  graffiti:   { label: "Graffiti",     category: "paint" },
  graphic:    { label: "Graphic",      category: "graphic" },
};

/**
 * Path / ordering options that map directly to Painter.orderSetup.
 * 'free' is a sentinel: the Painter skips orderSetup when the value
 * is not in its KINDS list, yielding random placement.
 */
const PATH_ORDER_OPTIONS = [
  { value: "free",      label: "Free" },
  { value: "down",      label: "Down" },
  { value: "up",        label: "Up" },
  { value: "right",     label: "Right" },
  { value: "left",      label: "Left" },
  { value: "diag",      label: "Diagonal" },
  { value: "spiral",    label: "Spiral" },
  { value: "spiralin",  label: "Spiral In" },
  { value: "rings",     label: "Rings" },
  { value: "ringsin",   label: "Rings In" },
  { value: "clock",     label: "Clock" },
];

/** Color mode options. */
const COLOR_MODE_OPTIONS = [
  { value: "exact",     label: "Exact" },
  { value: "quantized", label: "Quantized" },
  { value: "palette",   label: "Palette" },
];

/** Outline mode options (maps to Painter OUTL: 'off' | 'first' | 'last'). */
const OUTLINE_OPTIONS = [
  { value: "off",    label: "Off" },
  { value: "first",  label: "First" },
  { value: "last",   label: "Last" },
];

/** Region fill options (maps to Painter RFILL: 'off' | 'scribble' | 'rows'). */
const RFILL_OPTIONS = [
  { value: "off",      label: "Off" },
  { value: "scribble", label: "Scribble" },
  { value: "rows",     label: "Rows" },
];

/** One-line pen mode toggle options. */
const ONELINE_OPTIONS = [
  { value: "false", label: "Off" },
  { value: "true",  label: "On" },
];

/** Smart-mode toggle options. */
const SMART_OPTIONS = [
  { value: false, label: "Off" },
  { value: true,  label: "On" },
];

/**
 * ControlsManager — manages the control panel UI.
 *
 * @param {HTMLElement} root — the controls container element
 * @param {object} [opts]
 * @param {object} [opts.initialSettings] — starting settings
 */
export class ControlsManager {
  constructor(root, opts = {}) {
    if (!root) throw new Error("ControlsManager requires a root element");

    /** @type {HTMLElement} */
    this.root = root;
    /** @type {object} */
    this.settings = { ...PAINTER_DEFAULT_SETTINGS, ...opts.initialSettings };
    /** @type {Array<string>} */
    this.styles = getAllStyles().map((s) => s.name);
    /** @type {Record<string, object>} */
    this._inputs = {};

    this._render();
    this._bindEvents();
    this._syncToUI();
  }

  /* ─── Rendering ─────────────────────────────────────────────── */

  /**
   * Build the entire controls panel DOM.
   */
  _render() {
    this.root.classList.add("controls-panel");
    this.root.innerHTML = "";

    const sections = [
      { id: "style-section",   title: "STYLE",        render: () => this._renderStylePicker() },
      { id: "brush-section",   title: "BRUSH",        render: () => this._renderBrushControls() },
      { id: "path-section",    title: "PATH ORDER",   render: () => this._renderPathOrder() },
      { id: "motion-section",  title: "MOTION & PATH",  render: () => this._renderMotionSection() },
      { id: "color-section",   title: "COLOR",        render: () => this._renderColorMode() },
    ];

    for (const s of sections) {
      const section = document.createElement("section");
      section.className = "control-section";
      section.id = s.id;

      const header = document.createElement("h3");
      header.className = "control-section__title";
      header.textContent = s.title;
      section.appendChild(header);

      const body = document.createElement("div");
      body.className = "control-section__body";
      body.appendChild(s.render());
      section.appendChild(body);

      this.root.appendChild(section);
    }

    // Generate button at the bottom
    const genSection = document.createElement("section");
    genSection.className = "control-section generate-btn-container";
    genSection.id = "generate-section";

    const generateBtn = document.createElement("button");
    generateBtn.className = "generate-btn";
    generateBtn.type = "button";
    generateBtn.textContent = "Generate Painting";
    generateBtn.dataset.action = "generate";
    genSection.appendChild(generateBtn);
    this.root.appendChild(genSection);
  }

  /**
   * Render the style picker as a grid of buttons.
   * @returns {HTMLElement}
   */
  _renderStylePicker() {
    const wrapper = document.createElement("div");
    wrapper.className = "style-grid";

    for (const { name, label } of getAllStyles()) {
      const btn = document.createElement("button");
      btn.className = "style-btn";
      btn.type = "button";
      btn.dataset.style = name;
      btn.id = `style-${name}`;
      btn.setAttribute("aria-label", label);
      btn.setAttribute("title", label);

      // Safe DOM construction (no untrusted HTML; label comes from style registry)
      const swatch = document.createElement("span");
      swatch.className = "style-btn__swatch";
      swatch.setAttribute("aria-hidden", "true");
      swatch.style.backgroundColor = STYLE_SWATCH_COLORS[name] || "var(--accent)";

      const spanLabel = document.createElement("span");
      spanLabel.className = "style-btn__label";
      spanLabel.textContent = label;

      btn.appendChild(swatch);
      btn.appendChild(spanLabel);

      if (name === this.settings.style) {
        btn.classList.add("style-btn--active");
      }

      this._inputs[`style-${name}`] = btn;
      wrapper.appendChild(btn);
    }

    return wrapper;
  }

  /**
   * Render brush/stroke controls (sliders + smart toggle).
   * @returns {HTMLElement}
   */
  _renderBrushControls() {
    const wrapper = document.createElement("div");
    wrapper.className = "brush-controls";

    const controls = [
      { key: "strokeSizeMin", label: "Stroke Min",    type: "range", min: 0.5, max: 50, step: 0.5, value: this.settings.strokeSize?.min || PAINTER_DEFAULT_SETTINGS.strokeSize.min },
      { key: "strokeSizeMax", label: "Stroke Max",    type: "range", min: 0.5, max: 100, step: 0.5, value: this.settings.strokeSize?.max || PAINTER_DEFAULT_SETTINGS.strokeSize.max },
      { key: "strokeCount",   label: "Density",        type: "range", min: 500, max: 20000, step: 100, value: this.settings.strokeCount || PAINTER_DEFAULT_SETTINGS.strokeCount },
      { key: "detailLevel",   label: "Detail",         type: "range", min: 0, max: 1, step: 0.05, value: this.settings.detailLevel ?? PAINTER_DEFAULT_SETTINGS.detailLevel, display: "percent" },
      { key: "styleStrength", label: "Strength",       type: "range", min: 0, max: 1, step: 0.05, value: this.settings.styleStrength ?? PAINTER_DEFAULT_SETTINGS.styleStrength, display: "percent" },
      { key: "opacity",       label: "Opacity",         type: "range", min: 0, max: 1, step: 0.05, value: this.settings.opacity ?? PAINTER_DEFAULT_SETTINGS.opacity, display: "percent" },
      { key: "randomness",    label: "Randomness",     type: "range", min: 0, max: 1, step: 0.05, value: this.settings.randomness ?? PAINTER_DEFAULT_SETTINGS.randomness, display: "percent" },
      { key: "scatter",       label: "Scatter",        type: "range", min: 0, max: 1, step: 0.05, value: this.settings.scatter ?? PAINTER_DEFAULT_SETTINGS.scatter, display: "percent" },
    ];

    for (const c of controls) {
      wrapper.appendChild(this._renderSlider(c));
    }

    // Smart toggle
    wrapper.appendChild(this._renderToggle("smart", "Smart Mode", SMART_OPTIONS, this.settings.smart ?? PAINTER_DEFAULT_SETTINGS.smart));

    return wrapper;
  }

  /**
   * Render a single slider control with a value display.
   * @param {object} spec
   * @returns {HTMLElement}
   */
  _renderSlider(spec) {
    const id = `ctrl-${spec.key}`;
    const container = document.createElement("div");
    container.className = "control-slider";
    container.dataset.key = spec.key;

    const label = document.createElement("label");
    label.className = "slider-label";
    label.htmlFor = id;
    label.textContent = spec.label;

    const row = document.createElement("div");
    row.className = "slider-row";

    const input = document.createElement("input");
    input.type = spec.type;
    input.id = id;
    input.min = spec.min;
    input.max = spec.max;
    input.step = spec.step;
    input.value = spec.value;
    input.dataset.display = spec.display || "none";

    const valueSpan = document.createElement("span");
    valueSpan.className = "slider-value";
    valueSpan.textContent = this._formatSliderValue(spec, spec.value);

    input.addEventListener("input", (e) => {
      valueSpan.textContent = this._formatSliderValue(spec, e.target.value);
      this._dispatchChange(spec.key, e.target.value, spec);
    });
    input.addEventListener("change", (e) => {
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
   * Render a boolean toggle as a segmented control.
   * @param {string} key — settings key
   * @param {string} label — display label
   * @param {Array<{value: *, label: string}>} options
   * @param {*} currentValue
   * @returns {HTMLElement}
   */
  _renderToggle(key, label, options, currentValue) {
    const wrapper = document.createElement("div");
    wrapper.className = "control-toggle";

    const title = document.createElement("span");
    title.className = "toggle-label";
    title.textContent = label;
    wrapper.appendChild(title);

    const segmented = document.createElement("div");
    segmented.className = "segmented segmented--small";
    segmented.setAttribute("role", "radiogroup");
    segmented.setAttribute("aria-label", key);

    for (const opt of options) {
      const btn = document.createElement("button");
      btn.className = "segmented__btn";
      btn.type = "button";
      btn.textContent = opt.label;
      btn.dataset.value = opt.value;
      btn.dataset.key = key;
      btn.setAttribute("role", "radio");

      const isActive = opt.value === currentValue;
      btn.classList.toggle("segmented__btn--active", isActive);
      btn.setAttribute("aria-checked", isActive ? "true" : "false");

      segmented.appendChild(btn);
    }

    this._inputs[key] = { segmented, key, isToggle: true };
    wrapper.appendChild(segmented);
    return wrapper;
  }

  /**
   * Render the path order selector as a segmented control.
   * @returns {HTMLElement}
   */
  _renderPathOrder() {
    return this._renderSegmentedControl("order", PATH_ORDER_OPTIONS);
  }

  /**
   * Render the color mode selector as a segmented control.
   * @returns {HTMLElement}
   */
  _renderColorMode() {
    return this._renderSegmentedControl("colorMode", COLOR_MODE_OPTIONS);
  }

  /**
   * Render the motion & path controls: one-line pen toggle, outline mode,
   * and region fill.
   * @returns {HTMLElement}
   */
  _renderMotionSection() {
    const wrapper = document.createElement("div");
    wrapper.className = "motion-controls";
    wrapper.appendChild(this._renderToggle("oneLine", "One Line", ONELINE_OPTIONS, this.settings.oneLine ?? PAINTER_DEFAULT_SETTINGS.oneLine));
    wrapper.appendChild(this._renderSegmentedControl("outline", OUTLINE_OPTIONS));
    wrapper.appendChild(this._renderSegmentedControl("rfill", RFILL_OPTIONS));
    return wrapper;
  }

  /**
   * Render a segmented control from options.
   * @param {string} key — settings key
   * @param {Array<{value: string, label: string}>} options
   * @returns {HTMLElement}
   */
  _renderSegmentedControl(key, options) {
    const wrapper = document.createElement("div");
    wrapper.className = "control-select";

    const segmented = document.createElement("div");
    segmented.className = "segmented";
    segmented.setAttribute("role", "radiogroup");
    segmented.setAttribute("aria-label", key);

    const current = this.settings[key] || PAINTER_DEFAULT_SETTINGS[key];

    for (const opt of options) {
      const btn = document.createElement("button");
      btn.className = "segmented__btn";
      btn.type = "button";
      btn.textContent = opt.label;
      btn.dataset.value = opt.value;
      btn.dataset.key = key;
      btn.setAttribute("role", "radio");

      const isActive = opt.value === current;
      btn.classList.toggle("segmented__btn--active", isActive);
      btn.setAttribute("aria-checked", isActive ? "true" : "false");

      segmented.appendChild(btn);
    }

    this._inputs[key] = { segmented, key };
    wrapper.appendChild(segmented);
    return wrapper;
  }

  /* ─── Events ────────────────────────────────────────────────── */

  /**
   * Dispatch a synthetic settings-change event.
   * @param {string} key
   * @param {string|number|boolean} value
   * @param {object} spec
   * @private
   */
  _dispatchChange(key, value, spec) {
    let settings = {};

    if (key === "strokeSizeMin") {
      settings.strokeSize = { ...this.settings.strokeSize, min: parseFloat(value) };
    } else if (key === "strokeSizeMax") {
      settings.strokeSize = { ...this.settings.strokeSize, max: parseFloat(value) };
    } else if (key === "smart") {
      // Toggle values arrive as strings from DOM; coerce to boolean
      settings.smart = value === "true" || value === true;
    } else if (spec && spec.type !== "select") {
      settings[key] = parseFloat(value);
    } else {
      settings[key] = value;
    }

    Object.assign(this.settings, settings);

    const event = new CustomEvent("settings-change", {
      detail: { key, value: settings[key] !== undefined ? settings[key] : value, settings: { ...this.settings } },
    });
    this.root.dispatchEvent(event);
  }

  /**
   * Bind event listeners.
   */
  _bindEvents() {
    // Style selection
    this.root.addEventListener("click", (e) => {
      const btn = e.target.closest(".style-btn");
      if (btn) {
        const styleName = btn.dataset.style;
        if (styleName) this._selectStyle(styleName);
      }

      // Segmented control (covers selectors and toggles)
      const segBtn = e.target.closest(".segmented__btn");
      if (segBtn && !segBtn.closest(".style-grid")) {
        const container = segBtn.parentElement;
        const key = segBtn.dataset.key;
        const value = segBtn.dataset.value;
        if (key && value) {
          container.querySelectorAll(".segmented__btn").forEach((b) => {
            b.classList.remove("segmented__btn--active");
            b.setAttribute("aria-checked", "false");
          });
          segBtn.classList.add("segmented__btn--active");
          segBtn.setAttribute("aria-checked", "true");

          // Coerce value based on input type
          let typedValue = value;
          if (this._inputs[key]?.isToggle) {
            typedValue = value === "true" || value === true;
          }

          this.settings[key] = typedValue;

          const event = new CustomEvent("settings-change", {
            detail: { key, value: typedValue, settings: { ...this.settings } },
          });
          this.root.dispatchEvent(event);
        }
      }
    });

    // Generate button
    const genBtn = this.root.querySelector('[data-action="generate"]');
    if (genBtn) {
      genBtn.addEventListener("click", () => {
        this.root.dispatchEvent(new CustomEvent("generate", {
          detail: { settings: { ...this.settings } },
        }));
      });
    }
  }

  /**
   * Select a style and update UI.
   * @param {string} name
   */
  _selectStyle(name) {
    this.root.querySelectorAll(".style-btn").forEach((b) => {
      b.classList.remove("style-btn--active");
    });
    const target = this.root.querySelector(`[data-style="${name}"]`);
    if (target) target.classList.add("style-btn--active");

    this.settings.style = name;
    this.root.dispatchEvent(new CustomEvent("settings-change", {
      detail: { key: "style", value: name, settings: { ...this.settings } },
    }));
  }

  /* ─── Public API ────────────────────────────────────────────── */

  /**
   * Sync internal settings to the UI controls.
   */
  _syncToUI() {
    // Style
    this.root.querySelectorAll(".style-btn").forEach((b) => {
      b.classList.toggle("style-btn--active", b.dataset.style === this.settings.style);
    });

    // Sliders
    for (const key of ["strokeSizeMin", "strokeSizeMax", "strokeCount", "detailLevel", "styleStrength", "opacity", "randomness", "scatter"]) {
      const entry = this._inputs[key];
      if (!entry) continue;
      let val;
      if (key === "strokeSizeMin") val = this.settings.strokeSize?.min || PAINTER_DEFAULT_SETTINGS.strokeSize.min;
      else if (key === "strokeSizeMax") val = this.settings.strokeSize?.max || PAINTER_DEFAULT_SETTINGS.strokeSize.max;
      else val = this.settings[key] !== undefined ? this.settings[key] : PAINTER_DEFAULT_SETTINGS[key];

      entry.input.value = val;
      entry.valueSpan.textContent = this._formatSliderValue(entry.spec, val);
    }

    // Toggle (smart, oneLine)
    for (const key of ["smart", "oneLine"]) {
      const entry = this._inputs[key];
      if (!entry || !entry.isToggle) continue;
      const value = this.settings[key] !== undefined ? this.settings[key] : PAINTER_DEFAULT_SETTINGS[key];
      entry.segmented.querySelectorAll(".segmented__btn").forEach((b) => {
        const isActive = b.dataset.value === String(value);
        b.classList.toggle("segmented__btn--active", isActive);
        b.setAttribute("aria-checked", isActive ? "true" : "false");
      });
    }

    // Segmented selectors
    for (const key of ["order", "colorMode", "outline", "rfill"]) {
      const entry = this._inputs[key];
      if (!entry) continue;
      const container = entry.segmented;
      const value = this.settings[key] || PAINTER_DEFAULT_SETTINGS[key];
      container.querySelectorAll(".segmented__btn").forEach((b) => {
        const active = b.dataset.value === value;
        b.classList.toggle("segmented__btn--active", active);
        b.setAttribute("aria-checked", active ? "true" : "false");
      });
    }
  }

  /**
   * Format a slider value for display.
   * @param {object} spec
   * @param {string|number} value
   * @returns {string}
   */
  _formatSliderValue(spec, value) {
    const v = parseFloat(value);
    if (spec.display === "percent") {
      return `${Math.round(v * 100)}%`;
    }
    if (spec.key === "strokeCount") {
      return Math.round(v).toLocaleString();
    }
    return v.toFixed(1);
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
    return this.settings.style || "pencil";
  }

  /**
   * Destroy the controls manager.
   */
  destroy() {
    this.root.innerHTML = "";
  }
}

// Swatch color accents per style (warm palette)
const STYLE_SWATCH_COLORS = {
  pencil:     "#D4A373", // amber
  ink:        "#4A9E5C", // muted green
  watercolor: "#7B9EB1", // cool blue
  oil:        "#B8864F", // golden
  graffiti:   "#C45E54", // terracotta-red
  graphic:    "#8A7F9D", // muted purple
};

export { STYLE_PRESETS, PATH_ORDER_OPTIONS, COLOR_MODE_OPTIONS, SMART_OPTIONS, PAINTER_DEFAULT_SETTINGS };
export default ControlsManager;
