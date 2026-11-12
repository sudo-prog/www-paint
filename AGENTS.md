# AGENTS.md — WWW_PAINT (project 20.36)

**Canonical path:** `/Users/AIR2K/Data/20_Projects/20.36_WWW_PAINT`
**Repo:** `github.com/sudo-prog/www-paint` · **Live:** https://www-paint.pages.dev/
**Stack:** static ES modules, **no build step**, no `package.json` — everything runs via plain `node`.

This file is the entry point for any coding agent working in this repo. It
records who owns what, where the logs are, and what has already shipped so
nobody redoes it.

---

## ▶ ROUND 3 — START HERE (2026-11-12)

**Status:** M7/M8/M9 are **landed and BE-pushed** (`28e8933`) — verified
(engine 123/123, baselines 9/9 unmoved). BE also closed Track-S **S1**
(`js/engine/ref-analyze.js`, 16/16). Your next stream is **M10**.

You are **Mac Hermes, round 3**. Read these in order, then start:

1. **§8 below (authoritative list also in `docs/MAC-TASKS.md` §"Round 3")** — your
   task list (**M10–M16**), each with a frozen interface + exit criteria + the
   files you own. **M10 (Style library UI, Track-S S6) is the live front.**
2. **`HANDOFF.md` §2 (hard rules) + §6 (file ownership)** — never edit a
   ThinkPad-owned file; if you need a change there, raise it in `OPS_LOG` and BE
   makes it.
3. **`docs/ROADMAP_STATUS.md`** — what is already done; do **not** redo it.

For **every** turn:

- **Never run git** (§0.8). Edits reach the ThinkPad via **Syncthing**; **BE
  verifies and pushes** (BE is the sole GitHub writer). If a `.git` exists on
  your side, do not touch it.
- **Append one entry to §7** (progress log) each turn, and one `OPS_LOG` line per
  finished stream.

**Baseline you must match:** `main = 28e8933`, remote == local. Gates:
engine **123/123** · wetsim **15/15** · masks **19/19** · outlines **16/16** ·
order **24/24** · shaping **18/18** · ref-analyze **16/16** · visual regression
**9/9**.

---

## 0. ⚠ Open issues needing ThinkPad (BE) action

Raised by Mac/FE on 2026-11-11. **All seven are now FIXED in `origin/main`**
(verified 2026-11-12 against `2585cec` — see the per-item ✅ lines below). The
items are kept for their detail, not as open work.

**Still open on the Mac side:** defects 11–13 (media panel) are fixed in the
worktree and handed in for BE to verify + push — see §5e and
`docs/checkpoints/P2.5.md` §8–§9.

### 0.1 ~~BLOCKER~~ ✅ FIXED — `js/ui/app.js`: layer panel opens empty

`LayersManager` is constructed (app.js:103) but `setLayers()` is never called
at init, so the panel renders **zero rows** on a fresh page. The engine has two
default layers; the manager's list stays empty until an add/delete/duplicate
fires.

**Fix** — after app.js:103:

```js
this.layers.setStyleOptions(
  this.engine._styleList.map(n => ({ value: n, label: n }))
);
this.layers.setLayers(this.engine.layers);
```

`engine._styleList` is populated by `_registerAllStyles()` (app.js:96).

### 0.2 ~~BLOCKER~~ ✅ FIXED — `js/ui/app.js`: two layer events unhandled

`layers.js` now emits `layer-style-change` and `layer-regenerate`; there are no
handlers, so both controls are inert.

**Fix** — alongside the existing layer handlers:

```js
this.layers.root.addEventListener("layer-style-change", (e) => {
  const layer = this.engine.getLayer(e.detail.layerId);
  if (!layer) return;
  layer.style = e.detail.style;
  if (layer.strokes.length) this.engine.render();
});

this.layers.root.addEventListener("layer-regenerate", async (e) => {
  const layer = this.engine.getLayer(e.detail.layerId);
  if (!layer) return;
  const style = layer.style || this.engine.settings.style || "pencil";
  const seed = (this.engine._seed || 1) + layer.id;
  const shapes = await this.engine.generate({
    style, layer: layer.id, seed,
    count: this.engine.settings.strokeCount,
  });
  layer.strokes = shapes;
  this.engine.render();
  this.layers.setLayers(this.engine.layers);
});
```

`engine.generate()` already supports `{style, layer, seed, count}` — **no engine
change needed.** Full diff in `docs/checkpoints/P2.md` §2.4.

### 0.3 ~~BUG~~ ✅ FIXED — `js/engine/analyzer.js`: infinite hang on tiny images

`extractPalette()` k-means init:

```js
for (let c = 0; c < clusters; c++) {
  let idx;
  do { idx = Math.floor(rnd() * (data.length / 3)) * 3; }
  while (used.has(idx));      // ← never terminates
  used.add(idx);
}
```

With fewer than `paletteSize` (16) pixels there are not enough distinct
indices, so the `do/while` spins forever. **Reproduced: `analyzeImage()` on a
1×1 buffer hangs indefinitely** (verified by timeout, not inference).

Minimal fix: bail out when `data.length / 3 < clusters`, e.g. fall back to
`clusters = Math.min(k, Math.floor(data.length / 3))` or fill remaining
centroids by clamping the index.

### 0.4 ~~BUG~~ ✅ FIXED — `index.html:38`: malformed `<polyline>` (console error every load)

```html
<polyline points="17 4l4 4l0 0l0 0l0 0"></polyline>
```

`l4 4` is not valid in a `points` attribute → Chromium logs
`Error: <polyline> attribute points: Expected number, "17 4l4 4l0 0l0 0l0 0"`
on every page load. Same string in `index.maestro.html:38`. Looks like a
half-deleted relative-line path; the adjacent `<line x1="17" y1="4" x2="23"
y2="4">` already draws the horizontal stroke, so the polyline is likely
redundant. **Not fixed by Mac** — index.html is not on the Mac-owned list.

### 0.5 ~~BUG~~ ✅ FIXED — `js/styles/pencil.js:155`: invalid brush tip `'pencil'`

