import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {createService} from './service.mjs';
import {createAuthorityManager} from './authority.mjs';
import * as engine from '../src/assurance/index.mjs';
import {createAuthorityDemoWorkspace,AUTHORITY_DEMO_TIME} from '../src/authority/fixtures.mjs';
import {generateAgentKey,signAgentRequest,grantDigest,REQUEST_PROFILE} from '../src/authority/index.mjs';

async function harness(t) {
  const directory=await mkdtemp(join(tmpdir(),'truthful-authority-integrity-')),dbPath=join(directory,'state.sqlite');
  let service=await createService({dbPath,initialWorkspace:createAuthorityDemoWorkspace(),clock:()=>AUTHORITY_DEMO_TIME});
  let {baseUrl}=await service.listen({port:0}),closed=false;
  const db=new DatabaseSync(dbPath);
  t.after(async()=>{db.close();if(!closed)await service.close();await rm(directory,{recursive:true,force:true});});
  const response=await fetch(baseUrl+'/api/session',{method:'POST',headers:{Origin:baseUrl,'Content-Type':'application/json'},body:JSON.stringify({role:'admin'})});
  const cookie=response.headers.get('set-cookie').split(';')[0],session=await response.json();
  const call=async(path,input,key='integrity-request')=>{
    const response=await fetch(baseUrl+path,{method:input?'POST':'GET',headers:{Origin:baseUrl,Cookie:cookie,...(input?{'Content-Type':'application/json','X-CSRF-Token':session.csrfToken,'Idempotency-Key':key}:{})},...(input?{body:JSON.stringify(input)}:{})});
    return {status:response.status,body:await response.json()};
  };
  const info=(await call('/api/authority')).body,agent=await generateAgentKey();
  const issueInput={actionId:'demo-action',agentPublicKey:agent.publicKey,maxAmountCents:13000,maxObligationCents:3000,notBefore:AUTHORITY_DEMO_TIME,expiresAt:'2026-11-01T13:00:00.000Z',expectedRevision:0};
  const issue=async(key='integrity-issue')=>{const result=await call('/api/authority/grants',issueInput,key);assert.equal(result.status,200,JSON.stringify(result.body));return result.body;};
  const request=async grant=>signAgentRequest({profile:REQUEST_PROFILE,workspaceId:info.workspaceId,audience:info.audience,grantDigest:await grantDigest(grant),actionId:'demo-action',commitmentId:'demo-commitment',expectedRevision:0,commandId:crypto.randomUUID(),nonce:crypto.randomUUID(),issuedAt:AUTHORITY_DEMO_TIME},agent.privateKey);
  const close=async()=>{if(!closed){await service.close();closed=true;}};
  const restart=async()=>{await close();service=await createService({dbPath,initialWorkspace:createAuthorityDemoWorkspace(),clock:()=>AUTHORITY_DEMO_TIME});({baseUrl}=await service.listen({port:0}));closed=false;};
  const snapshot=()=>({workspace:{...db.prepare('SELECT revision,state_json FROM workspace').get()},grants:db.prepare('SELECT grant_id,revoked_at,consumed_at FROM authority_grants ORDER BY grant_id').all().map(row=>({...row})),audit:db.prepare('SELECT count(*) AS n FROM audit').get().n,lifecycle:db.prepare('SELECT count(*) AS n FROM authority_lifecycle').get().n,executions:db.prepare('SELECT count(*) AS n FROM authority_executions').get().n});
  return {db,dbPath,call,issue,issueInput,request,info,snapshot,close,restart};
}
const assertFailure = result => {assert.equal(result.status,503,JSON.stringify(result.body));assert.equal(result.body.error.code,'INTEGRITY_FAILURE');};

