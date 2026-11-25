# Brief — WWW_PAINT shell swap: adopt the LAYERS frontend wholesale (user-authorized replacement)

Repo: `/Users/AIR2K/Data/20_Projects/20.36_WWW_PAINT` (work here)
Reference (READ-ONLY, never edit): `/Users/AIR2K/Data/20_Projects/20.34_LAYERS/apps/LAYERS_DESKTOP/`
Checkpoint log (append after EVERY phase): `docs/research/shell-swap/checkpoint.md`

## What this is

The human rejected a week of patch-on-patch CSS restatements (§19/§20/§21 + three
runtime shim hosts) and gave explicit permission to REPLACE WWW_PAINT's shell with
the actual LAYERS frontend. This is a swap, not another coat of paint:
- `index.html` is rebuilt around LAYERS's markup structure.
- The stylesheet is rebuilt FROM `LAYERS_DESKTOP/src/desktop.css` (copied verbatim as
  the base, then a clearly-delimited adapter section maps WWW_PAINT's panel internals
  onto LAYERS components). The §19/§20/§21 restatement blocks are RETIRED (deleted).
- The chrome-reparenting shims (`ui-chrome-host.js`, `controls-disclosure-host.js`) are
  RETIRED (deleted; their imports/calls removed). Their useful behavior is rebuilt
  natively in markup/CSS or folded into the kept hosts.
- `js/ui/app.js`, `js/ui/controls.js`, and ALL `js/engine/*` are ThinkPad-owned:
  **NEVER EDIT THEM.** The new shell must satisfy their existing DOM contracts.

## Already done and verified — DO NOT REDO

- Pre-edit oracle captured at `docs/research/shell-swap/oracle/pre-edit/`:
  - Unit tests: engine/wetsim/masks/outlines/order/shaping/ref-analyze/style-library/
    export-panel/style-polish/modular-bridge/modular-switch ALL exit=0 Failed:0.
  - Maestro at own widths: desktop-regression 40/0, mobile-ui-audit 30/0,
    media-panel 31/0, export-panel 35/0 (extra flows appended to summary.txt).
  - **visual-regression.cjs is PRE-BROKEN on this tree: pass=0 fail=9** (engine
    baseline drift from ThinkPad uncommitted changes — see oracle log). The gate is
    therefore "hashes must not CHANGE vs `oracle/pre-edit/visual-regression.log`",
    NOT "9/9 pass". Do not attempt to fix the baselines. Do not edit the harness.
  - Engine/style file hashes: `oracle/pre-edit/engine-hashes.txt` (91 files).
  - Before screenshots: `oracle/pre-edit/wwwpaint-before-{1440,390}.png`.
- LAYERS reference captured (working state, software GL, dark theme):
  - `oracle/parity-expanded-1440.png`, `oracle/parity-navbar-1440.png`,
    `oracle/parity-expanded-390.png`, `oracle/parity-navbar-390.png`
  - `oracle/parity-probe.json` + `oracle/layers-deep-probe.json` — measured geometry.
  - LAYERS reference server: http://127.0.0.1:8096/ (serves dist/, hash-verified).
  - WWW_PAINT dev server: http://127.0.0.1:8099/ (repo root, serves disk live).

## Reference design facts (measured from the running LAYERS app — these are the spec)

Shell stack (bottom→top): `.base` black `#0a0b0d` → `.panel` rails SAME black
(zero seam, no border, no tint) → `.canvas-card` bright window ON TOP, inset
`--gap:12px` from rails → glass pill toolbar bottom-centre of the window.

At 1440×900 (Expanded mode):
- `#app` border-radius 20px (`--r-shell`), overflow hidden, height 100%.
- Left rail 240px (`--panel-left-w`), right rail 288px (`--panel-right-w`), both
  `position:absolute; top:0; bottom:0; z-index:1`, bg = base = rgb(10,11,13).
