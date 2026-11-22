OIL-IMPASTO checkpoints
=======================

Technique source
----------------
- Inspired by dli/paint "Fluid Paint" by David Li (MIT Licence):
  https://github.com/dli/paint
- The upstream stores PIGMENT in RGB channels and HEIGHT in ALPHA of a paint texture.
- A Sobel gradient of the height field produces per-pixel surface normals.
- A GGX-style BRDF (diffuse + specular) shades the pigment with a fixed light
  direction and deterministic parameters.
- The upstream constants worth knowing: NORMAL_SCALE 7.0, ROUGHNESS 0.075, F0 0.05,
  SPECULAR_SCALE 0.5, DIFFUSE_SCALE 0.15, LIGHT_DIRECTION [0,1,1].

Design
------
- Two-buffer surface: pigment (Uint8ClampedArray RGBA) + height field (Float32Array)
  — separate PIGMENT/ALBEDO from HEIGHT as in dli/paint.
- For each oil stroke, deposit pigment and height into the surface at the stroke path.
  Bristle channels (height/pigment deposit vary across brush width) create ridges/furrows;
  height does NOT bleed/flood outside the stroke footprint.
- Derive surface normal from the height field using a Sobel gradient (3x3 kernel,
  central-difference approximation).
- Shade pigment with a height-normal lit BRDF-like model:
  diffuse = max(0, dot(N, L)) * diffuseScale + (1 - diffuseScale);
  specular = GGX(D, G, F) * specularScale — standard microfacet model.
- Fixed deterministic parameters: NORMAL_SCALE, ROUGHNESS, F0, SPECULAR_SCALE,
  DIFFUSE_SCALE, LIGHT_DIRECTION [0,1,1].
- All randomness from the project's seeded rngFor (import from ../styles/base.js),
  never Math.random.
- Pure 2D canvas implementation — works in --disable-gpu headless harness.
  Offscreen canvas for height field; normals computed in JS; output via canvas.putImageData.

Files changed
-------------
NEW: js/engine/oil-impasto.js
  Full deterministic height-field impasto backend (pure 2D canvas).
  Exports: renderOilImpasto(), createSurface(), resetSurface(),
    depositStroke(), computeSobel(), computeNormals(),
    shadePigment(), createBristleProfile(),
    heightToNormals(), makeBristleProfile(),
    softenHeight(), DEFAULTS, and internal helpers.

MODIFIED: js/styles/oil.js
  - Added import { renderOilImpasto } from '../engine/oil-impasto.js'.
  - In OilStyle.render(), for shape.type === 'S', FIRST try the new impasto
    backend (dli/paint-inspired path). If it returns ok, return immediately.
    Otherwise fall back to the existing _renderStroke() unchanged — code
    byte-for-byte intact.

NEW: scripts/oil-impasto-probe.cjs
  Serves the repo and uses headless Chromium via playwright-core.
  Renders ONE deterministic stroke through the impasto backend and a flat
  fill, asserts: (a) both canvases have ink, (b) impasto differs from flat
  fill, (c) output is deterministic, (d) no page errors.
  Writes screenshot PNG to docs/research/oil-impasto-probe.png.

NEW: tests/oil-impasto.test.js
  Node-only deterministic assertions on pure helpers from oil-impasto.js:
    - heightToNormals / makeBristleProfile / computeSobel / computeNormals
      / shadePigment / depositStroke / softenHeight
    - Determinism under fixed seed
    - No Math.random in new module (source scan)
    - Height does not grow outside stroke footprint
    - Unit-length normals
    - Surface reset / create helpers
  Run with: node tests/oil-impasto.test.js

NEW: docs/checkpoints/OIL-IMPASTO.md (this file)

Commands to run
----------------
  # Run unit tests
  node tests/oil-impasto.test.js

  # Run browser probe (will launch Chromium, render, print JSON summary)
  NODE_PATH=/home/thinkpad/.hermes/hermes-agent/node_modules node scripts/oil-impasto-probe.cjs

  # Run existing engine tests (ensure nothing is broken)
  node tests/engine.test.js
Fix section (verified-bug pass)
-------------------------------
- js/engine/oil-impasto.js: (1) colours now normalised via rgbToHex/hexRgb so
  engine-format array colours ([196,64,48]) shade correctly instead of reading
  ints and producing grey. (2) renderOilImpasto no longer putImageData's an
  all-opaque buffer onto the shared canvas (which erased prior strokes); it
  shades into an OffscreenCanvas and composites via drawImage with the stroke
  alpha, leaving transparent pixels outside the footprint. (3) depositStroke
  samples the bezier only up to opts.progress. (4) alpha resolves as
  shape.alpha ?? params[10] ?? opts.alpha ?? 1.
- scripts/oil-impasto-probe.cjs: fixed the chromium regex (single backslash
  before d), removed the always-failing r.shapes check, fixed the pixelHash
  stack overflow (no spread on 256KB arrays), and the probe now lays the
  rendered canvas into the DOM before page.screenshot so the PNG is written.
  Run result: PASS (impastoInkPct 1.32%, flatInkPct 5.47%, deterministic,
  differs-from-flat); docs/research/oil-impasto-probe.png written.
- js/styles/gouache.js + knife.js: degenerate-path guard (n < 3 no longer
  bails to zero pixels for the deterministic probe shape).
- Verification: node --check clean on all touched files; oil-impasto tests
  24/0; engine tests 177/0.
