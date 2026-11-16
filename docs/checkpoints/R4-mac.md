# Checkpoint R4 (Mac half) — the feature-parity seam

**Date:** 2026-11-16 · Agent: Mac / AIR HERMES · Stream **Track R4, Mac half**
**Goal:** land the adapter that puts the three inert Mac modules behind one
frozen, node-testable surface so the BE spine can consume them with ONE call.
**Status:** delivered; node-tested + browser-verified.

---

## 1. Why this stream exists

Track R is **4/7**: R0–R3 done, **R4 partial**, R5/R6 todo. R4's four items map
onto code that already existed but was **inert** — nothing outside its own test
file imported it:

| R4 item | Module | Before this stream |
|---|---|---|
| outlines | `js/engine/outlines.js` (M7) | 16/16 tests, **0 importers** |
| path/order modes | `js/engine/order.js` (M8) | 24/24 tests, **0 importers** |
| per-style shaping | `js/styles/shaping.js` (M9) | 18/18 tests, **0 importers** |
| region-fill | `optimizer.regionFillPass` (BE) | **landed**, opt-in, default off |

So R4 was blocked on an *adapter*, not on new algorithms. This note lands that
adapter. No BE-owned file is touched.

---

## 2. What landed

### 2.1 `js/engine/r4.js` (NEW) — the seam

One frozen surface over the three modules. Pure, dependency-free, node-testable.

- **Vocabulary** — `OUTLINE_MODES` (`off|first|last`), `ORDER_EXTENSIONS`
  (`top-bottom|edges-first|one-line`), `R4_ORDER_MODES` (11 native + 3
  extensions = 14). Cross-checks the source modules by importing them, so a
  rename fails a test rather than silently degrading.
- **Order** — `planOrder(shapes, mode, opts)` returns `{mode, native, centre,
  order, changed}`. `order[i]` is the ORIGINAL index of the shape that paints at
  position `i`. Extensions and unknown modes are reported `native:false` with
  input order rather than silently falling through.
- **Shaping** — `shapingForRegistry()`, `validateShaping()`,
  `resolveEffectiveShaping(style, override)`. Built by iterating the live
  registry, so a runtime-registered style is covered.
- **Outlines** — `planOutlines(analysis, opts)` → `{mode, count, skipped, budget,
  threshold, peak, outlines, points}`, largest-first, budget-capped.
- **`buildR4Plan(args)`** — the ONE call the spine should make. Pure, total,
  no key invented, every field data copied from the three modules or a
  documented default.

### 2.2 The three defects the tests caught (all fixed)

Each was caught by a test I wrote against the seam, not by inspection:

1. **`planOrder` read `order` back per input slot, which is the identity by
   construction.** `orderShapes` writes `order` as the shape's POSITION in the
   returned array, so slot `i` always reads `i` and every mode reported
   `changed: false`. The permutation is the **array order**; fixed by mapping
   each returned shape back to its index in the working copy. (`order.js` itself
   is correct — its own contract is position, and its 24 tests pin that.)
2. **`planOrder` mutated the caller's shapes.** `orderShapes` sets `order` on the
   objects it is handed, and its contract is "a new array of the SAME objects".
   A planner that forwards the caller's array therefore writes into caller state.
   Fixed by planning over a shallow copy: a rejected plan must not have already
   stamped `order`.
3. **`planOutlines` rejected every real analysis.** The guard was
   `Array.isArray(analysis.edges)`, but `analyzeImage` returns a **Float32Array**.
   Every real call returned an empty plan. Fixed to a length-based check.

A fourth, smaller one: `buildR4Plan` fed an already-R4 outline mode through the
legacy mapper, which only knows `first`/`edges` by coincidence — any future R4
mode would have been silently dropped to `off`. Fixed: an explicit R4 mode is
honoured first.

### 2.3 `js/engine/outlines.js` — one additive export

`percentilePeak(edges, p)` — a high percentile over **non-zero** magnitudes.
Additive only; `extractOutlines` and every existing default are untouched
(outlines 16/16 before and after, byte-identical output).

---

## 3. Evidence

```
$ node tests/r4.test.js      -> Passed 43  Failed 0     (NEW, 43 tests)
$ node tests/outlines.test.js -> Passed 16   Failed 0     (unmoved)
$ node tests/order.test.js    -> Passed 24   Failed 0     (unmoved)
$ node tests/shaping.test.js  -> Passed 18   Failed 0     (unmoved)
$ node tests/engine.test.js   -> Passed 164  Failed 0     (unmoved)
$ node scripts/r4-probe.cjs --width=1440   -> PASS
$ node scripts/r4-probe.cjs --width=390    -> PASS
```

