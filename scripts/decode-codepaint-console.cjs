// Decode Code Paint's stroke console from the captured fillText ops (v2).
// The console repaints its whole panel each frame, char-by-char, and the
// footer 'Code Painter by Jas Black' is drawn once per frame at a fixed y —
// use it as the frame delimiter. Keep every frame's reconstructed lines;
// collect all S() lines across frames, dedupe by sequence number, sort.
const fs = require('fs');
const SRC = '/tmp/cp-console-ops.ndjson';
const OUT = '/tmp/cp-console-full.txt';

const seq = [];
fs.readFileSync(SRC, 'utf8').split('\n').filter(Boolean).forEach((l) => {
  try {
    const o = JSON.parse(l);
    if (o.cw === 1920) seq.push({ y: o.y, x: o.x, t: o.t });
  } catch {}
});

// Split the op stream into frames at each 'Code Painter' footer occurrence.
const frames = [];
let cur = [];
for (const op of seq) {
  cur.push(op);
  if (op.t.startsWith('Code Painter')) {
    frames.push(cur);
    cur = [];
  }
}
if (cur.length) frames.push(cur);

// Rebuild each frame's lines (group by y, sort by x, join chars). Keep the
// LONGEST text per y across all frames (scrolling console reuses slots).
const slot = new Map();
let sCount = 0;
for (const fr of frames) {
  const byY = new Map();
  for (const { y, x, t } of fr) {
    if (!byY.has(y)) byY.set(y, []);
    byY.get(y).push([x, t]);
  }
  for (const [y, chars] of byY) {
    chars.sort((a, b) => a[0] - b[0]);
    const text = chars.map((c) => c[1]).join('');
    if (/S\(/.test(text)) sCount++;
    const prev = slot.get(y);
    if (!prev || text.length > prev.length) slot.set(y, text);
  }
}

const parsed = [];
for (const t of slot.values()) {
  const m = t.match(/^(\d+)S\((.*)\)\s*$/);
  if (m) parsed.push({ n: parseInt(m[1], 10), body: m[2] });
}
// Dedupe by n (keep first).
const seen = new Set();
const uniq = [];
for (const p of parsed) {
  if (!seen.has(p.n)) { seen.add(p.n); uniq.push(p); }
}
uniq.sort((a, b) => a.n - b.n);

fs.writeFileSync(OUT, uniq.map((p) => `S(${p.body}`).join('\n'));
console.log('frames:', frames.length,
  'S-line draws:', sCount, 'unique S lines:', uniq.length,
  'n-range:', uniq[0]?.n, '..', uniq[uniq.length - 1]?.n);
