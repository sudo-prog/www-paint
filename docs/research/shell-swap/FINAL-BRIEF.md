# FINAL PASS — Normalize WWW_PAINT components to the LAYERS standard

Repo: /Users/AIR2K/Data/20_Projects/20.36_WWW_PAINT
Reference (READ ONLY): /Users/AIR2K/Data/20_Projects/20.34_LAYERS/apps/LAYERS_DESKTOP
Design spec: /Users/AIR2K/Data/20_Projects/20.34_LAYERS/docs/design-graphite.md and packages/ui/src/tokens.ts

The user rejected the current UI: "oversized buttons that are unaligned and
overflowing outside of the pill boxes. Mixture of slightly different style
shapes and different style text in different places." This is the LAST pass.

## Authority: measured evidence (all files in docs/research/shell-swap/)

### Vision review (vision-review.md — local qwen3-vl, real screenshots)
- hermes-expanded-1440: pill buttons not centred/aligned, "Painter" compressed
  between Settings and React; "Generate Painting" overlaps "Stop"; layer opacity
  sliders misaligned.
- hermes-navbar-1440: bottom-right controls are a "wrapped messy stack" —
  Media/Library/Paint/Brush/RADIUS/PANELS/Expanded/Navbar stacked vertically.
- hermes-navbar-390: mobile is clean — DO NOT BREAK MOBILE.

### Objective shape audit (audit-shapes.log — computed styles at 1440)
- `.radius-bar`: 9 buttons, TWO heights (44px + 26px), TWO radii (8px + 6px),
  parent 360x166 = wrapped stack. LAYERS: ONE 28px/6px shape, parent 444x54.
- `#insert-bar`: 6 buttons, heights 30px / radius 999px / font 11px all uniform
  EXCEPT weights 400 + 600 — "Painter" is bolder than its neighbours.
- `#motion-controls`: parent only 126px wide, 5th button (Pause) is 0x0.
- LAYERS insert-bar (measured): 604x40, 6 buttons each 30px/11px/999px, padding 0 12px.

### LAYERS component spec (desktop.css — the reference, do not edit it)
- .insert-bar: height 40, padding 4, gap 2, radius 999px, glass chrome.
- .insert-btn: height 30, padding 0 12px, font-size var(--text-xs)=11px,
  radius 999px, gap 6px, white-space nowrap, color text-secondary.
- .radius-bar: padding 12px 16px, gap 12px, radius 8px, glass chrome.
- .radius-btn/.nav-btn: padding 5px 12px, font-size 11px, radius var(--r-control)=6px,
  border 1px --border; aria-pressed=true -> accent wash.
- LAYERS has FIVE buttons in the radius bar (Radius 16/28/44, Expanded, Navbar).
  WWW_PAINT has NINE because it adds four mode buttons (Media/Library/Paint/Brush)
  that WWW_PAINT needs. Keep them, but give ALL NINE one identical 28px/6px shape.

## Goal
ONE consistent component vocabulary. Every button in the bottom chrome and the
radius bar must have the SAME height, SAME radius, SAME font size/weight and
SAME padding within its group; no wrapped stack; no overlap; nothing outside its
parent; mobile unchanged.

## Allowed files
- css/style.css (only; append a single clearly-delimited FINAL NORMALIZATION block
  at EOF with `!important` only where needed to beat the old 5900-line cascade)
