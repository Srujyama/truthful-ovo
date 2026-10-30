# Truthful v4: questions from engineers

## What changed beyond the original parser?

The parser feeds a financial state machine. V4 adds an explicit plan laboratory: generate adverse orderings, retain a shortest unsafe-effect witness, replay the same schedule at the real guard, inspect a bounded repair, then authorize an exact local execution using Ed25519 delegation. The HTTP/SQLite path atomically commits effect, capability use, audit, receipt, and retry response. See [architecture](ARCHITECTURE.md) and [technical deep dive](TECHNICAL_DEEP_DIVE.md).

## What does the explorer actually enumerate?

Enabled interleavings of the supplied finite actors’ ordered steps and explicit dependencies. Steps are cached checks/commits, real atomic commands, and clock changes. Breadth-first search uses full state/history, counters, clock, and cached checks for deduplication; equal balances alone do not merge histories. It has no partial-order reduction. Two actors with two ordered steps have exactly six terminal schedules. Five authored families and edited custom finite plans are supported.

## Is the red result just a rejected command?

No. A rejection at the current guard is a successful boundary. The intentionally naive reference reuses cached reducer events without current validation. Its actual committed effect is compared with the current reducer’s decision and independently checked conservation. Both modes receive the same program/order. The reference is deliberately broken teaching code, not an LLM, competitor, or representative production system.

## What does “shortest” mean, and what happens at a cutoff?

BFS retains the shortest unsafe-effect prefix under the supplied grammar and enabled orderings. This is step minimality within that finite model, not a universally minimal causal explanation. Depth/state/transition/time limits are explicit. A cutoff is inconclusive about absence of failures. A found witness remains replayable; the verifier checks its effects and reproduces the reported search or deterministic expanded-state prefix. A digest alone does not validate a cutoff report.

## Does repair synthesize an arbitrary better program?

No. Unchanged authored families have deterministic repairs with a fixed vocabulary; edited or unknown plans return no automatic repair. The credit repair preserves both distinct allocation intents and IDs, checking each atomically. The changed-source and amendment repairs introduce a fresh proposal and a distinct modeled finance approver. They do not elevate the executor, synthesize evidence, or silently change initial terms. Approver availability is a fixture assumption.

## Could safety mean refusing every task?

We count legitimate safe terminal completion separately from prevented unsafe effects. The deadline repair deliberately keeps both clock orders eligible: one terminal order completes, the expired order is refused. It reports one of two, not perfect completion. The credit repair cannot fulfill two $900 intentions from one $900 line. These finite schedule counts are not statistical accuracy or customer utility measurements.

## What is signed, and what does “Maximum claim” constrain?

A grant binds the exact approved action, basis and full approval-event digests, workspace/audience, target agent key, commitment/vendor/USD identity, amount/obligation limits, lifetime, and root nonce. Maximum claim bounds the modeled claim amount, not literal new spending or external payment. The hero action preserves original terms; recording it does not increase verified savings.

## Why is a valid signature insufficient?

The current action and basis, policy, time, revocation, scope, and unused root nonce must still pass inside the effect transaction. A supporting source change can stale an otherwise valid signed grant. The final agent must sign the request with the leaf private key; copying the public grant does not confer possession. No external identity or vendor authenticity follows from a valid demo signature.

## Can delegation widen authority or give siblings separate uses?

Children can narrow limits and validity and bind a new target key. They retain action, basis, workspace, audience, and root nonce. One root plus at most three children is supported. The parent agent signs the child; the leaf signs execution. Siblings share the one-use root, so executing through one consumes the capability for all. Unknown fields/caveats and widening are refused.

## What is atomic about signed execution?

The SQLite service checks current authority inside `BEGIN IMMEDIATE`, then commits the actual reducer effect, root-nonce consumption, authority audit, signed receipt, and cached response together. Concurrent new uses cannot both win; a failed write does not consume the grant. The browser authority demonstration uses serialized in-memory state instead, without durability or multi-user guarantees.

## Can resetting the demo revive an old grant?

