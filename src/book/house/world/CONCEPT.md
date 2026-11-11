# Truthful's quarter

The user, after the isokra rebuild: "look at nomen, the agents interact with each
other, I think nomen would be perfect for this and would look very good and an
instantly good demo."

Nomen (`Randomprojects/ui/.references/aiden-guan/Nomen`, screenshots in its
`.inspection/`) shows an agent pipeline as a camp: each stage is a place, each
agent a figure with one job, every handoff a walk you can watch, every station
labelled with a sentence built from real counts, a tour that replays a real run
step by step, a panel that opens on the real records. Its digest, with file:line
for everything: `claude-tools/craft/references/src/worlds.md` §13–§15.

Truthful gets the same mechanism with its own nouns. Not a Greek camp: a small
quarter where the book is kept.

## 1. It's a ___ where you ___

**It's a quarter where Truthful's agents carry every vendor's papers from the post
to the book, weigh each invoice against the promise on a scale, and leave a letter
on your desk to sign.**

Why this did not fail like the earlier two places (a clearing-house town, an
office of five teammates): both were a small scene inside a dashboard (sidebar,
breadcrumb, a select box, a side panel). Here the world IS the first screen, under
the one top bar, and every figure is doing something the demo book really records.

## 2. What everything stands for

| In the quarter | In the product | Its tag says (computed) | Its panel shows | Its page |
|---|---|---|---|---|
| **the post**: pigeonholes, a tray, a red post box | papers come in (emails, contracts, invoices) | `11 papers in` | the latest papers in, newest first; "Add what they sent you" | `#/tray` |
| **the reading desk**: drawers, a lectern, a lens | the reader finds the promise / credit in a paper and marks the figure | `last read: INV-PC-1026` | a paper with its figure highlighted, and what was read from it | `#/papers` |
| **the book**: the high desk, the ledger open, a green-striped canopy | the scribe writes a promise down as an IOU | `4 promises` | each promise as a row with its coins | `#/ious` |
| **the scale**: the big brass scale | the checker weighs invoices against promises; the light side is what is owed | `$3,850 light` (red) | promised − credited = still owed, the coins | `#/balance` |
| **the letter desk**: envelopes, a candle | the writer drafts the letter asking for the rest | `1 letter drafted` | the draft, word for word | `#/todo` |
| **your desk**: the blotter, slips with red tabs, the empty chair | the approval: nothing goes out until you sign | `Your turn: 1 letter to sign` (a call bobs over it) | the letter and **Approve this letter** | `#/iou/<id>` |
| **the clock** in the square | due dates and claim windows | `Parcel is 9 days late` | what is late, what closed | `#/todo` |
| **a vendor's house** west of the stream, roof in its colour | a company | `Pipeline CRM · owes $1,500` | its promises and papers | `#/companies/<id>` |
| **a courier** in the vendor's colour | a paper that company sent | — | — | — |
| **Truthful's courier** (red cap) | a signed letter going out | — | — | — |
| slips on the scale's left pan | promises still owed, one per promise, company colour on the edge | | | |
| coins on the right pan | money that came in on an invoice | | | |

## 3. The agents

One figure each, dressed for the job (`AGENTS` in `world.js`), never a person's
name. The tag over a figure is its job: `the postmaster`, `the reader`, `the
scribe`, `the checker`, `the writer`, `the courier`.

