/**
 * charcoal.js — Charcoal drawing style.
 *
 * Algorithm: stamped brush with heavy grain and soft edges, smudgy look.
 *
 * Based on Code Painter's charcoal renderer, which layers three effects:
 *   1. A faint grey smudge stroke (wide, low-opacity) down the centre —
 *      simulating charcoal dust smeared by the paper's texture.
 *   2. A wider charcoal-grey stroke at reduced opacity — the body of
 *      the charcoal mark, in the paper's grain.
 *   3. Two passes of stamped "dust" — coarse charcoal crumbs scattered
 *      along the stroke with high scatter and high grain, building up
 *      density at the centre and a ragged edge.
 *
 * The pressure profile follows p5.brush's 'charcoal' brush parameters
 * (high grain, soft tips): pmin ~0.55, pmax ~1.15, peak at 0.35.
 *
 * For filled areas, the charcoal fills the shape with charcoal grey
 * at reduced opacity, with a smudged rim around the edge.
 *
 * Reference: RE_BREAKDOWN.md §4.2 B (stamped brush), p5.brush stroke.js
 *            charcoal brush parameters (high grain, soft tips)
 *            Code Painter STYLE_DRAW.charcoal
 */

import {
  rngFor, gaussR, lerp, clamp01,
  quadPts, normalAt, offsetPts, shapePoly, outlinePath,
  boxOf, shade2, mixHex, shade, hexRgb
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
  // Fallback: colors embedded in params
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

/**
 * Core stamped-brush builder — shared with pencil, adapted for charcoal.
 *
 * Mirrors Code Painter's stampBuild and p5.brush's stamped tip rendering.
 * Walks a polyline, stamps tips with pressure + grain + scatter.
 * Returns { A, B, st, base } where A is the main stamped path, B the
 * secondary (scatter) path, and base is the base alpha.
 *
 * @param {Array} lines - Array of polylines
 * @param {object} o - Pen parameters: w, spacing, scatter, sharp, grain,
 *                     pmin, pmax, peak, hw, minStep, maxSteps, alpha, upto
 * @param {function} R - Seeded RNG
 * @returns {{A:Path2D, B:Path2D, st:Array, base:number}}
 */
function stampBuild(lines, o, R) {
  const A = new Path2D();
  const B = new Path2D();
  const st = [];

  for (const P of lines) {
    const n = P.length;
    if (n < 2) continue;
    const cum = [0];
    for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
    const L = cum[n - 1];
    if (L < 0.01) continue;

    const step = Math.max(o.minStep || 0.5, o.w * o.spacing);
    const steps = Math.min(o.maxSteps || 240, Math.max(2, Math.ceil(L / step)));
    const peak = o.peak + (R() - 0.5) * 0.2;
    const hw = o.hw * (0.85 + R() * 0.3);
    const c = 1 + R() * 0.6;
    let j = 1;

    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      if (t > (o.upto !== undefined ? o.upto : 1)) break;
      const d = t * L;
      while (j < n - 1 && cum[j] < d) j++;
      const seg = cum[j] - cum[j - 1] || 1;
      const f = (d - cum[j - 1]) / seg;
      const px = P[j - 1][0] + (P[j][0] - P[j - 1][0]) * f;
      const py = P[j - 1][1] + (P[j][1] - P[j - 1][1]) * f;

      // Pressure: logistic swell (light-firm-light)
      const pr = o.pmin + (o.pmax - o.pmin) / (1 + Math.pow(Math.abs((t - peak) / hw), 2 * c));

      // Grain: skip stamps — more likely when pressure is light
      if (R() < o.grain * (0.62 - 0.4 * Math.min(1, pr))) continue;

      // Scatter: sideways drift + step jitter
      const [nx, ny] = normalAt(P, j);
      const sc = gaussR(R) * o.scatter * o.w * 0.5 * (1.15 - o.sharp * 0.5);
      const par = (R() - 0.5) * step;
      const r = Math.max(0.4, o.w * 0.5 * (0.4 + 0.6 * Math.min(1.1, pr)) * (0.8 + R() * 0.4));

      const sx = px - ny * sc + nx * par;
      const sy = py + nx * sc + ny * par;
      const Q = R() < 0.55 ? A : B;
      if (r < 1.5) { Q.rect(sx - r, sy - r, r * 2, r * 2); }
      else { Q.moveTo(sx + r, sy); Q.arc(sx, sy, r, 0, 7); }
      st.push(sx, sy, r, Q === A ? 0 : 1, t);
    }
  }
  return { A, B, st, base: o.alpha * (0.8 + R() * 0.2) };
}

