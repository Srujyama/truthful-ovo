import test from 'node:test';
import assert from 'node:assert/strict';
import {managedHarness,testDocuments} from './test-support.mjs';
import {verifyCase} from '../src/recovery.mjs';
import {verifyExplorationPacket} from '../src/explorer/index.mjs';

const ok=(result,status=200)=>{assert.equal(result.status,status,JSON.stringify(result.body));return result.body;};

test('HTTP claim journey saves and edits exact drafts, records a separate approver, downloads an unsent EML, invalidates on edit and survives restart',async t=>{
 const f=await managedHarness(t),analyst=await f.invite('analyst'),approver=await f.invite('approver'),viewer=await f.invite('viewer');
 const intake=ok(await f.call('/api/evidence',{auth:analyst,payload:testDocuments()}));
 const created=ok(await f.call('/api/recovery/cases',{auth:analyst,payload:{evidenceId:intake.evidenceId,analysisVersion:1,label:'Pipeline original-terms follow-up'},key:'parity-recovery-create'}));
 assert.equal(created.draftVersion,1);assert.equal(created.record.report.outstandingCents,150000);assert.equal(created.approvalCurrent,false);
 const base=`/api/recovery/cases/${created.caseId}`;
 const edited=ok(await f.call(base+'/draft',{auth:analyst,payload:{expectedVersion:1,draft:'Please apply the outstanding USD 1,500 credit under the original agreement.'}}));
 assert.equal(edited.draftVersion,2);assert.equal(edited.approval,null);
 assert.equal((await f.call(base+'/approve',{auth:analyst,payload:{expectedVersion:2}})).status,403,'analyst does not substitute for reviewer');
 assert.equal((await f.call(base+'/email',{auth:viewer})).status,409,'a saved draft is not an approved email');
 const approved=ok(await f.call(base+'/approve',{auth:approver,payload:{expectedVersion:2},key:'parity-recovery-approve'}));
 assert.equal(approved.draftVersion,3);assert.equal(approved.approval.actor.id,approver.user.id);assert.equal(approved.approvalCurrent,true);
 const eml=ok(await f.call(base+'/email',{auth:viewer}));assert.match(eml,/X-Unsent: 1/);assert.match(eml,/outstanding USD 1,500/);assert.ok(!eml.includes('Local reviewer'));
 const packet=ok(await f.call(base+'/packet',{auth:viewer}));assert.equal(packet.format,'truthful-evidence-packet-v1');assert.equal(await verifyCase(packet),true);assert.equal(packet.serverRecord.approval.actor.id,approver.user.id);
 const csv=ok(await f.call(base+'/csv',{auth:viewer}));assert.match(csv,/outstanding_cents/);assert.match(csv,/,150000,/);
 const replay=await f.call(base+'/approve',{auth:approver,payload:{expectedVersion:2},key:'parity-recovery-approve'});ok(replay);assert.equal(replay.replayed,'true');assert.deepEqual(replay.body,approved);
 const changed=ok(await f.call(base+'/draft',{auth:analyst,payload:{expectedVersion:3,draft:'Updated exact follow-up. No renewal is accepted.'}}));assert.equal(changed.draftVersion,4);assert.equal(changed.approvalCurrent,false);
 assert.equal((await f.call(base+'/email',{auth:viewer})).status,409);assert.equal((await f.call(base+'/email?version=3',{auth:viewer})).status,409,'historical approval cannot authorize a newly edited draft');
 const historical=ok(await f.call(base+'?version=3',{auth:viewer}));assert.equal(historical.historical,true);assert.equal(historical.approvalCurrent,false);assert.equal(historical.approval.actor.id,approver.user.id);
 assert.equal((await f.call(base+'/approve',{auth:approver,payload:{expectedVersion:3}})).status,409);
 await f.restart();const saved=ok(await f.call(base,{auth:viewer}));assert.equal(saved.draftVersion,4);assert.equal(saved.draft,changed.draft);assert.equal(saved.approvalCurrent,false);
 const reapproved=ok(await f.call(base+'/approve',{auth:approver,payload:{expectedVersion:4}}));assert.equal(reapproved.approvalCurrent,true);assert.match(ok(await f.call(base+'/email',{auth:viewer})),/Updated exact follow-up/);
 const listed=ok(await f.call('/api/recovery/cases?limit=1',{auth:viewer}));assert.equal(listed.items.length,1);assert.equal(listed.items[0].caseId,created.caseId);
 const workspace=ok(await f.call('/api/workspace',{auth:viewer}));assert.equal(workspace.revision,0);assert.equal(workspace.view.commitments.length,0,'draft approval does not promote evidence or create a financial effect');
 assert.equal(ok(await f.call('/api/ready',{auth:f.admin})).checks.find(check=>check.workspaceId===f.initial.workspace.id).recovery.valid,true);
});

