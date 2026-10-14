/**
 * marker.js — Alcohol marker style.
 *
 * Algorithm: chisel-tip band at 45°, transparent ink that darkens
 * where strokes cross, with streaks along the grain and a blot where
 * the pen rests.
 *
 * Based on Code Painter's marker renderer, which builds a band-path
 * by offsetting the stroke centreline by half the width along the
 * chisel direction (cos(π/4), sin(π/4) ≈ 0.785 → 45°). The band is
 * filled at 0.7 opacity; overlapping strokes naturally build up colour
 * through alpha compositing. Two highlight streaks run along the band,
 * and a soft blot appears at the tip when the stroke is complete.
 *
 * Unlike charcoal/pencil, marker has no grain — the edge is clean.
 * The transparency means users (or the engine) must draw multiple passes
 * for dense colour.
 *
 * Reference: RE_BREAKDOWN.md §4.2, p5.brush stroke.js (marker brush),
 *            Code Painter STYLE_DRAW.marker
 */

import {
  rngFor, gaussR, lerp, clamp01,
  quadPts, normalAt, boxOf, offsetPts, shapePoly, outlinePath,
  shade2, mixHex
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

export class MarkerStyle {
  name = 'marker';
  category = 'draw';
  description = 'Alcohol marker with a chisel tip at 45°. Transparent ink that darkens where strokes overlap. Clean edges, no grain. A soft blot appears where the pen rests at the end of a stroke.';

  defaults = {
    strokeSize: { min: 2, max: 14 },
    chiselAngle: 0.785,    // 45° — cos/sin of this gives the nib offset
    opacity: 0.7,          // base opacity of a single pass
    streakOpacity: 0.12,   // highlight streaks along the band
    blotOpacity: 0.25,     // blot at stroke end
    blotScale: 0.42,       // blot radius as fraction of stroke width
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
      type: 'E',
      params: [region.cx, region.cy, region.w, region.h, 0, c, c, 1],
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
   * Chisel-tip band rendering.
   * The marker nib is a chisel at 45°. We offset the centreline
   * left and right by the chisel half-width to create a band path,
   * then fill it with semi-transparent colour.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} shape
   * @param {string} c0 - Fill colour
   * @param {string} c1 - Unused (marker is single-colour)
   * @param {number} o - Opacity
   * @param {number} progress - 0..1
   */
  _renderStroke(ctx, shape, c0, c1, o, progress) {
    const a = shape.params;
    const w = Math.max(2, a[6]);

    // Chisel offset: cos(0.785) ≈ 0.707, sin(0.785) ≈ 0.707
    const angle = this.defaults.chiselAngle;
    const cx = Math.cos(angle) * w / 2;
    const cy = Math.sin(angle) * w / 2;

    const P = progress < 1 ? quadPts(a, progress, 1, 24) : quadPts(a, 1, 1, 24);
    const n = P.length;

    // Build the band path: left edge, then right edge reversed
    const band = new Path2D();
    for (let i = 0; i < n; i++) {
      const pt = i === 0
        ? band.moveTo(P[i][0] + cx, P[i][1] - cy)
        : band.lineTo(P[i][0] + cx, P[i][1] - cy);
    }
    for (let i = n - 1; i >= 0; i--) {
      band.lineTo(P[i][0] - cx, P[i][1] + cy);
    }
    band.closePath();

    ctx.save();

    // Main band fill — semi-transparent
    ctx.globalAlpha = o * this.defaults.opacity;
    ctx.fillStyle = c0;
    ctx.fill(band);

    // Streaks along the band — subtle white highlights
    ctx.globalAlpha = o * this.defaults.streakOpacity;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(0.5, w * 0.08);
    for (const f of [-0.25, 0.2]) {
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const pt = P[i];
        const sx = pt[0] + cx * f * 2;
        const sy = pt[1] - cy * f * 2;
        i === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
      }
      ctx.stroke();
    }

    // Blot at the end of a complete stroke
    if (progress >= 1 && !shape.sub) {
      const e = P[n - 1];
      ctx.globalAlpha = o * this.defaults.blotOpacity;
      ctx.fillStyle = shade2(c0, -0.2);
      ctx.beginPath();
      ctx.arc(e[0], e[1], w * this.defaults.blotScale, 0, 7);
      ctx.fill();
    }

    ctx.restore();
  }

  /**
   * Area fill: flat colour at reduced opacity, clipped to the shape.
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} shape
   * @param {string} c0
   * @param {string} c1
   * @param {number} o
   */
  _renderArea(ctx, shape, c0, c1, o) {
    ctx.save();
    ctx.globalAlpha = o * 0.6;  // marker wash fills areas at 60% opacity
    ctx.fillStyle = c0;
    outlinePath(ctx, shape);
    ctx.fill();
    ctx.restore();
  }
}

export default MarkerStyle;
