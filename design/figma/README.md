# Truthful · Figma product design

The kit contains 17 screen reconstructions (14 desktop and 3 mobile), 7 product-story boards, 12 reusable component specimens and 13 named color definitions. Text and surfaces are scene data, not screenshots. The separate selected-case authority handoff is explicitly labeled as a concept.

Open [the local visual review](generated/preview.html), [the product specification](../../docs/FIGMA_PRODUCT_SPEC.md), or [the screen map](../../docs/FIGMA_SCREEN_MAP.json). The HTML review offers linked states and keyboard navigation; it executes no financial commands. Six alternate working-app behaviors are annotations rather than phantom prototype controls. Cutoff and repair are separately authored review states.

## Current native status

A blank target was created at https://www.figma.com/design/8j4pwtsGDI4seljHPNeUkI/Untitled. This is a target, not a completed design deliverable. Native import is blocked by the account message “Get a Full seat to manage plugins and widgets.” No paid seat or subscription has been purchased. Signing in alone does not supply that entitlement.

The CLI is installed separately at the shared toolkit’s `figma-cli/` directory: `figma-ds-cli` 2.2.5, source commit `0ff87728992533b0a6c93a5fb7614c3cbc69c237`. Its documented plugin mode avoids patching the Figma app. Browser mode reached the file but lacked the Plugin API in this Figma browser build; it was not used to claim native creation. The official Apple Silicon desktop app was downloaded from Figma’s own distribution and installed.

## Reproduce

Run `node scripts/build-figma-kit.mjs`, then `node scripts/verify-figma-kit.mjs` from the repository root. Serve the root using a static server to view the HTML review. Manrope’s bundled WOFF2 and its OFL license are in `assets/`.

Once Full-seat/editor access is available, run the installed CLI’s `connect --safe` and open its development bridge plugin in the exact blank target file. `node scripts/push-figma-kit.mjs --file-url <exact-design-file-url> --plan` previews the import without contacting Figma. Omit `--plan` to create the named pages, color variables, native components, frames and mapped review links. `FIGMA_CLI_JS` overrides the CLI entrypoint path.

The importer refuses an unrelated nonempty document, binds its own persistent document marker, checks that marker before each batch, and retains completed frames on retry. The native file key must match whenever the private API supplies it. Otherwise the first import fails closed unless a separate, recent `--target-attestation <path>` confirms the operator checked the native file URL and connected document/page together. Its JSON requires `fileUrl`, `operatorVerified: true`, `method: "native-file-url-and-plugin-context"`, `documentId`, `currentPageId` and a timezone-bearing `observedAt` within30 minutes. The importer never creates that attestation or treats an empty file as identity proof; the record explicitly identifies this as trusted operator evidence rather than cryptographic proof. Review native exports before setting `native-record.json` to `verified-native`; `node scripts/verify-figma-native.mjs` then reads the actual connected document and fails if its reviewed IDs, sizes, Manrope text layers, exact hotspot triggers/destinations, named native components or color values do not agree. Incomplete owned component conversion is repaired or rejected on retry. The local checker alone never establishes native persistence.

## Validation

All 17 models match the screen-map IDs and dimensions; 680 editable screen text definitions are Manrope at 12px or larger. All 41 declared hotspots map to rendered controls, including 21 cross-frame navigation links. Local browser checks found no clipped text in any screen or board. Independent review shipped the four inspected desktop/mobile and introductory previews at that preview scope. Native screenshots, live component persistence and Figma prototype playback remain gated by seat access.

The mechanical detector reported a low-contrast disabled component specimen, which was repaired, 17 flush-canvas wrappers (intentional frame boundaries), and system-ramp/copy advisories. DESIGN.md remains authoritative; new documentation board sizes are local presentation hierarchy, not a replacement app type system.

Sources: [CLI source and modes](https://github.com/silships/figma-cli), [official Figma downloads](https://www.figma.com/downloads/), [official Plugin API types](https://github.com/figma/plugin-typings). All amounts, counterparties, inputs and financial effects are synthetic. No video is part of this task.
