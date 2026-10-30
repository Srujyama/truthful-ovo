# Frontier development build

Status: local v4 development. The user explicitly deferred further videos and submission packaging. Existing public delivery facts remain the earlier v3 release; no v4 release is being staged.

Implemented: bounded program-order exploration, shortest unsafe-effect witnesses for the published cached-check teaching harness, exact guarded replay, resource-cutoff prefix verification, fixed-family repairs with explicit completion, Ed25519 scoped/attenuated delegation, agent possession, revocation/expiry, full-approval binding, atomic SQLite one-use execution, signed outcome/lifecycle export and independently pinned-key verification.

Current validation checkpoint: 156 automated tests; 25 actual SQLite frontier UI assertions; 23 isolated-browser assertions; 45 preserved assurance/evidence/guided UI assertions. The execution lab and the later portfolio integration passed independent desktop/mobile design review. These are synthetic development checks, not independent model accuracy or formal proof.

Current portfolio integration is implemented: choose an actual approved portfolio action, retain its exact evidence/ledger snapshot, and explore a hypothetical source revision or actual deadline ordering without changing live records or inventing approval. Eight browser checks in each of the SQLite and static build modes verify this path, including immutable live state, portable replay, and missing-deadline rejection.

Run `npm run dev` and open http://127.0.0.1:5173. `npm run check` validates the development build. Research and actual trust limits are documented in FRONTIER_RESEARCH.md and TECHNICAL_DEEP_DIVE.md. No live LLM or external financial system is connected.

Independent code review found and repaired response-ordering and superseded-run presentation races. Three hook regression tests check delayed command/reset responses against newer refreshes; two browser checks hold a real server response while inputs change. The recorded submission plan remains open because its external decisions are outside this development milestone.

The current product UI uses the working-ledger design system in DESIGN.md. Vite ignores generated Figma HTML and output artifacts for hot reload so running the design CLI or capturing screenshots does not reset an in-progress product review. The Figma companion remains separately generated and verified through its connected native document.