Coverage in `tests/r4.test.js`: the frozen vocabulary and its partition; centre
resolution precedence; every order mode's direction; extensions reported
non-native; `free` a fixed point; no caller mutation; empty/non-array input;
registry-wide shaping validation (51 styles, all five fields well-formed);
override precedence; unknown-style fallback; override non-mutation; outline
hugging, budget capping, budget 0, flat field, determinism, missing analysis;
legacy→R4 mode mapping totality; `buildR4Plan` purity, totality, no-op safety,
argument non-mutation.

Probe (`scripts/r4-probe.cjs`) — real Chromium against a real `analyzeImage()`
result, at 1440×900 and 390×844: 6 (style, order, outline) plans; asserts the
registry count, `validateShaping().ok`, zero coverage gaps, 14 order modes,
budget honoured, `maxSize >= minSize`, `elongation >= 1`, `regionFill ∈ [0,1]`,
an active lay-in finds contours while `off` finds none, and **0 console errors**
(the `/favicon.ico` 404 is filtered by URL and recorded).

Raw probe line at 1440:
```
pencil/style/off      order=down   changed=true  outline=off   n=0  shaping=2-10/2.2/0.1
ink/up/first          order=up     changed=true  outline=first n=31 shaping=3-16/2.4/0.1
oil/spiral/first      order=spiral changed=true  outline=first n=31 shaping=5-24/1.5/0.3
cross-hatch/rings/off  order=rings  changed=true  outline=off   n=0  shaping=2-12/1.8/0.15
outline: mode first count 31 threshold 0.3 scale 1
```

Artefacts: `docs/research/r4-plan.json`, `r4-plan-390.json`,
`r4-outlines-1440.png`, `r4-outlines-390.png`.

---

## 4. ⚠ Recorded finding: the walk misses soft-edged subjects

Vision review of the probe overlay (`r4-outlines-1440.png`, three soft blobs + two
hard rings) is unambiguous: **the red contours trace the hard rings and do not
touch the soft blobs at all.** The walk is doing exactly what it was designed to
do — follow high-gradient ridges — and a soft subject has no ridge.

I tried to fix it and **the fix did not work.** Recorded rather than shipped:

- **Hypothesis:** the absolute `threshold` (0.3) is too high for soft edges.
- **Disproved.** `analyzeImage` normalises `edges` by the image's own maximum
  (`analyzer.js:94-99`), so the cut is **already relative** to the strongest edge
  present. Lowering it did not add soft contours — it **merged** existing ones
  into fewer, longer walks (measured 30 vs 31 on the probe source, 3 vs 4 on a
  hard+soft fixture).
- Three candidate scale statistics each failed on a different fixture:
  percentile peak (lands on the ramp mode: p50=p80=0.0377 vs a hard edge at 1.0),
  mean accepted strength (0.566 — far above the soft rim at 0.025), and p99/p50
  spread (a dimensionless ratio that still cut too far).
- **Conclusion:** no relative-threshold option ships. `percentilePeak` stays as a
  reported diagnostic — it is how the gap was measured. A real fix is a
  different mechanism (a coherence/structure-tensor gate, or a multi-scale edge
  detector), and it is BE spine work because `analyzer.js` is BE-owned.

This is raised for BE in `docs/MAC-TASKS.md`, not fixed here.

---

## 5. Scope — what this does NOT claim

- **No painting.** The adapter produces data (order, shaping, outline plan).
  Applying the plan to the optimiser is BE's spine work.
- **No BE-owned file touched.** `optimizer.js`, `generator.js`, `analyzer.js`,
  `engine.js`, `painter.js`, `scorer.js`, `renderer.js`, `relief.js`,
  `js/ui/{app,controls}.js`, `tests/engine.test.js` — none edited.
- **No re-baseline.** The 9 pinned visual baselines cannot move: no engine
  render path is touched, and the three source modules are still inert until BE
  wires them. `regionFill` stays default-off.
- **No fidelity claim.** Nothing here measures content or style match.

## 6. Files

- `js/engine/r4.js` (NEW) — the seam
- `js/engine/outlines.js` — additive `percentilePeak` export only
- `tests/r4.test.js` (NEW) — 43 tests
- `scripts/r4-probe.cjs` (NEW) — browser probe
- `docs/checkpoints/R4-mac.md` — this note
- `docs/research/r4-plan.json`, `r4-plan-390.json`, `r4-outlines-{1440,390}.png`
- `AGENTS.md` §7 — progress entry

## 7. Next

BE: consume `buildR4Plan()` from `optimizer.js` (opt-in, default off, prove
byte-identical), and decide on the soft-edge finding. Mac: Track-S M17 / the
standing QA seat.
