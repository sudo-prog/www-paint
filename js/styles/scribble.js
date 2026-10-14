/**
 * scribble.js — Chaotic scribble style.
 *
 * Algorithm: a pen going back-and-forth inside the shape boundary,
 * with a random angle and chaotic path. Multiple passes at different
 * angles build up a dense, chaotic scribble. The lines are clipped
 * to the shape outline.
 *
 * Based on Code Painter's scribble renderer:
 *   - `outlinePath(x, q)` to clip the drawing region
 *   - `pen going back and forth`: alternating direction at each step
 *   - `u < 0.7` for the first pass, `0.7` for fill (progress-based)
 *   - Random angle per pass (+ pass * 1.3 for variation)
 *   - Line width ~3% of shape size, gap ~2.3× line width
 *   - 1-2 passes depending on random threshold
 *
 * Reference: RE_BREAKDOWN.md §4.3, Code Painter STYLE_DRAW.scribble
 */

import {
  rngFor, gaussR, lerp, clamp01,
  quadPts, normalAt, boxOf, offsetPts, shapePoly, outlinePath,
  shade2, mixHex, hexRgb, inPoly
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

export class ScribbleStyle {
  name = 'scribble';
  category = 'graphic';
  description = 'Chaotic overlapping strokes within shapes. A pen goes back and forth at random angles, clipped to the shape boundary, with multiple passes building up density.';

  defaults = {
    strokeSize: { min: 2, max: 8 },
    passes: 2,           // 1-2 passes at different angles
    pass1Threshold: 0.45, // < this → 2 passes, else 1
    lineWidthFactor: 0.03, // line width as fraction of shape size
    gapFactor: 2.3,      // gap between lines as fraction of line width
    amplitudeFactor: 0.75, // half-extent of scribble as fraction of shape size
    angleJitter: 1.0,    // random angle jitter (radians)
    passAngleStep: 1.3,  // angle offset between passes
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

  render(ctx, shape, progress = 1) {
    const [c0, c1, o] = resolveColors(shape);
    const a = shape.params;
    const R = rngFor(shape.seed || a.slice(0, 6));

    this._renderArea(ctx, shape, c0, c1, o, R, progress);
  }

  /**
   * Render chaotic scribble strokes within a shape.
   *
   * The scribble is a pen going back-and-forth (zigzag) at a random
   * angle, clipped to the shape boundary. Multiple passes at slightly
   * different angles build up density.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} shape
   * @param {string} c0 - Colour
   * @param {string} c1
   * @param {number} o - Opacity
   * @param {function} R - Seeded RNG
   * @param {number} progress - 0..1
   */
  _renderArea(ctx, shape, c0, c1, o, R, progress) {
    const a = shape.params;
    const P = shapePoly(shape);
    const b = boxOf(P);
    const size = Math.max(b.w, b.h, 8);
    const lw = Math.max(0.7, Math.min(3.2, size * this.defaults.lineWidthFactor));
    const gap = lw * this.defaults.gapFactor;
    const half = size * this.defaults.amplitudeFactor;

    ctx.save();
    outlinePath(ctx, shape);
    ctx.clip();

    ctx.globalAlpha = o;
    ctx.strokeStyle = c0;
    ctx.lineWidth = lw;
    ctx.lineCap = ctx.lineJoin = 'round';

    // Determine number of passes (1 or 2)
    const np = R() < this.defaults.pass1Threshold ? 2 : 1;
    const passes = Math.min(np, Math.floor(1 + progress * 2));

    for (let pass = 0; pass < passes; pass++) {
      // Only draw this pass if progress allows
      if (pass === 1 && progress < 0.5) continue;

      ctx.save();
      ctx.translate(b.cx, b.cy);
      ctx.rotate(R() * Math.PI + pass * this.defaults.passAngleStep);

      ctx.beginPath();
      let y = -half;
      let side = 1;
      ctx.moveTo(-half, y);

      while (y < half) {
        y += gap * (0.8 + R() * 0.5);
        ctx.lineTo(side * half + (R() - 0.5) * gap * 3, y);
        side = -side;
      }

      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }
}

export default ScribbleStyle;
