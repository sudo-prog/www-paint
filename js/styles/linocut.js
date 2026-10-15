/**
 * linocut.js — Linocut / woodcut style.
 *
 * Algorithm: bold carved shapes with high contrast and rough, chipped
 * edges. The shape is filled flat and then the outline is drawn with
 * a rough, broken stroke — a ragged path that simulates the jagged
 * tear of a carved linoleum block. A limited palette is enforced by
 * quantizing colours to a small set of ink tones.
 *
 * For strokes (S-type): a thick flat ribbon with a jagged outer edge,
 * drawn in 2-3 solid colour bands to simulate layered cuts.
 *
 * Reference: Linocut printmaking, RE_BREAKDOWN.md §4.3 (graphic styles)
 */

import {
  rngFor, gaussR, lerp, clamp01,
  quadPts, normalAt, boxOf, shapePoly, outlinePath, raggedPath,
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

/**
 * Quantize a hex colour to a limited palette (simulating linocut inks).
 * Maps to a small set of bold tones.
 */
function quantizeColor(hex, palette) {
  if (!palette || palette.length === 0) return hex;
  let best = palette[0];
  let bestDist = Infinity;
  const rgb = hex.slice(1);
  const r = parseInt(rgb.substr(0, 2), 16);
  const g = parseInt(rgb.substr(2, 2), 16);
  const b = parseInt(rgb.substr(4, 2), 16);
  for (const p of palette) {
    const pr = parseInt(p.substr(1, 2), 16);
    const pg = parseInt(p.substr(3, 2), 16);
    const pb = parseInt(p.substr(5, 2), 16);
    const d = Math.abs(r - pr) + Math.abs(g - pg) + Math.abs(b - pb);
    if (d < bestDist) { bestDist = d; best = p; }
  }
  return best;
}

export class LinocutStyle {
  name = 'linocut';
  category = 'graphic';
  description = 'Linocut print: bold carved shapes with high contrast, rough chipped edges, and a limited palette of solid ink tones.';

  defaults = {
    strokeSize: { min: 6, max: 28 },
    chipAmp: 0.15,        // amplitude of chipped edge noise (fraction of width)
    chipFreq: 3.5,        // frequency of edge chips
    edgeContrast: 0.35,   // how much darker the chipped outline is
    outlineWidth: 0.8,    // outline relative to shape size
    paletteMode: true,    // quantize colors to limited palette
    inkPalette: ['#1a1a1a', '#4a4a4a', '#ff3b3b', '#2a8cff', '#ffd700', '#8a2be2'],
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

    const inkC0 = this.defaults.paletteMode ? quantizeColor(c0, this.defaults.inkPalette) : c0;
    const inkC1 = this.defaults.paletteMode ? quantizeColor(c1, this.defaults.inkPalette) : c1;

    if (shape.type === 'S') {
      this._renderStroke(ctx, shape, R, inkC0, inkC1, o, progress);
    } else {
      this._renderArea(ctx, shape, R, inkC0, inkC1, o, progress);
    }
  }

  /**
   * Render a linocut stroke: thick flat ribbon with chipped, carved edges.
   */
  _renderStroke(ctx, shape, R, c0, c1, o, progress) {
    const a = shape.params;
    const w = Math.max(2, a[6]);
    const P = quadPts(a, progress, 1, 26);
    const n = P.length;
    if (n < 3) return;

    ctx.save();
    ctx.lineCap = ctx.lineJoin = 'round';

    // --- Main flat ribbon with chipped edges ---
    const band = new Path2D();
    for (let i = 0; i < n; i++) {
      const [nx, ny] = normalAt(P, i);
      const t = i / (n - 1);
      const noise = gaussR(R) * this.defaults.chipAmp * 0.3;
      const off = w / 2 + noise;
      i === 0 ? band.moveTo(P[i][0] + nx * off, P[i][1] + ny * off)
              : band.lineTo(P[i][0] + nx * off, P[i][1] + ny * off);
    }
    // Reverse-side with different chip pattern
    for (let i = n - 1; i >= 0; i--) {
      const [nx, ny] = normalAt(P, i);
      const t = i / (n - 1);
      const noise = gaussR(R) * this.defaults.chipAmp * 0.3;
      const off = w / 2 + noise;
      band.lineTo(P[i][0] - nx * off, P[i][1] - ny * off);
    }
    band.closePath();

    ctx.globalAlpha = o;
    ctx.fillStyle = c0;
    ctx.fill(band);

    // --- Carved edge outline (jagged, darker) ---
    const path = raggedPath(shape, R, this.defaults.chipAmp * 0.7, 1.2);
    ctx.globalAlpha = o * 0.8;
    ctx.strokeStyle = shade2(c0, -this.defaults.edgeContrast);
    ctx.lineWidth = Math.max(0.8, w * 0.08);
    ctx.stroke(path);

    // --- Secondary chip line (offsets to one side, simulating the cut) ---
    ctx.globalAlpha = o * 0.5;
    ctx.strokeStyle = shade2(c0, -this.defaults.edgeContrast * 1.5);
    ctx.lineWidth = 0.5;
    const offBand = new Path2D();
    for (let i = 0; i < n; i++) {
      const [nx, ny] = normalAt(P, i);
      const jx = gaussR(R) * this.defaults.chipAmp * 0.2;
      const off = w / 2 + jx;
      i === 0 ? offBand.moveTo(P[i][0] + nx * off, P[i][1] + ny * off)
              : offBand.lineTo(P[i][0] + nx * off, P[i][1] + ny * off);
    }
    ctx.stroke(offBand);

    ctx.restore();
  }

  /**
   * Render a linocut area: flat fill + ragged outline + chip detail lines.
   */
  _renderArea(ctx, shape, R, c0, c1, o, progress) {
    const path = raggedPath(shape, R, this.defaults.chipAmp, 1.3);
    const P = shapePoly(shape);
    const b = boxOf(P);
    const r = Math.max(1, Math.max(b.w, b.h) / 2);

    ctx.save();

    // --- Flat opaque fill ---
    ctx.globalAlpha = o;
    ctx.fillStyle = c0;
    ctx.fill(path);

    // --- Bold outline (ragged, chipped) ---
    ctx.globalAlpha = o * 0.85;
    ctx.strokeStyle = shade2(c0, -this.defaults.edgeContrast);
    ctx.lineWidth = Math.max(0.8, r * this.defaults.outlineWidth * 0.05);
    ctx.stroke(path);

    // --- Secondary chip lines (inner boundary, offset) ---
    ctx.globalAlpha = o * 0.5;
    ctx.strokeStyle = shade2(c0, -this.defaults.edgeContrast * 0.5);
    ctx.lineWidth = 0.4;
    outlinePath(ctx, shape);
    ctx.stroke();

    ctx.restore();
  }
}

export default LinocutStyle;
