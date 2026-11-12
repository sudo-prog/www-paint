/**
 * export-panel.js — Mac-owned export & share panel (Phase 6 / Track-S S7).
 *
 * One-click export surface: PNG / JPG at three sizes, the Style Profile JSON
 * (M10), and copy-to-clipboard. It WRAPS ThinkPad-owned code and never edits it:
 *
 *   js/engine/exporter.js   (via engine.exportPNG / engine.exportJPG)
 *   js/ui/export.js         (the older ExportManager — left untouched)
 *
 * All decisions live in `export-panel-core.js` (node-testable). This module
 * only renders, forwards intent, and shows the result. The host shim
 * (`export-host.js`) is the only consumer and owns the engine calls.
 *
 * Determinism: the panel never introduces randomness. Same (settings, seed,
 * image) → the same engine call → the same PNG bytes.
 *
 * @module export-panel
 */

import {
  EXPORT_SIZE_PRESETS,
  EXPORT_FORMATS,
  JPG_QUALITY_DEFAULT,
  MAX_EXPORT_DIMENSION,
  checkExportFeasible,
  defaultExportState,
  updateExportState,
  describeExport,
  describeBlob,
  buildShareText,
  exportFilename,
} from './export-panel-core.js';

/** Copy text to the clipboard, falling back to a download. */
async function copyText(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the download path */
  }
  return false;
}

/** Download a text string as a file. */
function downloadText(text, filename) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Slugify a profile name for a filename. */
function slug(name) {
  return String(name || 'profile')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'profile';
}

/**
 * ExportPanel — renders the export & share surface into a host container.
 *
 * The panel does NOT import the engine. The host shim supplies:
 *   - `getImageSize()`  → { width, height } of the current painting
 *   - `exportImage(req)` → Promise<Blob>  (engine.exportPNG / exportJPG)
 *   - `getProfileText()` → string | null   (the M10 library's profile JSON)
 *
 * @param {HTMLElement} root
 * @param {object} [opts]
 */
export class ExportPanel {
  constructor(root, opts = {}) {
    if (!root) throw new Error('ExportPanel requires a root element');
    this.root = root;
    this._host = opts.host || {};
    this._state = defaultExportState(this._imageSize());
    this._busy = false;
    this._lastBlob = null;
    this._lastReq = null;

    this._render();
    this._bind();
  }

  /* ── public ─────────────────────────────────────────────────── */

  /** The panel's current state (a copy). */
  get state() {
    return { ...this._state };
  }

  /**
   * Re-read the image size from the host and recompute the state.
   * Called after an image load and on mount.
   */
  refresh() {
    this._state = updateExportState(this._state, 'sizeId', this._state.sizeId, this._imageSize());
    this._renderSummary();
    this._setStatus('Ready to export.', false);
  }

  /**
   * Show the panel.
   */
  show() {
    this.root.classList.add('export-panel--open');
    this.root.setAttribute('aria-hidden', 'false');
    this.refresh();
    const first = this.root.querySelector('#export-panel-size');
    if (first) first.focus();
  }

  /**
   * Hide the panel.
   */
  hide() {
    this.root.classList.remove('export-panel--open');
    this.root.setAttribute('aria-hidden', 'true');
  }

  /**
   * Whether the panel is currently visible.
   */
  isOpen() {
    return this.root.classList.contains('export-panel--open');
  }

  /* ── internals ──────────────────────────────────────────────── */

  _imageSize() {
    const fn = this._host.getImageSize;
    if (typeof fn !== 'function') return { width: 0, height: 0 };
    try {
      const s = fn() || {};
      return { width: Number(s.width) || 0, height: Number(s.height) || 0 };
    } catch {
      return { width: 0, height: 0 };
    }
  }

