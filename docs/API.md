# WWW_PAINT — Engine API

**Status:** 2026-11-16 · Mac (FE) · Track-S hygiene **H-S1**
**Scope:** the engine surface under `js/engine/` + `js/styles/`, plus the app
class. Every signature below was **read off the live module**, not inferred —
the export lists were dumped with `node --input-type=module` on the current
tree (see §6 for the command). Where a module is **inert** (shipped, tested, no
importer) that is stated explicitly, because "exported" and "wired" are
different claims.

**This file was 0 bytes from the initial commit (`069a777`) until 2026-11-16.**
`docs/checkpoints/P0.md` §6 flagged it as pre-existing drift; `docs/TRACK_S.md`
§4 carries it as hygiene item **H-S1**. Filling it is the whole of H-S1.

**Ownership:** `HANDOFF.md` §6 lists `docs/API.md` as ThinkPad-owned. It was
**empty**, so nothing could be clobbered — writing it is H-S1's deliverable.
**BE: if you want this file under your pen, take it; the content is facts, not
prose.**

---

## 1. The two "score" modules — read this first (H-S1)

The single most confusable thing in the engine is that **two different modules
both answer to "score"**. They are not variants of one idea; they operate at
different layers, are called from different places, and optimise different
objectives. Confusing them makes an agent measure the wrong thing.

