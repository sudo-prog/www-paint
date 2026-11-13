/**
 * Style Profile — engine consumer (Phase 4.1).
 *
 * The Style Profile (`docs/STYLE_PROFILE.md`, frozen schema v1) is the single
 * portable object in WWW_PAINT: it fully describes *how* a source image becomes
 * a painting. This module is the **engine-side reader**: it validates a profile,
 * normalises it against the schema defaults, and maps it onto the engine's own
 * surfaces (generator settings, per-layer styles, layer panel props, the media
 * model and the master seed).
 *
 * It is pure — no DOM, no canvas, no randomness — so it is deterministic and
 * unit-testable under plain `node`, and safe to call from a worker.
 *
 * The validator is a **compact, dependency-free subset of draft-07** covering
 * exactly the constraints the frozen v1 schema states (required keys, types,
 * enums, numeric ranges, hex-colour patterns). The plan (schema §5) is to swap
 * it for vendored LAYERS AJV schemas once the repos share a workspace; the
 * `validateProfile` signature is designed to survive that swap unchanged.
 *
 * @module profile
 */

/// The schema version this reader understands.
export const PROFILE_SCHEMA_VERSION = 1;

/// Tonal roles, fixed to the engine's named layers.
export const PROFILE_ROLES = ['background', 'shadows', 'outline', 'midtone', 'highlights'];

const BLEND_MODES = ['normal', 'multiply', 'screen', 'overlay', 'soft-light', 'hard-light',
  'color-dodge', 'color-burn', 'darken', 'lighten', 'difference', 'exclusion',
  'hue', 'saturation', 'color', 'luminosity'];

const PATH_ORDERS = ['free', 'down', 'up', 'right', 'left', 'diag', 'spiral', 'spiralin',
  'rings', 'ringsin', 'clock', 'top-bottom', 'edges-first', 'one-line'];

const COLOR_MODES = ['exact', 'quantized', 'palette'];
const OUTLINE_MODES = ['off', 'on', 'edges'];
const RFILL_MODES = ['off', 'on'];
const MEDIA_KINDS = ['dry', 'wet', 'impasto'];
const PROVENANCE_SOURCES = ['ai', 'human', 'hybrid', 'preset', 'import'];

/// Field defaults applied by `normalizeProfile` (mirrors the schema `default`s).
export const PROFILE_DEFAULTS = {
  strokeSize: { min: 3, max: 18, random: true },
  sizeK: 1,
  detailLevel: 0.7,
  styleStrength: 0.8,
  opacity: 0.9,
  randomness: 0.3,
  pathOrder: 'free',
  colorMode: 'exact',
  palette: null,
  abstract: false,
  outline: 'off',
  rfill: 'off',
  oneLine: false,
  smart: false,
  multiLayer: false,
  mediaModel: { kind: 'dry', wetness: 0, drying: 0, bleed: 0, granulation: 0, height: 0, bristle: 0, paper: null },
};

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isInt = (v) => Number.isInteger(v);
const isStr = (v) => typeof v === 'string';
const isHex = (v) => isStr(v) && /^#[0-9a-fA-F]{6}$/.test(v);

/**
 * Validate a Style Profile against the frozen v1 constraints.
 *
 * Dependency-free. Returns every problem it finds rather than throwing, so a
 * caller can surface all of them at once.
 *
 * @param {*} profile
 * @returns {{ok: boolean, errors: Array<{path: string, message: string}>}}
 */
