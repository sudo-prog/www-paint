/**
 * watercolor.js — Watercolor style.
 *
 * Implements two complementary watercolor effects, faithful to Code Painter:
 *
 *   A. Wet washes (for filled shapes E/B/T/R): Tyler Hobbs' layered wash.
 *      A fractal-edged outline (from hobbsGrow) is stacked in 8 transparent
 *      layers, each edge darkening where they pile up. Granulation is
 *      simulated by lifting pigment in soft circles (destination-out), and
 *      a wet bead of pigment sits at the edge. Overlapping washes darken
 *      via multiply composite.
 *
 *      hobbsGrow: every edge gets a midpoint pushed sideways by a gaussian
 *      amount, recursively — fraying the outline into a natural fractal edge.
 *
 *   B. Watercolour strokes (for S type): a ribbon whose width follows
 *      sin(PI * progress)^0.35 (swells mid-stroke), drawn in 4 stacked
 *      transparent glazes that wander from one colour to the other. A darker
 *      tide line runs along the outer edge, granulation dots scatter inside,
 *      and a wet bead of pigment sits at the tip.
 *
 * Reference: RE_BREAKDOWN.md §4.2 C (watercolor growth), §8.2 (hobbsGrow)
 */

import {
  rngFor, gaussR, lerp, clamp01,
  hexRgb, shade, shade2, mixHex, rgbaOf,
  quadPts, normalAt, boxOf, shapePoly, outlinePath, hobbsGrow,
  gradOf, colsOf
} from './base.js';

const WET_TILE = { cv: null, x: null };

export class WatercolorStyle {
  name = 'watercolor';
  category = 'paint';
  description = 'Transparent glazes that wander, fractal-edged outlines from stacked washes, granulation, and a wet bead of pigment at the tip.';

