/**
 * graffiti.js — Graffiti / Spray style.
 *
 * Algorithm: particle-based spray (faithful to Code Painter's `spray`).
 * A spray-can stroke is built from:
 *
 *   1. Overspray haze: 4 concentric low-opacity strokes along the curve,
 *      widening from ~6% to 80% of the full width — the soft haze around
 *      each pass of the can.
 *
 *   2. Dense body: the speckles flying off the stroke. The number of
 *      particles is proportional to the path length × width, and they are
 *      distributed along the quadratic path. Each particle's position is
 *      offset sideways by a gaussian. Alpha varies so the centre is denser.
 *
 *   3. Drips (heavy strokes only): occasional paint drips running downward
 *      from the end of the stroke, more likely on slower, thicker strokes.
 *
 * For blob/ellipse shapes: an airbrushed burst with a speckled halo.
 *
 * The entire stroke is seeded by rngFor(shape.args) so a sprayed line always
 * looks the same — essential for re-bakes and high-res exports.
 *
 * Reference: RE_BREAKDOWN.md §4.2 F (spray)
 */

import {
  rngFor, gaussR, lerp, clamp01,
  quadPts, hexRgb, shade, shade2, mixHex, rgbaOf, rgbToHex
} from './base.js';

export class GraffitiStyle {
  name = 'graffiti';
  category = 'paint';
  description = 'Particle-spray: soft overspray haze, a dense particle body, speckles flying off, and occasional drips on heavy strokes.';

