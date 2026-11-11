import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoWorkspace, createWorkspace, evaluateWorkspace, reduceWorkspace } from '../../assurance/index.mjs';
import {
  bookFor, boxCentsFor, claimClosedOn, creditedSoFarCents, dayFor, isOffer, isOverdue, keeperFor, letterFor, nextInvoiceFor, offersFor,
  paperText, papersFor, plainReason, promiseFor, quoteFor, stillOwedCents, totalsFor, viewFor, workingFor,
} from './selectors.mjs';

// The book is read on the app's own example workspace, on a day after every date in it.
const now = '2026-11-10T20:00:00.000Z';
const actor = { id: 'book-test', role: 'admin' };
const send = (state, ...commands) => commands.reduce((next, command) => reduceWorkspace(next, { id: crypto.randomUUID(), ...command }, { actor, now }).state, state);
const demo = () => createDemoWorkspace();
const find = (view, id) => view.commitments.find((item) => item.id === id);
const promise = (book, id) => book.promises.find((item) => item.id === id);

test('the page is the engine’s own numbers: four promises in the order they were written down, and its totals', () => {
  const workspace = demo();
  const view = evaluateWorkspace(workspace, { asOf: '2026-11-10', knownAt: now });
  const book = bookFor(workspace, { now });
  assert.equal(book.today, '2026-11-10');
  assert.deepEqual(book.promises.map((p) => p.id), ['pipeline-seats', 'nimbus-sla', 'orbit-renewal', 'parcel-waiver']);
  assert.deepEqual(book.promises.map((p) => [p.vendor, p.promisedCents, p.creditedCents, p.owedCents]), [
    ['Pipeline CRM', 240000, 90000, 150000],
    ['Nimbus Cloud', 200000, 0, 200000],
    ['Orbit Design', 48000, 0, 0],
    ['Parcel', 35000, 0, 35000],
  ]);
  assert.deepEqual(book.totals, { promisedCents: 475000, creditedCents: 90000, owedCents: 385000 });
  assert.deepEqual(book.totals, totalsFor(view));
  for (const p of book.promises) {
    const c = find(view, p.id);
    assert.equal(p.owedCents, stillOwedCents(c));
    assert.equal(p.creditedCents, creditedSoFarCents(c));
    assert.ok(Number.isSafeInteger(p.promisedCents) && Number.isSafeInteger(p.owedCents));
  }
  assert.equal(book.totals.owedCents, book.promises.reduce((sum, p) => sum + p.owedCents, 0));
  assert.equal(bookFor(null), null);
});

test('reading the book changes nothing in the workspace', () => {
  const workspace = demo(), before = JSON.stringify(workspace);
  bookFor(workspace, { now, demo: true });
  assert.equal(JSON.stringify(workspace), before);
});

test('an offer with strings attached is in the book but owes nothing and is in no total', () => {
  const view = viewFor(demo(), now), orbit = find(view, 'orbit-renewal');
  assert.equal(isOffer(orbit), true);
  assert.equal(stillOwedCents(orbit), 0);
  assert.equal(isOverdue(view, orbit), false);
  const p = promiseFor(demo(), view, orbit);
  assert.equal(p.offer, true);
  assert.equal(p.letter, null);
  assert.deepEqual(p.conditions, ['Accept a new 12-month renewal.']);
  assert.deepEqual(p.offers.map((o) => [o.kind, o.creditCents, o.extraCents, o.costCents, o.canAccept]), [['renew', 48000, 240000, 192000, false]]);
});

test('overdue means money is still owed and the date they gave has passed', () => {
  const workspace = demo();
  const late = viewFor(workspace, now), early = viewFor(workspace, '2026-10-28T12:00:00.000Z');
  assert.equal(isOverdue(late, find(late, 'pipeline-seats')), true);
  assert.equal(isOverdue(late, find(late, 'parcel-waiver')), true);
  assert.equal(isOverdue(early, find(early, 'parcel-waiver')), false);
});

