# UI-SDK — the React UI SDK on WWW_PAINT (round 1, Mac, 2026-11-17)

**Stream:** ui-sdk setup + first React surface (the user's brief, relayed from
BE: *"Set up ui-sdk in this React project"*). **Mac-owned files only.** No
ThinkPad-owned file touched.

---

## 1. What the brief was

The verbatim setup prompt:

> Set up ui-sdk in this React project. It needs React 19 or newer.
> 1. Install @ui-sdk/react and @ui-sdk/core with the project's package manager.
> 2. Add a note to AGENTS.md: before using ui-sdk, follow the ui-sdk skill if
>    it's installed, and read node_modules/@ui-sdk/react/docs/llms.txt. To build
>    a new component, also search node_modules/@ui-sdk/react/docs/core.md by
>    heading, and read rendering.md next to it.
> 3. If you support skills, run: `npx skills@latest add vercel-labs/ui --skill ui-sdk`

## 2. What was already there (found, not assumed)

| Thing | State |
|---|---|
| `package.json` / `package-lock.json` | present, **untracked**, created 2026-11-16 23:04 — declares `@ui-sdk/{core,react} ^0.1.0-beta.3` + `react`/`react-dom ^19.3.1`, scripts `ui` / `ui:build` / `ui:preview` |
| `skills-lock.json` | untracked; records the `ui-sdk` skill from `vercel-labs/ui` @ `282f447` and `maestro` |
| `.agents/skills/ui-sdk/` | present (SKILL.md + 7 references), symlinked from `.claude/skills/ui-sdk` and `.hermes/skills/ui-sdk` |
| `node_modules/@ui-sdk/` | **missing** — the packages were declared but never installed |
| `vite` / `@vitejs/plugin-react` / `@types/react` | **missing** |
| the AGENTS.md note | existed **only** in `.syncthing.AGENTS.md.tmp` (a stale 2003-line Syncthing temp file), not in `AGENTS.md` |

## 3. Done

1. **Installed** `npm install` → `@ui-sdk/core` + `@ui-sdk/react` 0.1.0-beta.3,
   React 19.3.1; dev deps `vite@7.3.8`, `@vitejs/plugin-react@5.2.0`,
   `@types/react@19.3.0`. (`@vitejs/plugin-react@6.3.0` needs vite ^8; 5.2.0
   supports vite 7 — installed that rather than bumping vite.)
2. **Skill** already present from `vercel-labs/ui`; verified byte-identical in
   all three locations (`md5` match).
3. **AGENTS.md** — the §"ui-sdk (React UI SDK)" note added, worded as the
   brief specifies.
4. **React surface** `js/ui/react/`:
   - `index.html`, `main.jsx` — mounts `<StyleLibrary>` in `StrictMode`,
     creates the agent bridge **before** React renders.
   - `StyleLibrary.jsx` — the Style Profile library on ui-sdk: `Select`
     (filter), `Listbox` + `ListboxGroup`/`ListboxItem` (profiles), `Switch`
     (apply), `Dialog` + `Field`/`Input`/`Button` (save / import / export /
     delete), `Tooltip` (reference-confidence chip).
   - `styles.css` — `@layer ui-sdk;` + the `--ui-*` dark tokens + the
     `data-slot` rules (ui-sdk renders **no styles of its own**).
