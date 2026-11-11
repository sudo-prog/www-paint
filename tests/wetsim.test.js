/**
 * Wet-media simulation tests (Phase 3, IF-2).
 *
 * Run with: node tests/wetsim.test.js
 *
 * Verifies the wetness/pigment model on plain typed arrays — no DOM, no
 * canvas, so it runs in bare Node:
 *   - determinism under a fixed seed
 *   - pigment mass conservation on dry frames
 *   - water gating (pigment only moves where water exists)
 *   - drying actually dries
 *   - compositeInto / toRGBA produce RGBA output
 */

import { createWetSim } from '../js/engine/wetsim.js';

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

function makeRGBImage(w, h, fn) {
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

console.log('\nWetSim (Phase 3):');

test('constructor returns IF-2 shape with typed arrays', () => {
  const s = createWetSim(32, 24, { seed: 1 });
  assert(s.width === 32 && s.height === 24, 'dimensions wrong');
  assert(s.wetness instanceof Float32Array, 'wetness not Float32Array');
  assert(s.paperHeight instanceof Float32Array, 'paperHeight field not Float32Array');
  assert(s.wetness.length === 32 * 24, 'wetness length wrong');
  assert(s.paperHeight.length === 32 * 24, 'paperHeight length wrong');
  assert(typeof s.deposit === 'function', 'deposit missing');
  assert(typeof s.dry === 'function', 'dry missing');
  assert(typeof s.compositeInto === 'function', 'compositeInto missing');
});

test('deterministic under a fixed seed', () => {
  const a = createWetSim(48, 48, { seed: 7 });
  const b = createWetSim(48, 48, { seed: 7 });
  a.deposit(24, 24, 8, [200, 40, 20], { amount: 1.2, water: 0.9 });
  b.deposit(24, 24, 8, [200, 40, 20], { amount: 1.2, water: 0.9 });
  for (let i = 0; i < 12; i++) { a.dry(0.1); b.dry(0.1); }
  assert(a.wetness.length === b.wetness.length, 'length mismatch');
  let identical = true;
  for (let i = 0; i < a.wetness.length; i++) {
    if (a.wetness[i] !== b.wetness[i] || a.pigment[i * 3] !== b.pigment[i * 3]) {
      identical = false; break;
    }
  }
  assert(identical, 'same seed produced different state');
  assertClose(a.totalMass(), b.totalMass(), 1e-9, 'mass differs');
});

test('different seeds produce different state', () => {
  const a = createWetSim(48, 48, { seed: 7 });
  const c = createWetSim(48, 48, { seed: 8 });
  let differs = false;
  for (let i = 0; i < a.paperHeight.length; i++) {
    if (a.paperHeight[i] !== c.paperHeight[i]) { differs = true; break; }
  }
  assert(differs, 'different seeds gave identical paper relief');
});

test('pigment mass is conserved on a dry frame', () => {
  const s = createWetSim(64, 64, { seed: 11 });
  s.deposit(32, 32, 12, [255, 0, 0], { amount: 3, water: 1 });
  const before = s.totalMass();
  assert(before > 0, 'no pigment deposited');
  let min = Infinity, max = -Infinity;
  // Dry long enough for the frame to fully dry (free water evaporates fast,
  // capillary-held water slowly). Mass must hold across all of it.
  for (let i = 0; i < 240; i++) {
    const r = s.dry(0.1);
    min = Math.min(min, r.total);
    max = Math.max(max, r.total);
  }
  const after = s.totalMass();
  // Float32 accumulation should stay well inside 1e-4 relative.
  assert(Math.abs(after - before) / before < 1e-4, `mass drifted ${(after - before) / before}`);
  assert(max - min < before * 1e-4, 'mass oscillated during drying');
  // Dry frame: wetness should have evaporated.
  const wetMax = Math.max(...s.wetness);
  assert(wetMax < 1e-3, `frame not dry, wetness max ${wetMax}`);
  // And pigment should have largely transferred into the fixed layer.
  assert(s.fixedMass() > 0, 'no pigment fixed into the paper');
});

test('mass conservation holds with transport enabled', () => {
  const s = createWetSim(48, 48, { seed: 5 });
  // Two deposits to create a wetness gradient that drives flow.
  s.deposit(16, 24, 6, [10, 200, 30], { amount: 2, water: 1.4 });
  s.deposit(34, 24, 6, [200, 20, 10], { amount: 2, water: 1.4 });
  const before = s.totalMass();
  for (let i = 0; i < 40; i++) s.dry(0.08);
  const after = s.totalMass();
  assert(Math.abs(after - before) / before < 1e-4, `mass drifted ${(after - before) / before}`);
});

test('pigment does not move into bone-dry regions', () => {
  const s = createWetSim(40, 40, { seed: 9 });
  // Wet only the left half.
  s.deposit(8, 20, 5, [255, 0, 0], { amount: 2, water: 1.2 });
  const beforeRight = s.pigment.slice();
  let rightMassBefore = 0;
  for (let y = 0; y < 40; y++) {
    for (let x = 25; x < 40; x++) {
      const o = (y * 40 + x) * 3;
      rightMassBefore += beforeRight[o] + beforeRight[o + 1] + beforeRight[o + 2];
    }
  }
  assert(rightMassBefore === 0, 'right side should start dry');
  s.dry(0.5);
  let rightMassAfter = 0;
  for (let y = 0; y < 40; y++) {
    for (let x = 25; x < 40; x++) {
      const o = (y * 40 + x) * 3;
      rightMassAfter += s.pigment[o] + s.pigment[o + 1] + s.pigment[o + 2];
    }
  }
  assert(rightMassAfter === 0, `pigment leaked into dry region: ${rightMassAfter}`);
});

test('wet frame bleeds beyond the deposit radius', () => {
  // Two adjacent deposits: the wetter cell must push water outward, so the
  // wet footprint grows past the radius of a single deposit.
  const s = createWetSim(64, 64, { seed: 21 });
  s.deposit(32, 32, 6, [0, 0, 255], { amount: 1, water: 0.4 });
  const afterDeposit = s.wetness.filter((v) => v > 0.01).length;
  s.deposit(40, 32, 6, [0, 0, 255], { amount: 1, water: 2.0 });
  const afterSecond = s.wetness.filter((v) => v > 0.01).length;
  assert(afterSecond > afterDeposit, 'wet footprint did not grow');
  for (let i = 0; i < 4; i++) s.dry(0.05);
  const afterDry = s.wetness.filter((v) => v > 0.01).length;
  assert(afterDry > 0, 'water vanished instantly');
});

test('deposit outside bounds is clamped, not fatal', () => {
  const s = createWetSim(16, 16, { seed: 4 });
  const m = s.deposit(-20, -20, 4, [1, 2, 3], { amount: 1, water: 1 });
  assert(m >= 0, 'negative mass');
  assert(Number.isFinite(m), 'non-finite mass');
  const m2 = s.deposit(100, 100, 4, [1, 2, 3], { amount: 1, water: 1 });
  assert(m2 >= 0 && Number.isFinite(m2), 'out-of-bounds deposit not clamped');
});

test('dry(0) is a no-op', () => {
  const s = createWetSim(24, 24, { seed: 2 });
  s.deposit(12, 12, 5, [9, 9, 9], { amount: 1, water: 1 });
  const w = s.wetness.slice();
  const m = s.totalMass();
  s.dry(0);
  let same = true;
  for (let i = 0; i < w.length; i++) if (w[i] !== s.wetness[i]) { same = false; break; }
  assert(same, 'dry(0) changed wetness');
  assertClose(s.totalMass(), m, 1e-9, 'dry(0) changed mass');
});

test('toRGBA returns RGBA and is deterministic', () => {
  const a = createWetSim(32, 32, { seed: 13 });
  a.deposit(16, 16, 7, [220, 30, 30], { amount: 2, water: 1 });
  const rgba1 = a.toRGBA();
  assert(rgba1 instanceof Uint8ClampedArray, 'not Uint8ClampedArray');
  assert(rgba1.length === 32 * 32 * 4, 'wrong length');
  const rgba2 = a.toRGBA();
  let same = true;
  for (let i = 0; i < rgba1.length; i++) if (rgba1[i] !== rgba2[i]) { same = false; break; }
  assert(same, 'toRGBA not deterministic');
  // Alpha must be opaque.
  for (let i = 3; i < rgba1.length; i += 4) {
    assert(rgba1[i] === 255, 'alpha not 255');
  }
});

test('toRGBA darkens where pigment is deposited', () => {
  const s = createWetSim(32, 32, { seed: 17 });
  const clean = s.toRGBA();
  s.deposit(16, 16, 8, [0, 0, 0], { amount: 4, water: 1 });
  const painted = s.toRGBA();
  const c = (16 * 32 + 16) * 4;
  assert(painted[c] < clean[c], 'deposited black did not darken');
});

test('no NaN after sustained simulation', () => {
  const s = createWetSim(48, 48, { seed: 23 });
  s.deposit(24, 24, 10, [120, 40, 200], { amount: 3, water: 2 });
  s.deposit(10, 10, 5, [200, 200, 40], { amount: 2, water: 1 });
  for (let i = 0; i < 100; i++) s.dry(0.07);
  assert(!Array.from(s.pigment).some(Number.isNaN), 'NaN in pigment');
  assert(!Array.from(s.wetness).some(Number.isNaN), 'NaN in wetness');
  assert(!Array.from(s.paperHeight).some(Number.isNaN), 'NaN in paperHeight');
});

test('compositeInto throws without a context', () => {
  const s = createWetSim(8, 8, { seed: 1 });
  let threw = false;
  try { s.compositeInto(null); } catch (e) { threw = true; }
  assert(threw, 'compositeInto(null) did not throw');
});

test('compositeInto rejects a mismatched context size', () => {
  const s = createWetSim(8, 8, { seed: 1 });
  const fake = { canvas: { width: 16, height: 16 }, putImageData() {} };
  let threw = false;
  try { s.compositeInto(fake); } catch (e) { threw = true; }
  assert(threw, 'mismatched context did not throw');
});

test('paper height field is a seeded relief in [0, heightScale]', () => {
  const s = createWetSim(32, 32, { seed: 31, heightScale: 2 });
  let min = Infinity, max = -Infinity;
  for (const v of s.paperHeight) { if (v < min) min = v; if (v > max) max = v; }
  assert(min >= 0 && max <= 2.0001, `height out of range: ${min}..${max}`);
  const flat = createWetSim(32, 32, { seed: 31, heightScale: 0 });
  let flatMax = 0;
  for (const v of flat.paperHeight) if (v > flatMax) flatMax = v;
  assert(flatMax === 0, 'heightScale 0 did not flatten the paper');
});

// ─── Summary ──────────────────────────────────────────────────────
console.log('\n=== Results ===');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(failed === 0 ? '\n✅ All wet-sim tests passed!' : '\n❌ Some wet-sim tests failed.');
process.exit(failed === 0 ? 0 : 1);
