/**
 * Engine unit tests for WWW_PAINT.
 *
 * Run with: node tests/engine.test.js
 *
 * These tests verify the core engine modules work correctly:
 * - Shape primitives (creation, validation, bounds, centroid)
 * - Color utilities (hex/rgb conversion, distance)
 * - Math helpers (clamp, lerp, mapRange)
 * - RNG (determinism)
 * - Analyzer (image analysis)
 * - Generator (settings resolution, candidate generation)
 * - Scorer (shape scoring, selection)
 * - Optimiser core — Track R1 (error-driven placement + local hill-climb)
 * - Optimiser multi-scale — Track R2 (coarse→fine, structure-guided)
 * - Exporter (project export/import round-trip)
 */

import {
  createShape, isValidShape, centroid, bounds, area, pathLength,
  pointAt, gradientAt, cloneShape, packShape, unpackShape,
  shapeToSVG, shapeToCode, getRuntimeSource, SHAPE_TYPES, VALID_TYPES
} from '../js/engine/shapes.js';
import {
  hexToRgb, rgbToHex, rgbToCss, colorDistance, quantizeColor,
  nearestColor, rgbToHsl, hslToRgb
} from '../js/utils/color.js';
import { clamp, lerp, mapRange, dist2, toRad, toDeg, quantize } from '../js/utils/math.js';
import { createRNG, rng } from '../js/utils/rng.js';
import {
  analyzeImage, sampleRegion, sampleLuminance, sampleEdge,
  computeStructureTensor, sampleStructure, structureDebugRGBA
} from '../js/engine/analyzer.js';
import {
  generateCandidates, resolveSettings, DEFAULT_SETTINGS,
  orderShapes, estimateShapeCount
} from '../js/engine/generator.js';
import { selectBest, selectGreedyResidual, scoreShape } from '../js/engine/scorer.js';
import { optimise, OPTIMISER_DEFAULTS, resolveOptions as resolveOptimiserOptions, buildScalePlan } from '../js/engine/optimizer.js';
import { exportProject, importProject, packLayers, exportHTML } from '../js/engine/exporter.js';
import {
  resolveLayerStyles, applyLayerStyles, preserveLayerProps, shapeLayerKey, TONAL_LAYER_NAMES
} from '../js/engine/layer-styles.js';

// Simple test runner
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ✗ ${name}`);
    console.log(`    ${err.message}`);
    failed++;
  }
}

function assertEqual(actual, expected, msg = '') {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) {
    throw new Error(`${msg} Expected ${b}, got ${a}`);
  }
}

function assertApprox(actual, expected, tolerance = 0.001, msg = '') {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${msg} Expected ~${expected}, got ${actual}`);
  }
}

console.log('\n=== WWW_PAINT Engine Tests ===\n');

// ─── Math ─────────────────────────────────────────────────────────
console.log('Math utilities:');
test('clamp', () => {
  assertEqual(clamp(5, 0, 10), 5, 'clamp in range');
  assertEqual(clamp(-5, 0, 10), 0, 'clamp below min');
  assertEqual(clamp(15, 0, 10), 10, 'clamp above max');
});

test('lerp', () => {
  assertEqual(lerp(0, 10, 0.5), 5);
  assertEqual(lerp(10, 20, 0.3), 13);
});

test('mapRange', () => {
  assertEqual(mapRange(5, 0, 10, 0, 100), 50);
});

test('dist2', () => {
  assertApprox(dist2(0, 0, 3, 4), 5);
});

test('toRad/toDeg', () => {
  assertApprox(toRad(180), Math.PI, 0.001);
  assertApprox(toDeg(Math.PI), 180, 0.001);
});

test('quantize', () => {
  assertEqual(quantize(17, 10), 20);
  assertEqual(quantize(14, 10), 10);
});

// ─── Color ────────────────────────────────────────────────────────
console.log('\nColor utilities:');
test('hexToRgb', () => {
  assertEqual(hexToRgb('#ff0000'), [255, 0, 0]);
  assertEqual(hexToRgb('#0f0'), [0, 255, 0]);
  assertEqual(hexToRgb('#0000ff'), [0, 0, 255]);
});

