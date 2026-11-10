import {sourceUsages} from './operations.mjs';
import {formatMoney} from './correspondence.mjs';

const typeLabels={email:'Message',agent_conversation:'Company reply',invoice:'Invoice',credit_memo:'Credit note',contract:'Agreement',incident:'Service report',allocation_resolution:'Matching instructions'};
const date=value=>value ? new Intl.DateTimeFormat('en-US',{month:'long',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(`${value.slice(0,10)}T12:00:00Z`)) : null;
const binds=(links,source)=>(links||[]).some(link=>link.sourceId===source.id&&link.revision===source.revision);

/** A display layer over exact document relationships; it never edits source text. */
export function documentReading(view,source){
  const company=source.vendorName||(view.vendors||[]).find(vendor=>vendor.id===source.vendorId)?.name||'Company';
  const originalTitle=source.title||'Untitled document',sourceText=source.text??'';
  const present=(view.sourceVersions||[]).some(item=>item.id===source.id&&item.revision===source.revision);
  const direct=sourceUsages(view,source.id,source.revision).filter(usage=>usage.kind!=='action');
  const amendments=present?(view.amendments||[]).filter(item=>binds(item.sourceLinks,source)):[];
  const amendment=amendments.length===1?amendments[0]:null;
  const credits=present?(view.credits||[]).filter(item=>binds(item.sourceLinks,source)||binds(item.applicationSourceLinks,source)):[];
  const credit=credits.length===1?credits[0]:null;
  const commitments=present?(view.commitments||[]).filter(item=>binds(item.sourceLinks,source)):[];
  const commitment=amendment ? (view.commitments||[]).find(item=>item.id===amendment.commitmentId) : commitments.length===1?commitments[0]:null;
  const currency=credit?.currency||commitment?.currency||'USD',money=value=>formatMoney(value,currency);
  const facts=[],sections=[];
  let visual={kind:'text',currency};
  const fact=(label,value)=>{if(value!==undefined&&value!==null&&value!=='')facts.push({label,value:String(value)});};
  const section=(label,text)=>{if(text)sections.push({label,text});};
  let title=originalTitle,kind='document',label=typeLabels[source.kind]||'Document',summary='';

  if(amendment){
    const accepted=amendment.accepted,startsLater=accepted&&amendment.effectiveDate>view.asOf;
    const state=amendment.rejected?'Declined':amendment.superseded?'Replaced by a later proposal':startsLater?'Accepted for a future date':accepted?'Accepted':'Not accepted';
    fact('Decision',state);
    if(amendment.newCommitment||amendment.incrementalRenewalCostCents>0){
      kind='offer';label='Renewal offer';title='Renewal offer';
      // Current economics can change after a new invoice. The proposal snapshot
      // keeps the document's offered credit distinct from today's remaining sum.
      const proposal=(view.actions||[]).find(action=>action.payload?.amendmentId===amendment.id&&action.proposedEconomics);
      const economics=proposal?.proposedEconomics;
      const offered=economics?.creditCents??null;
      visual={kind:'renewal',currency,creditCents:offered,extraCostCents:amendment.incrementalRenewalCostCents,netCostCents:offered===null?null:amendment.incrementalRenewalCostCents-offered,baselineCostCents:amendment.baselineCostCents,proposedCostCents:economics?.proposedRenewalCostCents??null,decision:state};
      summary=offered===null?'A credit offer that requires a renewal.':`${money(offered)} of credit, conditional on a renewal.`;
      fact('Credit offered',offered===null?null:money(offered));
      fact('Extra spending',money(amendment.incrementalRenewalCostCents));
      fact('Extra cost after credit',offered===null?null:money(amendment.incrementalRenewalCostCents-offered));
      fact('Comparison spending',money(amendment.baselineCostCents));
      fact('Proposed spending',economics?money(economics.proposedRenewalCostCents):null);
      section('The comparison',amendment.baselineDescription);
    }else if(amendment.patch?.dueDate){
      kind='date-change';label='Date change';title='Proposed new credit date';
      summary=`A proposal to move the credit to ${date(amendment.patch.dueDate)}.`;
      visual={kind:'date-change',currency,oldDate:commitment?.originalDueDate??null,newDate:amendment.patch.dueDate,decision:state};
      fact('Proposed date',date(amendment.patch.dueDate));
      fact('Original date',date(commitment?.originalDueDate));
    }else{
      kind='changed-terms';label='Proposed terms';title='Proposed changes';summary='Changes proposed to an existing promise.';
      fact('Proposed amount',Number.isSafeInteger(amendment.patch?.promisedCents)?money(amendment.patch.promisedCents):null);
      section('Proposed conditions',amendment.patch?.conditions?.join(' '));
    }
    fact('Takes effect',accepted?date(amendment.effectiveDate):null);
    section('What this changes',amendment.rejected?'This proposal was declined. It did not replace the agreed terms.':amendment.superseded?'A later proposal replaced this one.':startsLater?`The change was accepted and starts ${date(amendment.effectiveDate)}. It does not confirm an invoice reduction.`:accepted?'The change was accepted. Acceptance does not confirm an invoice reduction.':'The original promise stays in place unless this proposal is accepted.');
  }else if(credit&&(source.kind==='invoice'||source.kind==='credit_memo')){
    const note=source.kind==='credit_memo';
    kind=note?'credit-note':'invoice';label=note?'Credit note':'Invoice';title=`${label} ${credit.invoiceId}`;
    summary=note?`${money(credit.amountCents)} credit note.`:`${money(credit.amountCents)} of credit recorded from this invoice.`;
    const applicationConfirmed=!note&&credit.status==='applied'&&(!credit.applicationSourceLinks?.length||binds(credit.applicationSourceLinks,source));
    visual={kind:note?'credit-note':'invoice',currency,faceCents:credit.amountCents,creditCents:credit.amountCents,reference:credit.reference,documentNumber:credit.invoiceId,applicationConfirmed};
    fact(note?'Credit note amount':'Invoice credit',money(credit.amountCents));
    fact('Reference',credit.reference);
    if(!note)fact('Invoice',credit.invoiceId);
    section('What this document establishes',note?'This note records a credit. It does not by itself show a lower invoice balance.':applicationConfirmed?'This document is linked to the recorded invoice credit. Matching that credit identifies which promise it covers.':'A credit is recorded with this document. A matching invoice reduction has not been confirmed by this document.');
  }else if(source.kind==='contract'&&commitment){
    kind='agreement';label='Agreement';title='Service credit terms';summary=`Service credit terms recorded for ${company}.`;
    visual={kind:'agreement',currency,reference:commitment.reference,claimDeadline:null};
    // A linked case amount is a claim calculated under the agreement, not the
    // agreement's price. Do not relabel it as the contract's face amount.
    fact('Reference',commitment?.reference);
    fact('Current case claim deadline',date(commitment?.claimDeadline));
  }else if(source.kind==='incident'&&commitment){
    kind='incident';label='Service report';title='Service issue report';summary=`A service issue recorded for ${company}.`;
    visual={kind:'incident',currency,reference:commitment.reference};
    fact('Related agreement',commitment?.reference);
  }else if(commitment){
    const conditional=(commitment.conditions||[]).length>0;
    kind=conditional?'offer':'promise';label=conditional?'Offer':'Credit promise';title=conditional?'Conditional credit offer':'Promised invoice credit';
    const original=commitment.originalPromisedCents??commitment.promisedCents;
    visual={kind:'promise',currency,faceCents:original,expectedDate:commitment.originalDueDate??commitment.dueDate,conditional};
    summary=conditional?`${money(original)} offered with conditions.`:`A promise of ${money(original)} off an invoice.`;
    fact(conditional?'Offer amount':'Originally promised',money(original));
    fact('Expected on',date(commitment.originalDueDate??commitment.dueDate));
    fact('Reference',commitment.reference);
    if(conditional)section('The condition',commitment.conditions.join(' '));
  }else if(direct.some(item=>item.kind==='reversal')){
    kind='correction';label='Credit correction';title='Credit reversal';summary='A correction linked to an existing credit.';
  }else if(source.kind==='allocation_resolution'){
    kind='matching';label='Matching instructions';title='Credit matching instructions';summary='Instructions for matching a credit to its promises.';
  }

  // One exact case link per directly related case; amendment/credit navigation
  // takes precedence over an incidental commitment link to the same source.
  const ranked=[...direct].sort((a,b)=>({amendment:0,credit:1,application:1,resolution:1,allocation:2,reversal:2,commitment:3}[a.kind]??4)-({amendment:0,credit:1,application:1,resolution:1,allocation:2,reversal:2,commitment:3}[b.kind]??4));
  const links=new Map();
  for(const usage of ranked)for(const id of usage.commitmentIds){
    if(links.has(id))continue;
    const c=(view.commitments||[]).find(item=>item.id===id);if(!c)continue;
    if(usage.kind==='amendment'){
      const action=(view.actions||[]).findLast(item=>item.type==='accept_amendment'&&item.commitmentId===id&&item.payload?.amendmentId===usage.id);
      const terms=(view.amendments||[]).find(item=>item.id===usage.id);
      links.set(id,{commitmentId:id,destination:action?'decisions':'evidence',actionId:action?.id||null,label:terms?.accepted?'Open the accepted terms':action?'Review the proposed terms':'Open the case'});
    }else links.set(id,{commitmentId:id,destination:usage.destination,actionId:null,label:usage.destination==='ledger'?'Check the credit':'Open the case'});
  }
  return {title,kind,label,company,summary,facts,sections,caseLinks:[...links.values()],originalTitle,sourceText,visual};
}
