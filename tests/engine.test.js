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
import {
  REGION_DEFAULTS, quantizeBins, labelComponents, pcaFromStats, buildRegions, fitEllipse
} from '../js/engine/regions.js';
import {
  PROFILE_SCHEMA_VERSION, PROFILE_ROLES, PROFILE_DEFAULTS, validateProfile, normalizeProfile,
  profileToSettings, profileToLayerStyles, profileToLayerProps, applyProfile, profileFromSettings
} from '../js/engine/profile.js';
import {
  toFloatRGB, averageColor, rasterizeShapes, meanAbsError, simMae as simMaeFromMae, ssimLuma, metricsVsTarget,
  weightedSsimLuma, maskedMetrics, maskedMetricsVsTarget,
  toRGBA, histogramDistance, orientationMatch, valueMapDistance,
  STYLE_MATCH_WEIGHTS, refPacketDistance, refPacketMatch
} from '../js/engine/metrics.js';
import {
  KNOB_SET, getKnobDefaults, clampKnobs, profileToOptimiserOptions, scoreProfile,
  TONAL_BANDS, scoreProfileLayers, STYLE_PROFILE_DEFAULTS, scoreProfileStyle
} from '../js/engine/score.js';
import {
  SEARCH_DEFAULTS, searchableKnobs, profileKnobValues, knobsToProfile, knobsToOptimiser, searchProfile
} from '../js/engine/propose.js';
import {
  MEMORY_VERSION, HASH_GRID, averageHash, hamming, profileSignature, createMemory
} from '../js/engine/memory.js';
import { GATE_DEFAULTS, evaluateSet, gateChange, gateVariants } from '../js/engine/gate.js';
import { buildProposalPrompt, parseProposal, VISION_PROPOSE_DEFAULTS } from '../js/engine/vision-propose.js';
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

// ─── Regions — CCL + PCA (Track R3) ───────────────────────────────
console.log('\nRegions — CCL + PCA (Track R3):');

test('regions: quantizeBins groups near colours and separates distinct ones', () => {
  const px = new Uint8ClampedArray(4 * 4); // 4 pixels
  const set = (i, r, g, b) => { px[i * 4] = r; px[i * 4 + 1] = g; px[i * 4 + 2] = b; px[i * 4 + 3] = 255; };
  set(0, 10, 10, 10); set(1, 12, 11, 9); set(2, 200, 10, 10); set(3, 205, 12, 11);
  const bins = quantizeBins(px, 4, 1, 6);
  assertEqual(bins[0], bins[1], 'near-identical colours should share a bin');
  assertEqual(bins[2], bins[3], 'near-identical colours should share a bin');
  if (bins[0] === bins[2]) throw new Error('distinct colours must land in different bins');
});

test('regions: labelComponents respects 4- vs 8-connectivity', () => {
  // Two same-bin pixels touching only on a corner (2x2 map).
  const diag = new Int32Array([1, 0, 0, 1]);
  const c4 = labelComponents(diag, 2, 2, 4);
  const c8 = labelComponents(diag, 2, 2, 8);
  assertEqual(c4.stats[c4.labels[0] - 1].area, 1, 'corner-touching pixels stay split at 4-connectivity');
  assertEqual(c8.stats[c8.labels[0] - 1].area, 2, 'corner-touching pixels join at 8-connectivity');
  // A 3x3 plus of bin 1 is one 4-connected component spanning all 5 arms.
  const plus = new Int32Array([0, 1, 0, 1, 1, 1, 0, 1, 0]);
  const lab = labelComponents(plus, 3, 3, 4);
  assertEqual(lab.stats[lab.labels[4] - 1].area, 5, 'the plus is one 4-connected component');
});

test('regions: pcaFromStats reads the principal axis of a uniform bar', () => {
  const s = { area: 0, sumX: 0, sumY: 0, sumXX: 0, sumXY: 0, sumYY: 0, minX: 0, minY: 0, maxX: 0, maxY: 0 };
  for (let y = 0; y < 6; y++) for (let x = 0; x < 30; x++) {
    s.area++; s.sumX += x; s.sumY += y; s.sumXX += x * x; s.sumXY += x * y; s.sumYY += y * y;
  }
  const p = pcaFromStats(s);
  assertApprox(p.angle, 0, 1e-9, 'a horizontal bar has a 0-radian major axis');
  if (!(p.elong > 3)) throw new Error(`a 30x6 bar should be strongly elongated: ${p.elong}`);
});

test('regions: fitEllipse derives half-extents from the eigenvalue spread', () => {
  const fit = fitEllipse({ l1: 300, l2: 3, angle: 0 });
  assertApprox(fit.halfMajor, 0.5 * Math.sqrt(12 * 300), 1e-9);
  assertApprox(fit.halfMinor, 0.5 * Math.sqrt(12 * 3), 1e-9);
  assertEqual(fit.angle, 0);
});

test('regions: buildRegions fits a bar, drops the background, and is deterministic', () => {
  const W = 96, H = 96;
  const px = makeRGBImage(W, H, (x, y) =>
    (x >= 18 && x < 78 && y >= 40 && y < 46) ? [230, 60, 60] : [40, 44, 54]);
  const opts = { levels: 6, minArea: 12, maxAreaFrac: 0.3 };
  const regions = buildRegions({ pixels: px, width: W, height: H }, opts);
  const bar = regions.find((r) => r.elong >= 2.5);
  if (!bar) throw new Error('expected an elongated bar region');
  if (Math.abs(bar.angle) > 0.2) throw new Error(`horizontal bar should fit ~0 rad: ${bar.angle}`);
  if (!(bar.elong > 3)) throw new Error(`60x6 bar should be strongly elongated: ${bar.elong}`);
  for (const r of regions) {
    if (r.area > 0.3 * W * H) throw new Error('the full-canvas background must be excluded');
  }
  const again = buildRegions({ pixels: px, width: W, height: H }, opts);
  assertEqual(again.length, regions.length);
  assertApprox(again[0].angle, regions[0].angle, 1e-12);
});

test('optimiser: region-init defaults track the region module', () => {
  assertEqual(OPTIMISER_DEFAULTS.regionLevels, REGION_DEFAULTS.levels);
  assertEqual(OPTIMISER_DEFAULTS.regionMinArea, REGION_DEFAULTS.minArea);
  assertEqual(OPTIMISER_DEFAULTS.regionMaxAreaFrac, REGION_DEFAULTS.maxAreaFrac);
});

// ─── Optimiser region init (Track R3) ─────────────────────────────
console.log('\nOptimiser region init (Track R3):');

test('optimiser: regionInit off emits no region strokes', () => {
  const px = makeRGBImage(96, 96, (x) => (x < 48 ? [200, 40, 40] : [30, 60, 150]));
  const r = optimise(analyzeImage(px, 96, 96), { count: 120, seed: 5, regionInit: false });
  assertEqual(r.stats.regions, 0);
  assertEqual(r.shapes.filter((s) => s.id.startsWith('r3_')).length, 0);
});

