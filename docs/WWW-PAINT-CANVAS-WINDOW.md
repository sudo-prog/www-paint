# WWW_PAINT — canvas-as-window shell

**Written:** 2026-10-26 · **Agent:** AIR HERMES
**Artifact:** `docs/research/www-paint-canvas-window-shots/` — one PNG per viewport
**Ported from:** LAYERS Desktop `docs/research/layers-canvas-over-panels.md` (the design the user approved with "Looks Great!")

---

## 1. What changed

The shell was restructured so **the canvas is a bright window and the black chrome
is laid on top of it.** The app went from a canvas sandwiched between two opaque
panels to a canvas inset inside one continuous black surface.

| | Before | After |
|--|--|--|
| Canvas | flex sibling between two panels | bright window, `position: absolute`, on top |
| Panels | `var(--surface)` `#0C0C0C` | `var(--bg)` `#000000` — same value as the base |
| Canvas border | `1px solid var(--line-2)` | **none** |
| Panel radius | square | shell 20 / canvas 28 / row 8 |
| Playback bar | strip under the window | pill on the canvas |
| Top bar | `#0C0C0C` + bottom hairline | `--bg`, no hairline |

---

## 2. The layers, bottom to top

| z | Layer | Surface | Corners |
|--|--|--|--|
| 0 | **Base** — the app's black, runs to the edge | `--bg` `#000000` | app rounded at 20px |
| 1 | **Side panels** — same black as the base | `--bg` `#000000` | square, integrated |
| 2 | **Canvas** — a bright window, on top | mid-grey gradient | rounded at 28px |
| 3 | **Pill toolbar** — on the canvas | chrome, `--r-pill` | pill |

**The critical detail: the panels use the SAME colour value as the base.**

```css
.panel  { background: var(--bg); }   /* not a tint */
.app    { background: var(--bg); }
```

A tint here — even 2.4% white — leaves a brightness step at the panel/black
boundary, and a step reads as a seam. Identical values mean no step, so the panel
and the black read as one continuous surface and only the *content* separates them.

**Measured:** panel `rgb(0,0,0)` → 12px of identical `rgb(0,0,0)` → canvas. Zero delta.

---

## 3. The black frame

The canvas does not touch the panels. There is a **12px strip of black** between a
panel and the canvas on each side, and 12px above and below.

```css
.canvas-wrapper {
  top:    var(--gap);                                   /* 12px */
  bottom: var(--gap);
  left:   calc(var(--sidebar-w) + var(--gap));
  right:  calc(var(--layers-w) + var(--gap));
}
```

That strip is not a border — it is the base showing through, so it is the same black
as everything else. `--gap` is the one number that controls it.

**`.main` must be explicitly `--bg`.** It was transparent, which meant the frame's
owner was whatever happened to be behind it; any tonal difference in that element
reads as a line at the canvas edge.

---

## 4. No canvas border

A `1px` light border on the canvas drew a hard vertical line exactly where the panel
meets the canvas. On a bright surface a light border is the brightest thing in the app.

**Fix: the canvas has no border at all.** It is defined by its own luminance against
the black around it.

---

## 5. The canvas is bright

The canvas has to be clearly luminous, or it reads as another panel.

```css
background: linear-gradient(160deg, #6b7787 0%, #525c6b 52%, #5f6a79 100%);
```

**Consequence:** when the canvas went bright, its text had to invert. The canvas
header and the placeholder are now dark-on-light (`rgb(0 0 0 / 0.58)`), or they vanish.

---

## 6. Radius ladder

| Token | Value | Used for |
|--|--|--|
| `--r-shell` | 20px | the whole app — black runs to the edge, rounded |
| `--r-canvas` | 28px | the canvas window |
| `--r-row` | 8px | list rows |
| `--r-pill` | 999px | pill toolbar |

The app is one rounded black surface: `.app` carries the radius and
`overflow: hidden`, which clips its children to the curve.

---

## 7. Panels collapse to a rail

Both panels collapse to a **thin black icon rail** (56px), icons only. The canvas
widens to reclaim the space:

```css
.canvas-wrapper.nav-left  { left:  calc(var(--nav-w) + var(--gap)); }
.canvas-wrapper.nav-right { right: calc(var(--nav-w) + var(--gap)); }
```

