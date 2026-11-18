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

### 3b. CORRECTED: the gradient is visible in ALL 51 styles

**This section originally claimed "25 of 48 styles ignore `color1`". That was
WRONG, and the way it was measured was wrong.** The original probe rendered a
fixed set of synthetic shapes and compared a *mean* channel difference, which
cannot distinguish "the style ignores color1" from "the style's own grain and
texture dominate the mean". It also inferred style behaviour from which
`shape.color0`/`shape.color1` properties a style file *reads* in source —
which is not how the renderer works.

**The authoritative test** renders the SAME frog fixture twice through the
REAL app path — once with `gradientLSQ` off, once on — and diffs the actual
rendered pixels, per style, at 256×192 / 200 strokes / seed 12345
(`scratch/frog-gradvis.cjs`). A style "honours the gradient" if > 0.05 % of
pixels change:

| | count |
|---|---|
| styles tested | **51** (0 errors) |
| **gradient VISIBLE** | **51** |
| gradient invisible | **0** |

> **FINAL, after the `confetti` crash fix (§12) and the `graffiti` black-stroke
> fix (§14).** The first run of this probe reported "50 tested, 1 error" and
> `graffiti` as the only invisible style. Both were BUGS, not properties:
> `confetti` crashed outright, and `graffiti` painted 1600 of its 1664 strokes
> black, so no gradient could show. After the fixes, `graffiti` reads
> **72.51 %** — the sixth-highest of all 51, just above `graphic` (72.40 %),
> and `confetti` reads 43.10 %.

Visible, by percentage of pixels changed:

| best | % | | worst visible | % |
|---|---|---|---|---|
| neon | 88.03 | | embroid | 27.38 |
| bokeh | 85.94 | | pastel | 37.43 |
| wash | 83.38 | | oil | 40.01 |
| sumi | 75.83 | | glitch | 45.09 |
| watercolor | 74.42 | | dots | 46.10 |
| **graphic** | **72.40** | | linocut | 52.74 |
| **graffiti** | **72.51** | | confetti | 43.10 |
| halftone | 68.55 | | string | 55.01 |
| pen | 66.26 | | … | … |
| thread | 59.86 | | tape | 61.30 |
| pencil | 56.04 | | marker | 63.63 |

So `pencil` DOES show the gradient (56 % of pixels change) despite reading
only `shape.color0` — the style's grain/hatch path still samples the stroke's
colour, and a gradient changes the *sampled* colour enough to alter the
render.

**What this changes:**

- The conclusion that drove the deliverable — "use `graphic`" — is **still
  right, but for a different reason**. `graphic` is not special for
  honouring the gradient; it is simply among the best on fidelity
  (r 0.9376 / ssim 0.7296 / mark 0.9179 with the measured geometry) and it
  shows a strong gradient (72.4 % of pixels).
- The "gradient is structurally invisible in most styles" framing was wrong
  and must not be repeated.
- **Lesson (generalisable):** never infer renderer behaviour from source-code
  property reads. Measure the RENDERED OUTPUT. The `meanDiff` metric and the
  "reads `color0` only" heuristic both produced a confident, specific, and
  wrong number.

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

## 10. We UNDER-cover the source — and that is a cheap, large win

The RefPacket breakdown (`refPacketDistance` parts) showed the dominant mark
loss is the `scale` term, and the reason is visible in the raw stats:

| | meanStrokeScale | meanDensity | meanCoherence | meanLuma |
|---|---|---|---|---|
| SOURCE | 0.6847 | **0.2398** | 0.4150 | 0.7661 |
| graphic (default) | 0.7491 | 0.1956 | 0.4045 | 0.7830 |
| thread (default) | 0.7605 | 0.1884 | 0.4326 | 0.8070 |
| flat (default) | 0.7508 | 0.1996 | 0.4076 | 0.8006 |

Every render paints **~20 % less ink than the source** (meanDensity 0.188–0.200
vs 0.2398). The two knobs that add coverage — `strokeWidthScale` and
`strokeAlpha` — were among the options that `engine.generate()` never
forwarded (§6), so this was untunable until §6 was fixed.

Sweeping them on the `graphic` style (400 strokes, seed 12345):

