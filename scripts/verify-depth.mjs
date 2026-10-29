#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createWorkspace, createDemoWorkspace, evaluateWorkspace, reduceWorkspace, simulateAction, validateWorkspace, runScenarios, canonical } from '../src/assurance/index.mjs';
import { analyzeEvidence } from '../src/engine/index.mjs';
import { prepareEvidenceImport } from '../src/assuranceImport.mjs';
import { replayWorkspace, verifyAssurancePacket } from './verify-assurance-packet.mjs';

const notice = 'Authored synthetic acceptance checks, not held-out accuracy, formal proof, authenticated evidence, or settlement finality.';
const actor = { id: 'depth-acceptance-admin', role: 'admin' }, now = '2026-10-29T12:00:00.000Z';
const ctx = { actor, now };
const snapshots = ['2026-09-30', '2026-10-29', '2026-11-20'];
let projections = 0;
const namedChecks = [];
const check = (name, fn) => { fn(); namedChecks.push(name); };

// Independent accounting equations over each complete committed command prefix,
// rather than trusting a scenario's predeclared pass flag or a UI total.
function inspectCents(workspace) {
  for (const asOf of snapshots) {
    const knownAt = workspace.events.at(-1)?.observedAt || now;
    const view = evaluateWorkspace(workspace, { asOf, knownAt });
    const credits = new Map(view.credits.map(credit => [credit.id, credit]));
    const commitments = new Map(view.commitments.map(commitment => [commitment.id, commitment]));
    for (const credit of view.credits) {
      const allocated = view.allocations.filter(a => a.creditId === credit.id).reduce((sum, a) => sum + a.amountCents - a.revokedCents, 0);
      assert.equal(credit.availableCents, credit.amountCents - credit.reversedCents);
      assert.equal(credit.availableCents, allocated + credit.unallocatedCents);
      assert.ok(Number.isSafeInteger(allocated) && allocated >= 0 && allocated <= credit.availableCents);
    }
    for (const allocation of view.allocations) {
      const credit = credits.get(allocation.creditId), commitment = commitments.get(allocation.commitmentId);
      assert.ok(credit && commitment);
      assert.equal(credit.vendorId, commitment.vendorId);
      assert.equal(credit.currency, commitment.currency);
      assert.equal(credit.reference, commitment.reference);
      assert.equal(allocation.activeCents + allocation.revokedCents, allocation.amountCents);
      assert.ok(allocation.activeCents >= 0 && allocation.revokedCents >= 0);
    }
    for (const commitment of view.commitments) {
      assert.ok(Number.isSafeInteger(commitment.promisedCents));
      assert.equal(commitment.verifiedCents + commitment.outstandingCents, commitment.promisedCents);
      assert.ok(commitment.verifiedCents >= 0 && commitment.verifiedCents <= commitment.promisedCents);
      if (commitment.conditions.length) assert.equal(commitment.verifiedCents, 0);
    }
    assert.equal(view.totals.verifiedCents, view.commitments.reduce((sum, c) => sum + c.verifiedCents, 0));
    assert.ok(view.totals.verifiedCents <= view.totals.ledgerAppliedCents);
    const graphIds = new Set(view.graph.nodes.map(node => node.id));
    assert.ok(view.graph.edges.every(edge => graphIds.has(edge.from) && graphIds.has(edge.to)));
    projections++;
  }
}

const scenarios = runScenarios();
check('All authored adversarial scenarios complete with their declared outcomes', () => {
  assert.ok(scenarios.length >= 9);
  for (const scenario of scenarios) {
    assert.equal(scenario.passed, true, `Scenario ${scenario.id} failed: ${scenario.checks.filter(c => !c.passed).map(c => c.name).join(', ')}`);
    replayWorkspace(scenario.workspace, inspectCents);
  }
});

check('Renewal comparison subtracts only explicit incremental costs and excludes already verified credits', () => {
  const seed = createDemoWorkspace();
  const pipeline = simulateAction(seed, { commitmentId: 'pipeline-seats', type: 'accept_amendment', payload: { amendmentId: 'amendment-pipeline-renewal' } });
  assert.equal(pipeline.economics.creditCents, 150000);
  assert.equal(pipeline.economics.incrementalRenewalCostCents, 240000);
  assert.equal(pipeline.economics.netIncrementalValueCents, -90000);
  const orbit = simulateAction(seed, { commitmentId: 'orbit-renewal', type: 'accept_amendment', payload: { amendmentId: 'amendment-orbit-renewal' } });
  assert.equal(orbit.economics.netIncrementalValueCents, -192000);
  assert.equal(orbit.policyDecision.allowed, false);
  assert.equal(evaluateWorkspace(seed).commitments.find(c => c.id === 'pipeline-seats').dueDate, '2026-10-01');
});