test('clearing revoked_at is detected before status, export, issuance, revocation, execution and restart',async t=>{
  const h=await harness(t),issued=await h.issue(),grant=issued.grant,request=await h.request(grant);
  assert.equal((await h.call('/api/authority/revoke',{grantId:grant.payload.grantId,reason:'Synthetic cancellation'},'integrity-revoke')).status,200);
  h.db.prepare('UPDATE authority_grants SET revoked_at=NULL WHERE grant_id=?').run(grant.payload.grantId);
  const before=h.snapshot();
  for(const result of [await h.call('/api/authority/status?grantId='+grant.payload.grantId),await h.call('/api/authority/export'),await h.call('/api/authority'),await h.call('/api/authority/grants',h.issueInput,'another-issue'),await h.call('/api/authority/revoke',{grantId:grant.payload.grantId,reason:'Must not repair corruption'},'another-revoke'),await h.call('/api/authority/execute',{grants:[grant],request},'revoked-corrupt-use')])assertFailure(result);
  assert.deepEqual(h.snapshot(),before,'integrity failures cannot mutate financial state, nonce status or lifecycle');
  await h.close();await assert.rejects(h.restart(),error=>error.code==='INTEGRITY_FAILURE'&&error.status===503);
  assert.deepEqual(h.snapshot(),before);
});

test('clearing consumed_at cannot execute or replay a signed effect again',async t=>{
  const h=await harness(t),grant=(await h.issue()).grant,request=await h.request(grant);
  assert.equal((await h.call('/api/authority/execute',{grants:[grant],request},'committed-once')).status,200);
  h.db.prepare('UPDATE authority_grants SET consumed_at=NULL WHERE grant_id=?').run(grant.payload.grantId);
  const before=h.snapshot();
  assertFailure(await h.call('/api/authority/status?grantId='+grant.payload.grantId));
  assertFailure(await h.call('/api/authority/execute',{grants:[grant],request},'committed-once'));
  assertFailure(await h.call('/api/authority/export'));
  assert.deepEqual(h.snapshot(),before);
});

test('stored lifecycle signatures and grant copies are reconciled against the pinned issuer',async t=>{
  for(const target of ['signature','grant']) {
    const h=await harness(t),grant=(await h.issue()).grant;
    if(target==='signature') {
      const row=h.db.prepare('SELECT * FROM authority_lifecycle WHERE sequence=1').get(),entry=JSON.parse(row.entry_json);
      entry.signature=(entry.signature[0]==='A'?'B':'A')+entry.signature.slice(1);
      h.db.prepare('UPDATE authority_lifecycle SET entry_json=? WHERE sequence=1').run(JSON.stringify(entry));
    } else {
      const changed=structuredClone(grant);changed.payload.maxAmountCents++;
      h.db.prepare('UPDATE authority_grants SET grant_json=? WHERE grant_id=?').run(JSON.stringify(changed),grant.payload.grantId);
    }
    const before=h.snapshot();assertFailure(await h.call('/api/authority/export'));assert.deepEqual(h.snapshot(),before);
  }
});

test('authority response caches and their signed completeness checkpoint detect alteration or deletion',async t=>{
  for(const target of ['response','delete']) {
    const h=await harness(t);await h.issue();
    if(target==='response') {
      const row=h.db.prepare('SELECT * FROM authority_requests LIMIT 1').get(),response=JSON.parse(row.response_json);response.info.fingerprint='substituted-trust-root';
      h.db.prepare('UPDATE authority_requests SET response_json=? WHERE actor_id=? AND request_key=?').run(JSON.stringify(response),row.actor_id,row.request_key);
    } else {
      h.db.exec('DELETE FROM authority_requests; DELETE FROM authority_cache_seals;');
    }
    assertFailure(await h.call('/api/authority/export'));
  }
});

test('receipt corruption and forged recomputed delegated cache digests fail closed',async t=>{
  for(const target of ['receipt','cache']) {
    const h=await harness(t),grant=(await h.issue()).grant,request=await h.request(grant);
    assert.equal((await h.call('/api/authority/execute',{grants:[grant],request},'integrity-execution')).status,200);
    if(target==='receipt') {
      const row=h.db.prepare('SELECT * FROM authority_executions LIMIT 1').get(),ex=JSON.parse(row.evidence_json);ex.receipt.payload.afterFinancial.totals.verifiedCents=123;
      h.db.prepare('UPDATE authority_executions SET evidence_json=? WHERE sequence=?').run(JSON.stringify(ex),row.sequence);
    } else {
      const row=h.db.prepare('SELECT * FROM idempotency LIMIT 1').get(),response=JSON.parse(row.response_json);response.authority.info.fingerprint='forged-cache-key';
      const text=JSON.stringify(response),hash=createHash('sha256').update(text).digest('hex');
      h.db.prepare('UPDATE idempotency SET response_json=?,response_digest=? WHERE actor_id=? AND request_key=?').run(text,hash,row.actor_id,row.request_key);
    }
    const before=h.snapshot();assertFailure(await h.call('/api/authority/export'));assertFailure(await h.call('/api/authority/execute',{grants:[grant],request},'integrity-execution'));assert.deepEqual(h.snapshot(),before);
  }
});

