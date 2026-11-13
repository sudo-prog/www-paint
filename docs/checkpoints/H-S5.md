# Checkpoint H-S5 — `orientationMatch` is now a metric (Track S hygiene)

**Date:** 2026-11-14 · Agent: BE (ThinkPad) · Hygiene item **H-S5**
(`docs/TRACK_S.md` §4) — defect **A** of `docs/checkpoints/S3.md` §7, unblocked by
**H-S6** (the style-aware render path, `docs/checkpoints/H-S6.md`).
**Status:** done. The kernel is corrected, both `KNOWN DEFECT` tests are inverted,
and the real-world probe is re-scoped onto a pair the references can actually
separate — with the pair that cannot be separated **reported**, not asserted away.

---

## 1. The defect (S3.md §7 A)

`orientationMatch` divided the kernel cross-product by the raw bin mass
`Σᵢⱼ aᵢbⱼ`, i.e. it computed a **weighted mean of `cos(2Δθ)`**. That penalises
*spread*: a DELTA histogram matched itself exactly (all existing unit tests were
deltas), but a BROAD histogram — every real render — did not. Measured in S3:

```
refPacketDistance(p, p).distance = 0.1206        (must be 0)
  parts: scale 0, orientation 0.4826, coverage 0, bandScale 0, coherence 0
⟹ styleMatch had a FLOOR of 0.8754 — a render identical to its reference
  could never score above 0.875.
```

