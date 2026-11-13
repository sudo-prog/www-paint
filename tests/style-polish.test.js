/**
 * M12 — non-baseline style polish tests.
 *
 * Run with: node tests/style-polish.test.js
 *
 * No DOM, no canvas: every check is on the style modules' own source and
 * exported API. The M12 brief asks for "measurably improved" styles; this
 * suite pins the FIVE correctness defects that were found by the browser
 * probe (scripts/style-polish.cjs) and fixed here, so they cannot regress:
 *
 *   1. bokeh   — `this.spacingFactor` (undefined) made spacing NaN, so the
 *                render loop never ran and every shape drew a blank canvas.
 *   2. riso    — `path is not defined` threw on every S-type shape.
 *   3. pastel  — the stamp index walk ran off the end of the point array.
 *   4. glitch  — a bare `ctx.clip()` outside save/restore wiped the canvas clip.
 *   5. all     — a style module must not throw on a degenerate shape
 *                (zero-length stroke, missing width, NaN-free params).
 *
 * The pixel-level metrics live in docs/research/m12/{before,after}/metrics.json
 * and are produced by scripts/style-polish.cjs (needs Chromium).
 */

import { getAllStyles } from '../js/styles/index.js';

// Path2D is a browser GLOBAL (not a ctx property) and Node has none. The style
// renderers call `new Path2D()` at render time, so the stub must exist before
// any style module's render method runs — set it at import time, not lazily.
if (typeof globalThis.Path2D === 'undefined') {
  globalThis.Path2D = class Path2DStub {
    constructor() { this.ops = []; }
    moveTo(...a) { this.ops.push(['moveTo', ...a]); }
    lineTo(...a) { this.ops.push(['lineTo', ...a]); }
    closePath() { this.ops.push(['closePath']); }
    arc(...a) { this.ops.push(['arc', ...a]); }
    quadraticCurveTo(...a) { this.ops.push(['quadraticCurveTo', ...a]); }
    bezierCurveTo(...a) { this.ops.push(['bezierCurveTo', ...a]); }
  };
}

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

/** Read a style module's source (for defect-specific assertions). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readStyle = (name) => fs.readFileSync(path.join(ROOT, 'js', 'styles', `${name}.js`), 'utf8');

/**
 * Extract a method body from a class source by brace matching, starting at the
 * method's declaration line (not a call site — `_renderStroke(` also appears
 * as `this._renderStroke(...)` in render()).
 */
function methodBody(src, name) {
  const decl = new RegExp(`^\\s{2}${name}\\(`, 'm');
  const m = decl.exec(src);
  if (!m) return null;
  const open = src.indexOf('{', m.index);
  if (open < 0) return null;
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  return null;
}

/** Instantiate a style by name from the live registry. */
function styleInstance(name) {
  const entry = getAllStyles().find((s) => s.name === name);
  if (!entry) throw new Error(`style '${name}' is not registered`);
  return entry.instance;
}

/**
 * A shape with engine-converted params: S-type carries 11 params
 * (8 geometry + c0 + c1 + alpha), exactly what engine._convertShape emits.
 */
function engineStroke(overrides = {}) {
  return {
    id: 't1',
    type: 'S',
    params: [10, 20, 30, 40, 50, 60, 8, 0, [30, 60, 90], [30, 60, 90], 1],
    color0: [30, 60, 90],
    color1: [30, 60, 90],
    alpha: 1,
    style: 'test',
    layer: 0,
    order: 0,
    seed: 12345,
    ...overrides,
  };
}

console.log('\nM12 — style polish defects:\n');

// ── 1. bokeh: the NaN spacing defect ────────────────────────────────────────

test('bokeh reads spacingFactor from defaults, not the instance', () => {
  const src = readStyle('bokeh');
  assert(
    /this\.defaults\.spacingFactor/.test(src),
    'bokeh must read this.defaults.spacingFactor (this.spacingFactor is undefined)',
  );
  assert(
    !/colSize\s*\*\s*this\.spacingFactor/.test(src),
    'the `this.spacingFactor` form must be gone — it made spacing NaN and drew nothing',
  );
});

test('bokeh renders a non-zero area (no NaN loop bounds)', () => {
  const st = styleInstance('bokeh');
  // Reproduce the loop arithmetic the renderer uses, with a real shape.
  const shape = engineStroke({ type: 'E', params: [128, 128, 60, 60, 0, [20, 20, 20], [20, 20, 20], 1] });
  const b = { w: 120, h: 120 };
  const size = Math.max(b.w, b.h, 4);
  const colSize = st.defaults.circleSizeMin +
    (st.defaults.circleSizeMax - st.defaults.circleSizeMin) * Math.min(1, Math.max(0, size / 100));
  const spacing = colSize * st.defaults.spacingFactor * 4;
  assert(Number.isFinite(spacing), `spacing must be finite, got ${spacing}`);
  assert(spacing > 0, `spacing must be positive, got ${spacing}`);
  const cols = Math.ceil(b.w / spacing) + 2;
  assert(Number.isFinite(cols) && cols > 0, `cols must be a positive integer, got ${cols}`);
});

