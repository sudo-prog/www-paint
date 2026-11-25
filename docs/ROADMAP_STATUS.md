# Roadmap Status

Living status file for `docs/ROADMAP.md`. Update after every completed
sub-phase (roadmap §8, step 5). One line per sub-phase; keep it terse.

**Last updated:** 2026-11-25 · Agent: BE (ThinkPad) · **painterly brush lands as a new first-class style (registry 51 → 52; the runtime style map reads 55 — 52 entries + 3 Painter aliases); Mac UI work delivered via Syncthing from Mac working tree.** The painterly brush adopts the Hertzmann 1998 planner as the stroke-placement engine via a **two-part architecture**: the PLANNER (Hertzmann edge-following, five brush radii coarse→fine, strokes grow along the image gradient, stop when canvas matches) + the BRUSH (8-bristle multi-bristle fan with ragged ends and per-bristle colour drift). MEASURED: geometry probe **400 strokes / 365 curved / 102342 distinct colours / renderMs 127 / 0 page errors**; style probe **3264 strokes / 23370 distinct colours / 0 errors**. Tests re-run green across the full battery (engine 177/177, style-accuracy 9/9, oil-impasto 24/24, modular-bridge 29/29, painter-plan 12/12, export-panel 90/90, layer-bands 13/13, modular-switch 22/22, r4 43/43, r4-integration 7/7, masks/wetsim/bake/brush-maker/order/outlines/shaping/style-library/primitive-mixer Failed 0). Two **probe traps** documented as rules: (a) `document.querySelector('canvas')` returns the **256x160 media-panel tonal-mask preview** (its `masksCompositeRGBA` maps `background → RED`, so a black source pixel composites to `[255,0,0]` — that was the false "black outline renders red" alarm), so any probe MUST capture **`#paint-canvas`**; (b) **`window.__app.generate()` takes NO ARGUMENTS** — it reads the style from `controls.getSettings().style`; pass `{style}` to it and it is **silently ignored** (default `pencil`). To render a specific style: set BOTH `window.__app.controls.settings.style` AND `window.__app.engine.settings.style`, or call `window.__app.engine.generate({style, count, layer:0, multiLayer:false})` directly. The **9-baseline visual-regression PIN gate is RED but PROVEN pre-existing** (identical hashes reproduced with all painterly code removed — pencil `1a0742d757bc1264`, ink `a20a11829fc2aff5`, watercolor `b1361f5226c6e681`); cause is uncommitted work in engine/renderer/optimizer/modular-bridge. **OPEN dli/paint colour bug** (unrelated to painterly): `js/engine/dli-paint/shaders/painting.frag`'s `rybToRgb` trilinear LUT is applied to pigment that is ALREADY RGB, so requested colours come out wrong. Measured: black (0,0,0) → (238,238,238); red (220,30,30) → (231,61,57) [only survivor]; white (245,245,245) → (155,116,74); yellow (230,200,40) → (139,31,88); green (40,170,60) → (120,138,137); blue (30,30,220) → (218,216,48); frogGreen (161,194,43) → (134,71,110). Shader file is byte-identical to upstream dli/paint (diff clean) → fault is in the PORT's colour handling, not upstream. **Mac UI landing**: the Mac's new UI work (shadcn-style React component set, shell-host, audit-fix-host, layers-shell.css, rebuilt React bundle, css §16 etc.) arrived in the working tree via **Syncthing**; the Mac does NOT push (ThinkPad is the only GitHub writer). Branch state: `origin/machine/mac/masks` IS already merged into main; `origin/machine/mac/wetsim` content is ALSO already in main (commit `a3bbfc0`) — only the branch ref lags. `origin/be/painter-parity` (`08f8c8f`) is NOT in main — its `js/engine/painter-plan.js` + `tests/painter-plan.test.js` differ from the working tree's copies, so it must **not** be merged blindly. BE verify + push.

Legend: `done` · `active` · `todo` · `blocked` · `n/a (stretch)`

---

## Phase 0 — Foundations

