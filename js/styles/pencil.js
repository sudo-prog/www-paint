/**
 * pencil.js — Pencil / Graphite style.
 *
 * Algorithm: stamped brush (p5.brush-inspired, rewritten for canvas).
 * A path is walked in small steps; at each step a circular "stamp" (tip) is
 * stamped onto the canvas. Four effects combine to produce the look:
 *
 *   1. Pressure profile: light → firm → light along the stroke. The stamp
 *      radius follows a logistic curve:  pmin + (pmax - pmin) / (1 + |t-peak|^(2c))
 *      so the line swells in the middle and tapers at each ends.
 *
 *   2. Grain: a fraction of stamps are skipped entirely, breaking the line
 *      up like pencil/graphite on paper. The skip probability *increases* as
 *      the stamp radius gets smaller (lighter pressure = more grain), since
 *      a light touch deposits less graphite and skips more.
 *
 *   3. Scatter: stamps drift sideways off the centreline by a gaussian,
 *      and the step position itself is jittered, giving the hand-drawn feel.
 *
 *   4. Two-pass rendering: a firmer main pass, then a lighter pass offset
 *      to one side at ~50% alpha — mimicking the double-tracked look of a
 *      real pencil dragged across paper grain.
 *
 * For filled shapes (E/B/T/R) the pencil uses close parallel hatching
 * strokes at a slightly random angle — the classic coloured-pencil shading
 * technique.
 *
 * Reference: RE_BREAKDOWN.md §4.2 B (stamped brush), §8.1 (pressure profile)
 */

import {
  rngFor, gaussR, lerp, clamp01,
  quadPts, normalAt, boxOf, offsetPts, shapePoly, outlinePath, rgbToHex
} from './base.js';

export class PencilStyle {
  name = 'pencil';
  category = 'draw';
  description = 'Coloured-pencil lines on paper: stamped, grainy, with a light-firm-light pressure profile. Areas shaded with close parallel strokes.';

