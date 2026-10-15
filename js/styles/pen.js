/**
 * pen.js — Technical pen style.
 *
 * Algorithm: thin crisp constant-width line with no grain, no scatter,
 * no pressure variation. A technical pen (Rotring-style) deposits ink at
 * a fixed width with perfectly clean edges — the digital equivalent of a
 * steel-nibbed drafting pen on smooth Bristol paper.
 *
 * For strokes (S-type): a single clean path stroked at constant width.
 * For area shapes (E/B/T/R): the outline is traced with the constant-
 * width pen, and the interior is hatched with parallel lines at a
 * fixed angle (technical drawing convention).
 *
 * Reference: RE_BREAKDOWN.md §4.1 (stroke rendering), technical pen
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

export class PenStyle {
  name = 'pen';
  category = 'draw';
  description = 'Technical pen: thin crisp constant-width lines with perfectly clean edges, no grain or scatter. Area fills are rendered as outline + parallel cross-hatch lines at a fixed angle, like a drafting pen on Bristol board.';

  defaults = {
    strokeSize: { min: 1, max: 6 },
    opacity: 1,            // solid, no transparency
    hatchGap: 3.5,         // gap between hatch lines (px)
    hatchAngle: -0.785,    // default 45° cross-hatch
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
   * Render a technical pen stroke: single clean constant-width line.
   * No grain, no scatter, no pressure variation.
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} shape
   * @param {function} R - Seeded RNG (unused — lines are perfectly straight)
   * @param {string} c0, c1
   * @param {number} o - Opacity
   * @param {number} progress - 0..1
   */
  _renderStroke(ctx, shape, R, c0, c1, o, progress) {
    const a = shape.params;
    const w = Math.max(0.5, a[6]);
    const P = quadPts(a, progress, 1, 28);
    const n = P.length;
    if (n < 2) return;

    ctx.save();
    ctx.lineCap = ctx.lineJoin = 'round';
    ctx.globalAlpha = o;
    ctx.strokeStyle = c0;
    ctx.lineWidth = w;

    ctx.beginPath();
    ctx.moveTo(P[0][0], P[0][1]);
    for (let i = 1; i < n; i++) ctx.lineTo(P[i][0], P[i][1]);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Render a technical pen area fill: outline + parallel cross-hatch lines.
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} shape
   * @param {function} R - Seeded RNG
   * @param {string} c0
   * @param {string} c1
   * @param {number} o
   * @param {number} progress
   */
  _renderFill(ctx, shape, R, c0, c1, o, progress) {
    const P = shapePoly(shape);
    const b = boxOf(P);
    const size = Math.max(b.w, b.h, 2);

    ctx.save();
    ctx.lineCap = ctx.lineJoin = 'round';

    // Outline the shape with the pen
    ctx.globalAlpha = o;
    ctx.strokeStyle = c0;
    const lineW = Math.max(0.5, size * 0.015);
    ctx.lineWidth = lineW;
    outlinePath(ctx, shape);
    ctx.stroke();

    // Cross-hatch fill: parallel lines at a fixed angle
    const gap = this.defaults.hatchGap;
    const ang = this.defaults.hatchAngle;
    const cs = Math.cos(ang);
    const sn = Math.sin(ang);
    const half = size * 0.65;
    const cols = Math.ceil((2 * half) / gap) + 2;

    const hatchPath = new Path2D();
    for (let i = -cols; i <= cols; i++) {
      const d = i * gap;
      // Line across the shape in the hatch direction
      const x0 = b.cx + d * cs - half * sn;
      const y0 = b.cy + d * sn + half * cs;
      const x1 = b.cx + d * cs + half * sn;
      const y1 = b.cy + d * sn - half * cs;

      // Clip to shape bounds (rough)
      if (x0 < b.x0 - gap && x1 < b.x0 - gap) continue;
      if (x0 > b.x1 + gap && x1 > b.x1 + gap) continue;
      if (y0 < b.y0 - gap && y1 < b.y0 - gap) continue;
      if (y0 > b.y1 + gap && y1 > b.y1 + gap) continue;

      hatchPath.moveTo(x0, y0);
      hatchPath.lineTo(x1, y1);
    }

    // Clip to the shape, then stroke the hatch lines
    outlinePath(ctx, shape);
    ctx.clip();
    ctx.globalAlpha = o * 0.85;
    ctx.strokeStyle = c0;
    ctx.lineWidth = lineW;
    ctx.stroke(hatchPath);

    ctx.restore();
  }
}

export default PenStyle;
