/**
 * Stroke-language primitives (Track-S S5).
 *
 * The problem this file solves
 * ----------------------------
 * Until now a Style Profile could only name a **registry style** (`global.style`
 * = `'pencil'`, `layers[].style` = `'ink'`). That is one flat menu of 51
 * finished looks: there is no way to say *"lay a broad soft wash for the masses,
 * then crisp short stamps for the accents"* — the actual request behind a
 * "sref". `passes[]` (S4) let a profile author its *schedule*, but each pass
 * still resolved to a whole style name.
 *
 * This module adds the missing middle layer: a **small, mixable set of
 * stroke-language primitives**. A primitive is not a style — it is one
 * *character* of stroke, and it resolves to things the engine already has:
 *
 *   - a registry style (`js/styles/index.js`) it is rendered with today,
 *   - a brush-media preset (`brush-media.js`) for the stamp path,
 *   - a media-model block (`profile.mediaModel` shape),
 *   - a **stroke-language geometry** (radius multiplier, reference blur,
 *     elongation, dab alpha, detail response) — the same knobs a pass plan
 *     entry carries, so a mix of primitives is a *measured* change to the paint
 *     schedule, not a label.
 *
 * A profile weights primitives per level — `global.primitives`,
 * `layers[].primitives`, `passes[].primitives` (most specific wins). The AI
 * harness may propose **weights** (`propose.primitiveKnobs`) instead of only
 * registry style names.
 *
 * Resolution, not invention
 * -------------------------
 * Every primitive resolves to an EXISTING style and an EXISTING media preset —
 * this is deliberately a *vocabulary*, not a new renderer. The suite asserts
 * both (registry membership + `MEDIA_PRESETS` membership), so a primitive can
 * never silently point at a style that was renamed away.
 *
 * Output-neutral until opted in
 * -----------------------------
 * Pure, no DOM, no canvas, no randomness. A profile with no `primitives`
 * anywhere resolves to an empty mix and every consumer takes its previous path
 * (byte-identical output — the 9 pinned visual baselines and the engine suite
 * pin it). **Honest scope:** the geometry numbers below are a declared
 * *language*, hand-set from each medium's character; they are NOT a fidelity
 * measurement, and S5 makes none. Whether a mix actually matches a reference is
 * S10's matrix to measure, not this file's to claim.
 *
 * @module primitives
 */

import { resolveMedia } from './brush-media.js';

/**
 * The primitive ids, in their canonical order.
 *
 * Canonical order is part of the contract: every resolver returns primitives in
 * this order, so two equal mixes serialise identically (determinism), and a
 * dominant-primitive tie is broken by it.
 * @type {string[]}
 */
export const PRIMITIVE_IDS = ['dry-stamp', 'wet-wash', 'bristle', 'smudge', 'hatch', 'spatter'];

/**
 * The stroke-language primitive table.
 *
 * Per entry:
 * - `label` — human name (UI).
 * - `style` — the registry style this primitive renders with today.
 * - `media` — the `MEDIA_PRESETS` key for the stamp path.
 * - `mediaModel` — the media-model block this primitive implies.
 * - `language` — the pass-plan geometry the primitive contributes:
 *   `radiusMul` (a multiplier of the base dab radius), `blur` (reference blur
 *   as a fraction of the base radius), `elongMul` (elongation multiplier),
 *   `alpha` (dab opacity), `detail` (detail response).
 *
 * @type {Record<string, {id:string, label:string, style:string, media:string,
 *   mediaModel:object, language:object}>}
 */
