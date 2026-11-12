/**
 * Clean-room optimiser core — Track R1 → R2.
 *
 * The optimiser is the quality engine of record (see `docs/CLEANROOM.md` §4).
 * It is built from classical, independently-derived ideas in stroke-based
 * rendering (Hertzmann 1998) and runs on plain pixel buffers (no canvas, no
 * DOM), so it stays deterministic and unit-testable under plain `node`.
 *
 * R1 — residual/error-driven placement + per-stroke local hill-climb:
 *   1. **Residual / error-driven placement** — each stroke is anchored where
 *      the running canvas carries the most error, drawn from the high-error set
 *      with a *seeded weighted sample* (not the argmax, which walks a single
 *      boundary), so paint goes where it is *needed*.
 *   2. **Per-stroke local refinement (our own hill-climb)** — before a stroke is
 *      committed, a coordinate-ascent search nudges position, size, rotation and
 *      colour, keeping whichever change lowers the local error.
 *   3. **Honest objective** — every candidate is scored by the signed error
 *      delta `D = Σ(new − current)` over its own footprint. `D` is invariant to
 *      the window extent, so a candidate can neither "win" by shrinking its
 *      evaluation window nor by dragging the dab off-image. Dab size is clamped
 *      to a small band and the centre to a small drift radius, so the search
 *      stays a *dab*, not a blanket.
 *   4. **Local colour sampling** — a dab takes its colour from a *small core* at
 *      the anchor, not its whole footprint (averaging a footprint that straddles
 *      an edge yields a muddy colour that *creates* error).
 *
 * R2 — structure-guided multi-scale (coarse → fine):
 *   5. **Multi-scale passes.** Instead of one pass of uniform dabs, the optimiser
 *      now paints in a small number of passes from COARSE to FINE. Each pass
 *      works against a progressively less-blurred copy of the target: the coarse
 *      pass lays broad, low-frequency colour fields with large dabs, and each
 *      finer pass sharpens the result with smaller dabs against a sharper
 *      reference. This is the classic coarse-to-fine SBR schedule that lets fine
 *      strokes resolve contours instead of smearing them.
 *   6. **Scale-aware structure guidance.** Stroke elongation along the structure
 *      tensor tangent is *weak* at the coarse scales (broad coverage should stay
 *      roughly round) and *strong* at the fine scales, so the final, smallest
 *      strokes are the ones that lie along edges.
 *
 * A stroke is modelled as an anti-aliased filled ellipse ("brush dab") whose
 * colour is the local average of the current scale's target, with
 * `color0 === color1` so the dab renders as a flat patch in *any* renderer that
 * supports the engine's shape format (the search objective and the final render
 * then agree).
 *
 * @module optimizer
 */

import { rng } from '../utils/rng.js';
import { clamp, lerp } from '../utils/math.js';
import { createShape, bounds } from './shapes.js';
import { sampleEdge, sampleStructure } from './analyzer.js';
import { buildRegions } from './regions.js';

/**
 * Default options for {@link optimise}.
 *
 * @type {object}
 */
