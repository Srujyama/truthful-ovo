import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkspace,createDemoWorkspace,evaluateWorkspace,reduceWorkspace} from './assurance/index.mjs';
import {reviewPresentation,readableReviewReason,reviewFiles} from './review-display.mjs';

const now='2026-11-10T12:00:00.000Z',options={asOf:'2026-11-10',knownAt:now};
const viewOf=state=>evaluateWorkspace(state,options);
const send=(state,command)=>reduceWorkspace(state,command,{actor:{id:'review-test',role:'admin'},now});
function basic(){let state=createWorkspace();for(const command of [
 {type:'ADD_VENDOR',vendor:{id:'acme',name:'Acme'}},
 {type:'ADD_SOURCE',source:{id:'terms',vendorId:'acme',kind:'email',title:'Actual supplied promise',text:'A USD 100 credit on the November 1 invoice, reference AC-1.'}},
 {type:'CREATE_COMMITMENT',commitment:{id:'promise',vendorId:'acme',reference:'AC-1',currency:'USD',promisedCents:10000,dueDate:'2026-11-01',conditions:[],sourceIds:['terms']}},
 {type:'SET_POLICY',policy:{claimLimitCents:1000000,renewalLimitCents:1000000,allowNewCommitments:true}},
 ])state=send(state,command).state;return state;}
function accept(state,amendment){state=send(state,{type:'PROPOSE_AMENDMENT',amendment}).state;const proposal=send(state,{type:'PROPOSE_ACTION',action:{commitmentId:'promise',type:'accept_amendment',payload:{amendmentId:amendment.id}}});state=proposal.state;const id=proposal.result.actionId;state=send(state,{type:'APPROVE_ACTION',actionId:id}).state;state=send(state,{type:'EXECUTE_ACTION',actionId:id}).state;return {state,id};}

test('a live review uses current economics while a recorded comparison keeps its actual execution values',()=>{
 let {state,id}=accept(basic(),{id:'renewal',commitmentId:'promise',kind:'renewal',patch:{conditions:[]},effectiveDate:'2026-11-10',sourceIds:['terms'],baselineCostCents:0,incrementalRenewalCostCents:2000,baselineDescription:'No future spending',newCommitment:true});
 state=send(state,{type:'ADD_SOURCE',source:{id:'invoice',vendorId:'acme',kind:'invoice',title:'Invoice',text:'Invoice AC-INV credits USD 100 for AC-1.'}}).state;
 state=send(state,{type:'REGISTER_CREDIT',credit:{id:'credit',vendorId:'acme',invoiceId:'AC-INV',currency:'USD',reference:'AC-1',amountCents:10000,status:'applied',sourceIds:['invoice']}}).state;
 state=send(state,{type:'ALLOCATE_CREDIT',allocationId:'match',creditId:'credit',commitmentId:'promise',amountCents:10000}).state;
 const view=viewOf(state),action=view.actions.find(a=>a.id===id),p=reviewPresentation(state,view,action);
 assert.equal(action.economics.creditCents,0,'current case has since been fulfilled');
 assert.equal(p.economics.creditCents,10000,'the actual recorded decision remains unchanged');
 assert.equal(p.phase,'recorded');assert.equal(p.netCost,-8000);assert.equal(p.costLabel,'$80 less');
});

test('a date-only change is not a renewal, and the recorded before-date is the previous accepted date',()=>{
 const change=(id,dueDate)=>({id,commitmentId:'promise',kind:'date_change',patch:{dueDate},effectiveDate:'2026-11-10',sourceIds:['terms'],baselineCostCents:0,incrementalRenewalCostCents:0,baselineDescription:'No change to cost',newCommitment:false});
 let result=accept(basic(),change('first','2026-11-15'));
 result=accept(result.state,change('second','2026-11-20'));
 const view=viewOf(result.state),action=view.actions.find(a=>a.id===result.id),p=reviewPresentation(result.state,view,action);
 assert(action.economics,'date actions also contain simulation economics');assert.equal(p.renewal,false);
 assert.equal(p.before.dueDate,'2026-11-15');assert.equal(p.commitment.originalDueDate,'2026-11-01');assert.equal(p.commitment.dueDate,'2026-11-20');
});

test('a changed approved review never displays a current approval stamp',()=>{
 let state=basic(),proposal=send(state,{type:'PROPOSE_ACTION',action:{commitmentId:'promise',type:'prepare_claim',payload:{}}});state=proposal.state;
 state=send(state,{type:'APPROVE_ACTION',actionId:proposal.result.actionId}).state;
 let view=viewOf(state),action=view.actions.find(a=>a.id===proposal.result.actionId);
 assert.equal(reviewPresentation(state,view,action).phase,'approved');
 state=send(state,{type:'REVISE_SOURCE',sourceId:'terms',text:'A changed source that requires a fresh review.'}).state;
 view=viewOf(state);action=view.actions.find(a=>a.id===proposal.result.actionId);
 const p=reviewPresentation(state,view,action);assert.equal(p.phase,'changed');assert.equal(p.approved,false);assert.equal(p.recorded,false);
});

test('review copy translates known restrictions while keeping unknown exact reasons available',()=>{
 const state=createDemoWorkspace(),view=viewOf(state),action=view.actions.find(a=>a.id==='action-pipeline-renewal');
 const p=reviewPresentation(state,view,action);assert.equal(p.renewal,true);assert.equal(p.costLabel,'$900 more');assert.equal(p.economics.creditCents,150000);
 assert.match(readableReviewReason('Unresolved amendment conflict with amendment-x. Finance must dismiss incompatible alternatives before accepting a branch.'),/Two proposed changes overlap/);
 assert.equal(readableReviewReason('Unknown but important rule'),'Unknown but important rule');assert.equal(reviewPresentation(state,view,null),null);
});

 test('a declined offer is terminal rather than a stale review waiting to refresh',()=>{
 let state=createDemoWorkspace();state=send(state,{type:'DISMISS_AMENDMENT',amendmentId:'amendment-pipeline-renewal',reason:'Keep the existing price.'}).state;
 const view=viewOf(state),action=view.actions.find(a=>a.id==='action-pipeline-renewal'),p=reviewPresentation(state,view,action);
 assert.equal(action.proposalStale,true);assert.equal(p.phase,'declined');assert.equal(p.declineReason,'Keep the existing price.');assert.equal(p.stale,false);assert.equal(p.approved,false);assert.equal(p.recorded,false);
 });

test('review files show the latest decision for an intent without losing earlier history',()=>{
 const old={id:'old',commitmentId:'acme',type:'preserve_original',payload:{},executed:false};
 const recorded={...old,id:'recorded',executed:true};
 const rejected={id:'declined',commitmentId:'other',type:'accept_amendment',payload:{amendmentId:'offer'}};
 const view={actions:[old,rejected,recorded],amendments:[{id:'offer',rejected:true}]};
 assert.deepEqual(reviewFiles(view).map(a=>a.id),['recorded']);assert.equal(view.actions.length,3);
});
