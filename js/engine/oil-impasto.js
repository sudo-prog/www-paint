/**
 * oil-impasto.js — Deterministic height-field impasto backend for WWW_PAINT's OIL style.
 *
 * Technique inspired by dli/paint "Fluid Paint" by David Li (MIT Licence):
 *   https://github.com/dli/paint
 *   - Paint texture stores PIGMENT in RGB and HEIGHT in ALPHA
 *   - Separate rendering pass computes Sobel gradient of height field
 *   - Builds surface normal from gradient
 *   - Shades pigment with physically-based diffuse+specular (GGX-style) model
 *
 * Our implementation:
 *   - Pure 2D canvas (no WebGL dependency) — works in --disable-gpu headless harness
 *   - Offscreen canvas for height field + pigment buffers
 *   - Deterministic: all randomness from project's seeded rngFor (from ../styles/base.js)
 *   - Bristle channels: height/pigment deposit varies across brush width (ridges/furrows)
 *   - Height does NOT bleed outside stroke footprint
 *   - Idempotent-safe: caller provides surface object that it resets
 *
 * OPTIONAL: When WebGL is available, uses the real dli/paint backend for
 * authentic bristle-separated strokes, pigment mixing, and fluid simulation.
 * Falls back to 2D path automatically.
 *   */

import { rngFor, hexRgb, rgbToHex } from '../styles/base.js';

// ─── dli/paint backend (lazy-loaded) ────────────────────────────────────────

let _dliBackend = null;
let _dliBackendPromise = null;

async function getDliBackend(width, height) {
  if (_dliBackend && _dliBackend.isReady()) {
    if (_dliBackend.offscreenCanvas.width !== width || _dliBackend.offscreenCanvas.height !== height) {
      _dliBackend.resize(width, height);
    }
    return _dliBackend;
  }
  if (!_dliBackendPromise) {
    _dliBackendPromise = (async () => {
      try {
        const { getDliPaintBackend } = await import('./dli-paint-backend.js');
        const backend = await getDliPaintBackend(width, height);
        _dliBackend = backend;
        return backend;
      } catch (e) {
        console.warn('[oil-impasto] dli backend unavailable, using 2D fallback:', e);
        return null;
      }
    })();
  }
  return _dliBackendPromise;
}

function resetDliBackend() {
  if (_dliBackend) {
    _dliBackend.dispose();
    _dliBackend = null;
    _dliBackendPromise = null;
  }
}

// Module-level scratch canvas reused across strokes (see renderOilImpasto).
let _scratchCanvas = null;
let _scratchCtx = null;
// Shared CUMULATIVE paint surface (pigment + height), keyed by target canvas.
// One per canvas so overlapping strokes shade against the paint already down —
// real impasto is a field, not isolated worms. Reset via resetImpastoSurface().
let _sharedSurface = null;

/**
 * Reset the shared impasto surface (call when a render pass starts over —
 * renderer.clear() or a fresh export). Keeps render() idempotent: the same
 * stroke sequence always paints onto a fresh field.
 * @param {CanvasRenderingContext2D} [ctx] - reset only the surface for this canvas
 */
export function resetImpastoSurface(ctx) {
  if (!ctx) { _sharedSurface = null; return; }
  if (_sharedSurface && _sharedSurface.key === ctx.canvas) {
    resetSurface(_sharedSurface);
  }
}

/**
 * Deterministic parameters (matching dli/paint paint.js constants)
 */
export const DEFAULTS = {
  NORMAL_SCALE: 7.0,
  ROUGHNESS: 0.075,
  F0: 0.05,
  SPECULAR_SCALE: 0.5,
  DIFFUSE_SCALE: 0.15,
  LIGHT_DIRECTION: [0, 1, 1], // [x, y, z] - light coming from top-left, slightly behind viewer
  // Bristle channel parameters
  BRISTLE_COUNT: 12,
  BRISTLE_VAR: 0.5,
  HEIGHT_SCALE: 8.0, // max height value — tall enough that stroke-over-stroke
                     // furrows survive the 3x3 soften and visibly tilt the
                     // normals (2.0 left the relief flat after softening)
  HEIGHT_SOFTEN: 0.3, // how much to blur height for smoother normals
  // Rendered-width gain. CP's nominal draw-call width is 2.786 but its ROPES
  // measure 8px on the 512 canvas (measured horizontal-run p50) — the mark is
  // ~2.9x the nominal width once bristle spread and rounded caps are in.
  // Ours rendered ~1:1 (run p50 5px, ink coverage 40% vs CP 67%), which read
  // as wires. 2.5 brings the painted band to CP's measured geometry.
  WIDTH_GAIN: 2.5,
};

