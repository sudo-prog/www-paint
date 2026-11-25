# ui-sdk (React UI SDK) — the one build-step surface

**Date:** 2026-11-17 · Owner: BE (ThinkPad) · Status: **set up + build-verified**

WWW_PAINT is a **no-build static app** (`index.html` + importmap). This document
covers the single exception: a **React surface** built with
[`@ui-sdk/*`](https://ui-sdk.dev) that renders the Style Profile library. It is
an *additional* surface, served on its own page — the main app is unchanged and
still needs no build.

## What is here

| Path | What |
|---|---|
| `package.json` / `package-lock.json` | The ui-sdk integration manifest (private, `npm`). The app itself still needs no `package.json` to run. |
| `.agents/skills/ui-sdk/` **+** `.claude/skills/ui-sdk`, `.hermes/skills/ui-sdk` | The vendored `ui-sdk` agent skill (symlinks; tracked in `skills-lock.json`). |
| `vite.config.js` | Vite config for **only** `js/ui/react/` (`root`). `npm run ui` (dev, port 5178) / `npm run ui:build` → repo-root `ui-dist/`. |
| `js/ui/react/index.html` | The surface's page shell (mounts `#profile-root`). |
| `js/ui/react/main.jsx` | Entry — mounts `<StyleLibrary>` and exposes the `host` boundary. |
| `js/ui/react/StyleLibrary.jsx` | The React Style Library (ui-sdk Button/Dialog/Field/Input/Listbox/Select/Switch/Tooltip over `style-library-core.js`). |
| `js/ui/react/styles.css` | Standalone dark styling (independent of `css/style.css`). |
| `css/layers-shell.css` | 670-line LAYERS desktop shell CSS (20px shell radius, 28px canvas radius, glass pill toolbar, 12px gaps). NEW — delivered via Syncthing from Mac. |
| `js/ui/shell-host.js` | NEW — wires LAYERS shell structure to WWW_PAINT's DOM, handles radius/expanded-navbar/theme/≤900-collapse/strip-dims. |
| `js/ui/audit-fix-host.js` | NEW — worker-backed generation with live progress, 20-deep undo stack, image-aspect frame fit, dimmed source preview, two-step Reset/Clear confirm. |
| `js/ui/react/components/ui/` | 67 shadcn-style React component files (sidebar, sheet, dialog, tabs, command, popover, table, input-group, etc.) implementing LAYERS UI components with glass pill design. NEW — delivered via Syncthing from Mac. |
| `js/ui/react/hooks/` | NEW React hooks for LAYERS UI state management. |
| `js/ui/react/lib/` | NEW utility library for LAYERS React components. |
| `js/ui/react/fonts/` | NEW font assets for LAYERS UI. |
| `js/ui/react/dev.jsx` | NEW React dev entry point. |
| `js/ui/react/bundle.js` | **Committed build artefact** (518 KB). Built with `npm run react:bundle` (scripts/react-bundle.cjs). MUST be rebuilt after any `js/ui/react/*.jsx` change. Inlines CSS as `<style id="react-surface-styles">`. |

## Commands

```bash
npm install          # one-time: installs @ui-sdk/* + react + vite (dev)
npm run ui           # dev server for js/ui/react (http://localhost:5178)
npm run ui:build     # bundle → ui-dist/  (gitignored)
npm run ui:preview   # serve the built bundle
```

Build is verified: `vite build` → 198 modules → `ui-dist/{index.html,assets/*}`.
The surface renders headless (Playwright against the served bundle): heading
**"Style profiles"**, buttons **Import / Save current**, minimum interactive
target **44 px**, **0 page errors**.

## Boundaries

- The React surface **imports only pure modules** (`js/ui/style-library-core.js`
  → `js/engine/profile.js`). It never imports `controls.js` / `app.js`.
- Communication back to the vanilla app is one DOM event,
  `www-paint:profile-applied` (dispatched from `main.jsx`'s `host`).
- `ui-dist/` is gitignored; only sources are committed.
- Outside `js/ui/react/`, nothing in the app gains a build step.

## Owed

- The original `AGENTS.md` §"ui-sdk (React UI SDK)" note was **clobbered** by a
  peer Syncthing revision of `AGENTS.md` (BE cannot re-add it — `AGENTS.md` is a
  protected agent-instruction file and the approval prompt fails closed over
  Telegram). This document is the replacement record. Re-add the pointer to
  `AGENTS.md` when a human is present to approve the write.
