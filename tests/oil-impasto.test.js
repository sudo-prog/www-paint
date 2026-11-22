/**
 * oil-impasto.test.js — Deterministic unit tests for the oil-impasto module.
 *
 * Run with: node tests/oil-impasto.test.js
 *
 * Tests the pure helpers exported from js/engine/oil-impasto.js:
 *   - heightToNormals: Sobel + normal computation
 *   - makeBristleProfile: bristle channel generation
 *   - computeSobel, computeNormals, shadePigment
 *   - Determinism under seeded RNG
 *   - No Math.random usage
 *   - Height does not bleed outside stroke footprint
 */

import { rngFor } from '../js/styles/base.js';
import {
  computeSobel,
  computeNormals,
  shadePigment,
  createBristleProfile,
  depositStroke,
  softenHeight,
  heightToNormals,
  makeBristleProfile,
  createSurface,
  resetSurface,
  DEFAULTS,
} from '../js/engine/oil-impasto.js';
import { readFileSync } from 'fs';

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

// ─── Helpers ─────────────────────────────────────────────────────────────

function makeFlatHeight(w, h, value) {
  const height = new Float32Array(w * h);
  height.fill(value);
  return height;
}

function makeRampHeight(w, h) {
  const height = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      height[y * w + x] = (x / (w - 1)) * 2.0;
    }
  }
  return height;
}

function makePeakHeight(w, h, cx, cy, radius, peak) {
  const height = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d < radius) {
        height[y * w + x] = peak * (1 - d / radius);
      }
    }
  }
  return height;
}

function makePigment(w, h, color = [200, 100, 50]) {
  const pigment = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const pi = i * 4;
    pigment[pi] = color[0];
    pigment[pi + 1] = color[1];
    pigment[pi + 2] = color[2];
    pigment[pi + 3] = 255;
  }
  return pigment;
}

function countNonWhite(pigment, w, h) {
  let count = 0;
  for (let i = 0; i < w * h; i++) {
    const pi = i * 4;
    if (pigment[pi] < 245 || pigment[pi + 1] < 245 || pigment[pi + 2] < 245) count++;
  }
  return count;
}

// Sobel Gx of a linear ramp with per-pixel slope m = 2/(w-1) is 8*m
function sobelRampGx(w) { return 8 * (2.0 / (w - 1)); }

// ─── Tests ───────────────────────────────────────────────────────────────

console.log('\n=== oil-impasto pure helper tests ===\n');

// 1. Sobel gradient computation
console.log('computeSobel:');
test('flat height field → zero gradient', () => {
  const h = makeFlatHeight(16, 16, 1.0);
  const { gx, gy } = computeSobel(h, 16, 16);
  for (let i = 0; i < gx.length; i++) {
    if (gx[i] !== 0 || gy[i] !== 0) {
      throw new Error(`non-zero gradient at ${i}: gx=${gx[i]} gy=${gy[i]}`);
    }
  }
});

test('horizontal ramp → gradient only in Gx', () => {
  const h = makeRampHeight(16, 16);
  const { gx, gy } = computeSobel(h, 16, 16);
  const center = 8 * 16 + 8;
  assertClose(gx[center], sobelRampGx(16), 0.15, 'Gx for horizontal ramp');
  assertClose(gy[center], 0, 0.01, 'Gy for horizontal ramp');
});

test('vertical ramp → gradient only in Gy', () => {
  const h = new Float32Array(16 * 16);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      h[y * 16 + x] = (y / 15) * 2.0;
    }
  }
  const { gx, gy } = computeSobel(h, 16, 16);
  const center = 8 * 16 + 8;
  assertClose(gx[center], 0, 0.01, 'Gx for vertical ramp');
  assertClose(gy[center], sobelRampGx(16), 0.15, 'Gy for vertical ramp');
});

