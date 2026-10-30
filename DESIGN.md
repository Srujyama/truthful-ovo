---
name: Truthful
description: A working ledger for inspectable financial evidence and commands.
colors:
  forest: "#176448"
  forest-hover: "#12513a"
  ink: "#20252b"
  muted: "#626b75"
  canvas: "#f7f8fa"
  paper: "#ffffff"
  rule: "#e3e7eb"
  control-rule: "#d5dbe0"
  selected: "#edf5f0"
  negative: "#b23d37"
  negative-fill: "#fcf0ef"
  warning: "#8a5b17"
  warning-fill: "#fff5e4"
typography:
  headline:
    fontFamily: "Public Sans Variable, Public Sans, sans-serif"
    fontSize: "27px"
    fontWeight: 650
    lineHeight: 1.3
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Public Sans Variable, Public Sans, sans-serif"
    fontSize: "17px"
    fontWeight: 600
  body:
    fontFamily: "Public Sans Variable, Public Sans, sans-serif"
    fontSize: "13px"
  annotation:
    fontFamily: "Public Sans Variable, Public Sans, sans-serif"
    fontSize: "12px"
    lineHeight: 1.7
  summary-amount:
    fontFamily: "Public Sans Variable, Public Sans, sans-serif"
    fontSize: "30px"
    fontWeight: 550
    letterSpacing: "-0.03em"
  portfolio-total:
    fontFamily: "Public Sans Variable, Public Sans, sans-serif"
    fontSize: "23px"
  recovery-amount:
    fontFamily: "Public Sans Variable, Public Sans, sans-serif"
    fontSize: "43px"
    fontWeight: 550
    letterSpacing: "-0.035em"
  code:
    fontFamily: "ui-monospace, SFMono-Regular, monospace"
    fontSize: "12px"
    lineHeight: 1.9
rounded:
  tag: "4px"
  field: "5px"
  control: "6px"
  detail: "8px"
  panel: "9px"
spacing:
  tight: "8px"
  small: "12px"
  medium: "16px"
  panel: "20px"
  section: "24px"
  workspace: "36px"
components:
  button-primary:
    backgroundColor: "{colors.forest}"
    textColor: "{colors.paper}"
    rounded: "{rounded.control}"
    padding: "9px 13px"
  button-primary-hover:
    backgroundColor: "{colors.forest-hover}"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "9px 13px"
  button-text:
    textColor: "{colors.forest}"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
  navigation-selected:
    backgroundColor: "{colors.selected}"
    textColor: "{colors.forest}"
    rounded: "{rounded.field}"
    padding: "10px 12px"
  warning-status:
    backgroundColor: "{colors.warning-fill}"
    textColor: "{colors.warning}"
    rounded: "{rounded.tag}"
    padding: "5px 7px"
  panel:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.panel}"
---

# Design System: Truthful

## Overview

**Creative North Star: "The working ledger"**

A working ledger for inspecting financial evidence and exact commands. Neutral white navigation and graphite typography frame quiet paper surfaces; fine rules carry structure while forest marks actions and selected context. The interface is compact and operational, with readable annotations and explicit financial states.

Public Sans supplies a single interface voice. Ordered steps, source records, financial amounts, and selected detail share the same visual grammar across execution, authority, assurance, evidence, and guided cases. Imagery is absent; Lucide line icons support labels.

