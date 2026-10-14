/**
 * graphic.js — Flat Graphic / Stylized style.
 *
 * Algorithm: clean, flat shapes with bold colours and strong contrast.
 * This style strips away the painterly texture — no grain, no pressure
 * variation, no paper — and renders pure, posterised colour blocks.
 *
 *   - Shapes are filled with a solid gradient (start→end colour).
 *   - Strokes (S-type) are clean quadratic lines with round caps.
 *   - Areas (E/B/T/R) get flat gradient fills with a subtle outline.
 *   - Optional halftone effect: pop-art dots on a 45° screen, sized to
 *     match the gradient (small → large) for that classic comic look.
 *   - Bokeh: out-of-focus lights as soft discs with a bright rim.
 *
 * The `mode` parameter selects the sub-style:
 *   'flat'    — solid gradient fills (default)
 *   'halftone' — Ben-Day dots on a 45° screen
 *   'bokeh'   — soft glowing discs
 *   'geometric' — shapes reduced to triangles and bars
 *
 * Reference: RE_BREAKDOWN.md §4.1 (Graphic category), §4.3 (gradient-based)
 */

import {
  rngFor, gaussR, lerp, clamp01,
  hexRgb, shade, shade2, mixHex, rgbaOf,
  shapePoly, boxOf, outlinePath, gradOf, colsOf
} from './base.js';

export class GraphicStyle {
  name = 'graphic';
  category = 'graphic';
  description = 'Clean flat shapes with bold colours and strong contrast. Supports halftone dots, bokeh glow, and geometric reduction sub-modes.';

  defaults = {
    strokeSize: { min: 2, max: 10 },
    mode: 'flat',          // 'flat' | 'halftone' | 'bokeh' | 'geometric'
    contrast: 0.8,         // colour contrast amplification (0..1)
    outlineWidth: 1.5,     // outline stroke width
    outlineDarken: 0.6,    // outline darken factor
    halftoneDotSize: 0.028, // dot radius as fraction of shape size
    halftoneAngle: 0.785,   // 45° screen
    bokehRimLight: 0.55,    // rim brightness for bokeh
    boldColors: true,      // amplify saturation for poster look
    minRegionArea: 200
  };

  generate(analyzer, params) {
    const cfg = { ...this.defaults, ...params };
    const strokes = [];

    if (analyzer && analyzer.edges && analyzer.edges.length > 0) {
      for (const edge of analyzer.edges) {
        const color = analyzer.sampleColor(edge.cx, edge.cy, cfg.boldColors ? 'poster' : 'exact');
        strokes.push(this._makeStroke(edge, color));
      }
    }

    if (analyzer && analyzer.regions) {
      for (const region of analyzer.regions) {
        if (region.area < (cfg.minRegionArea || 200)) continue;
        const color = analyzer.sampleColor(region.cx, region.cy, cfg.boldColors ? 'poster' : 'exact');
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
      seed: edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, w, 0]
    };
  }

  _makeShape(region, color) {
    const c = Array.isArray(color) ? color : [color, color, color];
    const w = Math.max(region.w, region.h) * 0.4;
    return {
      type: 'E',
      params: [region.cx, region.cy, w, w, 0, c, c, 1],
      seed: [region.cx, region.cy, w, 0, 0, 0]
    };
  }

  /**
   * Render a flat-graphic stroke or shape.
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} shape
   * @param {number} progress
   */
  render(ctx, shape, progress = 1) {
    const a = shape.params;
    const [c0, c1, o] = colsOf(shape);
    const R = rngFor(shape.seed || a.slice(0, 9));
    const cfg = { ...this.defaults, ...(shape.styleParams || {}) };

    ctx.save();

    if (cfg.mode === 'halftone') {
      this._renderHalftone(ctx, shape, R, c0, c1, o, progress);
    } else if (cfg.mode === 'bokeh') {
      this._renderBokeh(ctx, shape, R, c0, c1, o);
    } else if (cfg.mode === 'geometric') {
      this._renderGeometric(ctx, shape, R, c0, c1, o);
    } else {
      this._renderFlat(ctx, shape, R, c0, c1, o, progress);
    }

    ctx.restore();
  }

  /** Flat gradient fill with optional outline */
  _renderFlat(ctx, shape, R, c0, c1, o, progress) {
    const a = shape.params;
    ctx.globalAlpha = o;

    if (shape.type === 'S') {
      // Clean stroke with gradient along its length
      const G = gradOf(ctx, shape, [[0, c0], [1, c1]]);
      ctx.strokeStyle = G;
      ctx.lineWidth = a[6];
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.quadraticCurveTo(a[2], a[3], a[4], a[5]);
      ctx.stroke();
    } else {
      // Flat gradient fill
      const G = gradOf(ctx, shape, [[0, c0], [1, c1]]);
      ctx.fillStyle = G;
      outlinePath(ctx, shape);
      ctx.fill();

      // Bold outline
      const dark = shade(c0, -this.defaults.outlineDarken);
      ctx.globalAlpha = o * 0.7;
      ctx.strokeStyle = dark;
      ctx.lineWidth = this.defaults.outlineWidth;
      outlinePath(ctx, shape);
      ctx.stroke();
    }
  }

