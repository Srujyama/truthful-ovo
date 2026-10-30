import test from 'node:test';
import assert from 'node:assert/strict';
import {compareScenario,explorePlan,repairPlan,scenarioCatalog,verifyExplorationPacket} from './index.mjs';

test('BFS retains shortest replayable actual stale and credit unsafe effects',async()=>{
 for(const [id,length] of [['concurrent-credit',4],['stale-source',3]]){
 const p=await explorePlan(id,{mode:'naive'});assert.equal(p.shortestWitness.schedule.length,length);assert.ok(p.shortestWitness.trace.at(-1).effects.length);assert.equal(p.shortestWitness.trace.at(-1).oracle.allowed,false);assert.ok(p.shortestWitness.unsafeEffects.length);assert.equal((await verifyExplorationPacket(p)).valid,true);
 }
});
test('program-order exploration covers exactly six 2-by-2 credit interleavings',async()=>{
 const p=await explorePlan('concurrent-credit',{mode:'guarded'});assert.equal(p.stats.terminalSchedules,6);assert.equal(p.stats.exhaustiveWithinBounds,true);assert.equal(p.shortestWitness,null);assert.equal(p.stats.unsafeSchedules,0);assert.equal(p.goalCompletion.safeCompletedSchedules,6);assert.ok(p.guardedRejection);assert.ok(p.guardedRejection.trace.at(-1).error.code==='INSUFFICIENT_CREDIT');
});
test('bounded resource exhaustion is inconclusive and never a clean guarantee',async()=>{
 for(const bounds of [{maxDepth:1},{maxStates:2},{maxTransitions:1}]){
 const p=await explorePlan('concurrent-credit',{bounds});assert.equal(p.status,'inconclusive');assert.equal(p.stats.inconclusive,true);assert.equal(p.stats.exhaustiveWithinBounds,false);assert.ok(p.stats.cutoffReason);assert.equal((await verifyExplorationPacket(p)).valid,true);
 }
});
test('packet validator rejects changed trace, plan, property and summary',async()=>{
 const p=await explorePlan('stale-source',{mode:'naive'});
 for(const mutate of [x=>x.shortestWitness.schedule.reverse(),x=>x.scenario.agents[0].actor.role='admin',x=>x.propertyVersion='invented-proof',x=>x.scenario.properties=['nothing'],x=>x.goalCompletion.completedSchedules=999]){
 const bad=structuredClone(p);mutate(bad);assert.equal((await verifyExplorationPacket(bad)).valid,false);
 }
});
test('guarded execution rejects invalid attempts without unsafe effects, and repairs finish legitimate work',async()=>{
 for(const s of scenarioCatalog){
 const c=await compareScenario(s.id);assert.equal(c.guarded.shortestWitness,null,s.id);assert.equal(c.guarded.stats.unsafeSchedules,0,s.id);assert.equal(c.repair.report.shortestWitness,null,s.id);assert.ok(c.repair.report.goalCompletion.safeCompletedSchedules>0,s.id);assert.equal(c.repair.report.goalCompletion.blockedOrIncompleteSchedules,s.id==='deadline-drift'?1:0,s.id);assert.equal((await verifyExplorationPacket(c.repair.report)).valid,true,s.id);
 }
});
test('repairs retain explicit approver authority and never assign it to executor',()=>{
 for(const id of ['stale-source','competing-amendments']){
 const s=repairPlan(id);const approver=s.agents.find(a=>a.steps.some(x=>x.command?.type==='APPROVE_ACTION'));assert.equal(approver.actor.role,'approver');assert.ok(s.agents.find(a=>a.actor.role==='executor').steps.every(x=>x.command?.type!=='APPROVE_ACTION'));assert.ok(s.initialState.events.every(e=>e.actor.id==='synthetic-fixture-curator'));
 }
});
test('digest is deterministic for completed fixed-bound explorations',async()=>{
 const a=await explorePlan('stale-source');const b=await explorePlan('stale-source');assert.equal(a.digest,b.digest);
});