export function validateProfile(profile) {
  const errors = [];
  const err = (path, message) => errors.push({ path, message });

  if (!isObj(profile)) { err('', 'profile must be an object'); return { ok: false, errors }; }

  // required top-level keys
  for (const k of ['schemaVersion', 'id', 'name', 'version', 'global']) {
    if (profile[k] === undefined) err(k, `missing required field '${k}'`);
  }
  if (profile.schemaVersion !== undefined && profile.schemaVersion !== PROFILE_SCHEMA_VERSION) {
    err('schemaVersion', `expected ${PROFILE_SCHEMA_VERSION}, got ${JSON.stringify(profile.schemaVersion)}`);
  }
  if (profile.id !== undefined && !isStr(profile.id)) err('id', 'must be a string');
  if (profile.name !== undefined && (!isStr(profile.name) || profile.name.length < 1)) {
    err('name', 'must be a non-empty string');
  }
  if (profile.version !== undefined && !(isStr(profile.version) && /^\d+\.\d+\.\d+$/.test(profile.version))) {
    err('version', 'must be semver (x.y.z)');
  }
  if (profile.engine !== undefined) {
    if (!isObj(profile.engine) || !isStr(profile.engine.name) || !isStr(profile.engine.version)) {
      err('engine', 'must be { name, version }');
    }
  }

  // global
  const g = profile.global;
  if (g !== undefined) {
    if (!isObj(g)) err('global', 'must be an object');
    else validateGlobal(g, err);
  }

  // layers[]
  if (profile.layers !== undefined) {
    if (!Array.isArray(profile.layers)) err('layers', 'must be an array');
    else profile.layers.forEach((l, i) => validateLayer(l, `layers[${i}]`, err));
  }

  // effects[]
  if (profile.effects !== undefined) {
    if (!Array.isArray(profile.effects)) err('effects', 'must be an array');
    else profile.effects.forEach((e, i) => validateEffect(e, `effects[${i}]`, err));
  }

  // mediaModel
  if (profile.mediaModel !== undefined) validateMediaModel(profile.mediaModel, 'mediaModel', err);

  // provenance
  if (profile.provenance !== undefined) {
    const p = profile.provenance;
    if (!isObj(p) || !PROVENANCE_SOURCES.includes(p.source)) {
      err('provenance.source', `must be one of ${PROVENANCE_SOURCES.join('|')}`);
    } else if (p.refPacket !== undefined && p.refPacket !== null) {
      // S3 fused reference (Track S) — optional. When present it must be the
      // shape `ref-analyze.fuseReferences` emits, so `refPacketDistance` (S2)
      // can score a render against it directly.
      const fp = p.refPacket;
      if (!isObj(fp) || !Array.isArray(fp.scaleHistogram) || !isObj(fp.orientationField)) {
        err('provenance.refPacket', 'must be a fused RefPacket ({ scaleHistogram[], orientationField{} })');
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

function validateGlobal(g, err) {
  const num = (key, min, max) => {
    if (g[key] === undefined) return;
    if (!isNum(g[key])) err(`global.${key}`, 'must be a number');
    else if (g[key] < min || g[key] > max) err(`global.${key}`, `must be in [${min}, ${max}]`);
  };
  if (g.style !== undefined && !isStr(g.style)) err('global.style', 'must be a string');
  if (g.strokeCount !== undefined && !(isInt(g.strokeCount) && g.strokeCount >= 1 && g.strokeCount <= 200000)) {
    err('global.strokeCount', 'must be an integer in [1, 200000]');
  }
  if (g.strokeSize !== undefined) {
    if (!isObj(g.strokeSize)) err('global.strokeSize', 'must be an object');
    else {
      for (const k of ['min', 'max']) {
        if (g.strokeSize[k] !== undefined && !(isNum(g.strokeSize[k]) && g.strokeSize[k] >= 0)) {
          err(`global.strokeSize.${k}`, 'must be a number >= 0');
        }
      }
    }
  }
  if (g.sizeK !== undefined && !(isNum(g.sizeK) && g.sizeK >= 0.1)) err('global.sizeK', 'must be >= 0.1');
  num('detailLevel', 0, 1);
  num('styleStrength', 0, 1);
  num('opacity', 0, 1);
  num('randomness', 0, 1);
  if (g.pathOrder !== undefined && !PATH_ORDERS.includes(g.pathOrder)) {
    err('global.pathOrder', `must be one of ${PATH_ORDERS.join('|')}`);
  }
  if (g.colorMode !== undefined && !COLOR_MODES.includes(g.colorMode)) {
    err('global.colorMode', `must be one of ${COLOR_MODES.join('|')}`);
  }
  if (g.palette !== undefined && g.palette !== null) {
    if (!Array.isArray(g.palette) || !g.palette.every(isHex)) {
      err('global.palette', 'must be an array of #rrggbb strings or null');
    }
  }
  if (g.outline !== undefined && !OUTLINE_MODES.includes(g.outline)) {
    err('global.outline', `must be one of ${OUTLINE_MODES.join('|')}`);
  }
  if (g.rfill !== undefined && !RFILL_MODES.includes(g.rfill)) {
    err('global.rfill', `must be one of ${RFILL_MODES.join('|')}`);
  }
  for (const k of ['abstract', 'oneLine', 'smart', 'multiLayer']) {
    if (g[k] !== undefined && typeof g[k] !== 'boolean') err(`global.${k}`, 'must be a boolean');
  }
  if (g.seed !== undefined && !(isInt(g.seed) && g.seed >= 0)) err('global.seed', 'must be a non-negative integer');
}

function validateLayer(l, path, err) {
  if (!isObj(l)) { err(path, 'must be an object'); return; }
  if (!PROFILE_ROLES.includes(l.role)) {
    err(`${path}.role`, `must be one of ${PROFILE_ROLES.join('|')}`);
  }
  if (l.style !== undefined && !isStr(l.style)) err(`${path}.style`, 'must be a string');
  if (l.enabled !== undefined && typeof l.enabled !== 'boolean') err(`${path}.enabled`, 'must be a boolean');
  if (l.opacity !== undefined && !(isNum(l.opacity) && l.opacity >= 0 && l.opacity <= 1)) {
    err(`${path}.opacity`, 'must be in [0, 1]');
  }
  if (l.blendMode !== undefined && !BLEND_MODES.includes(l.blendMode)) {
    err(`${path}.blendMode`, `must be one of ${BLEND_MODES.join('|')}`);
  }
  if (l.order !== undefined && !(isInt(l.order) && l.order >= 0)) err(`${path}.order`, 'must be an integer >= 0');
}

function validateEffect(e, path, err) {
  if (!isObj(e)) { err(path, 'must be an object'); return; }
  for (const k of ['core', 'params', 'opacity', 'blend', 'enabled']) {
    if (e[k] === undefined) err(`${path}.${k}`, `missing required field '${k}'`);
  }
  if (e.core !== undefined && !isStr(e.core)) err(`${path}.core`, 'must be a string');
  if (e.params !== undefined && !isObj(e.params)) err(`${path}.params`, 'must be an object');
  if (e.opacity !== undefined && !(isNum(e.opacity) && e.opacity >= 0 && e.opacity <= 1)) {
    err(`${path}.opacity`, 'must be in [0, 1]');
  }
  if (e.blend !== undefined && !BLEND_MODES.includes(e.blend)) err(`${path}.blend`, 'unknown blend mode');
  if (e.enabled !== undefined && typeof e.enabled !== 'boolean') err(`${path}.enabled`, 'must be a boolean');
}

function validateMediaModel(m, path, err) {
  if (!isObj(m)) { err(path, 'must be an object'); return; }
  if (!MEDIA_KINDS.includes(m.kind)) err(`${path}.kind`, `must be one of ${MEDIA_KINDS.join('|')}`);
  for (const k of ['wetness', 'drying', 'bleed', 'granulation', 'height', 'bristle']) {
    if (m[k] !== undefined && !(isNum(m[k]) && m[k] >= 0 && m[k] <= 1)) {
      err(`${path}.${k}`, 'must be in [0, 1]');
    }
  }
  if (m.paper !== undefined && m.paper !== null && !isStr(m.paper)) err(`${path}.paper`, 'must be a string or null');
}

/**
 * Normalise a profile: apply the schema defaults, drop nothing the engine needs.
 *
 * Returns a fresh object (the input is not mutated). Unknown keys are preserved
 * as-is (harmless; the validator flags schema violations separately).
 *
 * @param {object} profile
 * @returns {object}
 */
export function normalizeProfile(profile) {
  const g = isObj(profile.global) ? profile.global : {};
  const global = {
    style: g.style !== undefined ? g.style : null,
    strokeCount: g.strokeCount,
    strokeSize: isObj(g.strokeSize) ? { ...PROFILE_DEFAULTS.strokeSize, ...g.strokeSize } : { ...PROFILE_DEFAULTS.strokeSize },
    sizeK: g.sizeK !== undefined ? g.sizeK : PROFILE_DEFAULTS.sizeK,
    detailLevel: g.detailLevel !== undefined ? g.detailLevel : PROFILE_DEFAULTS.detailLevel,
    styleStrength: g.styleStrength !== undefined ? g.styleStrength : PROFILE_DEFAULTS.styleStrength,
    opacity: g.opacity !== undefined ? g.opacity : PROFILE_DEFAULTS.opacity,
    randomness: g.randomness !== undefined ? g.randomness : PROFILE_DEFAULTS.randomness,
    pathOrder: g.pathOrder !== undefined ? g.pathOrder : PROFILE_DEFAULTS.pathOrder,
    colorMode: g.colorMode !== undefined ? g.colorMode : PROFILE_DEFAULTS.colorMode,
    palette: g.palette !== undefined ? g.palette : PROFILE_DEFAULTS.palette,
    abstract: g.abstract !== undefined ? g.abstract : PROFILE_DEFAULTS.abstract,
    outline: g.outline !== undefined ? g.outline : PROFILE_DEFAULTS.outline,
    rfill: g.rfill !== undefined ? g.rfill : PROFILE_DEFAULTS.rfill,
    oneLine: g.oneLine !== undefined ? g.oneLine : PROFILE_DEFAULTS.oneLine,
    smart: g.smart !== undefined ? g.smart : PROFILE_DEFAULTS.smart,
    multiLayer: g.multiLayer !== undefined ? g.multiLayer : PROFILE_DEFAULTS.multiLayer,
    seed: g.seed,
  };
  const layers = Array.isArray(profile.layers)
    ? profile.layers.filter((l) => isObj(l) && PROFILE_ROLES.includes(l.role)).map((l) => ({ ...l }))
    : [];
  return {
    ...profile,
    schemaVersion: PROFILE_SCHEMA_VERSION,
    global,
    layers,
    mediaModel: isObj(profile.mediaModel) ? normalizeMedia(profile.mediaModel) : null,
  };
}

function normalizeMedia(m) {
  const out = { ...PROFILE_DEFAULTS.mediaModel };
  if (isObj(m)) for (const k of Object.keys(out)) if (m[k] !== undefined) out[k] = m[k];
  return out;
}

/**
 * Map a profile's `global` block onto the engine/generator settings surface
 * (`js/engine/generator.js` → DEFAULT_SETTINGS). Only keys the engine knows are
 * emitted; anything absent is left for `resolveSettings` to default.
 *
 * @param {object} profile
 * @returns {object} generator settings subset
 */
export function profileToSettings(profile) {
  const p = normalizeProfile(profile);
  const g = p.global;
  const settings = {
    strokeSize: { ...g.strokeSize },
    detailLevel: g.detailLevel,
    styleStrength: g.styleStrength,
    opacity: g.opacity,
    randomness: g.randomness,
    colorMode: g.colorMode,
    pathOrder: g.pathOrder,
    multiLayer: g.multiLayer,
    // structure tensor is the engine's 'smart' mode
    alignToStructure: g.smart,
    smart: g.smart,
    // painter-side passthroughs (harmless when the consumer ignores them)
    outline: g.outline,
    rfill: g.rfill,
    oneLine: g.oneLine,
    abstract: g.abstract,
    palette: g.palette,
    sizeK: g.sizeK,
  };
  if (g.style !== null && g.style !== undefined) settings.style = g.style;
  if (g.strokeCount !== undefined) settings.strokeCount = g.strokeCount;
  return settings;
}

/**
 * Per-layer style overrides → the `layerStyles` record consumed by
 * `engine.generate({ layerStyles })` and `layer-styles.resolveLayerStyles`.
 * A role with no `style` (or `enabled:false`) is omitted so it inherits the
 * global style. Returns `null` when no role overrides a style (a no-op).
 *
 * @param {object} profile
 * @returns {Record<string,string>|null}
 */
export function profileToLayerStyles(profile) {
  const p = normalizeProfile(profile);
  const out = {};
  let any = false;
  for (const l of p.layers) {
    if (l.enabled === false) continue;
    if (isStr(l.style) && l.style.trim() !== '') { out[l.role] = l.style; any = true; }
  }
  return any ? out : null;
}

/**
 * Per-layer panel props (opacity / blend / order / visibility) keyed by role,
 * for the layer panel (`app.js` ↔ `js/ui/layers.js`). Only roles the profile
 * mentions are returned.
 *
 * @param {object} profile
 * @returns {Record<string,{opacity?:number,blendMode?:string,order?:number,visible?:boolean}>}
 */
export function profileToLayerProps(profile) {
  const p = normalizeProfile(profile);
  const out = {};
  for (const l of p.layers) {
    const props = {};
    if (l.opacity !== undefined) props.opacity = l.opacity;
    if (l.blendMode !== undefined) props.blendMode = l.blendMode;
    if (l.order !== undefined) props.order = l.order;
    if (l.enabled !== undefined) props.visible = l.enabled;
    if (Object.keys(props).length) out[l.role] = props;
  }
  return out;
}

/**
 * Expand a profile into everything `engine.generate()` needs.
 *
 * @param {object} profile
 * @returns {{settings: object, layerStyles: Record<string,string>|null,
 *   layerProps: object, mediaModel: object|null, multiLayer: boolean,
 *   seed: number|null, valid: boolean, errors: Array}}
 */
export function applyProfile(profile) {
  const { ok, errors } = validateProfile(profile);
  const p = normalizeProfile(profile);
  return {
    settings: profileToSettings(p),
    layerStyles: profileToLayerStyles(p),
    layerProps: profileToLayerProps(p),
    mediaModel: p.mediaModel,
    multiLayer: !!p.global.multiLayer,
    seed: isInt(p.global.seed) ? p.global.seed : null,
    valid: ok,
    errors,
  };
}

/**
 * Build a minimal, schema-valid profile from engine settings — the inverse of
 * `profileToSettings`, used for export and round-trip tests.
 *
 * @param {object} settings - generator-shaped settings.
 * @param {object} [overrides] - { id, name, version, provenance, mediaModel }.
 * @returns {object} a StyleProfile
 */
export function profileFromSettings(settings = {}, overrides = {}) {
  const global = {
    style: settings.style,
    strokeCount: settings.strokeCount,
    strokeSize: isObj(settings.strokeSize) ? { ...settings.strokeSize } : undefined,
    detailLevel: settings.detailLevel,
    styleStrength: settings.styleStrength,
    opacity: settings.opacity,
    randomness: settings.randomness,
    pathOrder: settings.pathOrder,
    colorMode: settings.colorMode,
    palette: settings.palette !== undefined ? settings.palette : null,
    abstract: settings.abstract,
    outline: settings.outline,
    rfill: settings.rfill,
    oneLine: settings.oneLine,
    smart: settings.smart,
    multiLayer: settings.multiLayer,
    seed: settings.seed,
  };
  for (const k of Object.keys(global)) if (global[k] === undefined) delete global[k];
  return {
    schemaVersion: PROFILE_SCHEMA_VERSION,
    id: overrides.id || '00000000-0000-4000-8000-000000000000',
    name: overrides.name || 'Untitled Profile',
    version: overrides.version || '1.0.0',
    engine: { name: 'www-paint', version: overrides.engineVersion || '0.1.0' },
    global,
    layers: overrides.layers || [],
    effects: overrides.effects || [],
    mediaModel: overrides.mediaModel,
    provenance: overrides.provenance || {
      source: 'human',
      notes: 'derived from engine settings',
    },
  };
}

/**
 * Attach a fused Track-S reference packet (S3) to a profile's `provenance`.
 *
 * Returns a NEW profile — the input is not mutated (profile objects are shared
 * with the library UI, which must not see its own object change under it).
 * Passing `null`/`undefined` clears the field. The fused packet is the object
 * `ref-analyze.fuseReferences` returns; it is stored verbatim on
 * `provenance.refPacket` and is what `fusedReferenceFromProfile` reads back.
 *
 * @param {object} profile
 * @param {object|null} fused
 * @returns {object} a new profile carrying `provenance.refPacket`
 */
export function attachFusedReference(profile, fused) {
  if (!isObj(profile)) throw new Error('attachFusedReference: a profile object is required');
  const provenance = isObj(profile.provenance) ? { ...profile.provenance } : { source: 'human' };
  if (!PROVENANCE_SOURCES.includes(provenance.source)) provenance.source = 'human';
  if (fused === null || fused === undefined) {
    delete provenance.refPacket;
  } else {
    if (!isObj(fused) || !Array.isArray(fused.scaleHistogram) || !isObj(fused.orientationField)) {
      throw new Error('attachFusedReference: expected a fused RefPacket');
    }
    provenance.refPacket = fused;
  }
  return { ...profile, provenance };
}

/**
 * The fused reference packet carried by a profile (or `null`).
 * @param {object} profile
 * @returns {object|null}
 */
export function fusedReferenceFromProfile(profile) {
  const p = isObj(profile) ? profile.provenance : null;
  return (isObj(p) && isObj(p.refPacket)) ? p.refPacket : null;
}

export default {
  PROFILE_SCHEMA_VERSION,
  PROFILE_ROLES,
  PROFILE_DEFAULTS,
  validateProfile,
  normalizeProfile,
  profileToSettings,
  profileToLayerStyles,
  profileToLayerProps,
  applyProfile,
  profileFromSettings,
  attachFusedReference,
  fusedReferenceFromProfile,
};
