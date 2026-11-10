import {evaluateWorkspace,simulateAction} from '../assurance/index.mjs';
import {originalReviewState} from '../assurance-ui.mjs';
import {reviewFiles,readableReviewReason} from '../review-display.mjs';

// These are visible software roles. They do not impersonate recorded people or
// claim that a model, email provider or vendor has been contacted.
export const TEAM_MEMBERS=Object.freeze([
 {id:'evidence',name:'Mina',role:'Document reader',station:'archive',color:'#aa6941',description:'Keeps the exact promise, invoice and replies together.'},
 {id:'analyst',name:'Oren',role:'Case analyst',station:'dispatch',color:'#50755e',description:'Compares the promise with the recorded invoice credits.'},
 {id:'reviewer',name:'Ada',role:'Terms reviewer',station:'review',color:'#ae5047',description:'Checks changed terms and the decision that needs a person.'},
 {id:'operator',name:'Jules',role:'Case operator',station:'lab',color:'#74728a',description:'Opens the exact review or follow-up that can happen next.'},
 {id:'bookkeeper',name:'Nell',role:'Invoice checker',station:'exchange',color:'#bc904c',description:'Separates issued notes, matching and actual invoice application.'},
].map(Object.freeze));

const money=(cents,currency='USD')=>new Intl.NumberFormat('en-US',{style:'currency',currency,maximumFractionDigits:cents%100?2:0}).format(cents/100);
const dateLabel=value=>value?new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(`${value.slice(0,10)}T12:00:00Z`)):'No date supplied';
const uniqueLinks=links=>[...new Map(links.filter(Boolean).map(link=>[`${link.sourceId}@${link.revision}`,{sourceId:link.sourceId,revision:link.revision}])).values()];
function projection(workspace,context={}){
 if(!workspace)return null;
 const now=new Date().toISOString();
 return evaluateWorkspace(workspace,{asOf:context.asOf||now.slice(0,10),knownAt:context.knownAt||now});
}
function headline(c){
 if(c.conditions.length)return `${money(c.promisedCents,c.currency)} offer to review`;
 if(c.outstandingCents===0)return 'The full credit is on invoices';
 if(c.issuedCents>0&&c.verifiedCents===0)return `${money(c.issuedCents,c.currency)} note, invoice still needed`;
 return `${money(c.outstandingCents,c.currency)} still missing from invoices`;
}
export function deriveTeamDirectory(workspace,context={}){
 const view=projection(workspace,context);
 return {view,cases:(view?.commitments||[]).map(c=>{const vendor=view.vendors.find(v=>v.id===c.vendorId);return {id:c.id,commitmentId:c.id,vendor,name:vendor?.name||'Company',reference:c.reference,headline:headline(c),status:c.status,amountCents:c.conditions.length?c.promisedCents:c.outstandingCents,currency:c.currency};}),selectedCaseId:null};
}
function absent(view,commitmentId){return {available:false,missingReason:commitmentId?'This exact case is not available in these records.':'No case has been recorded yet.',commitment:null,vendor:null,view,steps:[],handoffs:[],members:TEAM_MEMBERS.map(member=>({...member,status:'idle',task:'No case selected'})),current:{stage:'empty',status:'empty',owner:'evidence',actionId:null,blockers:[]},nextAction:{label:commitmentId?'Choose a case':'Add documents',destination:commitmentId?'portfolio':'evidence',commitmentId:null,actionId:null,requiresRole:commitmentId?null:'analyst',reason:commitmentId?'Choose a case from the current records.':'Add original documents before checking a credit.'},summary:null,sourceLinks:[],documents:[],credits:[],actions:[],amendments:[]};}
function exactArtifact(kind,c,extra={},sourceLinks=[]){const first=sourceLinks[0];return {kind,commitmentId:c.id,...(first?{sourceId:first.sourceId,revision:first.revision}:{}),...extra};}
function makeStep(c,key,from,to,title,body,sourceLinks,extra={}){
 const links=uniqueLinks(sourceLinks);
 return {id:`${c.id}:${key}`,kind:'derived-finding',from,to,title,body,acknowledgement:'',artifact:exactArtifact('case',c,{},links),sourceLinks:links,status:'checked',...extra};
}
function financialCredit(credit,c,view){
 const matchedCents=credit.allocations.filter(a=>a.commitmentId===c.id).reduce((sum,a)=>sum+a.activeCents,0);
 const sourceLinks=uniqueLinks([...(credit.sourceLinks||[]),...(credit.applicationSourceLinks||[])]);
 const invoiceProof=credit.status==='applied'&&!credit.quarantined&&sourceLinks.some(link=>view.sourceVersions.some(s=>s.id===link.sourceId&&s.revision===link.revision&&s.kind==='invoice'));
 return {...credit,sourceLinks,matchedCents,invoiceProof};
}
function nextFor(c,actions,amendments,workspace,view){
 const originals=originalReviewState(workspace,view,c),pending=amendments.filter(a=>!a.accepted&&!a.rejected&&!a.superseded);
 const files=reviewFiles({...view,actions});
 const offer=files.findLast(a=>a.type==='accept_amendment'&&pending.some(m=>m.id===a.payload?.amendmentId));
 const action=offer||originals.action||files.at(-1)||null;
 const base={commitmentId:c.id,actionId:action?.id||null,requiresRole:null};
 if(!c.conditions.length&&c.outstandingCents===0)return {action,nextAction:{...base,label:'View the completed case',destination:'history',reason:'The full promise is covered by recorded invoice credit.'},current:{stage:'complete',status:'complete',owner:'bookkeeper',actionId:action?.id||null,blockers:[]}};
 if(c.issuedCents>0&&c.verifiedCents===0)return {action,nextAction:{...base,actionId:null,label:'Check the invoice',destination:'ledger',requiresRole:'analyst',reason:'A matched credit note is still separate from a reduced invoice.'},current:{stage:'invoice',status:'waiting',owner:'bookkeeper',actionId:null,blockers:['Invoice application evidence is still needed.']}};
 if(c.conditions.length&&!pending.length)return {action,nextAction:{...base,label:'Review the offer conditions',destination:'portfolio',reason:'Conditional value is not an unconditional amount owed.',requiresRole:'approver'},current:{stage:'terms',status:'waiting',owner:'reviewer',actionId:action?.id||null,blockers:[...c.conditions]}};
 if(action&&!action.executed&&(action.proposalStale||action.approvalStale))return {action,nextAction:{...base,label:'Refresh the review',destination:'decisions',requiresRole:'analyst',reason:'The documents, terms or review rules changed.'},current:{stage:'review',status:'changed',owner:'reviewer',actionId:action.id,blockers:['The earlier review is out of date.']}};
 if(action&&!action.executed&&(!action.policyDecision.allowed||pending.length))return {action,nextAction:{...base,label:pending.length?'Review the proposed terms':'Open the review',destination:'decisions',requiresRole:'approver',reason:pending.length?'The proposed terms need an explicit decision.':action.policyDecision.reasons.map(readableReviewReason).join(' ')},current:{stage:'review',status:action.policyDecision.allowed?'waiting':'blocked',owner:'reviewer',actionId:action.id,blockers:[...new Set(action.policyDecision.reasons.map(readableReviewReason))]}};
 if(action?.executed)return {action,nextAction:{...base,label:'View the recorded decision',destination:'decisions',reason:'Recording the decision did not create an invoice credit.'},current:{stage:'recorded',status:'recorded',owner:'operator',actionId:action.id,blockers:[]}};
 if(action?.approval)return {action,nextAction:{...base,label:'Record the approved decision',destination:'decisions',requiresRole:'executor',reason:'The exact approval is ready for an authorized operator.'},current:{stage:'record',status:'approved',owner:'operator',actionId:action.id,blockers:[]}};
 if(c.dueDate>view.asOf)return {action,nextAction:{...base,label:'View the promised date',destination:'portfolio',reason:`The credit is expected ${dateLabel(c.dueDate)}.`},current:{stage:'scheduled',status:'waiting',owner:'bookkeeper',actionId:action?.id||null,blockers:[]}};
 if(c.deadline.state==='expired')return {action,nextAction:{...base,label:'Check the claim deadline',destination:'portfolio',reason:`The deadline for a new claim was ${dateLabel(c.claimDeadline)}.`},current:{stage:'deadline',status:'blocked',owner:'reviewer',actionId:action?.id||null,blockers:['The deadline for a new claim has passed.']}};
 return {action,nextAction:{...base,label:action?'Review the credit request':'Prepare a credit request',destination:'decisions',requiresRole:action?'approver':'analyst',reason:'Review the exact request before recording a decision.'},current:{stage:'review',status:'waiting',owner:'reviewer',actionId:action?.id||null,blockers:[]}};
}

