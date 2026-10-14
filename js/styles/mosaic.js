/**
 * mosaic.js — Mosaic / tessellated tile style.
 *
 * Algorithm: grid-based square tiles with a dark "grout" line between
 * them. Each tile is filled with a colour sampled from the source
 * image (with slight variation per tile), and the grout creates the
 * appearance of individual ceramic or glass tiles.
 *
 * Based on Code Painter's mosaic renderer:
 *   - Tile size is ~9% of the smaller shape dimension (min 0.5px)
 *   - Grout: a dark stroke around each tile (shade(c, -0.62))
 *   - Tile fill: a linear gradient from shade(c, 0.2) to shade(c, -0.14)
 *   - Random rotation per tile for organic variation
 *
 * The pattern is generated within the shape's bounding box and clipped
 * to the shape outline.
 *
 * Reference: RE_BREAKDOWN.md §4.3, Code Painter STYLE_DRAW.mosaic
 */

import {
  rngFor, gaussR, lerp, clamp01,
  boxOf, hexRgb, shade, shade2, mixHex, rgbaOf,
  shapePoly, outlinePath
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

export class MosaicStyle {
  name = 'mosaic';
  category = 'graphic';
  description = 'Grid-based square tiles with dark grout between them. Each tile is filled with a gradient sampled from the source colour, with slight variation per tile and random rotation for an organic, hand-set-tile look.';

  defaults = {
    strokeSize: { min: 2, max: 10 },
    tileSizeFactor: 0.09,   // tile size as fraction of shape size
    tileSizeMin: 0.5,       // minimum tile size in pixels
    groutDarken: 0.62,      // how much to darken the grout colour
    tileLighten: 0.2,       // highlight on tile gradient
    tileDarken: 0.14,       // shadow on tile gradient
    tileJitter: 0.07,       // random rotation per tile (radians)
    tileVariety: 0.12,      // colour variation per tile
    minRegionArea: 100
  };

  generate(analyzer, params) {
    const cfg = { ...this.defaults, ...params };
    const strokes = [];

    if (analyzer && analyzer.regions) {
      for (const region of analyzer.regions) {
        if (region.area < (cfg.minRegionArea || 100)) continue;
        const color = analyzer.sampleColor(region.cx, region.cy);
        strokes.push(this._makeShape(region, color));
      }
    }

    // Also handle edges as thin mosaic strips
    if (analyzer && analyzer.edges) {
      for (const edge of analyzer.edges) {
        const color = analyzer.sampleColor(edge.cx, edge.cy);
        strokes.push(this._makeShape(edge, color));
      }
    }

    return strokes;
  }

  _makeShape(region, color) {
    const c = Array.isArray(color) ? color : [color, color, color];
    return {
      type: 'B',
      params: [region.cx, region.cy, Math.max(region.w, 4), Math.max(region.h, 4), 0, c, c, 1],
      color0: c,
      color1: c,
      alpha: 1,
      seed: [region.cx, region.cy, region.w, region.h]
    };
  }

  render(ctx, shape, progress = 1) {
    const [c0, c1, o] = resolveColors(shape);
    const a = shape.params;

    if (shape.type === 'S') {
      // For stroke shapes, fill the area under the stroke as a bar
      const w = Math.max(3, a[6]);
      const barShape = {
        type: 'B',
        params: [(a[0] + a[4]) / 2, (a[1] + a[5]) / 2, Math.abs(a[4] - a[0]), w, 0, c0, c1, o],
        color0: c0, color1: c1, alpha: o
      };
      this._renderArea(ctx, barShape, c0, c1, o);
    } else {
      this._renderArea(ctx, shape, c0, c1, o, progress);
    }
  }

  /**
   * Render mosaic tiles within a shape.
   *
   * Each tile is a square filled with a linear gradient
   * (light → base → dark) and bordered by a grout line.
   * A slight random rotation gives the tiles an organic look.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} shape
   * @param {string} c0 - Base tile colour
   * @param {string} c1 - Secondary colour
   * @param {number} o - Opacity
   * @param {number} progress - 0..1
   */
  _renderArea(ctx, shape, c0, c1, o, progress) {
    const a = shape.params;
    const isStroke = shape.type === 'S';
    
    // For strokes, treat as a bar shape
    let cx, cy, w, h, r;
    if (isStroke) {
      const s = [a[0], a[1], a[4], a[5]];
      cx = (s[0] + s[2]) / 2;
      cy = (s[1] + s[3]) / 2;
      w = Math.hypot(s[2] - s[0], s[3] - s[1]);
      h = Math.max(3, a[6]);
      r = Math.atan2(s[3] - s[1], s[2] - s[0]);
    } else {
      [cx, cy, w, h, r] = a;
    }

    const P = shapePoly({ t: 'B', p: [cx, cy, w / 2, h / 2, r || 0] });
    const b = boxOf(P);
    const size = Math.max(b.w, b.h, 2);
    const tile = Math.max(this.defaults.tileSizeMin, size * this.defaults.tileSizeFactor);
    const R = rngFor(a.slice(0, 6));

    ctx.save();
    ctx.globalAlpha = o;

    // Draw grout background first (dark borders)
    const groutCol = shade(c0, -this.defaults.groutDarken);

    // Clip to the shape
    outlinePath(ctx, shape.type === 'S' 
      ? { type: 'B', params: [cx, cy, w / 2, h / 2, r || 0, c0, c1, o], t: 'B', p: [cx, cy, w / 2, h / 2, r || 0] }
      : shape
    );
    ctx.clip();

    // Draw tiles
    const cols = Math.ceil(b.w / tile) + 1;
    const rows = Math.ceil(b.h / tile) + 1;
    const halfW = w / 2;
    const halfH = h / 2;

    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const tx = b.x0 + i * tile;
        const ty = b.y0 + j * tile;

        // Check if tile centre is inside the shape
        const px = tx + tile / 2;
        const py = ty + tile / 2;
        
        // Transform point back to shape space for inPoly test
        // (simplified: since we clipped, we can just draw all tiles)
        
        // Tile colour with slight variation
        const varFactor = 1 - R() * this.defaults.tileVariety;
        const tileCol = shade2(c0, (R() - 0.5) * this.defaults.tileVariety);

        // Linear gradient on the tile
        const G = ctx.createLinearGradient(tx, ty, tx + tile, ty + tile);
        G.addColorStop(0, shade(tileCol, this.defaults.tileLighten * varFactor));
        G.addColorStop(0.45, tileCol);
        G.addColorStop(1, shade(tileCol, -this.defaults.tileDarken * varFactor));

        // Random rotation per tile
        const rot = (R() - 0.5) * this.defaults.tileJitter;
        const centerX = tx + tile / 2;
        const centerY = ty + tile / 2;

        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(rot);
        ctx.fillStyle = G;
        ctx.fillRect(-tile / 2, -tile / 2, tile, tile);

        // Grout: dark border around the tile
        ctx.strokeStyle = groutCol;
        ctx.lineWidth = 0.5;
        ctx.strokeRect(-tile / 2, -tile / 2, tile, tile);
        ctx.restore();
      }
    }

    ctx.restore();
  }
}

export default MosaicStyle;
