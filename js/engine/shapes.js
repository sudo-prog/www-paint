/**
 * Shape primitives (E/B/T/R/S) with runtime, drawing, and export functions.
 *
 * A **Shape** (also called a "stroke" throughout the codebase) is the atomic
 * unit of a painting.  There are five primitive types:
 *
 * | Type | Name  | Params (8 entries)                          |
 * |------|-------|-----------------------------------------------|
 * | `E`  | Ellipse | `[x, y, rx, ry, rot, gradAngle, cExtra, unused]` |
 * | `B`  | Blob  | `[x, y, rx, ry, rot, feather, cExtra, unused]`    |
 * | `T`  | Triangle | `[x1,y1, x2,y2, y3,y3, gradAngle, unused]`     |
 * | `R`  | Bar   | `[x, y, w, h, rot, gradAngle, cExtra, unused]`   |
 * | `S`  | Stroke | `[x0,y0, x1,y1, x2,y2, w, gradAngle]`          |
 *
 * The full shape object is:
 * ```js
 * {
 *   id: "stroke_001",        // unique identifier
 *   type: "S",               // one of E|B|T|R|S
 *   params: [x0,y0, x1,y1, x2,y2, w, gradAngle],
 *   color0: [r,g,b],         // start color
 *   color1: [r,g,b],         // end color (gradient end)
 *   alpha: 0.8,              // opacity 0..1
 *   style: "pencil",         // style name
 *   layer: 0,                // layer index
 *   order: 42,               // paint order
 *   seed: 12345              // reproducible randomness
 * }
 * ```
 *
 * @module shapes
 */

/// Shape type constants
export const SHAPE_TYPES = { ELLIPSE: 'E', BLOB: 'B', TRIANGLE: 'T', BAR: 'R', STROKE: 'S' };

/// All valid shape type letters
export const VALID_TYPES = new Set(['E', 'B', 'T', 'R', 'S']);

/**
 * Validate that an object looks like a Shape.
 * @param {*} s
 * @returns {boolean}
 */
export function isValidShape(s) {
  return !!s &&
    typeof s.id === 'string' &&
    VALID_TYPES.has(s.type) &&
    Array.isArray(s.params) &&
    s.params.length >= 2 &&
    Array.isArray(s.color0) && s.color0.length === 3 &&
    Array.isArray(s.color1) && s.color1.length === 3 &&
    typeof s.alpha === 'number';
}

/**
 * Compute the bounding box [x0, y0, x1, y1] of a shape.
 * @param {object} s Shape object.
 * @returns {[number, number, number, number]}
 */
export function bounds(s) {
  const p = s.params;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;

  switch (s.type) {
    case 'E':
    case 'B':
      // [x, y, rx, ry, rot, ...]
      const ex = p[0], ey = p[1], erx = p[2], ery = p[3];
      // rough AABB of rotated ellipse (conservative)
      const er = Math.max(erx, ery);
      x0 = ex - er; y0 = ey - er;
      x1 = ex + er; y1 = ey + er;
      break;
    case 'T':
      // [x1,y1, x2,y2, x3,y3, ...]
      x0 = Math.min(p[0], p[2], p[4]);
      y0 = Math.min(p[1], p[3], p[5]);
      x1 = Math.max(p[0], p[2], p[4]);
      y1 = Math.max(p[1], p[3], p[5]);
      break;
    case 'R':
      // [x, y, w, h, rot, ...]
      // AABB of rotated rect
      const rx = p[0], ry = p[1], rw = p[2], rh = p[3], ra = p[4] || 0;
      const cosA = Math.abs(Math.cos(ra));
      const sinA = Math.abs(Math.sin(ra));
      const hw = (rw * cosA + rh * sinA) / 2;
      const hh = (rw * sinA + rh * cosA) / 2;
      x0 = rx - hw; y0 = ry - hh;
      x1 = rx + hw; y1 = ry + hh;
      break;
    case 'S':
      // [x0,y0, x1,y1, x2,y2, w, ...]  — quadratic bezier control points
      x0 = Math.min(p[0], p[2], p[4]) - (p[6] || 0);
      y0 = Math.min(p[1], p[3], p[5]) - (p[6] || 0);
      x1 = Math.max(p[0], p[2], p[4]) + (p[6] || 0);
      y1 = Math.max(p[1], p[3], p[5]) + (p[6] || 0);
      break;
  }
  return [x0, y0, x1, y1];
}

