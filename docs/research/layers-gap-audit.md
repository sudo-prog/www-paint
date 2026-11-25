# LAYERS Gap Audit — WWW_PAINT

**Date:** 2026-11-19
**Brief:** `/Users/AIR2K/.hermes/cache/scratch/layers-match-brief.md`
**Reference:** `/Users/AIR2K/Data/20_Projects/20.34_LAYERS`
**Measured against:** `http://127.0.0.1:8099/index.html` (live, not restarted) at 1440×900 using Playwright/Chromium (`NODE_PATH=/Users/AIR2K/.npm/_npx/af752b90495482d7/node_modules`)

## Authority (read)

- `LAYERS/packages/ui/src/tokens.ts` — colorTokens, glassTokens, spacingTokens, typography, motion, `generateCSSVariables()` derivation
- `LAYERS/apps/web/src/graphite.css` — applied glass/ambient/component patterns
- `LAYERS/docs/design-graphite.md` — contrast rationale (AA over white canvas in dark, over black in light; `brightness()` load-bearing)
- `LAYERS/docs/adr/ADR-012-graphite-strategy.md`, `ADR-012-graphite-patterns.md`

## Already aligned (not redone)

Per brief: `css/style.css` `:root` + `[data-theme="dark"]` carry LAYERS dark color/glass values; light theme under `html[data-theme="light"]`; ambient backdrop present in CSS; `js/ui/settings.js` uses correct `--bg-primary`/`--text-primary` names.

## Measurement notes

- `settings.js` applies 5 tunable tokens (`--bg-primary`, `--bg-secondary`, `--accent`, `--text-primary`, `--text-secondary`) as **inline styles** on `<html>` on init/mode apply. A raw `data-theme` attribute flip without reapplying the matching inline values leaves stale inline values (inline wins cascade). Phase 1 measurements for "correct CSS state" applied the proper per-theme values for those 5 keys after setting the attribute to observe the intended token outcome.
- `react/bundle.css` is loaded **after** `css/style.css` (confirmed via `document.styleSheets`: `css/style.css`, then `react/bundle.css`). Its `:root` rules override shared custom properties.

## Gap table