export const OPTIMISER_DEFAULTS = {
  count: 400,          // total stroke budget (split across the scales)
  seed: 12345,         // master RNG seed (determinism)
  coverage: 0.8,       // dab radius ≈ coverage · sqrt(W·H / count)
  detail: 0.7,         // 0..1 — how much smaller dabs get in high-edge areas
  elongation: 1.2,     // extra radius along the structure tangent at coherence 1
  structureAlign: true,// orient + elongate dabs along the structure tensor
  alpha: 0.9,          // per-stroke opacity
  rounds: 3,           // hill-climb sweeps per stroke
  posStep: 0.6,        // position move, as a fraction of the dab radius
  sizeStep: 1.2,       // size move multiplier (and its reciprocal)
  rotStep: 0.26,       // rotation move (± ~15°)
  colorStep: 10,       // per-channel colour move
  spread: 0.6,         // how strongly already-covered pixels are deprioritised
  anchorThreshold: 0.5,// anchor sampling cutoff, as a fraction of the max score
  minSize: 2.5,
  maxSize: 96,
  minSizeFactor: 0.5,  // size clamp, as a fraction of the proposed dab
  maxSizeFactor: 2.0,  // size clamp, as a multiple of the proposed dab
  maxDrift: 1.2,       // max centre drift, as a multiple of the dab radius

  // ── R2 multi-scale ──────────────────────────────────────────────────────
  scales: 3,           // number of coarse→fine passes (1 = legacy single pass)
  coarseRadius: 1.6,   // coarsest dab radius, as a multiple of the base radius
  fineRadius: 0.64,    // finest dab radius, as a multiple of the base radius
  coarseBlur: 0.6,     // coarsest reference blur, as a fraction of the base radius
  fineElongation: 1.6, // elongation weight at the finest scale (coarse is x0.5)
  weightBias: 2.0,     // coarse→fine budget weighting: pass k gets 1/(k + bias)

  // ── R3 region init (CCL + PCA stroke initialisation) ─────────────────────
  // Only *clearly elongated* regions (≥ regionMinElong) are axis-filled: those
  // are the ones where one oriented, region-sized stroke beats several residual
  // dabs. Compact/isotropic and ring-like components are left to the residual
  // schedule, which handles them better — measurement showed patch-filling them
  // costs fidelity, so there is no patch path. Defaults tuned on the parity
  // bench (see docs/checkpoints/R3.md).
  regionInit: true,      // seed strokes from connected-component principal axes
  regionLevels: 6,       // colour-codebook bins per channel for the CCL pass
  regionMinArea: 10,     // min component area (pixels) to consider
  regionMaxAreaFrac: 0.30,// max component area, as a fraction of the image
  regionMinElong: 2.5,   // elongation at/above which a region is "elongated"
  regionShare: 0.08,     // fraction of the stroke budget for the init pass
  regionMaxSegments: 3,  // max segments one elongated region may spend
  regionMargin: 1.3,     // dab inflation over the fitted region extent
  regionAlpha: 1.0,      // opacity of an init (fill) stroke

  // ── R4 region fill (feature parity: block in the big flat areas first) ────
  // Opt-in — default 0 → output is byte-identical to R3. When > 0, a fraction
  // of the stroke budget lays ONE broad flat ellipse per connected component
  // (largest first) at the component's mean colour, before the R3 init and the
  // coarse→fine schedule refine it: the classical "wash in the large flat
  // values before detail" step, re-derived (see docs/checkpoints/R4.md).
  regionFill: 0,           // fraction of the stroke budget for the region-fill pass
  regionFillMinArea: 24,   // min component area (pixels) to block in
  regionFillMaxAreaFrac: 0.30, // max component area, as a fraction of the image
  regionFillMargin: 1.05,  // dab inflation over the fitted region extent
  regionFillAlpha: 1.0,    // opacity of a fill stroke
};

/**
 * Merge user options over the defaults.
 * @param {object} [o]
 * @returns {object}
 */
export function resolveOptions(o = {}) {
  return { ...OPTIMISER_DEFAULTS, ...o };
}

/**
 * Anti-aliased coverage of a point by an ellipse.
 *
 * The signed coverage falls off over ~1 device pixel at the ellipse boundary,
 * so the implicit dab rasteriser behaves like an anti-aliased fill.
 *
 * @param {number} dx - Point X minus ellipse centre X.
 * @param {number} dy - Point Y minus ellipse centre Y.
 * @param {number} rx - Ellipse radius along its local X axis.
 * @param {number} ry - Ellipse radius along its local Y axis.
 * @param {number} cos - cos(rotation).
 * @param {number} sin - sin(rotation).
 * @returns {number} Coverage in [0, 1].
 */
function ellipseCoverage(dx, dy, rx, ry, cos, sin) {
  const u = dx * cos + dy * sin;
  const v = -dx * sin + dy * cos;
  const r = Math.sqrt((u * u) / (rx * rx) + (v * v) / (ry * ry));
  const soft = 1 / Math.max(0.5, Math.min(rx, ry));
  return clamp(0.5 + (1 - r) * soft, 0, 1);
}

/**
 * Separable box blur over a channel-interleaved RGB float buffer (clamped
 * edges). A cheap, deterministic stand-in for the Gaussian pyramid used in the
 * classical coarse-to-fine SBR schedule; the aim is a *region average* the
 * coarse strokes can lay down, not a photometric filter.
 *
 * @param {Float32Array} src - RGB buffer, length w·h·3.
 * @param {number} w
 * @param {number} h
 * @param {number} radius - Half-window size in pixels (>= 1 blurs; < 1 copies).
 * @returns {Float32Array}
 */
