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
  fuseReferences,
  SCALE_BINS,
  ORIENTATION_BINS,
  REF_DEFAULTS,
  FUSION_DEFAULTS,
} from '../js/engine/ref-analyze.js';
import { refPacketDistance, refPacketMatch } from '../js/engine/metrics.js';
import {
  attachFusedReference, fusedReferenceFromProfile, validateProfile, profileFromSettings,
} from '../js/engine/profile.js';

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

// ── S3: multi-reference fusion ────────────────────────────────────
console.log('');
console.log('S3 — multi-reference fusion');

/**
 * A minimal hand-built RefPacket. Fusion is pure arithmetic on packets, so a
 * synthetic packet is the right fixture here: it is fully deterministic and it
 * pins the arithmetic exactly, which a real image could not.
 */
function synthPacket({ hist, obins, coh, palette = [] }) {
  return {
    version: 1,
    module: 'ref-analyze',
    scaleHistogram: hist,
    orientationField: { binCount: ORIENTATION_BINS, bins: obins, dominant: 0, strength: 0.8 },
    strokeScaleByBand: { background: 0.6, shadows: 0.5, midtones: 0.4, highlights: 0.3 },
    coverage: { background: 0.25, shadows: 0.25, midtones: 0.25, highlights: 0.25 },
    stats: { cells: 81, meanCoherence: coh, meanStrokeScale: 0.5, meanDensity: 0.2, meanLuma: 0.5, meanEnergy: 0.1 },
    styleDNA: { palette, edgeDensity: 0.2, contrast: 0.3, wetnessEstimate: 0.4 },
  };
}
const COARSE = [0, 0, 0, 0, 0, 0, 0, 9];   // all stroke mass in the coarsest bin
const FINEE  = [9, 0, 0, 0, 0, 0, 0, 0];   // all stroke mass in the finest bin
const O0 = new Array(ORIENTATION_BINS).fill(0); O0[0] = 1;
const REF_A  = synthPacket({ hist: COARSE, obins: O0, coh: 0.5, palette: ['#111111', '#222222'] });
const REF_A2 = synthPacket({ hist: COARSE, obins: O0, coh: 0.5, palette: ['#111111', '#333333'] });
const SHEEP  = synthPacket({ hist: FINEE,  obins: O0, coh: 0.1, palette: ['#abcdef'] });

test('S3: one reference fuses to its own normalised packet', () => {
  const f = fuseReferences([pk]);
  assertEqual(f.module, 'ref-fusion');
  assertEqual(f.refCount, 1);
  assertEqual(f.refs[0].outlier, false);
  assertClose(f.refs[0].weight, 1, 1e-9);
  const tot = pk.scaleHistogram.reduce((a, b) => a + b, 0);
  f.scaleHistogram.forEach((v, i) => assertClose(v, pk.scaleHistogram[i] / tot, 1e-9, `scale bin ${i}`));
  assertClose(f.scaleHistogram.reduce((a, b) => a + b, 0), 1, 1e-9, 'fused scale histogram is a distribution');
  assertClose(f.orientationField.bins.reduce((a, b) => a + b, 0), 1, 1e-9, 'fused orientation bins sum to 1');
  // EVERY term is now exactly 0 against the source packet. `orientation` used to
  // be ≈0.48 here, the known metric defect recorded in docs/checkpoints/S3.md §7
  // and fixed by H-S5 (2026-11-14, `orientationMatch` now normalises by the
  // kernel self-products, so identity is exact for a broad histogram).
  const d = refPacketDistance(f, pk);
  for (const k of ['scale', 'coverage', 'bandScale', 'coherence', 'orientation']) {
    assertClose(d.parts[k], 0, 1e-9, `part '${k}' must be exact against the source packet`);
  }
});

test('S3: a real packet IS zero-distance from itself (H-S5 fixed the floor)', () => {
  // Was the H-S5 known defect, pinned here on a REAL packet: the self-distance
  // sat at ~0.12 because the orientation term was ~0.48 at zero lag, so
  // `styleMatch` had a floor and could never reach 1. H-S5 (the kernel
  // self-product normalisation) removed it; this asserts the floor is gone.
  const d = refPacketDistance(pk, pk);
  assertEqual(d.distance, 0, `self-distance must be exactly 0, got ${d.distance}`);
  for (const k of Object.keys(d.parts)) assertClose(d.parts[k], 0, 1e-12, `part '${k}' at zero lag`);
  assertClose(refPacketMatch(pk, pk), 1, 1e-12, 'a perfect match scores exactly 1');
});

test('S3: fusion works on real reference packets', () => {
  const ringPk = analyzeReference(ring(128));
  const f = fuseReferences([pk, ringPk]);
  assertEqual(f.refCount, 2);
  assertEqual(f.refs.map((r) => r.outlier), [false, false], 'two refs cannot identify an outlier');
  assertClose(f.refs[0].weight, 0.5, 1e-9);
  assertClose(f.scaleHistogram.reduce((a, b) => a + b, 0), 1, 1e-9);
  assert(f.styleDNA.palette.length > 0, 'the fused palette is non-empty');
  assertEqual(JSON.parse(JSON.stringify(f)), f, 'and still JSON-safe');
});

test('S3: fusion is deterministic and JSON-safe', () => {
  const a = fuseReferences([REF_A, REF_A2, SHEEP]);
  const b = fuseReferences([REF_A, REF_A2, SHEEP]);
  assertEqual(a, b, 'same inputs must give a byte-identical packet');
  assertEqual(JSON.parse(JSON.stringify(a)), a);
});

