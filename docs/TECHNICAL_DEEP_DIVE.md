# Truthful v3 technical deep dive

Truthful separates three questions that a single “savings” answer can conceal:

1. What do the recorded sources and accepted terms say is owed?
2. Which applied credit capacity can be attributed to that obligation?
3. Is this exact proposed action still authorized now?

The implementation answers them with a deterministic event model, shared credit accounting, version-bound decisions, and an optional transactional service. It does not treat the model as an accounting authority over unverified external reality.

## 1. The complete mechanism

```mermaid
flowchart TB
    S[Source revision] -->|supports| C[Accepted commitment]
    S -->|supports| A[Proposed amendment]
    A -->|conflicts with| B[Alternative branch]
    D[Reasoned finance dismissal] -->|dismisses| B
    P[Current policy + exact basis] --> R[Reviewed action]
    C --> R
    A --> R
    R -->|approve then recheck| X[One local execution]
    X -->|acceptance effective on its date| C
    I[Invoice source] --> L[Unique credit line]
    L -->|shared capacity| AL[Allocation]
    AL -->|fulfills once| C
    V[Reversal event] -->|reduces backing| L
    V -->|reopens balance| C
```

These relationships are emitted from the same records used for projection and validation. The graph is not a separate picture of invented state. Sources retain revisions; rejected proposals remain present; decisions name the branch and actor they concern.

## 2. Event model and deterministic replay

The workspace has `schemaVersion`, `id`, a base policy, a domain revision, and `events`. Domain revision counts events, not HTTP requests. Each event contains sequence/ID, originating command identity and canonical content, type/payload, actor, observed instant, effective date, and whether it changes material decision state.

`reduceWorkspace(state, command, {actor, now})` either returns a new serializable state/result or throws a typed `DomainError`. It does not mutate inputs, read the clock, generate random IDs, or call services. A service supplies trusted context relative to its own demonstration boundary. `evaluateWorkspace` derives the financial view rather than relying on mutable cached totals.

An explicit command ID provides reducer retry identity: same ID/content yields the prior effect without another event; changed content conflicts. Server HTTP idempotency is a separate durable request boundary, described below. One accepted amendment creates both an acceptance event and an action-execution event, so its domain revision can advance more than one.

### Time has two axes

- `asOf`: the financial date whose effects are being evaluated.
- `knownAt`: the latest observation included in that evaluation.

An invoice application effective November 1 but observed November 3 must not appear in a November 2 knowledge view. A late accepted amendment effective October 15 can change a later retrospective assessment of October 29 while leaving an earlier knowledge view intact.

Projection is an interpretation of recorded evidence, not a declaration of complete feeds. There is no implemented posting watermark or source-lateness guarantee. “Not observed” is not proof that money is lost. The UI’s historical dates are read-only comparisons; exports can retain the complete underlying trace so both views are reproducible. They are not a historical-data access-control system.

Future due dates and approved future amendments are valid. Already-effective financial/identity recording commands cannot be future-dated. This intentionally avoids accepting two hidden future allocations against the same current unallocated credit.

## 3. Money and globally shared credit

Every modeled monetary amount is a safe integer count of USD cents. The bounded text parser accepts decimal credit amounts and converts them before arithmetic. Unsupported formats, unsafe ranges, and foreign currency do not become a financial assertion.

For a credit line:

```text
available = face amount − reversed amount
allocated = sum(active allocations across all commitments)
unallocated = available − allocated
0 ≤ allocated ≤ available
```

For an unconditional commitment:

```text
verified = min(accepted promised amount, eligible applied allocation)
outstanding = max(0, promised − verified)
verified + outstanding = promised
```

Issued allocations reserve capacity but do not contribute applied value. Conditional offers remain excluded until their terms are resolved in the modeled workflow. Excess credit is observable and does not inflate attributed verified value beyond the accepted promise. Allocation identity must agree on vendor ID, USD currency, and commitment reference.

### Identity and ambiguity

The structured API treats credit IDs as ledger-line records and preserves an optional external `lineId`. A vendor/invoice/line cannot be registered under another credit alias. Multiple real lines can share an invoice if the adapter supplies distinct identities. The system cannot prove those assertions describe real external lines.

The legacy evidence CSV has no line column. Its adapter therefore supports **one credit per vendor invoice**, with stable identity independent of the commitment reference. Importing the same invoice under a changed reference is a conflict, not a second $900. A multi-line invoice requires the explicit command/API path.

A credit with zero or several exact candidate commitments is quarantined. An approver can `RESOLVE_CREDIT` using supporting evidence and per-commitment limits. Resolution cannot override vendor/currency/reference identity, erase existing active attribution, or expand credit capacity.

### Reversals

A reversal is a new event, not deletion. It reduces the available credit and revokes allocation backing where needed. Unallocated capacity disappears first. A full reversal reopens all affected balances. When several claims share a credit and only some backing disappears, finance must name the allocation reversal amounts; the engine refuses to choose an arbitrary losing claim.

## 4. Competing and changing obligations

