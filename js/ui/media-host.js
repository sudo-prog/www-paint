/**
 * media-host.js — Mac-owned shim that hosts the media panel without editing
 * ThinkPad-owned files.
 *
 * `js/ui/app.js` is ThinkPad-owned (HANDOFF §6). The media panel
 * (`js/ui/media.js`, Mac-owned) still needs three things from the host app:
 *
 *   1. a `MediaPanel` instance built against `#media-root`
 *   2. a `toggleMediaMode()` method the Media nav button can call
 *   3. a consumer for `media-settings-change` (store settings, feed the mask
 *      preview when an image is loaded)
 *
 * Rather than editing app.js, this module monkey-patches the App instance the
 * host exposes as `window.__app` / `window._wwwPaint`. The ThinkPad can later
 * fold the same calls into `App._init()` (see docs/checkpoints/P2.md §UI) and
 * delete this shim — nothing else depends on it.
 *
 * @module media-host
 */

import { MediaPanel } from "./media.js";
import { computeTonalMasks, masksCompositeRGBA } from "../engine/masks.js";

/**
 * Attach the media panel to a host App instance.
 *
 * @param {object} app — the App instance (window.__app)
 * @param {HTMLElement} [root] — override for the panel container
 * @returns {MediaPanel|null} the panel, or null when the host is not ready
 */
