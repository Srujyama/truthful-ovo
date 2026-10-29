import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkspace,createDemoWorkspace,reduceWorkspace,evaluateWorkspace,simulateAction,validateWorkspace,DomainError,canonical,scenarios,runScenario} from './index.mjs';

const actor={id:'test-admin',role:'admin'},now='2026-10-29T12:00:00.000Z';
const ctx=(role='admin',time=now)=>({actor:{id:`test-${role}`,role},now:time});
const send=(state,command,context=ctx())=>reduceWorkspace(state,command,context).state;
const view=(state,options={})=>evaluateWorkspace(state,{asOf:'2026-10-29',knownAt:'2026-12-31T00:00:00.000Z',...options});
const commitment=(state,id='pipeline-seats',options={})=>view(state,options).commitments.find(c=>c.id===id);
function minimal(){
  let s=createWorkspace({id:'test'});
  for(const command of [
    {type:'ADD_VENDOR',vendor:{id:'v',name:'Example Vendor'}},
    {type:'ADD_SOURCE',source:{id:'s',vendorId:'v',title:'Original promise',kind:'email',text:'Synthetic USD 100 promise REF-A, due October 1.'}},
    {type:'ADD_SOURCE',source:{id:'i',vendorId:'v',title:'Invoice credit ledger',kind:'invoice',text:'Synthetic credit lines on invoice INV-1.'}},
    {type:'CREATE_COMMITMENT',commitment:{id:'a',vendorId:'v',currency:'USD',reference:'REF-A',promisedCents:10000,dueDate:'2026-10-01',sourceIds:['s']}},
    {type:'CREATE_COMMITMENT',commitment:{id:'b',vendorId:'v',currency:'USD',reference:'REF-B',promisedCents:20000,dueDate:'2026-10-01',sourceIds:['s']}},
  ])s=send(s,command,ctx('admin','2026-10-01T12:00:00.000Z'));
  return s;
}
const credit=(id='cr',overrides={})=>({type:'REGISTER_CREDIT',credit:{id,lineId:id,invoiceId:'INV-1',vendorId:'v',currency:'USD',reference:'REF-A',amountCents:10000,status:'applied',sourceIds:['i'],...overrides}});
const allocation=(id='al',amountCents=10000,extra={})=>({type:'ALLOCATE_CREDIT',allocationId:id,creditId:'cr',commitmentId:'a',amountCents,...extra});
function errorCode(run,code){assert.throws(run,error=>error instanceof DomainError&&error.code===code);}

test('four-vendor seed distinguishes applied, issued, conditional and future value',()=>{
  const s=createDemoWorkspace(),v=view(s);
  assert.equal(s.revision,28);
  assert.equal(v.vendors.length,4);
  assert.equal(v.commitments.length,4);
  assert.equal(v.totals.verifiedCents,90000);
  assert.equal(v.totals.issuedCents,200000);
  assert.equal(v.totals.recoverableCents,350000);
  assert.equal(v.totals.conditionalCents,48000);
  assert.equal(commitment(s,'nimbus-sla').status,'issued');
  assert.equal(commitment(s,'parcel-waiver').status,'scheduled');
  assert.equal(commitment(s,'orbit-renewal').verifiedCents,0);
  assert.equal(validateWorkspace(s).valid,true);
});

test('schema rejects fractional, negative, unsafe or foreign money without changing state',()=>{
  const s=minimal(),before=canonical(s);
  for(const amount of [0,-1,0.1,Number.MAX_SAFE_INTEGER+1,NaN,Infinity,'100'])errorCode(()=>send(s,credit('bad',{amountCents:amount})),'VALIDATION');
  errorCode(()=>send(s,credit('foreign',{currency:'CAD'})),'VALIDATION');
  errorCode(()=>send(s,{type:'CREATE_COMMITMENT',commitment:{id:'bad',vendorId:'v',currency:'USD',reference:'X',promisedCents:100,dueDate:'2026-02-30',sourceIds:['s']}}),'VALIDATION');
  assert.equal(canonical(s),before);
});

test('pure reducer leaves frozen inputs unchanged and returns serializable snapshots',()=>{
  const s=minimal();const freeze=o=>{if(o&&typeof o==='object'){Object.freeze(o);for(const v of Object.values(o))freeze(v);}};freeze(s);
  const command=credit();freeze(command);const next=send(s,command);
  assert.notEqual(next,s);assert.equal(s.revision,5);assert.equal(next.revision,6);
  assert.deepEqual(JSON.parse(JSON.stringify(next)),next);
});

test('global credit capacity prevents duplicate allocations and retries are idempotent',()=>{
  let s=send(minimal(),credit());s=send(s,{id:'allocate-once',...allocation()});
  errorCode(()=>send(s,allocation('duplicate',1)),'INSUFFICIENT_CREDIT');
  const repeated=reduceWorkspace(s,{id:'allocate-once',...allocation()},ctx());
  assert.equal(repeated.state,s);assert.equal(repeated.result.idempotent,true);
  errorCode(()=>send(s,{id:'allocate-once',...allocation('different',1)}),'CONFLICT');
  assert.equal(view(s).credits[0].allocatedCents,10000);
});

