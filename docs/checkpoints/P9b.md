# S9b — feature-space change: render references through the style-aware backend

**Date:** 2026-11-17 · **Agent:** BE (ThinkPad) · **Track:** S (style accuracy) · **Status:** design
**Parent:** `docs/checkpoints/S9.md` §6 — the diagonal loss is structural; the identified fix is to render references through the candidate's own style-aware backend so the only difference left is style.

## 1. The defect (S9 quantified, S10 pinned)

The S10 matrix renders references through the **legacy `PaintingEngine`** (`painter.js` path) while the candidate is rendered through the **style-aware backend** (`style-render.js` → real style registry, H-S6). Two different pixel pipelines process the two sides of every `refPacketDistance` comparison, so a render-path/content bias swamps the genuine style signal. Result: a style's own reference wins in only 3/27 rows (range 0.1438..0.9541), and no re-weighting (ceiling 9/27) or cost-matching (5/27) fixes it — S9's verdict: **structural, not a weighting problem.**

## 2. The change (S9b)

Render the **reference** through the same style-aware backend as the candidate:

- **Today (S10):** `refSet[c][s] = analyzeReference( paintEngine(c, style=s, 700strokes) )` — painter.js lays down its own interpretation of style `s`.
- **S9b:** `refSet[c][s] = analyzeReference( styleRasteriser( optimise(c, style=s, 700strokes) stamped with style s ) )` — the real registry stamps shapes with style `s`, identical pipeline to the candidate side.

Then a `(candidate style t, reference style s)` cell compares two renders processed identically; any remaining distance is style difference, not render-path bias.

## 3. Scope boundary (S9b is an experiment, not a claim)

- S9b re-runs the S10 matrix with styled references and reports the new `ownIsBest` and mean margin vs the pinned baseline (3/27, −0.0834).
- It does **not** change `scoreProfileStyle`, `ref-analyze`, `metrics`, or any engine file — only `scripts/` + a new checkpoint.
- It does **not** re-pin the S10 baseline. Re-pinning is a deliberate, human-signposted decision only if the diagonal genuinely rises with no fidelity loss (H5 gate).
- Baseline run writes nothing; `--update` pins only on sign-off.

## 4. Files

| File | Role |
|------|------|
| `scripts/style-accuracy-s9b.cjs` (NEW) | S9b bench: same content-set/ref-set/candidate as S10, refs rendered through `styleRasteriser` instead of `PaintingEngine`. Reports matrix + diagonal vs baseline. |
| `docs/checkpoints/P9b.md` (this file) | Design note (roadmap §8 step 2). |
| `docs/checkpoints/S9b.md` (NEW, after run) | Result + verdict; feed to H5 gate. |

## 5. Gate / exit

| Gate | Result |
|------|--------|
| `node scripts/style-accuracy-s9b.cjs` | report produced (diagonal vs 3/27 baseline) |
| `node tests/engine.test.js` | 177/177 (no engine file touched) |
| `node scripts/visual-regression.cjs` | 9/9 pins unmoved |
| H5 gate | keep only on measured mean gain + human approval; else rejected |

Signed-off-by: Hermes / BE — ThinkPad
