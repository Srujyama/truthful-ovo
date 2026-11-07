import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkspace, evaluateWorkspace, reduceWorkspace, validateWorkspace } from './assurance/index.mjs';
import { prepareCreditWorkflow } from './credit-workflow.mjs';

const now = '2026-11-06T12:00:00.000Z';
const actor = { id:'finance-operator', role:'analyst' };
const context = { actor, now };
let serial = 0;
function command(state, input, ctx = { actor:{id:'seed',role:'admin'}, now:'2026-09-01T12:00:00.000Z' }) {
  return reduceWorkspace(state, { id:`test-${++serial}`, ...input }, ctx).state;
}
function fixture() {
  let state = createWorkspace();
  state = command(state, { type:'ADD_VENDOR', vendor:{id:'vendor',name:'Fictional vendor'} });
  state = command(state, { type:'ADD_SOURCE', source:{id:'promise',vendorId:'vendor',title:'Synthetic promise',kind:'email',text:'USD 1,000 correction under REF-1.'} });
  state = command(state, { type:'CREATE_COMMITMENT',commitment:{id:'case',vendorId:'vendor',reference:'REF-1',currency:'USD',promisedCents:100000,dueDate:'2026-10-01',sourceIds:['promise'],conditions:[]} });
  return state;
}
const registration = (patch = {}) => ({ operation:'register', commitmentId:'case', invoiceId:'INV-1', lineId:'CREDIT-1', status:'issued', amount:'1,000.00', allocationAmount:'', effectiveDate:'2026-10-01',sourceText:'Synthetic credit memo, USD 1,000 for REF-1.', ...patch });
const change = (operation, creditId, patch = {}) => ({operation,commitmentId:'case',creditId,effectiveDate:'2026-11-01',sourceText:'Synthetic supporting source for REF-1.',...patch});
const plan = (state,input,ctx = context) => prepareCreditWorkflow(state,input,ctx);
const commit = (state,result) => result.commands.reduce((s,c) => command(s,c,context),state);

test('issued credit, partial attribution, invoice application and explicit reversal preserve separate financial states', () => {
  const original = fixture();
  const untouched = structuredClone(original);
  let prepared = plan(original,registration());
  assert.deepEqual(original,untouched,'preflight is read only');
  assert.equal(prepared.after.totals.verifiedCents,0);
  assert.equal(prepared.after.totals.issuedCents,100000,'portfolio issued total includes unattributed ledger value');
  assert.equal(prepared.after.commitments[0].issuedCents,0,'unattributed issued value is not yet attributed to a case');
  assert.equal(prepared.effects.unallocatedAfterCents,100000);
  const creditId = prepared.creditId;
  let state = commit(original,prepared);
  prepared = plan(state,change('allocate',creditId,{amount:'600'}));
  assert.equal(prepared.effects.issuedDeltaCents,0);
  assert.equal(prepared.effects.verifiedDeltaCents,0);
  assert.equal(prepared.effects.unallocatedAfterCents,40000);
  state = commit(state,prepared);
  const allocationId = evaluateWorkspace(state).allocations[0].id;
  prepared = plan(state,change('apply',creditId));
  assert.equal(prepared.effects.verifiedDeltaCents,60000);
  assert.equal(prepared.effects.outstandingDeltaCents,-60000);
  assert.equal(prepared.effects.issuedDeltaCents,-100000);
  assert.equal(prepared.commands[0].source.kind,'invoice');
  state = commit(state,prepared);
  assert.throws(() => plan(state,change('reverse',creditId,{amount:'500'})),/explicit attributed reversals totaling USD 100.00/);
  prepared = plan(state,change('reverse',creditId,{amount:'500',allocationReversals:[{allocationId,amount:'100'}]}));
  assert.equal(prepared.effects.verifiedDeltaCents,-10000);
  assert.equal(prepared.effects.outstandingDeltaCents,10000);
  assert.equal(prepared.effects.creditAvailableAfterCents,50000);
  assert.equal(prepared.effects.unallocatedAfterCents,0);
  state = commit(state,prepared);
  assert.equal(evaluateWorkspace(state).commitments[0].outstandingCents,50000);
  assert.equal(validateWorkspace(state).valid,true);
});