| | **`js/engine/scorer.js`** | **`js/engine/score.js`** |
|---|---|---|
| **Question it answers** | *"Of these candidate strokes, which ones should survive?"* | *"How good is this **Style Profile** as a whole?"* |
| **Layer** | inside the **generator loop** — per-stroke candidate selection | above the engine — the harness's evaluation primitive |
| **Input** | one shape + an `AnalysisResult` (or a batch of candidates) | a **profile** + a source **image** (`{pixels,width,height}`) |
| **Output** | a number in `[0,1]` per shape, or a **selected subset** of shapes | a **metrics object** (`{mae, simMae, ssim, strokes, options, stats}`) — no shape selection |
| **Consumed by** | `js/engine/worker.js` (`selectWithResidual` / `selectGreedyResidual` / `selectBest`) and `tests/engine.test.js` | `js/engine/propose.js`, `js/engine/vision-propose.js`, `tests/engine.test.js` |
| **Objective** | colour fidelity + edge alignment + residual coverage **of one stroke against the source** | **content reconstruction** (`MAE`/`simMae`/`SSIM`) — and, via `scoreProfileStyle`, **style match to a reference** |
| **Randomness** | none | none (determinism comes from the profile's `global.seed` / `options.seed`) |

**Rule of thumb:** if the caller is a *loop that is placing strokes*, it is
`scorer.js`. If the caller is an *evaluator or a search*, it is `score.js`.

**Related third concept — a render backend, not a score.** `js/engine/style-render.js`
(hygiene **H-S6**) is the *style-aware rasteriser* that `scoreProfileStyle` paints
through. It produces pixels, not a number, so it is neither of the above. It is
mentioned here only because H-S6's note (`docs/checkpoints/H-S6.md` §8) asked
`docs/API.md` to record that a third concept exists; it is documented in
**§3.5** below.

---

## 2. The two render paths — also easy to conflate

There are **two** ways this project paints, and they are not interchangeable:

| | **App path** | **Modular / clean-room path** |
|---|---|---|
| **Entry** | `PaintingEngine.generate()` → `painter.js` | `optimizer.optimise(analysis, opts)` |
| **Engine of record?** | legacy auto-painter — **reference-only** | **yes** (`docs/CLEANROOM.md`, decision 2026-11-10) |
| **Used by the UI** | **yes** (`app.js`, `useWorker:true`) | **no** — not reachable from the app until **R6** wires the bridge |
| **Reachable from the app today** | yes | **no** — the adapter `js/engine/modular-bridge.js` is landed and inert by design (`enabled` defaults `false`) |

This is why `scorer.js`'s consumer is `worker.js` (the app path) while
`score.js`'s consumers are the harness (the modular path). **Before optimising
anything, state which path you measured.** See `docs/CLEANROOM.md` and
`docs/checkpoints/R5R6-mac.md`.

---

## 3. Module reference

Exports are listed as `name` — kind, where kind is `fn` (function), `class`,
`obj` (frozen object/constant), or `arr`.

### 3.1 `js/engine/engine.js` — the app orchestrator

`PaintingEngine` (`class`) — UI-agnostic; needs a canvas or context. Manages
layers, image state, generation, rendering and export. `DEFAULT_SETTINGS` (`obj`).

Generation and image:

- `loadImage(source)` / `loadImageFile(file)` — `async fn`
- `generate(opts)` — `async fn`; the app's stroke-generation entry point
- `_generateViaWorker({...})` — the worker mirror (`useWorker:true` in `app.js`)
- `_convertShape(ps, order, layerIdx)` — Painter shape → engine shape (the format
  `docs/STROKE_FORMAT.md` describes)
- `getAnalysis()` — the last `AnalysisResult` (the R5/R6 bridge consumes it)
- `getImageDataURL()` · `getSimilarity()` · `getTotalStrokes()` · `getStyleList()` · `getStyleInfo()`

Rendering and export:

- `render(opts)` · `stop()` · `setSize(w,h)` · `destroy()`
- `exportPNG` / `exportJPG` / `exportAllLayersAsPNG` — `async fn`
- `exportHTML` / `exportSVG` / `exportProject` / `importProject`

Layers:

- `addLayer` · `removeLayer` · `moveLayer` · `duplicateLayer` · `clearStrokes`
- `getLayer` · `getActiveLayer` · `setLayerStyle`

Settings (each a one-line setter):

- `setSettings` · `setSmart` · `setOrder` · `setWetMedia` · `setSmudge`

### 3.2 `js/engine/scorer.js` — candidate scoring + selection (app path)

- `ResidualMap` (`class`) — per-pixel error/coverage map. `initialise(pixels,w,h)`
  seeds it from the source; `applyStroke(x0,y0,x1,y1,coverage,falloff)` subtracts a
  placed stroke; readers are `sampleError` / `sampleCoverage` / `averageError` /
  `averageCoverage`; `reset()`.
- `scoreShape(shape, analysis, opts)` → `number` in `[0,1]`. Weights:
  `colorWeight` 0.5 · `edgeWeight` 0.3 · `coverageWeight` 0.2 · `edgeBonus` 1.5 ·
  `residualWeight` 0.4.
- `selectBest(candidates, analysis, count, opts)` → scored subset, descending.
- `selectGreedyResidual(...)` — subtracts each pick's contribution from later
  candidates (`subtractive` 0.5).
- `selectWithResidual(...)` — true `ResidualMap` feedback (`residualWeight` 0.6,
  `minResidual` 0.02). **O(n × k)**; used by `worker.js`.
- `computeImportanceMap(pixels, w, h, blockSize=8)` → `Float32Array` per block.
- `sampleImportance(map, w, h, blockSize, x, y)` → `number`.

### 3.3 `js/engine/score.js` — the harness primitive (modular path)

- `KNOB_SET` (`arr`) — the **action space**: every tunable with `path`, `target`,
  `type`, range/enum, `default`, `group`. This is what `clampKnobs` bounds against.
- `getKnobDefaults()` · `clampKnobs(vals, extraKnobs)` · `profileToOptimiserOptions(profile, overrides)`
- `scoreProfile(profile, image, options)` → `{mae, simMae, ssim, strokes, options, stats}`
- `scoreProfileLayers(profile, image, options)` → `{composite, overall, layers, coverage, strokes, ...}`
  — per-tonal-band scoring using `masks.js`.
- `scoreProfileStyle(profile, image, reference, options)` → `{styleMatch, styleDistance, styleParts, reconstruction, composite, strokes, style, renderBackend, ...}`
  — **Track S S2/S3**. `reference` may be an image or a `RefPacket`. Renders
  through `style-render.js` (H-S6) and measures with `refPacketDistance`.
  `options.render` injects a backend; `options.style` overrides the profile style;
  `options.applyStyle === false` skips stamping.
- `STYLE_PROFILE_DEFAULTS` (`obj`, includes `styleWeight`) · `STYLE_MATCH_WEIGHTS`
  · `TONAL_BANDS` (`arr`: background, shadows, midtones, highlights)

### 3.4 `js/engine/metrics.js` — independent measurement

Pure, canvas-free. The independent rasteriser + the objective functions.

- `rasterizeShapes(shapes, w, h, background)` — **style-agnostic** flat-ellipse
  rasteriser (the H-S6 defect: it ignores `shape.style`).
- `toFloatRGB` · `toRGBA` · `averageColor` · `meanAbsError` · `simMae(mae)` · `ssimLuma(a,b,w,h)`
- `metricsVsTarget(rendered, targetPixels, w, h)` → `{mae, simMae, ssim}`
- `weightedSsimLuma(a,b,w,h,weight)` · `maskedMetrics` · `maskedMetricsVsTarget`
- **Track S:** `histogramDistance(a,b)` · `orientationMatch(aBins,bBins)` → 0..1
  (H-S5: normalised by kernel self-products, identity is exactly 1) ·
  `valueMapDistance(a,b)` · `refPacketDistance(a,b,weights)` → `{distance, parts, weights}` ·
  `refPacketMatch(a,b)` · `STYLE_MATCH_WEIGHTS` (`scale` .30 · `orientation` .25 ·
  `coverage` .20 · `bandScale` .15 · `coherence` .10)

### 3.5 `js/engine/style-render.js` — the third concept (H-S6)

The **style-aware** render backend. Produces pixels, not a score — the reason it
is neither `scorer.js` nor `score.js`.

- `isStyleRenderAvailable()` → `bool` (a canvas exists)
- `toStyledShape(shape, styleName)` / `stampShapeStyles(shapes, styleName)` — pure
  conversion + style stamping (no canvas).
- `createStyleRasteriser(opts)` → `(shapes, w, h, bg) => Float32Array` — renders
  through the **real style registry**; falls back to the plain rasteriser under
  `node`. `STYLE_RENDER_DEFAULTS` (`obj`).

### 3.6 `js/engine/optimizer.js` — the modular engine of record

- `OPTIMISER_DEFAULTS` (`obj`) — the full option table, **including the opt-in
  defaults**: `regionFill: 0`, `passes: null`, `primitives: null`, `r4: null`.
  Every one is documented in-file as byte-identical-until-opted-in.
- `optimise(analysis, options)` → `{shapes, stats}` — **the** generation call.
- `resolveOptions(o)` · `buildScalePlan(opts, baseR)` — the R2 coarse→fine schedule.
- `resolvePassPlan(opts, baseR)` — the **S4 seam**; returns `buildScalePlan`
  verbatim when `passes` is absent.
- `applyPrimitiveLanguage(plan, mix, baseR)` — S5 primitive retuning.
- `PASS_SCALES` (`arr`: coarse, medium, fine).

### 3.7 `js/engine/generator.js` — legacy candidate generation (app path)

- `DEFAULT_SETTINGS` (`obj`) · `resolveSettings(userSettings)`
- `generateCandidates(analysis, settings, seed, maxCandidates=5000)`
- `orderShapes(shapes, settings, analysis)` — **legacy** order modes
  (`free|top-bottom|spiral|one-line|edges-first`).
- `estimateShapeCount(width, height, style, opts)`

⚠ **Two `orderShapes` exist.** `generator.js`'s is the app-path one;
`js/engine/order.js` (M8) is the R4 clean-room module with **11** modes and
different `spiral` semantics. They are unreconciled — deliberate, tracked in
`AGENTS.md` §7 (M8 entry) and `docs/checkpoints/M8.md` §7. **Do not assume they
agree.**

### 3.8 `js/engine/analyzer.js` — image analysis

- `analyzeImage(pixels, width, height, options)` → `AnalysisResult`
  (`pixels`, `width`, `height`, `luminance`, `edges`, `palette`, …).
  ⚠ `edges` is a **`Float32Array`**, not an array — a real footgun (see `r4.js`,
  which had to stop checking `Array.isArray`).
- `computeStructureTensor(...)` · `sampleStructure(...)` · `structureDebugRGBA(...)`
- `sampleRegion` · `sampleEdge` · `sampleLuminance`

### 3.9 `js/engine/ref-analyze.js` — Track S S1/S3

- `analyzeReference(source, opts)` → **JSON-safe `RefPacket`** (adaptive grid,
  per-cell orientation/coherence/density/contrast/strokeScale, `scaleHistogram`,
  `strokeScaleByBand`, `orientationField`, `coverage`, `styleDNA`).
- `fuseReferences(refs, opts)` → `ref-fusion` packet with a **`spread`** confidence
  signal (H-S2's data source).
- `chooseGridSize(w,h,opts)` · `SCALE_BINS` (8) · `ORIENTATION_BINS` (12) ·
  `BAND_NAMES` · `REF_DEFAULTS` · `FUSION_DEFAULTS`

### 3.10 `js/engine/profile.js` — the Style Profile engine-side reader

Pure, no DOM. Frozen schema v1 (`PROFILE_SCHEMA_VERSION = 1`).

- `validateProfile(profile)` · `normalizeProfile(profile)` · `applyProfile(profile)`
- `profileToSettings` · `profileToLayerStyles` · `profileToLayerProps` · `profileToPasses`
- `profileFromSettings(settings, overrides)` — the inverse
- `profileGlobalPrimitiveMix` · `profileLayerPrimitiveMixes` · `profilePassPrimitiveMixes`
  · `profileToPrimitives` · `profileEffectiveStyle`
- `attachFusedReference(profile, fused)` → **new** profile carrying
  `provenance.refPacket` (S3) · `fusedReferenceFromProfile(profile)`
- Constants: `PROFILE_DEFAULTS` · `PROFILE_ROLES` · `PROFILE_PASS_SCALES` ·
  `PROFILE_PRIMITIVE_LEVELS`

### 3.11 `js/engine/primitives.js` — Track S S5 stroke language

- `PRIMITIVE_IDS` (`arr`: `dry-stamp`, `wet-wash`, `bristle`, `smudge`, `hatch`, `spatter`)
- `PRIMITIVES` (`obj`) · `LANGUAGE_FIELDS` (`radiusMul`, `blur`, `elongMul`, `alpha`, `detail`)
- `isKnownPrimitive(id)` · `resolvePrimitive(id)` · `primitiveMixEntries(mix)`
- `normalizePrimitiveMix` · `validatePrimitiveMix` · `resolvePrimitiveMix`
- `dominantPrimitive(mix)` · `effectiveStyle(mix, fallback)` · `mixStrokeLanguage(mix)`
- `mixMediaModel(mix, base)` · `mixMediaParams(mix, overrides)` · `primitiveStyleMix(mix)`
- `resolvePrimitiveLevels(levels)` · `PRIMITIVE_LEVELS` (`global`, `layer`, `pass`)

### 3.12 The R4 seam — `js/engine/r4.js` (Mac half; partially wired)

One frozen surface over three already-existing modules. **Import status is
mixed — read §4 before assuming it is inert:**

- `optimizer.js` imports `planOrder` and applies it to the emitted shapes when
  `opts.r4` is set. So **the order half is wired**, behind the opt-in `r4` default
  (`null`) — see `tests/r4-integration.test.js`.
- `optimizer.js` also imports `planOutlines` and lays the contour strokes in when
  `opts.r4Outline` is `'first' | 'last'` (**default `null`/`'off'` → no pass runs
  and the output is byte-identical**; `resolveR4OutlineMode` is total). So **the
  outline half is wired too**, behind its own opt-in default. Both seams accept
  the `buildR4Plan()` plan object (`{ order: { mode } }` / `{ outline: { mode } }`),
  so a caller holding a plan can pass it straight through — but the optimiser
  calls the *primitives* (`planOrder`, `planOutlines`), not `buildR4Plan()`
  wholesale: it has no shape set at outline time, and it computes order over the
  shapes it emits, at the tail.
- `modular-bridge.js:51` imports `buildR4Plan` + `resolveEffectiveShaping`.
- `scripts/r4-probe.cjs` imports the module directly (verification only).

**Net:** the *order*, *outline* and *shaping* halves are all reachable from the
engine of record; each sits behind an opt-in default that is **off**, so the app
path (`js/engine/app` painter + the default modular optimiser) is byte-identical.

- `buildR4Plan(args)` → the plan the BE spine should call.
- `planOrder(shapes, mode, opts)` — over a **copy** (a rejected plan must not
  stamp `order` onto the caller's shapes).
- `planOutlines(analysis, options)` · `outlineModeFromLegacy(legacy)` · `isOutlineActive(mode)`
- `resolveEffectiveShaping(styleName, override)` · `shapingForRegistry()` ·
  `validateShaping()` · `shapingCoverageGaps()`
- `resolveCentre(shapes, opts)`
- Constants: `OUTLINE_MODES` (`off`,`first`,`last`) · `R4_ORDER_MODES` ·
  `ORDER_MODES` (11) · `ORDER_EXTENSIONS` (`top-bottom`,`edges-first`,`one-line`) ·
  `SHAPING_FIELDS` · `isNativeOrderMode` · `isR4OrderMode` · `UNKNOWN_ORDER_FALLBACK`
  · re-exported `percentilePeak`

### 3.13 The R5/R6 bridge — `js/engine/modular-bridge.js` (inert by design)

- `buildModularPlan(analysis, args)` → `{used, reason?, shapes}`. **`enabled`
  defaults `false`** → `{used:false, reason:'disabled', shapes:[]}`, so the app
  is byte-identical until an opt-in flips it.
- `modularOptions({...})` · `toEngineShape(raw, order, layerIdx, seed)` · `BRIDGE_DEFAULTS`

### 3.14 Harness loop — `propose.js`, `gate.js`, `memory.js`

- **`propose.js`** — `searchProfile(baseProfile, image, options)` (`random` | `cma`),
  `SEARCH_DEFAULTS`, `searchableKnobs(fixed)`, `profileKnobValues(profile)`,
  `knobsToProfile` · `knobsToOptimiser` · `primitiveKnobs()` · `knobsToPrimitiveMix(knobs)`
- **`gate.js`** — `gateChange(baseline, candidate, opts)` · `evaluateSet(evalFn, images, opts)`
  · `gateVariants(baselineFn, candidateFn, images, opts)` · `GATE_DEFAULTS`
  (`objective`, `minGain`, `maxRegressions`, `regressionTolerance`, `approve`,
  `guards`). `guards` is the Track-S S2 hook: a style-match gain is rejected if
  fidelity drops.
- **`memory.js`** — `createMemory(opts)`, `averageHash(pixels,w,h)`, `hamming(a,b)`,
  `profileSignature(knobs)`, `MEMORY_VERSION`, `HASH_GRID` (8)

### 3.15 Support modules

- **`shapes.js`** — `SHAPE_TYPES` (`E`,`B`,`T`,`R`,`S`), `createShape`, `cloneShape`,
  `bounds`, `centroid`, `area`, `pointAt`, `pathLength`, `shapeAxis`, `gradientAt`,
  `drawShape(ctx, s, progress)`, `shapeToSVG`, `shapeToCode`, `packShape`/`unpackShape`,
  `isValidShape`, `getRuntimeSource`, `poly`, `axis`.
- **`masks.js`** — `computeTonalMasks(analysis, opts)` (partition of unity),
  `maskToRGBA`, `masksCompositeRGBA(masks, w, h, bands?)`.
- **`outlines.js`** — `extractOutlines(analysis, options)`, `percentilePeak(edges, pct)`,
  `OUTLINE_DEFAULTS`.
- **`order.js`** — `orderShapes(shapes, mode, opts)`, `ORDER_MODES` (11), `ORDER_DEFAULTS`.
- **`brush-media.js`** — `MEDIA_PARAMS`, `MEDIA_PRESETS`, `resolveMedia(preset, overrides)`,
  `toStampOptions(media, extra)`, `isKnownBrushName(name)`, `availableBrushNames()`.
- **`style-alias.js`** — `aliasStyle(name)`, `STYLE_ALIAS`.
- **`exporter.js`** — `exportImage(renderer, layers, opts)` (`async`), `exportAllLayersAsPNG`,
  `exportHTML`, `exportProject`, `importProject`, `exportSVG`, `packLayers`.
- **`renderer.js`** — `Renderer` (`class`; `setWetMedia`, `setSmudge`, `renderAll`,
  `renderLayer`, `drawShapeAt`, `exportImage`), `createRenderer(target, opts)`,
  `mediaModelToWetOpts(m, seed)`.
- **`worker.js`** — the worker mirror; imports `analyzer` + `generator` + `scorer`.
- **`painter.js`** — the legacy auto-painter (**reference-only**, `docs/CLEANROOM.md`).

### 3.16 `js/styles/`

- `index.js` — the registry: `getStyle(name)`, `getAllStyles()` (**51**),
  `getStylesByCategory(category)`, `getStyleInfo(name)`, `registerStyle(name, class, category, label)`,
  `CATEGORY_LABELS`.
- `base.js` — the style base class + `rngFor`/`createRNG` helpers. **All
  randomness in a style must come from here** (`AGENTS.md` §4).
- `shaping.js` — `SHAPING_TABLE` (51 styles), `resolveShaping(styleName)`,
  `SHAPING_DEFAULTS`, `STYLE_CATEGORIES`, `unshapedStyles()`.
- 51 style modules (`pencil`, `ink`, `watercolor`, `oil`, `charcoal`, `marker`,
  `cross-hatch`, `halftone`, `graphic`, `mosaic`, `graffiti`, …). The nine
  **hash-pinned baselines** are `pencil ink watercolor oil charcoal marker
  cross-hatch halftone graphic` at 256px / seed `3047602159` / 700 strokes.

### 3.17 `js/ui/` — the Mac-owned UI modules (DOM + their pure cores)

The engine half of the API is above; these are the modules an agent is most
likely to be asked to change. **Each panel is split into a pure core (node
-testable, no DOM) and a DOM manager**, the same shape as the media panel.

- **`style-library-core.js`** — the profile object + storage boundary. `ProfileLibrary`
  (`save`/`list`/`get`/`apply`/`delete`/`exportText`/`importText`/`clear`),
  `defaultProfile()`, `coerceProfileName(name)`, `newProfileId()`,
  `profileToExportText(p)` / `profileFromExportText(text, {validate})`,
  `summarizeProfile(p)`, `STORAGE_KEY`, `DEFAULT_SEED`, `MAX_NAME_LENGTH`.
  **Track-S H-S2:** `referenceConfidence(profile)`,
  `refConfidenceBand(agreement)`, `refConfidenceAdvice(band)`,
  `REF_CONFIDENCE_LABELS`, `REF_CONFIDENCE`.
- **`style-library.js`** — `StyleLibraryPanel` (`refresh()`, `setHost()`,
  `destroy()`); renders rows, dispatches `style-profile-apply`. Never imports
  `app.js`.
- **`style-library-host.js`** — the shim: owns the `#style-library-root`
  lifecycle, `getSnapshot()`, and `applyToEngine()`.
- **`primitive-mixer-core.js` / `primitive-mixer.js`** — the S5/M16 stroke-language
  mixer; `writeMixAtLevel(profile, context, mix)` / `PrimitiveMixerSection`.
- **`export-panel-core.js` / `export-panel.js` / `export-host.js`** — the Phase 6
  export & share panel (PNG/JPG × 3 sizes, quality, share text, profile JSON).
- **`media.js` / `media-host.js`** — the wet/tonal media panel.
- **`layers.js`** — the layer panel rows (rendered in **reverse** order, §8 of
  `docs/PANELS.md`).
- **`a11y-hardening.js`** — runtime a11y fixes (aria-labels, focus restore, focus
  traps). Additive; safe to fold into `app.js` when the shim pattern is retired.

> The engine-side API is authoritative here; the UI list above is the surface an
> agent is most likely to edit, and it is **Mac-owned** (`AGENTS.md` §1). The
> `js/engine/` sections above are the contract those modules call into.

---

## 4. Which modules are inert (shipped, tested, no importer)

Stated plainly so nobody mistakes "exists" for "runs":

| Module | Importers outside its own test | Status |
|---|---|---|
| `js/engine/r4.js` | `optimizer.js` (`planOrder`, `planOutlines`), `modular-bridge.js` (`buildR4Plan`) | **live (opt-in, default off)** — order behind `opts.r4`, outlines behind `opts.r4Outline`; byte-identical when both off |
| `js/engine/modular-bridge.js` | none | inert — `enabled` defaults `false` |
| `js/engine/outlines.js` | `r4.js`, `modular-bridge.js` (via `buildR4Plan`), `optimizer.js` (via `r4.js` `planOutlines`) | **live (opt-in, default off)** — the optimiser's `r4Outline` pass |
| `js/engine/order.js` | `r4.js`, `optimizer.js` (via `r4.js`) | **live behind `opts.r4`** |
| `js/styles/shaping.js` | `r4.js`, `modular-bridge.js` | **live** — shaping is applied by the bridge |
| `js/engine/primitives.js` | `profile.js`, `optimizer.js`, `propose.js` | **live** (opt-in) |
| `js/engine/style-render.js` | `score.js` | **live** (default backend of `scoreProfileStyle`) |

**Verify before repeating these claims.** They change when BE wires a stream:

```bash
cd /Users/AIR2K/Data/20_Projects/20.36_WWW_PAINT
grep -rn "engine/r4\.js\|engine/modular-bridge\.js\|styles/shaping\.js" js/ scripts/ \
  | grep -v "^js/engine/r4.js\|^js/engine/modular-bridge.js\|^js/styles/shaping.js"
```

---

## 5. Invariants an API caller must not break

1. **Determinism.** No bare `Math.random()`; use `rngFor`/`createRNG`
   (`js/styles/base.js`, `js/utils/rng.js`).
2. **Opt-in means byte-identical.** A new option defaults to *off*, and "off"
   must reproduce the previous output exactly. The R4/S4/S5 defaults
   (`r4:null`, `passes:null`, `primitives:null`, `regionFill:0`) are the pattern.
3. **Never mutate the caller's objects.** `normalizeProfile`,
   `attachFusedReference` and `planOrder` all return copies. A rejected plan must
   not have written into caller state.
4. **A profile with no reference must not be scored for style.**
   `scoreProfileStyle` throws without one — deliberately.
5. **The 9 baselines are pinned.** Re-baseline only for a verified, intended
   change, and say so (`AGENTS.md` §4).

---

## 6. Verification

The export lists in §3 were produced by importing every module on the current
tree and printing `Object.keys`:

```bash
cd /Users/AIR2K/Data/20_Projects/20.36_WWW_PAINT
node --input-type=module -e "
for (const m of ['scorer','score','metrics','ref-analyze','profile','primitives',
                 'r4','modular-bridge','style-render','brush-media','masks',
                 'outlines','order','gate','memory','propose','optimizer',
                 'analyzer','shapes','exporter','style-alias','engine']) {
  console.log(m, Object.keys(await import('./js/engine/'+m+'.js')).join(','));
}"
```

Raw output for this revision (also confirms the 51-style registry):

```
scorer   ResidualMap,computeImportanceMap,default,sampleImportance,scoreShape,
         selectBest,selectGreedyResidual,selectWithResidual
score    KNOB_SET,STYLE_PROFILE_DEFAULTS,TONAL_BANDS,clampKnobs,default,
         getKnobDefaults,profileToOptimiserOptions,scoreProfile,
         scoreProfileLayers,scoreProfileStyle
metrics  STYLE_MATCH_WEIGHTS,averageColor,default,histogramDistance,maskedMetrics,
         maskedMetricsVsTarget,meanAbsError,metricsVsTarget,orientationMatch,
         rasterizeShapes,refPacketDistance,refPacketMatch,simMae,ssimLuma,
         toFloatRGB,toRGBA,valueMapDistance,weightedSsimLuma
ref-analyze BAND_NAMES,FUSION_DEFAULTS,ORIENTATION_BINS,REF_DEFAULTS,SCALE_BINS,
         analyzeReference,chooseGridSize,default,fuseReferences
profile  PROFILE_DEFAULTS,PROFILE_PASS_SCALES,PROFILE_PRIMITIVE_LEVELS,PROFILE_ROLES,
         PROFILE_SCHEMA_VERSION,applyProfile,attachFusedReference,default,
         fusedReferenceFromProfile,normalizeProfile,profileEffectiveStyle,
         profileFromSettings,profileGlobalPrimitiveMix,profileLayerPrimitiveMixes,
         profilePassPrimitiveMixes,profileToLayerProps,profileToLayerStyles,
         profileToPasses,profileToPrimitives,profileToSettings,validateProfile
primitives LANGUAGE_FIELDS,PRIMITIVES,PRIMITIVE_IDS,PRIMITIVE_LEVELS,default,
         dominantPrimitive,effectiveStyle,isKnownPrimitive,mixMediaModel,
         mixMediaParams,mixStrokeLanguage,normalizePrimitiveMix,primitiveMixEntries,
         primitiveStyleMix,resolvePrimitive,resolvePrimitiveLevels,
         resolvePrimitiveMix,validatePrimitiveMix
r4       ORDER_DEFAULTS,ORDER_EXTENSIONS,ORDER_MODES,OUTLINE_DEFAULTS,OUTLINE_MODES,
         R4_ORDER_MODES,SHAPING_FIELDS,UNKNOWN_ORDER_FALLBACK,buildR4Plan,default,
         isNativeOrderMode,isOutlineActive,isR4OrderMode,outlineModeFromLegacy,
         percentilePeak,planOrder,planOutlines,resolveCentre,resolveEffectiveShaping,
         shapingCoverageGaps,shapingForRegistry,validateShaping
modular-bridge BRIDGE_DEFAULTS,buildModularPlan,default,modularOptions,toEngineShape
style-render STYLE_RENDER_DEFAULTS,createStyleRasteriser,default,
         isStyleRenderAvailable,stampShapeStyles,toStyledShape
brush-media MEDIA_PARAMS,MEDIA_PRESETS,availableBrushNames,default,isKnownBrushName,
         resolveMedia,toStampOptions
masks    computeTonalMasks,default,maskToRGBA,masksCompositeRGBA
outlines OUTLINE_DEFAULTS,default,extractOutlines,percentilePeak
order    ORDER_DEFAULTS,ORDER_MODES,default,orderShapes
gate     GATE_DEFAULTS,default,evaluateSet,gateChange,gateVariants
memory   HASH_GRID,MEMORY_VERSION,averageHash,createMemory,default,hamming,
         profileSignature
propose  SEARCH_DEFAULTS,default,knobsToOptimiser,knobsToPrimitiveMix,knobsToProfile,
         primitiveKnobs,profileKnobValues,searchProfile,searchableKnobs
optimizer OPTIMISER_DEFAULTS,PASS_SCALES,applyPrimitiveLanguage,buildScalePlan,
         default,optimise,resolveOptions,resolvePassPlan
analyzer analyzeImage,computeStructureTensor,default,sampleEdge,sampleLuminance,
         sampleRegion,sampleStructure,structureDebugRGBA
shapes   SHAPE_TYPES,VALID_TYPES,area,axis,bounds,centroid,cloneShape,createShape,
         default,drawShape,getRuntimeSource,gradientAt,isValidShape,packShape,
         pathLength,pointAt,poly,shapeAxis,shapeToCode,shapeToSVG,unpackShape
exporter default,exportAllLayersAsPNG,exportHTML,exportImage,exportProject,exportSVG,
         importProject,packLayers
style-alias STYLE_ALIAS,aliasStyle
engine   DEFAULT_SETTINGS,PaintingEngine,default
styles/index registry count 51
```

**Do not add an export to this file without running that first.** A stale API doc
is worse than a missing one: it is believed.
