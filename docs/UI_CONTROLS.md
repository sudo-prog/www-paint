# UI Controls Reference

**Last updated:** 2026-11-10 · Agent: BE (ThinkPad)

What every control in the left-hand **Brush** panel does, and which engine
parameter it drives. The panel is built by `js/ui/controls.js`
(`ControlsManager`); control changes are dispatched as a `settings-change`
event, collected in `js/ui/app.js` → `generate()` and handed to
`PaintingEngine.generate()`, which passes them to the **Painter**
(`js/engine/painter.js`) — the actual painting engine the app uses.

> Where a control lives: **BRUSH** · **STRUCTURE** · **PATH ORDER** ·
> **MOTION & PATH** · **COLOR**, then the **Generate / Stop / Reset** buttons.

---

## BRUSH

| Control | Settings key | Drives | Default |
|---|---|---|---|
| Stroke Min / Max | `strokeSize` | Painter stroke size range | 6 / 28 |
| Density | `strokeCount` | Max committed strokes (`maxShapes`) | 5,000 |
| Detail | `detailLevel` | Detail bias in stroke sizing | 70% |
| Strength | `styleStrength` | Style-effect intensity | 80% |
| Opacity | `opacity` | Stroke alpha | 85% |
| Randomness | `randomness` | Size/position jitter | 30% |
| Scatter | `scatter` | Position scatter | 30% |

---

## STRUCTURE  *(new in Phase 1.2)*

Smart mode builds the image's **structure tensor** — a per-pixel estimate of the
local edge orientation plus a **coherence** value (how strongly oriented the
neighbourhood is). The Painter uses it to lay strokes *along* edges and to trace
the local flow, so lines follow contours instead of being random. These controls
tune that guidance.

| Control | Settings key | What it does | Default |
|---|---|---|---|
| **Smart Mode** | `smart` | Master switch. **On** → build the structure tensor + focus map + subject detection and steer strokes along the flow. **Off** → ignore image structure entirely; strokes are placed/rotated randomly. | On |
| **Edge Follow** | `structureAlign` | `0–100%`. How often a stroke is *seeded* along the local tangent (weight on `0.3 + 0.65·coherence`). **100%** = full original behaviour; **0%** = never seed along the field (strokes start at random angles and rely on optimisation). | 100% |
| **Align Wobble** | `alignJitter` | `0–29°`. Gaussian wobble added around the tangent angle. Low = tight, mechanical flow; high = loose, hand-drawn feel. | 7° |

**Notes**

- Both sliders are **ignored when Smart Mode is Off** (there is no field to
  follow). The section shows a one-line hint saying so.
- The Painter's hill-climbing re-optimises every stroke as it paints, so the
  final image tends to re-align even at Edge Follow 0. The slider changes how
  strokes are **seeded** (and how long the guided ones are) — see
  `docs/checkpoints/P1.md` §"UI surfacing" for measured numbers.
- Implementation: `painter.js` — `this.structureAlign` / `this.alignJitter`
  (clamped), applied in `guidedShape()`. Defaults (1, 0.12) reproduce the
  previous output **byte-for-byte**, so existing visual-regression baselines are
  unchanged.

---

## PATH ORDER

`order` → Painter `orderSetup` kind: `free` (random) plus **DOWN / UP / RIGHT /
LEFT / DIAGONAL / SPIRAL / SPIRAL IN / RINGS / RINGS IN / CLOCK**.
`free` is a sentinel: unrecognised values skip `orderSetup` → random placement.

## MOTION & PATH

| Control | Settings key | Drives |
|---|---|---|
| Single / Multi | `multiLayer` | Multi-layer render: each stroke is tagged `background / shadows / outline / midtone / highlights` before generation |
| One Line | `oneLine` | Pen never lifts |
| Outline (Off/First/Last) | `outline` | Canny edge-chain outlines burned first/last |
| Region fill (Off/Scribble/Rows) | `rfill` | Flood-fill region interior painting |

> Playback controls (play/pause, speed, scrubber) are rendered separately by
> `MotionController` into `#motion-controls`, not in this panel.

## COLOR

`colorMode`: **Exact** (sampled colour) · **Quantized** (limited levels) ·
**Palette** (`paletteSize`, default 8 nearest colours).

---

## Two structure implementations — which is which

There are **two** structure-tensor implementations in the repo. Know which one
you are touching:

| | **Painter** (what the app paints with) | **Modular engine** (`analyzer.js` + `generator.js`) |
|---|---|---|
| Entry | `js/engine/painter.js` `analyse()` | `analyzer.js` `computeStructureTensor()` |
| Outputs | internal `Tan` / `Coh` / `Edge` (+ focus map `Wt`, subject `Sub`) | exported `orientation` / `coherence` / `energy` (+ `Jxx/Jyy/Jxy`) |
| Consumer | `guidedShape()`, `trace()` — live painting | `generateCandidates()` via the `alignToStructure` setting; test suite; `scripts/structure-debug.cjs` debug map |
| UI surface | **STRUCTURE section** (this doc) | none — driven programmatically |
| Default | on (`smart`) | `alignToStructure: false` |

`alignToStructure` (the modular generator setting) is **not** wired to the
Painter; it is exercised by the unit tests and available to the modular
`generateCandidates` path. Unifying the two onto one shared tensor is future
work (roadmap Phase 4/6).

---

## Related

- `docs/checkpoints/P1.md` — Phase 1.2 design + verification.
- `docs/ROADMAP_STATUS.md` — phase status.
- `scripts/structure-debug.cjs` → `docs/research/structure-debug.png` — debug map.
- `scripts/structure-controls-probe.cjs` — asserts the STRUCTURE controls exist,
  that changing them changes painter output, and screenshots the panel.
