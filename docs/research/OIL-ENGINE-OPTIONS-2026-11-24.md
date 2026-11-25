# Oil-paint engine options — research + measured findings

Date: 2026-11-24. All findings below are from live runs on this machine (ThinkPad,
Ubuntu 24.04, headless Chromium via playwright-core + SwiftShader/ANGLE), not from
documentation alone.

---

## 0. Correction: the "hard browser limitation" was wrong

The previous conclusion — *"this specific Chromium/ANGLE build cannot render the
brush simulation's float textures, which is why upstream dli/paint paints nothing
here either"* — is **false**. It was an artefact of probe ordering.

**Measured (`scripts/` probe in scratch: `float-cap-matrix.cjs`, `float-fbo-differential2.cjs`):**

| Chromium build | WebGL1 RGBA/FLOAT/LINEAR FBO @100×10 | @512×512 |
|---|---|---|
| playwright chromium-1228 | COMPLETE | COMPLETE |
| playwright chromium-1234 | COMPLETE | COMPLETE |
| playwright chromium-1243 | COMPLETE | COMPLETE |
| /opt/google/chrome/chrome (156) | COMPLETE | COMPLETE |
| ~/.local/bin/google-chrome | COMPLETE | COMPLETE |

Both WebGL1 and WebGL2 paths are complete; WebGL2 additionally exposes
`EXT_color_buffer_float` and `EXT_color_buffer_half_float`.

**The actual cause.** `OES_texture_float` must be requested with `getExtension()`
**before** any float texture is created. Upstream `paint.js` does this at the top of
`function Paint(canvas, wgl)`:

```js
wgl.getExtension('OES_texture_float');
wgl.getExtension('OES_texture_float_linear');
```

Request it afterwards and `texImage2D(RGBA, FLOAT)` fails with `INVALID_ENUM (1280)`;
every later `checkFramebufferStatus()` then reports `FRAMEBUFFER_INCOMPLETE_ATTACHMENT`
(36054). That is exactly the signature the earlier probe recorded — including the
`err 1280` that was read as a red herring.

**Proof, same context, after requesting the extension first:**

```
port.positions       status 36053 COMPLETE
port.projected       status 36053 COMPLETE
upstream.positions   status 36053 COMPLETE
upstream.positionsData: max 269.12, nonZero 4000   (bristle positions really written)
```

**And upstream dli/paint paints in this browser.** Live run of the unmodified
upstream app (`scratch/upstream-live-probe.cjs`, drag across the canvas):
a red bristle stroke is visible in `scratch/upstream-dli-live.png`.

---

## 1. Why the WWW_PAINT OIL style still did not look like oil

Three independent defects, all now measured:

1. **The port's GL wrapper is missing 8 upstream methods.** Diffing
   `WrappedGL.prototype.X` on both sides: the port has 41, upstream has 49.
   Missing: `createClearState`, `createDrawState`, `createProgramFromFiles`,
   `createProgramsFromFiles`, `createReadState`, `deleteBuffer`,
   `deleteFramebuffer`, `deleteTexture`.
   Consequences observed live:
   - `wgl.hasFloatTextureSupport()` → `TypeError: this.deleteFramebuffer is not a function`
   - `brush.initialize()` → `TypeError: wgl.createDrawState is not a function`
   The port's `utilities.js` also lacks upstream's `clamp` and `getMousePosition`.

2. **`paint.js` was never ported.** Upstream's 1236-line `paint.js` is the
   orchestrator: the painting/brush/output/shadow programs, the `#define RGB`
   painting variant, the quad vertex buffer, the painting rectangle, and the
   stroke path that drives `Brush` + `Simulator`. The port has Brush, Simulator,
   WrappedGL and Rectangle — and no engine to run them.

3. **The port is dead code.** `grep -rn 'dli-paint' --include=*.js js/ | grep -v 'js/engine/dli-paint/'`
   returns nothing. No production module imports it. `oil-impasto.js` — the file
   that actually renders OIL — says so itself in its header: *"Pure 2D canvas
   (no WebGL dependency)"*. It is a 2D height-field approximation inspired by
   dli/paint, not dli/paint.

So the "0 px upstream" conclusion was reached with a broken port, and the "browser
limitation" conclusion was reached with a mis-ordered probe. Both needed correcting.

---

## 2. Candidate engines compared

### A. dli/paint "Fluid Paint" — **recommended, keep it**

