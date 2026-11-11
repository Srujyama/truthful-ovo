// The book's own words, checked against the demo book.
//   node --test src/book/pages/records/plain.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoWorkspace, evaluateWorkspace, reduceWorkspace } from '../../../assurance/index.mjs';
import { operationQueue, workspaceActivity } from '../../../operations.mjs';
import { TITLE } from './engine.mjs';
import { DAY_KINDS, TODO_KINDS, dayKind, dayLine, standing, standingLine, standingWords, todoLine, todoLines, waitingOn, whoWrote } from './plain.mjs';

const workspace = createDemoWorkspace();
const at = (asOf, by = asOf) => evaluateWorkspace(workspace, { asOf, knownAt: `${by}T23:59:59.999Z` });
const view = at('2026-11-10');
const queue = operationQueue(view, {});
const row = id => queue.find(item => item.commitmentId === id);

test('every row of the queue is said in the book’s words, with who it waits on', () => {
  assert.equal(queue.length, 4);
  const engineTitles = new Set(Object.values(TITLE));
  for (const item of queue) {
    const line = todoLine(item, view);
    assert.ok(line.what && !engineTitles.has(line.what), `${item.id}: “${line.what}” is the engine’s own title`);
    assert.notEqual(line.what, item.title);
    assert.ok(line.waitsOn, `${item.id} waits on nobody`);
    assert.ok(Array.isArray(line.roles));
    assert.doesNotMatch(line.what, /undefined|NaN|\d{4}-\d{2}-\d{2}/, `${item.id}: “${line.what}”`);
    for (const issue of item.issues) {
      const also = todoLine({ ...item, ...issue }, view);
      assert.ok(also.what && !engineTitles.has(also.what), `${item.id}: “${issue.title}” has no words`);
      assert.ok(also.waitsOn);
    }
  }
});

test('the demo book’s four lines read as a person would say them', () => {
  assert.match(todoLine(row('nimbus-sla'), view).what, /^Their claim window closed Oct 30(, 2026)?\. \$2,000 is at stake\.$/);
  assert.equal(todoLine(row('nimbus-sla'), view).waitsOn, 'their invoice');
  assert.equal(todoLine(row('pipeline-seats'), view).what, 'Two offers disagree on the date. Take one or decline both.');
  assert.equal(todoLine(row('pipeline-seats')).what, 'Two offers disagree. Take one or decline both.');
  assert.equal(todoLine(row('orbit-renewal'), view).what, 'Their $480 comes only if you spend $2,400 more. The house rules say no.');
  assert.equal(todoLine(row('parcel-waiver'), view).what, 'Nothing on an invoice yet. Ask for the $350.');
});

test('under a line: whatever else the same promise needs, said once', () => {
  const nimbus = todoLines(row('nimbus-sla'), view);
  assert.deepEqual(nimbus.also.map(line => line.what), ['Add the invoice that shows the $2,000 credit.']);
  const pipeline = todoLines(row('pipeline-seats'), view);
  assert.deepEqual(pipeline.also.map(line => line.what), [
    'Their $1,500 comes only if you spend $2,400 more. The house rules say no.',
    'The invoice came $1,500 short. Ask for the rest.',
  ]);
  assert.equal(pipeline.actionId, 'action-pipeline-renewal');
  assert.deepEqual(todoLines(row('parcel-waiver'), view).also, []);
});

test('with a kind picked, the line of that kind leads', () => {
  const chase = todoLines(row('pipeline-seats'), view, 'claim');
  assert.equal(chase.what, 'The invoice came $1,500 short. Ask for the rest.');
  assert.equal(chase.category, 'claim');
  assert.ok(chase.also.some(line => line.what.startsWith('Two offers disagree')));
  for (const kind of TODO_KINDS) assert.ok(kind.label && !/[_]/.test(kind.label));
});

test('a title this does not know comes back as it is', () => {
  const odd = todoLine({ title: 'Reconcile the frobnicator', commitment: row('parcel-waiver').commitment });
  assert.deepEqual(odd, { what: 'Reconcile the frobnicator', waitsOn: 'you', roles: [] });
});

test('waiting on: “you” only when the pen in your hand can do it', () => {
  const decide = todoLine(row('pipeline-seats'), view);
  assert.equal(waitingOn(decide, 'analyst'), 'an approver');
  assert.equal(waitingOn(decide, 'approver'), 'you');
  assert.equal(waitingOn(decide, 'admin'), 'you');
  assert.equal(waitingOn(todoLine(row('nimbus-sla'), view), 'admin'), 'their invoice');
  assert.equal(waitingOn(todoLine(row('orbit-renewal'), view), 'approver'), 'the owner');
});