function blurRGB(src, w, h, radius) {
  const r = Math.max(0, Math.round(radius));
  if (r < 1) return src.slice();
  const n = w * h;
  const tmp = new Float32Array(n * 3);
  const out = new Float32Array(n * 3);
  const win = r * 2 + 1;
  // Horizontal pass
  for (let y = 0; y < h; y++) {
    const row = y * w;
    const acc = [0, 0, 0];
    for (let k = -r; k <= r; k++) {
      const o = (row + Math.max(0, Math.min(w - 1, k))) * 3;
      acc[0] += src[o]; acc[1] += src[o + 1]; acc[2] += src[o + 2];
    }
    for (let x = 0; x < w; x++) {
      const o = (row + x) * 3;
      tmp[o] = acc[0] / win; tmp[o + 1] = acc[1] / win; tmp[o + 2] = acc[2] / win;
      const addO = (row + Math.min(w - 1, x + r + 1)) * 3;
      const subO = (row + Math.max(0, x - r)) * 3;
      acc[0] += src[addO] - src[subO];
      acc[1] += src[addO + 1] - src[subO + 1];
      acc[2] += src[addO + 2] - src[subO + 2];
    }
  }
  // Vertical pass
  for (let x = 0; x < w; x++) {
    const acc = [0, 0, 0];
    for (let k = -r; k <= r; k++) {
      const o = (Math.max(0, Math.min(h - 1, k)) * w + x) * 3;
      acc[0] += tmp[o]; acc[1] += tmp[o + 1]; acc[2] += tmp[o + 2];
    }
    for (let y = 0; y < h; y++) {
      const o = (y * w + x) * 3;
      out[o] = acc[0] / win; out[o + 1] = acc[1] / win; out[o + 2] = acc[2] / win;
      const addO = (Math.min(h - 1, y + r + 1) * w + x) * 3;
      const subO = (Math.max(0, y - r) * w + x) * 3;
      acc[0] += tmp[addO] - tmp[subO];
      acc[1] += tmp[addO + 1] - tmp[subO + 1];
      acc[2] += tmp[addO + 2] - tmp[subO + 2];
    }
  }
  return out;
}

/**
 * Build the coarse→fine pass schedule for the multi-scale painter.
 *
 * Returns one entry per pass, ordered COARSE first. Each entry carries the dab
 * radius multiplier, the reference-blur radius (in pixels), the elongation
 * weight and the pass's share of the stroke budget. Radii, blur and elongation
 * interpolate linearly from coarse to fine; the budget weights decrease
 * geometrically so the coarse pass gets the largest share.
 *
 * @param {object} opts - Resolved options.
 * @param {number} baseR - Base dab radius (≈ coverage·√(W·H/count)).
 * @returns {Array<{radiusMul: number, blurR: number, elongMul: number, weight: number}>}
 */
export function buildScalePlan(opts, baseR) {
  const n = Math.max(1, opts.scales | 0);
  if (n === 1) {
    return [{ radiusMul: 1, blurR: 0, elongMul: 1, weight: 1 }];
  }
  const plan = [];
  let wsum = 0;
  for (let k = 0; k < n; k++) {
    const t = k / (n - 1); // 0 coarse → 1 fine
    const weight = 1 / (k + Math.max(0.1, opts.weightBias)); // decreasing share, coarse-first
    plan.push({
      radiusMul: lerp(opts.coarseRadius, opts.fineRadius, t),
      blurR: baseR * lerp(opts.coarseBlur, 0, t),
      elongMul: lerp(0.5, 1, t),
      weight,
    });
    wsum += weight;
  }
  for (const p of plan) p.weight /= wsum;
  return plan;
}

/**
 * Run the optimiser over an analysis of the target image.
 *
 * @param {object} analysis - Result of `analyzer.analyzeImage` (needs
 *   `pixels`, `width`, `height`, `edges`, `edgeX`, `edgeY` and optionally
 *   `structure`).
 * @param {object} [options] - See {@link OPTIMISER_DEFAULTS}.
 * @returns {{shapes: Array<object>, stats: object}} The chosen shapes (engine
 *   shape format, ready to render with `shapes.drawShape`) plus error stats
 *   measured on the optimiser's own paint buffer against the ORIGINAL target.
 */
