# Backend acceptance

This milestone covers the existing product's complete backend workflows. Frontend design and the deferred native Figma migration remain separate. The user's latest direction prioritizes complete hackathon functionality over enterprise security infrastructure.

| Requirement | Observable acceptance | Evidence |
| --- | --- | --- |
| Real accounts and workspace memberships | Invited analyst, approver, executor and viewer sign in separately; no role selection in managed mode | `server/identity.test.mjs`, `server/managed.test.mjs` |
| Empty, isolated managed workspaces | New account workspace has no fictional ledger; another workspace's data/cursor/source is unavailable; missing registered data refuses startup | `server/managed.test.mjs`, `server/backend-boundary.test.mjs` |
| Original evidence intake | Original documents and exact citations persist; unsupported/conditional records remain reviewable without financial promotion | `server/workflows.test.mjs` |
| Durable reviewed imports | Server recomputes the analysis, freezes the reviewed command IDs, rejects stale/foreign/expired previews, links exact analysis to commitment | `server/workflows.test.mjs`, managed HTTP journey |
| All financial domain commands | Vendor/source/commitment, source revision, credit issuance/application/allocation/reversal/resolution, terms proposal/dismissal, policy and action lifecycle remain available atomically | Existing real-engine service tests, financial validation tests, managed journeys |
| Credit correctness | Issuance never becomes verified until invoice application; physical capacity and exact case caps hold at every affected financial date, including raw API/batch/agent writes | `server/financial-validation.test.mjs`, `server/managed.test.mjs` |
| Ambiguous credit workflow | Analyst records clarification; separate approver records explicit per-case caps; over-cap allocation refused | Managed HTTP resolution journey |
| Changed terms and actual roles | Analyst proposes, approver approves exact current basis, executor executes once; stale source/policy blocks execution | Managed HTTP/browser journey, existing engine integration tests |
| Claim recovery parity | Saved versioned draft, exact reviewer approval, unsent EML, CSV and portable packet; edits/new evidence invalidate approval; restart retains versions | `server/recovery.test.mjs`, `server/product-parity.test.mjs` |
| Execution explorer parity | Authored/custom/current-approved portfolio programs, comparison, explicit repair limits, cutoff, durable report/packet and independent replay | `server/explorer.test.mjs`, product parity HTTP tests |
| Signed execution parity | Narrow delegation, possession, current approval, revocation/expiry, atomic single use and signed receipt; mutable records reconcile with signed history | `server/authority.test.mjs`, `server/authority-integrity.test.mjs`, boundary HTTP tests |
| Portable verification | All shipped packet formats replay; uploaded authority keys are never implicitly trusted; tampering rejects | `server/packets.test.mjs` |
| Read model parity | Bounded operations/vendors/commitments/credits/sources/activity/audit queries; exact source revisions/usages; pinned cutoffs/cursors | `server/queries.test.mjs`, independent read-model boundary tests |
| Exact finance reports | JSON and formula-safe CSV use integer cents, actual financial/knowledge cutoffs and distinct measures | Query tests, existing operations tests |
| Persistence and retries | Restart preserves original records and exact idempotent responses; concurrent stale writers reject; injected transaction failure leaves no effects | Service/workflow/managed/boundary tests |
| Recovery | Versioned migrations preserve accepted history; verified offline backup/restore preserves finances, rejects corruption/overwrite, discards stale previews and revokes sessions/unused grants; an actually issued grant stays revoked and its restored signed packet verifies | `server/maintenance.test.mjs`, boundary tests |
| Usable existing interface | Real browser contexts use managed SQLite, record issued memo and invoice evidence, approve/execute as separate accounts, close the amended promise with exact applied credit and survive reload | `scripts/browser-backend-workflow.js`, rendered screenshots and downloaded packet under `output/` |
| Integrated delivery | All repository checks plus backend acceptance pass; review findings repaired; setup and API contracts documented | `npm run check`, `npm run verify:backend`, `docs/BACKEND.md` |

Completion is based on these behaviors, not test counts alone. External email delivery, bank/payment connectivity, vendor authentication, live AI and public hosting have never been implemented product integrations and are not represented as connected by this milestone.

The reproducible fresh-browser run completed **29/29 checks**. Its final case has an original USD350 promise, separately accepted USD400 amended promise, USD400 invoice-backed attribution and USD0 outstanding. The exported financial audit independently replays with actual distinct approver/executor user IDs. Both rendered screenshots were inspected. Run `npm run test:backend:browser` to recreate the evidence, then `npm run verify:backend` to check it.
