# Frontier development build

Status: local v4 development. The user explicitly deferred further videos and submission packaging. Existing public delivery facts remain the earlier v3 release; no v4 release is being staged.

Backend milestone: [managed setup and API contract](BACKEND.md) · [requirement-to-evidence checklist](BACKEND_ACCEPTANCE.md). All existing product workflows now have server support, including durable evidence/previews, claim drafts/approval/unsent exports and execution reports/replay. The latest user direction resumes frontend work with the Nomen-inspired original clearing house; see [the adaptation record](NOMEN_ADAPTATION.md). Managed mode is separate from the retained demo; external mail, bank/payment feeds and live AI remain unconnected.

Implemented: bounded program-order exploration, shortest unsafe-effect witnesses for the published cached-check teaching harness, exact guarded replay, resource-cutoff prefix verification, fixed-family repairs with explicit completion, Ed25519 scoped/attenuated delegation, agent possession, revocation/expiry, full-approval binding, atomic SQLite one-use execution, signed outcome/lifecycle export and independently pinned-key verification.

Earlier frontier validation checkpoint: 156 automated tests; 25 actual SQLite frontier UI assertions; 23 isolated-browser assertions; 45 preserved assurance/evidence/guided UI assertions. The execution lab and the later portfolio integration passed independent desktop/mobile design review. These are synthetic development checks, not independent model accuracy or formal proof.

Current portfolio integration is implemented: choose an actual approved portfolio action, retain its exact evidence/ledger snapshot, and explore a hypothetical source revision or actual deadline ordering without changing live records or inventing approval. Eight browser checks in each of the SQLite and static build modes verify this path, including immutable live state, portable replay, and missing-deadline rejection.

Run `npm run dev` and open http://127.0.0.1:5173. `npm run check` validates the development build. Research and actual trust limits are documented in FRONTIER_RESEARCH.md and TECHNICAL_DEEP_DIVE.md. No live LLM or external financial system is connected.

Independent code review found and repaired response-ordering and superseded-run presentation races. Three hook regression tests check delayed command/reset responses against newer refreshes; two browser checks hold a real server response while inputs change. The recorded submission plan remains open because its external decisions are outside this development milestone.

The current product UI uses the spatial clearing-house and coordinated ledger system in DESIGN.md. Vite ignores generated Figma HTML and output artifacts for hot reload so running the design CLI or capturing screenshots does not reset an in-progress product review. The Figma companion remains separately generated and verified through its connected native document.

The default app entry is the financial portfolio. Use `http://127.0.0.1:5173/?view=execution` for a direct laboratory entry. `scripts/browser-design-principles-check.js` verifies the default route, disclosure access, keyboard focus, exact mobile references and first-viewport financial context through the existing Playwright CLI.

The November 6 continuation adds operator-facing credit fulfillment and amendment authoring. New issued/applied lines, partial attribution, invoice evidence, causal reversals, and source-backed changed terms use the existing reducer and atomic service boundary. Each form previews the actual financial effect; editing inputs or changing workspace, role, or historical view discards that review. Allocation records now optionally bind source revisions into the evidence graph, while legacy command replay remains compatible. Current accepted promise amounts are visible with the original amount retained. See [credit workflow verification](CREDIT_WORKFLOW_REVIEW.md) for runtime evidence and reproduction.

This continuation extends the application. The native Figma record remains the previously verified UI milestone; these new form states are not claimed as native Figma screens. Public v3 delivery, video work, and submission decisions remain unchanged.

The November 7 expansion adds five connected read-only workspace destinations and source-backed credit ambiguity resolution. The design source now contains 69 screen models, 14 boards and 483 mapped interactions; its full rendered gallery passes geometry, exact-text, font and navigation checks. The append-only native migration is prepared but not applied: the existing Figma file reports view-only plugin access and FigCli is disconnected. Current application and design evidence, exact remaining native action and recovery commands are recorded in [WORKSPACE_EXPANSION.md](WORKSPACE_EXPANSION.md).
