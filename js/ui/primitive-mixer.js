/**
 * Stroke-language mixer — the DOM section (Track-S S5 / M16, the Mac half).
 *
 * The **DOM half** of the primitive mixer. All translation, level precedence,
 * round-trip safety and read-out live in `primitive-mixer-core.js` (node
 * testable); this module only builds the section and forwards user intent.
 *
 * It renders as one `.control-section` inside the Style panel
 * (`js/ui/style-library.js` mounts it) — six weight sliders (`0..1`, step
 * 0.05), a level picker that mirrors the S5 precedence (`global` > … i.e. the
 * mix may be declared profile-wide, per layer or per pass), a canonical
 * read-out, the resolved `effectiveStyle`, and any validation error next to the
 * control it came from.
 *
 * The section never imports `app.js` and never touches the engine: it edits a
 * mix and dispatches `primitive-mix-change`; the Style panel is the consumer,
 * writing the mix into the profile it saves.
 *
 * @module primitive-mixer
 */

import {
  WEIGHT_STEP,
  MIXER_LEVELS,
  levelLabel,
  mixFromSliders,
  slidersFromMix,
  levelTargets,
  hasTargetAtLevel,
  readMixAtLevel,
  describeMix,
} from './primitive-mixer-core.js';
import { PRIMITIVE_IDS, PRIMITIVES } from '../engine/primitives.js';

/** Copy shown under the section title. */
const MIXER_HINT =
  'Weight the six stroke-language primitives to describe a stroke character — ' +
  'a broad wash for the masses, crisp hatch for the accents. Weights are ' +
  'relative and normalise to 100 %. A mix is opt-in: leave every slider at 0 ' +
  'and the profile keeps its plain style name.';

/**
 * PrimitiveMixerSection — owns one mixer section in the Style panel.
 *
 * @param {object} [opts]
 * @param {number} [opts.step] - slider step (default 0.05)
 * @param {function} [opts.onChange] - called with the change detail
 */
export class PrimitiveMixerSection {
  constructor(opts = {}) {
    this._step = opts.step || WEIGHT_STEP;
    this._onChange = typeof opts.onChange === 'function' ? opts.onChange : null;

    /** The profile whose STRUCTURE we mirror (layers / passes). May be null. */
    this._profile = null;
    /** @type {'global'|'layer'|'pass'} */
    this._level = 'global';
    /** @type {string|null} */
    this._layerRole = null;
    /** @type {string|null} */
    this._passId = null;
    /** Raw slider values, keyed by primitive id. */
    this._values = {};
    /** @type {string|null} */
    this._fallbackStyle = null;

    this._sliders = {};
    this._valueLabels = {};

    this.element = this._build();
    this._bind();
    this._syncLevelPicker();
    this._updateReadout();
  }

  /* ─── Build ─────────────────────────────────────────────────── */

  /**
   * @returns {HTMLElement}
   * @private
   */
  _build() {
    const section = document.createElement('section');
    section.className = 'control-section primitive-mixer';
    section.id = 'primitive-mixer';
    section.setAttribute('aria-label', 'Stroke language mixer');

    const title = document.createElement('h3');
    title.className = 'control-section__title';
    title.textContent = 'STROKE LANGUAGE';
    section.appendChild(title);

    const hint = document.createElement('p');
    hint.className = 'control-hint mixer-hint';
    hint.textContent = MIXER_HINT;
    section.appendChild(hint);

    const body = document.createElement('div');
    body.className = 'control-section__body';
    section.appendChild(body);

    body.appendChild(this._buildLevelRow());
    body.appendChild(this._buildTargetRow());

    const sliders = document.createElement('div');
    sliders.className = 'mixer-sliders';
    for (const id of PRIMITIVE_IDS) sliders.appendChild(this._buildSlider(id));
    body.appendChild(sliders);

    const readout = document.createElement('p');
    readout.className = 'mixer-readout';
    readout.id = 'primitive-readout';
    readout.setAttribute('role', 'status');
    readout.setAttribute('aria-live', 'polite');
    readout.textContent = '';
    body.appendChild(readout);
    this._readoutEl = readout;

    const error = document.createElement('p');
    error.className = 'mixer-error';
    error.id = 'primitive-error';
    error.setAttribute('role', 'status');
    error.setAttribute('aria-live', 'assertive');
    error.textContent = '';
    body.appendChild(error);
    this._errorEl = error;

    const actions = document.createElement('div');
    actions.className = 'mixer-actions';
    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.id = 'primitive-clear';
    clearBtn.className = 'btn btn--ghost btn--sm mixer-clear-btn';
    clearBtn.textContent = 'Clear mix';
    clearBtn.setAttribute('aria-label', 'Clear the primitive mix');
    actions.appendChild(clearBtn);
    body.appendChild(actions);

    return section;
  }

