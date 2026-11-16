# Checkpoint R4 — Outlines (feature parity, the optimiser half)

**Date:** 2026-11-17 · Agent: BE (ThinkPad) · **Status: DONE (opt-in, default off)** ·
Track **R4** (`docs/CLEANROOM.md`) · closes the Mac's **BE action item (a)**
(`docs/MAC-TASKS.md`, "Next for BE: consume `buildR4Plan()` from `optimizer.js`").

---

## 1. Goal

Track **R4** — *"Feature parity: outlines, region-fill, path/order modes,
per-style shaping — re-derived, not copied."* Region-fill (`docs/checkpoints/R4.md`)
and order (`OPTIMISER_DEFAULTS.r4`, `tests/r4-integration.test.js`) already landed.
This note lands the **outlines** half: the legacy painter's edge-following contour
lay-in, re-derived from the existing clean-room seam, as an **opt-in** optimiser pass.

## 2. Design — `optimizer.js` outline pass

Reads the contour polylines from `js/engine/r4.js` `planOutlines()` (the structure-tensor
walk already proven by `tests/r4.test.js`), then samples them into small dabs of the
**local** colour — establishing the contours **before** (`first`) or **after** (`last`)
the masses. New options (all in `OPTIMISER_DEFAULTS`):

- `r4Outline` — `null` (default) / `'off'` → **no pass runs, output byte-identical**;
  `'first'` | `'last'` to enable. Accepts a bare mode string, `{ mode }`, or the whole
  `buildR4Plan()` plan object (`{ outline: { mode } }`).
- `r4OutlineShare` (`0.08`) — outline strokes as a fraction of `count`.
- `r4OutlineRadius` (`0.6`) — dab radius, as a fraction of the pass's base radius.
- `r4OutlineAlpha` (`0.9`) — dab opacity.
- `r4OutlineOptions` (`null`) — forwarded to `planOutlines()` (threshold, scale, …).

`resolveR4OutlineMode(v)` is **total** (anything unrecognised → `'off'`), so a stale or
future value is a safe no-op, never a silent lay-in. The budget is carved out of `count`
(so the stroke total stays **exact**), the sample is spread by a stride over the
**concatenated** walk (not clustered on the first contour), and the pass uses **no RNG** —
it is deterministic.

**Why the primitives, not `buildR4Plan()` wholesale.** The optimiser has no shape set at
outline time (outlines run before the schedule) and computes **order** over the shapes it
emits, at the tail. So it calls the two primitives `r4.js` exposes (`planOutlines` head,
`planOrder` tail). Both seams accept the `buildR4Plan()` plan object, so a caller holding
one can pass it straight through; the decomposition just matches where each half belongs.
`docs/API.md` §3.12 / §4 updated accordingly.

## 3. Evidence

```
$ node tests/engine.test.js
Passed: 170   Failed: 0        # was 165; +5 outline tests

$ node scripts/parity-bench.cjs      # modular engine, default options
blobs 98.08/0.8902/4.91 · rings 98.01/0.8522/5.06 ·
smooth 98.88/0.9336/2.86 · noise 80.88/0.0257/48.75
      -> BYTE-IDENTICAL to the committed baseline (default off, nothing moves)

$ node scripts/visual-regression.cjs
pass=9 fail=0 error=0        # the 9 pinned baselines are UNMOVED
```

New tests (`tests/engine.test.js`): default off emits **no** outline strokes and matches an
explicit `'off'` byte-for-byte; `'first'` lays contour strokes, keeps the exact stroke
budget, is deterministic, and reports `outlineMode`; `'last'` spends the reserved budget at
the end and **differs from** `'first'`; `resolveR4OutlineMode` accepts string / `{mode}` /
plan object / unknown; a flat field has no contours to walk (checked directly on
`planOutlines`) so the pass adds nothing.

**Full battery green** (16 suites): engine 170, bake 6, export-panel 90, masks 19,
modular-bridge 22, order 24, outlines 16, primitive-mixer 20, r4-integration 7, r4 43,
ref-analyze 29, shaping 18, style-accuracy 9, style-library 62, style-polish 11, wetsim 15
— all Failed 0.

### HONEST HEADLINE — the outline pass is NOT a fidelity win

Measured on the **parity-bench targets** (rasterised export, SIZE 256, seed 12345,
400 strokes, same generators as `scripts/parity-bench.cjs`); `off` vs `first` vs `last`
(32 outline strokes = 8 % of the budget):

```
image   mode   simMae    ssim      ΔsimMae   Δssim
blobs   off    98.081    0.8923      —         —
blobs   first  97.836    0.8836    -0.245    -0.0087
blobs   last   97.622    0.8517    -0.459    -0.0406
rings   off    98.030    0.8574      —         —
rings   first  97.875    0.8304    -0.155    -0.0270
rings   last   97.792    0.8169    -0.238    -0.0405
smooth  off    98.865    0.9305      —         —
smooth  first  98.698    0.9230    -0.167    -0.0075
smooth  last   98.859    0.9315    -0.006    +0.0010
noise   off    80.884    0.0257      —         —
noise   first  80.873    0.0247    -0.011    -0.0010
noise   last   80.871    0.0244    -0.013    -0.0013
```

**The contour lay-in COSTS fidelity on every target** (−0.006 … −0.459 simMae; SSIM
down on all but `smooth/last`). That is expected: it is a **constraint** — it forces ~8 %
of the budget onto edge dabs the residual schedule would have placed better. The legacy
outline step exists for a *perceptual / structural* intent that pixel MAE and block SSIM
do not measure; the pass therefore ships **opt-in and default-off**, and **no gain is
claimed.** Tuning it needs a structural/perceptual target (not MAE), which is an open
sub-item — see §5.

## 4. Files

- `js/engine/optimizer.js` — `outlinePass()`, `resolveR4OutlineMode()`, the 5 `r4Outline*`
  options, the `first`/`last` wiring + `stats.outline` / `stats.outlineMode`
- `tests/engine.test.js` — 5 new outline tests (+ a direct `planOutlines` import)
- `docs/API.md` — §3.12 / §4 now say the outline half is wired (opt-in, default off)
- `docs/ROADMAP_STATUS.md` — the R4 row + header
- `docs/MAC-TASKS.md` — the BE review closing the two Mac action items
- `docs/checkpoints/R4-outline.md` — this note
- `docs/checkpoints/R4.md` — pointer to this note

## 5. Still open in R4

- **per-style shaping** — `js/styles/shaping.js` is applied by `modular-bridge.js`
  (`buildR4Plan`), **not** by the optimiser's own path; a shaping-aware optimiser pass is
  still todo.
- **the soft-edge finding** (Mac, `docs/checkpoints/R4-mac.md`): the structure-tensor walk
  traces hard ridges and **misses soft-edged subjects**. The relative-threshold fix was
  disproved (the analyser already normalises `edges` by the image max; lowering the cut
  **merges** contours). **BE ruling: accept for now — do NOT gate R4 closure on it.** A
  real fix is a coherence / multi-scale edge detector in `analyzer.js` (spine); it would
  move the pinned baselines and is not worth a churn for a pass that is default-off.
  Tracked as an open item, not a regression.
- **outline tuning** — no structural/perceptual fitness target yet (§3); `r4OutlineShare`
  / radius / alpha are un-tuned defaults.
