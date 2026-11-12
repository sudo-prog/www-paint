/**
 * Benchmark gate (Phase 5 / Harness H5).
 *
 * Tier B of the AI harness (`docs/AI_STYLE_HARNESS.md` §2) lets an agent propose
 * an **engine-code** change. The safety mechanism is this gate: *"nothing is kept
 * unless the metrics improve without regressing other images"* (§2), and a code
 * change additionally needs **human approval** (guardrail #4).
 *
 * This module is the deterministic core that decision runs on. It is deliberately
 * free of any notion of *how* a variant is produced — the proposer and the
 * run-loop live above it — so it can gate a knob change, a code patch, or a
 * different renderer, from the same two evaluations.
 *
 * Pure, no DOM, node-testable.
 *
 * @module gate
 */

/** Default gate policy. @type {object} */
export const GATE_DEFAULTS = {
  objective: 'simMae',       // which metric to improve ('simMae' | 'ssim' | ...)
  minGain: 0,                // required mean improvement (strictly greater)
  maxRegressions: 0,         // images allowed to get worse
  regressionTolerance: 1e-9, // |delta| below this is not a regression
  approve: false,            // human approval (Tier B requirement)
  // Extra metrics that must NOT regress even when the objective improves, e.g.
  //   [{ metric: 'simMae', maxDrop: 0 }]
  // Track-S S2 needs this: a *style-match* gain must not be bought by painting
  // something that no longer reproduces the content.
  guards: [],
};

/**
 * Evaluate one candidate (an engine variant / profile) over a benchmark set.
 *
 * @param {(image: object, index: number) => object} evalFn returns a metrics
 *   object (`{ simMae, ssim, ... }`) for one image.
 * @param {Array<object>} images each `{ name?, pixels, width, height, ... }`.
 * @param {object} [opts] `{ objective }`
 * @returns {{objective: string, perImage: Array<{name: string, value: number, metrics: object}>,
 *   aggregate: {mean: number, min: number, count: number}}}
 */
export function evaluateSet(evalFn, images, opts = {}) {
  const objective = opts.objective || GATE_DEFAULTS.objective;
  if (typeof evalFn !== 'function') throw new Error('evaluateSet: evalFn must be a function');
  if (!Array.isArray(images)) throw new Error('evaluateSet: images must be an array');
  const perImage = images.map((image, i) => {
    const metrics = evalFn(image, i) || {};
    return { name: image && image.name ? image.name : `image${i}`, metrics, value: metrics[objective] };
  });
  const vals = perImage.map((p) => p.value).filter((v) => Number.isFinite(v));
  const mean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  const min = vals.length ? Math.min(...vals) : 0;
  return { objective, perImage, aggregate: { mean, min, count: vals.length } };
}

/**
 * Decide whether a candidate change is kept, reverted, or pending approval.
 *
 * @param {object} baseline result of {@link evaluateSet} for the current engine.
 * @param {object} candidate result of {@link evaluateSet} for the proposed change.
 * @param {object} [opts] see {@link GATE_DEFAULTS}.
 * @returns {{decision: 'keep'|'revert'|'pending', objective: string,
 *   meanDelta: number, improved: boolean,
 *   regressions: Array<{name: string, delta: number}>,
 *   deltas: Array<{name: string, delta: number}>,
 *   requiresApproval: boolean, approved: boolean, reasons: string[]}}
 */
export function gateChange(baseline, candidate, opts = {}) {
  const o = { ...GATE_DEFAULTS, ...opts };
  if (!baseline || !candidate || !Array.isArray(baseline.perImage) || !Array.isArray(candidate.perImage)) {
    throw new Error('gateChange: baseline and candidate must be evaluateSet results');
  }
  const tol = Math.abs(o.regressionTolerance);
  const byName = new Map(baseline.perImage.map((p) => [p.name, p.value]));

  const deltas = [];
  const regressions = [];
  for (const c of candidate.perImage) {
    const b = byName.get(c.name);
    if (b === undefined) continue;
    const delta = c.value - b;
    deltas.push({ name: c.name, delta });
    if (delta < -tol) regressions.push({ name: c.name, delta });
  }

  // Guards: secondary metrics that must not regress on ANY image, even when the
  // objective improves. This is what makes a style-match gain safe to keep — the
  // style term may only be won if the reconstruction held up.
  const guardDrops = [];
  for (const g of o.guards || []) {
    const metric = g && g.metric;
    if (!metric) continue;
    const maxDrop = Math.abs(g.maxDrop === undefined ? 0 : g.maxDrop);
    for (const c of candidate.perImage) {
      const b = baseline.perImage.find((p) => p.name === c.name);
      if (!b) continue;
      const bv = b.metrics ? b.metrics[metric] : undefined;
      const cv = c.metrics ? c.metrics[metric] : undefined;
      if (!Number.isFinite(bv) || !Number.isFinite(cv)) continue;
      const drop = bv - cv;
      if (drop > maxDrop + tol) guardDrops.push({ name: c.name, metric, drop });
    }
  }

  const meanDelta = candidate.aggregate.mean - baseline.aggregate.mean;
  const improved = meanDelta > o.minGain;

  const reasons = [];
  let decision;
  if (!improved) {
    decision = 'revert';
    reasons.push(`mean ${o.objective} did not improve (Δ ${meanDelta})`);
  } else if (regressions.length > o.maxRegressions) {
    decision = 'revert';
    reasons.push(`${regressions.length} image(s) regressed (allowed ${o.maxRegressions})`);
  } else if (guardDrops.length) {
    decision = 'revert';
    const first = guardDrops[0];
    reasons.push(`guard ${first.metric} regressed on ${guardDrops.length} image(s) `
      + `(worst ${first.name} −${first.drop})`);
  } else if (!o.approve) {
    decision = 'pending';
    reasons.push('metrics improved without regression; awaiting human approval');
  } else {
    decision = 'keep';
    reasons.push('metrics improved without regression; approved');
  }

  return {
    decision,
    objective: o.objective,
    meanDelta,
    improved,
    regressions,
    guardDrops,
    deltas,
    requiresApproval: true,
    approved: !!o.approve,
    reasons,
  };
}

/**
 * Convenience: evaluate a baseline and a candidate over the same set and gate.
 *
 * @param {(image: object, index: number) => object} baselineFn
 * @param {(image: object, index: number) => object} candidateFn
 * @param {Array<object>} images
 * @param {object} [opts] see {@link GATE_DEFAULTS}
 * @returns {{baseline: object, candidate: object, gate: object}}
 */
export function gateVariants(baselineFn, candidateFn, images, opts = {}) {
  const objective = opts.objective || GATE_DEFAULTS.objective;
  const baseline = evaluateSet(baselineFn, images, { objective });
  const candidate = evaluateSet(candidateFn, images, { objective });
  return { baseline, candidate, gate: gateChange(baseline, candidate, opts) };
}

export default { GATE_DEFAULTS, evaluateSet, gateChange, gateVariants };
