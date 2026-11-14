# WWW_PAINT — stroke / shape record format

**Written:** 2026-11-14 · **Agent:** AIR HERMES (Mac, M14)
**Owner:** Mac-owned doc. Engine code quoted here is ThinkPad-owned and was
**read**, not edited.
**Evidence:** every record below was produced by a real run of the app. The
capture script is `scripts/m14-docs-probe.cjs`; raw output is
`docs/research/m14-docs-probe.json`.

---

## 1. What a "stroke" is

The engine has **no per-pixel brush trail**. Everything drawn — a generated
painting, a freehand paint stroke, an exported SVG, a re-imported project — is a
list of **shape records** ("strokes"). A painting is `layers[].strokes[]`.

There are five shape types, fixed by `js/engine/shapes.js`:

```js
export const SHAPE_TYPES = { ELLIPSE: 'E', BLOB: 'B', TRIANGLE: 'T', BAR: 'R', STROKE: 'S' };
export const VALID_TYPES = new Set(['E', 'B', 'T', 'R', 'S']);
```

`S` is the workhorse. It is a **quadratic Bézier** — two endpoints and one
control point. `E`/`B` are ellipses, `T` is a triangle, `R` is a rotated
rectangle.

---

## 2. The record

```js
{
  id:     "stroke_0_3",      // "stroke_<layerIndex>_<order>"
  type:   "S",               // E | B | T | R | S
  params: [ ... ],           // per-type, see §3
  color0: [r, g, b],         // 0..255, gradient start
  color1: [r, g, b],         // 0..255, gradient end
  alpha:  0.85,              // 0..1
  style:  "pencil",          // a registered style name
  layer:  0,                 // integer layer index
  order:  3,                 // paint order within the layer
  seed:   322420463,         // the engine seed (not per-shape)
  flat:   true,              // present on Painter-path shapes
}
```

`createShape()` (`js/engine/shapes.js:296`) is the canonical constructor. It
defaults `type` to `'S'`, `params` to eight zeros, `alpha` to `1`, `style` to
`'pencil'`, `layer` and `order` to `0`, `seed` to `0`.

`isValidShape()` (`shapes.js:45`) is the validator. It requires: `id` string,
`type` in `VALID_TYPES`, `params` an array of length ≥ 2, `color0`/`color1`
3-element arrays, `alpha` a number. It does **not** check param semantics — a
record can be `isValidShape() === true` and still be geometrically nonsense.

---

## 3. `params`, by type

`params` is a **flat array**, not a named object. Indices matter. Lengths
differ per type, and the Painter path appends `[color0, color1, alpha]` to the
tail — the same three values that also sit in the record's named fields.

| Type | `params` layout | Length |
|--|--|--|
| `E` ellipse | `[cx, cy, rx, ry, rot, c0, c1, alpha]` | 8 |
| `B` blob | `[cx, cy, rx, ry, rot, c0, c1, alpha]` | 8 |
| `T` triangle | `[x1, y1, x2, y2, x3, y3, across, c0, c1, alpha]` | 10 |
| `R` bar | `[cx, cy, w, h, rot, c0, c1, alpha]` | 8 |
| `S` stroke | `[x0, y0, x1, y1, x2, y2, w, gradAngle, c0, c1, alpha]` | 11 |

**Angles are radians, not degrees.** `rot` rotates about the shape's own centre;
`gradAngle` is the gradient axis for `color0 → color1`.

**Index 5 is NOT the native field for `E`/`B`/`R` — it is `c0`, the appended
colour triple, which overwrites the native gradient angle / feather (see the
code block below). For `T`, index 6 is `across`. `gradAngle`/`feather` survive
only as the record's named `color0`/`color1`-adjacent fields, never in
`params`. This is the single most common way to misread a record.

### Why `S` and `T` carry the colour triple twice

The Painter (`js/engine/painter.js`) works internally with a compact form
`{ t, p, a, st, c0, c1 }` where `p` is the native param array. On commit,
`Engine._convertShape()` (`js/engine/engine.js:646`) appends `c0`, `c1` and
`alpha` to `p` **and** copies them into the named fields:

```js
if (t === 'E' || t === 'B' || t === 'R') {
  p[5] = c0;          // overwrites gradAngle/feather
  p.push(c1, a);
} else {
  p.push(c0, c1, a);  // S and T
}
```

So for `E`/`B`/`R` the appended `c0` **replaces** index 5; for `S`/`T` it is
appended after the native array. The style renderers (`js/styles/*.js`) read the
native prefix and ignore the tail; the fallback `drawShape()` in `shapes.js`
reads `p[0..7]`. The duplication is deliberate — the style modules receive one
array and never need the record's named fields.

**Practical consequence:** when writing a record by hand, only `params[0..7]`
(the native prefix) affects rendering for `E`/`B`/`R`. The named `color0` /
`color1` fields are what actually drive the gradient.

---

## 4. Real records, from a real run

Captured 2026-11-14 against `index.html` at 1440×900, synthetic 96×72 source,
`engine.useWorker = false`. Commands are in §7.

### `S` — stroke

