/**
 * Media Panel — the front door for the three Phase 1.6 / 2.1 / 3 engine modules.
 *
 * `js/ui/layers.js`, `js/engine/brush-media.js`, `js/engine/masks.js` and
 * `js/engine/wetsim.js` are Mac-owned. `js/ui/controls.js` is ThinkPad-owned and
 * this module never touches it: the media panel is a sibling surface with its
 * own chrome (strip / head / rail icons), so the ownership boundary holds and
 * the new engine parameters are reachable without editing a shared file.
 *
 * Three sections, matching the three engine modules:
 *
 *   WET MEDIA   → wetsim.js    (IF-2): maxWet, dryRate, flowRate, paperHeight,
 *                             granulation, Seed Reset
 *   MEDIA       → brush-media.js: bleed, bleedOpacity, tideDarken, granulation,
 *                             granulationCount
 *   TONAL MASKS → masks.js     (IF-1): lo, hi, softness, backgroundThreshold,
 *                             band enable, composite preview
 *
 * Every value is dispatched as a `media-settings-change` CustomEvent carrying
 * `{ section, key, value, settings }`; the host (App) is the only consumer.
 * The panel is output-neutral until a consumer opts in — it stores what the
 * user asked for, it does not paint.
 *
 * @module media
 */

import { MEDIA_PARAMS, MEDIA_PRESETS, isKnownBrushName } from "../engine/brush-media.js";
// masks.js exposes its defaults on the default export object, not as named
// exports — pull them from there rather than duplicating the literals.
import masksModule from "../engine/masks.js";

const DEFAULT_LO = masksModule.DEFAULT_LO;
const DEFAULT_HI = masksModule.DEFAULT_HI;
const DEFAULT_SOFTNESS = masksModule.DEFAULT_SOFTNESS;

/** Number of decimal places kept for each unit type. */
const UNIT_DECIMALS = { fraction: 3, percent: 3, int: 0 };

/**
 * Wet-media simulation parameters (wetsim.js `createWetSim` opts).
 * `default` values are the module's own defaults, so the panel opens showing
 * the engine's out-of-the-box behaviour.
 * @type {Array<object>}
 */
const WET_SIM_PARAMS = [
  { key: "maxWet",       label: "Wetness",     min: 0.2, max: 3,   step: 0.05, default: 1.5,  display: "fraction" },
  { key: "dryRate",      label: "Drying",      min: 0,   max: 4,   step: 0.05, default: 1,    display: "fraction" },
  { key: "flowRate",     label: "Flow",        min: 0,   max: 1,   step: 0.01, default: 0.45, display: "fraction" },
  { key: "heightScale",  label: "Paper Height",min: 0,   max: 4,   step: 0.05, default: 1,    display: "fraction" },
  { key: "granulation",  label: "Paper Tooth", min: 0,   max: 1,   step: 0.01, default: 0,    display: "fraction" },
];

/**
 * Output-neutrality opt-in. Not a slider: it is set by `media-host.js` the first
 * time a wet control moves, and read by `mediaModelFromPanel()` to decide
 * whether the model is wet or dry. It is a real settings key (so `_merge` and
 * `getSettings` carry it) but is deliberately kept out of `WET_SIM_PARAMS`
 * because that array drives the slider list.
 * @type {{key: string, label: string, default: boolean}}
 */
const WET_OPT_IN = { key: "wetOptIn", label: "Wet Media Active", default: false };

/** All wetSim keys, including the non-UI opt-in flag. */
const WET_SIM_KEYS = [...WET_SIM_PARAMS.map((p) => p.key), WET_OPT_IN.key];

