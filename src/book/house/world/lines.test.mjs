import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoWorkspace, createWorkspace, evaluateWorkspace, reduceWorkspace } from '../../../assurance/index.mjs';
import { approveLetterCommands, nextInvoiceCommands } from '../../front/commands.mjs';
import { letterFor, money, stillOwedCents } from '../../front/selectors.mjs';
import { drawerPapers } from '../../pages/papers/kinds.mjs';
import {
  STATION_IDS, clockOf, lastRead, latestLine, letters, papersIn, promiseStanding, stationLine, stationNow, vendorLine, vendorNow, vendorOf,
} from './lines.mjs';

// The quarter is read on the app's own demo book, on a day after every date in it, and on an empty book.
const now = '2026-11-10T20:00:00.000Z';
const actor = { id: 'world-test', role: 'admin' };
const send = (state, commands) => commands.reduce((next, command) => reduceWorkspace(next, { ...command, id: command.id || crypto.randomUUID() }, { actor, now }).state, state);
const viewOf = (workspace, day = now.slice(0, 10)) => evaluateWorkspace(workspace, { asOf: day, knownAt: day === now.slice(0, 10) ? now : `${day}T23:00:00.000Z` });
const lines = (view) => Object.fromEntries(STATION_IDS.map((id) => [id, stationLine(id, view)]));

test('the demo book: every tag is the book’s own count', () => {
  const workspace = createDemoWorkspace();
  const view = viewOf(workspace);
  assert.deepEqual(lines(view), {
    post: { text: '11 papers in' },
    read: { text: 'last read: Pipeline CRM’s letter' },
    book: { text: '4 promises' },
    scale: { text: '$3,850 short', owed: true },
    letter: { text: '1 letter drafted' },
    you: { text: 'Your turn: 1 letter to sign', turn: true },
    clock: { text: 'Parcel is 9 days late' },
  });
  // the same numbers the pages print
  assert.equal(papersIn(view).length, drawerPapers(view).length);
  assert.equal(stationLine('scale', view).text, `${money(view.totals.outstandingCents)} short`);
  assert.equal(stationLine('book', view).text, `${view.commitments.length} promises`);
});

test('the demo book: each company’s house', () => {
  const view = viewOf(createDemoWorkspace());
  assert.deepEqual(view.vendors.map((v) => vendorLine(v, view)), [
    { name: 'Pipeline CRM', text: 'owes $1,500', owedCents: 150000 },
    { name: 'Nimbus Cloud', text: 'owes $2,000', owedCents: 200000 },
    { name: 'Orbit Design', text: 'on offer: $480', owedCents: 0 },
    { name: 'Parcel', text: 'owes $350', owedCents: 35000 },
  ]);
  assert.deepEqual(vendorLine('pipeline', view), vendorLine(view.vendors[0], view), 'a company can be named by its id');
  assert.equal(view.vendors.reduce((sum, v) => sum + vendorLine(v, view).owedCents, 0), view.totals.outstandingCents);
  assert.equal(vendorOf(view, 'pipeline').papers.length, 5, 'four papers and the invoice credit');
  assert.deepEqual(view.vendors.map((v) => vendorNow(view, v)), [
    'Pipeline CRM promised $2,400. $900 came in on an invoice. $1,500 is still owed, late since Oct 1.',
    'Nimbus Cloud promised $2,000. They sent a credit note for all of it, but it is not on an invoice yet. The window to claim closed Oct 30.',
    'Orbit Design offers $480, only if you renew. Nothing is owed unless you agree.',
    'Parcel promised $350. None of it has come in on an invoice, and it was due Nov 1.',
  ]);
  assert.equal(stationNow('book', view), '4 promises written down: money is still owed on three of them and one is an offer with strings attached.');
});

test('the reading desk reads the newest paper with a figure in it, and marks where', () => {
  const view = viewOf(createDemoWorkspace());
  const read = lastRead(view);
  assert.equal(read.source.id, 'pipeline-renewal');
  assert.equal(read.figure, 'USD 1,500');
  assert.equal(read.said, 'An offer of $1,500, with strings attached.');
  for (const passage of read.passages) assert.ok(passage.end <= read.text.length && passage.start < passage.end);
  // turned back to the day the October invoice came in, it is that invoice, by its number
  assert.equal(stationLine('read', viewOf(createDemoWorkspace(), '2026-10-01')).text, 'last read: INV-PC-1026');
});

test('the letters agree with the letter the book page shows', () => {
  const workspace = createDemoWorkspace();
  const view = viewOf(workspace);
  const l = letters(view);
  assert.deepEqual(l.waiting.map((item) => item.commitment.id), ['pipeline-seats']);
  assert.deepEqual(l.toWrite.map((item) => item.commitment.id), ['parcel-waiver']);
  assert.deepEqual(l.signed, []);
  for (const item of [...l.waiting, ...l.toWrite]) {
    const letter = letterFor(workspace, view, item.commitment);
    assert.ok(letter.canApprove, `${item.vendor}’s letter can be approved`);
    assert.equal(item.owedCents, stillOwedCents(item.commitment));
  }
  assert.equal(letterFor(workspace, view, view.commitments.find((c) => c.id === 'nimbus-sla')).canApprove, false, 'Nimbus’s window closed: no letter to write');
  assert.equal(stationNow('letter', view), 'A letter is drafted, to Pipeline CRM, asking for $1,500. It waits on your desk. Parcel’s letter is not drafted yet.');
  assert.equal(stationNow('you', view), 'Your turn: the letter to Pipeline CRM asking for $1,500.');
});

