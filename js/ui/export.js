/**
 * Export Dialog — manages the export popup with PNG, JPG, HTML,
 * Save Project (JSON), and Load Project options.
 *
 * Warm Dark Creative Tool: uses CSS tokens from :root for modal theming.
 *
 * @module export
 */

/**
 * ExportManager — manages the export dialog UI.
 *
 * @param {HTMLElement} root — container element (typically a modal)
 */
export class ExportManager {
  constructor(root) {
    if (!root) throw new Error("ExportManager requires a root element");

    /** @type {HTMLElement} */
    this.root = root;
    /** @type {object} */
    this.options = {
      width: 0,
      height: 0,
      format: "png",
      quality: 0.92,
      background: "#ffffff",
    };

    this._render();
    this._bindEvents();
  }

  /* ─── Rendering ─────────────────────────────────────────────── */

  /**
   * Build the export dialog DOM.
   */
  _render() {
    this.root.classList.add("export-dialog");
    this.root.setAttribute("role", "dialog");
    this.root.setAttribute("aria-hidden", "true");
    this.root.innerHTML = "";

    const overlay = document.createElement("div");
    overlay.className = "export-dialog__overlay";
    overlay.setAttribute("role", "presentation");

    const dialog = document.createElement("div");
    dialog.className = "export-dialog__content";
    dialog.setAttribute("aria-labelledby", "export-title");
    dialog.setAttribute("aria-modal", "true");

    // Header
    const header = document.createElement("div");
    header.className = "modal__header";
    header.innerHTML = `
      <h2 class="modal__title" id="export-title">Export</h2>
      <button type="button" class="btn btn--icon btn--sm btn--ghost" data-action="close" aria-label="Close">
        <span aria-hidden="true">✕</span>
      </button>
    `;

    // Body
    const body = document.createElement("div");
    body.className = "modal__body";
    body.innerHTML = `
      <div class="export-form">
        <div class="form-row">
          <label class="form-label" for="export-width">Width</label>
          <input type="number" id="export-width" class="form-input" data-export="width" min="100" placeholder="Auto"/>
        </div>
        <div class="form-row">
          <label class="form-label" for="export-height">Height</label>
          <input type="number" id="export-height" class="form-input" data-export="height" min="100" placeholder="Auto"/>
        </div>
        <div class="form-row">
          <label class="form-label" for="export-format">Format</label>
          <select id="export-format" class="form-select" data-export="format">
            <option value="png">PNG</option>
            <option value="jpg">JPG</option>
          </select>
        </div>
        <div class="form-row">
          <label class="form-label" for="export-quality">Quality</label>
          <input type="range" id="export-quality" class="form-range" data-export="quality" min="0.1" max="1" step="0.05" value="0.92"/>
          <span class="form-value" data-for="quality">92%</span>
        </div>
        <div class="form-row">
          <label class="form-label" for="export-background">Background</label>
          <input type="color" id="export-background" class="form-color" data-export="background" value="#ffffff"/>
        </div>
      </div>

      <div class="form-actions">
        <button type="button" class="btn btn--primary" data-action="export-image">
          Export Image
        </button>
        <button type="button" class="btn btn--ghost" data-action="export-html">
          Export HTML
        </button>
        <button type="button" class="btn btn--ghost" data-action="save-project">
          Save Project
        </button>
      </div>

      <div class="form-actions">
        <button type="button" class="btn btn--ghost" data-action="load-project">
          Load Project
        </button>
        <input type="file" class="file-input" data-action="load-project-file"
               accept=".json,application/json" style="display: none;" aria-label="Load project file"/>
      </div>
    `;

    const footer = document.createElement("div");
    footer.className = "modal__footer";
    footer.innerHTML = `
      <button type="button" class="btn btn--sm btn--ghost" data-action="close">
        Cancel
      </button>
    `;

    dialog.appendChild(header);
    dialog.appendChild(body);
    dialog.appendChild(footer);
    overlay.appendChild(dialog);
    this.root.appendChild(overlay);
  }

  /* ─── Event Binding ─────────────────────────────────────────── */

