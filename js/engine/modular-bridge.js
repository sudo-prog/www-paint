/**
 * Track R — modular-engine bridge for the app path (Mac half, R5/R6).
 *
 * Track R made the **modular engine** (`analyzer.js` + `optimizer.js` +
 * `regions.js` + `scorer.js`) the engine of record (see `docs/CLEANROOM.md`),
 * and R1–R5 landed its primitives + Style Profiles + wet media. What is still
 * missing is the **app path**: `js/engine/engine.js#generate()` runs the
 * legacy `painter.js`, so none of R1–R5's work is reachable from the UI until
 * the app can generate with the modular engine.
 *
 * This module is the **adapter** that makes that switch possible without any
 * edit to a ThinkPad-owned file. `js/engine/engine.js` is BE-owned
 * (`HANDOFF.md` §6), so the seam is designed to be a **zero-diff wiring point**:
 *
 * ```js
 * // in engine.js#generate(), alongside the existing `new Painter(...)` call:
 * const plan = buildModularPlan(this._analysis, {
 *   style, count, seed, layerStyles, width: this.width, height: this.height,
 * });
 * if (plan.shapes.length) { /* assign layers + return, exactly as the Painter path does *\/ }
 * ```
 *
 * With `opts` absent (the shipped default) `buildModularPlan` returns
 * `{ used: false, shapes: [] }` — a caller can therefore add the two lines
 * above and the app stays **byte-identical** until an opt-in flips it.
 *
 * ## What it does
 *
 * 1. runs the modular optimiser (`optimizer.optimise`) over the analysis;
 * 2. converts the optimiser's raw shape records into the SAME engine-format
 *    shape `_convertShape` produces (`{id, type, params, color0, color1,
 *    alpha, style, layer, order, seed, flat}`) — so the Renderer, the layer
 *    panel, the motion playback and the exporter all consume it unchanged;
 * 3. applies the R4 seam (`r4.buildR4Plan`) for **per-style shaping** — the
 *    R4 item the app can reach without a spine edit;
 * 4. applies Phase 2.2 **per-layer styles** (`layer-styles.applyLayerStyles`).
 *
 * ## Honest scope
 *
 * - It is a **planner**: it returns shapes. It does not paint, and it does not
 *   touch a canvas. `engine.js` decides what to do with the shapes.
 * - It does **not** claim parity with `painter.js`. The parity gate is
 *   `scripts/parity-bench.cjs` (BE-owned) and is a separate decision.
 * - `optimise` is called with `useWorker`-independent, pure options; no DOM.
 *
 * @module modular-bridge
 */

import { optimise, resolveOptions } from './optimizer.js';
import { clamp } from '../utils/math.js';
import { applyLayerStyles } from './layer-styles.js';
import { computeTonalMasks } from './masks.js';
import { buildR4Plan, resolveEffectiveShaping } from './r4.js';
import { aliasStyle } from './style-alias.js';

/**
 * Default bridge options.
 *
 * `enabled` is the opt-in switch. Everything else mirrors the optimiser's own
 * defaults so an explicit call and a default call agree.
 */
export const BRIDGE_DEFAULTS = {
  enabled: false,
  /** Fraction of the stroke budget the outline lay-in may consume. */
  outlineBudgetFrac: 0.35,
  /** Cap on a single outline lay-in (safety, mirrors `painter.js`'s own cap). */
  outlineMax: 64,
  /** Deterministic seed. */
  seed: 12345,
  /**
   * How much a dab is ELONGATED into a stroke (the SBR "stroke length" idea).
   *
   * The optimiser's dab is a near-circular point-mark (measured on the frog
   * fixture: mean stroke length 39.8px at mean width 22.1px → aspect 1.8, so
   * the marks read as DOTS). A real brush mark is elongated along the local
   * structure direction.
   *
   * MEASURED (`scripts/elongation-sweep.cjs`, frog fixture, fidelity score =
   * `|inkErr|·0.6 + |lumErr|·0.4` vs the source):
   *
   * | elong | widthScale | count | inkErr | lumErr | colours | score |
   * |-------|------------|-------|--------|--------|---------|-------|
   * | 1.0   | 0.55       | 1400  | +2.46  | -0.32  | 314     | **1.60** |
   * | 1.0   | 0.45       | 700   | +2.64  | +0.73  | 263     | 1.88    |
   * | 1.5   | 0.35       | 1400  | +2.79  | +3.62  | 341     | 3.12    |
   * | 2.0   | 0.35       | 1400  | +7.80  | -4.99  | 370     | 6.68    |
   * | 3.0   | 0.55       | 700   | +33.20 | -48.65 | 312     | 44.08   |
   *
   * So **1.0 wins**: the dab's own aspect is already right, and the win comes
   * from THINNING the stroke (widthScale) rather than from stretching it.
   * Long strokes over-cover the canvas (inkErr +33 at 3.0) and flood it.
   */
  strokeElongation: 1.0,
  /**
   * How strongly a stroke follows the local structure tangent (0..1).
   *
   * 0 = use the dab's own rotation only. 1 = fully snap to the structure
   * tangent wherever the coherence is high. The dab's rotation already
   * carries some structure information (the optimiser elongates along the
   * tensor), so this only sharpens it.
   *
   * MEASURED: 0 is best. The dab's rotation IS the structure-guided angle —
   * the optimiser elongates its dab along the tensor and records that angle in
   * `params[4]`. Snapping on top of it double-counts the guidance and drifts
   * the marks off the residual they were placed for:
   *
   * | align | inkPct | inkErr | lumErr | colours |
   * |-------|--------|--------|--------|---------|
   * | 0.0   | 56.95  | +11.05 | -18.29 | 248     |
   * | 0.6   | 57.13  | +11.23 | -19.51 | 239     |
   * | 1.0   | 57.65  | +11.75 | -20.04 | 229     |
   *
   * Kept as an option (not deleted) so a future style that wants explicit
   * re-alignment can turn it on, and so the measurement is reproducible.
   */
  strokeStructureAlign: 0.0,
  /**
   * Scale on the stroke's WIDTH (the dab's cross-section).
   *
   * The optimiser's dab radius is chosen so the dabs *cover* the canvas
   * (coverage-based sizing: `r ≈ √(W·H/count)`). That is right for a
   * patch-fill, wrong for a brush stroke — the stroke then paints the same
   * area but as a fat blob. A thinner stroke at the same count leaves gaps,
   * so the count has to rise with it; that trade is measured by
   * `scripts/elongation-sweep.cjs`.
   *
   * MEASURED: 0.55 with a doubled count is the best combination (inkErr
   * +2.46, lumErr -0.32, 314 colour buckets — within a whisker of the legacy
   * Painter path's +1.17 / -0.08 / 400).
   */
  strokeWidthScale: 0.55,
  /**
   * Multiplier on the stroke BUDGET when dabs are converted to strokes.
   *
   * A dab covers one area; a stroke covers the same area only if it is as
   * wide as the dab. Thinner strokes cover less, so more of them are needed
   * for the same coverage. Without this the converted painting has holes.
   *
   * MEASURED (frog fixture, full current pipeline — quantise + gradient +
   * alpha 0.8): the rendered quality climbs with the budget and peaks at
   * 8× — bs2/bs4 leave waxy unresolved blobs (ink 43.3/39.8, mud at 2×),
   * bs8 resolves the frog cleanly (ink 38.5, cols 205; at paletteSize 24:
   * ink 41.0, cols 285). The user-facing `count` stays the contract; this
   * is the internal coverage multiplier.
   */
  strokeBudgetScale: 8.0,
  /**
   * Chain adjacent same-colour dabs into flowing multi-dab strokes (see
   * `chainDabs`).
   *
   * MEASURED — REJECTED as a default (frog fixture, real app path): chaining
   * collapses N dabs into one thin Bézier, and the style renderers draw a
   * stroke with grain/skip, so the merged ink under-covers. At tol 60 the
   * plan shrank 1464 dabs → 105 shapes (inkPct 27.9 vs source 45.9 — a
   * sparse web of threads); tol 45 + maxGap 1.6d still gave 140 shapes /
   * inkPct 41.2 / widP50 3.8px hairlines. The single-dab conversion at a
   * higher budget wins on every metric (inkErr +2.46 vs −4.7, colours 314
   * vs 273) AND on the eye test. Kept as an opt-in so the measurement stays
   * reproducible; the natural use is a style that wants thin filaments
   * (thread, string, stitch) rather than coverage.
   */
  chainDabs: false,
  /** Max RGB distance for two dabs to chain (0..441). */
  chainColourTol: 45,
  /**
   * Snap every dab's colour to a small palette of the source (see
   * `buildPalette`).
   *
   * MEASURED — the mottled-fill fix. Each dab samples the source at its own
   * centre, so flat regions render as speckle (JPEG noise + AA). Quantising
   * to k=12 collapses the speckle while keeping the image's real colour
   * structure. See the sweep numbers in docs/checkpoints/R6.md.
   */
  quantiseColours: true,
  /**
   * Palette size for `quantiseColours` (2..32).
   *
   * MEASURED (frog fixture, budget 8×): 12 buckets LOSE the small high-value
   * regions — the frog's blue eye and orange spot vanish into the green/
   * cream buckets (cols 205). 24 keeps them as distinct buckets (cols 285,
   * eye + spot render correctly); 32 adds speckle back (cols 300) with no
   * visible gain. 24 is the measured knee.
   */
  paletteSize: 24,
  /**
   * Uniform stroke alpha — the Code Paint teacher value.
   *
   * MEASURED from Code Paint's stroke console (996/996 strokes, frog
   * fixture): every stroke paints at alpha 0.8. Overlaps then read as soft
   * washes instead of hard seams. `null` = keep the optimiser's own alpha.
   */
  strokeAlpha: 0.8,
};

