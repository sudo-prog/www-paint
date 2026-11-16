# Checkpoint R5/R6 (Mac half) — the modular bridge: making Track R reachable from the app

**Date:** 2026-11-16 · Agent: Mac / AIR HERMES · Stream **Track R5/R6, Mac half**
**Goal:** R6 — *"retire the legacy auto-painter; app + baselines run 100% on the
modular engine."* This note lands the **app-path adapter** that R6 needs, plus a
re-verification of the R4 seam. **No ThinkPad-owned file is touched.**

---

## 1. Why this stream exists

Track R is **4/7**: R0–R3 ✔, R4 partial, R5/R6 todo. But the honest reading of
the tree is different from the milestone list:

- **R5's headline items are already landed** — Style Profiles (S2–S4), wet media
  (Phase 3.3), smudge (Phase 1.5), primitives (S5), per-layer styles (2.2), AI
  loop (H1–H5). They are in `docs/ROADMAP_STATUS.md`.
- **The app cannot reach any of them.** `js/engine/engine.js#generate()` runs
  `js/engine/painter.js` (the legacy auto-painter). Measured on this tree:
  **`optimise()` has ZERO app-path callers** — only `score.js`, the parity
  harness, and probes. So the engine of record is not the engine the product
  ships.

R6 is therefore not "write more features"; it is **the switch**. And the switch
is blocked on a wiring point that lives in a ThinkPad-owned file.

`engine.js` is BE-owned (`HANDOFF.md` §6). So the Mac half is the adapter that
makes the switch a **two-line, zero-diff wiring point**.

---

## 2. Landed

### 2.1 `js/engine/modular-bridge.js` (NEW)

`buildModularPlan(analysis, args)` — pure, no DOM, no canvas, no argument
mutation. Returns `{used, reason, shapes, shaping, options, rawCount,
outlineCount}`.

- **`enabled` defaults to `false`** → returns `{used:false, reason:'disabled',
  shapes:[]}`. A caller can wire it into `engine.js#generate()` next to the
  existing `new Painter(...)` call and the app stays **byte-identical** until an
  opt-in flips it. That is the project's standing rule for a new option
  (`HANDOFF.md` §2.5).
- Runs the **real** `optimizer.optimise` over the real `analyzeImage()` result.
- Converts the optimiser's raw shape records into the **same engine format
  `_convertShape` produces**, including the colour embedding the renderer and
  every style module read (`E/B/R`: index 5 → `c0`, then `c1`, `alpha`;
  `S/T`: append `c0`, `c1`, `alpha`). Without this a modular shape would be
  drawn with the wrong colour — silently.
- Applies the **R4 seam** (`r4.buildR4Plan`) for per-style shaping + an outline
  lay-in, and **Phase 2.2** per-layer styles (`layer-styles.applyLayerStyles`).
- `modularOptions()` emits **only** keys `resolveOptions` actually reads.

### 2.2 `tests/modular-bridge.test.js` (NEW) — 22/22

Uses the **real** `analyzeImage()` + **real** `optimise()`, not stubs.

### 2.3 `scripts/modular-bridge-probe.cjs` (NEW) — PASS at 1440 and 390

Real Chromium. Builds a deterministic source, runs the real `analyzeImage()`,
plans with 5 styles, then **pushes the planned shapes through the app's own
`PaintingEngine` + `Renderer` + registered style modules** and measures the
canvas. Includes a **negative control**: a disabled plan paints 0 px.

### 2.4 R4 seam re-verified + one real defect fixed

`js/engine/r4.js` `planOutlines()` defaulted an **unset** mode to `'first'`,
claiming a lay-in the caller never asked for. `buildR4Plan` always passes an
explicit mode, so it is inert there — but it is the wrong contract for a public
API and it is why the ThinkPad measured **37 passed / 1 FAILED** on
`tests/r4.test.js`. Fixed to `'off'`, and the test now pins **both** halves.

---

## 3. Evidence (raw)

