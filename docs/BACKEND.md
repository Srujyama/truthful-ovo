# Backend

The backend supports all existing finance, claim-recovery and execution-lab workflows. Managed mode uses real accounts and separate SQLite databases per workspace; demo mode retains the fictional fixture and selectable demo identities. New managed workspaces start empty.

## Run

Use Node 24 or later. `npm install` installs the web dependencies; the backend itself uses Node's HTTP, crypto and SQLite modules.

1. Create a local JSON file with `{ "email": "you@example.com", "password": "your chosen password of at least 12 characters", "name": "Your name", "workspaceName": "Finance" }`. Keep it outside Git.
2. `node server/admin.mjs bootstrap --data server/data/managed < /path/to/account.json`
3. `npm run backend -- --port 5174 --origin http://127.0.0.1:5173`

Bootstrap is an offline command and works once per data directory. `npm run dev` preserves the original demo setup. `npm run backend -- --help` lists managed options. Both services bind loopback. Exact HTTPS origins require `--secure-cookies` and an independently configured TLS reverse proxy.

The current frontend discovers managed mode and offers actual account sign-in, invitation enrollment, workspace switching/creation, password change and logout through the account dialog. Managed evidence, reviewed imports, saved claim drafts/approval/unsent exports and durable execution analysis are integrated. Demo role controls appear only in explicit demo mode; managed mode rejects demo role selection/reset. Inspect `/api/session` and the interface’s **Local SQLite** runtime label to confirm the selected service. The [clearing-house verification record](NOMEN_ADAPTATION.md) covers the full UI journeys.

## Request contract

All account and workspace responses are JSON unless an export route specifies a file type. Login returns an HttpOnly `truthful_session` cookie, public account/workspace identity and a `csrfToken`. Send the cookie on later requests. Every mutation requires an exact configured `Origin`; authenticated mutations also require `X-CSRF-Token`. Persisted workflow and finance writes require a unique `Idempotency-Key` (8–128 ASCII letters, digits, `.`, `_`, `:`, `-`). Retry the same operation with the same key and input to recover its original result. Reusing the key for changed input returns 409.

Financial `revision` counts committed HTTP financial transactions. `domainRevision` counts emitted domain events. Evidence analysis, claim drafts and explorer records have their own version counters. Never substitute one counter for another. A stale finance revision returns 409 with the current revision; refreshing requires a new review and a new key.

Errors return `{ "error": { "code": "...", "message": "...", "details": {} } }` with 400/422 validation, 401 session, 403 role/origin, 404 missing record, 409 stale/conflict, 413 size limit, 428 missing financial revision, 429 busy/authentication bound or 503 integrity/unavailable status. Unexpected errors hide internals. Managed requests include `X-Request-Id` and sanitized structured request logs without bodies, cookies or query secrets.

## Accounts

| Method | Route | Input/result |
| --- | --- | --- |
| POST | `/api/auth/login` | `{email,password}` → session cookie and public session |
| GET | `/api/session` | Current public session; no password or token hashes |
| POST | `/api/auth/logout` | `{}` → session revoked |
| POST | `/api/auth/password` | `{currentPassword,newPassword}` → all account sessions revoked |
| GET/POST | `/api/workspaces` | Membership list / system-admin `{name}` creates workspace |
| POST | `/api/workspaces/switch` | `{workspaceId}` → refreshed public active session |
| POST | `/api/invitations` | Workspace admin `{workspaceId,email,role,name,expiresAt?}` → one-time token; share manually |
| POST | `/api/auth/invitations/accept` | `{token,password,name?}`; existing account verifies its current password; then sign in |
| POST | `/api/memberships` | Admin `{workspaceId,userId,role?,active?}`; change invalidates affected sessions |
| GET | `/api/security/audit?limit=50&after=0` | Scoped administrative records and `nextAfter` |

Workspace admins manage their own members; system administration does not grant membership in unrelated workspaces. Invitations do not send email. The final active workspace admin cannot be removed.

## Evidence and reviewed finance workflows

1. `POST /api/evidence` with `{vendor,promiseText,invoiceCsv,replyText?,asOf?,label?}`. Original documents, exact citations and server-derived analysis persist. Intake makes no financial change. Reanalysis appends an immutable version using `evidenceId` and `expectedEvidenceVersion`.
2. `POST /api/workflows/preview` with `{expectedRevision,type,input}`. For `evidence-import`, input is `{evidenceId,analysisVersion}`. Other types are `credit`, `amendment`, `credit-resolution-evidence`, `credit-resolution`; their inputs match the checked adapters in `src/credit-workflow.mjs`, `src/amendment-workflow.mjs`, `src/credit-resolution.mjs`. The server supplies actor, time, source identity, exact command IDs and before/after projections.
3. Inspect the returned `plan`, then `POST /api/workflows/commit` with `{previewId,expectedRevision}`. The server rechecks the actor, current state, date and expiry under its write lock, then commits all effects and promotion links together.
4. Resume using `GET /api/workflows/previews` or `/api/workflows/previews/:id`. Discard via `POST /api/workflows/discard {previewId}`. A preview belongs to its preparing actor and expires after ten minutes; admin inspection does not transfer ownership.

`GET /api/evidence` lists bounded summaries; `/api/evidence/:id?analysisVersion=N` loads exact original documents, analysis, versions and financial promotion links. Workflow input is bounded at 1 MiB total and 250,000 characters per document. Unsupported and conditional analyses remain available for correction; no supported promise is invented.

