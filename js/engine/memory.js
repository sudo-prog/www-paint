/**
 * Memory — feedback store + retrieval (Phase 5 / Harness H4).
 *
 * The AI loop's "learns from each success and from user input" half
 * (`docs/AI_STYLE_HARNESS.md` §1, §3). Every attempt — a `(reference image →
 * profile knobs → metrics → rating)` record — is stored, so a **similar
 * reference later starts closer**: the proposer can warm-start its search from
 * the best prior result for a perceptually-near image.
 *
 * Scope is deliberately honest (harness §3): this is NOT a trainable model. It
 * is (a) a bounded append-only store, (b) a **perceptual-hash** retrieval
 * (average hash + Hamming distance) that finds *similar* references, and (c) a
 * warm-start hook feeding `propose.searchProfile({ init })`. Wins AND losses are
 * recorded — a rejected-but-high-scoring profile is training signal, not noise.
 *
 * Pure, deterministic, JSON-serialisable, no DOM. Persistence (IndexedDB /
 * localStorage) is a thin adapter over `toJSON()` / `load()`.
 *
 * @module memory
 */

/** Store format version. `load()` refuses anything else. */
export const MEMORY_VERSION = 1;

/** Average-hash grid size (8×8 = 64 bits). */
export const HASH_GRID = 8;

/**
 * FNV-1a over a byte array (used for a stable, cheap content hash).
 * @param {Uint8ClampedArray|Uint8Array} bytes
 * @returns {number} uint32
 */
function fnv1a(bytes) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i];
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/**
 * A 64-bit **average hash** (aHash) of an RGBA buffer: downsample luminance to
 * an 8×8 grid, threshold each cell at the grid mean. Deterministic and cheap.
 * Near-identical references collide (small Hamming distance); it is a coarse
 * perceptual signature, not a full metric.
 *
 * @param {Uint8ClampedArray|Uint8Array} pixels RGBA
 * @param {number} w
 * @param {number} h
 * @returns {string} 16 hex chars (64 bits)
 */
export function averageHash(pixels, w, h) {
  const G = HASH_GRID;
  const lum = new Float64Array(G * G);
  for (let gy = 0; gy < G; gy++) {
    const y0 = Math.floor((gy * h) / G);
    const y1 = Math.max(y0 + 1, Math.floor(((gy + 1) * h) / G));
    for (let gx = 0; gx < G; gx++) {
      const x0 = Math.floor((gx * w) / G);
      const x1 = Math.max(x0 + 1, Math.floor(((gx + 1) * w) / G));
      let sum = 0, n = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const o = (y * w + x) * 4;
          sum += 0.2126 * pixels[o] + 0.7152 * pixels[o + 1] + 0.0722 * pixels[o + 2];
          n++;
        }
      }
      lum[gy * G + gx] = n ? sum / n : 0;
    }
  }
  let mean = 0;
  for (let i = 0; i < G * G; i++) mean += lum[i];
  mean /= G * G;
  let hi = 0, lo = 0;
  for (let i = 0; i < G * G; i++) {
    if (lum[i] >= mean) {
      if (i < 32) hi |= (1 << i);
      else lo |= (1 << (i - 32));
    }
  }
  return (hi >>> 0).toString(16).padStart(8, '0') + (lo >>> 0).toString(16).padStart(8, '0');
}

/**
 * Hamming distance between two equal-length hex hashes.
 * @param {string} a
 * @param {string} b
 * @returns {number} differing bits
 */
export function hamming(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return Infinity;
  let d = 0;
  for (let i = 0; i < a.length; i++) {
    let x = (parseInt(a[i], 16) ^ parseInt(b[i], 16)) >>> 0;
    while (x) { d += x & 1; x >>>= 1; }
  }
  return d;
}

/**
 * A stable key for a knob vector (sorted `name=value`), so two entries with the
 * same knobs are recognisable regardless of key order.
 * @param {object} knobs
 * @returns {string}
 */
export function profileSignature(knobs) {
  if (!knobs || typeof knobs !== 'object') return '';
  return Object.keys(knobs).sort().map((k) => `${k}=${knobs[k]}`).join('|');
}

/**
 * Create a feedback store.
 *
 * @param {object} [opts]
 * @param {number} [opts.maxEntries=1000] - bounded (harness guardrail #2).
 * @returns {object} the store
 */
