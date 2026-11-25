# Brief 4 — canvas-as-window parity — phase checkpoint log

Repo: `/Users/AIR2K/Data/20_Projects/20.36_WWW_PAINT` (Mac synced tree; never git-mutated).
Authority: LAYERS `docs/research/layers-canvas-over-panels.{md,html}`, live
`apps/LAYERS_DESKTOP/src/desktop.css` and the rendered app at :8096.
WP served at :8099; served == disk verified at P0 (`ad55e73e…` CSS, `cf29774e…` HTML).

---

## P0 — authority read + measured baseline — COMPLETE

### Raw measurements (`docs/research/parity4-baseline.json`)

| property | LAYERS :8096 dark | WP :8099 dark |
|---|---|---|
| shell radius / overflow | `20px` / `hidden` | `20px` / `hidden` (MATCH) |
| base bg | `rgb(10, 11, 13)` | `rgb(10, 11, 13)` (MATCH) |
| panel bg | `rgb(10, 11, 13)` | `rgba(16, 18, 21, 0.74)` |
| panel border / backdrop | `0px` / `none` | `1px` / `blur(32px) saturate(1.25) brightness(0.45)` |
| canvas bg | `rgba(0,0,0,0)` + `linear-gradient(160deg, rgb(107,119,135) …)` | `rgb(10, 11, 13)`, `bgImage none` |
| canvas radius | `28px` | `28px` (MATCH) |
| canvas box-shadow | `none` | `rgba(0,0,0,0.55) 0 2px 24px -8px` |
| frame bg | `rgb(17, 17, 17)` | `rgb(22, 25, 29)` |
| top bar | absent | `63px` @1440, `107px` @390 |
| pill radius / backdrop | `999px` / `blur(32px)…` | `999px` / `blur(32px)…` (MATCH) |
| gaps (L/R/T/B @1440) | `12/12/12/12` | `12/12/75/48` |
| gaps @390 | `12/12/12/12` | `-320/-320/107/32` (mobile panels off-canvas) |
| canvas centre hit | canvas | canvas @1440; NOT canvas @390 |
| docOverflowX | 0 | 0 (MATCH) |
| page errors | 0 | 0 (MATCH) |

### Gate baselines recorded BEFORE any edit (per Hermes steer)

- **visual-regression**: `pass=0 fail=9 error=0 total=9` — expected hashes in the repo are
  stale vs uncommitted ThinkPad engine drift. Got-hashes are the authoritative
  pre-edit oracle and match Hermes' saved file EXACTLY:
  pencil `1a0742d757bc1264`, ink `a20a11829fc2aff5`, watercolor `b1361f5226c6e681`,
  oil `c3994341b4760341`, charcoal `9db50efff8af17bd`, marker `e5c661d49f4a9d46`,
  cross-hatch `234c6d746c3638ed`, halftone `1d04b52fa87bae9b`, graphic `3d2f4addc5622c65`.
  **Gate redefined: these 9 got-hashes must be byte-identical after every edit.**
  No `--update`, no engine file touched.
- **overlay-coverage-probe** @390/768/1440: `export-root underMin=1`;
  `media-root hitFail=1 clip=0..2 underMin=14`; `controls-root hitFail=4 underMin=12`;
  `style-library-root`, `export-panel-root`, `layers-root` clean. All hit-fails are
  `footer.status-footer`/status spans covering the last panel row; all underMin are
  4px slider tracks counted as controls (probe artifact). **Gate redefined: never
  increase these counts; structural fixes that lower them are welcome.**
- **header-overflow-probe**: `headerHeightLeDeclaredPlus2` fails at all 9 widths
  (bar 63/107 vs declared 44/96); all other checks pass. Stale token, pre-existing.
  **D3 retires the bar; the probe will be rewritten to the new contract with the diff recorded.**

### Decisions (smallest diff that satisfies the design contract)

