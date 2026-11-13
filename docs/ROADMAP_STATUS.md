# Roadmap Status

Living status file for `docs/ROADMAP.md`. Update after every completed
sub-phase (roadmap §8, step 5). One line per sub-phase; keep it terse.

**Last updated:** 2026-11-14 · Agent: BE (ThinkPad) · **+ M13 RE-INTEGRATION (`8cedbc4`) — the layer-row controls are back at the 44px floor** (they had been reverted to 32px in a second section-14 revision that arrived via Syncthing AFTER `7f5cd07`): the row WRAPS (`flex-wrap` + a 74px name floor) so 44px fits the 250px rail, `underMin 0` at 390–1920, children 9px inside the row's right edge at 1024/1440. **ALSO FIXED:** `7f5cd07`'s §14 slider change left the MEDIA panel tall enough to push `media-masks-preview` off-screen (Maestro desktop-regression FAILED; the a11y sweep does not measure layout height) — the Mac's §14 slider-height rules complete it and are KEPT. Flows green: desktop-regression 33/33, a11y-sweep 50/50, a11y-sweep-mobile 34/34; visual regression 9/9 pinned baselines unmoved. · **+ Track-S hygiene H-S6 (style-aware render path) DONE (`docs/checkpoints/H-S6.md`) — `scoreProfileStyle` now renders through the real style registry (`js/engine/style-render.js`) and honours the profile's `global.style`: a pencil vs an ink profile differ in 97.1 % of pixels (was 0 %, byte-identical); `node` output byte-identical (no canvas → plain fallback), 9/9 baselines unmoved, engine 137/137. H-S5 (the `orientationMatch` kernel) is now unblocked and is the next step.** · **+ Mac M13 (a11y + responsive sweep) LANDED + BE-verified (`fd76d84`) — 0 controls without an accessible name, 3 `role=dialog`+`aria-modal` overlays, 5 live regions, 7 reduced-motion rules, 0 off-viewport / 0 clipped / no horizontal overflow at 390–1920; `scripts/a11y-sweep.cjs` re-ran on the ThinkPad with numbers identical to the Mac's. M13 fully DECLARED + LANDED (checkpoint `docs/checkpoints/M13.md` + AGENTS §7 + 2 Maestro flows). TWO CORRECTIONS to its declared numbers, verified on the ThinkPad: (a) `underMin 0` was NOT reproducible — the layer row's own controls were 32px (6 unique) — **FIXED by BE** (raised to the 44px floor + row wrap in `css/style.css` §13), re-measured `UNIQUE under-min 0` at 390–1920 with no overflow/clipping; (b) `offViewport 0` is a PROBE ARTIFACT — the sweep prints `offViewport 1 (rail 3)` at 390px from its contrived all-open pass; direct measurement shows the library panel (250px @ left 0) and paint toolbar (390px wide, Clear on-screen) fit. Mac action: make the probe's off-viewport check pass-isolated. `docs/checkpoints/M13.md` §8.** · **+ Mac M12 (non-baseline style polish) LANDED + BE-verified (`8713943`) — 11 non-pinned styles, five of them CORRECTNESS defects the browser probe caught (`bokeh` painted a BLANK canvas, `riso` threw `ReferenceError: path is not defined`, `pastel` ran off the point array, `glitch` clipped outside save/restore); pinned nine untouched, 9 visual baselines unmoved** · **+ Track-S S3 DONE (`ref-analyze.fuseReferences` + `profile.js` `provenance.refPacket`, ref-analyze 29/29, `docs/checkpoints/S3.md`) — and it EXPOSED TWO S2 DEFECTS (hygiene **H-S5/H-S6**): `orientationMatch` is not a metric (a packet's self-distance is 0.12 ⇒ `styleMatch` floors at 0.875) and `scoreProfileStyle` is STYLE-AGNOSTIC (a pencil and an ink profile score byte-identically, so S2 cannot measure style until H-S6 lands)** · **+ Mac M10 (Style library UI, = S6) and M11 (export and share panel, = S7 UI half) LANDED + BE-verified on the ThinkPad (`3b711fe`, `d4dbe34`) — Phase 4 now COMPLETE** · **+ TWO ENGINE DEFECTS FIXED (`7e67d59`): the p5.brush stamp path could report success while painting nothing (a SwiftShader WebGL2 context satisfies the old readiness check but renders nothing), so the app painted NOTHING in headless — and every behavioural probe that baked a frame was measuring a blank; and `Renderer.exportImage` wiped the live canvas (`setSize` resets the bitmap). Baseline PNG artefacts regenerated from the hashed bytes (`896bf61`) — pins unchanged. NEW `scripts/brush-path-probe.cjs`** · **+ Track-S S1 DONE (`js/engine/ref-analyze.js`, 16/16, `docs/checkpoints/S1.md`) — Mac M7/M8/M9 pushed (`28e8933`)** · **+ Track S added (style accuracy / sref — `docs/TRACK_S.md`, S1–S10)** · + Track R4 region-fill (partial, opt-in) + Mac media-panel LANDED/verified (41286c1) · Harness H3 vision-proposer mechanism (injected LLM; real-LLM validation pending) + Harness H5 benchmark gate + H4 memory (feedback store + aHash retrieval + warmStart) · B1 render-path closers (1.5 smudge/height buffer + 3.3 mediaModel→wetsim integration) · B2 layer-aware scoring (2.2 closer: `scoreProfileLayers` over the IF-1 masks). Earlier: Track R3 (CCL + PCA stroke init, 1.4) + Phase 4.1 (engine consumes Style Profile) + Harness H1 (parameter surface + headless `score`) + H2 (search proposer) done. Mac M1 (wetsim) + M2 (masks / layer panel) + M3 (brush media 1.1/1.6) + M4 (QA) landed, BE-verified. Mac media-panel UI stream LANDED + BE-verified (41286c1) — panel now drives the render path (wetSim/media → mediaModel bridge; dry until opt-in) + `masksCompositeRGBA` band fix. BE: §0.5 pencil brush-tip fixed.

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
| 5 — AI style refinement loop | **harness H1/H2/H4/H5 done; H3 vision-proposer mechanism done (real-LLM validation pending)** — `score.js` + `propose.js` + `memory.js` + `gate.js` + `vision-propose.js`; engine 120/120 (real-LLM validation = Track S S8). See the Harness table below |
| 6 — Polish, performance, export | **UI half done (Mac M11, `d4dbe34`)** — export and share panel: PNG/JPG at 3 sizes + quality, profile JSON copy/download, share text; 90/90 + probe PASS. **Engine half todo** — worker batch apply / cancel = Track S S7 (BE B5); engine perf pass not started |
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
| R4 | Feature parity (outlines / region-fill / order / per-style shaping) | **partial** — region-fill pass landed (`optimizer.regionFillPass`, opt-in `regionFill`, default off → byte-identical to R3); measured +0.07 simMae rings / +0.01 blobs, flat smooth+noise, exact stroke budget; 123/123, baselines 9/9. Outlines / order / per-style shaping still todo. See `docs/checkpoints/R4.md` |
| R5 | Exceed (per-layer styles, smudge, wet media, Style Profiles, AI) | todo |
| R6 | Retire the port (app + baselines 100% clean-room) | todo |

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
| S4 | Explicit hierarchical passes (`passes[]` in the Style Profile) | BE | todo |
| S5 | Stroke-language primitives (`js/engine/primitives.js`) | BE + Mac | todo |
| S6 | Profile library UI (**Phase 4.2**) | Mac | **done** — Mac M10 landed (`3b711fe`): `js/ui/style-library{,-core,-host}.js`, 50/50 + behavioural browser probe PASS, `docs/checkpoints/M10.md`. BE-verified on the ThinkPad |
| S7 | Worker automation path (**Phase 6**) | BE + Mac | **UI half done** — Mac M11 landed (`d4dbe34`): `js/ui/export-panel{,-core}.js` + `export-host.js`, 90/90 + probe PASS. **Worker batch path (`worker.js` deterministic apply/cancel) still todo — BE B5** |
| S8 | H3 real-LLM validation (**Phase 5.1**, ≥ 70 %-usable) | BE | **issued (H3-validation)** |
| S9 | Active algorithm refinement (knob ↔ style-match correlation) | BE | todo |
| S10 | Style-accuracy eval suite (content × ref-set matrix) | BE | todo |
| H-S1 | `scorer.js` (candidate selection) vs `score.js` (profile quality) — document the split | BE | todo (`docs/API.md`) |
| H-S2 | Confidence / calibration when refs are weak or inconsistent | BE | todo |
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
