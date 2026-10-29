# Thinkpad — Truthful recording-ready localhost demo
<!-- pad:v1 -->

<!-- Edit this file by hand freely. `pad` reads and writes it; it never reformats
     prose sections. Task lines must keep the `- [ ] T1 · title` shape. -->

## Goal

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

None blocking.

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
      notes: External inputs pending: Drive anyone-link verification unsupported by connector and browser is controlled by another session; runtime AI reuse/create question unanswered; Round1 track, attendance and teammate consent unknown. No fabricated answers or automatic form submission.
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
