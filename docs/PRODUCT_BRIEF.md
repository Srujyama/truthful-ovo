# Truthful

**A credit cannot be spent twice. An old approval cannot authorize a changed deal.**

Team OVO · BBS × Ramp Hackathon · v3 technical prototype

## The job

A finance lead has to turn a vendor’s promise into a defensible outcome. The hard cases span several records: a partial credit, another claim with the same reference, a later amendment, a renewal condition, and an approval issued before the evidence changed.

Truthful makes the next decision explicit: what is still owed, which terms apply, which credit is available, and whether the proposed action is still authorized. Its unit of work is an evidence-backed commitment with changing state, not a chat answer or an unqualified savings number.

## The product

**Portfolio** shows obligations beside a shared credit ledger, deadlines, source revisions, amendment proposals, and an inspectable evidence graph. Effective-on and known-by dates separate what applied from what was knowable. Historical comparisons are read-only.

**Decision room** binds approval to the exact proposal and its evidence, ledger, term, and policy basis. A changed basis invalidates pending approval. Competing amendment branches require a finance decision with a retained reason. Execution rechecks the current basis and records one local action.

**Failure lab** runs nine authored adverse scenarios through the actual reducer. Duplicate allocation, late evidence, stale approval, ambiguous references, reversals, deadlines, issuance versus application, negative renewal economics, and competing branches produce inspectable effects and expected rejections. An advanced console also accepts structured commands or atomic batches against the open workspace.

The **Evidence lab** remains a working entry path: paste or import supported promise text and positive invoice-credit CSV, inspect exact citations, then Add to portfolio. The import revalidates original documents and commits sources and financial facts atomically. It does not carry over authority from an earlier email-draft approval.

## The case that explains it

Pipeline CRM promised a fictional $2,400 correction. Only $900 reached an invoice, leaving $1,500. The same $900 cannot fund another claim. A date amendment and a renewal alternative conflict, so neither silently replaces the original agreement.

The renewal offers that remaining $1,500 in exchange for $2,400 extra annual spend under an explicit same-service baseline: $6,200/month instead of $6,000/month over twelve months. That yields negative $900 incremental value. This is a scenario calculation, not a forecast, market benchmark, or verified alternative offer.

The finance lead can preserve the original claim, dismiss a competing alternative with a reason, and review a fresh current proposal. If the evidence or mandate changes after approval, the old action is unusable. When an invoice applies a credit, verified value increases once. If the credit reverses, the balance reopens.

## What is implemented

| Mechanism | Current behavior |
| --- | --- |
| Shared allocation | Global credit-line capacity, exact identity, ambiguity quarantine, explicit resolution, partial allocations, and causal reversals. |
| Versioned obligations | Proposed, accepted, dismissed, stale, competing, and explicitly superseded schedule changes retain lineage. |
| Temporal replay | Independent financial effective and observation cutoffs; no feed-completeness claim. |
| Authority | Analyst/approver/executor/viewer roles, exact-action approval, current-policy recheck, and one-use local execution. |
| Economics | Contingent credit, incremental obligation, explicit baseline, and editable comparison assumptions remain separate from applied savings. |
| Local service | Real Node HTTP and SQLite with sessions, role enforcement, atomic batches, revisions, durable retries, and hash-linked replay. |
| Static public demo | Same reducer in a clearly labeled browser workspace; no authoritative shared backend. |
| Evidence entry | Bounded USD text/credit-ledger input, exact source spans, safe invoice identity, atomic portfolio import, and separate report/draft exports. |

At the documentation checkpoint, the assurance suite has thirty-eight tests and nine authored scenarios with thirty-one checks. These counts cover that domain suite, not an independent extraction benchmark or all application tests. Publication and integrated acceptance evidence are tracked by the lead in [DELIVERY.md](DELIVERY.md).

## Fit beside existing products

Ramp already records/applies credits and advertises contract-to-invoice reconciliation. Ardina describes source-linked supplier-credit recovery and amendment updates. Vertice Ana covers negotiation strategy and forecasts. Our case for differentiation is an inspectable, executable assurance workflow across adverse state changes—not that credit recovery, graphs, or agent guardrails are new. [Primary-source competitive review](COMPETITIVE_RESEARCH.md).

## Boundaries

All included counterparties and documents are synthetic. External emails, renewals, purchases, and payments are not performed. No live model, inbox, or Ramp integration is connected. AI assisted development; the financial runtime is deterministic.

The optional service enforces roles for selectable local demo identities, not verified employees. Hashes/replay prove internal consistency relative to the record, not vendor authenticity, independent time, or settlement finality. The evidence importer supports a positive credit ledger with one row per invoice; the structured API supports explicit credit-line identities. Neither is universal invoice understanding.

## Validation and next gates

The implemented acceptance focus is financial conservation, safe state transitions, correct historical projections, legitimate progress after a block is resolved, and reproducible traces. A pilot would use permissioned, independently labeled cases to measure unsafe effects, false blocks, review effort, and incremental credits actually applied against the existing workflow.

Next product gates are verified organizational identity, consented read-only source adapters, independent audit retention, and finance-reviewed held-out evaluation. Model-assisted proposals can expand coverage only behind schema, citation, financial, and authority checks. Outbound actions need separately scoped permissions and integration tests. No customer ROI or market-wide recovery estimate has been established.