export const PRIMITIVES = {
  /** Firm, small, crisp stamped marks — the stamped-brush character. */
  'dry-stamp': {
    id: 'dry-stamp',
    label: 'Dry stamp',
    style: 'pencil',
    media: 'pencil',
    mediaModel: { kind: 'dry', wetness: 0, drying: 0, bleed: 0, granulation: 0.10, height: 0, bristle: 0, paper: null },
    language: { radiusMul: 0.34, blur: 0.06, elongMul: 0.90, alpha: 0.95, detail: 0.85 },
  },
  /** Broad, soft, low-opacity glazes — the wash character. */
  'wet-wash': {
    id: 'wet-wash',
    label: 'Wet wash',
    style: 'wash',
    media: 'wash',
    mediaModel: { kind: 'wet', wetness: 0.80, drying: 0.35, bleed: 0.20, granulation: 0.10, height: 0, bristle: 0, paper: null },
    language: { radiusMul: 1.55, blur: 0.90, elongMul: 1.00, alpha: 0.55, detail: 0.45 },
  },
  /** Stiff, streaky, elongated strokes — the bristle/impasto character. */
  bristle: {
    id: 'bristle',
    label: 'Bristle',
    style: 'oil',
    media: 'gouache',
    mediaModel: { kind: 'impasto', wetness: 0.15, drying: 0.20, bleed: 0.05, granulation: 0.05, height: 0.60, bristle: 1, paper: null },
    language: { radiusMul: 0.80, blur: 0.12, elongMul: 1.85, alpha: 0.90, detail: 0.70 },
  },
  /** Soft, blurred, low-opacity smears that carry the height buffer. */
  smudge: {
    id: 'smudge',
    label: 'Smudge',
    style: 'charcoal',
    media: 'charcoal',
    mediaModel: { kind: 'dry', wetness: 0, drying: 0, bleed: 0, granulation: 0.25, height: 1, bristle: 0.20, paper: null },
    language: { radiusMul: 1.10, blur: 0.60, elongMul: 0.70, alpha: 0.50, detail: 0.50 },
  },
  /** Very small, highly elongated, even lines — the hatch character. */
  hatch: {
    id: 'hatch',
    label: 'Hatch',
    style: 'cross-hatch',
    media: 'pen',
    mediaModel: { kind: 'dry', wetness: 0, drying: 0, bleed: 0.02, granulation: 0.05, height: 0, bristle: 0, paper: null },
    language: { radiusMul: 0.24, blur: 0.02, elongMul: 2.40, alpha: 0.85, detail: 0.95 },
  },
  /** Small, round, sparse, low-opacity specks — the spray character. */
  spatter: {
    id: 'spatter',
    label: 'Spatter',
    style: 'graffiti',
    media: 'spray',
    mediaModel: { kind: 'dry', wetness: 0.05, drying: 0.40, bleed: 0.08, granulation: 0.30, height: 0, bristle: 0, paper: null },
    language: { radiusMul: 0.50, blur: 0.15, elongMul: 0.40, alpha: 0.35, detail: 0.90 },
  },
};

/// The levels a mix may be declared at, from widest to most specific.
export const PRIMITIVE_LEVELS = ['global', 'layer', 'pass'];

/// The stroke-language fields a primitive contributes, in canonical order.
export const LANGUAGE_FIELDS = ['radiusMul', 'blur', 'elongMul', 'alpha', 'detail'];

/**
 * Is `id` a declared primitive?
 * @param {*} id
 * @returns {boolean}
 */
export function isKnownPrimitive(id) {
  return typeof id === 'string' && Object.prototype.hasOwnProperty.call(PRIMITIVES, id);
}

/**
 * Resolve one primitive by id — a fresh, deep copy (callers may not mutate the
 * table). Returns `null` for an unknown id rather than throwing, so a
 * validation path can route around it.
 *
 * @param {string} id
 * @returns {{id:string,label:string,style:string,media:string,mediaModel:object,language:object,
 *   mediaParams:object}|null}
 */
export function resolvePrimitive(id) {
  if (!isKnownPrimitive(id)) return null;
  const p = PRIMITIVES[id];
  return {
    id: p.id,
    label: p.label,
    style: p.style,
    media: p.media,
    mediaModel: { ...p.mediaModel },
    language: { ...p.language },
    // The resolved, fully-defaulted media parameter block — so a consumer never
    // has to know the preset name to read a primitive's stamp parameters.
    mediaParams: resolveMedia(p.media),
  };
}