test('new applied credit can be attributed atomically or left available for a later exact attribution', () => {
  const state = fixture();
  const complete = plan(state,registration({status:'applied',allocationAmount:'1,000'}));
  assert.equal(complete.commands.length,3);
  assert.equal(complete.after.commitments[0].outstandingCents,0);
  assert.equal(complete.effects.verifiedDeltaCents,100000);
  assert.equal(complete.commands[0].source.kind,'invoice');
  assert.ok(complete.commands.every(c => c.effectiveDate === '2026-10-01'));
  assert.equal(new Set(complete.commands.map(c => c.id)).size,3);
  for (const allocationAmount of ['', '0', '0.00', undefined]) {
    const unallocated = plan(state,registration({status:'applied',allocationAmount}));
    assert.equal(unallocated.commands.length,2);
    assert.equal(unallocated.effects.verifiedDeltaCents,0);
    assert.equal(unallocated.effects.unallocatedAfterCents,100000);
  }
});

test('observation cutoff and explicit effective dates replay independently', () => {
  const state = fixture();
  const prepared = plan(state,registration({status:'applied',allocationAmount:'400'}));
  const saved = commit(state,prepared);
  assert.equal(evaluateWorkspace(saved,{asOf:'2026-09-30',knownAt:now}).credits.length,0);
  assert.equal(evaluateWorkspace(saved,{asOf:'2026-10-01',knownAt:now}).commitments[0].verifiedCents,40000);
  assert.equal(evaluateWorkspace(saved,{asOf:'2026-11-06',knownAt:'2026-11-05T12:00:00.000Z'}).credits.length,0);
  assert.throws(() => plan(saved,registration({invoiceId:'INV-2'}),{actor,now:'2026-11-05T12:00:00.000Z'}),/Observation time cannot move backward/);
});

test('duplicate vendor invoice line is refused while a distinct line remains independently recordable', () => {
  let state = fixture();
  const first = plan(state,registration({allocationAmount:'100'}));
  state = commit(state,first);
  const snapshot = structuredClone(state);
  assert.throws(() => plan(state,registration()),/already registered/);
  assert.deepEqual(state,snapshot,'failed duplicate preflight cannot leave an orphan source');
  const another = plan(state,registration({lineId:'CREDIT-2',amount:'200'}));
  assert.notEqual(first.creditId,another.creditId);
  assert.equal(another.after.credits.length,2);
});

test('only analysts and admins may record ledger evidence; historical and invalid contexts stay blocked', () => {
  const state = fixture();
  for (const role of ['viewer','executor','approver','unknown',undefined]) assert.throws(() => plan(state,registration(),{actor:{id:'test',role},now}),/Requires analyst or admin role/);
  assert.doesNotThrow(() => plan(state,registration(),{actor:{id:'admin',role:'admin'},now}));
  assert.throws(() => plan(state,registration(),{...context,readOnly:true}),/Historical view is read only/);
  for (const date of ['2026-11-07','2026-02-30','11/01/2026','']) assert.throws(() => plan(state,registration({effectiveDate:date})),/date|future/);
  for (const invalid of ['', '2026-11-06','not-a-time']) assert.throws(() => plan(state,registration(),{actor,now:invalid}),/ISO observation/);
  assert.throws(() => plan(state,registration(),{now}),/Requires analyst or admin role/);
  assert.throws(() => plan(state,{...registration(),operation:'resolve'}),/supported credit operation/);
});

test('money fields accept exact positive cents and refuse malformed, fractional-cent, negative or unsafe amounts', () => {
  const state = fixture();
  for (const value of ['-1','0','0.00','0.001','1e3','Infinity','1,00','  ','$100','90071992547410',10,null]) {
    assert.throws(() => plan(state,registration({amount:value})),/Credit amount/);
  }
  const penny = plan(state,registration({amount:'0.01',allocationAmount:'0.01'}));
  assert.equal(penny.after.credits[0].amountCents,1);
  for (const value of ['-1','0.001','1e3','90071992547410',3]) assert.throws(() => plan(state,registration({allocationAmount:value})),/Attribution amount/);
});

test('source, identity and exact-case checks refuse incomplete or cross-vendor credit recording', () => {
  const state = fixture();
  for (const patch of [{sourceText:''},{sourceText:'   '},{sourceText:'x'.repeat(250001)},{sourceTitle:' '},{invoiceId:''},{lineId:''},{status:'pending'},{commitmentId:'missing'}]) assert.throws(() => plan(state,registration(patch)));
  const prepared = plan(state,registration({sourceTitle:'Supplied memo',sourceText:'Exact original source\nwith whitespace.  '}));
  assert.equal(prepared.commands[0].source.text,'Exact original source\nwith whitespace.  ');
  assert.equal(prepared.commands[0].source.title,'Supplied memo');
  let saved = commit(state,prepared);
  saved = command(saved,{type:'CREATE_COMMITMENT',commitment:{id:'other-case',vendorId:'vendor',reference:'OTHER',currency:'USD',promisedCents:1000,dueDate:'2026-10-01',sourceIds:['promise'],conditions:[]}},context);
  assert.throws(() => plan(saved,change('allocate',prepared.creditId,{commitmentId:'other-case',amount:'1'})),/same vendor, currency and exact reference/);
  assert.throws(() => plan(saved,change('apply','missing')),/Choose a credit/);
});

