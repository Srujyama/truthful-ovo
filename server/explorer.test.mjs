import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync,rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import * as engine from '../src/assurance/index.mjs';
import { createScenario,verifyExplorationPacket } from '../src/explorer/index.mjs';
import { createExplorerManager,EXPLORER_BOUNDS } from './explorer.mjs';

const analyst={actor:{id:'explorer-analyst',role:'analyst'}},viewer={actor:{id:'explorer-viewer',role:'viewer'}},admin={actor:{id:'explorer-admin',role:'admin'}};
let serial=0;const request=key=>({headers:{'idempotency-key':key||`explorer-request-${++serial}`}});
const rejects=(callback,code)=>assert.rejects(callback,error=>error.code===code);
const throws=(callback,code)=>assert.throws(callback,error=>error.code===code);
function harness(t,{path=':memory:',state=engine.createDemoWorkspace(),authorize}={}){
  const db=new DatabaseSync(path),controls={state,revision:0,now:'2026-11-08T12:00:00.000Z'};
  const read=()=>({state:controls.state,revision:controls.revision});
  const manager=createExplorerManager({db,now:()=>controls.now,read,engine,...(authorize?{authorize}:{})});
  let closed=false;const close=()=>{if(!closed){db.close();closed=true;}};t.after(close);
  return {db,manager,controls,read,close};
}
function approvedWorkspace(){return engine.reduceWorkspace(engine.createDemoWorkspace(),{id:'explorer-approve-live',type:'APPROVE_ACTION',actionId:'action-pipeline-preserve'},{actor:admin.actor,now:'2026-11-08T12:00:00.000Z'}).state;}

test('catalog exposes actual finite scenarios and explicit server compute bounds',t=>{
  const {manager}=harness(t),catalog=manager.scenarios(viewer);
  assert.equal(catalog.items.length,5);assert.deepEqual(catalog.maxBounds,EXPLORER_BOUNDS);
  assert.equal(catalog.limits.maxConcurrentComputations,1);
  const scenario=manager.getScenario(viewer,'concurrent-credit').scenario;
  assert.equal(scenario.agents.length,2);assert.equal(scenario.properties.length,2);
  throws(()=>manager.getScenario(viewer,'missing'),'SCENARIO_NOT_FOUND');
});

test('authored comparison persists actual unsafe witness, guarded boundary and explicit repair without live mutation',async t=>{
  const {manager,read}=harness(t),before=structuredClone(read());
  const result=await manager.compare(request(),analyst,{scenarioId:'concurrent-credit'});
  assert.equal(result.replayed,false);assert.equal(result.response.origin,'authored');
  assert.equal(result.response.liveSnapshotCurrent,null,'authored premises are not asserted as the live portfolio');
  assert.equal(result.response.report.naive.status,'unsafe_effect_found');
  assert.equal(result.response.report.guarded.status,'no_unsafe_effect_within_bounds');
  assert.ok(result.response.report.repair.report.goalCompletion.safeCompletedSchedules>0);
  assert.deepEqual(read(),before);
  const saved=manager.get(viewer,result.response.runId);
  assert.deepEqual(saved.report,result.response.report);assert.equal(saved.capturedRevision,0);
  assert.equal(manager.verifyIntegrity().valid,true);
});

test('a bounded cutoff remains inconclusive and its recorded prefix verifies independently',async t=>{
  const {manager}=harness(t);
  const run=await manager.run(request(),analyst,{scenarioId:'concurrent-credit',mode:'guarded',bounds:{maxStates:1,maxTransitions:1}});
  assert.equal(run.response.report.status,'inconclusive');assert.equal(run.response.report.stats.exhaustiveWithinBounds,false);
  assert.equal(run.response.report.stats.cutoffReason,'maxStates');
  const verification=await manager.verify(request(),analyst,{runId:run.response.runId});
  assert.equal(verification.response.valid,true);
  assert.equal(manager.get(viewer,run.response.runId).verifications.length,1);
});

test('custom plans remain supplied premises and receive no invented fixture repair',async t=>{
  const {manager}=harness(t),plan=createScenario('benign-completion');plan.name='User supplied plan';plan.metadata={origin:'portfolio-copy'};
  const result=await manager.compare(request(),analyst,{plan});
  assert.equal(result.response.origin,'custom');assert.equal(result.response.scenario.metadata.origin,'user-supplied');
  assert.equal(result.response.report.repair,null);assert.match(result.response.report.repairReason,/No template repair/);
  assert.equal(result.response.report.guarded.goalCompletion.safeCompletedSchedules,1);
});

