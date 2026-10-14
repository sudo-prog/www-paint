/**
 * oil.js — Oil / Acrylic style.
 *
 * Algorithm: bristle brush rendering. Each brush stroke is composed of
 * multiple bristles, each carrying its own color and ridge. The brush:
 *
 *   - Deposits thick, glossy paint (oil) or flatter, streaky paint (acrylic)
 *   - Each bristle contributes a ridge of colour along the stroke path
 *   - Runs dry towards the end (paint thins out, bristles show)
 *   - Oil drags wet paint along; the end runs dry
 *
 * For filled shapes, the area is filled the way a painter fills it: brush
 * strokes side by side across the shape, each ending at its edge.
 *
 * Reference: RE_BREAKDOWN.md §4.2 D (bristle brush), §4.3 (style rendering)
 */

import {
  rngFor, gaussR, lerp, clamp01,
  hexRgb, shade, shade2, mixHex, rgbaOf,
  quadPts, normalAt, boxOf, shapePoly, outlinePath, offsetPts,
  shapeAxis, inPoly, colsOf, rgbToHex
} from './base.js';

/**
 * Resolve colors from a shape, handling both formats:
 *  - Engine format: shape.color0/color1 are RGB arrays, shape.alpha is number
 *  - Style format: colors embedded in shape.params
 * Returns [c0, c1, o] as hex strings and alpha.
 * @param {object} shape
 * @returns {[string, string, number]}
 */
function resolveColors(shape) {
  // If shape has color0/color1 properties (engine format), use those
  if (Array.isArray(shape.color0) || Array.isArray(shape.color1)) {
    const c0 = Array.isArray(shape.color0) ? rgbToHex(shape.color0) : (typeof shape.color0 === 'string' ? shape.color0 : '#000000');
    const c1 = Array.isArray(shape.color1) ? rgbToHex(shape.color1) : (typeof shape.color1 === 'string' ? shape.color1 : '#000000');
    const o = typeof shape.alpha === 'number' ? shape.alpha : 1;
    return [c0, c1, o];
  }
  // Otherwise use colsOf which reads from params (style format)
  return colsOf(shape);
}

export class OilStyle {
  name = 'oil';
  category = 'paint';
  description = 'A loaded bristles brush in thick, glossy oil paint — both colours side by side, ridges from every bristle, the end running dry. Acrylic mode gives flatter, streaky paint.';

  defaults = {
    strokeSize: { min: 5, max: 25 },
    bristleCount: 12,    // number of bristles per stroke (4–16)
    bristleVar: 0.5,     // unevenness of bristle widths
    dryEnd: 0.55,        // fraction of stroke where paint starts thinning
    dryTaper: 0.8,       // how sharply it runs dry at the end
    ridgeAmplitude: 0.35, // per-bristle colour variation
    wetDrag: 0.6,        // how much wet paint is dragged behind (oil vs acrylic)
    glossy: true,        // oil = glossy (highlights), acrylic = satin (matte)
    bristle: 'oil'
  };

  /**
   * Propose candidate strokes for this style.
   * @param {object} analyzer - Image analyzer with edges[], regions[]
   * @param {object} params - User/style parameters
   * @returns {Array} shape candidates
   */
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
        strokes.push(...this._makeFill(region, color));
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
    const strokes = [];
    const an = Math.random() * Math.PI;
    const size = Math.max(region.w, region.h);
    const sw = Math.max(3, Math.min(size / 2.2, size / 3));
    const n = Math.max(1, Math.ceil(size / (sw * 0.8)));

