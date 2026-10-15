/**
 * stitch.js — Cross-stitch style.
 *
 * Algorithm: regular X-stitch marks on a grid, blocky with limited
 * colors. The shape area is filled with a grid of X-shaped crosses,
 * each drawn as two diagonal lines forming an 'X'. The stitch size
 * and spacing are uniform (like actual cross-stitch fabric).
 *
 * For strokes (S-type): stitches are laid along the path at regular
 * intervals. For area shapes (E/B/T/R): the area is filled with a
 * grid of X-stitches clipped to the shape, using a blend of c0/c1.
 *
 * Reference: Cross-stitch embroidery, RE_BREAKDOWN.md §4.3 (craft styles)
 */

import {
  rngFor, gaussR, lerp, clamp01,
  quadPts, normalAt, boxOf, shapePoly, outlinePath,
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

export class StitchStyle {
  name = 'stitch';
  category = 'craft';
  description = 'Cross-stitch: regular X-stitch marks on a grid, blocky, with limited colors. Each stitch is two diagonal lines forming an X, laid out in a fabric-like grid pattern.';

  defaults = {
    strokeSize: { min: 3, max: 14 },
    stitchLenMin: 4,         // minimum stitch size (px)
    stitchLenMax: 10,        // maximum stitch size (px)
    stitchJitter: 0.1,       // positioning jitter (fraction of stitch size)
    colorVariation: 0.15,    // color blend jitter between c0/c1
    threadWidth: 1.0,        // thread line width relative to stitch size
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
    return {
      type: 'S',
      params: [edge.x0, edge.y0, edge.cx, edge.cy, edge.x1, edge.y1, 6, 0, c, c, 1],
      color0: c, color1: c, alpha: 1,
      seed: edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, 6, 0]
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
   * Draw a single X-stitch at position (cx, cy) with given size.
   * Each stitch is two diagonal lines forming an 'X'.
   */
  _drawStitch(ctx, cx, cy, size, col, lw) {
    const h = size / 2;
    ctx.globalAlpha = ctx.globalAlpha; // inherit
    ctx.strokeStyle = col;
    ctx.lineWidth = lw;
    ctx.lineCap = 'square';

    // First diagonal: top-left to bottom-right
    ctx.beginPath();
    ctx.moveTo(cx - h, cy - h);
    ctx.lineTo(cx + h, cy + h);
    ctx.stroke();

    // Second diagonal: top-right to bottom-left
    ctx.beginPath();
    ctx.moveTo(cx + h, cy - h);
    ctx.lineTo(cx - h, cy + h);
    ctx.stroke();
  }

  /**
   * Render cross-stitches along a stroke path.
   */
  _renderStroke(ctx, shape, R, c0, c1, o, progress) {
    const a = shape.params;
    const w = Math.max(2, a[6]);
    const P = quadPts(a, progress, 1, 32);
    const n = P.length;
    if (n < 2) return;

    ctx.save();

    const stitchSize = lerp(this.defaults.stitchLenMin, this.defaults.stitchLenMax, w / 20);
    const spacing = stitchSize * 1.3;
    const lw = Math.max(0.4, w * 0.15);

    // Build cumulative length
    const cum = [0];
    for (let i = 1; i < n; i++) {
      cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
    }
    const L = cum[n - 1];
    const count = Math.ceil(L / spacing);

    let j = 1;
    for (let k = 0; k <= count; k++) {
      if (k / count > progress) break;
      const t = k / count;
      const target = t * L;
      while (j < n - 2 && cum[j] < target) j++;
      const seg = cum[j] - cum[j - 1] || 1;
      const f = (target - cum[j - 1]) / seg;
      const px = P[j - 1][0] + (P[j][0] - P[j - 1][0]) * f;
      const py = P[j - 1][1] + (P[j][1] - P[j - 1][1]) * f;

      // Color: blend between c0 and c1 with jitter
      const colT = clamp01(gaussR(R) * this.defaults.colorVariation + 0.5);
      const col = mixHex(c0, c1, colT);

      const sz = stitchSize * (0.8 + R() * 0.4);
      const jx = (R() - 0.5) * stitchSize * this.defaults.stitchJitter;
      const jy = (R() - 0.5) * stitchSize * this.defaults.stitchJitter;

      ctx.globalAlpha = o;
      this._drawStitch(ctx, px + jx, py + jy, sz, col, Math.max(0.3, lw));
    }

    ctx.restore();
  }

  /**
   * Render cross-stitches filling an area shape on a grid.
   */
  _renderArea(ctx, shape, R, c0, c1, o, progress) {
    const P = shapePoly(shape);
    const b = boxOf(P);
    const size = Math.max(b.w, b.h, 4);

    const stitchSize = lerp(this.defaults.stitchLenMin, this.defaults.stitchLenMax, clamp01(size / 80));
    const spacing = stitchSize * 1.2;
    const lw = Math.max(0.4, stitchSize * 0.15);

    const cols = Math.ceil(b.w / spacing) + 1;
    const rows = Math.ceil(b.h / spacing) + 1;
    const maxStitches = cols * rows;
    const drawn = Math.round(maxStitches * progress);

    ctx.save();
    outlinePath(ctx, shape);
    ctx.clip();

    ctx.lineCap = 'square';

    let count = 0;
    outer:
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        if (count >= drawn) break outer;

        const px = b.x0 + i * spacing + (R() - 0.5) * stitchSize * this.defaults.stitchJitter;
        const py = b.y0 + j * spacing + (R() - 0.5) * stitchSize * this.defaults.stitchJitter;

        // Color: blend between c0 and c1 with jitter
        const colT = clamp01(gaussR(R) * this.defaults.colorVariation + 0.5);
        const col = mixHex(c0, c1, colT);

        const sz = stitchSize * (0.85 + R() * 0.3);
        ctx.globalAlpha = o;
        this._drawStitch(ctx, px, py, sz, col, lw);
        count++;
      }
    }

    ctx.restore();
  }
}

export default StitchStyle;
