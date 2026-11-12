/**
 * Style Profile library — the pure core (Round 2 / M10, Phase 4.2).
 *
 * The library is split in two, the same shape as the media panel:
 *
 *   `style-library-core.js` (this file) — the **profile object**, the frozen
 *   schema contract, the storage adapter and the persistence boundary. No DOM,
 *   no canvas, no randomness beyond id generation, so it is node-testable and
 *   safe to call from a worker.
 *
 *   `style-library.js` — the DOM panel that renders the rows and calls in here.
 *
 * The **profile object is the contract, not the storage** (HANDOFF §M5): the
 * adapter is a three-method interface (`getItem`/`setItem`/`removeItem`), so
 * localStorage, IndexedDB or a plain Map all work, and a missing adapter
 * degrades to in-memory rather than throwing.
 *
 * The module never imports `controls.js` or `app.js`, and never mutates the
 * caller's object — every write goes through a normalised copy.
 *
 * @module style-library-core
 */

import {
  validateProfile,
  normalizeProfile,
  applyProfile,
  PROFILE_SCHEMA_VERSION,
} from '../engine/profile.js';

/** localStorage key. Versioned so a schema change can migrate rather than clash. */
export const STORAGE_KEY = 'www-paint.styleProfiles.v1';

/** The master seed the engine itself uses, used as the default for new profiles. */
export const DEFAULT_SEED = 3047602159;

/** Maximum profile name length, from the frozen schema (`maxLength: 128`). */
export const MAX_NAME_LENGTH = 128;

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isStr = (v) => typeof v === 'string';

/** A dependency-free uuid v4 (crypto.randomUUID when available). */
export function newProfileId() {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  const b = new Uint8Array(16);
  if (c && typeof c.getRandomValues === 'function') c.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40; // version 4
  b[8] = (b[8] & 0x3f) | 0x80; // variant 10
  const h = [...b].map((x) => x.toString(16).padStart(2, '0'));
  return `${h.slice(0, 4).join('')}-${h.slice(4, 6).join('')}-${h.slice(6, 8).join('')}`
    + `-${h.slice(8, 10).join('')}-${h.slice(10, 16).join('')}`;
}

/**
 * Trim a profile name and fall back to a default.
 *
 * A name is a **label**, so a whitespace-only name becomes the default — it is
 * not an error. An *explicitly empty* name (`""`) is a different thing: a
 * caller clearing the field gets an error rather than a silent rename, which
 * is what `save` checks.
 *
 * @param {string} name
 * @returns {string}
 */
export function coerceProfileName(name) {
  const trimmed = isStr(name) ? name.trim() : '';
  if (!trimmed) return 'Untitled Profile';
  return trimmed.slice(0, MAX_NAME_LENGTH);
}

/**
 * A fresh, schema-valid, deterministic default profile.
 *
 * The id is new every call; everything else is fixed so two blank saves differ
 * only in identity.
 *
 * @returns {object} a StyleProfile
 */
export function defaultProfile() {
  const now = new Date().toISOString();
  return {
    schemaVersion: PROFILE_SCHEMA_VERSION,
    id: newProfileId(),
    name: 'Untitled Profile',
    version: '1.0.0',
    engine: { name: 'www-paint', version: '0.1.0' },
    global: {
      style: 'pencil',
      strokeCount: 1000,
      strokeSize: { min: 3, max: 18, random: true },
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
      seed: DEFAULT_SEED,
    },
    layers: [],
    effects: [],
    mediaModel: {
      kind: 'dry', wetness: 0, drying: 0, bleed: 0,
      granulation: 0, height: 0, bristle: 0, paper: null,
    },
    provenance: {
      source: 'human',
      notes: 'Created in WWW_PAINT',
      createdAt: now,
      updatedAt: now,
    },
  };
}

/**
 * Serialise a profile for the Export button / a JSON file.
 *
 * Pretty-printed on purpose: a profile is a thing a human reads and diffs, and
 * a single-line blob defeats both.
 *
 * @param {object} profile
 * @returns {string}
 */
export function profileToExportText(profile) {
  return JSON.stringify(profile, null, 2);
}

