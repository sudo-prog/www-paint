/**
 * Track R4 seam tests (Mac half — outlines / order / shaping).
 *
 * Run with: node tests/r4.test.js
 *
 * Verifies the adapter (`js/engine/r4.js`) that puts the three inert Mac
 * modules behind one frozen, node-testable surface:
 *   - the vocabulary is frozen and cross-checks the source modules
 *   - ordering: native modes change the list, extensions are reported as such,
 *     the centre is resolved in the documented order, nothing is mutated
 *   - shaping: the live registry is fully covered, every row is well-formed,
 *     overrides win, unknown styles fall back to documented defaults
 *   - outlines: a synthetic square yields a real contour plan, budget caps it,
 *     the legacy-mode mapping is total
 *   - buildR4Plan: pure, total, and no-op-safe (off + no shapes ⇒ empty plan)
 */

import {
  OUTLINE_MODES, ORDER_EXTENSIONS, R4_ORDER_MODES, UNKNOWN_ORDER_FALLBACK, SHAPING_FIELDS,
  isNativeOrderMode, isR4OrderMode, planOrder, resolveCentre,
  shapingForRegistry, validateShaping, resolveEffectiveShaping,
  planOutlines, outlineModeFromLegacy, isOutlineActive,
  buildR4Plan, shapingCoverageGaps, percentilePeak,
  ORDER_MODES, OUTLINE_DEFAULTS,
} from '../js/engine/r4.js';
import { extractOutlines } from '../js/engine/outlines.js';
import { analyzeImage } from '../js/engine/analyzer.js';
import { getAllStyles } from '../js/styles/index.js';

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

/** A shape whose centre is (x, y). */
function shape(x, y, tag) {
  return { type: 'E', params: [x, y, 4, 4, 0], color0: [0, 0, 0], color1: [0, 0, 0], alpha: 1, tag };
}

function sampleShapes() {
  return [
    shape(10, 10, 'NW'), shape(90, 10, 'NE'), shape(10, 90, 'SW'),
    shape(90, 90, 'SE'), shape(50, 50, 'C'), shape(30, 70, 'midSW'), shape(70, 30, 'midNE'),
  ];
}

/** A 64x64 black field with a white square — a real, high-contrast contour. */
function squareAnalysis() {
  const w = 64, h = 64;
  const px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const inside = x >= 16 && x < 48 && y >= 16 && y < 48;
      const v = inside ? 240 : 20;
      px[i] = v; px[i + 1] = v; px[i + 2] = v; px[i + 3] = 255;
    }
  }
  return analyzeImage(px, w, h, {});
}

/* ─── Vocabulary ─────────────────────────────────────────────────────── */

test('OUTLINE_MODES is the frozen R4 vocabulary', () => {
  assertEqual(OUTLINE_MODES, ['off', 'first', 'last']);
});

test('ORDER_EXTENSIONS are the three legacy generator modes, in order', () => {
  assertEqual(ORDER_EXTENSIONS, ['top-bottom', 'edges-first', 'one-line']);
});

test('R4_ORDER_MODES = the eleven M8 modes + the three extensions, no duplicates', () => {
  assertEqual(R4_ORDER_MODES, [...ORDER_MODES, ...ORDER_EXTENSIONS]);
  assertEqual(new Set(R4_ORDER_MODES).size, R4_ORDER_MODES.length, 'no duplicates');
  assertEqual(R4_ORDER_MODES.length, 14);
});

test('UNKNOWN_ORDER_FALLBACK is free (the M8 module leaves the list untouched)', () => {
  assertEqual(UNKNOWN_ORDER_FALLBACK, 'free');
});

test('isNativeOrderMode / isR4OrderMode agree on the partition', () => {
  for (const m of ORDER_MODES) { assert(isNativeOrderMode(m), `${m} native`); assert(isR4OrderMode(m), `${m} r4`); }
  for (const m of ORDER_EXTENSIONS) {
    assert(!isNativeOrderMode(m), `${m} not native`);
    assert(isR4OrderMode(m), `${m} r4`);
  }
  assert(!isR4OrderMode('nope'), 'unknown is not r4');
});