- `.canvas-card`: absolute, z-index 2, top/bottom 12px, left = 240+12 = 252,
  right inset = 288+12 → rect x252 y12 w888 h876. Radius 28px (`--r-canvas`).
  Background `linear-gradient(160deg,#6b7787 0%,#525c6b 52%,#5f6a79 100%)`.
- `.canvas-head`: 39px tall, padding 8px 12px, font 11px, color rgba(255,255,255,.72),
  border-bottom 1px rgba(0,0,0,.18).
- `.canvas-body`: flex:1, `display:grid; place-items:center`, ambient background =
  two radial accent glows (rgb(122 162 255/.30) at 12% 4%, /.22 at 96% 96%) over
  `linear-gradient(160deg,#7c8898,#5d6775)`.
- `#frame`: natural canvas size scaled by transform (zoom-to-fit ≈ 40% AREA of the
  body — measured 43.7%), bg #111, border 1px #363c46, radius 8px (`--r-row`),
  shadow `0 16px 40px -10px rgb(0 0 0/.6)`. Floats centred with bright surface on
  all four sides. THE FRAME MUST NOT FILL THE WINDOW (the rejected build filled 77%).
- Panel chrome: `.panel-strip` padding 12px 12px 0 (logo 10px/700/0.16em uppercase,
  strip-name 11px, strip-chip 11px); `.panel-head` padding 12px 12px 8px,
  `.panel-title` 10px/600/0.1em uppercase color #8b95a3; collapse-btn 24×24.
- `.radius-bar`: fixed right 20px bottom 20px, glass `rgb(10 11 13/.80)` +
  blur(32px) saturate(1.25) brightness(0.45), radius 8px, border 1px #363c46,
  shadow 0 24px 60px -12px. Contains Radius 16/28/44 + Panels Expanded/Navbar.
- Pill toolbar (`.insert-bar`): bottom-centre of canvas-body, radius 999px, same
  glass, height 40px, buttons 30px tall 11px text.
- Typography: system font stack (`-apple-system, BlinkMacSystemFont, "Segoe UI",
  Roboto, sans-serif`), body 13px, tree rows 12px padding 5px 8px radius 8px,
  section heads 10px/600 uppercase, `.ctl` rows min-height 32px, label basis 88px,
  value 46px right-aligned tabular-nums. NO Doto, NO Geist — LAYERS uses system.
- Collapsed rails: width 56px (`--nav-w`), icons only (`.rail-icons` display:flex),
  strip shows logo initial only, canvas-card gets `.nav-left`/`.nav-right` and
  insets become 56+12.
- ≤1180px: rails 200/248. ≤900px: rails 110/110, nav-w 44, radius-bar becomes a
  centred wrap row above the pill, insert labels hidden, strip wraps.
- ≤900px on load: BOTH rails start collapsed (navbar mode) — main.ts does this.
- Light theme: `[data-theme="light"]` token column exists in desktop.css — copy it.
- Radius buttons set `--r-canvas` = 16/28/44px and `--r-panel` = max(6, round(v*0.7)).
- Expanded/Navbar buttons collapse/expand BOTH rails and sync aria-pressed.

## The DOM contracts the new shell MUST satisfy (from ThinkPad-owned code — read them)

`js/ui/app.js` (initApp + App):
- Required ids: `paint-canvas`, `controls-root`, `layers-root`, `export-root`;
  optional `status-bar` (if missing, status calls no-op — but KEEP it, see below).
- `#canvas-area` = the canvas WINDOW element (gets `.nav-left`/`.nav-right` classes
  from `_setPanelCollapsed`; is the drop zone; must contain `.file-input-picker`).
- `#canvas-dims`, `#canvas-mode` (text spans in the canvas head),
  `#canvas-placeholder` (role=status, contains `.canvas-placeholder__icon svg`,
  `__title`, `__hint`, and the `.file-input-picker` input).
