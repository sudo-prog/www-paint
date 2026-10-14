/**
 * Export Dialog — manages the export popup with PNG, JPG, HTML,
 * Save Project (JSON), and Load Project options.
 *
 * Nothing Design System modal pattern:
 * - Backdrop: rgba(0,0,0,0.8)
 * - Dialog: --surface + 1px solid --border-visible + 16px radius
 * - Space Mono ALL CAPS labels
 * - Pill buttons
 *
 * @module export
 */

/**
 * ExportManager — manages the export dialog UI.
 *
 * Nothing Design: modal dialog with --surface background, border separation,
 * Space Mono labels, pill buttons.
 *
 * @param {HTMLElement} root - Container element (typically a dialog or popover)
 */
export class ExportManager {
  /**
   * @param {HTMLElement} root
   */
  constructor(root) {
    if (!root) throw new Error('ExportManager requires a root element');

    /** @type {HTMLElement} */
    this.root = root;
    /** @type {object} */
    this.options = {
      width: 0,
      height: 0,
      format: 'png',
      quality: 0.92,
      background: '#ffffff',
    };

    this._render();
    this._bindEvents();
  }

  // ─── Rendering ───────────────────────────────────────────────

  /**
   * Build the export dialog DOM.
   */
  _render() {
    this.root.classList.add('export-dialog');
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-hidden', 'true');
    this.root.innerHTML = '';

    const overlay = document.createElement('div');
    overlay.className = 'export-dialog__overlay';
    overlay.setAttribute('role', 'presentation');

    const dialog = document.createElement('div');
    dialog.className = 'export-dialog__content';
    dialog.setAttribute('aria-labelledby', 'export-title');
    dialog.setAttribute('aria-modal', 'true');

    // Header
    const header = document.createElement('div');
    header.className = 'export-dialog__header';
    // Safe: uses static label strings, no user input
    header.innerHTML = `
      <h2 class="export-dialog__title" id="export-title">Export</h2>
      <button type="button" class="btn btn--icon btn--sm" data-action="close" aria-label="Close">
        <span class="btn-icon" aria-hidden="true">✕</span>
      </button>
    `;

    // Body
    const body = document.createElement('div');
    body.className = 'export-dialog__body';
    body.innerHTML = `
      <div class="export-form">
        <div class="export-form__row">
          <label class="form-label" for="export-width">Width</label>
          <input type="number" id="export-width" class="form-input" data-export="width" min="100" placeholder="Auto" />
        </div>
        <div class="export-form__row">
          <label class="form-label" for="export-height">Height</label>
          <input type="number" id="export-height" class="form-input" data-export="height" min="100" placeholder="Auto" />
        </div>
        <div class="export-form__row">
          <label class="form-label" for="export-format">Format</label>
          <select id="export-format" class="form-select" data-export="format">
            <option value="png">PNG</option>
            <option value="jpg">JPG</option>
          </select>
        </div>
        <div class="export-form__row">
          <label class="form-label" for="export-quality">Quality</label>
          <input type="range" id="export-quality" class="form-range" data-export="quality" min="0.1" max="1" step="0.05" value="0.92" />
          <span class="form-value" data-for="quality">92%</span>
        </div>
        <div class="export-form__row">
          <label class="form-label" for="export-background">Background</label>
          <input type="color" id="export-background" class="form-color" data-export="background" value="#ffffff" />
        </div>
      </div>

      <div class="export-actions">
        <button type="button" class="btn btn--primary" data-action="export-image">
          Export Image
        </button>
        <button type="button" class="btn btn--secondary" data-action="export-html">
          Export HTML
        </button>
        <button type="button" class="btn btn--secondary" data-action="save-project">
          Save Project
        </button>
      </div>

      <div class="export-divider">
        <span class="export-divider__text">or</span>
      </div>

      <div class="export-load">
        <button type="button" class="btn btn--secondary" data-action="load-project">
          Load Project
        </button>
        <input type="file" class="file-input" data-action="load-project-file"
               accept=".json,application/json" style="display: none;" aria-label="Load project file" />
      </div>
    `;

    dialog.appendChild(header);
    dialog.appendChild(body);
    overlay.appendChild(dialog);
    this.root.appendChild(overlay);
  }

  // ─── Event Binding ───────────────────────────────────────────