`PROPOSE_AMENDMENT` preserves the original promise. Allowed patches are amount, due date, claim deadline, and conditions; vendor/reference/currency identity cannot change. A proposal stores source versions, the current commitment revision, and accepted-branch IDs.

Pending proposals with disagreeing overlapping fields or different renewal economics are incompatible. Their conflict IDs appear in the projection and graph. Acceptance is blocked until an approver/admin records `DISMISS_AMENDMENT` with a reason. Dismissal retains source, proposal, actor, reason, observation time, and event lineage. It does not accept another branch or erase previously accepted terms.

The proposal’s own `basisStale` check is separate from an action’s stale approval. Accepting another branch or changing the proposal’s supporting source can make it intrinsically stale. Creating a fresh action around that old proposal does not revive it; finance must record a new current proposal.

Accepted future schedules also cannot be implicitly overwritten. A supported explicit replacement names `supersedesAmendmentIds`, concerns the same commitment, and covers every predecessor patch field. This bounded mechanism supports not-yet-effective **nonfinancial** schedule changes. Replacing/cancelling an accepted renewal obligation is refused. Once the replacement takes effect, the earlier schedule remains in lineage but cannot silently reapply later.

A minimal current-branch acceptance sequence on the fictional seed is:

```js
import {createDemoWorkspace, reduceWorkspace} from '../src/assurance/index.mjs';

let workspace = createDemoWorkspace();
const context = {
  actor: {id: 'local-demo-admin', role: 'admin'},
  now: '2026-10-29T12:00:00.000Z',
};
const commands = [
  {type: 'DISMISS_AMENDMENT', amendmentId: 'amendment-pipeline-renewal',
   reason: 'Decline the renewal; review the date change under the original agreement.'},
  {type: 'PROPOSE_ACTION', action: {id: 'review-current-date',
   commitmentId: 'pipeline-seats', type: 'accept_amendment',
   payload: {amendmentId: 'amendment-pipeline-date'}}},
  {type: 'APPROVE_ACTION', actionId: 'review-current-date'},
  {type: 'EXECUTE_ACTION', actionId: 'review-current-date'},
];
for (const [index, command] of commands.entries()) {
  workspace = reduceWorkspace(workspace, {id: `example-${index}`, ...command}, context).state;
}
```

The import path in this illustrative snippet is relative to a file in `docs/`; adjust it when running from another directory. The modeled due-date change takes effect November 1, not at the time of approval. No external contract is executed.

## 5. Approval is a bound capability in this model

The supported action types are `prepare_claim`, `preserve_original`, and `accept_amendment`. A simulation produces a policy decision and, where relevant, explicit economics. It does not itself authorize an effect.

The action/approval basis binds:

- Canonical action type, target, and payload.
- Commitment revision and material workspace revision.
- Current policy version and canonical policy content.
- Current source IDs and revisions.

Proposal, approval, and execution are separate commands. Approval requires an approver context. Execution requires an executor context, an approval for that exact action, a still-current basis, and a passing current policy check. Completed actions are one-use. An expired claim deadline can block execution as time passes even without a new material event.

Material updates conservatively invalidate pending approval across the workspace, including unrelated cases. This is sound but can require unnecessary re-review. Narrower dependency-based invalidation is a production optimization to validate, not a capability silently claimed here.

Roles are viewer, analyst, approver, executor, and explicit demo admin. The admin convenience can perform all phases. The current service does not verify employees or enforce separation of duties between real humans.

## 6. Deal economics is not a savings label

Pipeline’s existing $2,400 correction already has $900 verified, leaving $1,500 contingent in the new offer. The stated counterfactual is twelve months of equivalent service at $6,000/month. Proposed spend is $6,200/month:

```text
Baseline:                     $72,000
Proposed annual spend:        $74,400
Incremental spend:             $2,400
Remaining contingent credit:   $1,500
Net incremental value:          −$900
```

The $900 already applied is not counted as a new negotiation benefit. The comparison’s baseline is an explicit scenario assumption, not a verified quote. Editable monthly/horizon inputs in Decision room recompute a what-if; they do not mutate the stored proposal or authorize it.

When a renewal is explicitly authorized in the model, effective and future incremental obligations remain separate from verified credit. `netVerifiedValueCents` subtracts effective agreed incremental cost under that baseline. It is not a bank cash-flow statement. Taxes, FX, discounting, cancellation rights, and uncertain service value are not inferred.

## 7. Atomic evidence promotion

The Evidence lab remains useful because financial assurance needs an entry path beyond prepared fixtures. It processes supported USD promise text, positive credit-ledger CSV, and an optional reply. Citations preserve exact half-open UTF-16 source ranges.

Add to portfolio calls `prepareEvidenceImport`:

1. Rerun extraction from original documents rather than trusting a modified report object.
2. Reject unsupported evidence, unresolved conditions/replies, and future review assertions.
3. Locate the normalized vendor and exact commitment; reject term mismatch rather than silently rewriting it.
4. Preserve a stable legacy invoice identity and reject amount/reference conflicts or uncertain multi-line matches.
5. Prepare source, commitment, credit, and allocation commands as one batch.