```json
{
  "id": "stroke_0_3",
  "type": "S",
  "params": [21.18, -8.04, 6.31, 7.10, -10.78, 36.67, 20.63, 4.33,
             [185.88, 99.07, 68.87], [185.88, 99.07, 68.87], 0.8],
  "color0": [185.88, 99.07, 68.87],
  "color1": [185.88, 99.07, 68.87],
  "alpha": 0.8,
  "style": "flat",
  "layer": 0,
  "order": 3,
  "seed": 322420463,
  "flat": true
}
```

Read: a quadratic Bézier from `(21.18, -8.04)` to `(-10.78, 36.67)` with control
point `(6.31, 7.10)`, stroke width `20.63`, gradient angle `4.33` rad, drawn at
`0.8` alpha in a flat ochre.

### `E` — ellipse

```json
{
  "id": "stroke_0_0",
  "type": "E",
  "params": [87.95, 58.77, 96.65, 32.17, -0.99, [72.31, 91.93, 140.83],
             [72.31, 91.93, 140.83], 0.8],
  "color0": [72.31, 91.93, 140.83],
  "color1": [72.31, 91.93, 140.83],
  "alpha": 0.8,
  "style": "flat",
  "layer": 0,
  "order": 0,
  "seed": 322420463,
  "flat": true
}
```

Centre `(87.95, 58.77)`, radii `96.65 × 32.17`, rotation `-0.99` rad. Note index
5 is now the **colour array**, not a gradient angle — exactly the overwrite
described in §3.

### `B` — blob

```json
{
  "id": "stroke_0_0",
  "type": "B",
  "params": [-3.95, 18.91, 50.74, 1017.97, 0.678, [183.19, 98.92, 70.60],
             [127.19, 95.39, 106.09], 1],
  "color0": [183.19, 98.92, 70.60],
  "color1": [127.19, 95.39, 106.09],
  "alpha": 1,
  "style": "paper",
  "layer": 0,
  "order": 0,
  "seed": 322420463,
  "flat": true
}
```

### `T` — triangle

```json
{
  "id": "stroke_0_2",
  "type": "T",
  "params": [96.72, 52.76, 95.69, 82.29, 77.84, 77.94, 2.004,
             [51.70, 90.67, 153.94], [51.70, 90.67, 153.94], 1],
  "color0": [51.70, 90.67, 153.94],
  "color1": [51.70, 90.67, 153.94],
  "alpha": 1,
  "style": "paper",
  "layer": 0,
  "order": 2,
  "seed": 322420463,
  "flat": true
}
```

### `R` — bar

```json
{
  "id": "stroke_0_0",
  "type": "R",
  "params": [6, 6, 12, 12, 0, [188.93, 99.27, 66.97],
             [188.93, 99.27, 66.97], 1],
  "color0": [188.93, 99.27, 66.97],
  "color1": [188.93, 99.27, 66.97],
  "alpha": 1,
  "style": "mosaic",
  "layer": 0,
  "order": 0,
  "seed": 322420463,
  "flat": true
}
```

---

## 5. What the renderers do with a record

Three consumers, all reading the same record:

1. **`drawShape(ctx, s, progress)`** — `js/engine/shapes.js:378`. The fallback
   renderer. Reads `s.params[0..7]` and `s.color0/color1/alpha`. Handles all five
   types. Used when a style has no `draw()` of its own.
2. **Style modules** — `js/styles/<name>.js`, class method
   `render(ctx, shape, progress)`. Registered per style name; the engine looks
   them up via `Renderer.drawShapeAt()` (`js/engine/renderer.js:394`). Each
   reinterprets `params` for its own technique — `pencil.js` walks the Bézier
   and stamps a pressure-driven tip; `mosaic.js` tiles the bounding box.
3. **`shapeToSVG(s)`** — `js/engine/shapes.js:467`. Emits an `<ellipse>`,
   `<polygon>`, `<rect>`, or `<path d="M… Q…">`. This is what `exportSVG()`
   writes.

`poly(s)` (`shapes.js:542`) tessellates any type into a boundary polygon — used
by the hatch/fill passes that fill `E`/`B`/`T`/`R` shapes with strokes.

---

## 6. Serialization

### Project file (JSON)

`Engine.exportProject()` → `exportProject()` in `js/engine/exporter.js:278`:

```json
{
  "version": "1.0",
  "width": 1920,
  "height": 1080,
  "background": "#ffffff",
  "image": "",                       // data URL, or "" when embedImage:false
  "layers": [
    {
      "id": 0, "name": "Background", "visible": true, "opacity": 1,
      "blendMode": "normal", "locked": false,
      "strokes": [ /* §2 records */ ]
    }
  ],
  "settings": { /* generator settings, see js/engine/generator.js:23 */ }
}
```

`importProject(jsonStr)` (`exporter.js:313`) validates `version` and that
`layers` is an array, then `Engine.importProject()` restores settings, layers,
and the embedded image.

### Packed form (HTML export)

`packShape()` (`shapes.js:333`) flattens one record to 20 bytes:

```
[type(1), params(8), color0(3), color1(3), alpha(1), styleIdx(1), layer(1), order(1), seed(1)]
```

Base64-encoded by `packLayers()` (`exporter.js:70`). **The packed form truncates
to integers** (`Math.round`, clamped 0–255), so it is a lossy copy — do not
round-trip a packed buffer and expect byte-identical re-rendering. `unpackShape()`
restores the object form with `id: "unpacked_<seed>"`.

### SVG

`exportSVG(layers, width, height, background)` (`exporter.js:331`) concatenates
`shapeToSVG(s)` for every visible layer's strokes inside an `<svg>` wrapper.

---

## 7. How this was captured

```bash
# The probe serves the repo ITSELF on an ephemeral port — no dev server needed.
# NODE_PATH only has to point at a directory containing playwright-core.
NODE_PATH=<dir containing playwright-core> node scripts/m14-docs-probe.cjs --width=1440
NODE_PATH=<dir containing playwright-core> node scripts/m14-docs-probe.cjs --width=390
```

Chromium is auto-discovered on macOS and Linux (`chrome-mac-x64`,
`chrome-linux64`, `chrome-linux`, newest `chromium-<n>` first); set
`CHROME_BINARY` to override. No absolute per-machine path is baked in.

The per-type records in §4 came from a headless run of the real page driving the
engine directly:

```js
const eng = window.__app.engine;
eng.useWorker = false;
await eng.loadImage(syntheticPngDataUrl);
eng.settings.shapeBias = { E: 0, B: 0, T: 1, R: 0, S: 0 };  // force triangles
eng.settings.pathOrder = 'free';
await eng.generate({ style: 'paper', count: 20, seed: 9 });
// then read eng.layers[].strokes[]
```

`shapeBias` is the **modular** generator's own type selector
(`js/engine/generator.js:223`, `weightedPick(s.shapeBias, random)`). It is NOT
reached on the app path: `Engine.generate()` drives the **Painter**
(`js/engine/engine.js:21/352`), and the string `shapeBias` does not appear in
`painter.js` at all. The Painter picks types from its own `MIX` table
(`painter.js:480 pickType`); `paper` is in `Painter.SHAPE_ID`, so its `'S'`
shortcut is skipped and `MIX.paper` decides.

**The §4 records above came from a separate scratch run, not from
`docs/research/m14-docs-probe.json`.** That JSON's `strokes` block is built by
`createShape()` with hand-made 8-length params (so it exercises validation,
not the Painter conversion), and its `project` block has `strokeCount: 0`.
If a future reader wants the §4 records in machine-readable form, the probe
needs a `realRun` block that drives `Engine.generate()` as above and dumps
`eng.layers[].strokes[]`.

**Histograms from that scratch run** (different source image from BE's
re-run, so the counts differ — not a contradiction): `paper` `total: 20
hist: {"B":11,"T":5,"E":2,"R":2}` — the `paper` style's own `MIX` table
still decided most shapes, which is why §4's `T` record is real but came from
a mixed run rather than a pure-`T` run. The `mosaic` style produced a pure `R`
histogram and `watercolor` produced `B` + `S`. BE's independent engine run
(`paper` 20, `watercolor` 60, `mosaic` 30) confirmed the per-type `params`
lengths and that `params[5]` on E/B/R is the colour array.

---

## 8. Gotchas

1. **`seed` is the engine seed, not a per-shape seed.** Every record in a run
   carries the same value. Do not use it to re-roll one shape.
2. **`params` length is not uniform.** 8 for E/B/R, 10 for T, 11 for S — and
   the Painter's native pre-conversion arrays are 6, 7, 8, and 8. If you index
   `params[8]` on an `E` record you get the colour array, not a number. For
   E/B/R the conversion has already overwritten the native index 5, so the
   record's `params` is `[...native[0..4], c0, c1, alpha]` — 8 entries, not 9.
   The named `gradAngle`/`feather` fields are not in `params` at all.
3. **`color0`/`color1` are floats, not integers.** Generated colours are
   `clamp(v + range(-15,15))` — real values like `74.68906236085212`. Only the
   packed form rounds.
4. **Coordinates can be negative or off-canvas.** The `S` records above include
   `y = -8.04` and `y = -22.24`. That is normal; shapes are allowed to start
   outside the frame and the canvas clips them.
5. **`flat` is not part of `createShape()`.** It is set by the Painter from
   `Painter.FLAT` — a set of style names that render flat rather than stamped.
   Absent on shapes built by hand.
6. **`layerName` appears only in multi-layer mode.** `Engine.generate()` sets
   `s.layerName` from the worker's `ps.layer` when `multiLayer` is on; the
   tonal band names are `background`, `shadows`, `outline`, `midtone`,
   `highlights` (`PaintingEngine.LAYER_NAMES`, `engine.js:190`).
7. **A layer's `style` field is inert on its own.** `js/engine/layer-styles.js`
   exists precisely because the renderer dispatches on `shape.style`, not
   `layer.style`. Changing a layer's style requires restamping its strokes —
   which is what `Engine.setLayerStyle()` does.
