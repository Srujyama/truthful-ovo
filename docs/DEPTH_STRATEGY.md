# Depth strategy: financial commitment assurance

This strategy was prepared October 29, 2026 and reconciled with the implemented v3 assurance engine, optional HTTP/SQLite service, importer, and UI. The earlier parser remains the evidence entry path. The current domain checkpoint has thirty-eight tests and nine authored scenarios with thirty-one checks. Integrated browser/build/publication evidence remains the lead’s responsibility in [DELIVERY.md](DELIVERY.md).

## The coherent wedge

Make one question the product: **“Can we still take this action, and what evidence makes the answer true?”**

The answer must account for the binding promise, its amendments, which credits remain available, what the operator knew at the time, the full economics of any new obligation, and the authority available now. A finance operator gets a decision queue; an engineer gets an executable state machine and a reproducible failure trace.

The strongest demonstration is not another credit found. It is an apparently attractive recovery that the system correctly refuses: the credit was already allocated, the terms changed, or the claim window expired. The same case must later progress when the right evidence and authority arrive.

Credit lifecycle automation, source-linked records, agent guardrails, and temporal reasoning already exist in products and research. Our case for differentiation is the integrated, inspectable behavior under adverse events. See [competitive research](COMPETITIVE_RESEARCH.md).

## Implemented v3 status

| Mechanism | Actual implementation | Remaining boundary |
| --- | --- | --- |
| Evidence entry | Supported USD text/credit-ledger extraction, exact UTF-16 spans, revalidated atomic Add to portfolio. Stable one-credit-per-vendor-invoice legacy identity prevents reference aliases. | Not arbitrary invoice/OCR understanding or authenticated issuer data. |
| Obligation branches | Source/version-bound proposals, incompatible-branch quarantine, reasoned finance dismissal, accepted-term staleness, and explicit supported future-schedule supersession. | No universal legal interpretation or accepted-renewal cancellation. |
| Global credit | Shared capacity across commitments, exact identity, ambiguity resolution, partial allocation, invoice application, and causal reversals. Future financial recording is refused. | Credit-line identity is asserted by an adapter; verified attribution is capped by the promise, with excess separately observable. |
| Temporal views | Effective-on and known-by projections, recomputed deadlines, and read-only historical UI. | No external source-completeness or settlement-finality guarantee. |
| Current authority | Canonical action/policy/evidence/term basis, proposal/approval/execution phases, conservative invalidation, and one-use local execution. | Selectable demo roles, not organizational identity; no real vendor action. |
| Economics | Explicit baseline, contingent remaining credit, incremental renewal cost, effective/future obligations, and editable what-if comparison. | Baseline is an assumption; no customer ROI or comprehensive tax/FX/service valuation. |
| Execution evidence | Nine real reducer scenarios and structured command/atomic batch console; graph lineage derives from the event model. | Authored regressions, not held-out model accuracy or formal proof. |
| Durable boundary | Optional loopback HTTP/SQLite service with session role context, revisions, transactions, persistent retries, audit hashing/replay. | Public GitHub Pages is browser-local fallback; hash consistency does not prove authenticity. |

The integrated mechanisms are described in [TECHNICAL_DEEP_DIVE.md](TECHNICAL_DEEP_DIVE.md). The concrete acceptance workflow and current controls are in [DEMO_SCRIPT.md](DEMO_SCRIPT.md).

## One operator workflow

The finance lead opens an exception, sees the original commitment and the partial credit, and inspects the proposed next action. The workspace identifies whether the case is ready, disputed, waiting for evidence, scheduled, or blocked by authority. A compact explanation states the failing check and the specific evidence or approval needed.

The operator can inspect a graph or history when needed. The graph reflects the records that drive calculations and invalidation: source supports version; amendment supersedes version; credit allocates to obligation; approval authorizes exact proposal; policy revision invalidates approval. Its lineage is emitted from the same event model rather than maintained as a separate decorative state.