  _render() {
    this.root.classList.add('export-panel');
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    this.root.setAttribute('aria-labelledby', 'export-panel-title');
    this.root.setAttribute('aria-hidden', 'true');
    this.root.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.className = 'export-panel__content';

    const header = document.createElement('div');
    header.className = 'export-panel__header';
    header.innerHTML = `
      <h2 class="export-panel__title" id="export-panel-title">Export &amp; share</h2>
      <button type="button" class="btn btn--icon btn--sm btn--ghost" id="export-panel-close"
              aria-label="Close export panel">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"
             stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    `;

    const body = document.createElement('div');
    body.className = 'export-panel__body';

    /* ── size preset ── */
    const sizeRow = document.createElement('div');
    sizeRow.className = 'export-panel__row';
    sizeRow.innerHTML = `<label class="form-label" for="export-panel-size">Size</label>`;
    const sizeSelect = document.createElement('select');
    sizeSelect.id = 'export-panel-size';
    sizeSelect.className = 'form-select';
    sizeSelect.setAttribute('aria-describedby', 'export-panel-summary');
    for (const p of EXPORT_SIZE_PRESETS) {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.label;
      sizeSelect.appendChild(opt);
    }
    sizeRow.appendChild(sizeSelect);

    /* ── format ── */
    const formatRow = document.createElement('div');
    formatRow.className = 'export-panel__row';
    formatRow.innerHTML = `<label class="form-label" for="export-panel-format">Format</label>`;
    const formatSelect = document.createElement('select');
    formatSelect.id = 'export-panel-format';
    formatSelect.className = 'form-select';
    for (const f of EXPORT_FORMATS) {
      const opt = document.createElement('option');
      opt.value = f.id;
      opt.textContent = f.label;
      formatSelect.appendChild(opt);
    }
    formatRow.appendChild(formatSelect);

    /* ── quality (JPG only) ── */
    const qualityRow = document.createElement('div');
    qualityRow.className = 'export-panel__row export-panel__row--quality';
    qualityRow.innerHTML = `
      <label class="form-label" for="export-panel-quality">Quality</label>
      <div class="export-panel__range-wrap">
        <input type="range" id="export-panel-quality" class="form-range"
               min="0.1" max="1" step="0.05" value="${JPG_QUALITY_DEFAULT}">
        <span class="form-value" id="export-panel-quality-value">92%</span>
      </div>
    `;

    /* ── summary ── */
    const summary = document.createElement('div');
    summary.className = 'export-panel__summary';
    summary.id = 'export-panel-summary';
    summary.setAttribute('role', 'status');
    summary.setAttribute('aria-live', 'polite');

    /* ── actions ── */
    const actions = document.createElement('div');
    actions.className = 'export-panel__actions';
    actions.innerHTML = `
      <button type="button" class="btn btn--primary" id="export-panel-download">
        Download image
      </button>
      <button type="button" class="btn btn--ghost" id="export-panel-copy-share">
        Copy share text
      </button>
    `;

    const profileActions = document.createElement('div');
    profileActions.className = 'export-panel__actions export-panel__actions--secondary';
    profileActions.innerHTML = `
      <button type="button" class="btn btn--ghost" id="export-panel-copy-profile">
        Copy profile JSON
      </button>
      <button type="button" class="btn btn--ghost" id="export-panel-download-profile">
        Download profile
      </button>
    `;

    const status = document.createElement('div');
    status.className = 'export-panel__status';
    status.id = 'export-panel-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');

    body.appendChild(sizeRow);
    body.appendChild(formatRow);
    body.appendChild(qualityRow);
    body.appendChild(summary);
    body.appendChild(actions);
    body.appendChild(profileActions);
    body.appendChild(status);

    wrap.appendChild(header);
    wrap.appendChild(body);
    this.root.appendChild(wrap);

    this._sizeSelect = sizeSelect;
    this._formatSelect = formatSelect;
    this._qualityRow = qualityRow;
    this._qualityInput = qualityRow.querySelector('#export-panel-quality');
    this._qualityValue = qualityRow.querySelector('#export-panel-quality-value');
    this._summaryEl = summary;
    this._statusEl = status;

