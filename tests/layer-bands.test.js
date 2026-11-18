/**
 * Phase 2.2 on the modular engine — multi-layer band assignment.
 *
 * Run with: node tests/layer-bands.test.js
 *
 * The layer SPLIT is our own design (masks.js soft tonal bands, the
 * Zorn/Reilly value-structure abstraction) — it predates and outlives any
 * particular generator. These tests pin the modular engine's version of it:
 *
 *   - `layerBands` is OPT-IN: off → every shape untouched (byte-identical),
 *   - on → every shape carries a `layerName` from the fixed 5-name set,
 *   - outline strokes are pinned to 'outline',
 *   - the band a shape gets follows the IMAGE (a dark source puts anchors in
 *     shadows, a light source in highlights/midtones), not emission order,
 *   - per-layer styles restamp THROUGH the band (`applyLayerStyles` keys on
 *     `layerName`), and
 *   - a banded plan is deterministic (same input → same bands).
 *
 * Real `analyzeImage()` + real `optimise()` + real `computeTonalMasks()` — no
 * mocks, matching tests/modular-bridge.test.js.
 */

import assert from 'node:assert/strict';
import { buildModularPlan, bandAt, classifyShapeBands } from '../js/engine/modular-bridge.js';
import { analyzeImage } from '../js/engine/analyzer.js';
import { computeTonalMasks } from '../js/engine/masks.js';
import { TONAL_LAYER_NAMES } from '../js/engine/layer-styles.js';

let passed = 0;
let failed = 0;
const failures = [];
function test(name, fn) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { failed++; failures.push(name); console.error(`  ✗ ${name}\n    ${e.message}`); }
}

/** A source with three distinct luminance zones: dark floor, mid blob, bright sky. */
function zonedSource(S = 96) {
  const px = new Uint8ClampedArray(S * S * 4);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4;
      let v;
      if (y < S / 3) v = 235;                      // bright sky
      else if (y < (2 * S) / 3) v = 128;           // midtones
      else v = 25;                                 // dark floor
      // a dark round blob in the sky band, a bright one on the floor
      if (Math.hypot(x - 24, y - 16) < 10) v = 30;
      if (Math.hypot(x - 70, y - 80) < 10) v = 240;
      px[i] = v; px[i + 1] = v; px[i + 2] = v; px[i + 3] = 255;
    }
  }
  return px;
}

let AN = null;
function analysis() {
  if (!AN) AN = analyzeImage(zonedSource(), 96, 96, {});
  return AN;
}

console.log('\n=== Phase 2.2 modular layer bands ===\n');

/* ── bandAt: masks-driven classification ─────────────────────────────── */

test('bandAt maps the tonal masks onto the engine layer names', () => {
  const tonal = computeTonalMasks(analysis());
  const bright = bandAt(tonal, 48, 8);    // sky row (v=235)
  const mid = bandAt(tonal, 48, 48);      // mid row (v=128)
  const dark = bandAt(tonal, 48, 88);     // floor row (v=25)
  assert.equal(bright, 'highlights');
  assert.equal(mid, 'midtone');
  assert.equal(dark, 'shadows');
});

test('bandAt clamps out-of-range anchors instead of crashing', () => {
  const tonal = computeTonalMasks(analysis());
  assert.ok(['background', 'shadows', 'midtone', 'highlights', 'outline'].includes(bandAt(tonal, -50, -50)));
  assert.ok(['background', 'shadows', 'midtone', 'highlights', 'outline'].includes(bandAt(tonal, 1e9, 1e9)));
});

test('bandAt on a malformed tonal object falls back, not throws', () => {
  assert.equal(bandAt(null, 10, 10), 'outline');
  assert.equal(bandAt({}, 10, 10), 'outline');
});

test('classifyShapeBands aligns 1:1 with the shapes list', () => {
  const tonal = computeTonalMasks(analysis());
  const shapes = [
    { params: [48, 8, 0, 0, 0, 0, 1, 0] },
    { params: [48, 48, 0, 0, 0, 0, 1, 0] },
    { params: [48, 88, 0, 0, 0, 0, 1, 0] },
  ];
  const bands = classifyShapeBands(tonal, shapes);
  assert.deepEqual(bands, ['highlights', 'midtone', 'shadows']);
});

/* ── the plan-level contract ─────────────────────────────────────────── */

test('layerBands is opt-in: absent → shapes carry NO layerName', () => {
  const p = buildModularPlan(analysis(), { enabled: true, style: 'pencil', count: 24, seed: 7 });
  assert.equal(p.used, true);
  assert.equal(p.layerBands, null);
  assert.equal(p.bandCounts, null);
  for (const s of p.shapes) assert.equal('layerName' in s, false, 'no layerName unless opted in');
});

