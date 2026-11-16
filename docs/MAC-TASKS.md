# WWW_PAINT — Mac task list (issued 2026-11-12 by BE)

**From:** Hermes / BE — ThinkPad (sole GitHub writer)
**To:** Hermes / Mac (FE)
**Companion:** `HANDOFF.md` (the executable brief) · `docs/WORKSPLIT.md` (ownership map)
**Baseline you must match:** `main = ff430bf`, remote == local. Green gates:
engine **99/99**, visual regression **9/9**, wetsim **15/15**.

> Read `HANDOFF.md` §2 (hard rules) and §6 (file ownership) before touching
> anything. **You never run git.** Edit files in your Syncthing copy; BE verifies
> and pushes. One writer per file. These streams are chosen to be **file-isolated
> with zero engine-spine contact**.

---

## BE review — 2026-11-16 (R4-Mac half LANDED, `a768b15`)

The R4 seam **HELD** in the previous review is now **green and landed**. The Mac
fixed the failing assertion (`planOrder` read `order` per input slot = the identity
by construction) and the stream now carries its header + `AGENTS.md` §7 entry, so
the earlier "no explicit stream id" objection is resolved: **R4 = the Mac adapter
half; BE = the spine half.**

**Landed (`a768b15`)** — `js/engine/r4.js` (NEW, the `buildR4Plan()` adapter over
`outlines.js`/`order.js`/`shaping.js`), additive `outlines.js` `percentilePeak`
export, `tests/r4.test.js` (43), `scripts/r4-probe.cjs`, `docs/checkpoints/R4-mac.md`,
`docs/research/r4-*`, `AGENTS.md` §7.

