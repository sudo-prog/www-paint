# Stroke-language primitives (Track-S S5)

**Status:** **S5 landed** — 2026-11-15 · Owner: **BE** (contract + engine) · **Mac half
issued as M16** (see §7) · Module: `js/engine/primitives.js` · Evidence:
`docs/checkpoints/S5.md` + `scripts/primitives-probe.cjs` → `docs/research/primitives-probe.json`

> A Style Profile could previously name only a **registry style** — one flat menu
> of 51 finished looks. It could author its *schedule* (`passes[]`, S4) but every
> pass still resolved to a whole style name. S5 adds the missing middle layer: a
> small, **mixable set of stroke-language primitives**. A profile weights them per
> level, and the AI harness can propose **weights** instead of only style names.
>
> **This is a vocabulary, not a new renderer.** Every primitive resolves to a
> registry style and a `brush-media` preset the repo already has; the test suite
> and the probe assert that resolution, so a primitive can never point at a style
> that was renamed away.

---

## 1. The set

Six primitives, in canonical order (`PRIMITIVE_IDS`). Canonical order is part of
the contract: resolvers always return primitives in this order (determinism), and
a dominant-weight **tie breaks on it**.

| Primitive | Label | Registry style | `brush-media` preset | tip | media kind |
|---|---|---|---|---|---|
| `dry-stamp` | Dry stamp | `pencil` | `pencil` | `cpencil` | dry |
| `wet-wash` | Wet wash | `wash` | `wash` | `HB` | wet |
| `bristle` | Bristle | `oil` | `gouache` | `marker` | impasto |
| `smudge` | Smudge | `charcoal` | `charcoal` | `charcoal` | dry |
| `hatch` | Hatch | `cross-hatch` | `pen` | `pen` | dry |
| `spatter` | Spatter | `graffiti` | `spray` | `spray` | dry |

Each primitive also declares a **stroke language** — the geometry it contributes
to a pass. These are the same knobs a pass-plan entry carries, so a mix is a
*measured* change to the paint schedule, not a label:

| Primitive | `radiusMul` | `blur` (× base R) | `elongMul` | `alpha` | `detail` |
|---|---|---|---|---|---|
| `dry-stamp` | 0.34 | 0.06 | 0.90 | 0.95 | 0.85 |
| `wet-wash` | 1.55 | 0.90 | 1.00 | 0.55 | 0.45 |
| `bristle` | 0.80 | 0.12 | 1.85 | 0.90 | 0.70 |
| `smudge` | 1.10 | 0.60 | 0.70 | 0.50 | 0.50 |
| `hatch` | 0.24 | 0.02 | 2.40 | 0.85 | 0.95 |
| `spatter` | 0.50 | 0.15 | 0.40 | 0.35 | 0.90 |

…and a **media model** (`profile.mediaModel` shape — `kind`, `wetness`, `drying`,
`bleed`, `granulation`, `height`, `bristle`, `paper`), which `mixMediaModel()`
returns for a mix.

**Honesty note — read this before quoting the numbers.** The geometry and media
numbers above are a hand-set *declaration* of each medium's character (broad and
soft = wash; small and elongated = hatch). They are **not** a fidelity
measurement, and S5 makes **no** claim that a mix matches a reference. Whether a
particular mix *scores* well against a reference is Track-S **S10**'s matrix to
measure. `scripts/primitives-probe.cjs` reports what each primitive alone does to
a *photo-fidelity* score on synthetic content — that number is expected to get
*worse* for `wet-wash` and *better* for `hatch`, because it is the
feather-versus-detail trade S2 already documented.

---

## 2. Where a mix may be declared

A mix is a `{ "<primitive-id>": <weight> }` object (an array of
`{ id, weight }` / `{ primitive, weight }` / `[id, weight]` is also accepted).
Weights are relative — they are normalised to sum 1. Unknown ids and
non-positive weights are dropped.

| Level | Field | Schema | Notes |
|---|---|---|---|
| profile | `global.primitives` | optional | the profile-wide stroke language |
| layer | `layers[].primitives` | optional | per tonal role |
| pass | `passes[].primitives` | optional | per explicit pass (S4) |

**Precedence — most specific wins:** `pass` > `layer` > `global`. The resolution
helper is `primitives.resolvePrimitiveLevels({ pass, layer, global })`.

