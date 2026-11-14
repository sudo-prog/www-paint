# WWW_PAINT — Track S: Style Accuracy ("sref")

**Date:** 2026-11-13 · Agent: BE (ThinkPad) · **Status:** active — **S1 done**
(`js/engine/ref-analyze.js`, 16/16), **S2 done as a mechanism**
(`scoreProfileStyle` + `refPacketDistance` + gate guards, `docs/checkpoints/S2.md`)
and **S3 done** (multi-reference fusion, `docs/checkpoints/S3.md`, 29/29).
**⚠ Building S3 exposed TWO DEFECTS IN S2** (`docs/checkpoints/S3.md` §7, hygiene
**H-S5 / H-S6**) — **both are now FIXED.**
**H-S6 (2026-11-13, `docs/checkpoints/H-S6.md`):**
`scoreProfileStyle` renders through a style-aware backend (`js/engine/style-render.js`)
that honours the profile's `global.style` — a pencil vs an ink profile now differ in
**97.1 %** of pixels (was 0 %, byte-identical), `node` output byte-identical, the 9
baselines unmoved.
**H-S5 (2026-11-14, `docs/checkpoints/H-S5.md`):** `orientationMatch` now normalises
by the kernel self-products, so it IS a metric — identity is exactly 1 for any
(broad) histogram, `refPacketDistance(p,p)` is 0, and the `styleMatch` floor is gone
(engine 137/137, ref-analyze 29/29; both pinned `KNOWN DEFECT` tests inverted).
The corrected kernel **earns its weight** on a genuinely different reference pair
(pencil profile: 0.4317 vs the pencil reference, 0.3374 vs cross-hatch, margin
**+0.0943**; ink profile +0.193) — while the ADJACENT pencil-vs-ink pair is now
measured as **−0.0304** and recorded as a known limitation, because those two
references are 96.4 % identical in orientation (both are structure-aligned renders
of the same content).
**S2's *"mechanism done, direction confirmed, magnitude not meaningful"* still
stands** for ONE reason: a still-weak same-content reference pair (S9/S10).
**S4 (2026-11-14, `docs/checkpoints/S4.md`):** the Style Profile can author its
paint schedule as first-class, tunable passes (`passes[]` — `bg → masses → edges
→ accents`, each with `scale` / `layers` / `radius` / `blur` / `elongation` /
`weight` / `alpha` / `detail`), mapped onto the R2 multi-scale machinery by
`optimizer.resolvePassPlan`; a band-scoped pass biases where it anchors but stays
residual-driven. Absent `passes` = the geometric schedule, **byte-identical**
(9 pinned baselines unmoved, engine 137 → 146).
**Next: S9 (real reference pair / algorithm refinement) or H3 real-LLM
validation (S8); S5 (primitives) composes with `passes[]`.**
**Companion docs:** `docs/ROADMAP.md` (the brief) · `docs/AI_STYLE_HARNESS.md`
(H0–H5 loop) · `docs/CLEANROOM.md` (Track R) · `docs/STYLE_PROFILE.md` (profile
schema) · `docs/API.md`

> **Track S is the style-accuracy track.** Track R made an image look like
> *itself* (content reconstruction). Track S makes a result look like *the
> reference style* — the actual "sref" goal in `docs/ROADMAP.md` §1 / §7. It is
> a *measurable* track: every item lands behind the existing benchmark gate
> (`js/engine/gate.js`), the memory store (`js/engine/memory.js`) and the visual
> regression harness, so each step is provable, not asserted.

---

## 1. The gap, in one line

The harness scores **content reconstruction** — `simMae`, independent MAE and
block-SSIM (`js/engine/metrics.js`, `js/engine/score.js`), plus layer-masked
variants (`scoreProfileLayers`). Those reward *"looks like the photo"*, **not**
*"the stroke language matches the references."* There is no stroke-scale
histogram distance, no orientation/coherence match to the refs, no layer-occupancy
match, and no structured per-reference analysis grid. Track S closes that gap.

Verified 2026-11-12: the strings `Track S` / `Style Match` / `RefPacket` /
`analysis grid` appear nowhere in the repo before this doc.

---

## 2. What already aligns (keep building on this)

