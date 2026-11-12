/**
 * Per-style shaping tests (Round 2, M9).
 *
 * Run with: node tests/shaping.test.js
 *
 * Verifies the per-style shaping data table — no DOM, no canvas:
 *   - the frozen resolveShaping() shape
 *   - every registered style resolves
 *   - unknown styles fall back to documented defaults
 *   - data only (no functions / no DOM references)
 *   - deterministic and side-effect free
 */

import { getAllStyles } from '../js/styles/index.js';
import {
  resolveShaping, SHAPING_DEFAULTS, SHAPING_TABLE, STYLE_CATEGORIES,
} from '../js/styles/shaping.js';

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

console.log('\nPer-style shaping (M9):\n');

// ─── Frozen shape ─────────────────────────────────────────────────

test('resolveShaping returns the frozen shape', () => {
  const r = resolveShaping('pencil');
  assertEqual(
    Object.keys(r).sort(),
    ['elongation', 'maxSize', 'minSize', 'order', 'regionFill'].sort(),
    'unexpected keys',
  );
});

test('all values are finite numbers except order (string)', () => {
  const r = resolveShaping('pencil');
  assert(Number.isFinite(r.minSize), `minSize not finite: ${r.minSize}`);
  assert(Number.isFinite(r.maxSize), `maxSize not finite: ${r.maxSize}`);
  assert(Number.isFinite(r.elongation), `elongation not finite: ${r.elongation}`);
  assert(Number.isFinite(r.regionFill), `regionFill not finite: ${r.regionFill}`);
  assertEqual(typeof r.order, 'string', 'order is not a string');
});

test('minSize <= maxSize for every style', () => {
  for (const { name } of getAllStyles()) {
    const r = resolveShaping(name);
    assert(
      r.minSize <= r.maxSize,
      `${name}: minSize ${r.minSize} > maxSize ${r.maxSize}`,
    );
  }
});

test('sizes and elongation are positive', () => {
  for (const { name } of getAllStyles()) {
    const r = resolveShaping(name);
    assert(r.minSize > 0, `${name}: minSize ${r.minSize} not positive`);
    assert(r.maxSize > 0, `${name}: maxSize ${r.maxSize} not positive`);
    assert(r.elongation >= 1, `${name}: elongation ${r.elongation} < 1`);
  }
});

test('regionFill is in [0, 1]', () => {
  for (const { name } of getAllStyles()) {
    const r = resolveShaping(name);
    assert(
      r.regionFill >= 0 && r.regionFill <= 1,
      `${name}: regionFill ${r.regionFill} out of range`,
    );
  }
});

// ─── Every registered style resolves ──────────────────────────────

test('every registered style resolves', () => {
  const styles = getAllStyles();
  assert(styles.length >= 50, `expected >= 50 styles, got ${styles.length}`);
  for (const { name } of styles) {
    const r = resolveShaping(name);
    assert(r && typeof r === 'object', `${name} did not resolve`);
    assertEqual(typeof r.order, 'string', `${name}: order not a string`);
  }
});

test('every style name is present in the shaping table', () => {
  const styles = getAllStyles();
  for (const { name } of styles) {
    assert(
      Object.prototype.hasOwnProperty.call(SHAPING_TABLE, name),
      `${name} missing from SHAPING_TABLE`,
    );
  }
});

// ─── Unknown styles fall back to documented defaults ──────────────

test('unknown style resolves to the documented defaults', () => {
  const r = resolveShaping('no-such-style');
  assertEqual(r.minSize, SHAPING_DEFAULTS.minSize, 'minSize');
  assertEqual(r.maxSize, SHAPING_DEFAULTS.maxSize, 'maxSize');
  assertEqual(r.elongation, SHAPING_DEFAULTS.elongation, 'elongation');
  assertEqual(r.order, SHAPING_DEFAULTS.order, 'order');
  assertEqual(r.regionFill, SHAPING_DEFAULTS.regionFill, 'regionFill');
});

test('empty / missing style resolves to the documented defaults', () => {
  for (const bad of ['', undefined, null, 'PENCIL', 'Pencil']) {
    const r = resolveShaping(bad);
    assertEqual(r.minSize, SHAPING_DEFAULTS.minSize, `minSize for ${JSON.stringify(bad)}`);
    assertEqual(r.order, SHAPING_DEFAULTS.order, `order for ${JSON.stringify(bad)}`);
  }
});

test('SHAPING_DEFAULTS is itself a valid shaping', () => {
  const r = resolveShaping('__defaults__');
  assertEqual(r.minSize, SHAPING_DEFAULTS.minSize);
  assertEqual(r.order, SHAPING_DEFAULTS.order);
});

// ─── Data only ────────────────────────────────────────────────────

test('the shaping table contains no functions or DOM references', () => {
  for (const [name, entry] of Object.entries(SHAPING_TABLE)) {
    for (const [k, v] of Object.entries(entry)) {
      const want = k === 'order' ? 'string' : 'number';
      assertEqual(typeof v, want, `${name}.${k} is not a ${want}: ${typeof v}`);
    }
  }
});

test('every table entry has the full key set', () => {
  const keys = ['minSize', 'maxSize', 'elongation', 'order', 'regionFill'];
  for (const [name, entry] of Object.entries(SHAPING_TABLE)) {
    for (const k of keys) {
      assert(
        Object.prototype.hasOwnProperty.call(entry, k),
        `${name} missing key ${k}`,
      );
    }
  }
});

// ─── Categories ───────────────────────────────────────────────────

test('STYLE_CATEGORIES covers every style category', () => {
  const cats = new Set(getAllStyles().map(s => s.category));
  for (const c of cats) {
    assert(
      Object.prototype.hasOwnProperty.call(STYLE_CATEGORIES, c),
      `category ${c} missing from STYLE_CATEGORIES`,
    );
  }
});

test('STYLE_CATEGORIES values are non-empty strings', () => {
  for (const [k, v] of Object.entries(STYLE_CATEGORIES)) {
    assertEqual(typeof v, 'string', `${k} not a string`);
    assert(v.length > 0, `${k} is empty`);
  }
});

// ─── Determinism / purity ─────────────────────────────────────────

test('resolveShaping is deterministic', () => {
  for (const { name } of getAllStyles()) {
    assertEqual(resolveShaping(name), resolveShaping(name), `${name} not deterministic`);
  }
});

test('resolveShaping does not mutate the table', () => {
  const before = JSON.stringify(SHAPING_TABLE);
  resolveShaping('pencil');
  resolveShaping('nope');
  assertEqual(JSON.stringify(SHAPING_TABLE), before, 'table mutated');
});

test('returned object is a fresh copy (mutating it does not corrupt the table)', () => {
  const a = resolveShaping('pencil');
  a.minSize = -999;
  a.order = 'hacked';
  const b = resolveShaping('pencil');
  assert(b.minSize !== -999, 'mutating the result corrupted the table (minSize)');
  assert(b.order !== 'hacked', 'mutating the result corrupted the table (order)');
});

test('the nine pinned styles are absent from the table (BE owns those)', () => {
  const pinned = ['pencil', 'ink', 'watercolor', 'oil', 'charcoal', 'marker', 'cross-hatch', 'halftone', 'graphic'];
  for (const p of pinned) {
    assert(
      Object.prototype.hasOwnProperty.call(SHAPING_TABLE, p),
      `expected ${p} in the shaping table`,
    );
  }
});

// ─── Summary ──────────────────────────────────────────────────────
console.log('\n=== Results ===');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(failed === 0 ? '\n✅ All shaping tests passed!' : '\n❌ Some shaping tests failed.');
process.exit(failed === 0 ? 0 : 1);
