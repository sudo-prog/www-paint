import { Painter } from './painter.js';
import { aliasStyle } from './style-alias.js';
import { computeTonalMasks } from './masks.js';
import { applyLayerStyles } from './layer-styles.js';

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
    regions: null,
    layerMaps: null,
  };
}

/**
 * Build image-derived maps for footprint classification.
 * Returns source-subject mask, soft tonal masks, coarse connected colour regions, diagnostics.
 *
 * @param {Painter} painter - completed Painter instance
 * @param {object} analysis - analyzeImage result
 * @param {object} opts - options
 * @returns {object} layer maps and metadata
 */
export function buildPainterLayerMaps(painter, analysis, opts = {}) {
  const { width, height, pixels } = analysis;

  // Compute soft tonal masks from luminance (derive from pixels if absent)
  let luminance = analysis.luminance;
  if (!luminance && pixels) {
    const n = width * height;
    const lum = new Uint8ClampedArray(n);
    for (let i = 0; i < n; i++) {
      const idx = i * 4;
      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];
      lum[i] = Math.max(0, Math.min(255, Math.round((r * 0.2126) + (g * 0.7152) + (b * 0.0722))));
    }
    luminance = lum;
  }

  const tonal = computeTonalMasks({ width, height, luminance }, {
    lo: opts.tonalLo ?? 85,
    hi: opts.tonalHi ?? 170,
    softness: opts.tonalSoftness ?? 28,
    backgroundThreshold: opts.backgroundThreshold ?? 0.15,
  });

  // Subject mask: painter.Sub when smart mode enabled
  const subject = painter.Sub ? new Float32Array(painter.Sub) : null;

  // Edge mask from analysis
  const edges = analysis.edges ? new Float32Array(analysis.edges) : null;

  // Deterministic coarse connected colour regions
  // Use painter.regionAt approach at grid cells
  const regions = [];
  const regionIdMap = new Int32Array(width * height);
  const gridSize = Math.max(2, Math.round(Math.max(width, height) / 150));
  const gw = Math.ceil(width / gridSize);
  const gh = Math.ceil(height / gridSize);
  const visited = new Uint8Array(gw * gh);

  const atIndex = (gx, gy) => (Math.min(height - 1, gy * gridSize) * width + Math.min(width - 1, gx * gridSize)) * 3;

  const tol = 34; // RGB sum tolerance per channel (same as painter.regionAt)

  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      const idx = gy * gw + gx;
      if (visited[idx]) continue;

      const baseIdx = atIndex(gx, gy);
      const r0 = painter.T[baseIdx];
      const g0 = painter.T[baseIdx + 1];
      const b0 = painter.T[baseIdx + 2];

      const stack = [idx];
      visited[idx] = 1;
      let n = 0;
      let mr = 0, mg = 0, mb = 0;
      let err = 0;
      let x0 = gw, y0 = gh, x1 = 0, y1 = 0;
      const cells = [];

      while (stack.length) {
        const c = stack.pop();
        const cx = c % gw;
        const cy = (c - cx) / gw;
        const o = atIndex(cx, cy);

        n++;
        mr += painter.T[o];
        mg += painter.T[o + 1];
        mb += painter.T[o + 2];
        err += painter.errMap ? painter.errMap[o / 3] : 0;

        if (cx < x0) x0 = cx;
        if (cx > x1) x1 = cx;
        if (cy < y0) y0 = cy;
        if (cy > y1) y1 = cy;

        cells.push(c);

        if (n > gw * gh * 0.35) break;

        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
          const j = ny * gw + nx;
          if (visited[j]) continue;
          const q = atIndex(nx, ny);
          const dr = Math.abs(painter.T[q] - r0);
          const dg = Math.abs(painter.T[q + 1] - g0);
          const db = Math.abs(painter.T[q + 2] - b0);
          if (dr + dg + db > tol * 3) continue;
          visited[j] = 1;
          stack.push(j);
        }
      }

      if (n > 0) {
        const regionId = regions.length;
        for (const c of cells) {
          const cx = c % gw;
          const cy = (c - cx) / gw;
          // Fill regionIdMap for this cell's pixels
          const px0 = cx * gridSize;
          const py0 = cy * gridSize;
          const px1 = Math.min(width, px0 + gridSize);
          const py1 = Math.min(height, py0 + gridSize);
          for (let py = py0; py < py1; py++) {
            const base = py * width + px0;
            for (let px = px0; px < px1; px++) {
              regionIdMap[base + (px - px0)] = regionId;
            }
          }
        }

        regions.push({
          id: regionId,
          cellCount: n,
          pixelCount: n * gridSize * gridSize,
          bbox: [x0 * gridSize, y0 * gridSize, Math.min(width, (x1 + 1) * gridSize), Math.min(height, (y1 + 1) * gridSize)],
          meanColor: [mr / n, mg / n, mb / n],
          meanError: err / n,
        });
      }
    }
  }

  return {
    width,
    height,
    tonal,
    subject,
    edges,
    regions,
    regionIdMap,
    gridSize,
    gw,
    gh,
  };
}