test('optimiser: region init keeps the stroke budget exact and tags its strokes', () => {
  const W = 96, H = 96;
  const px = makeRGBImage(W, H, (x, y) =>
    (x >= 18 && x < 78 && y >= 40 && y < 46) ? [230, 60, 60] : [40, 44, 54]);
  const r = optimise(analyzeImage(px, W, H), { count: 120, seed: 31 });
  assertEqual(r.shapes.length, 120, 'budget stays exact with an init pass');
  if (!(r.stats.regions > 0)) throw new Error('an elongated target should seed region strokes');
  assertEqual(r.shapes.filter((s) => s.id.startsWith('r3_')).length, r.stats.regions,
    'the first `regions` strokes are the tagged init strokes');
});

test('optimiser: region init orients strokes along the principal axis', () => {
  const W = 96, H = 96;
  const px = makeRGBImage(W, H, (x, y) =>
    (y >= 18 && y < 78 && x >= 40 && x < 46) ? [230, 60, 60] : [40, 44, 54]);
  const r = optimise(analyzeImage(px, W, H), { count: 120, seed: 31 });
  if (!(r.stats.regions > 0)) throw new Error('expected region strokes on a vertical bar');
  const rot = r.shapes[0].params[4];
  if (!(Math.abs(rot) > 1.2 && Math.abs(rot) < 1.95)) {
    throw new Error(`a vertical bar should seed ~90° strokes, got ${rot}`);
  }
});

test('optimiser: region init is deterministic for the same seed', () => {
  const W = 64, H = 64;
  const px = makeRGBImage(W, H, (x, y) =>
    (x >= 10 && x < 54 && y >= 28 && y < 34) ? [230, 60, 60] : [40, 44, 54]);
  const a = optimise(analyzeImage(px, W, H), { count: 80, seed: 7 });
  const b = optimise(analyzeImage(px, W, H), { count: 80, seed: 7 });
  assertEqual(a.shapes, b.shapes, 'region-init shape lists should be identical');
});

// ─── Style Profile consumer — Phase 4.1 ───────────────────────────
console.log('\nStyle Profile consumer (Phase 4.1):');

// The schema's own minimal example (docs/STYLE_PROFILE.md §4).
function exampleProfile() {
  return {
    schemaVersion: 1,
    id: '6f1c2b7e-3a4d-4e2b-9c11-0a7f5e9d1234',
    name: 'Loose Watercolour Study',
    version: '1.0.0',
    engine: { name: 'www-paint', version: '0.1.0' },
    global: {
      style: 'watercolor', strokeCount: 1400,
      strokeSize: { min: 2, max: 14, random: true },
      detailLevel: 0.6, styleStrength: 0.75, opacity: 0.85,
      pathOrder: 'free', colorMode: 'exact', multiLayer: true, seed: 324508639,
    },
    layers: [
      { role: 'background', style: 'wash', opacity: 0.9, order: 0 },
      { role: 'shadows', style: 'watercolor', opacity: 1.0, order: 1 },
      { role: 'highlights', style: 'pastel', opacity: 0.5, order: 4 },
    ],
    effects: [
      { core: 'paper-grain', params: { strength: 0.25 }, opacity: 0.4, blend: 'multiply', enabled: true },
    ],
    mediaModel: { kind: 'wet', wetness: 0.7, drying: 0.4, bleed: 0.5, granulation: 0.3, paper: 'coldpress-140' },
    provenance: { source: 'ai', model: 'vision-proposal-v1', rating: 4 },
  };
}

test('profile: validates the schema example and reports nothing', () => {
  const r = validateProfile(exampleProfile());
  assertEqual(r.ok, true, JSON.stringify(r.errors));
  assertEqual(r.errors.length, 0);
});

test('profile: rejects a non-object and missing required fields', () => {
  assertEqual(validateProfile(null).ok, false);
  assertEqual(validateProfile('nope').ok, false);
  const r = validateProfile({ schemaVersion: 1, global: {} });
  assertEqual(r.ok, false);
  const paths = r.errors.map((e) => e.path);
  if (!paths.includes('id') || !paths.includes('name') || !paths.includes('version')) {
    throw new Error(`expected missing id/name/version: ${paths.join(',')}`);
  }
});

test('profile: flags bad enum, range and hex values', () => {
  const p = exampleProfile();
  p.global.pathOrder = 'sideways';
  p.global.opacity = 1.5;
  p.global.palette = ['#GGGGGG'];
  p.layers[0].role = 'not-a-role';
  p.mediaModel.kind = 'soggy';
  const r = validateProfile(p);
  assertEqual(r.ok, false);
  const paths = r.errors.map((e) => e.path);
  for (const want of ['global.pathOrder', 'global.opacity', 'global.palette', 'layers[0].role', 'mediaModel.kind']) {
    if (!paths.includes(want)) throw new Error(`expected an error at ${want}: ${paths.join(',')}`);
  }
});

test('profile: normalizeProfile applies schema defaults without mutating input', () => {
  const p = { schemaVersion: 1, id: 'x', name: 'n', version: '1.0.0', global: { style: 'ink' } };
  const frozen = JSON.stringify(p);
  const n = normalizeProfile(p);
  assertEqual(n.global.pathOrder, PROFILE_DEFAULTS.pathOrder);
  assertEqual(n.global.multiLayer, false);
  assertEqual(n.global.strokeSize.min, PROFILE_DEFAULTS.strokeSize.min);
  assertEqual(JSON.stringify(p), frozen, 'normalizeProfile must not mutate its input');
});

test('profile: normalizeProfile is idempotent (even with no mediaModel)', () => {
  const p = { schemaVersion: 1, id: 'x', name: 'n', version: '1.0.0', global: {} };
  const once = normalizeProfile(p);
  const twice = normalizeProfile(once);
  assertEqual(JSON.stringify(twice), JSON.stringify(once), 're-normalising must be a fixed point');
  assertEqual(once.mediaModel, null);
  const withMedia = profileToSettings({ schemaVersion: 1, id: 'x', name: 'n', version: '1.0.0', global: {}, mediaModel: { kind: 'wet' } });
  assertEqual('style' in withMedia, false);
});

test('profile: profileToSettings maps the global block onto engine settings', () => {
  const s = profileToSettings(exampleProfile());
  assertEqual(s.style, 'watercolor');
  assertEqual(s.strokeCount, 1400);
  assertEqual(s.strokeSize.max, 14);
  assertEqual(s.detailLevel, 0.6);
  assertEqual(s.styleStrength, 0.75);
  assertEqual(s.opacity, 0.85);
  assertEqual(s.pathOrder, 'free');
  assertEqual(s.multiLayer, true);
  // a profile without a style must not force one
  const noStyle = profileToSettings({ schemaVersion: 1, id: 'x', name: 'n', version: '1.0.0', global: {} });
  assertEqual('style' in noStyle, false);
});

test('profile: profileToLayerStyles keeps only enabled roles that set a style', () => {
  const styles = profileToLayerStyles(exampleProfile());
  assertEqual(styles.background, 'wash');
  assertEqual(styles.highlights, 'pastel');
  assertEqual('midtone' in styles, false, 'roles the profile does not mention inherit');
  const p = exampleProfile();
  p.layers = [{ role: 'shadows', enabled: false, style: 'ink' }];
  assertEqual(profileToLayerStyles(p), null, 'a disabled override is a no-op');
});

