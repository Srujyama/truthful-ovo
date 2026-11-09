import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as engine from '../src/assurance/index.mjs';
import { createWorkflowManager } from './workflows.mjs';

const hash = value => createHash('sha256').update(typeof value === 'string' ? value : engine.canonical(value)).digest('hex');
const identities = Object.fromEntries(['admin','analyst','approver','executor','viewer'].map(role => [role, {actor:{id:`workflow-${role}`,role}}]));
let sequence = 0;
const request = key => ({ headers:{'idempotency-key':key || `workflow-request-${++sequence}`} });
const url = new URL('http://127.0.0.1/api/workflows/commit');
const throwsCode = (callback, code) => assert.throws(callback, error => error.code === code);
const rejectsCode = (callback, code) => assert.rejects(callback, error => error.code === code);

function harness(t, { path=':memory:', initialWorkspace, authorize, clock='2026-11-08T12:00:00.000Z' } = {}) {
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS test_workspace(id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER NOT NULL,state_json TEXT NOT NULL) STRICT;
    CREATE TABLE IF NOT EXISTS audit(sequence INTEGER PRIMARY KEY,entry_json TEXT NOT NULL) STRICT;
    CREATE TABLE IF NOT EXISTS idempotency(actor_id TEXT NOT NULL,request_key TEXT NOT NULL,request_digest TEXT NOT NULL,response_json TEXT NOT NULL,PRIMARY KEY(actor_id,request_key)) STRICT;`);
  if(!db.prepare('SELECT id FROM test_workspace').get())db.prepare('INSERT INTO test_workspace VALUES(1,0,?)').run(JSON.stringify(initialWorkspace || engine.createDemoWorkspace()));
  const controls={clock,failAfterWrite:false,activeAuth:null};
  const now=()=>controls.clock;
  const read=()=>{const row=db.prepare('SELECT * FROM test_workspace WHERE id=1').get();return {revision:row.revision,state:JSON.parse(row.state_json)};};
  const write=(req,auth,data,command,_url,context={})=>{
    const active=controls.activeAuth || auth;
    const key=req.headers['idempotency-key'],digest=context.requestDigest || hash({data,command});
    db.exec('BEGIN IMMEDIATE');
    try {
      const prior=db.prepare('SELECT * FROM idempotency WHERE actor_id=? AND request_key=?').get(active.actor.id,key);
      if(prior){assert.equal(prior.request_digest,digest);db.exec('COMMIT');return {response:JSON.parse(prior.response_json),replayed:true};}
      const current=read();
      if(current.revision!==data.expectedRevision){const error=new Error('Workspace changed');error.code='REVISION_CONFLICT';error.status=409;throw error;}
      const at=now();
      command=context.prepare?context.prepare(current,at,active):command;
      let state=current.state,result;
      for(const item of command.type==='__BATCH__'?command.commands:[command]){
        const reduced=engine.reduceWorkspace(state,item,{actor:active.actor,now:at});state=reduced.state;result=reduced.result;
      }
      const revision=current.revision+1;
      const unsigned={sequence:revision,at,actor:active.actor,command,beforeRevision:current.revision,afterRevision:revision,result};
      const event={...unsigned,hash:hash(unsigned)};
      db.prepare('UPDATE test_workspace SET revision=?,state_json=? WHERE id=1').run(revision,JSON.stringify(state));
      db.prepare('INSERT INTO audit VALUES(?,?)').run(revision,JSON.stringify(event));
      const workflow=context.afterWrite?.({current,reduced:{state,result},event,at,revision});
      if(controls.failAfterWrite)throw new Error('Injected post-link write failure');
      const response={workspace:state,revision,domainRevision:state.revision,view:engine.evaluateWorkspace(state,{asOf:at.slice(0,10),knownAt:at}),audit:{sequence:revision,hash:event.hash},...(workflow?{workflow}:{})};
      db.prepare('INSERT INTO idempotency VALUES(?,?,?,?)').run(active.actor.id,key,digest,JSON.stringify(response));
      db.exec('COMMIT');return {response,replayed:false};
    }catch(error){db.exec('ROLLBACK');throw error;}
  };
  const manager=createWorkflowManager({db,now,engine,read,write,...(authorize?{authorize}:{})});
  let closed=false;const close=()=>{if(!closed){db.close();closed=true;}};t.after(close);
  return {db,manager,controls,read,write,close};
}
function documents(patch={}) {
  const replace=text=>text.replaceAll('Pipeline CRM','Northstar Research').replaceAll('PC-SEATS-2026','NR-WORKFLOW-2026');
  return { vendor:'Northstar Research',promiseText:replace(readFileSync(new URL('../public/examples/pipeline-promise.txt',import.meta.url),'utf8')),invoiceCsv:replace(readFileSync(new URL('../public/examples/pipeline-invoices.csv',import.meta.url),'utf8')),asOf:'2026-11-08',...patch };
}
const register = patch => ({operation:'register',commitmentId:'parcel-waiver',invoiceId:'WORKFLOW-MEMO',lineId:'LINE-1',status:'issued',amount:'300',allocationAmount:'100',effectiveDate:'2026-11-07',sourceTitle:'Supplied memo',sourceText:'Synthetic USD 300 issued memo for PL-SETUP-2026. Attribute USD100 to this case.',...patch});
async function preview(manager,type,input,expectedRevision=0,auth=identities.analyst,key) { return (await manager.preview(request(key),auth,{type,input,expectedRevision},url)).response; }
async function commit(manager,plan,auth=identities.analyst,key) { return manager.commit(request(key),auth,{previewId:plan.previewId,expectedRevision:plan.expectedRevision},url); }

test('evidence intake is durable, server-derived and source offsets reproduce exact original text', t=>{
  const {manager,read}=harness(t),before=read();
  const result=manager.intake(request(),identities.analyst,documents());
  assert.equal(result.response.analysis.promisedCents,240000);
  assert.equal(result.response.analysis.appliedCents,90000);
  assert.equal(result.response.analysis.outstandingCents,150000);
  assert.equal(result.response.analysisVersion,1);
  assert.equal(result.response.status,'analyzed');
  assert.deepEqual(read(),before,'intake does not write a financial fact');
  const saved=manager.getEvidence(identities.viewer,result.response.evidenceId);
  for(const citation of saved.analysis.citations){const field={promise:'promiseText',invoice:'invoiceCsv',reply:'replyText'}[citation.source];assert.equal(saved.input[field].slice(citation.start,citation.end),citation.quote);}
  assert.equal(saved.createdAt,'2026-11-08T12:00:00.000Z');
  assert.equal(saved.createdBy.role,'analyst');
  assert.equal(manager.verifyIntegrity().valid,true);
});

test('unsupported and conditional evidence stays reviewable without a portfolio effect', async t=>{
  const {manager,read}=harness(t),before=read();
  const unsupported=manager.intake(request(),identities.analyst,documents({promiseText:'Unclear vendor note without supported terms.'})).response;
  assert.equal(unsupported.status,'needs_review');
  assert.equal(unsupported.analysis.status,'unsupported');
  await rejectsCode(()=>preview(manager,'evidence-import',{evidenceId:unsupported.evidenceId,analysisVersion:1}), 'WORKFLOW_VALIDATION');
  const conditional=manager.intake(request(),identities.analyst,documents({replyText:'We can provide the credit if you renew for another 12 months.'})).response;
  assert.equal(conditional.status,'needs_review');
  await rejectsCode(()=>preview(manager,'evidence-import',{evidenceId:conditional.evidenceId,analysisVersion:1}), 'WORKFLOW_VALIDATION');
  assert.deepEqual(read(),before);
});

test('metadata idempotency persists exact results and rejects changed input or identity role', t=>{
  const {manager,db}=harness(t),req=request('same-intake-key');
  const first=manager.intake(req,identities.analyst,documents());
  const second=manager.intake(req,identities.analyst,documents());
  assert.equal(second.replayed,true);assert.deepEqual(second.response,first.response);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM workflow_evidence').get().count,1);
  throwsCode(()=>manager.intake(req,identities.analyst,documents({label:'Changed request'})),'IDEMPOTENCY_CONFLICT');
  throwsCode(()=>manager.intake(req,{actor:{id:identities.analyst.actor.id,role:'admin'}},documents()),'IDEMPOTENCY_CONFLICT');
  for(const role of ['viewer','approver','executor'])throwsCode(()=>manager.intake(request(),identities[role],documents()),'FORBIDDEN');
});

test('immutable analysis versions require exact evidence revision and invalidate an old import preview',async t=>{
  const {manager}=harness(t),first=manager.intake(request(),identities.analyst,documents()).response;
  const plan=await preview(manager,'evidence-import',{evidenceId:first.evidenceId,analysisVersion:1});
  const next=manager.intake(request(),identities.analyst,documents({evidenceId:first.evidenceId,expectedEvidenceVersion:1,label:'Reanalyzed source'})).response;
  assert.equal(next.analysisVersion,2);
  assert.equal(manager.getEvidence(identities.viewer,first.evidenceId,{analysisVersion:1}).analysisVersion,1);
  assert.equal(manager.getEvidence(identities.viewer,first.evidenceId).versions.length,2);
  throwsCode(()=>manager.intake(request(),identities.analyst,documents({evidenceId:first.evidenceId,expectedEvidenceVersion:1})),'EVIDENCE_REVISION_CHANGED');
  await rejectsCode(()=>commit(manager,plan),'EVIDENCE_REVISION_CHANGED');
});

test('evidence pagination is bounded, filtered and revision pinned',t=>{
  const {manager}=harness(t);
  for(let i=0;i<3;i++)manager.intake(request(),identities.analyst,documents({label:`Batch ${i}`}));
  const first=manager.listEvidence(identities.viewer,new URLSearchParams({limit:'2'}));
  assert.equal(first.items.length,2);assert.ok(first.nextCursor);
  const second=manager.listEvidence(identities.viewer,new URLSearchParams({limit:'2',cursor:first.nextCursor}));
  assert.equal(second.items.length,1);assert.equal(second.nextCursor,null);
  assert.equal(new Set([...first.items,...second.items].map(item=>item.evidenceId)).size,3);
  assert.ok(!Object.hasOwn(first.items[0],'analysis'),'list summaries do not return all source documents');
  assert.equal(manager.listEvidence(identities.viewer,{q:'Batch 1'}).items.length,1);
  assert.equal(manager.listEvidence(identities.viewer,{status:'needs_review'}).items.length,0);
  throwsCode(()=>manager.listEvidence(identities.viewer,{limit:'101'}),'WORKFLOW_VALIDATION');
  throwsCode(()=>manager.listEvidence(identities.viewer,{cursor:'invalid-json'}),'CURSOR_INVALID');
  throwsCode(()=>manager.listEvidence(identities.viewer,{limit:'2',cursor:first.nextCursor,q:'Batch'}),'CURSOR_STALE');
  manager.intake(request(),identities.analyst,documents());
  throwsCode(()=>manager.listEvidence(identities.viewer,{limit:'2',cursor:first.nextCursor}),'CURSOR_STALE');
});

test('evidence import preview is persisted without mutation and commit links exact analysis atomically',async t=>{
  const {manager,read}=harness(t),intake=manager.intake(request(),identities.analyst,documents()).response,before=read();
  const plan=await preview(manager,'evidence-import',{evidenceId:intake.evidenceId,analysisVersion:1});
  assert.equal(plan.status,'prepared');assert.equal(plan.expectedRevision,0);assert.equal(plan.domainRevision,before.state.revision);
  assert.ok(plan.plan.sourceBindings.every(source=>source.revision&&source.text));
  assert.deepEqual(read(),before);
  const result=await commit(manager,plan);
  assert.equal(result.response.workflow.status,'consumed');
  assert.equal(result.response.revision,1);
  assert.equal(result.response.view.commitments.find(c=>c.id===plan.plan.commitmentId).outstandingCents,150000);
  assert.equal(manager.getEvidence(identities.viewer,intake.evidenceId).promotions[0].commitmentId,plan.plan.commitmentId);
  assert.equal(manager.verifyIntegrity().valid,true);
});

test('credit lifecycle uses original exact preview IDs and changes financial state only at commit',async t=>{
  const {manager,read}=harness(t);
  const issuance=await preview(manager,'credit',register());
  assert.equal(issuance.plan.effects.verifiedDeltaCents,0);
  const first=await commit(manager,issuance),creditId=issuance.plan.creditId;
  assert.equal(first.response.view.credits.find(c=>c.id===creditId).status,'issued');
  assert.equal(first.response.view.totals.verifiedCents,90000);
  const application=await preview(manager,'credit',{operation:'apply',commitmentId:'parcel-waiver',creditId,effectiveDate:'2026-11-08',sourceText:'Separate invoice applies WORKFLOW-MEMO for PL-SETUP-2026.'},1);
  const applied=await commit(manager,application);
  assert.equal(applied.response.view.totals.verifiedCents,100000);
  const attribution=await preview(manager,'credit',{operation:'allocate',commitmentId:'parcel-waiver',creditId,amount:'200',effectiveDate:'2026-11-08',sourceText:'Attribute remaining USD200 from this line.'},2);
  const allocated=await commit(manager,attribution);
  const allocations=allocated.response.view.credits.find(c=>c.id===creditId).allocations;
  assert.equal(allocated.response.view.totals.verifiedCents,120000);
  const reversal=await preview(manager,'credit',{operation:'reverse',commitmentId:'parcel-waiver',creditId,amount:'150',effectiveDate:'2026-11-08',sourceText:'Reverse USD150 from the exact line.',allocationReversals:[{allocationId:allocations[0].id,amount:'50'},{allocationId:allocations[1].id,amount:'100'}]},3);
  const reversed=await commit(manager,reversal);
  assert.equal(reversed.response.view.commitments.find(c=>c.id==='parcel-waiver').outstandingCents,20000);
  assert.equal(reversed.response.view.credits.filter(c=>c.id===creditId).length,1);
  assert.equal(engine.validateWorkspace(read().state).valid,true);
  await rejectsCode(()=>preview(manager,'credit',register(),4),'CONFLICT');
  assert.equal(read().revision,4);
});

test('amendment preparation records no automatic acceptance and its action keeps current authority checks',async t=>{
  const {manager,write,read}=harness(t);
  const plan=await preview(manager,'amendment',{commitmentId:'parcel-waiver',changes:{promisedCents:true},promisedAmount:'400',effectiveDate:'2026-11-08',sourceText:'Synthetic proposal: amend promised credit from USD350 to USD400.'});
  assert.equal(plan.plan.after.commitments.find(c=>c.id==='parcel-waiver').promisedCents,35000);
  const result=await commit(manager,plan);
  assert.equal(result.response.view.actions.find(a=>a.id===plan.plan.actionId).status,'proposed');
  assert.equal(result.response.view.commitments.find(c=>c.id==='parcel-waiver').promisedCents,35000);
  write(request(),identities.approver,{expectedRevision:1},{type:'APPROVE_ACTION',actionId:plan.plan.actionId},url);
  const accepted=write(request(),identities.executor,{expectedRevision:2},{type:'EXECUTE_ACTION',actionId:plan.plan.actionId},url);
  assert.equal(accepted.response.view.commitments.find(c=>c.id==='parcel-waiver').promisedCents,40000);
  assert.equal(engine.validateWorkspace(read().state).valid,true);
});

test('resolution evidence and approval remain separate server-role workflows',async t=>{
  let state=engine.createDemoWorkspace();
  state=engine.reduceWorkspace(state,{type:'CREATE_COMMITMENT',commitment:{id:'parcel-second',vendorId:'parcel',reference:'PL-SETUP-2026',currency:'USD',promisedCents:35000,dueDate:'2026-11-01',conditions:[],sourceIds:['parcel-promise']}},{actor:identities.admin.actor,now:'2026-11-07T12:00:00Z'}).state;
  const {manager}=harness(t,{initialWorkspace:state});
  const issued=await preview(manager,'credit',register({allocationAmount:''}));
  await commit(manager,issued);
  const evidence=await preview(manager,'credit-resolution-evidence',{creditId:issued.plan.creditId,effectiveDate:'2026-11-08',sourceText:'Assign up to USD100 to original and USD200 to supplemental commitment.'},1);
  const clarification=await commit(manager,evidence);
  const sourceId=clarification.response.workflow.sourceId;
  const input={creditId:issued.plan.creditId,sourceId,effectiveDate:'2026-11-08',assignments:[{commitmentId:'parcel-waiver',amount:'100'},{commitmentId:'parcel-second',amount:'200'}]};
  await rejectsCode(()=>preview(manager,'credit-resolution',input,2),'FORBIDDEN');
  const resolution=await preview(manager,'credit-resolution',input,2,identities.approver);
  assert.equal(resolution.plan.sourceBindings[0].sourceId,sourceId);
  const result=await commit(manager,resolution,identities.approver);
  const credit=result.response.view.credits.find(c=>c.id===issued.plan.creditId);
  assert.equal(credit.quarantined,false);assert.equal(credit.allocatedCents,0);
  assert.deepEqual(credit.resolution.assignments,[{commitmentId:'parcel-waiver',limitCents:10000},{commitmentId:'parcel-second',limitCents:20000}]);
  assert.equal(result.response.view.totals.verifiedCents,90000);
});

test('stale, expired, discarded and foreign-role previews cannot create financial effects',async t=>{
  const {manager,controls,read}=harness(t);
  const stale=await preview(manager,'credit',register());
  const other=await preview(manager,'credit',register({invoiceId:'OTHER'}));
  await commit(manager,other);
  await rejectsCode(()=>commit(manager,stale),'REVISION_CONFLICT');
  const current=await preview(manager,'credit',register({invoiceId:'CURRENT'}),1);
  await rejectsCode(()=>commit(manager,current,identities.admin),'PREVIEW_ACTOR_MISMATCH');
  await rejectsCode(()=>commit(manager,current,{actor:{id:identities.analyst.actor.id,role:'admin'}}),'PREVIEW_ACTOR_MISMATCH');
  controls.clock='2026-11-08T12:11:00.000Z';
  await rejectsCode(()=>commit(manager,current),'PREVIEW_EXPIRED');
  const discarded=await preview(manager,'credit',register({invoiceId:'DISCARD'}),1);
  const discardedResult=manager.discard(request('discard-request-key'),identities.analyst,{previewId:discarded.previewId});
  assert.equal(discardedResult.response.status,'discarded');
  assert.equal(manager.discard(request('discard-request-key'),identities.analyst,{previewId:discarded.previewId}).replayed,true);
  await rejectsCode(()=>commit(manager,discarded),'PREVIEW_DISCARDED');
  assert.equal(read().revision,1);
});

test('server-clock date changes and active role changes at the locked boundary invalidate a preview',async t=>{
  const {manager,controls,read}=harness(t,{clock:'2026-11-08T23:59:00.000Z'});
  const plan=await preview(manager,'credit',register());
  controls.clock='2026-11-09T00:01:00.000Z';
  await rejectsCode(()=>commit(manager,plan),'PREVIEW_DATE_CHANGED');
  controls.clock='2026-11-08T23:59:30.000Z';
  controls.activeAuth={actor:{id:identities.analyst.actor.id,role:'admin'}};
  await rejectsCode(()=>commit(manager,plan),'PREVIEW_ACTOR_MISMATCH');
  assert.equal(read().revision,0);
});

test('async preview reauthorizes identity before persisting metadata',async t=>{
  let count=0;
  const auth={actor:{id:'same-user',role:'admin'}};
  const {manager,db}=harness(t,{authorize:(_req,_auth,callback)=>callback(++count===1?auth:{actor:{id:'same-user',role:'analyst'}})});
  await rejectsCode(()=>preview(manager,'credit',register(),0,auth),'PREVIEW_ACTOR_MISMATCH');
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM workflow_previews').get().count,0);
});

test('financial effect, consumption and promotion roll back together if a post-link write fails',async t=>{
  const {manager,controls,db,read}=harness(t),intake=manager.intake(request(),identities.analyst,documents()).response;
  const plan=await preview(manager,'evidence-import',{evidenceId:intake.evidenceId,analysisVersion:1}),before=read();
  controls.failAfterWrite=true;
  await assert.rejects(()=>commit(manager,plan),/post-link write failure/);
  assert.deepEqual(read(),before);
  assert.equal(db.prepare('SELECT status FROM workflow_previews WHERE id=?').get(plan.previewId).status,'prepared');
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM workflow_evidence_promotions').get().count,0);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM audit').get().count,0);
  controls.failAfterWrite=false;
  assert.equal((await commit(manager,plan)).response.workflow.status,'consumed');
});

test('identical commit retries survive restart, later writes and expiry; new use is rejected',async t=>{
  const directory=mkdtempSync(join(tmpdir(),'truthful-workflows-'));t.after(()=>rmSync(directory,{recursive:true,force:true}));
  const path=join(directory,'workspace.sqlite');
  let first=harness(t,{path});
  const intakeReq=request('restart-intake-key'),intake=first.manager.intake(intakeReq,identities.analyst,documents()).response;
  const plan=await preview(first.manager,'evidence-import',{evidenceId:intake.evidenceId,analysisVersion:1},0,identities.analyst,'restart-preview-key');
  const result=await commit(first.manager,plan,identities.analyst,'restart-commit-key');
  first.close();
  const second=harness(t,{path,clock:'2026-11-08T12:20:00.000Z'});
  assert.deepEqual(second.manager.intake(intakeReq,identities.analyst,documents()).response,intake);
  const extra=await preview(second.manager,'credit',register(),1);await commit(second.manager,extra);
  const replay=await commit(second.manager,plan,identities.analyst,'restart-commit-key');
  assert.equal(replay.replayed,true);assert.deepEqual(replay.response,result.response);
  await rejectsCode(()=>commit(second.manager,plan,identities.analyst,'restart-new-commit-key'),'REVISION_CONFLICT');
  assert.equal(second.manager.verifyIntegrity().valid,true);
});

test('already-tracked evidence links a durable case without duplicating domain money',async t=>{
  const {manager}=harness(t);
  const record=manager.intake(request(),identities.analyst,documents()).response;
  await commit(manager,await preview(manager,'evidence-import',{evidenceId:record.evidenceId,analysisVersion:1}));
  const again=manager.intake(request(),identities.analyst,documents()).response;
  const plan=await preview(manager,'evidence-import',{evidenceId:again.evidenceId,analysisVersion:1},1);
  assert.equal(plan.plan.alreadyTracked,true);assert.deepEqual(plan.plan.commandTypes,[]);
  const result=await commit(manager,plan);
  assert.equal(result.response.view.commitments.filter(c=>c.reference==='NR-WORKFLOW-2026').length,1);
  assert.equal(manager.getEvidence(identities.viewer,again.evidenceId).promotions.length,1);
  assert.equal(manager.verifyIntegrity().valid,true);
});

test('typed envelopes reject report/command injection, malformed inputs and unsupported body sizes',async t=>{
  const {manager,read}=harness(t),before=read();
  throwsCode(()=>manager.intake(request(),identities.analyst,{...documents(),analysis:{promisedCents:1}}),'WORKFLOW_VALIDATION');
  throwsCode(()=>manager.intake(request(),identities.analyst,documents({promiseText:'x'.repeat(250001)})),'WORKFLOW_VALIDATION');
  throwsCode(()=>manager.intake(request(),identities.analyst,documents({promiseText:'界'.repeat(125000),invoiceCsv:'界'.repeat(125000),replyText:'界'.repeat(125000)})),'BODY_TOO_LARGE');
  await rejectsCode(()=>manager.preview(request(),identities.analyst,{type:'credit',input:{...register(),commands:[]},expectedRevision:0},url),'WORKFLOW_VALIDATION');
  await rejectsCode(()=>manager.preview(request(),identities.analyst,{type:'credit',input:register(),expectedRevision:0,role:'admin'},url),'WORKFLOW_VALIDATION');
  await rejectsCode(()=>preview(manager,'credit-resolution',{operation:'evidence'},0,identities.approver),'WORKFLOW_VALIDATION');
  await rejectsCode(()=>preview(manager,'credit',{...register(),amount:'0.001'}),'WORKFLOW_VALIDATION');
  throwsCode(()=>manager.intake({headers:{}},identities.analyst,documents()),'IDEMPOTENCY_KEY_REQUIRED');
  assert.deepEqual(read(),before);
});

test('stored source, report, preview and cached response corruption is detected',async t=>{
  const a=harness(t),record=a.manager.intake(request(),identities.analyst,documents()).response;
  a.db.prepare('UPDATE workflow_evidence_versions SET analysis_json=? WHERE evidence_id=?').run(JSON.stringify({...record.analysis,promisedCents:1}),record.evidenceId);
  throwsCode(()=>a.manager.getEvidence(identities.viewer,record.evidenceId),'WORKFLOW_INTEGRITY');assert.equal(a.manager.verifyIntegrity().valid,false);
  const b=harness(t),source=b.manager.intake(request(),identities.analyst,documents()).response;
  b.db.prepare('UPDATE workflow_evidence_versions SET input_json=? WHERE evidence_id=?').run(JSON.stringify(documents({promiseText:'Different evidence'})),source.evidenceId);
  await rejectsCode(()=>preview(b.manager,'evidence-import',{evidenceId:source.evidenceId,analysisVersion:1}),'WORKFLOW_INTEGRITY');
  const c=harness(t),plan=await preview(c.manager,'credit',register());
  c.db.prepare('UPDATE workflow_previews SET commands_json=? WHERE id=?').run('[]',plan.previewId);
  await rejectsCode(()=>commit(c.manager,plan),'WORKFLOW_INTEGRITY');assert.equal(c.read().revision,0);
  const d=harness(t),req=request('tampered-cache-key');d.manager.intake(req,identities.analyst,documents());
  d.db.prepare('UPDATE workflow_requests SET response_json=?').run('{"evidenceId":"forged"}');
  throwsCode(()=>d.manager.intake(req,identities.analyst,documents()),'WORKFLOW_INTEGRITY');
});

test('prepared workflows can be recovered and paged without exposing mutable commands',async t=>{
  const {manager,controls}=harness(t);
  const plans=[];for(let i=0;i<3;i++)plans.push(await preview(manager,'credit',register({invoiceId:`RECOVER-${i}`})));
  const recovered=manager.getPreview(identities.analyst,plans[0].previewId);
  assert.equal(recovered.availableForCommit,true);assert.deepEqual(recovered.plan,plans[0].plan);
  assert.ok(!Object.hasOwn(recovered,'commands'));
  throwsCode(()=>manager.getPreview(identities.viewer,plans[0].previewId),'PREVIEW_ACTOR_MISMATCH');
  assert.equal(manager.getPreview(identities.admin,plans[0].previewId).availableForCommit,false);
  const first=manager.listPreviews(identities.analyst,{limit:'2',status:'prepared',type:'credit'});
  assert.equal(first.items.length,2);assert.ok(first.nextCursor);
  const second=manager.listPreviews(identities.analyst,{limit:'2',status:'prepared',type:'credit',cursor:first.nextCursor});
  assert.equal(second.items.length,1);assert.ok(first.items.every(item=>!Object.hasOwn(item,'commands')&&!Object.hasOwn(item,'plan')));
  throwsCode(()=>manager.listPreviews(identities.viewer,{actorId:identities.analyst.actor.id}),'FORBIDDEN');
  assert.equal(manager.listPreviews(identities.admin,{actorId:identities.analyst.actor.id}).items.length,3);
  controls.clock='2026-11-08T12:11:00.000Z';
  assert.equal(manager.getPreview(identities.analyst,plans[0].previewId).expired,true);
  assert.equal(manager.listPreviews(identities.analyst,{status:'expired'}).items.length,3);
  manager.discard(request(),identities.analyst,{previewId:plans[0].previewId});
  throwsCode(()=>manager.listPreviews(identities.analyst,{limit:'2',status:'prepared',type:'credit',cursor:first.nextCursor}),'CURSOR_STALE');
});

test('sealed preview actor and lifecycle metadata cannot be edited without detection',async t=>{
  const {manager,db}=harness(t);const plan=await preview(manager,'credit',register());
  db.prepare("UPDATE workflow_previews SET actor_role='admin' WHERE id=?").run(plan.previewId);
  throwsCode(()=>manager.getPreview(identities.admin,plan.previewId),'WORKFLOW_INTEGRITY');
  assert.equal(manager.verifyIntegrity().valid,false);
});

test('maintenance invalidates prepared reviews transactionally and preserves metadata integrity',async t=>{
  const {manager,db}=harness(t);const first=await preview(manager,'credit',register()),second=await preview(manager,'credit',register({invoiceId:'SECOND'}));
  db.exec('BEGIN IMMEDIATE');assert.equal(manager.invalidatePrepared(),2);db.exec('ROLLBACK');
  assert.equal(manager.getPreview(identities.analyst,first.previewId).status,'prepared');
  assert.equal(manager.invalidatePrepared(),2);assert.equal(manager.invalidatePrepared(),0);
  assert.equal(manager.getPreview(identities.analyst,second.previewId).status,'discarded');
  assert.equal(manager.verifyIntegrity().valid,true);
});