`pencil.js` passes `brushName: 'pencil'` to `stampStrokeSync`, but the vendored
runtime registers **`cpencil`**, not `pencil`. Every pencil stroke therefore
throws `Brush "pencil" not found` inside the stamp engine and falls back to the
custom renderer — pencil has never used the enhanced path.

**Fix:** change `'pencil'` → `'cpencil'` at `js/styles/pencil.js:155`.

`pencil.js` is on the ThinkPad dirty list, so Mac did **not** edit it.

⚠ Related and more important: **`pencil.js` and `charcoal.js` were the only two
styles wired to the stamp path before M3, and the path itself was dead** — see
§0.6. Both have been rendering through their fallbacks in production.

### 0.6 BUG — the enhanced p5.brush stamp path never worked (FIXED by Mac)

`js/vendor/brush.esm.js` is the **modern p5.brush build**: WebGL2-only, public
drawing API (`initStandaloneRuntime`, `load`, `set`, `add`, `beginStroke`,
`move`, `line`, `endStroke`, `render`, `hatch`, `wash`, `fill`).

The shipped adapter called the **old internal API** (`brush.h(...)`,
`brush.f(...)`, `brush.u = {...}`, `brush.b = {...}`), which does not exist in
this build → `TypeError: brush.h is not a function` on every init. The path was
silently unusable from the day it was vendored.

**Fixed by Mac in M3** (`js/engine/brush-stamp-engine.js` rewritten,
`js/engine/brush-media.js` new). 10 styles now use the enhanced path with a
working fallback. Details in `docs/checkpoints/P1.6.md`.

Three traps worth remembering (all documented in the module):

1. **`load(target)` needs a canvas that has never had `getContext('2d')`.** A
   canvas hands out one context type; a 2D context permanently blocks WebGL2.
2. **`brush.add(name, params)` on an existing tip overwrites its param object.**
   A param without `type` makes every later stroke throw. The vendor exports no
   brush list, so never re-add a shipped tip.
3. **`brush.clear()` paints the target opaque** (it is a canvas background, not
   a transparent wipe). Clear the GL backbuffer directly instead.

### 0.7 NOTE — visual-regression harness has no WebGL2

`scripts/visual-regression.cjs` launches Chromium with `--disable-gpu`, so
WebGL2 is unavailable and every style takes its canvas fallback. This is why
the M3 changes leave the 9 pinned baselines **unmoved** even though `ink` is
one of them. If the harness ever gains WebGL2, `ink` (and any other wired
baseline style) will need a deliberate re-baseline.

---

### 0.8 PROCESS — Mac: never run git, and log every turn in §7

Two standing rules for round 2 (requested by the human, 2026-11-12):

1. **Never run git.** No clone / branch / commit / push / tag / `git add`. Your
   edits reach the ThinkPad through **Syncthing**; **BE verifies and pushes** (BE
   is the sole GitHub writer). If a `.git` exists on your side, do not use it —
   and delete it only with the human's explicit approval.
2. **Append to §7 "Round-2 progress log" after EVERY turn** — a dated entry with
   what you did, the files you touched, the raw verification output, any blocker,
   and what is next. That is how BE stays current with your progress. Report
   blockers in §0 as well.

Neither rule is optional: BE cannot verify what it cannot see, and a second git
history breaks the single-push model.

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
# Unit tests — CURRENT EXPECTED: 120/120 (was 52 at Track R2, 99 at B1/B2, 120 after B3/H4)
node tests/engine.test.js

# Wet-sim tests (Mac M1) — expect 15/15
node tests/wetsim.test.js

# Tonal-mask tests (Mac M2 + the band-flag guard) — expect 19/19
node tests/masks.test.js

# Visual regression — expect pass=9 fail=0 error=0
NODE_PATH=<playwright-core parent dir> node scripts/visual-regression.cjs
NODE_PATH=<...> node scripts/visual-regression.cjs --styles=watercolor,ink   # subset

# Media-panel BEHAVIOURAL probe (does a control change output?) — 4 PASS lines
NODE_PATH=<...> node scripts/media-panel-probe.cjs --size=128 --strokes=100

# Parity bench (modular engine vs the app painter)
NODE_PATH=<...> node scripts/parity-bench.cjs

# Debug maps
NODE_PATH=<...> node scripts/structure-debug.cjs
NODE_PATH=<...> node scripts/wetsim-debug.cjs
```

### Maestro (web UI verification)

`JAVA_HOME` is **required** — Maestro's CLI and MCP server are JVM apps and the
MCP never completes its stdio handshake without it:

```bash
export PATH="$HOME/.maestro/bin:$PATH"
export JAVA_HOME="$(/usr/libexec/java_home)"

# Serve the repo (bind 0.0.0.0 so Maestro's Chromium can reach it).
# Check first: two servers may already be running from earlier sessions.
lsof -nP -iTCP:8099 -sTCP:LISTEN
python3 -m http.server 8099 --bind 0.0.0.0

