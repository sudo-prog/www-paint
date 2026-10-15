/**
 * dots.js — Stipple / Ben-Day dots style.
 *
 * Algorithm: round dots (stipple pattern) placed on a regular grid.
 * Each dot is small with a hard edge, but the radius varies slightly
 * per dot and the colour has a subtle jitter — mimicking the
 * irregular placement of hand-dotted stipple or mechanical Ben-Day screens.
 *
 * For area shapes (E/B/T/R): dots fill the shape, radius proportional
 * to local tone (darker source → larger dots). For strokes (S):
 * dots stamp along the path centreline.
 *
 * Reference: RE_BREAKDOWN.md §4.3 (graphic styles), stippling technique
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

export class DotsStyle {
  name = 'dots';
  category = 'graphic';
  description = 'Stipple / Ben-Day dots: small round dots with hard edges, placed on a grid with subtle radius and colour jitter. Dot size varies with local tone — darker areas get larger dots.';

  defaults = {
    strokeSize: { min: 2, max: 10 },
    dotSizeMin: 1.5,          // minimum dot radius (px)
    dotSizeMax: 5.2,          // maximum dot radius (px)
    spacingFactor: 0.08,      // dot spacing as fraction of shape size
    spacingMin: 4,            // minimum spacing (px)
    spacingMax: 12,           // maximum spacing (px)
    radiusJitter: 0.25,       // random radius variation (±fraction)
    colorJitter: 0.08,        // subtle colour variation
    minRegionArea: 50
  };

  generate(analyzer, params) {
    const cfg = { ...this.defaults, ...params };
    const strokes = [];

    if (analyzer && analyzer.regions) {
      for (const region of analyzer.regions) {
        if (region.area < (cfg.minRegionArea || 50)) continue;
        const color = analyzer.sampleColor(region.cx, region.cy);
        strokes.push(this._makeShape(region, color));
      }
    }

    // Edges as dot strings along the path
    if (analyzer && analyzer.edges) {
      for (const edge of analyzer.edges) {
        const color = analyzer.sampleColor(edge.cx, edge.cy);
        strokes.push(this._makeStroke(edge, color));
      }
    }

    return strokes;
  }

  _makeShape(region, color) {
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

  _makeStroke(edge, color) {
    const c = Array.isArray(color) ? color : [color, color, color];
    return {
      type: 'S',
      params: [edge.x0, edge.y0, edge.cx, edge.cy, edge.x1, edge.y1, 3, 0, c, c, 1],
      color0: c,
      color1: c,
      alpha: 1,
      seed: edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, 3, 0]
    };
  }

  render(ctx, shape, progress = 1) {
    const [c0, c1, o] = resolveColors(shape);
    const a = shape.params;
    const R = rngFor(shape.seed || a.slice(0, 8));

    if (shape.type === 'S') {
      this._renderStroke(ctx, shape, R, c0, c1, o, progress);
    } else {
      this._renderArea(ctx, shape, R, c0, c1, o, progress);
    }
  }

  /**
   * Render dots along a stroke path.
   * Dots are stamped at regular intervals along the centreline.
   */
  _renderStroke(ctx, shape, R, c0, c1, o, progress) {
    const a = shape.params;
    const w = Math.max(2, a[6]);
    const P = quadPts(a, progress, 1, 30);
    const n = P.length;
    if (n < 2) return;

    // Build cumulative length
    const cum = [0];
    for (let i = 1; i < n; i++) {
      cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
    }
    const L = cum[n - 1];

    const d = Math.max(this.defaults.dotSizeMin * 3, w * 0.6);
    const steps = Math.ceil(L / d);
    const rad = this.defaults.dotSizeMin + R() * (this.defaults.dotSizeMax - this.defaults.dotSizeMin);

    ctx.save();
    ctx.globalAlpha = o;
    ctx.fillStyle = c0;

    let j = 1;
    for (let k = 0; k <= steps; k++) {
      if (k / steps > progress) break;
      const t = k / steps;
      const target = t * L;
      while (j < n - 2 && cum[j] < target) j++;
      const seg = cum[j] - cum[j - 1] || 1;
      const f = (target - cum[j - 1]) / seg;
      const px = P[j - 1][0] + (P[j][0] - P[j - 1][0]) * f;
      const py = P[j - 1][1] + (P[j][1] - P[j - 1][1]) * f;

      // Radius jitter
      const r = rad * (1 + (R() - 0.5) * this.defaults.radiusJitter * 2);
      // Colour jitter
      const jit = (R() - 0.5) * this.defaults.colorJitter;
      const col = shade2(c0, jit);

      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, 7);
      ctx.fill();
    }

    ctx.restore();
  }

  /**
   * Render dots within an area shape on a screen grid.
   * Dot radius varies based on a tone gradient projection along the
   * shape's axis: darker (t→1) gets larger dots.
   */
  _renderArea(ctx, shape, R, c0, c1, o, progress) {
    const a = shape.params;
    const P = shapePoly(shape);
    const b = boxOf(P);
    const size = Math.max(b.w, b.h, 4);

    // Spacing proportional to shape, clamped to min/max
    const spacing = clamp01(
      lerp(this.defaults.spacingMin, this.defaults.spacingMax,
           clamp01(size * 0.05))
    );

    // Gradient axis projection — project along the gradient angle
    const gradAngle = typeof a[5] === 'number' ? a[5] : 0;
    const dx = Math.cos(gradAngle);
    const dy = Math.sin(gradAngle);
    const proj = [];
    for (let i = 0; i < P.length; i += 2) {
      proj.push(P[i] * dx + P[i + 1] * dy);
    }
    const m = Math.min(...proj);
    const n = Math.max(...proj);
    const inv = 1 / Math.max(1e-6, n - m);

    ctx.save();
    outlinePath(ctx, shape);
    ctx.clip();

    ctx.globalAlpha = o;

    const cols = Math.ceil(b.w / spacing) + 2;
    const rows = Math.ceil(b.h / spacing) + 2;

    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const px = b.x0 + i * spacing + (R() - 0.5) * spacing * 0.3;
        const py = b.y0 + j * spacing + (R() - 0.5) * spacing * 0.3;
        if (px < b.x0 - spacing || px > b.x1 + spacing) continue;
        if (py < b.y0 - spacing || py > b.y1 + spacing) continue;

        // Tone: project position along gradient axis
        const t = clamp01((px * dx + py * dy - m) * inv);
        if (t * progress < 0.03) continue; // skip very light areas

        const rad = clamp01(
          lerp(this.defaults.dotSizeMin, this.defaults.dotSizeMax, t)
        ) * (0.8 + R() * 0.4);

        // Colour: interpolate c0↔c1 with jitter
        const jit = (R() - 0.5) * this.defaults.colorJitter;
        const col = shade2(mixHex(c0, c1, t), jit);

        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(px, py, rad, 0, 7);
        ctx.fill();
      }
    }

    ctx.restore();
  }
}

export default DotsStyle;
