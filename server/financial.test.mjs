import test from 'node:test';
import assert from 'node:assert/strict';
import { createService, verifyExportPacket } from './service.mjs';

async function financialHarness(t) {
  const service = await createService({ clock: () => '2026-11-01T12:00:00.000Z' });
  const { baseUrl } = await service.listen({ port: 0 });
  t.after(() => service.close());
  const login = await fetch(baseUrl + '/api/session', { method: 'POST', headers: { Origin: baseUrl, 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'admin' }) });
  const cookie = login.headers.get('set-cookie').split(';')[0], identity = await login.json();
  const request = async (path, payload, key = 'financial-write') => {
    const response = await fetch(baseUrl + path, { method: payload ? 'POST' : 'GET', headers: { Cookie: cookie, Origin: baseUrl, ...(payload ? { 'Content-Type': 'application/json', 'X-CSRF-Token': identity.csrfToken, 'Idempotency-Key': key } : {}) }, ...(payload ? { body: JSON.stringify(payload) } : {}) });
    return { status: response.status, body: await response.json() };
  };
  return { service, request };
}

test('real engine: issued credit becomes verified only with invoice evidence; temporal replay and export agree', async t => {
  const { request } = await financialHarness(t);
  const before = await request('/api/workspace');
  assert.equal(before.body.revision, 0);
  assert.equal(before.body.domainRevision, 28);
  assert.equal(before.body.view.totals.verifiedCents, 90000);
  assert.equal(before.body.view.totals.issuedCents, 200000);
  const commands = [
    { type: 'ADD_SOURCE', source: { id: 'server-nimbus-applied', vendorId: 'nimbus', title: 'November invoice', kind: 'invoice', text: 'SYNTHETIC. INV-NC-1126 applies USD 2,000 credit CM-NC-204 for NC-SLA-2026; USD 8,000 minus USD 2,000 leaves USD 6,000 due.' } },
    { type: 'APPLY_CREDIT', creditId: 'credit-nimbus-2000', sourceIds: ['server-nimbus-applied'], effectiveDate: '2026-11-01' },
  ];
  const applied = await request('/api/batch', { commands, expectedRevision: 0 }, 'real-invoice-batch');
  assert.equal(applied.status, 200);
  assert.equal(applied.body.revision, 1);
  assert.equal(applied.body.domainRevision, 30);
  assert.equal(applied.body.view.totals.verifiedCents, 290000);
  const retried = await request('/api/batch', { commands, expectedRevision: 0 }, 'real-invoice-batch');
  assert.deepEqual(retried.body, applied.body);
  const oldKnowledge = await request('/api/workspace?asOf=2026-11-01&knownAt=2026-10-28T12%3A00%3A00.000Z');
  assert.equal(oldKnowledge.body.view.totals.verifiedCents, 90000);
  const oldEffectiveDate = await request('/api/workspace?asOf=2026-10-28&knownAt=2026-11-01T12%3A00%3A00.000Z');
  assert.equal(oldEffectiveDate.body.view.totals.verifiedCents, 90000);
  const exported = await request('/api/export');
  assert.equal((await verifyExportPacket(exported.body)).valid, true);
  assert.equal(exported.body.audit.length, 1);
  assert.equal(exported.body.audit[0].command.commands.length, 2);
});

test('real engine: a duplicate allocation cannot consume one credit twice, and preceding batch evidence is rolled back', async t => {
  const { request } = await financialHarness(t);
  const batch = await request('/api/batch', { expectedRevision: 0, commands: [
    { type: 'ADD_SOURCE', source: { id: 'must-roll-back', vendorId: 'pipeline', title: 'Attempted second claim', kind: 'invoice', text: 'SYNTHETIC: this new evidence does not create more credit capacity.' } },
    { type: 'ALLOCATE_CREDIT', allocationId: 'duplicate-server-allocation', creditId: 'credit-pipeline-900', commitmentId: 'pipeline-seats', amountCents: 90000 },
  ] }, 'duplicate-allocation-batch');
  assert.equal(batch.status, 422);
  assert.equal(batch.body.error.code, 'INSUFFICIENT_CREDIT');
  const after = (await request('/api/workspace')).body;
  assert.equal(after.revision, 0);
  assert.equal(after.domainRevision, 28);
  assert.equal(after.view.totals.verifiedCents, 90000);
  assert.equal(after.view.sources.some(source => source.id === 'must-roll-back'), false);
  assert.equal((await request('/api/events')).body.events.length, 0);
});

test('real engine: approval uses server actor and a source change makes it stale before execution', async t => {
  const { request } = await financialHarness(t);
  const action = { id: 'server-action-preserve', commitmentId: 'pipeline-seats', type: 'preserve_original', payload: {} };
  const proposed = await request('/api/commands', { expectedRevision: 0, command: { type: 'PROPOSE_ACTION', action } }, 'server-propose');
  assert.equal(proposed.status, 200);
  const approved = await request('/api/commands', { expectedRevision: 1, command: { type: 'APPROVE_ACTION', actionId: action.id } }, 'server-approve');
  assert.equal(approved.status, 200);
  const approvedAction = approved.body.view.actions.find(item => item.id === action.id);
  assert.equal(approvedAction.status, 'approved');
  assert.equal(approvedAction.approval.actor.id, 'demo-admin');
  const revised = await request('/api/commands', { expectedRevision: 2, command: { type: 'REVISE_SOURCE', sourceId: 'pipeline-promise', text: 'SYNTHETIC: revised vendor evidence requires a fresh review.' } }, 'server-revise-source');
  assert.equal(revised.status, 200);
  const execution = await request('/api/commands', { expectedRevision: 3, command: { type: 'EXECUTE_ACTION', actionId: action.id } }, 'server-stale-execute');
  assert.equal(execution.status, 409);
  assert.equal(execution.body.error.code, 'STALE_APPROVAL');
  const current = (await request('/api/workspace')).body;
  assert.equal(current.view.actions.find(item => item.id === action.id).status, 'stale');
  assert.equal(current.revision, 3);
  assert.equal((await request('/api/verify')).body.integrity.valid, true);
});
