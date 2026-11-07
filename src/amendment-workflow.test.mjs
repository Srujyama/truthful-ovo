import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkspace, evaluateWorkspace, reduceWorkspace, validateWorkspace } from './assurance/index.mjs';
import { prepareAmendmentWorkflow } from './amendment-workflow.mjs';

const actor = { id: 'analyst-test', role: 'analyst' };
const admin = { id: 'admin-test', role: 'admin' };
const now = '2026-11-06T16:00:00.000Z';
function fixture() {
  let state = createWorkspace();
  const commands = [
    { type: 'ADD_VENDOR', vendor: { id: 'vendor', name: 'Example vendor' } },
    { type: 'ADD_SOURCE', source: { id: 'original', vendorId: 'vendor', title: 'Original', text: 'USD 2,400 credit due November 1.', kind: 'email' } },
    { type: 'CREATE_COMMITMENT', commitment: { id: 'commitment', vendorId: 'vendor', currency: 'USD', reference: 'EX-2026', promisedCents: 240000, dueDate: '2026-11-01', claimDeadline: null, conditions: [], sourceIds: ['original'] } },
  ];
  for (const command of commands) state = reduceWorkspace(state, command, { actor, now: '2026-11-01T12:00:00.000Z' }).state;
  return state;
}
const input = (overrides = {}) => ({ commitmentId: 'commitment', changes: { promisedCents: true }, promisedAmount: '2600.00', effectiveDate: '2026-11-06', sourceTitle: 'Revised offer', sourceText: 'We propose a USD 2,600 credit.', ...overrides });
function apply(state, commands, user = actor, clock = now) {
  for (const command of commands) state = reduceWorkspace(state, command, { actor: user, now: clock }).state;
  return state;
}

test('source-backed preparation is non-mutating and records proposal plus exact review without changing terms', () => {
  const workspace = fixture(), original = structuredClone(workspace);
  const result = prepareAmendmentWorkflow(workspace, input(), { actor, now });
  assert.deepEqual(workspace, original);
  assert.deepEqual(result.commands.map(c => c.type), ['ADD_SOURCE', 'PROPOSE_AMENDMENT', 'PROPOSE_ACTION']);
  assert.equal(result.before.commitments[0].promisedCents, 240000);
  assert.equal(result.after.commitments[0].promisedCents, 240000);
  const amendment = result.after.amendments.find(a => a.id === result.amendmentId);
  assert.equal(amendment.patch.promisedCents, 260000);
  assert.equal(amendment.accepted, false);
  const action = result.after.actions.find(a => a.id === result.actionId);
  assert.equal(action.payload.amendmentId, result.amendmentId);
  assert.equal(action.approval, null);
  assert.equal(action.policyDecision.allowed, true);
  const next = apply(workspace, result.commands);
  assert.equal(validateWorkspace(next).valid, true);
  assert.equal(next.events.at(-3).payload.source.text, 'We propose a USD 2,600 credit.');
});

test('explicit selected fields preserve all unselected terms and support removing deadline and conditions', () => {
  const result = prepareAmendmentWorkflow(fixture(), input({
    changes: { dueDate: true, claimDeadline: true, conditions: true }, dueDate: '2026-11-20', claimDeadline: '', conditions: 'One\nTwo', promisedAmount: '9999',
  }), { actor, now });
  assert.deepEqual(result.commands[1].amendment.patch, { dueDate: '2026-11-20', claimDeadline: null, conditions: ['One', 'Two'] });
  assert.equal(result.after.commitments[0].dueDate, '2026-11-01');
});

test('future amendment needs separate approval and execution; effective and known-time replay stay distinct', () => {
  const plan = prepareAmendmentWorkflow(fixture(), input({ effectiveDate: '2026-12-01' }), { actor, now });
  let state = apply(fixture(), plan.commands);
  state = apply(state, [{ type: 'APPROVE_ACTION', actionId: plan.actionId }], { id: 'approver', role: 'approver' });
  assert.equal(evaluateWorkspace(state).commitments[0].promisedCents, 240000);
  state = apply(state, [{ type: 'EXECUTE_ACTION', actionId: plan.actionId }], { id: 'executor', role: 'executor' });
  assert.equal(evaluateWorkspace(state, { asOf: '2026-11-06', knownAt: now }).commitments[0].promisedCents, 240000);
  assert.equal(evaluateWorkspace(state, { asOf: '2026-12-01', knownAt: now }).commitments[0].promisedCents, 260000);
  assert.equal(evaluateWorkspace(state, { asOf: '2026-12-01', knownAt: '2026-11-05T12:00:00Z' }).commitments[0].promisedCents, 240000);
});

