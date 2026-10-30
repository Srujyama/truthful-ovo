---
version: 1
slug: "design-figma"
primary_target: "design/figma"
related_targets: ["scripts/figma-native-system.mjs","design/figma/native-system.json"]
---

# Native Figma craft

Mode: Operate for product screens and component editing; Read for handoff guidance. Preserve the Apple/Ramp visual world, product truth and the original 17 screen identities and 47 review interactions.

## Direction contract

THESIS: Make the file work as a maintainable design system. Screen controls must be linked to real components; a catalog of isolated specimens is insufficient.

OWN-WORLD: Existing Public Sans, white/graphite/forest and named financial states remain unchanged. Shared text styles, color variables and a small repeated spacing/radius scale replace scattered maintenance.

STORY: Open the financial review flow, edit an instance through Label/Style/State, update the main component when the change is global, and consult the Handoff page for implementation meaning and test scope.

FIRST VIEWPORT: Keep the approved portfolio and selected financial state. The Design system page exposes actual Button and Status variant sets and an editable usage example. Handoff has concise native instructions and implementation/state guidance.

FORM: Figma-native refinement, explicitly requested by the user; no identity choice or new comp. Use real component properties and instances, honest Auto Layout behavior, semantic layer names and source-linked guidance. Prove content edits, master inheritance and stated resize widths on reversible clones. Do not infer all-width responsiveness from Auto Layout presence.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

Acceptance: native sets/properties/instances, shared styles and spatial variable use checked independently against live API; meaningful negative regression fixtures; existing screen text/route/color/component identity checks; content/resize probes and clipping/font scan; exported desktop/mobile/library/handoff inspection. New system application must be rerunnable and hooked into fresh import/update, with prior proof invalidated before mutation. No app source, billing, sharing, video or external transaction changes.
