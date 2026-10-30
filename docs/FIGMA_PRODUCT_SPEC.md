# Truthful · Product design specification

**Make the next move earn its authority.**

Team OVO · v4 development build · Design content and prototype plan

This specification describes the working product and one explicitly labeled concept. Its companion [screen map](FIGMA_SCREEN_MAP.json) provides frame IDs, viewports, entries, actions, destinations and annotations. The completed [native Figma file](https://www.figma.com/design/8j4pwtsGDI4seljHPNeUkI) contains 17 editable screens, 7 story boards, 12 components and 13 color variables. Its separately checked creation, cloud version, exact links and visual-review scope are recorded in the [native record](../design/figma/native-record.json). Twenty review-note overlays explain controls that do not navigate to another screen. A shared editable navigation overlay connects the three mobile review screens. Video work is outside this task.

## Product brief

A finance lead needs a vendor’s promised credit honored without accepting a worse renewal, counting one credit twice, or allowing an agent to use an approval whose evidence has changed. Today’s useful question is concrete: **does this exact next move remain justified, and what did the trusted boundary actually record?**

Truthful traces supported evidence into a financial portfolio, makes changed terms economically explicit, binds review to the current action, challenges finite proposed workflows, and records scoped local execution with verifiable history. The design keeps the evidence, amount and permission beside the decision they explain.

The anchor is fictional Pipeline CRM: **$2,400 promised, $900 applied, $1,500 outstanding**. A proposed renewal adds $2,400 of incremental spend under the explicit same-horizon baseline for a $1,500 contingent benefit: **−$900 net incremental value**. Preserving original terms creates no applied savings. These are authored demonstration values, not measured customer outcomes.

The differentiation is the implemented connection between changing financial evidence, bounded adverse schedules, legitimate completion and current-state execution checks. Agent payments, signed permissions, negotiation and counterexample-guided repair already exist. Do not use “first,” “only,” or claims about competitors’ internal controls. See [the primary-source research](FRONTIER_RESEARCH.md).

## The review story

**Evidence → portfolio → exact approval → bounded stress test → scoped grant → local effect → independently pinned verification.**

Start with the missing credit, expose the cost of the later offer, and review a preserve-original-terms action. Copy its actual current approval and source revisions into a finite model. A hypothetical source revision can fall between check and commit: the deliberately unsafe cached-check reference commits while the real current reducer refuses `STALE_APPROVAL`. The financial portfolio remains unchanged by this exploration.

Use a separate unchanged authored family to demonstrate a permitted repair. The concurrent-credit repair preserves both distinct intents and uses atomic current-state allocation; the second consumer cannot spend the same capacity again. Show legitimate goal completion separately from rejected attempts. Edited/custom and portfolio-copy programs have no invented automatic repair. A search cutoff remains inconclusive.

Continue into the signing lab with its own exact finance approval. Issue a narrow grant to an agent key, optionally attenuate it, and execute a local action. Demonstrate the difference between an identical retry returning the old receipt and a fresh attempt using consumed authority being refused. Export the signed history, pin the issuer deliberately, verify, then alter a signature and show rejection.

**Continuity boundary:** evidence promotion into the portfolio and portfolio-copy exploration are implemented. The current signing UI is Pipeline-focused. In browser mode it operates on a separate ephemeral synthetic workspace, rather than signing the persisted browser portfolio. The arbitrary selected-case handoff is frame 14, visibly labeled **CONCEPT**. The current UI also permits direct local execution after approval; exploration is not yet a mandatory product gate. Keep both facts visible in the design review.

## Board structure

| Board section | The review decision it supports |
| --- | --- |
| Start here | Understand the product, synthetic-data boundary and implemented/concept legend. |
| The job and anchor case | Assess the finance operator’s problem and the explicit renewal economics. |
| Desktop workflow | Follow the current product from evidence to recorded local authority. |
| Adverse states | Inspect stale evidence, a bounded cutoff, consumed/revoked scope and altered signatures. |
| Mobile review | Confirm that the amount, rejection reason, source identity and trust decision survive stacking. |
| Components and tokens | Reuse the incumbent finance desk system with explicit state semantics. |
| Trust boundaries | Distinguish a financial claim, exact approval, signed permission, local effect and offline evidence. |
| Next connection | Review the selected-case handoff concept and the work needed for a real pilot. |

## Screen inventory

Use 1440 × 960 desktop viewports and 390 × 844 mobile viewports. Long content may scroll; do not shrink the entire work surface to fit a single viewport. Capture real state before exporting its editable layer representation. No invented hashes, approvers, fingerprints, dates or receipt IDs should be inserted into implemented frames.

| ID | Frame | Status | Key content |
| --- | --- | --- | --- |
| evidence-input | 01 · Start with the source | Implemented | Supported text/CSV, example, vendor/date and local-processing boundary. |
| evidence-finding | 02 · Find the missing $1,500 | Implemented | Monetary state, exact source citation, reference match and portfolio promotion. |
| portfolio | 03 · Follow the financial state | Implemented | Distinct totals, actual evidence graph, shared ledger and temporal controls. |
| renewal-decision | 04 · Expose the cost of the offer | Implemented | Contingent benefit, incremental renewal cost and explicit baseline. |
| exact-approval | 05 · Approve the current exact action | Implemented | Exact action, current policy, source/material basis and approver event. |
| race-setup | 06 · Challenge a copy of the actual approval | Implemented | Approved action, exact snapshot, hypothetical event and finite limits. |
| race-witness | 07 · Inspect the unsafe effect | Implemented | Three-step source race, current reducer refusal and portable replay. |
| race-cutoff | 08 · Preserve uncertainty at the bound | Implemented | Inconclusive result, cutoff, search extent and incomplete completion. |
| race-repair | 09 · A permitted continuation | Implemented | Unchanged authored family, concrete repair and legitimate completion. |
| authority-approval | 10 · Finance approves the signing-lab action | Implemented | Pipeline action and explicit SQLite/isolated-browser runtime. |
| authority-scope | 11 · Issue only the required scope | Implemented | Amount, $0 new obligation, lifetime, bound identity/basis and narrower child. |
| execution-receipt | 12 · Recheck and record once | Implemented | Atomic local effect, consumed root, receipt and identical retry. |
| packet-verification | 13 · Trust deliberately; verify the record | Implemented | Unpinned/pinned root, verification, tampering and offline limits. |
| connected-handoff-concept | 14 · One selected case across the boundary | Concept | Same-case/action identity across financial review, analysis and grant issuance. |
| mobile-approval | Mobile · Exact approval | Implemented responsive layout | Stacked decision queue and review without losing the amount or basis. |
| mobile-witness | Mobile · Selected transition | Implemented responsive layout | Numbered trace followed by a legible rejection inspector. |
| mobile-receipt | Mobile · Authority and verification | Implemented responsive layout | Stacked scope, effect, receipt and deliberate trust decision. |

“Implemented” refers to the source behavior and current responsive layout. It does not mean an external service is connected or a Figma capture is already verified.

## Prototype interactions and adverse states

Use the action map in JSON as the navigation source. Its original 41 review controls are retained, with three additional mobile navigation triggers and three destinations in the shared navigation overlay. All 47 mapped controls are represented in the editable models. Entries explain any setup needed before a recorded state can be reached. Six additional working-app behaviors are preserved as explicit alternate-state annotations rather than phantom prototype links: direct execution after approval, switching an authored family to a ten-state cutoff, selecting guarded replay on desktop and mobile, switching from a portfolio witness to an authored repair, and preparing a fresh action from the condensed mobile receipt view. Label concept-only hotspots visibly.

The main prototype story connects evidence, portfolio review, exact approval, the portfolio-copy race, the separate signing lab, the local receipt and verification. The cutoff and fixed-family repair frames are separate authored-program review states; reviewers reach them through board or reviewer navigation, rather than a false claim that replay automatically repairs a copied portfolio action. Any reviewer navigation belongs outside the product preview and must be labeled as such.

- **Evidence:** editing inputs clears earlier results. Unsupported or ambiguous evidence stays in review; no zero balance or ready approval is fabricated. Claim approval and exact-action approval are separate records.
- **Terms:** a proposal does not change the accepted original agreement. Dismissal retains its reason/history. Historical views disable write actions.
- **Analysis:** keep not-run, loading, unsafe, bounded-no-unsafe-effect, inconclusive and input-error states distinct. A changed scenario/budget/program invalidates a pending result. Bind a replay verdict to the displayed packet.
- **Authority:** issuance requires current exact approval. Source revision, expiry, revocation or a fresh use of consumed authority cannot be rescued by a valid signature. The identical retry is a historical result, never a new permission.
- **Verification:** no issuer is trusted initially. Show the explicit pin and separate trust-key export. A damaged signature receives a named rejection. A success notice must retain its scope: included signed history at a checkpoint.

Use real app labels including **Analyze evidence**, **Add to portfolio**, **Approve exact action**, **Explore schedules**, **Replay report**, **Issue signed grant**, **Record delegated action**, **Retry identical request**, **Pin this demo issuer**, and **Verify signed packet**. Do not add a current “Run approved agent” CTA that silently skips the actual approval/runtime boundaries.

## Visual and component direction

Use the redesigned working-ledger system recorded in [DESIGN.md](../DESIGN.md): Public Sans, forest `#176448`, graphite `#20252b`, canvas `#f7f8fa`, paper `#ffffff`, neutral rules `#e3e7eb` and readable named financial states. Semantic state has a readable name as well as color. Monetary values use tabular figures. Keep decision-critical annotations at 12px or above; inherited tiny metadata is not a reusable precedent.

The component library should contain workspace navigation, primary/secondary/text actions, labeled fields, money-state summaries, exact source citations, source revision facts, decision rows, policy verdicts, authorization basis, search verdicts, numbered trace rows, selected-transition inspector, grant scope/lifecycle facts, receipt and trust-root controls. Include disabled, loading, focus, error and inconclusive variants where the current component supports them.

Keep resting surfaces flat with fine rules. Shadows identify temporary overlays. At narrow widths, stack queue/detail, verdicts, trace/inspector and signing panels in their reading order. Keep actions in normal flow; wrap identifiers without horizontal overflow. The component board must distinguish a visual component variant from a newly implemented backend capability.

## Trust and runtime boundaries

All included sources, parties, programs and effects are synthetic demonstrations. No live LLM, inbox, Ramp, vendor or payment integration is connected. Runtime checks are deterministic code. No AP2/UCP/MCP/A2A or IETF-draft interoperability, post-quantum protection, passkey identity, formal proof or universal invoice understanding is claimed.

The local SQLite service provides durable transactions, revisions, roles, retry records and issuer lifecycle inside its trust boundary. Human identities are selectable demo sessions. A database/key owner remains inside that boundary. Browser signing has real cryptography and ephemeral keys in an independent workspace; it is not shared durable server enforcement.

Offline verification can check included signatures and replay the recorded action relative to the explicitly trusted signer. It cannot establish current revocation, globally unspent authority across database forks, authentic vendor source evidence, feed/log completeness, real organizational identity or external settlement. A receipt establishes no new permission to execute again.

## Roadmap and evaluation

**Implemented now:** supported evidence reconciliation/promotion, conserved financial state, versioned terms, current exact approvals, actual portfolio-copy exploration, finite custom/authored programs, fixed repairs for five unchanged authored families, scoped Ed25519 delegation, one-use local execution and independently pinned history verification.

**Next product concept:** one selected-case handoff into authority, retaining case/action/workspace identity, current approval basis and analysis reference. Recheck eligibility at both issue and execute. Do not treat an analysis report as a grant. Resolve browser workspace ownership explicitly rather than silently mixing its independent lab state with the persisted portfolio.

**Pilot prerequisites:** authenticated permissioned source intake, organizational roles and key custody, narrowly scoped external adapters, replay/revocation/recovery failure handling, and independently labeled operator cases. Evaluate unsafe effects, legitimate completion, false blocks, evidence-review time and incremental applied value separately. Current authored fixtures and browser checks are regression evidence, not a held-out accuracy study or customer ROI benchmark. Protocol adapters require their own normative mapping and conformance tests.

No rollout dates, service connections, recovery totals or model performance are promised by this roadmap.