When idle, each does its job in place, small and slow (pixel.md "never quite
still"): the postmaster sorts (turns to the pigeonholes and back), the reader
turns a page, the scribe writes (a one-voxel bob over the book), the checker
lifts a coin and sets it down, the writer writes. Every 4–8 s, not in step.

## 4. The replay (Nomen's tour, from the demo book's day book)

The first screen plays the demo book's real history as a tour, one step at a
time, each step a card at the top centre with: `n of N`, the date (mono), one
sentence, ← and Next →, a thin progress line, and the figures moving on the map.
Autoplay steps every ~6 s until the visitor touches anything. The steps come from
the day book's entries (`src/book/pages/records/engine.mjs` already turns the
engine's events into entries), grouped by date and company. For the demo book:

1. `Sep 1` Nimbus Cloud's agreement comes in. Its courier crosses the bridge to the post; the postmaster hands it to the reader; it goes in a drawer.
2. `Sep 18` Pipeline CRM's email comes in: "We will credit USD 2,400…". Post → reader (marks $2,400) → scribe writes the IOU → the scribe walks a slip to the scale's left pan.
3. `Sep 28` Nimbus reports a nine-hour outage: 25% of the $8,000 month is $2,000. Same path; another slip on the pan.
4. `Oct 1` Pipeline's October invoice takes off $900. Post → reader → checker lays 9 coins on the right pan. The scale still tips: $1,500 light.
5. `Oct 20` Orbit Design offers $480 if you renew. The scribe hangs it off the stand, not on a pan: an offer with strings is not a promise.
6. `Oct 21` Parcel promises to waive the $350 setup fee. A slip on the pan.
7. `Oct 25` Nimbus sends a credit note for $2,000. The checker clips it beside the scale, not on it: a note is not money until it shows on an invoice.
8. `Oct 28` Pipeline offers to pay later, or the rest if you renew. The writer drafts a letter keeping the original promise and asking for the $1,500, and carries it to your desk.
9. `Oct 30` Nimbus's claim window closes. The clock rings.
10. `Nov 1` Parcel's invoice comes without the waiver. The clock rings: Parcel is late.
11. `Today` $3,850 still owed. A letter waits for your signature. (The call bobs over your desk.)

Every figure, date and name comes from the view or the day book, never typed.
Bubbles over two figures who hand something over say what is handed, in plain
words (`"Pipeline CRM promised $2,400."` → `"Written down."`). A bubble lasts
2.5 s. A walk follows the roads (`STATIONS` ring, the vendor roads), steps by
distance, holds a beat at each handover. Nothing appears in the open: papers
arrive by courier, coins are carried.

After the last step the quarter is live: agents idle, tags show the current
state, and **Approve this letter** (on your desk's panel) really approves it
(the book page's own command, `approveLetterCommands` in
`src/book/front/commands.mjs`); then Truthful's courier carries it across the
bridge to the vendor's house. "The next invoice arrives" (demo) sends the
vendor's courier with the invoice and the checker lays the coins.

## 5. The screen

```
┌ the shell's top bar (truthful · promises · to do · …) ───────────────────────┐
│ the demo book · nov 10        ┌ 2 of 11 · sep 18 ──────────────── ← Next → ┐│
│ $3,850 still owed             │ Pipeline CRM's email comes in. … ━━━━──────── ││
│ of $4,750 promised.           └──────────────────────────────────────────────┘│
│                                                                               │
│   houses │stream│  [post]──[reading desk]──[book]                    ┌panel──┐│
│          │      │     │          clock        │                      │       ││
│          │      │  [your desk]─[letter desk]─[scale]                 └───────┘│
│ latest: Oct 28 · A decision was prepared…                      − + ☾          │
└───────────────────────────────────────────────────────────────────────────────┘
   scroll: the coin crowd and the rest of the cover, as it is now
```

- The world fills the first screen under the top bar (min 600px tall). The rest
  of the cover (the coin crowd, the answer, Try one invoice) follows on scroll,
  unchanged.
- Chrome over the world is the isokra system (`src/book/ui/tokens.css`): white
  boxes with a hairline, mono lowercase labels, the answer in Red Hat Display,
  one ink button. Not Nomen's stepped borders.
- Tags are DOM pinned to the world (`stage.anchor`), beside the thing, never on it.
  Station tag: mono name + the computed line. Clicking a tag or the object opens
  its panel; the panel's last line links to the page.
- Phone (≤ 900px): one station at a time, a snap strip of station cards along
  the bottom (Nomen: `Camp.tsx:1487-1530`), the tour card above the world.
- Reduced motion: no walks; the tour moves the tags and bubbles only.
- Night by the reader's clock (20:00–06:00), and ☾: lamps, windows, the candle.

## 6. Words

- Kicker: `the demo book · {nov 10}`. Headline: `{$3,850} still owed` / `of {$4,750} promised.`
- Station names as in §2. Agent tags as in §3.
- Your turn: `Your turn: {1} letter to sign`. Approve: `Approve this letter`.
- Latest line: `latest: {Oct 28} · {the day book's entry}`.
- Hint (goes after the first touch): `click anything · drag to look around`.
- Run `craft words` on every file.

## 7. Files

- `world.js` — the art: layout (`STATIONS`, `at`, `vendorAt`), models, `quarter(state)`, `AGENTS`, `agent()`, `SPOTS`. Lead-owned.
- `props.js` — furniture (scale, desks, drawers, pigeonholes, clock). Lead-owned.
- `World.jsx` + `world.css` — the live quarter, tags, panel shell, phone, night (builder W).
- `story.mjs` (+ test) — the tour steps from the day book; `director.js` — walks, handovers, bubbles (builder W).
- `panels.jsx` + `lines.mjs` (+ test) — each station's and vendor's tag line and panel content (builder P).
- `../Home.jsx` — the cover: `<World/>` first, the existing content after (builder W).