test('invoice IDs can contain several unique credit lines but a line cannot be re-registered with an alias',()=>{
  let s=send(minimal(),credit('line-1',{amountCents:4000,lineId:'external-1'}));
  s=send(s,credit('line-2',{amountCents:6000,lineId:'external-2'}));
  s=send(s,allocation('p1',4000,{creditId:'line-1'}));s=send(s,allocation('p2',6000,{creditId:'line-2'}));
  assert.equal(commitment(s,'a').verifiedCents,10000);
  errorCode(()=>send(s,credit('alias',{lineId:'external-1',amountCents:4000})),'CONFLICT');
  assert.equal(view(s).credits.length,2);
});

test('credit identity is exact across vendor, reference and currency',()=>{
  let s=minimal();s=send(s,credit());
  errorCode(()=>send(s,allocation('wrong-ref',100,{commitmentId:'b'})),'VALIDATION');
  s=send(s,{type:'ADD_VENDOR',vendor:{id:'other',name:'Other vendor'}});
  s=send(s,{type:'ADD_SOURCE',source:{id:'other-source',vendorId:'other',title:'Other promise',text:'Unrelated source.'}});
  s=send(s,{type:'CREATE_COMMITMENT',commitment:{id:'other-claim',vendorId:'other',currency:'USD',reference:'REF-A',promisedCents:10000,dueDate:'2026-10-01',sourceIds:['other-source']}});
  errorCode(()=>send(s,allocation('wrong-vendor',100,{commitmentId:'other-claim'})),'VALIDATION');
  errorCode(()=>send(s,credit('bad-source',{sourceIds:['other-source']})),'VALIDATION');
});

test('ambiguous exact candidates quarantine instead of selecting one',()=>{
  let s=send(minimal(),credit());
  s=send(s,{type:'CREATE_COMMITMENT',commitment:{id:'a2',vendorId:'v',currency:'USD',reference:'REF-A',promisedCents:10000,dueDate:'2026-10-01',sourceIds:['s']}});
  assert.equal(view(s).quarantine.length,1);
  errorCode(()=>send(s,allocation()),'AMBIGUOUS');
  errorCode(()=>send(s,{type:'RESOLVE_CREDIT',creditId:'cr',assignments:[{commitmentId:'a',limitCents:6000},{commitmentId:'a2',limitCents:4000}],sourceIds:['i']},ctx('analyst')),'FORBIDDEN');
  s=send(s,{type:'RESOLVE_CREDIT',creditId:'cr',assignments:[{commitmentId:'a',limitCents:6000},{commitmentId:'a2',limitCents:4000}],sourceIds:['i']},ctx('approver'));
  s=send(s,allocation('split-a',6000));s=send(s,allocation('split-a2',4000,{commitmentId:'a2'}));
  assert.equal(commitment(s,'a').verifiedCents,6000);assert.equal(commitment(s,'a2').verifiedCents,4000);
  assert.equal(view(s).totals.verifiedCents,10000);assert.equal(validateWorkspace(s).valid,true);
});

test('late duplicate discovery withdraws uncertain attribution until a source-backed resolution',()=>{
  let s=send(send(minimal(),credit()),allocation());
  s=send(s,{type:'CREATE_COMMITMENT',commitment:{id:'a2',vendorId:'v',currency:'USD',reference:'REF-A',promisedCents:10000,dueDate:'2026-10-01',sourceIds:['s']}});
  assert.equal(commitment(s,'a').verifiedCents,0);assert.equal(commitment(s,'a').quarantinedAppliedCents,10000);
  assert.equal(view(s).totals.quarantinedCents,10000);
  s=send(s,{type:'RESOLVE_CREDIT',creditId:'cr',assignments:[{commitmentId:'a',limitCents:10000}],sourceIds:['i']});
  assert.equal(commitment(s,'a').verifiedCents,10000);
});

test('a resolution cannot shrink below the aggregate of existing partial allocations',()=>{
  let s=send(minimal(),credit());s=send(s,allocation('p1',3000));s=send(s,allocation('p2',3000));
  errorCode(()=>send(s,{type:'RESOLVE_CREDIT',creditId:'cr',assignments:[{commitmentId:'a',limitCents:4000}],sourceIds:['i']}),'VALIDATION');
});

test('issued credit is not savings and memo-only application is refused',()=>{
  let s=createDemoWorkspace();
  assert.equal(commitment(s,'nimbus-sla').verifiedCents,0);
  errorCode(()=>send(s,{type:'APPLY_CREDIT',creditId:'credit-nimbus-2000',sourceIds:['nimbus-memo']}),'VALIDATION');
  s=send(s,{type:'ADD_SOURCE',source:{id:'new-invoice',vendorId:'nimbus',kind:'invoice',title:'Invoice application',text:'Synthetic invoice applies CM-NC-204 in full.'}});
  s=send(s,{type:'APPLY_CREDIT',creditId:'credit-nimbus-2000',sourceIds:['new-invoice']});
  assert.equal(commitment(s,'nimbus-sla').verifiedCents,200000);
  assert.equal(view(s).totals.verifiedCents,290000);
});

