# Painterly Brush — New First-Class Brush Style

## What landed

The user approved `painterly` as a new first-class brush style after reviewing the comparison sheet (docs/research/OIL-ENGINE-OPTIONS-2026-11-24.md). This landing records the full scope of what was added:

**Files:**
- `js/vendor/painterly/painterly.esm.js` — MIT-licensed vendored build of https://github.com/davemaynard/painterly (c) 2026 Dave Maynard
- `js/vendor/painterly/LICENSE` — MIT, Copyright (c) 2026 Dave Maynard
- `js/vendor/painterly/NOTICE` — BSD-3-Clause notice for the **inlined** `mersenne-twister` (MT19937 reference implementation by Makoto Matsumoto and Takuji Nishimura, wrapped for JavaScript by Sean McCullough and Evgeny Filatov, (C) 1997-2002). painterly inlines that code into its bundle and strips its header, so BSD-3-Clause's binary-redistribution clause requires this file to ship — which it does.
- `js/styles/painterly.js` — Style module with `class PainterlyStyle`, name='painterly', category='paint'. Its `render()` method paints a multi-bristle fan brush (8 bristles, spread 0.9, ragged ends, per-bristle colour drift ±14) using the vendored `brushes.bristle` model: `{bristles:8, spread:0.9, weight:[0.12,0.38], alpha:0.55, drift:14, dots:false, ragged:0.25}`.
- `js/engine/painterly-planner.js` — NEW. Wraps painterly's own Hertzmann-1998 planner (`plan()` / `rasterFromImageData()` / `defaultRadii()`) and converts each painterly Stroke into a WWW_PAINT engine shape of the form `{ id, type:'S', params:[x0,y0,cx,cy,x1,y1,width,angle], color0, color1, alpha, style:'painterly', layer, order, seed, flat }`. Strokes GROW ALONG the image gradient, across five brush radii coarse→fine, stopping when the canvas already matches the photo.
- `js/engine/engine.js` — `generate()` gained an early branch (runs BEFORE the modular path) gated on `style === 'painterly'` that calls `planPainterly(this._imageData, this.width, this.height, {seed, count, threshold})` and installs the shapes on the layer.
- `js/styles/index.js` — registered: `painterly: { class: PainterlyStyle, category: 'paint', label: 'Painterly' }`, plus the import and the bottom export list.
- `js/styles/shaping.js` — one additive `SHAPING_TABLE` row: `painterly: { minSize: 3, maxSize: 12, elongation: 1.8, order: 'free', regionFill: 0 }`.
- `js/engine/brush-media.js` — a `painterly` entry in `MEDIA_PRESETS` (brushName 'HB').
- `scripts/painterly-style-probe.cjs` — 3264 strokes, renderMs 197, 23370 distinct colours, 0 page errors. Evidence PNG: `docs/research/painterly-style-probe.png`.
- `scripts/painterly-geometry-probe.cjs` — 400 strokes, 365 curved, 102342 distinct colours, renderMs 127, 0 page errors, all shapes tagged `painterly`. Evidence PNG: `docs/research/painterly-geometry-probe.png`.

**Upstream:** https://github.com/davemaynard/painterly — MIT, (c) 2026 Dave Maynard. It vendors mersenne-twister (BSD-3-Clause) — the NOTICE file records that attribution and MUST be referenced in the docs.

**Algorithm:** Hertzmann et al. SIGGRAPH 1998 "Painterly Rendering with Curved Brush Strokes of Multiple Sizes". The planner (`js/engine/painterly-planner.js`) wraps the vendored `plan()`/`rasterFromImageData()`/`defaultRadii()` — it grows strokes ALONG the image gradient, across 5 brush radii coarse→fine, and stops a stroke when the canvas already matches the photo. The style's `render()` paints each stroke with a multi-bristle fan (8 bristles, spread 0.9, ragged ends, per-bristle colour drift ±14).

**MEASURED (scripts/painterly-geometry-probe.cjs):**
- 400 strokes
- 365 curved
- 102342 distinct colours
- renderMs 127
- inkPercent 100
- blackPixels 229480
- 0 page errors
- all shapes tagged `painterly`
- Evidence PNG: `docs/research/painterly-geometry-probe.png`

**MEASURED (scripts/painterly-style-probe.cjs):** (now correctly sets style before generate — measures painterly)
- 3264 strokes
- renderMs 197
- 23370 distinct colours
- opaquePixels 427520
- inkPercent 100
- blackPixels 0
- 0 page errors
- Evidence PNG: `docs/research/painterly-style-probe.png`

