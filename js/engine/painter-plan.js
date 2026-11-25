import { Painter } from './painter.js';
import { aliasStyle } from './style-alias.js';

export const PAINTER_PLAN_DEFAULTS = {
  enabled: true,
  style: 'pencil',
  count: 400,
  seed: 12345,
  smart: true,
};

/**
 * Convert one raw Painter shape to the engine shape contract.
 * Geometry and both colours are copied, including their parameter embeddings.
 *
 * @param {{t:string,p:number[],c0:number[],c1:number[],a:number,st:string,fl:boolean}} raw
 * @param {number} order
 * @param {number} seed
 * @param {number} [layerIdx=0]
 * @returns {object}
 */
export function painterToEngineShape(raw, order, seed, layerIdx = 0) {
  const t = raw.t;
  const params = raw.p.slice();
  const color0 = raw.c0.slice();
  const color1 = raw.c1.slice();
  const alpha = raw.a;

  if (t === 'E' || t === 'B' || t === 'R') {
    params[5] = color0.slice();
    params.push(color1.slice(), alpha);
  } else {
    params.push(color0.slice(), color1.slice(), alpha);
  }

  return {
    id: `stroke_${layerIdx}_${order}`,
    type: t,
    params,
    color0,
    color1,
    alpha,
    style: raw.st,
    layer: layerIdx,
    order,
    seed,
    flat: raw.fl,
  };
}

function emptyPlan(reason) {
  return {
    used: false,
    reason,
    shapes: [],
    sim: 0,
    layerBands: null,
    bandCounts: null,
  };
}

/**
 * Run Painter and expose its committed shapes in the engine shape format.
 * This adapter does not duplicate any painting or analysis algorithm.
 *
 * @param {{pixels:ArrayLike<number>,width:number,height:number}} analysis
 * @param {object} [args]
 * @returns {Promise<{used:boolean,reason:string,shapes:object[],sim:number,layerBands:null,bandCounts:null}>}
 */
export async function buildPainterModularPlan(analysis, args = {}) {
  const options = { ...PAINTER_PLAN_DEFAULTS, ...args };
  if (!options.enabled) return emptyPlan('disabled');

  const { width, height, pixels } = analysis || {};
  if (!Number.isInteger(width) || !Number.isInteger(height)
      || width <= 0 || height <= 0 || pixels == null
      || typeof pixels.length !== 'number'
      || pixels.length < width * height * 4) {
    return emptyPlan('no-analysis');
  }

  const {
    style, count, seed, smart,
    palette, size, sizeRand, order, outline, rfill, pen,
    structureAlign, alignJitter, abstract,
  } = options;
  const painter = new Painter({
    width,
    height,
    imageData: pixels,
    options: {
      style: aliasStyle(style),
      smart,
      palette,
      size,
      sizeRand,
      order,
      outline,
      rfill,
      pen,
      structureAlign,
      alignJitter,
      abstract,
      maxShapes: count,
      seed,
      layerMode: false,
    },
  });

  await painter.start();
  const shapes = painter.getShapes().map((raw, index) =>
    painterToEngineShape(raw, index, seed));

  return {
    used: shapes.length > 0,
    reason: shapes.length ? 'ok' : 'empty',
    shapes,
    sim: painter.getSimilarity(),
    layerBands: null,
    bandCounts: null,
  };
}

export default {
  PAINTER_PLAN_DEFAULTS,
  painterToEngineShape,
  buildPainterModularPlan,
};