test('rgbToHex', () => {
  assertEqual(rgbToHex([255, 0, 0]), '#ff0000');
  assertEqual(rgbToHex([0, 255, 0]), '#00ff00');
  assertEqual(rgbToHex([0, 0, 255]), '#0000ff');
});

test('colorDistance', () => {
  assertEqual(colorDistance([0, 0, 0], [0, 0, 0]), 0);
  assertEqual(colorDistance([255, 0, 0], [0, 0, 0]), 255);
});

test('rgbToHsl/hslToRgb round-trip', () => {
  const { h, s, l } = rgbToHsl([255, 0, 0]);
  const back = hslToRgb(h, s, l);
  assertApprox(back[0], 255, 1);
  assertApprox(back[1], 0, 1);
  assertApprox(back[2], 0, 1);
});

// ─── RNG ──────────────────────────────────────────────────────────
console.log('\nRNG:');
test('createRNG is deterministic', () => {
  const rng1 = createRNG(42);
  const rng2 = createRNG(42);
  const vals1 = [rng1(), rng1(), rng1()];
  const vals2 = [rng2(), rng2(), rng2()];
  assertEqual(vals1, vals2, 'Same seed produces same sequence');
});

test('rng wrapper', () => {
  const r = rng(123);
  const val = r.float(10, 20);
  if (val < 10 || val >= 20) {
    throw new Error(`Float out of range: ${val}`);
  }
  const intVal = r.int(1, 6);
  if (intVal < 1 || intVal > 6) {
    throw new Error(`Int out of range: ${intVal}`);
  }
});

// ─── Shapes ───────────────────────────────────────────────────────
console.log('\nShape primitives:');
test('createShape defaults', () => {
  const s = createShape({});
  assertEqual(s.type, 'S');
  assertEqual(s.params.length, 8);
  assertEqual(s.alpha, 1);
  assertEqual(s.style, 'pencil');
});

test('isValidShape rejects invalid', () => {
  assertEqual(isValidShape(null), false);
  assertEqual(isValidShape({}), false);
  assertEqual(isValidShape(createShape({ type: 'S' })), true);
});

test('bounds and centroid', () => {
  const s = createShape({ type: 'R', params: [50, 50, 20, 10, 0, 0, 0, 0] });
  const [cx, cy] = centroid(s);
  assertEqual([cx, cy], [50, 50]);
  const [x0, y0, x1, y1] = bounds(s);
  assertEqual(x0, 40);
  assertEqual(x1, 60);
});

test('pack/unpack round-trip', () => {
  const styleList = ['pencil', 'ink'];
  const s = createShape({
    id: 'test_1',
    type: 'S',
    params: [10, 20, 30, 40, 50, 60, 3, 0.5],
    color0: [255, 0, 0],
    color1: [0, 0, 255],
    alpha: 0.8,
    style: 'pencil',
    layer: 0,
    order: 5,
    seed: 42,
  });
  const packed = packShape(s, styleList);
  const unpacked = unpackShape(packed, styleList);
  assertEqual(unpacked.type, 'S');
  assertEqual(unpacked.color0, [255, 0, 0]);
  assertEqual(unpacked.color1, [0, 0, 255]);
  assertApprox(unpacked.alpha, 0.8);
  assertEqual(unpacked.style, 'pencil');
});

test('shapeToSVG produces valid SVG', () => {
  const s = createShape({ type: 'S', params: [0, 0, 10, 10, 20, 0, 2, 0] });
  const svg = shapeToSVG(s);
  if (!svg.includes('<path')) {
    throw new Error('SVG should contain a path element');
  }
});

test('getRuntimeSource returns non-empty string', () => {
  const src = getRuntimeSource();
  if (src.length < 100) {
    throw new Error('Runtime source too short');
  }
});