/**
 * Get the centroid [cx, cy] of a shape.
 * @param {object} s Shape object.
 * @returns {[number, number]}
 */
export function centroid(s) {
  const p = s.params;
  switch (s.type) {
    case 'E':
    case 'B':
      return [p[0], p[1]];
    case 'T':
      return [(p[0] + p[2] + p[4]) / 3, (p[1] + p[3] + p[5]) / 3];
    case 'R':
      return [p[0], p[1]];
    case 'S':
      return [(p[0] + p[2] + p[4]) / 3, (p[1] + p[3] + p[5]) / 3];
    default:
      return [0, 0];
  }
}

/**
 * Compute the total length (perimeter / path length) of a shape's "stroke"
 * in canvas pixels.  Used for stroke-counting and progress distribution.
 * @param {object} s Shape object.
 * @returns {number}
 */
export function pathLength(s) {
  const p = s.params;
  switch (s.type) {
    case 'E':
    case 'B': {
      // Ellipse circumference (Ramanujan approximation)
      const a = p[2] || 0;
      const b = p[3] || 0;
      const h = Math.pow(a - b, 2) / Math.pow(a + b, 2);
      return Math.PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
    }
    case 'T':
      // perimeter of triangle
      const l1 = Math.hypot(p[2] - p[0], p[3] - p[1]);
      const l2 = Math.hypot(p[4] - p[2], p[5] - p[3]);
      const l3 = Math.hypot(p[0] - p[4], p[1] - p[5]);
      return l1 + l2 + l3;
    case 'R':
      return 2 * (Math.abs(p[2]) + Math.abs(p[3]));
    case 'S':
      // Sum of three segments of quadratic bezier approximated by chords
      const seg1 = Math.hypot(p[2] - p[0], p[3] - p[1]);
      const seg2 = Math.hypot(p[4] - p[2], p[5] - p[3]);
      return seg1 + seg2;
    default:
      return 0;
  }
}

/**
 * Compute the area covered by a shape.
 * @param {object} s Shape object.
 * @returns {number}
 */
export function area(s) {
  const p = s.params;
  switch (s.type) {
    case 'E':
    case 'B':
      return Math.PI * (p[2] || 0) * (p[3] || 0);
    case 'T':
      // Shoelace formula
      return Math.abs(
        (p[0] * (p[3] - p[5]) + p[2] * (p[5] - p[1]) + p[4] * (p[1] - p[3])) / 2
      );
    case 'R':
      return Math.abs(p[2] * p[3]);
    case 'S':
      // Approximate as a rectangle along the stroke width × length
      return pathLength(s) * Math.abs(p[6] || 1);
    default:
      return 0;
  }
}

/**
 * Sample a point on the shape's main path at a given parameter t in [0, 1].
 * Used for stamped-brush rendering and progressive reveal.
 *
 * @param {object} s Shape object.
 * @param {number} t - Position along the path, 0..1.
 * @returns {[number, number]} {x, y}
 */
export function pointAt(s, t) {
  const p = s.params;
  switch (s.type) {
    case 'E':
    case 'B': {
      const angle = (t * Math.PI * 2) + (p[4] || 0); // rot
      return [
        p[0] + (p[2] || 0) * Math.cos(angle),
        p[1] + (p[3] || 0) * Math.sin(angle),
      ];
    }
    case 'T':
    case 'R':
      // For triangle / bar, walk the perimeter
      const perim = pathLength(s);
      const target = t * perim;
      if (s.type === 'T') {
        const l1 = Math.hypot(p[2] - p[0], p[3] - p[1]);
        if (target < l1) {
          const f = target / l1;
          return [p[0] + f * (p[2] - p[0]), p[1] + f * (p[3] - p[1])];
        }
        const l2 = Math.hypot(p[4] - p[2], p[5] - p[3]);
        const rest = target - l1;
        if (rest < l2) {
          const f = rest / l2;
          return [p[2] + f * (p[4] - p[2]), p[3] + f * (p[5] - p[3])];
        }
        const l3 = Math.hypot(p[0] - p[4], p[1] - p[5]);
        const rest2 = rest - l2;
        const f = Math.min(1, rest2 / l3);
        return [p[4] + f * (p[0] - p[4]), p[5] + f * (p[1] - p[5])];
      } else {
        // Bar: walk around rectangle
        const w = Math.abs(p[2]);
        const h = Math.abs(p[3]);
        let pos = t * (2 * w + 2 * h);
        if (pos < w) return [p[0] - w / 2 + pos, p[1] - h / 2];
        pos -= w;
        if (pos < h) return [p[0] + w / 2, p[1] - h / 2 + pos];
        pos -= h;
        if (pos < w) return [p[0] + w / 2 - pos, p[1] + h / 2];
        pos -= w;
        return [p[0] - w / 2, p[1] + h / 2 - pos];
      }
    case 'S':
      // Quadratic bezier: P(t) = (1-t)^2*P0 + 2(1-t)t*P1 + t^2*P2
      const mt = 1 - t;
      return [
        mt * mt * p[0] + 2 * mt * t * p[2] + t * t * p[4],
        mt * mt * p[1] + 2 * mt * t * p[3] + t * t * p[5],
      ];
    default:
      return [0, 0];
  }
}