/**
 * Does an engine-format shape carry a finite position?
 * @param {object} s
 * @returns {boolean}
 */
function hasPosition(s) {
  const p = s?.params;
  return Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]);
}

/**
 * Sample the analysis's structure tensor at a point.
 *
 * `analyzeImage()` returns `structure: { orientation, coherence, energy, ... }`
 * where `orientation` is the **tangent** angle (edge-following) in [0, PI) and
 * `coherence` is 0 (isotropic / flat) .. 1 (a single strong orientation).
 *
 * Returns `null` when the analysis carries no structure map (the tensor is
 * optional — `analyzeImage` can be called with it disabled), or when the point
 * is not finite. The caller then falls back to the dab's own rotation.
 *
 * @param {object} analysis - `analyzeImage()` result
 * @param {number} x
 * @param {number} y
 * @returns {{tangent: number, coherence: number}|null}
 */
function sampleStructureAt(analysis, x, y) {
  const st = analysis?.structure;
  if (!st || !st.orientation || !st.coherence) return null;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const w = st.width || analysis.width;
  const h = st.height || analysis.height;
  if (!w || !h) return null;
  const cx = Math.max(0, Math.min(w - 1, x));
  const cy = Math.max(0, Math.min(h - 1, y));
  const i = Math.round(cy) * w + Math.round(cx);
  const tangent = st.orientation[i];
  const coherence = st.coherence[i];
  if (!Number.isFinite(tangent) || !Number.isFinite(coherence)) return null;
  return { tangent, coherence };
}

/**
 * Convert a modular brush DAB into a brush STROKE.
 *
 * ## Why this exists (measured 2026-11-17)
 *
 * The optimiser models a stroke as an anti-aliased filled ellipse ("dab") and
 * emits it as `type: 'E'` with `params: [x, y, rx, ry, rot, rot, 0, 0]`. That
 * is correct for the optimiser's own error metric (it rasterises the dab), but
 * it is WRONG for the app's style renderers: `pencil.js` / `charcoal.js` /
 * `watercolor.js` render a **filled** shape as close parallel HATCHING
 * (see `js/styles/pencil.js` §"For filled shapes (E/B/T/R)"). So 700 dabs
 * became 700 hatch patches — black scribble mud.
 *
 * Measured on the frog fixture, real app path (`PaintingEngine`, `useWorker:true`):
 *
 * | path      | shapes | inkPct | colourBuckets | meanLum |
 * |-----------|--------|--------|---------------|---------|
 * | source    | —      | 45.90  | 228           | 193.9   |
 * | modular   | 764    | 89.73  | 32            | 110.5   |
 * | legacy    | 700    | 44.73  | 400           | 194.0   |
 *
 * The legacy Painter emits `type: 'S'` brush strokes, which the style
 * renderers draw as real strokes — hence 44.7% ink and 400 colour buckets
 * (close to the source's 45.9% / 228).
 *
 * ## The conversion
 *
 * A dab is an ellipse with a rotation. Turning it into a stroke means:
 *
 * 1. take the ellipse's LONG axis (the rotation is the ellipse's own axis in
 *    the optimiser's model — `params[4] = params[5] = p.rot`),
 * 2. lay a stroke along that axis, centred on the dab's centre,
 * 3. give the stroke a width equal to the dab's SHORT radius × 2 so its
 *    coverage matches the dab's cross-section,
 * 4. length = the dab's LONG radius × 2 so the stroke's swept area matches
 *    the dab's footprint,
 * 5. carry the dab's colour and alpha across unchanged.
 *
 * The stroke is emitted as `type: 'S'` with the Painter's own parameter order:
 * `[x0, y0, cx, cy, x1, y1, width, angle]` — a quadratic Bézier.
 *
 * A dab with a degenerate radius (rx or ry ≤ 0) cannot become a stroke; it is
 * dropped, and the caller is told how many were dropped.
 *
 * @param {object} raw - raw optimiser shape (`{type, params, color0, color1, alpha}`)
 * @param {number} order - paint order
 * @param {number} layerIdx
 * @param {number} seed
 * @returns {object|null} engine-format STROKE shape, or null if not convertible
 */