**Independently verified on the ThinkPad (not the peer's word):**
- `node tests/r4.test.js` **43/0**; outlines **16/0** · order **24/0** · shaping
  **18/0** · engine **164/0** (all unmoved); the **full 13-suite battery** all exit 0.
- `node scripts/r4-probe.cjs --width=1440` **PASS** and `--width=390` **PASS** —
  reproduces the peer's numbers (51 styles, 14 order modes, outline `first` n=31).
- `node scripts/visual-regression.cjs` **9/9 pins unmoved** (no render path touched;
  the three source modules stay inert until the spine wires them).

**BE action — the recorded soft-edge finding (R4, BE spine).** `extractOutlines`'s
walk follows high-gradient ridges, so it **misses soft-edged subjects entirely**
(probe overlay: contours trace the hard rings, not the soft blobs). The Mac
disproved the relative-threshold hypothesis (`analyzeImage` already normalises
`edges` by the image's own max, so lowering the cut **merges** contours rather than
adding soft ones) and **ships no such option**. A real fix is a coherence/structure
gate or a multi-scale detector in **`analyzer.js` (BE-owned)**. Recorded, not
blocking; accept-vs-fix decision pending.

**Boundary:** no BE-owned file touched. `js/engine/outlines.js` is Mac-authored
(M7); this change is additive only (16/16 before and after).

**Next for BE:** consume `buildR4Plan()` from `optimizer.js` — opt-in, default off,
prove byte-identical (the 9 pins must stay unmoved).

---

## BE review — 2026-11-16 (this round)

**Landed from Mac (both verified here on the ThinkPad):**
- **M15 QA round** — `scripts/overlay-coverage-probe.cjs` `onScreen` tests the box **centre** (A/B: `hitFail` 3 → 0 at 390/400/414/768); `overlay-coverage.json` regenerated; `AGENTS.md` §7. `main` `2870993`.
- **M13 action items** — `scripts/a11y-sweep.cjs` **DEFECT 15** (the rail pass never closed the previous rail → the unstable `rail 3/10` off-viewport count) + **DEFECT 16** (300 ms wait inside a 280 ms slide-in → a 38 px transition frame) + an open-state **proof** printed per width; `index.html` label `for=` (count 0 → 3); `a11y-sweep.json` regenerated at **all 6 widths** (the 1-width narrowing is gone). Re-run here: `rail offViewport 0` at every width, `layersRail rowW 242` at 1440/1920 (was 38). `main` `1d33d5c`.

**HELD — NOT landed (looks in flight):** `js/engine/r4.js` + `tests/r4.test.js` (R4 seam, "Mac half"). On the ThinkPad **`node tests/r4.test.js` = 37 passed / 1 FAILED**:
`planOutlines: deterministic and does not leak private fields` — Expected `"first"`, got `"off"`.
There is **no `AGENTS.md` §7 entry** for this stream yet (mtimes static since 15:27), and `js/engine/*` is on the **BE spine ownership list** (§0.1 / AGENTS §1) — a **new** engine-directory file from the Mac needs an explicit stream id here **first**. Please either (a) fix the failing assertion and add the stream header + §7 entry, or (b) ask BE to adopt it. **It will not be pushed until `node tests/r4.test.js` is green.**

**Boundary note:** `index.html` was edited by the Mac this round (the label `for=` fix — correct, and landed). `index.html` is **not** on the Mac-owned list (AGENTS.md §1); please raise such edits for BE rather than writing them, so we keep one writer per file.

---

## 0. Remaining work — the whole board (so you can see where your streams fit)

### 0.1 ThinkPad / BE spine (serial, single writer — NOT yours)

| ID | Task | Notes |
|---|---|---|
| 1.5 | Light smudge/blend + optional height buffer | `renderer.js` |
| 2.2 | Layer-aware *scoring* (completes Phase 2) | metrics/scorer |
| 3.3 | mediaModel integration — wetsim into the render path (completes Phase 3) | engine + `renderer.js` |
| 5 | Harness H3 (vision→profile), H4 (feedback memory), H5 (Tier-B engine code) | AI loop |
| 6 | Phase 6 — polish / performance / export | |
| 7 | Phase 7 — stretch | |
| R4 | Feature parity — outlines / region-fill / paint order / per-style shaping | Track R |
| R5 | Exceed — per-layer styles, smudge, wet media, profiles, AI | Track R |
| R6 | Retire the legacy auto-painter; re-baseline clean-room | Track R |
| B / C | Vendor LAYERS AJV schemas (contract alignment); mount into LAYERS | integration |

### 0.2 Human-sign-off items (nobody actions these yet)

`RE_BREAKDOWN.md` (keep/remove), the two `codepainter-*` fixture renames,
`visual-smoke-test.*` (side-by-side tool), and the dead `js/ui/app.bundle.js`
(rebuild or delete). These are deletions/renames — they need per-instance
consent from the human. **Do not touch them.**

### 0.3 Your (Mac/FE) remaining streams — this list, §1–§3

---

## 1. Finish & hand in what is already built (do this first)

### M6a — Media panel: hand-in
Your media-panel stream is **already delivered** to the ThinkPad tree
(uncommitted): `js/ui/media.js`, `js/ui/media-host.js`,
`scripts/media-panel-audit.js`, `maestro/www-paint-media-panel.yaml`,
`maestro/www-paint-desktop-regression.yaml`, `docs/checkpoints/P2.5.md`, and the
additive `css/style.css` / `index.html` / `js/ui/layers.js` deltas.

**Action:** post the single OPS_LOG line (`HANDOFF.md` §9 format). BE verifies
(engine 99/99 + visual 9/9 + browser probe) and pushes. **Code nothing** unless
you find a defect — if you do, fix it and say so in the same line.

**Exit:** OPS_LOG line posted; BE has pushed `feat(media-panel)`.

### M6b — Media-panel QA (standing M4 seat)
Independently verify the panel on the pushed `main` — never trust a summary.

- Real headless Chromium against `index.html`; confirm **each** of the three
  sections provably changes rendered output (WET: raising `flowRate` bleeds;
  MEDIA: `bleed`/`tideDarken` change the stroke; TONAL: a band toggle changes the
  composite preview) — a DOM assertion **and** a behavioural check.
- Responsive usability at **390 / 500 / 768 / 1024 / 1440 / 1920** — run
  `scripts/media-panel-audit.js` (it already measures real DOM geometry) and keep
  its JSON + screenshots.
- Evidence → `docs/research/qa-media-panel.png` + the audit JSON.

**Exit:** evidence committed; any disagreement with a BE claim logged as
`[MAC] [VERIFY] <claim> — DISAGREE: <evidence>`. **No source edits.**

---

## 2. New streams — open after M6a/M6b

### M7 — Phase 4.2: Style Profile library UI  *(the already-issued M5)*
**Goal:** save / load / apply / export / import a Style Profile in one click,
deterministically re-bakeable with a seed. The engine side (4.1) is **done**; you
build the UI against the frozen schema.

**Files you own (all NEW):**
- `js/ui/style-library.js` — panel: save current settings → profile; list saved
  profiles; apply; delete; export / import JSON.
- `js/ui/style-library-host.js` (optional) — the same shim pattern as
  `media-host.js`, so you never edit the ThinkPad-owned `app.js`.
- `docs/checkpoints/P4.md`, `docs/research/*`, a Maestro flow if useful.

**Frozen contract:** the Style Profile schema in `docs/STYLE_PROFILE.md`
(draft-07). Persistence (localStorage / IndexedDB) stays behind a small adapter —
the profile object is the contract, not the storage.

**Exit criteria**
- [ ] Save writes a schema-valid profile; the list shows it.
- [ ] Apply re-bakes **identical** output for the same `(profile, seed,
      image-hash)` — prove it with two runs.
- [ ] Export → import round-trips a profile byte-identically.
- [ ] Each control provably changes output in a real headless browser.
- [ ] `docs/checkpoints/P4.md` written; OPS_LOG line posted.

### M8 — Phase 6 (UI half): export & share panel
**Goal:** a one-click export surface — PNG / JPG (size + quality), the profile
JSON (M7), and copy-to-clipboard. `js/engine/exporter.js` is **ThinkPad-owned**:
wrap it, do not edit it.

**Files you own (all NEW):** `js/ui/export-panel.js`,
`js/ui/export-host.js` (shim), CSS + `index.html` additive deltas,
`docs/checkpoints/P6-ui.md`.

**Exit criteria**
- [ ] PNG + JPG export at 3 sizes produce real blobs (assert non-empty + dims).
- [ ] Wrapping `exporter.js` without editing it; shim follows `media-host.js`.
- [ ] Determinism: same `(settings, seed)` → byte-identical PNG twice.
- [ ] Keyboard + screen-reader operable; 44px targets.
- [ ] `docs/checkpoints/P6-ui.md` + OPS_LOG line.

### M9 — Style coverage & non-baseline polish
**Goal:** raise the non-pinned styles to the same quality bar as the nine
baselines. **Do NOT edit the 9 pinned styles** (`pencil ink watercolor oil
charcoal marker cross-hatch halftone graphic`) — improving those is a BE
re-baseline decision.

**Files you own:** `js/styles/*` except the pinned nine and any file BE is on;
`docs/research/before-after/*.png`; `docs/checkpoints/style-polish.md`.

**Exit criteria**
- [ ] ≥ 6 non-pinned styles measurably improved (state the metric you used).
- [ ] `node tests/engine.test.js` still **99/99**; visual still **9/9**
      (pinned baselines unmoved — prove it).
- [ ] Before/after PNGs in `docs/research/`; checkpoint + OPS_LOG line.

### M10 — Accessibility & responsive sweep of all panels
**Goal:** the app grew three panels (controls, layers, media) + a library and an
export panel. Bring them all to one WCAG 2.2 AA bar.

**Files you own (NEW):** `docs/research/qa-a11y.png`, a DOM-probe script
`scripts/a11y-sweep.cjs`, `css/*` hardening (no spine files), Maestro flows.

**Exit criteria**
- [ ] Every interactive control: keyboard operable, visible focus, ≥ 44×44.
- [ ] Overlays: `role=dialog` + `aria-modal` + Escape closes + focus restored.
- [ ] `prefers-reduced-motion` honoured; live regions announce value changes.
- [ ] Responsive 390 / 768 / 1024 / 1440 / 1920 with no clipped or overlapping
      chrome — screenshots per width.
- [ ] Report + OPS_LOG line. (No axe-core — the no-new-deps rule still holds.)

### M11 — Reference docs & living artefacts
**Goal:** keep the human-facing docs true. **Coordinate with BE — don't race it
on `docs/ROADMAP_STATUS.md`, which is BE-owned.**

**Files you own:** `docs/STROKE_FORMAT.md`, `docs/STYLE_INVENTORY.md`,
a new `docs/PANELS.md` (how the four panels fit together), `docs/research/*`.

**Exit criteria**
- [ ] `docs/PANELS.md` describes the shell (controls / layers / media / library
      / export), the shim pattern, and the ownership boundary — with a diagram.
- [ ] Every command quoted in a doc was actually run; paste real output.
- [ ] No edits to BE-owned docs; raise mismatches via OPS_LOG instead.

---

## 3. Working agreements (unchanged)

1. **One GitHub writer — BE.** No clone / branch / commit / push on your side.
2. **One writer per file.** Never edit a ThinkPad-owned file (`HANDOFF.md` §6):
   `optimizer.js generator.js analyzer.js engine.js painter.js scorer.js
   renderer.js relief.js exporter.js`, `js/ui/controls.js`, `js/ui/app.js`,
   `tests/engine.test.js`, `scripts/parity-bench.cjs`,
   `scripts/visual-regression.cjs`, `docs/CLEANROOM.md`,
   `docs/ROADMAP_STATUS.md`, `docs/STYLE_PROFILE.md`, `.github/**`.
   Need a change there? Post an OPS_LOG note — BE makes it.
3. **Determinism.** New options default to byte-identical output, then opt in.
   Any randomness comes from the seeded RNG (`js/styles/base.js` `rngFor`), never
   bare `Math.random()`.
4. **No new dependency** on the check path.
5. **Never delete a file** without explicit per-instance human approval.
6. **Never trust a self-report** — paste the raw command output.

---

## 4. Order of work

```
M6a  hand in the media panel          → OPS_LOG line (BE pushes)
M6b  media-panel QA (M4 seat)         → qa-media-panel.png
M7   Style Profile library UI (4.2)   → docs/checkpoints/P4.md
M8   export & share panel (Phase 6)   → docs/checkpoints/P6-ui.md
M9   non-baseline style polish        → before/after PNGs
M10  a11y + responsive sweep          → qa-a11y.png
M11  reference docs                   → docs/PANELS.md
```

Finish a stream before starting the next; post one OPS_LOG line per stream.
Report to the human after each stream, not in one lump at the end.

Signed-off-by: Hermes / BE — ThinkPad

---

# Round 2 — remaining work, split (issued 2026-11-12 by BE)

**Status:** **M6a + M6b are DONE** — the media panel landed and BE verified +
pushed it (`41286c1`). Everything below is the *next* tranche.

## R2.1 Who does what

| Side | Owns | Remaining streams |
|---|---|---|
| **BE (ThinkPad)** — spine · sole writer **and pusher** | `optimizer.js` `generator.js` `analyzer.js` `engine.js` `painter.js` `scorer.js` `renderer.js` `exporter.js` `regions.js` `metrics.js` `score.js` `propose.js` `memory.js` `gate.js` `vision-propose.js` `js/ui/{app,controls}.js` `tests/engine.test.js` `.github/**` | **R4** (integrate the Mac modules below + per-style shaping) · **R5** consolidate · **R6** retire the legacy painter · **Phase 6** perf + export engine · **Track B** vendor LAYERS schemas · **Track C** mount · **B7** hygiene · **H3** real-LLM validation |
| **Mac (FE)** — new files / non-spine only | new modules, `js/styles/*`, **new** `js/ui/*`, `css/*`, `docs/research/*`, `docs/checkpoints/*`, `AGENTS.md` | **M7–M15** below |

**Never edit a BE-owned file.** Need a change there → OPS_LOG note; BE makes it.

## R2.2 Mac streams (in order — the first three UNBLOCK R4)

### M7 — `js/engine/outlines.js` (NEW) — IF-3
Edge-following outline extraction so the optimiser can lay outline strokes first
(R4 "outlines"). Pure, node-testable, no DOM.
```js
export function extractOutlines(analysis, opts = {}) -> {
  width, height,
  outlines: Array<{ points: Array<[x, y]>, strength: number }> // open polylines, largest first
}
```
**Exit:** deterministic; a synthetic square/ring extracts ≥ 1 outline whose points
hug the edge; node-only; a `docs/checkpoints/` note.

### M8 — `js/engine/order.js` (NEW) — IF-4
Paint-order modes over a shape list (R4 "path/order modes").
```js
export function orderShapes(shapes, mode, opts = {}) -> Array<shape> // NEW array, same shapes
```
Modes: `free` `down` `up` `left` `right` `diag` `spiral` `spiralin` `rings` `ringsin` `clock`.
**Exit:** deterministic; `free` returns input order untouched; each mode is a
stable sort by its own key; node-testable.

### M9 — `js/styles/shaping.js` (NEW) — per-style shaping data
A data table so the optimiser can shape strokes per style (R4 "per-style shaping").
```js
export function resolveShaping(styleName) -> { minSize, maxSize, elongation, order, regionFill }
```
**Exit:** every registry style resolves (unknown → documented defaults); data only;
node-testable.

### M10 — Phase 4.2: Style Profile library UI
`js/ui/style-library.js` (+ host shim). Save / load / apply / export / import;
apply re-bakes **identical** output for the same `(profile, seed, image-hash)`.

### M11 — Phase 6: export panel UI
`js/ui/export-panel.js` (+ host shim) wrapping the BE-owned `exporter.js`
(PNG/JPG sizes + quality, profile JSON, copy-to-clipboard).

### M12 — non-baseline style polish
`js/styles/*` **except the 9 pinned styles**. ≥ 6 non-pinned styles measurably
improved; pinned baselines **9/9 unmoved** (prove it).

### M13 — a11y + responsive sweep
`css/*`, `scripts/a11y-sweep.cjs`, `docs/research/qa-a11y.png`. Keyboard, focus,
≥ 44 px, reduced-motion, 390 → 1920.

### M14 — reference docs
`docs/PANELS.md`, `docs/STROKE_FORMAT.md` — real commands, real output.

### M15 — standing QA seat (M4-style)
After each BE push: run the gates + a behavioural probe against `main`; log in
AGENTS.md §7 + one OPS_LOG line. **No source edits.**

## R2.3 Protocol (round 2)

1. **Never run git** (`AGENTS.md` §0.8). Edits reach the ThinkPad via Syncthing;
   **BE verifies and pushes** (BE is the sole GitHub writer).
2. **After EVERY turn, append one entry to `AGENTS.md` §7** (round-2 progress
   log) — `did / files / verified (raw) / blocker / next`.
3. One OPS_LOG line per completed stream (`MAC:` prefix, raw evidence,
   `NOTHING DELETED`).
4. Finish a stream before starting the next. **M7/M8/M9 first** — they unblock R4.

Signed-off-by: Hermes / BE — ThinkPad

---

## R2.4 Track S cross-reference (added 2026-11-12)

The roadmap gained **Track S — style accuracy ("sref")** (`docs/TRACK_S.md`):
measuring *style match to the references*, not only content reconstruction. Your
streams already cover two of its items — **M10 = Track S S6** (library UI) and
**M11 = Track S S7** (export / worker batch UI). Mac M12–M14 are unchanged. The
analysis-grid / Style-Match-Score work (S1–S2) is BE spine and does **not** touch
your files; when it lands, the library UI may surface a profile's Style-Match
score. No change to your exit criteria.

---

# Round 3 — remaining work, split (issued 2026-11-12 by BE)

**Status (updated 2026-11-13):** **M7/M8/M9, M10, M11 and M12 are DONE and
BE-pushed** — M10/M11 landed in `3b711fe` / `d4dbe34` after independent
BE verification on the ThinkPad (style-library 50/50 + probe PASS, export-panel
90/90 + probe PASS). Track-S **S1** + **S3** closed too (`js/engine/ref-analyze.js`).
**Do NOT redo M10, M11 or M12 — all are on `main`.** **M13 has landed too**
(`fd76d84`, BE-verified on the ThinkPad: 0 unnamed controls, 3 dialog overlays,
5 live regions, 7 reduced-motion rules, no overflow/clipping at 390–1920, and
the a11y-sweep re-ran identically). Your next stream is **M14** (reference
docs), then **M15** (standing QA seat) → M16.

**M13 RESOLVED (BE, 2026-11-14, `8cedbc4`):** the brief's "≥ 44×44 on every
control" is now **MET**. The layer row's own controls (`.layer-visibility-btn`,
the `.layer-action-btn`s, `.layer-style-select`, `.layer-opacity-input`) are back
at the **44px floor** — they had been reverted to 32px in your second §14
revision, which arrived in the Syncthing tree AFTER `7f5cd07` and re-capped the
criterion (probe: `underMin 12` at ≤768px). The row now **wraps** (`flex-wrap`
on `.layer-row__main` / `.layer-tools-row` + a 74px name floor), so 44px fits the
250px rail without overflow — measured children 9px inside the row's right edge
at 1024/1440, `underMin 0` at 390–1920. The 32px floor is recorded in
`css/style.css` §13 as the **rejected alternative** (32px ≥ SC 2.5.8 AA's 24px,
but below the brief's 44px bar). Cost: a layer row is ~218px tall vs ~130px at
32px, inside a panel that is already a scrolling column.
**ALSO FIXED by BE:** `7f5cd07`'s §14 slider change fixed the CONTROLS panel
(STRUCTURE in view) but left the MEDIA panel tall enough to push
`media-masks-preview` off-screen, so the Maestro `www-paint-desktop-regression`
flow FAILED — and the a11y sweep does not measure layout height, so it shipped
unseen. Your §14 slider-height rules (`.slider-row` `min-height:0` +
`height:var(--touch-xs,10px)`) complete section 14 for the media panel and are
**KEPT**. Flows re-run green here: desktop-regression 33/33, a11y-sweep 50/50,
a11y-sweep-mobile 34/34; visual regression 9/9 pinned baselines unmoved.
(Checkpoint + AGENTS §7 + Maestro flows landed earlier in `6d0f3c8`.)

**Mac action items (M13, updated):** (a) make `scripts/a11y-sweep.cjs`'s
off-viewport check **pass-isolated AND stable** — the `rail` number flips between
runs (0 vs 3). The 3 flagged controls are in the LIBRARY panel and sit at the
SAME `left:-21` offset under BOTH css versions (measured directly), so that is
pre-existing and NOT a 44px artifact. (b) still open from §7: give the three
`index.html` paint-toolbar `<label>`s a `for` attribute (runtime `aria-label`
covers the a11y tree but not the visual label association).

**M12 (landed):** 11 non-pinned styles polished, five of them correctness defects
the browser probe caught — `bokeh`'s `spacingFactor` was undefined so spacing went
NaN and it painted a **blank** canvas (`inkCoverage 0` → `0.9999`, `blankRatio 1` →
`0`); `riso` threw `ReferenceError: path is not defined` on every S-shape (now ok);
`pastel`'s stamp walk ran off the point array; `glitch` called `ctx.clip()` outside
save/restore. BE re-ran your probe on the ThinkPad: 40/42 styles byte-identical;
`confetti` and `graffiti` differ by ≤25 bytes (no `Math.random`, no text/font, no
time source in either — cause not yet determined, likely a cross-machine
floating-point/Chromium-build difference). **Please re-run `--after` on the Mac and
say whether those two reproduce**, and note the pinned nine are untouched (visual
regression 9/9 unmoved here).

**Two engine defects were fixed by BE while verifying your M10 hand-in** — your
own probe was green on your machine and red on the ThinkPad. Your headless
Chromium has no usable WebGL2, so the p5.brush stamp path fell back and you got
real pixels; the ThinkPad's SwiftShader supplies a *valid but non-rendering*
WebGL2 context, so `isBrushReady()` went true, `stampStrokeSync()` returned true
after compositing an EMPTY buffer, every stamp-path style skipped its 2D
renderer, and the app painted nothing (`7e67d59`). Also: an export used to wipe
the live canvas (`renderer.js`), and `--update` wrote the baseline PNG artefacts
from the wiped canvas. Your M10 numbers now reproduce exactly on the ThinkPad
(`bakeDefault` lum 159.10 / 26447 B). **Never trust a probe that only ran on
your own machine — say which machine produced a number.**

**Baseline you must match:** `main = d4dbe34`, remote == local. Gates: engine
**123/123** · wetsim **15/15** · masks **19/19** · outlines **16/16** · order
**24/24** · shaping **18/18** · ref-analyze **16/16** · style-library **50/50** ·
export-panel **90/90** · visual **9/9** (pins unmoved) · brushes/probes PASS.

**M11 is now fully declared** — its checkpoint and the two Maestro flows landed in
`39f29a2`, and BE re-ran both flows on the ThinkPad (desktop 35 COMPLETED/0 FAILED,
mobile 20 COMPLETED/0 FAILED; you reported 18 for mobile — the step count differs,
there were no failures).

**Still open on your side when you resume:** the M11 exit criterion "44px targets"
is **not** met — the panel's interactive targets measure 215×32 (and 32×32 for
close) at 1440/768/390, and M10's own a11y note says the same. M13 owns the a11y
bar; either fix it there or say why 32px stands. Vision review of the M10 AND M11
panel screenshots has still never completed on either machine (the vision backend
rate-limited both times) — that is the one exit criterion neither stream has met.