test('portfolio exploration captures the exact approved state and labels later live divergence',async t=>{
  const {manager,controls,read}=harness(t,{state:approvedWorkspace()}),before=structuredClone(read());
  const result=await manager.compare(request(),analyst,{portfolio:{actionId:'action-pipeline-preserve',adversary:'source_revision'},expectedRevision:0});
  assert.equal(result.response.origin,'portfolio');assert.equal(result.response.liveSnapshotCurrent,true);
  assert.equal(result.response.scenario.metadata.actionId,'action-pipeline-preserve');
  assert.equal(result.response.scenario.metadata.snapshotRevision,before.state.revision);
  assert.equal(result.response.report.naive.status,'unsafe_effect_found');
  assert.equal(result.response.report.repair,null);
  assert.deepEqual(read(),before);
  controls.state=engine.reduceWorkspace(controls.state,{id:'later-source',type:'REVISE_SOURCE',sourceId:'pipeline-promise',text:'Later live evidence.'},{actor:admin.actor,now:controls.now}).state;controls.revision++;
  assert.equal(manager.get(viewer,result.response.runId).liveSnapshotCurrent,false);
  await rejects(()=>manager.run(request(),analyst,{portfolio:{actionId:'action-pipeline-preserve'},expectedRevision:0}),'REVISION_CONFLICT');
  await rejects(()=>manager.run(request(),analyst,{portfolio:{actionId:'action-pipeline-preserve'},expectedRevision:1}),'STALE_APPROVAL');
});

test('portfolio execution premises require actual existing approval and do not invent deadline events',async t=>{
  const {manager}=harness(t);
  await rejects(()=>manager.run(request(),analyst,{portfolio:{actionId:'action-pipeline-preserve'},expectedRevision:0}),'ACTION_UNAPPROVED');
  await rejects(()=>manager.run(request(),analyst,{portfolio:{actionId:'action-pipeline-preserve'}}),'REVISION_REQUIRED');
  const approved=harness(t,{state:approvedWorkspace()});
  await rejects(()=>approved.manager.run(request(),analyst,{portfolio:{actionId:'action-pipeline-preserve',adversary:'deadline'},expectedRevision:0}),'DEADLINE_NOT_APPLICABLE');
  await rejects(()=>approved.manager.run(request(),analyst,{portfolio:{actionId:'action-pipeline-preserve',now:'2026-10-01T12:00:00Z'},expectedRevision:0}),'INCONSISTENT_TIME');
});

test('read-only identities inspect stored reports but cannot launch run, compare or replay compute',async t=>{
  const {manager}=harness(t),result=await manager.run(request(),analyst,{scenarioId:'benign-completion'});
  assert.equal(manager.get(viewer,result.response.runId).runId,result.response.runId);
  assert.equal(manager.list(viewer).items.length,1);
  for(const method of ['run','compare'])await rejects(()=>manager[method](request(),viewer,{scenarioId:'benign-completion'}),'FORBIDDEN');
  await rejects(()=>manager.verify(request(),viewer,{runId:result.response.runId}),'FORBIDDEN');
});

test('computation reauthorizes before persistence and releases its lease after a role change',async t=>{
  let calls=0;const {manager,db}=harness(t,{authorize:(_req,_auth,callback)=>callback(++calls===1?analyst:viewer)});
  await rejects(()=>manager.run(request(),analyst,{scenarioId:'benign-completion'}),'FORBIDDEN');
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM explorer_runs').get().count,0);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM explorer_lease').get().count,0);
});

test('compute admission is bounded and a failed plan does not leave the server busy',async t=>{
  const {manager,db}=harness(t);
  db.prepare('INSERT INTO explorer_lease VALUES(1,?,?)').run('another-process','2026-11-08T12:01:00.000Z');
  await rejects(()=>manager.run(request(),analyst,{scenarioId:'benign-completion'}),'EXPLORER_BUSY');
  db.prepare('DELETE FROM explorer_lease').run();
  const bad=createScenario('benign-completion');bad.agents[0].steps[0].kind='not-supported';
  await rejects(()=>manager.run(request(),analyst,{plan:bad}),'EXPLORER_VALIDATION');
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM explorer_lease').get().count,0);
  assert.equal((await manager.run(request(),analyst,{scenarioId:'benign-completion'})).response.report.goalCompletion.safeCompletedSchedules,1);
});

