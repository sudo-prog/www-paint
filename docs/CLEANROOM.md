# Clean-Room Engine — Decision & Track

**Date:** 2026-11-10 · Agent: BE (ThinkPad) · Status: **decided; R0 + R1 + R2 done**

---

## 1. Decision

WWW_PAINT's **engine of record is the modular engine**
(`analyzer.js` + `generator.js` + `scorer.js` + `renderer.js`) — our own code.

`js/engine/painter.js` is the historical auto-painter and is **reference-only**
from here on:

- it is **never shipped as the product engine**, and
- it is kept **only as a local test fixture** for parity measurement.

The reference worker (`scripts/codepainter-worker.js`) is likewise a
**test-only** fixture — never imported by any app path.

### Why

1. **Intent.** WWW_PAINT was started as a 100%-original, stroke-based painting
   engine, refined and enhanced over the classical SBR literature. The modular
   engine was the first build (initial commit `069a777`, 2026-10-14) and matches
   `ARCHITECTURE.md`'s original design.
2. **Convergence.** The auto-painter (`painter.js`) evolved separately and became
   the incidental default renderer; the modular engine is the design we are
   converging on.

---

## 2. Principle

> **Inspired by the *technique*, never copied from the *source*.**

- New engine code is written from the **published literature** (Hertzmann 1998,
  structure-tensor SBR, Image Painter CCL+PCA init, Birth of a Painting smudge —
  all already cited in `docs/REFERENCES.md` / `docs/ROADMAP.md` §3).
- It is **not** a translation of any existing implementation. No identifier,
  table, or control flow is carried over. If a behaviour is needed, re-derive it
  from the paper.
- The reference fixture stays behind the parity harness, clearly labelled, never
  in a production import path.

---

## 3. The yardstick (how "match / exceed" is judged)

Two independent metrics per test image, produced by `scripts/parity-bench.cjs`:

| Metric | Meaning |
|---|---|
| `sim` | `100·(1 − MAE/255)` — the objective both engines report. Comparable across engines. |
| `mae` | mean abs error of the **rendered canvas vs the source**, computed by the harness itself (not self-reported) — the trust anchor. |

Plus a side-by-side PNG per run for eyeballing.

**Gate:** the clean-room engine must reach **≥ the reference's `sim` within 2 points**
on the benchmark before the port is retired; "exceed" means beating it, not
matching it.

---

## 4. Track R — milestones

| ID | Milestone | Exit criteria |
|---|---|---|
| **R0** | Parity harness + baseline | `parity-bench.cjs` runs N images × {ours, reference}, prints `sim`+`mae`, writes comparison PNGs. **Baseline gap recorded.** |
| R1 | Optimiser core | Residual/error-driven stroke placement + per-stroke local refinement (our own hill-climb), on the modular engine. Beats R0 baseline. |
| R2 | Structure-guided multi-scale | Coarse→fine; strokes follow the shared structure tensor (roadmap 1.2/1.3). |
| R3 | Better init | CCL + PCA stroke init (roadmap 1.4). Fidelity ≥ reference at equal stroke count. |
| R4 | Feature parity | Outlines, region-fill, path/order modes, per-style shaping — re-derived, not copied. |
| R5 | **Exceed** | Per-layer styles, smudge/blend + impasto, wet media, Style Profiles, AI refinement (roadmap Phases 2–5) — features the reference does not have. |
| R6 | Retire the legacy painter | App + baselines run 100% on the modular engine; the legacy painter demoted to a dev-only fixture. |

**Status:** R0 ✔ (harness + baseline gap) · **R1 ✔** — the optimiser core
(`js/engine/optimizer.js`, residual-driven placement + per-stroke local
hill-climb) beats the R0 baseline on all four bench images; rings already meets
the R6 "within 2 points of reference" gate. **R2 ✔** — structure-guided
multi-scale (coarse→fine pass schedule on the same optimiser) improves both
simMae and SSIM on every *structured* bench image (blobs 93.22→97.52 simMae,
0.832→0.867 SSIM); `noise` is the deliberate unfittable control. Evidence:
`docs/checkpoints/R1.md`, `docs/checkpoints/R2.md`,
`docs/research/parity/baseline.json`.

Ship-safety: the app stays runnable at every step. The legacy painter remains the default
until R6, switched behind a flag during R1–R5 so the two can be compared live.

---

## 5. Honest feasibility assessment

**Can the modular engine reach production quality? Yes — with one caveat.**

- The *algorithm* is not the hard part and is not secret: multi-scale
  residual-driven stroke placement over Bézier/stroke primitives is classical SBR,
  documented in public papers the roadmap already cites.
- The quality comes from **polish**: a per-stroke optimiser (hill-climb against
  the target) plus tuned styles — reproducible from first principles, craft and
  the visual gates.
- We go further on axes classical SBR lacks: structure-tensor-guided
  flow (1.2, done), multi-scale + CCL/PCA init (1.3/1.4), smudge/imposto (1.5),
  wet media (Phase 3), per-layer styles (Phase 2), Style Profiles + AI refinement
  (Phases 4–5).

**Caveat / risk:** parity is measured on *our* benchmark; a broad image set and a
blind side-by-side are needed before claiming a win. Timeline is multi-week, not
overnight — R1 is the first real quality step and the one that will show whether
the modular engine can carry the product.

---

## 6. Non-goals

- No copying identifiers, tables or control flow from an external implementation.
- No renderer merge with LAYERS (see `docs/INTEGRATION_STRATEGY.md`).
- Not deleting the port now — it is the measuring stick until R6.

## 7. References

- `docs/ROADMAP.md` §0 (engine of record) and §3 (algorithms).
- `docs/checkpoints/P1.md` — Phase 1.2 structure tensor (clean-room side).
- `scripts/parity-bench.cjs`, `tests/parity/harness.html`.
- `RE_BREAKDOWN.md` — the reverse-engineering study (already on file).
