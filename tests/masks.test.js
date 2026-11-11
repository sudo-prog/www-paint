/**
 * Tonal mask tests (Phase 2.1, IF-1).
 *
 * Run with: node tests/masks.test.js
 *
 * Verifies the soft background/shadows/midtones/highlights separation on plain
 * typed buffers — no DOM, no canvas:
 *   - the frozen IF-1 return shape
 *   - the four masks form a partition of unity (coverage sums to ~1)
 *   - extremes land in the right band
 *   - determinism and additive-only behaviour
 *   - RGBA helpers are node-safe
 */

import { analyzeImage } from '../js/engine/analyzer.js';
import {
  computeTonalMasks, maskToRGBA, masksCompositeRGBA,
} from '../js/engine/masks.js';

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

function assertClose(a, b, tol, msg) {
  if (Math.abs(a - b) > tol) {
    throw new Error(`${msg || 'values differ'}: ${a} vs ${b} (tol ${tol})`);
  }
}

/** Build an RGBA buffer from a per-pixel colour function. */
function makeImage(w, h, fn) {
  const px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const [r, g, b] = fn(x, y);
      px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255;
    }
  }
  return px;
}

/** Horizontal luminance gradient 0..255 — populates every band. */
function gradientImage(w, h) {
  return makeImage(w, h, (x) => {
    const v = Math.round((x / (w - 1)) * 255);
    return [v, v, v];
  });
}

console.log('\nTonal masks (Phase 2.1):');

test('returns the frozen IF-1 shape', () => {
  const W = 32, H = 24;
  const a = analyzeImage(gradientImage(W, H), W, H, { structure: false });
  const r = computeTonalMasks(a);
  assert(r.width === W && r.height === H, 'dimensions wrong');
  for (const k of ['background', 'shadows', 'midtones', 'highlights']) {
    assert(r.masks[k] instanceof Float32Array, `${k} not Float32Array`);
    assert(r.masks[k].length === W * H, `${k} length wrong`);
    assert(typeof r.coverage[k] === 'number', `coverage.${k} not a number`);
  }
  assert(typeof r.threshold.lo === 'number' && typeof r.threshold.hi === 'number',
    'threshold missing');
  assert(r.threshold.lo < r.threshold.hi, 'threshold order wrong');
});

test('coverage sums to ~1 (partition of unity)', () => {
  const W = 64, H = 64;
  const a = analyzeImage(gradientImage(W, H), W, H, { structure: false });
  const r = computeTonalMasks(a);
  const sum = r.coverage.background + r.coverage.shadows
    + r.coverage.midtones + r.coverage.highlights;
  assertClose(sum, 1, 1e-3, `coverage sum ${sum}`);
});

test('every pixel is covered exactly once', () => {
  const W = 48, H = 48;
  const a = analyzeImage(gradientImage(W, H), W, H, { structure: false });
  const r = computeTonalMasks(a);
  const { background, shadows, midtones, highlights } = r.masks;
  const n = W * H;
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < n; i++) {
    const t = background[i] + shadows[i] + midtones[i] + highlights[i];
    if (t < min) min = t;
    if (t > max) max = t;
  }
  assertClose(min, 1, 1e-4, `min partition ${min}`);
  assertClose(max, 1, 1e-4, `max partition ${max}`);
});

test('all four bands are populated on a gradient', () => {
  const W = 96, H = 96;
  const a = analyzeImage(gradientImage(W, H), W, H, { structure: false });
  const r = computeTonalMasks(a);
  for (const k of ['background', 'shadows', 'midtones', 'highlights']) {
    assert(r.coverage[k] > 0.01, `${k} never populated (coverage ${r.coverage[k]})`);
  }
});

test('black image lands entirely in background', () => {
  const W = 16, H = 16;
  const black = makeImage(W, H, () => [0, 0, 0]);
  const r = computeTonalMasks(analyzeImage(black, W, H, { structure: false }));
  assertClose(r.coverage.background, 1, 1e-6, 'background coverage');
  assertClose(r.coverage.shadows, 0, 1e-6, 'shadows coverage');
  assertClose(r.coverage.midtones, 0, 1e-6, 'midtones coverage');
  assertClose(r.coverage.highlights, 0, 1e-6, 'highlights coverage');
});

test('white image lands entirely in highlights', () => {
  const W = 16, H = 16;
  const white = makeImage(W, H, () => [255, 255, 255]);
  const r = computeTonalMasks(analyzeImage(white, W, H, { structure: false }));
  assertClose(r.coverage.highlights, 1, 1e-6, 'highlights coverage');
  assertClose(r.coverage.background, 0, 1e-6, 'background coverage');
  assertClose(r.coverage.shadows, 0, 1e-6, 'shadows coverage');
});

test('mid-grey lands mostly in midtones', () => {
  const W = 16, H = 16;
  const grey = makeImage(W, H, () => [128, 128, 128]);
  const r = computeTonalMasks(analyzeImage(grey, W, H, { structure: false }));
  assert(r.coverage.midtones > 0.9,
    `midtones only ${r.coverage.midtones}`);
});

test('masks are soft, not hard cuts', () => {
  const W = 64, H = 8;
  const a = analyzeImage(gradientImage(W, H), W, H, { structure: false });
  const r = computeTonalMasks(a);
  // On a gradient, a soft mask should take intermediate values somewhere.
  let intermediate = 0;
  for (const v of r.masks.shadows) {
    if (v > 0.05 && v < 0.95) intermediate++;
  }
  assert(intermediate > 0, 'shadows mask is a hard cut (no intermediate values)');
});

