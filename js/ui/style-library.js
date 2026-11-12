/**
 * Style Library Panel — Phase 4.2 (Round 2 / M10).
 *
 * The **DOM half** of the Style Profile library. All state, persistence and
 * schema handling live in `style-library-core.js` (node-testable); this module
 * only renders the rows and forwards user intent. It follows the same shape as
 * `js/ui/media.js`: a panel manager that owns its contents and leaves the
 * shell's chrome (identity strip, header, collapse chevron, rail icons) alone.
 *
 * Save / load / apply / delete / export / import:
 *
 *   SAVE    captures the host's current settings + media model into a profile
 *   APPLY   hands the profile to the host, which re-bakes deterministically
 *   DELETE  removes one profile (with a confirm, because it is destructive)
 *   EXPORT  copies the profile JSON to the clipboard / downloads it
 *   IMPORT  pastes or picks a profile JSON file
 *
 * The panel dispatches `style-profile-apply` with the *expanded* apply result;
 * the host shim (`style-library-host.js`) is the only consumer and owns the
 * engine call, so this module never imports `app.js`.
 *
 * @module style-library
 */

import {
  ProfileLibrary,
  defaultProfile,
  coerceProfileName,
  profileToExportText,
  STORAGE_KEY,
} from './style-library-core.js';

/** Which Brush-panel keys are captured into `global`. */
const GLOBAL_KEYS = [
  'style', 'strokeCount', 'detailLevel', 'styleStrength', 'opacity',
  'randomness', 'colorMode', 'palette', 'abstract', 'outline', 'rfill',
  'oneLine', 'smart', 'multiLayer', 'pathOrder', 'order', 'seed',
];

/** Copy shown under the panel title. */
const LIBRARY_HINT =
  'A Style Profile is the whole recipe — style, density, colour, path order, ' +
  'seed, media and per-tone overrides — in one portable JSON object. Saving ' +
  'captures the current brush and media settings; applying re-bakes the same ' +
  'image with them.';

/** Copy shown under the SAVE row. */
const SAVE_HINT =
  'Capture the current settings as a profile. The seed is stored in the ' +
  'profile, so the same profile + the same source image re-bakes identically.';

/** Copy shown under the IMPORT row. */
const IMPORT_HINT =
  'Paste a profile JSON object, or pick a .json file. A profile that is ' +
  'already in the library is updated in place rather than duplicated.';

/**
 * StyleLibraryPanel — manages the library panel DOM.
 *
 * @param {HTMLElement} root — the panel container (`#style-library-root`)
 * @param {object} [opts]
 * @param {ProfileLibrary} [opts.library] - inject a library (tests)
 * @param {object} [opts.host] - the host App, used to read settings on save
 * @param {function} [opts.onApply] - called with the apply result
 * @param {function} [opts.confirm] - destructive-action confirm (default: window.confirm)
 */
export class StyleLibraryPanel {
  constructor(root, opts = {}) {
    if (!root) throw new Error('StyleLibraryPanel requires a root element');

    /** @type {HTMLElement} */
    this.root = root;
    this.library = opts.library || new ProfileLibrary({ storage: defaultStorage() });
    this._host = opts.host || null;
    this._onApply = typeof opts.onApply === 'function' ? opts.onApply : null;
    this._confirm = typeof opts.confirm === 'function' ? opts.confirm : defaultConfirm;

    /** @type {string|null} */
    this._selectedId = null;
    /** @type {HTMLElement|null} */
    this._listEl = null;
    /** @type {HTMLElement|null} */
    this._statusEl = null;
    /** @type {HTMLElement|null} */
    this._nameInput = null;
    /** @type {HTMLElement|null} */
    this._previewEl = null;

    this._render();
    this._bindEvents();
    this._refresh();
  }

  /* ─── Rendering ─────────────────────────────────────────────── */

  /**
   * Build the panel: preserve the shell chrome, then fill the scroll host.
   * @private
   */
  _render() {
    this.root.classList.add('style-library-panel', 'panel--library');

    // The shell owns the strip / header / rail icons; clearing innerHTML would
    // delete them and this manager never restores them.
    const chrome = Array.from(this.root.children).filter(
      (el) =>
        el.classList.contains('panel-strip') ||
        el.classList.contains('panel-head') ||
        el.classList.contains('rail-icons'),
    );
    this.root.innerHTML = '';
    for (const el of chrome) this.root.appendChild(el);

    const scroll = document.createElement('div');
    scroll.className = 'library-scroll';
    this.root.appendChild(scroll);

    scroll.appendChild(this._section('ABOUT', LIBRARY_HINT, this._renderAboutBody()));
    scroll.appendChild(this._section('SAVE', SAVE_HINT, this._renderSaveBody()));
    scroll.appendChild(this._section('PROFILES', '', this._renderListBody()));
    scroll.appendChild(this._section('IMPORT', IMPORT_HINT, this._renderImportBody()));
  }