# ONE command per run — the web device does not persist across invocations.
# `--screen-size` is honoured ONLY with `--headless`.
maestro test --headless --screen-size 390x844  maestro/www-paint-media-panel.yaml
maestro test --headless --screen-size 1440x900 maestro/www-paint-desktop-regression.yaml
maestro test --headless --screen-size 1440x900 maestro/www-paint-media-behaviour.yaml
```

**No API key is needed for local flows.** `MAESTRO_CLOUD_API_KEY` is only
required for Maestro Cloud (uploading runs) and for the AI commands
(`assertWithAI`, `assertNoDefectsWithAI`, `extractTextWithAI`). All local
`maestro test` runs work with no key set.

### Maestro limitations found the hard way

- **No `sliderInput` in web mode** — `Invalid Command: sliderInput`. Drive a
  slider from the page with synthetic `input` + `change` events.
- **`runScript` and `evalScript` have separate scopes.** Neither exposes
  `window`; `globalThis` works in `evalScript`. A top-level `await` is rejected.
- **`runScript` does not populate `output`** — use `evalScript` for that.
- **It asserts the accessibility tree, not pixels.** "Did this control change
  the rendered output?" is out of scope; use `scripts/media-panel-probe.cjs`.
- **`maestro hierarchy` says "No running devices found"** even when
  `list-devices` shows `Web / chromium`. Expected — use the single-command
  `maestro test --headless --screen-size WxH <flow>` form.
- **A flow is written for ONE viewport.** The media-panel flow's
  `start: 41%, 70%` gesture lands inside a 320px panel at 390px but on the
  **canvas** at 1440px (desktop rail is 260px) → false `TONAL MASKS` failure.
  Run each flow at the width in its header comment.

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

## 5. Session logs — 2026-11-11 (Mac / AIR HERMES)

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

- **M1** — Phase 3 wet media — **landed** (PR #1, merged by BE as `a3bbfc0`).
- **M2** — Phase 2.1 masks + 2.3 layer panel — **landed** (PR #2 merged as
  `5c54a46`; Goal B wiring landed by BE as `da7d355`).
- **M3** — Phases 1.1 + 1.6 brush media — **landed** (BE pushed as `dfce72c`).
- **M4** — independent QA seat — **first pass done** (§5d). All ThinkPad claims
  confirmed; one wording disagreement (see §0.4 / §5d).
- No Mac streams remain open. Awaiting the next brief from BE.

---

### 5b. M2 — tonal masks + layer panel

### Location correction

The user pointed out the canonical project path is
`/Users/AIR2K/Data/20_Projects/20.36_WWW_PAINT`. M1's six files were copied
there byte-identical (verified against the committed blobs) and `AGENTS.md` was
created at the project root. The `~/code/www-paint` worktree was unlinked and
`/Users/AIR2K/code` removed. **Nothing already in the repo was moved or
overwritten** — the ThinkPad's 41 uncommitted entries were byte-identical
before and after (`git status` diff empty).

### M2 Goal A — tonal masks — **SHIPPED**

- `js/engine/masks.js` (NEW) — soft background/shadows/midtones/highlights
  separation from an existing `analyzeImage()` result. The four windows form a
  **partition of unity**: they sum to exactly 1.0 at every pixel, so coverage
  sums to ~1 and a downstream layer-aware generator can blend the bands with no
  gaps or double-weighting.
- `tests/masks.test.js` (NEW) — **18/18 pass**.
- `docs/research/tonal-masks.png`, `scripts/tonal-masks-debug.cjs`,
  `tests/visual/tonal-masks.html`.
- `docs/checkpoints/P2.md`.

Measured on a 64×64 gradient: coverage 0.0825 / 0.2534 / 0.3281 / 0.3359,
sum **1.0000**, partition min/max **1.0000 / 1.0000**. Black → background 1,
white → highlights 1, mid-grey → midtones > 0.9. Vision review of the debug PNG
confirms clean band separation.

**Design note:** `background` is a real band, not a residual — a residual after
the three tonal windows is identically zero because they already tile the range.

### M2 Goal B — layer panel — **partial, 2 criteria blocked**

**Wiring verified:** `layers.js` *is* wired into `app.js` (add/delete/duplicate/
visibility/opacity/blend all handled). Two defects found:

1. `setLayers()` is **never called at init** — the panel opens with an empty
   list (rows: 0).
2. The **blend `<select>` was never rendered** — `layers.js` bound a `change`
   handler for `.layer-blend-select` and `app.js` handles `layer-blend-change`,
   but `_renderLayerRow()` never created the element. Dead code on both sides.

**Delivered (Mac-owned only):**
- `js/ui/layers.js` — row now renders blend (8 modes), style (51 styles, via
  injected options + `setStyleOptions()`), and regenerate controls; emits
  `layer-style-change` and `layer-regenerate`.
- `css/style.css` — additive rules only (`.layer-tools-row`,
  `.layer-style-select`, `.layer-regen-btn`). Staged with `git apply --cached`
  so the ThinkPad's uncommitted `.control-hint` was not swept in.

**Verification** — real headless Chromium 1440×900, DOM assertion **and**
behavioural canvas check per control:

```
✓ rows render with all controls   {rowCount:2, blend/style/regen/opacity/vis: 2 each}
✓ style dropdown has options      options=51
✓ opacity slider changes canvas   pixelsChanged=786432
✓ visibility toggle changes canvas pixelsChanged=21059
✓ blend applied to engine layer   multiply
✓ add/delete tracked engine layers
✓ regenerate emits layer-regenerate
✓ style emits layer-style-change  {layerId:1, style:"ink"}
```

**⚠ BLOCKED — needs ThinkPad action in `js/ui/app.js`** (exact diffs in
`docs/checkpoints/P2.md` §2.4 and the OPS_LOG):

1. Call `setStyleOptions(...)` + `setLayers(this.engine.layers)` after line 103.
2. Handle `layer-style-change` and `layer-regenerate`
   (`engine.generate()` already supports `{style, layer, seed, count}`).

### Bugs found (both pre-existing, neither in a file this stream owns)

1. **`analyzeImage()` hangs on tiny images.** The k-means init in
   `extractPalette()` does `do { idx = ... } while (used.has(idx))` — with
   fewer pixels than `paletteSize` there are not enough distinct indices, so it
   spins forever. Reproduced with a 1×1 buffer. `js/engine/analyzer.js` is
   ThinkPad-owned → **not edited**, raised via OPS_LOG; mask tests work around it.
2. **Malformed `<polyline>` in `index.html:38`** — `points="17 4l4 4l0 0l0 0l0 0"`
   is invalid SVG, logs a console error on every load. Pre-existing; not fixed
   here (index.html is not on the Mac-owned list).

### PRs

| PR | Branch | Head | State |
|---|---|---|---|
| [#1](https://github.com/sudo-prog/www-paint/pull/1) | `machine/mac/wetsim` | `04ed927` | open, mergeable clean |
| [#2](https://github.com/sudo-prog/www-paint/pull/2) | `machine/mac/masks` | `c2e30df` | open, mergeable clean |

PR #2 was rebased onto `origin/main` before pushing: the first push carried the
ThinkPad's 4 unpushed local commits in its history, which GitHub flagged
`mergeable_state: dirty`. The rebase is content-identical for every file except
`css/style.css`, where the only delta is the ThinkPad's `.control-hint` (already
in `origin/main`).

---

### 5c. M3 — brush media + water/ink unification

**Process note:** per the user, Mac does **not** push — the ThinkPad pushes.
Files land in the repo via Syncthing; AGENTS.md is updated after each round.

### M3 — brush media + water/ink unification

**The headline finding: the enhanced p5.brush stamp path had never worked.**

The vendored `js/vendor/brush.esm.js` is the modern WebGL2-only p5.brush build
(public drawing API: `initStandaloneRuntime`, `load`, `set`, `add`,
`beginStroke`, `move`, `line`, `endStroke`, `render`, …). The shipped adapter
called the **old internal API** (`brush.h(...)`, `brush.f(...)`, `brush.u =`,
`brush.b =`), which does not exist in this build → `TypeError: brush.h is not a
function` on every `initBrushEngine()`. `_ready` stayed false forever, so
`pencil.js` and `charcoal.js` — the only two styles wired at the time — were
silently rendering through their canvas fallbacks in production.

**Delivered (all Mac-owned):**

- `js/engine/brush-stamp-engine.js` — rewritten against the real API.
  Dedicated WebGL2 canvas (never touched by `getContext('2d')`), correct
  `beginStroke('curve'|'segments')`/`move`/`line`/`endStroke`/`render`
  sequence, `drawImage` composite onto the caller's 2D canvas.
- `js/engine/brush-media.js` (NEW, Phase 1.6) — `MEDIA_PARAMS` schema +
  `MEDIA_PRESETS` + `resolveMedia()` / `toStampOptions()` /
  `isKnownBrushName()`. Shared parameters for water/ink/dry media, so `bleed`,
  `grain`, `tideDarken` mean the same thing across styles.
- `js/styles/{ink,wash,sumi,pastel,gouache,pen,knife,linocut}.js` — wired to
  the stamp path with a fallback guard.
- `scripts/brush-media-debug.cjs` + `docs/research/brush-media-compare.png` +
  `-summary.json` — before/after.
- `docs/checkpoints/P1.6.md`.

**Verification (my own runs):**

```
$ node tests/engine.test.js   -> Passed: 52  Failed: 0
$ node tests/wetsim.test.js   -> Passed: 15  Failed: 0
$ node tests/masks.test.js    -> Passed: 18  Failed: 0
$ node scripts/visual-regression.cjs -> pass=9 fail=0 error=0 total=9
```

Enhanced path in real Chromium with WebGL2 (SwiftShader), 10 styles:

```
initOk: true | ready: true
  ink 1752 · wash 2163 · sumi 2357 · pastel 15166 · gouache 15688
  pen 15688 · knife 15688 · linocut 2684   (all stampErr=null)
  pencil 3141 · charcoal 15166  (invalid 'pencil' tip -> fallback)
