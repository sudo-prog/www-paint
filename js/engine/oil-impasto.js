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
 */

import { rngFor, hexRgb, rgbToHex } from '../styles/base.js';

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
  HEIGHT_SCALE: 2.0, // max height value
  HEIGHT_SOFTEN: 0.3, // how much to blur height for smoother normals
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
      
      // Diffuse: max(0, dot(N, L))
      const nDotL = Math.max(0, nx * lightDir[0] + ny * lightDir[1] + nz * lightDir[2]);
      const diffuse = nDotL * diffuseScale + (1 - diffuseScale);
      
      // Specular (GGX-style)
      // Half vector H = normalize(L + V)
      const hx = lightDir[0] + eyeDir[0];
      const hy = lightDir[1] + eyeDir[1];
      const hz = lightDir[2] + eyeDir[2];
      const hLen = Math.hypot(hx, hy, hz);
      const Hx = hx / hLen;
      const Hy = hy / hLen;
      const Hz = hz / hLen;
      
      // N·H
      const nDotH = Math.max(0, nx * Hx + ny * Hy + nz * Hz);
      // L·H
      const lDotH = Math.max(0, lightDir[0] * Hx + lightDir[1] * Hy + lightDir[2] * Hz);
      
      // GGX D term
      const a2 = roughness * roughness;
      const nDotH2 = nDotH * nDotH;
      const denom = Math.PI * (nDotH2 * (a2 - 1) + 1) * (nDotH2 * (a2 - 1) + 1);
      const D = a2 / denom;
      
      // Smith G term (GGX)
      const nDotV = Math.max(0, nz); // V = (0,0,1)
      const k = (roughness + 1) * (roughness + 1) / 8;
      const Gv = nDotV / (nDotV * (1 - k) + k);
      const Gl = nDotL / (nDotL * (1 - k) + k);
      const G = Gv * Gl;
      
      // Fresnel (Schlick)
      const F = F0 + (1 - F0) * Math.pow(1 - lDotH, 5);
      
      const specular = (D * G * F) * specularScale;
      
      // Get pigment color (0..255)
      const r = pigment[pi] / 255;
      const g = pigment[pi + 1] / 255;
      const b = pigment[pi + 2] / 255;
      
      // Final color
      const fr = Math.min(1, r * diffuse + specular);
      const fg = Math.min(1, g * diffuse + specular);
      const fb = Math.min(1, b * diffuse + specular);
      
      out[pi] = Math.round(fr * 255);
      out[pi + 1] = Math.round(fg * 255);
      out[pi + 2] = Math.round(fb * 255);
      out[pi + 3] = 255;
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
  
  // Parse stroke params: [x0,y0,cx,cy,x1,y1,width,angle,colorA,colorB,alpha]
  const a = shape.params;
  const strokeW = Math.max(2, a[6]);
  const baseColorA = a[8];
  const baseColorB = a[9];
  const progress = opts.progress !== undefined ? opts.progress : 1;
  const alpha = shape.alpha ?? a[10] ?? opts.alpha ?? 1;

  // Sample points along the quadratic bezier, only up to `progress`
  const P = [];
  const N = 48;
  const maxS = Math.max(0, Math.min(1, progress));
  for (let i = 0; i <= N; i++) {
    const s = (i / N) * maxS;
    const v = 1 - s;
    P.push([
      v * v * a[0] + 2 * v * s * a[2] + s * s * a[4],
      v * v * a[1] + 2 * v * s * a[3] + s * s * a[5]
    ]);
  }
  
  // Bristle colour endpoints must be hex strings ('#rrggbb'); params may
  // carry either arrays or hex strings, so normalise both.
  const colA = Array.isArray(baseColorA) ? rgbToHex(baseColorA) : baseColorA;
  const colB = Array.isArray(baseColorB) ? rgbToHex(baseColorB) : baseColorB;
  
  // Create bristle profile
  const bristles = createBristleProfile(strokeW / 2, R);
  
  // For each bristle, deposit along the path
  for (const br of bristles) {
    const brW = strokeW * (br.hi - br.lo);
    const halfBrW = brW / 2;
    
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
      
      // Bristle-specific width with variation
      const hw = halfBrW * Math.max(0.3, dryFactor) * br.heightMul;
      
      // Deposit along the bristle width (multiple samples across)
      const samplesAcross = Math.max(3, Math.ceil(brW / 2));
      for (let k = 0; k < samplesAcross; k++) {
        const t = (k + 0.5) / samplesAcross;
        const offset = (t - 0.5) * 2 * hw + br.offset * hw;
        
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
        
        // Deposit pigment (additive, clamped)
        const pigmentMul = br.pigmentMul * dryFactor * alpha;
        pigment[pIdx] = Math.min(255, pigment[pIdx] + tr * pigmentMul);
        pigment[pIdx + 1] = Math.min(255, pigment[pIdx + 1] + tg * pigmentMul);
        pigment[pIdx + 2] = Math.min(255, pigment[pIdx + 2] + tb * pigmentMul);
        
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
    
    const canvas = ctx.canvas;
    const w = canvas.width;
    const h = canvas.height;
    
    // Create or reuse surface
    let surface = options.surface;
    const ownsSurface = !surface;
    
    if (ownsSurface) {
      // New surface - caller must reset between strokes if they want isolation
      surface = {
        width: w,
        height: h,
        pigment: new Uint8ClampedArray(w * h * 4),
        heightField: new Float32Array(w * h),
      };
    }
    
    const R = rngFor(shape.seed || shape.params.slice(0, 6));
    
    // Deposit the stroke
    depositStroke(surface, shape, R, options);
    
    // Soften height for smoother normals
    const softHeight = softenHeight(surface.heightField, w, h, 1);
    
    // Compute normals
    const { gx, gy } = computeSobel(softHeight, w, h);
    const normals = computeNormals(gx, gy, w, h, DEFAULTS.NORMAL_SCALE);
    
    // Shade the pigment
    const shaded = shadePigment(surface.pigment, normals, w, h, {
      roughness: DEFAULTS.ROUGHNESS,
      F0: DEFAULTS.F0,
      specularScale: DEFAULTS.SPECULAR_SCALE,
      diffuseScale: DEFAULTS.DIFFUSE_SCALE,
      lightDirection: DEFAULTS.LIGHT_DIRECTION,
    });
    
    // Draw to offscreen canvas first (transparent background)
    const offscreenCanvas = new OffscreenCanvas(w, h);
    const offscreenCtx = offscreenCanvas.getContext('2d');
    offscreenCtx.clearRect(0, 0, w, h);
    const imgData = new ImageData(shaded, w, h);
    offscreenCtx.putImageData(imgData, 0, 0);
    
    // Then composite onto the main canvas with proper alpha
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(offscreenCanvas, 0, 0);
    ctx.restore();
    
    // Stats
    let pixelsPainted = 0;
    let minHeight = Infinity, maxHeight = -Infinity;
    for (let i = 0; i < w * h; i++) {
      if (surface.pigment[i * 4 + 3] > 0 || surface.pigment[i * 4] > 0 || surface.pigment[i * 4 + 1] > 0 || surface.pigment[i * 4 + 2] > 0) {
        pixelsPainted++;
      }
      if (surface.heightField[i] > 0) {
        minHeight = Math.min(minHeight, surface.heightField[i]);
        maxHeight = Math.max(maxHeight, surface.heightField[i]);
      }
    }
    
    return {
      ok: true,
      stats: {
        pixelsPainted,
        heightRange: maxHeight > -Infinity ? [minHeight, maxHeight] : [0, 0],
        surface, // returned so caller can chain or reset
      },
    };
  } catch (e) {
    return { ok: false, reason: String(e) };
  }
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