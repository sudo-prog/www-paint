/**
 * knife.js — Palette knife style.
 *
 * Algorithm: broad flat strokes applied with a palette knife — hard edges,
 * a light ridge highlight along one side, and a slightly textured body.
 * The knife deposits paint in a flat slab; the edge is clean (no bleed),
 * and a subtle highlight on one side suggests the raised ridge of
 * impasto paint.
 *
 * For strokes (S-type): a flat ribbon with a hard fill and a ridge
 * highlight on one side. For area fills (E/B/T/R): a flat opaque fill
 * with a directional highlight band suggesting the knife-drag direction.
 *
 * Reference: RE_BREAKDOWN.md §4.2, impasto painting technique
 */

import {
  rngFor, gaussR, lerp, clamp01,
  quadPts, normalAt, boxOf, shapePoly, outlinePath,
  shade2, mixHex, rgbaOf, rgbToHex
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

export class KnifeStyle {
  name = 'knife';
  category = 'paint';
  description = 'Palette knife: broad flat strokes with hard edges and a light ridge highlight suggesting impasto paint. The fill is opaque and flat, with a highlight band along one side of each stroke.';

  defaults = {
    strokeSize: { min: 6, max: 30 },
    opacity: 0.92,         // nearly opaque
    ridgeLighten: 0.22,     // lighten for the ridge highlight
    ridgeWidth: 0.18,       // ridge highlight width as fraction of stroke width
    ridgeJitter: 0.3,       // randomness in ridge position along stroke
    texture: 0.06,          // subtle texture noise (stamp jitter)
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
   * Render a palette-knife stroke: flat ribbon + ridge highlight.
   * The highlight rides on one side of the stroke, with slight position
   * jitter to mimic the knife's travel.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} shape
   * @param {function} R - Seeded RNG
   * @param {string} c0, c1 - Colour hexes
   * @param {number} o - Opacity
   * @param {number} progress - 0..1
   */
  _renderStroke(ctx, shape, R, c0, c1, o, progress) {
    const a = shape.params;
    const w = Math.max(2, a[6]);
    const P = quadPts(a, progress, 1, 22);
    const n = P.length;
    if (n < 3) return;

    const hw = w / 2;
    const ridgeW = w * this.defaults.ridgeWidth;
    const highlight = shade2(c0, this.defaults.ridgeLighten);
    const side = R() > 0.5 ? 1 : -1; // which side the ridge sits on

    ctx.save();
    ctx.lineCap = ctx.lineJoin = 'round';

    // --- Main flat fill (hard edge) ---
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

    ctx.globalAlpha = o * this.defaults.opacity;
    ctx.fillStyle = c0;
    ctx.fill(band);

    // --- Ridge highlight ---
    ctx.globalAlpha = o * (0.7 + R() * 0.2);
    ctx.fillStyle = highlight;

    // Build the ridge path — offset into the stroke on one side
    const ridge = new Path2D();
    for (let i = 0; i < n; i++) {
      const [nx, ny] = normalAt(P, i);
      const jitter = (R() - 0.5) * w * this.defaults.ridgeJitter;
      const inset = hw * 0.2;
      const px = P[i][0] + nx * inset * side + nx * jitter;
      const py = P[i][1] + ny * inset * side + ny * jitter;
      if (i === 0) ridge.moveTo(px, py);
      else ridge.lineTo(px, py);
    }
    for (let i = n - 1; i >= 0; i--) {
      const [nx, ny] = normalAt(P, i);
      const jitter = (R() - 0.5) * w * this.defaults.ridgeJitter;
      const inset = hw * 0.2;
      const px = P[i][0] + nx * inset * side + nx * ridgeW * side - nx * jitter;
      const py = P[i][1] + ny * inset * side + ny * ridgeW * side - ny * jitter;
      ridge.lineTo(px, py);
    }
    ridge.closePath();
    ctx.fill(ridge);

    // --- Hard edge outline (subtle, darker) ---
    ctx.globalAlpha = o * 0.5;
    ctx.strokeStyle = shade2(c0, -0.12);
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(P[0][0], P[0][1]);
    for (let i = 1; i < n; i++) ctx.lineTo(P[i][0], P[i][1]);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Render palette-knife area fill: flat opaque fill with directional
   * highlight band suggesting knife-drag impasto ridges.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} shape
   * @param {function} R - Seeded RNG
   * @param {string} c0
   * @param {string} c1
   * @param {number} o
   * @param {number} progress
   */
  _renderFill(ctx, shape, R, c0, c1, o, progress) {
    const a = shape.params;
    const P = shapePoly(shape);
    const b = boxOf(P);
    const size = Math.max(b.w, b.h, 2);

    ctx.save();

    // Flat opaque fill
    ctx.globalAlpha = o * this.defaults.opacity;
    ctx.fillStyle = c0;
    outlinePath(ctx, shape);
    ctx.fill();

    // Directional highlight — a light band across the shape, offset along
    // the knife-drag direction to suggest an impasto ridge
    const col = shade2(c0, this.defaults.ridgeLighten);
    ctx.globalAlpha = o * 0.5;
    ctx.fillStyle = col;

    const bandW = b.w * 0.18;
    const bandH = b.h * 1.4; // extend beyond shape for full coverage
    const offset = size * 0.06;
    const ang = a[4] || 0; // rotation of the blob

    // Save clip first, then draw the highlight band
    outlinePath(ctx, shape);
    ctx.clip();

    ctx.save();
    ctx.translate(b.cx + offset * Math.cos(ang), b.cy + offset * Math.sin(ang));
    ctx.rotate(ang);
    ctx.fillRect(-bandW / 2, -bandH / 2, bandW, bandH);
    ctx.restore();

    // Hard edge outline
    ctx.globalAlpha = o * 0.4;
    ctx.strokeStyle = shade2(c0, -0.15);
    ctx.lineWidth = Math.max(0.5, size * 0.02);
    outlinePath(ctx, shape);
    ctx.stroke();

    ctx.restore();
  }
}

export default KnifeStyle;
