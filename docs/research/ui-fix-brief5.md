# BRIEF 5 — WWW_PAINT visual UI fix (make it look like the approved LAYERS design)

You are the UI coder for WWW_PAINT at `/Users/AIR2K/Data/20_Projects/20.36_WWW_PAINT`
(work in this directory). The human rejected the current UI: it does NOT look like
the approved LAYERS canvas-as-window design. Your job is the VISUAL design fix,
not engine/rendering work. Do not touch image rendering, generation, or the engine.

## The reference (the approved design — match its composition)

- Live reference: http://127.0.0.1:8096/ (LAYERS Desktop, force dark via
  `document.documentElement.setAttribute('data-theme','dark')`).
- Reference screenshot: `/Users/AIR2K/.hermes/cache/scratch/assessA-layers-1440-dark.png`
- Current WWW_PAINT screenshot (the problem): `/Users/AIR2K/.hermes/cache/scratch/assessA-wp-1440-dark-empty.png`
- Design doc: `/Users/AIR2K/Data/20_Projects/20.34_LAYERS/docs/research/layers-canvas-over-panels.md`

What LAYERS looks like at 1440×900 dark:
- ONE rounded black shell (20px radius), black `#0a0b0d` everywhere.
- Left panel (240px) and right panel (288px) are the SAME black as the base —
  zero seam, no border, no glass. They run the FULL height of the app.
- **NO TOP BAR. Nothing floats over the canvas.** The top of the app starts
  where the panels start. Panel identity/metadata lives in a small strip at
  the top of each panel (left: "LAYERS · Untitled · 1920×1080").
- The canvas is a BRIGHT gradient window (28px radius,
  `linear-gradient(160deg,#6b7787,#525c6b 52%,#5f6a79)`), inset 12px from the
  panels and the app edges. Its small header ("Canvas · 1920×1080") sits INSIDE
  the window at its top-left, dark-on-light, fully visible, unobstructed.
- A dark artwork frame floats CENTRED in the window (~40% of window area),
  bright gradient visible on all four sides.
- One glass pill toolbar (playback) sits at the bottom of the canvas window.

What WWW_PAINT currently looks like (the defects to fix):
1. THREE floating glass pills (logo / 8-button nav / 4 actions) hover OVER the
   top of the canvas window at y8–62, obstructing it. The canvas header had to
   be pushed down to y56+ to dodge them. LAYERS has none of this.
2. The 8-button nav mixes user modes (Brush/Layers/Media/Library/Paint/Export)
   with developer infrastructure toggles ("Painter"/"Modular" engine switch,
   "React" surface) at equal visual weight.
3. The right panel strip shows "P3 Linear · ACES" — color-pipeline jargon
   cargo-culted from LAYERS that means nothing for a PNG-export painting app.
4. The left controls panel is a wall of ~32 controls, ALL expanded at once
   (STYLE, BRUSH, STRUCTURE, PATH ORDER, MOTION & PATH, COLOR). No progressive
   disclosure. Overwhelming.

## Required changes (prescriptive — implement exactly this)

### C1. Retire the floating chrome ON DESKTOP (≥769px). Nothing over the canvas.
Create a NEW Mac-owned file `js/ui/ui-chrome-host.js` (runtime DOM reparenting,
the established shim pattern — see `js/ui/audit-fix-host.js` for the pattern).
On desktop it must:
- Move `.top-bar__left` (the WWW_PAINT wordmark) INTO the left panel
  (`#controls-root`), merged into/above its `.panel-strip` row. The strip keeps
  "Untitled" and the dims chip (Maestro asserts "Untitled"). Wordmark left,
  Untitled+dims right, one quiet 10–11px-uppercase strip row like LAYERS.
- Move `.top-bar__center` (the 8 nav buttons) INTO the left panel as a compact
  MODE SWITCHER block directly under the strip, ABOVE `.panel-head`: a 2-column
  grid (4 rows) of icon+label buttons, full 260px panel width, quiet styling
  (transparent bg, hairline separators, active = accent). Group order:
  row1 Brush/Layers, row2 Media/Library, row3 Paint/Export,
  row4 Painter/React — the last row visually DEMOTED (muted color, smaller
  label, a hairline above the row) since they are dev toggles. Keep every id,
  `data-nav`, aria-label, aria-pressed/expanded, and existing click handler
  (reparenting preserves listeners). Keep visible label text (Maestro asserts
  "Brush","Layers","Media","Paint","Modular","Painter" as visible text).
- Move `.top-bar__right` (Open / Generate / Export / Settings) INTO the right
  panel (`#layers-root`) as an ACTION ROW under its strip, above `.panel-head`:
  Open as ghost button, Generate as the accent round button (primary, keep
  `#btn-gener`), Export + Settings as ghost round buttons. One row, 44px targets.
