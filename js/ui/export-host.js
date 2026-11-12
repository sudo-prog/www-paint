/**
 * export-host.js — Mac-owned shim that hosts the export & share panel (M11)
 * without editing ThinkPad-owned files.
 *
 * `js/ui/app.js` and `js/ui/export.js` are ThinkPad-owned (HANDOFF §6). The
 * older ExportManager (`#export-root`) is left completely untouched; this
 * stream adds a SECOND surface — the Phase 6 export & share panel — and wires
 * it through the same monkey-patch pattern as media-host.js and
 * style-library-host.js. The ThinkPad can later fold the same calls into
 * `App._init()` and delete this shim; nothing else depends on it.
 *
 * Everything here is a thin translation: the panel decides WHAT to export, the
 * engine does it. No engine file is edited.
 *
 * @module export-host
 */

import { ExportPanel } from './export-panel.js';

/** The panel container id, matching the additive index.html delta. */
export const EXPORT_PANEL_ROOT_ID = 'export-panel-root';

/** The nav button id, matching the additive index.html delta. */
export const EXPORT_PANEL_TOGGLE_ID = 'btn-export-panel';

/**
 * Attach the export & share panel to a host App instance.
 *
 * @param {object} app — the App instance (window.__app)
 * @param {HTMLElement} [root] — override for the panel container
 * @returns {ExportPanel|null} the panel, or null when the host is not ready
 */
export function attachExportPanel(app, root) {
  if (!app) return null;

  const panelRoot = root || document.getElementById(EXPORT_PANEL_ROOT_ID);
  if (!panelRoot) {
    console.warn('[export-host] #' + EXPORT_PANEL_ROOT_ID + ' not found — export panel not mounted');
    return null;
  }

  // Already attached (e.g. the ThinkPad wired it natively) — do not double up.
  if (app.exportPanel) return app.exportPanel;

  const panel = new ExportPanel(panelRoot, {
    host: buildHostAccessor(app),
  });

  app.exportPanel = panel;

  /* ── The panel is a modal overlay, so its open state is independent of the
     left rail. Start closed; the nav button opens it. ── */

  const toggle = document.getElementById(EXPORT_PANEL_TOGGLE_ID);
  if (toggle) {
    toggle.addEventListener('click', () => {
      if (panel.isOpen()) {
        panel.hide();
        toggle.classList.remove('nav-btn--active');
        toggle.setAttribute('aria-expanded', 'false');
      } else {
        panel.show();
        toggle.classList.add('nav-btn--active');
        toggle.setAttribute('aria-expanded', 'true');
      }
    });
  }

  return panel;
}

/**
 * Build the narrow accessor the panel reads.
 *
 * The panel must not reach into `app.engine.settings` itself. This accessor is
 * the whole contract: the current image size, the engine's export call, and
 * the M10 library's profile JSON.
 *
 * @param {object} app
 * @returns {{getImageSize: function, exportImage: function, getProfileText: function, getProfileName: function}}
 */
function buildHostAccessor(app) {
  return {
    getImageSize() {
      const engine = app.engine;
      if (!engine) return { width: 0, height: 0 };
      return {
        width: engine.width || engine.renderer?.width || 0,
        height: engine.height || engine.renderer?.height || 0,
      };
    },

    /**
     * Export the painting through the engine's OWN wrapper (exporter.js).
     * `engine.exportPNG` / `engine.exportJPG` are the ThinkPad-owned surface;
     * this shim only forwards the panel's request.
     */
    async exportImage(req) {
      const engine = app.engine;
      if (!engine) throw new Error('The engine is not ready.');
      if (!engine._sourceImage) throw new Error('Load an image first.');
      if (req.format === 'jpg') {
        return engine.exportJPG({
          width: req.width,
          height: req.height,
          quality: req.quality,
          background: req.background,
        });
      }
      return engine.exportPNG({
        width: req.width,
        height: req.height,
        background: req.background,
      });
    },

    /**
     * The M10 library's profile JSON, or null when the library is absent or
     * nothing is saved. Kept null-safe so the panel degrades gracefully.
     */
    getProfileText() {
      try {
        const library = app.library && app.library.library;
        if (!library || typeof library.list !== 'function') return null;
        const entries = library.list();
        if (!entries.length) return null;
        const first = entries.find((e) => e && e.profile) || entries[0];
        return library.exportText(first.id);
      } catch {
        return null;
      }
    },

    getProfileName() {
      try {
        const library = app.library && app.library.library;
        const entries = library && typeof library.list === 'function' ? library.list() : [];
        const first = entries.find((e) => e && e.profile) || entries[0];
        return (first && first.profile && first.profile.name) || 'profile';
      } catch {
        return 'profile';
      }
    },
  };
}

export default attachExportPanel;
