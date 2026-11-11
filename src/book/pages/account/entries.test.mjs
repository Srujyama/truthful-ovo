import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoWorkspace, evaluateWorkspace, reduceWorkspace } from '../../../assurance/index.mjs';
import { ledger } from '../../shell/money.mjs';
import { accountEntries, footing, offerWords, whoWrote } from './entries.mjs';

const NOW = '2026-11-10T18:00:00.000Z';
const look = workspace => evaluateWorkspace(workspace, { asOf: NOW.slice(0, 10), knownAt: NOW });
const promise = (view, id) => view.commitments.find(c => c.id === id);
const as = role => ({ actor: { id: `test-${role}`, role }, now: NOW });

function linesFor(workspace, id) {
  const view = look(workspace);
  return accountEntries(workspace, view, promise(view, id));
}

test('Pipeline runs 2,400.00 promised, 900.00 credited, 1,500.00 still owed, in that order', () => {
  const lines = linesFor(createDemoWorkspace(), 'pipeline-seats');
  const money = lines.filter(line => line.owedCents != null);
  assert.equal(money.length, 2);

  assert.equal(money[0].text, 'Pipeline CRM promised $2,400, due Oct 1.');
  assert.equal(ledger(money[0].promisedCents), '2,400.00');
  assert.equal(money[0].creditedCents, null);
  assert.equal(ledger(money[0].owedCents), '2,400.00');
  assert.equal(money[0].date, '2026-09-18');
  assert.equal(money[0].by, 'the demo book');
  assert.deepEqual(money[0].papers, [{ sourceId: 'pipeline-promise', revision: 6, label: 'the email' }]);

  assert.equal(money[1].text, 'Invoice INV-PC-1026 took off $900.');
  assert.equal(money[1].promisedCents, null);
  assert.equal(ledger(money[1].creditedCents), '900.00');
  assert.equal(ledger(money[1].owedCents), '1,500.00');
  assert.deepEqual(money[1].papers, [{ sourceId: 'pipeline-invoice', revision: 10, label: 'the invoice' }]);

  assert.ok(lines.indexOf(money[0]) < lines.indexOf(money[1]));
  assert.deepEqual(lines.map(line => line.sequence), [...lines.map(line => line.sequence)].sort((a, b) => a - b));
});

test('Pipeline: the two offers are lines that move no money', () => {
  const lines = linesFor(createDemoWorkspace(), 'pipeline-seats');
  assert.deepEqual(lines.map(line => line.text), [
    'Pipeline CRM promised $2,400, due Oct 1.',
    'Invoice INV-PC-1026 took off $900.',
    'They offered to pay later: Nov 15 instead of Oct 1.',
    'They offered $1,500 if you renew. That is $2,400 more spending.',
  ]);
  for (const line of lines.slice(2)) {
    assert.equal(line.owedCents, null);
    assert.equal(line.papers[0].label, 'their note');
  }
});

test('the lines add up to the promise’s own figures, for every promise in the demo book', () => {
  const workspace = createDemoWorkspace();
  const view = look(workspace);
  for (const commitment of view.commitments) {
    const sums = footing(accountEntries(workspace, view, commitment));
    assert.equal(sums.promisedCents, commitment.promisedCents, commitment.id);
    assert.equal(sums.creditedCents, commitment.verifiedCents, commitment.id);
    if (commitment.conditions.length) assert.equal(sums.owedCents, null, commitment.id);
    else assert.equal(sums.owedCents, commitment.outstandingCents, commitment.id);
  }
});

test('a credit note that is not on an invoice is a line with no money in it', () => {
  const lines = linesFor(createDemoWorkspace(), 'nimbus-sla');
  const note = lines.find(line => line.type === 'CREDIT_ALLOCATED');
  assert.equal(note.text, 'Credit note CM-NC-204 for $2,000. It is not on an invoice yet.');
  assert.equal(note.creditedCents, null);
  assert.equal(note.owedCents, null);
  assert.equal(note.papers[0].label, 'the credit note');
  assert.equal(lines[0].papers.length, 2);
});

test('an offer with strings is never a debt', () => {
  const lines = linesFor(createDemoWorkspace(), 'orbit-renewal');
  assert.equal(lines[0].text, 'Orbit Design offered $480 with a string attached: “Accept a new 12-month renewal.”');
  assert.ok(lines.every(line => line.offer && line.owedCents == null));
  assert.equal(lines[1].text, 'The renewal they want is $2,400 more spending.');
});