```

Fallback with `--disable-gpu`: every style still renders (ink 1934, wash
11526, sumi 3587, gouache 2250, pen 2345, knife 2245, linocut 2773, pencil
3223, charcoal 3733). Vision review of `brush-media-compare.png` confirms the
stamp path shows real brush grain where the fallback is smooth.

**Baselines not re-baselined** — the harness runs `--disable-gpu`, so WebGL2 is
unavailable and `ink` takes its fallback; hash unchanged.

### Bugs found during M3

1. `brush.h is not a function` — the path was dead (fixed).
2. `brush.add()` on an existing tip clobbers its param → every later stroke
   throws. Never re-add a shipped tip.
3. `brush.clear()` paints the target opaque → covers the caller's canvas.
4. Presets named non-existent tips (`round`, `flat`, `pencil`).
5. `opts.size` could be a `{min,max,default}` object → `NaN` weight.
6. **Pre-existing, reported not fixed:** `pencil.js:155` passes `brushName:
   'pencil'` (should be `cpencil`). ThinkPad-owned file.

### Open items added to AGENTS.md §0

- **0.5** `pencil.js:155` invalid brush tip.
- **0.6** the dead stamp path (fixed by Mac; documented for the ThinkPad).
- **0.7** the visual harness has no WebGL2 — baselines will not move until it
  does.

### PRs (unchanged — Mac does not push)

| PR | Branch | Head | State |
|---|---|---|---|
| [#1](https://github.com/sudo-prog/www-paint/pull/1) | `machine/mac/wetsim` | `04ed927` | open, mergeable clean |
| [#2](https://github.com/sudo-prog/www-paint/pull/2) | `machine/mac/masks` | `c2e30df` | open, mergeable clean |

M3 work is **local only** — no branch pushed, no PR opened.

---

### 5d. M4 — independent QA seat (verification only, no edits)

Baseline under test: **clean `origin/main` @ `1b58cc5`** (a separate worktree,
not the Syncthing mirror, so uncommitted work cannot mask anything).

| Check | ThinkPad claim | My independent run | Verdict |
|---|---|---|---|
| `node tests/engine.test.js` | 52/52 | Passed: 52 Failed: 0 | ✅ agree |
| `node tests/masks.test.js` | 18/18 | Passed: 18 Failed: 0 | ✅ agree |
| `node tests/wetsim.test.js` | 15/15 | Passed: 15 Failed: 0 | ✅ agree |
| `node scripts/visual-regression.cjs` | pass=9 fail=0 error=0 | pass=9 fail=0 error=0 total=9 | ✅ agree |
| Parity bench (R2, `174df5e`) | blobs 97.52/0.8671 · rings 98.01/0.8522 · smooth 98.78/0.9317 · noise 80.89/0.0256 | **exact match** | ✅ agree |
| Layer panel init (`da7d355`) | 2 rows, 51 style options | `{"rows":2,"styleOpts":51,"blendOpts":8}` | ✅ agree |
| Layer handlers (`da7d355`) | style + regenerate fire | style records `ink`; regenerate produced 20 strokes | ✅ agree |
| "0 page errors" (`da7d355`) | 0 | 2 console errors, both pre-existing | ⚠ disagree (wording) |

**⚠ DISAGREE (wording, not a regression):** `da7d355` claims "0 page errors",
but the page logs two messages, both predating that commit:

1. `Error: <polyline> attribute points: Expected number, "17 4l4 4l0 0l0 0l0 0"`
   — malformed SVG at `index.html:38` (and `index.maestro.html:38`). See §0.4.
2. `Failed to load resource … 404` — the browser's default `/favicon.ico`
   request; the repo ships no favicon.

Neither comes from ThinkPad code. The claim should read "0 **new** page errors".

**Two false alarms I hit (probe bugs, not product bugs) — worth remembering:**

- My first regenerate probe reported `strokes: 0`. The handler correctly
  early-returns when no source image is loaded (`!this.engine._analysis`); my
  probe had not loaded one.
- A second probe read `layer.strokes.length` before the async handler finished
  and again reported failure.

**Lesson:** for async UI handlers, establish the precondition *and* wait for
the effect, or you report a defect that does not exist.

**Unverified, not contradicted:** the `scales:1` collapse-to-R1 claim. The
option exists and the R2 numbers reproduce, but the R1-vs-R2 A/B needs a long
optimiser run that exceeded the command approval window.

Evidence: `docs/checkpoints/M4.md` + `docs/research/qa-parity-r2.png`.
**No source edits — M4 is evidence only.**

---

### 5e. M6b — media-panel re-verification + Maestro (2026-11-12, Mac / AIR HERMES)

**Baseline under test:** the live worktree (not a clean worktree) at
`origin/main = 2585cec`, plus the uncommitted Mac media-panel files.

**Three defects found and fixed — all in Mac-owned files.**

| # | Defect | Fix |
|---|---|---|
| 11 | The panel was an **inert settings shell**: `media-host.js` stored WET MEDIA at `engine.settings.wetSim`, but `engine.generate()` reads only `engine.settings.mediaModel` → **no** control changed output | `mediaModelFromPanel()` bridge in `media-host.js`, clamped to the frozen `$defs/mediaModel` ranges |
| 12 | `masksCompositeRGBA()` ignored the band flags entirely → a band toggle changed nothing | optional `bands` arg (omitted = historical all-enabled) |
| 13 | The four tonal-band toggles had **no `id` and no `aria-label`** — the only controls in the panel without one, so no id-based automation could target them | `media-masks-band-<key>` + `aria-label` in `media.js` |

**Output-neutrality (HANDOFF §2 rule 5).** The panel's display defaults are
`wetsim.js`'s defaults (`maxWet 1.5`), which describe a *working* wet sim. A
naive map switched wet media on for every user who never touched a control. A
non-UI `wetOptIn` flag (carried in `WET_SIM_KEYS`, deliberately kept out of
`WET_SIM_PARAMS` so no slider renders) is set on the first wet move; while false
the model is `{kind:"dry"}` → byte-identical output.

**Behavioural proof** (`scripts/media-panel-probe.cjs`, real Chromium, hashes the
exported PNG):

```
A defaults (100 strokes): {"lum":196.05,"bytes":13411,"kind":"dry"}
B after wet ctrl        : {"lum":159.92,"bytes":21405,"kind":"wet"}
C repeat                : {"lum":159.92,"bytes":21405,"kind":"wet"}   <- identical
mask band toggle        : preview hash 894717379 -> 247072197
```

**Maestro (real Chromium, MCP loaded + CLI 2.11.0):**

| Flow | Viewport | Result |
|---|---|---|
| `www-paint-media-panel.yaml` | 390×844 | 29/29 COMPLETED, 0 FAILED |
| `www-paint-mobile-ui-audit.yaml` | 390×844 | 30/30 COMPLETED, 0 FAILED |
| `www-paint-desktop-regression.yaml` | 1440×900 | 33/33 COMPLETED, 0 FAILED |
| `www-paint-media-behaviour.yaml` (NEW) | 1440×900 | 35/35 COMPLETED, 0 FAILED |

**No API key is needed for local Maestro flows** — `MAESTRO_CLOUD_API_KEY` is
only for Maestro Cloud uploads and the AI commands. See §3.

**Vision review:** one finding (strip chip "Wet · Ink · Tonal" allegedly clipped)
was **disproved by measurement** — strip x=1..259, chip x=76..194,
`scrollWidth == clientWidth`; a 3× element screenshot shows the final `l` fully
rendered with margin. The 1× raster was the artefact.

**Probe pitfall worth remembering:** the first probe image was a smooth gradient
with **zero background coverage**, so toggling the background band was
*correctly* a no-op and the probe reported a false "toggle does nothing". A band
toggle can only be verified on an image that actually has that band.

**Dev-server note:** two `python3 -m http.server 8099` processes were already
running from the repo root; starting a third failed with
`OSError: [Errno 48] Address already in use`. `http.server` reads from disk per
request, so served bytes were hash-verified against disk (all MATCH).

Gates: engine **120/120** · wetsim **15/15** · masks **19/19** · visual
regression **pass=9 fail=0 error=0** (baselines unmoved).

Evidence: `docs/checkpoints/P2.5.md` §8–§9. `js/ui/controls.js` and
`js/ui/app.js` remain **never edited**.

---

## 7. Round-2 progress log — Mac appends after every turn

**Append-only; newest at the bottom; exactly one entry per turn.** BE reads this
to stay current with Mac progress and to know what to verify. Do not edit old
entries. Keep it short — facts + raw evidence only.

Format:

```markdown
### YYYY-MM-DD HH:MM — M<n> <name> — <one-line status>
- did: <what>
- files: <paths touched>
- verified (raw): <command> → <output line>
- blocker: none | <what + exact error>
- next: <stream / step>
```

### 2026-11-12 15:40 — M7 outlines.js (IF-3) — SHIPPED, 16/16
- did: NEW `js/engine/outlines.js` — edge-following outline extraction over an `analyzeImage()` result; threshold the Sobel edge map (keeping magnitudes), seed only from contour pixels, walk to the strongest unvisited edge neighbour, de-duplicate, filter by length+strength, largest first. NEW `tests/outlines.test.js` (16 tests). NEW `scripts/outlines-debug.cjs` + `docs/research/outlines-debug.png`. TDD: RED first (`ERR_MODULE_NOT_FOUND`), then GREEN.
- files: `js/engine/outlines.js`, `tests/outlines.test.js`, `scripts/outlines-debug.cjs`, `docs/research/outlines-debug.png`, `docs/checkpoints/M7.md`
- verified (raw):
  ```
  $ node tests/outlines.test.js   -> Passed: 16  Failed: 0
  boundary pixels covered: 276 / 276  100.0%
  duplicate pairs: 0
  ```
- TWO DEFECTS the tests caught, both fixed: (1) all walks shared one global visited set, so the second walk died at its first step and the square's LEFT EDGE went untraced — vision review of the debug PNG caught this, not the assertions; each walk now has a private visited set, claimed into the shared mask afterwards. (2) after fix 1, every seed re-walked the same closed loop → 64 near-identical outlines; now de-duplicated (>=80% shared pixels).
- blocker: none
- next: M8 `js/engine/order.js` (IF-4)

### 2026-11-12 15:55 — M8 order.js (IF-4) — SHIPPED, 24/24
- did: NEW `js/engine/order.js` — the eleven paint-order modes as stable numeric sort keys (`free down up left right diag spiral spiralin rings ringsin clock`). Returns a NEW array of the SAME shape objects; sets `order` per index. Ordering centre resolves from explicit cx/cy → analysis width/height → the shapes' own bounding-box centre. NEW `tests/order.test.js` (24 tests). TDD: RED first, then GREEN.
- files: `js/engine/order.js`, `tests/order.test.js`, `docs/checkpoints/M8.md`
- verified (raw):
  ```
  $ node tests/order.test.js -> Passed: 24  Failed: 0
  ```
- DEFECT caught: `clock` ran COUNTER-clockwise — `atan2(dx,-dy)` measures CCW from north, so ascending sort put NW last. Fixed to `atan2(-(x-cx), -(y-cy))`. Second finding: the radial modes silently sorted about (0,0) until the bounding-box centre fallback was added.
- ⚠ FOR BE: `generator.js` already has `orderShapes(shapes, settings, analysis)` with `free|top-bottom|spiral|one-line|edges-first`, and its `spiral` is `angle + radius*0.1` — DIFFERENT semantics from this module's radius-ordered `spiral`. The two must be reconciled deliberately; do not leave both live under the same name. Full note in `docs/checkpoints/M8.md` §7.
- blocker: none
- next: M9 `js/styles/shaping.js`

### 2026-11-12 16:05 — M9 styles/shaping.js — SHIPPED, 18/18
- did: NEW `js/styles/shaping.js` — per-style shaping DATA table (`minSize maxSize elongation order regionFill`) covering all 51 registered styles + `SHAPING_DEFAULTS` + `STYLE_CATEGORIES` + `unshapedStyles()`. Data only (no functions/DOM in the table); returns a fresh copy; unknown name → documented defaults. NEW `tests/shaping.test.js` (18 tests). TDD: RED first, then GREEN.
- files: `js/styles/shaping.js`, `tests/shaping.test.js`, `docs/checkpoints/M9.md`
- verified (raw):
  ```
  $ node tests/shaping.test.js -> Passed: 18  Failed: 0
  ```
- DEFECTS caught: (1) `SyntaxError: Unexpected token '-'` — `cross-hatch:` unquoted as an object key, fixed to `'cross-hatch':`; (2) a test bug asserting `order` was a number.
- ⚠ FOR BE: the nine pinned styles ARE in the shaping table. That only describes preferred geometry — it does not touch their rendering, so no re-baseline is needed.
- blocker: none
- next: full gate re-run, then M10 (Phase 4.2 style library UI)

### 2026-11-12 16:20 — M7/M8/M9 gate re-run — ALL GREEN, baselines unmoved
- did: re-ran every gate after the three new modules landed.
- verified (raw):
  ```
  $ node tests/engine.test.js    -> Passed: 123  Failed: 0
  $ node tests/wetsim.test.js    -> Passed: 15   Failed: 0
  $ node tests/masks.test.js     -> Passed: 19   Failed: 0
  $ node tests/outlines.test.js  -> Passed: 16   Failed: 0
  $ node tests/order.test.js     -> Passed: 24   Failed: 0
  $ node tests/shaping.test.js   -> Passed: 18   Failed: 0
  $ node scripts/visual-regression.cjs -> pass=9 fail=0 error=0 total=9
  ```
- The 9 pinned visual baselines are UNMOVED (the new modules are inert until BE wires them).
- blocker: none
- next: M10 Phase 4.2 — Style Profile library UI (`js/ui/style-library.js` + host shim)

### 2026-11-12 20:35 — M10 style library UI (Phase 4.2) — SHIPPED, browser-verified
- did: NEW `js/ui/style-library-core.js` — pure core (ProfileLibrary: save/list/get/apply/delete/export/import, `profileToExportText`/`profileFromExportText`, `defaultProfile`, `newProfileId`, `coerceProfileName`, `summarizeProfile`, `STORAGE_KEY`), no DOM. NEW `js/ui/style-library.js` — StyleLibraryPanel (renders rows, dispatches `style-profile-apply`, no engine imports). NEW `js/ui/style-library-host.js` — the media-host.js shim pattern; `app.js` never edited. NEW `tests/style-library.test.js` (50 tests, TDD: RED `ERR_MODULE_NOT_FOUND` first). NEW `scripts/style-library-probe.cjs` (behavioural browser probe). ADDITIVE deltas to shared `index.html` (1 nav button, 1 panel shell, shim import + toggle, 3 import-map entries) and `css/style.css` (+230 lines appended, new selectors only).
- files: `js/ui/style-library-core.js`, `js/ui/style-library.js`, `js/ui/style-library-host.js`, `tests/style-library.test.js`, `scripts/style-library-probe.cjs`, `docs/checkpoints/M10.md`, `docs/research/style-library-{desktop,mobile}{,-panel}.png`, `docs/research/style-library-probe.json` + additive `index.html`, `css/style.css`
- verified (raw):
  ```
  $ node tests/style-library.test.js -> Passed: 50  Failed: 0
  $ node scripts/style-library-probe.cjs
  PASS: panel mounts, save writes a schema-valid profile, apply changes the render,
  same profile+seed re-bakes byte-identically, a different seed changes pixels,
  export→import round-trips, re-import updates in place, delete removes the row,
  every control has an id, 0 page errors
  bakeDefault      lum 159.10  bytes 26447  hash 858025043
  bakeAfterApply   lum 167.49  bytes 25682  hash 1759206923   <- apply CHANGED the render
  determinismRun1  lum 166.79  bytes 25839  hash 1675286432
  determinismRun2  lum 166.79  bytes 25839  hash 1675286432   <- identical
  differentSeed    lum 160.67  bytes 24040  hash 1056661533   <- seed CHANGES the pixels
  controlsWithoutId []   pageErrors []   rowCountAfterDelete 0
  ```
  Geometry (real DOM, panel rows): 1440px identity 224px / name clip 0 / meta clip 0 / buttons 72px; 390px identity 214px / clips 0 / buttons 69px / min height 32px; doc overflow 0 both.
  ```
  $ node tests/engine.test.js        -> Passed: 123  Failed: 0
  $ node tests/wetsim.test.js        -> Passed: 15   Failed: 0
  $ node tests/masks.test.js         -> Passed: 19   Failed: 0
  $ node tests/outlines.test.js      -> Passed: 16   Failed: 0
  $ node tests/order.test.js         -> Passed: 24   Failed: 0
  $ node tests/shaping.test.js       -> Passed: 18   Failed: 0
  $ node scripts/visual-regression.cjs -> pass=9 fail=0 error=0 total=9
  ```
- SIX DEFECTS caught, two by the browser probe (the node tests passed throughout):
  1. `SyntaxError: Duplicate export of 'StyleLibraryPanel'` — the whole module failed to load.
  2. **Save was silently dead.** The delegated click handler was gated on `[data-action]`, but Save/Import/Choose-file carry an **id**, not a data-action → the handler exited before the id checks. The panel was inert while every unit test passed.
  3. **A minimal schema-valid profile could not be saved** — `normalizeProfile` writes `mediaModel:null` and the validator requires an object, though the schema permits omission.
  4. **A profile with no `global.style` could not be saved** — same class; and the engine's `resolveSettings` would copy the null into the size sampler.
  5. Re-import duplicated the row instead of updating.
  6. **The row's identity was clipped** — three labelled buttons (144px) beside the identity in a 232px row squeezed it to 62px and clipped the meta by 68px; actions moved to a full-width row below the identity.
  7. **Two 260px panels stacked in the same rail** — entering media mode while the library was open left both visible (`toggleMediaMode` is BE-owned and unaware of the library); the shim now wraps it once, re-entry guarded.
- ⚠ FOR BE: (a) `profileToSettings` emits `style:null` for a style-less profile and `resolveSettings` copies it verbatim into `chooseSize` — the library drops the key, but any other direct caller needs the same guard; `generator.js` is BE-owned. (b) `normalizeProfile` writes `null` for an absent `mediaModel`, which its own validator rejects — consider omitting the key instead.
- ⚠ NOT DONE: vision review of the panel screenshots — the vision backend returned HTTP 429 on four attempts over ~15 minutes. The geometry numbers above are real DOM measurements, not a visual pass. Run vision before calling M10 visually done.
- blocker: none
- next: M11 Phase 6 — export & share panel UI (`js/ui/export-panel.js` + host shim, wrapping the BE-owned `exporter.js`)

### 2026-11-12 21:40 — M11 export & share panel (Phase 6 / Track-S S7) — SHIPPED, browser-verified
- did: NEW `js/ui/export-panel-core.js` — PURE core, no DOM: `EXPORT_SIZE_PRESETS` (original / 2x / 4x), `EXPORT_FORMATS` (png/jpg), `resolveExportSize`, `clampQuality`, `checkExportFeasible` (dimension + pixel bounds), `defaultExportState`, `updateExportState` (immutable, unknown-preset fallback), `buildExportRequest`, `describeExport`, `describeBlob`, `buildShareText`, `exportFilename`, `safeExport` (throws become status messages). NEW `js/ui/export-panel.js` — MODAL panel (`role=dialog`, `aria-modal`, Escape closes, `aria-live` status), renders size/format/quality/summary/actions, no engine imports. NEW `js/ui/export-host.js` — the media-host.js shim; `app.js` and `js/ui/export.js` NEVER edited. NEW `tests/export-panel.test.js` (90 tests). NEW `scripts/export-panel-probe.cjs` (behavioural browser probe). ADDITIVE deltas to `index.html` (+1 nav button `#btn-export-panel`, +1 modal shell `#export-panel-root`, +3 import-map entries, +1 shim import + attach call) and `css/style.css` (+142 lines appended, new selectors only).
- OWNERSHIP COLLISION RESOLVED: `js/ui/export.js` + `ExportManager` + `#export-root` already exist (ThinkPad-authored, wired in app.js:279-300/777-900). The stream name is `js/ui/export-panel.js`, so this is an ADDITIVE OVERLAY, not a replacement — `#export-root`, `js/ui/export.js`, `js/engine/exporter.js`, `js/engine/engine.js`, `js/ui/controls.js`, `js/ui/app.js` all untouched. Nothing deleted.
- files: `js/ui/export-panel-core.js`, `js/ui/export-panel.js`, `js/ui/export-host.js`, `tests/export-panel.test.js`, `scripts/export-panel-probe.cjs`, `docs/checkpoints/M11.md`, `docs/research/export-panel-{desktop,mobile}{,-panel}.png`, `docs/research/export-panel-probe.json` + additive `index.html`, `css/style.css`
- verified (raw):
  ```
  $ node tests/export-panel.test.js -> Passed: 90  Failed: 0
  $ node scripts/export-panel-probe.cjs
  PASS: panel mounts, every control has an id, PNG+JPG at 3 sizes produce
  non-empty blobs with the requested dimensions, JPG is smaller than PNG,
  same (settings, seed) re-bakes byte-identically, share text copies with
  dimensions, the M10 profile path works, no clipping at 1440 or 390, 0 page errors
  png_original  96×96   17678 B  image/png   hash 1475606585
  jpg_original  96×96    3170 B  image/jpeg  hash 4241636003   <- smaller
  png_2x       192×192  24638 B  image/png   hash 1269356052
  jpg_2x       192×192   4991 B  image/jpeg  hash  106298209
  png_4x       384×384  29146 B  image/png   hash 2277287572
  jpg_4x       384×384   5912 B  image/jpeg  hash 1366779745
  deterministic true | downloadFilename "www-paint.png" | shareTextCopied true
  shareTextHasDims true | profileTextAccessible true | controlsWithoutId [] | pageErrors []
  geometry 1440px docOverflow 0 contentOverflow 0 buttons 215×32/close 32×32
           768px  docOverflow 0 contentOverflow 0 buttons 681×32/close 32×32
           390px  docOverflow 0 contentOverflow 0 buttons 681×32/close 32×32
  ```
  Blob dimensions are decoded from the blob itself (img.decode + getImageData), NOT read back from the request.
  ```
  $ node tests/engine.test.js        -> Passed: 123  Failed: 0
  $ node tests/wetsim.test.js        -> Passed: 15   Failed: 0
  $ node tests/masks.test.js         -> Passed: 19   Failed: 0
  $ node tests/outlines.test.js      -> Passed: 16   Failed: 0
  $ node tests/order.test.js         -> Passed: 24   Failed: 0
  $ node tests/shaping.test.js       -> Passed: 18   Failed: 0
  $ node tests/style-library.test.js -> Passed: 50   Failed: 0
  $ node scripts/visual-regression.cjs -> pass=9 fail=0 error=0 total=9
  $ node scripts/media-panel-probe.cjs -> 4/4 PASS
  $ node scripts/style-library-probe.cjs -> PASS
  ```
