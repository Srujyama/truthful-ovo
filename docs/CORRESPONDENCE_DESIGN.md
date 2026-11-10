> Current iteration: T55/T56 extends the graphical Documents/Cases pass through Reviews, Credit notes, Companies, Needs attention and retained document/draft workflows. The user described the previous pass as only “slightly better” and explicitly set Figma aside. Earlier sections preserve historical evidence, not visual approval. See “Connected graphical workflow” below for this iteration.

# Correspondence rebuild — local delivery

The user rejected commit `081444c` as unfinished, inconsistent and incomprehensible. Its test results establish some behavior, not design acceptance. The original Nomen milestone and all three Formroom candidates are also rejected as taste templates. That replacement was recorded as T51/T52 in THINKPAD.md. The current iteration is T55/T56.

## The actual reference

Visual authority is Aiden Guan’s live [Student page](https://aidenguan.com/student), its opened projects folder, and the matching `portfolio-2` source in the user’s local reference checkout. This turn operated the live page and folder open/close, captured both, and read material, type, light, folder and narrow-layout source. The application uses its own finance-specific composition and artwork. The copied Archivo/Martian font files retain their OFL notices under public/fonts.

Use one work surface and one file environment: green mat, manila navigation tabs, warm printed sheets, restrained red ink, upper-left light and shadows down/right. Letters, invoice checks and approvals have related material roles. This is a working correspondence file, not a collage of unrelated desk toys. No knife, torch, personal identity scene or personal photographs are copied.

## What must be understood

The first reading path is company → what they promised → what the invoice actually shows → what needs doing. No overlapping portfolio totals, technical reference columns, or accounting status taxonomy on arrival.

- Pipeline: promised $2,400; the invoice confirms $900; $1,500 is missing. A later date and a renewal are proposals, not accepted changes. The renewal adds $2,400 of spending for $1,500 credit.
- Nimbus: a $2,000 credit note already exists; no matched invoice proves the deduction. October 30 is the new-claim deadline, not the date the credit note disappears.
- Orbit: $480 off requires $2,400 extra spending; $1,920 more than the stated cancellation comparison. This is not money owed or received.
- Parcel: $350 waiver expected on November 1; no matching invoice has been added. Do not assert what happened in a vendor’s external systems.

Partial assignment is not a smaller physical credit note. Original amounts, matching amounts, reversals, source versions, conditional terms and dates retain separate exact meanings. Stored report/source text remains unchanged.

## Scope and interaction

Cases, Documents, Companies and Reports are the primary file tabs. Case tasks, credit notes and document checking are contextual destinations; History, developer tools, Office and examples remain available. Every route, account/dialog and responsive state uses the same materials, type and controls. Office is an illustration inside this shared application frame.

The selected company mark/title must continue into the reader and back. Shared paper transitions use pointer-transparent WAAPI clones of the same company mark/title, with a reduced-motion alternative; rapid Back reverses the active transition. The actual motion must be operated, not inferred from screenshots.

The main case task must name the real decision. A local PROPOSE_ACTION/EXECUTE_ACTION is not an email composer or send. Real edited drafts and exact-version unsent email export remain in document review; no UI should claim an email was written or sent by recording a domain action.

## Acceptance and review

- Readable first actual conversation in a phone’s first viewport; no giant introduction hiding the work.
- Every main route inspected at wide, intermediate and phone widths. No contradictory themes or clipped controls.
- Human payload-aware History, exact event data still available in details.
- No duplicate one-case company narrative.
- Generic imported cases and partially assigned notes are truthful, with actual source relationships.
- Complete finance, document/draft, approval, credit/reversal/matching, report/export, account/workspace, permission/replay and example journeys preserved and operated.
- Fresh independent review against these exact reference captures and the user’s criticism. Scores, build success, screenshots or a clean Git tree cannot approve the design.

The local implementation and the checks below are complete for T51/T52. This records evidence, not user approval, production deployment or native Figma parity.

## Requirement-to-evidence record

| Requirement | Actual evidence |
| --- | --- |
| Readable company stories, invoice/credit-note/offer distinction | `correspondence.test.mjs`; operated Pipeline, Nimbus, Orbit and Parcel stories; no opening KPI taxonomy/table |
| One environment across every destination | Fresh wide/phone captures of all eleven routes; nine main routes also captured at 900px; account, approval, document and example workflows operated |
| Phone reading order and clear next step | First entire story/action fits 390×844; introduction and index bounds do not overlap; case-specific terms/note/request actions |
| Same company continues into the case | Actual WAAPI intermediate state, pointer Back reversal from current position, restored origin focus, reduced-motion alternative |
| Source and history truth | Bound earlier document version and exact text download; both History views use event-time payloads; technical identity remains inspectable |
| Finance lifecycle and recovery | Browser forms register, apply, assign and reverse credit; preserve physical note versus matched share; accept changed terms; survive failed writes and prevent duplicate effects; finish accepted promise |
| Roles, workspaces and approvals | Managed analyst/approver separation, exact saved draft approval, later-edit invalidation, signed-action retry, isolated workspace switching |
| Export and independent reproduction | Actual full record, CSV, source text and unsent email downloaded; eight credit packets and four document analyses independently replayed |

Current checks: `npm run check` passes 371 tests, authored evaluations, submission/depth/frontier checks and production build. `npm run verify:workspace-redesign` verifies 244 operated records outcomes, 41 managed outcomes, credit journeys (42+36 SQLite; 42+32 browser-only) and 32 document/example outcomes. The separate backend browser journey passes 29 outcomes and its export independently reproduces the fully credited $400 promise. Counts establish only their named behaviors.

Fresh independent review inspected the actual Student reference and opened folder alongside the rendered application. Repairs closed: giant/clipped phone introduction; vague main action; absent same-object continuity; raw global History; misleading summary paper; duplicated single-company story; Nimbus task confusing expected date with claim deadline; raw selected-case History. Final review found no remaining material visual/comprehension findings in its inspected scope. Normal-motion evidence is in `output/paper-motion-operation.log`; final captures and downloaded records are retained locally under `output/playwright/`.

`pad finish --timeout 300` was run. The whole historical plan correctly remains open for T9 (previously deferred external submission/video task) and T37 (native Figma expansion requires editable exact file and connected FigCli). Neither is represented as delivered by this rebuild. The public GitHub Pages release remains the older v3; local source and the development branch contain this interface.


## Visual correction after the rejected Documents screen — T53/T54

The user rejected `9bcc8fa`'s document list and reader, then clarified that high-quality graphics and much less text were required. The old review had overlooked fundamental composition problems. It is not evidence of visual acceptance.

The replacement is implemented in `DocumentGraphic.jsx`, `DocumentReader.jsx`, `CaseGraphic.jsx` and `document-reading.mjs`. Original SVG/CSS artwork explains the actual recorded relationship: extra spending minus offered credit; invoice credit versus a promise; a note awaiting invoice confirmation; an original date versus a proposed date. Service/report and agreement objects give the file list recognizable content. Source text, original titles, exact revisions, cutoffs, downloads and incidental review inclusions remain available on demand. No scan, sender, signature, external payment or accepted offer is invented.

| User requirement | Implementation and observed evidence |
| --- | --- |
| Graphics, less default prose | Illustrated document list and reading room; visual case reconciliation; shorter illustrated case rows and document previews replace excerpt cards. No raw fixture-text wall on arrival. |
| Meaning carried by the artwork | Real offer `$2,400 − $1,500 = $900 more`; note face remains distinct from matched portion; only a supported invoice application carries a confirmation mark. |
| Phone has a useful composition | Large objects recompose vertically; offer result, both dates and the actual case action precede the long artwork. Measured at 390×844: document action bottom293, offer result512, both dates540; case actions493–512. |
| Exact source and navigation | All nine real source IDs/revisions retained; original text/title byte comparisons and actual download; correct current amendment action, safe case fallback when no action exists; no latest-version substitution. |
| Error, history and recovery | Empty/filter recovery, unavailable exact source, earlier cutoff, all/current versions, failed refresh and retry, phone list→reader→Back focus and keyboard search operated. |
| Financial behavior remains usable | SQLite and browser-only credit register/apply/assign/reverse/fulfill and failed-write recovery; role separation, exact approvals, export replay and all main routes operated. |

Fresh independent review found and closed misleading confirmation marks, ambiguous offer arithmetic, proposal/acceptance labels, missing numeric alternative descriptions, reduced phone label size, excessive enclosing paper, results/actions below the first viewport, missing proposed date above the art and conditional-offer wording. The lead inspected the actual renders and repaired the initial case composition's empty column. Final scoped review reported no material remaining visual/comprehension findings in the inspected Documents/Cases states. This is not user approval or a blanket claim that every application surface is aesthetically finished.

The existing browser credit-list reload assertion sampled the loading state before its records mounted. The actual captured screen restored the list correctly; the check now waits for the real list and asserts both rows plus the cleared credit URL. No application behavior was weakened.

Current artifacts are local under `output/playwright/document-repair-*.png`, `case-graphic-*.png` and `visual-cases-index-*.png`. Wide1913, desktop1440, intermediate900 and phone390 were inspected. Source and actions remain real local records; illustrations do not create financial writes.

Validation for this correction: `npm run check` passed381 tests and its existing evaluations/build gates. The final browser records run passed297 named outcomes; managed workspace/claim/Office41, separate full-finance29, credit workflows42+36 SQLite and42+32 browser-only, and document/examples32 passed. Actual exported packets, CSV, exact source text and unsent email were independently reproduced by the existing verifiers. `pad finish --timeout300` was run and correctly refused whole-plan completion for the already deferred T9 and externally blocked native Figma T37; T53/T54 are complete for these local changes.

## Connected graphical workflow — T55/T56

The user called the graphical document pass only “slightly better,” requested more sustained application work, and explicitly set Figma aside. The current work extends the document/case language through actual Reviews, Credit notes, Companies, Needs attention and document intake. This is another implemented and reviewed application iteration, not a claim of user aesthetic approval.

- Reviews put the actual spending consequence and approval/recording controls before the illustration. Live comparisons use the current action calculation; recorded decisions retain their execution calculation and the terms that preceded that decision. Date-only changes remain date changes. A real decline records its reason, closes that offer, removes it from active files and retains it in the review selector/history. Keeping the current agreement, approving and recording remain distinct operations with actual role restrictions.
- Credit notes use a physical document, a separate invoice check and a conserved matching strip. Original note value, invoice credit amount, reversals, matched shares and unmatched remainder retain distinct meanings. A note is never illustrated as a reduced invoice without invoice evidence. Main case links precede the large illustration on phones.
- Companies share the same case and credit objects. Exact company/tab URLs survive selection; unavailable company targets have an explicit recovery state. Phone company files stay within the list and do not overlap the selected dossier. Tasks show the actual relevant documents and a missing-invoice place, with contextual instructions and real case/review destinations.
- Global Add documents opens a genuine new intake. Repeating it retains unfinished input. Local and managed saved reviews retain their exact unsaved source/message edits across intake and navigation; cancellation clears source edits. A successfully persisted analysis remains saved even if the subsequent read fails, and its old intake is consumed at the successful write rather than after that read.
- Local review A → new analysis B → edit B → Return restores B, its exact original source and its own message. Exact approved email exports now contain the original promise and invoice files, plus a reply when supplied, as MIME attachments. They preserve the approved body, source text, Unicode and original file line endings. No message is sent.

The independent review found material issues during this pass, including hidden financial blockers behind role restrictions, stale A/B return targets, misleading invoice amount labels, inaccessible alternatives, declined offers still looking open, a false attachment claim, and an overlapping phone company list. These were repaired and checked again. The new source-display and MIME tests cover the underlying state distinctions; browser actions and independently decoded/replayed downloads cover their integration.

Current evidence and exact final run counts are recorded below when integration finishes. The `output/playwright/product-*` artifacts retain the operated decline → keep agreement → separate approval/execution → invoice case → A/B analysis → approved unsent email journey. `scripts/verify-product-workflow.mjs` replays its financial history and document analyses independently; the standard Python MIME parser validates exported attachment bytes separately from the application encoder. All source text and version details remain available on demand. Figma and the old submission/video task are outside this iteration.

Final T55/T56 acceptance: `npm run check` passed388 tests, the existing authored evaluations and verification gates, and the production build. Operated browser outcomes:313 record/navigation/export checks across1440/900/390,55 managed account/document/claim/Office checks,26 connected product checks,29 separate backend checks,42+36 SQLite credit checks,42+32 browser-only credit checks, and32 document/example checks. Both product and whole-workspace verifiers passed against the actual downloads, including standard MIME parsing of exact attachment bytes. The separate backend verifier replayed the exact USD400 fulfilled promise. Independent review closed the material findings in its inspected scope; the lead inspected fresh review/credit/task/company/source renders and verified phone result focus at20.6px with the real $2,400/$900/$1,500 comparison. A redundant analysis-success toast was removed after it covered the phone next-step area.

The final whole historical pad audit still refuses completion for the earlier deferred submission/video T9 and external native-Figma T37. Current T55/T56 are complete for this local application iteration. Those old tasks do not hold up the explicitly authorized app work, and this iteration claims no public deployment or user aesthetic approval.