test('over-allocation and invalid reversal leave the entire source-and-ledger batch uncommitted', () => {
  const state = fixture();
  const snapshot = structuredClone(state);
  assert.throws(() => plan(state,registration({amount:'100',allocationAmount:'100.01'})),/exceeds its remaining value/);
  assert.deepEqual(state,snapshot);
  const prepared = plan(state,registration({status:'applied',amount:'100',allocationAmount:'100'}));
  const saved = commit(state,prepared);
  const allocated = evaluateWorkspace(saved).allocations[0];
  for (const patch of [
    {amount:'101'},
    {amount:'50',allocationReversals:[{allocationId:allocated.id,amount:'49'}]},
    {amount:'50',allocationReversals:[{allocationId:'wrong',amount:'50'}]},
    {amount:'50',allocationReversals:[{allocationId:allocated.id,amount:'25'},{allocationId:allocated.id,amount:'25'}]},
  ]) assert.throws(() => plan(saved,change('reverse',prepared.creditId,patch)));
  assert.equal(saved.events.length,state.events.length+3);
});

test('ambiguous exact references stay quarantined until an approver explicitly resolves them', () => {
  let state = fixture();
  state = command(state,{type:'CREATE_COMMITMENT',commitment:{id:'case-two',vendorId:'vendor',reference:'REF-1',currency:'USD',promisedCents:100000,dueDate:'2026-10-01',sourceIds:['promise'],conditions:[]}});
  const unassigned = plan(state,registration({status:'applied'}));
  assert.equal(unassigned.after.credits[0].quarantined,true);
  state = commit(state,unassigned);
  assert.throws(() => plan(state,change('allocate',unassigned.creditId,{amount:'500'})),/Multiple commitments share/);
  state = command(state,{type:'RESOLVE_CREDIT',creditId:unassigned.creditId,assignments:[{commitmentId:'case',limitCents:50000},{commitmentId:'case-two',limitCents:50000}],sourceIds:['promise']},{actor:{id:'finance-approver',role:'approver'},now});
  const first = plan(state,change('allocate',unassigned.creditId,{amount:'500'}));
  state = commit(state,first);
  assert.throws(() => plan(state,change('allocate',unassigned.creditId,{amount:'0.01'})),/resolution limit/);
  state = commit(state,plan(state,change('allocate',unassigned.creditId,{commitmentId:'case-two',amount:'500'})));
  const allocations = evaluateWorkspace(state).allocations;
  const reversed = plan(state,change('reverse',unassigned.creditId,{amount:'300',allocationReversals:[{allocationId:allocations[0].id,amount:'100'},{allocationId:allocations[1].id,amount:'200'}]}));
  assert.equal(reversed.effects.affectedCommitments.length,2);
  assert.equal(reversed.effects.verifiedDeltaCents,-30000);
  assert.equal(reversed.effects.affectedCommitments[0].afterOutstandingCents,60000);
  assert.equal(reversed.effects.affectedCommitments[1].afterOutstandingCents,70000);
});

test('a backdated reversal cannot remove backing before the reversed allocation becomes effective', () => {
  let state = fixture();
  const initial = plan(state,registration({amount:'100',status:'applied'}));
  state = commit(state,initial);
  state = commit(state,plan(state,change('allocate',initial.creditId,{amount:'100',effectiveDate:'2026-11-01'})));
  const allocationId = evaluateWorkspace(state).allocations[0].id;
  assert.throws(() => plan(state,change('reverse',initial.creditId,{amount:'100',effectiveDate:'2026-10-15',allocationReversals:[{allocationId,amount:'100'}]})),/cannot predate an attribution/);
  assert.doesNotThrow(() => plan(state,change('reverse',initial.creditId,{amount:'100',effectiveDate:'2026-11-01',allocationReversals:[{allocationId,amount:'100'}]})));
});

test('new ledger evidence invalidates an old exact approval without executing or fabricating a claim', () => {
  let state = fixture();
  state = command(state,{type:'PROPOSE_ACTION',action:{id:'action',commitmentId:'case',type:'prepare_claim',payload:{}}},context);
  state = command(state,{type:'APPROVE_ACTION',actionId:'action'},{actor:{id:'approver',role:'approver'},now});
  assert.equal(evaluateWorkspace(state).actions[0].approvalStale,false);
  const prepared = plan(state,registration({status:'applied',allocationAmount:'100'}));
  assert.equal(prepared.after.actions[0].approvalStale,true);
  assert.equal(prepared.after.actions[0].executed,false);
  assert.equal(prepared.effects.verifiedDeltaCents,10000);
  assert.throws(() => plan(commit(state,prepared),change('apply',prepared.creditId)),/already applied/);
});

