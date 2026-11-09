import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {verifyPacketInput,packetLimits} from './packets.mjs';
import {analyzeEvidence} from '../src/engine/index.mjs';
import {createCase,approveCase,packetFor} from '../src/recovery.mjs';
import {createDemoWorkspace,evaluateWorkspace,validateWorkspace} from '../src/assurance/index.mjs';
import {createMemoryAuthority,generateAgentKey,signAgentRequest,grantDigest,REQUEST_PROFILE} from '../src/authority/index.mjs';
import {createAuthorityDemoWorkspace,AUTHORITY_DEMO_TIME,AUTHORITY_DEMO_ACTOR} from '../src/authority/fixtures.mjs';
import {explorePlan} from '../src/explorer/index.mjs';
import {createService} from './service.mjs';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {canonical as recoveryCanonical} from '../src/recovery.mjs';
import * as financialEngine from '../src/assurance/index.mjs';
import {createWorkflowManager} from './workflows.mjs';
import {createRecoveryManager} from './recovery.mjs';

const at='2026-11-08T12:00:00.000Z';
async function recoveryFixture() {
 const [promiseText,invoiceCsv]=await Promise.all(['pipeline-promise.txt','pipeline-invoices.csv'].map(name=>readFile(new URL('../public/examples/'+name,import.meta.url),'utf8')));
 const report=analyzeEvidence({vendor:'Pipeline CRM',promiseText,invoiceCsv,asOf:'2026-10-28'});
 return packetFor(await approveCase(await createCase(report,at),report.draft,at));
}
function assuranceFixture() {
 const workspace=createDemoWorkspace(),options={asOf:'2026-11-08',knownAt:at};
 return {format:'truthful-assurance-packet-v1',exportedAt:at,mode:'browser',actor:{id:'packet-reviewer',role:'viewer'},workspace,view:evaluateWorkspace(workspace,options),invariantCheck:validateWorkspace(workspace,options),notice:'Synthetic browser packet.'};
}
async function authorityFixture() {
 const runtime=await createMemoryAuthority({workspace:createAuthorityDemoWorkspace(),clock:()=>AUTHORITY_DEMO_TIME}),info=runtime.info(),agent=await generateAgentKey();
 const {grant}=await runtime.issueGrant({actionId:'demo-action',agentPublicKey:agent.publicKey,maxAmountCents:13000,maxObligationCents:3000,notBefore:AUTHORITY_DEMO_TIME,expiresAt:'2026-11-01T13:00:00.000Z',expectedRevision:0},{actor:AUTHORITY_DEMO_ACTOR});
 const request=await signAgentRequest({profile:REQUEST_PROFILE,workspaceId:info.workspaceId,audience:info.audience,grantDigest:await grantDigest(grant),actionId:'demo-action',commitmentId:'demo-commitment',expectedRevision:0,commandId:crypto.randomUUID(),nonce:crypto.randomUUID(),issuedAt:AUTHORITY_DEMO_TIME},agent.privateKey);
 await runtime.execute({grants:[grant],request,idempotencyKey:'packet-verifier-use'});
 return {packet:await runtime.exportPacket(),trustedIssuers:[{issuer:info.issuer,keyId:info.keyId,publicKey:info.publicKey}]};
}
const wrapperHash=value=>createHash('sha256').update(typeof value==='string'?value:recoveryCanonical(value)).digest('hex');
function resignWrapper(packet,{version=false}={}) {
 if(version) {
  const m=packet.serverRecord,record=Object.fromEntries(['schemaVersion','id','createdAt','report','audit'].map(key=>[key,packet[key]]));
  const fields=['caseId','draftVersion','createdAt','createdBy','evidenceId','analysisVersion','label','draft','draftDigest','recordDigest','approval','previousVersionDigest'];
  m.versionDigest=wrapperHash({...Object.fromEntries(fields.map(key=>[key,m[key]])),record});
 }
 packet.serverRecordDigest=wrapperHash(packet.serverRecord);
 const {packetDigest,...body}=packet;packet.packetDigest=wrapperHash(body);
 return packet;
}
async function serverRecoveryFixture(t) {
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());
 const state=createDemoWorkspace(),now=()=>at,analyst={actor:{id:'server-analyst',role:'analyst',name:'Finance Analyst'}},approver={actor:{id:'server-approver',role:'approver',name:'Finance Approver'}},viewer={actor:{id:'server-viewer',role:'viewer'}};
 let sequence=0;const req=()=>({headers:{'idempotency-key':'server-recovery-packet-'+(++sequence)}});
 const evidence=createWorkflowManager({db,now,engine:financialEngine,read:()=>({revision:0,state}),write:()=>assert.fail('Portable recovery approval must not write the financial ledger.')});
 const recovery=createRecoveryManager({db,now,readEvidence:(auth,id,options)=>evidence.getEvidence(auth,id,options)});
 const [promiseText,invoiceCsv]=await Promise.all(['pipeline-promise.txt','pipeline-invoices.csv'].map(name=>readFile(new URL('../public/examples/'+name,import.meta.url),'utf8')));
 const input={vendor:'Pipeline CRM',promiseText,invoiceCsv,replyText:'',asOf:'2026-10-28'};
 const analysis=evidence.intake(req(),analyst,input).response;
 const created=(await recovery.create(req(),analyst,{evidenceId:analysis.evidenceId,analysisVersion:1})).response;
 const edited=(await recovery.update(req(),analyst,created.caseId,{expectedVersion:1,draft:'Please apply the exact remaining USD 1,500. No renewal is accepted.'})).response;
 const draftPacket=recovery.packet(viewer,created.caseId);
 await recovery.approve(req(),approver,created.caseId,{expectedVersion:edited.draftVersion});
 const approvedPacket=recovery.packet(viewer,created.caseId),historicalPacket=recovery.packet(viewer,created.caseId,{version:2});
 evidence.intake(req(),analyst,{...input,evidenceId:analysis.evidenceId,expectedEvidenceVersion:1,invoiceCsv:invoiceCsv.replace('900.00','1200.00')});
 const stalePacket=recovery.packet(viewer,created.caseId);
 return {draftPacket,approvedPacket,historicalPacket,stalePacket,state};
}