/** Tonal-mask band edges (masks.js `computeTonalMasks` opts). */
const MASK_PARAMS = [
  { key: "lo",                  label: "Shadow Edge",  min: 1,   max: 254, step: 1,   default: DEFAULT_LO,     display: "int" },
  { key: "hi",                  label: "Highlight Edge", min: 1, max: 254, step: 1,   default: DEFAULT_HI,     display: "int" },
  { key: "softness",            label: "Softness",     min: 1,   max: 80,  step: 1,   default: DEFAULT_SOFTNESS, display: "int" },
  { key: "backgroundThreshold", label: "Background",   min: 0,   max: 0.5, step: 0.01, default: 0.15,            display: "fraction" },
];

/** The four tonal bands, in the order masks.js emits them. */
const MASK_BANDS = [
  { key: "background", label: "Background" },
  { key: "shadows",    label: "Shadows" },
  { key: "midtones",   label: "Midtones" },
  { key: "highlights", label: "Highlights" },
];

/** Copy shown under the TONAL MASKS title. */
const MASK_HINT =
  "Four soft, overlapping value bands computed from the loaded image's " +
  "luminance. Every pixel belongs to every band by degree, so the bands sum " +
  "to 1.0 with no seam. Edges are luminance (0-255); Background is the " +
  "darkest flat region a pixel may claim.";

/** Copy shown under the WET MEDIA title. */
const WET_HINT =
  "Wetness gates pigment transport: ink and wash only move where the paper " +
  "is wet. Drying fixes pigment as water evaporates; Paper Height and Paper " +
  "Tooth shape the sheet the wash sits on.";

/** Copy shown under the MEDIA title. */
const MEDIA_HINT =
  "Wet-style stroke behaviour, shared by watercolor, ink, wash and sumi. " +
  "Bleed spreads pigment past the stroke edge; Tide Line darkens the drying " +
  "rim; Granulation settles pigment into the paper tooth.";

/**
 * MediaPanel — manages the media panel DOM and user interactions.
 *
 * @param {HTMLElement} root — container element (the panel aside)
 * @param {object} [opts]
 * @param {object} [opts.settings] — starting settings, merged over defaults
 * @param {string} [opts.preset] — brush-media preset name to seed the media section
 */
export class MediaPanel {
  constructor(root, opts = {}) {
    if (!root) throw new Error("MediaPanel requires a root element");

    /** @type {HTMLElement} */
    this.root = root;
    this.settings = this._defaultSettings();

    if (opts.preset && MEDIA_PRESETS[opts.preset]) {
      this._applyMediaPreset(opts.preset);
    }
    if (opts.settings) {
      this._merge(opts.settings);
    }

    /** @type {Record<string, { input: HTMLInputElement, value: HTMLElement, spec: object }>} */
    this._inputs = {};
    /** @type {Record<string, HTMLButtonElement>} */
    this._bandToggles = {};
    /** @type {HTMLElement|null} */
    this._previewCanvas = null;
    /** @type {HTMLElement|null} */
    this._previewNote = null;
    /** @type {string|null} */
    this._previewBand = null;

    this._render();
    this._bindEvents();
    this._syncToUI();
  }

  /* ─── Defaults ───────────────────────────────────────────────── */

  /**
   * Build the default settings object from the parameter schemas.
   * @returns {object}
   * @private
   */
  _defaultSettings() {
    const wetSim = {};
    for (const key of WET_SIM_KEYS) {
      if (key === WET_OPT_IN.key) wetSim[key] = WET_OPT_IN.default;
      else wetSim[key] = WET_SIM_PARAMS.find((p) => p.key === key).default;
    }

    const media = {};
    for (const [key, schema] of Object.entries(MEDIA_PARAMS)) {
      if (schema && typeof schema === "object" && schema.default !== undefined) {
        media[key] = schema.default;
      }
    }
    // The stroke mark itself is not a wet parameter; it stays reachable but
    // must never be reset by a wet preset.
    media.size = MEDIA_PARAMS.size.default;
    media.brushName = "cpencil";

    const masks = {};
    for (const p of MASK_PARAMS) masks[p.key] = p.default;
    masks.bands = {};
    for (const b of MASK_BANDS) masks.bands[b.key] = true;

    return { wetSim, media, masks };
  }