  /**
   * Bind event listeners.
   */
  _bindEvents() {
    // Close button
    const closeBtn = this.root.querySelector('[data-action="close"]');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hide());
    }

    // Overlay click to close
    const overlay = this.root.querySelector('.export-dialog__overlay');
    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) this.hide();
      });
    }

    // Escape key
    this._onKeyDown = (e) => {
      if (e.key === 'Escape') this.hide();
    };
    document.addEventListener('keydown', this._onKeyDown);

    // Format change — toggle quality row visibility
    const formatSelect = this.root.querySelector('[data-export="format"]');
    if (formatSelect) {
      formatSelect.addEventListener('change', (e) => {
        this.options.format = e.target.value;
        this._updateQualityDisplay();
      });
    }

    // Range input live-update
    this.root.addEventListener('input', (e) => {
      const input = e.target;
      const key = input.dataset.export;
      if (key) {
        // Update numeric/option value
        if (input.type === 'range') {
          const valueSpan = this.root.querySelector(`[data-for="${key}"]`);
          if (valueSpan) {
            if (key === 'quality') {
              valueSpan.textContent = `${Math.round(input.value * 100)}%`;
            } else {
              valueSpan.textContent = input.value;
            }
          }
        }
        this._collectOptions();
      }
    });

    // Number/color input changes
    this.root.addEventListener('change', (e) => {
      const input = e.target;
      const key = input.dataset.export;
      if (key) {
        this._collectOptions();
      }
    });

    // Action buttons
    const actions = {
      'export-image': () => this._emit('export-image', { ...this.options }),
      'export-html':   () => this._emit('export-html',   { ...this.options }),
      'save-project':   () => this._emit('save-project',  { ...this.options }),
      'load-project':   () => this._emit('load-project',  { ...this.options }),
    };

    for (const [action, handler] of Object.entries(actions)) {
      const btn = this.root.querySelector(`[data-action="${action}"]`);
      if (btn) btn.addEventListener('click', handler);
    }

    // Load project file input
    const fileInput = this.root.querySelector('[data-action="load-project-file"]');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file) this._emit('load-project-file', { file });
        e.target.value = ''; // reset so same file can be re-selected
      });
    }
  }

  // ─── Private Methods ─────────────────────────────────────────

  /**
   * Collect current values from the form into this.options.
   * @private
   */
  _collectOptions() {
    const widthInput = this.root.querySelector('[data-export="width"]');
    const heightInput = this.root.querySelector('[data-export="height"]');
    const formatSelect = this.root.querySelector('[data-export="format"]');
    const qualityInput = this.root.querySelector('[data-export="quality"]');
    const bgInput = this.root.querySelector('[data-export="background"]');

    this.options.width = widthInput && widthInput.value ? parseInt(widthInput.value, 10) : 0;
    this.options.height = heightInput && heightInput.value ? parseInt(heightInput.value, 10) : 0;
    this.options.format = formatSelect ? formatSelect.value : 'png';
    this.options.quality = qualityInput ? parseFloat(qualityInput.value) : 0.92;
    this.options.background = bgInput ? bgInput.value : '#ffffff';
  }

  /**
   * Update the quality display value.
   * @private
   */
  _updateQualityDisplay() {
    const qualitySpan = this.root.querySelector('[data-for="quality"]');
    const qualityInput = this.root.querySelector('[data-export="quality"]');
    if (qualitySpan && qualityInput) {
      qualitySpan.textContent = `${Math.round(qualityInput.value * 100)}%`;
    }
  }

  /**
   * Emit a custom event.
   * @param {string} type
   * @param {object} detail
   * @private
   */
  _emit(type, detail = {}) {
    this.root.dispatchEvent(new CustomEvent(type, { detail }));
  }

  // ─── Public API ──────────────────────────────────────────────

  /**
   * Show the export dialog.
   * @param {object} [opts] - Initial options to populate.
   */
  show(opts = {}) {
    // Populate initial values
    if (opts.width) this.root.querySelector('[data-export="width"]').value = opts.width;
    if (opts.height) this.root.querySelector('[data-export="height"]').value = opts.height;
    if (opts.format) this.root.querySelector('[data-export="format"]').value = opts.format;
    if (opts.quality) this.root.querySelector('[data-export="quality"]').value = opts.quality;
    if (opts.background) this.root.querySelector('[data-export="background"]').value = opts.background;

    this._collectOptions();
    this._updateQualityDisplay();

    // Show dialog immediately (aria-hidden false = accessible)
    this.root.setAttribute('aria-hidden', 'false');
    this.root.classList.add('export-dialog--open');

    // Focus the dialog
    const firstInput = this.root.querySelector('[data-export="width"]');
    if (firstInput) firstInput.focus();
  }

  /**
   * Hide the export dialog.
   */
  hide() {
    this.root.classList.remove('export-dialog--open');
    this.root.setAttribute('aria-hidden', 'true');
    this._collectOptions();
  }

  /**
   * Check if the dialog is open.
   * @returns {boolean}
   */
  isOpen() {
    return this.root.classList.contains('export-dialog--open');
  }

  /**
   * Set defaults for the current canvas dimensions.
   * @param {number} width
   * @param {number} height
   */
  setCanvasSize(width, height) {
    this.options.width = width;
    this.options.height = height;
    const w = this.root.querySelector('[data-export="width"]');
    const h = this.root.querySelector('[data-export="height"]');
    if (w) w.value = width;
    if (h) h.value = height;
  }

  /**
   * Destroy the export manager.
   */
  destroy() {
    document.removeEventListener('keydown', this._onKeyDown);
    this.root.innerHTML = '';
  }
}

export default ExportManager;
