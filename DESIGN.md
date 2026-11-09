---
name: Truthful
description: A financial clearing house connecting a spatial overview to exact evidence and ledger work.
colors:
  world-paper: "#f6f4ef"
  world-ink: "#303a30"
  world-muted: "#6b7164"
  world-rule: "#d8d6ca"
  world-green: "#356550"
  action: "#3c6650"
  action-hover: "#2c513d"
  sheet: "#fffdf7"
  inspector-paper: "#fdfbf3"
  selected: "#e7e9dd"
  station-paper: "#fffdf2"
  station-edge: "#a7a493"
  evidence-warning: "#665127"
  evidence-warning-fill: "#f0eadb"
  evidence-error: "#7b3326"
  evidence-error-fill: "#f4e6dc"
  limestone: "#e6dfca"
  stone: "#c7c0a9"
  brick: "#a77554"
  roof: "#3f5b4d"
  teal: "#55999a"
  brass: "#c5a05a"
  timber: "#795d43"
typography:
  display:
    fontFamily: "Pixelify Sans, sans-serif"
    fontSize: "clamp(30px, 3vw, 43px)"
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  ledger-headline:
    fontFamily: "Pixelify Sans, sans-serif"
    fontSize: "33px"
    fontWeight: 500
    letterSpacing: "0"
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
  body:
    fontFamily: "Public Sans Variable, Public Sans, sans-serif"
    fontSize: "14px"
    lineHeight: 1.55
  ledger-body:
    fontFamily: "Public Sans Variable, Public Sans, sans-serif"
    fontSize: "13px"
  annotation:
    fontFamily: "Public Sans Variable, Public Sans, sans-serif"
    fontSize: "12px"
  balance:
    fontFamily: "Pixelify Sans, sans-serif"
    fontSize: "clamp(23px, 2.4vw, 32px)"
    fontWeight: 500
    lineHeight: 1.2
  commitment-amount:
    fontFamily: "Pixelify Sans, sans-serif"
    fontSize: "48px"
    fontWeight: 500
  code:
    fontFamily: "ui-monospace, SFMono-Regular, monospace"
    fontSize: "12px"
rounded:
  evidence-control: "3px"
  world-control: "4px"
  sheet: "5px"
  dock: "6px"
  account-dialog: "10px"
spacing:
  tight: "8px"
  small: "12px"
  medium: "16px"
  panel: "20px"
  section: "24px"
  world-gutter: "38px"
components:
  button-world-primary:
    backgroundColor: "{colors.action}"
    textColor: "{colors.station-paper}"
    rounded: "{rounded.world-control}"
    padding: "9px 16px"
  button-world-primary-hover:
    backgroundColor: "{colors.action-hover}"
  button-world-text:
    textColor: "{colors.world-green}"
    padding: "8px 0"
  station-anchor:
    backgroundColor: "{colors.station-paper}"
    textColor: "{colors.world-ink}"
    padding: "7px 10px"
    width: "155px"
  station-inspector:
    backgroundColor: "{colors.inspector-paper}"
    rounded: "{rounded.world-control}"
    padding: "22px 20px 17px"
  navigation-selected:
    backgroundColor: "{colors.selected}"
    rounded: "{rounded.sheet}"
    padding: "8px 14px"
  account-dialog:
    backgroundColor: "{colors.world-paper}"
    rounded: "{rounded.account-dialog}"
---

# Design System: Truthful

## Overview

**Creative North Star: "The financial clearing house"**

A financial clearing house gives each kind of work a place: archive, review hall, credit exchange, verified vault, execution observatory and dispatch desk. Warm paper, original isometric architecture and Pixelify place names make the overview recognizable; an ordinary ledger and exact record views carry the financial work.

The user selected Nomen’s spatial, pixel and paper interaction direction. Truthful uses original Canvas geometry and finance-specific destinations, with real DOM station buttons and a persistent route into the existing task interface. Public Sans remains the reading and form face. The world is an overview of recorded facts, not evidence that scenery performs financial operations.

**Key Characteristics:**
- Warm paper and brown-green ink across world and ledger.
- Pixel display type paired with Public Sans reading and forms.
- Distinct isometric stations, anchored labels and a readable record inspector.
- Named financial states, exact record destinations and separate recoverable/issued/verified balances.

## Colors

Warm paper and brown-green ink frame forest actions, selected olive washes and mineral architectural materials. Frontmatter captures reused current-world values, not every inherited local color.

### Primary
- **World green / action:** verified values, actionable commands and selected context. The world button has its own slightly warmer action shade and deeper hover.

### Secondary
- **Teal, brick, brass and timber:** original architecture and finance props; these are material colors, not financial verdicts.
- **Evidence warning / error pairs:** readable named restrictions and failures in managed evidence.

