# Checkpoint R6-UI (Mac half) — the modular-engine switch reaches the product

**Date:** 2026-11-17 · Agent: Mac / AIR HERMES · Stream **Track R6, UI half**
**Goal:** R6 — *"retire the legacy auto-painter; app + baselines run 100% on the
modular engine."* The engine half landed (`docs/checkpoints/R6-be.md`); this is
the **UI half** that makes the switch reachable. **No ThinkPad-owned file is
touched.**

---

## 1. Why this stream exists

`engine.js#generate()` honours `settings.modular` (BE, `docs/checkpoints/R6-be.md`)
and `generator.js` `DEFAULT_SETTINGS.modular = false`. But **nothing in `js/ui/*`
sets that flag**, so the engine of record (`optimizer.js`, Track R R1–R5) is
unreachable from the product. Recorded in `docs/checkpoints/R6-be.md` §3 and
`docs/MAC-TASKS.md` ("no UI control sets `settings.modular` yet").

`js/ui/app.js` and `js/ui/controls.js` are ThinkPad-owned (`HANDOFF.md` §6), so
the fix is a **Mac-owned shim** — the same pattern as `media-host.js` /
`style-library-host.js` / `react-host.js`.

---

## 2. Landed

| File | Role |
|---|---|
| `js/ui/modular-switch-core.js` (NEW) | The pure algebra: `profileModularFlag`, `effectiveModular`, `applyProfileModular`, `profileDeclaresModular`, `modularLabel`. No DOM, no engine import → node-testable. |
| `js/ui/modular-switch-host.js` (NEW) | The shim: binds `#btn-modular-engine`, writes the flag to BOTH `engine.settings` and `controls.settings`, exposes `app.setModularEngine` / `app.toggleModularEngine`, and reflects a profile's own opinion. |
| `tests/modular-switch.test.js` (NEW) | 22/22 — the strictness and precedence contracts. |
| `scripts/modular-switch-ui-probe.cjs` (NEW) | Real Chromium, in the real shell: default off, both settings flip, both engines paint, toggle back restores. PASS at 390 / 768 / 1440. |
| `index.html` | **Additive only**: 1 nav button, 1 import, 1 `attachModularSwitch(app)` call. |
| `js/ui/react-host.js`, `js/ui/style-library-host.js` | One additive line each: call `app._modularProfileApplied?.(app, result)` after a profile lands. |

### 2.1 The profile contract (deliberate, strict)

A Style Profile may carry `global.modularEngine` — a **new key that is not in
the frozen v1 schema** (`js/engine/profile.js`). Adding a schema key is BE-owned,
and an unvalidated key would be dropped by `normalizeProfile`. So the rule is:

- `true` → ON · `false` → OFF · **absent / non-boolean → UNSET**
- UNSET **copies nothing** — a profile with no opinion must not reset the user's toggle
- an explicit `settings.modular` **wins** over the profile's opinion (the same
  precedence `engine.js#generate()` applies), so a profile cannot silently switch
  the engine out from under a user who chose one
- `'true'` (a string) is UNSET, not ON: a hand-edited JSON export must not
  silently enable an opt-in

### 2.2 Why the controls setting is written too

`app.generate()` calls `controls.getSettings()` then `engine.setSettings(...)`.
A flag set only on the engine would be **overwritten back to false** on the next
generate. Both are written, and the controls panel is re-synced.

---

## 3. Evidence (raw, on this machine)

```
$ node tests/modular-switch.test.js
  === Track R6 modular switch: Passed 22  Failed 0 ===

$ NODE_PATH=<...> CHROME_BINARY=<...> node scripts/modular-switch-ui-probe.cjs --width=1440
  ✓ the toggle exists in the shell
  ✓ engine default is OFF (got false)
  ✓ controls default is OFF (got false)
  ✓ aria-pressed starts false (got false)
  ✓ target >= 44px tall (got 44)
  ✓ on-screen · ✓ hit-testable at its centre
  ✓ has an accessible name (got "Engine: legacy painter")
  ✓ click turns the ENGINE setting on (got true)
  ✓ click turns the CONTROLS setting on too (got true)
  ✓ aria-pressed true · ✓ label reads Modular
  ✓ legacy path paints ink (65536 px / 597 colours)
  ✓ modular path paints ink (65536 px / 31 colours)
  ✓ the two engines plan DIFFERENT stroke sets (geo 662958969 vs 1195893483)
  ✓ modular path returns shapes (281)
  ✓ the modular picture differs from the legacy one (digest 1529245609 vs 1582129535)
  ✓ second click restores OFF in both places
  ✓ legacy stroke set is identical after toggling back (geo 662958969 vs 662958969)
  ✓ no console/page errors
  PASS
  (--width=390 PASS · --width=768 PASS · --width=1440 PASS)

$ node scripts/visual-regression.cjs     -> pass=9 fail=0 error=0   (pins UNMOVED)
$ node scripts/a11y-sweep.cjs --widths=390,768,1440
  @390  controls 48 underMin 0 noName 0 offViewport 0 (rail 0) clipped 0 docOverflowX 0
  @768  controls 48 … offViewport 0 (rail 0) …
  @1440 controls 32 … offViewport 0 (rail 0) …
$ node tests/{engine,modular-bridge,modular-switch,r4,outlines,order,shaping,
       ref-analyze,style-library,export-panel,primitive-mixer,style-polish,
       style-accuracy,wetsim,masks,bake}.test.js
  engine 177 · modular-bridge 22 · modular-switch 22 · r4 43 · outlines 16
  order 24 · shaping 18 · ref-analyze 29 · style-library 62 · export-panel 90
  primitive-mixer 20 · style-polish 11 · style-accuracy 9 · wetsim 15
  masks 19 · bake 6        (all Failed 0)
```

