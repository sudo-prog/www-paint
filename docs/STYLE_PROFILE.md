# Style Profile — Frozen Schema (v1)

**Status:** frozen (Phase 0.1) · 2026-11-10 · Owner: BE (ThinkPad)
**Schema id:** `https://www-paint.dev/schemas/style-profile/v1`
**Supersedes:** the informal profile sketch in `docs/ROADMAP.md` §4 ("Style Profile").

> The Style Profile is the **single portable object** in WWW_PAINT. It is
> AI-proposed, human-tweaked, or hand-authored, and it fully describes *how* a
> source image is turned into a painting. Everything downstream (generation,
> scoring, rendering, export, retrieval) reads this object and nothing else.
>
> It is deliberately a **superset** of the LAYERS `preset` + `effect-stack`
> contracts (see §7) so that a WWW_PAINT project can later be consumed by LAYERS
> without a translation layer. See `docs/INTEGRATION_STRATEGY.md` §7.2.

---

## 1. Shape of the object

```
StyleProfile
├── schemaVersion : integer (const 1)          — migration driver
├── id            : uuid                       — stable identity
├── name          : string
├── version       : semver                     — profile revision, not schema
├── engine        : { name, version }          — producer stamp
├── global        : GlobalParams               — whole-image controls
├── layers[]      : LayerStyle                 — per tonal-role overrides
├── effects[]     : EffectStackEntry           — LAYERS-compatible effect stack
├── mediaModel    : MediaModel                 — dry | wet | impasto
├── styleDNA      : StyleDNA                    — compact descriptor (retrieval)
└── provenance    : Provenance                 — where this profile came from
```

Tonal roles used by `layers[].role` are fixed to the engine's named layers
(`js/engine/engine.js` → `PaintingEngine.LAYER_NAMES`):

```
background · shadows · outline · midtone · highlights
```

---