| Existing asset | File | What it gives Track S |
|---|---|---|
| Style Profile schema (global + layers + mediaModel + styleDNA + provenance) | `docs/STYLE_PROFILE.md`, `js/engine/profile.js` | the portable object S3/S4 extend |
| Structure tensor + align-to-structure | `analyzer.js` `computeStructureTensor` | the orientation field S1 reuses |
| Multi-scale residual optimisation + CCL/PCA init | `optimizer.js`, `regions.js` | the machinery S4's explicit passes map onto |
| Tonal masks + per-layer styles + layer-aware scoring | `masks.js`, `layer-styles.js`, `score.js` `scoreProfileLayers` | the layer occupancy S2 matches |
| Wet sim + `mediaModel` integration | `wetsim.js`, `engine.generate({profile})` | the wetness axis S3 fuses |
| Parameter search + memory warm-start + benchmark gate | `propose.js`, `memory.js`, `gate.js` | the loop S2/S9/S10 plug into |
| Determinism as a hard requirement | profile `global.seed` + `docs/ROADMAP.md` §6 | the re-bake guarantee S6/S7 must keep |

---

## 3. New work — the Track S board

| ID | Item | Owner | Files (owned / new) | Exit criteria |
|---|---|---|---|---|
| **S1** | **Analysis grid + structured RefPacket** — adaptive 8×8…32×32 grid over content *and* each ref; per cell: orientation, coherence, density, local contrast, implied stroke scale (relative units). Output `strokeScaleByBand`, orientation-field summary, tonal/depth-proxy masks. | BE | NEW `js/engine/ref-analyze.js` (consumes `analyzer.js`; analyzer stays additive) | `analyzeReference(image) → RefPacket`, pure + node-testable; a synthetic ring/square yields a scale histogram + orientation field hugging the edge; deterministic. |
| **S2** | **Style-Match Score** — composite: reconstruction terms (down-weighted for pure style tasks) + stroke-scale histogram distance (ref vs result, per band) + orientation histogram / coherence match + layer-occupancy match + optional CLIP/LPIPS-style distance. | BE | `js/engine/metrics.js`, `js/engine/score.js`, `js/engine/gate.js` | `scoreProfile` can optimise style-match, not only photo fidelity; gate keeps a change only on measured style-match gain with no image regression; headless, deterministic. |
| **S3** | **Multi-reference fusion** — extract a RefPacket / styleDNA per ref, then median- or weighted-merge scale distributions, orientation strength, wetness, palette (per-ref weights, outlier down-weighting). Fused packet stored on `profile.provenance`. | BE | `js/engine/ref-analyze.js`, `js/engine/profile.js` | **done** — `fuseReferences(refs, opts)` → a `ref-fusion` packet (weighted merge of scale / orientation / coverage / bandScale / stats / styleDNA.palette + a `spread` confidence signal); outlier down-weighted via `outlierWeight` (never dropped); `analyzeReference` gained a compact additive `styleDNA`; optional `provenance.refPacket` (+ `attachFusedReference` / `fusedReferenceFromProfile`), round-trips the schema. 29/29, `docs/checkpoints/S3.md`. |
| **S4** | **Explicit hierarchical passes in the Style Profile** — `passes: [{ id, scale: coarse\|medium\|fine, layers: [...], ... }]`, mapped onto the existing R2 multi-scale machinery (residual drives the next pass). | BE | `docs/STYLE_PROFILE.md` (additive optional `passes[]`), `js/engine/profile.js`, `js/engine/optimizer.js` | **done** — optional `passes[]` (`$defs/hierPass` in the schema; `PROFILE_PASS_SCALES` + `validatePass`/`normalizePass`/`profileToPasses` in `profile.js`); `OPTIMISER_DEFAULTS.passes = null` + `resolvePassPlan(opts, baseR)` is the ONE seam, returning `buildScalePlan` verbatim when no passes are given; per-pass `scale`→radius/blur/elongation, `weight` normalised to 1, `alpha`/`detail` overrides, and a `layers` band **bias** (`buildPassMask`, floor 0.05 — residual-driven, never a hard gate). `score.profileToOptimiserOptions` carries the array. engine **146/146** (+9 structural tests), visual **9/9 pinned baselines UNMOVED**, `style-match-probe` numbers unchanged. `docs/checkpoints/S4.md` |
| **S5** | **Stroke-language primitives** — a small mixable set (dry-stamp, wet-wash, bristle, smudge, hatch, spatter); profiles weight them per layer/pass; the AI proposes **weights**, not only registry style names. | BE + Mac | NEW `js/engine/primitives.js`; registry/`brush-media.js` wiring | Primitives resolve to existing styles/media with default weights (no output change until opted in); AI proposal may emit primitive weights. |
| **S6** | **Profile library UI (Phase 4.2)** — save / load / list / apply / fork / delete; one-click apply; show score + provenance. | Mac (issued as **M10**) | `js/ui/style-library.js` (+ host shim), `docs/checkpoints/P4.md` | Save writes a schema-valid profile; apply re-bakes **identical** output for the same `(profile, seed, image-hash)`; export/import round-trips byte-identically. |
| **S7** | **Worker automation path (Phase 6)** — `(profileId \| profile, image \| imageBatch, seed?) → { result, score, strokes }` in workers, with progress, cancel and deterministic bake; batch mode for automation. | BE (issued as **B5**) + Mac export UI (**M11**) | `js/engine/worker.js`, `js/engine/exporter.js` | Batch of N images completes with a deterministic result per image; cancel mid-run is clean; same `(profile, seed, image-hash)` → bit-identical PNG. |
| **S8** | **H3 real-LLM validation** — fixed ref sets + content set; measure % usable first proposals; iterate prompt + clamp + H2 refine until **≥ 70 %**. | BE | `js/engine/vision-propose.js`, `docs/checkpoints/H3.md` | One real end-to-end run recorded (model + images); ≥ 70 %-usable measured, or the shortfall recorded honestly. |
| **S9** | **Active algorithm refinement** — log which knobs/heuristics correlate with high Style-Match; optional periodic profile optimiser over the memory store; H5 gate guards any code-level change. | BE | `js/engine/memory.js`, `js/engine/propose.js`, `js/engine/gate.js` | A correlation report exists; any code change passes the H5 gate (keep only on measured mean gain). |
| **S10** | **Style-accuracy eval suite** — fixed (content × ref-set) matrix; a regression must not drop Style-Match; agents treat it as the exit gate for S1–S8. | BE | `scripts/` (new bench), `tests/` | The matrix runs headless; the Phase-0 baselines stay green; a Style-Match regression fails the suite. |

