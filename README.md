# Truthful · Team OVO

**Follow a promised credit from its original documents to the invoice.**

Truthful brings vendor promises, credit notes, invoices and follow-up work into one workspace. It keeps original documents and changed terms inspectable, distinguishes issued credits from money actually applied, and separates preparation, approval and execution. Workflow tests compare competing actions and verify permission before an effect is recorded. Built for the BBS × Ramp technical round.

[Development status](docs/DEVELOPMENT.md) · [Technical deep dive](docs/TECHNICAL_DEEP_DIVE.md) · [Frontier research](docs/FRONTIER_RESEARCH.md)

V4 is a local development build. Media and submission packaging are deferred; the existing public deployment remains the earlier v3 build.

The [backend build](docs/BACKEND.md) adds managed accounts, isolated empty workspaces, durable evidence and reviewed financial workflows, versioned claim approvals/unsent exports, persisted execution analysis, portable verification and verified backup/restore. [Acceptance coverage](docs/BACKEND_ACCEPTANCE.md) maps the existing product's backend features to real HTTP, replay and browser evidence. `npm run dev` starts the clearly labeled fictional demo; `npm run backend` starts managed mode after account bootstrap. The UI discovers the selected service and exposes actual sign-in, invitation enrollment and workspace switching in managed mode.

The development UI opens **Follow-ups**: searchable records, a complete case view, original documents, credits and history. **Credits** lists actual notes and invoice adjustments; **Tasks**, **Companies**, **Documents**, **Activity** and **Reports** each provide a view for their particular job. The operational system uses Public Sans, dark ink, white working surfaces and restrained blue selection/actions. The organizing relationship is the same follow-up, source version and draft across inspection and return. [The overhaul record](docs/UI_OVERHAUL.md) tracks requirements and current verification.

**Office map** is a secondary original spatial overview with six buildings and links into actual records. Its earlier [Nomen adaptation milestone](docs/NOMEN_ADAPTATION.md) was rejected as sufficient application design; its scene and historical checks do not establish acceptance of the current workspace. Native Figma below still describes the earlier design milestone.

