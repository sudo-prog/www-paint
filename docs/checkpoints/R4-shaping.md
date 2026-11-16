# Checkpoint R4 — Per-style shaping (feature parity, the optimiser half)

**Date:** 2026-11-17 · Agent: BE (ThinkPad) · **Status: DONE (opt-in, default off)** ·
Track **R4** (`docs/CLEANROOM.md`) · the **last** of R4's four items.

---

## 1. Goal

Track **R4** — *"Feature parity: outlines, region-fill, path/order modes,
per-style shaping — re-derived, not copied."* Region-fill (`docs/checkpoints/R4.md`),
order (`OPTIMISER_DEFAULTS.r4`), and outlines (`docs/checkpoints/R4-outline.md`)
were landed. The remaining item was **per-style shaping**: `js/styles/shaping.js`
existed with a 51-style table, but only `modular-bridge.js` (itself inert) applied
it — the **optimiser's own path** ignored it.

A style is not only a colour or a brush: it is a preferred **stroke size band**,
**aspect**, **lay-in order** and how much **flat region fill** it can carry
(`SHAPING_TABLE`). This note wires that table into the engine of record.

## 2. Design — `optimizer.js` `r4Shaping`

One new option, `OPTIMISER_DEFAULTS.r4Shaping = null`, read through the existing
`r4.js` seam (`resolveEffectiveShaping`). It accepts:

- a bare style name — `r4Shaping: 'watercolor'`;
- an object — `{ style, parts, shaping }`, where `parts` names any subset of
  `['size','elongation','order','fill']` and `shaping` is a per-call override;
- the whole `buildR4Plan()` plan object (it carries `style`, the resolved
  `shaping` and its `shapingSource`), so a caller holding a plan passes it straight
  through.

