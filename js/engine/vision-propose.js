/**
 * Vision proposer (Phase 5 / Harness H3).
 *
 * The flagship half of the AI loop (`docs/AI_STYLE_HARNESS.md` §1): given 1–4
 * reference images, a **vision LLM proposes a Style Profile**, then the proposal
 * is refined by the H2 search and measured by the H1 metrics — the metrics are
 * the critique. Accepted attempts are written to the H4 memory so a similar
 * reference later starts closer.
 *
 * Design: the **LLM backend is injected** (`opts.llm`, an async
 * `({system, user, images}) => string`), so the orchestration — prompt building,
 * tolerant parsing, clamping, refinement, recording — is deterministic and
 * testable under plain `node` with a stub. `openAICompatibleBackend()` is a real
 * adapter; nothing here requires a network in tests.
 *
 * No DOM, no browser.
 *
 * @module vision-propose
 */

import { KNOB_SET, clampKnobs, scoreProfile, profileToOptimiserOptions } from './score.js';
import { knobsToProfile, profileKnobValues, searchProfile, SEARCH_DEFAULTS } from './propose.js';
import { PROFILE_SCHEMA_VERSION } from './profile.js';

/** Default configuration. @type {object} */
export const VISION_PROPOSE_DEFAULTS = {
  maxImages: 4,
  seed: 12345,
  refine: true,          // run the H2 search after the LLM proposal
  evaluations: 24,       // refinement budget (scoreProfile calls)
  objective: 'simMae',
  temperature: 0.2,
};

/** A minimal, valid base profile when the caller supplies none. */
function defaultBaseProfile() {
  return {
    schemaVersion: PROFILE_SCHEMA_VERSION || 1,
    id: 'proposed', name: 'Proposed', version: '1.0.0',
    global: { style: 'painterly', strokeCount: 400, detailLevel: 0.7, opacity: 0.9, smart: true, seed: 12345 },
  };
}

/**
 * Build the (system, user) prompt describing the bounded action space.
 * @param {object} [opts]
 * @returns {{system: string, user: string}}
 */
export function buildProposalPrompt(opts = {}) {
  const knobLines = KNOB_SET.map((k) => {
    const spec = k.type === 'boolean' ? 'boolean'
      : k.type === 'string' ? `string (e.g. "${k.default}")`
        : `${k.type} ${k.min}..${k.max}${k.step ? ` step ${k.step}` : ''}`;
    return `- ${k.name} (${spec}), default ${JSON.stringify(k.default)}`;
  }).join('\n');
  const system =
    'You are a painting-style analyst. Given 1-4 reference images, propose a ' +
    'Style Profile for a stroke-based image-repainting engine. Reply with ONLY a ' +
    'JSON object of parameter values — no prose, no code fence.';
  const user =
    `Available parameters:\n${knobLines}\n\n` +
    'Return JSON of the form {"knobs": { ... }} using only the names above. ' +
    'Choose values that best match the reference style.';
  return { system, user };
}

/**
 * Tolerantly parse an LLM reply into a clamped knob vector. Handles a bare JSON
 * object, a ```json fenced block, and JSON embedded in prose. Accepts a
 * `{knobs:{…}}` or `{global:{…}}` wrapper, or a flat knob map.
 *
 * @param {*} text the LLM reply
 * @returns {{knobs: object, source: string}|null} null when nothing usable
 */
export function parseProposal(text) {
  if (typeof text !== 'string' || !text.trim()) return null;
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return null;
  let obj;
  try { obj = JSON.parse(t.slice(start, end + 1)); } catch { return null; }
  if (!obj || typeof obj !== 'object') return null;
  const source = obj.knobs ? 'knobs' : (obj.global ? 'global' : 'flat');
  const knobs = clampKnobs(obj.knobs || obj.global || obj);
  if (!Object.keys(knobs).length) return null;
  return { knobs, source };
}

/**
 * The full H3 step: LLM proposes → parse → (optional) refine with the H2 search
 * → score → optionally record to memory.
 *
 * @param {Array|object} images 1–4 reference images (`{pixels,width,height}`);
 *   the LLM backend consumes them however it needs.
 * @param {object} opts
 * @param {(req: {system: string, user: string, images: Array}) => Promise<string>} opts.llm
 * @param {object} [opts.baseProfile]
 * @param {{pixels: Uint8ClampedArray, width: number, height: number}} [opts.image]
 *   the image the refinement search scores against (usually one of `images`).
 * @param {object} [opts.memory] an H4 store (see `memory.js`)
 * @param {string} [opts.imageHash] averageHash for the memory record
 * @param {number} [opts.seed] @param {boolean} [opts.refine]
 * @param {number} [opts.evaluations] @param {string} [opts.objective]
 * @param {number} [opts.maxImages=4] @param {number} [opts.temperature]
 * @returns {Promise<object>} `{ ok, parsed, raw, knobs, profile, score, refined,
 *   evaluations, refinement }`
 */