test('the sentence where they said it is found word for word in the paper it came from', () => {
  const workspace = demo(), view = viewFor(workspace, now);
  const expected = {
    'pipeline-seats': ['We will credit USD 2,400 on your October 1, 2026 invoice for duplicate seats.', 'pipeline-promise'],
    'nimbus-sla': ['Availability below 99% earns a 25% service credit.', 'nimbus-contract'],
    'orbit-renewal': ['We can credit USD 480 if you accept another 12-month subscription for USD 2,400.', 'orbit-offer'],
    'parcel-waiver': ['We will waive the USD 350 setup fee on the November 1, 2026 invoice.', 'parcel-promise'],
  };
  for (const [id, [text, sourceId]] of Object.entries(expected)) {
    const quote = quoteFor(view, find(view, id));
    assert.equal(quote.text, text);
    assert.equal(quote.sourceId, sourceId);
    const source = view.sourceVersions.find((item) => item.id === quote.sourceId && item.revision === quote.revision);
    assert.equal(paperText(source.text).slice(quote.start, quote.end), text);
  }
});

test('a percentage is shown with its working only when it comes out to the promised amount exactly', () => {
  const workspace = demo(), view = viewFor(workspace, now);
  assert.deepEqual(workingFor(view, find(view, 'nimbus-sla')), { percent: 25, ofCents: 800000, per: 'month', why: 'Covered nine-hour outage' });
  assert.equal(workingFor(view, find(view, 'pipeline-seats')), null);
  // the same clause against a promise it does not add up to
  const odd = { ...find(view, 'nimbus-sla'), promisedCents: 190000 };
  assert.equal(workingFor(view, odd), null);
});

test('the papers are the workspace’s own documents: where they said it, and where it showed up', () => {
  const workspace = demo(), view = viewFor(workspace, now);
  const pipeline = papersFor(view, find(view, 'pipeline-seats'));
  assert.deepEqual(pipeline.promise.map((paper) => [paper.sourceId, paper.kind, paper.date, Boolean(paper.quote)]), [['pipeline-promise', 'email', '2026-09-18', true]]);
  assert.equal(pipeline.promise[0].text.startsWith('We will credit USD 2,400'), true, 'the made-up marker line is not printed on the paper');
  assert.deepEqual(pipeline.invoices.map((invoice) => [invoice.id, invoice.sourceId, invoice.date, invoice.creditCents]), [['INV-PC-1026', 'pipeline-invoice', '2026-10-01', 90000]]);
  assert.deepEqual(pipeline.invoices[0].lines, [{ label: 'Credit for PC-SEATS-2026', cents: -90000, credit: true }]);
  assert.match(pipeline.invoices[0].said, /^Invoice INV-PC-1026, credit line CREDIT-PC-900/);
  assert.deepEqual(pipeline.notes, []);

  const nimbus = papersFor(view, find(view, 'nimbus-sla'));
  assert.deepEqual(nimbus.promise.map((paper) => [paper.sourceId, paper.kind, Boolean(paper.quote)]), [['nimbus-contract', 'agreement', true], ['nimbus-incident', 'report', false]]);
  assert.deepEqual(nimbus.invoices, [], 'a credit note is not an invoice');
  assert.deepEqual(nimbus.notes.map((note) => [note.id, note.cents, note.date, note.onInvoice]), [['CM-NC-204', 200000, '2026-10-25', false]]);
});

test('a credit note alone punches nothing; the row says it is not on an invoice yet', () => {
  const book = bookFor(demo(), { now });
  const nimbus = promise(book, 'nimbus-sla');
  assert.equal(nimbus.creditedCents, 0);
  assert.equal(nimbus.owedCents, 200000);
  assert.deepEqual(nimbus.asides, ['Credit note CM-NC-204 for $2,000 came Oct 25. It is not on an invoice yet.']);
  assert.deepEqual(promise(book, 'pipeline-seats').asides, []);
});

