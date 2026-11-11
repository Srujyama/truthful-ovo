# Truthful · Team OVO

**Vendors promise. Invoices forget.**

When a vendor promises you a credit, Truthful writes the promise down, checks every invoice against it, and drafts the letter asking for what is still owed. Nothing goes out until you approve it. A credit note is not money until it shows on an invoice, and an offer with strings is not a debt: the book keeps the three apart and shows, in red, only what is still owed. Built for the BBS × Ramp technical round.

- **Live app: https://truthful-ovo.vercel.app** (runs in your browser; no account, nothing is sent)
- **Two-minute guided demo: https://truthful-ovo.vercel.app/?demo#/** (plays every feature hands-free, with captions)
- Demo video: see [the submission page](docs/SUBMISSION.md)

[Architecture answer](docs/SUBMISSION.md#architecture-answer) · [Development status](docs/DEVELOPMENT.md) · [Backend](docs/BACKEND.md) · [Technical deep dive](docs/TECHNICAL_DEEP_DIVE.md)

## Run

Node 24 or later:

```sh
npm ci
npm run dev
```

Open **http://127.0.0.1:5173**. This starts the page and a small local server that keeps the demo book in SQLite (`server/data/`, ignored by git). No API key and no account are needed.

`npx vite --config vite.browser.config.js` (port 5190) runs the same book with no server: it is kept in your browser, and a new window starts from the first page. For real accounts and separate team books, follow [managed account bootstrap](docs/BACKEND.md#run), then `npm run backend`.

## Run it for real

The same code runs as a real, multi-team product. `server/host.mjs` serves the app and the managed backend behind one HTTPS origin: accounts with password sign-in, HttpOnly + Secure + SameSite=Strict session cookies with a CSRF token, separate SQLite books per team, invitations, four roles (analyst prepares, approver approves, bookkeeper writes in, owner does all three), an append-only audit log, all-or-nothing writes and idempotent retries. `Dockerfile` and `fly.toml` deploy it to Fly.io with a volume for the books:

```sh
fly launch --no-deploy --copy-config
fly volumes create truthful_data --size 1
fly secrets set OWNER_EMAIL=you@company.com OWNER_PASSWORD='a long passphrase' OWNER_NAME='You' WORKSPACE_NAME='Finance'
fly secrets set ANTHROPIC_API_KEY=sk-ant-...   # turns on the Claude reader
fly deploy
```

The first account is created once from those secrets; invite the rest of the team from the name plate.

## The book

The cover is **Truthful's quarter**: a pixel town where the pipeline's stages are agents you can watch. A vendor's courier brings a paper to the post, the reader marks the figure, the scribe writes the promise down, the checker weighs each invoice against it on a scale, the writer drafts the letter, and it waits on your desk. The tour replays the demo book's real history from its event log; then the town shows the book as it stands, and every station opens onto its records.

Every other page is one printed sheet that leads with its answer. Each $100 of a promise is a pixel coin: ink when it came in on an invoice, a red ring while it is still owed.

| Page | Address | What is on it |
|---|---|---|
| **The quarter** | `#/` | The agents at work, the tour of the book's history, each station's records, and "$3,850 still owed of $4,750 promised". Scroll for the coins sorting themselves. |
| **Promises** | `#/ious` | One row per vendor: what they said, when it was due, their coins, credited, still owed. Open a row for the quote with its figure marked, the letter asking for the rest (approve it, download the .eml), offers to take or decline, and "The next invoice arrives". |
| **One promise** | `#/iou/pipeline-seats` | "$1,500 still owed": its coins, its history with a running balance, offers, and the decision with three signatures: prepared, approved, written in. |
| **To do** | `#/todo` | What waits on you and what waits on someone else, most urgent first. |
| **Papers** | `#/papers` | Every email, invoice, credit note and agreement as a mark by kind; open one to read it word for word with the figures highlighted. |
| **Companies** | `#/companies` | Who owes you, one page per company. |
| **History** | `#/daybook` | Every entry in order, on a timeline. Nothing is rewritten. |
| **Balance** | `#/balance` | Still owed as of any date, as the book knew it then. A CSV for the accountant and the whole trail as JSON. |
| **In-tray** | `#/tray` | Paste what a vendor sent; it is read, the figures are marked, and the promise goes into the book. |
| **Test bench** | `#/bench` | For engineers: two clerks racing for one credit, one-use permission slips, nine ways the ledger refuses to be fooled. |
| **How it works** | `#/how` | What each kind of coin means, and one promise's life step by step. |

`/` anywhere opens Find.

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

The browser suites run against isolated temporary services with Playwright, and an independent standard-library MIME parser replays every exported email byte for byte. [Development instructions](docs/DEVELOPMENT.md#verification-and-replay) include standalone packet and authority verifiers.

**How it is built.** React 19 and Vite 7 with plain CSS. Money is integer cents from the first parse to the last total. A Node 24 server (HTTP, SQLite, the built-in crypto) keeps the book: it checks who you are signed in as before every write, refuses a write made against an old copy of the book, runs a batch of writes as all or nothing, and ignores a request it has already carried out. Every entry carries the hash of the one before it, so a changed history shows. A signed record can be checked offline against a public key you already trust; that proves the record was not altered, not that a vendor’s email is real or that money moved.

**AI where it earns its place, rules where money moves.** Claude Opus 5.5 reads any email, contract or invoice into structured facts, each carrying the exact words it came from ([the model reader](docs/MODEL_READER.md)); deterministic code checks every quote against the source and every amount against its quote, and only the engine ever writes to the book. Set `ANTHROPIC_API_KEY` on the server and the In-tray reads with Claude; the public demo ships without keys, as the hackathon rules ask, and reads with the built-in reader. Truthful drafts the letter; a person approves it and sends it. [Research](docs/FRONTIER_RESEARCH.md) and a [comparison with other tools](docs/COMPETITIVE_RESEARCH.md) show where it stands.

The faces are Red Hat Display, Text and Mono, served from the app (SIL Open Font License). The quarter is drawn by a small zero-dependency voxel renderer in `src/book/house/craft/`; its concept is [src/book/house/world/CONCEPT.md](src/book/house/world/CONCEPT.md). [DESIGN.md](DESIGN.md) records the screens that came before.

## Design and submission artifacts

The [Figma source kit](design/figma/README.md) holds 69 screen models, 14 boards and 483 mapped interactions from the design exploration; the [native file](https://www.figma.com/design/8j4pwtsGDI4seljHPNeUkI) holds the 17-screen baseline.

[The architecture answer](docs/SUBMISSION.md) · [the model reader](docs/MODEL_READER.md) · [hosting the real version](#run-it-for-real)

MIT license.

The connected review-to-message regression is `npm run test:product:browser`, followed by `npm run verify:product`. It operates a real decline, separate approval/recording, case return, two independent analyses, retained edits and an exact approved unsent email. Export verification independently replays financial commands and parses MIME attachment bytes.