/**
 * Compute Sobel gradient of a height field (Float32Array, row-major w*h)
 * Returns {gx: Float32Array, gy: Float32Array} same size
 */
export function computeSobel(height, w, h) {
  const gx = new Float32Array(w * h);
  const gy = new Float32Array(w * h);
  
  // Sobel kernels (3x3)
  // Gx: -1 0 1  -2 0 2  -1 0 1
  // Gy: -1 -2 -1  0 0 0  1 2 1
  
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      // Sample 3x3 neighbourhood
      const tl = height[(y - 1) * w + (x - 1)];
      const t  = height[(y - 1) * w + x];
      const tr = height[(y - 1) * w + (x + 1)];
      const l  = height[y * w + (x - 1)];
      const r  = height[y * w + (x + 1)];
      const bl = height[(y + 1) * w + (x - 1)];
      const b  = height[(y + 1) * w + x];
      const br = height[(y + 1) * w + (x + 1)];
      
      gx[i] = (-1 * tl + 1 * tr + -2 * l + 2 * r + -1 * bl + 1 * br);
      gy[i] = (-1 * tl + -2 * t + -1 * tr + 1 * bl + 2 * b + 1 * br);
    }
  }
  
  return { gx, gy };
}

/**
 * Build surface normals from Sobel gradient
 * Returns Float32Array of normals [nx, ny, nz] per pixel (packed as w*h*3)
 */
export function computeNormals(gx, gy, w, h, normalScale = DEFAULTS.NORMAL_SCALE) {
  const normals = new Float32Array(w * h * 3);
  
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const dx = gx[i];
      const dy = gy[i];
      
      // Normal = normalize([-dx, -dy, normalScale])
      // Note: dli/paint uses (gradient.x, gradient.y, normalScale)
      const len = Math.hypot(dx, dy, normalScale);
      if (len > 0) {
        normals[i * 3] = dx / len;
        normals[i * 3 + 1] = dy / len;
        normals[i * 3 + 2] = normalScale / len;
      } else {
        normals[i * 3] = 0;
        normals[i * 3 + 1] = 0;
        normals[i * 3 + 2] = 1;
      }
    }
  }
  
  return normals;
}

/**
 * Shade pigment with height-normal lit BRDF-like model
 * @param {Uint8ClampedArray} pigment - RGBA pigment buffer (r,g,b in 0..255, a unused)
 * @param {Float32Array} normals - surface normals from computeNormals (packed nx,ny,nz per pixel)
 * @param {number} w - width
 * @param {number} h - height
 * @param {object} opts - shading options
 * @returns {Uint8ClampedArray} shaded RGBA output
 */