- Collapse: `.collapse-btn` inside each `.panel`; `btn.closest('.panel')`;
  desktop toggles `is-collapsed` on the panel + nav-left/right on `#canvas-area`
  (left if panel has `.panel--controls` or id `paint-toolbar`, else right).
  Mobile (≤768px) toggles `panel--mobile-closed` instead.
- Paint mode: `#btn-paint-mode` toggles `.panel--hidden` on `#controls-root` and
  `.paint-toolbar--active` on `#paint-toolbar`; `#paint-preset`, `#paint-color`,
  `#paint-weight` (+`#paint-weight-value`), `#paint-clear` live in `#paint-toolbar`.
- Status: `#status-bar` innerHTML is REWRITTEN by app.js with
  `<span class="status-item"><span class="status-label">…</span><span class="status-value">…</span></span>`
  ×3 + `<span class="status-item status-item--spacer"><span class="status__message" id="status-message">Ready</span></span>`.
  Style these as the LAYERS `.panel-footer` readout strip (11px tabular-nums,
  border-top 1px --border) — place `#status-bar` as the LEFT rail's footer
  (inside `#controls-root` after the scroll host, `margin-top:auto`) so it reads
  as LAYERS's quiet panel footer, NOT a tacked-on app-wide bar. app.js only
  replaces its innerHTML, so the container survives. `.status__loading`/
  `.status__error` classes must still be distinguishable (accent/error color).
- Nav wiring in index.html's inline script: `[data-nav]` buttons toggle
  `.panel--active` on `.panel--<target>` and `.nav-btn--active` on `.nav-btn`.
  KEEP the Brush/Layers nav buttons with `data-nav="controls"` / `data-nav="layers"`
  and keep panels carrying BOTH their old class (`panel--controls`, `panel--layers`,
  `panel--media`, `panel--library`) AND the LAYERS classes (`panel panel-left` /
  `panel panel-right`). The inline script is Mac-owned (index.html) — you may
  rewrite it, but every id/handler contract above must survive.

`js/ui/controls.js` (ControlsManager):
- Adds `.controls-panel` to `#controls-root`; PRESERVES children with classes
  `panel-strip`, `panel-head`, `rail-icons` (re-appends them after clearing);
  builds `.controls-scroll` > `section.control-section` (h3 `.control-section__title`
  + `.control-section__body`) ×6 + `.generate-btn-container` (Generate/Stop/Reset).
- Style picker: `.style-picker__trigger` etc. PATH ORDER: `.segmented` with 11
  `.segmented__btn` — MUST be a grid `repeat(4, minmax(0,1fr))` (a nowrap flex row
  overflows 240px: measured 748px needed). Sliders/inputs/selects inside bodies.

`js/ui/layers.js` (Mac-owned): preserves the same chrome classes; builds
`.layers-header` (Add layer btn) + `.layers-body#layers-list` with `.layer-row`
(`__main`, `__drag`, `__name`, `.layer-visibility-btn`, `__actions`,
`.layer-action-btn`, `.layer-opacity-row/-input/-value`, `.layer-tools-row`,
`.layer-blend-select`, `.layer-style-select`, `.layer-regen-btn`).

`js/ui/media.js` + `media-host.js` (Mac-owned): `#media-root` preserves chrome;
`.media-scroll` > `.control-section.media-section`; `.media-band-row` grid of band
toggles (`#media-masks-band-<key>`); host toggles `.panel--hidden` /
`.panel--mobile-closed` and `.nav-btn--active` on `#btn-media-mode`.

`js/ui/style-library.js` + host (Mac-owned): `#style-library-root` (host adds
`.panel--library`), `.library-scroll`, sections ABOUT/SAVE/PROFILES/IMPORT,
`.library-name-input`, `.library-action-btn`, `.library-list`, `#btn-library-mode`.