test('partial and full reversals reopen balances without negative ledger capacity',()=>{
  let s=send(send(minimal(),credit()),allocation());
  s=send(s,{type:'REVERSE_CREDIT',creditId:'cr',amountCents:2500,sourceIds:['i']});
  assert.equal(commitment(s,'a').verifiedCents,7500);assert.equal(commitment(s,'a').outstandingCents,2500);
  assert.equal(view(s).credits[0].allocatedCents,7500);
  errorCode(()=>send(s,{type:'REVERSE_CREDIT',creditId:'cr',amountCents:7501,sourceIds:['i']}),'VALIDATION');
  s=send(s,{type:'REVERSE_CREDIT',creditId:'cr',amountCents:7500,sourceIds:['i']});
  assert.equal(commitment(s,'a').verifiedCents,0);assert.equal(commitment(s,'a').outstandingCents,10000);
  assert.equal(view(s).credits[0].availableCents,0);
});

test('replaying before a reversal takes effect preserves policy and earlier ledger facts',()=>{
  const s=runScenario('credit-reversal').workspace;
  const knownAt='2026-10-29T12:00:00.000Z';
  const beforeCredit=evaluateWorkspace(s,{asOf:'2026-09-30',knownAt});
  const beforeReversal=evaluateWorkspace(s,{asOf:'2026-10-28',knownAt});
  const afterReversal=evaluateWorkspace(s,{asOf:'2026-10-29',knownAt});
  for(const snapshot of [beforeCredit,beforeReversal,afterReversal]) {
    assert.equal(snapshot.policy.claimLimitCents,500000);
    assert.equal(snapshot.policy.allowNewCommitments,false);
    assert.equal(validateWorkspace(s,{asOf:snapshot.asOf,knownAt}).valid,true);
  }
  assert.equal(beforeCredit.credits.some(c=>c.id==='credit-pipeline-900'),false);
  assert.equal(beforeReversal.commitments.find(c=>c.id==='pipeline-seats').verifiedCents,90000);
  assert.equal(afterReversal.commitments.find(c=>c.id==='pipeline-seats').verifiedCents,0);
});

test('a partial reversal of a shared credit requires explicit causal allocation attribution',()=>{
  let s=send(minimal(),credit());
  s=send(s,{type:'CREATE_COMMITMENT',commitment:{id:'a2',vendorId:'v',currency:'USD',reference:'REF-A',promisedCents:10000,dueDate:'2026-10-01',sourceIds:['s']}});
  s=send(s,{type:'RESOLVE_CREDIT',creditId:'cr',assignments:[{commitmentId:'a',limitCents:6000},{commitmentId:'a2',limitCents:4000}],sourceIds:['i']});
  s=send(s,allocation('p1',6000));s=send(s,allocation('p2',4000,{commitmentId:'a2'}));
  errorCode(()=>send(s,{type:'REVERSE_CREDIT',creditId:'cr',amountCents:2000,sourceIds:['i']}),'AMBIGUOUS');
  s=send(s,{type:'REVERSE_CREDIT',creditId:'cr',amountCents:2000,sourceIds:['i'],allocationReversals:[{allocationId:'p1',amountCents:1500},{allocationId:'p2',amountCents:500}]});
  assert.equal(commitment(s,'a').verifiedCents,4500);assert.equal(commitment(s,'a2').verifiedCents,3500);
  assert.equal(validateWorkspace(s).valid,true);
});

test('unallocated credit is reversed before any backed claim allocation disappears',()=>{
  let s=send(send(minimal(),credit()),allocation('part',4000));
  s=send(s,{type:'REVERSE_CREDIT',creditId:'cr',amountCents:5000,sourceIds:['i']});
  assert.equal(commitment(s,'a').verifiedCents,4000);assert.equal(view(s).credits[0].unallocatedCents,1000);
});

test('proposed amendments and conditions never overwrite the original promise',()=>{
  const s=createDemoWorkspace(),c=commitment(s);
  assert.equal(c.promisedCents,240000);assert.equal(c.dueDate,'2026-10-01');assert.deepEqual(c.conditions,[]);
  assert.equal(c.pendingAmendmentIds.length,2);assert.equal(c.acceptedAmendmentIds.length,0);
  errorCode(()=>send(s,{type:'APPROVE_ACTION',actionId:'action-orbit-renewal'}),'POLICY_BLOCKED');
  assert.equal(commitment(s,'orbit-renewal').verifiedCents,0);
});

