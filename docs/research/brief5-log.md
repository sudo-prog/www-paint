# BRIEF 5 — completion note (visual UI fix)

Implemented C1–C5 per `docs/research/ui-fix-brief5.md`. No ThinkPad-owned file
was edited; `js/ui/app.js`, `js/ui/controls.js`, `js/engine/**`, `js/ui/export.js`,
`js/ui/settings.js`, `js/ui/motion.js`, `js/ui/layers.js`, `tests/engine.test.js`,
`scripts/visual-regression.cjs`, `scripts/parity-bench.cjs` are untouched.

## Files changed

- `js/ui/ui-chrome-host.js` (NEW) — desktop chrome reparenting + detach on
  mobile + collapse observer + measured `--rail-chrome-h-*`.
- `js/ui/controls-disclosure-host.js` (NEW) — progressive disclosure over the
  six `.control-section`s.
- `index.html` — C2 chip copy (`sRGB` / `PNG`) + additive imports/calls for the
  two new hosts.
- `css/style.css` — appended banner-delimited `§21` block at EOF (rails-owned
  chrome, disclosure, focus rings, reduced motion). No existing rule modified.
- `maestro/www-paint-desktop-regression.yaml`,
  `maestro/www-paint-media-behaviour.yaml` — added scroll steps only, no
  assertion weakened, after the chrome moved and the panels gained 220px top
  padding.
- `scripts/brief5-probe.cjs` (NEW) — visual proof probe.

## Defects found and fixed during verification

1. `--rail-chrome-h-left/right` were written as bare numbers (`221`), so
   `padding-top: var(--rail-chrome-h-left)` was an invalid length and the
   panels kept 0px padding. Fixed to write `221px`.
2. `.b5-disclosure-toggle` styling was inside the desktop `@media (min-width:
   769px)` block, so mobile toggles rendered at 20px / `inline-block`. Moved
   the disclosure rules out to the global scope; desktop-only pieces (rail focus
   rings) stayed in the media query.
3. `html.b5-chrome-desktop .panel--controls` (class selector) lost to the
   existing `#controls-root { padding: 0 }` (ID specificity), so the chrome
   overlaid the panels. Switched the padding rule to `#controls-root` etc.
4. Maestro flows needed extra panel scrolls after the 220px top padding landed.

## Visual proof (real Chromium, 1440×900 / 390×844 / light / collapsed / resize)

Probe file: `scripts/brief5-probe.cjs` (23/23 PASS).

```
PASS 1440 dark chrome attached {"topbarDisplay":"none"}
PASS 1440 dark canvas exists
PASS 1440 dark canvas top band clear {"bandHitCount":0}
PASS 1440 dark canvas head at window top {"hit":"section#canvas-area.canvas-wrapper"}
PASS 1440 dark chrome inside rails
PASS 1440 dark mode switcher 2x4 {"buttons":8,"cols":"126px 126px","labels":8}
PASS 1440 dark action row present {"buttons":4}
PASS 1440 dark sRGB PNG chips {"chips":["sRGB","PNG"]}
PASS 1440 dark disclosure defaults {"actual":{"STYLE":"true","BRUSH":"true","STRUCTURE":"false","PATH ORDER":"false","MOTION & PATH":"false","COLOR":"false"}}
PASS 1440 dark no doc overflow
PASS 1440 dark no page errors
PASS 390 dark chrome detached {"attached":false,"topbarDisplay":"flex"}
PASS 390 dark original clusters restored
PASS 390 dark no doc overflow
PASS 390 dark no page errors
PASS 1440 light chrome uses theme tokens {"theme":"light","rootVar":"#ffffff","bg":"rgb(255, 255, 255)","color":"rgb(0, 102, 255)"}
PASS 1440 light canvas band clear
PASS 1440 light no page errors
PASS collapsed rails chrome state
PASS collapsed rails no page errors
PASS resize D->M->D attaches/detaches/reattaches
PASS resize restores original topbar order
PASS resize round trip no page errors
23/23 checks passed
```

Screenshots (saved):
- `docs/research/brief5-wp-1440-dark.png`
- `docs/research/brief5-wp-390-dark.png`
- `docs/research/brief5-wp-1440-light.png`
- `docs/research/brief5-wp-1440-rails.png`

## Maestro (15 flows, 0 FAILED)

