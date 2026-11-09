# Backend implementation and review record

Verified 2026-11-08 Pacific. This is the local hackathon backend milestone; the frontend redesign and previously deferred native Figma/submission work remain separate.

## Delivered behavior

The current product's finance, evidence, recovery and execution features now have server APIs and durable records. Managed accounts use exact workspace memberships and separate financial stores. Financial commands, typed previews/commits, source versions, claim drafts/approvals, unsent exports, finite execution analysis, signed delegation, portable verification, temporal queries, reports, migrations and offline recovery are integrated. No frontend component or styling file changed.

The complete fresh Chrome journey starts with an empty managed workspace. It records a USD350 original promise, an issued USD300 memo with USD100 attribution, separate invoice application, a proposed USD400 amendment, actual separate reviewer/executor decisions, the remaining USD200 memo attribution and a final USD100 applied invoice credit. The resulting case is verified with USD400 applied attribution and USD0 outstanding. Reload preserves that result. The exported audit replays independently and retains distinct managed approver/executor user IDs.

## Verification

- `npm run check`: **334 tests passed**, financial/evidence evaluations, submission/depth/frontier checks and production build passed.
- `npm run verify:backend`: **137 backend tests passed** plus independent verification of the actual browser-exported packet.
- `npm run test:backend:browser`: **29/29 real Chrome checks**, using a new isolated store and separate analyst, approver and executor browser contexts. Screenshots inspected after completion.
- Documented bootstrap/start/shutdown/verify/backup/restore commands run through actual subprocesses.
- Actual unused signed authority is revoked by restore; its signed lifecycle/export still verifies and a fresh presentation cannot execute against the preserved approval.

The backend test count is a subset of the repository count. These are deterministic synthetic product checks, not independent vendor authentication, a live-model benchmark or external financial settlement.

## Independent review repairs

| Finding | Repair and recheck |
| --- | --- |
| Some financial protections existed only in browser adapters | New server financial validation profile applies to raw commands, batches, workflows and signed execution; checks affected historical boundaries and exact resolution/source limits. Legacy accepted audit profiles retain their replay semantics. |
| Mutable authority status/cache could diverge from signed evidence | Reconcile keys, grants, lifecycle, nonces, receipts, audit anchors and signed cache checkpoints. Explicit legacy baseline preserves valid old retry bytes without claiming pre-baseline tamper detection. |
| A failed financial write could leave a phantom cached integrity revision | Clear verification cache on rollback; injected post-write response-cache failure now returns only the surviving committed revision. |
| Missing registered storage could be silently recreated empty | Managed startup refuses missing or mismatched workspace files. |
| Failed workspace initialization could leave a committed registry record | Synchronous trusted provisioning runs inside the identity transaction; failed initialization rolls back membership/registry and cleans only newly owned storage. |
| Provisioning cleanup could remove a preexisting colliding file | Establish ownership after the existence check; sentinel collision and retry regressions preserve existing storage. |
| Accepted query filters could be silently ignored | Per-resource query contracts reject unsupported scope; audit type filters and real date-range validation are tested. |
| New recovery packet metadata was outside the portable verifier's checks | Verify complete wrapper/version hashes and exact draft/evidence/approval/freshness links while retaining legacy claim packet support. |

No material review finding remains open for this backend milestone. [Acceptance coverage](BACKEND_ACCEPTANCE.md) maps each requested behavior to its relevant tests; [setup and API contracts](BACKEND.md) provide the frontend handoff.

## Scope and delivery

This source build has no connected email sender, vendor inbox, bank/payment feed, live AI provider or public backend host. Unsent email exports remain unsent, simulated execution remains local, and source/record digests establish internal consistency. The retained demo and the new managed runtime are explicitly separate.

The durable plan's finish audit reports only the older deferred T9 submission/video decisions and T37 native Figma access/bridge blocker. Backend tasks T38–T45 are complete; the historical plan is not represented as wholly finished.
