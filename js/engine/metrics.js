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

/**
 * Mask-weighted block SSIM (8×8) on luminance (Phase 2.2, layer-aware scoring).
 *
 * Same block statistics as {@link ssimLuma}, but each block contributes to the
 * mean in proportion to its **mean mask weight**. A band covering 22 % of the
 * frame is therefore measured on its own pixels only and cannot be diluted by
 * the other 78 %. Returns 0 when the mask covers nothing.
 *
 * @param {Float32Array} a interleaved RGB (rendered)
 * @param {Float32Array} b interleaved RGB (target)
 * @param {number} w
 * @param {number} h
 * @param {Float32Array} weight per-pixel 0..1
 * @returns {number} weighted mean SSIM in [-1, 1]
 */
export function weightedSsimLuma(a, b, w, h, weight) {
  const lum = (px) => {
    const L = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
      L[i] = 0.2126 * px[i * 3] + 0.7152 * px[i * 3 + 1] + 0.0722 * px[i * 3 + 2];
    }
    return L;
  };
  const A = lum(a), B = lum(b);
  const C1 = 6.5025, C2 = 58.5225; // (0.01·255)², (0.03·255)²
  let sum = 0, wsum = 0;
  for (let by = 0; by + 8 <= h; by += 8) {
    for (let bx = 0; bx + 8 <= w; bx += 8) {
      let sa = 0, sb = 0, bw = 0;
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        const i = (by + y) * w + bx + x;
        sa += A[i]; sb += B[i]; bw += weight[i];
      }
      bw /= 64; // block weight = mean mask over the block
      if (bw <= 0) continue; // block entirely outside this band
      const N = 64, ma = sa / N, mb = sb / N;
      let va = 0, vb = 0, cov = 0;
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        const i = (by + y) * w + bx + x;
        const da = A[i] - ma, db = B[i] - mb;
        va += da * da; vb += db * db; cov += da * db;
      }
      va /= N; vb /= N; cov /= N;
      sum += bw * ((2 * ma * mb + C1) * (2 * cov + C2)) / ((ma * ma + mb * mb + C1) * (va + vb + C2));
      wsum += bw;
    }
  }
  return wsum ? sum / wsum : 0;
}

/**
 * Masked perceptual metrics (Phase 2.2, layer-aware scoring).
 *
 * Computes {@link meanAbsError} / {@link simMae} / {@link weightedSsimLuma}
 * over **only the pixels a soft mask selects**, weighting each pixel by its mask
 * value. A mask of all ones reproduces the whole-frame numbers exactly, so a
 * band score is comparable with the frame score and with the other bands.
 *
 * @param {Float32Array} rendered interleaved RGB
 * @param {Float32Array} target interleaved RGB
 * @param {Float32Array} weight per-pixel 0..1 (a tonal mask)
 * @param {number} w
 * @param {number} h
 * @returns {{mae: number, simMae: number, ssim: number, support: number}}
 *   `support` = mean mask weight (0..1) — how much of the frame the band covers.
 */
export function maskedMetrics(rendered, target, weight, w, h) {
  const n = w * h;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    const a = weight[i];
    if (a <= 0) continue;
    const o = i * 3;
    num += a * (
      Math.abs(rendered[o] - target[o]) +
      Math.abs(rendered[o + 1] - target[o + 1]) +
      Math.abs(rendered[o + 2] - target[o + 2])
    );
    den += a * 3;
  }
  const mae = den > 0 ? num / den : 0;
  const ssim = weightedSsimLuma(rendered, target, w, h, weight);
  return { mae, simMae: simMae(mae), ssim, support: den / (3 * n) };
}

/**
 * Convenience wrapper: {@link maskedMetrics} taking RGBA target bytes.
 * @param {Float32Array} rendered interleaved RGB
 * @param {Uint8ClampedArray|Uint8Array} targetPixels RGBA
 * @param {Float32Array} weight per-pixel 0..1
 * @param {number} w
 * @param {number} h
 * @returns {{mae: number, simMae: number, ssim: number, support: number}}
 */
export function maskedMetricsVsTarget(rendered, targetPixels, weight, w, h) {
  return maskedMetrics(rendered, toFloatRGB(targetPixels, w, h), weight, w, h);
}

