import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { spawnSync } from 'node:child_process';
import { createService, verifyExportPacket } from './service.mjs';
import { generateAgentKey, signAgentRequest, delegateGrant, grantDigest, REQUEST_PROFILE, verifyAuthorityPacket } from '../src/authority/index.mjs';
import { createAuthorityDemoWorkspace, AUTHORITY_DEMO_TIME } from '../src/authority/fixtures.mjs';
import { createDemoWorkspace } from '../src/assurance/index.mjs';
async function harness(t, { dbPath = ':memory:', clock = () => AUTHORITY_DEMO_TIME, initialWorkspace = createAuthorityDemoWorkspace() } = {}) {
  let service, baseUrl, cookie, csrf;
  const start = async () => { service = await createService({ dbPath, initialWorkspace, clock }); ({ baseUrl } = await service.listen({ port: 0 })); };
  await start(); let closed = false;
  const close = async () => { if (!closed) { closed = true; await service.close(); } };
  t.after(close);
  const call = async (path, payload, key = 'authority-default', session = true) => {
    const response = await fetch(baseUrl + path, { method: payload ? 'POST' : 'GET', headers: { Origin: baseUrl, ...(session && cookie ? { Cookie: cookie } : {}), ...(payload ? { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf || '', 'Idempotency-Key': key } : {}) }, ...(payload ? { body: JSON.stringify(payload) } : {}) });
    return { status: response.status, body: await response.json(), replayed: response.headers.get('Idempotent-Replayed') };
  };
  const login = await fetch(baseUrl + '/api/session', { method: 'POST', headers: { Origin: baseUrl, 'Content-Type': 'application/json' }, body: JSON.stringify({role:'admin'}) }); cookie=login.headers.get('set-cookie').split(';')[0]; csrf=(await login.json()).csrfToken;
  const info = (await call('/api/authority')).body, agent = await generateAgentKey(), trust = [{ issuer:info.issuer,keyId:info.keyId,publicKey:info.publicKey }];
  const issue = async (overrides={},key=crypto.randomUUID()) => call('/api/authority/grants',{actionId:'demo-action',agentPublicKey:agent.publicKey,maxAmountCents:13000,maxObligationCents:3000,notBefore:AUTHORITY_DEMO_TIME,expiresAt:'2026-11-01T13:00:00.000Z',expectedRevision:(await call('/api/authority')).body.expectedRevision,...overrides},key);
  const request = async (grant, overrides={}, signer=agent) => signAgentRequest({profile:REQUEST_PROFILE,workspaceId:info.workspaceId,audience:info.audience,grantDigest:await grantDigest(grant),actionId:'demo-action',commitmentId:'demo-commitment',expectedRevision:(await call('/api/authority')).body.expectedRevision,commandId:crypto.randomUUID(),nonce:crypto.randomUUID(),issuedAt:new Date(clock()).toISOString(),...overrides},signer.privateKey);
  return {call,issue,request,agent,trust,info,close,async restart(){await close();closed=false;await start();},get baseUrl(){return baseUrl;}};
}
test('real HTTP signed agent execution commits a financial effect, receipt, nonce, lifecycle and idempotent response together',async t=>{
  const f=await harness(t), issued=await f.issue(); assert.equal(issued.status,200,JSON.stringify(issued.body)); const grant=issued.body.grant, request=await f.request(grant);
  const response=await f.call('/api/authority/execute',{grants:[grant],request},'valid-signed-use',false); assert.equal(response.status,200,JSON.stringify(response.body));
  assert.equal(response.body.view.totals.incrementalObligationCents,2000);assert.equal(response.body.view.totals.promisedCents,12000);assert.equal(response.body.view.totals.verifiedCents,0);assert.equal(response.body.revision,1);
  assert.equal(response.body.authority.receipt.payload.actor.id,`agent:${f.agent.publicKey.x}`);
  const retry=await f.call('/api/authority/execute',{grants:[grant],request},'valid-signed-use',false);assert.equal(retry.replayed,'true');assert.deepEqual(retry.body,response.body);
  assert.equal((await f.call('/api/authority/execute',{grants:[grant],request},'second-key-same-request',false)).status,409);
  assert.equal((await f.call('/api/authority/execute',{grants:[grant],request:await f.request(grant)},'second-nonce-new-request',false)).body.error.code,'AUTHORITY_CONSUMED');
  assert.equal((await f.call('/api/authority/execute',{grants:[grant],request:await f.request(grant)},'valid-signed-use',false)).body.error.code,'IDEMPOTENCY_CONFLICT');
  const packet=(await f.call('/api/authority/export')).body; assert.deepEqual(packet.lifecycle.map(e=>e.payload.kind),['issued','used']); assert.equal((await verifyAuthorityPacket(packet,{trustedIssuers:f.trust})).valid,true);
  assert.equal((await verifyExportPacket((await f.call('/api/export')).body)).valid,true);
  const dir=await mkdtemp(join(tmpdir(),'truthful-authority-cli-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  await writeFile(join(dir,'packet.json'),JSON.stringify(packet));await writeFile(join(dir,'trust.json'),JSON.stringify(f.trust));
  const cli=spawnSync(process.execPath,['scripts/verify-authority.mjs',join(dir,'packet.json'),'--trust',join(dir,'trust.json')],{encoding:'utf8'});assert.equal(cli.status,0,cli.stderr||cli.stdout);
  const noTrust=spawnSync(process.execPath,['scripts/verify-authority.mjs',join(dir,'packet.json')],{encoding:'utf8'});assert.notEqual(noTrust.status,0);
});
test('HTTP rejects grant/request tampering, wrong key, cross-case, extra actor, unknown caveats and unsafe limits',async t=>{
  const f=await harness(t), grant=(await f.issue()).body.grant, request=await f.request(grant), wrong=await generateAgentKey();
  const tamper=structuredClone(grant);tamper.payload.maxAmountCents++;
  for(const payload of [{grants:[tamper],request},{grants:[grant],request:await f.request(grant,{},wrong)},{grants:[grant],request:await f.request(grant,{commitmentId:'other'})},{grants:[grant],request,actor:{role:'admin'}}])assert.notEqual((await f.call('/api/authority/execute',payload,crypto.randomUUID(),false)).status,200);
  const caveat=structuredClone(grant);caveat.payload.caveats=[{type:'anything'}];assert.notEqual((await f.call('/api/authority/execute',{grants:[caveat],request},crypto.randomUUID(),false)).status,200);
  assert.equal((await f.issue({maxAmountCents:Number.MAX_SAFE_INTEGER+1})).status,422);
  assert.equal((await f.issue({maxObligationCents:1999})).status,422);
  assert.equal((await f.call('/api/workspace')).body.revision,0);
  assert.equal((await f.call('/api/authority/status?grantId='+grant.payload.grantId)).body.consumedAt,null);
});
test('HTTP rechecks source/policy basis and expected revision and leaves rejected authority unconsumed',async t=>{
  for(const mode of ['source','policy','revision']){
    const f=await harness(t),grant=(await f.issue()).body.grant;
    const cmd=mode==='policy'?{type:'SET_POLICY',policy:{claimLimitCents:50000,renewalLimitCents:0,allowNewCommitments:false}}:{type:'REVISE_SOURCE',sourceId:'demo-source',text:'Synthetic changed evidence.'};
    assert.equal((await f.call('/api/commands',{expectedRevision:0,command:cmd},crypto.randomUUID())).status,200);
    const request=await f.request(grant,mode==='revision'?{expectedRevision:0}:{}), rejection=await f.call('/api/authority/execute',{grants:[grant],request},crypto.randomUUID(),false);
    assert.equal(rejection.status,409);assert.equal((await f.call('/api/workspace')).body.view.totals.incrementalObligationCents,0);assert.equal((await f.call('/api/authority/status?grantId='+grant.payload.grantId)).body.consumedAt,null);
  }
});
test('HTTP revocation and expiry reject new uses; an exact committed retry survives expiry and revocation',async t=>{
  let at=AUTHORITY_DEMO_TIME;const f=await harness(t,{clock:()=>at}),grant=(await f.issue()).body.grant,request=await f.request(grant);
  await f.call('/api/authority/revoke',{grantId:grant.payload.grantId,reason:'Synthetic cancellation'},'revoke-first');
  assert.equal((await f.call('/api/authority/execute',{grants:[grant],request},'use-revoked',false)).body.error.code,'AUTHORITY_REVOKED');
  const grant2=(await f.issue()).body.grant,request2=await f.request(grant2);at='2026-11-01T14:00:00.000Z';
  assert.equal((await f.call('/api/authority/execute',{grants:[grant2],request:request2},'use-expired',false)).body.error.code,'AUTHORITY_EXPIRED');
  at=AUTHORITY_DEMO_TIME;const grant3=(await f.issue()).body.grant,request3=await f.request(grant3),success=await f.call('/api/authority/execute',{grants:[grant3],request:request3},'success-before-expiry',false);assert.equal(success.status,200);
  await f.call('/api/authority/revoke',{grantId:grant3.payload.grantId,reason:'Revoke future presentation'},'revoke-after-use');at='2026-11-01T14:00:00.000Z';
  assert.deepEqual((await f.call('/api/authority/execute',{grants:[grant3],request:request3},'success-before-expiry',false)).body,success.body);
  assert.equal((await verifyAuthorityPacket((await f.call('/api/authority/export')).body,{trustedIssuers:f.trust})).valid,true);
});
test('HTTP future notBefore authority cannot execute early and exported issuance remains verifiable',async t=>{
  const f=await harness(t),grant=(await f.issue({notBefore:'2026-11-01T12:30:00.000Z'})).body.grant;
  const request=await f.request(grant,{issuedAt:'2026-11-01T12:30:00.000Z'});
  assert.equal((await f.call('/api/authority/execute',{grants:[grant],request},'not-before-window',false)).body.error.code,'AUTHORITY_EXPIRED');
  assert.equal((await verifyAuthorityPacket((await f.call('/api/authority/export')).body,{trustedIssuers:f.trust})).valid,true);
});
test('concurrent signed child/parent presentations share one root nonce and persist across restart',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'truthful-authority-db-'));t.after(()=>rm(dir,{recursive:true,force:true}));const dbPath=join(dir,'authority.sqlite'),f=await harness(t,{dbPath}),root=(await f.issue()).body.grant,childKey=await generateAgentKey();
  const child=await delegateGrant(root,{grantId:crypto.randomUUID(),agentPublicKey:childKey.publicKey,maxAmountCents:12000,maxObligationCents:2000},f.agent.privateKey),childRequest=await f.request(child,{},childKey),parentRequest=await f.request(root);
  const results=await Promise.all([f.call('/api/authority/execute',{grants:[root,child],request:childRequest},'concurrent-child',false),f.call('/api/authority/execute',{grants:[root],request:parentRequest},'concurrent-parent',false)]);assert.equal(results.filter(r=>r.status===200).length,1);
  const winner=results[0].status===200?{grants:[root,child],request:childRequest,key:'concurrent-child'}:{grants:[root],request:parentRequest,key:'concurrent-parent'};
  await f.restart();assert.equal((await f.call('/api/authority')).body.fingerprint,f.info.fingerprint);assert.equal((await f.call('/api/workspace')).body.view.totals.incrementalObligationCents,2000);
  assert.equal((await f.call('/api/authority/execute',{grants:winner.grants,request:winner.request},winner.key,false)).replayed,'true');assert.equal((await verifyAuthorityPacket((await f.call('/api/authority/export')).body,{trustedIssuers:f.trust})).valid,true);
});
test('SQLite failure after nonce mutation rolls back financial effect, consumption, audit and idempotency',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'truthful-authority-rollback-'));t.after(()=>rm(dir,{recursive:true,force:true}));const dbPath=join(dir,'rollback.sqlite'),f=await harness(t,{dbPath}),grant=(await f.issue()).body.grant,request=await f.request(grant);
  const db=new DatabaseSync(dbPath);t.after(()=>db.close());db.exec("CREATE TRIGGER reject_authority_receipt BEFORE INSERT ON authority_executions BEGIN SELECT RAISE(ABORT,'injected rollback'); END;");
  assert.equal((await f.call('/api/authority/execute',{grants:[grant],request},'rollback-request',false)).status,500);
  assert.equal((await f.call('/api/workspace')).body.revision,0);assert.equal((await f.call('/api/authority/status?grantId='+grant.payload.grantId)).body.consumedAt,null);assert.equal((await f.call('/api/events')).body.events.length,0);assert.equal((await f.call('/api/authority/export')).body.lifecycle.length,1);
  db.exec('DROP TRIGGER reject_authority_receipt');assert.equal((await f.call('/api/authority/execute',{grants:[grant],request},'rollback-request',false)).status,200);
});
test('command-ID retry cannot create a signed receipt for an earlier human execution',async t=>{
  const f=await harness(t),grant=(await f.issue()).body.grant,commandId='already-human-executed';
  assert.equal((await f.call('/api/commands',{expectedRevision:0,command:{id:commandId,type:'EXECUTE_ACTION',actionId:'demo-action'}},'human-demo-use')).status,200);
  const response=await f.call('/api/authority/execute',{grants:[grant],request:await f.request(grant,{commandId})},'agent-command-replay',false);assert.equal(response.body.error.code,'AUTHORITY_COMMAND_REPLAY');assert.equal((await f.call('/api/authority/export')).body.executions.length,0);
});
test('reset atomically revokes old roots even when reused seeded IDs reproduce the exact old approval',async t=>{
  const f=await harness(t,{initialWorkspace:createDemoWorkspace()});
  assert.equal((await f.call('/api/commands',{expectedRevision:0,command:{type:'APPROVE_ACTION',actionId:'action-pipeline-preserve'}},'approve-before-reset')).status,200);
  const before=(await f.call('/api/workspace')).body.view.actions.find(a=>a.id==='action-pipeline-preserve');
  const issued=await f.issue({actionId:'action-pipeline-preserve',maxAmountCents:150000,maxObligationCents:0}),grant=issued.body.grant;assert.equal(issued.status,200,JSON.stringify(issued.body));
  assert.equal((await f.call('/api/demo/reset',{expectedRevision:1,confirm:'RESET_DEMO_WORKSPACE'},'reset-authority-generation')).status,200);
  assert.equal((await f.call('/api/commands',{expectedRevision:2,command:{type:'APPROVE_ACTION',actionId:'action-pipeline-preserve'}},'reapprove-after-reset')).status,200);
  const after=(await f.call('/api/workspace')).body.view.actions.find(a=>a.id==='action-pipeline-preserve');
  assert.deepEqual(after.approval,before.approval,'Fixture deliberately reproduces identical event ID, actor, time and basis after reset.');
  const request=await f.request(grant,{actionId:'action-pipeline-preserve',commitmentId:'pipeline-seats'});
  assert.equal((await f.call('/api/authority/execute',{grants:[grant],request},'old-grant-after-reset',false)).body.error.code,'AUTHORITY_REVOKED');
  assert.ok((await f.call('/api/authority/status?grantId='+grant.payload.grantId)).body.revokedAt);
  const packet=(await f.call('/api/authority/export')).body;assert.deepEqual(packet.lifecycle.map(e=>e.payload.kind),['issued','revoked']);assert.match(packet.lifecycle[1].payload.detail.reason,/reset/);assert.equal((await verifyAuthorityPacket(packet,{trustedIssuers:f.trust})).valid,true);
  assert.equal((await verifyExportPacket((await f.call('/api/export')).body)).valid,true);
});
test('reset revocation lifecycle failure rolls back reset revision, grant status and audit together',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'truthful-reset-rollback-'));t.after(()=>rm(dir,{recursive:true,force:true}));const dbPath=join(dir,'reset.sqlite'),f=await harness(t,{dbPath}),grant=(await f.issue()).body.grant;
  const db=new DatabaseSync(dbPath);t.after(()=>db.close());db.exec("CREATE TRIGGER fail_reset_revocation BEFORE INSERT ON authority_lifecycle WHEN json_extract(NEW.entry_json,'$.payload.kind')='revoked' BEGIN SELECT RAISE(ABORT,'injected reset rollback'); END;");
  assert.equal((await f.call('/api/demo/reset',{expectedRevision:0,confirm:'RESET_DEMO_WORKSPACE'},'reset-rollback-key')).status,500);
  assert.equal((await f.call('/api/workspace')).body.revision,0);assert.equal((await f.call('/api/events')).body.events.length,0);assert.equal((await f.call('/api/authority/status?grantId='+grant.payload.grantId)).body.revokedAt,null);assert.equal((await f.call('/api/authority/export')).body.lifecycle.length,1);
  db.exec('DROP TRIGGER fail_reset_revocation');
  assert.equal((await f.call('/api/demo/reset',{expectedRevision:0,confirm:'RESET_DEMO_WORKSPACE'},'reset-rollback-key')).status,200);assert.ok((await f.call('/api/authority/status?grantId='+grant.payload.grantId)).body.revokedAt);
});