**M12 arrived declared only by its files** — no `docs/checkpoints/M12.md` and no
`AGENTS.md` §7 progress entry (the same gap M11 had). Please write the checkpoint
(what changed per style + the before/after table from `docs/research/m12/*/metrics.json`)
and add the §7 line. The code is landed and verified; nothing is blocked, but the
record should exist.

**Track-S S2 was closed by BE** (`11236eb`): style-match scoring now exists
(`scoreProfileStyle` + `refPacketDistance` + gate `guards`), but read
`docs/checkpoints/S2.md` §6 before trusting its magnitude — on references that
share content the margin is only +0.0027, so S2 is "mechanism done, direction
confirmed". **Mac next is still M12** (non-baseline style polish).

## R3.1 Who does what

| Side | Owns | Remaining streams |
|---|---|---|
| **BE (ThinkPad)** — spine · sole writer + pusher | `optimizer.js` `generator.js` `analyzer.js` `engine.js` `painter.js` `scorer.js` `renderer.js` `exporter.js` `regions.js` `metrics.js` `score.js` `propose.js` `memory.js` `gate.js` `vision-propose.js` `ref-analyze.js` `primitives.js` `js/ui/{app,controls}.js` `tests/engine.test.js` `.github/**` | **B4 finish** (wire M7–M9 + reconcile the two `orderShapes`), **R5**, **R6** · **S2**·**S3**·**S4**·**S8**·**S9**·**S10** · **B5** combined with the BE export surface · **B6** · **B7** |
| **Mac (FE)** — new files / non-spine only | new modules, `js/styles/*`, **new** `js/ui/*`, `css/*`, `docs/research/*`, `docs/checkpoints/*`, `AGENTS.md` | **M10–M16** below |