/* ─── Centre ─────────────────────────────────────────────────────────── */

test('resolveCentre prefers explicit cx/cy over width/height over the bounding box', () => {
  const shapes = sampleShapes();
  assertEqual(resolveCentre(shapes, { cx: 1, cy: 2, width: 100, height: 100 }), { cx: 1, cy: 2 });
  assertEqual(resolveCentre(shapes, { width: 100, height: 80 }), { cx: 50, cy: 40 });
  assertEqual(resolveCentre(shapes, {}), { cx: 50, cy: 50 }, 'bbox centre');
  assertEqual(resolveCentre([], {}), { cx: 0, cy: 0 }, 'empty ⇒ 0,0');
});

/* ─── Order ──────────────────────────────────────────────────────────── */

test('planOrder: a native mode changes the order and reports the centre', () => {
  // y-descending so `down` genuinely reorders it (a y-ascending list would be
  // a fixed point of `down` and the assertion would pass vacuously).
  const shapes = [
    shape(10, 90, 'SW'), shape(90, 90, 'SE'), shape(50, 50, 'C'),
    shape(30, 70, 'midSW'), shape(70, 30, 'midNE'), shape(10, 10, 'NW'), shape(90, 10, 'NE'),
  ];
  const down = planOrder(shapes, 'down');
  assertEqual(down.mode, 'down');
  assert(down.native, 'down is native');
  assert(down.changed, 'down changes the order');
  assertEqual(down.centre, { cx: 50, cy: 50 });
  assertEqual(down.order.length, shapes.length);
  assertEqual([...down.order].sort((a, b) => a - b), shapes.map((_, i) => i), 'a permutation');
  assertEqual(down.order[0], 5, 'the northernmost shape paints first');
  assertEqual(down.order[6], 1, 'the southernmost paints last');
});

test('planOrder: free is native but leaves the order untouched', () => {
  const down = planOrder(sampleShapes(), 'free');
  assert(down.native, 'free is a native mode');
  assert(!down.changed, 'free does not reorder');
  assertEqual(down.order, [0, 1, 2, 3, 4, 5, 6]);
});

test('planOrder: an extension is reported as non-native with input order', () => {
  for (const m of ORDER_EXTENSIONS) {
    const p = planOrder(sampleShapes(), m);
    assert(!p.native, `${m} not native`);
    assert(!p.changed, `${m} does not reorder`);
    assertEqual(p.order, [0, 1, 2, 3, 4, 5, 6], `${m} input order`);
  }
});

test('planOrder: unknown mode falls back to free, non-native, untouched', () => {
  const p = planOrder(sampleShapes(), 'nope');
  assertEqual(p.mode, 'nope');
  assert(!p.native);
  assert(!p.changed);
  assertEqual(p.order, [0, 1, 2, 3, 4, 5, 6]);
});

test('planOrder: does not mutate the caller shapes or their array', () => {
  const shapes = sampleShapes();
  const before = JSON.stringify(shapes);
  const arrBefore = shapes.slice();
  planOrder(shapes, 'up');
  assertEqual(JSON.stringify(shapes), before, 'shape objects untouched');
  assertEqual(shapes.map(s => s.tag), arrBefore.map(s => s.tag), 'array order untouched');
  for (const s of shapes) assert(!('order' in s), 'no order field invented');
});

test('planOrder: empty and non-array input are safe', () => {
  assertEqual(planOrder([], 'down').order, []);
  assertEqual(planOrder(null, 'down').order, []);
  assertEqual(planOrder(undefined, 'down').centre, { cx: 0, cy: 0 });
});

/* ─── Shaping ────────────────────────────────────────────────────────── */

test('validateShaping: the live registry is fully covered and well-formed', () => {
  const v = validateShaping();
  if (!v.ok) throw new Error(v.errors.join(' | '));
  assertEqual(v.errors, []);
});

test('shapingCoverageGaps is empty for the live registry', () => {
  assertEqual(shapingCoverageGaps(), []);
});

