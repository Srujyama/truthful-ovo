# Truthful · Team OVO

**Vendors promise. Invoices forget.**

When a vendor promises you money, Truthful keeps the IOU and checks every invoice until it is paid. A credit note is not money until it shows up on an invoice, and an offer with strings attached is not a debt: the book keeps the three apart and shows, in red, only what is still owed. Built for the BBS × Ramp technical round.

[Development status](docs/DEVELOPMENT.md) · [Backend](docs/BACKEND.md) · [Technical deep dive](docs/TECHNICAL_DEEP_DIVE.md) · [The design of every page](src/book/CONCEPT.md)

## Run

Node 24 or later:

```sh
npm ci
npm run dev
```

Open **http://127.0.0.1:5173**. This starts the page and a small local server that keeps the demo book in SQLite (`server/data/`, ignored by git). No API key and no account are needed.

`npx vite --config vite.browser.config.js` (port 5190) runs the same book with no server: it is kept in your browser, and a new window starts from the first page. For real accounts and separate team books, follow [managed account bootstrap](docs/BACKEND.md#run), then `npm run backend`.

## The book

The whole app is one bookkeeper's book on a desk. Tabs along the top of the page turn to each part of it.

| Page | Address | What is on it |
|---|---|---|
| **IOUs** | `#/ious` | One line per promise: what they said, when it was due, what they promised, what has been credited, what is still owed. Press a line and its IOU slides out with the email and the invoice clipped behind it. Drop an email or an invoice in the tray and it is read. |
| **One promise** | `#/iou/pipeline-seats` | The figure still owed, a strip of boxes punched as money reaches an invoice, everything that happened in order with a running balance, the vendor's offers as tags you take or decline, and the decision slip with three boxes: prepared, approved, written in. Its credit notes and the papers it rests on are here too. |
| **To do** | `#/todo` | What needs a hand, most urgent first, and who each line is waiting on. |
| **Papers** | `#/papers` | Every email, invoice, credit note and agreement on file, as itself. Open one to read it word for word with the figures Truthful took from it highlighted, where it is used, and its earlier copies. |
| **Companies** | `#/companies` | The index, and one page per company. |
| **Day book** | `#/daybook` | Everything that happened, newest first. Any line opens in full, with the raw entry behind it. |
| **Balance** | `#/balance` | Still owed across every company. Two date stamps turn the book back: what was in force on a day, and what the book knew by then. A CSV for the accountant and the whole trail as JSON. |
| **In-tray** | `#/tray` | Drop in a promise, the invoices and what they said next. They come back marked with what was found; write the promise into the book and get the letter asking for the rest. |
| **Test bench** | `#/bench` | For engineers: two clerks racing for one credit under two rules, one-use signed permission slips, and nine ways the ledger refuses to be fooled. |

`/` anywhere opens Find. The name plate, top right, is who is holding the pen.

## Try it

- **Pipeline CRM owes $1,500.** They promised $2,400 and the October invoice took off $900. Open its page from the IOUs. They answered with two offers: pay later, or a $1,500 credit if you renew for $2,400 more, which costs you $900. Decline the renewal with a reason, or keep the original promise and ask for the rest.
- **A decision takes three people.** One prepares it, one approves it, one writes it into the book. In the demo book the name plate lets you pick up each pen in turn: prepare as the analyst, approve as the approver (the stamp comes down), write it in as the bookkeeper. A step you cannot take says who it is waiting for.
- **Nimbus Cloud sent a $2,000 credit note.** It is on file, on pink paper, and it is still not money: no invoice shows it. Add the invoice that does, on Nimbus's page.
- **Turn the book back.** On Balance, set both dates to Oct 28, 2026: Nimbus is not yet out of time and Parcel is not yet due.
- **Read a paper.** Papers → "Original duplicate-seat correction": the sentence the promise was made in, with the amount, the date and the reference marked.
- **Race two clerks.** Test bench → Two clerks, one credit: with a check made once and trusted, the credit is spent twice; with the check made again at the moment of writing, the second clerk is refused.

The screens this replaced are still in the repository and still open at any old address (`?view=team`, `?view=assurance`, …).

## Verify

```sh
npm run check
npm run test:workspace:all
npm run verify:workspace-redesign
npm run verify:team
```

The browser suites (`test:workspace:*`, `test:team:browser`, `test:product:browser` and their `verify:*` companions) drive the earlier screens at their `?view=` addresses. The book's own pages are covered by `npm test` (selectors, entries and wording for every page) and were clicked through in a real browser page by page.

Verification requires Python 3 for the independent standard-library MIME parser. The browser runner uses isolated temporary services and the Playwright CLI. The companion verifier replays actual downloads. [Development instructions](docs/DEVELOPMENT.md#verification-and-replay) include standalone packet and authority verifiers. Tests establish specified deterministic behavior, not held-out extraction accuracy or global formal verification.

**How it is built.** React 19 and Vite 7 with plain CSS. Money is integer cents from the first parse to the last total. A Node 24 server (HTTP, SQLite, the built-in crypto) keeps the book: it checks who you are signed in as before every write, refuses a write made against an old copy of the book, runs a batch of writes as all or nothing, and ignores a request it has already carried out. Every entry carries the hash of the one before it, so a changed history shows. A signed record can be checked offline against a public key you already trust; that proves the record was not altered, not that a vendor’s email is real or that money moved.

**What it is connected to: nothing.** No model, inbox, Ramp account, vendor, bank or accounting system. Truthful reads the papers you give it and writes the letter; you send it. The vendors and papers in the demo book are made up. It reads US dollars and the kinds of promise in `public/examples/`. The permission slips are this project’s own format and follow no outside standard. [Research](docs/FRONTIER_RESEARCH.md) and a [comparison with other tools](docs/COMPETITIVE_RESEARCH.md) say where it stands.

The public GitHub Pages site is still the earlier v3 release. The faces are Besley, Libre Franklin and Courier Prime, served from the app (SIL Open Font License). [The design of every page](src/book/CONCEPT.md) and [its look](src/book/identity.json) are in `src/book`; [DESIGN.md](DESIGN.md) records the screens that came before.

## Design and submission artifacts

The earlier [Figma source kit](design/figma/README.md) contains 69 screen models, 14 boards and 483 mapped interactions. The [native file](https://www.figma.com/design/8j4pwtsGDI4seljHPNeUkI) retains its previously verified 17-screen baseline. Saving the expansion remains blocked by editable file access and a connected FigCli bridge; neither artifact establishes parity with this rebuild. See [the expansion record](docs/WORKSPACE_EXPANSION.md).

Videos and submission packaging remain deferred. [The architecture answer](docs/SUBMISSION.md), [demo script](docs/DEMO_SCRIPT.md), [form requirements](docs/FORM_REQUIREMENTS.md) and [delivery facts](docs/DELIVERY.md) preserve prepared materials. Public source, an accepted-host recording, team consent, original track and attendance remain external submission facts; the application has not been submitted.

MIT license.

The connected review-to-message regression is `npm run test:product:browser`, followed by `npm run verify:product`. It operates a real decline, separate approval/recording, case return, two independent analyses, retained edits and an exact approved unsent email. Export verification independently replays financial commands and parses MIME attachment bytes.
