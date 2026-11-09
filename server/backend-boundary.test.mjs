import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {existsSync,writeFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createManagedService} from './managed.mjs';
import {backupManaged,restoreManaged} from './maintenance.mjs';
import {generateAgentKey,signAgentRequest,grantDigest,REQUEST_PROFILE,verifyAuthorityPacket} from '../src/authority/index.mjs';

const now='2026-11-08T12:00:00.000Z';
const owner={email:'boundary-owner@example.test',password:'Boundary owner password!',name:'Boundary Owner',workspaceName:'Finance Alpha'};
async function harness(t,{sameOrigin=false}={}) {
 const directory=await mkdtemp(join(tmpdir(),'truthful-backend-boundary-')),dataDir=join(directory,'data');
 const configuredOrigin='http://127.0.0.1:8181';
 const service=await createManagedService({dataDir,clock:()=>now,allowedOrigins:sameOrigin?[]:[configuredOrigin]});
 let closed=false;
 t.after(async()=>{if(!closed)await service.close();await rm(directory,{recursive:true,force:true});});
 const initial=await service.bootstrap(owner),{baseUrl}=await service.listen({port:0}),origin=sameOrigin?baseUrl:configuredOrigin;
 let cookie='',csrf='';
 const call=async(path,input,{key=crypto.randomUUID(),method=input?'POST':'GET'}={})=>{
  const response=await fetch(baseUrl+path,{method,headers:{Origin:origin,...(cookie?{Cookie:cookie}:{}),...(input?{'Content-Type':'application/json','X-CSRF-Token':csrf,'Idempotency-Key':key}:{})},...(input?{body:JSON.stringify(input)}:{})});
  const text=await response.text(),body=text?JSON.parse(text):null;
  if(response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];
  if(body?.csrfToken)csrf=body.csrfToken;
  return {status:response.status,body,replayed:response.headers.get('Idempotent-Replayed')};
 };
 const login=await call('/api/auth/login',{email:owner.email,password:owner.password});assert.equal(login.status,200,JSON.stringify(login.body));
 const seed=async()=>{
  const commands=[
   {type:'ADD_VENDOR',vendor:{id:'northstar',name:'Northstar Research'}},
   {type:'ADD_SOURCE',source:{id:'northstar-promise',vendorId:'northstar',title:'Synthetic original promise',kind:'email',text:'SYNTHETIC: USD 350 unconditional correction for NR-CREDIT-2026, due November 1, 2026.'}},
   {type:'CREATE_COMMITMENT',commitment:{id:'northstar-case',vendorId:'northstar',reference:'NR-CREDIT-2026',currency:'USD',promisedCents:35000,dueDate:'2026-11-01',conditions:[],sourceIds:['northstar-promise']}},
   {type:'PROPOSE_ACTION',action:{id:'northstar-action',commitmentId:'northstar-case',type:'prepare_claim',payload:{}}},
   {type:'APPROVE_ACTION',actionId:'northstar-action'},
  ];
  return call('/api/batch',{expectedRevision:0,commands});
 };
 return {service,directory,dataDir,initial,baseUrl,origin,call,seed,async close(){if(!closed){await service.close();closed=true;}}};
}
async function issued(h) {
 const info=(await h.call('/api/authority')).body,agent=await generateAgentKey();
 const result=await h.call('/api/authority/grants',{actionId:'northstar-action',agentPublicKey:agent.publicKey,maxAmountCents:35000,maxObligationCents:0,notBefore:now,expiresAt:'2026-11-08T13:00:00.000Z',expectedRevision:1});
 assert.equal(result.status,200,JSON.stringify(result.body));
 const grant=result.body.grant,request=await signAgentRequest({profile:REQUEST_PROFILE,workspaceId:info.workspaceId,audience:info.audience,grantDigest:await grantDigest(grant),actionId:'northstar-action',commitmentId:'northstar-case',expectedRevision:1,commandId:crypto.randomUUID(),nonce:crypto.randomUUID(),issuedAt:now},agent.privateKey);
 return {info,agent,grant,request};
}

test('managed bootstrap before listen accepts financial writes from its actual same-origin address',async t=>{
 const h=await harness(t,{sameOrigin:true}),written=await h.seed();
 assert.equal(written.status,200,JSON.stringify(written.body));
 assert.equal(written.body.view.commitments[0].reference,'NR-CREDIT-2026');
});