test('deterministic for the same analysis', () => {
  const W = 32, H = 32;
  const px = gradientImage(W, H);
  const a1 = analyzeImage(px, W, H, { structure: false });
  const a2 = analyzeImage(px, W, H, { structure: false });
  const r1 = computeTonalMasks(a1);
  const r2 = computeTonalMasks(a2);
  let same = true;
  for (let i = 0; i < W * H; i++) {
    if (r1.masks.shadows[i] !== r2.masks.shadows[i]
      || r1.masks.midtones[i] !== r2.masks.midtones[i]) { same = false; break; }
  }
  assert(same, 'same input produced different masks');
});

test('thresholds are honoured and reflected in the result', () => {
  const W = 64, H = 64;
  const a = analyzeImage(gradientImage(W, H), W, H, { structure: false });
  const r = computeTonalMasks(a, { lo: 40, hi: 200 });
  assert(r.threshold.lo === 40 && r.threshold.hi === 200, 'threshold not echoed');
  // A lower `lo` means shadows claim less of the dark end.
  const rDefault = computeTonalMasks(a);
  assert(r.coverage.shadows < rDefault.coverage.shadows,
    'lowering lo did not shrink the shadow band');
});

test('does not mutate the analysis', () => {
  const W = 24, H = 24;
  const px = gradientImage(W, H);
  const a = analyzeImage(px, W, H, { structure: false });
  const before = a.luminance.slice();
  computeTonalMasks(a);
  let same = true;
  for (let i = 0; i < before.length; i++) {
    if (before[i] !== a.luminance[i]) { same = false; break; }
  }
  assert(same, 'computeTonalMasks mutated analysis.luminance');
});

test('throws on a missing analysis', () => {
  let threw = false;
  try { computeTonalMasks(null); } catch (e) { threw = true; }
  assert(threw, 'null analysis did not throw');
});

test('throws on a length mismatch', () => {
  let threw = false;
  try {
    computeTonalMasks({ width: 8, height: 8, luminance: new Uint8ClampedArray(10) });
  } catch (e) { threw = true; }
  assert(threw, 'bad luminance length did not throw');
});

test('maskToRGBA is node-safe and opaque', () => {
  const W = 16, H = 16;
  const a = analyzeImage(gradientImage(W, H), W, H, { structure: false });
  const r = computeTonalMasks(a);
  const rgba = maskToRGBA(r.masks.shadows, W, H);
  assert(rgba instanceof Uint8ClampedArray, 'not Uint8ClampedArray');
  assert(rgba.length === W * H * 4, 'wrong length');
  for (let i = 3; i < rgba.length; i += 4) {
    assert(rgba[i] === 255, 'alpha not 255');
  }
});

test('masksCompositeRGBA is node-safe and opaque', () => {
  const W = 16, H = 16;
  const a = analyzeImage(gradientImage(W, H), W, H, { structure: false });
  const r = computeTonalMasks(a);
  const rgba = masksCompositeRGBA(r.masks, W, H);
  assert(rgba instanceof Uint8ClampedArray, 'not Uint8ClampedArray');
  assert(rgba.length === W * H * 4, 'wrong length');
  for (let i = 3; i < rgba.length; i += 4) {
    assert(rgba[i] === 255, 'alpha not 255');
  }
});

test('degenerate 1x1 image works', () => {
  // NB: analyzeImage() itself hangs on a 1x1 input — its k-means palette init
  // loops forever when there are fewer samples than paletteSize (a pre-existing
  // bug in js/engine/analyzer.js, which is ThinkPad-owned). computeTonalMasks
  // only consumes `analysis.luminance`, so feed it a hand-built analysis object
  // to prove it handles the degenerate case.
  const r = computeTonalMasks({
    width: 1, height: 1, luminance: new Uint8ClampedArray([128]),
  });
  assert(r.width === 1 && r.height === 1, 'dimensions wrong');
  const sum = r.coverage.background + r.coverage.shadows
    + r.coverage.midtones + r.coverage.highlights;
  assertClose(sum, 1, 1e-6, `coverage sum ${sum}`);
});

test('minimum viable size is 16x16 (analyzer paletteSize)', () => {
  // 16x16 = 256 pixels, comfortably above the palette size, so the analyzer
  // terminates and every band is exercised.
  const W = 16, H = 16;
  const px = makeImage(W, H, (x, y) => [
    (x * 16) & 255, (y * 16) & 255, ((x + y) * 8) & 255,
  ]);
  const a = analyzeImage(px, W, H, { structure: false });
  const r = computeTonalMasks(a);
  assert(r.width === W && r.height === H, 'dimensions wrong');
  const sum = r.coverage.background + r.coverage.shadows
    + r.coverage.midtones + r.coverage.highlights;
  assertClose(sum, 1, 1e-3, `coverage sum ${sum}`);
});

test('no NaN in any mask', () => {
  const W = 40, H = 40;
  const px = makeImage(W, H, (x, y) => [
    (x * 7) & 255, (y * 11) & 255, ((x + y) * 5) & 255,
  ]);
  const a = analyzeImage(px, W, H, { structure: false });
  const r = computeTonalMasks(a);
  for (const k of ['background', 'shadows', 'midtones', 'highlights']) {
    assert(!Array.from(r.masks[k]).some(Number.isNaN), `NaN in ${k}`);
  }
});

// ─── Summary ──────────────────────────────────────────────────────
console.log('\n=== Results ===');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(failed === 0 ? '\n✅ All mask tests passed!' : '\n❌ Some mask tests failed.');
process.exit(failed === 0 ? 0 : 1);
