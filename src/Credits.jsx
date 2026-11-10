import React,{useEffect,useLayoutEffect,useMemo,useRef,useState,useId} from 'react';
import {ArrowLeft,FileText,Search,X} from 'lucide-react';
import {evaluateWorkspace} from './assurance/index.mjs';
import {formatMoney} from './correspondence.mjs';
import {documentReading} from './document-reading.mjs';
import DocumentGraphic from './DocumentGraphic.jsx';
import './credits.css';
import './credit-visual.css';

const cash=(value,currency='USD')=>formatMoney(value||0,currency);
const names={all:'All notes',issued:'Invoice still needed',applied:'Applied credits',unmatched:'Which promise?'};
const date=value=>value?new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(`${value.slice(0,10)}T12:00:00Z`)):'Date not recorded';
const exactSource=(view,link)=>link&&view.sourceVersions.find(source=>source.id===link.sourceId&&source.revision===link.revision);
const sourceLinks=credit=>[...(credit.sourceLinks||[]),...(credit.applicationSourceLinks||[])].filter((link,i,all)=>all.findIndex(other=>other.sourceId===link.sourceId&&other.revision===link.revision)===i);
const creditKind=(view,credit)=>{const kinds=(credit.sourceLinks||[]).map(link=>exactSource(view,link)?.kind);return kinds.includes('credit_memo')?'credit-note':kinds.includes('invoice')?'invoice':'record';};
function invoiceProof(view,credit){
 const links=credit.applicationSourceLinks?.length?credit.applicationSourceLinks:credit.sourceLinks||[];
 return credit.status==='applied'?links.map(link=>({link,source:exactSource(view,link)})).find(item=>item.source?.kind==='invoice'):null;
}
function previewReading(view,credit,company){
 const kind=creditKind(view,credit),proof=invoiceProof(view,credit);
 return {title:`${kind==='credit-note'?'Credit note':kind==='invoice'?'Invoice credit':'Recorded credit'} ${credit.invoiceId}`,company,label:kind==='credit-note'?'Credit note':kind==='invoice'?'Invoice credit':'Recorded credit',summary:credit.status==='issued'?'Invoice confirmation is still needed.':'Credit recorded as applied.',visual:{kind:kind==='record'?'text':kind,currency:credit.currency,faceCents:credit.amountCents,creditCents:credit.amountCents,reference:credit.reference,applicationConfirmed:kind==='invoice'&&Boolean(proof)}};
}

