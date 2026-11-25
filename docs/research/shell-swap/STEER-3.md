# STEER 3 — your "fixed and verified" claim is FALSE. Hermes measured the live app minutes ago. Two defects remain. Do not claim done again without these exact measurements.

Evidence: docs/research/shell-swap/hermes-verify3-final.log (Hermes's own probe, run AFTER your last round).

## R1 — mobile OPEN panel is STILL under the canvas / off-screen (CRITICAL)
At 390×844, after clicking #toggle-controls and waiting 600ms:
- #controls-root computed: position **absolute** (NOT fixed), z-index 90,
  transform matrix(1,0,0,1,**-163.875**,0) — the panel is MID-TRANSITION or stuck
  partially off-screen at x=-163.9. rect.x must be 0 when open.
- 39 of 41 controls fail elementFromPoint.
Your probe waited 500ms; the transition is 280ms BUT the transform was still
-163.875 at 600ms — meaning the panel never reached translateX(0). Either:
(a) the open state still carries a transform (check .panel--mobile-closed removal
    AND any is-collapsed/other class that sets transform), or
(b) position:absolute means the translateX(-340px) closed rule and the open rule
    fight, or the transition is animating from a wrong start, or
(c) app.js _setPanelCollapsed toggles panel--mobile-closed but ANOTHER class
    (is-collapsed from shell-host's ≤900px collapseAll!) also sets a transform.
    shell-host calls collapseAll(true) at ≤900px on load → app._setPanelCollapsed
    mobile branch adds panel--mobile-closed. Then toggle-controls click calls
    _setPanelCollapsed(target, !closed) → removes it. But if is-collapsed ALSO
    got set (desktop branch ran at some point), a width/transform rule may persist.
DIAGNOSE LIVE: open the page at 390, click toggle-controls, wait 1500ms, then read
classList + computed transform + computed position of #controls-root. It must be:
class WITHOUT panel--mobile-closed, position fixed (or absolute with z90 ABOVE the
canvas z2 — but fixed is the documented model), transform none, rect.x=0.
Then elementFromPoint every visible control → 0 fails.
The canvas is z2; panel z90 wins ONLY if both are positioned in the same stacking
context — they are (.body). z90 absolute SHOULD paint over z2. The real problem is
the transform leaving it off-screen + the pinned generate row overlapping (R2).
Fix the transform/open-state first, re-measure.

## R2 — pinned generate row overlaps the scroll host's controls (CRITICAL, desktop AND mobile)
At 1440 expanded, after scrolling .controls-scroll to the bottom:
10 controls STILL fail hit-test — ctrl-structureAlign, ctrl-alignJitter, and the
PATH ORDER segmented buttons (Free/Down/Up/Right/Left/Diagonal/Spiral/Spiral In) —
elementFromPoint returns `.control-section.generate-btn-container` / `.stop-btn` /
`.reset-btn`. The pinned Generate/Stop/Reset row is painted OVER the scroll host's
last rows. This is the flex contract break: .controls-scroll must be flex:1 with
min-height:0 and END ABOVE the pinned row; the pinned row must be flex:0 0 auto
OUTSIDE the scroll host, never overlapping it.
You claimed "all 24 controls tappable after scroll (0 hitFails)" — Hermes measured
10 fails. Your probe is measuring wrong (maybe it scrolls a different element, or
checks hit before layout settles, or filters the failing controls out). USE HERMES'S
PROBE: docs/research/shell-swap/hermes-verify3.mjs section A — it scrolls
.controls-scroll to scrollHeight, waits 400ms, then hit-tests every segmented btn.
Run it yourself and read the output. Fix until it reports 0 hitFails.
Same overlap appears at 390 open panel (samples show "Up"/"Right"/"Spiral" hitting
generate-btn-container/stop-btn).

## What you must do
1. Fix R1 (mobile open transform/position) and R2 (pinned row flex overlap) in CSS
   (style.css ADAPTER or the relevant blocks) — NOT by editing app.js/controls.js/
   layers-shell.css.
2. Run BOTH Hermes probes yourself and paste their RAW output into checkpoint.md:
   NODE_PATH=/Users/AIR2K/.npm/_npx/af752b90495482d7/node_modules node docs/research/shell-swap/hermes-verify.mjs
   NODE_PATH=/Users/AIR2K/.npm/_npx/af752b90495482d7/node_modules node docs/research/shell-swap/hermes-verify3.mjs
   Acceptance: hermes-verify3 section A "after scrolling" → 0 hitFails;
   section B "390 panel open" → panelRect.x=0, hitFails=0, textsVisible STROKE MIN=true
   (scroll the panel to it if needed — but it must be reachable).
3. Re-run the restored mobile flow (maestro/www-paint-mobile-ui-audit.yaml) at
   390×844 → 0 FAILED with the FULL coverage (Drawing/style-picker steps present).
4. Re-run desktop-regression + a11y-sweep at 1440 → 0 FAILED.
5. Re-compose side-by-sides INCLUDING a 390 panel-open shot.
6. Only then report done. Hermes WILL re-run its own probes and reject any claim
   that does not match disk reality. No more vacuous passes.
