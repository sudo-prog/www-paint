/**
 * Track R6 — the modular-engine switch, pure core (Mac half of the UI).
 *
 * R6's engine half already landed: `engine.js#generate()` plans with
 * `buildModularPlan()` when `settings.modular` is on, and
 * `generator.js` `DEFAULT_SETTINGS.modular = false`. What is missing is the
 * **UI half** — nothing in `js/ui/*` sets that flag, so the engine of record
 * is unreachable from the product (recorded in `docs/checkpoints/R6-be.md` §3
 * and `docs/MAC-TASKS.md`).
 *
 * This module holds the ONE piece of logic that needs unit-testing and cannot
 * be covered by a browser probe alone: mapping a Style Profile onto the switch.
 *
 * **Why a profile maps onto `modular` at all.** The bridge runs the modular
 * engine; the legacy `painter.js` path is the default. A profile therefore has
 * to opt in explicitly — and the opt-in is `global.modularEngine`, a NEW key
 * that is **not** in the frozen v1 schema (`js/engine/profile.js`). That is
 * deliberate: adding a schema key is a BE-owned change, and an unvalidated key
 * would either be dropped by `normalizeProfile` or leak into the engine
 * settings. So the rule here is strict and total:
 *
 *   - `true`  → the switch is ON
 *   - `false` → the switch is OFF
 *   - absent / non-boolean → **UNSET**, and an unset profile leaves the current
 *     switch state ALONE (it must not silently turn a user's toggle off)
 *
 * `applyProfile()` (`js/engine/profile.js`) maps `global` → engine settings
 * verbatim, so a profile that carries `modularEngine` also carries it into
 * `settings`. This core reads it from the SAME two places the engine does
 * (`settings.modular`, then the profile's own key), so the shim and the engine
 * can never disagree about which path a generate() will take.
 *
 * Pure: no DOM, no engine import, no RNG → node-testable.
 *
 * @module modular-switch-core
 */

/** The profile key this core understands. Reported, never written. */
export const PROFILE_KEY = 'modularEngine';

/** The engine setting this core drives. */
export const SETTINGS_KEY = 'modular';

/**
 * Resolve the switch from a profile's `global` block.
 *
 * Strict boolean on purpose: `'true'` (a string) is UNSET, because a string
 * would arrive via JSON from a hand-edited export and silently enable an
 * opt-in the author did not choose. An absent key is UNSET, not `false` —
 * "no opinion" and "off" are different and the UI must not conflate them.
 *
 * @param {*} value - `profile.global.modularEngine`
 * @returns {boolean|null} `true` / `false` / `null` (unset)
 */
export function profileModularFlag(value) {
  if (value === true) return true;
  if (value === false) return false;
  return null;
}

/**
 * The switch state a `generate()` call will actually use.
 *
 * Mirrors `engine.js#generate()`: an explicit `opts.modular` wins, then
 * `settings.modular`. Here the caller is the shim, which passes the settings
 * object it is about to hand to the engine, so this is the prediction the UI
 * shows.
 *
 * @param {object} settings - engine settings (or a profile-applied view of them)
 * @param {object} [profile] - a normalised Style Profile, or null
 * @returns {boolean} effective switch
 */
export function effectiveModular(settings = {}, profile = null) {
  const s = settings || {};
  if (s[SETTINGS_KEY] !== undefined && s[SETTINGS_KEY] !== null) {
    return !!s[SETTINGS_KEY];
  }
  const g = profile && typeof profile === 'object' ? profile.global : null;
  if (g && typeof g === 'object') {
    const v = profileModularFlag(g[PROFILE_KEY]);
    if (v !== null) return v;
  }
  return false;
}

/**
 * Merge a profile's switch opinion into a settings object.
 *
 * Returns a NEW object (never mutates). Two rules, both deliberate:
 *
 *   - an **UNSET** profile key copies nothing, so the caller's existing value
 *     survives — this is the half that makes "a profile with no opinion does not
 *     reset the user's toggle" true;
 *   - an explicit `settings.modular` **wins** over the profile's opinion, which
 *     is the same precedence `engine.js#generate()` applies. The UI toggle is
 *     therefore authoritative: a profile cannot silently switch the engine out
 *     from under a user who chose one.
 *
 * @param {object} settings - current engine settings
 * @param {object} [profile] - a normalised Style Profile, or null
 * @returns {object} settings with the flag resolved
 */
export function applyProfileModular(settings = {}, profile = null) {
  const out = { ...(settings || {}) };
  if (out[SETTINGS_KEY] !== undefined && out[SETTINGS_KEY] !== null) return out;
  const g = profile && typeof profile === 'object' ? profile.global : null;
  if (g && typeof g === 'object') {
    const v = profileModularFlag(g[PROFILE_KEY]);
    if (v !== null) out[SETTINGS_KEY] = v;
  }
  return out;
}

/** @returns {boolean} whether a profile declares the switch at all. */
export function profileDeclaresModular(profile) {
  const g = profile && typeof profile === 'object' ? profile.global : null;
  return !!(g && typeof g === 'object' && profileModularFlag(g[PROFILE_KEY]) !== null);
}

/** Human label for the toggle's state — one place, so the UI cannot drift. */
export function modularLabel(on) {
  return on ? 'Modular engine' : 'Legacy engine';
}

export default {
  PROFILE_KEY, SETTINGS_KEY, profileModularFlag, effectiveModular,
  applyProfileModular, profileDeclaresModular, modularLabel,
};
