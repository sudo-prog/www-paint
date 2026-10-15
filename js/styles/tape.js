/**
 * tape.js — Tape / washi tape style.
 *
 * Algorithm: flat opaque strips with hard straight edges and a slight
 * sheen. Tape is drawn as thick straight bands with a matte base color
 * and a thin highlight stripe along one edge. The width is uniform
 * (not pressure-sensitive) and the edges are perfectly straight,
 * simulating the clean cut of tape.
 *
 * For strokes (S-type): the path is drawn as a series of tape segments,
 * each with a hard flat fill and a sheen highlight. For area shapes:
 * overlapping tape strips laid at different angles.
 *
 * Reference: RE_BREAKDOWN.md §4.3 (graphic styles), washi tape aesthetic
 */

import {
  rngFor, gaussR, lerp, clamp01,
  quadPts, normalAt, boxOf, shapePoly, outlinePath,
  shade2, mixHex, rgbaOf, rgbToHex
} from './base.js';

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

export class TapeStyle {
  name = 'tape';
  category = 'craft';
  description = 'Tape: flat opaque strips with hard straight edges and a slight sheen highlight. Clean cuts, uniform width, matte base with a glossy stripe.';

  defaults = {
    strokeSize: { min: 4, max: 20 },
    sheenLighten: 0.35,   // highlight brightness (fraction)
    sheenWidth: 0.18,     // sheen stripe width as fraction of tape width
    sheenSide: 0.3,       // sheen position (0.3 = 30% from left edge)
    endCapWidth: 0.9,     // end cap width as fraction of tape width
    minRegionArea: 100
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
        if (region.area < (cfg.minRegionArea || 100)) continue;
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
      color0: c, color1: c, alpha: 1,
      seed: edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, w, 0]
    };
  }

  _makeShape(region, color) {
    const c = Array.isArray(color) ? color : [color, color, color];
    return {
      type: 'B',
      params: [region.cx, region.cy, region.w / 2, region.h / 2, 0, c, c, 1],
      color0: c, color1: c, alpha: 1,
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
      this._renderArea(ctx, shape, R, c0, c1, o, progress);
    }
  }

  /**
   * Render a tape strip along the path: hard flat ribbon + sheen.
   */
  _renderStroke(ctx, shape, R, c0, c1, o, progress) {
    const a = shape.params;
    const w = Math.max(2, a[6]);
    const P = quadPts(a, progress, 1, 28);
    const n = P.length;
    if (n < 3) return;

    const hw = w / 2;
    const sheenW = w * this.defaults.sheenWidth;
    const sheenPos = -hw + w * this.defaults.sheenSide;
    const highlight = shade2(c0, this.defaults.sheenLighten);

    ctx.save();

    // --- Main tape fill (hard, flat, opaque) ---
    ctx.globalAlpha = o;
    ctx.fillStyle = c0;

    const band = new Path2D();
    for (let i = 0; i < n; i++) {
      const [nx, ny] = normalAt(P, i);
      i === 0 ? band.moveTo(P[i][0] + nx * hw, P[i][1] + ny * hw)
              : band.lineTo(P[i][0] + nx * hw, P[i][1] + ny * hw);
    }
    for (let i = n - 1; i >= 0; i--) {
      const [nx, ny] = normalAt(P, i);
      band.lineTo(P[i][0] - nx * hw, P[i][1] - ny * hw);
    }
    band.closePath();
    ctx.fill(band);

    // --- Sheen highlight (thin stripe along one edge of the tape) ---
    ctx.globalAlpha = o * 0.6;
    ctx.fillStyle = highlight;

    const sheen = new Path2D();
    for (let i = 0; i < n; i++) {
      const [nx, ny] = normalAt(P, i);
      const ox = nx * sheenPos;
      const oy = ny * sheenPos;
      i === 0 ? sheen.moveTo(P[i][0] + nx * sheenW + ox, P[i][1] + ny * sheenW + oy)
              : sheen.lineTo(P[i][0] + nx * sheenW + ox, P[i][1] + ny * sheenW + oy);
    }
    for (let i = n - 1; i >= 0; i--) {
      const [nx, ny] = normalAt(P, i);
      const ox = nx * sheenPos;
      const oy = ny * sheenPos;
      sheen.lineTo(P[i][0] + ox, P[i][1] + oy);
    }
    sheen.closePath();
    ctx.fill(sheen);

    // --- Tape end caps (slightly rounded, like cut tape) ---
    const capR = w * this.defaults.endCapWidth * 0.5;
    ctx.globalAlpha = o;
    ctx.fillStyle = c0;

    // Start cap
    ctx.beginPath();
    ctx.ellipse(P[0][0], P[0][1], capR, capR, 0, 0, 7);
    ctx.fill();

    // End cap
    const ep = P[n - 1];
    ctx.beginPath();
    ctx.ellipse(ep[0], ep[1], capR, capR, 0, 0, 7);
    ctx.fill();

    ctx.restore();
  }

  /**
   * Render tape strips filling an area shape at varying angles.
   */
  _renderArea(ctx, shape, R, c0, c1, o, progress) {
    const a = shape.params;
    const P = shapePoly(shape);
    const b = boxOf(P);
    const size = Math.max(b.w, b.h, 4);

    const stripW = size * 0.08 + R() * size * 0.06;
    const angle = a[4] || 0;
    const angle2 = angle + (R() - 0.5) * 0.3;

    ctx.save();
    outlinePath(ctx, shape);
    ctx.clip();

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Main strips
    ctx.globalAlpha = o;
    ctx.fillStyle = c0;

    const diag = Math.hypot(b.w, b.h) * 2;
    const stripCount = Math.max(3, Math.round(size / stripW));

    for (let i = 0; i < stripCount; i++) {
      const t = i / (stripCount - 1);
      const offset = (t - 0.5) * diag;

      ctx.save();
      ctx.translate(b.cx, b.cy);
      ctx.rotate(angle2 + gaussR(R) * 0.1);
      ctx.translate(offset, 0);
      ctx.fillRect(-diag, -stripW / 2, diag * 2, stripW);
      ctx.restore();
    }

    // Sheen on top strips
    const highlight = shade2(c0, this.defaults.sheenLighten);
    const sheenW = stripW * this.defaults.sheenWidth;
    ctx.globalAlpha = o * 0.5;
    ctx.fillStyle = highlight;

    for (let i = 0; i < stripCount; i += 2) {
      const t = i / Math.max(1, stripCount - 1);
      const offset = (t - 0.5) * diag;

      ctx.save();
      ctx.translate(b.cx, b.cy);
      ctx.rotate(angle2 + gaussR(R) * 0.1);
      ctx.translate(offset, 0);
      ctx.fillRect(-diag, -stripW / 2 + sheenW * 0.5, diag * 2, sheenW);
      ctx.restore();
    }

    ctx.restore();
  }
}

export default TapeStyle;
