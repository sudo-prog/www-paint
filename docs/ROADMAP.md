# WWW_PAINT — Project Brief & Development Roadmap

Version 1.2 · 2026-11-10

> **This is the living brief.** Update the version and `docs/ROADMAP_STATUS.md` as phases complete.
> Work strictly in order (see §8 Agent Protocol). Do not start Phase N+1 until Phase N exit criteria are checked.

- Live project: https://github.com/sudo-prog/www-paint
- Demo: https://www-paint.pages.dev/

---

## 0. Engine of record (decision 2026-11-10)

> **We build our own engine.** The engine of record is the modular engine
> (`analyzer.js` + `generator.js` + `scorer.js` + `renderer.js`). The legacy
> auto-painter (`js/engine/painter.js`) is **reference-only**: never the shipped
> engine, kept solely as a local fixture for parity measurement. The project's
> original intent is a 100%-original, enhanced reimplementation.
>
> Track, yardstick and milestones: **`docs/CLEANROOM.md`**. Parity gate:
> the clean-room engine must reach ≥ the reference's `sim` (within 2 points) on
> `scripts/parity-bench.cjs` before the port is retired (milestone R6).

---

## 1. Vision

Build a pure-web, stroke-based image-to-art engine that can:

- Emulate almost any painting/drawing medium with high visual realism.
- Split an image into meaningful layers (background, shadows, midtones, highlights, accents) and apply different styles/media per layer.
- Accept 1–4 style reference images, use AI (vision + optional retrieval) to propose a full **Style Profile**, generate layered previews, let the user refine, then save a reusable style.
- Continuously improve from user feedback (local store → retrieval / few-shot → better future proposals).
- Remain fully client-side capable, with AI as an optional accelerator.

---

## 2. Current Codebase Snapshot

| Component | Status | Notes |
|-----------|--------|-------|
| Engine (analyzer, generator, scorer, renderer, worker) | Solid | Modular; residual-friendly |
| Shape vocabulary (E/B/T/R/S) | Complete | Five primitives — ellipse, blob, triangle, rect, stroke |
| Styles | 50+ registered | Quality varies; watercolor / oil / ink already advanced |
| p5.brush integration | Partial | `js/engine/brush-stamp-engine.js` wraps standalone p5.brush |
| Layers | Data model only | ARCHITECTURE.md sketches Layer objects; runtime limited |
| AI / Style Profile / feedback | None | Primary new work |

Key existing docs in repo: `ARCHITECTURE.md`, `RE_BREAKDOWN.md`.

---

## 3. Reference Algorithms & Libraries

### 3.1 Media & Brush Foundations (implement / adapt)

| Source | Link | Use in www-paint |
|--------|------|------------------|
| p5.brush | https://github.com/acamposuribe/p5.brush | Pressure, scatter, grain, custom/image tips, hatch fills, vector fields, watercolor fill bleed/texture. Already partially integrated. |
| wet-paint-flow | https://github.com/simonxxooxxoo/wet-paint-flow | Structure tensor → multi-scale stable Bézier ribbons; height + wetness + bristle channels; microfacet wet highlights. |
| inkwash | https://github.com/johnowhitaker/inkwash | Lightweight wetness + velocity + mobile/fixed pigment grid; ink only moves on wet paper. |
| watercolor-playground | https://github.com/msurguy/watercolor-playground | Wet-gated pigment flow, tide lines, paper interaction; spectral mixing (optional later). Built on inkwash ideas. |
| dli/paint (Fluid Paint) | https://github.com/dli/paint | Separation of color vs height/wetness/bristle; height-normal wet shading. |

### 3.2 Stroke-Based / Neural Painting SOTA (ideas + selective adaptation)

