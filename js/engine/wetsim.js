/**
 * Wet-media simulation: wetness, pigment and paper height on a grid.
 *
 * Phase 3 (IF-2). This module models the *material* behaviour of water-based
 * media — water is deposited with pigment, water carries pigment, and pigment
 * is left behind when water evaporates. It is deliberately small: no WebGL, no
 * DOM, no dependency beyond the project's seeded RNG.
 *
 * Research (ideas only — this is our own expression, not a port):
 *   - inkwash (johnowhitaker/inkwash): ink moves only where paper is wet;
 *     a wetness grid gates transport.
 *   - watercolor-playground (msurguy): wet-gated flow plus tide lines, the
 *     darker rim a drying wash leaves at its boundary.
 *   - dli/paint: keeping colour separate from height/wetness, so shading can
 *     be derived from the height field rather than painted per stroke.
 *   - wet-paint-flow (simonxxooxxoo): height + wetness + bristle channels.
 *
 * Technique roots: Curtis et al., "Computer-Generated Watercolor" (SIGGRAPH
 * 1997) — shallow-water layer, capillary layer, and pigment deposition on a
 * height field. See docs/REFERENCES.md and docs/checkpoints/P3.md.
 *
 * ─── Integration contract (for the ThinkPad, who owns renderer.js) ───
 * `renderer.js` is ThinkPad-owned (HANDOFF §6), so this module does NOT import
 * it and the renderer is not edited from this stream. Wire-in needs exactly
 * one call site in `renderLayer()`:
 *
 *   import { createWetSim } from './wetsim.js';
 *   // constructor: this._wetSim = opts.wetMedia ? createWetSim(this.width, this.height, opts.wetMedia) : null;
 *   // renderLayer(), after the style draw and before ctx.restore():
 *   //   if (this._wetSim) { this._wetSim.dry(opts.dt || 1/60); this._wetSim.compositeInto(ctx); }
 *   // style draw hook deposits pigment for each stroke:
 *   //   this._wetSim?.deposit(shape.x, shape.y, shape.size, shape.color, { amount, water });
 *
 * `compositeInto` requires `ctx.canvas.width/height` to equal the sim grid, so
 * construct the sim at the render target's size. See docs/checkpoints/P3.md.
 *
 * @module wetsim
 */

import { createRNG } from '../utils/rng.js';

/** Fields carried for each pigment. Mass is conserved except by explicit lift. */
const PIGMENT_CHANNELS = ['r', 'g', 'b'];

/// Paper pigment capacity — the maximum mass of pigment paper can hold.
/// Above it, pigment is mobile (suspended in water); below it, it is fixed.
const PIGMENT_CAPACITY = 0.6;

/// Water that can be held per unit height of paper above the base surface.
const CAPILLARY_K = 0.3;

/** Evaporation per second at `dryRate`. */
const EVAPORATION = 0.05;

/** Pigment fixed per unit of drying, once the paper is below capacity. */
const FIX_RATE = 0.08;

/** Clamp helper. */
function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * Create a wet-media simulation over a `width` x `height` grid.
 *
 * The returned object satisfies the frozen IF-2 interface:
 *   { wetness, height, deposit, dry, compositeInto }
 *
 * @param {number} width
 * @param {number} heightPx
 * @param {object} [opts]
 * @param {number} [opts.seed=12345] - Seeded RNG. Same seed + same call
 *   sequence ⇒ byte-identical state.
 * @param {number} [opts.heightScale=1] - Multiplier on paper surface relief.
 * @param {number} [opts.maxWet=1.5] - Wetness saturation.
 * @param {number} [opts.flowRate=0.45] - How fast water levels out (0..1).
 * @param {number} [opts.dryRate=1] - Evaporation multiplier.
 * @param {number} [opts.fixRate=FIX_RATE] - Pigment fixing rate.
 * @param {number} [opts.pigmentCapacity=PIGMENT_CAPACITY] - Fixed/mobile threshold.
 * @param {number} [opts.granulation=0] - Granularity of the paper surface.
 * @returns {object} WetSim instance.
 */
