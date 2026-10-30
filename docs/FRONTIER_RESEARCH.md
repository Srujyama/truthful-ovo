# Frontier research: from authorized intent to financial effect

**Research cutoff: October 29, 2026, Pacific time.** Primary product announcements, release records, specifications, and paper records were opened directly. Publication dates below are the dates reported by those sources; arXiv submission/revision times are UTC. The papers’ reported experiments were not reproduced here.

This document concerns **Truthful in `BBS_hack_ramp`**. The neighboring `Randomprojects/ramp` project is a different project. Its Datalog gate, code, and decisions are not implementation evidence for Truthful and must not be copied or modified as part of this work.

## The conclusion

The credible frontier is a product ritual that makes a financial plan earn permission to run:

**Find the shortest explored schedule that breaks the intended outcome → repair the explicit plan and complete the goal → delegate only the exact current authority → verify the committed local effect from a separately trusted root.**

This combines financial fulfillment, changing evidence/authority, bounded adverse scheduling, and verifiable execution records. It does not make invoice payment, signed mandates, counterexample-guided repair, or deterministic policy enforcement newly invented ideas.

The **v3 financial baseline** and **v4 explorer, fixed-family repair, and signed delegated execution modules are implemented** in this repository. The inspected source includes BFS over full histories, reproducible effect witnesses, explicit partial completion, strict Ed25519 delegation, and an atomic SQLite effect boundary. This research document does not assert a new published release or aggregate browser/test count: those require the lead’s integrated acceptance and [delivery record](DELIVERY.md). Source inspection and component checks are distinguished below from production, protocol-conformance, and real-world outcome claims.

## 1. The market moved beyond agent-payment demos

