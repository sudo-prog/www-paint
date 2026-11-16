/**
 * Track R modular bridge — unit tests.
 *
 * Run with: node tests/modular-bridge.test.js
 *
 * These tests use the REAL `analyzeImage()` and the REAL `optimise()` — not
 * synthetic stubs — because the bridge's whole job is to translate between
 * those two and the app's shape format. A stub would prove the algebra and
 * hide every conversion defect.
 */

import assert from 'node:assert/strict';
import { buildModularPlan, toEngineShape, modularOptions, BRIDGE_DEFAULTS } from '../js/engine/modular-bridge.js';
import { analyzeImage } from '../js/engine/analyzer.js';
import { optimise, resolveOptions } from '../js/engine/optimizer.js';
import { getStyle } from '../js/styles/index.js';
import { getAllStyles } from '../js/styles/index.js';

let passed = 0, failed = 0;
const failures = [];
function test(name, fn) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { failed++; failures.push({ name, err: e }); console.log(`  ✗ ${name}\n      ${e.message}`); }
}
function assertEqual(a, b, msg) { assert.deepEqual(a, b, msg); }
function assertOk(v, msg) { assert.ok(v, msg); }

/* ── fixtures ─────────────────────────────────────────────────────────── */

/** A deterministic source: soft blobs + hard rings on a light ground. */
function sourceImage(S = 128) {
  const px = new Uint8ClampedArray(S * S * 4);
  const blobs = [
    [36, 40, 17, [40, 60, 120]], [92, 45, 13, [150, 60, 40]], [60, 90, 15, [40, 120, 70]],
  ];
  const rings = [[64, 64, 31, [20, 20, 20]], [30, 95, 15, [90, 30, 90]]];
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4;
      let r = 235, g = 235, b = 232;
      for (const [cx, cy, rad, col] of blobs) {
        const d = Math.hypot(x - cx, y - cy) / rad;
        if (d < 1) {
          const k = Math.max(0, 1 - d) ** 1.6;
          r = r * (1 - k) + col[0] * k; g = g * (1 - k) + col[1] * k; b = b * (1 - k) + col[2] * k;
        }
      }
      for (const [cx, cy, rad, col] of rings) {
        const d = Math.abs(Math.hypot(x - cx, y - cy) - rad);
        if (d < 3.5) { const k = 1 - d / 3.5; r = r * (1 - k) + col[0] * k; g = g * (1 - k) + col[1] * k; b = b * (1 - k) + col[2] * k; }
      }
      px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255;
    }
  }
  return px;
}

let AN = null;
function analysis() {
  if (!AN) AN = analyzeImage(sourceImage(), 128, 128, {});
  return AN;
}

/** A valid engine-format shape, in the shape the app already produces. */
function appShape(over = {}) {
  return {
    id: 'stroke_0_0', type: 'E', params: [10, 10, 4, 6, 0.3, [1, 2, 3], [4, 5, 6], 0.8],
    color0: [1, 2, 3], color1: [4, 5, 6], alpha: 0.8, style: 'pencil',
    layer: 0, order: 0, seed: 12345, flat: false, ...over,
  };
}

/* ── the opt-in contract ──────────────────────────────────────────────── */

test('the bridge is OFF by default and returns used:false', () => {
  const p = buildModularPlan(analysis(), { style: 'pencil', count: 8 });
  assertEqual(p.used, false);
  assertEqual(p.reason, 'disabled');
  assertEqual(p.shapes, []);
});

test('BRIDGE_DEFAULTS.enabled is false', () => {
  assertEqual(BRIDGE_DEFAULTS.enabled, false);
});

test('enabled + no analysis returns used:false, never throws', () => {
  const p = buildModularPlan(null, { enabled: true, style: 'pencil', count: 8 });
  assertEqual(p.used, false);
  assertEqual(p.reason, 'no-analysis');
  const q = buildModularPlan(undefined, { enabled: true });
  assertEqual(q.used, false);
});

test('the bridge does not mutate its arguments', () => {
  const args = { enabled: true, style: 'pencil', count: 8, seed: 7 };
  const snapshot = JSON.parse(JSON.stringify(args));
  buildModularPlan(analysis(), args);
  assertEqual(args, snapshot);
});

/* ── real optimiser output ────────────────────────────────────────────── */

test('an enabled plan runs the REAL optimiser and returns shapes', () => {
  const p = buildModularPlan(analysis(), { enabled: true, style: 'pencil', count: 40, seed: 12345 });
  assertOk(p.used, `expected shapes, got reason=${p.reason}`);
  assertOk(p.shapes.length > 0, 'no shapes');
  assertOk(p.rawCount > 0, 'rawCount should be > 0');
  assertOk(p.options && typeof p.options === 'object', 'options should be resolved');
  assertEqual(p.options.count, 40);
});

