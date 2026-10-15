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
import CharcoalStyle from './charcoal.js';
import MarkerStyle from './marker.js';
import CalligraphyStyle from './calligraphy.js';
import CrossHatchStyle from './cross-hatch.js';
import MosaicStyle from './mosaic.js';
import ScribbleStyle from './scribble.js';
import HalftoneStyle from './halftone.js';
import StringStyle from './string.js';
import SumiStyle from './sumi.js';
import GouacheStyle from './gouache.js';
import KnifeStyle from './knife.js';
import PastelStyle from './pastel.js';
import PenStyle from './pen.js';
import WashStyle from './wash.js';
import DotsStyle from './dots.js';
import ConfettiStyle from './confetti.js';

// ── Registry ─────────────────────────────────────────────────────────────────

const registry = {
  pencil:       { class: PencilStyle,      category: 'draw',    label: 'Pencil / Graphite' },
  ink:          { class: InkStyle,         category: 'paint',   label: 'Ink Brush' },
  watercolor:   { class: WatercolorStyle,  category: 'paint',   label: 'Watercolor' },
  oil:          { class: OilStyle,         category: 'paint',   label: 'Oil / Acrylic' },
  graffiti:     { class: GraffitiStyle,    category: 'paint',   label: 'Graffiti / Spray' },
  graphic:      { class: GraphicStyle,     category: 'graphic', label: 'Flat Graphic' },
  charcoal:     { class: CharcoalStyle,    category: 'draw',    label: 'Charcoal' },
  marker:       { class: MarkerStyle,      category: 'draw',    label: 'Alcohol Marker' },
  calligraphy:  { class: CalligraphyStyle, category: 'draw',    label: 'Calligraphy' },
  'cross-hatch': { class: CrossHatchStyle, category: 'draw',    label: 'Cross-hatch' },
  mosaic:       { class: MosaicStyle,      category: 'graphic', label: 'Mosaic' },
  scribble:     { class: ScribbleStyle,    category: 'graphic', label: 'Scribble' },
  halftone:     { class: HalftoneStyle,    category: 'graphic', label: 'Halftone' },
  string:       { class: StringStyle,      category: 'craft',   label: 'String Art' },
  sumi:         { class: SumiStyle,        category: 'paint',   label: 'Sumi Ink' },
  gouache:      { class: GouacheStyle,     category: 'paint',   label: 'Gouache' },
  knife:        { class: KnifeStyle,       category: 'paint',   label: 'Palette Knife' },
  pastel:       { class: PastelStyle,      category: 'draw',    label: 'Pastel' },
  pen:          { class: PenStyle,         category: 'draw',    label: 'Pen' },
  wash:         { class: WashStyle,        category: 'paint',   label: 'Wash' },
  dots:         { class: DotsStyle,        category: 'graphic', label: 'Dots' },
  confetti:     { class: ConfettiStyle,    category: 'graphic', label: 'Confetti' }
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
export {
  PencilStyle, InkStyle, WatercolorStyle, OilStyle, GraffitiStyle, GraphicStyle,
  CharcoalStyle, MarkerStyle, CalligraphyStyle, CrossHatchStyle,
  MosaicStyle, ScribbleStyle, HalftoneStyle, StringStyle,
  SumiStyle, GouacheStyle, KnifeStyle, PastelStyle, PenStyle, WashStyle,
  DotsStyle, ConfettiStyle
};

export default { getStyle, getAllStyles, getStylesByCategory, getStyleInfo, registerStyle };
