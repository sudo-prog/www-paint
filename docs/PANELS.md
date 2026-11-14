# WWW_PAINT — panels & shell

**Written:** 2026-11-14 · **Agent:** AIR HERMES (Mac, M14)
**Owner:** Mac-owned doc. Shell markup (`index.html`) and `js/ui/app.js` are
ThinkPad-owned and were **read**, not edited.
**Evidence:** all measurements below come from `scripts/m14-docs-probe.cjs`
(2026-11-14, real Chromium, real page). Raw JSON: `docs/research/m14-docs-probe.json`.

---

## 1. The shell in one picture

The canvas is a bright window laid **on top of** one continuous black surface.
The panels are not slabs beside it — they are the same black, and the canvas
floats over the gap between them.

```
┌──────────────────────────────────────────────────────────────┐
│  TOP BAR   Brush  Layers  Media  Library  Paint  Export  …   │  --header-h: 44px
├──────┬───────────────────────────────────────────────┬───────┤
│      │            12px of base (--gap)               │       │
│  L   ├───────────────────────────────────────────────┤   R   │
│  E   │                                               │   A   │
│  F   │            CANVAS WINDOW                      │   I   │
│  T   │         (bright, radius --r-canvas)           │   S   │
│      │                                               │       │
│      ├───────────────────────────────────────────────┤       │
│ 260px│            12px of base (--gap)               │ 260px │
├──────┴───────────────────────────────────────────────┴───────┤
│  STATUS BAR   Ready · Strokes 0 · 1024 × 768                 │  --status-h
└──────────────────────────────────────────────────────────────┘
```

**Measured at 1440×900** (from the probe):

```
controls-root       role=complementary  controls=41  260x801@0,63    "Brush controls"
paint-toolbar       role=complementary  controls=4   0x0@0,0         "Paint toolbar"   ← hidden (paint mode off)
media-root          role=complementary  controls=22  0x0@0,0         "Media, wet and tonal controls" ← hidden (media mode off)
style-library-root  role=complementary  controls=8   0x0@0,0         "Style library"   ← hidden (library mode off)
layers-root         role=complementary  controls=18  260x801@1180,63 "Layers"
```

`0x0` means `display:none` — the panel is not merely off-screen, it is removed
from layout. Two panels are visible at once on desktop: the left rail and the
right rail.

**Measured at 390×900** (mobile):

```
controls-root       320x757@-340,111   "Brush controls"   ← off-screen left (panel--mobile-closed)
media-root          320x757@-340,111   "Media, wet and tonal controls"
style-library-root  250x757@0,111      "Style library"    ← the only visible one
layers-root         320x757@410,111    "Layers"           ← off-screen right
```

Below 768px the panels become `position: fixed` overlays. "Closed" is a
`translateX(±340px)`, not a removal — the panel is still in the DOM and in the
a11y tree, which is why M13 added `visibility: hidden` to the closed state.

---

## 2. The five panels

| Panel | Container | Owner | Shows when |
|--|--|--|--|
| **Controls** (Brush) | `#controls-root` | ThinkPad (`js/ui/controls.js`) | default; hidden in media / library / paint mode |
| **Media** | `#media-root` | Mac (`js/ui/media.js`) | Media nav toggled on |
| **Library** | `#style-library-root` | Mac (`js/ui/style-library.js`) | Library nav toggled on |
| **Layers** | `#layers-root` | Mac (`js/ui/layers.js`) | always (unless collapsed) |
| **Export** | `#export-panel-root` | Mac (`js/ui/export-panel.js`) | Export nav clicked — modal, independent of the rail |

Three surfaces share the **left rail** — Controls, Media, Library — and exactly
one of them may occupy it. Paint mode swaps the rail to `#paint-toolbar`
(`js/ui/app.js:302` for the paint toggle, ThinkPad-owned).

### 2.1 Controls — six sections

`js/ui/controls.js:176-181` builds them in this order:

| `#id` | Title | Contents |
|--|--|--|
| `style-section` | STYLE | categorized style picker, 51 styles in 5 categories |
| `brush-section` | BRUSH | 8 sliders: Stroke Min, Stroke Max, Density, Detail, Strength, Opacity, Randomness, Scatter |
| `structure-section` | STRUCTURE | Smart Mode toggle + Edge Follow + Align Wobble |
| `path-section` | PATH ORDER | segmented: Free / Down / Up / Right / Left / Diagonal / Spiral / Spiral In / Rings / Rings In / Clock |
| `motion-section` | MOTION & PATH | Multi-Layer toggle, One Line toggle, Outline (Off/First/Last), Region Fill (Off/Scribble/Rows) |
| `color-section` | COLOR | segmented: Exact / Quantized / Palette |

…plus `#generate-section` with the Generate button and a Stop button.

Each slider is `#ctrl-<key>`; the section bodies live in `.controls-scroll`, so
the panel chrome (strip, header, rail icons) stays fixed while the sections
scroll.

### 2.2 Media — three sections

`js/ui/media.js:226-250`:

| `#id` | Title | Contents |
|--|--|--|
| `wet-section` | WET MEDIA | wet-sim sliders + a Seed Reset action |
| `media-section` | MEDIA | p5.brush media sliders |
| `masks-section` | TONAL MASKS | band sliders + `#media-masks-preview` |

Scroll host: `.media-scroll`. Emits `media-settings-change` with
`{section, key, value, settings}`.

### 2.3 Layers

Header carries the **Add layer** button (`data-action="add-layer"`). The body
`#layers-list` renders one row per layer, **top layer first** (the array is
reversed for display, `js/ui/layers.js:94`). Each row (`js/ui/layers.js:114`):

```
.layer-row
  .layer-row__drag
  .layer-row__name              (74px floor — "Layer 1" never truncates)
  .layer-row__main
    .layer-visibility-btn       data-action="toggle-visibility"
    .layer-row__actions
      .layer-action-btn         data-action="duplicate-layer"
      .layer-action-btn--danger data-action="delete-layer"
    .layer-opacity-row
      input.layer-opacity-input        data-action="opacity-change"
      span.layer-opacity-value
    .layer-tools-row
      select.layer-blend-select        data-action="blend-change"
      select.layer-style-select        data-action="style-change"
      .layer-action-btn.layer-regen-btn  data-action="regenerate-layer"
```

Row controls are 44×44 (M13). The row **wraps** at the 250px rail — measured
children 9px inside the row's right edge at 1024/1440, `underMin 0` at
390–1920.

### 2.4 Export — modal

`#export-panel-root`, `role="dialog"`, `aria-modal="true"`. Independent of the
rail; opened by `#btn-export-panel` (which carries
`aria-expanded` / `aria-controls`). Escape closes and focus is restored (M13).
The older `#export-root` (`js/ui/export.js`) still exists and is untouched — the
two are additive siblings, not competitors.

---

## 3. The shim pattern

**The rule:** Mac-owned UI lives in Mac-owned modules. ThinkPad-owned files are
never edited. When a Mac panel needs something the host app has, the Mac module
**monkey-patches the App instance** the host exposes as
`window.__app` / `window._wwwPaint`.

Three shims exist, all in `js/ui/`:

| Shim | File | Mounts | Patches onto `app` |
|--|--|--|--|
| Media | `media-host.js` | `MediaPanel` on `#media-root` | `app.media`, `app.toggleMediaMode()` |
| Library | `style-library-host.js` | `StyleLibraryPanel` on `#style-library-root` | `app.library`, `app.toggleLibraryMode()`, wraps `toggleMediaMode` |
| Export | `export-host.js` | `ExportPanel` on `#export-panel-root` | `app.exportPanel` |

All three are called from `index.html` (lines 312-342), **not** from `app.js`:

```html
<script type="module">
  import './js/ui/debug.js…';
  import './js/ui/settings.js…';
  import { initApp } from './js/ui/app.js…';
  import { attachMediaPanel } from './js/ui/media-host.js…';
  import { attachStyleLibrary } from './js/ui/style-library-host.js…';
  import { attachExportPanel } from './js/ui/export-host.js…';
  import { initA11yHardening } from './js/ui/a11y-hardening.js…';

  const app = initApp();
  if (app) {
    window._wwwPaint = app;
    attachMediaPanel(app);
    attachStyleLibrary(app);
    attachExportPanel(app);
    initA11yHardening();   // runs LAST, after every panel has mounted
    …
  }
</script>
```