  /**
   * Fold a brush-media preset's overrides into the media section.
   * @param {string} preset
   * @private
   */
  _applyMediaPreset(preset) {
    const base = MEDIA_PRESETS[preset] || {};
    for (const key of Object.keys(this.settings.media)) {
      if (base[key] !== undefined) this.settings.media[key] = base[key];
    }
    if (base.brushName && isKnownBrushName(base.brushName)) {
      this.settings.media.brushName = base.brushName;
    }
  }

  /**
   * Merge a plain object into the settings, ignoring unknown keys.
   * @param {object} incoming
   * @private
   */
  _merge(incoming) {
    for (const section of ["wetSim", "media", "masks"]) {
      const src = incoming[section];
      if (!src || typeof src !== "object") continue;
      for (const [key, value] of Object.entries(src)) {
        if (key in this.settings[section]) this.settings[section][key] = value;
      }
    }
  }

  /* ─── Rendering ──────────────────────────────────────────────── */

  /**
   * Build the panel: strip, head, rail icons and the scrolling section host.
   * Any pre-existing chrome inside `root` (the shell supplies strip and head)
   * is preserved and re-appended, so this manager never deletes shell DOM.
   * @private
   */
  _render() {
    this.root.classList.add("media-panel");

    const chrome = Array.from(this.root.children).filter(
      (el) =>
        el.classList.contains("panel-strip") ||
        el.classList.contains("panel-head") ||
        el.classList.contains("rail-icons"),
    );
    this.root.innerHTML = "";
    for (const el of chrome) this.root.appendChild(el);

    const host = document.createElement("div");
    host.className = "media-scroll";
    this.root.appendChild(host);

    const sections = [
      {
        id: "wet-section",
        title: "WET MEDIA",
        render: () => this._renderWetSection(),
      },
      {
        id: "media-section",
        title: "MEDIA",
        render: () => this._renderMediaSection(),
      },
      {
        id: "masks-section",
        title: "TONAL MASKS",
        render: () => this._renderMasksSection(),
      },
    ];

    for (const s of sections) {
      host.appendChild(this._renderSection(s));
    }
  }

  /**
   * Render one titled section: header, optional hint, body.
   * @param {{ id: string, title: string, render: Function }} section
   * @returns {HTMLElement}
   * @private
   */
  _renderSection(section) {
    const el = document.createElement("section");
    el.className = "control-section media-section";
    el.id = section.id;

    const header = document.createElement("h3");
    header.className = "control-section__title";
    header.textContent = section.title;
    el.appendChild(header);

    const hint = this._sectionHint(section.id);
    if (hint) {
      const p = document.createElement("p");
      p.className = "control-hint media-hint";
      p.textContent = hint;
      el.appendChild(p);
    }

    const body = document.createElement("div");
    body.className = "control-section__body";
    body.appendChild(section.render());
    el.appendChild(body);

    return el;
  }

  /**
   * The copy shown under a section title, if any.
   * @param {string} id
   * @returns {string|undefined}
   * @private
   */
  _sectionHint(id) {
    if (id === "wet-section") return WET_HINT;
    if (id === "media-section") return MEDIA_HINT;
    if (id === "masks-section") return MASK_HINT;
    return undefined;
  }

  /**
   * Render the WET MEDIA section: one slider per wetsim parameter plus the
   * Seed Reset action.
   * @returns {HTMLElement}
   * @private
   */
  _renderWetSection() {
    const wrapper = document.createElement("div");
    wrapper.className = "media-controls";

    for (const spec of WET_SIM_PARAMS) {
      wrapper.appendChild(
        this._renderSlider({
          ...spec,
          section: "wetSim",
          value: this.settings.wetSim[spec.key],
        }),
      );
    }

    const actions = document.createElement("div");
    actions.className = "media-actions";
    actions.appendChild(
      this._renderActionButton("seed-reset", "Seed Reset", "Reseed the paper height field"),
    );
    wrapper.appendChild(actions);

    return wrapper;
  }

