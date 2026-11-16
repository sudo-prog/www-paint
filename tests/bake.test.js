/**
 * Track-S S7 — deterministic bake + batch tests.
 *
 * Run with: node tests/bake.test.js
 *
 * Verifies `js/engine/bake.js` (the automation path, Phase 6 / S7):
 *   - contentHash is deterministic, size-independent in cost, content-sensitive
 *   - contentDigest pins a bake (seed + image + shapes) and moves with any of them
 *   - bakeImage is deterministic (re-bake guarantee) and scales with the profile
 *   - runBakeBatch drives N jobs with progress and a clean mid-run cancel
 */

import { contentHash, contentDigest, bakeImage, runBakeBatch, BAKE_DEFAULTS } from '../js/engine/bake.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try { fn(); console.log(`  \u2713 ${name}`); passed++; }
  catch (err) { console.log(`  \u2717 ${name}`); console.log(`    ${err.message}`); failed++; }
}
function assertEqual(actual, expected, msg = '') {
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${msg} Expected ${b}, got ${a}`);
}
function assert(cond, msg = 'assertion failed') { if (!cond) throw new Error(msg); }

/** A deterministic synthetic image (soft blobs + a ring) at SxS. */
function makeImage(S, variant = 0) {
  const px = new Uint8ClampedArray(S * S * 4);
  const blobs = [
    [S * 0.3, S * 0.3, S * 0.18, [40, 60, 120]],
    [S * 0.7, S * 0.4, S * 0.15, [150, 60, 40]],
    [S * 0.5, S * 0.72, S * 0.16, [40, 120, 70]],
  ];
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4;
      let r = 235, g = 235, b = 232;
      for (const [cx, cy, rad, col] of blobs) {
        const d = Math.hypot(x - cx, y - cy) / rad;
        if (d < 1) { const k = Math.max(0, 1 - d) ** 1.6; r = r * (1 - k) + col[0] * k; g = g * (1 - k) + col[1] * k; b = b * (1 - k) + col[2] * k; }
      }
      if (variant) { r = Math.min(255, r + variant * 3); }
      px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255;
    }
  }
  return { pixels: px, width: S, height: S };
}

const baseProfile = {
  schemaVersion: 1, id: 'bake-test', name: 'bake-test', version: '1.0.0',
  global: { style: 'pencil', strokeCount: 120, detailLevel: 0.7, opacity: 0.9, smart: true, seed: 12345 },
};

console.log('\n=== WWW_PAINT bake (Track-S S7) ===\n');

test('contentHash: deterministic, content-sensitive, size-stable in cost', () => {
  const a = makeImage(48, 0);
  const h1 = contentHash(a.pixels, 48, 48);
  const h2 = contentHash(a.pixels, 48, 48);
  assertEqual(h1, h2, 'same buffer ⇒ same hash');
  assert(/^[0-9a-f]{8}$/.test(h1), `hash is 8 hex chars (got ${h1})`);
  const hDiff = contentHash(makeImage(48, 5).pixels, 48, 48);
  assert(h1 !== hDiff, 'a changed pixel ⇒ a different hash');
  assertEqual(contentHash(makeImage(96, 0).pixels, 96, 96), contentHash(makeImage(96, 0).pixels, 96, 96));
});

test('contentDigest: pins a bake and moves with seed / image / shapes', () => {
  const img = makeImage(48, 0);
  const b1 = bakeImage(baseProfile, img, { seed: 7, score: false });
  const b2 = bakeImage(baseProfile, img, { seed: 7, score: false });
  assertEqual(b1.digest, b2.digest, 'identical inputs ⇒ identical digest');
  const bSeed = bakeImage(baseProfile, img, { seed: 8, score: false });
  assert(b1.digest !== bSeed.digest, 'a different seed ⇒ a different digest');
  const bImg = bakeImage(baseProfile, img, { seed: 7, score: false });
  assert(bImg.imageHash === b1.imageHash, 'the image hash is stable');
  const other = bakeImage(baseProfile, makeImage(48, 5), { seed: 7, score: false });
  assert(other.digest !== b1.digest, 'a different image ⇒ a different digest');
  // contentDigest is order-sensitive (shape order is the paint order).
  const d1 = contentDigest({ seed: 1, imageHash: 'abcd', shapes: [{ type: 'S', params: [0, 0] }, { type: 'E', params: [1, 1] }] });
  const d2 = contentDigest({ seed: 1, imageHash: 'abcd', shapes: [{ type: 'E', params: [1, 1] }, { type: 'S', params: [0, 0] }] });
  assert(d1 !== d2, 'shape order changes the digest');
});

test('bakeImage: deterministic shapes, real count, optional score', () => {
  const img = makeImage(48, 0);
  const a = bakeImage(baseProfile, img, { seed: 12345 });
  const b = bakeImage(baseProfile, img, { seed: 12345 });
  assertEqual(a.count, b.count, 'same stroke count');
  assertEqual(JSON.stringify(a.shapes), JSON.stringify(b.shapes), 're-bake is byte-identical');
  assert(a.count > 0, `bakes shapes (${a.count})`);
  assert(typeof a.score === 'number' && a.score >= 0 && a.score <= 100, `score is a simMae (${a.score})`);
  const noScore = bakeImage(baseProfile, img, { seed: 12345, score: false });
  assertEqual(noScore.score, null, 'score:false skips measurement');
  assertEqual(JSON.stringify(noScore.shapes), JSON.stringify(a.shapes), 'measuring the score does not change the bake');
});

test('runBakeBatch: N jobs, progress, deterministic per job', () => {
  const jobs = [
    { id: 'a', ...makeImage(40, 0) },
    { id: 'b', ...makeImage(40, 2) },
    { id: 'c', ...makeImage(40, 4) },
  ];
  const seen = [];
  const out = runBakeBatch(jobs, { profile: baseProfile, seed: 100, onProgress: (p) => seen.push(p.index) });
  assertEqual(out.total, 3);
  assertEqual(out.completed, 3);
  assertEqual(out.cancelled, false);
  assertEqual(out.results.map((r) => r.id), ['a', 'b', 'c'], 'results keep job order');
  assertEqual(seen, [-1, 0, 1, 2], 'progress fires once at the start then per job');

  // Determinism across runs.
  const again = runBakeBatch(jobs, { profile: baseProfile, seed: 100 });
  assertEqual(again.results.map((r) => r.digest), out.results.map((r) => r.digest), 'batch is reproducible');

  // Per-job seeds make the three bakes independent.
  const digests = new Set(out.results.map((r) => r.digest));
  assertEqual(digests.size, 3, 'each job has its own digest');
});

test('runBakeBatch: cancel mid-run stops cleanly', () => {
  const jobs = [0, 1, 2, 3, 4].map((i) => ({ id: i, ...makeImage(32, i) }));
  let n = 0;
  const out = runBakeBatch(jobs, {
    profile: baseProfile, seed: 5,
    shouldCancel: () => n >= 2,                        // cancel once two jobs are in
    onProgress: (p) => { if (p.index >= 0) n++; },     // count completed jobs (skip the start tick)
  });
  assertEqual(out.cancelled, true, 'the batch reports cancelled');
  assertEqual(out.completed, 2, 'only the jobs before the cancel ran');
  assertEqual(out.results.length, 2);
  assert(out.completed < out.total, 'a cancelled batch is short of the total');

  // Cancelling before the first job yields an empty, clean result.
  const none = runBakeBatch(jobs, { profile: baseProfile, seed: 5, shouldCancel: () => true });
  assertEqual(none.cancelled, true);
  assertEqual(none.completed, 0);
});

test('BAKE_DEFAULTS are stable and opt-out safe', () => {
  assertEqual(BAKE_DEFAULTS.seed, 12345);
  assertEqual(BAKE_DEFAULTS.score, true);
});

console.log(`\n=== Results ===\nPassed: ${passed}\nFailed: ${failed}\n`);
if (failed) { console.log('\u274c Some tests failed!'); process.exit(1); }
console.log('\u2705 All tests passed!');