function recordedHandoffs(workspace,view,c,sourceLinks,credits,actions,amendments){
 const linkKeys=new Set(sourceLinks.map(link=>`${link.sourceId}@${link.revision}`)),creditIds=new Set(credits.map(x=>x.id)),actionIds=new Set(actions.map(x=>x.id)),amendmentIds=new Set(amendments.map(x=>x.id));
 const handoffs=[];
 for(const event of workspace.events.filter(e=>e.observedAt<=view.knownAt)){
  const p=event.payload;let from,to,title,body,links=[],artifact,amountCents;
  if((event.type==='SOURCE_ADDED'||event.type==='SOURCE_REVISED')&&linkKeys.has(`${p.source.id}@${event.sequence}`)){
   from='evidence';to='analyst';title=event.type==='SOURCE_REVISED'?'Document revised':'Document added';body=p.source.title;links=[{sourceId:p.source.id,revision:event.sequence}];artifact=exactArtifact('source',c,{},links);
  }else if(event.type==='COMMITMENT_CREATED'&&p.commitment.id===c.id){
   from='evidence';to='analyst';title='Promise recorded';amountCents=p.commitment.promisedCents;body=`${money(amountCents,p.commitment.currency)} ${p.commitment.conditions.length?'conditional offer':'promise'} recorded.`;links=p.sourceLinks;artifact=exactArtifact('promise',c,{},links);
  }else if(event.type==='AMENDMENT_PROPOSED'&&p.amendment.commitmentId===c.id){
   from='analyst';to='reviewer';title='Changed terms proposed';body='This proposal has not changed the agreement by itself.';links=p.sourceLinks;artifact=exactArtifact('amendment',c,{amendmentId:p.amendment.id},links);
  }else if(event.type==='AMENDMENT_DISMISSED'&&amendmentIds.has(p.amendmentId)){
   from='reviewer';to='operator';title='Offer declined';body=p.reason;const amendment=amendments.find(a=>a.id===p.amendmentId);links=amendment.sourceLinks;artifact=exactArtifact('amendment',c,{amendmentId:p.amendmentId},links);
  }else if(event.type==='AMENDMENT_ACCEPTED'&&amendmentIds.has(p.amendmentId)){
   from='reviewer';to='bookkeeper';title='Changed terms accepted';body=`Terms effective ${dateLabel(event.effectiveDate)}. Acceptance did not create invoice credit.`;const amendment=amendments.find(a=>a.id===p.amendmentId);links=amendment.sourceLinks;artifact=exactArtifact('amendment',c,{amendmentId:p.amendmentId,actionId:p.actionId},links);
  }else if(event.type==='CREDIT_REGISTERED'&&creditIds.has(p.credit.id)){
   from='evidence';to='bookkeeper';title=p.credit.status==='applied'?'Applied credit recorded':'Credit note recorded';amountCents=p.credit.amountCents;body=`${money(amountCents,p.credit.currency)} ${p.credit.status==='applied'?'recorded as applied credit.':'note; invoice application is separate.'}`;links=p.sourceLinks;artifact=exactArtifact('credit',c,{creditId:p.credit.id},links);
  }else if(event.type==='CREDIT_ALLOCATED'&&p.allocation.commitmentId===c.id){
   from='bookkeeper';to='analyst';title='Credit matched to this case';amountCents=p.allocation.amountCents;body=`${money(amountCents,c.currency)} matched. Matching alone does not apply a note to an invoice.`;const prior=workspace.events.filter(e=>e.sequence<event.sequence&&e.observedAt<=view.knownAt);const registered=prior.find(e=>e.type==='CREDIT_REGISTERED'&&e.payload.credit.id===p.allocation.creditId);const applied=prior.findLast(e=>e.type==='CREDIT_APPLIED'&&e.payload.creditId===p.allocation.creditId);links=[...(registered?.payload.sourceLinks||[]),...(applied?.payload.sourceLinks||[]),...(p.allocation.sourceLinks||[])];artifact=exactArtifact('credit',c,{creditId:p.allocation.creditId,allocationId:p.allocation.id},links);
  }else if(['CREDIT_APPLIED','CREDIT_RESOLVED','CREDIT_REVERSED'].includes(event.type)&&creditIds.has(p.creditId)){
   from=event.type==='CREDIT_REVERSED'?'bookkeeper':'evidence';to=event.type==='CREDIT_REVERSED'?'analyst':'bookkeeper';title={CREDIT_APPLIED:'Invoice application recorded',CREDIT_RESOLVED:'Credit matching clarified',CREDIT_REVERSED:'Credit reversed'}[event.type];amountCents=p.amountCents;body=event.type==='CREDIT_REVERSED'?`${money(p.amountCents,c.currency)} reversed in the recorded credit.`:event.type==='CREDIT_RESOLVED'?'The recorded decision identifies which cases this credit can match.':'Application evidence was recorded for this credit.';links=p.sourceLinks;artifact=exactArtifact('credit',c,{creditId:p.creditId},links);
  }else if(event.type==='ACTION_PROPOSED'&&p.action.commitmentId===c.id){
   from='analyst';to='reviewer';title='Decision prepared';body='Prepared for review; no action was executed.';artifact=exactArtifact('action',c,{actionId:p.action.id,amendmentId:p.action.payload?.amendmentId});
  }else if(['ACTION_APPROVED','ACTION_EXECUTED'].includes(event.type)&&actionIds.has(p.actionId)){
   from=event.type==='ACTION_APPROVED'?'reviewer':'operator';to=event.type==='ACTION_APPROVED'?'operator':'bookkeeper';title=event.type==='ACTION_APPROVED'?'Exact decision approved':'Local decision recorded';body=event.type==='ACTION_APPROVED'?'This exact decision was approved for an authorized operator.':'No email, vendor transaction or invoice credit was created by this local action.';artifact=exactArtifact('action',c,{actionId:p.actionId});
  }else continue;
  handoffs.push({id:event.id,kind:'recorded-event',eventId:event.id,eventType:event.type,sequence:event.sequence,from,to,title,body,artifact,sourceLinks:uniqueLinks(links),...(amountCents!==undefined?{amountCents}:{}),actor:{...event.actor},observedAt:event.observedAt,effectiveDate:event.effectiveDate,financiallyActive:event.effectiveDate<=view.asOf,messageRecorded:false});
 }
 return handoffs;
}

