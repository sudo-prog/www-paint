"use client";

/**
 * dev.jsx — the Vite dev page entry (`js/ui/react/index.html`).
 *
 * The production shell mounts the surface from `js/ui/react-host.js`; this
 * module is ONLY for `npm run ui`. Keeping the auto-mount out of `main.jsx`
 * matters: the shell page already contains `#profile-root`, so an import-time
 * auto-mount there created a SECOND React root in the same container and the
 * panel rendered twice (see the duplicate-row defect).
 */

import "./main.jsx";

import { mountStyleLibrary } from "./main.jsx";

const root = document.getElementById("profile-root");
if (root) mountStyleLibrary(root);
