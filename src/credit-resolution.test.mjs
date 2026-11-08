import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkspace, evaluateWorkspace, reduceWorkspace, validateWorkspace } from './assurance/index.mjs';
import { prepareCreditResolution } from './credit-resolution.mjs';

const now = '2026-11-07T12:00:00.000Z';
const admin = {id:'admin',role:'admin'};
const analyst = {id:'analyst',role:'analyst'};
const approver = {id:'approver',role:'approver'};
let serial = 0;
function apply(state, command, actor = admin, at = now) {
  return reduceWorkspace(state,{id:`test-${++serial}`,...command},{actor,now:at}).state;
}
function fixture({ second = true, allocated = 0 } = {}) {
  let state = createWorkspace();
  const early = '2026-10-01T12:00:00.000Z';
  state = apply(state,{type:'ADD_VENDOR',vendor:{id:'vendor',name:'Synthetic vendor'}},admin,early);
  state = apply(state,{type:'ADD_SOURCE',source:{id:'original',vendorId:'vendor',title:'Original invoice and promise',kind:'invoice',text:'USD 1,000 credit for REF-1. Synthetic fixture.'}},admin,early);
  const commitment = id => ({type:'CREATE_COMMITMENT',commitment:{id,vendorId:'vendor',reference:'REF-1',currency:'USD',promisedCents:100000,dueDate:'2026-10-01',conditions:[],sourceIds:['original']}});
  state = apply(state,commitment('case-a'),admin,early);
  state = apply(state,{type:'REGISTER_CREDIT',credit:{id:'credit',invoiceId:'INV-1',lineId:'LINE-1',vendorId:'vendor',reference:'REF-1',currency:'USD',status:'applied',amountCents:100000,sourceIds:['original']}},admin,early);
  if (allocated) state = apply(state,{type:'ALLOCATE_CREDIT',allocationId:'allocation',creditId:'credit',commitmentId:'case-a',amountCents:allocated},admin,early);
  if (second) state = apply(state,commitment('case-b'),admin,early);
  return state;
}
const evidence = (patch = {}) => ({operation:'evidence',creditId:'credit',sourceTitle:'Vendor clarification',sourceText:'Synthetic clarification: case-a has USD 600 limit; case-b has USD 400 limit.',effectiveDate:'2026-11-01',...patch});
const resolve = (sourceId, patch = {}) => ({operation:'resolve',creditId:'credit',sourceId,assignments:[{commitmentId:'case-a',amount:'600'},{commitmentId:'case-b',amount:'400'}],effectiveDate:'2026-11-01',...patch});
const prepare = (state,input,actor = admin,options = {}) => prepareCreditResolution(state,input,{actor,now,...options});
const commit = (state,plan,actor = admin) => plan.commands.reduce((next,command)=>apply(next,command,actor),state);
function clarified(state = fixture()) {
  const plan = prepare(state,evidence(),analyst);
  return {state:commit(state,plan,analyst),sourceId:plan.sourceId};
}

test('analyst records clarification, approver binds exact limits, analyst attributes conserved capacity', () => {
  const original = fixture();
  const snapshot = structuredClone(original);
  const recorded = prepare(original,evidence(),analyst);
  assert.deepEqual(original,snapshot);
  assert.equal(recorded.commands.length,1);
  assert.equal(recorded.commands[0].type,'ADD_SOURCE');
  assert.equal(recorded.commands[0].source.kind,'allocation_resolution');
  assert.equal(recorded.after.credits[0].quarantined,true,'clarification alone cannot release quarantine');
  assert.equal(recorded.after.totals.verifiedCents,0);
  let state = commit(original,recorded,analyst);
  const resolution = prepare(state,resolve(recorded.sourceId),approver);
  assert.equal(resolution.commands.length,1);
  assert.equal(resolution.commands[0].type,'RESOLVE_CREDIT');
  assert.equal(resolution.after.credits[0].quarantined,false);
  assert.deepEqual(resolution.after.credits[0].resolution.assignments,[{commitmentId:'case-a',limitCents:60000},{commitmentId:'case-b',limitCents:40000}]);
  assert.equal(resolution.after.totals.verifiedCents,0,'resolution creates no allocation or financial value by itself');
  state = commit(state,resolution,approver);
  state = apply(state,{type:'ALLOCATE_CREDIT',allocationId:'allocation-a',creditId:'credit',commitmentId:'case-a',amountCents:60000},analyst);
  assert.throws(()=>apply(state,{type:'ALLOCATE_CREDIT',allocationId:'too-much',creditId:'credit',commitmentId:'case-a',amountCents:1},analyst),/resolution limit/);
  state = apply(state,{type:'ALLOCATE_CREDIT',allocationId:'allocation-b',creditId:'credit',commitmentId:'case-b',amountCents:40000},analyst);
  assert.equal(evaluateWorkspace(state).totals.verifiedCents,100000);
  assert.equal(evaluateWorkspace(state).credits[0].unallocatedCents,0);
  assert.equal(validateWorkspace(state).valid,true);
});