### The contract each shim honours

1. **Null-safe.** `attach*(app)` returns `null` when `app` is missing, and
   `attach*(app, root)` returns `null` with a `console.warn` when the panel root
   is not in the DOM. Nothing throws.
2. **Idempotent.** Every shim guards re-entry: `if (app.media) return app.media;`
   and `app.__libraryHostPatchedMedia` for the wrapped toggle. A double call
   cannot double-mount.
3. **Viewport-aware.** Desktop and mobile hide a rail panel differently:
   `.panel--hidden` (`display:none`) on desktop, `.panel--mobile-closed`
   (`translateX`) on mobile. Every shim listens for `resize` and re-derives the
   correct class, or a desktop→mobile crossing leaves the panel unreachable.
4. **One rail, one occupant.** `style-library-host.js` wraps `toggleMediaMode`
   once so entering media mode retires the library panel — otherwise two 260px
   panels stack in the same rail.
5. **ThinkPad can retire it.** The shim is additive; folding the same calls into
   `App._init()` and deleting the shim is a safe refactor. Nothing outside the
   shim depends on it.

---

## 4. Ownership boundary

From `AGENTS.md` §"File ownership" (full lists in `HANDOFF.md` §6).

**ThinkPad-owned — never edit:**

```
js/engine/optimizer.js        js/engine/generator.js
js/engine/analyzer.js         js/engine/engine.js
js/engine/painter.js          js/engine/scorer.js
js/engine/renderer.js         js/engine/relief.js
js/ui/controls.js             js/ui/app.js
tests/engine.test.js          scripts/parity-bench.cjs
scripts/visual-regression.cjs tests/parity/harness.html
docs/CLEANROOM.md  docs/ROADMAP.md  docs/ROADMAP_STATUS.md
docs/AI_STYLE_HARNESS.md  docs/STYLE_PROFILE.md  .github/**
```

**Mac-owned:**

```
js/engine/wetsim.js           js/engine/masks.js
js/ui/layers.js               js/engine/brush-stamp-engine.js
js/styles/*                   tests/wetsim.test.js
docs/checkpoints/P*.md        docs/research/*
HANDOFF.md                    AGENTS.md
```

**Shared — propose via OPS_LOG, do not edit:** `js/ui/controls.js`,
`js/ui/app.js`, `docs/ROADMAP_STATUS.md`.

**A discrepancy worth recording:** the AGENTS.md ownership list does not
mention `js/ui/media.js`, `js/ui/style-library*.js`, `js/ui/export-*.js` or
`js/ui/a11y-hardening.js` — all Mac-authored by M10–M13. The ownership list
predates them. **Recommendation for BE:** add them to the Mac-owned list so the
next agent does not hesitate to edit them.

---

## 5. Panel state machine

```
                    ┌─────────────┐
      load ────────▶│  CONTROLS   │  (desktop: visible; mobile: closed)
                    └──────┬──────┘
        Media nav ────────▶│ Media mode  ──▶ CONTROLS hidden, MEDIA shown
        Library nav ──────▶│ Library mode ─▶ CONTROLS hidden, LIBRARY shown
        Paint nav ────────▶│ Paint mode ──▶ CONTROLS hidden, PAINT-TOOLBAR shown
                    ┌──────┴──────┐
                    │   LAYERS    │  independent; collapse → 56px icon rail
                    └─────────────┘
                    ┌─────────────┐
                    │   EXPORT    │  modal; independent of the rail
                    └─────────────┘
```

Rules, verified in code:

- **Exactly one of Controls / Media / Library / Paint occupies the left rail.**
  `media-host.js:98` and `style-library-host.js:103` both toggle
  `controls-root`'s `.panel--hidden`.
- **Media beats Paint.** `media-host.js:103` sets
  `paint-toolbar--active` to `app._paintMode && !app._mediaMode`.