- The `.top-bar` host itself becomes empty/inert on desktop (keep the element;
  mobile still uses it — see C4).
- Restore `.canvas-head` to `top: 0` INSIDE the window on desktop (restate
  §20.1's `top:56px` back to 0 in your new §21 block — nothing covers it now).
- The canvas window keeps its 12px insets; panels run full height (already so).
- When the left rail is COLLAPSED to the 56px icon rail, the mode switcher must
  collapse to icon-only (labels hidden, 2-col grid of 44px icon buttons or a
  single column) and the wordmark strip hides; when the right rail collapses,
  the action row becomes icon-only vertical. Keep everything tappable.
- Media/Library/Paint modes swap the left rail content (existing app logic):
  the mode switcher + strip must STAY visible above whatever panel occupies
  the rail. IMPORTANT: `#media-root`, `#style-library-root`, `#paint-toolbar`
  are SIBLING panels, not children of `#controls-root`. So the chrome must not
  live inside `#controls-root`'s swapped content. Solution: put the wordmark
  strip + mode switcher in a NEW wrapper that the host inserts into `.main`
  positioned exactly over the left rail's top area (absolute, left:0, top:0,
  width: var(--sidebar-w), z-index above panels), and give every left-side
  panel (`#controls-root`, `#media-root`, `#style-library-root`, `#paint-toolbar`)
  a top padding/inset so their content starts BELOW the chrome block. Same for
  the right action row over `#layers-root`. The chrome blocks use the SAME
  black as the base (zero seam). Measure the chrome block height and set a CSS
  var (e.g. `--rail-chrome-h`) the panels' scroll hosts respect.

### C2. Right strip chips: replace "P3 Linear · ACES" with "sRGB · PNG".
The chips are in `index.html` markup (BE-owned file — you MAY edit index.html
ONLY for additive UI wiring per the human directive; changing these two chip
TEXTS is UI copy, allowed). Keep the `.strip-chip` elements/classes.

### C3. Progressive disclosure in the controls panel.
Create a NEW Mac-owned file `js/ui/controls-disclosure-host.js`. After the
controls panel mounts (it is built by BE-owned `js/ui/controls.js` — DO NOT
edit that file), wrap each `.control-section` in `#controls-root`:
- Turn each `.control-section__title` row into a disclosure button row:
  chevron + title + a small count badge (number of controls in the section).
  Title text stays EXACTLY "STYLE","BRUSH","STRUCTURE","PATH ORDER",
  "MOTION & PATH","COLOR" (Maestro asserts them visible).
- DEFAULT STATE: STYLE and BRUSH expanded; STRUCTURE, PATH ORDER,
  MOTION & PATH, COLOR COLLAPSED (body `display:none`, chevron rotated,
  `aria-expanded=false`). Clicking the row toggles with a 150–200ms ease.
- The pinned Generate/Stop/Reset row (`.audit-pinned-actions`, added by
  audit-fix-host) stays pinned at the panel bottom, unaffected.
- Keyboard: rows are real buttons, Enter/Space toggles, focus ring per §20.10.
- Do NOT apply disclosure to the Media panel (`#media-root`) or Library —
  their flows assert many controls visible after swipes.
- Re-apply after any re-render of the controls panel (MutationObserver on
  `#controls-root` childList, debounced; guard against loops).

### C4. Mobile (≤768px): keep the existing floating chrome rows.
Panels start closed on mobile, so the nav must stay reachable without opening
a panel. The current two-row floating chrome (fixed in §20) stays as-is on
mobile. Your reparenting host must ONLY run at ≥769px and must REVERSE cleanly
on resize to ≤768px (move the clusters back into `.top-bar`, restore original
order left/center/right). Test the resize both directions.

### C5. Light theme parity.
All new chrome blocks/strips/switcher rows must read correctly in light theme
(white base, same structure). Use the existing tokens (`--bg-primary`,
`--text-*`, `--border`, `--accent`), never hardcoded dark colors.

## Hard constraints (ownership — violating these fails the task)

- NEVER edit: `js/ui/app.js`, `js/ui/controls.js`, `js/engine/**`,
  `js/ui/export.js`, `js/ui/settings.js`, `js/ui/motion.js`, `js/ui/layers.js`,
  `tests/engine.test.js`, `scripts/visual-regression.cjs`, `scripts/parity-bench.cjs`.
- `index.html`: additive UI wiring only (imports/calls for your new hosts,
  the two chip texts in C2). Do not remove any id or element.
- `css/style.css`: APPEND a new banner-delimited `§21` block at EOF. Do not
  modify existing rules; restate what you need to override (later source order
  wins — this is the established §19/§20 pattern).
