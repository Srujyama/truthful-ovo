# Commitment assurance engine

Dependency-free ESM, usable from Node or a browser. All monetary values are safe
integer USD cents. This models recorded evidence and authorized **local
simulation**. It does not send messages, accept real contracts, authenticate source
documents, or establish source completeness/settlement finality.

```js
import {
  createDemoWorkspace, createWorkspace, reduceWorkspace, evaluateWorkspace,
  proposeAction, simulateAction, validateWorkspace, scenarios, runScenario,
  DomainError,
} from './src/assurance/index.mjs';

let workspace = createDemoWorkspace();
const ctx = { actor: { id: 'local-reviewer', role: 'admin' }, now: new Date().toISOString() };
const { state, result } = reduceWorkspace(workspace, command, ctx);
workspace = state;
const view = evaluateWorkspace(workspace, { asOf: '2026-10-29', knownAt: ctx.now });
```

State is `{schemaVersion:1,id,revision,basePolicy,events:[]}`. `revision` is event
count; accepting an amendment emits two events. Reducers do not read the clock,
use random IDs, call external services or mutate their input.

Each event contains `id`, `sequence`, `commandId`, `commandCanonical`, `type`,
`payload`, `actor`, `observedAt`, `effectiveDate`, and `material`.
Observation time is supplied by trusted context and cannot move backward. The
server should derive actor and observation time rather than trusting client data.
Ledger recording, allocation, reversal, resolution, policy and commitment-identity
commands cannot be future-dated. Future promises use a future due date; future
term changes use a proposed/accepted amendment. This keeps the same currently
unallocated credit from being reserved twice by hidden future allocation events.

`command.id` is an optional request idempotency key. A repeated ID and identical
command returns the original state with `result.idempotent:true`; reusing the key
with different content throws `CONFLICT`. Missing request IDs are deterministic
but do not provide retry safety; a service should supply one.

## Commands

Every command has `type` and optional `id`. Payload fields below are top-level.
The analyst role records sources and ledger facts; approver records approvals;
executor executes approved simulations; viewer is read-only. Admin can perform
all commands. These roles are a model of authority, not an authentication system.

```js
{type:'ADD_VENDOR', vendor:{id,name}}
{type:'ADD_SOURCE', source:{id,vendorId,title,kind,text,effectiveDate?}}
{type:'REVISE_SOURCE', sourceId, text}
{type:'CREATE_COMMITMENT', commitment:{
  id,vendorId,reference,currency:'USD',promisedCents,dueDate,
  claimDeadline:null,conditions:[],sourceIds:['source-id']
}}
{type:'PROPOSE_AMENDMENT', amendment:{
  id,commitmentId,kind:'date_change'|'renewal'|'terms_change',
  patch:{promisedCents?,dueDate?,claimDeadline?,conditions?},
  effectiveDate,sourceIds,
  incrementalRenewalCostCents:0,baselineCostCents:0,
  baselineDescription:'Explicit counterfactual or current-agreement baseline',
  newCommitment:false,
  supersedesAmendmentIds:[]
}}
{type:'DISMISS_AMENDMENT',amendmentId,reason}
{type:'REGISTER_CREDIT', credit:{
  id,invoiceId,vendorId,currency:'USD',reference,amountCents,
  status:'issued'|'applied',sourceIds
}, effectiveDate?}
{type:'APPLY_CREDIT', creditId,sourceIds,effectiveDate?}
{type:'ALLOCATE_CREDIT', allocationId,creditId,commitmentId,amountCents,effectiveDate?}
{type:'REVERSE_CREDIT', creditId,amountCents,sourceIds,effectiveDate?,
 allocationReversals?:[{allocationId,amountCents}]}
{type:'RESOLVE_CREDIT',creditId,
 assignments:[{commitmentId,limitCents}],sourceIds}
{type:'SET_POLICY',policy:{claimLimitCents,renewalLimitCents,allowNewCommitments}}
{type:'PROPOSE_ACTION',action:{id?,commitmentId,
 type:'prepare_claim'|'preserve_original'|'accept_amendment',
 payload:{amendmentId?}}}
{type:'APPROVE_ACTION',actionId}
{type:'EXECUTE_ACTION',actionId}
```

