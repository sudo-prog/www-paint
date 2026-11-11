# AI Style Harness — the loop that replicates any art style

**Date:** 2026-11-10 · Agent: BE (ThinkPad) · Status: design + H0 in progress

> The original idea for WWW_PAINT: a harness where **our AI replicates almost any
> image art style**, keeps **adjusting the algorithm**, and **learns from each
> success and from user input/adjustments.** This document is that harness.
> It sits on top of Track R (`docs/CLEANROOM.md`) and roadmap Phases 4–5.

---

## 1. What the loop is

```
 1-4 reference images (any style)
        |
        v
   PROPOSER  -->  Style Profile (bounded parameters)
        ^               |
        |               v
   feedback /      RENDER  (our engine, deterministic)
   memory               |
        |               v
        +--------  METRICS  (self `sim` + independent MAE + SSIM + edge/hist)
                        |        +  USER RATING (ground truth)
                        v
                  GATE: keep the change or revert  -->  STORE
```

Repeat until the render matches the references (or the budget runs out). Each
accepted result is stored so a **similar reference later starts closer** — that
is the "learns from each success" part.

---

## 2. What the AI actually adjusts — two tiers

| Tier | Action space | Safety | Purpose |
|---|---|---|---|
| **A (default)** | **Style Profile parameters** — the engine's bounded, machine-readable knobs: scale schedule, stroke sizes/density, structure alignment, colour mode, per-layer styles, media model. | safe, fast, revertible | Match a style by tuning *values*. |
| **B (advanced)** | **Engine code** — an agent proposes a patch; the benchmark gates it; a human approves. | gated, reviewed | Make the *algorithm itself* better over time. |

Both tiers share one gate: **nothing is kept unless the metrics improve without
regressing other images.** Tier B additionally requires human approval.

---

## 3. Honest constraints (what this is *not*)

- **No in-browser gradient training of a neural net.** "Learning" here means
  (a) a feedback store of `(refs -> profile -> metrics -> rating)`, (b) retrieval
  of similar past cases to warm-start, (c) search/optimisation over the parameter
  space, and (d) LLM proposals. A trainable model is a *later, optional* path
  (Phase 7 / differentiable SBR) and would train on **source images + our own
  renderer** — never on any external engine's output.
- **Metrics are a proxy for taste.** The ground truth is the user's rating; both
  enter the loop, and a profile that scores well but that you reject is recorded
  as a *negative* example.
- **The port is a scoreboard, not a teacher** (see `docs/CLEANROOM.md` §2).

---

## 4. Composition with the roadmap / Track R

| Harness part | Where it comes from |
|---|---|
| The engine + tunable primitives | **Track R** (`CLEANROOM.md`) — better primitives are what make high fidelity reachable |
| Action space (the knobs) | Roadmap **Phase 4** — Style Profile (`docs/STYLE_PROFILE.md`) |
| Proposer + critique UI | Roadmap **Phase 5.1–5.2** |
| Feedback store | Roadmap **5.3** (IndexedDB) |
| Retrieval / warm-start | Roadmap **5.4** |
| Perceptual metrics + gates | this doc + `scripts/parity-bench.cjs` family |
| Tier B code improvements | an agent loop gated by the benchmark |

---

## 5. Milestones

| ID | Milestone | Exit criteria |
|---|---|---|
| **H0** | Eval harness | `parity-bench.cjs` reports `sim` + independent MAE + **SSIM** over N images for every engine. **Baseline recorded.** |
| **H1** | Parameter surface | **DONE** — `js/engine/score.js` (`KNOB_SET` action space + `clampKnobs` + `scoreProfile(profile, image)`) over `js/engine/metrics.js` (independent rasteriser + MAE + SSIM). No browser. See `docs/checkpoints/H1.md`. |
| **H2** | Search proposer | **DONE** — `js/engine/propose.js`: random + a compact (μ,λ) evolution strategy tuning a profile at **equal stroke count**; beats the hand-set default (+0.55 simMae, 32 evals, deterministic). See `docs/checkpoints/H2.md`. |
| **H3** | LLM proposer | **MECHANISM DONE — real-LLM validation PENDING** — `js/engine/vision-propose.js`: injected LLM backend, prompt built from `KNOB_SET`, tolerant `parseProposal` (+`clampKnobs`), refine via the H2 search, record to H4 memory; `openAICompatibleBackend` adapter. Verified with a stub (`scripts/h3-propose-check.mjs`, 8 checks); the **≥70%-usable** criterion is unmeasured (no vision backend configured here). See `docs/checkpoints/H3.md`. |
| **H4** | Memory | **DONE** — `js/engine/memory.js`: bounded feedback store (`record`/`list`/`best`) + average-hash retrieval (`averageHash`/`hamming`) + `warmStart` seeding `searchProfile({ init })`; wins and losses kept, deterministic, JSON-serialisable. See `docs/checkpoints/H4.md`. |
| **H5** | Tier B | **DONE** — `js/engine/gate.js`: `evaluateSet` + `gateChange`/`gateVariants` — the benchmark gate (keep / revert / pending-approval): nothing is kept unless the mean objective improves **without regressing an image**, and a change additionally needs explicit human approval. Proposer-agnostic, deterministic, node-testable. See `docs/checkpoints/H5.md`. |

---

## 6. Guardrails

1. **Determinism** — a `(profile, seed, image-hash)` always re-bakes identically.
2. **Bounded action space** — parameters clamped; stroke/wet-sim caps; a wall-clock budget per attempt.
3. **No training on external engine output** — any reference fixture is a measuring stick only.
4. **Human in the loop for Tier B** — code changes are never auto-merged.
5. **Every attempt is recorded** — wins *and* losses (losses are training signal).

## 7. References

- `docs/CLEANROOM.md` — engine of record + Track R (the thing being tuned).
- `docs/ROADMAP.md` §5 — Phase 4 (Style Profile) + Phase 5 (AI refinement loop).
- `docs/STYLE_PROFILE.md` — the parameter schema (the action space).
- `scripts/parity-bench.cjs`, `tests/parity/harness.html` — H0 measurement.