| config | inkErr | lumErr | r | mad | ssim | mark |
|---|---|---|---|---|---|---|
| default (ws 0.55, sa 0.8) | −2.97 | 4.26 | 0.9215 | 15.84 | 0.6994 | 0.8990 |
| ws 0.55, sa 0.9 | −3.86 | 2.68 | 0.9240 | 14.98 | 0.7102 | 0.9163 |
| **ws 0.70, sa 0.90** | −1.73 | **0.15** | **0.9376** | **13.59** | **0.7296** | **0.9179** |
| ws 0.70, sa 0.80 | −0.52 | 1.04 | 0.9375 | 14.14 | 0.7191 | 0.9059 |
| ws 0.85, sa 0.80 | +0.52 | −0.49 | 0.9305 | 14.93 | 0.7181 | 0.8793 |
| ws 0.70, bs 12, sa 0.90 | −2.17 | 1.77 | 0.9258 | 14.96 | 0.6948 | 0.9223 |

**`strokeWidthScale 0.7` + `strokeAlpha 0.9` improves EVERY metric at once**
(r +0.0161, mad −2.25, ssim +0.0302, mark +0.0189, lumErr 4.26 → 0.15) — the
only configuration in the sweep that does not trade one metric for another.
Raising the budget above 8 hurts (more strokes crowd the same regions).

Per style, with that geometry:

| style | r | mad | ssim | mark |
|---|---|---|---|---|
| **thread** | **0.9524** | **12.85** | 0.7289 | 0.9061 |
| flat | 0.9404 | 13.54 | 0.7021 | 0.9174 |
| tape | 0.9417 | 12.98 | 0.7229 | 0.9151 |
| graphic | 0.9376 | 13.59 | **0.7296** | **0.9179** |

`thread` reaches r 0.9524 against the legacy yardstick's 0.9646 — closing
most of the remaining gap.

### 10a. Why the defaults were NOT changed

Changing `BRIDGE_DEFAULTS` moves **all 9** pinned visual baselines (measured:
pass 0 / fail 9 in a pristine `git archive HEAD` tree with only the two values
changed). Re-baselining the pins is a deliberate act, not a side effect of an
algorithm change, and it needs sign-off. The parity bench is unaffected
(identical numbers — it does not use the bridge defaults).

So the measured geometry is passed **explicitly** by the deliverable probe
(`scripts/frog-levers-probe.html`), which leaves the defaults and the pins
untouched, and the default change is RECORDED HERE for BE's decision.

### 10b. A latent Playwright bug found on the way

`scripts/frog-levers-probe.cjs` waited with
`page.waitForFunction(fn, { timeout: 600000 })`. Playwright's signature is
`waitForFunction(pageFunction, arg, options)` — the object lands in the **arg**
slot, so the 30 s DEFAULT timeout applies and the wait fails on a slow
render. It only ever worked because the render happened to be fast enough;
the slower (better) geometry made it fail. Fixed to the 3-arg form, the same
one `scripts/ab-palette.cjs` already uses.

## 11. Which bridge defaults are still MEASURED against the current pipeline?

The bridge defaults carry their own measurement notes. Re-running the sweeps
against the CURRENT pipeline (post gradient-preservation, post option
forwarding) checks whether those notes still hold:

| default | note says | re-measured now | still valid? |
|---|---|---|---|
| `strokeBudgetScale: 8` | peaks at 8× | bs4 r 0.8981 · bs6 0.8789 · **bs8 0.9376** · bs10 0.9355 · bs12 0.9258 | **YES** — 8 is still the knee |
| `strokeWidthScale: 0.55` | "0.55 with a doubled count is the best combination (inkErr +2.46…)" | ws 0.7 / sa 0.9 gives r 0.9376, inkErr −1.73, lumErr 0.15 — vs the default's r 0.9215, inkErr −2.97, lumErr 4.26 | **NO** — see §10 |
| `strokeAlpha: 0.8` | "every stroke paints at alpha 0.8 (Code Paint teacher value)" | alpha 0.9 improves r +0.016, ssim +0.030, lumErr 4.26 → 0.15 | **NO** — see §10 |

