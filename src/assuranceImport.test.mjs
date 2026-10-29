import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { analyzeEvidence } from './engine/index.mjs';
import { createWorkspace, createDemoWorkspace, reduceWorkspace, evaluateWorkspace } from './assurance/index.mjs';
import { prepareEvidenceImport } from './assuranceImport.mjs';

const [promiseText,invoiceCsv] = await Promise.all(['pipeline-promise.txt','pipeline-invoices.csv'].map(name => readFile(new URL('../public/examples/'+name,import.meta.url),'utf8')));
const input={vendor:'Pipeline CRM',promiseText,invoiceCsv,asOf:'2026-10-28'};
const now='2026-10-29T12:00:00.000Z';
const ctx={actor:{id:'import-reviewer',role:'admin'},now};
const apply=(state,commands)=>commands.reduce((s,c)=>reduceWorkspace(s,c,ctx).state,state);

test('real extracted documents become a conserved portfolio case with original source lineage',async()=>{
  const original=createWorkspace();
  const plan=await prepareEvidenceImport(original,analyzeEvidence(input),now);
  const next=apply(original,plan.commands);
  const view=evaluateWorkspace(next);
  assert.equal(view.commitments[0].promisedCents,240000);
  assert.equal(view.commitments[0].verifiedCents,90000);
  assert.equal(view.commitments[0].outstandingCents,150000);
  assert.ok(view.sources.some(s=>s.text===promiseText));
  assert.equal(original.events.length,0);
  const repeated=await prepareEvidenceImport(next,analyzeEvidence(input),now);
  assert.equal(repeated.commands.length,0);
  assert.equal(repeated.commitmentId,plan.commitmentId);
});

test('the included lab case joins the existing portfolio without duplicating its credit',async()=>{
  const plan=await prepareEvidenceImport(createDemoWorkspace(),analyzeEvidence(input),now);
  assert.equal(plan.commitmentId,'pipeline-seats');
  assert.equal(plan.commands.length,0);
});

test('unsupported, future, changed, conditional and conflicting evidence cannot silently rewrite the ledger',async()=>{
  const state=createDemoWorkspace();
  for(const patch of [
    {promiseText:promiseText.replace('We will credit','We might credit')},
    {asOf:'2027-01-01'},
    {promiseText:promiseText.replace('2,400','3,000')},
    {replyText:'We can credit you USD 1,500 if you renew for another year.'},
    {invoiceCsv:invoiceCsv.replace(',900.00,',',1000.00,')},
  ]) await assert.rejects(prepareEvidenceImport(state,analyzeEvidence({...input,...patch}),now));
});

test('changing a reference cannot invent a second line in the legacy one-credit-per-invoice adapter',async()=>{
  const first=await prepareEvidenceImport(createWorkspace(),analyzeEvidence(input),now);
  const state=apply(createWorkspace(),first.commands);
  const other=analyzeEvidence({...input,promiseText:promiseText.replaceAll('PC-SEATS-2026','PC-OTHER-2026'),invoiceCsv:invoiceCsv.replaceAll('PC-SEATS-2026','PC-OTHER-2026')});
  await assert.rejects(prepareEvidenceImport(state,other,now),/conflicts with an existing ledger credit/);
  assert.equal(evaluateWorkspace(state).totals.verifiedCents,90000);
});