test('deadline repair preserves adverse clock order and reports partial completion',async()=>{
 const c=await compareScenario('deadline-drift');const p=c.repair.report;assert.equal(p.stats.terminalSchedules,2);assert.equal(p.goalCompletion.safeCompletedSchedules,1);assert.equal(p.goalCompletion.blockedOrIncompleteSchedules,1);assert.equal(p.guardedRejection.trace.at(-1).error.code,'POLICY_BLOCKED');assert.equal(c.repair.plan.agents[1].steps[0].after,undefined);
});
async function resign(p){const {digest,...body}=p;const {canonical}=await import('../assurance/core.mjs');p.digest=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(body)))).toString('hex');return p;}
test('recomputed digest cannot promote wall-time cutoff to exhaustive safety or alter fixture authority',async()=>{
 const p=await explorePlan('stale-source',{mode:'naive'});
 for(const mutate of [x=>{x.stats.cutoffReason='maxTimeMs';x.stats.exhaustiveWithinBounds=true;x.stats.inconclusive=false;x.status='no_unsafe_effect_within_bounds';},x=>x.mode='invented',x=>x.scenario.goal.actionId='missing',x=>x.scenario.agents[0].actor.role='admin',x=>x.shortestWitness.trace.at(-1).oracle.allowed=true,x=>x.schemaVersion=2]){const bad=structuredClone(p);mutate(bad);await resign(bad);assert.equal((await verifyExplorationPacket(bad)).valid,false);}
});
test('oversized plan and resource requests fail with actionable messages',async()=>{
 const {createScenario}=await import('./index.mjs');const s=createScenario('stale-source');s.agents=Array(9).fill(s.agents[0]);await assert.rejects(explorePlan(s),/Invalid bounded plan/);await assert.rejects(explorePlan('stale-source',{bounds:{maxStates:999999999}}),/Invalid bound maxStates/);
});
test('forged time-cutoff completion is rejected by deterministic prefix replay',async()=>{
 const p=await explorePlan('stale-source',{mode:'guarded',bounds:{maxDepth:1}});p.stats.cutoffReason='maxTimeMs';p.stats.terminalSchedules=1;p.goalCompletion={completedSchedules:1,safeCompletedSchedules:1,blockedOrIncompleteSchedules:0,terminalSchedules:1};await resign(p);assert.equal((await verifyExplorationPacket(p)).valid,false);
});
test('actual time cutoff verifies the same deterministic explored prefix',async()=>{
 const p=await explorePlan('concurrent-credit',{mode:'guarded',bounds:{maxTimeMs:1}});assert.equal(p.stats.cutoffReason,'maxTimeMs');assert.equal(p.stats.inconclusive,true);assert.equal((await verifyExplorationPacket(p)).valid,true);
});
test('credit repair preserves both distinct economic intents and rejects exhausted capacity',async()=>{
 const {createScenario}=await import('./index.mjs');const original=createScenario('concurrent-credit'),fixed=repairPlan(original);assert.deepEqual(fixed.agents.map(a=>a.steps[0].command),original.agents.map(a=>a.steps[0].command));assert.notEqual(fixed.agents[0].steps[0].command.id,fixed.agents[1].steps[0].command.id);const p=await explorePlan(fixed);assert.equal(p.stats.terminalSchedules,2);assert.equal(p.goalCompletion.safeCompletedSchedules,2);assert.equal(p.stats.rejectedEffectAttempts,2);assert.equal(p.stats.unauthorizedEffectTransitions,0);
});
test('custom JSON plans explore and verify without an invented template repair',async()=>{
 const {createScenario}=await import('./index.mjs');const custom=createScenario('benign-completion');custom.id='custom-approved-claim';custom.name='User supplied finite plan';const c=await compareScenario(custom);assert.equal(c.repair,null);assert.match(c.repairReason,/custom/);assert.equal(c.guarded.goalCompletion.safeCompletedSchedules,1);assert.equal((await verifyExplorationPacket(c.guarded)).valid,true);const changed=createScenario('stale-source');changed.name='Edited premise';assert.equal(repairPlan(changed),null);
});
