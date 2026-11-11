/**
 * Search proposer (Phase 5 / Harness H2).
 *
 * The no-LLM half of the AI loop (`docs/AI_STYLE_HARNESS.md` §5 H2): given a
 * base profile and a target image, search the **bounded** knob space for a
 * profile that scores better than the hand-set default.
 *
 * Two deterministic methods, both built on `score.KNOB_SET` / `clampKnobs` and
 * the headless `scoreProfile` primitive:
 *
 *   - `random` — uniform sampling of the searchable knobs, best-of-N.
 *   - `cma`    — a compact (μ, λ) evolution strategy: sample a Gaussian cloud
 *                around a running mean, keep the elite μ, adapt the per-knob
 *                step size. (CMA-ES-lite: covariance is diagonal, full
 *                covariance is deliberately out of scope.)
 *
 * Deterministic for a fixed `seed` (harness guardrail #1) and bounded by an
 * evaluation budget (#2). Pure: no DOM, no canvas, node-testable.
 *
 * **Stroke count is fixed at the base value by default** so "beats the default"
 * is a genuine quality gain at *equal cost*, not a win bought with more strokes.
 *
 * @module propose
 */

import { rng } from '../utils/rng.js';
import { KNOB_SET, getKnobDefaults, clampKnobs, scoreProfile } from './score.js';

/** Default search configuration. @type {object} */
export const SEARCH_DEFAULTS = {
  method: 'cma',        // 'random' | 'cma'
  evaluations: 48,      // hard budget on scoreProfile() calls (incl. the baseline)
  seed: 12345,
  objective: 'simMae',  // 'simMae' | 'ssim'
  fixed: ['strokeCount'],// knobs held at their base value (equal-cost comparison)
  lambda: 8,            // offspring per CMA generation
  mu: 3,                // elites kept per generation
  sigmaInit: 0.25,      // initial step, as a fraction of each knob's range
  sigmaMin: 0.02,
  init: null,           // starting knob vector; defaults to getKnobDefaults()
};

/**
 * The knobs a search may move: numeric/integer/boolean knobs that actually
 * drive the *scoring* engine (`target` is an `optimiser.*` surface), minus any
 * held fixed. String knobs (registry style names) and engine-only knobs the
 * modular optimiser does not honour (e.g. `multiLayer`) are excluded, so the
 * search never wanders over dimensions that cannot change the measured score.
 *
 * @param {string[]} [fixed]
 * @returns {Array<object>}
 */
export function searchableKnobs(fixed = []) {
  return KNOB_SET.filter((k) =>
    (k.type === 'number' || k.type === 'integer' || k.type === 'boolean') &&
    k.target.startsWith('optimiser.') &&
    !fixed.includes(k.name));
}

/**
 * Knob values implied by a base profile's `global` block (so the search starts
 * from — and holds fixed at — the *profile's* values, not the schema defaults).
 * @param {object} profile
 * @returns {object}
 */
export function profileKnobValues(profile) {
  const g = profile && profile.global ? profile.global : {};
  const out = {};
  for (const k of KNOB_SET) {
    if (!k.path.startsWith('global.')) continue;
    const key = k.path.slice('global.'.length);
    if (g[key] !== undefined) out[k.name] = g[key];
  }
  return out;
}

/**
 * Apply knob values that live on the profile's `global` block.
 *
 * @param {object} baseProfile
 * @param {object} knobs
 * @returns {object} a shallow-cloned profile with the mapped globals set
 */
export function knobsToProfile(baseProfile, knobs) {
  const global = { ...(baseProfile.global || {}) };
  for (const k of KNOB_SET) {
    if (knobs[k.name] === undefined) continue;
    if (k.path.startsWith('global.')) global[k.path.slice('global.'.length)] = knobs[k.name];
  }
  return { ...baseProfile, global };
}

/**
 * The optimiser-option overrides implied by knob values (only engine knobs that
 * are NOT already carried on the profile's global block).
 *
 * @param {object} knobs
 * @returns {object}
 */
export function knobsToOptimiser(knobs) {
  const out = {};
  for (const k of KNOB_SET) {
    if (knobs[k.name] === undefined) continue;
    if (k.target.startsWith('optimiser.') && !k.path.startsWith('global.')) {
      out[k.target.slice('optimiser.'.length)] = knobs[k.name];
    }
  }
  return out;
}