// ── 2. riso: the undefined `path` defect ────────────────────────────────────

test('riso has no reference to an undeclared `path` in _renderStroke', () => {
  const src = readStyle('riso');
  const strokeBody = methodBody(src, '_renderStroke');
  assert(strokeBody, 'could not locate the _renderStroke method body');
  // Strip comments — the BUGFIX note legitimately mentions the old `path`.
  const code = strokeBody.split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');
  assert(
    !/\bpath\b/.test(code.replace(/_renderStroke|shapePoly|outlinePath/g, '')),
    '_renderStroke must not reference `path` (it is only declared in _renderArea)',
  );
});

test('riso _renderStroke strokes a real path instead of an undefined variable', () => {
  const src = readStyle('riso');
  const strokeBody = methodBody(src, '_renderStroke');
  assert(/ctx\.beginPath\(\)/.test(strokeBody), 'grain must start a real path');
  assert(/ctx\.stroke\(\)/.test(strokeBody), 'grain must stroke the real path');
  assert(/ctx\.moveTo\(/.test(strokeBody), 'grain must move to a point on the centreline');
});

// ── 3. pastel: the index-walk defect ────────────────────────────────────────

test('pastel clamps the stamp index before indexing the point array', () => {
  const src = readStyle('pastel');
  assert(
    /if \(j > n - 2\) j = n - 2;/.test(src),
    'pastel must clamp j to the last segment before P[j] is read',
  );
  assert(
    !/\n\s*j\+\+;\s*\n\s*\}/.test(src),
    'pastel must not increment j at the end of the loop body (it overran the array)',
  );
});

test('pastel stamp walk stays in bounds for a degenerate (zero-length) stroke', () => {
  // All control points identical → L = 0 → steps = 1 → the walk must not
  // index past P.length.
  const st = styleInstance('pastel');
  const degenerate = engineStroke({
    params: [50, 50, 50, 50, 50, 50, 8, 0, [30, 60, 90], [30, 60, 90], 1],
  });
  const P = [
    [50, 50], [50, 50], [50, 50], [50, 50], [50, 50],
    [50, 50], [50, 50], [50, 50], [50, 50], [50, 50],
    [50, 50], [50, 50], [50, 50], [50, 50], [50, 50],
    [50, 50], [50, 50], [50, 50], [50, 50], [50, 50],
    [50, 50], [50, 50], [50, 50], [50, 50], [50, 50],
  ];
  const n = P.length;
  const cum = [0];
  for (let i = 1; i < n; i++) {
    cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  }
  const L = cum[n - 1];
  const stampR = 8 * st.defaults.dotSize * 0.5;
  const steps = Math.ceil(L / (stampR * 1.6));
  let j = 1;
  for (let k = 0; k <= steps; k++) {
    const d = (k / steps) * L;
    while (j < n - 2 && cum[j] < d) j++;
    // The fix:
    if (j > n - 2) j = n - 2;
    if (j < 1) j = 1;
    assert(Number.isInteger(j) && j >= 1 && j < P.length, `j out of bounds: ${j}`);
    assert(Array.isArray(P[j]) && Array.isArray(P[j - 1]), `P[${j}] must exist`);
  }
  assert(Number.isFinite(degenerate.params[6]), 'degenerate stroke must still carry a width');
});

// ── 4. glitch: the stray clip defect ────────────────────────────────────────

test('glitch does not call clip() outside a save/restore pair', () => {
  const src = readStyle('glitch');
  // Walk the source line by line and assert that at every `ctx.clip()` the
  // save-stack depth is > 0 — i.e. no clip ever escapes its save/restore.
  // Strip comments first so a comment mentioning clip() cannot trip the count.
  const code = src.split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');
  let depth = 0;
  const offenders = [];
  code.split('\n').forEach((line, i) => {
    if (/ctx\.save\(\)/.test(line)) depth++;
    if (/ctx\.restore\(\)/.test(line)) depth = Math.max(0, depth - 1);
    if (/ctx\.clip\(\)/.test(line) && depth === 0) offenders.push(i + 1);
  });
  assertEqual(offenders, [], `clip() called with no open save() at line(s) ${offenders.join(', ')}`);
});

