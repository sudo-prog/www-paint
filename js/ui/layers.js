/**
 * Layers Panel — manages the layer list UI with add/remove/reorder/
 * visibility/opacity/blend-mode controls.
 *
 * Nothing Design System patterns:
 * - Layer rows with 1px dividers (--border), no zebra striping
 * - Space Mono labels, ALL CAPS
 * - Active row: --surface-raised background + left border
 * - Pill buttons for actions
 *
 * Each layer in the engine is represented as:
 *   { id, name, visible, opacity, blendMode, strokes, locked }
 *
 * @module layers
 */

/** Blend mode options for the dropdown. */
const BLEND_MODES = [
  { value: 'normal',   label: 'Normal' },
  { value: 'multiply', label: 'Multiply' },
  { value: 'screen',   label: 'Screen' },
  { value: 'overlay',  label: 'Overlay' },
  { value: 'darken',   label: 'Darken' },
  { value: 'lighten',  label: 'Lighten' },
  { value: 'hard-light', label: 'Hard Light' },
  { value: 'difference', label: 'Difference' },
];

/**
 * LayersManager — manages the layer panel DOM and user interactions.
 *
 * Nothing Design: divider-separated list rows, Space Mono labels,
 * surface-raised highlight for active layer.
 *
 * @param {HTMLElement} root - Container element
 */
export class LayersManager {
  /**
   * @param {HTMLElement} root
   */
  constructor(root) {
    if (!root) throw new Error('LayersManager requires a root element');

    /** @type {HTMLElement} */
    this.root = root;
    /** @type {Array<object>} */
    this.layers = [];

    this._render();
    this._bindEvents();
  }

  // ─── Rendering ───────────────────────────────────────────────

  /**
   * Build the layers panel structure.
   */
  _render() {
    this.root.classList.add('layers-panel');
    this.root.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'layers-header';
    // Safe: uses fixed icon/label strings, no user input
    header.innerHTML = `
      <h3 class="layers-title">Layers</h3>
      <button type="button" class="btn btn--icon btn--sm" data-action="add-layer" aria-label="Add layer">
        <span class="btn-icon" aria-hidden="true">+</span>
      </button>
    `;

    const body = document.createElement('div');
    body.className = 'layers-body';
    body.id = 'layers-list';

    const footer = document.createElement('div');
    footer.className = 'layers-footer';

    this.root.appendChild(header);
    this.root.appendChild(body);
    this.root.appendChild(footer);
  }

  /**
   * Re-render the layer list from this.layers.
   */
  _renderLayers() {
    const list = this.root.querySelector('#layers-list');
    if (!list) return;

    list.innerHTML = '';

    // Render layers in reverse order (top = index 0 visually)
    const displayOrder = [...this.layers].reverse();

    for (const layer of displayOrder) {
      list.appendChild(this._renderLayerRow(layer));
    }

    // If no layers, show placeholder
    if (this.layers.length === 0) {
      const placeholder = document.createElement('div');
      placeholder.className = 'layers-placeholder';
      placeholder.textContent = 'no layers';
      list.appendChild(placeholder);
    }
  }

  /**
   * Render a single layer row.
   * Nothing Design: full-width divider, Space Mono labels, pill buttons.
   * @param {object} layer
   * @returns {HTMLElement}
   */
  _renderLayerRow(layer) {
    const row = document.createElement('div');
    row.className = 'layer-row';
    row.dataset.layerId = String(layer.id);
    row.setAttribute('role', 'group');
    row.setAttribute('aria-label', `Layer ${layer.name || layer.id}`);

    // Lock indicator
    const lockedHtml = layer.locked
      ? '<span class="layer-locked-overlay" aria-label="locked" title="Locked">🔒</span>'
      : '';

    // Safe: all content is from fixed arrays (BLEND_MODES, static labels), layer names escaped
    row.innerHTML = `
      <div class="layer-row__drag-handle" title="Drag to reorder" aria-hidden="true">⋮</div>
      <div class="layer-row__visibility">
        <button type="button" class="btn btn--icon btn--sm ${layer.visible ? 'btn--active' : ''}"
                data-action="toggle-visibility" aria-label="${layer.visible ? 'Hide' : 'Show'}">
          <span class="btn-icon">${layer.visible ? '👁' : '⊘'}</span>
        </button>
      </div>
      <div class="layer-row__name">
        <span class="layer-name">${this._escapeHtml(layer.name || `Layer ${layer.id}`)}</span>
        ${lockedHtml}
      </div>
      <div class="layer-row__opacity">
        <input type="range" class="layer-opacity-input" min="0" max="100" step="1"
               value="${Math.round((layer.opacity ?? 1) * 100)}" aria-label="Opacity" />
      </div>
      <div class="layer-row__blend">
        <select class="layer-blend-select" aria-label="Blend mode">
          ${BLEND_MODES.map(m =>
            `<option value="${m.value}" ${layer.blendMode === m.value ? 'selected' : ''}>${m.label}</option>`
          ).join('')}
        </select>
      </div>
      <div class="layer-row__actions">
        <button type="button" class="btn btn--icon btn--sm" data-action="duplicate-layer" aria-label="Duplicate layer">
          <span class="btn-icon">⍰</span>
        </button>
        <button type="button" class="btn btn--icon btn--sm btn--destructive" data-action="delete-layer" aria-label="Delete layer">
          <span class="btn-icon">🗑</span>
        </button>
      </div>
    `;

    return row;
  }