/**
 * Search for a better knob vector. Returns the winning vector plus a full,
 * honest record of every evaluation (wins *and* losses — harness guardrail #5).
 *
 * @param {object} baseProfile - a Style Profile to start from.
 * @param {{pixels: Uint8ClampedArray, width: number, height: number}} image
 * @param {object} [options] - see {@link SEARCH_DEFAULTS}.
 * @returns {{knobs: object, profile: object, score: object, baseline: object,
 *   improved: boolean, evaluations: number, history: Array<object>}}
 */
export function searchProfile(baseProfile, image, options = {}) {
  const opts = { ...SEARCH_DEFAULTS, ...options };
  const random = rng(opts.seed | 0);
  const active = searchableKnobs(opts.fixed);
  // Start from the schema defaults, then the BASE PROFILE's own values (so a
  // fixed knob is held at the profile's count, not the schema default), then
  // any explicit `init`.
  const start = clampKnobs({ ...getKnobDefaults(), ...profileKnobValues(baseProfile), ...(opts.init || {}) });
  // Hold fixed knobs at their base value so the mapping never drops them.
  const frozen = {};
  for (const name of opts.fixed) if (start[name] !== undefined) frozen[name] = start[name];

  const objective = (knobs) => {
    const evaluated = { ...frozen, ...knobs };
    const s = scoreProfile(knobsToProfile(baseProfile, evaluated), image, {
      seed: opts.seed, optimiser: knobsToOptimiser(evaluated),
    });
    return s[opts.objective];
  };

  const history = [];
  let evals = 0;
  const evaluate = (knobs, tag) => {
    const value = objective(knobs);
    evals++;
    const rec = { value, knobs: clampKnobs({ ...frozen, ...knobs }), tag };
    history.push(rec);
    return rec;
  };

  const baselineVec = clampKnobs({ ...frozen, ...active.reduce((a, k) => { a[k.name] = start[k.name]; return a; }, {}) });
  const baseline = evaluate(baselineVec, 'baseline');

  let best = baseline;
  if (active.length === 0 || opts.evaluations <= 1) {
    return finish(best, baseline, history, evals, baseProfile, opts);
  }

  const range = (k) => (k.type === 'boolean' ? 1 : (k.max - k.min));
  const normal = () => {
    // Box–Muller from the seeded RNG → deterministic Gaussian.
    const u1 = Math.max(1e-9, random.next());
    const u2 = random.next();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  };

  if (opts.method === 'random') {
    while (evals < opts.evaluations) {
      const v = {};
      for (const k of active) {
        v[k.name] = k.type === 'boolean'
          ? (random.next() < 0.5)
          : k.min + random.next() * range(k);
      }
      const rec = evaluate(v, 'random');
      if (rec.value > best.value) best = rec;
    }
  } else {
    // (μ, λ) evolution strategy with per-knob step sizes.
    let mean = {};
    let sigma = {};
    for (const k of active) { mean[k.name] = start[k.name]; sigma[k.name] = opts.sigmaInit * range(k); }
    let gen = 0;
    while (evals < opts.evaluations) {
      const births = [];
      for (let i = 0; i < opts.lambda && evals < opts.evaluations; i++) {
        const v = {};
        for (const k of active) {
          v[k.name] = k.type === 'boolean'
            ? (mean[k.name] ? random.next() > 0.2 : random.next() < 0.2)
            : mean[k.name] + sigma[k.name] * normal();
        }
        births.push(evaluate(v, `cma-${gen}`));
      }
      births.sort((a, b) => b.value - a.value);
      const elites = births.slice(0, Math.max(1, Math.min(opts.mu, births.length)));
      for (const k of active) {
        let sum = 0;
        for (const e of elites) sum += e.knobs[k.name];
        mean[k.name] = sum / elites.length;
        // 1/5th-success-style shrink toward a floor.
        sigma[k.name] = Math.max(opts.sigmaMin * range(k), sigma[k.name] * 0.85);
      }
      if (elites[0].value > best.value) best = elites[0];
      gen++;
    }
  }

  return finish(best, baseline, history, evals, baseProfile, opts);
}

function finish(best, baseline, history, evals, baseProfile, opts) {
  const knobs = clampKnobs(best.knobs);
  return {
    knobs,
    profile: knobsToProfile(baseProfile, knobs),
    score: { [opts.objective]: best.value },
    baseline: { [opts.objective]: baseline.value },
    improved: best.value > baseline.value,
    evaluations: evals,
    history,
  };
}

export default { SEARCH_DEFAULTS, searchableKnobs, profileKnobValues, knobsToProfile, knobsToOptimiser, searchProfile };
