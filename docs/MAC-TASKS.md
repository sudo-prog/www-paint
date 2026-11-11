# WWW_PAINT — Mac task list (issued 2026-11-12 by BE)

**From:** Hermes / BE — ThinkPad (sole GitHub writer)
**To:** Hermes / Mac (FE)
**Companion:** `HANDOFF.md` (the executable brief) · `docs/WORKSPLIT.md` (ownership map)
**Baseline you must match:** `main = ff430bf`, remote == local. Green gates:
engine **99/99**, visual regression **9/9**, wetsim **15/15**.

> Read `HANDOFF.md` §2 (hard rules) and §6 (file ownership) before touching
> anything. **You never run git.** Edit files in your Syncthing copy; BE verifies
> and pushes. One writer per file. These streams are chosen to be **file-isolated
> with zero engine-spine contact**.

---

## 0. Remaining work — the whole board (so you can see where your streams fit)

### 0.1 ThinkPad / BE spine (serial, single writer — NOT yours)

| ID | Task | Notes |
|---|---|---|
| 1.5 | Light smudge/blend + optional height buffer | `renderer.js` |
| 2.2 | Layer-aware *scoring* (completes Phase 2) | metrics/scorer |
| 3.3 | mediaModel integration — wetsim into the render path (completes Phase 3) | engine + `renderer.js` |
| 5 | Harness H3 (vision→profile), H4 (feedback memory), H5 (Tier-B engine code) | AI loop |
| 6 | Phase 6 — polish / performance / export | |
| 7 | Phase 7 — stretch | |
| R4 | Feature parity — outlines / region-fill / paint order / per-style shaping | Track R |
| R5 | Exceed — per-layer styles, smudge, wet media, profiles, AI | Track R |
| R6 | Retire the legacy auto-painter; re-baseline clean-room | Track R |
| B / C | Vendor LAYERS AJV schemas (contract alignment); mount into LAYERS | integration |

### 0.2 Human-sign-off items (nobody actions these yet)

`RE_BREAKDOWN.md` (keep/remove), the two `codepainter-*` fixture renames,
`visual-smoke-test.*` (side-by-side tool), and the dead `js/ui/app.bundle.js`
(rebuild or delete). These are deletions/renames — they need per-instance
consent from the human. **Do not touch them.**

### 0.3 Your (Mac/FE) remaining streams — this list, §1–§3

---

## 1. Finish & hand in what is already built (do this first)

### M6a — Media panel: hand-in
Your media-panel stream is **already delivered** to the ThinkPad tree
(uncommitted): `js/ui/media.js`, `js/ui/media-host.js`,
`scripts/media-panel-audit.js`, `maestro/www-paint-media-panel.yaml`,
`maestro/www-paint-desktop-regression.yaml`, `docs/checkpoints/P2.5.md`, and the
additive `css/style.css` / `index.html` / `js/ui/layers.js` deltas.

**Action:** post the single OPS_LOG line (`HANDOFF.md` §9 format). BE verifies
(engine 99/99 + visual 9/9 + browser probe) and pushes. **Code nothing** unless
you find a defect — if you do, fix it and say so in the same line.

**Exit:** OPS_LOG line posted; BE has pushed `feat(media-panel)`.

### M6b — Media-panel QA (standing M4 seat)
Independently verify the panel on the pushed `main` — never trust a summary.

- Real headless Chromium against `index.html`; confirm **each** of the three
  sections provably changes rendered output (WET: raising `flowRate` bleeds;
  MEDIA: `bleed`/`tideDarken` change the stroke; TONAL: a band toggle changes the
  composite preview) — a DOM assertion **and** a behavioural check.
- Responsive usability at **390 / 500 / 768 / 1024 / 1440 / 1920** — run
  `scripts/media-panel-audit.js` (it already measures real DOM geometry) and keep
  its JSON + screenshots.
- Evidence → `docs/research/qa-media-panel.png` + the audit JSON.

**Exit:** evidence committed; any disagreement with a BE claim logged as
`[MAC] [VERIFY] <claim> — DISAGREE: <evidence>`. **No source edits.**

---

## 2. New streams — open after M6a/M6b

### M7 — Phase 4.2: Style Profile library UI  *(the already-issued M5)*
**Goal:** save / load / apply / export / import a Style Profile in one click,
deterministically re-bakeable with a seed. The engine side (4.1) is **done**; you
build the UI against the frozen schema.

**Files you own (all NEW):**
- `js/ui/style-library.js` — panel: save current settings → profile; list saved
  profiles; apply; delete; export / import JSON.
- `js/ui/style-library-host.js` (optional) — the same shim pattern as
  `media-host.js`, so you never edit the ThinkPad-owned `app.js`.
- `docs/checkpoints/P4.md`, `docs/research/*`, a Maestro flow if useful.

**Frozen contract:** the Style Profile schema in `docs/STYLE_PROFILE.md`
(draft-07). Persistence (localStorage / IndexedDB) stays behind a small adapter —
the profile object is the contract, not the storage.

**Exit criteria**
- [ ] Save writes a schema-valid profile; the list shows it.
- [ ] Apply re-bakes **identical** output for the same `(profile, seed,
      image-hash)` — prove it with two runs.
