# Truthful — the whole book

The front page is settled and built elsewhere (`src/book/front`, design in
`claude-tools/craft/examples/truthful/CONCEPT.md`): a ledger page of IOUs on a
desk. This file is everything behind it. Same desk, same book, same look
(`identity.json`).

## 1. What it does, in one sentence

When a vendor promises you money, Truthful keeps the IOU and checks every
invoice until it is paid.

## 2. Who is looking

Someone in finance who was promised a credit by a vendor and wants to know:
did it reach an invoice, how much is still owed, and what do I do about it.
Tonight also: hackathon engineers judging whether the thing really works.

## 3. The form

**It's a bookkeeper's book where every promise has a page, and you watch the
invoices punch it out.** Bookkeeping already has a name and a piece of paper
for everything this product stores. Use those. Do not invent panels.

| The product has | In the book it is | Page |
|---|---|---|
| a promise (commitment) | an IOU: one line in the book, one account page | `#/iou/<id>` |
| money that reached an invoice | boxes punched out of the IOU's strip; an entry in the Credited column | account |
| money still missing | **the red figure.** Red means money still owed and nothing else | everywhere |
| a source document | a paper: a letter on bond, an invoice on cool form stock, a credit note on pink carbon, an agreement on cream laid | `#/papers` |
| a credit note not yet on an invoice | a pink slip that says so. "A note is not money until it shows on an invoice" | papers, account |
| a vendor's changed terms (amendment) | a manila tag tied to the IOU: ONLY IF | account |
| a decision (action) | a routing slip with three boxes for initials: prepared, approved, written in | account |
| an approval | a rubber stamp, crooked, with the time on it | account |
| a role | whose pen you are holding (the name plate, top right) | shell |
| what needs doing (queue) | the To do page: one line per thing, and who it waits on | `#/todo` |
| a vendor | a company in the index | `#/companies` |
| the event log | the day book: everything that happened, in the order it happened | `#/daybook` |
| the report | the balance: totals as of a date, with a dater stamp you can turn back | `#/balance` |
| document intake | the in-tray: drop papers in, they are read, the promise is written in the book | `#/tray` |
| engineer tools | the test bench | `#/bench` |

## 4. Rules every page keeps

1. **Built from `src/book/shell/parts.jsx` and `book.css`.** `Sheet`, `SheetHead`,
   `Ledger`/`Row`/`Cell`/`Total`, `Paper`, `Stamp`, `Tally`, `Btn`, `Why`,
   `Filters`, `Field`, `Find`, `Empty`, `Notice`, `Over`/`Close`. Money and dates
   from `money.mjs` (`ledger`, `dollars`, `day`, `shortDay`, `clock`, `today`).
   Roles and blocked reasons from `roles.mjs` (`whyNot`, `plainError`, `roleName`).
   Links from `route.mjs` (`href`, `paperId`). `src/book/pages/Ious.jsx` is a
   finished small page: read it first and copy its shape.
2. **New CSS** goes in your page's own `.css` file, every class starting `bk-`
   plus your page's short name (`bk-acct-…`). Never restyle a shared class from a
   page file; if a shared part is missing something, say so in your report.
3. **No old screens.** Do not import any old `.jsx` or `.css` from `src/`. Do
   import the pure `.mjs` modules (they hold the real logic) and send the real
   commands through `service`. The scout's map of both is the digest (path in
   your brief). Money is integer cents until the moment it is printed.
4. **The thing is on the page and you act on the thing.** A paper looks like the
   paper. State is on the object: a stamp, a punched box, a figure in red, a
   line through a declined tag. Never a paragraph about state, never a badge.
5. **One biggest thing per page**, named in the page's section below.
6. **Every blocked button says who it waits on**, next to it:
   `<Btn why={whyNot('APPROVE_ACTION', service)}>`. Never a disabled button with
   no reason and never a tooltip alone.
7. **Three column names, always the same:** THEY PROMISED · CREDITED SO FAR ·
   STILL OWED. (A stranger test on the front settled these.)
8. **Words.** Short, said to a person, in the book's nouns. Rules and a swap
   list: `claude-tools/craft/references/words.md`. Never: evidence, commitment,
   workspace, outstanding, attribution, record(ed), exact, explicit, inspect,
   obtain, supplied, review (as a noun), case, follow-up. Say: the email, the
   invoice, promise/IOU, your team's book, still owed, which promise it covers,
   saved/written in, this, open/read, add, what you pasted, decision. No
   sentence that describes the interface. No list of things that did not
   happen. The one notice per page already sits in the desk's foot; add none.
9. **Phone (390 wide), keyboard, reduced motion.** `Cell label="…"` gives the
   phone its labels. Rows are links or buttons. Escape closes what Enter opened.
10. **Every write** is `try { await service.command(…) } catch (e) { say(plainError(e), { wrong: true }) }`
    and on success `say('…')` with what happened in six words or fewer.
    While `service.busy`, the button shows the act in progress (`busy="Writing it in…"`).