// ─── Analyzer ─────────────────────────────────────────────────────
console.log('\nAnalyzer:');
test('analyzeImage produces correct result', () => {
  const w = 10, h = 10;
  const pixels = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = 128;     // R
    pixels[i + 1] = 128; // G
    pixels[i + 2] = 128; // B
    pixels[i + 3] = 255; // A
  }
  const result = analyzeImage(pixels, w, h);
  assertEqual(result.width, w);
  assertEqual(result.height, h);
  assertEqual(result.luminance.length, w * h);
  assertEqual(result.edges.length, w * h);
  if (result.palette.length === 0) {
    throw new Error('Palette should not be empty');
  }
});

test('analyzer: tiny image does not hang (k-means init)', () => {
  // Regression guard: with fewer pixels than paletteSize the k-means init used
  // to spin forever in a `do { } while (used.has(idx))` loop. If this ever
  // hangs again, the suite hangs here.
  const px = new Uint8ClampedArray(4);
  px[0] = 10; px[1] = 20; px[2] = 30; px[3] = 255;
  const a = analyzeImage(px, 1, 1);
  assertEqual(a.width, 1);
  assertEqual(a.height, 1);
  if (!Array.isArray(a.palette) || a.palette.length < 1) {
    throw new Error('tiny image should still yield at least one palette colour');
  }
});

test('sampleLuminance', () => {
  const lum = new Uint8ClampedArray([0, 128, 255]);
  const val = sampleLuminance(lum, 3, 1, 1, 0);
  if (val < 0 || val > 255) {
    throw new Error(`Luminance out of range: ${val}`);
  }
});

// ─── Generator ────────────────────────────────────────────────────
console.log('\nGenerator:');
test('resolveSettings merges defaults', () => {
  const s = resolveSettings({ style: 'ink', strokeCount: 500 });
  assertEqual(s.style, 'ink');
  assertEqual(s.strokeCount, 500);
  assertEqual(s.colorMode, 'exact'); // from default
});

test('resolveSettings deep merges strokeSize', () => {
  const s = resolveSettings({ strokeSize: { min: 5 } });
  assertEqual(s.strokeSize.min, 5);
  assertEqual(s.strokeSize.max, DEFAULT_SETTINGS.strokeSize.max); // preserved from default
});

test('estimateShapeCount returns reasonable value', () => {
  const count = estimateShapeCount(100, 100, 'pencil');
  if (count < 150 || count > 20000) {
    throw new Error(`Shape count out of range: ${count}`);
  }
});

test('generateCandidates produces shapes', () => {
  const w = 30, h = 30;
  const pixels = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = 128; pixels[i+1] = 128; pixels[i+2] = 128; pixels[i+3] = 255;
  }
  const analysis = analyzeImage(pixels, w, h);
  const settings = resolveSettings({ style: 'pencil', strokeCount: 50 });
  const candidates = generateCandidates(analysis, settings, 42);
  if (candidates.length === 0) {
    throw new Error('No candidates generated');
  }
  const first = candidates[0];
  if (!isValidShape(first)) {
    throw new Error('First candidate is not a valid shape');
  }
});

test('orderShapes preserves all shapes', () => {
  const shapes = [
    createShape({ type: 'S', params: [10, 10, 20, 20, 30, 30, 2, 0], order: 0 }),
    createShape({ type: 'R', params: [50, 50, 10, 10, 0, 0, 0, 0], order: 1 }),
  ];
  const ordered = orderShapes(shapes, resolveSettings({ pathOrder: 'top-bottom' }));
  assertEqual(ordered.length, shapes.length);
});

// ─── Scorer ───────────────────────────────────────────────────────
console.log('\nScorer:');

test('selectBest returns top N by score', () => {
  const w = 20, h = 20;
  const pixels = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = 200; pixels[i+1] = 100; pixels[i+2] = 50; pixels[i+3] = 255;
  }
  const analysis = analyzeImage(pixels, w, h);
  const settings = resolveSettings({ strokeCount: 5 });
  const candidates = generateCandidates(analysis, settings, 42);
  const selected = selectBest(candidates, analysis, 3);
  assertEqual(selected.length, 3);
  // Scores should be descending
  if (selected[0].score < selected[2].score) {
    throw new Error('Selected shapes should be sorted by score descending');
  }
});

