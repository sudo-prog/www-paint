/**
 * Layers Panel — manages the layer list UI with add/remove/reorder/
 * visibility/opacity/blend-mode controls.
 *
 * Warm Dark Creative Tool: uses CSS tokens from :root, DM Sans / DM Mono typography.
 *
 * @module layers
 */

/** Blend mode options for the dropdown. */
const BLEND_MODES = [
  { value: "normal",     label: "Normal" },
  { value: "multiply",   label: "Multiply" },
  { value: "screen",     label: "Screen" },
  { value: "overlay",    label: "Overlay" },
  { value: "darken",     label: "Darken" },
  { value: "lighten",    label: "Lighten" },
  { value: "hard-light", label: "Hard Light" },
  { value: "difference", label: "Difference" },
];

/**
 * LayersManager — manages the layer panel DOM and user interactions.
 *
 * @param {HTMLElement} root — container element
 */
export class LayersManager {
  constructor(root) {
    if (!root) throw new Error("LayersManager requires a root element");

    /** @type {HTMLElement} */
    this.root = root;
    /** @type {Array<object>} */
    this.layers = [];

    this._render();
    this._bindEvents();
  }

  /* ─── Rendering ─────────────────────────────────────────────── */

  /**
   * Build the layers panel structure.
   */
  _render() {
    this.root.classList.add("layers-panel");
    this.root.innerHTML = "";

    // Header
    const header = document.createElement("div");
    header.className = "layers-header";
    header.innerHTML = `
      <h3 class="layers-title">Layers</h3>
      <button type="button" class="btn btn--icon btn--sm" data-action="add-layer" aria-label="Add layer">
        <span aria-hidden="true">+</span>
      </button>
    `;

    // Body
    const body = document.createElement("div");
    body.className = "layers-body";
    body.id = "layers-list";

    this.root.appendChild(header);
    this.root.appendChild(body);
  }

  /**
   * Re-render the layer list from this.layers.
   */
  _renderLayers() {
    const list = this.root.querySelector("#layers-list");
    if (!list) return;

    list.innerHTML = "";

    // Render layers in reverse order (top layer first visually)
    const displayOrder = [...this.layers].reverse();

    if (displayOrder.length === 0) {
      const placeholder = document.createElement("div");
      placeholder.className = "layers-placeholder";
      placeholder.textContent = "No layers";
      list.appendChild(placeholder);
      return;
    }

    for (const layer of displayOrder) {
      list.appendChild(this._renderLayerRow(layer));
    }
  }

  /**
   * Render a single layer row.
   * @param {object} layer
   * @returns {HTMLElement}
   */
  _renderLayerRow(layer) {
    const row = document.createElement("div");
    row.className = "layer-row";
    row.dataset.layerId = layer.id;

    if (layer.visible === false) {
      row.style.opacity = "0.5";
    }

    // Active state
    const isActive = this.layers.findIndex((l) => l.id === layer.id) === this.layers.length - 1;
    if (isActive) row.classList.add("layer-row--active");

    row.innerHTML = `
      <div class="layer-row__drag" aria-hidden="true">≡</div>
      <div class="layer-row__controls">
        <button type="button" class="layer-visibility-btn" data-action="toggle-visibility"
                title="${layer.visible === false ? "Show" : "Hide"}">
          ${layer.visible === false ? "○" : "◉"}
        </button>
        <select class="layer-blend-select" data-action="blend-change">
          ${BLEND_MODES.map((m) =>
            `<option value="${m.value}" ${m.value === layer.blendMode ? "selected" : ""}>${m.label}</option>`
          ).join("")}
        </select>
      </div>
      <div class="layer-row__name" title="${layer.name || "Layer"}">${layer.name || "Layer"}</div>
      <div class="layer-opacity-row">
        <label class="layer-opacity-label">Op:</label>
        <input type="range" class="layer-opacity-input" min="0" max="1" step="0.05"
               value="${layer.opacity !== undefined ? layer.opacity : 1}"
               data-action="opacity-change"/>
        <span class="layer-opacity-value">${Math.round((layer.opacity || 1) * 100)}%</span>
      </div>
      <div class="layer-row__actions">
        <button type="button" class="layer-action-btn" data-action="duplicate-layer" title="Duplicate">
          <span aria-hidden="true">⋯</span>
        </button>
        <button type="button" class="layer-action-btn layer-action-btn--danger" data-action="delete-layer" title="Delete">
          <span aria-hidden="true">✕</span>
        </button>
      </div>
    `;

    return row;
  }

  /* ─── Events ────────────────────────────────────────────────── */

  /**
   * Bind event listeners.
   */
  _bindEvents() {
    // Delegate clicks within the layer list
    const list = this.root.querySelector("#layers-list");
    if (!list) return;

    list.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;

      const action = btn.dataset.action;
      const row = btn.closest(".layer-row");
      const layerId = row ? parseInt(row.dataset.layerId, 10) : null;

      switch (action) {
        case "toggle-visibility":
          this._emit("layer-toggle-visibility", { layerId });
          break;
        case "duplicate-layer":
          this._emit("layer-duplicate", { layerId });
          break;
        case "delete-layer":
          this._emit("layer-delete", { layerId });
          break;
      }
    });

    // Blend mode change
    list.addEventListener("change", (e) => {
      if (e.target.classList.contains("layer-blend-select") || e.target.dataset.action === "blend-change") {
        const row = e.target.closest(".layer-row");
        const layerId = parseInt(row.dataset.layerId, 10);
        this._emit("layer-blend-change", { layerId, blendMode: e.target.value });
      }
    });

    // Opacity change
    list.addEventListener("input", (e) => {
      if (e.target.classList.contains("layer-opacity-input")) {
        const row = e.target.closest(".layer-row");
        const layerId = parseInt(row.dataset.layerId, 10);
        const opacity = parseFloat(e.target.value);
        const valueSpan = row.querySelector(".layer-opacity-value");
        if (valueSpan) valueSpan.textContent = `${Math.round(opacity * 100)}%`;
        this._emit("layer-opacity-change", { layerId, opacity });
      }
    });

    // Add layer button
    const addBtn = this.root.querySelector('[data-action="add-layer"]');
    if (addBtn) {
      addBtn.addEventListener("click", () => {
        this._emit("layer-add");
      });
    }
  }

  /**
   * Emit a custom event on the root element.
   * @param {string} type
   * @param {object} detail
   * @private
   */
  _emit(type, detail = {}) {
    this.root.dispatchEvent(new CustomEvent(type, { detail }));
  }

  /* ─── Public API ────────────────────────────────────────────── */

  /**
   * Set the layers data and re-render.
   * @param {Array<object>} layers
   */
  setLayers(layers) {
    this.layers = layers || [];
    this._renderLayers();
  }

  /**
   * Update the active layer highlight.
   * @param {number} layerId
   */
  setActiveLayer(layerId) {
    this.root.querySelectorAll(".layer-row").forEach((row) => {
      const id = parseInt(row.dataset.layerId, 10);
      row.classList.toggle("layer-row--active", id === layerId);
    });
  }

  /**
   * Destroy the layers manager.
   */
  destroy() {
    this.root.innerHTML = "";
  }
}

export { BLEND_MODES };
export default LayersManager;