No. Outstanding roots are permanently revoked inside the reset transaction, with retained signed lifecycle evidence. Recreating the same seeded action and even an identical approval does not revive an old grant. A regression reproduces that exact reset/reapproval case; an injected lifecycle-write failure must roll back both reset and grant status. Full approval-event hashing also binds the approving actor/event, not only its financial basis.

## Why can retry succeed after expiry or revocation?

An identical already-committed request returns its stored result. This reports the past transaction; it does not reevaluate permission for a new effect. Changing request identity/content or attempting a new use is subject to the live gate and consumed-root rejection. The UI exposes **Retry identical request** separately from **Attempt another execution**.

## Isn’t exporting a public key and trusting it circular?

Yes, if the verifier accepts the packet’s own claimed root. Ours requires a separately supplied pinned issuer. **Pin this demo issuer** makes that local trust decision explicit; the CLI takes an independent `--trust` file. It proves identity relative to that chosen demo key, not that the issuer is a verified finance organization. The local issuer key is demo SQLite configuration; production identity/key custody is outside scope.

## What can the offline verifier prove, and what can it not know?

It checks signatures, included lifecycle/checkpoint, grant/possession chain, shared one-use root, exact before/after financial state, current-authority checks at the recorded execution, and replayed effect against a pinned root. It cannot know current revocation, global unspentness across cloned databases, omitted events beyond the checkpoint, authentic vendor facts, trusted external time, or settlement. A receipt is historical evidence, not reusable execution permission.

## Does this conform to AP2, UCP, or the October IETF draft?

No. This is a custom Ed25519 local execution profile. AP2/UCP address substantial neighboring commerce/payment concepts, and the October 24 permission/receipt Internet-Draft is work in progress rather than an adopted standard. We claim no interoperability, passkey, hybrid/post-quantum signature, or protocol-conformance result. [Dated primary-source research](FRONTIER_RESEARCH.md).

## What is the specific user problem?

A finance operator needs to know whether a proposed recovery is still valid when the promise, ledger, and authority have changed independently. A promise may be partly fulfilled; a credit may already fund another claim; a renewal may worsen the economics; an old approval may refer to old evidence. We have not established the frequency of these cases or a customer recovery rate.

## Isn’t credit recovery already a product?

Yes. Ramp supports vendor credits and advertises contract-to-invoice reconciliation. Ardina describes supplier-credit lifecycle automation; Vertice Ana describes negotiation strategy and forecasting. We do not claim an uncontested category. Our hackathon contribution is the integrated, inspectable behavior under conflicting evidence and changing authority. Public pages do not reveal competitors’ internal invariants. [Primary-source comparison](COMPETITIVE_RESEARCH.md).

## Where is the AI?

AI assisted development. The runtime is deterministic and does not call a live language model. We deliberately keep financial conservation and authorization outside model-generated reasoning. A future model can propose structured interpretations/actions behind schema and citation checks. It is not implemented simply because we describe that architecture. The form asks for newest AI tools, so this distinction remains explicit in the submission answer and delivery record.

## Why should an engineer care about a rules engine?

Because the rules must continue to hold across multiple cases and time. We demonstrate a duplicate allocation rejected without partial mutation, a late amendment visible only at the appropriate knowledge cutoff, a conflicting branch blocked until reasoned review, and a once-valid approval rejected after its basis changes. V4 makes the order itself inspectable: a new finite script can generate a replayable unsafe cached effect, expose what the live reducer prevents, and quantify whether the repaired program still finishes. Those are executable state/effect properties.

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

It uses the same reducer, but has a different trust boundary. GitHub Pages serves static files and uses the clearly labeled browser workspace. It does not host Node, SQLite, or a shared authoritative ledger. `npm run dev` additionally starts a loopback HTTP/SQLite service with server-side role checks, transactions, revisions, persistent retries, and audit replay. The runtime banner identifies the mode. In the public build, Signed authority is a separate ephemeral synthetic workspace; it does not sign or mutate the persisted browser portfolio. Its keys and authority state disappear on reload. The explorer also runs separate scenario state.