export function shadePigment(pigment, normals, w, h, opts = {}) {
  const {
    roughness = DEFAULTS.ROUGHNESS,
    F0 = DEFAULTS.F0,
    specularScale = DEFAULTS.SPECULAR_SCALE,
    diffuseScale = DEFAULTS.DIFFUSE_SCALE,
    lightDirection = DEFAULTS.LIGHT_DIRECTION,
  } = opts;
  
  const out = new Uint8ClampedArray(w * h * 4);
  const lightDir = new Float32Array(lightDirection);
  const lightLen = Math.hypot(lightDir[0], lightDir[1], lightDir[2]);
  if (lightLen > 0) {
    lightDir[0] /= lightLen;
    lightDir[1] /= lightLen;
    lightDir[2] /= lightLen;
  }
  
  // Eye direction is (0, 0, 1) — viewer looks straight at canvas
  const eyeDir = [0, 0, 1];
  
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const pi = i * 4;
      const ni = i * 3;
      
      // Normal at this pixel
      const nx = normals[ni];
      const ny = normals[ni + 1];
      const nz = normals[ni + 2];
      
      // Diffuse: REAL Lambert response. The old nDotL*0.15+0.85 flatlined the
      // shading (every pixel within 15% of albedo no matter how steep the
      // ridge) — the single biggest reason the height field never read as 3D.
      // Ambient floor 0.3 keeps the shadow side of a furrow readable.
      const nDotL = Math.max(0, nx * lightDir[0] + ny * lightDir[1] + nz * lightDir[2]);
      const diffuse = 0.3 + 0.7 * nDotL;

      // Specular: Blinn-Phong SHEEN, not the GGX mirror. GGX at roughness
      // 0.075 spikes D to ~57 at mirror alignment → isolated blown-white
      // pixels (the measured "white worms": 78% of dark strokes >200 lum)
      // with zero gloss everywhere else. Blinn-Phong^32 gives every lit
      // slope a broad glossy band — the continuous sheen real oil has.
      const hx = lightDir[0] + eyeDir[0];
      const hy = lightDir[1] + eyeDir[1];
      const hz = lightDir[2] + eyeDir[2];
      const hLen = Math.hypot(hx, hy, hz);
      const Hx = hx / hLen;
      const Hy = hy / hLen;
      const Hz = hz / hLen;
      const nDotH = Math.max(0, nx * Hx + ny * Hy + nz * Hz);
      const specular = Math.pow(nDotH, 32) * specularScale;
      
      // Coverage of this pixel: the deposit's own coverage channel (pigment
      // alpha, written by depositStroke) OR the max RGB channel — max() of
      // both so legacy callers that fill RGB only still composite correctly,
      // and near-black paint (max(RGB) ≈ 0) stays opaque via its coverage.
      const cov = Math.max(pigment[pi + 3], pigment[pi], pigment[pi + 1], pigment[pi + 2]);
      if (cov === 0) {
        // No paint here — this pixel is NOT part of the stroke and must stay
        // fully transparent, or the opaque offscreen rect erases every
        // previously painted stroke when composited.
        out[pi + 3] = 0;
        continue;
      }

      const r = pigment[pi] / 255;
      const g = pigment[pi + 1] / 255;
      const b = pigment[pi + 2] / 255;

      // CP's gloss formulation (painting.frag): the specular is TINTED with
      // the albedo — `mix(vec3(1.), c, .65) * .35 * spec(...)` — never pure
      // white at full scale. White spec on dark oil blows the mark to lum
      // ~236 (measured: 78% of dark strokes rendered >200); tinted and
      // scaled to 0.35 the mark keeps its colour with a glossy sheen, which
      // is the whole point of the impasto read.
      const specR = specular * (0.35 + 0.65 * r);
      const specG = specular * (0.35 + 0.65 * g);
      const specB = specular * (0.35 + 0.65 * b);

      // Final color: albedo lit by diffuse + ALBEDO-TINTED specular
      const fr = Math.min(1, r * diffuse + specR);
      const fg = Math.min(1, g * diffuse + specG);
      const fb = Math.min(1, b * diffuse + specB);

      out[pi] = Math.round(fr * 255);
      out[pi + 1] = Math.round(fg * 255);
      out[pi + 2] = Math.round(fb * 255);
      out[pi + 3] = cov;
    }
  }
  
  return out;
}

/**
 * Create a bristle profile for a stroke — returns array of {lo, hi, heightMul, pigmentMul, offset}
 * Deterministic, based on seeded RNG
 */
export function createBristleProfile(radius, R, count = DEFAULTS.BRISTLE_COUNT, varAmount = DEFAULTS.BRISTLE_VAR) {
  const profile = [];
  const n = Math.max(4, Math.min(16, Math.round(count)));
  const cuts = [0];
  
  for (let i = 1; i < n; i++) {
    cuts.push(i / n + (R() - 0.5) * varAmount / n);
  }
  cuts.push(1);
  
  for (let i = 0; i < n; i++) {
    const lo = cuts[i];
    const hi = cuts[i + 1];
    const center = (lo + hi) / 2;
    
    // Each bristle gets its own height/pigment multiplier and lateral offset
    profile.push({
      lo,
      hi,
      center,
      heightMul: 0.5 + R() * 1.0,       // 0.5..1.5 - some bristles push more paint
      pigmentMul: 0.6 + R() * 0.8,      // 0.6..1.4 - pigment deposit varies
      offset: (R() - 0.5) * 0.3,        // slight lateral jitter for natural feel
      dryEnd: 0.45 + R() * 0.25,        // where bristle runs dry
      tone: (R() - 0.5) * 0.1,          // per-bristle color variation
    });
  }
  
  return profile;
}

/**
 * Deposit pigment and height along a stroke path into a surface
 * Surface: {width, height, pigment: Uint8ClampedArray(w*h*4), height: Float32Array(w*h)}
 * Returns updated surface (mutated in place)
 */