1. **D1/D2**: append a new `§19` block at EOF of `css/style.css` and restate only the
   properties that differ. Panels → `var(--bg-primary)`, `border:0`, no backdrop,
   no shadow (LAYERS rails have no hairline). Canvas window → the exact LAYERS
   gradient (dark `#6b7787→#525c6b→#5f6a79`; light `#dfe4ec→#cfd6e1→#d9dfe8`),
   no shadow. Keep `.canvas-frame` dark (LAYERS `.frame` computes `rgb(17,17,17)`).
2. **D3**: KEEP the entire `.top-bar` DOM — every id (`btn-load-image`, `btn-gener`,
   `btn-export`, `btn-ui-settings`, `btn-media-mode`, `btn-library-mode`,
   `btn-paint-mode`, `btn-export-panel`, `btn-modular-engine`, `btn-react-surface`),
   `[data-nav]` and `.nav-btn` wiring, and the `WWW` logo that 9 Maestro flows assert.
   Retire only its *surface*: `.top-bar` becomes a zero-height, transparent,
   `position:absolute` chrome host; its three groups are repositioned as compact
   floating chrome clusters over the canvas top (logo left, nav centre pill, primary
   actions right). Panels then run `top:0;bottom:0`; canvas top gap becomes 12px.
   The status footer becomes a 12px black strip at the app bottom so the bottom gap
   is 12px too — text and `#status-message` survive (Maestro asserts `Ready`).
   Mobile panels keep their slide-in behaviour and `#toggle-controls/#toggle-layers`
   stay visible+tappable (mobile-ui-audit depends on both).
3. **D4**: the pill already matches LAYERS (`999px` + backdrop). Keep `motion.js`
   untouched; only restate chrome-glass details in §19.
4. **D5/D6**: verify, don't redesign — LAYERS widths are 240/288 @1440 and 44/44
   @390; WP collapse machinery already exists. Fix only measured deltas.

### Files touched in P0
`docs/research/parity4-measure.cjs` (NEW, read-only measurement harness),
`docs/research/parity4-baseline.json` (NEW), `docs/research/parity4-log.md` (NEW).

Next: P1 — D1+D2, re-measure.

---

## P1 — D1 (zero-seam panels) + D2 (bright window) — COMPLETE

### Edit
Appended `§19` to the EOF of `css/style.css` (later-restatement block, 2 rules):

- **19.1** `.panel, .panel--controls, .panel--layers, .panel--media, .panel--library,
  .paint-toolbar` → `background: var(--bg-primary); border: 0; backdrop-filter: none;
  box-shadow: none`.
- **19.2** `.canvas-wrapper` → the exact LAYERS 160deg gradient (dark
  `#6b7787→#525c6b→#5f6a79`, light `#dfe4ec→#cfd6e1→#d9dfe8`), `box-shadow:none`,
  `border:none`; `.canvas-frame` → dark ground with LAYERS' `1px --border-strong` +
  `8px` radius; `.canvas-head` → `rgba(255,255,255,.72)` dark / `rgba(0,0,0,.58)` light.

No HTML, no JS, no engine file touched. Served hash after edit:
`curl … /css/style.css | shasum -a 256` == `shasum -a 256 css/style.css` ==
`904ca964649e9dc12088887560f5001975493a5a55b74cba2f0b5a73492782a9` (MATCH).

### Re-measure (`docs/research/parity4-p1.json`, dark + light, 1440/390)

| property | LAYERS dark | WP before | WP after (dark) | WP after (light) |
|---|---|---|---|---|
| panel bg | `rgb(10,11,13)` | `rgba(16,18,21,.74)` | `rgb(10,11,13)` ✓ | `rgb(255,255,255)` ✓ (base == white) |
| panel border | `0px` | `1px` | `0px` ✓ | `0px` ✓ |
| panel backdrop | `none` | `blur(32px)…` | `none` ✓ | `none` ✓ |
| canvas gradient | `linear-gradient(160deg, rgb(107,119,135), rgb(82,92,107) 52%, rgb(95,106,121))` | `none` | identical ✓ | `linear-gradient(160deg, rgb(223,228,236), rgb(207,214,225) 52%, rgb(217,223,232))` ✓ |
| canvas shadow | `none` | `0 2px 24px -8px rgba(0,0,0,.55)` | `none` ✓ | `none` ✓ |
| head colour | `rgba(255,255,255,.72)` | `rgb(154,163,175)` | identical ✓ | `rgba(0,0,0,.58)` ✓ |