/**
 * Parse exported text back into a profile, tolerating prose and code fences.
 *
 * `JSON.parse` alone is too brittle for text a user pasted from a chat or a
 * README, so a fenced or wrapped payload is unwrapped first.
 *
 * @param {string} text
 * @param {{validate?: boolean}} [opts] - validate against the schema (default true)
 * @returns {object|{ok: boolean, profile: object|null, errors: Array}}
 *   With `opts.validate` (the default) the result is a report object; with
 *   `validate:false` the profile is returned directly and a malformed payload
 *   throws.
 */
export function profileFromExportText(text, opts = {}) {
  const shouldValidate = opts.validate !== false;
  const raw = isStr(text) ? text.trim() : '';
  if (!raw) throw new Error('the profile text is empty');

  let parsed;
  const candidates = [raw];
  // ```json ... ``` or ``` ... ```
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) candidates.unshift(fenced[1].trim());
  // Prose around the object: take from the first `{` to the last `}`.
  const first = raw.indexOf('{');
  const last = raw.lastIndexOf('}');
  if (first !== -1 && last > first) candidates.unshift(raw.slice(first, last + 1));

  let lastErr = null;
  for (const candidate of candidates) {
    try {
      parsed = JSON.parse(candidate);
      lastErr = null;
      break;
    } catch (e) {
      lastErr = e;
    }
  }
  if (lastErr) throw new Error(`could not parse the profile JSON: ${lastErr.message}`);

  if (!isObj(parsed)) throw new Error('the profile must be a JSON object');
  if (!shouldValidate) return parsed;

  const { ok, errors } = validateProfile(parsed);
  return { ok, profile: ok ? parsed : null, errors };
}

/**
 * One line of list metadata for a stored profile.
 *
 * Deliberately tolerant: a hand-edited or imported profile may be missing any
 * field, and the list row must still render.
 *
 * @param {object} profile
 * @returns {{style: string, strokeCount: number, layerCount: number,
 *   seed: number|null, mediaKind: string, pathOrder: string, updatedAt: string|null}}
 */
export function summarizeProfile(profile) {
  const g = isObj(profile) && isObj(profile.global) ? profile.global : {};
  const layers = Array.isArray(profile?.layers) ? profile.layers : [];
  return {
    style: isStr(g.style) && g.style ? g.style : '—',
    strokeCount: Number.isFinite(g.strokeCount) ? g.strokeCount : 0,
    layerCount: layers.length,
    seed: Number.isInteger(g.seed) ? g.seed : null,
    mediaKind: isStr(profile?.mediaModel?.kind) ? profile.mediaModel.kind : 'dry',
    pathOrder: isStr(g.pathOrder) ? g.pathOrder : 'free',
    updatedAt: isStr(profile?.provenance?.updatedAt) ? profile.provenance.updatedAt : null,
  };
}

/** A short human label for a validation error path. */
function firstError(errors) {
  return errors && errors.length ? `${errors[0].path}: ${errors[0].message}` : 'invalid profile';
}

/**
 * ProfileLibrary — save / list / get / apply / delete / export / import.
 *
 * @param {object} [opts]
 * @param {object} [opts.storage] - getItem/setItem/removeItem, or null
 * @param {number} [opts.now] - clock override (determinism in tests)
 * @param {function} [opts.idGen] - id generator override
 */
export class ProfileLibrary {
  constructor(opts = {}) {
    this._storage = opts.storage === undefined ? defaultStorage() : opts.storage;
    this._now = typeof opts.now === 'function' ? opts.now : () => new Date().toISOString();
    this._idGen = typeof opts.idGen === 'function' ? opts.idGen : newProfileId;
    /** @type {Array<{id: string, profile: object, savedAt: string}>} */
    this._entries = [];
    this._load();
  }

  /* ─── Persistence ───────────────────────────────────────────── */

  /**
   * Resolve a storage adapter from the environment, or null.
   * @returns {object|null}
   * @private
   */
  _defaultStorage() {
    try {
      if (typeof globalThis.localStorage === 'object' && globalThis.localStorage) {
        return globalThis.localStorage;
      }
    } catch {
      // Accessing localStorage can throw in a privacy context; fall through.
    }
    return null;
  }