test('attribution binds an exact supporting source revision and preserves it after later source edits', () => {
  let state = fixture();
  const registered = plan(state,registration({status:'applied'}));
  state = commit(state,registered);
  const attributed = plan(state,change('allocate',registered.creditId,{amount:'300',sourceText:'Exact attribution notice for REF-1, USD 300.'}));
  state = commit(state,attributed);
  const sourceId = attributed.commands[0].source.id;
  const allocationId = attributed.commands[1].allocationId;
  const sourceRevision = state.events.find(e => e.payload.source?.id === sourceId).sequence;
  assert.deepEqual(evaluateWorkspace(state).allocations[0].sourceLinks,[{sourceId,revision:sourceRevision}]);
  state = command(state,{type:'REVISE_SOURCE',sourceId,text:'Revised attribution note; original support must stay inspectable.'},context);
  const view = evaluateWorkspace(state);
  const edge = view.graph.edges.find(e => e.from === `source:${sourceId}@${sourceRevision}` && e.to === `allocation:${allocationId}` && e.relation === 'supports');
  assert.ok(edge,'evidence graph points to the exact bound revision');
  const boundSource = view.graph.nodes.find(n => n.id === edge.from);
  assert.equal(boundSource.text,'Exact attribution notice for REF-1, USD 300.');
  assert.notEqual(view.sources.find(s => s.id === sourceId).revision,sourceRevision);
  assert.equal(validateWorkspace(state).valid,true);
});

test('attribution sources cannot cross vendors and legacy commands remain replayable without sourceIds', () => {
  let state = fixture();
  const registered = plan(state,registration({status:'applied'}));
  state = commit(state,registered);
  state = command(state,{type:'ADD_VENDOR',vendor:{id:'other-vendor',name:'Other fictional vendor'}},context);
  state = command(state,{type:'ADD_SOURCE',source:{id:'other-source',vendorId:'other-vendor',title:'Other evidence',text:'Evidence for a different vendor.'}},context);
  const snapshot = structuredClone(state);
  const allocation = {type:'ALLOCATE_CREDIT',allocationId:'attribution',creditId:registered.creditId,commitmentId:'case',amountCents:10000};
  assert.throws(() => command(state,{...allocation,sourceIds:['other-source']},context),/Supporting source vendor must match/);
  assert.deepEqual(state,snapshot,'failed source validation emits no allocation and changes no prior record');
  assert.throws(() => command(state,{...allocation,sourceIds:[]},context),/supporting source IDs/);
  state = command(state,allocation,context);
  const view = evaluateWorkspace(state);
  assert.equal(view.commitments[0].verifiedCents,10000);
  assert.equal(Object.hasOwn(view.allocations[0],'sourceLinks'),false);
  assert.equal(validateWorkspace(state).valid,true);
});

test('blank and zero reversal fields preserve unused attributions while exact positive removal stays required', () => {
  let state = fixture();
  const registered = plan(state,registration({status:'applied',allocationAmount:'400'}));
  state = commit(state,registered);
  state = commit(state,plan(state,change('allocate',registered.creditId,{amount:'200'})));
  const [first,second] = evaluateWorkspace(state).allocations;
  for (const unused of ['', '0', '0.00', undefined]) {
    const reversed = plan(state,change('reverse',registered.creditId,{amount:'500',allocationReversals:[{allocationId:first.id,amount:'100'},{allocationId:second.id,amount:unused}]}));
    assert.deepEqual(reversed.commands[1].allocationReversals,[{allocationId:first.id,amountCents:10000}]);
    assert.equal(reversed.after.allocations.find(a => a.id === second.id).activeCents,20000);
    assert.equal(reversed.effects.creditAvailableAfterCents,50000);
    assert.equal(reversed.effects.unallocatedAfterCents,0);
  }
  for (const value of ['-1', '0.001', 'oops']) assert.throws(() => plan(state,change('reverse',registered.creditId,{amount:'500',allocationReversals:[{allocationId:first.id,amount:'100'},{allocationId:second.id,amount:value}]})),/Attributed reversal amount/);
  assert.throws(() => plan(state,change('reverse',registered.creditId,{amount:'500',allocationReversals:[{allocationId:first.id,amount:'99'},{allocationId:second.id,amount:''}]})),/must equal the portion/);
});
