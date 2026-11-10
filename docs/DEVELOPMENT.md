# Development build

Status: local v4 correspondence implementation verified for T51/T52; see the current evidence record. The user explicitly rejected the blue-gray workspace at `081444c`, the earlier Nomen adaptation as sufficient application design and all three Formroom candidates as taste templates. [CORRESPONDENCE_DESIGN.md](CORRESPONDENCE_DESIGN.md) and THINKPAD tasks T51/T52 own current requirements and evidence. [UI_OVERHAUL.md](UI_OVERHAUL.md) preserves historical behavior checks; earlier passing tests and design reviews do not approve the replacement.

Videos and submission packaging are deferred. Public delivery remains the earlier v3 release. No new deployment, native Figma persistence, source-kit parity or submission is claimed here.

## Current application

**Cases** opens a correspondence file: company → promise → invoice result → next decision. The opening has human stories rather than overlapping KPI totals or a reference-code table. **Cases**, **Documents**, **Companies** and **Reports** are the four primary tabs. Needs attention belongs to Cases; Credit notes and Check documents belong to Documents. More exposes History, Developer tools, Office map and Examples. Every route, modal, example and Office illustration uses the shared green mat, manila tabs and paper frame, Archivo headings, Helvetica Neue reading, Martian metadata and red ink. [DESIGN.md](../DESIGN.md) records source-derived tokens and responsive structure.

Paper objects show original summary artwork from actual case values. They are labeled Promise summary and do not replace original source text or prove an invoice exists. Case summaries distinguish original amounts, matched shares of notes, invoice deductions, conditions and comparison baselines. A local financial action does not compose or send an email.

**Add documents** opens Document review. Browser mode retains up to thirty fictional case snapshots; managed mode retains source-analysis versions, reviewed imports and saved draft versions with separate analyst/approver roles. Exact-draft approval permits an unsent EML export. Later editing or source rebinding requires renewed review. Selected records and drafts survive ordinary navigation; exact missing routes show unavailable states instead of selecting substitutes. Session/workspace changes must isolate retained work.

**Office map** is an original six-building illustration inside this same file frame. Buildings open actual records, and Back to the file restores the prior route. Camera/fit/drag, DOM links, pause/visibility-aware motion and reduced-motion controls remain available. [NOMEN_ADAPTATION.md](NOMEN_ADAPTATION.md) preserves the scene’s earlier provenance and behavior evidence. Illustrative couriers do not prove financial transactions.

**Developer tools** retains bounded program-order comparisons, current-action snapshots, custom scenarios, inconclusive resource cutoffs, replay/export and fixed-family repair. Permissions retains exact-action review, Ed25519 limits/narrower delegation, expiry/revocation, atomic one-use execution/retry and separately pinned-key verification. An unavailable action must not silently become another browser example.

## Run and inspect

Use Node 24 or later. `npm ci` installs dependencies. Run `npm run dev` and open http://127.0.0.1:5173; the supervisor starts Vite and a loopback demo HTTP/SQLite service. `npm run dev:web` runs the browser-only UI with localStorage and selectable demo roles. `npm run backend` starts managed mode after [account bootstrap](BACKEND.md#run). New managed workspaces start empty; managed session roles are independent of selectable demo identities. No API key is required.

Direct routes remain `?view=assurance` for Cases, `?view=credits` for Credit notes, `?view=operations` for Needs attention, `?view=library` for Documents, `?view=vendors` for Companies, `?view=audit` for History, `?view=reports` for Reports, `?view=execution` for Developer tools and `?view=world` for Office. Internal names remain for compatibility.

Inspect normal-motion case entry, interrupted Back/Escape, reversal and return. Source uses 420ms FLIP/WAAPI clones for the same company seal/name, with an immediate reduced-motion alternative. Inspect actual wide, intermediate and phone layouts, navigation focus, scroll return, exact source revisions, drafts, recovery and empty/error/role states. Captures taken before later repairs cannot establish those repairs passed. The lead records current operated outcomes; this documentation pass makes no functional-test result claim.

## Representative journeys

1. Open Pipeline’s conversation. Its $2,400 promise and $900 invoice credit leave $1,500 missing. Compare a later date proposal with a renewal proposal: $2,400 incremental annual spending versus an explicit $6,000/month baseline yields −$900 net value for $1,500 credit. Editing comparison assumptions does not authorize a deal. Resolve competing proposals with a retained reason, then separately review, approve and record exact terms. Future acceptance takes effect only on its effective date.
2. Approve an original-terms action, revise a cited source and try execution. The old approval is stale. Policy and material financial changes invalidate it too; each approved local action executes once.
3. Open a case’s Credits tab or Documents → Credit notes. Record an issued memo or an applied invoice credit with stable line identity, exact USD amount, effective date and source text. Preview actual deltas; optional attribution leaves the remainder available. Add invoice evidence to the same line, assign within conserved capacity or reverse exact backing. Issued value alone does not become verified savings. Duplicate lines, excessive attribution, invalid dates and wrong roles are refused.
4. Review an ambiguous match. An analyst records clarification; an approver binds the exact source revision and explicit limits; an analyst attributes only within those limits. Resolution invents neither credit nor invoice application and preserves existing allocations and historical caps.
5. In Reports or File options, change Effective on and Known by independently. Later evidence must not leak into an earlier knowledge cutoff. Historical comparisons are read-only; exports retain exact integer cents and neutralize formula-bearing text.
6. Add documents. Supported promise text, positive invoice-credit CSV and an optional reply undergo vendor, USD, reference, date, provenance and duplicate checks. Exact quote offsets remain inspectable. Changing the Pipeline example’s applied amount from `900.00` to `1000.00` changes its balance from $1,500 to $1,400. Unsupported, future/originally conditional or unknown replies require review. A later conditional reply does not amend the original agreement.
7. Save a reviewed import. Original inputs are reanalyzed and sources, commitment, credit and allocation commit atomically. Identical reimports do not duplicate value. A changed reference cannot create a second credit from one legacy invoice. The CSV adapter supports one credit per vendor invoice; the structured engine supports explicit line identities. Draft approval and unsent export remain separate from financial-action approval.

