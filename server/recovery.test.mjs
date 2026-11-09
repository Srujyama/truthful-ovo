import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import * as engine from '../src/assurance/index.mjs';
import {verifyCase} from '../src/recovery.mjs';
import {createWorkflowManager} from './workflows.mjs';
import {createRecoveryManager} from './recovery.mjs';

const promiseText=readFileSync(new URL('../public/examples/pipeline-promise.txt',import.meta.url),'utf8'),invoiceCsv=readFileSync(new URL('../public/examples/pipeline-invoices.csv',import.meta.url),'utf8');
const input={vendor:'Pipeline CRM',promiseText,invoiceCsv,replyText:'',asOf:'2026-10-28'};
const identities=Object.fromEntries(['viewer','analyst','approver','executor','admin'].map(role=>[role,{actor:{id:'recovery-'+role,role,name:'Managed '+role}}]));
let serial=0;const req=key=>({headers:{'idempotency-key':key||`recovery-request-${++serial}`}}),code=expected=>error=>error.code===expected;
function harness(t,{path=':memory:'}={}){
 const db=new DatabaseSync(path);db.exec('PRAGMA foreign_keys=ON;PRAGMA busy_timeout=5000;');t.after(()=>{if(db.isOpen)db.close();});
 const state=engine.createDemoWorkspace(),controls={at:'2026-11-08T12:00:00.000Z',active:null};
 const now=()=>controls.at,authorize=(_req,auth,callback)=>callback(controls.active||auth);
 const evidence=createWorkflowManager({db,now,engine,read:()=>({revision:0,state}),write:()=>assert.fail('A recovery draft must not execute a financial command.'),authorize});
 const recovery=createRecoveryManager({db,now,readEvidence:(auth,id,options)=>evidence.getEvidence(auth,id,options),authorize});
 const intake=patch=>evidence.intake(req(),identities.analyst,{...input,...patch}).response;
 return {db,state,controls,evidence,recovery,intake};
}

test('server-linked analysis becomes a durable draft, exact approver record, valid legacy packet and unsent EML',async t=>{
 const f=harness(t),e=f.intake(),original=structuredClone(f.state);
 const saved=await f.recovery.create(req(),identities.analyst,{evidenceId:e.evidenceId,analysisVersion:1,label:'Pipeline follow-up'});
 const first=saved.response;assert.equal(first.draftVersion,1);assert.equal(first.record.report.outstandingCents,150000);assert.equal(first.status,'draft');assert.equal(first.approvalCurrent,false);
 assert.deepEqual(first.record.report,e.analysis);assert.equal(await verifyCase(first.record),true);
 assert.throws(()=>f.recovery.email(identities.viewer,first.caseId),code('RECOVERY_APPROVAL_REQUIRED'));
 const edited=(await f.recovery.update(req(),identities.analyst,first.caseId,{expectedVersion:1,draft:'Please apply the remaining USD 1,500 under the original terms.'})).response;
 assert.equal(edited.draftVersion,2);assert.equal(edited.approval,null);
 const approved=(await f.recovery.approve(req(),identities.approver,first.caseId,{expectedVersion:2})).response;
 assert.equal(approved.draftVersion,3);assert.equal(approved.approvalCurrent,true);assert.equal(approved.approval.actor.id,identities.approver.actor.id);
 assert.equal(approved.record.audit.at(-1).payload.actor,identities.approver.actor.id);assert.equal(await verifyCase(approved.record),true);
 const eml=f.recovery.email(identities.viewer,first.caseId);assert.match(eml.content,/X-Unsent: 1/);assert.match(eml.content,/USD 1,500/);assert.equal(eml.contentType,'message/rfc822');assert.ok(eml.filename.endsWith('.eml'));
 const packet=f.recovery.packet(identities.viewer,first.caseId);assert.equal(packet.format,'truthful-evidence-packet-v1');assert.equal(await verifyCase(packet),true);assert.equal(packet.serverRecord.caseId,first.caseId);assert.match(packet.packetDigest,/^[a-f0-9]{64}$/);
 const csv=f.recovery.csv(identities.viewer,first.caseId);assert.match(csv.content,/outstanding_cents/);assert.match(csv.content,/,150000,/);
 assert.deepEqual(f.state,original,'Recovery approval creates no credit, action, renewal or vendor effect');assert.deepEqual(f.recovery.verifyIntegrity().valid,true);
});