export function dabToStrokeShape(raw, order, layerIdx = 0, seed = 0, opts = {}) {
  if (!raw || raw.type !== 'E') return null;
  const p = Array.isArray(raw.params) ? raw.params : [];
  const x = p[0], y = p[1], rx = p[2], ry = p[3];
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (!Number.isFinite(rx) || !Number.isFinite(ry)) return null;
  if (rx <= 0.5 || ry <= 0.5) return null;

  // The dab's rotation is its own axis angle (optimizer.js emits
  // `params[4] = params[5] = p.rot`). Treat rx as the long axis and ry as the
  // short one; if the dab is taller than wide, the long axis is the Y axis.
  let rot = Number.isFinite(p[4]) ? p[4] : 0;
  let long = rx, short = ry;
  if (ry > rx) {
    // Taller than wide → the ellipse's long axis is vertical. Rotate the
    // axis by 90° and swap the radii.
    rot += Math.PI / 2;
    long = ry;
    short = rx;
  }

  // ── Elongate into a brush mark ───────────────────────────────────────
  // The optimiser's dab is a near-circular point-mark; a brush mark is long
  // and thin. `elongation` multiplies the LONG axis only, so the mark's
  // coverage grows along its own direction (the dab's cross-section — and
  // therefore the colour it carries — is preserved).
  const elongation = Number.isFinite(opts.elongation) ? Math.max(0, opts.elongation) : 3.0;
  const halfLong = long * elongation;

  // ── Structure alignment ───────────────────────────────────────────────
  // Snap the stroke toward the local structure tangent, weighted by how
  // coherent that neighbourhood is. The dab's own rotation already encodes
  // some of this; the snap sharpens it where the image has a clear
  // direction and leaves it alone in flat areas.
  const align = Number.isFinite(opts.structureAlign) ? Math.max(0, Math.min(1, opts.structureAlign)) : 0;
  if (align > 0 && opts.structure) {
    const st = opts.structure;
    const ang = st.tangent;
    const coh = st.coherence;
    if (Number.isFinite(ang) && Number.isFinite(coh) && coh > 0) {
      // Blend the angles on the SHORTEST arc (a 179°/1° pair must not
      // become a 180° swing).
      let d = ang - rot;
      while (d > Math.PI / 2) d -= Math.PI;
      while (d < -Math.PI / 2) d += Math.PI;
      rot += d * align * coh;
    }
  }

  const width = Math.max(1, short * 2 * (Number.isFinite(opts.widthScale) ? Math.max(0.05, opts.widthScale) : 1));
  const dx = Math.cos(rot) * halfLong;
  const dy = Math.sin(rot) * halfLong;

  const x0 = x - dx, y0 = y - dy;
  const x1 = x + dx, y1 = y + dy;
  // The Bézier control point sits at the dab's centre, so the curve passes
  // through the dab's own position and keeps the same footprint.
  const cx = x, cy = y;

  let c0 = Array.isArray(raw.color0) ? raw.color0.slice() : [0, 0, 0];
  let c1 = Array.isArray(raw.color1) ? raw.color1.slice() : c0.slice();

  // ── Gradient-preservation fix (worker lever 1: gradientLSQ) ──────────
  // The LSQ solver (optimizer.js solveStrokeGradientLSQ) emits a real per-stroke
  // gradient: c0 ≠ c1 by more than a few RGB units. When the incoming dab ALREADY
  // carries such a gradient (color0 != color1 by > 1 RGB), the dab came from the
  // LSQ solver — PRESERVE c0/c1 as-is. Only quantise c0 to the palette (so the
  // mid-stroke colour stays region-coherent), and KEEP c1's relationship: derive
  // c1 as an OFFSET from the quantised c0, scaled by the original delta, so the
  // gradient survives to the rendered stroke.
  //
  // When the incoming dab is FLAT (color0 == color1), the no-lever path is
  // byte-identical: keep the 35%-blend heuristic (quantise c0, then blend 35%
  // toward the second-nearest palette entry for c1).
  const incomingDist = Math.hypot(c0[0] - c1[0], c0[1] - c1[1], c0[2] - c1[2]);
  const hasGradient = incomingDist > 1.0;

  // The gradient-preservation branch is gated on the gradientLSQ lever
  // (`preserveStrokeGradient`). In the DEFAULT path the incoming dab is FLAT
  // (c0 == c1, the optimiser emits flat dabs when gradientLSQ is off), so
  // `hasGradient` is false and this branch is not taken — but the gate makes
  // that a property of the option, not an accident: a future caller that
  // feeds a gradient-carrying dab through the default path gets the old
  // 35%-blend behaviour, byte-identical to HEAD.
  if (hasGradient && opts.preserveStrokeGradient) {
    // LSQ-solver dab — preserve the gradient.
    // Quantise c0 to the palette (region-coherent mid-stroke colour), then
    // reconstruct c1 as an offset from the quantised c0 so the original
    // gradient magnitude and direction survive.
    let qc0 = c0;
    if (opts.palette && Array.isArray(opts.palette) && opts.palette.length > 0) {
      qc0 = quantiseColour(c0, opts.palette);
    }
    // The gradient delta (c1 - c0) scaled by the palette snapping offset.
    // This keeps the RELATIONSHIP (direction + relative magnitude) while
    // snapping the absolute position to the palette.
    const dc0 = qc0[0] - c0[0];
    const dc1 = qc0[1] - c0[1];
    const dc2 = qc0[2] - c0[2];
    c0 = qc0;
    c1 = [
      Math.max(0, Math.min(255, c1[0] + dc0)),
      Math.max(0, Math.min(255, c1[1] + dc1)),
      Math.max(0, Math.min(255, c1[2] + dc2)),
    ];
  } else if (opts.palette && Array.isArray(opts.palette) && opts.palette.length > 1) {
    // ── Flat dab (no-lever path): 35%-blend heuristic (byte-identical) ────
    // MEASURED from Code Paint's own stroke console (capture-codepaint-*.cjs,
    // frog fixture): EVERY stroke carries colA ≠ colB — a colour gradient along
    // the mark (median pair distance 34.6 RGB). Flat single-colour marks are
    // the single biggest "ours looks different" tell.
    //
    // MEASURED REGRESSION (first attempt): sampling the SOURCE at both
    // endpoints lets the pair jump between distant palette buckets (white
    // background ↔ dark fill) → two-tone blobs, inkPct 39.6, lumErr +10.4.
    // The gradient must stay WITHIN the dab's own colour neighbourhood:
    // colA = the dab's own colour; colB = the same hue shifted a measured
    // median pair-distance (34.6 RGB) toward the darker palette neighbour —
    // bounded, subtle, never crosses regions.
    const base = quantiseColour(c0, opts.palette);
    c0 = base.slice();
    // Second-nearest palette entry = the subtle gradient partner.
    let bd1 = Infinity, second = base;
    for (const p of opts.palette) {
      const d = (p[0] - base[0]) ** 2 + (p[1] - base[1]) ** 2 + (p[2] - base[2]) ** 2;
      if (d > 1e-6 && d < bd1) { bd1 = d; second = p; }
    }
    // Blend 35% toward the neighbour: subtle, region-local (measured CP
    // median pair distance 34.6; a 35% step of the nearest-pair distance
    // lands in the same band).
    c1 = [
      Math.round(base[0] + (second[0] - base[0]) * 0.35),
      Math.round(base[1] + (second[1] - base[1]) * 0.35),
      Math.round(base[2] + (second[2] - base[2]) * 0.35),
    ];
  }
  // Alpha: Code Paint paints EVERY stroke at 0.8 (measured, 996/996) — the
  // uniform soft layering is what makes overlaps read as washes, not seams.
  const a = Number.isFinite(opts.strokeAlpha) ? opts.strokeAlpha
    : (typeof raw.alpha === 'number' ? raw.alpha : 1);

  return {
    id: `stroke_${layerIdx}_${order}`,
    type: 'S',
    params: [x0, y0, cx, cy, x1, y1, width, rot],
    color0: c0,
    color1: c1,
    alpha: a,
    style: typeof raw.style === 'string' ? raw.style : 'painterly',
    layer: layerIdx,
    order,
    seed,
    flat: !!raw.flat,
  };
}