- MIT, David Li (github.com/dli/paint), 2017. WebGL1.
- What it gives: simulated **bristles** (per-bristle position/velocity textures,
  distance/plane/bending constraints), **wet paint advection** through a
  velocity/pressure field, **splat** of pigment + height, and a **shading pass**
  (Sobel normals + GGX specular + diffuse) over a shared pigment/height texture.
  That is the actual definition of "fluid oil paint".
- Fits this project: the port already exists and is 60% complete; the upstream
  reference is vendored locally; the fix is bounded (8 methods + `paint.js` + wiring).
- Risk: none material now that the FBO question is settled. It renders in this
  browser as-is.

### B. `painterly` (davemaynard/painterly) — good *planar* renderer, not an oil engine

- MIT, zero-dependency, TypeScript. Hertzmann's 1998 "Painterly Rendering with
  Curved Brush Strokes of Multiple Sizes", ported, with a modern tensor-flow option.
- **Measured here**: cloned, `npm install`, built, and rendered the frog fixture
  in-browser — 45,640 strokes, plan 1.6 s, paint 2.6 s, PNG 647 KB
  (`scratch/painterly-frog.png`).
- Result: clean, legible, strokes follow the image form, good colour retention —
  but it reads as **traced vector art**, not oil. No impasto, no relief, no
  specular, flat fills. Its "matte oil" mode paints strokes as heights and lights
  them, which helps, but the brush model is a set of parallel 2D bristle lines,
  not a bristle simulation.
- **Verdict**: excellent *stroke planner*; wrong tool for realistic oil. Worth
  keeping as a possible replacement for the current 2D planner, not for the
  impasto renderer.

### C. `p5.brush` — already vendored; good strokes, no oil physics

- MIT (acamposuribe/p5.brush), WebGL2-only standalone build. Already at
  `js/vendor/brush.esm.js`.
- Its blend shader is genuinely good pigment work: it mixes in a **38-band
  spectral / Kubelka–Munk** model (`spectral_mix`, `spectral_reflectance_to_xyz`),
  which is the right physics for *colour* — better than a naive RGB lerp.
- But it has no bristle simulation, no wet-paint advection, no height field, no
  impasto relief. It is a stroke renderer.
- **Verdict**: keep as the shared stroke substrate. Not an oil engine.

### D. `claude-paint` (aliceisjustplaying) — the best oil *physics*, poor fit here

- MIT Rust. The most physically faithful oil simulator found: per-bristle
  reservoirs, Kubelka–Munk pigment mixing, Orchard-law levelling with yield
  stress, a drying clock (Open → Setting → Tacky → Dry), linen weave + grounds,
  glazes/scumbles, craquelure, Mixbox/OKLab colour. Actively developed;
  `stillwet.art` exposes it as a service.
- **Fit problem, measured**: this machine has **no Rust toolchain**
  (`cargo`/`rustc`/`wasm-pack` all absent; `apt` candidate is cargo 1.75, Ubuntu's
  ancient). It has no published WASM build — the web build is an `eframe`
  desktop-style app, not a browser-callable library, and it needs a wasm-bindgen
  toolchain version matched to its Cargo.lock. Disk is at 85% (34 GB free).
- **Verdict**: the right *reference* for how oil should behave (its materials
  notes are excellent reading), and the right long-term target if we want
  true physics — but it is a multi-week Rust/WASM build, not a drop-in. Not
  the fix for "nothing renders yet".

### E. `wetpaint` (bgyss) — Rust/wgpu, WebGPU-first

- Rust engine: watercolour, ink, **oil**, pastel; GPU simulation; pigment mixing;
  has an MCP control surface.
- **Fit problem**: its browser build is `eframe` + WebGPU (display on GPU,
  simulation on CPU) or WebGL fallback — again not a library you drop into a
  static ES-module app. WebGPU is not available in this headless Chromium
  configuration.

### F. WetBrush (Adobe Research) — the academic reference, WebGPU only

- The 2015 SIGGRAPH paper that defines bristle-level oil. There is an active
  community **WebGPU** reimplementation (wgpu + Rust, Reddit r/GraphicsProgramming).