  /**
   * Bind event listeners.
   */
  _bindEvents() {
    // Close button
    this.root.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      const action = btn.dataset.action;
      if (action === "close") this.hide();
    });

    // Overlay click to close
    const overlay = this.root.querySelector(".export-dialog__overlay");
    if (overlay) {
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) this.hide();
      });
    }

    // Escape key
    this._onKeyDown = (e) => {
      if (e.key === "Escape") this.hide();
    };
    document.addEventListener("keydown", this._onKeyDown);

    // Format change — toggle quality row
    const formatSelect = this.root.querySelector('[data-export="format"]');
    if (formatSelect) {
      formatSelect.addEventListener("change", (e) => {
        this.options.format = e.target.value;
        this._updateQualityDisplay();
      });
    }

    // Range input live-update
    this.root.addEventListener("input", (e) => {
      const input = e.target;
      const key = input.dataset.export;
      if (key) {
        const valueSpan = this.root.querySelector(`[data-for="${key}"]`);
        if (valueSpan) {
          if (key === "quality") {
            valueSpan.textContent = `${Math.round(input.value * 100)}%`;
          } else {
            valueSpan.textContent = input.value;
          }
        }
        this._collectOptions();
      }
    });

    // Number/color input changes
    this.root.addEventListener("change", (e) => {
      const input = e.target;
      const key = input.dataset.export;
      if (key) this._collectOptions();
    });

    // Action buttons
    const actions = {
      "export-image":  () => this._emit("export-image", { ...this.options }),
      "export-html":    () => this._emit("export-html",   { ...this.options }),
      "save-project":   () => this._emit("save-project",  { ...this.options }),
      "load-project":   () => this._emit("load-project",  { ...this.options }),
    };

    for (const [action, handler] of Object.entries(actions)) {
      const btn = this.root.querySelector(`[data-action="${action}"]`);
      if (btn) btn.addEventListener("click", handler);
    }

    // Load project file input
    const fileInput = this.root.querySelector('[data-action="load-project-file"]');
    if (fileInput) {
      fileInput.addEventListener("change", (e) => {
        const file = e.target.files?.[0];
        if (file) this._emit("load-project-file", { file });
        e.target.value = "";
      });
    }
  }

  /* ─── Private Methods ───────────────────────────────────────── */

  /**
   * Collect current values from the form into this.options.
   * @private
   */
  _collectOptions() {
    const w = this.root.querySelector('[data-export="width"]');
    const h = this.root.querySelector('[data-export="height"]');
    const fmt = this.root.querySelector('[data-export="format"]');
    const q = this.root.querySelector('[data-export="quality"]');
    const bg = this.root.querySelector('[data-export="background"]');

    this.options.width = w && w.value ? parseInt(w.value, 10) : 0;
    this.options.height = h && h.value ? parseInt(h.value, 10) : 0;
    this.options.format = fmt ? fmt.value : "png";
    this.options.quality = q ? parseFloat(q.value) : 0.92;
    this.options.background = bg ? bg.value : "#ffffff";
  }

  /**
   * Update the quality display value.
   * @private
   */
  _updateQualityDisplay() {
    const span = this.root.querySelector('[data-for="quality"]');
    const input = this.root.querySelector('[data-export="quality"]');
    if (span && input) {
      span.textContent = `${Math.round(input.value * 100)}%`;
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

  /* ─── Public API ────────────────────────────────────────────── */

  /**
   * Show the export dialog.
   * @param {object} [opts] — initial options to populate.
   */
  show(opts = {}) {
    const w = this.root.querySelector('[data-export="width"]');
    const h = this.root.querySelector('[data-export="height"]');
    const fmt = this.root.querySelector('[data-export="format"]');
    const q = this.root.querySelector('[data-export="quality"]');
    const bg = this.root.querySelector('[data-export="background"]');

    if (opts.width && w) w.value = opts.width;
    if (opts.height && h) h.value = opts.height;
    if (opts.format && fmt) fmt.value = opts.format;
    if (opts.quality && q) q.value = opts.quality;
    if (opts.background && bg) bg.value = opts.background;

    this._collectOptions();
    this._updateQualityDisplay();

    this.root.classList.add("modal--open");
    this.root.setAttribute("aria-hidden", "false");

    const firstInput = this.root.querySelector('[data-export="width"]');
    if (firstInput) firstInput.focus();
  }

  /**
   * Hide the export dialog.
   */
  hide() {
    this.root.classList.remove("modal--open");
    this.root.setAttribute("aria-hidden", "true");
    this._collectOptions();
  }

  /**
   * Check if the dialog is open.
   * @returns {boolean}
   */
  isOpen() {
    return this.root.classList.contains("modal--open");
  }

  /**
   * Destroy the export manager.
   */
  destroy() {
    document.removeEventListener("keydown", this._onKeyDown);
    this.root.innerHTML = "";
  }
}

export default ExportManager;
