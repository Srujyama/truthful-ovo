import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateSla, currency, getTotals, initialState, transition } from './domain.mjs';

const run = (...actions) => actions.reduce(transition, initialState());

test('September case: nine hours in thirty days produces a $2,000 credit', () => {
  assert.deepEqual(calculateSla(), {
    uptime: 98.75, rate: 0.25, amount: 2000, eligible: true,
    reason: '25% of eligible monthly charges under the service agreement.',
  });
});

test('SLA boundaries are strict: exactly 99.9% has no credit; exactly 99% earns 10%', () => {
  assert.equal(calculateSla({ downtimeMinutes: 43.2 }).rate, 0);
  assert.equal(calculateSla({ downtimeMinutes: 43.20001 }).rate, 0.1);
  assert.equal(calculateSla({ downtimeMinutes: 432 }).rate, 0.1);
  assert.equal(calculateSla({ downtimeMinutes: 432.00001 }).rate, 0.25);
  assert.equal(calculateSla({ downtimeMinutes: 0 }).amount, 0);
});

test('out-of-scope incidents produce evidence explaining why no claim applies', () => {
  const result = calculateSla({ covered: false });
  assert.equal(result.eligible, false);
  assert.equal(result.amount, 0);
  assert.equal(result.rate, 0);
  assert.match(result.reason, /outside the services/);
});

test('invalid financial and time inputs fail explicitly', () => {
  for (const field of ['bill', 'downtimeMinutes', 'periodMinutes']) {
    for (const value of [-1, NaN, Infinity, '8000', null]) {
      assert.throws(() => calculateSla({ [field]: value }), RangeError);
    }
  }
  assert.throws(() => calculateSla({ periodMinutes: 0 }), RangeError);
  assert.throws(() => calculateSla({ downtimeMinutes: 43201 }), RangeError);
  assert.throws(() => calculateSla({ covered: 'true' }), TypeError);
});

test('money is rounded to cents and formatted without unnecessary decimals', () => {
  assert.equal(calculateSla({ bill: 8000.02 }).amount, 2000.01);
  assert.equal(currency(2000), '$2,000');
  assert.equal(currency(2000.25), '$2,000.25');
  assert.throws(() => currency(NaN), TypeError);
});

test('initial state counts only the known partial CRM credit', () => {
  assert.deepEqual(getTotals(initialState()), {
    recoverable: 1500, realized: 900, activeCount: 2, reviewCount: 1,
  });
});

test('claim and conditional offer never become realized money', () => {
  const state = run('DETECT_OUTAGE', 'SUBMIT_CLAIM', 'VENDOR_CONDITION');
  assert.equal(state.nimbus, 'conditional');
  assert.deepEqual(getTotals(state), {
    recoverable: 3500, realized: 900, activeCount: 2, reviewCount: 2,
  });
  assert.equal(transition(state, 'KEEP_TERMS').nimbus, 'submitted');
});

test('issued credit remains pending until invoice application is verified', () => {
  const issued = run('DETECT_OUTAGE', 'SUBMIT_CLAIM', 'ISSUE_CREDIT');
  assert.equal(issued.nimbus, 'issued');
  assert.equal(getTotals(issued).realized, 900);
  assert.equal(getTotals(issued).recoverable, 3500);
  const applied = transition(issued, 'APPLY_CREDIT');
  assert.deepEqual(getTotals(applied), {
    recoverable: 1500, realized: 2900, activeCount: 1, reviewCount: 1,
  });
  assert.equal(transition(applied, 'APPLY_CREDIT'), applied);
});

test('conditional CRM counteroffer preserves the original outstanding amount', () => {
  const state = run('PIPELINE_CONDITION');
  assert.equal(state.pipeline, 'conditional');
  assert.deepEqual(getTotals(state), getTotals(initialState()));
  assert.equal(transition(state, 'PIPELINE_KEEP_TERMS').pipeline, 'partial');
  const applied = transition(state, 'PIPELINE_APPLY');
  assert.equal(getTotals(applied).realized, 2400);
  assert.equal(getTotals(applied).recoverable, 0);
  assert.equal(transition(applied, 'PIPELINE_APPLY'), applied);
});

test('confirmed deferral removes the currently due balance without inventing savings', () => {
  const scheduled = run('PIPELINE_CONDITION', 'PIPELINE_DEFER');
  assert.equal(scheduled.pipelineDeferred, true);
  assert.deepEqual(getTotals(scheduled), {
    recoverable: 0, realized: 900, activeCount: 2, reviewCount: 0,
  });
  assert.equal(transition(scheduled, 'PIPELINE_APPLY'), scheduled);
  const restored = transition(scheduled, 'PIPELINE_RESTORE');
  assert.equal(restored.pipelineDeferred, false);
  assert.deepEqual(getTotals(restored), getTotals(initialState()));
});

test('invalid transitions and duplicate events preserve state; supported actions are immutable', () => {
  const original = initialState();
  assert.equal(transition(original, 'APPLY_CREDIT'), original);
  assert.equal(transition(original, 'SUBMIT_CLAIM'), original);
  assert.equal(transition(original, 'UNKNOWN'), original);
  const detected = transition(original, { type: 'DETECT_OUTAGE' });
  assert.equal(original.nimbus, 'monitoring');
  assert.deepEqual(original.events, []);
  assert.equal(transition(detected, 'DETECT_OUTAGE'), detected);
  assert.deepEqual(detected.events.map(({ id, type, caseId }) => ({ id, type, caseId })), [
    { id: 'event-1', type: 'DETECT_OUTAGE', caseId: 'nimbus' },
  ]);
  assert.equal(transition(detected, 'SUBMIT_CLAIM').events[1].id, 'event-2');
});

test('reset creates an independent clean state for repeatable recordings', () => {
  const prior = run('DETECT_OUTAGE', 'SUBMIT_CLAIM', 'ISSUE_CREDIT', 'APPLY_CREDIT', 'PIPELINE_APPLY');
  const reset = transition(prior, 'RESET');
  assert.deepEqual(reset, initialState());
  assert.notEqual(reset.events, initialState().events);
  assert.deepEqual(getTotals(prior), {
    recoverable: 0, realized: 4400, activeCount: 0, reviewCount: 0,
  });
});