/** Read-only rule outputs and separately identified historical events. */
export function deriveTeamCase(workspace,context={}){
 const view=projection(workspace,context);
 if(!view)return absent(null,context.commitmentId);
 const c=context.commitmentId?view.commitments.find(c=>c.id===context.commitmentId):view.commitments[0];
 if(!c)return absent(view,context.commitmentId);
 const vendor=view.vendors.find(v=>v.id===c.vendorId)||{id:c.vendorId,name:'Company'};
 const actions=view.actions.filter(a=>a.commitmentId===c.id),amendments=view.amendments.filter(a=>a.commitmentId===c.id);
 const credits=view.credits.filter(credit=>credit.allocations.some(a=>a.commitmentId===c.id)||(credit.vendorId===c.vendorId&&credit.reference===c.reference&&credit.candidateCommitmentIds.includes(c.id))).map(credit=>financialCredit(credit,c,view));
 const sourceLinks=uniqueLinks([...c.sourceLinks,...amendments.flatMap(a=>a.sourceLinks),...credits.flatMap(credit=>credit.sourceLinks)]);
 const documents=sourceLinks.map(link=>view.sourceVersions.find(s=>s.id===link.sourceId&&s.revision===link.revision)).filter(Boolean);
 const invoiceCredits=credits.filter(credit=>credit.status==='applied'&&!credit.quarantined&&credit.matchedCents>0),notes=credits.filter(credit=>credit.status==='issued'&&credit.matchedCents>0);
 const invoiceLinks=uniqueLinks(invoiceCredits.flatMap(credit=>credit.sourceLinks));
 const step=(...args)=>makeStep(c,...args);
 // The first handoff describes the original document, not a later accepted
 // amount/date that still shares the commitment's original source binding.
 const creation=workspace.events.find(event=>event.type==='COMMITMENT_CREATED'&&event.payload.commitment.id===c.id&&event.observedAt<=view.knownAt);
 const original=creation?.payload.commitment||{promisedCents:c.originalPromisedCents,dueDate:c.originalDueDate,conditions:[]};
 const originalLinks=creation?.payload.sourceLinks||c.sourceLinks,originalConditional=Boolean(original.conditions?.length);
 const originalAmount=c.originalPromisedCents??original.promisedCents,originalDate=c.originalDueDate??original.dueDate;
 const currentTermsLinks=uniqueLinks([...amendments.filter(a=>a.accepted&&!a.superseded&&a.effectiveDate<=view.asOf).flatMap(a=>a.sourceLinks),...c.sourceLinks]);
 const steps=[step('promise','evidence','analyst',originalConditional?'Conditional offer found':'Promise found',`${vendor.name} originally ${originalConditional?'offered':'promised'} ${money(originalAmount,c.currency)}${originalConditional?' with conditions':` by ${dateLabel(originalDate)}`}.`,originalLinks,{artifact:exactArtifact('promise',c,{},originalLinks),amountCents:originalAmount,acknowledgement:originalConditional?'The original offer was conditional.':'The original promise is ready to compare.'})];
 if(invoiceCredits.length){const proof=invoiceCredits.every(credit=>credit.invoiceProof);steps.push(step('invoice','analyst','bookkeeper',proof?'Invoice credit found':'Applied credit recorded',`${money(c.verifiedCents,c.currency)} ${proof?'is matched from supplied invoices':'is recorded as applied credit'} against this case.`,invoiceLinks,{artifact:exactArtifact('credit',c,{creditId:invoiceCredits[0].id},invoiceLinks),amountCents:c.verifiedCents,acknowledgement:'I’ll check how much reached this case.'}));}
 else if(notes.length){const noteLinks=uniqueLinks(notes.flatMap(credit=>credit.sourceLinks));steps.push(step('note','evidence','bookkeeper','Credit note found',`${money(c.issuedCents,c.currency)} is matched from issued notes. It is not an invoice deduction.`,noteLinks,{artifact:exactArtifact('credit',c,{creditId:notes[0].id},noteLinks),amountCents:c.issuedCents,acknowledgement:'Invoice confirmation is still needed.',status:'waiting'}));}
 else steps.push(step('no-invoice','analyst','bookkeeper','No matched invoice credit',c.conditions.length?'No applied credit is recorded for this conditional offer.':'No applied credit is recorded against this promise.',[],{artifact:exactArtifact('case',c),amountCents:0,acknowledgement:'No matching invoice credit yet.',status:'waiting'}));
 steps.push(step('balance','bookkeeper','reviewer',c.conditions.length?'Conditional value checked':c.outstandingCents===0?'Promise fulfilled':'Remaining credit checked',c.conditions.length?`${money(c.promisedCents,c.currency)} stays conditional: ${c.conditions.join(' ')}`:c.outstandingCents===0?`The full ${money(c.promisedCents,c.currency)} is covered by recorded invoice credit.`:`${money(c.promisedCents,c.currency)} promised − ${money(c.verifiedCents,c.currency)} applied = ${money(c.outstandingCents,c.currency)} still missing.`,[...currentTermsLinks,...invoiceLinks],{amountCents:c.outstandingCents,acknowledgement:c.conditions.length?'This is an offer, not an unconditional debt.':c.outstandingCents===0?'No remaining invoice credit is due.':'The remaining credit needs a follow-up.'}));
 for(const amendment of amendments.filter(a=>!a.accepted&&!a.rejected&&!a.superseded)){
  const action=actions.findLast(a=>a.payload?.amendmentId===amendment.id),economics=action?.economics||simulateAction(workspace,{commitmentId:c.id,type:'accept_amendment',payload:{amendmentId:amendment.id}},{asOf:view.asOf,knownAt:view.knownAt}).economics;
  const renewal=amendment.newCommitment||amendment.incrementalRenewalCostCents>0;
  let title='Changed terms to review',body='These terms have not been accepted.';
  if(renewal&&economics){const net=economics.incrementalRenewalCostCents-economics.creditCents;title=net>0?`${money(net,c.currency)} more after the credit`:'Renewal terms checked';body=`${money(economics.incrementalRenewalCostCents,c.currency)} extra spending − ${money(economics.creditCents,c.currency)} offered credit = ${net===0?'no net extra cost':`${money(Math.abs(net),c.currency)} ${net<0?'less':'more'}`}. This offer is not accepted.`;}
  else if(amendment.patch.dueDate){title='New date proposed';body=`${dateLabel(c.dueDate)} → ${dateLabel(amendment.patch.dueDate)}. The proposed date has not been accepted.`;}
  else if(amendment.patch.conditions)body=amendment.patch.conditions.length?amendment.patch.conditions.join(' '):'The proposal removes the current conditions; it has not been accepted.';
  steps.push(step(`terms:${amendment.id}`,'analyst','reviewer',title,body,amendment.sourceLinks,{artifact:exactArtifact('amendment',c,{amendmentId:amendment.id,...(action?{actionId:action.id}:{})},amendment.sourceLinks),economics,acknowledgement:'These terms need your decision.',status:action?.policyDecision.allowed===false?'blocked':'waiting'}));
 }
 for(const amendment of amendments.filter(a=>a.rejected||a.accepted)){
  const declined=amendment.rejected,changes=[];
  if('promisedCents' in amendment.patch)changes.push(`Accepted amount: ${money(amendment.patch.promisedCents,c.currency)}.`);
  if(amendment.patch.dueDate)changes.push(`Accepted date: ${dateLabel(amendment.patch.dueDate)}.`);
  if(amendment.patch.conditions)changes.push(amendment.patch.conditions.length?`Accepted conditions: ${amendment.patch.conditions.join(' ')}`:'The accepted change removes the prior conditions.');
  const acceptedBody=`${changes.length?changes.join(' ')+' ':''}Accepted terms take effect ${dateLabel(amendment.effectiveDate)}.${amendment.superseded?' These terms were replaced by later accepted terms.':amendment.effectiveDate>view.asOf?' They have not taken effect in this view.':''}`;
  steps.push(step(`decision:${amendment.id}`,'reviewer',declined?'operator':'bookkeeper',declined?'Offer declined':'Terms accepted',declined?amendment.dismissal?.reason||'No terms were accepted from this offer.':acceptedBody,amendment.sourceLinks,{artifact:exactArtifact('amendment',c,{amendmentId:amendment.id},amendment.sourceLinks),recordedEventId:declined?amendment.dismissal?.eventId:amendment.acceptedEventId,status:declined?'declined':'recorded',acknowledgement:declined?'This offer did not change the agreement.':'Acceptance does not create invoice credit.'}));
 }
 const {action,current,nextAction}=nextFor(c,actions,amendments,workspace,view);
 const nextTarget=actions.find(a=>a.id===nextAction.actionId)||null;
 const nextLinks=nextTarget?.payload?.amendmentId?amendments.find(a=>a.id===nextTarget.payload.amendmentId)?.sourceLinks||c.sourceLinks:nextAction.destination==='ledger'&&notes.length?notes.flatMap(note=>note.sourceLinks):c.sourceLinks;
 steps.push(step('next',current.owner,current.owner==='operator'?'bookkeeper':'operator',nextAction.label,nextAction.reason,nextLinks,{artifact:exactArtifact(nextTarget?'action':'case',c,{...(nextTarget?{actionId:nextTarget.id}:{})},nextLinks),acknowledgement:current.status==='complete'?'The recorded invoice result is complete.':current.status==='recorded'?'The decision is saved; invoice credit remains a separate check.':'Waiting for the next authorized person.',status:current.status,requiresRole:nextAction.requiresRole}));
 const members=TEAM_MEMBERS.map(member=>{const latest=steps.findLast(step=>step.to===member.id||step.from===member.id);return {...member,status:member.id===current.owner?current.status:'checked',task:member.id===current.owner?nextAction.label:latest?.title||'No task in this case',stepId:latest?.id||null};});
 const summary={promisedCents:c.promisedCents,appliedCents:c.verifiedCents,missingCents:c.outstandingCents,issuedMatchedCents:c.issuedCents,invoiceBackedCents:invoiceCredits.filter(x=>x.invoiceProof).reduce((sum,x)=>sum+x.matchedCents,0),conditional:Boolean(c.conditions.length),currency:c.currency,headline:headline(c)};
 const handoffs=recordedHandoffs(workspace,view,c,sourceLinks,credits,actions,amendments);
 return {available:true,missingReason:null,commitment:c,vendor,view,steps,handoffs,members,current,nextAction,summary,sourceLinks,documents,credits,actions,amendments,walkthroughLabel:'Case walkthrough',walkthroughNotice:'Read-only findings from the selected records. Visual role handoffs are not sent messages.',recordedNotice:'Recorded events retain their actual actor and timestamp; the visible team roles organize the work.'};
}