`js/ui/export-host.js` / `export-panel.js` (Mac-owned): `#export-panel-root` modal
(`.export-panel--open` class contract), `#btn-export-panel` nav button.
`js/ui/export.js` (ThinkPad): `#export-root` modal, `#btn-export` round button.
`js/ui/settings.js` (Mac-owned): `#settings-root`, `#btn-ui-settings`; sets
`data-theme` on `<html>`; DEFAULT_DARK tokens match LAYERS exactly. Keep
`<html lang="en" data-theme="dark">` as the default (LAYERS default).
`js/ui/a11y-hardening.js` (Mac-owned): runs last, names/focus-traps the live DOM.
`js/ui/react-host.js` (Mac-owned): `#react-root` > `#profile-root`, `#btn-react-surface`.
`js/ui/modular-switch-host.js` (Mac-owned): `#btn-modular-engine` (aria-pressed).
`js/ui/motion.js`: `#motion-controls` container gets `.motion-controls` +
`.motion-bar` (play group, `.motion-scrubber`, speed group) — style as the LAYERS
glass pill ON the canvas (bottom-centre, like `.insert-host`/`.insert-bar`).
`js/ui/audit-fix-host.js` (Mac-owned, KEEP — it carries real behavior: worker
generation, undo, guarded destructive actions, source preview, frame fit):
- queries `.canvas-frame` (frame element) and `.canvas-wrapper` (window element)
  → the new markup MUST keep class `canvas-wrapper` on `#canvas-area` and class
  `canvas-frame` on the frame div (alongside LAYERS's `canvas-card`/`frame` classes).
- `fitFrame()` sizes `.canvas-frame` to ~40% of window AREA (max 85%/72%) — this
  matches the reference proportion; KEEP it working. It sets inline width/height/
  aspectRatio; CSS must not fight it (no !important caps that break the fit).
- pins `.generate-btn-container` out of `.controls-scroll` to the panel bottom
  (`.audit-pinned-actions`) — style that pinned row as a quiet panel footer action
  block; Generate is the primary accent button.
- observes `#status-message`, toggles `.is-generating`/`.has-error-nearby` on the
  round generate button, `.audit-generating` on body, `#audit-toast` on body.
- adds titles to `.top-bar__center .nav-btn` — if you retire `.top-bar`, update
  this selector in audit-fix-host.js (Mac-owned, allowed) to the new nav container.

## Target markup (rebuild index.html around THIS — LAYERS structure, WWW_PAINT ids)

```
<div id="app">
  <div class="base" aria-hidden="true"></div>
  <div class="body">
    <aside class="panel panel-left panel--controls" id="controls-root" role="complementary" aria-label="Brush controls">
      <div class="panel-strip">
        <span class="logo">WWW_PAINT</span><span class="strip-sep"></span>
        <span class="strip-name">Untitled</span>
        <span class="strip-chip" id="strip-dims">1024 × 768</span>
        <button id="toggle-theme" class="strip-chip strip-chip--btn" …>sun svg</button>
      </div>
      <div class="panel-head"><span class="panel-title">Brush</span>
        <button class="collapse-btn" data-rail="controls" aria-expanded="true" aria-controls="controls-root">chevron-left svg</button></div>
      <div class="rail-icons">…icon buttons (Brush active, Color)…</div>
      <!-- controls.js builds .controls-scroll here -->
      <!-- #status-bar lives here as the panel footer (margin-top:auto) -->
      <footer class="panel-footer status-footer" id="status-bar" role="status" aria-live="polite">
        <span class="status__msg" id="status-message">Ready</span>
      </footer>
    </aside>
    <!-- sibling left-rail surfaces, same position, swapped by hosts:
         #paint-toolbar (.panel--controls paint-toolbar), #media-root (.panel--media),
         #style-library-root (.panel--library) — each with strip/head/rail-icons -->
    <aside class="panel panel-right panel--layers" id="layers-root" …>
      strip (sRGB · PNG chips) / head (Layers + collapse chevron-right) / rail-icons
      <!-- layers.js builds .layers-header + .layers-body -->
    </aside>
    <main class="canvas-card canvas-wrapper" id="canvas-area" role="main">
      <div class="canvas-head">
        <span>Canvas · <span id="canvas-dims">1024 × 768</span></span>
        <span class="canvas-head-spacer"></span><span id="canvas-mode">Generate</span>
      </div>
      <div class="canvas-body">
        <div class="canvas-frame frame" id="canvas-frame">
          <canvas id="paint-canvas" width="1024" height="768" class="paint-canvas"></canvas>
          <div class="canvas-placeholder" id="canvas-placeholder" role="status" aria-live="polite">
            …icon svg / "Drop an image to begin" / "Or click Open" / .file-input-picker input…
          </div>
        </div>
        <div class="motion-controls-root insert-host" id="motion-controls" role="region" aria-label="Playback controls"></div>
      </div>
    </main>
  </div>
  <div class="radius-bar" role="group" aria-label="View controls">
    Radius 16/28/44 buttons + Panels Expanded/Navbar buttons (LAYERS verbatim)
  </div>
  <!-- nav/actions: the 8 mode buttons + Open/Generate/Export/Settings.
       Place them as a LAYERS-style quiet block: mode switcher in the LEFT rail
       under panel-head (2-col grid of icon+label buttons, .nav-btn keeps
       data-nav contracts), action row in the RIGHT rail strip area or head.
       Every id survives: btn-media-mode, btn-library-mode, btn-paint-mode,
       btn-export-panel, btn-modular-engine, btn-react-surface, btn-load-image,
       btn-gener (round primary), btn-export (round), btn-ui-settings (round).
       On mobile (≤768px) these must remain reachable (see mobile contract). -->
</div>
<!-- modals + hidden inputs + importmap + module script (keep ALL imports/calls
     except ui-chrome-host + controls-disclosure-host; add shell-host) -->
<div id="react-root">…</div> <div class="modal" id="export-root">…</div>
<div class="export-panel" id="export-panel-root">…</div>
<input id="image-file-input" …> <div id="debug-root"></div> <div id="settings-root"></div>
```

Mobile contract (≤768px — app.js + flows depend on it):
- `#toggle-controls` and `#toggle-layers` floating `.mobile-toggle` buttons MUST
  exist (44×44, fixed, z-index above panels), hidden on desktop. app.js binds them;
  `toggle-controls` drives media-root when `_mediaMode` else controls-root.
- Panels get `panel--mobile-closed` (transform off-screen) — the new CSS must
  implement it for ALL left-rail surfaces AND layers (fixed overlay, z-index 90,
  top below any mobile chrome, width min(320px,85vw)).
- The mode/action buttons must be visible+reachable at 390px (a compact mobile
  chrome row is fine — but it must use LAYERS component styling, not the old
  top-bar look; flows assert visible text "Brush","Layers","Media","Paint","Open").
- ≤900px: rails default collapsed (navbar) like LAYERS; the mobile toggles open
  panels as overlays. Reconcile: at ≤768px use the overlay model (app.js mobile
  branch); 769–900px use LAYERS's narrow-rail model.

## NEW file: js/ui/shell-host.js (Mac-owned)

Small host that wires the LAYERS shell controls app.js does not own:
- radius buttons (set --r-canvas/--r-panel on documentElement, aria-pressed sync),
- Expanded/Navbar buttons (collapse/expand both rails VIA app._setPanelCollapsed
  so nav-left/right + aria stay consistent; sync aria-pressed),
- `#toggle-theme` (flip data-theme dark/light; reuse settings.js API if exposed,
  else set attribute + persist through __UISettings if available),
- ≤900px initial collapse (call app._setPanelCollapsed for both rails),
- keep `#strip-dims` in sync with `#canvas-dims` (MutationObserver or resize hook),
- re-entry guard (window.__shellHostApplied).
Load it in index.html AFTER initApp + hosts. Delete ui-chrome-host.js and
controls-disclosure-host.js and their imports/calls. If disclosure behavior
(collapsible control sections) is worth keeping, implement it in shell-host with
LAYERS `.prop-section.is-closed` styling — but sections must start EXPANDED
(flows assert STYLE/BRUSH/STRUCTURE visible without extra taps).

## Stylesheet rebuild

1. Copy `LAYERS_DESKTOP/src/desktop.css` VERBATIM to `css/layers-shell.css`
   (new file, link it FIRST in index.html). Do not modify it — it is the spec.
2. Rewrite `css/style.css` as: (a) the WWW_PAINT-specific component rules needed
   by controls.js/layers.js/media.js/style-library.js/export/settings/motion
   internals, restyled to LAYERS tokens/components (tree-row-like rows, ctl-like
   slider rows, section-head-like titles, glass modals like picker-sheet);
   (b) the mobile overlay model; (c) a11y floors (44px touch targets on mobile,
   focus-visible rings, reduced-motion). DELETE the §19/§20/§21 blocks and every
   "LATER-RESTATEMENT" banner. Keep @font-face declarations ONLY if still used —
   LAYERS typography is system-font; drop Doto/Geist usage from the shell.
   The old style.css is 5535 lines of accreted patches; the rebuild should be
   dramatically smaller. Preserve the `?v=` cache-bust pattern (bump the version).
3. Zero-seam rule: panels and base are the SAME `--bg-primary` value. No tint, no
   border on panels. The canvas window is defined by its bright gradient, not an outline.
4. Every form control themed (range thumbs/tracks, selects, color inputs, scrollbars).
   Inline SVG icons inherit currentColor. No emoji.

## Allowed files

- `index.html` (full rewrite of markup + inline script; keep importmap entries,
  bump ?v= on changed files)
- `css/style.css` (rebuild), `css/layers-shell.css` (NEW verbatim copy)
- `js/ui/shell-host.js` (NEW)
- `js/ui/audit-fix-host.js` (only: selector updates for retired .top-bar, and
  anything needed to keep its behavior working in the new shell)
- `js/ui/media-host.js`, `js/ui/style-library-host.js`, `js/ui/export-host.js`,
  `js/ui/react-host.js`, `js/ui/modular-switch-host.js`, `js/ui/a11y-hardening.js`,
  `js/ui/settings.js`, `js/ui/motion.js`, `js/ui/layers.js`, `js/ui/media.js`,
  `js/ui/style-library.js`, `js/ui/export-panel.js` (Mac-owned; edit only as
  needed for the new shell — prefer CSS over JS changes)
- DELETE: `js/ui/ui-chrome-host.js`, `js/ui/controls-disclosure-host.js`
- `maestro/*.yaml` (Mac-authored; update ONLY where the shell contract genuinely
  changed, with a recorded reason per edit — never rename app text to dodge a gate)
- `scripts/*-probe.cjs` (Mac-owned probes; same rule)
- `docs/research/shell-swap/**` (checkpoint, evidence, new parity probe)
- `AGENTS.md` §7 (append one entry at the end), `docs/research/parity4-log.md` (append)

## FORBIDDEN

- ANY file under `/Users/AIR2K/Data/20_Projects/20.34_LAYERS/` (read-only reference)
- `js/ui/app.js`, `js/ui/controls.js`, `js/ui/export.js`, `js/ui/canvas.js`,
  `js/ui/debug.js`, `js/engine/**`, `js/styles/**`, `js/vendor/**`,
  `tests/engine.test.js`, `scripts/visual-regression.cjs`, `scripts/parity-bench.cjs`,
  `tests/parity/**`, `index.maestro.html`, `js/ui/bundle.js`
- ANY git command (no add/commit/branch/push — Syncthing + BE pushes)
- Deleting any file not on the DELETE list above
- Re-baselining the 9 pinned styles or "fixing" the pre-broken visual regression

## Phases (checkpoint to docs/research/shell-swap/checkpoint.md after each)

### Phase 1 — audit + plan (write checkpoint)
Read the authority files (desktop.css, LAYERS index.html, main.ts shell controls,
app.js contracts, oracle JSONs). Write a short map: old shell element → new shell
element → contract preserved. List every id in the contract section and where it
lands. Do not edit yet.

### Phase 2 — the swap
Rebuild index.html + css per above; add shell-host.js; retire the two shims;
minimal host edits. Keep the app BOOTING after every sub-step (check
http://127.0.0.1:8099/index.html in a real browser: 0 pageerrors, panels render).

### Phase 3 — gates (raw output for EVERY gate, save under docs/research/shell-swap/gates/)
1. Unit tests (all 12 from the oracle) → Failed: 0 each.
2. `node scripts/visual-regression.cjs` → the 9 "got" hashes must EQUAL the
   pre-edit oracle's "got" hashes (pass=0 fail=9 is the PRE-EXISTING state;
   any CHANGE in a got-hash is a regression you caused).
3. `shasum -a 256 js/engine/*.js js/styles/*.js` → diff vs oracle/pre-edit/engine-hashes.txt = EMPTY.
4. Maestro at OWN widths (CHROME_BINARY="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
   ~/.maestro/bin/maestro test --headless --screen-size WxH):
   desktop-regression 1440x900, mobile-ui-audit 390x844, media-panel 390x844,
   export-panel 1440x900, a11y-sweep 1440x900, a11y-sweep-mobile 390x844,
   media-behaviour 1440x900, export-panel-mobile 390x844.
   Target: FAILED=0 each (COMPLETED counts may differ if you legitimately updated
   a flow — record why). Redirect to log files, grep counts; grep exit codes are
   NOT flow results.
5. NEW `scripts/shell-parity-probe.cjs` (Mac-owned, pattern: overlay-coverage-probe):
   at 1440x900 + 390x844 measure WWW_PAINT and assert vs the LAYERS oracle:
   shell radius 20px; canvas-card radius 28px; card insets (252/12 at 1440 expanded);
   rail widths 240/288; panel bg === base bg (exact rgb equality); frame area
   35–50% of canvas-body with positive margins all four sides; canvas-head ~39px;
   radius-bar present bottom-right; 0 hitFails / 0 pastViewport on visible controls;
   docOverflowX 0; collapsed mode → 56px rails + nav-left/nav-right on #canvas-area.
   Capture `docs/research/shell-swap/after-{expanded,navbar}-{1440,390}.png`.
6. Behavioural spot-checks in a real browser: Generate produces strokes (load
   test-images/* first), media toggle swaps the left rail, library toggle swaps,
   paint mode swaps, export modal opens/closes, theme toggle flips tokens,
   radius buttons change --r-canvas, Expanded/Navbar collapses both rails,
   undo toast works, status footer updates after generate.

### Phase 4 — side-by-side + vision
Compose side-by-side PNGs (reference | after) at 1440 expanded, 1440 navbar,
390 expanded, 390 navbar into docs/research/shell-swap/side-by-side-*.png.
Judge the OVERALL impression against the reference (bright lit window floating
over quiet black rails), not a checklist. Fix what reads wrong; re-run gates.

## Quota / interruption

If a quota error interrupts you, append exactly where you stopped to
checkpoint.md. The next run reads checkpoint.md first and resumes. Never
re-derive settled state from the oracle.

## Final answer format

- Files changed/created/deleted (explicit list)
- Every gate: raw command + raw output tail (no paraphrase)
- Contract checklist: each required id → present + working (measured)
- Side-by-side PNG paths
- Deferred items with reasons
- Which edits were yours vs pre-existing state