/**
 * Build a small RGB palette for an analysis (deterministic median cut).
 *
 * ## Why (measured 2026-11-17, frog fixture)
 *
 * Every optimiser dab samples the source at its own centre, so two dabs on
 * the same flat region pick up slightly different colours (JPEG noise +
 * anti-aliasing). Rendered, that is a MOTTLED fill — the single most visible
 * difference from Code Paint, whose fills are region-coherent. Quantising
 * each dab's colour to a k-colour palette of the source collapses the noise
 * while preserving the image's real colour structure.
 *
 * Simple distance-driven median cut: start from the mean colour, split the
 * bucket with the largest channel spread along that channel, `k` times.
 * Deterministic (no RNG), pure, O(n·k).
 *
 * @param {object} analysis - `analyzeImage()` result (needs `pixels` or
 *   `samplePoints` + `sampleColours`; falls back to no palette)
 * @param {number} k - palette size (clamped 2..32)
 * @returns {Array<Array<number>>} up to `k` [r,g,b] colours
 */
export function buildPalette(analysis, k = 12) {
  const n = Math.max(2, Math.min(32, Math.round(k)));
  const px = analysis?.pixels;
  const w = analysis?.width, h = analysis?.height;
  if (!(px && w > 0 && h > 0)) return [];
  // Sample on a grid (≤ 4096 points) — enough for a palette, cheap.
  const step = Math.max(1, Math.floor(Math.sqrt((w * h) / 4096)));
  const pts = [];
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const i = (y * w + x) * 4;
      if (i + 2 < px.length) pts.push([px[i], px[i + 1], px[i + 2]]);
    }
  }
  if (pts.length < n) return [];
  let buckets = [pts];
  while (buckets.length < n) {
    // Split the bucket with the largest channel spread.
    let bi = -1, bs = -1, bc = -1;
    for (let i = 0; i < buckets.length; i++) {
      const b = buckets[i];
      if (b.length < 2) continue;
      const mn = [255, 255, 255], mx = [0, 0, 0];
      for (const p of b) for (let c = 0; c < 3; c++) {
        if (p[c] < mn[c]) mn[c] = p[c];
        if (p[c] > mx[c]) mx[c] = p[c];
      }
      const spread = [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]];
      const c = spread[0] >= spread[1] && spread[0] >= spread[2] ? 0 : spread[1] >= spread[2] ? 1 : 2;
      const s = spread[c];
      if (s > bs) { bs = s; bi = i; bc = c; }
    }
    if (bi < 0 || bs <= 0) break; // nothing splittable
    const b = buckets[bi];
    b.sort((u, v) => u[bc] - v[bc]);
    const mid = b.length >> 1;
    buckets.splice(bi, 1, b.slice(0, mid), b.slice(mid));
  }
  return buckets
    .filter(b => b.length > 0)
    .map(b => {
      let r = 0, g = 0, bl = 0;
      for (const p of b) { r += p[0]; g += p[1]; bl += p[2]; }
      const m = b.length;
      return [Math.round(r / m), Math.round(g / m), Math.round(bl / m)];
    });
}

/**
 * Snap a colour to the nearest palette entry (Euclidean RGB).
 * @param {Array<number>} c - [r,g,b]
 * @param {Array<Array<number>>} palette
 * @returns {Array<number>} the palette colour, or `c` itself when empty
 */
export function quantiseColour(c, palette) {
  if (!Array.isArray(palette) || palette.length === 0) return c;
  let best = palette[0], bd = Infinity;
  for (const p of palette) {
    const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2;
    if (d < bd) { bd = d; best = p; }
  }
  return best.slice();
}

// ── Multi-layer band assignment (Phase 2.2 on the modular engine) ───────────

/**
 * Sample the soft tonal masks at a point → the band that owns it.
 *
 * This is the modular engine's layer classifier, and it is OUR design, not the
 * legacy Painter's: painter.js assigns a shape by two hard luminance cuts
 * (`<0.3 → shadows`, `>0.7 → highlights`) read at the shape's centroid. Here
 * the bands are `masks.js`' four SOFT tonal masks (Phase 2.1, the Zorn/Reilly
 * value-structure abstraction) — a pixel belongs to a band by degree, the four
 * windows sum to ~1 at every pixel, and a shape goes to the band that claims
 * its anchor with the largest membership. Same five layer names the engine's
 * multi-layer panel already exposes (`PaintingEngine.LAYER_NAMES`).
 *
 * Not a copy of painter.js `_assignLayer` — re-derived from the masks module
 * the app already ships. The Painter's generation-progress rule (first ~5% of
 * shapes → 'background') is deliberately NOT carried over: the optimiser has
 * no meaningful progress fraction (its passes are coarse→fine, not
 * background→detail), and which band a mark belongs to should depend on the
 * IMAGE, not on when the mark happened to be emitted.
 *
 * @param {object} tonal - `computeTonalMasks()` result (masks + width/height)
 * @param {number} x - anchor x in image pixels
 * @param {number} y - anchor y in image pixels
 * @param {string} [outlineFallback='outline'] - band for unplaced shapes
 * @returns {string} one of background/shadows/midtone(S)/highlights
 */
export function bandAt(tonal, x, y, outlineFallback = 'outline') {
  if (!tonal || !tonal.masks) return outlineFallback;
  const { masks, width, height } = tonal;
  const cx = Math.max(0, Math.min(width - 1, Math.round(x)));
  const cy = Math.max(0, Math.min(height - 1, Math.round(y)));
  const i = cy * width + cx;
  let best = null, bv = -1;
  for (const name of ['background', 'shadows', 'midtones', 'highlights']) {
    const m = masks[name];
    if (!m || i >= m.length) continue;
    if (m[i] > bv) { bv = m[i]; best = name; }
  }
  // The masks partition luminance by degree, so a point always has SOME
  // winner; `best === null` only on a malformed tonal object.
  return best ? SINGULAR[best] : outlineFallback;
}

/** masks.js plural band name → the engine's singular layer name. */
const SINGULAR = {
  background: 'background',
  shadows: 'shadows',
  midtones: 'midtone',
  highlights: 'highlights',
};

