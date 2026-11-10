import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkspace,createDemoWorkspace,reduceWorkspace,evaluateWorkspace} from '../assurance/index.mjs';
import {TEAM_MEMBERS,deriveTeamCase,deriveTeamDirectory} from './team-model.mjs';

const now='2026-11-10T12:00:00.000Z',context={asOf:'2026-11-10',knownAt:now};
const send=(state,command,at=now)=>reduceWorkspace(state,command,{actor:{id:'model-operator',role:'admin'},now:at});
const derive=(state,id,extra={})=>deriveTeamCase(state,{...context,commitmentId:id,...extra});
function basic(){let state=createWorkspace();for(const command of [
 {type:'ADD_VENDOR',vendor:{id:'company',name:'A long company name with distinct case identity'}},
 {type:'ADD_SOURCE',source:{id:'promise-source',vendorId:'company',kind:'email',title:'Original promise',text:'We will credit USD100, reference AC-1, on the November 1, 2026 invoice.'}},
 {type:'CREATE_COMMITMENT',commitment:{id:'case',vendorId:'company',reference:'AC-1',currency:'USD',promisedCents:10000,dueDate:'2026-11-01',conditions:[],sourceIds:['promise-source']}},
 ])state=send(state,command).state;return state;}
function addCredit(state,{id='credit',source='credit-source',amount=10000,status='issued',kind='credit_memo',at=now}={}){state=send(state,{type:'ADD_SOURCE',source:{id:source,vendorId:'company',kind,title:'Actual credit document',text:`Credit ${id} records USD${amount/100} for AC-1.`}},at).state;return send(state,{type:'REGISTER_CREDIT',credit:{id,invoiceId:`INV-${id}`,lineId:`line-${id}`,vendorId:'company',reference:'AC-1',currency:'USD',amountCents:amount,status,sourceIds:[source]}},at).state;}

test('the team has stable distinct software identities; empty and unavailable cases never substitute',()=>{
 assert.deepEqual(TEAM_MEMBERS.map(m=>m.id),['evidence','analyst','reviewer','operator','bookkeeper']);
 assert.equal(new Set(TEAM_MEMBERS.map(m=>m.name)).size,5);
 for(const state of [null,createWorkspace()]){const result=derive(state,'missing');assert.equal(result.available,false);assert.deepEqual(result.steps,[]);assert.deepEqual(result.handoffs,[]);assert.equal(result.commitment,null);}
 const state=createDemoWorkspace(),missing=derive(state,'not-a-case');assert.equal(missing.available,false);assert.equal(missing.commitment,null);assert.equal(missing.nextAction.commitmentId,null);
 assert.equal(deriveTeamDirectory(state,context).cases.length,4);assert.equal(deriveTeamDirectory(null).cases.length,0);
});

test('Pipeline walkthrough carries exact promise, invoice and renewal economics without a financial write',()=>{
 const state=createDemoWorkspace(),before=JSON.stringify(state),result=derive(state,'pipeline-seats');
 assert.equal(result.vendor.name,'Pipeline CRM');assert.equal(result.summary.promisedCents,240000);assert.equal(result.summary.appliedCents,90000);assert.equal(result.summary.missingCents,150000);
 assert.equal(result.summary.invoiceBackedCents,90000);assert.equal(result.summary.conditional,false);
 const promise=result.steps.find(s=>s.id.endsWith(':promise')),invoice=result.steps.find(s=>s.id.endsWith(':invoice')),renewal=result.steps.find(s=>s.artifact.amendmentId==='amendment-pipeline-renewal');
 assert.equal(promise.artifact.sourceId,'pipeline-promise');assert.equal(promise.artifact.revision,6);assert.equal(invoice.artifact.creditId,'credit-pipeline-900');assert.equal(invoice.artifact.sourceId,'pipeline-invoice');
 assert.match(renewal.title,/\$900 more/);assert.equal(renewal.economics.creditCents,150000);assert.equal(renewal.economics.incrementalRenewalCostCents,240000);
 assert.equal(result.current.status,'blocked');assert.equal(result.current.owner,'reviewer');assert.equal(result.nextAction.actionId,'action-pipeline-renewal');
 assert(result.current.blockers.some(x=>x.includes('Two proposed changes overlap')));
 assert(result.steps.every(s=>s.kind==='derived-finding'));assert(result.handoffs.every(s=>s.kind==='recorded-event'&&s.messageRecorded===false));
 assert.equal(JSON.stringify(state),before);assert.equal(result.walkthroughLabel,'Case walkthrough');
 for(const step of result.steps)for(const link of step.sourceLinks)assert(result.view.sourceVersions.some(s=>s.id===link.sourceId&&s.revision===link.revision));
});