test('actual recovery evidence and exact approved draft verify without treating local hashes as source authenticity',async()=>{
 const packet=await recoveryFixture(),before=JSON.stringify(packet),result=await verifyPacketInput({packet});
 assert.equal(result.valid,true,JSON.stringify(result));assert.deepEqual(result.errors,[]);assert.equal(result.summary.claimApproved,true);assert.match(result.scope,/does not authenticate/);
 assert.equal(JSON.stringify(packet),before,'verification does not mutate the supplied record');
 for(const mutate of [copy=>copy.report.outstandingCents++,copy=>copy.audit[1].payload.draft='Substituted draft',copy=>copy.audit.shift()]) {
  const copy=structuredClone(packet);mutate(copy);const invalid=await verifyPacketInput({packet:copy});assert.equal(invalid.valid,false);assert.ok(invalid.errors.length);
 }
});

test('actual server recovery packet binds edited drafts, exact approvals, version digests and freshness metadata',async t=>{
 const f=await serverRecoveryFixture(t);
 for(const packet of [f.draftPacket,f.approvedPacket,f.historicalPacket,f.stalePacket]) {
  const before=JSON.stringify(packet),result=await verifyPacketInput({packet});
  assert.equal(result.valid,true,JSON.stringify(result));assert.equal(JSON.stringify(packet),before);
  assert.equal(result.summary.serverCaseId,packet.serverRecord.caseId);
 }
 assert.equal((await verifyPacketInput({packet:f.approvedPacket})).summary.approvalCurrent,true);
 assert.equal((await verifyPacketInput({packet:f.historicalPacket})).summary.historical,true);
 assert.equal((await verifyPacketInput({packet:f.stalePacket})).summary.approvalCurrent,false);
 const {serverRecord,serverRecordDigest,packetDigest,...legacy}=f.approvedPacket;
 assert.equal((await verifyPacketInput({packet:legacy})).valid,true,'unwrapped legacy recovery exports remain supported');
});

test('server recovery wrapper rejects changed metadata, digests and partial wrappers',async t=>{
 const {approvedPacket}=await serverRecoveryFixture(t);
 for(const mutate of [copy=>copy.serverRecord.label='Changed server label',copy=>copy.serverRecord.approval.actor.id='Unbound approver',copy=>copy.serverRecordDigest='0'.repeat(64),copy=>copy.packetDigest='0'.repeat(64),copy=>delete copy.serverRecord,copy=>delete copy.serverRecordDigest,copy=>delete copy.packetDigest]) {
  const copy=structuredClone(approvedPacket);mutate(copy);const result=await verifyPacketInput({packet:copy});assert.equal(result.valid,false);assert.equal(result.code,'RECOVERY_PACKET_INVALID');
 }
});