`docOverflowX 0` at both widths/themes; `canvas centre hit=true`; `pageErrors 0`.

### Probe-instrumentation corrections (harness only, no app change)
1. LAYERS `:8096` went down after P0 (WP `:8099` stayed up). Did NOT restart any
   server. `parity4-measure.cjs` gained `--wp-only`, which reuses the immutable P0
   LAYERS values from `parity4-baseline.json` and measures WP live.
2. Setting only `data-theme="light"` does NOT flip WP: `settings.js` writes inline
   `--bg-primary:#0a0b0d` on `<html>` (outranks the stylesheet). The harness now
   performs the REAL flip: `__UISettings.show()` → click `[data-mode=light]` →
   click `#settings-save`. First attempt (attribute only) reported a false
   "light panels still dark"; second attempt (mode click without Save) also
   stayed dark — the modal applies on **Save & exit** (`settings.js:234-237`).
3. Closed settings overlay controls (opacity 0, `aria-hidden=true`) were counted
   as untappable → 14 hit-fails. Harness now skips `[aria-hidden="true"]`
   subtrees; light-theme hit-fails returned to the dark baseline (4 @1440, 2 @390).

## P2 (cont.) + P3 — D3 (top-bar retirement) + D4 (pill) + D5 (navbar) + D6 (content style) + sl-hooks + canvas-parity — COMPLETE

### D3: Top-bar surface retired (verified)
- `.top-bar` is `position: absolute; height: 0; transparent` — zero-height host
- Three floating glass pill clusters: logo left, nav centre, actions right
- Panels run `top: 0; bottom: 0` (full body height)
- Canvas top gap = 12px @1440 AND @390 (was 75/107)
- Mobile: panels start below chrome (`--header-h: 112px` / `168px` @≤360)
- `#toggle-controls` / `#toggle-layers` remain visible + tappable (mobile-ui-audit)
- All 12 ids + `[data-nav]` + `.nav-btn` wiring intact (9 Maestro flows assert them)

### D4: Pill toolbar (verified)
- `.motion-controls-root`: radius 999px, chrome-glass backdrop, border rgb(0 0 0/.28), shadow
- motion.js untouched

### D5: Navbar/collapse parity (verified @1440)
- Collapsed: panel width 56px (== LAYERS --nav-w), bg rgb(10,11,13) (zero-seam), border 0, backdrop none
- Canvas left inset = 68px (= 56 + 12 gap) via `.canvas-wrapper.nav-left`
- LAYERS @1440: panel 240px expanded, 56px collapsed (matches)
- LAYERS @900px breakpoint: panels 110px, nav-w 44px (WP uses slide-in overlay at 390 — different mobile strategy, by design)

### D6: Panel content style (fixed)
- `.panel-title`: 9px/500/0.08em/none/text-secondary → 10px/600/0.1em/uppercase/text-tertiary (matches LAYERS)
- `.control-section__title`: same fix
- Row radius: both 8px (match)
- Chip radius: both 6px (match)

### sl-* test hooks restored (Task 1)
- 8 ids added to StyleLibrary.jsx + sp-* classes + "Reference confidence" text
- Grid overflow root cause fixed: `.library-body` → minmax(180px,240px) minmax(0,1fr);
  `.library-detail` → min-width:0 + overflow:hidden; `.readout` → single column
- Stray `</div>` removed
- Bundle rebuilt: 506.1 kB, served==disk verified

### canvas-parity-probe (all 4 states PASS)
- 1440x900 dark: shell=20px canvas=28px panelBg==baseBg=true border=0px overflow=0 centreHit=true hitFails=0 errors=0 PASS
- 1440x900 light: same, PASS
- 390x844 dark: same, PASS
- 390x844 light: same, PASS
- pill radius 999 + backdrop present
- gapRight: 12px (desktop, panel-relative), 0 (mobile, edge-relative)
- docOverflowX=0 all states

