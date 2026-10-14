/**
 * calligraphy.js — Broad-nib calligraphy style.
 *
 * Algorithm: pressure-sensitive ribbon strokes rendered as a band
 * around the centreline, with a chisel nib angle of ~40° (tan⁻¹(0.7/1.5)).
 * The nib is wide across the stroke (thick on downstrokes) and narrow
 * along it (thin on upstrokes). A linear gradient runs along the band
 * from c0 to c1, and ink pools at both ends as elliptical drops.
 *
 * Based on Code Painter's calligraphy renderer:
 *   - Band half-width: cos(0.7) * w/2, sin(0.7) * w/2 (≈40° nib angle)
 *   - Band = left offset points + right offset points (reversed)
 *   - Gradient along the stroke direction
 *   - Ink pooled at start and end as ellipses
 *
 * This differs from marker (45° chisel, transparent) — calligraphy
 * uses a 40° nib and opaque ink with a gradient.
 *
 * Reference: RE_BREAKDOWN.md §4.2, p5.brush stroke.js (pressure system),
 *            Code Painter STYLE_DRAW.calligraphy
 */

import {
  rngFor, gaussR, lerp, clamp01,
  quadPts, normalAt, boxOf, offsetPts, shapePoly, outlinePath,
  shade2, mixHex, hexRgb
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

export class CalligraphyStyle {
  name = 'calligraphy';
  category = 'draw';
  description = 'Broad-nib calligraphy with pressure-sensitive ribbon strokes. Wide on downstrokes, thin on upstrokes. A 40° chisel nib creates a linear gradient along the stroke, with ink pooled at both ends as dark elliptical drops.';

  defaults = {
    strokeSize: { min: 2, max: 12 },
    nibAngle: 0.7,        // ~40° — the chisel nib angle
    minNibWidth: 2,       // minimum nib width (narrow part)
    endBlotScale: 0.32,   // ink pool radius as fraction of nib width
    endBlotOpacity: 0.35, // opacity of the ink pooled at stroke ends
    bandStrokeWidth: 0.06, // outline of the band as fraction of nib width
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
        strokes.push(this._makeShape(region, color));
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

  render(ctx, shape, progress = 1) {
    const [c0, c1, o] = resolveColors(shape);
    const a = shape.params;

    if (shape.type === 'S') {
      this._renderStroke(ctx, shape, c0, c1, o, progress);
    } else {
      this._renderArea(ctx, shape, c0, c1, o);
    }
  }

  /**
   * Broad-nib ribbon rendering.
   *
   * The nib is held at ~40° (cos/sin of 0.7 radians). The band is
   * constructed by offsetting the centreline by half the nib width
   * along the chisel direction. A linear gradient runs from c0 at
   * the start to c1 at the end of the stroke.
   *
   * Pressure sensitivity is approximated via the stroke width:
   * the band is wider where the source path is wider (a[6] is the
   * base width, and the pressure can vary the effective width).
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} shape
   * @param {string} c0 - Start colour
   * @param {string} c1 - End colour
   * @param {number} o - Opacity
   * @param {number} progress - 0..1
   */
  _renderStroke(ctx, shape, c0, c1, o, progress) {
    const a = shape.params;
    const w = Math.max(2, a[6]);
    const nibAngle = this.defaults.nibAngle;
    const cx = Math.cos(nibAngle) * w / 2;
    const cy = Math.sin(nibAngle) * w / 2;

    // Sample the centreline at enough points for a smooth band
    const P = quadPts(a, progress, 1, 32);
    const n = P.length;

    // Build the band: left edge forward, right edge backward
    const band = new Path2D();
    for (let i = 0; i < n; i++) {
      i === 0
        ? band.moveTo(P[i][0] + cx, P[i][1] - cy)
        : band.lineTo(P[i][0] + cx, P[i][1] - cy);
    }
    for (let i = n - 1; i >= 0; i--) {
      band.lineTo(P[i][0] - cx, P[i][1] + cy);
    }
    band.closePath();

    ctx.save();

    // Linear gradient along the stroke (c0 → c1)
    const G = ctx.createLinearGradient(P[0][0], P[0][1], P[n - 1][0], P[n - 1][1]);
    G.addColorStop(0, c0);
    G.addColorStop(1, c1);

    ctx.globalAlpha = o;
    ctx.fillStyle = G;
    ctx.fill(band);

    // Band outline — dark ink along the edges
    ctx.globalAlpha = o;
    ctx.strokeStyle = G;
    ctx.lineWidth = Math.max(0.6, w * this.defaults.bandStrokeWidth);
    ctx.stroke(band);

    // Ink pooled at both ends — elliptical drops
    const blotScale = this.defaults.endBlotScale;
    const blotOpacity = this.defaults.endBlotOpacity;
    for (const e of [P[0], P[n - 1]]) {
      ctx.globalAlpha = o * blotOpacity;
      ctx.fillStyle = shade2(c0, -0.35);
      ctx.beginPath();
      ctx.ellipse(e[0], e[1], w * blotScale, w * blotScale * 0.5, nibAngle, 0, 7);
      ctx.fill();
    }

    ctx.restore();
  }

  /**
   * Area rendering: flat gradient fill.
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} shape
   * @param {string} c0
   * @param {string} c1
   * @param {number} o
   */
  _renderArea(ctx, shape, c0, c1, o) {
    ctx.save();
    ctx.globalAlpha = o;
    const G = ctx.createLinearGradient(
      shape.params[0] - shape.params[2], shape.params[1] - shape.params[3],
      shape.params[0] + shape.params[2], shape.params[1] + shape.params[3]
    );
    G.addColorStop(0, c0);
    G.addColorStop(1, c1);
    ctx.fillStyle = G;
    outlinePath(ctx, shape);
    ctx.fill();
    ctx.restore();
  }
}

export default CalligraphyStyle;
