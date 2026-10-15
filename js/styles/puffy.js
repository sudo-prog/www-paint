/**
 * puffy.js — Inflated vinyl relief style.
 *
 * Material id 13. Reference: Code Painter RELIEF table (puffy), RELIEF_FS (default/else).
 */

import { renderReliefShape } from '../engine/relief.js';

export class PuffyStyle {
  name = 'puffy';
  category = '3d';
  description = 'Inflated glossy vinyl ropes — soft, puffed-up profile with a glossy sheen and rim reflections. Lit in 3D.';

  defaults = {
    strokeSize: { min: 5, max: 28 },
    minRegionArea: 100
  };

  generate(analyzer, params) {
    const cfg = { ...this.defaults, ...params };
    const strokes = [];
    if (analyzer && analyzer.edges) {
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
    const w = 5 + Math.random() * 20;
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
    renderReliefShape(ctx, shape, progress, 'puffy');
  }
}

export default PuffyStyle;