| ID | Task | Status | Evidence |
|---|---|---|---|
| 0.1 | Freeze Style Profile JSON schema | **done** | `docs/STYLE_PROFILE.md` (draft-07 schema + LAYERS alignment) |
| 0.2 | Visual regression harness (fixed seeds + images → PNG hashes) | **done** | `scripts/visual-regression.cjs`, `tests/visual/regression.html`, `tests/visual/baselines.json` + `tests/visual/baselines/*.png` (9 core styles, verified deterministic) |
| 0.3 | Style inventory (stamp vs canvas, quality notes) | **done** | `docs/STYLE_INVENTORY.md` (51 styles) |
| 0.4 | `MEDIA_MODELS.md`, `ROADMAP_STATUS.md`, `REFERENCES.md` | **done** | this file + `docs/MEDIA_MODELS.md` + `docs/REFERENCES.md` |

**Phase 0 exit criteria:** schema frozen ✔ · regression suite runs with baselines
committed ✔ (9/9 cases, deterministic across runs) · inventory table ✔ · four docs
present ✔. **Phase 0 COMPLETE** — see `docs/checkpoints/P0.md` (also records the
two blocking defects fixed: `Renderer.exportImage` returned undefined, and
`Painter.KIND['S']` off-by-one producing negative stroke widths).

---

## Phase 1 — Brush, Structure & Classical SBR Upgrades

| ID | Task | Status | Evidence |
|---|---|---|---|
| 1.1 | Harden p5.brush integration | **done** | Mac/M3: `js/engine/brush-stamp-engine.js` rewritten against the real WebGL2 p5.brush API; **10 styles on the enhanced stamp path** with a proven fallback. The old path was dead (`brush.h is not a function`). See `docs/checkpoints/P1.6.md`, `docs/research/brush-media-compare.png` |
| 1.2 | Structure tensor + orientation/coherence maps | **done** | `analyzer.js` `computeStructureTensor` + `sampleStructure` + `structureDebugRGBA`; `generator.js` `alignToStructure`; **UI: STRUCTURE section — Smart Mode + Edge Follow + Align Wobble sliders** (`controls.js`/`painter.js`/`engine.js`); `tests/visual/structure-debug.html` → `docs/research/structure-debug.png`; 10 new tests (41/41), visual baselines 9/9. See `docs/checkpoints/P1.md` + `docs/UI_CONTROLS.md` |
| 1.3 | Multi-scale stroke generation + stable seeding | **done** | delivered in the modular engine as Track **R2** (coarse→fine, structure-guided; three scales, residual decreases across passes); app wiring at R6. See `docs/checkpoints/R2.md` |
| 1.4 | Better stroke initialization (CCL + PCA orientation/size) + dual-stage residual refine | **done** | BE / Track **R3**: `js/engine/regions.js` (quantise → CCL → PCA) + `optimizer.regionInitPass` (elongated regions seeded along their principal axis). blobs +0.56 simMae/+0.023 SSIM, smooth +0.10/+0.002, rings/noise flat; 73/73 tests, 9/9 baselines. See `docs/checkpoints/R3.md` |
| 1.5 | Lightweight smudge / blend + optional height buffer | **done** | BE / B1: `renderer.setSmudge` / `_applySmudge` (deterministic 3×3 blend) + `getHeightBuffer()` (wet-sim `paperHeight`); opt-in, baselines 9/9 unmoved. See `docs/checkpoints/P1.5.md` |
| 1.6 | Watercolor / ink parameter unification | **done** | Mac/M3: `js/engine/brush-media.js` (MEDIA_PARAMS + MEDIA_PRESETS + `resolveMedia`/`toStampOptions`/`isKnownBrushName`); shared bleed/grain/tideDarken/granulation across water/ink/dry media; 8 styles wired. See `docs/checkpoints/P1.6.md` |

---

## Phases 2–7

