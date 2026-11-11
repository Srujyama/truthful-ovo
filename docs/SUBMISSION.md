# Truthful · OVO

BBS × Ramp Hackathon, Round 2 · technical build

**A credit cannot be spent twice. An old approval cannot authorize a changed deal.**

## The brief

**“Automate an outdated financial workflow using the newest AI tools.”** The workflow: chasing vendor credits through inboxes and spreadsheets. The tools: Claude Opus 5.5 for reading, an event-sourced ledger for the money, and a product a finance team can open and understand in five seconds.

## Delivered links

- Public repository: https://github.com/Srujyama/truthful-ovo (the build below is on branch `craft/isokra` until it is merged)
- **Live product (team accounts, sign-in, roles): https://truthful-ovo.fly.dev**
- **Live demo (this build, no sign-in): https://truthful-ovo.vercel.app** — opens on Truthful's quarter; add `?demo` for the guided two-minute walkthrough (https://truthful-ovo.vercel.app/?demo#/). Browser-only demo book; nothing is sent anywhere.
- Older GitHub Pages build (v3): https://srujyama.github.io/truthful-ovo/

## Form-ready project name

Truthful

Team: OVO. Confirm that the technical path matches the team’s Round 1 selection before submitting.

## Short description

Vendors promise credits by email; invoices forget them. Truthful reads every promise and every invoice with Claude, verifies every figure against the exact words it came from, writes each promise down as an IOU, weighs every invoice against it, and drafts the letter asking for what is still owed. A person approves before anything goes out. The ledger refuses a credit spent twice, an approval for a changed deal, and an offer with strings counted as money.

## Architecture answer — 292 words

Truthful is a neuro-symbolic agent pipeline that automates vendor-credit recovery, a workflow that still lives in inboxes and spreadsheets.

**Perception (LLM).** Claude Opus 5.5 turns unstructured vendor correspondence (emails, contracts, invoice CSVs) into a typed claim graph: commitments, credits, conditions, references and due dates. Output is constrained by a JSON schema, and every node carries the verbatim span it was read from. Refusals route through server-side model fallback.

**Grounding (symbolic).** A deterministic verifier aligns each span against the source and re-parses its amount, rejecting ungrounded or hallucinated facts before they can touch state. The model proposes; the symbolic layer disposes.

**State.** An event-sourced, bitemporal ledger (effective time × knowledge time) with integer-cent reducers. Invariants run on every command: credit conservation across commitments, approvals bound to content digests of their evidence basis (any drift voids them), and conflict detection across competing amendments. A hash-chained audit log makes every projection replayable.

**Agents.** Reader → recorder → reconciler → drafter → human approval gate, each stage a tool around the ledger. The UI renders them live, replayed from the real event log.

**Product.** React and Vite on Node 24 with per-tenant SQLite, session auth with CSRF, role-based approvals and atomic idempotent batches, deployed on Fly.io and Vercel.

**Tradeoffs.** We kept the LLM at the perception boundary and out of the money path: correctness and auditability over autonomy. Constrained decoding over free-form output; low effort for extraction latency. No fine-tuning: grounding plus verification beat training data we don't have.

**With more time.** Verifier rejections become labelled signal for an active-learning eval loop. A Claude tool-use negotiator reads replies, sequences follow-ups and proposes amendments under the policy engine. Retrieval over MSAs and SLAs computes entitlements from telemetry. Gmail and Ramp Bill Pay connectors close the loop automatically.

## What the submitted build proves

| Capability | Executable evidence |
| --- | --- |
| Global allocation | A second allocation of the same $900 credit is rejected without increasing verified value. Ambiguous matches require source-backed finance resolution. |
| Competing amendments | Pipeline’s date change and renewal counteroffer conflict. Finance dismisses an alternative with a reason before a fresh action can accept the current branch. |
| Stale authority | Approve an exact action, revise a source or policy, then attempt execution. The old approval is rejected. |
| Renewal economics | $1,500 remaining contingent credit against $2,400 incremental annual spend yields negative $900 under the stated baseline. No acceptance creates applied savings. |
| Temporal truth | Effective-on and known-by cutoffs distinguish a late amendment’s retrospective effect from what was knowable earlier. Missing evidence remains unknown. |
| Ledger lifecycle | An issued memo contributes no verified savings. Invoice application verifies it; a reversal reopens the balance. |
| Durable local service | Real HTTP sessions, roles, atomic batches, optimistic concurrency, persistent idempotent results, and replayable SQLite audit. |
| Generalized input | In Evidence lab, change the matching credit from `900.00` to `1000.00`; the $1,500 gap becomes $1,400. Add supported evidence to the portfolio through a revalidated atomic import. |

The failure suite runs nine authored attack scenarios with thirty-one assertions against the real reducer, alongside the full assurance-domain test suite.

## Optional “anything else” response

Truthful pairs Claude’s reading with an engine that cannot be talked out of the numbers: a credit cannot be counted twice, a changed deal cannot inherit an old approval, and an amendment cannot rewrite what was knowable earlier. It ships as a working product (accounts, teams, roles, audit) and as an instant demo: open the link and watch Truthful’s agents work through a real book, or press ?demo for the guided two-minute walkthrough.

