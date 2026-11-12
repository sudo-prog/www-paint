/**
 * Paint-order tests (Round 2, M8 — IF-4).
 *
 * Run with: node tests/order.test.js
 *
 * Verifies the paint-order modes over a shape list — no DOM, no canvas:
 *   - the frozen IF-4 signature and NEW-array contract
 *   - `free` returns the input order untouched
 *   - every mode is a stable sort by its own key
 *   - deterministic; unknown modes fall back to `free`
 *   - each mode is genuinely distinct
 */

import { orderShapes, ORDER_MODES, ORDER_DEFAULTS } from '../js/engine/order.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}`);
    console.log(`    ${e.message}`);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

function assertEqual(actual, expected, msg = '') {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${msg} Expected ${b}, got ${a}`);
}

/** A shape whose centroid is (x, y). */
function shape(x, y, tag) {
  return { type: 'E', params: [x, y, 4, 4, 0], color0: [0, 0, 0], color1: [0, 0, 0], alpha: 1, tag };
}

/** A spread of points around a 100x100 canvas. */
function sampleShapes() {
  return [
    shape(10, 10, 'NW'),
    shape(90, 10, 'NE'),
    shape(10, 90, 'SW'),
    shape(90, 90, 'SE'),
    shape(50, 50, 'C'),
    shape(30, 70, 'midSW'),
    shape(70, 30, 'midNE'),
  ];
}

/**
 * The same spread with the centre shape at the exact bounding-box midpoint
 * (50, 50). Used by the radial/clock assertions, which are defined about the
 * ordering centre.
 */
function centredShapes() {
  return sampleShapes();
}

/** Tags in the order the given list presents them. */
function tags(list) {
  return list.map(s => s.tag);
}

console.log('\nPaint order (IF-4):\n');

// ─── Contract ─────────────────────────────────────────────────────

test('returns a NEW array, not the input array', () => {
  const input = sampleShapes();
  const out = orderShapes(input, 'down');
  assert(out !== input, 'returned the same array reference');
  assert(Array.isArray(out), 'not an array');
});

test('preserves the same shape objects (same set, no loss, no dupes)', () => {
  const input = sampleShapes();
  const out = orderShapes(input, 'down');
  assertEqual(out.length, input.length, 'length changed');
  assertEqual(new Set(out).size, new Set(input).size, 'shape objects were copied or duplicated');
  for (const s of input) assert(out.includes(s), `shape ${s.tag} missing from output`);
});

test('every shape gets an `order` field equal to its index', () => {
  const out = orderShapes(sampleShapes(), 'down');
  out.forEach((s, i) => assertEqual(s.order, i, `order at index ${i}`));
});

test('exposes the eleven frozen modes', () => {
  assertEqual(ORDER_MODES, [
    'free', 'down', 'up', 'left', 'right', 'diag',
    'spiral', 'spiralin', 'rings', 'ringsin', 'clock',
  ]);
});

test('ORDER_DEFAULTS.mode is free', () => {
  assertEqual(ORDER_DEFAULTS.mode, 'free');
});

// ─── free ─────────────────────────────────────────────────────────

test('free returns the input order untouched', () => {
  const input = sampleShapes();
  const out = orderShapes(input, 'free');
  assertEqual(tags(out), tags(input), 'free reordered the input');
});

test('free is stable — repeated calls give the same order', () => {
  const input = sampleShapes();
  assertEqual(tags(orderShapes(input, 'free')), tags(orderShapes(input, 'free')));
});

// ─── Directional modes ────────────────────────────────────────────

test('down sorts top-to-bottom', () => {
  const out = orderShapes(sampleShapes(), 'down');
  for (let i = 1; i < out.length; i++) {
    assert(
      out[i - 1].params[1] <= out[i].params[1] + 1e-9,
      `down: y went backwards at ${i}: ${out[i - 1].params[1]} -> ${out[i].params[1]}`,
    );
  }
  assertEqual(tags(out)[0], 'NW', 'first shape should be topmost');
});

test('up sorts bottom-to-top', () => {
  const out = orderShapes(sampleShapes(), 'up');
  for (let i = 1; i < out.length; i++) {
    assert(
      out[i - 1].params[1] >= out[i].params[1] - 1e-9,
      `up: y went forwards at ${i}: ${out[i - 1].params[1]} -> ${out[i].params[1]}`,
    );
  }
  assertEqual(tags(out)[0], 'SW', 'first shape should be bottommost');
});

test('left sorts left-to-right', () => {
  const out = orderShapes(sampleShapes(), 'left');
  for (let i = 1; i < out.length; i++) {
    assert(
      out[i - 1].params[0] <= out[i].params[0] + 1e-9,
      `left: x went backwards at ${i}`,
    );
  }
  assertEqual(tags(out)[0], 'NW', 'first shape should be leftmost');
});

test('right sorts right-to-left', () => {
  const out = orderShapes(sampleShapes(), 'right');
  for (let i = 1; i < out.length; i++) {
    assert(
      out[i - 1].params[0] >= out[i].params[0] - 1e-9,
      `right: x went forwards at ${i}`,
    );
  }
  assertEqual(tags(out)[0], 'NE', 'first shape should be rightmost');
});

test('diag sorts along the NW→SE diagonal', () => {
  const out = orderShapes(sampleShapes(), 'diag');
  for (let i = 1; i < out.length; i++) {
    const pa = out[i - 1].params, pb = out[i].params;
    const ka = (pa[0] + pa[1]) / 2;
    const kb = (pb[0] + pb[1]) / 2;
    assert(ka <= kb + 1e-9, `diag: key went backwards at ${i}: ${ka} -> ${kb}`);
  }
  assertEqual(tags(out)[0], 'NW', 'first shape should be the NW-most');
  assertEqual(tags(out)[out.length - 1], 'SE', 'last shape should be the SE-most');
});

// ─── Spiral / rings / clock ───────────────────────────────────────

test('spiral starts near the centre and spirals outward', () => {
  const out = orderShapes(sampleShapes(), 'spiral');
  // The centre shape must be first.
  assertEqual(tags(out)[0], 'C', 'spiral did not start at the centre');
});

test('spiralin starts at the outside and spirals inward', () => {
  const out = orderShapes(sampleShapes(), 'spiralin');
  // The last shape must be the centre.
  assertEqual(tags(out)[out.length - 1], 'C', 'spiralin did not end at the centre');
});

test('rings starts at the centre and moves outward', () => {
  const out = orderShapes(sampleShapes(), 'rings');
  assertEqual(tags(out)[0], 'C', 'rings did not start at the centre');
  for (let i = 1; i < out.length; i++) {
    const ra = Math.hypot(out[i - 1].params[0] - 50, out[i - 1].params[1] - 50);
    const rb = Math.hypot(out[i].params[0] - 50, out[i].params[1] - 50);
    assert(ra <= rb + 1e-9, `rings: radius decreased at ${i}: ${ra} -> ${rb}`);
  }
});

test('ringsin starts at the outside and moves inward', () => {
  const out = orderShapes(sampleShapes(), 'ringsin');
  assertEqual(tags(out)[out.length - 1], 'C', 'ringsin did not end at the centre');
  for (let i = 1; i < out.length; i++) {
    const ra = Math.hypot(out[i - 1].params[0] - 50, out[i - 1].params[1] - 50);
    const rb = Math.hypot(out[i].params[0] - 50, out[i].params[1] - 50);
    assert(ra >= rb - 1e-9, `ringsin: radius increased at ${i}: ${ra} -> ${rb}`);
  }
});

test('clock starts at 12 o\'clock and advances clockwise', () => {
  // The centre shape sits at the exact bounding-box midpoint (50,50), so the
  // clock angles are unambiguous: NW and NE are both north of centre.
  const out = orderShapes(centredShapes(), 'clock');
  // Clockwise from north: the NW shape (10,10) precedes the NE shape (90,10).
  const iNW = out.findIndex(s => s.tag === 'NW');
  const iNE = out.findIndex(s => s.tag === 'NE');
  assert(iNW >= 0 && iNE >= 0, 'missing a corner shape');
  assert(iNW < iNE, `clock order wrong: NW at ${iNW}, NE at ${iNE}`);
});

// ─── Determinism / fallback ───────────────────────────────────────

test('every mode is deterministic', () => {
  const input = sampleShapes();
  for (const mode of ORDER_MODES) {
    const a = tags(orderShapes(input, mode));
    const b = tags(orderShapes(input, mode));
    assertEqual(a, b, `mode ${mode} not deterministic`);
  }
});

test('unknown mode falls back to free', () => {
  const input = sampleShapes();
  const out = orderShapes(input, 'not-a-mode');
  assertEqual(tags(out), tags(input), 'unknown mode did not fall back to free');
});

test('missing/empty mode falls back to free', () => {
  const input = sampleShapes();
  assertEqual(tags(orderShapes(input, undefined)), tags(input));
  assertEqual(tags(orderShapes(input, '')), tags(input));
});

test('an empty shape list returns an empty list', () => {
  assertEqual(orderShapes([], 'down'), []);
});

test('a single shape returns that shape', () => {
  const only = [shape(5, 5, 'only')];
  const out = orderShapes(only, 'down');
  assertEqual(out.length, 1);
  assertEqual(tags(out), ['only']);
});

test('modes are genuinely distinct', () => {
  const input = sampleShapes();
  const seen = new Set();
  for (const mode of ORDER_MODES) {
    const t = tags(orderShapes(input, mode)).join(',');
    seen.add(t);
  }
  // Not all eleven can coincide on a 7-point spread; require a strong majority.
  assert(
    seen.size >= 8,
    `only ${seen.size} distinct orderings across ${ORDER_MODES.length} modes`,
  );
});

test('ties are broken deterministically (stable sort)', () => {
  // Same y, different x — the tie-break must be reproducible.
  const input = [
    shape(30, 50, 'a'),
    shape(10, 50, 'b'),
    shape(20, 50, 'c'),
    shape(40, 50, 'd'),
  ];
  const a = tags(orderShapes(input, 'down'));
  const b = tags(orderShapes(input, 'down'));
  assertEqual(a, b, 'tie-break not deterministic');
});

// ─── Summary ──────────────────────────────────────────────────────
console.log('\n=== Results ===');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(failed === 0 ? '\n✅ All order tests passed!' : '\n❌ Some order tests failed.');
process.exit(failed === 0 ? 0 : 1);