export function attachMediaPanel(app, root) {
  if (!app) return null;

  const panelRoot = root || document.getElementById("media-root");
  if (!panelRoot) {
    console.warn("[media-host] #media-root not found — media panel not mounted");
    return null;
  }

  // Already attached (e.g. the ThinkPad wired it natively) — do not double up.
  if (app.media) return app.media;

  const panel = new MediaPanel(panelRoot, {
    settings: app.engine?.settings?.media,
  });

  app.media = panel;

  // Seed the engine's mediaModel from the panel's own defaults, so the render
  // path agrees with what the panel shows before the user touches a control.
  // (Dry defaults -> kind:"dry" -> no wet pass -> byte-identical output.)
  if (app.engine) {
    app.engine.settings.wetSim = { ...panel.getSettings().wetSim };
    app.engine.settings.media = { ...panel.getSettings().media };
    app.engine.settings.mediaModel = mediaModelFromPanel(panel.getSettings());
  }

  /* ── Media mode: swap the left rail between brush controls and media ── */

  app._mediaMode = false;

  // On mobile the media panel is an overlay and starts closed, matching the
  // other panels — otherwise it covers the canvas on load. On desktop it is
  // hidden entirely until media mode is switched on, so the brush controls
  // own the left rail by default.
  const mediaRoot = document.getElementById("media-root");
  if (mediaRoot) {
    if (window.matchMedia("(max-width: 768px)").matches) {
      mediaRoot.classList.add("panel--mobile-closed");
    } else {
      mediaRoot.classList.add("panel--hidden");
    }
  }

  // Keep the panel's state correct across a viewport crossing. Without this a
  // desktop→mobile resize leaves the desktop hidden-class set (or vice versa)
  // and the panel is unreachable.
  window.addEventListener("resize", () => {
    if (!mediaRoot) return;
    const mobile = window.matchMedia("(max-width: 768px)").matches;
    if (mobile) {
      mediaRoot.classList.remove("panel--hidden");
      if (!app._mediaMode) mediaRoot.classList.add("panel--mobile-closed");
    } else {
      mediaRoot.classList.remove("panel--mobile-closed");
      mediaRoot.classList.toggle("panel--hidden", !app._mediaMode);
    }
  });

  app.toggleMediaMode = function toggleMediaMode() {
    app._mediaMode = !app._mediaMode;
    const controlsPanel = document.getElementById("controls-root");
    const paintToolbar = document.getElementById("paint-toolbar");
    const mediaPanel = document.getElementById("media-root");
    const btn = document.getElementById("btn-media-mode");

    if (controlsPanel) {
      controlsPanel.classList.toggle("panel--hidden", app._mediaMode);
    }
    // The paint toolbar occupies the same rail in paint mode; the media panel
    // always wins while media mode is on.
    if (paintToolbar) {
      paintToolbar.classList.toggle("paint-toolbar--active", app._paintMode && !app._mediaMode);
    }
    if (mediaPanel) {
      // On mobile the media panel is an overlay: entering media mode opens it.
      const mobile = window.matchMedia("(max-width: 768px)").matches;
      if (mobile) {
        mediaPanel.classList.toggle("panel--mobile-closed", !app._mediaMode);
      } else {
        mediaPanel.classList.toggle("panel--hidden", !app._mediaMode);
      }
    }
    if (btn) {
      btn.classList.toggle("nav-btn--active", app._mediaMode);
    }

    app._setStatus(
      app._mediaMode ? "Media — wet, ink and tonal controls" : "Brush controls",
      false,
      app._mediaMode ? 0 : 2000,
    );
  };

  /* ── Settings: store and echo ── */

  panelRoot.addEventListener("media-settings-change", (e) => {
    const { section, key, value } = e.detail || {};
    if (!section) return;

    if (app.engine) {
      if (section === "masks") {
        app.engine.settings.masks = {
          ...(app.engine.settings.masks || {}),
          ...(key.startsWith("bands.")
            ? { bands: { ...(app.engine.settings.masks?.bands || {}), [key.slice(6)]: value } }
            : { [key]: value }),
        };
      } else {
        app.engine.settings[section] = {
          ...(app.engine.settings[section] || {}),
          [key]: value,
        };
      }

      // The panel's `wetSim`/`media` sections must reach the engine's
      // `mediaModel` or the render path never sees them (see the bridge below).
      // `masks` is a preview-only concern and needs no bridge.
      if (section === "wetSim" || section === "media") {
        // Moving a wet control IS the opt-in (see mediaModelFromPanel). Set it
        // on the panel itself — `getSettings()` returns a copy, so mutating that
        // would be lost. `setSettings` goes through `_merge`, which now knows
        // the key because WET_SIM_KEYS carries it.
        if (section === "wetSim") {
          panel.setSettings({ wetSim: { wetOptIn: true } });
        }
        app.engine.settings.mediaModel = mediaModelFromPanel(panel.getSettings());
      }
    }

    // The mask preview is only meaningful once an image has been analysed.
    if (section === "masks" && app.engine?._analysis) {
      drawMaskPreview(app, panel);
    }
  });

  /* ── Mask preview: compute from the loaded image ── */

  if (app.engine?._analysis) {
    drawMaskPreview(app, panel);
  }

  // Recompute when a new image is analysed. Wrap the host's loader ONCE and
  // guard against re-entry: this shim can be applied again (e.g. on a hot
  // reload) and a second wrap would run the pipeline twice.
  if (typeof app.loadImageFile === "function" && !app.__mediaHostPatched) {
    const originalLoad = app.loadImageFile.bind(app);
    app.__mediaHostPatched = true;
    app.loadImageFile = async function loadImageFileWithMasks(file) {
      const result = await originalLoad(file);
      if (app.engine?._analysis) drawMaskPreview(app, panel);
      return result;
    };
  }

  return panel;
}

/**
 * Compute the tonal masks from the engine's last analysis and push the
 * composite into the panel's preview canvas.
 *
 * @param {object} app
 * @param {MediaPanel} panel
 * @returns {void}
 */
function drawMaskPreview(app, panel) {
  try {
    const analysis = app.engine._analysis;
    const settings = app.engine.settings?.masks || {};
    const opts = {
      lo: settings.lo ?? 85,
      hi: settings.hi ?? 170,
      softness: settings.softness ?? 8,
      backgroundThreshold: settings.backgroundThreshold ?? 0.15,
    };

    // masks.js is imported above; no dynamic lookup needed.
    const result = computeTonalMasks(analysis, opts);
    // Pass the band enable flags: the composite must reflect which bands the
    // panel shows as on, otherwise toggling a band changes nothing visible.
    const rgba = masksCompositeRGBA(result.masks, result.width, result.height, settings.bands);

    panel.setMaskPreview(
      { data: rgba, width: result.width, height: result.height, coverage: result.coverage },
      null,
    );
  } catch (err) {
    console.warn("[media-host] mask preview failed:", err);
  }
}

