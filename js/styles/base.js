/**
 * base.js — shared helpers for WWW_PAINT painting styles.
 *
 * Every style module imports from here. The helpers are a curated extraction of
 * the core maths from Code Painter's single-file engine (see RE_BREAKDOWN.md),
 * adapted into clean, documented, reusable ES6 module functions.
 *
 * Key algorithms:
 *   - rngFor: FNV-1a seeded PRNG (xorshift32) → reproducible randomness per shape
 *   - gaussR: Gaussian from 4 uniform samples (Box-Muller-light)
 *   - Color helpers: shade, shade2, mixHex, rgbaOf (hex string ↔ rgb manipulation)
 *   - Geometry: quadPts, normalAt, boxOf, inPoly, lerp, clamp01
 */

// ── Seeded random number generator ──────────────────────────────────────────
// FNV-1a hash over 6 values → xorshift32. A shape always stamps/paints the
// same way, which matters for re-bakes and high-res exports.
export function rngFor(a) {
  let h = 2166136261;
  for (let i = 0; i < 6; i++) {
    h ^= Math.round((a[i] || 0) * 10);
    h = Math.imul(h, 16777619);
  }
  let s = h >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

// Gaussian approximation from 4 uniform samples (sum mean 2, range 0..4, *1.732 → std ~1)
export const gaussR = (R) => (R() + R() + R() + R() - 2) * 1.732;

// A proper Box-Muller gaussian (used where quality matters more than speed)
export function gaussian(R) {
  let u = 0, v = 0;
  while (u === 0) u = R();
  while (v === 0) v = R();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.2832 * v);
}

// ── Math helpers ────────────────────────────────────────────────────────────
export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ── Color helpers (operate on '#rrggbb' hex strings) ────────────────────────
export function hexRgb(h) {
  const n = parseInt(h.slice(1, 7), 16);
  return [n >> 16 & 255, n >> 8 & 255, n & 255];
}

// Lighten (+) or darken (-) a hex color by factor k (-1..1)
export function shade(h, k) {
  const [r, g, b] = hexRgb(h);
  const f = v => Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k);
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

// Same as shade but returns a hex string (for chaining into mixHex etc.)
export function shade2(h, k) {
  const [r, g, b] = hexRgb(h);
  const f = v => Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k);
  return '#' + [f(r), f(g), f(b)].map(v => v.toString(16).padStart(2, '0')).join('');
}

// Linear blend between two hex colors (factor 0..1)
export function mixHex(a, b, f) {
  const A = hexRgb(a), B = hexRgb(b);
  const c = A.map((v, i) => Math.round(v + (B[i] - v) * f));
  return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
}

