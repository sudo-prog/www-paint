# HANDOFF — WWW_PAINT engineering brief for Mac Hermes (project 20.36)

**From:** Hermes / BE — ThinkPad (control host)
**To:** Hermes / Mac (FE)
**Date:** 2026-11-11
**Baseline:** `sudo-prog/www-paint@main`, clean, remote == local.
**Companion:** `docs/WORKSPLIT.md` (two-machine ownership map).

You are being handed **four parallel workstreams**. The ThinkPad keeps the engine
spine; you take the file-isolated work. Read this whole document before writing
any code, then read the in-repo docs it points to (§10).

---

## 0. Start here

Do these in order. Do not skip step 1 — you cannot verify anything until it works.

1. **Do not clone, branch, commit or push.** Work in your **Syncthing-synced
   copy** of the `projects` folder (§4). The ThinkPad is the **only** machine
   that pushes to GitHub (§2). Your edits reach it via Syncthing; BE verifies
   them and pushes.
2. **Get the checks green on your machine**: `node tests/engine.test.js` →
   `52/52`; `node scripts/visual-regression.cjs` → `pass=9 fail=0 error=0`.
   If these do not match, stop and report — do not start feature work on a
   broken baseline.
3. **Read** `docs/ROADMAP_STATUS.md` (what is done) and `docs/CLEANROOM.md`.
4. **Claim one stream** (§5) and work it to its exit criteria before starting
   another.

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

- **`js/engine/painter.js`** — the auto-painter the app paints with today. Slated
  to be superseded at milestone R6.
- **The modular engine** (`analyzer.js` + `generator.js` + `optimizer.js` +
  `scorer.js` + `renderer.js`) — **the engine of record**. Track R (R0–R6) exists
  to bring it to production quality and switch the app over to it.

**The governing principle:**
> Inspired by the *technique*, never copied from the *source*.

Work from the published literature (Hertzmann 1998, structure-tensor SBR, Image
Painter CCL+PCA, Birth of a Painting smudge — all cited in `docs/REFERENCES.md`).
Never translate another implementation and call it ours.

---

## 2. Hard rules (non-negotiable)

> **⚠ Integration model (2026-11-11): the ThinkPad is the SOLE GitHub writer.**
> Work only in your **Syncthing-synced** copy of the `projects` folder. **Never**
> clone, `git init`, branch, commit or push — there is no `.git` on your side and
> creating one makes a second, divergent history. Your edited files sync to the
> ThinkPad automatically; **BE verifies them and pushes to `main`.** Full protocol:
> `docs/WORKSPLIT.md` §5.

1. **One writer per file.** Never edit a file listed as ThinkPad-owned in §6.
2. **Never delete any file** without explicit per-instance approval from the human.
3. **Do not touch the engine spine** — `optimizer.js`, `generator.js`,
   `analyzer.js`, `engine.js`, `painter.js`, `scorer.js`, `js/ui/controls.js`,
   `js/ui/app.js`. Need a change there? Write an OPS_LOG note; the ThinkPad makes it.
4. **Never re-baseline to silence a red test.** `--update` only for a *verified,
   intended* output change, stated in the commit message and OPS_LOG.
5. **Determinism.** Any new option must default so output is **byte-identical** to
   previous behaviour, then opt in. Prove it with the visual regression.
6. **No new dependency on the check path** unless agreed — the project
   deliberately has no build step.
7. **Never trust a self-report** (yours, a sub-agent's, or a prior summary's).
   Re-run the command and paste raw output.
8. **Never copy code from an external implementation.** Ideas come from the
   papers in `docs/REFERENCES.md`; write your own expression of them.

---

## 3. Already done — do not redo

| Milestone | What exists | Evidence |
|---|---|---|
| Phase 0 | Style Profile schema, visual regression harness (9 committed baselines), style inventory (51 styles) | `docs/STYLE_PROFILE.md`, `docs/STYLE_INVENTORY.md`, `scripts/visual-regression.cjs` |
| Phase 1.2 | Structure tensor (`analyzer.computeStructureTensor` / `sampleStructure` / `structureDebugRGBA`) + `generator.alignToStructure` + the UI STRUCTURE controls | `docs/checkpoints/P1.md`, `docs/UI_CONTROLS.md` |
| Track R0 | Parity harness + recorded baseline gap | `scripts/parity-bench.cjs`, `docs/research/parity/baseline.json` |
| Track R1 | Optimiser core (`js/engine/optimizer.js`) — beats R0 on all 4 bench images | `docs/checkpoints/R1.md` |
| Track R2 | Structure-guided multi-scale (coarse→fine optimiser; `scales:3` default) — both metrics up on every structured image | `docs/checkpoints/R2.md` |
| Harness H0 | Eval harness: 4 images, independent MAE + block-SSIM | `docs/AI_STYLE_HARNESS.md` |