test('an approved decision and a declined offer each produce a line', () => {
  let workspace = createDemoWorkspace();
  workspace = reduceWorkspace(workspace, { type: 'APPROVE_ACTION', actionId: 'action-pipeline-preserve' }, as('approver')).state;
  workspace = reduceWorkspace(workspace, { type: 'EXECUTE_ACTION', actionId: 'action-pipeline-preserve' }, as('executor')).state;
  workspace = reduceWorkspace(workspace, { type: 'DISMISS_AMENDMENT', amendmentId: 'amendment-pipeline-renewal', reason: 'too expensive' }, as('approver')).state;
  const lines = linesFor(workspace, 'pipeline-seats');

  const approved = lines.find(line => line.type === 'ACTION_APPROVED');
  assert.equal(approved.text, 'Approved: keep the original promise and ask for the rest, $1,500.');
  assert.equal(approved.by, 'Approver');
  assert.equal(approved.owedCents, null);

  const written = lines.find(line => line.type === 'ACTION_EXECUTED');
  assert.equal(written.text, 'Written in the book: keep the original promise and ask for the rest, $1,500.');
  assert.equal(written.by, 'Bookkeeper');

  const declined = lines.find(line => line.type === 'AMENDMENT_DISMISSED');
  assert.equal(declined.text, 'You declined the renewal: ‘too expensive’.');
  assert.equal(declined.by, 'Approver');
  assert.deepEqual(declined.papers, [{ sourceId: 'pipeline-renewal', revision: 23, label: 'their note' }]);

  assert.ok(lines.indexOf(approved) < lines.indexOf(written) && lines.indexOf(written) < lines.indexOf(declined));
  assert.equal(footing(lines).owedCents, 150000);
});

test('taking the later date is one line, and the money does not move', () => {
  let workspace = createDemoWorkspace();
  workspace = reduceWorkspace(workspace, { type: 'DISMISS_AMENDMENT', amendmentId: 'amendment-pipeline-renewal', reason: 'We are not renewing.' }, as('approver')).state;
  const proposed = reduceWorkspace(workspace, { type: 'PROPOSE_ACTION', action: { commitmentId: 'pipeline-seats', type: 'accept_amendment', payload: { amendmentId: 'amendment-pipeline-date' } } }, as('analyst'));
  workspace = reduceWorkspace(proposed.state, { type: 'APPROVE_ACTION', actionId: proposed.result.actionId }, as('approver')).state;
  workspace = reduceWorkspace(workspace, { type: 'EXECUTE_ACTION', actionId: proposed.result.actionId }, as('executor')).state;
  const lines = linesFor(workspace, 'pipeline-seats');

  assert.equal(lines.find(line => line.type === 'AMENDMENT_DISMISSED').text, 'You declined the renewal: ‘We are not renewing’.');
  assert.equal(lines.find(line => line.type === 'ACTION_APPROVED').text, 'Approved: take the later date, Nov 15.');
  assert.equal(lines.at(-1).text, 'You took the later date. It is due Nov 15 now.');
  assert.equal(lines.filter(line => line.type === 'ACTION_EXECUTED').length, 0);
  assert.equal(footing(lines).owedCents, 150000);
});

test('the words on a renewal tag say what it really costs', () => {
  const view = look(createDemoWorkspace());
  const words = offerWords(view.amendments.find(a => a.id === 'amendment-pipeline-renewal'), promise(view, 'pipeline-seats'), view.asOf);
  assert.equal(words.said, 'A $1,500 credit if you spend $2,400 more.');
  assert.equal(words.cost, 'That costs you $900.');
  const later = offerWords(view.amendments.find(a => a.id === 'amendment-pipeline-date'), promise(view, 'pipeline-seats'), view.asOf);
  assert.deepEqual([later.title, later.said], ['Pay later', 'Nov 15 instead of Oct 1.']);
});

test('who wrote it', () => {
  assert.equal(whoWrote({ id: 'seed-curator', role: 'admin' }), 'the demo book');
  assert.equal(whoWrote({ id: 'browser-demo-executor', role: 'executor' }), 'Bookkeeper');
  assert.equal(whoWrote({ id: 'u-1', role: 'admin' }), 'Owner');
});
