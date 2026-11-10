import React, { useMemo, useRef, useState, useEffect, useLayoutEffect } from 'react';
import { Activity, ArrowDownToLine, ArrowRight, Building2, ChevronLeft, ChevronRight, Clock3, FileText, RefreshCw, Search, AlertTriangle, SlidersHorizontal, X } from 'lucide-react';
import { evaluateWorkspace, isDate } from './assurance/index.mjs';
import { eventLabel, financialReport, operationQueue, reportCsv, sourceKey, sourceLibrary, sourceUsages, vendorSummaries, workspaceActivity } from './operations.mjs';
import { correspondenceStory, formatMoney } from './correspondence.mjs';
import {createHistoryCopy} from './history-copy.mjs';
import {documentReading} from './document-reading.mjs';
import DocumentReader from './DocumentReader.jsx';
import DocumentGraphic from './DocumentGraphic.jsx';
import CaseGraphic from './CaseGraphic.jsx';
import {CreditPaper,CreditCapacity,creditInvoiceProof,creditDocumentKind} from './Credits.jsx';
import './operations.css';
import './company-task-visual.css';

const today = () => new Date().toISOString().slice(0, 10);
const endOf = date => `${date}T23:59:59.999Z`;
const money = cents => formatMoney(cents);
const shortDate = value => value ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`)) : '—';
const documentLabel = kind => ({email:'Message',invoice:'Invoice',credit_memo:'Credit note',contract:'Agreement',incident:'Service issue',agent_conversation:'Company reply',allocation_resolution:'Matching instructions'}[kind] || kind?.replaceAll('_',' ') || 'Document');
const changeLabel = type => ({COMMITMENT_CREATED:'Promise added',SOURCE_ADDED:'Document added',SOURCE_REVISED:'Document updated',CREDIT_REGISTERED:'Credit recorded',CREDIT_APPLIED:'Invoice added for credit',CREDIT_ALLOCATED:'Credit matched to a promise',ALLOCATION_CREATED:'Credit matched to a promise',ACTION_PROPOSED:'Next step prepared',ACTION_APPROVED:'Next step approved',ACTION_EXECUTED:'Approved step recorded',AMENDMENT_PROPOSED:'Different terms proposed',AMENDMENT_ACCEPTED:'New terms accepted',AMENDMENT_DISMISSED:'Proposed terms declined',CREDIT_REVERSED:'Credit correction recorded',CREDIT_RESOLVED:'Credit matching limits approved'}[type] || eventLabel(type));
const personLabel = actor => actor.name || ({admin:'Administrator',analyst:'Analyst',approver:'Reviewer',executor:'Operator',viewer:'Read-only member'}[actor.role] || actor.role);
const statusLabels = { open: 'Open', partial: 'Partly applied', verified: 'Applied', applied: 'Applied', issued: 'Issued · not applied', scheduled: 'Not due yet', conditional: 'Conditional', deadline_expired: 'Deadline passed', stale: 'Out of date', blocked: 'Blocked', approved: 'Approved', proposed: 'Needs approval', executed: 'Recorded' };
const categoryLabels = { urgent: 'Time sensitive', review: 'Review', evidence: 'Missing evidence', claim: 'Follow-up', scheduled: 'Scheduled' };
const taskTitles = { 'Review expired claim window': 'Check the claim deadline', 'Resolve competing terms': 'Choose between proposed terms', 'Resolve credit attribution': 'Match the credit to a case', 'Review revised evidence': 'Review the updated document', 'Refresh the action review': 'Review the action again', 'Inspect a blocked action': 'Review the blocked action', 'Record the approved action': 'Record the approved action', 'Review the prepared action': 'Approve the prepared action', 'Attribute available credit': 'Assign the available credit', 'Obtain invoice application evidence': 'Add proof the credit was applied', 'Review conditional terms': 'Review the offer conditions', 'Await the promised date': 'Wait for the promised credit', 'Follow up the outstanding promise': 'Follow up on the missing credit', 'Inspect an unmatched credit': 'Match the unassigned credit' };
const taskTitle = (item,context=item) => item.title==='Inspect a blocked action'&&context.commitment?.conditions?.length ? 'Review the offer' : item.title==='Review expired claim window'&&context.commitment?.issuedCents>0 ? 'Check the credit note against an invoice' : taskTitles[item.title] || item.title;
function taskReason(issue, item = issue) {
  switch (issue.title) {
    case 'Review expired claim window': return item.commitment?.issuedCents > 0 ? `A credit note is already recorded. Check for an invoice showing it was used. The deadline for a new claim passed ${shortDate(item.commitment.deadline.date)}.` : `The deadline for a new claim passed ${shortDate(item.commitment?.deadline.date)}. Read the agreement before taking the next step.`;
    case 'Resolve competing terms': return 'The company proposed more than one change. Neither has been accepted; the original promise still applies.';
    case 'Resolve credit attribution': return 'A credit is recorded, but it is not clear which promise it covers. Add the company’s clarification before matching it.';
    case 'Review revised evidence': return 'A supporting document has changed. This case still uses the earlier version.';
    case 'Refresh the action review': return 'The documents, terms, policy or credit balances changed. The previous review no longer authorizes this action.';
    case 'Record the approved action': return 'The next step has been approved. Record that step; an invoice is still needed to confirm any credit.';
    case 'Review the prepared action': return 'A next step is prepared. A reviewer needs to check its documents and terms before it can be recorded.';
    case 'Attribute available credit': return 'A credit has been recorded. Check how much belongs to this promise.';
    case 'Obtain invoice application evidence': return 'The credit note is here. Add an invoice showing that it reduced the bill.';
    case 'Review conditional terms': return 'This is an offer with conditions, not a reduction already received. Read the extra spending or terms before accepting.';
    case 'Await the promised date': return `The credit is expected by ${shortDate(item.commitment?.dueDate)}. No overdue follow-up is needed yet.`;
    case 'Follow up the outstanding promise': return `The credit was due ${shortDate(item.commitment?.dueDate)}. Check the agreement and approval requirements before following up.`;
    default: return issue.reason;
  }
}

const definitions = {
  operations: ['Needs attention', 'The conversations that need you next.'],
  vendors: ['Companies', 'Each company’s promises, invoices and replies.'],
  library: ['Documents', 'The original promises, invoices and replies.'],
  audit: ['History', 'What changed, and who recorded it.'],
  reports: ['Reports', 'What was promised. What reached an invoice.'],
};

function download(contents, filename, type = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Empty({ title, children, onClear }) {
  return <div className="ops-empty"><FileText size={25}/><h2>{title}</h2><p>{children}</p>{onClear && <button className="button secondary" onClick={onClear}>Clear filters</button>}</div>;
}
function Status({ value }) { return <span className={`ops-status ${value}`}>{statusLabels[value] || value}</span>; }
function SearchField({ value, onChange, label, placeholder }) {
  return <label className="ops-search"><Search size={17}/><input aria-label={label} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder}/>{value && <button aria-label={`Clear ${label.toLowerCase()}`} onClick={() => onChange('')}><X size={14}/></button>}</label>;
}
function VendorFilter({ view, value, onChange, label = 'Filter by company' }) {
  return <label>Company<select aria-label={label} value={value} onChange={event => onChange(event.target.value)}><option value="">All companies</option>{view.vendors.map(vendor => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}</select></label>;
}
function Pager({ page, total, size = 24, onChange }) {
  const pages = Math.max(1, Math.ceil(total / size));
  if (total <= size) return null;
  return <div className="ops-pagination"><span>{page * size + 1}–{Math.min((page + 1) * size, total)} of {total}</span><button className="button secondary" aria-label="Previous records" disabled={page === 0} onClick={() => onChange(page - 1)}><ChevronLeft size={14}/></button><button className="button secondary" aria-label="Next records" disabled={page >= pages - 1} onClick={() => onChange(page + 1)}><ChevronRight size={14}/></button></div>;
}
function CaseButton({ view, id, destination = 'portfolio', actionId = null, onOpen, children }) {
  const commitment = view.commitments.find(item => item.id === id);
  return commitment ? <button className="text-button" onClick={() => onOpen(id, destination, actionId)}>{children || commitment.reference}<ArrowRight size={13}/></button> : null;
}
function RecordNote({ title = 'About these records', children }) {
  return <details className="ops-record-note"><summary>{title}</summary><div>{children}</div></details>;
}
function Facts({ children, className = '' }) { return <dl className={`ops-fact-list ${className}`}>{children}</dl>; }
function Fact({ label, children }) { return <div><dt>{label}</dt><dd>{children}</dd></div>; }

function storyPreview(view,commitment){
  if(!commitment)return null;
  const story=correspondenceStory(view,commitment);
  return story.documents.find(item=>item.available&&item.kind==='invoice')?.source || story.documents.find(item=>item.available&&item.kind==='credit_memo')?.source || story.documents.find(item=>item.available)?.source || null;
}

function SourcePrint({view,source,onOpen,caption}){
  const reading=documentReading(view,source);
  return <button className="relationship-source-print" data-source-id={source.id} data-source-revision={source.revision} onClick={()=>onOpen(source.vendorId,sourceKey(source))} title={source.title}>
    <span className="relationship-source-art" aria-hidden="true"><DocumentGraphic reading={reading} small/></span>
    <strong>{reading.title}</strong><small>{caption||`Recorded ${shortDate(source.observedAt)}`}</small>
  </button>;
}

function MissingInvoice(){
  return <div className="task-missing-invoice" aria-label="Matching invoice not added">
    <svg viewBox="0 0 220 170" aria-hidden="true"><path d="M44 13H150L177 40V157H44Z" fill="#f5f0e3" stroke="#c7b999" strokeWidth="1.5" strokeDasharray="4 4"/><path d="M150 13V40H177" fill="#e8dfcb" stroke="#c7b999"/><path d="M64 60H151M64 76H136M64 93H151" stroke="#d0c5ad" strokeWidth="2"/><path d="M98 113H124M111 100V126" stroke="#9c7356" strokeWidth="1.5"/></svg>
    <strong>Invoice not added</strong><small>No matching invoice has been added.</small>
  </div>;
}

function taskDocuments(view,item){
  const c=item.commitment;
  if(!c){const credit=view.credits.find(credit=>credit.id===item.creditId);return (credit?.sourceLinks||[]).map(link=>view.sourceVersions.find(source=>source.id===link.sourceId&&source.revision===link.revision)).filter(Boolean).slice(0,2);}
  if(item.title==='Resolve competing terms'){
    const links=view.amendments.filter(amendment=>amendment.commitmentId===c.id&&!amendment.accepted&&!amendment.rejected).flatMap(amendment=>amendment.sourceLinks||[]);
    return links.map(link=>view.sourceVersions.find(source=>source.id===link.sourceId&&source.revision===link.revision)).filter((source,index,all)=>source&&all.findIndex(other=>other?.id===source.id&&other?.revision===source.revision)===index).slice(0,2);
  }
  const story=correspondenceStory(view,c),available=story.documents.filter(item=>item.available).map(item=>item.source);
  if(item.title==='Review revised evidence'){
    const old=available.find(source=>view.sources.some(current=>current.id===source.id&&current.revision!==source.revision));
    const latest=old&&view.sources.find(source=>source.id===old.id);
    if(old&&latest)return [old,latest];
  }
  const action=view.actions.find(action=>action.id===item.actionId),amendment=action&&view.amendments.find(amendment=>amendment.id===action.payload?.amendmentId);
  if(amendment){const source=amendment.sourceLinks.map(link=>view.sourceVersions.find(source=>source.id===link.sourceId&&source.revision===link.revision)).find(Boolean);if(source)return [source];}
  const invoice=available.find(source=>source.kind==='invoice'),note=available.find(source=>source.kind==='credit_memo');
  if(note)return [note,...(invoice?[invoice]:[])];
  const promise=available.find(source=>source.kind==='email'||source.kind==='agent_conversation'||source.kind==='contract')||available[0];
  return [promise,invoice].filter((source,index,all)=>source&&all.indexOf(source)===index).slice(0,2);
}

function Queue({view,onOpen,onVendor,onSection,onLibrary}){
  const [query,setQuery]=useState(''),[category,setCategory]=useState(''),[vendorId,setVendor]=useState(''),[selectedId,setSelected]=useState('');
  const all=operationQueue(view),items=operationQueue(view,{category,vendorId}).map(item=>{const issue=category&&item.issues.find(issue=>issue.category===category);return issue&&item.category!==category?{...item,...issue,issues:[issue,...item.issues.filter(other=>other!==issue)]}:item;}).filter(item=>`${item.vendorName} ${item.reference} ${item.title} ${taskTitle(item)} ${item.reason} ${item.commitment?correspondenceStory(view,item.commitment,item.vendorName).headline:''}`.toLowerCase().includes(query.trim().toLowerCase()));
  const selected=items.find(item=>item.id===selectedId);
  const clear=()=>{setQuery('');setCategory('');setVendor('');};
  const open=item=>item.commitmentId?onOpen(item.commitmentId,item.title==='Review expired claim window'&&item.commitment.issuedCents>0?'ledger':item.destination,item.title==='Review expired claim window'&&item.commitment.issuedCents>0?null:item.actionId):onVendor(item.vendorId,'credits');
  const active=items.filter(item=>item.category!=='scheduled'),waiting=items.filter(item=>item.category==='scheduled');
  function taskRow(item){
    const expanded=item.id===selected?.id,story=item.commitment?correspondenceStory(view,item.commitment,item.vendorName):null,docs=taskDocuments(view,item);
    const needsInvoice=Boolean(item.commitment&&!item.commitment.conditions.length&&item.commitment.outstandingCents>0&&!docs.some(source=>source.kind==='invoice')&&(!item.commitment.verifiedCents||item.commitment.issuedCents>0));
    const preview=docs[0];
    return <div className={`ops-task-item relationship-task${expanded?' expanded':''}`} key={item.id}>
      <button className="ops-task-row" onClick={()=>setSelected(expanded?'':item.id)} aria-expanded={expanded} aria-controls={`task-${item.id}`}>
        <span className="ops-task-preview" aria-hidden="true">{preview?<DocumentGraphic reading={documentReading(view,preview)} small/>:<FileText size={32}/>}</span>
        <span className="ops-task-main"><span className="ops-record-heading"><strong>{item.vendorName}</strong><span className={`ops-priority ${item.category}`}>{categoryLabels[item.category]}</span></span><span>{taskTitle(item)}</span><small>{story?.headline||item.reference}</small></span>
        <span className="ops-task-date">{item.commitment?shortDate(item.commitment.dueDate):'—'}</span>
        <strong className="ops-task-amount">{money(item.amountCents)}<small>{item.commitment?.conditions.length?'Conditional offer':'Amount to check'}</small></strong><ChevronRight size={17} className="ops-task-chevron"/>
      </button>
      {expanded&&<div className="ops-task-expanded" id={`task-${item.id}`}>
        <div className="task-document-tray" aria-label="Documents for this task">{docs.length?docs.map(source=><SourcePrint key={sourceKey(source)} view={view} source={source} onOpen={onLibrary}/>):<div className="task-no-source"><FileText size={27}/><strong>No supporting document added</strong></div>}{needsInvoice&&<MissingInvoice/>}</div>
        <aside className="task-next-step"><span className="task-next-label">Next step · {item.vendorName}</span><h3>{taskTitle(item)}</h3><p className="ops-lead">{taskReason(item)}</p><button className="button primary" onClick={()=>open(item)}>{item.commitmentId?'Open case':'View company credits'}</button><RecordNote title="Case reference"><Facts><Fact label="Reference">{item.reference}</Fact>{item.commitment&&<Fact label="Expected on">{shortDate(item.commitment.dueDate)}</Fact>}</Facts></RecordNote>
          {item.issues.length>1&&<details className="ops-related task-other-issues"><summary>Also needs attention <span>{item.issues.length-1}</span></summary>{item.issues.slice(1).map(issue=><div key={`${issue.category}-${issue.priority}`}><button className="text-button" onClick={()=>onOpen(item.commitmentId,issue.destination,issue.actionId)}>{taskTitle(issue,item)}</button><p>{taskReason(issue,item)}</p></div>)}</details>}
        </aside>
      </div>}
    </div>;
  }
  return <div className="relationship-task-board">
    <div className="ops-filter-tabs" role="group" aria-label="Task type">{[['','All tasks'],...Object.entries(categoryLabels)].map(([id,label])=><button key={id} aria-pressed={category===id} onClick={()=>setCategory(id)}>{label}<span>{id?all.filter(item=>item.category===id||item.issues.some(issue=>issue.category===id)).length:all.length}</span></button>)}</div>
    <div className="ops-toolbar"><SearchField value={query} onChange={setQuery} label="Search tasks" placeholder="Find a company or next step…"/><VendorFilter view={view} value={vendorId} onChange={setVendor}/>{items.length>0&&(query||vendorId)&&<button className="text-button" onClick={clear}>Clear filters</button>}</div>
    {!items.length?<Empty title={all.length?'No tasks match your filters':'No next steps right now'} onClear={all.length?clear:null}>{all.length?'Try a different company or task type.':'No next steps are required by the records currently in this workspace.'}</Empty>:<div className="ops-task-desk"><section className="ops-table-panel" aria-label="Prioritized tasks"><div className="ops-section-heading"><h2>{active.length?'Needs attention':'Scheduled tasks'}</h2><span>{active.length||waiting.length} {(active.length||waiting.length)===1?'case':'cases'} · highest priority first</span></div><div className="ops-task-table">{active.map(taskRow)}{!active.length&&waiting.map(taskRow)}</div></section>{active.length>0&&waiting.length>0&&<section className="ops-waiting-tasks"><div className="ops-section-heading"><h2><Clock3 size={16}/>Waiting for the promised date</h2><span>{waiting.length} {waiting.length===1?'task':'tasks'}</span></div>{waiting.map(taskRow)}</section>}</div>}
    <div className="ops-bottom-line"><button className="text-button" onClick={()=>onSection('vendors')}>View companies</button></div>
  </div>;
}

function VendorDirectory({view,initialVendorId,initialTab,targetNonce,onOpen,onLibrary,onChooseCompany,preserveQuery=false}){
  const [query,setQuery]=useState(''),[selectedId,setSelected]=useState(initialVendorId||''),[tab,setTab]=useState(initialTab||'commitments'),[caseId,setCaseId]=useState(''),[requestedCompany,setRequestedCompany]=useState(initialVendorId||'');
  const companyHeading=useRef(null),companyList=useRef(null);
  useLayoutEffect(()=>{if(initialTab)setTab(initialTab);if(initialVendorId){const changed=initialVendorId!==selectedId;setSelected(initialVendorId);setRequestedCompany(initialVendorId);if(!preserveQuery&&query.trim()&&!vendorSummaries(view,{query}).some(v=>v.id===initialVendorId))setQuery('');if(changed)setCaseId('');}},[initialTab,initialVendorId,targetNonce]);
  useLayoutEffect(()=>{if(initialVendorId&&companyHeading.current){if(matchMedia('(max-width:760px)').matches)companyHeading.current.closest('.ops-company-detail')?.scrollIntoView({block:'start'});companyHeading.current.focus({preventScroll:true});}},[initialVendorId,targetNonce,selectedId]);
  const vendors=vendorSummaries(view,{query}),unavailable=requestedCompany&&!view.vendors.some(v=>v.id===requestedCompany),selected=vendors.find(vendor=>vendor.id===selectedId)||vendors[0];
  const selectedCase=selected?.commitments.find(commitment=>commitment.id===caseId)||selected?.commitments[0];
  const selectedStory=selectedCase?correspondenceStory(view,selectedCase,selected.name):null;
  function chooseCompany(id){setRequestedCompany('');setSelected(id);setCaseId('');onChooseCompany?.(id,tab);requestAnimationFrame(()=>{if(matchMedia('(max-width:760px)').matches)companyHeading.current?.closest('.ops-company-detail')?.scrollIntoView({block:'start'});companyHeading.current?.focus({preventScroll:true});});}
  function backToCompanies(){const row=[...(companyList.current?.querySelectorAll('[data-company]')||[])].find(node=>node.dataset.company===selected?.id);row?.scrollIntoView({block:'nearest'});row?.focus({preventScroll:true});}
  if(unavailable)return <Empty title="Company not found" onClear={()=>{setRequestedCompany('');setSelected('');setQuery('');}}>This company is not in the current workspace.</Empty>;
  return <div className="relationship-company-directory">
    <div className="ops-toolbar"><SearchField label="Search companies" value={query} onChange={setQuery} placeholder="Find a company…"/><span className="ops-result-count">{vendors.length} {vendors.length===1?'company':'companies'}</span></div>
    {!vendors.length?<Empty title={view.vendors.length?'No companies match your search':'No companies yet'} onClear={query?()=>setQuery(''):null}>{view.vendors.length?'Try a company name or credit reference.':'Add an agreement or credit document to create your first company record.'}</Empty>:<div className="ops-workspace ops-company-workspace">
      <section className="ops-company-list" aria-label="Companies" ref={companyList}><div className="ops-section-heading"><h2>Your companies</h2><span>{vendors.length} files</span></div>{vendors.map(vendor=>{const first=vendor.commitments[0],preview=storyPreview(view,first);return <button className={`ops-company-row${vendor.id===selected.id?' selected':''}`} key={vendor.id} data-company={vendor.id} onClick={()=>chooseCompany(vendor.id)} aria-pressed={vendor.id===selected.id}><span className="company-file-preview" aria-hidden="true">{preview?<DocumentGraphic reading={documentReading(view,preview)} small/>:<FileText size={30}/>}</span><span><strong>{vendor.name}</strong><small>{vendor.commitments.length} {vendor.commitments.length===1?'case':'cases'} · {vendor.sources.length} documents</small><span className="company-list-result">{vendor.commitments.length>0&&vendor.commitments.every(c=>c.conditions.length>0)?`Offer ${money(vendor.totals.conditionalCents)}`:vendor.commitments.length?`${money(vendor.totals.outstandingCents)} still to check`:'No promise yet'}</span></span></button>;})}</section>
      <article className="ops-detail ops-company-detail" aria-label="Selected company"><button className="company-list-return text-button" onClick={backToCompanies}>Back to companies</button><header><div className="ops-company-title"><span className="ops-company-avatar" aria-hidden="true">{selected.name.slice(0,1)}</span><div><h2 ref={companyHeading} tabIndex={-1}>{selected.name}</h2><p>{selected.commitments.length} {selected.commitments.length===1?'case':'cases'} · {selected.sources.length} original documents</p></div></div><span className="company-file-label">Company file</span></header>
        <div className="ops-local-tabs" role="group" aria-label="Company records">{[['commitments','Cases'],['credits','Credit notes'],['sources','Documents']].map(([id,name])=><button key={id} onClick={()=>{setTab(id);onChooseCompany?.(selected.id,id);}} aria-pressed={tab===id}>{name}<span>{selected[id].length}</span></button>)}</div>
        <div className="ops-detail-body">
          {tab==='commitments'&&<div className="ops-company-records">{selected.commitments.length?<>{selected.commitments.length>1&&<div className="company-case-picker" role="group" aria-label="Company cases">{selected.commitments.map(commitment=><button key={commitment.id} className={selectedCase.id===commitment.id?'selected':''} aria-pressed={selectedCase.id===commitment.id} onClick={()=>setCaseId(commitment.id)}>{correspondenceStory(view,commitment,selected.name).headline}</button>)}</div>}<div className="ops-case-row company-case-file"><div className="company-case-heading"><h3>{selectedStory.headline}</h3><button className="button primary" onClick={()=>onOpen(selectedCase.id,'portfolio')}>Open this case</button></div><CaseGraphic view={view} commitment={selectedCase}/><RecordNote title="Case details"><p>{selectedStory.detail}</p>{selectedStory.deadlineNote&&<p>{selectedStory.deadlineNote}</p>}<Facts><Fact label="Reference">{selectedCase.reference}</Fact><Fact label="Expected on">{shortDate(selectedCase.dueDate)}</Fact><Fact label={selectedCase.conditions.length?'Offer':'Promise'}>{formatMoney(selectedCase.promisedCents,selectedCase.currency)}</Fact></Facts><Status value={selectedCase.status}/></RecordNote></div></>:<Empty title="No cases yet">Credits and documents can exist before an agreement is recorded.</Empty>}</div>}
          {tab==='credits'&&<div className="ops-company-records company-credit-shelf">{selected.credits.length?selected.credits.map(credit=>{const original=credit.sourceLinks.map(link=>view.sourceVersions.find(source=>source.id===link.sourceId&&source.revision===link.revision)).find(Boolean);return <section className="ops-company-credit" key={credit.id}><div className="company-credit-visual"><CreditPaper credit={credit} company={selected.name} kind={creditDocumentKind(view,credit)} compact/><div className="company-credit-use"><h3>{credit.quarantined?'Matching needs clarification':credit.status==='issued'?'Invoice still needed':creditInvoiceProof(view,credit)?'Invoice supplied':'Applied credit recorded'}</h3><CreditCapacity credit={credit}/><div className="ops-case-links">{[...new Set([...credit.candidateCommitmentIds,...credit.allocations.map(allocation=>allocation.commitmentId)])].map(id=><CaseButton key={id} view={view} id={id} destination="ledger" onOpen={onOpen}>Check the {formatMoney(view.commitments.find(c=>c.id===id)?.promisedCents||0,credit.currency)} {view.commitments.find(c=>c.id===id)?.conditions.length?'offer':'promise'}</CaseButton>)}</div></div></div>{credit.quarantined&&<p className="ops-warning">{credit.quarantineReason}</p>}<RecordNote title="Document & record details"><Facts><Fact label="Document">{credit.invoiceId}</Fact><Fact label="Reference">{credit.reference}</Fact><Fact label="Invoice line">{credit.lineId||'Not supplied'}</Fact><Fact label="Balance after reversals">{formatMoney(credit.availableCents,credit.currency)}</Fact></Facts><Status value={credit.status}/></RecordNote></section>; }):<Empty title="No credits recorded">A promise is not a credit note. Add the note or invoice when it arrives.</Empty>}</div>}
          {tab==='sources'&&<div className="ops-company-records company-document-shelf">{selected.sources.length?selected.sources.map(source=>{const reading=documentReading(view,source);return <button className="ops-source-link" key={sourceKey(source)} data-source-id={source.id} data-source-revision={source.revision} title={source.title} onClick={()=>onLibrary(selected.id,sourceKey(source))}><span className="company-document-art" aria-hidden="true"><DocumentGraphic reading={reading} small/></span><span><strong>{reading.title}</strong><small>{reading.label} · {shortDate(source.observedAt)}</small></span></button>;}):<Empty title="No documents yet">Supporting text will appear here when it is added to the workspace.</Empty>}</div>}
          <RecordNote title="Company amounts & details"><dl className="ops-company-balances"><div><dt>Not yet on invoices</dt><dd>{money(selected.totals.outstandingCents)}</dd></div><div><dt>Confirmed on invoices</dt><dd>{money(selected.totals.verifiedCents)}</dd></div><div><dt>Credit notes awaiting invoices</dt><dd>{money(selected.totals.issuedCents)}</dd></div></dl><Facts><Fact label="Credit balance not assigned">{money(selected.totals.unallocatedCents)}</Fact><Fact label="Company ID">{selected.id}</Fact></Facts><p>Offers with conditions are separate. A credit note does not by itself confirm an invoice reduction.</p></RecordNote>
        </div>
      </article>
    </div>}
  </div>;
}

function EvidenceLibrary({ workspace, initialVendorId, initialSourceKey, targetNonce, onOpen }) {
  const [query, setQuery] = useState(''), [vendorId, setVendor] = useState(initialVendorId || ''), [kind, setKind] = useState(''), [versions, setVersions] = useState(initialSourceKey ? 'all' : 'current'), [knownBy, setKnownBy] = useState(today), [selectedKey, setSelected] = useState(initialSourceKey || ''), [page, setPage] = useState(0), [explicitTarget, setExplicitTarget] = useState(initialSourceKey || '');
  useEffect(() => { if (initialSourceKey) { setSelected(initialSourceKey); setExplicitTarget(initialSourceKey); setVersions('all'); setQuery(''); setKind(''); setVendor(initialVendorId || ''); setKnownBy(today()); setPage(0); } else if (initialVendorId) { setVendor(initialVendorId); setQuery(''); } }, [initialSourceKey, initialVendorId, targetNonce]);
  const [readerOpen,setReaderOpen]=useState(Boolean(initialSourceKey));
  const readerHeading=useRef(null),sourceList=useRef(null);
  useEffect(()=>{if(initialSourceKey)setReaderOpen(true);},[initialSourceKey,targetNonce]);
  const projected = useMemo(() => { try { if (!isDate(knownBy) || knownBy > today()) throw new Error('Choose a document cutoff on or before today.'); return { view: evaluateWorkspace(workspace, { asOf: today(), knownAt: endOf(knownBy) }) }; } catch (error) { return { error: error.message }; } }, [workspace, knownBy]);
  const view = projected.view;
  const unavailable = explicitTarget && view && !view.sourceVersions.some(source => sourceKey(source) === explicitTarget);
  const items = view ? sourceLibrary(view, { query, vendorId, kind, versions }) : [];
  const safePage = Math.min(page, Math.max(0, Math.ceil(items.length / 24) - 1)), shown = items.slice(safePage * 24, (safePage + 1) * 24);
  const selected = items.find(source => source.key === selectedKey) || items.find(source => source.key === explicitTarget) || shown[0];
  const update = setter => value => { setter(value); setExplicitTarget(''); setSelected(''); setPage(0); };
  const clear = () => { setExplicitTarget(''); setSelected(''); setQuery(''); setVendor(''); setKind(''); setVersions('current'); setPage(0); };
  const revisions = selected ? view.sourceVersions.filter(source => source.id === selected.id).sort((a, b) => a.revision - b.revision) : [];
  function displayVersions(next){const retained=next==='current'?view?.sources.find(source=>source.id===selected?.id):selected;setVersions(next);setExplicitTarget('');if(retained)setSelected(sourceKey(retained));const nextItems=view?sourceLibrary(view,{query,vendorId,kind,versions:next}):[];setPage(Math.max(0,Math.floor(nextItems.findIndex(source=>source.key===(retained?sourceKey(retained):selectedKey))/24)));}
  function chooseRevision(source) { setVersions('all'); setQuery(''); setKind(''); setExplicitTarget(''); setSelected(sourceKey(source)); const all = sourceLibrary(view, { vendorId, versions: 'all' }); setPage(Math.max(0, Math.floor(all.findIndex(item => item.key === sourceKey(source)) / 24))); }
  useEffect(() => { if (explicitTarget) { const index = items.findIndex(source => source.key === explicitTarget); if (index >= 0) setPage(Math.floor(index / 24)); } }, [explicitTarget, workspace, knownBy]);
  function openDocument(source){setSelected(source.key);setExplicitTarget('');setReaderOpen(true);requestAnimationFrame(()=>{if(matchMedia('(max-width:760px)').matches)readerHeading.current?.closest('.document-reading-room')?.scrollIntoView({block:'start'});readerHeading.current?.focus({preventScroll:true});});}
  function backToDocuments(){setReaderOpen(false);requestAnimationFrame(()=>{const row=[...(sourceList.current?.querySelectorAll('[data-source-id]')||[])].find(node=>node.dataset.sourceId===selected?.id&&Number(node.dataset.sourceRevision)===selected?.revision);row?.focus();});}
  return <div className={`document-library${readerOpen?' has-open-document':''}`}>
    <div className="document-library-controls"><SearchField value={query} onChange={update(setQuery)} label="Search documents" placeholder="Find a document…"/>{view&&<VendorFilter view={view} value={vendorId} onChange={update(setVendor)}/>}<details className="document-library-filters"><summary>Filters & history</summary><div className="ops-document-controls"><label>Type<select aria-label="Filter document type" value={kind} onChange={event=>update(setKind)(event.target.value)}><option value="">All types</option>{[...new Set(view?.sourceVersions.map(source=>source.kind)||[])].sort().map(value=><option key={value} value={value}>{documentLabel(value)}</option>)}</select></label><label>Versions<select aria-label="Document versions" value={versions} onChange={event=>displayVersions(event.target.value)}><option value="current">Latest known</option><option value="all">All versions</option></select></label><label>Documents recorded by<input type="date" aria-label="Document knowledge cutoff" max={today()} value={knownBy} onChange={event=>{setKnownBy(event.target.value);setSelected('');setPage(0);}}/></label></div></details>{items.length>0&&!unavailable&&(query||vendorId||kind||versions!=='current')&&<button className="text-button" onClick={clear}>Clear filters</button>}</div>
    {unavailable?<Empty title="This exact document version is unavailable" onClear={clear}>It isn’t recorded at the selected cutoff. Choose a later date or clear the requested version.</Empty>:projected.error?<div className="ops-error" role="alert"><AlertTriangle size={19}/><p>{projected.error}</p></div>:!items.length?<Empty title="No documents match your filters" onClear={clear}>Try a different company, document type or cutoff date.</Empty>:<div className="ops-workspace ops-document-workspace">
      <section className="ops-document-list" aria-label="Documents" ref={sourceList}><div className="document-list-heading"><span>{items.length} {versions==='all'?'versions':'documents'}</span><span>Recently recorded</span></div>{shown.map(source=>{const reading=documentReading(view,source);return <button key={source.key} data-source-id={source.id} data-source-revision={source.revision} className={`ops-document-row${source.key===selected.key?' selected':''}`} aria-pressed={source.key===selected.key} onClick={()=>openDocument(source)}><span className="document-row-art"><DocumentGraphic reading={reading} small/></span><span className="document-row-copy"><span>{source.vendorName}</span><strong>{reading.title}</strong><small>{shortDate(source.observedAt)}</small></span></button>;})}<Pager page={safePage} total={items.length} onChange={value=>{setPage(value);setSelected('');setExplicitTarget('');}}/></section>
      <DocumentReader key={selected.key} source={selected} view={view} revisions={revisions} headingRef={readerHeading} onChooseRevision={chooseRevision} onDownload={()=>download(selected.text,`truthful-source-${selected.id.replace(/[^a-zA-Z0-9_-]/g,'_')}-revision-${selected.revision}.txt`)} onOpen={onOpen} onBack={backToDocuments}/>
    </div>}
  </div>;
}

function AuditActivity({ workspace, view, onOpen, managed }) {
  const [query, setQuery] = useState(''), [vendorId, setVendor] = useState(''), [actorId, setActor] = useState(''), [type, setType] = useState(''), [fromDate, setFrom] = useState(''), [toDate, setTo] = useState(''), [selectedId, setSelected] = useState(''), [page, setPage] = useState(0);
  const readHistory=useMemo(()=>createHistoryCopy(workspace),[workspace]);
  const all = workspaceActivity(workspace, view);
  const rangeError = fromDate && toDate && fromDate > toDate ? 'The start date must be on or before the end date.' : '';
  const needle=query.trim().toLowerCase();
  const events = rangeError ? [] : workspaceActivity(workspace, view, { vendorId, actorId, type, fromDate, toDate }).filter(event=>{const copy=readHistory(event);return !needle||`${copy.title} ${copy.detail} ${event.id} ${event.typeLabel} ${event.summary} ${event.vendorNames.join(' ')} ${event.references.join(' ')} ${event.actor.id} ${event.actor.role}`.toLowerCase().includes(needle);});
  const safePage = Math.min(page, Math.max(0, Math.ceil(events.length / 24) - 1)), shown = events.slice(safePage * 24, (safePage + 1) * 24), selected = events.find(event => event.id === selectedId) || shown[0];
  const actors = [...new Map(all.map(event => [event.actor.id, event.actor])).values()].sort((a, b) => a.id.localeCompare(b.id));
  const update = setter => value => { setter(value); setPage(0); setSelected(''); };
  const clear = () => { setQuery(''); setVendor(''); setActor(''); setType(''); setFrom(''); setTo(''); setPage(0); setSelected(''); };
  const filterCount = [actorId, type, fromDate, toDate].filter(Boolean).length;
  return <>
    <div className="ops-toolbar"><SearchField label="Search activity" value={query} onChange={update(setQuery)} placeholder="Search change, reference or person…"/><VendorFilter view={view} value={vendorId} onChange={update(setVendor)}/><details className="ops-filter-disclosure"><summary><SlidersHorizontal size={15}/>More filters{filterCount > 0 && <span>{filterCount}</span>}</summary><div className="ops-extra-filters"><label>Person<select aria-label="Filter activity actor" value={actorId} onChange={event => update(setActor)(event.target.value)}><option value="">Everyone</option>{actors.map(actor => <option key={actor.id} value={actor.id}>{actor.id} · {actor.role}</option>)}</select></label><label>Change type<select aria-label="Filter activity transition" value={type} onChange={event => update(setType)(event.target.value)}><option value="">All changes</option>{[...new Set(all.map(event => event.type))].sort().map(value => <option key={value} value={value}>{changeLabel(value)}</option>)}</select></label><label>Recorded from<input type="date" aria-label="Activity recorded from" value={fromDate} onChange={event => update(setFrom)(event.target.value)}/></label><label>Through<input type="date" aria-label="Activity recorded through" value={toDate} onChange={event => update(setTo)(event.target.value)}/></label></div></details>{(events.length>0||rangeError)&&(query || vendorId || filterCount > 0) && <button className="text-button" onClick={clear}>Clear filters</button>}</div>
    {rangeError ? <div className="ops-error" role="alert"><AlertTriangle size={18}/><p>{rangeError}</p></div> : !events.length ? <Empty title="No activity matches your filters" onClear={all.length ? clear : null}>{all.length ? 'Try another person, change type or date.' : 'Changes will appear here as you add documents and manage credits.'}</Empty> : <div className="ops-workspace ops-activity-workspace">
      <section className="ops-activity-list" aria-label="Recorded changes"><div className="ops-section-heading"><h2>{events.length} {events.length === 1 ? 'change' : 'changes'}</h2><span>Newest first</span></div><div className="ops-event-scroll">{shown.map((event, index) => <React.Fragment key={event.id}>{(index === 0 || shown[index - 1].observedAt.slice(0, 10) !== event.observedAt.slice(0, 10)) && <h3 className="ops-activity-date">{shortDate(event.observedAt)}</h3>}<button className={`ops-activity-row ${event.id === selected.id ? 'selected' : ''}`} aria-pressed={event.id === selected.id} onClick={() => setSelected(event.id)}><span className="ops-activity-icon"><Activity size={16}/></span><span><strong>{readHistory(event).title}</strong><span>{readHistory(event).detail}</span><small>{event.vendorNames.join(', ') || 'All companies'} · {personLabel(event.actor)}</small></span><small>{event.material ? 'Record changed' : 'Review step'}</small></button></React.Fragment>)}</div><Pager page={safePage} total={events.length} onChange={value => { setPage(value); setSelected(''); }}/></section>
      <article className="ops-detail ops-activity-detail" aria-label="Exact recorded change"><header><div><h2>{readHistory(selected).title}</h2><p>{readHistory(selected).detail}</p></div><Activity size={20}/></header><div className="ops-detail-body"><Facts><Fact label="Recorded on">{shortDate(selected.observedAt)}</Fact><Fact label="Effective on">{shortDate(selected.effectiveDate)}</Fact><Fact label="Person">{personLabel(selected.actor)}<small>{selected.actor.role}</small></Fact><Fact label="Company">{selected.vendorNames.join(', ') || 'Workspace-wide'}</Fact></Facts><div className="ops-case-links">{selected.commitmentIds.map(id => <CaseButton key={id} view={view} id={id} destination="history" onOpen={onOpen}>{selected.commitmentIds.length===1?'Read this case':correspondenceStory(view,view.commitments.find(c=>c.id===id))?.headline||'Read case'}</CaseButton>)}</div><details className="ops-command-details"><summary>Exact recorded data</summary><pre className="ops-event-json" tabIndex={0} aria-label="Exact recorded payload">{JSON.stringify(selected.payload, null, 2)}</pre></details><details className="ops-command-details"><summary>Command & event identity</summary><Facts><Fact label="Recorded change type">{selected.type}</Fact><Fact label="Promise references">{selected.references.join(', ') || 'None'}</Fact><Fact label="Recorded at">{selected.observedAt}</Fact><Fact label="Effective date">{selected.effectiveDate}</Fact><Fact label="Financial change">{selected.material ? 'Yes' : 'No · approval or lifecycle record'}</Fact><Fact label="Account ID">{selected.actor.id}</Fact><Fact label="Command">{selected.commandId}</Fact><Fact label="Event">{selected.id}</Fact><Fact label="Sequence">{selected.sequence}</Fact></Facts><pre className="ops-event-json" tabIndex={0}>{selected.commandCanonical}</pre></details><RecordNote><p>{managed ? 'People are identified by their authenticated workspace membership.' : 'People shown here are selectable demo identities.'} This history records workspace changes; it does not authenticate external documents or prove settlement. Date filters use when a change was recorded, separately from when it took effect.</p></RecordNote></div></article>
    </div>}
  </>;
}

function FinancialReports({ workspace, service, onVendor }) {
  const [asOf, setAsOf] = useState(today), [knownBy, setKnownBy] = useState(today), [exporting, setExporting] = useState(false), [exportError, setExportError] = useState(''), [query, setQuery] = useState('');
  const reportState = useMemo(() => { try { if (!isDate(asOf) || !isDate(knownBy)) throw new Error('Choose a valid financial date and document cutoff.'); if (knownBy > today()) throw new Error('The document cutoff cannot be later than today.'); return { report: financialReport(workspace, { asOf, knownAt: endOf(knownBy) }) }; } catch (error) { return { error: error.message }; } }, [workspace, asOf, knownBy]);
  const report = reportState.report, ticket = useRef(0);
  useEffect(() => () => { ticket.current += 1; }, []);
  async function packet() {
    if (!report || exporting || service.busy) return;
    const operation = ++ticket.current, cutoff = knownBy;
    setExporting(true); setExportError('');
    try { const packet = await service.exportPacket({ asOf: report.asOf, knownAt: report.knownAt }); if (operation === ticket.current) download(JSON.stringify(packet, null, 2), `truthful-report-${report.asOf}-known-${cutoff}.json`, 'application/json'); }
    catch (error) { if (operation === ticket.current) setExportError(error.message); }
    finally { if (operation === ticket.current) setExporting(false); }
  }
  const measures = report && [
    ['Promised invoice reductions', report.totals.promisedCents, 'Promises without new conditions, in effect on this date.'],
    ['Confirmed on invoices', report.totals.verifiedCents, 'Invoice credit matched to a promise. A credit note alone does not count.'],
    ['Still missing from invoices', report.totals.outstandingCents, 'Promised reductions not yet confirmed. Includes future dates and expired claim windows.'],
    ['Can be followed up now', report.totals.recoverableCents, 'Due now, without conditions, and still within the claim deadline.'],
    ['Credit notes awaiting an invoice', report.totals.issuedCents, 'Notes received, after any reversals. An invoice still needs to confirm the reduction.'],
    ['Offers that need a decision', report.totals.conditionalCents, 'Offers with new conditions. Separate from money promised or received.'],
  ];
  const vendors = report?.vendors.filter(vendor => `${vendor.name} ${vendor.id}`.toLowerCase().includes(query.trim().toLowerCase())) || [];
  return <>
    <div className="ops-toolbar ops-report-toolbar"><label>Report date<input type="date" aria-label="Report financial effective date" value={asOf} onChange={event => setAsOf(event.target.value)} disabled={exporting}/></label><label>Documents recorded by<input type="date" aria-label="Report knowledge cutoff" value={knownBy} max={today()} onChange={event => setKnownBy(event.target.value)} disabled={exporting}/></label><button className="text-button" disabled={exporting} onClick={() => { setAsOf(today()); setKnownBy(today()); }}>Today</button><div className="ops-report-exports"><button className="button secondary" disabled={!report || exporting} onClick={() => download(reportCsv(report), `truthful-vendor-report-${report.asOf}.csv`, 'text/csv;charset=utf-8')}><ArrowDownToLine size={15}/>Export CSV</button><button className="button secondary" disabled={!report || exporting || service.busy} onClick={packet}><ArrowDownToLine size={15}/>{exporting ? 'Preparing…' : 'Export audit packet'}</button></div></div>
    {reportState.error ? <div className="ops-error" role="alert"><AlertTriangle size={19}/><p>{reportState.error}</p></div> : <>
      <section className="ops-report" aria-label="Financial report"><header><div><h2>Promises and invoice credits</h2><p>{shortDate(report.asOf)} · Documents recorded through {shortDate(knownBy)}</p></div><span>USD</span></header><dl className="ops-report-measures">{measures.map(([label, value, explanation]) => <div key={label}><dt>{label}<small>{explanation}</small></dt><dd>{money(value)}</dd></div>)}</dl></section>
      <section className="ops-report ops-company-report" aria-label="Company financial breakdown"><div className="ops-report-table-heading"><div><h2>By company</h2><p>Each amount answers a different question; these columns are not added together.</p></div><SearchField value={query} onChange={setQuery} label="Search report companies" placeholder="Find a company…"/></div><div className="ops-table-scroll" tabIndex={0} role="region" aria-label="Company financial breakdown"><table><thead><tr><th scope="col">Company</th><th scope="col">Confirmed on invoices</th><th scope="col">Still missing</th><th scope="col">Credit notes awaiting invoices</th><th scope="col">Invoice credits in documents</th><th scope="col">Still to match</th><th scope="col">Offers with conditions</th></tr></thead><tbody>{vendors.map(vendor => <tr key={vendor.id}><th scope="row"><button className="text-button" onClick={() => onVendor(vendor.id)}>{vendor.name}<ArrowRight size={12}/></button></th>{['verifiedCents', 'outstandingCents', 'issuedCents', 'ledgerAppliedCents', 'unallocatedCents', 'conditionalCents'].map(key => <td key={key}>{money(vendor.totals[key])}</td>)}</tr>)}</tbody><tfoot><tr><th scope="row">All companies</th>{['verifiedCents', 'outstandingCents', 'issuedCents', 'ledgerAppliedCents', 'unallocatedCents', 'conditionalCents'].map(key => <td key={key}>{money(report.totals[key])}</td>)}</tr></tfoot></table></div>{!vendors.length && <Empty title={query ? 'No companies match your search' : 'No companies known at this cutoff'} onClear={query ? () => setQuery('') : null}>{query ? 'Try a different company name.' : 'Choose a later document cutoff to include newer records.'}</Empty>}{query && <p className="ops-table-note">Search filters the rows shown. Totals and exports always include all companies.</p>}</section>
      <RecordNote title="Calculations & export details"><div className="ops-report-secondary"><Facts><Fact label="Credit assigned to cases">{money(report.totals.allocatedCents)}</Fact><Fact label="Credit held for identity review">{money(report.totals.quarantinedCents)}</Fact><Fact label="Added obligations effective now">{money(report.totals.incrementalObligationCents)}</Fact><Fact label="Accepted future obligations">{money(report.totals.futureIncrementalObligationCents)}</Fact><Fact label="Verified value less current added obligations">{money(report.totals.netVerifiedValueCents)}</Fact><Fact label="Changes known at this cutoff">{report.observedEventCount}</Fact></Facts><p>Applied credit balances can exceed verified case value when credit is unassigned, held for review, conditional or above the promise. Don’t add these related measures together.</p><p>CSV amounts are integer cents and include currency and both dates. The audit packet includes the full workspace history plus this report, so its history can contain evidence after the selected cutoff.</p><p>Records do not establish document completeness, external settlement or realized savings. Renewal baselines remain explicit assumptions.</p></div></RecordNote>
    </>}
    {exportError && <div className="ops-error" role="alert"><AlertTriangle size={18}/><p>{exportError}</p><button className="text-button" onClick={packet}>Try again</button></div>}
  </>;
}

export default function Operations({ service, section = 'operations', onOpenCommitment, onSection, onOpenSource, onOpenCompany, target }) {
  const [context, setContext] = useState(()=>target?.sourceId?{vendorId:'',sourceKey:sourceKey({id:target.sourceId,revision:target.revision})}:target?.vendorId||target?.vendorTab?{vendorId:target.vendorId||'',vendorTab:target.vendorTab||'commitments',sourceKey:''}:{vendorId:'',sourceKey:''}), [refreshing, setRefreshing] = useState(false), [refreshError, setRefreshError] = useState('');
  useLayoutEffect(() => { if (target?.sourceId) setContext({ vendorId: '', sourceKey: sourceKey({ id: target.sourceId, revision: target.revision }) }); else if (target?.vendorTab || target?.vendorId) setContext({ vendorId: target.vendorId || '', vendorTab: target.vendorTab || 'commitments', sourceKey: '',preserveQuery:Boolean(target.preserveCompanyQuery) }); }, [target?.nonce, target?.sourceId, target?.revision, target?.vendorId, target?.vendorTab]);
  const date = today();
  const projection = useMemo(() => { try { return service.workspace ? { view: evaluateWorkspace(service.workspace, { asOf: date, knownAt: new Date().toISOString() }) } : {}; } catch (error) { return { error: error.message }; } }, [service.workspace, date]);
  const [title, description] = definitions[section] || definitions.operations;
  const goSection = next => { setContext({ vendorId: '', sourceKey: '' }); onSection(next); };
  const goVendor = (vendorId, vendorTab = 'commitments') => { setContext({ vendorId, vendorTab, sourceKey: '' }); if (onOpenCompany) onOpenCompany({ vendorId, vendorTab }); else onSection('vendors'); };
  const goLibrary = (vendorId, key) => { setContext({ vendorId, sourceKey: key }); if (onOpenSource) { const [sourceId, revision] = JSON.parse(key); onOpenSource({ sourceId, revision }); } else onSection('library'); };
  async function refresh() { if (refreshing || service.busy) return; setRefreshing(true); setRefreshError(''); try { await service.refresh(); } catch (error) { setRefreshError(error.message); } finally { setRefreshing(false); } }
  return <main className={`operations-page ops-section-${section}`}><div className="ops-page-heading"><div><h1>{title}</h1><p>{description}</p></div>{service.mode === 'server' && <button className="button secondary" onClick={refresh} disabled={refreshing || service.busy}><RefreshCw size={15} className={refreshing ? 'ops-refreshing' : ''}/>{refreshing ? 'Refreshing…' : 'Refresh'}</button>}</div>{(refreshError || service.error) && <div className="ops-error" role="alert"><AlertTriangle size={18}/><p>{refreshError || service.error}</p>{service.mode === 'server' && <button className="text-button" disabled={refreshing || service.busy} onClick={refresh}>Try again</button>}</div>}{projection.error ? <div className="ops-error" role="alert"><AlertTriangle size={19}/><p>{projection.error}</p></div> : !projection.view ? <div className="ops-loading" role="status"><div className="ops-loading-line"/><div className="ops-loading-line"/><div className="ops-loading-line"/><span>Loading workspace records…</span></div> : section === 'vendors' ? <VendorDirectory view={projection.view} initialVendorId={context.vendorId} initialTab={context.vendorTab} targetNonce={target?.nonce} preserveQuery={context.preserveQuery} onChooseCompany={(vendorId,vendorTab)=>{setContext({vendorId,vendorTab,sourceKey:'',preserveQuery:true});onOpenCompany?.({vendorId,vendorTab,preserveCompanyQuery:true});}} onOpen={onOpenCommitment} onLibrary={goLibrary}/> : section === 'library' ? <EvidenceLibrary workspace={service.workspace} initialVendorId={context.vendorId} initialSourceKey={context.sourceKey} targetNonce={target?.nonce} onOpen={onOpenCommitment}/> : section === 'audit' ? <AuditActivity workspace={service.workspace} view={projection.view} onOpen={onOpenCommitment} managed={service.authMode === 'managed-password'}/> : section === 'reports' ? <FinancialReports workspace={service.workspace} service={service} onVendor={goVendor}/> : <Queue view={projection.view} onOpen={onOpenCommitment} onVendor={goVendor} onSection={goSection} onLibrary={goLibrary}/>}</main>;
}
