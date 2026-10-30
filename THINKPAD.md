# Thinkpad — Truthful recording-ready localhost demo
<!-- pad:v1 -->

<!-- Edit this file by hand freely. `pad` reads and writes it; it never reformats
     prose sections. Task lines must keep the `- [ ] T1 · title` shape. -->

## Goal

Figma product-design milestone (2026-10-29): prepare and inspect 17 editable screen reconstructions, 7 product boards, named component/color definitions and linked review states; create and verify a native Figma file through CLI. Preserve incumbent identity, truthful implemented/concept boundaries and the no-video instruction. Native creation is complete through the safe CLI bridge: 17 screens, 7 boards, 12 components, 13 color variables and 20 review-note overlays. Actual API checks, six independently reviewed native exports, prototype-player smoke checks and a named cloud version establish the scoped design milestone. Submission and videos remain deferred under T9.

Prior development milestone:

Frontier expansion (2026-10-29 Pacific): research dated primary releases/specifications/papers through current time; implement a bounded multi-agent interleaving explorer using real financial transitions, replayable shortest unsafe-effect witnesses for a deliberately naive reference harness, guarded comparison, explicit resource exhaustion, deterministic repair and legitimate completion; implement exact-action Ed25519 delegation, subject possession, monotonic scope narrowing, revocation/expiry/current-basis checking and atomic one-use SQLite execution, verifier-signed portable receipts checked against separately pinned trust roots; make both mechanisms usable in a responsive execution lab with honest static/memory versus server labels; independent review, actual browser tests, and research/product documentation. User steering explicitly defers video work and submission/release packaging; retain the current public v3 deployment and focus on the development build. Preserve v3 paths and external T9. No claims of protocol conformance, global proof, authenticated source truth, external settlement or live LLM safety.

Prior milestone:

Depth expansion (2026-10-29): implement financial commitment assurance beyond per-case recovery. Observable completion: multi-case portfolio with globally conserved credit allocations, effective-date and knowledge-date replay, proposed/accepted versioned amendments, reversals, policy- and revision-bound action approvals, explicit counterfactual economics, causal evidence graph, executable adversarial scenarios with inspectable failures, real local SQLite/HTTP persistence and enforced session roles/idempotency/optimistic concurrency, browser-local hosted fallback honestly labeled, source-backed differentiation research, updated technical demo and docs, independent code/design review, integrated checks and live publication. Keep all prior working paths. Live-model work remains gated by unanswered credential choice; no fake runtime AI or external send/payment/integration claims.

Prior milestone:

Round 2 upgrade (2026-10-28): turn the existing recording prototype into a technical hackathon project: supported document ingestion with exact citations, deterministic conservative invoice matching, explicit approval and downloadable draft, persistent saved cases, hash-linked local audit exports, regression/evaluation evidence, polished responsive workbench, public sanitized GitHub source, and a recorded demo with submission copy. Runtime OpenAI extraction is gated on user credential choice; do not imply connected AI. Actual form requires public repo, shareable video, 200–300 word tools/model/tradeoffs response. No external form submission or communications without explicit direction.

Previous completed milestone:

A polished, working localhost finance demo named Truthful. The two-minute flow detects Nimbus Cloud's covered nine-hour outage, computes a $2,000 SLA claim with evidence, records human approval, flags a conditional renewal offer, distinguishes issued from applied credits, and generalizes to Pipeline CRM's $2,400/$900/$1,500 concession. Reset, source inspection, responsive layout, no external sends, and illustrative-data labeling are required. Completion includes finance tests, successful production build, browser walkthrough and desktop/mobile inspection, independent review, design documentation, and a running local server.

## Constraints
- **Max concurrency: 3**

## Decisions

- Lightweight React/Vite, plain CSS. Preserve curated walkthrough; add browser-local document processing, persisted records, evidence citations, and audit exports. No fabricated integrations.
- Lead owns UI/config, recovery/audit module, git/publishing, and dev server. Engine worker owns src/engine and public/examples; submission worker owns docs. Review read-only after implementation.
- User said go on after recommended real finance workspace. Nimbus is opening example; Pipeline demonstrates breadth.

## Open questions

User steering (October29 Pacific): no further videos; not at demo/submission stage. Media and new release packaging are deferred. Existing drafts/artifacts are preserved without further publication. Product work continues, including testing actual approved portfolio actions against their contained evidence and ledger state.

External T9 remains open: runtime AI credential/direction choice; accepted-host video sharing; original track, attendance and team consent. Current depth expansion continues independently. V3 assurance is implemented and published. The final accepted-host v3 video link still needs verification; the v2 Drive copy is owner-only and a new connector upload could not be grounded by readback.

