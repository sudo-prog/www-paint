# WWW_PAINT ↔ LAYERS — Integration Strategy

Version 0.1 · 2026-11-10 · Agent: BE (ThinkPad)

> **Status: proposal.** Nothing here is required for WWW_PAINT to run today. It
> describes how to keep WWW_PAINT an independent, standalone app *while* shaping
> it so it can later mount inside LAYERS as a plug-in, sharing one AI service.
> Read alongside `docs/ROADMAP.md` (the feature roadmap).

---

## 1. Objective

Three things must be true at once:

1. **WWW_PAINT keeps working standalone.** All roadmap work (Phases 1–7:
   brushes, algorithms, AI refinement) continues in the standalone app,
   independently runnable and deployable.
2. **Reuse LAYERS' prebuilt architecture** rather than rebuilding it — schema
   validation, persistence, retrieval, AI service, golden-image harness.
3. **Integrate into LAYERS later like a plug-in** — LAYERS survives as the main
   UI; WWW_PAINT becomes the paint engine inside it; **one AI serves both**.

---

## 2. Design principle

> **Make the seam a contract, not a merge.**

The integration must be *data-shaped*, not *code-shaped*. Concretely:

- **Dependency direction is one-way:** `LAYERS → WWW_PAINT`. WWW_PAINT never
  imports LAYERS. This is what keeps it independently runnable.
- The shared surface is **(a) versioned JSON contracts + (b) one engine facade +
  (c) injected services** (AI, storage, retrieval). Nothing else crosses the line.
- Do **not** merge the two renderers. LAYERS is a shader *compositor*; WWW_PAINT
  is a stroke *generator*. WWW_PAINT produces layer content (raster) that LAYERS
  composites.

```
            ┌──────────────────────────────┐
            │            LAYERS            │   main UI / compositor
            │  (TS + pnpm monorepo)        │
            └───────────────┬──────────────┘
                            │ imports (one-way)
                            ▼
            ┌──────────────────────────────┐
            │   WWW_PAINT paint plug-in    │   stroke engine
            │   js/engine/** (UI-free)     │
            └───────────────┬──────────────┘
                            │ consumes (injected)
                            ▼
    ┌───────────────────────────────────────────────────┐
    │  Shared contracts (JSON Schema)  +  Shared AI svc  │
    │  document / preset / effect-stack  +  /v1/... API  │
    └───────────────────────────────────────────────────┘
```

---

## 3. What already exists (grounding)

The plan reuses real, shipped work — verified 2026-11-10.

| Capability | Where it already exists | Reuse for |
|---|---|---|
| Public engine class | WWW_PAINT `js/engine/engine.js` → `export class PaintingEngine` | The plug-in entry point (already UI-free) |
| Engine/UI separation | WWW_PAINT `js/engine/**` never imports `js/ui/**` (verified) | Boundary is already clean |
| Multi-layer rendering | WWW_PAINT commit `d69f38c`, `js/ui/layers.js`, `renderer._layerCanvases` | Roadmap Phase 2 content + texture source |
| Canvas-over-panels shell | WWW_PAINT `docs/WWW-PAINT-CANVAS-WINDOW.md` (ported from LAYERS) | UI already converging |
| JSON schema + migrations | LAYERS `packages/schema` (AJV, v0→v1, 54 tests) | Style Profile schema (roadmap 0.1 / P4) |
| Interchange contracts | LAYERS `contracts/{document,preset,effect-stack}.schema.json` | The plug-in data format |
| AI service (FastAPI) | LAYERS `services/ai` — `/v1/features/extract`, `/v1/vlm/refine`, `/v1/hypotheses/generate`, `/v1/retrieve`, `/v1/events/*` | Roadmap Phase 5 loop |
| Persistence (IndexedDB) | LAYERS `packages/sync` + `services/learning` | Roadmap 5.3 feedback store |
| Retrieval / vector store | LAYERS `packages/vector` + `/v1/retrieve` + ranker | Roadmap 5.4 retrieval augmentation |
| Golden-image harness | LAYERS `services/eval` + `tests/golden-infra` (SSIM) | Roadmap 0.2 visual regression |
| GPU engine + cores | LAYERS `packages/engine`, `packages/cores` (7 GLSL cores) | Compositor that hosts paint layers |

---

## 4. The plug-in surface (WWW_PAINT side)

The engine facade is the single public entry point. It **already effectively
exists** as `PaintingEngine`; formalising it is a rename + typed declaration, not
new functionality.

```js
// js/engine/index.js  (new facade — thin wrapper over PaintingEngine)
export function createPaintEngine({ host, ai, storage, vector, onEvent }) {
  //   host    : canvas element or { canvas } the engine draws into
  //   ai      : { baseUrl, client }  — injected AI service (see §5)
  //   storage : persistence adapter  — injected (IndexedDB today)
  //   vector  : retrieval adapter    — injected
  // returns:
  return {
    loadImage(source),          // File | URL | ImageData
    generate(profile),          // Style Profile → strokes (+ per-layer)
    render(),                   // composite to host
    getLayerCanvases(),         // Map<layerId, OffscreenCanvas>  → LAYERS textures
    exportProject(),            // → LAYERS-valid document JSON (§7)
    on(event, handler),         // 'progress' | 'layer' | 'done' | 'error'
    dispose(),
  };
}
```

**Rules:**

1. `js/engine/**` must never import `js/ui/**`. Already true — add a CI check to
   *keep* it true.
2. Ship `js/engine/engine.d.ts` so the TS host (LAYERS) can consume it typed.
3. The facade takes **no compile step** today (plain ES modules + importmap,
   matching the current app). A pnpm package wrapper is a later, optional move.

---

## 5. Shared AI model

