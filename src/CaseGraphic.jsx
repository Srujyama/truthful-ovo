import React,{useId} from 'react';
import {correspondenceStory,formatMoney} from './correspondence.mjs';
import './case-graphic.css';

function Stock({id,receipt=false}){
  return <svg className="case-print-stock" viewBox="0 0 420 250" preserveAspectRatio="none" aria-hidden="true">
    <defs><linearGradient id={`${id}-stock`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fffdf7"/><stop offset="1" stopColor="#f0e9d8"/></linearGradient><linearGradient id={`${id}-fold`}><stop stopColor="#d6c9ad"/><stop offset="1" stopColor="#fffdf4"/></linearGradient></defs>
    {receipt?<path d="M1 1H419V242L405 249 391 242 377 249 363 242 349 249 335 242 321 249 307 242 293 249 279 242 265 249 251 242 237 249 223 242 209 249 195 242 181 249 167 242 153 249 139 242 125 249 111 242 97 249 83 242 69 249 55 242 41 249 27 242 13 249 1 242Z" fill={`url(#${id}-stock)`} stroke="#d3c7ad"/>:<><path d="M1 1H392L419 28V249H1Z" fill={`url(#${id}-stock)`} stroke="#d3c7ad"/><path d="M392 1V28H419" fill={`url(#${id}-fold)`} stroke="#d3c7ad"/></>}
  </svg>;
}

function MatchLine({fraction,id}){
  const width=Math.max(0,Math.min(1,fraction))*380;
  return <svg className="case-match-line" viewBox="0 0 400 31" preserveAspectRatio="none" aria-hidden="true">
    <defs><pattern id={`${id}-missing`} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><path d="M0 0V7" stroke="#c7b89a" strokeWidth="1.3"/></pattern></defs>
    <path d="M10 5H390V25H10Z" fill={`url(#${id}-missing)`}/>
    {width>0&&<path d={`M10 5H${10+width}V25H10Z`} fill="#365b47"/>}
    <path d="M10 1V29M390 1V29" stroke="#a79b80"/>
    {width>0&&width<380&&<path d={`M${10+width} 1V29`} stroke="#f8f3e6" strokeWidth="2"/>}
  </svg>;
}

/** Current-case reconciliation, not a scan or a fabricated full invoice. */
export default function CaseGraphic({view,commitment}){
  const uid=useId().replaceAll(':','');
  const story=correspondenceStory(view,commitment);
  if(!story)return null;
  const currency=commitment.currency||'USD',money=value=>formatMoney(value,currency);
  const promised=commitment.promisedCents,applied=commitment.verifiedCents,missing=commitment.outstandingCents,issued=commitment.issuedCents;
  const conditional=commitment.conditions.length>0;
  const renewal=story.warnings.find(item=>item.kind==='renewal');
  const complete=!conditional&&missing===0;
  const annotation=conditional?renewal?renewal.netCostCents>=0?`${money(renewal.netCostCents)} extra after the credit`:`Credit exceeds extra cost by ${money(-renewal.netCostCents)}`:'The conditions still need review':complete?'Matched in full':issued>0?'Still needs an invoice':'Still missing from the invoice';
  const accessible=conditional?`${story.company}. Conditional offer of ${money(promised)}. ${renewal?`${money(renewal.extraCostCents)} extra spending required; ${annotation}.`:'No credit is counted as received. The conditions still need review.'}`:`${story.company}. Promised credit ${money(promised)}. On invoices ${money(applied)}. Still missing from invoices ${money(missing)}.${issued>0?` ${money(issued)} is matched from credit notes; those notes are separate from invoice reductions.`:''}${complete?' Matched in full.':''}`;
  return <figure className={`case-graphic${conditional?' case-graphic-offer':''}${complete?' case-graphic-complete':''}${issued>0?' case-graphic-note':''}`} role="img" aria-label={accessible}>
    <div className="case-reconciliation" aria-hidden="true">
      <div className="case-promise-print">
        <Stock id={`${uid}-promise`}/>
        <span className="case-print-type">{conditional?'The offer':'The promise'}</span>
        <span className="case-print-amount">{money(promised)}</span>
        <span className="case-print-caption">{conditional?'Credit if you agree':'Promised invoice credit'}</span>
        <div className="case-print-lines"><i/><i/><i/></div>
        <span className="case-print-corner">{conditional?'Terms to consider':'Compare with the invoice'}</span>
      </div>

      <div className="case-invoice-print">
        <Stock id={`${uid}-invoice`} receipt/>
        <span className="case-print-type">{conditional?'The cost':'The invoice check'}</span>
        <div className="case-invoice-value"><span>{conditional?'Extra spending':'On the invoice'}</span><strong>{conditional?renewal?money(renewal.extraCostCents):'Not established':money(applied)}</strong></div>
        {conditional?<>
          <svg className="case-offer-deduction" viewBox="0 0 400 30" preserveAspectRatio="none"><path d="M10 15H390" stroke="#b6a98b" strokeDasharray="3 4"/><path d="M191 15H213" stroke="#a13c27" strokeWidth="1.5"/></svg>
          <div className="case-invoice-result assurance-amount"><span>{renewal?'Extra cost after credit':'Conditions'}</span><strong>{renewal?money(renewal.netCostCents):'Need review'}</strong></div>
        </>:<>
          <MatchLine fraction={promised>0?applied/promised:0} id={uid}/>
          <div className="case-invoice-result assurance-amount"><span>{complete?'Remaining gap':issued>0?'Waiting on an invoice':'Still missing'}</span><strong>{money(missing)}</strong></div>
        </>}
        <span className="case-print-foot">{conditional?'An offer is not money received':complete?'The recorded invoice credit covers the promise':'A credit check, not the total invoice'}</span>
      </div>

      {issued>0&&!conditional&&<div className="case-note-tab"><span>Matched from notes</span><strong>{money(issued)}</strong><i aria-hidden="true"/></div>}
      {conditional&&<div className="case-offer-tab"><span>Offer only</span><span>No new terms accepted here</span></div>}
    </div>
    <figcaption aria-hidden="true">{annotation}</figcaption>
  </figure>;
}