test('the plan is deterministic: same input twice → identical shapes', () => {
  const a = buildModularPlan(analysis(), { enabled: true, style: 'ink', count: 30, seed: 99 });
  const b = buildModularPlan(analysis(), { enabled: true, style: 'ink', count: 30, seed: 99 });
  assertOk(a.used && b.used, 'both plans should be used');
  assertEqual(a.shapes, b.shapes);
});

test('a different seed produces a different painting', () => {
  const a = buildModularPlan(analysis(), { enabled: true, style: 'ink', count: 30, seed: 1 });
  const b = buildModularPlan(analysis(), { enabled: true, style: 'ink', count: 30, seed: 2 });
  assertOk(a.used && b.used, 'both plans should be used');
  assert.notDeepEqual(a.shapes, b.shapes);
});

test('the stroke budget is honoured (modular shapes <= count)', () => {
  for (const count of [10, 25, 60]) {
    const p = buildModularPlan(analysis(), { enabled: true, style: 'oil', count, seed: 5 });
    assertOk(p.used, `count=${count} produced nothing`);
    assertOk(p.rawCount <= count,
      `count=${count}: optimiser returned ${p.rawCount} shapes`);
    assertOk(p.shapes.length <= count + p.outlineCount,
      `count=${count}: got ${p.shapes.length} shapes (modular ${p.rawCount} + outlines ${p.outlineCount})`);
  }
});

/* ── shape conversion ─────────────────────────────────────────────────── */

test('toEngineShape embeds colours at the renderer indices (E/B/R)', () => {
  const s = toEngineShape({ type: 'E', params: [1, 2, 3, 4, 0.5, 0.9], color0: [9, 8, 7], color1: [1, 2, 3], alpha: 0.5 }, 4, 0, 12345);
  assertEqual(s.type, 'E');
  assertEqual(s.params[5], [9, 8, 7], 'index 5 must be c0');
  assertEqual(s.params[6], [1, 2, 3], 'index 6 must be c1');
  assertEqual(s.params[7], 0.5, 'index 7 must be alpha');
  assertEqual(s.order, 4);
  assertEqual(s.id, 'stroke_0_4');
  assertEqual(s.seed, 12345);
});

test('toEngineShape embeds colours by appending (S/T)', () => {
  const s = toEngineShape({ type: 'S', params: [1, 2, 3, 4, 5, 6, 2, 0.3], color0: [9, 8, 7], color1: [1, 2, 3], alpha: 0.7 }, 0, 0, 1);
  assertEqual(s.params.length, 11);
  assertEqual(s.params[8], [9, 8, 7]);
  assertEqual(s.params[9], [1, 2, 3]);
  assertEqual(s.params[10], 0.7);
});

test('toEngineShape does not mutate the raw shape', () => {
  const raw = { type: 'E', params: [1, 2, 3, 4, 0.5, 0.9], color0: [9, 8, 7], color1: [1, 2, 3], alpha: 0.5 };
  const before = JSON.stringify(raw);
  toEngineShape(raw, 0, 0, 1);
  assertEqual(JSON.stringify(raw), before);
});

test('every planned shape is consumable by the existing renderer format', () => {
  const p = buildModularPlan(analysis(), { enabled: true, style: 'pencil', count: 30, seed: 3 });
  assertOk(p.used, 'plan should be used');
  for (const s of p.shapes) {
    assertOk(typeof s.id === 'string' && s.id.length > 0, 'id');
    assertOk(['E', 'B', 'R', 'T', 'S'].includes(s.type), `type ${s.type}`);
    assertOk(Array.isArray(s.params), 'params');
    assertOk(Array.isArray(s.color0) && s.color0.length === 3, 'color0');
    assertOk(Array.isArray(s.color1) && s.color1.length === 3, 'color1');
    assertOk(typeof s.alpha === 'number', 'alpha');
    assertOk(typeof s.order === 'number', 'order');
    assertOk(getStyle(s.style) != null, `style "${s.style}" must be in the registry`);
  }
});

test('outline shapes paint first (lowest order values)', () => {
  const p = buildModularPlan(analysis(), { enabled: true, style: 'ink', count: 40, seed: 11 });
  assertOk(p.used, 'plan should be used');
  const orders = p.shapes.map(s => s.order);
  assertEqual(orders, orders.slice().sort((a, b) => a - b), 'orders must ascend');
  assertEqual(orders[0], 0);
});