| Dimension | LAYERS (spec) | WWW_PAINT before (measured) | Verdict | Gap / note |
|---|---|---|---|---|
| Color tokens (dark) | `--bg-primary #0a0b0d`, `--bg-secondary #101215`, `--bg-tertiary #16191d`, `--bg-raised #1c2026`, `--text-* #f2f4f7/#9aa3af/#8b95a3`, `--accent #7aa2ff/#9ab8ff`, `--border #262b33`, `--border-strong #363c46`, success/warn/error per tokens | Core ramp declared correctly in CSS; **computed effective `--border` = `#2a2a33`** because `react/bundle.css :root` overrides it (CSS declares `#262b33`). Panel border computes to `rgb(42,42,51)` = `#2a2a33`. | **PARTIAL** | Global `--border` leak from React bundle.css; effective border not LAYERS `#262b33`. |
| Color tokens (light) | `--bg-primary #ffffff`, `--bg-secondary #f5f5f5`, `--bg-tertiary #e8e8e8`, `--text-* #0a0a0a/#555555/#6f6f6f`, `--accent #0066ff/#0052cc`, `--border #d4d4d4`, `--border-strong #b8b8b8`, glass-brightness `1` | `html[data-theme="light"]` declares LAYERS light column. With correct per-theme inline values applied: `--bg-primary #ffffff`, `--glass-brightness 1`, `--panel-alpha 0.88`, panel `rgba(245,245,245,0.88)`. Inline tunable-token behavior means theme flip path must actively apply correct values. | **PARTIAL** | Must pass Phase 3 gate: computed `--bg-primary` light `#ffffff` / `glass-brightness` `1`, dark `#0a0b0d` / `0.45`. |
| Glass / derived surfaces | panel-alpha 0.74/0.88, chrome-alpha 0.80/0.92, wash-alpha 0.06/0.05, blur 32px/20px, saturate 1.25/1.15, brightness 0.45/1. Derived: `surface-panel = bg-secondary@panel-alpha`, `surface-chrome = bg-primary@chrome-alpha`, `surface-raised = bg-tertiary@panel-alpha`. | Dark: `--surface-panel rgb(16 18 21 / 0.74)`, `--surface-chrome rgb(10 11 13 / 0.80)`, `--surface-raised rgb(22 25 29 / 0.74)`, panel `backdrop-filter: blur(32px) saturate(1.25) brightness(0.45)`. Light: panel-alpha 0.88, blur 20px, saturate 1.15, brightness 1, surfaces derived consistently. | **ALIGNED** | Core glass tokens and derivation match. |
| Spacing / radii / typography / motion | Spacing 4px base (`space-0..16`: 0,4,8,12,16,20,24,32,40,48,64). Typography tokens xs–4xl (size/line-height/weight). Motion: fast 150ms, normal 250ms, slow 350ms, easing `cubic-bezier(0.4,0,0.2,1)`. Applied radii per component (graphite.css). | Spacing 4px rhythm present but token set not a 1:1 mirror of `spacingTokens`. Typography: `--f-ui`/`--f-mono` system stacks aligned; full `--text-*` size/line-height/weight token vars not mirrored. Motion: `--t-fast .12s ease`, `--t-slow .32s ease`, no explicit normal token, easing differs. Radii: `--r-sm 6px`, `--r-md 8px`, `--radius 12px`, `--r-shell 20px`, `--r-canvas 28px`, pill 999px — app ladder present. | **PARTIAL** | Motion timing/easing and token completeness differ from LAYERS spec; acceptable if not breaking geometry contracts. |
| Ambient backdrop | Dark: non-uniform luminous wash behind glass (corner glows perceptible through glass per graphite.css/design rationale). Light: subtle blue-tinted wash. | **Dark:** `.main::before` base rule sets gradients but omits `content` (and positioning context in base) so pseudo-element does not render → computed `content: none` in dark. **Light:** `html[data-theme="light"] .main::before` renders with gradients (computed `content: ""`). | **GAP** | Dark ambient wash missing at runtime. |
| Component patterns | Glass panels over ambient, structural borders, consistent control sizing/hover/active, sentence-case labels, mono+tabular values, 44px targets. | Glass panels, 44px targets, sentence case/typographic hierarchy largely in place. Borders/accents inherit from effective tokens; dark border color wrong due to bundle leak. Nav/button states present. | **PARTIAL** | Skin-level token leakage affects borders; layout/geometry kept. |
| Theme flip | `data-theme` driven swap; derived surfaces track alpha/brightness. | Attribute toggles; CSS light block defines correct values. `settings.js` inline-applies 5 tunable keys (by design). Gate requires correct computed values on flip. | **PARTIAL** | Must ensure flip yields `--bg-primary` light `#ffffff` / `glass-brightness` `1`, dark `#0a0b0d` / `0.45`. |
| React surface (`js/ui/react/styles.css`, `StyleLibrary.jsx`) | Aligned to LAYERS/WWW_PAINT tokens and glass derivations; no leakage into host. | React bundle defines parallel palette (`--background #16161a`, `--card #1e1e24`, `--border/#ui-border #2a2a33`, `--radius 12px`, primary #7aa2ff). Panel sample: `rgba(22,22,26,0.86)` blur 28px/brightness 0.55 (differs from main glass). Button computed `fontFamily: Arial` in sample (not `--f-ui`). `bundle.css` loaded globally and overrides `:root --border`. | **GAP** | Token misalignment + global `:root` leakage; font token not reliably applied. |

## Contrast spot-check (measured math, Phase 1 baseline)

Method: sRGB relative luminance / WCAG contrast. Effective panel color composited as `panel_rgb * alpha + (backdrop_rgb * brightness) * (1 - alpha)`.

- **Dark, text-tertiary `#8b95a3` on panel over white canvas:** panel `#101215` (16,18,21) α0.74, backdrop white (255,255,255)×brightness 0.45 → effective `rgb(41.7,43.2,45.4)` ≈ `#2a2b2d`. Contrast **4.674:1** (≥4.5). Also vs effective over black `#0c0d10` **6.409:1**. On solid `--bg-secondary` **6.187:1**.
- **Light, text-tertiary `#6f6f6f` on panel over black canvas:** panel `#f5f5f5` α0.88, brightness 1, backdrop black → effective `#d8d8d8`. Contrast **3.525:1** (below 4.5:1 on this synthetic worst-case composite). *Note:* `design-graphite.md` states AA over white canvas in dark, over black in light with brightness load-bearing; this measured composite indicates light-mode tertiary may need care — to be rechecked and reported in Phase 3 with exact math/context.

## Summary

- **Aligned:** Glass/derived surface tokens and derivation (dark + light).
- **Partial:** Dark effective border (leak), light/theme-flip computed behavior, spacing/typography/motion token completeness, component pattern fidelity under leaked token.
- **Gaps:** Dark ambient backdrop not rendering (`.main::before` missing `content` in base rule); React surface token alignment and global `:root` leakage via `bundle.css`.
- **Deferred (layout-only, if any):** none identified in Phase 1; layout/geometry contracts preserved per brief.

Raw measurement source: `/tmp/wp-measure2-out.json` (generated during this audit).