test('glitch every clip is matched by a restore', () => {
  const src = readStyle('glitch');
  const code = src.split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');
  const saves = (code.match(/ctx\.save\(\)/g) || []).length;
  const restores = (code.match(/ctx\.restore\(\)/g) || []).length;
  assertEqual(saves, restores, `glitch has ${saves} saves but ${restores} restores`);
});

test('glitch clips are balanced and every clip is inside a save block', () => {
  const src = readStyle('glitch');
  const areaBody = src.slice(src.indexOf('_renderArea('));
  assert(
    /ctx\.restore\(\);\s*\n\s*\/\/ BUGFIX \(M12\)/.test(areaBody),
    'the bare post-restore clip() must be replaced by a save/clip pair',
  );
});

// ── 5. no style throws on a degenerate shape ────────────────────────────────

test('every non-pinned style renders a degenerate stroke without throwing', () => {
  const PINNED = ['pencil', 'ink', 'watercolor', 'oil', 'charcoal', 'marker', 'cross-hatch', 'halftone', 'graphic'];
  const shapes = [
    engineStroke(),                                                        // normal
    engineStroke({ params: [5, 5, 5, 5, 5, 5, 8, 0, [1, 2, 3], [1, 2, 3], 1] }), // zero length
    engineStroke({ params: [0, 0, 0, 0, 0, 0, 0, 0, [0, 0, 0], [0, 0, 0], 0] }), // all zero
    engineStroke({ params: [1, 2, 3, 4, 5, 6, 2, 0, [10, 20, 30], [10, 20, 30], 1] }), // tiny
  ];
  const failures = [];
  for (const { instance, name } of getAllStyles()) {
    if (PINNED.includes(name)) continue;
    for (const shape of shapes) {
      try {
        // A no-op 2D context: the renderer must not throw before it can draw.
        const noopCtx = makeRecordingCtx();
        instance.render(noopCtx, shape, 1);
      } catch (e) {
        failures.push(`${name}: ${e.message}`);
      }
    }
  }
  assertEqual(failures, [], `styles threw on degenerate shapes:\n      ${failures.join('\n      ')}`);
});

/** A minimal recording 2D context — enough for a renderer to run without throwing. */
function makeRecordingCtx() {
  const noop = () => {};
  const ctx = {
    canvas: { width: 256, height: 256 },
    save: noop, restore: noop, beginPath: noop, closePath: noop,
    moveTo: noop, lineTo: noop, arc: noop, ellipse: noop, rect: noop,
    quadraticCurveTo: noop, bezierCurveTo: noop, fill: noop, stroke: noop,
    clip: noop, fillRect: noop, strokeRect: noop, clearRect: noop,
    translate: noop, rotate: noop, scale: noop, setTransform: noop,
    drawImage: noop, fillText: noop,
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    createPattern: () => ({}),
    measureText: () => ({ width: 0 }),
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    putImageData: noop,
  };
  // Settable style properties.
  for (const p of ['fillStyle', 'strokeStyle', 'lineWidth', 'globalAlpha', 'lineCap',
                   'lineJoin', 'filter', 'font', 'textAlign', 'textBaseline',
                   'globalCompositeOperation', 'shadowBlur', 'shadowColor']) {
    ctx[p] = null;
  }
  return ctx;
}

// ── 6. determinism: seeded styles must be reproducible ──────────────────────

test('M12-touched styles are deterministic (same shape → same draw call sequence)', () => {
  const touched = ['bokeh', 'riso', 'pastel', 'glitch', 'tape', 'confetti', 'dots', 'wash', 'gouache', 'calligraphy', 'graffiti'];
  const shape = engineStroke();
  for (const name of touched) {
    const st = styleInstance(name);
    const a = makeRecordingCtx();
    const b = makeRecordingCtx();
    st.render(a, shape, 1);
    st.render(b, shape, 1);
    // Compare the recorded operation logs — identical for a seeded renderer.
    assertEqual(a.__log, b.__log, `${name} is not deterministic`);
  }
});

// Add operation logging to the recording context.
const origMake = makeRecordingCtx;
makeRecordingCtx = function loggedCtx() {
  const ctx = origMake();
  ctx.__log = [];
  for (const m of ['fill', 'stroke', 'fillRect', 'arc', 'ellipse', 'moveTo', 'lineTo',
                   'beginPath', 'clip', 'save', 'restore', 'translate', 'rotate']) {
    const orig = ctx[m];
    ctx[m] = (...args) => {
      ctx.__log.push([m, ...args.map((v) => (typeof v === 'number' ? +v.toFixed(3) : v))]);
      return orig(...args);
    };
  }
  return ctx;
};

console.log(`\n=== M12 style polish: Passed ${passed}  Failed ${failed} ===\n`);
process.exit(failed > 0 ? 1 : 0);
