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
import { analyzeImage, sampleRegion, sampleLuminance, sampleEdge } from '../js/engine/analyzer.js';
import {
  generateCandidates, resolveSettings, DEFAULT_SETTINGS,
  orderShapes, estimateShapeCount
} from '../js/engine/generator.js';
import { selectBest, selectGreedyResidual, scoreShape } from '../js/engine/scorer.js';
import { exportProject, importProject, packLayers, exportHTML } from '../js/engine/exporter.js';

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

// ─── Summary ──────────────────────────────────────────────────────
console.log('\n=== Results ===');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(failed === 0 ? '\n✅ All tests passed!' : '\n❌ Some tests failed.');
process.exit(failed === 0 ? 0 : 1);