- New files you create are Mac-owned: `js/ui/ui-chrome-host.js`,
  `js/ui/controls-disclosure-host.js`, plus a probe script if useful.
- Keep EVERY id and every visible text asserted by the Maestro flows:
  WWW, PAINT, Brush, Layers, Media, Library, Paint, Export, Open, Modular,
  Painter, React (aria), Untitled, Generate Painting, Stop, Reset, STYLE,
  BRUSH, STRUCTURE, PATH ORDER, MOTION & PATH, COLOR, Drop an image to begin,
  Or click Open above, Ready, and all `btn-*` / `toggle-*` / `media-*` ids.
- Do not break `js/ui/audit-fix-host.js` (it wraps generate/load/reset and
  pins the action row). Your chrome host loads AFTER it.
- 44px touch floor, 11px functional-text floor, focus-visible rings on every
  new interactive element (the a11y sweep enforces these).

## Verify (run these yourself, iterate until green)

```bash
export NODE_PATH=/Users/AIR2K/.npm/_npx/e41f203b7505f1fb/node_modules
export PATH="$HOME/.maestro/bin:$PATH"; export JAVA_HOME="$(/usr/libexec/java_home)"
# serve already running at http://127.0.0.1:8099 (do not start another)

# 1. Visual proof (write a small playwright probe, chromium headless shell at
#    /Users/AIR2K/Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-x64/chrome-headless-shell):
#    1440x900 dark: elementFromPoint across the canvas window top band must
#    NEVER return a top-bar cluster; canvas-head text fully visible at top of
#    window; screenshot → docs/research/brief5-wp-1440-dark.png
#    390x844 dark: chrome rows intact, no overlap; screenshot brief5-wp-390-dark.png
#    1440 light: screenshot brief5-wp-1440-light.png
#    collapsed rails: screenshot brief5-wp-1440-rails.png
# 2. Maestro (ALL must be 0 FAILED):
maestro test --headless --screen-size 1440x900 maestro/www-paint-desktop-regression.yaml
maestro test --headless --screen-size 390x844  maestro/www-paint-mobile-ui-audit.yaml
maestro test --headless --screen-size 1440x900 maestro/www-paint-media-behaviour.yaml
maestro test --headless --screen-size 390x844  maestro/www-paint-media-panel.yaml
maestro test --headless --screen-size 1440x900 maestro/www-paint-a11y-sweep.yaml
maestro test --headless --screen-size 390x844  maestro/www-paint-a11y-sweep-mobile.yaml
maestro test --headless --screen-size 1440x900 maestro/www-paint-export-panel.yaml
maestro test --headless --screen-size 390x844  maestro/www-paint-export-panel-mobile.yaml
maestro test --headless --screen-size 1440x900 maestro/www-paint-style-library-desktop.yaml
maestro test --headless --screen-size 390x844  maestro/www-paint-style-library.yaml
maestro test --headless --screen-size 1440x900 maestro/www-paint-primitive-mixer.yaml
maestro test --headless --screen-size 1440x900 maestro/www-paint-maestro-check.yaml
maestro test --headless --screen-size 1440x900 maestro/ui-fix-verification.yaml
maestro test --headless --screen-size 1440x900 maestro/www-paint-modular-switch.yaml
maestro test --headless --screen-size 1440x900 maestro/www-paint-style-picker.yaml
# 3. Probes:
node scripts/a11y-sweep.cjs --widths=390,768,1024,1440,1920   # all counters 0
node scripts/overlay-coverage-probe.cjs --widths=390,1440     # all surfaces ok
node scripts/visual-regression.cjs   # got-hashes must stay: pencil 1a0742d757bc1264 ink a20a11829fc2aff5 watercolor b1361f5226c6e681 oil c3994341b4760341 charcoal 9db50efff8af17bd marker e5c661d49f4a9d46 cross-hatch 234c6d746c3638ed halftone 1d04b52fa87bae9b graphic 3d2f4addc5622c65 (pass=0 vs committed baselines is PRE-EXISTING drift, expected)
```

If a Maestro flow fails ONLY because a control legitimately moved (e.g. it now
needs the left rail open), you may update that Mac-owned flow minimally
(add a tap/swipe step) — never delete or weaken an assertion, never rename
labels to game a gate.

## Definition of done

At 1440×900 dark, a screenshot of WWW_PAINT reads like the LAYERS reference:
one black shell, two seamless full-height panels, a clean bright canvas window
with NOTHING floating over its top, header inside the window, artwork frame
centred, one playback pill at the bottom. The left panel shows a quiet mode
switcher + disclosure sections (2 open, 4 collapsed) + pinned Generate row.
All gates above green. Write a short completion note to
`docs/research/brief5-log.md` with the raw gate outputs and screenshot paths.
