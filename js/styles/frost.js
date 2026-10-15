/**
 * frost.js — Icy frost / crystalline style.
 *
 * Algorithm: pale icy speckle with sharp small shards radiating from
 * the shape boundary. The fill is a pale blue/white gradient with a
 * field of tiny crystalline dots. Sharp linear highlights and radial
 * spokes create the glinting ice effect. A subtle blue tint and low
 * opacity give the translucent ice look.
 *
 * For strokes (S-type): the ribbon gets a frost-textured fill with
 * crystalline speckles and sharp highlight streaks.
 *
 * Reference: Hoar frost / ice crystal aesthetic,
 * RE_BREAKDOWN.md §4.3 (graphic styles)
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

/**
 * Shift a hex color toward icy blue/white.
 */
function icyTint(hex) {
  return mixHex(hex, '#e8f4ff', 0.45);
}

export class FrostStyle {
  name = 'frost';
  category = 'graphic';
  description = 'Frost: icy crystalline speckle in pale blues and whites. Sharp small shards radiate from edges with translucent glinting highlights and a field of frost crystals.';

  defaults = {
    strokeSize: { min: 4, max: 22 },
    shardLen: 6,           // radial shard length (px)
    shardCount: 12,        // shards per perimeter sample
    crystalSize: 1.2,      // frost crystal radius (px)
    crystalDensity: 0.3,   // crystal field density (per px²)
    iceLighten: 0.55,      // ice highlight brightness
    frostTint: 0.45,       // blue-white tint factor
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
    const R = rngFor(shape.seed || a.slice(0, 8));

    const iceC0 = icyTint(c0);
    const iceC1 = icyTint(c1);

    if (shape.type === 'S') {
      this._renderStroke(ctx, shape, R, iceC0, iceC1, o, progress);
    } else {
      this._renderArea(ctx, shape, R, iceC0, iceC1, o, progress);
    }
  }

  /**
   * Render a frost stroke: icy ribbon with crystalline speckles and shards.
   */
  _renderStroke(ctx, shape, R, c0, c1, o, progress) {
    const a = shape.params;
    const w = Math.max(2, a[6]);
    const P = quadPts(a, progress, 1, 28);
    const n = P.length;
    if (n < 3) return;

    ctx.save();

    // --- Icy fill (translucent blue-white) ---
    const fillCol = rgbaOf(mixHex(c0, c1, 0.5), o * 0.7);
    ctx.globalAlpha = o * 0.7;
    ctx.fillStyle = fillCol;

    const band = new Path2D();
    for (let i = 0; i < n; i++) {
      const [nx, ny] = normalAt(P, i);
      const off = w / 2;
      i === 0 ? band.moveTo(P[i][0] + nx * off, P[i][1] + ny * off)
              : band.lineTo(P[i][0] + nx * off, P[i][1] + ny * off);
    }
    for (let i = n - 1; i >= 0; i--) {
      const [nx, ny] = normalAt(P, i);
      const off = w / 2;
      band.lineTo(P[i][0] - nx * off, P[i][1] - ny * off);
    }
    band.closePath();
    ctx.fill(band);

    // --- Crystalline speckles on the surface ---
    ctx.globalAlpha = o * 0.5;
    ctx.fillStyle = shade2(c0, this.defaults.iceLighten);
    const step = Math.max(2, Math.floor(w / 3));
    for (let i = 0; i < n; i += step) {
      const sz = this.defaults.crystalSize * (0.5 + R() * 0.8);
      ctx.fillRect(P[i][0] + (R() - 0.5) * w * 0.3, P[i][1] + (R() - 0.5) * w * 0.3, sz, sz);
    }

    // --- Edge highlights (ice glint) ---
    ctx.globalAlpha = o * 0.8;
    ctx.strokeStyle = shade2(c0, this.defaults.iceLighten + 0.15);
    ctx.lineWidth = Math.max(0.5, w * 0.12);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(P[0][0], P[0][1]);
    for (let i = 1; i < n; i++) ctx.lineTo(P[i][0], P[i][1]);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Render an icy area: frost crystal field + radial shards from edge.
   */
  _renderArea(ctx, shape, R, c0, c1, o, progress) {
    const P = shapePoly(shape);
    const b = boxOf(P);
    const size = Math.max(b.w, b.h, 4);

    ctx.save();
    outlinePath(ctx, shape);
    ctx.clip();

    // --- Translucent icy fill ---
    const G = ctx.createRadialGradient(b.cx, b.cy, 0, b.cx, b.cy, size / 2);
    G.addColorStop(0, rgbaOf(shade2(c0, 0.3), o * 0.5));
    G.addColorStop(0.6, rgbaOf(mixHex(c0, c1, 0.4), o * 0.35));
    G.addColorStop(1, rgbaOf(shade2(c1, -0.2), o * 0.45));

    ctx.globalAlpha = o * 0.5;
    ctx.fillStyle = G;
    ctx.fillRect(b.x0, b.y0, b.w, b.h);

    // --- Frost crystal field ---
    ctx.globalAlpha = o * 0.45;
    ctx.fillStyle = shade2(c0, this.defaults.iceLighten);
    const crystals = Math.max(30, Math.round(b.w * b.h * this.defaults.crystalDensity * 0.01));
    for (let i = 0; i < crystals; i++) {
      const px = b.x0 + R() * b.w;
      const py = b.y0 + R() * b.h;
      const sz = this.defaults.crystalSize * (0.3 + R() * 1.2);
      ctx.fillRect(px, py, sz, sz);
    }

    // --- Sharp radial shards from the perimeter ---
    ctx.globalAlpha = o * 0.65;
    ctx.strokeStyle = shade2(c0, this.defaults.iceLighten + 0.1);
    ctx.lineWidth = Math.max(0.6, this.defaults.crystalSize * 0.4);

    const shardN = Math.max(8, Math.round(size * this.defaults.shardCount * 0.02));
    for (let i = 0; i < shardN; i++) {
      const idx = Math.floor(R() * P.length) / 2;
      const ix = Math.floor(idx) * 2;
      const iy = ix + 1;
      if (ix + 1 >= P.length) break;
      const px = P[ix];
      const py = P[iy];
      const angle = R() * Math.PI * 2;
      const len = this.defaults.shardLen * (0.5 + R() * 0.8);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + Math.cos(angle) * len, py + Math.sin(angle) * len);
      ctx.stroke();
    }

    // --- Edge rim (bright ice line) ---
    ctx.globalAlpha = o * 0.7;
    ctx.strokeStyle = shade2(c0, this.defaults.iceLighten + 0.2);
    ctx.lineWidth = Math.max(0.8, size * 0.02);
    outlinePath(ctx, shape);
    ctx.stroke();

    ctx.restore();
  }
}

export default FrostStyle;