test('renewal what-if economics use explicit incremental baseline and exclude already recovered credit',()=>{
  const s=createDemoWorkspace();
  const pipeline=simulateAction(s,{commitmentId:'pipeline-seats',type:'accept_amendment',payload:{amendmentId:'amendment-pipeline-renewal'}});
  assert.equal(pipeline.economics.creditCents,150000);assert.equal(pipeline.economics.baselineCostCents,7200000);
  assert.equal(pipeline.economics.proposedRenewalCostCents,7440000);assert.equal(pipeline.economics.incrementalRenewalCostCents,240000);assert.equal(pipeline.economics.netIncrementalValueCents,-90000);
  const orbit=simulateAction(s,{commitmentId:'orbit-renewal',type:'accept_amendment',payload:{amendmentId:'amendment-orbit-renewal'}});
  assert.equal(orbit.economics.netIncrementalValueCents,-192000);assert.equal(orbit.policyDecision.allowed,false);
  errorCode(()=>send(s,{type:'PROPOSE_AMENDMENT',amendment:{id:'missing-baseline',commitmentId:'pipeline-seats',kind:'renewal',patch:{dueDate:'2026-11-15'},effectiveDate:'2026-11-01',incrementalRenewalCostCents:100,sourceIds:['pipeline-proposal']}}),'VALIDATION');
});

test('role and policy boundaries are authoritative in the reducer',()=>{
  const s=createDemoWorkspace();
  errorCode(()=>send(s,{type:'PROPOSE_ACTION',action:{id:'viewer-action',commitmentId:'pipeline-seats',type:'prepare_claim',payload:{}}},ctx('viewer')),'FORBIDDEN');
  errorCode(()=>send(s,{type:'APPROVE_ACTION',actionId:'action-pipeline-preserve'},ctx('analyst')),'FORBIDDEN');
  errorCode(()=>send(s,{type:'SET_POLICY',policy:{claimLimitCents:1,renewalLimitCents:0,allowNewCommitments:false}},ctx('approver')),'FORBIDDEN');
  errorCode(()=>send(s,{type:'EXECUTE_ACTION',actionId:'action-pipeline-preserve'},ctx('executor')),'FORBIDDEN');
  const approved=send(s,{type:'APPROVE_ACTION',actionId:'action-pipeline-preserve'},ctx('approver'));
  errorCode(()=>send(approved,{type:'EXECUTE_ACTION',actionId:'action-pipeline-preserve'},ctx('approver')),'FORBIDDEN');
});

test('approval binds evidence, accepted terms, ledger, policy and exact action revision',()=>{
  const initial=send(createDemoWorkspace(),{type:'APPROVE_ACTION',actionId:'action-pipeline-preserve'});
  for(const command of [
    {type:'REVISE_SOURCE',sourceId:'pipeline-promise',text:'Revised source text requiring review.'},
    {type:'SET_POLICY',policy:{claimLimitCents:500000,renewalLimitCents:0,allowNewCommitments:false}},
    {type:'REVERSE_CREDIT',creditId:'credit-pipeline-900',amountCents:100,sourceIds:['pipeline-invoice']},
  ]) {
    const changed=send(initial,command);
    errorCode(()=>send(changed,{type:'EXECUTE_ACTION',actionId:'action-pipeline-preserve'}),'STALE_APPROVAL');
    assert.equal(view(changed).actions.find(a=>a.id==='action-pipeline-preserve').status,'stale');
  }
});

test('action execution is one-use while request retries remain safe',()=>{
  let s=send(createDemoWorkspace(),{type:'APPROVE_ACTION',actionId:'action-pipeline-preserve'});
  const cmd={id:'execute-once',type:'EXECUTE_ACTION',actionId:'action-pipeline-preserve'};const result=reduceWorkspace(s,cmd,ctx('executor'));s=result.state;
  assert.equal(result.result.mode,'local_simulation');assert.match(result.result.notice,/No email/);
  assert.equal(reduceWorkspace(s,cmd,ctx('executor')).state,s);
  errorCode(()=>send(s,{type:'EXECUTE_ACTION',actionId:'action-pipeline-preserve'},ctx('executor')),'ALREADY_EXECUTED');
});

test('policy updates recompute current action decisions and mark the original proposal stale',()=>{
  let s=createDemoWorkspace();s=send(s,{type:'SET_POLICY',policy:{claimLimitCents:100,renewalLimitCents:0,allowNewCommitments:false}});
  const a=view(s).actions.find(a=>a.id==='action-pipeline-preserve');
  assert.equal(a.proposedPolicyDecision.allowed,true);assert.equal(a.policyDecision.allowed,false);assert.equal(a.proposalStale,true);assert.equal(a.status,'stale');
});

test('accepted future amendments wait for effective time, and approvals alone do not accept them',()=>{
  let s=createDemoWorkspace();s=send(s,{type:'DISMISS_AMENDMENT',amendmentId:'amendment-pipeline-renewal',reason:'Decline renewal alternative before selecting date amendment.'});s=send(s,{type:'PROPOSE_ACTION',action:{id:'date-action',commitmentId:'pipeline-seats',type:'accept_amendment',payload:{amendmentId:'amendment-pipeline-date'}}});
  s=send(s,{type:'APPROVE_ACTION',actionId:'date-action'});
  assert.equal(commitment(s).dueDate,'2026-10-01');
  s=send(s,{type:'EXECUTE_ACTION',actionId:'date-action'});
  assert.equal(commitment(s).dueDate,'2026-10-01');assert.equal(commitment(s).futureAcceptedAmendmentIds.length,1);
  assert.equal(commitment(s,'pipeline-seats',{asOf:'2026-11-02'}).dueDate,'2026-11-15');
});