export function optimise(analysis, options = {}) {
  const opts = resolveOptions(options);
  const { width: W, height: H, pixels, edges, edgeX, edgeY } = analysis;
  const structure = opts.structureAlign ? analysis.structure : null;
  const n = W * H;
  const random = rng(opts.seed | 0);

  // ── state buffers (channel-interleaved RGB, float) ───────────────────────
  const target = new Float32Array(n * 3);
  let br = 0, bg = 0, bb = 0;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    target[i * 3] = pixels[o];
    target[i * 3 + 1] = pixels[o + 1];
    target[i * 3 + 2] = pixels[o + 2];
    br += pixels[o]; bg += pixels[o + 1]; bb += pixels[o + 2];
  }
  // The canvas starts as the flat average colour (the harness clears with it).
  const background = [br / n, bg / n, bb / n];

  const paint = new Float32Array(n * 3);
  const err = new Float32Array(n);   // current per-pixel error (mean |ΔRGB|)
  const cov = new Float32Array(n);   // accumulated coverage [0, 1]
  for (let i = 0; i < n; i++) {
    paint[i * 3] = background[0];
    paint[i * 3 + 1] = background[1];
    paint[i * 3 + 2] = background[2];
    err[i] = (
      Math.abs(background[0] - target[i * 3]) +
      Math.abs(background[1] - target[i * 3 + 1]) +
      Math.abs(background[2] - target[i * 3 + 2])
    ) / 3;
  }

  /** Mean per-pixel error of the running paint buffer vs a reference buffer. */
  const meanErrorVs = (ref) => {
    let s = 0;
    for (let i = 0; i < n; i++) {
      s += (Math.abs(paint[i * 3] - ref[i * 3]) +
        Math.abs(paint[i * 3 + 1] - ref[i * 3 + 1]) +
        Math.abs(paint[i * 3 + 2] - ref[i * 3 + 2])) / 3;
    }
    return s / n;
  };
  const initialError = meanErrorVs(target);

  // Dab radius ≈ coverage · √(W·H / count): more strokes → smaller dabs.
  const baseR = clamp(opts.coverage * Math.sqrt((W * H) / Math.max(1, opts.count)),
    opts.minSize, opts.maxSize);

  // The reference buffer and elongation weight for the pass currently running.
  // The closures below read these, so the same per-stroke body can serve every
  // scale of the coarse→fine schedule.
  let levelTarget = target;
  let elongMul = 1;

  /**
   * Signed error delta produced by compositing a candidate dab, evaluated over
   * its own (padded) footprint window against the current scale's reference:
   *
   *     D = Σ_win (newErr − curErr)
   *
   * Pixels the dab does not touch contribute exactly 0, so D is invariant to
   * the window extent — a candidate can neither "win" by shrinking its window
   * nor by dragging the dab off-image. Because the total image error changes by
   * exactly D, a smaller D is always a genuine improvement. When `write` is
   * true the composite is committed into `paint`/`err`/`cov`.
   *
   * @returns {number} Signed error delta (negative = improvement).
   */
  function evaluate(p, win, write) {
    const cos = Math.cos(p.rot), sin = Math.sin(p.rot);
    const rx = p.rx, ry = p.ry, alpha = p.alpha;
    const mR = Math.max(0.5, Math.min(rx, ry));
    let d = 0;
    for (let py = win.y0; py <= win.y1; py++) {
      const dyBase = py + 0.5 - p.y;
      const rowBase = py * W;
      for (let px = win.x0; px <= win.x1; px++) {
        const i = rowBase + px;
        const dx = px + 0.5 - p.x;
        const u = dx * cos + dyBase * sin;
        const v = -dx * sin + dyBase * cos;
        const rr = Math.sqrt((u * u) / (rx * rx) + (v * v) / (ry * ry));
        const a = clamp(0.5 + (1 - rr) * mR, 0, 1) * alpha;
        if (a <= 0.0005) continue; // untouched → delta 0
        const o3 = i * 3;
        const nr = paint[o3] * (1 - a) + p.r * a;
        const ng = paint[o3 + 1] * (1 - a) + p.g * a;
        const nb = paint[o3 + 2] * (1 - a) + p.b * a;
        const e = (Math.abs(nr - levelTarget[o3]) + Math.abs(ng - levelTarget[o3 + 1]) + Math.abs(nb - levelTarget[o3 + 2])) / 3;
        d += e - err[i];
        if (write) {
          paint[o3] = nr; paint[o3 + 1] = ng; paint[o3 + 2] = nb;
          err[i] = e;
          cov[i] = cov[i] + a * (1 - cov[i]);
        }
      }
    }
    return d;
  }

  /** Bounding window [x0,y0,x1,y1] of a dab, padded and clamped to the image. */
  function windowOf(p, pad) {
    const R = Math.max(p.rx, p.ry) + pad;
    return {
      x0: Math.max(0, Math.floor(p.x - R)),
      y0: Math.max(0, Math.floor(p.y - R)),
      x1: Math.min(W - 1, Math.ceil(p.x + R)),
      y1: Math.min(H - 1, Math.ceil(p.y + R)),
    };
  }

  /**
   * Average colour in a small disc around (x, y) of the CURRENT scale's
   * reference.
   *
   * The dab's colour is sampled from a *small core* at the anchor rather than
   * its whole (possibly edge-straddling) footprint: averaging the full
   * footprint blends two regions into a muddy colour that then *creates* error
   * instead of removing it. A small local sample gives the dab the colour of
   * the place it actually marks.
   */
  function localColor(x, y, r) {
    const x0 = Math.max(0, Math.floor(x - r)), x1 = Math.min(W - 1, Math.ceil(x + r));
    const y0 = Math.max(0, Math.floor(y - r)), y1 = Math.min(H - 1, Math.ceil(y + r));
    const r2 = r * r;
    let sr = 0, sg = 0, sb = 0, wsum = 0;
    for (let py = y0; py <= y1; py++) {
      for (let px = x0; px <= x1; px++) {
        const dx = px + 0.5 - x, dy = py + 0.5 - y;
        const d2 = dx * dx + dy * dy;
        if (d2 > r2) continue;
        const o3 = (py * W + px) * 3;
        const w = 1 - 0.4 * Math.sqrt(d2) / (r + 1e-6);
        sr += levelTarget[o3] * w; sg += levelTarget[o3 + 1] * w; sb += levelTarget[o3 + 2] * w; wsum += w;
      }
    }
    if (wsum <= 0) {
      const i = clamp(Math.round(y), 0, H - 1) * W + clamp(Math.round(x), 0, W - 1);
      return [levelTarget[i * 3], levelTarget[i * 3 + 1], levelTarget[i * 3 + 2]];
    }
    return [sr / wsum, sg / wsum, sb / wsum];
  }

  const shapes = [];
  let strokeIndex = 0;

  /**
   * Composite a chosen dab into `paint`/`err`/`cov` and emit its shape. Shared
   * by the region-init pass (R3) — the coarse→fine passes push inline so their
   * original ordering/ids are untouched.
   */
  function commitShape(p) {
    evaluate(p, windowOf(p, 1), true);
    if (opts.onStroke) opts.onStroke(strokeIndex, meanErrorVs(target));
    const cr = Math.round(clamp(p.r, 0, 255));
    const cg = Math.round(clamp(p.g, 0, 255));
    const cb = Math.round(clamp(p.b, 0, 255));
    shapes.push(createShape({
      id: `r3_${strokeIndex}_${((strokeIndex * 2654435761) >>> 0).toString(36)}`,
      type: 'E',
      params: [p.x, p.y, p.rx, p.ry, p.rot, p.rot, 0, 0],
      color0: [cr, cg, cb],
      color1: [cr, cg, cb],
      alpha: p.alpha,
      style: 'painterly',
      layer: 0,
      order: strokeIndex,
      seed: strokeIndex,
    }));
    strokeIndex++;
  }

  /**
   * R3 region-init pass — CCL + PCA stroke initialisation.
   *
   * Segment the target into connected components (by a coarse colour codebook),
   * fit each component's principal axis, and seed strokes from the geometry of
   * the region it belongs to. Only **clearly elongated** components (elongation
   * ≥ `regionMinElong`) are seeded, each as a short chain of ellipse dabs laid
   * along its principal axis and sized to the region's cross-section — the case
   * where one oriented stroke does the work of several residual dabs.
   * Compact/isotropic and ring-like components are skipped: the residual
   * schedule fits them better (measured — a patch-fill path cost fidelity, so
   * there is none), and skipping keeps the pass from blanketing the canvas
   * (the R0 failure mode).
   *
   * Every dab takes the component's *mean* colour, so a flat region is
   * initialised with one near-exact mark. Regions are visited largest-first and
   * `budget` caps the spend, so a small share of the total is used. No
   * randomness is used, so the pass is deterministic.
   *
   * @param {number} budget - Max strokes this pass may emit.
   * @returns {number} Strokes actually emitted.
   */
  function regionInitPass(budget) {
    if (budget <= 0) return 0;
    levelTarget = target; // component means are local averages of the raw target
    elongMul = 1;
    const regions = buildRegions(analysis, {
      levels: opts.regionLevels,
      minArea: opts.regionMinArea,
      maxAreaFrac: opts.regionMaxAreaFrac,
    });
    let emitted = 0;
    for (let ri = 0; ri < regions.length && emitted < budget; ri++) {
      const rg = regions[ri];
      if (rg.elong < opts.regionMinElong) continue; // only clearly elongated regions
      const r = clamp(rg.color[0], 0, 255);
      const g = clamp(rg.color[1], 0, 255);
      const b = clamp(rg.color[2], 0, 255);
      const halfMajor = 0.5 * Math.sqrt(12 * rg.l1);
      const halfMinor = 0.5 * Math.sqrt(12 * rg.l2);
      const segs = clamp(Math.round(halfMajor / Math.max(1, halfMinor)), 1, opts.regionMaxSegments);
      const segHalf = clamp(halfMajor / segs, opts.minSize / 2, opts.maxSize);
      const ry = clamp(halfMinor * opts.regionMargin, opts.minSize / 2, opts.maxSize);
      const ca = Math.cos(rg.angle);
      const sa = Math.sin(rg.angle);
      for (let k = 0; k < segs && emitted < budget; k++) {
        const t = segs === 1 ? 0 : (k / (segs - 1)) * 2 - 1; // -1 … +1 along the axis
        const off = t * Math.max(0, halfMajor - segHalf);
        commitShape({
          x: rg.cx + ca * off,
          y: rg.cy + sa * off,
          rx: clamp(segHalf * opts.regionMargin, opts.minSize / 2, opts.maxSize),
          ry,
          rot: rg.angle,
          r, g, b, alpha: opts.regionAlpha,
        });
        emitted++;
      }
    }
    return emitted;
  }

  /**
   * R4 region-fill pass — block in the big flat areas first.
   *
   * Feature parity with the legacy painter's region fill, re-derived:
   * segment the target into connected components (the same CCL + PCA as the R3
   * init), then lay ONE broad flat ellipse per component — sized and oriented
   * to the component's principal axis and coloured with its mean — largest
   * areas first. The classical "wash in the large flat values before detail"
   * step; the R3 init and the coarse→fine schedule refine on top of it.
   *
   * Opt-in (`regionFill > 0`, default 0) so the R3 result is untouched otherwise.
   * Deterministic — no RNG.
   *
   * @param {number} budget - Max strokes this pass may emit.
   * @returns {number} Strokes actually emitted.
   */
  function regionFillPass(budget) {
    if (budget <= 0) return 0;
    levelTarget = target;
    elongMul = 1;
    const regions = buildRegions(analysis, {
      levels: opts.regionLevels,
      minArea: opts.regionFillMinArea,
      maxAreaFrac: opts.regionFillMaxAreaFrac,
    });
    let emitted = 0;
    for (let ri = 0; ri < regions.length && emitted < budget; ri++) {
      const rg = regions[ri];
      if (rg.area < opts.regionFillMinArea) continue;
      const halfMajor = 0.5 * Math.sqrt(12 * rg.l1);
      const halfMinor = 0.5 * Math.sqrt(12 * rg.l2);
      commitShape({
        x: rg.cx,
        y: rg.cy,
        rx: clamp(halfMajor * opts.regionFillMargin, opts.minSize / 2, opts.maxSize),
        ry: clamp(halfMinor * opts.regionFillMargin, opts.minSize / 2, opts.maxSize),
        rot: rg.angle,
        r: clamp(rg.color[0], 0, 255),
        g: clamp(rg.color[1], 0, 255),
        b: clamp(rg.color[2], 0, 255),
        alpha: opts.regionFillAlpha,
      });
      emitted++;
    }
    return emitted;
  }

  /**
   * Paint one coarse→fine pass: place up to `budget` dabs of radius
   * `baseR·radiusMul` against `levelTarget`, refining each with the local
   * hill-climb, committing into the shared `paint` buffer.
   *
   * @returns {number} Number of strokes actually emitted (can be < budget when
   *   the pass runs out of error to remove).
   */
  function paintPass(passTarget, radiusBase, elongScale, budget) {
    levelTarget = passTarget;
    elongMul = elongScale;
    let emitted = 0;

    for (let s = 0; s < budget; s++) {
      // ── 1. residual-driven placement ──────────────────────────────────────
      // Score every pixel by its residual error, damped by how much paint it has
      // already received, then draw the anchor from the high-residual set with a
      // seeded weighted sample. Sampling (rather than always taking the argmax)
      // spreads strokes across the whole error region instead of walking a single
      // boundary — the deterministic RNG keeps it reproducible.
      let best = -1, maxScore = 0;
      for (let i = 0; i < n; i++) {
        const score = err[i] * (1 - opts.spread * clamp(cov[i], 0, 1));
        if (score > maxScore) { maxScore = score; best = i; }
      }
      if (best < 0 || maxScore <= 1e-4) break;
      const thr = opts.anchorThreshold * maxScore;
      for (let attempt = 0; attempt < 24; attempt++) {
        const i = Math.floor(random.next() * n);
        if (err[i] * (1 - opts.spread * clamp(cov[i], 0, 1)) >= thr) { best = i; break; }
      }
      const ax = (best % W) + 0.5;
      const ay = Math.floor(best / W) + 0.5;

      // ── 2. propose a dab at the anchor ────────────────────────────────────
      const edgeMag = edges ? sampleEdge(edges, W, H, ax, ay) : 0;
      const detailFactor = 1 - opts.detail * clamp(edgeMag, 0, 1);
      let radius = radiusBase * detailFactor * random.range(0.85, 1.15);
      radius = clamp(radius, opts.minSize, opts.maxSize);

      let rot = 0, elong = 1;
      if (structure) {
        const coh = clamp(sampleStructure(structure.coherence, W, H, ax, ay), 0, 1);
        if (coh > 0.05) {
          rot = sampleStructure(structure.orientation, W, H, ax, ay);
          // Scale-aware: broad coarse dabs stay round, fine dabs hug edges.
          elong = 1 + opts.elongation * elongMul * coh;
        }
      } else if (edgeX && edgeY) {
        const gx = sampleEdge(edgeX, W, H, ax, ay);
        const gy = sampleEdge(edgeY, W, H, ax, ay);
        if (gx !== 0 || gy !== 0) rot = Math.atan2(gy, gx) + Math.PI / 2;
      }

      let p = {
        x: ax, y: ay, rx: radius * elong, ry: radius, rot,
        r: 0, g: 0, b: 0, alpha: opts.alpha,
      };
      const col = localColor(ax, ay, clamp(0.45 * Math.min(p.rx, p.ry), 1.2, 3.5));
      p.r = col[0]; p.g = col[1]; p.b = col[2];

      // ── 3. per-stroke local hill-climb (coordinate ascent) ────────────────
      // The dab stays a *dab*: size is clamped to a small band around the
      // proposal and the centre may only drift a little, so the search cannot
      // degenerate into one giant colour-averaged sweep (the R0 failure mode).
      const rx0 = p.rx, ry0 = p.ry;
      const maxR = Math.max(rx0, ry0);
      const stepPos = opts.posStep * maxR;
      const clampSize = (c) => {
        c.rx = clamp(c.rx, rx0 * opts.minSizeFactor, rx0 * opts.maxSizeFactor);
        c.ry = clamp(c.ry, ry0 * opts.minSizeFactor, ry0 * opts.maxSizeFactor);
        c.x = clamp(c.x, Math.max(0, ax - opts.maxDrift * maxR), Math.min(W - 1, ax + opts.maxDrift * maxR));
        c.y = clamp(c.y, Math.max(0, ay - opts.maxDrift * maxR), Math.min(H - 1, ay + opts.maxDrift * maxR));
        c.r = clamp(c.r, 0, 255); c.g = clamp(c.g, 0, 255); c.b = clamp(c.b, 0, 255);
        return c;
      };
      let bestD = evaluate(p, windowOf(p, 1), false);

      for (let round = 0; round < opts.rounds; round++) {
        const moves = [
          { x: p.x + stepPos }, { x: p.x - stepPos },
          { y: p.y + stepPos }, { y: p.y - stepPos },
          { rx: p.rx * opts.sizeStep, ry: p.ry * opts.sizeStep },
          { rx: p.rx / opts.sizeStep, ry: p.ry / opts.sizeStep },
          { rot: p.rot + opts.rotStep }, { rot: p.rot - opts.rotStep },
          { r: p.r + opts.colorStep }, { r: p.r - opts.colorStep },
          { g: p.g + opts.colorStep }, { g: p.g - opts.colorStep },
          { b: p.b + opts.colorStep }, { b: p.b - opts.colorStep },
        ];
        for (const mv of moves) {
          const cand = clampSize({ ...p, ...mv });
          const d = evaluate(cand, windowOf(cand, 1), false);
          if (d < bestD - 1e-6) { p = cand; bestD = d; }
        }
      }

      // ── 4. commit ─────────────────────────────────────────────────────────
      evaluate(p, windowOf(p, 1), true);
      if (opts.onStroke) opts.onStroke(strokeIndex, meanErrorVs(target));

      const cr = Math.round(p.r), cg = Math.round(p.g), cb = Math.round(p.b);
      shapes.push(createShape({
        id: `r2_${strokeIndex}_${((strokeIndex * 2654435761) >>> 0).toString(36)}`,
        type: 'E',
        params: [p.x, p.y, p.rx, p.ry, p.rot, p.rot, 0, 0],
        color0: [cr, cg, cb],
        color1: [cr, cg, cb],
        alpha: p.alpha,
        style: 'painterly',
        layer: 0,
        order: strokeIndex,
        seed: strokeIndex,
      }));
      strokeIndex++;
      emitted++;
    }
    return emitted;
  }

  // ── R4 region fill — block in the big flat areas first (opt-in) ───────────
  const fillBudget = opts.regionFill > 0
    ? Math.round(opts.count * clamp(opts.regionFill, 0, 1))
    : 0;
  const fillUsed = regionFillPass(fillBudget);

  // ── R3 region init (CCL + PCA) ────────────────────────────────────────────
  // Seed strokes from connected-component principal axes *before* the residual
  // schedule, so elongated / flat regions start nearly right and the coarse→fine
  // passes spend their budget on what the init did not already cover.
  const regionBudget = opts.regionInit
    ? Math.round(opts.count * clamp(opts.regionShare, 0, 1))
    : 0;
  const regionUsed = regionInitPass(regionBudget);

  // ── coarse → fine schedule ────────────────────────────────────────────────
  const plan = buildScalePlan(opts, baseR);
  let remaining = opts.count - fillUsed - regionUsed;
  // The schedule's own total (what the init left) drives the budget split, so
  // the pass weights still describe the schedule and the sum stays exact.
  const scheduleTotal = Math.max(1, remaining);

  for (let k = 0; k < plan.length; k++) {
    if (remaining <= 0) break;
    const level = plan[k];
    const isLast = k === plan.length - 1;
    // This pass's share of the budget; the last pass takes whatever is left so
    // the total is exact. Any budget a coarse pass leaves unspent (because it
    // ran out of error) carries forward to the next, finer pass.
    let budget = isLast ? remaining : Math.min(remaining, Math.round(scheduleTotal * level.weight));
    const passTarget = level.blurR >= 1 ? blurRGB(target, W, H, level.blurR) : target;
    // Reset the residual map to measure the running canvas against this scale's
    // (progressively sharper) reference.
    for (let i = 0; i < n; i++) {
      err[i] = (
        Math.abs(paint[i * 3] - passTarget[i * 3]) +
        Math.abs(paint[i * 3 + 1] - passTarget[i * 3 + 1]) +
        Math.abs(paint[i * 3 + 2] - passTarget[i * 3 + 2])
      ) / 3;
    }
    const used = paintPass(passTarget, baseR * level.radiusMul, level.elongMul, budget);
    remaining -= used;
  }

  const finalError = meanErrorVs(target);
  return {
    shapes,
    stats: {
      count: shapes.length,
      scales: plan.length,
      fill: fillUsed,
      regions: regionUsed,
      initialError: +initialError.toFixed(4),
      finalError: +finalError.toFixed(4),
      mae: +finalError.toFixed(4),
      simMae: +(100 * (1 - finalError / 255)).toFixed(2),
    },
  };
}

export default { OPTIMISER_DEFAULTS, resolveOptions, buildScalePlan, optimise };
