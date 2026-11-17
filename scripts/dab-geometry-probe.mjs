// Measure the dab geometry the optimiser emits, so strokes can be sized right.
import { buildModularPlan } from '../js/engine/modular-bridge.js';

const W = 512, H = 384;
const N = W * H;
// A synthetic analysis resembling the frog fixture: strong edges + structure.
const edges = new Float32Array(N);
const luminance = new Uint8ClampedArray(N);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = y * W + x;
    luminance[i] = (Math.sin(x / 30) * 40 + Math.cos(y / 24) * 40 + 128) | 0;
    edges[i] = (Math.abs(Math.sin(x / 30) * Math.cos(y / 24)) > 0.6) ? 1 : 0.05;
  }
}
const analysis = { width: W, height: H, edges, luminance };

const plan = buildModularPlan(analysis, {
  enabled: true, style: 'pencil', count: 700, seed: 12345,
  width: W, height: H, dabsAsStrokes: false,
});

const dabs = plan.shapes.filter(s => s.type === 'E');
console.log('dab count:', dabs.length);
const rx = [], ry = [], ratio = [];
for (const d of dabs) {
  const p = d.params;
  rx.push(p[2]); ry.push(p[3]);
  ratio.push(Math.max(p[2], p[3]) / Math.max(0.001, Math.min(p[2], p[3])));
}
const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
const pct = (a, q) => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(q * (s.length - 1))]; };
console.log('rx  mean', mean(rx).toFixed(2), 'p10', pct(rx, 0.1).toFixed(2), 'p50', pct(rx, 0.5).toFixed(2), 'p90', pct(rx, 0.9).toFixed(2));
console.log('ry  mean', mean(ry).toFixed(2), 'p10', pct(ry, 0.1).toFixed(2), 'p50', pct(ry, 0.5).toFixed(2), 'p90', pct(ry, 0.9).toFixed(2));
console.log('elongation (long/short) mean', mean(ratio).toFixed(3), 'p50', pct(ratio, 0.5).toFixed(3), 'p90', pct(ratio, 0.9).toFixed(3));
console.log('fraction with ratio > 1.5:', (ratio.filter(r => r > 1.5).length / ratio.length * 100).toFixed(1) + '%');
console.log('sample dab:', JSON.stringify(dabs[0]));
