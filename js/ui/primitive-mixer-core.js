/**
 * Stroke-language mixer — the pure core (Track-S S5 / M16, the Mac half).
 *
 * The M16 brief (`docs/PRIMITIVES.md` §7) is a **UI mixer** for the S5
 * stroke-language primitives. The mixer is split in two, the same shape as the
 * media panel and the Style library:
 *
 *   `primitive-mixer-core.js` (this file) — the profile ↔ mix translation and
 *   the read-out. **No DOM, no canvas, no randomness**, so it is node-testable
 *   and is where every claim the UI makes is actually decided.
 *
 *   `primitive-mixer.js` — the DOM section that renders the six sliders, the
 *   level picker and the read-outs, and forwards user intent here.
 *
 * The six primitives and every resolution rule are **BE-owned**
 * (`js/engine/primitives.js`); this module never re-states them. It only:
 *
 *   - maps a mix ↔ six slider values (`0..1`, step 0.05 — the same range as
 *     `propose.primitiveKnobs()`),
 *   - reads / writes a mix at a level (`global` / `layer` / `pass`) on a
 *     profile **without mutating it and without inventing a key** — a profile
 *     that declares no mix round-trips byte-identically (the S5 guarantee the
 *     engine suite pins is preserved end-to-end through the UI),
 *   - describes a mix for the read-out (canonical weights, the dominant
 *     primitive, `effectiveStyle`, the weighted geometry, and any validation
 *     errors) so the panel can surface a real error next to the control.
 *
 * @module primitive-mixer-core
 */

import {
  PRIMITIVE_IDS,
  PRIMITIVES,
  normalizePrimitiveMix,
  validatePrimitiveMix,
  dominantPrimitive,
  effectiveStyle,
  resolvePrimitiveMix,
  mixStrokeLanguage,
  primitiveStyleMix,
} from '../engine/primitives.js';
import { profileToPrimitives } from '../engine/profile.js';

/** The levels a mix may be declared at, most general first (mirrors §2). */
export const MIXER_LEVELS = ['global', 'layer', 'pass'];

/** The slider step. Matches `propose.primitiveKnobs()`'s `0..1` range. */
export const WEIGHT_STEP = 0.05;

const isStr = (v) => typeof v === 'string';
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * A human label for a level.
 * @param {string} level
 * @returns {string}
 */
export function levelLabel(level) {
  if (level === 'layer') return 'Layer';
  if (level === 'pass') return 'Pass';
  return 'Global';
}

/**
 * Clamp a number to `[0, 1]` and snap it to the slider step.
 *
 * `null`, `undefined`, `NaN` and `''` all become `0` — a slider is always a
 * number, and a half-typed field must not poison the mix.
 *
 * @param {*} v
 * @param {number} [step]
 * @returns {number}
 */
export function sliderWeight(v, step = WEIGHT_STEP) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  const clamped = Math.min(1, Math.max(0, n));
  const snapped = Math.round(clamped / step) * step;
  // Kill float dust (0.7000000000000001) so a mix serialises cleanly.
  return Math.round(snapped * 1e6) / 1e6;
}

/**
 * Six raw slider values → a mix. Only **positive** weights are kept, so a
 * cleared mixer yields `{}` — the "no primitives" signal, never a `0` entry.
 *
 * @param {Record<string, number>} values - keyed by primitive id
 * @returns {Record<string, number>}
 */
export function mixFromSliders(values) {
  const out = {};
  const src = isObj(values) ? values : {};
  for (const id of PRIMITIVE_IDS) {
    const w = sliderWeight(src[id]);
    if (w > 0) out[id] = w;
  }
  return out;
}

/**
 * A mix → the six slider values (canonical weights; absent ids omitted, which
 * the slider reads as `0`).
 *
 * @param {object|Array} mix
 * @returns {Record<string, number>}
 */