    this._renderSummary();
  }

  _bind() {
    this.root.addEventListener('click', (e) => {
      const btn = e.target.closest('button[id^="export-panel-"]');
      if (!btn) return;
      const id = btn.id;
      if (id === 'export-panel-close') { this.hide(); return; }
      if (id === 'export-panel-download') { this._download(); return; }
      if (id === 'export-panel-copy-share') { this._copyShare(); return; }
      if (id === 'export-panel-copy-profile') { this._copyProfile(); return; }
      if (id === 'export-panel-download-profile') { this._downloadProfile(); return; }
    });

    // Escape closes — the panel is a modal dialog.
    this._onKey = (e) => {
      if (e.key === 'Escape' && this.isOpen()) this.hide();
    };
    document.addEventListener('keydown', this._onKey);

    this._sizeSelect.addEventListener('change', () => {
      this._state = updateExportState(this._state, 'sizeId', this._sizeSelect.value);
      this._renderSummary();
    });

    this._formatSelect.addEventListener('change', () => {
      this._state = updateExportState(this._state, 'format', this._formatSelect.value);
      this._renderSummary();
    });

    this._qualityInput.addEventListener('input', () => {
      const q = parseFloat(this._qualityInput.value);
      this._state = updateExportState(this._state, 'quality', q);
      this._qualityValue.textContent = `${Math.round(q * 100)}%`;
      this._renderSummary();
    });
  }

  _renderSummary() {
    const { ok, reason } = checkExportFeasible(this._state.width, this._state.height);
    const desc = describeExport(this._state);

    // The quality row is meaningless for PNG.
    this._qualityRow.classList.toggle('export-panel__row--disabled', this._state.format !== 'jpg');
    this._qualityInput.disabled = this._state.format !== 'jpg';

    if (!ok) {
      this._summaryEl.textContent = reason;
      this._summaryEl.classList.add('export-panel__summary--error');
      this._downloadBtn().disabled = true;
      return;
    }

    this._summaryEl.textContent = desc;
    this._summaryEl.classList.remove('export-panel__summary--error');
    this._downloadBtn().disabled = false;

    // Keep the preset in step with the image after a load.
    if (this._sizeSelect.value !== this._state.sizeId) {
      this._sizeSelect.value = this._state.sizeId;
    }
    if (this._formatSelect.value !== this._state.format) {
      this._formatSelect.value = this._state.format;
    }
  }

  _downloadBtn() {
    return this.root.querySelector('#export-panel-download');
  }

  _setStatus(text, isError) {
    this._statusEl.textContent = text;
    this._statusEl.classList.toggle('export-panel__status--error', !!isError);
  }

  async _download() {
    if (this._busy) return;
    const req = { ...this._state };
    const feasibility = checkExportFeasible(req.width, req.height);
    if (!feasibility.ok) {
      this._setStatus(feasibility.reason, true);
      return;
    }

    this._busy = true;
    this._setStatus('Exporting…', false);

    const fn = this._host.exportImage;
    if (typeof fn !== 'function') {
      this._busy = false;
      this._setStatus('Export is not available yet.', true);
      return;
    }

    let blob = null;
    try {
      blob = await fn({
        format: req.format,
        width: Math.round(req.width),
        height: Math.round(req.height),
        quality: this._state.format === 'jpg' ? this._state.quality : JPG_QUALITY_DEFAULT,
        background: this._state.background,
      });
    } catch (err) {
      this._busy = false;
      this._setStatus('Export failed: ' + (err && err.message ? err.message : String(err)), true);
      return;
    }

    this._busy = false;

    if (!blob || !blob.size) {
      this._setStatus('The export produced nothing.', true);
      return;
    }

    this._lastBlob = blob;
    this._lastReq = req;
    const info = describeBlob(blob, req);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = exportFilename(this._state);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);

    this._setStatus(
      `Saved ${exportFilename(this._state)} — ${info.label}.`,
      false,
    );
  }

  async _copyShare() {
    const info = this._lastBlob ? describeBlob(this._lastBlob, this._lastReq) : null;
    const text = buildShareText(this._state, info);
    const done = await copyText(text);
    this._setStatus(
      done
        ? 'Share text copied.'
        : 'Clipboard unavailable — nothing was copied.',
      !done,
    );
  }

  async _copyProfile() {
    const text = typeof this._host.getProfileText === 'function' ? this._host.getProfileText() : null;
    if (!text) {
      this._setStatus('Save a profile in the library first.', true);
      return;
    }
    const done = await copyText(text);
    this._setStatus(done ? 'Profile JSON copied.' : 'Clipboard unavailable.', !done);
  }

  _downloadProfile() {
    const text = typeof this._host.getProfileText === 'function' ? this._host.getProfileText() : null;
    if (!text) {
      this._setStatus('Save a profile in the library first.', true);
      return;
    }
    const name = this._host.getProfileName ? this._host.getProfileName() : 'profile';
    downloadText(text, `${slug(name)}.www-paint-profile.json`);
    this._setStatus(`Downloaded ${slug(name)}.www-paint-profile.json.`, false);
  }

  destroy() {
    document.removeEventListener('keydown', this._onKey);
    this.root.innerHTML = '';
  }
}

export default ExportPanel;
