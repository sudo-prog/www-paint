/**
 * Reference-analysis tests (Track S, S1 — analysis grid + RefPacket).
 *
 * Run with: node tests/ref-analyze.test.js
 *
 * Verifies `analyzeReference()` on plain typed buffers — no DOM, no canvas, so
 * it runs in bare Node:
 *   - the frozen RefPacket shape (JSON-safe, deterministic)
 *   - a synthetic square yields a stroke-scale histogram + an orientation field
 *     that hugs the edges (vertical walls -> tangent ~PI/2, horizontal -> ~0)
 *   - flat fields read as one coarse band; busy fields span several bins
 *   - a ring also produces oriented structure
 *   - adaptive grid resolution
 */

import { analyzeImage } from '../js/engine/analyzer.js';
import {
  analyzeReference,
  chooseGridSize,
  SCALE_BINS,
  ORIENTATION_BINS,
  REF_DEFAULTS,
} from '../js/engine/ref-analyze.js';

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

function assertClose(actual, expected, tol, msg = '') {
  if (Math.abs(actual - expected) > tol) {
    throw new Error(`${msg} Expected ~${expected} (+-${tol}), got ${actual}`);
  }
}

/** PI-periodic angular distance. */
function angDist(a, b) {
  let d = Math.abs(a - b) % Math.PI;
  if (d > Math.PI / 2) d = Math.PI - d;
  return d;
}

/** Build a square greyscale image from a draw(x,y) -> 0..255 function. */
function makeImage(size, draw) {
  const px = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const v = draw(x, y);
      px[i] = v; px[i + 1] = v; px[i + 2] = v; px[i + 3] = 255;
    }
  }
  return { pixels: px, width: size, height: size };
}

const square = (sz) => makeImage(sz, (x, y) => (x >= 36 && x < 92 && y >= 36 && y < 92 ? 230 : 25));
const flat = (sz) => makeImage(sz, () => 128);
const ring = (sz) => makeImage(sz, (x, y) => {
  const d = Math.hypot(x - sz / 2, y - sz / 2);
  return d > 40 && d < 52 ? 235 : 25;
});

const SQ = square(128);
const pk = analyzeReference(SQ);

console.log('Reference analysis (S1)');

// ── Shape / schema ────────────────────────────────────────────────
test('returns the frozen RefPacket shape', () => {
  for (const key of ['version', 'width', 'height', 'gridSize', 'cells', 'scaleHistogram',
    'strokeScaleByBand', 'orientationField', 'coverage', 'depthProxy', 'stats', 'meta']) {
    assert(key in pk, `missing key: ${key}`);
  }
  assertEqual(pk.width, 128);
  assertEqual(pk.height, 128);
  assert(pk.gridSize >= REF_DEFAULTS.minGrid && pk.gridSize <= REF_DEFAULTS.maxGrid,
    `gridSize ${pk.gridSize} out of range`);
  assertEqual(pk.cells.length, pk.gridSize * pk.gridSize);
});

test('is JSON-safe (round-trips through JSON)', () => {
  const round = JSON.parse(JSON.stringify(pk));
  assertEqual(round, pk);
});

test('every cell carries finite metrics and a valid orientation', () => {
  for (const c of pk.cells) {
    for (const k of ['orientation', 'orientationStrength', 'coherence', 'energy',
      'density', 'contrast', 'luma', 'strokeScale', 'scaleBin']) {
      assert(Number.isFinite(c[k]), `cell.${k} not finite`);
    }
    assert(c.orientation >= 0 && c.orientation < Math.PI, `orientation out of [0,PI): ${c.orientation}`);
    assert(c.orientationStrength >= 0 && c.orientationStrength <= 1, 'orientationStrength out of [0,1]');
    assert(c.density >= 0 && c.density <= 1, 'density out of [0,1]');
    assert(c.strokeScale >= REF_DEFAULTS.scaleFloor && c.strokeScale <= 1, `strokeScale out of range: ${c.strokeScale}`);
    assert(c.scaleBin >= 0 && c.scaleBin < SCALE_BINS, 'scaleBin out of range');
  }
});

test('is deterministic (two calls are byte-identical)', () => {
  const again = analyzeReference(SQ);
  assertEqual(again, pk);
});

test('accepts an analyzeImage() result as well as raw pixels', () => {
  const an = analyzeImage(SQ.pixels, SQ.width, SQ.height, { structure: true });
  const fromAnalysis = analyzeReference(an);
  assertEqual(fromAnalysis.cells.length, pk.cells.length);
  assertEqual(fromAnalysis.scaleHistogram, pk.scaleHistogram);
});