/**
 * The layer band each emitted shape belongs to, keyed by paint order.
 *
 * Only meaningful when the caller opts into multi-layer output
 * (`layerBands: 'bands'`). Classifies in emission order — outlines first
 * (they ARE the outline layer), then chains/dabs by their anchor — so the
 * returned index matches `plan.shapes[i]` exactly.
 *
 * @param {object} tonal - `computeTonalMasks()` result
 * @param {Array<object>} shapes - the emitted engine-format shapes
 * @param {object} [opts]
 * @param {Set<object>} [opts.outlineShapes] - shape objects emitted as outline
 * @returns {string[]} band name per shape (paint order)
 */
export function classifyShapeBands(tonal, shapes, opts = {}) {
  const outline = opts.outlineShapes || null;
  return shapes.map((s) => {
    if (outline && outline.has(s)) return 'outline';
    // 'S' params = [x0,y0, cx,cy, x1,y1, w, angle]; filled shapes put the
    // centre at [0],[1]. Either way the first two numbers anchor the mark.
    const x = Array.isArray(s.params) && s.params.length >= 2 ? s.params[0] : 0;
    const y = Array.isArray(s.params) && s.params.length >= 2 ? s.params[1] : 0;
    return bandAt(tonal, x, y, 'midtone');
  });
}

/**
 * Chain adjacent same-colour dabs into flowing multi-dab strokes.
 *
 * ## Why (measured 2026-11-17, frog fixture)
 *
 * A dab converted alone (`dabToStrokeShape`) is a SHORT mark: on the frog at
 * count 700 the mean converted stroke is 27.8px long × 8.7px wide (aspect
 * 3.2), which reads as a dash. The legacy Painter instead lays down long
 * continuous strokes that follow the image structure — that is why its output
 * looks like brushwork while the converted output looks like confetti.
 *
 * The fix is the classical **stroke chaining** step: dabs that are neighbours
 * AND agree in colour are fragments of the same underlying brush mark, so
 * merge them — order the chain by projection on the structure tangent, fit a
 * quadratic Bézier through the dab centres, emit ONE stroke with the chain's
 * mean width. Benefits:
 *
 * - long flowing marks instead of dashes (aspect rises with chain length);
 * - fewer shapes for the same coverage (the budget buys length, not count);
 * - colour stays per-chain (dabs are only merged when their colours agree),
 *   so colour fidelity is unchanged — MEASURED below.
 *
 * ## The algorithm
 *
 * Greedy single-pass chaining (deterministic, no RNG):
 *
 * 1. bucket dabs on a grid of cell = `max(dab radius)` — neighbours are found
 *   in the 3×3 cells around a seed, so the pass is near-linear;
 * 2. take the unused dab with the highest local coherence as a chain seed;
 * 3. grow the chain: repeatedly take the closest unused dab within
 *   `maxGap = 2.4 × mean dab diameter` whose colour distance from the chain's
 *   seed colour is below `colourTol` (measured: 60/441 keeps frog fidelity),
 *   and whose direction continues the chain (|Δangle| < 75°, tested against
 *   the last link so the chain cannot curl back on itself);
 * 4. emit the chain as one `type:'S'` quadratic Bézier: endpoints = first and
 *   last dab, control point = 2× the mean of the interior dabs minus the
 *   endpoint midpoint (the standard Bézier-through-points fit), width = the
 *   mean dab short-axis × 2 × widthScale;
 * 5. dabs that join no chain (isolated dots) fall through to
 *   `dabToStrokeShape` unchanged.
 *
 * Chaining is OFF by default (`chainDabs: false`); the plan enables it, and
 * the sweep scripts can turn it off to A/B the effect.
 *
 * @param {Array<object>} dabs - raw optimiser dab records (type 'E')
 * @param {object} [opts]
 * @param {number} [opts.colourTol=60] - max RGB distance for a merge
 * @param {number} [opts.chainDabs=true] - master switch
 * @returns {Array<Array<object>>} chains (each an array of dabs, len >= 2),
 *   plus singletons are NOT returned — the caller re-processes leftovers.
 */
export function chainDabs(dabs, opts = {}) {
  if (opts.chainDabs === false) return [];
  const tol = Number.isFinite(opts.colourTol) ? opts.colourTol : 60;

  const pts = [];
  for (const d of dabs) {
    if (!d || d.type !== 'E') continue;
    const p = Array.isArray(d.params) ? d.params : [];
    if (!Number.isFinite(p[0]) || !Number.isFinite(p[1])) continue;
    if (!Number.isFinite(p[2]) || !Number.isFinite(p[3])) continue;
    if (p[2] <= 0.5 || p[3] <= 0.5) continue;
    pts.push({ d, x: p[0], y: p[1], r: Math.max(p[2], p[3]), used: false });
  }
  if (pts.length < 2) return [];

  // Grid bucketing: cell = the largest dab radius, so 3×3 neighbourhood
  // lookups find every dab within one diameter of a seed.
  const cell = Math.max(2, Math.max(...pts.map(q => q.r)));
  const gw = Math.max(1, Math.ceil((Math.max(...pts.map(q => q.x)) + cell) / cell));
  const gh = Math.max(1, Math.ceil((Math.max(...pts.map(q => q.y)) + cell) / cell));
  const grid = new Map();
  for (const q of pts) {
    const gx = Math.min(gw - 1, Math.max(0, Math.floor(q.x / cell)));
    const gy = Math.min(gh - 1, Math.max(0, Math.floor(q.y / cell)));
    const key = gy * gw + gx;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(q);
  }
  const neighbours = (q) => {
    const gx = Math.min(gw - 1, Math.max(0, Math.floor(q.x / cell)));
    const gy = Math.min(gh - 1, Math.max(0, Math.floor(q.y / cell)));
    const out = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const k = (gy + dy) * gw + (gx + dx);
      const b = grid.get(k);
      if (b) out.push(...b);
    }
    return out;
  };

  const colourDist = (a, b) => {
    const c0 = Array.isArray(a) ? a : [0, 0, 0];
    const c1 = Array.isArray(b) ? b : [0, 0, 0];
    return Math.hypot(c0[0] - c1[0], c0[1] - c1[1], c0[2] - c1[2]);
  };

  const chains = [];
  // Deterministic order: top-left → bottom-right, so the same dabs always
  // chain the same way.
  const ordered = pts.slice().sort((a, b) => (a.y - b.y) || (a.x - b.x));
  for (const seed of ordered) {
    if (seed.used) continue;
    seed.used = true;
    const chain = [seed];
    const seedCol = Array.isArray(seed.d.color0) ? seed.d.color0 : [0, 0, 0];
    const meanR = seed.r;
    // A chain may only span a tight neighbourhood — 1.6 diameters. Wider gaps
    // produced chains that skipped across the canvas leaving holes (measured:
    // 105 shapes with inkPct 27.9, a sparse web of threads).
    const maxGap = meanR * 2 * 1.6;

    // Grow in BOTH directions from the seed so a chain is not biased to
    // extend only toward its scan-order side.
    for (const dir of [1, -1]) {
      let last = chain[dir === 1 ? chain.length - 1 : 0];
      let lastAng = Number.isFinite(seed.d.params[4]) ? seed.d.params[4] : 0;
      for (;;) {
        let best = null, bestD = Infinity, bestAng = 0;
        for (const q of neighbours(last)) {
          if (q.used) continue;
          const d = Math.hypot(q.x - last.x, q.y - last.y);
          if (d > maxGap || d < 1e-3) continue;
          const col = Array.isArray(q.d.color0) ? q.d.color0 : [0, 0, 0];
          if (colourDist(col, seedCol) > tol) continue;
          // Direction continuity: the link must continue the chain's last
          // segment (within 75°) so chains cannot fold back.
          const ang = Math.atan2(q.y - last.y, q.x - last.x);
          let dd = ang - lastAng;
          while (dd > Math.PI / 2) dd -= Math.PI;
          while (dd < -Math.PI / 2) dd += Math.PI;
          if (Math.abs(dd) > 75 * Math.PI / 180) continue;
          if (d < bestD) { bestD = d; best = q; bestAng = ang; }
        }
        if (!best) break;
        best.used = true;
        if (dir === 1) { chain.push(best); lastAng = bestAng; last = best; }
        else { chain.unshift(best); lastAng = bestAng; last = best; }
      }
    }
    if (chain.length >= 2) chains.push(chain);
  }
  return chains;
}