`resolveR4Shaping(v)` is **total** and returns the flat, fresh
`{ style, source, parts, minSize, maxSize, elongation, order, regionFill }`.
Anything unreadable — a non-string/non-object, an empty or unknown `parts` list, or
a **style name that is not in the shaping table** — resolves to `null`, i.e. a
complete no-op. (A mistyped style name must not silently restyle a run with the
table's fallback entry.) A plan that reports `shapingSource: 'table'` is not
re-reported as a caller override.

`applyR4Shaping(opts, raw)` maps the parts onto the options the passes already
read, and is the **only** change to the `optimise()` entry point:

| part | option | mapping |
|---|---|---|
| `size` | `minSize` / `maxSize` | the style's stroke-size band (`max(opts.minSize, style.minSize)`, `min(opts.maxSize, style.maxSize)`) |
| `elongation` | `elongation` | `style.elongation − 1`, so the aspect `1 + elongation·elongMul·coherence` reaches the style's value at full coherence |
| `order` | `r4` | the style's preferred paint order (the existing order seam) |
| `fill` | `regionFill` | the flat-region share the style can carry (the existing region-fill pass) |

Precedence is the S4/S5 precedent: **an explicitly supplied option always wins**,
and `raw` (the caller's own object, before defaults are merged) is what tells an
explicit value from a defaulted one — that is why the applier takes two arguments.
With `r4Shaping` unset (or unresolvable) it returns the **identical object**, so the
default path is byte-identical. `stats.shaping` / `stats.shapingParts` are reported
only when a style actually retuned the run.

No new pass, no extra strokes: shaping **retunes** what the schedule emits, it does
not spend budget. It is deterministic (no RNG of its own).

## 3. Evidence

```
$ node tests/engine.test.js
Passed: 177   Failed: 0        # was 170; +7 shaping tests

$ node scripts/parity-bench.cjs        # modular engine, default options
blobs 98.08/0.8902 · rings 98.01/0.8522 · smooth 98.88/0.9336 · noise 80.88/0.0257
      -> BYTE-IDENTICAL to the committed baseline (only the run's `when` differed;
         docs/research/parity/baseline.json restored with `git checkout HEAD --`)

$ node scripts/visual-regression.cjs
pass=9 fail=0 error=0        # the 9 pinned baselines are UNMOVED
```

**Full battery green — 17 suites, all exit 0:** engine 177 · bake 6 · export-panel 90 ·
masks 19 · modular-bridge 22 · modular-switch 22 · order 24 · outlines 16 ·
primitive-mixer 20 · r4-integration 7 · r4 43 · ref-analyze 29 · shaping 18 ·
style-accuracy 9 · style-library 62 · style-polish 11 · wetsim 15.

New tests: default `null` is a no-op and byte-identical to an explicit `null`; a
flat field stays empty under shaping; a style retunes the run (order, fill, size
band) while keeping the exact budget and staying deterministic; the size band is
**really** enforced (`ry ≤ 2·maxSize` — the hard hill-climb bound — on a target
where the unshaped run breaks it); `parts[]` isolates each of the four (order-only
permutes the *same* shape set, size-only keeps the shape set and retunes geometry);
an explicit option wins over the style value and a fully overridden shaping is a
no-op; `resolveR4Shaping` accepts string / object / plan object / `parts` and is
`null` for everything else; `applyR4Shaping` is the identity when off and never
mutates its input.

### HONEST HEADLINE — per-style shaping is NOT a fidelity win

Measured on the **parity-bench targets** through the real harness page (the four
canvas generators verbatim) with the harness's own `drawModular` + `metricsVsSource`,
256², seed 12345, 400 strokes. The `off` row **reproduces the committed baseline
exactly** (98.076/0.8902 · 98.014/0.8522 · 98.879/0.9336 · 80.883/0.0257), so the
sweep is measuring the same thing the bench measures.

Part isolation, `pencil` (ΔsimMae vs `off`):

```
target   off      elong    size     fill     order    full
blobs    98.076   98.076   96.411   97.870   95.398   96.517
rings    98.014   98.014   97.975   97.951   96.392   97.104
smooth   98.879   98.879   98.837   98.824   97.596   98.427
noise    80.883   80.883   80.885   80.883   80.874   80.877
Δ blobs     —     0.000   -1.665   -0.206   -2.678   -1.559
Δ rings     —     0.000   -0.039   -0.063   -1.622   -0.910
Δ smooth    —     0.000   -0.042   -0.055   -1.283   -0.452
Δ noise     —     0.000   +0.002    0.000   -0.009   -0.006
```

- **`elongation` is an exact no-op for pencil** — and that is the *proof* the
  mapping is right: pencil's shaping aspect is 2.2 and the optimiser's own default
  `elongation` is already 1.2 = 2.2 − 1, so the option lands bit-for-bit on the
  value in use.
- **`order` is the most expensive part** (−1.28 … −2.68): it permutes the composite
  order *after* the optimiser chose its dabs against its own emission order, so the
  final canvas differs while the shape set does not (`order-only` keeps the same ids).
- **`size`** is the mildest on the structured targets and flat on `noise`;
  **`fill`** costs a little on every target that has regions to block in.

Full-style shaping, ΔsimMae (and it lowers SSIM in **27 of 28** style×image cells —
the single positive is on the deliberate unfittable `noise` control):

```
style        blobs     rings    smooth    noise
pencil      -1.559    -0.910    -0.452   -0.006
charcoal    -1.221    -2.023    -0.841   -0.008
ink         -2.787    -1.756    -0.663   -0.011
watercolor  -1.127    -2.006    -0.801   -0.008
oil         -1.229    -2.016    -1.074   -0.005
string      -1.079    -1.153    -0.275   +0.012
halftone    -1.136    -1.461    -0.615   -0.002
```

**The honest read.** Retuning the stroke language to the style's own preference
costs MAE/SSIM on every parity target — the same shape of result as the outline
pass (`docs/checkpoints/R4-outline.md`): it is a **constraint** that spends dabs on
the style's language rather than on the residual. So it ships **opt-in and
default-off**, with **no gain claimed**. What it buys is *feature parity* — the
optimiser can now be driven by the same per-style table the UI/bridge uses, and
each of the four parts is independently selectable (`parts`), so a caller can take
the cheap half (e.g. `size` only) without the expensive one.

Tuning it needs a **style/perceptual fitness target** (Track-S S10's style-match
objective is the natural candidate), not MAE — recorded as an open sub-item.

## 4. Files

- `js/engine/optimizer.js` — `r4Shaping` option, `SHAPING_PARTS`,
  `resolveR4Shaping()`, `applyR4Shaping()`, the `stats.shaping*` fields, and the
  one-line entry-point change
- `tests/engine.test.js` — 7 new shaping tests (170 → 177)
- `docs/API.md` — §3.12 / §4 (the shaping half is now wired into the optimiser too)
- `docs/CLEANROOM.md` — R4 row: 4 of 4
- `docs/ROADMAP_STATUS.md` — the R4 row + header
- `docs/MAC-TASKS.md` — the BE review closing R4
- `docs/checkpoints/R4.md` — §5 pointer
- `docs/checkpoints/R4-shaping.md` — this note

## 5. R4 status after this note

**R4 is complete (4 of 4)** — region-fill, path/order modes, outlines and per-style
shaping are each reachable from the engine of record, each **opt-in / default-off**,
each proven byte-identical when off:

| R4 item | option | evidence |
|---|---|---|
| region-fill | `regionFill` (> 0) | `docs/checkpoints/R4.md` (small non-negative gain) |
| path/order modes | `r4` | `tests/r4-integration.test.js` |
| outlines | `r4Outline` (`first`/`last`) | `docs/checkpoints/R4-outline.md` (costs fidelity) |
| per-style shaping | `r4Shaping` (style / `{style,parts}` / plan) | this note (costs fidelity) |

Open, recorded, **not** gating R4:

- the **soft-edge finding** (the structure-tensor walk misses soft-edged subjects)
  — accepted for now; a real fix is a coherence/multi-scale detector in
  `analyzer.js`, and the outline pass is default-off (`R4-outline.md` §5).
- a **structural / style fitness target** for the two "constraint" items
  (outlines, shaping). Both currently lose on MAE by construction.

R5 (exceed) and R6 (retire the legacy painter) follow.