test('an explicitly authorized renewal records the new obligation but creates no applied savings',()=>{
  let s=createDemoWorkspace();
  s=send(s,{type:'SET_POLICY',policy:{claimLimitCents:500000,renewalLimitCents:240000,allowNewCommitments:true}});
  s=send(s,{type:'PROPOSE_ACTION',action:{id:'authorized-renewal',commitmentId:'orbit-renewal',type:'accept_amendment',payload:{amendmentId:'amendment-orbit-renewal'}}});
  s=send(s,{type:'APPROVE_ACTION',actionId:'authorized-renewal'},ctx('approver'));
  s=send(s,{type:'EXECUTE_ACTION',actionId:'authorized-renewal'},ctx('executor'));
  const before=commitment(s,'orbit-renewal');assert.equal(before.conditions.length,1);assert.equal(before.incrementalObligationCents,0);assert.equal(before.futureIncrementalObligationCents,240000);
  const effective=commitment(s,'orbit-renewal',{asOf:'2026-11-01'});assert.deepEqual(effective.conditions,[]);assert.equal(effective.verifiedCents,0);assert.equal(effective.incrementalObligationCents,240000);assert.equal(effective.netVerifiedValueCents,-240000);
  assert.equal(effective.acceptedEconomics[0].netIncrementalValueCents,-192000);
});

test('missing source arrays fail schema validation as typed domain errors',()=>{
  errorCode(()=>send(minimal(),credit('no-source',{sourceIds:undefined})),'VALIDATION');
});

test('knowledge-time replay never imports late amendments into an earlier assessment',()=>{
  const scenario=runScenario('late-amendment');assert.equal(scenario.passed,true);
  const early=evaluateWorkspace(scenario.workspace,{asOf:'2026-10-29',knownAt:'2026-10-29T23:59:59.000Z'});
  const later=evaluateWorkspace(scenario.workspace,{asOf:'2026-10-29',knownAt:'2026-11-06T00:00:00.000Z'});
  assert.equal(early.commitments.find(c=>c.id==='pipeline-seats').dueDate,'2026-10-01');
  assert.equal(later.commitments.find(c=>c.id==='pipeline-seats').dueDate,'2026-11-15');
  assert.match(later.observationBoundary.assertion,/not a source-completeness/);
});

test('claim deadlines are recomputed as time passes and can block a previously approved action',()=>{
  let s=send(createDemoWorkspace(),{type:'APPROVE_ACTION',actionId:'action-nimbus-claim'});
  assert.equal(commitment(s,'nimbus-sla',{asOf:'2026-10-30'}).deadline.state,'due_today');
  assert.equal(commitment(s,'nimbus-sla',{asOf:'2026-10-31'}).deadline.state,'expired');
  errorCode(()=>send(s,{type:'EXECUTE_ACTION',actionId:'action-nimbus-claim'},ctx('executor','2026-10-31T12:00:00.000Z')),'POLICY_BLOCKED');
  assert.equal(view(s,{asOf:'2026-10-31'}).actions.find(a=>a.id==='action-nimbus-claim').status,'blocked');
});

test('source lineage retains old revisions, accepted changes and reversal causality without dangling nodes',()=>{
  let s=createDemoWorkspace();const old=view(s).sources.find(x=>x.id==='pipeline-promise').revision;
  s=send(s,{type:'REVISE_SOURCE',sourceId:'pipeline-promise',text:'Revised source'});
  s=send(s,{type:'REVERSE_CREDIT',creditId:'credit-pipeline-900',amountCents:90000,sourceIds:['pipeline-invoice']});
  const v=view(s);assert.ok(v.sourceVersions.some(x=>x.id==='pipeline-promise'&&x.revision===old));assert.equal(commitment(s).sourceChanged,true);
  assert.ok(v.graph.edges.some(e=>e.relation==='reverses'));assert.ok(v.graph.nodes.some(n=>n.id===`source:pipeline-promise@${old}`));
  const ids=new Set(v.graph.nodes.map(n=>n.id));for(const edge of v.graph.edges){assert.ok(ids.has(edge.from));assert.ok(ids.has(edge.to));}
});

test('historical financial snapshots tolerate currently known actions for not-yet-effective commitments',()=>{
  const v=evaluateWorkspace(createDemoWorkspace(),{asOf:'2026-09-01',knownAt:'2026-10-29T00:00:00.000Z'});
  assert.equal(v.commitments.length,0);assert.equal(v.totals.verifiedCents,0);
  assert.equal(v.actions.every(a=>!a.policyDecision.allowed),true);
  assert.equal(validateWorkspace(createDemoWorkspace(),{asOf:'2026-09-01'}).valid,true);
});