test('HTTP authored explorer catalog, actual compare/repair, retained packet replay, custom plans and honest cutoff remain usable after restart',async t=>{
 const f=await managedHarness(t),viewer=await f.invite('viewer');
 const before=ok(await f.call('/api/workspace',{auth:f.admin}));
 const catalog=ok(await f.call('/api/explorer/scenarios',{auth:viewer}));assert.equal(catalog.items.length,5);assert.ok(catalog.items.some(s=>s.id==='concurrent-credit'));
 const authored=ok(await f.call('/api/explorer/scenarios/concurrent-credit',{auth:viewer})).scenario;assert.equal(authored.agents.length,2);
 const compared=ok(await f.call('/api/explorer/compare',{auth:f.admin,payload:{scenarioId:'concurrent-credit'},key:'parity-authored-compare'}));
 assert.equal(compared.origin,'authored');assert.equal(compared.report.naive.status,'unsafe_effect_found');assert.equal(compared.report.guarded.status,'no_unsafe_effect_within_bounds');assert.ok(compared.report.repair.report.goalCompletion.safeCompletedSchedules>0);
 const replayed=await f.call('/api/explorer/compare',{auth:f.admin,payload:{scenarioId:'concurrent-credit'},key:'parity-authored-compare'});ok(replayed);assert.equal(replayed.replayed,'true');assert.deepEqual(replayed.body,compared);
 const path=`/api/explorer/runs/${compared.runId}`,saved=ok(await f.call(path,{auth:viewer}));assert.deepEqual(saved.report,compared.report);
 const packet=ok(await f.call(path+'/packet?variant=naive',{auth:viewer}));assert.equal((await verifyExplorationPacket(packet)).valid,true);
 const verification=ok(await f.call('/api/explorer/verify',{auth:f.admin,payload:{runId:compared.runId,variant:'naive'}}));assert.equal(verification.valid,true);assert.equal(verification.packetDigest,packet.digest);
 const repaired=ok(await f.call(path+'/packet?variant=repair',{auth:viewer}));assert.equal((await verifyExplorationPacket(repaired)).valid,true);
 const custom=ok(await f.call('/api/explorer/compare',{auth:f.admin,payload:{plan:authored,bounds:{maxStates:300}}}));assert.equal(custom.origin,'custom');assert.equal(custom.scenario.metadata.origin,'user-supplied');assert.equal(custom.report.repair,null);
 assert.equal((await f.call(`/api/explorer/runs/${custom.runId}/packet?variant=repair`,{auth:viewer})).status,404);
 const cutoff=ok(await f.call('/api/explorer/run',{auth:f.admin,payload:{scenarioId:'concurrent-credit',mode:'guarded',bounds:{maxStates:1,maxTransitions:1}}}));assert.equal(cutoff.report.status,'inconclusive');assert.equal(cutoff.report.stats.inconclusive,true);assert.equal(cutoff.report.stats.exhaustiveWithinBounds,false);
 assert.equal(ok(await f.call('/api/explorer/verify',{auth:f.admin,payload:{runId:cutoff.runId}})).valid,true);
 const changed=structuredClone(packet);changed.stats.transitions++;
 const refused=ok(await f.call('/api/explorer/verify',{auth:f.admin,payload:{packet:changed}}));assert.equal(refused.valid,false);
 const after=ok(await f.call('/api/workspace',{auth:f.admin}));assert.deepEqual(after.workspace,before.workspace);assert.equal(after.revision,before.revision);
 await f.restart();const restored=ok(await f.call(path,{auth:viewer}));assert.equal(restored.runId,compared.runId);assert.ok(restored.verifications.some(result=>result.verificationId===verification.verificationId&&result.valid));
 const runs=ok(await f.call('/api/explorer/runs?limit=2',{auth:viewer}));assert.equal(runs.total,3);assert.equal(runs.items.length,2);assert.ok(runs.nextCursor);
 assert.equal(ok(await f.call('/api/ready',{auth:f.admin})).checks.find(check=>check.workspaceId===f.initial.workspace.id).explorer.valid,true);
});