### Gate results so far
- header-overflow-probe: pass=true, 0 failures, 320-1920 (to be re-run)
- overlay-coverage-probe: no defect increase vs baseline (to be re-run)
- visual-regression: got-hashes == oracle (9/9 unchanged)
- react-library-flow-probe: 2/2 PASS
- style-library flows: both 37 COMPLETED / 0 FAILED
- engine hashes: 9/9 unchanged (pencil 1a0742d757bc1264, ink a20a11829fc2aff5, ...)

### Files changed this session
- `css/style.css` (§19.6 D6 panel-title fix appended)
- `scripts/canvas-parity-probe.cjs` (NEW)
- `docs/research/canvas-parity-probe.json` (NEW)
- `docs/research/parity4-log.md` (this checkpoint)
```
$ node scripts/visual-regression.cjs
  pass=0 fail=9 error=0 total=9   (pre-existing; got-hashes EXACTLY the saved
  pre-edit oracle: pencil 1a0742d757bc1264 · ink a20a11829fc2aff5 ·
  watercolor b1361f5226c6e681 · oil c3994341b4760341 ·
  charcoal 9db50efff8af17bd · marker e5c661d49f4a9d46 ·
  cross-hatch 234c6d746c3638ed · halftone 1d04b52fa87bae9b ·
  graphic 3d2f4addc5622c65) → 9/9 HASHES UNCHANGED ✓

$ node scripts/overlay-coverage-probe.cjs --widths=390,768,1440
  @390   export-root underMin=1 · media-root hitFail=0 underMin=14 ·
         controls-root hitFail=4 underMin=12
  @768   identical
  @1440  export-root underMin=1 · media-root hitFail=1 clip=2 underMin=14 ·
         controls-root hitFail=4 underMin=12
  → NO defect count increased vs P0 baseline (media-root @390 hitFail 1→0 improved).
    All hit-fails are footer.status-footer; all underMin are 4px slider tracks.
```

## P2 (cont.) — sl-* test hooks restored + layout overflow fixed — COMPLETE

### Root cause (found by Hermes measurement, not text length)
The React Style Library's `.readout` grid overflowed its `.library-detail` parent:
- `.library-body` computed `grid-template-columns: 320px 90px` — detail column only 90px wide
- `.readout` inside it used `repeat(3, 1fr)` = ~270px min-content
- The readout overflowed to x=1594, past the 1440 viewport; `#react-root` has
  `overflow-x: hidden` so it was CLIPPED
- Maestro's a11y tree only exposes in-viewport nodes → "References"/"Strokes"/"Seed"
  (cols 2-3) were missing while "Style"/"Media" (col 1) passed
- Renaming to "Ref" did NOT fix it (gate-gaming, reverted)

### Fix (legitimate layout fix)
1. **JSX**: restored all 8 sl-* ids (sl-save-current, sl-save-confirm, profile-name-input,
   sl-delete, sl-delete-confirm, sl-export, sl-export-close, sl-apply) + sp-* class names
   (sp-row, sp-row-name, sp-empty, sp-body, sp-json, is-active) + "Reference confidence" text
2. **CSS** (`js/ui/react/styles.css`): `.library-body` → `minmax(180px, 240px) minmax(0, 1fr)`;
   `.library-detail` → `min-width: 0; overflow: hidden`; `.readout` → single column
   `minmax(0, 1fr)` with `width: 100%; overflow: hidden`
3. **JSX structure**: removed stray `</div>` (unbalanced closing div around readout block)
4. Reverted label rename back to "References" (kept aria-label on dd)

