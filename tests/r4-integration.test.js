/**
 * Track R4 — BE spine integration: the optimiser consumes the R4 order plan.
 *
 * Run with: node tests/r4-integration.test.js
 *
 * The R4 adapter (`js/engine/r4.js`) produces a plan; this suite pins the ONE
 * bit of the spine that consumes it — the opt-in `optimise({ r4 })` order hook:
 *   - `r4` defaults to null → output is byte-identical to the pre-R4 optimiser
 *   - a native order mode permutes the returned shapes' PAINT ORDER only:
 *     same shape SET, and no shape's own field is mutated
 *   - `free` is a fixed point (no reorder); an unknown mode is a safe no-op
 *   - the `buildR4Plan()`-shaped argument (`{ order: { mode } }`) is accepted
 *   - determinism: two identical calls give byte-identical shapes
 */

import { optimise, OPTIMISER_DEFAULTS, resolveOptions } from '../js/engine/optimizer.js';
import { analyzeImage } from '../js/engine/analyzer.js';
import { planOrder } from '../js/engine/r4.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  \u2713 ${name}`);
  } catch (e) {
    failed++;
    console.log(`  \u2717 ${name}\n      ${e.message}`);
  }
}
function assert(cond, msg = 'assertion failed') {
  if (!cond) throw new Error(msg);
}
function assertEqual(actual, expected, msg = '') {
  if (actual !== expected) {
    throw new Error(`${msg} expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}
function assertDeep(a, b, msg = '') {
  const ja = JSON.stringify(a);
  const jb = JSON.stringify(b);
  if (ja !== jb) throw new Error(`${msg}\n      a=${ja.slice(0, 160)}\n      b=${jb.slice(0, 160)}`);
}

/** A 64x64 vertical gradient — many rows, so a `down` order is a real permutation. */
function analysis(w = 64, h = 64) {
  const px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      const v = Math.round((y / (h - 1)) * 255);
      px[o] = v;
      px[o + 1] = 255 - v;
      px[o + 2] = Math.round((x / (w - 1)) * 255);
      px[o + 3] = 255;
    }
  }
  return analyzeImage(px, w, h);
}
const OPTS = { count: 60, seed: 7 };

console.log('\nR4 optimiser integration:');

test('resolveOptions defaults r4 to null', () => {
  assertEqual(resolveOptions().r4, null, 'default r4:');
  assertEqual(OPTIMISER_DEFAULTS.r4, null, 'OPTIMISER_DEFAULTS.r4:');
});

test('off by default: shapes are emission-ordered and stats has no paintOrder', () => {
  const { shapes, stats } = optimise(analysis(), OPTS);
  assert(shapes.length > 0, 'no shapes emitted');
  assertEqual('paintOrder' in stats, false, 'stats.paintOrder present when off:');
  for (let i = 0; i < shapes.length; i++) assertEqual(shapes[i].order, i, `shape ${i}.order:`);
});

test('determinism: two off runs are byte-identical', () => {
  const a = optimise(analysis(), OPTS).shapes;
  const b = optimise(analysis(), OPTS).shapes;
  assertDeep(a, b, 'two identical off runs differ');
});

test('r4:"down" permutes paint order, preserving the shape set', () => {
  const off = optimise(analysis(), OPTS).shapes;
  const planned = planOrder(off, 'down', { width: 64, height: 64 });
  assert(planned.changed === true, 'fixture does not exercise a reorder (down == emission order)');
  const { shapes: on, stats } = optimise(analysis(), { ...OPTS, r4: 'down' });
  assertEqual(on.length, off.length, 'count:');
  assertEqual(stats.paintOrder, 'down', 'stats.paintOrder:');
  // The returned array is EXACTLY the planned permutation of the off output.
  assertDeep(on, planned.order.map((i) => off[i]), 'permutation mismatch');
  // Same multiset of shapes (a reorder, not a change of shapes) — every field intact.
  const key = (s) => JSON.stringify(s);
  assertDeep([...on].map(key).sort(), [...off].map(key).sort(), 'shape set (or a field) changed');
});

test('r4:"free" is a fixed point — byte-identical shapes', () => {
  const off = optimise(analysis(), OPTS).shapes;
  const { shapes: free } = optimise(analysis(), { ...OPTS, r4: 'free' });
  assertDeep(free, off, 'free changed the output');
});

test('an unknown order mode is a safe no-op', () => {
  const off = optimise(analysis(), OPTS).shapes;
  const { shapes: on } = optimise(analysis(), { ...OPTS, r4: 'wobble-xyz' });
  assertDeep(on, off, 'an unknown mode changed the output');
});

test('accepts the buildR4Plan()-shaped argument ({ order: { mode } })', () => {
  const off = optimise(analysis(), OPTS).shapes;
  const planned = planOrder(off, 'down', { width: 64, height: 64 });
  const { shapes: on, stats } = optimise(analysis(), { ...OPTS, r4: { order: { mode: 'down', native: true } } });
  assertDeep(on, planned.order.map((i) => off[i]), 'plan-object form mismatch');
  assertEqual(stats.paintOrder, 'down', 'stats.paintOrder:');
});

console.log(`\n=== R4 optimiser integration: Passed ${passed}  Failed ${failed} ===`);
if (failed > 0) process.exit(1);