test('profile: profileToLayerProps carries opacity/blend/order/visibility', () => {
  const props = profileToLayerProps(exampleProfile());
  assertEqual(props.background.opacity, 0.9);
  assertEqual(props.background.order, 0);
  assertEqual('shadows' in props, true);
});

test('profile: applyProfile expands the whole profile for generate()', () => {
  const r = applyProfile(exampleProfile());
  assertEqual(r.valid, true);
  assertEqual(r.seed, 324508639);
  assertEqual(r.multiLayer, true);
  assertEqual(r.mediaModel.kind, 'wet');
  assertEqual(r.settings.style, 'watercolor');
  assertEqual(r.layerStyles.highlights, 'pastel');
});

test('profile: profileFromSettings round-trips back to a valid profile', () => {
  const s = profileToSettings(exampleProfile());
  const built = profileFromSettings(s, { name: 'Round Trip', provenance: { source: 'human' } });
  assertEqual(built.schemaVersion, PROFILE_SCHEMA_VERSION);
  const r = validateProfile(built);
  assertEqual(r.ok, true, JSON.stringify(r.errors));
  const back = profileToSettings(built);
  assertEqual(back.style, s.style);
  assertEqual(back.strokeCount, s.strokeCount);
  assertEqual(back.detailLevel, s.detailLevel);
});

test('profile: PROFILE_ROLES match the engine named layers', () => {
  assertEqual(PROFILE_ROLES.join(','), 'background,shadows,outline,midtone,highlights');
});

// ─── Metrics — Harness H1 ─────────────────────────────────────────
console.log('\nMetrics (Harness H1):');

test('metrics: toFloatRGB + meanAbsError are exact on identical / uniform input', () => {
  const px = makeRGBImage(4, 4, () => [10, 20, 30]);
  const f = toFloatRGB(px, 4, 4);
  assertEqual(f.length, 4 * 4 * 3);
  assertApprox(meanAbsError(f, f), 0, 1e-9);
  const bright = makeRGBImage(4, 4, () => [20, 30, 40]); // every channel +10
  const g = toFloatRGB(bright, 4, 4);
  assertApprox(meanAbsError(f, g), 10, 1e-9, 'a uniform +10 per channel → MAE 10');
});

test('metrics: simMae maps MAE 0 -> 100 and 255 -> 0', () => {
  assertApprox(simMaeFromMae(0), 100, 1e-9);
  assertApprox(simMaeFromMae(255), 0, 1e-9);
});

test('metrics: ssimLuma is 1 for identical buffers and < 1 for different ones', () => {
  const a = toFloatRGB(makeRGBImage(24, 24, (x) => [x * 8, x * 8, x * 8]), 24, 24);
  const b = toFloatRGB(makeRGBImage(24, 24, (x) => [(23 - x) * 8, (23 - x) * 8, (23 - x) * 8]), 24, 24);
  assertApprox(ssimLuma(a, a, 24, 24), 1, 1e-6);
  if (!(ssimLuma(a, b, 24, 24) < 0.999)) throw new Error('different buffers must score below 1');
});

test('metrics: rasterizeShapes paints a dab at its centre and is deterministic', () => {
  const shape = { type: 'E', params: [8, 8, 4, 4, 0, 0, 0, 0], color0: [200, 0, 0], color1: [200, 0, 0], alpha: 1 };
  const buf = rasterizeShapes([shape], 16, 16, [0, 0, 0]);
  assertEqual(buf.length, 16 * 16 * 3);
  const c = (8 * 16 + 8) * 3;
  assertApprox(buf[c], 200, 1e-6, 'centre takes the dab colour');
  assertApprox(buf[0], 0, 1e-6, 'a far corner keeps the background');
  const again = rasterizeShapes([shape], 16, 16, [0, 0, 0]);
  assertEqual(Array.from(buf), Array.from(again));
});

// ─── Parameter surface + scoring — Harness H1 ─────────────────────
console.log('\nParameter surface + scoring (Harness H1):');

test('knobs: KNOB_SET is well-formed (unique names, valid ranges, defaults)', () => {
  const names = new Set();
  for (const k of KNOB_SET) {
    if (!k.name || names.has(k.name)) throw new Error(`duplicate/invalid knob name: ${k.name}`);
    names.add(k.name);
    if (!k.type || !k.group || !k.target) throw new Error(`knob ${k.name} missing type/group/target`);
    if (k.default === undefined) throw new Error(`knob ${k.name} has no default`);
    if ((k.type === 'number' || k.type === 'integer') && !(k.min < k.max)) {
      throw new Error(`knob ${k.name} needs min < max`);
    }
    if (k.type === 'integer' && !Number.isInteger(k.default)) throw new Error(`knob ${k.name} default must be an integer`);
  }
});

test('knobs: getKnobDefaults matches KNOB_SET', () => {
  const d = getKnobDefaults();
  for (const k of KNOB_SET) assertEqual(d[k.name], k.default);
  assertEqual(Object.keys(d).length, KNOB_SET.length);
});

test('knobs: clampKnobs bounds, rounds, coerces and drops unknown keys', () => {
  const c = clampKnobs({ strokeCount: 999999, detailLevel: 5, opacity: -1, smart: 1, scales: 2.6, bogus: 7 });
  assertEqual(c.strokeCount, 200000);
  assertEqual(c.detailLevel, 1);
  assertEqual(c.opacity, 0);
  assertEqual(c.smart, true);
  assertEqual(c.scales, 3, 'integers are rounded then clamped');
  assertEqual('bogus' in c, false);
});

test('knobs: profileToOptimiserOptions maps the profile and lets overrides win', () => {
  const p = { schemaVersion: 1, id: 'x', name: 'n', version: '1.0.0', global: { strokeCount: 250, detailLevel: 0.4, opacity: 0.5, smart: true } };
  const o = profileToOptimiserOptions(p);
  assertEqual(o.count, 250);
  assertEqual(o.detail, 0.4);
  assertEqual(o.alpha, 0.5);
  assertEqual(o.structureAlign, true);
  const o2 = profileToOptimiserOptions(p, { count: 10, coverage: 1.5 });
  assertEqual(o2.count, 10);
  assertEqual(o2.coverage, 1.5);
});

test('score: scoreProfile measures a render and improves with more strokes', () => {
  const S = 96;
  const px = makeRGBImage(S, S, (x, y) =>
    Math.hypot(x - S / 2, y - S / 2) < S * 0.27 ? [220, 60, 60] : [30, 60, 150]);
  const image = { pixels: px, width: S, height: S };
  const prof = (count) => ({
    schemaVersion: 1, id: 'x', name: 'n', version: '1.0.0',
    global: { style: 'painterly', strokeCount: count, detailLevel: 0.6, opacity: 0.9, smart: true, seed: 12345 },
  });
  const a = scoreProfile(prof(80), image);
  const b = scoreProfile(prof(300), image);
  for (const m of [a, b]) {
    if (!Number.isFinite(m.simMae) || !Number.isFinite(m.ssim)) throw new Error('non-finite metric');
    if (!(m.simMae > 0 && m.simMae <= 100)) throw new Error(`simMae out of range: ${m.simMae}`);
  }
  if (!(b.simMae > a.simMae)) throw new Error(`more strokes should fit better: ${a.simMae} -> ${b.simMae}`);
  assertEqual(b.strokes, 300);
  // determinism
  const c = scoreProfile(prof(300), image);
  assertApprox(c.simMae, b.simMae, 1e-9);
  assertApprox(c.ssim, b.ssim, 1e-9);
});

