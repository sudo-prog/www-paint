/**
 * wash.js — Wash style.
 *
 * Algorithm: very translucent broad color with soft feathered edges and
 * heavy overlap darkening. A wash is a dilute paint applied in broad
 * strokes — the paper shows through, and each additional pass darkens
 * the area where strokes overlap.
 *
 * For strokes (S-type): a soft-edged ribbon at very low opacity (0.12–0.18).
 * Multiple passes along the same path build up density. Edges are feathered
 * using a radial gradient.
 * For area fills (E/B/T/R): a broad translucent fill with a soft radial
 * gradient that's lighter near the center and darker toward the rim,
 * simulating pooled wash pigment.
 *
 * Reference: RE_BREAKDOWN.md §4.2, watercolor/wash painting technique
 */

import {
  hexRgb, rngFor, gaussR, lerp, clamp01,
  quadPts, normalAt, boxOf, shapePoly, outlinePath,
  shade2, mixHex, rgbaOf, rgbToHex
} from './base.js';
import { stampStrokeSync, isBrushReady } from '../engine/brush-stamp-engine.js';
import { resolveMedia, toStampOptions, isKnownBrushName } from '../engine/brush-media.js';

/** Resolve the stamp colour for a shape as an RGB array. */
function stampColor(shape) {
  const [c0] = resolveColors(shape);
  const rgb = typeof hexRgb === 'function' ? hexRgb(c0) : null;
  return Array.isArray(rgb) ? rgb : [0, 0, 0];
}


/**
 * Resolve colors from a shape (supports both engine and style formats).
 * @param {object} shape
 * @returns {[string, string, number]}
 */
function resolveColors(shape) {
  if (Array.isArray(shape.color0) || Array.isArray(shape.color1)) {
    const c0 = Array.isArray(shape.color0) ? rgbToHex(shape.color0) : (typeof shape.color0 === 'string' ? shape.color0 : '#000000');
    const c1 = Array.isArray(shape.color1) ? rgbToHex(shape.color1) : (typeof shape.color1 === 'string' ? shape.color1 : '#000000');
    const o = typeof shape.alpha === 'number' ? shape.alpha : 1;
    return [c0, c1, o];
  }
  const a = shape.params;
  const i = shape.type === 'S' ? 8 : 5;
  const c0 = a[i];
  const c1 = a[i + 1];
  const o = a[a.length - 1];
  return [
    Array.isArray(c0) ? '#' + c0.map(v => Math.round(v).toString(16).padStart(2, '0')).join('') : (typeof c0 === 'string' ? c0 : '#000000'),
    Array.isArray(c1) ? '#' + c1.map(v => Math.round(v).toString(16).padStart(2, '0')).join('') : (typeof c1 === 'string' ? c1 : '#000000'),
    typeof o === 'number' ? o : 1
  ];
}

export class WashStyle {
  name = 'wash';
  category = 'paint';
  description = 'Wash: very translucent broad color with soft feathered edges. Overlap darkens naturally — each pass deposits a thin layer of diluted pigment, building up density where strokes cross.';

  defaults = {
    strokeSize: { min: 8, max: 40 },
    opacity: 0.15,          // very translucent base layer
    feather: 0.3,           // edge feathering as fraction of width
    passes: 4,              // overlapping passes for buildup
    passAlpha: 0.22,        // alpha per pass (cumulative = heavier overlaps)
    // M12: real wash pools unevenly — pigment granulates, and a wet edge
    // darkens as it dries. Both were missing, so a wash read as flat colour.
    granulation: 0.22,      // speckle strength (0 = off)
    granulationCount: 90,   // speckles per stroke
    tideDarken: 0.18,       // rim darkening at the drying edge
    tideWidth: 0.12,        // rim width as fraction of stroke width
    minRegionArea: 200
  };

  generate(analyzer, params) {
    const cfg = { ...this.defaults, ...params };
    const strokes = [];

    if (analyzer && analyzer.edges && analyzer.edges.length > 0) {
      for (const edge of analyzer.edges) {
        const color = analyzer.sampleColor(edge.cx, edge.cy);
        strokes.push(this._makeStroke(edge, color));
      }
    }

    if (analyzer && analyzer.regions) {
      for (const region of analyzer.regions) {
        if (region.area < (cfg.minRegionArea || 200)) continue;
        const color = analyzer.sampleColor(region.cx, region.cy);
        strokes.push(this._makePool(region, color));
      }
    }

    return strokes;
  }

