/**
 * confetti.js — Confetti style.
 *
 * Algorithm: small rotated rectangles and triangles (confetti pieces)
 * scattered across the shape area. Each piece is opaque with a random
 * orientation and a slight colour jitter between c0 and c1 — like
 * party confetti thrown onto the canvas.
 *
 * For area shapes (E/B/T/R): confetti pieces fill the bounding box,
 * clipped to the shape outline. For strokes (S): pieces trail along
 * the path centreline.
 *
 * Reference: RE_BREAKDOWN.md §4.3 (graphic styles), decorative stipple
 */

import {
  rngFor, gaussR, lerp, clamp01,
  quadPts, normalAt, boxOf, shapePoly, outlinePath,
  shade2, mixHex, rgbToHex
} from './base.js';

/**
 * Resolve colors from a shape (supports both engine and style formats).
 * @param {object} shape
 * @returns {[string, string, number]}
 */
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

export class ConfettiStyle {
  name = 'confetti';
  category = 'graphic';
  description = 'Confetti: small rotated rectangles and triangles, opaque, with random orientation and colour variation between c0 and c1. Like party streamers scattered across the canvas.';

  defaults = {
    strokeSize: { min: 2, max: 10 },
    pieceSizeMin: 2.4,        // minimum piece size (px)
    pieceSizeMax: 8.0,        // maximum piece size (px)
    spacingFactor: 0.14,      // piece spacing as fraction of shape size
    spacingMin: 5,            // minimum spacing (px)
    spacingMax: 14,           // maximum spacing (px)
    triRatio: 0.35,           // fraction of pieces that are triangles
    colorJitter: 0.18,        // colour variation (fraction c0↔c1)
    sizeJitter: 0.25,         // random size variation
    spinJitter: 0.2,          // randomness in rotation
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

    if (analyzer && analyzer.edges) {
      for (const edge of analyzer.edges) {
        const color = analyzer.sampleColor(edge.cx, edge.cy);
        strokes.push(this._makeStroke(edge, color));
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

  _makeStroke(edge, color) {
    const c = Array.isArray(color) ? color : [color, color, color];
    return {
      type: 'S',
      params: [edge.x0, edge.y0, edge.cx, edge.cy, edge.x1, edge.y1, 3, 0, c, c, 1],
      color0: c,
      color1: c,
      alpha: 1,
      seed: edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, 3, 0]
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
   * Render confetti pieces along a stroke path.
   */
  _renderStroke(ctx, shape, R, c0, c1, o, progress) {
    const a = shape.params;
    const w = Math.max(2, a[6]);
    const P = quadPts(a, progress, 1, 30);
    const n = P.length;
    if (n < 2) return;

    // Build cumulative length
    const cum = [0];
    for (let i = 1; i < n; i++) {
      cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
    }
    const L = cum[n - 1];

    const d = Math.max(this.defaults.pieceSizeMin * 4, w * 0.8);
    const steps = Math.ceil(L / d);

    ctx.save();
    ctx.globalAlpha = o;
    ctx.lineCap = ctx.lineJoin = 'round';

    let j = 1;
    for (let k = 0; k <= steps; k++) {
      if (k / steps > progress) break;
      const t = k / steps;
      const target = t * L;
      while (j < n - 2 && cum[j] < target) j++;
      const seg = cum[j] - cum[j - 1] || 1;
      const f = (target - cum[j - 1]) / seg;
      const px = P[j - 1][0] + (P[j][0] - P[j - 1][0]) * f;
      const py = P[j - 1][1] + (P[j][1] - P[j - 1][1]) * f;

      // Piece size
      const size = lerp(this.defaults.pieceSizeMin, this.defaults.pieceSizeMax, R()) * (0.8 + R() * this.defaults.sizeJitter);
      const rot = R() * Math.PI * 2 + gaussR(R) * this.defaults.spinJitter;

      // Colour: blend between c0 and c1 with jitter
      const colT = R() * (1 + this.defaults.colorJitter * 2) - this.defaults.colorJitter;
      const col = mixHex(c0, c1, clamp01(colT));

      ctx.fillStyle = col;

      if (R() < this.defaults.triRatio) {
        // Triangle piece
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(rot);
        ctx.beginPath();
        ctx.moveTo(0, -size * 0.866);
        ctx.lineTo(size * 0.75, size * 0.433);
        ctx.lineTo(-size * 0.75, size * 0.433);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else {
        // Rectangle piece
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(rot);
        ctx.fillRect(-size / 2, -size / 2, size, size);
        ctx.restore();
      }

      j++;
    }

    ctx.restore();
  }

  /**
   * Render confetti pieces within an area shape.
   */
  _renderArea(ctx, shape, R, c0, c1, o, progress) {
    const a = shape.params;
    const P = shapePoly(shape);
    const b = boxOf(P);
    const size = Math.max(b.w, b.h, 4);

    const spacing = clamp01(
      lerp(this.defaults.spacingMin, this.defaults.spacingMax,
           clamp01(size * this.defaults.spacingFactor))
    );

    ctx.save();
    outlinePath(ctx, shape);
    ctx.clip();

    ctx.globalAlpha = o;
    ctx.lineCap = ctx.lineJoin = 'miter';

    const cols = Math.ceil(b.w / spacing) + 1;
    const rows = Math.ceil(b.h / spacing) + 1;

    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const px = b.x0 + i * spacing + (R() - 0.5) * spacing * 0.4;
        const py = b.y0 + j * spacing + (R() - 0.5) * spacing * 0.4;
        if (px < b.x0 - spacing || px > b.x1 + spacing) continue;
        if (py < b.y0 - spacing || py > b.y1 + spacing) continue;

        // Piece size
        const pieceSize = lerp(this.defaults.pieceSizeMin, this.defaults.pieceSizeMax, R())
          * (0.8 + R() * this.defaults.sizeJitter);
        const rot = R() * Math.PI * 2 + gaussR(R) * this.defaults.spinJitter;

        // Colour: blend between c0 and c1
        const colT = R() * (1 + this.defaults.colorJitter * 2) - this.defaults.colorJitter;
        const col = mixHex(c0, c1, clamp01(colT));

        ctx.fillStyle = col;

        if (R() < this.defaults.triRatio) {
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(rot);
          ctx.beginPath();
          ctx.moveTo(0, -pieceSize * 0.866);
          ctx.lineTo(pieceSize * 0.75, pieceSize * 0.433);
          ctx.lineTo(-pieceSize * 0.75, pieceSize * 0.433);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        } else {
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(rot);
          ctx.fillRect(-pieceSize / 2, -pieceSize / 2, pieceSize, pieceSize);
          ctx.restore();
        }
      }
    }

    ctx.restore();
  }
}

export default ConfettiStyle;
