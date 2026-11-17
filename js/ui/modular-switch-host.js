/**
 * Track R6 — the modular-engine switch, UI shim (Mac half).
 *
 * `engine.js#generate()` already honours `settings.modular`, but nothing in the
 * UI sets it, so the engine of record (`optimizer.js`, Track R R1–R5) is
 * unreachable from the product. `js/ui/app.js` is ThinkPad-owned
 * (`HANDOFF.md` §6), so this shim monkey-patches the App instance the host
 * exposes (`window._wwwPaint`) — the same pattern as `media-host.js` /
 * `style-library-host.js` / `react-host.js`.
 *
 * What it does, and only this:
 *   1. binds the additive nav control `#btn-modular-engine`;
 *   2. flips `app.engine.settings.modular` AND mirrors it into
 *      `app.controls.settings` + `app.controls._syncToUI()`, so the controls
 *      panel cannot overwrite the flag on the next `getSettings()`;
 *   3. exposes `app.setModularEngine(bool)` / `app.toggleModularEngine()`;
 *   4. reflects a profile's own `global.modularEngine` opinion when a profile
 *      is applied (see `modular-switch-core.js` for the strict rule).
 *
 * **Off by default and byte-identical.** The flag starts `false`
 * (`generator.js` `DEFAULT_SETTINGS.modular`), so the shim's first act is to
 * read the engine's own value and paint the button to match — it never asserts
 * a state the engine does not already hold.
 *
 * @module modular-switch-host
 */

import {
  PROFILE_KEY, SETTINGS_KEY, effectiveModular, applyProfileModular,
  profileDeclaresModular, modularLabel,
} from './modular-switch-core.js';

/** The additive nav control. Mac-owned, present in `index.html`. */
export const MODULAR_TOGGLE_ID = 'btn-modular-engine';

/**
 * Paint the toggle from the engine's REAL state.
 *
 * Reads the engine, never a local copy: a stale boolean here is exactly the
 * class of bug that makes a toggle lie about which engine produced the last
 * painting.
 *
 * Deliberately does **not** write the status bar. `app._setStatus` REPLACES the
 * status bar's innerHTML to build its own `status-item` spans, which destroys
 * the `#status-message` node `index.html` ships and that the Maestro
 * `www-paint-desktop-regression` flow asserts on ("Ready"). The toggle has a
 * visible label and an `aria-pressed` state; that is its feedback.
 *
 * @param {object} app
 * @param {boolean} on
 */
function paint(app, on) {
  const btn = document.getElementById(MODULAR_TOGGLE_ID);
  if (btn) {
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.classList.toggle('nav-btn--active', !!on);
    const label = btn.querySelector('.btn-label');
    if (label) label.textContent = on ? 'Modular' : 'Painter';
  }
  app._modularEngine = !!on;
}

/**
 * Apply the switch to every place the app reads it from.
 *
 * `app.controls.settings` matters: `app.generate()` calls
 * `controls.getSettings()` and then `engine.setSettings(...)`, so a flag set
 * only on the engine would be **overwritten back to false** on the next
 * generate. Both are written, and the controls panel is re-synced.
 *
 * @param {object} app
 * @param {boolean} on
 */
function writeSwitch(app, on) {
  const engine = app?.engine;
  if (engine?.settings) engine.settings[SETTINGS_KEY] = !!on;
  const controls = app?.controls;
  if (controls?.settings) {
    controls.settings[SETTINGS_KEY] = !!on;
    if (typeof controls._syncToUI === 'function') controls._syncToUI();
  }
  paint(app, !!on);
}

/**
 * Reflect a profile's switch opinion after the library applies it.
 *
 * The library writes the profile's settings straight into
 * `engine.settings`; this re-reads the profile's OWN key so a profile that
 * declares `global.modularEngine` wins, and a profile that does not leaves the
 * user's toggle exactly where it was.
 *
 * @param {object} app
 * @param {object} result - the library's apply result (`{ok, profile, settings}`)
 */
function applyProfileOpinion(app, result) {
  // Prefer the profile the library actually normalised and applied; fall back
  // to the engine's stored one. A profile that declares nothing is a no-op.
  const profile = result?.profile ?? app?.engine?.settings?.profile ?? null;
  if (!profileDeclaresModular(profile)) return false;
  const next = applyProfileModular(app?.engine?.settings ?? {}, profile);
  writeSwitch(app, !!next[SETTINGS_KEY]);
  return true;
}

/**
 * Attach the modular-engine switch to a host App instance. Idempotent.
 *
 * @param {object} app - the App instance (`window._wwwPaint`)
 * @returns {boolean} whether the toggle was bound
 */
export function attachModularSwitch(app) {
  if (!app) return false;
  const btn = document.getElementById(MODULAR_TOGGLE_ID);
  if (!btn) {
    console.warn(`[modular-switch-host] #${MODULAR_TOGGLE_ID} not found — add it to index.html`);
    return false;
  }
  if (btn.dataset.modularBound) return true;

  // Seed from the ENGINE, not from a default: the button must describe the
  // state the last generate() actually used.
  const initial = effectiveModular(app.engine?.settings ?? {}, app.engine?.settings?.profile ?? null);
  writeSwitch(app, initial);
  app._modularEngine = initial;

  app.setModularEngine = function setModularEngine(on) {
    writeSwitch(app, !!on);
  };
  app.toggleModularEngine = function toggleModularEngine() {
    writeSwitch(app, !app._modularEngine);
    return app._modularEngine;
  };

  btn.dataset.modularBound = 'true';
  btn.addEventListener('click', () => {
    app.toggleModularEngine?.();
  });

  // A profile apply can carry its own opinion. The vanilla library host calls
  // `app._reactLibraryRows` / a profile-applied hook; the React surface calls
  // `host.styleProfileApplied`. Both land here via this one hook, and a host
  // that has neither simply never fires it.
  if (typeof app._modularProfileApplied !== 'function') {
    app._modularProfileApplied = applyProfileOpinion;
  }

  return true;
}

export { effectiveModular, PROFILE_KEY, SETTINGS_KEY, modularLabel };

export default { attachModularSwitch, MODULAR_TOGGLE_ID };