test('Nimbus note is handed to invoice checking and never shown as applied credit or a fresh expired claim',()=>{
 const result=derive(createDemoWorkspace(),'nimbus-sla');
 assert.equal(result.summary.appliedCents,0);assert.equal(result.summary.issuedMatchedCents,200000);assert.equal(result.summary.missingCents,200000);
 assert(result.steps.some(s=>s.title==='Credit note found'&&s.amountCents===200000&&s.artifact.creditId==='credit-nimbus-2000'));
 assert.equal(result.steps.some(s=>s.title==='Invoice credit found'),false);assert.equal(result.nextAction.destination,'ledger');assert.equal(result.nextAction.actionId,null);assert.equal(result.current.owner,'bookkeeper');assert.equal(result.steps.at(-1).artifact.actionId,undefined);assert.equal(result.steps.at(-1).artifact.sourceId,'nimbus-memo');
});

test('conditional offers stay conditional while the absent invoice and actual extra spending remain explicit',()=>{
 const result=derive(createDemoWorkspace(),'orbit-renewal');
 assert.equal(result.summary.conditional,true);assert.match(result.summary.headline,/offer/);assert.equal(result.summary.appliedCents,0);
 assert(result.steps.some(s=>s.title==='Conditional value checked'&&s.body.includes('conditional')));
 assert(result.steps.some(s=>s.title.includes('$1,920 more')));assert(!result.steps.find(s=>s.id.endsWith(':balance')).body.includes('still missing'));
 const parcel=derive(createDemoWorkspace(),'parcel-waiver');assert(parcel.steps.some(s=>s.id.endsWith(':no-invoice')));assert.equal(parcel.credits.length,0);assert.equal(parcel.nextAction.requiresRole,'analyst');
});

test('physical credit face and its matched case share stay separate through partial allocation and reversal',()=>{
 let state=addCredit(basic(),{amount:20000});state=send(state,{type:'ALLOCATE_CREDIT',allocationId:'part',creditId:'credit',commitmentId:'case',amountCents:10000}).state;
 let result=derive(state,'case');assert.equal(result.credits[0].amountCents,20000);assert.equal(result.credits[0].matchedCents,10000);assert.equal(result.summary.issuedMatchedCents,10000);assert.equal(result.steps.find(s=>s.id.endsWith(':note')).amountCents,10000);
 state=send(state,{type:'REVERSE_CREDIT',creditId:'credit',amountCents:15000,sourceIds:['credit-source']}).state;
 result=derive(state,'case');const credit=result.credits[0];assert.equal(credit.amountCents,credit.reversedCents+credit.allocatedCents+credit.unallocatedCents);assert.equal(credit.availableCents,5000);assert.equal(result.summary.appliedCents,0);assert.equal(result.summary.issuedMatchedCents,5000);
 const reversal=result.handoffs.find(h=>h.eventType==='CREDIT_REVERSED');assert.equal(reversal.amountCents,15000);assert.match(reversal.body,/recorded credit/);
});

test('handoffs preserve exact event actor, sequence, amount and original source revision',()=>{
 const state=createDemoWorkspace(),result=derive(state,'pipeline-seats');
 for(const handoff of result.handoffs){const event=state.events.find(e=>e.id===handoff.eventId);assert(event);assert.equal(handoff.sequence,event.sequence);assert.equal(handoff.observedAt,event.observedAt);assert.equal(handoff.effectiveDate,event.effectiveDate);assert.deepEqual(handoff.actor,event.actor);}
 assert.deepEqual(result.handoffs.map(h=>h.sequence),result.handoffs.map(h=>h.sequence).sort((a,b)=>a-b));
 assert(result.handoffs.every(h=>!h.sourceLinks.some(l=>l.sourceId.startsWith('nimbus'))));
 const creation=result.handoffs.find(h=>h.eventType==='COMMITMENT_CREATED');assert.equal(creation.amountCents,240000);assert.equal(creation.sourceLinks[0].revision,6);
 const match=result.handoffs.find(h=>h.eventType==='CREDIT_ALLOCATED');assert.equal(match.amountCents,90000);assert.equal(match.artifact.allocationId,'allocation-pipeline');
});