---

## 4. Supporting / hygiene items (folded from the audit)

| Item | Problem | Action |
|---|---|---|
| **H-S1 — two "score" concepts** | `scorer.js` (candidate selection inside the generator) vs `score.js` (profile quality for the harness) are easy to confuse. | Document the split clearly in `docs/API.md` (BE). |
| **H-S2 — confidence / calibration UX** | When refs are weak or inconsistent, nothing surfaces a confidence or forces safer defaults. | Surface a confidence signal from S1/S3 and a safe-default path in the library UI (S6). |
| **H-S3 — roadmap truth** | `docs/ROADMAP.md` §2 said "Layers: data model only" / "AI: None" long after both shipped — agents could mis-prioritise. | Fixed 2026-11-12 (this update). Keep status rows true after every stream (B7). |
| **H-S4 — visual harness has no WebGL2** | `scripts/visual-regression.cjs` runs `--disable-gpu`, so stamp/WebGL paths are not exercised → false confidence on brush-tip changes. | Tracked as defect **0.7** (B7); either document hard or add a WebGL2 smoke. |
| **H-S5 — `orientationMatch` is not a metric** | identity failed on BROAD (i.e. real) histograms: `refPacketDistance(p,p)` was 0.1206, so `styleMatch` had a floor of 0.875 and could never reach 1. Cause: the denominator was a weighted mean of `cos(2Δθ)`, which penalises spread. This was the S2 §6 "term reads ≈0.50" mystery. | **DONE (2026-11-14)** — normalised by the kernel self-products `sqrt(K(a,a)·K(b,b))` (K is PSD ⇒ identity is exactly 1 for any distribution; delta-vs-delta unchanged, so every spike-comparison test still holds). Both pinned `KNOWN DEFECT` tests inverted (engine 137/137, ref-analyze 29/29). Re-measured on the style-aware probe: the corrected kernel **earns its weight** on a genuinely different pair (pencil 0.4317 vs pencil-ref / 0.3374 vs cross-hatch-ref, margin **+0.0943**; ink **+0.193**); the ADJACENT pencil-vs-ink pair measures **−0.0304** and is recorded as a KNOWN LIMITATION (the two references are `orientationMatch` 0.9636 apart — same content, structure-aligned). Probe re-scoped to the discriminating pair with the adjacent pair still reported. `docs/checkpoints/H-S5.md`; new diagnostic `scripts/style-ref-matrix.cjs` |
| **H-S6 — `scoreProfileStyle` is STYLE-AGNOSTIC** | its render was `optimise()` → `rasterizeShapes()`, neither of which reads the profile's `style`; a **pencil and an ink profile scored byte-identically** (0.887 / 0.928), so S2 measured the optimiser's stroke geometry, not the style. | **DONE (2026-11-13)** — `js/engine/style-render.js` (pure `toStyledShape`/`stampShapeStyles` + `createStyleRasteriser` through the real registry, falling back to the plain rasteriser without a canvas) wired into `scoreProfileStyle` (default backend, `options.render`/`applyStyle`/`style`, result `style`+`renderBackend`). Measured: a pencil vs an ink profile now differ in **97.1 %** of pixels (was 0 %); `node` output byte-identical; baselines 9/9 unmoved. `docs/checkpoints/H-S6.md` |