test('editing an approved draft invalidates current approval while preserving immutable historical versions',async t=>{
 const f=harness(t),e=f.intake(),first=(await f.recovery.create(req(),identities.analyst,{evidenceId:e.evidenceId,analysisVersion:1})).response;
 const approved=(await f.recovery.approve(req(),identities.approver,first.caseId,{expectedVersion:1})).response;
 const edited=(await f.recovery.update(req(),identities.analyst,first.caseId,{expectedVersion:2,draft:'Revised follow-up; still no renewal acceptance.'})).response;
 assert.equal(edited.draftVersion,3);assert.equal(edited.approvalCurrent,false);assert.equal(edited.record.audit.length,1);
 const historical=f.recovery.get(identities.viewer,first.caseId,{version:2});assert.equal(historical.historical,true);assert.equal(historical.approval.actor.id,approved.approval.actor.id);assert.equal(historical.approvalCurrent,false);
 assert.throws(()=>f.recovery.email(identities.viewer,first.caseId,{version:2}),code('RECOVERY_APPROVAL_REQUIRED'));
 assert.throws(()=>f.recovery.email(identities.viewer,first.caseId),code('RECOVERY_APPROVAL_REQUIRED'));
 await assert.rejects(f.recovery.approve(req(),identities.approver,first.caseId,{expectedVersion:2}),code('RECOVERY_VERSION_CONFLICT'));
 await assert.rejects(f.recovery.update(req(),identities.analyst,first.caseId,{expectedVersion:1,draft:'Stale edit.'}),code('RECOVERY_VERSION_CONFLICT'));
 const final=(await f.recovery.approve(req(),identities.approver,first.caseId,{expectedVersion:3})).response;assert.equal(final.draftVersion,4);assert.match(f.recovery.email(identities.viewer,first.caseId).content,/Revised follow-up/);
 assert.equal(await verifyCase(f.recovery.packet(identities.viewer,first.caseId,{version:2})),true);
});

test('new evidence makes approval/download stale until an analyst explicitly rebinds the draft to the current server analysis',async t=>{
 const f=harness(t),e=f.intake(),first=(await f.recovery.create(req(),identities.analyst,{evidenceId:e.evidenceId,analysisVersion:1})).response;
 await f.recovery.approve(req(),identities.approver,first.caseId,{expectedVersion:1});
 const next=f.intake({evidenceId:e.evidenceId,expectedEvidenceVersion:1,invoiceCsv:invoiceCsv.replace('900.00','1200.00')});assert.equal(next.analysisVersion,2);
 assert.equal(f.recovery.get(identities.viewer,first.caseId).status,'evidence_stale');assert.equal(f.recovery.get(identities.viewer,first.caseId).approvalCurrent,false);
 assert.throws(()=>f.recovery.email(identities.viewer,first.caseId),code('RECOVERY_APPROVAL_REQUIRED'));
 await assert.rejects(f.recovery.update(req(),identities.analyst,first.caseId,{expectedVersion:2,draft:'An outdated draft.'}),code('EVIDENCE_VERSION_CHANGED'));
 const rebound=(await f.recovery.update(req(),identities.analyst,first.caseId,{expectedVersion:2,draft:'Please apply USD 1,200 outstanding.',evidenceId:e.evidenceId,analysisVersion:2})).response;
 assert.equal(rebound.record.report.outstandingCents,120000);assert.equal(rebound.approval,null);assert.equal(rebound.evidenceCurrent,true);
 await f.recovery.approve(req(),identities.approver,first.caseId,{expectedVersion:3});assert.match(f.recovery.email(identities.viewer,first.caseId).content,/USD 1,200/);
});

