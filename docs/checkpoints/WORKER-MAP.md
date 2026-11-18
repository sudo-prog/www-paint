# Code Paint worker → optimizer.js — the dissection map (plan of record)

**Date:** 2026-11-18 · Agent: BE (ThinkPad) · **Status: dissection verified; the
three levers are scoped, not yet built.**

---

## 1. What was verified

`scripts/codepainter-worker.js` (1,131 lines; SHP vocabulary in
`scripts/codepainter-shp.js`; prose breakdown in `RE_BREAKDOWN.md`) was read
line-by-line against BOTH of our engines. Two findings, one negative and one
valuable:

**Finding 1 — `painter.js` IS the Code Paint worker, translated.** Identical
constants everywhere: the skin-tone focus Gaussians (Cb 102 / Cr 153), the
structure-tensor tangent expression (`0.5 * atan2(2b, d) + PI/2`), the
180-mutation hill-climb, the error-map CDF sampling, the `_assignLayer` hard
cuts. That is precisely why `docs/CLEANROOM.md` §2 rules it **never shipped as
the product engine**. Consequence: diffing the worker against `painter.js`
yields **zero new information** — we already have that logic, and we are
retiring it.

**Finding 2 — the valuable mapping is worker ↔ `optimizer.js`, and it is
small: three concrete ideas we lack.**

## 2. The three levers (leverage order)

| # | Idea | In the worker | What we have today | Where it lands |
|---|---|---|---|---|
| 1 | **Per-stroke gradient by weighted least squares** | `evaluate()` solves c0/c1 **analytically**: α²-weighted LSQ over the stroke's own coverage, with a small ridge toward c0 == c1 so flat wins unless the pixels ask for a gradient | sample + 35 %-blend toward the 2nd-nearest palette entry (measured: endpoint sampling jumps palette buckets → two-tone blobs, rejected) | `optimizer.js` stroke-colour step; directly targets the teacher's gradient-on-every-stroke stat (996/996) — the biggest lever |
| 2 | **Saliency-weighted placement** | a focus map (local contrast + edges + skin tones, gentle centre bias, normalised to mean weight 1) **multiplies the scoring weights**; plus subject detection (border k-means → Otsu split, clamped to 12–65 % of frame) | anchors are residual-error-driven only | `optimizer.js` scoring/anchor sampling; biases WHERE strokes land |
| 3 | **Palette-locked colour pair** | the best-fitting **PAIR** of palette colours fitted analytically from the same LSQ sums (their `PAL` branch) | post-hoc quantise snap (`quantiseColour`) | replaces the snap; the pair constraint keeps every stroke on-palette |

## 3. What the worker dissection can NOT capture (recorded honestly)

- **The 48 style LOOKS live in the PAGE code**, not the worker — the worker
  carries only the MIX table that reshapes strokes for scoring. The full
  `index.html` (8,019 lines) is a **reference spec for Track-S style targets,
  never copied** (CLEANROOM §2).
- **Long multi-point curves** (teacher: 156 structure strokes, p50 319px) come
  from the **teacher capture** (`docs/checkpoints/TEACHER-CODEPAINT.md`), not
  the worker — already on the roadmap via `chainDabs`-style plumbing.

## 4. The workflow (CLEANROOM governs HOW)

> map the idea in the worker → **re-derive from the published technique** →
> measure on the parity bench + frog fixture. **Never translate identifiers or
> control flow.** The reference worker stays behind the parity harness.

Weighted-LSQ gradient fitting is classical (ordinary least squares with a Tikhonov
ridge); saliency-weighted placement is classical (Itti–Koch-style saliency);
neither needs the worker's code to justify — the worker only tells us WHICH ideas
are worth re-deriving, in which order.

## 5. Execution order

1. **Gradient-solve** (lever 1) — largest fidelity/style win, smallest surface.
2. **Saliency weighting** (lever 2) — changes placement; needs a parity-bench +
   frog A/B.
3. **Palette-locked pair** (lever 3) — composes with 1 (same LSQ sums).
4. Curves — from the teacher capture, not the worker.

Each lever ships behind its own opt-in flag, **default off → byte-identical**
(the standing determinism rule), and is measured with
`scripts/parity-bench.cjs` + the frog fixture before it is enabled.
