import test from 'node:test';
import assert from 'node:assert/strict';
import {createDemoWorkspace} from '../assurance/fixtures.mjs';
import {createWorkspace,reduceWorkspace,canonical} from '../assurance/core.mjs';
import {createPortfolioScenario} from './portfolio.mjs';
import {compareScenario,explorePlan,repairPlan,verifyExplorationPacket} from './index.mjs';
const now='2026-10-29T12:00:00.000Z',approver={id:'actual-test-finance',role:'approver'};
function approved(actionId='action-nimbus-claim'){
 const workspace=createDemoWorkspace();return reduceWorkspace(workspace,{id:'actual-test-approval',type:'APPROVE_ACTION',actionId},{actor:approver,now}).state;
}
function change(state,command,actor={id:'actual-test-analyst',role:'analyst'}){return reduceWorkspace(state,command,{actor,now}).state;}

test('actual approved portfolio copy completes without an adversary and remains unchanged',async()=>{
 const state=approved(),original=canonical(state),plan=createPortfolioScenario(state,{actionId:'action-nimbus-claim',now});
 assert.equal(canonical(state),original);assert.notEqual(plan.initialState,state);assert.deepEqual(plan.initialState,state);assert.equal(plan.metadata.origin,'portfolio-copy');assert.equal(plan.metadata.actionId,'action-nimbus-claim');assert.equal(plan.metadata.reference,'NC-SLA-2026');assert.equal(plan.metadata.snapshotRevision,state.revision);assert.ok(plan.metadata.sourceRevisionIds.length);assert.equal(plan.agents[0].actor.role,'executor');assert.equal(plan.initialState.events.filter(e=>e.type==='ACTION_APPROVED').length,1);
 const p=await explorePlan(plan);assert.equal(p.goalCompletion.safeCompletedSchedules,1);assert.equal((await verifyExplorationPacket(JSON.parse(JSON.stringify(p)))).valid,true);assert.equal(canonical(state),original);assert.equal(repairPlan(plan),null);
});
test('hypothetical source revision uses an actual source and yields paired unsafe/rejected traces',async()=>{
 const state=approved(),original=canonical(state),plan=createPortfolioScenario(state,{actionId:'action-nimbus-claim',adversary:'source_revision',now});
 const cmd=plan.agents[1].steps[0].command,source=state.events.filter(e=>e.payload.source?.id===cmd.sourceId).at(-1).payload.source;assert.ok(cmd.text.startsWith('HYPOTHETICAL SIMULATION ONLY'));assert.ok(cmd.text.endsWith(source.text));assert.equal(plan.agents[1].actor.role,'analyst');
 const c=await compareScenario(plan);assert.equal(c.naive.shortestWitness.schedule.length,3);assert.equal(c.naive.shortestWitness.trace.at(-1).oracle.error.code,'STALE_APPROVAL');assert.equal(c.guarded.shortestWitness,null);assert.equal(c.guarded.goalCompletion.blockedOrIncompleteSchedules,2);assert.equal(c.repair,null);assert.equal((await verifyExplorationPacket(c.naive)).valid,true);assert.equal(canonical(state),original);
});
test('deadline adversary uses actual claim deadline and preserves both execution orders',async()=>{
 const plan=createPortfolioScenario(approved(),{actionId:'action-nimbus-claim',adversary:'deadline',now});assert.equal(plan.metadata.deadlineAdvance,'2026-10-31T00:00:00.000Z');assert.equal(plan.agents[1].steps[0].after,undefined);
 const c=await compareScenario(plan);assert.equal(c.guarded.stats.terminalSchedules,3);assert.equal(c.guarded.goalCompletion.safeCompletedSchedules,1);assert.equal(c.guarded.goalCompletion.blockedOrIncompleteSchedules,2);assert.equal(c.naive.shortestWitness.trace.at(-1).oracle.error.code,'POLICY_BLOCKED');assert.equal((await verifyExplorationPacket(c.guarded)).valid,true);
});
test('rejects unapproved, stale, executed, wrong workspace and inconsistent time',()=>{
 const s=createDemoWorkspace();assert.throws(()=>createPortfolioScenario(s,{actionId:'action-nimbus-claim',now}),{code:'ACTION_UNAPPROVED'});
 const a=approved(),stale=change(a,{id:'actual-source-update',type:'REVISE_SOURCE',sourceId:'nimbus-contract',text:'Actual test update invalidates prior approval.'});assert.throws(()=>createPortfolioScenario(stale,{actionId:'action-nimbus-claim',now}),{code:'STALE_APPROVAL'});
 const executed=change(a,{id:'actual-test-execute',type:'EXECUTE_ACTION',actionId:'action-nimbus-claim'},{id:'actual-test-executor',role:'executor'});assert.throws(()=>createPortfolioScenario(executed,{actionId:'action-nimbus-claim',now}),{code:'ACTION_EXECUTED'});
 assert.throws(()=>createPortfolioScenario(createWorkspace(),{actionId:'action-nimbus-claim',now}),{code:'ACTION_NOT_FOUND'});assert.throws(()=>createPortfolioScenario(a,{actionId:'action-nimbus-claim',now:'2026-10-28T12:00:00Z'}),{code:'INCONSISTENT_TIME'});assert.throws(()=>createPortfolioScenario(a,{actionId:'action-nimbus-claim',adversary:'deadline',now:'2026-10-31T12:00:00Z'}),{code:'DEADLINE_EXPIRED'});
});
test('deadline is not invented for an approved action without an applicable deadline',()=>{
 assert.throws(()=>createPortfolioScenario(approved('action-pipeline-preserve'),{actionId:'action-pipeline-preserve',adversary:'deadline',now}),{code:'DEADLINE_NOT_APPLICABLE'});
 let state=change(createDemoWorkspace(),{id:'actual-propose-no-deadline',type:'PROPOSE_ACTION',action:{id:'no-deadline-claim',commitmentId:'pipeline-seats',type:'prepare_claim',payload:{}}});state=change(state,{id:'actual-approve-no-deadline',type:'APPROVE_ACTION',actionId:'no-deadline-claim'},approver);assert.throws(()=>createPortfolioScenario(state,{actionId:'no-deadline-claim',adversary:'deadline',now}),{code:'DEADLINE_UNAVAILABLE'});
});
test('simulation command IDs remain stable and avoid existing request collisions',()=>{
 const a=approved(),first=createPortfolioScenario(a,{actionId:'action-nimbus-claim',adversary:'source_revision',now}),second=createPortfolioScenario(a,{actionId:'action-nimbus-claim',adversary:'source_revision',now});assert.deepEqual(first,second);const existing=new Set(a.events.map(e=>e.commandId));for(const agent of first.agents)for(const step of agent.steps)if(step.command)assert.equal(existing.has(step.command.id),false);
});

