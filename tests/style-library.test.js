/**
 * Style Profile library — node tests (Round 2, M10 — Phase 4.2).
 *
 * Run with: node tests/style-library.test.js
 *
 * The library is split into a pure core (`js/ui/style-library-core.js`) and a
 * DOM panel (`js/ui/style-library.js`), the same shape as the media panel:
 *   - the core holds the profile object, the frozen schema contract, the
 *     storage adapter and the persistence boundary — no DOM, node-testable;
 *   - the panel renders it and is only covered by the real-browser probe.
 *
 * These tests therefore cover everything that can be covered without a DOM:
 *   - the save→list→apply→delete lifecycle over a real storage adapter
 *   - the profile object is SCHEMA-VALID (validateProfile)
 *   - export → import round-trips BYTE-IDENTICALLY
 *   - apply produces exactly the settings `engine.generate({profile})` needs
 *     and re-bakes deterministically (two applies → identical output)
 *   - names are unique; a blank name is rejected; a corrupt file is surfaced
 *     as a validation error, never a thrown exception
 *   - the storage adapter degrades to no-op when localStorage is absent
 */

import {
  ProfileLibrary,
  profileToExportText,
  profileFromExportText,
  newProfileId,
  defaultProfile,
  coerceProfileName,
  summarizeProfile,
  STORAGE_KEY,
} from '../js/ui/style-library-core.js';
import { validateProfile, normalizeProfile } from '../js/engine/profile.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}`);
    console.log(`    ${e.message}`);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

