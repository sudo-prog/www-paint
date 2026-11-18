# Track-S overnight — the worker levers, measured (2026-11-19)

**Agent:** BE (ThinkPad) · **Fixture:** `test-images/frog-source.jpg` (640x668 cartoon frog)
**Instrument:** `scripts/frog-fidelity-harness.mjs` — renders through the REAL app path
(`PaintingEngine`, `useWorker:true`) and reports `r` (64x48 luminance correlation),
`mad`, `ssim`, `inkPct`, colour buckets, and `gradD`/`nonFlat%` (per-stroke gradient).

---

## 0. The first deliverable was not a frog — and why

`scripts/render-frog-three.mjs` (the earlier attempt) read `test-images/frog.png`.
That file is a **synthetic test pattern** (blue square, red circle, green triangle,
"TEST" text) — NOT a frog. The real fixture is `test-images/frog-source.jpg`.
It also painted the optimiser's raw ellipse dabs directly, bypassing
`dabToStrokeShape`, which is what produced the "blobs of mess".

Both fixed; the real path renders a recognisable frog
(inkPct 42–46 vs source 45.9; 268–508 colour buckets).

## 1. The gradient was solved correctly, then destroyed twice

Traced the colour through three stages (frog fixture, 3200 dabs):

| stage | flat | gradientLSQ | all-three |
|---|---|---|---|
| raw optimiser dab | 0.0 % / 0.00 | 93.7 % / **76.31** | 99.9 % / **91.01** |
| after `dabToStrokeShape` | 100 % / 16.15 | 100 % / 12.44 | 100 % / 11.84 |
| after post-hoc quantise | 8.0 % / 0.16 | 18.0 % / 0.36 | 0.1 % / **0.00** |

**Kill point A** — `dabToStrokeShape()` unconditionally replaced the solver's
`c0`/`c1` with its own 35 %-blend-toward-the-2nd-nearest-palette heuristic.
**Kill point B** — `buildModularPlan()` quantised `color0` and `color1`
*independently*, snapping them onto the SAME palette bucket → flat.

Both now gated on the `gradientLSQ` lever (`preserveStrokeGradient`), so the
default path is byte-identical and the solver's gradient survives when the
lever is on: `gradD` 0.16 → 80.03, `nonFlat` 8.1 % → 98 %.

## 2. A pin regression caught and bisected

`scripts/visual-regression.cjs` went **9/9 → 4/9**. Bisected against a pristine
`git archive HEAD` tree:

| tree | pins |
|---|---|
| pristine HEAD | 9 / 9 |
| HEAD + new `import { clamp }` | 9 / 9 |
| HEAD + `buildModularPlan` quantise change | **4 / 9** ← cause |

Mechanism: `settings.modular` defaults to **true** (`js/engine/generator.js`),
so the 9 pins render through the MODULAR path. The new quantise block preserved
the 35 % blend on *every* stroke — including the default path — where HEAD's
independent quantise flattened it again. Fix: gate on the lever → pins back to
**9/9**, default path byte-identical.

## 3. Fidelity is dominated by STYLE, not by the three levers

Swept every registry style on the modular path. Best by `r`:
`flat` 0.9437, `tape` 0.9257, `plast` 0.9250, `thread` 0.9248,
`watercolour` 0.9234, **`graphic` 0.9218** (ssim **0.7008**) — vs the default
`pencil` at r 0.9029 / ssim 0.6876. `pen` gives ssim 0.6997.

**That single style choice is worth more than all three levers combined.**

### 3b. 25 of 48 styles ignore `color1` — the gradient is invisible in them

`pencil.js` reads only `shape.color0` (lines 156, 175, 296); it never reads
`color1`. Measured by rendering identical shapes with and without a gradient and
diffing pixels (`meanDiff > 0.05` ⇒ the style honours it):

- **Honour the gradient:** `graphic` (meanDiff 5.97, r 0.9072), `riso`, `crystal`,
  `lens`, `glass`, `watercolour`, `calligraphy`, `halftone`, `frost`, `bokeh`,
  `charcoal`, `stitch`, `string`, `oil`, `hylics`, the metals…
- **Ignore it (gradient is invisible):** `pencil`, `ink`, `graffiti`, `marker`,
  `cross-hatch`, `hatch`, `mosaic`, `scribble`, `sumi`, `gouache`, `knife`,
  `pastel`, `pen`, `wash`, `dots`, `linocut`, `tape`, `thread`, `neon`, `paper`,
  `glitch`, `embroid`, `plast`.

`graphic` is both a top-fidelity style AND gradient-aware — the only style
that is in the top 5 of BOTH lists.

## 4. The lever results, honestly

On `graphic` (base r 0.9215 / ssim 0.6994):

| config | gradD | nonFlat | r | Δr | ssim |
|---|---|---|---|---|---|
| base | 0.16 | 8.1 % | 0.9215 | — | 0.6994 |
| + gradientLSQ | 80.03 | 98 % | 0.9072 | −0.0146 | 0.6841 |
| + gradient + paletteLockedPair | 84.06 | 98 % | 0.9117 | −0.0101 | 0.6788 |
| + gradient + saliency(strength 0.25) | 105.97 | 98 % | 0.8889 | −0.0326 | 0.6619 |
| all three (saliency 0.25) | 84.54 | 98 % | 0.8983 | −0.0232 | 0.6610 |

