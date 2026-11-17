# S9b — feature-space change: render references through the style-aware backend

**Date:** 2026-11-17 · **Agent:** BE (ThinkPad) · **Track:** S (style accuracy) · **Status:** EXPERIMENT COMPLETE — reported
**Parent:** `docs/checkpoints/P9b.md` (design), `docs/checkpoints/S9.md` §6 — the diagonal loss is structural; fix = render references through the candidate's own style-aware backend.

## 1. The defect (S9 quantified, S10 pinned)

The S10 matrix renders references through the **legacy `PaintingEngine`** (`painter.js` path) while candidates go through the **style-aware backend** (`style-render.js` → real style registry, H-S6). Two different pixel pipelines process the two sides of every `refPacketDistance` comparison, so a render-path/content bias swamps the genuine style signal. Result: a style's own reference wins in only 3/27 rows (range 0.1438..0.9541), mean margin −0.0834. S9's verdict: **structural, not a weighting problem** (re-weighting ceiling 9/27; cost-matching 5/27).

## 2. The change (S9b)

Render the **reference** through the same style-aware backend as the candidate:

- **S10:** `refSet[c][s] = analyzeReference( paintEngine(c, style=s, 700strokes) )` — painter.js lays down its own interpretation of style `s`.
- **S9b:** `refSet[c][s] = analyzeReference( styleRasteriser( optimise(c, style=s, 700strokes) stamped with style s ) )` — the real registry stamps shapes with style `s`, identical pipeline to the candidate side.

Same construction as S10 (content-set × ref-set × candidate-style, 200-stroke candidate vs 700-stroke reference, same content per cell). The **only** change: the reference render backend.

## 3. Result

| Metric | S10 baseline (painter refs) | S9b (style-aware refs) | Delta |
|--------|----------------------------|------------------------|-------|
| ownIsBest (diagonal wins / 27 rows) | 3/27 | **12/27** | **+9 rows** |
| meanMargin | −0.0834 | **−0.0128** | **+0.0706** (near-neutral) |
| styleMatch range | 0.1438..0.9541 | 0.2167..0.9211 | tighter at both ends |

12 of 27 diagonals now WIN (was 3): charcoal wins on all 3 contents; cross-hatch wins 2/3; pencil, watercolor, graphic each win 1–2. The mean margin is essentially zero (−0.013 vs −0.083) — the structural bias is removed, the metric now actually identifies style.

## 4. Scope boundary (S9b is an experiment, not a claim)

- S9b re-runs the S10 matrix with styled references and **reports** ownIsBest + mean margin vs the pinned baseline. It does **not** change `scoreProfileStyle`, `ref-analyze`, `metrics`, or any engine file — only `scripts/` + this checkpoint.
- It does **not** re-pin the S10 baseline. Re-pinning is a deliberate, human-signposted decision only if the diagonal genuinely rises with no fidelity loss (H5 gate).
- Baseline run writes nothing; the `--json=<path>` record is the only artefact.

## 5. Gate run

| Gate | Result |
|------|--------|
| `node scripts/style-accuracy-s9b.cjs --json=s9b-report.json` | **PASS** — 243 cells, deterministic, no page errors (favicon 404 filtered, matching S10) |
| `node tests/engine.test.js` | **177/177** (no engine file touched) |
| `node scripts/visual-regression.cjs` | **9/9** pins unmoved |
| H5 gate | keep only on measured mean gain + human approval |

**Verdict:** the feature-space change removes the structural style-match bias (3 → 12/27 diagonal wins, mean margin −0.08 → −0.01). Re-pinning the S10 baseline is a **deliberate, separate decision** — S9b reports only. Nothing shipped to `main`; nothing re-pinned.

Signed-off-by: Hermes / BE — ThinkPad
