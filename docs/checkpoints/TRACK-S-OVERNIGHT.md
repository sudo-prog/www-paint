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