test('scoreShape returns value in [0, 1]', () => {
  const w = 10, h = 10;
  const pixels = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = 128; pixels[i+1] = 128; pixels[i+2] = 128; pixels[i+3] = 255;
  }
  const analysis = analyzeImage(pixels, w, h);
  const shape = createShape({ type: 'S', params: [5, 5, 8, 8, 2, 2, 2, 0] });
  const score = scoreShape(shape, analysis);
  if (score < 0 || score > 1) {
    throw new Error(`Score out of range: ${score}`);
  }
});

// ─── Exporter ─────────────────────────────────────────────────────
console.log('\nExporter:');

test('exportProject/importProject round-trip', () => {
  const settings = resolveSettings({ style: 'pencil' });
  const layers = [{
    id: 0,
    name: 'Background',
    visible: true,
    opacity: 1,
    blendMode: 'normal',
    strokes: [createShape({ type: 'S', params: [5, 5, 10, 10, 15, 15, 2, 0] })],
    locked: false,
  }];
  const json = exportProject(layers, settings, {
    width: 100, height: 100, background: '#ffffff', imageData: 'data:image/png;base64,abc'
  });
  const project = importProject(json);
  assertEqual(project.version, '1.0');
  assertEqual(project.width, 100);
  assertEqual(project.layers.length, 1);
  assertEqual(project.layers[0].strokes.length, 1);
  assertEqual(project.image, 'data:image/png;base64,abc');
});

test('importProject rejects invalid JSON', () => {
  try {
    importProject('{"version": "1.0"}'); // missing layers
    throw new Error('Should have thrown');
  } catch (err) {
    if (!err.message.includes('Invalid project')) {
      throw err;
    }
  }
});

test('exportHTML includes canvas and runtime', () => {
  const layers = [{
    id: 0, name: 'BG', visible: true, opacity: 1, blendMode: 'normal',
    strokes: [createShape({ type: 'S', params: [5, 5, 10, 10, 15, 15, 2, 0] })],
    locked: false,
  }];
  const styleList = ['pencil'];
  const html = exportHTML(layers, {
    width: 100, height: 100, format: 'packed',
    strokeDuration: 0.5, background: '#ffffff', styleList,
  });
  if (!html.includes('<canvas')) {
    throw new Error('HTML should contain a canvas element');
  }
  if (!html.includes('RUNTIME')) {
    throw new Error('HTML should include runtime script');
  }
});

test('packLayers produces base64', () => {
  const layers = [{
    id: 0, strokes: [createShape({ type: 'S', params: [5, 5, 10, 10, 15, 15, 2, 0] })],
  }];
  const packed = packLayers(layers, ['pencil']);
  if (packed.length < 10) {
    throw new Error('Packed data too short');
  }
});

// ─── Structure tensor (Phase 1.2) ─────────────────────────────────
console.log('\nStructure tensor:');

/**
 * Build an RGBA image whose luminance is given by fn(x, y) -> 0..255.
 * @param {number} w
 * @param {number} h
 * @param {(x:number,y:number)=>number} fn
 * @returns {Uint8ClampedArray}
 */
function makeLumImage(w, h, fn) {
  const px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = Math.max(0, Math.min(255, Math.round(fn(x, y))));
      const i = (y * w + x) * 4;
      px[i] = px[i + 1] = px[i + 2] = v;
      px[i + 3] = 255;
    }
  }
  return px;
}

test('structure tensor: vertical stripes → tangent ~ PI/2', () => {
  const w = 48, h = 48;
  const px = makeLumImage(w, h, (x) => (x * 255) / (w - 1)); // ramp along x
  const a = analyzeImage(px, w, h);
  if (!a.structure) throw new Error('analysis.structure missing');
  const st = a.structure;
  assertEqual(st.orientation.length, w * h);
  assertEqual(st.coherence.length, w * h);
  assertEqual(st.energy.length, w * h);
  const theta = sampleStructure(st.orientation, w, h, w / 2, h / 2);
  assertApprox(theta, Math.PI / 2, 0.2, 'tangent for vertical stripes');
  const coh = sampleStructure(st.coherence, w, h, w / 2, h / 2);
  if (coh < 0.9) throw new Error(`coherence should be high for a clean ramp, got ${coh}`);
});