The [expanded Figma source kit](design/figma/README.md) contains 69 editable screen models, 14 product boards and 483 mapped review interactions. Its complete source gallery is rendered and checked. The [native Figma file](https://www.figma.com/design/8j4pwtsGDI4seljHPNeUkI) retains its previously verified 17-screen baseline; saving the expansion is waiting for editable file access and a connected FigCli bridge. The [expansion record](docs/WORKSPACE_EXPANSION.md) separates source verification from native persistence.

These views share the same financial records, with exact-source inspection, case/action navigation, independent financial/document-cutoff dates and exact-cent exports. Ambiguous credits require analyst clarification, approver assignment limits, and analyst assignment within those limits.

## Test a workflow

**Workflow tests → Test runs → Run comparison.** Two workers cache the same $900 credit. The explorer enumerates the six allowed program-order-preserving schedules and finds a four-step unsafe reference trace: $900 becomes $1,800 allocated. Select that effect, then inspect the current reducer’s rejection of the same raced allocation.

**View revised workflow** commits each original intent through an atomic current-state check. The claim finishes safely in both repaired orderings. Other scenarios race source revisions, claim deadlines, and competing amendments. Deadline repair honestly finishes only one of two orders; expiry still blocks the other. An unchanged benign workflow succeeds.

Choose the 10-state budget to observe **inconclusive**, not a green pass. Inspect/edit the finite JSON program and export its replayable report. Custom plans are checked as supplied; automatic repair is restricted to known unchanged authored families. These are scripted proposals, not an LLM safety evaluation or a general program-synthesis system.

To analyze a current portfolio action, review and approve it in **Follow-ups → Approvals**, then choose it under **Approved workspace actions** in Test runs. Select no additional event, a hypothetical supporting-source revision, or its actual claim deadline. The copied model retains the exact approval and source versions; analysis adds no live events or grants.

**Workflow tests → Permissions** separates finance approval, constrained delegation, and execution. Issue an Ed25519 grant, optionally sign a narrower child, and let its agent key prove possession. The boundary rechecks the exact action, full approval record, basis, policy, scope, expiry, revocation, expected revision, and unused root nonce. It consumes authority and records the local effect, audit, and signed receipt together. An exact retry returns its original receipt; a fresh use fails. Reset cannot revive an old grant.

Export the signed packet and public trust key separately. Verification refuses an unpinned issuer or altered signature and replays the recorded financial effect. Browser mode runs real signatures in a clearly labeled **isolated ephemeral authority workspace**; it does not share the browser portfolio’s state. Server mode uses the local SQLite workspace. Private browser keys are held only in memory.

The dated [frontier research](docs/FRONTIER_RESEARCH.md) explains the October 2026 developments behind this design, current protocol versions, what is implemented, and what would falsify the product argument. This is a custom Truthful profile; no AP2/UCP/MCP/A2A or IETF-draft conformance is claimed.

## Run the full build

Node 24 or later:

```sh
npm ci
npm run dev
```

Open **http://127.0.0.1:5173**. One supervisor starts Vite and the loopback HTTP/SQLite service. The account menu identifies the active runtime. No API key or external account is required. SQLite data stays in the ignored `server/data/` directory.

The existing public GitHub Pages deployment is the earlier v3 build. The current browser build runs the financial engine with localStorage persistence and selectable demonstration roles; it has no shared backend or independently enforced server authority. `npm run dev:web` runs that browser UI locally.

## Five decisions worth demonstrating

1. **A concession can lose money.** Pipeline owes $1,500. Its renewal offer adds $2,400 of annual cost versus an explicit $6,000/month baseline. Net incremental value is **−$900**. Edit the comparison assumptions and see the calculation change without authorizing a deal.
2. **Proposals do not replace agreements.** A date amendment conflicts with the renewal. Dismiss an alternative with a retained reason, review the remaining branch, then approve and record it. Future acceptance affects terms only on its effective date.
3. **Approval expires when its basis changes.** Approve the original-terms action, revise a cited source, and try to execute. The previous approval is stale. Policy and material financial changes also invalidate it. Each approved local action executes once.
4. **An applied dollar belongs to one balance.** Credit capacity is conserved across the portfolio. Issued memos add no verified savings. A reversal reduces verified value and reopens the original obligation. Ambiguous matches are quarantined.
5. **Knowing later is different from being effective earlier.** Change **Effective on** and **Known by** independently. Replay the evidence available at the cutoff; later facts do not leak into the old history. Historical comparisons are read-only.

**Follow-ups → More → Run checks → Run all cases** executes nine adversarial scenarios with actual reducer commands, typed rejections, and thirty-one checks. Inspect the execution steps. The advanced console also mutates the open workspace through the same checked boundary; the valid remaining-credit batch records supplied invoice evidence, a separate credit line, and its allocation atomically.

## From supplied evidence to shared state

**Add documents → Document review** accepts supported promise text, invoice-credit CSV, and an optional reply. It checks vendor, USD, reference, dates, duplicate identities, and provenance; exact source offsets remain inspectable. Change the example's `900.00` applied amount to `1000.00`: the remaining balance changes from $1,500 to $1,400. Unsupported or conflicting terms require review.

In the browser demo, **Save to workspace** reanalyzes original inputs and imports sources, commitment, credit, and allocation as one atomic operation. Identical reimports do not duplicate value. A changed reference cannot invent a second credit from the same legacy invoice. This CSV adapter supports one credit per vendor invoice; the structured engine supports explicit line identities.

The earlier **Examples → Guided cases** remains available: a covered nine-hour Nimbus outage produces a $2,000 SLA claim, a conditional reply, and distinct issued/applied states. Document-review draft approval produces an unsent EML; it does not authorize a separate financial action. Managed mode retains source analyses and follow-up draft versions on the server, with reviewed imports and separate analyst/approver roles.

## Follow a credit through fulfillment

Open a follow-up, select its **Credits** tab, and choose **Record credit**. The main **Credits** destination also links each credit to its follow-up and supporting documents. Supply the memo or invoice reference, its stable line identity, exact USD amount, effective date, and source text. Record an issued memo or an applied invoice credit; optional partial attribution leaves the rest available. Review the financial preview before confirming. An issued credit never creates verified applied value.

Each credit exposes **Assign to follow-up**, **Add invoice evidence**, and **Reverse credit** as applicable. Invoice application uses the existing line. Reversals identify exactly which attributed amounts lose backing. Bound source revisions remain inspectable, and the source/ledger batch commits atomically. Duplicate physical lines, excess attribution, invalid dates, and wrong roles are refused.

**Add proposed changes** prepares amount, due-date, deadline, condition, or renewal changes for the selected commitment. The original agreement remains active until a separate approver approves the exact action and an executor records it. Renewal proposals require an explicit baseline and incremental cost; policy restrictions remain visible. The case summary retains the original amount beside changed accepted terms.

These forms work in local SQLite and browser-local modes. They record supplied evidence; no issuer is authenticated or contacted. Ambiguous credits expose a matching review: an analyst records clarification, an approver binds exact source-backed limits, then an analyst attributes within those limits. See the [credit workflow record](docs/CREDIT_WORKFLOW_REVIEW.md) and [current expansion](docs/WORKSPACE_EXPANSION.md).

## Verify and replay

```sh
npm run check
npm run verify:depth
npm run verify:frontier
npm run test:workspace:all
npm run verify:workspace-redesign
python3 scripts/verify-frontend-guidance.py
npm run verify:assurance-packet -- output/playwright/workspace-records-audit-packet.json
```

The current operated outcomes, independent review repairs and download verification are recorded in [the overhaul record](docs/UI_OVERHAUL.md). The build contains financial unit tests, real HTTP/SQLite persistence and concurrency tests, evidence regressions, and authored synthetic evaluations. These establish specified model behavior, **not held-out accuracy or formal verification**. Browser acceptance scripts in `scripts/` exercise the real rendered flows in both local-service and static modes using the Playwright CLI.

**Export audit packet** includes sources, temporal projection, financial state, and decisions. In local-service mode it also includes the command chain, actor context, and initial state for replay. The verifier detects a changed exported state or chain relative to the stored seed. Someone controlling the entire database can rewrite that seed and recompute the chain; hashes do not authenticate evidence or establish settlement finality.

The frontier artifacts have their own independent verifiers:

```sh
npm run verify:exploration -- --check /path/to/truthful-exploration.json
npm run verify:authority -- /path/to/truthful-authority-evidence.json --trust /path/to/truthful-pinned-issuer.json
```

The trust file must be pinned through an independently trusted process. A public key supplied with a packet does not establish identity. Signatures authenticate the selected key’s recorded statement; compromised issuer keys, cloned databases, omitted actions, current revocation, and real-world settlement remain outside offline proof.

The earlier evidence CLI uses a separate packet format:

```sh
npm run analyze -- --vendor "Pipeline CRM" --promise public/examples/pipeline-promise.txt --invoices public/examples/pipeline-invoices.csv --as-of 2026-10-28 --out /tmp/truthful-packet.json
npm run verify:packet -- /tmp/truthful-packet.json
```

## Architecture and limits

React 19, Vite 7, plain CSS, dependency-free financial/evidence engines, integer-cent arithmetic, Node 24 HTTP/SQLite/crypto, optimistic revisions, durable idempotency, atomic batches, and hash-linked replay. The local service derives roles from server sessions and rejects stale writes and unauthorized commands. Any loopback user can deliberately choose a demo role, including admin; production identity and organizational authority are not connected.

Runtime extraction is rule-based. **No live LLM, inbox, Ramp account, vendor, payment, or accounting system is connected.** No emails, renewals, or payments are performed. Supplied structured text and records are not independently authenticated. USD only; supported contracts and amendments have explicit bounds. All included vendors, invoices, outcomes, and sources are synthetic.

Existing companies offer reconciliation, recovery, negotiations, and authority controls. Our competitive argument is the inspectable integrated failure-to-resolution workflow; see [source-backed comparison](docs/COMPETITIVE_RESEARCH.md). We make no first-of-its-kind claim.

## Submission materials

- [Copy-ready 200–300 word architecture answer](docs/SUBMISSION.md)
- [Three-minute demo and engineer appendix](docs/DEMO_SCRIPT.md)
- [Technical deep dive](docs/TECHNICAL_DEEP_DIVE.md)
- [Architecture](docs/ARCHITECTURE.md), [product brief](docs/PRODUCT_BRIEF.md), [judge Q&A](docs/JUDGE_QA.md)
- [Verified form requirements](docs/FORM_REQUIREMENTS.md), [delivery facts and external decisions](docs/DELIVERY.md)

The form requires public source and an accessible Drive/Loom/YouTube recording. Team consent, original track, final attendance, and accepted-host video sharing remain factual submission decisions; the application has not been submitted.

MIT license. Included source examples are synthetic.