Current green state: **52/52** unit + **9/9** visual regression + 4 parity images.
`docs/ROADMAP_STATUS.md` is the live source of truth.

---

## 4. Workspace and commands

### Work in your Syncthing copy — no git

The `projects` folder syncs the ThinkPad's working tree to you **without `.git`**.
Edit `20.36_WWW_PAINT` **in place** there. Do **not** clone it and do **not** run
git (there is no `.git`; a clone would create a second, conflicting copy). Your
edits sync back to the ThinkPad automatically — BE verifies them and pushes to
GitHub.

Before working, confirm Syncthing is running on your machine and the
`20.36_WWW_PAINT` files are present:

### Commands (all from the repo root)

```bash
# Unit tests — expect 47/47
node tests/engine.test.js

# Visual regression — expect pass=9 fail=0 error=0
#   needs playwright-core + Chromium; point NODE_PATH at any install that has it
NODE_PATH=<your playwright-core parent dir> node scripts/visual-regression.cjs
NODE_PATH=<...> node scripts/visual-regression.cjs --styles=watercolor,ink   # subset

# Parity bench (modular engine vs the app painter) — writes baseline.json
NODE_PATH=<...> node scripts/parity-bench.cjs

# Structure-tensor debug map
NODE_PATH=<...> node scripts/structure-debug.cjs
```

`playwright-core` is **not** in the repo. On macOS install Chromium once:
`npx playwright install chromium` (lands in `~/.cache/ms-playwright`), or point
`NODE_PATH` at any existing install.

### Known gotchas

- **The maestro page uses a prebuilt bundle.** `index.html` loads
  `js/ui/app.js` source directly (edits are live), but `index.maestro.html`
  loads `js/ui/bundle.js` — a 380 KB prebuilt bundle. Editing `js/ui/*.js` does
  **not** change the maestro page unless the bundle is regenerated. Test against
  `index.html`.
- **`js/ui/app.bundle.js` is dead** — referenced by nothing. Do not edit it.
- **9 baseline styles** are hash-pinned: `pencil ink watercolor oil charcoal
  marker cross-hatch halftone graphic` at 256 px, seed `3047602159`, 700 strokes.
  Editing any of them moves the baselines (intended in M3 — see §5).
- **Texture/geometry randomness is seeded** via `rngFor` in `js/styles/base.js`.
  New randomness must come from a seeded RNG, never bare `Math.random()`.

---

## 5. Your four streams

One stream = one set of files = one hand-in. Finish a stream before starting
another, and do not run two streams that touch the same file. When a stream is
done, leave the files in the Syncthing folder and post the OPS_LOG line (§9) — the
ThinkPad picks up the synced files, verifies them, and pushes.

### M1 — Phase 3: wet-media simulation  *(new module, biggest win)*

