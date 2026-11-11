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

- Public repository: https://github.com/Srujyama/truthful-ovo (the build below is on branch `craft/isokra` until it is merged)
- **Live app (this build): https://truthful-ovo.vercel.app** — opens on Truthful's quarter; add `?demo` for the guided two-minute walkthrough (https://truthful-ovo.vercel.app/?demo#/). Browser-only demo book; nothing is sent anywhere.
- Older GitHub Pages build (v3): https://srujyama.github.io/truthful-ovo/
- Demo video (2–3 min): _add the Drive / Loom / unlisted YouTube link here once uploaded._

See [delivery status](DELIVERY.md) before checking the form’s access and team confirmations.

## Form-ready project name

Truthful

Team: OVO. Confirm that the technical path matches the team’s Round 1 selection before submitting.

## Short description

Vendors promise credits by email; invoices forget them. Truthful reads every promise and every invoice, writes each promise down as an IOU, weighs each invoice against it, and drafts the letter asking for what is still owed. Nothing goes out until a person approves it. The engine refuses a credit spent twice, an approval for a changed deal, and an offer with strings counted as money.

## Architecture answer — 283 words

Truthful automates the spreadsheet-and-inbox chase for vendor credits: a promise arrives by email, invoices arrive monthly, and someone has to notice what never showed up.

The core is a dependency-free JavaScript event-sourced engine. Every paper, promise, credit, amendment, decision and approval is an event; integer-cent reducers project what is owed as of any date and as known at any moment. Invariants are enforced on every command: a credit is conserved across promises, a changed source or policy invalidates pending approvals, competing amendments need a reasoned decision, and an offer with strings never counts as money. A deterministic reader turns pasted emails and invoice CSVs into facts with exact citations, so every figure links back to its words.

The interface is React and Vite. Each page leads with its answer (“$3,850 still owed”) in one printed design system; each $100 of a promise is a pixel coin that turns over when an invoice pays it. The cover is a voxel quarter, drawn by our own zero-dependency renderer, where the pipeline’s stages appear as agents: a courier brings a paper, the reader marks the figure, the scribe writes the IOU, the checker weighs the invoice on a scale, the writer drafts the letter, and it waits on your desk. The replay is generated from the book’s real event log.

An optional Node service adds HTTP, SQLite, roles, atomic batches and idempotency. The public build runs entirely in the browser.

Tradeoff: we kept extraction and money logic deterministic so behaviour is reproducible and auditable; no live language model runs. AI tools built and reviewed it. With more time: a schema-constrained model reader for arbitrary invoices, checked by the same engine, plus inbox and Ramp bill connectors.

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
