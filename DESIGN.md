---
name: Truthful
description: A calm finance workspace for tracing vendor promises to applied credits.
colors:
  forest: "#244e3b"
  ink: "#24372e"
  canvas: "#f6f7f5"
  paper: "#ffffff"
  sage-rail: "#eff2ec"
  selected: "#eff5ed"
  panel-rule: "#e0e6de"
  verified: "#287052"
  condition-ink: "#99652e"
  condition-fill: "#fbf1df"
  availability: "#a8bda0"
  outage: "#bb7254"
  assurance-muted: "#60725d"
  assurance-rule: "#dfe7d8"
  assurance-wash: "#eef3e8"
  assurance-condition: "#855b2d"
  assurance-negative: "#974c39"
  assurance-negative-fill: "#f9ede8"
  graph-link: "#657d5c"
typography:
  headline:
    fontFamily: "Manrope Variable, Manrope, sans-serif"
    fontSize: "26px"
    fontWeight: 600
    letterSpacing: "-1.1px"
  amount:
    fontFamily: "Manrope Variable, Manrope, sans-serif"
    fontSize: "35px"
    fontWeight: 550
    lineHeight: 1.1
    letterSpacing: "-1.5px"
  recovery-amount:
    fontFamily: "Manrope Variable, Manrope, sans-serif"
    fontSize: "43px"
    fontWeight: 550
    lineHeight: 1.4
    letterSpacing: "-0.035em"
  proof-label:
    fontFamily: "Manrope Variable, Manrope, sans-serif"
    fontSize: "12px"
  assurance-headline:
    fontFamily: "Manrope Variable, Manrope, sans-serif"
    fontSize: "29px"
    fontWeight: 650
    lineHeight: 1.3
    letterSpacing: "-0.035em"
  assurance-amount:
    fontFamily: "Manrope Variable, Manrope, sans-serif"
    fontSize: "37px"
    fontWeight: 550
    lineHeight: 1.5
    letterSpacing: "-0.035em"
  assurance-annotation:
    fontFamily: "Manrope Variable, Manrope, sans-serif"
    fontSize: "12px"
  title:
    fontFamily: "Manrope Variable, Manrope, sans-serif"
    fontSize: "17px"
    fontWeight: 650
    letterSpacing: "-0.5px"
  body:
    fontFamily: "Manrope Variable, Manrope, sans-serif"
    fontSize: "13px"
rounded:
  tag: "4px"
  source: "6px"
  control: "7px"
  panel: "12px"
spacing:
  tight: "8px"
  small: "12px"
  medium: "16px"
  section: "24px"
  workspace: "32px"
components:
  button-primary:
    backgroundColor: "{colors.forest}"
    textColor: "{colors.paper}"
    rounded: "{rounded.control}"
    padding: "10px 14px"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "10px 14px"
  panel:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.panel}"
  conditional-tag:
    backgroundColor: "{colors.condition-fill}"
    textColor: "{colors.condition-ink}"
    rounded: "{rounded.tag}"
    padding: "4px 7px"
---

# Design System: Truthful

## Overview

**Creative North Star: "The finance incident review desk"**

A quiet, dense work surface pairs a vendor register with an evidence-bearing case. White panels, pale sage navigation, forest actions, and fine rules keep the monetary outcome prominent without turning every section into a separate dashboard tile.

This record describes the implemented React workspace, evidence lab, and commitment-assurance extension, sampled from shared styles, workbench, case detail, and assurance source. The assurance portfolio, decision room, evidence graph, and failure lab preserve the same finance desk identity. Visible runtime labels distinguish browser-local records from the optional local SQLite service; neither mode performs a vendor transaction. The evidence lab uses local rules to reconcile imported text and invoice credits, with exact source spans beside findings. The guided cases remain prepared demo content. Neither surface establishes live AI analysis or connected services.

**Key Characteristics:**
- Tabular amounts and explicit financial states.
- Flat paper surfaces with softly rounded corners.
- Named evidence immediately beside the decision.

## Colors

The palette is mineral and botanical, with restrained semantic accents.

### Primary
- **Forest:** primary actions and decisive navigation emphasis.
- **Verified green:** amounts confirmed on an invoice.

### Secondary
- **Condition amber:** unresolved conditions and partial fulfillment.
- **Outage clay:** the affected day in the availability strip.
- **Assurance condition and negative:** amber marks pending terms or policy restrictions; red marks negative economics, stale/blocked states, and failed commands, paired with explicit text.

### Neutral
- **Paper:** case, register, source, and dialog surfaces.
- **Canvas:** the surrounding workspace.
- **Sage rail and selected wash:** navigation and selected commitment context.
- **Ink and panel rule:** primary text and structural separation.
- **Assurance muted, rule, and wash:** readable supporting annotations, fine separators, and selected rows or notices within assurance.
- **Graph link:** causal connector paths and their arrowheads on paper; the geometry supplements named record relationships.

