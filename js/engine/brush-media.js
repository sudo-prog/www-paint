/**
 * brush-media.js — shared media parameters for the wet/dry brush styles.
 *
 * Phase 1.6. Watercolor, ink, wash, sumi (and the dry media that share the
 * same stamp path — pastel, gouache, pen, knife) each carried their own
 * independently-named parameter set. This module is the single source of truth
 * for the media parameters they share, so a "bleed" or "grain" control means
 * the same thing across every style that supports it.
 *
 * The parameters map onto the vendored p5.brush runtime
 * (`js/vendor/brush.esm.js`) and its available brush tips:
 *
 *   pen, rotring, 2B, HB, 2H, cpencil, pastel, crayon, charcoal, spray, marker
 *
 * Design rule: every field here is optional and defaults to a value that
 * reproduces the style's previous behaviour, so adopting this module is
 * output-neutral until a caller opts in.
 *
 * @module brush-media
 */

/**
 * Media parameter schema. Each entry documents the p5.brush field it drives.
 *
 * `bleed` and `wetEdge` are the water/ink-specific additions from Phase 1.6:
 * they are not p5.brush parameters but control the custom halo pass applied
 * around a stamped stroke, so a wet wash spreads the same way regardless of
 * which brush tip produced the core mark.
 */
export const MEDIA_PARAMS = {
  /** Core mark width in px (maps to brush `size`). */
  size: { min: 1.5, max: 40, default: 10 },
  /** Stamp spacing as a fraction of width (maps to `spacing`). */
  spacing: { min: 0.03, max: 1.0, default: 0.15 },
  /** Sideways drift of stamps, 0..1 (maps to `scatter`). */
  scatter: { min: 0, max: 6, default: 0.4 },
  /** Stamp-shape sharpness (maps to `sharpness`). */
  sharpness: { min: 0, max: 1, default: 0.4 },
  /** Fraction of stamps skipped, 0..1 (maps to `grain`). */
  grain: { min: 0, max: 1, default: 0.25 },
  /** Pressure profile: { curve: [peakPos, tailLen], min_max: [lo, hi] }. */
  pressure: { default: { curve: [0.15, 0.2], min_max: [0.6, 1.05] } },
  /** Water/ink: how far pigment travels beyond the stroke edge, as a
   *  fraction of the stroke width. 0 = no bleed. */
  bleed: { min: 0, max: 0.6, default: 0 },
  /** Water/ink: opacity of the bleed halo, 0..1. */
  bleedOpacity: { min: 0, max: 1, default: 0.18 },
  /** Water/ink: tide-line darkening at the wash rim, 0..1. */
  tideDarken: { min: 0, max: 1, default: 0 },
  /** Water/ink: granulation speckle strength, 0..1. */
  granulation: { min: 0, max: 1, default: 0 },
  /** Water/ink: number of granulation speckles per area shape. */
  granulationCount: { min: 0, max: 400, default: 0 },
};

/**
 * Per-style media presets. Each entry names a p5.brush tip and a set of
 * overrides from MEDIA_PARAMS; unspecified fields fall back to the schema
 * defaults, which is what keeps adoption output-neutral.
 *
 * The tip names are the exact strings the vendored runtime registers.
 */