test('incompatible proposals remain explicit and approval refuses until the conflict is resolved', () => {
  const first = prepareAmendmentWorkflow(fixture(), input(), { actor, now });
  const state = apply(fixture(), first.commands);
  const second = prepareAmendmentWorkflow(state, input({ promisedAmount: '2800' }), { actor, now });
  const blocked = second.after.actions.find(a => a.id === second.actionId);
  assert.equal(blocked.policyDecision.allowed, false);
  assert.match(blocked.policyDecision.reasons.join(' '), /Unresolved amendment conflict/);
  const next = apply(state, second.commands);
  assert.throws(() => apply(next, [{ type: 'APPROVE_ACTION', actionId: second.actionId }], admin), /blocked by policy/);
  assert.equal(evaluateWorkspace(next).commitments[0].promisedCents, 240000);
});

test('new source-backed proposal invalidates old approval without rewriting or executing it', () => {
  let state = apply(fixture(), [{ type: 'PROPOSE_ACTION', action: { id: 'original-review', commitmentId: 'commitment', type: 'prepare_claim', payload: {} } }]);
  state = apply(state, [{ type: 'APPROVE_ACTION', actionId: 'original-review' }], admin);
  const plan = prepareAmendmentWorkflow(state, input(), { actor, now });
  const next = apply(state, plan.commands);
  assert.equal(plan.after.actions.find(a => a.id === 'original-review').approvalStale, true);
  assert.throws(() => apply(next, [{ type: 'EXECUTE_ACTION', actionId: 'original-review' }], admin), /approval no longer matches/);
});

test('renewal authoring requires explicit economics and stays blocked by current mandate', () => {
  const renewal = input({ renewal: true, baselineAmount: '72000', incrementalAmount: '2400', baselineDescription: '12 months at USD 6,000/month under the existing contract.' });
  const result = prepareAmendmentWorkflow(fixture(), renewal, { actor, now });
  const action = result.after.actions.find(a => a.id === result.actionId);
  assert.equal(action.economics.baselineCostCents, 7200000);
  assert.equal(action.economics.incrementalRenewalCostCents, 240000);
  assert.equal(action.economics.netIncrementalValueCents, 20000);
  assert.equal(action.policyDecision.allowed, false);
  assert.match(action.policyDecision.reasons.join(' '), /forbids new contractual commitments/);
  for (const overrides of [{ baselineAmount: '' }, { incrementalAmount: '' }, { baselineDescription: '' }, { incrementalAmount: '-1' }]) {
    assert.throws(() => prepareAmendmentWorkflow(fixture(), { ...renewal, ...overrides }, { actor, now }));
  }
});

test('the same credit with a new renewal obligation is a material proposal', () => {
  const state = fixture();
  const original = structuredClone(state);
  const renewal = input({ promisedAmount: '2400', renewal: true, baselineAmount: '72000', incrementalAmount: '3600', baselineDescription: '12-month existing agreement at USD 6,000/month.', sourceText: 'The same USD 2,400 credit now requires a 12-month renewal at USD 6,300/month.' });
  const plan = prepareAmendmentWorkflow(state, renewal, { actor, now });
  const amendment = plan.after.amendments.find(a => a.id === plan.amendmentId);
  const action = plan.after.actions.find(a => a.id === plan.actionId);
  assert.deepEqual(amendment.patch, { promisedCents: 240000 });
  assert.equal(amendment.newCommitment, true);
  assert.equal(action.economics.netIncrementalValueCents, -120000);
  assert.equal(action.policyDecision.allowed, false);
  assert.equal(plan.after.commitments[0].promisedCents, 240000);
  assert.deepEqual(state, original);
  for (const overrides of [{ baselineAmount: '' }, { baselineDescription: '' }, { incrementalAmount: '' }]) {
    assert.throws(() => prepareAmendmentWorkflow(state, { ...renewal, ...overrides }, { actor, now }), /Baseline|baseline|Incremental/);
  }
  assert.throws(() => prepareAmendmentWorkflow(state, { ...renewal, renewal: false }, { actor, now }), /match the current agreement/);
});