  /**
   * Build a candidate stroke shape from an edge.
   * Uses seeded RNG (rngFor) for deterministic stroke-width.
   */
  _makeStroke(edge, color) {
    const c = Array.isArray(color) ? color : [color, color, color];
    const R = rngFor(edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, 0, 0]);
    const w = lerp(this.defaults.strokeSize.min, this.defaults.strokeSize.max, R());
    return {
      type: 'S',
      params: [edge.x0, edge.y0, edge.cx, edge.cy, edge.x1, edge.y1, w, 0, c, c, 1],
      color0: c,
      color1: c,
      alpha: 1,
      seed: edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, w, 0]
    };
  }

  _makePool(region, color) {
    const c = Array.isArray(color) ? color : [color, color, color];
    return {
      type: 'E',
      params: [region.cx, region.cy, region.w / 2, region.h / 2, 0, c, c, 1],
      color0: c,
      color1: c,
      alpha: 1,
      seed: [region.cx, region.cy, region.w, region.h]
    };
  }

  render(ctx, shape, progress = 1) {
    const [c0, c1, o] = resolveColors(shape);
    const a = shape.params;
    const R = rngFor(shape.seed || a.slice(0, 8));

    // Enhanced path (Phase 1.1): real p5.brush tip dynamics when available.
    // Falls through to the custom renderer when the brush is unavailable.
    if (isBrushReady() && shape.type === 'S') {
      const media = resolveMedia('wash');
      if (isKnownBrushName(media.brushName)) {
      const ok = stampStrokeSync(ctx, shape, toStampOptions(media, {
        color: stampColor(shape),
        alpha: o,
        size: a[6],
        progress,
      }));
        if (ok) return;
      }
    }

    if (shape.type === 'S') {
      this._renderStroke(ctx, shape, R, c0, c1, o, progress);
    } else {
      this._renderPool(ctx, shape, R, c0, c1, o, progress);
    }
  }

  /**
   * Render a wash stroke: multiple translucent soft-edged ribbons.
   * Each pass is offset slightly and at reduced alpha, so overlaps
   * accumulate darkness naturally.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} shape
   * @param {function} R - Seeded RNG
   * @param {string} c0, c1
   * @param {number} o - Opacity
   * @param {number} progress - 0..1
   */
  _renderStroke(ctx, shape, R, c0, c1, o, progress) {
    const a = shape.params;
    const w = Math.max(4, a[6]);
    const P = quadPts(a, progress, 1, 24);
    const n = P.length;
    if (n < 3) return;

    const feather = w * this.defaults.feather;

    ctx.save();
    ctx.lineCap = ctx.lineJoin = 'round';

    // The full-width ribbon, reused for the tide line / granulation clip below.
    // (The pass loop builds its own per-pass offset bands.)
    const hw = w / 2;
    const band = new Path2D();
    for (let i = 0; i < n; i++) {
      const [nx, ny] = normalAt(P, i);
      if (i === 0) band.moveTo(P[i][0] + nx * hw, P[i][1] + ny * hw);
      else band.lineTo(P[i][0] + nx * hw, P[i][1] + ny * hw);
    }
    for (let i = n - 1; i >= 0; i--) {
      const [nx, ny] = normalAt(P, i);
      band.lineTo(P[i][0] - nx * hw, P[i][1] - ny * hw);
    }
    band.closePath();

    // Multiple soft-edged passes — offset for natural wash buildup
    const passes = this.defaults.passes;
    for (let p = 0; p < passes; p++) {
      const jx = (R() - 0.5) * w * 0.08;
      const jy = (R() - 0.5) * w * 0.08;
      const pw = w + feather * 2;

      // Soft radial-edge ribbon via a clipped gradient stroke
      // Build a thick path then stroke with a soft brush
      const band = new Path2D();
      const hw = pw / 2;
      for (let i = 0; i < n; i++) {
        const [nx, ny] = normalAt(P, i);
        if (i === 0) band.moveTo(P[i][0] + nx * hw + jx, P[i][1] + ny * hw + jy);
        else band.lineTo(P[i][0] + nx * hw + jx, P[i][1] + ny * hw + jy);
      }
      for (let i = n - 1; i >= 0; i--) {
        const [nx, ny] = normalAt(P, i);
        band.lineTo(P[i][0] - nx * hw + jx, P[i][1] - ny * hw + jy);
      }
      band.closePath();

      // Use a softer, lighter colour with heavy transparency
      ctx.globalAlpha = o * this.defaults.opacity * this.defaults.passAlpha * (0.85 + p * 0.05);
      ctx.fillStyle = c0;
      ctx.fill(band);
    }

    // Soft blur on the final result for the feathered edge
    ctx.filter = `blur(${feather * 0.4}px)`;
    ctx.globalAlpha = o * this.defaults.opacity * 0.5;
    ctx.fillStyle = c0;
    ctx.fillRect(
      Math.min(...P.map(p => p[0])) - feather,
      Math.min(...P.map(p => p[1])) - feather,
      Math.max(...P.map(p => p[0])) - Math.min(...P.map(p => p[0])) + feather * 2,
      Math.max(...P.map(p => p[1])) - Math.min(...P.map(p => p[1])) + feather * 2
    );
    ctx.filter = 'none';

    // --- M12: tide line + granulation ---
    // A drying wash leaves a darker rim where the pigment collected, and
    // speckles where it granulated. Clip to the same ribbon so neither leaks.
    ctx.save();
    ctx.clip(band);

    // Tide line: a darker stroke just inside the outer edge.
    // NOTE: this must NOT be scaled by `opacity` — a wash stroke runs at
    // opacity 0.15, so an alpha of opacity*tideDarken*2 (~0.05) is invisible.
    // Scale it off the base alpha so the rim actually reads.
    ctx.globalAlpha = Math.min(1, o * (0.35 + this.defaults.tideDarken * 2));
    ctx.strokeStyle = shade2(c0, -this.defaults.tideDarken);
    ctx.lineWidth = Math.max(0.5, w * this.defaults.tideWidth);
    for (const side of [0.72, -0.72]) {
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const [nx, ny] = normalAt(P, i);
        const px = P[i][0] + nx * (hw * side);
        const py = P[i][1] + ny * (hw * side);
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    // Granulation: seeded speckles, denser toward the middle of the stroke.
    ctx.globalAlpha = Math.min(1, o * (0.4 + this.defaults.granulation));
    ctx.fillStyle = shade2(c0, -0.22);
    const speckles = Math.round(this.defaults.granulationCount * (w / 20));
    for (let gIdx = 0; gIdx < speckles; gIdx++) {
      const gi = Math.floor(R() * (n - 1));
      const [nx, ny] = normalAt(P, gi);
      const off = gaussR(R) * hw * 0.6;
      const gx = P[gi][0] + nx * off;
      const gy = P[gi][1] + ny * off;
      const gr = Math.max(0.3, w * 0.012 * (0.5 + R()));
      ctx.beginPath();
      ctx.arc(gx, gy, gr, 0, 7);
      ctx.fill();
    }
    ctx.restore();

    ctx.restore();
  }

  /**
   * Render a wash pool (for E/B/T/R shapes).
   * Soft radial gradient: light at center, darker toward rim (pooled pigment).
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} shape
   * @param {function} R - Seeded RNG
   * @param {string} c0
   * @param {string} c1
   * @param {number} o
   */
  _renderPool(ctx, shape, R, c0, c1, o) {
    const P = shapePoly(shape);
    const b = boxOf(P);
    const r = Math.max(1, Math.max(b.w, b.h) / 2);

    // Radial gradient: light at center, darker toward edge (pooled wash)
    const G = ctx.createRadialGradient(b.cx, b.cy, 0, b.cx, b.cy, r);
    G.addColorStop(0, rgbaOf(c0, o * this.defaults.opacity * 0.5));
    G.addColorStop(0.6, rgbaOf(mixHex(c0, c1, 0.2), o * this.defaults.opacity * 0.7));
    G.addColorStop(1, rgbaOf(shade2(c0, -0.1), o * this.defaults.opacity));

    ctx.save();
    outlinePath(ctx, shape);
    ctx.clip();
    ctx.fillStyle = G;
    ctx.fillRect(b.cx - r - 2, b.cy - r - 2, r * 2 + 4, r * 2 + 4);
    ctx.restore();
  }
}

export default WashStyle;
