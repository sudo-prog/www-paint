# HANDOFF — Mac Hermes ⟶ WWW_PAINT (project 20.36)

**From:** Hermes / BE on the ThinkPad (control host)
**To:** Hermes / Mac (FE)
**Date:** 2026-11-11
**Repo baseline:** `sudo-prog/www-paint@main`, clean, remote == local.

You are being handed **four parallel workstreams** on WWW_PAINT. The ThinkPad
(BE) keeps the engine spine; you take the file-isolated work. Read this whole
document before writing any code, then read the in-repo docs it points to.

---

## 0. TL;DR

- Build **4 streams**: M1 wet media · M2 masks+layer UI · M3 brush/media ·
  M4 independent QA.
- **One writer per file. You do not touch the engine spine** (§3, §6).
- GitHub branches `machine/mac/*` → PR → `main`. Syncthing is *not* the
  integration path.
- Every claim you make must be backed by a command you ran, pasted verbatim.
- Never delete a file without explicit per-instance approval from the human.

---

## 1. The project in one screen

**WWW_PAINT** is a pure-web, stroke-based image→art engine: it takes a photo and
repaints it in one of ~51 painting styles (pencil, ink, watercolor, oil,
charcoal, and many graphic/3D styles).

| | |
|---|---|
| Repo | `github.com/sudo-prog/www-paint` |
| Live | https://www-paint.pages.dev/ |
| Stack | Static **ES modules**, **no build step** |
| Entry | `index.html` loads `js/ui/app.js` directly — **edit source, reload, done** |
| Deploy | Cloudflare Pages via `.github/workflows/deploy-pages.yaml` on push to `main` |
| Package | **No `package.json`** — no npm scripts. Everything runs via plain `node` |

**Two engines — know which is which:**

- **`js/engine/painter.js`** — the auto-painter the app currently paints with.
  It is slated to be superseded (milestone R6).
- **The modular engine** (`analyzer.js` + `generator.js` + `optimizer.js` +
  `scorer.js` + `renderer.js`) — **the engine of record**. Track R (R0–R6) exists
  to bring it up to production quality and switch the app over to it.

**The governing principle** (`docs/CLEANROOM.md`):
> Inspired by the *technique*, never copied from the *source*.

Reimplement from the published literature (Hertzmann 1998, structure-tensor SBR,
Image Painter CCL+PCA, Birth of a Painting smudge — all cited in
`docs/REFERENCES.md`). Never translate another implementation and call it ours.

---

## 2. HARD RULES (violating these is a failed task)

1. **One writer per file.** Never edit a file listed as ThinkPad-owned in §6.
2. **Never delete any file** without explicit per-instance human approval.
3. **Do not touch the engine spine:** `optimizer.js`, `generator.js`,
   `analyzer.js`, `engine.js`, `painter.js`, `scorer.js`, `js/ui/controls.js`,
   `js/ui/app.js`. If you need a change there, write an OPS_LOG note and the
   ThinkPad makes it.
4. **Never re-baseline to silence a red test.** `--update` only for a *verified,
   intended* output change, and you must say so in the commit message and OPS_LOG.
5. **Determinism:** any new option must default so output is **byte-identical**
   to previous behaviour, then opt in. Run the visual regression to *prove* it.
6. **No new npm/dependency requirements on the check path** unless agreed — the
   project deliberately has no build step.
7. **Never trust a sub-agent's self-report.** Re-run the command yourself; paste
   raw output.
8. **Never copy code from an external implementation.** Ideas come from the
   papers in `docs/REFERENCES.md`; write your own expression of them.

---

## 3. Where you work — your clone, not the Syncthing mirror

The Syncthing `projects` folder mirrors the ThinkPad's working tree **without
`.git`**. Do not try to run git there. Clone your own:

```bash
git clone git@github.com:sudo-prog/www-paint.git ~/code/www-paint
cd ~/code/www-paint
git checkout -b machine/mac/<stream>       # e.g. machine/mac/wetsim
```

Auth: verify first with `gh auth status` (or `ssh -T git@github.com`). Ask the
human if auth is missing — do not guess tokens.

---

## 4. Commands you will use (all from the repo root)

```bash
# Unit tests — expect 47/47 at baseline
node tests/engine.test.js

# Visual regression — expect 9/9 at baseline
#   needs playwright-core + Chromium; point NODE_PATH at any install that has it
NODE_PATH=<your playwright-core parent dir> node scripts/visual-regression.cjs
NODE_PATH=<...> node scripts/visual-regression.cjs --styles=watercolor,ink   # subset

# Parity bench (modular engine vs the app painter) — writes baseline.json
NODE_PATH=<...> node scripts/parity-bench.cjs

# Structure-tensor debug map
NODE_PATH=<...> node scripts/structure-debug.cjs
```

**Baseline known-good state:** unit `47/47`; visual `pass=9 fail=0 error=0`.
The visual suite renders the **app engine (painter path)** for **9 styles**:
`pencil ink watercolor oil charcoal marker cross-hatch halftone graphic` at
256px, seed `3047602159`, 700 strokes. If you edit any of those styles (you will,
in M3), the hash **will** change — that is an intended change: re-baseline
deliberately and record it.