test('the vendor’s offers carry the engine’s own answer on whether each can be taken', () => {
  const workspace = demo(), view = viewFor(workspace, now);
  const offers = offersFor(workspace, view, find(view, 'pipeline-seats'));
  assert.deepEqual(offers.map((o) => [o.id, o.kind, o.decision, o.canAccept, o.why]), [
    ['amendment-pipeline-date', 'later', null, false, 'Decline the other offer first. You can only take one.'],
    ['amendment-pipeline-renewal', 'renew', null, false, 'Your rules do not allow taking on new spending.'],
  ]);
  assert.deepEqual([offers[0].due, offers[0].firstDue], ['2026-11-15', '2026-10-01']);
  assert.deepEqual([offers[1].creditCents, offers[1].extraCents, offers[1].costCents], [150000, 240000, 90000]);

  const declined = send(workspace, { type: 'DISMISS_AMENDMENT', amendmentId: 'amendment-pipeline-renewal', reason: 'It costs more than the credit' });
  const after = offersFor(declined, viewFor(declined, now), find(viewFor(declined, now), 'pipeline-seats'));
  assert.deepEqual(after.map((o) => [o.kind, o.decision?.type ?? null, o.decision?.reason ?? null, o.canAccept]), [
    ['later', null, null, true],
    ['renew', 'declined', 'It costs more than the credit', false],
  ]);
  assert.equal(after[1].creditCents, 150000, 'a declined offer keeps the credit it was made with');
});

test('the letter is written from the records and follows the engine’s approval', () => {
  const workspace = demo(), view = viewFor(workspace, now), keeper = keeperFor({ actor });
  const letter = letterFor(workspace, view, find(view, 'pipeline-seats'), keeper);
  assert.equal(letter.to, 'Pipeline CRM');
  assert.equal(letter.subject, 'The remaining $1,500 credit');
  assert.equal(letter.body, [
    'Hi,',
    'On September 18, 2026 you wrote: “We will credit USD 2,400 on your October 1, 2026 invoice for duplicate seats.”',
    'Invoice INV-PC-1026 shows $900 of that. $1,500 is still owed, and it was due October 1.',
    'Please put the remaining $1,500 on our next invoice and send us the credit reference. We are keeping to what was first agreed, without the renewal.',
    'Attached: your email and invoice INV-PC-1026.',
    'Thank you,\nAlex · Acme Labs',
  ].join('\n\n'));
  assert.deepEqual([letter.approvedAt, letter.canApprove, letter.why, letter.lapsed], [null, true, null, false]);

  // approved in the engine: the letter says when, and by whom
  const approved = send(workspace, { type: 'APPROVE_ACTION', actionId: 'action-pipeline-preserve' });
  const signed = letterFor(approved, viewFor(approved, now), find(viewFor(approved, now), 'pipeline-seats'), keeper);
  assert.equal(signed.approvedAt, now);
  assert.equal(signed.approvedByYou, true);
  assert.equal(letterFor(approved, viewFor(approved, now), find(viewFor(approved, now), 'pipeline-seats'), keeperFor({ actor: { id: 'someone-else', role: 'viewer' } })).approvedByYou, false);

  // the records change afterwards: the engine's approval no longer holds, and the letter says so
  const changed = send(approved, { type: 'DISMISS_AMENDMENT', amendmentId: 'amendment-pipeline-renewal', reason: 'No' });
  const stale = letterFor(changed, viewFor(changed, now), find(viewFor(changed, now), 'pipeline-seats'), keeper);
  assert.deepEqual([stale.approvedAt, stale.lapsed, stale.canApprove], [null, true, true]);
  assert.equal(stale.key, letter.key, 'it is still the same letter, so what was typed on it is kept');

  // a letter about a different date or amount is a different letter
  const moved = send(changed,
    { type: 'PROPOSE_ACTION', action: { id: 'take-later-date', commitmentId: 'pipeline-seats', type: 'accept_amendment', payload: { amendmentId: 'amendment-pipeline-date' } } },
    { type: 'APPROVE_ACTION', actionId: 'take-later-date' },
    { type: 'EXECUTE_ACTION', actionId: 'take-later-date' });
  assert.notEqual(letterFor(moved, viewFor(moved, now), find(viewFor(moved, now), 'pipeline-seats'), keeper).key, letter.key);
});

