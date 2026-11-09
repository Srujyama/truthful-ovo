import test from 'node:test';
import assert from 'node:assert/strict';
import {selectFollowups} from './followups-ui.mjs';
import {createDemoWorkspace} from './assurance/fixtures.mjs';
import {evaluateWorkspace} from './assurance/index.mjs';
const demo=()=>evaluateWorkspace(createDemoWorkspace(),{asOf:'2026-11-09',knownAt:'2026-11-09T23:59:59.999Z'});
test('filter counts reconcile with the actual finance fixture, including expired owed and conditional value',()=>{
  const view=demo(), before=JSON.stringify(view), result=selectFollowups(view);
  assert.deepEqual(result.counts,{all:4,owed:3,issued:1,conditional:1,completed:0});
  assert.deepEqual(selectFollowups(view,{filter:'owed'}).rows.map(c=>c.id),['nimbus-sla','pipeline-seats','parcel-waiver']);
  assert.equal(selectFollowups(view,{filter:'owed'}).rows.find(c=>c.id==='nimbus-sla').status,'deadline_expired');
  assert.equal(selectFollowups(view,{filter:'conditional'}).rows[0].id,'orbit-renewal');
  assert.equal(selectFollowups(view,{filter:'issued'}).rows[0].id,'nimbus-sla');
  assert.equal(JSON.stringify(view),before);
});
test('query, status and money sort compose while counters describe the searched results',()=>{
  const view=demo();
  assert.deepEqual(selectFollowups(view,{query:'  pc-seats ',filter:'owed',sort:'owed-desc'}).rows.map(c=>c.id),['pipeline-seats']);
  assert.deepEqual(selectFollowups(view,{query:'pipeline'}).counts,{all:1,owed:1,issued:0,conditional:0,completed:0});
  assert.equal(selectFollowups(view,{query:'pipeline',filter:'issued'}).rows.length,0);
  assert.deepEqual(selectFollowups(view,{query:'unknown'}).counts,{all:0,owed:0,issued:0,conditional:0,completed:0});
  assert.deepEqual(selectFollowups(view,{filter:'owed',sort:'owed-desc'}).rows.map(c=>c.outstandingCents),[200000,150000,35000]);
  assert.deepEqual(selectFollowups(view,{sort:'owed-asc'}).rows.map(c=>c.id),['orbit-renewal','parcel-waiver','pipeline-seats','nimbus-sla']);
  assert.deepEqual(selectFollowups(view,{sort:'owed-desc'}).rows.map(c=>c.id),['nimbus-sla','pipeline-seats','parcel-waiver','orbit-renewal']);
  assert.equal(selectFollowups(view,{sort:'applied-desc'}).rows[0].id,'pipeline-seats');
});
test('date sort uses due dates and never silently treats conditional zero or a future case as completed',()=>{
  const view=demo();
  const conditional={...view.commitments.find(c=>c.id==='orbit-renewal'),outstandingCents:0};
  const completed={...view.commitments.find(c=>c.id==='pipeline-seats'),id:'done',outstandingCents:0,verifiedCents:240000,status:'verified'};
  const scheduled={...view.commitments.find(c=>c.id==='parcel-waiver'),id:'future',dueDate:'2027-01-01',status:'scheduled'};
  const changed={...view,commitments:[conditional,completed,scheduled]};
  assert.deepEqual(selectFollowups(changed,{filter:'completed'}).rows.map(c=>c.id),['done']);
  assert.deepEqual(selectFollowups(changed,{filter:'owed'}).rows.map(c=>c.id),['future']);
  assert.equal(selectFollowups(changed,{sort:'due-desc'}).rows[0].id,'future');
  assert.equal(selectFollowups(changed,{sort:'due-asc'}).rows[0].id,'done');
});
