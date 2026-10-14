/**
 * string.js — String art style.
 *
 * Algorithm: long straight lines connecting points on a grid, following
 * colour gradients. Each line is drawn as a thin stroke with a gradient
 * colour that shifts across the shape, creating the appearance of
 * threads of coloured thread pinned at grid points.
 *
 * Based on Code Painter's string art handling: "hatch" and "string"
 * are NOT in the STYLE_DRAW object — they are handled as S-type line
 * strokes via the default `brushed`/`strokePart` rendering path.
 * Code Painter's pickType() maps "string" as 'S' (stroke) type.
 *
 * The string art style generates:
 *   - For S-type (stroke) shapes: the stroke itself as a single line
 *     with a colour gradient along it
 *   - For E/B/T/R-type (area) shapes: a grid of pins (points on the
 *     boundary), with threads connecting pairs of pins. Threads
 *     follow a colour gradient that shifts from c0 to c1.
 *
 * The threads are drawn as thin straight lines, clipped to the shape,
 * with a gradient colour that varies by position.
 *
 * Reference: RE_BREAKDOWN.md §4.3, Code Painter pickType() (string → 'S')
 */

import {
  rngFor, gaussR, lerp, clamp01,
  quadPts, normalAt, boxOf, shapePoly, outlinePath,
  hexRgb, shade2, mixHex, rgbaOf, rgbToHex
} from './base.js';

/**
 * Resolve colors from a shape (supports both engine and style formats).
 * @param {object} shape
 * @returns {[string, string, number]}
 */
