import assert from 'node:assert/strict';
import painterPlan, {
  painterToEngineShape,
  buildPainterModularPlan,
} from '../js/engine/painter-plan.js';

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  PASS ${name}`);
  } catch (error) {
    failed++;
    console.error(`  FAIL ${name}`);
    console.error(error.stack || error);
  }
}

const geometry = {
  E: [10, 11, 4, 5, 0.3, 0.9],
  B: [12, 13, 6, 7, 0.4, 0.8],
  T: [1, 2, 3, 4, 5, 6, 0.7],
  R: [14, 15, 8, 9, 0.5, 0.6],
  S: [1, 2, 3, 4, 5, 6, 2.5, 0.2],
};

function rawShape(t) {
  return {
    t,
    p: geometry[t].slice(),
    c0: [10, 20, 30],
    c1: [40, 50, 60],
    a: 0.75,
    st: 'pencil',
    fl: true,
  };
}

function expectedShape(raw, t) {
  const p = raw.p.slice();
  if (t === 'E' || t === 'B' || t === 'R') {
    p[5] = raw.c0;
    p.push(raw.c1, raw.a);
  } else {
    p.push(raw.c0, raw.c1, raw.a);
  }
  return {
    id: 'stroke_2_9',
    type: t,
    params: p,
    color0: raw.c0,
    color1: raw.c1,
    alpha: 0.75,
    style: 'pencil',
    layer: 2,
    order: 9,
    seed: 7,
    flat: true,
  };
}

for (const t of ['E', 'B', 'T', 'R', 'S']) {
  await test(`${t} has the exact engine-shape layout`, () => {
    const raw = rawShape(t);
    assert.deepEqual(painterToEngineShape(raw, 9, 7, 2), expectedShape(raw, t));
  });
}

await test('params and colour arrays are independent of the raw shape', () => {
  const raw = rawShape('E');
  const original = structuredClone(raw);
  const converted = painterToEngineShape(raw, 0, 7);
  assert.deepEqual(raw, original, 'conversion must not mutate its input');
  assert.notEqual(converted.params, raw.p);
  assert.notEqual(converted.color0, raw.c0);
  assert.notEqual(converted.color1, raw.c1);
  assert.notEqual(converted.params[5], raw.c0);
  assert.notEqual(converted.params[6], raw.c1);
  raw.p[0] = 999;
  raw.c0[0] = 201;
  raw.c1[0] = 202;
  assert.equal(converted.params[0], original.p[0]);
  assert.equal(converted.params[5][0], original.c0[0]);
  assert.equal(converted.params[6][0], original.c1[0]);
  assert.equal(converted.color0[0], original.c0[0]);
  assert.equal(converted.color1[0], original.c1[0]);
  converted.params[5][1] = 203;
  assert.equal(converted.color0[1], original.c0[1]);
});

await test('layer index defaults to zero', () => {
  const converted = painterToEngineShape(rawShape('S'), 3, 7);
  assert.equal(converted.id, 'stroke_0_3');
  assert.equal(converted.layer, 0);
});

await test('disabled planning returns an unused empty plan', async () => {
  const plan = await buildPainterModularPlan(null, { enabled: false });
  assert.equal(plan.used, false);
  assert.equal(plan.reason, 'disabled');
  assert.deepEqual(plan.shapes, []);
  assert.equal(plan.layerBands, null);
  assert.equal(plan.bandCounts, null);
});

await test('invalid analysis returns an unused empty plan', async () => {
  const plan = await buildPainterModularPlan({ width: 0, height: 32, pixels: [] });
  assert.equal(plan.used, false);
  assert.equal(plan.reason, 'no-analysis');
  assert.deepEqual(plan.shapes, []);
  assert.equal(plan.layerBands, null);
  assert.equal(plan.bandCounts, null);
});

function syntheticAnalysis() {
  const width = 48;
  const height = 48;
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const disc = (x - 24) ** 2 + (y - 24) ** 2 < 15 ** 2;
      pixels[i] = disc ? 35 + x * 2 : 235 - x;
      pixels[i + 1] = disc ? 70 + y * 2 : 225 - y;
      pixels[i + 2] = disc ? 180 - x : 245;
      pixels[i + 3] = 255;
    }
  }
  return { pixels, width, height };
}

const first = await buildPainterModularPlan(syntheticAnalysis(), { count: 8, seed: 7 });
const second = await buildPainterModularPlan(syntheticAnalysis(), { count: 8, seed: 7 });

await test('a real small Painter run produces shapes and a numeric similarity', () => {
  assert.equal(first.used, true);
  assert.equal(first.reason, 'ok');
  assert.ok(first.shapes.length > 0);
  assert.ok(Number.isFinite(first.sim));
  assert.equal(first.layerBands, null);
  assert.equal(first.bandCounts, null);
  for (let i = 0; i < first.shapes.length; i++) {
    const shape = first.shapes[i];
    assert.equal(shape.id, `stroke_0_${i}`);
    assert.equal(shape.order, i);
    assert.equal(shape.layer, 0);
    assert.equal(shape.seed, 7);
    assert.ok(['E', 'B', 'T', 'R', 'S'].includes(shape.type));
    assert.ok(shape.params.every((p) => Array.isArray(p) || Number.isFinite(p)));
    assert.ok(shape.color0.every(Number.isFinite));
    assert.ok(shape.color1.every(Number.isFinite));
  }
});

await test('identical seeded runs have deterministic geometry and colours', () => {
  assert.deepEqual(first.shapes, second.shapes);
  assert.equal(first.sim, second.sim);
});

await test('default export exposes the same public functions', () => {
  assert.equal(painterPlan.painterToEngineShape, painterToEngineShape);
  assert.equal(painterPlan.buildPainterModularPlan, buildPainterModularPlan);
});

await test('painter band mode labels every shape with a legacy band name', async () => {
  const plan = await buildPainterModularPlan(syntheticAnalysis(), { count: 8, seed: 7, layerBands: 'painter' });
  assert.equal(plan.used, true);
  assert.equal(plan.layerBands, 'painter');
  assert.ok(plan.shapes.length > 0);
  const valid = ['background', 'shadows', 'outline', 'midtone', 'highlights'];
  for (const shape of plan.shapes) {
    assert.ok(valid.includes(shape.layerName), `unexpected band ${shape.layerName}`);
  }
  const total = Object.values(plan.bandCounts).reduce((a, b) => a + b, 0);
  assert.equal(total, plan.shapes.length);
});

await test('painter band mode does not change the shape stream', async () => {
  const unbanded = await buildPainterModularPlan(syntheticAnalysis(), { count: 8, seed: 7 });
  const banded = await buildPainterModularPlan(syntheticAnalysis(), { count: 8, seed: 7, layerBands: 'painter' });
  assert.equal(banded.shapes.length, unbanded.shapes.length);
  for (let i = 0; i < banded.shapes.length; i++) {
    const a = banded.shapes[i];
    const b = unbanded.shapes[i];
    assert.equal(a.type, b.type);
    assert.equal(a.order, b.order);
    assert.equal(a.alpha, b.alpha);
    assert.deepEqual(a.params, b.params);
    assert.deepEqual(a.color0, b.color0);
    assert.deepEqual(a.color1, b.color1);
    assert.equal(a.style, b.style);
  }
});

await test('painter-footprint band mode still uses the footprint classifier', async () => {
  const plan = await buildPainterModularPlan(syntheticAnalysis(), { count: 8, seed: 7, layerBands: 'painter-footprint' });
  assert.equal(plan.used, true);
  assert.equal(plan.layerBands, 'painter-footprint');
  const valid = ['background', 'shadows', 'outline', 'midtone', 'highlights'];
  for (const shape of plan.shapes) {
    assert.ok(valid.includes(shape.layerName), `unexpected band ${shape.layerName}`);
  }
});

console.log(`Passed: ${passed} Failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
