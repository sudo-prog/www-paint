#!/usr/bin/env node
/**
 * style-accuracy-sweep.cjs — Track-S **S9** instrument (active refinement).
 *
 * S10 pinned the (content x candidate-style x reference-style) matrix. S9 asks
 * the two questions S10 handed over, WITHOUT a browser:
 *
 *   (1) WHICH term drives a style's own reference losing the diagonal? The
 *       composite is a fixed linear combination of five distance terms
 *       (`STYLE_MATCH_WEIGHTS` in js/engine/metrics.js):
 *           styleMatch = 1 - sum_k w_k * part_k
 *       so a row's margin decomposes EXACTLY into five weighted contributions,
 *       `sum_k w_k * (ownPart_k - otherPart_k)`. Positive = own is WORSE on that
 *       term. This script prints that decomposition per row and in aggregate.
 *
 *   (2) IS a re-weighting enough to make the diagonal win? Because the matrix is
 *       a linear function of the pinned parts, the whole ranking can be re-scored
 *       offline under ANY weights. This script sweeps the weight simplex and
 *       reports the best achievable ownIsBest and the mean margin.
 *
 * WHAT IT IS NOT
 *   - It is NOT a gate: it reports, it does not assert a threshold. It exits 0
 *     unless it cannot read its inputs.
 *   - It does NOT change the metric. A weighting found here is a HYPOTHESIS; any
 *     actual metric change must be H5-gated (keep only on measured mean gain)
 *     and re-pinned deliberately with `style-accuracy-bench.cjs --update`.
 *
 * Usage
 *   node scripts/style-accuracy-sweep.cjs                       # sweep the pinned baseline
 *   node scripts/style-accuracy-sweep.cjs --matrix=<record.json>
 *   ... --step=0.05   --json=<out.json>
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PARTS = ['scale', 'orientation', 'coverage', 'bandScale', 'coherence'];
const BASE = Object.freeze({ scale: 0.30, orientation: 0.25, coverage: 0.20, bandScale: 0.15, coherence: 0.10 });

function parseArgs(argv) {
  const a = Object.fromEntries(process.argv.slice(2).map((s) => {
    const m = s.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? 'true'] : [s, 'true'];
  }));
  return {
    matrix: a.matrix || path.join(ROOT, 'docs', 'research', 'style-accuracy', 'baseline.json'),
    json: a.json || null,
    step: a.step ? Number(a.step) : 0.1,
  };
}

const styleMatch = (parts, W) => 1 - PARTS.reduce((s, k) => s + W[k] * parts[k], 0);

function loadCells(record) {
  // (content|candidate) -> reference -> parts
  const byRow = new Map();
  for (const c of record.cells) {
    const key = `${c.content}|${c.candidate}`;
    if (!byRow.has(key)) byRow.set(key, new Map());
    byRow.get(key).set(c.reference, c.parts);
  }
  return byRow;
}

/** Re-rank every row under W: does the own reference win? */
function evaluate(byRow, W) {
  let wins = 0; const margins = []; const rows = [];
  for (const [key, refs] of byRow) {
    const [content, cand] = key.split('|');
    const scored = [...refs].map(([r, p]) => [r, styleMatch(p, W)]);
    const own = scored.find(([r]) => r === cand)[1];
    const [bestOtherStyle, bestOther] = scored.filter(([r]) => r !== cand).sort((x, y) => y[1] - x[1])[0];
    const margin = own - bestOther;
    margins.push(margin);
    if (own > bestOther) wins++;
    rows.push({ content, candidate: cand, own: +own.toFixed(6), bestOther: +bestOther.toFixed(6), bestOtherStyle, margin: +margin.toFixed(6), ownIsBest: own > bestOther });
  }
  return { wins, meanMargin: margins.reduce((a, b) => a + b, 0) / margins.length, rows };
}

/** Signed weighted contribution of each term to a row's margin (own - other). */
function decompose(byRow, W) {
  const out = [];
  for (const [key, refs] of byRow) {
    const [content, cand] = key.split('|');
    const own = refs.get(cand);
    // runner-up under W
    const scored = [...refs].map(([r, p]) => [r, styleMatch(p, W)]).filter(([r]) => r !== cand).sort((x, y) => y[1] - x[1]);
    const other = refs.get(scored[0][0]);
    const contrib = {};
    for (const k of PARTS) contrib[k] = +(W[k] * (own[k] - other[k])).toFixed(6);
    out.push({ content, candidate: cand, bestOtherStyle: scored[0][0], parts: contrib });
  }
  return out;
}