export function createWetSim(width, heightPx, opts = {}) {
  const {
    seed = 12345,
    heightScale = 1,
    maxWet = 1.5,
    flowRate = 0.45,
    dryRate = 1,
    fixRate = FIX_RATE,
    pigmentCapacity = PIGMENT_CAPACITY,
    granulation = 0,
  } = opts;

  const w = Math.max(1, Math.floor(width));
  const h = Math.max(1, Math.floor(heightPx));
  const n = w * h;

  const wetness = new Float32Array(n);
  /** Pigment mass per channel (r, g, b). Total pigment mass is their sum. */
  const pigment = new Float32Array(n * 3);
  /** Fixed (immobile) pigment mass per channel. */
  const fixed = new Float32Array(n * 3);
  /** Height of the paper surface above the base plane (IF-2 `height`). */
  const height = new Float32Array(n);

  // Paper surface: smooth low-frequency relief plus optional granulation.
  // Deterministic from the seed; never Math.random(). The relief lattice is
  // shifted by a seeded offset so different seeds yield visibly different
  // paper (the lattice itself is a fixed, cheap sine basis).
  const rnd = createRNG((seed >>> 0) || 1);
  const offX = rnd() * 64;
  const offY = rnd() * 64;
  const waves = [
    { fx: 0.011, fy: 0.007, ph: 0.4, am: 0.9 },
    { fx: 0.023, fy: 0.019, ph: 2.1, am: 0.55 },
    { fx: 0.041, fy: 0.013, ph: 4.7, am: 0.3 },
  ];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let v = 0;
      for (const wv of waves) {
        v += wv.am * Math.sin(2 * Math.PI * (wv.fx * (x + offX) + wv.fy * (y + offY)) + wv.ph);
      }
      v = (v / waves.length) * 0.5 + 0.5; // 0..1
      if (granulation > 0) {
        // Paper tooth: fine seeded noise, independent of the smooth relief.
        v = clamp01(v + (rnd() - 0.5) * granulation);
      }
      height[i] = v * heightScale;
    }
  }

  /** Thickness of the water layer at each pixel. */
  const waterLayer = new Float32Array(n);
  /** Capacity of the paper surface at each pixel. */
  const capacity = new Float32Array(n);
  for (let i = 0; i < n; i++) capacity[i] = CAPILLARY_K * height[i];

  /** Simulation clock, seconds. */
  let time = 0;

  /**
   * Total pigment mass currently mobile (suspended) in the water layer.
   * @returns {number}
   */
  function mobileMass() {
    let m = 0;
    for (let i = 0; i < n; i++) {
      const o = i * 3;
      m += pigment[o] + pigment[o + 1] + pigment[o + 2];
    }
    return m;
  }

  /**
   * Total pigment mass fixed into the paper.
   * @returns {number}
   */
  function fixedMass() {
    let m = 0;
    for (let i = 0; i < n; i++) {
      const o = i * 3;
      m += fixed[o] + fixed[o + 1] + fixed[o + 2];
    }
    return m;
  }

  /**
   * Total pigment mass (mobile + fixed). Conservation target for tests.
   * @returns {number}
   */
  function totalMass() {
    return mobileMass() + fixedMass();
  }

  /**
   * Deposit pigment and water at (x, y).
   *
   * @param {number} x
   * @param {number} y
   * @param {number} radius - Brush radius in pixels.
   * @param {Array<number>|object} color - `[r,g,b]` in 0..255, or `{r,g,b}`.
   * @param {object} [depositOpts]
   * @param {number} [depositOpts.amount=1] - Pigment amount.
   * @param {number} [depositOpts.water=0.6] - Water amount carried with it.
   * @param {number} [depositOpts.pressure=1] - Scales both amounts.
   * @param {number} [depositOpts.granulation] - Optional per-stroke paper tooth.
   * @returns {number} Pigment mass added.
   */
  function deposit(x, y, radius, color, depositOpts = {}) {
    const { amount = 1, water = 0.6, pressure = 1 } = depositOpts;
    const cr = Array.isArray(color) ? color[0] : (color.r || 0);
    const cg = Array.isArray(color) ? color[1] : (color.g || 0);
    const cb = Array.isArray(color) ? color[2] : (color.b || 0);

    const amt = Math.max(0, amount * pressure);
    const wat = Math.max(0, water * pressure);
    if (amt <= 0 && wat <= 0) return 0;

    const r = Math.max(0.5, radius);
    const r2 = r * r;
    const x0 = Math.max(0, Math.floor(x - r));
    const x1 = Math.min(w - 1, Math.ceil(x + r));
    const y0 = Math.max(0, Math.floor(y - r));
    const y1 = Math.min(h - 1, Math.ceil(y + r));

    let added = 0;
    for (let py = y0; py <= y1; py++) {
      for (let px = x0; px <= x1; px++) {
        const dx = px - x;
        const dy = py - y;
        const d2 = dx * dx + dy * dy;
        if (d2 > r2) continue;
        // Soft, deterministic falloff (no RNG per pixel).
        const t = 1 - d2 / r2;
        const fall = t * t;
        const i = py * w + px;
        wetness[i] = Math.min(maxWet, wetness[i] + wat * fall);
        waterLayer[i] += wat * fall;
        if (amt > 0) {
          // Store pigment as *coverage* per channel, i.e. how much of that
          // channel the pigment ABSORBS. Real paint absorbs the complement of
          // the colour it reflects: a red pigment absorbs green and blue, so
          // storing the raw colour would tint the complementary way round.
          // This is the quantity that transports and is conserved; the
          // deposited colour's channel ratios carry the hue.
          const o = i * 3;
          const m = Math.min(1, amt * fall * 0.25);
          pigment[o] += (1 - cr / 255) * m;
          pigment[o + 1] += (1 - cg / 255) * m;
          pigment[o + 2] += (1 - cb / 255) * m;
          added += (cr + cg + cb) * m;
        }
      }
    }
    return added;
  }

  /**
   * Advance the simulation by `dt` seconds.
   *
   * Steps: (1) water relaxes toward the level the paper can hold (excess runs
   * off), (2) pigment is transported with the mobile water, (3) water
   * evaporates, (4) pigment that is now below the paper's capacity becomes
   * fixed. Pigment mass is never destroyed here — only moved or fixed.
   *
   * @param {number} dt - Seconds to advance.
   * @param {object} [dryOpts]
   * @param {boolean} [dryOpts.evaporate=true] - Allow drying.
   * @param {boolean} [dryOpts.transport=true] - Allow pigment flow.
   * @returns {{mobile: number, fixed: number, total: number}} Mass bookkeeping.
   */
  function dry(dt, dryOpts = {}) {
    const { evaporate = true, transport = true } = dryOpts;
    const step = Math.max(0, dt);
    if (step === 0) {
      return { mobile: mobileMass(), fixed: fixedMass(), total: totalMass() };
    }
    time += step;

    // 1. Water relaxes toward the paper's capillary capacity. Excess water is
    //    shed (it runs off / is absorbed); this is a water bookkeeping change
    //    only — it never removes pigment. Capillary wicking is intentionally
    //    skipped once drying has started, otherwise evaporation can never win
    //    and the frame never dries.
    const wicking = evaporate && dryRate > 0 ? 0 : 0.25;
    for (let i = 0; i < n; i++) {
      const target = capacity[i];
      const relax = 1 - Math.exp(-flowRate * step);
      if (wetness[i] > target) {
        wetness[i] = target + (wetness[i] - target) * (1 - relax);
      } else if (wicking > 0) {
        // Paper wicks water up toward its capacity (capillary pull).
        wetness[i] = wetness[i] + (target - wetness[i]) * relax * wicking;
      }
      if (wetness[i] < 0) wetness[i] = 0;
    }

    // 2. Pigment transport. Pigment moves down the wetness gradient (from wet
    //    to less-wet), which is what makes a wet edge bloom outward. The
    //    gradient is derived from the current wetness field, so flow direction
    //    is a function of state, not of call order.
    if (transport && flowRate > 0) {
      const scratch = new Float32Array(n * 3);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          const o = i * 3;
          const wt = wetness[i];
          if (wt <= 0) continue;
          // Neighbour wetness; pigment flows toward the drier side.
          const wl = x > 0 ? wetness[i - 1] : wt;
          const wr = x < w - 1 ? wetness[i + 1] : wt;
          const wu = y > 0 ? wetness[i - w] : wt;
          const wd = y < h - 1 ? wetness[i + w] : wt;
          const gx = (wr - wl) * 0.5;
          const gy = (wd - wu) * 0.5;
          // Flow rate is proportional to local wetness and to the gradient.
          const k = flowRate * step * 0.25 * Math.min(1, wt);
          // Redistribute a fraction of the mobile pigment toward lower wetness.
          for (let c = 0; c < 3; c++) {
            const m = pigment[o + c];
            if (m <= 0) continue;
            // Fraction leaving this cell along +x/-x/+y/-y.
            const fx = Math.max(0, gx) * k;
            const fy = Math.max(0, gy) * k;
            const denom = fx + fy;
            if (denom <= 0) continue; // flat wetness: no direction to flow
            const leave = m * Math.min(0.5, denom);
            pigment[o + c] -= leave;
            // Give to the neighbour(s) with lower wetness.
            if (gx > 0) {
              scratch[(i + 1) * 3 + c] += leave * (fx / denom);
            } else if (gx < 0) {
              scratch[(i - 1) * 3 + c] += leave * (-fx / denom);
            }
            if (gy > 0) {
              scratch[(i + w) * 3 + c] += leave * (fy / denom);
            } else if (gy < 0) {
              scratch[(i - w) * 3 + c] += leave * (-fy / denom);
            }
          }
        }
      }
      for (let j = 0; j < n * 3; j++) pigment[j] += scratch[j];
    }

    // 3. Evaporation. Water above the paper's capillary capacity is free
    //    surface water and leaves quickly; water held in the paper leaves
    //    slowly. This is a water bookkeeping change only — pigment is never
    //    destroyed here.
    if (evaporate && dryRate > 0) {
      const evFree = EVAPORATION * 6 * dryRate * step;
      const evHeld = EVAPORATION * 0.35 * dryRate * step;
      for (let i = 0; i < n; i++) {
        if (wetness[i] > capacity[i]) {
          const excess = wetness[i] - capacity[i];
          const lost = Math.min(excess, evFree);
          wetness[i] -= lost;
          if (wetness[i] > 0) wetness[i] = Math.max(0, wetness[i] - evHeld);
        } else {
          wetness[i] = Math.max(0, wetness[i] - evHeld);
        }
        if (waterLayer[i] > 0) {
          waterLayer[i] = Math.max(0, waterLayer[i] - evFree - evHeld);
        }
      }
    }

    // 4. Fixing: pigment below the paper's capacity becomes immobile.
    //    Pigment mass moves from `pigment` to `fixed`; total is unchanged.
    if (fixRate > 0) {
      for (let i = 0; i < n; i++) {
        const load = pigment[i * 3] + pigment[i * 3 + 1] + pigment[i * 3 + 2];
        if (load <= 0) continue;
        const hold = pigmentCapacity * (1 + capacity[i]);
        if (load <= hold) {
          const f = Math.min(1, fixRate * step);
          const o = i * 3;
          for (let c = 0; c < 3; c++) {
            const moved = pigment[o + c] * f;
            pigment[o + c] -= moved;
            fixed[o + c] += moved;
          }
        }
      }
    }

    return { mobile: mobileMass(), fixed: fixedMass(), total: totalMass() };
  }

  /**
   * Composite pigment onto a 2D canvas context.
   *
   * Reads `ctx.canvas.width/height` when present; otherwise falls back to the
   * simulation dimensions. Paints an RGBA ImageData built from the pigment
   * fields — fixed pigment is drawn first (it is the paper's stain), then the
   * mobile pigment on top with the water sheen.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} [opts]
   * @param {Array<number>} [opts.paper=[255,255,255]] - Paper base colour.
   * @param {boolean} [opts.sheen=true] - Draw a wet sheen over wet areas.
   * @returns {void}
   */
  function compositeInto(ctx, opts = {}) {
    const { paper = [255, 255, 255], sheen = true } = opts;
    if (!ctx) throw new Error('compositeInto requires a 2D context');
    const cw = ctx.canvas ? ctx.canvas.width : w;
    const ch = ctx.canvas ? ctx.canvas.height : h;
    if (cw !== w || ch !== h) {
      throw new Error(`compositeInto: context ${cw}x${ch} != sim ${w}x${h}`);
    }
    const out = new Uint8ClampedArray(n * 4);
    for (let i = 0; i < n; i++) {
      const o = i * 3;
      const fo = i * 4;
      // Coverage → absorption, sub-linear so washes stay translucent.
      const cov = (m) => 1 - Math.exp(-m * 6.0);
      // Pigment is stored as coverage in 0..1 per channel, so it maps
      // directly to absorption. Mobile and fixed pigment ADD: both layers
      // absorb, and the fixed layer starts empty (so a plain multiply would
      // zero out a fresh, still-wet wash).
      const covR = Math.min(1, cov(pigment[o]) + cov(fixed[o]));
      const covG = Math.min(1, cov(pigment[o + 1]) + cov(fixed[o + 1]));
      const covB = Math.min(1, cov(pigment[o + 2]) + cov(fixed[o + 2]));
      out[fo] = paper[0] * (1 - covR);
      out[fo + 1] = paper[1] * (1 - covG);
      out[fo + 2] = paper[2] * (1 - covB);
      out[fo + 3] = 255;
      if (sheen && wetness[i] > 0.02) {
        // Wet areas darken slightly — water darkens paper.
        const k = Math.min(0.10, wetness[i] * 0.07);
        out[fo] *= 1 - k;
        out[fo + 1] *= 1 - k;
        out[fo + 2] *= 1 - k;
      }
    }
    const img = new ImageData(out, w, h);
    if (typeof ctx.putImageData === 'function') {
      ctx.putImageData(img, 0, 0);
    }
  }

  /**
   * Read the state as an RGBA buffer. Node-safe (no canvas).
   * @param {object} [opts] - Same as compositeInto.
   * @returns {Uint8ClampedArray}
   */
  function toRGBA(opts = {}) {
    const { paper = [255, 255, 255], sheen = true } = opts;
    const out = new Uint8ClampedArray(n * 4);
    for (let i = 0; i < n; i++) {
      const o = i * 3;
      const fo = i * 4;
      const cov = (m) => 1 - Math.exp(-m * 6.0);
      // Same absorptive model as compositeInto: coverage subtracts from paper.
      const covR = Math.min(1, cov(pigment[o]) + cov(fixed[o]));
      const covG = Math.min(1, cov(pigment[o + 1]) + cov(fixed[o + 1]));
      const covB = Math.min(1, cov(pigment[o + 2]) + cov(fixed[o + 2]));
      out[fo] = paper[0] * (1 - covR);
      out[fo + 1] = paper[1] * (1 - covG);
      out[fo + 2] = paper[2] * (1 - covB);
      out[fo + 3] = 255;
      if (sheen && wetness[i] > 0.02) {
        const k = Math.min(0.10, wetness[i] * 0.07);
        out[fo] *= 1 - k;
        out[fo + 1] *= 1 - k;
        out[fo + 2] *= 1 - k;
      }
    }
    return out;
  }

  return {
    width: w,
    /** Grid height in pixels. The IF-2 paper-height FIELD is `paperHeight`. */
    height: h,
    wetness,
    paperHeight: height,
    pigment,
    fixed,
    time,
    deposit,
    dry,
    compositeInto,
    toRGBA,
    mobileMass,
    fixedMass,
    totalMass,
  };
}

export default { createWetSim, PIGMENT_CAPACITY };