// 2. Normal computation
console.log('\ncomputeNormals:');
test('flat height field → unit normal pointing up', () => {
  const h = makeFlatHeight(16, 16, 1.0);
  const { gx, gy } = computeSobel(h, 16, 16);
  const normals = computeNormals(gx, gy, 16, 16, DEFAULTS.NORMAL_SCALE);
  for (let i = 0; i < 16 * 16; i++) {
    const nx = normals[i * 3];
    const ny = normals[i * 3 + 1];
    const nz = normals[i * 3 + 2];
    const len = Math.hypot(nx, ny, nz);
    assertClose(len, 1.0, 1e-4, `normal ${i} not unit length`);
    assertClose(nx, 0, 1e-4, `normal ${i} x not zero`);
    assertClose(ny, 0, 1e-4, `normal ${i} y not zero`);
    assertClose(nz, 1.0, 1e-4, `normal ${i} z not 1`);
  }
});

test('peak height → normals point outward from peak', () => {
  const h = makePeakHeight(16, 16, 8, 8, 4, 2.0);
  const { gx, gy } = computeSobel(h, 16, 16);
  const normals = computeNormals(gx, gy, 16, 16, DEFAULTS.NORMAL_SCALE);
  const center = 8 * 16 + 8;
  assertClose(normals[center * 3 + 2], 1.0, 0.1, 'center normal z');
  const left = 8 * 16 + 6;
  if (normals[left * 3] <= 0) throw new Error('left normal x should be positive');
  const right = 8 * 16 + 10;
  if (normals[right * 3] >= 0) throw new Error('right normal x should be negative');
});

test('normals are always unit length', () => {
  const h = makeRampHeight(32, 32);
  const { gx, gy } = computeSobel(h, 32, 32);
  const normals = computeNormals(gx, gy, 32, 32, DEFAULTS.NORMAL_SCALE);
  for (let i = 0; i < normals.length / 3; i++) {
    const len = Math.hypot(
      normals[i * 3],
      normals[i * 3 + 1],
      normals[i * 3 + 2]
    );
    assertClose(len, 1.0, 1e-4, `normal ${i} not unit: ${len}`);
  }
});

// 3. Shading
console.log('\nshadePigment:');
test('shaded output has same dimensions and opaque alpha', () => {
  const w = 16, h = 16;
  const pigment = makePigment(w, h, [200, 100, 50]);
  const hfield = makeRampHeight(w, h);
  const { gx, gy } = computeSobel(hfield, w, h);
  const normals = computeNormals(gx, gy, w, h, DEFAULTS.NORMAL_SCALE);
  const shaded = shadePigment(pigment, normals, w, h);
  assert(shaded.length === w * h * 4, 'output length wrong');
  for (let i = 3; i < shaded.length; i += 4) {
    assert(shaded[i] === 255, `alpha not 255 at ${i}`);
  }
});

test('shading changes pixel values from flat color', () => {
  const w = 16, h = 16;
  const pigment = makePigment(w, h, [200, 100, 50]);
  const hfield = makeRampHeight(w, h);
  const { gx, gy } = computeSobel(hfield, w, h);
  const normals = computeNormals(gx, gy, w, h, DEFAULTS.NORMAL_SCALE);
  const shaded = shadePigment(pigment, normals, w, h);
  let different = 0;
  for (let i = 0; i < w * h; i++) {
    const pi = i * 4;
    if (shaded[pi] !== 200 || shaded[pi + 1] !== 100 || shaded[pi + 2] !== 50) {
      different++;
    }
  }
  if (different === 0) throw new Error('shading produced identical output to flat pigment');
});

test('shading is deterministic for same inputs', () => {
  const w = 16, h = 16;
  const pigment = makePigment(w, h, [200, 100, 50]);
  const hfield = makeRampHeight(w, h);
  const { gx, gy } = computeSobel(hfield, w, h);
  const normals = computeNormals(gx, gy, w, h, DEFAULTS.NORMAL_SCALE);
  const shaded1 = shadePigment(pigment, normals, w, h);
  const shaded2 = shadePigment(pigment, normals, w, h);
  for (let i = 0; i < shaded1.length; i++) {
    if (shaded1[i] !== shaded2[i]) {
      throw new Error(`shading not deterministic at ${i}: ${shaded1[i]} vs ${shaded2[i]}`);
    }
  }
});