/**
 * Convert interleaved float RGB (the rasteriser's output) back to RGBA bytes,
 * so a rendered frame can be handed to the same analyser the references use.
 * @param {Float32Array} floatRGB interleaved RGB, 0..255
 * @param {number} w
 * @param {number} h
 * @returns {Uint8ClampedArray} RGBA
 */
export function toRGBA(floatRGB, w, h) {
  const n = w * h;
  const out = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) {
    const o = i * 3, p = i * 4;
    out[p] = floatRGB[o];
    out[p + 1] = floatRGB[o + 1];
    out[p + 2] = floatRGB[o + 2];
    out[p + 3] = 255;
  }
  return out;
}

/* ─── Style-match metrics (Track-S S2) ──────────────────────────────────────
 *
 * Everything above measures **content reconstruction** — how much the render
 * looks like the photo. These measure **style match** — whether the stroke
 * language resembles the reference's. Both sides of a comparison are
 * `RefPacket`s (`ref-analyze.js`, Track-S S1): one built from the reference
 * image, one from a raster of the render, so the comparison is like-for-like
 * and needs no second analysis pass.
 *
 * All pure, deterministic, node-testable; no DOM, no canvas.
 */

/**
 * Normalise a bin array to a distribution (sums to 1). An empty or all-zero
 * input becomes uniform — "no opinion" — rather than a distance spike.
 * @param {Array<number>|Float64Array} bins
 * @returns {number[]}
 */
function normaliseBins(bins) {
  const n = bins ? bins.length : 0;
  if (!n) return [];
  let total = 0;
  for (let i = 0; i < n; i++) total += bins[i] > 0 ? bins[i] : 0;
  const out = new Array(n);
  for (let i = 0; i < n; i++) out[i] = total > 0 ? (bins[i] > 0 ? bins[i] : 0) / total : 1 / n;
  return out;
}

/**
 * L1 distance between two histograms as distributions, halved so the range is
 * 0 (identical shape) .. 1 (disjoint). Scale-invariant: raw counts and
 * already-normalised frequencies give the same answer.
 * @returns {number} 0..1
 */
export function histogramDistance(a, b) {
  const A = normaliseBins(a), B = normaliseBins(b);
  const n = Math.max(A.length, B.length);
  if (!n) return 0;
  let s = 0;
  for (let i = 0; i < n; i++) s += Math.abs((A[i] || 0) - (B[i] || 0));
  return Math.max(0, Math.min(1, s / 2));
}

/**
 * Agreement between two orientation histograms, 1 = the same distribution.
 *
 * The packets' bins span **[0, PI)** — a tangent has no arrowhead, so θ and
 * θ+PI are the same line — which makes `cos(2·Δθ)` the rotation-aware kernel to
 * compare them with: identical directions score +1, a 45° difference is neutral
 * (0), and a 90° difference is anti. Neighbouring bins across the wrap compare
 * correctly for free (cosine is even and 2π-periodic).
 *
 * The kernel is `K(a,b) = Σᵢⱼ aᵢbⱼ cos(2·Δθᵢⱼ)`; K is a Gram matrix (it is
 * `cos(2θᵢ)cos(2θⱼ) + sin(2θᵢ)sin(2θⱼ)`, rank ≤ 2, hence PSD), so the score is
 * normalised by the kernel SELF-PRODUCTS — `K(a,b) / sqrt(K(a,a)·K(b,b))` —
 * which Cauchy–Schwarz bounds to [−1, 1]. Identity therefore gives exactly 1 for
 * ANY distribution, broad or delta. (Track-S hygiene H-S5: dividing by the raw
 * mass `Σᵢⱼ aᵢbⱼ` instead — the former behaviour — is a weighted mean of cos(2Δθ),
 * which penalises SPREAD: two IDENTICAL broad histograms scored ~0.5, so
 * `refPacketDistance(p, p)` was ~0.12 and `styleMatch` could never reach 1.)
 * Delta histograms are unaffected (K = 1 for a unit bin), so every pre-H-S5
 * expectation that compared spikes still holds.
 *
 * @param {Array<number>} aBins 0..1 frequencies (or raw weights)
 * @param {Array<number>} bBins
 * @returns {number} 0..1
 */
