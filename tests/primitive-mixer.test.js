/**
 * Stroke-language mixer — node tests (Track-S S5 / M16 — the Mac half).
 *
 * Run with: node tests/primitive-mixer.test.js
 *
 * The mixer is split like the media panel and the Style library:
 *   - `js/ui/primitive-mixer-core.js` — the pure profile ↔ mix translation and
 *     the read-out. No DOM; covered fully here.
 *   - `js/ui/primitive-mixer.js` — the DOM section, covered by the real-browser
 *     probe (`scripts/primitive-mixer-probe.cjs`).
 *
 * What is pinned here is exactly what the M16 brief promises:
 *   - a mix ↔ six slider values, clamped to [0,1] and snapped to 0.05,
 *   - read / write a mix at `global` / `layer` / `pass` (most specific wins),
 *   - writing is NON-mutating and NEVER invents a `primitives` key — a profile
 *     with no mix stays byte-identical (the S5 engine guarantee, end to end),
 *   - the read-out reports the canonical weights, the dominant primitive and the
 *     resolved `effectiveStyle`,
 *   - validation errors keep their `path` so the UI can point at a control.
 */

import {
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
} from '../js/ui/primitive-mixer-core.js';
import { defaultProfile } from '../js/ui/style-library-core.js';
import { validateProfile, normalizeProfile, applyProfile } from '../js/engine/profile.js';
import { PRIMITIVE_IDS, PRIMITIVES, effectiveStyle } from '../js/engine/primitives.js';

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

const seedProfile = (extra = {}) => ({ ...defaultProfile(), ...extra });

/* ── Constants ─────────────────────────────────────────────────────────── */

test('the mixer mirrors the S5 levels and the 0.05 step', () => {
  assertEqual(MIXER_LEVELS, ['global', 'layer', 'pass'], 'levels wrong');
  assertEqual(WEIGHT_STEP, 0.05, 'step wrong');
  assertEqual(levelLabel('global'), 'Global', 'label global');
  assertEqual(levelLabel('layer'), 'Layer', 'label layer');
  assertEqual(levelLabel('pass'), 'Pass', 'label pass');
});

/* ── Slider ↔ mix ──────────────────────────────────────────────────────── */

test('sliderWeight clamps to [0,1] and snaps to the step', () => {
  assertEqual(sliderWeight(-3), 0, 'negative not clamped');
  assertEqual(sliderWeight(9), 1, 'over-one not clamped');
  assertEqual(sliderWeight(0.74), 0.75, 'not snapped up');
  assertEqual(sliderWeight(0.72), 0.7, 'not snapped down');
  assertEqual(sliderWeight(NaN), 0, 'NaN not zeroed');
  assertEqual(sliderWeight(''), 0, 'empty not zeroed');
  assertEqual(sliderWeight(undefined), 0, 'undefined not zeroed');
});

test('mixFromSliders keeps only positive weights', () => {
  const mix = mixFromSliders({ 'wet-wash': 0.75, hatch: 0.25, bristle: 0, smudge: 0 });
  assertEqual(mix, { 'wet-wash': 0.75, hatch: 0.25 }, 'zeroes not dropped');
  assertEqual(mixFromSliders({}), {}, 'empty values not empty mix');
  assertEqual(mixFromSliders({ 'dry-stamp': -1 }), {}, 'negative kept');
});

test('slidersFromMix returns canonical weights, absent ids omitted', () => {
  const s = slidersFromMix({ hatch: 0.25, 'wet-wash': 0.75 });
  assertEqual(s, { 'wet-wash': 0.75, hatch: 0.25 }, 'not canonical');
  assertEqual(slidersFromMix(null), {}, 'null not empty');
});

/* ── Levels & targets ──────────────────────────────────────────────────── */

test('levelTargets reads layer roles and pass ids', () => {
  const p = seedProfile({
    layers: [{ role: 'highlights' }, { role: 'shadows' }],
    passes: [{ id: 'masses' }, { id: 'accents' }],
  });
  assertEqual(levelTargets(p), { layers: ['highlights', 'shadows'], passes: ['masses', 'accents'] }, 'targets wrong');
  assertEqual(levelTargets(null), { layers: [], passes: [] }, 'null not empty');
});

