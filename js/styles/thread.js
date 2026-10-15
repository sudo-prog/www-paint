/**
 * thread.js — Thread / embroidery floss style.
 *
 * Algorithm: thin continuous wound lines with visible stitch direction
 * and slight fuzz at the edges. Thread is drawn as a single-path
 * ribbon (not pressure-sensitive) with a uniform width, a matte base,
 * and a subtle fuzzy edge created by stippling small dots along the
 * path. The stitch direction is visible as a slight texture along
 * the thread's length.
 *
 * For strokes (S-type): the path is drawn as a thin line with fuzzy
 * edges and a directional sheen. For area shapes: thread wound in
 * concentric spirals or parallel lines.
 *
 * Reference: RE_BREAKDOWN.md §4.3 (craft styles), embroidery floss
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

export class ThreadStyle {
  name = 'thread';
  category = 'craft';
  description = 'Thread: thin continuous wound lines with visible stitch direction and slight fuzz. Uniform-width matte strands with a subtle directional sheen and fiber texture.';

  defaults = {
    strokeSize: { min: 1.5, max: 8 },
    fuzzAmount: 0.4,       // fiber fuzz radius as fraction of width
    fuzzDensity: 0.3,      // fuzz speckle density (per unit length)
    sheenLighten: 0.28,    // directional sheen brightness
    sheenWidth: 0.5,       // sheen coverage as fraction of width
    twistFreq: 3.5,        // how often the thread twists per segment
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
      type: 'B',
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
   * Render a thread strand: thin line with fuzz and directional sheen.
   *
   * The thread is drawn as a flat ribbon with a matte base color,
   * a brighter sheen band offset to one side (simulating light
   * reflecting off the twisted fibers), and fuzz speckles along
   * the edges.
   */
  _renderStroke(ctx, shape, R, c0, c1, o, progress) {
    const a = shape.params;
    const w = Math.max(1, a[6]);
    const P = quadPts(a, progress, 1, 30);
    const n = P.length;
    if (n < 2) return;

    const hw = w / 2;
    const fuzzR = w * this.defaults.fuzzAmount;
    const sheenCol = shade2(c0, this.defaults.sheenLighten);
    const sheenOff = w * (R() - 0.5) * this.defaults.sheenWidth;

    ctx.save();
    ctx.lineCap = 'round';

    // --- Main thread body (flat matte) ---
    ctx.globalAlpha = o;
    ctx.fillStyle = c0;

    const band = new Path2D();
    for (let i = 0; i < n; i++) {
      const [nx, ny] = normalAt(P, i);
      i === 0 ? band.moveTo(P[i][0] + nx * hw, P[i][1] + ny * hw)
              : band.lineTo(P[i][0] + nx * hw, P[i][1] + ny * hw);
    }
    for (let i = n - 1; i >= 0; i--) {
      const [nx, ny] = normalAt(P, i);
      band.lineTo(P[i][0] - nx * hw, P[i][1] - ny * hw);
    }
    band.closePath();
    ctx.fill(band);

    // --- Directional sheen (slightly offset highlight) ---
    ctx.globalAlpha = o * 0.55;
    ctx.strokeStyle = sheenCol;
    ctx.lineWidth = Math.max(0.3, w * this.defaults.sheenWidth);
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const [nx, ny] = normalAt(P, i);
      const sx = P[i][0] + nx * sheenOff;
      const sy = P[i][1] + ny * sheenOff;
      i === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
    }
    ctx.stroke();

    // --- Fuzz speckles along the edges ---
    ctx.globalAlpha = o * 0.35;
    ctx.fillStyle = shade2(c0, -0.1);
    const step = Math.max(1, Math.floor(w * 2));
    for (let i = 0; i < n; i += step) {
      if (i >= n) break;
      const [nx, ny] = normalAt(P, i);
      for (const side of [-1, 1]) {
        const fx = P[i][0] + nx * hw * side + (R() - 0.5) * fuzzR * 0.6;
        const fy = P[i][1] + ny * hw * side + (R() - 0.5) * fuzzR * 0.6;
        const fr = (R() * 0.4 + 0.1) * fuzzR * 0.3;
        ctx.beginPath();
        ctx.arc(fx, fy, fr, 0, 7);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  /**
   * Render thread wound in a spiral pattern within an area shape.
   */
  _renderArea(ctx, shape, R, c0, c1, o, progress) {
    const a = shape.params;
    const P = shapePoly(shape);
    const b = boxOf(P);
    const size = Math.max(b.w, b.h, 4);

    const w = Math.max(1, size * 0.02 + R() * size * 0.015);
    const turns = Math.max(3, Math.round(size / w / 3));
    const shear = 0.3 + R() * 0.4;

    ctx.save();
    outlinePath(ctx, shape);
    ctx.clip();

    ctx.lineCap = 'round';
    ctx.globalAlpha = o;
    ctx.strokeStyle = c0;
    ctx.lineWidth = w;

    // Spiral wound thread
    const maxR = size * 0.45;
    ctx.beginPath();
    for (let i = 0; i <= 200; i++) {
      const t = i / 200 * turns;
      const r = maxR * (1 - i / 200) * progress;
      const angle = t * Math.PI * 2;
      const x = b.cx + Math.cos(angle) * r + gaussR(R) * w * 0.1;
      const y = b.cy + Math.sin(angle) * r * shear + gaussR(R) * w * 0.1;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // --- Sheen on the spiral ---
    const sheenCol = shade2(c0, this.defaults.sheenLighten);
    ctx.globalAlpha = o * 0.5;
    ctx.strokeStyle = sheenCol;
    ctx.lineWidth = Math.max(0.2, w * this.defaults.sheenWidth);
    ctx.beginPath();
    const sheenOff = w * 0.3;
    for (let i = 0; i <= 200; i++) {
      const t = i / 200 * turns;
      const r = maxR * (1 - i / 200) * progress;
      const angle = t * Math.PI * 2;
      const nx = Math.cos(angle);
      const ny = Math.sin(angle) * shear;
      const len = Math.hypot(nx, ny) || 1;
      const px = b.cx + nx * r + (nx / len) * sheenOff;
      const py = b.cy + Math.sin(angle) * r * shear + (ny / len) * sheenOff;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    ctx.restore();
  }
}

export default ThreadStyle;