// ─── Search proposer — Harness H2 ─────────────────────────────────
console.log('\nSearch proposer (Harness H2):');

// A base profile + a structured 64² target, reused by the H2 tests.
function h2Base(count) {
  return {
    schemaVersion: 1, id: 'x', name: 'n', version: '1.0.0',
    global: { style: 'painterly', strokeCount: count, detailLevel: 0.7, opacity: 0.9, smart: true, seed: 12345 },
  };
}
function h2Target(S = 64) {
  return {
    pixels: makeRGBImage(S, S, (x, y) =>
      Math.hypot(x - S / 2, y - S / 2) < S * 0.28 ? [220, 60, 60] : [30, 60, 150]),
    width: S, height: S,
  };
}

test('propose: searchableKnobs excludes strings, engine-only knobs and fixed ones', () => {
  const names = searchableKnobs().map((k) => k.name);
  if (names.includes('style') || names.includes('pathOrder')) throw new Error('string knobs must not be searched');
  if (names.includes('multiLayer')) throw new Error('engine-only knobs the optimiser ignores must not be searched');
  for (const k of searchableKnobs()) {
    if (!k.target.startsWith('optimiser.')) throw new Error(`${k.name} is not an optimiser target`);
  }
  const fixed = searchableKnobs(['strokeCount', 'scales']).map((k) => k.name);
  if (fixed.includes('strokeCount') || fixed.includes('scales')) throw new Error('fixed knobs must be excluded');
  assertEqual(names.includes('coverage'), true);
});

test('propose: profileKnobValues reads the base profile; knobsToProfile does not mutate it', () => {
  const base = h2Base(250);
  const vals = profileKnobValues(base);
  assertEqual(vals.strokeCount, 250);
  assertEqual(vals.detailLevel, 0.7);
  const next = knobsToProfile(base, { strokeCount: 10, detailLevel: 0.2 });
  assertEqual(next.global.strokeCount, 10);
  assertEqual(next.global.detailLevel, 0.2);
  assertEqual(base.global.strokeCount, 250, 'the base profile must not be mutated');
});

test('propose: knobsToOptimiser extracts only the optimiser-option overrides', () => {
  const o = knobsToOptimiser({ strokeCount: 200, coverage: 1.5, scales: 2, detailLevel: 0.3, style: 'ink' });
  assertEqual(o.coverage, 1.5);
  assertEqual(o.scales, 2);
  assertEqual('count' in o, false, 'count rides on the profile, not the optimiser override');
  assertEqual('style' in o, false);
});

test('propose: searchProfile beats the hand-set default at equal stroke count', () => {
  const base = h2Base(120);
  const r = searchProfile(base, h2Target(64), { method: 'cma', evaluations: 32, seed: 7 });
  assertEqual(r.knobs.strokeCount, 120, 'strokeCount stays fixed at the base value');
  assertEqual(r.evaluations, 32, 'the evaluation budget is respected');
  assertEqual(r.history.length, 32, 'every attempt is recorded (wins and losses)');
  if (!(r.score.simMae >= r.baseline.simMae)) throw new Error('the search must never return worse than the baseline');
  if (!r.improved) throw new Error(`CMA search failed to beat the default: ${r.baseline.simMae} -> ${r.score.simMae}`);
  assertEqual(r.profile.global.strokeCount, 120);
});

test('propose: searchProfile is deterministic for the same seed', () => {
  const base = h2Base(100);
  const a = searchProfile(base, h2Target(48), { method: 'cma', evaluations: 16, seed: 99 });
  const b = searchProfile(base, h2Target(48), { method: 'cma', evaluations: 16, seed: 99 });
  assertEqual(JSON.stringify(a.knobs), JSON.stringify(b.knobs));
  assertEqual(a.score.simMae, b.score.simMae);
});

test('propose: a fixed knob is held constant, and random respects the budget', () => {
  const base = h2Base(90);
  const r = searchProfile(base, h2Target(48), { method: 'random', evaluations: 12, seed: 3, fixed: ['strokeCount', 'scales'] });
  assertEqual(r.knobs.strokeCount, 90);
  assertEqual(r.knobs.scales, getKnobDefaults().scales, 'a fixed knob keeps its base value');
  assertEqual(r.evaluations, 12);
  assertEqual(SEARCH_DEFAULTS.objective, 'simMae');
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

// ─── Layer-aware scoring — Phase 2.2 ──────────────────────────────
console.log('\nLayer-aware scoring (Phase 2.2):');

test('metrics: an all-ones mask reproduces the whole-frame numbers exactly', () => {
  const S = 48;
  const target = makeRGBImage(S, S, (x, y) => [(x * 3) % 255, (y * 5) % 255, (x + y) % 255]);
  const rendered = new Float32Array(S * S * 3);
  for (let i = 0; i < rendered.length; i++) rendered[i] = (i * 7) % 255;
  const ones = new Float32Array(S * S).fill(1);
  const full = meanAbsError(rendered, toFloatRGB(target, S, S));
  const masked = maskedMetricsVsTarget(rendered, target, ones, S, S);
  assertApprox(masked.mae, full, 1e-9);
  assertApprox(masked.support, 1, 1e-9);
});

test('metrics: a zero mask selects nothing (mae 0, support 0, ssim 0)', () => {
  const S = 32;
  const target = makeRGBImage(S, S, () => [10, 20, 30]);
  const rendered = new Float32Array(S * S * 3).fill(200);
  const zero = new Float32Array(S * S);
  const m = maskedMetricsVsTarget(rendered, target, zero, S, S);
  assertEqual(m.mae, 0);
  assertEqual(m.support, 0);
  assertEqual(m.ssim, 0);
});

test('metrics: a half-covering mask reports that support fraction', () => {
  const S = 32;
  const target = makeRGBImage(S, S, () => [10, 20, 30]);
  const rendered = new Float32Array(S * S * 3).fill(200);
  const half = new Float32Array(S * S);
  for (let y = 0; y < S / 2; y++) for (let x = 0; x < S; x++) half[y * S + x] = 1;
  const m = maskedMetricsVsTarget(rendered, target, half, S, S);
  assertApprox(m.support, 0.5, 1e-9);
});

test('metrics: weightedSsimLuma ignores pixels outside the mask', () => {
  const S = 32;
  // Left half identical, right half wildly different; a mask over the left half
  // must score ~1, the same mask over the right half must score much lower.
  const a = new Float32Array(S * S * 3);
  const b = new Float32Array(S * S * 3);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const o = (y * S + x) * 3;
    for (let c = 0; c < 3; c++) { a[o + c] = (x + y + c) % 256; b[o + c] = x < S / 2 ? a[o + c] : (255 - a[o + c]); }
  }
  const left = new Float32Array(S * S), right = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) (x < S / 2 ? left : right)[y * S + x] = 1;
  const sLeft = weightedSsimLuma(a, b, S, S, left);
  const sRight = weightedSsimLuma(a, b, S, S, right);
  if (!(sLeft > sRight)) throw new Error(`mask did not isolate the band: left=${sLeft} right=${sRight}`);
});