Imported documents are evidence, not commands. A model, if later connected, may propose structured facts or actions; deterministic checks decide whether they are admissible. The current build has no runtime LLM or live financial connector.

## The implemented adversarial case

The fictional Pipeline correction and the executable Failure lab carry this story. The hero script uses current controls; independent scenario runs start from their own seed rather than silently mutating the open portfolio.

1. **Original truth.** A $2,400 correction has $900 applied, leaving $1,500. A separate commitment also appears eligible for the same credit line. Allocate the actual $900 once. Show the second attempted allocation blocked; separate dashboards must not create another $900.
2. **Conflicting change.** Two amendments cite the same predecessor and disagree about amount or date. Preserve both as evidence and hold the binding interpretation for review. A later email is not automatically a mutually accepted amendment.
3. **Late knowledge.** An amendment effective earlier arrives later. Replay the view before its arrival and the current view with the amendment. The operator can explain both without pretending the earlier operator knew the future.
4. **Misleading deal.** The vendor offers the remaining $1,500 only with a twelve-month renewal at $6,200 per month. Compare with an explicitly supplied twelve-month $6,000/month baseline: $74,400 gross commitment − $1,500 one-time credit = $72,900, versus $72,000 baseline. That is $900 more outlay under these assumptions, not $1,500 of new savings. The baseline is an illustrative decision assumption, not a verified alternative offer or customer outcome.
5. **Authority changes.** A reviewer approves a precise original-terms follow-up. Then amend the obligation or change the governing policy. Attempting execution with the old approval must fail. Rechecking at the action boundary is the feature.
6. **Legitimate completion.** A current reviewed proposal permits a safe modeled action. The command-console batch can record and allocate a separate $1,500 invoice credit atomically, closing Pipeline once with the evidence in the export.

The renewal comparison is intentionally simple: same currency, horizon, service quantity, no tax, no discounting, and one credit. A production comparison requires explicit assumptions about alternatives, cancellation rights, seat usage, tax, timing, and uncertainty. Do not silently equate lower invoice cost with incremental savings.

## Temporal semantics that deserve the name