  /** Halftone: pop-art dots on a 45° screen, sized to the gradient */
  _renderHalftone(ctx, shape, R, c0, c1, o, progress) {
    const a = shape.params;
    const P = shapePoly(shape);
    const b = boxOf(P);
    const size = Math.max(b.w, b.h, 2);
    const dot = Math.max(1.1, Math.min(2.2, size * 0.009));
    const n = Math.min(2400, Math.round(b.w * b.h / (dot * dot * 9)));
    const ang = this.defaults.halftoneAngle;
    const cs = Math.cos(ang);
    const sn = Math.sin(ang);

    // Determine gradient direction for dot size variation
    const axis = shape.t === 'E' || shape.t === 'B' ? a[4] || 0 : 0;

    ctx.globalAlpha = o;
    ctx.fillStyle = mixHex(c0, c1, 0.5);
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const px = b.x0 + R() * b.w;
      const py = b.y0 + R() * b.h;
      // Project onto gradient axis for dot size
      const t = clamp01(((px - b.cx) * Math.cos(axis) + (py - b.cy) * Math.sin(axis)) / (size / 2 + 0.01) * 0.5 + 0.5);
      const r = dot * (0.5 + t * 0.5);
      ctx.moveTo(px + r, py);
      ctx.arc(px, py, r, 0, 7);
    }
    ctx.fill();
  }

  /** Bokeh: soft glowing discs with a bright rim */
  _renderBokeh(ctx, shape, R, c0, c1, o) {
    const a = shape.params;
    const P = shapePoly(shape);
    const b = boxOf(P);
    const r = Math.max(1, Math.max(b.w, b.h) / 2);

    const mid = mixHex(c0, c1, 0.5);
    const G = ctx.createRadialGradient(b.cx, b.cy, 0, b.cx, b.cy, r);
    G.addColorStop(0, mid);
    G.addColorStop(1, rgbaOf(mid, 0));
    ctx.globalAlpha = o * 0.9;
    ctx.fillStyle = G;
    ctx.beginPath();
    ctx.arc(b.cx, b.cy, r, 0, 7);
    ctx.fill();

    // Bright rim
    const rimG = ctx.createRadialGradient(b.cx, b.cy, r * 0.6, b.cx, b.cy, r);
    rimG.addColorStop(0, rgbaOf('#ffffff', this.defaults.bokehRimLight * o));
    rimG.addColorStop(1, rgbaOf('#ffffff', 0));
    ctx.globalAlpha = o;
    ctx.fillStyle = rimG;
    ctx.beginPath();
    ctx.arc(b.cx, b.cy, r, 0, 7);
    ctx.fill();
  }

  /** Geometric: reduce shape to triangles and bars */
  _renderGeometric(ctx, shape, R, c0, c1, o) {
    if (shape.type === 'S') {
      // Just render as a clean stroke
      ctx.globalAlpha = o;
      ctx.strokeStyle = c0;
      ctx.lineWidth = shape.params[6];
      ctx.lineCap = 'round';
      const a = shape.params;
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.quadraticCurveTo(a[2], a[3], a[4], a[5]);
      ctx.stroke();
      return;
    }
    // Fill with solid color, add triangle accents
    const a = shape.params;
    ctx.globalAlpha = o;
    ctx.fillStyle = c0;
    outlinePath(ctx, shape);
    ctx.fill();

    // A few random triangles for geometric flair
    const P = shapePoly(shape);
    const b = boxOf(P);
    const triCount = Math.max(2, Math.min(6, Math.round(b.w * b.h / 2000)));
    ctx.globalAlpha = o * 0.7;
    for (let i = 0; i < triCount; i++) {
      const tri = this._randomTriangle(P, b, R);
      ctx.fillStyle = shade2(c1, (R() - 0.5) * 0.2);
      ctx.beginPath();
      ctx.moveTo(tri[0][0], tri[0][1]);
      ctx.lineTo(tri[1][0], tri[1][1]);
      ctx.lineTo(tri[2][0], tri[2][1]);
      ctx.closePath();
      ctx.fill();
    }
  }

  _randomTriangle(P, b, R) {
    const i = Math.floor(R() * (P.length / 2 - 1));
    const j = Math.floor(R() * (P.length / 2 - 1));
    const k = Math.floor(R() * (P.length / 2 - 1));
    return [
      [P[i * 2], P[i * 2 + 1]],
      [P[j * 2], P[j * 2 + 1]],
      [P[k * 2], P[k * 2 + 1]]
    ];
  }

}

export default GraphicStyle;
