/**
 * Per-style shaping data — Round 2 / M9.
 *
 * A data table so the optimiser can shape strokes per style (Track R4,
 * "per-style shaping"): how large a stroke the style wants, how elongated it
 * should be, what paint order it prefers, and how much flat region fill it can
 * carry.
 *
 * The table is **data only** — no functions, no DOM, no randomness — so it is
 * unit-testable under plain `node` and safe to call from a worker. Values are
 * derived from each style's own `defaults` (stroke size range, hatch spacing,
 * grain) where those exist, with a documented fallback for anything absent.
 *
 * Clean-room derivation of the classical **style-dependent stroke geometry**
 * step: a style is not just a colour/brush, it is a preferred stroke size,
 * aspect and lay-in order. No identifier, table or control flow is taken from
 * any implementation.
 *
 * @module shaping
 */

import { getAllStyles } from './index.js';

/** Documented fallback for a style with no entry (or an unknown name). */
export const SHAPING_DEFAULTS = {
  minSize: 3,
  maxSize: 14,
  elongation: 1.4,
  order: 'down',
  regionFill: 0,
};

/** Human-readable category names, used for reporting only. */
export const STYLE_CATEGORIES = {
  draw: 'Drawing',
  paint: 'Painting',
  graphic: 'Graphic',
  craft: 'Craft',
  '3d': '3D / Material',
};

/**
 * Per-style shaping table.
 *
 * Keys are style names. Values are the frozen shaping fields:
 * - `minSize` / `maxSize` — preferred stroke size range (px)
 * - `elongation` — preferred stroke aspect (>= 1)
 * - `order` — preferred paint order (one of the `order.js` modes)
 * - `regionFill` — how much flat region fill the style can carry, 0..1
 *
 * @type {Record<string, {minSize:number, maxSize:number, elongation:number, order:string, regionFill:number}>}
 */