test('the letter cannot be approved when the engine would refuse, and says why in plain words', () => {
  const workspace = demo(), view = viewFor(workspace, now);
  const nimbus = letterFor(workspace, view, find(view, 'nimbus-sla'));
  assert.deepEqual([nimbus.canApprove, nimbus.why], [false, 'The window to claim this closed Oct 30.']);
  assert.match(nimbus.body, /You sent credit note CM-NC-204 for \$2,000 on October 25, but it has not come off an invoice\./);
  assert.match(nimbus.body, /^Hi,\n\nOur agreement says: “Availability below 99% earns a 25% service credit\.”/);
  const parcel = letterFor(workspace, view, find(view, 'parcel-waiver'));
  assert.deepEqual([parcel.canApprove, parcel.subject], [true, 'The $350 credit you promised']);
  assert.match(parcel.body, /None of it has shown up on an invoice\. \$350 is still owed, and it was due November 1\./);
  assert.equal(letterFor(workspace, view, find(view, 'orbit-renewal')), null);
});

test('every refusal the engine gives on the example workspace has plain words', () => {
  assert.equal(plainReason([]), null);
  assert.equal(plainReason(['Claim deadline 2026-10-30 expired as of 2026-11-10.']), 'The window to claim this closed Oct 30.');
  assert.equal(plainReason(['The promise is not due until 2026-11-15.']), 'It is not due until Nov 15.');
  assert.equal(plainReason(['Action amount exceeds the 500000-cent approval limit.']), 'Your rules stop at $5,000 for one approval.');
  assert.equal(plainReason(['Policy forbids new contractual commitments.']), 'Your rules do not allow taking on new spending.');
  assert.equal(plainReason(['Something the book has not met.']), 'The rules for this book do not allow that yet. Open its page to see why.');
  // none of the engine's own wording reaches the page
  const book = bookFor(demo(), { now });
  const said = book.promises.flatMap((p) => [p.letter?.why, p.closed?.line, ...p.offers.map((o) => o.why)]).filter(Boolean);
  assert.ok(said.length >= 3);
  for (const line of said) assert.doesNotMatch(line, /amendment|policy|commitment|contractual|cent\b/i);
});

test('a promise whose time to claim ran out has no letter: the engine’s own refusal says so, with its date', () => {
  const workspace = demo(), view = viewFor(workspace, now);
  assert.equal(claimClosedOn(workspace, view, find(view, 'nimbus-sla')), '2026-10-30');
  for (const id of ['pipeline-seats', 'parcel-waiver', 'orbit-renewal']) assert.equal(claimClosedOn(workspace, view, find(view, id)), null);
  const book = bookFor(workspace, { now, demo: true });
  const nimbus = promise(book, 'nimbus-sla');
  assert.deepEqual(nimbus.closed, { on: '2026-10-30', line: 'The window to claim this closed Oct 30.' });
  assert.equal(nimbus.letter, null, 'no letter is offered that could never be approved');
  assert.deepEqual([nimbus.owedCents, nimbus.overdue], [200000, true], 'what is owed stays as it is');
  assert.ok(nimbus.nextInvoice, 'an invoice can still arrive and settle it');
  assert.deepEqual(book.promises.filter((p) => p.closed).map((p) => p.id), ['nimbus-sla']);
  assert.ok(promise(book, 'pipeline-seats').letter && promise(book, 'parcel-waiver').letter);

  // it is the engine's answer, not a date compared here: before the last day the engine has no objection
  const early = '2026-10-29T12:00:00.000Z', before = viewFor(workspace, early);
  assert.equal(claimClosedOn(workspace, before, find(before, 'nimbus-sla')), null);
  assert.equal(promise(bookFor(workspace, { now: early }), 'nimbus-sla').closed, null);
  assert.equal(promise(bookFor(workspace, { now: early }), 'nimbus-sla').letter.canApprove, true);
  // and once the money is on an invoice there is nothing left to claim
  const paid = send(workspace,
    { type: 'ADD_SOURCE', source: { id: 'nimbus-november', vendorId: 'nimbus', title: 'November invoice', kind: 'invoice', text: 'Invoice INV-NC-1126 shows credit memo CM-NC-204.' } },
    { type: 'APPLY_CREDIT', creditId: 'credit-nimbus-2000', sourceIds: ['nimbus-november'] });
  assert.equal(claimClosedOn(paid, viewFor(paid, now), find(viewFor(paid, now), 'nimbus-sla')), null);
  assert.equal(promise(bookFor(paid, { now }), 'nimbus-sla').closed, null);
});

