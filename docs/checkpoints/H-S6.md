# Checkpoint H-S6 — style-aware render path for `scoreProfileStyle` (Track S hygiene)

**Date:** 2026-11-13 · Agent: BE (ThinkPad) · Hygiene item **H-S6**
(`docs/TRACK_S.md` §4), the defect diagnosed in `docs/checkpoints/S3.md` §7 **B**.
**Status:** done. The render now honours the profile's `global.style`; a pencil and
an ink profile no longer render byte-identically. **H-S5 (the orientation kernel)
is deliberately NOT touched here** — it is a one-function change that must be
validated against this fixed path (§6).

---

## 1. The defect (S3.md §7 B)

`scoreProfileStyle` built its render with `optimise(analysis, opts)` →
`metrics.rasterizeShapes(shapes, w, h, bg)`. Neither reads a shape's `style`: the
optimiser emits un-styled ellipses and the rasteriser draws plain anti-aliased
ellipses. So the one thing a style profile controls (`global.style`) was not in the
loop. Measured, same content / seed / cost:

```
pencilProfile vs pencilRef 0.887   inkProfile vs pencilRef 0.887     (byte-identical)
pencilProfile vs inkRef    0.928   inkProfile vs inkRef    0.928
```

S2 therefore measured *the optimiser's stroke geometry* against a style reference —
which is why its only real-world check could report a margin of just +0.0027.

## 2. The fix — `js/engine/style-render.js`

A render backend that pushes the same shapes through the **real style registry**,
separated so the pure part stays `node`-testable:

- **`toStyledShape(shape, styleName)` / `stampShapeStyles(shapes, styleName)`** —
  *pure*. Convert an engine-format shape into the layout a style module reads (the
  one `PaintingEngine._convertShape` builds: for `E`/`B`/`R` colours ride at
  `params[5..7]`, for `S`/`T` they are appended), and stamp the style name on it.
  Geometry (`params[0..4]`) is untouched. Returns NEW shapes — never mutates.
- **`createStyleRasteriser(opts)`** — the canvas half. Builds an `OffscreenCanvas`
  (or a `document` canvas), registers every built-in style + its Painter alias on a
  `Renderer` (mirrors `_registerAllStyles`), draws the shapes through it, and
  returns interleaved-RGB `Float32Array` — the same output shape as
  `rasterizeShapes`, so it is a drop-in backend.

**Fallback contract.** The rasteriser transparently falls back to the plain
`rasterizeShapes` wherever no canvas exists (`node`, a worker). `node` output is
therefore **byte-identical to before**; the style-aware path only engages where a
style *can* be rendered. (Verified: `createStyleRasteriser()` under `node` equals
`rasterizeShapes` element-for-element.)

`score.js` `scoreProfileStyle` now:
- resolves the style from the profile (`normalizeProfile(profile).global.style`,
  default `pencil`), stamps it on every shape, and renders through the style-aware
  backend by default;
- accepts `options.render` (inject a backend), `options.applyStyle: false` (skip
  stamping), `options.style` (override the name);
- reports `style` and `renderBackend` (`'style'` | `'plain'` | `'custom'`) on the
  result, so the measurement is self-describing.

## 3. Evidence — unit tests (pure, `node`)

```
$ node tests/engine.test.js
Passed: 137   Failed: 0      (was 132; +5 H-S6 tests)
$ node tests/ref-analyze.test.js
Passed: 29    Failed: 0
```

The five tests pin: the colour layout of `toStyledShape` (+ no mutation); the
no-mutation / no-op contract of `stampShapeStyles`; that the **plain** rasteriser
ignores style (so the `node` path stays byte-identical — a regression guard for
this fix); that `createStyleRasteriser()`'s `node` fallback equals the plain
rasteriser exactly; and that `scoreProfileStyle` reports its backend and style and
actually calls an injected `options.render`.

## 4. Evidence — measured in headless Chromium

```
$ NODE_PATH=<playwright-core> node scripts/style-match-probe.cjs
```

```
styleAware: renderBackend = "style"
  a pencil profile vs an ink profile, same content/seed/cost (200):
    renders differ in  97.14 % of pixels      (was 0 % — byte-identical before)
    painted             91.6 % / 98.5 %       (both non-blank)
    mean luminance      53.1  / 130.5
pencilProfile vs pencilRef  styleMatch 0.4134
pencilProfile vs inkRef     styleMatch 0.4060     margin +0.0074   (narrower ref wins: correct)
deterministic true · sameCost true · selfPencilDistance 0.5992
```

The probe now asserts all three H-S6 facts (backend ran, the two styles differ,
neither render is blank) and still asserts direction + determinism + equal cost.

## 5. Gates

```
engine 137/137 · ref-analyze 29/29 · wetsim 15/15 · masks 19/19 · outlines 16/16 ·
order 24/24 · shaping 18/18 · style-library 50/50 · export-panel 90/90 ·
style-polish 11/11 · visual regression pass=9 fail=0 error=0 (9 pinned baselines
UNMOVED — no render path in the app changed) · style-match-probe PASS
```

## 6. What is NOT claimed (and what is next)

- **The margin is still small (+0.0074) and `styleMatch` still cannot reach 1.**
  The *reason has changed*: it is no longer "the render ignores style". Two known
  limits remain, both prerequisites for S9:
  1. **H-S5** — `orientationMatch` is not a metric (its denominator penalises
     spread), so `refPacketDistance(p, p) ≈ 0.60` here and `styleMatch` is floored.
     S3 §8 said "fix B first, then A"; **B is now done, so H-S5 is the immediate
     next step** — re-validate it against this fixed render path (there is now a
     style-aware probe to measure it against).
  2. **The reference pair is still weak** — pencil and ink refs are 700-stroke
     renders of the *same* content, so their packets share content dominance. A
     genuinely different reference pair is needed before any magnitude claim.
- **No claim that the styled render is a faithful likeness** of what the app paints
  — it renders the optimiser's shapes through the style modules, which is exactly
  what makes the score style-sensitive; the app paints through a different
  (Painter) generator. R6 will converge these.
- The styled render goes through the 2D style renderers (`E` shapes never take the
  p5.brush stamp path), so it is unaffected by the SwiftShader WebGL2 trap.

## 7. Files

**New:** `js/engine/style-render.js` · `docs/checkpoints/H-S6.md`
**Changed:** `js/engine/score.js` (`scoreProfileStyle` backend + docstring) ·
`tests/engine.test.js` (+5 tests) · `scripts/style-match-probe.cjs` (+H-S6 evidence
& assertions) · `docs/TRACK_S.md` (§4/§5) · `docs/ROADMAP_STATUS.md` (Track S)
**Untouched:** every app render path — hence the 9 pinned baselines are unmoved.

## 8. Hand-off

- Next stream: **H-S5** (fix `orientationMatch`'s normalisation, invert its
  `KNOWN DEFECT` test, drop the note in `metrics.js`), measured on this path; then
  **S9** (knob ↔ style-match correlation) and **S10** (eval matrix).
- `docs/API.md` (H-S1) should note the third render backend concept.