  /**
   * Read the stored array. Any failure (missing, corrupt, non-array) yields an
   * empty library rather than an exception — a broken cache must not stop the
   * panel from opening.
   * @private
   */
  _load() {
    this._entries = [];
    const raw = this._read();
    if (!raw) return;
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }
    if (!Array.isArray(parsed)) return;
    for (const item of parsed) {
      const entry = this._coerceEntry(item);
      if (entry) this._entries.push(entry);
    }
  }

  /**
   * Normalise one stored row into `{id, profile, savedAt}`.
   * @param {*} item
   * @returns {object|null}
   * @private
   */
  _coerceEntry(item) {
    if (isObj(item) && isObj(item.profile)) {
      const profile = normalizeProfile(item.profile);
      return { id: String(item.id || profile.id), profile, savedAt: String(item.savedAt || '') };
    }
    // A bare profile (the export format) stored directly.
    if (isObj(item) && item.schemaVersion !== undefined) {
      const profile = normalizeProfile(item);
      return { id: String(profile.id || this._idGen()), profile, savedAt: '' };
    }
    return null;
  }

  /**
   * @returns {string|null}
   * @private
   */
  _read() {
    if (!this._storage || typeof this._storage.getItem !== 'function') return null;
    try {
      return this._storage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  }

  /**
   * @private
   */
  _write() {
    if (!this._storage || typeof this._storage.setItem !== 'function') return;
    try {
      const payload = this._entries.map((e) => ({
        id: e.id,
        savedAt: e.savedAt,
        profile: e.profile,
      }));
      this._storage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // A full or blocked localStorage must not break the in-memory list.
    }
  }

  /* ─── Public API ───────────────────────────────────────────── */

  /**
   * Save a profile. An existing `id` updates in place; otherwise a new id is
   * generated. Returns a **copy** — the caller's object is never mutated.
   *
   * @param {object} profile
   * @returns {object} the stored profile
   * @throws {Error} when the profile fails schema validation
   */
  save(profile) {
    if (!isObj(profile)) throw new Error('a profile must be an object');
    // An explicitly empty name is a user error (they cleared the field); a
    // missing/whitespace name falls back to the default label.
    if (isStr(profile.name) && profile.name.trim() === '') {
      throw new Error('the profile name cannot be empty');
    }
    const name = coerceProfileName(profile.name);

    const now = this._now();
    const id = isStr(profile.id) && profile.id ? profile.id : this._idGen();
    const prev = this._entries.find((e) => e.id === id);
    const incoming = normalizeProfile({ ...profile, id, name });

    // The schema allows a profile with no `global.style` ("does not force
    // one"); `normalizeProfile` fills it with null, which the validator then
    // rejects as a non-string. Drop it so the library's contract matches the
    // schema's, and the engine keeps its own default.
    if (incoming.global.style === null) delete incoming.global.style;

    // Same class of problem for `mediaModel`: the schema's $defs require an
    // object, but a profile may omit it entirely. `normalizeProfile` writes
    // null, which would make every minimal profile unsaveable.
    if (incoming.mediaModel === null) delete incoming.mediaModel;

    const { ok, errors } = validateProfile(incoming);
    if (!ok) throw new Error(`the profile is not valid: ${firstError(errors)}`);

    const stored = normalizeProfile({
      ...incoming,
      id,
      provenance: {
        ...incoming.provenance,
        createdAt: incoming.provenance?.createdAt || prev?.profile?.provenance?.createdAt || now,
        updatedAt: now,
      },
    });

    const idx = this._entries.findIndex((e) => e.id === stored.id);
    const row = { id: stored.id, profile: stored, savedAt: now };
    if (idx === -1) this._entries.push(row);
    else this._entries[idx] = row;

    this._write();
    return normalizeProfile(stored);
  }

  /**
   * List metadata rows, name-sorted.
   *
   * @returns {Array<{id: string, name: string, summary: object,
   *   profile: object, savedAt: string}>}
   */
  list() {
    return [...this._entries]
      .sort((a, b) => {
        const an = (a.profile.name || '').toLowerCase();
        const bn = (b.profile.name || '').toLowerCase();
        if (an !== bn) return an < bn ? -1 : 1;
        return (b.savedAt || '').localeCompare(a.savedAt || '');
      })
      .map((e) => ({
        id: e.id,
        name: e.profile.name,
        summary: summarizeProfile(e.profile),
        profile: normalizeProfile(e.profile),
        savedAt: e.savedAt,
      }));
  }

  /**
   * Get one stored profile.
   * @param {string} id
   * @returns {object|null}
   */
  get(id) {
    const e = this._entries.find((x) => x.id === id);
    return e ? { id: e.id, profile: normalizeProfile(e.profile), savedAt: e.savedAt } : null;
  }

  /**
   * @param {string} id
   * @returns {boolean}
   */
  has(id) {
    return this._entries.some((e) => e.id === id);
  }

  /**
   * Delete one profile.
   * @param {string} id
   * @returns {boolean} whether anything was removed
   */
  delete(id) {
    const before = this._entries.length;
    this._entries = this._entries.filter((e) => e.id !== id);
    const removed = this._entries.length !== before;
    if (removed) this._write();
    return removed;
  }

  /**
   * Empty the library.
   */
  clear() {
    this._entries = [];
    this._write();
  }

  /* ─── Apply ────────────────────────────────────────────────── */

  /**
   * Expand a stored profile into exactly what `engine.generate()` needs.
   *
   * This is the one call the host shim makes before a bake, so the panel never
   * has to know the engine's settings shape.
   *
   * @param {string} id
   * @returns {{ok: boolean, profile: object|null, settings: object,
   *   layerStyles: object|null, layerProps: object, mediaModel: object|null,
   *   seed: number|null, errors: Array}}
   */
  apply(id) {
    const entry = this._entries.find((e) => e.id === id);
    if (!entry) {
      return {
        ok: false, profile: null, settings: {}, layerStyles: null, layerProps: {},
        mediaModel: null, seed: null,
        errors: [{ path: 'id', message: `no stored profile with id ${id}` }],
      };
    }
    const profile = normalizeProfile(entry.profile);
    const r = applyProfile(profile);
    // `normalizeProfile` fills a missing style with null, and the engine's
    // `resolveSettings` copies that straight through — a null style would reach
    // the size sampler. Dropping the key leaves the engine's own default in
    // force, which is the documented "a profile with no style does not force
    // one" contract.
    const settings = { ...r.settings };
    if (settings.style === null || settings.style === undefined) delete settings.style;
    // `applyProfile` re-validates the normalised profile, which still carries
    // the null style; a profile the library accepted must not be rejected here.
    const errors = r.errors.filter((e) => e.path !== 'global.style');
    return {
      ok: errors.length === 0,
      profile,
      settings,
      layerStyles: r.layerStyles,
      layerProps: r.layerProps,
      mediaModel: r.mediaModel,
      seed: r.seed,
      errors,
    };
  }

  /* ─── Export / import ──────────────────────────────────────── */

  /**
   * Serialise one stored profile.
   * @param {string} id
   * @returns {string}
   */
  exportText(id) {
    const entry = this._entries.find((e) => e.id === id);
    if (!entry) throw new Error(`no stored profile with id ${id}`);
    return profileToExportText(normalizeProfile(entry.profile));
  }

  /**
   * Import one or more profiles from text.
   *
   * Accepts a single profile, an array of profiles, or the library's own
   * storage payload. Invalid entries are skipped and reported, never thrown —
   * a bad import must not destroy what is already stored.
   *
   * @param {string} text
   * @returns {Array<{id: string, name: string, ok: boolean, error: string|null}>}
   */
  importText(text) {
    const raw = isStr(text) ? text.trim() : '';
    if (!raw) throw new Error('the profile text is empty');

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      throw new Error(`could not parse the profile JSON: ${e.message}`);
    }

    const items = Array.isArray(parsed) ? parsed : [parsed];
    const results = [];
    for (const item of items) {
      const candidate = isObj(item) && isObj(item.profile) ? item.profile : item;
      if (!isObj(candidate) || candidate.schemaVersion === undefined) {
        results.push({ id: null, name: null, ok: false, error: 'not a StyleProfile' });
        continue;
      }
      const normalized = normalizeProfile(candidate);
      const { ok, errors } = validateProfile(normalized);
      if (!ok) {
        results.push({ id: normalized.id || null, name: normalized.name || null, ok: false, error: firstError(errors) });
        continue;
      }
      // A profile already in the library UPDATES in place; otherwise the
      // import would silently duplicate every row on a second paste.
      const saved = this.save(normalized);
      results.push({ id: saved.id, name: saved.name, ok: true, error: null });
    }
    return results;
  }
}

/** @private True when localStorage is usable. */
function defaultStorage() {
  try {
    if (typeof globalThis.localStorage === 'object' && globalThis.localStorage) {
      return globalThis.localStorage;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export default ProfileLibrary;
