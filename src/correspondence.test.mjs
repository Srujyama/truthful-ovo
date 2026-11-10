import test from 'node:test';
import assert from 'node:assert/strict';
import {createDemoWorkspace, createWorkspace, evaluateWorkspace, reduceWorkspace} from './assurance/index.mjs';
import {demoCommands} from './assurance/fixtures.mjs';
import {formatMoney, correspondenceDocuments, correspondenceStory} from './correspondence.mjs';

const now = '2026-11-09T12:00:00.000Z';
const options = {asOf: '2026-11-09', knownAt: '2026-11-09T23:59:59.999Z'};
const evaluate = state => evaluateWorkspace(state, options);
const send = (state, command) => reduceWorkspace(state, command, {actor: {id: 'display-test', role: 'admin'}, now}).state;
const story = (view, id) => correspondenceStory(view, view.commitments.find(item => item.id === id));

test('print money retains actual cents without a wall of unnecessary decimal zeroes', () => {
  assert.equal(formatMoney(150000), '$1,500');
  assert.equal(formatMoney(150050), '$1,500.50');
  assert.equal(formatMoney(-192000), '-$1,920');
  assert.equal(formatMoney(0), '$0');
  assert.throws(() => formatMoney(1.5), TypeError);
  assert.throws(() => formatMoney(NaN), TypeError);
});

test('the partial invoice and both unaccepted alternatives are explained without changing the record', () => {
  const view = evaluate(createDemoWorkspace()), before = JSON.stringify(view);
  const result = story(view, 'pipeline-seats');
  assert.equal(result.headline, 'The invoice is $1,500 short');
  assert.equal(result.detail, 'They promised $2,400. The matching invoice shows $900 of credit.');
  assert.equal(result.amountsCents.applied, 90000);
  assert.equal(result.amountsCents.missing, 150000);
  const renewal = result.warnings.find(item => item.kind === 'renewal');
  assert.equal(renewal.creditCents, 150000);
  assert.equal(renewal.extraCostCents, 240000);
  assert.equal(renewal.netCostCents, 90000);
  assert.match(renewal.title, /\$900 more/);
  const delay = result.warnings.find(item => item.kind === 'date-change');
  assert.equal(delay.date, '2026-11-15');
  assert.match(delay.detail, /October 1/);
  assert.equal(renewal.accepted, false);
  assert.equal(delay.accepted, false);
  assert.equal(JSON.stringify(view), before);
});

test('an issued note stays distinct from an invoice and an expired claim is a secondary fact', () => {
  const result = story(evaluate(createDemoWorkspace()), 'nimbus-sla');
  assert.equal(result.kind, 'credit-note');
  assert.match(result.headline, /\$2,000 credit note/);
  assert.match(result.detail, /No invoice here confirms/);
  assert.equal(result.amountsCents.applied, 0);
  assert.equal(result.amountsCents.issued, 200000);
  assert.equal(result.deadlineNote, 'The claim deadline passed October 30.');
  assert.doesNotMatch(result.headline, /recoverable|available to claim|deadline/i);
  assert(result.documents.some(item => item.kind === 'credit_memo'));
  assert(!result.documents.some(item => item.kind === 'invoice'));
});

test('a conditional offer is not money owed and its extra cost uses the explicit comparison', () => {
  const result = story(evaluate(createDemoWorkspace()), 'orbit-renewal');
  assert.equal(result.kind, 'offer');
  assert.equal(result.amounts.owed, '—');
  assert.equal(result.amountsCents.owed, null);
  assert.equal(result.amounts.promised, '$480');
  assert.equal(result.complete, false);
  const renewal = result.warnings.find(item => item.kind === 'renewal');
  assert.equal(renewal.extraCostCents, 240000);
  assert.equal(renewal.netCostCents, 192000);
  assert.equal(renewal.baselineCostCents, 0);
  assert.match(renewal.baselineDescription, /Cancellation/);
  assert.match(result.detail, /\$2,400 in extra spending/);
  assert.doesNotMatch(result.headline, /owed|short|saved/i);
});

test('missing recorded invoices are described as missing evidence, including a new company and cents', () => {
  const parcel = story(evaluate(createDemoWorkspace()), 'parcel-waiver');
  assert.match(parcel.detail, /expected November 1/);
  assert.match(parcel.detail, /No matching invoice has been added/);
  let state = createWorkspace();
  state = send(state, {type: 'ADD_VENDOR', vendor: {id: 'fresh-vendor', name: 'Lumen Components'}});
  state = send(state, {type: 'ADD_SOURCE', source: {id: 'fresh-promise', vendorId: 'fresh-vendor', kind: 'email', title: 'Price correction', text: 'We will credit USD 63.15 on the November 20 invoice. Reference LM-2026.'}});
  state = send(state, {type: 'CREATE_COMMITMENT', commitment: {id: 'fresh-case', vendorId: 'fresh-vendor', reference: 'LM-2026', currency: 'USD', promisedCents: 6315, dueDate: '2026-11-20', conditions: [], sourceIds: ['fresh-promise']}});
  const view = evaluate(state), result = story(view, 'fresh-case');
  assert.equal(result.company, 'Lumen Components');
  assert.equal(result.amounts.promised, '$63.15');
  assert.equal(result.kind, 'not-due');
  assert.match(result.detail, /No matching invoice has been added/);
  assert.doesNotMatch(result.detail, /never paid|did not pay|has not applied/i);
  assert.equal(correspondenceStory(view, view.commitments[0], 'Lumen team').company, 'Lumen team');
});

