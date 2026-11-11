# AGENTS.md — WWW_PAINT (project 20.36)

**Canonical path:** `/Users/AIR2K/Data/20_Projects/20.36_WWW_PAINT`
**Repo:** `github.com/sudo-prog/www-paint` · **Live:** https://www-paint.pages.dev/
**Stack:** static ES modules, **no build step**, no `package.json` — everything runs via plain `node`.

This file is the entry point for any coding agent working in this repo. It
records who owns what, where the logs are, and what has already shipped so
nobody redoes it.

---

## 1. Two machines, one repo

| Machine | Agent | Role |
|---|---|---|
| **ThinkPad (BE)** | Hermes / BE | Control host. Owns the engine spine. |
| **Mac (FE)** | AIR HERMES (`~/.hermes/profiles/air-hermes/`) | This machine. File-isolated streams. |

`HANDOFF.md` is the Mac-side engineering brief. `docs/WORKSPLIT.md` is the
ownership map. Read both before writing code.

### The one hard rule

> **One writer per file at any time.**

### File ownership (full lists in `HANDOFF.md` §6)

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

**Mac-owned:** `js/engine/wetsim.js`, `js/engine/masks.js`, `js/ui/layers.js`,
`js/engine/brush-stamp-engine.js`, `js/styles/*`, `tests/wetsim.test.js`,
`docs/checkpoints/P*.md`, `docs/research/*`, `HANDOFF.md`, `AGENTS.md`.

**Shared — propose via OPS_LOG, do not edit:** `js/ui/controls.js`,
`js/ui/app.js`, `docs/ROADMAP_STATUS.md`.

---

## 2. Where the logs are (read this before reporting)

| Log | Path | Who writes |
|---|---|---|
| **OPS_LOG** | `~/SyncthingAutoAccept/OPS_LOG/OPS_LOG.md` (synced, append-only with `>>`) | Both machines. One dated line per event. |
| **MAC_LOG** | `~/Documents/Obsidian Vault/MAC_LOG/MAC_LOG.md` (synced copy at `~/SyncthingAutoAccept/MAC_LOG/MAC_LOG.md`) | Mac only. |

`OPS_LOG.md` is a **symlink** — append with `>>`, never overwrite, never
`write_file`. Prefix Mac lines with `MAC:`, cross-checks with `[VERIFY]`,
blockers with `[MAC] BLOCKED:`.

---

## 3. Commands (from the repo root)

```bash
# Unit tests — expect 52/52 on current main (47 before Track R2 landed)
node tests/engine.test.js

# Wet-sim tests (Mac M1) — expect 15/15
node tests/wetsim.test.js

# Visual regression — expect pass=9 fail=0 error=0
NODE_PATH=<playwright-core parent dir> node scripts/visual-regression.cjs
NODE_PATH=<...> node scripts/visual-regression.cjs --styles=watercolor,ink   # subset

# Parity bench (modular engine vs the app painter)
NODE_PATH=<...> node scripts/parity-bench.cjs

# Debug maps
NODE_PATH=<...> node scripts/structure-debug.cjs
NODE_PATH=<...> node scripts/wetsim-debug.cjs
```

**`playwright-core` is not in the repo.** On macOS:

```bash
npx playwright install chromium     # lands in ~/Library/Caches/ms-playwright
export NODE_PATH=<dir containing playwright-core>
```

### macOS gotcha — Chromium path

`scripts/visual-regression.cjs` `findChromium()` only probes
`~/.cache/ms-playwright/chromium-*/chrome-linux64/chrome`. On macOS Chromium
lives in `~/Library/Caches/ms-playwright/chromium-*/chrome-mac-x64/…`. A shell
shim is installed at `~/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome`
that execs the real binary, so the harness runs unchanged:

```bash
mkdir -p ~/.cache/ms-playwright/chromium-1248/chrome-linux64
printf '#!/bin/sh\nexec "/Users/AIR2K/Library/Caches/ms-playwright/chromium-1248/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing" "$@"\n' \
  > ~/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome
chmod +x ~/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome
```

Do **not** try to symlink or copy the `.app` bundle — the macOS binary resolves
its Frameworks relative to the executable's real path and aborts otherwise.

---

## 4. Known gotchas

- **`index.maestro.html` loads a prebuilt bundle.** `index.html` loads
  `js/ui/app.js` source directly (edits are live); `index.maestro.html` loads
  `js/ui/bundle.js` (380 KB prebuilt). Editing `js/ui/*.js` does not change the
  maestro page unless the bundle is regenerated. **Test against `index.html`.**
- **`js/ui/app.bundle.js` is dead** — referenced by nothing. Do not edit it.
- **9 baseline styles are hash-pinned:** `pencil ink watercolor oil charcoal
  marker cross-hatch halftone graphic` at 256 px, seed `3047602159`, 700
  strokes. Re-baseline only for a verified, intended change, and say so.
- **Randomness must come from `rngFor`/`createRNG`** (`js/styles/base.js`,
  `js/utils/rng.js`) — never bare `Math.random()`.
- **Do not run git in a Syncthing mirror without `.git`.** This repo *does*
  have `.git`; a mirrored copy elsewhere may not. Check first.