  /**
   * Render a titled section: header, optional hint, body.
   * @param {string} title
   * @param {string} hint
   * @param {HTMLElement} body
   * @returns {HTMLElement}
   * @private
   */
  _section(title, hint, body) {
    const el = document.createElement('section');
    el.className = 'control-section library-section';

    const header = document.createElement('h3');
    header.className = 'control-section__title';
    header.textContent = title;
    el.appendChild(header);

    if (hint) {
      const p = document.createElement('p');
      p.className = 'control-hint library-hint';
      p.textContent = hint;
      el.appendChild(p);
    }

    const wrap = document.createElement('div');
    wrap.className = 'control-section__body';
    wrap.appendChild(body);
    el.appendChild(wrap);

    return el;
  }

  /**
   * The ABOUT body: a read-out of what the library is storing.
   * @returns {HTMLElement}
   * @private
   */
  _renderAboutBody() {
    const wrap = document.createElement('div');
    wrap.className = 'library-about';

    const storage = document.createElement('p');
    storage.className = 'library-storage-note';
    storage.id = 'library-storage-note';
    storage.textContent = this._storageNote();
    wrap.appendChild(storage);

    return wrap;
  }

  /**
   * A human line about where the profiles are persisted.
   * @returns {string}
   * @private
   */
  _storageNote() {
    const has = !!this.library._storage;
    const n = this.library.list().length;
    if (!has) return `${n} profile(s) held in memory only — storage is unavailable.`;
    return `${n} profile(s) stored in this browser under "${STORAGE_KEY}".`;
  }

  /**
   * The SAVE body: a name field and a save button.
   * @returns {HTMLElement}
   * @private
   */
  _renderSaveBody() {
    const wrap = document.createElement('div');
    wrap.className = 'library-save';

    const nameRow = document.createElement('div');
    nameRow.className = 'library-name-row';

    const name = document.createElement('input');
    name.type = 'text';
    name.className = 'library-name-input';
    name.id = 'library-name-input';
    name.placeholder = 'Profile name';
    name.maxLength = 128;
    name.setAttribute('aria-label', 'Profile name');
    nameRow.appendChild(name);
    this._nameInput = name;

    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'btn btn--primary btn--sm library-action-btn';
    saveBtn.id = 'library-save-btn';
    saveBtn.textContent = 'Save';
    saveBtn.setAttribute('aria-label', 'Save current settings as a profile');
    nameRow.appendChild(saveBtn);

    wrap.appendChild(nameRow);

    const status = document.createElement('p');
    status.className = 'library-status';
    status.id = 'library-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.textContent = '';
    wrap.appendChild(status);
    this._statusEl = status;

    return wrap;
  }

  /**
   * The PROFILES body: the list plus an empty-state note.
   * @returns {HTMLElement}
   * @private
   */
  _renderListBody() {
    const wrap = document.createElement('div');
    wrap.className = 'library-list-wrap';

    const list = document.createElement('div');
    list.className = 'library-list';
    list.id = 'library-list';
    list.setAttribute('role', 'list');
    wrap.appendChild(list);
    this._listEl = list;

    return wrap;
  }

  /**
   * The IMPORT body: paste field, import button, file picker.
   * @returns {HTMLElement}
   * @private
   */
  _renderImportBody() {
    const wrap = document.createElement('div');
    wrap.className = 'library-import';

    const area = document.createElement('textarea');
    area.className = 'library-import-input';
    area.id = 'library-import-input';
    area.rows = 4;
    area.placeholder = '{"schemaVersion":1, …}';
    area.setAttribute('aria-label', 'Paste a Style Profile JSON');
    wrap.appendChild(area);

    const row = document.createElement('div');
    row.className = 'library-import-row';

    const importBtn = document.createElement('button');
    importBtn.type = 'button';
    importBtn.className = 'btn btn--ghost btn--sm library-action-btn';
    importBtn.id = 'library-import-btn';
    importBtn.textContent = 'Import';
    importBtn.setAttribute('aria-label', 'Import the pasted profile JSON');
    row.appendChild(importBtn);

    const fileBtn = document.createElement('button');
    fileBtn.type = 'button';
    fileBtn.className = 'btn btn--ghost btn--sm library-action-btn';
    fileBtn.id = 'library-import-file-btn';
    fileBtn.textContent = 'Choose file';
    fileBtn.setAttribute('aria-label', 'Import a profile JSON file');
    row.appendChild(fileBtn);

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'application/json,.json';
    fileInput.id = 'library-import-file';
    fileInput.style.display = 'none';
    fileInput.setAttribute('aria-label', 'Profile JSON file');
    row.appendChild(fileInput);

    wrap.appendChild(row);

    const preview = document.createElement('pre');
    preview.className = 'library-preview';
    preview.id = 'library-preview';
    preview.textContent = '';
    preview.setAttribute('aria-label', 'Selected profile JSON preview');
    wrap.appendChild(preview);
    this._previewEl = preview;

    return wrap;
  }

