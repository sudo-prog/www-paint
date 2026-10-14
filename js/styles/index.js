/**
 * index.js — Style registry for WWW_PAINT.
 *
 * Imports every painting-style module and exposes a unified registry.
 * The renderer queries the registry by style name to find the style class,
 * its defaults, and its generate/render methods.
 *
 * Each style module exports a class with:
 *   - name, category, description  (metadata)
 *   - defaults                    (default stroke parameters)
 *   - generate(analyzer, params)  (returns array of shape candidates)
 *   - render(ctx, shape, progress) (draws the stroke on a canvas context)
 *
 * Reference: RE_BREAKDOWN.md §4 (Style System), ARCHITECTURE.md §Style Definition Format
 */

import PencilStyle from './pencil.js';
import InkStyle from './ink.js';
import WatercolorStyle from './watercolor.js';
import OilStyle from './oil.js';
import GraffitiStyle from './graffiti.js';
import GraphicStyle from './graphic.js';

// ── Registry ─────────────────────────────────────────────────────────────────

const registry = {
  pencil:  { class: PencilStyle,  category: 'draw',    label: 'Pencil / Graphite' },
  ink:     { class: InkStyle,     category: 'paint',   label: 'Ink Brush' },
  watercolor: { class: WatercolorStyle, category: 'paint', label: 'Watercolor' },
  oil:     { class: OilStyle,     category: 'paint',   label: 'Oil / Acrylic' },
  graffiti: { class: GraffitiStyle, category: 'paint', label: 'Graffiti / Spray' },
  graphic: { class: GraphicStyle, category: 'graphic', label: 'Flat Graphic' }
};

// Ordered list for UI / iteration
let ordered = Object.keys(registry);

/**
 * Get a style instance by name.
 * @param {string} name - style key (e.g. 'pencil')
 * @returns {object|null} style instance, or null if not found
 */
export function getStyle(name) {
  const entry = registry[name];
  if (!entry) return null;
  return new entry.class();
}

/**
 * Get all registered style instances.
 * @returns {Array<{name:string, instance:object, category:string, label:string}>}
 */
export function getAllStyles() {
  return ordered.map(name => {
    const entry = registry[name];
    return { name, instance: new entry.class(), category: entry.category, label: entry.label };
  });
}

/**
 * Get styles filtered by category.
 * @param {string} category - e.g. 'draw', 'paint', 'graphic'
 * @returns {Array} matching style entries
 */
export function getStylesByCategory(category) {
  return getAllStyles().filter(s => s.category === category);
}

/**
 * Get the metadata for a style (without instantiating).
 * @param {string} name
 * @returns {{name:string, category:string, label:string, defaults:object}|null}
 */
export function getStyleInfo(name) {
  const entry = registry[name];
  if (!entry) return null;
  const instance = new entry.class();
  return { name, category: entry.category, label: entry.label, description: instance.description, defaults: instance.defaults };
}

/**
 * Register a custom style at runtime.
 * @param {string} name
 * @param {Function} styleClass - class with generate/render/defaults
 * @param {string} category
 * @param {string} label
 */
export function registerStyle(name, styleClass, category, label) {
  registry[name] = { class: styleClass, category, label };
  if (!ordered.includes(name)) ordered.push(name);
}

// Re-export all style classes for direct import
export { PencilStyle, InkStyle, WatercolorStyle, OilStyle, GraffitiStyle, GraphicStyle };

export default { getStyle, getAllStyles, getStylesByCategory, getStyleInfo, registerStyle };