  /**
   * Render the MEDIA section: one slider per wet-style media parameter.
   * @returns {HTMLElement}
   * @private
   */
  _renderMediaSection() {
    const wrapper = document.createElement("div");
    wrapper.className = "media-controls";

    for (const key of ["bleed", "bleedOpacity", "tideDarken", "granulation", "granulationCount"]) {
      const schema = MEDIA_PARAMS[key];
      if (!schema) continue;
      wrapper.appendChild(
        this._renderSlider({
          key,
          label: this._paramLabel(key),
          section: "media",
          min: schema.min,
          max: schema.max,
          step: key === "granulationCount" ? 10 : 0.01,
          default: schema.default,
          display: key === "granulationCount" ? "int" : "fraction",
          value: this.settings.media[key],
        }),
      );
    }

    return wrapper;
  }

  /**
   * Human-readable label for a media parameter key.
   * @param {string} key
   * @returns {string}
   * @private
   */
  _paramLabel(key) {
    switch (key) {
      case "bleed": return "Bleed";
      case "bleedOpacity": return "Bleed Opacity";
      case "tideDarken": return "Tide Line";
      case "granulation": return "Granulation";
      case "granulationCount": return "Granulation Count";
      default: return key;
    }
  }

  /**
   * Render the TONAL MASKS section: band toggles, edge sliders, and the
   * composite preview canvas.
   * @returns {HTMLElement}
   * @private
   */
  _renderMasksSection() {
    const wrapper = document.createElement("div");
    wrapper.className = "media-controls media-controls--masks";

    const bandRow = document.createElement("div");
    bandRow.className = "media-band-row";

    for (const band of MASK_BANDS) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "media-band-toggle" + (this.settings.masks.bands[band.key] ? " media-band-toggle--on" : "");
      btn.textContent = band.label;
      btn.dataset.band = band.key;
      // The band toggles are the only controls in the panel without an id, so
      // Maestro (and any id-based automation) could not target them. Same
      // convention as the sliders: `media-<section>-<key>`.
      btn.id = `media-masks-band-${band.key}`;
      btn.setAttribute("role", "switch");
      btn.setAttribute("aria-label", band.label);
      btn.setAttribute("aria-checked", this.settings.masks.bands[band.key] ? "true" : "false");
      bandRow.appendChild(btn);
      this._bandToggles[band.key] = btn;
    }
    wrapper.appendChild(bandRow);

    for (const spec of MASK_PARAMS) {
      wrapper.appendChild(
        this._renderSlider({
          ...spec,
          section: "masks",
          value: this.settings.masks[spec.key],
        }),
      );
    }

    const preview = document.createElement("div");
    preview.className = "media-preview";
    preview.id = "media-masks-preview";

    const canvas = document.createElement("canvas");
    canvas.className = "media-preview__canvas";
    canvas.width = 256;
    canvas.height = 160;
    canvas.setAttribute("aria-label", "Tonal mask composite preview");
    preview.appendChild(canvas);
    this._previewCanvas = canvas;

    const note = document.createElement("p");
    note.className = "media-preview__note";
    note.id = "media-masks-preview-note";
    note.textContent = "Load an image to compute the bands.";
    preview.appendChild(note);
    this._previewNote = note;

