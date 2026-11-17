/**
 * react-host.js — Mac-owned shim that mounts the React/ui-sdk surface without
 * editing ThinkPad-owned files.
 *
 * `index.html` gains ONE additive import + ONE additive call (the same shim
 * pattern as `media-host.js` / `style-library-host.js`), and this module does
 * everything else:
 *
 *   1. injects the React surface's own stylesheet (`bundle.css`);
 *   2. exposes a small host accessor on `window.__WWW_PAINT_HOST__` so the
 *      React panel can read the live settings and push an applied profile into
 *      the engine (the same contract the vanilla library panel uses);
 *   3. creates `#react-root` and mounts `js/ui/react/bundle.js`.
 *
 * The bundle is a committed ES module, so the production page needs no build
 * step. `npm run ui` (Vite) remains the dev path for editing `js/ui/react/*.jsx`.
 *
 * @module react-host
 */

const ROOT_ID = "react-root";
/** The nav button that opens the surface. Additive, Mac-owned. */
export const REACT_TOGGLE_ID = "btn-react-surface";

/** Read a URL, resolving the dev server first so `npm run ui` and the static
 *  page both work. Returns null when neither has it yet. */
async function resolveUrl(paths) {
  for (const path of paths) {
    try {
      const response = await fetch(path, { method: "HEAD", cache: "no-store" });
      if (response.ok) return path;
    } catch {
      /* the dev server is not running — try the next candidate */
    }
  }
  return null;
}

/** The host contract the React panel consumes. */
function buildHostAccessor(app) {
  return {
    /** Live settings, for the SAVE action. */
    getSettings: () => {
      const settings = app?.engine?.settings ?? app?.settings ?? {};
      return { ...settings };
    },
    /** Called with the library's list rows after every change. */
    styleLibraryChanged: (rows) => {
      app?._reactLibraryRows?.(rows);
    },
    /** Called with the library's apply result. */
    styleProfileApplied: (result) => {
      if (!app?.engine || !result?.ok) return;
      const { settings, seed } = result;
      Object.assign(app.engine.settings, settings ?? {});
      if (Number.isInteger(seed)) app.engine.settings.seed = seed;
      // Track R6 — a profile may carry its own `global.modularEngine` opinion.
      // The Mac-owned shim resolves it (strict boolean; unset = leave the
      // user's toggle alone). No-op when the profile says nothing.
      app?._modularProfileApplied?.(app, result);
      app.engine.render?.();
    },
    /** The engine, for anything the panel still needs. */
    get engine() {
      return app?.engine ?? null;
    },
  };
}

/** Mount the surface. */
async function mount() {
  const host = buildHostAccessor(window._wwwPaint ?? null);
  window.__WWW_PAINT_HOST__ = host;

  const root = document.getElementById(ROOT_ID);
  const mountEl = document.getElementById("profile-root");

  const bundle = await resolveUrl([
    "/js/ui/react/bundle.js",
    "js/ui/react/bundle.js",
  ]);
  if (!bundle) {
    console.warn("[react-host] js/ui/react/bundle.js not found — run: npm run react:bundle");
    return false;
  }

  // The bundle exports `mountStyleLibrary`; it auto-mounts only when a
  // `#profile-root` node already exists (the Vite dev page).
  const module = await import(/* @vite-ignore */ bundle);
  const mount = module.mountStyleLibrary ?? module.default;
  if (typeof mount !== "function") {
    console.warn("[react-host] the bundle exports no mountStyleLibrary()");
    return false;
  }
  mount(mountEl, host);
  root.dataset.mounted = "true";
  return true;
}

/** Open/close the surface. The nav control toggles it. */
function setOpen(open) {
  const root = document.getElementById(ROOT_ID);
  if (!root) return;
  root.dataset.closed = open ? "" : "true";
  const trigger = document.getElementById(REACT_TOGGLE_ID);
  if (trigger) {
    trigger.setAttribute("aria-expanded", open ? "true" : "false");
    trigger.classList.toggle("nav-btn--active", open);
  }
}

/**
 * Mount the React surface. Idempotent.
 *
 * @param {object} app — the App instance (`window._wwwPaint`)
 * @returns {Promise<boolean>} whether the surface mounted
 */
export async function attachReactSurface(app) {
  if (!document.getElementById(ROOT_ID)) {
    console.warn("[react-host] #" + ROOT_ID + " not found — add it to index.html");
    return false;
  }
  if (document.getElementById(ROOT_ID).dataset.mounted) return true;

  const ok = await mount();
  if (!ok) return false;

  // A nav control owns the open state; without it the surface is unreachable.
  const trigger = document.getElementById(REACT_TOGGLE_ID);
  if (trigger && !trigger.dataset.reactBound) {
    trigger.dataset.reactBound = "true";
    trigger.addEventListener("click", () => {
      const root = document.getElementById(ROOT_ID);
      setOpen(root?.dataset.closed !== "");
    });
    // The panel starts CLOSED: it is a secondary surface beside the vanilla
    // library, not a replacement.
    setOpen(false);
  }

  return true;
}

export { setOpen };