**No lever configuration is net-positive on `r`.** The gradient costs fidelity
even though it demonstrably reaches the render.

**Saliency is the worst offender** (r −0.057 at strength 1.0). It starves
low-saliency regions of strokes — exactly where the residual error lives — so
the background loses structure. `saliencyStrength` (new, opt-in, default 1.0)
blends the focus map instead of replacing it and cuts the loss to −0.020.

**Gradient magnitude is not the whole story.** Capping to the teacher's measured
band (median pair distance 34.6 RGB) recovers part of it:

| cap | gradD | r |
|---|---|---|
| none | 80.03 | 0.9072 |
| 50 | 35.94 | 0.9061 |
| 34.6 (teacher) | 26.18 | 0.9053 |
| 20 | 16.26 | 0.9040 |
| 10 | 8.82 | 0.9026 |

The unbounded gradient still scores best on `r`, so the residual cost is the
gradient's *direction/content*, not only its magnitude.

## 5. The deeper gap: we paint DABS, the teacher paints STROKES

`docs/checkpoints/TEACHER-CODEPAINT.md` (same fixture, 996 teacher strokes):

| metric | Code Paint | WWW_PAINT |
|---|---|---|
| stroke length p50 | 129 px | 24.6 px |
| stroke width p50 | 3.3 px | 7.2 px |
| **aspect (len/width) p50** | **44:1** | **3.4:1** |
| structure strokes | 156 multi-point curves | none — isolated dabs |

Our measured current aspectP50 IS 3.4:1. The colour gradient, alpha 0.8 and
palette-24 were already applied per TEACHER-CODEPAINT.md §31–47 — the
**geometry** was not. That is the largest remaining gap.

## 6. Two more "wired but inert" options

`engine.generate()` does not forward `strokeElongation` / `strokeWidthScale`
/ `strokeBudgetScale` / `strokeStructureAlign` / `strokeAlpha` / `paletteSize`
/ `quantiseColours` / `dabsAsStrokes` to `buildModularPlan()`. Proven by
experiment: a 15-cell sweep of `strokeElongation` x `strokeWidthScale` returned
IDENTICAL output for every cell (r 0.9215, aspectP50 3.4, inkPct 42.93). Same
class as the lever flags had been — the option reaches the API and dies there.

---

## Gates at time of writing

- `scripts/visual-regression.cjs` → **pass=9 fail=0**
- unit battery → **17/17 files exit 0**
- harness `baseline` row → byte-identical to HEAD (gradD 0.16, r 0.9029, ssim 0.6876)

## 7. The aspect-ratio chase — measured, and the answer is NO (2026-11-19, later)

With the bridge's geometry options finally forwarded (engine.generate() had been
dropping them on the floor — see §6), the teacher's 44:1 aspect ratio was swept.

`scripts/frog-fidelity-harness.mjs` now also reports `lenP50` / `widP50` /
`aspectP50` (p50 of the emitted S-strokes) and `mark` (a stroke-language match
vs the source, computed with the repo's own `analyzeReference` +
`refPacketDistance`).

Baseline (modular, `graphic`, 400 strokes):

| config | lenP50 | aspect | r | ssim | mark |
|---|---|---|---|---|---|
| legacy Painter | 95.9 | 18.8 | 0.9646 | 0.7439 | 0.8773 |
| modular base | 15.5 | 3.4 | 0.9215 | 0.6994 | 0.8990 |
| el 3.0 | 45.8 | 10.3 | 0.8344 | 0.5884 | 0.8887 |
| el 6.0 | 91.1 | 20.5 | 0.6962 | 0.4550 | 0.8769 |
| el 3.0 / ws 0.15 | 36.3 | 31.9 | 0.7113 | 0.4537 | **0.9335** |
| el 6.0 / ws 0.2 / bs 16 | 59.0 | 47.9 | 0.7790 | 0.3822 | 0.8987 |
| el 3.0 / align 1.0 | 45.8 | 10.3 | 0.8401 | 0.5890 | 0.8731 |

**Conclusion: elongating the bridge's dabs CANNOT improve fidelity.** Even a
configuration that matches the teacher's aspect (el6/ws0.2/bs16 → aspect 47.9)
scores r 0.7790 against the base's 0.9215.

The reason is structural: the bridge's dabs are placed by a **residual-error
schedule** (highest-error pixel first), not along image contours. Lengthening a
dab that sits in the wrong place only spreads the wrong colour further.
`strokeStructureAlign` (which snaps a dab toward the local structure tangent)
does not rescue it either — el3+align1.0 is still r 0.8401.

Note the split in the metrics: long strokes raise the **mark** match (0.9335 at
aspect 31.9) while lowering **r** (0.7113). Mark quality and pixel fidelity
disagree here, which is exactly why the teacher's own approach is NOT "make the
dabs longer" — the teacher's 156 structure strokes come from a *different
placement* (contour-following curves), not from longer residual dabs.