/**
 * Apply a gradient direction to a color, returning interpolated colors.
 *
 * @param {object} s Shape object.
 * @param {number} t - Interpolation parameter 0..1.
 * @returns {[number, number, number]} Interpolated RGB.
 */
export function gradientAt(s, t) {
  const c0 = s.color0 || [0, 0, 0];
  const c1 = s.color1 || c0;
  return [
    c0[0] + (c1[0] - c0[0]) * t,
    c0[1] + (c1[1] - c0[1]) * t,
    c0[2] + (c1[2] - c0[2]) * t,
  ];
}

/**
 * Create a new shape object with defaults applied.
 *
 * @param {object} options
 * @returns {object} Shape object.
 */
export function createShape(options = {}) {
  return {
    id: options.id || `stroke_${Math.random().toString(36).slice(2, 11)}`,
    type: options.type || 'S',
    params: options.params || [0, 0, 0, 0, 0, 0, 1, 0],
    color0: options.color0 || [0, 0, 0],
    color1: options.color1 || options.color0 || [0, 0, 0],
    alpha: options.alpha !== undefined ? options.alpha : 1,
    style: options.style || 'pencil',
    layer: options.layer !== undefined ? options.layer : 0,
    order: options.order !== undefined ? options.order : 0,
    seed: options.seed !== undefined ? options.seed : 0,
  };
}

/**
 * Deep-clone a shape object (and its arrays).
 * @param {object} s
 * @returns {object}
 */
export function cloneShape(s) {
  return {
    ...s,
    params: s.params.slice(),
    color0: s.color0.slice(),
    color1: s.color1.slice(),
  };
}

/**
 * Serialize a shape to a compact array form for binary packing.
 * Format: [type, ...params, c0r, c0g, c0b, c1r, c1g, c1b, alpha, styleIdx, layer, order, seed]
 *
 * @param {object} s Shape object.
 * @param {Array<string>} styleList - Registry of style names.
 * @returns {Array<number>}
 */
export function packShape(s, styleList) {
  const styleIdx = styleList.indexOf(s.style);
  return [
    s.type.charCodeAt(0),
    ...s.params,
    ...s.color0,
    ...s.color1,
    Math.round(s.alpha * 255),
    styleIdx,
    s.layer,
    s.order,
    s.seed,
  ];
}

/**
 * Deserialize a packed shape back to an object.
 *
 * @param {Array<number>} packed
 * @param {Array<string>} styleList
 * @returns {object}
 */
export function unpackShape(packed, styleList) {
  const [t, x0, y0, x1, y1, x2, y2, w, gradAngle, c0r, c0g, c0b, c1r, c1g, c1b, alpha, styleIdx, layer, order, seed] = packed;
  return {
    id: `unpacked_${seed || 0}`,
    type: String.fromCharCode(t),
    params: [x0, y0, x1, y1, x2, y2, w, gradAngle],
    color0: [c0r, c0g, c0b],
    color1: [c1r, c1g, c1b],
    alpha: alpha / 255,
    style: styleList[styleIdx] || 'pencil',
    layer,
    order,
    seed,
  };
}

/**
 * Draw a single shape on a canvas 2D context.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} s Shape object.
 * @param {number} [progress=1] - Reveal progress 0..1.
 */