test('hasTargetAtLevel: global always, layer/pass need a real target', () => {
  const p = seedProfile({ layers: [{ role: 'highlights' }], passes: [{ id: 'masses' }] });
  assert(hasTargetAtLevel(p, { level: 'global' }), 'global not always available');
  assert(hasTargetAtLevel(p, { level: 'layer', layerRole: 'highlights' }), 'existing layer not found');
  assert(!hasTargetAtLevel(p, { level: 'layer', layerRole: 'nope' }), 'missing layer reported present');
  assert(hasTargetAtLevel(p, { level: 'pass', passId: 'masses' }), 'existing pass not found');
  assert(!hasTargetAtLevel(p, { level: 'pass', passId: 'nope' }), 'missing pass reported present');
});

/* ── Read / write round-trip ───────────────────────────────────────────── */

test('write → read round-trips a global mix, canonical and summing to 1', () => {
  const p = seedProfile();
  const written = writeMixAtLevel(p, { level: 'global' }, { 'wet-wash': 3, hatch: 1 });
  const back = readMixAtLevel(written, { level: 'global' });
  assertEqual(back, { 'wet-wash': 0.75, hatch: 0.25 }, 'round-trip not normalised');
  const sum = Object.values(back).reduce((a, b) => a + b, 0);
  assert(Math.abs(sum - 1) < 1e-9, `does not sum to 1: ${sum}`);
});

test('write is NON-mutating', () => {
  const p = seedProfile();
  const before = JSON.stringify(p);
  writeMixAtLevel(p, { level: 'global' }, { hatch: 1 });
  assertEqual(JSON.stringify(p), before, 'the input profile was mutated');
});

test('an EMPTY mix removes the key — no `primitives` key invented', () => {
  const p = seedProfile();
  const withMix = writeMixAtLevel(p, { level: 'global' }, { hatch: 1 });
  assert('primitives' in withMix.global, 'mix was not written');
  const cleared = writeMixAtLevel(withMix, { level: 'global' }, {});
  assert(!('primitives' in cleared.global), 'empty mix left an invented key');
  assertEqual(JSON.stringify(cleared), JSON.stringify(p), 'cleared profile != original');
});

test('a default profile written with an empty mix is byte-identical', () => {
  const p = defaultProfile();
  const out = writeMixAtLevel(p, { level: 'global' }, {});
  assertEqual(JSON.stringify(out), JSON.stringify(p), 'no-op write changed the profile');
});

test('determinism: the same write twice is byte-identical', () => {
  const p = seedProfile();
  const a = writeMixAtLevel(p, { level: 'global' }, { spatter: 0.4, bristle: 0.6 });
  const b = writeMixAtLevel(p, { level: 'global' }, { bristle: 0.6, spatter: 0.4 });
  assertEqual(JSON.stringify(a), JSON.stringify(b), 'key order leaked into the output');
});

test('layer and pass levels write where the target exists', () => {
  const p = seedProfile({ layers: [{ role: 'highlights' }], passes: [{ id: 'masses' }] });
  const withLayer = writeMixAtLevel(p, { level: 'layer', layerRole: 'highlights' }, { hatch: 1 });
  assertEqual(withLayer.layers[0].primitives, { hatch: 1 }, 'layer mix not written');
  const withPass = writeMixAtLevel(p, { level: 'pass', passId: 'masses' }, { 'wet-wash': 1 });
  assertEqual(withPass.passes[0].primitives, { 'wet-wash': 1 }, 'pass mix not written');
  // Precedence: reading each level back returns its own mix.
  assertEqual(readMixAtLevel(withLayer, { level: 'layer', layerRole: 'highlights' }), { hatch: 1 }, 'layer read wrong');
  assertEqual(readMixAtLevel(withPass, { level: 'pass', passId: 'masses' }), { 'wet-wash': 1 }, 'pass read wrong');
});

test('writing at a level with NO target is a no-op', () => {
  const p = seedProfile();
  const before = JSON.stringify(p);
  const out = writeMixAtLevel(p, { level: 'layer', layerRole: 'highlights' }, { hatch: 1 });
  assertEqual(JSON.stringify(out), before, 'a mix was written to a non-existent layer');
  const out2 = writeMixAtLevel(p, { level: 'pass', passId: 'masses' }, { hatch: 1 });
  assertEqual(JSON.stringify(out2), before, 'a mix was written to a non-existent pass');
});

/* ── Read-out ──────────────────────────────────────────────────────────── */

