/**
 * sumi.js — Sumi ink style.
 *
 * Algorithm: bold wet ink strokes that vary in width like a loaded brush,
 * with slight bleed at the edges and tapered ends. Colour is built up
 * through low-alpha layering (multiple passes) so that overlaps darken
 * naturally, just like sumi-e ink on paper.
 *
 * Key differences from marker:
 *   - No grain — edges are mostly clean but with a subtle wet-bleed blur
 *   - Variable width (swells in the middle, tapers at ends) via a sinusoid
 *   - Low base alpha (0.45) so dense regions build up through overlap
 *   - Ends taper to a point (brush lift)
 *
 * Reference: RE_BREAKDOWN.md §4.2 (ink/brush pressure), p5.brush sumi brush
 */

import {
  rngFor, gaussR, lerp, clamp01,
  quadPts, normalAt, boxOf, shapePoly, outlinePath,
  shade2, mixHex, rgbaOf
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

export class SumiStyle {
  name = 'sumi';
  category = 'paint';
  description = 'Bold wet sumi-e ink: loaded brush strokes that swell in the middle and taper to a point at each end. Low-alpha layering lets dense regions build up naturally through overlap, with a subtle wet-bleed softness at the edges.';

  defaults = {
    strokeSize: { min: 5, max: 28 },
    opacity: 0.45,          // base alpha — layers build up
    taper: 0.72,            // how strongly ends narrow (0=uniform, 1=pinpoint)
    swell: 0.55,            // extra width in the middle (fraction of base)
    bleed: 0.08,            // wet-bleed spread beyond the path (fraction of width)
    bleedOpacity: 0.18,     // opacity of the bleed halo
    passes: 3,              // number of offset passes for opacity buildup
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
        strokes.push(this._makePool(region, color));
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

  _makePool(region, color) {
    const c = Array.isArray(color) ? color : [color, color, color];
    return {
      type: 'E',
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
      this._renderPool(ctx, shape, R, c0, c1, o);
    }
  }

  /**
   * Render a sumi ink stroke: swell + taper ribbon with wet-bleed halo.
   *
   * The stroke width follows a sinusoidal swell (tapered at ends, fat in the
   * middle). Multiple offset passes at low alpha build up density where strokes
   * overlap — mimicking layered wet ink.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} shape
   * @param {function} R - Seeded RNG
   * @param {string} c0, c1 - Colour hexes
   * @param {number} o - Opacity
   * @param {number} progress - 0..1
   */
  _renderStroke(ctx, shape, R, c0, c1, o, progress) {
    const a = shape.params;
    const w = Math.max(2, a[6]);
    const P = quadPts(a, progress, 1, 28);
    const n = P.length;
    if (n < 3) return;

    // Width envelope: tapers at both ends, swells in middle
    const wid = (i) => {
      const t = i / (n - 1);
      const swell = Math.sin(Math.PI * t);
      const e = Math.pow(swell, 0.55); // round the swell tip for smoother ends
      const taper = 1 - this.defaults.taper * (1 - e); // 1 at ends, >1 mid
      return w * (0.55 + this.defaults.swell * e) * taper;
    };

    // Main ribbon (built once, stroked multiple times at offset)
    const L = [];
    const Rt = [];
    for (let i = 0; i < n; i++) {
      const [nx, ny] = normalAt(P, i);
      const h = wid(i) / 2;
      L.push([P[i][0] + nx * h, P[i][1] + ny * h]);
      Rt.push([P[i][0] - nx * h, P[i][1] - ny * h]);
    }

    ctx.save();
    ctx.lineCap = ctx.lineJoin = 'round';

    // Multiple passes — offset slightly to simulate wet-ink buildup
    const passes = this.defaults.passes;
    for (let p = 0; p < passes; p++) {
      const jx = (R() - 0.5) * w * 0.04;
      const jy = (R() - 0.5) * w * 0.04;
      const passAlpha = o * this.defaults.opacity * (0.85 - p * 0.18);

      ctx.globalAlpha = passAlpha;
      ctx.fillStyle = c0;
      ctx.beginPath();
      ctx.moveTo(L[0][0] + jx, L[0][1] + jy);
      for (let i = 1; i < n; i++) ctx.lineTo(L[i][0] + jx, L[i][1] + jy);
      for (let i = n - 1; i >= 0; i--) ctx.lineTo(Rt[i][0] + jx, Rt[i][1] + jy);
      ctx.closePath();
      ctx.fill();
    }

    // Wet-bleed halo — faint outer glow that bleeds into the paper
    ctx.globalAlpha = o * this.defaults.bleedOpacity;
    ctx.strokeStyle = shade2(c0, -0.15);
    ctx.lineWidth = w * (1 + this.defaults.bleed);
    ctx.filter = 'blur(1.5px)';
    ctx.beginPath();
    ctx.moveTo(P[0][0], P[0][1]);
    for (let i = 1; i < n; i++) ctx.lineTo(P[i][0], P[i][1]);
    ctx.stroke();
    ctx.filter = 'none';

    // Pinpoint at the tip (ink loaded at the start)
    ctx.globalAlpha = o * 0.9;
    ctx.fillStyle = shade2(c0, -0.25);
    ctx.beginPath();
    ctx.arc(P[0][0], P[0][1], wid(0) * 0.45, 0, 7);
    ctx.fill();

    ctx.restore();
  }

  /**
   * Render an ink pool (for E/B/T/R shapes).
   * A soft radial fill clipped to the shape, darker at the rim.
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} shape
   * @param {function} R - Seeded RNG
   * @param {string} c0
   * @param {string} c1
   * @param {number} o
   */
  _renderPool(ctx, shape, R, c0, c1, o) {
    const a = shape.params;
    const P = shapePoly(shape);
    const b = boxOf(P);
    const r = Math.max(1, Math.max(b.w, b.h) / 2);

    // Radial gradient: denser (darker) at the rim where ink pools
    const G = ctx.createRadialGradient(b.cx, b.cy, 0, b.cx, b.cy, r);
    G.addColorStop(0, rgbaOf(c0, 0.42 * o));
    G.addColorStop(0.72, rgbaOf(mixHex(c0, c1, 0.3), 0.72 * o));
    G.addColorStop(1, rgbaOf(shade2(c0, -0.25), 0.9 * o));

    ctx.save();
    outlinePath(ctx, shape);
    ctx.clip();
    ctx.fillStyle = G;
    outlinePath(ctx, shape);
    ctx.fill();

    // Darker rim line — pooled ink edge
    ctx.globalAlpha = o * 0.35;
    ctx.strokeStyle = shade2(c0, -0.3);
    ctx.lineWidth = Math.max(0.8, r * 0.05);
    outlinePath(ctx, shape);
    ctx.stroke();

    ctx.restore();
  }
}

export default SumiStyle;