test('score: scoreProfileLayers gives a deterministic per-band breakdown that aggregates', () => {
  const base = h2Base(120);
  const img = h2Target(64);
  const a = scoreProfileLayers(base, img, { seed: 7 });
  const b = scoreProfileLayers(base, img, { seed: 7 });
  assertEqual(JSON.stringify(a.layers), JSON.stringify(b.layers), 'deterministic');
  assertEqual(a.composite.simMae, b.composite.simMae);
  for (const band of TONAL_BANDS) {
    const L = a.layers[band];
    if (!L) throw new Error(`missing band ${band}`);
    if (!Number.isFinite(L.simMae) || !Number.isFinite(L.ssim)) throw new Error(`non-finite ${band}`);
  }
  const cov = TONAL_BANDS.reduce((s, k) => s + a.coverage[k], 0);
  assertApprox(cov, 1, 0.02, 'tonal coverage is a partition of unity');
  const cmae = TONAL_BANDS.reduce((s, k) => s + a.coverage[k] * a.layers[k].mae, 0) /
               TONAL_BANDS.reduce((s, k) => s + a.coverage[k], 0);
  assertApprox(a.composite.mae, cmae, 1e-9, 'composite is the coverage-weighted band MAE');
  assertEqual(a.overall !== undefined, true, 'whole-frame metrics still reported');
});

test('score: scoreProfile is unchanged by the layer-aware addition', () => {
  const r = scoreProfile(h2Base(200), h2Target(64));
  if (!Number.isFinite(r.simMae) || !Number.isFinite(r.ssim)) throw new Error('scoreProfile broke');
  assertEqual(r.strokes, 200);
});

// ─── Memory — Harness H4 ──────────────────────────────────────────
console.log('\nMemory (Harness H4):');

test('memory: averageHash is deterministic, identical images collide, hamming is symmetric', () => {
  const A = makeRGBImage(32, 32, (x, y) => [(x * 8) % 255, (y * 8) % 255, ((x + y) * 4) % 255]);
  const B = makeRGBImage(32, 32, (x, y) => [(x * 8) % 255, (y * 8) % 255, ((x + y) * 4) % 255]);
  const ha = averageHash(A, 32, 32), hb = averageHash(B, 32, 32);
  assertEqual(ha, hb);
  assertEqual(ha.length, 16);
  assertEqual(hamming(ha, hb), 0);
  assertEqual(hamming(ha, hb), hamming(hb, ha));
});

test('memory: averageHash separates very different images', () => {
  const flat = makeRGBImage(32, 32, () => [0, 0, 0]);
  const split = makeRGBImage(32, 32, (x) => (x < 16 ? [255, 255, 255] : [0, 0, 0]));
  const d = hamming(averageHash(flat, 32, 32), averageHash(split, 32, 32));
  if (!(d > 8)) throw new Error(`expected a large distance, got ${d}`);
});

test('memory: record / list / size / best, and ratings keep losses', () => {
  const m = createMemory();
  const img = makeRGBImage(24, 24, (x, y) => [(x * 10) % 255, (y * 10) % 255, 60]);
  const h = averageHash(img, 24, 24);
  m.record({ imageHash: h, knobs: { strokeCount: 120, coverage: 1.1 }, score: { simMae: 90 }, rating: 0 });
  m.record({ imageHash: h, knobs: { strokeCount: 120, coverage: 1.4 }, score: { simMae: 97 }, rating: 1 });
  m.record({ imageHash: 'ffffffffffffffff', knobs: { strokeCount: 120 }, score: { simMae: 99 }, rating: -1 });
  assertEqual(m.size(), 3);
  assertEqual(m.list({ rating: 1 }).length, 1);
  assertEqual(m.list({ minScore: 95 }).length, 2);
  assertEqual(m.list({ imageHash: h }).length, 2);
  const b = m.best(h);
  assertEqual(b.score.simMae, 97);
  assertEqual(b.rating, 1);
});

test('memory: retrieve ranks by Hamming distance, ties broken by score, deterministically', () => {
  const m = createMemory();
  m.record({ imageHash: '0000000000000001', knobs: { a: 1 }, score: { simMae: 80 } });
  m.record({ imageHash: '0000000000000002', knobs: { a: 2 }, score: { simMae: 99 } });
  m.record({ imageHash: 'ffffffffffffffff', knobs: { a: 3 }, score: { simMae: 100 } });
  const r = m.retrieve('0000000000000000', { limit: 5, maxDistance: 4 });
  assertEqual(r.length, 2, 'only the two near entries are within distance 4');
  assertEqual([r[0].distance, r[1].distance], [1, 1]);
  assertEqual(r[0].entry.score.simMae, 99, 'a distance tie breaks by score');
  assertEqual(JSON.stringify(m.retrieve('0000000000000000', { limit: 5, maxDistance: 4 })),
    JSON.stringify(r), 'retrieval is deterministic');
});

test('memory: warmStart returns the nearest entry knobs; null when nothing is near', () => {
  const m = createMemory();
  m.record({ imageHash: '0000000000000001', knobs: { strokeCount: 120, coverage: 1.3 }, score: { simMae: 96 } });
  const ws = m.warmStart('0000000000000000', { maxDistance: 4 });
  assertEqual(ws.init.coverage, 1.3);
  assertEqual(ws.distance, 1);
  assertEqual(typeof ws.from, 'number');
  assertEqual(m.warmStart('ffffffffffffffff', { maxDistance: 2 }), null);
});

test('memory: toJSON/load round-trips; a wrong version is refused and leaves the store intact', () => {
  const m = createMemory();
  m.record({ imageHash: '0000000000000001', knobs: { a: 1 }, score: { simMae: 90 } });
  const snap = JSON.parse(JSON.stringify(m.toJSON()));
  const m2 = createMemory();
  assertEqual(m2.load(snap), true);
  assertEqual(m2.size(), 1);
  assertEqual(m2.best('0000000000000001').score.simMae, 90);
  assertEqual(m2.load({ version: 999, entries: [] }), false);
  assertEqual(m2.size(), 1, 'a refused load leaves the store intact');
  assertEqual(m.toJSON().version, MEMORY_VERSION);
});

test('memory: the store is bounded (maxEntries evicts oldest)', () => {
  const m = createMemory({ maxEntries: 3 });
  for (let i = 0; i < 5; i++) m.record({ imageHash: '0000000000000000', knobs: { i }, score: { simMae: i } });
  assertEqual(m.size(), 3);
  assertEqual(m.best('0000000000000000').score.simMae, 4);
});