The collapsed rail has **no border and no background of its own** — it is the black
base with icons on it.

**Mobile differs:** below 768px the canvas is full-bleed and the panels become
`position: fixed` overlays, so "collapse" slides the panel off-screen instead of
narrowing it.

---

## 8. Three regressions the port exposed (all fixed)

These were real bugs in the existing code, found by measuring rather than reading.

### 8.1 `controls.js` and `layers.js` destroyed the shell chrome

Both managers did `this.root.innerHTML = ""`, which deleted the panel header, the
collapse chevron and the identity strip that the shell had placed inside the panel.

**Fix:** both now filter the existing children for the chrome classes and re-append
them before clearing. The controls sections moved into a `.controls-scroll` host so
the chrome stays fixed while the sections scroll.

### 8.2 `CanvasManager._updateDPR()` resized the artwork to its own box

```js
const rect = this.canvas.getBoundingClientRect();   // ← the bug
this.canvas.width = Math.round(rect.width * this.dpr);
```

The canvas is sized *by* its `width`/`height` attributes, so reading its rendered box
and writing it back captured whatever size CSS gave at that instant. Once the canvas
became absolutely positioned, that was its first laid-out size — the artwork was
silently resized to 876×657 and stayed there.

**Fix:** the backing store is the logical size × DPR. `setSize()` now sets the logical
size and the `aspect-ratio`, and `.canvas-frame` owns the ratio.

### 8.3 Three copies of the image-load path had drifted

The Open button, drag-and-drop and click-to-pick each loaded an image differently. The
Open-button copy resized only the renderer, leaving the canvas element and the header
stale — the header read `1024 × 768` for a 640×668 image.

**Fix:** one `App.loadImageFile(file)`, called by all three.

---

## 9. Verification

`scripts/verify-shell.cjs` — Playwright against the real page, 390 / 768 / 1024 /
1280 / 1440 / 1920.

| Check | Result |
|--|--|
| Panel ↔ black delta | **0** — identical values, no seam |
| Black frame around canvas | 12px on all four sides |
| Canvas border | `0px none` |
| Canvas on top | yes (`elementFromPoint` at canvas centre returns the canvas) |
| App rounded and clipped | radius 20px, `overflow: hidden` |
| Truncated labels | **0** |
| Horizontal scroll | **0** |
| Console / page errors | **none** |
| Collapse widens the window | 292px → 68px |

**ALL WIDTHS OK: true**

Functional checks (real pixels, not just "no error"):
- Style picker: 51 styles, selection works
- Generate: 427,520 non-transparent pixels drawn from a 640×668 source
- Paint: a drawn stroke landed (0 → 676 non-transparent pixels)
- Image load: canvas and header both track the source (640 × 668)
- Layers, motion bar, settings modal: all render

---

## 10. Pitfall — vision disagrees with the DOM

`vision_analyze` reported the brush-style names as "cut off at the panel edge" at
390px. The DOM says otherwise:

```
textContent: "Pencil / Graphite"   clientW: 94   scrollW: 94   → zero clipping
```

The label uses `-webkit-line-clamp: 2` and `overflow-wrap: anywhere`, so a long name
wraps rather than clipping. **The DOM measurements were right and vision was wrong —
the same failure mode already recorded in
`2026-10-23_LAYERS_CANVAS_WINDOW_SAVED.md`.** When the two disagree, trust the DOM and
say so.

---

## 11. Files

| File | Change |
|--|--|
| `css/style.css` | the shell: tokens, panels behind, canvas on top, pill bar, mobile block |
| `index.html` | panel chrome, canvas header, collapse + mobile toggles, one load path |
| `js/ui/app.js` | `_bindCollapseControls`, `_setPanelCollapsed`, `_syncCanvasHeader`, `loadImageFile` |
| `js/ui/canvas.js` | `_updateDPR` no longer reads the rendered box; `setSize` owns the ratio |
| `js/ui/controls.js` | preserves shell chrome; sections in a `.controls-scroll` host |
| `js/ui/layers.js` | preserves shell chrome; header supplied by the shell |
| `scripts/verify-shell.cjs` | new — the verifier |

---

## 12. Style picker design refinements

The style picker was rebuilt as a **categorized dropdown with thumbnail previews**:

- **Thumbnails**: each of the 51 styles rendered as a 64×64 PNG using the style's own `generate`+`render` pipeline (~8 sample strokes per thumbnail, ~200ms total). Generated at startup via `js/ui/thumbnails.js`, cached for the page lifetime.
- **Categories**: 5 collapsible category pills (Drawing, Painting, Graphic, Craft, 3D / Material). Only the active category's thumbnails are in the DOM — hidden elements using `hidden=` were removed because they intercepted clicks on nearby controls.
- **Dropdown animation**: 0.25s cubic-bezier enter, chevron rotates 180°.
- **Hover/active states**: thumbnails lift (`translateY(-3px)`), gain depth shadow, inner radial glow appears; active state gets a primary-colored ring.
- **Pill toggles**: Smart Mode and One Line replaced from large segmented controls to compact pill buttons (radius 999px, inset highlight when on, `transform: translateY(-1px)` on hover).
- **Typography**: switched from monospace (`--f-mono`) to UI font (`--f-ui`/Geist) across picker/toggle/labels; removed all-caps text-transform in favor of normal case with proper font-weight hierarchy.

### What changed in code

| File | Change |
|--|--|
| `js/ui/thumbnails.js` | new — thumbnail cache generator using mock analyzer + style render pipeline |
| `js/ui/controls.js` | replaced `_renderStylePicker` (flat grid) with categorized dropdown + thumbnails; replaced `_renderToggle` (segmented) with compact `pill-toggle`; thumbnails rebuilt per-category via `rebuildGrid()` to avoid pointer-event interception |
| `css/style.css` | full styles for picker trigger, dropdown with shadow/depth, category pills, thumbnail grid with hover/active states, pill toggles; removed old `.style-grid`, `.style-btn`, `.style-btn__swatch` rules |
| `js/styles/index.js` | added `CATEGORY_LABELS` export |
| `js/engine/brush-stamp-engine.js` | fixed relative import path (`../../vendor/` → `../vendor/`) |
| `index.html` | removed external Google Fonts links (fonts are self-hosted via `@font-face`); cache-bust to `?v=20261027e` |

### Verification

- Playwright: 0 errors, all categories switch, thumbnails render, pills toggle correctly
- Engine tests: 31/31
- Shell verifier: ALL WIDTHS OK at 390/768/1024/1280/1440/1920

**Maestro status**: Initially blocked — three root causes identified:

1. **Missing explicit `launchApp` command** — the `url:` config sets the app ID, but `launchApp` is what triggers Chrome to actually navigate. Without it, Maestro's Chromium stays on `data:,`.
2. **CDP version mismatch** — Chrome 155 (system) has CDP v155, but Selenium 4.43.0 (bundled with Maestro 2.11.0) only ships `selenium-devtools-v145` through `v147`. Fixed by downloading Chrome for Testing 147.
3. **CSS selectors in `tapOn`/`scrollUntilVisible` hang** in Maestro web mode — use text-based selectors instead. On 1440×900 viewport, all assertions pass:

```
Launch app ... COMPLETED
Assert "WWW" visible ... COMPLETED
Assert "Pencil / Graphite" visible ... COMPLETED
Tap on "Pencil / Graphite" (opens dropdown) ... COMPLETED
Assert "3D / Material" visible ... COMPLETED
Tap on "Graphic" ... COMPLETED
Scroll until "Neon" visible ... COMPLETED
Tap "Neon" at center ... COMPLETED
Assert "Neon" visible (trigger updated) ... COMPLETED
Take screenshot ... COMPLETED
```

**To run Maestro locally:** Chrome for Testing 147 is required. Download with:
```bash
curl -sL "https://storage.googleapis.com/chrome-for-testing-public/147.0.7727.117/mac-arm64/chrome-mac-arm64.zip" -o /tmp/chrome-147.zip
```
Then set `CHROME_BINARY="/path/to/chrome" maestro test --headless --screen-size 1440x900 maestro/www-paint-style-picker.yaml`.

### Design principle applied

Per the craft floor ([`impeccable`](#)): "Monospace as a costume for 'technical' rather than for code, data, or measurement" — the old picker's all-caps monospace labels were a default-CSS signal. Replaced with `--f-ui` (Geist) for all UI text, reserved monospace only for the data/labels that are actually technical values.
