/**
 * gouache.js — Gouache style.
 *
 * Algorithm: opaque matte paint with a flat colour body and a subtle darker
 * edge. Unlike watercolor, gouache is opaque — each stroke fully covers the
 * layer beneath. The body is a flat fill; a slightly darker stroke along the
 * perimeter gives the soft edge of a brushloaded with pigment.
 *
 * For strokes (S-type), a flat ribbon is drawn at full opacity with a darker
 * rim. For area shapes (E/B/T/R), the shape is filled flat and outlined with
 * a darker shade to suggest the pigment's edge.
 *
 * Reference: RE_BREAKDOWN.md §4.2 (brush stroke), artist technique notes
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

export class GouacheStyle {
  name = 'gouache';
  category = 'paint';
  description = 'Opaque matte gouache paint: flat colour fill with a subtle darker edge. Fully covers what is beneath — no transparency or bleed. A thin darker rim gives the soft edge of a brush loaded with pigment.';

  defaults = {
    strokeSize: { min: 3, max: 20 },
    opacity: 0.95,         // gouache is opaque, but not perfectly so
    edgeDarken: 0.18,        // darken the perimeter edge
    edgeWidth: 0.12,         // edge width as fraction of stroke width
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
      this._renderFill(ctx, shape, R, c0, c1, o);
    }
  }

  /**
   * Render a gouache stroke: opaque flat ribbon with a darker edge.
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} shape
   * @param {function} R - Seeded RNG
   * @param {string} c0, c1 - Colour hexes
   * @param {number} o - Opacity
   * @param {number} progress - 0..1
   */
  _renderStroke(ctx, shape, R, c0, c1, o, progress) {
    const a = shape.params;
    const w = Math.max(1, a[6]);
    const P = quadPts(a, progress, 1, 24);
    const n = P.length;
    if (n < 3) return;

    // Build the ribbon path
    const band = new Path2D();
    const hw = w / 2;
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

    ctx.save();
    ctx.lineCap = ctx.lineJoin = 'round';

    // Main flat fill — opaque gouache
    ctx.globalAlpha = o * this.defaults.opacity;
    ctx.fillStyle = c0;
    ctx.fill(band);

    // Darker edge — a slightly narrower ribbon in a darker shade
    const col = shade2(c0, -this.defaults.edgeDarken);
    ctx.globalAlpha = o;
    ctx.strokeStyle = col;
    ctx.lineWidth = w * this.defaults.edgeWidth;
    ctx.beginPath();
    ctx.moveTo(P[0][0], P[0][1]);
    for (let i = 1; i < n; i++) ctx.lineTo(P[i][0], P[i][1]);
    ctx.stroke();

    // Slight corner rounding at ends
    ctx.globalAlpha = o * this.defaults.opacity;
    ctx.fillStyle = c0;
    ctx.beginPath();
    ctx.arc(P[0][0], P[0][1], w * 0.18, 0, 7);
    ctx.fill();

    ctx.restore();
  }

  /**
   * Render a gouache area fill: flat colour with a darker edge.
   */
  _renderFill(ctx, shape, R, c0, c1, o) {
    const P = shapePoly(shape);
    const b = boxOf(P);
    const edge = shade2(c0, -this.defaults.edgeDarken);

    ctx.save();

    // Flat fill — opaque
    ctx.globalAlpha = o * this.defaults.opacity;
    ctx.fillStyle = c0;
    outlinePath(ctx, shape);
    ctx.fill();

    // Darker edge around the perimeter
    ctx.globalAlpha = o;
    ctx.strokeStyle = edge;
    ctx.lineWidth = Math.max(0.6, Math.max(b.w, b.h) * this.defaults.edgeWidth * 0.4);
    outlinePath(ctx, shape);
    ctx.stroke();

    ctx.restore();
  }
}

export default GouacheStyle;