On **October 20, 2026**, Visa, BILL, and Billtrust announced a live pilot in which an authorized BILL payment agent completes approved invoice payments through participating Billtrust supplier portals. The release describes authenticated agents, tokenized credentials, controls linked to buyer instructions, and transaction visibility. This is a provider report of a live participating pilot, not proof of general availability or independently measured reliability. [Visa announcement](https://visa.gcs-web.com/news-releases/news-release-details/visa-bill-and-billtrust-launch-first-live-pilot-trusted-ai-agent).

**Implication for Truthful:** “An agent can pay an invoice” is an insufficient differentiator. The narrower question is whether a particular proposed credit/recovery/renewal action remains justified after the evidence, allocation, or authority changes—and whether the resulting economic effect matches the permission. This is our product inference, not a claim that the pilot lacks such controls.

The existing [competitive review](COMPETITIVE_RESEARCH.md) also documents Ramp reconciliation, Ardina’s supplier-credit lifecycle, and Vertice’s negotiation capabilities. We have not inspected their internals and cannot infer the absence of equivalent checks from marketing pages.

## 2. Current protocol taxonomy, checked against primary sources

These are context for a possible future adapter. **Truthful does not claim AP2, UCP, MCP, A2A, or the receipt draft conformance.** Similar field names or Ed25519 signatures are insufficient to establish interoperability.

| Source and date/version | What the primary source establishes | How to discuss it accurately |
| --- | --- | --- |
| **AP2 v0.2.0**, released **April 28, 2026**. [Release](https://github.com/google-agentic-commerce/AP2/releases/tag/v0.2.0), [specification](https://github.com/google-agentic-commerce/AP2/blob/main/docs/ap2/specification.md). | The current inspected specification uses **Checkout Mandate** and **Payment Mandate**, linked to checkout content, with deterministic verification responsibilities. The release emphasizes human-not-present flows. | Do not reuse the older Intent/Cart taxonomy as the current schema. Our exact-basis local delegation is a separate mechanism, not an AP2 implementation or a replacement payment protocol. |
| **UCP 2026-08-25**. [Versioned specification](https://ucp.dev/2026-08-25/specification/overview/), [official repository](https://github.com/Universal-Commerce-Protocol/ucp). | Versioned discovery/profiles, capabilities/extensions, checkout/payment integration, and order/fulfillment concepts. Shopify announced support for this profile version September 4. [Shopify changelog](https://shopify.dev/changelog/posts/08-25-is-now-supported). | UCP already has order/fulfillment concepts. Do not claim that standards stop at checkout or that Truthful invents post-purchase tracking. Our wedge is financial obligation consistency under specific adverse changes. |
| **MCP 2026-07-28**. [Specification](https://modelcontextprotocol.io/specification/2026-07-28), [dated release post](https://blog.modelcontextprotocol.io/posts/2026-07-28/). | The inspected core describes stateless, self-contained requests and per-request capability negotiation for exposing context/tools; optional extensions are separate. | Do not assume the older session-handshake architecture is the current core. A future tool adapter still needs application-level financial authorization and effect checks. No MCP server is claimed here. |
| **A2A v1.0.1**, GitHub release published **May 28, 2026**; its changelog section is dated May 26. [Release](https://github.com/a2aproject/A2A/releases/tag/v1.0.1), [specification](https://a2a-protocol.org/latest/specification/). | The patch release is distinct from negotiated wire version **`1.0`**. The specification says patch numbers do not determine protocol compatibility. | State the release and wire version separately. A2A task transport and agent discovery do not by themselves establish our financial obligation semantics. |

Release dates for AP2 and A2A were additionally checked using the official GitHub release metadata: AP2 `published_at=2026-04-28T12:40:54Z`; A2A `published_at=2026-05-28T11:34:36Z`. The A2A “latest” specification page still displayed a 1.0.0 release label while the official v1.0.1 release was marked latest. The patch distinction above avoids hiding that inconsistency.

The UCP versioned documentation and Shopify’s first-party implementation changelog establish the inspected version. A guessed GitHub release-tag URL returned 404; it is not used as evidence of a release date.

## 3. Signed receipts are evidence, not a preventive gate

**`draft-izmaylov-agent-permission-receipts-01`**, published **October 24, 2026**, is an **IETF Internet-Draft: work in progress**, not an adopted RFC. It describes signed permissions, delegated records, action receipts, and offline verification. Its introduction explicitly distinguishes evidence from enforcement: records do not themselves stop an attempted action, and omitted actions may leave no agent-written receipt. It also discusses log omission and the need to distribute trust anchors separately. [Draft](https://www.ietf.org/archive/id/draft-izmaylov-agent-permission-receipts-01.html).

**Design consequence:** a cryptographically valid delegation must still pass the live execution gate. The implemented local service binds scope, exact financial basis, target agent possession, expiry, revocation, and shared-root one-use consumption to the same atomic SQLite transaction that records the reducer effect, audit, receipt, and retry response. A signed receipt afterward is evidence about that recorded execution; it is not a substitute for the gate.

Our custom Ed25519 implementation is not that draft’s full hybrid-signature/passkey/logging format. No draft conformance, post-quantum security, independent timestamping, or log completeness is claimed.

## 4. Research that informs the implementation

The titles, identifiers, dates, and abstracts below were verified directly at arXiv. These sources motivate specific engineering decisions. Their model assumptions, proofs, benchmarks, and performance results do not transfer to Truthful.

| Primary paper | Verified contribution relevant to this build | Consequence and limit |
| --- | --- | --- |
| **Jiang et al., A Formal Analysis of Agent Payment Protocols**, submitted **August 30, 2026**, arXiv **2609.00060**. [Paper](https://arxiv.org/abs/2609.00060). | Models several agent-payment protocols in Tamarin and examines missing relations across authorization, state, and economic/service effects. | Test cross-stage bindings, not only signature validity. Truthful’s JavaScript state exploration is not the paper’s Tamarin analysis or a formal protocol-security proof. |
| **Zheng et al., LLM Agent Capabilities Should Follow Task Intent and Context Source (IntentCap)**, submitted **September 13, 2026**, arXiv **2609.14631**. [Paper](https://arxiv.org/abs/2609.14631). | Proposes task-scoped authority composition and deterministic checks that prevent one context source from widening fields owned by another. | Evidence text may propose facts; it must not grant action scope or choose its own authority. We do not implement IntentCap or claim its evaluation results. |
| **Summers et al., Environment Steering**, submitted **September 19, 2026**, arXiv **2609.35807**. [Paper](https://arxiv.org/abs/2609.35807). | Uses runtime data-flow policies and feedback to steer an agent toward safe alternatives rather than merely block. | A blocked financial plan should have an explainable, legitimate recovery path. Our v4 repair is deterministic over explicit scripted plans; it is not an evaluated LLM steering system. |
| **Le et al., Secure Agentic Coding through Counterexample-Grounded Feedback (FALCON)**, submitted **October 19**, revised **October 20, 2026**, arXiv **2610.25916v2**. [Paper](https://arxiv.org/abs/2610.25916v2). | Separates attack exploration from behavioral verification and grounds repair feedback in program execution traces. | Show the actual failing effect and replayable counterexample. Our financial-plan repair is not FALCON code repair, reinforcement learning, or a replication of its results. |
| **Xia et al., TraceFix**, submitted **May 8, 2026**, arXiv **2605.07935**. [Paper](https://arxiv.org/abs/2605.07935). | Uses structured agent coordination, PlusCal/TLA+ counterexamples, repair, and monitored runtime execution. | Counterexample-guided repair is established research. Truthful must disclose its plan grammar, schedule bounds, and success criteria rather than present bounded JavaScript enumeration as TLC verification. |
| **Sun et al., Agentic Model Checking**, submitted **May 20, 2026**, arXiv **2605.21434**. [Paper](https://arxiv.org/abs/2605.21434). | Couples model proposals to bounded model-checking backends and validates counterexamples rather than accepting every reported trace as a real bug. | Reproduce a financial counterexample against the actual reducer, distinguish abstraction artifacts, and specify bounds. No SMT/BMC backend is claimed by our explicit explorer. |
| **Ciliberto, Rudi, Tassi, Proof-Carrying Contracts**, submitted **October 20, 2026**, arXiv **2610.28484**. [Paper](https://arxiv.org/abs/2610.28484). | Proposes proof-checked operation admission and states assumptions relating modeled constraints to world safety. | An offline signed receipt and an online runtime check are not a machine-checked contract proof. Keep the model/world boundary explicit. |

The nearby temporal reconciliation and duplicate-reimbursement papers remain relevant background; their verified identifiers and limitations are recorded in [COMPETITIVE_RESEARCH.md](COMPETITIVE_RESEARCH.md). No paper result is presented as a measured property of this project.

## 5. The implemented v4 product ritual

The modules now implement this ritual. The [recording script](DEMO_SCRIPT.md) maps it to actual controls; [architecture](ARCHITECTURE.md) separates the ephemeral browser authority fixture from the optional durable server. Integrated rendering/publication is tracked separately.

### A. Challenge the intended economic outcome

The portfolio begins with a concrete commitment: $2,400 promised, $900 applied, $1,500 outstanding. The independent explorer has five authored families: concurrent credit consumers, changed evidence, deadline drift, a competing amendment, and benign completion. Its explicit JSON programs can also be edited. Reversals/policy updates and grant revocation exist elsewhere in the assurance/authority model; they are not additional authored explorer families.

Explore allowed interleavings while preserving each actor’s declared order. Display the plan, environment events, horizon/state budget, explored schedules, truncation, and actual resulting money/action state. “No counterexample found” must name the explored model and bounds; it is not an unbounded safety claim.

### B. Produce a small, reproducible failure

The deliberately naive reference caches a real reducer check and later rebases its cached events as though nothing changed. Replay **the same schedule** through that baseline and the real guarded reducer. Display the actual effect difference: duplicate attribution, stale execution, or failure to complete the intended financial task.

The baseline must be labeled a purposely limited cached-check implementation. It is not GPT, Ramp, Ardina, Visa, AP2, or a representative production system. Do not infer industry superiority from beating an authored unsafe baseline.

“Shortest counterexample” means the shortest unsafe-effect prefix retained by BFS under the supplied step grammar. Full state/event histories and cache/counter/clock state enter canonical identity; there is no partial-order reduction. Budget exhaustion remains explicit and inconclusive about absence. The verifier reruns the finite search, or reproduces its exact recorded BFS expansion prefix for wall-time cutoffs. A shorter explanation is not necessarily a shorter causal trace.

### C. Repair and finish

The implemented repairs are deterministic transformations only for unchanged authored families: atomic current allocation checks; wait for the modeled source update and obtain a new analyst proposal plus distinct finance approval; explicit finance dismissal and re-proposal; atomic deadline checks; and benign atomic execution. Actor roles, distinct intents/IDs, and adverse clock orders are preserved. Edited or unknown programs return no automatic repair. Approver availability is a declared fixture assumption.

Show two separate outcomes: **unsafe effect prevented** and **legitimate financial goal completed**. A guard that rejects everything is not a useful recovery system. A repaired script that merely avoids the failing command without closing the actual goal is not a completed repair. The deadline family intentionally completes only one of two terminal orders and refuses the expired one. This is scripted-plan repair, not self-improving AI or general program synthesis.

### D. Delegate the exact current authority

Create a scoped delegation bound to the selected plan/action basis and an agent public key. The agent proves key possession when requesting execution. Before commit, the local service checks the signature/trust root, current basis, policy, expiry/revocation, scope, and unused grant state. One-use consumption, modeled effect, and receipt must commit together or not at all.

Then change the source/policy or revoke the grant and attempt the old authorization. Demonstrate the precise rejection and unchanged financial state. A legitimate fresh grant must still complete the authorized local action.

### E. Verify the recorded effect independently of the packet’s own key claim

Export the signed receipt, action/basis, and relevant audit/evidence links. Verify using a separately supplied/pinned trusted root, not whichever root the packet embeds. Alter the amount, target, basis, or signer and show verification failure.

Offline verification can establish that the trusted signer recorded this effect under the included authorization evidence. It cannot determine whether the grant is **currently** revoked, globally unspent across cloned databases, backed by an independently authentic vendor invoice, or followed by real external settlement. A valid receipt is not a new permission to execute again.

## 6. Implementation versus release and research claims

| Item | Inspected implementation | What remains separate |
| --- | --- | --- |
| Financial reducer and HTTP/SQLite | Source-linked obligations, shared allocations, branches, temporal views, exact approvals, transactions, role/revision/retry boundary. | External source truth, production identity, settlement, release acceptance. |
| Bounded explorer | [`src/explorer`](../src/explorer/README.md): full-history BFS with ordered actors/dependencies and depth/state/transition/time bounds. | Supplied finite grammar and premises, no unbounded safety guarantee. |
| Shortest effect witness | Cached effects checked against real current reducer; paired guarded replay; verifier checks traces and search/prefix counts. | Minimality only within the explicit step model; cutoff remains inconclusive. |
| Repair and completion | Five unchanged families; custom-plan repair refused; role/intent-preserving fixes; deadline 1-of-2 safe completion. | No general synthesis, arbitrary-plan repair, or guaranteed task completion. |
| Baseline comparison | Deliberately unsafe cached-check events versus actual current-state guard on identical eligible schedules. | Not an LLM, competitor, production-system, or held-out benchmark. |
| Scoped delegation | [`src/authority`](../src/authority/index.mjs), [`server/authority.mjs`](../server/authority.mjs): Ed25519 chain, possession, attenuation, live checks, atomic shared-root consumption/effect/receipt/retry. | Demo issuer key custody and selectable humans; no organizational identity or external effects. |
| Offline verification | Independently supplied pinned root; signed checkpoint/lifecycle/grant/request/receipt checks plus actual financial effect replay. | No current revocation, global unspentness across forks, source authenticity, or external completeness. |
| Public browser authority | Separate synthetic workspace, real signatures, ephemeral keys, serialized memory lifecycle. | It does not sign the persisted browser portfolio or provide durable/shared server enforcement. |
| Live LLM/external finance | Not connected or claimed. | Credentials, actual adapters, effect-level evaluation, and failure disclosure. |
| Protocol conformance | AP2/UCP/MCP/A2A/IETF-draft conformance not implemented or claimed. | Normative version mapping and interoperability/conformance evidence. |

The lead’s integrated checkpoint passed `npm run check` with 145 tests, existing extraction/assurance/prefix checks, and fifteen replay-verified v4 reports across five families. Four authored unsafe-reference witnesses were found; the reports contained 121 visited states and 106 transitions including shared prefixes. Browser acceptance passed twenty-three assertions each in actual SQLite and isolated production-preview modes; actual signed exports passed the pinned-root CLI. These are regression/inspection results, not independent statistical samples, measured latency, production identity, or publication evidence. The authority checkpoint includes thirty targeted tests covering full approval-event binding and reset revocation/rollback.

No implementation or test result from `Randomprojects/ramp` fills one of these evidence cells. Truthful’s own code and observed execution must support them.

## 7. Defensible positioning

**“Before a finance agent acts, Truthful finds a concrete way its plan can fail, repairs the bounded plan to finish the job, and binds delegated execution to the current financial evidence. Afterward, a separate verifier can check what the trusted local service recorded.”**

This is a product/engineering thesis supported by inspectable modules; integrated release and usability evidence must still be recorded separately. It is not a “first,” “only,” “formally proven,” “production ready,” or market-superiority claim. The assurance core should remain useful even if a larger platform provides the transport, identity, or payment rails.

## 8. What would falsify this wedge?

| Falsifier | What to measure or attempt |
| --- | --- |
| The explorer mainly rediscovers hand-authored fixture verdicts. | Change event orders, amounts, dependencies, and budgets. Verify it generates and replays new effect witnesses rather than selecting a canned story. |
| The reported shortest trace is not causally minimal under its advertised model. | Enumerate smaller permitted traces independently; remove steps and replay. Narrow the claim if pruning/abstraction changes minimality. |
| Repair “succeeds” by abandoning the legitimate job. | Assert the financial goal separately from absence of a violation. Count false blocks and unresolved/dead-end repairs. |
| The comparison wins only by weakening the baseline or changing its schedule. | Publish both paths, supply identical inputs/interleavings, disclose cached-check limitations, and test a stronger baseline. |
| Delegation can be replayed or survive a relevant live change. | Race two uses, restart, change basis/policy, revoke, expire, or switch agent keys. Require unchanged money/effects on rejected attempts. |
| Offline verification trusts a packet’s self-selected root or implies current validity. | Substitute a new embedded root/signature; use an old receipt after later revocation. Correct behavior distinguishes historical attestation from present execution authority. |
| Correct internal effects do not correspond to useful financial evidence. | Finance reviewers inspect whether the source/line/obligation mapping is meaningful. Authenticated adapters and independent labels are needed before real-world claims. |
| The operator cannot resolve a block more easily than the existing workflow. | Measure review time, explanation comprehension, false blocks, legitimate completion, and incremental applied credit against the operator’s baseline. |
| An existing platform already provides the same usable ritual. | Conduct an authorized, comparable hands-on evaluation. Public documentation alone cannot prove either equivalence or absence. |

No customer ROI, real recovered money, general agent safety, held-out model accuracy, or independent market demand is established by the research or authored demonstrations.