export function drawShape(ctx, s, progress = 1) {
  const p = s.params;
  const a = Math.max(0, Math.min(1, progress)) * (s.alpha !== undefined ? s.alpha : 1);
  ctx.save();
  ctx.globalAlpha = a;

  // Build gradient from color0 → color1 along the shape's gradient direction.
  const gradAngle = p[7] !== undefined ? p[7] : 0;
  const [sx, sy] = pointAt(s, 0);
  const [ex, ey] = pointAt(s, 1);
  const cosA = Math.cos(gradAngle);
  const sinA = Math.sin(gradAngle);
  const halfLen = Math.hypot(ex - sx, ey - sy) * 0.5 + 1;
  const mx = (sx + ex) / 2;
  const my = (sy + ey) / 2;
  const gx0 = mx - cosA * halfLen;
  const gy0 = my - sinA * halfLen;
  const gx1 = mx + cosA * halfLen;
  const gy1 = my + sinA * halfLen;

  const grad = ctx.createLinearGradient(gx0, gy0, gx1, gy1);
  grad.addColorStop(0, `rgb(${Math.round(s.color0[0])},${Math.round(s.color0[1])},${Math.round(s.color0[2])})`);
  grad.addColorStop(1, `rgb(${Math.round(s.color1[0])},${Math.round(s.color1[1])},${Math.round(s.color1[2])})`);
  ctx.fillStyle = grad;
  ctx.strokeStyle = grad;

  switch (s.type) {
    case 'E':
      ctx.beginPath();
      ctx.ellipse(p[0], p[1], p[2], p[3], p[4] || 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'B': {
      // Soft blob: radial gradient with feather
      const feather = p[5] !== undefined ? p[5] : 0.5;
      const r = Math.max(p[2] || 1, p[3] || 1);
      const blobGrad = ctx.createRadialGradient(
        p[0], p[1], r * (1 - feather),
        p[0], p[1], r
      );
      blobGrad.addColorStop(0, `rgb(${Math.round(s.color0[0])},${Math.round(s.color0[1])},${Math.round(s.color0[2])})`);
      blobGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.save();
      ctx.fillStyle = blobGrad;
      ctx.beginPath();
      ctx.ellipse(p[0], p[1], p[2], p[3], p[4] || 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      break;
    }
    case 'T':
      ctx.beginPath();
      ctx.moveTo(p[0], p[1]);
      ctx.lineTo(p[2], p[3]);
      ctx.lineTo(p[4], p[5]);
      ctx.closePath();
      ctx.fill();
      break;
    case 'R': {
      ctx.save();
      ctx.translate(p[0], p[1]);
      ctx.rotate(p[4] || 0);
      ctx.fillRect(-p[2] / 2, -p[3] / 2, p[2], p[3]);
      ctx.restore();
      break;
    }
    case 'S': {
      // Quadratic bezier stroke
      const w = p[6] || 1;
      ctx.lineWidth = w;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(p[0], p[1]);
      ctx.quadraticCurveTo(p[2], p[3], p[4], p[5]);
      ctx.stroke();
      break;
    }
  }
  ctx.restore();
}

/**
 * Export a shape to an SVG fragment string.
 *
 * @param {object} s Shape object.
 * @returns {string} SVG element string.
 */
export function shapeToSVG(s) {
  const p = s.params;
  const c0 = `rgb(${Math.round(s.color0[0])},${Math.round(s.color0[1])},${Math.round(s.color0[2])})`;
  const c1 = `rgb(${Math.round(s.color1[0])},${Math.round(s.color1[1])},${Math.round(s.color1[2])})`;
  const gid = `grad_${s.id}`;
  const gradAngle = p[7] !== undefined ? p[7] : 0;

  let gradDef = '';
  if (c0 !== c1) {
    const cosA = Math.cos(gradAngle);
    const sinA = Math.sin(gradAngle);
    const [sx, sy] = pointAt(s, 0);
    const [ex, ey] = pointAt(s, 1);
    const mx = (sx + ex) / 2;
    const my = (sy + ey) / 2;
    const len = Math.hypot(ex - sx, ey - sy) + 1;
    gradDef = `<linearGradient id="${gid}" x1="${mx - cosA * len / 2}" y1="${my - sinA * len / 2}" x2="${mx + cosA * len / 2}" y2="${my + sinA * len / 2}"><stop offset="0%" stop-color="${c0}"/><stop offset="100%" stop-color="${c1}"/></linearGradient>`;
  }

  let shapeEl = '';
  switch (s.type) {
    case 'E':
      shapeEl = `<ellipse cx="${p[0]}" cy="${p[1]}" rx="${p[2]}" ry="${p[3]}" transform="rotate(${(p[4] || 0) * 180 / Math.PI} ${p[0]} ${p[1]})" fill="${c0 === c1 ? c0 : `url(#${gid})`}"/>`;
      break;
    case 'T':
      shapeEl = `<polygon points="${p[0]},${p[1]} ${p[2]},${p[3]} ${p[4]},${p[5]}" fill="${c0 === c1 ? c0 : `url(#${gid})`}"/>`;
      break;
    case 'R':
      shapeEl = `<rect x="${p[0] - p[2] / 2}" y="${p[1] - p[3] / 2}" width="${p[2]}" height="${p[3]}" transform="rotate(${(p[4] || 0) * 180 / Math.PI} ${p[0]} ${p[1]})" fill="${c0 === c1 ? c0 : `url(#${gid})`}"/>`;
      break;
    case 'S':
      shapeEl = `<path d="M${p[0]},${p[1]} Q${p[2]},${p[3]} ${p[4]},${p[5]}" stroke="${c0 === c1 ? c0 : `url(#${gid})`}" stroke-width="${p[6]}" stroke-linecap="round" fill="none"/>`;
      break;
    case 'B':
      shapeEl = `<ellipse cx="${p[0]}" cy="${p[1]}" rx="${p[2]}" ry="${p[3]}" fill="${c0 === c1 ? c0 : `url(#${gid})`}"/>`;
      break;
  }

  return gradDef + shapeEl;
}

/**
 * Generate the tiny runtime code embedded in self-contained HTML exports.
 * This is a ~1.5 KB minified function that can decode and draw shapes.
 *
 * @returns {string} JS source string for the runtime.
 */
export function getRuntimeSource() {
  return `var RUNTIME={};RUNTIME.draw=function(c,q){var x=c.createContext(),p=q.p,x0=p[0],y0=p[1],x1=p[2],y1=p[3],x2=p[4],y2=p[5],w=p[6]||1,gA=p[7]||0;var g=c.createLinearGradient(x0,y0,x1,y1),c0='rgb('+Math.round(q.c0[0])+','+Math.round(q.c0[1])+','+Math.round(q.c0[2])+')',c1='rgb('+Math.round(q.c1[0])+','+Math.round(q.c1[1])+','+Math.round(q.c1[2])+')';g.addColorStop(0,c0);g.addColorStop(1,c1);x.fillStyle=g;x.strokeStyle=g;x.globalAlpha=q.a||1;switch(q.t){case'E':x.beginPath();x.ellipse(x0,y0,p[2],p[3],p[4]||0,0,6.28318);x.fill();break;case'T':x.beginPath();x.moveTo(x0,y0);x.lineTo(x1,y1);x.lineTo(x2,y2);x.closePath();x.fill();break;case'R':x.save();x.translate(x0,y0);x.rotate(p[4]||0);x.fillRect(-p[2]/2,-p[3]/2,p[2],p[3]);x.restore();break;case'S':x.lineWidth=w;x.lineCap='round';x.beginPath();x.moveTo(x0,y0);x.quadraticCurveTo(x1,y1,x2,y2);x.stroke();break;case'B':var f=p[5]||0.5;x.save();var r=Math.max(p[2],p[3]),rg=x.createRadialGradient(x0,y0,r*(1-f),x0,y0,r);rg.addColorStop(0,c0);rg.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=rg;x.beginPath();x.ellipse(x0,y0,p[2],p[3],p[4]||0,0,6.28318);x.fill();x.restore();break;}};`;
}

/**
 * Export a shape to a code string (readable JS for HTML export).
 *
 * @param {object} s Shape object.
 * @param {number} indent
 * @returns {string}
 */
export function shapeToCode(s, indent = 0) {
  const pad = '  '.repeat(indent);
  const pad2 = '  '.repeat(indent + 1);
  return `${pad}{t:"${s.type}",p:[${s.params.join(',')}],c0:[${s.color0.join(',')}],c1:[${s.color1.join(',')}],a:${s.alpha},s:"${s.style}"}`;
}

// Export a default shapes module object for convenience
export default {
  SHAPE_TYPES,
  VALID_TYPES,
  isValidShape,
  bounds,
  centroid,
  pathLength,
  area,
  pointAt,
  gradientAt,
  createShape,
  cloneShape,
  packShape,
  unpackShape,
  drawShape,
  shapeToSVG,
  shapeToCode,
  getRuntimeSource,
};