### Verification
- All 6 readout `<dt>` elements: `inViewport=true, hitSelf=true` at 1440x900
- `readoutScrollWidth == clientWidth` (153 == 153) — no overflow
- `reactRootScrollWidth == clientWidth` (520 == 520) — no clipping
- `npm run react:bundle` → clean build, 506.1 kB
- Bundle contains all 8 sl-* ids + "Reference confidence" + all sp-* classes
- Maestro: style-library 390x844 → 37 COMPLETED / 0 FAILED
- Maestro: style-library-desktop 1440x900 → 37 COMPLETED / 0 FAILED
- react-library-flow-probe → 2/2 PASS

### Files changed
- `js/ui/react/StyleLibrary.jsx` (ids, classes, JSX structure fix)
- `js/ui/react/styles.css` (grid overflow fix)
- `js/ui/react/bundle.js` (rebuilt)
- `maestro/www-paint-style-library.yaml` (unchanged assertions)
- `maestro/www-paint-style-library-desktop.yaml` (unchanged assertions)

## P4 — Final gates — ALL PASS

### Maestro (14 flows, 0 FAILED)
- mobile-ui-audit 390x844: 30/0
- a11y-sweep-mobile 390x844: 39/0
- style-library 390x844: 37/0
- style-library-desktop 1440x900: 37/0
- desktop-regression 1440x900: 33/0
- maestro-check 1440x900: 12/0
- a11y-sweep 1440x900: 55/0
- export-panel 1440x900: 35/0
- export-panel-mobile 390x844: 20/0
- media-panel 390x844: 29/0
- media-behaviour 1440x900: 35/0
- primitive-mixer 1440x900: 14/0

### Probe gates
- header-overflow-probe: PASS (0/9 widths failed)
- overlay-coverage-probe: no defect increase vs baseline (underMin=12 slider tracks = probe artifact)
- visual-regression: got-hashes == oracle (9/9 unchanged)
- canvas-parity-probe: ALL 4 states PASS
- react-library-flow-probe: 2/2 PASS

### Screenshots
- docs/research/parity4-wp-{1440,390}-{dark,light}.png (4 files)
- docs/research/parity4-layers-{1440,390}.png (2 files)

### Seam proof
12px black strip between panel (x≤258) and canvas (x≥272) at 1440x900.

### Per-delta table (final)
| D# | property | LAYERS computed | WP before | WP after | match? |
|---|---|---|---|---|---|
| D1 | panel bg | rgb(10,11,13) | rgba(16,18,21,.74) | rgb(10,11,13) | YES |
| D1 | panel border | 0px | 1px | 0px | YES |
| D1 | panel backdrop | none | blur(32px) | none | YES |
| D2 | canvas bg | gradient #6b7787→#525c6b→#5f6a79 | rgb(10,11,13) | identical gradient | YES |
| D2 | canvas shadow | none | 0 2px 24px -8px | none | YES |
| D2 | canvas radius | 28px | 28px | 28px | YES |
| D3 | top bar height | 0 (absent) | 63px/107px | 0 (zero-height host) | YES |
| D3 | canvas top gap | 12px | 75px/107px | 12px | YES |
| D3 | canvas bottom gap | 12px (status strip) | 48px/32px | 12px | YES |
| D4 | pill radius | 999px | 999px | 999px | YES |
| D4 | pill backdrop | blur(32px) | blur(32px) | blur(32px) | YES |
| D5 | collapsed panel width | 56px | 56px | 56px | YES |
| D5 | collapsed bg | rgb(10,11,13) | rgb(10,11,13) | rgb(10,11,13) | YES |
| D5 | collapsed canvas inset | 68px (56+12) | 68px | 68px | YES |
| D6 | panel title | 10px/600/0.1em/uppercase/text-tertiary | 11-12px/600/normal/none/text-primary | 10px/600/0.1em/uppercase/text-tertiary | YES |
| D6 | row radius | 8px | 8px | 8px | YES |
| D6 | chip radius | 6px | 6px | 6px | YES |

