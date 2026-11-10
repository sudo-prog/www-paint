# WWW_PAINT — Work Split (ThinkPad/BE ⟷ Mac/FE)

**Date:** 2026-11-11 · Agents: BE (ThinkPad, control host) + Mac Hermes (FE)
**Baseline:** `sudo-prog/www-paint@main` == `10de509`, working tree clean, remote == local.
**Companion:** `HANDOFF.md` (the executable brief handed to Mac Hermes).

---

## 1. Why split, and what it cannot fix

The remaining roadmap is dominated by **Track R** (R2→R3→R4→R6), a strictly
serial chain that edits the same three hot files (`optimizer.js`,
`generator.js`, `analyzer.js`) plus `engine.js`/`app.js` wiring. Two machines on
those files produces merge churn, not speed.

So the split does **not** shorten the critical path. It buys parallelism on the
**peripheral, file-isolated** work (wet media, brush/style media, tonal masks +
layer UI, licence audit, independent QA). Honest expectation: roughly 2× on
non-spine work, unchanged on the spine.

The spine therefore stays **single-writer on the ThinkPad**.

---

## 2. The one hard rule

> **One writer per file at any time.**

A file is owned by exactly one machine for the duration of a stream. Cross-owner
edits go through a PR that the other machine reviews. No exceptions — this is
what prevents Syncthing conflict-copies and git merge pain.

---

## 3. Ownership map

```
SPINE — ThinkPad/BE (serial, single writer)
  R2 -> R3 -> R4 -> R6   optimizer.js generator.js analyzer.js engine.js app.js
  1.5 smudge + height    renderer.js (+ relief re-derivation)
  4.1 profile->engine    engine.js, generator.js
  H1-H5 AI loop          harness + AI services + docs/AI_STYLE_HARNESS.md
  Track B/C + CI         INTEGRATION_STRATEGY.md, .github/, vault

PARALLEL — Mac/FE (disjoint new files, zero spine contact)
  M1  Phase 3 wet media   js/engine/wetsim.js (NEW) + wet styles
  M2  2.1 masks + 2.3 UI  js/engine/masks.js (NEW) + js/ui/layers.js
  M3  1.1 brush + 1.6 ink brush-stamp-engine.js vendor/brush.esm.js
                          js/styles/watercolor.js ink.js wash.js sumi.js
  M4  licence audit       read-only audit + js/engine/relief.js re-derivation
  M5  independent QA      scripts/*.cjs runs against main (no source edits)
```

`js/ui/controls.js` and `js/ui/app.js` are **shared** (both machines want them).
Change control: see §6.

---

## 4. Frozen interfaces (must be agreed before parallel start)

Both interfaces are new-file APIs; freeze the *shape*, then each side codes to it.

**IF-1 `masks.js` (Mac writes, BE consumes in 2.2):**
```
export function computeTonalMasks(analysis, opts) -> {
  width, height,
  masks: { background, shadows, midtones, highlights },  // Float32Array, 0..1
  coverage: { background:0.41, shadows:0.22, ... },       // fractions, sum ~= 1
  threshold: { lo: 85, hi: 170 }                          // luminance band edges
}
```
Additive only. Must be node-testable on a plain pixel buffer (no DOM), like
`optimizer.js`.

**IF-2 `wetsim.js` (Mac writes, BE integrates in the renderer):**
```
export function createWetSim(width, height, opts) -> {
  wetness: Float32Array, height: Float32Array,
  deposit(x, y, radius, color, opts),  dry(dt),  // advance drying
  compositeInto(ctx)                              // draw pigment to a 2D context
}
```
Pure 2D canvas; **no WebGL**, no DOM beyond a canvas 2D context. BE adds the
single call site in `renderer.js` after 1.5 lands.

---

## 5. Branch & merge protocol

- GitHub is the **only integration point**. Both machines keep their own clone;
  Syncthing never carries `.git` (already excluded in `Data/20_Projects/.stignore`).
- Branches: `machine/thinkpad/<stream>` and `machine/mac/<stream>`.
- Flow: branch → commit (`feat(...)`) → push → PR → other machine reviews →
  squash-merge to `main`.
- Never `git add -A`. Add explicit paths only (a Syncthing-mirrored file from the
  other machine must never be swept into your commit).
- Before starting work: `git fetch origin && git checkout main && git pull`.

## 6. Shared-file change control

Shared files: `js/ui/controls.js`, `js/ui/app.js`, `js/engine/engine.js`,
`tests/engine.test.js`, `scripts/*.cjs`, `tests/parity/harness.html`.

- Only the owner named in §3 edits these, one PR at a time.
- A second machine that needs a change **opens an issue-style note in OPS_LOG**;
  the owner makes the edit.
- Any change to `engine.js`, `renderer.js`, `analyzer.js`, `painter.js`, or the 9
  baseline styles (`pencil ink watercolor oil charcoal marker cross-hatch
  halftone graphic`) can move the visual baselines → run the regression and, if
  the change is intended, re-baseline deliberately with `--update` and say so.

## 7. Coordination channel

`OPS_LOG.md` (shared, Syncthing, near-real-time). One dated line per event,
append-only (`>>`, it is a symlink — never `write_file`). Tag `[TP]` or `[MAC]`.
State the stream, the commit, and the evidence command output.

## 8. Milestone → owner

```
Phase 1.1 p5.brush hardening ..... MAC (M3)
Phase 1.2 structure tensor ....... DONE (BE)
Phase 1.3 multi-scale ........... TP  (R2)
Phase 1.4 CCL+PCA init .......... TP  (R3)
Phase 1.5 smudge + height ....... TP
Phase 1.6 watercolor/ink unify ... MAC (M3)
Phase 2.1 tonal masks ........... MAC (M2)
Phase 2.2 layer-aware generation  TP
Phase 2.3 layer panel UI ........ MAC (M2)
Phase 3 wet media ............... MAC (M1)
Phase 4 Style Profile .......... TP (4.1) / MAC (4.2 UI, later)
Phase 5 AI loop ................. TP (H1-H5)
Phase 6 polish / export ......... TP
Track R2-R6 ..................... TP
Track B/C integration ........... TP
relief.js licence re-derivation . MAC (M4)
QA / verification ............... MAC (M5)
```

## 9. Open risks — need a user decision

1. **Syncthing mirrors the working tree.** The `projects` folder syncs
   `20_Projects` with `.git`/`node_modules` excluded, so each machine's *edited
   files* appear in the other's checkout. §2/§5/§6 make that survivable, but the
   clean fix is to add `20.36_WWW_PAINT` to `Data/20_Projects/.stignore` and
   integrate purely through GitHub. **Decision needed.**
2. **Licence scope is wider than CLEANROOM.md states.** `CLEANROOM.md` lists only
   `painter.js` + `scripts/codepainter-worker.js` as ported. In fact
   `js/engine/relief.js` declares itself a *faithful port of Code Painter
   v4.25.0* and is imported by **16 shipped styles**; `js/ui/app.bundle.js` (a
   committed artifact) also carries it. Several style modules use "faithful to
   Code Painter" wording. The clean-room claim currently covers the modular
   engine only. **Audit scoped as M4; needs sign-off on scope.**
3. **Mac QA environment.** The M5 seat needs `playwright-core` + Chromium on the
   Mac (the ThinkPad points `NODE_PATH` at its Hermes install). Verify before Mac
   claims a green regression.
