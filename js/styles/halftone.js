/**
 * halftone.js — Ben-Day / comic-book halftone style.
 *
 * Algorithm: dots on a 45° screen grid, where each dot's radius is
 * proportional to the tone/luminance value at that position. Light
 * areas produce small dots (or no dots), dark areas produce large dots.
 * Multiple dot layers at different colours create the classic comic
 * book printing effect.
 *
 * Based on Code Painter's halftone renderer:
 *   - Screen angle: 45° (Math.SQRT1_2 for cos/sin)
 *   - Dot spacing: ~7% of shape size (min 3.2px, max 13px)
 *   - Dot radius: d * (0.2 + 0.32 * tone) where tone ∝ luminance
 *   - 4 colour layers, each filled with a dot at its position
 *   - Gradient tone: `gradT(q)` returns a function (px,py) → [0..1]
 *     - For blobs (B): radial from centre
 *     - For other shapes: projection along the shape's axis
 *
 * The halftone screen is clipped to the shape outline. Dots are
 * bucketed into 4 layers (quarters of the tone range) for colour
 * interpolation between c0 and c1.
 *
 * Reference: RE_BREAKDOWN.md §4.3, Code Painter STYLE_DRAW.halftone
 */

import {
  rngFor, gaussR, lerp, clamp01,
  quadPts, normalAt, boxOf, shapePoly, outlinePath,
  hexRgb, shade2, mixHex, rgbaOf
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

/**
 * Build a tone function for a shape — returns a function (px, py) → [0..1]
 * that gives the luminance value at a point within the shape.
 *
 * For blobs (B): radial gradient from centre (0 at centre, 1 at edge).
 * For other shapes: linear projection along the shape's gradient axis.
 *
 * @param {object} shape - Normalized shape object
 * @param {function} R - Seeded RNG (for jitter)
 * @returns {function(number, number): number} Tone function
 */
function gradT(shape, R) {
  const a = shape.p;
  if (shape.t === 'B' || shape.t === 'E') {
    // Radial gradient from centre for blobs/ellipses
    // B params: [cx, cy, rx, ry, rot, c0, c1, o]
    const cx = a[0], cy = a[1], rx = a[2], ry = a[3];
    const r = Math.max(1, (rx + ry) / 2);
    return (px, py) => clamp01(Math.hypot(px - cx, py - cy) / r);
  }
  // Linear projection along the shape's gradient axis
  let dx, dy, m, n;
  if (shape.t === 'S') {
    // Stroke: project along the stroke direction
    // S params: [x0, y0, x1, y1, x2, y2, w, g, c0, c1, o]
    const [x0, y0, , , x2, y2] = a;
    const len = Math.hypot(x2 - x0, y2 - y0) || 1;
    dx = (x2 - x0) / len;
    dy = (y2 - y0) / len;
    m = x0 * dx + y0 * dy;
    n = x2 * dx + y2 * dy;
  } else {
    // For R (rect) and T (triangle): project along the gradient angle
    // The angle is at index 4 for R (rotation), or at index 6 for T
    // R params: [cx, cy, w, h, r, c0, c1, o] — r is at index 4
    // T params: [x0, y0, x1, y1, x2, y2, r, c0, c1, o] — r is at index 6
    let gradient = 0;
    if (shape.t === 'R') gradient = typeof a[4] === 'number' ? a[4] : 0;
    else if (shape.t === 'T') gradient = typeof a[6] === 'number' ? a[6] : 0;
    dx = Math.cos(gradient);
    dy = Math.sin(gradient);
    const verts = shapePoly(shape);
    const b = boxOf(verts);
    const proj = [];
    for (let i = 0; i < verts.length; i += 2) {
      proj.push(verts[i] * dx + verts[i + 1] * dy);
    }
    m = Math.min(...proj);
    n = Math.max(...proj);
  }
  const inv = 1 / Math.max(1e-6, n - m);
  if (!R) R = () => 0.5;
  return (px, py) => clamp01((px * dx + py * dy - m) * inv * (0.9 + 0.2 * R()));
}

export class HalftoneStyle {
  name = 'halftone';
  category = 'graphic';
  description = 'Comic-book Ben-Day dots on a 45° screen. Dot radius varies with luminance — light areas produce small or no dots, dark areas produce large dots. Multiple colour layers create the classic halftone printing effect.';

  defaults = {
    strokeSize: { min: 2, max: 10 },
    screenAngle: 0.785,   // 45° in radians
    dotSizeFactor: 0.07,  // dot spacing as fraction of shape size
    dotSizeMin: 3.2,      // minimum dot spacing (px)
    dotSizeMax: 13,       // maximum dot spacing (px)
    dotRadiusMin: 0.2,    // minimum dot radius as fraction of spacing
    dotRadiusMax: 0.52,   // maximum dot radius as fraction of spacing
    colours: 4,           // number of colour layers
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

    return strokes;
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

    this._renderArea(ctx, shape, c0, c1, o, R, progress);
  }

  /**
   * Render halftone dots on a 45° screen grid.
   *
   * Dots are placed on a grid rotated 45°. Each dot's radius is
   * proportional to the tone value at its position. Dots are bucketed
   * into 4 layers (quarters of the [0,1] tone range), each filled with
   * an interpolated colour between c0 and c1.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} shape
   * @param {string} c0 - Light colour
   * @param {string} c1 - Dark colour
   * @param {number} o - Opacity
   * @param {function} R - Seeded RNG
   * @param {number} progress - 0..1
   */
  _renderArea(ctx, shape, c0, c1, o, R, progress) {
    const a = shape.params;
    // Normalize shape for gradT: needs {t, p} format
    const normShape = { t: shape.type, p: a };
    const P = shapePoly(shape);
    const b = boxOf(P);
    const size = Math.max(b.w, b.h, 2);

    // Dot spacing
    const d = Math.max(this.defaults.dotSizeMin, Math.min(this.defaults.dotSizeMax, size * this.defaults.dotSizeFactor));
    const n = Math.ceil(size * 0.75 / d) + 1;
    const cs = Math.SQRT1_2; // cos(45°) = sin(45°) = √2/2

    // Tone function: maps (px, py) → [0, 1]
    const tone = gradT(normShape, R);

    // Create 4 Path2D objects for the colour layers
    const paths = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];

    for (let i = -n; i <= n; i++) {
      for (let j = -n; j <= n; j++) {
        const u = i * d;
        const v = j * d;
        const px = b.cx + (u - v) * cs;
        const py = b.cy + (u + v) * cs;

        // Skip dots outside the shape bounds
        if (px < b.x0 - d || px > b.x1 + d || py < b.y0 - d || py > b.y1 + d) continue;

        // Tone value at this position (0 = light, 1 = dark)
        const t = tone(px, py) * progress;

        // Bucket into one of 4 colour layers
        const k = Math.min(3, Math.floor(t * 4));

        // Dot radius proportional to tone
        const r = d * (this.defaults.dotRadiusMin + this.defaults.dotRadiusMax * t);

        paths[k].moveTo(px + r, py);
        paths[k].arc(px, py, r, 0, 7);
      }
    }

    ctx.save();
    outlinePath(ctx, shape);
    ctx.clip();

    ctx.globalAlpha = o;
    paths.forEach((p, k) => {
      ctx.fillStyle = mixHex(c0, c1, (k + 0.5) / 4);
      ctx.fill(p);
    });

    ctx.restore();
  }
}

export default HalftoneStyle;
