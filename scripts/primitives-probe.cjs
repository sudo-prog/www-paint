#!/usr/bin/env node
/**
 * Probe: do the stroke-language primitives (Track-S S5) resolve, compose and
 * actually move the paint?
 *
 * The unit tests pin the module's algebra (canonical order, fixed point,
 * weighted averages). This probe pins the three claims that make S5 real, on the
 * engine of record, with real numbers:
 *
 *   1. RESOLUTION — every primitive resolves to an EXISTING registry style and an
 *      EXISTING `brush-media` preset. The vocabulary is a mapping, not a new
 *      renderer: if a style is renamed away, this probe fails.
 *   2. NO-OP UNTIL OPTED IN — a profile that declares no primitives produces
 *      byte-identical shapes and a byte-identical geometric pass plan. That is
 *      the whole safety claim of the change.
 *   3. THE MIX MOVES THE PAINT — a declared mix retunes the pass schedule's
 *      geometry (radius / reference blur / elongation / dab alpha / detail) and
 *      therefore changes the rendered shapes and the measured score, both
 *      deterministically.
 *
 * It then reports, honestly, what each primitive ALONE does to the score on a
 * fixed synthetic image, and runs the AI half of S5 (`searchProfile({primitives:
 * true})`) to show that propose.js proposes **weights**, not only style names.
 *
 * HONEST SCOPE — this is NOT a style-accuracy measurement. A fidelity score
 * (simMae) says how much the render looks like the PHOTO; it is expected to get
 * *worse* for a broad soft language like `wet-wash` and *better* for a crisp one
 * like `hatch`, because that is the feather-versus-detail trade the S2 story
 * already documented. Whether a mix matches a REFERENCE is S10's matrix to
 * measure. Nothing here claims a fidelity win.
 *
 * Usage: node scripts/primitives-probe.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const JSON_OUT = path.join(ROOT, 'docs', 'research', 'primitives-probe.json');

/** Deterministic synthetic content: tonal bands + a disc + a diagonal edge. */
function makeImage(W, H) {
  const px = new Uint8ClampedArray(W * H * 4);
  const cx = W * 0.62;
  const cy = H * 0.42;
  const rr = Math.min(W, H) * 0.26;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      let v;
      if (x * H + y * W > W * H * 0.72) v = 30 + (x % 5);          // diagonal shadow band
      else if (x < W * 0.33) v = 225 - (y % 4);                    // light band
      else v = 128 + ((x + y) % 9) - 4;                            // midtone texture
      const d = Math.hypot(x - cx, y - cy);
      if (d < rr) v = 60 + Math.round(120 * (d / rr));             // a disc, darker at the centre
      px[i] = v; px[i + 1] = Math.min(255, v + 6); px[i + 2] = Math.max(0, v - 8); px[i + 3] = 255;
    }
  }
  return { pixels: px, width: W, height: H };
}

function fingerprint(shapes) {
  // A cheap, exact, order-sensitive digest of the shape list.
  let h = 2166136261 >>> 0;
  const s = JSON.stringify(shapes);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h.toString(16).padStart(8, '0');
}