- **`gh` CLI is unauthenticated on the Mac.** `git push` works over HTTPS via
  the keychain credential. To open a PR, use the GitHub REST API:

  ```bash
  TOKEN=$(printf "protocol=https\nhost=github.com\n\n" | git credential-osxkeychain get | sed -n 's/^password=//p')
  curl -s -X POST -H "Authorization: Bearer $TOKEN" \
    -H "Accept: application/vnd.github+json" \
    https://api.github.com/repos/sudo-prog/www-paint/pulls \
    -d '{"title":"…","head":"machine/mac/<stream>","base":"main","body":"…"}'
  ```

---

## 5. Session log — 2026-11-11 (Mac / AIR HERMES)

### Bootstrap

- Verified auth, cloned, branched `machine/mac/wetsim`.
- Baseline verified on a clean `origin/main` worktree (`7562af8`):
  `node tests/engine.test.js` → **47/47**;
  `node scripts/visual-regression.cjs` → **pass=9 fail=0 error=0**.
- Fixed the macOS Chromium path (see §3) so the visual harness runs here.
- Noted: the Syncthing project folder was 19 commits behind `origin/main` with
  64 dirty files — those are the **ThinkPad's** uncommitted changes and were
  left untouched.

### M1 — Phase 3 wet-media simulation — **SHIPPED**

- `js/engine/wetsim.js` (NEW) — wetness + paper height + mobile/fixed pigment
  on a seeded grid; `deposit`/`dry`/`compositeInto` per the frozen IF-2
  interface. Pure 2D typed arrays, no WebGL/DOM, one dependency
  (`js/utils/rng.js`).
- `tests/wetsim.test.js` (NEW) — 15/15 pass.
- `docs/checkpoints/P3.md` (NEW) — research → design → result.
- `docs/research/wetsim-debug.png`, `scripts/wetsim-debug.cjs`,
  `tests/visual/wetsim-debug.html` (NEW) — debug visual, structure-debug pattern.
- **Commit `04ed927` on `machine/mac/wetsim` → PR #1**
  (https://github.com/sudo-prog/www-paint/pull/1), open, mergeable.
- **Evidence:**
  ```
  $ node tests/engine.test.js          -> Passed: 47  Failed: 0
  $ node tests/wetsim.test.js          -> Passed: 15  Failed: 0
  $ node scripts/visual-regression.cjs -> pass=9 fail=0 error=0 total=9
  ```
  Mass conservation drift **-2.97e-8** over 40 s with transport enabled;
  frame fully dry at 15 s. Browser `compositeInto` probe: 2339 px changed
  (1457 red-dominant), no page errors.
- **`renderer.js` untouched** (ThinkPad-owned). Integration contract is in the
  `wetsim.js` header: one call in `renderLayer()`, construct at render-target
  size.
- **IF-2 deviation:** the paper-height field is exported as `paperHeight`
  (the grid dimension is already `height`); `compositeInto` throws on a
  canvas/grid size mismatch rather than silently resizing.
- **No existing style changed**, so the 9 pinned baselines did not move.
- **NOTHING DELETED.**

### Bugs found and fixed during M1 (worth remembering)

1. `cov(0) === 0` — a multiplicative mobile×fixed stack zeroed every fresh,
   still-wet wash. Fixed to an additive stack.
2. Pigment stored as raw channel values absorbed the *complement* of the
   intended colour. Real paint absorbs its complement; fixed by storing
   `1 - channel/255`.
3. **Assertions passed throughout both bugs.** Only vision review of the
   rendered PNG caught them. Never trust a green test suite as proof a render
   is correct — screenshot it.

### Files in the project folder now

All six M1 files were copied into
`/Users/AIR2K/Data/20_Projects/20.36_WWW_PAINT/` and verified byte-identical
to the committed blobs. Nothing already in the repo was moved or overwritten.

### Next

- **M2** — Phase 2.1 tonal masks + 2.3 layer panel UI (branch
  `machine/mac/masks`). Not started.
- **M3** — Phases 1.1 + 1.6 brush media and water/ink unification. Not started.
- **M4** — independent QA seat. Standing role; no source edits.
- Awaiting ThinkPad review of PR #1 before touching `renderer.js`.

---

## 6. Reading list

| Doc | Why |
|---|---|
| `HANDOFF.md` | The Mac-side brief (streams, exit criteria, reporting) |
| `docs/WORKSPLIT.md` | Two-machine ownership map + branch protocol |
| `docs/ROADMAP_STATUS.md` | What is done — do not redo it |
| `docs/CLEANROOM.md` | The engine-of-record decision + Track R |
| `docs/REFERENCES.md` | Every paper/library you may draw ideas from |
| `docs/UI_CONTROLS.md` | Existing control reference |
| `docs/STYLE_PROFILE.md` | The Style Profile schema (Phase 4) |
| `docs/checkpoints/` | Per-phase research → design → result notes |

---

**Governing principle:** *Inspired by the technique, never copied from the
source.* Ideas come from the papers in `docs/REFERENCES.md`; write your own
expression of them.