5. **Build config** `vite.config.js` — dev server on 5178, `ui:build` → `ui-dist/`.
6. **Two probes** — `scripts/react-ui-probe.cjs` (real Chromium: accessible
   name, 44px floor, off-screen, doc overflow, dialog geometry) and
   `scripts/react-agent-probe.cjs` (the skill's agent-readiness test).

## 4. The core is reused, not rewritten

`StyleLibrary.jsx` imports the **existing** pure module
`js/ui/style-library.js`'s sibling `js/ui/style-library-core.js`
(`ProfileLibrary`, `defaultProfile`, `coerceProfileName`,
`referenceConfidence`, `refConfidenceAdvice`, `summarizeProfile`). **No engine
file, schema or core change.** The original vanilla-DOM panel still exists and
still runs; this is a second, additive surface.

## 5. Defects found (all in my own new code)

1. **`ListboxItems` cannot wrap children.** It is a *data* renderer
   (`ListItems({items})`); with no `items` prop on `Listbox` it threw
   `TypeError: Cannot read properties of undefined (reading 'map')` and the
   whole panel crashed to a blank root. Fixed by using the documented JSX
   composition (`ListboxGroup` → `ListboxItem` children). The stack trace is
   what found it — the build was green throughout.
2. **`library.save()` returns the PROFILE, not `{ok, errors}`, and THROWS.**
   I wrote `result.ok` / `result.errors.map(...)`; `result.errors` was
   undefined → `undefined.map` inside the Save press, so Save silently did
   nothing while the DOM looked fine. Fixed with a `try/catch` and an `id`
   check.
3. **`DialogClose` takes `action`, not `onClick`.** The delete handler never
   ran. Found by reading `DialogCloseProps` in the `.d.ts`.
4. **No default styles** — ui-sdk is unstyled, so every `Button` was 21px tall
   and the 44px floor failed. Added the `data-slot` rules; the chip (a tooltip
   trigger) got its own 32px pill rule.
5. **Duplicate labels** — a `DialogTrigger` button and its `Dialog` share one
   label, so an agent step `"Save current"` named two components. Gave the
   triggers and the row actions distinct `aria-label`s.

## 6. Verified (raw)

```
$ node tests/engine.test.js         Passed: 165  Failed: 0
$ node tests/ref-analyze.test.js    ✅ All ref-analyze tests passed!
$ node tests/style-library.test.js  ✅ All style-library tests passed!
$ node tests/export-panel.test.js   Passed: 90  Failed: 0
$ node tests/primitive-mixer.test.js ✅ All primitive-mixer tests passed!
$ node tests/r4.test.js             === Track R4 seam: Passed 43  Failed 0 ===
$ node tests/modular-bridge.test.js === Track R modular bridge: Passed 22  Failed 0 ===
$ node tests/style-polish.test.js   === M12 style polish: Passed 11  Failed 0 ===
$ node tests/style-accuracy.test.js ✅ All style-accuracy tests passed!
$ node tests/{wetsim,masks,outlines,order,shaping}.test.js  ✅ all passed

$ node scripts/visual-regression.cjs
  === VERIFY SUMMARY === pass=9 fail=0 error=0 total=9      <- 9 pins UNMOVED

$ ./node_modules/.bin/vite build
  ✓ 203 modules transformed.  built in 3.46s   (ui-dist/, 470.80 kB js / 156.05 kB gzip)

$ node scripts/react-ui-probe.cjs http://localhost:5178/js/ui/react/index.html 1440
  controls 10  unnamed 0  underMin 0  offscreen 0
  docOverflowX 0  listbox true  items 2  chip "conflicting"
  dialog {"open":true,"title":"Save style profile","clipped":false,"rect":{"w":821,"h":238},
          "fields":[{"name":"Profile name","w":787,"h":44}]}
  pageErrors 1 -> favicon 404 (same as the main app)
  → identical output at 768px and 390px (dialog 768×257 / 390×276, field h 44)

$ node scripts/react-agent-probe.cjs 1440
  components 13  unnamed 0
  resolved refs: {"trigger":"button:c3","nameField":"input:c16","confirm":"button:c18"}
  open ok=true  error=none
  agent act ok=true  error=none
  rows 2 -> 3
  PASS
```

Vision review (`docs/research/react-ui-{390,768,1440}.png`): at 390px the
reviewer flagged two things — the header hint allegedly clipped, and the apply
toggle misaligned. **The clipping was disproved by measurement**
(`scrollWidth 300 == clientWidth 300`, clip 0 — the 1× raster was the artefact,
the same class as the earlier M10/M11 false alarms). The **toggle alignment was
real**: `.library-apply` had no band, so the switch sat above the label's first
line and the label landed at x 834. Fixed with an explicit grid
(`switch` col 1 row 1, label col 2 row 1, description spanning row 2);
re-measured `gapX 12`, `deltaY 5.8` (centred), `descClipped 0` at 390/768/1440.
The 1440px re-review then reported **no defects**.

## 7. Traps worth remembering

- **The agent bridge must be created BEFORE React renders.** Creating it in a
  probe after mount gave `snapshot() → []` with no error
  (`foundation/kernel/watchers.js` queues instances until `install()`).
- **A closed dialog's contents are not in the bridge.** `Profile name` / `Save
  profile` only appear after the trigger is pressed; an agent test that
  resolves those refs in one pass fails.
- **`vite.config.js` `root` must stay the repo**, not `js/ui/react/`:
  `StyleLibrary.jsx` imports `../style-library-core.js`, which is outside a
  narrowed root and silently 404s (`Failed to fetch dynamically imported
  module`), crashing the panel with a blank root.
- **ui-sdk has no default CSS.** `web.css` is an *optional* separate file; a
  bare install gives 21px buttons.
- **Do not read the component docs' "Usage" snippets as the whole API.** The
  real prop names (`action`, `onValueChange`, `items` on `Listbox`) are in
  `node_modules/@ui-sdk/react/dist/*.d.ts` and
  `node_modules/@ui-sdk/core/dist/components/**`. Reading the `.d.ts` caught
  two of the five defects above.

## 8. Not done / honest scope

- **The main app is untouched.** `index.html`, `js/ui/*.js`, `css/style.css`
  are byte-identical; the React surface is additive and served separately.
- **Vision review not done** — the screenshots
  (`docs/research/react-ui-{390,768,1440}.png`) are captured and **reviewed**;
  see §6. One flagged defect was a raster artefact, one was real and fixed.
- **`ui-dist/` is a build artefact** (`.gitignore`d); it is not deployed.
- The original vanilla `js/ui/style-library.js` panel is still live. The two
  surfaces share one core and one localStorage key.
- No favicon; the single 404 in the probe is the browser's default
  `/favicon.ico` request, same as the main app.

## 9. Files

```
AGENTS.md                              §ui-sdk note added
vite.config.js                         NEW (dev 5178, build → ui-dist/)
js/ui/react/index.html                 NEW
js/ui/react/main.jsx                   NEW
js/ui/react/StyleLibrary.jsx           NEW
js/ui/react/styles.css                 NEW
scripts/react-ui-probe.cjs             NEW
scripts/react-agent-probe.cjs          NEW
docs/research/react-ui-{390,768,1440}.png + .json
docs/checkpoints/UI-SDK.md             this file
package.json / package-lock.json       already present (untracked); deps now installed
```

---

## 10. Round 1b — linked into the shell (2026-11-17 06:20)

**Why:** the human's directive — *"If it's ui related you own it"* — so the UI
(including additive `index.html` wiring and `css/style.css`) is Mac-owned. The
React surface was built but not reachable from the app; this round links it.

### What was added

| Thing | Where | Additive? |
|---|---|---|
| `#btn-react-surface` nav button | `index.html` | yes — one `<button>` |
| `#react-root` + `#profile-root` mount node | `index.html` | yes — one `<div>` |
| `import { attachReactSurface }` + `await attachReactSurface(app)` | `index.html` | yes — 2 lines |
| `js/ui/react-host.js` | NEW | the shim (styles, host bridge, mount, open state) |
| `js/ui/react/bundle.js` | NEW | committed ES-module bundle, CSS inlined |
| `scripts/react-bundle.cjs` | NEW | esbuild → self-contained `bundle.js` |
| `scripts/shell-mount-probe.cjs` | NEW | mounts it in the REAL shell and measures |
| css §17 `.react-surface-root` | `css/style.css` EOF | yes — banner-delimited block |

`bundle.js` is **committed** (unlike `ui-dist/`): the site has no build step, so
the bundle is the production artefact — the same reason `index.maestro.html`
loads `js/ui/bundle.js`. `npm run ui` (Vite) stays the dev path.

### Design

- The panel is a **secondary surface beside the vanilla library**, not a
  replacement. It starts CLOSED; `#btn-react-surface` toggles it.
- Closed state = `transform` + `opacity` + **`visibility: hidden`** +
  `pointer-events: none`. The `visibility` is required: a transform alone
  leaves the controls in the a11y tree (the sweep counted `offViewport 3`).
- The host bridge exposes `getSettings()`, `styleLibraryChanged(rows)`,
  `styleProfileApplied(result)` and `engine` — the same contract the vanilla
  panel uses, so the React panel can drive the real engine.
- The CSS is **inlined into the bundle**, so the page makes no second request
  and a missing `bundle.css` can never leave the panel unstyled.

### Verified (raw)

```
$ node scripts/react-bundle.cjs
  inlined 6.2 kB CSS → js/ui/react/bundle.js  505.8 kB
$ node scripts/shell-mount-probe.cjs 8097 1440
  react-root true  panel true  surface true
  toggle expanded=true  root rect {"x":912,"y":44,"w":520,"h":812,"onScreen":true}
  agentBridge true  hostBridge true  agentSees 13
  reactControls 8  rows 2  chip "conflicting"
  app true  vanillaLibrary true  docOverflowX 0
  pageErrors 0   PASS
$ … 768 → rect {"x":4,"y":111,"w":760,"h":749,"onScreen":true}  PASS
$ … 390 → rect {"x":4,"y":111,"w":382,"h":749,"onScreen":true}  PASS
$ node scripts/a11y-sweep.cjs --widths=390,768,1440
  @390  controls 47 underMin 0 noName 0 offViewport 0 (rail 0) clipped 0 docOverflowX 0
  @768  controls 47 … offViewport 0 (rail 0) …
  @1440 controls 31 … offViewport 0 (rail 0) …
  UNIQUE underMin 0 · UNIQUE noName 0
$ 14 node suites → Failed: 0
$ node scripts/visual-regression.cjs   pass=9 fail=0 error=0 total=9   (pins UNMOVED)
$ node scripts/rail-overlay-probe.cjs  PASS — 0 of 9 sizes failed
```

### Defects found (all mine, all fixed)

1. **The panel rendered at y=900 — below the fold.** `#react-root` was an
   unpositioned `div` in `<body>`, so it laid out after the canvas. Fixed with
   a `position: fixed` shell frame (520px, `top: var(--header-h)`,
   `bottom: calc(var(--status-h) + var(--space-2))`), full-width at ≤768px.
2. **A closed panel's controls were still measurable.** The a11y sweep reported
   `offViewport 3 (rail 6)`; a `transform` leaves the boxes in the tree.
   `visibility: hidden` on the closed state fixed it (same as the M13 rails).
3. **The panel was unreachable** — no trigger, no label. Added the nav button
   with `aria-expanded` / `aria-controls` / `nav-btn--active`.
4. **`bundle.css` was a sibling request** (404 when absent → unstyled panel).
   Now inlined into the JS by `scripts/react-bundle.cjs`.

### Traps

- **Chromium logs `/favicon.ico` 404s as a bare** `Failed to load resource …
  404 (File not found)` **with no URL.** Filter by "no URL in the message" — a
  real 404 carries its URL and must still fail the probe.
- **`fetch(HEAD)` on macOS `python3 -m http.server` times out on a 500 kB
  file.** Do not use it to decide a bundle is missing; serve and import it.
- **`visibility: hidden` is the correct closed state**, not `display: none`
  (which kills the transition) and not a transform alone (which leaves the
  controls in the a11y tree).

### 10.1 Two defects found by the shell review (both fixed)

**5. A stale `display: none` in the bundle hid the panel on a fresh mount.**
An earlier edit had left `.react-surface-root[data-closed] { display: none }`
in `js/ui/react/styles.css`. Because the bundle **injects its own stylesheet**,
that rule applied before `css/style.css` §17 could override it — so a closed
panel had `display: none`, and the `#react-root` box measured `0x0`. The panel
looked "mounted" (`data-mounted="true"`, `#profile-root` present, both bridges
live) while rendering nothing. Removed; the closed state now lives only in §17
(`transform` + `opacity` + `visibility` + `pointer-events`). Measured after:
`display: flex`, `520x812`, opens to `x 912, y 44`.

**6. A profile with no seed showed a blank SEED value.** `summarizeProfile`
returns `seed: null` when the profile carries none, and the row rendered an
empty `<dd>`. A realistic profile (the app's own `defaultProfile()` shape)
shows `3047602159` correctly — so this was a real gap for imported/hand-made
profiles, not a core bug. Now renders `engine default`.

Both were found by **measurement, not by the vision review** — the vision review
was rate-limited at the time. The reviewer's three flags on the screenshot were
**disproved by measurement**: cards right edge `1428` vs panel `1432` (8px
inside, nothing clipped), SEED/REFERENCES boxes do not overlap, and the
"App…" fragment was the status footer's own text (footer `scrollWidth 1440 ==
clientWidth 1440`, 8px below the panel). Same class as the earlier M10/M11
raster false alarms.

**Contrast audit (computed, WCAG 1.4.3 / 1.4.11):** all ui-sdk pairs pass
after raising `--ui-border` from `#2e2e2e` (1.36:1, FAIL) to `#707070`
(3.72:1 on the background, 3.17:1 on `--ui-muted`). Text pairs 5.77–16.46:1.