export function depositStroke(surface, shape, R, opts = {}) {
  const { width, height, pigment, heightField } = surface;
  const w = width;
  const h = height;
  // Optional per-stroke ownership mask (Uint8Array w*h): pixels THIS stroke
  // deposited. Written when provided (shared-surface mode) and used by the
  // renderer to composite only the fresh paint while shading against the
  // cumulative field.
  const own = opts.own || null;
  
  // Parse stroke params: [x0,y0,cx,cy,x1,y1,width,angle,colorA,colorB,alpha]
  const a = shape.params;
  // Rendered-width gain (DEFAULTS.WIDTH_GAIN): the painted band must be
  // ~2.5x the nominal stroke width to match CP's measured rope geometry
  // (nominal 2.8 -> rendered 8px @512). Applied to the deposit only — the
  // shape's params stay untouched so the planner's numbers are preserved.
  const strokeW = Math.max(2, a[6]) * (opts.widthGain ?? DEFAULTS.WIDTH_GAIN);
  const baseColorA = a[8];
  const baseColorB = a[9];
  const progress = opts.progress !== undefined ? opts.progress : 1;
  const alpha = shape.alpha ?? a[10] ?? opts.alpha ?? 1;

  // Sample points along the quadratic bezier, only up to `progress`.
  // Coarse pass first (49 points), then DENSIFY by arc length so stamp
  // spacing is ~0.8px — a fixed 49-sample walk left ~4.4px gaps that rendered
  // every stroke as a dashed string of dots.
  const P = [];
  {
    const N = 48;
    const maxS = Math.max(0, Math.min(1, progress));
    const coarse = [];
    for (let i = 0; i <= N; i++) {
      const s = (i / N) * maxS;
      const v = 1 - s;
      coarse.push([
        v * v * a[0] + 2 * v * s * a[2] + s * s * a[4],
        v * v * a[1] + 2 * v * s * a[3] + s * s * a[5]
      ]);
    }
    // Total polyline length → per-segment subdivision count.
    let total = 0;
    for (let i = 1; i < coarse.length; i++) {
      total += Math.hypot(coarse[i][0] - coarse[i - 1][0], coarse[i][1] - coarse[i - 1][1]);
    }
    const STEP = 0.8; // px between stamps
    P.push(coarse[0]);
    for (let i = 1; i < coarse.length; i++) {
      const [ax, ay] = coarse[i - 1];
      const [bx, by] = coarse[i];
      const seg = Math.hypot(bx - ax, by - ay);
      const n = Math.max(1, Math.round(seg / STEP));
      for (let k = 1; k <= n; k++) {
        P.push([ax + (bx - ax) * k / n, ay + (by - ay) * k / n]);
      }
    }
    void total;
  }
  
  // Bristle colour endpoints must be hex strings ('#rrggbb'); params may
  // carry either arrays or hex strings, so normalise both.
  const colA = Array.isArray(baseColorA) ? rgbToHex(baseColorA) : baseColorA;
  const colB = Array.isArray(baseColorB) ? rgbToHex(baseColorB) : baseColorB;
  
  // Create bristle profile
  const bristles = createBristleProfile(strokeW / 2, R);
  
  // For each bristle, deposit along the path. Each bristle occupies its own
  // lateral SLICE of the brush cross-section (br.center spans 0..1 across the
  // stroke width) — without this spread every bristle stacks on the
  // centerline and the "stroke" deposits as a 1px thread (measured: 104px
  // footprint for a 212×13px stroke).
  for (const br of bristles) {
    const brW = Math.max(0.8, strokeW * (br.hi - br.lo));
    
    for (let j = 0; j < P.length; j++) {
      const s = j / Math.max(1, P.length - 1);
      const [px, py] = P[j];
      
      // Normal at this point
      const prev = P[Math.max(0, j - 1)];
      const next = P[Math.min(P.length - 1, j + 1)];
      const dx = next[0] - prev[0];
      const dy = next[1] - prev[1];
      const d = Math.hypot(dx, dy) || 1;
      const nx = -dy / d;
      const ny = dx / d;
      
      // Dry factor
      const dryEnd = br.dryEnd || 0.55;
      const dryTaper = 0.8;
      const dryFactor = s > dryEnd
        ? Math.pow(1 - (s - dryEnd) / (1 - dryEnd), dryTaper)
        : 1;
      
      // Lateral centre of THIS bristle across the brush (px), plus its
      // per-bristle jitter; the bristle's own width tapers as it runs dry.
      const centreOffset = (br.center - 0.5) * strokeW + br.offset * brW;
      const liveW = Math.max(0.4, brW * Math.max(0.3, dryFactor));
      
      // Deposit along the bristle width (multiple samples across)
      const samplesAcross = Math.max(2, Math.ceil(liveW / 1.2));
      for (let k = 0; k < samplesAcross; k++) {
        const t = (k + 0.5) / samplesAcross;
        const offset = centreOffset + (t - 0.5) * liveW;
        
        const ix = Math.round(px + nx * offset);
        const iy = Math.round(py + ny * offset);
        
        if (ix < 0 || ix >= w || iy < 0 || iy >= h) continue;
        
        const idx = iy * w + ix;
        const pIdx = idx * 4;
        
        // Color blend along stroke
        const mixT = br.center;
        const [r0, g0, b0] = hexRgb(colA);
        const [r1, g1, b1] = hexRgb(colB);
        
        const cr = Math.round(r0 + (r1 - r0) * mixT);
        const cg = Math.round(g0 + (g1 - g0) * mixT);
        const cb = Math.round(b0 + (b1 - b0) * mixT);
        
        // Apply per-bristle tone variation
        const tone = br.tone;
        const tr = Math.max(0, Math.min(255, cr + tone * 255));
        const tg = Math.max(0, Math.min(255, cg + tone * 255));
        const tb = Math.max(0, Math.min(255, cb + tone * 255));
        
        // Deposit pigment. On a SHARED surface (cumulative field) the newest
        // stroke's paint WETS OVER the old paint — alpha-blend the fresh
        // colour on top (source-over) rather than adding, so a dark stroke
        // dragged through light paint leaves a dark furrow instead of mud.
        // On a per-stroke surface (options.surface / shared:false) the
        // additive path is preserved byte-for-byte (unit tests pin it).
        const pigmentMul = br.pigmentMul * dryFactor;
        const load = Math.max(0, Math.min(1, pigmentMul)) * 255;
        if (own) {
          // A bristle TOUCH means opaque paint at that pixel — the mark's
          // own footprint is fully covered (the 0.8 stroke alpha is applied
          // at composite). Wet-over-wet blending still uses the deposit's
          // load as the blend weight so light paint dragged through dark
          // shows through proportionally.
          const old = own[idx] > 0 ? 1 : 0;
          const aNew = Math.max(0, Math.min(1, load / 255));
          if (aNew > 0) {
            for (let cc = 0; cc < 3; cc++) {
              const srcC = [tr, tg, tb][cc];
              const dstC = pigment[pIdx + cc];
              pigment[pIdx + cc] = Math.min(255, srcC * aNew + dstC * (1 - aNew) * old);
            }
          }
          own[idx] = 255;
        } else {
          pigment[pIdx] = Math.min(255, pigment[pIdx] + tr * pigmentMul);
          pigment[pIdx + 1] = Math.min(255, pigment[pIdx + 1] + tg * pigmentMul);
          pigment[pIdx + 2] = Math.min(255, pigment[pIdx + 2] + tb * pigmentMul);
        }
        // Coverage lives in the pigment buffer's alpha channel (RGB deposit
        // never touches it): max of this pixel's paint load, clamped 0..255.
        // Dark pigments (near-black oil) then stay opaque — max(RGB) would
        // read them as empty.
        if (load > pigment[pIdx + 3]) pigment[pIdx + 3] = load;
        
        // Deposit height (additive, clamped to HEIGHT_SCALE)
        const heightMul = br.heightMul * dryFactor * alpha;
        const maxHeight = DEFAULTS.HEIGHT_SCALE;
        heightField[idx] = Math.min(maxHeight, heightField[idx] + heightMul);
      }
    }
  }
  
  return surface;
}

