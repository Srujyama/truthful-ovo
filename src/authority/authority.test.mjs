import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryAuthority, generateAgentKey, signAgentRequest, delegateGrant, grantDigest, REQUEST_PROFILE, verifyAuthorityPacket, verifyGrantChain, canonical } from './index.mjs';
import { createAuthorityDemoWorkspace, AUTHORITY_DEMO_TIME, AUTHORITY_DEMO_ACTOR } from './fixtures.mjs';
const clone = structuredClone;
async function setup() {
  let at = AUTHORITY_DEMO_TIME;
  const runtime = await createMemoryAuthority({ workspace: createAuthorityDemoWorkspace(), clock: () => at });
  const key = await generateAgentKey(), info = runtime.info(), trust = [{ issuer: info.issuer, keyId: info.keyId, publicKey: info.publicKey }];
  const issue = async (changes = {}) => (await runtime.issueGrant({ actionId: 'demo-action', agentPublicKey: key.publicKey, maxAmountCents: 13000, maxObligationCents: 3000, notBefore: AUTHORITY_DEMO_TIME, expiresAt: '2026-11-01T13:00:00.000Z', expectedRevision: runtime.snapshot().revision, ...changes }, { actor: AUTHORITY_DEMO_ACTOR })).grant;
  const request = async (grant, signer = key, changes = {}) => signAgentRequest({ profile: REQUEST_PROFILE, workspaceId: info.workspaceId, audience: info.audience, grantDigest: await grantDigest(grant), actionId: 'demo-action', commitmentId: 'demo-commitment', expectedRevision: runtime.snapshot().revision, commandId: crypto.randomUUID(), nonce: crypto.randomUUID(), issuedAt: at, ...changes }, signer.privateKey);
  return { runtime, key, info, trust, issue, request, setTime(value) { at = value; } };
}
test('browser-native signatures authorize a real isolated financial amendment, export replays, trust is external', async () => {
  const f = await setup(), grant = await f.issue(), request = await f.request(grant);
  const response = await f.runtime.execute({ grants: [grant], request, idempotencyKey: 'memory-valid-1' });
  assert.equal(response.view.totals.incrementalObligationCents, 2000); assert.equal(response.view.totals.promisedCents, 12000); assert.equal(response.view.totals.verifiedCents, 0);
  assert.equal(response.authority.receipt.payload.actor.id, `agent:${f.key.publicKey.x}`);
  assert.deepEqual(await f.runtime.execute({ grants: [grant], request, idempotencyKey: 'memory-valid-1' }), response);
  const packet = await f.runtime.exportPacket(); assert.equal((await verifyAuthorityPacket(packet, { trustedIssuers: f.trust })).valid, true);
  assert.equal((await verifyAuthorityPacket(packet, { trustedIssuers: [] })).code, 'AUTHORITY_UNTRUSTED');
  const changed = clone(packet); changed.executions[0].afterWorkspace.events.at(-1).payload.result.notice = 'altered'; assert.equal((await verifyAuthorityPacket(changed, { trustedIssuers: f.trust })).valid, false);
  const truncated = clone(packet); truncated.lifecycle.pop(); assert.equal((await verifyAuthorityPacket(truncated, { trustedIssuers: f.trust })).valid, false);
});
test('child grants can only narrow every scope axis; delegated child executes and shares root nonce', async () => {
  const f = await setup(), root = await f.issue(), childKey = await generateAgentKey();
  const child = await delegateGrant(root, { grantId: crypto.randomUUID(), agentPublicKey: childKey.publicKey, maxAmountCents: 12000, maxObligationCents: 2000, expiresAt: '2026-11-01T12:30:00.000Z' }, f.key.privateKey);
  assert.equal((await verifyGrantChain([root, child], { trustedIssuers: f.trust })).leaf.agentPublicKey.x, childKey.publicKey.x);
  for (const change of [{maxAmountCents:13001},{maxObligationCents:3001},{expiresAt:'2026-11-01T14:00:00.000Z'},{notBefore:'2026-11-01T11:00:00.000Z'},{workspaceId:'other'},{audience:'other'},{actionId:'other'},{commitmentId:'other'},{vendorId:'other'},{currency:'EUR'},{approvalBasisDigest:'other'},{approvalDigest:'other'},{actionDigest:'other'},{rootNonce:'other'},{issuer:'other'},{keyId:'other'},{action:'OTHER'},{caveats:[{type:'allow-anything'}]},{extra:true}]) await assert.rejects(delegateGrant(root, { grantId: crypto.randomUUID(), ...change }, f.key.privateKey));
  const request = await f.request(child, childKey); await f.runtime.execute({ grants:[root,child], request, idempotencyKey:'child-execution' });
  const otherRequest = await f.request(root); await assert.rejects(f.runtime.execute({ grants:[root], request:otherRequest, idempotencyKey:'parent-after-child' }), { code:'AUTHORITY_CONSUMED' });
  assert.equal((await verifyAuthorityPacket(await f.runtime.exportPacket(), { trustedIssuers:f.trust })).valid,true);
});
test('invalid signatures, unknown fields, unsafe cents and unknown caveats fail closed', async () => {
  const f=await setup(), grant=await f.issue(), request=await f.request(grant), wrong=await generateAgentKey();
  const tamper=clone(grant); tamper.payload.maxAmountCents++;
  await assert.rejects(f.runtime.execute({grants:[tamper],request,idempotencyKey:'tampered-amount'}));
  await assert.rejects(f.runtime.execute({grants:[grant],request:await f.request(grant,wrong),idempotencyKey:'wrong-key-sign'}));
  await assert.rejects(f.runtime.execute({grants:[grant],request:await f.request(grant,f.key,{commitmentId:'other'}),idempotencyKey:'wrong-case-sign'}));
  await assert.rejects(f.issue({maxAmountCents:Number.MAX_SAFE_INTEGER+1}));
  await assert.rejects(f.issue({maxObligationCents:-1}));
  assert.throws(()=>canonical({unknown:undefined}));
});
test('revocation, expiry, stale basis, changed policy and concurrent uses reject before financial effect', async () => {
  for(const mode of ['revoked','expired','stale','policy']) {
    const f=await setup(), grant=await f.issue();
    if(mode==='revoked')await f.runtime.revokeGrant({grantId:grant.payload.grantId,reason:'Demo cancellation'},{actor:AUTHORITY_DEMO_ACTOR});
    if(mode==='expired')f.setTime('2026-11-01T14:00:00.000Z');
    if(mode==='stale')await f.runtime.command({type:'REVISE_SOURCE',sourceId:'demo-source',text:'Synthetic correction requires fresh approval.'},{actor:AUTHORITY_DEMO_ACTOR});
    if(mode==='policy')await f.runtime.command({type:'SET_POLICY',policy:{allowNewCommitments:false,claimLimitCents:50000,renewalLimitCents:0}},{actor:AUTHORITY_DEMO_ACTOR});
    await assert.rejects(f.runtime.execute({grants:[grant],request:await f.request(grant),idempotencyKey:`reject-${mode}`}));
    assert.equal(f.runtime.snapshot().view.totals.incrementalObligationCents,0); assert.equal(f.runtime.status(grant.payload.grantId).consumedAt,null);
  }
  const f=await setup(), grant=await f.issue(), request=await f.request(grant);
  const results=await Promise.allSettled([f.runtime.execute({grants:[grant],request,idempotencyKey:'concurrent-one'}),f.runtime.execute({grants:[grant],request,idempotencyKey:'concurrent-two'})]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(f.runtime.snapshot().view.totals.incrementalObligationCents,2000);
});
