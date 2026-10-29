# Truthful · OVO

BBS × Ramp Hackathon, Round 2 · technical build

**A credit cannot be spent twice. An old approval cannot authorize a changed deal.**

## Actual submission requirements

The [Round 2 form](https://docs.google.com/forms/d/e/1FAIpQLSc1EeEuNDXVaiyJqjBFQK__b_oLcfZ4g6t5hpGkZI0s_AC_8A/viewform) was inspected read-only on October 28, 2026. Its prompt is: **“Automate an outdated financial workflow using the newest AI tools.”** Submit once per team by **November 10, 2026, 11:59 PM PT**. Finalists must present in person at Ramp’s San Francisco office on November 19.

The technical path requests:

- Team name, members’ names and emails, and the track selected in Round 1.
- Project name.
- A **public GitHub repository** containing no API keys.
- A demo video link on **Google Drive, Loom, or unlisted YouTube**, viewable by anyone with the link. A running website is useful supplemental material; the form specifically requests a video link.
- A **200–300 word** answer about architecture, tools, models, approach, tradeoffs, and what would change with more time.
- Confirmation of final-round attendance, team participation, one submission per team, organizer contact, and sign-in-free access to supplemental materials.

No response has been submitted. Attendance and teammate agreement require the team’s actual confirmation. Repository publication and video sharing must be verified using the final URLs before checking the access confirmations.

## Delivered links

- Public repository: https://github.com/Srujyama/truthful-ovo
- Live supplemental demo: https://srujyama.github.io/truthful-ovo/
- V3 assurance recording: https://github.com/Srujyama/truthful-ovo/releases/tag/v3.0.0 — actual decisions, historical replay, failures, and resolution.
- Earlier v2 backup recording: https://github.com/Srujyama/truthful-ovo/releases/tag/v2.0.0 — demonstrates the earlier recovery/evidence workbench, not the expanded v3 assurance workflow.
- Earlier v2 Drive video: https://drive.google.com/file/d/1ckSzoZlqrDPDLqCR5rA66YrvQA5WqZ5J/view — public-link access still needs verification; this is not a recording of the v3 assurance workflow.

See [delivery status](DELIVERY.md) before checking the form’s access and team confirmations.

## Form-ready project name

Truthful

Team: OVO. Confirm that the technical path matches the team’s Round 1 selection before submitting.

## Short description

Truthful tracks vendor promises through changing terms, shared credit allocations, and current authority. It prevents one recorded credit from funding two claims, blocks conflicting amendments and stale approvals, compares the real obligation behind a renewal concession, and exports the evidence and execution history. All external financial actions are simulated.

## Architecture answer — 260 words

Truthful replaces a spreadsheet-and-inbox workflow with a financial commitment assurance system. It asks whether a proposed action is still valid under the evidence, available credit, accepted terms, and current authority.

React and Vite provide Portfolio, Decision room, and Failure lab surfaces. A dependency-free JavaScript reducer records sources, commitments, amendments, credit allocations, reversals, policies, and exact-action approvals. Integer-cent accounting conserves each credit across commitments. Effective dates and observation times support historical projections without importing later knowledge. Conflicting amendment branches require a reasoned finance decision; a changed source, ledger, term, or policy invalidates pending approval. Renewal comparisons expose incremental cost separately from the headline credit.

The optional Node service uses built-in HTTP and SQLite. It derives demo actors from server sessions, enforces roles, checks optimistic revisions, commits command batches atomically, and persists idempotent responses. Hash-linked server audit records can be replayed to check snapshot consistency. They do not authenticate vendors or establish settlement finality. The public GitHub Pages build uses clearly labeled browser-local storage; it has no authoritative shared backend.

A supported-format evidence lab imports promise text and positive invoice-credit CSV with exact citations. Revalidated evidence enters the shared portfolio atomically; an invoice reference change cannot manufacture another credit line. Nine synthetic failure scenarios execute the real reducer rather than display canned verdicts.

We chose deterministic runtime checks for transparent financial behavior and reliable reproduction. AI assisted development, but no live language model is called. With more time, we would add authenticated organizational identity, consented connectors, and schema-constrained model proposals evaluated on independently reviewed evidence, while keeping financial and authorization checks deterministic.

## What the submitted build proves

| Capability | Executable evidence |
| --- | --- |
| Global allocation | A second allocation of the same $900 credit is rejected without increasing verified value. Ambiguous matches require source-backed finance resolution. |
| Competing amendments | Pipeline’s date change and renewal counteroffer conflict. Finance dismisses an alternative with a reason before a fresh action can accept the current branch. |
| Stale authority | Approve an exact action, revise a source or policy, then attempt execution. The old approval is rejected. |
| Renewal economics | $1,500 remaining contingent credit against $2,400 incremental annual spend yields negative $900 under the stated baseline. No acceptance creates applied savings. |
| Temporal truth | Effective-on and known-by cutoffs distinguish a late amendment’s retrospective effect from what was knowable earlier. Missing evidence remains unknown. |
| Ledger lifecycle | An issued memo contributes no verified savings. Invoice application verifies it; a reversal reopens the balance. |
| Durable local service | Real HTTP sessions, roles, atomic batches, optimistic concurrency, persistent idempotent results, and replayable SQLite audit. |
| Generalized input | In Evidence lab, change the matching credit from `900.00` to `1000.00`; the $1,500 gap becomes $1,400. Add supported evidence to the portfolio through a revalidated atomic import. |

The v3 failure suite has nine authored scenarios and thirty-one assertions. The assurance-domain test suite has thirty-eight tests at this documentation checkpoint. These are synthetic regressions, not a customer accuracy benchmark or formal proof. Integrated build/browser evidence and publication state are recorded separately in [DELIVERY.md](DELIVERY.md).

The evidence importer supports one positive credit row per invoice. The structured assurance API supports explicit invoice-line identities; neither infers arbitrary invoice semantics or authenticates supplied documents. There is no live inbox, vendor, payment, Ramp, or model connection. The older guided Nimbus recording remains an explanatory appendix rather than evidence of the new assurance features.

## AI prompt fit

The current runtime uses deterministic processing, not a live LLM. Do not present it as an autonomous AI recovery agent. Before submission, decide whether the honest AI-assisted-development interpretation satisfies the organizers’ prompt, or add and validate a real model extraction path. A proposed model integration is roadmap work until the code runs and its output is inspected. Do not claim a model, API, or integration merely because it appears in this document.

## Optional “anything else” response

We focused on correctness after an apparently successful negotiation: a credit cannot be counted twice, a changed deal cannot inherit an old approval, and an amendment cannot rewrite what was knowable earlier. The repository includes a runnable assurance engine, optional SQLite HTTP service, failure scenarios, and replayable evidence exports. All included counterparties are synthetic; no external email, payment, or renewal transaction is performed.

## Final publication handoff

Record the actual repository and video URLs in the submitted form after access checks. Do not substitute a private repository, owner-only Site, or local URL. Keep the original Round 1 response, project naming, architecture answer, and recorded behavior consistent. Use the wording above only if it still matches the final code.
