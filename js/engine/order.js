/**
 * Paint-order modes — Round 2 / M8, frozen interface **IF-4**.
 *
 * A data-driven paint-ordering table over a shape list, so the optimiser can
 * lay strokes in an explicit sequence (Track R4, "path/order modes"). Each mode
 * is a stable sort by its own key; `free` leaves the input order untouched.
 *
 * Clean-room derivation of the classical **stroke ordering** step of
 * stroke-based rendering: paint in a deliberate sequence (large-to-small,
 * dark-to-light, centre-out, contour-first) so the picture builds in the same
 * order a painter would work. No identifier, table or control flow is taken
 * from any implementation.
 *
 * Pure data + sorting — no canvas, no DOM, no randomness — so it is
 * unit-testable under plain `node` and safe to call from a worker.
 *
 * @module order
 */

/** The eleven frozen order modes, in UI order. */
export const ORDER_MODES = [
  'free', 'down', 'up', 'left', 'right', 'diag',
  'spiral', 'spiralin', 'rings', 'ringsin', 'clock',
];

/** Default options for {@link orderShapes}. */
export const ORDER_DEFAULTS = {
  mode: 'free',
  // Ordering centre. When neither cx/cy nor an analysis-like object is given,
  // the centre is derived from the shapes' own bounding box (see
  // `resolveCentre`) — so the radial modes work on a bare shape list.
};

/**
 * Derive the ordering centre from the shapes' bounding box.
 *
 * The radial and clock modes are meaningless about (0, 0): a shape list lives
 * in image coordinates, so the natural centre is the middle of the shapes
 * themselves.
 *
 * @returns {{cx: number, cy: number}}
 */
function centreFromBounds(shapes) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of shapes) {
    const x = s.params[0];
    const y = s.params[1];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  if (minX > maxX) return { cx: 0, cy: 0 };
  return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
}

/** Euclidean distance from the ordering centre. */
function radius(x, y, cx, cy) {
  return Math.hypot(x - cx, y - cy);
}

/**
 * Clock angle: 0 at 12 o'clock, increasing clockwise.
 *
 * `atan2(dx, -dy)` returns the angle measured **counter**-clockwise from north
 * (NE → +0.785, NW → −0.785 → normalised 5.498), which is the opposite of a
 * clock face. Negating it puts north at 0, east at +0.785, south at π and west
 * at 3π/2 — the clockwise sweep.
 *
 * @returns {number} Angle in radians, 0..2π.
 */
function clockAngle(x, y, cx, cy) {
  const a = Math.atan2(-(x - cx), -(y - cy));
  return a < 0 ? a + Math.PI * 2 : a;
}

/**
 * Sort key for each mode.
 *
 * Every key is a single number so the sort is a plain numeric comparison.
 * Directional modes use the shape centre; the radial modes use polar
 * coordinates about `(cx, cy)`.
 *
 * @param {string} mode
 * @param {object} s - Shape whose centre is `params[0], params[1]`.
 * @param {number} cx
 * @param {number} cy
 * @returns {number}
 */
function keyFor(mode, s, cx, cy) {
  const x = s.params[0];
  const y = s.params[1];

  switch (mode) {
    case 'down':     return y;
    case 'up':       return -y;
    case 'left':     return x;
    case 'right':    return -x;
    case 'diag':     return (x + y) / 2;   // NW (small) → SE (large)
    case 'spiral':   return radius(x, y, cx, cy);  // centre outward
    case 'spiralin': return -radius(x, y, cx, cy); // outside inward
    case 'rings':    return radius(x, y, cx, cy);
    case 'ringsin':  return -radius(x, y, cx, cy);
    case 'clock':    return clockAngle(x, y, cx, cy);
    default:         return 0;              // free / unknown: no key
  }
}

/**
 * Order a shape list by a paint-order mode.
 *
 * Returns a **new array** containing the **same shape objects** (never copies),
 * sorted by the mode's key. Each returned shape has `order` set to its index.
 *
 * @param {Array<object>} shapes - Shapes to order.
 * @param {string} mode - One of {@link ORDER_MODES}; unknown → `free`.
 * @param {object} [opts] - `{ cx, cy }` ordering centre. Also accepts an
 *   `analysis`-like object (`{ width, height }`), whose centre is used. With
 *   neither, the centre is derived from the shapes' bounding box.
 * @returns {Array<object>} A new array of the same shapes.
 */
export function orderShapes(shapes, mode, opts = {}) {
  const list = Array.isArray(shapes) ? shapes : [];
  const m = ORDER_MODES.includes(mode) ? mode : ORDER_DEFAULTS.mode;

  // NEW array of the SAME objects — the caller's array is never mutated.
  const out = list.slice();

  if (m === 'free') {
    out.forEach((s, i) => { s.order = i; });
    return out;
  }

  // Resolve the ordering centre.
  let cx;
  let cy;
  if (opts.cx !== undefined && opts.cy !== undefined) {
    cx = opts.cx;
    cy = opts.cy;
  } else if (opts.width !== undefined && opts.height !== undefined) {
    cx = opts.width / 2;
    cy = opts.height / 2;
  } else {
    ({ cx, cy } = centreFromBounds(list));
  }

  const key = (s) => keyFor(m, s, cx, cy);

  // Stable numeric sort. Array.prototype.sort is stable in V8/Node, so equal
  // keys keep their input relative order — the tie-break is deterministic.
  out.sort((a, b) => key(a) - key(b));

  out.forEach((s, i) => { s.order = i; });
  return out;
}

export default { orderShapes, ORDER_MODES, ORDER_DEFAULTS };
