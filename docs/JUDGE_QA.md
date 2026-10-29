# Truthful v3: questions from engineers

## What changed beyond the original parser?

The parser is now an entry point into a shared commitment-assurance system. The implemented core manages allocations across commitments, versioned amendment branches, effective/knowledge-time projections, policy-bound approval/execution, reversals, and explicit renewal economics. The optional HTTP/SQLite service adds a real transaction, actor-context, concurrency, retry, and audit boundary. The Failure lab executes adverse cases against the same reducer. See [architecture](ARCHITECTURE.md) and [technical deep dive](TECHNICAL_DEEP_DIVE.md).

## What is the specific user problem?

A finance operator needs to know whether a proposed recovery is still valid when the promise, ledger, and authority have changed independently. A promise may be partly fulfilled; a credit may already fund another claim; a renewal may worsen the economics; an old approval may refer to old evidence. We have not established the frequency of these cases or a customer recovery rate.

## Isn’t credit recovery already a product?

Yes. Ramp supports vendor credits and advertises contract-to-invoice reconciliation. Ardina describes supplier-credit lifecycle automation; Vertice Ana describes negotiation strategy and forecasting. We do not claim an uncontested category. Our hackathon contribution is the integrated, inspectable behavior under conflicting evidence and changing authority. Public pages do not reveal competitors’ internal invariants. [Primary-source comparison](COMPETITIVE_RESEARCH.md).

## Where is the AI?

AI assisted development. The runtime is deterministic and does not call a live language model. We deliberately keep financial conservation and authorization outside model-generated reasoning. A future model can propose structured interpretations/actions behind schema and citation checks. It is not implemented simply because we describe that architecture. The form asks for newest AI tools, so this distinction remains explicit in the submission answer and delivery record.

## Why should an engineer care about a rules engine?

Because the rules must continue to hold across multiple cases and time. We demonstrate a duplicate allocation rejected without partial mutation, a late amendment visible only at the appropriate knowledge cutoff, a conflicting branch blocked until reasoned review, and a once-valid approval rejected after its basis changes. Those are executable state/effect properties, not just a prompt or dashboard.

## What exactly is conserved?

Every recorded credit line has available value after reversals. Its allocations across all commitments cannot exceed that capacity. Allocation identity must agree with vendor, USD currency, and reference. Verified attribution is capped by the accepted commitment; issued credit contributes zero. The model relies on an adapter’s asserted external line identity; it does not authenticate the invoice or infer line identity from arbitrary text.

## Can the same invoice appear twice under different names?

The engine rejects reuse of a vendor/invoice/line identity under another credit ID. Its structured API permits real distinct lines on one invoice, provided the adapter supplies explicit line identities. The legacy Evidence lab importer has no line column, so it uses a stable one-credit-per-vendor-invoice identity. Changing the commitment reference cannot manufacture another line; conflicting imports are refused.

## What if two commitments share a reference?

The credit is quarantined rather than assigned by a guess. An approver supplies a source-backed resolution with explicit per-commitment limits. Identity still has to match, and allocations share the original capacity. Discovering ambiguity later can withdraw uncertain verified attribution until resolved; it does not create more money.

## Is a credit memo enough?

No. An issued memo may reserve capacity but contributes no verified applied value. Application requires a separate invoice source. A reversal reduces the available backing and reopens the affected balance. Shared partial reversals require explicit causal attribution, rather than choosing arbitrarily which claim loses its credit.

## How do competing amendments work?

A proposal does not change accepted terms. Incompatible pending patches or renewal economics block acceptance. Finance dismisses an alternative with a retained reason and actor, then prepares/reviews a current action. The amendment itself binds its accepted branch and source revisions, so a fresh action cannot revive an intrinsically stale proposal. Accepted but future nonfinancial schedules require explicit supported supersession; cancelling an accepted renewal is outside this model.

## Is a later email automatically more authoritative?

No. Observation order records knowledge; it does not establish legal agreement. The prototype requires explicit modeled acceptance and authority checks for an amendment to take effect. It is a bounded workflow model, not a determination that an email is legally binding.

## What does an approval authorize?

One canonical action under its recorded material revision, policy content/version, commitment revision, and source revisions. Execution rechecks the current basis and policy. New material facts invalidate pending approval conservatively, even when they concern another case. Repeated request IDs do not repeat effects; executing an already completed action with a new request ID is rejected.

## Why invalidate approvals for unrelated changes?

It is a conservative implementation tradeoff. A single material-workspace revision is easier to inspect than an incomplete dependency graph that accidentally permits stale execution. It can create unnecessary re-review. A production system should narrow invalidation using tested causal dependencies while preserving soundness.