/**
 * Convert one raw optimiser shape into the engine's shape format.
 *
 * `optimizer.js` emits `{ type, params, color0, color1, alpha, ... }` with
 * params already in the shape-type's own order. `_convertShape` in
 * `engine.js` embeds colours at the indices the style renderers expect
 * (`E/B/R`: index 5 becomes `c0`, then `c1`, `alpha` are appended; `S/T`:
 * `c0`, `c1`, `alpha` are appended). The Renderer and every style module read
 * THOSE indices, so this function performs the same embedding — otherwise a
 * modular shape would be drawn with the wrong colour.
 *
 * @param {object} raw - raw optimiser shape (`{type, params, color0, color1, alpha}`)
 * @param {number} order - paint order (position in the emitted list)
 * @param {number} layerIdx
 * @param {number} seed
 * @returns {object} engine-format shape
 */
export function toEngineShape(raw, order, layerIdx = 0, seed = 0) {
  const t = raw.type;
  const p = Array.isArray(raw.params) ? raw.params.slice() : [];
  const c0 = Array.isArray(raw.color0) ? raw.color0.slice() : [0, 0, 0];
  const c1 = Array.isArray(raw.color1) ? raw.color1.slice() : c0.slice();
  const a = typeof raw.alpha === 'number' ? raw.alpha : 1;

  if (t === 'E' || t === 'B' || t === 'R') {
    // index 5 is the gradient angle / feather — overwritten by c0, as in
    // engine.js `_convertShape`.
    p[5] = c0;
    p.push(c1, a);
  } else {
    p.push(c0, c1, a);
  }

  return {
    id: `stroke_${layerIdx}_${order}`,
    type: t,
    params: p,
    color0: c0,
    color1: c1,
    alpha: a,
    style: typeof raw.style === 'string' ? raw.style : 'painterly',
    layer: layerIdx,
    order,
    seed,
    flat: !!raw.flat,
  };
}

/**
 * Derive the optimiser options for a modular run.
 *
 * Deliberately does NOT pass anything the optimiser does not accept: an
 * unknown key would be ignored silently, which is how a "wired but inert"
 * option ships. Only documented `resolveOptions` keys are set.
 *
 * Lever flags (worker levers 1-3) are forwarded through here so that
 * engine.generate({modular:true, gradientLSQ:true}) reaches optimise().
 * All default to false/undefined to preserve byte-identical output when off.
 *
 * @param {object} args
 * @returns {object}
 */
export function modularOptions({
  style = 'pencil',
  count = 400,
  seed = BRIDGE_DEFAULTS.seed,
  regionFill = 0,
  passes = null,
  primitives = null,
  // Worker lever 1: per-stroke gradient by weighted least squares
  gradientLSQ = undefined,
  gradientLSQRidge = undefined,
  // Worker lever 2: saliency-weighted placement
  saliencyWeighted = undefined,
  saliencyStrength = undefined,
  saliencyContrast = undefined,
  saliencyEdges = undefined,
  saliencySkin = undefined,
  saliencyCentre = undefined,
  saliencySubjectBonus = undefined,
  saliencySubjectMin = undefined,
  saliencySubjectMax = undefined,
  // Worker lever 3: palette-locked colour pair
  paletteLockedPair = undefined,
} = {}) {
  const opts = {
    style: style,
    // `count` is the optimiser's own budget key. `maxShapes` is NOT read by
    // `resolveOptions`/`optimise` (measured: `optimise(an,{maxShapes:10})`
    // returned 400 shapes) — passing it would silently paint the default.
    count: Math.max(1, Math.round(count)),
    seed: Math.round(seed),
    regionFill: Math.max(0, Math.min(1, Number(regionFill) || 0)),
  };
  if (Array.isArray(passes) && passes.length) opts.passes = passes;
  if (primitives && typeof primitives === 'object') opts.primitives = primitives;

  // Forward lever flags — only when explicitly provided (undefined means "use
  // optimiser default"). This preserves byte-identical output when levers are off.
  if (gradientLSQ !== undefined) opts.gradientLSQ = !!gradientLSQ;
  if (gradientLSQRidge !== undefined) opts.gradientLSQRidge = Number(gradientLSQRidge);
  if (saliencyWeighted !== undefined) opts.saliencyWeighted = !!saliencyWeighted;
  if (saliencyStrength !== undefined) opts.saliencyStrength = clamp(Number(saliencyStrength), 0, 1);
  if (saliencyContrast !== undefined) opts.saliencyContrast = Number(saliencyContrast);
  if (saliencyEdges !== undefined) opts.saliencyEdges = Number(saliencyEdges);
  if (saliencySkin !== undefined) opts.saliencySkin = Number(saliencySkin);
  if (saliencyCentre !== undefined) opts.saliencyCentre = Number(saliencyCentre);
  if (saliencySubjectBonus !== undefined) opts.saliencySubjectBonus = Number(saliencySubjectBonus);
  if (saliencySubjectMin !== undefined) opts.saliencySubjectMin = Number(saliencySubjectMin);
  if (saliencySubjectMax !== undefined) opts.saliencySubjectMax = Number(saliencySubjectMax);
  if (paletteLockedPair !== undefined) opts.paletteLockedPair = !!paletteLockedPair;

  return opts;
}

