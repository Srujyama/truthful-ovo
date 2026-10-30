import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createDemoWorkspace, createWorkspace, evaluateWorkspace, reduceWorkspace } from './assurance/index.mjs';
import { analyzeEvidence } from './engine/index.mjs';
import { prepareEvidenceImport } from './assuranceImport.mjs';
import { batchMutationReason, mutationReason, originalActionSpec, originalReviewState, resolveEvidenceNode, selectDecisionAction } from './assurance-ui.mjs';

const now='2026-10-29T12:00:00.000Z';
const options={asOf:'2026-10-29',knownAt:now};
const context=role=>({actor:{id:`ui-${role}`,role},now});
const send=(state,command,role='admin')=>reduceWorkspace(state,command,context(role));

test('an imported outstanding case prepares, approves and records its own exact action',async()=>{
  const [promiseText,invoiceCsv]=await Promise.all(['pipeline-promise.txt','pipeline-invoices.csv'].map(name=>readFile(new URL(`../public/examples/${name}`,import.meta.url),'utf8')));
  let state=createWorkspace();
  const plan=await prepareEvidenceImport(state,analyzeEvidence({vendor:'Pipeline CRM',promiseText,invoiceCsv,asOf:'2026-10-28'}),now);
  for(const command of plan.commands)state=send(state,command).state;
  let view=evaluateWorkspace(state,options);
  const commitment=view.commitments.find(c=>c.id===plan.commitmentId);
  const review=originalReviewState(state,view,commitment);
  assert.equal(review.action,null);
  assert.equal(review.specification.type,'prepare_claim');
  assert.equal(review.simulation.policyDecision.allowed,true);
  const proposal=send(state,{type:'PROPOSE_ACTION',action:review.specification},'analyst');
  state=proposal.state;
  view=evaluateWorkspace(state,options);
  const action=selectDecisionAction(view,{commitmentId:commitment.id,selectedActionId:proposal.result.actionId});
  assert.equal(action.commitmentId,commitment.id);
  assert.equal(originalReviewState(state,view,commitment).action.id,action.id);
  for(const binding of action.basis.sourceRevisions)assert.ok(resolveEvidenceNode(view,`source:${binding.id}@${binding.revision}`));
  state=send(state,{type:'APPROVE_ACTION',actionId:action.id},'approver').state;
  state=send(state,{type:'EXECUTE_ACTION',actionId:action.id},'executor').state;
  view=evaluateWorkspace(state,options);
  assert.equal(view.actions.find(a=>a.id===action.id).status,'executed');
  assert.equal(originalReviewState(state,view,view.commitments.find(c=>c.id===commitment.id)).action.id,action.id,'returning to the case keeps the recorded action available');
  assert.equal(view.commitments.find(c=>c.id===commitment.id).outstandingCents,150000);
  assert.equal(view.totals.verifiedCents,90000,'local action never invents an applied credit');
  assert.throws(()=>send(state,{type:'EXECUTE_ACTION',actionId:action.id},'executor'),{code:'ALREADY_EXECUTED'});
});

test('an explicit selected case without an action stays empty despite other vendors in the queue',()=>{
  const view=evaluateWorkspace(createDemoWorkspace(),options);
  assert.ok(view.actions.length);
  assert.equal(selectDecisionAction(view,{commitmentId:'parcel-waiver'}),null);
  assert.equal(selectDecisionAction(view,{commitmentId:'missing'}),null);
  assert.equal(selectDecisionAction(view,{commitmentId:'nimbus-sla',selectedActionId:'not-observed-yet'}),null);
  assert.equal(selectDecisionAction(view,{commitmentId:'pipeline-seats'}).commitmentId,'pipeline-seats');
});

test('an older recorded action never hides a newer pending original claim after its evidence changes',()=>{
  let state=createDemoWorkspace();
  const recordedId='action-nimbus-claim';
  state=send(state,{type:'APPROVE_ACTION',actionId:recordedId}).state;
  state=send(state,{type:'EXECUTE_ACTION',actionId:recordedId}).state;
  let view=evaluateWorkspace(state,options);
  const selectedReview=()=>originalReviewState(state,view,view.commitments.find(c=>c.id==='nimbus-sla'));
  assert.equal(selectedReview().action.id,recordedId,'the recorded action remains a fallback until another review exists');
  const pending=send(state,{type:'PROPOSE_ACTION',action:{commitmentId:'nimbus-sla',type:'prepare_claim',payload:{}}});
  state=pending.state;
  view=evaluateWorkspace(state,options);
  assert.equal(selectedReview().action.id,pending.result.actionId,'a fresh pending review takes precedence');
  state=send(state,{type:'REVISE_SOURCE',sourceId:'nimbus-contract',text:'Revised SLA evidence requires another exact review.'}).state;
  view=evaluateWorkspace(state,options);
  assert.equal(view.actions.find(a=>a.id===recordedId).proposalStale,false,'executed actions intentionally retain their recorded status');
  assert.equal(selectedReview().action.id,pending.result.actionId,'the stale pending action must still be available for refresh');
  assert.equal(selectedReview().action.proposalStale,true);
  const fresh=send(state,{type:'PROPOSE_ACTION',action:{commitmentId:'nimbus-sla',type:'prepare_claim',payload:{}}});
  state=fresh.state;
  view=evaluateWorkspace(state,options);
  assert.equal(selectedReview().action.id,fresh.result.actionId,'a current review takes precedence over stale pending reviews');
});