export async function proposeFromImages(images, opts = {}) {
  const o = { ...VISION_PROPOSE_DEFAULTS, ...opts };
  if (typeof o.llm !== 'function') throw new Error('proposeFromImages requires an injected llm backend');
  const list = (Array.isArray(images) ? images : [images]).filter(Boolean).slice(0, o.maxImages);
  const baseProfile = o.baseProfile || defaultBaseProfile();

  const { system, user } = buildProposalPrompt(o);
  let raw = null;
  try { raw = await o.llm({ system, user, images: list, temperature: o.temperature }); }
  catch (e) { raw = null; } // a backend failure is an unusable proposal, not a crash

  const parsed = parseProposal(raw);
  if (!parsed) {
    // No usable proposal → hand back the base profile's own knobs, unrefined.
    const knobs = profileKnobValues(baseProfile);
    return {
      ok: false, parsed: null, raw, knobs,
      profile: knobsToProfile(baseProfile, knobs), score: null,
      refined: false, evaluations: 0, refinement: null,
    };
  }

  let knobs = { ...parsed.knobs };
  let profile = knobsToProfile(baseProfile, knobs);
  let score = null;
  let refined = false;
  let evaluations = 0;
  let refinement = null;

  if (o.refine && o.image) {
    const r = searchProfile(profile, o.image, {
      seed: o.seed, objective: o.objective, evaluations: o.evaluations, init: knobs,
    });
    knobs = r.knobs;
    profile = r.profile;
    score = r.score;
    refined = r.improved;
    evaluations = r.evaluations;
    refinement = { baseline: r.baseline, best: r.score, history: r.history.length };
  } else if (o.image) {
    const m = scoreProfile(profile, o.image, { seed: o.seed });
    score = { [o.objective]: m[o.objective], mae: m.mae, ssim: m.ssim };
  }

  if (o.memory) {
    o.memory.record({
      imageHash: o.imageHash,
      knobs,
      profile,
      score: score || { [o.objective]: 0 },
      rating: 0,
      meta: { source: 'h3', refined },
    });
  }

  return { ok: true, parsed, raw, knobs, profile, score, refined, evaluations, refinement };
}

/**
 * A real backend: an OpenAI-compatible chat-completions endpoint. Images are
 * passed as `image_url` data/HTTP URLs. Returns the assistant text.
 *
 * Kept dependency-free (global `fetch`); the caller supplies the key — nothing
 * here reads or stores one.
 *
 * @param {object} cfg
 * @param {string} cfg.baseUrl e.g. `http://localhost:20128/v1`
 * @param {string} cfg.model
 * @param {string} [cfg.apiKey]
 * @param {string} [cfg.imageDetail='low']
 * @returns {(req: {system: string, user: string, images: Array, temperature?: number}) => Promise<string>}
 */
export function openAICompatibleBackend(cfg) {
  const baseUrl = String(cfg.baseUrl || '').replace(/\/$/, '');
  const model = cfg.model;
  if (!baseUrl || !model) throw new Error('openAICompatibleBackend requires { baseUrl, model }');
  const detail = cfg.imageDetail || 'low';

  async function toImageUrl(img) {
    if (typeof img === 'string') return img; // already a URL / data URL
    if (img && typeof img.dataUrl === 'string') return img.dataUrl;
    if (img && img.pixels && img.width && img.height) {
      // Node-side PNG encoding is out of scope here (no canvas); callers pass a
      // data URL. Fail loudly rather than send a broken payload.
      throw new Error('openAICompatibleBackend: image must be a URL/dataUrl (pass {dataUrl})');
    }
    throw new Error('openAICompatibleBackend: unsupported image');
  }

  return async function llm({ system, user, images = [], temperature = 0.2 }) {
    const content = [{ type: 'text', text: user }];
    for (const img of images) {
      content.push({ type: 'image_url', image_url: { url: await toImageUrl(img), detail } });
    }
    const body = {
      model,
      temperature,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content },
      ],
    };
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`LLM backend ${res.status}`);
    const json = await res.json();
    return json && json.choices && json.choices[0] && json.choices[0].message
      ? json.choices[0].message.content : '';
  };
}

export default {
  VISION_PROPOSE_DEFAULTS, buildProposalPrompt, parseProposal,
  proposeFromImages, openAICompatibleBackend,
};
