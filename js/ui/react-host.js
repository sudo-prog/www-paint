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

const STYLE_ID = "react-surface-styles";
const ROOT_ID = "react-root";

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

/** Inject the React surface stylesheet once. */
async function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;

  const url = await resolveUrl([
    "/js/ui/react/bundle.css",
    "js/ui/react/bundle.css",
    "/js/ui/react/styles.css",
  ]);
  if (!url) {
    console.warn("[react-host] no stylesheet found — is scripts/react-bundle.cjs run?");
    return;
  }

  const link = document.createElement("link");
  link.id = STYLE_ID;
  link.rel = "stylesheet";
  link.href = url;
  document.head.appendChild(link);
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
      app.engine.render?.();
    },
  };
}

/**
 * Mount the React surface. Idempotent.
 *
 * @param {object} app — the App instance (`window._wwwPaint`)
 * @returns {Promise<boolean>} whether the surface mounted
 */
export async function attachReactSurface(app) {
  if (document.getElementById(ROOT_ID)) return true;

  await ensureStyles();

  const host = buildHostAccessor(app);
  window.__WWW_PAINT_HOST__ = host;

  const root = document.createElement("div");
  root.id = ROOT_ID;
  root.className = "react-surface-root";
  // Hidden until a nav control opens it; the shell toggles this class.
  root.setAttribute("data-closed", "");
  document.body.appendChild(root);

  const mountEl = document.createElement("div");
  mountEl.id = "profile-root";
  root.appendChild(mountEl);

  const bundle = await resolveUrl([
    "/js/ui/react/bundle.js",
    "js/ui/react/bundle.js",
  ]);
  if (!bundle) {
    console.warn("[react-host] js/ui/react/bundle.js not found — run: npm run react:bundle");
    return false;
  }

  // The bundle exports `mountStyleLibrary`; it auto-mounts only when a
  // `#profile-root` node already exists (the Vite dev page), so creating that
  // node here is what makes both paths work.
  const module = await import(/* @vite-ignore */ bundle);
  const mount = module.mountStyleLibrary ?? module.default;
  if (typeof mount !== "function") {
    console.warn("[react-host] the bundle exports no mountStyleLibrary()");
    return false;
  }
  mount(mountEl, host);
  return true;
}