  /**
   * The level picker row: Global / Layer / Pass.
   * @returns {HTMLElement}
   * @private
   */
  _buildLevelRow() {
    const row = document.createElement('div');
    row.className = 'mixer-field mixer-level-row';

    const label = document.createElement('label');
    label.className = 'mixer-field__label';
    label.htmlFor = 'primitive-level';
    label.textContent = 'Level';
    row.appendChild(label);

    const select = document.createElement('select');
    select.id = 'primitive-level';
    select.className = 'mixer-select';
    select.setAttribute('aria-label', 'Primitive mix level');
    for (const level of MIXER_LEVELS) {
      const opt = document.createElement('option');
      opt.value = level;
      opt.textContent = levelLabel(level);
      select.appendChild(opt);
    }
    select.value = this._level;
    row.appendChild(select);
    this._levelSelect = select;

    return row;
  }

  /**
   * The target picker row (Layer role / Pass id) — hidden at the global level.
   * @returns {HTMLElement}
   * @private
   */
  _buildTargetRow() {
    const row = document.createElement('div');
    row.className = 'mixer-field mixer-target-row';
    row.hidden = true;

    const label = document.createElement('label');
    label.className = 'mixer-field__label';
    label.htmlFor = 'primitive-target';
    label.textContent = 'Target';
    row.appendChild(label);

    const select = document.createElement('select');
    select.id = 'primitive-target';
    select.className = 'mixer-select';
    select.setAttribute('aria-label', 'Primitive mix target');
    row.appendChild(select);
    this._targetSelect = select;
    this._targetRow = row;

    return row;
  }

  /**
   * One weight slider row. Reuses the shell's `.slider-row` / `.slider-label`
   * / `.slider-value` classes so it matches every other slider in the app.
   * @param {string} id
   * @returns {HTMLElement}
   * @private
   */
  _buildSlider(id) {
    const row = document.createElement('div');
    row.className = 'slider-row mixer-slider-row';
    row.dataset.primitiveId = id;

    const label = document.createElement('label');
    label.className = 'slider-label';
    label.htmlFor = `primitive-weight-${id}`;
    label.textContent = PRIMITIVES[id].label;
    row.appendChild(label);

    const input = document.createElement('input');
    input.type = 'range';
    input.id = `primitive-weight-${id}`;
    input.className = 'mixer-range';
    input.min = '0';
    input.max = '1';
    input.step = String(this._step);
    input.value = '0';
    input.dataset.primitiveId = id;
    input.setAttribute('aria-label', `${PRIMITIVES[id].label} weight`);
    row.appendChild(input);
    this._sliders[id] = input;

    const value = document.createElement('span');
    value.className = 'slider-value';
    value.id = `primitive-weight-value-${id}`;
    value.textContent = '0.00';
    row.appendChild(value);
    this._valueLabels[id] = value;

    return row;
  }

  /* ─── Events ────────────────────────────────────────────────── */

  /**
   * @private
   */
  _bind() {
    this._levelSelect.addEventListener('change', () => {
      this._level = this._levelSelect.value;
      this._ensureValidTarget();
      this._loadFromProfile();
      this._syncLevelPicker();
      this._updateReadout();
      this._emit();
    });

    this._targetSelect.addEventListener('change', () => {
      this._readTargetFromSelect();
      this._loadFromProfile();
      this._updateReadout();
      this._emit();
    });

    for (const id of PRIMITIVE_IDS) {
      const input = this._sliders[id];
      input.addEventListener('input', () => {
        this._values[id] = Number(input.value);
        this._valueLabels[id].textContent = Number(input.value).toFixed(2);
        this._updateReadout();
        this._emit();
      });
    }

    this.element.querySelector('#primitive-clear').addEventListener('click', () => {
      this.clear();
    });
  }

  /* ─── State ─────────────────────────────────────────────────── */

  /**
   * Point the mixer at a profile: mirror its layers / passes as targets and load
   * whatever mix it declares at the current level.
   * @param {object|null} profile
   */
  setProfile(profile) {
    this._profile = profile || null;
    this._fallbackStyle = profile?.global?.style ?? null;
    this._ensureValidTarget();
    this._syncLevelPicker();
    this._loadFromProfile();
    this._updateReadout();
  }

  /**
   * The current mix (positive weights only) — exactly what
   * `writeMixAtLevel` consumes.
   * @returns {Record<string, number>}
   */
  getMix() {
    return mixFromSliders(this._values);
  }

  /**
   * The full context: which level, and the target within it.
   * @returns {{level: string, layerRole: string|null, passId: string|null}}
   */
  getContext() {
    return { level: this._level, layerRole: this._layerRole, passId: this._passId };
  }

  /** @returns {string} */
  get level() {
    return this._level;
  }

