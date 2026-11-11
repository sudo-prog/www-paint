# WWW_PAINT — Work Split (ThinkPad/BE ⟷ Mac/FE)

**Date:** 2026-11-11 · Agents: BE (ThinkPad, control host) + Mac Hermes (FE)
**Baseline:** `sudo-prog/www-paint@main`, working tree clean, remote == local.
**Companion:** `HANDOFF.md` (the executable brief handed to Mac Hermes).

---

## 1. Why split, and what it cannot fix

The remaining roadmap is dominated by **Track R** (R2→R3→R4→R6), a strictly
serial chain that edits the same three hot files (`optimizer.js`,
`generator.js`, `analyzer.js`) plus `engine.js`/`app.js` wiring. Two machines on
those files produces merge churn, not speed.

So the split does **not** shorten the critical path. It buys parallelism on the
**peripheral, file-isolated** work (wet media, brush/style media, tonal masks +
layer UI, independent QA). Honest expectation: roughly 2× on non-spine work,
unchanged on the spine.

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
  1.5 smudge + height    renderer.js
  4.1 profile->engine    engine.js, generator.js
  H1-H5 AI loop          harness + AI services + docs/AI_STYLE_HARNESS.md
  Track B/C + CI         INTEGRATION_STRATEGY.md, .github/, vault

PARALLEL — Mac/FE (disjoint new files, zero spine contact)
  M1  Phase 3 wet media   js/engine/wetsim.js (NEW) + wet styles
  M2  2.1 masks + 2.3 UI  js/engine/masks.js (NEW) + js/ui/layers.js
  M3  1.1 brush + 1.6 ink brush-stamp-engine.js vendor/brush.esm.js
                          js/styles/watercolor.js ink.js wash.js sumi.js
  M4  independent QA      scripts/*.cjs runs against main (no source edits)
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

## 5. Integration protocol — Syncthing hand-in; ThinkPad is the SOLE pusher

- **One GitHub writer.** Only the **ThinkPad/BE** runs git and pushes. GitHub
  `main` is the single history. The Mac **never** clones, branches, commits or
  pushes — that is what prevents divergent histories and merge conflicts.
- **The Mac works in the Syncthing mirror.** The `projects` folder syncs
  `20_Projects` between the two machines (`.git` / `node_modules` excluded), so the
  Mac edits files in its own copy of `20.36_WWW_PAINT`; those edits land in the
  ThinkPad's working tree in near-real-time. There is **no `.git`** on the Mac
  side — the Mac must not run git there.
- **Flow:** Mac edits files → Syncthing delivers them to the ThinkPad → **BE
  verifies** (unit tests + visual regression + parity bench against the delivered
  files) → BE commits **explicit paths** (`feat(...)`) → BE pushes to `main`.
- **Never `git add -A`**, and **never `git checkout -- .` / `git reset --hard`**
  in the synced tree: the first sweeps the other machine's delivered files into
  your commit, the second silently destroys them. Add explicit paths only.
- Before starting work (ThinkPad only): `git fetch origin && git checkout main &&
  git pull`.

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
Phase 1.3 multi-scale ........... DONE (R2, BE)
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
Track R3-R6 ..................... TP
Track B/C integration ........... TP
QA / verification ............... MAC (M4)
```

**Live Mac task list (updated 2026-11-12):** `docs/MAC-TASKS.md` — the ordered,
file-isolated FE streams (hand-in → M6b QA → M7 library UI → M8 export UI →
M9 style polish → M10 a11y/responsive → M11 docs).

## 9. Open risks — need a user decision

1. **Syncthing mirrors the working tree — RESOLVED (2026-11-11, user decision):
   keep the mirror; it is the integration channel.** The `projects` folder syncs
   `20_Projects` with `.git`/`node_modules` excluded, so the Mac's edited files
   appear in the ThinkPad's working tree. Mitigation is the ownership map (§2/§6,
   one writer per file) plus the sole-pusher rule (§5): the Mac never runs git,
   **BE verifies the delivered files and pushes**.
2. **Mac QA environment.** The M4 seat needs `playwright-core` + Chromium on the
   Mac (the ThinkPad points `NODE_PATH` at its Hermes install). Verify before Mac
   claims a green regression.