// 4. Bristle profile
console.log('\ncreateBristleProfile / makeBristleProfile:');
test('profile has correct count and structure', () => {
  const R = rngFor([1, 2, 3, 4, 5, 6]);
  const profile = createBristleProfile(10, R, 12, 0.5);
  assert(profile.length >= 4 && profile.length <= 16, `bristle count ${profile.length} out of range`);
  for (const br of profile) {
    assert(typeof br.lo === 'number', 'missing lo');
    assert(typeof br.hi === 'number', 'missing hi');
    assert(br.lo >= 0 && br.lo <= 1, 'lo out of range');
    assert(br.hi >= 0 && br.hi <= 1, 'hi out of range');
    assert(br.hi > br.lo, 'hi <= lo');
    assert(typeof br.heightMul === 'number', 'missing heightMul');
    assert(typeof br.pigmentMul === 'number', 'missing pigmentMul');
    assert(typeof br.offset === 'number', 'missing offset');
    assert(typeof br.dryEnd === 'number', 'missing dryEnd');
    assert(typeof br.tone === 'number', 'missing tone');
  }
});

test('profile is deterministic for same seed', () => {
  const R1 = rngFor([1, 2, 3, 4, 5, 6]);
  const R2 = rngFor([1, 2, 3, 4, 5, 6]);
  const p1 = createBristleProfile(10, R1, 12, 0.5);
  const p2 = createBristleProfile(10, R2, 12, 0.5);
  assert(p1.length === p2.length, 'profile length differs');
  for (let i = 0; i < p1.length; i++) {
    assertClose(p1[i].lo, p2[i].lo, 1e-9, `bristle ${i} lo differs`);
    assertClose(p1[i].hi, p2[i].hi, 1e-9, `bristle ${i} hi differs`);
    assertClose(p1[i].heightMul, p2[i].heightMul, 1e-9, `bristle ${i} heightMul differs`);
    assertClose(p1[i].pigmentMul, p2[i].pigmentMul, 1e-9, `bristle ${i} pigmentMul differs`);
    assertClose(p1[i].offset, p2[i].offset, 1e-9, `bristle ${i} offset differs`);
    assertClose(p1[i].dryEnd, p2[i].dryEnd, 1e-9, `bristle ${i} dryEnd differs`);
    assertClose(p1[i].tone, p2[i].tone, 1e-9, `bristle ${i} tone differs`);
  }
});

test('makeBristleProfile (pure helper) works', () => {
  const profile = makeBristleProfile(10, [1, 2, 3, 4, 5, 6]);
  assert(profile.length > 0, 'empty profile');
  for (const br of profile) {
    assert(br.lo < br.hi, 'invalid bristle bounds');
  }
});

// 5. depositStroke
console.log('\ndepositStroke:');
test('depositStroke writes pigment and height within stroke bounds', () => {
  const w = 64, h = 64;
  const surface = createSurface(w, h);
  const R = rngFor([10, 20, 30, 40, 50, 60]);
  
  const shape = {
    type: 'S',
    params: [10, 32, 32, 32, 54, 32, 8, 0, '#ff8800', '#ff4400', 1],
    seed: [10, 20, 30, 40, 50, 60],
  };
  
  depositStroke(surface, shape, R);
  
  const ink = countNonWhite(surface.pigment, w, h);
  assert(ink > 0, 'no pigment deposited');
  
  let maxHeight = 0;
  for (let i = 0; i < surface.heightField.length; i++) {
    if (surface.heightField[i] > maxHeight) maxHeight = surface.heightField[i];
  }
  assert(maxHeight > 0, 'no height deposited');
  assert(maxHeight <= DEFAULTS.HEIGHT_SCALE + 1e-4, `height exceeds scale: ${maxHeight}`);
});

test('height does not bleed outside stroke footprint (y-range check)', () => {
  const w = 64, h = 64;
  const surface = createSurface(w, h);
  const R = rngFor([10, 20, 30, 40, 50, 60]);
  
  const shape = {
    type: 'S',
    params: [10, 32, 32, 32, 54, 32, 8, 0, '#ff8800', '#ff4400', 1],
    seed: [10, 20, 30, 40, 50, 60],
  };
  
  depositStroke(surface, shape, R);
  
  const strokeY = 32;
  const radius = 8;
  for (let y = 0; y < h; y++) {
    if (Math.abs(y - strokeY) > radius + 4) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        if (surface.heightField[idx] > 0) {
          throw new Error(`height bleed at (${x},${y}) far from stroke: ${surface.heightField[idx]}`);
        }
      }
    }
  }
});