**Never edit a BE-owned file.** Need a change there → OPS_LOG note; BE makes it.

## R3.2 Mac streams (in order)

All frozen interfaces are what you code against; if you need a change to a
BE-owned file, raise it in OPS_LOG.

### M10 — Phase 4.2: Style Profile library UI *(Track-S S6 — the live front)*
`js/ui/style-library.js` + `js/ui/style-library-host.js` (shim, `media-host.js`
pattern). Save / load / apply / export / import.
- **Consume (BE-owned):** `js/engine/profile.js` — `profileFromSettings(settings,
  overrides)`, `validateProfile(profile)`, `normalizeProfile(profile)`; and
  `engine.generate({ profile, seed })` (already live).
- **Exit:** save writes a schema-valid profile; apply re-bakes **identical**
  output for the same `(profile, seed, image-hash)` (prove with two runs);
  export → import round-trips byte-identically; each control provably changes
  output in a real headless browser; `docs/checkpoints/P4.md` + OPS_LOG line.

### M11 — Phase 6: export & share panel UI *(Track-S S7 UI half)*
`js/ui/export-panel.js` + `js/ui/export-host.js`, wrapping the BE-owned
`js/engine/exporter.js` (`exportImage`, `exportProject`/`importProject`,
`exportSVG`) and `engine.exportPNG(opts)` — **wrap, never edit**.
- **Exit:** PNG + JPG at 3 sizes produce real non-empty blobs (assert dims);
  determinism `(settings, seed)` → byte-identical PNG twice; keyboard +
  screen-reader operable, 44px targets; checkpoint + OPS_LOG.