```
$ node tests/modular-bridge.test.js   -> Passed 22  Failed 0     (NEW)
$ node tests/r4.test.js               -> Passed 43  Failed 0      (unmoved)
$ node tests/outlines.test.js         -> Passed 16  Failed 0      (unmoved)
$ node tests/order.test.js            -> Passed 24  Failed 0      (unmoved)
$ node tests/shaping.test.js          -> Passed 18  Failed 0      (unmoved)
$ node tests/engine.test.js           -> Passed 164 Failed 0      (unmoved)
$ node scripts/modular-bridge-probe.cjs --width=1440 -> PASS
$ node scripts/modular-bridge-probe.cjs --width=390  -> PASS
$ node scripts/visual-regression.cjs  -> pass=9 fail=0 error=0   (pins UNMOVED)
$ node scripts/rail-overlay-probe.cjs -> PASS — 0 of 9 sizes failed
$ node scripts/overlay-coverage-probe.cjs --widths=390,768,1440 -> 0 hitFail / 0 clip / 0 docOverflowX
```

Probe render, measured on the real canvas (200×200 source, 250-stroke budget):

| style | shapes | modular | outlines | painted px | unique colours |
|---|---|---|---|---|---|
| pencil | 261 | 250 | 11 | 18 955 | 32 |
| ink | 261 | 250 | 11 | 21 878 | 489 |
| watercolor | 261 | 250 | 11 | 20 610 | 173 |
| oil | 261 | 250 | 11 | — | — |
| cross-hatch | 261 | 250 | 11 | — | — |
| **disabled** | **0** | 0 | 0 | **0** | 0 |

**Vision review** of `docs/research/modular-bridge.png` (ink): the composition is
**recognisable** — the central dark ring reads as a dense ring of strokes, the
purple ring as beads, and the blue/terracotta/green blobs are built from
overlapping soft strokes. No blank canvas, no single-colour fill, no clipping.
The engine is pointillist by nature; that is a style property, not a defect.

---

## 4. Two defects my own tests caught in the bridge

1. **`maxShapes` is not the optimiser's budget key.** `optimise(an,
   {maxShapes:10})` returned **400** shapes. The key is `count`. Passing
   `maxShapes` would have silently painted the default budget. Pinned by a
   regression test that asserts `maxShapes` is ignored.
2. **`aliasStyle()` must not be applied to the shape's `style` field.**
   `aliasStyle('watercolor') → 'watercolour'`, and `watercolour` is **not** in
   the registry — the Renderer would fall back to the flat `drawShape` and paint
   every stroke in the generic renderer, silently losing the style. The engine
   registers aliases on its own renderer (`engine.js` `_registerAllStyles`), but
   the shape field must name a real style.

---

## 5. Scope — what this does NOT claim

- **No spine edit.** `optimizer.js`, `engine.js`, `analyzer.js`, `painter.js`,
  `generator.js`, `renderer.js`, `js/ui/*`, `tests/engine.test.js` — untouched.
- **No re-baseline.** The 9 pins cannot move: nothing in the render path
  changed, and the bridge is off by default.
- **No parity claim.** Whether the modular engine beats `painter.js` is
  `scripts/parity-bench.cjs`'s gate (BE-owned) and is a separate decision. The
  bridge makes the comparison *possible from the app*, not *won*.
- **R4 is still partial on the spine side** — region-fill, outlines, order and
  shaping are all now reachable, but only BE can wire the pass into the app.

---

## 6. Files

- `js/engine/modular-bridge.js` (NEW)
- `tests/modular-bridge.test.js` (NEW)
- `scripts/modular-bridge-probe.cjs` (NEW)
- `js/engine/r4.js` — `planOutlines` unset-mode default `'first'` → `'off'`
- `tests/r4.test.js` — the mode contract pinned both ways
- `docs/research/modular-bridge.json`, `modular-bridge.png`
- `docs/checkpoints/R5R6-mac.md` — this note

## 7. Next

**BE:** wire `buildModularPlan()` into `engine.js#generate()` (opt-in, default
off, prove byte-identical against the 9 pins), then run the parity bench on the
app path. **Mac:** standing M15 QA seat; the R4 spine decision is still open.
