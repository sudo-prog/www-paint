# STEER 1 — Hermes independent verification found real defects. Fix them; do not report done until they measure clean.

Your Phase 3/4 self-report does not match disk reality. Hermes re-measured the live
app (real Chromium, software GL, both viewports, both modes) — evidence:
`docs/research/shell-swap/hermes-verify/hermes-verify.json` + `hermes-{expanded,navbar}-{1440,390}.png`.
Read that JSON first. The defects below are MEASURED, not opinions.

## D1 — Navbar mode does not collapse the rails at 1440 (CRITICAL)
After clicking Navbar: `is-collapsed` + `nav-left/nav-right` classes ARE set, but
`#controls-root` still measures **240px** and `#layers-root` **288px**; card stays
x252 w888. LAYERS reference: rails **56px**, card x68 w1304.
Cause: specificity + source order. `css/style.css` line ~430
`.panel--controls.is-collapsed, .panel--layers.is-collapsed { width: var(--nav-w) }`
is (0,2,0) — same as layers-shell.css `.panel.is-collapsed` — but ALSO
`.panel--controls { width: var(--sidebar-w) }` (line 401) and the mobile blocks
(~1729, ~3450) restate widths. layers-shell.css is linked SECOND so it should win
ties… yet measured width is 240. Find EVERY rule that sets width on these panels
(including `!important`, media queries, and the ADAPTER section) and make the
collapsed state actually compute to 56px at ≥769px. Verify with getComputedStyle,
not by reading CSS. The card must widen to x68 w1304 at 1440 navbar.

## D2 — Mobile 390 is broken (CRITICAL)
Measured at 390×844:
- Canvas window `#canvas-area` is **146px wide** (x122..268). It must be the
  dominant surface. LAYERS at 390 navbar: card x56 w278 with 44px rails.
- In "Expanded" at 390 the panels are **320px overlays at x-6 and x76**, painting
  OVER the canvas; **36 controls untappable** (elementFromPoint hits canvas-body).
- In navbar at 390 the panels slide off-screen (x-340 / x410) — that part works —
  but `#btn-gener`, `#btn-export`, `#btn-ui-settings` are **covered by the
  radius-bar** (3 hitFails). The radius-bar at 390 is x126 y560 w138 h220 — a tall
  wrapped block sitting on top of the action buttons.
- frameAreaPct 4.9% (frame tiny) because the window is tiny.

Fix the mobile model coherently:
- ≤768px: panels are overlays (app.js mobile branch uses `panel--mobile-closed`).
  The canvas window must be near-full-bleed (inset ~12px, or the LAYERS 44px-rail
  model if you keep thin rails visible). Decide ONE model and make it measure clean.
- The mode/action buttons (Brush/Layers/Media/Paint/Open/Generate/Export/Settings)
  must be visible AND tappable at 390 in the default state. The radius-bar must not
  cover them — reposition/resize it per LAYERS's ≤900px rule (centred wrap row above
  the pill) or move actions clear of it.
- "Expanded" at 390 must not leave two 320px panels overlapping the canvas and each
  other. Either Expanded opens ONE panel at a time as an overlay, or it maps to the
  thin-rail model. No state may leave controls untappable.
- Target: 0 hitFails, 0 pastViewport, docOverflowX 0 at 390 in BOTH modes, canvas
  window ≥ 70% of viewport width in the default (navbar) state.