test('document reading uses exact direct relationships, including old versions, not conservative action inclusions', () => {
  const original = createDemoWorkspace();
  const revised = send(original, {type: 'REVISE_SOURCE', sourceId: 'pipeline-promise', text: 'A later document that must not replace the bound original.'});
  const view = evaluate(revised), commitment = view.commitments.find(item => item.id === 'pipeline-seats');
  const result = correspondenceStory(view, commitment), docs = result.documents;
  assert.deepEqual(new Set(docs.map(item => item.sourceId)), new Set(['pipeline-promise', 'pipeline-proposal', 'pipeline-renewal', 'pipeline-invoice']));
  const promise = docs.find(item => item.sourceId === 'pipeline-promise');
  assert.equal(promise.revision, 6);
  assert.match(promise.text, /USD 2,400/);
  assert.doesNotMatch(promise.text, /later document/);
  assert(result.warnings.some(item => item.kind === 'new-source-version'));
  const missing = correspondenceDocuments({...view, sourceVersions: view.sourceVersions.filter(item => !(item.id === 'pipeline-promise' && item.revision === 6))}, commitment).find(item => item.sourceId === 'pipeline-promise');
  assert.equal(missing.available, false);
  assert.equal(missing.source, null);
  assert.equal(missing.text, null);
  assert.equal(missing.revision, 6);
});

test('an invoice already present but not assigned never becomes a false no-invoice message', () => {
  let state = createWorkspace();
  for (const [index, step] of demoCommands.entries()) {
    if (step.command.type === 'ALLOCATE_CREDIT' && step.command.commitmentId === 'pipeline-seats') continue;
    state = reduceWorkspace(state, {id: `unassigned-${index}`, ...step.command}, {actor: {id: 'seed', role: 'admin'}, now: step.at}).state;
  }
  const result = story(evaluate(state), 'pipeline-seats');
  assert.equal(result.kind, 'needs-matching');
  assert.equal(result.amountsCents.applied, 0);
  assert(result.documents.some(item => item.kind === 'invoice'));
  assert.doesNotMatch(result.detail, /No matching invoice|No invoice here/);
});

test('a full invoice match is completed only while its backed credit survives a causal reversal', () => {
  let state = createDemoWorkspace();
  state = send(state, {type: 'ADD_SOURCE', source: {id: 'extra-invoice', vendorId: 'pipeline', kind: 'invoice', title: 'Remaining correction', text: 'USD 1,500 applied to PC-SEATS-2026 on invoice INV-EXTRA.'}});
  state = send(state, {type: 'REGISTER_CREDIT', credit: {id: 'extra-credit', invoiceId: 'INV-EXTRA', vendorId: 'pipeline', reference: 'PC-SEATS-2026', currency: 'USD', amountCents: 150000, status: 'applied', sourceIds: ['extra-invoice']}});
  state = send(state, {type: 'ALLOCATE_CREDIT', allocationId: 'extra-allocation', creditId: 'extra-credit', commitmentId: 'pipeline-seats', amountCents: 150000});
  let result = story(evaluate(state), 'pipeline-seats');
  assert.equal(result.complete, true);
  assert.equal(result.amountsCents.missing, 0);
  assert.equal(result.headline, 'The full $2,400 is on the invoice');
  state = send(state, {type: 'ADD_SOURCE', source: {id: 'reversal-note', vendorId: 'pipeline', kind: 'credit_memo', title: 'Correction reversal', text: 'The USD 1,500 credit on INV-EXTRA is reversed in full.'}});
  state = send(state, {type: 'REVERSE_CREDIT', creditId: 'extra-credit', amountCents: 150000, allocationReversals: [{allocationId: 'extra-allocation', amountCents: 150000}], sourceIds: ['reversal-note']});
  result = story(evaluate(state), 'pipeline-seats');
  assert.equal(result.complete, false);
  assert.equal(result.amountsCents.applied, 90000);
  assert.equal(result.amountsCents.missing, 150000);
  assert.equal(result.kind, 'partly-applied');
  assert(result.documents.some(item => item.sourceId === 'reversal-note' && item.roles.includes('reversal')));
});


test('a partly matched credit note never masquerades as a smaller physical note', () => {
  let state = createWorkspace();
  for (const [index, step] of demoCommands.entries()) {
    const command=step.command.type==='ALLOCATE_CREDIT'&&step.command.commitmentId==='nimbus-sla'?{...step.command,amountCents:10000}:step.command;
    state=reduceWorkspace(state,{id:`partial-note-${index}`,...command},{actor:{id:'seed',role:'admin'},now:step.at}).state;
  }
  const result=story(evaluate(state),'nimbus-sla');
  assert.equal(result.amountsCents.issued,10000);
  assert.match(result.headline,/\$100 of credit notes/);
  assert.match(result.detail,/\$100 is matched.*\$2,000 note/);
  assert.doesNotMatch(result.headline,/A \$100 credit note/);
});