/**
 * Read `{ id, weight }`-ish entries out of the two accepted shapes into a flat
 * list. Accepts:
 *   - an object map: `{ 'wet-wash': 0.7, hatch: 0.3 }`
 *   - an array of entries: `[{ id: 'wet-wash', weight: 0.7 }]`,
 *     `[{ primitive: 'hatch', weight: 0.3 }]` or `[['hatch', 0.3]]`
 * Anything else yields an empty list. Pure; never throws.
 *
 * @param {object|Array} mix
 * @returns {Array<{id:*, weight:*}>}
 */
export function primitiveMixEntries(mix) {
  if (Array.isArray(mix)) {
    return mix.map((e) => {
      if (Array.isArray(e)) return { id: e[0], weight: e[1] };
      if (e && typeof e === 'object') return { id: e.id !== undefined ? e.id : e.primitive, weight: e.weight };
      return { id: undefined, weight: undefined };
    });
  }
  if (mix && typeof mix === 'object') {
    return Object.keys(mix).map((id) => ({ id, weight: mix[id] }));
  }
  return [];
}

/**
 * Normalise a mix into its canonical form: a **weight map** holding only known
 * primitives with a finite, positive weight, in {@link PRIMITIVE_IDS} order and
 * normalised to sum exactly 1.
 *
 * An empty result (`{}`) means "no primitives" — the signal every consumer
 * reads as *take the previous code path*. That is what keeps S5 output-neutral
 * until a profile opts in.
 *
 * @param {object|Array} mix
 * @returns {Record<string, number>} canonical weight map (possibly empty)
 */
export function normalizePrimitiveMix(mix) {
  const kept = {};
  for (const { id, weight } of primitiveMixEntries(mix)) {
    if (!isKnownPrimitive(id)) continue;
    const w = Number(weight);
    if (!Number.isFinite(w) || w <= 0) continue;
    kept[id] = (kept[id] || 0) + w;
  }
  const out = {};
  let sum = 0;
  for (const id of PRIMITIVE_IDS) {
    if (kept[id] === undefined) continue;
    out[id] = kept[id];
    sum += kept[id];
  }
  if (sum <= 0) return {};
  // Already-normalised input stays untouched, so normalisation is a true fixed
  // point (`normalizePrimitiveMix(normalizePrimitiveMix(m)) === ...`) — a profile
  // is folded through normalisation more than once and must not drift.
  if (Math.abs(sum - 1) > 1e-9) for (const id of Object.keys(out)) out[id] = out[id] / sum;
  return out;
}

/**
 * Validate a declared mix without normalising it away. Mirrors
 * `profile.validateProfile`'s error shape so a caller can surface every problem
 * at once.
 *
 * @param {*} mix
 * @param {string} [path='primitives']
 * @returns {{ok: boolean, errors: Array<{path:string,message:string}>}}
 */
export function validatePrimitiveMix(mix, path = 'primitives') {
  const errors = [];
  const err = (p, message) => errors.push({ path: p, message });
  const isMap = mix !== null && typeof mix === 'object' && !Array.isArray(mix);
  if (!isMap && !Array.isArray(mix)) {
    err(path, 'must be an object of { primitive: weight } or an array of { id, weight }');
    return { ok: false, errors };
  }
  let usable = 0;
  const entries = primitiveMixEntries(mix);
  if (Array.isArray(mix)) {
    entries.forEach((e, i) => {
      const id = e.id;
      if (!isKnownPrimitive(id)) { err(`${path}[${i}].id`, `unknown primitive ${JSON.stringify(id)}`); return; }
      if (!Number.isFinite(Number(e.weight)) || Number(e.weight) < 0) {
        err(`${path}[${i}].weight`, 'must be a number >= 0');
        return;
      }
      if (Number(e.weight) > 0) usable++;
    });
  } else {
    for (const [id, weight] of Object.entries(mix)) {
      if (!isKnownPrimitive(id)) { err(`${path}.${id}`, `unknown primitive '${id}'`); continue; }
      if (!Number.isFinite(Number(weight)) || Number(weight) < 0) {
        err(`${path}.${id}`, 'must be a number >= 0');
        continue;
      }
      if (Number(weight) > 0) usable++;
    }
  }
  if (errors.length === 0 && usable === 0) {
    err(path, 'declares no primitive with a positive weight');
  }
  return { ok: errors.length === 0, errors };
}

