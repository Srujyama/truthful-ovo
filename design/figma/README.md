# Truthful · Figma product design

The kit contains 17 screen reconstructions (14 desktop and 3 mobile), 7 product-story boards, 12 component masters organized into two variant sets and 13 named color definitions. Text and surfaces are scene data, not screenshots. The separate selected-case authority handoff is explicitly labeled as a concept.

Open [the local visual review](generated/preview.html), [the product specification](../../docs/FIGMA_PRODUCT_SPEC.md), or [the screen map](../../docs/FIGMA_SCREEN_MAP.json). The HTML review offers linked states and keyboard navigation; it executes no financial commands. Six alternate working-app behaviors are annotations rather than phantom prototype controls. Cutoff and repair are separately authored review states.

## Applied design philosophy

The user pinned Apple or Ramp as the design philosophy. The [applied principles](DESIGN_PHILOSOPHY.md) translate that into a portfolio-first entry, compact record rows, an outstanding-balance-first hierarchy, concise language and detail revealed at its relevant stage. This interpretation preserves Truthful’s existing visual identity and financial boundaries.

## Current native status

The working-ledger redesign replaces the sage-tinted interface with graphite text, neutral paper surfaces, a restrained forest action color and Public Sans. Functional page names, visible programs and concise empty states replace the earlier promotional hierarchy.