test('memory: profileSignature is order-independent; warm start seeds searchProfile', () => {
  assertEqual(profileSignature({ b: 2, a: 1 }), 'a=1|b=2');
  const base = { schemaVersion: 1, id: 'x', name: 'n', version: '1.0.0',
    global: { style: 'painterly', strokeCount: 120, detailLevel: 0.7, opacity: 0.9, smart: true, seed: 12345 } };
  const img = h2Target(48);
  const h = averageHash(img.pixels, 48, 48);
  const m = createMemory();
  m.record({ imageHash: h, knobs: { coverage: 1.2, elongation: 1.5 }, score: { simMae: 90 } });
  const ws = m.warmStart(h);
  const r = searchProfile(base, img, { evaluations: 8, seed: 5, init: ws ? ws.init : undefined });
  assertEqual(r.knobs.strokeCount, 120, 'the fixed knob is still held at the base value');
});

// ─── Benchmark gate — Harness H5 ──────────────────────────────────
console.log('\nBenchmark gate (Harness H5):');

test('gate: evaluateSet aggregates the objective over a set', () => {
  const imgs = [{ name: 'a' }, { name: 'b' }];
  const r = evaluateSet((im) => ({ simMae: im.name === 'a' ? 90 : 80 }), imgs);
  assertEqual(r.perImage.map(p => p.name), ['a', 'b']);
  assertEqual(r.perImage.map(p => p.value), [90, 80]);
  assertApprox(r.aggregate.mean, 85, 1e-9);
  assertEqual(r.aggregate.min, 80);
  assertEqual(r.objective, GATE_DEFAULTS.objective);
});

test('gate: improved needs approval — pending without it, keep with it, revert below minGain', () => {
  const imgs = [{ name: 'a' }, { name: 'b' }];
  const base = evaluateSet(() => ({ simMae: 90 }), imgs);
  const cand = evaluateSet(() => ({ simMae: 93 }), imgs);
  assertEqual(gateChange(base, cand).decision, 'pending');
  assertEqual(gateChange(base, cand, { approve: true }).decision, 'keep');
  assertEqual(gateChange(base, cand, { approve: true, minGain: 5 }).decision, 'revert');
  assertEqual(gateChange(base, cand, { approve: true }).requiresApproval, true);
});

test('gate: a regression reverts even when the mean improves', () => {
  const imgs = [{ name: 'a' }, { name: 'b' }];
  const base = evaluateSet(() => ({ simMae: 90 }), imgs);
  const cand = evaluateSet((im) => ({ simMae: im.name === 'a' ? 99 : 85 }), imgs);
  const g = gateChange(base, cand, { approve: true });
  assertEqual(g.improved, true);
  assertEqual(g.decision, 'revert');
  assertEqual(g.regressions.map(r => r.name), ['b']);
});

test('gate: a lost objective over the whole set reverts', () => {
  const imgs = [{ name: 'a' }];
  const base = evaluateSet(() => ({ simMae: 90 }), imgs);
  const cand = evaluateSet(() => ({ simMae: 88 }), imgs);
  const g = gateChange(base, cand, { approve: true });
  assertEqual(g.improved, false);
  assertEqual(g.decision, 'revert');
});

test('gate: gateVariants runs a real benchmark deterministically', () => {
  const imgs = [{ name: 'a', ...h2Target(48) }, { name: 'b', ...h2Target(64) }];
  const run = () => gateVariants(
    (im) => scoreProfile(h2Base(80), im),
    (im) => scoreProfile(h2Base(260), im),
    imgs, { approve: true });
  const g1 = run().gate, g2 = run().gate;
  assertEqual(g1.decision, g2.decision);
  assertApprox(g1.meanDelta, g2.meanDelta, 1e-9);
  assertEqual(g1.deltas.length, 2);
  if (!['keep', 'revert', 'pending'].includes(g1.decision)) throw new Error(`bad decision ${g1.decision}`);
});

// ─── Vision proposer — Harness H3 (sync parts) ────────────────────
console.log('\nVision proposer (Harness H3):');

test('h3: buildProposalPrompt lists every knob and asks for JSON', () => {
  const { system, user } = buildProposalPrompt();
  assertEqual(/JSON/.test(system + user), true);
  for (const k of KNOB_SET) if (!user.includes(k.name)) throw new Error(`prompt missing knob ${k.name}`);
  assertEqual(VISION_PROPOSE_DEFAULTS.maxImages, 4);
});

test('h3: parseProposal handles bare / fenced / prose-wrapped JSON and clamps', () => {
  const bare = parseProposal('{"knobs":{"coverage":1.2,"strokeCount":300}}');
  assertEqual(bare.source, 'knobs');
  assertEqual(bare.knobs.coverage, 1.2);
  assertEqual(parseProposal('```json\n{"knobs":{"coverage":1.2}}\n```').knobs.coverage, 1.2);
  assertEqual(parseProposal('Here you go: {"knobs":{"coverage":1.2},"extra":1} thanks').knobs.coverage, 1.2);
  assertEqual(parseProposal('{"global":{"coverage":0.9}}').source, 'global');
  assertEqual(parseProposal('{"knobs":{"coverage":999}}').knobs.coverage, 3, 'out-of-range clamps to the knob max');
  assertEqual(parseProposal('sorry, I cannot help'), null);
  assertEqual(parseProposal('{"nope":1}'), null);
  assertEqual(parseProposal(null), null);
});

// ─── Track R4 — region fill ───────────────────────────────────────
console.log('\nRegion fill (Track R4):');

function r4Target(S = 64) {
  return makeRGBImage(S, S, (x, y) => {
    if (Math.hypot(x - 20, y - 24) < 11) return [210, 70, 60];
    if (Math.hypot(x - 44, y - 40) < 14) return [40, 80, 150];
    return [235, 230, 215];
  });
}

test('region-fill: default 0 adds no fill strokes and matches an explicit 0', () => {
  const S = 64, px = r4Target(S);
  const an = analyzeImage(px, S, S);
  const def = optimise(an, { count: 200, seed: 7 });
  const zero = optimise(an, { count: 200, seed: 7, regionFill: 0 });
  assertEqual(def.stats.fill, 0);
  assertEqual(def.shapes.length, 200);
  assertEqual(JSON.stringify(def.shapes), JSON.stringify(zero.shapes), 'opt-out is byte-identical');
});

test('region-fill: >0 blocks in regions first, keeps the budget, is deterministic', () => {
  const S = 64, px = r4Target(S);
  const an = analyzeImage(px, S, S);
  const a = optimise(an, { count: 200, seed: 7, regionFill: 0.3 });
  const b = optimise(an, { count: 200, seed: 7, regionFill: 0.3 });
  if (!(a.stats.fill > 0)) throw new Error('expected fill strokes on a structured target');
  assertEqual(a.shapes.length, 200, 'the total budget is respected');
  assertEqual(JSON.stringify(a.shapes), JSON.stringify(b.shapes), 'deterministic');
  const first = a.shapes[0];
  if (!(first.type === 'E' && Math.max(first.params[2], first.params[3]) >= 5)) {
    throw new Error('the first emitted stroke should be a broad fill ellipse');
  }
});

