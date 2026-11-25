# Mac UI Landing — Syncthing Delivered UI Work

## What landed

The Mac's new UI work arrived in the working tree via Syncthing (no push to GitHub). This landing records the full scope of what was delivered:

**Files:**
- `css/layers-shell.css` — 670-line NEW CSS file implementing LAYERS desktop design (20px shell radius, 28px canvas radius, glass pill toolbar, 12px gaps, black base, no border/shadow)
- `js/ui/shell-host.js` — NEW. Wires LAYERS shell structure to WWW_PAINT's DOM, handles radius/expanded-navbar/theme/≤900-collapse/strip-dims, manages `.app` container, imports LAYERS CSS, mounts React surface
- `js/ui/audit-fix-host.js` — NEW. Worker-backed generation with live progress, 20-deep undo stack, image-aspect frame fit at ~40%, dimmed source preview, two-step Reset/Clear confirm + undo toast, pinned Generate/Stop/Reset row, error toasts
- `js/ui/react/components/ui/` — 67 .jsx/.js files (sidebar, sheet, dialog, tabs, command, popover, table, input-group, etc.) implementing LAYERS UI components with glass pill design
- `js/ui/react/hooks/` — NEW React hooks for LAYERS UI state management
- `js/ui/react/StyleLibrary.jsx` — 457-line updated React Style Library (ui-sdk Button/Dialog/Field/Input/Listbox/Select/Switch/Tooltip) with LAYERS styling
- `js/ui/react/bundle.js` — 518,750 bytes rebuilt React surface bundle via `npm run react:bundle` (esbuild); committed bundle was STALE and has been REBUILT — pre-rebuild md5 `96e6e0ecb60a0cf9369c527cf96ccf6c`, post-rebuild md5 `64b8a07ce2a552391e50f66627991194`; app re-verified AFTER the rebuild (0 page errors, 55 runtime style keys (52 registry entries + 3 Painter aliases), 4 panels, 4 canvases)
- `js/ui/react/styles.css` — NEW standalone dark styling for the React surface (independent of `css/style.css`)
- `js/ui/react/fonts/` — NEW. 5 Geist woff2 variable-font files (latin, latin-ext, cyrillic, cyrillic-ext, vietnamese)
- `js/ui/react/dev.jsx` — NEW. Development entry point for the React surface
- `js/ui/react/lib/` — NEW. React support library (`highlighter.jsx`, `utils.js`)
- `js/ui/react/hooks/` — NEW React hooks for LAYERS UI state management (2 files: `use-highlighted-code.js`, `use-mobile.js`)
- `css/style.css` — +448 lines (§16 etc.) adding adapter for LAYERS shell, canvas-background restatement, mobile playback/toggle de-collision, 44px touch floors, focus rings, collapsed-rail overflow, light-theme React tokens, favicon
- `index.html` — importmap cache-bust bumped to `?v=20261124b` (NEW)
- `package.json` + `package-lock.json` — playwright-core devDependency added (NEW)
- `components.json` — NEW component manifest for LAYERS UI
- `jsconfig.json` — NEW React path configuration
- `maestro/*.yaml` — updated flows for Mac UI (swipe counts for taller 44px panels; modular-switch stale default corrected to R6 contract; style-picker scroll-then-assert)
- `js/ui/canvas.js`, `js/ui/settings.js`, `js/ui/react/StyleLibrary.jsx` — edited to work with LAYERS shell

**Delivery Mechanism:**
- The Mac does NOT push to GitHub (per `HANDOFF.md` §0/§2 "the ThinkPad is the only machine that pushes to GitHub")
- Work arrived via Syncthing into the ThinkPad's working tree
- `origin/machine/mac/masks` branch IS already merged into main
- `origin/machine/mac/wetsim` content is also already in main (commit `a3bbfc0`, delivered via Syncthing) — only the branch ref lags
- `origin/be/painter-parity` (commit `08f8c8f`) is NOT in main — its `js/engine/painter-plan.js` and `tests/painter-plan.test.js` differ from what is in the working tree, so that branch must not be merged blindly

## Verification

The app boots with **0 page errors**, 55 runtime style keys (52 registry entries + 3 Painter aliases), painterly present in the registry, all four panels present (controls / layers / media / library), 4 canvases in the DOM, `layers-shell.css` loaded, React surface mounted. The probe that proves it (headless Playwright, `boot-check.cjs` in scratch):

```javascript
// boot-check.cjs — serves index.html, launches headless Chromium,
// waits for window.__app.engine, then evaluates:
const out = await pg.evaluate(() => {
  const reg = Object.keys(window.__app.engine.renderer._styles);
  const picker = document.querySelectorAll('.style-thumb');
  return {
    registeredStyles: reg.length,
    hasPainterly: reg.includes('painterly'),
    painterlyLabel: window.__app.engine.renderer._styles.painterly ? 'registered' : 'no',
    styleThumbs: picker.length,
    reactSurface: !!document.querySelector('#style-library-root')?.children.length,
    layersShellCss: [...document.styleSheets].map(s => s.href || '')
                     .filter(h => h.includes('layers-shell')).length,
    panels: {
      controls: !!document.querySelector('#controls-root'),
      layers:   !!document.querySelector('#layers-root'),
      media:    !!document.querySelector('#media-root'),
      library:  !!document.querySelector('#style-library-root'),
    },
    canvases: document.querySelectorAll('canvas').length,
  };
});
out.pageErrors = errs; // collected from pg.on('pageerror') + pg.on('console')
```

Real output:

```json
{
  "registeredStyles": 55,
  "hasPainterly": true,
  "painterlyLabel": "registered",
  "styleThumbs": 7,
  "reactSurface": true,
  "layersShellCss": 1,
  "panels": {
    "controls": true,
    "layers": true,
    "media": true,
    "library": true
  },
  "canvases": 4,
  "pageErrors": []
}
```

The probe's `registeredStyles` counts the RUNTIME style map (`Object.keys(window.__app.engine.renderer._styles).length`), not the registry — 52 registry entries plus the 3 Painter aliases the engine registers alongside them.

All 52 registry styles are present, plus the 3 Painter aliases the engine registers alongside them — 55 runtime style keys in total. The painterly style is present. The app boots cleanly with the Mac's UI present: 0 page errors, all four panels mounted, React surface mounted, `layers-shell.css` loaded, 55 runtime style keys, 4 canvases in the DOM. An end-to-end flow test through the new shell (Maestro run against the new shell, painting through it) has NOT been run and remains open.