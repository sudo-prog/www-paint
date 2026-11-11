/**
 * layer-styles.js — per-layer style resolution for multi-layer generation.
 *
 * Roadmap Phase 2.2 ("Layer-aware generation, scoring, paint order"): a single
 * generated image may paint each tonal band (background / shadows / outline /
 * midtone / highlights) with a *different* style, composited in layer order.
 *
 * How the renderer consumes styles: `Renderer.drawShapeAt` dispatches on
 * `shape.style` (`this._styles[shape.style]`). A layer's `style` field alone is
 * therefore inert — to change a layer's look the *strokes* must carry the new
 * style. This module provides the two pure operations that make that true, kept
 * free of DOM/canvas so they are node-testable (like `optimizer.js`):
 *
 *   resolveLayerStyles(input)        — normalise a caller's layer→style spec
 *   applyLayerStyles(shapes, spec)   — restamp each shape's `.style` by its band
 *   preserveLayerProps(fresh, prev)  — carry user layer props across a regenerate
 *
 * Defaults are no-ops: an absent/empty spec leaves every shape untouched, so
 * callers that do not opt in stay byte-identical to previous behaviour.
 *
 * @module layer-styles
 */

/** Canonical tonal band names, in paint order (matches `Engine.LAYER_NAMES`). */
export const TONAL_LAYER_NAMES = ['background', 'shadows', 'outline', 'midtone', 'highlights'];

/** Per-layer props the UI can tweak and that must survive a regenerate. */
export const LAYER_PROP_KEYS = ['visible', 'opacity', 'blendMode', 'style', 'locked'];

/**
 * Normalise a layer→style spec into a plain object, or `null` when it carries
 * no usable mapping (so callers can treat `null` as "nothing to do").
 *
 * Accepts:
 *   - `undefined` / `null` / `''`      → null
 *   - a single style string 'ink'      → every tonal band maps to 'ink'
 *   - a plain object { background: 'watercolor', midtone: 'ink' } → filtered
 *   - a Map<string,string>             → same as the object form
 *
 * @param {string|object|Map<string,string>|null|undefined} input
 * @returns {Record<string,string>|null}
 */
export function resolveLayerStyles(input) {
  if (!input) return null;
  if (typeof input === 'string') {
    const s = input.trim();
    if (!s) return null;
    const out = {};
    for (const name of TONAL_LAYER_NAMES) out[name] = s;
    return out;
  }
  const out = {};
  const entries = input instanceof Map ? input.entries() : Object.entries(input);
  for (const [key, value] of entries) {
    if (typeof value === 'string' && value.trim()) out[key] = value.trim();
  }
  return Object.keys(out).length ? out : null;
}

/**
 * The band key a shape belongs to. Multi-layer shapes carry `layerName`; single
 * layers fall back to their numeric `layer` index as a string.
 *
 * @param {object} shape
 * @returns {string|null}
 */
export function shapeLayerKey(shape) {
  if (!shape) return null;
  if (typeof shape.layerName === 'string' && shape.layerName) return shape.layerName;
  if (shape.layer !== undefined && shape.layer !== null) return String(shape.layer);
  return null;
}

/**
 * Restamp each shape's `.style` from the spec, keyed by its band. Mutates the
 * shapes in place and returns the same array (for chaining). A `null`/empty
 * spec, or a shape whose band has no mapping, is left untouched.
 *
 * @param {Array<object>} shapes
 * @param {string|object|Map<string,string>|null} spec
 * @returns {Array<object>} the same shapes array
 */
export function applyLayerStyles(shapes, spec) {
  const map = resolveLayerStyles(spec);
  if (!map || !Array.isArray(shapes)) return shapes;
  for (const shape of shapes) {
    const key = shapeLayerKey(shape);
    if (key && map[key]) shape.style = map[key];
  }
  return shapes;
}

/**
 * Carry user-set layer props from a previous layer list onto freshly rebuilt
 * layers, matched by `_name` (multi-layer) or `name`. Used so a regenerate does
 * not wipe visibility / opacity / blend / style the user set in the panel.
 *
 * @param {Array<object>} fresh   newly created layers (mutated in place)
 * @param {Array<object>} previous  the layer list being replaced
 * @returns {Array<object>} fresh
 */
export function preserveLayerProps(fresh, previous) {
  if (!Array.isArray(fresh) || !Array.isArray(previous)) return fresh;
  const byKey = new Map();
  for (const l of previous) {
    const key = l && (l._name || l.name);
    if (key != null) byKey.set(key, l);
  }
  for (const layer of fresh) {
    const key = layer && (layer._name || layer.name);
    const prev = key != null ? byKey.get(key) : undefined;
    if (!prev) continue;
    for (const prop of LAYER_PROP_KEYS) {
      if (prev[prop] !== undefined) layer[prop] = prev[prop];
    }
  }
  return fresh;
}

export default { resolveLayerStyles, applyLayerStyles, preserveLayerProps, shapeLayerKey, TONAL_LAYER_NAMES, LAYER_PROP_KEYS };
