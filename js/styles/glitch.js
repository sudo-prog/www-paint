/**
 * glitch.js — Digital glitch / RGB channel-split style.
 *
 * Algorithm: RGB channel splitting with horizontal displacement slices.
 * The shape is rendered three times — once per RGB channel — each
 * shifted horizontally by a small random amount. The result is a
 * characteristic color-fringe effect. Additionally, horizontal slices
 * of the shape are displaced vertically for the classic glitch look.
 *
 * For strokes (S-type): each channel is drawn as a separate ribbon,
 * offset horizontally. For area shapes: the fill is split into
 * channel-offset layers with displacement slices.
 *
 * Reference: Digital glitch / datamoshing aesthetic,
 * RE_BREAKDOWN.md §4.3 (graphic styles)
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
 * Extract the RGB channels from a hex color as separate hex strings.
 */
function splitChannels(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return [
    '#' + r.toString(16).padStart(2, '0') + '0000',
    '#00' + g.toString(16).padStart(2, '0') + '00',
    '#0000' + b.toString(16).padStart(2, '0')
  ];
}

export class GlitchStyle {
  name = 'glitch';
  category = 'graphic';
  description = 'Digital glitch: RGB channel-split blocks with horizontal displacement slices and hard edges. Each channel is drawn with a small random offset, creating a color-fringe datamosh effect.';

  defaults = {
    strokeSize: { min: 4, max: 24 },
    channelShift: 3.5,      // max horizontal channel offset (px)
    sliceHeight: 8,         // glitch slice height (px)
    sliceShift: 12,         // max horizontal displacement per slice
    sliceCount: 3,          // number of displacement slices
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
   * Render a glitch stroke: 3 channel-offset ribbons.
   */
  _renderStroke(ctx, shape, R, c0, c1, o, progress) {
    const a = shape.params;
    const w = Math.max(2, a[6]);
    const P = quadPts(a, progress, 1, 30);
    const n = P.length;
    if (n < 3) return;

    const channels = splitChannels(c0);
    const shifts = [
      (R() - 0.5) * this.defaults.channelShift * 0.6,
      (R() - 0.5) * this.defaults.channelShift,
      (R() - 0.5) * this.defaults.channelShift * 0.8
    ];

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Draw each channel with offset
    for (let ch = 0; ch < 3; ch++) {
      const sx = shifts[ch];
      ctx.globalAlpha = o;
      ctx.filter = 'none';
      ctx.fillStyle = channels[ch];

      const band = new Path2D();
      for (let i = 0; i < n; i++) {
        const [nx, ny] = normalAt(P, i);
        const off = w / 2;
        i === 0 ? band.moveTo(P[i][0] + nx * off + sx, P[i][1] + ny * off)
                : band.lineTo(P[i][0] + nx * off + sx, P[i][1] + ny * off);
      }
      for (let i = n - 1; i >= 0; i--) {
        const [nx, ny] = normalAt(P, i);
        const off = w / 2;
        band.lineTo(P[i][0] - nx * off + sx, P[i][1] - ny * off);
      }
      band.closePath();
      ctx.fill(band);
    }

    ctx.restore();
  }

  /**
   * Render a glitch area: channel-offset fill + displacement slices.
   */
  _renderArea(ctx, shape, R, c0, c1, o, progress) {
    const P = shapePoly(shape);
    const b = boxOf(P);
    const r = Math.max(1, Math.max(b.w, b.h) / 2);

    const channels = splitChannels(c0);
    const shifts = [
      (R() - 0.5) * this.defaults.channelShift * 0.5,
      (R() - 0.5) * this.defaults.channelShift,
      (R() - 0.5) * this.defaults.channelShift * 0.7
    ];

    ctx.save();

    // Base shape for clipping
    outlinePath(ctx, shape);
    ctx.clip();

    // Draw each channel with offset
    for (let ch = 0; ch < 3; ch++) {
      ctx.save();
      ctx.translate(shifts[ch], 0);
      ctx.globalAlpha = o;
      ctx.fillStyle = channels[ch];
      ctx.fillRect(b.x0 - 20, b.y0 - 20, b.w + 40, b.h + 40);
      ctx.restore();
    }

    ctx.restore();
    ctx.clip(); // re-establish clip for slices

    // --- Horizontal displacement slices ---
    ctx.save();
    outlinePath(ctx, shape);
    ctx.clip();

    const sliceH = this.defaults.sliceHeight;
    const sliceCount = this.defaults.sliceCount;
    const bandH = b.h / sliceCount;

    for (let i = 0; i < sliceCount; i++) {
      const sy = b.y0 + i * bandH;
      const dh = (R() - 0.5) * this.defaults.sliceShift;

      ctx.save();
      ctx.translate(dh, 0);
      ctx.globalAlpha = o;
      ctx.fillStyle = c0;
      ctx.fillRect(b.x0 - 20, sy, b.w + 40, sliceH);
      ctx.restore();
    }

    // --- Hard edge outline ---
    ctx.globalAlpha = o * 0.85;
    ctx.strokeStyle = shade2(c0, -0.3);
    ctx.lineWidth = Math.max(0.5, r * 0.02);
    ctx.filter = 'none';
    outlinePath(ctx, shape);
    ctx.stroke();

    ctx.restore();
  }
}

export default GlitchStyle;