`RESOLVE_CREDIT`, `DISMISS_AMENDMENT` and `APPROVE_ACTION` require approver; `EXECUTE_ACTION` requires
executor; `SET_POLICY` requires admin. `PROPOSE_ACTION` accepts analyst or approver.
Other recording commands require analyst. Admin is an explicit demo convenience.

Amendments cannot change vendor, reference or currency identity. A proposal never
changes accepted terms. Acceptance needs an approved, current action and remains
ineffective until its `effectiveDate`. Renewal proposals require an explicit
baseline description and baseline cost. The engine computes contingent credit
value minus incremental renewal cost, not the entire renewal price. Credit value
is the amended promise minus money already verified, avoiding double valuation of
previously recovered credits.

Competing pending proposals on one commitment are explicitly quarantined when
overlapping patched fields disagree, or their renewal economics differ. Each
proposal exposes `conflictingAmendmentIds` (alias `conflictIds`); accepting either
is blocked until finance dismisses incompatible alternatives with a reason.
`DISMISS_AMENDMENT` appends a retained decision event and exposes
`rejected:true` and `dismissal:{reason,actor,observedAt,eventId}`. It never changes
original terms or erases a source, and cannot dismiss an already accepted change.
Preserving the original claim remains possible while counteroffers conflict.

Each proposal records `baseCommitmentRevision` and
`baseAcceptedAmendmentIds`, including accepted changes not yet effective. Its
`basisStale` flag becomes true if the accepted branch/current-term revision or
supporting source revision changes. A fresh action cannot revive an intrinsically
stale amendment: finance records a new proposal against the current branch.
Ordinary sequential proposals after effective accepted changes bind the newer
accepted-term revision. This is a bounded source/version model, not universal
legal interpretation of competing agreements.

An overlapping accepted **future** schedule also blocks an implicit overwrite;
`conflictingAcceptedAmendmentIds` names it. Explicit replacement supports only
nonfinancial future amendments: a new proposal names
`supersedesAmendmentIds`, targets accepted future amendments on the same
commitment, and explicitly covers every field of the predecessor patch. Once the
replacement takes effect, the predecessor remains in history with
`supersededByAmendmentIds`/`superseded` and cannot silently reapply later.
Cancelling or replacing an already accepted renewal obligation is outside this
bounded schedule-replacement model and is refused. These events retain causal
`conflicts_with`, `dismisses`, and `explicitly_replaces` graph edges.

Credit IDs identify unique ledger credit lines; multiple credit IDs can share an
invoice ID. Optional `credit.lineId` preserves an adapter's external line identity
(default: `credit.id`); registering the same vendor/invoice/line under an alias is
also rejected. Re-registering a credit ID is rejected. Invoice line identity and
authenticity are assertions of the supplied adapter. This engine does not infer
them from arbitrary invoice text.

An issued memo reserves credit when allocated but contributes zero verified
savings. Application requires a separate invoice source event. All allocations of
one credit share a single capacity. Every allocation matches exact vendor ID,
currency, and commitment reference. A credit with zero or multiple candidate
commitments is quarantined; finance must supply a source-backed explicit
resolution before allocation. A resolution can split a shared credit between
claims with explicit limits. It cannot override identity matching.

Reversals reduce ledger capacity and reopen the affected claim balances. A full
reversal revokes all active allocations. A partial reversal affecting multiple
claims needs explicit `allocationReversals`, rather than an arbitrary choice of
which claim should lose money. The specified revocation sum must equal the amount
whose ledger backing disappears.

## Replay and approvals

`evaluateWorkspace(state,{asOf,knownAt})` filters financial effects by effective
date and observations by knowledge time. Defaults are the last event observation
and its calendar date, making evaluation deterministic. Pass current dates for a
current dashboard. Late evidence can change a retrospective assessment without
being visible in an earlier knowledge-time replay.

The projection contains arrays `vendors`, `sources`, `sourceVersions`,
`commitments`, `credits`, `allocations`, `amendments`, `actions`, `quarantine`;
objects `policy`, `totals`, `graph`, and `observationBoundary`; plus `revision`,
`materialRevision`, `asOf`, and `knownAt`.