// rgba() string from hex (or rgb()) color and alpha
export function rgbaOf(c, a) {
  const [r, g, b] = c.startsWith('#') ? hexRgb(c) : c.match(/\d+/g).map(Number);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a))})`;
}

// Convert [r,g,b] array to '#rrggbb'
export function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}

// ── Geometry helpers ────────────────────────────────────────────────────────

// Points along a quadratic bezier (x0,y0)→(x1,y1)→(x2,y2), sampled at u (0..1), n points.
// dir<0 reverses the curve start/end.
export function quadPts(a, u = 1, dir = 1, n = 24) {
  let [x0, y0, x1, y1, x2, y2, /*w*/] = a;
  if (dir < 0) [x0, y0, x2, y2] = [x2, y2, x0, y0];
  const P = [];
  for (let i = 0; i <= n; i++) {
    const s = u * i / n;
    const v = 1 - s;
    P.push([
      v * v * x0 + 2 * v * s * x1 + s * s * x2,
      v * v * y0 + 2 * v * s * y1 + s * s * y2
    ]);
  }
  return P;
}

// Unit normal at point i of a polyline P (perpendicular to the local tangent)
export function normalAt(P, i) {
  const a = P[Math.max(0, i - 1)];
  const b = P[Math.min(P.length - 1, i + 1)];
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const d = Math.hypot(dx, dy) || 1;
  return [-dy / d, dx / d];
}

// Bounding box of a flat point array [x,y,x,y,...]
export function boxOf(P) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (let i = 0; i < P.length; i += 2) {
    if (P[i] < x0) x0 = P[i];
    if (P[i] > x1) x1 = P[i];
    if (P[i + 1] < y0) y0 = P[i + 1];
    if (P[i + 1] > y1) y1 = P[i + 1];
  }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}

// Point-in-polygon (ray casting) for a flat point array
export function inPoly(P, px, py) {
  let c = false;
  for (let i = 0, j = P.length - 2; i < P.length; j = i, i += 2) {
    const yi = P[i + 1], yj = P[j + 1];
    if ((yi > py) !== (yj > py) && px < (P[j] - P[i]) * (py - yi) / (yj - yi) + P[i]) c = !c;
  }
  return c;
}

// Polyline offset sideways by `off` (positive = left of travel direction)
export function offsetPts(P, off) {
  return P.map((p, i) => {
    const a = P[Math.max(0, i - 1)];
    const b = P[Math.min(P.length - 1, i + 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    return [p[0] - dy / l * off, p[1] + dx / l * off];
  });
}

// Tyler Hobbs' fractal edge growth: every edge gets a midpoint displaced
// sideways by a gaussian amount. Applied repeatedly → natural frayed outline.
export function hobbsGrow(pts, R, sigma) {
  const out = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % n];
    const dx = q[0] - p[0];
    const dy = q[1] - p[1];
    const len = Math.hypot(dx, dy) || 1;
    // push = gaussian * sigma * edgeLength * weightAtP (p[2] is the per-vertex weight)
    const d = gaussR(R) * sigma * len * p[2];
    out.push(p);
    out.push([
      (p[0] + q[0]) / 2 - dy / len * d,
      (p[1] + q[1]) / 2 + dx / len * d,
      Math.max(0.25, Math.min(2, p[2] * (1 + gaussR(R) * 0.12)))
    ]);
  }
  return out;
}

// ── Shape polygon (5 primitives: E, B, T, R, S) ─────────────────────────────
// Returns a flat [x,y,x,y,...] array of the shape's outline.

function corners(p) {
  const [x, y, w, h, r] = p;
  const c = Math.cos(r);
  const sn = Math.sin(r);
  const o = [];
  for (const [u, v] of [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]]) {
    o.push(x + u * c - v * sn, y + u * sn + v * c);
  }
  return o;
}

export function shapePoly(s) {
  s = normalizeShape(s);
  const p = s.p;
  const out = [];
  if (s.t === 'E' || s.t === 'B') {
    // Ellipse / Blob — same geometry, different gradient
    const [x, y, rx, ry, r] = p;
    const c = Math.cos(r);
    const n = Math.sin(r);
    const m = Math.max(12, Math.min(40, Math.round((rx + ry) * 0.7)));
    for (let i = 0; i < m; i++) {
      const a = i / m * Math.PI * 2;
      const u = Math.cos(a) * rx;
      const v = Math.sin(a) * ry;
      out.push(x + u * c - v * n, y + u * n + v * c);
    }
  } else if (s.t === 'T') {
    // Triangle — 3 vertices
    out.push(...p.slice(0, 6));
  } else if (s.t === 'R') {
    // Bar / rectangle
    out.push(...corners(p));
  } else if (s.t === 'S') {
    // Stroke — quadratic bezier ribbon with round caps
    const [x0, y0, x1, y1, x2, y2, w] = p;
    const hw = w / 2;
    const N = 10;
    const L = [];
    const R = [];
    const pt = t => {
      const u = 1 - t;
      return [u * u * x0 + 2 * u * t * x1 + t * t * x2, u * u * y0 + 2 * u * t * y1 + t * t * y2];
    };
    const tan = t => {
      const dx = 2 * (1 - t) * (x1 - x0) + 2 * t * (x2 - x1);
      const dy = 2 * (1 - t) * (y1 - y0) + 2 * t * (y2 - y1);
      const d = Math.hypot(dx, dy) || 1;
      return [dx / d, dy / d];
    };
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const [px, py] = pt(t);
      const [tx, ty] = tan(t);
      L.push([px - ty * hw, py + tx * hw]);
      R.push([px + ty * hw, py - tx * hw]);
    }
    // Round cap at the end (tip)
    const capEnd = (cx, cy, base) => {
      const pts = [];
      for (let i = 1; i < 6; i++) {
        const a = base - i / 6 * Math.PI;
        pts.push([cx + Math.cos(a) * hw, cy + Math.sin(a) * hw]);
      }
      return pts;
    };
    const [ex, ey] = pt(1);
    const [sx, sy] = pt(0);
    const [exd, eyd] = tan(1);
    const [sxd, syd] = tan(0);
    for (const q of L) out.push(...q);
    for (const q of capEnd(ex, ey, Math.atan2(exd, -eyd))) out.push(...q);
    for (let i = R.length - 1; i >= 0; i--) out.push(...R[i]);
    for (const q of capEnd(sx, sy, Math.atan2(-sxd, syd))) out.push(...q);
  }
  return out;
}

// Gradient axis of a shape: [dx, dy, from, to] projection extents
export function shapeAxis(s) {
  s = normalizeShape(s);
  const p = s.p;
  // For E/B/R, p[5] may be a gradient angle (Code Painter) or c0 (colour array, after _convertShape)
  const g = s.t === 'T' ? p[6] : s.t === 'S' ? p[7] : (typeof p[5] === 'number' ? p[5] : 0);
  const dx = Math.cos(g);
  const dy = Math.sin(g);
  if (s.t === 'E') {
    const d = p[0] * dx + p[1] * dy;
    const h = Math.hypot(p[2] * Math.cos(g - p[4]), p[3] * Math.sin(g - p[4]));
    return [dx, dy, d - h, d + h];
  }
  let pts;
  if (s.t === 'T') pts = p.slice(0, 6);
  else if (s.t === 'R') pts = corners(p);
  else if (s.t === 'S') pts = p.slice(0, 6);
  else pts = p.slice(0, 4);
  const pad = s.t === 'S' ? p[6] / 2 : 0;
  let m = 1e9, n = -1e9;
  for (let i = 0; i < pts.length; i += 2) {
    const d = pts[i] * dx + pts[i + 1] * dy;
    if (d < m) m = d;
    if (d > n) n = d;
  }
  return [dx, dy, m - pad, n + pad];
}

// Build a CanvasGradient along the shape's own axis
export function gradOf(ctx, shape, stops) {
  shape = normalizeShape(shape);
  let G;
  if (shape.t === 'B') {
    const [cx, cy, rx, ry] = shape.p;
    G = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(1, (rx + ry) / 2));
  } else {
    const [dx, dy, m, n] = shapeAxis(shape);
    G = ctx.createLinearGradient(dx * m, dy * m, dx * n, dy * n);
  }
  for (const [o, c] of stops) G.addColorStop(clamp01(o), c);
  return G;
}

// Draw the outline of a shape as the current path
export function outlinePath(ctx, q) {
  q = normalizeShape(q);
  const a = q.p;
  ctx.beginPath();
  if (q.t === 'E' || q.t === 'B') {
    ctx.ellipse(a[0], a[1], Math.max(0.1, a[2]), Math.max(0.1, a[3]), a[4], 0, 7);
    return;
  }
  const p = shapePoly(q);
  ctx.moveTo(p[0], p[1]);
  for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
  ctx.closePath();
}

// Build a Path2D with ragged/frayed edges (used by ink pools, paper tear, etc.)
export function raggedPath(q, R, amp, k = 1) {
  const P = shapePoly(q);
  const b = boxOf(P);
  const size = Math.max(b.w, b.h, 2);
  const step = Math.max(2, size / 28);
  const pts = [];
  const n = P.length / 2;
  for (let i = 0; i < n; i++) {
    const ax = P[i * 2];
    const ay = P[i * 2 + 1];
    const j = (i + 1) % n;
    const bx = P[j * 2];
    const by = P[j * 2 + 1];
    const m = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / step));
    for (let s = 0; s < m; s++) {
      pts.push([ax + (bx - ax) * s / m, ay + (by - ay) * s / m]);
    }
  }
  const ph = R() * 6.28;
  const f = 2 + Math.floor(R() * 3);
  const Q = pts.map(([px, py], i) => {
    const t = i / pts.length * 6.28;
    const w = 1 + amp * (Math.sin(f * t + ph) * 0.6 + (R() - 0.5) * 0.8);
    return [b.cx + (px - b.cx) * w * k, b.cy + (py - b.cy) * w * k];
  });
  const path = new Path2D();
  const N = Q.length;
  const mid = i => [(Q[i % N][0] + Q[(i + 1) % N][0]) / 2, (Q[i % N][1] + Q[(i + 1) % N][1]) / 2];
  const m0 = mid(N - 1);
  path.moveTo(m0[0], m0[1]);
  for (let i = 0; i < N; i++) {
    const m1 = mid(i);
    path.quadraticCurveTo(Q[i][0], Q[i][1], m1[0], m1[1]);
  }
  path.closePath();
  return path;
}


// Normalize a raw shape {type, params, ...} into the internal {t, p, ...} format.
// This lets helper functions accept either format from the renderer pipeline.
export function normalizeShape(s) {
  if (s.t !== undefined) return s; // Already normalized
  return {
    t: s.type,
    p: s.params,
    c0: s.color0,
    c1: s.color1,
    o: s.alpha,
    s: s.seed
  };
}
// ── Shape factory ───────────────────────────────────────────────────────────
// Builds a normalized shape object from params, matching the ARCHITECTURE.md format.
export function makeShape(type, params, color0, color1, alpha = 1, style = 'default', seed = null) {
  return {
    id: `stroke_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    params,
    color0: color0,
    color1: color1,
    alpha: clamp01(alpha),
    style,
    seed
  };
}