Both apps already imply the same AI shape; unify on LAYERS' service.

- **One service:** LAYERS `services/ai` (FastAPI, `/v1/...`).
- **One client contract:** model the WWW_PAINT AI adapter on LAYERS'
  `apps/web/src/aiClient.ts`, pointed at a configurable `baseUrl`.
- **Today:** the adapter can target a standalone provider (Claude / GPT-4o /
  Gemini per roadmap 5.1) *or* a local instance — the app must not hardcode a
  provider.
- **Later:** the same adapter points at LAYERS `services/ai` — no code change,
  only `baseUrl`.

Endpoints already available for the roadmap Phase 5 loop:
`/v1/features/extract` (5.1 vision input), `/v1/vlm/refine` (5.1 profile
proposal), `/v1/hypotheses/generate`, `/v1/retrieve` (5.4), `/v1/events/*` +
`/v1/dashboard/acceptance` (5.3 feedback), plus classical offline fallback for
the fully-offline path.

---

## 6. Phasing (corrected sequencing)

### Phase B0 — Do this NOW

**Just build the roadmap.** Phases 1–7 in `docs/ROADMAP.md`. Nothing in this
document blocks or changes that work. The app stays independently runnable.

### Phase A — Plug-in tidy (deferred · do just before integration)

Small, mechanical, zero behaviour change. Only worth doing when integration is
near:

1. Add `js/engine/index.js` facade wrapper (about 30 lines over `PaintingEngine`).
2. Add `js/engine/engine.d.ts`.
3. Add the "engine must not import ui" CI check.

### Phase B — Contract alignment (the part that actually matters for "plug in later")

Can start whenever, independent of Phase A:

1. Freeze the **Style Profile** schema (roadmap 0.1) as a superset of LAYERS
   `preset` + `effect-stack` (§7).
2. Extend the WWW_PAINT **Layer** object to a valid LAYERS `document` layer
   (§7). Then a WWW_PAINT project *is* a LAYERS document.
3. Adopt JSON-schema validation: vendor LAYERS' browser-safe schemas now;
   consume `packages/schema` when the repos physically share a workspace.

### Phase C — Mount into LAYERS (down the road)

1. LAYERS adds a layer `kind: "paint"`; the host injects AI / storage / vector.
2. WWW_PAINT's `getLayerCanvases()` uploads as textures into LAYERS' WebGL
   compositor. **No renderer merge.**
3. Same AI: both clients hit `services/ai`.

---

## 7. Contract alignment detail

The whole integration hinges on making WWW_PAINT's data *already valid* as
LAYERS data. Two mappings.

### 7.1 Layer → LAYERS `document.schema.json` layer

| WWW_PAINT `Layer` | LAYERS layer field | Action |
|---|---|---|
| `id` | `id` (uuid) | map (adopt uuid) |
| `name` | — (no such field) | put under `content.name` **or** extend schema |
| — (new) | `kind` | set `"paint"` (add to enum, or reuse `"raster"`) |
| `strokes[]` | `content` | `content = { strokes, profile }` |
| — | `effects` | LAYERS effect-stack applies to the painted layer |
| `visible` / `opacity` | `visible` / `opacity` | direct map |
| `blendMode` | — (blend is per-effect in LAYERS) | decide: layer-level blend vs effect-level |
| `locked` | `locked` | direct map |

### 7.2 Style Profile → LAYERS `preset` / `effect-stack`

Roadmap §5 defines the Style Profile as `global + layers[] + effects +
mediaModel + styleDNA + provenance`. LAYERS `preset` is
`name/version/effectStack/schemaVersion/description/tags/thumbnail`, where each
`effectStack` entry is `core/params/opacity/blend/mask/enabled`.

Alignment: a Style Profile **contains** an `effectStack` (per-layer effects) and
**wraps into** a `preset` for library/sharing. The profile is the richer object;
the preset is its portable, shareable subset.

---

## 8. Anti-patterns (do NOT)

1. **Iframe-embedding WWW_PAINT in LAYERS.** Kills the shared AI, shared state
   and shared documents that are the entire point. It is the one integration
   route to avoid.
2. **Merging the renderers.** LAYERS composites; WWW_PAINT paints. Keep them
   separate processes — WWW_PAINT only ever hands over raster layer content.
3. **WWW_PAINT importing LAYERS code.** Breaks standalone runnability. If a
   shared need appears, extract it into a contract, not an import.
4. **Hardcoding an AI provider** in either app. Provider lives behind the
   adapter + `baseUrl`.
5. **Forcing a monorepo migration now.** Not needed for independence. It is a
   Phase C, optional move.

---

## 9. Open decisions

1. New layer `kind` value `"paint"` vs reuse `"raster"` in the LAYERS document
   schema (owned by BE; needs FE sign-off).
2. Layer name: extend the LAYERS document schema with `name`, or bury it in
   `content`.
3. Layer-level `blendMode`: promote to the document layer, or express as a
   single-effect stack.
4. Whether WWW_PAINT ultimately becomes a `packages/paint-engine` workspace
   package or stays an externally-loaded ES-module bundle.

---

## 10. References

- `docs/ROADMAP.md` — the feature roadmap (this doc is the integration lens on it).
- `docs/ARCHITECTURE.md` — current WWW_PAINT engine structure.
- `docs/WWW-PAINT-CANVAS-WINDOW.md` — the shell already ported from LAYERS.
- LAYERS repo `~/Data/20_Projects/20.34_LAYERS/`:
  `contracts/*.schema.json`, `packages/{schema,sync,vector,ui}`, `services/ai`,
  `apps/web/src/aiClient.ts`.
- LAYERS vault `~/Data/20_Projects/20.34_LAYERS-Vault/` — Project Vision,
  Course-Correction.