/**
 * The mix as a resolved list — `{ id, weight, style, media, mediaModel,
 * language }` — in canonical order. Empty array for an empty mix.
 *
 * @param {object|Array} mix
 * @returns {Array<object>}
 */
export function resolvePrimitiveMix(mix) {
  const canon = normalizePrimitiveMix(mix);
  return Object.keys(canon).map((id) => {
    const r = resolvePrimitive(id);
    return { id, weight: canon[id], style: r.style, media: r.media, mediaModel: r.mediaModel, language: r.language };
  });
}

/**
 * The highest-weighted primitive's **id** (ties broken by canonical order), or
 * `null` when the mix is empty. This is the one-word summary of a mix.
 *
 * @param {object|Array} mix
 * @returns {string|null}
 */
export function dominantPrimitive(mix) {
  const canon = normalizePrimitiveMix(mix);
  const ids = Object.keys(canon);
  if (ids.length === 0) return null;
  let best = ids[0];
  for (const id of ids) if (canon[id] > canon[best]) best = id;
  return best;
}

/**
 * The registry style a mix resolves to today — the dominant primitive's
 * `style`. `fallback` (usually the profile's `global.style`) is returned for an
 * empty mix, so a caller can write `effectiveStyle(mix) || 'pencil'` and get the
 * previous behaviour exactly.
 *
 * @param {object|Array} mix
 * @param {string|null} [fallback=null]
 * @returns {string|null}
 */
export function effectiveStyle(mix, fallback = null) {
  const id = dominantPrimitive(mix);
  return id ? PRIMITIVES[id].style : (fallback === undefined ? null : fallback);
}

/**
 * Weight-average one numeric field across a resolved mix. Weights are
 * renormalised over the entries that define the field, so a primitive missing a
 * field never drags the mean toward zero.
 *
 * @param {Array<object>} resolved - `resolvePrimitiveMix` output.
 * @param {string} group - 'language' | 'mediaModel'
 * @param {string} field
 * @returns {number}
 */
function weightedField(resolved, group, field) {
  let num = 0;
  let den = 0;
  for (const r of resolved) {
    const v = r[group] ? r[group][field] : undefined;
    if (!Number.isFinite(v)) continue;
    num += v * r.weight;
    den += r.weight;
  }
  return den > 0 ? num / den : 0;
}

/**
 * The stroke language a mix declares: a weighted average of its primitives'
 * geometry, plus the canonical weights and the dominant primitive's style.
 *
 * A single primitive returns its own numbers **verbatim** (no float drift), and
 * an empty mix returns `null` — the caller's signal to change nothing.
 *
 * @param {object|Array} mix
 * @returns {{radiusMul:number, blur:number, elongMul:number, alpha:number,
 *   detail:number, primitives:Record<string,number>, style:string|null}|null}
 */
export function mixStrokeLanguage(mix) {
  const canon = normalizePrimitiveMix(mix);
  const ids = Object.keys(canon);
  if (ids.length === 0) return null;
  if (ids.length === 1) {
    const only = PRIMITIVES[ids[0]];
    return { ...only.language, primitives: canon, style: only.style };
  }
  const resolved = resolvePrimitiveMix(canon);
  const out = { primitives: canon, style: PRIMITIVES[dominantPrimitive(canon)].style };
  const lang = {};
  for (const f of LANGUAGE_FIELDS) lang[f] = weightedField(resolved, 'language', f);
  // Key order matches the single-primitive branch: language fields, then
  // `primitives`, then `style` — so a plan entry serialises the same shape
  // whichever branch produced it.
  return { ...lang, primitives: out.primitives, style: out.style };
}

/**
 * The media-model block a mix implies — a weighted average of the primitives'
 * models. `kind` and `paper` come from the dominant primitive (they are enums,
 * not averages). A single primitive returns its model verbatim; an empty mix
 * returns `null`.
 *
 * @param {object|Array} mix
 * @param {object} [base] - fields to carry for anything the mix does not set.
 * @returns {object|null}
 */
