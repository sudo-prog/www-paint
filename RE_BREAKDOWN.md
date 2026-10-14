# Code Painter — Reverse Engineering Technical Breakdown

## Source: https://github.com/JasBlack/code-painter (v4.24.1)
### Analyzed: index.html (8019 lines, 955KB), README, docs, worker source

---

## 1. High-Level Architecture

Code Painter is a **single-file web app** (`index.html`) with these major subsystems:

| Subsystem | Lines | Purpose |
|-----------|-------|---------|
| SHP (Shape Vocabulary) | ~180 | 5 primitive shapes + runtime + export |
| MP4REC (Recorder) | ~200 | H.264+AAC MP4 recording via WebCodecs |
| Style Runtime | ~800 | 48 styles, stroke renderers, relief materials |
| Auto-Painter | ~600 | Worker management, queue, scoring |
| UI/Studio | ~4000 | Layout, panels, controls, playlist |
| Export/Code | ~300 | Packed/tiny/readable/SVG export |

**Key insight**: The entire painting engine is in ONE HTML file. The worker source is embedded as a string (`CP_WORKER_SRC`) and loaded via `Blob` URL.

---

## 2. Shape Vocabulary (SHP)

The core abstraction — every stroke is one of 5 primitives:

```
s = { t: type, p: params, c0: [r,g,b], c1: [r,g,b], a: alpha }
```

| Type | Name | Params | Description |
|------|------|--------|-------------|
| `E` | Ellipse | `[x, y, rx, ry, rot, gradAngle]` | Filled ellipse with linear gradient |
| `B` | Soft Blob | `[x, y, rx, ry, rot, feather]` | Radial gradient, feathered edge |
| `T` | Triangle | `[x1,y1, x2,y2, x3,y3, gradAngle]` | Filled triangle with gradient |
| `R` | Bar | `[x, y, w, h, rot, gradAngle]` | Filled rectangle with gradient |
| `S` | Stroke | `[x0,y0, x1,y1, x2,y2, w, gradAngle]` | Quadratic bezier brush stroke |

**Why this matters**: The same shape data drives:
- Live canvas rendering (via `SHP.draw`)
- Self-contained HTML export (via `SHP.code`)
- SVG export (via `SHP.svg`)
- Packed binary export (via `SHP.pack`)

The runtime (`RUNTIME`) is a tiny drawing library (~15 lines of minified JS) that gets embedded in exported HTML files.

---

## 3. Worker-Based Painting Engine

### 3.1 Worker Protocol

```
Main → Worker: { type: 'start', w, h, data, shapes, styles, ... }
Worker → Main: { type: 'shape', ... }  (scored candidate)
Worker → Main: { type: 'need' }        (ready for more)
```

### 3.2 Scoring System (inferred from worker source)

The worker:
1. Receives image pixel data (`Uint8ClampedArray`)
2. Analyzes the image (edges, luminance, color regions)
3. Proposes candidate shapes at various positions/sizes
4. Scores each candidate against the local image region
5. Posts the best candidates back to main thread

### 3.3 Multi-Worker Pool

For live/video painting, up to 7 workers run in parallel:
```js
POOL.max = Math.max(1, Math.min(7, (navigator.hardwareConcurrency || 4) - 2))
```
Each worker paints a band of rows, keeping up with video frame rate.

### 3.4 Shape Count

Auto-calculated based on style and size:
```js
autoShapes() = clamp(150, 20000, round(1000 * k * sf / 50) * 50)
```
Where `k` = size factor, `sf` = style factor (thin styles like pencil get 2.4x more strokes).

---

## 4. Style System

### 4.1 Style Categories (48 styles, 5 groups)

| Group | Styles |
|-------|--------|
| **Paint** | oil, acrylic, watercolor, sumi, ink, graffiti, palette-knife |
| **Draw** | pencil, charcoal, pastel, marker, calligraphy, hatch |
| **Graphic** | mosaic, scribble, glitch, comic, bokeh, paper, stitch, string |
| **Craft** | linocut, riso, foam, beads, terrazzo, clay, ceramic, stone |
| **Material** | chrome, glass, lens, crystal, gold, bronze, copper, pewter |

### 4.2 Style Rendering Approaches

**A. Gradient-based (default)**: Shape filled with 2-color gradient
```js
function strokePart(a, u, dir, x) {
  const G = x.createLinearGradient(...);
  G.addColorStop(0, h0); G.addColorStop(1, h1);
  x.strokeStyle = G; x.lineWidth = w; x.stroke();
}
```

