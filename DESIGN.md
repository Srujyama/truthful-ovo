---
name: Truthful
description: A finance workspace connecting follow-ups, exact documents, credits and approved actions, with a secondary original Office map.
colors:
  ink: "#202530"
  muted: "#606b7b"
  rule: "#e3e7ed"
  canvas: "#f5f6f8"
  paper: "#ffffff"
  action: "#344b80"
  action-hover: "#293e6c"
  selected: "#eef2fa"
  negative: "#a43d39"
  negative-fill: "#faeeee"
  warning: "#865d18"
  warning-fill: "#fbf3e4"
  world-paper: "#f6f4ef"
  world-ink: "#303a30"
  world-muted: "#6b7164"
  world-rule: "#d8d6ca"
  world-green: "#356550"
  world-action: "#3c6650"
  world-action-hover: "#2c513d"
  inspector-paper: "#fdfbf3"
  station-paper: "#fffdf2"
  station-edge: "#a7a493"
  limestone: "#e6dfca"
  stone: "#c7c0a9"
  brick: "#a77554"
  roof: "#3f5b4d"
  teal: "#55999a"
  brass: "#c5a05a"
  timber: "#795d43"
typography:
  display:
    fontFamily: "Public Sans Variable, Public Sans, sans-serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.035em"
  body:
    fontFamily: "Public Sans Variable, Public Sans, sans-serif"
    fontSize: "14px"
    lineHeight: 1.55
  annotation:
    fontFamily: "Public Sans Variable, Public Sans, sans-serif"
    fontSize: "12px"
  world-display:
    fontFamily: "Pixelify Sans, sans-serif"
    fontSize: "clamp(30px, 3vw, 43px)"
    fontWeight: 500
    lineHeight: 1.1
  station-title:
    fontFamily: "Pixelify Sans, sans-serif"
    fontSize: "25px"
    fontWeight: 500
    lineHeight: 1.1
  station-label:
    fontFamily: "Pixelify Sans, sans-serif"
    fontSize: "16px"
    fontWeight: 500
    lineHeight: 1.1
  world-balance:
    fontFamily: "Pixelify Sans, sans-serif"
    fontSize: "clamp(23px, 2.4vw, 32px)"
    fontWeight: 500
    lineHeight: 1.2
  code:
    fontFamily: "ui-monospace, SFMono-Regular, monospace"
    fontSize: "12px"
rounded:
  control: "6px"
  navigation: "5px"
  world-control: "4px"
  account-dialog: "10px"
spacing:
  tight: "8px"
  small: "12px"
  medium: "16px"
  panel: "20px"
  section: "24px"
  workspace-gutter: "36px"
components:
  button-primary:
    backgroundColor: "{colors.action}"
    textColor: "{colors.paper}"
    rounded: "{rounded.control}"
    padding: "9px 13px"
  button-world-primary:
    backgroundColor: "{colors.world-action}"
    textColor: "{colors.station-paper}"
    rounded: "{rounded.world-control}"
    padding: "9px 16px"
  button-world-text:
    textColor: "{colors.world-green}"
    padding: "8px 0"
  navigation-selected:
    backgroundColor: "#e8edf7"
    textColor: "#2f477c"
    rounded: "{rounded.navigation}"
    padding: "10px 12px"
  station-anchor:
    backgroundColor: "{colors.station-paper}"
    textColor: "{colors.world-ink}"
    padding: "7px 10px"
    width: "155px"
  station-inspector:
    backgroundColor: "{colors.inspector-paper}"
    rounded: "{rounded.world-control}"
    padding: "22px 20px 17px"
---

# Design System: Truthful

## Current direction

The operating application opens Follow-ups. A company’s promise, its exact documents, received credits, proposed changes and next action stay connected as someone inspects and returns. The ordinary workspace uses readable Public Sans, dark ink, white working surfaces, pale gray canvas and restrained blue actions/selection. This documents the current implementation; it does not record user approval or final acceptance.

The user rejected the previous Nomen-inspired spatial milestone as sufficient application design. The original Office map remains a secondary overview with real record links. Its warm materials, Pixelify labels and isometric architecture belong to that scene; they are not the default type or composition for repeated financial work. The historical milestone and its evidence remain in [NOMEN_ADAPTATION.md](docs/NOMEN_ADAPTATION.md).

## Composition follows the work

| Surface | Working composition |
| --- | --- |
| Follow-ups | Full-width searchable/filterable results, then a full-width selected case with amounts, next action and Documents / Credits / History. Back returns to the retained results. |
| Credits | Dated credit lines beside the selected note, its assignments and supporting documents. On phone, list and detail are separate views. |
| Tasks | Prioritized rows expand the actual reason, related issues and next action in place. Scheduled work stays separate and reachable. |
| Companies | Relationship list and selected company with balances, follow-ups, credits and documents. |
| Documents | Search and version/cutoff filters, a document list and an exact-version reading surface. Source text is preserved as supplied. |
| Activity | Dated recorded changes beside the selected change, actor, effective date and related case. Raw records are progressive detail. |
| Reports | Financial statement and company comparison, independent financial/document-cutoff dates and exports. |
| Document review | Tabbed original inputs connected to a finding and exact passage. Managed mode adds saved document, follow-up draft and import libraries; browser mode clearly identifies local demo storage. |
| Workflow tests | Bounded comparisons and separate action-permission controls. Technical detail serves the selected test or action rather than becoming the default finance opening. |