    wrapper.appendChild(preview);
    return wrapper;
  }

  /**
   * Render a single labelled slider with a live value readout.
   *
   * The readout uses `font-variant-numeric: tabular-nums` (see CSS) so a live
   * number does not jitter as it changes.
   *
   * @param {object} spec
   * @returns {HTMLElement}
   * @private
   */
  _renderSlider(spec) {
    const id = `media-${spec.section}-${spec.key}`;
    const container = document.createElement("div");
    container.className = "control-slider media-slider";
    container.dataset.section = spec.section;
    container.dataset.key = spec.key;

    const label = document.createElement("label");
    label.className = "slider-label";
    label.htmlFor = id;
    label.textContent = spec.label;

    const row = document.createElement("div");
    row.className = "slider-row";

    const input = document.createElement("input");
    input.type = "range";
    input.id = id;
    input.min = spec.min;
    input.max = spec.max;
    input.step = spec.step;
    input.value = spec.value;
    input.setAttribute("aria-label", spec.label);

    const value = document.createElement("span");
    value.className = "slider-value";
    value.textContent = this._formatValue(spec, spec.value);

    input.addEventListener("input", () => {
      const next = parseFloat(input.value);
      value.textContent = this._formatValue(spec, next);
      this._setValue(spec.section, spec.key, next);
    });
    input.addEventListener("change", () => {
      const next = parseFloat(input.value);
      value.textContent = this._formatValue(spec, next);
      this._setValue(spec.section, spec.key, next);
    });

    this._inputs[`${spec.section}.${spec.key}`] = { input, value, spec };

    row.appendChild(input);
    row.appendChild(value);
    container.appendChild(label);
    container.appendChild(row);

    return container;
  }

  /**
   * Render a text action button.
   * @param {string} action
   * @param {string} label
   * @param {string} [title]
   * @returns {HTMLButtonElement}
   * @private
   */
  _renderActionButton(action, label, title) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn--ghost btn--sm media-action-btn";
    btn.dataset.action = action;
    btn.textContent = label;
    if (title) btn.title = title;
    return btn;
  }

  /* ─── Events ─────────────────────────────────────────────────── */

  /**
   * Bind delegated events on the panel root.
   * @private
   */
  _bindEvents() {
    // Band enable toggles
    this.root.addEventListener("click", (e) => {
      const bandBtn = e.target.closest(".media-band-toggle");
      if (bandBtn) {
        const band = bandBtn.dataset.band;
        if (band) this._toggleBand(band);
        return;
      }

      const actionBtn = e.target.closest(".media-action-btn");
      if (actionBtn) {
        const action = actionBtn.dataset.action;
        if (action === "seed-reset") this._resetSeed();
      }
    });
  }

  /**
   * Flip a tonal band's enabled state.
   * @param {string} band
   * @private
   */
  _toggleBand(band) {
    const next = !this.settings.masks.bands[band];
    this.settings.masks.bands[band] = next;

    const btn = this._bandToggles[band];
    if (btn) {
      btn.classList.toggle("media-band-toggle--on", next);
      btn.setAttribute("aria-checked", next ? "true" : "false");
    }

    this._dispatch("masks", `bands.${band}`, next);
    this._drawPreview();
  }

  /**
   * Reseed the wet-sim paper height field.
   *
   * The seed is not a slider: it is an explicit action, because a slider would
   * make the paper relief change continuously while dragging and look like a
   * bug. Emitting a new seed lets a consumer rebuild its sim deterministically.
   * @private
   */
  _resetSeed() {
    const seed = Math.floor(Math.random() * 1_000_000);
    this.settings.wetSim.seed = seed;
    this._dispatch("wetSim", "seed", seed);
  }

  /**
   * Store a value and dispatch it.
   * @param {string} section
   * @param {string} key
   * @param {number} value
   * @private
   */
  _setValue(section, key, value) {
    this.settings[section][key] = value;
    this._dispatch(section, key, value);
  }

  /**
   * Dispatch a `media-settings-change` event on the panel root.
   * @param {string} section
   * @param {string} key
   * @param {*} value
   * @private
   */
  _dispatch(section, key, value) {
    this.root.dispatchEvent(
      new CustomEvent("media-settings-change", {
        detail: { section, key, value, settings: this.getSettings() },
      }),
    );
  }

  /* ─── Public API ─────────────────────────────────────────────── */

  /**
   * Get a copy of the current settings.
   * @returns {object}
   */
  getSettings() {
    return {
      wetSim: { ...this.settings.wetSim },
      media: { ...this.settings.media },
      masks: { ...this.settings.masks, bands: { ...this.settings.masks.bands } },
    };
  }

  /**
   * Merge settings from outside and sync the controls.
   * @param {object} settings
   */
  setSettings(settings) {
    this._merge(settings || {});
    this._syncToUI();
  }

  /**
   * Seed the media section from a brush-media preset name.
   * @param {string} preset
   */
  setMediaPreset(preset) {
    if (!MEDIA_PRESETS[preset]) return;
    this._applyMediaPreset(preset);
    this._syncToUI();
  }

  /**
   * Push a computed tonal-mask composite into the preview canvas.
   *
   * Accepts either a raw RGBA buffer (`rgba` with `width`/`height`) or an
   * `ImageData`. The panel does not compute the masks — it only displays what
   * a consumer (the App, or a test) has already computed, so the engine
   * boundary stays one-way.
   *
   * @param {object} frame
   * @param {Uint8ClampedArray|ImageData} frame.data
   * @param {number} frame.width
   * @param {number} frame.height
   * @param {object} [frame.coverage] - optional per-band coverage fractions
   * @param {string} [note] - optional caption under the canvas
   */
  setMaskPreview(frame, note) {
    const canvas = this._previewCanvas;
    if (!canvas || !frame || !frame.data) return;

    const { width, height, data } = frame;
    const off = document.createElement("canvas");
    off.width = width;
    off.height = height;
    const offCtx = off.getContext("2d");
    if (!offCtx) return;

    if (data instanceof ImageData) {
      offCtx.putImageData(data, 0, 0);
    } else {
      offCtx.putImageData(new ImageData(data, width, height), 0, 0);
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(off, 0, 0, canvas.width, canvas.height);

    // Remember the frame so a band toggle can re-render it immediately.
    this._rememberFrame(frame);

    if (this._previewNote) {
      if (note) {
        this._previewNote.textContent = note;
      } else if (frame.coverage) {
        const parts = MASK_BANDS
          .filter((b) => this.settings.masks.bands[b.key])
          .map((b) => `${b.label} ${Math.round((frame.coverage[b.key] || 0) * 100)}%`);
        this._previewNote.textContent = parts.join(" · ");
      }
    }
  }

  /**
   * Redraw the preview from a stored frame, if one has been set.
   * Called after a band toggle so the enabled set is reflected immediately.
   * @private
   */
  _drawPreview() {
    if (!this._lastFrame) return;
    this.setMaskPreview(this._lastFrame);
  }

  /**
   * Remember a frame so band toggles can re-render it.
   * @param {object} frame
   * @private
   */
  _rememberFrame(frame) {
    this._lastFrame = frame;
  }

  /**
   * Sync the DOM controls to the current settings object.
   * @private
   */
  _syncToUI() {
    for (const [path, entry] of Object.entries(this._inputs)) {
      const [section, key] = path.split(".");
      const value = this.settings[section]?.[key];
      if (value === undefined) continue;
      entry.input.value = value;
      entry.value.textContent = this._formatValue(entry.spec, value);
    }

    for (const [band, btn] of Object.entries(this._bandToggles)) {
      const on = !!this.settings.masks.bands[band];
      btn.classList.toggle("media-band-toggle--on", on);
      btn.setAttribute("aria-checked", on ? "true" : "false");
    }
  }

  /**
   * Format a value for the readout.
   * @param {object} spec
   * @param {number} value
   * @returns {string}
   * @private
   */
  _formatValue(spec, value) {
    const decimals = UNIT_DECIMALS[spec.display] ?? 2;
    return Number(value).toFixed(decimals);
  }

  /**
   * Destroy the panel.
   */
  destroy() {
    this.root.innerHTML = "";
  }
}

export { WET_SIM_PARAMS, MASK_PARAMS, MASK_BANDS };
export default MediaPanel;