Commitments include `promisedCents`, `originalPromisedCents`, `verifiedCents`,
`outstandingCents`, `appliedCents`, `issuedCents`, `conditions`, `sourceLinks`,
`pendingAmendmentIds`, `acceptedAmendmentIds`, `futureAcceptedAmendmentIds`,
`sourceChanged`, `deadline:{date,daysRemaining,state}`, and `status`.
Accepted renewals also expose `incrementalObligationCents`,
`futureIncrementalObligationCents`, and `acceptedEconomics` with the recorded
baseline. `netVerifiedValueCents` subtracts effective agreed incremental
obligations from verified credits; this comparison is not a settled cash-flow
measurement. Portfolio totals retain incremental obligations separately.
Statuses: `open`, `partial`, `issued`, `scheduled`, `conditional`, `verified`,
`deadline_expired`. Deadlines are recalculated for each `asOf`, never a saved
countdown. Conditional promises are excluded from portfolio verified/recoverable
totals until their terms are resolved.

Actions include `status:'proposed'|'blocked'|'approved'|'stale'|'executed'`,
`policyDecision:{allowed,reasons,policyVersion}`, `economics`, `basis`, `approval`,
and `execution`. A proposal/approval basis binds the material event revision,
policy version/content, commitment revision, every current source revision, and
the exact canonical action. Any source, term, ledger or policy update invalidates
pending approvals conservatively, including updates to another case. An expired
claim deadline can block execution even when no new material event exists.

The chain is a deterministic event record, not a cryptographic signature. A
trusted service can hash/store it and enforce concurrent revisions separately.
An action is one-use; reusing its request ID is safe, while executing it with a
new request ID after completion throws `ALREADY_EXECUTED`.

Graph nodes use IDs like `source:pipeline-promise@5`,
`commitment:pipeline-seats`, `credit:credit-pipeline-900`,
`allocation:allocation-pipeline`, `amendment:amendment-orbit-renewal`,
`action:action-pipeline-preserve`, `approval:ACTION-ID`, `reversal:EVENT-ID`.
Edges have `from`, `to`, `relation` and originating `eventId` where available.
Source revisions are retained, preserving historical lineage after text changes.

`validateWorkspace` checks ledger conservation, allocation identity, nonnegative
balances, bounded verified value, contiguous event order and graph references.
It returns `{valid,violations}`. This is executable checking of this model, not a
formal proof or real-world financial validation.

## Demo IDs and scenarios

Vendors: `pipeline`, `nimbus`, `orbit`, `parcel`.
Commitments: `pipeline-seats`, `nimbus-sla`, `orbit-renewal`, `parcel-waiver`.
Credits: `credit-pipeline-900` (90,000 cents applied),
`credit-nimbus-2000` (200,000 cents issued, not applied).
Allocations: `allocation-pipeline`, `allocation-nimbus`.
Amendments: `amendment-pipeline-date`, `amendment-pipeline-renewal`,
`amendment-orbit-renewal`.
Actions: `action-pipeline-preserve`, `action-orbit-renewal`,
`action-pipeline-renewal`, `action-nimbus-claim`.
Sources are accessible in `view.sources`; each exposes its ID, vendor, title,
kind, original text, revision, observation time and effective date.

The seed's Pipeline date and renewal proposals deliberately conflict, so selecting
the date branch requires dismissing the renewal and preparing a fresh action.
The demo ends at `2026-10-28T12:00:00.000Z`; later reducer contexts must be at or
after that instant. Scenarios are authored synthetic regressions and expose
`{id,name,description}`. `runScenario(id)` returns
`{id,name,description,passed,steps,checks,workspace,view}`.
Nine authored scenarios include `competing-amendments`, which executes a blocked
acceptance, reasoned dismissal, fresh approval and effective-date change.
Each step has its command, result or `{error:{code,message}}`, and revision.
Checks have `{name,passed,detail}`. These are not held-out benchmarks.

Errors are `DomainError` with `code`, `message`, `details`. Codes include
`VALIDATION`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `AMBIGUOUS`,
`INSUFFICIENT_CREDIT`, `STALE_APPROVAL`, `POLICY_BLOCKED`, `ALREADY_EXECUTED`,
and `INVARIANT`.

```sh
node --test src/assurance/*.test.mjs
node src/assurance/evaluate.mjs
```