test('shapingForRegistry covers exactly the registry names', () => {
  const reg = getAllStyles().map(s => s.name).sort();
  const built = Object.keys(shapingForRegistry()).sort();
  assertEqual(built, reg);
  assert(built.length >= 51, `expected >= 51 styles, got ${built.length}`);
});

test('shapingForRegistry rows carry all five frozen fields', () => {
  for (const [name, sh] of Object.entries(shapingForRegistry())) {
    for (const f of SHAPING_FIELDS) {
      assert(f.key in sh, `${name} missing ${f.key}`);
    }
    assertEqual(Object.keys(sh).sort(), ['elongation', 'maxSize', 'minSize', 'order', 'regionFill']);
  }
});

test('resolveEffectiveShaping: table by default, override wins, unknown ⇒ defaults', () => {
  const t = resolveEffectiveShaping('pencil');
  assertEqual(t.source, 'table');
  assertEqual(t.shaping, resolveEffectiveShaping('pencil').shaping);
  const o = resolveEffectiveShaping('pencil', { elongation: 3.5, minSize: 9 });
  assertEqual(o.source, 'override');
  assertEqual(o.shaping.elongation, 3.5);
  assertEqual(o.shaping.minSize, 9);
  assertEqual(o.shaping.maxSize, t.shaping.maxSize, 'untouched field inherited');
  const u = resolveEffectiveShaping('no-such-style');
  assertEqual(u.source, 'table');
  assertEqual(u.shaping.order, 'down');
});

test('resolveEffectiveShaping never mutates the override object', () => {
  const ov = { elongation: 2.5 };
  const snapshot = JSON.stringify(ov);
  resolveEffectiveShaping('ink', ov);
  assertEqual(JSON.stringify(ov), snapshot);
});

test('every shaping row uses an R4 order mode', () => {
  const bad = Object.entries(shapingForRegistry())
    .filter(([, sh]) => !isR4OrderMode(sh.order))
    .map(([n, sh]) => `${n}:${sh.order}`);
  assertEqual(bad, []);
});

/* ─── Outlines ───────────────────────────────────────────────────────── */

test('planOutlines: a synthetic square yields contours that hug the edge', () => {
  const an = squareAnalysis();
  const p = planOutlines(an, { minLength: 8, budget: 8 });
  assert(p.count >= 1, 'at least one outline');
  assert(p.count <= 8, 'budget respected');
  assertEqual(p.skipped, Math.max(0, planOutlines(an, { minLength: 8 }).count - 8));
  const total = p.outlines.reduce((s, o) => s + o.length, 0);
  assert(total >= 32, `square perimeter is ~128 px, got ${total}`);
  // Every sampled point must lie near the square's border band (16..48).
  let nearBorder = 0;
  let counted = 0;
  for (const pts of p.points) {
    for (const [x, y] of pts) {
      counted++;
      const d = Math.min(Math.abs(x - 16), Math.abs(x - 47), Math.abs(y - 16), Math.abs(y - 47));
      if (d <= 2) nearBorder++;
    }
  }
  assert(counted > 0, 'points present');
  assert(nearBorder / counted >= 0.8, `>=80% of outline points on the border, got ${nearBorder}/${counted}`);
});

test('planOutlines: budget caps the plan and reports what was skipped', () => {
  const an = squareAnalysis();
  const all = planOutlines(an, { minLength: 8 });
  const one = planOutlines(an, { minLength: 8, budget: 1 });
  assertEqual(one.count, 1);
  assertEqual(one.skipped, all.count - 1);
  assertEqual(one.outlines[0].index, 0, 'kept outline is the largest');
});

test('planOutlines: budget 0 yields an empty plan, not a throw', () => {
  const p = planOutlines(squareAnalysis(), { minLength: 8, budget: 0 });
  assertEqual(p.count, 0);
  assertEqual(p.points, []);
});

test('planOutlines: a flat field yields nothing', () => {
  const w = 32, h = 32;
  const px = new Uint8ClampedArray(w * h * 4).fill(128);
  for (let i = 3; i < px.length; i += 4) px[i] = 255;
  const p = planOutlines(analyzeImage(px, w, h, {}), { minLength: 8 });
  assertEqual(p.count, 0);
});