test('region-fill: resolveOptions passes regionFill through; 0 on a noisy target', () => {
  assertEqual(resolveOptimiserOptions({ regionFill: 0.3 }).regionFill, 0.3);
  const S = 48;
  let seed = 12345;
  const rnd = () => { seed = (1103515245 * seed + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const noise = makeRGBImage(S, S, () => [rnd() * 255 | 0, rnd() * 255 | 0, rnd() * 255 | 0]);
  const an = analyzeImage(noise, S, S);
  const r = optimise(an, { count: 120, seed: 7, regionFill: 0.3 });
  assertEqual(r.shapes.length, 120);
  assertEqual(r.stats.fill, 0, 'pure noise has no region large enough to block in');
});

// ─── Style match (Track-S S2) ─────────────────────────────────────
console.log('\n  Style match (Track-S S2)');

/** A minimal hand-built RefPacket, so these tests exercise the comparison and
 *  not the analyser (S1's tests already cover that). */
function makePacket(over = {}) {
  return {
    module: 'ref-analyze',
    scaleHistogram: [8, 0, 0, 0, 0, 0, 0, 0],
    strokeScaleByBand: { background: 0.5, shadows: 0.5, midtones: 0.5, highlights: 0.5 },
    orientationField: { binCount: 12, bins: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], dominant: 0, strength: 0.5 },
    coverage: { background: 0.25, shadows: 0.25, midtones: 0.25, highlights: 0.25 },
    stats: { meanCoherence: 0.4 },
    ...over,
  };
}

test('histogramDistance: identical 0, disjoint 1, scale-invariant, symmetric', () => {
  assertEqual(histogramDistance([1, 2, 3, 4], [1, 2, 3, 4]), 0, 'identical');
  assertApprox(histogramDistance([1, 0, 0, 0], [0, 0, 0, 1]), 1, 1e-12, 'disjoint');
  assertApprox(histogramDistance([10, 20, 30, 40], [1, 2, 3, 4]), 0, 1e-12,
    'raw counts and frequencies must agree');
  assertApprox(histogramDistance([2, 0, 0, 0], [1, 1, 0, 0]), 0.5, 1e-12, 'half mass moved');
  const a = [3, 1, 4, 1, 5], b = [2, 7, 1, 8, 2];
  assertApprox(histogramDistance(a, b), histogramDistance(b, a), 1e-12, 'symmetric');
  // an all-zero histogram is "no opinion" (uniform), not a spike
  assertApprox(histogramDistance([0, 0, 0, 0], [1, 1, 1, 1]), 0, 1e-12);
});

test('orientationMatch: identical 1, 90° is anti, PI-periodic, wrap-aware', () => {
  const b = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  assertApprox(orientationMatch(b, b), 1, 1e-9, 'identical');
  // 12 bins span [0,PI): six bins is a 90° turn → cos(2·90°) = −1 → 0
  assertApprox(orientationMatch(b, [0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0]), 0, 1e-9, '90°');
  // one bin = 15°: neutral-ish, cos(30°)
  const expected15 = (1 + Math.cos(Math.PI / 6)) / 2;
  assertApprox(orientationMatch(b, [0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]), expected15, 1e-9, '15°');
  // bin 11 is −15°: the same amount of disagreement ACROSS the wrap
  assertApprox(orientationMatch(b, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]), expected15, 1e-9, 'wrap');
  assertApprox(orientationMatch(b, [0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
    orientationMatch([0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], b), 1e-12, 'symmetric');
});

test('orientationMatch: KNOWN DEFECT (S3.md §7) — identity fails for a BROAD histogram', () => {
  // This test PINS CURRENT (buggy) BEHAVIOUR deliberately. A DELTA histogram
  // matches itself exactly (asserted above); a BROAD one — i.e. every real
  // render — does not, because the denominator is a weighted mean of cos(2Δθ),
  // so it penalises spread. Consequence: `refPacketDistance(p, p)` is ~0.12, not
  // 0, and `styleMatch` can never reach 1 even for a perfect match. It is NOT
  // fixed yet because S2's only real-world check cannot validate either version
  // (see docs/checkpoints/S3.md §7, defect B). When S9 fixes the render path and
  // this kernel, INVERT this assertion to `=== 1` and drop the note in metrics.js.
  const broad = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8];
  const self = orientationMatch(broad, broad);
  if (!(self < 0.9 && self > 0.4)) {
    throw new Error(`expected the known spread penalty (~0.5), got ${self} — has it been fixed?`);
  }
  const other = [8, 5, 3, 5, 6, 2, 9, 5, 1, 4, 1, 3];
  const s = orientationMatch(broad, other);
  if (!(s >= 0 && s <= 1)) throw new Error('orientationMatch out of [0,1]: ' + s);
  assertApprox(s, orientationMatch(other, broad), 1e-12, 'symmetric');
});

test('valueMapDistance: mean absolute difference, missing key counts as 0', () => {
  assertEqual(valueMapDistance({ a: 0.5, b: 0.5 }, { a: 0.5, b: 0.5 }), 0);
  // mean over the union of keys: (|0.5-0.9| + 0) / 2
  assertApprox(valueMapDistance({ a: 0.5, b: 0.5 }, { a: 0.9, b: 0.5 }), 0.2, 1e-12);
  // a dropped band is a difference, not a free pass: |1-0| / 2 keys
  assertApprox(valueMapDistance({ a: 1, b: 1 }, { a: 1 }), 0.5, 1e-12);
  assertApprox(valueMapDistance({ a: 1, b: 1, c: 1, d: 1 }, { a: 1, b: 1, c: 1 }), 0.25, 1e-12);
});

test('refPacketDistance: a packet against itself is 0 in EVERY term', () => {
  const A = makePacket();
  const d = refPacketDistance(A, A);
  assertEqual(d.distance, 0);
  for (const k of Object.keys(d.parts)) assertApprox(d.parts[k], 0, 1e-12, 'part ' + k);
  assertApprox(refPacketMatch(A, A), 1, 1e-12);
  assertEqual(Object.keys(d.parts).sort(), ['bandScale', 'coherence', 'coverage', 'orientation', 'scale']);
  assertEqual(Object.keys(STYLE_MATCH_WEIGHTS).sort(), ['bandScale', 'coherence', 'coverage', 'orientation', 'scale']);
});

test('refPacketDistance: each term moves the composite by its own weight', () => {
  const A = makePacket();
  // Orientation turned 90°: the orientation term saturates, nothing else moves.
  const rot = makePacket({ orientationField: { binCount: 12, bins: [0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0], dominant: 0, strength: 0.5 } });
  const dr = refPacketDistance(A, rot);
  assertApprox(dr.parts.orientation, 1, 1e-9);
  assertApprox(dr.parts.scale, 0, 1e-12);
  assertApprox(dr.distance, STYLE_MATCH_WEIGHTS.orientation, 1e-9);
  // Half the scale mass moved one bin.
  const sc = makePacket({ scaleHistogram: [4, 4, 0, 0, 0, 0, 0, 0] });
  assertApprox(refPacketDistance(A, sc).parts.scale, 0.5, 1e-12);
  assertApprox(refPacketDistance(A, sc).distance, 0.3 * 0.5, 1e-12);
  // Band occupancy: half the midtone mass moved to highlights.
  const cov = makePacket({ coverage: { background: 0.25, shadows: 0.25, midtones: 0.25, highlights: 0.25 } });
  const cov2 = makePacket({ coverage: { background: 0.25, shadows: 0.25, midtones: 0.0, highlights: 0.5 } });
  assertApprox(refPacketDistance(cov, cov2).distance, STYLE_MATCH_WEIGHTS.coverage * 0.25, 1e-12);
  // Distance never decreases as one term moves further away.
  const near = makePacket({ strokeScaleByBand: { background: 0.5, shadows: 0.5, midtones: 0.5, highlights: 0.6 } });
  const far = makePacket({ strokeScaleByBand: { background: 0.5, shadows: 0.5, midtones: 0.5, highlights: 1.0 } });
  const dNear = refPacketDistance(A, near).distance;
  const dFar = refPacketDistance(A, far).distance;
  if (!(dFar > dNear)) throw new Error(`distance must grow with the gap (${dNear} -> ${dFar})`);
});

test('refPacketDistance: symmetric, deterministic, bounded, weightable', () => {
  const A = makePacket();
  const B = makePacket({ scaleHistogram: [0, 8, 0, 0, 0, 0, 0, 0], stats: { meanCoherence: 0.9 } });
  const ab = refPacketDistance(A, B), ba = refPacketDistance(B, A);
  assertApprox(ab.distance, ba.distance, 1e-12, 'symmetric');
  assertApprox(refPacketDistance(A, B).distance, ab.distance, 0, 'deterministic');
  if (!(ab.distance >= 0 && ab.distance <= 1)) throw new Error('distance out of range');
  // Only the scale term: the distance becomes that term alone.
  const onlyScale = refPacketDistance(A, B, { scale: 1, orientation: 0, coverage: 0, bandScale: 0, coherence: 0 });
  assertApprox(onlyScale.distance, onlyScale.parts.scale, 1e-12);
  let threw = false;
  try { refPacketDistance(A, null); } catch (e) { threw = true; }
  assertEqual(threw, true, 'a missing packet must throw, not silently score 0');
});

test('scoreProfileStyle: deterministic, bounded, and the composite mix is exact', () => {
  const S = 48;
  const px = new Uint8ClampedArray(S * S * 4);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const d = Math.hypot(x - S / 2, y - S / 2);
      const v = d < S / 4 ? [200, 60, 60] : [40, 46, 58];
      const i = (y * S + x) * 4;
      px[i] = v[0]; px[i + 1] = v[1]; px[i + 2] = v[2]; px[i + 3] = 255;
    }
  }
  const image = { pixels: px, width: S, height: S };
  const profile = { global: { style: 'pencil', strokeCount: 40, detailLevel: 0.6 } };

  const r1 = scoreProfileStyle(profile, image, makePacket(), { seed: 7 });
  const r2 = scoreProfileStyle(profile, image, makePacket(), { seed: 7 });
  assertEqual(r1.styleMatch, r2.styleMatch, 'deterministic styleMatch');
  assertEqual(r1.styleDistance, r2.styleDistance, 'deterministic styleDistance');
  assertEqual(r1.strokes, 40, 'the stroke budget is honoured');
  if (!(r1.styleMatch >= 0 && r1.styleMatch <= 1)) throw new Error('styleMatch out of range: ' + r1.styleMatch);
  if (!(r1.composite >= 0 && r1.composite <= 1)) throw new Error('composite out of range: ' + r1.composite);
  assertEqual(r1.resultPacket.module, 'ref-analyze', 'the render is analysed like a reference');

  // The composite is exactly the weighted mix (style term, reconstruction term).
  const pureStyle = scoreProfileStyle(profile, image, makePacket(), { seed: 7, styleWeight: 1 });
  assertApprox(pureStyle.composite, pureStyle.styleMatch, 1e-12, 'styleWeight 1 = pure style');
  const pureRecon = scoreProfileStyle(profile, image, makePacket(), { seed: 7, styleWeight: 0 });
  assertApprox(pureRecon.composite, pureRecon.reconstruction.simMae / 100, 1e-12, 'styleWeight 0 = pure fidelity');
  assertApprox(pureStyle.styleMatch, pureRecon.styleMatch, 1e-12, 'the weight must not change the measurement');

  // The measurement is a comparison, not a constant: a different reference moves it.
  const other = makePacket({ scaleHistogram: [0, 0, 8, 0, 0, 0, 0, 0] });
  const r3 = scoreProfileStyle(profile, image, other, { seed: 7 });
  if (!(r3.styleMatch !== r1.styleMatch)) throw new Error('the reference must affect the score');

  let threw = false;
  try { scoreProfileStyle(profile, image, null, {}); } catch (e) { threw = true; }
  assertEqual(threw, true, 'no reference must throw');
  assertEqual(STYLE_PROFILE_DEFAULTS.styleWeight, 0.7);
});

