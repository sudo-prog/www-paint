/**
 * Outline extraction tests (Round 2, M7 — IF-3).
 *
 * Run with: node tests/outlines.test.js
 *
 * Verifies edge-following outline extraction on plain typed buffers — no DOM,
 * no canvas, so it runs in bare Node:
 *   - the frozen IF-3 return shape
 *   - a synthetic square / ring yields outlines that hug their edges
 *   - deterministic; largest-first; threshold sensitivity
 *   - open polylines carry a strength in [0, 1]
 *   - no outlines on a flat or noisy field
 */

import { analyzeImage } from '../js/engine/analyzer.js';
import { extractOutlines, OUTLINE_DEFAULTS } from '../js/engine/outlines.js';

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
      px[i] = Math.max(0, Math.min(255, Math.round(r)));
      px[i + 1] = Math.max(0, Math.min(255, Math.round(g)));
      px[i + 2] = Math.max(0, Math.min(255, Math.round(b)));
      px[i + 3] = 255;
    }
  }
  return px;
}

/** Solid mid-grey — no edges anywhere. */
function flatImage(w, h) {
  return makeImage(w, h, () => [128, 128, 128]);
}

/**
 * A white square of side `side` centred in a black field.
 * The square's edge is a real luminance step, so Sobel finds it.
 */
function squareImage(w, h, side) {
  const x0 = Math.floor((w - side) / 2);
  const y0 = Math.floor((h - side) / 2);
  const x1 = x0 + side - 1;
  const y1 = y0 + side - 1;
  return makeImage(w, h, (x, y) => {
    const inside = x >= x0 && x <= x1 && y >= y0 && y <= y1;
    return inside ? [255, 255, 255] : [0, 0, 0];
  });
}

/** The square's geometry, for asserting that extracted points hug the edge. */
function squareEdge(side, w, h) {
  const x0 = Math.floor((w - side) / 2);
  const y0 = Math.floor((h - side) / 2);
  return { x0, y0, x1: x0 + side - 1, y1: y0 + side - 1 };
}

console.log('\nOutline extraction (IF-3):\n');

// ─── IF-3 return shape ────────────────────────────────────────────

test('returns the frozen IF-3 shape with an outlines array', () => {
  const W = 48, H = 48, side = 28;
  const px = squareImage(W, H, side);
  const an = analyzeImage(px, W, H, { structure: false });
  const r = extractOutlines(an);
  assert(Array.isArray(r.outlines), 'outlines is not an array');
  assertEqual(r.width, W, 'width');
  assertEqual(r.height, H, 'height');
});

test('returns an empty list for a flat field', () => {
  const W = 32, H = 32;
  const an = analyzeImage(flatImage(W, H), W, H, { structure: false });
  const r = extractOutlines(an);
  assertEqual(r.outlines.length, 0, 'flat field yielded outlines');
});

// ─── A square yields an outline that hugs its edge ────────────────

test('a square yields at least one outline', () => {
  const W = 64, H = 64, side = 32;
  const px = squareImage(W, H, side);
  const an = analyzeImage(px, W, H, { structure: false });
  const r = extractOutlines(an, { minLength: 8 });
  assert(r.outlines.length >= 1, `expected >= 1 outline, got ${r.outlines.length}`);
});

test('the square outline hugs all four edges of the square', () => {
  const W = 64, H = 64, side = 32;
  const px = squareImage(W, H, side);
  const an = analyzeImage(px, W, H, { structure: false });
  const r = extractOutlines(an, { minLength: 8 });
  const e = squareEdge(side, W, H);

  // For each side of the square, some outline point must sit on it (within 1px).
  const TOL = 1.5;
  const near = (v, target) => Math.abs(v - target) <= TOL;
  const top = r.outlines.some(o => o.points.some(p => near(p[1], e.y0)));
  const bottom = r.outlines.some(o => o.points.some(p => near(p[1], e.y1)));
  const left = r.outlines.some(o => o.points.some(p => near(p[0], e.x0)));
  const right = r.outlines.some(o => o.points.some(p => near(p[0], e.x1)));
  assert(top, `no outline point on the top edge y=${e.y0}`);
  assert(bottom, `no outline point on the bottom edge y=${e.y1}`);
  assert(left, `no outline point on the left edge x=${e.x0}`);
  assert(right, `no outline point on the right edge x=${e.x1}`);
});