test('historical evidence resolves from the current graph and never falls back to a future object',()=>{
  const state=createDemoWorkspace();
  const current=evaluateWorkspace(state,options);
  const futureNode=current.graph.nodes.find(n=>n.kind==='source'&&n.sourceId==='pipeline-renewal');
  assert.ok(futureNode);
  const historical=evaluateWorkspace(state,{asOf:'2026-10-29',knownAt:'2026-10-27T23:59:59.999Z'});
  assert.equal(resolveEvidenceNode(historical,futureNode),null);
  const remembered=current.graph.nodes.find(n=>n.id==='commitment:pipeline-seats');
  const replayed=resolveEvidenceNode(historical,{...remembered,status:'invented stale status'});
  assert.equal(replayed,historical.graph.nodes.find(n=>n.id===remembered.id));
  assert.notEqual(replayed.status,'invented stale status');
});

test('source revision openers retain the exact bound source after a newer revision arrives',()=>{
  const original=createDemoWorkspace();
  const before=evaluateWorkspace(original,options);
  const action=before.actions.find(a=>a.id==='action-pipeline-preserve');
  const binding=action.basis.sourceRevisions.find(s=>s.id==='pipeline-promise');
  const id=`source:${binding.id}@${binding.revision}`;
  const originalText=resolveEvidenceNode(before,id).text;
  const revised=send(original,{type:'REVISE_SOURCE',sourceId:'pipeline-promise',text:'A later source revision.'}).state;
  const after=evaluateWorkspace(revised,options);
  assert.equal(resolveEvidenceNode(after,id).text,originalText);
  assert.ok(after.actions.find(a=>a.id===action.id).proposalStale);
  const latest=after.sources.find(s=>s.id===binding.id);
  assert.notEqual(latest.revision,binding.revision);
  assert.equal(resolveEvidenceNode(after,`source:${latest.id}@${latest.revision}`).text,'A later source revision.');
});

test('original review preserves pending terms and reports the actual reducer eligibility',()=>{
  const state=createDemoWorkspace();
  const view=evaluateWorkspace(state,options);
  assert.equal(originalActionSpec(view,view.commitments.find(c=>c.id==='pipeline-seats')).type,'preserve_original');
  assert.equal(originalReviewState(state,view,view.commitments.find(c=>c.id==='nimbus-sla')).simulation.policyDecision.allowed,true);
  const future=originalReviewState(state,view,view.commitments.find(c=>c.id==='parcel-waiver'));
  assert.equal(future.simulation.policyDecision.allowed,false);
  assert.match(future.simulation.policyDecision.reasons.join(' '),/not due until/);
  const conditional=originalReviewState(state,view,view.commitments.find(c=>c.id==='orbit-renewal'));
  assert.equal(conditional.simulation.policyDecision.allowed,false);
  assert.match(conditional.simulation.policyDecision.reasons.join(' '),/conditional/);
  const laterView=evaluateWorkspace(state,{asOf:'2026-10-31',knownAt:now});
  const expired=originalReviewState(state,laterView,laterView.commitments.find(c=>c.id==='nimbus-sla'));
  assert.match(expired.simulation.policyDecision.reasons.join(' '),/deadline.*expired/);
});

test('UI role affordances agree with the reducer across review, source, policy, dismissal and ledger writes',()=>{
  const fixtures=[
    {type:'PROPOSE_ACTION',action:{commitmentId:'nimbus-sla',type:'prepare_claim',payload:{}}},
    {type:'APPROVE_ACTION',actionId:'action-nimbus-claim'},
    {type:'EXECUTE_ACTION',actionId:'action-nimbus-claim'},
    {type:'REVISE_SOURCE',sourceId:'pipeline-promise',text:'Source revision for role verification.'},
    {type:'DISMISS_AMENDMENT',amendmentId:'amendment-pipeline-date',reason:'Retain original schedule.'},
    {type:'APPLY_CREDIT',creditId:'credit-nimbus-2000',sourceIds:['invoice-role-check']},
    {type:'REVERSE_CREDIT',creditId:'credit-pipeline-900',amountCents:100,sourceIds:['pipeline-invoice']},
    {type:'SET_POLICY',policy:{claimLimitCents:500000,renewalLimitCents:0,allowNewCommitments:false}},
  ];
  for(const command of fixtures)for(const role of ['admin','analyst','approver','executor','viewer']){
    let state=createDemoWorkspace();
    if(command.type==='APPLY_CREDIT')state=send(state,{type:'ADD_SOURCE',source:{id:'invoice-role-check',vendorId:'nimbus',title:'Applied invoice',kind:'invoice',text:'Invoice applies CM-NC-204 for NC-SLA-2026.'}}).state;
    if(command.type==='EXECUTE_ACTION')state=send(state,{type:'APPROVE_ACTION',actionId:command.actionId}).state;
    const reason=mutationReason(command.type,role);
    if(reason)assert.throws(()=>send(state,command,role),{code:'FORBIDDEN'},`${command.type} / ${role}`);
    else assert.doesNotThrow(()=>send(state,command,role),`${command.type} / ${role}`);
  }
});

test('historical, busy, reset and mixed-role advanced batches explain their disabled state',()=>{
  assert.match(mutationReason('APPROVE_ACTION','admin',{readOnly:true}),/Historical/);
  assert.match(mutationReason('REVISE_SOURCE','admin',{busy:true}),/Wait/);
  assert.match(mutationReason('RESET_WORKSPACE','analyst'),/admin/);
  assert.equal(mutationReason('RESET_WORKSPACE','admin'),'');
  assert.match(batchMutationReason([{type:'ADD_SOURCE'},{type:'APPROVE_ACTION'}],'analyst'),/approver/);
  assert.match(batchMutationReason([{type:'PROPOSE_ACTION'}],'admin',{readOnly:true}),/Historical/);
  assert.match(mutationReason('__proto__','admin'),/supported command/);
});
