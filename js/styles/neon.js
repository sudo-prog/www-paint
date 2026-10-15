/**
 * neon.js — Neon / glowing tube style.
 *
 * Algorithm: bright glowing tube lines with a bright core and a soft
 * outer glow halo. The neon effect is built in layers:
 *
 *   1. Outer glow: a wide, low-opacity blur behind the core
 *   2. Core: a bright solid stroke at the center
 *   3. Edge highlight: a thin brighter line on one side
 *
 * For strokes (S-type): a glowing ribbon with core + halo.
 * For area shapes (E/B/T/R): a neon tube outlining the shape
 * with a glowing fill.
 *
 * Reference: Neon tube lighting, RE_BREAKDOWN.md §4.3 (graphic styles)
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

export class NeonStyle {
  name = 'neon';
  category = 'graphic';
  description = 'Neon: bright glowing tube lines with a bright core and a soft outer glow halo. The glow is built from layered blurred strokes — wide and diffuse underneath, sharp and bright on top.';

  defaults = {
    strokeSize: { min: 2, max: 16 },
    glowLayers: 3,           // number of glow layers (outer → inner)
    glowSpread: 0.7,         // glow radius as fraction of stroke width
    glowOpacity: 0.35,       // opacity falloff per layer
    coreLighten: 0.4,        // core brightness boost
    coreWidth: 0.4,          // core width as fraction of stroke width
    edgeHighlight: 0.8,      // edge highlight brightness
    minRegionArea: 80
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
        if (region.area < (cfg.minRegionArea || 80)) continue;
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

    if (shape.type === 'S') {
      this._renderStroke(ctx, shape, c0, c1, o, progress);
    } else {
      this._renderArea(ctx, shape, c0, c1, o, progress);
    }
  }

  /**
   * Render a neon tube line: glow layers + bright core.
   *
   * The glow is built from progressively wider, lower-opacity
   * blurred strokes underneath. The core is a bright solid line.
   */
  _renderStroke(ctx, shape, c0, c1, o, progress) {
    const a = shape.params;
    const w = Math.max(2, a[6]);
    const P = quadPts(a, progress, 1, 30);
    const n = P.length;
    if (n < 2) return;

    const glowW = w * this.defaults.glowSpread;
    const coreCol = shade2(c0, this.defaults.coreLighten);

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // --- Outer glow layers (blurred, transparent) ---
    ctx.filter = `blur(${glowW * 0.8}px)`;
    for (let i = this.defaults.glowLayers - 1; i >= 0; i--) {
      const layerAlpha = (i + 1) / this.defaults.glowLayers;
      const layerW = glowW * (1 + i * 0.4);
      ctx.globalAlpha = o * this.defaults.glowOpacity * layerAlpha;
      ctx.strokeStyle = c0;
      ctx.lineWidth = layerW;
      ctx.beginPath();
      ctx.moveTo(P[0][0], P[0][1]);
      for (let j = 1; j < n; j++) ctx.lineTo(P[j][0], P[j][1]);
      ctx.stroke();
    }
    ctx.filter = 'none';

    // --- Core (bright solid line) ---
    ctx.globalAlpha = o;
    ctx.strokeStyle = coreCol;
    ctx.lineWidth = Math.max(1, w * this.defaults.coreWidth);
    ctx.beginPath();
    ctx.moveTo(P[0][0], P[0][1]);
    for (let j = 1; j < n; j++) ctx.lineTo(P[j][0], P[j][1]);
    ctx.stroke();

    // --- Edge highlight (thin bright line on one side) ---
    const R = rngFor(shape.seed || a.slice(0, 6));
    const side = R() > 0.5 ? 1 : -1;
    const highlightW = w * this.defaults.coreWidth * 0.6;
    const off = side * w * 0.25;

    ctx.globalAlpha = o * 0.8;
    ctx.strokeStyle = shade2(coreCol, this.defaults.edgeHighlight * 0.3);
    ctx.lineWidth = highlightW;
    ctx.beginPath();
    for (let j = 0; j < n; j++) {
      const [nx, ny] = normalAt(P, j);
      const px = P[j][0] + nx * off;
      const py = P[j][1] + ny * off;
      j === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Render a neon tube outline + fill for area shapes.
   * The shape outline glows with neon, and the fill is a softer glow.
   */
  _renderArea(ctx, shape, c0, c1, o, progress) {
    const a = shape.params;
    const P = shapePoly(shape);
    const b = boxOf(P);
    const r = Math.max(1, Math.max(b.w, b.h) / 2);

    const glowWidth = r * 0.4;
    const coreCol = shade2(c0, this.defaults.coreLighten);

    ctx.save();

    // --- Outer glow (blurred, wide) ---
    ctx.filter = `blur(${glowWidth * 0.8}px)`;
    ctx.globalAlpha = o * this.defaults.glowOpacity * 1.5;
    ctx.strokeStyle = c0;
    ctx.lineWidth = glowWidth;
    outlinePath(ctx, shape);
    ctx.stroke();
    ctx.filter = 'none';

    // --- Outer glow layer 2 ---
    ctx.globalAlpha = o * this.defaults.glowOpacity;
    ctx.strokeStyle = shade2(c0, -0.1);
    ctx.lineWidth = glowWidth * 0.5;
    outlinePath(ctx, shape);
    ctx.stroke();

    // --- Core outline ---
    ctx.globalAlpha = o;
    ctx.strokeStyle = coreCol;
    ctx.lineWidth = Math.max(2, r * 0.06);
    outlinePath(ctx, shape);
    ctx.stroke();

    // --- Glowing fill ---
    ctx.globalAlpha = o * 0.25;
    ctx.fillStyle = coreCol;
    outlinePath(ctx, shape);
    ctx.fill();

    ctx.restore();
  }
}

export default NeonStyle;