/**
 * Translate the panel's WET MEDIA + MEDIA sections into the engine's
 * `settings.mediaModel` (the frozen Style-Profile contract, `docs/STYLE_PROFILE.md`
 * `$defs/mediaModel`).
 *
 * Why this exists: the panel dispatches `section:"wetSim"` and `section:"media"`,
 * and the first version of this shim stored them verbatim at
 * `engine.settings.wetSim` / `engine.settings.media`. But `engine.generate()`
 * reads ONLY `engine.settings.mediaModel` (`engine.js` →
 * `mediaModelToWetOpts`), so every wet control was stored and then ignored —
 * the panel was an inert settings shell. This function is the missing bridge.
 *
 * Output is clamped into the schema's ranges (`kind` + six `[0,1]` fields) so
 * the object is always a valid `mediaModel`. A dry model (`kind:"dry"`) is
 * written as `{kind:"dry", ...}` — `mediaModelToWetOpts` returns null for it,
 * which leaves the render path byte-identical to today.
 *
 * @param {object} settings - the panel's `getSettings()` snapshot
 * @returns {object} a `mediaModel` object
 */
function mediaModelFromPanel(settings = {}) {
  const wet = settings.wetSim || {};
  const media = settings.media || {};

  const n = (v, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : d);
  const clamp01 = (v, d = 0) => Math.min(1, Math.max(0, n(v, d)));

  // Output-neutrality gate (HANDOFF §2 rule 5). The panel's *display* defaults
  // are wetsim.js's own defaults (maxWet 1.5, dryRate 1, flowRate 0.45, ...),
  // which describe a WORKING wet sim — so if we mapped them naively the panel
  // would switch wet media on for every user who never touched a control.
  //
  // `wetOptIn` is the explicit switch. It is false until the user moves a wet
  // control, and true from then on. While false the model is dry, so the render
  // path is byte-identical to a build without this panel.
  if (wet.wetOptIn !== true) {
    return { kind: "dry", wetness: 0, drying: 0, bleed: 0, granulation: 0, height: 0, bristle: 0, paper: null };
  }

  const maxWet = n(wet.maxWet, 1.5);
  const kind = maxWet <= 0.2 ? "dry" : "wet";

  return {
    kind,
    // `wetness` is a 0..1 saturation; maxWet runs 0.2..3, so normalise it.
    wetness: clamp01((maxWet - 0.2) / 2.8),
    drying: clamp01(n(wet.dryRate, 1) / 4),
    bleed: clamp01(n(media.bleed, 0) / 0.6),
    granulation: clamp01(n(wet.granulation, 0) || n(media.granulation, 0)),
    height: clamp01(n(wet.heightScale, 1) / 4),
    bristle: 0,
    paper: null,
  };
}

/**
 * Push the panel's current settings into the engine, including the mediaModel
 * bridge. Called on every `media-settings-change` and on attach.
 *
 * @param {object} app
 * @param {MediaPanel} panel
 * @returns {void}
 */
function pushSettingsToEngine(app, panel) {
  if (!app.engine) return;
  const settings = panel.getSettings();

  // Legacy flat storage, kept so the panel's own state round-trips.
  app.engine.settings.wetSim = { ...settings.wetSim };
  app.engine.settings.media = { ...settings.media };
  app.engine.settings.masks = {
    ...settings.masks,
    bands: { ...settings.masks.bands },
  };

  // The bridge: this is what actually reaches the render path.
  app.engine.settings.mediaModel = mediaModelFromPanel(settings);
}

export default attachMediaPanel;
