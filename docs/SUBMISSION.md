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

## Architecture answer — 293 words

Truthful automates the spreadsheet-and-inbox chase for vendor credits: a promise arrives by email, invoices arrive monthly, and money quietly goes missing.

Reading is AI-first. Claude Opus 5.5 reads any email, contract or invoice into schema-constrained facts (vendor, amount, due date, reference, conditions, credits), each carrying the exact quote it came from. Deterministic code then checks every quote appears verbatim in the source and every amount matches its quote, and drops anything that fails; the verified reading is shown for review beside the built-in reader’s, and only the engine writes to the ledger. The model proposes; the rules decide. With no key, the built-in reader runs alone, which is how the public demo works.

The core is a dependency-free, event-sourced engine. Papers, promises, credits, amendments, decisions and approvals are events; integer-cent reducers project what is owed as of any date and as known at any moment. Invariants run on every command: a credit is conserved across promises, a changed source or policy voids pending approvals, competing amendments need a reasoned decision, an offer with strings never counts as money.

The product is React and Vite on a Node 24 backend with SQLite per team: password accounts, HttpOnly session cookies with CSRF tokens, four roles, invitations, atomic batches, idempotent retries and a hash-chained audit log, deployed as one HTTPS origin. Every page leads with its answer; each $100 is a pixel coin that turns over when an invoice pays it. The cover is a voxel town, drawn by our own renderer, where the pipeline’s agents carry each paper from the post to the book, weigh invoices on a scale and leave the letter on your desk, replayed from the book’s real event log.

Next: inbox and Ramp bill connectors feeding the same reader and engine.

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