test('a renewal-only proposal explicitly retains the promise in the returned preview and requires separate approval', () => {
  const plan = prepareAmendmentWorkflow(fixture(), input({ changes: {}, promisedAmount: '99999', renewal: true, baselineAmount: '72000', incrementalAmount: '2400', baselineDescription: '12 months under the existing agreement.' }), { actor, now });
  assert.deepEqual(plan.commands[1].amendment.patch, { promisedCents: 240000 });
  assert.deepEqual(plan.retainedFields, ['promisedCents']);
  assert.match(plan.previewNotice, /current promise amount is retained/);
  assert.equal(plan.after.actions.find(a => a.id === plan.actionId).approval, null);
  assert.equal(plan.after.commitments[0].incrementalObligationCents, 0);
  assert.throws(() => apply(apply(fixture(), plan.commands), [{ type: 'APPROVE_ACTION', actionId: plan.actionId }], admin), /blocked by policy/);
  assert.throws(() => prepareAmendmentWorkflow(fixture(), input({ changes: {}, renewal: false }), { actor, now }), /Select at least one term/);
});

test('reject malformed or nonpositive money without rounding or partial source writes', () => {
  const state = fixture(), original = structuredClone(state);
  for (const promisedAmount of ['-2', '0', '0.001', '1e3', '$3.00', '1,500.00', '900719925474099.99', '', 'NaN']) {
    assert.throws(() => prepareAmendmentWorkflow(state, input({ promisedAmount }), { actor, now }), /amount|USD/);
    assert.deepEqual(state, original);
  }
  const precise = prepareAmendmentWorkflow(state, input({ promisedAmount: '0.01' }), { actor, now });
  assert.equal(precise.commands[1].amendment.patch.promisedCents, 1);
});

test('roles, history, observation clock, source and immutable identity are checked before recording', () => {
  for (const role of ['viewer', 'approver', 'executor']) assert.throws(() => prepareAmendmentWorkflow(fixture(), input(), { actor: { id: role, role }, now }), /Requires analyst or admin/);
  assert.throws(() => prepareAmendmentWorkflow(fixture(), input(), { actor, now, readOnly: true }), /Historical view/);
  assert.throws(() => prepareAmendmentWorkflow(fixture(), input(), { actor, now: '2026-10-01T12:00:00Z' }), /cannot precede/);
  assert.throws(() => prepareAmendmentWorkflow(fixture(), input(), { actor, now: '2026-11-06' }), /ISO/);
  for (const sourceText of ['', ' ', 'x'.repeat(250001)]) assert.throws(() => prepareAmendmentWorkflow(fixture(), input({ sourceText }), { actor, now }), /source text/);
  for (const key of ['vendorId', 'reference', 'currency', 'patch']) assert.throws(() => prepareAmendmentWorkflow(fixture(), input({ [key]: 'replacement' }), { actor, now }), /cannot be changed/);
  assert.throws(() => prepareAmendmentWorkflow(fixture(), input({ commitmentId: 'missing' }), { actor, now }), /Select a commitment/);
});

test('empty/no-op changes and invalid dates/conditions are held for correction', () => {
  for (const overrides of [
    { changes: {} }, { promisedAmount: '2400' }, { effectiveDate: '2026-02-30' },
    { changes: { dueDate: true }, dueDate: '2026-11-31' },
    { changes: { claimDeadline: true }, claimDeadline: 'not a date' },
    { changes: { conditions: true }, conditions: Array.from({ length: 21 }, (_, i) => String(i)).join('\n') },
    { changes: { conditions: true }, conditions: 'a'.repeat(1001) },
    { changes: { vendorId: true } }, { changes: { dueDate: 'yes' } },
  ]) assert.throws(() => prepareAmendmentWorkflow(fixture(), input(overrides), { actor, now }));
});