**The State Has a Name Rule.** Pair semantic colors with readable labels; a green amount alone does not establish application.

## Typography

Manrope Variable, with Manrope and sans-serif fallbacks, supplies both headings and body copy. Amounts use tabular numerals. Desktop hierarchy uses the frontmatter headline and amount values at widths of at least 1000px; the base title is 28px and base amount is 38px. At mobile widths they become 24px and 33px. Summary figures are 28px on desktop and 26px on mobile. Case headings are 17px; vendor names are 12px and semibold.

The evidence lab uses a 28px, weight-650 heading with a 1.3 line height, becoming 25px at 1000px and below. Its recovery figure uses the recovery-amount role and becomes 40px at mobile widths. Result headings are 21px, or 20px at 1200px and below. Source text is 13px with a 1.9 line height. Critical result states, due-date references, ledger labels, citation controls, citation provenance, and reasoning text are 12px; document tabs become 11px on mobile.

Assurance uses the assurance-headline, assurance-amount, and assurance-annotation roles. The heading becomes 27px and the case amount 35px at mobile widths. Portfolio totals are 28px, 25px at 1300px and below, and 27px on mobile. Net economics uses 32px, becoming 29px on mobile. Critical statuses, deadlines, provenance, graph labels, policy reasoning, and failure results remain at least 12px across assurance breakpoints.

**The Readable Assurance Rule.** Keep assurance decision-critical annotations at 12px or larger; inherited tiny metadata is not a precedent.

The inherited guided cases and secondary lab annotations still carry 8–11px text. These are recorded as legibility debt, not a recommended label scale for future surfaces. The scan also identifies 19 distinct font sizes across the build; they are not a newly approved uniform type ramp.

**The Amount First Rule.** Give the case amount greater visual weight than its status, unit, and supporting evidence.

## Layout

The shared desktop shell has a fixed 210px rail and a contextual top bar. Guided cases retain a fixed bottom action dock; the evidence lab places its actions inside the document and finding panels. The main surface has 32px horizontal gutters and a 1600px maximum width. A 278px register sits beside a flexible case with a 22px gap; at 1400px the register becomes 290px. The summary uses three numeric columns plus an assurance column, which disappears at 1200px.

At 950px the rail narrows to 175px. At 760px it becomes a toggleable overlay, the workbench stacks, the register becomes a two-column grid, and the workspace gutters become 16px. The dock becomes 73px high with reset and primary action. Bottom content padding reserves space for the fixed controls. Evidence uses a right-side drawer up to 610px wide, capped at the viewport width.

The evidence lab has a 1580px maximum container with 34px horizontal gutters, a 24px gap, and input/result columns of `minmax(310px, .85fr)` and `minmax(420px, 1.15fr)`. At 1200px its gutters become 24px and the gap 18px. At 1000px the panels stack input before result and the container caps at 850px. At 760px gutters become 16px and panel content uses 18–19px padding. The lab has no fixed bottom dock.

Assurance has a 1590px maximum container and 32px horizontal gutters, narrowing to 24px at 1300px and 16px at 760px. Portfolio and decision views use a 22px-gap master/detail grid with `minmax(280px, .68fr)` and `minmax(0, 1.55fr)` columns. At 1100px they stack, with portfolio rows in two columns; decision rows become full-width on mobile. Four totals become two columns at 760px. The failure lab uses a scenario list beside a flexible result, stacking at 760px. Its actions remain in normal flow. Graph records occupy four columns, becoming two on mobile, where connectors are hidden and named relationships remain available.

## Elevation & Depth

Panels are flat, distinguished by white fill and fine borders. Shadows signal overlays or selection rather than general card importance. Selected register rows use a pale wash; the later stylesheet removes the older inset stripe. The evidence drawer uses `-15px 0 70px #172b2420`; menus use `0 8px 30px #223a2417`. Dialog backdrops use a translucent forest wash and 2px blur.

**The Flat Workspace Rule.** Keep resting register and case panels unshadowed; preserve overlay shadows for the temporary layer they identify.

## Shapes

Large panels use the panel radius; controls use the control radius, sources the source radius, and status tags the tag radius. Circular progress markers and small status dots describe state. Lucide SVG icons provide consistent outline imagery; the brand uses a heavier check. The interface has no raster illustration assets. The evidence lab reuses panel, source, and control radii. Its saved-case container (10px), result-state tag (5px), and audit-count badge (3px) are local variations, not additions to the shared radius scale.

## Components

### Buttons

Compact, semibold controls pair an outline icon with a direct action label. Primary buttons use forest fill and white text; secondary buttons use white fill with a fine neutral border. Hover applies brightness 0.97; background and transform transitions last 0.18s. Disabled buttons use opacity 0.45. Focus-visible outlines are 2px green with a 3px offset. The evidence-lab stylesheet also updates the shared primary fill to the frontmatter forest token; older green variations remain in navigation and status treatments.