/**
 * Soften the height field slightly for smoother normals (simple box blur)
 */
export function softenHeight(height, w, h, radius = 1) {
  const out = new Float32Array(w * h);
  
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      let count = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -radius; dx <= radius; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          sum += height[yy * w + xx];
          count++;
        }
      }
      out[y * w + x] = sum / count;
    }
  }
  
  return out;
}

/**
 * Main render function for the impasto backend
 * @param {CanvasRenderingContext2D} ctx - target canvas context
 * @param {object} shape - stroke shape {type: 'S', params: [...], seed: [...]}
 * @param {object} options - rendering options
 * @returns {object} {ok: true, stats: {pixelsPainted, heightRange, ...}} or {ok: false, reason}
 */
export function renderOilImpasto(ctx, shape, options = {}) {
  try {
    if (shape.type !== 'S') {
      return { ok: false, reason: 'oil-impasto only supports stroke type S' };
    }

    const a = shape.params;
    const canvas = ctx.canvas;
    const W = canvas.width;
    const H = canvas.height;

    // Shared CUMULATIVE paint surface. Real oil paint is a height FIELD: a
    // later bristle drags through earlier paint, leaving furrows — that
    // interaction is the whole dli/paint look. Shading each stroke on its
    // own blank surface (the old behaviour) produces identical isolated
    // worms with no relief history. The surface is keyed per canvas and
    // reset when the renderer starts a fresh pass (see resetImpastoSurface),
    // so render() stays deterministic: same shapes + same pass order → same
    // cumulative field → same pixels.
    let surface;
    if (options.surface) {
      surface = options.surface;
    } else if (options.shared !== false) {
      if (!_sharedSurface || _sharedSurface.key !== canvas || _sharedSurface.width !== W || _sharedSurface.height !== H) {
        _sharedSurface = createSurface(W, H);
        _sharedSurface.key = canvas;
      }
      surface = _sharedSurface;
    } else {
      surface = createSurface(W, H);
    }
    // Per-stroke coverage mask sized to the FULL canvas; cropped surfaces
    // would clip the stroke's soft edges when the deposit lands on the pad.
    // Deposit + height stay full-canvas-cheap (typed-array writes); only the
    // expensive shading is cropped to the stroke's bbox (see below).

    // Bristle RNG: the caller's seeded RNG when provided, else a fresh one
    // from the shape's own seed. Never Math.random.
    const R = options.seed instanceof Function
      ? options.seed
      : rngFor(shape.seed || shape.params.slice(0, 6));

    // Stroke colours: oil.js passes c0/c1 hex in options; shapes may also
    // carry hex strings or [r,g,b] arrays in params[8]/[9]. Normalise
    // everything to hex; fall back to a mid-grey when nothing is usable
    // (undefined params caused "Cannot read 'slice'" crashes before).
    const toHex = (v, fb) => {
      if (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)) return v;
      if (Array.isArray(v) && v.length >= 3 && v.every((c) => Number.isFinite(c))) {
        return rgbToHex(v);
      }
      return fb;
    };
    const colA = toHex(options.color0 ?? a[8], '#808080');
    const colB = toHex(options.color1 ?? a[9], colA);
    a[8] = colA;
    a[9] = colB;

    // Stroke alpha: explicit option > shape alpha > params[10] > 1.
    const alpha = Number.isFinite(options.alpha)
      ? Math.max(0, Math.min(1, options.alpha))
      : Math.max(0, Math.min(1, shape.alpha ?? a[10] ?? 1));

    // Deposit the stroke. In shared mode also record THIS stroke's own
    // footprint so the composite applies only the fresh paint (the pigment/
    // height it lands on is the cumulative field, giving real furrows).
    const isShared = surface === _sharedSurface;
    const own = isShared ? new Uint8Array(W * H) : null;
    depositStroke(surface, shape, R, { ...options, alpha: 1, own });

    // ── Bbox-cropped shading ─────────────────────────────────────────────
    // Compute the stroke's bounding box from the bezier path ± brush radius:
    // shading/Sobel/normals/putImageData then work on a small crop instead of
    // the full canvas (a 40k-stroke painting previously allocated + shaded a
    // full 640×668 buffer per stroke — 100% CPU + browser crash).
    const sw = Math.max(2, a[6]);
    const strokeBBox = (params, halfWidth) => {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let i = 0; i < 49; i++) {
        const s = i / 48;
        const v = 1 - s;
        const x = v * v * params[0] + 2 * v * s * params[2] + s * s * params[4];
        const y = v * v * params[1] + 2 * v * s * params[3] + s * s * params[5];
        x0 = Math.min(x0, x); y0 = Math.min(y0, y);
        x1 = strokeBBox_x1(x1, x); y1 = Math.max(y1, y);
      }
      return [x0 - halfWidth, y0 - halfWidth, x1 + halfWidth, y1 + halfWidth];
    };
    const strokeBBox_x1 = (cur, x) => Math.max(cur, x);
    const [bx0, by0, bx1, by1] = strokeBBox(a, sw);
    const cx0 = Math.max(0, Math.floor(bx0) - 2);
    const cy0 = Math.max(0, Math.floor(by0) - 2);
    const cx1 = Math.min(W - 1, Math.ceil(bx1) + 2);
    const cy1 = Math.min(H - 1, Math.ceil(by1) + 2);
    const cw = cx1 - cx0 + 1;
    const ch = cy1 - cy0 + 1;
    if (cw <= 0 || ch <= 0) {
      return { ok: false, reason: 'oil-impasto: empty stroke bbox' };
    }

    // Crop the pigment + height fields (+ ownership mask) into working buffers.
    const pigmentCrop = new Uint8ClampedArray(cw * ch * 4);
    const heightCrop = new Float32Array(cw * ch);
    const ownCrop = own ? new Uint8Array(cw * ch) : null;
    for (let y = 0; y < ch; y++) {
      const srcRow = (cy0 + y) * W + cx0;
      pigmentCrop.set(surface.pigment.subarray(srcRow * 4, srcRow * 4 + cw * 4), y * cw * 4);
      heightCrop.set(surface.heightField.subarray(srcRow, srcRow + cw), y * cw);
      if (ownCrop) ownCrop.set(own.subarray(srcRow, srcRow + cw), y * cw);
    }

    // Soften + normals + shade on the crop only. The height field is the
    // CUMULATIVE one (earlier strokes' ridges/furrows tilt the normals, so
    // this stroke's shading bends around existing paint — the dli/paint
    // interaction), but in shared mode the composite is masked to THIS
    // stroke's own footprint (ownCrop) so we lay fresh paint without
    // re-painting the strokes already on the canvas.
    // Radius-2 soften: radius 1 kept per-bristle ripple noise, which at
    // 1000+ strokes turned flat regions into shimmer (measured v19: the
    // background read as fabric). Radius 2 keeps the rope-scale relief and
    // kills the bristle-scale noise.
    const softHeight = softenHeight(heightCrop, cw, ch, 2);
    const { gx, gy } = computeSobel(softHeight, cw, ch);
    const normals = computeNormals(gx, gy, cw, ch, DEFAULTS.NORMAL_SCALE);
    const shaded = shadePigment(pigmentCrop, normals, cw, ch, {
      roughness: DEFAULTS.ROUGHNESS,
      F0: DEFAULTS.F0,
      specularScale: DEFAULTS.SPECULAR_SCALE,
      diffuseScale: DEFAULTS.DIFFUSE_SCALE,
      lightDirection: DEFAULTS.LIGHT_DIRECTION,
    });
    if (ownCrop) {
      // Ownership mask: only pixels THIS stroke deposited get painted.
      // Alpha = own coverage; RGB stays the field-shaded colour.
      for (let i = 0; i < cw * ch; i++) {
        shaded[i * 4 + 3] = ownCrop[i];
      }
    }

    // Composite the shaded crop onto the main canvas. Per-pixel alpha (set in
    // shadePigment) keeps pixels outside the stroke footprint transparent, so
    // earlier strokes survive; globalAlpha carries the shape's own opacity.
    if (!_scratchCanvas || _scratchCanvas.width < cw || _scratchCanvas.height < ch) {
      let scratchCanvas;
      try { scratchCanvas = new OffscreenCanvas(cw, ch); } catch (e) { scratchCanvas = null; }
      _scratchCanvas = scratchCanvas || { width: cw, height: ch };
      _scratchCtx = scratchCanvas && scratchCanvas.getContext ? scratchCanvas.getContext('2d') : null;
    }
    const imgData = new Uint8ClampedArray(shaded);
    if (_scratchCtx && typeof _scratchCtx.putImageData === 'function') {
      _scratchCtx.clearRect(0, 0, cw, ch);
      _scratchCtx.putImageData(new ImageData(imgData, cw, ch), 0, 0);
    }
    ctx.save();
    ctx.globalAlpha = alpha;
    if (_scratchCtx && typeof _scratchCtx.drawImage === 'function') {
      ctx.drawImage(_scratchCanvas, 0, 0, cw, ch, cx0, cy0, cw, ch);
    } else if (ctx.drawImage) {
      // try drawing from scratchCanvas as image source if it has width/height
      try { ctx.drawImage(_scratchCanvas, 0, 0, cw, ch, cx0, cy0, cw, ch); } catch (e) {}
    }
    ctx.restore();

    // Stats (over the crop — the only region the stroke touched)
    let pixelsPainted = 0;
    let minHeight = Infinity, maxHeight = -Infinity;
    for (let i = 0; i < cw * ch; i++) {
      const pi = i * 4;
      if (pigmentCrop[pi + 3] > 0 || pigmentCrop[pi] > 0 || pigmentCrop[pi + 1] > 0 || pigmentCrop[pi + 2] > 0) {
        pixelsPainted++;
      }
      const hVal = heightCrop[i];
      if (hVal > 0) {
        minHeight = Math.min(minHeight, hVal);
        maxHeight = Math.max(maxHeight, hVal);
      }
    }

    return {
      ok: true,
      stats: {
        pixelsPainted,
        heightRange: maxHeight > -Infinity ? [minHeight, maxHeight] : [0, 0],
        surface,
      },
    };
  } catch (e) {
    return { ok: false, reason: String(e) };
  }
}