test('layerBands off → identical plan to a pre-feature call', () => {
  const a = buildModularPlan(analysis(), { enabled: true, style: 'ink', count: 30, seed: 99 });
  const b = buildModularPlan(analysis(), { enabled: true, style: 'ink', count: 30, seed: 99, layerBands: false });
  assert.deepEqual(b.shapes, a.shapes);
});

test('layerBands: every shape gets a layerName from the canonical set', () => {
  const p = buildModularPlan(analysis(), { enabled: true, style: 'pencil', count: 60, seed: 11, layerBands: 'bands' });
  assert.equal(p.used, true);
  assert.equal(p.layerBands, 'bands');
  // The bridge scales the budget for stroke conversion (strokeBudgetScale 8),
  // so the emitted count exceeds `count` — assert every EMITTED shape is
  // banded, not a specific count.
  assert.ok(p.shapes.length >= 60, `expected a full plan, got ${p.shapes.length}`);
  const valid = new Set(TONAL_LAYER_NAMES);
  for (const s of p.shapes) {
    assert.ok(valid.has(s.layerName), `layerName ${s.layerName} not in ${[...valid]}`);
  }
});

test('layerBands: bandCounts sum to the shape count', () => {
  const p = buildModularPlan(analysis(), { enabled: true, style: 'pencil', count: 60, seed: 11, layerBands: 'bands' });
  const total = Object.values(p.bandCounts).reduce((a, b) => a + b, 0);
  assert.equal(total, p.shapes.length);
});

test('layerBands: the split actually splits (≥3 bands populated)', () => {
  const p = buildModularPlan(analysis(), { enabled: true, style: 'pencil', count: 80, seed: 5, layerBands: 'bands' });
  assert.ok(Object.keys(p.bandCounts).length >= 3, `only ${JSON.stringify(p.bandCounts)} populated`);
});

test('layerBands: bands follow the image, not emission order', () => {
  const p = buildModularPlan(analysis(), { enabled: true, style: 'pencil', count: 80, seed: 5, layerBands: 'bands' });
  // The zoned source is dark in its bottom third: a shadow-band stroke must
  // anchor in the bottom third of the canvas. (The legacy Painter's progress
  // rule — "first 5% of emissions are background" — would violate this.)
  const shadows = p.shapes.filter((s) => s.layerName === 'shadows');
  assert.ok(shadows.length > 0, 'the dark floor must claim some strokes');
  const H = 96;
  const inBottom = shadows.filter((s) => s.params[1] >= (2 * H) / 3);
  const share = inBottom.length / shadows.length;
  assert.ok(share > 0.5, `only ${(share * 100).toFixed(0)}% of shadow strokes anchor in the dark zone`);
});

test('layerBands: deterministic for a fixed seed', () => {
  const a = buildModularPlan(analysis(), { enabled: true, style: 'pencil', count: 40, seed: 21, layerBands: 'bands' });
  const b = buildModularPlan(analysis(), { enabled: true, style: 'pencil', count: 40, seed: 21, layerBands: 'bands' });
  assert.deepEqual(
    b.shapes.map((s) => s.layerName),
    a.shapes.map((s) => s.layerName),
  );
});

/* ── per-layer styles ride on the bands ──────────────────────────────── */

test('layerStyles restamp THROUGH the band on a banded plan', () => {
  const spec = { shadows: 'ink', highlights: 'pastel' };
  const p = buildModularPlan(analysis(), {
    enabled: true, style: 'pencil', count: 60, seed: 11, layerBands: 'bands', layerStyles: spec,
  });
  let shadowsSeen = 0, highlightsSeen = 0;
  for (const s of p.shapes) {
    if (s.layerName === 'shadows') { assert.equal(s.style, 'ink'); shadowsSeen++; }
    if (s.layerName === 'highlights') { assert.equal(s.style, 'pastel'); highlightsSeen++; }
    if (s.layerName === 'midtone') assert.equal(s.style, 'pencil', 'unmapped bands keep the plan style');
  }
  assert.ok(shadowsSeen > 0 && highlightsSeen > 0, 'fixture must populate both styled bands');
});

/* ── the feature must not break the single-layer path ────────────────── */

test('single-layer modular plan is unchanged by the bands feature', () => {
  const p = buildModularPlan(analysis(), { enabled: true, style: 'pencil', count: 30, seed: 3 });
  assert.equal(p.used, true);
  assert.equal(p.layerBands, null);
  for (const s of p.shapes) assert.equal('layerName' in s, false);
});

console.log(`\n=== Phase 2.2 modular layer bands: Passed ${passed}  Failed ${failed} ===`);
if (failed) { console.error(`FAILED: ${failures.join(' | ')}`); process.exit(1); }