### M12 — non-baseline style polish
`js/styles/*` **except the 9 pinned**. ≥ 6 non-pinned styles measurably improved
(state the metric); pinned baselines **9/9 unmoved** (prove it); before/after
PNGs; checkpoint + OPS_LOG.

### M13 — a11y + responsive sweep
`css/*`, `scripts/a11y-sweep.cjs`, `docs/research/qa-a11y.png`. Keyboard +
visible focus + ≥ 44px on every control; overlays `role=dialog`/`aria-modal`/
Escape/focus-restore; `prefers-reduced-motion`; 390→1920 screenshots.

**BE note (2026-11-13) — LANDED with fixes (`docs/checkpoints/M13.md` §8).** The
sweep was re-run on the ThinkPad. Two corrections to the declared numbers:
(1) **`underMin 0` was not reproducible** — the layer row's own controls were
32px (6 unique at ≤768px). **BE raised them to the 44px floor** (css §13; the row
now wraps, name keeps a 74px floor) → `UNIQUE under-min-target controls: 0` at
390–1920, no overflow/clipping. (2) **`offViewport 0` is a PROBE ARTIFACT** — the
`allOpen` pass opens every overlay *and* paint mode at once (unreachable on
mobile); direct measurement shows the library panel (250px @ left 0) and the
paint toolbar (390px wide, Clear on-screen) fit.
**Mac action items:** (a) make `scripts/a11y-sweep.cjs`'s off-viewport check
**pass-isolated** — audit it from `asFound` + a *fresh* per-panel state, not the
everything-open pass; (b) still open from §7: give the three `index.html`
paint-toolbar `<label>`s a `for` attribute (runtime `aria-label` covers the a11y
tree but not the visual label association).

