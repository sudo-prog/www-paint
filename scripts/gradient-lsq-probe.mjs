#!/usr/bin/env node
/** Quick probe: gradient LSQ on a simple gradient target */
import { analyzeImage } from '../js/engine/analyzer.js';
import { optimise, resolveOptions } from '../js/engine/optimizer.js';
import { readFileSync } from 'fs';

const png = readFileSync('tests/images/smooth.png');
const analysis = analyzeImage(png, { width: 512, height: 384, structure: true });

console.log('=== Gradient LSQ Probe ===');

// Baseline (flat)
const r1 = optimise(analysis, resolveOptions({ count: 400, seed: 12345, gradientLSQ: false }));
let flatGrad = 0, flatCount = 0;
for (const s of r1.shapes) {
  if (s.color0 && s.color1) {
    const d = Math.sqrt(
      (s.color0[0]-s.color1[0])**2 + (s.color0[1]-s.color1[1])**2 + (s.color0[2]-s.color1[2])**2
    );
    flatGrad += d;
    flatCount++;
  }
}
console.log(`Flat (gradientLSQ:false): ${flatCount} strokes, mean gradient distance = ${(flatGrad/flatCount).toFixed(2)}`);

// With gradient LSQ
const r2 = optimise(analysis, resolveOptions({ count: 400, seed: 12345, gradientLSQ: true }));
let gradGrad = 0, gradCount = 0;
for (const s of r2.shapes) {
  if (s.color0 && s.color1) {
    const d = Math.sqrt(
      (s.color0[0]-s.color1[0])**2 + (s.color0[1]-s.color1[1])**2 + (s.color0[2]-s.color1[2])**2
    );
    gradGrad += d;
    gradCount++;
  }
}
console.log(`Gradient LSQ (gradientLSQ:true): ${gradCount} strokes, mean gradient distance = ${(gradGrad/gradCount).toFixed(2)}`);

console.log(`\nGradient added: ${((gradGrad - flatGrad)/flatCount).toFixed(2)} mean RGB distance per stroke`);
console.log(r2.shapes.length === 400 ? '✓ Stroke count exact' : '✗ Stroke count mismatch');
console.log(gradGrad > flatGrad ? '✓ Gradient LSQ active' : '✗ Gradient LSQ inactive');