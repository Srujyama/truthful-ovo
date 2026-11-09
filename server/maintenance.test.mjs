import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {backupManaged,restoreManaged,acquireDataLease} from './maintenance.mjs';
import {createManagedService} from './managed.mjs';
import {managedHarness,testDocuments,TEST_TIME,TEST_PASSWORD} from './test-support.mjs';
import {DatabaseSync} from 'node:sqlite';
import {generateAgentKey,signAgentRequest,grantDigest,REQUEST_PROFILE,verifyAuthorityPacket} from '../src/authority/index.mjs';

test('verified managed backup and restore preserve money and audit while invalidating sessions and pending work',async t=>{
 const f=await managedHarness(t),intake=await f.call('/api/evidence',{auth:f.admin,payload:testDocuments()});await f.workflow(f.admin,'evidence-import',{evidenceId:intake.body.evidenceId,analysisVersion:1});
 const preview=await f.call('/api/workflows/preview',{auth:f.admin,payload:{type:'amendment',expectedRevision:1,input:{commitmentId:(await f.call('/api/workspace',{auth:f.admin})).body.view.commitments[0].id,changes:{promisedCents:true},promisedAmount:'2500',effectiveDate:'2026-11-08',sourceText:'Proposed 2500 credit amendment.'}}});assert.equal(preview.status,200,JSON.stringify(preview.body));
 const root=mkdtempSync(join(tmpdir(),'truthful-backup-test-'));t.after(()=>rmSync(root,{recursive:true,force:true}));const snapshot=join(root,'snapshot'),restored=join(root,'restored');
 await assert.rejects(()=>backupManaged({dataDir:f.directory,destination:snapshot}),/owned by process/);assert(!existsSync(snapshot));await f.close();
 const manifest=await backupManaged({dataDir:f.directory,destination:snapshot});assert.equal(manifest.workspaces[0].revision,1);
 const result=await restoreManaged({snapshot,destination:restored});assert.equal(result.sessionsRevoked,true);assert.equal(result.outstandingGrantsRevoked,true);
 const service=await createManagedService({dataDir:restored,clock:()=>TEST_TIME});try{
  assert.equal(service.identity.resolveSession(f.admin.cookie.split('=')[1]),null);
  const login=await service.identity.login({email:'admin@example.test',password:TEST_PASSWORD,ip:'test'});const child=await service.child(login.workspace);assert.equal(child.operations.read().revision,1);assert.equal(child.operations.readiness().financial.valid,true);
  const status=child.operations.db.prepare('SELECT status FROM workflow_previews WHERE id=?').get(preview.body.previewId).status;assert.equal(status,'discarded');
 }finally{await service.close();}
 await assert.rejects(()=>restoreManaged({snapshot,destination:restored}),/new directory/);
 const file=join(snapshot,manifest.files[0].file);writeFileSync(file,Buffer.concat([readFileSync(file),Buffer.from('tampered')]));await assert.rejects(()=>restoreManaged({snapshot,destination:join(root,'bad-restore')}),/checksum/);assert(!existsSync(join(root,'bad-restore')));
});
test('migrations preserve accepted history, reject future schemas, and process ownership prevents overlapping writers',async t=>{
 const f=await managedHarness(t);const child=await f.service.child(f.initial.workspace),{db}=child.operations;
 assert.equal(db.prepare('PRAGMA user_version').get().user_version,1);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM schema_migrations').get().n,1);
 assert.throws(()=>acquireDataLease(f.directory,'other-owner'),/owned by process/);
 await f.close();const raw=new DatabaseSync(join(f.directory,`workspace-${f.initial.workspace.id}.sqlite`));raw.exec('PRAGMA user_version=999');raw.close();
 await assert.rejects(()=>f.restart(),/newer than this backend/);
});

test('restoring an actually issued unused grant revokes its signed lifecycle and refuses execution against the restored approval',async t=>{
 const f=await managedHarness(t),intake=await f.call('/api/evidence',{auth:f.admin,payload:testDocuments()}),imported=await f.workflow(f.admin,'evidence-import',{evidenceId:intake.body.evidenceId,analysisVersion:1});
 const commitmentId=imported.body.view.commitments[0].id,actionId='restore-approved-claim';
 for(const [expectedRevision,command]of [[1,{type:'PROPOSE_ACTION',action:{id:actionId,commitmentId,type:'prepare_claim',payload:{}}}],[2,{type:'APPROVE_ACTION',actionId}]]){const r=await f.call('/api/commands',{auth:f.admin,payload:{expectedRevision,command}});assert.equal(r.status,200,JSON.stringify(r.body));}
 const agent=await generateAgentKey(),info=(await f.call('/api/authority',{auth:f.admin})).body;
 const issued=await f.call('/api/authority/grants',{auth:f.admin,payload:{actionId,agentPublicKey:agent.publicKey,maxAmountCents:150000,maxObligationCents:0,notBefore:TEST_TIME,expiresAt:new Date(Date.now()+60*60*1000).toISOString(),expectedRevision:3}});assert.equal(issued.status,200,JSON.stringify(issued.body));const grant=issued.body.grant;
 const root=mkdtempSync(join(tmpdir(),'truthful-restore-grant-'));t.after(()=>rmSync(root,{recursive:true,force:true}));await f.close();await backupManaged({dataDir:f.directory,destination:join(root,'snapshot')});await restoreManaged({snapshot:join(root,'snapshot'),destination:join(root,'restored')});
 const restored=await createManagedService({dataDir:join(root,'restored')});try{
  const login=await restored.identity.login({email:'admin@example.test',password:TEST_PASSWORD,ip:'test'}),child=await restored.child(login.workspace),status=child.operations.authority.status(grant.payload.grantId);assert(status.revokedAt);assert.equal(status.consumedAt,null);assert.equal(child.operations.read().revision,3);
  const packet=child.operations.authority.exportPacket();const verification=await verifyAuthorityPacket(packet,{trustedIssuers:[{issuer:info.issuer,keyId:info.keyId,publicKey:info.publicKey}]});assert.equal(verification.valid,true,JSON.stringify(verification));assert.match(packet.lifecycle.at(-1).payload.detail.reason,/backup restoration/);
  const {baseUrl}=await restored.listen({port:0}),request=await signAgentRequest({profile:REQUEST_PROFILE,workspaceId:info.workspaceId,audience:info.audience,grantDigest:await grantDigest(grant),actionId,commitmentId,expectedRevision:3,commandId:crypto.randomUUID(),nonce:crypto.randomUUID(),issuedAt:new Date().toISOString()},agent.privateKey);
  const response=await fetch(baseUrl+'/api/authority/execute',{method:'POST',headers:{Origin:baseUrl,Cookie:`truthful_session=${login.token}`,'Content-Type':'application/json','Idempotency-Key':'restore-old-grant-refused'},body:JSON.stringify({grants:[grant],request})});const result=await response.json();assert.equal(result.error.code,'AUTHORITY_REVOKED');assert.equal(child.operations.read().revision,3);
 }finally{await restored.close();}
});