/**
 * Classify a single shape's footprint into the five layer bands.
 * Rasterizes the actual shape, copies any reused scratch spans, then accumulates
 * coverage-weighted membership for background/shadows/midtones/highlights/outline.
 *
 * @param {object} raw - raw Painter shape
 * @param {object} maps - output of buildPainterLayerMaps
 * @param {object} opts - options
 * @returns {object} {layerName, regionId, coverage, subjectCoverage, outlineCoverage, diagnostics, reason}
 */
export function classifyPainterFootprint(raw, maps, opts = {}) {
  const { width, height, tonal, subject, edges, regions, regionIdMap, gridSize, gw, gh } = maps;

  // Extract shape polygon points
  const pts = shapeToPolygon(raw);
  if (!pts || pts.length < 4) {
    return {
      layerName: 'midtone',
      regionId: -1,
      coverage: 0,
      subjectCoverage: 0,
      outlineCoverage: 0,
      diagnostics: { reason: 'degenerate-shape' },
      reason: 'degenerate-shape',
    };
  }

  // Rasterize to spans (same algorithm as Painter.raster)
  const W = width, H = height;
  const n = pts.length >> 1;
  let y0 = 1e9, y1 = -1e9, ns = 0;
  const xs = new Float64Array(256);
  const spans = { y: [], x0: [], x1: [] };

  for (let i = 1; i < pts.length; i += 2) {
    if (pts[i] < y0) y0 = pts[i];
    if (pts[i] > y1) y1 = pts[i];
  }
  y0 = Math.max(0, Math.ceil(y0 - 0.5));
  y1 = Math.min(H - 1, Math.floor(y1 - 0.5));

  for (let y = y0; y <= y1; y++) {
    const yc = y + 0.5;
    let k = 0;
    for (let i = 0; i < n; i++) {
      const ax = pts[i * 2], ay = pts[i * 2 + 1];
      const j = (i + 1) % n;
      const bx = pts[j * 2], by = pts[j * 2 + 1];
      if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) {
        if (k < 256) xs[k++] = ax + (yc - ay) * (bx - ax) / (by - ay);
      }
    }
    for (let a = 1; a < k; a++) {
      const v = xs[a];
      let b = a - 1;
      while (b >= 0 && xs[b] > v) {
        xs[b + 1] = xs[b];
        b--;
      }
      xs[b + 1] = v;
    }
    for (let j = 0; j + 1 < k; j += 2) {
      const xa = Math.max(0, Math.ceil(xs[j] - 0.5));
      const xb = Math.min(W - 1, Math.floor(xs[j + 1] - 0.5));
      if (xb >= xa && ns < 10000) {
        spans.y[ns] = y;
        spans.x0[ns] = xa;
        spans.x1[ns] = xb;
        ns++;
      }
    }
  }

  if (ns === 0) {
    return {
      layerName: 'midtone',
      regionId: -1,
      coverage: 0,
      subjectCoverage: 0,
      outlineCoverage: 0,
      diagnostics: { reason: 'no-spans' },
      reason: 'no-spans',
    };
  }

  // Now compute weighted coverage across bands
  // We need alpha/weight per pixel - for Painter shapes, alpha is constant per shape
  // Weight by: alpha * subject * (1 - edge) for subject areas
  // For outline shapes (_fromOutline flag or strong edge coverage + thin geometry)
  const isOutlineShape = raw._fromOutline === true ||
    (raw.t === 'S' && raw.p && raw.p[6] < 3); // thin stroke

  const alpha = raw.a || 1;
  let totalWeight = 0;
  let bgWeight = 0, shWeight = 0, mdWeight = 0, hlWeight = 0, olWeight = 0;
  let subjWeight = 0;
  let edgeWeight = 0;
  let regionId = -1;
  const regionWeights = new Map();

  const masks = tonal.masks;

  for (let i = 0; i < ns; i++) {
    const y = spans.y[i];
    const xa = spans.x0[i];
    const xb = spans.x1[i];
    const rowBase = y * width;

    for (let x = xa; x <= xb; x++) {
      const pixIdx = rowBase + x;
      const weight = alpha; // base weight

      // Subject probability
      const subj = subject ? subject[pixIdx] : 0.5;
      const subjW = weight * subj;

      // Edge probability
      const edge = edges ? edges[pixIdx] : 0;
      const edgeW = weight * edge;

      // Tonal band memberships
      const bg = masks.background[pixIdx];
      const sh = masks.shadows[pixIdx];
      const md = masks.midtones[pixIdx];
      const hl = masks.highlights[pixIdx];

      // Weight each band
      const w = weight * (1 - edge * 0.5); // reduce weight on edges for tonal bands
      bgWeight += w * bg;
      shWeight += w * sh;
      mdWeight += w * md;
      hlWeight += w * hl;

      // Outline weight: high on edges, especially for thin strokes
      if (isOutlineShape) {
        olWeight += weight * edge;
      } else {
        olWeight += weight * edge * 0.3;
      }

      subjWeight += subjW;
      edgeWeight += edgeW;
      totalWeight += weight;

      // Region assignment
      if (regionIdMap) {
        const rid = regionIdMap[pixIdx];
        if (rid >= 0) {
          regionWeights.set(rid, (regionWeights.get(rid) || 0) + weight);
        }
      }
    }
  }

  if (totalWeight === 0) {
    return {
      layerName: 'midtone',
      regionId: -1,
      coverage: 0,
      subjectCoverage: 0,
      outlineCoverage: 0,
      diagnostics: { reason: 'zero-weight' },
      reason: 'zero-weight',
    };
  }

  // Normalize
  const cov = 1; // footprint covers its spans
  const normBg = bgWeight / totalWeight;
  const normSh = shWeight / totalWeight;
  const normMd = mdWeight / totalWeight;
  const normHl = hlWeight / totalWeight;
  const normOl = olWeight / totalWeight;
  const normSubj = subjWeight / totalWeight;
  const normEdge = edgeWeight / totalWeight;

  // Determine dominant region by weight
  let maxRegionWeight = 0;
  for (const [rid, w] of regionWeights) {
    if (w > maxRegionWeight) {
      maxRegionWeight = w;
      regionId = rid;
    }
  }

  // Determine layer by weighted membership
  // Outline has priority if it's an outline shape or has strong edge coverage
  let layerName = 'midtone';
  let reason = 'tonal';

  if (isOutlineShape || normOl > 0.4) {
    layerName = 'outline';
    reason = isOutlineShape ? 'explicit-outline' : 'edge-coverage';
  } else {
    // For non-outline shapes, use tonal membership weighted by subject
    // Background: low subject + high background membership
    // Shadows: high shadow membership
    // Midtones: default
    // Highlights: high highlight membership

    // Check for background: border-connected low-subject region
    // Simple heuristic: if subject membership is low AND background tonal is high
    if (normSubj < 0.3 && normBg > 0.4) {
      layerName = 'background';
      reason = 'low-subject-high-bg';
    } else if (normSh > Math.max(normMd, normHl, normBg)) {
      layerName = 'shadows';
      reason = 'shadow-dominant';
    } else if (normHl > Math.max(normMd, normSh, normBg)) {
      layerName = 'highlights';
      reason = 'highlight-dominant';
    } else {
      layerName = 'midtone';
      reason = 'midtone-dominant';
    }
  }

  return {
    layerName,
    regionId,
    coverage: cov,
    subjectCoverage: normSubj,
    outlineCoverage: normOl,
    diagnostics: {
      tonalWeights: { background: normBg, shadows: normSh, midtones: normMd, highlights: normHl, outline: normOl },
      subjectWeight: normSubj,
      edgeWeight: normEdge,
      totalWeight,
      regionWeight: maxRegionWeight,
    },
    reason,
  };
}

