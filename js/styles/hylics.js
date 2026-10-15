/**
 * hylics.js — Hylics (claymation) style.
 *
 * Algorithm: lumpy rounded blobs with wobbly edges and soft shading.
 * Shapes are drawn as clay mounds: the outline is displaced by a
 * sinusoidal + noise envelope (hobbsGrow-style), edges are softened
 * with a subtle blur, and a radial gradient shaded from c0→c1→rim
 * gives the plasticky matte look. A soft drop shadow underneath
 * suggests the object sitting off the canvas.
 *
 * Reference: Claymation aesthetic, RE_BREAKDOWN.md §4.3 (graphic styles)
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

export class HylicsStyle {
  name = 'hylics';
  category = 'graphic';
  description = 'Claymation look: lumpy rounded blobs with wobbly edges, muted clay colors, soft shading, and a gentle drop shadow. Strokes are fat ribbons with uneven width and a matte surface.';

  defaults = {
    strokeSize: { min: 8, max: 30 },
    edgeNoise: 0.18,        // wobbly edge amplitude (fraction of radius)
    edgeFreq: 5,            // number of sine cycles around the perimeter
    shadowBlur: 2.5,        // soft shadow blur radius
    shadowOffset: 1.5,      // shadow offset distance
    shadowOpacity: 0.18,    // shadow darkness
    matteDarken: 0.15,      // rim darkening for clay shading
    matteLighten: 0.25,     // highlight lighten for clay
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
   * Render a clay ribbon stroke with wobbly edges and soft shadow.
   */
  _renderStroke(ctx, shape, R, c0, c1, o, progress) {
    const a = shape.params;
    const w = Math.max(2, a[6]);
    const P = quadPts(a, progress, 1, 24);
    const n = P.length;
    if (n < 3) return;

    ctx.save();

    // --- Drop shadow (clay mound casting shadow) ---
    ctx.filter = `blur(${this.defaults.shadowBlur}px)`;
    ctx.globalAlpha = o * this.defaults.shadowOpacity;
    ctx.fillStyle = '#000000';

    const band = new Path2D();
    for (let i = 0; i < n; i++) {
      const [nx, ny] = normalAt(P, i);
      const off = w / 2 * (0.5 + this.defaults.edgeNoise * gaussR(R));
      i === 0 ? band.moveTo(P[i][0] + nx * off, P[i][1] + ny * off)
              : band.lineTo(P[i][0] + nx * off, P[i][1] + ny * off);
    }
    for (let i = n - 1; i >= 0; i--) {
      const [nx, ny] = normalAt(P, i);
      const off = w / 2 * (0.5 + this.defaults.edgeNoise * gaussR(R));
      band.lineTo(P[i][0] - nx * off, P[i][1] - ny * off);
    }
    band.closePath();

    ctx.translate(this.defaults.shadowOffset, this.defaults.shadowOffset);
    ctx.fill(band);
    ctx.filter = 'none';

    // --- Main clay fill (matte, with slight gradient) ---
    const fillCol = rgbaOf(mixHex(c0, c1, 0.3), o * 0.9);
    ctx.globalAlpha = o * 0.9;
    ctx.fillStyle = fillCol;

    const fill = new Path2D();
    for (let i = 0; i < n; i++) {
      const [nx, ny] = normalAt(P, i);
      const off = w / 2 * (0.5 + this.defaults.edgeNoise * gaussR(R));
      i === 0 ? fill.moveTo(P[i][0] + nx * off, P[i][1] + ny * off)
              : fill.lineTo(P[i][0] + nx * off, P[i][1] + ny * off);
    }
    for (let i = n - 1; i >= 0; i--) {
      const [nx, ny] = normalAt(P, i);
      const off = w / 2 * (0.5 + this.defaults.edgeNoise * gaussR(R));
      fill.lineTo(P[i][0] - nx * off, P[i][1] - ny * off);
    }
    fill.closePath();
    ctx.fill(fill);

    // --- Rim highlight (matte clay gets slight light on one edge) ---
    ctx.globalAlpha = o * 0.4;
    ctx.strokeStyle = shade2(c0, this.defaults.matteLighten);
    ctx.lineWidth = Math.max(1, w * 0.15);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(P[0][0], P[0][1]);
    for (let i = 1; i < n; i++) ctx.lineTo(P[i][0], P[i][1]);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Render a clay blob / area with wobbly edges, soft shadow, and
   * matte radial shading.
   */
  _renderArea(ctx, shape, R, c0, c1, o, progress) {
    const a = shape.params;
    const path = raggedPath(shape, R, this.defaults.edgeNoise);
    const P = shapePoly(shape);
    const b = boxOf(P);
    const r = Math.max(1, Math.max(b.w, b.h) / 2);

    ctx.save();

    // --- Drop shadow ---
    ctx.filter = `blur(${this.defaults.shadowBlur}px)`;
    ctx.globalAlpha = o * this.defaults.shadowOpacity;
    ctx.fillStyle = '#000000';
    ctx.translate(this.defaults.shadowOffset, this.defaults.shadowOffset);
    ctx.fill(path);
    ctx.translate(-this.defaults.shadowOffset, -this.defaults.shadowOffset);
    ctx.filter = 'none';

    // --- Radial matte fill ---
    const G = ctx.createRadialGradient(
      b.cx, b.cy, 0, b.cx, b.cy, r
    );
    G.addColorStop(0, rgbaOf(mixHex(c0, c1, 0.2), o * 0.85));
    G.addColorStop(0.7, rgbaOf(mixHex(c0, c1, 0.5), o * 0.9));
    G.addColorStop(1, rgbaOf(shade2(c0, -this.defaults.matteDarken), o * 0.95));

    ctx.globalAlpha = o * 0.9;
    ctx.fillStyle = G;
    ctx.fill(path);

    // --- Rim line (darker edge) ---
    ctx.globalAlpha = o * 0.5;
    ctx.strokeStyle = shade2(c0, -this.defaults.matteDarken);
    ctx.lineWidth = Math.max(0.8, r * 0.03);
    ctx.stroke(path);

    ctx.restore();
  }
}

export default HylicsStyle;
