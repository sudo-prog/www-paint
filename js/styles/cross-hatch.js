/**
 * cross-hatch.js — Cross-hatching style.
 *
 * Algorithm: parallel lines (hatching) drawn at specific angles across
 * a shape, with multiple layers at different angles building up the
 * cross-hatch pattern. Each hatch line is rendered as a stamped brush
 * stroke (reusing the pencil's stamp technique) for a drawn, textured
 * look.
 *
 * Based on Code Painter's hatch style, which is handled via the
 * default `stamped`/`strokePart` rendering path (not a custom
 * STYLE_DRAW function). Code Painter's hatch creates straight lines
 * at ±45° within shapes, and the `pickType` function maps "hatch"
 * as an 'S' (stroke) type.
 *
 * The approach:
 *   - For S-type (stroke) shapes: draw the hatch stroke itself plus
 *     additional hatching lines at crossing angles.
 *   - For E/B/T/R-type (area) shapes: generate parallel hatching lines
 *     at multiple angles (typically 0°, 45°, 90°, 135°) clipped to
 *     the shape boundary.
 *
 * Reference: RE_BREAKDOWN.md §4.2, p5.brush hatch.js,
 *            Code Painter STYLE_DRAW.pencil (hatching sub-routine)
 */

import {
  rngFor, gaussR, lerp, clamp01,
  quadPts, normalAt, offsetPts, shapePoly, outlinePath,
  boxOf, inPoly, colsOf
} from './base.js';

/**
 * Resolve colors from a shape (supports both engine and style formats).
 * @param {object} shape
 * @returns {[string, string, number]}
 */
