import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoWorkspace, createWorkspace, evaluateWorkspace, reduceWorkspace, validateWorkspace } from './assurance/index.mjs';
import { csvCell, financialReport, operationQueue, reportCsv, sourceKey, sourceLibrary, sourceUsages, vendorSummaries, workspaceActivity } from './operations.mjs';

const now = '2026-11-07T16:00:00.000Z';
const actor = { id: 'operator-test', role: 'admin' };
const project = (state, options = {}) => evaluateWorkspace(state, { asOf: '2026-11-07', knownAt: now, ...options });
function apply(state, commands, at = now, user = actor) {
  for (const command of commands) state = reduceWorkspace(state, command, { actor: user, now: at }).state;
  return state;
}
function partialLedger() {
  return apply(createDemoWorkspace(), [
    { type: 'ADD_SOURCE', source: { id: 'parcel-invoice-ops', vendorId: 'parcel', title: 'Partial Parcel invoice', kind: 'invoice', text: 'A USD 300 credit line for PL-SETUP-2026.' } },
    { type: 'REGISTER_CREDIT', credit: { id: 'parcel-credit-ops', vendorId: 'parcel', currency: 'USD', reference: 'PL-SETUP-2026', invoiceId: 'INV-PARCEL-OPS', lineId: 'line-1', amountCents: 30000, status: 'applied', sourceIds: ['parcel-invoice-ops'] } },
    { type: 'ALLOCATE_CREDIT', allocationId: 'parcel-allocation-ops', commitmentId: 'parcel-waiver', creditId: 'parcel-credit-ops', amountCents: 10000, sourceIds: ['parcel-invoice-ops'] },
    { type: 'REVERSE_CREDIT', creditId: 'parcel-credit-ops', amountCents: 5000, sourceIds: ['parcel-invoice-ops'] },
  ]);
}

test('vendor reports conserve the global ledger without adding attributed and physical balances', () => {
  const state = partialLedger(), view = project(state), vendors = vendorSummaries(view);
  assert.equal(validateWorkspace(state).valid, true);
  for (const field of ['promisedCents', 'verifiedCents', 'outstandingCents', 'recoverableCents', 'conditionalCents', 'issuedCents', 'ledgerAppliedCents', 'allocatedCents', 'quarantinedCents', 'incrementalObligationCents', 'netVerifiedValueCents']) {
    assert.equal(vendors.reduce((total, vendor) => total + vendor.totals[field], 0), view.totals[field], field);
  }
  const parcel = vendors.find(vendor => vendor.id === 'parcel');
  assert.equal(parcel.totals.ledgerAppliedCents, 25000);
  assert.equal(parcel.totals.verifiedCents, 10000);
  assert.equal(parcel.totals.unallocatedCents, 15000);
  assert.equal(parcel.totals.availableCents, parcel.totals.allocatedCents + parcel.totals.unallocatedCents);
  const nimbus = vendors.find(vendor => vendor.id === 'nimbus');
  assert.equal(nimbus.totals.issuedCents, 200000);
  assert.equal(nimbus.totals.verifiedCents, 0);
  assert.equal(vendorSummaries(view, { query: 'does-not-exist' }).length, 0);
  assert.equal(vendorSummaries(view, { query: 'PL-SETUP-2026' })[0].id, 'parcel');
});

test('ambiguous attribution removes verified value but counts the physical credit only once', () => {
  const state = apply(createDemoWorkspace(), [{ type: 'CREATE_COMMITMENT', commitment: { id: 'pipeline-duplicate-ops', vendorId: 'pipeline', reference: 'PC-SEATS-2026', currency: 'USD', promisedCents: 90000, dueDate: '2026-10-01', conditions: [], sourceIds: ['pipeline-promise'] } }]);
  const view = project(state), pipeline = vendorSummaries(view).find(vendor => vendor.id === 'pipeline');
  assert.equal(pipeline.totals.ledgerAppliedCents, 90000);
  assert.equal(pipeline.totals.quarantinedCents, 90000);
  assert.equal(pipeline.totals.verifiedCents, 0);
  assert.equal(pipeline.totals.allocatedCents, 90000);
  assert.equal(view.totals.ledgerAppliedCents, 90000);
});

test('available-credit work respects each resolved assignment cap rather than another case capacity', () => {
  const state=apply(partialLedger(),[
    {type:'CREATE_COMMITMENT',commitment:{id:'parcel-second-ops',vendorId:'parcel',reference:'PL-SETUP-2026',currency:'USD',promisedCents:15000,dueDate:'2026-11-01',conditions:[],sourceIds:['parcel-invoice-ops']}},
    {type:'RESOLVE_CREDIT',creditId:'parcel-credit-ops',assignments:[{commitmentId:'parcel-waiver',limitCents:10000},{commitmentId:'parcel-second-ops',limitCents:15000}],sourceIds:['parcel-invoice-ops']},
  ]);
  const queue=operationQueue(project(state));
  assert.equal(queue.find(row=>row.commitmentId==='parcel-waiver').issues.some(issue=>issue.title==='Attribute available credit'),false);
  assert.equal(queue.find(row=>row.commitmentId==='parcel-second-ops').issues.some(issue=>issue.title==='Attribute available credit'),true);
  assert.equal(project(state).credits.find(credit=>credit.id==='parcel-credit-ops').unallocatedCents,15000);
});