test('run lists filter and page consistently without returning every full report',async t=>{
  const {manager}=harness(t);
  for(let i=0;i<3;i++)await manager.run(request(),analyst,{scenarioId:'benign-completion'});
  const first=manager.list(viewer,{limit:'2',kind:'run',origin:'authored'});
  assert.equal(first.items.length,2);assert.ok(first.nextCursor);assert.ok(!Object.hasOwn(first.items[0],'report'));
  const second=manager.list(viewer,{limit:'2',kind:'run',origin:'authored',cursor:first.nextCursor});
  assert.equal(second.items.length,1);assert.equal(new Set([...first.items,...second.items].map(row=>row.runId)).size,3);
  assert.equal(manager.list(viewer,{actorId:'no-such-actor'}).items.length,0);
  throws(()=>manager.list(viewer,{limit:'101'}),'EXPLORER_VALIDATION');
  await manager.run(request(),analyst,{scenarioId:'benign-completion'});
  throws(()=>manager.list(viewer,{limit:'2',kind:'run',origin:'authored',cursor:first.nextCursor}),'CURSOR_STALE');
});

test('exported packets preserve independent replay and unsupported repair exports are explicit',async t=>{
  const {manager}=harness(t),comparison=await manager.compare(request(),analyst,{scenarioId:'stale-source'});
  for(const variant of ['naive','guarded','repair'])assert.equal((await verifyExplorationPacket(manager.packet(viewer,comparison.response.runId,{variant}))).valid,true);
  const custom=await manager.compare(request(),analyst,{plan:createScenario('benign-completion')});
  throws(()=>manager.packet(viewer,custom.response.runId,{variant:'repair'}),'REPAIR_NOT_AVAILABLE');
  throws(()=>manager.packet(viewer,comparison.response.runId,{variant:'unknown'}),'EXPLORER_VARIANT');
});

test('tampered supplied packets are retained as failed verification rather than accepted as proof',async t=>{
  const {manager}=harness(t),run=await manager.run(request(),analyst,{scenarioId:'benign-completion'});
  const packet=manager.packet(viewer,run.response.runId);packet.status='unsafe_effect_found';
  const result=await manager.verify(request(),analyst,{packet});
  assert.equal(result.response.valid,false);assert.match(result.response.errors.join(' '),/digest mismatch/);
  assert.equal(manager.verifyIntegrity().valid,true);
});

test('requests are idempotent across restart and changed input cannot reuse a computation key',async t=>{
  const directory=mkdtempSync(join(tmpdir(),'truthful-explorer-'));t.after(()=>rmSync(directory,{recursive:true,force:true}));
  const path=join(directory,'explorer.sqlite'),first=harness(t,{path}),req=request('persistent-explorer-key');
  const recorded=await first.manager.run(req,analyst,{scenarioId:'benign-completion'});first.close();
  const second=harness(t,{path});second.controls.now='2026-11-09T12:00:00.000Z';
  const replay=await second.manager.run(req,analyst,{scenarioId:'benign-completion'});
  assert.equal(replay.replayed,true);assert.deepEqual(replay.response,recorded.response);
  await rejects(()=>second.manager.run(req,analyst,{scenarioId:'stale-source'}),'IDEMPOTENCY_CONFLICT');
  assert.equal(second.manager.list(viewer).items.length,1);
});

test('malformed selectors, unsupported budgets and oversized custom plans fail before admission',async t=>{
  const {manager,db}=harness(t);
  for(const input of [{},{scenarioId:'benign-completion',plan:{}},{scenarioId:'benign-completion',mode:'unsafe'},{scenarioId:'benign-completion',expectedRevision:'0'},{scenarioId:'benign-completion',bounds:{maxStates:2001}},{scenarioId:'benign-completion',bounds:{maxDepth:0}},{scenarioId:'benign-completion',bounds:{unknown:1}},{scenarioId:'benign-completion',actor:{role:'admin'}}])await assert.rejects(()=>manager.run(request(),analyst,input));
  const huge=createScenario('benign-completion');huge.description='a'.repeat(250001);
  await rejects(()=>manager.run(request(),analyst,{plan:huge}),'EXPLORER_INPUT_LIMIT');
  await rejects(()=>manager.run({headers:{}},analyst,{scenarioId:'benign-completion'}),'IDEMPOTENCY_KEY_REQUIRED');
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM explorer_runs').get().count,0);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM explorer_lease').get().count,0);
});

test('stored run and replay metadata corruption is detected without claiming external authenticity',async t=>{
  const {manager,db}=harness(t),run=await manager.run(request(),analyst,{scenarioId:'benign-completion'});
  await manager.verify(request(),analyst,{runId:run.response.runId});
  assert.equal(manager.verifyIntegrity().valid,true);
  db.prepare("UPDATE explorer_verifications SET result_json='{}'").run();
  assert.equal(manager.verifyIntegrity().valid,false);
  throws(()=>manager.get(viewer,run.response.runId),'EXPLORER_INTEGRITY');
  db.prepare("UPDATE explorer_runs SET report_json='{}' WHERE id=?").run(run.response.runId);
  throws(()=>manager.get(viewer,run.response.runId),'EXPLORER_INTEGRITY');
});