test('copied approval and every revision remain tied to the contained actual snapshot',()=>{
 const state=approved(),plan=createPortfolioScenario(state,{actionId:'action-nimbus-claim',adversary:'source_revision',now});const originalApproval=state.events.find(e=>e.type==='ACTION_APPROVED').payload.approval.basis;assert.deepEqual(plan.metadata.approvalBasis,originalApproval);assert.equal(plan.metadata.workspaceId,state.id);assert.deepEqual(plan.metadata.sourceRevisionIds,originalApproval.sourceRevisions);assert.match(plan.metadata.assumptionNotice,/not authenticated grants/);assert.match(plan.fixture,/hypothetical/);
});

test('explicit current simulation time is required instead of using the last observation date',()=>{
 const state=approved();assert.throws(()=>createPortfolioScenario(state,{actionId:'action-nimbus-claim'}),{code:'INVALID_TIME'});assert.throws(()=>createPortfolioScenario(state,{actionId:'action-nimbus-claim',now:''}),{code:'INVALID_TIME'});assert.throws(()=>createPortfolioScenario(state,{actionId:'action-nimbus-claim',now:'2026-10-29'}),{code:'INVALID_TIME'});assert.throws(()=>createPortfolioScenario(state,{actionId:'action-nimbus-claim',adversary:'deadline',now:'2026-10-31T12:00:00Z'}),{code:'DEADLINE_EXPIRED'});
});