// Extract colors + opacity from a shape.
// Primary source: colours embedded at the tail of params (Code Painter style).
// Fallback: top-level color0/color1/alpha fields (engine-converted shape).
export function colsOf(shape) {
  const a = shape.params;
  // Color index depends on shape type — Code Painter stores c0/c1 at the tail of params
  // S (stroke): [x0,y0,x1,y1,x2,y2,w,g,c0,c1,o]  -> c0@8, c1@9
  // T (triangle): [x0,y0,x1,y1,x2,y2,g,c0,c1,o]  -> c0@7, c1@8
  // E/B (ellipse/blob): [cx,cy,rx,ry,rot,c0,c1,o] -> c0@5, c1@6
  // R (rect): [cx,cy,w,h,r,c0,c1,o]               -> c0@5, c1@6
  const i = shape.type === 'S' ? 8 : shape.type === 'T' ? 7 : 5;
  let c0 = a[i];
  let c1 = a[i + 1];
  let o = a[a.length - 1];
  // Fallback to top-level fields if params doesn't carry colours
  if (c0 === undefined) {
    c0 = shape.color0;
    c1 = shape.color1;
    o = shape.alpha;
  }
  return [
    Array.isArray(c0) ? rgbToHex(c0) : (typeof c0 === 'string' ? c0 : '#000000'),
    Array.isArray(c1) ? rgbToHex(c1) : (typeof c1 === 'string' ? c1 : '#000000'),
    typeof o === 'number' ? o : 1
  ];
}