test('pigment does not bleed outside stroke footprint (x-range check)', () => {
  const w = 128, h = 64;
  const surface = createSurface(w, h);
  const R = rngFor([10, 20, 30, 40, 50, 60]);
  
  const shape = {
    type: 'S',
    params: [10, 32, 32, 32, 54, 32, 8, 0, '#ff8800', '#ff4400', 1],
    seed: [10, 20, 30, 40, 50, 60],
  };
  
  depositStroke(surface, shape, R);
  
  // Check columns far from stroke center (x > 70) have no pigment
  for (let x = 70; x < w; x++) {
    for (let y = 0; y < h; y++) {
      const idx = y * w + x;
      const pi = idx * 4;
      if (surface.pigment[pi] > 0 || surface.pigment[pi + 1] > 0 || surface.pigment[pi + 2] > 0) {
        throw new Error(`pigment bleed at (${x},${y}) far from stroke`);
      }
    }
  }
});

test('depositStroke is deterministic for same seed', () => {
  const w = 64, h = 64;
  const surface1 = createSurface(w, h);
  const surface2 = createSurface(w, h);
  const R1 = rngFor([10, 20, 30, 40, 50, 60]);
  const R2 = rngFor([10, 20, 30, 40, 50, 60]);
  
  const shape = {
    type: 'S',
    params: [10, 32, 32, 32, 54, 32, 8, 0, '#ff8800', '#ff4400', 1],
    seed: [10, 20, 30, 40, 50, 60],
  };
  
  depositStroke(surface1, shape, R1);
  depositStroke(surface2, shape, R2);
  
  for (let i = 0; i < w * h; i++) {
    if (surface1.heightField[i] !== surface2.heightField[i]) {
      throw new Error(`height field differs at ${i}: ${surface1.heightField[i]} vs ${surface2.heightField[i]}`);
    }
  }
  
  for (let i = 0; i < w * h * 4; i++) {
    if (surface1.pigment[i] !== surface2.pigment[i]) {
      throw new Error(`pigment differs at ${i}: ${surface1.pigment[i]} vs ${surface2.pigment[i]}`);
    }
  }
});

// 6. Surface management
console.log('\nSurface management:');
test('createSurface produces correctly sized buffers', () => {
  const surface = createSurface(32, 24);
  assert(surface.width === 32 && surface.height === 24, 'dimensions wrong');
  assert(surface.pigment.length === 32 * 24 * 4, 'pigment length wrong');
  assert(surface.heightField.length === 32 * 24, 'heightField length wrong');
  for (let i = 0; i < surface.pigment.length; i++) {
    if (surface.pigment[i] !== 0) throw new Error('pigment not zero-initialized');
  }
  for (let i = 0; i < surface.heightField.length; i++) {
    if (surface.heightField[i] !== 0) throw new Error('heightField not zero-initialized');
  }
});

test('resetSurface clears buffers', () => {
  const surface = createSurface(16, 16);
  surface.pigment.fill(128);
  surface.heightField.fill(2.0);
  resetSurface(surface);
  for (let i = 0; i < surface.pigment.length; i++) {
    if (surface.pigment[i] !== 0) throw new Error('pigment not reset');
  }
  for (let i = 0; i < surface.heightField.length; i++) {
    if (surface.heightField[i] !== 0) throw new Error('heightField not reset');
  }
});

// 7. Source scan
console.log('\nSource scan:');
test('oil-impasto.js contains no Math.random', () => {
  const content = readFileSync('/home/thinkpad/Data/20_Projects/20.36_WWW_PAINT/js/engine/oil-impasto.js', 'utf8');
  if (content.includes('Math.random(')) {
    throw new Error('Math.random found in oil-impasto.js source');
  }
  if (!content.includes('rngFor')) {
    throw new Error('rngFor not found in oil-impasto.js source');
  }
});

