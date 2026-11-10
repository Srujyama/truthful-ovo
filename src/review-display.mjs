import {evaluateWorkspace,canonical} from './assurance/index.mjs';
import {formatMoney} from './correspondence.mjs';

/** A recorded decision keeps the comparison that was actually recorded. */
export function reviewPresentation(workspace,view,action){
 if(!action)return null;
 const commitment=view.commitments.find(c=>c.id===action.commitmentId);
 const amendment=view.amendments.find(a=>a.id===action.payload?.amendmentId);
 let before=commitment;
 if(action.executed&&amendment){
  const index=workspace.events.findIndex(e=>e.type==='AMENDMENT_ACCEPTED'&&e.payload.actionId===action.id);
  if(index>0){
   const events=workspace.events.slice(0,index),at=action.execution.executedAt;
   before=evaluateWorkspace({...workspace,events,revision:events.length},{asOf:at.slice(0,10),knownAt:at}).commitments.find(c=>c.id===action.commitmentId)||commitment;
  }
 }
 const economics=action.executed?action.execution?.economics||null:action.economics;
 const renewal=Boolean(amendment&&(amendment.newCommitment||amendment.incrementalRenewalCostCents>0));
 const declined=Boolean(amendment?.rejected&&!action.executed);
 const declineReason=declined?workspace.events.findLast(e=>e.type==='AMENDMENT_DISMISSED'&&e.payload.amendmentId===amendment.id&&e.observedAt<=view.knownAt)?.payload.reason:null;
 const stale=Boolean(!declined&&!action.executed&&(action.proposalStale||action.approvalStale));
 const company=view.vendors.find(v=>v.id===commitment?.vendorId)?.name||'Company';
 const currency=commitment?.currency||'USD',money=value=>formatMoney(value,currency);
 const netCost=economics?economics.incrementalRenewalCostCents-economics.creditCents:null;
 const costLabel=netCost===null?null:netCost>0?`${money(netCost)} more`:netCost<0?`${money(-netCost)} less`:'No extra cost after the credit';
 const label=action.type==='accept_amendment'?renewal?'Renewal offer':amendment?.patch?.dueDate?'Proposed date change':'Proposed terms':action.type==='preserve_original'?'Keep the original terms':'Request the agreed credit';
 return {commitment,amendment,before,economics,renewal,stale,declined,declineReason,company,currency,netCost,costLabel,label,
  phase:action.executed?'recorded':declined?'declined':stale?'changed':action.approval?'approved':'review',
  approved:Boolean(action.approval&&!stale&&!declined),recorded:Boolean(action.executed),
 };
}

export function readableReviewReason(reason){
 if(reason.startsWith('Unresolved amendment conflict'))return 'Two proposed changes overlap. Decline the incompatible offer before accepting one.';
 if(reason==='Policy forbids new contractual commitments.')return 'Your review rules do not allow a new contract.';
 if(reason==='Incremental renewal cost exceeds the policy limit.')return 'The extra spending is above your review limit.';
 if(reason.startsWith('Action amount exceeds'))return 'The credit amount is above your review limit.';
 if(reason.startsWith('Claim deadline '))return 'The deadline for a new claim has passed.';
 if(reason==='The original commitment is conditional. Resolve its terms before preparing an unconditional claim.')return 'This is a conditional offer. Review the conditions first.';
 if(reason==='No outstanding original credit remains.')return 'The full promise is already covered by invoice credit.';
 if(reason==='This amendment has already been accepted.')return 'These terms have already been accepted.';
 if(reason.startsWith('This amendment was dismissed:'))return `This offer was declined: ${reason.slice('This amendment was dismissed:'.length).trim()}`;
 if(reason.startsWith('The amendment accepted-term or source basis is stale.'))return 'The terms or their documents changed. Prepare a new review.';
 if(reason.startsWith('This proposal conflicts with accepted future terms'))return 'This conflicts with future terms that were already accepted.';
 return reason;
}

/** Earlier versions remain inspectable in history, not duplicated as open work. */
export function reviewFiles(view){
 const latest=new Map();
 for(const action of view.actions)latest.set(canonical({commitmentId:action.commitmentId,type:action.type,payload:action.payload}),action);
 return [...latest.values()].filter(action=>!view.amendments.some(amendment=>amendment.id===action.payload?.amendmentId&&amendment.rejected));
}
