# Truthful

**Find the failure before the effect. Repair the workflow. Verify the authority.**

Team OVO · BBS × Ramp Hackathon · v4 technical prototype

## The job

A finance lead wants a promised credit honored without accepting an expensive renewal, counting the same credit twice, or letting an agent act on yesterday’s approval. The difficult cases involve independently changing sources, allocations, terms, clocks, and authority.

Truthful’s operator ritual makes a proposed next move inspectable before it commits: test a bounded plan, see a concrete failure, inspect a permitted repair, approve the current action, delegate narrowly, and verify what the trusted local boundary actually recorded.

## The product ritual

**Race explorer** executes finite scripted programs under their allowed interleavings. A deliberately naive reference caches a check; the guarded path rechecks through the real financial reducer. The same program/orderings produce an inspectable effect comparison. The explorer retains shortest unsafe prefixes and explicitly reports resource cutoffs.

**Repair** is a concrete permitted continuation, not a vague recommendation. Five unchanged authored families have deterministic repairs. They preserve declared roles and economic intents; completion is counted separately from rejected attempts. A deadline can still expire: one of the two repaired clock orderings finishes, and the other is correctly blocked. Custom JSON programs are supported for exploration/replay, with no invented automatic repair outside those families.

**Signed authority** binds an approved current action to an Ed25519 agent key, scoped claim/obligation limits, a lifetime, and one root nonce. The agent proves possession; the local service rechecks live state and atomically commits one simulated effect, nonce consumption, audit, receipt, and retry result. A child cannot expand authority. A valid signature does not bypass changed evidence, expiry, or revocation.

**Verification** uses a deliberately pinned public issuer root, supplied separately from the packet. It checks signed lifecycle/grants/requests and replays the actual financial action. Altering a checkpoint signature or effect fails verification. Offline success concerns recorded history, not present revocation or global unspentness.

## The financial foundation remains real

Portfolio and Decision room manage source-linked obligations, conserved shared credit lines, reversals, reasoned amendment conflict decisions, same-horizon renewal economics, historical effective/knowledge views, and exact-action approval. The Evidence lab revalidates supported promise text and positive credit CSV before atomic promotion to the portfolio.

The fictional Pipeline example still anchors the value: $2,400 promised, $900 applied, $1,500 outstanding. An annual renewal adds $2,400 under the explicit baseline for the remaining $1,500 benefit: negative $900 incremental value. No acceptance or preserved-original-terms action automatically becomes applied savings.

## Implemented mechanisms and their limits

| Mechanism | Implemented behavior | Limit |
| --- | --- | --- |
| Finite exploration | BFS over enabled actor orderings; shortest retained effect witnesses; full-history state identity; replayable packets. | Finite scripted programs and explicit resource bounds; no unbounded proof. |
| Repair | Fixed-family transformations with legitimate-completion accounting and preserved role/intent constraints. | Edited/custom plans receive no template repair; no LLM/general synthesis. |
| Signed execution | Real Ed25519 issuance/attenuation, agent possession, exact current basis, revocation/expiry, shared one-use root, signed receipt. | One local action; no external payment or vendor transaction. |
| Durable service | Optional real Node HTTP/SQLite with sessions, revisions, transactions, retries, audit, and authority lifecycle. | Selectable demo humans, loopback only; no production organizational identity. |
| Public browser mode | Local assurance portfolio plus independent ephemeral cryptographic lab workspace. | No shared backend; signing lab does not sign/modify the persisted portfolio and resets on reload. |
| Evidence/ledger | Exact supported source spans, stable invoice identity, shared allocation, ambiguity resolution, and causal reversal. | USD structured evidence, asserted source/line identity; no universal invoice understanding. |

The explorer and authority modules have targeted executable tests. Integrated checks have passed in actual SQLite and isolated production-preview browser modes, including real exported-packet verification. Exact acceptance and publication results are tracked separately in [DELIVERY.md](DELIVERY.md); older v2/v3 recordings do not demonstrate the new v4 ritual.

## Why this is a defensible direction

Agents paying invoices, signed permissions, negotiation automation, counterexample-guided repair, and source-linked credit recovery already exist. Visa/BILL/Billtrust announced a live pilot on October 20, 2026; an October 24 IETF draft distinguishes signed evidence from enforcement. Our case is the concrete integration of adverse economic schedules, legitimate completion, and a current-state execution boundary—not an unsupported first/only claim. [Frontier research](FRONTIER_RESEARCH.md), [competitive review](COMPETITIVE_RESEARCH.md).

## Trust and evaluation

All included sources, counterparties, scripts, and effects are synthetic local demonstrations. No live LLM, inbox, Ramp, vendor, or payment connector is connected. AI assisted development; deterministic code performs runtime checks. No AP2/UCP or receipt-draft conformance is claimed.

A signed record is stronger than a recomputable local hash only relative to a separately trusted signer. It does not authenticate a vendor invoice, independently anchor time, prove current revocation or global unspentness, or establish external settlement. A database/key owner remains inside the local trust boundary.

Evaluate unsafe effects, safe legitimate completion, false blocks, bounded-search coverage, repair dead ends, review effort, and incremental applied credit separately. The naive cached-check reference is a teaching baseline, not a competitor or language model. A pilot needs permissioned, independently labeled cases and a real operator baseline; no customer ROI or general model accuracy has been established.