- THREE DEFECTS caught, all in my own new code:
  1. `MAX_EXPORT_PIXELS` was self-contradictory — set to 16384×16384 (268 Mpx) while `MAX_EXPORT_DIMENSION` was 16384, so the pixel check could never fire. The test caught it; now 8192² (64 Mpx), below Chromium's area limit.
  2. The probe's `document.createElement` interception swallowed the clipboard-fallback anchor too. Scoped to recording only.
  3. `page.evaluate` cannot see the Node `page` object → `ReferenceError: page is not defined`. Geometry now measured from Node after the page function returns.
- ⚠ FOR BE: `js/ui/export.js` `ExportManager` and the new `js/ui/export-panel.js` both exist now. They are additive siblings, not competitors — but the ThinkPad may want to fold the new panel into `App._init()` and retire the shim later. The old `#btn-export` round button still drives `#export-root`; the new `#btn-export-panel` nav button drives `#export-panel-root`. No BE action required.
- ⚠ NOT DONE: vision review of the panel screenshots — the vision backend returned HTTP 429 on every attempt (same as M10, ~5 attempts over 20 min). The geometry numbers above are real DOM measurements, not a visual pass. Run vision before calling M11 visually done.
- blocker: none
- next: M12 — non-baseline style polish (`js/styles/*` except the 9 pinned styles)