**B. Stamped Brush (p5.brush-inspired)**: 
- Walk path in small steps
- Stamp tip at each step
- Pressure profile: light → firm → light
- Grain skips some stamps (pencil/charcoal effect)
- Two-pass: main stamps + scattered stamps at 50% alpha

**C. Watercolor (Tyler Hobbs-inspired)**:
- Fractal-edged outline (midpoint displacement)
- Stacked transparent layers
- `hobbsGrow(pts, R, sigma)`: each edge gets midpoint pushed sideways by gaussian amount

**D. Bristle Brush (Oil/Acrylic)**:
- Each bristle carries own color and ridge
- Runs dry towards end of stroke
- Oil drags wet paint along
- Knife scrapes high spots

**E. Relief Materials (WebGL 2)**:
- Height map lit in WebGL 2
- Light direction adjustable
- Used for: clay, ceramic, stone, foam, metal, chrome, etc.

**F. Spray (Graffiti)**:
- Particle-based spray pattern
- Density falls off from center

### 4.3 Style Definition Pattern

Each style is defined by:
```js
STYLE_DRAW[styleName] = function(x, q, u, dir) { ... }
```
Where:
- `x` = canvas context
- `q` = shape object `{t, args, c0, c1, a}`
- `u` = progress (0..1) for animation
- `dir` = direction (1 or -1)

---

## 5. Export System

### 5.1 Three Formats

| Format | Method | Size | Use Case |
|--------|--------|------|----------|
| **Packed** | Bit-packed base64 | ~2.6x smaller than text | Default, looks identical |
| **Tiny** | More quantized | ~3.5x smaller | Slightly lossy, smallest |
| **Readable** | Text code | Largest | Human-readable, editable |

### 5.2 Packed Encoding

```js
// Bit widths per field type:
// c (coord): 12 bits, 1px grid
// s (size): 10 bits
// a (angle): 10 bits
// f (feather): 6 bits
// kb (color): 8 bits per channel
```

### 5.3 Self-Contained HTML Export

The exported file contains:
1. The shape data (packed or readable)
2. The RUNTIME drawing library
3. A decoder (for packed format)
4. Animation loop (stroke-by-stroke replay)

### 5.4 SVG Export

Same gradient math as canvas, but vector:
- `<linearGradient>` for E/T/R/S
- `<radialGradient>` for B
- `<ellipse>`, `<polygon>`, `<path>` for shapes

---

## 6. Path/Order Modes

| Mode | Description |
|------|-------------|
| Free | Random order |
| One Line | Single continuous path |
| Spiral Out | From center outward |
| Top → Bottom | Row by row |
| Edges First | Edge-detected regions first |

---

## 7. Music Integration

- Beat detection via Web Audio API
- Bold strokes on hits
- Broad brushes when loud, fine when quiet
- 3D styles: light swings with beat
- Optional: punch zoom, flashing border

---

## 8. Key Algorithms

### 8.1 Pressure Profile (Stamped Brush)
```js
pr = pmin + (pmax - pmin) / (1 + Math.pow(Math.abs((t - peak) / hw), 2 * c))
```
Where `peak` = pressure peak position, `hw` = half-width, `c` = curve sharpness.

### 8.2 Watercolor Edge Growth
```js
hobbsGrow(pts, R, sigma):
  for each edge (p, q):
    midpoint = [(p.x+q.x)/2, (p.y+q.y)/2]
    push = gauss(R) * sigma * len
    new_point = midpoint + perpendicular * push
```

### 8.3 Gaussian Random
```js
gaussR = R => (R() + R() + R() + R() - 2) * 1.732
```
(Approximates normal distribution from 4 uniform samples)

---

## 9. What We'll Build (WWW_PAINT)

### Improvements over Code Painter:
1. **Modular architecture** — separate files for engine, styles, UI, export
2. **Layer system** — multiple layers with blend modes, opacity, reorder
3. **More manual controls** — every parameter exposed
4. **Project files** — save/load JSON with embedded images
5. **Clean code** — readable, documented, no minification
6. **Web Workers** — already in CP, we'll make it optional/graceful

### Same core concepts:
- 5 shape primitives (E/B/T/R/S)
- Worker-based scoring
- Stamped brush + watercolor + bristle rendering
- Packed export for self-contained HTML
- Multiple artistic styles
