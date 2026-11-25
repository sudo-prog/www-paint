/**
 * painterly-planner.js — Hertzmann painterly stroke planner.
 *
 * Wraps the vendored davemaynard/painterly library (MIT, (c) 2026 Dave Maynard)
 * and converts its stroke plans into WWW_PAINT engine shape format.
 *
 * The painterly library's `plan()` implements Hertzmann 1998: it grows strokes
 * ALONG the image gradient (perpendicular to gradient direction), across five
 * brush radii (coarse→fine), and stops a stroke when the canvas already
 * matches the photo. That edge-following, curvature-aware, multi-size stroke
 * path is what makes painterly look like painterly.
 *
 * This module exports a single function `planPainterly` that:
 * 1. Builds a source raster from ImageData
 * 2. Calls painterly's `plan()` with appropriate options
 * 3. Converts each painterly Stroke into a WWW_PAINT engine shape (type 'S',
 *    quadratic Bézier with params [x0,y0,cx,cy,x1,y1,width,angle])
 * 4. Returns the shapes in painterly's painting order (coarse underpainting first)
 */

import {
  plan,
  rasterFromImageData,
  defaultRadii,
  brushes,
} from '../vendor/painterly/painterly.esm.js';

/**
 * Convert a painterly stroke polyline to a quadratic Bézier engine shape.
 *
 * @param {object} stroke - Painterly stroke: { layer, radius, color:[r,g,b], points:[[x,y],...], jitter }
 * @param {number} index - Paint order index
 * @returns {object} Engine shape: { id, type:'S', params:[x0,y0,cx,cy,x1,y1,width,angle], color0, color1, alpha, style, layer, order, seed, flat }
 */
function strokeToEngineShape(stroke, index) {
  const { layer, radius, color, points, jitter } = stroke;

  // Need at least 2 points for a stroke
  if (!points || points.length < 2) {
    return null;
  }

  const first = points[0];
  const last = points[points.length - 1];
  const x0 = first[0];
  const y0 = first[1];
  const x1 = last[0];
  const y1 = last[1];

  // Compute control point: use the middle point of the polyline,
  // reflected about the chord midpoint to keep the curve hugging the path
  const midIdx = Math.floor(points.length / 2);
  const mid = points[midIdx];
  const chordMidX = (x0 + x1) / 2;
  const chordMidY = (y0 + y1) / 2;
  // Reflect mid about chord midpoint: ctrl = 2 * chordMid - mid
  let cx = 2 * chordMidX - mid[0];
  let cy = 2 * chordMidY - mid[1];

  // Clamp control point deviation: limit perpendicular distance to chord
  // to at most 0.5 * pathLength (prevent ballooning)
  const chordLen = Math.hypot(x1 - x0, y1 - y0);
  if (chordLen > 0) {
    // Perpendicular distance from control point to chord line
    // Line: (y1-y0)x - (x1-x0)y + (x1-x0)y0 - (y1-y0)x0 = 0
    const A = y1 - y0;
    const B = -(x1 - x0);
    const C = (x1 - x0) * y0 - (y1 - y0) * x0;
    const dist = Math.abs(A * cx + B * cy + C) / Math.hypot(A, B);
    const maxDist = chordLen * 0.5;
    if (dist > maxDist) {
      // Project control point onto line at maxDist along perpendicular
      const norm = Math.hypot(A, B);
      const sign = (A * cx + B * cy + C) >= 0 ? 1 : -1;
      const ux = A / norm;
      const uy = B / norm;
      // Move control point toward chord by (dist - maxDist)
      cx -= ux * (dist - maxDist) * sign;
      cy -= uy * (dist - maxDist) * sign;
    }
  }

  // Width = painterly radius * 2 (painterly's radius IS the brush radius;
  // WWW_PAINT's params[6] is a full stroke width)
  const width = radius * 2;

  // Angle = atan2(y1-y0, x1-x0)
  const angle = Math.atan2(y1 - y0, x1 - x0);

  // Color is [r,g,b] for both color0 and color1 (solid colour)
  const c0 = color.slice();
  const c1 = color.slice();

  return {
    id: `stroke_0_${index}`,
    type: 'S',
    params: [x0, y0, cx, cy, x1, y1, width, angle],
    color0: c0,
    color1: c1,
    alpha: 1,
    style: 'painterly',
    layer: 0,
    order: index,
    seed: jitter,
    flat: false,
  };
}

/**
 * Plan painterly strokes for an image.
 *
 * @param {ImageData|object} imageData - ImageData-like with {width, height, data: Uint8ClampedArray}
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @param {object} opts - Options
 * @param {number} [opts.seed=1] - Random seed for deterministic output
 * @param {number} [opts.count] - Target stroke count (trim from end if exceeded)
 * @param {number} [opts.threshold=40] - Painterly threshold (RGB distance)
 * @param {number[]} [opts.radii] - Custom radii array (default: defaultRadii(width,height))
 * @param {string} [opts.flow='tensor'] - Flow field: 'tensor' or 'gradient'
 * @returns {Array<object>} Array of engine shapes in painterly painting order
 */
export function planPainterly(imageData, width, height, opts = {}) {
  const {
    seed = 1,
    count,
    threshold = 40,
    radii,
    flow = 'tensor',
  } = opts;

  // Build source raster from ImageData
  // painterly's rasterFromImageData accepts {width, height, data} where data is RGBA
  const source = rasterFromImageData({
    width,
    height,
    data: imageData.data,
  });

  // Use default radii progression (5 brushes coarse→fine) unless overridden
  const brushRadii = radii || defaultRadii(width, height);

  // Call painterly's planner
  const painting = plan(source, {
    seed,
    radii: brushRadii,
    threshold,
    flow,
    // Default painterly options
    gridFactor: 1,
    blurFactor: 0.5,
    minLength: 3,
    maxLength: 10,
    curvature: 1,
  });

  // Convert each painterly stroke to engine shape
  const shapes = [];
  for (let i = 0; i < painting.strokes.length; i++) {
    const engineShape = strokeToEngineShape(painting.strokes[i], i);
    if (engineShape) {
      shapes.push(engineShape);
    }
  }

  // Honour count: trim from the END (keep coarse underpainting strokes)
  if (count !== undefined && count > 0 && shapes.length > count) {
    shapes.length = count;
  }

  return shapes;
}

export default { planPainterly };