/**
 * Convert raw Painter shape to polygon points for rasterization.
 * @param {object} raw - raw Painter shape
 * @returns {number[]} flat array [x0,y0, x1,y1, ...]
 */
function shapeToPolygon(raw) {
  const { t, p } = raw;
  if (!p || p.length < 2) return null;

  switch (t) {
    case 'E': { // Ellipse: [x, y, rx, ry, rot, ...]
      const [x, y, rx, ry, rot] = p;
      const pts = [];
      const steps = 16;
      for (let i = 0; i < steps; i++) {
        const a = (i / steps) * Math.PI * 2;
        const ca = Math.cos(a), sa = Math.sin(a);
        const cr = Math.cos(rot), sr = Math.sin(rot);
        pts.push(x + (ca * rx * cr - sa * ry * sr));
        pts.push(y + (ca * rx * sr + sa * ry * cr));
      }
      return pts;
    }
    case 'B': { // Blob: similar to ellipse but with feather
      const [x, y, rx, ry, rot] = p;
      const pts = [];
      const steps = 16;
      for (let i = 0; i < steps; i++) {
        const a = (i / steps) * Math.PI * 2;
        const ca = Math.cos(a), sa = Math.sin(a);
        const cr = Math.cos(rot), sr = Math.sin(rot);
        pts.push(x + (ca * rx * cr - sa * ry * sr));
        pts.push(y + (ca * rx * sr + sa * ry * cr));
      }
      return pts;
    }
    case 'R': { // Bar: [x, y, w, h, rot, ...]
      const [x, y, w, h, rot] = p;
      const hw = w / 2, hh = h / 2;
      const cr = Math.cos(rot), sr = Math.sin(rot);
      return [
        x + (-hw * cr - hh * sr), y + (-hw * sr + hh * cr),
        x + (hw * cr - hh * sr), y + (hw * sr + hh * cr),
        x + (hw * cr + hh * sr), y + (hw * sr - hh * cr),
        x + (-hw * cr + hh * sr), y + (-hw * sr - hh * cr),
      ];
    }
    case 'T': { // Triangle: [x1,y1, x2,y2, x3,y3, ...]
      return [p[0], p[1], p[2], p[3], p[4], p[5]];
    }
    case 'S': { // Stroke: [x0,y0, cx,cy, x1,y1, w, ...]
      // Approximate as a thick line polygon
      const [x0, y0, cx, cy, x1, y1, w] = p;
      const dx = x1 - x0, dy = y1 - y0;
      const len = Math.hypot(dx, dy);
      if (len < 1) return [x0, y0, x1, y1];
      const nx = -dy / len * (w / 2);
      const ny = dx / len * (w / 2);
      return [
        x0 - nx, y0 - ny,
        x0 + nx, y0 + ny,
        x1 + nx, y1 + ny,
        x1 - nx, y1 - ny,
      ];
    }
    default:
      return null;
  }
}