**Goal:** a lightweight wetness/pigment model so watercolor and ink can bleed,
pool and dry. Ideas from public sources only — [inkwash](https://github.com/johnowhitaker/inkwash),
[watercolor-playground](https://github.com/msurguy/watercolor-playground),
[dli/paint](https://github.com/dli/paint). Write your own code.

**Deliverables**
- `js/engine/wetsim.js` — NEW, implementing **IF-2** (§7). Pure 2D canvas +
  typed arrays. No WebGL, no DOM beyond a 2D context.
- Node-testable on plain buffers: assert (a) determinism under a fixed seed and
  (b) pigment mass conserved on a dry frame. Put your tests in a NEW file
  `tests/wetsim.test.js` (not the shared `tests/engine.test.js`).
- Design note `docs/checkpoints/P3.md` (research → design → result).
- Wire-in is **the ThinkPad's job** — leave a `// TODO(integration)` comment with
  the exact call you expect in `renderer.js`.

**Exit criteria**
- [ ] Deterministic under a fixed seed.
- [ ] Pigment mass conserved on dry frames.
- [ ] Own test file passes; `node tests/engine.test.js` still 47/47.
- [ ] `docs/checkpoints/P3.md` written.
- [ ] Integratable with one call from `renderer.js`.

### M2 — Phase 2.1 tonal masks + 2.3 layer panel UI

**Goal A — masks:** soft tonal masks (background / shadows / midtones /
highlights) in a NEW `js/engine/masks.js` implementing **IF-1** (§7).
Node-testable, additive, consuming an existing `analyzeImage()` result
(`analysis.luminance` is a `Uint8ClampedArray` — see `js/engine/analyzer.js`).
Plus a debug visual `docs/research/tonal-masks.png` (pattern:
`scripts/structure-debug.cjs`).

**Goal B — layer panel:** `js/ui/layers.js` already contains a `LayersManager`.
Verify whether it is actually wired into `js/ui/app.js`, then make the panel work
end-to-end (visibility, opacity, blend, style, regenerate layer). If wiring needs
an edit to `js/ui/app.js` or `js/ui/controls.js`, **stop and raise it via
OPS_LOG** — those are ThinkPad-owned.

**Exit criteria**
- [ ] Masks visualisable with coverage stats summing to ~1.
- [ ] `docs/research/tonal-masks.png` committed.
- [ ] Each layer-panel control provably changes rendered output in a real
      headless browser (DOM assertion **and** a behavioural check).
- [ ] `docs/checkpoints/P2.md` written.

### M3 — Phases 1.1 + 1.6: brush media and water/ink unification

**Goal:** (1.1) harden the vendored p5.brush integration — tips, pressure,
scatter, grain, hatch fills, vector fields — so ≥8 styles use the enhanced stamp
path **with a working fallback**; (1.6) unify watercolor/ink parameters and
strengthen bleed/texture controls.

**Files you own:** `js/engine/brush-stamp-engine.js`, `js/vendor/brush.esm.js`
(re-vendor only if genuinely incomplete — record the upstream commit),
`js/styles/watercolor.js`, `ink.js`, `wash.js`, `sumi.js`, plus any style file
**not** on the do-not-touch list (§6).

**⚠ Baselines:** `watercolor` and `ink` are two of the 9 pinned styles. Improving
them **will** change their hashes — that is an intended change. Re-baseline
deliberately with `--update` and state in the commit: *"intended output change:
watercolor/ink improved for 1.6; baselines re-baselined"*.

**Exit criteria**
- [ ] ≥8 styles use the enhanced stamp path.
- [ ] Fallback proven — force the vendored import to fail and confirm the canvas
      path still renders.
- [ ] Before/after PNGs in `docs/research/`.
- [ ] Baselines re-baselined **and** the reason recorded.

### M4 — independent QA seat

Standing role. After any ThinkPad push, verify `main` **independently** — never
trust a summary. M4 makes **no source edits**; its output is evidence, not commits.

- `node tests/engine.test.js` → paste the raw summary line.
- `NODE_PATH=<...> node scripts/visual-regression.cjs` → paste `pass= fail= error=`.
- `NODE_PATH=<...> node scripts/parity-bench.cjs` → paste the per-image
  simMae/SSIM table.
- Launch a real headless browser against `index.html`, click the affected
  control, assert it changes output. Screenshot to `docs/research/qa-<topic>.png`.
- Disagreement with a ThinkPad claim → OPS_LOG line
  `[MAC] [VERIFY] <claim> — DISAGREE: <evidence>`.

---

## 6. File ownership

**ThinkPad-owned — never edit:**
```
js/engine/optimizer.js        js/engine/generator.js
js/engine/analyzer.js         js/engine/engine.js
js/engine/painter.js          js/engine/scorer.js
js/engine/renderer.js         js/engine/relief.js
js/ui/controls.js             js/ui/app.js
tests/engine.test.js          scripts/parity-bench.cjs
scripts/visual-regression.cjs tests/parity/harness.html
docs/CLEANROOM.md  docs/ROADMAP.md  docs/ROADMAP_STATUS.md
docs/AI_STYLE_HARNESS.md  docs/STYLE_PROFILE.md  .github/**
```
**Mac-owned — your streams:**
```
js/engine/wetsim.js (new)     js/engine/masks.js (new)
js/ui/layers.js               js/engine/brush-stamp-engine.js
js/styles/*  (except what the ThinkPad is actively on)
tests/wetsim.test.js (new)    docs/checkpoints/P2.md P3.md
docs/research/* (your artefacts)
```
**Shared — propose via OPS_LOG, do not edit:** `js/ui/controls.js`,
`js/ui/app.js`, `docs/ROADMAP_STATUS.md`.

---

## 7. Frozen interfaces

**IF-1 — `masks.js` (M2)**
```js
export function computeTonalMasks(analysis, opts = {}) {
  return {
    width, height,
    masks: { background, shadows, midtones, highlights }, // Float32Array, 0..1
    coverage: { background: 0.41, shadows: 0.22, midtones: 0.25, highlights: 0.12 },
    threshold: { lo: 85, hi: 170 }
  };
}
```
Additive only; must not require a DOM.

**IF-2 — `wetsim.js` (M1)**
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

If you think an interface is wrong, propose the change in OPS_LOG **before**
building against it.

---

## 8. Definition of done

A stream is done only when **all** of these are true, and pasted as evidence:

1. Files left in the Syncthing folder (they reach the ThinkPad automatically) and
   an OPS_LOG line posted (§9). **No branch, no PR** — BE verifies and pushes.
2. `node tests/engine.test.js` → raw pass/fail line.
3. `node scripts/visual-regression.cjs` → raw `pass= fail= error=` line, with the
   re-baseline reason if you re-baselined.
4. New artefacts committed under `docs/research/`.
5. `docs/checkpoints/P<n>.md` written (research → design → result).
6. OPS_LOG line appended (§9).
7. The human or the ThinkPad can reproduce your numbers from your pasted commands.

**Evidence format — the command and its real output, never a paraphrase:**
```
$ node tests/engine.test.js
Passed: 47   Failed: 0
```

---

## 9. Reporting

Append **one dated line** to the shared operations ledger (Syncthing,
near-real-time). It is a symlink — append with `>>`, never overwrite:

```bash
printf '%s\n' "[$(date '+%Y-%m-%d %H:%M %Z')] MAC: WWW_PAINT M1 wetsim — <what shipped>. FILES (delivered via Syncthing; BE to verify+push): js/engine/wetsim.js tests/wetsim.test.js docs/checkpoints/P3.md. VERIFIED (my own runs): node tests/engine.test.js 52/52; node scripts/visual-regression.cjs pass=9 fail=0 error=0; tests/wetsim.test.js 6/6. NOTHING DELETED. [SIGNED: Hermes | <model>]" >> "$OPS_LOG"
```

Facts + evidence only; one line; state `NOTHING DELETED` explicitly; prefix
cross-checks with `[VERIFY]`. A blocker you cannot resolve → append a line
starting `[MAC] BLOCKED:` with the exact error, and stop that stream rather than
thrash.

---

## 10. Reading list

| Doc | Why |
|---|---|
| `docs/ROADMAP.md` | The living brief; §8 is the per-phase protocol |
| `docs/ROADMAP_STATUS.md` | What is done — do not redo it |
| `docs/CLEANROOM.md` | The engine-of-record decision + Track R |
| `docs/REFERENCES.md` | Every paper/library you may draw ideas from |
| `docs/STYLE_PROFILE.md` | The Style Profile schema (Phase 4) |
| `docs/UI_CONTROLS.md` | Existing control reference + the two structure impls |
| `docs/AI_STYLE_HARNESS.md` | The eval loop (context for the metrics) |
| `docs/ARCHITECTURE.md` | Original design |
| `docs/WORKSPLIT.md` | The two-machine ownership map |

Report back to the human after **each** stream, not in one lump at the end.

---

## 11. Appendix — open items awaiting human sign-off

Not your work yet. Do not action these without explicit approval; two are
deletions or renames, which need per-instance consent.

1. `RE_BREAKDOWN.md` — the reverse-engineering study. Currently the only record of
   the project's lineage.
2. `scripts/codepainter-worker.js` + `scripts/codepainter-shp.js` — reference
   fixtures loaded by the parity harness; the filenames carry a vendor name.
3. `visual-smoke-test.html` + `scripts/visual-smoke-test.cjs` — a side-by-side
   comparison tool.
4. `js/ui/app.bundle.js` — a dead build artifact (§4); needs a rebuild or removal.

---

Signed-off-by: Hermes / BE — ThinkPad