test('turned back to Oct 28: Parcel is not due yet and waits on its date', () => {
  const then = at('2026-10-28');
  const parcel = operationQueue(then, {}).find(item => item.commitmentId === 'parcel-waiver');
  assert.equal(parcel.category, 'scheduled');
  const line = todoLine(parcel, then);
  assert.match(line.what, /^Due Nov 1(, 2026)?\. Nothing to do until then\.$/);
  assert.match(line.waitsOn, /^Nov 1(, 2026)?$/);
  const nimbus = then.commitments.find(c => c.id === 'nimbus-sla');
  assert.equal(standing(nimbus, then.asOf), 'overdue');
  assert.match(standingWords(nimbus, then.asOf), /^overdue since Oct 1(, 2026)?, claim by Oct 30(, 2026)?$/);
  assert.match(standingWords(then.commitments.find(c => c.id === 'parcel-waiver'), then.asOf), /^due Nov 1(, 2026)?$/);
});

test('where an IOU stands today', () => {
  const words = id => standingWords(view.commitments.find(c => c.id === id), view.asOf);
  assert.match(words('nimbus-sla'), /^claim window closed Oct 30/);
  assert.match(words('pipeline-seats'), /^overdue since Oct 1(, 2026)?$/);
  assert.equal(words('orbit-renewal'), 'an offer with strings attached');
  assert.match(words('parcel-waiver'), /^overdue since Nov 1(, 2026)?$/);
  assert.equal(standingLine([], view.asOf), 'nothing promised yet');
  assert.equal(standingLine(view.commitments, view.asOf), '4 IOUs, 3 overdue');
});

// Every id the book holds: none of them belongs in a sentence.
function idsIn(state, seen) {
  const ids = new Set();
  for (const event of state.events) { ids.add(event.id); ids.add(event.commandId); }
  for (const list of [seen.vendors, seen.sourceVersions, seen.commitments, seen.credits, seen.allocations, seen.amendments, seen.actions]) for (const item of list) ids.add(item.id);
  return [...ids].filter(Boolean);
}
const CODE_NAME = /\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b/;
const hasId = (line, ids) => ids.find(id => new RegExp(`(^|[^A-Za-z0-9-])${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^A-Za-z0-9-])`).test(line));

