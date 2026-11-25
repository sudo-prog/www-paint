# OIL-DLI-PORT — Faithful dli/paint Fluid Paint port for WWW_PAINT OIL style

## Status: IN PROGRESS

## Goal
Replace the striped-brush approximation in `js/engine/oil-impasto.js` with the actual
upstream dli/paint Fluid Paint technique (MIT) applied to WWW_PAINT's OIL style.

## Port scope
- `js/engine/dli-paint/` — faithful port modules + shaders (MIT attribution in headers)
- `js/engine/oil-impasto.js` — replace 2D approximation with port/fallback adapter
- `js/styles/oil.js` — wire the new backend
- `js/engine/renderer.js` — lifecycle/reset seam only

## Backend selection
- Preferred: WebGL1 offscreen canvas with `OES_texture_float` + `OES_texture_float_linear`
- Fallback: existing 2D-canvas height-field implementation (must be visibly better than
  striped threads, not the old ribbons)

## Verification probes
- `node tests/oil-impasto.test.js`
- `node tests/engine.test.js`
- `env -u DISPLAY NODE_PATH=/home/thinkpad/.hermes/hermes-agent/node_modules node scripts/oil-dli-probe.cjs`
- `git diff --stat`
- `git status --short`
- Screenshot evidence under `docs/research/`