test('a later invoice application does not leak its new evidence into an earlier matching handoff',()=>{
 let state=addCredit(basic());state=send(state,{type:'ALLOCATE_CREDIT',allocationId:'match',creditId:'credit',commitmentId:'case',amountCents:10000}).state;
 const at='2026-11-11T12:00:00.000Z';state=send(state,{type:'ADD_SOURCE',source:{id:'later-invoice',vendorId:'company',kind:'invoice',title:'Later invoice',text:'Invoice confirms USD100 credit for AC-1.'}},at).state;
 state=send(state,{type:'APPLY_CREDIT',creditId:'credit',sourceIds:['later-invoice']},at).state;
 const result=derive(state,'case',{asOf:'2026-11-11',knownAt:at});assert.equal(result.summary.appliedCents,10000);
 const earlier=result.handoffs.find(h=>h.eventType==='CREDIT_ALLOCATED');assert(earlier.sourceLinks.some(l=>l.sourceId==='credit-source'));assert.equal(earlier.sourceLinks.some(l=>l.sourceId==='later-invoice'),false);
 assert(result.handoffs.find(h=>h.eventType==='CREDIT_APPLIED').sourceLinks.some(l=>l.sourceId==='later-invoice'));
});

test('known and financial cutoffs hide future evidence and preserve the exact visible case',()=>{
 const state=createDemoWorkspace(),early=derive(state,'pipeline-seats',{asOf:'2026-09-20',knownAt:'2026-09-20T23:59:59.999Z'});
 assert.equal(early.summary.promisedCents,240000);assert.equal(early.summary.appliedCents,0);assert.equal(early.amendments.length,0);assert.equal(early.actions.length,0);assert(early.handoffs.every(h=>h.observedAt<='2026-09-20T23:59:59.999Z'));assert(!early.sourceLinks.some(l=>l.sourceId==='pipeline-invoice'));
 assert.equal(derive(state,'pipeline-seats',{asOf:'2026-09-17',knownAt:'2026-09-17T23:59:59.999Z'}).available,false);
 const oldFinancial=derive(state,'pipeline-seats',{asOf:'2026-09-20'});assert.equal(oldFinancial.summary.appliedCents,0);assert.equal(oldFinancial.steps.some(s=>s.title==='Invoice credit found'),false);
});

test('a decline closes the offer, keeps the recorded reason and prevents another accept path',()=>{
 let state=createDemoWorkspace();state=send(state,{type:'DISMISS_AMENDMENT',amendmentId:'amendment-pipeline-renewal',reason:'Keep the existing price.'}).state;
 const result=derive(state,'pipeline-seats'),decline=result.steps.find(s=>s.status==='declined');assert(decline);assert.equal(decline.body,'Keep the existing price.');assert.equal(decline.artifact.amendmentId,'amendment-pipeline-renewal');
 assert.equal(result.steps.some(s=>s.id==='pipeline-seats:terms:amendment-pipeline-renewal'),false);assert.notEqual(result.nextAction.actionId,'action-pipeline-renewal');
 const event=result.handoffs.find(h=>h.eventType==='AMENDMENT_DISMISSED');assert.equal(event.body,decline.body);assert.equal(event.eventId,decline.recordedEventId);
});

