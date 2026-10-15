/**
 * embroid.js — Satin-stitch embroidery style.
 *
 * Algorithm: dense parallel satin-stitch bands filling the shape.
 * The fill is built from many thin parallel lines (stitches) that run
 * along the shape's gradient axis. Each stitch is a short segment
 * with a subtle glossy highlight on one side, simulating the light
 * reflection off tightly-packed embroidery floss. A thin border
 * completes the embroidered patch look.
 *
 * For strokes (S-type): parallel stitches run along the ribbon centerline.
 * For area shapes (E/B/T/R): stitches fill the area in the direction
 * of the shape's gradient axis.
 *
 * Reference: Satin-stitch embroidery, RE_BREAKDOWN.md §4.3 (craft styles)
 */

import {
  rngFor, gaussR, lerp, clamp01,
  quadPts, normalAt, boxOf, shapePoly, outlinePath, shapeAxis,
  shade2, mixHex, rgbToHex
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

export class EmbroidStyle {
  name = 'embroid';
  category = 'craft';
  description = 'Embroidery: dense parallel satin-stitch bands filling the shape. Each stitch is a short glossy segment running along the gradient axis, with a border to complete the embroidered patch look.';

  defaults = {
    strokeSize: { min: 4, max: 22 },
    stitchDensity: 3,        // stitches per unit (higher = denser)
    stitchWidth: 1.5,        // width of each satin stitch (px)
    glossLighten: 0.35,      // glossy highlight brightness
    glossWidth: 0.3,         // highlight width as fraction of stitch
    borderWidth: 1.2,        // embroidered edge border width
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
      type: 'E',
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
   * Render a satin-stitch stroke: parallel glossy lines along path centerline.
   */
  _renderStroke(ctx, shape, R, c0, c1, o, progress) {
    const a = shape.params;
    const w = Math.max(2, a[6]);
    const P = quadPts(a, progress, 1, 30);
    const n = P.length;
    if (n < 2) return;

    const sw = Math.max(1, this.defaults.stitchWidth);
    const glossCol = shade2(c0, this.defaults.glossLighten);
    const glossW = sw * this.defaults.glossWidth;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Fill with the base stitch color (thin ribbon)
    ctx.globalAlpha = o;
    ctx.fillStyle = c0;

    const band = new Path2D();
    for (let i = 0; i < n; i++) {
      const [nx, ny] = normalAt(P, i);
      const off = sw / 2;
      i === 0 ? band.moveTo(P[i][0] + nx * off, P[i][1] + ny * off)
              : band.lineTo(P[i][0] + nx * off, P[i][1] + ny * off);
    }
    for (let i = n - 1; i >= 0; i--) {
      const [nx, ny] = normalAt(P, i);
      const off = sw / 2;
      band.lineTo(P[i][0] - nx * off, P[i][1] - ny * off);
    }
    band.closePath();
    ctx.fill(band);

    // Gloss highlight on one side
    ctx.globalAlpha = o * 0.55;
    ctx.strokeStyle = glossCol;
    ctx.lineWidth = glossW;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const [nx, ny] = normalAt(P, i);
      const side = -0.3;
      const px = P[i][0] + nx * side * sw;
      const py = P[i][1] + ny * side * sw;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Border (embroidery edge)
    ctx.globalAlpha = o * 0.7;
    ctx.strokeStyle = shade2(c0, -0.2);
    ctx.lineWidth = Math.max(0.5, w * 0.1);
    ctx.filter = 'none';
    ctx.beginPath();
    ctx.moveTo(P[0][0], P[0][1]);
    for (let i = 1; i < n; i++) ctx.lineTo(P[i][0], P[i][1]);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Render satin-stitch fill: dense parallel bands in gradient direction.
   */
  _renderArea(ctx, shape, R, c0, c1, o, progress) {
    const a = shape.params;
    const P = shapePoly(shape);
    const b = boxOf(P);
    const size = Math.max(b.w, b.h, 4);

    const axis = shapeAxis(shape);
    const [dx, dy] = axis;
    // Perpendicular stitch direction
    const sx = -dy;
    const sy = dx;

    const sw = Math.max(1, this.defaults.stitchWidth);
    const density = this.defaults.stitchDensity;
    const spacing = sw / density;

    // Diagonal span to cover the shape fully
    const diag = Math.hypot(b.w, b.h) * 1.5;
    const stitchCount = Math.ceil(diag / spacing);
    const drawn = Math.round(stitchCount * progress);

    const glossCol = shade2(c0, this.defaults.glossLighten);
    const glossW = sw * this.defaults.glossWidth;

    ctx.save();
    outlinePath(ctx, shape);
    ctx.clip();

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let i = 0; i < drawn; i++) {
      const t = (i / Math.max(1, drawn - 1)) - 0.5;
      const offset = t * diag;

      // Stitch position along the perpendicular axis
      const startX = b.cx + sx * offset - dx * diag;
      const startY = b.cy + sy * offset - dy * diag;
      const endX = b.cx + sx * offset + dx * diag;
      const endY = b.cy + sy * offset + dy * diag;

      const jitter = gaussR(R) * sw * 0.2;

      // Base stitch
      ctx.globalAlpha = o;
      ctx.strokeStyle = mixHex(c0, c1, clamp01(R() * 0.3 + 0.35));
      ctx.lineWidth = sw + jitter;
      ctx.beginPath();
      ctx.moveTo(startX + (R() - 0.5) * sw * 0.3, startY + (R() - 0.5) * sw * 0.3);
      ctx.lineTo(endX + (R() - 0.5) * sw * 0.3, endY + (R() - 0.5) * sw * 0.3);
      ctx.stroke();

      // Gloss highlight
      ctx.globalAlpha = o * 0.6;
      ctx.strokeStyle = glossCol;
      ctx.lineWidth = Math.max(0.3, glossW);
      ctx.beginPath();
      ctx.moveTo(startX + (R() - 0.5) * sw * 0.2, startY + (R() - 0.5) * sw * 0.2);
      ctx.lineTo(endX + (R() - 0.5) * sw * 0.2, endY + (R() - 0.5) * sw * 0.2);
      ctx.stroke();
    }

    // --- Border ---
    ctx.globalAlpha = o * 0.8;
    ctx.strokeStyle = shade2(c0, -0.25);
    ctx.lineWidth = Math.max(1, size * this.defaults.borderWidth * 0.05);
    ctx.filter = 'none';
    outlinePath(ctx, shape);
    ctx.stroke();

    ctx.restore();
  }
}

export default EmbroidStyle;