test('HTTP portfolio exploration captures the actual approved case, retains immutable evidence, reports stale live state and rejects invalid requests',async t=>{
 const f=await managedHarness(t),evidence=ok(await f.call('/api/evidence',{auth:f.admin,payload:testDocuments()}));
 const imported=await f.workflow(f.admin,'evidence-import',{evidenceId:evidence.evidenceId,analysisVersion:1});
 const commitment=imported.body.view.commitments[0],actionId='product-parity-original-claim';
 const proposal=ok(await f.call('/api/commands',{auth:f.admin,payload:{expectedRevision:imported.body.revision,command:{type:'PROPOSE_ACTION',action:{id:actionId,commitmentId:commitment.id,type:'prepare_claim',payload:{}}}}}));
 const approved=ok(await f.call('/api/commands',{auth:f.admin,payload:{expectedRevision:proposal.revision,command:{type:'APPROVE_ACTION',actionId}}}));
 const copied=ok(await f.call('/api/explorer/compare',{auth:f.admin,payload:{portfolio:{actionId,adversary:'source_revision'},expectedRevision:approved.revision,bounds:{maxStates:300}}}));
 assert.equal(copied.origin,'portfolio');assert.equal(copied.capturedRevision,approved.revision);assert.equal(copied.liveSnapshotCurrent,true);assert.equal(copied.scenario.metadata.origin,'portfolio-copy');assert.equal(copied.scenario.metadata.actionId,actionId);
 assert.deepEqual(copied.scenario.initialState,approved.workspace);assert.equal(copied.report.naive.status,'unsafe_effect_found');assert.equal(copied.report.repair,null,'custom copied portfolios do not receive a made-up authored repair');
 assert.deepEqual(ok(await f.call('/api/workspace',{auth:f.admin})).workspace,approved.workspace,'contained run cannot mutate the financial workspace');
 const mutated=ok(await f.call('/api/commands',{auth:f.admin,payload:{expectedRevision:approved.revision,command:{type:'ADD_SOURCE',source:{id:'parity-later-evidence',vendorId:commitment.vendorId,title:'Later source observation',kind:'document',text:'A later supplied observation after the retained analysis.'}}}}));
 const current=ok(await f.call(`/api/explorer/runs/${copied.runId}`,{auth:f.admin}));assert.equal(current.liveSnapshotCurrent,false);assert.deepEqual(current.scenario.initialState,approved.workspace);assert.equal(current.currentRevision,mutated.revision);
 assert.equal((await f.call('/api/explorer/compare',{auth:f.admin,payload:{portfolio:{actionId,adversary:'none'},expectedRevision:approved.revision}})).status,409);
 assert.equal((await f.call('/api/explorer/compare',{auth:f.admin,payload:{portfolio:{actionId,adversary:'none'},expectedRevision:mutated.revision}})).status,409);
 for(const [payload,status]of [[{scenarioId:'missing'},404],[{scenarioId:'concurrent-credit',bounds:{maxStates:999999}},422],[{scenarioId:'concurrent-credit',plan:{}},422],[{plan:{schemaVersion:1,agents:[]}},422],[{scenarioId:'concurrent-credit',unexpected:true},422]])assert.equal((await f.call('/api/explorer/compare',{auth:f.admin,payload})).status,status,JSON.stringify(payload));
 const goodAgain=ok(await f.call('/api/explorer/run',{auth:f.admin,payload:{scenarioId:'concurrent-credit',mode:'guarded',bounds:{maxStates:1}}}));assert.equal(goodAgain.report.status,'inconclusive','failed inputs release computation capacity');
 await f.restart();const restored=ok(await f.call(`/api/explorer/runs/${copied.runId}`,{auth:f.admin}));assert.equal(restored.liveSnapshotCurrent,false);assert.deepEqual(restored.scenario.initialState,approved.workspace);
});