function orientationKernel(X, Y, n, step) {
  let s = 0;
  for (let i = 0; i < n; i++) {
    const xi = X[i] || 0;
    if (xi === 0) continue;
    for (let j = 0; j < n; j++) {
      const yj = Y[j] || 0;
      if (yj === 0) continue;
      s += xi * yj * Math.cos(2 * (i - j) * step);
    }
  }
  return s;
}

export function orientationMatch(aBins, bBins) {
  const A = normaliseBins(aBins), B = normaliseBins(bBins);
  const n = Math.max(A.length, B.length);
  if (!n) return 0;
  const step = Math.PI / n;
  const num = orientationKernel(A, B, n, step);
  const den = Math.sqrt(
    Math.max(0, orientationKernel(A, A, n, step))
    * Math.max(0, orientationKernel(B, B, n, step)),
  );
  const s = den > 0 ? num / den : 0;
  return Math.max(0, Math.min(1, (1 + s) / 2));
}

/**
 * Mean absolute difference between two `{name: 0..1}` maps (the packets'
 * `strokeScaleByBand`). Missing keys count as 0, so a dropped band is a
 * difference, not a free pass.
 * @returns {number} 0..1
 */
export function valueMapDistance(a, b) {
  const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  if (!keys.size) return 0;
  let s = 0;
  for (const k of keys) s += Math.abs(((a && a[k]) || 0) - ((b && b[k]) || 0));
  return Math.max(0, Math.min(1, s / keys.size));
}

/** Default weights for {@link refPacketDistance}. Sum to 1. */
export const STYLE_MATCH_WEIGHTS = Object.freeze({
  scale: 0.30,        // stroke-scale histogram (per-cell implied scale)
  orientation: 0.25,  // orientation distribution
  coverage: 0.20,     // tonal band occupancy
  bandScale: 0.15,    // implied scale within each band
  coherence: 0.10,    // mean anisotropy of the structure tensor
});

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

/**
 * Distance between two `RefPacket`s: 0 = the two images have the same stroke
 * language, 1 = nothing in common. The per-term breakdown is returned too — a
 * composite that only reports its total cannot be debugged.
 *
 * @param {object} a RefPacket (reference or result)
 * @param {object} b RefPacket
 * @param {object} [weights] overrides for {@link STYLE_MATCH_WEIGHTS}
 * @returns {{distance: number, parts: object, weights: object}}
 */
export function refPacketDistance(a, b, weights = {}) {
  if (!a || !b) throw new Error('refPacketDistance: two RefPackets are required');
  const w = { ...STYLE_MATCH_WEIGHTS, ...weights };
  const coverageKeys = (p) => {
    const c = (p && p.coverage) || {};
    return Object.keys(c).sort().map((k) => c[k]); // sorted → order-independent
  };
  const parts = {
    scale: histogramDistance(a.scaleHistogram, b.scaleHistogram),
    orientation: 1 - orientationMatch(
      a.orientationField && a.orientationField.bins,
      b.orientationField && b.orientationField.bins,
    ),
    coverage: histogramDistance(coverageKeys(a), coverageKeys(b)),
    bandScale: valueMapDistance(a.strokeScaleByBand, b.strokeScaleByBand),
    coherence: Math.min(1, Math.abs(
      ((a.stats && a.stats.meanCoherence) || 0) - ((b.stats && b.stats.meanCoherence) || 0),
    )),
  };
  let num = 0, den = 0;
  for (const k of Object.keys(parts)) {
    const wk = Math.abs(w[k] || 0);
    num += wk * parts[k];
    den += wk;
  }
  return { distance: clamp01(den > 0 ? num / den : 0), parts, weights: w };
}

/**
 * Style-match score: `1 - distance`, so 1 is a perfect style match.
 * @returns {number} 0..1
 */
export function refPacketMatch(a, b, weights = {}) {
  return 1 - refPacketDistance(a, b, weights).distance;
}

export default {
  toFloatRGB, averageColor, rasterizeShapes, meanAbsError, simMae, ssimLuma, metricsVsTarget,
  weightedSsimLuma, maskedMetrics, maskedMetricsVsTarget,
  toRGBA, histogramDistance, orientationMatch, valueMapDistance,
  STYLE_MATCH_WEIGHTS, refPacketDistance, refPacketMatch,
};