// 8. Softening
console.log('\nsoftenHeight:');
test('softenHeight smooths a sharp peak', () => {
  const w = 16, h = 16;
  const hfield = makePeakHeight(w, h, 8, 8, 3, 2.0);
  const center = 8 * w + 8;
  const before = hfield[center];
  const soft = softenHeight(hfield, w, h, 1);
  const after = soft[center];
  if (after >= before) throw new Error(`softening did not reduce center: ${before} -> ${after}`);
  if (after < before * 0.5) throw new Error(`softening reduced too much: ${before} -> ${after}`);
});

test('softenHeight preserves flat fields', () => {
  const w = 16, h = 16;
  const hfield = makeFlatHeight(w, h, 1.0);
  const soft = softenHeight(hfield, w, h, 2);
  for (let i = 0; i < w * h; i++) {
    assertClose(soft[i], 1.0, 1e-4, `flat field changed at ${i}: ${soft[i]}`);
  }
});

// 9. Height-to-normals pipeline
console.log('\nheightToNormals (pipeline):');
test('heightToNormals is deterministic', () => {
  const hfield = makeRampHeight(32, 32);
  const n1 = heightToNormals(hfield, 32, 32);
  const n2 = heightToNormals(hfield, 32, 32);
  for (let i = 0; i < n1.length; i++) {
    if (n1[i] !== n2[i]) {
      throw new Error(`heightToNormals not deterministic at ${i}: ${n1[i]} vs ${n2[i]}`);
    }
  }
});

test('heightToNormals produces unit normals', () => {
  const hfield = makePeakHeight(32, 32, 16, 16, 8, 2.0);
  const normals = heightToNormals(hfield, 32, 32, DEFAULTS.NORMAL_SCALE);
  for (let i = 0; i < 32 * 32; i++) {
    const len = Math.hypot(normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2]);
    assertClose(len, 1.0, 1e-4, `normal ${i} not unit: ${len}`);
  }
});

// 10. End-to-end with a stroke
console.log('\nEnd-to-end stroke:');
test('full pipeline: deposit → soften → normals → shade', () => {
  const w = 128, h = 128;
  const surface = createSurface(w, h);
  const R = rngFor([100, 200, 300, 400, 500, 600]);
  
  const shape = {
    type: 'S',
    params: [20, 64, 64, 32, 108, 64, 16, 0, '#c44030', '#c44030', 1],
    seed: [100, 200, 300, 400, 500, 600],
  };
  
  depositStroke(surface, shape, R);
  
  const softHeight = softenHeight(surface.heightField, w, h, 1);
  const { gx, gy } = computeSobel(softHeight, w, h);
  const normals = computeNormals(gx, gy, w, h, DEFAULTS.NORMAL_SCALE);
  const shaded = shadePigment(surface.pigment, normals, w, h);
  
  let ink = 0;
  for (let i = 0; i < w * h; i++) {
    const pi = i * 4;
    if (shaded[pi] < 245 || shaded[pi + 1] < 245 || shaded[pi + 2] < 245) ink++;
  }
  assert(ink > 0, 'full pipeline produced no ink');
  
  const surface2 = createSurface(w, h);
  const R2 = rngFor([100, 200, 300, 400, 500, 600]);
  depositStroke(surface2, shape, R2);
  const softHeight2 = softenHeight(surface2.heightField, w, h, 1);
  const { gx: gx2, gy: gy2 } = computeSobel(softHeight2, w, h);
  const normals2 = computeNormals(gx2, gy2, w, h, DEFAULTS.NORMAL_SCALE);
  const shaded2 = shadePigment(surface2.pigment, normals2, w, h);
  
  for (let i = 0; i < shaded.length; i++) {
    if (shaded[i] !== shaded2[i]) {
      throw new Error(`full pipeline not deterministic at ${i}: ${shaded[i]} vs ${shaded2[i]}`);
    }
  }
});

// ─── Summary ──────────────────────────────────────────────────────────────
console.log('\n=== Results ===');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(failed === 0 ? '\n✅ All oil-impasto tests passed!' : '\n❌ Some oil-impasto tests failed.');
process.exit(failed === 0 ? 0 : 1);