test('operations prioritizes recorded risk once per case and links the actual conflicting action', () => {
  const view = project(createDemoWorkspace()), queue = operationQueue(view);
  assert.equal(queue.length, 4);
  assert.equal(new Set(queue.map(item => item.commitmentId)).size, 4);
  assert.equal(queue[0].commitmentId, 'nimbus-sla');
  assert.equal(queue[0].category, 'urgent');
  assert.match(queue[0].reason, /2026-10-30/);
  const pipeline = queue.find(item => item.commitmentId === 'pipeline-seats');
  assert.equal(pipeline.title, 'Resolve competing terms');
  assert.equal(pipeline.actionId, 'action-pipeline-renewal');
  assert.equal(pipeline.destination, 'decisions');
  assert.ok(pipeline.issues.length > 1);
  assert.equal(operationQueue(view, { vendorId: 'parcel' }).length, 1);
  assert.equal(operationQueue(view, { query: 'PC-SEATS-2026' })[0].commitmentId, 'pipeline-seats');
  assert.equal(operationQueue(view, { query: 'no such reference' }).length, 0);
  assert.equal(operationQueue(view, { category: 'evidence' })[0].commitmentId, 'nimbus-sla');
});

test('new ledger evidence produces stale review checks and unattributed credit work without mutation', () => {
  const state = partialLedger(), original = structuredClone(state), view = project(state), queue = operationQueue(view);
  assert.equal(queue.find(item => item.commitmentId === 'orbit-renewal').title, 'Refresh the action review');
  assert.equal(queue.find(item => item.commitmentId === 'parcel-waiver').title, 'Attribute available credit');
  assert.deepEqual(state, original);
});

test('unmatched credit without a candidate is a separate vendor-level exception', () => {
  const state = apply(createDemoWorkspace(), [{ type: 'REGISTER_CREDIT', credit: { id: 'orphan-credit-ops', vendorId: 'parcel', currency: 'USD', reference: 'UNMATCHED-REF', invoiceId: 'ORPHAN', lineId: '1', amountCents: 1000, status: 'issued', sourceIds: ['parcel-promise'] } }]);
  const item = operationQueue(project(state)).find(item => item.creditId === 'orphan-credit-ops');
  assert.equal(item.commitmentId, null);
  assert.equal(item.destination, 'vendors');
  assert.equal(item.vendorId, 'parcel');
  assert.equal(item.amountCents, 1000);
});

test('library cutoffs exclude unobserved revisions and never substitute newer text for an old usage', () => {
  const base = createDemoWorkspace();
  const initialView = project(base), original = initialView.sources.find(source => source.id === 'pipeline-promise');
  const state = apply(base, [{ type: 'REVISE_SOURCE', sourceId: 'pipeline-promise', text: 'FUTURE-SECRET revised promise; not known in October.' }], '2026-11-06T12:00:00.000Z');
  const current = project(state), old = project(state, { knownAt: '2026-10-28T23:59:59.999Z' });
  assert.ok(!sourceLibrary(old, { versions: 'all' }).some(source => source.text.includes('FUTURE-SECRET')));
  assert.ok(!sourceLibrary(old, { query: 'FUTURE-SECRET', versions: 'all' }).length);
  assert.equal(sourceLibrary(old).find(source => source.id === original.id).revision, original.revision);
  const revisions = sourceLibrary(current, { versions: 'all' }).filter(source => source.id === original.id);
  assert.equal(revisions.length, 2);
  assert.notEqual(sourceKey(revisions[0]), sourceKey(revisions[1]));
  const oldSource = revisions.find(source => source.revision === original.revision);
  assert.equal(oldSource.text, original.text);
  assert.equal(oldSource.isCurrent, false);
  assert.ok(sourceUsages(current, original.id, original.revision).some(usage => usage.kind === 'commitment' && usage.id === 'pipeline-seats'));
  assert.ok(!sourceUsages(current, original.id, revisions[0].revision).some(usage => usage.kind === 'commitment'));
  assert.deepEqual(sourceUsages(old, original.id, revisions[0].revision), []);
  assert.equal(sourceLibrary(current, { vendorId: 'nimbus', kind: 'credit_memo' })[0].id, 'nimbus-memo');
  assert.equal(sourceLibrary(current, { query: 'nonexistent' }).length, 0);
});

test('exact source usages include allocation, reversal and authority bindings with explicit related cases', () => {
  const view = project(partialLedger()), source = view.sources.find(source => source.id === 'parcel-invoice-ops');
  const usages = sourceUsages(view, source.id, source.revision);
  for (const kind of ['credit', 'allocation', 'reversal']) assert.ok(usages.some(usage => usage.kind === kind), kind);
  assert.ok(usages.filter(usage => usage.kind !== 'action').every(usage => usage.commitmentIds.includes('parcel-waiver')));
  const original = view.sourceVersions.find(source => source.id === 'pipeline-promise');
  assert.ok(sourceUsages(view, original.id, original.revision).some(usage => usage.kind === 'action' && usage.actionId === 'action-nimbus-claim'));
});