test('structure tensor: horizontal stripes → tangent ~ 0', () => {
  const w = 48, h = 48;
  const px = makeLumImage(w, h, (x, y) => (y * 255) / (h - 1)); // ramp along y
  const a = analyzeImage(px, w, h);
  const theta = sampleStructure(a.structure.orientation, w, h, w / 2, h / 2);
  assertApprox(theta, 0, 0.2, 'tangent for horizontal stripes');
});

test('structure tensor: diagonal stripes → tangent ~ 3PI/4', () => {
  const w = 48, h = 48;
  const px = makeLumImage(w, h, (x, y) => ((x + y) * 255) / (w + h - 2));
  const a = analyzeImage(px, w, h);
  const theta = sampleStructure(a.structure.orientation, w, h, w / 2, h / 2);
  assertApprox(theta, (3 * Math.PI) / 4, 0.25, 'tangent for diagonal stripes');
});

test('structure tensor: flat image → zero energy/coherence, no NaN', () => {
  const w = 20, h = 20;
  const px = makeLumImage(w, h, () => 128);
  const a = analyzeImage(px, w, h);
  const st = a.structure;
  for (const arr of [st.orientation, st.coherence, st.energy]) {
    for (let i = 0; i < arr.length; i++) {
      if (!Number.isFinite(arr[i])) throw new Error(`non-finite value at ${i}: ${arr[i]}`);
    }
  }
  assertApprox(sampleStructure(st.energy, w, h, 10, 10), 0, 1e-4, 'flat energy');
  assertApprox(sampleStructure(st.coherence, w, h, 10, 10), 0, 1e-3, 'flat coherence');
});

test('structure tensor: deterministic + finite', () => {
  const w = 24, h = 24;
  const px = makeLumImage(w, h, (x, y) => Math.sin(x * 0.6) * 60 + Math.cos(y * 0.4) * 60 + 128);
  const a1 = analyzeImage(px, w, h);
  const a2 = analyzeImage(px, w, h);
  for (const key of ['orientation', 'coherence', 'energy']) {
    assertEqual(Array.from(a1.structure[key]), Array.from(a2.structure[key]), `${key} deterministic`);
    for (let i = 0; i < a1.structure[key].length; i++) {
      if (!Number.isFinite(a1.structure[key][i])) throw new Error(`non-finite ${key}[${i}]`);
    }
  }
});

test('sampleStructure clamps out-of-range coordinates', () => {
  const w = 16, h = 16;
  const px = makeLumImage(w, h, (x) => (x * 255) / (w - 1));
  const a = analyzeImage(px, w, h);
  const st = a.structure;
  for (const [x, y] of [[-500, 5], [5, -500], [9999, 5], [5, 9999], [-1, -1]]) {
    const v = sampleStructure(st.orientation, w, h, x, y);
    if (!Number.isFinite(v)) throw new Error(`non-finite at (${x},${y}): ${v}`);
    const c = sampleStructure(st.coherence, w, h, x, y);
    if (!Number.isFinite(c)) throw new Error(`non-finite coherence at (${x},${y}): ${c}`);
  }
});

test('structure tensor: can be disabled', () => {
  const px = makeLumImage(8, 8, () => 100);
  const a = analyzeImage(px, 8, 8, { structure: false });
  assertEqual(a.structure, null);
});

test('structureDebugRGBA returns full RGBA buffer', () => {
  const w = 16, h = 16;
  const px = makeLumImage(w, h, (x) => (x * 255) / (w - 1));
  const a = analyzeImage(px, w, h);
  const rgba = structureDebugRGBA(a.structure);
  assertEqual(rgba.length, w * h * 4);
  for (let i = 3; i < rgba.length; i += 4) {
    if (rgba[i] !== 255) throw new Error('alpha should be 255');
  }
});