/** Grid over the weight simplex with the given step (weights sum to 1). */
function sweep(byRow, step) {
  const n = Math.round(1 / step);
  const results = [];
  const rec = (idx, remaining, acc) => {
    if (idx === PARTS.length - 1) {
      const W = {}; PARTS.forEach((k, i) => { W[k] = (i < PARTS.length - 1 ? acc[i] : remaining) * step; });
      const { wins, meanMargin } = evaluate(byRow, W);
      results.push({ weights: { ...W }, wins, meanMargin: +meanMargin.toFixed(6) });
      return;
    }
    for (let v = 0; v <= remaining; v++) rec(idx + 1, remaining - v, [...acc, v]);
  };
  rec(0, n, []);
  results.sort((a, b) => (b.wins - a.wins) || (b.meanMargin - a.meanMargin));
  return results;
}

function main() {
  const args = parseArgs(process.argv);
  if (!fs.existsSync(args.matrix)) { console.error('no matrix at ' + args.matrix); process.exit(2); }
  const record = JSON.parse(fs.readFileSync(args.matrix, 'utf8'));
  const byRow = loadCells(record);

  const base = evaluate(byRow, BASE);
  const dec = decompose(byRow, BASE);

  console.log(`S9 sweep over ${byRow.size} (content, style) rows x ${record.cells.length} cells`);
  console.log(`matrix: ${path.relative(ROOT, args.matrix)} (candidate ${record.strokeCount} strokes vs ${record.refStrokes}-stroke references)\n`);

  console.log('=== per-row margin decomposition (weighted contribution per term; + = own WORSE) ===');
  console.log('content/cand'.padEnd(22) + 'margin'.padStart(8) + ' | ' + PARTS.map((k) => k.slice(0, 5).padStart(7)).join('') + '  bestOther');
  for (const r of base.rows) {
    const d = dec.find((x) => x.content === r.content && x.candidate === r.candidate);
    console.log(`${(r.content + '/' + r.candidate).padEnd(22)}${r.margin.toFixed(4).padStart(8)} | `
      + PARTS.map((k) => d.parts[k].toFixed(4).padStart(7)).join('') + `  ${r.bestOtherStyle}${r.ownIsBest ? '  WIN' : ''}`);
  }

  const agg = (filter) => {
    const rows = base.rows.filter(filter);
    const out = {};
    for (const k of PARTS) {
      const vals = dec.filter((d) => rows.some((r) => r.content === d.content && r.candidate === d.candidate)).map((d) => d.parts[k]);
      out[k] = { mean: vals.reduce((a, b) => a + b, 0) / vals.length, min: Math.min(...vals), max: Math.max(...vals) };
    }
    return out;
  };
  console.log('\n=== aggregate contribution per term (mean over rows) ===');
  for (const [label, f] of [['ALL', () => true], ['WIN', (r) => r.ownIsBest], ['LOSS', (r) => !r.ownIsBest]]) {
    const a = agg(f);
    console.log(`${label.padEnd(5)} ` + PARTS.map((k) => `${k.slice(0, 5)} ${a[k].mean >= 0 ? '+' : ''}${a[k].mean.toFixed(4)} [${a[k].min.toFixed(4)},${a[k].max.toFixed(4)}]`).join('  '));
  }

  const results = sweep(byRow, args.step);
  const best = results[0];
  console.log(`\n=== weight sweep (step ${args.step}, ${results.length} weightings) ===`);
  console.log(`BASELINE        ownIsBest ${base.wins}/${base.rows.length}  meanMargin ${base.meanMargin >= 0 ? '+' : ''}${base.meanMargin.toFixed(4)}`);
  console.log(`BEST            ownIsBest ${best.wins}/${base.rows.length}  meanMargin ${best.meanMargin >= 0 ? '+' : ''}${best.meanMargin.toFixed(4)}  at ${JSON.stringify(best.weights)}`);
  console.log('top 5:');
  for (const r of results.slice(0, 5)) console.log(`   ${String(r.wins).padStart(2)}/${base.rows.length}  ${r.meanMargin >= 0 ? '+' : ''}${r.meanMargin.toFixed(4)}  ${JSON.stringify(r.weights)}`);

  console.log(`\nVERDICT: re-weighting alone moves the diagonal from ${base.wins}/${base.rows.length} to at best `
    + `${best.wins}/${base.rows.length} and the mean margin stays ${best.meanMargin >= 0 ? 'positive' : 'NEGATIVE'} `
    + `(${best.meanMargin.toFixed(4)}). ${best.wins < base.rows.length ? 'The diagonal loss is therefore STRUCTURAL, not a weighting problem.' : ''}`);

  if (args.json) {
    fs.mkdirSync(path.dirname(args.json), { recursive: true });
    fs.writeFileSync(args.json, JSON.stringify({
      source: path.relative(ROOT, args.matrix), generatedAt: new Date().toISOString(),
      weights: BASE, ranks: { baseline: base, decomposition: dec },
      sweep: { step: args.step, best, top: results.slice(0, 10) },
    }, null, 2) + '\n');
    console.log(`\nJSON: ${path.relative(ROOT, args.json)}`);
  }
  process.exit(0);
}

main();