### M14 — reference docs
`docs/PANELS.md` (shell: controls / layers / media / library / export + the shim
pattern + the ownership boundary, with a diagram), `docs/STROKE_FORMAT.md`. Real
commands, real output. **Do not edit BE-owned docs** — raise mismatches via OPS_LOG.

### M15 — standing QA seat *(M4-style)*
After each BE push: run the gates + a behavioural probe against `main`; log in
AGENTS.md §7 + one OPS_LOG line. **No source edits.** Disagreements logged as
`MAC: [VERIFY] <claim> — DISAGREE: <evidence>`.

### M16 — Track-S S5 (primitives) — Mac half — **UNBLOCKED 2026-11-15**

**BE has issued the primitive list and landed the BE half.** The contract is
`docs/PRIMITIVES.md` — **read §1 (the list + the language table) and §7 (your
brief) before starting.** Evidence: `docs/checkpoints/S5.md`.

- `js/engine/primitives.js` exists (BE-owned; **do not edit the table**): six
  primitives `dry-stamp`, `wet-wash`, `bristle`, `smudge`, `hatch`, `spatter`,
  each resolving to an **existing** registry style + `brush-media` preset.
- A mix (`{ "<primitive-id>": <weight> }`, weights are **relative** — normalised
  to 1) may be declared at `global.primitives` / `layers[].primitives` /
  `passes[].primitives`; precedence is **pass > layer > global**.
- **Your half is the UI mixer** (`docs/PRIMITIVES.md` §7): the 6 weight sliders
  (`0..1`, step 0.05 — the same range as `propose.primitiveKnobs()`), a level
  picker matching the precedence, the `effectiveStyle` readout, round-trip via
  `profileToPrimitives()`, and `validatePrimitiveMix` paths surfaced next to the
  offending control. **A profile with no mix must export/import unchanged** (no
  `primitives` key invented).
- **Do not touch** `js/engine/optimizer.js`, `profile.js`, `score.js`,
  `propose.js`, `engine.js` — the geometry/score/app wiring is BE's and is done.
  Mismatch in a primitive's *number*? Raise it here via OPS_LOG.
- **No behaviour change is expected in the app until a profile opts in**, so the
  9 pinned baselines must stay unmoved and the existing Maestro set must stay
  green — that is the M15 QA pass for this push.

### M15 QA seat — BE push 2026-11-14 (H-S5, the orientation kernel)

BE landed **H-S5**: `js/engine/metrics.js` — `orientationMatch` now normalises by
the kernel self-products `sqrt(K(a,a)·K(b,b))`, so it is a real metric (identity
exactly 1 for any histogram, `refPacketDistance(p,p) = 0`, no `styleMatch` floor).
**No Mac action beyond the standing M15 QA pass** — nothing UI-side changed (no
`js/ui/*`, `js/styles/*`, `css/*` or `index.html` edit) and the 9 pinned baselines
are unmoved. Harness commands to re-run against `main` and report on:

```
node tests/engine.test.js                            # 137
node tests/ref-analyze.test.js                       # 29
NODE_PATH=<...> node scripts/style-match-probe.cjs   # exit 0 + an
   # "H-S5 KNOWN LIMITATION" line for the pencil-vs-ink ADJACENT pair
NODE_PATH=<...> node scripts/style-ref-matrix.cjs    # NEW diagnostic: 9x9
   # reference-pair orientation/scale matrices + per-term styleMatch tables
NODE_PATH=<...> node scripts/visual-regression.cjs   # 9/9, pinned baselines unmoved
```

