# References (Phase 0.4)

**Status:** consolidated · 2026-11-10 · Owner: BE (ThinkPad)

> Every algorithm, library and paper referenced by the roadmap, in one place.
> This file is the working index for Phase 1–3 research. Licences are noted
> where checked; **verify licence before vendoring any code** (Phase 1 protocol:
> "research cited links and note algorithms + licenses").

---

## 1. Media & brush foundations (implement / adapt)

| Source | Link | Use in www-paint | Licence |
|---|---|---|---|
| p5.brush | https://github.com/acamposuribe/p5.brush | Pressure, scatter, grain, custom/image tips, hatch fills, vector fields, watercolor fill bleed. **Partly integrated** (`js/engine/brush-stamp-engine.js`, vendored under `js/vendor/`). | see `js/vendor/p5.brush.LICENSE.md` (verify) |
| wet-paint-flow | https://github.com/simonxxooxxoo/wet-paint-flow | Structure tensor → multi-scale stable Bézier ribbons; height + wetness + bristle channels; microfacet wet highlights. | verify |
| inkwash | https://github.com/johnowhitaker/inkwash | Lightweight wetness + velocity + mobile/fixed pigment grid; ink moves only on wet paper. | verify |
| watercolor-playground | https://github.com/msurguy/watercolor-playground | Wet-gated pigment flow, tide lines, paper interaction; optional spectral mixing. Built on inkwash ideas. | verify |
| dli/paint (Fluid Paint) | https://github.com/dli/paint | Separation of colour vs height/wetness/bristle; height-normal wet shading. | verify |

---

## 2. Stroke-based / neural painting SOTA (ideas + selective adaptation)

| Algorithm | Link | Core contribution | Priority | Licence |
|---|---|---|---|---|
| Birth of a Painting: Differentiable Brushstroke Reconstruction | https://arxiv.org/abs/2511.13191 · [HTML](https://arxiv.org/html/2511.13191v1) | Parallel differentiable Bézier strokes, geometry-conditioned texture, differentiable smudge | High — smudge + dual-colour strokes | paper |
| Image Painter (IP) | https://www.computer.org/csdl/magazine/mu/5555/01/11311375/2cEUo3SWv5u | CCL + PCA stroke init + dual-stage (forward/backward) optimisation | High — init & residual cleanup | paper |
| AttentionPainter | https://www.computer.org/csdl/journal/tg/2025/12/11193849/2aB2KCPUfra | Single-step scalable stroke predictor, Stroke-density Loss, Fast Stroke Stacking | High (ideas) | paper |
| Paint Transformer | https://arxiv.org/abs/2108.03798 · [ICCV 2021](https://www.computer.org/csdl/proceedings-article/iccv/2021/281200g578/1BmHtL6lzMY) | Feed-forward Transformer stroke-set prediction; self-training | Medium | paper / [code](https://github.com/Huage001/PaintTransformer) verify |
| Differentiable Stroke Planning with Dual Parameterization | https://arxiv.org/html/2604.02752v1 | Discrete polyline ↔ continuous Bézier; residual-guided search | Medium–High | paper |
| StrokeDiff | https://arxiv.org/html/2603.01103v1 | Diffusion for realistic brushstroke primitives from few samples + Bézier conditioning | Medium (later) | paper |
| ArtStroke-GAN | https://ieeexplore.ieee.org/document/11123435/ | Modular GAN for realistic watercolor strokes + colour enhancement | Medium | paper |
| ProcessPainter | https://arxiv.org/abs/2406.06062 · [GitHub](https://github.com/nicolaus-huang/ProcessPainter) | Diffusion that generates painting process sequences | Low–Medium | paper / code verify |
| Neural Brushstroke Engine (NeuBE) | https://research.nvidia.com/labs/toronto-ai/brushstroke_engine | GAN learns interactive brush styles from unlabeled media; style code controls the brush | Medium–High long-term | research page |
| Rethinking Style Transfer: From Pixels to Parameterized Brushstrokes | https://ar5iv.labs.arxiv.org/html/2103.17185 | Explicit Bézier parameterisation + differentiable renderer | Supporting | paper |
| Hybridizing Expressive Rendering (Classical + Neural SBR survey) | https://arxiv.org/html/2506.00870v1 | Framework for combining rule-based and neural SBR | Design guidance | paper |

---

## 3. Classical foundations (still essential)

- Hertzmann, *Painterly Rendering with Curved Brush Strokes of Multiple Sizes* (SIGGRAPH 1998) and follow-ups — multi-scale, edge-following, coarse-to-fine. https://doi.org/10.1145/280814.280951
- Kyprianidis & Kang — structure tensor / coherence-enhancing filtering for orientation fields. https://doi.org/10.1109/TVCG.2011.135
- Tyler Hobbs — generative watercolor techniques (fractal edge growth); already partly in `js/styles/watercolor.js` via `hobbsGrow` (`js/styles/base.js`). https://www.tylerxhobbs.com/words/a-guide-to-simulating-watercolor-paint-with-generative-art

---

## 4. Historical / lineage

- Code Painter (original reverse-engineered source for www-paint): see repo `RE_BREAKDOWN.md`.
- Haeberli, *Paint by Numbers: Abstract Image Representations* (SIGGRAPH 1990) — stroke-based rendering lineage. https://doi.org/10.1145/97879.97907

---

## 5. Notes

- Links are copied verbatim from `docs/ROADMAP.md` §3 so this file is the single
  index; the roadmap remains the narrative.
- **Licence column is a to-do, not a claim.** Before vendoring anything into
  `js/vendor/` or `js/engine/`, record the actual licence text and keep a
  `*.LICENSE.md` next to the vendored file (as `p5.brush` already does).
- arXiv HTML mirrors (`/html/…v1`) are used where the abstract page is less
  readable; prefer the canonical `arxiv.org/abs/…` link in code comments.
