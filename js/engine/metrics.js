/**
 * Perceptual metrics + an independent rasteriser (Phase 5 / Harness H1).
 *
 * The AI style loop (`docs/AI_STYLE_HARNESS.md`) needs to *measure* a render
 * without a browser. This module does that on plain pixel buffers:
 *
 *   1. `rasterizeShapes()` — composite the engine's shape list onto a flat
 *      background, independently of the app renderer, using the same
 *      anti-aliased ellipse-coverage model the optimiser's own paint buffer
 *      uses. Ellipses ("E") are the modular engine's stroke vocabulary.
 *   2. `meanAbsError()` / `simMae()` — the objective the loop optimises.
 *   3. `ssimLuma()` — an independent block-SSIM on luminance, deliberately a
 *      different measurement from MAE, so a proposal cannot game one number.
 *
 * Everything here is pure, deterministic and canvas-free, so it runs under
 * plain `node` and is unit-testable. `.mjs`-style ESM, no dependencies.
 *
 * @module metrics
 */

import { clamp } from '../utils/math.js';

/**
 * Convert an RGBA byte buffer to an interleaved RGB float buffer.
 * @param {Uint8ClampedArray|Uint8Array} pixels
 * @param {number} w
 * @param {number} h
 * @returns {Float32Array} length w·h·3
 */
export function toFloatRGB(pixels, w, h) {
  const n = w * h;
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    out[i * 3] = pixels[o];
    out[i * 3 + 1] = pixels[o + 1];
    out[i * 3 + 2] = pixels[o + 2];
  }
  return out;
}

/**
 * Mean RGB of an RGBA buffer.
 * @param {Uint8ClampedArray|Uint8Array} pixels
 * @returns {[number, number, number]}
 */
export function averageColor(pixels) {
  let r = 0, g = 0, b = 0;
  const n = pixels.length / 4;
  for (let i = 0; i < pixels.length; i += 4) { r += pixels[i]; g += pixels[i + 1]; b += pixels[i + 2]; }
  return [r / n, g / n, b / n];
}

/**
 * Rasterise engine shapes onto a flat background, independently of the app.
 *
 * A shape is modelled as an anti-aliased filled ellipse covering ~1 device
 * pixel at its boundary (the same coverage model as `optimizer.evaluate`), so
 * the measured error reflects what the engine actually places.
 *
 * @param {Array<object>} shapes - engine-format shapes (type 'E').
 * @param {number} w
 * @param {number} h
 * @param {number[]} [background] - [r,g,b]; defaults to mid-grey.
 * @returns {Float32Array} interleaved RGB, length w·h·3
 */
export function rasterizeShapes(shapes, w, h, background = [128, 128, 128]) {
  const n = w * h;
  const buf = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    buf[i * 3] = background[0];
    buf[i * 3 + 1] = background[1];
    buf[i * 3 + 2] = background[2];
  }
  for (const s of shapes) {
    if (!s || (s.type !== 'E' && s.type !== 'B')) continue;
    const p = s.params;
    const cx = p[0], cy = p[1];
    const rx = Math.max(0.1, p[2]), ry = Math.max(0.1, p[3]);
    const rot = p[4] || 0;
    const alpha = s.alpha !== undefined ? s.alpha : 1;
    const c0 = s.color0 || [0, 0, 0];
    const cos = Math.cos(rot), sin = Math.sin(rot);
    const mR = Math.max(0.5, Math.min(rx, ry));
    const R = Math.max(rx, ry) + 1;
    const x0 = Math.max(0, Math.floor(cx - R)), x1 = Math.min(w - 1, Math.ceil(cx + R));
    const y0 = Math.max(0, Math.floor(cy - R)), y1 = Math.min(h - 1, Math.ceil(cy + R));
    for (let py = y0; py <= y1; py++) {
      const dy = py + 0.5 - cy;
      const row = py * w;
      for (let px = x0; px <= x1; px++) {
        const dx = px + 0.5 - cx;
        const u = dx * cos + dy * sin;
        const v = -dx * sin + dy * cos;
        const rr = Math.sqrt((u * u) / (rx * rx) + (v * v) / (ry * ry));
        const a = clamp(0.5 + (1 - rr) * mR, 0, 1) * alpha;
        if (a <= 0.0005) continue;
        const o = (row + px) * 3;
        buf[o] = buf[o] * (1 - a) + c0[0] * a;
        buf[o + 1] = buf[o + 1] * (1 - a) + c0[1] * a;
        buf[o + 2] = buf[o + 2] * (1 - a) + c0[2] * a;
      }
    }
  }
  return buf;
}

/**
 * Mean absolute RGB error between two interleaved RGB float buffers.
 * @param {Float32Array} a
 * @param {Float32Array} b
 * @returns {number} MAE in [0, 255]
 */
export function meanAbsError(a, b) {
  const n = a.length / 3;
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
  return s / (3 * n);
}

/**
 * The engine's own objective from an MAE: `100·(1 − MAE/255)`.
 * @param {number} mae
 * @returns {number}
 */
export function simMae(mae) {
  return 100 * (1 - mae / 255);
}

/**
 * Block SSIM (8×8, standard constants) on luminance, over interleaved RGB float
 * buffers. Independent of MAE by construction.
 *
 * @param {Float32Array} a
 * @param {Float32Array} b
 * @param {number} w
 * @param {number} h
 * @returns {number} mean SSIM in [-1, 1]
 */
export function ssimLuma(a, b, w, h) {
  const lum = (px) => {
    const L = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
      L[i] = 0.2126 * px[i * 3] + 0.7152 * px[i * 3 + 1] + 0.0722 * px[i * 3 + 2];
    }
    return L;
  };
  const A = lum(a), B = lum(b);
  const C1 = 6.5025, C2 = 58.5225; // (0.01·255)², (0.03·255)²
  let sum = 0, blocks = 0;
  for (let by = 0; by + 8 <= h; by += 8) {
    for (let bx = 0; bx + 8 <= w; bx += 8) {
      let sa = 0, sb = 0;
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        const i = (by + y) * w + bx + x; sa += A[i]; sb += B[i];
      }
      const N = 64, ma = sa / N, mb = sb / N;
      let va = 0, vb = 0, cov = 0;
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        const i = (by + y) * w + bx + x;
        const da = A[i] - ma, db = B[i] - mb;
        va += da * da; vb += db * db; cov += da * db;
      }
      va /= N; vb /= N; cov /= N;
      sum += ((2 * ma * mb + C1) * (2 * cov + C2)) / ((ma * ma + mb * mb + C1) * (va + vb + C2));
      blocks++;
    }
  }
  return blocks ? sum / blocks : 0;
}

/**
 * Compare a rendered RGB buffer against a target RGBA byte buffer.
 *
 * @param {Float32Array} rendered - interleaved RGB
 * @param {Uint8ClampedArray|Uint8Array} targetPixels - RGBA
 * @param {number} w
 * @param {number} h
 * @returns {{mae: number, simMae: number, ssim: number}}
 */
export function metricsVsTarget(rendered, targetPixels, w, h) {
  const target = toFloatRGB(targetPixels, w, h);
  const mae = meanAbsError(rendered, target);
  return { mae, simMae: simMae(mae), ssim: ssimLuma(rendered, target, w, h) };
}

export default {
  toFloatRGB, averageColor, rasterizeShapes, meanAbsError, simMae, ssimLuma, metricsVsTarget,
};