**Note on the probe:** it no longer asserts the pencil-vs-ink margin. Those two
references are `orientationMatch` 0.9636 apart (same content, both structure-aligned
700-stroke renders), so they cannot separate a render — measured, not assumed; the
probe prints that pair as a labelled known limitation and asserts on a genuinely
different one (cross-hatch) instead. Details: `docs/checkpoints/H-S5.md`. One flake
seen while landing: `scripts/visual-regression.cjs` reported `error=8` once under
memory pressure and 9/9 on the immediate re-run — if you hit it, re-run before
reporting.

### M14 reference docs — BE-VERIFIED + LANDED 2026-11-14 (with corrections)

`docs/PANELS.md`, `docs/STROKE_FORMAT.md`, `scripts/m14-docs-probe.cjs`,
`docs/research/m14-docs-probe.json` and the `AGENTS.md` §3/§7 entries are **landed**
(they arrived uncommitted via Syncthing; nothing was rewritten). BE re-ran the
probe on the ThinkPad against the merged M13 css:

- **Panel inventory REPRODUCES EXACTLY.** `--width=1440` → 5 panels,
  `controls-root 41 260x801@0,63`, `layers-root 18 260x801@1180,63`,
  toolbar/media/library `0x0` (hidden), nav wiring, `styles: 51`, layer API —
  byte-identical to the Mac's JSON except `capturedAt` and the per-record
  `stroke_*` ids. `--width=390` → `controls/media 320x757@-340,111`,
  `style-library 250x757@-21,111`, `layers 320x757@410,111` (the Mac's 390
  stdout said `250x757@0,111`; BE measures `-21` — the same LIBRARY-panel
  `left:-21` already recorded as a known probe artifact for M13).
- **The §3/§8 params-length claim is CONFIRMED by an independent engine run**
  (real page, `useWorker=false`, `NODE_PATH`+`CHROME_BINARY`, synthetic source):
  `paper` total 20 → `E` 8, `B` 8, `R` 8, `T` 10; `watercolor` total 60
  (`{B:2,S:58}`) → `S` 11; `mosaic` total 30 → `{R:30}` pure R, `R` 8. For
  E/B/R the record's `params[5]` is the **colour array** (verified by kind), i.e.
  exactly the `_convertShape` overwrite the doc describes. The doc's own
  histograms differ (paper `{B:11,T:5,E:2,R:2}`) because the source image differs
  — not a contradiction.
- **`export-panel-probe.json` REPRODUCES BYTE-IDENTICALLY** on a BE re-run
  (32→44 heights + panel width 333→215 = the M13 44px work). `a11y-390.png`
  re-generated here: same scene, OS font/AA only.

**Mac action items (BE raised, did NOT edit Mac-owned docs):**

1. **`STROKE_FORMAT.md` §1 + §7 overstate the evidence linkage.** The §4 records
   are real (verified above) but they do **not** live in
   `docs/research/m14-docs-probe.json`: that file's `strokes` block is built by
   `createShape()` with hand-made 8-length params, and its `project` block has
   `strokeCount 0`. §7's "both captured in the raw JSON" is not true for the
   histograms either. Either extend the probe to dump the §7 snippet's output,
   or correct the two sentences.
2. **§7's `shapeBias` sentence is wrong for the app path.** `Engine.generate()`
   runs the **Painter** (`engine.js:21/352`); `shapeBias` does not appear anywhere
   in `painter.js`. It is a knob of the *modular* generator (`generator.js:223`),
   not of the app's Painter — which is why `{T:1}` did not force triangles. The
   real mechanism: the Painter picks types from its own `MIX` table
   (`painter.js:480 pickType`), and `paper` is in `Painter.SHAPE_ID`, so the
   `'S'` shortcut is skipped and `MIX.paper` decides. Fix the sentence.
3. **§3 table rows for `E`/`B`/`R` list 9 param names but state length 8.** After
   `_convertShape`, index 5 **is** `c0` (the gradient angle / feather is
   overwritten), so the converted record is `[cx,cy,rx,ry,rot,c0,c1,alpha]`.
   Re-label the table (the §3 code block and §4 note are already right).
4. **`scripts/m14-docs-probe.cjs` does not run off the Mac.** Its
   `CHROME_CANDIDATES` are macOS-only paths; BE had to set `CHROME_BINARY`
   (and a Linux `NODE_PATH`) to run it. Add the Linux candidates the way
   `a11y-sweep.cjs` does (`~/.cache/ms-playwright/*/chrome-linux64/chrome`), and
   drop the hardcoded `/Users/AIR2K/.npm/_npx/...` from the §7 snippet (use
   `<dir containing playwright-core>` like every other command in AGENTS.md §3).
5. **`m14-docs-probe.json` is not deterministic** — the `stroke_*` ids come from
   `createShape()`'s `Math.random()` suffix, so the file changes every run. Note
   it, or give the probe's records a fixed id.
6. **`HANDOFF.md` §6 is stale too** (macOS list missing the same four
   `js/ui/*` files). HANDOFF is Mac-owned — fix it there.

**For BE (blocked, recorded):** the `AGENTS.md` §1 ownership list still omits the
Mac-authored `js/ui/media.js`(+`-host`), `js/ui/style-library*.js`,
`js/ui/export-panel*.js`/`export-host.js`, `js/ui/a11y-hardening.js`. BE tried to
add them and **`AGENTS.md` is write-protected** for BE (agent-instruction guard);
the Mac owns the file — please add them there (a BE change would need human
approval).

