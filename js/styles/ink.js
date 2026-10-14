/**
 * ink.js — Ink / Pen style.
 *
 * Algorithm: a loaded ink brush that swells and tapers along its stroke,
 * with a dry-hair tail that breaks into separate streaks at the end.
 * For filled shapes, ink pools denser at the rim with a soft feathered edge.
 *
 * Stroke rendering (from Code Painter's `ink` style):
 *   - The loaded part is a single filled ribbon whose width follows
 *     w * (0.22 + 0.9 * sin(PI * progress)^0.55)  — fat in the middle,
 *     tapering at both ends.
 *   - Where the brush touches down: a darkened dot.
 *   - The tail (last ~34% of the path) breaks into ~7 parallel dry-hairs
 *     that fade out, each stopping at a random point — the brush running
 *     dry.
 *
 * Pool rendering (for E/B/T/R shapes): a radial gradient denser at the rim,
 * with a ragged feathered edge (hobbsGrow-style displacement).
 *
 * Reference: RE_BREAKDOWN.md §4.2 (stamped brush / ink), §8.2 (edge growth)
 */

import {
  rngFor, gaussR, lerp, clamp01,
  hexRgb, shade, shade2, mixHex, rgbaOf,
  quadPts, normalAt, boxOf, shapePoly, outlinePath, raggedPath,
  gradOf, colsOf
} from './base.js';

export class InkStyle {
  name = 'ink';
  category = 'paint';
  description = 'A loaded ink brush: strokes swell and taper, tails breaking into dry streaks. Filled areas pool denser at the rim with a soft feathered edge.';

  defaults = {
    strokeSize: { min: 2, max: 12 },
    taper: 0.55,       // how strongly the stroke narrows at the ends (0=uniform, 1=full taper)
    hairCount: 7,      // number of dry-hair streaks in the tail
    tailStart: 0.66,   // fraction along the stroke where the loaded part ends
    poolRimDarken: 0.3, // darkening at the ink pool rim
    poolFeather: 0.035  // edge fray amount for pools
  };

  generate(analyzer, params) {
    const cfg = { ...this.defaults, ...params };
    const strokes = [];

    if (analyzer && analyzer.edges && analyzer.edges.length > 0) {
      for (const edge of analyzer.edges) {
        const color = analyzer.sampleColor(edge.cx, edge.cy);
        // Ink tends darker — sample the darker side
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
      seed: edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, w, 0]
    };
  }

  _makePool(region, color) {
    const c = Array.isArray(color) ? color : [color, color, color];
    const w = Math.max(region.w, region.h) * 0.3;
    return {
      type: 'E',
      params: [region.cx, region.cy, w, w, 0, c, c, 1],
      seed: [region.cx, region.cy, w, 0, 0, 0]
    };
  }

  /**
   * Render an ink-brush stroke or pool.
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} shape - {type, params, seed}
   * @param {number} progress - 0..1 animation progress
   */
  render(ctx, shape, progress = 1) {
    const a = shape.params;
    const R = rngFor(shape.seed || a.slice(0, 9));
    const [c0, c1, o] = colsOf(shape);

    ctx.save();
    ctx.lineCap = ctx.lineJoin = 'round';

    if (shape.type === 'S') {
      this._renderStroke(ctx, a, R, c0, c1, o, progress);
    } else {
      this._renderPool(ctx, shape, R, c0, c1, o);
    }

    ctx.restore();
  }

  /**
   * Render a single ink-brush stroke: loaded ribbon + dry-hair tail.
   * Faithful to Code Painter's ink() style renderer.
   */
  _renderStroke(ctx, a, R, c0, c1, o, progress) {
    const w = a[6];
    // Sample the quadratic at `progress` along the path
    const P = quadPts(a, progress, 1, 28);
    const n = P.length;
    if (n < 3) return;

    const cut = Math.round((n - 1) * 0.66);
    // Width function: swells in the middle, tapers at ends
    const wid = i => w * (0.22 + 0.9 * Math.pow(Math.sin(Math.PI * Math.min(1, (i / (n - 1)) * progress * 0.92 + 0.06)), 0.55));

    // The loaded part: one filled ribbon (left edge → right edge)
    const L = [];   // left side of the ribbon
    const Rt = [];  // right side (reversed for fill)
    const loadN = Math.min(cut, n - 1);
    for (let i = 0; i <= loadN; i++) {
      const [nx, ny] = normalAt(P, i);
      const h = wid(i) / 2;
      L.push([P[i][0] + nx * h, P[i][1] + ny * h]);
      Rt.push([P[i][0] - nx * h, P[i][1] - ny * h]);
    }

    ctx.globalAlpha = o;
    ctx.fillStyle = c0;
    ctx.beginPath();
    L.forEach(([px, py], i) => ctx[i ? 'lineTo' : 'moveTo'](px, py));
    for (let i = Rt.length - 1; i >= 0; i--) ctx.lineTo(Rt[i][0], Rt[i][1]);
    ctx.closePath();
    ctx.fill();

    // Ink blob where the brush touched down
    ctx.globalAlpha = o;
    ctx.fillStyle = shade(c0, -0.18);
    ctx.beginPath();
    ctx.arc(P[0][0], P[0][1], wid(0) * 0.6, 0, 7);
    ctx.fill();

    // The tail: separate hairs running dry, some stopping early
    if (n - 1 > cut && progress > 0.6) {
      const hairs = this.defaults.hairCount;
      for (let h = 0; h < hairs; h++) {
        const off = ((h + 0.5) / hairs - 0.5) * wid(cut) * 0.95;
        const tailProgress = (progress - 0.6) / 0.4;
        const stop = cut + Math.round((n - 1 - cut) * tailProgress * (0.45 + R() * 0.55));
        const hairWidth = Math.max(0.6, wid(cut) / hairs * (0.9 + R() * 0.8));

        ctx.globalAlpha = o * (0.55 + R() * 0.4);
        ctx.strokeStyle = c0;
        ctx.lineWidth = hairWidth;
        ctx.beginPath();
        for (let i = cut - 1; i <= stop; i++) {
          const [nx, ny] = normalAt(P, i);
          const k = off * wid(i) / Math.max(0.1, wid(cut));
          const px = P[i][0] + nx * k;
          const py = P[i][1] + ny * k;
          if (i === cut - 1) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
    }
  }

  /**
   * Render an ink pool (for E/B/T/R shapes):
   * a radial gradient denser at the rim, with a ragged feathered edge.
   */
  _renderPool(ctx, shape, R, c0, c1, o) {
    const a = shape.params;
    const path = raggedPath(shape, R, this.defaults.poolFeather);
    const P = shapePoly(shape);
    const b = boxOf(P);
    const r = Math.max(1, Math.max(b.w, b.h) / 2);

    const G = ctx.createRadialGradient(b.cx, b.cy, 0, b.cx, b.cy, r);
    G.addColorStop(0, rgbaOf(c0, 0.62 * o));
    G.addColorStop(0.75, rgbaOf(mixHex(c0, c1, 0.3), 0.72 * o));
    G.addColorStop(1, rgbaOf(shade2(c0, -0.2), 0.9 * o));
    ctx.fillStyle = G;
    ctx.fill(path);

    // Darker rim line
    ctx.globalAlpha = o * 0.35;
    ctx.strokeStyle = shade(c0, -0.3);
    ctx.lineWidth = Math.max(0.6, r * 0.04);
    ctx.stroke(path);
  }

}

export default InkStyle;