test('S3: an outlier reference is down-weighted, never dropped', () => {
  const f = fuseReferences([REF_A, REF_A2, SHEEP]);
  assertEqual(f.refs.map((r) => r.outlier), [false, false, true]);
  const w = f.refs.map((r) => r.weight);
  assertClose(w[0], 1 / 2.25, 1e-9, 'inlier weight');
  assertClose(w[2], FUSION_DEFAULTS.outlierWeight / 2.25, 1e-9, 'outlier carries outlierWeight');
  assert(w[2] < w[0], 'the outlier must weigh less than an inlier');
  const bin0 = f.scaleHistogram[0], bin7 = f.scaleHistogram[7];
  assert(bin7 > bin0, `coarse bin ${bin7} should dominate fine bin ${bin0}`);
  assertClose(bin0, FUSION_DEFAULTS.outlierWeight / 2.25, 1e-9, 'the sheep contributes exactly its weight');
  // Prove the down-weighting is what did it: disable it and the sheep is equal.
  const g = fuseReferences([REF_A, REF_A2, SHEEP], { outlierWeight: 1 });
  assertEqual(g.refs.map((r) => r.outlier), [false, false, true]);
  assertClose(g.refs[2].weight, 1 / 3, 1e-9, 'without down-weighting every ref weighs equally');
});

test('S3: an explicit per-reference weight overrides the default', () => {
  const f = fuseReferences([{ packet: REF_A, weight: 3 }, REF_A2]);
  assertClose(f.refs[0].baseWeight, 0.75, 1e-9);
  assertClose(f.refs[1].baseWeight, 0.25, 1e-9);
  assertClose(f.refs[0].weight, 0.75, 1e-9);
});

test('S3: two dissimilar references flag nobody (no consensus to protect)', () => {
  const f = fuseReferences([REF_A, SHEEP]);
  assertEqual(f.refs.map((r) => r.outlier), [false, false]);
  assertClose(f.refs[0].weight, 0.5, 1e-9);
});

test('S3: identical references agree fully', () => {
  const f = fuseReferences([REF_A, REF_A2]);
  assertClose(f.spread.agreement, 1, 1e-9);
  assertClose(f.spread.scale, 0, 1e-9);
});

test('S3: the fused packet carries a spread (confidence) signal', () => {
  const f = fuseReferences([REF_A, REF_A2, SHEEP]);
  assert(f.spread.agreement < 1 && f.spread.agreement > 0.5, `agreement ${f.spread.agreement}`);
  assert(f.spread.orientation < 1e-9, 'the refs share an orientation');
  assert(f.spread.scale > 0, 'disagreeing scale histograms must show as spread');
});

test('S3: palette fusion keeps the dominant colours, capped by paletteSize', () => {
  const f = fuseReferences([REF_A, REF_A2, SHEEP]);
  assertEqual(f.styleDNA.palette, ['#111111', '#222222', '#333333', '#abcdef'],
    'shared colours lead; ties break by hex; the down-weighted sheep ranks last');
  const capped = fuseReferences([REF_A, REF_A2, SHEEP], { paletteSize: 2 });
  assertEqual(capped.styleDNA.palette, ['#111111', '#222222']);
});

test('S3: rejects 0 refs, more than maxRefs, and non-packet inputs', () => {
  let threw = 0;
  const grab = (fn) => { try { fn(); } catch { threw++; } };
  grab(() => fuseReferences([]));
  grab(() => fuseReferences([REF_A, REF_A, REF_A, REF_A, REF_A]));
  grab(() => fuseReferences([{ nope: true }]));
  assertEqual(threw, 3, 'all three invalid inputs must throw');
});

test('S3: a fused reference attaches to provenance and round-trips the schema', () => {
  const base = profileFromSettings({ style: 'pencil', strokeCount: 400 });
  assert(validateProfile(base).ok, 'the base profile should be valid');
  const fused = fuseReferences([REF_A, REF_A2, SHEEP]);
  const withRef = attachFusedReference(base, fused);
  assert(withRef !== base, 'attach must return a NEW profile');
  assertEqual(base.provenance.refPacket, undefined, 'the input must not be mutated');
  assertEqual(fusedReferenceFromProfile(withRef), fused, 'the fused packet reads back');
  const round = JSON.parse(JSON.stringify(withRef));
  const v = validateProfile(round);
  assert(v.ok, `a profile with a fused ref must validate: ${JSON.stringify(v.errors)}`);
  assertEqual(fusedReferenceFromProfile(round), fused, 'the fused packet survives JSON');
});

test('S3: a malformed fused reference is rejected, and null clears the field', () => {
  const base = profileFromSettings({});
  const bad = { ...base, provenance: { source: 'ai', refPacket: { nope: true } } };
  assertEqual(validateProfile(bad).ok, false, 'a malformed refPacket must fail validation');
  const withRef = attachFusedReference(base, fuseReferences([REF_A]));
  assert(fusedReferenceFromProfile(withRef) !== null);
  const cleared = attachFusedReference(withRef, null);
  assertEqual(fusedReferenceFromProfile(cleared), null);
  assertEqual('refPacket' in cleared.provenance, false, 'null clears the key entirely');
  assert(validateProfile(cleared).ok, 'the cleared profile is still valid');
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
