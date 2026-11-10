import React,{useId,useState,useEffect} from 'react';
import {formatMoney} from './correspondence.mjs';

const ink='#263a30',red='#a13c27',muted='#827b68';
const date=value=>value?new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',timeZone:'UTC'}).format(new Date(`${value}T12:00:00Z`)):'Not specified';

/** Original illustrations of recorded terms, never a fabricated scan of a source. */
export default function DocumentGraphic({reading,small=false}){
 const [narrow,setNarrow]=useState(()=>!small&&matchMedia('(max-width:760px)').matches);
 useEffect(()=>{if(small)return;const media=matchMedia('(max-width:760px)'),change=()=>setNarrow(media.matches);media.addEventListener('change',change);return()=>media.removeEventListener('change',change);},[small]);
 const id=useId().replaceAll(':',''),v=reading.visual||{},kind=v.kind||reading.kind;
 const money=value=>Number.isSafeInteger(value)?formatMoney(value,v.currency||'USD'):'—';
 const amount=v.creditCents??v.faceCents??v.amountCents;
 const renewal=kind==='renewal',delay=kind==='date-change';
 const memo=kind==='credit-note',invoice=kind==='invoice';
 const company=(reading.company||'Document').length>25?`${reading.company.slice(0,24)}…`:reading.company||'Document';
 const confirmed=invoice&&v.applicationConfirmed;
 const comparison=Number.isSafeInteger(v.netCostCents)?`${money(Math.abs(v.netCostCents))} ${v.netCostCents<0?'less':v.netCostCents===0?'difference':'more'}`:'Cost comparison unavailable';
 const description=renewal?`${reading.title}. Extra spending ${money(v.extraCostCents)}, offered credit ${money(amount)}. ${comparison} after the credit. ${v.decision||''}`:delay?`${reading.title}. Original date ${date(v.oldDate)}. Proposed date ${date(v.newDate)}. ${v.decision||''}`:`${reading.title}. ${Number.isSafeInteger(amount)?money(amount)+'. ':''}${confirmed?'Invoice confirms application.':memo?'Credit note only; invoice confirmation is separate.':reading.summary||''}`;
 return <svg className={`document-graphic graphic-${kind}${small?' graphic-small':''}`} viewBox={narrow?(renewal?'0 0 350 525':delay?'0 0 350 560':'0 0 380 390'):'0 0 580 390'} role={small?undefined:'img'} aria-hidden={small||undefined} aria-label={small?undefined:description}>
  <defs>
   <linearGradient id={`${id}-stock`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fffdf5"/><stop offset="1" stopColor="#eae3d2"/></linearGradient>
   <linearGradient id={`${id}-green`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#345e49"/><stop offset="1" stopColor="#173d2d"/></linearGradient>
   <linearGradient id={`${id}-fold`}><stop stopColor="#d8cbb0"/><stop offset=".5" stopColor="#f7f0df"/><stop offset="1" stopColor="#fffdf5"/></linearGradient>
   <filter id={`${id}-shadow`} x="-30%" y="-30%" width="170%" height="180%"><feDropShadow dx="2" dy="5" stdDeviation="3" floodColor="#493e27" floodOpacity=".18"/><feDropShadow dx="8" dy="14" stdDeviation="12" floodColor="#493e27" floodOpacity=".09"/></filter>
   <pattern id={`${id}-hatch`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><path d="M0 0V6" stroke="#c4b89a" strokeWidth="1"/></pattern>
  </defs>
  {renewal?<>
   <g transform={narrow?'translate(24 16) rotate(-4 132 152)':'translate(42 30) rotate(-4 132 152)'} filter={`url(#${id}-shadow)`}>
    <path d="M9 8H254V302H9Z" fill="#e7ddc6" stroke="#c9bea5"/><path d="M4 4H249V298H4Z" fill="#f0e8d6" stroke="#c9bea5"/>
    <path d="M0 0H218L244 28V293H0Z" fill={`url(#${id}-stock)`} stroke="#cfc3a8"/>
    <path d="M218 0V28H244" fill={`url(#${id}-fold)`} stroke="#cfc3a8"/>
    <text x="23" y="38" fill={ink} className="graphic-company">{company}</text><path d="M23 55H215" stroke="#cbbf9f"/>
    <text x="23" y="91" fill={muted} className="graphic-label">Extra spending</text>
    <text x="22" y="141" fill={ink} className="graphic-money">{money(v.extraCostCents)}</text>
    <path d="M23 168H215M23 188H177M23 208H191" stroke="#bcb69f" strokeWidth="2"/>
    <path d="M23 239H215" stroke="#cbbf9f"/>
    <text x="23" y="265" fill={muted} className="graphic-small-label">Renewal comparison</text>
   </g>
   <g transform={narrow?'translate(101 247) rotate(5 120 100)':'translate(292 73) rotate(5 120 100)'} filter={`url(#${id}-shadow)`}>
    <path d="M0 0H226V63a10 10 0 0 0 0 20V215H0V83a10 10 0 0 0 0-20Z" fill={`url(#${id}-green)`}/>
    <path d="M14 14H212V201H14Z" fill="none" stroke="#b3c6a4" strokeOpacity=".55"/><path d="M1 74H226" stroke="#b3c6a4" strokeDasharray="3 5"/>
    <text x="25" y="45" fill="#dbe7cc" className="graphic-label">Offered credit</text>
    <text x="25" y="132" fill="#fffdf2" className="graphic-money">{money(amount)}</text>
    <text x="25" y="167" fill="#dbe7cc" className="graphic-small-label">Requires the new agreement</text>
   </g>
   <g transform={narrow?'translate(175 489)':'translate(290 350)'}><text textAnchor="middle" fill={red} className={narrow?'graphic-equation-compact':'graphic-equation'}>{money(v.extraCostCents)} − {money(amount)} =</text><text textAnchor="middle" y={narrow?25:30} fill={red} className="graphic-result">{comparison}</text></g>
  </>:delay?<>
   <g transform={narrow?'translate(35 20) rotate(-5 100 120)':'translate(49 53) rotate(-5 100 120)'} filter={`url(#${id}-shadow)`}><rect width="211" height="252" fill={`url(#${id}-stock)`} stroke="#c9bea5"/><path d="M0 0H211V48H0Z" fill={ink}/><text x="24" y="31" fill="#f5f1de" className="graphic-label">{v.oldDateLabel||'Original date'}</text><text x="105" y="135" textAnchor="middle" fill={ink} className="graphic-date">{date(v.oldDate)}</text><path d="M24 171H187M24 190H157M24 209H173" stroke="#bcb69f" strokeWidth="2"/><path d="M39 -8V13M173 -8V13" stroke="#8d917f" strokeWidth="6" strokeLinecap="round"/></g>
   <g transform={narrow?'translate(104 267) rotate(4 110 120)':'translate(289 72) rotate(4 110 120)'} filter={`url(#${id}-shadow)`}><rect width="211" height="252" fill={`url(#${id}-stock)`} stroke="#c9bea5"/><path d="M0 0H211V48H0Z" fill={red}/><text x="24" y="31" fill="#fff6e8" className="graphic-label">Proposed date</text><text x="105" y="135" textAnchor="middle" fill={red} className="graphic-date">{date(v.newDate)}</text><path d="M24 171H187M24 190H157M24 209H173" stroke="#bcb69f" strokeWidth="2"/><path d="M39 -8V13M173 -8V13" stroke="#8d917f" strokeWidth="6" strokeLinecap="round"/></g>
   <text x={narrow?175:288} y={narrow?546:366} textAnchor="middle" fill={muted} className="graphic-small-label">{v.decision==='Not accepted'?'Not accepted':v.decision||'Proposed change'}</text>
  </>:invoice||memo||kind==='promise'?<>
   <g transform={narrow?'translate(16 20) rotate(-2 174 168)':'translate(112 20) rotate(-2 174 168)'} filter={`url(#${id}-shadow)`}>
    <path d="M7 7H356V344H7Z" fill="#e7ddc6" stroke="#c9bea5"/><path d="M0 0H319L349 30V337H0Z" fill={`url(#${id}-stock)`} stroke="#c9bea5"/><path d="M319 0V30H349" fill={`url(#${id}-fold)`} stroke="#c9bea5"/>
    <text x="29" y="44" fill={ink} className="graphic-company">{company}</text><text x="29" y="72" fill={muted} className="graphic-small-label">{invoice?'Invoice credit':memo?'Credit note':'Promised credit'}</text>
    <path d="M29 92H320" stroke="#bcb091"/>
    <path d="M29 118H201M29 133H166" stroke="#c4bba3" strokeWidth="2"/>
    <rect x="22" y="155" width="305" height="81" fill={invoice?'#dce4d5':'#ebe3ce'}/><text x="37" y="184" fill={ink} className="graphic-label">{confirmed?'Credit on this invoice':invoice?'Recorded credit':memo?'Credit note value':v.conditional?'Conditional offer':'The company promised'}</text><text x="37" y="218" fill={invoice?ink:red} className="graphic-credit-money">{money(amount)}</text>
    <path d="M29 259H320" stroke="#bcb091" strokeDasharray="3 4"/><text x="29" y="286" fill={muted} className="graphic-small-label">{v.reference||'Original document in this file'}</text>
    <text x="29" y="310" fill={muted} className="graphic-small-label">{confirmed?'Invoice supplied':invoice?'Application not confirmed here':memo?'Invoice confirmation is separate':v.conditional?'Conditions apply':'Check the invoice for this amount'}</text>
   </g>
   {confirmed&&<g data-invoice-confirmed="true" transform={narrow?'translate(290 280) rotate(9)':'translate(395 237) rotate(9)'} filter={`url(#${id}-shadow)`}><path d="M0 0H78V72L65 67 52 72 39 67 26 72 13 67 0 72Z" fill={ink}/><path d="M20 30l12 12 26-27" fill="none" stroke="#fff9e9" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/></g>}
  </>:kind==='incident'?<>
   <g transform={narrow?'translate(-100 0)':'translate(0 0)'}>
    <ellipse cx="290" cy="326" rx="175" ry="22" fill="#c0b99d" opacity=".15"/>
    <g filter={`url(#${id}-shadow)`} transform="translate(116 88)"><path d="M0 25 94 0l79 34-93 27Z" fill="#b7bda9"/><path d="M0 25 80 61v204L0 228Z" fill="#45614b"/><path d="M80 61 173 34v202l-93 29Z" fill="#284733"/>{[71,122,173].map(y=><g key={y}><path d={`M9 ${y} 69 ${y+26}v37L9 ${y+11}Z`} fill="#d3d7c2"/><path d={`M91 ${y+29} 163 ${y+8}v36l-72 21Z`} fill="#63745b"/><path d={`M17 ${y+10} 54 ${y+26}`} stroke="#7c8c72" strokeWidth="3"/><circle cx="63" cy={y+31} r="3" fill="#8ba27b"/></g>)}</g>
    <g transform="translate(290 32) rotate(6 90 110)" filter={`url(#${id}-shadow)`}><path d="M0 0H157L179 24V245H0Z" fill={`url(#${id}-stock)`} stroke="#c9bea5"/><path d="M157 0V24H179" fill={`url(#${id}-fold)`} stroke="#c9bea5"/><text x="19" y="35" fill={ink} className="graphic-company">Service report</text><path d="M19 53H158" stroke="#c5b99e"/><path d="M19 88H158M19 108H147M19 128H158" stroke="#c5b99e" strokeWidth="2"/><path d="M28 186h25l13-24 17 47 18-28h43" fill="none" stroke={red} strokeWidth="3"/><path d="M24 222H153" stroke="#c5b99e"/></g>
   </g>
  </>:kind==='agreement'?<>
   <g transform={narrow?'translate(-98 0)':'translate(0 0)'}>
    <g transform="translate(112 25) rotate(-4 160 155)" filter={`url(#${id}-shadow)`}><path d="M7 6H309V328H7Z" fill="#d5c19a"/><path d="M0 0H302V321H0Z" fill={`url(#${id}-stock)`} stroke="#c9bea5"/><text x="27" y="45" fill={ink} className="graphic-company">{company}</text><text x="27" y="83" fill={ink} className="graphic-result">Service terms</text><path d="M27 104H275" stroke="#c5b99e"/>{[135,153,171,204,222,240].map((y,i)=><path key={y} d={`M27 ${y}H${i%3===2?214:275}`} stroke="#c5b99e" strokeWidth="2"/>)}<path d="M27 278H275" stroke="#b1a88e"/><text x="27" y="301" fill={muted} className="graphic-small-label">{v.reference||'Agreement in this file'}</text></g>
    <g transform="translate(352 189) rotate(7)" filter={`url(#${id}-shadow)`}><path d="M0 0H99V124H0Z" fill={`url(#${id}-green)`}/><path d="M15 17H84V106H15Z" fill="none" stroke="#829a76"/><path d="M34 47h30M34 61h30M34 75h19" stroke="#dce4ce" strokeWidth="3"/><path d="M42 -10V22a10 10 0 0 0 20 0V-5a5 5 0 0 0-10 0v24" fill="none" stroke="#a7ad9a" strokeWidth="4" strokeLinecap="round"/></g>
   </g>
  </>:<>
   <g transform={narrow?'translate(18 24) rotate(-2 174 168)':'translate(118 24) rotate(-2 174 168)'} filter={`url(#${id}-shadow)`}><path d="M8 7H351V337H8Z" fill="#e7ddc6" stroke="#c9bea5"/><path d="M0 0H316L343 27V330H0Z" fill={`url(#${id}-stock)`} stroke="#c9bea5"/><path d="M316 0V27H343" fill={`url(#${id}-fold)`} stroke="#c9bea5"/><text x="29" y="46" fill={ink} className="graphic-company">{company}</text><text x="29" y="76" fill={muted} className="graphic-label">{reading.label||'Document'}</text><path d="M29 98H313" stroke="#bcb091"/>{[132,151,170,189,221,240,259,278].map((y,i)=><path key={y} d={`M29 ${y}H${i%3===0?267:309}`} stroke="#c3baa4" strokeWidth="2"/>)}</g>
  </>}
 </svg>;
}
