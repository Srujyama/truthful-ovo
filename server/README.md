# Optional local assurance service

Node 24 built-ins provide HTTP, SQLite, server-side role context, optimistic
concurrency, durable idempotency, command replay, and hash-linked audit exports.
There are no external dependencies or model/payment/vendor calls.

```sh
node server/start.mjs --help
node server/start.mjs --port 5174
node --test server/*.test.mjs
```

The default CLI database is `server/data/truthful.sqlite`, ignored by Git. The
service binds only loopback. A public GitHub Pages deployment is static and does
not contain this service or a shared database. The same assurance engine can run
in browser-local demonstration mode; the UI must label that distinction.

## Explicit demonstration identities

`POST /api/session` selects a **local demo** role. Anyone who can reach this
loopback service can deliberately select a role, including administrator. This
is a way to demonstrate role enforcement; it is **not enterprise authentication**
or verification of a real person's authority. Role selection is never portrayed
as a connected Ramp, Google, or company account.

Roles are `viewer`, `analyst`, `approver`, `executor`, and `admin`. Compatibility
aliases are `auditor` → viewer, `operator` → analyst, `reviewer` → approver.
An existing session cannot elevate itself by changing request fields or posting
a different role. Deliberately switching the demo identity requires signing out
and starting a new session.

Sessions use a random server-issued HttpOnly, SameSite=Strict cookie, expire in
eight hours, and persist across service restarts. Mutations require an exact
allowed loopback Origin and an `X-CSRF-Token` from the current session. The HTTP
development cookie is not marked Secure because the local service is HTTP.
Production needs real identity, HTTPS, organization membership, credential and
session management, and a separately enforced authorization policy.

## API contract

| Method and path | Request / response |
| --- | --- |
| `GET /api/health` | Public local service status, persistence mode, internal integrity status; no credentials or DB path. |
| `POST /api/session` | `{role}` → `{actor,csrfToken,authMode,roles,notice}` and session cookie. Initial creation requires an allowed Origin. |
| `GET /api/session` | Current identity and CSRF token, or `actor:null`. |
| `DELETE /api/session` | Current CSRF token required; ends the current session. |
| `GET /api/workspace` | `{workspace,view,revision,domainRevision,integrity,mode,notice}`. Optional `asOf` and `knownAt` projection query parameters. |
| `POST /api/commands` | `{command,expectedRevision}` plus `Idempotency-Key`, session, CSRF, and Origin. |
| `POST /api/batch` | `{commands:[...],expectedRevision}` with the same headers; 1–200 commands commit atomically or none do. |
| `GET /api/events` | Accepted server command audit entries and current server revision. |
| `GET /api/export` | Downloadable JSON with initial workspace, current workspace, projection, commands, actors, hashes, and export digest. |
| `GET /api/verify` | Replays accepted commands and verifies snapshot/hash consistency. |
| `POST /api/demo/reset` | Administrator only, `{confirm:'RESET_DEMO_WORKSPACE',expectedRevision}` plus write headers. Restores the fictional seed and appends a reset audit event; never deletes audit history. |

All data routes require a session. Origin defaults include loopback ports5173,
4173, and5174; an ephemeral test/listen origin is also allowed. A configured
origin must itself be an explicit HTTP loopback origin. Non-loopback Host headers
are refused to limit browser DNS-rebinding exposure.

The `revision` response field is the **server write revision**. Supply it as
`expectedRevision`, or as `If-Match: "REVISION"`. It differs from
`workspace.revision` / `domainRevision`, which count domain events: one batch or
amendment can add multiple domain events while advancing the HTTP revision once.
A stale write receives409. The idempotency key is scoped to the server actor;
repeating identical input returns the original response even after later writes
or service restart. Reusing the key with different input receives409.

Every command derives its actor from the server session. Actor fields in the
outer request are refused. Requests cannot select another command's authority.
The pure engine enforces the role and current approval/policy/source basis.
Batch imports use the same reducer, so an invalid final allocation rolls back all
earlier sources and facts in that import.

## Audit scope and durability

SQLite transactions commit the current snapshot, server command event, and
idempotent response together. Every accepted command event binds the server
actor, observation time, command, before/after revisions, state digests, and the
previous event hash. Startup and data requests replay accepted commands from the
persisted seed and compare the resulting snapshot. A failed command does not
become an accepted financial fact or change the workspace.

The export verifier is also available as a module:

```js
import { verifyExportPacket } from './server/service.mjs';
const result = await verifyExportPacket(packet);
```

These checks detect inconsistency **relative to the stored seed and chain**.
Someone controlling the database can replace the entire history and recompute
hashes. The service does not authenticate source documents, make timestamps
independently trustworthy, provide an external audit anchor, or establish invoice
settlement finality. It performs no actual email, purchase, renewal, payment, or
accounting writeback.

Tests use actual ephemeral HTTP listeners. Transport/storage tests inject a small
deterministic engine to isolate these guarantees; separate financial integration
tests run the real assurance engine for issuance/application, knowledge-time
replay, conserved allocation, atomic rollback, stale approvals, and exports.
