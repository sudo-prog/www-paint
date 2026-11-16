/**
 * WWW_PAINT — ui-sdk (React) surface entry.
 *
 * Mounts the React Style Library (`js/ui/react/StyleLibrary.jsx`) into the
 * page. This is the ONLY build-step surface in the repo — the main app stays a
 * no-build static site (`index.html` + importmap). `npm run ui` serves this
 * surface in dev; `npm run ui:build` bundles it to `ui-dist/`.
 *
 * The `host` object is the boundary back to the embedding app: applying a
 * profile re-dispatches the result as a DOM event, so the vanilla app (or a
 * headless probe) can observe it without importing React.
 */
import { createRoot } from "react-dom/client";

import { StyleLibrary } from "./StyleLibrary.jsx";

const host = {
  styleLibraryChanged() {},
  styleProfileApplied(result) {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
      new CustomEvent("www-paint:profile-applied", { detail: result }),
    );
  },
};

const rootEl = typeof document !== "undefined" ? document.getElementById("profile-root") : null;
if (rootEl) createRoot(rootEl).render(<StyleLibrary host={host} />);
