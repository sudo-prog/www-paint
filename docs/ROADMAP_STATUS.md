# Roadmap Status

Living status file for `docs/ROADMAP.md`. Update after every completed
sub-phase (roadmap §8, step 5). One line per sub-phase; keep it terse.

**Last updated:** 2026-11-12 · Agent: BE (ThinkPad) · Track R3 (CCL + PCA stroke init, 1.4) + Phase 4.1 (engine consumes Style Profile) + Harness H1 (parameter surface + headless `score`) + H2 (search proposer) done. Mac M1 (wetsim) + M2 (masks / layer panel) + M3 (brush media 1.1/1.6) + M4 (QA) landed, BE-verified. Mac media-panel UI stream in flight (Syncthing, uncommitted). BE: §0.5 pencil brush-tip fixed.

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
| 1.5 | Lightweight smudge / blend + optional height buffer | todo | BE (renderer.js spine) |
| 1.6 | Watercolor / ink parameter unification | **done** | Mac/M3: `js/engine/brush-media.js` (MEDIA_PARAMS + MEDIA_PRESETS + `resolveMedia`/`toStampOptions`/`isKnownBrushName`); shared bleed/grain/tideDarken/granulation across water/ink/dry media; 8 styles wired. See `docs/checkpoints/P1.6.md` |

---

## Phases 2–7

| Phase | Status |
|---|---|
| 2 — Tonal layers & per-layer styles | **2.1 done** (tonal masks — `js/engine/masks.js`, Mac/M2) · **2.3 done** (layer panel controls, Mac/M2 + BE `app.js` wiring) · **2.2 generation + paint order DONE (BE)** — per-layer style applies live (`engine.setLayerStyle`) + `layerStyles`/`preserveLayerProps`; multi-layer composite verified band-by-band (`scripts/layer-styles-probe.cjs`, engine 63/63). Layer-aware *scoring* not addressed. See `docs/checkpoints/P2.2.md` · Mac media-panel UI stream in flight |
| 3 — Wet media simulation | **3.1/3.2 done** (wetsim core — `js/engine/wetsim.js`, Mac/M1 @ `04ed927`) · **3.3 mediaModel integration todo (BE)** |
| 4 — Style Profile system | **4.1 done (BE, engine consumes the full profile)** — `js/engine/profile.js` (validate / normalise / settings + layer-styles + layer-props + media-model + seed) + `engine.generate({profile})`; probe PASS, 84/84 tests. See `docs/checkpoints/P4.1.md` · **4.2 todo (save/load/library UI — Mac candidate)** |
| 5 — AI style refinement loop | todo (BE, harness H1–H5) |
| 6 — Polish, performance, export | todo |
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
| R4 | Feature parity (outlines / region-fill / order / per-style shaping) | todo |
| R5 | Exceed (per-layer styles, smudge, wet media, Style Profiles, AI) | todo |
| R6 | Retire the port (app + baselines 100% clean-room) | todo |

---

## Harness — AI style-replication loop (see `docs/AI_STYLE_HARNESS.md`)

| ID | Milestone | Status |
|---|---|---|
| H0 | Eval harness (`sim` + independent MAE + SSIM, N images) | **done** — 4 images, baseline recorded |
| H1 | Parameter surface (`score(profile, image)` primitive) | **done** — `js/engine/score.js` (`KNOB_SET` + `clampKnobs` + `scoreProfile`) over `js/engine/metrics.js` (independent rasteriser + MAE + block-SSIM); headless, deterministic. See `docs/checkpoints/H1.md` |
| H2 | Search proposer (random / CMA-ES) | **done** — `js/engine/propose.js` (random + compact μ,λ ES over `clampKnobs`+`scoreProfile`); beats the hand-set default at equal stroke count (+0.55 simMae, 32 evals), deterministic. See `docs/checkpoints/H2.md` |
| H3 | LLM proposer (vision → profile, iterate) | todo |
| H4 | Memory (feedback store + retrieval) | todo |
| H5 | Tier B (agent-improved engine code, benchmark-gated) | todo |

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
