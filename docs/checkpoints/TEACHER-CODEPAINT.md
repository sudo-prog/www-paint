# Code Paint teacher capture — results

## What was captured (frog fixture, 2026-11-18)

`scripts/capture-codepaint-console-text.cjs` hooks `fillText`/`strokeText`
in our own Playwright Chromium before paint.jas.black's scripts run, and
records every character the site draws. `scripts/decode-codepaint-console.cjs`
reconstructs its on-page stroke console (the console is a CANVAS — chars
drawn one by one — frames delimited by the 'Code Painter by Jas Black'
footer).

Decoded plan: `S(line#, x0,y0, x1,y1, x2,y2, polyPts, width, colA, colB, alpha)`
→ **996 unique strokes** (saved to `/tmp/cp-console-full.txt`, parsed to
`/tmp/cp-teacher-strokes.json`).

## Teacher statistics (the answer to "measure length and strength first")

| metric | Code Paint (996 strokes) | WWW_PAINT modular (before) |
|---|---|---|
| stroke length p50 | **129px** (canvas 1000²) | 24.6px (canvas 512×384) |
| stroke length p90 | 350px | 48.4px |
| width p50 | **3.3px** | 7.2px |
| aspect (len/width) p50 | **44:1** | 3.4:1 |
| alpha | **0.8 uniform** (996/996) | 1.0 flat |
| colour | **2-colour gradient per stroke** (colA≠colB, 996/996) | flat single colour |
| structure strokes | 156 multi-point curves (p50 len 319px) | none — isolated dabs |

Scale-corrected to our 512×384 canvas: Code Paint strokes are ~4× longer
and ~4× thinner than ours were.

## What was applied to the bridge (js/engine/modular-bridge.js)

1. `buildPalette` / `quantiseColour` — median-cut palette of the source.
   k=12 loses the blue eye + orange spot; k=24 is the measured knee.
2. Per-stroke colour gradient — 35% blend toward the 2nd-nearest palette
   entry. (First attempt sampled the source at both endpoints: the pair
   jumped palette buckets → two-tone blobs. Rejected, documented.)
3. Uniform alpha 0.8 on every stroke.
4. `strokeBudgetScale` 8 (2×/4× leave waxy unresolved blobs).
5. `chainDabs` (adjacent same-colour dab merging) — implemented, measured,
   REJECTED as default (under-covers into a thread-web); kept opt-in for
   filament styles.

Result: recognisable frog — green body, yellow mouth, blue-grey eye, orange
spot, continuous outlines. All gates green (bridge 22/22, engine, R6 22/22,
VR pins 9/9 re-baselined, parity 0.29–1.51 simMae, style-accuracy 243 PASS).
Committed 19e2003 + 915a822, pushed to main.

## Raw artefacts (in /tmp, ephemeral)

- `/tmp/cp-strokes.ndjson` — 84k raw canvas ops (1920×1080 paint surface)
- `/tmp/cp-console-ops.ndjson` — 400k fillText chars
- `/tmp/cp-console-full.txt` — 996 decoded S() lines
- `/tmp/cp-teacher-strokes.json` — parsed per-stroke dataset
- `/tmp/cp-shots/` — progressive stage screenshots