    for (let k = 0; k < n; k++) {
      const t = k / Math.max(1, n - 1);
      const colorA = rgbToHex(mixHex(c, c, t));
      const colorB = rgbToHex(mixHex(c, c, Math.min(1, t + 0.25)));
      strokes.push({
        type: 'S',
        params: [region.cx, region.cy, region.cx, region.cy, region.cx, region.cy, sw, an, colorA, colorB, 1],
        color0: c,
        color1: c,
        alpha: 1,
        seed: [region.cx + k, region.cy + k, sw, an, k, 1],
        fillStroke: true
      });
    }
    return strokes;
  }

  /**
   * Render an oil/acrylic stroke using the bristle brush algorithm.
   * Each bristle is a ribbon of its own colour/ridge, running dry at the end.
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} shape
   * @param {number} progress - 0..1
   */
  render(ctx, shape, progress = 1) {
    const R = rngFor(shape.seed || shape.params.slice(0, 6));
    const [c0, c1, o] = resolveColors(shape);

    if (shape.type === 'S') {
      this._renderStroke(ctx, shape, R, c0, c1, o, progress);
    } else {
      this._renderArea(ctx, shape, R, c0, c1, o);
    }
  }

  /**
   * Bristle brush stroke: multiple bristles side by side, each carrying
   * its own colour and ridge, running dry towards the end.
   *
   * Features:
   *  - Per-bristle color variation via blend + tone offset
   *  - Pressure tapering: stroke gets thinner at the end (dryFactor)
   *  - Wet paint dragging: oil drags a translucent trail behind the brush
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} shape - {type, params, seed}
   * @param {function} R - Seeded RNG
   * @param {string} c0 - Start color (hex)
   * @param {string} c1 - End color (hex)
   * @param {number} o - Opacity
   * @param {number} progress - 0..1
   */
  _renderStroke(ctx, shape, R, c0, c1, o, progress) {
    const a = shape.params;
    const w = Math.max(2, a[6]);
    const P = quadPts(a, progress, 1, 48);
    const bristles = this._makeBristles(w, R);

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let i = 0; i < bristles.length; i++) {
      const br = bristles[i];
      const lo = br.lo;
      const hi = br.hi;
      const brW = w * (hi - lo);

      // Per-bristle colour: blend c0->c1 across the brush + tone variation
      const mixT = br.mixAt;
      const brC0 = shade2(mixHex(c0, c1, mixT), br.tone);
      const brC1 = shade2(mixHex(c0, c1, clamp01(mixT + 0.12)), br.tone);

      // Build the bristle ribbon along the path
      const L = [];
      const Rt = [];
      const N = P.length;

      for (let j = 0; j < N; j++) {
        const s = j / Math.max(1, N - 1);
        const [nx, ny] = normalAt(P, j);

        // Pressure tapering: paint thins out at the end
        const dryFactor = s > this.defaults.dryEnd
          ? Math.pow(1 - (s - this.defaults.dryEnd) / (1 - this.defaults.dryEnd), this.defaults.dryTaper)
          : 1;

        // Per-bristle width with unevenness + dry taper
        const hw = brW * (0.5 + (R() - 0.5) * this.defaults.bristleVar) * Math.max(0.3, dryFactor);

        L.push([P[j][0] + nx * hw, P[j][1] + ny * hw]);
        Rt.push([P[j][0] - nx * hw, P[j][1] - ny * hw]);
      }

      // Fill the bristle ribbon with a gradient along the stroke direction
      ctx.globalAlpha = o * (0.8 + R() * 0.2);
      const G = ctx.createLinearGradient(P[0][0], P[0][1], P[N - 1][0], P[N - 1][1]);
      G.addColorStop(0, brC0);
      G.addColorStop(1, brC1);
      ctx.fillStyle = G;
      ctx.beginPath();
      L.forEach((p, j) => ctx[j ? 'lineTo' : 'moveTo'](p[0], p[1]));
      for (let j = Rt.length - 1; j >= 0; j--) ctx.lineTo(Rt[j][0], Rt[j][1]);
      ctx.closePath();
      ctx.fill();

      // Glossy highlight on oil (acrylic = matte, no highlight)
      if (this.defaults.glossy) {
        ctx.globalAlpha = o * 0.3;
        ctx.strokeStyle = shade(brC1, 0.4);
        ctx.lineWidth = Math.max(0.5, brW * 0.15);
        ctx.beginPath();
        const off = brW * 0.15;
        for (let j = 0; j < N; j++) {
          const [nx, ny] = normalAt(P, j);
          ctx.lineTo(P[j][0] + nx * off, P[j][1] + ny * off);
        }
        ctx.stroke();
      }
    }

    // Wet paint dragging: stroke picks up color from previous strokes
    if (this.defaults.wetDrag > 0 && progress >= 1) {
      this._wetDrag(ctx, P, w, c0, c1, o, R);
    }

    ctx.restore();
  }

  /**
   * Wet paint dragging behind the brush (oil effect).
   * Pulls a translucent trail of mixed color behind the main stroke,
   * simulating wet paint being dragged on the canvas.
   * @param {CanvasRenderingContext2D} ctx
   * @param {Array} P - Sampled points along the stroke
   * @param {number} w - Brush width
   * @param {string} c0 - Start color (hex)
   * @param {string} c1 - End color (hex)
   * @param {number} o - Opacity
   * @param {function} R - Seeded RNG
   */
  _wetDrag(ctx, P, w, c0, c1, o, R) {
    const offP = offsetPts(P, -w * 0.65);
    ctx.globalAlpha = o * 0.15 * this.defaults.wetDrag;
    ctx.fillStyle = mixHex(c0, c1, 0.5);
    ctx.beginPath();
    offP.forEach((p, i) => ctx[i ? 'lineTo' : 'moveTo'](p[0], p[1]));
    ctx.closePath(); ctx.fill('evenodd');
  }

  /**
   * Fill an area (E/B/T/R) with bristle strokes side by side,
   * each ending at the shape's edge — like a painter filling in.
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} shape
   * @param {function} R - Seeded RNG
   * @param {string} c0 - Start color
   * @param {string} c1 - End color
   * @param {number} o - Opacity
   */
  _renderArea(ctx, shape, R, c0, c1, o) {
    const a = shape.params;
    const P = shapePoly(shape);
    const b = boxOf(P);
    const an = (shape.type === 'E' || shape.type === 'B' || shape.type === 'R') ? a[4] : R() * Math.PI;
    const dx = Math.cos(an);
    const dy = Math.sin(an);
    const nx = -dy;
    const ny = dx;

    let lo = 1e9, hi = -1e9, lo2 = 1e9, hi2 = -1e9;
    for (let i = 0; i < P.length; i += 2) {
      const u = P[i] * nx + P[i + 1] * ny;
      const v = P[i] * dx + P[i + 1] * dy;
      lo = Math.min(lo, u); hi = Math.max(hi, u);
      lo2 = Math.min(lo2, v); hi2 = Math.max(hi2, v);
    }

    const across = hi - lo;
    const sw = Math.max(3, Math.min(across / 2.2, Math.max(b.w, b.h) / 3));
    const n = Math.max(1, Math.ceil(across / (sw * 0.8)));

    ctx.save();
    outlinePath(ctx, shape);
    ctx.clip();

    for (let k = 0; k < n; k++) {
      const u = lo + (k + 0.5) * across / n + (R() - 0.5) * sw * 0.3;
      let f = null;
      let l = null;
      for (let j = 0; j <= 40; j++) {
        const v = lo2 + (hi2 - lo2) * j / 40;
        const px = nx * u + dx * v;
        const py = ny * u + dy * v;
        if (inPoly(P, px, py)) {
          if (!f) f = [px, py];
          l = [px, py];
        }
      }
      if (!f || Math.hypot(l[0] - f[0], l[1] - f[1]) < sw * 0.5) continue;

      const A = f;
      const B = l;
      const t = k / Math.max(1, n - 1);
      const ca = mixHex(c0, c1, t);
      const cb = mixHex(c0, c1, Math.min(1, t + 0.25));

      const strokeShape = {
        type: 'S',
        params: [A[0], A[1], (A[0] + B[0]) / 2, (A[1] + B[1]) / 2, B[0], B[1], sw, an, ca, cb, o],
        color0: hexRgb(ca),
        color1: hexRgb(cb),
        alpha: o,
        seed: [a[0] + k * 7.1, a[1] + k * 3.3, a[2], a[3], k, 1]
      };
      const R2 = rngFor(strokeShape.seed);
      this._renderStroke(ctx, strokeShape, R2, ca, cb, o, 1);
    }

    ctx.restore();
  }

  /**
   * Create a set of bristles with uneven widths and per-bristle properties.
   * Mirrors Code Painter's bristleSet.
   * @param {number} r - Brush radius (half-width)
   * @param {function} R - Seeded RNG
   * @returns {Array<object>} Bristle descriptors
   */
  _makeBristles(r, R) {
    const n = Math.max(4, Math.min(16, Math.round(r / 3.2)));
    const b = [];
    const cuts = [0];
    for (let i = 1; i < n; i++) {
      cuts.push(i / n + (R() - 0.5) * 0.6 / n);
    }
    cuts.push(1);
    for (let i = 0; i < n; i++) {
      b.push({
        lo: cuts[i],
        hi: cuts[i + 1],
        amp: 0.35 + 0.65 * R(),
        end: 0.55 + 0.45 * Math.pow(R(), 0.5),
        tone: (R() - 0.5) * 0.12,
        mixAt: clamp01((i + 0.5) / n + (R() - 0.5) * 0.3)
      });
    }
    return b;
  }
}

export default OilStyle;