test('all 28 entries of the demo book get a line with no id and no CODE_NAME in it', () => {
  const events = workspaceActivity(workspace, view, {});
  assert.equal(events.length, 28);
  const ids = idsIn(workspace, view);
  const kinds = new Set(DAY_KINDS.map(kind => kind.id));
  for (const event of events) {
    const line = dayLine(event, view);
    assert.ok(line.length > 12, `entry ${event.sequence} has no line`);
    assert.doesNotMatch(line, CODE_NAME, `entry ${event.sequence}: “${line}”`);
    assert.equal(hasId(line, ids), undefined, `entry ${event.sequence} shows an id: “${line}”`);
    assert.doesNotMatch(line, /undefined|null|NaN|\[object|\d{4}-\d{2}-\d{2}|\$\D/, `entry ${event.sequence}: “${line}”`);
    assert.doesNotMatch(line, /^Something else/, `entry ${event.sequence} (${event.type}) has no words of its own`);
    assert.ok(kinds.has(dayKind(event)) && dayKind(event) !== 'other', `entry ${event.sequence} has no kind`);
    assert.equal(dayLine(workspace.events[event.sequence - 1], view), line, 'a raw entry reads the same as a day-book row');
  }
});

test('the day book says the demo’s entries the way the brief does', () => {
  const line = n => dayLine(workspace.events[n - 1], view);
  assert.equal(line(1), 'Opened a page for Pipeline CRM.');
  assert.equal(line(6), 'Filed Pipeline CRM’s letter, “Original duplicate-seat correction”.');
  assert.equal(line(13), 'Filed Orbit Design’s offer, “Orbit renewal-linked offer”.');
  assert.equal(line(18), 'Filed Nimbus Cloud’s credit note, “Nimbus credit memo issued”.');
  assert.match(line(7), /^Pipeline CRM promised \$2,400, due Oct 1(, 2026)?\.$/);
  assert.match(line(9), /^Nimbus Cloud promised \$2,000, due Oct 1(, 2026)?\. Claims close Oct 30(, 2026)?\.$/);
  assert.equal(line(11), 'Invoice INV-PC-1026 took off $900.');
  assert.equal(line(12), 'Matched $900 of invoice INV-PC-1026 to the $2,400 promise.');
  assert.equal(line(14), 'Orbit Design offered $480 with strings attached: “Accept a new 12-month renewal.”');
  assert.equal(line(15), 'They offered $480 if you renew. That means spending $2,400 more.');
  assert.equal(line(19), 'Nimbus Cloud sent credit note CM-NC-204 for $2,000.');
  assert.equal(line(20), 'Matched $2,000 of credit note CM-NC-204 to the $2,000 promise.');
  assert.match(line(22), /^They offered to pay later: Nov 15(, 2026)?\.$/);
  assert.equal(line(24), 'They offered $1,500 if you renew. That means spending $2,400 more.');
  assert.equal(line(25), 'A decision was prepared: keep the original promise and ask for $1,500.');
  assert.equal(line(26), 'A decision was prepared: take the renewal offer and spend $2,400 more.');
  assert.equal(line(28), 'A decision was prepared: ask Nimbus Cloud for $2,000.');
});

test('what people do after the demo is said plainly too', () => {
  const steps = [
    [{ id: 'approver-1', role: 'approver' }, { type: 'DISMISS_AMENDMENT', amendmentId: 'amendment-pipeline-date', reason: 'too late for us' }],
    [{ id: 'approver-1', role: 'approver' }, { type: 'DISMISS_AMENDMENT', amendmentId: 'amendment-pipeline-renewal', reason: 'Costs more than it gives.' }],
    [{ id: 'analyst-1', role: 'analyst' }, { type: 'PROPOSE_ACTION', action: { id: 'action-keep', commitmentId: 'pipeline-seats', type: 'preserve_original', payload: {} } }],
    [{ id: 'approver-1', role: 'approver' }, { type: 'APPROVE_ACTION', actionId: 'action-keep' }],
    [{ id: 'bookkeeper-1', role: 'executor' }, { type: 'EXECUTE_ACTION', actionId: 'action-keep' }],
    [{ id: 'owner-1', role: 'admin' }, { type: 'SET_POLICY', policy: { claimLimitCents: 600000, renewalLimitCents: 250000, allowNewCommitments: true } }],
  ];
  let state = workspace;
  steps.forEach(([actor, command], i) => {
    state = reduceWorkspace(state, { id: `test-command-${i}`, ...command }, { actor, now: `2026-11-10T1${i}:00:00.000Z` }).state;
  });
  const after = evaluateWorkspace(state, { asOf: '2026-11-10', knownAt: '2026-11-10T23:59:59.999Z' });
  const lines = state.events.slice(28).map(event => dayLine(event, after));
  assert.deepEqual(lines, [
    'Declined their offer to pay later: “too late for us”.',
    'Declined their renewal offer: “Costs more than it gives”.',
    'A decision was prepared: keep the original promise and ask for $1,500.',
    'Approved: keep the original promise and ask for $1,500.',
    'Written in the book: keep the original promise and ask for $1,500.',
    'Set the house rules: a claim may be up to $6,000, a renewal may add up to $2,500, and an offer may add a new obligation.',
  ]);
  const ids = idsIn(state, after);
  for (const line of lines) {
    assert.doesNotMatch(line, CODE_NAME);
    assert.equal(hasId(line, ids), undefined, line);
  }
  // Every line the queue can now hold still has words and someone to wait on.
  for (const item of operationQueue(after, {})) {
    const line = todoLines(item, after);
    assert.ok(line.what && line.waitsOn && !Object.values(TITLE).includes(line.what), item.title);
    for (const more of line.also) assert.ok(more.what && !Object.values(TITLE).includes(more.what));
  }
});

test('who wrote a line', () => {
  assert.equal(whoWrote({ id: 'seed-curator', role: 'admin' }), 'The demo book');
  assert.equal(whoWrote({ id: 'browser-demo-approver', role: 'approver' }), 'Approver');
  assert.equal(whoWrote({ id: 'browser-demo-executor', role: 'executor', name: 'Demo executor' }), 'Bookkeeper');
  assert.equal(whoWrote({ id: 'u-1', role: 'analyst', name: 'Maya Chen' }), 'Maya Chen');
});

test('a credit that matches no promise gets a line of its own', () => {
  const analyst = { id: 'analyst-1', role: 'analyst' };
  let state = workspace;
  const send = (command, i) => { state = reduceWorkspace(state, { id: `stray-${i}`, ...command }, { actor: analyst, now: `2026-11-10T1${i}:00:00.000Z` }).state; };
  send({ type: 'ADD_SOURCE', source: { id: 'parcel-stray', vendorId: 'parcel', title: 'November invoice', kind: 'invoice', text: 'Invoice INV-PL-9: USD 120 credit, reference PL-OTHER-1.' } }, 0);
  send({ type: 'REGISTER_CREDIT', credit: { id: 'credit-stray', lineId: 'credit-stray', invoiceId: 'INV-PL-9', vendorId: 'parcel', currency: 'USD', reference: 'PL-OTHER-1', amountCents: 12000, status: 'applied', sourceIds: ['parcel-stray'] } }, 1);
  const after = evaluateWorkspace(state, { asOf: '2026-11-10', knownAt: '2026-11-10T23:59:59.999Z' });
  const stray = operationQueue(after, {}).find(item => item.creditId === 'credit-stray');
  assert.ok(stray, 'the queue lists the stray credit');
  const line = todoLines(stray, after);
  assert.equal(line.what, 'A $120 credit matches no promise. Find the one it covers.');
  assert.equal(line.waitsOn, 'an analyst');
  assert.deepEqual(line.also, []);
  assert.equal(dayLine(state.events.at(-1), after), 'Invoice INV-PL-9 took off $120.');
  assert.equal(dayLine(state.events.at(-2), after), 'Filed Parcel’s invoice, “November invoice”.');
});
