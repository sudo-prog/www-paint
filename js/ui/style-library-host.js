/**
 * style-library-host.js — Mac-owned shim that hosts the Style Profile library
 * without editing ThinkPad-owned files.
 *
 * `js/ui/app.js` is ThinkPad-owned (HANDOFF §6). The library panel
 * (`js/ui/style-library.js`, Mac-owned) needs three things from the host app:
 *
 *   1. a `StyleLibraryPanel` instance built against `#style-library-root`
 *   2. a `getSnapshot()` accessor so the panel can capture the live settings
 *   3. a consumer for `style-profile-apply` that pushes the profile into the
 *      engine and re-bakes
 *
 * Rather than editing app.js, this module monkey-patches the App instance the
 * host exposes as `window.__app` / `window._wwwPaint` — the same pattern as
 * `media-host.js`. The ThinkPad can later fold the same calls into `App._init()`
 * and delete this shim; nothing else depends on it.
 *
 * @module style-library-host
 */

import { StyleLibraryPanel } from './style-library.js';

/** The panel container id, matching the additive index.html delta. */
export const LIBRARY_ROOT_ID = 'style-library-root';

/** The nav button id, matching the additive index.html delta. */
export const LIBRARY_TOGGLE_ID = 'btn-library-mode';

/**
 * Attach the style library to a host App instance.
 *
 * @param {object} app — the App instance (window.__app)
 * @param {HTMLElement} [root] — override for the panel container
 * @returns {StyleLibraryPanel|null} the panel, or null when the host is not ready
 */
export function attachStyleLibrary(app, root) {
  if (!app) return null;

  const panelRoot = root || document.getElementById(LIBRARY_ROOT_ID);
  if (!panelRoot) {
    console.warn('[style-library-host] #' + LIBRARY_ROOT_ID + ' not found — library not mounted');
    return null;
  }

  // Already attached (e.g. the ThinkPad wired it natively) — do not double up.
  if (app.library) return app.library;

  const panel = new StyleLibraryPanel(panelRoot, {
    host: buildHostAccessor(app),
    onApply: (result) => applyToEngine(app, result),
  });

  app.library = panel;

  /* ── Library mode: swap the left rail between brush controls and library ──
     Same contract as media mode: on mobile the panel is an overlay and starts
     closed; on desktop it is hidden until library mode is switched on, so the
     brush controls own the rail by default. */

  app._libraryMode = false;

  const libraryRoot = document.getElementById(LIBRARY_ROOT_ID);
  if (libraryRoot) {
    if (window.matchMedia('(max-width: 768px)').matches) {
      libraryRoot.classList.add('panel--mobile-closed');
    } else {
      libraryRoot.classList.add('panel--hidden');
    }
  }

  window.addEventListener('resize', () => {
    if (!libraryRoot) return;
    const mobile = window.matchMedia('(max-width: 768px)').matches;
    if (mobile) {
      libraryRoot.classList.remove('panel--hidden');
      if (!app._libraryMode) libraryRoot.classList.add('panel--mobile-closed');
    } else {
      libraryRoot.classList.remove('panel--mobile-closed');
      libraryRoot.classList.toggle('panel--hidden', !app._libraryMode);
    }
  });

  app.toggleLibraryMode = function toggleLibraryMode() {
    app._libraryMode = !app._libraryMode;
    const controlsPanel = document.getElementById('controls-root');
    const paintToolbar = document.getElementById('paint-toolbar');
    const mediaPanel = document.getElementById('media-root');
    const libraryPanel = document.getElementById(LIBRARY_ROOT_ID);
    const btn = document.getElementById(LIBRARY_TOGGLE_ID);

    if (controlsPanel) {
      controlsPanel.classList.toggle('panel--hidden', app._libraryMode);
    }
    if (paintToolbar) {
      paintToolbar.classList.toggle('paint-toolbar--active', app._paintMode && !app._libraryMode && !app._mediaMode);
    }
    // The library and media panels share the left rail; switching to one
    // switches the other off so they never stack.
    if (app._libraryMode && app._mediaMode && typeof app.toggleMediaMode === 'function') {
      app.toggleMediaMode();
    }
    if (mediaPanel) {
      mediaPanel.classList.toggle('panel--hidden', app._libraryMode || !app._mediaMode);
    }
    if (libraryPanel) {
      const mobile = window.matchMedia('(max-width: 768px)').matches;
      if (mobile) {
        libraryPanel.classList.toggle('panel--mobile-closed', !app._libraryMode);
      } else {
        libraryPanel.classList.toggle('panel--hidden', !app._libraryMode);
      }
    }
    if (btn) {
      btn.classList.toggle('nav-btn--active', app._libraryMode);
    }

    app._setStatus(
      app._libraryMode ? 'Style library — save, apply, export' : 'Brush controls',
      false,
      app._libraryMode ? 0 : 2000,
    );
  };

  /* ── Keep the rail consistent when MEDIA mode is switched on ─────────────
     `toggleMediaMode()` is ThinkPad-owned and knows nothing about the library
     panel, so without this guard entering media mode leaves BOTH 260px panels
     visible in the same rail. Wrap it once, guarded against re-entry. */
  if (typeof app.toggleMediaMode === 'function' && !app.__libraryHostPatchedMedia) {
    const originalToggleMedia = app.toggleMediaMode.bind(app);
    app.__libraryHostPatchedMedia = true;
    app.toggleMediaMode = function toggleMediaModeWithLibrary() {
      const wasLibrary = !!app._libraryMode;
      const result = originalToggleMedia();
      // The library and media panels share one rail, so exactly one of them may
      // occupy it. Entering media mode retires the library panel; leaving media
      // mode returns the rail to the brush controls (the shell's default), which
      // is what the other toggle already does.
      if (app._mediaMode && wasLibrary) {
        app._libraryMode = false;
        const libraryPanel = document.getElementById(LIBRARY_ROOT_ID);
        const libraryBtn = document.getElementById(LIBRARY_TOGGLE_ID);
        if (libraryPanel) {
          const mobile = window.matchMedia('(max-width: 768px)').matches;
          if (mobile) libraryPanel.classList.add('panel--mobile-closed');
          else libraryPanel.classList.add('panel--hidden');
        }
        if (libraryBtn) libraryBtn.classList.remove('nav-btn--active');
      }
      return result;
    };
  }

  /* ── Apply: the panel dispatches, the host bakes ── */

  panelRoot.addEventListener('style-profile-apply', (e) => {
    applyToEngine(app, e.detail);
  });

  return panel;
}