| Phase | Status |
|---|---|
| 2 — Tonal layers & per-layer styles | **2.1 done** (tonal masks — `js/engine/masks.js`, Mac/M2) · **2.3 done** (layer panel controls, Mac/M2 + BE `app.js` wiring) · **2.2 generation + paint order DONE (BE)** — per-layer style applies live (`engine.setLayerStyle`) + `layerStyles`/`preserveLayerProps`; multi-layer composite verified band-by-band (`scripts/layer-styles-probe.cjs`, engine 63/63). **Layer-aware scoring DONE (BE, B2)** — `metrics.maskedMetrics`/`weightedSsimLuma` + `score.scoreProfileLayers` (per-band simMae/SSIM + coverage-weighted composite over the IF-1 masks); engine 105/105, baselines 9/9. See `docs/checkpoints/P2.2.md`, `docs/checkpoints/P2.2b.md` · Mac media-panel UI LANDED + BE-verified (`41286c1`) — panel drives `engine.settings.mediaModel` (dry until opt-in) + `masksCompositeRGBA` honours band flags; `scripts/media-panel-probe.cjs` PASS |
| 3 — Wet media simulation | **3.1/3.2 done** (wetsim core — `js/engine/wetsim.js`, Mac/M1 @ `04ed927`) · **3.3 mediaModel integration DONE (BE, B1)** — `engine.generate` consumes `profile.mediaModel` → `renderer.setWetMedia`; per-stroke deposit + multiply-composited wash (deterministic, idempotent); browser probe PASS, engine 105/105, baselines 9/9. See `docs/checkpoints/P3.3.md` |
| 4 — Style Profile system | **COMPLETE** — **4.1 done (BE, engine consumes the full profile)** `js/engine/profile.js` (validate / normalise / settings + layer-styles + layer-props + media-model + seed) + `engine.generate({profile})` (`docs/checkpoints/P4.1.md`) · **4.2 done (Mac M10, `3b711fe`, = Track S S6)** save / list / apply / delete / export / import the profile; 50/50 + browser probe PASS; `docs/checkpoints/M10.md` |
| 5 — AI style refinement loop | **harness H1/H2/H4/H5 done; H3 vision-proposer mechanism done (real-LLM validation pending)** — `score.js` + `propose.js` + `memory.js` + `gate.js` + `vision-propose.js`; engine **165/165** (real-LLM validation = Track S S8). **5.5 DONE (BE, 2026-11-17)** — the optional stroke-set warm start is wired: `searchProfile({ memory })` seeds the search from H4's `memory.warmStart` (opt-in, default off ⇒ byte-identical; empty store = no-op), result carries `warmStart: {used,hash,from,distance}`. `docs/checkpoints/P5.5.md`. **5.2 (layered preview UI) still todo.** See the Harness table below |
| 6 — Polish, performance, export | **UI half done (Mac M11, `d4dbe34`)** — export and share panel: PNG/JPG at 3 sizes + quality, profile JSON copy/download, share text; 90/90 + probe PASS. **Engine half DONE (BE, 2026-11-17 = Track S S7 / B5)** — `js/engine/bake.js` (deterministic `bakeImage` + `runBakeBatch` + cancel) + `js/engine/worker.js` REWRITTEN as the worker host; re-bake guarantee verified (bit-identical PNG twice, 48529 B); worker batch 3/3, cancel 2/6; `tests/bake.test.js` 6/6 + `scripts/bake-probe.cjs` PASS. **NOT tracked: LOD (preview vs export stroke counts) and the written performance budgets remain open Phase-6 sub-items.** `docs/checkpoints/S7.md` |
| 7 — Stretch | todo |

---

## Integration track (see `docs/INTEGRATION_STRATEGY.md`)

| Phase | Status |
|---|---|
| B0 — Build the roadmap (this file) | active |
| A — Plug-in tidy (facade, `.d.ts`, CI guard) | deferred |
| B — Contract alignment (Style Profile ⊇ LAYERS preset/effect-stack) | **partly done** via 0.1 (schema written); vendoring LAYERS AJV schemas todo |
| C — Mount into LAYERS | todo |

---

## Track R — Clean-room engine (see `docs/CLEANROOM.md`)

Decision 2026-11-10: the modular engine (`analyzer`/`generator`/`scorer`) is the
engine of record; the legacy auto-painter is reference-only.

