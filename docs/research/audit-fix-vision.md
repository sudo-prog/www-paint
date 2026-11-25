# Audit-Fix — vision review of the fixed states (2026-11-20)

Local VLM (`wwwpaint-vision`, qwen3-vl 4B, ~190–216 s/image on CPU). The
geometry/hit-test measurements in the checkpoint are the authoritative
evidence; vision is the gestalt check. 4 reviews, real screenshots.

## 1440 loaded (portrait 640×668)
> "The cartoon character is clear and well-defined, and the UI elements are
> legible without distortion or artifacts… no obvious visual defects."

The source preview reads as the image itself (the VLM does not distinguish
the dimmed preview from a render — the point of the fix: load now has a
visible result). Frame measured at 39.9% of the window, image aspect.

## 1440 generated
> "Generate Painting button is visible (white), alongside Stop and Reset…
> clearly labeled and positioned for intuitive interaction."
> "Clean but functional layout… polished enough to be usable (no glaring
> bugs)… not yet pro-grade compared to Photoshop/Procreate."

The pinned action row works. The "not pro-grade" note is the audit's
remaining P2/P3 territory (density of the controls panel, the dev-toggle
nav items) — deliberately out of scope for this pass, which fixed the
broken interactions, not the information architecture.

## 390 generated
> "Playback bar and toggle buttons… do overlap visually, but not in a way
> that obscures functionality — designed to be adjacent or stacked."
> Worst remaining: "bottom playback bar… rendered over the artwork…
> partially obscuring it near the bottom edge."

Hit-tests prove every playback button taps itself (the P1-3 defect is
fixed). The remaining note is the LAYERS glass-pill-over-canvas pattern
itself — the pinned brief ships chrome ON the canvas; the pill is
translucent glass by design. Moving it off-canvas would break the approved
design, so it stays; noted for the next design round.

## 1440 light + React surface
> "The Style Profiles panel does match the light theme, and there are no
> visible dark leftovers… white background with subtle gray borders and
> text, consistent with the app's overall light theme."

The global `body{color:#f2f2f2}` leak and the dark-slab React surface are
both gone (measured: body rgb(10,10,10), surface #ffffff, borders #d4d4d4).