A palette change cannot establish these relationships. The inspected local Relay study demonstrates source-to-consequence coupling; Builder demonstrates retained identity and interruption/history; PigeonBox demonstrates that familiar operational controls can carry a specific product. These are mechanism references, not layouts to transplant or evidence of user approval. The source/evidence boundaries are recorded in [UI_OVERHAUL.md](docs/UI_OVERHAUL.md) and [FRONTEND_GUIDANCE.md](docs/FRONTEND_GUIDANCE.md).

## Type, color and controls

Public Sans is imported locally through `@fontsource-variable/public-sans`. Principal operational headings are around 28px, with 25–26px phone variants; body and working rows use 13–14px, with 12px supporting labels. Amounts use aligned numerals and explicit currency/meaning. Code, digests and raw records use monospace where useful. Pixelify Sans is locally served with its OFL retained and is confined to Office scene identity, place labels and selected scene figures.

`src/workspace.css` supplies the operational tokens listed above. Blue marks selection and available actions. Negative and warning fills retain readable labels; color alone never distinguishes issued, applied, conditional or reversed money. Surface-specific exact values remain in their component CSS rather than being forced into one universal card treatment.

Ordinary buttons use 6px corners, 38px minimum height and explicit verbs. Primary buttons have white text on blue; secondary buttons have white fill and a fine border. Text actions stay concise. Disabled actions retain the relevant reason near the task. Focus outlines are visible with a 2px blue outline and 3px offset. Native disclosures contain supporting terms, history, policy and technical records rather than repeating them throughout the page.

## Responsive structure

The workspace has a 216px rail, a 64px utility header and 36px desktop gutters. At 1100px utility controls compact and gutters become 24px. At 760px the rail becomes an overlay, the header becomes 59px, and the mobile menu supports focus containment, Escape/backdrop close and return to its trigger. The selected task remains the content rather than shrinking the entire desktop layout.

Task-specific transformations remain deliberate: document lists become a scroll-bounded block above the reader at 640px; company columns stack earlier; credit list/detail switches on phone; case amounts and source documents reflow into readable single-column groups. Managed document review stacks its archive and reading surface at 760px and keeps its example action available. Long exact source text wraps; tab/filter rows may scroll without clipping the document or action.

## Identity and consequence

Retained route surfaces preserve drafts and selected work when moving among workspace destinations or Office. Exact case/action/source targets are passed explicitly; an unavailable requested record must show that state rather than substitute another record. History, focus entry/return and draft recovery are part of the interaction, not optional polish. Current integrated journey evidence belongs in the overhaul record; source structure alone does not prove these paths passed.

Original document versions remain inspectable. Revising a source, changing accepted terms or changing policy can invalidate an earlier approval. Managed draft approvals bind the exact saved version; later edits/rebinding require review. Credit forms preview their actual financial deltas before recording. Conditional offers, issued notes and applied credit remain separate, and reversal/assignment capacity comes from the same financial model.

## Office scene and motion

Office retains six original Canvas buildings, DOM station controls, selected-station records, camera fit/zoom/drag, pause and reduced-motion controls. Building links enter actual documents, approvals, credits, reports, tasks or the exact approved action. Scenery does not perform financial work. The scene’s material palette and pixel rendering remain local to this alternate presentation.

Recorded-event couriers use a 1900ms active-time clock; scenery and courier progress account for pause and visibility changes. Zoom is bounded from 0.7 to 2.2, and pointer cancellation ends a drag. At 800px the scene stacks its inspector below the map; a normal-flow six-station dock keeps every destination available. On narrower maps the camera frames the selected building. Reduced motion retains ordinary controls while suppressing motion. Historical browser captures did not establish actual tab-background visibility; timing-unit evidence is distinct from that browser observation.

## Evidence and scope

Current sources: `src/App.jsx`, `workspace.css`, `Assurance.jsx`, `Credits.jsx`, `Operations.jsx`, `ManagedEvidence.jsx`, `Workbench.jsx`, `ExecutionLab.jsx` and their task CSS; the Office renderer remains under `src/clearing-house/`. This record supersedes the prior warm-paper/pixel operational design and its default-world assumption. Legacy module names are implementation history, not product vocabulary.

[UI_OVERHAUL.md](docs/UI_OVERHAUL.md) owns current acceptance criteria and evidence reconciliation. Passing builds, historical screenshots and reviewer verdicts do not establish user acceptance. Public hosting, native Figma persistence, videos and submission remain separate delivery targets; this document claims none of them.