/**
 * Plan a modular-engine painting. Pure: no DOM, no canvas, no mutation of its
 * arguments. Returns `used:false` when the bridge is not enabled, so a caller
 * can wire it in without changing today's output.
 *
 * @param {object} analysis - `analyzeImage()` result (`edges`, `width`, `height`)
 * @param {object} [args]
 * @param {boolean} [args.enabled=false] - the opt-in switch
 * @param {string} [args.style='pencil'] - registry style name
 * @param {number} [args.count=400] - stroke budget
 * @param {number} [args.seed=12345]
 * @param {object} [args.layerStyles] - Phase 2.2 per-layer style spec
 * @param {Array<object>} [args.passes] - S4 explicit pass schedule
 * @param {object} [args.primitives] - S5 primitive mix
 * @param {object} [args.shapingOverride] - R4 per-style shaping override
 * @param {number} [args.width] - image width (ordering centre + outline cap)
 * @param {number} [args.height]
 * @param {boolean} [args.layerBands=false] - Phase 2.2 multi-layer: stamp each
 *   shape with `layerName` (the masks.js soft tonal band owning its anchor;
 *   outline strokes → 'outline'). Opt-in; off keeps every shape untouched.
 * @returns {{
 *   used: boolean, reason: string, shapes: object[],
 *   shaping: object|null, plan: object|null, options: object|null,
 *   rawCount: number, outlineCount: number,
 *   layerBands: string|null, bandCounts: object|null
 * }}
 */