test('managed signed execution retains the possession-derived agent while enforcing workspace membership',async t=>{
 const h=await harness(t),seeded=await h.seed();assert.equal(seeded.status,200,JSON.stringify(seeded.body));
 const {info,agent,grant,request}=await issued(h),key='managed-agent-once';
 const used=await h.call('/api/authority/execute',{grants:[grant],request},{key});
 assert.equal(used.status,200,JSON.stringify(used.body));
 assert.equal(used.body.authority.receipt.payload.actor.id,`agent:${agent.publicKey.x}`);
 assert.equal(used.body.authority.receipt.payload.actor.role,'executor');
 assert.equal(used.body.workspace.events.at(-1).actor.id,`agent:${agent.publicKey.x}`);
 assert.equal(used.body.view.commitments[0].verifiedCents,0,'local claim execution creates no applied credit');
 const retry=await h.call('/api/authority/execute',{grants:[grant],request},{key});assert.equal(retry.replayed,'true');assert.deepEqual(retry.body,used.body);
 const packet=(await h.call('/api/authority/export')).body;
 assert.equal((await verifyAuthorityPacket(packet,{trustedIssuers:[{issuer:info.issuer,keyId:info.keyId,publicKey:info.publicKey}]})).valid,true);
 const activity=await h.call('/api/query/activity?actor='+encodeURIComponent(`agent:${agent.publicKey.x}`));
 assert.equal(activity.status,200);assert.ok(activity.body.items.some(event=>event.type==='ACTION_EXECUTED'));
 const report=await h.call('/api/reports/financial');
 assert.equal(report.status,200,JSON.stringify(report.body));assert.equal(report.body.view.totals.verifiedCents,0);
});

test('managed cursors, exact revisions and financial records remain isolated across workspace switches',async t=>{
 const h=await harness(t),seeded=await h.seed();assert.equal(seeded.status,200,JSON.stringify(seeded.body));
 const first=await h.call('/api/query/activity?limit=1');assert.equal(first.status,200);assert.ok(first.body.nextCursor);
 const source=await h.call('/api/sources/northstar-promise/revisions/2');assert.equal(source.status,200,JSON.stringify(source.body));assert.match(source.body.source.text,/USD 350/);
 const beta=await h.call('/api/workspaces',{name:'Finance Beta'});assert.equal(beta.status,201);
 assert.equal((await h.call('/api/workspaces/switch',{workspaceId:beta.body.workspace.id})).status,200);
 const empty=await h.call('/api/query/commitments');assert.equal(empty.status,200);assert.equal(empty.body.total,0);
 const oldCursor=await h.call('/api/query/activity?limit=1&cursor='+encodeURIComponent(first.body.nextCursor));assert.equal(oldCursor.status,400);
 const noSource=await h.call('/api/sources/northstar-promise/revisions/2');assert.equal(noSource.status,404);
 assert.equal((await h.call('/api/workspaces/switch',{workspaceId:h.initial.workspace.id})).status,200);
 assert.equal((await h.call('/api/query/commitments')).body.total,1);
});

test('backup restore discards pending workflow previews without invalidating their metadata integrity',async t=>{
 const h=await harness(t),seeded=await h.seed();assert.equal(seeded.status,200,JSON.stringify(seeded.body));
 const {grant}=await issued(h);
 const preview=await h.call('/api/workflows/preview',{type:'credit',expectedRevision:1,input:{operation:'register',commitmentId:'northstar-case',invoiceId:'NR-MEMO-300',lineId:'NR-LINE-1',status:'issued',amount:'300',allocationAmount:'100',effectiveDate:'2026-11-08',sourceTitle:'Synthetic memo',sourceText:'SYNTHETIC: issue USD 300 for NR-CREDIT-2026; this is not invoice application.'}});
 assert.equal(preview.status,200,JSON.stringify(preview.body));assert.ok(preview.body.previewId);
 await h.close();
 const snapshot=join(h.directory,'snapshot'),restored=join(h.directory,'restored');
 await backupManaged({dataDir:h.dataDir,destination:snapshot});
 const result=await restoreManaged({snapshot,destination:restored});assert.equal(result.restored,true);
 const reopened=await createManagedService({dataDir:restored,clock:()=>now,allowedOrigins:[h.origin]});
 try {
  const child=await reopened.child(h.initial.workspace);
  assert.equal(child.operations.readiness({force:true}).workflows.valid,true);
  const row=child.operations.db.prepare('SELECT status FROM workflow_previews WHERE id=?').get(preview.body.previewId);assert.equal(row.status,'discarded');
  assert.ok(child.operations.authority.status(grant.payload.grantId).revokedAt);
  assert.equal(child.operations.read().state.events.some(event=>event.type==='CREDIT_REGISTERED'),false,'restoring a pending preview cannot invent a committed credit');
 } finally {await reopened.close();}
});

