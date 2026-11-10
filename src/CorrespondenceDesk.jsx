import React from 'react';
import {correspondenceStory,formatMoney} from './correspondence.mjs';

export function caseTransitionName(id){let hash=0;for(const c of String(id))hash=(Math.imul(hash,31)+c.charCodeAt(0))|0;return `case-${Math.abs(hash)}`;}

export function CompanyMark({name='',transitionId}){
  return <span className="company-print" data-case-mark={transitionId} style={transitionId?{viewTransitionName:`${caseTransitionName(transitionId)}-mark`}:undefined} aria-hidden="true"><span>{name.split(/\s+/).map(word=>word[0]).slice(0,2).join('')}</span><i/><i/></span>;
}

export function PromisePapers({view,commitment,onOpen}){
  if(!commitment)return null;
  const story=correspondenceStory(view,commitment);
  const hasInvoice=story.documents.some(item=>item.available&&item.kind==='invoice');
  return <button className="promise-papers" onClick={()=>onOpen(commitment.id)} aria-label={`Read ${story.company}'s ${hasInvoice?'promise and invoice':'promise'}`}>
    <span className="paper-shadow"/>
    <span className="promise-letter"><span className="letter-address">{story.company}</span><span className="letter-date">Promise summary</span><span className="letter-rule"/><strong>{formatMoney(commitment.promisedCents)}</strong><span className="letter-sentence">A credit on your invoice.</span><span className="letter-lines"><i/><i/><i/></span><span className="ink-signature">Keep the original.</span></span>
    <span className="invoice-slip"><span className="receipt-company">{story.company}</span><span className="receipt-caption">{hasInvoice?'Invoice check':'Invoice not added'}</span><span className="receipt-perforation"/><span className="receipt-line"><span>Promised</span><b>{formatMoney(commitment.promisedCents)}</b></span><span className="receipt-line"><span>On the invoice</span><b>{formatMoney(commitment.verifiedCents)}</b></span><span className="receipt-perforation"/><span className="receipt-line receipt-total"><span>Still missing</span><b>{formatMoney(commitment.outstandingCents)}</b></span><span className="receipt-barcode"/><span className="receipt-foot">Original documents inside</span></span>
    <svg className="paperclip" viewBox="0 0 50 110" aria-hidden="true"><path d="M34 94V22c0-19-26-19-26 0v66c0 30 35 30 35 0V31c0-12-17-12-17 0v54" fill="none" stroke="#5f685d" strokeWidth="5"/><path d="M33 93V22c0-17-24-17-24 0v66c0 28 33 28 33 0V31c0-10-15-10-15 0v54" fill="none" stroke="#d4d8cd" strokeWidth="2"/></svg>
  </button>;
}

export function CorrespondenceIndex({view,rows,onOpen}){
  return <div className="correspondence-index">
    {rows.map(c=>{const story=correspondenceStory(view,c);return <button key={c.id} data-case={c.id} className={`portfolio-row correspondence-entry story-${story.kind}`} onClick={event=>onOpen(c.id,event.currentTarget)}>
      <CompanyMark name={story.company} transitionId={c.id}/><span className="correspondence-copy"><span className="correspondence-company" data-case-title={c.id} style={{viewTransitionName:`${caseTransitionName(c.id)}-title`}}>{story.company}</span><strong>{story.headline}</strong><span className="correspondence-detail">{story.detail}</span><span className="correspondence-next">{story.nextLabel}</span></span><span className="folder-lip" aria-hidden="true"/>
    </button>;})}
  </div>;
}

export function CaseExplanation({view,commitment}){
  const story=correspondenceStory(view,commitment);
  const conditional=commitment.conditions.length>0;
  const renewal=story.warnings.find(item=>item.kind==='renewal');
  return <section className="case-explanation" aria-label="What happened to this promise">
    <div className="case-explanation-copy"><span className="document-kind">{conditional?'The offer':'The invoice check'}</span><h3>{story.headline}</h3><p>{story.detail}</p>{story.deadlineNote&&<p className="case-deadline-note">{story.deadlineNote}</p>}</div>
    <div className="case-receipt"><div className="receipt-caption">{conditional?'Before accepting':'What the documents show'}</div>{conditional?<>{renewal?<dl><div><dt>Extra spending required</dt><dd>{formatMoney(renewal.extraCostCents)}</dd></div><div><dt>Credit offered</dt><dd>−{formatMoney(renewal.creditCents)}</dd></div><div className="case-receipt-total"><dt>Extra cost after the credit</dt><dd><strong>{formatMoney(renewal.netCostCents)}</strong></dd></div></dl>:<><p>A conditional offer is not money received.</p><strong>{formatMoney(commitment.promisedCents)} offered</strong><span>{commitment.conditions.join(' ')}</span></>}{renewal&&<details><summary>What this comparison assumes</summary><p>{renewal.baselineDescription}</p></details>}</>:<><dl><div><dt>They promised</dt><dd>{formatMoney(commitment.promisedCents)}</dd></div><div><dt>On an invoice</dt><dd>{formatMoney(commitment.verifiedCents)}</dd></div><div className="case-receipt-total"><dt><span>{commitment.issuedCents>0?'Still waiting on an invoice':'Still missing from an invoice'}</span></dt><dd className="assurance-amount"><strong>{formatMoney(commitment.outstandingCents)}</strong></dd></div></dl>{commitment.issuedCents>0&&<p>{formatMoney(commitment.issuedCents)} from credit notes is matched to this promise. The invoice still needs to show the deduction.</p>}</>}<span className="receipt-barcode" aria-hidden="true"/></div>
  </section>;
}