export function buildModularPlan(analysis, args = {}) {
  const o = { ...BRIDGE_DEFAULTS, ...args };
  const width = o.width ?? analysis?.width ?? 0;
  const height = o.height ?? analysis?.height ?? 0;

  if (!o.enabled) {
    return {
      used: false, reason: 'disabled', shapes: [], shaping: null, plan: null,
      options: null, rawCount: 0, outlineCount: 0,
    };
  }
  if (!analysis || !(width > 0) || !(height > 0)) {
    return {
      used: false, reason: 'no-analysis', shapes: [], shaping: null, plan: null,
      options: null, rawCount: 0, outlineCount: 0,
    };
  }

  // R4 per-style shaping: the style's own row, or an explicit override.
  const shaping = resolveEffectiveShaping(o.style, o.shapingOverride);

  // Colour quantisation — build the palette FIRST (before optimise) so it can
  // be passed through for palette-locked pairs (worker lever 3).
  const palette = (o.dabsAsStrokes !== false && o.quantiseColours)
    ? buildPalette(analysis, o.paletteSize)
    : null;

  const options = modularOptions({
    style: o.style,
    // The optimiser sizes its dabs for COVERAGE (`r ≈ √(W·H/count)`), so a
    // thinner stroke at the same count leaves gaps in the painting. The
    // stroke budget is scaled up to compensate — measured, see
    // `strokeBudgetScale` in `BRIDGE_DEFAULTS`.
    count: o.dabsAsStrokes !== false
      ? Math.round(o.count * (o.strokeBudgetScale || 1))
      : o.count,
    seed: o.seed,
    regionFill: shaping.shaping.regionFill || 0,
    passes: o.passes,
    primitives: o.primitives,
    // Forward lever flags from the call so they reach optimise() via
    // resolveOptions + optimiser defaults. Undefined → defaults (which are
    // false / off). Explicit true/false passed through unchanged.
    gradientLSQ: o.gradientLSQ,
    gradientLSQRidge: o.gradientLSQRidge,
    saliencyWeighted: o.saliencyWeighted,
    saliencyStrength: o.saliencyStrength,
    saliencyContrast: o.saliencyContrast,
    saliencyEdges: o.saliencyEdges,
    saliencySkin: o.saliencySkin,
    saliencyCentre: o.saliencyCentre,
    saliencySubjectBonus: o.saliencySubjectBonus,
    saliencySubjectMin: o.saliencySubjectMin,
    saliencySubjectMax: o.saliencySubjectMax,
    paletteLockedPair: o.paletteLockedPair,
  });
  // `resolveOptions` is the optimiser's own normaliser — use it so the bridge
  // and a direct `optimise()` call cannot drift apart.
  const resolved = resolveOptions(options);

  // Pass the palette through options so the optimiser can use it for
  // palette-locked pairs (worker lever 3). `optimise` reads it from
  // `opts.palette` when `gradientLSQ` and `paletteLockedPair` are enabled.
  if (palette) resolved.palette = palette;

  const raw = optimise(analysis, resolved);
  const list = Array.isArray(raw?.shapes) ? raw.shapes : [];
  const usable = list.filter(hasPosition);

  // Dab chaining — merge neighbouring same-colour dabs into flowing strokes
  // (see `chainDabs`). Only dabs (type 'E') chain; outline/other types pass
  // through unchanged.
  const chainable = o.dabsAsStrokes !== false
    ? usable.filter(r => r.type === 'E')
    : [];
  const chains = chainDabs(chainable, {
    colourTol: o.chainColourTol,
    chainDabs: o.dabsAsStrokes !== false ? o.chainDabs : false,
  });
  const chained = new Set();
  for (const c of chains) for (const q of c) chained.add(q.d);
  // Dabs that joined no chain — filled by the dispatch loop below, emitted
  // once each as single-dab strokes. Starts EMPTY (initialising it with
  // `usable` double-emitted every dab — caught by the budget test).
  const chainHandled = new Set();

  // Source sampler for the endpoint colour gradient (see `dabToStrokeShape`):
  // bilinear-ish nearest sample of the analysis pixels at a canvas point.
  const px = analysis?.pixels;
  const sampleSource = (o.dabsAsStrokes !== false && px && width > 0 && height > 0)
    ? (x, y) => {
      const cx = Math.max(0, Math.min(width - 1, Math.round(x)));
      const cy = Math.max(0, Math.min(height - 1, Math.round(y)));
      const i = (cy * width + cx) * 4;
      if (i + 2 >= px.length) return null;
      return [px[i], px[i + 1], px[i + 2]];
    }
    : null;

  // Outline lay-in from the R4 seam, budget-capped. Laid FIRST (classical
  // contour-before-masses), so the outlines occupy the low `order` values.
  const outlineBudget = Math.min(
    o.outlineMax,
    Math.max(0, Math.round(o.count * o.outlineBudgetFrac)),
  );
  let outlines = [];
  try {
    const r4 = buildR4Plan({
      style: o.style,
      analysis,
      order: shaping.shaping.order,
      outline: 'first',
      outlineOptions: { budget: outlineBudget },
      width, height,
    });
    outlines = Array.isArray(r4?.outlinePoints) ? r4.outlinePoints : [];
  } catch {
    outlines = [];
  }

  const shapes = [];
  // Multi-layer: the shape objects emitted as OUTLINE strokes. They are the
  // only shapes whose band does not come from the tonal masks — an outline
  // mark belongs to the 'outline' layer by construction (it follows the R4
  // edge field, not a luminance band).
  const outlineShapes = o.layerBands === 'bands' ? new Set() : null;
  let order = 0;
  for (const pts of outlines) {
    if (!Array.isArray(pts) || pts.length < 2) continue;
    const a = pts[0];
    const b = pts[pts.length - 1];
    const mid = pts[pts.length >> 1];
    shapes.push(toEngineShape({
      type: 'S',
      // [x0,y0, cx,cy, x1,y1, width, angle]
      params: [
        a[0], a[1],
        2 * mid[0] - (a[0] + b[0]) / 2, 2 * mid[1] - (a[1] + b[1]) / 2,
        b[0], b[1],
        Math.max(1, Math.min(width, height) * 0.0028),
        Math.atan2(b[1] - a[1], b[0] - a[0]),
      ],
      color0: [30, 30, 30],
      color1: [30, 30, 30],
      alpha: 0.9,
      style: o.style,
      flat: true,
    }, order++, 0, o.seed));
    if (outlineShapes) outlineShapes.add(shapes[shapes.length - 1]);
  }
  for (const r of usable) {
    // The RAW registry name, never the Painter alias: `aliasStyle('watercolor')
    // → 'watercolour'`, and `watercolour` is NOT in the registry, so the
    // Renderer would fall back to the flat `drawShape` and silently paint every
    // stroke in the generic renderer. The engine registers aliases on its own
    // renderer (engine.js `_registerAllStyles`), but the shape's `style` field
    // must still name a real style.
    //
    // DABS → CHAINED STROKES (see `chainDabs` + `dabToStrokeShape`). The
    // optimiser emits filled ellipses; the style renderers hatch filled shapes,
    // which turns 700 dabs into black scribble. Chaining merges neighbouring
    // same-colour dabs into one flowing Bézier; unchained leftovers fall back
    // to the single-dab conversion. `dabsAsStrokes: false` restores the raw
    // dab behaviour (used by the bridge's own regression tests).
    if (o.dabsAsStrokes === false) {
      shapes.push(toEngineShape({ ...r, style: o.style }, order++, 0, o.seed));
      continue;
    }
    if (chained.has(r)) continue; // emitted as part of a chain below
    chainHandled.add(r);
  }

  // Emit chains as single flowing Béziers (paint order: chains before dots,
  // matching the legacy Painter's big-mark-first lay-in).
  for (const chain of chains) {
    const first = chain[0], last = chain[chain.length - 1];
    let mx = 0, my = 0, wSum = 0;
    for (const q of chain) {
      const p = q.d.params;
      mx += p[0]; my += p[1];
      // The chain's WIDTH is the max cross-section of its dabs (a brush does
      // not thin because it lengthened) — the mean collapses to hairlines
      // when one small dab joins (measured: widP50 1.08px).
      const short = Math.min(p[2], p[3]);
      wSum = Math.max(wSum, short * 2);
    }
    mx /= chain.length; my /= chain.length;
    const width = Math.max(1, wSum * (o.strokeWidthScale ?? 1));
    const midX = (first.x + last.x) / 2, midY = (first.y + last.y) / 2;
    const c0 = quantiseColour(Array.isArray(first.d.color0) ? first.d.color0.slice() : [0, 0, 0], palette);
    const c1 = quantiseColour(Array.isArray(last.d.color0) ? last.d.color0.slice() : c0.slice(), palette);
    const a = typeof first.d.alpha === 'number' ? first.d.alpha : 1;
    shapes.push(toEngineShape({
      type: 'S',
      params: [first.x, first.y, 2 * mx - midX, 2 * my - midY, last.x, last.y, width, Math.atan2(last.y - first.y, last.x - first.x)],
      color0: c0,
      color1: c1,
      alpha: a,
      style: o.style,
    }, order++, 0, o.seed));
  }
  // Leftover dabs that joined no chain → single-dab strokes.
  for (const r of usable) {
    if (!chainHandled.has(r)) continue;
    const asStroke = dabToStrokeShape(r, order, 0, o.seed, {
      elongation: o.strokeElongation,
      structureAlign: o.strokeStructureAlign,
      widthScale: o.strokeWidthScale,
      structure: sampleStructureAt(analysis, r.params[0], r.params[1]),
      sampleSource,
      palette,
      strokeAlpha: o.strokeAlpha,
      // Opt-in: only the gradientLSQ lever preserves a per-stroke gradient.
      preserveStrokeGradient: !!o.gradientLSQ,
    });
    if (asStroke) {
      asStroke.style = o.style;
      // ── Quantise to the source palette (fills read as regions, not noise) ──
      // `preserveStrokeGradient` (derived from the gradientLSQ lever) gates
      // whether the gradient survives this quantise step:
      //   • OFF (default): HEAD byte-identical — quantise c0 AND c1
      //     independently, both snapping onto their own palette bucket
      //     (flat result preserved).
      //   • ON: quantise c0, then reconstruct c1 as an offset from the
      //     quantised c0 so the LSQ solver's gradient survives to the render.
      const preserveStrokeGradient = !!o.gradientLSQ;
      if (palette && Array.isArray(palette) && palette.length > 0) {
        if (preserveStrokeGradient) {
          const c0q = quantiseColour(asStroke.color0, palette);
          const dc0 = c0q[0] - asStroke.color0[0];
          const dc1 = c0q[1] - asStroke.color0[1];
          const dc2 = c0q[2] - asStroke.color0[2];
          asStroke.color0 = c0q;
          asStroke.color1 = [
            Math.max(0, Math.min(255, asStroke.color1[0] + dc0)),
            Math.max(0, Math.min(255, asStroke.color1[1] + dc1)),
            Math.max(0, Math.min(255, asStroke.color1[2] + dc2)),
          ];
        } else {
          // HEAD behaviour: independent quantise of both endpoints → byte-identical.
          asStroke.color0 = quantiseColour(asStroke.color0, palette);
          asStroke.color1 = quantiseColour(asStroke.color1, palette);
        }
      }
      // toEngineShape-embedded params carry colour at renderer indices for
      // filled shapes; 'S' strokes do NOT embed colour in params, so mutating
      // the fields is enough here.
      shapes.push(asStroke);
      order++;
      continue;
    }
    shapes.push(toEngineShape({ ...r, style: o.style }, order++, 0, o.seed));
  }

  // Phase 2.2 — multi-layer band assignment. OUR layer system (masks.js soft
  // tonal bands), now on the modular engine: when the caller opts in, every
  // shape carries `layerName` — the band that owns its anchor — and outlines
  // are pinned to the 'outline' layer. engine.js maps `layerName` onto its
  // five named band layers, exactly as the Painter path does.
  let bandCounts = null;
  if (o.layerBands === 'bands') {
    const tonal = computeTonalMasks(analysis);
    const bands = classifyShapeBands(tonal, shapes, { outlineShapes });
    for (let i = 0; i < shapes.length; i++) shapes[i].layerName = bands[i];
    bandCounts = {};
    for (const b of bands) bandCounts[b] = (bandCounts[b] || 0) + 1;
  }

  // Phase 2.2 — per-layer styles. Applied LAST, exactly where `engine.js`
  // applies it on the Painter path. `applyLayerStyles` keys on `layerName`
  // (see `shapeLayerKey`), so a banded plan is restamped per band directly.
  if (o.layerStyles) applyLayerStyles(shapes, o.layerStyles);

  return {
    used: shapes.length > 0,
    reason: shapes.length > 0 ? 'ok' : 'empty',
    shapes,
    shaping: shaping.shaping,
    plan: null,
    options: resolved,
    rawCount: usable.length,
    outlineCount: outlines.length,
    layerBands: o.layerBands === 'bands' ? 'bands' : null,
    bandCounts,
  };
}

export default {
  BRIDGE_DEFAULTS, buildModularPlan, toEngineShape, dabToStrokeShape,
  chainDabs, buildPalette, quantiseColour, modularOptions,
  bandAt, classifyShapeBands,
};