  /**
   * Escape HTML to prevent XSS when setting layer names.
   * @param {string} str
   * @returns {string}
   */
  _escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ─── Event Binding ───────────────────────────────────────────

  /**
   * Bind event listeners.
   */
  _bindEvents() {
    // Layer list clicks (event delegation)
    this.root.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      const row = btn.closest('.layer-row');
      const layerId = row ? parseInt(row.dataset.layerId, 10) : null;

      switch (action) {
        case 'toggle-visibility':
          this._emit('layer-toggle-visibility', { layerId });
          break;
        case 'duplicate-layer':
          if (layerId !== null) this._emit('layer-duplicate', { layerId });
          break;
        case 'delete-layer':
          if (layerId !== null) this._emit('layer-delete', { layerId });
          break;
      }
    });

    // Add layer button
    const addBtn = this.root.querySelector('[data-action="add-layer"]');
    if (addBtn) addBtn.addEventListener('click', () => this._emit('layer-add'));

    // Opacity changes
    this.root.addEventListener('input', (e) => {
      if (e.target.classList.contains('layer-opacity-input')) {
        const row = e.target.closest('.layer-row');
        const layerId = parseInt(row.dataset.layerId, 10);
        const opacity = parseInt(e.target.value, 10) / 100;
        this._emit('layer-opacity-change', { layerId, opacity });
      }
    });

    // Blend mode changes
    this.root.addEventListener('change', (e) => {
      if (e.target.classList.contains('layer-blend-select')) {
        const row = e.target.closest('.layer-row');
        const layerId = parseInt(row.dataset.layerId, 10);
        this._emit('layer-blend-change', { layerId, blendMode: e.target.value });
      }
    });
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

  // ─── Public API ─────────────────────────────────────────────

  /**
   * Update the layer list and re-render.
   * @param {Array<object>} layers
   */
  setLayers(layers) {
    this.layers = [...layers];
    this._renderLayers();
  }

  /**
   * Get the current layers data (re-read from DOM for live values).
   * @returns {Array<object>}
   */
  getLayers() {
    const result = [];
    const rows = this.root.querySelectorAll('.layer-row');
    for (const row of rows) {
      const layerId = parseInt(row.dataset.layerId, 10);
      const original = this.layers.find(l => l.id === layerId) || {};
      const opacityInput = row.querySelector('.layer-opacity-input');
      const blendSelect = row.querySelector('.layer-blend-select');
      const visibilityBtn = row.querySelector('[data-action="toggle-visibility"]');

      result.push({
        id: layerId,
        name: original.name || `Layer ${layerId}`,
        visible: visibilityBtn?.classList.contains('btn--active') ?? original.visible,
        opacity: opacityInput ? parseInt(opacityInput.value, 10) / 100 : (original.opacity ?? 1),
        blendMode: blendSelect ? blendSelect.value : (original.blendMode || 'normal'),
        strokes: original.strokes || [],
        locked: original.locked || false,
      });
    }
    return result.reverse();
  }

  /**
   * Get a layer by ID.
   * @param {number} id
   * @returns {object|undefined}
   */
  getLayer(id) {
    return this.layers.find(l => l.id === id);
  }

  /**
   * Highlight a layer as active/current.
   * @param {number|null} id
   */
  setActiveLayer(id) {
    this.root.querySelectorAll('.layer-row').forEach(row => {
      row.classList.toggle('layer-row--active', row.dataset.layerId === String(id));
    });
  }

  /**
   * Destroy the layers manager.
   */
  destroy() {
    this.root.innerHTML = '';
    this.layers = [];
  }
}

export { BLEND_MODES };
export default LayersManager;