`effectiveDate` answers when a financial fact applies. `observedAt` answers when the system received it. An `asOf`/`knownAt` projection answers what could be concluded at both cutoffs. A late amendment can update the current projection while preserving a prior knowledge view. This follows established bitemporal design, rather than inventing a new temporal concept. [Bitemporal history](https://martinfowler.com/articles/bitemporal-history.html).

A separate question is whether absent evidence is final. A posting stream may be incomplete. Without a declared source-completeness horizon or lateness bound, label a missing application “not observed” or “awaiting evidence,” not a settled financial loss. The current build implements bitemporal replay, not streaming temporal completeness. [Temporal reconciliation preprint](https://arxiv.org/abs/2610.14470).

## Three-minute technical demo

The current hero sequence and actual controls are specified in [DEMO_SCRIPT.md](DEMO_SCRIPT.md): Portfolio gap, negative renewal economics, reasoned branch dismissal and fresh exact-action approval, a two-cutoff temporal comparison, executed stale-approval and duplicate-allocation failures, an atomic legitimate application, and export. Failure-lab scenarios use independent seeds; the advanced command console deliberately mutates the open workspace.

Every number and gate in the recording must execute. Counterparties and external effects are simulated. The existing v2 recording is older explanatory material and is not evidence that the v3 mechanisms were recorded.

## Engineering acceptance and evaluation

The primary score is the resulting financial state and authorized effects. A convincing explanation cannot compensate for an overallocated credit or stale action. This follows the useful evaluation principle of checking actual database outcomes, rather than just dialogue, in [τ-bench](https://arxiv.org/abs/2406.12045).

| Requirement | Observable assertion |
| --- | --- |
| Conservation | Sum of allocations to a credit never exceeds its remaining capacity. Issued allocations reserve capacity but verify nothing; attributed verified value is capped by the accepted promise. Repeated commands cannot create value. |
| Isolation | Vendor, USD currency, reference, and ledger-line identity checks constrain allocation. Multiple legal entities are not separately modeled; unsupported identity mappings require review. |
| Amendments | Only valid accepted revisions change binding terms. Conflicting branches hold the case. A rejected amendment leaves totals and valid versions intact. |
| Temporal replay | Same event log and cutoffs give the same projection. Events not yet observed are absent from earlier knowledge views; later knowledge does not rewrite the recorded past. |
| Action freshness | Changed obligation, evidence, ledger, or policy invalidates affected approval; claim deadlines are rechecked at execution. There is no separate employee-grant revocation or approval-TTL model. |
| Legitimate progress | A fresh valid proposal can succeed after the block is resolved; safety cannot mean rejecting every action. |
| Reversals | A reversal is a new traceable event, restoring the proper available capacity without deleting history or double-releasing value. |
| Economics | One-time credit and new term cost use one declared horizon; baseline assumptions are visible; the original correction is not counted again as new negotiation savings. |
| Replay/export | Export contains the source/event lineage and enough schema/version information to reproduce supported projections and explain each block. Integrity hashes are not authenticity proofs. |
| Hostile evidence | An instruction embedded in source evidence cannot directly create approval, allocation, or an external action. Future LLM integration requires its own tests. |

Use authored scenario suites and seeded event-sequence tests for development. Label them regression tests, not independent accuracy. A deliberately naive baseline can demonstrate known failure modes only if its behavior and assumptions are published; do not call it “GPT,” “Ramp,” or a competitor without running that actual system under a fair, documented comparison.

If runtime model proposals are added, log provider/model/version, prompt/schema, tool budget, costs, failed/refused tasks, and repeated-trial effect correctness. Keep DEV scenarios separate from independently reviewed held-out cases. Report unsafe-effect rate, successful legitimate completion, false blocks, conservation violations, temporal-view correctness, and review effort separately. Do not hide refusal rate inside one accuracy number.

A pilot would measure incremental credits actually applied and operator effort against the existing workflow. No customer ROI, recovered dollars, or benchmark improvement is established by this plan.

## Hard objections and the answer the build must earn

**“This is a rules engine with a graph.”** Yes, the financial safety core should be deterministic. The difficult part is that rules must hold across independent obligations, revisions, late events, and changing authority. Prove those cases with executable effects; do not sell the graph as the breakthrough.

**“Ardina or Ramp could do this.”** They already cover substantial neighboring workflows. We have not inspected their internals. Our hackathon contribution is a small, inspectable implementation and a compelling correctness demonstration, not a claim of an uncontested market. [Competitive matrix](COMPETITIVE_RESEARCH.md).

**“Why not just ask an LLM?”** A model may help interpret evidence, but it does not make one credit spendable twice or make a stale approval current. Keep interpretation separate from conservation and execution checks.

**“Are these proofs?”** Ordinary invariant tests and runtime preconditions are not formal proofs. Existing research already explores proof-checked agent operations and formally verified invoice lifecycles. Describe our actual verifier and trust boundary precisely. [Proof-Carrying Contracts](https://arxiv.org/abs/2610.28484), [verified invoice lifecycle](https://arxiv.org/abs/2609.37819).

**“Does the export prove the vendor agreed?”** It proves consistency relative to the included evidence/events and implemented checker. Authentic identity, external settlement, nonrepudiation, and independent record retention need real trust infrastructure.

**“What makes this a useful product?”** A finance lead must be able to understand the block, resolve it, and finish the legitimate job with less review effort than the current workflow. That must be tested with operators. Engineering sophistication alone does not establish demand.

## Status reconciliation

The conflict-quarantine target is implemented, including retained dismissal and intrinsically stale amendment bases; it is no longer a future-work item. The optional service is also implemented and independently exercised through ephemeral HTTP/SQLite checks. Verified organizational identity, live source/model connectors, independent audit anchoring, and finance-reviewed held-out evaluation remain distinct product gates. This strategy does not replace the lead’s integrated acceptance or publication record.