  /** @returns {boolean} whether any primitive carries a positive weight. */
  get hasMix() {
    return Object.keys(this.getMix()).length > 0;
  }

  /**
   * Set the sliders from a mix (does not emit — a programmatic load).
   * @param {object|Array} mix
   */
  setValues(mix) {
    this._values = slidersFromMix(mix);
    for (const id of PRIMITIVE_IDS) {
      const w = this._values[id] ?? 0;
      this._sliders[id].value = String(w);
      this._valueLabels[id].textContent = w.toFixed(2);
    }
    this._updateReadout();
  }

  /** Clear every slider (a real user action — emits). */
  clear() {
    this.setValues({});
    this._emit();
  }

  /* ─── Internals ─────────────────────────────────────────────── */

  /**
   * Keep `_level`, `_layerRole` and `_passId` coherent with the profile: drop a
   * level whose target has vanished back to the nearest valid one.
   * @private
   */
  _ensureValidTarget() {
    if (this._level !== 'global' && !hasTargetAtLevel(this._profile, this.getContext())) {
      const { layers, passes } = levelTargets(this._profile);
      if (this._level === 'layer') {
        if (layers.length) this._layerRole = this._layerRole && layers.includes(this._layerRole) ? this._layerRole : layers[0];
        else this._level = 'global';
      } else if (this._level === 'pass') {
        if (passes.length) this._passId = this._passId && passes.includes(this._passId) ? this._passId : passes[0];
        else this._level = 'global';
      }
    }
    this._levelSelect.value = this._level;
  }

  /**
   * Rebuild the target `<select>` and toggle the level options that have no
   * target, so a level is never offered when it cannot be written.
   * @private
   */
  _syncLevelPicker() {
    const { layers, passes } = levelTargets(this._profile);
    for (const opt of this._levelSelect.options) {
      if (opt.value === 'layer') opt.disabled = layers.length === 0;
      if (opt.value === 'pass') opt.disabled = passes.length === 0;
    }

    const showTarget = this._level === 'layer' || this._level === 'pass';
    this._targetRow.hidden = !showTarget;
    if (!showTarget) return;

    const options = this._level === 'layer' ? layers : passes;
    // Clear-only innerHTML: rebuilds a fixed list of role/pass names that come
    // from the profile itself; nothing untrusted is interpolated here.
    this._targetSelect.innerHTML = '';
    for (const value of options) {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = value;
      this._targetSelect.appendChild(opt);
    }
    const current = this._level === 'layer' ? this._layerRole : this._passId;
    if (current && options.includes(current)) this._targetSelect.value = current;
    this._readTargetFromSelect();
  }

  /**
   * @private
   */
  _readTargetFromSelect() {
    const value = this._targetSelect.value || null;
    if (this._level === 'layer') this._layerRole = value;
    else if (this._level === 'pass') this._passId = value;
  }

  /**
   * Load the mix declared at the current level off the profile.
   * @private
   */
  _loadFromProfile() {
    this.setValues(readMixAtLevel(this._profile, this.getContext()));
  }

  /**
   * Recompute the read-out + validation from the current mix.
   * @private
   */
  _updateReadout() {
    const d = describeMix(this.getMix(), this._fallbackStyle);
    if (this._readoutEl) this._readoutEl.textContent = d.readout;

    // Surface a real validation error next to the control it names. The UI can
    // only offer known ids, so this fires for an imported / hand-edited mix.
    if (this._errorEl) {
      if (d.valid) {
        this._errorEl.textContent = '';
        this._errorEl.hidden = true;
      } else {
        this._errorEl.hidden = false;
        this._errorEl.textContent = d.errors.map((e) => `${e.path}: ${e.message}`).join('; ');
      }
    }
    this._markErrors(d.errors);
  }

  /**
   * Add `.mixer-row--error` to a slider whose primitive is named in an error
   * path, so the message and the control agree.
   * @param {Array<{path: string}>} errors
   * @private
   */
  _markErrors(errors) {
    const bad = new Set();
    for (const e of errors || []) {
      for (const id of PRIMITIVE_IDS) {
        if (typeof e.path === 'string' && e.path.includes(id)) bad.add(id);
      }
    }
    for (const id of PRIMITIVE_IDS) {
      const row = this._sliders[id].closest('.mixer-slider-row');
      if (row) row.classList.toggle('mixer-row--error', bad.has(id));
    }
  }

  /**
   * @private
   */
  _emit() {
    const detail = {
      mix: this.getMix(),
      ...this.getContext(),
      readout: describeMix(this.getMix(), this._fallbackStyle),
    };
    this.element.dispatchEvent(new CustomEvent('primitive-mix-change', { bubbles: true, detail }));
    if (this._onChange) this._onChange(detail);
  }
}

export default PrimitiveMixerSection;
