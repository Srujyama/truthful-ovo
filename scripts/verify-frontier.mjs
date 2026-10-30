import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {scenarioCatalog,compareScenario,verifyExplorationPacket} from '../src/explorer/index.mjs';
import {createMemoryAuthority,generateAgentKey,signAgentRequest,grantDigest,delegateGrant,verifyAuthorityPacket,REQUEST_PROFILE} from '../src/authority/index.mjs';
import {createAuthorityDemoWorkspace,AUTHORITY_DEMO_TIME,AUTHORITY_DEMO_ACTOR} from '../src/authority/fixtures.mjs';

console.log('Authored bounded acceptance. No formal proof, held-out LLM accuracy, protocol conformance, or external settlement claim.');
let exploredStates=0,transitions=0,packets=0,unsafeWitnesses=0;
for(const scenario of scenarioCatalog){
  const result=await compareScenario(scenario.id,{bounds:{maxStates:2000,maxTimeMs:10000}});
  assert.equal(result.guarded.stats.exhaustiveWithinBounds,true);
  assert.equal(result.guarded.status,'no_unsafe_effect_within_bounds');
  if(scenario.id==='benign-completion')assert.equal(result.naive.shortestWitness,null);
  else{assert.ok(result.naive.shortestWitness?.unsafeEffects.length);unsafeWitnesses++;}
  assert.ok(result.repair);
  assert.equal(result.repair.report.status,'no_unsafe_effect_within_bounds');
  assert.ok(result.repair.report.goalCompletion.safeCompletedSchedules>0);
  if(scenario.id==='deadline-drift')assert.ok(result.repair.report.goalCompletion.blockedOrIncompleteSchedules>0,'Deadline repair must retain its adverse clock ordering.');
  for(const packet of [result.naive,result.guarded,result.repair.report]){
    const verified=await verifyExplorationPacket(packet);assert.equal(verified.valid,true,verified.errors.join(' '));
    exploredStates+=packet.stats.exploredStates;transitions+=packet.stats.transitions;packets++;
  }
  console.log(`PASS ${scenario.id}: naive ${result.naive.status}; guarded ${result.guarded.status}; repair safely finishes ${result.repair.report.goalCompletion.safeCompletedSchedules}/${result.repair.report.goalCompletion.terminalSchedules} schedules.`);
}
const runtime=await createMemoryAuthority({workspace:createAuthorityDemoWorkspace(),clock:()=>AUTHORITY_DEMO_TIME});
const info=runtime.info(),rootAgent=await generateAgentKey(),worker=await generateAgentKey();
const {grant}=await runtime.issueGrant({actionId:'demo-action',agentPublicKey:rootAgent.publicKey,maxAmountCents:12000,maxObligationCents:2000,notBefore:AUTHORITY_DEMO_TIME,expiresAt:'2026-11-01T12:02:00.000Z',expectedRevision:0},{actor:AUTHORITY_DEMO_ACTOR});
const child=await delegateGrant(grant,{grantId:'acceptance-child',agentPublicKey:worker.publicKey,maxAmountCents:12000,maxObligationCents:2000,expiresAt:'2026-11-01T12:01:00.000Z'},rootAgent.privateKey);
const request=await signAgentRequest({profile:REQUEST_PROFILE,workspaceId:info.workspaceId,audience:info.audience,grantDigest:await grantDigest(child),actionId:'demo-action',commitmentId:'demo-commitment',expectedRevision:0,commandId:'acceptance-execute',nonce:'acceptance-request-nonce',issuedAt:AUTHORITY_DEMO_TIME},worker.privateKey);
const input={grants:[grant,child],request,idempotencyKey:'acceptance-idempotent-request'};
const result=await runtime.execute(input);
const commitment=result.view.commitments.find(c=>c.id==='demo-commitment');
assert.equal(commitment.promisedCents,12000);assert.equal(commitment.incrementalObligationCents,2000);assert.equal(commitment.verifiedCents,0);
assert.deepEqual(await runtime.execute(input),result,'Exact retry must return its original signed effect receipt.');
await assert.rejects(runtime.execute({...input,idempotencyKey:'acceptance-new-use'}),/revoked or consumed/);
const packet=await runtime.exportPacket(),trustedIssuers=[{issuer:info.issuer,keyId:info.keyId,publicKey:info.publicKey}];
assert.equal((await verifyAuthorityPacket(packet,{trustedIssuers})).valid,true);
assert.equal((await verifyAuthorityPacket(packet,{trustedIssuers:[]})).valid,false);
const changed=structuredClone(packet);changed.checkpoint.signature=(changed.checkpoint.signature[0]==='A'?'B':'A')+changed.checkpoint.signature.slice(1);
assert.equal((await verifyAuthorityPacket(changed,{trustedIssuers})).valid,false);
await assert.rejects(delegateGrant(grant,{grantId:'expanded',maxAmountCents:12001},rootAgent.privateKey),/narrow/);
console.log('PASS real Ed25519 root/child delegation, agent possession, one local financial effect, exact retry, fresh-use refusal, pinned-trust replay, unknown-trust refusal, signature tamper and scope-expansion rejection.');
const research=await readFile(new URL('../docs/FRONTIER_RESEARCH.md',import.meta.url),'utf8');
for(const source of ['draft-izmaylov-agent-permission-receipts-01','2609.00060','2609.14631','2610.25916'])assert.ok(research.includes(source),`Missing verified research source ${source}.`);
console.log(`${scenarioCatalog.length} families; ${unsafeWitnesses} unsafe reference witnesses; ${packets} replay-verified reports; ${exploredStates} visited search states; ${transitions} checked transitions. Counts include shared fixture prefixes, not independent real-world cases.`);