test('describeMix reports weights, dominant and effectiveStyle', () => {
  const d = describeMix({ 'wet-wash': 0.75, hatch: 0.25 }, 'pencil');
  assert(!d.isEmpty, 'reported empty');
  assertEqual(d.dominant, 'wet-wash', 'dominant wrong');
  assertEqual(d.dominantLabel, 'Wet wash', 'dominant label wrong');
  assertEqual(d.effectiveStyle, 'wash', 'effectiveStyle wrong');
  assertEqual(d.effectiveStyle, PRIMITIVES['wet-wash'].style, 'effectiveStyle != primitive style');
  assertEqual(d.entries.map((e) => e.percent), [75, 25], 'percentages wrong');
  assert(d.readout.includes('Wet wash 75%'), `readout missing weight: ${d.readout}`);
  assert(d.readout.includes('wash'), `readout missing style: ${d.readout}`);
  assert(d.valid, 'a valid mix reported invalid');
  assertEqual(d.errors, [], 'errors on a valid mix');
});

test('describeMix on an empty mix falls back to the profile style', () => {
  const d = describeMix({}, 'pencil');
  assert(d.isEmpty, 'empty mix not reported empty');
  assertEqual(d.dominant, null, 'empty mix had a dominant');
  // No mix → the effective style IS the profile's own style (the pre-S5 path).
  assertEqual(d.effectiveStyle, 'pencil', 'empty mix did not fall back to the profile style');
  assert(d.readout.includes('pencil'), `readout did not name the fallback: ${d.readout}`);
  assert(d.valid, 'empty mix reported invalid');
});

test('effectiveStyle(empty, fallback) is the fallback — the pre-S5 path', () => {
  assertEqual(effectiveStyle({}, 'graphite'), 'graphite', 'empty mix did not fall back');
});

test('an unknown primitive in a declared mix is a real validation error', () => {
  const d = describeMix({ 'not-a-primitive': 1 });
  assert(!d.valid, 'unknown id not flagged');
  assert(d.errors.length >= 1, 'no error emitted');
  assert(d.errors.some((e) => e.path.includes('not-a-primitive')), `path missing the id: ${JSON.stringify(d.errors)}`);
});

/* ── End-to-end through the frozen schema ──────────────────────────────── */

test('a profile carrying a mixer mix is schema-VALID and applies', () => {
  const p = seedProfile();
  const withMix = writeMixAtLevel(p, { level: 'global' }, { 'wet-wash': 3, hatch: 1 });
  const { ok, errors } = validateProfile(withMix);
  assert(ok, `profile invalid: ${JSON.stringify(errors)}`);
  const applied = applyProfile(normalizeProfile(withMix));
  assertEqual(applied.primitives.global, { 'wet-wash': 0.75, hatch: 0.25 }, 'applyProfile did not expose the mix');
  assertEqual(applied.primitives.effectiveStyle, 'wash', 'effectiveStyle lost through apply');
  assertEqual(applied.primitives.layers, {}, 'layers should be empty');
  assertEqual(applied.primitives.passes, {}, 'passes should be empty');
});

test('profilePrimitives surfaces the declared mix at every level', () => {
  const p = seedProfile({
    layers: [{ role: 'highlights', primitives: { hatch: 1 } }],
    passes: [{ id: 'masses', primitives: { 'wet-wash': 1 } }],
    global: { ...defaultProfile().global, primitives: { spatter: 1 } },
  });
  const pr = profilePrimitives(p);
  assertEqual(pr.global, { spatter: 1 }, 'global mix wrong');
  assertEqual(pr.layers, { highlights: { hatch: 1 } }, 'layer mix wrong');
  assertEqual(pr.passes, { masses: { 'wet-wash': 1 } }, 'pass mix wrong');
  // With exactly ONE pass, `profileEffectiveStyle` resolves that pass (S5
  // precedence: pass > layer > global) → wet-wash → wash.
  assertEqual(pr.effectiveStyle, PRIMITIVES['wet-wash'].style, 'effectiveStyle wrong');
});

test('a fresh profile declares no primitives anywhere', () => {
  const pr = profilePrimitives(defaultProfile());
  assertEqual(pr.global, null, 'a fresh profile declared a global mix');
  assertEqual(pr.layers, {}, 'a fresh profile declared a layer mix');
  assertEqual(pr.passes, {}, 'a fresh profile declared a pass mix');
  // No mix → the effective style is the profile's own `global.style` (pencil).
  assertEqual(pr.effectiveStyle, 'pencil', 'a fresh profile resolved the wrong style');
});

/* ── Summary ───────────────────────────────────────────────────────────── */
console.log('\n=== Results ===');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(failed === 0 ? '\n✅ All primitive-mixer tests passed!' : '\n❌ Some primitive-mixer tests failed.');
process.exit(failed === 0 ? 0 : 1);