export const MEDIA_PRESETS = {
  /** Loaded round brush: swells mid-stroke, dry tail. */
  ink: {
    brushName: 'HB',
    size: { min: 4, max: 24, default: 12 },
    spacing: 0.12,
    scatter: 0.35,
    sharpness: 0.3,
    grain: 0.25,
    bleed: 0.12,
    bleedOpacity: 0.16,
    tideDarken: 0.3,
    granulation: 0.12,
    granulationCount: 90,
  },
  /** Broad translucent wash: wide, soft, low grain. */
  wash: {
    brushName: 'HB',
    size: { min: 8, max: 40, default: 20 },
    spacing: 0.08,
    scatter: 0.55,
    sharpness: 0.15,
    grain: 0.18,
    bleed: 0.2,
    bleedOpacity: 0.14,
    tideDarken: 0.22,
    granulation: 0.1,
    granulationCount: 60,
  },
  /** Sumi-e: expressive taper, moderate bleed. */
  sumi: {
    brushName: 'HB',
    size: { min: 5, max: 28, default: 14 },
    spacing: 0.1,
    scatter: 0.4,
    sharpness: 0.35,
    grain: 0.3,
    bleed: 0.08,
    bleedOpacity: 0.18,
    tideDarken: 0.2,
    granulation: 0.14,
    granulationCount: 70,
  },
  /** Watercolor: layered glazes, visible tide lines, granulation. */
  watercolor: {
    brushName: 'HB',
    size: { min: 3, max: 20, default: 10 },
    spacing: 0.09,
    scatter: 0.45,
    sharpness: 0.2,
    grain: 0.2,
    bleed: 0.18,
    bleedOpacity: 0.12,
    tideDarken: 0.32,
    granulation: 0.18,
    granulationCount: 120,
  },
  /** Dry pastel: powdery, high grain, wide scatter. */
  pastel: {
    brushName: 'pastel',
    size: { min: 5, max: 22, default: 12 },
    spacing: 0.085 / 3,
    scatter: 5,
    sharpness: 0.91,
    grain: 1,
    pressure: { curve: [0.4, 0.05], min_max: [1.09, 0.93] },
    bleed: 0,
    granulation: 0.15,
    granulationCount: 40,
  },
  /** Opaque gouache: flat, low scatter, slight edge darkening. */
  gouache: {
    brushName: 'marker',
    size: { min: 3, max: 20, default: 10 },
    spacing: 0.15,
    scatter: 0.2,
    sharpness: 0.6,
    grain: 0.1,
    bleed: 0,
    granulation: 0,
    granulationCount: 0,
  },
  /** Technical pen: fine, even, no bleed. */
  pen: {
    brushName: 'pen',
    size: { min: 1, max: 6, default: 3 },
    spacing: 0.1,
    scatter: 0.05,
    sharpness: 0.9,
    grain: 0.0,
    bleed: 0,
    granulation: 0,
    granulationCount: 0,
  },
  /** Palette knife: broad, ridged, near-opaque. */
  knife: {
    brushName: 'marker',
    size: { min: 6, max: 30, default: 16 },
    spacing: 0.2,
    scatter: 0.3,
    sharpness: 0.5,
    grain: 0.15,
    bleed: 0,
    granulation: 0,
    granulationCount: 0,
  },
  /** Charcoal: smudgy, high grain, wide scatter. */
  charcoal: {
    brushName: 'charcoal',
    size: { min: 3, max: 16, default: 8 },
    spacing: 0.03,
    scatter: 1.5,
    sharpness: 0.68,
    grain: 2,
    pressure: { curve: [0.15, 0.4], min_max: [1.1, 0.95] },
    bleed: 0,
    granulation: 0,
    granulationCount: 0,
  },
  /** Graphite pencil: firm middle, light ends. */
  pencil: {
    brushName: 'cpencil',
    size: { min: 4, max: 24, default: 12 },
    spacing: 0.1,
    scatter: 0.55,
    sharpness: 0.8,
    grain: 0.7,
    pressure: { curve: [0.15, 0.2], min_max: [0.95, 1.1] },
    bleed: 0,
    granulation: 0,
    granulationCount: 0,
  },
  /** Spray / aerosol: very wide scatter, no grain. */
  spray: {
    brushName: 'spray',
    size: { min: 6, max: 30, default: 14 },
    spacing: 0.5,
    scatter: 6,
    sharpness: 15,
    grain: 40,
    pressure: { curve: [0.2, 0.35], min_max: [0.7, 1] },
    bleed: 0,
    granulation: 0,
    granulationCount: 0,
  },
  /** Alcohol marker: chisel tip, even lay-down. */
  marker: {
    brushName: 'marker',
    size: { min: 4, max: 24, default: 12 },
    spacing: 0.03,
    scatter: 0.2,
    sharpness: 1,
    grain: 1,
    pressure: { curve: [0.35, 0.25], min_max: [1.2, 0.85] },
    bleed: 0,
    granulation: 0,
    granulationCount: 0,
  },
};

/**
 * Resolve a preset into a flat parameter object, filling any unspecified field
 * from the MEDIA_PARAMS schema default. This is what keeps adoption
 * output-neutral: a style that passes only `{ brushName: 'HB' }` gets the
 * schema defaults for everything else.
 *
 * @param {string|object} preset - preset name, or a partial override object.
 * @param {object} [overrides] - additional per-call overrides.
 * @returns {object} Flat media parameters.
 */
export function resolveMedia(preset, overrides = {}) {
  const base = typeof preset === 'string' ? (MEDIA_PRESETS[preset] || {}) : preset;
  const out = {};

  for (const [key, schema] of Object.entries(MEDIA_PARAMS)) {
    const presetVal = base[key];
    if (presetVal !== undefined) {
      out[key] = presetVal;
    } else if (schema.default !== undefined) {
      out[key] = schema.default;
    }
  }

  // Carry through any extra preset fields not in the schema (e.g. brushName).
  for (const [key, val] of Object.entries(base)) {
    if (!(key in out)) out[key] = val;
  }
  for (const [key, val] of Object.entries(overrides)) {
    if (val !== undefined) out[key] = val;
  }
  return out;
}

/**
 * Build the option object for `stampStrokeSync` from resolved media params.
 * Picks only the fields the stamp engine understands.
 *
 * @param {object} media - resolveMedia() output.
 * @param {object} [extra] - per-call extras (color, alpha, size, progress).
 * @returns {object}
 */
export function toStampOptions(media, extra = {}) {
  return {
    brushName: media.brushName || 'cpencil',
    scatter: media.scatter,
    spacing: media.spacing,
    grain: media.grain,
    sharpness: media.sharpness,
    pressure: media.pressure,
    size: extra.size,
    alpha: extra.alpha,
    progress: extra.progress,
    color: extra.color,
  };
}

/**
 * True when `brushName` is one of the tips the vendored runtime ships.
 * Use this before calling the stamp engine so a preset naming a
 * non-existent tip falls back instead of throwing inside the brush.
 *
 * @param {string} name
 * @returns {boolean}
 */
export function isKnownBrushName(name) {
  return availableBrushNames().includes(name);
}

/**
 * The brush tips the vendored runtime actually registers. Useful for UI and for
 * asserting a preset does not name a tip that does not exist.
 *
 * @returns {string[]}
 */
export function availableBrushNames() {
  return ['pen', 'rotring', '2B', 'HB', '2H', 'cpencil', 'pastel', 'crayon',
    'charcoal', 'spray', 'marker'];
}

export default {
  MEDIA_PARAMS,
  MEDIA_PRESETS,
  resolveMedia,
  toStampOptions,
  availableBrushNames,
};