- [ ] Export → import round-trips a profile byte-identically.
- [ ] Each control provably changes output in a real headless browser.
- [ ] `docs/checkpoints/P4.md` written; OPS_LOG line posted.

### M8 — Phase 6 (UI half): export & share panel
**Goal:** a one-click export surface — PNG / JPG (size + quality), the profile
JSON (M7), and copy-to-clipboard. `js/engine/exporter.js` is **ThinkPad-owned**:
wrap it, do not edit it.

**Files you own (all NEW):** `js/ui/export-panel.js`,
`js/ui/export-host.js` (shim), CSS + `index.html` additive deltas,
`docs/checkpoints/P6-ui.md`.

**Exit criteria**
- [ ] PNG + JPG export at 3 sizes produce real blobs (assert non-empty + dims).
- [ ] Wrapping `exporter.js` without editing it; shim follows `media-host.js`.
- [ ] Determinism: same `(settings, seed)` → byte-identical PNG twice.
- [ ] Keyboard + screen-reader operable; 44px targets.
- [ ] `docs/checkpoints/P6-ui.md` + OPS_LOG line.

### M9 — Style coverage & non-baseline polish
**Goal:** raise the non-pinned styles to the same quality bar as the nine
baselines. **Do NOT edit the 9 pinned styles** (`pencil ink watercolor oil
charcoal marker cross-hatch halftone graphic`) — improving those is a BE
re-baseline decision.

**Files you own:** `js/styles/*` except the pinned nine and any file BE is on;
`docs/research/before-after/*.png`; `docs/checkpoints/style-polish.md`.

**Exit criteria**
- [ ] ≥ 6 non-pinned styles measurably improved (state the metric you used).
- [ ] `node tests/engine.test.js` still **99/99**; visual still **9/9**
      (pinned baselines unmoved — prove it).
- [ ] Before/after PNGs in `docs/research/`; checkpoint + OPS_LOG line.

### M10 — Accessibility & responsive sweep of all panels
**Goal:** the app grew three panels (controls, layers, media) + a library and an
export panel. Bring them all to one WCAG 2.2 AA bar.

**Files you own (NEW):** `docs/research/qa-a11y.png`, a DOM-probe script
`scripts/a11y-sweep.cjs`, `css/*` hardening (no spine files), Maestro flows.

**Exit criteria**
- [ ] Every interactive control: keyboard operable, visible focus, ≥ 44×44.
- [ ] Overlays: `role=dialog` + `aria-modal` + Escape closes + focus restored.
- [ ] `prefers-reduced-motion` honoured; live regions announce value changes.
- [ ] Responsive 390 / 768 / 1024 / 1440 / 1920 with no clipped or overlapping
      chrome — screenshots per width.
- [ ] Report + OPS_LOG line. (No axe-core — the no-new-deps rule still holds.)

### M11 — Reference docs & living artefacts
**Goal:** keep the human-facing docs true. **Coordinate with BE — don't race it
on `docs/ROADMAP_STATUS.md`, which is BE-owned.**

**Files you own:** `docs/STROKE_FORMAT.md`, `docs/STYLE_INVENTORY.md`,
a new `docs/PANELS.md` (how the four panels fit together), `docs/research/*`.

**Exit criteria**
- [ ] `docs/PANELS.md` describes the shell (controls / layers / media / library
      / export), the shim pattern, and the ownership boundary — with a diagram.
- [ ] Every command quoted in a doc was actually run; paste real output.
- [ ] No edits to BE-owned docs; raise mismatches via OPS_LOG instead.

---

## 3. Working agreements (unchanged)

1. **One GitHub writer — BE.** No clone / branch / commit / push on your side.
2. **One writer per file.** Never edit a ThinkPad-owned file (`HANDOFF.md` §6):
   `optimizer.js generator.js analyzer.js engine.js painter.js scorer.js
   renderer.js relief.js exporter.js`, `js/ui/controls.js`, `js/ui/app.js`,
   `tests/engine.test.js`, `scripts/parity-bench.cjs`,
   `scripts/visual-regression.cjs`, `docs/CLEANROOM.md`,
   `docs/ROADMAP_STATUS.md`, `docs/STYLE_PROFILE.md`, `.github/**`.
   Need a change there? Post an OPS_LOG note — BE makes it.
3. **Determinism.** New options default to byte-identical output, then opt in.
   Any randomness comes from the seeded RNG (`js/styles/base.js` `rngFor`), never
   bare `Math.random()`.
4. **No new dependency** on the check path.
5. **Never delete a file** without explicit per-instance human approval.
6. **Never trust a self-report** — paste the raw command output.

---

## 4. Order of work

```
M6a  hand in the media panel          → OPS_LOG line (BE pushes)
M6b  media-panel QA (M4 seat)         → qa-media-panel.png
M7   Style Profile library UI (4.2)   → docs/checkpoints/P4.md
M8   export & share panel (Phase 6)   → docs/checkpoints/P6-ui.md
M9   non-baseline style polish        → before/after PNGs
M10  a11y + responsive sweep          → qa-a11y.png
M11  reference docs                   → docs/PANELS.md
```

Finish a stream before starting the next; post one OPS_LOG line per stream.
Report to the human after each stream, not in one lump at the end.

Signed-off-by: Hermes / BE — ThinkPad
