/**
 * Track-S S10 — style-accuracy suite: pinned-artefact invariants (node-only).
 *
 * The matrix itself is produced by `scripts/style-accuracy-bench.cjs` in headless
 * Chromium (scoring a style needs a canvas). This file is the NODE half: it
 * guards the PINNED baseline artefact, so `node tests/*.test.js` fails if the
 * committed baseline is malformed, incomplete, out of range or no longer
 * self-consistent with the bench that produces it.
 *
 * It deliberately does NOT re-measure anything — it cannot (no canvas). It is the
 * cheap tripwire; the bench is the measurement. Run the bench to (re)pin:
 *   NODE_PATH=<dir with playwright-core> node scripts/style-accuracy-bench.cjs --update
 *
 * Run with: node tests/style-accuracy.test.js
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

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

const HERE = dirname(fileURLToPath(import.meta.url));
const BASELINE_PATH = join(HERE, '..', 'docs', 'research', 'style-accuracy', 'baseline.json');

assert(existsSync(BASELINE_PATH),
  `missing pinned baseline ${BASELINE_PATH} — run scripts/style-accuracy-bench.cjs --update and commit it`);

const base = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));

const keyOf = (c) => `${c.content}|${c.candidate}|${c.reference}`;

/* ── Shape ─────────────────────────────────────────────────────────────── */

test('the baseline declares its shape: version, fixed seed, fixed costs', () => {
  assert(base.version === 1, `unexpected version ${base.version}`);
  assert(Number.isInteger(base.seed), 'seed must be an integer (determinism)');
  assert(base.strokeCount > 0, 'candidate stroke cost missing');
  assert(base.refStrokes > 0, 'reference stroke cost missing');
  assert(Array.isArray(base.styles) && base.styles.length === 9, 'the ref-set is the 9 pinned styles');
  assert(Array.isArray(base.contents) && base.contents.length >= 2, 'expected at least 2 contents');
});

test('the matrix is complete: contents x candidate-style x reference-style', () => {
  const expected = base.contents.length * base.styles.length * base.styles.length;
  assert(Array.isArray(base.cells), 'cells missing');
  assert(base.cells.length === expected, `${base.cells.length} cells, expected ${expected}`);
  const seen = new Set(base.cells.map(keyOf));
  assert(seen.size === expected, 'duplicate cells in the matrix');
});

test('every cell names a declared content, candidate and reference', () => {
  for (const c of base.cells) {
    assert(base.contents.includes(c.content), `unknown content ${c.content}`);
    assert(base.styles.includes(c.candidate), `unknown candidate style ${c.candidate}`);
    assert(base.styles.includes(c.reference), `unknown reference style ${c.reference}`);
  }
});

/* ── Values ────────────────────────────────────────────────────────────── */

test('every styleMatch is a finite number in [0, 1]', () => {
  for (const c of base.cells) {
    assert(Number.isFinite(c.styleMatch), `${keyOf(c)} styleMatch not finite`);
    assert(c.styleMatch >= 0 && c.styleMatch <= 1, `${keyOf(c)} styleMatch out of range: ${c.styleMatch}`);
    assert(Number.isFinite(c.styleDistance), `${keyOf(c)} styleDistance not finite`);
  }
});

test('every cell ran at the SAME (declared) stroke cost', () => {
  for (const c of base.cells) {
    assert(c.strokes === base.strokeCount, `${keyOf(c)} ran ${c.strokes} strokes, expected ${base.strokeCount}`);
  }
});

test('every reference was rendered at the declared cost, on every content', () => {
  assert(base.refStrokesSeen && typeof base.refStrokesSeen === 'object', 'refStrokesSeen missing');
  for (const content of base.contents) {
    for (const style of base.styles) {
      assert(base.refStrokesSeen[`${content}|${style}`] === base.refStrokes,
        `reference ${content}|${style} has no recorded stroke cost`);
    }
  }
});

/* ── Self-consistency of the reported summaries ────────────────────────── */

test('the declared range matches the cells', () => {
  const vals = base.cells.map((c) => c.styleMatch);
  assert(Math.abs(base.range.min - Math.min(...vals)) < 1e-6, 'range.min does not match the cells');
  assert(Math.abs(base.range.max - Math.max(...vals)) < 1e-6, 'range.max does not match the cells');
});

test('discrimination is reported for every (content, candidate) row', () => {
  const expected = base.contents.length * base.styles.length;
  assert(Array.isArray(base.discrimination), 'discrimination missing');
  assert(base.discrimination.length === expected,
    `${base.discrimination.length} rows, expected ${expected}`);
  for (const d of base.discrimination) {
    assert(base.contents.includes(d.content), `unknown content in discrimination: ${d.content}`);
    assert(base.styles.includes(d.candidate), `unknown candidate in discrimination: ${d.candidate}`);
    assert(Number.isFinite(d.own) && Number.isFinite(d.bestOther) && Number.isFinite(d.margin),
      `non-finite discrimination row ${d.content}/${d.candidate}`);
    assert(Math.abs((d.own - d.bestOther) - d.margin) < 1e-6, 'margin != own - bestOther');
    assert(d.ownIsBest === (d.own > d.bestOther), 'ownIsBest disagrees with own vs bestOther');
  }
  assert(base.ownIsBestCount === base.discrimination.filter((d) => d.ownIsBest).length,
    'ownIsBestCount does not match the rows');
});

test('the baseline was recorded as deterministic and equal-cost', () => {
  assert(base.deterministic === true, 'the pinned run was not deterministic');
  assert(base.equalCost === true, 'the pinned run was not equal-cost');
});

/* ── Summary ───────────────────────────────────────────────────────────── */

console.log('\n=== Style-accuracy baseline: Results ===');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(failed === 0 ? '\n✅ All style-accuracy tests passed!' : '\n❌ Some style-accuracy tests failed.');
process.exit(failed === 0 ? 0 : 1);