- docs/research/shell-swap/** (briefs, audit output, screenshots)

## Forbidden
- LAYERS repo, js/**, index.html, maestro/**, any git command, visual-regression
  baselines. Do not delete or rewrite old style.css rules — override at EOF.
- Do NOT touch mobile (@media max-width:768px) behaviour — it passes vision.

## Phase 1 — normalize the shapes (CSS only)
1. `.radius-bar`: force ONE row (flex-wrap:nowrap), buttons all
   `height:28px; min-height:28px; border-radius:6px; font-size:11px; font-weight:500;
   padding:5px 10px; gap:2px; white-space:nowrap; box-sizing:border-box`.
   Bar width should be its natural content width (~500-560px) at bottom-right.
   Keep the glass (blur/border/highlight) already applied.
2. `#insert-bar` buttons: identical weight (pick 500 for all, including Painter),
   identical radius 999px, height 30px, padding 0 12px, gap 6px. All six labels
   visible and evenly spaced; no compressed button.
3. `#motion-controls`: parent natural width >= 408px at desktop so all five
   playback buttons render (Pause 0x0 currently). 30px pill buttons, 999px radius.
4. Fix Generate/Stop overlap in `.generate-btn-container`: flex row, children
   `min-width:0`, Generate `flex:1 1 auto` with ellipsis, Stop/Reset auto-width,
   all height 30px, no vertical overlap. Verify section title and rows unaffected.
5. Layer opacity sliders: consistent column alignment with labels/values (the
   vision review flagged misaligned handles). Keep them reachable/scrollable.

## Phase 2 — gates (raw output, save under docs/research/shell-swap/gates/FINAL-*)
1. Re-run `docs/research/shell-swap/audit-component-shapes.mjs` with NODE_PATH set
   to /Users/AIR2K/.npm/_npx/af752b90495482d7/node_modules. Acceptance:
   - radiusBar distinct.heights has exactly ONE value (28), distinct.radii ONE (6px)
   - actionPill distinct.weights ONE, outsideCount 0
   - motionPill outsideCount 0 and no 0-width button
2. Re-run `docs/research/shell-swap/hermes-verify.mjs` — geometry at 1440/390,
   navbar rails 56px, no page errors, no overflow.
3. Re-run `docs/research/shell-swap/probe-scroll-aware.mjs` — 0 real occluded.
4. Maestro at OWN widths (CHROME_BINARY=/Applications/Google Chrome.app/Contents/MacOS/Google Chrome):
   desktop-regression 1440x900, a11y-sweep 1440x900, mobile-ui-audit 390x844,
   media-panel 390x844 — all FAILED=0.
5. Capture fresh screenshots for vision review.

## Phase 3 — VISION GATE (mandatory, this is why the last passes failed)
Run `python3 docs/research/shell-swap/vision-review.py` in background (it uses
local qwen3-vl via /api/chat; ~3 min per image) OR call the same endpoint on the
fresh 1440 expanded + navbar screenshots. Read the output. If the review still
reports a wrapped stack, compressed button, overlap, or mixed shapes, FIX IT and
re-review. DO NOT report done on green Maestro alone — that is the exact mistake
that has been rejected repeatedly.

## Final answer
- Exact raw audit output showing one shape per group, 0 outside, no 0-width button
- Raw Maestro counts
- Vision review verdict on the NEW screenshots (quote it)
- Screenshot paths
- State clearly which checks were yours vs Hermes's independent re-run

## FOLLOW-UP FIX (user rejected final pass — "stuff floating outside the pill, not centred; Choose file white box not centred")
Hermes looked again with FRESH eyes (local vision + DOM), NOT just Maestro:
- VISION on look-pill.png: "No buttons hang outside the pill's boundary. No, it is not horizontally centred."
- DOM: #insert-bar rect x232..732 => centre 482. The canvas window (#canvas-area) is x252..1140 => centre 696. Pill is 214px LEFT of centre. Cause: FINAL NORMALIZATION steer fix 2 shifted it left to x? via `left: calc(...)` to dodge the radius-bar. WRONG — the pill must be centred on the canvas window like LAYERS's insert-host (left:50%, transform:translateX(-50%) inside .canvas-body), and the radius-bar must be moved VERTICALLY clear of it instead.
- Motion pill has the same left shift (centre ~? vs 696).
- Choose file (#library-import-file-btn): x61..139 centre 100, row x4..236 centre 120 — 20px left of centre, and user sees a "white box". Check for a native ::file-selector-button or a wrong .btn--ghost rule; make it a dark LAYERS-quiet chip, centred in the row (justify-content:center, gap 8px).

REQUIRED FIX (CSS only, append FINAL CENTRE FIX block at EOF):
1. `#insert-bar` and `#motion-controls`: `left:50% !important; transform:translateX(-50%) !important;` so their centre = canvas centre 696 at 1440. Keep them stacked vertically (motion above, action below) and INSIDE .canvas-body so 50% is the window centre.
2. Move `.radius-bar` to `bottom: 130px !important` (or top area) so it is VERTICALLY clear of the centred pill at bottom 12px / motion at 66px — no horizontal shift of the pills, ever. It may extend to the right edge; that is fine.
3. Choose file: centre it and ensure NO white native control — target `.library-import-row`, `#library-import-file-btn`, and its `::file-selector-button` if any: dark bg var(--bg-tertiary), 1px --border, 6px radius, 11px text-secondary, visible label "Choose file", centred in the row.
4. Re-run look-probe.mjs and assert: insert-bar centre within 4px of canvas-area centre; motion centre within 4px; choose-file button centre within 4px of its row centre; dark bg; vision review on a fresh /tmp pill crop says "centred". Only then report done.