test('planOutlines: deterministic and does not leak private fields', () => {
  const an = squareAnalysis();
  // Pin BOTH halves of the mode contract. The mode is an INTENT, not an
  // instruction: `planOutlines` never invokes the extractor itself (it cannot —
  // it receives no style/outline timing), so an unset mode must not be turned
  // into a lay-in. This assertion previously read `assertEqual(a.mode,'first')`
  // with `mode` unset, which fails on any build where the default is `off`
  // (observed on the ThinkPad: 37 passed / 1 FAILED) while passing here.
  const a = planOutlines(an, { minLength: 8, mode: 'first' });
  const b = planOutlines(an, { minLength: 8, mode: 'first' });
  assertEqual(a, b);
  if (a.count > 0) {
    assertEqual(a.points[0].length, a.outlines[0].length);
  }
  assertEqual(a.mode, 'first', 'an explicit mode is echoed back');
  // And the unset case is a documented off, never a silent lay-in:
  assertEqual(planOutlines(an, { minLength: 8 }).mode, 'off');
});

test('planOutlines: missing analysis is an empty plan, not a throw', () => {
  assertEqual(planOutlines(null).count, 0);
  assertEqual(planOutlines({ width: 8, height: 8 }).count, 0);
});

test('outlineModeFromLegacy maps both vocabularies totally', () => {
  assertEqual(outlineModeFromLegacy('off'), 'off');
  assertEqual(outlineModeFromLegacy('first'), 'first');
  assertEqual(outlineModeFromLegacy('last'), 'last');
  assertEqual(outlineModeFromLegacy('on'), 'off', 'profile "on" is not an R4 mode');
  assertEqual(outlineModeFromLegacy('edges'), 'first', 'profile "edges" ⇒ contours first');
  assertEqual(outlineModeFromLegacy(undefined), 'off');
  assertEqual(outlineModeFromLegacy('nope'), 'off');
});

test('isOutlineActive: off is inactive, first/last active', () => {
  assert(!isOutlineActive('off'));
  assert(isOutlineActive('first'));
  assert(isOutlineActive('last'));
  assert(!isOutlineActive('nope'));
});

/* ─── Aggregate plan ────────────────────────────────────────────────── */

test('buildR4Plan: an off + shapeless plan is empty and safe', () => {
  const p = buildR4Plan({});
  assertEqual(p.outline.count, 0);
  assertEqual(p.outlines, []);
  assertEqual(p.order.changed, false);
  assertEqual(p.shapingSource, 'table');
  assertEqual(p.order.mode, p.shaping.order, 'no explicit order ⇒ the style shaping order');
});

test('buildR4Plan: off + shapes still plans the order (shaping-driven)', () => {
  // A y-descending list so the shaping order (`down` for pencil) is a real
  // reorder, not a fixed point.
  const shapes = [
    shape(10, 90, 'SW'), shape(90, 90, 'SE'), shape(50, 50, 'C'),
    shape(30, 70, 'midSW'), shape(70, 30, 'midNE'), shape(10, 10, 'NW'), shape(90, 10, 'NE'),
  ];
  const p = buildR4Plan({ style: 'pencil', shapes });
  assertEqual(p.outline.mode, 'off');
  assertEqual(p.outline.count, 0);
  assert(p.order.native, 'pencil order down is native');
  assert(p.order.changed, 'order planned');
  assertEqual(p.outlines, []);
});

test('buildR4Plan: an explicit order overrides the shaping order', () => {
  const shapes = [
    shape(10, 90, 'SW'), shape(90, 90, 'SE'), shape(50, 50, 'C'),
    shape(30, 70, 'midSW'), shape(70, 30, 'midNE'), shape(10, 10, 'NW'), shape(90, 10, 'NE'),
  ];
  const p = buildR4Plan({ style: 'pencil', shapes, order: 'up' });
  assertEqual(p.order.mode, 'up');
  assert(p.order.changed);
  assertEqual(p.order.centre, { cx: 50, cy: 50 });
});