// ── Histograms ────────────────────────────────────────────────────
test('scaleHistogram has SCALE_BINS bins summing to the cell count', () => {
  assertEqual(pk.scaleHistogram.length, SCALE_BINS);
  const sum = pk.scaleHistogram.reduce((a, b) => a + b, 0);
  assertEqual(sum, pk.gridSize * pk.gridSize);
});

test('a square spans more than one stroke-scale bin', () => {
  const nonEmpty = pk.scaleHistogram.filter((v) => v > 0).length;
  assert(nonEmpty >= 2, `expected >=2 non-empty scale bins, got ${nonEmpty}`);
});

test('orientationField histogram normalises to ~1', () => {
  assertEqual(pk.orientationField.bins.length, ORIENTATION_BINS);
  const sum = pk.orientationField.bins.reduce((a, b) => a + b, 0);
  assertClose(sum, 1, 1e-6, 'orientation bins should sum to 1');
});

test('strokeScaleByBand exposes all four tonal bands as finite numbers', () => {
  for (const b of ['background', 'shadows', 'midtones', 'highlights']) {
    assert(Number.isFinite(pk.strokeScaleByBand[b]), `band ${b} not finite`);
    assert(pk.strokeScaleByBand[b] >= 0 && pk.strokeScaleByBand[b] <= 1, `band ${b} out of range`);
  }
});

test('tonal coverage sums to ~1 (partition of unity)', () => {
  const c = pk.coverage;
  const sum = c.background + c.shadows + c.midtones + c.highlights;
  assertClose(sum, 1, 0.02, 'coverage should sum to ~1');
});

// ── The exit criterion: orientation field hugs the edges ──────────
test('a square produces strongly oriented edge cells', () => {
  const strong = pk.cells.filter((c) => c.orientationStrength > 0.35);
  assert(strong.length >= 4, `expected several strongly oriented cells, got ${strong.length}`);
});

test('orientation field hugs the edge: vertical walls ~PI/2, horizontal ~0', () => {
  const strong = pk.cells.filter((c) => c.orientationStrength > 0.35);
  const minToVertical = Math.min(...strong.map((c) => angDist(c.orientation, Math.PI / 2)));
  const minToHorizontal = Math.min(...strong.map((c) => angDist(c.orientation, 0)));
  assert(minToVertical < 0.3, `no vertical-wall orientation found (closest ${minToVertical.toFixed(3)} rad)`);
  assert(minToHorizontal < 0.3, `no horizontal-wall orientation found (closest ${minToHorizontal.toFixed(3)} rad)`);
});

test('flat interior cells want coarser strokes than wall cells', () => {
  const interior = pk.cells.find((c) => c.gx >= 3 && c.gx <= 3 && c.gy >= 3 && c.gy <= 3);
  const busiest = pk.cells.slice().sort((a, b) => b.density - a.density)[0];
  assert(interior, 'expected an interior cell');
  assert(interior.strokeScale > busiest.strokeScale,
    `interior scale ${interior.strokeScale} should exceed busiest ${busiest.strokeScale}`);
});

// ── Flat field ────────────────────────────────────────────────────
test('a flat field reads as one coarse, weakly-oriented band', () => {
  const fp = analyzeReference(flat(128));
  const nonEmpty = fp.scaleHistogram.filter((v) => v > 0).length;
  assertEqual(nonEmpty, 1, 'flat field should occupy a single scale bin');
  assert(fp.stats.meanStrokeScale > 0.9, `flat field should be near-coarsest, got ${fp.stats.meanStrokeScale}`);
  assert(fp.orientationField.strength < 0.2, `flat field orient strength should be low, got ${fp.orientationField.strength}`);
});

test('a ring also produces oriented structure', () => {
  const rp = analyzeReference(ring(128));
  const strong = rp.cells.filter((c) => c.orientationStrength > 0.3);
  assert(strong.length >= 3, `ring expected >=3 oriented cells, got ${strong.length}`);
});

// ── Adaptive grid ─────────────────────────────────────────────────
test('chooseGridSize adapts and clamps to [minGrid, maxGrid]', () => {
  assertEqual(chooseGridSize(64, 64), REF_DEFAULTS.minGrid);
  assertEqual(chooseGridSize(16384, 16384), REF_DEFAULTS.maxGrid);
  const mid = chooseGridSize(512, 512);
  assert(mid > REF_DEFAULTS.minGrid && mid < REF_DEFAULTS.maxGrid, `mid grid ${mid} not adaptive`);
});

// ── Summary ───────────────────────────────────────────────────────
console.log('');
console.log('=== Results ===');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('\n✅ All ref-analyze tests passed!');
}