test('the outline stays on the square boundary (no interior detour)', () => {
  const W = 64, H = 64, side = 32;
  const px = squareImage(W, H, side);
  const an = analyzeImage(px, W, H, { structure: false });
  const r = extractOutlines(an, { minLength: 8 });
  const e = squareEdge(side, W, H);
  const m = 2; // tolerance for pixel quantisation

  // Every point must lie on (or just outside) one of the four boundary lines,
  // and within the square's span. A point deep inside means the walk strayed.
  for (const o of r.outlines) {
    for (const [x, y] of o.points) {
      const onBoundary =
        Math.abs(x - e.x0) <= m || Math.abs(x - e.x1) <= m ||
        Math.abs(y - e.y0) <= m || Math.abs(y - e.y1) <= m;
      assert(onBoundary, `point (${x},${y}) is not on the square boundary`);
      assert(
        x >= e.x0 - m && x <= e.x1 + m && y >= e.y0 - m && y <= e.y1 + m,
        `point (${x},${y}) outside the square span`,
      );
    }
  }
});

test('outlines are returned largest-first', () => {
  const W = 80, H = 80;
  // Two squares of different sizes => at least two closed loops.
  const x0a = 8, y0a = 8, sa = 40;   // large
  const x0b = 58, y0b = 58, sb = 12; // small
  const px = makeImage(W, H, (x, y) => {
    const inA = x >= x0a && x < x0a + sa && y >= y0a && y < y0a + sa;
    const inB = x >= x0b && x < x0b + sb && y >= y0b && y < y0b + sb;
    return inA || inB ? [255, 255, 255] : [0, 0, 0];
  });
  const an = analyzeImage(px, W, H, { structure: false });
  const r = extractOutlines(an, { minLength: 8 });
  assert(r.outlines.length >= 2, `expected >= 2 outlines, got ${r.outlines.length}`);
  for (let i = 1; i < r.outlines.length; i++) {
    assert(
      r.outlines[i - 1].points.length >= r.outlines[i].points.length,
      `outlines not largest-first at index ${i}: ${r.outlines[i - 1].points.length} then ${r.outlines[i].points.length}`,
    );
  }
});

// ─── Contract details ─────────────────────────────────────────────

test('strength is in [0, 1] and minLength is honoured', () => {
  const W = 64, H = 64, side = 32;
  const px = squareImage(W, H, side);
  const an = analyzeImage(px, W, H, { structure: false });
  const r = extractOutlines(an, { minLength: 8 });
  assert(r.outlines.length > 0, 'no outlines to inspect');
  for (const o of r.outlines) {
    assert(o.strength >= 0 && o.strength <= 1, `strength out of range: ${o.strength}`);
    assert(o.points.length >= 8, `outline shorter than minLength: ${o.points.length}`);
    for (const p of o.points) {
      assert(p.length === 2, 'point is not a [x, y] pair');
      assert(Number.isFinite(p[0]) && Number.isFinite(p[1]), `non-finite point ${p}`);
    }
  }
});

test('deterministic for the same input', () => {
  const W = 64, H = 64, side = 32;
  const px = squareImage(W, H, side);
  const an = analyzeImage(px, W, H, { structure: false });
  const a = extractOutlines(an, { minLength: 8 });
  const b = extractOutlines(an, { minLength: 8 });
  assertEqual(a, b, 'two runs differ');
});

test('threshold is sensitive: a high threshold yields fewer outlines', () => {
  const W = 64, H = 64, side = 32;
  const px = squareImage(W, H, side);
  const an = analyzeImage(px, W, H, { structure: false });
  const low = extractOutlines(an, { threshold: 0.05, minLength: 8 });
  const high = extractOutlines(an, { threshold: 0.95, minLength: 8 });
  assert(
    high.outlines.length <= low.outlines.length,
    `high threshold yielded more outlines (${high.outlines.length} > ${low.outlines.length})`,
  );
});

