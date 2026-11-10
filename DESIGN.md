# Current design: the interacting team

The user rejected the green mat/manila frame and previous quality claims. The current application opens a working team scene, with original isometric characters and workstations, physical file exchanges and source-bound findings. Compact neutral navigation and an open warm-white surface connect the rest of the app. The scene uses original code in `src/clearing-house/team-renderer.mjs`; model identity and event/source truth live in `team-model.mjs`; presentation time belongs to `team-playback.mjs`.

The main mechanism follows the inspected Nomen reference: select a stable worker, watch its concrete handoff, and inspect the source behind that exchange. Phone framing keeps the working pair or selected person at useful scale; a selected teammate opens a keyboard-accessible action sheet. Dragging takes camera ownership, deliberate selection/fit releases it, and repeated selection works. Pausing freezes the pose, reversal continues from the current position, and seeking restores the same pose. Reduced motion retains findings and actions without travel. No replay changes finance or account roles.

The source system now uses `src/team-theme.css` after the historical theme: background `#f7f6f2`, working surface `#faf9f5`, ink `#242922`, fine rule `#e0dfd6`, compact navigation `#f0efe9`, shared action `#3d5033`. Helvetica/Archivo remain the readable interface type; manila and paper occur in evidence objects rather than surrounding the whole application. The studio adds timber, terracotta, sage, slate, task tools and consistent upper-left lighting. Dossier portraits use the same worker renderer as the scene. Current requirements, repaired findings and operated evidence belong to [TEAM_DESIGN.md](docs/TEAM_DESIGN.md). This records no user approval or claim of perfection.

---

The following sections preserve prior design history; their former “current” descriptions are superseded by the team rebuild above.

---
name: Truthful
description: A correspondence file connecting a company promise, its exact documents, invoice credit and the next decision.
colors:
  desk: "#2e5946"
  desk-ink: "#d6e8dc"
  paper: "#f6f4ed"
  cotton: "#f4f0e7"
  manila: "#e5d5ab"
  ink: "#1d1c19"
  muted: "#6b675c"
  rule: "#d2ccbc"
  action: "#a13c27"
  action-hover: "#7f2d1e"
  selected: "#e9e2cc"
  negative: "#a13c27"
  negative-fill: "#f1e0d5"
  warning: "#825a24"
  warning-fill: "#eee3c9"
typography:
  display:
    fontFamily: "ArchivoDisplay, Arial, sans-serif"
    fontSize: "clamp(48px, 4.1vw, 64px)"
    fontWeight: 900
    lineHeight: 0.98
  heading:
    fontFamily: "Archivo, Helvetica Neue, Helvetica, Arial, sans-serif"
    fontSize: "28px"
    fontWeight: 600
  body:
    fontFamily: "Helvetica Neue, Helvetica, Arial, sans-serif"
    fontSize: "15px"
    lineHeight: 1.6
  annotation:
    fontFamily: "Martian, monospace"
    fontSize: "10px"
  case-row:
    fontFamily: "Helvetica Neue, Helvetica, Arial, sans-serif"
    fontSize: "19px"
    fontWeight: 600
    lineHeight: 1.3
rounded:
  control: "3px"
  file: "0 8px 8px 2px"
  mobile-file: "4px"
spacing:
  tight: "8px"
  small: "12px"
  medium: "16px"
  panel: "20px"
  section: "24px"
  workspace-gutter: "32px"
components:
  button-primary:
    backgroundColor: "{colors.action}"
    textColor: "#fff9ed"
    rounded: "{rounded.control}"
    padding: "9px 13px"
  navigation-tab:
    backgroundColor: "{colors.manila}"
    textColor: "{colors.ink}"
    padding: "12px 18px"
  navigation-selected:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    padding: "12px 18px"
  case-index:
    backgroundColor: "#fbf9f1"
    textColor: "{colors.ink}"
    padding: "28px 28px 10px"
  company-mark:
    textColor: "#6b624c"
    width: "42px"
  case-graphic:
    backgroundColor: "#fcfaf1"
    textColor: "{colors.ink}"
---

# Design System: Truthful

## Current visual document and case build

The user also rejected the Documents experience in `9bcc8fa` and the prior visual-review claim: the raw text, oversized list and empty card did not meet the brief. The current correction makes original financial graphics the main explanation, with exact source text available on demand.

