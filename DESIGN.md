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
- **Summary amount:** guided summary figures; assurance totals use 28px, and 25px on mobile.
- **Recovery amount:** evidence result figure; it becomes 39px on mobile. Guided case amounts use 39px desktop and 35px mobile; assurance case amounts use 35px.

**The Readable Record Rule.** Use the implemented 12px annotation role for decision-critical labels, provenance, and controls; inherited smaller text is not a future scale.

## Layout

The desktop shell uses a fixed navigation rail (216px) and utility header (56px). Working containers cap at 1512px and use 32px vertical / 36px horizontal padding. At 1300px the horizontal gutter becomes 26px. White working panels use roughly 20–24px padding and fine internal dividers.

Guided cases pair a 275px register with flexible case detail and a 23px gap. Evidence pairs near-equal input and result columns with a 24px gap. Assurance pairs a compact register with a wider detail surface; desktop rows use 16px vertical / 18px horizontal padding. Above 1100px its columns use a .62fr / 1.7fr relationship with a minimum 250px register. Execution uses ordered agent lanes and a separate trace list / inspector; these are relational working surfaces rather than isolated metric tiles.

At 1100px evidence and assurance master-detail layouts stack. Between 761px and 950px the rail narrows to 184px. At 760px the rail becomes a toggleable overlay, gutters become 16px, header height becomes 54px, controls and agent lanes stack, and the trace becomes a single column. Guided cases reserve bottom space for a fixed action dock. Tabs retain horizontal scrolling when necessary. On mobile, portfolio and guided registers use a native selected-case picker in place of long record lists. Portfolio options include vendor, commitment reference, and amount, while the selected case exposes its name, reference, named status, and money together.

Portfolio overview, workspace actions, role selection, and totals are open on desktop and initially collapsed on mobile. The current commitment remains the principal mobile content. Historical date controls and the signed-packet verifier are separate disclosures. When a historical view is active, its read-only notice remains outside the collapsed date controls. If a responsive collapse would hide the focused control, focus returns to its disclosure summary.

## Elevation & Depth

Working panels are flat, separated by rules, canvas contrast, selected fills, and occasional semantic inset marks. Floating menus, toast messages, evidence drawers, and mobile navigation retain ambient shadows. These do not define a general card elevation scale.

### Shadow Vocabulary
- **Mobile navigation:** `12px 0 40px #1c2c3426` separates the temporary navigation overlay.
- **Evidence drawer:** `-15px 0 70px #172b2420` separates the floating source document.

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
The default destination is the finance portfolio. Assurance, Evidence lab, and Execution lab lead the navigation; guided cases, activity, and sources follow as supporting destinations. Explicit view links retain direct access to each surface. White fixed rail; small labeled line icons and 12px text. The selected item uses forest text over the selected wash; hover uses a neutral wash. Underlined tabs use graphite for the selected label and underline. Mobile navigation opens as an overlay.

### Disclosures and Mobile Record Selection
Supporting controls appear at the point of need. Disclosure summaries have a full-width labeled row, a fine boundary rule, and a directional chevron; history and mobile overview summaries use a minimum height of 44px. The packet-verifier summary uses 56px. Mobile record selectors use a white field with a fine rule, field-radius corners, and a minimum height of 42px. A closed overview must leave the selected financial record directly reachable.

### Program and Trace
An ordered program uses rule-separated agent lanes, numbered square step marks, named operations, and supporting identifiers. Execution yields a selectable trace list beside a financial inspector. Selected rows use context fill; unsafe selections use negative fill. This shared list/detail grammar also appears in assurance and guided cases.

## Do's and Don'ts

### Do:
- **Do** use the shared Public Sans interface family and tabular numerals for financial values.
- **Do** keep evidence, named status, and the selected financial effect inspectable together.
- **Do** preserve mobile stacking, readable annotations, and visible keyboard focus.

### Don't:
- **Don't** reintroduce the rejected sage navigation identity.
- **Don't** communicate approval, failure, or application through color alone.
- **Don't** promote inherited tiny labels or one-off legacy colors into new system tokens.

Not canonized: overridden Manrope/sage declarations, remaining one-off semantic greens, local type-size variations, and any inherited labels below the readable annotation role are implementation debt, not new rules. This record describes the React artifact; it does not certify native Figma completion.
