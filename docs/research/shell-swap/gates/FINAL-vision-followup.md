# FINAL Vision follow-up (pill crop)

## Fresh artifacts (mine)
- `/tmp/look-full.png` (regenerated)
- `/tmp/look-pill.png` (regenerated, fresh crop used for vision attempt)
- `/tmp/look-library.png` (regenerated)

## DOM/geometry probe (mine, PASS)
Command: quick Playwright probe (same assertions as look-probe.mjs, no-sandbox, domcontentloaded) against `http://127.0.0.1:8099/index.html` at 1440x900.

Raw result:
```json
{"insertBarCentreDelta":0,"motionCentreDelta":0,"chooseFileCentreDelta":0,"chooseFileDark":true}
PASS
```

Interpretation: pill centre == canvas centre (delta 0px), motion centre == canvas centre (delta 0px), choose-file button centre == row centre (delta 0px), choose-file bg dark.

## Automated qwen3-vl /api/chat
- Attempted `qwen3-vl:4b-instruct` on `/tmp/look-pill.png` (512px). Request timed out at 120s; no usable verdict.
- **Automated qwen verdict: NOT OBTAINED (timeout/stall).**

## Status
- Measurable centring requirement: **PASS** (delta 0).
- Brief's explicit automated vision-crop verdict "centred": **NOT OBTAINED** from qwen in this environment.