test('releasing quarantine restores only existing supported attribution and cannot erase it with a lower limit', () => {
  const {state,sourceId} = clarified(fixture({allocated:30000}));
  assert.equal(evaluateWorkspace(state).totals.verifiedCents,0);
  assert.throws(()=>prepare(state,resolve(sourceId,{assignments:[{commitmentId:'case-a',amount:'299.99'},{commitmentId:'case-b',amount:'700'}]}),approver),/erase an existing active allocation/);
  assert.throws(()=>prepare(state,resolve(sourceId,{assignments:[{commitmentId:'case-a',amount:''},{commitmentId:'case-b',amount:'700'}]}),approver),/erase an existing active allocation/);
  const resolution = prepare(state,resolve(sourceId),approver);
  assert.equal(resolution.after.totals.verifiedCents,30000);
  assert.equal(resolution.after.credits[0].allocatedCents,30000);
  assert.equal(resolution.after.credits[0].availableCents,100000);
  assert.equal(resolution.after.credits[0].unallocatedCents,70000);
});

test('positive explicit limits may leave unassigned capacity and blank or zero candidates do not create assignments', () => {
  const {state,sourceId} = clarified();
  for (const unused of ['', ' ', '0', '0.00', undefined]) {
    const plan = prepare(state,resolve(sourceId,{assignments:[{commitmentId:'case-a',amount:'600'},{commitmentId:'case-b',amount:unused}]}),approver);
    assert.deepEqual(plan.commands[0].assignments,[{commitmentId:'case-a',limitCents:60000}]);
    assert.equal(plan.after.credits[0].unallocatedCents,100000);
  }
  assert.throws(()=>prepare(state,resolve(sourceId,{assignments:[{commitmentId:'case-a',amount:''}]}),approver),/at least one explicit positive/);
});

test('limits reject malformed money, repeated assignments, unsafe sums and global overcapacity without mutation', () => {
  const {state,sourceId} = clarified();
  const snapshot = structuredClone(state);
  for (const amount of ['-1','0.001','Infinity','1e3','1,00','90071992547410',300]) {
    assert.throws(()=>prepare(state,resolve(sourceId,{assignments:[{commitmentId:'case-a',amount}]}),approver));
  }
  for (const assignments of [[],null,[null],[{commitmentId:'case-a',amount:'500'},{commitmentId:'case-a',amount:'500'}],[{commitmentId:'case-a',amount:'600'},{commitmentId:'case-b',amount:'400.01'}]]) assert.throws(()=>prepare(state,resolve(sourceId,{assignments}),approver));
  assert.deepEqual(state,snapshot,'failed financial preflights emit no source or resolution');
});