check('Effective-time and knowledge-time replay are distinct and retain the original branch', () => {
  const state = scenarios.find(scenario => scenario.id === 'late-amendment').workspace;
  const old = evaluateWorkspace(state, { asOf: '2026-10-29', knownAt: '2026-10-29T23:59:59.000Z' });
  const late = evaluateWorkspace(state, { asOf: '2026-10-29', knownAt: '2026-11-06T00:00:00.000Z' });
  assert.equal(old.commitments.find(c => c.id === 'pipeline-seats').dueDate, '2026-10-01');
  assert.equal(late.commitments.find(c => c.id === 'pipeline-seats').dueDate, '2026-11-15');
  assert.equal(old.totals.verifiedCents, late.totals.verifiedCents);
});

const [promiseText, invoiceCsv] = await Promise.all(['pipeline-promise.txt', 'pipeline-invoices.csv'].map(name => readFile(new URL('../public/examples/' + name, import.meta.url), 'utf8')));
const input = { vendor: 'Pipeline CRM', promiseText, invoiceCsv, asOf: '2026-10-28' };
const report = analyzeEvidence(input);
const importPlan = await prepareEvidenceImport(createWorkspace(), { ...report, appliedCents: 99999999 }, now);
const imported = importPlan.commands.reduce((state, command) => reduceWorkspace(state, command, ctx).state, createWorkspace());
check('Evidence import revalidates source documents and creates exact conserved portfolio value', () => {
  const view = evaluateWorkspace(imported);
  assert.equal(importPlan.report.appliedCents, 90000);
  assert.equal(view.totals.verifiedCents, 90000);
  assert.equal(view.commitments[0].outstandingCents, 150000);
  assert.ok(view.sources.some(source => source.text === promiseText));
  inspectCents(imported);
});
const repeatPlan = await prepareEvidenceImport(imported, report, now);
check('Repeated imports and the included portfolio case cannot duplicate invoice money', () => {
  assert.equal(repeatPlan.commands.length, 0);
  assert.equal(repeatPlan.commitmentId, importPlan.commitmentId);
});
const existingPlan = await prepareEvidenceImport(createDemoWorkspace(), report, now);
check('The parser joins existing portfolio identity instead of creating a second sample case', () => {
  assert.equal(existingPlan.commitmentId, 'pipeline-seats');
  assert.equal(existingPlan.commands.length, 0);
});
const aliased = analyzeEvidence({ ...input, promiseText: promiseText.replaceAll('PC-SEATS-2026', 'OTHER-REFERENCE'), invoiceCsv: invoiceCsv.replaceAll('PC-SEATS-2026', 'OTHER-REFERENCE') });
await assert.rejects(prepareEvidenceImport(imported, aliased, now), /conflicts with an existing ledger credit/);
namedChecks.push('Changing a reference cannot disguise the same legacy invoice credit as new money');

const packet = { format: 'truthful-assurance-packet-v1', exportedAt: now, mode: 'browser', actor, workspace: imported, view: evaluateWorkspace(imported, { asOf: '2026-10-29', knownAt: now }), invariantCheck: validateWorkspace(imported, { asOf: '2026-10-29', knownAt: now }) };
assert.equal((await verifyAssurancePacket(packet)).valid, true);
namedChecks.push('Browser packet reconstructs complete original commands and the exact financial projection');
let rejectedTamperCases = 0;
for (const change of [
  p => p.view.totals.verifiedCents++,
  p => p.workspace.events.find(e => e.type === 'CREDIT_REGISTERED').payload.credit.amountCents++,
  p => p.workspace.events.find(e => e.type === 'SOURCE_ADDED').payload.source.text = 'Altered original source',
  p => p.invariantCheck.valid = false,
  p => p.workspace.events[0].actor.role = 'viewer',
  p => { p.mode = 'server'; p.serverRecord = {}; },
]) {
  const changed = structuredClone(packet); change(changed);
  assert.equal((await verifyAssurancePacket(changed)).valid, false);
  rejectedTamperCases++;
}
namedChecks.push('Tampered money, source, actor, invariant claims and forged server wrappers are rejected');

const result = {
  notice,
  scenariosPassed: scenarios.length,
  authoredScenarioChecks: scenarios.flatMap(scenario => scenario.checks).length,
  committedReplayProjectionsChecked: projections,
  namedAcceptanceChecks: namedChecks.length,
  rejectedTamperCases,
  checks: namedChecks,
};
if (process.argv.includes('--json')) console.log(JSON.stringify(result, null, 2));
else {
  console.log(notice);
  for (const name of namedChecks) console.log(`PASS ${name}`);
  console.log(`${result.scenariosPassed} scenarios; ${result.authoredScenarioChecks} authored scenario checks; ${projections} committed-prefix/date projections; ${namedChecks.length} acceptance checks; ${rejectedTamperCases} rejected tamper cases.`);
}