test('once you approve the letter, your desk is clear and Parcel’s letter is still to write', () => {
  const workspace = createDemoWorkspace();
  const after = send(workspace, approveLetterCommands(workspace, 'pipeline-seats', { now }));
  const view = viewOf(after);
  assert.deepEqual(stationLine('you', view), { text: 'nothing to sign' });
  assert.deepEqual(stationLine('letter', view), { text: '1 letter to write' });
  assert.deepEqual(letters(view).signed.map((item) => item.commitment.id), ['pipeline-seats']);
  assert.equal(stationNow('you', view), 'Nothing to sign. You signed the letter to Pipeline CRM on Nov 10.');
  assert.match(latestLine(view, after), /^latest: Nov 10 · Approved: keep the original promise and ask for \$1,500\.$/);
  assert.equal(latestLine(view), latestLine(view, after), 'the view alone finds the same last entry');
});

test('when the rest arrives on an invoice, the company is paid and the scale is lighter', () => {
  const workspace = createDemoWorkspace();
  const { commands, invoice } = nextInvoiceCommands(workspace, 'pipeline-seats', { actor, now, day: '2026-11-10' });
  const after = send(workspace, commands);
  const view = viewOf(after);
  assert.deepEqual(vendorLine('pipeline', view), { name: 'Pipeline CRM', text: 'paid', owedCents: 0 });
  assert.deepEqual(stationLine('scale', view), { text: '$2,350 short', owed: true });
  assert.equal(stationLine('read', view).text, `last read: ${invoice.id}`);
  assert.equal(stationLine('post', view).text, `${drawerPapers(view).length} papers in`);
  assert.equal(promiseStanding(view, view.commitments.find((c) => c.id === 'pipeline-seats')), 'paid in full');
  assert.equal(latestLine(view), latestLine(view, after));
});

test('the clock rings for a window about to close before anything that is merely late', () => {
  const view = viewOf(createDemoWorkspace(), '2026-10-25');
  const clock = clockOf(view);
  assert.equal(clock.urgent.kind, 'closing');
  assert.equal(stationLine('clock', view).text, 'Nimbus Cloud: 5 days left to claim');
  assert.equal(stationNow('clock', view), 'Nimbus Cloud: 5 days left to claim. Pipeline CRM has been late since Oct 1. Nimbus Cloud has been late since Oct 1.');
  // today: the window has closed, and the latest thing to go wrong is Parcel's date passing
  const today = clockOf(viewOf(createDemoWorkspace()));
  assert.deepEqual(today.late.map((item) => [item.vendor, item.days]), [['Pipeline CRM', 40], ['Parcel', 9]]);
  assert.deepEqual(today.closed.map((item) => [item.vendor, item.on]), [['Nimbus Cloud', '2026-10-30']]);
  assert.equal(stationNow('clock', viewOf(createDemoWorkspace())), 'Parcel is 9 days late. Pipeline CRM has been late since Oct 1. Nimbus Cloud’s window to claim closed Oct 30.');
});

test('the latest line is the day book’s last entry, read with or without the raw events', () => {
  const workspace = createDemoWorkspace();
  assert.equal(latestLine(viewOf(workspace), workspace), 'latest: Oct 28 · A decision was prepared: ask Nimbus Cloud for $2,000.');
  for (const day of ['2026-09-01', '2026-09-18', '2026-10-01', '2026-10-20', '2026-10-25', '2026-10-28', '2026-11-10']) {
    const view = viewOf(workspace, day);
    assert.equal(latestLine(view), latestLine(view, workspace), `the two readings agree on ${day}`);
  }
});

test('an empty book: every tag says so, quietly', () => {
  const view = viewOf(createWorkspace({ id: 'empty-book' }));
  assert.deepEqual(lines(view), {
    post: { text: 'no papers yet' },
    read: { text: 'nothing read yet' },
    book: { text: 'no promises yet' },
    scale: { text: 'nothing on it' },
    letter: { text: 'no letters to write' },
    you: { text: 'nothing to sign' },
    clock: { text: 'nothing is late' },
  });
  assert.equal(latestLine(view), '');
  assert.equal(lastRead(view), null);
  for (const id of STATION_IDS) assert.ok(stationNow(id, view).length > 0, `${id} says something`);
});

test('no book yet (view is null): everything is empty and nothing throws', () => {
  for (const id of STATION_IDS) assert.deepEqual(stationLine(id, null), { text: '' });
  for (const id of STATION_IDS) assert.equal(stationNow(id, null), '');
  assert.deepEqual(vendorLine({ id: 'pipeline', name: 'Pipeline CRM' }, null), { name: 'Pipeline CRM', text: '', owedCents: 0 });
  assert.equal(latestLine(null), '');
  assert.deepEqual(letters(null), { waiting: [], signed: [], toWrite: [] });
  assert.equal(vendorNow(null, 'pipeline'), '');
});

test('every day of the demo book reads cleanly: no blanks, no NaN, no undefined', () => {
  const workspace = createDemoWorkspace();
  for (let t = Date.parse('2026-09-01'); t <= Date.parse('2026-11-10'); t += 86400000) {
    const day = new Date(t).toISOString().slice(0, 10);
    const view = viewOf(workspace, day);
    const said = [
      ...STATION_IDS.flatMap((id) => [stationLine(id, view).text, stationNow(id, view)]),
      ...view.vendors.flatMap((v) => [vendorLine(v, view).text, vendorNow(view, v)]),
      latestLine(view),
    ];
    for (const text of said) {
      assert.ok(text, `something is said on ${day}`);
      assert.doesNotMatch(text, /undefined|NaN|null|\[object/, `${day}: ${text}`);
    }
  }
});
