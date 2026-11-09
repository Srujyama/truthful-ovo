# Development build

Status: local v4 development. The current frontend implements the whole-application overhaul verified in [UI_OVERHAUL.md](UI_OVERHAUL.md). The user rejected the earlier Nomen adaptation as sufficient application design. Earlier passing tests and design reviews remain historical behavior evidence; they do not approve the new workspace.

The user deferred further videos and submission packaging. Existing public delivery facts remain the earlier v3 release. No new deployment, native Figma persistence or submission is claimed here.

## Current application

The default entry is **Follow-ups**, with full-width results and a selected case’s exact amounts, documents, credits, history and next action. **Credits** is a first-class view of actual credit notes and invoice adjustments. **Tasks**, **Companies**, **Documents**, **Activity** and **Reports** have separate task-specific compositions over the same financial records. Public Sans, dark ink, white working surfaces and restrained blue actions replace the previous pixel/paper treatment on operational screens.

**Add documents** opens Document review. Browser mode retains local fictional reviews; managed mode retains source-analysis versions, reviewed imports and follow-up draft versions with separate analyst/approver roles and exact-version unsent exports. Selected records and drafts are retained across ordinary workspace navigation; exact routes must preserve identity and show unavailable states for missing targets.

**Office map** is a secondary original spatial overview. Its six buildings, anchored controls, pause/camera/reduced-motion behavior and real record links remain useful. [NOMEN_ADAPTATION.md](NOMEN_ADAPTATION.md) preserves that historical milestone and its evidence boundaries. [DESIGN.md](../DESIGN.md) records the current operational system and the separate Office treatment.

**Workflow tests** retains bounded program-order comparisons, current-action snapshots, custom scenarios, inconclusive resource cutoffs, replay/export and fixed-family repair. **Permissions** retains exact-action review, Ed25519 limits and narrower delegation, expiry/revocation, atomic one-use execution/retry and separately pinned-key verification. An explicit unavailable target must not silently become a different browser example.

## Run and verify

Run `npm run dev` and open http://127.0.0.1:5173. The supervisor starts Vite and the local demo HTTP/SQLite service. `npm run dev:web` runs the browser-only UI; `npm run backend` starts managed mode after account bootstrap. See [BACKEND.md](BACKEND.md) for accounts and service setup. No API key is required for these deterministic workflows.

Useful reproduction entrypoints:

```sh
npm run check
npm run test:workspace:all
npm run verify:workspace-redesign
python3 scripts/verify-frontend-guidance.py
```

The browser command builds isolated production previews and exercises managed accounts, all workspace views, credit fulfillment/recovery in SQLite and offline browser mode, and the guided/document examples. Its companion verifier replays the actual downloads and checks the resulting records. The runner uses owned temporary services and never resets the developer’s saved workspace. The live acceptance checklist and verified outcomes belong in [UI_OVERHAUL.md](UI_OVERHAUL.md). Inspect normal-motion journeys, wide/intermediate/phone layouts, history, focus, exact records, recovery and meaningful empty/error/role states alongside automated checks.

Direct local entries remain `?view=assurance` for Follow-ups, `?view=credits` for Credits, `?view=execution` for Workflow tests and `?view=world` for Office. Internal route/module names are retained for compatibility; product labels are plain task names.

## Backend and earlier checkpoints

The [managed setup and API contract](BACKEND.md) and [backend acceptance record](BACKEND_ACCEPTANCE.md) document durable evidence/previews, claim drafts/approval/unsent exports and execution reports/replay. Managed accounts and workspace membership are separate from selectable demo identities. External mail, bank/payment feeds and live AI remain unconnected.

Earlier frontier records reported 156 automated tests, 25 SQLite UI assertions, 23 isolated-browser assertions and 45 preserved finance/evidence/guided assertions. Later portfolio integration recorded eight checks in each SQLite/static mode. Response-ordering and superseded-run repairs included delayed-response regressions. These counts describe those checkpoints, not the current overhaul’s test result or visual acceptance. Research and trust limits remain in [FRONTIER_RESEARCH.md](FRONTIER_RESEARCH.md) and [TECHNICAL_DEEP_DIVE.md](TECHNICAL_DEEP_DIVE.md).

The November 6 continuation added operator-facing credit fulfillment and amendment authoring: issued/applied lines, partial assignment, invoice evidence, causal reversals and source-backed changed terms through the same atomic boundary. [CREDIT_WORKFLOW_REVIEW.md](CREDIT_WORKFLOW_REVIEW.md) records that checkpoint. The November 7 expansion added the connected workspace destinations and credit ambiguity resolution. Its 69 editable screen models, 14 boards and 483 mapped interactions belong to the earlier design source kit, not a claim of parity with the current overhaul. Native expansion remained blocked by view-only access and a disconnected FigCli bridge; [WORKSPACE_EXPANSION.md](WORKSPACE_EXPANSION.md) retains that evidence and recovery procedure.

Vite ignores generated Figma HTML and output artifacts for hot reload, keeping captures and design generation from resetting an open product review. Public release, videos, native Figma work and external submission decisions remain separate from this development pass.
