# Truthful

**Follow the promise. Verify the money.**

Team OVO · BBS × Ramp Hackathon · technical prototype

## The user and the job

A finance operator is closing the month. A vendor’s account manager promised a correction in an email; the invoice has an adjustment with a different label. The operator needs to know what was promised, whether a condition changed, how much was actually applied, and what to follow up on.

Truthful keeps that case together. Its unit of work is a commitment with supporting evidence, not a chat answer or an unqualified “savings” number.

## The workflow

1. Preserve the original promise and its terms.
2. Attach evidence and determine the supported amount.
3. Match invoice-credit evidence to that commitment.
4. Surface the outstanding balance and any new condition.
5. Prepare a follow-up for human review.
6. Close the gap only when the application is supported by invoice evidence.

The interface keeps promised, issued, conditional, and applied states separate. It makes the source accessible at the decision point. Approval does not imply an external send.

## What this build demonstrates

The prepared Nimbus story calculates a $2,000 SLA claim from a covered nine-hour outage. A renewal counteroffer triggers review. A credit memo leaves verified savings unchanged until the next invoice applies it. Pipeline demonstrates partial fulfillment: $2,400 promised, $900 applied, $1,500 outstanding. Orbit illustrates an agent receiving an offer beyond its renewal authority; Parcel illustrates a future fee waiver.

The Evidence lab is the opening surface. It processes supplied promise text, a positive applied-credit CSV, and an optional vendor reply. This is not arbitrary gross-invoice understanding. It uses supported-format extraction, exact source citations, reference-based matching, and monetary arithmetic. Documents and cases included with the project are fictional. This is not a live recovery service, a universal contract reader, or a measured customer outcome.

## Architecture and implementation

React and Vite provide a compact, locally runnable workspace. Financial and evidence logic live in modules outside the UI. The generalized engine keeps money in nonnegative safe integer cents, refuses unsupported ambiguity, and requires normalized vendor, USD currency, and exact commitment-reference matching. Citations retain exact UTF-16 source ranges. Up to thirty cases persist in browser localStorage. Full evidence JSON contains original documents and hash-linked local audit events; CSV provides a summary. Reviewers can edit and approve a draft, then download an unsent `.eml`. Hashes verify internal consistency, not source authenticity or reviewer identity. There is no connected inbox, accounting writeback, live LLM, payment execution, or accepted renewal.

The narrow parser is a deliberate tradeoff: it makes supported outcomes explainable and reproducible. A future model can expand extraction coverage while leaving money math, evidence validation, and approval enforcement deterministic.

## Where this fits beside Ramp

Ramp already supports recording and applying vendor credits. Its Applied AI Solutions offering also advertises contract-to-invoice reconciliation and cited policy interpretation. Truthful should therefore be presented as a specific workflow experiment around the life of a conversational commitment, its changing conditions, and its eventual fulfillment—not as the invention of reconciliation. [Vendor credits in Ramp](https://support.ramp.com/vendor-credits-credit-memos-on-ramp-bill-pay/), [Ramp Applied AI Solutions](https://ramp.com/applied-ai-solutions).

Ramp’s agent-payment flows already act under connected users’ permissions. Our proposed complement is evidence about promises surrounding those purchases after the transaction. That integration is a design hypothesis; the Orbit fixture is not a live Ramp agent. [Ramp agent payments](https://docs.ramp.com/developer-api/v1/agent-payments).

## Success criteria

For this prototype: financial invariants hold, conditional offers do not become savings, unrelated credits do not match, source citations are inspectable, and changed supported input changes the result. Regression tests and a complete browser walkthrough provide the evidence.

For a pilot: measure false recovery claims, false application matches, operator review time, and incremental credits actually applied. Establish a baseline and avoid counting credits recovered by existing workflows. No customer recovery rate, accuracy percentage, or revenue claim has been established.

## Roadmap and gates

| Stage | Deliverable | Gate before expanding |
| --- | --- | --- |
| Current prototype | Prepared recovery story, supported-format evidence processing, local approvals, persistence, and export. | Financial tests, source inspection, and repeatable demo. |
| Finance-reviewed pilot | Permissioned historical examples, workflow interviews, independently labeled outcomes. | High precision on held-out cases and useful operator review time. |
| Connected read-only workspace | Authenticated storage and approved source adapters. | Verified scopes, source lineage, entity identity, access control, and deletion/retention behavior. |
| Model-assisted extraction | Schema-constrained proposed terms with validated citations. | Held-out evaluation, ambiguity handling, prompt-injection testing, and cost/latency evidence. |
| Controlled recovery actions | Approved outbound follow-ups and accounting handoff. | Scoped authority, actor identity, idempotency, immutable server audit, and reversibility. |

This brief describes a product direction and a bounded technical prototype. It does not claim that roadmap items are shipped.
