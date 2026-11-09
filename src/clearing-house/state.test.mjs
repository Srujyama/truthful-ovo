import test from 'node:test';
import assert from 'node:assert/strict';
import {createDemoWorkspace,createWorkspace,reduceWorkspace,evaluateWorkspace} from '../assurance/index.mjs';
import {deriveClearingHouse,eventRoute,STATIONS,money} from './state.mjs';
import {createBuilding} from './models.mjs';
import {cameraFor,screenPoint,project,createSceneClock} from './renderer.mjs';
const now='2026-11-09T12:00:00.000Z';
test('world balances and station records come from actual model; issued credit does not become verified',()=>{
 const state=createDemoWorkspace(),world=deriveClearingHouse(state,{asOf:'2026-11-09',knownAt:now});assert.deepEqual(world.totals,world.view.totals);assert.equal(world.stations.find(s=>s.id==='vault').count,0);assert.equal(world.totals.verifiedCents,90000);assert.equal(world.totals.issuedCents,200000);
 const credits=world.stations.find(s=>s.id==='exchange');assert.equal(credits.count,world.view.credits.length);assert(credits.items.some(c=>c.state==='Issued, not applied'));assert(world.stations.find(s=>s.id==='review').items.every(a=>world.view.actions.some(v=>v.id===a.actionId&&!v.executed)));
 const original=state.events.find(e=>e.type==='CREDIT_ALLOCATED'&&e.payload.allocation.creditId==='credit-nimbus-2000');assert.equal(eventRoute(original,world.view).to.id,'exchange','issued attribution never travels into verified vault');
});
test('empty workspace does not invent cases, activity, totals or approved actions',()=>{
 const empty=deriveClearingHouse(createWorkspace(),{asOf:'2026-11-09',knownAt:now});assert(empty.stations.every(s=>s.count===0));assert.equal(empty.activity.length,0);assert.equal(empty.totals.verifiedCents,0);assert.equal(empty.transition,null);
 const missing=deriveClearingHouse(null);assert.equal(missing.view,null);assert.equal(missing.totals,null);assert(missing.stations.every(s=>s.state==='empty'));
});
test('world history respects financial and knowledge cutoffs and exact source revisions',()=>{
 const state=createDemoWorkspace(),old=deriveClearingHouse(state,{asOf:'2026-09-19',knownAt:'2026-09-19T23:59:59.999Z'});assert.equal(old.totals.verifiedCents,0);assert.equal(old.stations.find(s=>s.id==='exchange').count,0);
 for(const s of old.stations.find(s=>s.id==='archive').items)assert(old.view.sourceVersions.some(v=>v.id===s.sourceId&&v.revision===s.revision));assert(old.activity.every(e=>e.at<='2026-09-19T23:59:59.999Z'));
});
test('fulfillment reaches the vault only after an actual applied invoice backs the exact allocation',()=>{
 let state=createDemoWorkspace();state=reduceWorkspace(state,{type:'ADD_SOURCE',source:{id:'nimbus-applied-invoice',vendorId:'nimbus',title:'Applied invoice',kind:'invoice',text:'Invoice records USD2000 applied for NC-SLA-2026.'}},{actor:{id:'test-admin',role:'admin'},now}).state;state=reduceWorkspace(state,{type:'APPLY_CREDIT',creditId:'credit-nimbus-2000',sourceIds:['nimbus-applied-invoice']},{actor:{id:'test-admin',role:'admin'},now}).state;
 const model=deriveClearingHouse(state,{asOf:'2026-11-09',knownAt:now});assert.equal(model.totals.verifiedCents,290000);assert(model.stations.find(s=>s.id==='vault').items.some(i=>i.commitmentId==='nimbus-sla'));assert.equal(model.stations.find(s=>s.id==='exchange').items.find(i=>i.id==='credit-nimbus-2000').state,'Applied on invoice');
});
test('original geometry is deterministic, distinct and finite; camera anchors align at any viewport',()=>{
 const fingerprints=new Set();for(const s of STATIONS){const model=createBuilding(s.kind);assert(model.parts.length>50);fingerprints.add(JSON.stringify(model));assert.deepEqual(model,createBuilding(s.kind));for(const p of model.parts){assert(['box','roof','cylinder'].includes(p.shape));assert(Object.values(p).filter(v=>typeof v==='number').every(Number.isFinite));assert(p.h>0);}}
 assert.equal(fingerprints.size,6);for(const [width,height]of [[1000,650],[390,420]]){const focus=STATIONS[1],camera=cameraFor(width,height,{focus}),point=screenPoint(focus,camera);assert.equal(point.x,width/2);assert.equal(point.y,height/2);}assert.deepEqual(project(0,0,0),[0,0]);
});

test('world totals retain exact cents instead of rounding small recorded credits away',()=>{assert.equal(money(49),'$0.49');assert.equal(money(100),'$1');assert.equal(money(199),'$1.99');});

// The detailed ledger opens at today's cutoffs, not the last fixture event.
test('default world and current ledger use the same financial and knowledge day',()=>{const state=createDemoWorkspace(),day=new Date().toISOString().slice(0,10),ledger=evaluateWorkspace(state,{asOf:day,knownAt:`${day}T23:59:59.999Z`}),world=deriveClearingHouse(state);assert.deepEqual(world.totals,ledger.totals);assert.equal(world.view.asOf,day);assert.equal(world.view.knownAt,ledger.knownAt);});

test('the actual scene clock excludes paused and background time while preserving remaining travel',()=>{const clock=createSceneClock();assert.equal(clock.step(1000),0);assert.equal(clock.step(1150),150);clock.suspend();assert.equal(clock.step(9000),0);assert.equal(clock.elapsed,150);assert.equal(clock.step(9050),50);assert.equal(clock.step(9300,false),0);assert.equal(clock.step(19000,false),0);assert.equal(clock.step(20000),0);assert.equal(clock.step(20100),100);assert.equal(clock.elapsed,300);});