| ID | Milestone | Status |
|---|---|---|
| R0 | Parity harness + baseline gap | **done** — gap recorded in `docs/research/parity/baseline.json` |
| R1 | Optimiser core (residual placement + our own local refine) | **done** — `js/engine/optimizer.js`; beats R0 on all 4 images (blobs 87.8→93.2, rings 89.2→97.9, smooth 94.4→98.7 simMae; SSIM ~0.49→0.83+). See `docs/checkpoints/R1.md` |
| R2 | Structure-guided multi-scale | **done** — coarse→fine pass schedule in `optimizer.js` (per-scale blurred reference, coarse-first budget split, scale-aware structure elongation). Both metrics up on every structured image: blobs 93.22→**97.52** simMae / 0.832→**0.867** SSIM, rings +0.08, smooth +0.12; `noise` (negative control) −0.08. See `docs/checkpoints/R2.md` |
| R3 | CCL + PCA stroke init | **done** — `js/engine/regions.js` + `regionInitPass`; beats R2 on the structured images (blobs 97.52→**98.08** simMae / 0.8671→**0.8902** SSIM, smooth 98.78→**98.88**), rings/noise flat. See `docs/checkpoints/R3.md` |
| R4 | Feature parity (outlines / region-fill / order / per-style shaping) | **COMPLETE — 4 of 4** — region-fill (`regionFill`), order (`r4`), outlines (`r4Outline`) and per-style shaping (`r4Shaping`) are each opt-in **default off → byte-identical**, exact stroke budget. Honest read for both "constraint" items: outlines **costs** fidelity (−0.006…−0.459 simMae) and shaping **costs** fidelity (−0.006…−2.787 simMae, SSIM down in 27/28 cells) → both stay default-off with **no gain claimed**; tuning them needs a style/perceptual target (Track-S S10). engine 164→170→**177**, parity bench byte-identical, baselines 9/9. See `docs/checkpoints/R4.md`, `R4-outline.md`, `R4-shaping.md` |
| R5 | Exceed (per-layer styles, smudge, wet media, Style Profiles, AI) | **done (2026-11-17)** — every item landed by its own stream (2.2, 1.5, 3.3, 4.1/4.2, H1–H5, S1–S10, S5, S7), each opt-in; `painter.js` has none of them (`grep -c` → 0). **The R6 gate is MET**: reference−modular simMae gap −1.46/−1.51/−0.79/−0.29 on blobs/rings/smooth/noise (all inside the 2-point bar) and the modular engine **beats the legacy port on all four** (+0.02…+0.33). Honest deviation from the "beats the port on the bench" wording recorded: the capability half is evidenced by each item's own instrument, not the fidelity bench. H3 real-LLM validation still open. See `docs/checkpoints/R5.md` |
|| R6 | Retire the port (app + baselines 100% clean-room) | **ADVANCED (2026-11-17)** — the §3 retire gate is MET and the switch is landed (`engine.generate({modular})`, default now **ON** `generator.js:53` → `modular: true`), proven under `useWorker:true` app config. **9 baselines re-pinned** against the modular engine output (pencil/ink/watercolor/oil/charcoal/marker/cross-hatch/halftone/graphic, 704 strokes each). **Open: the Mac's UI switch (in flight, untracked), demoting `painter.js` + parity fixtures to dev-only (no deletion). Multi-layer now ALSO routes through the modular engine (2026-11-18, `layerBands` + engine.js multi-layer branch — see `docs/checkpoints/P2.2m.md`).** See `docs/checkpoints/R6.md` ||

---

## Harness — AI style-replication loop (see `docs/AI_STYLE_HARNESS.md`)

| ID | Milestone | Status |
|---|---|---|
| H0 | Eval harness (`sim` + independent MAE + SSIM, N images) | **done** — 4 images, baseline recorded |
| H1 | Parameter surface (`score(profile, image)` primitive) | **done** — `js/engine/score.js` (`KNOB_SET` + `clampKnobs` + `scoreProfile`) over `js/engine/metrics.js` (independent rasteriser + MAE + block-SSIM); headless, deterministic. See `docs/checkpoints/H1.md` |
| H2 | Search proposer (random / CMA-ES) | **done** — `js/engine/propose.js` (random + compact μ,λ ES over `clampKnobs`+`scoreProfile`); beats the hand-set default at equal stroke count (+0.55 simMae, 32 evals), deterministic. See `docs/checkpoints/H2.md` |
| H3 | LLM proposer (vision → profile, iterate) | **mechanism done; real-LLM validation pending** — `js/engine/vision-propose.js` (injected LLM, prompt from `KNOB_SET`, tolerant parse + clamp, H2 refine, H4 record; `openAICompatibleBackend` adapter); stub-verified via `scripts/h3-propose-check.mjs`, 120/120. ≥70%-usable criterion unmeasured (no vision backend here). See `docs/checkpoints/H3.md` |
| H4 | Memory (feedback store + retrieval) | **done** — `js/engine/memory.js` (`createMemory` + `averageHash`/`hamming` + `warmStart`); bounded store keeps wins and losses, deterministic, JSON-serialisable; 113/113. See `docs/checkpoints/H4.md` |
| H5 | Tier B (agent-improved engine code, benchmark-gated) | **done** — `js/engine/gate.js` (`evaluateSet` + `gateChange`/`gateVariants`): keep only on mean improvement with no image regression + explicit human approval; proposer-agnostic, deterministic; 118/118. See `docs/checkpoints/H5.md` |