The completed [native Figma file](https://www.figma.com/design/8j4pwtsGDI4seljHPNeUkI) is named **Truthful · OVO · Product design**. It contains the 17 editable screens, 7 boards, 12 native component masters, 13 color variables, shared text styles and 24 review-note overlays and one mobile navigation overlay across Read me, Product flow, Design system and Handoff. The [native record](native-record.json) identifies reviewed nodes and the saved cloud version. Account access now permits the CLI bridge; no billing change was made.

The CLI is installed separately at the shared toolkit’s `figma-cli/` directory: `figma-ds-cli` 2.2.5, source commit `0ff87728992533b0a6c93a5fb7614c3cbc69c237`. Its documented plugin mode avoids patching the Figma app. Browser mode reached the file but lacked the Plugin API in this Figma browser build; it was not used to claim native creation. The official Apple Silicon desktop app was downloaded from Figma’s own distribution and installed.

## Native editing system

The [native system guide](DESIGN.md) documents the shipped architecture. Button exposes Style, State and editable Label; Status exposes State with wording that follows the selected fact. The file contains 82 linked instances: 79 scene controls and three Handoff examples. Compatible screen controls and close controls inherit their main component. Twenty-two active shared Public Sans text styles (24 local styles retained) and 11 `Truthful · Layout` spacing/radius variables govern repeated values. The Handoff page includes editable instructions, implementation boundaries and three working component-property examples. Exact IDs and clone-probe evidence are in [native-system.json](native-system.json).

The native postprocessor runs on both fresh import and update. It preserves original screen and master IDs on update, repairs interrupted owned migrations, invalidates previous proof before changes and rejects failed editing/resize probes. After review, `npm run design:verify-system` independently checks current native types, property bindings, instance ancestry, typography coverage, per-screen variable use, clipping and Handoff presence. `npm run design:check` includes negative regression fixtures that reject misleading records.

## Reproduce

Run `node scripts/build-figma-kit.mjs`, then `node scripts/verify-figma-kit.mjs` from the repository root. Serve the root using a static server to view the HTML review. Public Sans’s bundled WOFF2 and its OFL license are in `assets/`.

To create a new file, with editor/plugin access, run the installed CLI’s `connect --safe` and open its development bridge plugin in the exact blank target file. `node scripts/push-figma-kit.mjs --file-url <exact-design-file-url> --plan` previews the import without contacting Figma. Omit `--plan` to create the named pages, color variables, native components, frames and mapped review links. `FIGMA_CLI_JS` overrides the CLI entrypoint path.

To update the already-bound file, `node scripts/update-figma-kit.mjs` stages new roots first, validates ownership and text, saves a restore version, then replaces only owned root contents while preserving screen/component IDs. Existing roots are checked against recorded IDs, types and pages. Only spec-declared new review notes may be added, and retries require their exact owner and source markers. Its owned staging page is bound to a digest of the full models and palette; incomplete staged renders are rebuilt, and live transplants clone their source so partial failure remains recoverable. It invalidates prior verification before the first live mutation, updates the existing variable collection and rewires exact navigation and overlay returns. New native exports must be reviewed again before verification status is restored.

The importer refuses an unrelated nonempty document, binds its own persistent document marker, checks that marker before each batch, and retains completed frames on retry. The native file key must match whenever the private API supplies it. An interrupted fresh-target retry must have a matching local file key and root inventory; missing or cross-file records fail before native mutation. Restore matching reviewed creation provenance before resuming. Otherwise the first import fails closed unless a separate, recent `--target-attestation <path>` confirms the operator checked the native file URL and connected document/page together. Its JSON requires `fileUrl`, `operatorVerified: true`, `method: "native-file-url-and-plugin-context"`, `documentId`, `currentPageId` and a timezone-bearing `observedAt` within30 minutes. The importer never creates that attestation or treats an empty file as identity proof; the record explicitly identifies this as trusted operator evidence rather than cryptographic proof. Review native exports before setting `native-record.json` to `verified-native`; `node scripts/verify-figma-native.mjs` then reads the actual connected document and fails if its reviewed IDs, sizes, Public Sans text layers, exact hotspot triggers/destinations, named native components or color values do not agree. Incomplete owned component conversion is repaired or rejected on retry. The local checker alone never establishes native persistence.

## Validation

All 17 screen IDs and 12 master IDs remain stable. The current native file has 710 editable screen text layers, 53 mapped review interactions and 25 CLOSE returns; all original 47 mappings are retained. Every screen uses linked components and shared typography. The live system gate independently counts 2,515 spatial variable bindings on screens. The complete recorded inventory anchors 61 original or explicitly owned roots; same-name foreign roots, replaced IDs and cross-file retries are rejected before mutation.

The exact editing probes pass for Button Label, inherited master treatment, migrated-instance Style/State changes, long-label sizing at 164px, portfolio at 1280px and mobile approval at 430px. Geometry and font inspection covers 57 owned roots with zero clipped text or missing fonts. All 73 scene Buttons inherit their main component’s text fill, font and background. These are bounded checks, not arbitrary-width responsive certification.

Independent review inspected 11 app states and 12 current native exports, including the selected financial record, exact source-revision note, role explanations, mobile, library and Handoff. The [scoped finish verdict](SYSTEM_FINISH_REVIEW.md) is ship. [The review record](system-review.json) records artifact hashes for that milestone. The current cloud version is **2416032624820026877**, “Truthful · Editor label spacing · verified”.

`npm run design:check` passes 57 offline regressions. Both native API gates pass against the actual file. The [app journey matrix](../../docs/UI_JOURNEY_REVIEW.md) separates real browser workflows from authored Figma review navigation. No new manual prototype-player playback is claimed. Primary Hover retains the documented root-system forest-hover literal; automatic hover reactions are not asserted.

Sources: [CLI source and modes](https://github.com/silships/figma-cli), [official Figma downloads](https://www.figma.com/downloads/), [official Plugin API types](https://github.com/figma/plugin-typings). All amounts, counterparties, inputs and financial effects are synthetic. No video is part of this task.

The user’s editor screenshot exposed a gap in the export-only library review: native purple component-set labels collided with authored captions. The library now flows from measured guide/heading heights and reserves 96 units above each set. Actual Figma editor-window captures at 50%, 70% and each family at 100% were inspected independently; both headings and native labels are separate. The generator resolves owned captions by recorded IDs; live checks reject lost clearance. The prior library PNG is explicitly superseded in the review record.