## 5. The pages

### Account — `#/iou/<commitmentId>` (`?a=<actionId>` opens that decision)

**Biggest thing: the red figure still owed on this one promise.**

```
← All IOUs                                                        [NOV 10 2026]
Pipeline CRM                                              STILL OWED
“We will credit USD 2,400 on your October 1, 2026           1,500.00
 invoice for duplicate seats.”                              [OVERDUE]
due Oct 1, 2026 · PC-SEATS-2026
[■■■■■■■■■□□□□□□□□□□□□□□□]  one box is $100
$2,400 promised − $900 on the invoice = $1,500 still owed
──────────────────────────────────────────────────────────────────────────────
     DATE      WHAT HAPPENED                         PAPER     ‖ PROMISED │ CREDITED │ STILL OWED
 1   Sep 18    Pipeline CRM promised $2,400.         the email ‖ 2,400.00 │          │  2,400.00
 2   Oct 1     Invoice INV-PC-1026 took off $900.    invoice   ‖          │   900.00 │  1,500.00
 3   Oct 28    They offered to pay later: Nov 15.    their note‖          │          │
 4   Oct 28    They offered $1,500 if you renew.     their note‖          │          │
──────────────────────────────────────────────────────────────────────────────
What's next
 (tag) ONLY IF · Pay later            (tag) ONLY IF · Only if you renew
       Nov 15 instead of Oct 1.              A $1,500 credit if you spend $2,400 more.
       [Take it]  Decline                    That costs you $900.   [Take it]  Decline
 (slip) DECISION · Keep the original promise and ask for the rest: $1,500
        PREPARED BY          APPROVED BY               WRITTEN IN BY
        Seed curator, Oct 28  [Approve it]              waits for an approval
                              Waiting for an approver. You are signed in as analyst.
```
Below the sheet, on the desk: the papers this promise rests on, fanned, each
the real paper (`correspondenceDocuments`), each a link to `#/papers/<id>@<rev>`.

- The line under the strip is the sum, in words and figures.
- Entries come from the events that touch this promise, oldest first, with a
  running STILL OWED. Write each entry yourself from the event's payload, as a
  person would say it: "Invoice INV-PC-1026 took off $900." "Credit note
  CM-NC-204 for $2,000. It is not on an invoice yet." "You declined the renewal:
  ‘too expensive’." Who and when go in small type under the line.
- An offer is a `Paper stock="manila"` tag. Take it → the decision slip for it
  (`PROPOSE_ACTION accept_amendment`, or reuse the live one). Decline → a short
  reason (the engine stops at 200 characters; say so before they hit it) →
  `DISMISS_AMENDMENT`; the tag then shows a line through its title and
  "Declined Nov 10: ‘…’". A renewal tag states its real cost from
  `action.economics` or the amendment's own figures.
- The decision slip is a bond form with a `bk-route` of three boxes. A done box
  shows who and when in pen. The box that is next holds the one button:
  **Prepare it** → `PROPOSE_ACTION`; **Approve it** → `APPROVE_ACTION`, then an
  APPROVED stamp lands (`<Stamp land>`); **Write it in the book** →
  `EXECUTE_ACTION`, then the entry appears in the ledger above. If the house
  rules stop it, the slip says why in plain words (`readableReviewReason` is a
  start; rewrite what still sounds like a system). If the papers changed since
  it was prepared: "The papers changed since this was prepared." **Prepare it
  again**. "Keep the original promise" is always offered beside an offer's slip.
- **House rules** (a quiet link on the slip): the most a claim may be, the most
  extra spending a renewal may bring, whether an offer may add a new obligation.
  Owner only → `SET_POLICY`.
- Statuses for the stamp: OVERDUE (red) when due date has passed and money is
  owed; PAID (blue) when nothing is owed; ONLY IF (blue, small) when the promise
  has conditions; nothing when it is simply not due yet (say "due Nov 1").
- Two slots are filled by another builder; mount them and leave them be:
  `<CreditSlips view commitment service say past={false} />` and
  `<ChangedTerms view commitment service say go />` from `./account/`.
- Unknown id: "That IOU isn't in this book." and a link back.

### Papers — `#/papers`, `#/papers/<sourceId>@<rev>`, `#/papers/credit:<creditId>`

**Biggest thing: the papers themselves, as papers.**

