# HANDOFF-BE — WWW_PAINT remaining BE work, split into streams

**From:** Hermes / BE — ThinkPad
**To:** Hermes / BE — ThinkPad (the engine side)
**Date:** 2026-11-12 · **Baseline:** `sudo-prog/www-paint@main = a403fc2`, remote == local
**Gates at issue:** engine **99/99** · visual regression **9/9** · wetsim **15/15**
**Companion:** `HANDOFF.md` (the Mac's streams) · `docs/MAC-TASKS.md` (Mac, live)
· `docs/WORKSPLIT.md` (ownership map) · `docs/ROADMAP_STATUS.md` (source of truth)

The original `HANDOFF.md` split the Mac's peripheral work into four file-isolated
streams (M1–M4) that could run **in parallel because they never touch the same
file**. This document does the same for the **remaining BE work**: every stream
below owns a **disjoint file set** where possible, and the one genuinely shared
hot file (`engine.js`) is drawn as a **single-writer lane** so streams on either
side of it are serialised rather than merged.

---

## 0. How to read this

- Same hard rules as `HANDOFF.md` §2: **one writer per file**, never delete
  without per-instance consent, **determinism** (new options default to
  byte-identical output, then opt in), **no new dependency** on the check path,
  never re-baseline to silence a red test, never trust a self-report.
- **Honest constraint:** the spine is a *serial* chain. Splitting it does **not**
  shorten the critical path — it isolates the parts that can safely run beside it
  (scoring, harness, integration) from the parts that cannot (anything on
  `engine.js`). Streams marked **PARALLEL** never touch a hot file; streams marked
  **SERIAL-LANE** contend on `engine.js` and must run one at a time.

**Hot files (single-writer lane):** `engine.js`, `renderer.js`, `optimizer.js`,
`generator.js`, `analyzer.js`, `painter.js`, `scorer.js`.

---

## 1. The board — what remains, grouped into streams

| Stream | Roadmap | Files (owned) | Can parallel? |
|---|---|---|---|
| **B1** Render-path closers | 1.5 + 3.3 | `renderer.js`, `engine.js` | SERIAL-LANE |
| **B2** Layer-aware scoring | 2.2 | `metrics.js`, `score.js`, `scorer.js` | **PARALLEL** |
| **B3** Harness AI loop | H3 + H4 + H5 | `propose.js`, `vision-propose.js`*, `memory.js`*, harness docs | **PARALLEL** |
| **B4** Track R parity → retire | R4 → R5 → R6 | `optimizer.js`, `generator.js`, `analyzer.js`, `painter.js`, `engine.js` | SERIAL-LANE |
| **B5** Phase 6 polish / export | 6 | `exporter.js`, `engine.js`, UI wiring | SERIAL-LANE |
| **B6** Integration B / C | B + C | `docs/INTEGRATION_STRATEGY.md`, `schemas/`*, `.github/**` | **PARALLEL** |
| **B7** Defect & hygiene | 0.7 + docs | harness note, doc truth | **PARALLEL** |

`*` = new file. Phase 7 (stretch) is not scheduled here — it opens only after R6.

---

## 2. Streams

### B1 — Close the render path (Phase 1.5 + Phase 3.3)

**Goal.** The two renderer-side closers left on the spine:

1. **1.5** — a lightweight smudge / blend pass plus an **optional** paper
   *height buffer*, so wet media can darken and pool along the sheet rather than
   sit flat.
2. **3.3** — **mediaModel integration**: the modular engine consumes
   `profile.mediaModel` and drives the already-landed `wetsim.js` (IF-2) in the
   render path — construct the sim at the render target size, deposit pigment per
   stroke, `dry(dt)`, `compositeInto(ctx)`.

**Files you own:** `js/engine/renderer.js` (BE-owned, HANDOFF §6),
`js/engine/engine.js` (wiring only); consumes `js/engine/wetsim.js` unchanged.

**Deliverables**
- A smudge/blend step in `renderLayer()` and an optional `height` buffer.
- `engine.generate({ profile })` builds a wetsim when `mediaModel.kind != 'dry'`
  and routes wet styles through it; the deposit hook reads shape position, size
  and colour.
- Checkpoints `docs/checkpoints/P1.5.md` and `docs/checkpoints/P3.3.md`.

**Exit criteria**
- [ ] `mediaModel.kind = 'dry'` (the default) → output **byte-identical**;
      `scripts/visual-regression.cjs` **pass=9 fail=0 error=0**, baselines unmoved.
- [ ] Opt-in wet media provably changes output in a real headless browser
      (probe: deposit → composite changes > 0 px), deterministic under a seed.
- [ ] `node tests/engine.test.js` ≥ 99/99 (new tests added, none removed);
      `node tests/wetsim.test.js` still 15/15.

**Depends on:** wetsim (done, M1). **Serial with:** B4, B5 (all three touch `engine.js`).

---

### B2 — Layer-aware scoring (Phase 2.2 closer)

**Goal.** Scoring today is whole-frame. Make it **layer-aware**: score each layer
against its own tonal mask / target, and expose a composite score, so the
optimiser and the harness can optimise per layer (the missing half of Phase 2.2).

**Files you own:** `js/engine/metrics.js`, `js/engine/score.js`,
`js/engine/scorer.js`; tests in `tests/engine.test.js` (coordinate the add-only
edit with B1/B4 — append, never renumber).

**Deliverables**
- `scoreLayer(profile, image, layer)` + a per-layer breakdown in `scoreProfile`.
- Wire the layer masks (`masks.js`, IF-1, Mac-owned — consume only) to the
  layer objective.
- Checkpoint `docs/checkpoints/P2.2b.md`.

**Exit criteria**
- [ ] Per-layer scores sum/aggregate into the composite deterministically.
- [ ] Headless, node-only; no DOM.
- [ ] Existing whole-frame scores unchanged for a single-layer profile
      (backward-compatible); tests added.

**Depends on:** H1 (`metrics.js`/`score.js`) + masks (done). **Parallel** with B1, B3, B6 (disjoint files).

---

### B3 — Harness AI loop (H3 + H4 + H5)

**Goal.** Finish the AI style-replication loop that H1/H2 started.

- **H3** — a **vision → profile proposer**: 1–4 reference images in, a candidate
  profile out, then iterate with the H2 search + H1 metrics as critique. The LLM
  call is a **pluggable backend** (function injection) so the orchestration is
  deterministic and node-testable with a stub; one real end-to-end run recorded.
- **H4** — **memory**: a feedback store (attempt → score, accept/reject) plus
  retrieval so the proposer starts from prior wins.
- **H5** — **Tier B**: an agent-improved engine-code path, **benchmark-gated** —
  a candidate change is kept only if the parity/harness metrics improve.

**Files you own:** `js/engine/propose.js` (extend), NEW `js/engine/vision-propose.js`,
NEW `js/engine/memory.js`; `docs/AI_STYLE_HARNESS.md`; tests.

**Deliverables**
- `vision-propose.js`: `proposeFromImages(images, { llm, search, seed })` with a
  null-LLM stub path and a documented real-backend adapter.
- `memory.js`: append/query of `(profile, imageHash, score, verdict)` with a
  deterministic retrieval rank.
- H5 gate: a recorded before/after on ≥1 benchmark image.

**Exit criteria**
- [ ] All three are headless + deterministic under a seed; the LLM call is
      injected (no network in the unit tests).
- [ ] One **real** H3 run recorded with its raw output (model + images noted).
- [ ] H5 keeps a change only on measured improvement — the losing candidate is
      recorded, not hidden.
- [ ] `docs/checkpoints/H3.md`, `H4.md`, `H5.md`; ≥ 99/99 engine tests.

**Depends on:** H1/H2 (done). **Parallel** with B1, B2, B6.

---

### B4 — Track R: parity → exceed → retire (R4 → R5 → R6)

**Goal.** The long pole. Bring the modular engine to **feature parity** with the
legacy auto-painter (R4: outlines / region-fill / paint order / per-style
shaping), then **exceed** it (R5: per-layer styles, smudge, wet media, profiles,
AI), then **retire the port** (R6: switch the app to the modular engine and
re-baseline 100 % clean-room).

**Files you own:** `js/engine/optimizer.js`, `generator.js`, `analyzer.js`,
`painter.js`, `engine.js`, the 9 baseline styles at R6.

**Deliverables** — one checkpoint per milestone (`R4.md`, `R5.md`, `R6.md`) with
the parity-bench table (`scripts/parity-bench.cjs`) per image.

**Exit criteria**
- [ ] R4: parity bench shows the modular engine ≥ the legacy painter on **every**
      listed feature; regressions recorded honestly.
- [ ] R5: the "exceed" list demonstrably beats the port on the bench.
- [ ] R6: `index.html` paints through the modular engine; baselines re-baselined
      **with the reason stated** in the commit + OPS_LOG.

**Depends on:** R3 (done). **Serial with:** B1, B5 (owns `engine.js` in its window).

---

### B5 — Phase 6: polish, performance, export

**Goal.** Perf pass (frame budget on a 512² canvas), the export surface
(PNG / JPG / SVG / profile JSON through `exporter.js`), and the engine-side
wiring for the Mac's export UI (M8).

**Files you own:** `js/engine/exporter.js`, `engine.js` (export wiring), perf docs.
**Not yours:** the export *panel* UI — that is the Mac's M8.

**Exit criteria**
- [ ] `exportPNG/JPG/SVG` round-trip at 3 sizes; deterministic (same input →
      byte-identical output twice).
- [ ] A recorded frame-time budget on 512²; no regression vs the current build.
- [ ] Checkpoint `docs/checkpoints/P6.md`.

**Depends on:** B1 (render path). **Serial with:** B4 (owns `engine.js`).

---

### B6 — Integration Track B / C

**Goal.** **B** — vendor the LAYERS **AJV schemas** and align the contract
(Style Profile ⊇ LAYERS preset / effect-stack); **C** — mount WWW_PAINT into
LAYERS. See `docs/INTEGRATION_STRATEGY.md`.

**Files you own:** `docs/INTEGRATION_STRATEGY.md`, NEW `schemas/`, `.github/**`
(CI guard), the vault.

**Exit criteria**
- [ ] Schemas vendored with provenance; a CI job validates a sample profile.
- [ ] Contract-alignment note: every LAYERS field maps to a Style Profile field
      (or is explicitly out of scope).
- [ ] Checkpoint `docs/checkpoints/INT.md`.

**Parallel** with everything (disjoint files).

---

### B7 — Defect & hygiene

**Goal.** Keep the record true. Defect 0.7 (the visual harness has **no WebGL2**,
so it cannot catch WebGL-path changes) — either document the gap hard or add a
WebGL2 smoke; and keep `docs/ROADMAP_STATUS.md` / checkpoints / OPS_LOG honest
after every stream.

**Exit criteria**
- [ ] 0.7 either mitigated or re-documented with its exact blast radius.
- [ ] No stale status rows after any stream lands.

**Parallel** with everything.

---

## 3. Parallelisation / serialisation map

```
PARALLEL WAVE (disjoint files — can run at the same time)
  B2  metrics.js score.js scorer.js
  B3  propose.js vision-propose.js memory.js
  B6  docs/schemas/.github
  B7  docs/harness note

SINGLE-WRITER LANE on engine.js / renderer.js (strictly one at a time)
  B1  renderer.js + engine.js   (1.5 + 3.3)
   ↓
  B4  optimizer.js generator.js analyzer.js engine.js  (R4→R5→R6)
   ↓
  B5  exporter.js + engine.js   (Phase 6 export / perf)
```

Rule: a PARALLEL stream may run beside the lane, but **two lane streams never run
together** — they share `engine.js`/`renderer.js`. If two machines/agents must
work at once, give the second one a PARALLEL stream.

---

## 4. Definition of done (per stream)

1. Files committed by **explicit path** (`feat(...)`), pushed to `main`, and
   **remote == local verified** (`git ls-remote`).
2. `node tests/engine.test.js` → raw pass/fail line (≥ 99, add-only).
3. `node scripts/visual-regression.cjs` → raw `pass= fail= error=` line; if
   re-baselined, the reason is in the commit **and** OPS_LOG.
4. `node scripts/parity-bench.cjs` → per-image simMae/SSIM table (B4/B5).
5. `docs/checkpoints/<ID>.md` written (research → design → result).
6. One dated OPS_LOG line (`>>` append; state `NOTHING DELETED`).
7. The numbers are reproducible from the pasted commands.

**Evidence format — the command and its real output, never a paraphrase:**
```
$ node tests/engine.test.js
Passed: 99   Failed: 0
```

---

## 5. Reporting

One dated line per stream to the shared ledger (`OPS_LOG.md`, a symlink — append
with `>>`, never overwrite), prefix `[TP]`. Facts + evidence only; state
`NOTHING DELETED` explicitly. A blocker you cannot resolve → an OPS_LOG line
starting `[TP] BLOCKED:` with the exact error, and stop that stream rather than
thrash.

---

## 6. Reading list

| Doc | Why |
|---|---|
| `docs/ROADMAP.md` / `docs/ROADMAP_STATUS.md` | the brief + what is done |
| `docs/CLEANROOM.md` | engine-of-record + Track R |
| `docs/AI_STYLE_HARNESS.md` | the eval loop (H1–H5) |
| `docs/STYLE_PROFILE.md` | the frozen profile schema (4.1 / 4.2) |
| `docs/INTEGRATION_STRATEGY.md` | Track B / C |
| `docs/REFERENCES.md` | papers/libraries ideas may come from |
| `js/engine/wetsim.js` §"Integration contract" | the exact 3.3 call site |

---

## 7. Round 2 — remaining BE streams (issued 2026-11-12)

Round-1 streams **B1** (1.5 + 3.3) and **B2** (2.2b layer-aware scoring) are
**DONE**; **B3** is done except **H3's real-LLM validation**; Mac's **M6** media
panel has landed and been BE-verified (`41286c1`). What remains on the BE side:

- **B4 — finish Track R.** Integrate the Mac's new modules (M7 `outlines.js` IF-3,
  M8 `order.js` IF-4, M9 `styles/shaping.js`) into `optimizer.js` — outlines-first
  pass, order modes, per-style shaping — then **R5** consolidate and **R6** retire
  the legacy painter (app + baselines 100 % on the modular engine).
