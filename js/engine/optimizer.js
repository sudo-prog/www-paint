/**
 * Clean-room optimiser core — Track R1.
 *
 * The optimiser is the first real quality step of the engine of record
 * (see `docs/CLEANROOM.md` §4, milestone R1). It replaces the modular engine's
 * "scatter random candidates, then greedily pick" pipeline with two classical,
 * independently-derived ideas from stroke-based rendering (Hertzmann 1998):
 *
 *   1. **Residual / error-driven placement** — the next stroke is anchored at
 *      the pixel that currently carries the most error, so paint goes where it
 *      is *needed*, not where a `Math.random()` happens to land.
 *   2. **Per-stroke local refinement (our own hill-climb)** — before a stroke is
 *      committed, a small coordinate-ascent search nudges its position, size,
 *      rotation and colour and keeps whichever change lowers the local error.
 *
 * Nothing here is derived from the Code Painter port: it is written from the
 * literature and works on plain pixel buffers (no canvas, no DOM), which keeps
 * it deterministic and unit-testable under plain `node`.
 *
 * A stroke is modelled as an anti-aliased filled ellipse ("brush dab") whose
 * colour is the local average of the target, with `color0 === color1` so the
 * dab renders as a flat patch in *any* renderer that supports the engine's
 * shape format (the search objective and the final render then agree).
 *
 * @module optimizer
 */

import { rng } from '../utils/rng.js';
import { clamp } from '../utils/math.js';
import { createShape, bounds } from './shapes.js';
import { sampleEdge, sampleStructure } from './analyzer.js';

/**
 * Default options for {@link optimise}.
 *
 * @type {object}
 */
export const OPTIMISER_DEFAULTS = {
  count: 400,          // stroke budget
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
 * Run the optimiser over an analysis of the target image.
 *
 * @param {object} analysis - Result of `analyzer.analyzeImage` (needs
 *   `pixels`, `width`, `height`, `edges`, `edgeX`, `edgeY` and optionally
 *   `structure`).
 * @param {object} [options] - See {@link OPTIMISER_DEFAULTS}.
 * @returns {{shapes: Array<object>, stats: object}} The chosen shapes (engine
 *   shape format, ready to render with `shapes.drawShape`) plus error stats
 *   measured on the optimiser's own paint buffer.
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

  const meanError = () => {
    let s = 0;
    for (let i = 0; i < n; i++) s += err[i];
    return s / n;
  };
  const initialError = meanError();

  // Dab radius ≈ coverage · √(W·H / count): more strokes → smaller dabs.
  const baseR = clamp(opts.coverage * Math.sqrt((W * H) / Math.max(1, opts.count)),
    opts.minSize, opts.maxSize);

  /**
   * Signed error delta produced by compositing a candidate dab, evaluated over
   * its own (padded) footprint window:
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
        const e = (Math.abs(nr - target[o3]) + Math.abs(ng - target[o3 + 1]) + Math.abs(nb - target[o3 + 2])) / 3;
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
   * Average target colour in a small disc around (x, y).
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
        sr += target[o3] * w; sg += target[o3 + 1] * w; sb += target[o3 + 2] * w; wsum += w;
      }
    }
    if (wsum <= 0) {
      const i = clamp(Math.round(y), 0, H - 1) * W + clamp(Math.round(x), 0, W - 1);
      return [target[i * 3], target[i * 3 + 1], target[i * 3 + 2]];
    }
    return [sr / wsum, sg / wsum, sb / wsum];
  }

  const shapes = [];

  for (let s = 0; s < opts.count; s++) {
    // ── 1. residual-driven placement ────────────────────────────────────────
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

    // ── 2. propose a dab at the anchor ──────────────────────────────────────
    const edgeMag = edges ? sampleEdge(edges, W, H, ax, ay) : 0;
    const detailFactor = 1 - opts.detail * clamp(edgeMag, 0, 1);
    let radius = baseR * detailFactor * random.range(0.85, 1.15);
    radius = clamp(radius, opts.minSize, opts.maxSize);

    let rot = 0, elong = 1;
    if (structure) {
      const coh = clamp(sampleStructure(structure.coherence, W, H, ax, ay), 0, 1);
      if (coh > 0.05) {
        rot = sampleStructure(structure.orientation, W, H, ax, ay);
        elong = 1 + opts.elongation * coh;
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

    // ── 3. per-stroke local hill-climb (coordinate ascent) ─────────────────
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

    // ── 4. commit ───────────────────────────────────────────────────────────
    evaluate(p, windowOf(p, 1), true);
    if (opts.onStroke) opts.onStroke(s, meanError());

    const cr = Math.round(p.r), cg = Math.round(p.g), cb = Math.round(p.b);
    shapes.push(createShape({
      id: `r1_${s}_${((s * 2654435761) >>> 0).toString(36)}`,
      type: 'E',
      params: [p.x, p.y, p.rx, p.ry, p.rot, p.rot, 0, 0],
      color0: [cr, cg, cb],
      color1: [cr, cg, cb],
      alpha: p.alpha,
      style: 'painterly',
      layer: 0,
      order: s,
      seed: s,
    }));
  }

  const finalError = meanError();
  return {
    shapes,
    stats: {
      count: shapes.length,
      initialError: +initialError.toFixed(4),
      finalError: +finalError.toFixed(4),
      mae: +finalError.toFixed(4),
      simMae: +(100 * (1 - finalError / 255)).toFixed(2),
    },
  };
}

export default { OPTIMISER_DEFAULTS, resolveOptions, optimise };
