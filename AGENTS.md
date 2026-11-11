# AGENTS.md — WWW_PAINT (project 20.36)

**Canonical path:** `/Users/AIR2K/Data/20_Projects/20.36_WWW_PAINT`
**Repo:** `github.com/sudo-prog/www-paint` · **Live:** https://www-paint.pages.dev/
**Stack:** static ES modules, **no build step**, no `package.json` — everything runs via plain `node`.

This file is the entry point for any coding agent working in this repo. It
records who owns what, where the logs are, and what has already shipped so
nobody redoes it.

---

## 0. ⚠ Open issues needing ThinkPad (BE) action

Raised by Mac/FE on 2026-11-11. **Seven items — none are Mac-editable.**

### 0.1 BLOCKER — `js/ui/app.js`: layer panel opens empty

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

### 0.2 BLOCKER — `js/ui/app.js`: two layer events unhandled

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

### 0.3 BUG — `js/engine/analyzer.js`: infinite hang on tiny images

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

### 0.4 BUG — `index.html:38`: malformed `<polyline>` (console error every load)

```html
<polyline points="17 4l4 4l0 0l0 0l0 0"></polyline>
```

`l4 4` is not valid in a `points` attribute → Chromium logs
`Error: <polyline> attribute points: Expected number, "17 4l4 4l0 0l0 0l0 0"`
on every page load. Same string in `index.maestro.html:38`. Looks like a
half-deleted relative-line path; the adjacent `<line x1="17" y1="4" x2="23"
y2="4">` already draws the horizontal stroke, so the polyline is likely
redundant. **Not fixed by Mac** — index.html is not on the Mac-owned list.

### 0.5 BUG — `js/styles/pencil.js:155`: invalid brush tip `'pencil'`

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