The guided examples remain synthetic and separate: a covered nine-hour Nimbus outage in a 30-day month yields 98.75% availability and a $2,000 SLA claim (25% of $8,000). Pipeline shows $2,400 promised, $900 applied and $1,500 outstanding. Simulated invoice arrivals and replies are labeled.

## Developer tools walkthrough

In Developer tools → Test runs, Run comparison explores two workers caching the same $900 credit. The six allowed program-order-preserving schedules contain a four-step unsafe reference trace that allocates $1,800. Inspect the guarded reducer’s rejection of the same raced allocation. View revised workflow applies atomic current-state checks; both repaired orders finish safely for that family. Source-revision, deadline and amendment races have their own outcomes: deadline repair finishes one of two orders because expiry still blocks the other. The benign workflow succeeds unchanged.

A 10-state budget returns inconclusive. Custom finite JSON programs run as supplied and export replayable reports; automatic repair is restricted to unchanged known families. These are scripted proposals, not an LLM safety evaluation or general program synthesis. A current approved action can be analyzed under Approved workspace actions with no extra event, a hypothetical source revision or its actual deadline. The copied model retains exact approval/source bindings and adds no live event or grant.

Permissions separates approval, constrained delegation and execution. Issue an Ed25519 grant, optionally sign a narrower child and prove possession of the agent key. Execution checks exact action, full approval binding, basis, policy, scope, expiry/revocation, current revision and unused root nonce. The local effect, consumed authority, audit and signed receipt commit together. Exact retries recover their receipt; fresh reuse fails; reset cannot revive a grant. Browser authority runs in a labeled isolated ephemeral workspace with memory-only private keys; server authority uses SQLite.

Cases → More → Run checks runs nine adversarial reducer scenarios with typed rejections and thirty-one authored checks. The advanced command console uses the same boundary; its valid remaining-credit batch records supplied invoice evidence, a credit line and its allocation atomically.

## Verification and replay

```sh
npm run check
npm run test:workspace:all
npm run verify:workspace-redesign
python3 scripts/verify-frontend-guidance.py
npm run verify:assurance-packet -- output/playwright/workspace-records-audit-packet.json
```

The browser runner builds isolated previews and operates managed accounts, workspace views, credit fulfillment/recovery in SQLite and static modes, and guided/document examples. Its companion verifier replays actual downloads. Owned temporary services do not reset the developer’s saved workspace. Current acceptance remains in [CORRESPONDENCE_DESIGN.md](CORRESPONDENCE_DESIGN.md), with historical [backend coverage](BACKEND_ACCEPTANCE.md). Financial unit tests, HTTP persistence/concurrency tests, evidence regressions and synthetic evaluations establish specified model behavior, not held-out accuracy or formal verification.

Export audit packet includes sources, projection dates, state and decisions; local service mode includes the command chain, actor context and original seed for replay. Verification detects changes relative to that seed. A database owner can replace the entire consistent chain, so hashes do not authenticate source evidence or establish settlement.

```sh
npm run verify:exploration -- --check /path/to/truthful-exploration.json
npm run verify:authority -- /path/to/truthful-authority-evidence.json --trust /path/to/truthful-pinned-issuer.json
npm run analyze -- --vendor "Pipeline CRM" --promise public/examples/pipeline-promise.txt --invoices public/examples/pipeline-invoices.csv --as-of 2026-10-28 --out /tmp/truthful-packet.json
npm run verify:packet -- /tmp/truthful-packet.json
```

Pin the public trust key through an independently trusted process. A key bundled with its packet does not establish identity. Signatures authenticate the selected key’s recorded statement; compromised keys, cloned databases, omitted actions, current offline revocation and external settlement stay outside proof. The earlier evidence CLI uses a separate packet format. The authority profile claims no AP2/UCP/MCP/A2A or IETF-draft conformance.

## Preserved backend and delivery boundaries

[BACKEND.md](BACKEND.md) covers sessions, workspace membership, durable evidence/previews, versioned claim approval/unsent export, persisted execution reports, optimistic revisions, idempotency, atomic batches, health, backup and verified restore. [FRONTIER_RESEARCH.md](FRONTIER_RESEARCH.md) and [TECHNICAL_DEEP_DIVE.md](TECHNICAL_DEEP_DIVE.md) preserve research and trust limits. Earlier numerical checkpoints describe their own dates; they are not current redesign results.

The November 6 [credit workflow checkpoint](CREDIT_WORKFLOW_REVIEW.md) added source-backed fulfillment and amendment authoring. The November 7 [workspace expansion](WORKSPACE_EXPANSION.md) added connected destinations and ambiguity resolution. Its 69 source screen models, 14 boards and 483 mapped interactions belong to the earlier design kit. The native Figma file’s previously verified baseline is 17 screens; expansion persistence remains blocked by editable file access and a connected FigCli bridge. None establishes parity with this candidate.

Vite ignores generated Figma HTML and output artifacts for hot reload. All included material is synthetic. Runtime extraction is rule-based; no live LLM, external inbox, Ramp, vendor, payment or accounting feed is connected. Managed authentication is local, not external identity-provider integration. No external transaction or message is executed. Videos, public release, native Figma and external submission facts remain separate from this development pass.