## 2. JSON Schema (draft-07)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://www-paint.dev/schemas/style-profile/v1",
  "title": "WWW_PAINT StyleProfile",
  "type": "object",
  "required": ["schemaVersion", "id", "name", "version", "global"],
  "additionalProperties": false,
  "properties": {
    "schemaVersion": { "type": "integer", "const": 1 },
    "id": { "type": "string", "format": "uuid" },
    "name": { "type": "string", "minLength": 1, "maxLength": 128 },
    "version": {
      "type": "string",
      "pattern": "^\\d+\\.\\d+\\.\\d+$",
      "description": "Semantic version of THIS profile revision"
    },
    "engine": {
      "type": "object",
      "required": ["name", "version"],
      "additionalProperties": false,
      "properties": {
        "name": { "type": "string", "const": "www-paint" },
        "version": { "type": "string" }
      }
    },
    "global": { "$ref": "#/$defs/globalParams" },
    "layers": {
      "type": "array",
      "items": { "$ref": "#/$defs/layerStyle" }
    },
    "effects": {
      "type": "array",
      "description": "LAYERS-compatible effect stack (see §7).",
      "items": { "$ref": "#/$defs/effectEntry" }
    },
    "mediaModel": { "$ref": "#/$defs/mediaModel" },
    "styleDNA": { "$ref": "#/$defs/styleDNA" },
    "provenance": { "$ref": "#/$defs/provenance" }
  },
  "$defs": {
    "blendMode": {
      "type": "string",
      "enum": ["normal","multiply","screen","overlay","soft-light","hard-light",
               "color-dodge","color-burn","darken","lighten","difference",
               "exclusion","hue","saturation","color","luminosity"],
      "default": "normal",
      "description": "LAYERS effect-stack blend enum. WWW_PAINT runtime honours the 8 in js/ui/layers.js; the rest fall back to 'normal' until implemented."
    },
    "globalParams": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "style": { "type": "string", "description": "Registry style name (§STYLE_INVENTORY.md)" },
        "strokeCount": { "type": "integer", "minimum": 1, "maximum": 200000 },
        "strokeSize": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "min": { "type": "number", "minimum": 0 },
            "max": { "type": "number", "minimum": 0 },
            "random": { "type": "boolean", "default": true }
          }
        },
        "sizeK": { "type": "number", "minimum": 0.1, "default": 1 },
        "detailLevel": { "type": "number", "minimum": 0, "maximum": 1 },
        "styleStrength": { "type": "number", "minimum": 0, "maximum": 1 },
        "opacity": { "type": "number", "minimum": 0, "maximum": 1 },
        "randomness": { "type": "number", "minimum": 0, "maximum": 1 },
        "pathOrder": {
          "type": "string",
          "enum": ["free","down","up","right","left","diag","spiral","spiralin","rings","ringsin","clock","top-bottom","edges-first","one-line"],
          "default": "free"
        },
        "colorMode": { "type": "string", "enum": ["exact","quantized","palette"], "default": "exact" },
        "palette": {
          "type": ["array","null"],
          "items": { "type": "string", "pattern": "^#[0-9a-fA-F]{6}$" }
        },
        "abstract": { "type": "boolean", "default": false },
        "outline": { "type": "string", "enum": ["off","on","edges"], "default": "off" },
        "rfill": { "type": "string", "enum": ["off","on"], "default": "off" },
        "oneLine": { "type": "boolean", "default": false },
        "smart": { "type": "boolean", "default": false, "description": "Structure tensor + focus map + subject detection" },
        "multiLayer": { "type": "boolean", "default": false },
        "seed": { "type": "integer", "minimum": 0, "description": "Master seed — required for deterministic re-bake" }
      }
    },
    "layerStyle": {
      "type": "object",
      "required": ["role"],
      "additionalProperties": false,
      "properties": {
        "role": { "type": "string", "enum": ["background","shadows","outline","midtone","highlights"] },
        "enabled": { "type": "boolean", "default": true },
        "style": { "type": "string", "description": "Overrides global.style for this tone" },
        "params": { "type": "object", "additionalProperties": true },
        "opacity": { "type": "number", "minimum": 0, "maximum": 1, "default": 1 },
        "blendMode": { "$ref": "#/$defs/blendMode" },
        "order": { "type": "integer", "minimum": 0, "description": "Paint order (lower = painted first)" }
      }
    },
    "effectEntry": {
      "type": "object",
      "required": ["core", "params", "opacity", "blend", "enabled"],
      "additionalProperties": false,
      "properties": {
        "core": { "type": "string", "description": "e.g. 'bevel-emboss', 'gradient-overlay', 'pattern-dither', 'paper-grain'" },
        "params": { "type": "object", "additionalProperties": true },
        "opacity": { "type": "number", "minimum": 0, "maximum": 1, "default": 1 },
        "blend": { "$ref": "#/$defs/blendMode" },
        "mask": { "type": ["string","null"], "description": "Optional asset id for a mask texture" },
        "enabled": { "type": "boolean", "default": true }
      }
    },
    "mediaModel": {
      "type": "object",
      "required": ["kind"],
      "additionalProperties": false,
      "properties": {
        "kind": { "type": "string", "enum": ["dry","wet","impasto"] },
        "wetness": { "type": "number", "minimum": 0, "maximum": 1, "default": 0 },
        "drying": { "type": "number", "minimum": 0, "maximum": 1, "default": 0 },
        "bleed": { "type": "number", "minimum": 0, "maximum": 1, "default": 0 },
        "granulation": { "type": "number", "minimum": 0, "maximum": 1, "default": 0 },
        "height": { "type": "number", "minimum": 0, "maximum": 1, "default": 0, "description": "Impasto relief amount" },
        "bristle": { "type": "number", "minimum": 0, "maximum": 1, "default": 0 },
        "paper": {
          "type": ["string","null"],
          "description": "Paper texture id, or null for none"
        }
      }
    },
    "styleDNA": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "palette": {
          "type": "array",
          "items": { "type": "string", "pattern": "^#[0-9a-fA-F]{6}$" },
          "maxItems": 16
        },
        "edgeDensity": { "type": "number", "minimum": 0, "maximum": 1 },
        "contrast": { "type": "number", "minimum": 0, "maximum": 1 },
        "entropy": { "type": "number", "minimum": 0, "maximum": 1 },
        "wetnessEstimate": { "type": "number", "minimum": 0, "maximum": 1 },
        "strokeStats": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "count": { "type": "integer", "minimum": 0 },
            "meanLength": { "type": "number", "minimum": 0 },
            "meanWidth": { "type": "number", "minimum": 0 },
            "angleEntropy": { "type": "number", "minimum": 0, "maximum": 1 }
          }
        },
        "tones": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "background": { "type": "number", "minimum": 0, "maximum": 1 },
            "shadows": { "type": "number", "minimum": 0, "maximum": 1 },
            "midtone": { "type": "number", "minimum": 0, "maximum": 1 },
            "highlights": { "type": "number", "minimum": 0, "maximum": 1 }
          }
        }
      }
    },
    "provenance": {
      "type": "object",
      "required": ["source"],
      "additionalProperties": false,
      "properties": {
        "source": { "type": "string", "enum": ["ai","human","hybrid","preset","import"] },
        "model": { "type": ["string","null"], "description": "AI model id, when source includes AI" },
        "promptId": { "type": ["string","null"] },
        "parentProfileId": { "type": ["string","null"], "description": "uuid of the profile this was derived from" },
        "refs": {
          "type": "array",
          "maxItems": 4,
          "items": {
            "type": "object",
            "required": ["uri"],
            "additionalProperties": false,
            "properties": {
              "uri": { "type": "string" },
              "hash": { "type": ["string","null"], "description": "sha256 of the reference bytes" },
              "role": { "type": "string", "enum": ["style","content","palette"] }
            }
          }
        },
        "rating": { "type": ["integer","null"], "minimum": -1, "maximum": 5, "description": "User rating; -1 = rejected" },
        "notes": { "type": "string", "maxLength": 1024 },
        "createdAt": { "type": "string", "format": "date-time" },
        "updatedAt": { "type": "string", "format": "date-time" },
        "refPacket": {
          "type": ["object","null"],
          "description": "Optional fused Track-S reference packet (S3): the consensus of 1-4 references, as emitted by js/engine/ref-analyze.js fuseReferences(). Consumed directly by refPacketDistance / scoreProfileStyle."
        }
      }
    }
  }
}
```

---

## 3. Field notes

### 3.1 `global` vs `layers[]`
`global` holds the image-wide controls (style, density, size, colour mode,
path order, seed). `layers[]` holds **per tonal-role overrides** — a role that
is absent inherits `global`. This mirrors the engine's single-layer default
(`Layer 0`) and its five named multi-layer mode
(`background/shadows/outline/midtone/highlights`).

### 3.2 `seed`
Reproducibility is a hard requirement ("deterministic style bake"). A profile
with a `global.seed` plus the source-image hash must re-bake bit-identically
(see roadmap §6). The seed is stored **in the profile**, not in the document.

### 3.3 `effects[]`
User-visible post effects applied after painting. Kept structurally identical
to LAYERS `effect-stack` so it round-trips (§7). WWW_PAINT today applies only a
subset at render time; unmapped `core` values are preserved and ignored.

### 3.4 `styleDNA`
A compact, cheap-to-compute descriptor used for **retrieval / few-shot** (roadmap
5.4) and offline matching. Not required for painting; may be computed lazily.

### 3.5 `provenance`
Tracks where a profile came from. `refs` holds the 1–4 style-reference images
(roadmap 5.1) with a content hash so a profile can be re-derived or audited. A
`rating` of `-1` marks a rejected proposal (feedback store, roadmap 5.3).

`refPacket` (optional, added 2026-11-13 with Track-S **S3**) holds the **fused**
reference descriptor: `ref-analyze.fuseReferences(packets)` merges 1–4 references
into one packet-shaped consensus, down-weighting a reference that disagrees with
the others, and the result is stored here so a profile carries *the style its
references agree on* rather than any single reference. `profile.js` reads/writes
it with `attachFusedReference()` / `fusedReferenceFromProfile()`. It is the same
shape `RefPacket` a render is analysed into, so `refPacketDistance` /
`scoreProfileStyle` (S2) consume it with no new code path.

---

## 4. Minimal example

```json
{
  "schemaVersion": 1,
  "id": "6f1c2b7e-3a4d-4e2b-9c11-0a7f5e9d1234",
  "name": "Loose Watercolour Study",
  "version": "1.0.0",
  "engine": { "name": "www-paint", "version": "0.1.0" },
  "global": {
    "style": "watercolor",
    "strokeCount": 1400,
    "strokeSize": { "min": 2, "max": 14, "random": true },
    "detailLevel": 0.6,
    "styleStrength": 0.75,
    "opacity": 0.85,
    "pathOrder": "free",
    "colorMode": "exact",
    "multiLayer": true,
    "seed": 324508639
  },
  "layers": [
    { "role": "background", "style": "wash",   "opacity": 0.9,  "order": 0 },
    { "role": "shadows",    "style": "watercolor", "opacity": 1.0, "order": 1 },
    { "role": "highlights", "style": "pastel", "opacity": 0.5,  "order": 4 }
  ],
  "effects": [
    { "core": "paper-grain", "params": { "strength": 0.25 }, "opacity": 0.4, "blend": "multiply", "enabled": true }
  ],
  "mediaModel": { "kind": "wet", "wetness": 0.7, "drying": 0.4, "bleed": 0.5, "granulation": 0.3, "paper": "coldpress-140" },
  "styleDNA": {
    "palette": ["#2b3a55", "#7d9d9c", "#c9d8d4", "#e8ded1"],
    "edgeDensity": 0.31,
    "contrast": 0.48,
    "wetnessEstimate": 0.66
  },
  "provenance": {
    "source": "ai",
    "model": "vision-proposal-v1",
    "refs": [{ "uri": "refs/loose-wash-1.jpg", "hash": "sha256:…", "role": "style" }],
    "rating": 4,
    "createdAt": "2026-11-10T01:00:00Z",
    "updatedAt": "2026-11-10T01:00:00Z"
  }
}
```

---

## 5. Validation

Phase 0 shipped the schema as a document; **Phase 4.1** added the engine reader
`js/engine/profile.js` (`validateProfile` / `normalizeProfile` / `applyProfile`,
see `docs/checkpoints/P4.1.md`), whose `validateProfile` checks the v1 constraints
as a dependency-free draft-07 **subset**. The plan (Phase B of the integration
strategy) is to **vendor LAYERS' browser-safe AJV schemas** and consume
`packages/schema` once the repos share a workspace — no bespoke validator — and
`validateProfile`'s signature is designed to survive that swap unchanged.

Until then, a profile may be validated with any draft-07 validator
(`npx ajv-cli validate -s <schema> -d <profile>`).

---

## 6. Versioning rules

| Change | Action |
|---|---|
| New **optional** field, or new enum member | bump `id` minor, keep `schemaVersion` |
| New **required** field, or semantic change to an existing field | bump `schemaVersion` and add a migration |
| Rename / remove a field | bump `schemaVersion`, add a migration, keep a compat reader |

**Applied 2026-11-13:** `provenance.refPacket` added as an **optional** field
(Track-S S3 multi-reference fusion) — `schemaVersion` stays 1, per the first row
above. Existing profiles without it are unchanged.

`schemaVersion` is an integer const per schema id. WWW_PAINT will adopt LAYERS'
migration approach (`packages/schema`, AJV, v0→v1) rather than invent one.

---

## 7. Alignment with LAYERS contracts

Cross-reference: `docs/INTEGRATION_STRATEGY.md` §7.

### 7.1 `effects[]` ↔ LAYERS `effect-stack`

| StyleProfile field | LAYERS `effect-stack[]` | Status |
|---|---|---|
| `core` | `core` | identical |
| `params` | `params` | identical |
| `opacity` | `opacity` | identical (0–1) |
| `blend` | `blend` | identical enum (16 values) |
| `mask` | `mask` | identical (asset id or null) |
| `enabled` | `enabled` | identical |

**Outcome: `effects` is byte-for-byte a LAYERS `effectStack`.** A StyleProfile
therefore *contains* a valid effect-stack.

### 7.2 StyleProfile ↔ LAYERS `preset`

LAYERS `preset` = `{ name, version, effectStack, schemaVersion, description, tags, thumbnail }`.

A StyleProfile **wraps into** a preset for library/sharing:

| preset field | from StyleProfile |
|---|---|
| `name` | `name` (or a derived label) |
| `version` | `version` |
| `effectStack` | `effects` |
| `description` | `provenance.notes` |
| `tags` | derived (style + mediaModel.kind + tone roles) |
| `thumbnail` | rendered preview asset id |

The profile is the **richer** object; the preset is its portable subset.

### 7.3 Layer ↔ LAYERS `document.schema.json` layer

When a WWW_PAINT project is exported as a LAYERS document (Phase B/C of the
integration strategy), each runtime `Layer` maps as:

| WWW_PAINT `Layer` (runtime) | LAYERS document layer | Action |
|---|---|---|
| `id` (integer today) | `id` (uuid) | adopt uuid in the *exported* document |
| `name` | — (no field) | place under `content.name`, **or** extend schema (open decision §9.2 of the integration doc) |
| — | `kind` | set `"paint"` (extend enum) or reuse `"raster"` (**open decision**) |
| `strokes[]` | `content` | `content = { strokes, profileId }` |
| layer-level `blendMode` | — (blend is per-effect) | express as a single-entry `effects` stack, or extend schema (**open decision**) |
| `visible` / `opacity` / `locked` | `visible` / `opacity` / `locked` | direct map |

These three open decisions are tracked in `docs/INTEGRATION_STRATEGY.md` §9 and
require BE + FE sign-off; they do **not** block standalone WWW_PAINT work.

---

## 8. Related

- `docs/ROADMAP.md` §4 (target architecture), §5 Phase 0.1 / Phase 4
- `docs/INTEGRATION_STRATEGY.md` §5 (shared AI), §7 (contract alignment)
- `docs/MEDIA_MODELS.md` (the `mediaModel` enum), `docs/STYLE_INVENTORY.md` (style names)
- LAYERS: `contracts/{document,preset,effect-stack}.schema.json`, `packages/schema`