function resolveColors(shape) {
  if (shape.color0 != null || shape.color1 != null) {
    const c0 = Array.isArray(shape.color0)
      ? '#' + shape.color0.map(v => Math.round(v).toString(16).padStart(2, '0')).join('')
      : (typeof shape.color0 === 'string' ? shape.color0 : '#000000');
    const c1 = Array.isArray(shape.color1)
      ? '#' + shape.color1.map(v => Math.round(v).toString(16).padStart(2, '0')).join('')
      : (typeof shape.color1 === 'string' ? shape.color1 : '#000000');
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

export class StringStyle {
  name = 'string';
  category = 'craft';
  description = 'String art: long straight lines connecting points on a grid, following colour gradients from c0 to c1. Thin threads clipped to the shape boundary create a woven, gradient-thread effect.';

  defaults = {
    strokeSize: { min: 1, max: 4 },
    threadWidth: 0.8,      // thread line width
    pinDensity: 0.1,       // pins per unit of shape size
    pinCountMin: 8,        // minimum number of pins on the perimeter
    pinCountMax: 20,       // maximum number of pins
    threadsFactor: 0.6,    // ratio of pin pairs to connect
    threadJitter: 0.15,    // positional jitter of thread endpoints
    minRegionArea: 50
  };

  generate(analyzer, params) {
    const cfg = { ...this.defaults, ...params };
    const strokes = [];

    if (analyzer && analyzer.regions) {
      for (const region of analyzer.regions) {
        if (region.area < (cfg.minRegionArea || 50)) continue;
        const color = analyzer.sampleColor(region.cx, region.cy);
        strokes.push(this._makeShape(region, color));
      }
    }

    // Also handle edges as single thread strokes
    if (analyzer && analyzer.edges) {
      for (const edge of analyzer.edges) {
        const color = analyzer.sampleColor(edge.cx, edge.cy);
        strokes.push(this._makeStroke(edge, color));
      }
    }

    return strokes;
  }

  _makeStroke(edge, color) {
    const c = Array.isArray(color) ? color : [color, color, color];
    return {
      type: 'S',
      params: [edge.x0, edge.y0, edge.cx, edge.cy, edge.x1, edge.y1, 2, 0, c, c, 1],
      color0: c,
      color1: c,
      alpha: 1,
      seed: edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, 2, 0]
    };
  }

  _makeShape(region, color) {
    const c = Array.isArray(color) ? color : [color, color, color];
    return {
      type: 'B',
      params: [region.cx, region.cy, region.w / 2, region.h / 2, 0, c, c, 1],
      color0: c,
      color1: c,
      alpha: 1,
      seed: [region.cx, region.cy, region.w, region.h]
    };
  }

  render(ctx, shape, progress = 1) {
    const [c0, c1, o] = resolveColors(shape);
    const a = shape.params;
    const R = rngFor(shape.seed || a.slice(0, 6));

    if (shape.type === 'S') {
      this._renderStroke(ctx, shape, c0, c1, o, R, progress);
    } else {
      this._renderArea(ctx, shape, c0, c1, o, R, progress);
    }
  }

  /**
   * Render a single thread stroke with a colour gradient along it.
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} shape
   * @param {string} c0 - Start colour
   * @param {string} c1 - End colour
   * @param {number} o - Opacity
   * @param {function} R - Seeded RNG
   * @param {number} progress - 0..1
   */
  _renderStroke(ctx, shape, c0, c1, o, R, progress) {
    const a = shape.params;
    const P = quadPts(a, progress, 1, 24);

    ctx.save();
    const G = ctx.createLinearGradient(P[0][0], P[0][1], P[P.length - 1][0], P[P.length - 1][1]);
    G.addColorStop(0, c0);
    G.addColorStop(1, c1);

    ctx.globalAlpha = o;
    ctx.strokeStyle = G;
    ctx.lineWidth = Math.max(this.defaults.threadWidth, a[6] * 0.4);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(P[0][0], P[0][1]);
    for (let i = 1; i < P.length; i++) {
      ctx.lineTo(P[i][0], P[i][1]);
    }
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Render string art: threads connecting pins on the perimeter.
   *
   * Pins are placed around the shape boundary. Threads connect pairs
   * of pins, with colours following a gradient from c0 to c1 based on
   * the position of the thread's midpoint.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} shape
   * @param {string} c0 - Gradient start colour
   * @param {string} c1 - Gradient end colour
   * @param {number} o - Opacity
   * @param {function} R - Seeded RNG
   * @param {number} progress - 0..1
   */
  _renderArea(ctx, shape, c0, c1, o, R, progress) {
    const a = shape.params;
    const P = shapePoly(shape);
    const b = boxOf(P);
    const size = Math.max(b.w, b.h, 4);

    // Number of pins: proportional to perimeter, clamped
    const n = Math.max(this.defaults.pinCountMin,
                       Math.min(this.defaults.pinCountMax, Math.round(size * this.defaults.pinDensity * 3)));
    const pins = this._getPins(P, n, b, R);

    // Gradient axis for colour interpolation
    // For B type: [cx, cy, rx, ry, r, c0, c1, o]
    // Project along the x-axis as default (simple horizontal gradient)
    let dx = 1, dy = 0, m, nn;
    if (shape.type === 'B' || shape.type === 'E') {
      // Use x-extents for horizontal gradient
      const P_str = shapePoly(shape);
      const b2 = boxOf(P_str);
      m = b2.x0;
      nn = b2.x1;
    } else if (shape.type === 'S') {
      const [x0, y0, , , x2, y2] = a;
      const len = Math.hypot(x2 - x0, y2 - y0) || 1;
      dx = (x2 - x0) / len;
      dy = (y2 - y0) / len;
      m = x0 * dx + y0 * dy;
      nn = x2 * dx + y2 * dy;
    } else {
      // R or T type
      let gradient = 0;
      if (shape.type === 'R') gradient = typeof a[4] === 'number' ? a[4] : 0;
      else if (shape.type === 'T') gradient = typeof a[6] === 'number' ? a[6] : 0;
      dx = Math.cos(gradient);
      dy = Math.sin(gradient);
      const P_str = shapePoly(shape);
      const vert = [];
      for (let i = 0; i < P_str.length; i += 2) vert.push(P_str[i] * dx + P_str[i + 1] * dy);
      m = Math.min(...vert);
      nn = Math.max(...vert);
    }
    const inv = 1 / Math.max(1e-6, nn - m);

    const threadCount = Math.round(pins.length * pins.length * this.defaults.threadsFactor * progress);

    ctx.save();
    outlinePath(ctx, shape);
    ctx.clip();

    ctx.lineCap = 'round';

    // Draw threads — connect pin pairs with gradient colours
    let drawn = 0;
    const maxThreads = Math.min(threadCount, pins.length * 3);

    for (let i = 0; i < pins.length && drawn < maxThreads; i++) {
      for (let j = i + 1; j < pins.length && drawn < maxThreads; j++) {
        const p1 = pins[i];
        const p2 = pins[j];

        // Thread colour based on midpoint position along gradient axis
        const midX = (p1[0] + p2[0]) / 2;
        const midY = (p1[1] + p2[1]) / 2;
        const t = clamp01((midX * dx + midY * dy - m) * inv);
        const col = mixHex(c0, c1, t);

        // Jitter the endpoints slightly
        const jx1 = p1[0] + (R() - 0.5) * size * this.defaults.threadJitter;
        const jy1 = p1[1] + (R() - 0.5) * size * this.defaults.threadJitter;
        const jx2 = p2[0] + (R() - 0.5) * size * this.defaults.threadJitter;
        const jy2 = p2[1] + (R() - 0.5) * size * this.defaults.threadJitter;

        ctx.globalAlpha = o;
        ctx.strokeStyle = col;
        ctx.lineWidth = this.defaults.threadWidth;
        ctx.beginPath();
        ctx.moveTo(jx1, jy1);
        ctx.lineTo(jx2, jy2);
        ctx.stroke();

        drawn++;
      }
    }

    ctx.restore();
  }

  /**
   * Get evenly-spaced pins around the shape perimeter.
   *
   * @param {Array} P - Flat vertex array [x0,y0,x1,y1,...]
   * @param {number} n - Number of pins
   * @param {object} b - Bounding box from boxOf
   * @param {function} R - Seeded RNG
   * @returns {Array<[number, number]>} Pin coordinates
   */
  _getPins(P, n, b, R) {
    const pins = [];
    const numVerts = P.length / 2;

    // Get perimeter vertices as [x, y] pairs
    const verts = [];
    for (let i = 0; i < P.length; i += 2) {
      verts.push([P[i], P[i + 1]]);
    }

    // Walk the perimeter, placing pins at evenly spaced intervals
    const perimeter = [];
    let totalLen = 0;
    for (let i = 0; i < verts.length; i++) {
      const j = (i + 1) % verts.length;
      const dx = verts[j][0] - verts[i][0];
      const dy = verts[j][1] - verts[i][1];
      const len = Math.hypot(dx, dy);
      perimeter.push({ x0: verts[i][0], y0: verts[i][1], x1: verts[j][0], y1: verts[j][1], dx, dy, len, start: totalLen });
      totalLen += len;
    }

    const targetLen = totalLen / n;
    const offset = R() * targetLen; // Random starting offset
    let segIdx = 0;

    for (let i = 0; i < n; i++) {
      const target = offset + (i * targetLen);
      // Handle wrap-around
      const wrapped = target % totalLen;
      // Find the segment containing this distance
      while (segIdx < perimeter.length - 1 && perimeter[segIdx].start + perimeter[segIdx].len < wrapped) {
        segIdx++;
      }
      const seg = perimeter[segIdx];
      const f = (wrapped - seg.start) / Math.max(seg.len, 1e-6);
      pins.push([seg.x0 + seg.dx * f, seg.y0 + seg.dy * f]);
    }

    return pins;
  }
}

export default StringStyle;
