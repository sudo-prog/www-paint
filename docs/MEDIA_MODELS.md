# Media Models (Phase 0.4)

**Status:** baseline · 2026-11-10 · Owner: BE (ThinkPad)
**Schema coupling:** the `mediaModel` object in `docs/STYLE_PROFILE.md` §2.

> A **media model** describes the *physical* behaviour of the medium — how
> pigment sits on, flows into, or stands up off the paper. The Style Profile
> carries one per profile; the renderer chooses a pipeline from `kind`.
>
> This is the design note for Phase 3 (Wet Media Simulation) and the parameter
> vocabulary the style renderers read. Phase 0 only freezes the vocabulary; the
> wet/impasto *simulations* are later phases.

---

## 1. The three kinds

| `kind` | Behaviour | Target media | Simulation status |
|---|---|---|---|
| `dry` | Pigment sits on the surface; grain & scatter; no flow | pencil, charcoal, pastel, marker, pen, crayon, linocut, riso | **shipped** (per-style canvas math) |
| `wet` | Pigment flows while wet, stops when dry; bleed, tide lines, granulation | watercolor, ink-wash, sumi, gouache (thinned) | **partial** (procedural; no fluid solver) |
| `impasto` | Paint stands up as height; directional bristle, wet highlights, relief | oil, acrylic, palette knife, heavy gouache | **partial** (relief renderer approximates) |

---

## 2. Parameters

Frozen in `STYLE_PROFILE.md` §2 (`$defs/mediaModel`):

| Parameter | Range | Meaning |
|---|---|---|
| `kind` | `dry` \| `wet` \| `impasto` | selects the pipeline |
| `wetness` | 0–1 | how much the pigment can still move |
| `drying` | 0–1 | rate wetness decays along/across the stroke |
| `bleed` | 0–1 | edge diffusion (watercolor bloom) |
| `granulation` | 0–1 | pigment settling into paper texture |
| `height` | 0–1 | impasto relief amount (feeds the height/light buffer) |
| `bristle` | 0–1 | bristle streaking (oil/knife) |
| `paper` | string \| null | paper texture id (e.g. `coldpress-140`) |

`dry` models leave `wetness`/`drying`/`bleed`/`height` at 0. `impasto` models
use `height` + `bristle`. `wet` models use `wetness` + `drying` + `bleed` +
`granulation`.

---

## 3. How each style family maps

| Family | Suggested `mediaModel` |
|---|---|
| `pencil`, `charcoal`, `pastel` | `{ kind: "dry", granulation: 0.4–0.7 }` |
| `pen`, `calligraphy`, `marker`, `cross-hatch`, `halftone` | `{ kind: "dry", granulation: 0–0.2 }` |
| `watercolor`, `wash`, `sumi`, `ink` | `{ kind: "wet", wetness: 0.6–0.8, bleed: 0.4–0.6, granulation: 0.2–0.4 }` |
| `oil`, `knife`, `gouache` | `{ kind: "impasto", height: 0.4–0.7, bristle: 0.5–0.8 }` |
| 3D/material styles (`relief.js`) | stylised; `height` high, `kind` per material feel |

These are **suggested presets**, not hard bindings — the Style Profile can set
any valid combination, and a style may honour only the parameters its renderer
reads.

---

## 4. References (see `docs/REFERENCES.md`)

- **wet / flow:** `inkwash` (wetness + velocity + pigment grid), `watercolor-playground` (wet-gated flow, tide lines), `wet-paint-flow` (structure-tensor ribbons, height + wetness + bristle channels).
- **height / impasto:** `dli/paint` (Fluid Paint — separate colour vs height/wetness/bristle; height-normal wet shading), "Birth of a Painting" (differentiable smudge).
- **dry grain:** already implemented per-style via seeded RNG + paper texture.

---

## 5. Phase 3 note (not Phase 0)

Phase 3.1 is a **research spike**: pick a *minimal* fluid model (pigment grid +
wetness gate, no full Navier–Stokes) and get it approved in
`docs/checkpoints/P3.1.md` before any implementation. The success test is the
roadmap's: *"same bloom on wet, hard edge on dry; acceptable preview
performance."* The `mediaModel` vocabulary above is what that spike will consume.
