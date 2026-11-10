import {formatMoney} from './correspondence.mjs';

const dateText = value => value ? new Intl.DateTimeFormat('en-US', {month:'long',day:'numeric',timeZone:'UTC'}).format(new Date(`${value.slice(0,10)}T12:00:00Z`)) : 'the proposed date';
const amount = (value,currency='USD') => Number.isSafeInteger(value) ? formatMoney(value,currency) : null;
const entityKinds=['vendor','commitment','credit','amendment','action'];

/** A reading layer over recorded events. Later credit/application state cannot rewrite an earlier story. */
export function createHistoryCopy(workspace) {
  const histories=Object.fromEntries(entityKinds.map(kind=>[kind,new Map()]));
  const credits=new Map();
  function add(kind,id,sequence,value){if(!histories[kind].has(id))histories[kind].set(id,[]);histories[kind].get(id).push({sequence,value});}
  for(const event of [...(workspace?.events||[])].sort((a,b)=>a.sequence-b.sequence)){
    const p=event.payload||{};
    for(const kind of entityKinds){const value=p[kind];if(value?.id){add(kind,value.id,event.sequence,value);if(kind==='credit')credits.set(value.id,value);}}
    if(event.type==='CREDIT_APPLIED'&&credits.has(p.creditId)){
      const value={...credits.get(p.creditId),status:'applied'};credits.set(value.id,value);add('credit',value.id,event.sequence,value);
    }
  }
  function at(kind,id,sequence){
    const versions=histories[kind].get(id)||[];let low=0,high=versions.length-1,found=null;
    while(low<=high){const middle=(low+high)>>1;if(versions[middle].sequence<=sequence){found=versions[middle].value;low=middle+1;}else high=middle-1;}
    return found;
  }
  return event=>{
    const p=event.payload||{},sequence=event.sequence??Infinity;
    const action=p.action||at('action',p.actionId,sequence);
    const amendment=p.amendment||at('amendment',p.amendmentId||action?.payload?.amendmentId,sequence);
    const allocation=p.allocation;
    const credit=p.credit||at('credit',p.creditId||allocation?.creditId,sequence);
    const commitment=p.commitment||at('commitment',p.commitmentId||allocation?.commitmentId||amendment?.commitmentId||action?.commitmentId||event.commitmentIds?.[0],sequence);
    const vendorId=p.vendor?.id||p.source?.vendorId||credit?.vendorId||commitment?.vendorId;
    const company=event.vendorNames?.filter(Boolean).join(', ')||p.vendor?.name||at('vendor',vendorId,sequence)?.name||'this company';
    const currency=credit?.currency||commitment?.currency||'USD';
    const money=value=>amount(value,currency);
    const possessive=`${company}’s`;
    let title,detail;
    switch(event.type){
      case 'VENDOR_ADDED': title=`Added ${company} to the file`;detail='The company now has a place for its promises and documents.';break;
      case 'SOURCE_ADDED':
      case 'SOURCE_REVISED': {
        const noun=({invoice:'invoice',credit_memo:'credit note',contract:'agreement',incident:'service report',email:'message',agent_conversation:'reply',allocation_resolution:'matching instructions'}[p.source?.kind]||'document');
        title=`${event.type==='SOURCE_REVISED'?'Updated':'Added'} ${noun==='matching instructions'?'':/^[aeiou]/i.test(noun)?'an ':'a '}${noun} for ${company}`;
        detail=p.source?.title||'The supplied document is saved in the file.';break;
      }
      case 'COMMITMENT_CREATED':
        title=(commitment?.conditions?.length>0) ? `Recorded ${possessive} ${money(commitment.promisedCents)||''} offer with conditions` : `Recorded ${possessive} ${money(commitment?.promisedCents)||''} promise`;
        detail=commitment?.conditions?.length ? 'This is an offer to consider, not an invoice reduction already received.' : `The credit was expected ${dateText(commitment?.dueDate)}. An invoice is needed to confirm it.`;break;
      case 'CREDIT_REGISTERED':
        title=credit?.status==='issued' ? `Added ${possessive} ${money(credit?.amountCents)||''} credit note` : `Added a ${money(credit?.amountCents)||''} invoice credit for ${company}`;
        detail=credit?.status==='issued' ? 'Recorded a note, not a reduction confirmed on an invoice.' : 'Recorded the invoice credit. Matching it identifies which promise it covers.';break;
      case 'CREDIT_APPLIED':
        title=`Added an invoice confirming ${possessive} credit note`;
        detail='The invoice was linked to the existing note; no second credit was created.';break;
      case 'CREDIT_ALLOCATED':
      case 'ALLOCATION_CREATED':
        title=credit?.status==='issued' ? `Linked ${money(allocation?.amountCents??p.amountCents)||'credit'} of ${possessive} note to this promise` : `Matched ${money(allocation?.amountCents??p.amountCents)||'credit'} of ${possessive} invoice credit to this promise`;
        detail=credit?.status==='issued' ? 'An invoice is still needed before this note can count as a reduction.' : 'The match identifies which promise this part of the invoice credit covers.';break;
      case 'AMENDMENT_PROPOSED':
        if(amendment?.newCommitment||amendment?.incrementalRenewalCostCents>0){title=`Recorded a renewal offer for ${company}`;detail=`The offer requires ${money(amendment.incrementalRenewalCostCents)||'additional money'} in extra spending. It has not been accepted.`;}
        else if(amendment?.patch?.dueDate){title=`${company} proposed waiting until ${dateText(amendment.patch.dueDate)}`;detail='The proposed date has not been accepted. The original promise still applies.';}
        else{title=`Recorded proposed changes to ${possessive} promise`;detail='The original terms remain in force until the changes are accepted.';}break;
      case 'AMENDMENT_ACCEPTED': title=`Accepted changes to ${possessive} promise`;detail=`The new terms take effect ${dateText(amendment?.effectiveDate)}. Accepting them does not confirm an invoice reduction.`;break;
      case 'AMENDMENT_DISMISSED': title=`Declined the proposed changes for ${company}`;detail=p.reason||'The proposed change was not accepted; its document remains in the file.';break;
      case 'ACTION_PROPOSED':
        if(action?.type==='preserve_original'){title=`Prepared a review to keep ${possessive} original terms`;detail='The review keeps the original promise separate from any new offer. No new terms were accepted.';}
        else if(action?.type==='prepare_claim'){title=`Prepared a review of ${possessive} ${money(action.amountCents)||''} claim`;detail='A local review was prepared. No email was sent and no invoice credit was added.';}
        else if(action?.type==='accept_amendment'&&(amendment?.newCommitment||amendment?.incrementalRenewalCostCents>0)){title=`Prepared a review of ${possessive} renewal offer`;detail=action.economics?`${money(action.economics.creditCents)} of credit would require ${money(action.economics.incrementalRenewalCostCents)} in extra spending. The offer has not been accepted.`:'The renewal needs review before it can be accepted.';}
        else if(action?.type==='accept_amendment'&&amendment?.patch?.dueDate){title=`Prepared a review of ${possessive} proposed date change`;detail=`The company proposed ${dateText(amendment.patch.dueDate)}. The original date has not changed.`;}
        else{title=`Prepared the next step for ${company}`;detail='The proposed step needs review. It has not been approved or recorded.';}break;
      case 'ACTION_APPROVED': title=action?.type==='preserve_original'?`Approved a step to keep ${possessive} original terms`:`Approved the next step for ${company}`;detail='Approval permits the reviewed local step. It does not send an email or confirm an invoice reduction.';break;
      case 'ACTION_EXECUTED': title=`Recorded the approved step for ${company}`;detail=action?.type==='preserve_original'?'The local record keeps the original promise in place. No vendor message or invoice credit was created.':action?.type==='accept_amendment'?'The approved acceptance step was recorded. Any new terms and their effective date remain in the case.':'The approved local step was recorded. No email was sent and no invoice credit was created.';break;
      case 'CREDIT_REVERSED': title=`Reversed ${money(p.amountCents)||'part'} of ${possessive} credit`;detail='The correction remains in history. This amount is no longer available to cover a promise.';break;
      case 'CREDIT_RESOLVED': title=`Approved which ${company} promises this credit can cover`;detail='Matching limits were approved. No credit was assigned automatically.';break;
      case 'POLICY_SET': title='Changed the rules for approving next steps';detail='Pending reviews must use the new rules. Vendor terms and invoice credits did not change.';break;
      case 'WORKSPACE_RESET': title='Restored the example cases';detail='The starting example documents and cases were restored.';break;
      default:title=`Updated the ${company==='this company'?'file':company+' file'}`;detail='Open the record details to see the exact change.';
    }
    return {title:title.replace(/\s+/g,' ').trim(),detail,company};
  };
}