/**
 * Build the narrow accessor the panel reads to capture the live settings.
 *
 * The panel must not reach into `app.engine.settings` itself (it would then own
 * the engine's settings shape). This accessor is the whole contract: the current
 * Brush-panel settings, the resolved media model, and the selected style.
 *
 * @param {object} app
 * @returns {{getSnapshot: function}}
 */
function buildHostAccessor(app) {
  return {
    getSnapshot() {
      const settings = (app.controls && typeof app.controls.getSettings === 'function')
        ? app.controls.getSettings()
        : (app.engine?.settings || {});
      return {
        settings,
        mediaModel: app.engine?.settings?.mediaModel || null,
        style: settings.style || app.engine?.settings?.style || null,
      };
    },
  };
}

/**
 * Push an expanded profile into the engine and re-bake.
 *
 * The panel hands over exactly what `engine.generate({ profile })` needs, so
 * this stays a thin translation: settings → engine settings, then a bake with
 * the profile attached. The profile is passed explicitly rather than only via
 * settings so the engine's own `opts.profile` branch (and its seed) is used.
 *
 * @param {object} app
 * @param {object} result - the panel's apply result
 * @returns {Promise<object|null>}
 */
async function applyToEngine(app, result) {
  if (!app.engine || !result || !result.ok) return null;

  try {
    // 1. Land the settings the profile carries.
    app.engine.setSettings(result.settings);
    if (result.layerStyles) app.engine.settings.layerStyles = result.layerStyles;
    if (result.mediaModel) app.engine.settings.mediaModel = result.mediaModel;

    // 2. Keep the Brush panel in step, so the UI shows what was applied rather
    //    than the values from before the profile landed.
    if (app.controls && typeof app.controls.setSettings === 'function') {
      const merged = { ...result.settings };
      if (result.settings.strokeSize) {
        merged.strokeSizeMin = result.settings.strokeSize.min;
        merged.strokeSizeMax = result.settings.strokeSize.max;
      }
      app.controls.setSettings(merged);
    }

    // 3. Bake. `app.generate()` streams every stroke to the DOM; the engine's
    //    own generate is used here for a fast, deterministic re-bake, and the
    //    render is refreshed afterwards.
    if (!app.engine._sourceImage) {
      app._setStatus('Load an image first — the profile is ready to apply.', false, 4000);
      return null;
    }

    const strokes = await app.engine.generate({
      profile: result.profile,
      layer: 0,
      multiLayer: !!result.profile.global.multiLayer,
    });
    app.engine.render();
    if (app.layers && typeof app.layers.setLayers === 'function') {
      app.layers.setLayers(app.engine.layers);
    }
    app._setStatus(
      `Applied "${result.profile.name}" — ${strokes.length.toLocaleString()} strokes.`,
      false,
      4000,
    );
    return { strokes: strokes.length, profile: result.profile.name };
  } catch (err) {
    console.warn('[style-library-host] apply failed:', err);
    if (app._showError) app._showError('Could not apply the profile: ' + err.message);
    return null;
  }
}

export default attachStyleLibrary;