export function slidersFromMix(mix) {
  const canon = normalizePrimitiveMix(mix);
  const out = {};
  for (const id of PRIMITIVE_IDS) if (canon[id] !== undefined) out[id] = canon[id];
  return out;
}

/**
 * Which layers / passes a profile offers as mixer targets. A target is only
 * listed when it **already exists** on the profile — the mixer never invents a
 * layer or a pass just to hold a mix.
 *
 * @param {object} profile
 * @returns {{layers: string[], passes: string[]}}
 */
export function levelTargets(profile) {
  const layers = Array.isArray(profile?.layers)
    ? profile.layers.map((l) => (isObj(l) ? l.role : null)).filter(isStr)
    : [];
  const passes = Array.isArray(profile?.passes)
    ? profile.passes.map((p) => (isObj(p) && isStr(p.id) ? p.id : null)).filter(isStr)
    : [];
  return { layers, passes };
}

/**
 * Does the mix's chosen level have a real target on this profile? `global` is
 * always available; `layer` / `pass` need the named entry to exist.
 *
 * @param {object|null} profile
 * @param {{level?: string, layerRole?: string|null, passId?: string|null}} ctx
 * @returns {boolean}
 */
export function hasTargetAtLevel(profile, ctx = {}) {
  const level = ctx.level || 'global';
  if (level === 'global') return true;
  const { layers, passes } = levelTargets(profile);
  if (level === 'layer') return layers.includes(ctx.layerRole);
  if (level === 'pass') return passes.includes(ctx.passId);
  return false;
}

/**
 * Read the canonical mix declared at a level. An empty result (`{}`) is the
 * honest "nothing declared here" answer — never `null`, so the caller can feed
 * it straight back to the sliders.
 *
 * @param {object|null} profile
 * @param {{level?: string, layerRole?: string|null, passId?: string|null}} ctx
 * @returns {Record<string, number>}
 */
export function readMixAtLevel(profile, ctx = {}) {
  if (!isObj(profile)) return {};
  const level = ctx.level || 'global';
  if (level === 'global') return normalizePrimitiveMix(profile.global?.primitives);
  if (level === 'layer') {
    const l = Array.isArray(profile.layers)
      ? profile.layers.find((x) => isObj(x) && x.role === ctx.layerRole)
      : null;
    return normalizePrimitiveMix(l?.primitives);
  }
  if (level === 'pass') {
    const p = Array.isArray(profile.passes)
      ? profile.passes.find((x) => isObj(x) && x.id === ctx.passId)
      : null;
    return normalizePrimitiveMix(p?.primitives);
  }
  return {};
}

/**
 * Write a mix into a profile at a level, returning a **new** profile (the input
 * is never mutated) — the same discipline `normalizeProfile` follows.
 *
 * Two rules make M16 round-trip-safe:
 *
 *   1. An **empty** mix **removes** the key rather than writing `{}`. A profile
 *      that never declares a mix normalises to exactly its pre-S5 shape, so the
 *      engine suite's byte-identical guarantee survives the UI.
 *   2. A level whose target does **not** exist is a no-op: the profile comes
 *      back unchanged (`hasTargetAtLevel` is how the caller avoids this).
 *
 * The mix is stored **canonical** (canonical order, sums to 1) so two equal
 * mixes serialise identically.
 *
 * @param {object} profile
 * @param {{level?: string, layerRole?: string|null, passId?: string|null}} ctx
 * @param {object|Array} mix
 * @returns {object} a new profile
 */
