# Checkpoint H-S1 — the two "score" modules, documented (Track S hygiene)

**Date:** 2026-11-16 · Agent: Mac / AIR HERMES · Hygiene item **H-S1**
**Files:** `docs/API.md` (0 → 24 890 B) · `AGENTS.md` §7
**Untouched:** every render path — hence the 9 pinned baselines are unmoved.

---

## 1. What H-S1 asked for

> `scorer.js` (candidate selection inside the generator) vs `score.js` (profile
> quality for the harness) are easy to confuse. → Document the split clearly in
> `docs/API.md`.

`docs/API.md` was **0 bytes from the initial commit (`069a777`) until this
stream**. `docs/checkpoints/P0.md` §6 had already flagged it as pre-existing
drift ("`docs/API.md` and `docs/STROKE_FORMAT.md` are 0-byte files"), and
`docs/TRACK_S.md` §4 carried it as H-S1. `docs/STROKE_FORMAT.md` was filled by
M14; `docs/API.md` was the last 0-byte file in the repo.

---

## 2. The split, in one table

| | **`js/engine/scorer.js`** | **`js/engine/score.js`** |
|---|---|---|
| Question | "Of these candidate strokes, which survive?" | "How good is this **Style Profile**?" |
| Layer | inside the **generator loop** | above the engine (harness primitive) |
| Input | one shape + `AnalysisResult` (or a batch) | a **profile** + an **image** |
| Output | a number `[0,1]` per shape, or a selected subset | a **metrics object** — no selection |
| Consumed by | `js/engine/worker.js`, `tests/engine.test.js` | `propose.js`, `vision-propose.js`, `tests/engine.test.js` |
| Objective | colour + edge + residual coverage **of one stroke** | **content reconstruction** (MAE/simMae/SSIM), and via `scoreProfileStyle` **style match** |

Rule of thumb now written into the doc: **a loop placing strokes → `scorer.js`;
an evaluator or a search → `score.js`.**

Two related confusions are documented alongside it, because they are the same
class of error:

- **The two render paths** (§2): the app runs `engine.generate()` → the legacy
  `painter.js`; the **engine of record** is the modular `optimizer.js`, which is
  **not reachable from the app** until R6 wires `modular-bridge.js`. That is
  *why* `scorer.js`'s consumer is `worker.js` and `score.js`'s consumers are the
  harness.
- **A third concept** (§3.5): `style-render.js` is a **render backend**, not a
  score — the thing H-S6 §8 asked be recorded. `docs/checkpoints/H-S6.md`:
  "`docs/API.md` (H-S1) should note the third render backend concept."

---

## 3. Method — every export list was dumped, not recalled

```
$ node --input-type=module -e "
for (const m of ['scorer','score','metrics','ref-analyze','profile','primitives',
                 'r4','modular-bridge','style-render','brush-media','masks',
                 'outlines','order','gate','memory','propose','optimizer',
                 'analyzer','shapes','exporter','style-alias','engine']) {
  console.log(m, Object.keys(await import('./js/engine/'+m+'.js')).join(','));
}"
```

22 modules, all importing clean; `js/styles/index.js` registry count **51**. The
raw output is quoted verbatim in `docs/API.md` §6 so BE can diff it, and the doc
ends with the rule: *do not add an export to this file without running that
first — a stale API doc is worse than a missing one, because it is believed.*

---

## 4. The dump corrected a false claim (worth recording)

My first draft said **`r4.js` is inert — BE must call `buildR4Plan()`**. The
import dump says otherwise:

```
js/engine/optimizer.js:68        import { planOrder } from './r4.js';
js/engine/optimizer.js:922-938   applies it behind the opt-in `r4` default (null)
js/engine/modular-bridge.js:51   import { buildR4Plan, resolveEffectiveShaping } from './r4.js';
js/engine/modular-bridge.js:228  buildR4Plan({ outline: 'first', ... })
```

So **the order and shaping halves are wired**; `planOutlines` is reached only
through the bridge (which is itself inert, `enabled` defaults `false`), and
`optimizer.js` does **not** lay in outlines. The doc's §4 states this and carries
the exact `grep` to re-run it, because that table goes stale the moment BE wires a
stream.

A second correction: `ResidualMap` has **no `apply()`** — it is
`applyStroke(x0,y0,x1,y1,coverage,falloff)` plus `sampleError` / `sampleCoverage`
/ `averageError` / `averageCoverage` / `reset`. Both were caught by reading the
live module, not by any test.

---

## 5. Scope — what this does NOT claim

- **No code changed.** `docs/API.md` is documentation only; no `.js`, `.css` or
  `index.html` file was touched, so the 9 pins cannot move.
- **No metric, no threshold, no default changed.**
- **`docs/API.md` is ThinkPad-owned** in `HANDOFF.md` §6. It was **empty**, so
  nothing was clobbered. Raised in `AGENTS.md` §7: *take it under your pen if you
  want it — the content is facts + a reproducible dump.*
- **Not documented here:** the two `orderShapes` implementations
  (`generator.js` legacy vs `order.js` R4) are flagged in §3.7 with a ⚠ rather
  than reconciled — that is B4's decision, not documentation's.

---

## 6. Verification

```
$ git show HEAD:docs/API.md | wc -c          -> 0
$ wc -c docs/API.md                          -> 24890
$ node --input-type=module -e "<dump>"        -> 22 modules, registry 51
$ grep -rn "engine/r4\.js|engine/modular-bridge\.js|styles/shaping\.js" js/ scripts/
    optimizer.js:68 · modular-bridge.js:51    -> the correction in §4
$ 14 suites, all Failed 0 (engine 164, export-panel 90, r4 43, ref-analyze 29,
    modular-bridge 22, style-library 50, primitive-mixer 20, style-polish 11,
    style-accuracy 9, wetsim 15, masks 19, outlines 16, order 24, shaping 18)
$ node scripts/visual-regression.cjs          -> pass=9 fail=0 error=0 (pins UNMOVED)
$ node scripts/a11y-sweep.cjs --widths=390,768,1440   -> all zeros
$ node scripts/overlay-coverage-probe.cjs     -> 18/18 surfaces ok
$ node scripts/rail-overlay-probe.cjs         -> PASS, 0 of 9 sizes failed
$ MAESTRO 10 flows at authored sizes          -> 301 COMPLETED / 0 FAILED
```

Nothing to gate: a doc cannot break a render. The suites above are the
**regression proof** that no code changed.

---

## 7. Hand-off

- **BE:** `docs/API.md` now exists and resolves the links from
  `ARCHITECTURE.md:58`, `docs/TRACK_S.md:47/173` and
  `docs/checkpoints/H-S6.md:137`. If you would rather own it, say so in
  `OPS_LOG`; otherwise the Mac will keep it current with the dump command.
- **Next:** H-S2 (the confidence/calibration UX) — the UI half is Mac-owned
  `js/ui/style-library*.js`. Done in the same session; see
  `docs/checkpoints/H-S2.md`.