### Chips

Small rectangular status tags pair a colored dot with a state name. Amber marks partial or conditional states, green marks eligible/submitted/verified, and blue marks issued. The text distinguishes these financial meanings.

### Cards / Containers

The register, case, and library share white surfaces, one-pixel borders, and the panel radius. Case content normally has 24px padding, with 28px horizontal padding on wide screens and 19px padding at narrower desktop widths. Source references are individually bordered, clickable rows with document type and an outward arrow.

### Inputs / Fields

Vendor search is a transparent, borderless input beside a search icon; its enclosing search row now has a visible focus-within outline. Claim drafting uses a resizable textarea with plain document-like presentation. The evidence lab adds bordered vendor/date fields and a pale, resizable document editor with the control radius. Selects and metadata inputs use the source radius. All inherit the global visible focus treatment.

### Navigation

Active rail navigation uses a sage fill and stronger forest text. Case tabs use a forest bottom rule. Segmented register filters use a white selected segment on a pale gray-green track. Mobile navigation opens from the header toggle. Evidence-lab document and result tabs use a forest underline, linked tab/panel semantics, a single tab stop, and arrow/Home/End keyboard movement. Document tabs have 40px minimum height; result tabs have 42px minimum height.

### Availability and evidence

Thirty rounded bars represent the billing period. A single clay-colored bar identifies the outage day; adjacent text states the downtime and period. Evidence opens in a paper-like drawer with the relevant clause highlighted, source facts, and a close control. The horizontal progress sequence separates promise, claim, issue, and verification.

The evidence-matching scan uses a two-second linear moving line. Reduced-motion preferences disable animations and transitions. This motion represents a prepared scenario replay, not live source ingestion.

### Evidence workbench

The input and finding panels extend the same flat paper treatment. The finding heading precedes vendor context, then the recovery amount and a three-column promised/applied/open ledger. Unknown unsupported values display an em dash, rather than a calculated zero. Named status tags remain beside headings. Conditional terms use an amber inline notice.

Reasoning rows pair a state icon, readable explanation, and named source citations. Citation controls use 12px text and a minimum 32px height; an opened source shows the exact passage and character range in a pale sage inset. The result footer contains local approval state and export controls, with 40px minimum button heights. These affordances describe local evidence review, not authenticated source provenance.

A new result enters over 0.35s with a 4px rise and slight blur; a loading spinner uses a 0.8s linear loop. Reduced-motion preferences disable both. These are feedback for local processing, separate from the guided-case replay scan.

### Commitment assurance

Portfolio rows combine vendor/reference, named state, outstanding amount, and deadline. The selected paper case keeps original promise, verified application, and issued value separate. Evidence, shared ledger, and history use underline navigation; effective-date and knowledge-cutoff controls sit above the case. Historical read-only state is stated in a sage notice.

The decision room places contingent credit, incremental renewal cost, and net value in aligned rows, with a stronger net figure and red negative value. Policy verdicts use sage or amber insets, explicit reasons, and a collapsible approval basis. Alternative terms retain named states and separate review/dismiss actions. Approval and execution controls follow the evidence in normal document flow.

Evidence graph nodes reuse the source radius and pale paper/sage/amber fills. Causal paths and arrowheads use graph-link with a 1.4px path stroke against paper. Named relationship text accompanies the geometry; source selection reveals quoted evidence, record metadata, and revision controls. Node titles may clamp to three lines; the full title and relationship list remain available.

Failure cases use a selectable list beside a bordered result, an explicit passed/failed verdict, named checks, and expandable recorded/rejected steps. The advanced command editor uses 12px monospace. Assurance case entry is a .25s easing from 1px blur to clear, disabled for reduced motion. Assurance controls use 2px forest focus outlines with 3px offset; primary/secondary actions have 39px minimum height.

## Do's and Don'ts

### Do:
- **Do** preserve named state labels alongside semantic colors.
- **Do** keep tabular monetary figures and source references close to decisions.
- **Do** maintain responsive stacking and clearance for fixed controls.
- **Do** preserve visible focus and reduced-motion behavior when extending controls.

### Don't:
- **Don't** treat an issued credit as verified savings without invoice application.
- **Don't** generalize the existing tiny muted metadata into reusable styling.
- **Don't** carry the uppercase workspace eyebrow into new surfaces; it is an incumbent craft-floor defect, not a system primitive.

The source scan reports 64 slight tonal color variants, 19 font sizes, and three local radii outside the recorded scale (86 advisories; zero primary findings). These remain observed drift, not normative tokens. The inherited workspace eyebrow and tiny annotations are not canonized; this documentation pass does not normalize source code.