### §0.10 / §0.11 / §0.12 — BE-FIXED + LANDED (2026-11-15)

All three left-rail defects you raised in M15 are fixed in `css/style.css` and
landed. Each was reproduced on the ThinkPad with YOUR `overlay-coverage-probe.cjs`
plus a new BE-owned guard, and each now measures clean.

| # | Defect | Fix | Before → after (measured) |
|---|---|---|---|
| 0.10 | library panel missing from the <=768px `position: fixed` rule | added `.panel--library` to that rule (+ its own `left:0` and `.panel--mobile-closed` slide) | `pos=absolute`, rect `-21..229`, **6/6 controls untappable** -> `pos=fixed` `0..320`, **0/6** |
| 0.11 | PATH ORDER renders 11 options in one `nowrap` flex row (748px in a 240px rail) | `.controls-panel #path-section .segmented` is a 4-column grid (mirrors `.media-band-row`); scoped by section id so the 2- and 3-option controls keep filling their row | row `748/240`, only **3 of 11 buttons inside the panel** -> `240/240`, **11/11 inside, 0 clipped** |
| 0.12 | the floating rail toggles sat over the library's Import row | toggles anchored at `bottom: calc(--status-h + --space-2)`; every rail scroll host reserves that band; and the toggles are hidden while the library owns the rail (`:has()`, progressive enhancement) | both library Import buttons untappable -> **0 unreachable controls in the library panel at every size** |

**New standing guard — `scripts/rail-overlay-probe.cjs`** (BE-owned, real exit
code). It opens each rail panel by its own trigger at 9 sizes: the phone widths at
BOTH 844 and 900 (a viewport-anchored overlay and a top-anchored panel only collide
at *some* heights) plus 1024/1440/1920 where 0.11 lives. It asserts that every
control whose centre lies inside the panel hit-tests to itself, and that the PATH
ORDER row does not overflow horizontally. Verified both ways: it **FAILS 9/9 sizes
on `4cca2c4`**, reproducing all three defects with the numbers above, and **PASSES
9/9 on the fix**. Run it after each BE push alongside the Maestro set.

**Residual (recorded; accept-vs-fix = accepted, cosmetic).** A viewport-anchored
44px FAB over a full-height scrollable rail overlaps whichever row sits at the
panel's bottom edge at some viewport height — no `bottom` offset avoids it at every
height (checked). After the fix the covered control is only ever clipped by the
panel's own fold, i.e. reachable by scrolling, never untappable; and the library —
the case where a control became genuinely untappable — is fully clear. Eliminating
the overlap entirely means hiding the FAB while its rail panel is open (done for
the library) or moving the FAB out of the rail's x-band: a design call, not a CSS one.

**For the Mac:** §0.9–§0.12 are all fixed now. `AGENTS.md` §0 is Mac-owned and
write-protected for BE, so please mark them closed there on your next turn, and
regenerate `docs/research/overlay-coverage.json` against the landed CSS (yours
still records the pre-fix run — deliberately left untouched, one writer per file).

---

### M16 — Track-S S5 (primitives) — Mac half — **LANDED 2026-11-16** (`docs/checkpoints/M16.md`)

**Built and verified by BE** while the Mac was down (human directive: *"Mac is
down so pick up its work for now"*). The stream is still the Mac's on paper; the
record exists so the next session can tell finished work from a scratchpad.

- **New (Mac-owned file class):** `js/ui/primitive-mixer-core.js` (pure — mix ↔
  six slider values, read/write at `global`/`layer`/`pass`, non-mutating, never
  invents a key, read-out + validation), `js/ui/primitive-mixer.js` (the DOM
  section), mounted in the Style panel; `index.html` + `css/style.css` §16 edits;
  `tests/primitive-mixer.test.js`, `scripts/primitive-mixer-probe.cjs` (+ JSON +
  2 PNGs), `maestro/www-paint-primitive-mixer.yaml`.
- **Evidence:** mixer test **20/20** · probe **21/21** · Maestro **14/14** ·
  engine **164/164** · all track suites Failed 0 · `rail-overlay-probe` PASS 9/9 ·
  visual **9/9 pins unmoved** · `overlay-coverage-probe` 0 hitFail at 390–1920.
- **One defect found + fixed in verification:** the shell's `.slider-row` 10px
  collapse piled six labelled rows up (content overflowed ~46px/row). Scoped
  override (§16); the probe's guard is verified both ways (`PMX_BROKEN_ROW=1`).
- **BE doc nit owed (BE-owned file):** `js/engine/profile.js`
  `profileToPrimitives` JSDoc says `effectiveStyle` is `null` with no mix, but it
  returns `global.style` (the pre-S5 fallback the tests pin). Comment wrong, not
  code — one-line fix.
- **Mac action when back:** the standing **M15 QA seat** — re-run
  `scripts/rail-overlay-probe.cjs` + `scripts/overlay-coverage-probe.cjs` + the
  Maestro set against this push, and mark **§0.9–§0.12 closed** in `AGENTS.md` §0
  (BE raised the closure there but `AGENTS.md` is write-protected for BE).

---

## R3.3 Protocol (unchanged)

1. **Never run git** (`AGENTS.md` §0.8). Edits reach the ThinkPad via Syncthing;
   **BE verifies and pushes** (BE is the sole GitHub writer).
2. **After EVERY turn, append one entry to `AGENTS.md` §7** — `did / files /
   verified (raw) / blocker / next`.
3. One OPS_LOG line per completed stream (`MAC:` prefix, raw evidence,
   `NOTHING DELETED`).
4. Finish a stream before starting the next. **M10 first.**

Signed-off-by: Hermes / BE — ThinkPad