The user explicitly rejected the blue-gray workspace at commit `081444c`, the earlier Nomen milestone as sufficient application design, and all three Formroom candidates as taste templates. This document records the replacement currently implemented in source. It records no user approval. Completed local workflow evidence is recorded separately in CORRESPONDENCE_DESIGN.md. [CORRESPONDENCE_DESIGN.md](docs/CORRESPONDENCE_DESIGN.md) owns the current requirements and review; the older [UI_OVERHAUL.md](docs/UI_OVERHAUL.md) is historical evidence.

The organizing object is a company conversation: what they promised, what the invoice shows, and what needs doing. Cases opens with readable stories and real next actions, not portfolio KPI totals, technical reference columns or a status taxonomy. Exact amounts, dates, record identifiers, policy and raw events remain available when needed.

## Reference and material system

The direct reference is Aiden Guan’s [Student page](https://aidenguan.com/student), its opened project folder, and the matching local `portfolio-2` source. Its folder opening and closure were operated and captured during the earlier reference study. The implementation adapts the related materials, light and object continuity to original finance-specific artwork and behavior. It does not copy the author’s identity, photographs or unrelated desk objects.

Every route sits in one green gridded mat, manila navigation tabs and warm paper file. Light enters from the upper left; layers cast shadows down and right. Dark printed text, fine warm rules, restrained red ink, clipped paper corners, receipt perforations and a paperclip belong to the same material grammar. Documents, decisions, forms, account dialogs, examples and the Office illustration share this environment. Office is inside the file frame, rather than a separate theme or app shell.

`src/correspondence-theme.css`, imported after the existing styles, supplies the current material and semantic tokens. Existing task CSS still supplies each view’s useful structure. The theme does not turn every task into the same card grid.

## Navigation and composition

| Destination | Composition and work |
| --- | --- |
| Cases | A question on the file cover beside a searchable conversation sheet. Illustrated rows carry a short financial fact; opening a company shows drawn promise-to-invoice reconciliation, its next action and illustrated document previews. |
| Documents | Compact illustrated file list; offer/cost subtraction, credit-note and invoice artwork, date calendars, service report and agreement. Original text is a separate view; exact versions, filters, downloads and related-case actions remain. |
| Companies | Company list and selected relationship; a single case has one narrative rather than repeated summary text. |
| Reports | Financial statement and company comparison, separate financial/document dates and exports. |
| Needs attention | Contextual to Cases; prioritized reasons and concrete next steps, with scheduled work reachable. |
| Credit notes | Contextual to Documents; original note amounts, matched portions, invoice application, assignments and reversals retain separate meanings. |
| Check documents | Contextual to Documents; supplied inputs, exact passages, findings and drafts. Managed mode adds saved versions and reviewed imports. |
| More | History, Developer tools, Office map and Examples. History uses human descriptions with raw records in details. Developer tools retains comparisons, action permissions and replay. |

The four primary tabs are Cases, Documents, Companies and Reports. The global header retains Search, Add documents and account access. Examples contains Guided cases, Example activity and Example documents. Internal module/route names remain compatibility details rather than the visible navigation vocabulary.

## Type and controls

Archivo carries headings; Archivo ExtraCondensed Black carries the cover question and wordmark. Helvetica Neue, Helvetica and Arial carry reading and forms. Martian Mono carries small printed metadata. The Archivo and Martian WOFF files are local under `public/fonts/` with [Archivo’s OFL](public/fonts/Archivo-OFL.txt) and [Martian Mono’s OFL](public/fonts/MartianMono-OFL.txt). Public Sans remains an installed legacy dependency; it is not the current app’s primary typography. Original map art may retain pixel labels within the illustration.

Principal task headings are 28px; Cases is 23px. The cover question is 51px on wide screens and 36px on phone. Case story headlines are 19px on desktop and 17px on phone; body defaults to 15px, with denser supporting text and 9–10px metadata. Exact supplied source text keeps its meaning and is not rewritten to fit the new voice.

Red ink marks available actions and focus; named text communicates the actual result. Negative and warning states remain distinct in meaning even where colors overlap. Main buttons have 3px corners and a 40px minimum height. Inputs use warm white stock, a fine brown rule and 3px corners. Focus has a 2px red outline and 4px offset. Details/disclosures contain policy, exact record data and technical evidence without hiding the primary decision.

## Truthful paper objects

`DocumentGraphic` uses original SVG stock, folded edges, cut-out vouchers, two-date calendars, invoice highlights and service/report objects. Graphics are a representation of recorded terms, never an invented original scan. Offer subtraction uses frozen proposal values; only invoice application backed by the selected version carries a confirmation mark. Notes and promises never carry that mark. Phone graphics recompose vertically rather than shrinking their labels.

`CaseGraphic` uses current values to compare the promise with invoice credit and the remaining gap. Note amounts are explicitly matched portions, not physical note face values. Conditional offers compare extra spending with offered credit. Original document terms and current case state remain separate. `document-reading.mjs` supplies exact-version relationships, preserves generic text fallback and opens only the matching amendment action.

`DocumentReader` keeps the visual overview and original-text views distinct. Metadata, original title, exact revisions and incidental review inclusions stay disclosed. Phone shows results, both dates and the actual case action before long artwork; Back restores the selected document row and focus.

`PromisePapers` is original summary artwork generated from the selected case’s actual amounts. Its printed caption is **Promise summary**. It is not an original invoice, vendor letter, authenticated document or replacement for the source reader. The slip says **Invoice not added** when no related invoice revision is available. Opening the object enters the actual case and its supplied documents.

`CaseExplanation` states the actual promise and invoice result, or the extra spending and offered credit for a conditional renewal. Baseline assumptions are inspectable. A matched share of a larger note is not relabeled as a smaller physical note. An issued note does not prove the bill was reduced. Missing local invoice evidence does not establish what happened in a vendor’s external system.

The main CTA names the real decision, such as checking the note or comparing proposed terms. Proposing, approving or recording a local domain action does not compose or send an email. Editable drafts, exact-version approval and unsent EML export live in document review.

## Continuity and responsive behavior

The selected company seal and name travel between its conversation row and case reader using original FLIP/WAAPI clones. Source defines a 420ms movement with `cubic-bezier(.2,.75,.25,1)`. Back during entry reverses the active animation; cleanup restores live elements. Pointer events remain with the working UI. Reduced motion skips the cloned movement. These mechanisms require operated normal-motion, interruption, cancellation and return checks; source alone is not evidence that they passed.

The main desktop frame uses a 202px rail, 69px header and 32px task gutters. At 1100px the rail becomes 163px and framing compacts. Between 761px and 900px the case cover and conversation sheet stack while retaining a small paper object. At 760px the navigation becomes a focus-contained overlay, the header becomes 57px, the frame has 10px side margins and task gutters become 19px. Phone hides cover metadata and summary artwork so the real conversations take priority. Task-specific stacking remains in the underlying CSS; document reading moves to explicit list/reader navigation at 760px; below 1220px, consequence and case action precede the artwork and Office’s map/inspector at 800px.

Visited task surfaces retain selections, drafts and ephemeral signing keys across ordinary navigation, including Office round trips. Session/workspace changes must not leak retained work. Missing exact targets show an unavailable state instead of substituting another record. Keyboard focus entry/return and scroll recovery are part of the same journey.

## Office and verification boundaries

Office retains six original Canvas buildings, DOM station links, exact record inspection, bounded zoom/fit/drag, pause/visibility-aware couriers and reduced-motion controls. Its header returns **Back to the file**; its count strip describes recorded case files and documents. Scenery illustrates recorded work and performs no financial transaction. The historical [Nomen record](docs/NOMEN_ADAPTATION.md) preserves provenance and earlier behavior evidence.

Source and current desktop/phone captures of Cases, Documents and Office were inspected for this documentation update, including the repaired phone cover and shared Office frame. The lead owns integrated functional tests, broader rendered inspection and acceptance reconciliation in [CORRESPONDENCE_DESIGN.md](docs/CORRESPONDENCE_DESIGN.md). Passing builds, screenshots, reviewer scores and historical counts do not establish user acceptance. This documentation claims no new public deployment, native Figma persistence, connected external action, video or submission.

### Reviews, credit files and retained intake

The shared material language now continues into Reviews, Credit notes, Companies and Needs attention. Review consequences and primary controls precede large artwork; detailed restrictions, source bindings and historical records remain in disclosures. Declined offers are closed, with an exact recorded reason. Current calculations and immutable recorded comparisons have separate display paths. Company files reuse the same promise/invoice and physical-credit objects rather than inventing another visual taxonomy.

Credit graphics conserve original document value across reversals, matched shares and unmatched value. An invoice credit amount is not the gross invoice amount. Phone company tiles stay inside their list above the selected file; case links precede the art. Draft/source edits belong to exact saved versions, and the global new-intake route preserves those edits. Exported unsent email includes the exact original evidence files while preserving approved message text. Current operation and review evidence lives in `docs/CORRESPONDENCE_DESIGN.md`; this records no user approval.