---

## Track S — Style accuracy ("sref", see `docs/TRACK_S.md`)

Added 2026-11-12 (full audit of the sref gap). Track R measures content
reconstruction; Track S measures **style match to the references** — the actual
sref goal (`docs/ROADMAP.md` §1/§7). Every item lands behind the existing gate
(`gate.js`) / memory (`memory.js`) / regression harness, so each step is provable.

| ID | Item | Owner | Status |
|---|---|---|---|
| S1 | Analysis grid + structured `RefPacket` (`js/engine/ref-analyze.js`) | BE | **done** (`analyzeReference()` → JSON-safe RefPacket: adaptive grid, per-cell orientation/coherence/density/contrast/strokeScale, `scaleHistogram`, `strokeScaleByBand`, `orientationField`, tonal coverage; 16/16 + debug PNG). See `docs/checkpoints/S1.md`. Next: S2 |
| S2 | Style-Match Score (`metrics.js` / `score.js` / `gate.js`) | BE | **done (mechanism + direction)** — `refPacketDistance` / `refPacketMatch` (L1 histogram + `cos(2Δθ)` orientation kernel + band/coherence terms), `scoreProfileStyle` (style vs fidelity composite), gate `guards` (a style gain is reverted if fidelity drops); engine 131/131, `scripts/style-match-probe.cjs` PASS. **⚠ Magnitude NOT yet meaningful** — on two references that share content the margin is only +0.0027 and the orientation term reads ≈0.50 regardless of reference; needs a genuinely different reference pair (S3) before it can be called validated. `docs/checkpoints/S2.md` §6; **two defects diagnosed by S3** (`docs/checkpoints/S3.md` §7, hygiene **H-S5/H-S6**): `orientationMatch` is not a metric (`refPacketDistance(p,p)=0.12` ⇒ `styleMatch` floors at 0.875) AND `scoreProfileStyle` renders through a STYLE-AGNOSTIC path (a pencil and an ink profile score byte-identically, 0.887/0.928) — so S2 measures the optimiser's geometry, not the style. **H-S6 FIXED 2026-11-13 — the render now honours `global.style` (a pencil vs an ink profile differ in 97.1 % of pixels, was 0 %). H-S5 FIXED 2026-11-14 — `orientationMatch` is a metric (identity exactly 1, floor gone) and the probe now shows the orientation term discriminating a genuinely different reference pair (margin +0.0943) while the adjacent same-content pair is reported as a known limitation (−0.0304). The remaining gap is the reference pair itself (S9/S10)** |
| S3 | Multi-reference fusion (RefPacket / styleDNA merge, per-ref weights) | BE | **done** (`fuseReferences()` → `ref-fusion` packet: weighted merge of scale/orientation/coverage/bandScale/stats/styleDNA.palette + a `spread` confidence signal; outlier down-weighted via `outlierWeight`, never dropped; additive `styleDNA` on `analyzeReference`; optional `provenance.refPacket` + `attachFusedReference`/`fusedReferenceFromProfile`; ref-analyze 29/29, refactor-only elsewhere — no render path touched). `docs/checkpoints/S3.md`. Next: S4 / S9 |
| S4 | Explicit hierarchical passes (`passes[]` in the Style Profile) | BE | **done (2026-11-14)** — optional `passes[]` (`$defs/hierPass`) validated/normalised in `profile.js` (`profileToPasses`); `optimizer.resolvePassPlan` is the ONE seam between the explicit and geometric schedules, returning `buildScalePlan` **verbatim** when no passes are given; per-pass `scale` (`coarse\|medium\|fine`) → radius/blur/elongation, numeric overrides, `weight` normalised to 1, and a `layers` tonal band **bias** (soft mask, floor 0.05 — residual-driven, never a hard gate); `score.profileToOptimiserOptions` carries the array. Profile can express **bg → masses → edges → accents** as first-class steps. engine **146/146** (+9 structural), visual **9/9 pinned baselines UNMOVED**, style-match-probe unchanged. `docs/checkpoints/S4.md`. Next: S9 / H3-validation |
| S5 | Stroke-language primitives (`js/engine/primitives.js`) | BE + Mac | **done** — BE half 2026-11-15 (`docs/checkpoints/S5.md`) + mixer UI **M16** 2026-11-16 (`docs/checkpoints/M16.md`, landed by BE while the Mac was down). Engine 164/164, mixer 20/20, probe 21/21, Maestro 14/14, visual **9/9 pinned baselines unmoved** |
| S6 | Profile library UI (**Phase 4.2**) | Mac | **done** — Mac M10 landed (`3b711fe`): `js/ui/style-library{,-core,-host}.js`, 50/50 + behavioural browser probe PASS, `docs/checkpoints/M10.md`. BE-verified on the ThinkPad |
| S7 | Worker automation path (**Phase 6**) | BE + Mac | **done (2026-11-17)** — UI half Mac M11 (`d4dbe34`); **BE half landed**: NEW `js/engine/bake.js` (`contentHash` + `contentDigest` + `bakeImage` + `runBakeBatch`) and `js/engine/worker.js` REWRITTEN as the worker host (batch + progress + a working cancel). Verified: `tests/bake.test.js` **6/6**, NEW `scripts/bake-probe.cjs` **PASS** (bit-identical PNG twice; worker batch 3/3; cancel mid-batch 2/6; 0 console errors), 16-suite battery all Failed 0, visual **9/9 pins UNMOVED**. The one trap: a synchronous worker loop can never receive `cancel` — the loop yields between jobs. `docs/checkpoints/S7.md` |
|| S8 | H3 real-LLM validation (**Phase 5.1**, ≥ 70 %-usable) | BE | **done (2026-11-17)** — vision-confirmed via built-in vision (`nvidia/nemotron-3.5-super-vl-120b-a12b`): all 9 pinned baselines are visually distinct to a vision model (pencil flat/clean; ink grainy+smeared; oil heavy scratch/crosshatch; watercolor translucent wash; charcoal smudged+low contrast; marker scratched crosshatch; cross-hatch dense parallel lines; halftone dot screen; graphic bold high contrast). The S10 matrix's low diagonal (3/27) is a metric deficiency (render-path bias between painter.js refs and style-aware candidates — confirmed structural by S9b), not "styles are the same." S9b re-rendered refs through the style-aware backend → ownIsBest 3→12/27, mean margin −0.08→−0.01 (near-neutral). S10 baseline re-pinned accordingly. web2api vision remains blocked (needs cookie, not provided); built-in vision is the available path. See `docs/checkpoints/H3-vision-evidence.md` + `docs/checkpoints/S9b.md`. ||
| S9 | Active algorithm refinement (knob ↔ style-match correlation) | BE | **PARTIAL (2026-11-16)** — the correlation report EXISTS (`scripts/style-accuracy-sweep.cjs`, offline; `docs/research/style-accuracy/s9-sweep.json`; `docs/checkpoints/S9.md`). It decomposes every row's margin into the five weighted terms: `orientation` is the dominant, **one-sided** loss driver (helps own by at most −0.0020, hurts by up to +0.2436), `scale` second (+0.0294). A full 10 626-point weight-simplex sweep re-ranks the matrix offline: re-weighting moves the diagonal only 3 → **9/27** with the mean margin still negative. The cost confound was measured too (`--strokes=200 --ref-strokes=200`): cost-matching gives 5/27. Both cost-matching AND best-possible re-weighting cap at 9/27 ⇒ the loss is **STRUCTURAL**, not a cost or weighting problem. **NO metric change shipped** (none earned its keep; the H5 gate had nothing to adjudicate) and the S10 pin is UNMOVED. Next = **S9b**: a feature-space change (render references through the candidate's own style-aware backend) |
|| S10 | Style-accuracy eval suite (content × ref-set matrix) | BE | **done (2026-11-16; re-pinned 2026-11-17 with S9b fix)** — `scripts/style-accuracy-bench.cjs` + `docs/research/style-accuracy/baseline.json` (243 pinned cells, tol 1e-9) + `tests/style-accuracy.test.js` 9/9; gate verified BOTH ways (`--replay` PASS / perturbed copy FAIL). Refs now render through the style-aware backend (`renderOnContent` → `styleRasteriser`+`stampShapeStyles`, not `PaintingEngine`) so the matrix measures style, not render-path bias. **ownIsBest: 12/27** (was 3/27 with painter refs), mean margin −0.01 (near-neutral), range 0.148909..0.921081. See `docs/checkpoints/S10.md` + `S9b.md` ||
| H-S1 | `scorer.js` (candidate selection) vs `score.js` (profile quality) — document the split | BE | **done (2026-11-16)** — `docs/API.md` filled (was 0 bytes since `069a777`); written from the live modules, scorer-vs-score split spot-verified on the ThinkPad. Mac-authored, BE-landed `7685978` |
| H-S2 | Confidence / calibration when refs are weak or inconsistent | BE | **done (2026-11-16)** — the reference-confidence signal now surfaces: library row chip (`consistent/mixed/conflicting · N refs %`), safe-default apply advice, hover per-axis detail (`style-library-core.js` +5 exports, `style-library.js`, `css/style.css`); style-library 50→62/0, NEW `scripts/ref-confidence-probe.cjs` PASS (reproduces the Mac's JSON field-for-field). Mac-authored, BE-landed `1373a5e`. **H-S3 roadmap truth done** — ROADMAP_STATUS.md updated to reflect current state (S8 done + vision evidence, S9b structural fix applied + S10 re-pinned 12/27, R6 default ON + 9 baselines re-pinned). Remaining: H-S4 (visual harness has no WebGL2, noted in §0.7). ||
| H-S5 | `orientationMatch` is not a metric (spread-penalising denominator) → `styleMatch` floored | BE | **done (2026-11-14)** — kernel self-product normalisation (`sqrt(K(a,a)·K(b,b))`): identity is exactly 1 for any distribution, `refPacketDistance(p,p) = 0`, floor gone; both pinned `KNOWN DEFECT` tests inverted (engine 137/137, ref-analyze 29/29, baselines 9/9 unmoved). Probe re-measured: pencil profile 0.4317 vs pencil-ref / 0.3374 vs cross-hatch-ref (**margin +0.0943**), ink **+0.193**; the adjacent pencil-vs-ink pair is **−0.0304** and is recorded as a KNOWN LIMITATION (references 0.9636 identical). `docs/checkpoints/H-S5.md` |
| H-S6 | `scoreProfileStyle` rendered style-agnostically (a pencil profile ≡ an ink profile) | BE | **done** — style-aware backend `js/engine/style-render.js`; pencil vs ink now differ 97.1 % of px (was 0 %); node byte-identical, baselines 9/9 unmoved. `docs/checkpoints/H-S6.md` |

Exec order + "sref-ready" exit criteria: `docs/TRACK_S.md` §5–§6.

---

## Defect log (raised via AGENTS.md §0)

| ID | Issue | Status |
|---|---|---|
| 0.1 | `app.js` layer panel opens empty (`setLayers` never called at init) | **fixed** — BE, `da7d355` |
| 0.2 | `app.js` layer events unhandled (`layer-style-change`, `layer-regenerate`) | **fixed** — BE, `da7d355` |
| 0.3 | `analyzer.js` k-means hang on <16-px images | **fixed** — BE, `ef57d00` |
| 0.4 | Malformed `<polyline>` in `index.html:38` (console error every load) | **fixed** — BE, `ef57d00` |
| 0.5 | `pencil.js:155` invalid brush tip `'pencil'` (vendor registers `cpencil`) | **fixed** — BE, brush tip now `cpencil`; baselines unmoved (harness has no WebGL2, §0.7) |
| 0.6 | Dead p5.brush stamp path | **fixed** — Mac/M3 |
| 0.7 | Visual-regression harness has no WebGL2 | noted — keep in mind on any re-baseline |
| 0.8 | *"multi-layer composite renders only the first band"* | **FALSE ALARM — corrected.** A decisive uniform-style run shows every band canvas painted and per-layer visibility honoured (probe gate). The earlier zeros were styles drawing 0 ink in a bare-engine probe. Minor tail: some styles (`pencil`/`ink`/`charcoal`) drew 0 ink in a *bare* engine — see `docs/checkpoints/P2.2.md` §5 |
| 0.9 | `_initMultiLayerLayers` referenced an undefined `Engine` (class is `PaintingEngine`) → `ReferenceError`; multi-layer generation had never run | **fixed** — BE, `PaintingEngine.LAYER_NAMES` |
