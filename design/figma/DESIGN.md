---
name: Truthful native Figma system
description: An editable component system for the Truthful working ledger.
colors:
  forest: "#176448"
  ink: "#20252b"
  canvas: "#f7f8fa"
  paper: "#ffffff"
  sage-rail: "#f7f8fa"
  selected: "#edf5f0"
  panel-rule: "#e3e7eb"
  verified: "#176448"
  condition-ink: "#8a5b17"
  condition-fill: "#fff5e4"
  assurance-muted: "#626b75"
  assurance-negative: "#b23d37"
  assurance-negative-fill: "#fcf0ef"
typography:
  control:
    fontFamily: "Public Sans"
    fontSize: "12px"
    fontWeight: 600
  state:
    fontFamily: "Public Sans"
    fontSize: "12px"
    fontWeight: 500
rounded:
  state: "4px"
  control: "6px"
  detail: "10px"
spacing:
  zero: "0px"
  micro: "4px"
  tight: "8px"
  small: "12px"
  medium: "16px"
  panel: "20px"
  section: "24px"
  wide: "32px"
---

# Design System: Truthful native Figma

## Overview

**Creative North Star: "The working ledger"**

The native file extends the [working-ledger design system](../../DESIGN.md). Apple-inspired clarity and Ramp-inspired efficiency mean clear financial tasks, explicit states and a calm hierarchy. The file must also support careful editing: linked controls, reusable properties, shared styles and an understandable handoff.

## Colors

The frontmatter records the 13 native semantic COLOR variables in `Truthful`, preserving the root system’s palette and meanings. Native variable names differ from the web tokens: `panel-rule` is the fine separator, `condition-*` marks uncertainty, and `assurance-*` marks supporting or unsafe content. The historical `sage-rail` name resolves to neutral canvas, and `verified` shares forest; neither establishes a separate visual identity. Color supports written financial states. A green surface never establishes approval or successful execution by itself.

**The State Has a Name Rule.** Keep written financial states beside their semantic color.

## Typography

Public Sans remains the interface family. The native file retains 24 local text styles; 22 are active in the current system manifest, extracted from repeated combinations of family, weight, size, line height and tracking. Their native IDs, names, sizes, weights and usage counts are in [native-system.json](native-system.json); line height and tracking are preserved on the native text styles, not enumerated in that manifest. The frontmatter records the reusable component label roles rather than substituting the web type ramp. The recorded hierarchy spans 12–38px with Regular, Medium, SemiBold and Bold weights. Native style names group sizes below 13 as Label, 13–16 as Body, 17–23 as Title, 24–31 as Heading and 32 or larger as Display. These describe the authored Figma hierarchy; the web app’s normative CSS hierarchy remains in the root design system.

## Layout

Auto Layout preserves authored desktop and mobile compositions. Fill container is used where child widths already match the available space; text uses Hug height where content should grow. Repeated spacing and radius values bind to FLOAT variables in `Truthful · Layout`. One-off layout values remain local.

The native library flows from the measured editing-guide and caption heights: 32 units before the first caption, 96 units between each caption bottom and its component-set bounds, and 56 units after a family before the next caption. The 96-unit band reserves room for Figma’s native purple set labels. Those labels do not appear in PNG exports, so library changes also require actual editor-window inspection at the reviewed zoom levels.

Desktop screens are authored at 1440 × 960 and mobile at 390 × 844. Clone probes additionally check portfolio at 1280 wide, mobile approval at 430 wide, and a 164-wide button with a long label. These are specific checks, not a claim of arbitrary-width responsiveness across all screens.

## Elevation & Depth

Fine rules and neutral surfaces carry hierarchy. The Design system page uses a quiet canvas with a white editing guide. The component catalog and Handoff frames remain editable native layers.

## Shapes

The repeated native radius scale is listed in the frontmatter. It describes existing matching values rather than forcing every local shape onto one radius. Spatial bindings inside instances inherit from their main component.

## Components

`Truthful / Button` has six variants: Primary or Secondary, each with Default, Hover and Disabled. `Label` is an editable text property. Use properties rather than detaching a screen instance. Hover is an authored design state; automatic prototype hover behavior is not asserted. Review navigation remains attached to each screen control. Masters use the control radius, 12px semibold labels, horizontal padding (14px), vertical padding (10px), and minimum height (40px). Labels fill the available width and hug their content height. Primary uses forest and paper; Secondary uses paper, forest text and a panel-rule stroke; both Disabled variants use paper and muted text. Primary Hover deepens to the root system’s `forest-hover` color (#12513a), applied as a literal native paint; Secondary Hover uses the existing `selected` color variable. The 13 native COLOR variables remain unchanged.

`Truthful / Status` has six named states: Approved, Unsafe effect, Inconclusive, Needs approval, Consumed once and Stale approval. Its text follows State. It intentionally has no free Label property that could contradict the selected financial meaning. Status masters use the state radius, medium-weight labels, horizontal padding (12px), vertical padding (8px), and minimum height (30px). Approved and Consumed once use selected fill; Inconclusive and Needs approval use condition fill; Unsafe effect and Stale approval use negative fill.

The 12 original master IDs remain stable inside the two variant sets. Compatible screen buttons, named states and close controls use actual instances. Navigation rows and tabs retain their separate intent. Three live Button examples on Handoff let an editor try the properties. Handoff contains three frames: Start here, Review and implementation, and Component properties. The first two lead with a single headline and explain file editing and implementation meaning; the third provides linked examples.

**The Connected Control Rule.** Keep the instance linked: use Label for button wording and Style/State for authored treatment.

## Do's and Don'ts

- Change a main component for a global treatment; edit instance Label for local button wording.
- Select the actual Status state and keep its wording consistent with the underlying fact.
- Use shared typography and semantic color variables before adding local overrides.
- Review desktop, mobile, library and handoff exports after system changes.
- Keep prototype notes explicit: this Figma file executes no financial command.
- Run the native gates against the connected file. Local models and manifest counts alone do not prove native persistence.

Figma’s [component architecture guidance](https://www.figma.com/best-practices/component-architecture/) and [variant guidance](https://www.figma.com/best-practices/creating-and-organizing-variants/) inform the separation of editable content and structural states. [Auto Layout guidance](https://help.figma.com/hc/en-us/articles/5731482952599-Toggle-on-auto-layout-in-designs) informs content-driven sizing.

Not canonized: automatic hover prototype reactions and arbitrary-width responsive behavior are not demonstrated by the authored state variants or representative resize probes, so neither is recorded as an implemented capability.