/**
 * Render using the real dli/paint backend (WebGL) when available.
 * Falls back to 2D renderOilImpasto if WebGL is not available or fails.
 * @param {CanvasRenderingContext2D} ctx - target canvas context
 * @param {object} shape - stroke shape {type: 'S', params: [...], seed: [...]}
 * @param {object} options - rendering options
 * @returns {Promise<object>} {ok: true, stats: {...}, backend: 'dli'|'2d'} or {ok: false, reason}
 */
export async function renderOilDli(ctx, shape, options = {}) {
  try {
    // DIAG
    (globalThis.__dliDiag = globalThis.__dliDiag || []).push({ type: shape.type, phase: 'enter' });
    if (shape.type !== 'S') {
      return { ok: false, reason: 'oil-dli only supports stroke type S' };
    }

    const canvas = ctx.canvas;
    const W = canvas.width;
    const H = canvas.height;

    // Try to get dli backend
    const backend = await getDliBackend(W, H);
    if (!backend || backend.isFallback()) {
      // Fallback to 2D path
      const result = renderOilImpasto(ctx, shape, options);
      if (result.ok) result.backend = '2d';
      return result;
    }

    const a = shape.params;

    // Bristle RNG: seeded from shape
    const R = options.seed instanceof Function
      ? options.seed
      : rngFor(shape.seed || shape.params.slice(0, 6));

    // Stroke colours
    const toHex = (v, fb) => {
      if (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)) return v;
      if (Array.isArray(v) && v.length >= 3 && v.every((c) => Number.isFinite(c))) {
        return rgbToHex(v);
      }
      return fb;
    };
    const colA = toHex(options.color0 ?? a[8], '#808080');
    const colB = toHex(options.color1 ?? a[9], colA);

    // Stroke alpha
    const alpha = Number.isFinite(options.alpha)
      ? Math.max(0, Math.min(1, options.alpha))
      : Math.max(0, Math.min(1, shape.alpha ?? a[10] ?? 1));

    // Convert bezier points to dli stroke points
    const points = [];
    // Each point triggers a full fluid-sim frame in the dli backend, so the
    // bezier is sampled sparsely. Upstream paints one point per mouse event
    // (60fps); a batch render does not need that density — the brush has 100
    // bristles and the sim advects the paint between samples.
    const N = 12;
    for (let i = 0; i <= N; i++) {
      const s = i / N;
      const v = 1 - s;
      points.push({
        x: v * v * a[0] + 2 * v * s * a[2] + s * s * a[4],
        y: v * v * a[1] + 2 * v * s * a[3] + s * s * a[5]
      });
    }

    // Paint stroke via dli backend
    const style = { color: { r: parseInt(colA.slice(1, 3), 16), g: parseInt(colA.slice(3, 5), 16), b: parseInt(colA.slice(5, 7), 16), a: alpha }, size: Math.max(5, Math.min(75, a[6] * 2.5)) };
    const strokeResult = await backend.paintStroke(points, style);
    if (strokeResult.fallback) {
      const result = renderOilImpasto(ctx, shape, options);
      if (result.ok) result.backend = '2d';
      globalThis.__dliDiag.push({ phase: 'fallback-stroke' });
      return result;
    }

    // Composite to target canvas
    const compositeResult = await backend.compositeToCanvas(ctx, W, H, alpha);

    globalThis.__dliDiag.push({ phase: 'ok-dli', stats: {
      inkPercent: compositeResult.inkPercent, chroma: compositeResult.chroma,
      reliefRange: compositeResult.reliefRange } });
    return {
      ok: true,
      backend: 'dli',
      stats: {
        pixelsPainted: Math.round(compositeResult.inkPercent * W * H / 100),
        heightRange: [0, compositeResult.reliefRange],
        inkPercent: compositeResult.inkPercent,
        chroma: compositeResult.chroma,
        reliefRange: compositeResult.reliefRange,
        strokes: compositeResult.strokes,
        fallbackCount: compositeResult.fallbackCount
      }
    };
  } catch (e) {
    console.warn('[oil-dli] render failed, falling back to 2D:', e);
    globalThis.__dliDiag.push({ phase: 'exception', msg: String(e).slice(0, 200) });
    const result = renderOilImpasto(ctx, shape, options);
    if (result.ok) result.backend = '2d';
    return result;
  }
}