**macOS note:** install Chromium once —
`npx playwright install chromium` — or use any existing playwright-core install
on the machine (check `~/.cache/ms-playwright`).

---

## 5. Your workstreams

Each stream = its own branch and its own PR. Deliver **one stream at a time**;
do not open two streams that touch the same file.

### M1 — Phase 3: Wet-media simulation  *(new module, biggest win)*

**Goal:** a lightweight wetness/pigment model so watercolor/ink can bleed, pool
and dry. Public sources only:
[inkwash](https://github.com/johnowhitaker/inkwash),
[watercolor-playground](https://github.com/msurguy/watercolor-playground),
[dli/paint](https://github.com/dli/paint) (study the *ideas*, write your own code).

**Deliverables**
- `js/engine/wetsim.js` — NEW, implementing the frozen interface **IF-2** (§7).
  Pure 2D canvas + typed arrays. No WebGL. No DOM beyond a 2D context.
- Node-testable: run on plain buffers so tests can assert (a) determinism under a
  fixed seed and (b) that pigment mass is conserved on a dry frame.
- A short design note `docs/checkpoints/P3.md` (research → design → result).
- Wire-in is **ThinkPad's** job (one call site in `renderer.js`). Ship the module
  + tests; leave a `// TODO(integration)` comment with the exact call you expect.

**Files you own here:** `js/engine/wetsim.js`, `docs/checkpoints/P3.md`, and
*your own* test additions in a NEW file (not `tests/engine.test.js` — that is
shared with the ThinkPad; put yours in `tests/wetsim.test.js` and register it in
your PR description).

**Exit criteria:** deterministic; mass-conserving on dry frames; documented;
ThinkPad can integrate it with one call.

### M2 — Phase 2.1 tonal masks + 2.3 layer panel UI

**Goal A — masks:** soft tonal masks (background / shadows / midtones /
highlights). Deliverable `js/engine/masks.js` implementing **IF-1** (§7) —
node-testable, additive, consumes an existing `analyzeImage()` result
(see `js/engine/analyzer.js`; `analysis.luminance` is a `Uint8ClampedArray`).
Also produce `docs/research/tonal-masks.png` (a debug visualisation, same style
as `scripts/structure-debug.cjs`).

**Goal B — layer panel:** `js/ui/layers.js` already contains a `LayersManager`.
Your job: verify whether it is actually wired into `js/ui/app.js`, then make the
layer panel work end-to-end (visibility, opacity, blend, style, regenerate layer).
If wiring requires an edit to `js/ui/app.js` or `js/ui/controls.js`, **stop and
raise it via OPS_LOG** — those are ThinkPad-owned.

**Files you own here:** `js/engine/masks.js`, `js/ui/layers.js`,
`docs/checkpoints/P2.md`, `docs/research/tonal-masks.png`.

**Exit criteria:** masks visualisable with coverage stats; layer panel controls
each provably change the rendered output in a real headless browser.

### M3 — Phases 1.1 + 1.6: brush media and water/ink unification

**Goal:** (1.1) harden the vendored p5.brush integration — tips, pressure,
scatter, grain, hatch fills, vector fields — so ≥8 styles use the enhanced stamp
path with a working fallback; (1.6) unify watercolor/ink parameters and
strengthen bleed/texture controls.

**Files you own here:** `js/engine/brush-stamp-engine.js`,
`js/vendor/brush.esm.js` (re-vendor only if the vendored copy is genuinely
incomplete — record the upstream commit), `js/styles/watercolor.js`,
`js/styles/ink.js`, `js/styles/wash.js`, `js/styles/sumi.js`, plus any other
style file **not** on the ThinkPad do-not-touch list (§6).

**⚠ Baseline warning:** `watercolor` and `ink` ARE in the 9-style visual suite.
Improving them *will* change their hashes. That is intended — re-baseline
`--update` deliberately, and state in the commit: *"intended output change:
watercolor/ink improved for 1.6; baselines re-baselined"*.

**Exit criteria:** ≥8 styles on the enhanced path; fallback proven (force the
vendored import to fail and confirm the canvas path still renders); unit tests
green; side-by-side before/after PNGs in `docs/research/`.

### M4 — Independent QA seat

Standing role. On request (or after any ThinkPad push), verify `main`
**independently** — never trust a summary:

- `node tests/engine.test.js` → paste the raw summary line.
- `NODE_PATH=<...> node scripts/visual-regression.cjs` → paste
  `pass=/fail=/error=`.
- `NODE_PATH=<...> node scripts/parity-bench.cjs` → paste the per-image
  simMae/SSIM table.
- Launch a real headless browser against `index.html`, click the affected
  control, and assert it changes output (DOM assertion **and** a behavioural
  check). Screenshot to `docs/research/qa-<topic>.png`.
- Report any disagreement with the ThinkPad's claim in OPS_LOG as
  `[MAC] [VERIFY] <claim> — DISAGREE: <evidence>`.

**M4 makes no source edits.** Its output is evidence, not commits.

---

## 6. File ownership — do-not-touch list

**ThinkPad-owned (never edit):**
```
js/engine/optimizer.js      js/engine/generator.js
js/engine/analyzer.js       js/engine/engine.js
js/engine/painter.js        js/engine/scorer.js
js/engine/renderer.js       js/engine/relief.js
js/ui/controls.js           js/ui/app.js
tests/engine.test.js        scripts/parity-bench.cjs
scripts/visual-regression.cjs   tests/parity/harness.html
docs/CLEANROOM.md  docs/ROADMAP.md  docs/ROADMAP_STATUS.md
docs/AI_STYLE_HARNESS.md        docs/STYLE_PROFILE.md
.github/**
```
**Mac-owned (your streams):**
```
js/engine/wetsim.js (new)   js/engine/masks.js (new)
js/ui/layers.js             js/engine/brush-stamp-engine.js
js/styles/*  (except the styles the ThinkPad is actively on)
docs/checkpoints/P2.md P3.md
docs/research/* (your new artefacts)   tests/wetsim.test.js (new)
HANDOFF.md  (this file)
```

**Shared — propose, don't edit:** `js/ui/controls.js`, `js/ui/app.js`,
`docs/ROADMAP_STATUS.md`.

---

## 7. Frozen interfaces you must match

**IF-1 — `masks.js` (M2):**
```js
export function computeTonalMasks(analysis, opts = {}) {
  // returns:
  return {
    width, height,
    masks: { background, shadows, midtones, highlights }, // Float32Array, 0..1
    coverage: { background: 0.41, shadows: 0.22, midtones: 0.25, highlights: 0.12 },
    threshold: { lo: 85, hi: 170 }
  };
}
```
Additive only; must not require a DOM.

**IF-2 — `wetsim.js` (M1):**
```js
export function createWetSim(width, height, opts = {}) {
  return {
    wetness,   // Float32Array
    height,    // Float32Array
    deposit(x, y, radius, color, opts),
    dry(dt),                 // advance drying
    compositeInto(ctx)       // paint pigment onto a 2D canvas context
  };
}
```
Pure 2D. Deterministic under a fixed seed. No WebGL.

If you believe an interface is wrong, propose a change in OPS_LOG **before**
building against it.

---

## 8. Definition of done + evidence format

A stream is done only when **all** of these are true and pasted as evidence:

1. Branch pushed; PR opened against `main` with a plain summary.
2. `node tests/engine.test.js` → raw pass/fail line.
3. `node scripts/visual-regression.cjs` → raw `pass= fail= error=` line, and if
   you re-baselined, the reason.
4. Any new debug artefact committed under `docs/research/`.
5. `docs/checkpoints/P<n>.md` written (research → design → result).
6. OPS_LOG line appended (§9).
7. The human, or the ThinkPad, can reproduce your numbers from your pasted
   commands.

**Evidence format (paste the command and its real output, never a paraphrase):**
```
$ node tests/engine.test.js
Passed: 53   Failed: 0
```

---

## 9. Communication protocol

Append **one dated line** to the shared operations ledger (Syncthing,
near-real-time). It is a symlink — append with `>>`, never overwrite:

```bash
printf '%s\n' "[$(date '+%Y-%m-%d %H:%M %Z')] MAC: WWW_PAINT M1 wetsim — <what shipped>. COMMIT <sha> on machine/mac/wetsim (PR #n). VERIFIED (my own runs): node tests/engine.test.js 53/53; node scripts/visual-regression.cjs pass=9 fail=0 error=0; new tests/wetsim.test.js 6/6. Docs: docs/checkpoints/P3.md. NOTHING DELETED. [SIGNED: Hermes | <model>]" >> "$OPS_LOG"
```

Rules: no second-person chatter in the ledger; facts + evidence only; one line;
`NOTHING DELETED` stated explicitly; preface cross-checks with `[VERIFY]`.

If you hit a blocker you cannot resolve, append a line starting
`[MAC] BLOCKED:` with the exact error and stop that stream — do not thrash.

---

## 10. Read these before you code

| Doc | Why |
|---|---|
| `docs/ROADMAP.md` | The living brief; §8 is the per-phase protocol |
| `docs/ROADMAP_STATUS.md` | What is done; do not redo it |
| `docs/CLEANROOM.md` | The engine-of-record decision + Track R |
| `docs/REFERENCES.md` | Every paper/library you may draw ideas from |
| `docs/STYLE_PROFILE.md` | The Style Profile schema (Phase 4) |
| `docs/UI_CONTROLS.md` | Existing control reference + the two structure impls |
| `docs/AI_STYLE_HARNESS.md` | The eval loop (context for metrics) |
| `docs/ARCHITECTURE.md` | Original design |
| `docs/WORKSPLIT.md` | The two-machine ownership map |

---

## 11. Suggested order

1. **M4 setup** — get the tests + visual regression running on the Mac *first*.
   You cannot verify anything until this works.
2. **M1** — wet media (biggest, self-contained).
3. **M2** — masks (+ layer UI as far as ownership allows).
4. **M3** — brush/water media (touches the baselines; do it when M4 is solid).

Report back to the human after each stream, not in one lump at the end.

Signed-off-by: Hermes / BE (ThinkPad)
