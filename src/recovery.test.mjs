import test from 'node:test';
import assert from 'node:assert/strict';
import { createCase, approveCase, verifyCase, saveCase, readCases, summaryCsv, emailFor, packetFor, STORAGE_KEY } from './recovery.mjs';

const report = { vendor: 'Acme', currency: 'USD', status: 'partial', requiresApproval: true, promisedCents: 240000, appliedCents: 90000, outstandingCents: 150000, condition: null, documents: { promiseText: 'a promise' } };
const at = '2026-10-28T12:00:00.000Z';

test('analysis is a snapshot; approval records exact draft and preserves the source record', async () => {
  const r = structuredClone(report);
  const record = await createCase(r, at);
  r.documents.promiseText = 'changed';
  assert.equal(record.report.documents.promiseText, 'a promise');
  const approved = await approveCase(record, 'Apply the original credit.', at);
  assert.equal(record.audit.length, 1);
  assert.equal(approved.audit.length, 2);
  assert.equal(approved.audit[1].payload.draft, 'Apply the original credit.');
  assert.equal(await verifyCase(approved), true);
  assert.equal(await approveCase(approved, 'different draft'), approved);
  assert.match(emailFor(approved), /X-Unsent: 1/);
  assert.throws(() => emailFor(record), /Approve/);
});

test('packet verification detects report, source, draft, event deletion and hash tampering', async () => {
  const original = await approveCase(await createCase(report, at), 'Claim text', at);
  for (const mutate of [
    p => p.report.appliedCents++, p => p.report.documents.promiseText = 'forged',
    p => p.audit[1].payload.draft = 'forged', p => p.audit.shift(),
    p => p.audit[0].hash = '0'.repeat(64), p => p.id = 'other-case', p => p.createdAt = '2026-01-01',
  ]) {
    const copy = structuredClone(original); mutate(copy);
    assert.equal(await verifyCase(copy), false);
  }
  assert.equal(await verifyCase(packetFor(original)), true);
  assert.equal(await verifyCase({}), false);
});

test('unsupported, conditional, fulfilled, empty and altered claims cannot be approved', async () => {
  for (const patch of [{status:'unsupported'}, {status:'scheduled'}, {requiresApproval:false}, {replyReviewRequired:true}, {condition:'12 month renewal'}, {outstandingCents:0}]) {
    await assert.rejects(approveCase(await createCase({...report,...patch}), 'Claim'), /cannot be approved/);
  }
  const record = await createCase(report);
  await assert.rejects(approveCase(record, '  '), /Write a claim/);
  record.report.promisedCents++;
  await assert.rejects(approveCase(record, 'Claim'), /evidence changed/);
});

test('storage upserts, preserves cases across reads and reports quota/corruption', async () => {
  const map = new Map();
  const storage = { getItem: k => map.get(k), setItem: (k,v) => map.set(k,v) };
  const r = await createCase(report);
  const cases = saveCase(storage, [], r);
  assert.deepEqual(readCases(storage), cases);
  assert.equal(saveCase(storage, cases, await approveCase(r,'Claim')).length, 1);
  map.set(STORAGE_KEY, '{');
  assert.throws(() => readCases(storage));
  map.set(STORAGE_KEY, '[{}]');
  assert.throws(() => readCases(storage));
  assert.throws(() => saveCase({setItem(){throw new Error('quota')}}, [], r), /quota/);
});

test('CSV round-trip escaping and spreadsheet formula protection preserve cents', async () => {
  const r = await createCase({...report,vendor:'=WEBSERVICE("evil")'});
  const csv = summaryCsv(r);
  assert.match(csv, /"1500.00"/);
  assert.match(csv, /"'=WEBSERVICE\(""evil""\)"/);
  const unsupported = summaryCsv(await createCase({...report,status:'unsupported',promisedCents:null,outstandingCents:null}));
  assert.doesNotMatch(unsupported,/0\.00/);
});