`POST /api/commands {expectedRevision,command}` and `/api/batch {expectedRevision,commands}` expose the complete existing reducer. Batch size is 1–200 commands. `GET /api/capabilities` lists supported command names, workflows, roles and module boundaries. Approve with `{type:"APPROVE_ACTION",actionId}` as approver; execute with `{type:"EXECUTE_ACTION",actionId}` as executor. Source/policy/ledger changes invalidate the approved basis. All paths, including raw commands and delegated execution, apply the server's financial validation profile before commit.

## Saved claims

`POST /api/recovery/cases {evidenceId,analysisVersion,label?}` creates a source-bound draft. `POST /api/recovery/cases/:id/draft {expectedVersion,draft,label?,evidenceId?,analysisVersion?}` appends a new unapproved version. `POST /api/recovery/cases/:id/approve {expectedVersion}` requires approver/admin and approves the exact draft. Approval also creates a new version.

Read with `GET /api/recovery/cases`, `/:id?version=N`, `/:id/packet`, `/:id/csv`, `/:id/email`. Email is a downloadable RFC822 draft with `X-Unsent: 1`. A changed draft or newer evidence blocks email until the latest exact version is approved. Old versions remain inspectable. No route sends messages.

## Execution explorer and signed authority

`GET /api/explorer/scenarios` and `/:id` expose the authored programs. `POST /api/explorer/run` or `/compare` accepts exactly one of `{scenarioId}`, `{plan}` or `{portfolio:{actionId,adversary,now?},expectedRevision}`, plus optional `bounds`; `run` also accepts `mode`. Portfolio analysis captures an approved workspace snapshot without mutating live finances. Limits: depth12, states2000, transitions6000, time2000ms per search. Resource exhaustion is explicitly inconclusive. Automatic repairs apply only to authored families.

Saved reports: `GET /api/explorer/runs`, `/:id`, `/:id/packet?variant=naive|guarded|repair`. `POST /api/explorer/verify {runId,variant?}` or `{packet}` independently replays a packet and saves its verification result. Viewer accounts inspect reports; write roles start computation. One compute lease per workspace bounds concurrent searches.

Existing `/api/authority`, `/status?grantId=...`, `/grants`, `/revoke`, `/execute`, `/export` routes support exact-action signed delegation. Grant issue/revoke require approver/admin; execute requires signed agent possession and, in managed mode, current workspace membership. Delegated actors remain agent-derived in the audit. Execution, one-use nonce, financial effect, receipt and retry response commit together. Authority status/cache tables reconcile with signed lifecycle records. Existing valid legacy caches receive one explicit migration baseline; this cannot establish whether an unsigned cache was modified before that baseline.

`POST /api/packets/verify {packet,trustedIssuers?}` supports shipped portable packets. Authority verification needs separately supplied trust roots; a key bundled in a packet is never automatically trusted. Verification is bounded and does not authenticate vendor evidence or execute actions.

## Queries, reports and operations

`GET /api/query/:kind` supports operations, vendors, commitments, credits, sources, activity and audit. Common fields: `limit` (1–100), `cursor`, `asOf`, `knownAt`, `q`, `vendorId`; applicable filters include category/kind/versions/actor/type/from/through/status/reference. Cursors freeze projection dates and workspace revision. Continue with the returned cursor; a changed workspace requires restarting the query. Source lists omit document bodies; `GET /api/sources/:id/revisions/:revision` returns exact source text and usages.

`GET /api/reports/financial` or `.csv` uses explicit `asOf` and `knownAt`, integer cents and formula-safe text. Issued, applied, allocated, reversed, outstanding and incremental-obligation measures retain separate meanings. Related measures must not be summed as if independent savings.

`GET /api/live` checks process availability. `/api/health` checks the signed-in workspace. System-admin `/api/ready` checks all registered stores; `/api/verify` forces the active store's full consistency checks. `/api/export` exports the original command audit, seed, current snapshot and projection for independent replay. A database owner can replace an entire consistent history; local digests are not external authenticity.

Offline recovery commands:

```sh
node server/admin.mjs verify --data server/data/managed
node server/admin.mjs backup --data server/data/managed --to /path/to/new-snapshot
node server/admin.mjs restore --snapshot /path/to/new-snapshot --to /path/to/new-data
```

Stop the managed service first; its data lease prevents overlapping maintenance. Snapshot files include account hashes, evidence and signing keys, so keep them private. Restore always uses a new destination, verifies checksums, schema, financial history and linked records, preserves accepted financial effects, revokes sessions/invitations/unused grants, and discards pending previews. It does not overwrite existing stores or silently recreate a missing ledger. Start the restored directory and sign in again.

`npm run check` runs repository tests/evaluations/build. `npm run test:backend:browser` starts fresh isolated backend/web servers on 5185/5194, drives real Chrome accounts through the existing interface, saves screenshots and the replay packet, then closes its servers and deletes only its temporary store. It uses the installed Playwright skill CLI (`PLAYWRIGHT_CLI` can override its path). `npm run verify:backend` checks integrated backend behavior and that browser evidence; run the browser command first on a new checkout. See [acceptance coverage](BACKEND_ACCEPTANCE.md). Public hosting, external mail/bank/payment feeds, live AI, OIDC/MFA and managed key infrastructure are not connected by this local hackathon build.
