import test from 'node:test';
import assert from 'node:assert/strict';
import * as engine from '../src/assurance/index.mjs';
import {validationProfile,validateFinancialTransition} from './financial-validation.mjs';

const now='2026-11-08T12:00:00.000Z',actor={id:'financial-boundary-test',role:'admin'};
let serial=0;
const apply=(state,command,at=now)=>engine.reduceWorkspace(state,{id:`boundary-${++serial}`,...command},{actor,now:at}).state;
function seed({second=false,allocate=0}={}) {
  const at='2026-10-01T12:00:00.000Z';let state=engine.createWorkspace();
  for(const command of [
    {type:'ADD_VENDOR',vendor:{id:'vendor',name:'Synthetic vendor'}},
    {type:'ADD_SOURCE',source:{id:'source',vendorId:'vendor',title:'Synthetic invoice',kind:'invoice',text:'USD 1,000 applied credit for REF.'}},
    {type:'ADD_SOURCE',source:{id:'clarification',vendorId:'vendor',title:'Synthetic clarification',kind:'allocation_resolution',text:'Explicit assignment limits for REF.'}},
    {type:'CREATE_COMMITMENT',commitment:{id:'a',vendorId:'vendor',reference:'REF',currency:'USD',promisedCents:100000,dueDate:'2026-10-01',conditions:[],sourceIds:['source']}},
    {type:'REGISTER_CREDIT',credit:{id:'credit',invoiceId:'INV',lineId:'LINE',vendorId:'vendor',reference:'REF',currency:'USD',status:'applied',amountCents:100000,sourceIds:['source']}},
  ])state=apply(state,command,at);
  if(allocate)state=apply(state,{type:'ALLOCATE_CREDIT',allocationId:'allocation-a',creditId:'credit',commitmentId:'a',amountCents:allocate},at);
  if(second)state=apply(state,{type:'CREATE_COMMITMENT',commitment:{id:'b',vendorId:'vendor',reference:'REF',currency:'USD',promisedCents:100000,dueDate:'2026-10-01',conditions:[],sourceIds:['source']}},at);
  return state;
}
const validate=(before,after,commands)=>validateFinancialTransition({before,after,commands,now,engine});
const resolution=(limits,effectiveDate='2026-10-01',sourceIds=['clarification'])=>({type:'RESOLVE_CREDIT',creditId:'credit',assignments:limits.map(([commitmentId,limitCents])=>({commitmentId,limitCents})),sourceIds,effectiveDate});

test('trusted boundary rejects a raw backdated causal reversal although the reducer accepts its current balance',()=>{
  const original=seed(),allocation={type:'ALLOCATE_CREDIT',allocationId:'allocation-a',creditId:'credit',commitmentId:'a',amountCents:60000,effectiveDate:'2026-10-10'};
  const before=apply(original,allocation,'2026-10-10T12:00:00.000Z');
  const reverse={type:'REVERSE_CREDIT',creditId:'credit',amountCents:50000,sourceIds:['source'],allocationReversals:[{allocationId:'allocation-a',amountCents:10000}],effectiveDate:'2026-10-05'};
  const after=apply(before,reverse),snapshot=structuredClone(before);
  assert.equal(engine.validateWorkspace(after).valid,true);
  assert.throws(()=>validate(before,after,[reverse]),error=>error.status===422&&error.code==='FINANCIAL_HISTORY_INVALID'&&error.details.kind==='REVERSAL_BEFORE_ATTRIBUTION');
  assert.deepEqual(before,snapshot);
});

test('raw resolution cannot retroactively shrink a pre-reversal allocation cap',()=>{
  const early='2026-10-01T12:00:00.000Z';let state=seed({allocate:60000,second:true});
  state=apply(state,resolution([['a',60000],['b',40000]]),early);
  state=apply(state,{type:'ALLOCATE_CREDIT',allocationId:'allocation-b',creditId:'credit',commitmentId:'b',amountCents:40000},early);
  state=apply(state,{type:'REVERSE_CREDIT',creditId:'credit',amountCents:40000,sourceIds:['source'],allocationReversals:[{allocationId:'allocation-a',amountCents:40000}],effectiveDate:'2026-10-10'},'2026-10-10T12:00:00.000Z');
  const command=resolution([['a',20000],['b',40000]],'2026-10-05'),after=apply(state,command);
  assert.throws(()=>validate(state,after,[command]),error=>error.details.kind==='TRANSITION_HISTORY_INVALID'&&error.details.violations.some(v=>v.kind==='RESOLUTION_ACTIVE_CAP'&&v.asOf==='2026-10-05'&&v.activeCents===60000&&v.limitCents===20000));
  const validCommand={...command,effectiveDate:'2026-10-10'};
  assert.equal(validate(state,apply(state,validCommand),[validCommand]).valid,true);
});