export function createMemory(opts = {}) {
  const maxEntries = Math.max(1, opts.maxEntries || 1000);
  /** @type {Array<object>} */
  let entries = [];
  let seq = 0;

  const scoreOf = (r) => (r.score && typeof r.score.simMae === 'number') ? r.score.simMae : 0;
  const clone = (r) => ({ ...r, knobs: r.knobs ? { ...r.knobs } : null, score: r.score ? { ...r.score } : null });

  /**
   * Store one attempt. Losses are welcome (harness guardrail #5).
   * @param {object} e
   * @param {string} [e.imageHash] averageHash of the reference
   * @param {object} [e.knobs] the knob vector attempted
   * @param {object} [e.profile] the profile it produced (optional)
   * @param {object|number} e.score `{simMae,ssim,...}` or a bare simMae
   * @param {number} [e.rating=0] -1 reject · 0 unknown · +1 accept
   * @param {object} [e.meta]
   * @returns {object|null} the stored record, or null if invalid
   */
  function record(e) {
    if (!e || typeof e !== 'object' || e.score === undefined || e.score === null) return null;
    const score = typeof e.score === 'number' ? { simMae: e.score } : { ...e.score };
    const rec = {
      seq: seq++,
      imageHash: typeof e.imageHash === 'string' ? e.imageHash : null,
      knobs: e.knobs && typeof e.knobs === 'object' ? { ...e.knobs } : null,
      profile: e.profile || null,
      score,
      rating: typeof e.rating === 'number' ? e.rating : 0,
      meta: e.meta || null,
    };
    entries.push(rec);
    if (entries.length > maxEntries) entries.splice(0, entries.length - maxEntries);
    return clone(rec);
  }

  /**
   * Stored entries, optionally filtered.
   * @param {object} [filter] `{ imageHash?, rating?, minScore?, style? }`
   * @returns {Array<object>}
   */
  function list(filter) {
    let out = entries;
    if (filter) {
      if (filter.imageHash != null) out = out.filter((r) => r.imageHash === filter.imageHash);
      if (filter.rating != null) out = out.filter((r) => r.rating === filter.rating);
      if (filter.minScore != null) out = out.filter((r) => scoreOf(r) >= filter.minScore);
      if (filter.style != null) {
        out = out.filter((r) => r.profile && r.profile.global && r.profile.global.style === filter.style);
      }
    }
    return out.map(clone);
  }

  /**
   * Retrieval: rank stored entries by perceptual **similarity** to a query hash
   * (Hamming distance ascending), then by score descending, then insertion
   * order. Only entries within `maxDistance` are considered.
   *
   * @param {string} queryHash averageHash of the query reference
   * @param {object} [o]
   * @param {number} [o.limit=5]
   * @param {number} [o.maxDistance=16] bits
   * @returns {Array<{entry: object, distance: number}>}
   */
  function retrieve(queryHash, o = {}) {
    const limit = o.limit || 5;
    const maxDistance = o.maxDistance !== undefined ? o.maxDistance : 16;
    return entries
      .filter((r) => r.imageHash)
      .map((r) => ({ entry: clone(r), distance: queryHash ? hamming(queryHash, r.imageHash) : 0 }))
      .filter((r) => r.distance <= maxDistance)
      .sort((a, b) => (a.distance - b.distance) || (scoreOf(b.entry) - scoreOf(a.entry)) || (a.entry.seq - b.entry.seq))
      .slice(0, limit);
  }

  /**
   * The single best stored entry for a query reference, or null.
   * @param {string} queryHash
   * @param {object} [o] `{ maxDistance?, ... }`
   * @returns {object|null}
   */
  function best(queryHash, o = {}) {
    const r = retrieve(queryHash, { ...o, limit: 1 });
    return r.length ? r[0].entry : null;
  }

  /**
   * A warm start for the proposer: the knob vector of the closest stored entry,
   * shaped for `propose.searchProfile(base, image, { init })`. Null when nothing
   * is near enough or the nearest entry has no knobs.
   *
   * @param {string} queryHash
   * @param {object} [o] `{ maxDistance=12 }`
   * @returns {{init: object, from: number, distance: number, score: object}|null}
   */
  function warmStart(queryHash, o = {}) {
    const maxDistance = o.maxDistance !== undefined ? o.maxDistance : 12;
    const r = retrieve(queryHash, { limit: 1, maxDistance });
    if (!r.length || !r[0].entry.knobs) return null;
    return { init: { ...r[0].entry.knobs }, from: r[0].entry.seq, distance: r[0].distance, score: r[0].entry.score };
  }

  /** @returns {number} entries stored */
  function size() { return entries.length; }

  /** Empty the store. */
  function clear() { entries = []; seq = 0; }

  /** @returns {object} a JSON-serialisable snapshot (for a storage adapter) */
  function toJSON() { return { version: MEMORY_VERSION, entries: entries.map(clone) }; }

  /**
   * Load a snapshot from `toJSON()`. Rejects a wrong version or malformed shape.
   * @param {object} obj
   * @returns {boolean} true when loaded
   */
  function load(obj) {
    if (!obj || obj.version !== MEMORY_VERSION || !Array.isArray(obj.entries)) return false;
    entries = obj.entries.map((r, i) => ({
      seq: typeof r.seq === 'number' ? r.seq : i,
      imageHash: typeof r.imageHash === 'string' ? r.imageHash : null,
      knobs: r.knobs && typeof r.knobs === 'object' ? { ...r.knobs } : null,
      profile: r.profile || null,
      score: r.score && typeof r.score === 'object' ? { ...r.score } : { simMae: 0 },
      rating: typeof r.rating === 'number' ? r.rating : 0,
      meta: r.meta || null,
    }));
    seq = entries.reduce((m, r) => Math.max(m, r.seq + 1), 0);
    return true;
  }

  return { record, list, retrieve, best, warmStart, size, clear, toJSON, load };
}

export default {
  MEMORY_VERSION, HASH_GRID, averageHash, hamming, profileSignature, createMemory,
};