  defaults = {
    strokeSize: { min: 4, max: 24 },
    oversprayLayers: [[2.1, 0.06], [1.55, 0.1], [1.2, 0.28], [0.92, 0.8]],
    speckleDensity: 0.6,   // particles per pixel of path length
    dotSize: 0.055,        // min dot radius as fraction of width
    speckleOpacityMin: 0.2,
    speckleOpacityMax: 0.85,
    dripProbability: 0.62,  // chance of drips on heavy strokes
    dripLength: 3.2,        // max drip length as fraction of width
    haloSpeckles: 160       // speckles for blob shapes
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
        strokes.push(this._makeBlob(region, color));
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

  _makeBlob(region, color) {
    const c = Array.isArray(color) ? color : [color, color, color];
    const r = Math.max(5, Math.min(region.w, region.h) * 0.4);
    return {
      type: 'E',
      params: [region.cx, region.cy, r, r * (0.7 + Math.random() * 0.5), 0, c, c, 1],
      seed: [region.cx, region.cy, r, 0, 0, 0]
    };
  }

  /**
   * Render a spray stroke or blob.
   * Faithful to Code Painter's `spray` function.
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} shape
   * @param {number} progress - 0..1 (draws first `progress` of the stroke)
   * @param {number} dir - 1 or -1 (stroke direction)
   */
  render(ctx, shape, progress = 1, dir = 1) {
    const a = shape.params;
    const R = rngFor(a);
    let colour = a[shape.type === 'S' ? 8 : 6];
    colour = Array.isArray(colour) ? rgbToHex(colour) : (typeof colour === 'string' ? colour : '#000000');
    const o = a[a.length - 1];

    // g(): skewed gaussian for speckle distribution (favors center)
    const g = () => (R() + R() + R() - 1.5) / 1.5;

    ctx.save();
    ctx.fillStyle = ctx.strokeStyle = colour;
    ctx.lineCap = ctx.lineJoin = 'round';

    if (shape.type === 'S') {
      this._renderSprayLine(ctx, a, R, o, progress, dir, g);
    } else {
      this._renderSprayBlob(ctx, a, R, o, progress, g);
    }

    ctx.restore();
  }

  /**
   * Spray line: overspray haze + speckle body + drips.
   * Mirrors Code Painter's spray() for S-type shapes.
   */
  _renderSprayLine(ctx, a, R, o, u, dir, g) {
    let [x0, y0, x1, y1, x2, y2, w] = a;
    if (dir < 0) [x0, y0, x2, y2] = [x2, y2, x0, y0];

    // Bezier evaluation: point at parameter s
    const pt = s => {
      const v = 1 - s;
      return [v * v * x0 + 2 * v * s * x1 + s * s * x2, v * v * y0 + 2 * v * s * y1 + s * s * y2];
    };
    // Tangent at parameter s (unit direction)
    const tn = s => {
      const dx = 2 * (1 - s) * (x1 - x0) + 2 * s * (x2 - x1);
      const dy = 2 * (1 - s) * (y1 - y0) + 2 * s * (y2 - y1);
      const d = Math.hypot(dx, dy) || 1;
      return [dx / d, dy / d];
    };

    // 1. Overspray haze: concentric low-opacity strokes
    const qx = x0 + (x1 - x0) * u;
    const qy = y0 + (y1 - y0) * u;
    const [ex, ey] = pt(u);
    for (const [k, al] of this.defaults.oversprayLayers) {
      ctx.globalAlpha = o * al;
      ctx.lineWidth = w * k;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo(qx, qy, ex, ey);
      ctx.stroke();
    }

    // 2. Speckle body: particles distributed along the path with density falloff
    const len = Math.hypot(x1 - x0, y1 - y0) + Math.hypot(x2 - x1, y2 - y1);
    const n = Math.min(420, Math.round(len * u * this.defaults.speckleDensity + w * 4 * u));
    const dot = Math.max(this.defaults.dotSize * 10, w * this.defaults.dotSize);
    for (let i = 0; i < n; i++) {
      const s = R() * u;
      const [px, py] = pt(s);
      const [tx, ty] = tn(s);
      const off = g() * w * 1.25;
      const r = dot * (0.4 + R() * 1.4);
      ctx.globalAlpha = o * (this.defaults.speckleOpacityMin + R() * this.defaults.speckleOpacityMax);
      ctx.beginPath();
      ctx.arc(px - ty * off, py + tx * off, r, 0, 7);
      ctx.fill();
    }

    // 3. Drips (heavy + thick strokes only)
    if (u >= 1 && w > 4 && R() < this.defaults.dripProbability) {
      const nd = R() < 0.4 ? 2 : 1;
      for (let d = 0; d < nd; d++) {
        const [dx, dy] = pt(0.15 + R() * 0.7);
        const L = w * (0.8 + R() * this.defaults.dripLength);
        const dw = w * (0.1 + R() * 0.12);
        ctx.globalAlpha = o * 0.85;
        ctx.beginPath();
        ctx.moveTo(dx - dw, dy);
        ctx.quadraticCurveTo(dx - dw * 0.5, dy + L * 0.6, dx - dw * 0.35, dy + L);
        ctx.lineTo(dx + dw * 0.35, dy + L);
        ctx.quadraticCurveTo(dx + dw * 0.5, dy + L * 0.6, dx + dw, dy);
        ctx.closePath();
        ctx.fill();
        // Drip tip
        ctx.beginPath();
        ctx.arc(dx, dy + L, dw * 0.75, 0, 7);
        ctx.fill();
      }
    }
  }

  /**
   * Spray blob/ellipse: airbrushed burst with a speckled halo.
   * Mirrors Code Painter's spray() for non-S shapes.
   */
  _renderSprayBlob(ctx, a, R, o, u, g) {
    const [cx, cy, rx, ry, rot] = a;
    const m = Math.max(rx, ry);
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.scale(rx / m, ry / m);

    const G = ctx.createRadialGradient(0, 0, 0, 0, 0, m * 1.25);
    const blobCol = Array.isArray(a[6]) ? rgbToHex(a[6]) : (typeof a[6] === 'string' ? a[6] : '#000000');
    G.addColorStop(0, blobCol);
    G.addColorStop(0.62, blobCol);
    G.addColorStop(1, blobCol + '00');
    ctx.globalAlpha = o * 0.9 * u;
    ctx.fillStyle = G;
    ctx.beginPath();
    ctx.arc(0, 0, m * 1.25 * Math.max(0.2, u), 0, 7);
    ctx.fill();

    // Speckled halo
    ctx.fillStyle = blobCol;
    const n = Math.min(this.defaults.haloSpeckles, Math.round(m * 1.2));
    for (let i = 0; i < n * u; i++) {
      const an = R() * 6.283;
      const rr = m * (0.95 + Math.abs(g()) * 0.7);
      ctx.globalAlpha = o * (this.defaults.speckleOpacityMin + R() * 0.6);
      ctx.beginPath();
      ctx.arc(Math.cos(an) * rr, Math.sin(an) * rr, Math.max(0.5, m * 0.03) * (0.4 + R()), 0, 7);
      ctx.fill();
    }
    ctx.restore();
  }
}

export default GraffitiStyle;