```
www-paint-desktop-regression     1440x900  exit=0  COMPLETED=40  FAILED=0
www-paint-mobile-ui-audit       390x844   exit=0  COMPLETED=30  FAILED=0
www-paint-media-behaviour       1440x900  exit=0  COMPLETED=41  FAILED=0
www-paint-media-panel           390x844   exit=0  COMPLETED=31  FAILED=0
www-paint-a11y-sweep            1440x900  exit=0  COMPLETED=55  FAILED=0
www-paint-a11y-sweep-mobile     390x844   exit=0  COMPLETED=39  FAILED=0
www-paint-export-panel          1440x900  exit=0  COMPLETED=35  FAILED=0
www-paint-export-panel-mobile   390x844   exit=0  COMPLETED=20  FAILED=0
www-paint-style-library-desktop 1440x900  exit=0  COMPLETED=37  FAILED=0
www-paint-style-library         390x844   exit=0  COMPLETED=37  FAILED=0
www-paint-primitive-mixer      1440x900  exit=0  COMPLETED=14  FAILED=0
www-paint-maestro-check        1440x900  exit=0  COMPLETED=12  FAILED=0
ui-fix-verification            1440x900  exit=0  COMPLETED=35  FAILED=0
www-paint-modular-switch       1440x900  exit=0  COMPLETED=7   FAILED=0
www-paint-style-picker         1440x900  exit=0  COMPLETED=14  FAILED=0
TOTAL: 447 COMPLETED / 0 FAILED
```

## a11y sweep

```
@ 390px   controls 48  underMin 0  noName 0  noFocusRule 0  focusRemoved 0  offViewport 0 (rail 0)  clipped 0  docOverflowX 0  scrollContainers 0  overlays 3  live 7  anims 1  reducedRules 17  errors 0
@ 768px   controls 48  underMin 0  noName 0  noFocusRule 0  focusRemoved 0  offViewport 0 (rail 0)  clipped 0  docOverflowX 0  scrollContainers 0  overlays 3  live 7  anims 1  reducedRules 17  errors 0
@ 1024px  controls 32  underMin 0  noName 0  noFocusRule 0  focusRemoved 0  offViewport 0 (rail 0)  clipped 0  docOverflowX 0  scrollContainers 0  overlays 3  live 7  anims 1  reducedRules 17  errors 0
@ 1440px  controls 32  underMin 0  noName 0  noFocusRule 0  focusRemoved 0  offViewport 0 (rail 0)  clipped 0  docOverflowX 0  scrollContainers 0  overlays 3  live 7  anims 1  reducedRules 17  errors 0
@ 1920px  controls 32  underMin 0  noName 0  noFocusRule 0  focusRemoved 0  offViewport 0 (rail 0)  clipped 0  docOverflowX 0  scrollContainers 0  overlays 3  live 7  anims 1  reducedRules 17  errors 0
UNIQUE under-min-target controls (across all widths): 0
UNIQUE controls with no accessible name: 0
```

(The 8 listed "no :focus-visible rule" entries are the pre-existing layer-panel
controls whose `focusVisibleStyle` is not computed by the layers open-state pass;
per-width `noFocusRule` is 0.)

## overlay-coverage probe

```
@ 390px  all 6 surfaces ok (pastViewport 0 hitFail 0 clip 0 underMin 0 targetOverflowX 0 docOverflowX 0)
@ 1440px all 6 surfaces ok (pastViewport 0 hitFail 0 clip 0 underMin 0 targetOverflowX 0 docOverflowX 0)
```

## visual-regression (oracle check)

`scripts/visual-regression.cjs` reports `pass=0 fail=9` against the committed
baselines, which is the **pre-existing** drift documented in AGENTS.md §0.7.
The got hashes match the BRIEF 5 oracle exactly:

```
pencil 1a0742d757bc1264  ink a20a11829fc2aff5  watercolor b1361f5226c6e681
oil c3994341b4760341  charcoal 9db50efff8af17bd  marker e5c661d49f4a9d46
cross-hatch 234c6d746c3638ed  halftone 1d04b52fa87bae9b  graphic 3d2f4addc5622c65
```

No re-baseline was performed; the 9 pinned styles + engine hashes are unchanged.

## Unit tests

Engine suite `177/177` pass; style-library `62/62`; export-panel `90/90`;
primitive-mixer `20/20`; modular-switch `22/22`; r4 `43/43`; modular-bridge
`29/29`. No failures.

## Definition of done

At 1440×900 dark, WWW_PAINT now reads as one black shell with two seamless
full-height panels, a clean bright canvas window with nothing floating over its
top, the canvas header inside the window at top, the artwork frame centred, and
one playback pill at the bottom. The left panel shows the quiet mode switcher +
disclosure sections (STYLE and BRUSH open, the other four collapsed) + the
pinned Generate row. All gates above are green.