  defaults = {
    strokeSize: { min: 4, max: 24 },
    spacing: 0.3,        // stamp spacing as a fraction of brush width
    scatter: 0.55,       // sideways drift of stamps (0 = clean line)
    sharp: 0.4,          // stamp-shape sharpness (affects scatter)
    grain: 0.3,          // fraction of stamps skipped (0 = solid, 0.5 = very broken)
    pressure: { min: 0.55, max: 1.1, peak: 0.4 },  // pressure profile
    peakJitter: 0.2,     // random shift of the pressure peak
    hwJitter: 0.3,       // random shift of the pressure half-width
    secondPassAlpha: 0.5,
    secondPassScatter: 0.9,
    minStep: 0.5,
    maxSteps: 200,
    hatchGap: 1.7,       // gap between hatching strokes (times stroke width)
    hatchJitter: 0.15,   // random jitter in hatching position
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
      seed: edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, w, 0]
    };
  }

  _makeHatching(region, color) {
    const strokes = [];
    const size = Math.max(region.w, region.h);
    const w = lerp(this.defaults.strokeSize.min * 0.6, this.defaults.strokeSize.max * 0.8, Math.random());
    const gap = w * this.defaults.hatchGap;
    const half = size * 0.75;
    const ang = -0.95 + (Math.random() - 0.5) * 0.3;
    const cs = Math.cos(ang);
    const sn = Math.sin(ang);
    const rot = (px, py) => [region.cx + px * cs - py * sn, region.cy + px * sn + py * cs];

    for (let y = -half; y <= half; y += gap * (0.85 + Math.random() * 0.3)) {
      const j = (Math.random() - 0.5) * gap * this.defaults.hatchJitter;
      const p0 = rot(-half + Math.random() * size * 0.15, y + j);
      const mid = rot(0, y);
      const p1 = rot(half - Math.random() * size * 0.15, y - j);
      strokes.push({
        type: 'S',
        params: [p0[0], p0[1], mid[0], mid[1], p1[0], p1[1], w, ang, color, color, 1],
        seed: [p0[0], p0[1], p1[0], p1[1], w, y]
      });
    }
    return strokes;
  }

  /**
   * Render a single stroke using the stamped-brush algorithm.
   * Faithful to Code Painter's stampBuild/stampLine.
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} shape - {type, params, seed}
   * @param {number} progress - 0..1
   */
  render(ctx, shape, progress = 1) {
    const a = shape.params;

    if (shape.type === 'S') {
      const R = rngFor(shape.seed || a.slice(0, 8));
      this._renderStroke(ctx, shape, R, progress);
    } else {
      const R = rngFor(a.slice(0, 6).map((v, i) => (v || 0) + (shape.seed ? shape.seed[i] || 0 : 0)));
      this._renderArea(ctx, shape, R);
    }
  }

  _renderStroke(ctx, shape, R, progress) {
    const a = shape.params;
    const w = Math.max(1.5, Math.min(30, a[6]));
    const P = quadPts(a, progress, 1, 20);
    const fill = a[8] !== undefined ? a[8] : (shape.color0 ? (Array.isArray(shape.color0) ? rgbToHex(shape.color0) : shape.color0) : '#000000');

    // Pass 1: main stamped line (firm)
    const pen1 = {
      w: w * 1.15, spacing: 0.3, scatter: 0.55, sharp: 0.4, grain: 0.3,
      pmin: 0.55, pmax: 1.1, peak: 0.4, hw: 0.5, alpha: a[a.length - 1],
      salt: 1, upto: progress, maxSteps: 200
    };
    const set1 = this._stampBuild(P, pen1, R);

    // Pass 2: lighter, offset to one side, more scatter — the double-track
    // Use seeded R for side decision so it's deterministic per-shape
    const side = w * 0.5 * (R() < 0.5 ? 1 : -1);
    const P2 = offsetPts(P, side);
    const pen2 = {
      w: w * 0.7, spacing: 0.3, scatter: this.defaults.secondPassScatter, sharp: 0.4, grain: 0.5,
      pmin: 0.55, pmax: 1.1, peak: 0.4, hw: 0.5, alpha: a[a.length - 1] * this.defaults.secondPassAlpha,
      salt: 2, upto: progress, maxSteps: 200
    };
    const set2 = this._stampBuild(P2, pen2, R);

    const fillStr = typeof fill === 'string' ? fill : (Array.isArray(fill) ? rgbToHex(fill) : '#000000');

    ctx.save();
    ctx.lineCap = ctx.lineJoin = 'round';
    ctx.fillStyle = fillStr;

    // Pass 1: firm stamps (main stroke)
    ctx.globalAlpha = Math.min(1, set1.base);
    ctx.fill(set1.A);
    ctx.globalAlpha = Math.min(1, set1.base * 0.5);
    ctx.fill(set1.B);

    // Pass 2: lighter offset stamps (double-track effect)
    ctx.globalAlpha = Math.min(1, set2.base);
    ctx.fill(set2.A);
    ctx.globalAlpha = Math.min(1, set2.base * 0.5);
    ctx.fill(set2.B);

    ctx.restore();
  }

  /**
   * Core stamped-brush builder.
   * Walks `lines` (array of polylines), stamps tips with pressure + grain +
   * scatter. Returns { A, B, st, base } where A is the main stamped path, B the
   * secondary (scatter) path, and base is the base alpha.
   * Mirrors Code Painter's stampBuild.
   */
  _stampBuild(lines, o, R) {
    // Derive a per-brush seed from the pen parameters for deterministic jitter
    const seed0 = o.args ? o.args.slice(0, 6).map(v => (v || 0) + o.salt * 0.5) : [o.salt || 1, 0, 0, 0, 0, 0];
    const rnd = rngFor(seed0);
    const A = new Path2D();
    const B = new Path2D();
    const st = [];
    const all = Array.isArray(o) ? [o] : (lines[0] && typeof lines[0][0] === 'number' ? [lines] : lines);

    for (const P of all) {
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
        if (t > o.upto) break;
        const d = t * L;
        while (j < n - 1 && cum[j] < d) j++;
        const seg = cum[j] - cum[j - 1] || 1;
        const f = (d - cum[j - 1]) / seg;
        const px = P[j - 1][0] + (P[j][0] - P[j - 1][0]) * f;
        const py = P[j - 1][1] + (P[j][1] - P[j - 1][1]) * f;

        // Pressure: logistic swell (light-firm-light)
        const pr = o.pmin + (o.pmax - o.pmin) / (1 + Math.pow(Math.abs((t - peak) / hw), 2 * c));

        // Grain: skip stamps — more likely when pressure is light (smaller stamp)
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

  /**
   * Area hatching: parallel stamped strokes across a filled shape.
   * Mirrors Code Painter's pencil area-shading approach.
   */
  _renderArea(ctx, shape, R) {
    const a = shape.params;
    const P = shapePoly(shape);
    const b = boxOf(P);
    const size = Math.max(b.w, b.h, 2);
    const lw = Math.max(0.8, Math.min(2.4, size * 0.02));
    const gap = lw * 1.7;
    const half = size * 0.75;
    const ang = -0.95 + (R() - 0.5) * 0.3;
    const cs = Math.cos(ang);
    const sn = Math.sin(ang);
    const rot = (px, py) => [b.cx + px * cs - py * sn, b.cy + px * sn + py * cs];
    const fill = a[6] !== undefined ? a[6] : (shape.color0 ? (Array.isArray(shape.color0) ? rgbToHex(shape.color0) : shape.color0) : '#000000');
    const fillStr = typeof fill === 'string' ? fill : (Array.isArray(fill) ? rgbToHex(fill) : '#000000');

    ctx.save();
    ctx.lineCap = ctx.lineJoin = 'round';
    outlinePath(ctx, shape);
    ctx.clip();

    const passes = size > 40 && R() < 0.5 ? 2 : 1;
    for (let pass = 0; pass < passes; pass++) {
      const lines = [];
      for (let y = -half; y <= half; y += gap * (0.85 + R() * 0.3)) {
        const j = (R() - 0.5) * gap * 0.4;
        lines.push([rot(-half + R() * size * 0.15, y + j), rot(half - R() * size * 0.15, y - j)]);
      }

      for (const [p0, p1] of lines) {
        const mid = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2];
        const pen = {
          w: lw * 1.9, spacing: 0.7, scatter: 0.55, sharp: 0.4, grain: 0.3,
          pmin: 0.55, pmax: 1.1, peak: 0.5, hw: 0.5,
          alpha: a[a.length - 1] * (pass ? 0.55 : 0.95), salt: 3 + pass,
          maxSteps: Math.max(4, Math.min(60, Math.round(700 / (lines.length || 1))))
        };
        const set = this._stampBuild([[p0, mid, p1]], pen, R);
        ctx.globalAlpha = Math.min(1, set.base);
        ctx.fill(set.A);
        ctx.globalAlpha = Math.min(1, set.base * 0.5);
        ctx.fill(set.B);
      }
    }
    ctx.restore();
  }
}

export default PencilStyle;