test('observation time cannot be backdated and future application evidence is not accepted',()=>{
  const s=createDemoWorkspace();
  errorCode(()=>send(s,{type:'REVISE_SOURCE',sourceId:'pipeline-promise',text:'backdated'},ctx('admin','2026-10-01T12:00:00Z')),'VALIDATION');
  errorCode(()=>send(s,{type:'APPLY_CREDIT',creditId:'credit-nimbus-2000',sourceIds:['nimbus-memo'],effectiveDate:'2027-01-01'}),'VALIDATION');
  errorCode(()=>send(minimal(),credit(),{actor,now:'2026-10-29T12:00:00'}),'VALIDATION');
});

test('future allocations cannot reserve the same credit twice or bypass future identity uniqueness',()=>{
  const s=send(minimal(),credit()),before=canonical(s);
  for(const allocationId of ['future-a','future-b'])errorCode(()=>send(s,{...allocation(allocationId),effectiveDate:'2026-11-01'}),'VALIDATION');
  errorCode(()=>send(s,{type:'REVERSE_CREDIT',creditId:'cr',amountCents:10000,sourceIds:['i'],effectiveDate:'2026-11-01'}),'VALIDATION');
  errorCode(()=>send(s,{type:'RESOLVE_CREDIT',creditId:'cr',assignments:[{commitmentId:'a',limitCents:10000}],sourceIds:['i'],effectiveDate:'2026-11-01'}),'VALIDATION');
  for(let index=0;index<2;index++)errorCode(()=>send(s,{type:'CREATE_COMMITMENT',effectiveDate:'2026-11-01',commitment:{id:'future-identity',vendorId:'v',currency:'USD',reference:'REF-FUTURE',promisedCents:10000,dueDate:'2026-11-15',sourceIds:['s']}}),'VALIDATION');
  assert.equal(canonical(s),before);
  assert.equal(validateWorkspace(s,{asOf:'2026-11-01'}).valid,true);
  assert.equal(evaluateWorkspace(s,{asOf:'2026-11-01'}).credits[0].allocatedCents,0);
});

const amend=(id,patch,effectiveDate='2026-11-01',extra={})=>({type:'PROPOSE_AMENDMENT',amendment:{id,commitmentId:'a',patch,effectiveDate,sourceIds:['s'],...extra}});
const acceptAction=(id,amendmentId)=>({type:'PROPOSE_ACTION',action:{id,commitmentId:'a',type:'accept_amendment',payload:{amendmentId}}});
function executeAmendment(s,amendmentId,id='choose',context=ctx()) {
  s=send(s,acceptAction(id,amendmentId),context);s=send(s,{type:'APPROVE_ACTION',actionId:id},context);return send(s,{type:'EXECUTE_ACTION',actionId:id},context);
}

test('competing proposal branches are quarantined until an approver dismisses alternatives',()=>{
  let s=send(minimal(),amend('branch-a',{dueDate:'2026-11-15'}));s=send(s,amend('branch-b',{dueDate:'2026-11-20'}));
  let a=view(s).amendments.find(x=>x.id==='branch-a');assert.deepEqual(a.conflictingAmendmentIds,['branch-b']);assert.deepEqual(a.conflictIds,['branch-b']);
  assert.deepEqual(commitment(s,'a').conflictingAmendmentIds.sort(),['branch-a','branch-b']);
  s=send(s,acceptAction('attempt-a','branch-a'));const action=view(s).actions.find(x=>x.id==='attempt-a');assert.equal(action.policyDecision.allowed,false);assert.ok(action.policyDecision.reasons.some(x=>/Unresolved amendment conflict/.test(x)));
  errorCode(()=>send(s,{type:'APPROVE_ACTION',actionId:'attempt-a'}),'POLICY_BLOCKED');
  errorCode(()=>send(s,{type:'DISMISS_AMENDMENT',amendmentId:'branch-b',reason:'Decline competing schedule.'},ctx('analyst')),'FORBIDDEN');
  s=send(s,{type:'DISMISS_AMENDMENT',amendmentId:'branch-b',reason:'Retain the November 15 schedule; reject the later alternative.'},ctx('approver'));
  a=view(s).amendments.find(x=>x.id==='branch-a');assert.deepEqual(a.conflictIds,[]);assert.equal(a.basisStale,false);
  const rejected=view(s).amendments.find(x=>x.id==='branch-b');assert.equal(rejected.rejected,true);assert.match(rejected.dismissal.reason,/reject/);assert.equal(rejected.dismissal.actor.role,'approver');
  assert.equal(commitment(s,'a').dueDate,'2026-10-01');
  s=executeAmendment(s,'branch-a','resolved-a');assert.equal(commitment(s,'a',{asOf:'2026-11-02'}).dueDate,'2026-11-15');
  assert.ok(view(s).graph.edges.some(e=>e.relation==='dismisses'));
  errorCode(()=>send(s,{type:'DISMISS_AMENDMENT',amendmentId:'branch-a',reason:'Pretend the accepted contract never happened.'}),'CONFLICT');
});

