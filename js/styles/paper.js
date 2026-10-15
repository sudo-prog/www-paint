/**
 * paper.js — Torn paper collage style.
 *
 * Algorithm: flat opaque shapes with a subtle drop shadow and a deckle
 * (torn) edge. The torn paper edge is produced by offsetting a dense
 * point cloud of the original boundary inward/outward with gaussian
 * noise, then connecting the results into a jagged path. A second,
 * slightly larger shadow path is drawn behind to suggest the paper
 * sitting off the canvas.
 *
 * For strokes (S-type): the ribbon gets a ragged torn edge on both
 * sides with a soft shadow underneath.
 *
 * Reference: Paper collage aesthetic, RE_BREAKDOWN.md §4.3 (graphic styles)
 */

import {
  rngFor, gaussR, lerp, clamp01,
  quadPts, normalAt, boxOf, shapePoly, outlinePath,
  shade2, rgbToHex
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

/**
 * Build a torn-paper path from a shape's outline.
 * Samples the original perimeter, displaces each point outward/inward
 * with gaussian noise, and returns a Path2D.
 */
function tornPath(shape, R, amp, k = 1) {
  const P = shapePoly(shape);
  const b = boxOf(P);
  const size = Math.max(b.w, b.h, 2);
  const step = Math.max(2, size / 32);
  const pts = [];
  const n = P.length / 2;
  for (let i = 0; i < n; i++) {
    const ax = P[i * 2];
    const ay = P[i * 2 + 1];
    const j = (i + 1) % n;
    const bx = P[j * 2];
    const by = P[j * 2 + 1];
    const m = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / step));
    for (let s = 0; s < m; s++) {
      pts.push([ax + (bx - ax) * s / m, ay + (by - ay) * s / m]);
    }
  }
  const Q = pts.map(([px, py]) => {
    const d = gaussR(R) * amp;
    const len = Math.hypot(px - b.cx, py - b.cy) || 1;
    const nx = (px - b.cx) / len;
    const ny = (py - b.cy) / len;
    return [px + nx * d * k, py + ny * d * k];
  });
  const path = new Path2D();
  const N = Q.length;
  if (N === 0) return path;
  path.moveTo(Q[0][0], Q[0][1]);
  for (let i = 1; i < N; i++) path.lineTo(Q[i][0], Q[i][1]);
  path.closePath();
  return path;
}

export class PaperStyle {
  name = 'paper';
  category = 'graphic';
  description = 'Torn paper collage: flat opaque shapes with a deckle edge and a subtle drop shadow. Each shape looks like a torn piece of paper sitting on the canvas.';

  defaults = {
    strokeSize: { min: 4, max: 22 },
    tearAmp: 0.12,         // torn-edge amplitude (fraction of radius)
    tearFreq: 3,           // sine frequency for deckle edge
    shadowBlur: 3.0,       // soft shadow blur radius
    shadowOffset: 2.0,     // shadow offset distance
    shadowOpacity: 0.22,   // shadow darkness
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
      type: 'E',
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
   * Render a torn-paper ribbon stroke: jagged torn edge + soft shadow.
   */
  _renderStroke(ctx, shape, R, c0, c1, o, progress) {
    const a = shape.params;
    const w = Math.max(2, a[6]);
    const P = quadPts(a, progress, 1, 28);
    const n = P.length;
    if (n < 3) return;

    const amp = Math.max(1, w * this.defaults.tearAmp);

    ctx.save();

    // --- Drop shadow ---
    ctx.filter = `blur(${this.defaults.shadowBlur}px)`;
    ctx.globalAlpha = o * this.defaults.shadowOpacity;
    ctx.fillStyle = '#000000';
    const shadow = new Path2D();
    for (let i = 0; i < n; i++) {
      const [nx, ny] = normalAt(P, i);
      const off = w / 2 + amp;
      i === 0 ? shadow.moveTo(P[i][0] + nx * off, P[i][1] + ny * off)
              : shadow.lineTo(P[i][0] + nx * off, P[i][1] + ny * off);
    }
    for (let i = n - 1; i >= 0; i--) {
      const [nx, ny] = normalAt(P, i);
      const off = w / 2 + amp;
      shadow.lineTo(P[i][0] - nx * off, P[i][1] - ny * off);
    }
    shadow.closePath();
    ctx.translate(this.defaults.shadowOffset, this.defaults.shadowOffset);
    ctx.fill(shadow);
    ctx.translate(-this.defaults.shadowOffset, -this.defaults.shadowOffset);
    ctx.filter = 'none';

    // --- Main torn paper fill ---
    ctx.globalAlpha = o;
    ctx.fillStyle = c0;

    const fill = new Path2D();
    for (let i = 0; i < n; i++) {
      const [nx, ny] = normalAt(P, i);
      const noise = gaussR(R) * amp * 0.5;
      const off = w / 2 + noise;
      i === 0 ? fill.moveTo(P[i][0] + nx * off, P[i][1] + ny * off)
              : fill.lineTo(P[i][0] + nx * off, P[i][1] + ny * off);
    }
    for (let i = n - 1; i >= 0; i--) {
      const [nx, ny] = normalAt(P, i);
      const noise = gaussR(R) * amp * 0.5;
      const off = w / 2 + noise;
      fill.lineTo(P[i][0] - nx * off, P[i][1] - ny * off);
    }
    fill.closePath();
    ctx.fill(fill);

    // --- Edge darkness (paper crease / fold shadow) ---
    ctx.globalAlpha = o * 0.4;
    ctx.strokeStyle = shade2(c0, -0.15);
    ctx.lineWidth = Math.max(0.5, amp * 0.3);
    ctx.stroke(fill);

    ctx.restore();
  }

  /**
   * Render a torn-paper area shape: ragged edge fill + drop shadow.
   */
  _renderArea(ctx, shape, R, c0, c1, o, progress) {
    const P = shapePoly(shape);
    const b = boxOf(P);
    const size = Math.max(b.w, b.h, 4);
    const amp = size * this.defaults.tearAmp * 0.5;

    ctx.save();

    // --- Drop shadow ---
    ctx.filter = `blur(${this.defaults.shadowBlur}px)`;
    ctx.globalAlpha = o * this.defaults.shadowOpacity;
    ctx.fillStyle = '#000000';
    const shadowPath = tornPath(shape, R, amp * 2, 1.5);
    ctx.translate(this.defaults.shadowOffset, this.defaults.shadowOffset);
    ctx.fill(shadowPath);
    ctx.translate(-this.defaults.shadowOffset, -this.defaults.shadowOffset);
    ctx.filter = 'none';

    // --- Torn-paper fill ---
    ctx.globalAlpha = o;
    ctx.fillStyle = c0;
    const fillPath = tornPath(shape, R, amp, 1);
    ctx.fill(fillPath);

    // --- Edge outline (darker, for crease definition) ---
    ctx.globalAlpha = o * 0.5;
    ctx.strokeStyle = shade2(c0, -0.2);
    ctx.lineWidth = Math.max(0.8, size * 0.015);
    ctx.stroke(fillPath);

    ctx.restore();
  }
}

export default PaperStyle;