---

## 5. Execution order (next)

1. **Docs hygiene** — this doc + the `ROADMAP.md` / `ROADMAP_STATUS.md` refresh.
2. **S1** — RefPacket / analysis grid (`js/engine/ref-analyze.js`).
3. **S2** — Style-Match Score in `metrics.js` / `score.js`; wire into `propose` + `gate`.
4. **S6 (Phase 4.2)** — Profile library UI (Mac **M10**; already issued).
5. **S3 + S4** — multi-ref fusion + hierarchical passes in the schema + engine.
   *S3 done 2026-11-13.* **H-S6 (style-aware render path) DONE 2026-11-13**
   (`docs/checkpoints/H-S6.md`) — the blocker found by S3. **H-S5 (the orientation
   kernel) DONE 2026-11-14** (`docs/checkpoints/H-S5.md`) — it is a metric now, and
   the style-aware probe shows the orientation term earning its weight on a
   genuinely different reference pair. **S4 (hierarchical `passes[]`) DONE
   2026-11-14** (`docs/checkpoints/S4.md`) — the profile authors its schedule as
   first-class passes, band-biased but residual-driven, default unchanged
   (engine 146/146, 9 pinned baselines unmoved). **S9/S10 (the real content ×
   ref-set matrix) are what make S2's magnitude meaningful.**
6. **S8** — H3 real-LLM validation.
7. **S7 (Phase 6)** — worker batch deterministic apply (BE **B5** + Mac **M11**).
8. **R4 finish** — outlines / order / per-style shaping (BE **B4**; Mac **M7–M9**) when not blocking the S-track.
9. **S5, S9, S10** — primitives, continuous refinement, full style eval suite.

Cross-links to issued streams: **S6 = Mac M10**, **S7 = BE B5 + Mac M11**,
**S8 = BE H3-validation**, "finish R4" = BE B4. The rest (S1–S5, S9, S10) are
new BE spine/harness work.

---

## 6. Exit criteria for "sref-ready"

- User drops **1–4 refs** → a profile is proposed → layered preview → tweak → save.
- A saved profile applies in **one click via the worker, deterministic with a seed**.
- **Style-Match Score improves** under the propose/memory loop.
- The eval suite (content × refs) is **green**, with **no regression** on the Phase-0 baselines.

---

## 7. DO NOT

- Treat the legacy `painter.js` as the shipped engine (engine of record = the modular engine; Track R / `CLEANROOM.md`).
- Optimise only photo MAE/SSIM when the task is *style match to refs* (that is the exact defect Track S exists to fix).
- Skip the visual regression / gate when changing the generator or metrics.
- Break determinism — every new option defaults to byte-identical output, then opts in.

---

## 8. References

- `docs/ROADMAP.md` §1 / §5 / §7 — vision, phases, success criteria.
- `docs/AI_STYLE_HARNESS.md` — the H0–H5 loop Track S extends.
- `docs/CLEANROOM.md` — Track R (the engine being measured).
- `docs/STYLE_PROFILE.md` — the profile schema S3/S4 extend.
- `docs/API.md` — the `scorer.js` vs `score.js` split (H-S1).