test('the newest exact approval and recording control the handoff, not an earlier stale review',()=>{
 let state=basic(),proposal=send(state,{type:'PROPOSE_ACTION',action:{commitmentId:'case',type:'prepare_claim',payload:{}}});state=proposal.state;
 const oldId=proposal.result.actionId;state=send(state,{type:'REVISE_SOURCE',sourceId:'promise-source',text:'Updated original source, still USD100 for AC-1.'}).state;
 assert.equal(derive(state,'case').current.status,'changed');
 proposal=send(state,{type:'PROPOSE_ACTION',action:{commitmentId:'case',type:'prepare_claim',payload:{}}});state=proposal.state;
 const actionId=proposal.result.actionId;state=send(state,{type:'APPROVE_ACTION',actionId}).state;
 let result=derive(state,'case');assert.equal(result.nextAction.actionId,actionId);assert.equal(result.current.status,'approved');assert.equal(result.current.owner,'operator');assert.equal(result.nextAction.requiresRole,'executor');
 state=send(state,{type:'EXECUTE_ACTION',actionId}).state;result=derive(state,'case');assert.equal(result.current.status,'recorded');assert.equal(result.nextAction.actionId,actionId);assert.notEqual(result.nextAction.actionId,oldId);assert.equal(result.summary.appliedCents,0);assert.equal(result.summary.missingCents,10000);
 assert.equal(result.handoffs.filter(h=>h.eventType==='ACTION_EXECUTED').length,1);assert.equal(evaluateWorkspace(state,context).actions.find(a=>a.id===oldId).executed,false);
});

 test('accepted changes retain the original promise speech while current figures link their actual accepted source',()=>{
 let state=basic();state=send(state,{type:'ADD_SOURCE',source:{id:'accepted-change',vendorId:'company',kind:'email',title:'Accepted amount and date',text:'We change AC-1 to USD125 due November 20, 2026.'}}).state;
 state=send(state,{type:'PROPOSE_AMENDMENT',amendment:{id:'change',commitmentId:'case',kind:'amount_change',patch:{promisedCents:12500,dueDate:'2026-11-20'},effectiveDate:'2026-11-10',sourceIds:['accepted-change'],baselineCostCents:0,incrementalRenewalCostCents:0,baselineDescription:'Existing agreement with no added spending',newCommitment:false}}).state;
 const proposal=send(state,{type:'PROPOSE_ACTION',action:{commitmentId:'case',type:'accept_amendment',payload:{amendmentId:'change'}}});state=proposal.state;
 state=send(state,{type:'APPROVE_ACTION',actionId:proposal.result.actionId}).state;state=send(state,{type:'EXECUTE_ACTION',actionId:proposal.result.actionId}).state;
 const result=derive(state,'case'),first=result.steps[0],balance=result.steps.find(step=>step.id.endsWith(':balance')),accepted=result.steps.find(step=>step.artifact.amendmentId==='change');
 assert.equal(result.commitment.promisedCents,12500);assert.equal(result.commitment.dueDate,'2026-11-20');
 assert.equal(first.amountCents,10000);assert.match(first.body,/originally promised \$100 by Nov 1, 2026/);assert.doesNotMatch(first.body,/125|Nov 20/);
 assert.equal(first.artifact.sourceId,'promise-source');assert.equal(first.sourceLinks[0].sourceId,'promise-source');
 const originalSource=result.documents.find(source=>source.id===first.artifact.sourceId&&source.revision===first.artifact.revision);assert.match(originalSource.text,/USD100/);assert.match(originalSource.text,/November 1, 2026/);
 assert.equal(result.summary.promisedCents,12500);assert.equal(result.summary.missingCents,12500);assert.match(balance.body,/\$125 promised/);assert.equal(balance.artifact.sourceId,'accepted-change');
 assert.match(accepted.body,/Accepted amount: \$125/);assert.match(accepted.body,/Accepted date: Nov 20, 2026/);assert.equal(accepted.artifact.sourceId,'accepted-change');
 });

test('accepting removal of a condition does not rewrite the original offer as unconditional',()=>{
 let state=createWorkspace();for(const command of [
  {type:'ADD_VENDOR',vendor:{id:'conditional-company',name:'Conditional Company'}},
  {type:'ADD_SOURCE',source:{id:'conditional-original',vendorId:'conditional-company',kind:'email',title:'Original conditional offer',text:'USD100 credit for CONDITIONAL-1 requires renewal.'}},
  {type:'CREATE_COMMITMENT',commitment:{id:'conditional-case',vendorId:'conditional-company',reference:'CONDITIONAL-1',currency:'USD',promisedCents:10000,dueDate:'2026-11-01',conditions:['Renew the contract.'],sourceIds:['conditional-original']}},
  {type:'ADD_SOURCE',source:{id:'condition-removed',vendorId:'conditional-company',kind:'email',title:'Condition removed',text:'CONDITIONAL-1 now has no renewal condition.'}},
  {type:'PROPOSE_AMENDMENT',amendment:{id:'remove-condition',commitmentId:'conditional-case',kind:'conditions_change',patch:{conditions:[]},effectiveDate:'2026-11-10',sourceIds:['condition-removed'],baselineCostCents:0,incrementalRenewalCostCents:0,baselineDescription:'No new obligation',newCommitment:false}},
 ])state=send(state,command).state;
 const proposal=send(state,{type:'PROPOSE_ACTION',action:{commitmentId:'conditional-case',type:'accept_amendment',payload:{amendmentId:'remove-condition'}}});state=proposal.state;
 state=send(state,{type:'APPROVE_ACTION',actionId:proposal.result.actionId}).state;state=send(state,{type:'EXECUTE_ACTION',actionId:proposal.result.actionId}).state;
 const result=derive(state,'conditional-case');assert.equal(result.summary.conditional,false);assert.deepEqual(result.commitment.conditions,[]);
 assert.equal(result.steps[0].title,'Conditional offer found');assert.match(result.steps[0].body,/originally offered \$100 with conditions/);assert.equal(result.steps[0].artifact.sourceId,'conditional-original');
 const accepted=result.steps.find(step=>step.artifact.amendmentId==='remove-condition');assert.match(accepted.body,/removes the prior conditions/);assert.equal(accepted.artifact.sourceId,'condition-removed');
});
