"use client";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createAgent } from "@ui-sdk/react/agent";

import { StyleLibrary } from "./StyleLibrary.jsx";

import "./styles.css";

// The bridge must exist before the components render: ui-sdk's kernel queues
// instances created before `install()` and only flushes them once a bridge is
// created (see node_modules/@ui-sdk/core/dist/foundation/kernel/watchers.js).
// One bridge per page, so `snapshot()` can see every component.
window.__WWW_PAINT_AGENT__ ??= createAgent();

/**
 * Mount the Style Profile library into a root element.
 *
 * Exported rather than auto-run so `js/ui/react-host.js` can mount it on a node
 * the shell owns — the same shim pattern as the vanilla panels. The Vite dev
 * page (`js/ui/react/index.html`) still gets an automatic mount.
 *
 * @param {HTMLElement} root
 * @param {object} [host] - the host contract from react-host.js
 */
export function mountStyleLibrary(root, host = null) {
  if (!root) throw new Error("mountStyleLibrary requires a root element");

  window.__WWW_PAINT_HOST__ = host ?? window.__WWW_PAINT_HOST__ ?? null;

  createRoot(root).render(
    <StrictMode>
      <StyleLibrary host={window.__WWW_PAINT_HOST__} />
    </StrictMode>
  );
}

const localRoot = document.getElementById("profile-root");
if (localRoot) mountStyleLibrary(localRoot);