export function mixMediaModel(mix, base = null) {
  const canon = normalizePrimitiveMix(mix);
  const ids = Object.keys(canon);
  if (ids.length === 0) return null;
  const dominant = PRIMITIVES[dominantPrimitive(canon)];
  if (ids.length === 1) return { ...dominant.mediaModel };
  const resolved = resolvePrimitiveMix(canon);
  const out = {};
  for (const k of Object.keys(dominant.mediaModel)) {
    if (k === 'kind') { out.kind = dominant.mediaModel.kind; continue; }
    if (k === 'paper') {
      out.paper = base && base.paper !== undefined ? base.paper : dominant.mediaModel.paper;
      continue;
    }
    out[k] = weightedField(resolved, 'mediaModel', k);
  }
  return out;
}

/**
 * The stamp media parameters a mix implies — a weighted average of the
 * primitives' `resolveMedia()` blocks over their numeric fields; `brushName`
 * and the non-numeric fields come from the dominant primitive (a brush tip is
 * not an average). A single primitive returns `resolveMedia(preset)` verbatim;
 * an empty mix returns `null`.
 *
 * @param {object|Array} mix
 * @param {object} [overrides] - per-call overrides (win over the mix).
 * @returns {object|null}
 */
export function mixMediaParams(mix, overrides = {}) {
  const canon = normalizePrimitiveMix(mix);
  const ids = Object.keys(canon);
  if (ids.length === 0) return null;
  const dominant = resolvePrimitive(dominantPrimitive(canon));
  if (ids.length === 1) return { ...dominant.mediaParams, ...overrides };
  const entries = Object.keys(canon).map((id) => ({ weight: canon[id], mediaParams: resolvePrimitive(id).mediaParams }));
  const out = {};
  for (const k of Object.keys(dominant.mediaParams)) {
    const numeric = entries.every((e) => e.mediaParams[k] === undefined || Number.isFinite(e.mediaParams[k]));
    out[k] = numeric ? weightedField(entries, 'mediaParams', k) : dominant.mediaParams[k];
  }
  out.brushName = dominant.mediaParams.brushName;
  return { ...out, ...overrides };
}

/**
 * Aggregate a mix's styles: `{ style: totalWeight }`, in first-appearance order.
 * Two primitives may share a registry style (so the weights add), which is what
 * a multi-pass renderer needs when it can only pick one style per pass.
 *
 * @param {object|Array} mix
 * @returns {Record<string, number>}
 */
export function primitiveStyleMix(mix) {
  const canon = normalizePrimitiveMix(mix);
  const out = {};
  for (const r of resolvePrimitiveMix(canon)) {
    out[r.style] = (out[r.style] || 0) + r.weight;
  }
  return out;
}

/**
 * Resolve a level-precedence chain to one mix: the most specific level that
 * declares a usable mix wins (`pass` > `layer` > `global`). Returns `{}` when
 * none does — again, "no primitives", not an error.
 *
 * @param {{global?:object|Array, layer?:object|Array, pass?:object|Array}} levels
 * @returns {Record<string, number>}
 */
export function resolvePrimitiveLevels(levels = {}) {
  for (const level of ['pass', 'layer', 'global']) {
    const canon = normalizePrimitiveMix(levels[level]);
    if (Object.keys(canon).length) return canon;
  }
  return {};
}

export default {
  PRIMITIVE_IDS,
  PRIMITIVES,
  PRIMITIVE_LEVELS,
  LANGUAGE_FIELDS,
  isKnownPrimitive,
  resolvePrimitive,
  primitiveMixEntries,
  normalizePrimitiveMix,
  validatePrimitiveMix,
  resolvePrimitiveMix,
  dominantPrimitive,
  effectiveStyle,
  mixStrokeLanguage,
  mixMediaModel,
  mixMediaParams,
  primitiveStyleMix,
  resolvePrimitiveLevels,
};