export const SHAPING_TABLE = {
  // ── Drawing ─────────────────────────────────────────────────────
  pencil:      { minSize: 2,  maxSize: 10, elongation: 2.2, order: 'down',     regionFill: 0.10 },
  charcoal:    { minSize: 4,  maxSize: 22, elongation: 1.6, order: 'down',     regionFill: 0.20 },
  calligraphy: { minSize: 3,  maxSize: 18, elongation: 2.8, order: 'diag',     regionFill: 0.05 },
  'cross-hatch': { minSize: 2,  maxSize: 12, elongation: 1.8, order: 'down',     regionFill: 0.15 },
  scribble:    { minSize: 2,  maxSize: 10, elongation: 1.5, order: 'free',     regionFill: 0.10 },
  string:      { minSize: 2,  maxSize: 8,  elongation: 3.0, order: 'spiral',   regionFill: 0.05 },
  thread:      { minSize: 1,  maxSize: 6,  elongation: 3.2, order: 'spiral',   regionFill: 0.05 },
  stitch:      { minSize: 2,  maxSize: 8,  elongation: 2.0, order: 'down',     regionFill: 0.05 },
  embroid:     { minSize: 2,  maxSize: 10, elongation: 2.0, order: 'down',     regionFill: 0.05 },
  tape:        { minSize: 4,  maxSize: 16, elongation: 1.2, order: 'down',     regionFill: 0.15 },
  paper:       { minSize: 3,  maxSize: 14, elongation: 1.2, order: 'down',     regionFill: 0.10 },

  // ── Painting ────────────────────────────────────────────────────
  ink:         { minSize: 3,  maxSize: 16, elongation: 2.4, order: 'diag',     regionFill: 0.10 },
  watercolor:  { minSize: 4,  maxSize: 20, elongation: 1.3, order: 'down',     regionFill: 0.35 },
  oil:         { minSize: 5,  maxSize: 24, elongation: 1.5, order: 'down',     regionFill: 0.30 },
  marker:      { minSize: 4,  maxSize: 18, elongation: 1.3, order: 'down',     regionFill: 0.25 },
  sumi:        { minSize: 4,  maxSize: 20, elongation: 2.0, order: 'diag',     regionFill: 0.15 },
  gouache:     { minSize: 5,  maxSize: 22, elongation: 1.3, order: 'down',     regionFill: 0.35 },
  knife:       { minSize: 5,  maxSize: 24, elongation: 1.4, order: 'down',     regionFill: 0.30 },
  pastel:      { minSize: 4,  maxSize: 18, elongation: 1.4, order: 'down',     regionFill: 0.20 },
  pen:         { minSize: 2,  maxSize: 10, elongation: 2.4, order: 'diag',     regionFill: 0.05 },
  wash:        { minSize: 5,  maxSize: 22, elongation: 1.2, order: 'down',     regionFill: 0.40 },
  graffiti:    { minSize: 4,  maxSize: 20, elongation: 1.3, order: 'down',     regionFill: 0.30 },

  // ── Graphic ─────────────────────────────────────────────────────
  graphic:     { minSize: 4,  maxSize: 18, elongation: 1.1, order: 'down',     regionFill: 0.20 },
  halftone:    { minSize: 2,  maxSize: 12, elongation: 1.0, order: 'down',     regionFill: 0.15 },
  mosaic:      { minSize: 3,  maxSize: 14, elongation: 1.0, order: 'down',     regionFill: 0.20 },
  dots:        { minSize: 2,  maxSize: 10, elongation: 1.0, order: 'rings',    regionFill: 0.15 },
  riso:        { minSize: 3,  maxSize: 16, elongation: 1.1, order: 'down',     regionFill: 0.20 },
  linocut:     { minSize: 3,  maxSize: 14, elongation: 1.6, order: 'down',     regionFill: 0.15 },
  bokeh:       { minSize: 6,  maxSize: 28, elongation: 1.0, order: 'rings',    regionFill: 0.10 },
  neon:        { minSize: 2,  maxSize: 10, elongation: 1.8, order: 'diag',     regionFill: 0.05 },
  glitch:      { minSize: 2,  maxSize: 12, elongation: 1.2, order: 'down',     regionFill: 0.05 },
  confetti:    { minSize: 2,  maxSize: 10, elongation: 1.0, order: 'free',     regionFill: 0.05 },
  hylics:      { minSize: 3,  maxSize: 14, elongation: 1.1, order: 'down',     regionFill: 0.15 },

  // ── Craft ───────────────────────────────────────────────────────
  beads:       { minSize: 2,  maxSize: 8,  elongation: 1.0, order: 'rings',    regionFill: 0.10 },
  puffy:       { minSize: 4,  maxSize: 16, elongation: 1.1, order: 'down',     regionFill: 0.20 },
  terrazzo:    { minSize: 2,  maxSize: 10, elongation: 1.2, order: 'free',     regionFill: 0.10 },
  foam:        { minSize: 4,  maxSize: 18, elongation: 1.1, order: 'down',     regionFill: 0.20 },
  ceramic:     { minSize: 4,  maxSize: 16, elongation: 1.2, order: 'down',     regionFill: 0.20 },
  stone:       { minSize: 4,  maxSize: 18, elongation: 1.2, order: 'down',     regionFill: 0.20 },
  crystal:     { minSize: 3,  maxSize: 14, elongation: 1.4, order: 'diag',     regionFill: 0.15 },
  frost:       { minSize: 2,  maxSize: 10, elongation: 1.6, order: 'down',     regionFill: 0.10 },
  plast:       { minSize: 4,  maxSize: 16, elongation: 1.2, order: 'down',     regionFill: 0.20 },
  molten:      { minSize: 4,  maxSize: 18, elongation: 1.3, order: 'down',     regionFill: 0.25 },

  // ── 3D / Material ───────────────────────────────────────────────
  metal:       { minSize: 4,  maxSize: 16, elongation: 1.2, order: 'down',     regionFill: 0.20 },
  chrome:      { minSize: 4,  maxSize: 16, elongation: 1.2, order: 'down',     regionFill: 0.20 },
  glass:       { minSize: 3,  maxSize: 14, elongation: 1.3, order: 'diag',     regionFill: 0.15 },
  lens:        { minSize: 4,  maxSize: 18, elongation: 1.1, order: 'rings',    regionFill: 0.15 },
  gold:        { minSize: 4,  maxSize: 16, elongation: 1.2, order: 'down',     regionFill: 0.20 },
  bronze:      { minSize: 4,  maxSize: 16, elongation: 1.2, order: 'down',     regionFill: 0.20 },
  copper:      { minSize: 4,  maxSize: 16, elongation: 1.2, order: 'down',     regionFill: 0.20 },
  pewter:      { minSize: 4,  maxSize: 16, elongation: 1.2, order: 'down',     regionFill: 0.20 },
};

/**
 * Resolve the shaping data for a style.
 *
 * @param {string} styleName - A style name from the registry.
 * @returns {{minSize:number, maxSize:number, elongation:number, order:string, regionFill:number}}
 *   A **fresh copy** — mutating it never affects the table.
 */
export function resolveShaping(styleName) {
  const entry = SHAPING_TABLE[styleName];
  const src = entry || SHAPING_DEFAULTS;
  return {
    minSize: src.minSize,
    maxSize: src.maxSize,
    elongation: src.elongation,
    order: src.order,
    regionFill: src.regionFill,
  };
}

/**
 * Styles present in the registry but missing from the table.
 *
 * Useful as a completeness check: an empty array means every registered style
 * has shaping data.
 *
 * @returns {string[]}
 */
export function unshapedStyles() {
  return getAllStyles().map(s => s.name).filter(n => !(n in SHAPING_TABLE));
}

export default { resolveShaping, SHAPING_TABLE, SHAPING_DEFAULTS, STYLE_CATEGORIES, unshapedStyles };