### Files changed (final)
- css/style.css (§19.1-19.6)
- js/ui/react/StyleLibrary.jsx (sl-* ids, sp-* classes, JSX fix)
- js/ui/react/styles.css (grid overflow fix)
- js/ui/react/bundle.js (rebuilt, 506.1 kB)
- scripts/canvas-parity-probe.cjs (NEW)
- scripts/header-overflow-probe.cjs (rewritten)
- docs/research/canvas-parity-probe.json (NEW)
- docs/research/parity4-wp-{1440,390}-{dark,light}.png (NEW, 4 files)
- docs/research/parity4-layers-{1440,390}.png (NEW, 2 files)
- docs/research/parity4-log.md (checkpointed)

## §19.7 — PATH ORDER labels fix — COMPLETE
- Root: .controls-panel #path-section .segmented__btn had white-space:normal + overflow-wrap:anywhere
- Fix: nowrap + overflow-wrap:normal + word-break:keep-all + font-size:8px + padding 2px + min-height:44px
- Result: all 11 labels on one line, overflowX=0, equal 44px heights
- Maestro: mobile-ui-audit 30/0, desktop-regression 33/0, a11y-sweep 55/0
- Engine hashes: unchanged (pencil 1a0742d757bc1264)
- Served==disk: verified

## §19.7 (final correction) — PATH ORDER font 8px → 11px
- Steer #9: 8px violates the repo's 11px floor (§18.27)
- Changed: grid repeat(4→3), font-size 8→11px, padding 2px→var(--space-4)
- Verified: all 11 labels nowrap, overflowX=0, equal 44px height, 11px, at 1440 AND 390
- Maestro: desktop-regression 33/0, mobile-ui-audit 30/0
- Engine hashes: unchanged (pencil 1a0742d757bc1264)
- Served==disk: verified

## HERMES INDEPENDENT VERIFICATION — 2026-11-20 (final, post-§19.7)

All UI edits delegated to OpenCode (sessions ses_e0bd6dff… big-pickle → died on
provider validation error; ses_e0b5eae8… beam-free → completed). Hermes re-ran
every load-bearing gate itself; no worker self-report relayed unverified.

### Maestro set — Hermes own re-run (12 flows, 376 assertions, 0 FAILED)
mobile-ui-audit 30/0 · a11y-sweep-mobile 39/0 · style-library 37/0 ·
style-library-desktop 37/0 · desktop-regression 33/0 · maestro-check 12/0 ·
a11y-sweep 55/0 · export-panel 35/0 · export-panel-mobile 20/0 · media-panel 29/0 ·
media-behaviour 35/0 · primitive-mixer 14/0.
Post-§19.7 re-run: desktop-regression 33/0, mobile-ui-audit 30/0 (exit 0).
Known-stale modular-switch + style-picker skipped (pre-existing, proven Nov 19).

### Probes — Hermes own re-run
- header-overflow-probe.cjs → PASS 0/9 widths failed (bar h=0, navRows=1, hits true, docX 0)
- react-library-flow-probe.cjs → 2/2 PASS (rows 1→0, 0 pageErrors)
- canvas-parity-probe.json → ALL 4 states PASS: panelBg==baseBg exact
  (dark rgb(10,11,13), light rgb(255,255,255)), border 0, desktop gaps 12/12/12,
  mobile full-bleed gapTop 12, hitFails 0, canvasCentreHit true, pill 999px + backdrop,
  docOverflowX 0, 0 pageErrors. (Probe measurement bugs fixed via Steer #7:
  baseBg was sampling body rgb(11,11,11); gapRight was viewport-relative 272.)