test('clarification must be an explicitly recorded source for the exact vendor and assignments cannot override identity', () => {
  let {state,sourceId} = clarified();
  state = apply(state,{type:'ADD_VENDOR',vendor:{id:'other-vendor',name:'Other vendor'}});
  state = apply(state,{type:'ADD_SOURCE',source:{id:'foreign-source',vendorId:'other-vendor',title:'Other vendor clarification',kind:'allocation_resolution',text:'Not this vendor.'}});
  state = apply(state,{type:'CREATE_COMMITMENT',commitment:{id:'foreign-case',vendorId:'other-vendor',reference:'REF-1',currency:'USD',promisedCents:10000,dueDate:'2026-10-01',conditions:[],sourceIds:['foreign-source']}});
  state = apply(state,{type:'CREATE_COMMITMENT',commitment:{id:'wrong-reference',vendorId:'vendor',reference:'REF-OTHER',currency:'USD',promisedCents:10000,dueDate:'2026-10-01',conditions:[],sourceIds:['original']}});
  for (const invalid of ['original','foreign-source','missing']) assert.throws(()=>prepare(state,resolve(invalid),approver),/recorded credit clarification source/);
  for (const commitmentId of ['foreign-case','wrong-reference','missing']) assert.throws(()=>prepare(state,resolve(sourceId,{assignments:[{commitmentId,amount:'100'}]}),approver),/exact vendor, currency and reference/);
  assert.throws(()=>prepare(state,evidence({creditId:'missing'}),analyst),/credit present in current records/);
});

test('resolution binds the reviewed source revision and later edits do not rewrite historical evidence', () => {
  let {state,sourceId} = clarified();
  const sourceRevision = evaluateWorkspace(state).sources.find(s=>s.id===sourceId).revision;
  const plan = prepare(state,resolve(sourceId),approver);
  state = commit(state,plan,approver);
  assert.deepEqual(evaluateWorkspace(state).credits[0].resolution.sourceLinks,[{sourceId,revision:sourceRevision}]);
  state = apply(state,{type:'REVISE_SOURCE',sourceId,text:'A later clarification with different amounts.'},analyst);
  const view = evaluateWorkspace(state);
  assert.notEqual(view.sources.find(s=>s.id===sourceId).revision,sourceRevision);
  assert.equal(view.sourceVersions.find(s=>s.id===sourceId&&s.revision===sourceRevision).text,evidence().sourceText);
  const revised = prepare(state,resolve(sourceId),approver);
  assert.deepEqual(revised.after.credits[0].resolution.sourceLinks,[{sourceId,revision:view.sources.find(s=>s.id===sourceId).revision}]);
  assert.deepEqual(plan.commands[0].sourceIds,[sourceId]);
});

test('analyst and approver handoff is enforced rather than inferred from the interface', () => {
  const state = fixture();
  for (const role of ['approver','executor','viewer',undefined]) assert.throws(()=>prepare(state,evidence(),{id:'test',role}),/Requires analyst or admin role/);
  const recorded = prepare(state,evidence(),analyst);
  const next = commit(state,recorded,analyst);
  for (const role of ['analyst','executor','viewer',undefined]) assert.throws(()=>prepare(next,resolve(recorded.sourceId),{id:'test',role}),/Requires approver or admin role/);
  assert.doesNotThrow(()=>prepare(state,evidence(),admin));
  assert.doesNotThrow(()=>prepare(next,resolve(recorded.sourceId),admin));
  assert.throws(()=>prepare(state,evidence(),analyst,{readOnly:true}),/Historical view is read only/);
  assert.throws(()=>prepare(next,resolve(recorded.sourceId),approver,{readOnly:true}),/Historical view is read only/);
});

test('real dates, observation order, source bounds and historical visibility stay explicit', () => {
  const state = fixture();
  for (const effectiveDate of ['2026-11-08','2026-02-30','']) assert.throws(()=>prepare(state,evidence({effectiveDate}),analyst));
  assert.doesNotThrow(()=>prepare(state,evidence({effectiveDate:'2026-09-30'}),analyst),'a source may describe clarification received before credit issuance');
  for (const sourceText of ['', ' ', 'x'.repeat(250001),null]) assert.throws(()=>prepare(state,evidence({sourceText}),analyst),/clarification source text/);
  for (const sourceTitle of [' ','x'.repeat(201)]) assert.throws(()=>prepare(state,evidence({sourceTitle}),analyst),/Clarification title/);
  for (const invalid of ['2026-11-07','garbage','']) assert.throws(()=>prepare(state,evidence(),analyst,{now:invalid}),/ISO observation time/);
  const recorded = prepare(state,evidence({sourceText:' Exact supplied text.\n  ',sourceTitle:''}),analyst);
  assert.equal(recorded.commands[0].source.text,' Exact supplied text.\n  ');
  assert.equal(recorded.commands[0].effectiveDate,'2026-11-01');
  const next = commit(state,recorded,analyst);
  assert.throws(()=>prepare(next,resolve(recorded.sourceId,{effectiveDate:'2026-09-30'}),approver),/before the credit is issued/);
  assert.throws(()=>prepare(next,evidence(),analyst,{now:'2026-11-06T12:00:00.000Z'}),/Observation time cannot move backward/);
  assert.equal(evaluateWorkspace(next,{knownAt:'2026-11-06T12:00:00.000Z',asOf:'2026-11-07'}).sources.some(s=>s.id===recorded.sourceId),false);
  assert.throws(()=>prepare(next,{operation:'unknown'},admin),/clarification evidence or a credit resolution/);
});