| Algorithm | Link | Core contribution | Priority for www-paint |
|-----------|------|-------------------|------------------------|
| Birth of a Painting: Differentiable Brushstroke Reconstruction | https://arxiv.org/abs/2511.13191 · [HTML](https://arxiv.org/html/2511.13191v1) | Parallel differentiable Bézier strokes, geometry-conditioned texture, differentiable smudge for natural blending | High — smudge + dual-color strokes |
| Image Painter (IP) | [IEEE MultiMedia 2025/26](https://www.computer.org/csdl/magazine/mu/5555/01/11311375/2cEUo3SWv5u) | CCL + PCA stroke init + dual-stage (forward/backward) optimization; strong metrics with few strokes | High — better initialization & residual cleanup |
| AttentionPainter | [IEEE TVCG 2025](https://www.computer.org/csdl/journal/tg/2025/12/11193849/2aB2KCPUfra) | Single-step scalable stroke predictor, Stroke-density Loss, Fast Stroke Stacking | High (ideas) — density loss + parallel prediction |
| Paint Transformer | https://arxiv.org/abs/2108.03798 · [ICCV 2021](https://www.computer.org/csdl/proceedings-article/iccv/2021/281200g578/1BmHtL6lzMY) | Feed-forward Transformer stroke-set prediction; self-training | Medium — conceptual model for set prediction |
| Differentiable Stroke Planning with Dual Parameterization | https://arxiv.org/html/2604.02752v1 | Discrete polyline ↔ continuous Bézier mapping; residual-guided search; fewer strokes, higher fidelity | Medium–High |
| StrokeDiff | https://arxiv.org/html/2603.01103v1 | Diffusion for realistic brushstroke primitives from few samples + Bézier conditioning | Medium (later) — better tip primitives |
| ArtStroke-GAN | [IEEE Access 2025](https://ieeexplore.ieee.org/document/11123435/) | Modular GAN for realistic watercolor strokes + color enhancement | Medium — watercolor-specific |
| ProcessPainter | https://arxiv.org/abs/2406.06062 · [GitHub](https://github.com/nicolaus-huang/ProcessPainter) | Diffusion that generates painting process sequences | Low–Medium — process/education mode later |
| Neural Brushstroke Engine (NeuBE) | https://research.nvidia.com/labs/toronto-ai/brushstroke_engine | GAN learns interactive brush styles from unlabeled media; style code controls the brush | Medium–High long-term — AI-created brushes |
| Rethinking Style Transfer: From Pixels to Parameterized Brushstrokes | https://ar5iv.labs.arxiv.org/html/2103.17185 | Explicit Bézier parameterization + differentiable renderer | Supporting reference |
| Hybridizing Expressive Rendering (Classical + Neural SBR survey) | https://arxiv.org/html/2506.00870v1 | Framework for combining rule-based and neural SBR | Design guidance |

### 3.3 Classical foundations (still essential)

- Hertzmann, *Painterly Rendering with Curved Brush Strokes of Multiple Sizes* (1998) and follow-ups — multi-scale, edge-following, coarse-to-fine.
- Kyprianidis & Kang — structure tensor / coherence-enhancing filtering for orientation fields.
- Tyler Hobbs generative watercolor techniques (fractal edge growth) — already partially in `watercolor.js` via `hobbsGrow`.

### 3.4 Historical / lineage

- Haeberli stroke-based rendering lineage.

---

## 4. Target Architecture

```
Content Image + optional Style Refs
        │
        ▼
Analyzer++  (luminance, structure tensor, tonal masks, palette, residual, orientation)
        │
        ▼
Style Profile  (global + per-layer params + media model + effects + styleDNA)
        │
        ├─► Multi-scale / per-layer Candidate Generation
        │         (CCL/PCA init ideas from Image Painter,
        │          structure-aligned paths, density-aware)
        │
        ▼
Scorer (mask-aware residual; optional dual-stage refine)
        │
        ▼
Renderer
  • Stamp path (enhanced p5.brush)
  • Bristle / ribbon path
  • Optional WetSim (inkwash / watercolor-playground style)
  • Optional Height / Impasto + smudge/blend pass (Birth of a Painting inspired)
        │
        ▼
Layer Composite → Preview / Export
        │
        ▼
User Feedback → Feedback Store → Retrieval for future AI proposals
```

Style Profile is the single portable object (AI-proposed, human-tweaked, or hand-authored).

---

## 5. Development Roadmap (Agent-Executable)

Work strictly in order. Each sub-phase: **Research → Plan (docs/checkpoints/…) → Implement → Test → Report → Commit.**
Track status in `docs/ROADMAP_STATUS.md`.

### PHASE 0 — Foundations

Goal: Baseline + schema lock-in.

| ID | Task | Exit criteria |
|----|------|---------------|
| 0.1 | Freeze Style Profile JSON schema (global, layers[], effects, mediaModel, styleDNA, provenance) | Schema in `docs/STYLE_PROFILE.md` |
| 0.2 | Visual regression harness: fixed seeds + test images → PNG hashes for core styles | Suite runs; baselines committed |
| 0.3 | Style inventory: which styles use stamp engine vs pure canvas; quality notes | Table in docs |
| 0.4 | Create `docs/MEDIA_MODELS.md`, `docs/ROADMAP_STATUS.md`, `docs/REFERENCES.md` (all links above) | Files present |

### PHASE 1 — Brush, Structure & Classical SBR Upgrades

Goal: Maximum realism without full neural training.

| ID | Task | Primary references | Exit criteria |
|----|------|--------------------|---------------|
| 1.1 | Harden p5.brush integration (tips, pressure, scatter, grain, hatch fills, fields) | [p5.brush](https://github.com/acamposuribe/p5.brush) | ≥8 styles use enhanced stamp path; visual improvement; fallback works |
| 1.2 | Structure tensor + orientation/coherence maps in analyzer | wet-paint-flow, Kyprianidis | Debug visualization; generator respects `alignToStructure` |
| 1.3 | Multi-scale stroke generation (coarse → medium → fine) + stable seeding | Hertzmann, wet-paint-flow, AttentionPainter density ideas | Three-scale option; residual decreases across scales |
| 1.4 | Better stroke initialization (CCL + PCA orientation/size) + dual-stage residual refine | [Image Painter](https://www.computer.org/csdl/magazine/mu/5555/01/11311375/2cEUo3SWv5u) | Fewer strokes for same quality on test set |
| 1.5 | Lightweight smudge / blend pass + optional height buffer for oil/impasto | [Birth of a Painting](https://arxiv.org/abs/2511.13191), dli/paint, wet-paint-flow | Oil shows natural blending + wet highlights |
| 1.6 | Watercolor / ink parameter unification + stronger bleed/texture controls | p5.brush fills, existing `hobbsGrow`, inkwash concepts | Side-by-side improvement vs Phase 0 baselines |

### PHASE 2 — Tonal Layers & Per-Layer Styles

| ID | Task | Exit criteria |
|----|------|---------------|
| 2.1 | Soft tonal masks (background / shadows / midtones / highlights) | Masks visualizable; coverage stats |
| 2.2 | Layer-aware generation, scoring, paint order | Different style per layer on one image |
| 2.3 | Layer panel UI (visibility, opacity, blend, style, regenerate layer) | Manual per-layer control works end-to-end |

### PHASE 3 — Wet Media Simulation (Optional Heavy Path)

| ID | Task | Primary references | Exit criteria |
|----|------|--------------------|---------------|
| 3.1 | Research spike: minimal fluid model | [inkwash](https://github.com/johnowhitaker/inkwash), [watercolor-playground](https://github.com/msurguy/watercolor-playground), dli/paint | Design note approved |
| 3.2 | WetSim module (wetness, optional velocity, mobile/fixed pigment, drying, tide lines) | — | Same Bloom on wet, hard edge on dry; acceptable preview performance |
| 3.3 | Style Profile `mediaModel`: "wet" / "dry" / "impasto" integration | — | — |

### PHASE 4 — Style Profile System

| ID | Task | Exit criteria |
|----|------|---------------|
| 4.1 | Engine consumes full Style Profile | `generateFromProfile(profile, analysis)` works |
| 4.2 | Save / load / library UI | One-click apply of saved styles; deterministic re-bake with seed |

### PHASE 5 — AI Style Refinement Loop

| ID | Task | Notes / references | Exit criteria |
|----|------|--------------------|---------------|
| 5.1 | Vision → Style Profile (1–4 refs) | Structured JSON from Claude / GPT-4o / Gemini; statistical offline fallback | ≥70% usable first proposals |
| 5.2 | Layered preview + critique UI (regenerate layer, sliders, NL feedback) | AI maps feedback → profile deltas | Preferred look in ≤3 cycles on test set |
| 5.3 | Feedback store (IndexedDB): refs, final profile, deltas, rating, notes | — | Every accept writes a record |
| 5.4 | Retrieval augmentation (feature distance or embeddings → few-shot) | Improves over sessions | Similar refs produce closer proposals |
| 5.5 | Optional neural stroke-set warm-start | AttentionPainter / Paint Transformer ideas; can stay heuristic | Documented; optional path |

### PHASE 6 — Polish, Performance, Export

- Full worker offload for analysis + generation.
- LOD (preview vs export stroke counts).
- Export: PNG/JPG, self-contained HTML, project JSON (includes profiles).
- Performance budgets documented.
- User + developer docs, including "Create Style from References".

### PHASE 7 — Stretch

- Client-side embeddings (Transformers.js) for local RAG.
- Learned brush primitives ([StrokeDiff](https://arxiv.org/html/2603.01103v1), [NeuBE](https://research.nvidia.com/labs/toronto-ai/brushstroke_engine)).
- Fuller differentiable smudge ([Birth of a Painting](https://arxiv.org/abs/2511.13191)).
- Process / educational mode ([ProcessPainter](https://arxiv.org/abs/2406.06062)).
- Spectral mixing path for watercolor.
- Community style-pack format.
- Automated quality metrics (edge alignment, histogram match to refs).

---

## 6. Extra Enhancements (Recommended)

- **Style DNA** — compact descriptor (palette, edge density, stroke stats, wetness estimate) for fast retrieval and offline matching.
- **Residual visualization** — show remaining error to guide humans and AI.
- **Reference-guided color transfer** — optional palette lock from refs.
- **Curated brush-tip asset pack** (clear licenses) for stamp engine.
- **Deterministic style bake** (profile + seed + image hash → bit-identical export).
- **A/B compare UI** for two profiles.
- **Simple vs Advanced UI modes.**
- **Safety guards** — max strokes, max wet-sim resolution, cancel tokens.

---

## 7. Success Criteria

- Core media (pencil, ink, watercolor, oil) clearly beat Phase 0 baselines in blind comparison.
- User can go from 1–4 refs → refined layered style → saved reusable profile in under ~10 minutes.
- Saved styles apply in one click and re-bake deterministically.
- Feedback improves subsequent proposals for similar references.
- App remains usable fully offline; AI is optional.

---

## 8. Agent Protocol

1. Research cited links and note algorithms + licenses.
2. Write short design note in `docs/checkpoints/PXn.md`.
3. Minimal implementation; no drive-by refactors.
4. Unit + visual regression tests.
5. Update `docs/ROADMAP_STATUS.md`.
6. Commit: `feat(phase1): structure tensor orientation map`.
7. Do not start Phase N+1 until Phase N exit criteria are checked.

---

## 9. Immediate Next Steps

1. Complete Phase 0 (schema, regression harness, inventory, `REFERENCES.md` with every link above).
2. Begin Phase 1.1 (p5.brush hardening) and 1.2 (structure tensor) in parallel if multiple agents are available.
3. Keep this document as the living brief; update version and status file as phases complete.

All major algorithms, libraries, and papers discussed are linked in §3 and should be copied into `docs/REFERENCES.md` during Phase 0. This roadmap is ready for Hermes / VS Code agents to execute checkpoint by checkpoint.