test('analyst/approver permissions come from fresh authorization, and actor fields in input cannot self-approve',async t=>{
 const f=harness(t),e=f.intake();
 await assert.rejects(f.recovery.create(req(),identities.viewer,{evidenceId:e.evidenceId,analysisVersion:1}),code('FORBIDDEN'));
 await assert.rejects(f.recovery.create(req(),identities.analyst,{evidenceId:e.evidenceId,analysisVersion:1,actor:{role:'admin'}}),code('RECOVERY_VALIDATION'));
 const first=(await f.recovery.create(req(),identities.analyst,{evidenceId:e.evidenceId,analysisVersion:1})).response;
 await assert.rejects(f.recovery.approve(req(),identities.analyst,first.caseId,{expectedVersion:1}),code('FORBIDDEN'));
 await assert.rejects(f.recovery.update(req(),identities.approver,first.caseId,{expectedVersion:1,draft:'Not an analyst.'}),code('FORBIDDEN'));
 const pending=f.recovery.update(req(),identities.analyst,first.caseId,{expectedVersion:1,draft:'Prepared while membership was active.'});f.controls.active=identities.viewer;
 await assert.rejects(pending,code('FORBIDDEN'));assert.equal(f.recovery.get(identities.viewer,first.caseId).draftVersion,1);
});

test('originally conditional, unsupported, future, empty and already fulfilled evidence cannot obtain a claim approval',async t=>{
 const f=harness(t);
 const patches=[{promiseText:'This is not a supported credit promise.'},{promiseText:promiseText.replace('does not require a renewal','requires a renewal')},{asOf:'2027-01-01'},{invoiceCsv:invoiceCsv.replace('900.00','2400.00')}];
 for(const patch of patches){
  const e=f.intake(patch),first=(await f.recovery.create(req(),identities.analyst,{evidenceId:e.evidenceId,analysisVersion:1})).response;
  await assert.rejects(f.recovery.approve(req(),identities.approver,first.caseId,{expectedVersion:1}),code('RECOVERY_NOT_APPROVABLE'));
  assert.equal(f.recovery.get(identities.viewer,first.caseId).draftVersion,1);
 }
 const e=f.intake(),first=(await f.recovery.create(req(),identities.analyst,{evidenceId:e.evidenceId,analysisVersion:1})).response;
 await f.recovery.update(req(),identities.analyst,first.caseId,{expectedVersion:1,draft:'  '});await assert.rejects(f.recovery.approve(req(),identities.approver,first.caseId,{expectedVersion:2}),code('RECOVERY_NOT_APPROVABLE'));
});

test('a later renewal condition permits only an exact original-terms follow-up and never accepts the proposed renewal',async t=>{
 const f=harness(t),e=f.intake({replyText:'We can apply the remaining USD 1,500 credit if you renew for 12 months.'});assert.ok(e.analysis.replyCondition);
 const first=(await f.recovery.create(req(),identities.analyst,{evidenceId:e.evidenceId,analysisVersion:1})).response;
 const approved=(await f.recovery.approve(req(),identities.approver,first.caseId,{expectedVersion:1})).response;
 assert.equal(approved.approvalCurrent,true);assert.match(approved.record.audit.at(-1).payload.scope,/no renewal accepted/);assert.match(f.recovery.email(identities.viewer,first.caseId).content,/X-Unsent: 1/);
});