function resolveColors(shape) {
  if (shape.color0 != null || shape.color1 != null) {
    const c0 = Array.isArray(shape.color0)
      ? '#' + shape.color0.map(v => Math.round(v).toString(16).padStart(2, '0')).join('')
      : (typeof shape.color0 === 'string' ? shape.color0 : '#000000');
    const c1 = Array.isArray(shape.color1)
      ? '#' + shape.color1.map(v => Math.round(v).toString(16).padStart(2, '0')).join('')
      : (typeof shape.color1 === 'string' ? shape.color1 : '#000000');
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

/**
 * Core stamped-brush builder — shared with pencil.
 * Walks a polyline, stamps tips with pressure + grain + scatter.
 *
 * @param {Array} lines - Array of polylines
 * @param {object} o - Pen parameters
 * @param {function} R - Seeded RNG
 * @returns {{A:Path2D, B:Path2D, st:Array, base:number}}
 */
function stampBuild(lines, o, R) {
  const A = new Path2D();
  const B = new Path2D();
  const st = [];

  for (const P of lines) {
    const n = P.length;
    if (n < 2) continue;
    const cum = [0];
    for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
    const L = cum[n - 1];
    if (L < 0.01) continue;

    const step = Math.max(o.minStep || 0.5, o.w * o.spacing);
    const steps = Math.min(o.maxSteps || 240, Math.max(2, Math.ceil(L / step)));
    const peak = o.peak + (R() - 0.5) * 0.2;
    const hw = o.hw * (0.85 + R() * 0.3);
    const c = 1 + R() * 0.6;
    let j = 1;

    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      if (t > (o.upto !== undefined ? o.upto : 1)) break;
      const d = t * L;
      while (j < n - 1 && cum[j] < d) j++;
      const seg = cum[j] - cum[j - 1] || 1;
      const f = (d - cum[j - 1]) / seg;
      const px = P[j - 1][0] + (P[j][0] - P[j - 1][0]) * f;
      const py = P[j - 1][1] + (P[j][1] - P[j - 1][1]) * f;

      const pr = o.pmin + (o.pmax - o.pmin) / (1 + Math.pow(Math.abs((t - peak) / hw), 2 * c));

      if (R() < o.grain * (0.62 - 0.4 * Math.min(1, pr))) continue;

      const [nx, ny] = normalAt(P, j);
      const sc = gaussR(R) * o.scatter * o.w * 0.5 * (1.15 - o.sharp * 0.5);
      const par = (R() - 0.5) * step;
      const r = Math.max(0.4, o.w * 0.5 * (0.4 + 0.6 * Math.min(1.1, pr)) * (0.8 + R() * 0.4));

      const sx = px - ny * sc + nx * par;
      const sy = py + nx * sc + ny * par;
      const Q = R() < 0.55 ? A : B;
      if (r < 1.5) { Q.rect(sx - r, sy - r, r * 2, r * 2); }
      else { Q.moveTo(sx + r, sy); Q.arc(sx, sy, r, 0, 7); }
      st.push(sx, sy, r, Q === A ? 0 : 1, t);
    }
  }
  return { A, B, st, base: o.alpha * (0.8 + R() * 0.2) };
}

export class CrossHatchStyle {
  name = 'cross-hatch';
  category = 'draw';
  description = 'Parallel lines at ±45° forming a cross-hatch pattern. Multiple layers of hatching at different angles are drawn as stamped brush strokes clipped to the shape, building up tonal density where lines cross.';

  defaults = {
    strokeSize: { min: 2, max: 10 },
    angles: [0, 45, 90, 135],  // hatch angles in degrees
    layerOpacities: [0.55, 0.25, 0.16, 0.12],  // decreasing opacity per layer
    density: 1.0,           // spacing multiplier (1 = default, <1 = denser, >1 = looser)
    stampGrain: 0.25,       // grain on individual hatch lines
    stampScatter: 0.3,      // scatter on individual hatch lines
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
        strokes.push(...this._makeHatching(region, color));
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

  /**
   * Generate cross-hatching strokes for a filled region.
   * Each layer of parallel lines is a separate stamped stroke.
   */
  _makeHatching(region, color) {
    const strokes = [];
    const size = Math.max(region.w, region.h, 8);
    const w = lerp(this.defaults.strokeSize.min * 0.5, this.defaults.strokeSize.max * 0.7, Math.random());
    const gap = w * 2.5 * (2 - this.defaults.density);  // closer spacing = denser
    const half = size * 0.75;
    const R = rngFor([region.cx, region.cy, region.w, region.h, w, 0]);

    for (let layer = 0; layer < this.defaults.angles.length; layer++) {
      const ang = this.defaults.angles[layer] * Math.PI / 180;
      const cs = Math.cos(ang);
      const sn = Math.sin(ang);
      const rot = (px, py) => [region.cx + px * cs - py * sn, region.cy + px * sn + py * cs];

      for (let y = -half; y <= half; y += gap) {
        const j = (R() - 0.5) * gap * 0.3;
        const p0 = rot(-half + R() * size * 0.1, y + j);
        const mid = rot(0, y);
        const p1 = rot(half - R() * size * 0.1, y - j);

        strokes.push({
          type: 'S',
          params: [p0[0], p0[1], mid[0], mid[1], p1[0], p1[1], w, ang, color, color, 
                   this.defaults.layerOpacities[layer] || 0.3],
          color0: color,
          color1: color,
          alpha: this.defaults.layerOpacities[layer] || 0.3,
          seed: [p0[0], p0[1], p1[0], p1[1], w, layer]
        });
      }
    }
    return strokes;
  }

  render(ctx, shape, progress = 1) {
    const [c0, c1, o] = resolveColors(shape);
    const a = shape.params;

    if (shape.type === 'S') {
      this._renderHatchStroke(ctx, shape, c0, o, progress);
    } else {
      this._renderArea(ctx, shape, c0, c1, o, progress);
    }
  }

  /**
   * Render a single hatch stroke (used when strokes are drawn
   * as individual lines from the generator).
   */
  _renderHatchStroke(ctx, shape, c0, o, progress) {
    const a = shape.params;
    const w = Math.max(1, a[6]);
    const R = rngFor(shape.seed || a.slice(0, 6));

    const P = quadPts(a, progress, 1, Math.min(40, Math.max(4, Math.round(a[6] * 4))));
    const pen = {
      w, spacing: 0.5, scatter: this.defaults.stampScatter, sharp: 0.6,
      grain: this.defaults.stampGrain, pmin: 0.7, pmax: 1.2, peak: 0.5, hw: 0.5,
      minStep: 0.4, maxSteps: 200, alpha: a[a.length - 1] * o, upto: progress
    };

    const set = stampBuild([P], pen, R);
    ctx.save();
    ctx.lineCap = ctx.lineJoin = 'round';
    ctx.fillStyle = c0;
    ctx.globalAlpha = Math.min(1, set.base);
    ctx.fill(set.A);
    ctx.globalAlpha = Math.min(1, set.base * 0.5);
    ctx.fill(set.B);
    ctx.restore();
  }

  /**
   * Render cross-hatching for an area shape.
   * For areas, we draw multiple layers of parallel hatching
   * at different angles, clipped to the shape boundary.
   */
  _renderArea(ctx, shape, c0, c1, o, progress) {
    const a = shape.params;
    const P = shapePoly(shape);
    const b = boxOf(P);
    const size = Math.max(b.w, b.h, 8);
    const w = Math.max(1, a[6] || size * 0.02);
    const gap = w * 2.5;
    const half = size * 0.6;
    const R = rngFor(a.slice(0, 6));

    ctx.save();
    outlinePath(ctx, shape);
    ctx.clip();

    const angles = this.defaults.angles;
    for (let layer = 0; layer < angles.length; layer++) {
      const ang = angles[layer] * Math.PI / 180;
      const cs = Math.cos(ang);
      const sn = Math.sin(ang);
      const alpha = o * (this.defaults.layerOpacities[layer] || 0.3);

      ctx.globalAlpha = alpha;
      ctx.strokeStyle = c0;
      ctx.lineWidth = w;
      ctx.lineCap = 'round';

      for (let y = -half; y <= half; y += gap) {
        const x0 = b.cx + (-half) * cs - y * sn;
        const y0 = b.cy + (-half) * sn + y * cs;
        const x1 = b.cx + half * cs - y * sn;
        const y1 = b.cy + half * sn + y * cs;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      }
    }

    ctx.restore();
  }
}

export default CrossHatchStyle;
