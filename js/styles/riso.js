/**
 * riso.js — Risograph style.
 *
 * Algorithm: 2-3 flat spot-color inks applied with slight misregistration
 * offset. Each "ink" is a solid flat color that fills the shape, but
 * because risograph printing layers inks on top of each other with
 * slight mechanical offset, the colors don't perfectly align — creating
 * a visible fringe/shadow where one color sits slightly off the other.
 *
 * The style draws the shape multiple times, once per ink color, each
 * time with a slight translation offset. A subtle grain texture is
 * overlaid to simulate the paper tooth of riso printing.
 *
 * For strokes (S-type): each layer draws the ribbon with a different
 * ink and a small offset, creating the misregistration fringe.
 *
 * Reference: Risograph printing technique, RE_BREAKDOWN.md §4.3
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
 * Generate riso ink layers from c0 and c1.
 * Returns an array of {color, offset} for each ink pass.
 */
function risoInks(c0, c1, R) {
  return [
    { color: c0, offset: [0, 0] },                    // base layer (perfect)
    { color: c1, offset: [(R() - 0.5) * 3, (R() - 0.5) * 3] },  // second ink (misaligned)
    { color: shade2(c0, -0.1), offset: [(R() - 0.5) * 4, (R() - 0.5) * 2] }  // third ink (grainy)
  ];
}

export class RisoStyle {
  name = 'riso';
  category = 'graphic';
  description = 'Risograph: 2-3 flat spot-color inks with slight misregistration offset and paper grain texture. Each ink pass is solid and opaque, shifted slightly to create a characteristic fringe.';

  defaults = {
    strokeSize: { min: 4, max: 22 },
    misregMax: 3.5,      // max misregistration offset (px)
    inkOpacity: 0.85,    // opacity of each ink layer
    grainAmount: 0.12,   // grain texture intensity
    grainFreq: 0.3,      // grain frequency
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
   * Render a riso stroke: multiple ink layers with misregistration.
   */
  _renderStroke(ctx, shape, R, c0, c1, o, progress) {
    const a = shape.params;
    const w = Math.max(2, a[6]);
    const P = quadPts(a, progress, 1, 24);
    const n = P.length;
    if (n < 3) return;

    const inks = risoInks(c0, c1, R);

    ctx.save();
    ctx.lineCap = ctx.lineJoin = 'round';

    for (const ink of inks) {
      const ox = ink.offset[0];
      const oy = ink.offset[1];

      ctx.globalAlpha = o * this.defaults.inkOpacity;
      ctx.fillStyle = ink.color;

      const band = new Path2D();
      const hw = w / 2;
      for (let i = 0; i < n; i++) {
        const [nx, ny] = normalAt(P, i);
        i === 0 ? band.moveTo(P[i][0] + nx * hw + ox, P[i][1] + ny * hw + oy)
                : band.lineTo(P[i][0] + nx * hw + ox, P[i][1] + ny * hw + oy);
      }
      for (let i = n - 1; i >= 0; i--) {
        const [nx, ny] = normalAt(P, i);
        band.lineTo(P[i][0] - nx * hw + ox, P[i][1] - ny * hw + oy);
      }
      band.closePath();
      ctx.fill(band);
    }

    // --- Grain texture overlay ---
    ctx.globalAlpha = o * this.defaults.grainAmount;
    ctx.strokeStyle = '#000000';
    const grainStep = this.defaults.grainFreq * 2 + 1;
    for (let i = 0; i < n; i += Math.max(1, Math.floor(grainStep))) {
      const g = gaussR(R) * w * 0.15;
      ctx.lineWidth = Math.max(0.3, g);
      ctx.stroke(path); // simplified — grain dots along path
    }

    ctx.restore();
  }

  /**
   * Render a riso area: flat ink fills with misregistration + grain.
   */
  _renderArea(ctx, shape, R, c0, c1, o, progress) {
    const path = shapePoly(shape);
    const b = boxOf(path);
    const r = Math.max(1, Math.max(b.w, b.h) / 2);

    const inks = risoInks(c0, c1, R);

    ctx.save();

    // Each ink layer fills with a slight offset
    for (const ink of inks) {
      ctx.save();
      ctx.translate(ink.offset[0], ink.offset[1]);
      ctx.globalAlpha = o * this.defaults.inkOpacity;
      ctx.fillStyle = ink.color;
      outlinePath(ctx, shape);
      ctx.fill();
      ctx.restore();
    }

    // --- Grain texture (paper tooth) ---
    ctx.globalAlpha = o * this.defaults.grainAmount;
    ctx.fillStyle = '#000000';
    const grains = Math.max(20, Math.round(b.w * b.h / 20));
    for (let i = 0; i < grains; i++) {
      const px = b.x0 + R() * b.w;
      const py = b.y0 + R() * b.h;
      const sz = R() * 0.8 + 0.2;
      ctx.fillRect(px, py, sz, sz);
    }

    // --- Bold outline ---
    ctx.globalAlpha = o * 0.7;
    ctx.strokeStyle = shade2(c0, -0.2);
    ctx.lineWidth = Math.max(0.5, r * 0.02);
    outlinePath(ctx, shape);
    ctx.stroke();

    ctx.restore();
  }
}

export default RisoStyle;
