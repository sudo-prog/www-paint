/**
 * bokeh.js — Bokeh style.
 *
 * Algorithm: large soft translucent overlapping circles with bright rims.
 * Each "bokeh" is a circle with a radial gradient: bright at the very
 * center/edge and translucent in between. Multiple circles overlap
 * with additive-like blending to create the lens-flare bokeh look.
 *
 * For strokes (S-type): circles are stamped along the path centreline.
 * For area shapes (E/B/T/R): circles fill the shape at varying sizes.
 *
 * Reference: Bokeh photography, RE_BREAKDOWN.md §4.3 (graphic styles)
 */

import {
  rngFor, gaussR, lerp, clamp01,
  quadPts, boxOf, shapePoly, outlinePath,
  shade2, mixHex, rgbaOf, rgbToHex
} from './base.js';

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

export class BokehStyle {
  name = 'bokeh';
  category = 'graphic';
  description = 'Bokeh: large soft translucent overlapping circles with bright rims. Each circle has a radial gradient that is bright at the center, translucent in the middle ring, and bright again at the edge — like out-of-focus point light sources.';

  defaults = {
    strokeSize: { min: 4, max: 16 },
    circleSizeMin: 6,         // minimum circle radius (px)
    circleSizeMax: 22,        // maximum circle radius (px)
    spacingFactor: 0.25,      // circle spacing as fraction of shape size
    coreBrighten: 0.4,        // center brightening
    rimBrighten: 0.3,         // edge rim brightening
    overlapGlow: 0.18,        // overlap glow intensity
    minRegionArea: 60
  };

  generate(analyzer, params) {
    const cfg = { ...this.defaults, ...params };
    const strokes = [];

    if (analyzer && analyzer.regions) {
      for (const region of analyzer.regions) {
        if (region.area < (cfg.minRegionArea || 60)) continue;
        const color = analyzer.sampleColor(region.cx, region.cy);
        strokes.push(this._makeShape(region, color));
      }
    }

    if (analyzer && analyzer.edges && analyzer.edges.length > 0) {
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
      color0: c, color1: c, alpha: 1,
      seed: [region.cx, region.cy, region.w, region.h]
    };
  }

  _makeStroke(edge, color) {
    const c = Array.isArray(color) ? color : [color, color, color];
    const w = lerp(this.defaults.strokeSize.min, this.defaults.strokeSize.max, Math.random());
    return {
      type: 'S',
      params: [edge.x0, edge.y0, edge.cx, edge.cy, edge.x1, edge.y1, w, 0, c, c, 1],
      color0: c, color1: c, alpha: 1,
      seed: edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, w, 0]
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
   * Draw a single bokeh circle with radial gradient.
   */
  _drawBokehCircle(ctx, cx, cy, radius, coreCol, rimCol, o) {
    const G = ctx.createRadialGradient(
      cx, cy, 0, cx, cy, radius
    );
    // Bright center
    G.addColorStop(0, rgbaOf(coreCol, o * 0.9));
    // Translucent middle
    G.addColorStop(0.45, rgbaOf(coreCol, o * 0.25));
    // Bright rim
    G.addColorStop(1, rgbaOf(rimCol, o * 0.7));

    ctx.fillStyle = G;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, 7);
    ctx.fill();
  }

  /**
   * Render bokeh circles stamped along a stroke path.
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
    const baseR = lerp(this.defaults.circleSizeMin, this.defaults.circleSizeMax, w / 20);

    ctx.save();
    ctx.filter = 'blur(0.5px)';

    let j = 1;
    const step = baseR * 1.8;
    const count = Math.ceil(L / step);

    for (let k = 0; k <= count; k++) {
      if (k / count > progress) break;
      const target = (k / count) * L;
      while (j < n - 2 && cum[j] < target) j++;
      const seg = cum[j] - cum[j - 1] || 1;
      const f = (target - cum[j - 1]) / seg;
      const px = P[j - 1][0] + (P[j][0] - P[j - 1][0]) * f;
      const py = P[j - 1][1] + (P[j][1] - P[j - 1][1]) * f;

      const rad = baseR * (0.6 + R() * 0.8);
      const colT = R();
      const col = mixHex(c0, c1, colT);
      const core = shade2(col, this.defaults.coreBrighten);
      const rim = shade2(col, this.defaults.rimBrighten);

      this._drawBokehCircle(ctx, px, py, rad, core, rim, o);
    }

    ctx.restore();
  }

  /**
   * Render overlapping bokeh circles filling an area shape.
   */
  _renderArea(ctx, shape, R, c0, c1, o, progress) {
    const P = shapePoly(shape);
    const b = boxOf(P);
    const size = Math.max(b.w, b.h, 4);

    const colSize = lerp(this.defaults.circleSizeMin, this.defaults.circleSizeMax, clamp01(size / 100));
    const spacing = colSize * this.spacingFactor * 4;
    const cols = Math.ceil(b.w / spacing) + 2;
    const rows = Math.ceil(b.h / spacing) + 2;

    ctx.save();
    outlinePath(ctx, shape);
    ctx.clip();

    ctx.filter = 'blur(0.5px)';

    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const px = b.x0 + i * spacing + (R() - 0.5) * spacing * 0.5;
        const py = b.y0 + j * spacing + (R() - 0.5) * spacing * 0.5;

        if (px < b.x0 - colSize || px > b.x1 + colSize) continue;
        if (py < b.y0 - colSize || py > b.y1 + colSize) continue;

        const rad = colSize * (0.5 + R() * 0.8);
        const colT = R();
        const col = mixHex(c0, c1, colT);
        const core = shade2(col, this.defaults.coreBrighten);
        const rim = shade2(col, this.defaults.rimBrighten);

        this._drawBokehCircle(ctx, px, py, rad, core, rim, o);
      }
    }

    ctx.restore();
  }
}

export default BokehStyle;
