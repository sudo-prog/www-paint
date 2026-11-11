#!/usr/bin/env node
/**
 * H3 end-to-end check (node, no browser).
 *
 * Exercises the vision-proposer orchestration with an **injected stub LLM** —
 * parse → clamp → refine (H2 search) → score (H1 metrics) → record (H4 memory) —
 * plus determinism and the unusable-proposal fallback.
 *
 * A REAL backend run happens only when H3_BASE_URL + H3_MODEL are set:
 *   H3_BASE_URL=http://localhost:20128/v1 H3_MODEL=<vision> H3_API_KEY=... \
 *   H3_IMAGE='data:image/png;base64,...' node scripts/h3-propose-check.mjs
 *
 * Usage: node scripts/h3-propose-check.mjs
 */
import { proposeFromImages, openAICompatibleBackend } from '../js/engine/vision-propose.js';
import { createMemory, averageHash } from '../js/engine/memory.js';

function mk(w, h, fn) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = fn(x, y);
    const o = (y * w + x) * 4;
    d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
  }
  return d;
}

const S = 64;
const ref = { pixels: mk(S, S, (x, y) => (Math.hypot(x - S / 2, y - S / 2) < S * 0.3 ? [220, 60, 60] : [30, 60, 150])), width: S, height: S };
const base = {
  schemaVersion: 1, id: 'x', name: 'n', version: '1.0.0',
  global: { style: 'painterly', strokeCount: 120, detailLevel: 0.7, opacity: 0.9, smart: true, seed: 12345 },
};

const stubOk = async () => '{"knobs":{"coverage":1.4,"elongation":2.0,"detailLevel":0.6}}';
const stubBad = async () => 'I am sorry, I cannot propose a profile.';

const checks = [];
const check = (name, ok) => { checks.push([name, ok]); if (!ok) console.error('FAIL:', name); };

const mem = createMemory();
const a = await proposeFromImages([ref], { llm: stubOk, baseProfile: base, image: ref, seed: 7, memory: mem, imageHash: averageHash(ref.pixels, S, S) });
const b = await proposeFromImages([ref], { llm: stubOk, baseProfile: base, image: ref, seed: 7 });

check('usable proposal parsed', a.ok === true);
check('LLM knobs parsed and clamped', a.parsed.knobs.coverage === 1.4 && a.parsed.knobs.elongation === 2.0 && a.parsed.knobs.detailLevel === 0.6);
check('refined knobs are in range', a.knobs.coverage >= 0.1 && a.knobs.coverage <= 3 && a.knobs.elongation >= 0 && a.knobs.elongation <= 4);
check('refinement ran with a budget', a.evaluations > 1);
check('score present (finite simMae)', !!a.score && Number.isFinite(a.score.simMae));
check('memory recorded exactly one attempt', mem.size() === 1);
check('deterministic for the same seed+stub',
  JSON.stringify(a.knobs) === JSON.stringify(b.knobs) && JSON.stringify(a.score) === JSON.stringify(b.score));

const bad = await proposeFromImages([ref], { llm: stubBad, baseProfile: base, image: ref, seed: 7 });
check('unusable proposal falls back to base knobs', bad.ok === false && bad.knobs.strokeCount === 120 && bad.refined === false);

let real = null;
if (process.env.H3_BASE_URL && process.env.H3_MODEL && process.env.H3_IMAGE) {
  const llm = openAICompatibleBackend({ baseUrl: process.env.H3_BASE_URL, model: process.env.H3_MODEL, apiKey: process.env.H3_API_KEY });
  try {
    const r = await proposeFromImages([{ dataUrl: process.env.H3_IMAGE }], { llm, baseProfile: base, image: ref, seed: 7 });
    real = { ok: r.ok, raw: String(r.raw || '').slice(0, 240), knobs: r.knobs };
    check('real backend returned a usable proposal', r.ok === true);
  } catch (e) {
    real = { error: String(e) };
    console.error('REAL RUN ERROR:', String(e));
  }
} else {
  real = { skipped: 'set H3_BASE_URL + H3_MODEL (+ H3_IMAGE) to run a real backend' };
}

console.log(JSON.stringify({
  stub: { ok: a.ok, knobs: a.knobs, score: a.score, evaluations: a.evaluations, refined: a.refined, memorySize: mem.size() },
  fallback: { ok: bad.ok, knobs: bad.knobs },
  real,
}, null, 2));

const failed = checks.filter(([, ok]) => !ok).length;
console.log(failed === 0 ? `PASS: H3 orchestration (${checks.length} checks)` : `FAIL: ${failed}/${checks.length} checks`);
process.exit(failed === 0 ? 0 : 1);