Artefacts: `docs/research/modular-switch-ui.json`,
`docs/research/modular-switch-ui-{390,768,1440}.png`.

---

## 4. Three defects found (all in my own new code, all fixed)

1. **The legacy baseline was vacuous.** The app constructs the engine with
   `useWorker: true`; `_generateViaWorker` resolves via a worker round-trip, so
   measuring right after `generate()` read a layer with **0 strokes** — the
   first run's "legacy" numbers were an empty canvas. Fixed by forcing
   `useWorker = false` and awaiting the baseline generate.
2. **A "non-white pixels only" digest made two different pictures compare
   equal.** The legacy path paints a flat near-white background FILL; the
   modular path does not, so filtering near-white discarded exactly the
   difference under test. Fixed: digest the **whole RGBA buffer**, and make the
   **stroke-set geometry digest** the primary signal.
3. **The shim's attach-time `_setStatus` broke a Maestro flow.**
   `app._setStatus` REPLACES the status bar's `innerHTML` to build its own
   `status-item` spans, which **destroyed `#status-message`** — the node
   `index.html` ships and `www-paint-desktop-regression` asserts on. That flow
   went from **33 COMPLETED to 2 COMPLETED + 1 FAILED**. The toggle now reports
   through its visible label + `aria-pressed` only; it never writes the status
   bar. Found by running the flow, **not** by the probe — the probe passed with
   the defect in place.

## 4b. A hit-fail that is NOT from this stream (and how it was proved)

`scripts/overlay-coverage-probe.cjs` reports `controls-root hitFail 3` at 1440px
(`Rings`, `Rings In`, `Clock` → `footer.status-footer`). Measured both ways:

- the panel's `scrollHeight` is **1179 with and without** my nav button;
- the three controls sit at **y=878**, under the footer, at `scrollTop 0`, and
  become tappable once the panel is scrolled;
- `underMin 0`, `pastViewport 0`, `clip 0` at every width.

This is the **§0.11 PATH ORDER overflow** — ThinkPad-owned (`controls.js` +
`css/style.css`) and already recorded. Not touched.

---

## 5. ⚠ Recorded finding — the legacy canvas path is NOT pixel-deterministic in headless

**Measured, not inferred.** With the SAME 50 legacy shapes, repeated renders in
headless Chromium produced **two different pixel digests**:

```
legacy, 4 identical generate+render cycles:
  979557227 · 979557227 · 1807866545 · 1807866545
modular, 4 identical cycles:
  3526894867 · 3526894867 · 3526894867 · 3526894867   (stable)
```

- The **stroke set is identical** across every legacy run (`shapesIdentical: true`),
  and `isBrushReady()` is `false` in headless — so the stamp/WebGL path is
  absent and the custom canvas renderer is in play.
- The 9 **pinned visual baselines do not move** (`pass=9 fail=0 error=0`), so
  this does not invalidate the harness. The harness launches with
  `--disable-gpu` (AGENTS.md §0.7 / H-S4) and compares against its own pins.
- It is recorded because it means a pixel digest across the legacy path is an
  unreliable oracle in headless; the probe now asserts on **stroke geometry**
  (deterministic) and reports the pixel digest for reference.
- **Not fixed here** — the render path is BE-owned (`renderer.js` / `painter.js`).
  Raised for BE in `docs/MAC-TASKS.md`.

---

## 6. Scope — what this does NOT claim

- **No parity claim.** Whether the modular engine beats `painter.js` is
  `scripts/parity-bench.cjs`'s gate (BE-owned). R3 measured the modular engine
  **1.46 points from the reference** on `blobs`; the switch makes the app path
  reachable, not won.
- **Not the R6 finish.** BE must still run the parity bench on the app path and
  decide whether the default flips. This lands the **UI**, not the retirement.
- **No ThinkPad-owned file touched.** `index.html` gained 3 additive lines
  (1 button, 1 import, 1 call); `css/style.css` untouched; no engine file
  touched. The 9 pins are unmoved by construction.
- **Multi-layer still routes through the Painter** (`engine.js`'s own branch),
  so the toggle is a single-layer switch — the engine's existing contract.

## 7. Files

- `js/ui/modular-switch-core.js` (NEW) · `js/ui/modular-switch-host.js` (NEW)
- `tests/modular-switch.test.js` (NEW, 22) · `scripts/modular-switch-ui-probe.cjs` (NEW)
- `index.html` (additive) · `js/ui/react-host.js` (+1 line) · `js/ui/style-library-host.js` (+1 line)
- `docs/research/modular-switch-ui.{json,png}` · `AGENTS.md` §7 (this entry)

## 8. Next

**BE:** verify + push (sole GitHub writer). Then the R6 gate — `parity-bench.cjs`
on the **app path** (the toggle is now reachable) and the accept/reject call on
the soft-edge finding. **Mac:** the next ui-sdk panel (export & share over
`export-panel-core.js`), or the standing M15 QA seat.
