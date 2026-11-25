/**
 * painterly.js — Hertzmann-style painterly rendering.
 *
 * Wraps the vendored davemaynard/painterly library (MIT, (c) 2026 Dave Maynard).
 * Produces multi-bristle fan strokes with ragged ends, per-bristle colour drift,
 * and deterministic seeded randomness.
 *
 * Reference: Hertzmann et al. "Painterly Rendering with Curved Brush Strokes of Multiple Sizes"
 */

import {
  rngFor, lerp, clamp01,
  rgbToHex, quadPts, normalAt, colsOf,
} from './base.js';

import { brushes, jitter } from '../vendor/painterly/painterly.esm.js';

const BRISTLE = brushes.bristle;

export class PainterlyStyle {
  name = 'painterly';
  category = 'paint';
  description = 'Hertzmann-style painterly rendering: multi-bristle fan brush with ragged ends, per-bristle colour drift, and tapering. Deterministic seeded strokes.';

  defaults = {
    strokeSize: { min: 6, max: 32 },
    bristleCount: 8,
    spread: 0.9,
    weightMin: 0.12,
    weightMax: 0.38,
    alpha: 0.55,
    drift: 14,
    ragged: 0.25,
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
        strokes.push(...this._makeFill(region, color));
      }
    }

    return strokes;
  }

  _makeStroke(edge, color) {
    const c = Array.isArray(color) ? color : [color, color, color];
    const R = rngFor(edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, 0, 0]);
    const w = lerp(this.defaults.strokeSize.min, this.defaults.strokeSize.max, R());
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
    const R = rngFor([region.cx, region.cy, region.w, region.h, 0, 0]);
    const an = R() * Math.PI;
    const size = Math.max(region.w, region.h);
    const sw = Math.max(3, Math.min(size / 2.2, size / 3));
    const n = Math.max(1, Math.ceil(size / (sw * 0.8)));

    for (let k = 0; k < n; k++) {
      const t = k / Math.max(1, n - 1);
      const colorA = rgbToHex(c);
      const colorB = rgbToHex(c);
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
   * Render one painterly stroke: multi-bristle fan with ragged ends,
   * per-bristle colour drift and tapering. Draws directly on ctx (2D).
   */
  render(ctx, shape, progress = 1) {
    const R = rngFor(shape.seed || shape.params.slice(0, 6));
    // Create jitter function from seed deterministically — seed is a number from engine.
    let jitterFn;
    if (typeof shape.seed === 'number') {
      // seed is a 32-bit integer from engine; convert to a reproducible state
      let s = shape.seed >>> 0;
      jitterFn = () => {
        s = s + 0x6D2B79F5 >>> 0;
        let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    } else {
      // seed is an array, use FNV-1a seeded PRNG like base.js's rngFor
      let h = 2166136261;
      for (let i = 0; i < 6; i++) { h ^= Math.round((shape.seed[i] || 0) * 10); h = Math.imul(h, 16777619); }
      let s = h >>> 0 || 1;
      jitterFn = () => {
        s ^= s << 13; s >>>= 0;
        s ^= s >>> 17; s ^= s << 5; s >>>= 0;
        return s / 4294967296;
      };
    }
    const [c0, c1, o] = colsOf(shape);

    if (shape.type === 'S') {
      this._renderStroke(ctx, shape, R, jitterFn, c0, c1, o, progress);
    } else {
      this._renderArea(ctx, shape, R, c0, c1, o, progress);
    }
  }

  _renderStroke(ctx, shape, R, jitterFn, c0, c1, o, progress) {
    const a = shape.params;
    const radius = Math.max(0.5, a[6] / 2);
    const P = quadPts(a, Math.max(0, Math.min(1, progress)), 1, 48);

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = o * BRISTLE.alpha;

    const first = P[0];
    const second = P[1] || first;
    let nx = -(second[1] - first[1]);
    let ny = second[0] - first[0];
    const norm = Math.hypot(nx, ny) || 1;
    nx /= norm;
    ny /= norm;

    const raggedStart = BRISTLE.ragged * R();
    const raggedEnd = 1 - BRISTLE.ragged * R();
    const sliceStart = Math.max(0, Math.floor(raggedStart * P.length));
    const sliceEnd = Math.min(P.length - 1, Math.ceil(raggedEnd * P.length) - 1);
    const path = P.slice(sliceStart, sliceEnd + 1);

    for (let b = 0; b < BRISTLE.bristles; b++) {
      const fan = BRISTLE.bristles === 1 ? 0 : (b / (BRISTLE.bristles - 1) - 0.5) * 2;
      const offset = fan * BRISTLE.spread * radius + (jitterFn() - 0.5) * radius * 0.3;
      const ox = nx * offset;
      const oy = ny * offset;
      const w = Math.max(0.3, radius * lerp(BRISTLE.weight[0], BRISTLE.weight[1], R()));

      const base = c0.startsWith('#') ? [parseInt(c0.slice(1, 3), 16), parseInt(c0.slice(3, 5), 16), parseInt(c0.slice(5, 7), 16)]
        : c0.match(/\d+/g).slice(0, 3).map(Number);
      const col = (ch) => Math.max(0, Math.min(255, Math.round(ch + (jitterFn() - 0.5) * 2 * BRISTLE.drift)));
      const colStr = `rgb(${col(base[0])},${col(base[1])},${col(base[2])})`;
      ctx.strokeStyle = colStr;
      ctx.lineWidth = w;

      if (path.length > 1) {
        ctx.beginPath();
        ctx.moveTo(path[0][0] + ox, path[0][1] + oy);
        for (let i = 1; i < path.length - 1; i++) {
          const [cx2, cy2] = path[i];
          const [nx2, ny2] = path[i + 1];
          ctx.quadraticCurveTo(cx2 + ox, cy2 + oy, (cx2 + nx2) / 2 + ox, (cy2 + ny2) / 2 + oy);
        }
        const end = path[path.length - 1];
        ctx.lineTo(end[0] + ox, end[1] + oy);
        ctx.stroke();
      } else {
        ctx.fillStyle = colStr;
        ctx.beginPath();
        ctx.arc(path[0][0] + ox, path[0][1] + oy, w / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  _renderArea(ctx, shape, R, c0, c1, o, progress) {
    ctx.save();
    ctx.globalAlpha = o * 0.3;
    ctx.fillStyle = c0;
    const a = shape.params;
    const cx = a[0], cy = a[1];
    const rx = a[2] || 10, ry = a[3] || 10;
    ctx.beginPath();
    ctx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), a[4] || 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export default PainterlyStyle;
