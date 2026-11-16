# Checkpoint R6 (BE half) — the modular-engine switch

**Date:** 2026-11-16 · Agent: BE / ThinkPad · Stream **Track R6, BE half**
**Goal:** make the modular engine (the engine of record) reachable from the app.
`engine.js#generate()` ran the legacy `painter.js`, so **none of R1–R5 was
shipped** — the Mac's `modular-bridge.js` made the switch a wiring point; this is
the switch.
**Status:** landed; **opt-in, default off**; OFF path byte-identical (9/9 pins).

---

## 1. What landed

- **`js/engine/engine.js#generate()`** gains the R6 switch. With
  `settings.modular` (or an explicit `opts.modular`) **on**, the paint is planned
  by `buildModularPlan` (`js/engine/modular-bridge.js`) instead of the Painter.
  The block runs before the worker/Painter paths and returns early, assigning the
  planned shapes to the active layer exactly as the Painter path does.
  **Single-layer only for now** — multi-layer still routes through the Painter.
- **`js/engine/generator.js`** — `DEFAULT_SETTINGS.modular = false`.
- **`scripts/modular-switch-probe.cjs`** (NEW) — real Chromium; drives
  `engine.generate({ modular: true | false })` end-to-end through the app's own
  `PaintingEngine`, asserts both paths return engine-format shapes and paint real
  ink, the default is off, and the only 404 is the favicon.

`buildModularPlan` returns `{ used:false, shapes:[] }` whenever `enabled` is
false, so the **default** path is untouched — the two-line switch is zero-diff
until an opt-in flips it (HANDOFF.md §2.5).

---

## 2. Evidence (raw, on the ThinkPad)

```
$ node scripts/modular-switch-probe.cjs --width=1440 -> PASS
    default settings.modular is false (got false)
    modular generate returns shapes (261)   engine-format, paints 18955 px / 32 colours
    painter generate returns shapes (250)   paints 39431 px / 582 colours
    0 non-404 console errors; every 404 is the favicon (0 404(s))
$ node scripts/modular-switch-probe.cjs --width=390  -> PASS
$ node tests/engine.test.js         -> Passed 164 Failed 0     (unmoved)
$ full 15-suite battery             -> every suite exit 0
$ node scripts/visual-regression.cjs -> pass=9 fail=0 error=0   (pins UNMOVED)
```

The modular render (18955 px / 32 colours) reproduces the Mac's
`modular-bridge-probe` number exactly, from a **different** entry point (the
engine switch, not a direct `buildModularPlan` call).

---

## 3. Scope — what this does NOT claim

- **OFF by default** → the app is byte-identical; the 9 pinned baselines cannot
  move, and that is proved (visual regression 9/9).
- **No parity claim.** Whether the modular engine beats `painter.js` is
  `scripts/parity-bench.cjs`'s gate; this switch makes the app path *reachable*,
  not *won*. The parity bench's `images` payload is unchanged.
- **No UI toggle yet.** Nothing in `js/ui/*` sets `settings.modular`; wiring a
  visible control is a separate step and a BE-owned change (`controls.js`).
- **Multi-layer is not switched.** `multiLayer` mode keeps the Painter path.

## 4. Next

- A UI control that flips `settings.modular` (BE-owned `js/ui/controls.js`).
- Run `parity-bench.cjs` **on the app path** once the toggle is reachable.