test('gateChange guards: a style gain bought with a fidelity drop is reverted', () => {
  const images = [
    { name: 'a', styleMatch: 0.50, simMae: 90 },
    { name: 'b', styleMatch: 0.60, simMae: 80 },
  ];
  const baseline = evaluateSet((i) => i, images, { objective: 'styleMatch' });
  const better = images.map((i) => ({ ...i, styleMatch: i.styleMatch + 0.05 }));
  const candidate = evaluateSet((i) => i, better, { objective: 'styleMatch' });

  // Style improved, fidelity untouched → pending approval (never auto-kept).
  const clean = gateChange(baseline, candidate, { objective: 'styleMatch' });
  assertEqual(clean.decision, 'pending');
  assertEqual(clean.guardDrops, []);

  // Same style gain, but fidelity dropped on both images → revert.
  const worse = better.map((i) => ({ ...i, simMae: i.simMae - 5 }));
  const cand2 = evaluateSet((i) => i, worse, { objective: 'styleMatch' });
  const guarded = gateChange(baseline, cand2, {
    objective: 'styleMatch', guards: [{ metric: 'simMae', maxDrop: 0 }],
  });
  assertEqual(guarded.decision, 'revert');
  assertEqual(guarded.guardDrops.length, 2);
  assertEqual(guarded.improved, true, 'the objective DID improve — the guard is what reverts it');

  // A tolerated drop passes the guard.
  const tolerated = gateChange(baseline, cand2, {
    objective: 'styleMatch', guards: [{ metric: 'simMae', maxDrop: 6 }],
  });
  assertEqual(tolerated.decision, 'pending');

  // Guards default to none: the previous behaviour is unchanged.
  assertEqual(GATE_DEFAULTS.guards, []);
  const noGuards = gateChange(baseline, cand2, { objective: 'styleMatch' });
  assertEqual(noGuards.decision, 'pending');
});

// ─── Summary ──────────────────────────────────────────────────────
console.log('\n=== Results ===');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(failed === 0 ? '\n✅ All tests passed!' : '\n❌ Some tests failed.');
process.exit(failed === 0 ? 0 : 1);
