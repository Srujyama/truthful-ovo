# Truthful · OVO

BBS × Ramp Hackathon, Round 2 · technical build

**A vendor promise is not a saving. Truthful follows it until the credit reaches an invoice.**

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

## Form-ready project name

Truthful

Team: OVO. Confirm that the technical path matches the team’s Round 1 selection before submitting.

## Short description

Truthful turns vendor concessions into evidence-backed recovery cases. It preserves the original promise, calculates what is still owed, flags new conditions, prepares a follow-up for human approval, and counts a credit only after matching its application to an invoice.

## Architecture answer — 254 words

Truthful replaces a spreadsheet-and-inbox workflow: remembering a vendor concession, chasing the missing credit, and checking whether it reduced a bill.

React and Vite power two complementary surfaces. The guided Nimbus case demonstrates the full recovery lifecycle. The evidence lab processes supplied promise text, a documented invoice-credit CSV, and an optional vendor reply through a dependency-free JavaScript engine. It extracts supported terms with exact source citations, uses nonnegative integer cents, and matches credits by normalized vendor, USD currency, and exact commitment reference. Dates, duplicates, and unsupported ambiguity are checked before attributing savings.

A separate recovery module snapshots each report and links local audit events with SHA-256 hashes. Reviewers can edit a follow-up, approve its exact text, and download an unsent email draft. Evidence JSON includes the original documents, report, and audit chain; a CLI verifies internal hash consistency. This does not authenticate the vendor, invoice, or reviewer. Up to thirty cases persist in browser localStorage, with no backend or account credentials.

We chose deterministic runtime logic for the financial core: narrow supported formats make behavior transparent, reproducible, and testable. The prototype does not call a live language model or understand arbitrary invoices. AI-assisted development is distinct from runtime AI. That tradeoff limits extraction coverage while preserving a reliable demonstration and an inspectable financial boundary.

With more time, we would validate schema-constrained model extraction against finance-reviewed held-out cases, add consented read-only connectors, and move storage and approval identity to an authenticated service. Deterministic reconciliation, citation checks, and explicit action approval would remain separate from model-generated proposals.

## What the submitted build proves

| Capability | Evidence to show |
| --- | --- |
| SLA calculation | Nimbus: 540 minutes of covered downtime in 43,200 minutes; 98.75% availability; 25% of $8,000 is $2,000. |
| Partial fulfillment | Pipeline: $2,400 promised, $900 applied, $1,500 outstanding. |
| Changed obligations | A later annual-renewal condition stays visible and contributes no new verified savings. |
| Application versus issuance | Issuing the Nimbus credit memo leaves verified savings unchanged; applying it to the next invoice changes the total. |
| Generalized processing | In Evidence lab, load Partial credit, analyze, change `900.00` to `1000.00`, and analyze again: the balance becomes $1,400. Wrong reference yields $0 applied. |
| Evidence and authority | Inspect exact citations, edit and approve a follow-up, export full evidence JSON or CSV, and download an unsent `.eml` draft. |

The first four rows are a prepared scenario with real calculations. The evidence lab processes user-provided inputs within its supported format. CSV input is a positive credit ledger, not a parser for arbitrary gross invoices. Source indices are JavaScript UTF-16 offsets. Saved cases restore analyzed reports and approved drafts after reload; unanalysed input edits invalidate the displayed result. All included vendors and documents are synthetic. Test fixtures are authored regression cases, not a representative customer benchmark.

## AI prompt fit

The current runtime uses deterministic processing, not a live LLM. Do not present it as an autonomous AI recovery agent. Before submission, decide whether the honest AI-assisted-development interpretation satisfies the organizers’ prompt, or add and validate a real model extraction path. A proposed model integration is roadmap work until the code runs and its output is inspected. Do not claim a model, API, or integration merely because it appears in this document.

## Optional “anything else” response

We focused on the point where an apparently successful negotiation becomes a verified financial outcome. The included examples are synthetic. The repository distinguishes prepared scenario replay from document processing, includes financial, extraction, reconciliation, approval, and integrity tests, and documents the boundaries of local storage and supported extraction. No emails are sent and no payment or renewal is accepted by the prototype.

## Final publication handoff

Record the actual repository and video URLs in the submitted form after access checks. Do not substitute a private repository, owner-only Site, or local URL. Keep the original Round 1 response, project naming, architecture answer, and recorded behavior consistent. Use the wording above only if it still matches the final code.
