/**
 * Shared style-name alias map.
 *
 * The Painter internally recognizes style tags: 'watercolour', 'hath', 'flat',
 'geo', and 'painterly'. However, our public registry uses different names:
 'watercolor', 'cross-hatch', and 'graphic'. These alias mappings translate
 registry names to the internal names expected by the Painter so that
 Painter-side shaping and style-specific drawing logic fires correctly.
 *
 * @module style-alias
 */

/**
 * Mapping from registry style names to Painter-internal style names.
 * @type {Record<string, string>}
 */
export const STYLE_ALIAS = {
  'watercolor': 'watercolour',
  'cross-hatch': 'hatch',
  'graphic': 'flat',
};

/**
 * Normalize a style name to its Painter-internal equivalent.
 *
 * @param {string} name - The registry style name.
 * @returns {string} The Painter-internal style name (identity if no alias).
 */
export function aliasStyle(name) {
  return STYLE_ALIAS[name] || name;
}
