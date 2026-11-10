import React,{useState} from 'react';
import {documentReading} from './document-reading.mjs';
import {sourceUsages} from './operations.mjs';
import {correspondenceStory,formatMoney} from './correspondence.mjs';
import DocumentGraphic from './DocumentGraphic.jsx';

const shortDate=value=>value?new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',timeZone:'UTC'}).format(new Date(`${value}T12:00:00Z`)):'Not specified';
const recorded=value=>value?new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(`${value.slice(0,10)}T12:00:00Z`)):'—';

function CaseConnection({view,link,onOpen}){
 const c=view.commitments.find(item=>item.id===link.commitmentId);
 if(!c)return null;
 const story=correspondenceStory(view,c),conditional=c.conditions.length>0;
 return <section className="document-case-connection" aria-label={`${story.company} current case`}>
  <h3>This case</h3><p className="document-case-company">{story.company}</p>
  <strong className="document-case-headline">{story.headline}</strong>
  {!conditional&&<div className="document-invoice-meter" aria-label={`${formatMoney(c.verifiedCents)} on invoices out of ${formatMoney(c.promisedCents)} promised`}>
   <span className="document-meter-track"><i style={{width:`${Math.max(0,Math.min(100,c.verifiedCents/c.promisedCents*100||0))}%`}}/></span>
   <div><span>On invoices<b>{formatMoney(c.verifiedCents)}</b></span><span>Promised<b>{formatMoney(c.promisedCents)}</b></span></div>
  </div>}
  <button className="button primary" onClick={()=>onOpen(link.commitmentId,link.destination,link.actionId)}>{link.label}</button>
 </section>;
}

export default function DocumentReader({source,view,revisions,onChooseRevision,onDownload,onOpen,onBack,headingRef,embedded=false,returnLabel,headingLevel=2}){
 const [tab,setTab]=useState('read');
 const reading=documentReading(view,source),visual=reading.visual||{};
 const hasGraphic=visual.kind!=='text';
 const state=visual.decision;
 const Title=headingLevel===3?'h3':'h2';
 const reviews=sourceUsages(view,source.id,source.revision).filter(item=>item.kind==='action');
 return <article className={`ops-document-reader document-reading-room${embedded?' embedded-document-reader':''}`} aria-label="Exact document version">
  <div className="document-reader-tools"><button className="document-back" onClick={onBack}>{returnLabel||'Back to documents'}</button><div role="group" aria-label="Document view"><button aria-pressed={tab==='read'} onClick={()=>setTab('read')}>Overview</button><button aria-pressed={tab==='original'} onClick={()=>setTab('original')}>Original text</button></div><button className="document-download" aria-label="Download exact document text" onClick={onDownload}>Download</button></div>
  {!embedded&&reading.caseLinks.length>0&&<div className="document-compact-action"><button className="button primary" onClick={()=>onOpen(reading.caseLinks[0].commitmentId,reading.caseLinks[0].destination,reading.caseLinks[0].actionId)}>{reading.caseLinks[0].label}</button></div>}
  <div className="document-reader-grid">
   <div className="document-sheet">
    <header className="document-sheet-heading"><div className="document-company-wordmark">{reading.company}</div><div className="document-sheet-date">Recorded {recorded(source.observedAt)}</div><Title ref={headingRef} tabIndex={-1}>{reading.title}</Title><span className="document-format">{reading.label!==reading.title&&reading.label}{state&&<>{reading.label!==reading.title&&' · '}<strong>{state}</strong></>}</span>{visual.kind==='renewal'&&Number.isSafeInteger(visual.netCostCents)&&<div className="document-compact-result">{formatMoney(Math.abs(visual.netCostCents),visual.currency)} {visual.netCostCents<0?'less':visual.netCostCents===0?'difference':'more'}<span>after the offered credit</span></div>}{visual.kind==='date-change'&&<div className="document-compact-result document-compact-dates">{shortDate(visual.oldDate)} <span aria-hidden="true" className="document-date-arrow">→</span> {shortDate(visual.newDate)}<span>Proposed credit date</span></div>}</header>
    <div hidden={tab!=='read'} className="document-overview">
     {hasGraphic?<><div className="document-illustration"><DocumentGraphic reading={reading}/></div><p className="document-graphic-caption">{visual.kind==='renewal'?'Offer comparison':visual.kind==='date-change'?'Proposed change':'Document summary'}</p></>:<div className="document-unstructured"><p>{reading.summary}</p><div>{source.text.replace(/^SYNTHETIC[^\n]*\n/,'').split(/\n\s*\n/).map((paragraph,i)=><p key={i}>{paragraph}</p>)}</div></div>}
     <details className="document-reading-notes"><summary>{visual.kind==='renewal'?'Comparison & terms':'Details & terms'}</summary><dl>{reading.facts.map(fact=><div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl>{reading.sections.map((section,i)=><div key={i}><h3>{section.label}</h3><p>{section.text}</p></div>)}</details>
    </div>
    <div hidden={tab!=='original'} className="document-original"><p className="document-original-title">{reading.originalTitle}</p><pre className="ops-source-text" tabIndex={0} aria-label="Exact source text">{source.text}</pre></div>
    <details className="document-version-details ops-record-note"><summary>Version & date details</summary><div className="ops-document-meta"><span>Version {source.revision} · {source.isCurrent?'Latest known':'Earlier version'}</span><span>Recorded {recorded(source.observedAt)}</span></div><div className="ops-source-revisions" role="group" aria-label="Known versions of this document">{revisions.map(version=><button key={version.revision} className="button secondary" aria-pressed={version.revision===source.revision} onClick={()=>onChooseRevision(version)}>Version {version.revision}</button>)}</div><dl><div><dt>Source ID</dt><dd>{source.id}</dd></div><div><dt>Original title</dt><dd>{source.title}</dd></div><div><dt>Effective on</dt><dd>{recorded(source.effectiveDate)}</dd></div></dl>{reviews.length>0&&onOpen&&<details className="document-review-inclusions"><summary>Included in {reviews.length} reviews</summary><p>These reviews included this version. Inclusion does not establish support for their terms.</p>{reviews.map(review=><button className="text-button" key={review.id} onClick={()=>onOpen(review.commitmentIds[0],review.destination,review.actionId)} disabled={!review.commitmentIds.length}>{review.label}</button>)}</details>}</details>
   </div>
   {!embedded&&<aside className="document-case-margin" aria-label="Related cases">{reading.caseLinks.length?reading.caseLinks.map(link=><CaseConnection key={link.commitmentId} view={view} link={link} onOpen={onOpen}/>):<div className="document-no-case"><h3>Not linked to a case</h3><p>This document is saved in your files.</p></div>}</aside>}
  </div>
 </article>;
}
