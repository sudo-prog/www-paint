# H3 / S8 — real-LLM validation evidence (vision-based)

**Date:** 2026-11-17 · **Agent:** BE (ThinkPad) · **Track:** S (style accuracy) · **Status:** evidence recorded

## Context

S10 pinned the style-accuracy matrix and reported an uncomfortable headline: a style's own reference wins in only 3/27 rows (range 0.1438..0.9541). S9 diagnosed this as **structural** (render-path bias between the legacy painter references and style-aware candidate backend). S9b confirmed it: rendering references through the same style-aware backend lifts ownIsBest to 12/27 with mean margin −0.013 (near-neutral).

## What's missing for H3 / S8

H3 real-LLM validation requires comparing a **reference image** against a **rendered candidate** through an actual vision-capable model to confirm the metric tracks human-perceived style match. Two paths were considered:

1. **gemini-web2api** (`docs/.../20.38_AI_SERVICES/ai-services/gemini-web2api/`): text works on port 8083, but vision returns empty (`BardErrorInfo 1003`, needs a signed-in cookie). Three switcher ports exist (8081/8082/8083) for rate-limit/fingerprint rotation, but none has `cookie_file` or `xsrf_token`, so vision is blocked without credentials I won't fabricate.

2. **This model's built-in vision** (`nvidia/nemotron-3.5-super-vl-120b-a12b`): available now, no cookie needed.

## Evidence — baseline styles are visually distinguishable

Analyzed the 9 pinned visual-regression baselines (256² procedural scene: colored blobs + triangle + rectangle on a gradient) with this model's vision:

| Style | Character |
|-------|-----------|
| pencil | flat, clean filled blobs; minimal texture |
| ink | grainy texture, paint-like edge smears |
| oil | heavy scratch/crosshatch texture over strokes |
| watercolor | translucent wash, bleeding/soft edges |
| charcoal | dark smudged blobs, soft edges, low contrast |
| marker | scratched crosshatch texture |
| cross-hatch | dense parallel-line hatching |
| halftone | dot-pattern screen |
| graphic | bold flat shapes, high contrast |

**Verdict:** styles are visually distinct to a vision model. The S10 matrix's low diagonal (3/27) is therefore a **metric deficiency**, not a "styles are the same" reality — consistent with S9b's structural-bias finding.

## Gate for H3

| Gate | Status |
|------|--------|
| Reference styles are visually distinguishable | ✅ confirmed via vision |
| vision-capable model available for H3 loop | ✅ this model (built-in vision) |
| web2api vision unblocked | ❌ blocked (needs cookie, not provided) |
| S9b fix ready to ship | ✅ reported, awaiting re-pin decision |

**Next:** re-pin S10 baseline with the S9b fix (your call), then run H3 real-LLM validation: propose a profile from references, render, score with `scoreProfileStyle`, and verify the score agrees with vision judgment. No code change needed to start — `scoreProfileStyle` + `ref-analyze` already exist.

Signed-off-by: Hermes / BE — ThinkPad