- **Library beats Media.** `style-library-host.js:99-100` calls
  `toggleMediaMode()` off when library mode is entered, and the wrapped
  `toggleMediaMode` retires the library when media mode is entered.
- **Layers never shares.** It is the right rail; collapse is a width change to
  `--nav-w` (56px), not a hide.
- **Export is a modal.** It has no rail state at all.

---

## 6. Tokens that position everything

From `css/style.css:104-114`:

| Token | Value | Controls |
|--|--|--|
| `--header-h` | 44px | top bar height; mobile panels pin to `top: var(--header-h)` |
| `--sidebar-w` | 260px | left rail width |
| `--layers-w` | 260px | right rail width |
| `--gap` | 12px | the black frame around the canvas |
| `--nav-w` | 56px | collapsed icon rail |

Canvas inset (`css/style.css:668-671`):

```css
.canvas-wrapper {
  top:    var(--gap);
  bottom: var(--gap);
  left:   calc(var(--sidebar-w) + var(--gap));
  right:  calc(var(--layers-w) + var(--gap));
}
```

Collapsing a rail widens the window by the difference:

```css
.canvas-wrapper.nav-left  { left:  calc(var(--nav-w) + var(--gap)); }
.canvas-wrapper.nav-right { right: calc(var(--nav-w) + var(--gap)); }
```

**Mobile overrides all of it** (`css/style.css:1630-1660`): panels become
`position: fixed; top: var(--header-h); bottom: var(--status-h); width:
min(320px, 85vw)`, and `.canvas-wrapper` goes full-bleed with no radius.

---

## 7. Verifying this document

```bash
# Serve the repo (two servers may already be running from earlier sessions)
lsof -nP -iTCP:8099 -sTCP:LISTEN
python3 -m http.server 8099 --bind 0.0.0.0

# Panel inventory + nav wiring + style registry + project structure
NODE_PATH=<dir containing playwright-core> node scripts/m14-docs-probe.cjs --width=1440
NODE_PATH=<dir containing playwright-core> node scripts/m14-docs-probe.cjs --width=390
```

`--width` is the viewport width; the probe reports each panel's live rect, so a
panel's visibility state is directly readable from the output.

**A11y sweep** (the panel-level pass that owns the 44px / naming claims):

```bash
NODE_PATH=<dir containing playwright-core> node scripts/a11y-sweep.cjs --widths=390,500,768,1024,1440,1920
```

**Maestro** (asserts the accessibility tree, not pixels):

```bash
export PATH="$HOME/.maestro/bin:$PATH"
export JAVA_HOME="$(/usr/libexec/java_home)"
maestro test --headless --screen-size 390x844 maestro/www-paint-mobile-ui-audit.yaml
maestro test --headless --screen-size 1440x900 maestro/www-paint-desktop-regression.yaml
```

---

## 8. Gotchas

1. **`0x0` in the probe output means `display:none`, not "off-screen".** A
   closed mobile panel reports a real rect *and* a non-zero position — a
   negative `x` or a positive `x` past the viewport width. Check the class list
   (`panel--hidden` vs `panel--mobile-closed`), not the rect alone.
2. **`#paint-toolbar` and `#media-root` are `0x0` in the default desktop state.**
   That is correct, not a bug. Only Controls + Layers are visible on load.
3. **Two panels share the left rail.** Any change to the rail's visibility must
   go through the same shim guard, or two 260px panels will stack.
4. **`.panel--media.panel--hidden` is `display:none` on desktop but
   `display:flex` at ≤768px.** The media query re-declares it deliberately so the
   panel can be an overlay. Do not "fix" this to a single rule.
5. **Panel chrome is not owned by the panel.** The identity strip, header and
   rail icons are placed by `index.html` and preserved by every panel's
   `_render()` (`root.innerHTML = ""` is always preceded by a filter for
   `.panel-strip` / `.panel-head` / `.rail-icons`). Deleting them breaks the
   shell.
6. **Layer rows render in reverse.** `layers.js:103` reverses the array for
   display; index 0 in the DOM is the top layer, not `layers[0]`.
