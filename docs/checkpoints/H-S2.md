# Checkpoint H-S2 — reference confidence is surfaced (Track S hygiene)

**Date:** 2026-11-16 · Agent: Mac / AIR HERMES · Hygiene item **H-S2**
**Goal:** when refs are weak or inconsistent, surface a confidence and force
safer defaults · **Status:** delivered, browser-verified at 390 / 768 / 1440

**Files:** `js/ui/style-library-core.js` · `js/ui/style-library.js` ·
`css/style.css` · `tests/style-library.test.js` · `scripts/style-library-probe.cjs`
· `scripts/ref-confidence-probe.cjs` (NEW) · `docs/research/ref-confidence.json`
· `docs/research/ref-confidence-{390,1440}.png`
**Untouched:** every engine render path and every ThinkPad-owned file — the 9
pinned baselines are unmoved.

---

## 1. The problem, precisely

`ref-analyze.fuseReferences()` has always emitted a **`spread`** object:

```js
spread = {
  agreement:  clamp01(1 - pairwiseMean(refPacketDistance)),  // the headline
  scale:      pairwiseMean(histogramDistance),              // per-axis spread
  orientation: pairwiseMean(1 - orientationMatch),
  coherence:  ±1σ spread of mean coherence,
};
```

and **nothing read it**. Consequences:

- A profile fused from **four mutually-contradictory** references was
  indistinguishable from one built from a **single** reference.
- `scoreProfileStyle` consumes the fused packet; a packet that is a *compromise*
  between references that disagree is not a style target, and the app said
  nothing.
- There was no safe-default path: nothing told the user to treat such a profile
  as a starting point.

H-S2 is the UI half of the item (the signal half already existed). The engine
files are ThinkPad-owned, so **no metric, threshold or default changed**.

---

## 2. What landed

### 2.1 `js/ui/style-library-core.js` — pure, node-testable

| Export | Role |
|---|---|
| `REF_CONFIDENCE` | the band thresholds, `{ good: 0.8, fair: 0.5 }` |
| `refConfidenceBand(agreement)` | `good` / `fair` / `low`, and `none` for a non-number |
| `REF_CONFIDENCE_LABELS` | `consistent` / `mixed` / `conflicting` / `no reference` |
| `refConfidenceAdvice(band)` | the safe-default sentence; `none` → `''` (silent by design) |
| `referenceConfidence(profile)` | reads `provenance.refPacket.spread`, tolerantly |
| `summarizeProfile` | **+ `refCount` and `refConfidence`** |

The thresholds are a **display convention**, deliberately coarse, and derived
from the fusion's own outlier rule (`FUSION_DEFAULTS.outlierRatio = 1.5`,
`outlierThreshold = 0.25`) rather than invented. `agreement` is `null` — not `0`
— when there is no packet, because `0` reads as *"references maximally
disagree"* when the truth is *"there were no references"*. Pinned by test.

### 2.2 `js/ui/style-library.js` — the chip

Every row whose profile carries a packet renders:

```
conflicting · 4 refs 49%
```

- **A text word, not an icon.** Colour is the secondary channel, so a
  colour-blind user and a monochrome screenshot both read it. `tabular-nums`
  stops the `%` jittering.
- **Hover** (`_confidenceTitle`) exposes the evidence: `agreement`, per-axis
  `scale spread` / `orientation spread` / `coherence spread`, and the
  down-weighted outlier count — so the number behind the word is inspectable
  without a console.
- **`refCount === 0` renders nothing at all.** A library of ordinary profiles
  keeps the exact row it had; no layout shift, no noise.
- **Apply** appends `refConfidenceAdvice(band)` for any band that is not `good`,
  so the safe-default half lands at the moment of use rather than only in a list
  row. A `good` profile is never handed the warning (asserted).

### 2.3 `css/style.css` (+47 lines)

`.library-row__ref[-—good|fair|low]`. `good` is deliberately quiet (it is the
default state), `low` is the only accent-tinted band because the safe-default
advice depends on it being seen.

---

## 3. Three defects, two in my own new code

1. **The chip was nested inside the select `<button>`.** `select.appendChild(ref)`
   put labelled, `title`-carrying content inside a button — nested interactive
   content, and the button's accessible name would have swallowed it. Moved to
   `.library-row__main` as a sibling. The probe now asserts `chipOutsideButton`.
2. **The probe read a stale DOM.** The panel renders rows from `library.list()`
   on **its own** refresh; a probe writing straight into the library was
   measuring the previous run's rows. It now calls `panel.refresh()`.
3. **The probe's fixture could not produce the band under test.** `A,B,S` fuses
   to agreement **0.53** — `fair`, not `low` — so the probe demanded a chip its
   own fixture could not build. A false failure that looks exactly like a
   product defect. Measured the real landscape (below), replaced the fixture,
   and now **records** `fixtureAgreementGood/Bad` as asserted output so the
   fixture is part of the contract.

### Measured agreement landscape (64×64 synthetic refs, real `analyzeReference`)

| References | agreement | band |
|---|---|---|
| `A, invA` (same structure, inverted) | 1.0000 | good |
| `A,B` (two gradients) | **0.8315** | good |
| `A,B,horiz` | 0.8000 | good |
| `A,B,dark2` | 0.8342 | good |
| `A,dark2` | 0.7513 | fair |
| `A,horiz` | 0.7016 | fair |
| `A,B,vert` | 0.6787 | fair |
| `A,B,dark1` | 0.6593 | fair |
| `A,B,gray,gray` | 0.6272 | fair |
| `A,B,gray` | 0.5991 | fair |
| `A,B,black,black` | 0.5603 | fair |
| `A,A,black,black` | 0.5385 | fair |
| `A,B,black` | 0.5323 | fair |
| `A,vert` | 0.5349 | fair |
| `A,gray` | 0.5357 | fair |
| `A,B,white` | 0.5046 | fair |
| `A,B,black,white` | **0.4944** | **low** ← the fixture |
| `A,black` | 0.3078 | low |

