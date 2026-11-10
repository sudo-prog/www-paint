# Style Inventory (Phase 0.3)

**Status:** frozen baseline · 2026-11-10 · Owner: BE (ThinkPad)
**Source of truth:** `js/styles/index.js` (the registry) + per-style headers.

> Which styles exist, which **render path** they use, and a first-pass quality
> note. The registry is authoritative; this table is the human index of it.
>
> **Honesty note:** quality notes are derived from (a) the roadmap's own
> assessment in `docs/ROADMAP.md` §2, and (b) reading each style's algorithm
> header. They are *inspection-based*, **not** measured. Phase 0.2 baselines and
> Phase 1 visual work are what turn these into measured judgements; columns
> marked "not yet baselined" have no pixel baseline yet.

---

## 1. Count

| Metric | Value |
|---|---|
| Registered styles | **51** |
| Categories | draw, paint, graphic, craft, 3d |
| Stamp-engine styles (`p5.brush` + canvas fallback) | 2 (`pencil`, `charcoal`) |
| Relief/3D-material styles (`js/engine/relief.js`) | 16 |
| Pure-canvas procedural styles | 33 |

**Doc drift fixed:** `ARCHITECTURE.md` still says "Styles implemented: 14" — that
is stale (written 2026-10-15). The registry has had **51** since the material
set landed.

---

## 2. Render paths

- **Stamped brush** — walks a path in small steps stamping a tip; pressure
  profile, grain, scatter. Uses the real `p5.brush` engine when available
  (`js/engine/brush-stamp-engine.js`) with a hand-written canvas fallback.
  *Styles:* `pencil`, `charcoal`.
- **Relief / 3D material** — a shared material renderer
  (`js/engine/relief.js`, `renderReliefShape`) with a material id; paints
  lit-looking "ropes"/flakes/blobs. *Styles:* the 16 in §4.
- **Canvas procedural** — each style's own `render(ctx, shape, progress)`
  draws directly on the 2D canvas. *Everything else.*

The Painter (`js/engine/painter.js`) produces the strokes; styles decide how a
stroke *looks*. Both stamp styles keep a canvas fallback so they never hard-fail
if `p5.brush` is absent.

---

## 3. Core / draw / paint / graphic / craft

| Style | Label | Cat | Render path | Algorithm (from header) | Quality note |
|---|---|---|---|---|---|
| `pencil` | Pencil / Graphite | draw | stamped brush | stamped tip; pressure + grain + scatter + 2-pass | advanced (roadmap); Phase 0.2 baseline |
| `ink` | Ink Brush | paint | canvas | loaded brush swells/tapers | advanced (roadmap); Phase 0.2 baseline |
| `watercolor` | Watercolor | paint | canvas | (allied to `wash`) | advanced (roadmap); Phase 0.2 baseline |
| `oil` | Oil / Acrylic | paint | canvas | bristle strokes | advanced (roadmap); Phase 0.2 baseline |
| `graffiti` | Graffiti / Spray | paint | canvas | particle spray | solid; not yet baselined |
| `graphic` | Flat Graphic | graphic | canvas | clean flat shapes, bold colour | Phase 0.2 baseline |
| `charcoal` | Charcoal | draw | stamped brush | heavy grain, soft smudgy edges | advanced (roadmap); Phase 0.2 baseline |
| `marker` | Alcohol Marker | draw | canvas | 45° chisel band, darkening overlaps | solid; Phase 0.2 baseline |
| `calligraphy` | Calligraphy | draw | canvas | pressure-sensitive ribbon | solid; not yet baselined |
| `cross-hatch` | Cross-hatch | draw | canvas | angled hatch lines | solid; Phase 0.2 baseline |
| `mosaic` | Mosaic | graphic | canvas | grid tiles + grout line | solid; not yet baselined |
| `scribble` | Scribble | graphic | canvas | back-and-forth pen in-shape | solid; not yet baselined |
| `halftone` | Halftone | graphic | canvas | 45° dot screen, radius by tone | solid; Phase 0.2 baseline |
| `string` | String Art | craft | canvas | straight lines on a grid | solid; not yet baselined |
| `sumi` | Sumi Ink | paint | canvas | bold wet ink, variable width | solid; not yet baselined |
| `gouache` | Gouache | paint | canvas | opaque matte body + darker edge | solid; not yet baselined |
| `knife` | Palette Knife | paint | canvas | broad flat strokes, hard edges | solid; not yet baselined |
| `pastel` | Pastel | draw | canvas | chalky grain + soft edges | solid; not yet baselined |
| `pen` | Pen | draw | canvas | constant-width crisp line | solid; not yet baselined |
| `wash` | Wash | paint | canvas | translucent broad, feathered edge | solid; not yet baselined |
| `dots` | Dots | graphic | canvas | stipple on a grid | solid; not yet baselined |
| `confetti` | Confetti | graphic | canvas | rotated rects/triangles | novelty; not yet baselined |
| `hylics` | Hylics | graphic | canvas | lumpy wobbly blobs | novelty; not yet baselined |
| `linocut` | Linocut | graphic | canvas | carved high-contrast shapes | solid; not yet baselined |
| `riso` | Riso | graphic | canvas | 2–3 spot inks, misregistration | solid; not yet baselined |
| `tape` | Tape | craft | canvas | flat strips, hard edges | novelty; not yet baselined |
| `thread` | Thread | craft | canvas | wound lines w/ stitch direction | solid; not yet baselined |
| `stitch` | Stitch | craft | canvas | regular X-stitch grid | solid; not yet baselined |
| `neon` | Neon | graphic | canvas | glowing tube, bright core + halo | solid; not yet baselined |
| `bokeh` | Bokeh | graphic | canvas | soft overlapping circles + rims | solid; not yet baselined |
| `paper` | Paper | graphic | canvas | flat shape + drop shadow + deckle | solid; not yet baselined |
| `glitch` | Glitch | graphic | canvas | RGB split + slice displacement | novelty; not yet baselined |
| `frost` | Frost | graphic | canvas | icy speckle + small shards | novelty; not yet baselined |
| `embroid` | Embroidery | craft | canvas | dense satin-stitch bands | solid; not yet baselined |
| `plast` | Plastic | graphic | canvas | glossy molded plastic | solid; not yet baselined |

---

## 4. 3D / material styles (relief renderer)

All 16 share `js/engine/relief.js` with a numeric material id; each paints
lit-looking geometry. Quality: **inspection-based first pass — no pixel baseline
yet.** These are the least real-world-verified styles and a Phase 1 target
(lighting/material tuning), not a Phase 0 blocker.

| Style | Label | Material note |
|---|---|---|
| `ceramic` | Ceramic | glazed clay |
| `stone` | Stone | rough mineral |
| `metal` | Metal | brushed metal |
| `chrome` | Chrome | mirror metal |
| `glass` | Glass | transmissive |
| `lens` | Lens | refracting |
| `crystal` | Crystal | faceted |
| `gold` | Gold | gold-leaf ropes + cracks |
| `bronze` | Bronze | patinated |
| `copper` | Copper | warm metal |
| `pewter` | Pewter | dull metal |
| `foam` | Foam | soft porous |
| `beads` | Beads | rounded beads |
| `puffy` | Puffy | inflated |
| `terrazzo` | Terrazzo | chip aggregate |
| `molten` | Molten | hot glowing |

---

## 5. Maintenance

Update this file whenever a style is added to, removed from, or materially
changed in `js/styles/index.js`. The registry count and this table must agree;
add a check to the Phase 0.2 suite to assert `getAllStyles().length === 51` (or
whatever the registry reports) so the two never drift again.