test('backdated replacement limits cannot undercut active attribution before a later reversal', () => {
  const early = '2026-10-01T12:00:00.000Z';
  let state = fixture({second:false,allocated:60000});
  state = apply(state,{type:'CREATE_COMMITMENT',commitment:{id:'case-b',vendorId:'vendor',reference:'REF-1',currency:'USD',promisedCents:100000,dueDate:'2026-10-01',conditions:[],sourceIds:['original']}},admin,early);
  state = apply(state,{type:'ADD_SOURCE',source:{id:'clarification',vendorId:'vendor',title:'Explicit assignment clarification',kind:'allocation_resolution',text:'Synthetic clarification: USD 600 for A, USD 400 for B; later A reversal must retain its original effective date.'}},analyst,early);
  state = apply(state,{type:'RESOLVE_CREDIT',creditId:'credit',sourceIds:['clarification'],assignments:[{commitmentId:'case-a',limitCents:60000},{commitmentId:'case-b',limitCents:40000}]},approver,early);
  state = apply(state,{type:'ALLOCATE_CREDIT',allocationId:'allocation-b',creditId:'credit',commitmentId:'case-b',amountCents:40000},analyst,early);
  state = apply(state,{type:'REVERSE_CREDIT',creditId:'credit',amountCents:40000,allocationReversals:[{allocationId:'allocation',amountCents:40000}],sourceIds:['clarification'],effectiveDate:'2026-10-10'},analyst,'2026-10-10T12:00:00.000Z');
  const snapshot = structuredClone(state);
  const changedLimits = [{commitmentId:'case-a',amount:'200'},{commitmentId:'case-b',amount:'400'}];
  // The unwrapped reducer checks current active allocation, so this reproduces
  // why the form adapter must also inspect earlier financial boundaries.
  const unsafe = apply(state,{type:'RESOLVE_CREDIT',creditId:'credit',sourceIds:['clarification'],assignments:[{commitmentId:'case-a',limitCents:20000},{commitmentId:'case-b',limitCents:40000}],effectiveDate:'2026-10-05'},approver);
  const historicalCredit = evaluateWorkspace(unsafe,{asOf:'2026-10-06',knownAt:now}).credits[0];
  assert.equal(historicalCredit.allocations.find(a=>a.commitmentId==='case-a').activeCents,60000);
  assert.equal(historicalCredit.resolution.assignments.find(a=>a.commitmentId==='case-a').limitCents,20000);
  assert.throws(()=>prepare(state,resolve('clarification',{assignments:changedLimits,effectiveDate:'2026-10-05'}),approver),/assignment limit for case-a.*2026-10-05/);
  assert.deepEqual(state,snapshot,'rejected backdate leaves the entire workspace unchanged');
  const afterReversal = prepare(state,resolve('clarification',{assignments:changedLimits,effectiveDate:'2026-10-10'}),approver);
  const acceptedState = commit(state,afterReversal,approver);
  const before = evaluateWorkspace(acceptedState,{asOf:'2026-10-06',knownAt:now}).credits[0];
  const after = evaluateWorkspace(acceptedState,{asOf:'2026-10-10',knownAt:now}).credits[0];
  assert.equal(before.resolution.assignments.find(a=>a.commitmentId==='case-a').limitCents,60000);
  assert.equal(after.resolution.assignments.find(a=>a.commitmentId==='case-a').limitCents,20000);
  assert.equal(after.allocatedCents,60000);
  assert.equal(after.availableCents,60000);
});