export function writeMixAtLevel(profile, ctx = {}, mix) {
  const base = isObj(profile) ? profile : {};
  const out = { ...base, global: { ...(base.global || {}) } };
  const canon = normalizePrimitiveMix(mix);
  const empty = Object.keys(canon).length === 0;
  const level = ctx.level || 'global';

  if (level === 'global') {
    if (empty) delete out.global.primitives;
    else out.global.primitives = canon;
    return out;
  }

  if (level === 'layer') {
    const layers = Array.isArray(base.layers) ? base.layers.map((l) => ({ ...l })) : [];
    const idx = layers.findIndex((l) => l.role === ctx.layerRole);
    if (idx === -1) return out;
    if (empty) delete layers[idx].primitives;
    else layers[idx].primitives = canon;
    out.layers = layers;
    return out;
  }

  if (level === 'pass') {
    const passes = Array.isArray(base.passes) ? base.passes.map((p) => ({ ...p })) : [];
    const idx = passes.findIndex((p) => p.id === ctx.passId);
    if (idx === -1) return out;
    if (empty) delete passes[idx].primitives;
    else passes[idx].primitives = canon;
    out.passes = passes;
    return out;
  }

  return out;
}

/**
 * The read-out the panel renders. Everything the UI shows about a mix is
 * computed here, so the panel holds no logic of its own.
 *
 * @param {object|Array} mix
 * @param {string|null} [fallbackStyle] - the profile's `global.style`
 * @returns {{
 *   declared: object, normalized: Record<string, number>, isEmpty: boolean,
 *   dominant: string|null, dominantLabel: string|null, effectiveStyle: string|null,
 *   entries: Array<{id:string,label:string,weight:number,style:string,percent:number}>,
 *   styleMix: Record<string, number>, language: object|null,
 *   readout: string, valid: boolean, errors: Array<{path:string,message:string}>
 * }}
 */
export function describeMix(mix, fallbackStyle = null) {
  const declared = isObj(mix) ? mix : {};
  const normalized = normalizePrimitiveMix(mix);
  const ids = Object.keys(normalized);
  const isEmpty = ids.length === 0;
  const dom = dominantPrimitive(normalized);

  // Only validate a NON-empty, declared mix: an empty mixer is not an error,
  // it is the "no primitives" state.
  const verdict = isEmpty && Object.keys(declared).length === 0
    ? { ok: true, errors: [] }
    : validatePrimitiveMix(mix);

  const entries = resolvePrimitiveMix(normalized).map((r) => ({
    id: r.id,
    label: PRIMITIVES[r.id].label,
    weight: r.weight,
    style: r.style,
    percent: Math.round(r.weight * 100),
  }));

  const readout = isEmpty
    ? (fallbackStyle ? `No mix — style "${fallbackStyle}".` : 'No mix — no primitive declared.')
    : entries.map((e) => `${e.label} ${e.percent}%`).join(' · ')
      + ` → ${effectiveStyle(normalized, fallbackStyle) || '—'}`;

  return {
    declared,
    normalized,
    isEmpty,
    dominant: dom,
    dominantLabel: dom ? PRIMITIVES[dom].label : null,
    effectiveStyle: effectiveStyle(normalized, fallbackStyle),
    entries,
    styleMix: primitiveStyleMix(normalized),
    language: mixStrokeLanguage(normalized),
    readout,
    valid: verdict.ok,
    errors: verdict.errors,
  };
}

/**
 * Read a profile's primitives in one object (the S5 accessor, re-exported so the
 * panel imports its whole world from this module). `effectiveStyle` follows
 * `profile.profileEffectiveStyle`: the most specific declared mix wins
 * (pass > layer > global), and with no mix anywhere it is the profile's own
 * `global.style` — the pre-S5 style.
 *
 * @param {object} profile
 * @returns {{global: object|null, layers: object, passes: object, effectiveStyle: string|null}}
 */
export function profilePrimitives(profile) {
  if (!isObj(profile)) return { global: null, layers: {}, passes: {}, effectiveStyle: null };
  return profileToPrimitives(profile);
}

export default {
  MIXER_LEVELS,
  WEIGHT_STEP,
  levelLabel,
  sliderWeight,
  mixFromSliders,
  slidersFromMix,
  levelTargets,
  hasTargetAtLevel,
  readMixAtLevel,
  writeMixAtLevel,
  describeMix,
  profilePrimitives,
};