/**
 * Reset the dli backend (call when starting a fresh render pass)
 */
export function resetOilDli() {
  resetDliBackend();
  // Also reset the 2D shared surface for consistency
  _sharedSurface = null;
}

/**
 * Create a fresh surface for impasto rendering
 */
export function createSurface(w, h) {
  return {
    width: w,
    height: h,
    pigment: new Uint8ClampedArray(w * h * 4),
    heightField: new Float32Array(w * h),
  };
}

/**
 * Reset a surface to blank (caller responsibility between strokes for idempotency)
 */
export function resetSurface(surface) {
  surface.pigment.fill(0);
  surface.heightField.fill(0);
  return surface;
}

/**
 * Pure helper: compute normals from height field (for unit testing)
 */
export function heightToNormals(height, w, h, normalScale = DEFAULTS.NORMAL_SCALE) {
  const { gx, gy } = computeSobel(height, w, h);
  return computeNormals(gx, gy, w, h, normalScale);
}

/**
 * Pure helper: create bristle profile (for unit testing)
 */
export function makeBristleProfile(radius, seed) {
  const R = rngFor(seed);
  return createBristleProfile(radius, R);
}

export default {
  renderOilImpasto,
  renderOilDli,
  resetOilDli,
  createSurface,
  resetSurface,
  depositStroke,
  computeSobel,
  computeNormals,
  shadePigment,
  createBristleProfile,
  heightToNormals,
  makeBristleProfile,
  DEFAULTS,
};