- Its own author reports the browser build is not yet reliable ("In Chrome the
  canvas just stays empty", not verified on Linux/Android). Same no-toolchain,
  WebGPU-availability problem as E.

---

## 3. Decision

**Keep dli/paint and fix the port properly.** It is the only candidate that is
(a) genuinely a fluid-oil engine, (b) pure WebGL1 so it works in this headless
harness, (c) MIT, (d) already 60% ported, and (e) now proven to render *in this
exact browser*.

The fix is bounded and already specified:

1. Port the 8 missing `WrappedGL` methods + upstream's `ClearState`/`ReadState`
   and `utilities.clamp`/`getMousePosition`.
2. Port upstream `paint.js` as an ES module — with the extension request FIRST,
   the `#define RGB` painting variant, and a reusable stroke API.
3. Wire it into production so `oil-impasto.js`'s pure-2D path becomes the
   fallback, not the default.
4. Prove it with pixels: `ink% > 0`, `chroma > 0`, `relief range > 0`,
   `fallbackCount == 0`, identical hashes across two renders, and a PNG that
   actually looks like impasto.

Secondary, cheap win while we are here: `painterly`'s Hertzmann planner is a
better *stroke planner* than the current 2D one, and `p5.brush`'s spectral
Kubelka–Munk blend is a better *colour mixer*. Neither replaces the engine, but
both can raise the quality of the non-oil styles and of the fallback path.

---

## 4. Artefacts from this investigation

| File | What it proves |
|---|---|
| `scratch/float-cap-matrix.cjs` → `float-cap-matrix.json` | float/half-float FBO completeness across every local Chromium, WebGL1+WebGL2 |
| `scratch/float-fbo-differential2.cjs` | port vs upstream, same context, extension requested first → all COMPLETE, upstream bristle positions read back with data |
| `scratch/upstream-live-probe.cjs` → `upstream-dli-live.png` | unmodified upstream dli/paint paints a red bristle stroke in this browser |
| `scratch/painterly-render.cjs` → `painterly-frog.png` | the painterly alternative rendered on the same fixture (45,640 strokes, 4.2 s) — legible but flat, not oil |
| `docs/research/oil-render-frog-700.png` | current WWW_PAINT OIL output via the pure-2D impasto path — hatched rectangles, not oil |

---

## ADDENDUM 2026-11-25 — The verdict is superseded

**Original analysis (2026-11-24) was accurate for what it measured:** painterly's RENDERER has no impasto/relief — it reads as "traced vector art, not oil". That measurement was correct and remains correct.

**What changed:** The user approved `painterly` as a first-class brush style anyway, because its **PLANNER (Hertzmann stroke geometry)** is exactly what gives the curved edge-following strokes the user wanted. The resulting look was preferred.

**Measured evidence for the new role:**
- 400 strokes / 365 curved / 102342 distinct colours / 127 ms render / 0 errors (`scripts/painterly-geometry-probe.cjs`)
- 3264 strokes / 23370 distinct colours / 0 errors (`scripts/painterly-style-probe.cjs`)
- Two-part architecture adopted: the Hertzmann planner provides stroke GEOMETRY (edge-following, curvature-aware, 5 radii coarse→fine, stop-when-matched); the style's multi-bristle fan provides stroke APPEARANCE (8 bristles, spread 0.9, ragged ends, per-bristle colour drift ±14)

**What dli/paint still uniquely offers (and why it is kept):**
- Fluid simulation + true impasto relief (height field + normal shading + GGX specular)
- Per-bristle position/velocity textures with distance/plane/bending constraints
- Wet paint advection through velocity/pressure field
- Splat of pigment + height
- Shading pass (Sobel normals + GGX specular + diffuse) over shared pigment/height texture

**However, dli/paint's colour pipeline is currently BROKEN in this port:**
- `js/engine/dli-paint/shaders/painting.frag`'s `rybToRgb` trilinear RYB LUT is applied to pigment that is ALREADY RGB
- Measured by painting known colours through the real WebGL backend:
  - black (0,0,0) → (238,238,238)
  - red (220,30,30) → (231,61,57) [the only survivor]
  - white (245,245,245) → (155,116,74)
  - yellow (230,200,40) → (139,31,88)
  - green (40,170,60) → (120,138,137)
  - blue (30,30,220) → (218,216,48)
  - frogGreen (161,194,43) → (134,71,110)
- The shader file is byte-identical to upstream dli/paint (diff clean) — the fault is in the PORT's colour handling, not upstream. NOT FIXED.

**Standing rule recorded here:** A research verdict is a measurement of the thing measured, not a permanent ranking. The original analysis correctly measured painterly's renderer (no impasto) and that measurement stands. The user's approval was for the PLANNER, not the renderer, and the two-part architecture reflects that distinction.