test('preserving the original claim stays available while counteroffers conflict',()=>{
  let s=createDemoWorkspace();const c=commitment(s);assert.equal(c.conflictingAmendmentIds.length,2);
  const preserve=view(s).actions.find(a=>a.id==='action-pipeline-preserve');assert.equal(preserve.policyDecision.allowed,true);
  s=send(s,{type:'APPROVE_ACTION',actionId:preserve.id});s=send(s,{type:'EXECUTE_ACTION',actionId:preserve.id});
  assert.equal(commitment(s).dueDate,'2026-10-01');assert.equal(commitment(s).promisedCents,240000);assert.equal(commitment(s).acceptedAmendmentIds.length,0);
});

test('different renewal economics conflict even when the patched schedule is identical',()=>{
  const economics={kind:'renewal',baselineCostCents:100000,baselineDescription:'Explicit equal-service annual baseline.',newCommitment:true};
  let s=send(minimal(),amend('price-a',{dueDate:'2026-11-15'},'2026-11-01',{...economics,incrementalRenewalCostCents:1000}));
  s=send(s,amend('price-b',{dueDate:'2026-11-15'},'2026-11-01',{...economics,incrementalRenewalCostCents:2000}));
  assert.deepEqual(view(s).amendments.find(a=>a.id==='price-a').conflictIds,['price-b']);
});

test('an old pending amendment cannot be revived by a fresh action after the accepted branch advances',()=>{
  let s=send(minimal(),amend('first',{dueDate:'2026-11-15'}));
  // An identical proposal is not a conflicting alternative, but it shares the old basis.
  s=send(s,amend('old-copy',{dueDate:'2026-11-15'}));
  s=executeAmendment(s,'first','choose-first');
  const old=view(s).amendments.find(a=>a.id==='old-copy');assert.equal(old.basisStale,true);assert.deepEqual(old.baseAcceptedAmendmentIds,[]);
  s=send(s,acceptAction('fresh-action-old-proposal','old-copy'));
  const action=view(s).actions.find(a=>a.id==='fresh-action-old-proposal');assert.equal(action.proposalStale,false);assert.equal(action.policyDecision.allowed,false);assert.ok(action.policyDecision.reasons.some(x=>/basis is stale/.test(x)));
  errorCode(()=>send(s,{type:'APPROVE_ACTION',actionId:action.id}),'POLICY_BLOCKED');
});

test('ordinary sequential amendments bind the newer accepted current-term revision',()=>{
  let s=send(minimal(),amend('current-first',{dueDate:'2026-11-15'},'2026-10-29'));
  s=executeAmendment(s,'current-first','choose-current');const priorRevision=commitment(s,'a').revision;
  s=send(s,amend('current-second',{dueDate:'2026-11-20'},'2026-10-30'),ctx('admin','2026-10-30T12:00:00.000Z'));
  const proposed=view(s,{asOf:'2026-10-30'}).amendments.find(a=>a.id==='current-second');assert.equal(proposed.baseCommitmentRevision,priorRevision);assert.deepEqual(proposed.baseAcceptedAmendmentIds,['current-first']);assert.equal(proposed.basisStale,false);
  s=executeAmendment(s,'current-second','choose-second',ctx('admin','2026-10-30T12:00:00.000Z'));
  assert.equal(commitment(s,'a',{asOf:'2026-10-30'}).dueDate,'2026-11-20');
});

test('an incompatible accepted future schedule needs explicit supported supersession',()=>{
  let s=send(minimal(),amend('accepted-future',{dueDate:'2026-11-15'}));s=executeAmendment(s,'accepted-future','choose-future');
  s=send(s,amend('implicit-overwrite',{dueDate:'2026-11-25'},'2026-10-30'));
  let proposal=view(s).amendments.find(a=>a.id==='implicit-overwrite');assert.deepEqual(proposal.conflictingAcceptedAmendmentIds,['accepted-future']);
  s=send(s,acceptAction('bad-overwrite','implicit-overwrite'));errorCode(()=>send(s,{type:'APPROVE_ACTION',actionId:'bad-overwrite'}),'POLICY_BLOCKED');
  s=send(s,{type:'DISMISS_AMENDMENT',amendmentId:'implicit-overwrite',reason:'Replace this implicit overwrite with a proposal naming its accepted predecessor.'});
  s=send(s,amend('explicit-replacement',{dueDate:'2026-11-25'},'2026-10-30',{supersedesAmendmentIds:['accepted-future']}));
  proposal=view(s).amendments.find(a=>a.id==='explicit-replacement');assert.deepEqual(proposal.conflictingAcceptedAmendmentIds,[]);
  s=executeAmendment(s,'explicit-replacement','choose-replacement');
  const future=view(s,{asOf:'2026-11-02'});assert.equal(future.commitments.find(c=>c.id==='a').dueDate,'2026-11-25');
  const predecessor=future.amendments.find(a=>a.id==='accepted-future');assert.equal(predecessor.superseded,true);assert.deepEqual(predecessor.supersededByAmendmentIds,['explicit-replacement']);
  assert.ok(future.graph.edges.some(e=>e.relation==='explicitly_replaces'));assert.equal(validateWorkspace(s,{asOf:'2026-11-02'}).valid,true);
});