**So the 44:1 gap is a PLACEMENT gap, not a geometry gap.** The right lever is
contour-following stroke emission (the teacher's `polyPts` multi-point curves),
not `strokeElongation`. That is the next Track-S item, and it is NOT solvable by
tuning `BRIDGE_DEFAULTS`.

## 8. Saliency's damage is the SUBJECT MASK, not the focus map

Isolated by setting `saliencyStrength: 0` (which zeroes the focus map's
contribution) and varying only the subject bonus:

| config (style `graphic`) | inkPct | r | ssim | mark |
|---|---|---|---|---|
| no saliency | 42.93 | 0.9215 | 0.6994 | 0.8990 |
| saliency, strength 0 | 41.68 | 0.8680 | 0.6361 | 0.8898 |
| saliency, strength 0, subject bonus 1.0 | 42.93 | **0.9215** | 0.6994 | **0.8990** |

The third row is **byte-identical to no-saliency** (r 0.9215, inkPct 42.93,
mark 0.8990). So the subject mask is a real contributor.

**But it is not the WHOLE story — the focus map hurts too, and the two
contributions are separable.** Sweeping `saliencyStrength` with the subject
bonus neutralised (`saliencySubjectBonus: 1.0`):

| config (style `graphic`) | inkPct | r | Δr | ssim | mark |
|---|---|---|---|---|---|
| no saliency | 42.93 | 0.9215 | — | 0.6994 | 0.8990 |
| focus only, s 0.0 | 42.93 | 0.9215 | 0.0000 | 0.6994 | 0.8990 |
| focus only, s 0.1 | 43.30 | 0.9172 | −0.0043 | 0.6938 | 0.8911 |
| focus only, s 0.25 | 42.25 | 0.9014 | −0.0201 | 0.6734 | **0.9042** |
| focus only, s 0.5 | 43.37 | 0.8673 | −0.0542 | 0.6188 | 0.8680 |
| focus only, s 0.75 | 43.59 | 0.8850 | −0.0365 | 0.6573 | 0.8957 |
| focus only, s 1.0 | 42.56 | 0.8627 | −0.0588 | 0.6230 | 0.8616 |
| s 1.0, subject bonus 1.15 | 42.56 | 0.8627 | −0.0588 | 0.6230 | 0.8616 |

Read:
- `s 0.0` is byte-identical to no-saliency → the wiring is correct and the
  blend is well-behaved at zero.
- The **focus map alone** costs r monotonically-ish as strength rises
  (−0.004 at s 0.1 → −0.059 at s 1.0). So the focus map is ALSO harmful to
  pixel fidelity.
- **The subject bonus adds nothing on top of a strong focus map** (s 1.0 with
  bonus 1.15 and with bonus 1.0 are IDENTICAL: r 0.8627, mark 0.8616) — at
  full strength the focus map already dominates the anchor choice, so the
  mask is redundant *there*.
- Where the subject mask DOES bite is at LOW strength: at s 0 the focus map is
  off entirely and the bonus alone costs r −0.0535 (r 0.8680 vs 0.9215).

**The interesting result is the mark/fidelity split.** At `s 0.25` the mark
match is **0.9042 — the highest value in the whole sweep** (no-saliency is
0.8990) while r is −0.0201. Saliency-weighted placement makes the painting
read more like a *stroke drawing* and less like a *pixel copy of the source*.
That is exactly the intent of the lever (bias strokes toward salient regions)
and it is why `r`/`ssim` alone are the wrong gate for it: they measure
content reconstruction, which is the thing saliency deliberately trades away.

**Honest verdict: saliency is not a fidelity win and must not ship claiming to
be.** It is a *style* lever. Its usable setting on this fixture is
`s ≈ 0.1–0.25` (r cost −0.004…−0.020, mark gain +0.006 at s 0.25), and the
subject bonus should default to 1.0 (off) — the hard 0/1 gate is the more
destructive of the two mechanisms.

**Consequence for the deliverable:** saliency is excluded from the "all three"
render (it is the one lever that measurably and visibly damages the output),
and the subject bonus should default to 1.0 (i.e. OFF) with the focus map
doing the work. That is a candidate default change, reported here for BE's
decision — NOT applied by this commit.

## 9. The deliverable, re-rendered

`scripts/frog-levers-probe.cjs` now renders at the `graphic` style (the only
style in the TOP 5 of BOTH the fidelity list and the gradient-aware list):

| render | gradD | nonFlat | inkPct | r | ssim |
|---|---|---|---|---|---|
| baseline | 0.16 | 8.1 % | 42.93 | 0.921 | 0.699 |
| gradient | 80.03 | 98 % | 46.73 | 0.907 | 0.684 |
| all-three (grad + palette lock) | 84.06 | 98 % | 46.30 | 0.912 | 0.679 |

All three pixel digests differ. Vision-checked: all three are **recognisable
frogs** (green head, two eyes with pupils, yellow mouth, orange tongue, the
pale mint foot bottom-right, heavy dark outlines) — the earlier "blobs of
mess" render is gone.