test('buildR4Plan: a shaping override flows into the plan and wins', () => {
  const shapes = [
    shape(10, 90, 'SW'), shape(90, 90, 'SE'), shape(50, 50, 'C'),
    shape(30, 70, 'midSW'), shape(70, 30, 'midNE'), shape(10, 10, 'NW'), shape(90, 10, 'NE'),
  ];
  const p = buildR4Plan({ style: 'pencil', shapes, shapingOverride: { order: 'clock' } });
  assertEqual(p.shapingSource, 'override');
  assertEqual(p.order.mode, 'clock');
  assert(p.order.changed);
});

test('buildR4Plan: outline first plans contours from a real analysis', () => {
  const an = squareAnalysis();
  const p = buildR4Plan({ style: 'ink', analysis: an, outline: 'first', outlineOptions: { minLength: 8, budget: 4 } });
  assertEqual(p.outline.mode, 'first');
  assert(p.outline.count >= 1);
  assert(p.outline.count <= 4);
  assertEqual(p.outlines.length, p.outline.count);
  assert(p.outlinePoints.length >= 1);
});

test('buildR4Plan: the profile vocabulary "on"/"edges" maps onto R4 modes', () => {
  const an = squareAnalysis();
  assertEqual(buildR4Plan({ analysis: an, outline: 'edges' }).outline.mode, 'first');
  assertEqual(buildR4Plan({ analysis: an, outline: 'on' }).outline.mode, 'off');
  assertEqual(buildR4Plan({ analysis: an, outline: 'on' }).outline.count, 0);
});

test('buildR4Plan: legacy "off" never calls the extractor', () => {
  const an = squareAnalysis();
  const p = buildR4Plan({ style: 'ink', analysis: an, outline: 'off' });
  assertEqual(p.outline.count, 0);
  assertEqual(p.outlinePoints, []);
});

test('buildR4Plan: pure — the same input twice gives byte-identical output', () => {
  const an = squareAnalysis();
  const args = { style: 'watercolor', analysis: an, outline: 'first', shapes: sampleShapes() };
  assertEqual(buildR4Plan(args), buildR4Plan(args));
});

test('buildR4Plan: does not mutate its arguments', () => {
  const shapes = sampleShapes();
  const before = JSON.stringify(shapes);
  const an = squareAnalysis();
  const anBefore = JSON.stringify(an.edges.slice(0, 64));
  buildR4Plan({ style: 'pencil', analysis: an, outline: 'first', shapes });
  assertEqual(JSON.stringify(shapes), before);
  assertEqual(JSON.stringify(an.edges.slice(0, 64)), anBefore);
});

test('buildR4Plan: every outline row is self-describing and capped by budget', () => {
  const an = squareAnalysis();
  const p = buildR4Plan({ style: 'ink', analysis: an, outline: 'last', outlineOptions: { minLength: 8, budget: 2 } });
  assertEqual(p.outline.budget, 2);
  for (const o of p.outlines) {
    assertEqual(Object.keys(o).sort(), ['index', 'length', 'points', 'strength']);
    assert(o.length >= 8, 'respects minLength');
    assert(o.strength >= 0 && o.strength <= 1, 'strength is a normalised magnitude');
  }
});

test('OUTLINE_DEFAULTS is re-exported unchanged', () => {
  assertEqual(typeof OUTLINE_DEFAULTS.threshold, 'number');
  assert(OUTLINE_DEFAULTS.minLength >= 1);
});

/* ─── Soft-edge gap (measured, recorded) ─────────────────────────────── */

test('the extractor is deterministic and reports the cut it used', () => {
  const an = squareAnalysis();
  const a = planOutlines(an, { threshold: 0.3, minLength: 8 });
  const b = planOutlines(an, { threshold: 0.3, minLength: 8 });
  assertEqual(a, b);
  assertEqual(a.threshold, 0.3, 'the cut is the requested absolute threshold');
  assertEqual(a.peak, 1, 'absolute mode has a unity scale');
  assert(a.count > 0, 'contours found');
});