## Tasks

- [x] T1 · Verify financial state transitions
      files: src/domain.mjs, src/domain.test.mjs
      accept: npm test
      notes: 12 financial and state-transition tests pass.
- [x] T2 · Build and inspect recording workspace
      files: src/App.jsx, src/styles.css, index.html
      accept: npm run build
      deps: T1
      notes: Full Nimbus click-through, source dialog, savings timing, CRM switch, and reset passed in Playwright; visual inspection pending CSS.
- [x] T3 · Review and document final demo
      files: README.md, DESIGN.md, .impeccable/design.json
      accept: npm test && npm run build
      deps: T2
      notes: Independent review completed; readability and selection refinements applied. Desktop/mobile visually inspected; complete Nimbus browser flow and proof invoice passed. DESIGN and design sidecar saved.
- [x] T4 · Implement evidence ingestion and conservative reconciliation engine
      files: src/engine, public/examples
      accept: node --test src/engine/*.test.mjs
      notes: 40 engine tests and 22 authored evaluation fixtures passed; source quotes exact.
- [x] T5 · Build persistent evidence workbench and auditable exports
      files: src/Workbench.jsx, src/workbench.css, src/recovery.mjs, src/recovery.test.mjs, src/App.jsx
      accept: npm test && npm run build
      notes: Persistent evidence workbench, guarded approvals, hash-linked exports, 57 automated tests and production build pass.
- [x] T6 · Prepare technical submission and demo materials
      files: docs, README.md
      accept: npm run verify:submission
      notes: Actual form read; final architecture254 words; financial demonstration assertions agree.
- [x] T7 · Independently review and verify complete hackathon build
      files: src, .impeccable/review
      accept: npm run check
      notes: Independent implementation review repaired; design reviewer scored all5 fixes resolved. 57 tests,22 authored eval fixtures,20 hosted browser assertions pass; exported packet verified; design documentation updated.
- [x] T8 · Publish and verify public repository, live demo, and narrated recording
      files: .github/workflows/deploy.yml, docs/DELIVERY.md, scripts/verify-delivery.mjs
      accept: node scripts/verify-delivery.mjs
      notes: Public repo and Pages app verified anonymously; hosted20 browser assertions passed; public128s MP4 matches inspected local artifact byte-for-byte. Drive copy uploaded but accepted-host public sharing is tracked separately inT9.
- [ ] T9 · Resolve external submission decisions and accepted-host video sharing
      files: docs/delivery.json, scripts/verify-submission-ready.mjs
      accept: node scripts/verify-submission-ready.mjs
      notes: Deferred during current product-development stage after user explicitly stopped further video work. External Round1 track, attendance and teammate consent are unknown; runtime AI credential choice unanswered. No fabricated declarations or automatic form submission. Earlier public v3 delivery facts are preserved.
- [x] T10 · Build temporal commitment assurance and globally conserved allocation engine
      files: src/assurance
      accept: node --test src/assurance/*.test.mjs
      notes: 38 domain tests and 9 scenarios/31 checks pass. Independent prefix/date replay caught inactive reversal fallthrough; repaired with regression.
- [x] T11 · Add persistent local service with revision, idempotency, and role enforcement
      files: server
      accept: node --test server/*.test.mjs
      notes: 16 real HTTP tests pass, including restart, cross-instance writes, roles, CSRF, atomic rollback, idempotency, audit and real-engine integrations.
- [x] T12 · Build portfolio, decision review, evidence graph, and adversarial lab
      files: src/Assurance.jsx, src/assurance.css, src/useAssurance.js, src/App.jsx, scripts/dev.mjs, vite.config.js
      accept: npm run check
      notes: 25 assurance UI checks pass in SQLite, local static, and public Pages modes; original20 checks preserved. Six desktop/mobile captures inspected; independent reviewer scored graph contrast and annotation fixes resolved.
- [x] T13 · Validate differentiation and align deep build documentation and demo
      files: docs, README.md, scripts
      accept: npm run verify:depth
      notes: 843 command-prefix/date projections,9 cross-layer assertions,6 tamper rejections pass. Research/documents reconciled to actual code. Narrated181s v3 recording inspected and published with replayable evidence.
- [x] T14 · Review integrated assurance system and publish validated upgrade
      files: src, server, .github, docs/delivery.json
      accept: npm run check && npm run verify:depth && node scripts/verify-delivery.mjs
      notes: Source d1481836 published; both GitHub workflows green;45 hosted UI assertions passed;181s public video equals inspected local bytes; public evidence packet replays. Final pad audit refuses completion solely because externalT9 is open.
- [x] T15 · Research current frontier standards and defensible next product layer
      files: docs/FRONTIER_RESEARCH.md
      accept: node scripts/verify-frontier.mjs
- [x] T16 · Build bounded action interleaving exploration and counterexample replay
      files: src/explorer, scripts/verify-exploration.mjs
      accept: node --test src/explorer/*.test.mjs
- [x] T17 · Build signed constrained delegation with atomic execution and independent receipts
      files: src/authority, server, scripts/verify-authority.mjs
      accept: node --test src/authority/*.test.mjs server/*.test.mjs
- [x] T18 · Integrate responsive execution laboratory and actual runtime workflows
      files: src/ExecutionLab.jsx, src/execution-lab.css, src/useDelegation.js, src/App.jsx
      accept: npm run check
- [x] T19 · Independently review and validate frontier development build; release deferred by user
      files: docs, README.md, scripts, package.json, .impeccable
      accept: npm run check && node scripts/verify-frontier.mjs
      notes: 156 tests and integrated fixture/replay/build checks green. Independent code and desktop/mobile design review passed after cutoff-verifier, reset-authority, receipt-refresh and asynchronous UI ordering fixes. SQLite/static portfolio checks pass. User deferred videos, publication and submission packaging; public v3 remains unchanged.
- [x] T20 · Connect bounded exploration to current approved portfolio actions
      files: src/explorer/portfolio.mjs, src/explorer/portfolio.test.mjs, src/ExecutionLab.jsx
      accept: node --test src/explorer/portfolio.test.mjs
      notes: Eight adapter tests and eight real browser checks in each of SQLite and static modes pass. Exact approved snapshot, explicit clock, hypothetical adverse event, current reducer rejection, packet replay, no live mutation and mobile overflow verified; independent design review ships.
- [x] T21 · Build editable Figma product-design screens, components and prototype flow
      files: design/figma, docs/FIGMA_PRODUCT_SPEC.md, docs/FIGMA_SCREEN_MAP.json
      accept: npm run design:check && npm run design:verify-native
      notes: Created native file 8j4pwtsGDI4seljHPNeUkI through the safe CLI bridge: 17 editable screens, 7 boards, 12 native components, 13 color variables, 680 Manrope screen text layers and 20 review-note overlays. All 41 mapped controls and overlay returns checked by actual API; 14 offline regression tests pass. Six native exports independently reviewed after heading/font repairs. Four native prototype-player interactions observed. Saved cloud version 2415972791632449600. No billing change or financial command. Video and submission remain deferred under T9.
## Log

- 2026-10-22 · thinkpad created
- 2026-10-22 · done T1 · Verify financial state transitions
- 2026-10-22 · done T2 · Build and inspect recording workspace
- 2026-10-22 · done T3 · Review and document final demo
- 2026-10-29 · done T4 · Implement evidence ingestion and conservative reconciliation engine
- 2026-10-29 · done T5 · Build persistent evidence workbench and auditable exports
- 2026-10-29 · done T6 · Prepare technical submission and demo materials
- 2026-10-29 · done T7 · Independently review and verify complete hackathon build
- 2026-10-29 · done T8 · Publish and verify public repository, live demo, and narrated recording
- 2026-10-29 · set T7 · notes
- 2026-10-29 · done T10 · Build temporal commitment assurance and globally conserved allocation engine
- 2026-10-29 · done T11 · Add persistent local service with revision, idempotency, and role enforcement
- 2026-10-29 · done T12 · Build portfolio, decision review, evidence graph, and adversarial lab
- 2026-10-29 · done T13 · Validate differentiation and align deep build documentation and demo
- 2026-10-29 · done T14 · Review integrated assurance system and publish validated upgrade
- 2026-10-29 · done T15 · Research current frontier standards and defensible next product layer
- 2026-10-29 · done T16 · Build bounded action interleaving exploration and counterexample replay
- 2026-10-29 · done T17 · Build signed constrained delegation with atomic execution and independent receipts
- 2026-10-29 · done T18 · Integrate responsive execution laboratory and actual runtime workflows
- 2026-10-29 · done T20 · Connect bounded exploration to current approved portfolio actions
- 2026-10-29 · set T20 · notes
- 2026-10-29 · done T19 · Independently review and validate frontier development build; release deferred by user
- 2026-10-29 · set T19 · notes
- 2026-10-29 · set T9 · notes
- 2026-10-29 · set T21 · accept, notes
- 2026-10-29 · BLOCKED T21 · Build editable Figma product-design screens, components and prototype flow
- 2026-10-29 · set T21 · notes
- 2026-10-29 · set T21 · accept
- 2026-10-29 · set T21 · notes
- 2026-10-29 · done T21 · Build editable Figma product-design screens, components and prototype flow