The drawer: `Filters` with counts by kind (All 9 · Letters 4 · Invoices 1 ·
Credit notes 1 · Agreements 1 · …, plain nouns for the engine's kinds), a
company filter, `Find`, "Older copies too" (versions), and "Papers received by
[date]". Under it the papers lie in rows as `Paper className="bk-thumb"`: the
right stock for the kind, the kind in small caps, the title, the company, the
date, then the real first lines running off the foot. Each is a link.

One paper: the sheet turns into a reading desk. Left, the paper at reading size
(`Paper w≈150`) with its exact text; the figures and dates Truthful took from it
are highlighted (`bk-hl`). Right, a bond slip "What Truthful read here": the
facts (`documentReading`), then "It is used in" (`sourceUsages`: each a link to
the account or decision), then its copies (newest first; an older copy says
"replaced Oct 28"), then **Download this text** (the exact bytes, `.txt`) and
"← All papers". Hovering a fact lights its passage in the paper, and the other
way round.

A credit note (`credit:<id>`): the note on pink carbon with its number, company
and amount large; a stamp ISSUED or ON INVOICE; a strip showing where its money
went (matched to a promise · taken back · not matched yet), the promises it is
matched to (links), and the papers behind it. Its forms live on the account
page: link there ("Match it on Nimbus Cloud's page").

Empty drawer: "No papers on file yet." / "Drop the first one in the in-tray."

### To do — `#/todo`

**Biggest thing: the first line, the one to do first.**

A ledger: WHAT TO DO · COMPANY · WAITING ON · AMOUNT. From `operationQueue`. Its
titles are system voice; say each as a person would (keep a map by title, fall
back to the title): "Add the invoice that shows the credit." "Two offers
disagree. Pick one or decline both." "Their claim window closed Oct 30." The
WAITING ON column names a person or a paper: you, an approver, the bookkeeper,
their invoice, Nov 1. `Filters` by kind with counts. A row opens the account at
the right decision. Empty: "Desk clear." / "Nothing needs a hand today."

### Companies — `#/companies`, `#/companies/<vendorId>`

The index: COMPANY · IOUS · THEY PROMISED · CREDITED SO FAR · STILL OWED, a
total line, `Find`. One company: its name large, the red figure it still owes,
its IOUs as ledger lines (links to accounts), its credit notes, and its papers
as thumbs. Empty: "Nobody owes you anything yet."

### Day book — `#/daybook`

**Biggest thing: the newest line.**

A ledger, newest first: DATE · TIME · WHO · WHAT HAPPENED · COMPANY. From
`workspaceActivity`; say each line plainly (`createHistoryCopy` gives a start;
rewrite what still sounds like a system). `Find`, filters for company, person,
kind, from/to. 24 lines a page: **Earlier entries**. A line opens a bond slip
(`Over`) with the entry in full: when it happened, when the book learned of it,
who wrote it, a link to the account, and behind a "The raw entry" disclosure
the ids and the payload as typed JSON.

### Balance — `#/balance`

**Biggest thing: STILL OWED, across every company, in red.**

Two daters at the top, each a real `<input type="date">` set like a stamp:
**As of** (what was in force that day) and **Counting papers received by**
(what the book knew by then). Not later than today. "Back to today" when either
is turned back, and then a line in pen: "You have turned the book back to Oct
28." Then the figures from `financialReport`: STILL OWED large; beside it THEY
PROMISED, CREDITED SO FAR, credit notes not on an invoice yet, offers with
strings. Then the ledger by company with a total line (company → its page).
Then: **Copy for the accountant (CSV)** (`reportCsv`, a real download) and
**Download the whole trail** (`service.exportPacket`, JSON).

### In-tray — `#/tray`

Three slots lying in a dark tray on the desk: **The promise** (their email, as
text) · **The invoices** (CSV) · **What they said next** (optional). Paste,
type, or drop a file on a slot; "Use the Pipeline CRM example" fills them.
**Read them** → the papers come back marked: each figure Truthful used is
highlighted, with a slip saying what it found ("A promise: $2,400 from Pipeline
CRM, due Oct 1. On the invoices: $900. Still owed: $1,500."), or what stopped
it ("This one has strings attached. Someone has to decide before it goes in the
book."). Then **Write it in the book** (`prepareEvidenceImport` →
`service.commands`) lands you on the new account page; and the letter asking
for the rest, editable, **Approve this letter** (stamp lands) → **Download the
email** (`.eml`), Copy. Earlier readings are kept in a pile ("Read before").

### Test bench — `#/bench`

For engineers. Two tools, each a form on bond: **Two clerks, one credit**
(runs every ordering of two competing actions against the real ledger rules;
shows the shortest way it goes wrong with a stale check, and that the guarded
ledger refuses it) and **Permission slips** (a signed, one-use permission for
one exact action; hand a narrower one to someone else; try to use it twice).

## 6. What a visitor can do with their hands (check each one)

- Tab along the index tabs; Enter opens a page; `/` opens Find anywhere.
- Open an IOU from the book, To do, a company, a paper's "used in", or Find.
- Take or decline an offer; prepare, approve and write in a decision, each as
  the right person (name plate → pick up a pen); see the stamp land.
- Open any paper from anywhere it is mentioned; switch between its copies;
  download its exact text.
- Turn the balance back to a date and forward to today; download the CSV.
- Page through the day book; open an entry in full.
- Drop papers in the tray, have them read, write the promise in the book.
