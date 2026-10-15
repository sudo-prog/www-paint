# WWW_PAINT — Proposed Architecture

> **STATUS (2026-10-15):** This document is the original *proposed* design.
> Current implementation notes:
> - Engine runs the Painter via a **Web Worker** (`js/engine/painter-worker.js`,
>   `engine._generateViaWorker()`), so stroke generation never blocks the UI.
>   The worker mirrors the main-thread path; `useWorker:true` in `app.js`.
> - Styles implemented: 14 (pencil, ink, watercolor, oil, graffiti, graphic,
>   charcoal, marker, calligraphy, cross-hatch, mosaic, scribble, halftone, string).
>   Reference Code Painter v4.25.0 has 48 — see
>   `OBSIDIAN_OPS_VAULT/20_Projects/WWW_PAINT_FEATURE_PARITY_PLAN.md` for the gap.
> - Out of scope (user directive): music/audio, video input, MP4 recording.

## Project Structure

```
20.36_WWW_PAINT/
├── index.html              # Main app entry point
├── css/
│   └── style.css           # UI styling
├── js/
│   ├── engine/             # Core painting engine (reusable, no UI)
│   │   ├── shapes.js       # Shape primitives (E/B/T/R/S) + runtime
│   │   ├── analyzer.js     # Image analysis (edges, luminance, color)
│   │   ├── scorer.js       # Candidate scoring + selection
│   │   ├── generator.js    # Stroke generation orchestrator
│   │   ├── renderer.js     # Canvas rendering (all styles)
│   │   ├── exporter.js     # PNG/JPG/HTML/Project export
│   │   └── worker.js       # Web Worker for heavy computation
│   ├── styles/             # Style definitions
│   │   ├── index.js        # Style registry
│   │   ├── pencil.js       # Pencil/Graphite
│   │   ├── ink.js          # Ink/Pen
│   │   ├── watercolor.js   # Watercolor
│   │   ├── oil.js          # Oil/Acrylic
│   │   ├── graffiti.js     # Graffiti/Spray
│   │   └── graphic.js      # Flat graphic/Stylized
│   ├── ui/                 # UI layer
│   │   ├── app.js          # Main app controller
│   │   ├── canvas.js       # Canvas manager
│   │   ├── controls.js     # Control panel bindings
│   │   ├── layers.js       # Layer panel
│   │   └── export.js       # Export dialog
│   └── utils/
│       ├── color.js        # Color utilities
│       ├── math.js         # Math helpers
│       └── rng.js          # Seeded random number generator
├── assets/
│   └── icons/              # UI icons
├── tests/
│   └── engine.test.js      # Engine unit tests
└── docs/
    ├── ARCHITECTURE.md     # This file
    ├── STROKE_FORMAT.md    # Stroke data format spec
    └── API.md              # Engine API reference
```

## Core Data Structures

### Shape (Stroke)
```js
{
  id: "stroke_001",          // Unique identifier
  type: "S",                // E | B | T | R | S
  params: [x0,y0, x1,y1, x2,y2, w, g],  // Type-specific
  color0: [r, g, b],        // Start color
  color1: [r, g, b],        // End color
  alpha: 0.8,               // Opacity (0..1)
  style: "pencil",          // Style name
  layer: 0,                 // Layer index
  order: 42,                // Paint order
  seed: 12345               // For reproducible randomness
}
```

### Layer
```js
{
  id: "layer_0",
  name: "Background",
  visible: true,
  opacity: 1.0,
  blendMode: "normal",      // normal | multiply | screen | overlay
  strokes: [],              // Array of Shape objects
  locked: false
}
```

### Project
```js
{
  version: "1.0",
  width: 1920,
  height: 1080,
  background: "#ffffff",
  layers: [],               // Array of Layer objects
  settings: {
    style: "pencil",
    strokeSize: { min: 2, max: 8, random: true },
    strokeCount: 1000,
    detailLevel: 0.7,       // 0..1
    styleStrength: 0.8,     // 0..1
    opacity: 0.8,
    pathOrder: "free",      // free | top-bottom | spiral | one-line | edges-first
    randomness: 0.3,
    colorMode: "exact"     // exact | quantized | palette
  }
}
```

## Engine API

```js
// Initialize engine
const engine = new PaintingEngine({
  canvas: document.getElementById('canvas'),
  width: 1920,
  height: 1080,
  useWorker: true
});

// Load image
await engine.loadImage(imageElement);

// Generate strokes
const strokes = engine.generate({
  style: 'pencil',
  count: 1000,
  layer: 0
});

// Render
engine.render();

// Export
const png = engine.exportPNG({ width: 3840, height: 2160 });
const html = engine.exportHTML({ format: 'packed' });
const project = engine.exportProject();
```

## Style Definition Format

```js
// Each style is a class implementing:
class PencilStyle {
  name = 'pencil';
  category = 'draw';
  
  // Default parameters
  defaults = {
    strokeSize: { min: 1, max: 4 },
    spacing: 0.5,
    scatter: 0.3,
    grain: 0.4,
    pressure: { min: 0.3, max: 0.8, peak: 0.5 }
  };
  
  // How to generate strokes for this style
  generate(analyzer, params) {
    // Returns array of Shape candidates
  }
  
  // How to render a stroke
  render(ctx, shape, progress) {
    // Draw the stroke on canvas
  }
}
```

## Rendering Pipeline

```
Image → Analyzer → Candidates → Scorer → Selected → Renderer → Canvas
                    ↑
              Style params
                    ↑
              User controls
```

### 1. Analyzer
- Convert image to luminance map
- Edge detection (Sobel or similar)
- Color quantization (optional)
- Region segmentation

### 2. Generator
- Propose candidate shapes based on style
- Position, size, color, angle
- Respect density/detail settings

### 3. Scorer
- Compare candidate region vs original image
- Score based on color match, edge alignment
- Select top N candidates

### 4. Renderer
- Draw selected strokes in order
- Apply style-specific rendering
- Support animation (progressive reveal)

## Export Formats

### PNG/JPG
- Flatten all visible layers
- Render at arbitrary resolution
- Apply blend modes during flatten

### Self-Contained HTML
- Embed stroke data (packed base64 or readable text)
- Include minimal runtime (~2KB)
- Stroke-by-stroke animation
- No external dependencies

### Project File (JSON)
```json
{
  "version": "1.0",
  "image": "data:image/png;base64,...",
  "layers": [...],
  "settings": {...}
}
```

## Performance Considerations

1. **Web Workers**: Heavy scoring in worker thread
2. **OffscreenCanvas**: Render to offscreen, composite to visible
3. **Stroke Batching**: Group similar strokes for fewer state changes
4. **Level-of-Detail**: Preview at low res, full res on export
5. **Incremental Rendering**: Only redraw changed regions

## Implementation Phases

### Phase 1: Core Engine + Pencil Style
- Shape primitives + runtime
- Basic image analysis
- Pencil style rendering
- Simple UI with canvas + image drop
- PNG export

### Phase 2: Layer System
- Multiple layers
- Layer panel UI
- Blend modes + opacity
- Layer reorder/visibility

### Phase 3: Additional Styles
- Ink, watercolor, oil, graffiti, graphic
- Style-specific parameters
- Style preview thumbnails

### Phase 4: Export + Project
- JPG export
- Self-contained HTML
- Project save/load
- High-resolution export