test('pure noise yields no outlines above the strength floor', () => {
  const W = 32, H = 32;
  let s = 987654321;
  const rnd = () => { s = (1103515245 * s + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const px = makeImage(W, H, () => [rnd() * 255, rnd() * 255, rnd() * 255]);
  const an = analyzeImage(px, W, H, { structure: false });

  // A random field has no coherent contour: any walk it does produce is short
  // and its mean edge magnitude is weak. The strength floor (not the length
  // floor) is what rejects it — a length-only test passes on 79-point noise
  // walks, which is the trap this assertion exists to catch.
  const r = extractOutlines(an, { minLength: 8, minStrength: 0.7 });
  assertEqual(r.outlines.length, 0, 'noise yielded strong outlines');
});

test('the strength floor separates a real contour from noise', () => {
  const W = 64, H = 64, side = 32;
  const px = squareImage(W, H, side);
  const an = analyzeImage(px, W, H, { structure: false });
  const r = extractOutlines(an, { minLength: 8, minStrength: 0.7 });
  assert(r.outlines.length >= 1, 'the square contour was rejected by the strength floor');
  assert(
    r.outlines[0].strength > 0.7,
    `square contour strength ${r.outlines[0].strength} did not clear the floor`,
  );
});

test('every point is inside the image bounds', () => {
  const W = 64, H = 64, side = 32;
  const px = squareImage(W, H, side);
  const an = analyzeImage(px, W, H, { structure: false });
  const r = extractOutlines(an, { minLength: 8 });
  for (const o of r.outlines) {
    for (const [x, y] of o.points) {
      assert(x >= 0 && x < W, `x out of bounds: ${x}`);
      assert(y >= 0 && y < H, `y out of bounds: ${y}`);
    }
  }
});

test('respects maxOutlines', () => {
  const W = 80, H = 80;
  const px = makeImage(W, H, (x, y) => {
    const inA = x >= 8 && x < 48 && y >= 8 && y < 48;
    const inB = x >= 58 && x < 70 && y >= 58 && y < 70;
    return inA || inB ? [255, 255, 255] : [0, 0, 0];
  });
  const an = analyzeImage(px, W, H, { structure: false });
  const r = extractOutlines(an, { minLength: 8, maxOutlines: 1 });
  assert(r.outlines.length <= 1, `maxOutlines not honoured: ${r.outlines.length}`);
});

test('covers the whole square boundary, not just three of four edges', () => {
  // Regression: an earlier walk shared one global visited set, so the second
  // walk died at its first step and the square's left edge went untraced.
  const W = 64, H = 64, side = 32;
  const px = squareImage(W, H, side);
  const an = analyzeImage(px, W, H, { structure: false });
  const r = extractOutlines(an, { minLength: 8, minStrength: 0.3 });
  const e = squareEdge(side, W, H);
  const got = new Set();
  for (const o of r.outlines) for (const [x, y] of o.points) got.add(y * W + x);

  const expected = new Set();
  for (let x = e.x0; x <= e.x1; x++) { expected.add(e.y0 * W + x); expected.add(e.y1 * W + x); }
  for (let y = e.y0; y <= e.y1; y++) { expected.add(y * W + e.x0); expected.add(y * W + e.x1); }

  let hit = 0;
  for (const j of expected) if (got.has(j)) hit++;
  assertEqual(hit, expected.size, `boundary coverage ${hit}/${expected.size}`);
});

test('does not return duplicate copies of the same contour', () => {
  // Regression: after the walk fix, every seed re-walked the same closed loop,
  // producing 64 near-identical outlines. Duplicate = >=80% shared pixels.
  const W = 200, H = 200;
  const px = makeImage(W, H, (x, y) => {
    const inSquare = x >= 40 && x < 110 && y >= 40 && y < 110;
    return inSquare ? [235, 235, 235] : [28, 28, 28];
  });
  const an = analyzeImage(px, W, H, { structure: false });
  const r = extractOutlines(an, { minLength: 10, minStrength: 0.3 });

  const sets = r.outlines.map(o => new Set(o.points.map(p => p[1] * W + p[0])));
  let dups = 0;
  for (let i = 0; i < sets.length; i++) {
    for (let j = 0; j < i; j++) {
      let shared = 0;
      for (const k of sets[i]) if (sets[j].has(k)) shared++;
      if (sets[i].size > 0 && shared / sets[i].size >= 0.8) dups++;
    }
  }
  assertEqual(dups, 0, `found ${dups} duplicate contour pair(s)`);
});

test('default options are exposed and sane', () => {
  assertEqual(typeof OUTLINE_DEFAULTS.threshold, 'number');
  assert(OUTLINE_DEFAULTS.minLength >= 1, 'minLength must be >= 1');
  assert(OUTLINE_DEFAULTS.maxOutlines >= 1, 'maxOutlines must be >= 1');
});

// ─── Summary ──────────────────────────────────────────────────────
console.log('\n=== Results ===');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(failed === 0 ? '\n✅ All outline tests passed!' : '\n❌ Some outline tests failed.');
process.exit(failed === 0 ? 0 : 1);