Two things this table is worth keeping: **a single reference always fuses to
agreement exactly 1** (`pairwiseMean` of one item is 0 by definition — pinned by
test, and correct: one reference cannot disagree with itself), and **the band is
a property of the SET, not of any one reference** — `A,B` alone is `good` while
`A,B` plus two contradictory refs is `low`.

---

## 4. Two probe-environment traps (both would have recurred every run)

- **`localStorage` persistence.** The library persists under
  `www-paint.styleProfiles.v1`, so a re-run inherited the previous run's
  profiles — row lookups *by band* matched a stale row and reported a defect
  that was really the probe's own state. The probe clears the key and reloads.
- **The library rail starts HIDDEN.** At the probe's 1280px viewport
  `_libraryMode` is `false`, so every chip measured **0×0** — a vacuous pass,
  the exact trap the a11y sweep documents (`layersRail open=true rowW=…`). The
  probe now opens the panel via `#btn-library-mode`, waits past the 280ms
  slide-in, and asserts `panelOpenState` before trusting any geometry.

---

## 5. Verification (raw)

```
$ node tests/style-library.test.js -> Passed: 62  Failed: 0   (was 50, +12)

$ node scripts/style-library-probe.cjs
  chipCountNoPacket 0 · chipCountWithPacket 2 · goodChipBand "good"
  chipBand "low" · chipText "conflicting · 4 refs 49%"
  chipTitle "conflicting: 4 references · agreement 49% · scale spread 67% ·
             orientation spread 3% · coherence spread 96%
             References disagree strongly — treat this profile as a starting
             point, not a matched target. Check the reference set."
  chipOnScreen true · chipInsidePanel true · chipNoClip 0 · chipOutsideButton true
  fixtureAgreementGood 0.8315 · fixtureAgreementBad 0.4944
  conflictingAdviceShown true · goodAdviceAbsent true
  PASS

$ node scripts/ref-confidence-probe.cjs
  @390  chip 125.6x13@18 band=low "conflicting · 4 refs 49%" hit=SPAN.library-row__ref rowH=92 docOverflowX=0
  @768  chip 125.6x13@18 band=low "conflicting · 4 refs 49%" hit=SPAN.library-row__ref rowH=92 docOverflowX=0
  @1440 chip 125.6x13@18 band=low "conflicting · 4 refs 49%" hit=SPAN.library-row__ref rowH=92 docOverflowX=0
  PASS — 3 width(s), every chip on-screen, unclipped, inside its panel
  (also asserts: packet-less row renders 0 chips; row + action bar inside panel;
   chip hit-tests to itself; no document overflow; 0 page errors)

$ VISION review — docs/research/ref-confidence-390.png
  both chips "fully visible, unclipped, and not truncated";
  "clear vertical space between the chip and the Apply/Export/Delete button row …
   there is no overlap"; "no visual defects for these chips at this width";
  the packet-less row correctly shows no chip.

$ 14 suites, all Failed 0: engine 164 · export-panel 90 · r4 43 · ref-analyze 29
    modular-bridge 22 · style-library 62 · primitive-mixer 20 · style-polish 11
    style-accuracy 9 · wetsim 15 · masks 19 · outlines 16 · order 24 · shaping 18
$ node scripts/visual-regression.cjs  -> pass=9 fail=0 error=0   (pins UNMOVED)
$ node scripts/a11y-sweep.cjs --widths=390,768,1440 -> all zeros; layersRail rowW 302/302/242
$ node scripts/overlay-coverage-probe.cjs --widths=390,768,1440
    style-library-root hitFail=0 pastViewport=0 clip=0 docOverflowX=0 minControl=44
$ node scripts/rail-overlay-probe.cjs -> PASS — 0 of 9 sizes failed
$ node scripts/media-panel-probe.cjs  -> 4 PASS lines
$ node scripts/export-panel-probe.cjs -> PASS (0 page errors)
$ MAESTRO 10 flows at authored sizes -> 301 COMPLETED / 0 FAILED
```

---

## 6. Scope — what this does NOT claim

- **No metric, no weighting, no threshold change in the engine.** H-S2 is a
  *surface*. The band edges (`0.8` / `0.5`) are presentation, and the doc says so
  where they are declared.
- **No re-baseline.** No render path touched; the 9 pins are unmoved.
- **Not a calibration claim.** The chip reports the fusion's own `spread`; it
  does not assert that a `low` profile *will* look wrong. That would need the
  S10 matrix, which is BE's.
- **Not done:** surfacing confidence where a profile is *created* from refs
  (there is no ref-picker UI in the app yet — the packet arrives via
  `attachFusedReference` / import), and H-S2's second half in `docs/STYLE_PROFILE.md`
  (ThinkPad-owned; raised, not edited).

---

## 7. Hand-off

- **BE — raised, not edited** (ThinkPad-owned): `docs/STYLE_PROFILE.md` §3.5
  documents `provenance.refPacket` but not its `spread` confidence or the
  `consistent`/`mixed`/`conflicting` bands. Worth one paragraph so the schema
  doc and the UI agree. Also `docs/ROADMAP_STATUS.md`'s H-S2 row still reads
  `todo` — that file is shared (propose, don't edit).
- **Next:** Track-S hygiene left is H-S3 (roadmap truth) and H-S4 (the visual
  harness has no WebGL2) — **both are ThinkPad-owned files**, so both are BE's.
