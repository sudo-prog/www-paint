/**
 * Track R6 — the modular-engine switch, node tests.
 *
 * Run with: node tests/modular-switch.test.js
 *
 * The switch's ENGINE half is already pinned by `tests/engine.test.js` (the
 * default is off) and `scripts/modular-switch-probe.cjs` (both paths paint).
 * This suite pins the **UI half's algebra**, which no browser probe can cover
 * exhaustively because it is the logic that decides *which* engine a profile
 * asks for:
 *
 *   - the profile key is strict: only a real boolean counts; `'true'`, `1` and
 *     an absent key are all UNSET (a hand-edited export must not silently
 *     enable an opt-in)
 *   - UNSET leaves the caller's current switch alone — the half that makes "a
 *     profile with no opinion does not reset the user's toggle" true
 *   - an explicit setting wins over a profile's opinion, matching
 *     `engine.js#generate()`'s own precedence
 *   - the merged settings object is NEW (the caller's object is never mutated)
 *   - after merging, reading the merged settings alone gives the same answer
 *     as reading the original settings WITH the profile (no opinion is lost)
 */

import {
  PROFILE_KEY, SETTINGS_KEY, profileModularFlag, effectiveModular,
  applyProfileModular, profileDeclaresModular, modularLabel,
} from '../js/ui/modular-switch-core.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  \u2713 ${name}`);
  } catch (e) {
    failed++;
    console.log(`  \u2717 ${name}\n      ${e.message}`);
  }
}
function assert(cond, msg = 'assertion failed') {
  if (!cond) throw new Error(msg);
}
function assertEqual(actual, expected, msg = '') {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${msg} Expected ${b}, got ${a}`);
}

const profile = (v) => ({ global: v === undefined ? {} : { [PROFILE_KEY]: v } });

/* ── Strictness ─────────────────────────────────────────────────────────── */

test('a real true is ON', () => assertEqual(profileModularFlag(true), true));
test('a real false is OFF', () => assertEqual(profileModularFlag(false), false));
test('an absent key is UNSET, not OFF', () => assertEqual(profileModularFlag(undefined), null));
test('the string "true" is UNSET (no silent opt-in)', () => assertEqual(profileModularFlag('true'), null));
test('the number 1 is UNSET', () => assertEqual(profileModularFlag(1), null));
test('null is UNSET', () => assertEqual(profileModularFlag(null), null));

/* ── effectiveModular ───────────────────────────────────────────────────── */

test('no setting and no profile opinion \u2192 OFF (the shipped default)', () => {
  assertEqual(effectiveModular({}, null), false);
});
test('settings.modular=true wins over a profile that says false', () => {
  assertEqual(effectiveModular({ [SETTINGS_KEY]: true }, profile(false)), true);
});
test('settings.modular=false wins over a profile that says true', () => {
  assertEqual(effectiveModular({ [SETTINGS_KEY]: false }, profile(true)), false);
});
test('a profile opinion is used when the setting is absent', () => {
  assertEqual(effectiveModular({}, profile(true)), true);
  assertEqual(effectiveModular({}, profile(false)), false);
});
test('a non-boolean setting is coerced, never thrown', () => {
  assertEqual(effectiveModular({ [SETTINGS_KEY]: 'yes' }, null), true);
  assertEqual(effectiveModular({ [SETTINGS_KEY]: 0 }, profile(true)), false);
});
test('a null setting falls through to the profile', () => {
  assertEqual(effectiveModular({ [SETTINGS_KEY]: null }, profile(true)), true);
});

/* ── applyProfileModular ────────────────────────────────────────────────── */

test('an UNSET profile copies nothing \u2014 the toggle survives', () => {
  assertEqual(applyProfileModular({ [SETTINGS_KEY]: true }, profile(undefined)), { [SETTINGS_KEY]: true });
  assertEqual(applyProfileModular({ [SETTINGS_KEY]: false }, profile('true')), { [SETTINGS_KEY]: false });
});
test('an explicit profile opinion is written when the setting is absent', () => {
  assertEqual(applyProfileModular({}, profile(true)), { [SETTINGS_KEY]: true });
  assertEqual(applyProfileModular({}, profile(false)), { [SETTINGS_KEY]: false });
});
test('the caller\u2019s object is NOT mutated', () => {
  const src = {};
  const out = applyProfileModular(src, profile(false));
  assertEqual(src[SETTINGS_KEY], undefined, 'source must be untouched');
  assertEqual(out[SETTINGS_KEY], false);
  assert(out !== src, 'a new object is returned');
});
test('other settings survive the merge', () => {
  const out = applyProfileModular({ style: 'ink', strokeCount: 250 }, profile(true));
  assertEqual(out.style, 'ink');
  assertEqual(out.strokeCount, 250);
  assertEqual(out[SETTINGS_KEY], true);
});
test('a null profile is a no-op', () => {
  assertEqual(applyProfileModular({ [SETTINGS_KEY]: true }, null), { [SETTINGS_KEY]: true });
});

/* ── The two functions cannot disagree ──────────────────────────────────── */

test('a DECLARED setting always wins over a profile opinion (the engine\u2019s precedence)', () => {
  // `engine.js#generate()` reads `settings.modular` and ignores the profile's
  // key when it is set, so `applyProfileModular` must not override it. This is
  // what keeps the UI toggle authoritative over a profile.
  assertEqual(applyProfileModular({ [SETTINGS_KEY]: true }, profile(false)), { [SETTINGS_KEY]: true });
  assertEqual(applyProfileModular({ [SETTINGS_KEY]: false }, profile(true)), { [SETTINGS_KEY]: false });
});

test('effectiveModular agrees with applyProfileModular on every combination', () => {
  // The invariant: after merging a profile into the settings, reading the
  // MERGED settings alone must give the same answer as reading the originals
  // with the profile. The merge is therefore lossless — it never drops an
  // opinion and never invents one, and a declared setting stays authoritative.
  const settingsCases = [
    {},
    { [SETTINGS_KEY]: true },
    { [SETTINGS_KEY]: false },
    { [SETTINGS_KEY]: null },
  ];
  const profileCases = [null, profile(undefined), profile(true), profile(false), profile('true')];
  for (const s of settingsCases) {
    for (const p of profileCases) {
      const withProfile = effectiveModular(s, p);
      const merged = applyProfileModular(s, p);
      const mergedOnly = effectiveModular(merged, null);
      assertEqual(mergedOnly, withProfile,
        `disagreement for ${JSON.stringify(s)} / ${JSON.stringify(p)}`);
    }
  }
});

/* ── Reporting ──────────────────────────────────────────────────────────── */

test('profileDeclaresModular is true only for a real boolean', () => {
  assertEqual(profileDeclaresModular(profile(true)), true);
  assertEqual(profileDeclaresModular(profile(false)), true);
  assertEqual(profileDeclaresModular(profile(undefined)), false);
  assertEqual(profileDeclaresModular(profile('true')), false);
  assertEqual(profileDeclaresModular(null), false);
});

test('labels are distinct and non-empty', () => {
  assert(modularLabel(true) !== modularLabel(false), 'labels differ');
  assert(modularLabel(true).length > 0 && modularLabel(false).length > 0);
});

/* ── The frozen key names ───────────────────────────────────────────────── */

test('the profile key is modularEngine and the setting key is modular', () => {
  assertEqual(PROFILE_KEY, 'modularEngine');
  assertEqual(SETTINGS_KEY, 'modular');
});

console.log(`\n=== Track R6 modular switch: Passed ${passed}  Failed ${failed} ===`);
process.exit(failed ? 1 : 0);