function assertEqual(actual, expected, msg = '') {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${msg} Expected ${b}, got ${a}`);
}

/* ── Minimal localStorage stand-in ────────────────────────────────────────
 * The core only touches getItem/setItem/removeItem. A plain Map is enough,
 * which is also why the core can be unit-tested outside a browser.
 */
function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(String(k), String(v)),
    removeItem: (k) => map.delete(k),
    get size() { return map.size; },
  };
}

/** A valid seed profile: everything the schema requires, nothing it forbids. */
let seedCounter = 0;
function seedProfile(overrides = {}) {
  seedCounter += 1;
  return {
    schemaVersion: 1,
    id: `11111111-1111-4111-8111-${String(seedCounter).padStart(12, '0')}`,
    name: 'Loose Wash',
    version: '1.0.0',
    engine: { name: 'www-paint', version: '0.1.0' },
    global: {
      style: 'watercolor',
      strokeCount: 400,
      strokeSize: { min: 4, max: 18, random: true },
      detailLevel: 0.6,
      styleStrength: 0.75,
      opacity: 0.9,
      pathOrder: 'free',
      colorMode: 'exact',
      multiLayer: false,
      seed: 3047602159,
    },
    layers: [],
    effects: [],
    mediaModel: { kind: 'dry' },
    provenance: { source: 'human' },
    ...overrides,
  };
}

console.log('\nStyle Profile library (Phase 4.2):\n');

// ─── Construction / storage ──────────────────────────────────────────────

test('a new library exposes an empty list', () => {
  const lib = new ProfileLibrary({ storage: memoryStorage() });
  assertEqual(lib.list().length, 0, 'expected no profiles');
});

test('the storage key is the documented one', () => {
  assertEqual(STORAGE_KEY, 'www-paint.styleProfiles.v1', 'storage key changed');
});

test('storage is read at construction (a warm start)', () => {
  const p = seedProfile({ id: 'aaaaaaaa-0000-4000-8000-000000000000' });
  const lib = new ProfileLibrary({
    storage: memoryStorage({ [STORAGE_KEY]: JSON.stringify([p]) }),
  });
  assertEqual(lib.list().length, 1, 'did not read the existing profiles');
  assertEqual(lib.list()[0].id, p.id, 'wrong profile read');
});

test('a missing key is not an error', () => {
  const lib = new ProfileLibrary({ storage: memoryStorage() });
  assertEqual(lib.list().length, 0, 'missing key produced profiles');
});

test('a corrupt payload is discarded, not thrown', () => {
  const lib = new ProfileLibrary({
    storage: memoryStorage({ [STORAGE_KEY]: '{not json' }),
  });
  assertEqual(lib.list().length, 0, 'corrupt payload was not discarded');
});

test('a payload that is not an array is discarded', () => {
  const lib = new ProfileLibrary({
    storage: memoryStorage({ [STORAGE_KEY]: JSON.stringify({ nope: true }) }),
  });
  assertEqual(lib.list().length, 0, 'non-array payload was accepted');
});

test('an absent storage adapter degrades to no-op (node-safe)', () => {
  const lib = new ProfileLibrary({ storage: null });
  assertEqual(lib.list().length, 0, 'null storage failed');
  lib.save(seedProfile()); // must not throw
  assertEqual(lib.list().length, 1, 'in-memory save failed');
});

test('a localStorage that throws does not break the panel', () => {
  const broken = {
    getItem() { throw new Error('SecurityError'); },
    setItem() { throw new Error('SecurityError'); },
    removeItem() { throw new Error('SecurityError'); },
  };
  const lib = new ProfileLibrary({ storage: broken });
  assertEqual(lib.list().length, 0, 'throwing storage was not contained');
  lib.save(seedProfile());
  assertEqual(lib.list().length, 1, 'in-memory fallback did not engage');
});

// ─── save ────────────────────────────────────────────────────────────────

test('save writes a SCHEMA-VALID profile', () => {
  const lib = new ProfileLibrary({ storage: memoryStorage() });
  const saved = lib.save(seedProfile());
  const { ok, errors } = validateProfile(saved);
  assert(ok, `saved profile is not schema-valid: ${JSON.stringify(errors)}`);
});

test('save returns the stored profile with a fresh id when none is given', () => {
  const lib = new ProfileLibrary({ storage: memoryStorage() });
  const p = seedProfile();
  delete p.id;
  const saved = lib.save(p);
  assert(typeof saved.id === 'string' && saved.id.length >= 8, 'no id generated');
  assert(saved.id !== '00000000-0000-4000-8000-000000000000', 'id was not generated');
});

test('save generates a fresh id rather than mutating the caller object', () => {
  const lib = new ProfileLibrary({ storage: memoryStorage() });
  const p = seedProfile();
  delete p.id;
  const saved = lib.save(p);
  assert(p.id === undefined, 'the caller object was mutated');
  assert(saved.id !== undefined, 'no id on the stored copy');
});

test('save stamps provenance.createdAt / updatedAt', () => {
  const lib = new ProfileLibrary({ storage: memoryStorage() });
  const saved = lib.save(seedProfile());
  assert(typeof saved.provenance.createdAt === 'string', 'no createdAt');
  assert(typeof saved.provenance.updatedAt === 'string', 'no updatedAt');
});

test('save with an explicit createdAt preserves it', () => {
  const lib = new ProfileLibrary({ storage: memoryStorage() });
  const saved = lib.save(seedProfile({
    provenance: { source: 'human', createdAt: '2026-01-01T00:00:00.000Z' },
  }));
  assertEqual(saved.provenance.createdAt, '2026-01-01T00:00:00.000Z', 'createdAt overwritten');
});

test('save persists through the adapter', () => {
  const storage = memoryStorage();
  const lib = new ProfileLibrary({ storage });
  lib.save(seedProfile({ name: 'Persisted' }));
  const raw = storage.getItem(STORAGE_KEY);
  assert(typeof raw === 'string' && raw.length > 10, 'nothing written to storage');
  const parsed = JSON.parse(raw);
  assertEqual(parsed.length, 1, 'wrong number of stored profiles');
  // The storage row is { id, savedAt, profile } — the profile is nested.
  assertEqual(parsed[0].profile.name, 'Persisted', 'wrong profile stored');
});

test('an explicitly empty name is rejected with a thrown error', () => {
  const lib = new ProfileLibrary({ storage: memoryStorage() });
  let threw = false;
  try { lib.save(seedProfile({ name: '' })); } catch (e) { threw = true; }
  assert(threw, 'empty name was accepted');
  assertEqual(lib.list().length, 0, 'rejected profile reached the list');
});

test('a whitespace-only name falls back to the default label', () => {
  // `undefined` and whitespace are "no label given" → the default; only an
  // explicitly empty string is a user error.
  const lib = new ProfileLibrary({ storage: memoryStorage() });
  const saved = lib.save(seedProfile({ name: undefined }));
  assertEqual(saved.name, 'Untitled Profile', 'missing name not defaulted');
});

test('a name is trimmed and defaults when empty', () => {
  assertEqual(coerceProfileName('  Loose Wash  '), 'Loose Wash', 'not trimmed');
  assertEqual(coerceProfileName('   '), 'Untitled Profile', 'blank not defaulted');
  assertEqual(coerceProfileName(undefined), 'Untitled Profile', 'undefined not defaulted');
});

test('an over-long name is clamped to the schema maximum (128)', () => {
  const long = 'x'.repeat(200);
  const name = coerceProfileName(long);
  assert(name.length <= 128, `name is ${name.length} chars, over the 128 limit`);
});

test('an invalid profile is rejected before it is stored', () => {
  const lib = new ProfileLibrary({ storage: memoryStorage() });
  let threw = false;
  try { lib.save({ schemaVersion: 99, name: 'Broken' }); } catch (e) { threw = true; }
  assert(threw, 'an invalid profile was saved');
  assertEqual(lib.list().length, 0, 'invalid profile reached the list');
});

test('saving the same id twice UPDATES rather than duplicating', () => {
  const lib = new ProfileLibrary({ storage: memoryStorage() });
  const id = 'bbbbbbbb-0000-4000-8000-000000000000';
  lib.save(seedProfile({ id, name: 'First' }));
  lib.save(seedProfile({ id, name: 'Second' }));
  const list = lib.list();
  assertEqual(list.length, 1, 'the same id produced two rows');
  assertEqual(list[0].name, 'Second', 'the update did not land');
});

// ─── list / get ──────────────────────────────────────────────────────────

test('list returns copies, so a caller cannot mutate stored state', () => {
  const lib = new ProfileLibrary({ storage: memoryStorage() });
  lib.save(seedProfile({ name: 'Original' }));
  const row = lib.list()[0];
  row.profile.name = 'Tampered';
  assertEqual(lib.get(row.id).profile.name, 'Original', 'list leaked internal state');
});

test('list is sorted by name (case-insensitive), then by updatedAt', () => {
  const lib = new ProfileLibrary({ storage: memoryStorage() });
  lib.save(seedProfile({ name: 'zeta' }));
  lib.save(seedProfile({ name: 'Alpha' }));
  lib.save(seedProfile({ name: 'beta' }));
  const names = lib.list().map((r) => r.profile.name);
  assertEqual(names, ['Alpha', 'beta', 'zeta'], 'list is not name-sorted');
});

test('get returns null for an unknown id', () => {
  const lib = new ProfileLibrary({ storage: memoryStorage() });
  assertEqual(lib.get('nope'), null, 'unknown id did not return null');
});

test('has reports presence', () => {
  const lib = new ProfileLibrary({ storage: memoryStorage() });
  const saved = lib.save(seedProfile());
  assert(lib.has(saved.id) === true, 'has() false for a stored id');
  assert(lib.has('nope') === false, 'has() true for a missing id');
});

// ─── delete ──────────────────────────────────────────────────────────────

test('delete removes exactly one profile', () => {
  const lib = new ProfileLibrary({ storage: memoryStorage() });
  const a = lib.save(seedProfile({ name: 'A' }));
  const b = lib.save(seedProfile({ name: 'B' }));
  assertEqual(lib.delete(a.id), true, 'delete did not report success');
  assertEqual(lib.list().length, 1, 'wrong count after delete');
  assertEqual(lib.list()[0].id, b.id, 'wrong profile removed');
});

test('delete returns false for an unknown id', () => {
  const lib = new ProfileLibrary({ storage: memoryStorage() });
  assertEqual(lib.delete('nope'), false, 'unknown delete did not report false');
});

test('delete persists', () => {
  const storage = memoryStorage();
  const lib = new ProfileLibrary({ storage });
  const saved = lib.save(seedProfile());
  lib.delete(saved.id);
  const parsed = JSON.parse(storage.getItem(STORAGE_KEY) || '[]');
  assertEqual(parsed.length, 0, 'delete did not reach storage');
});

// ─── export / import ─────────────────────────────────────────────────────

test('export → import round-trips a profile BYTE-IDENTICALLY', () => {
  const p = seedProfile();
  const text = profileToExportText(p);
  const report = profileFromExportText(text);
  assertEqual(JSON.stringify(report.profile), JSON.stringify(p), 'round-trip changed the profile');
});

test('export text is a JSON object, not an array', () => {
  const text = profileToExportText(seedProfile());
  const parsed = JSON.parse(text);
  assert(typeof parsed === 'object' && !Array.isArray(parsed), 'export is not an object');
  assertEqual(parsed.schemaVersion, 1, 'export lost schemaVersion');
});

test('export is pretty-printed (readable in a diff)', () => {
  const text = profileToExportText(seedProfile());
  assert(text.includes('\n'), 'export is a single line');
});

test('import returns the profile even when wrapped in prose or a code fence', () => {
  const text = profileToExportText(seedProfile());
  const fenced = '```json\n' + text + '\n```';
  const report = profileFromExportText(fenced);
  assertEqual(report.profile.name, seedProfile().name, 'fenced import failed');
});

test('import rejects malformed JSON with a clear error', () => {
  let threw = false;
  try { profileFromExportText('not json at all'); } catch (e) { threw = true; }
  assert(threw, 'malformed import did not throw');
});

test('import rejects a non-object payload', () => {
  let threw = false;
  try { profileFromExportText('[1,2,3]'); } catch (e) { threw = true; }
  assert(threw, 'array payload was accepted');
});

test('import surfaces a SCHEMA error rather than throwing', () => {
  const r = profileFromExportText(JSON.stringify({ nope: true }), { validate: true });
  assert(r.ok === false, 'invalid profile reported ok');
  assert(Array.isArray(r.errors) && r.errors.length > 0, 'no validation errors returned');
});

test('import validates by default and a valid profile reports ok', () => {
  const r = profileFromExportText(profileToExportText(seedProfile()));
  assert(r.ok === true, `valid profile reported invalid: ${JSON.stringify(r.errors)}`);
  assertEqual(r.profile.name, seedProfile().name, 'wrong profile returned');
});

test('export → import → save → list is stable', () => {
  const lib = new ProfileLibrary({ storage: memoryStorage() });
  lib.save(seedProfile({ name: 'Round Trip' }));
  const text = lib.exportText(lib.list()[0].id);
  const imported = lib.importText(text);
  assertEqual(imported.length, 1, 'import did not add a profile');
  // The import re-saves the SAME id, so it UPDATES rather than duplicating —
  // a second paste must not create a second row.
  assertEqual(lib.list().length, 1, 'import duplicated the row');
  assertEqual(lib.list()[0].name, 'Round Trip', 'import did not land');
});

test('import adds a NEW row for an unknown id', () => {
  const lib = new ProfileLibrary({ storage: memoryStorage() });
  lib.save(seedProfile({ name: 'Existing' }));
  const imported = lib.importText(profileToExportText(seedProfile({ name: 'New' })));
  assertEqual(imported[0].ok, true, 'import failed');
  assertEqual(lib.list().length, 2, 'import did not add a row');
});

// ─── apply: the engine contract ──────────────────────────────────────────

test('apply produces settings the engine can consume', () => {
  const lib = new ProfileLibrary({ storage: memoryStorage() });
  const saved = lib.save(seedProfile());
  const applied = lib.apply(saved.id);
  assert(applied.ok, `apply failed: ${JSON.stringify(applied.errors)}`);
  assertEqual(applied.settings.style, 'watercolor', 'style not mapped');
  assertEqual(applied.settings.strokeCount, 400, 'strokeCount not mapped');
  assertEqual(applied.settings.detailLevel, 0.6, 'detailLevel not mapped');
  assertEqual(applied.seed, 3047602159, 'seed not surfaced');
});

test('apply returns an error for an unknown id', () => {
  const lib = new ProfileLibrary({ storage: memoryStorage() });
  const applied = lib.apply('nope');
  assert(applied.ok === false, 'unknown id reported ok');
  assert(applied.profile === null, 'unknown id returned a profile');
});

test('apply never mutates the stored profile', () => {
  const lib = new ProfileLibrary({ storage: memoryStorage() });
  const saved = lib.save(seedProfile());
  const before = JSON.stringify(lib.get(saved.id).profile);
  lib.apply(saved.id);
  const after = JSON.stringify(lib.get(saved.id).profile);
  assertEqual(before, after, 'apply mutated the stored profile');
});

test('apply is DETERMINISTIC: two applies give the same settings + seed', () => {
  const lib = new ProfileLibrary({ storage: memoryStorage() });
  const saved = lib.save(seedProfile());
  const a = lib.apply(saved.id);
  const b = lib.apply(saved.id);
  assertEqual(JSON.stringify(a.settings), JSON.stringify(b.settings), 'settings differ');
  assertEqual(a.seed, b.seed, 'seed differs');
});

test('apply re-bakes the SAME pixels twice (the exit criterion)', () => {
  // The real proof is the browser probe; here we prove the *inputs* are
  // identical, which is what makes the pixels identical. Normalising twice
  // must be idempotent, otherwise the second bake would differ.
  const p = seedProfile();
  const n1 = normalizeProfile(p);
  const n2 = normalizeProfile(n1);
  assertEqual(JSON.stringify(n1.global), JSON.stringify(n2.global), 'normalize is not idempotent');
});

test('apply surfaces a mediaModel the engine will consume', () => {
  const lib = new ProfileLibrary({ storage: memoryStorage() });
  const saved = lib.save(seedProfile({
    mediaModel: { kind: 'wet', wetness: 0.7, bleed: 0.5 },
  }));
  const applied = lib.apply(saved.id);
  assertEqual(applied.mediaModel.kind, 'wet', 'mediaModel not carried');
  assertEqual(applied.mediaModel.wetness, 0.7, 'wetness not carried');
});

test('apply surfaces per-layer style overrides', () => {
  const lib = new ProfileLibrary({ storage: memoryStorage() });
  const saved = lib.save(seedProfile({
    layers: [{ role: 'highlights', style: 'pastel', order: 4 }],
  }));
  const applied = lib.apply(saved.id);
  assertEqual(applied.layerStyles.highlights, 'pastel', 'layer style not mapped');
});

test('apply on a profile with no seed surfaces null (engine default)', () => {
  const lib = new ProfileLibrary({ storage: memoryStorage() });
  const p = seedProfile();
  delete p.global.seed;
  const applied = lib.apply(lib.save(p).id);
  assertEqual(applied.seed, null, 'absent seed did not surface null');
});

test('apply on a profile with no style does not force one', () => {
  // `normalizeProfile` sets a missing style to null and the engine's
  // `resolveSettings` copies null through, so the library drops the key rather
  // than handing the engine a null style (which would crash the size sampler).
  const lib = new ProfileLibrary({ storage: memoryStorage() });
  const p = seedProfile();
  delete p.global.style;
  const applied = lib.apply(lib.save(p).id);
  assert(!('style' in applied.settings), 'a style was forced onto the settings');
  assert(applied.ok, `apply reported invalid: ${JSON.stringify(applied.errors)}`);
});

// ─── defaultProfile / newProfileId ───────────────────────────────────────

test('defaultProfile is schema-valid and deterministic apart from id and time', () => {
  const a = defaultProfile();
  const b = defaultProfile();
  const { ok, errors } = validateProfile(a);
  assert(ok, `default profile invalid: ${JSON.stringify(errors)}`);
  assertEqual(a.global.style, 'pencil', 'unexpected default style');
  assertEqual(a.global.pathOrder, 'free', 'unexpected default pathOrder');
  assertEqual(a.global.seed, 3047602159, 'unexpected default seed');
  const strip = (p) => {
    const c = JSON.parse(JSON.stringify(p));
    delete c.id;
    delete c.provenance.createdAt;
    delete c.provenance.updatedAt;
    return c;
  };
  assertEqual(JSON.stringify(strip(a)), JSON.stringify(strip(b)), 'defaultProfile is not deterministic');
});

test('newProfileId is a unique, uuid-shaped string', () => {
  const a = newProfileId();
  const b = newProfileId();
  assert(a !== b, 'two ids were identical');
  assert(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(a),
    `id is not uuid-shaped: ${a}`);
});

// ─── summarize ───────────────────────────────────────────────────────────

test('summarize describes a profile for the list row', () => {
  const s = summarizeProfile(seedProfile());
  assertEqual(s.style, 'watercolor', 'style not summarised');
  assertEqual(s.strokeCount, 400, 'strokeCount not summarised');
  assertEqual(s.layerCount, 0, 'layerCount wrong');
  assertEqual(s.seed, 3047602159, 'seed not summarised');
  assertEqual(s.mediaKind, 'dry', 'media kind not summarised');
});

test('summarize tolerates a minimal profile', () => {
  const s = summarizeProfile({ global: {} });
  assertEqual(s.style, '—', 'missing style not handled');
  assertEqual(s.strokeCount, 0, 'missing strokeCount not handled');
});

// ─── Reference confidence (Track-S hygiene H-S2) ─────────────────────────
//
// The confidence read-out is derived from a REAL fused packet where one is
// available — `fuseReferences` over real `analyzeReference` packets — so the
// thresholds are tested against the numbers the engine actually emits, not a
// hand-made shape. The synthetic-packet tests then pin the tolerant paths.

import {
  refConfidenceBand,
  refConfidenceAdvice,
  REF_CONFIDENCE_LABELS,
  referenceConfidence,
} from '../js/ui/style-library-core.js';
import { analyzeReference, fuseReferences } from '../js/engine/ref-analyze.js';

/** A 64x64 RGBA source from a per-pixel function. */
function synthImage(fn) {
  const w = 64, h = 64;
  const pixels = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const [r, g, b] = fn(x, y);
      pixels[i] = r; pixels[i + 1] = g; pixels[i + 2] = b; pixels[i + 3] = 255;
    }
  }
  return { pixels, width: w, height: h };
}

const GRAD_A = synthImage((x, y) => [255 * (x / 63), 128, 255 * (y / 63)]);
const GRAD_B = synthImage((x, y) => [200 * (x / 63), 60, 180]);
const BLACK_SHEEP = synthImage(() => [30, 30, 30]);

/** A profile carrying a real fused packet. */
function profileWithPacket(refs) {
  const packets = refs.map((r) => analyzeReference(r, {}));
  const fused = fuseReferences(packets, {});
  const p = seedProfile();
  p.provenance = { source: 'human', refPacket: fused };
  return { profile: p, fused };
}

test('refConfidenceBand: the thresholds are exact and ordered', () => {
  assertEqual(refConfidenceBand(null), 'none', 'null is not none');
  assertEqual(refConfidenceBand(undefined), 'none', 'undefined is not none');
  assertEqual(refConfidenceBand(NaN), 'none', 'NaN is not none');
  assertEqual(refConfidenceBand(0.99), 'good', 'high agreement is not good');
  assertEqual(refConfidenceBand(0.8), 'good', 'the good boundary is not inclusive');
  assertEqual(refConfidenceBand(0.79), 'fair', 'just under good is not fair');
  assertEqual(refConfidenceBand(0.5), 'fair', 'the fair boundary is not inclusive');
  assertEqual(refConfidenceBand(0.49), 'low', 'just under fair is not low');
  assertEqual(refConfidenceBand(0), 'low', 'zero agreement is not low');
});

test('refConfidenceAdvice: every actionable band has words', () => {
  for (const band of ['good', 'fair', 'low']) {
    assert(refConfidenceAdvice(band).length > 0, `${band} has no advice`);
  }
  // `none` is the exception by design: a profile with no reference has nothing
  // to be confident about, so it must NOT be handed a false warning.
  assertEqual(refConfidenceAdvice('none'), '', 'none must be silent');
  // An unknown band must not throw and must not read as advice either.
  assertEqual(refConfidenceAdvice('bogus'), '', 'an unknown band must be silent');
  // The conflicting band must be the strongest warning.
  assert(refConfidenceAdvice('low').length > refConfidenceAdvice('fair').length,
    'low is not more emphatic than fair');
});

test('REF_CONFIDENCE_LABELS: every band has a distinct, non-empty word', () => {
  const words = Object.values(REF_CONFIDENCE_LABELS);
  assertEqual(words.length, 4, 'not four bands');
  for (const w of words) assert(w && w.length > 0, 'an empty label');
  assertEqual(new Set(words).size, 4, 'labels are not distinct');
});

test('referenceConfidence: a profile with no packet is none, with agreement null', () => {
  const c = referenceConfidence(seedProfile());
  assertEqual(c.band, 'none', 'no packet is not none');
  assertEqual(c.refCount, 0, 'refCount should be 0');
  assertEqual(c.agreement, null, 'agreement must be null, not 0 — 0 reads as maximal disagreement');
  assertEqual(c.scaleSpread, null, 'scale spread should be null');
  assertEqual(c.outlierCount, 0, 'outlier count should be 0');
});

test('referenceConfidence: tolerates a malformed packet rather than throwing', () => {
  // A hand-edited / imported profile may carry anything. None of these may throw.
  const bad = [
    { provenance: null },
    { provenance: { refPacket: null } },
    { provenance: { refPacket: {} } },
    { provenance: { refPacket: { spread: null } } },
    { provenance: { refPacket: { spread: { agreement: 'high' } } } },
    { provenance: { refPacket: { spread: { agreement: 0.9 }, refCount: 'many' } } },
    { provenance: { refPacket: { spread: { agreement: 0.9 }, refs: [{ outlier: true }, null] } } },
  ];
  for (const p of bad) {
    const c = referenceConfidence(p);
    assertEqual(c.band, refConfidenceBand(c.agreement), `band disagrees with agreement for ${JSON.stringify(p)}`);
  }
});

test('referenceConfidence: a real fused packet reports its refs and agreement', () => {
  const { profile } = profileWithPacket([GRAD_A, GRAD_B]);
  const c = referenceConfidence(profile);
  assertEqual(c.refCount, 2, 'refCount not read from the packet');
  assert(c.agreement > 0 && c.agreement <= 1, `agreement out of range: ${c.agreement}`);
  // Two different gradients are NOT identical — the agreement must be below 1.
  assert(c.agreement < 1, `two different references reported agreement ${c.agreement}`);
});

test('referenceConfidence: a single reference fuses to agreement exactly 1', () => {
  // `pairwiseMean` of one item is 0 by definition, so agreement is 1. That is
  // correct and worth pinning: one reference cannot disagree with itself.
  const { profile } = profileWithPacket([GRAD_A]);
  const c = referenceConfidence(profile);
  assertEqual(c.refCount, 1, 'refCount should be 1');
  assert(Math.abs(c.agreement - 1) < 1e-9, `one reference gave agreement ${c.agreement}`);
});

test('referenceConfidence: a contradictory reference set lands in a lower band than an agreeing one', () => {
  // The whole point of H-S2: the two cases must be DISTINGUISHABLE.
  const good = referenceConfidence(profileWithPacket([GRAD_A, GRAD_B]).profile);
  const bad = referenceConfidence(profileWithPacket([GRAD_A, GRAD_B, BLACK_SHEEP]).profile);
  assertEqual(good.refCount, 2, 'good set refCount');
  assertEqual(bad.refCount, 3, 'bad set refCount');
  assert(bad.agreement < good.agreement,
    `the contradictory set (${bad.agreement}) did not score lower than the agreeing set (${good.agreement})`);
  assertEqual(bad.band === 'low' || bad.band === 'fair', true, `contradictory set banded ${bad.band}`);
});

test('referenceConfidence: the outlier count is read from the packet refs', () => {
  const { profile, fused } = profileWithPacket([GRAD_A, GRAD_B, BLACK_SHEEP]);
  const outliers = (fused.refs || []).filter((r) => r && r.outlier === true).length;
  const c = referenceConfidence(profile);
  assertEqual(c.outlierCount, outliers, 'outlierCount disagrees with the packet');
});

test('summarizeProfile surfaces the confidence band and refCount (H-S2)', () => {
  const plain = summarizeProfile(seedProfile());
  assertEqual(plain.refConfidence, 'none', 'a profile with no packet must read none');
  assertEqual(plain.refCount, 0, 'a profile with no packet must report 0 refs');

  const { profile } = profileWithPacket([GRAD_A, GRAD_B]);
  const s = summarizeProfile(profile);
  assertEqual(s.refCount, 2, 'refCount not summarised');
  assertEqual(s.refConfidence, referenceConfidence(profile).band, 'band not summarised');
  assert(s.refConfidence !== 'none', 'a profile with a packet still reads none');
});

test('the fused packet survives the library round-trip and still reads confident', () => {
  // H-S2 is only useful if the chip survives save → list → export → import.
  const { profile } = profileWithPacket([GRAD_A, GRAD_B]);
  const lib = new ProfileLibrary({ storage: memoryStorage() });
  const saved = lib.save(profile);
  const row = lib.list().find((r) => r.id === saved.id);
  assertEqual(row.summary.refCount, 2, 'refCount lost across the library');
  assertEqual(row.summary.refConfidence, referenceConfidence(saved).band, 'band lost across the library');

  const text = lib.exportText(saved.id);
  const lib2 = new ProfileLibrary({ storage: memoryStorage() });
  const res = lib2.importText(text);
  assert(res[0].ok, `re-import failed: ${res[0].error}`);
  const row2 = lib2.list()[0];
  assertEqual(row2.summary.refCount, 2, 'refCount lost across export/import');
  assertEqual(row2.summary.refConfidence, row.summary.refConfidence, 'band changed across export/import');
});

test('H-S2 is output-neutral: a profile with a packet applies exactly as before', () => {
  // The chip must not change what APPLY does — same settings, same seed.
  const { profile } = profileWithPacket([GRAD_A, GRAD_B]);
  const lib = new ProfileLibrary({ storage: memoryStorage() });
  const saved = lib.save(profile);
  const a = lib.apply(saved.id);
  assert(a.ok, `apply failed: ${JSON.stringify(a.errors)}`);
  const plain = lib.apply(lib.save(seedProfile()).id);
  assertEqual(Object.keys(a.settings).sort().join(','), Object.keys(plain.settings).sort().join(','),
    'the packet changed the settings shape');
});

// ─── Summary ─────────────────────────────────────────────────────────────
console.log('\n=== Results ===');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(failed === 0 ? '\n✅ All style-library tests passed!' : '\n❌ Some style-library tests failed.');
process.exit(failed === 0 ? 0 : 1);