test('computeStructureTensor works standalone', () => {
  const w = 8, h = 8, n = w * h;
  const gx = new Float32Array(n).fill(10);   // constant horizontal gradient
  const gy = new Float32Array(n).fill(0);
  const st = computeStructureTensor(gx, gy, w, h, { radius: 1 });
  const theta = sampleStructure(st.orientation, w, h, 4, 4);
  assertApprox(theta, Math.PI / 2, 0.01, 'tangent for pure-x gradient');
  assertApprox(sampleStructure(st.coherence, w, h, 4, 4), 1, 0.01, 'coherence');
});

test('generator respects alignToStructure (vertical stripes)', () => {
  const w = 48, h = 48;
  const px = makeLumImage(w, h, (x) => (x * 255) / (w - 1));
  const analysis = analyzeImage(px, w, h);
  const base = { style: 'pencil', strokeCount: 400, alignToGradient: true };

  const dirCos = (settings) => {
    const cands = generateCandidates(analysis, resolveSettings(settings), 12345);
    const s = cands.filter(c => c.type === 'S');
    if (s.length < 20) throw new Error(`too few S strokes: ${s.length}`);
    let sum = 0;
    for (const c of s) {
      const dx = c.params[4] - c.params[0];
      const dy = c.params[5] - c.params[1];
      sum += Math.abs(Math.cos(Math.atan2(dy, dx)));
    }
    return sum / s.length;
  };

  const offCos = dirCos({ ...base, alignToStructure: false });
  const onCos = dirCos({ ...base, alignToStructure: true });
  if (!(offCos > 0.7)) throw new Error(`gradient mode should keep strokes near-horizontal, mean|cos|=${offCos}`);
  if (!(onCos < 0.5)) throw new Error(`structure mode should rotate strokes to vertical, mean|cos|=${onCos}`);
});

// ─── Optimiser core (Track R1) ────────────────────────────────────
console.log('\nOptimiser (Track R1):');

/**
 * Build an RGBA image from a fn(x, y) -> [r, g, b] mapping.
 * @param {number} w
 * @param {number} h
 * @param {(x:number,y:number)=>number[]} fn
 * @returns {Uint8ClampedArray}
 */