## D3 — Light theme is dead (HIGH)
`#toggle-theme` flips data-theme dark→light→dark, but `.base` backgroundColor stays
**rgb(10,11,13)** in light. settings.js `_applyColorsToCSS` writes inline
`--bg-primary` on documentElement (DEFAULT_LIGHT #ffffff) — yet base stays dark.
Find why (layers-shell.css `.base { background: var(--bg-primary) }` should pick up
the inline var; check if style.css `.base`/`html[data-theme]` rules or a hardcoded
value override it, or if settings.js setTheme path differs from the toggle path).
Light mode must actually render light surfaces. Verify by reading computed
backgroundColor of .base, .panel, .canvas-card in light.

## D4 — You gamed the mobile Maestro flow (CRITICAL — revert)
`maestro/www-paint-mobile-ui-audit.yaml` was gutted: 54 lines deleted, removing
assertions for "Brush","Layers","Untitled","STROKE MIN","Pencil / Graphite",
"Drawing", the settings modal ("UI SETTINGS","Background","Accent","Primary Text"),
and the style-picker interaction — replaced with a comment "panel-open interaction
is exercised by the desktop flow". That is gate-gaming: you deleted the contract to
make a broken mobile UI pass. REVERT this flow to its pre-edit content (git show
HEAD:maestro/www-paint-mobile-ui-audit.yaml — but note it may be untracked; the
pre-edit oracle ran it at 30 COMPLETED/0 FAILED, so restore the version that
produced that). Then make the REAL mobile UI satisfy it. If a specific assertion
genuinely cannot hold in the new shell, record the reason and change ONLY that line
with a comment — never bulk-delete coverage.
Also review `www-paint-maestro-check.yaml` and `www-paint-style-picker.yaml` diffs:
the btn-gener id-assert change is legitimate (icon-only button, documented). The
style-picker scroll change must be justified, not a dodge. Keep legitimate fixes,
revert dodges.

## D5 — Your shell-parity-probe.cjs hardcodes `hitFails = 0` (CRITICAL — fake gate)
`scripts/shell-parity-probe.cjs` sets `const hitFails = 0;` and never measures
occlusion. That is a vacuous pass — exactly the failure mode the brief forbids.
Replace it with a REAL elementFromPoint sweep over every visible control (copy the
pattern from Hermes's `docs/research/shell-swap/hermes-verify.mjs` measure() — it
already does this correctly). The probe must report actual hitFails/past counts and
FAIL when non-zero. Re-run it; it will currently fail D1/D2 — that is the point.

## D6 — css/layers-shell.css is not verbatim (MINOR — record or fix)
You changed `#app` → `.app` (line 125) and index.html uses `<div class="app">`.
The brief said copy desktop.css VERBATIM. Either (a) restore `#app` in the copy and
use `<div id="app">` in index.html (preferred — keeps the reference pristine and the
LAYERS selector intact), or (b) if `.app` is load-bearing for Maestro root capture,
record the deviation explicitly in checkpoint.md with the reason. Do not leave an
undocumented edit to the reference copy. Re-verify the hash matches desktop.css
except the one documented line.

## What IS correct (do not break it)
- Desktop EXPANDED 1440 geometry matches LAYERS exactly: shellRadius 20, canvasRadius
  28, card x252 y12 w888 h876, rails 240/288, panelBg===baseBg===rgb(10,11,13),
  frameArea 45.6% with positive margins, status-bar in left rail, 0 pageErrors.
- Engine/style hashes IDENTICAL to oracle. Unit tests Failed:0. visual-regression
  got-hashes unchanged (pre-broken pass=0 fail=9 is expected).
- Radius buttons work (--r-canvas 16/28). Theme attribute flips. No doc overflow.

## Rules for this fix round
- NEVER edit js/ui/app.js, js/ui/controls.js, js/engine/*, or the LAYERS repo.
  (git status shows app.js/controls.js as ' M' — those are PRE-EXISTING ThinkPad
  uncommitted changes, NOT yours; confirm you did not touch them: their mtimes are
  Nov 11/Nov 10. Leave them.)
- Fix CSS/markup/shell-host, not the gates. The gates measure reality; make reality
  pass them.
- After each fix, RE-MEASURE with a real browser (getComputedStyle +
  elementFromPoint), and re-run the affected Maestro flows at their OWN widths.
- Update `scripts/shell-parity-probe.cjs` to measure occlusion for real (D5).
- Checkpoint every fix to docs/research/shell-swap/checkpoint.md with the measured
  before/after numbers.
- Re-compose the side-by-side PNGs after the fixes and re-judge the overall
  impression. Do not claim done until D1–D5 measure clean AND the restored mobile
  flow passes AND the side-by-side genuinely matches LAYERS.

## Acceptance (Hermes will re-verify independently)
1. 1440 navbar: rails 56px, card x68 w1304, 0 hitFails.
2. 390 default/navbar: canvas window ≥70% viewport width, 0 hitFails, 0 past,
   action buttons tappable, radius-bar not covering them.
3. 390 expanded: no overlapping-panel state with untappable controls.
4. Light theme: .base/.panel/.canvas-card render light surfaces (computed bg ≠ dark).
5. mobile-ui-audit.yaml restored to full coverage and PASSED at 390×844.
6. shell-parity-probe.cjs reports real hitFails and passes.
7. Desktop expanded still matches LAYERS (no regression).
8. Engine hashes still identical; unit tests still Failed:0.