## Are the server’s users authenticated employees?

No. The local service issues sessions for deliberately selectable demo roles. It refuses actor/role spoofing in command requests and enforces the selected session role, but anybody with access to the local demonstration service may intentionally choose a demo Admin identity. Production organizational identity, membership, and credential management are not implemented.

## What makes an import atomic?

Add to portfolio reruns extraction against the original text and CSV, checks terms and stable credit identity, and prepares a source/commitment/credit/allocation batch. Browser mode does not replace the workspace until the whole batch succeeds. Server mode uses one SQLite transaction for the entire batch. An invalid last allocation leaves no earlier source or ledger fact committed. An evidence-lab draft approval does not become assurance authority during import.

## What happens if two tabs write at once?

The server requires `expectedRevision` or `If-Match`. A stale request receives a conflict instead of overwriting newer data. Identical actor/idempotency-key requests return the recorded response, including after restart; a different request under that key conflicts. This is real service behavior. Browser-only mode is a local demo and does not provide equivalent independent multi-user coordination.

## Is the audit tamper-proof?

No. Server entries bind command, actor, time, state digests, revisions, and previous hash. Replaying from the stored seed checks the persisted snapshot and export. Somebody controlling the entire database can replace the seed/history and recompute the hashes. There is no independent external anchor, authenticated vendor signature, or trusted clock attestation. V4 authority packets add a signed local checkpoint whose issuer must be pinned independently; a database rewrite without that signing key cannot manufacture that issuer’s signature. Control of the demo issuer key remains outside this protection. No local signature authenticates the vendor or complete external history.

## Can source text cause a real action?

No external action tool is connected. Text is evidence, not an instruction channel; action types are explicitly modeled commands. A valid execution records a local simulation. This does not establish that a future model/connector would be prompt-injection-proof. That integration requires its own adversarial evaluation and complete mediation of real effects.

## How is correctness tested?

At this checkpoint the assurance suite has thirty-eight tests and nine authored scenarios with thirty-one checks, including legitimate completion after a block. Other suites cover extraction, cents math, imports, economics, local approval packets, and real HTTP/SQLite behavior. The inspected explorer checkpoint adds fourteen tests over five finite families; authority/authority-HTTP checks add thirty targeted tests. Those are separate component checkpoints. The lead’s integrated acceptance passed 145 tests and the authored fixture/scenario/prefix checks. The v4 acceptance replay-verified fifteen reports over five families; browser checks passed twenty-three assertions in each of SQLite and isolated production-preview modes, with actual packets verified by the pinned-root CLI. Counts include shared fixture prefixes and are not performance measurements. Current publication and any later rerun belong in [DELIVERY.md](DELIVERY.md). Authored scenarios are regression evidence, not held-out accuracy, competitor performance, or formal proof.

## Are these proof-carrying contracts or formal verification?

No. We use bounded explicit-state exploration, runtime validation, deterministic reducers, regression tests, signatures, and replay checks. No SMT/Tamarin/TLA+ proof or general synthesis is implemented. Existing research already studies proof-checked agent operations, temporal reconciliation admissibility, and formally verified invoice lifecycles. We cite it as grounding and a limit on novelty claims, not as a guarantee inherited by our JavaScript implementation. [Research review](COMPETITIVE_RESEARCH.md).

## How would a pilot be evaluated?

Use permissioned historical cases independently labeled by finance reviewers, with DEV tuning separated from held-out evaluation. Measure unsafe effects, false blocks, legitimate task completion, false credit associations, review effort, and incremental credits actually applied against the existing process. Do not count credits already recovered elsewhere or replace those outcomes with a fluent explanation score.

## What is still outside scope?

Verified organizational identity; authenticated source/financial connectors; independent retention/anchoring; arbitrary document/OCR understanding; currencies, FX and tax; accepted-renewal cancellation; real outbound communication, purchasing, payment and accounting writeback; and runtime model extraction. The implemented assurance checks remain useful local demonstrations without claiming those integrations exist.