function makeRGBImage(w, h, fn) {
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

test('optimiser: default stroke budget is the R1 bench budget', () => {
  assertEqual(OPTIMISER_DEFAULTS.count, 400);
});

test('optimiser: deterministic for the same seed', () => {
  const px = makeRGBImage(48, 48, (x, y) => [(x * 5) & 255, (y * 5) & 255, 128]);
  const r1 = optimise(analyzeImage(px, 48, 48), { count: 40, seed: 99 });
  const r2 = optimise(analyzeImage(px, 48, 48), { count: 40, seed: 99 });
  assertEqual(r1.shapes, r2.shapes, 'shape lists should be identical');
});

test('optimiser: honours count and returns valid shapes', () => {
  const px = makeRGBImage(48, 48, (x, y) => [(x * 5) & 255, (y * 5) & 255, 128]);
  const r = optimise(analyzeImage(px, 48, 48), { count: 40, seed: 7 });
  assertEqual(r.shapes.length, 40);
  for (const s of r.shapes) {
    if (!isValidShape(s)) throw new Error('optimiser emitted an invalid shape');
  }
});

test('optimiser: reduces error and fits a smooth target', () => {
  const px = makeRGBImage(64, 64, (x, y) => [(x * 255) / 63, (y * 255) / 63, 128]);
  const r = optimise(analyzeImage(px, 64, 64), { count: 150, seed: 1 });
  if (!(r.stats.finalError < r.stats.initialError)) {
    throw new Error(`no error reduction: ${r.stats.initialError} -> ${r.stats.finalError}`);
  }
  if (!(r.stats.simMae > 90)) {
    throw new Error(`simMae too low on a smooth target: ${r.stats.simMae}`);
  }
});

test('optimiser: a flat target needs no strokes', () => {
  const px = makeRGBImage(32, 32, () => [50, 100, 150]);
  const r = optimise(analyzeImage(px, 32, 32), { count: 100, seed: 3 });
  assertEqual(r.shapes.length, 0);
});

test('optimiser: placement is error-driven (drawn to the error region)', () => {
  const S = 96, R = S * 0.25;
  const px = makeRGBImage(S, S, (x, y) =>
    Math.hypot(x - S / 2, y - S / 2) < R ? [235, 35, 35] : [20, 20, 30]);
  const r = optimise(analyzeImage(px, S, S), { count: 120, seed: 12345 });
  const inside = r.shapes.filter((s) => {
    const d = Math.hypot(s.params[0] - S / 2, s.params[1] - S / 2);
    return d < R * 1.1;
  }).length;
  const frac = inside / r.shapes.length;
  // The disc covers ~20% of the image; error-driven placement must over-serve it.
  if (!(frac > 0.4)) {
    throw new Error(`only ${(frac * 100).toFixed(0)}% of strokes landed on the error region`);
  }
});

// ─── Optimiser multi-scale (Track R2) ─────────────────────────────
console.log('\nOptimiser multi-scale (Track R2):');

test('optimiser: scale plan is coarse→fine (radii/blur shrink, weights sum to 1)', () => {
  const plan = buildScalePlan(resolveOptimiserOptions({}), 10);
  assertEqual(plan.length, 3, 'three passes by default');
  for (let i = 1; i < plan.length; i++) {
    if (!(plan[i].radiusMul < plan[i - 1].radiusMul)) {
      throw new Error('radius multiplier must shrink from coarse to fine');
    }
  }
  if (plan[plan.length - 1].blurR !== 0) {
    throw new Error('the finest pass must work against the unblurred target');
  }
  if (!(plan[0].blurR > 0)) throw new Error('the coarse pass must use a blurred reference');
  if (!(plan[0].weight > plan[plan.length - 1].weight)) {
    throw new Error('the coarse pass should carry the larger budget share');
  }
  const wsum = plan.reduce((s, p) => s + p.weight, 0);
  assertApprox(wsum, 1, 1e-6, 'pass weights must sum to 1');
});

test('optimiser: scales:1 collapses to a single unblurred pass', () => {
  const plan = buildScalePlan(resolveOptimiserOptions({ scales: 1 }), 10);
  assertEqual(plan.length, 1);
  assertEqual(plan[0].weight, 1);
  assertEqual(plan[0].blurR, 0);
  assertEqual(plan[0].radiusMul, 1);
});

test('optimiser: multi-scale still emits exactly the stroke budget', () => {
  const S = 96;
  const px = makeRGBImage(S, S, (x) => (x < S / 2 ? [200, 40, 40] : [30, 60, 150]));
  const r = optimise(analyzeImage(px, S, S), { count: 120, seed: 5 });
  assertEqual(r.shapes.length, 120);
  assertEqual(r.stats.scales, 3);
});

test('optimiser: multi-scale beats a single pass on a structured target', () => {
  const S = 96;
  // Flat colour fields + hard edges — exactly the case coarse→fine exists for.
  const px = makeRGBImage(S, S, (x, y) => {
    const d = Math.hypot(x - S / 2, y - S / 2);
    if (d < S * 0.22) return [220, 60, 60];
    if (x < S / 2 && y < S / 2) return [40, 70, 120];
    if (x >= S / 2 && y < S / 2) return [200, 190, 120];
    if (x < S / 2 && y >= S / 2) return [60, 150, 90];
    return [30, 30, 40];
  });
  const an = analyzeImage(px, S, S);
  const one = optimise(an, { count: 300, seed: 12345, scales: 1 });
  const multi = optimise(an, { count: 300, seed: 12345, scales: 3 });
  if (!(multi.stats.simMae > one.stats.simMae + 0.5)) {
    throw new Error(`multi-scale did not beat a single pass: ${one.stats.simMae} -> ${multi.stats.simMae}`);
  }
});

test('optimiser: multi-scale is deterministic for the same seed', () => {
  const S = 80;
  const px = makeRGBImage(S, S, (x, y) => [x * 3, y * 3, 128]);
  const a = optimise(analyzeImage(px, S, S), { count: 60, seed: 321 });
  const b = optimise(analyzeImage(px, S, S), { count: 60, seed: 321 });
  assertEqual(a.shapes, b.shapes, 'multi-scale shape lists should be identical');
});

// ─── Layer styles — Phase 2.2 ─────────────────────────────────────
console.log('\nLayer styles (Phase 2.2):');

test('resolveLayerStyles: empty inputs are a null no-op', () => {
  assertEqual(resolveLayerStyles(undefined), null);
  assertEqual(resolveLayerStyles(null), null);
  assertEqual(resolveLayerStyles(''), null);
  assertEqual(resolveLayerStyles('   '), null);
  assertEqual(resolveLayerStyles({}), null);
});

test('resolveLayerStyles: a single style string maps every tonal band', () => {
  const r = resolveLayerStyles('ink');
  for (const n of TONAL_LAYER_NAMES) assertEqual(r[n], 'ink', `${n} band`);
});

test('resolveLayerStyles: an object is filtered to non-empty string values', () => {
  const r = resolveLayerStyles({ background: 'watercolor', midtone: 'ink', junk: 7, empty: '' });
  assertEqual(r, { background: 'watercolor', midtone: 'ink' });
});

test('resolveLayerStyles: accepts a Map', () => {
  const r = resolveLayerStyles(new Map([['shadows', 'charcoal']]));
  assertEqual(r, { shadows: 'charcoal' });
});

test('applyLayerStyles: restamps each shape by its band', () => {
  const shapes = [
    { layerName: 'background', style: 'pencil' },
    { layerName: 'midtone', style: 'pencil' },
    { layerName: 'highlights', style: 'pencil' },
  ];
  const out = applyLayerStyles(shapes, { background: 'watercolor', midtone: 'ink' });
  assertEqual(out === shapes, true, 'returns the same array');
  assertEqual(shapes.map(s => s.style), ['watercolor', 'ink', 'pencil']);
});

test('applyLayerStyles: a null spec leaves every shape untouched', () => {
  const shapes = [{ layerName: 'midtone', style: 'pencil' }, { layerName: 'background', style: 'oil' }];
  applyLayerStyles(shapes, null);
  assertEqual(shapes.map(s => s.style), ['pencil', 'oil']);
});

test('applyLayerStyles: falls back to the numeric layer index', () => {
  const shapes = [{ layer: 1, style: 'pencil' }];
  applyLayerStyles(shapes, { 1: 'ink' });
  assertEqual(shapes[0].style, 'ink');
});

test('shapeLayerKey: prefers layerName, then stringifies layer', () => {
  assertEqual(shapeLayerKey({ layerName: 'midtone', layer: 3 }), 'midtone');
  assertEqual(shapeLayerKey({ layer: 0 }), '0');
  assertEqual(shapeLayerKey({}), null);
  assertEqual(shapeLayerKey(null), null);
});

test('preserveLayerProps: carries user props across a rebuild by _name', () => {
  const prev = [{ _name: 'midtone', visible: false, opacity: 0.4, blendMode: 'multiply', style: 'ink', strokes: [1, 2] }];
  const fresh = [{ _name: 'midtone', visible: true, opacity: 1, blendMode: 'normal', strokes: [] }];
  preserveLayerProps(fresh, prev);
  assertEqual([fresh[0].visible, fresh[0].opacity, fresh[0].blendMode, fresh[0].style],
    [false, 0.4, 'multiply', 'ink']);
  assertEqual(fresh[0].strokes, [], 'strokes must NOT be carried over');
});

test('preserveLayerProps: unmatched layers keep their defaults', () => {
  const fresh = [{ name: 'Background', visible: true }];
  preserveLayerProps(fresh, [{ name: 'Layer 1', visible: false }]);
  assertEqual(fresh[0].visible, true);
});

// ─── Summary ──────────────────────────────────────────────────────
console.log('\n=== Results ===');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(failed === 0 ? '\n✅ All tests passed!' : '\n❌ Some tests failed.');
process.exit(failed === 0 ? 0 : 1);
