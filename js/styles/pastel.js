/**
 * pastel.js — Soft pastel style.
 *
 * Algorithm: soft chalky grain, light speckle, and soft edges. Pastel is
 * a dry medium — the pigment sits on the paper surface as a powder, which
 * gives it a characteristic chalky texture and soft, blended edges rather
 * than a wet blend.
 *
 * For strokes (S-type): a soft-edged ribbon built from scattered circular
 * stamps, with grain (some stamps skipped) and a chalky matte finish.
 * For area fills (E/B/T/R): a grid of soft circular dots with random
 * radius variation and light colour jitter.
 *
 * Reference: RE_BREAKDOWN.md §4.2 (stamped brush), dry-media technique
 */

import {
  rngFor, gaussR, lerp, clamp01,
  quadPts, normalAt, boxOf, shapePoly, outlinePath,
  shade2, mixHex, rgbToHex
} from './base.js';

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

export class PastelStyle {
  name = 'pastel';
  category = 'draw';
  description = 'Soft pastel: chalky powder with grain, light speckle, and soft blended edges. Dry-medium texture — pigment sits on the paper surface rather than flowing.';

  defaults = {
    strokeSize: { min: 5, max: 22 },
    opacity: 0.78,          // pastel is semi-translucent powder
    speckle: 0.15,           // colour jitter per stamp
    grainSkip: 0.28,         // fraction of stamps skipped (dry-media look)
    stampScatter: 0.65,      // sideways drift of stamps
    softEdge: 0.35,          // edge softness as fraction of stamp radius
    dotSize: 0.7,            // stamp radius as fraction of half-stroke-width
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
        strokes.push(this._makeFill(region, color));
      }
    }

    return strokes;
  }

  _makeStroke(edge, color) {
    const c = Array.isArray(color) ? color : [color, color, color];
    const w = lerp(this.defaults.strokeSize.min, this.defaults.strokeSize.max, Math.random());
    return {
      type: 'S',
      params: [edge.x0, edge.y0, edge.cx, edge.cy, edge.x1, edge.y1, w, 0, c, c, 1],
      color0: c,
      color1: c,
      alpha: 1,
      seed: edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, w, 0]
    };
  }

  _makeFill(region, color) {
    const c = Array.isArray(color) ? color : [color, color, color];
    return {
      type: 'B',
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

    if (shape.type === 'S') {
      this._renderStroke(ctx, shape, R, c0, c1, o, progress);
    } else {
      this._renderFill(ctx, shape, R, c0, c1, o, progress);
    }
  }

  /**
   * Render a pastel stroke: scattered soft circular stamps with grain.
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} shape
   * @param {function} R - Seeded RNG
   * @param {string} c0, c1
   * @param {number} o - Opacity
   * @param {number} progress - 0..1
   */
  _renderStroke(ctx, shape, R, c0, c1, o, progress) {
    const a = shape.params;
    const w = Math.max(2, a[6]);
    const P = quadPts(a, progress, 1, 24);
    const n = P.length;
    if (n < 3) return;

    // Build cumulative arc-length for even stamp distribution
    const cum = [0];
    for (let i = 1; i < n; i++) {
      cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
    }
    const L = cum[n - 1];
    const stampR = w * this.defaults.dotSize * 0.5;
    const step = stampR * 1.6;
    const steps = Math.ceil(L / step);

    ctx.save();
    ctx.lineCap = ctx.lineJoin = 'round';

    let j = 1;
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      if (t > progress) break;

      // Grain: skip some stamps for the dry-media look
      if (R() < this.defaults.grainSkip) continue;

      const d = t * L;
      while (j < n - 2 && cum[j] < d) j++;
      const seg = cum[j] - cum[j - 1] || 1;
      const f = (d - cum[j - 1]) / seg;
      const px = P[j - 1][0] + (P[j][0] - P[j - 1][0]) * f;
      const py = P[j - 1][1] + (P[j][1] - P[j - 1][1]) * f;

      // Scatter sideways
      const [nx, ny] = normalAt(P, j);
      const sc = gaussR(R) * this.defaults.stampScatter * stampR * 0.5;
      const sx = px + nx * sc;
      const sy = py + ny * sc;

      // Stamp radius with jitter
      const r = stampR * (0.7 + R() * 0.6);

      // Colour jitter (speckle)
      const jit = this.defaults.speckle;
      const shadeFactor = (R() - 0.5) * jit;
      const fillCol = shade2(c0, shadeFactor);

      // Soft circular stamp (radial gradient for soft edges)
      const rad = r;
      const innerR = r * this.defaults.softEdge;
      const G = ctx.createRadialGradient(sx, sy, innerR, sx, sy, rad);
      G.addColorStop(0, fillCol);
      G.addColorStop(1, `rgba(0,0,0,0)`); // transparent edge for softness

      ctx.globalAlpha = o * this.defaults.opacity * (0.75 + R() * 0.4);
      ctx.fillStyle = G;
      ctx.beginPath();
      ctx.arc(sx, sy, rad, 0, 7);
      ctx.fill();

      j++;
    }

    ctx.restore();
  }

  /**
   * Render a pastel area fill: grid of soft chalky dots with variation.
   */
  _renderFill(ctx, shape, R, c0, c1, o, progress) {
    const a = shape.params;
    const P = shapePoly(shape);
    const b = boxOf(P);
    const size = Math.max(b.w, b.h, 4);
    const dotRad = Math.max(1.5, size * 0.045);
    const gap = dotRad * 1.8;

    ctx.save();
    ctx.lineCap = ctx.lineJoin = 'round';
    outlinePath(ctx, shape);
    ctx.clip();

    ctx.globalAlpha = o * this.defaults.opacity;

    const cols = Math.ceil(b.w / gap) + 1;
    const rows = Math.ceil(b.h / gap) + 1;

    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        if (R() > progress) continue;

        // Grain: skip ~15% of dots
        if (R() < 0.15) continue;

        const px = b.x0 + i * gap + (R() - 0.5) * gap * 0.4;
        const py = b.y0 + j * gap + (R() - 0.5) * gap * 0.4;

        // Only draw if inside the shape bounds (rough check)
        if (px < b.x0 - dotRad || px > b.x1 + dotRad || py < b.y0 - dotRad || py > b.y1 + dotRad) continue;

        const r = dotRad * (0.5 + R() * 0.8);
        const shadeFactor = (R() - 0.5) * this.defaults.speckle;
        const fillCol = shade2(c0, shadeFactor);

        const innerR = r * this.defaults.softEdge;
        const G = ctx.createRadialGradient(px, py, innerR, px, py, r);
        G.addColorStop(0, fillCol);
        G.addColorStop(1, 'rgba(0,0,0,0)');

        ctx.fillStyle = G;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, 7);
        ctx.fill();
      }
    }

    ctx.restore();
  }
}

export default PastelStyle;