test('the demo’s next invoice shows exactly what is still owed, with the examples’ own lines where they exist', () => {
  const view = viewFor(demo(), now);
  const pipeline = nextInvoiceFor(view, find(view, 'pipeline-seats'));
  assert.equal(pipeline.id, 'INV-PC-1126');
  assert.equal(pipeline.creditCents, 150000);
  assert.deepEqual(pipeline.lines, [{ label: 'Team subscription', cents: 600000, credit: false }, { label: 'Duplicate seat correction', cents: -150000, credit: true }]);
  assert.equal(pipeline.totalCents, 450000);
  assert.match(pipeline.text, /^Invoice INV-PC-1126\n\nBilled to Acme Labs\. Service period: November 1–30, 2026\./);
  const parcel = nextInvoiceFor(view, find(view, 'parcel-waiver'), '2026-11-09');
  assert.deepEqual([parcel.id, parcel.date, parcel.creditCents], ['INV-PL-1126', '2026-11-09', 35000]);
  assert.deepEqual(parcel.lines, [{ label: 'Credit for PL-SETUP-2026', cents: -35000, credit: true }]);
  assert.equal(nextInvoiceFor(view, find(view, 'orbit-renewal')), null);
  // only offered in a demo
  assert.equal(promise(bookFor(demo(), { now }), 'pipeline-seats').nextInvoice, null);
  assert.equal(promise(bookFor(demo(), { now, demo: true }), 'pipeline-seats').nextInvoice.id, 'INV-PC-1126');
});

test('a paper dated today takes the visitor’s date only when the engine will accept it', () => {
  const view = viewFor(demo(), '2026-11-11T02:00:00.000Z');
  assert.equal(view.asOf, '2026-11-11');
  assert.equal(dayFor(view, '2026-11-10'), '2026-11-10');
  assert.equal(dayFor(view, '2026-11-12'), '2026-11-11');
  assert.equal(dayFor(view, undefined), '2026-11-11');
  assert.equal(dayFor(view, 'yesterday'), '2026-11-11');
});

test('one box stands for $100, or more when the promise is large, and never more than thirty boxes', () => {
  assert.equal(boxCentsFor(240000), 10000);
  assert.equal(boxCentsFor(35000), 10000);
  assert.equal(boxCentsFor(300000), 10000);
  assert.equal(boxCentsFor(300001), 25000);
  assert.equal(boxCentsFor(4800000), 250000);
  for (const cents of [1, 99, 123456, 99999999, 12345678900]) assert.ok(cents / boxCentsFor(cents) <= 30);
});

test('an empty workspace is an empty book', () => {
  const book = bookFor(createWorkspace({ id: 'empty-book' }), { now });
  assert.deepEqual(book.promises, []);
  assert.deepEqual(book.totals, { promisedCents: 0, creditedCents: 0, owedCents: 0 });
});

test('the keeper is the signed-in person and their workspace, or the example’s own', () => {
  assert.equal(keeperFor().signature, 'Alex · Acme Labs');
  assert.equal(keeperFor({ session: { user: { name: 'Priya Shah' }, workspace: { name: 'Northwind' } }, actor: { id: 'u1' } }).signature, 'Priya Shah · Northwind');
});