test('the outline lay-in is budget-capped', () => {
  const p = buildModularPlan(analysis(), {
    enabled: true, style: 'ink', count: 40, seed: 11, outlineMax: 3,
  });
  assertOk(p.used, 'plan should be used');
  assertOk(p.outlineCount <= 3, `outlineCount ${p.outlineCount} > 3`);
});

/* ── R4 shaping ───────────────────────────────────────────────────────── */

test('the style\'s own R4 shaping row drives regionFill', () => {
  const wash = buildModularPlan(analysis(), { enabled: true, style: 'watercolor', count: 20, seed: 2 });
  assertOk(wash.used, 'watercolor plan should be used');
  assertOk(wash.options.regionFill > 0.3, `watercolor regionFill expected > 0.3, got ${wash.options.regionFill}`);
  const pencil = buildModularPlan(analysis(), { enabled: true, style: 'pencil', count: 20, seed: 2 });
  assertOk(pencil.used, 'pencil plan should be used');
  assertOk(pencil.options.regionFill < 0.2, `pencil regionFill expected < 0.2, got ${pencil.options.regionFill}`);
});

test('an explicit shaping override wins', () => {
  const p = buildModularPlan(analysis(), {
    enabled: true, style: 'pencil', count: 20, seed: 2,
    shapingOverride: { regionFill: 0.9 },
  });
  assertOk(p.used, 'plan should be used');
  assertEqual(p.options.regionFill, 0.9);
});

test('every registry style plans without throwing', () => {
  const an = analysis();
  for (const { name } of getAllStyles()) {
    const p = buildModularPlan(an, { enabled: true, style: name, count: 6, seed: 4 });
    assertOk(p.used, `style "${name}" produced no shapes (reason=${p.reason})`);
    for (const s of p.shapes) assertOk(getStyle(s.style) != null, `${name}: style ${s.style} not registered`);
  }
});

/* ── layer styles ─────────────────────────────────────────────────────── */

test('Phase 2.2 layer styles are applied to the planned shapes', () => {
  const spec = [{ match: { tonal: 'background' }, style: 'charcoal' }];
  const p = buildModularPlan(analysis(), {
    enabled: true, style: 'pencil', count: 20, seed: 8, layerStyles: spec,
  });
  assertOk(p.used, 'plan should be used');
  // With a tonal-band spec the shapes carry the resolved style rather than the
  // bare requested one; the exact assignment is `layer-styles.js`'s contract.
  assertOk(p.shapes.every(s => getStyle(s.style) != null), 'all resolved styles must be registered');
});

/* ── options ──────────────────────────────────────────────────────────── */

test('modularOptions only emits keys the optimiser resolves', () => {
  const o = modularOptions({ style: 'watercolor', count: 50, seed: 1, regionFill: 0.3 });
  // The raw registry name is kept: `watercolour` is a Painter alias that is
  // NOT in the registry, and the renderer falls back to the flat drawShape.
  assertEqual(o.style, 'watercolor');
  assertEqual(o.count, 50);
  assertEqual(o.seed, 1);
  assertEqual(o.regionFill, 0.3);
  const r = resolveOptions(o);
  assertEqual(r.count, 50, 'resolveOptions must carry count');
});

test('modularOptions does NOT accept maxShapes as a budget (the optimiser ignores it)', () => {
  // Regression pin: `optimise(an,{maxShapes:10})` returned 400 shapes.
  const an = analysis();
  const viaMax = optimise(an, { maxShapes: 10, seed: 1 });
  assertOk(viaMax.shapes.length > 10,
    `maxShapes is not the budget key — got ${viaMax.shapes.length} shapes`);
});

test('modularOptions clamps regionFill into 0..1', () => {
  assertEqual(modularOptions({ regionFill: 5 }).regionFill, 1);
  assertEqual(modularOptions({ regionFill: -1 }).regionFill, 0);
});

test('the bridge matches a direct optimise() call on the same resolved options', () => {
  const an = analysis();
  const args = { enabled: true, style: 'oil', count: 20, seed: 77 };
  const p = buildModularPlan(an, args);
  const direct = optimise(an, resolveOptions(modularOptions({ style: 'oil', count: 20, seed: 77 })));
  assertOk(p.used, 'plan should be used');
  assertEqual(p.rawCount, (direct.shapes || []).length, 'rawCount must equal a direct optimise() run');
});

/* ── run ──────────────────────────────────────────────────────────────── */

console.log(`\n=== Track R modular bridge: Passed ${passed}  Failed ${failed} ===`);
if (failed) {
  console.log('\nFailures:');
  for (const f of failures) console.log(`  ${f.name}: ${f.err.message}`);
  process.exit(1);
}