### Neutral
- **World paper:** shared canvas and account paper.
- **Sheet / inspector paper / station paper:** subtly distinct working sheets, record inspector and anchored labels.
- **World ink / muted / rule:** primary text, contextual copy and fine divisions.
- **Limestone / stone / roof:** recurring model materials.

**The Recorded State Rule.** Pair semantic color with a readable state. Issued credit and verified applied credit remain distinct, even when both use green.

## Typography

**Display Font:** Pixelify Sans, sans-serif; locally served variable font (400–700), with its OFL retained in `public/fonts/pixelify/OFL.txt`.
**Body Font:** Public Sans Variable, Public Sans, sans-serif.
**Code Font:** ui-monospace, SFMono-Regular, monospace.

Pixelify gives headings, building labels and selected financial figures their pixel character. Public Sans carries the detail that operators must read. Tabular numerals align financial values. Managed evidence and the account dialog deliberately retain Public Sans headings: the artifact does not apply pixel display type to every title.

### Hierarchy
- **Display:** world title, with mobile sizes of 32px at 800px and 29px at 420px.
- **Ledger headline:** principal ledger titles; portfolio and operations become 28px at 640px. Existing task-specific title sizes remain.
- **Station title / label:** inspector title and building label respectively.
- **Body / ledger body:** world and managed reading at 14px; conventional ledger at 13px. Managed evidence uses line height 1.6.
- **Annotation:** 12px working guidance and controls. Current world metadata also uses 10–11px; this is recorded drift, not a recommended smaller scale.
- **Balance / commitment amount:** pixel totals and prominent selected credit. Managed evidence totals use Public Sans (24px, 22px at 900px).

**The Two Voices Rule.** Pixelify names the place and emphasizes selected amounts; Public Sans carries records, forms, explanations and dense evidence.

## Layout

The world has an 82px header, 38px horizontal gutters and a flexible map beside a 330px inspector, separated by an 8px grid gap. The map is viewport-aware, clamped from 470px to 720px. The inspector starts 30px below the grid top, has a 505px minimum height and viewport-bounded record scrolling. Three separate balances sit below the map; the six-station dock follows them in normal flow.

Above 1700px the world caps at 1600px and the inspector grows to 370px. At 1100px gutters become 22px and the inspector 290px. At 800px the header becomes 70px, the world stacks with 16px gutters and the map becomes 470px high. The inspector is full width with a 290px record-scroll cap. The dock remains static in normal flow, spans the map width, omits icons/counts and offers all six stations. At 420px the map becomes 420px high. For a map narrower than 650px, the camera frames the selected station; selection clears pan. At 540px the header account control becomes a labeled icon button.

The conventional ledger retains the functional 216px fixed rail, 56px utility header, capped working containers and dense master/detail layout. Portfolio columns stack at 1100px; the rail narrows at 950px and becomes an accessible overlay at 760px. Mobile case/action selectors, collapsed overview/history and a full-width original-claim next action keep the selected financial record reachable. Existing tabs scroll when necessary.

Managed evidence caps at 1320px with 36px gutters, a 260px archive and 40px gap. At 900px the archive becomes 205px with 24px gap; at 640px it stacks with 16px gutters, scroll-bounded saved records and 44px action buttons. The account dialog caps at 540px, leaves viewport margins, scrolls internally, and uses single-column workspace controls at 540px. Preserve these surface-specific breakpoints rather than inventing one global breakpoint.

## Elevation & Depth

World depth comes from isometric geometry, material shading, roof silhouettes, paths and shore, rendered at half resolution with pixelated scaling. Anchored labels use a physical bottom border (3px), not an offset shadow. Ordinary task sheets remain flat with fine rules and selected washes. Floating dispatches, account dialogs and inherited temporary overlays use ambient shadows.

### Shadow Vocabulary
- **Recorded dispatches:** `0 14px 40px #333d291c`.
- **Account dialog:** `0 18px 70px #26302133`, with a `#252d2566` backdrop.
- **Inherited task overlays:** evidence drawers, workspace options and mobile navigation retain their existing ambient separation; these are not general card elevations.

**The Place and Proof Rule.** Architecture supplies spatial context; evidence, amounts and financial actions remain in readable DOM controls and task surfaces.

Scenery and recorded-event couriers have explicit pause/resume, freeze while the document is hidden, and honor reduced motion. Courier progress lasts 1900ms of active time. Camera fit resets pan/zoom; zoom is bounded from 0.7 to 2.2. Pointer cancel ends dragging. These gestures change the view, not the financial record. World state-color transitions take 160ms; reduced motion removes transitions.

## Shapes

