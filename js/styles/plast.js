/**
 * plast.js — Molded plastic style.
 *
 * Algorithm: glossy molded plastic with a flat base fill and a bright
 * specular highlight streak. The shape is filled with a flat color,
 * then a soft radial highlight is swept across one side to simulate
 * the reflection of light off the curved plastic surface. A thin
 * reflective rim and a soft drop shadow underneath give the molded
 * object its characteristic glossy look.
 *
 * For strokes (S-type): a glossy ribbon with a bright highlight line
 * offset to one side and a soft edge sheen.
 *
 * Reference: Injection-molded plastic aesthetic,
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

export class PlastStyle {
  name = 'plast';
  category = 'graphic';
  description = 'Plastic: glossy molded plastic with a flat base fill and a bright specular highlight streak. A reflective rim and soft shadow give the curved-surface plastic look.';

  defaults = {
    strokeSize: { min: 4, max: 24 },
    specLighten: 0.65,      // specular highlight brightness boost
    specWidth: 0.25,        // highlight streak width (fraction of shape)
    specSide: 0.35,         // highlight position (fraction of width from edge)
    rimDarken: 0.1,         // rim shadow darkness
    rimWidth: 0.08,         // rim line width (fraction of size)
    shadowBlur: 2.0,        // soft shadow blur
    shadowOffset: 1.5,      // shadow offset
    shadowOpacity: 0.15,    // shadow darkness
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

    if (shape.type === 'S') {
      this._renderStroke(ctx, shape, R, c0, c1, o, progress);
    } else {
      this._renderArea(ctx, shape, R, c0, c1, o, progress);
    }
  }

  /**
   * Render a glossy plastic ribbon: flat fill + specular highlight.
   */
  _renderStroke(ctx, shape, R, c0, c1, o, progress) {
    const a = shape.params;
    const w = Math.max(2, a[6]);
    const P = quadPts(a, progress, 1, 30);
    const n = P.length;
    if (n < 3) return;

    const specW = w * this.defaults.specWidth;
    const specCol = shade2(c0, this.defaults.specLighten);
    const specSide = this.defaults.specSide;

    ctx.save();

    // --- Drop shadow ---
    ctx.filter = `blur(${this.defaults.shadowBlur}px)`;
    ctx.globalAlpha = o * this.defaults.shadowOpacity;
    ctx.fillStyle = '#000000';
    const shadow = new Path2D();
    const hw = w / 2;
    for (let i = 0; i < n; i++) {
      const [nx, ny] = normalAt(P, i);
      i === 0 ? shadow.moveTo(P[i][0] + nx * hw, P[i][1] + ny * hw)
              : shadow.lineTo(P[i][0] + nx * hw, P[i][1] + ny * hw);
    }
    for (let i = n - 1; i >= 0; i--) {
      const [nx, ny] = normalAt(P, i);
      shadow.lineTo(P[i][0] - nx * hw, P[i][1] - ny * hw);
    }
    shadow.closePath();
    ctx.translate(this.defaults.shadowOffset, this.defaults.shadowOffset);
    ctx.fill(shadow);
    ctx.translate(-this.defaults.shadowOffset, -this.defaults.shadowOffset);
    ctx.filter = 'none';

    // --- Flat plastic fill ---
    ctx.globalAlpha = o;
    ctx.fillStyle = c0;
    const fill = new Path2D();
    for (let i = 0; i < n; i++) {
      const [nx, ny] = normalAt(P, i);
      i === 0 ? fill.moveTo(P[i][0] + nx * hw, P[i][1] + ny * hw)
              : fill.lineTo(P[i][0] + nx * hw, P[i][1] + ny * hw);
    }
    for (let i = n - 1; i >= 0; i--) {
      const [nx, ny] = normalAt(P, i);
      fill.lineTo(P[i][0] - nx * hw, P[i][1] - ny * hw);
    }
    fill.closePath();
    ctx.fill(fill);

    // --- Specular highlight streak ---
    ctx.globalAlpha = o * 0.65;
    ctx.fillStyle = specCol;
    const streak = new Path2D();
    for (let i = 0; i < n; i++) {
      const [nx, ny] = normalAt(P, i);
      const jx = nx * specSide * w;
      const jy = ny * specSide * w;
      i === 0 ? streak.moveTo(P[i][0] + nx * specW + jx, P[i][1] + ny * specW + jy)
              : streak.lineTo(P[i][0] + nx * specW + jx, P[i][1] + ny * specW + jy);
    }
    for (let i = n - 1; i >= 0; i--) {
      const [nx, ny] = normalAt(P, i);
      const jx = nx * specSide * w;
      const jy = ny * specSide * w;
      streak.lineTo(P[i][0] + jx, P[i][1] + jy);
    }
    streak.closePath();
    ctx.fill(streak);

    // --- Rim highlight ---
    ctx.globalAlpha = o * 0.4;
    ctx.strokeStyle = specCol;
    ctx.lineWidth = Math.max(0.5, specW * 0.4);
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const [nx, ny] = normalAt(P, i);
      const off = specSide * w;
      i === 0 ? ctx.moveTo(P[i][0] + nx * off, P[i][1] + ny * off)
              : ctx.lineTo(P[i][0] + nx * off, P[i][1] + ny * off);
    }
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Render a glossy plastic area: flat fill + radial specular highlight.
   */
  _renderArea(ctx, shape, R, c0, c1, o, progress) {
    const P = shapePoly(shape);
    const b = boxOf(P);
    const size = Math.max(b.w, b.h, 4);
    const r = size / 2;

    ctx.save();

    // --- Drop shadow ---
    ctx.filter = `blur(${this.defaults.shadowBlur}px)`;
    ctx.globalAlpha = o * this.defaults.shadowOpacity;
    ctx.fillStyle = '#000000';
    const shadowPath = new Path2D();
    outlinePath(ctx, shape);
    ctx.translate(this.defaults.shadowOffset, this.defaults.shadowOffset);
    ctx.fill(shadowPath);
    ctx.translate(-this.defaults.shadowOffset, -this.defaults.shadowOffset);
    ctx.filter = 'none';

    // --- Flat plastic fill ---
    ctx.globalAlpha = o;
    ctx.fillStyle = c0;
    outlinePath(ctx, shape);
    ctx.fill();

    // --- Specular highlight (radial, offset to one side) ---
    const specCol = shade2(c0, this.defaults.specLighten);
    const highX = b.cx + (R() - 0.5) * b.w * 0.3;
    const highY = b.cy + (R() - 0.5) * b.h * 0.3;
    const highR = r * 0.4;

    const G = ctx.createRadialGradient(highX, highY, 0, highX, highY, highR);
    G.addColorStop(0, rgbaOf(specCol, o * 0.8));
    G.addColorStop(0.5, rgbaOf(specCol, o * 0.4));
    G.addColorStop(1, rgbaOf(specCol, 0));

    ctx.globalAlpha = o * 0.7;
    ctx.fillStyle = G;
    outlinePath(ctx, shape);
    ctx.fill();

    // --- Rim highlight (bright edge line) ---
    ctx.globalAlpha = o * 0.55;
    ctx.strokeStyle = specCol;
    ctx.lineWidth = Math.max(1, size * this.defaults.rimWidth * 0.5);
    outlinePath(ctx, shape);
    ctx.stroke();

    ctx.restore();
  }
}

export default PlastStyle;