  /**
   * Render one profile row.
   * @param {{id: string, name: string, summary: object, profile: object}} row
   * @returns {HTMLElement}
   * @private
   */
  _renderRow(row) {
    const el = document.createElement('div');
    el.className = 'library-row';
    el.dataset.profileId = row.id;
    el.setAttribute('role', 'listitem');

    if (row.id === this._selectedId) el.classList.add('library-row--active');

    const main = document.createElement('div');
    main.className = 'library-row__main';

    const select = document.createElement('button');
    select.type = 'button';
    select.className = 'library-row__select';
    select.dataset.action = 'select';
    select.setAttribute('aria-label', `Select profile ${row.name}`);
    select.setAttribute('aria-pressed', row.id === this._selectedId ? 'true' : 'false');

    const name = document.createElement('span');
    name.className = 'library-row__name';
    name.textContent = row.name;
    name.title = row.name;
    select.appendChild(name);

    const meta = document.createElement('span');
    meta.className = 'library-row__meta';
    const s = row.summary;
    meta.textContent = `${s.style} · ${s.strokeCount} strokes · ${s.mediaKind}`;
    select.appendChild(meta);

    main.appendChild(select);
    el.appendChild(main);

    // The actions are a full-width row BELOW the identity, not a column beside
    // it: three labelled buttons plus a readable name do not fit in a 232px
    // row, and beside they squeezed the identity to 62px and clipped the meta.
    const actions = document.createElement('div');
    actions.className = 'library-row__actions';

    actions.appendChild(this._rowBtn('apply', 'Apply', `Apply profile ${row.name}`));
    actions.appendChild(this._rowBtn('export', 'Export', `Export profile ${row.name}`));
    actions.appendChild(this._rowBtn('delete', 'Delete', `Delete profile ${row.name}`, true));

    el.appendChild(actions);

    return el;
  }