**Tests re-run green:**
- engine 177/177
- style-accuracy 9/9
- oil-impasto 24/24
- modular-bridge 29/29
- painter-plan 12/12
- export-panel 90/90
- layer-bands 13/13
- modular-switch 22/22
- r4 43/43
- r4-integration 7/7
- plus masks/wetsim/bake/brush-maker/order/outlines/shaping/style-library/primitive-mixer all exit 0 with Failed 0

## Two-Part Architecture

The painterly brush is implemented as a **two-part system**:

1. **Planner** (Hertzmann 1998): 
   - Implements curved brush stroke geometry that follows image edges
   - Grows strokes along the gradient (perpendicular to gradient direction)
   - Uses five brush radii (coarse→fine) to build up detail
   - Stops strokes when the canvas already matches the photo
   - This is the GEOMETRY component — how the stroke shape is defined

2. **Brush** (multi-bristle fan):
   - The style's own `render()` method
   - Uses 8 bristles with spread 0.9, ragged ends, per-bristle colour drift ±14
   - Paints each stroke with this brush model
   - This is the APPEARANCE component — how the stroke looks

The app's stroke PLACEMENT comes from the planner; the style's `generate()` is only used for thumbnails. The painterly brush's `render()` is used for actual painting.

## Probe Traps (Critical Rules)

1. **Wrong Canvas Trap:** `document.querySelector('canvas')` returns the 256x160 Media-panel TONAL-MASK PREVIEW, not the painting. The preview's `masksCompositeRGBA()` deliberately maps the `background` band to RED (so a black source pixel composites to `[255,0,0]`), which made earlier screenshots look like "the black outline renders red". The real painting surface is `#paint-canvas`. Any future probe MUST capture `#paint-canvas` by id.

2. **No-Arg Generate Trap:** `window.__app.generate()` takes NO ARGUMENTS — it reads the style from `controls.getSettings().style`. Passing `{style:'painterly'}` to it is SILENTLY IGNORED and you get the default `pencil`. To render a specific style you must either set `window.__app.controls.settings.style` AND `window.__app.engine.settings.style` first, or call `window.__app.engine.generate({style, count, layer:0, multiLayer:false})` directly.

## Honest Gaps

1. **PRE-EXISTING visual-regression PIN gate:** The 9-baseline PIN gate is RED but PROVEN pre-existing (reproduced IDENTICAL hashes: pencil `1a0742d757bc1264`, ink `a20a11829fc2aff5`, watercolor `b1361f5226c6e681`). Cause: uncommitted work already in `js/engine/engine.js`, `js/engine/renderer.js`, `js/engine/optimizer.js`, `js/engine/modular-bridge.js`. This is not a painterly issue.

2. **No impasto:** Painterly is a 2D brush by design (the user approved this). It has no relief/impasto capability, which is intentional.

3. **dli/paint colour bug:** `js/engine/dli-paint/shaders/painting.frag` applies the RYB trilinear LUT (`rybToRgb`) to pigment that is ALREADY RGB, so requested colours come out wrong. Measured by painting known colours through the real WebGL backend:
   - black (0,0,0) -> (238,238,238)
   - red (220,30,30) -> (231,61,57) [the only one that survives]
   - white (245,245,245) -> (155,116,74)
   - yellow (230,200,40) -> (139,31,88)
   - green (40,170,60) -> (120,138,137)
   - blue (30,30,220) -> (218,216,48)
   - frogGreen (161,194,43) -> (134,71,110)
   - red (220,30,30) -> (231,61,57)
   This is a PORT colour handling bug, not an upstream issue. NOT FIXED.

## How to reproduce the probe traps

**For Canvas Trap:**
```bash
# WRONG (will show mask preview with red background mapping):
document.querySelector('canvas').toDataURL()

# CORRECT (must capture #paint-canvas):
document.getElementById('paint-canvas').toDataURL()
```

**For No-Arg Generate Trap:**
```javascript
// WRONG - silently ignored:
window.__app.generate({ style: 'painterly', count: 10 })

// CORRECT - must set both controls and engine:
window.__app.controls.settings.style = 'painterly';
window.__app.engine.settings.style = 'painterly';
window.__app.engine.generate({ style: 'painterly', count: 10, layer: 0, multiLayer: false });
```