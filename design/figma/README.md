# Truthful · Figma product design

The kit contains 17 screen reconstructions (14 desktop and 3 mobile), 7 product-story boards, 12 component masters organized into two variant sets and 13 named color definitions. Text and surfaces are scene data, not screenshots. The separate selected-case authority handoff is explicitly labeled as a concept.

Open [the local visual review](generated/preview.html), [the product specification](../../docs/FIGMA_PRODUCT_SPEC.md), or [the screen map](../../docs/FIGMA_SCREEN_MAP.json). The HTML review offers linked states and keyboard navigation; it executes no financial commands. Six alternate working-app behaviors are annotations rather than phantom prototype controls. Cutoff and repair are separately authored review states.

## Applied design philosophy

The user pinned Apple or Ramp as the design philosophy. The [applied principles](DESIGN_PHILOSOPHY.md) translate that into a portfolio-first entry, compact record rows, an outstanding-balance-first hierarchy, concise language and detail revealed at its relevant stage. This interpretation preserves Truthful’s existing visual identity and financial boundaries.

## Current native status

The working-ledger redesign replaces the sage-tinted interface with graphite text, neutral paper surfaces, a restrained forest action color and Public Sans. Functional page names, visible programs and concise empty states replace the earlier promotional hierarchy.

The completed [native Figma file](https://www.figma.com/design/8j4pwtsGDI4seljHPNeUkI) is named **Truthful · OVO · Product design**. It contains the 17 editable screens, 7 boards, 12 native component masters, 13 color variables, shared text styles and 20 review-note overlays and one mobile navigation overlay across Read me, Product flow, Design system and Handoff. The [native record](native-record.json) identifies reviewed nodes and the saved cloud version. Account access now permits the CLI bridge; no billing change was made.

The CLI is installed separately at the shared toolkit’s `figma-cli/` directory: `figma-ds-cli` 2.2.5, source commit `0ff87728992533b0a6c93a5fb7614c3cbc69c237`. Its documented plugin mode avoids patching the Figma app. Browser mode reached the file but lacked the Plugin API in this Figma browser build; it was not used to claim native creation. The official Apple Silicon desktop app was downloaded from Figma’s own distribution and installed.

## Native editing system

The [native system guide](DESIGN.md) documents the shipped architecture. Button exposes Style, State and editable Label; Status exposes State with wording that follows the selected fact. The file contains 74 linked instances: 71 scene controls and three Handoff examples. Compatible screen controls and close controls inherit their main component. Twenty-four shared Public Sans text styles and 11 `Truthful · Layout` spacing/radius variables govern repeated values. The Handoff page includes editable instructions, implementation boundaries and three working component-property examples. Exact IDs and clone-probe evidence are in [native-system.json](native-system.json).

The native postprocessor runs on both fresh import and update. It preserves original screen and master IDs on update, repairs interrupted owned migrations, invalidates previous proof before changes and rejects failed editing/resize probes. After review, `npm run design:verify-system` independently checks current native types, property bindings, instance ancestry, typography coverage, per-screen variable use, clipping and Handoff presence. `npm run design:check` includes negative regression fixtures that reject misleading records.

## Reproduce

Run `node scripts/build-figma-kit.mjs`, then `node scripts/verify-figma-kit.mjs` from the repository root. Serve the root using a static server to view the HTML review. Public Sans’s bundled WOFF2 and its OFL license are in `assets/`.

To create a new file, with editor/plugin access, run the installed CLI’s `connect --safe` and open its development bridge plugin in the exact blank target file. `node scripts/push-figma-kit.mjs --file-url <exact-design-file-url> --plan` previews the import without contacting Figma. Omit `--plan` to create the named pages, color variables, native components, frames and mapped review links. `FIGMA_CLI_JS` overrides the CLI entrypoint path.

To update the already-bound file, `node scripts/update-figma-kit.mjs` stages new roots first, validates ownership and text, saves a restore version, then replaces only owned root contents while preserving screen/component IDs. Its owned staging page is bound to a digest of the full models and palette; incomplete staged renders are rebuilt, and live transplants clone their source so partial failure remains recoverable. It invalidates prior verification before the first live mutation, updates the existing variable collection and rewires exact navigation and overlay returns. New native exports must be reviewed again before verification status is restored.

The importer refuses an unrelated nonempty document, binds its own persistent document marker, checks that marker before each batch, and retains completed frames on retry. The native file key must match whenever the private API supplies it. Otherwise the first import fails closed unless a separate, recent `--target-attestation <path>` confirms the operator checked the native file URL and connected document/page together. Its JSON requires `fileUrl`, `operatorVerified: true`, `method: "native-file-url-and-plugin-context"`, `documentId`, `currentPageId` and a timezone-bearing `observedAt` within30 minutes. The importer never creates that attestation or treats an empty file as identity proof; the record explicitly identifies this as trusted operator evidence rather than cryptographic proof. Review native exports before setting `native-record.json` to `verified-native`; `node scripts/verify-figma-native.mjs` then reads the actual connected document and fails if its reviewed IDs, sizes, Public Sans text layers, exact hotspot triggers/destinations, named native components or color values do not agree. Incomplete owned component conversion is repaired or rejected on retry. The local checker alone never establishes native persistence.

## Validation

All 17 models match the screen-map IDs and dimensions; 653 editable screen text definitions are Public Sans at 12px or larger. The native gates preserve the original 17 screen IDs and 12 master IDs, 47 mapped review interactions, 21 CLOSE returns, 13 semantic color values and the portfolio-first prototype entry. All 17 screens use linked components and shared typography. The independent live system gate counts 2,347 spatial variable bindings on screens; library-only or unrelated bindings cannot satisfy that coverage.

The full updater was exercised from generated source, with a fresh rebuild resize defect repaired before acceptance. Native clone probes pass for editable labels, master propagation, actual migrated-instance variant changes, a 164px long-label button, portfolio at 1280px and mobile approval at 430px. Actual geometry/font inspection covers 53 owned roots, with zero clipped text or missing fonts. All 65 migrated Buttons match their masters in text fill, font and background. These checks do not assert arbitrary-width responsiveness.

Eight native exports were inspected: portfolio, approval, race cutoff, mobile approval, component library, property examples and both Handoff instruction frames. Independent finish review requested two fixes—visible Hover differentiation and removal of repeated Handoff eyebrows—and confirmed both resolved in the three affected recaptures. The [review record](system-review.json) includes exact artifact hashes and scope; [source review](SYSTEM_REVIEW.md) and [finish verdict](SYSTEM_FINISH_REVIEW.md) distinguish the evidence. The named cloud version is **2416005136496065741**, “Truthful · Native system · verified”.

`npm run design:check` passes 38 offline regression checks; `npm run design:verify-native` and `npm run design:verify-system` pass against the actual connected file. No new manual prototype-player playback is claimed; API-verified reactions are separate evidence. Primary Hover uses the root system’s forest-hover literal; Secondary Hover uses the existing selected variable. The one color exception is explicit in the system manifest, and automatic hover reactions are not asserted.

Sources: [CLI source and modes](https://github.com/silships/figma-cli), [official Figma downloads](https://www.figma.com/downloads/), [official Plugin API types](https://github.com/figma/plugin-typings). All amounts, counterparties, inputs and financial effects are synthetic. No video is part of this task.