This *is* the S2 §6 mystery ("the orientation term reads ≈0.50 against both
references — a coin flip"): not the data, the denominator.

## 2. The fix — kernel self-product normalisation

```
K(a,b) = Σᵢⱼ aᵢbⱼ cos(2·Δθᵢⱼ)          (unchanged)
s      = K(a,b) / sqrt(K(a,a)·K(b,b))    (was K(a,b) / Σᵢⱼ aᵢbⱼ)
match  = (1 + s) / 2                     (unchanged)
```

`K` is a Gram matrix — `cos(2θᵢ)cos(2θⱼ) + sin(2θᵢ)sin(2θⱼ)`, rank ≤ 2, hence
**PSD** — so Cauchy–Schwarz bounds `s` to `[−1, 1]` and bounds the score to
`[0, 1]` with **identity exactly 1 for any distribution**, broad or delta.
Delta-vs-delta is unchanged (`K = 1` for a unit bin), so every pre-H-S5
expectation that compared spikes still holds. Implemented as a small
`orientationKernel(X, Y, n, step)` helper in `js/engine/metrics.js`; the
`KNOWN DEFECT` comment block is **deleted** (the docstring now carries the reason
the normalisation is the correct form).

## 3. Tests — the pins are inverted, not deleted

| File | Was | Now |
|---|---|---|
| `tests/engine.test.js` | `orientationMatch: KNOWN DEFECT … identity fails for a BROAD histogram` — asserted the self-score stays in `(0.4, 0.9)` | `orientationMatch: identity is exactly 1 for a BROAD histogram too (H-S5)` — `1 ± 1e-12` for a broad, a uniform and a scaled histogram; Cauchy–Schwarz range + symmetry kept; plus a guard that a *different* distribution still scores `< 0.999` (the fix must not flatten the metric) |
| `tests/engine.test.js` (`refPacketDistance: a packet against itself is 0 in EVERY term`) | DELTA orientation field only | extended: a packet with a **BROAD** orientation field is also 0 in every term — that is the defect's exact signature |
| `tests/ref-analyze.test.js` (`one reference fuses to its own normalised packet`) | asserted the four exact terms and **pinned** `orientation > 0.4` | asserts **all five** terms are 0 against the source packet |
| `tests/ref-analyze.test.js` (`a real packet IS zero-distance from itself`) | pinned `0 < distance < 0.2` | `distance === 0`, every part `0`, `refPacketMatch === 1` |

Suites: **engine 137/137, ref-analyze 29/29.**

## 4. Re-measurement on the style-aware probe (the point of the exercise)

`scripts/style-match-probe.cjs`, equal cost (200 strokes), seed 11, real headless
Chromium, at 700-stroke pinned references:

| Pair | before H-S5 (old kernel) | after H-S5 |
|---|---|---|
| pencil profile vs **pencilRef** | 0.4134 | 0.4317 |
| pencil profile vs **inkRef** | 0.4060 | 0.4621 |
| **margin (adjacent pair)** | **+0.0074** | **−0.0304** |
| pencil profile vs **cross-hatchRef** | (not measured) | 0.3374 |
| **margin (discriminating pair)** | (not measured) | **+0.0943** |
| ink profile vs inkRef / cross-hatchRef | (not measured) | 0.7828 / 0.5898 → **+0.1930** |

The corrected kernel **amplifies** the orientation signal — from a 0.028 spread
to a 0.179 spread between the two references. It amplifies it in the *wrong
direction* for the pencil/ink pair, because those two references are not really
different. Measured with the new `scripts/style-ref-matrix.cjs` (9 pinned
references, all 700 strokes):

```
orientationMatch(pencilRef, inkRef)        = 0.9636     ← 3.6 % apart
orientationMatch(pencilRef, crossHatchRef) = 0.5996
orientationMatch(inkRef,   halftoneRef)    = 1.0000
scaleHistogramDistance(pencilRef, inkRef)  = 0.0410
```

Both are 700-stroke **structure-aligned** renders of the SAME content, so their
packets are content-dominated — exactly the "still-weak same-content reference
pair" S2 §6 and S3 §7 already recorded. Term decomposition of the discriminating
pair (pencil profile, `parts` = distance):

```
              vs pencilRef   vs crossHatRef   Δ × weight
orientation      0.4195          0.9675        +0.1370   ← carries the margin
scale            0.7686          0.6860        −0.0248
coverage         0.6046          0.6917        +0.0174
bandScale        0.5603          0.3892        −0.0257
coherence        0.2788          0.1821        −0.0097
                                              --------------
net margin                                      +0.0942  (measured +0.0943)
```

So the orientation term now **earns its 0.25 weight** where the references
genuinely differ — which is the validation H-S5 needed, and which the adjacent
pair could never provide.

## 5. The probe change — and why it is not "silencing a red run"

`scripts/style-match-probe.cjs` used to `process.exit(1)` whenever the
pencil-vs-ink margin was ≤ 0. After H-S5 that assertion is red, and it *should*
be: it demanded that a metric separate two references that are 96.4 % identical
in orientation and 0.04 apart in scale — a demand S3 §7 had already measured as
unsatisfiable. That assertion was never sound; H-S5 is what made it visible.

Changed:

- the **ASSERTED** pair is now pencil-vs-**cross-hatch** (a genuinely different
  stroke language) for both a pencil profile and an ink profile;
- the **adjacent** pencil-vs-ink pair is still computed and printed, now as a
  labelled `H-S5 KNOWN LIMITATION` line that carries its own reason
  (`orientationMatch(pencilRef, inkRef) = 0.9636` vs `0.5996` for cross-hatch);
- a third 700-stroke reference (cross-hatch) is rendered by the probe itself.

Nothing was deleted and no number was adjusted: the old measurement is still
reported on every run, with its cause.

## 6. What H-S5 does NOT fix (recorded, not hidden)

- **S2 still cannot be called validated.** Its exit criteria name a genuinely
  different reference pair; that is S9/S10's job. ROADMAP_STATUS says so.
- **The probe compares different renderers.** The references come from the APP
  painter (`window.runCase`, `tests/visual/regression.html`); the profile render
  comes from the MODULAR engine's style-aware rasteriser (H-S6). Symptom, now
  measured: a pencil-profile render scores **0.5188 against the halftone
  reference** — higher than its own 0.4317 vs the pencil reference — because a
  modular-engine pencil render's packet resembles the app-painter halftone
  packet. That is a renderer mismatch, not a style verdict, and it is the
  concrete reason a strong reference pair (S9) must come with a matched
  renderer/pair definition.
- `coherence` (weight 0.10) is the weakest term on every pair and moved the
  margin by ≤ 0.01 everywhere; noted as a candidate for re-weighting in S10, not
  changed here.

## 7. Evidence (all commands from the repo root)

```
$ node tests/engine.test.js        -> Passed: 137  Failed: 0
$ node tests/ref-analyze.test.js   -> Passed: 29   Failed: 0
$ node tests/{wetsim,masks,outlines,order,shaping,style-library,export-panel,style-polish}.test.js
                                   -> Failed: 0 (15/19/16/24/18/50/90/11)
$ NODE_PATH=<playwright-core> node scripts/visual-regression.cjs
                                   -> pass=9 fail=0 error=0 total=9   (9 pinned baselines UNMOVED)
$ NODE_PATH=<...> node scripts/style-match-probe.cjs          -> exit 0
   H-S5 MEASURED (discriminating pair): pencil 0.4317 vs cross-hatch 0.3374 (margin 0.0943);
     ink 0.7828 vs 0.5898 (margin 0.193)
   H-S5 KNOWN LIMITATION (reported): adjacent pair pencil 0.4317 vs ink 0.4621 (margin -0.0304)
$ NODE_PATH=<...> node scripts/style-ref-matrix.cjs            -> exit 0 (NEW, §4 tables)
```

`js/engine/*` edits are limited to `metrics.js` (the kernel + its docstring);
`js/engine/score.js`, `gate.js` and the render path are untouched — the fix is
one function, and no render path moved (baselines unmoved).