### 2026-11-13 00:40 — M11 Maestro verification (user request) — 2 NEW FLOWS, all green
- did: the user pointed out M11 shipped with DOM measurements but NO Maestro flow. Built them. NEW `maestro/www-paint-export-panel.yaml` (1440x900) and `maestro/www-paint-export-panel-mobile.yaml` (390x844); re-ran all four existing flows as a regression check; copied Maestro screenshots into `docs/research/maestro/`; added §3.5 + §3.6 to `docs/checkpoints/M11.md`.
- files: `maestro/www-paint-export-panel.yaml`, `maestro/www-paint-export-panel-mobile.yaml`, `docs/checkpoints/M11.md`, `docs/research/maestro/*.png`
- verified (raw):
  ```
  $ export PATH="$HOME/.maestro/bin:$PATH"; export JAVA_HOME="$(/usr/libexec/java_home)"
  $ maestro test --headless --screen-size 1440x900 maestro/www-paint-export-panel.yaml
    35 COMPLETED, 0 FAILED
  $ maestro test --headless --screen-size 390x844 maestro/www-paint-export-panel-mobile.yaml
    18 COMPLETED, 0 FAILED
  $ maestro test --headless --screen-size 1440x900 maestro/www-paint-desktop-regression.yaml
    33 COMPLETED, 0 FAILED
  $ maestro test --headless --screen-size 390x844 maestro/www-paint-mobile-ui-audit.yaml
    30 COMPLETED, 0 FAILED
  $ maestro test --headless --screen-size 390x844 maestro/www-paint-media-panel.yaml
    29 COMPLETED, 0 FAILED
  $ maestro test --headless --screen-size 1440x900 maestro/www-paint-media-behaviour.yaml
    35 COMPLETED, 0 FAILED
  ```