test('one-time legacy baseline preserves original retry bytes and catches subsequent cache tampering',async t=>{
  const h=await harness(t),first=await h.issue('legacy-issue-key');
  await h.close();
  h.db.exec('DELETE FROM authority_cache_seals; DELETE FROM authority_cache_baseline; DELETE FROM authority_cache_checkpoint;');
  await h.restart();
  const retried=await h.call('/api/authority/grants',h.issueInput,'legacy-issue-key');
  assert.equal(retried.status,200);assert.deepEqual(retried.body,first);
  const baseline=JSON.parse(h.db.prepare('SELECT baseline_json FROM authority_cache_baseline').get().baseline_json);
  assert.equal(baseline.payload.count,1);assert.match(baseline.payload.notice,/not proof of pre-migration cache authenticity/);
  const row=h.db.prepare('SELECT * FROM authority_requests LIMIT 1').get(),response=JSON.parse(row.response_json);response.expectedRevision=100;
  h.db.prepare('UPDATE authority_requests SET response_json=? WHERE actor_id=? AND request_key=?').run(JSON.stringify(response),row.actor_id,row.request_key);
  assertFailure(await h.call('/api/authority/export'));
});

test('inconsistent legacy responses are refused before any new baseline is signed',async t=>{
  const h=await harness(t);await h.issue();await h.close();
  h.db.exec('DELETE FROM authority_cache_seals; DELETE FROM authority_cache_baseline; DELETE FROM authority_cache_checkpoint;');
  const row=h.db.prepare('SELECT * FROM authority_requests LIMIT 1').get(),response=JSON.parse(row.response_json);response.grant.payload.maxAmountCents++;
  h.db.prepare('UPDATE authority_requests SET response_json=? WHERE actor_id=? AND request_key=?').run(JSON.stringify(response),row.actor_id,row.request_key);
  const before=h.snapshot();await assert.rejects(h.restart(),error=>error.code==='INTEGRITY_FAILURE');
  assert.equal(h.db.prepare('SELECT count(*) AS n FROM authority_cache_baseline').get().n,0);
  assert.equal(h.db.prepare('SELECT count(*) AS n FROM authority_cache_seals').get().n,0);
  assert.deepEqual(h.snapshot(),before);
});

test('integrity caching observes external changes and own changes including a rolled-back transaction',async t=>{
  const h=await harness(t),grant=(await h.issue()).grant;
  const db=new DatabaseSync(h.dbPath);t.after(()=>db.close());
  const manager=createAuthorityManager({db,now:()=>AUTHORITY_DEMO_TIME,engine,read:()=>{const row=db.prepare('SELECT * FROM workspace').get();return {revision:row.revision,state:JSON.parse(row.state_json)};},requireIntegrity:()=>({valid:true}),write:()=>{throw new Error('No writes in this direct integrity check.');}});
  assert.equal(manager.verifyIntegrity({force:true}).valid,true);
  assert.equal(manager.verifyIntegrity().valid,true);
  db.exec('BEGIN IMMEDIATE');db.prepare('UPDATE authority_grants SET consumed_at=? WHERE grant_id=?').run(AUTHORITY_DEMO_TIME,grant.payload.grantId);
  assert.throws(()=>manager.verifyIntegrity(),error=>error.code==='INTEGRITY_FAILURE');db.exec('ROLLBACK');
  assert.equal(manager.verifyIntegrity().valid,true,'rollback cannot leave a stale success or failure cached');
  h.db.prepare('UPDATE authority_grants SET revoked_at=? WHERE grant_id=?').run(AUTHORITY_DEMO_TIME,grant.payload.grantId);
  assert.throws(()=>manager.verifyIntegrity(),error=>error.code==='INTEGRITY_FAILURE','external connection invalidates data_version cache');
});