- **B5 — Phase 6 (engine).** Perf pass (512² frame budget) + `exporter.js`
  hardening. The export *panel* is the Mac's M11.
- **B6 — Integration.** Track **B**: vendor the LAYERS AJV schemas + a
  contract-alignment doc + a CI-validatable sample; Track **C**: mount WWW_PAINT
  into LAYERS.
- **B7 — Hygiene.** Defect 0.7 (visual harness lacks WebGL2); keep the docs true
  after every stream.
- **H3-validation.** Run the vision proposer against a real backend when one is
  configured (the ≥ 70 %-usable criterion).

**Coordination:** the Mac logs **every turn** in `AGENTS.md` §7 (round-2 progress
log) and never runs git; BE is the sole GitHub writer/pusher. The Mac's remaining
streams are issued in `docs/MAC-TASKS.md` §"Round 2".

Signed-off-by: Hermes / BE — ThinkPad

---

## 8. Track S — style accuracy (added 2026-11-12)

Beyond the round-2 streams above, the sref goal needs a **measurement** track:
today's harness scores content reconstruction (MAE/SSIM), not style match to the
refs. Full detail: `docs/TRACK_S.md`. Mapping onto the streams:

- **S1** (analysis grid + `RefPacket`, NEW `js/engine/ref-analyze.js`) and **S2**
  (Style-Match Score in `metrics.js` / `score.js` / `gate.js`) are new BE spine
  work — **the live front**, ahead of B4.
