import React from 'react';
import {formatMoney} from './correspondence.mjs';
import DocumentGraphic from './DocumentGraphic.jsx';
import CaseGraphic from './CaseGraphic.jsx';

const shortDate=value=>value?new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(`${value.slice(0,10)}T12:00:00Z`)):'Unchanged';

export function ReviewStages({presentation}){
 const {phase,approved,recorded}=presentation;
 if(presentation.declined)return <p className="review-stages review-declined-stage">Offer declined · No terms accepted from this offer</p>;
 return <ol className="review-stages" aria-label="Decision progress">{[['Prepared',true],['Approved',approved],['Recorded',recorded]].map(([label,done],i)=><li key={label} className={done?'done':''} aria-current={phase==='review'&&i===0||phase==='approved'&&i===1||phase==='recorded'&&i===2?'step':undefined}><svg viewBox="0 0 28 32" aria-hidden="true"><path d="M3 1h16l6 6v24H3Z" fill={done?'#365b47':'#f6f0df'} stroke={done?'#365b47':'#c6b99b'}/><path d="M19 1v6h6" fill="none" stroke={done?'#8ca382':'#c6b99b'}/>{done?<path d="m8 17 4 4 8-9" fill="none" stroke="#f5f1e4" strokeWidth="2"/>:<path d="M8 15h12M8 20h9" stroke="#c6b99b"/>}</svg><span>{label}</span></li>)}</ol>;
}

export default function ReviewArtwork({view,presentation}){
 const p=presentation,{before,commitment:c,amendment:a,economics:e}=p;
 const money=value=>formatMoney(value,p.currency);
 if(p.renewal&&e)return <figure className="review-offer-art"><DocumentGraphic reading={{company:p.company,title:'Current renewal comparison',summary:'Credit is conditional on the proposed spending.',visual:{kind:'renewal',currency:p.currency,creditCents:e.creditCents,extraCostCents:e.incrementalRenewalCostCents,netCostCents:p.netCost,decision:p.recorded?'Recorded':p.declined?'Declined':'Not accepted'}}}/><figcaption>{p.recorded?'Comparison recorded with this decision':p.declined?'Declined offer — no new terms accepted':'Current comparison for this review'}</figcaption></figure>;
 if(a&&('promisedCents' in a.patch||'conditions' in a.patch))return <figure className="review-term-change" role="img" aria-label={`Current promise ${money(before.promisedCents)}. Proposed promise ${money(a.patch.promisedCents??before.promisedCents)}. Existing invoice credit ${money(c.verifiedCents)} is separate.`}><div className="review-term-paper"><span>Current promise</span><strong>{money(before.promisedCents)}</strong><small>{shortDate(before.dueDate)}</small></div><div className="review-term-paper proposed"><span>Proposed promise</span><strong>{money(a.patch.promisedCents??before.promisedCents)}</strong><small>{shortDate(a.patch.dueDate??before.dueDate)}</small></div><figcaption>{p.recorded?'Change recorded':'The proposed terms have not taken effect'}</figcaption></figure>;
 if(a?.patch.dueDate)return <figure className="review-offer-art"><DocumentGraphic reading={{company:p.company,title:'Current date comparison',visual:{kind:'date-change',oldDate:before.dueDate,newDate:a.patch.dueDate,oldDateLabel:'Current date',decision:p.recorded?'Recorded':p.approved?'Approved, not recorded':'Not accepted'}}}/><figcaption>{p.recorded?'Dates at the recorded decision':'Dates before accepting the change'}</figcaption></figure>;
 return <div className="review-current-invoice"><span>Current invoice check</span><CaseGraphic view={view} commitment={c}/></div>;
}