/** Original paper representation of a physical credit, not a simulated scan. */
export function CreditPaper({credit,company,kind='record',compact=false}){
 const id=useId().replaceAll(':',''),money=value=>cash(value,credit.currency),note=kind==='credit-note',label=note?'Credit note':kind==='invoice'?'Invoice credit':'Recorded credit';
 return <figure className={`cv-paper${compact?' cv-paper-compact':''}`} role="img" aria-label={`${company}. ${label} ${credit.invoiceId}. ${kind==='invoice'?'Invoice credit amount':kind==='credit-note'?'Original note amount':'Recorded credit amount'} ${money(credit.amountCents)}.${credit.reversedCents>0?` ${money(credit.reversedCents)} reversed; ${money(credit.availableCents)} remains.`:''}`}>
  <svg className="cv-paper-stock" viewBox="0 0 430 340" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id={`${id}-stock`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fffdf6"/><stop offset="1" stopColor="#efe7d2"/></linearGradient><linearGradient id={`${id}-fold`}><stop stopColor="#d1c19d"/><stop offset="1" stopColor="#f9f3e6"/></linearGradient></defs><path d="M8 8H422V337H8Z" fill="#e8ddc5" stroke="#d3c7ab"/><path d="M1 1H395L429 34V331H1Z" fill={`url(#${id}-stock)`} stroke="#cabd9d"/><path d="M395 1V34H429" fill={`url(#${id}-fold)`} stroke="#cabd9d"/><path d="M26 300H401" stroke="#c6b89b" strokeDasharray="3 5"/></svg>
  <div className="cv-paper-company" aria-hidden="true">{company}</div><span className="cv-paper-type" aria-hidden="true">{label}</span>
  <div className="cv-paper-value" aria-hidden="true"><span>{kind==='invoice'?'Invoice credit amount':kind==='credit-note'?'Original note amount':'Recorded credit amount'}</span><strong>{money(credit.amountCents)}</strong></div>
  <div className="cv-paper-document" aria-hidden="true">{credit.invoiceId}</div>
  {credit.reversedCents>0?<div className="cv-paper-correction" aria-hidden="true"><span>Correction reversed</span><b>−{money(credit.reversedCents)}</b></div>:<div className="cv-paper-ruling" aria-hidden="true"><i/><i/></div>}
  <div className="cv-paper-reference" aria-hidden="true">{credit.reference}</div>
 </figure>;
}

/** The physical face splits into corrections, active matches and unassigned value. */
export function CreditCapacity({credit}){
 const money=value=>cash(value,credit.currency),face=credit.amountCents||0;
 const parts=[{key:'reversed',label:'Reversed',value:credit.reversedCents||0},{key:'matched',label:'Matched to promises',value:credit.allocatedCents||0},{key:'unmatched',label:'Still to match',value:credit.unallocatedCents||0}];
 return <div className="cv-capacity" role="img" aria-label={`Original credit ${money(face)}; ${money(parts[0].value)} reversed; ${money(parts[1].value)} matched to promises; ${money(parts[2].value)} still to match. Matching is separate from invoice application.`}>
  <div className="credit-allocation-strip cv-capacity-track" aria-hidden="true">{parts.filter(part=>part.value>0).map(part=><span key={part.key} className={`cv-capacity-${part.key}`} style={{flex:part.value}}/>)}{face===0&&<span className="cv-capacity-empty"/>}</div>
  <div className="cv-capacity-key" aria-hidden="true">{parts.filter(part=>part.key!=='reversed'||part.value>0).map(part=><div key={part.key} className={`cv-key-${part.key}`}><span>{part.label}</span><strong>{money(part.value)}</strong></div>)}</div>
 </div>;
}

function InvoiceCheck({credit,proof,onSource}){
 const supplied=Boolean(proof),applied=credit.status==='applied';
 return <div className={`cv-invoice-check${supplied?' cv-invoice-supplied':''}`}>
  <div className="cv-invoice-check-title">Invoice check</div>
  <svg className="cv-invoice-outline" viewBox="0 0 160 156" aria-hidden="true"><path d="M25 10H109L139 40V146L127 141 115 146 103 141 91 146 79 141 67 146 55 141 43 146 31 141 25 146Z" fill={supplied?'#f9f7eb':'none'} stroke={supplied?'#b6bca5':'#bfb69d'} strokeWidth="1.5" strokeDasharray={supplied?undefined:'4 5'}/><path d="M109 10V40H139M44 57H112M44 75H112M44 93H82" fill="none" stroke="#c5bba4" strokeWidth="2"/>{supplied?<g data-credit-invoice-confirmed="true"><circle cx="112" cy="113" r="24" fill="#365a43"/><path d="m101 112 8 9 15-19" fill="none" stroke="#fff9e9" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></g>:<path d="M48 120H91" stroke="#b9ad90" strokeWidth="2"/>}</svg>
  <h3>{supplied?'Invoice supplied':applied?'Applied credit recorded':'Invoice still needed'}</h3>
  <p className="credit-note">{supplied?`Added ${date(proof.source.observedAt)}`:applied?'The exact invoice source is unavailable.':'A credit note is not yet a reduction on your bill.'}</p>
  {supplied&&<button className="text-button" onClick={()=>onSource(proof.link)}>Open invoice</button>}
 </div>;
}

export default function Credits({service,onOpenCommitment,onSource,onSelect,target}){
 const [query,setQuery]=useState(''),[filter,setFilter]=useState('all'),[selectedId,setSelected]=useState(target?.creditId||''),[mobileDetail,setMobileDetail]=useState(Boolean(target?.creditId)),[refreshing,setRefreshing]=useState(false),[error,setError]=useState('');
 const view=useMemo(()=>{const now=new Date().toISOString();return service.workspace?evaluateWorkspace(service.workspace,{asOf:now.slice(0,10),knownAt:now}):null;},[service.workspace]);
 const returnCredit=useRef(target?.creditId||null),list=useRef(null),readerHeading=useRef(null),matching=useRef(null),previousDetail=useRef({open:false,id:null,ready:false});
 const company=id=>view?.vendors.find(vendor=>vendor.id===id)?.name||'Unknown company';
 const all=view?.credits||[],items=all.filter(credit=>(filter==='all'||filter==='unmatched'&&credit.quarantined||filter===credit.status)&&`${company(credit.vendorId)} ${credit.invoiceId} ${credit.reference} ${credit.lineId||''}`.toLowerCase().includes(query.toLowerCase().trim()));
 const selected=all.find(credit=>credit.id===selectedId)||(!selectedId?items[0]:null);
 useEffect(()=>{if(target?.creditId){returnCredit.current=target.creditId;if(target.creditId!==selectedId){setSelected(target.creditId);if(!items.some(item=>item.id===target.creditId)){setQuery('');setFilter('all');}}setMobileDetail(true);}else if(target===null){setSelected('');setMobileDetail(false);}},[target]);
 const pick=id=>{returnCredit.current=id;setSelected(id);setMobileDetail(true);onSelect?.(id);};
 const backToCredits=()=>{setSelected('');setMobileDetail(false);onSelect?.(null);};
 useLayoutEffect(()=>{const previous=previousDetail.current;previousDetail.current={open:mobileDetail,id:selectedId,ready:Boolean(selected)};if(mobileDetail&&selected&&(!previous.open||previous.id!==selectedId||!previous.ready)){readerHeading.current?.focus();}else if(!mobileDetail&&previous.open){const active=document.activeElement;if(active===document.body||!active?.getClientRects().length){[...(list.current?.querySelectorAll('[data-credit]')||[])].find(node=>node.dataset.credit===returnCredit.current)?.focus();}}},[mobileDetail,selectedId,Boolean(selected)]);
 async function refresh(){if(refreshing)return;setRefreshing(true);setError('');try{await service.refresh();}catch(failure){setError(failure.message||'Could not refresh credits. Try again.');}finally{setRefreshing(false);}}
 const counts=id=>id==='all'?all.length:id==='unmatched'?all.filter(credit=>credit.quarantined).length:all.filter(credit=>credit.status===id).length;
 const links=selected?sourceLinks(selected):[],proof=selected&&view?invoiceProof(view,selected):null;
 const active=selected?.allocations.filter(allocation=>allocation.activeCents>0)||[],unmatched=selected?.unallocatedCents||0;
 const grouped=new Map();for(const allocation of active){const previous=grouped.get(allocation.commitmentId);grouped.set(allocation.commitmentId,{commitmentId:allocation.commitmentId,amountCents:(previous?.amountCents||0)+allocation.activeCents,allocations:[...(previous?.allocations||[]),allocation]});}
 const matches=[...grouped.values()],candidateIds=[...new Set([...(selected?.candidateCommitmentIds||[]),...matches.map(item=>item.commitmentId)])].filter(id=>view?.commitments.some(commitment=>commitment.id===id));
 const knownMatches=matches.filter(item=>view?.commitments.some(commitment=>commitment.id===item.commitmentId));
 const nextCase=knownMatches.length===1?knownMatches[0].commitmentId:!knownMatches.length&&candidateIds.length===1?candidateIds[0]:null;
 function inspectMatching(){if(nextCase)onOpenCommitment(nextCase,'ledger');else{matching.current?.scrollIntoView({block:'start'});matching.current?.focus({preventScroll:true});}}
 return <main className={`credits-page credit-visual ${mobileDetail?'credits-detail-open':''}`}>
  <header className="workspace-page-heading"><div><h1>Credit notes</h1></div><button className="button secondary" disabled={service.busy||refreshing} onClick={refresh}>{refreshing?'Refreshing…':'Refresh'}</button></header>
  {(error||service.error)&&<p className="credit-warning" role="alert">{error||service.error} <button className="text-button" onClick={refresh} disabled={refreshing}>Try again</button></p>}
  <div className="credits-toolbar"><div className="record-tabs" aria-label="Filter credits">{Object.entries(names).map(([id,name])=><button key={id} aria-pressed={filter===id} onClick={()=>{setFilter(id);setSelected('');setMobileDetail(false);onSelect?.(null);}}>{name}<span>{counts(id)}</span></button>)}</div><label className="workspace-search"><Search size={16}/><input aria-label="Search credits" placeholder="Find a company or document…" value={query} onChange={event=>{setQuery(event.target.value);setSelected('');setMobileDetail(false);onSelect?.(null);}}/>{query&&<button aria-label="Clear credit search" onClick={()=>setQuery('')}><X size={14}/></button>}</label></div>
  {!view?<div className="workspace-empty" role="status">Opening credit notes…</div>:!all.length?<section className="workspace-empty"><FileText size={34}/><h2>No credit notes yet</h2><p>Add the credit note or invoice when the company sends it.</p><button className="button primary" onClick={()=>onOpenCommitment(null,'portfolio')}>Open cases</button></section>:<div className="credits-layout">
   <section className="credit-statement" aria-label="Credit records" ref={list}><div className="cv-file-heading"><span>{items.length} {items.length===1?'document':'documents'}</span><span>After corrections</span></div>{!items.length?<div className="workspace-empty"><h2>No matching credit notes</h2><button className="text-button" onClick={()=>{setQuery('');setFilter('all');}}>Clear filters</button></div>:items.map(credit=><button className={`credit-statement-row ${selected?.id===credit.id?'selected':''}`} aria-pressed={selected?.id===credit.id} key={credit.id} data-credit={credit.id} onClick={()=>pick(credit.id)}><span className="cv-file-art" aria-hidden="true"><DocumentGraphic reading={previewReading(view,credit,company(credit.vendorId))} small/></span><span className="credit-company"><strong>{company(credit.vendorId)}</strong><small>{credit.invoiceId}</small><span className={`credit-state ${credit.quarantined?'attention':credit.status}`}>{credit.quarantined?'Which promise?':credit.status==='issued'?'Invoice still needed':invoiceProof(view,credit)?'Invoice supplied':'Applied credit recorded'}</span></span><span className="credit-row-amount"><strong>{cash(credit.availableCents,credit.currency)}</strong><small>{credit.reversedCents>0?`${cash(credit.reversedCents,credit.currency)} reversed`:credit.unallocatedCents>0?`${cash(credit.unallocatedCents,credit.currency)} still to match`:credit.availableCents===0?'Nothing left to match':'Matched'}</small></span></button>)}</section>
   {selected?<aside className="credit-reader" aria-label="Selected credit"><button className="credit-mobile-back text-button" onClick={backToCredits}><ArrowLeft size={15}/>All notes</button><header><div><h2 ref={readerHeading} tabIndex={-1}>{company(selected.vendorId)}</h2><p>{selected.invoiceId}</p></div>{candidateIds.length>0&&<button className="button primary cv-next-action" onClick={inspectMatching}>{selected.quarantined?'Review possible matches':nextCase?selected.status==='issued'?'Check invoice in case':'Open matched case':'Choose a promise'}</button>}</header>
    <div className="cv-document-journey"><CreditPaper credit={selected} company={company(selected.vendorId)} kind={creditKind(view,selected)}/><span className={`cv-proof-thread${proof?' cv-proof-thread-confirmed':''}`} aria-hidden="true"/><InvoiceCheck credit={selected} proof={proof} onSource={onSource}/></div>
    <section className="credit-matching" aria-label="Credit matching"><div className="cv-section-heading"><h3 ref={matching} tabIndex={-1}>Where the credit is matched</h3><span>Value after corrections: {cash(selected.availableCents,selected.currency)}</span></div><CreditCapacity credit={selected}/>
     <div className="cv-match-branches">{matches.map(match=>{const commitment=view.commitments.find(item=>item.id===match.commitmentId);return <button key={match.commitmentId} className="credit-assignment" disabled={!commitment} onClick={()=>onOpenCommitment(match.commitmentId,'ledger')}><span className="cv-match-paper" aria-hidden="true"><i/><i/><i/></span><span><b>{commitment?`${cash(commitment.promisedCents,commitment.currency)} ${commitment.conditions.length?'offer':'promise'}`:'Case not in this view'}</b><small>{selected.quarantined?'Needs clarification':selected.status==='issued'?'Matched note; invoice still needed':commitment?.status==='verified'?'The full promise is on an invoice':`${cash(commitment?.outstandingCents||0,commitment?.currency)} still missing from invoices`}</small></span><strong>{cash(match.amountCents,selected.currency)}<small>Matched</small></strong></button>;})}</div>
     {unmatched>0&&<div className="credit-unassigned"><span>Still to match to a promise</span><strong>{cash(unmatched,selected.currency)}</strong></div>}
     {!matches.length&&unmatched===0&&<p className="cv-no-matches">No active matches.</p>}
     {selected.quarantined&&<details className="cv-clarification"><summary>Why does this need clarification?</summary><p className="credit-warning">{selected.quarantineReason}</p></details>}
     {candidateIds.filter(id=>!grouped.has(id)).map(id=>{const commitment=view.commitments.find(item=>item.id===id);return <button className="text-button cv-candidate" key={id} onClick={()=>onOpenCommitment(id,'ledger')}>Check the {cash(commitment.promisedCents,commitment.currency)} {commitment.conditions.length?'offer':'promise'}</button>;})}
    </section>
    <section className="credit-files"><h3>Supporting documents</h3>{links.length?links.map(link=>{const source=exactSource(view,link),reading=source&&documentReading(view,source);return <button key={`${link.sourceId}@${link.revision}`} disabled={!source} onClick={()=>onSource(link)}>{reading?<span className="cv-source-art" aria-hidden="true"><DocumentGraphic reading={reading} small/></span>:<FileText size={17}/>}<span><strong>{reading?.title||link.sourceId}</strong><small>{reading?.label||'Exact version unavailable'}</small></span></button>;}):<p>No document attached.</p>}</section>
    <details className="credit-record-details"><summary>Document details</summary><dl><div><dt>Promise reference</dt><dd>{selected.reference}</dd></div><div><dt>Invoice line</dt><dd>{selected.lineId||'Not supplied'}</dd></div><div><dt>{creditKind(view,selected)==='invoice'?'Invoice credit amount':creditKind(view,selected)==='credit-note'?'Original note amount':'Recorded credit amount'}</dt><dd>{cash(selected.amountCents,selected.currency)}</dd></div><div><dt>Reversed</dt><dd>{cash(selected.reversedCents,selected.currency)}</dd></div><div><dt>Value after corrections</dt><dd>{cash(selected.availableCents,selected.currency)}</dd></div><div><dt>Recorded on</dt><dd>{date(selected.issuedDate)}</dd></div><div><dt>Credit ID</dt><dd>{selected.id}</dd></div></dl>{active.length>0&&<div className="cv-allocation-details"><h4>Exact matches</h4>{active.map(allocation=><div key={allocation.id}><span>{allocation.id}</span><strong>{cash(allocation.activeCents,selected.currency)}</strong></div>)}</div>}</details>
   </aside>:selectedId?<aside className="workspace-empty"><h2>Credit note not found</h2><p>This document is not in the selected workspace.</p><button className="text-button" onClick={backToCredits}>View all notes</button></aside>:null}
  </div>}
 </main>;
}

export {invoiceProof as creditInvoiceProof,creditKind as creditDocumentKind};
