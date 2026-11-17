// Analyse Code Paint's captured stroke ops: per-stroke length, width,
// strength (alpha), colour, path shape. This is the "teacher signal" for
// matching WWW_PAINT's stroke statistics.
const fs = require('fs');

const SRC = '/tmp/cp-strokes.ndjson';
const OUT = '/tmp/cp-strokes-analysis.json';

const lines = fs.readFileSync(SRC, 'utf8').split('\n').filter(Boolean);
const ops = lines.map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

// Filter to actual vector strokes (stroke/fill with a real path on the
// main paint canvas — MEASURED 1920×1080, the offscreen paint surface; the
// visible #stage is a scaled view of it).
const CANVAS_W = 1920, CANVAS_H = 1080;
const strokes = ops.filter((o) =>
  (o.op === 'stroke' || o.op === 'fill') && o.path && o.path.length > 0
  && o.cw === CANVAS_W && o.ch === CANVAS_H
  && (typeof o.ss === 'string' || typeof o.fs === 'string'),
);

function strokeLen(path) {
  let len = 0, px = null, py = null;
  for (const [op, a] of path) {
    if (op === 'moveTo' || op === 'lineTo') {
      if (px !== null) len += Math.hypot(a[0] - px, a[1] - py);
      px = a[0]; py = a[1];
    } else if (op === 'quadraticCurveTo') {
      if (px !== null) len += Math.hypot(a[2] - px, a[3] - py) * 1.1;
      px = a[2]; py = a[3];
    } else if (op === 'bezierCurveTo') {
      if (px !== null) len += Math.hypot(a[4] - px, a[5] - py) * 1.1;
      px = a[4]; py = a[5];
    } else if (op === 'arc' || op === 'ellipse') {
      // full ellipse: circumference ≈ π·d for arcs; use radius as diameter proxy
      len += Math.PI * (a[2] || 0) * 2;
    }
  }
  return len;
}

const pct = (a, q) => {
  if (!a.length) return 0;
  const s = a.slice().sort((x, y) => x - y);
  return +s[Math.floor(q * (s.length - 1))].toFixed(2);
};
const mean = (a) => (a.length ? +(a.reduce((s, v) => s + v, 0) / a.length).toFixed(2) : 0);

const rows = strokes.map((o, i) => {
  const len = +strokeLen(o.path).toFixed(1);
  // endpoints of the path (first moveTo / last point)
  let x0 = null, y0 = null, x1 = null, y1 = null;
  for (const [op, a] of o.path) {
    if (op === 'moveTo' && x0 === null) { x0 = a[0]; y0 = a[1]; }
    if (op === 'moveTo' || op === 'lineTo') { x1 = a[0]; y1 = a[1]; }
    if (op === 'quadraticCurveTo') { x1 = a[2]; y1 = a[3]; }
    if (op === 'bezierCurveTo') { x1 = a[4]; y1 = a[5]; }
  }
  return {
    i,
    op: o.op,
    nSeg: o.path.length,
    len,
    span: x0 !== null ? +Math.hypot(x1 - x0, y1 - y0).toFixed(1) : 0,
    lw: +Number(o.lw).toFixed(2),
    alpha: o.ga,
    colour: o.op === 'stroke' ? o.ss : o.fs,
    isOutlineish: typeof (o.op === 'stroke' ? o.ss : o.fs) === 'string'
      && /#(0|1|2|3)[0-9a-f]{5}/i.test(o.op === 'stroke' ? o.ss : o.fs) === false,
  };
});

// Aggregate distribution.
const dist = {
  totalOps: ops.length,
  canvasStrokes: strokes.length,
  len: { p10: pct(rows.map((r) => r.len), 0.1), p50: pct(rows.map((r) => r.len), 0.5), p90: pct(rows.map((r) => r.len), 0.9), mean: mean(rows.map((r) => r.len)), max: Math.max(...rows.map((r) => r.len)) },
  span: { p50: pct(rows.map((r) => r.span), 0.5), p90: pct(rows.map((r) => r.span), 0.9), mean: mean(rows.map((r) => r.span)) },
  lw: { p10: pct(rows.map((r) => r.lw), 0.1), p50: pct(rows.map((r) => r.lw), 0.5), p90: pct(rows.map((r) => r.lw), 0.9), mean: mean(rows.map((r) => r.lw)) },
  alpha: { distinct: [...new Set(rows.map((r) => r.alpha))].slice(0, 20), mean: mean(rows.map((r) => r.alpha)) },
  segsPerStroke: { p50: pct(rows.map((r) => r.nSeg), 0.5), p90: pct(rows.map((r) => r.nSeg), 0.9), mean: mean(rows.map((r) => r.nSeg)), max: Math.max(...rows.map((r) => r.nSeg)) },
};

// Colour census (top 20).
const colourCount = {};
for (const r of rows) colourCount[r.colour] = (colourCount[r.colour] || 0) + 1;
dist.topColours = Object.entries(colourCount).sort((a, b) => b[1] - a[1]).slice(0, 20)
  .map(([c, n]) => ({ colour: c, count: n }));

// Width histogram buckets.
const buckets = {};
for (const r of rows) {
  const b = r.lw < 1 ? '<1' : r.lw < 2 ? '1-2' : r.lw < 4 ? '2-4' : r.lw < 8 ? '4-8' : r.lw < 16 ? '8-16' : '16+';
  buckets[b] = (buckets[b] || 0) + 1;
}
dist.lwBuckets = buckets;

// Longest 10 strokes (the "skeleton" strokes).
dist.longest10 = rows.slice().sort((a, b) => b.len - a.len).slice(0, 10)
  .map((r) => ({ len: r.len, span: r.span, lw: r.lw, colour: r.colour, nSeg: r.nSeg, op: r.op }));

fs.writeFileSync(OUT, JSON.stringify(dist, null, 2));
console.log(JSON.stringify(dist, null, 2));
