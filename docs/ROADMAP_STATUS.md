# Roadmap Status

Living status file for `docs/ROADMAP.md`. Update after every completed
sub-phase (roadmap §8, step 5). One line per sub-phase; keep it terse.

**Last updated:** 2026-11-10 · Agent: BE (ThinkPad)

Legend: `done` · `active` · `todo` · `blocked` · `n/a (stretch)`

---

## Phase 0 — Foundations

| ID | Task | Status | Evidence |
|---|---|---|---|
| 0.1 | Freeze Style Profile JSON schema | **done** | `docs/STYLE_PROFILE.md` (draft-07 schema + LAYERS alignment) |
| 0.2 | Visual regression harness (fixed seeds + images → PNG hashes) | **done** | `scripts/visual-regression.cjs`, `tests/visual/regression.html`, `tests/visual/baselines.json` + `tests/visual/baselines/*.png` (9 core styles, verified deterministic) |
| 0.3 | Style inventory (stamp vs canvas, quality notes) | **done** | `docs/STYLE_INVENTORY.md` (51 styles) |
| 0.4 | `MEDIA_MODELS.md`, `ROADMAP_STATUS.md`, `REFERENCES.md` | **done** | this file + `docs/MEDIA_MODELS.md` + `docs/REFERENCES.md` |

**Phase 0 exit criteria:** schema frozen ✔ · regression suite runs with baselines
committed ✔ (9/9 cases, deterministic across runs) · inventory table ✔ · four docs
present ✔. **Phase 0 COMPLETE** — see `docs/checkpoints/P0.md` (also records the
two blocking defects fixed: `Renderer.exportImage` returned undefined, and
`Painter.KIND['S']` off-by-one producing negative stroke widths).

---

## Phase 1 — Brush, Structure & Classical SBR Upgrades

| ID | Task | Status |
|---|---|---|
| 1.1 | Harden p5.brush integration | todo |
| 1.2 | Structure tensor + orientation/coherence maps | todo |
| 1.3 | Multi-scale stroke generation + stable seeding | todo |
| 1.4 | Better stroke init (CCL + PCA) + dual-stage refine | todo |
| 1.5 | Lightweight smudge / blend + optional height buffer | todo |
| 1.6 | Watercolor / ink parameter unification | todo |

---

## Phases 2–7

| Phase | Status |
|---|---|
| 2 — Tonal layers & per-layer styles | todo |
| 3 — Wet media simulation | todo |
| 4 — Style Profile system | todo |
| 5 — AI style refinement loop | todo |
| 6 — Polish, performance, export | todo |
| 7 — Stretch | todo |

---

## Integration track (see `docs/INTEGRATION_STRATEGY.md`)

| Phase | Status |
|---|---|
| B0 — Build the roadmap (this file) | active |
| A — Plug-in tidy (facade, `.d.ts`, CI guard) | deferred |
| B — Contract alignment (Style Profile ⊇ LAYERS preset/effect-stack) | **partly done** via 0.1 (schema written); vendoring LAYERS AJV schemas todo |
| C — Mount into LAYERS | todo |
