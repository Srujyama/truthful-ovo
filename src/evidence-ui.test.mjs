import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { analyzeEvidence } from './engine/index.mjs';
import { evidenceActions, previewEvidencePortfolio } from './evidence-ui.mjs';
import { createWorkspace, createDemoWorkspace, reduceWorkspace } from './assurance/index.mjs';
const fixture = name => readFileSync(new URL(`../public/examples/${name}`, import.meta.url), 'utf8');
const analyze = (overrides = {}) => analyzeEvidence({ vendor: 'Pipeline CRM', asOf: '2026-10-28', promiseText: fixture('pipeline-promise.txt'), invoiceCsv: fixture('pipeline-invoices.csv'), ...overrides });
const actions = (report, overrides = {}) => evidenceActions(report, { draft: report.draft, today: '2026-10-29', ...overrides });

test('partial credit offers exact-draft approval and a distinct portfolio handoff', () => {
  const report = analyze();
  assert.equal(actions(report).approval.allowed, true);
  assert.equal(actions(report).portfolio.allowed, true);
  assert.equal(actions(report, { draft: '' }).approval.allowed, false);
  const approved = actions(report, { approved: true });
  assert.equal(approved.approval.allowed, false);
  assert.match(approved.approval.reason, /exact draft.*No email was sent/);
});
test('changed reply preserves original-terms approval and explains blocked portfolio import', () => {
  const report = analyze({ replyText: fixture('pipeline-reply.txt') });
  const result = actions(report);
  assert.equal(result.approval.allowed, true);
  assert.match(result.approval.reason, /original promise only/);
  assert.equal(result.portfolio.allowed, false);
  assert.ok(result.portfolio.reason.includes(report.replyCondition));
});
test('original conditions explain both unavailable actions using the real condition', () => {
  const report = analyzeEvidence({ vendor: 'Orbit Design', asOf: '2026-11-01', promiseText: fixture('orbit-promise.txt'), invoiceCsv: fixture('orbit-invoices.csv') });
  const result = actions(report);
  assert.equal(result.approval.allowed, false);
  assert.equal(result.portfolio.allowed, false);
  assert.ok(result.approval.reason.includes(report.condition));
  assert.match(result.approval.next, /fulfilled with supporting evidence/);
});
test('scheduled claims show exact engine schedule while allowing portfolio tracking', () => {
  const report = analyzeEvidence({ vendor: 'Parcel', asOf: '2026-10-28', promiseText: fixture('parcel-promise.txt'), invoiceCsv: fixture('parcel-invoices.csv') });
  const result = actions(report);
  assert.equal(result.approval.allowed, false);
  assert.equal(result.approval.reason, report.reasoning.find(step => step.label === 'Schedule').detail);
  assert.equal(result.portfolio.allowed, true);
});
test('fully applied promise has no claim but may be tracked in portfolio', () => {
  const report = analyze({ asOf: '2026-11-01', invoiceCsv: fixture('pipeline-invoices-complete.csv') });
  const result = actions(report, { today: '2026-11-01' });
  assert.equal(result.approval.allowed, false);
  assert.match(result.approval.reason, /No outstanding credit remains/);
  assert.equal(result.portfolio.allowed, true);
});
test('unsupported sources expose actual errors and do not permit approval or import', () => {
  const report = analyze({ promiseText: 'An unsupported promise.' });
  const result = actions(report);
  assert.equal(result.approval.allowed, false);
  assert.equal(result.portfolio.allowed, false);
  for (const error of report.errors) assert.ok(result.approval.reason.includes(error));
});
test('unrecognized reply exposes actual manual review warning for both disabled actions', () => {
  const report = analyze({ replyText: 'We need to discuss this next week.' });
  const result = actions(report);
  assert.equal(result.approval.allowed, false);
  assert.equal(result.portfolio.allowed, false);
  assert.ok(report.warnings.includes(result.approval.reason));
});
test('a future review date blocks portfolio import with a concrete correction', () => {
  const report = analyze({ asOf: '2026-11-02' });
  const result = actions(report);
  assert.equal(result.portfolio.allowed, false);
  assert.ok(result.portfolio.reason.includes(report.asOf));
  assert.match(result.portfolio.next, /current review date/);
});

const previewNow = '2026-10-29T12:00:00.000Z';
test('a new portfolio import preflights actual analyst commands without mutating the workspace', async () => {
  const workspace = createWorkspace();
  const before = JSON.stringify(workspace);
  for (const actorRole of ['viewer', 'approver', 'executor', 'analyst', 'admin']) {
    const result = await previewEvidencePortfolio(workspace, analyze(), { actorRole, now:previewNow });
    assert.ok(result.plan.commands.length > 0);
    assert.equal(result.allowed, ['analyst', 'admin'].includes(actorRole));
    if (result.allowed) {
      const applied = result.plan.commands.reduce((state, command) => reduceWorkspace(state, command, { actor:{ id:'preview-test', role:actorRole }, now:previewNow }).state, workspace);
      assert.ok(applied.events.length > 0);
    } else {
      assert.match(result.reason, /Requires analyst or admin role/);
      assert.ok(result.reason.includes(actorRole));
      assert.throws(() => reduceWorkspace(workspace, result.plan.commands[0], { actor:{ id:'preview-test', role:actorRole }, now:previewNow }));
    }
  }
  assert.equal(JSON.stringify(workspace), before);
});
test('all roles can navigate an already tracked real report without a write', async () => {
  const workspace = createDemoWorkspace();
  const before = JSON.stringify(workspace);
  for (const actorRole of ['viewer', 'approver', 'executor', 'analyst', 'admin']) {
    const result = await previewEvidencePortfolio(workspace, analyze(), { actorRole, now:previewNow });
    assert.equal(result.plan.commands.length, 0);
    assert.equal(result.plan.commitmentId, 'pipeline-seats');
    assert.equal(result.allowed, true);
    assert.match(result.reason, /does not change the shared portfolio/);
  }
  assert.equal(JSON.stringify(workspace), before);
});
test('connecting, busy, changed terms and ledger conflicts cannot offer a ready import', async () => {
  const connecting = await previewEvidencePortfolio(null, analyze(), { actorRole:'admin', now:previewNow });
  assert.equal(connecting.allowed, false);
  assert.equal(connecting.pending, true);
  assert.match(connecting.reason, /connecting/);
  const busy = await previewEvidencePortfolio(createWorkspace(), analyze(), { actorRole:'admin', busy:true, now:previewNow });
  assert.equal(busy.allowed, false);
  assert.match(busy.reason, /current portfolio operation/);
  assert.match(busy.next, /operation completes/);
  await assert.rejects(previewEvidencePortfolio(createDemoWorkspace(), analyze({ replyText:fixture('pipeline-reply.txt') }), { actorRole:'admin', now:previewNow }), /changed terms/);
  await assert.rejects(previewEvidencePortfolio(createDemoWorkspace(), analyze({ promiseText:fixture('pipeline-promise.txt').replace('2,400','3,000') }), { actorRole:'admin', now:previewNow }), /tracked terms differ/);
});