  defaults = {
    strokeSize: { min: 3, max: 20 },
    layers: 8,         // number of stacked transparent washes (area)
    sigma: 0.115,      // hobbsGrow displacement amount
    glazeAlpha: 0.14,  // alpha per glaze layer
    tideDarken: 0.32,  // tide line darken factor
    granulation: 0.22, // granulation opacity
    beadSize: 0.55,    // wet bead radius factor
    strokeLayers: 4,   // glaze passes for stroke rendering
    dryRun: false      // skip WebGL-style tile compositing for simplicity
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
        strokes.push(this._makeWash(region, color));
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

  _makeWash(region, color) {
    const c = Array.isArray(color) ? color : [color, color, color];
    const w = Math.max(region.w, region.h) * 0.5;
    return {
      type: 'E',
      params: [region.cx, region.cy, w, w, 0, c, c, 1],
      seed: [region.cx, region.cy, w, 0, 0, 0]
    };
  }

  render(ctx, shape, progress = 1) {
    const a = shape.params;
    const R = rngFor(shape.seed || a.slice(0, Math.min(a.length, 9)));

    if (shape.type === 'S') {
      this._renderStroke(ctx, shape, R, progress);
    } else {
      this._renderWash(ctx, shape, R);
    }
  }

  /**
   * Watercolour stroke: 4 stacked transparent glazes on a wobbling ribbon,
   * with a tide line, granulation, and a wet bead at the tip.
   * Faithful to Code Painter's `watercolour` style.
   */
  _renderStroke(ctx, shape, R, progress) {
    const [c0, c1, o] = colsOf(shape);
    const a = shape.params;
    const w = a[6];
    const P = quadPts(a, progress, 1, 32);

    ctx.save();
    ctx.lineJoin = 'round';

    let outer = null;
    for (let L = 0; L < this.defaults.strokeLayers; L++) {
      // Ribbon width: swells mid-stroke, tapers at ends, gets thinner per layer
      const rib = this._paintRibbon(P, s =>
        w * (0.62 + 0.38 * Math.pow(Math.sin(Math.PI * Math.min(1, 0.08 + 0.92 * s * progress)), 0.35))
        * (1 - L * 0.07), R, 0.16, L * 1.7);

      if (L === 0) outer = rib;

      ctx.globalAlpha = o * 0.2;
      ctx.fillStyle = mixHex(c0, c1, L / 3);
      ctx.fill(rib);
    }

    // Tide line: darker along the outer edge
    ctx.globalAlpha = o * this.defaults.tideDarken;
    ctx.strokeStyle = shade(mixHex(c0, c1, 0.5), -0.32);
    ctx.lineWidth = Math.max(0.6, w * 0.05);
    ctx.stroke(outer);

    // Granulation: pigment dots scattered inside the stroke
    ctx.save();
    ctx.clip(outer);
    ctx.globalAlpha = o * this.defaults.granulation;
    ctx.fillStyle = shade(c0, -0.35);
    ctx.beginPath();
    const len = P.length;
    const dots = Math.min(220, Math.round(w * len * 0.25));
    const d = Math.max(0.45, w * 0.025);
    for (let i = 0; i < dots; i++) {
      const p = P[Math.floor(R() * len)];
      const j = (R() - 0.5) * w;
      const [nx, ny] = normalAt(P, Math.floor(R() * len));
      const cx = p[0] + nx * j + d;
      const cy = p[1] + ny * j;
      ctx.moveTo(cx + d * (0.5 + R()), cy);
      ctx.arc(cx, cy, d * (0.5 + R()), 0, 7);
    }
    ctx.fill();
    ctx.restore();

    // Wet bead of pigment at the tip
    const e = P[P.length - 1];
    const beadR = w * this.defaults.beadSize;
    const G = ctx.createRadialGradient(e[0], e[1], 0, e[0], e[1], beadR);
    G.addColorStop(0, rgbaOf(shade2(c1, -0.15), 0.32 * o));
    G.addColorStop(1, rgbaOf(c1, 0));
    ctx.globalAlpha = 1;
    ctx.fillStyle = G;
    ctx.beginPath();
    ctx.arc(e[0], e[1], beadR, 0, 7);
    ctx.fill();

    ctx.restore();
  }

  /**
   * Watercolor wash (for filled shapes): stacked transparent layers with
   * fractal (hobbsGrow) edges, granulation, and multiply glaze.
   * Faithful to Code Painter's `wet` style.
   */
  _renderWash(ctx, shape, R) {
    const [c0, c1, o] = colsOf(shape);
    const a = shape.params;
    const mid = mixHex(c0, c1, 0.5);
    const sig = this.defaults.sigma;
    const layers = this.defaults.layers;

    // Build fractal-edged layer outlines once (cached conceptually)
    const geo = this._buildWashGeometry(shape, a, R, sig, layers);
    const { paths, x0, y0, x1, y1 } = geo;
    const size = Math.max(x1 - x0, y1 - y0, 2);
    const rim = shade(mid, -0.32);

    // Paint layers onto an offscreen tile for granulation + glaze
    const tile = this._getTile(ctx, Math.ceil((x1 - x0 + 4) * 2), Math.ceil((y1 - y0 + 4) * 2));
    const t = tile.ctx;
    t.setTransform(2, 0, 0, 2, 2 - x0 * 2, 2 - y0 * 2);
    t.globalCompositeOperation = 'source-over';
    t.clearRect(x0 - 2, y0 - 2, x1 - x0 + 4, y1 - y0 + 4);

    const G = gradOf(t, shape, [[0, c0], [1, c1]]);
    for (let i = 0; i < paths.length; i++) {
      t.globalAlpha = o * 0.14;
      t.fillStyle = G;
      t.fill(paths[i]);
      t.globalAlpha = o * 0.11;
      t.strokeStyle = rim;
      t.lineWidth = Math.max(0.5, size * 0.006);
      t.stroke(paths[i]); // edges pile up darker
    }

    // Granulation: lift pigment in soft circles
    t.globalCompositeOperation = 'destination-out';
    const cnt = Math.min(90, 30 + Math.round(size * 0.2));
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    for (let i = 0; i < cnt; i++) {
      if (i % 5 === 4) continue;
      const r = size * (0.015 + R() * 0.12);
      t.globalAlpha = 0.05 + R() * 0.07;
      t.beginPath();
      t.arc(cx + gaussR(R) * size * 0.3, cy + gaussR(R) * size * 0.3, r, 0, 7);
      t.fill();
    }

    // Dark grains
    t.globalCompositeOperation = 'source-atop';
    t.fillStyle = shade(c0, -0.45);
    t.globalAlpha = o * 0.25;
    t.beginPath();
    const g = Math.min(110, Math.round(size * 0.5));
    for (let i = 0; i < g; i++) {
      const gx = x0 + R() * (x1 - x0);
      const gy = y0 + R() * (y1 - y0);
      const r = Math.max(0.3, size * 0.004 * (0.5 + R()));
      t.moveTo(gx + r, gy);
      t.arc(gx, gy, r, 0, 7);
    }
    t.fill();
    t.globalCompositeOperation = 'source-over';
    t.globalAlpha = 1;

    // Composite the tile back, then multiply-glaze for overlap darkening
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.drawImage(tile.cv, 0, 0);
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.55;
    ctx.drawImage(tile.cv, 0, 0);
    ctx.restore();

    // Release tile back to pool
    tile.ctx = null;
  }

  /** Build the fractal-edged layer paths via hobbsGrow */
  _buildWashGeometry(shape, a, R, sig, layers) {
    const P = shapePoly(shape);
    const n = P.length / 2;
    const stepI = Math.max(1, Math.ceil(n / 12));
    let base = [];
    for (let i = 0; i < n; i += stepI) {
      base.push([P[i * 2], P[i * 2 + 1], 0.6 + R() * 0.8]);
    }
    base = hobbsGrow(hobbsGrow(base, R, sig), R, sig * 0.8);

    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    const paths = [];
    for (let i = 0; i < layers; i++) {
      let p = base;
      for (let k = 0; k < 2; k++) p = hobbsGrow(p, R, sig * 0.62 * Math.pow(0.85, k));
      const pa = new Path2D();
      p.forEach((v, j) => {
        pa[j ? 'lineTo' : 'moveTo'](v[0], v[1]);
        if (v[0] < x0) x0 = v[0];
        if (v[0] > x1) x1 = v[0];
        if (v[1] < y0) y0 = v[1];
        if (v[1] > y1) y1 = v[1];
      });
      pa.closePath();
      paths.push(pa);
    }
    return { paths, x0, y0, x1, y1 };
  }

  /** Get a reusable offscreen canvas tile */
  _getTile(ctx, w, h) {
    if (!WET_TILE.cv) {
      WET_TILE.cv = document.createElement('canvas');
      WET_TILE.x = WET_TILE.cv.getContext('2d');
    }
    WET_TILE.cv.width = Math.max(WET_TILE.cv.width, w);
    WET_TILE.cv.height = Math.max(WET_TILE.cv.height, h);
    return { cv: WET_TILE.cv, ctx: WET_TILE.x };
  }

  /** PaintRibbon: a wobbling ribbon path with multi-frequency waviness */
  _paintRibbon(P, wFn, R, amp, phase) {
    const N = P.length;
    const ph = [R() * 6.28 + phase, R() * 6.28 + phase, R() * 6.28, R() * 6.28];
    const wav = (s, a, b) => 0.55 * Math.sin(s * 7 + a) + 0.3 * Math.sin(s * 17 + b) + 0.15 * Math.sin(s * 37 + a * 2);

    const L = [];
    const Rt = [];
    for (let i = 0; i < N; i++) {
      const s = i / Math.max(1, N - 1);
      const [nx, ny] = normalAt(P, i);
      const h = wFn(s) / 2;
      const hl = h * (1 + amp * wav(s, ph[0], ph[1]));
      const hr = h * (1 + amp * wav(s, ph[2], ph[3]));
      L.push([P[i][0] + nx * hl, P[i][1] + ny * hl]);
      Rt.push([P[i][0] - nx * hr, P[i][1] - ny * hr]);
    }
    return this._closeRibbon(L, Rt, P, R, wFn(0));
  }

  /** Build a closed Path2D ribbon from left/right edge point lists with round caps */
  _closeRibbon(L, Rt, P, R, w) {
    const path = new Path2D();
    const n = L.length;
    const hw = w / 2;
    const cap = (cx, cy, base) => {
      for (let i = 1; i < 6; i++) {
        const a = base - i / 6 * Math.PI;
        path.lineTo(cx + Math.cos(a) * hw, cy + Math.sin(a) * hw);
      }
    };
    const tan = (i, j) => {
      const dx = P[j][0] - P[i][0];
      const dy = P[j][1] - P[i][1];
      const d = Math.hypot(dx, dy) || 1;
      return [dx / d, dy / d];
    };
    // Start at L[0]
    path.moveTo(L[0][0], L[0][1]);
    for (let i = 1; i < n; i++) path.lineTo(L[i][0], L[i][1]);
    // Round cap at the tip
    const t1 = tan(n - 2, n - 1);
    cap(P[n - 1][0], P[n - 1][1], Math.atan2(t1[0], -t1[1]));
    // Back along the right edge
    for (let i = n - 1; i >= 0; i--) path.lineTo(Rt[i][0], Rt[i][1]);
    // Round cap at the tail
    const t0 = tan(0, Math.min(1, n - 1));
    cap(P[0][0], P[0][1], Math.atan2(-t0[0], t0[1]));
    path.closePath();
    return path;
  }

}

export default WatercolorStyle;