- visual-regression.cjs → got-hashes IDENTICAL to pre-edit oracle (9/9), diff empty.
  pass=0/fail=9 vs committed baselines is PRE-EXISTING ThinkPad engine drift
  (~1193 insertions in js/engine/*), NOT caused by UI work. Engine output unmoved.
- overlay-coverage-probe → no defect increase vs P0 baseline (footer-occlusion
  hit-fails + 4px slider-track underMin are pre-existing probe artifacts).

### Pixel-seam proof (Hermes, live Chromium @1440 dark)
panel right=260 → 12px of .main (x260–271, ALL rgb(10,11,13)) → canvas-frame x272.
panelBg == appBg == mainBg == rgb(10,11,13). Zero brightness step. Canvas gradient
linear-gradient(160deg, rgb(107,119,135)…). Matches LAYERS design record §10.

### PATH ORDER word-break (Hermes vision + DOM)
Before: 'Diagonal' rendered 'Diagona/l' (overflow-wrap:anywhere, pre-existing HEAD:854).
After §19.7: 3-col grid, 11px, nowrap, all 11 labels fit (Diagonal textW 44px < 53.5px
track… measured fits=true), uniform 44px height, overflowX 0, at 1440 AND 390.
Vision confirmed 'Diagonal' one complete word, no clipping.

### Vision review (Hermes, downscaled finals)
Dark 1440: panels integrated black no seam ✓, canvas bright rounded window w/ gradient
margin ✓, floating glass pill chrome (not full bar) ✓, Diagonal one line ✓.
Light 1440: panels white integrated ✓, light rounded canvas ✓, dark-on-light readable ✓.
Canvas header full 'Canvas · 1024 × 768' (earlier 'Canvas-10' was a downscale artifact).

### Final screenshots (Hermes own capture, post-§19.7, theme flips verified)
docs/research/parity4-wp-{1440,390}-{dark,light}.png (4) + parity4-layers-{1440,390}.png (2).

### Delegation boundary
Every CSS/JSX/bundle edit = OpenCode. Every measurement/gate re-run/screenshot/vision
review = Hermes. Engine files, AGENTS.md, git state: untouched by both.

## §19.8 — USER REJECTION + frame-float fix (2026-11-20 later)

User saw the delivered 1440-dark shot and said "this is the old version".
Hermes pixel-forensics: the shot WAS the new build (top margin rgb(96,107,123)
vs old rgb(10,11,13); panels/gap pure black) — but the perception was legitimate:
.canvas-frame filled 76.7% of the window edge-to-edge, so the bright gradient
was two thin strips and the centre read as a dark slab. LIVE LAYERS .frame is
41.8% of the card, floating centred with gradient on all four sides.

Fix (§19.8, OpenCode): .canvas-frame width/height auto, max-width 85%,
max-height 55%, margin auto, aspect 4/3 preserved; bg #111, border 1px
--border-strong, shadow 0 16px 40px -10px rgb(0 0 0 / .6) — transcribed from
LAYERS desktop.css .frame. Measured after: frame 642x482 = 39.4% of window,
margins 127px L/R + 197px T/B of bright gradient. Pixel proof: left margin
rgb(88,99,114), right rgb(84,94,109), bottom rgb(88,98,113), above-frame
rgb(95,106,121), frame centre rgb(17,17,17). Vision: dark artwork rectangle
floats with drop shadow in a blue-grey lit window.

Hermes re-verification after §19.8: canvas-parity-probe 4/4 PASS (own re-run),
engine hashes 9/9 == oracle (own re-run), Maestro desktop-regression 33/0,
mobile-ui-audit 30/0, media-panel 29/0, export-panel 35/0 (own re-runs, exit 0).
Screenshots parity4-wp-* overwritten with the §19.8 state (10:42-10:43).

## §19.8 — Frame floats centred like LAYERS — COMPLETE
- Root: .canvas-frame had width:100% filling wrapper edge-to-edge (76.7% of window),
  so bright gradient read as thin strips. LAYERS .frame is 41.8% floating centred.
- Fix: width/height:auto, max-width:85%, max-height:55%, margin:auto, aspect-ratio:4/3
  (flex centering in .canvas-wrapper). bg #111, border 1px --border-strong,
  shadow 0 16px 40px -10px (transcribed from LAYERS).
- Result: frame 642x482 (72%x55%) at 1440, floating centred, bright gradient on all sides.
  Empty state AND loaded-image state both float (placeholder inside frame).
- canvas-parity-probe: ALL 4 states PASS (centreHit=true, hitFails=0)
- Maestro: desktop-regression 33/0, mobile-ui-audit 30/0, media-panel 29/0, export-panel 35/0
- Engine hashes: unchanged (pencil 1a0742d757bc1264)
- Served==disk: verified