test('dismissed proposals retain history and cannot be accepted or silently dismissed twice',()=>{
  let s=send(minimal(),amend('declined',{dueDate:'2026-11-15'}));
  errorCode(()=>send(s,{type:'DISMISS_AMENDMENT',amendmentId:'declined',reason:' '}),'VALIDATION');
  s=send(s,{type:'DISMISS_AMENDMENT',amendmentId:'declined',reason:'Finance rejects this date change.'});
  errorCode(()=>send(s,{type:'DISMISS_AMENDMENT',amendmentId:'declined',reason:'Again'}),'CONFLICT');
  s=send(s,acceptAction('revive-declined','declined'));errorCode(()=>send(s,{type:'APPROVE_ACTION',actionId:'revive-declined'}),'POLICY_BLOCKED');
  assert.equal(commitment(s,'a').pendingAmendmentIds.length,0);assert.equal(view(s).amendments.length,1);
});

test('all authored scenario checks execute rather than reporting canned outcomes',()=>{
  for(const scenario of scenarios){const result=runScenario(scenario.id);assert.equal(result.passed,true,scenario.id);assert.ok(result.checks.length>=2);assert.ok(result.steps.length||scenario.id==='deadline-drift');assert.equal(result.checks.every(c=>c.passed),true);}
});

test('deterministic adversarial event sequences preserve money, immutability, retries and knowledge boundaries',()=>{
  let successes=0,rejections=0;
  for(let seed=1;seed<=16;seed++) {
    let random=seed;const next=()=>{random^=random<<13;random^=random>>>17;random^=random<<5;return random>>>0;};
    let s=minimal();
    for(let index=0;index<40;index++) {
      const time=new Date(Date.parse('2026-11-01T12:00:00.000Z')+index*1000).toISOString();
      const before=canonical(s),v=evaluateWorkspace(s,{asOf:'2026-11-01',knownAt:time}),pick=next()%7;
      const currentCredit=v.credits.length?v.credits[next()%v.credits.length]:null;
      let command;
      if(pick===0||!currentCredit)command=credit(`cr-${seed}-${index}`,{reference:next()%2?'REF-A':'REF-B',amountCents:next()%10000+1,status:next()%2?'applied':'issued'});
      else if(pick===1)command=allocation(`al-${seed}-${index}`,next()%(currentCredit.availableCents+101)+1,{creditId:currentCredit.id,commitmentId:next()%4===0?(currentCredit.reference==='REF-A'?'b':'a'):(currentCredit.reference==='REF-A'?'a':'b')});
      else if(pick===2)command={type:'REVERSE_CREDIT',creditId:currentCredit.id,amountCents:next()%(currentCredit.availableCents+101)+1,sourceIds:['i']};
      else if(pick===3)command={type:'APPLY_CREDIT',creditId:currentCredit.id,sourceIds:['i']};
      else if(pick===4)command={type:'REVISE_SOURCE',sourceId:'s',text:`Synthetic revision ${seed}/${index}.`};
      else if(pick===5)command={type:'PROPOSE_ACTION',action:{id:`action-${seed}-${index}`,commitmentId:next()%2?'a':'b',type:'prepare_claim',payload:{}}};
      else {const action=v.actions.length?v.actions[next()%v.actions.length]:null;command=action?{type:action.approval?'EXECUTE_ACTION':'APPROVE_ACTION',actionId:action.id}:credit(`fallback-${seed}-${index}`);}
      command={id:`fuzz-${seed}-${index}`,...command};
      try {
        const result=reduceWorkspace(s,command,ctx('admin',time));
        assert.equal(canonical(s),before,'Reducer mutated its input.');
        s=result.state;successes++;
        assert.equal(reduceWorkspace(s,command,ctx('admin',time)).state,s,'Request retry produced another event.');
      } catch(error) {assert.ok(error instanceof DomainError,error.stack);assert.equal(canonical(s),before);rejections++;}
      const invariant=validateWorkspace(s,{asOf:'2026-11-01',knownAt:time});assert.equal(invariant.valid,true,invariant.violations.join('; '));
      const oldKnownAt=new Date(Date.parse(time)-1).toISOString();
      const retrospective=evaluateWorkspace(s,{asOf:'2026-11-01',knownAt:oldKnownAt});
      for(const key of ['commitments','credits','allocations','sources','totals'])assert.equal(canonical(retrospective[key]),canonical(v[key]),`Late event leaked into previous knowledge: ${key}`);
    }
  }
  assert.ok(successes>150,`Only ${successes} successful transitions.`);assert.ok(rejections>50,`Only ${rejections} adversarial rejections.`);
});