So two of the three geometry defaults were measured against a pipeline that
has since changed materially (the gradient-preservation fix changed how every
stroke's colours are quantised, and the option-forwarding fix made these
knobs reachable at all). `strokeBudgetScale: 8` survives re-measurement.

**This is the general lesson of the night:** a measurement note attached to a
default is only as good as the pipeline it was measured on. When the pipeline
changes materially, the note has to be re-derived — and the note should say
WHICH pipeline version it was measured on.

### 11a. Why the defaults were still not changed

`BRIDGE_DEFAULTS` changes move all 9 pinned visual baselines (measured in a
pristine `git archive HEAD` tree: pass 0 / fail 9). Re-baselining the pins is
a deliberate act and needs sign-off, so:

- the measured geometry is passed EXPLICITLY by `scripts/frog-levers-probe.html`
  (the deliverable), and
- the default change is RECORDED here (§10a, §11) for BE's decision.

### 11b. The deliverable style, re-checked with the measured geometry

With ws 0.7 / sa 0.9, the three candidate styles across all three lever states:

| style | base r / ssim / mark | +gradient r | all-three r |
|---|---|---|---|
| **graphic** | 0.9376 / **0.7296** / **0.9179** | 0.9206 | **0.9245** |
| thread | **0.9524** / 0.7289 / 0.9061 | 0.9197 | 0.9248 |
| tape | 0.9417 / 0.7229 / 0.9151 | 0.9182 | 0.9179 |

`graphic` wins on ssim and mark across the board, and — importantly — the
**all-three** state IMPROVES on the gradient state (r 0.9206 → 0.9245), i.e.
the palette lock recovers some of the gradient's fidelity cost. `thread` has
the best base r but the worst gradient row (0.9197) and a much worse lumErr
(9.16 vs 2.72). `graphic` stays.

## 12. A latent render crash in `confetti` — found by the style sweep

The 51-style gradient-visibility probe (§3b) reported "styles tested: 50,
errors: 1". The error was not in the gradient logic — `confetti` failed to
render **at all**.

**Root cause** (`js/styles/confetti.js`, `_renderStroke`): the piece loop walks
the polyline with an index `j`, advances it inside the loop with
`while (j < n - 2 && cum[j] < target) j++;`, and then does an **unconditional
`j++` at the bottom of the iteration**. The inner `while` caps the advance,
but the trailing increment is not capped, so on a stroke long enough to lay
down more pieces than the polyline has points, `j` walks off the end and
`P[j]` is undefined:

```
const px = P[j - 1][0] + (P[j][0] - P[j - 1][0]) * f;
```

Measured on the frog fixture (real app path, style `confetti`):
`n = 31` points, `steps = 33` pieces, crash on iteration 28 with `j = 31`.

**Fix:** `if (j < n - 2) j++;` — the increment now stays inside the polyline.

**Why it survived the existing test suite:** `tests/style-polish.test.js`
already had a "no style throws on a degenerate shape" check that included
`confetti`, but every shape in it was SHORT (the longest was a 5-pixel
stroke), so `steps <= n` and the walk never reached the end. The bug needs
`steps > n`. The long shape that triggers it is now in that list.

**The fix is guarded by two new assertions** (both verified to FAIL with the
fix reverted, with the identical error message):

- `confetti stroke walk never indexes past the end of the polyline` — the
  index walk is replayed with `steps > n` and `j` is asserted in bounds on
  every iteration.
- `confetti renders a real engine stroke without throwing` — a live render of
  a real engine stroke shape.

**`confetti` is the ONLY style with this defect.** Every other style that
reads `P[j]` (`bokeh`, `charcoal`, `cross-hatch`, `dots`, `neon`, `oil`,
`pastel`, `pencil`, `stitch`, `watercolor`) has no trailing `j++`, and
`pastel` had its own equivalent clamp added earlier.

**Generalisation: the existing degenerate-shape test was not degenerate
enough.** "Degenerate" (zero-length, all-zero) is the opposite of the case
that broke here (a LONG stroke). A bounds bug needs both extremes in the
fixture set — and the test that proves it is the one that fails when the fix
is reverted, not the one that passes.

## 13. Convergence check — the subagent's saliency claim vs the fix