test('activity filters use observed time, retain exact payload, and trace ledger events to the right vendor', () => {
  const state = partialLedger(), view = project(state), all = workspaceActivity(state, view);
  assert.equal(all.length, state.events.length);
  assert.equal(all[0].type, 'CREDIT_REVERSED');
  assert.deepEqual(all[0].payload, state.events.at(-1).payload);
  assert.deepEqual(all[0].vendorIds, ['parcel']);
  assert.deepEqual(all[0].commitmentIds, ['parcel-waiver']);
  assert.equal(workspaceActivity(state, view, { actorId: actor.id }).length, 4);
  assert.equal(workspaceActivity(state, view, { fromDate: '2026-11-07', toDate: '2026-11-07' }).length, 4);
  assert.equal(workspaceActivity(state, view, { vendorId: 'parcel', type: 'CREDIT_ALLOCATED' }).length, 1);
  assert.equal(workspaceActivity(state, view, { query: 'INV-PARCEL-OPS' }).length, 1);
  assert.equal(workspaceActivity(state, view, { query: 'not-present' }).length, 0);
  const old = project(state, { knownAt: '2026-10-28T23:59:59.999Z' });
  assert.equal(workspaceActivity(state, old).length, createDemoWorkspace().events.length);
  assert.ok(!workspaceActivity(state, old).some(event => event.actor.id === actor.id));
});

test('financial report separates effective and knowledge dates and agrees with vendor reconciliation', () => {
  const state = apply(createDemoWorkspace(), [{ type: 'REGISTER_CREDIT', effectiveDate: '2026-10-25', credit: { id: 'late-parcel-credit', vendorId: 'parcel', currency: 'USD', reference: 'PL-SETUP-2026', invoiceId: 'LATE-PARCEL', lineId: '1', amountCents: 35000, status: 'issued', sourceIds: ['parcel-promise'] } }]);
  const knownOld = financialReport(state, { asOf: '2026-11-07', knownAt: '2026-10-28T23:59:59.999Z' });
  const effectiveOld = financialReport(state, { asOf: '2026-10-24', knownAt: now });
  const current = financialReport(state, { asOf: '2026-11-07', knownAt: now });
  assert.equal(knownOld.totals.issuedCents, 200000);
  assert.equal(effectiveOld.totals.issuedCents, 0);
  assert.equal(current.totals.issuedCents, 235000);
  assert.equal(current.observedEventCount, state.events.length);
  assert.equal(knownOld.observedEventCount, createDemoWorkspace().events.length);
  assert.equal(current.vendors.reduce((total, vendor) => total + vendor.totals.unallocatedCents, 0), current.totals.unallocatedCents);
  assert.throws(() => financialReport(state, { asOf: '2026-02-30', knownAt: now }), /real YYYY-MM-DD/);
});

test('empty workspaces yield real empty projections and a valid totals-only CSV', () => {
  const state = createWorkspace(), view = project(state);
  assert.deepEqual(vendorSummaries(view), []);
  assert.deepEqual(operationQueue(view), []);
  assert.deepEqual(sourceLibrary(view), []);
  assert.deepEqual(workspaceActivity(state, view), []);
  const report = financialReport(state, { asOf: '2026-11-07', knownAt: now });
  assert.equal(report.totals.unallocatedCents, 0);
  assert.equal(report.observedEventCount, 0);
  assert.equal(reportCsv(report).split('\r\n').filter(Boolean).length, 2);
});

test('CSV exports exact integer cents and neutralizes malicious text cells without hiding negative money', () => {
  for (const value of ['=HYPERLINK("https://invalid")', '+SUM(1,2)', '-1+2', '@SUM(A1)', ' \t=1+1', '\n=1+1', '\tordinary text', '\uFEFF=1+1', '\u0000=1+1']) assert.ok(csvCell(value).startsWith('"\''), value);
  assert.equal(csvCell('Vendor "A", Inc.'), '"Vendor ""A"", Inc."');
  assert.equal(csvCell(-120000), '-120000');
  assert.throws(() => csvCell(1.2), /integer cents/);
  const state = apply(createWorkspace(), [{ type: 'ADD_VENDOR', vendor: { id: '=DANGEROUS-ID', name: '=HYPERLINK("https://invalid")' } }]);
  const report = financialReport(state, { asOf: '2026-11-07', knownAt: now }), csv = reportCsv(report);
  assert.match(csv, /verified_cents/);
  assert.match(csv, /"'=HYPERLINK\(""https:\/\/invalid""\)"/);
  assert.match(csv, /"'=DANGEROUS-ID"/);
  assert.match(csv, /"WORKSPACE TOTAL"/);
  assert.ok(csv.includes('"2026-11-07"'));
});