The user-selected philosophy draws on [Apple’s design foundations](https://developer.apple.com/videos/play/wwdc2025/359/) for clear structure, location, and next actions, and [Ramp’s approach to financial software](https://ramp.com/blog/midday-joining-ramp) for reducing the work around a financial task. Truthful applies these principles through finance-first navigation, compact records, and progressive disclosure. This is an application of those principles, with Truthful’s own visual identity; it implies no affiliation or copied brand interface.

**Key Characteristics:**
- Neutral white shell and fine rule separation.
- Compact controls with explicit named states.
- Tabular financial amounts and adjacent evidence.
- Ordered programs that become selectable execution traces.

## Colors

The palette is neutral and restrained, with forest actions and named amber/red conditions. Frontmatter records the reused shared theme; it does not catalog every older local declaration.

### Primary
- **Forest:** primary commands, text actions, active navigation, and keyboard focus.
- **Selected wash:** selected records and supporting evidence context.

### Secondary
- **Warning ink and fill:** pending conditions, bounded-search uncertainty, and unresolved decisions.
- **Negative ink and fill:** unsafe effects, blocked authority, and errors.

### Neutral
- **Ink and muted:** primary content and supporting annotations.
- **Canvas and paper:** workspace surround and working surfaces; navigation remains paper white.
- **Rule and control rule:** panel separators and field boundaries.

**The State Has a Name Rule.** Pair semantic color with a readable status or verdict; color alone does not establish approval or application.

## Typography

**Display / Body Font:** Public Sans Variable, Public Sans, sans-serif. There is no separate decorative display face.
**Code Font:** ui-monospace, SFMono-Regular, monospace for editable program and command JSON.

The interface combines a compact reading scale with larger tabular amounts. Headings use restrained negative tracking; annotations use normal letter spacing and sentence case.

### Hierarchy
- **Headline:** functional page title; the frontmatter desktop role becomes 24px at the mobile breakpoint. The finance portfolio heading uses weight 600.
- **Title:** trace inspector and result headings; smaller working-panel headings use 13–16px according to hierarchy.
- **Body:** prose, evidence, and document content; source text uses a generous 1.9 line height.
- **Annotation:** controls, statuses, source references, timestamps, and program steps.
- **Summary amount:** guided summary figures use 30px desktop and 28px mobile.
- **Portfolio total:** the compact assurance overview uses 23px at desktop and mobile widths. Register amounts use 14px semibold tabular numerals beside 13px semibold vendor names and 12px references, statuses, and deadlines.
- **Recovery amount:** evidence result figure; it becomes 39px on mobile. Guided case amounts use 39px desktop and 35px mobile; assurance case amounts use 35px.

**The Readable Record Rule.** Use the implemented 12px annotation role for decision-critical labels, provenance, and controls; inherited smaller text is not a future scale.

## Layout

The desktop shell uses a fixed navigation rail (216px) and utility header (56px). Working containers cap at 1512px and use 32px vertical / 36px horizontal padding. At 1300px the horizontal gutter becomes 26px. White working panels use roughly 20–24px padding and fine internal dividers.

Guided cases pair a 275px register with flexible case detail and a 23px gap. Evidence pairs near-equal input and result columns with a 24px gap. Assurance pairs a compact register with a wider detail surface. Above 1100px, its columns use `minmax(250px,280px) minmax(0,1fr)` with a 20px gap. Register rows use 12px vertical / 18px horizontal padding and an 8px / 10px row / column gap. Vendor and reference occupy the first column beside a right-aligned amount; named status and deadline occupy the second row. Row height follows content rather than a fixed height. Execution uses ordered agent lanes and a separate trace list / inspector; these are relational working surfaces rather than isolated metric tiles.

At 1100px evidence and assurance master-detail layouts stack. Between 761px and 950px the rail narrows to 184px. At 760px the rail becomes a toggleable overlay, gutters become 16px, header height becomes 54px, controls and agent lanes stack, and the trace becomes a single column. Guided cases reserve bottom space for a fixed action dock. Tabs retain horizontal scrolling when necessary. On mobile, portfolio and guided registers use a native selected-case picker in place of long record lists. Portfolio options include vendor, commitment reference, and amount, while the selected case exposes its name, reference, named status, and money together.

Portfolio overview contains totals only: open on desktop and initially collapsed on mobile. Workspace options is initially closed at every width and holds administration, runtime details, and demo role selection. The current commitment remains the principal mobile content. Its amount precedes the original-claim next action, which precedes the financial ledger; the generic page-description paragraph is hidden on mobile. Historical date controls and the signed-packet verifier are separate disclosures. When a historical view is active, its read-only notice remains outside the collapsed date controls. If a responsive collapse would hide the focused control, focus returns to its disclosure summary.

## Elevation & Depth

Working panels are flat, separated by rules, canvas contrast, selected fills, and occasional semantic inset marks. Floating menus, toast messages, evidence drawers, and mobile navigation retain ambient shadows. These do not define a general card elevation scale.

### Shadow Vocabulary
- **Mobile navigation:** `12px 0 40px #1c2c3426` separates the temporary navigation overlay.
- **Evidence drawer:** `-15px 0 70px #172b2420` separates the floating source document.
- **Workspace options:** `0 10px 40px #20252b26` separates the temporary administration popup.

**The Flat Working Surface Rule.** Use rules, white surfaces, and selected fills for working hierarchy; reserve ambient shadows for floating overlays.

## Shapes

Small practical corners distinguish status marks, fields, commands, and work surfaces. Tags use the tag radius, fields and navigation use the field radius, and primary controls use the control radius. Primary working panels use the panel radius; assurance and trace detail use the detail radius. Internal rows and column dividers remain straight. Lucide line icons use a shared 1.65 stroke width; the brand check has a heavier stroke.

## Components

### Buttons
Compact, explicit commands. Primary buttons use forest on white text; secondary buttons use paper, ink, and a control-rule border. Both use the frontmatter padding and a minimum height of 38px. Primary hover deepens forest; secondary hover uses a neutral wash. Text actions use forest with underlined hover. Disabled controls use opaque neutral fills and readable muted text. Keyboard focus uses a forest outline (2px) offset by 3px.

Button color transitions last 160ms with ease timing. Pressed buttons darken slightly. Reduced-motion preferences disable animations and transitions across the app.

### Chips
Named statuses use compact rounded fills and readable text. Warning and negative treatments use shared semantic tokens. Some verified and scheduled chips retain inherited local greens; their precise hues are not reusable shared primitives.

### Cards / Containers
Paper panels use fine rule borders, practical corners, and flat depth. Panel headers and internal rows separate content through rules. Typical padding is 20–24px; smaller mobile panels use 16–20px.

### Inputs / Fields
White fields use the control-rule border, small corners, and ink text. Common minimum heights are 38–39px. Placeholders remain muted and opaque. Document textareas use 13px text with 1.9 line height; structured command editors retain the code role. All controls inherit visible keyboard focus.

### Navigation
The default destination is the finance portfolio. Assurance, Evidence lab, and Execution lab lead the navigation; guided cases, activity, and sources follow as supporting destinations. Explicit view links retain direct access to each surface. White fixed rail; small labeled line icons and 12px text. The selected item uses forest text over the selected wash; hover uses a neutral wash. Underlined tabs use graphite for the selected label and underline. The static Acme Labs account identity is labeled as a fictional workspace. Guided cases, activity, and sources are grouped under Guided demo; the Alex Lee profile is labeled as a demo finance lead. Mobile navigation opens as a dialog with a backdrop and close control, traps Tab focus, closes with Escape or backdrop selection, makes the main content inert, locks body scrolling, and restores focus to the navigation toggle when closed.

### Disclosures and Mobile Record Selection
Supporting controls appear at the point of need. Disclosure summaries have a full-width labeled row, a fine boundary rule, and a directional chevron; history and mobile overview summaries use a minimum height of 44px. The packet-verifier summary uses 56px. Mobile portfolio and guided-record selectors use a white field with a fine rule, field-radius corners, and a minimum height of 42px. The decision room uses a native Selected action picker with a minimum height of 44px in place of desktop decision rows; options identify vendor, reference, action, and named state. A closed overview leaves the selected financial record directly reachable.

Workspace options uses native `details` / `summary` with a 38px trigger, a 376px-wide popup, 20px padding, and the detail radius. On mobile the trigger is 40px square and the popup is fixed 16px from both sides at 110px from the top, with viewport-bounded vertical scrolling. Escape and outside pointer selection close it; focus returns to its summary on Escape or when closure would hide the focused element. Reset closes the popup and reveals a separate confirmation, focusing Confirm reset.

Alternative terms stay in their own disclosure, initially closed except when reviewing a conflicting amendment acceptance. Its summary is at least 44px high. Opening a proposal does not accept it; original terms remain in force.

### Financial Next Actions and Evidence
The selected portfolio commitment leads to its original-claim review, including prepared, approved, stale, and recorded states. Changed terms remain a separate review. Mobile next-action buttons fill the available width and have a minimum height of 44px. Disabled mutations retain a visible explanation of the role, policy, historical-view, or pending-state restriction.

Decision evidence lists the exact bound source revisions, including revisions outside the selected commitment. Inspection opens the selected revision beside the review; Return to this action review restores focus to its source opener. An explicit latest-revision link does not silently substitute evidence. The evidence workbench shows analysis, claim-review availability, and portfolio-import availability separately, with the reason and next step beside each operation. Local draft approval, portfolio approval, credit application, and unsent exports retain distinct meanings.

### Toasts
Status feedback is noninteractive and does not intercept pointers. Desktop toasts sit at the bottom right, 24px from both edges with a maximum width of 480px. Mobile toasts use 16px side and bottom insets. When the guided action dock is present, bottom offsets become 98px desktop and 86px mobile.

### Program and Trace
An ordered program uses rule-separated agent lanes, numbered square step marks, named operations, and supporting identifiers. Execution yields a selectable trace list beside a financial inspector. Selected rows use context fill; unsafe selections use negative fill. This shared list/detail grammar also appears in assurance and guided cases.

## Do's and Don'ts

### Do:
- **Do** use the shared Public Sans interface family and tabular numerals for financial values.
- **Do** keep evidence, named status, and the selected financial effect inspectable together.
- **Do** preserve mobile stacking, readable annotations, and visible keyboard focus.
- **Do** keep portfolio totals separate from workspace administration and place the selected commitment’s original next action before its financial ledger on mobile.
- **Do** name blocked operations, retain exact evidence revisions, and provide a focused return to the action review.

### Don't:
- **Don't** reintroduce the rejected sage navigation identity.
- **Don't** communicate approval, failure, or application through color alone.
- **Don't** promote inherited tiny labels or one-off legacy colors into new system tokens.

Not canonized: overridden Manrope/sage declarations, remaining one-off semantic greens, local type-size variations, any inherited labels below the readable annotation role, and the guided-register search glyph are implementation debt, not new rules. This record describes the React artifact; it does not certify native Figma completion.