export class CharcoalStyle {
  name = 'charcoal';
  category = 'draw';
  description = 'Heavy grain, soft edges, smudgy look. Stamped brush with a firm-middle / very-light-at-ends pressure profile, rendered in multiple overlapping passes with decreasing opacity. Uses charcoal grey tones sampled from the source.';

  defaults = {
    strokeSize: { min: 3, max: 16 },
    spacing: 0.35,
    scatter: 1.7,        // wide scatter for smudgy charcoal
    sharp: 0.4,          // softer stamp shape
    grain: 0.55,         // high grain — many stamps skipped
    pressure: { min: 0.55, max: 1.3, peak: 0.35 },  // firm middle, light ends
    passes: 3,
    passOpacity: [0.42, 0.30, 0.18],  // decreasing opacity per pass
    charcoalGrey: -0.5,  // darken source colour to charcoal grey
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
        strokes.push(...this._makeHatching(region, color));
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

  _makeHatching(region, color) {
    const strokes = [];
    const size = Math.max(region.w, region.h);
    const w = lerp(this.defaults.strokeSize.min * 0.5, this.defaults.strokeSize.max * 0.7, Math.random());
    const gap = w * 2;
    const half = size * 0.75;
    const ang = -0.95 + (Math.random() - 0.5) * 0.3;

    for (let y = -half; y <= half; y += gap * (0.85 + Math.random() * 0.3)) {
      const j = (Math.random() - 0.5) * gap * 0.2;
      strokes.push({
        type: 'S',
        params: [
          region.cx - half + Math.random() * size * 0.15, region.cy + y + j,
          region.cx, region.cy + y,
          region.cx + half - Math.random() * size * 0.15, region.cy + y - j,
          w, ang, color, color, 1
        ],
        seed: [region.cx, region.cy, w, y]
      });
    }
    return strokes;
  }

  render(ctx, shape, progress = 1) {
    const a = shape.params;
    const [c0, c1, o] = resolveColors(shape);

    if (shape.type === 'S') {
      const R = rngFor(shape.seed || a.slice(0, 8));
      this._renderStroke(ctx, shape, R, c0, c1, o, progress);
    } else {
      const R = rngFor(a.slice(0, 6));
      this._renderArea(ctx, shape, R, c0, c1, o);
    }
  }

  /**
   * Multi-pass charcoal stroke rendering.
   *
   * Based on Code Painter's charcoal function:
   *   1. A faint grey smudge stroke (wide, low-opacity)
   *   2. A charcoal-grey body stroke (paper grain texture)
   *   3. Two passes of stamped dust (coarse + ragged crumbs)
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} shape
   * @param {function} R - Seeded RNG
   * @param {string} c0 - Colour hex
   * @param {string} c1 - Colour hex
   * @param {number} o - Opacity
   * @param {number} progress - 0..1
   */
  _renderStroke(ctx, shape, R, c0, c1, o, progress) {
    const a = shape.params;
    const w = Math.max(1.5, Math.min(20, a[6]));

    const col = shade2(c0, this.defaults.charcoalGrey);
    const colAlt = shade2(c1, this.defaults.charcoalGrey);
    const inkGrey = shade2(mixHex(c0, c1, 0.3), this.defaults.charcoalGrey);

    ctx.save();
    ctx.lineCap = ctx.lineJoin = 'round';

    const P_all = quadPts(a, progress, 1, 24);

    // Pass 1: faintest smudge — wide, very transparent grey stroke
    ctx.globalAlpha = o * 0.1;
    ctx.strokeStyle = mixHex(c0, c1, 0.5);
    ctx.lineWidth = a[6] * 1.5;
    ctx.beginPath();
    for (let i = 0; i < P_all.length; i++) {
      i === 0 ? ctx.moveTo(P_all[i][0], P_all[i][1]) : ctx.lineTo(P_all[i][0], P_all[i][1]);
    }
    ctx.stroke();

    // Pass 2: body stroke — charcoal grey, reduced width
    ctx.globalAlpha = Math.min(1, o * 0.7);
    ctx.strokeStyle = col;
    ctx.lineWidth = a[6] * 0.7;
    ctx.beginPath();
    for (let i = 0; i < P_all.length; i++) {
      i === 0 ? ctx.moveTo(P_all[i][0], P_all[i][1]) : ctx.lineTo(P_all[i][0], P_all[i][1]);
    }
    ctx.stroke();

    // Pass 3: stamped dust — thick, rough charcoal crumbs
    const P = quadPts(a, 1, 1, 20);
    const dustBase = {
      w: Math.max(1.5, w * 1.1), pmin: 0.55, pmax: 1.3, peak: 0.35, hw: 0.5,
      minStep: 0.55, maxSteps: 200, sharp: 0.68
    };

    // First dust pass — dense, coarse crumbs
    const set1 = stampBuild([P], {
      ...dustBase, spacing: 0.1, scatter: 1.7, grain: 0.55,
      alpha: Math.min(1, o * 1.1), upto: progress,
      id: 'c', salt: 1
    }, R);
    ctx.globalAlpha = Math.min(1, set1.base);
    ctx.fillStyle = inkGrey;
    ctx.fill(set1.A);
    ctx.globalAlpha = Math.min(1, set1.base * 0.5);
    ctx.fill(set1.B);

    // Second dust pass — ragged crumbs along edges
    const set2 = stampBuild([P], {
      ...dustBase, spacing: 0.2, scatter: 2.6, grain: 0.8,
      w: dustBase.w * 0.8, alpha: o * 0.7, upto: progress,
      id: 'd', salt: 2
    }, R);
    ctx.globalAlpha = Math.min(1, set2.base);
    ctx.fillStyle = colAlt;
    ctx.fill(set2.A);
    ctx.globalAlpha = Math.min(1, set2.base * 0.5);
    ctx.fillStyle = colAlt;
    ctx.fill(set2.B);

    ctx.restore();
  }

  /**
   * Area fill: charcoal dust filling the shape with a smudged rim.
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} shape
   * @param {function} R - Seeded RNG
   * @param {string} c0
   * @param {string} c1
   * @param {number} o
   */
  _renderArea(ctx, shape, R, c0, c1, o) {
    const a = shape.params;
    const P = shapePoly(shape);
    const b = boxOf(P);
    const size = Math.max(b.w, b.h, 2);

    ctx.save();
    ctx.lineCap = ctx.lineJoin = 'round';

    // Smudged rim — faint grey stroke around the edge
    ctx.globalAlpha = o * 0.12;
    ctx.strokeStyle = c0;
    ctx.lineWidth = size * 0.18;
    outlinePath(ctx, shape);
    ctx.stroke();

    // Fill with charcoal grey + paper grain texture
    const mix = mixHex(c0, c1, 0.5);
    const greyFill = shade2(mix, this.defaults.charcoalGrey);

    ctx.globalAlpha = o * 0.3;
    ctx.fillStyle = mix;
    outlinePath(ctx, shape);
    ctx.fill();

    ctx.globalAlpha = Math.min(1, o * 0.85);
    ctx.fillStyle = greyFill;
    outlinePath(ctx, shape);
    ctx.fill();

    ctx.restore();
  }
}

export default CharcoalStyle;