/**
 * Build the complete Painter-backed modular plan.
 * Instantiates Painter with source RGBA, runs to completion, converts shapes,
 * classifies footprints if layerBands:'painter', applies layer styles.
 *
 * @param {{pixels:ArrayLike<number>,width:number,height:number}} analysis
 * @param {object} args
 * @returns {Promise<{used:boolean,reason:string,shapes:object[],sim:number,layerBands:string|null,bandCounts:object|null,regions:object[],layerMaps:object}>}
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
    layerStyles,
    layerBands,
    tonalLo, tonalHi, tonalSoftness, backgroundThreshold,
  } = options;

  // Build Painter. When band labels are needed we run it with `layerMode:true`
  // so the Painter's OWN `_assignLayer` rule labels each shape as it is
  // emitted. That rule is deterministic, consumes no RNG and mutates no
  // geometry, so enabling it does NOT change the shape stream — it only adds
  // a `layer` tag to each raw shape.
  //
  //   layerBands:'painter'          -> use those legacy labels (PARITY with
  //                                   legacy painter.js multi-layer mode)
  //   layerBands:'painter-footprint' -> use our image-derived footprint
  //                                   classifier instead (experimental)
  const useLegacyLabels = layerBands === 'painter';
  const useFootprintLabels = layerBands === 'painter-footprint';
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
      layerMode: useLegacyLabels,
    },
  });

  await painter.start();
  const rawShapes = painter.getShapes();

  // Convert shapes ONCE, in paint order
  const shapes = rawShapes.map((raw, index) =>
    painterToEngineShape(raw, index, seed)
  );

  // Build layer maps from the completed painter (deterministic, no RNG consumption)
  const maps = buildPainterLayerMaps(painter, analysis, {
    tonalLo, tonalHi, tonalSoftness, backgroundThreshold,
  });

  let layerBandsOut = null;
  let bandCounts = null;

  // Classify footprints if layerBands === 'painter'
  if (useLegacyLabels || useFootprintLabels) {
    layerBandsOut = layerBands;
    bandCounts = {
      background: 0, shadows: 0, outline: 0, midtone: 0, highlights: 0,
    };

    for (let i = 0; i < shapes.length; i++) {
      const raw = rawShapes[i];
      if (useLegacyLabels) {
        // The Painter's own `_assignLayer` label — exactly what legacy
        // painter.js multi-layer mode produced, so this route is directly
        // comparable with the legacy route.
        const legacyName = raw.layer || 'midtone';
        shapes[i].layerName = legacyName;
        shapes[i].regionId = -1;
        shapes[i]._footprintDiagnostics = { reason: 'legacy-assign-layer' };
        bandCounts[legacyName] = (bandCounts[legacyName] || 0) + 1;
        continue;
      }
      const classification = classifyPainterFootprint(raw, maps, {
        tonalLo, tonalHi, tonalSoftness, backgroundThreshold,
      });
      shapes[i].layerName = classification.layerName;
      shapes[i].regionId = classification.regionId;
      shapes[i]._footprintDiagnostics = classification.diagnostics;
      bandCounts[classification.layerName] = (bandCounts[classification.layerName] || 0) + 1;
    }

    // Apply per-layer styles
    if (layerStyles) {
      applyLayerStyles(shapes, layerStyles);
    }
  }

  return {
    used: shapes.length > 0,
    reason: shapes.length ? 'ok' : 'empty',
    shapes,
    sim: painter.getSimilarity(),
    layerBands: layerBandsOut,
    bandCounts,
    regions: maps.regions,
    layerMaps: {
      tonal: maps.tonal,
      subject: maps.subject,
      edges: maps.edges,
      regions: maps.regions,
      regionIdMap: maps.regionIdMap,
    },
  };
}

export default {
  PAINTER_PLAN_DEFAULTS,
  painterToEngineShape,
  buildPainterLayerMaps,
  classifyPainterFootprint,
  buildPainterModularPlan,
};