Browser mode adopts/persists only a fully successful batch. The optional service commits the batch and audit within one transaction. A final rejected allocation leaves no earlier source or ledger mutation. An evidence-lab approval of an email draft is not promoted as assurance approval authority; the assurance action needs its own current basis.

The evidence lab’s thirty saved reports and exact-draft JSON/CSV/EML exports remain separate from the assurance event workspace. The original guided Nimbus demonstration is another separate illustrative state machine.

## 8. Real HTTP and SQLite boundary

The optional service uses Node 24 built-ins. It binds loopback only; the static public deployment does not include it. The UI selects server mode only after a live session/workspace response and labels browser fallback explicitly.

| Boundary | Implemented behavior |
| --- | --- |
| Session | Random server-issued HttpOnly, SameSite=Strict local cookie and an eight-hour expiry; sessions persist in SQLite. |
| Actor | Actor/role come from the server session. Outer actor spoofing is refused; nested client actor fields do not replace reducer context. |
| Mutation origin | Explicit HTTP loopback Origin plus CSRF token required. Host checks constrain DNS-rebinding exposure. |
| Concurrency | Current server write revision required through `expectedRevision` or `If-Match`; stale writes conflict. |
| Batch | 1–200 domain commands validate/commit together or roll back. Internal reset/batch command types cannot be injected through the public command route. |
| Retry | Actor/idempotency-key request digest is persisted with the exact response. Identical retry survives restart; different input under the same key conflicts. |
| Audit | Snapshot, accepted command entry, and cached response commit in one SQLite transaction. |
| Reset | Explicit demo-admin confirmation restores the seed and appends a reset audit entry; it does not delete server history. |

The HTTP revision counts accepted writes. Domain revision counts emitted domain events. A multi-command batch advances the former once and can advance the latter many times. They are deliberately not interchangeable.

Key data routes are `/api/workspace`, `/api/commands`, `/api/batch`, `/api/events`, `/api/export`, and `/api/verify`. See [server README](../server/README.md) for request shapes and the exact reset confirmation. This is real transport/storage enforcement around selectable demo identities, not production authentication.

## 9. What export verification establishes

A server export contains the initial workspace, current workspace, projection context/result, accepted commands and actors, state digests, previous-hash links, revisions, and export digest. `verifyExportPacket` replays commands from the stored seed and compares snapshots/projection. The client builds its server-mode wrapper from the returned server snapshot, avoiding an old-tab/new-server mismatch.

For a saved server-mode assurance wrapper:

```sh
node --input-type=module <<'JS'
import {readFile} from 'node:fs/promises';
import {verifyExportPacket} from './server/service.mjs';
const packet = JSON.parse(await readFile('/tmp/truthful-assurance-evidence.json', 'utf8'));
const serverPacket = packet.serverRecord || packet;
const result = await verifyExportPacket(serverPacket);
console.log(result);
if (!result.valid) process.exitCode = 1;
JS
```

That verifies the nested server record, not an independently authenticated wrapper or source. Browser-mode packets have no server record; the pure validator checks financial/schema/graph invariants on their supplied state. The earlier `scripts/verify-packet.mjs` checks the separate evidence-lab format and is not a v3 assurance verifier.

No hash prevents a database owner from constructing a new seed/history and recomputing every digest. No local role proves a person’s identity. No timestamp proves an external event happened then. No supplied invoice proves settlement. These limits are part of the design contract, not failures hidden by an “audit” label.

## 10. Validation and reproducibility

At this documentation checkpoint, the assurance-domain suite has thirty-eight tests; nine authored scenarios execute thirty-one checks. The suite includes seeded adversarial event sequences and regression cases for future allocation, invoice aliases, amendment conflicts, stale bases, supersession, reversal attribution, and exact role/policy decisions. Real HTTP tests separately exercise transaction rollback, concurrency, actor context, persistent retries, reset retention, and replay.

```sh
npm run evaluate:assurance
npm run verify:submission
```

Full integrated acceptance is `npm run check`, run by the lead against the combined patch. Browser inspection is needed to verify that the UI exposes the correct state and recovery path; a unit test cannot establish visual clarity. [DELIVERY.md](DELIVERY.md) records publication and integrated verification without conflating older v2 video evidence with v3 behavior.

The scenarios are authored synthetic regressions. They are not an independent accuracy benchmark, a formal proof, actual competitor results, or customer recovery evidence. A model integration would need declared model/version/schema/budget, repeated-trial effect checks, and independently reviewed held-out cases. A pilot must measure unsafe effects, false blocks, legitimate completion, review effort, and incremental applied credits against the existing process.

## 11. What is not implemented

There is no live LLM, financial connector, vendor identity verification, external send/payment/renewal execution, organizational authentication, independent audit anchor, feed-completeness guarantee, or universal legal/financial interpretation. Multi-currency, tax/FX, arbitrary OCR, real settlement validation, and cancellation of an accepted renewal require separate domain and integration support.

The credible claim is narrower and demonstrable: under the recorded evidence and explicit model, the same credit cannot be allocated beyond its capacity, conflicting terms cannot silently replace one another, and an old approval cannot authorize a changed basis.