test('a rolled-back financial response cannot remain cached as a phantom healthy audit revision',async t=>{
 const h=await harness(t),seeded=await h.seed();assert.equal(seeded.status,200,JSON.stringify(seeded.body));
 const child=await h.service.child(h.initial.workspace),db=child.operations.db;
 db.exec("CREATE TRIGGER fail_boundary_cache BEFORE INSERT ON idempotency BEGIN SELECT RAISE(ABORT,'injected response rollback'); END;");
 const failed=await h.call('/api/commands',{expectedRevision:1,command:{type:'REVISE_SOURCE',sourceId:'northstar-promise',text:'Synthetic changed evidence that must roll back.'}});
 assert.equal(failed.status,500);
 db.exec('DROP TRIGGER fail_boundary_cache');
 const after=await h.call('/api/workspace');assert.equal(after.status,200);assert.equal(after.body.revision,1);
 assert.equal(after.body.integrity.revision,1,'read integrity must describe the surviving committed revision');
 const health=await h.call('/api/health');assert.equal(health.status,200);
 assert.equal(health.body.integrity.revision,1);
});

test('a missing registered financial database is reported instead of silently recreating an empty ledger',async t=>{
 const h=await harness(t),seeded=await h.seed();assert.equal(seeded.status,200,JSON.stringify(seeded.body));
 await h.close();
 await rm(join(h.dataDir,`workspace-${h.initial.workspace.id}.sqlite`));
 await assert.rejects(async()=>{
  const unexpectedlyCreated=await createManagedService({dataDir:h.dataDir,clock:()=>now,allowedOrigins:[h.origin]});
  await unexpectedlyCreated.close();
 },error=>error.code==='WORKSPACE_STORAGE_MISSING'||/missing.*workspace|workspace.*missing/i.test(error.message));
});

test('gateway provisioning rollback removes its new child storage while preserving registry and existing ledgers',async t=>{
 const h=await harness(t),seeded=await h.seed();assert.equal(seeded.status,200);
 const registry=new DatabaseSync(join(h.dataDir,'identity.sqlite'),{readOnly:true});t.after(()=>registry.close());
 const counts=()=>Object.fromEntries(['users','workspaces','memberships','security_audit'].map(table=>[table,registry.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n]));
 const before=counts(),alpha=await h.service.child(h.initial.workspace),beforeLedger=alpha.operations.read().state;
 const actual=h.service.identity.createWorkspace;let created;
 h.service.identity.createWorkspace=(session,input,options)=>actual(session,input,{...options,provision:workspace=>{
  options.provision(workspace);created=workspace;
  assert.equal(existsSync(join(h.dataDir,`workspace-${workspace.id}.sqlite`)),true,'the actual gateway creates the child before failure is injected');
  throw new Error('Injected failure after synchronous child provisioning.');
 }});
 let failed;
 try{failed=await h.call('/api/workspaces',{name:'Must roll back'});}finally{h.service.identity.createWorkspace=actual;}
 assert.equal(failed.status,500);assert.ok(created);
 assert.deepEqual(counts(),before,'registry, membership and identity audit roll back together');
 for(const suffix of ['', '-wal','-shm'])assert.equal(existsSync(join(h.dataDir,`workspace-${created.id}.sqlite${suffix}`)),false,'new child storage is removed: '+suffix);
 assert.deepEqual(alpha.operations.read().state,beforeLedger,'the previously committed ledger is retained');
 const retried=await h.call('/api/workspaces',{name:'Can retry'});assert.equal(retried.status,201,JSON.stringify(retried.body));
 assert.equal(existsSync(join(h.dataDir,`workspace-${retried.body.workspace.id}.sqlite`)),true);
 assert.equal((await h.call('/api/ready')).status,200);
});

test('gateway refuses a preexisting child-file collision without deleting storage it did not create',async t=>{
 const h=await harness(t),actual=h.service.identity.createWorkspace;let collision;
 const sentinel='Preexisting storage belongs to another owner; never delete it during failed provisioning.';
 h.service.identity.createWorkspace=(session,input,options)=>actual(session,input,{...options,provision:workspace=>{
  collision=join(h.dataDir,`workspace-${workspace.id}.sqlite`);writeFileSync(collision,sentinel,{flag:'wx'});
  options.provision(workspace);
 }});
 let failed;
 try{failed=await h.call('/api/workspaces',{name:'Storage collision'});}finally{h.service.identity.createWorkspace=actual;}
 assert.equal(failed.status,500);assert.ok(collision);
 assert.equal(existsSync(collision),true,'cleanup must not delete a preexisting file refused by loadChild');
 assert.equal(await readFile(collision,'utf8'),sentinel);
 const records=await h.call('/api/workspaces');assert.equal(records.status,200);assert.equal(records.body.workspaces.length,1);
});