test('recomputed outer recovery hashes cannot hide draft, evidence, report or approval-binding mismatches',async t=>{
 const {approvedPacket}=await serverRecoveryFixture(t);
 const mutations=[
  copy=>{copy.serverRecord.draft='Different draft with recomputed metadata hashes.';copy.serverRecord.draftDigest=wrapperHash(copy.serverRecord.draft);},
  copy=>{copy.serverRecord.approval.evidenceId='different-evidence';},
  copy=>{copy.serverRecord.approval.analysisVersion++;},
  copy=>{copy.serverRecord.recordDigest='0'.repeat(64);},
  copy=>{copy.serverRecord.historical=true;},
  copy=>{copy.serverRecord.versionDigest='0'.repeat(64);},
 ];
 for(const [index,mutate] of mutations.entries()) {
  const copy=structuredClone(approvedPacket);mutate(copy);resignWrapper(copy,{version:index!==5});
  const result=await verifyPacketInput({packet:copy});assert.equal(result.valid,false,'mismatched recovery binding '+index);assert.equal(result.code,'RECOVERY_PACKET_INVALID');
 }
});

test('browser assurance replays original financial commands and rejects changed projections or invariants',async()=>{
 const packet=assuranceFixture(),result=await verifyPacketInput({packet});
 assert.equal(result.valid,true,JSON.stringify(result));assert.equal(result.summary.events,28);assert.equal(result.summary.mode,'browser');
 for(const mutate of [copy=>copy.view.commitments[0].verifiedCents++,copy=>copy.invariantCheck.valid=false,copy=>copy.workspace.events[0].payload.vendor.name='Changed vendor']) {
  const copy=structuredClone(packet);mutate(copy);assert.equal((await verifyPacketInput({packet:copy})).valid,false);
 }
});

test('actual server export and server-wrapped assurance verify with their audit and domain replay intact',async t=>{
 const service=await createService({clock:()=>at}),{baseUrl}=await service.listen({port:0});t.after(()=>service.close());
 const login=await fetch(baseUrl+'/api/session',{method:'POST',headers:{Origin:baseUrl,'Content-Type':'application/json'},body:JSON.stringify({role:'admin'})}),cookie=login.headers.get('set-cookie').split(';')[0],identity=await login.json();
 const write=await fetch(baseUrl+'/api/commands',{method:'POST',headers:{Origin:baseUrl,Cookie:cookie,'Content-Type':'application/json','X-CSRF-Token':identity.csrfToken,'Idempotency-Key':'packet-server-source'},body:JSON.stringify({expectedRevision:0,command:{type:'REVISE_SOURCE',sourceId:'pipeline-promise',text:'SYNTHETIC: updated wording is a separate source revision.'}})});
 assert.equal(write.status,200);
 const response=await fetch(baseUrl+'/api/export',{headers:{Cookie:cookie}}),packet=await response.json();
 const valid=await verifyPacketInput({packet});assert.equal(valid.valid,true,JSON.stringify(valid));assert.equal(valid.summary.serverAuditEntries,1);assert.equal(valid.summary.events,29);
 const wrapped={format:'truthful-assurance-packet-v1',mode:'server',exportedAt:at,actor:identity.actor,workspace:packet.workspace,view:packet.view,invariantCheck:validateWorkspace(packet.workspace,packet.projectionContext),serverRecord:packet};
 assert.equal((await verifyPacketInput({packet:wrapped})).valid,true);
 const changed=structuredClone(packet);changed.audit[0].actor.id='different-actor';assert.equal((await verifyPacketInput({packet:changed})).valid,false);
 const changedOuter=structuredClone(wrapped);changedOuter.view.totals.verifiedCents++;assert.equal((await verifyPacketInput({packet:changedOuter})).valid,false);
});