Declaring a mix is **opt-in at every level**. A profile that declares none
normalises to exactly the object it did before S5 (no empty key is invented), and
the engine, the optimiser and the scorer all take their previous code path —
`node` output and the 9 pinned visual baselines are byte-identical.

### Example

```json
{
  "schemaVersion": 1, "id": "…", "name": "Wash then hatch", "version": "1.0.0",
  "global": { "strokeCount": 1400, "primitives": { "wet-wash": 3, "hatch": 1 } },
  "layers": [{ "role": "highlights", "primitives": { "hatch": 1 } }],
  "passes": [
    { "id": "masses", "scale": "coarse", "primitives": { "wet-wash": 1 } },
    { "id": "accents", "scale": "fine", "layers": ["outline"], "radius": 0.25 }
  ]
}
```

Here the pass `accents` declares no mix → it inherits the profile-level
`{ wet-wash: 0.75, hatch: 0.25 }`… **unless** it is one of several passes, in
which case only `profileEffectiveStyle(profile, { passId })` resolves a per-pass
style; the *plan* applies the profile mix to every pass. See §4.

---

## 3. What a mix resolves to

| Question | Function | Answer |
|---|---|---|
| one primitive's definition | `resolvePrimitive(id)` | `{ id, label, style, media, mediaModel, language, mediaParams }` (deep copy) |
| canonical weights | `normalizePrimitiveMix(mix)` | `{ id: weight }`, canonical order, sums to 1, fixed point |
| is this mix valid? | `validatePrimitiveMix(mix, path)` | `{ ok, errors: [{ path, message }] }` (same shape as `validateProfile`) |
| the mix, resolved | `resolvePrimitiveMix(mix)` | `[{ id, weight, style, media, mediaModel, language }]` |
| the one-word summary | `dominantPrimitive(mix)` | highest weight (tie → canonical order), or `null` |
| the style to paint with | `effectiveStyle(mix, fallback)` | dominant primitive's registry style, else `fallback` |
| the geometry | `mixStrokeLanguage(mix)` | `{ radiusMul, blur, elongMul, alpha, detail, primitives, style }` or `null` |
| the media model | `mixMediaModel(mix, base)` | weighted model (`kind`/`paper` from the dominant), or `null` |
| the stamp parameters | `mixMediaParams(mix, overrides)` | weighted `resolveMedia()` block, or `null` |
| who uses which style | `primitiveStyleMix(mix)` | `{ style: totalWeight }` |

A **single** primitive returns its numbers *verbatim* (no float drift); a mix
returns the **weighted average** of the numeric fields, with enums (`kind`,
`brushName`, `paper`) taken from the dominant primitive — a brush tip is not an
average. An **empty** mix returns `null` (or `{}` for the weight map) — that is
the "take the previous code path" signal, not an error.

Profile-level accessors (in `js/engine/profile.js`):

- `profileGlobalPrimitiveMix(profile)` → the canonical global mix, or `null`
- `profileLayerPrimitiveMixes(profile)` / `profilePassPrimitiveMixes(profile)`
- `profileEffectiveStyle(profile, { passId })` → pass > layer > global, else `global.style`
- `profileToPrimitives(profile)` → `{ global, layers, passes, effectiveStyle }`
- `applyProfile(profile).primitives` → the same object (what the app reads)

---

## 4. How it drives the paint (engine of record)

`optimizer.resolvePassPlan(opts, baseR)` is the ONE seam (S4) and it owns the
primitives too:

- `OPTIMISER_DEFAULTS.primitives = null` — opt-in.
- A profile-level mix arrives as `optimiser.primitives` (carried by
  `score.profileToOptimiserOptions`). It **retunes the geometric schedule**: each
  pass's `radiusMul` / `blurR` / `elongMul` / `alpha` / `detail` come from the
  weighted mix, and the entry gains `primitives` (the canonical weights) and
  `style` (the dominant primitive's registry style).
- A pass may override with its own `passes[].primitives`.
- An **explicit** per-pass `radius` / `blur` / `elongation` / `alpha` / `detail`
  still wins over the mix — the mix fills the gaps, it does not overrule.
- `null` / `{}` / an all-unknown mix ⇒ nothing at all changes (no key is added to
  the plan, no number moves).

On the score path, `score.scoreProfileStyle` paints the mix's resolved style
(`profileEffectiveStyle`) instead of the bare `global.style`, so a mix changes the
pixels a style-match score sees. In the app, `PaintingEngine.generate({ profile })`
uses the primitive-derived style when the profile declares one (`opts.style`
still wins).

**Layer-level mixes** are carried to consumers but not applied by the optimiser:
the modular engine of record emits one shape list, so the optimiser has one
language per pass. A per-layer mix is for the multi-layer renderer / the UI — it
is deliberately **not** silently promoted to the profile-level mix.

---

## 5. The AI half

`js/engine/propose.js` gains **primitive-weight knobs**, so a search proposes a
stroke language, not only a registry style name:

- `primitiveKnobs()` → 6 knobs `prim_<id_with_underscores>`, `{ type: 'number',
  min: 0, max: 1, target: 'primitive.<id>' }`. They are **extras**, not
  `KNOB_SET` members (opt-in), so a search that does not ask for them is
  bit-for-bit the old one.
- `knobsToPrimitiveMix(knobs)` → canonical mix or `null`; `knobsToProfile()`
  writes it to `global.primitives`.
- `searchProfile(base, image, { primitives: true, primitiveInit: 0.25, … })`
  appends the knobs, seeds them at a uniform mix, and returns `primitives` —
  the winning mix (or `null`). `clampKnobs(vals, primitiveKnobs())` bounds them.

Measured in `scripts/primitives-probe.cjs` (synthetic content, 40 evaluations,
fixed seed): the search moves the weights and improves the objective
(96.3843 → 97.0925), returning a non-empty mix, deterministically. **If a search
ever prefers the empty mix, the probe reports that rather than hiding it.**

---

## 6. Guarantees the suite pins

1. Every primitive resolves to an **existing** registry style *and* `MEDIA_PRESETS`
   entry (asserted against `getStyle` / `MEDIA_PRESETS`).
2. `normalizePrimitiveMix` is canonical, drops unknown/non-positive, sums to 1,
   and is a **fixed point**.
3. A profile with no primitives normalises **byte-identically** (no invented key)
   and produces **byte-identical** shapes and a byte-identical geometric plan.
4. A mix **changes** the plan and the shapes, **deterministically** for a fixed
   seed, at the **same** stroke budget.
5. Explicit per-pass numbers beat both the pass mix and the profile mix.
6. `propose` emits weights; a search without `primitives: true` is unchanged.

Run: `node tests/engine.test.js` (**164/164** — 18 S5 tests) ·
`node scripts/primitives-probe.cjs` (PASS) · `node scripts/visual-regression.cjs`
(9/9 pinned baselines **unmoved**).

---

## 7. For the Mac (M16 — the UI half)

**M16 was blocked on BE issuing the list. The list is §1 above; the contract is
§2–§4.** What the Mac half is expected to build:

1. A **stroke-language mixer** in the Style panel: the 6 primitives from §1 with
   their labels, weight sliders (`0..1`, step 0.05 — the same range as
   `primitiveKnobs()`), a normalised readout, and `effectiveStyle` shown so the
   user can see which registry style the mix resolves to today.
2. Write the mix to `global.primitives` (profile-wide), and optionally per layer
   (`layers[].primitives`) and per pass (`passes[].primitives`) — the level
   picker should mirror the precedence in §2.
3. **Round-trip it**: `profileToPrimitives()` in, edits out; a profile that
   declares no mix must export/import unchanged (no `primitives` key invented).
4. Validation feedback: `validatePrimitiveMix` / `validateProfile` errors carry a
   `path` — surface it next to the offending control (an unknown primitive id is
   a real error, not a silent drop).
5. Ownership: `js/engine/primitives.js` is **BE-owned** (contract); the Mac owns
   the UI module + its host shim. If a primitive's *number* looks wrong, raise it
   in `docs/MAC-TASKS.md` — do not edit the table.

**Explicitly out of scope for M16 (BE owns):** per-pass geometry application
(done, §4), the score path (done), and the S10 matrix that would let anyone claim
a mix *matches* a reference (not started).

---

## 8. Related

`docs/TRACK_S.md` (the track) · `docs/STYLE_PROFILE.md` (§3.7 — the schema
addition) · `docs/ROADMAP.md` (the brief) · `docs/checkpoints/S5.md` (evidence) ·
`docs/checkpoints/S4.md` (`passes[]`, which S5 composes with) ·
`js/engine/primitives.js` (the contract) · `js/engine/brush-media.js` (the media
presets) · `docs/STYLE_INVENTORY.md` (the registry styles)