Fine rectangular sheets, square architectural edges and practical small corners connect the world to the ledger. Anchored labels remain square with a heavier bottom edge. World controls and inspectors use 4px corners, ledger sheets 5px, dock/account trigger 6px, and account dialog 10px. Managed evidence has 3px field/control corners. Small round station seals provide context beside the inspector title. Labeled Lucide SVG line icons accompany ordinary controls; buildings and the clipped pixel wordmark are original geometry.

## Components

### Buttons
Forest commands with explicit verbs. World primary buttons have a 41px minimum height, fine forest border and the frontmatter padding; hover deepens the fill. Ledger primary buttons retain 38px minimum height and 9px/13px padding with the world’s 4px corners. Evidence buttons are 40px, rising to 44px on mobile; account actions are 44px. Secondary actions use paper or transparent fill and a fine border. Text actions use green and an underline where implemented. Disabled controls retain their operation’s explanation; evidence/world opacity differs from the account dialog’s opaque muted treatment. Do not infer one disabled color for the entire app.

World focus uses a 2px teal-green outline offset 4px; ledger/account focus is 2px with 3px offset; managed evidence uses 3px with 3px offset. Keep focus visible for inputs, buttons, selects, textareas and summaries in each surface.

### Chips
Named statuses use compact semantic fills or text. Managed evidence uses a square olive status fill; ledger status chips retain their existing warning/negative/verified treatments. State text remains meaningful without color.

### Cards / Containers
Inspector sheets use warm paper, a fine mineral border and small corners. Rule-separated record rows expose vendor, exact reference, amount, task and named state. Hover adds a paper wash. Search appears for longer station lists. Empty inspectors explain why no records exist and offer the appropriate real destination. Loading/signed-out paper overlays obscure unavailable records with a status and account entry; workspace errors expose a retry action.

### Inputs / Fields
Paper fields with fine olive-gray borders and readable Public Sans. Evidence inputs are at least 38px; account fields at least 44px and become 16px text on mobile. Source textareas resize vertically, preserve entered text and show retained versus unsaved state. Exact citations, source documents and import amounts use disclosures and bounded scrolling; code and digests wrap when necessary.

### Navigation
World/Ledger/Operations presentation controls sit beside the account menu; selected World uses an olive wash. The six-station dock mirrors anchored building selection with real DOM buttons and `aria-pressed`. Offscreen anchors leave the tab order; Canvas is hidden from assistive technology. Ledger navigation preserves labeled destinations and exact record routes. The World return control reopens the spatial overview while preserving the mounted task. Mobile ledger navigation uses modal focus, Escape/backdrop close and focus restoration.

### Account Dialog
A native modal dialog with sticky heading, explicit close, paper body and visible runtime identity. Forms distinguish sign-in, enrollment, workspace selection and managed account actions from the separately labeled fictional demo-role selector. Pending, error and success text remains beside the form. Exact account behavior is governed by the service, not implied by illustration.

### Evidence and Financial Review
Analysis versions, ledger imports, claim drafts and approvals have distinct headings and named states. Selected saved records use an olive wash and a green inset marker. Approval names the exact draft; stale/unsaved/historical restrictions retain visible reasons. Downloads distinguish an unsent email, CSV and evidence packet. Decision evidence opens the exact bound source revision and provides a focused return. These working records keep their readable form grammar rather than turning into buildings.

## Do's and Don'ts

### Do:
- **Do** use the paper, Pixelify and Public Sans relationship across the world and conventional ledger.
- **Do** keep station buttons and the six-station dock usable independently of Canvas interaction.
- **Do** preserve exact source revisions, action identity, readable states and the distinction between issued and applied credit.
- **Do** preserve focus, modal dismissal, mobile stacking and reduced-motion behavior.

### Don't:
- **Don't** replace the selected spatial world with the superseded neutral-white-only identity.
- **Don't** treat an illustrative courier, building or approval as a completed financial transaction.
- **Don't** copy Nomen’s renderer, models, logo or media into this original implementation.
- **Don't** propagate tiny annotations, decorative eyebrows or text glyph icons as system primitives.

Not canonized or repaired: inherited neutral/legacy semantic overrides, local tiny annotations remain implementation drift; this documentation pass does not legitimize them or modify UI. Native Figma files describe a separate older artifact, not proof of parity with this React build.

Source record: `src/clearing-house/clearing-house.css`, `ledger-theme.css`, `models.mjs`, `renderer.mjs`, `FinanceWorld.jsx`; `src/product-ui.css`, `WorkspaceAccount.jsx`, `workspace-account.css`, `ManagedEvidence.jsx`, `managed-evidence.css`; current `PRODUCT.md` and `docs/NOMEN_ADAPTATION.md`. Rendered checks: clearing-review desktop/mobile, clearing-ledger mobile, clearing-account mobile and clearing-managed-claim desktop captures. This records the inspected local implementation. Journey and release evidence live in docs/NOMEN_ADAPTATION.md.