- **S3** (multi-ref fusion, `ref-analyze.js` + `profile.js`) and **S4** (`passes[]`
  in `docs/STYLE_PROFILE.md` + `optimizer.js` / `profile.js`) are new BE work.
- **S5** (`js/engine/primitives.js`) — BE + Mac.
- **S6 = Mac M10** (Phase 4.2 library UI). **S7 = BE B5 + Mac M11** (Phase 6
  worker batch + export). **S8 = H3-validation** (above). **S9 / S10** — BE harness.
- **Finish R4** (B4 + Mac M7–M9) stays as issued; run it when it does not block S1 / S2.

---

## 9. Round 3 — remaining BE board after S1 (issued 2026-11-12)

**Baseline:** `main = 28e8933`, remote == local. Mac **M7/M8/M9 are landed and
BE-pushed** (`28e8933`); Track-S **S1 is closed** (`js/engine/ref-analyze.js`,
16/16 — `docs/checkpoints/S1.md`). The board now:

| Stream | What | Hot files | Lane |
|---|---|---|---|
| **S2** | Style-Match Score — ref vs result: stroke-scale histogram distance + orientation/coherence match + layer-occupancy, into `scoreProfile` / `propose` / `gate` | `metrics.js` `score.js` `gate.js` | PARALLEL |
| **S3** | Multi-reference fusion → one RefPacket on `profile.provenance` (per-ref weights, outlier down-weighting) | `ref-analyze.js` `profile.js` | PARALLEL |
| **S4** | Explicit `passes[]` in the Style Profile mapped onto the R2 multi-scale machinery (absent = byte-identical) | `docs/STYLE_PROFILE.md` `profile.js` `optimizer.js` | SERIAL-LANE |
| **S8** | H3 real-LLM validation (vision → profile, ≥ 70 % usable) | `vision-propose.js` | PARALLEL |
| **S10** | Style-accuracy eval suite (content × ref-set matrix; a Style-Match regression fails) | `scripts/*.cjs` `tests/*` | PARALLEL |
| **S9** | Active refinement — knob ↔ Style-Match correlation over the memory store | `memory.js` `propose.js` `gate.js` | PARALLEL |
| **B4 finish** | Wire Mac M7/M8/M9 into `optimizer.js` (outlines-first pass, order modes, per-style shaping) + **reconcile the two `orderShapes`** (`generator.js` vs `order.js`, §0.9) → **R5** exceed → **R6** retire the painter | `optimizer.js` `generator.js` `analyzer.js` `engine.js` `painter.js` | SERIAL-LANE |
| **B5** | Phase 6 engine — export hardening + 512² perf + worker batch apply (S7 engine half) | `exporter.js` `engine.js` `worker.js` | SERIAL-LANE |
| **B6** | Integration Track B/C — vendor LAYERS AJV schemas + contract note + CI sample; mount | `schemas/` `.github/**` | PARALLEL |
| **B7** | Hygiene — defect 0.7 (visual harness has no WebGL2); keep `ROADMAP_STATUS` true | docs | PARALLEL |

**Live front:** S2 follows S1 (it consumes the RefPacket). S4/S3 also open now
(S3 shares `ref-analyze.js` with S1 — serial with S2 only if both edit it).

**Mac's round-3 streams** (M10–M16) are issued in `docs/MAC-TASKS.md` §"Round 3";
Mac logs every turn in `AGENTS.md` §7 and never runs git (BE is sole pusher).

Signed-off-by: Hermes / BE — ThinkPad