The aspect-ratio subagent (deleg_14c84307) reported: *"even
`saliencyWeighted: true` with `saliencyStrength: 0` changes output vs no
saliency — the subject-mask path is the damage, not the strength."*

That was TRUE on its tree, and its number reproduces exactly on the old
default:

| config | inkPct | r | ssim | mark |
|---|---|---|---|---|
| no saliency | 42.93 | 0.9215 | 0.6994 | 0.8990 |
| saliency, strength 0, **bonus 1.15** (old default) | 41.68 | 0.8680 | 0.6361 | 0.8898 |
| saliency, strength 0, **bonus 1.0** (current default) | 42.93 | **0.9215** | 0.6994 | **0.8990** |

The third row is byte-identical to no-saliency. So the subagent's
measurement was accurate and its conclusion ("the subject mask is the
damage") was right — but it was diagnosing a state that `1af0f43` has since
changed. With `saliencySubjectBonus` defaulting to 1.0, the subject mask is
off and strength 0 is a genuine no-op.

**Two independent measurements, one conclusion, arrived at from opposite
directions:** the subagent found the mask was the damage while the default
was 1.15; BE found it by separating the mask from the focus map with a
strength sweep. Both say the same thing, and the fix is the same.

`saliencyStrength 1` with the current default still costs fidelity
(r 0.9215 → 0.8627, mark 0.8990 → 0.8616) — that is the FOCUS MAP, which is
a separate mechanism (§8). The lever stays off by default.

## 14. `graffiti` painted 1600 of its 1664 strokes BLACK — silently

§3b's gradient-visibility probe listed exactly ONE style where the gradient
was invisible: `graffiti`. That was not a property of the style's design. It
was a bug, and it was **silent** — no exception, just black.

**Root cause.** `js/styles/graffiti.js` line 115 read the stroke colour from
the LEGACY param slot:

```js
let colour = a[shape.type === 'S' ? 8 : 6];
```

The engine's modular path emits 8-element stroke params
(`[x0,y0,cx,cy,x1,y1,width,angle]`) with the colours in `shape.color0` /
`shape.color1` / `shape.alpha`. The legacy 11-element format carried the
colours INSIDE params at index 8 (strokes) / 6 (areas).

Measured on the frog fixture, `graffiti` produces a **mix** of both formats:

| param length | count | legacy colour slot | what it paints |
|---|---|---|---|
| 11 (legacy) | 64 | `a[8]` = `[30,30,30]` | correct |
| **8 (modern)** | **1600** | `a[8]` = **undefined** | **`#000000`** |

So 96 % of the strokes painted pure black.

**Fix:** prefer `shape.color0` and fall back to the legacy slot, the same
order the working styles use (`pencil.js` L156 is
`shape.color0 || a[8] || [0,0,0]`). `graffiti` was the only style with no
such fallback — every other style that reads a param index also tries
`shape.color0` first.

**Measured effect** (256×192, 200 strokes, seed 12345):

| graffiti | pureBlack | nearBlack | coloured |
|---|---|---|---|
| before | **28,728** | 2,002 | 9,759 |
| after | **148** | 622 | **25,625** |

**99.5 % of the black pixels eliminated.**

**Guarded by a new assertion**, verified to FAIL with the fix reverted (it
paints `#000000` instead of `#1e3c5a`) and PASS with it in place. The first
version of that test asserted on a *reimplementation* of the colour logic
and passed even with the bug present — it had to be rewritten to assert the
colour the style **actually sets on the context** (`ctx.fillStyle`).

**This is the same defect class as `confetti` (§12), one level quieter:**
both are "the style assumes the legacy shape format". `confetti` threw; this
painted black. The general rule:

> Every style that reads a colour (or any field) out of `shape.params` by
> index must prefer the shape's top-level fields, because the modular path
> and the legacy path emit DIFFERENT param layouts for the same shape type.

**After the fix the gradient is visible in ALL 51 styles** — the final probe
run reports `styles tested: 51, errors: 0` and an EMPTY invisible list.
`graffiti` reads **72.51 %**, the sixth-highest of the 51, immediately above
`graphic` (72.40 %). It was never a design property.