test('create/edit/approval retries survive restart and competing editors cannot commit the same expected version twice',async t=>{
 const directory=mkdtempSync(join(tmpdir(),'truthful-recovery-'));t.after(()=>rmSync(directory,{recursive:true,force:true}));
 const path=join(directory,'workspace.sqlite'),f=harness(t,{path}),e=f.intake(),createReq=req('durable-create-request');
 const initial=await f.recovery.create(createReq,identities.analyst,{evidenceId:e.evidenceId,analysisVersion:1});
 const second=harness(t,{path});const replayed=await second.recovery.create(createReq,identities.analyst,{evidenceId:e.evidenceId,analysisVersion:1});assert.equal(replayed.replayed,true);assert.deepEqual(replayed.response,initial.response);
 await assert.rejects(second.recovery.create(createReq,identities.analyst,{evidenceId:e.evidenceId,analysisVersion:1,label:'Changed request'}),code('IDEMPOTENCY_CONFLICT'));
 const edits=await Promise.allSettled([f.recovery.update(req(),identities.analyst,initial.response.caseId,{expectedVersion:1,draft:'Editor A exact draft.'}),second.recovery.update(req(),identities.analyst,initial.response.caseId,{expectedVersion:1,draft:'Editor B exact draft.'})]);
 assert.equal(edits.filter(item=>item.status==='fulfilled').length,1);assert.equal(edits.find(item=>item.status==='rejected').reason.code,'RECOVERY_VERSION_CONFLICT');
 const approveReq=req('durable-approval-request'),approval=await f.recovery.approve(approveReq,identities.approver,initial.response.caseId,{expectedVersion:2});
 const retry=await second.recovery.approve(approveReq,identities.approver,initial.response.caseId,{expectedVersion:2});assert.equal(retry.replayed,true);assert.deepEqual(retry.response,approval.response);
 f.db.close();second.db.close();const reopened=harness(t,{path});assert.equal(reopened.recovery.get(identities.viewer,initial.response.caseId).approvalCurrent,true);assert.match(reopened.recovery.email(identities.viewer,initial.response.caseId).content,/Editor [AB]/);
});

test('bounded list pages bind filters and evidence freshness and never return full source documents',async t=>{
 const f=harness(t),e=f.intake();for(let i=0;i<4;i++)await f.recovery.create(req(),identities.analyst,{evidenceId:e.evidenceId,analysisVersion:1,label:'Case '+i});
 const first=f.recovery.list(identities.viewer,{limit:2}),second=f.recovery.list(identities.viewer,{limit:2,cursor:first.nextCursor});
 assert.equal(first.total,4);assert.equal(first.items.length,2);assert.equal(second.items.length,2);assert.equal(new Set([...first.items,...second.items].map(item=>item.caseId)).size,4);assert.ok(!JSON.stringify(first).includes('promiseText'));
 assert.throws(()=>f.recovery.list(identities.viewer,{limit:101}),code('RECOVERY_VALIDATION'));
 assert.throws(()=>f.recovery.list(identities.viewer,{limit:2,cursor:first.nextCursor,q:'changed'}),code('RECOVERY_CURSOR_STALE'));
 f.intake({evidenceId:e.evidenceId,expectedEvidenceVersion:1,promiseText:promiseText+'\nA later source copy.'});
 assert.throws(()=>f.recovery.list(identities.viewer,{limit:2,cursor:first.nextCursor}),code('RECOVERY_CURSOR_STALE'));
 assert.equal(f.recovery.list(identities.viewer,{status:'evidence_stale'}).total,4);
});

test('corrupted versions/retry responses fail closed and failed persistence cannot leave orphan cases or approvals',async t=>{
 const f=harness(t),e=f.intake();f.db.exec("CREATE TRIGGER recovery_write_failure BEFORE INSERT ON recovery_versions BEGIN SELECT RAISE(ABORT,'Injected recovery persistence failure'); END;");
 await assert.rejects(f.recovery.create(req(),identities.analyst,{evidenceId:e.evidenceId,analysisVersion:1}),/Injected recovery/);
 assert.equal(f.db.prepare('SELECT COUNT(*) AS count FROM recovery_cases').get().count,0);assert.equal(f.db.prepare('SELECT revision FROM recovery_meta').get().revision,0);
 f.db.exec('DROP TRIGGER recovery_write_failure');const request=req('tamper-create-request'),first=(await f.recovery.create(request,identities.analyst,{evidenceId:e.evidenceId,analysisVersion:1})).response;
 f.db.prepare("UPDATE recovery_requests SET response_json='{}' WHERE request_key=?").run(request.headers['idempotency-key']);await assert.rejects(f.recovery.create(request,identities.analyst,{evidenceId:e.evidenceId,analysisVersion:1}),code('RECOVERY_INTEGRITY'));
 assert.equal(f.recovery.verifyIntegrity().valid,false);
 f.db.prepare("UPDATE recovery_versions SET body_json='{}' WHERE case_id=?").run(first.caseId);assert.throws(()=>f.recovery.get(identities.viewer,first.caseId),code('RECOVERY_INTEGRITY'));
});