test('authority requires explicit out-of-band trust and verifies a real signed execution receipt',async()=>{
 const {packet,trustedIssuers}=await authorityFixture(),before=JSON.stringify(packet);
 const noTrust=await verifyPacketInput({packet});assert.equal(noTrust.valid,false);assert.equal(noTrust.code,'AUTHORITY_UNTRUSTED');
 const valid=await verifyPacketInput({packet,trustedIssuers});assert.equal(valid.valid,true,JSON.stringify(valid));assert.equal(valid.summary.executions,1);assert.equal(valid.summary.trustedIssuerCount,1);assert.match(valid.scope,/current revocation/);
 assert.equal(JSON.stringify(packet),before);
 const contained=structuredClone(packet);contained.trustedIssuers=trustedIssuers;assert.equal((await verifyPacketInput({packet:contained})).valid,false,'packet-contained trust is never adopted');
 const wrong=await generateAgentKey();assert.equal((await verifyPacketInput({packet,trustedIssuers:[{...trustedIssuers[0],publicKey:wrong.publicKey}]})).valid,false);
 const changed=structuredClone(packet);changed.executions[0].receipt.payload.afterFinancial.totals.verifiedCents=500;assert.equal((await verifyPacketInput({packet:changed,trustedIssuers})).valid,false);
 const truncated=structuredClone(packet);truncated.lifecycle.pop();assert.equal((await verifyPacketInput({packet:truncated,trustedIssuers})).valid,false);
});

test('valid exploration verification preserves unsafe and inconclusive outcomes instead of calling either safe',async()=>{
 const unsafe=await explorePlan('concurrent-credit',{mode:'naive'}),verified=await verifyPacketInput({packet:unsafe});
 assert.equal(verified.valid,true,JSON.stringify(verified));assert.equal(verified.summary.hasUnsafeWitness,true);assert.equal(verified.summary.status,'unsafe_effect_found');assert.match(verified.scope,/valid packet may describe an unsafe effect/);
 const cutoff=await explorePlan('concurrent-credit',{mode:'guarded',bounds:{maxStates:2}}),inconclusive=await verifyPacketInput({packet:cutoff});
 assert.equal(inconclusive.valid,true,JSON.stringify(inconclusive));assert.equal(inconclusive.summary.inconclusive,true);
 const changed=structuredClone(unsafe);changed.goalCompletion.completedSchedules++;assert.equal((await verifyPacketInput({packet:changed})).valid,false);
});

test('JSON, byte, domain-event and aggregate replay budgets reject invalid uploads before verification',async()=>{
 const recovery=await recoveryFixture();
 for(const input of [null,[],{}, {packet:recovery,extra:true},{packet:'not an object'},{packet:{format:'unknown'}},{packet:{format:'__proto__'}}]) {
  const result=await verifyPacketInput(input);assert.equal(result.valid,false);assert.ok(result.errors.length);assert.equal(typeof result.scope,'string');
 }
 const oversized=await verifyPacketInput({packet:{format:'truthful-evidence-packet-v1',padding:'x'.repeat(packetLimits.maxBytes)}});assert.equal(oversized.code,'PACKET_TOO_LARGE');
 const tooMany={format:'truthful-assurance-packet-v1',workspace:{schemaVersion:1,revision:1001,events:Array.from({length:1001},()=>({}))}};
 assert.equal((await verifyPacketInput({packet:tooMany})).code,'PACKET_LIMIT');
 const collective={format:'truthful-authority-evidence-v1',snapshots:Array.from({length:6},()=>({schemaVersion:1,revision:900,events:Array.from({length:900},()=>({}))}))};
 assert.equal((await verifyPacketInput({packet:collective})).code,'PACKET_LIMIT');
 const circular={format:'truthful-evidence-packet-v1'};circular.loop=circular;assert.equal((await verifyPacketInput({packet:circular})).code,'PACKET_INPUT_INVALID');
 const accessor={format:'truthful-evidence-packet-v1'};Object.defineProperty(accessor,'secret',{enumerable:true,get(){throw new Error('Accessor must not run.');}});assert.equal((await verifyPacketInput({packet:accessor})).code,'PACKET_INPUT_INVALID');
 let nested={};for(let i=0;i<70;i++)nested={nested};assert.equal((await verifyPacketInput({packet:{format:'truthful-evidence-packet-v1',nested}})).code,'PACKET_LIMIT');
});

test('trust inputs reject private material, duplicate pins and unknown trust fields',async()=>{
 const {packet,trustedIssuers}=await authorityFixture();
 for(const trust of [trustedIssuers.concat(trustedIssuers),[{...trustedIssuers[0],extra:'unrecognized'}],[{...trustedIssuers[0],publicKey:{...trustedIssuers[0].publicKey,d:'private-material'}}],Array.from({length:17},(_,i)=>({...trustedIssuers[0],keyId:'key-'+i}))])assert.equal((await verifyPacketInput({packet,trustedIssuers:trust})).code,'TRUST_INVALID');
});