## How does time differ from a date filter?

`asOf` filters financial effects; `knownAt` filters observations. A late-recorded amendment can alter today’s retrospective interpretation of an earlier financial date without appearing in what an earlier operator knew. Deadlines are recomputed as the financial date changes. Historical UI comparisons disable writes. This does not establish that all external data has arrived; missing evidence remains unknown.

## Why is a $1,500 credit a negative $900 deal?

The fictional baseline is equivalent service for twelve months at $6,000 per month. The proposed renewal is $6,200 per month: $2,400 incremental annual spend. Only $1,500 remains as a contingent credit, so the incremental comparison is negative $900. The existing $900 application is not a new negotiation benefit. The baseline is an explicit assumption, not a verified alternative offer; taxes, discounting, cancellation rights, and uncertain service value are outside that simple comparison.

## Does accepting a renewal erase its cost?

No. Effective and future incremental obligations are retained separately from verified credits. `netVerifiedValueCents` subtracts effective agreed incremental obligation from verified attribution under the recorded baseline. That is a model comparison, not a settled bank cash-flow measurement. Acceptance alone creates no applied savings.

## Is the public website the same as the server demo?

It uses the same reducer, but has a different trust boundary. GitHub Pages serves static files and uses the clearly labeled browser workspace. It does not host Node, SQLite, or a shared authoritative ledger. `npm run dev` additionally starts a loopback HTTP/SQLite service with server-side role checks, transactions, revisions, persistent retries, and audit replay. The runtime banner identifies the mode.

## Are the server’s users authenticated employees?

No. The local service issues sessions for deliberately selectable demo roles. It refuses actor/role spoofing in command requests and enforces the selected session role, but anybody with access to the local demonstration service may intentionally choose a demo Admin identity. Production organizational identity, membership, and credential management are not implemented.

## What makes an import atomic?

Add to portfolio reruns extraction against the original text and CSV, checks terms and stable credit identity, and prepares a source/commitment/credit/allocation batch. Browser mode does not replace the workspace until the whole batch succeeds. Server mode uses one SQLite transaction for the entire batch. An invalid last allocation leaves no earlier source or ledger fact committed. An evidence-lab draft approval does not become assurance authority during import.

## What happens if two tabs write at once?

The server requires `expectedRevision` or `If-Match`. A stale request receives a conflict instead of overwriting newer data. Identical actor/idempotency-key requests return the recorded response, including after restart; a different request under that key conflicts. This is real service behavior. Browser-only mode is a local demo and does not provide equivalent independent multi-user coordination.

## Is the audit tamper-proof?

No. Server entries bind command, actor, time, state digests, revisions, and previous hash. Replaying from the stored seed checks the persisted snapshot and export. Somebody controlling the entire database can replace the seed/history and recompute the hashes. There is no independent external anchor, authenticated vendor signature, or trusted clock attestation. Browser records have still less independent authority.

## Can source text cause a real action?

No external action tool is connected. Text is evidence, not an instruction channel; action types are explicitly modeled commands. A valid execution records a local simulation. This does not establish that a future model/connector would be prompt-injection-proof. That integration requires its own adversarial evaluation and complete mediation of real effects.

## How is correctness tested?

At this checkpoint the assurance suite has thirty-eight tests and nine authored scenarios with thirty-one checks, including legitimate completion after a block. Other suites cover extraction, cents math, imports, economics, local approval packets, and real HTTP/SQLite behavior. The lead records integrated browser/build results separately. Authored scenarios are regression evidence, not held-out accuracy, competitor performance, or formal proof.

## Are these proof-carrying contracts or formal verification?

No. We use runtime validation, deterministic reducers, regression tests, and replay checks. Existing research already studies proof-checked agent operations, temporal reconciliation admissibility, and formally verified invoice lifecycles. We cite it as grounding and a limit on novelty claims, not as a guarantee inherited by our JavaScript implementation. [Research review](COMPETITIVE_RESEARCH.md).

## How would a pilot be evaluated?

Use permissioned historical cases independently labeled by finance reviewers, with DEV tuning separated from held-out evaluation. Measure unsafe effects, false blocks, legitimate task completion, false credit associations, review effort, and incremental credits actually applied against the existing process. Do not count credits already recovered elsewhere or replace those outcomes with a fluent explanation score.

## What is still outside scope?

Verified organizational identity; authenticated source/financial connectors; independent retention/anchoring; arbitrary document/OCR understanding; currencies, FX and tax; accepted-renewal cancellation; real outbound communication, purchasing, payment and accounting writeback; and runtime model extraction. The implemented assurance checks remain useful local demonstrations without claiming those integrations exist.