  /**
   * A small icon-free row button. Text, not an icon: the row is dense and a
   * text label keeps the action legible at 8px.
   * @param {string} action
   * @param {string} label
   * @param {string} ariaLabel
   * @param {boolean} [danger]
   * @returns {HTMLButtonElement}
   * @private
   */
  _rowBtn(action, label, ariaLabel, danger = false) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'library-row-btn' + (danger ? ' library-row-btn--danger' : '');
    btn.dataset.action = action;
    btn.textContent = label;
    btn.setAttribute('aria-label', ariaLabel);
    return btn;
  }

  /* ─── Events ────────────────────────────────────────────────── */

  /**
   * Bind delegated events on the panel root.
   * @private
   */
  _bindEvents() {
    this.root.addEventListener('click', (e) => {
      // Panel-level buttons (Save / Import / Choose file) carry an id, not a
      // data-action; row buttons carry data-action on a descendant of the row.
      // Look up BOTH, or the id-only buttons are silently dead.
      const actionBtn = e.target.closest('[data-action]');
      const idBtn = e.target.closest('[id^="library-"]');
      const btn = actionBtn || idBtn;
      if (!btn) return;

      if (actionBtn) {
        // Row actions carry their id on the row element.
        const rowEl = actionBtn.closest('.library-row');
        const id = rowEl ? rowEl.dataset.profileId : null;
        const action = actionBtn.dataset.action;

        if (action === 'select' && id) {
          this._select(id);
          return;
        }
        if (action === 'apply' && id) {
          this._apply(id);
          return;
        }
        if (action === 'export' && id) {
          this._export(id);
          return;
        }
        if (action === 'delete' && id) {
          this._delete(id);
          return;
        }
      }

      // Panel-level buttons are addressed by their id.
      const bid = btn.id;
      if (bid === 'library-save-btn') { this._save(); return; }
      if (bid === 'library-import-btn') { this._importFromText(); return; }
      if (bid === 'library-import-file-btn') {
        const input = this.root.querySelector('#library-import-file');
        if (input) input.click();
        return;
      }
    });

    const fileInput = this.root.querySelector('#library-import-file');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) this._importFromFile(file);
        e.target.value = '';
      });
    }

    const nameInput = this.root.querySelector('#library-name-input');
    if (nameInput) {
      nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); this._save(); }
      });
    }
  }

  /* ─── Actions ───────────────────────────────────────────────── */

  /**
   * Capture the host's current settings into a profile and save it.
   * @private
   */
  _save() {
    const name = coerceProfileName(this._nameInput ? this._nameInput.value : '');
    const profile = this._captureProfile(name);
    try {
      const saved = this.library.save(profile);
      this._selectedId = saved.id;
      this._setStatus(`Saved "${saved.name}".`);
      if (this._nameInput) this._nameInput.value = '';
      this._refresh();
    } catch (err) {
      this._setStatus(`Could not save: ${err.message}`, true);
    }
  }

  /**
   * Build a profile from the host's live settings + media model.
   *
   * The host is read through a narrow accessor (`opts.host`), never by
   * importing `app.js`: the host shim supplies `getSnapshot()`.
   *
   * @param {string} name
   * @returns {object} a StyleProfile
   * @private
   */
  _captureProfile(name) {
    const base = defaultProfile();
    const snapshot = this._host && typeof this._host.getSnapshot === 'function'
      ? this._host.getSnapshot()
      : { settings: {}, mediaModel: null, style: null };

    const settings = snapshot.settings || {};
    const g = { ...base.global };
    for (const key of GLOBAL_KEYS) {
      if (settings[key] !== undefined) g[key] = settings[key];
    }
    // The Brush panel splits the size range into two sliders; the profile
    // schema has one object.
    if (settings.strokeSizeMin !== undefined || settings.strokeSizeMax !== undefined) {
      g.strokeSize = {
        min: settings.strokeSizeMin ?? base.global.strokeSize.min,
        max: settings.strokeSizeMax ?? base.global.strokeSize.max,
        random: settings.strokeSize?.random ?? true,
      };
    }
    // The UI's `order` is the path-order selector; the profile field is
    // `pathOrder`. Map it explicitly rather than guessing.
    if (g.pathOrder === undefined && settings.order !== undefined) g.pathOrder = settings.order;

    return {
      ...base,
      name,
      global: g,
      mediaModel: snapshot.mediaModel || base.mediaModel,
      provenance: {
        ...base.provenance,
        source: 'human',
        notes: `Captured from the Brush panel (${settings.style || base.global.style})`,
      },
    };
  }

  /**
   * Apply a profile: expand it and hand it to the host.
   * @param {string} id
   * @private
   */
  _apply(id) {
    const result = this.library.apply(id);
    if (!result.ok) {
      this._setStatus(`Could not apply: ${result.errors[0]?.message || 'invalid profile'}`, true);
      return;
    }
    this._selectedId = id;
    this.root.dispatchEvent(new CustomEvent('style-profile-apply', { detail: result }));
    if (this._onApply) this._onApply(result);
    const s = result.profile.global;
    this._setStatus(`Applied "${result.profile.name}" — ${s.style || 'default style'}, seed ${result.seed ?? 'engine default'}.`);
    this._refresh();
  }

  /**
   * Export a profile: copy to clipboard, and fall back to a download.
   * @param {string} id
   * @private
   */
  async _export(id) {
    let text;
    try {
      text = this.library.exportText(id);
    } catch (err) {
      this._setStatus(`Could not export: ${err.message}`, true);
      return;
    }

    const name = this.library.get(id)?.profile.name || 'profile';
    const done = await copyText(text);
    if (done) {
      this._setStatus(`Copied "${name}" to the clipboard.`);
    } else {
      downloadText(text, `${slug(name)}.www-paint-profile.json`);
      this._setStatus(`Clipboard unavailable — downloaded "${name}".json instead.`);
    }
    this._showPreview(text);
  }

  /**
   * Delete a profile after an explicit confirmation.
   * @param {string} id
   * @private
   */
  _delete(id) {
    const entry = this.library.get(id);
    if (!entry) return;
    const ok = this._confirm(`Delete the profile "${entry.profile.name}"? This cannot be undone.`);
    if (!ok) {
      this._setStatus('Delete cancelled.');
      return;
    }
    this.library.delete(id);
    if (this._selectedId === id) this._selectedId = null;
    this._setStatus(`Deleted "${entry.profile.name}".`);
    this._refresh();
  }

  /**
   * Import from the paste field.
   * @private
   */
  _importFromText() {
    const area = this.root.querySelector('#library-import-input');
    const text = area ? area.value : '';
    if (!text.trim()) {
      this._setStatus('Paste a profile JSON first.', true);
      return;
    }
    try {
      const results = this.library.importText(text);
      const ok = results.filter((r) => r.ok).length;
      const bad = results.length - ok;
      this._setStatus(
        `Imported ${ok} profile(s)` + (bad ? `, skipped ${bad} invalid` : '') + '.',
        bad > 0,
      );
      if (ok) this._selectedId = results.find((r) => r.ok).id;
      this._refresh();
    } catch (err) {
      this._setStatus(`Could not import: ${err.message}`, true);
    }
  }

  /**
   * Import from a picked file.
   * @param {File} file
   * @private
   */
  async _importFromFile(file) {
    try {
      const text = await file.text();
      const results = this.library.importText(text);
      const ok = results.filter((r) => r.ok).length;
      this._setStatus(`Imported ${ok} profile(s) from ${file.name}.`, ok === 0);
      this._refresh();
    } catch (err) {
      this._setStatus(`Could not read ${file.name}: ${err.message}`, true);
    }
  }

  /**
   * Select a profile and show its JSON preview.
   * @param {string} id
   * @private
   */
  _select(id) {
    this._selectedId = id;
    this._refresh();
    try {
      this._showPreview(this.library.exportText(id));
    } catch {
      this._showPreview('');
    }
  }

  /* ─── Refresh / status ──────────────────────────────────────── */

  /**
   * Re-render the list and the storage note.
   * @private
   */
  _refresh() {
    if (this._listEl) {
      this._listEl.innerHTML = '';
      const rows = this.library.list();
      if (rows.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'library-placeholder';
        empty.textContent = 'No profiles saved yet.';
        this._listEl.appendChild(empty);
      } else {
        for (const row of rows) this._listEl.appendChild(this._renderRow(row));
      }
    }
    const note = this.root.querySelector('#library-storage-note');
    if (note) note.textContent = this._storageNote();
    if (!this._selectedId && this._previewEl) this._previewEl.textContent = '';
  }

  /**
   * @param {string} text
   * @param {boolean} [isError]
   * @private
   */
  _setStatus(text, isError = false) {
    if (!this._statusEl) return;
    this._statusEl.textContent = text;
    this._statusEl.classList.toggle('library-status--error', isError);
  }

  /**
   * @param {string} text
   * @private
   */
  _showPreview(text) {
    if (this._previewEl) this._previewEl.textContent = text;
  }

  /* ─── Public API ────────────────────────────────────────────── */

  /**
   * Set the host accessor.
   * @param {object} host
   */
  setHost(host) {
    this._host = host;
  }

  /**
   * The id of the selected profile, or null.
   * @returns {string|null}
   */
  get selectedId() {
    return this._selectedId;
  }

  /**
   * Re-read the list (e.g. after an external import).
   */
  refresh() {
    this._refresh();
  }

  /**
   * Destroy the panel.
   */
  destroy() {
    this.root.innerHTML = '';
  }
}

/* ─── Helpers ─────────────────────────────────────────────────── */

/**
 * Copy text to the clipboard, resolving false when it is unavailable
 * (non-secure context, denied permission, headless browser).
 * @param {string} text
 * @returns {Promise<boolean>}
 */
async function copyText(text) {
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand && document.execCommand('copy');
    document.body.removeChild(ta);
    return !!ok;
  } catch {
    return false;
  }
}

/**
 * Trigger a download of a text file.
 * @param {string} text
 * @param {string} filename
 */
function downloadText(text, filename) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Lowercase, dash-separated filename stem.
 * @param {string} name
 * @returns {string}
 */
function slug(name) {
  return (name || 'profile')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'profile';
}

/**
 * @returns {object|null} localStorage, or null
 */
function defaultStorage() {
  try {
    if (typeof globalThis.localStorage === 'object' && globalThis.localStorage) {
      return globalThis.localStorage;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * @param {string} message
 * @returns {boolean}
 */
function defaultConfirm(message) {
  try {
    return typeof globalThis.confirm === 'function' ? !!globalThis.confirm(message) : true;
  } catch {
    return false;
  }
}

export default StyleLibraryPanel;