- FIVE MAESTRO PITFALLS found the hard way (all documented in M11.md §3.6):
  1. **`assertNotVisible` CANNOT see a closed web modal.** The panel closes with `opacity:0` + `pointer-events:none`, NOT `display:none`, so Maestro's accessibility-tree check still reports the controls as visible. Fix: assert the open class — `- assertTrue: "globalThis.document.getElementById('export-panel-root').classList.contains('export-panel--open') === false"`.
  2. **`evalScript` does not expose `document`** — `TypeError: Cannot read property 'getElementById' of undefined`. Use `globalThis.document`.
  3. **`assertTrue` needs a QUOTED STRING, not a `${...}` expression.** The `${...}` form is interpolated before parsing and then re-parsed as a script, which fails silently. Quoted string works.
  4. **Maestro progress goes to a TTY.** Capturing stdout with `$(...)` yields ZERO `COMPLETED` lines (my first regression loop printed 0/0 for all four flows). Redirect to a file first, then grep.
  5. `maestro test` must be run ONE command per invocation — the web device does not persist.
- NOTE: Maestro asserts the ACCESSIBILITY TREE, NOT PIXELS, so this is an a11y + hierarchy pass, not a visual pass. Vision review of the panel screenshots is STILL not done — the backend is now rate-limited for ~100 minutes (`retry_after: 6104`). The node probe (`scripts/export-panel-probe.cjs`) still owns the "does this control change output" half.
- blocker: none
- next: M12 — non-baseline style polish (`js/styles/*` except the 9 pinned styles)

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
