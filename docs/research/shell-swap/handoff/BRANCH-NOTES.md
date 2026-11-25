# Branch notes — WWW_PAINT shell swap + component normalization (2026-11-24)

## What changed in THIS branch (Mac)
- Shell swap: WWW_PAINT now uses the LAYERS frontend wholesale.
  - index.html rebuilt on LAYERS markup; `css/layers-shell.css` is a verbatim copy of
    LAYERS_DESKTOP/src/desktop.css (hash e3a830ce95d8274c55da010e678b0d6f88c1eb280668f2222693237b1913111b).
  - css/style.css: §19/§20/§21 patch blocks retired; component-level LAYERS normalization;
    FINAL CENTRE FIX blocks (pill centred on canvas, radius-bar clear, content-sized pill,
    5px/2px LAYERS fill; Choose file a centred dark chip).
  - js/ui/shell-host.js added; ui-chrome-host.js + controls-disclosure-host.js deleted.
  - audit-fix-host.js, settings.js: shell-selector + theme fixes.
  - maestro mobile-ui-audit/media-panel: shell-contract assertion updates with reasons inline.
- Verified: 8 Maestro flows 0 FAILED; 12 unit suites pass; 0 page errors; no
  clipping/overflow; vision confirmed pill containment and centring.
- No git commands run; no ThinkPad-owned file edited.

## Pre-existing drift from ANOTHER writer (Syncthing, 2026-11-22/23) — NOT this branch
- New: js/engine/oil-impasto.js and js/engine/dli-paint/** (a new paint backend),
  js/ui/brush-maker.js.
- Modified: js/engine/painter.js, js/engine/renderer.js,
  js/styles/{oil,gouache,knife}.js, js/ui/app.js and many other style/engine files.
- These are legitimate, syntactically valid, and all tests pass on the current tree.
  DO NOT attribute them to this branch.

## Visual-regression baseline — ONE intentional change
- 8 of 9 pinned style hashes are byte-identical to the pre-edit oracle.
- `oil` changed:  `c3994341b4760341` -> `77227d503c69ef2d` (got hash).
  Cause: the other writer's `oil.js` now calls `renderOilImpasto()` from the new
  `oil-impasto.js` before the bristle fallback (verified by diff). This is an
  intended engine change, not a regression from the shell work.
- ACTION FOR BE: re-baseline ONLY `oil` in the visual harness when verifying this
  drop, or confirm the new hash is expected from the impasto work. Do not silently
  flip the other 8.
- Raw evidence: handoff/visual-regression-at-handoff.log, handoff/engine-hashes-at-handoff.txt.