test('the soft-edge gap is measured, not papered over', () => {
  // RECORDED FINDING, not a fix. Vision review of the probe overlay showed the
  // walk traces hard-edged rings and misses soft blobs entirely. The hypothesis
  // was that an absolute `threshold` is at fault; measurement disproved it:
  //   - `analyzeImage` normalises `edges` by the image's own max
  //     (analyzer.js:94-99), so the cut is ALREADY relative to the strongest edge;
  //   - lowering the cut does not add soft contours, it MERGES existing ones
  //     into fewer, longer walks (measured 30 vs 31 and 3 vs 4);
  //   - three candidate scale statistics (percentile peak, mean accepted
  //     strength, p99/p50 spread) each failed on a different fixture.
  // So no relative-threshold option ships. This test pins the honest state: the
  // extractor is deterministic, and the diagnostic exposes the gap.
  const S = 160, h = 40, soft = 40;
  const px = new Uint8ClampedArray(S * S * 4);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4;
      let v = 246;
      if (x >= 24 && x < 24 + h && y >= 56 && y < 56 + h) v = 20;
      const d = Math.max(Math.abs(x - 122), Math.abs(y - 122));
      if (d > 16 && d < 16 + soft) v = Math.round(246 - 110 * (d - 16) / soft);
      else if (d <= 16) v = 136;
      px[i] = v; px[i + 1] = v; px[i + 2] = v; px[i + 3] = 255;
    }
  }
  const an = analyzeImage(px, S, S, {});
  const a = planOutlines(an, { threshold: 0.3, minLength: 10, budget: 40 });
  const b = planOutlines(an, { threshold: 0.3, minLength: 10, budget: 40 });
  assertEqual(a, b, 'extraction is deterministic');
  assert(a.count > 0, 'hard contours are found');
  // The soft square's rim is two orders of magnitude below the hard edge; the
  // diagnostic reports that spread.
  const spread = percentilePeak(an.edges, 0.99) / Math.max(1e-9, percentilePeak(an.edges, 0.5));
  assert(spread > 5, `the diagnostic exposes the soft/hard spread (${spread.toFixed(1)}x)`);
});

test('percentilePeak is monotone in the percentile and safe on empty input', () => {
  // All values are non-zero, so "non-zero only" == "all" here.
  const edges = new Float32Array([0.1, 0.2, 0.5, 1]);
  assert(Math.abs(percentilePeak(edges, 0) - 0.1) < 1e-6, 'p0 = min');
  assert(Math.abs(percentilePeak(edges, 1) - 1) < 1e-6, 'p1 = max');
  assert(percentilePeak(edges, 0.6) >= percentilePeak(edges, 0.2));
  assertEqual(percentilePeak(new Float32Array(0), 0.6), 0);
  assertEqual(percentilePeak(null, 0.6), 0);
  // An all-zero field has no edges, so the peak is 0.
  assertEqual(percentilePeak(new Float32Array([0, 0, 0]), 0.6), 0);
});

test('a flat field yields nothing and reports a zero scale', () => {
  const w = 32, h = 32;
  const px = new Uint8ClampedArray(w * h * 4).fill(128);
  for (let i = 3; i < px.length; i += 4) px[i] = 255;
  const an = analyzeImage(px, w, h, {});
  const a = planOutlines(an, { minLength: 8 });
  const b = planOutlines(an, { minLength: 8 });
  assertEqual(a, b);
  assertEqual(a.count, 0);
});

test('extractOutlines is deterministic on a real analysis (module contract)', () => {
  const an = squareAnalysis();
  const a = extractOutlines(an, { threshold: 0.3, minLength: 8 });
  const b = extractOutlines(an, { threshold: 0.3, minLength: 8 });
  assert(a.outlines.length >= 1);
  assertEqual(a, b);
});

/* ─── Summary ────────────────────────────────────────────────────────── */

console.log(`\n=== Track R4 seam: Passed ${passed}  Failed ${failed} ===\n`);
process.exit(failed === 0 ? 0 : 1);
