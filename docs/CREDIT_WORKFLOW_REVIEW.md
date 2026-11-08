# Credit fulfillment and changed-terms continuation

Implemented and verified November 6, 2026 Pacific (November 7 UTC). This is a local application continuation. Public v3 delivery, native Figma, videos, and submission decisions retain their separately recorded status.

## What the operator can do

From a selected commitment, **Shared ledger → Record credit** records a supplied issued memo or applied invoice line. Vendor, currency, and commitment reference are fixed to that case. An explicit invoice/memo reference and line identity distinguish physical credits. Optional partial attribution conserves unused capacity. Each operation first projects the actual reducer result, then confirms the reviewed atomic batch against the service revision.

Existing lines expose attribution, invoice application, and reversal. Invoice application uses the same credit identity. A reversal consumes unallocated value first and requires exact explicit attribution removals for the remainder. Credit evidence includes the original memo, application, attribution, and reversal sources with their bound revisions. The graph now retains optional attribution-source links; old commands without those links remain replayable.

**Propose changed terms** authors selected amount, due-date, deadline, and condition changes, or a renewal obligation with an explicit baseline and incremental cost. A renewal-only proposal explicitly retains the existing promise amount. Source, proposal, and exact review action record together. Preparing or approving a proposal does not change binding terms; an authorized executor must record the approved action. The financial summary shows a changed accepted promise while preserving the original amount.

## Requirement-to-evidence record

| Requirement | Observed evidence |
| --- | --- |
| Start from a real imported case | The browser imports Northstar Review, reference NR-CREDIT-2026, with a $350 promise and a header-only credit CSV. No applied credit is invented. |
| Distinguish issuance from application | A $300 issued memo with $100 attributed leaves verified value at $0. Separate invoice evidence applies the same line; only its $100 attribution becomes verified. |
| Conserve partial capacity | A $200.01 attribution is refused against $200 remaining. A current analyst attributes exactly $200, leaving the original promise $50 outstanding. |
| Remove causal backing precisely | A $150 reversal removes $50 and $100 from the two explicit attributions. Verified value becomes $150; outstanding value becomes $200. |
| Preserve original terms and separate authority | An analyst authors a $400 promise proposal. An approver approves it; an executor records it. Applied value remains $150, outstanding becomes $250, and the summary retains the $350 original. |
| Finish through product controls | Further applied credits of $10 and $240 fulfill the accepted $400 promise. The completed case remains closed after reload in both runtimes. |
| Refuse duplicates and incomplete writes | Duplicate physical invoice-line identity is refused. A simulated HTTP 503 leaves no orphan credit or allocation, preserves the evidence draft, and requires another preview. Double-clicking confirmation produces one service batch. |
| Discard stale reviews | Editing input or changing role, actor, workspace, or historical mode discards a preview. Returning to the prior role does not revive it. Reducer guards and server optimistic revision checks still authorize the actual write. |
| Preserve temporal meaning | Browser historical replay excludes later credit facts and disables writes. Domain checks cover independent knowledge cutoffs, future dates, and causal reversal boundaries. |
| Show actual mandate refusal | A same-credit renewal-only proposal exposes the new-commitment and incremental-cost policy refusals without accepting the obligation. |
| Keep evidence portable | Six real browser-downloaded lifecycle, amended, and completed packets independently replay. Both runtimes agree on exact identities, amounts, source graph edges, approval roles, and completion. |
| Work across widths | Actual 1440px, 390px, and 900px interfaces inspected. Normal 900px top/editor captures replace an unreliable full-page compositor capture. No clipping or document overflow observed in the checked states. |

## Verification

- `npm run check`: 202 automated tests, authored evidence/assurance evaluations, financial replay, authority/frontier verification, and production build pass.
- `browser-credit-workflow-check.js`: 36 rendered assertions in SQLite mode and 36 in the production browser-local build.
- `browser-credit-recovery-check.js`: seven SQLite failure/retry/completion assertions and three browser-local completion assertions.
- The updated pre-existing `browser-assurance-check.js` passes 27 assertions in each runtime, retaining seeded review, changed-source invalidation, historical exports, application/reversal, failure lab, atomic fulfillment, import, and mobile checks. Its fixed November 1 schedule expectation now accounts for the actual current date. Together the new and retained journeys pass 136 browser assertions.
- `npm run verify:credit-workflows`: independently replays all six downloaded packets and checks the resulting balances, source graph, and distinct approval/execution roles against real browser reports.
- Independent source review found renewal-only no-op rejection and optional reversal-field correction issues; both were repaired with domain regressions. A later source and visual review returned a ship verdict, including the repaired intermediate-width capture.
- Mechanical design review produced advisory token/ramp findings; controls use the existing control-rule color and preview figures use the 17px title step. The 15px working headings sit within the existing documented 13–16px panel range. The devibe check found no findings in the new UI files.

Local verification logs and packets live under ignored `output/`. The meaningful packet assertions are implemented in [verify-credit-workflows.mjs](../scripts/verify-credit-workflows.mjs), not inferred from file existence or a test count.

To reproduce, open the running application with the Playwright CLI, then use `run-code --filename scripts/browser-credit-workflow-check.js`. Run it against the local service and a production static preview. Copy downloaded `credit-{lifecycle,amended,completed}.json` files to `{server,browser}-credit-{lifecycle,amended,completed}.json` before switching modes. Save CLI reports as `output/credit-browser-{server,static,recovery,browser-completion}.log`. The recovery script uses the imported case from the first script; run it after that journey in each mode. Run the retained assurance script in both modes and save `output/credit-preserved-{server,static}.log`. `npm run verify:credit-workflows` then verifies those actual artifacts.

## Boundaries

The forms record supplied structured USD evidence. Source text is retained, not independently authenticated or semantically certified against every entered amount. No vendor, inbox, invoice provider, payment system, or live model is connected. Demo roles are selectable identities; only local-service mode enforces those roles on the server. Browser mode is localStorage-backed. Hashes and deterministic replay establish internal consistency, not issuer truth or settlement finality.

This record describes the November 6 milestone. The later [workspace expansion](WORKSPACE_EXPANSION.md) adds an analyst/approver resolution form with explicit source-backed limits. Ambiguous matches remain quarantined until that reviewed assignment; no form guesses ownership. General legal interpretation, arbitrary document/OCR ingestion, renewal cancellation, and native Figma representations of the new form states are not claimed.