test('a later reversal may retain old authorization maxima while conserving real active capacity',()=>{
  let before=seed({allocate:60000,second:true});
  before=apply(before,resolution([['a',60000],['b',40000]]),'2026-10-01T12:00:00.000Z');
  before=apply(before,{type:'ALLOCATE_CREDIT',allocationId:'allocation-b',creditId:'credit',commitmentId:'b',amountCents:40000},'2026-10-01T12:00:00.000Z');
  const command={type:'REVERSE_CREDIT',creditId:'credit',amountCents:40000,sourceIds:['source'],allocationReversals:[{allocationId:'allocation-a',amountCents:40000}],effectiveDate:'2026-10-10'};
  const after=apply(before,command);
  assert.equal(engine.evaluateWorkspace(after).credits[0].resolution.assignments.reduce((sum,row)=>sum+row.limitCents,0),100000);
  assert.equal(engine.evaluateWorkspace(after).credits[0].availableCents,60000);
  assert.equal(validate(before,after,[command]).valid,true);
});

test('a new resolution must fit physical credit available on its effective date after all batch facts',()=>{
  const before=seed({second:true});
  const commands=[resolution([['a',60000],['b',40000]],'2026-10-15'),{type:'REVERSE_CREDIT',creditId:'credit',amountCents:40000,sourceIds:['source'],allocationReversals:[],effectiveDate:'2026-10-10'}];
  const after=commands.reduce((state,command)=>apply(state,command),before);
  assert.throws(()=>validate(before,after,{type:'__BATCH__',commands}),error=>error.details.kind==='RESOLUTION_TOTAL_CAP'&&error.details.availableCents===60000);
});

test('new raw resolution requires clarification sources without invalidating legacy accepted source kinds',()=>{
  const before=seed({second:true}),command=resolution([['a',60000],['b',40000]],'2026-10-01',['source']),after=apply(before,command);
  assert.throws(()=>validate(before,after,[command]),error=>error.details.kind==='RESOLUTION_SOURCE_KIND');
  const source={type:'ADD_SOURCE',source:{id:'later-evidence',vendorId:'vendor',title:'Later supplied evidence',text:'The older resolution source remains part of accepted history.'}};
  assert.equal(validate(after,apply(after,source),[source]).valid,true,'legacy source kinds are not rewritten or reclassified');
});

test('source bindings must preserve the exact vendor and the source revision current at that event',()=>{
  let before=seed();
  before=apply(before,{type:'REVISE_SOURCE',sourceId:'source',text:'Revised source text before attribution.'});
  const command={type:'ALLOCATE_CREDIT',creditId:'credit',commitmentId:'a',allocationId:'source-backed',amountCents:10000,sourceIds:['source']};
  const correct=apply(before,command);
  assert.equal(validate(before,correct,[command]).valid,true);
  const altered=structuredClone(correct);
  altered.events.at(-1).payload.allocation.sourceLinks[0].revision=2;
  assert.throws(()=>validate(before,altered,[command]),error=>error.details.kind==='SOURCE_BINDING_INVALID');
});

test('legacy temporal defects are identified and a trusted reset reports the preserved defect rather than blessing it',()=>{
  const before=seed();
  const allocated=apply(before,{type:'ALLOCATE_CREDIT',allocationId:'late',creditId:'credit',commitmentId:'a',amountCents:100000,effectiveDate:'2026-10-10'});
  const legacy=apply(allocated,{type:'REVERSE_CREDIT',creditId:'credit',amountCents:100000,sourceIds:['source'],allocationReversals:[{allocationId:'late',amountCents:100000}],effectiveDate:'2026-10-05'});
  // A current-balance-safe causal defect is caught as a new transition above;
  // legacy balance/cap violations are additionally detected before new writes.
  const corrupted=structuredClone(legacy);corrupted.events.at(-1).payload.amountCents=100001;
  const command={type:'ADD_SOURCE',source:{id:'new',vendorId:'vendor',title:'Must not bless old defect',text:'Supplied evidence.'}};
  assert.throws(()=>validate(corrupted,structuredClone(corrupted),[command]),error=>error.details.kind==='PREEXISTING_HISTORY_INVALID');
  const reset=validate(corrupted,seed(),[{type:'__DEMO_RESET__'}]);
  assert.equal(reset.valid,true);assert.ok(reset.preservedPreexistingViolations.length>0);
  assert.equal(reset.profile,validationProfile);
});

test('unsupported transport engines are explicit and cannot claim financial validation for typed ledger writes',()=>{
  const transport={evaluateWorkspace:state=>({value:state.value})};
  const options={before:{value:0},after:{value:1},commands:[{type:'INCREMENT'}],now,engine:transport};
  assert.equal(validateFinancialTransition(options).applicable,false);
  assert.throws(()=>validateFinancialTransition({...options,commands:[{type:'REGISTER_CREDIT'}]}),error=>error.details.kind==='UNSUPPORTED_FINANCIAL_ENGINE');
});