async function main() {
  const prim = await import('../js/engine/primitives.js');
  const { optimise, resolveOptions, buildScalePlan, resolvePassPlan } = await import('../js/engine/optimizer.js');
  const { analyzeImage } = await import('../js/engine/analyzer.js');
  const { scoreProfile } = await import('../js/engine/score.js');
  const { getStyle } = await import('../js/styles/index.js');
  const { MEDIA_PRESETS } = await import('../js/engine/brush-media.js');
  const { SEARCH_DEFAULTS, searchProfile, primitiveKnobs, knobsToPrimitiveMix } = await import('../js/engine/propose.js');

  const failures = [];
  const fail = (m) => failures.push(m);

  // ── 1. Resolution: every primitive → an existing style + media preset ─────
  const resolution = {};
  for (const id of prim.PRIMITIVE_IDS) {
    const r = prim.resolvePrimitive(id);
    const styleExists = !!getStyle(r.style);
    const mediaExists = Object.prototype.hasOwnProperty.call(MEDIA_PRESETS, r.media);
    if (!styleExists) fail(`primitive '${id}' resolves to an unknown registry style '${r.style}'`);
    if (!mediaExists) fail(`primitive '${id}' resolves to an unknown media preset '${r.media}'`);
    resolution[id] = {
      label: r.label, style: r.style, styleExists,
      media: r.media, mediaExists,
      brushName: r.mediaParams.brushName,
      language: r.language,
      mediaModelKind: r.mediaModel.kind,
    };
  }

  // ── 2. Canonical algebra ──────────────────────────────────────────────────
  const canonRaw = prim.normalizePrimitiveMix({ hatch: 3, 'wet-wash': 1, nope: 9, spatter: 0 });
  const canonAgain = prim.normalizePrimitiveMix(canonRaw);
  const algebra = {
    dropsUnknownAndZero: JSON.stringify(Object.keys(canonRaw)) === JSON.stringify(['wet-wash', 'hatch']),
    canonicalOrder: JSON.stringify(Object.keys(canonRaw)) === JSON.stringify(['wet-wash', 'hatch']),
    sumsToOne: Math.abs(canonRaw['wet-wash'] + canonRaw.hatch - 1) < 1e-12,
    fixedPoint: JSON.stringify(canonRaw) === JSON.stringify(canonAgain),
    emptyForEmpty: JSON.stringify(prim.normalizePrimitiveMix(null)) === '{}'
      && JSON.stringify(prim.normalizePrimitiveMix({})) === '{}',
    rejectsUnknown: prim.validatePrimitiveMix({ nope: 1 }).ok === false,
  };
  for (const [k, v] of Object.entries(algebra)) if (!v) fail(`primitive algebra: ${k} failed`);
  if (!algebra.canonicalOrder) {
    fail(`canonical order wrong: ${JSON.stringify(Object.keys(canonRaw))}`);
  }

  // ── 3. No primitives → byte-identical ─────────────────────────────────────
  const image = makeImage(64, 64);
  const analysis = analyzeImage(new Uint8ClampedArray(image.pixels), image.width, image.height);
  const BASE = { count: 140, seed: 7 };
  const before = optimise(analysis, BASE);
  const afterNull = optimise(analysis, { ...BASE, primitives: null });
  const afterEmpty = optimise(analysis, { ...BASE, primitives: {} });
  const op0 = resolveOptions(BASE);
  const planBefore = buildScalePlan(op0, 10);
  const planNull = buildScalePlan(resolveOptions({ ...BASE, primitives: null }), 10);
  const noOp = {
    shapesIdentical: JSON.stringify(before.shapes) === JSON.stringify(afterNull.shapes)
      && JSON.stringify(before.shapes) === JSON.stringify(afterEmpty.shapes),
    planVerbatim: JSON.stringify(planBefore) === JSON.stringify(planNull),
    defaultIsNull: resolveOptions({}).primitives === null,
  };
  for (const [k, v] of Object.entries(noOp)) if (!v) fail(`no-op guarantee: ${k} failed`);

  // ── 4. A mix retunes the plan and moves the paint, deterministically ──────
  const mixLang = prim.mixStrokeLanguage({ 'wet-wash': 1, hatch: 3 });
  const planMixed = resolvePassPlan(resolveOptions({ ...BASE, primitives: { 'wet-wash': 1, hatch: 3 } }), 10);
  const each = planMixed[0];
  const single = resolvePassPlan(resolveOptions({ primitives: { hatch: 1 } }), 10)[0];
  const effect = {
    planChanges: JSON.stringify(planBefore) !== JSON.stringify(planMixed),
    languageApplied: each.radiusMul === mixLang.radiusMul
      && each.elongMul === mixLang.elongMul && each.alpha === mixLang.alpha
      && JSON.stringify(each.primitives) === JSON.stringify(mixLang.primitives),
    dominantStyleOnPass: each.style === 'cross-hatch',
    singleIsVerbatim: single.radiusMul === prim.PRIMITIVES.hatch.language.radiusMul
      && single.alpha === prim.PRIMITIVES.hatch.language.alpha
      && single.style === prim.PRIMITIVES.hatch.style,
    explicitOverrideWins: resolvePassPlan(
      resolveOptions({ primitives: { hatch: 1 }, passes: [{ id: 'x', scale: 'fine', radius: 9 }] }), 10,
    )[0].radiusMul === 9,
    deterministic: fingerprint(optimise(analysis, { ...BASE, primitives: { 'wet-wash': 1, hatch: 3 } }).shapes)
      === fingerprint(optimise(analysis, { ...BASE, primitives: { 'wet-wash': 1, hatch: 3 } }).shapes),
    outputChanges: JSON.stringify(before.shapes) !== JSON.stringify(
      optimise(analysis, { ...BASE, primitives: { 'wet-wash': 1, hatch: 3 } }).shapes),
  };
  for (const [k, v] of Object.entries(effect)) if (!v) fail(`mix effect: ${k} failed`);
  if (!effect.explicitOverrideWins) fail('an explicit per-pass radius did not win over the primitive mix');

  // ── 5. Per-primitive, alone: resolved style + measured score ──────────────
  const profileFor = (mix) => ({
    schemaVersion: 1, id: 'probe', name: 'S5 probe', version: '1.0.0',
    global: mix ? { strokeCount: 140, primitives: mix } : { strokeCount: 140, style: 'pencil' },
  });
  const baseline = scoreProfile(profileFor(null), image, { seed: 7 });
  const perPrimitive = {};
  for (const id of prim.PRIMITIVE_IDS) {
    const s = scoreProfile(profileFor({ [id]: 1 }), image, { seed: 7 });
    perPrimitive[id] = {
      style: prim.PRIMITIVES[id].style,
      simMae: +s.simMae.toFixed(3),
      deltaVsPencilProfile: +(s.simMae - baseline.simMae).toFixed(3),
      strokes: s.strokes,
    };
  }

  // ── 6. The AI half: propose WEIGHTS, not only style names ────────────────
  const knobs = primitiveKnobs();
  if (knobs.length !== prim.PRIMITIVE_IDS.length) fail('primitiveKnobs() does not cover every primitive');
  const search = searchProfile(profileFor(null), image, {
    method: 'cma', evaluations: 40, seed: 4242, primitives: true, primitiveInit: 0.3,
  });
  const searchAgain = searchProfile(profileFor(null), image, {
    method: 'cma', evaluations: 40, seed: 4242, primitives: true, primitiveInit: 0.3,
  });
  const searchHonest = {
    knobs: knobs.map((k) => k.name),
    winMix: search.primitives,
    winValue: +search.score[SEARCH_DEFAULTS.objective].toFixed(4),
    baselineValue: +search.baseline[SEARCH_DEFAULTS.objective].toFixed(4),
    improved: search.improved,
    deterministic: JSON.stringify(search.primitives) === JSON.stringify(searchAgain.primitives)
      && search.score[SEARCH_DEFAULTS.objective] === searchAgain.score[SEARCH_DEFAULTS.objective],
    evaluations: search.evaluations,
    // A search that never uses a primitive is reported as such, not dressed up.
    note: search.primitives
      ? 'the search moved primitive weights and preferred a non-empty stroke language'
      : 'the search found the empty mix best on this content (reported, not hidden)',
  };
  if (!searchHonest.deterministic) fail('the primitive-weight search is not deterministic for a fixed seed');
  if (knobsToPrimitiveMix({}) !== null) fail('knobsToPrimitiveMix({}) should be null (no primitives)');

  const r = {
    module: 'primitives-probe',
    capturedAt: new Date().toISOString(),
    image: { width: image.width, height: image.height, kind: 'synthetic (bands + disc + diagonal edge)' },
    primitives: prim.PRIMITIVE_IDS,
    resolution,
    algebra,
    noOp,
    effect,
    baselinePencilProfile: { simMae: +baseline.simMae.toFixed(3), strokes: baseline.strokes },
    perPrimitive,
    search: searchHonest,
    failures,
  };

  fs.mkdirSync(path.dirname(JSON_OUT), { recursive: true });
  fs.writeFileSync(JSON_OUT, JSON.stringify(r, null, 2));

  console.log('Resolution (primitive → existing style / media preset):');
  for (const id of prim.PRIMITIVE_IDS) {
    const e = resolution[id];
    console.log(`  ${id.padEnd(10)} → style ${e.style.padEnd(12)} (exists ${e.styleExists})  `
      + `media ${e.media.padEnd(9)} tip ${String(e.brushName).padEnd(7)}  ${e.mediaModelKind}`);
  }
  console.log(`No-op until opted in: shapes identical ${noOp.shapesIdentical}, plan verbatim ${noOp.planVerbatim}`);
  console.log(`Mix moves the paint: plan ${effect.planChanges}, output ${effect.outputChanges}, `
    + `deterministic ${effect.deterministic}, explicit override wins ${effect.explicitOverrideWins}`);
  console.log(`Measured on synthetic content (NOT a style-accuracy claim) — simMae, pencil-profile baseline `
    + `${baseline.simMae.toFixed(3)}:`);
  for (const id of prim.PRIMITIVE_IDS) {
    const e = perPrimitive[id];
    console.log(`  ${id.padEnd(10)} ${String(e.simMae).padStart(7)}  (${e.deltaVsPencilProfile >= 0 ? '+' : ''}${e.deltaVsPencilProfile})`);
  }
  console.log(`AI half: ${searchHonest.improved ? 'improved' : 'no improvement'} `
    + `${searchHonest.baselineValue} → ${searchHonest.winValue} over ${searchHonest.evaluations} evals; `
    + `mix ${JSON.stringify(searchHonest.winMix)}; ${searchHonest.note}`);
  console.log(`JSON → ${path.relative(ROOT, JSON_OUT)}`);

  if (failures.length) {
    console.error(`\nFAIL (${failures.length}):`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log('\nPASS: primitives resolve to existing styles/media, are a no-op until opted in, '
    + 'retune the pass schedule deterministically, and are proposed as weights by the AI harness');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(2); });
