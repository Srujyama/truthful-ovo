import React, { useEffect, useRef, useState, useId } from 'react';
import { ArrowDownToLine, ArrowRight, Check, CheckCheck, ChevronDown, ChevronRight, Clock3, FileCheck2, FileText, FlaskConical, FolderOpen, Link2, Mail, Play, Search, ShieldCheck, Trash2, Upload, X, AlertTriangle } from 'lucide-react';
import { analyzeEvidence } from './engine/index.mjs';
import { createCase, approveCase, verifyCase, readCases, saveCase, packetFor, summaryCsv, emailFor, STORAGE_KEY } from './recovery.mjs';
import './workbench.css';
import { evidenceActions, previewEvidencePortfolio } from './evidence-ui.mjs';
import './document-intake.css';

const initial = { vendor: 'Pipeline CRM', asOf: '2026-10-28', promiseText: '', invoiceCsv: '', replyText: '' };
const examples = [
  { id: 'pipeline', label: 'Partial credit', description: '$2,400 promised. Follow the missing $1,500.', vendor: 'Pipeline CRM' },
  { id: 'conditional', label: 'Changed terms', description: 'A credit tied to another year. Catch the condition.', vendor: 'Pipeline CRM' },
  { id: 'unmatched', label: 'Wrong reference', description: 'The amount fits. The evidence doesn’t.', vendor: 'Pipeline CRM' },
];
const stateLabels = { needs_review: 'Ready for review', partial: 'Partly applied', verified: 'Fully applied', scheduled: 'Not due yet', conditional: 'Terms need review', unsupported: 'Evidence needs review' };
const money = cents => new Intl.NumberFormat('en-US', { style:'currency',currency:'USD',maximumFractionDigits:2 }).format((cents || 0) / 100);

function download(content, filename, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}


function switchTab(event, keys, current, set, prefix) {
  let next;
  if(event.key === 'ArrowRight') next = (keys.indexOf(current)+1)%keys.length;
  else if(event.key === 'ArrowLeft') next = (keys.indexOf(current)+keys.length-1)%keys.length;
  else if(event.key === 'Home') next = 0;
  else if(event.key === 'End') next = keys.length-1;
  else return;
  event.preventDefault(); set(keys[next]); document.getElementById(`${prefix}-${keys[next]}`)?.focus();
}

export function SourceFileArt({type='promiseText',filled=false}) {
  return <svg className={`intake-file-art file-${type}`} viewBox="0 0 76 88" aria-hidden="true"><path d="M9 6h42l16 16v59H9Z" fill="#fffdf4" stroke="#c5b99c"/><path d="M51 6v16h16" fill="#e6dcc5" stroke="#c5b99c"/>{type==='invoiceCsv'?<><path d="M19 33h38v35H19Z" fill="#e5eadb" stroke="#b7bea7"/><path d="M19 44h38M19 56h38M33 33v35" stroke="#9aa98c"/></>:type==='replyText'?<><path d="M18 35h39v25H35l-9 7v-7h-8Z" fill="#e7ddc2" stroke="#c5b99c"/><path d="M25 43h25M25 50h18" stroke="#9b8c6b"/></>:<><path d="M19 35h36M19 43h29M19 56h36M19 64h21" stroke="#bab195" strokeWidth="2"/><path d="M19 23h18" stroke="#34563f" strokeWidth="3"/></>}{filled&&<g><circle cx="62" cy="72" r="12" fill="#365a43"/><path d="m56 72 4 4 8-9" fill="none" stroke="#fff9e8" strokeWidth="2"/></g>}</svg>;
}

export function IntakeFilesArt(){return <div className="intake-files-art" aria-hidden="true"><span><SourceFileArt type="promiseText"/></span><span><SourceFileArt type="invoiceCsv"/></span><span><SourceFileArt type="replyText"/></span></div>;}

/** A reconciliation of supplied rows, not a scan or a claim about external payment. */
export function EvidenceCreditArt({report}){
  const uid=useId().replaceAll(':',''),applied=report?.appliedCents??report?.verifiedCents,valid=report&&report.status!=='unsupported'&&Number.isSafeInteger(report.promisedCents)&&Number.isSafeInteger(report.outstandingCents)&&Number.isSafeInteger(applied);
  const fraction=valid&&report.promisedCents>0?Math.max(0,Math.min(1,applied/report.promisedCents)):0;
  return <figure className={`intake-credit-art${valid?'':' unconfirmed'}`} role="img" aria-label={valid?`${money(report.promisedCents)} ${report.condition?'offered with conditions':'promised'}. ${money(applied)} matched on invoices. ${money(report.outstandingCents)} ${report.condition?'conditional balance':'still missing'}.`:'The supplied documents need review before amounts can be confirmed.'}>
   <div className="intake-promise-paper" aria-hidden="true"><svg viewBox="0 0 340 230" preserveAspectRatio="none"><defs><linearGradient id={`${uid}-paper`}><stop stopColor="#fffdf5"/><stop offset="1" stopColor="#eee6d1"/></linearGradient></defs><path d="M1 1h308l30 29v199H1Z" fill={`url(#${uid}-paper)`} stroke="#cbbfa2"/><path d="M309 1v29h30" fill="#e4d8bd" stroke="#cbbfa2"/></svg><span>{report?.condition?'The offer':'The promise'}</span><strong>{valid?money(report.promisedCents):'Needs review'}</strong><i/><i/><i/></div>
   <div className="intake-invoice-paper" aria-hidden="true"><svg viewBox="0 0 340 230" preserveAspectRatio="none"><path d="M1 1h338v220l-13 8-13-8-13 8-13-8-13 8-13-8-13 8-13-8-13 8-13-8-13 8-13-8-13 8-13-8-13 8-13-8-13 8-13-8-13 8-13-8-13 8-13-8-13 8-13-8-13 8-13-8-13 8-13-8-13 8-13-8Z" fill="#fffcf2" stroke="#cbbfa2"/></svg><span>Invoice check</span><div><small>Matched credit</small><b>{valid?money(applied):'Not confirmed'}</b></div><div className="intake-credit-track"><i style={{width:`${fraction*100}%`}}/></div><div><small>{report?.condition?'Conditional balance':'Still missing'}</small><strong>{valid?money(report.outstandingCents):'—'}</strong></div></div>
  </figure>;
}

export default function Workbench({ notify, onWalkthrough, onPromote, portfolioWorkspace, portfolioRole, portfolioBusy = false, intakeIntent }) {
  const [form, setForm] = useState(initial);
  const [record, setRecord] = useState(null);
  const [draft, setDraft] = useState('');
  const [cases, setCases] = useState(() => { try { return readCases(localStorage); } catch { return []; } });
  const [error, setError] = useState(() => { try { readCases(localStorage); return ''; } catch { return 'Saved cases could not be read. Clear saved cases to start again.'; } });
  const [loading, setLoading] = useState(false);
  const [inputTab, setInputTab] = useState('promiseText');
  const [detailTab, setDetailTab] = useState('overview');
  const [citation, setCitation] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [exampleId, setExampleId] = useState('pipeline');
  const [storageError, setStorageError] = useState('');
  const [portfolioPreview, setPortfolioPreview] = useState(null);
  const fileInput = useRef(null), sourceInput = useRef(null), citationOrigin = useRef(null), operation = useRef(0);
  const handledIntake=useRef(null),intakeDraft=useRef(null),previousReview=useRef(null),reviewEdits=useRef(new Map());
  useEffect(() => () => { operation.current++; }, []);
  const report = record?.report;
  function revealReview(){requestAnimationFrame(()=>{const title=document.querySelector('.finding-header h2');title?.focus({preventScroll:true});title?.scrollIntoView({block:'start'});});}
  useEffect(()=>{if(record?.id&&window.matchMedia('(max-width:860px)').matches)revealReview();},[record?.id]);
  const approved = record?.audit.some(event => event.type === 'CLAIM_APPROVED');
  const supported = report && report.status !== 'unsupported';
  const actions = evidenceActions(report, { approved, draft });
  const canApprove = actions?.approval.allowed;
  const portfolioEligible = Boolean(onPromote && actions?.portfolio.allowed);
  const previewCurrent = portfolioPreview?.report === report && portfolioPreview?.workspace === portfolioWorkspace && portfolioPreview?.role === portfolioRole && portfolioPreview?.busy === portfolioBusy;
  const portfolioAction = !portfolioEligible ? actions?.portfolio : !portfolioWorkspace ? { allowed:false, pending:true, reason:'The shared portfolio is still connecting.', next:'Wait for the portfolio workspace to load before continuing.' } : previewCurrent ? portfolioPreview.result : { allowed:false, pending:true, reason:'Checking this evidence against the shared portfolio and your current role.', next:'Wait for the import preview before continuing.' };
  useEffect(() => {
    if (!portfolioEligible || !portfolioWorkspace) return;
    let cancelled = false;
    const context = { report, workspace:portfolioWorkspace, role:portfolioRole, busy:portfolioBusy };
    previewEvidencePortfolio(portfolioWorkspace, report, { actorRole:portfolioRole, busy:portfolioBusy }).then(result => {
      if (!cancelled) setPortfolioPreview({ ...context, result });
    }).catch(error => {
      if (!cancelled) setPortfolioPreview({ ...context, result:{ allowed:false, reason:error.message || 'The portfolio import could not be checked.', next:'Resolve the evidence or record conflict before importing. Your open evidence is unchanged.' } });
    });
    return () => { cancelled = true; };
  }, [report, portfolioWorkspace, portfolioRole, portfolioBusy, portfolioEligible]);
  const tabs = [['promiseText','Promise',Mail],['invoiceCsv','Invoices',FileText],['replyText','Reply',Link2]];

  function rememberReview(){if(record)reviewEdits.current.set(`${record.id}:${record.audit.at(-1)?.hash}`,{form,draft,detailTab,inputTab});}

  function update(key, value) {
    rememberReview();
    if(record)previousReview.current={record,form,draft,detailTab,inputTab};
    operation.current++; setLoading(false);
    setForm(current => ({ ...current, [key]: value }));
    setRecord(null); setCitation(null); setError('');
  }

  async function loadExample(id = exampleId) {
    rememberReview();
    const ticket = ++operation.current;
    setLoading(true); setError('');
    try {
      const paths = ['/examples/pipeline-promise.txt','/examples/pipeline-invoices.csv'];
      if (id === 'conditional') paths.push('/examples/pipeline-reply.txt');
      const contents = await Promise.all(paths.map(async path => { const r = await fetch(import.meta.env.BASE_URL + path.replace(/^\//,'')); if (!r.ok) throw new Error('Example files could not be loaded. Try importing your documents.'); return r.text(); }));
      if (ticket !== operation.current) return;
      let invoiceCsv = contents[1];
      if (id === 'unmatched') invoiceCsv = invoiceCsv.replaceAll('PC-SEATS-2026', 'UNRELATED-CREDIT');
      if(record)previousReview.current={record,form,draft,detailTab,inputTab};
      setForm({ ...initial, promiseText: contents[0], invoiceCsv, replyText: contents[2] || '' });
      setRecord(null); setDraft(''); setInputTab('promiseText'); setCitation(null);
    } catch (e) { if(ticket === operation.current) setError(e.message); } finally { if(ticket === operation.current) setLoading(false); }
  }

  function persist(next) {
    try { setCases(saveCase(localStorage, cases, next)); setStorageError(''); }
    catch { setStorageError('Browser storage is unavailable or full. Your open case is intact; export it before leaving.'); }
  }

  async function analyze(event) {
    event?.preventDefault(); const ticket = ++operation.current; setLoading(true); setError(''); setCitation(null);
    try {
      const result = analyzeEvidence(form);
      const next = await createCase(result);
      if(ticket !== operation.current) return;
      setRecord(next); setDraft(result.draft || ''); setDetailTab('overview');
      intakeDraft.current=null;
      previousReview.current=null;
      persist(next);
    } catch (e) { if(ticket === operation.current) setError(e.message || 'Analysis failed. Check your documents and try again.'); }
    finally { if(ticket === operation.current) setLoading(false); }
  }

  async function addPortfolio(){if(!portfolioAction?.allowed || loading)return;setLoading(true);setError('');try{await onPromote(report);}catch(e){setError(e.message);}finally{setLoading(false);}}

  async function approve() {
    if(!canApprove || loading)return;
    const ticket = ++operation.current;
    setLoading(true); setError('');
    try { const next = await approveCase(record, draft); if(ticket !== operation.current) return; setRecord(next); persist(next); requestAnimationFrame(()=>document.querySelector('.approved-message-actions')?.scrollIntoView({block:'start'})); }
    catch (e) { if(ticket === operation.current) setError(e.message); } finally { if(ticket === operation.current) setLoading(false); }
  }

  async function openSaved(saved) {
    rememberReview();
    if(!record&&(form.promiseText||form.invoiceCsv||form.replyText||form.vendor!==initial.vendor||form.asOf!==initial.asOf))intakeDraft.current={form,inputTab};
    const ticket = ++operation.current; setLoading(false);
    const valid = await verifyCase(saved);
    if(ticket !== operation.current) return;
    if (!valid) { setError('This saved record failed its integrity check. Analyze the original documents again.'); return; }
    previousReview.current=null;
    const retained=reviewEdits.current.get(`${saved.id}:${saved.audit.at(-1)?.hash}`);
    setRecord(saved); setForm(retained?.form||{ vendor:saved.report.vendor, asOf:saved.report.asOf, ...saved.report.documents });
    setDraft(retained?.draft??(saved.audit.find(e => e.type === 'CLAIM_APPROVED')?.payload.draft || saved.report.draft || ''));
    if(retained){setDetailTab(retained.detailTab);setInputTab(retained.inputTab);}
    setHistoryOpen(false); setCitation(null); setError('');
  }

  async function importFile(event) {
    const file = event.target.files?.[0]; if (!file) return;
    const ticket = ++operation.current, targetTab = inputTab; setLoading(false);
    try {
      if (file.size > 250000) throw new Error('Use a text or CSV file smaller than 250 KB.');
      const extension = file.name.split('.').at(-1)?.toLowerCase();
      if (!['txt','csv','eml'].includes(extension)) throw new Error('Use a .txt, .eml or .csv file. Export PDF text before importing.');
      const text = await file.text(); if(ticket !== operation.current) return;
      update(targetTab, text);
      notify(`${file.name} imported. Analyze to update the finding.`);
    } catch (e) { setError(e.message); } finally { event.target.value = ''; }
  }

  function inspectCitation(event, cite) {
    if (citation?.id === cite.id) { setCitation(null); return; }
    citationOrigin.current = event.currentTarget;
    setCitation(cite);
    const field = {promise:'promiseText',invoice:'invoiceCsv',reply:'replyText'}[cite.source];
    if (!field) return;
    setInputTab(field);
    requestAnimationFrame(() => {
      const input = sourceInput.current;
      if (!input) return;
      input.focus({preventScroll:true});
      input.setSelectionRange(cite.start,cite.end);
      const line = input.value.slice(0,cite.start).split('\n').length-1;
      input.scrollTop = Math.max(0,line*23-75);
    });
  }

  function closeCitation() {
    setCitation(null);
    requestAnimationFrame(() => citationOrigin.current?.isConnected && citationOrigin.current.focus({preventScroll:true}));
  }

  function clearCases() {
    operation.current++; setLoading(false);
    try { localStorage.removeItem(STORAGE_KEY); setCases([]); setError(''); setStorageError(''); notify('Saved cases cleared from this browser.'); }
    catch { setError('Browser storage is blocked. Allow local storage to clear saved cases.'); }
  }

  function beginIntake(){
    rememberReview();
    if(record){previousReview.current={record,form,draft,detailTab,inputTab};const retained=intakeDraft.current;setForm(retained?.form||{...initial,vendor:'',asOf:new Date().toISOString().slice(0,10)});setInputTab(retained?.inputTab||'promiseText');setRecord(null);setDraft('');}
    else if(!form.promiseText&&!form.invoiceCsv&&!form.replyText&&form.vendor===initial.vendor&&form.asOf===initial.asOf)setForm({...initial,vendor:'',asOf:new Date().toISOString().slice(0,10)});
    setHistoryOpen(false);setCitation(null);setError('');
    requestAnimationFrame(()=>{const vendor=document.getElementById('vendor');if(vendor&&!vendor.value.trim())vendor.focus();else sourceInput.current?.focus();document.querySelector('.evidence-input-panel')?.scrollIntoView({block:'start'});});
  }
  function returnToReview(){
    if(!previousReview.current)return;
    intakeDraft.current={form,inputTab};const saved=previousReview.current;setRecord(saved.record);setForm(saved.form);setDraft(saved.draft);setDetailTab(saved.detailTab);setInputTab(saved.inputTab);setCitation(null);setError('');
    requestAnimationFrame(()=>document.querySelector('.finding-header h2')?.scrollIntoView({block:'start'}));
  }
  useEffect(()=>{if(intakeIntent&&intakeIntent!==handledIntake.current&&!loading){handledIntake.current=intakeIntent;beginIntake();}},[intakeIntent,loading]);

  return <main className="lab-main">
    <div className="lab-heading"><div><h1>Document review</h1><p>Check a vendor’s promise against your invoice credits.</p></div></div>
    <div className="lab-toolbar"><div className="engine-status"><ShieldCheck size={15}/><span>Local demo · saved in this browser</span></div>{!record&&previousReview.current&&<button className="text-button intake-return" onClick={returnToReview}>Return to {previousReview.current.record.report.vendor} review</button>}<button className="text-button" onClick={() => setHistoryOpen(!historyOpen)} aria-expanded={historyOpen}><FolderOpen size={15}/>Saved reviews <span className="count-label">{cases.length}</span><ChevronDown size={14}/></button></div>
    {historyOpen && <section className="saved-cases" aria-label="Saved document reviews"><div className="section-heading"><h2>Saved in this browser</h2><button className="text-button" onClick={clearCases}><Trash2 size={14}/>Clear saved reviews</button></div>{cases.length ? cases.map(c => <button key={c.id} className="saved-case" onClick={() => openSaved(c)}><span><strong>{c.report.vendor}</strong><small>{new Date(c.createdAt).toLocaleString()} · {stateLabels[c.report.status]}</small></span><strong>{c.report.status !== 'unsupported' && c.report.outstandingCents != null ? money(c.report.outstandingCents) : '—'}</strong><ChevronRight size={16}/></button>) : <p>No saved cases. Analyze a document set to create one.</p>}</section>}
    {(error || storageError) && <div className="lab-error" role="alert"><AlertTriangle size={17}/><p>{error || storageError}</p><button className="icon-button" aria-label="Dismiss error" onClick={() => {setError('');setStorageError('');}}><X size={16}/></button></div>}
    <div className="lab-layout">
      {report&&<button className="review-return-mobile text-button" onClick={revealReview}>View {report.vendor} credit check<ArrowRight size={15}/></button>}
      <section className="evidence-input-panel" aria-label="Evidence input">
        <div className="lab-panel-heading"><h2>Source documents</h2><span>Text + CSV</span></div>
        <details className="example-picker"><summary>Try example documents<ChevronDown size={14}/></summary><label className="sr-only" htmlFor="example-select">Example documents</label><div><select id="example-select" value={exampleId} onChange={e => setExampleId(e.target.value)}>{examples.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}</select><button className="button secondary" onClick={() => loadExample()} disabled={loading}>Load example<ArrowDownToLine size={14}/></button></div><p>{examples.find(e => e.id === exampleId).description}</p></details>
        <form onSubmit={analyze}>
          <div className="input-metadata"><label htmlFor="vendor">Vendor<input id="vendor" value={form.vendor} onChange={e => update('vendor',e.target.value)} maxLength={120} required/></label><label htmlFor="as-of">Review date<input type="date" id="as-of" value={form.asOf} onChange={e => update('asOf',e.target.value)} required/></label></div>
          <div className="document-tabs" role="tablist" aria-label="Input documents">{tabs.map(([key,label,Icon]) => <button type="button" key={key} role="tab" id={`input-${key}`} aria-controls="input-panel" tabIndex={inputTab === key ? 0 : -1} onKeyDown={e => switchTab(e,tabs.map(t => t[0]),inputTab,setInputTab,'input')} aria-selected={inputTab === key} onClick={() => setInputTab(key)}><SourceFileArt type={key} filled={Boolean(form[key]?.trim())}/><strong>{label}</strong>{form[key] && <><span className="input-present" aria-hidden="true"/><span className="sr-only">Document loaded</span></>}</button>)}</div>
          <div className="input-document" id="input-panel" role="tabpanel" aria-labelledby={`input-${inputTab}`}><div className="input-document-label"><label htmlFor="document-text">{inputTab === 'promiseText' ? 'Original vendor promise' : inputTab === 'invoiceCsv' ? 'Invoice credit rows' : 'Later reply (optional)'}</label><button type="button" className="text-button" onClick={() => fileInput.current?.click()}><Upload size={13}/>Import</button></div><textarea ref={sourceInput} id="document-text" value={form[inputTab]} onChange={e => update(inputTab,e.target.value)} placeholder={inputTab === 'promiseText' ? 'Paste the promise, including the credit amount, due date and commitment reference…' : inputTab === 'invoiceCsv' ? 'invoice_id,vendor,date,description,amount,currency,commitment_ref' : 'Paste a vendor reply to check for new conditions…'} spellCheck={false} maxLength={250000}/><input ref={fileInput} type="file" hidden accept=".txt,.csv,.eml" onChange={importFile}/></div>
          <details className="format-help"><summary>Supported document format<ChevronDown size={13}/></summary><p>Use an explicit USD credit, invoice month or date, and <b>Reference: YOUR-REF</b> in the promise. CSV credits are positive amounts with the seven columns shown in the invoice tab. Only exact vendor, currency and reference matches count.</p><a href={`${import.meta.env.BASE_URL}examples/pipeline-invoices.csv`} download>Download example CSV<ArrowDownToLine size={13}/></a><p>Rules-based extraction; unfamiliar terms are held for review. Examples are fictional.</p></details>
          <button className="button primary analyze-button" type="submit" disabled={loading || !form.promiseText.trim() || !form.invoiceCsv.trim() || !form.vendor.trim()}>{loading ? <span className="lab-spinner"/> : <Search size={17}/>} {loading ? 'Checking credits…' : 'Check credits'}<ArrowRight size={16}/></button>
        </form>
      </section>
      <section className={`finding-panel ${report ? 'has-report' : ''}`} aria-label="Analysis results" aria-live="polite" aria-busy={loading}>
        {!report ? <div className="lab-empty"><IntakeFilesArt/><h2>Check the credit.</h2><p>Add the promise and invoice rows.</p><button className="text-button" onClick={() => loadExample('pipeline')} disabled={loading}>Load the partial-credit example<ArrowRight size={15}/></button></div> : <>
          <div className="finding-header"><div><h2 tabIndex={-1}>{report.status === 'unsupported' ? 'Evidence needs review' : report.status === 'conditional' ? 'Credit terms need review' : report.status === 'verified' ? 'Credit fully applied' : report.status === 'scheduled' ? 'Credit not due yet' : 'Outstanding credit'}</h2><span className="finding-vendor">{report.vendor}</span></div><span className={`finding-status ${report.status}`}><span/>{stateLabels[report.status] || report.status}</span></div>
          <EvidenceCreditArt report={report}/>
          {(report.condition || report.replyCondition) && <div className="terms-alert"><ShieldCheck size={19}/><div><strong>{report.replyCondition ? 'The reply adds a condition.' : 'This promise has a condition.'}</strong><p>{report.replyCondition || report.condition}</p><small>Renewal not accepted. No additional savings counted.</small></div></div>}
          <div className="finding-tabs" role="tablist" aria-label="Result details">{[['overview','Overview'],['findings','Matches'],['claim','Follow-up'],['audit','History']].map(([key,label]) => <button key={key} role="tab" id={`result-${key}`} aria-controls="result-panel" tabIndex={detailTab === key ? 0 : -1} onKeyDown={e => switchTab(e,['overview','findings','claim','audit'],detailTab,setDetailTab,'result')} aria-selected={detailTab === key} onClick={() => setDetailTab(key)}>{label}{key === 'audit' && <span>{record.audit.length}</span>}</button>)}</div>
          <div className="finding-content" id="result-panel" role="tabpanel" aria-labelledby={`result-${detailTab}`}>
            {detailTab === 'overview' && <div className="intake-next-paths"><section className="intake-message-path"><SourceFileArt type="promiseText" filled/><div><h3>{approved?'Approved message':'Prepare a message'}</h3><p>{approved?'Your exact approved draft is retained.':'Write under the original terms, then approve the exact draft.'}</p><button className="button secondary claim-review-button" onClick={()=>{setDetailTab('claim');requestAnimationFrame(()=>document.getElementById('result-claim')?.focus());}}>{approved?'View approved message':'Review follow-up'}</button></div></section>{onPromote && <div className="portfolio-handoff"><SourceFileArt type="invoiceCsv" filled/><div id="portfolio-availability"><strong>{portfolioAction.pending ? 'Checking import' : portfolioAction.allowed ? (portfolioAction.plan?.alreadyTracked?'Already tracked in Cases':'Track the credit in Cases') : 'Import unavailable'}</strong><p>{portfolioAction.allowed?'Add the promise and matched invoice credits.':portfolioAction.reason}</p><details><summary>Import details</summary><p>{portfolioAction.reason}</p><p>{portfolioAction.next}</p></details></div><button className="button primary" onClick={addPortfolio} disabled={!portfolioAction.allowed || loading} aria-describedby="portfolio-availability">Save to workspace<ArrowRight size={14}/></button></div>}</div>}
            {detailTab === 'findings' && <>{report.replyReviewRequired && <div className="terms-alert"><AlertTriangle size={18}/><p>The reply is outside the supported rules. Review its terms before preparing a claim.</p></div>}<div className="reasoning-list">{(report.reasoning || []).map((step,i) => <div className="reasoning-row" key={i}><span className={`reasoning-check ${supported ? "" : "needs-review"}`}>{supported ? <Check size={13}/> : <AlertTriangle size={13}/>}</span><div><strong>{step.label==='Authority boundary'?'Approval and new terms':step.label}</strong><p>{step.detail}</p><div className="citation-links">{(step.citationIds || []).map(id => { const cite = report.citations.find(c => c.id === id); return cite && <button key={id} onClick={event => inspectCitation(event,cite)}><FileText size={11}/>{cite.label || cite.source}<ArrowRight size={11}/></button>; })}</div></div></div>)}</div>{(report.errors || []).map((warning,i) => <p className="finding-warning" key={`e${i}`}><AlertTriangle size={14}/>{typeof warning === 'string' ? warning : warning.message}</p>)}{(report.warnings || []).map((warning,i) => <p className="finding-warning" key={i}><AlertTriangle size={14}/>{typeof warning === 'string' ? warning : warning.message}</p>)}{citation && <div className="citation-detail"><div><strong>{citation.label || citation.source}</strong><button className="icon-button" aria-label="Close citation" onClick={closeCitation}><X size={14}/></button></div><blockquote>{citation.quote}</blockquote><small>Selected in the original document. Characters {citation.start}–{citation.end}.</small></div>}{report.invoiceMatches?.length > 0 && <details className="matched-invoices"><summary>{report.invoiceMatches.length} matched invoice {report.invoiceMatches.length === 1 ? 'credit' : 'credits'}<ChevronDown size={14}/></summary>{report.invoiceMatches.map((row,i) => <div key={i}><span><strong>{row.invoiceId}</strong><small>{row.description}</small></span><strong>{money(row.amountCents)}</strong></div>)}</details>}</>}
            {detailTab === 'claim' && <div className="live-claim">{approved&&<div className="claim-actions approved-message-actions"><span><CheckCheck size={16}/>Approval recorded</span><button className="button primary" onClick={()=>download(emailFor(record),'truthful-claim.eml','message/rfc822')}><Mail size={15}/>Download unsent draft</button></div>}{!approved&&<p>Review the exact message before approving it.</p>}{portfolioAction?.plan?.alreadyTracked&&<button className="text-button intake-tracked-case" disabled={loading} onClick={addPortfolio}>Open tracked case</button>}<label className="sr-only" htmlFor="live-draft">Follow-up draft</label><textarea id="live-draft" value={draft} disabled={!supported || !report.requiresApproval || approved || loading} onChange={e => setDraft(e.target.value)} placeholder="A supported, unconditional outstanding promise is needed for a draft."/><div className={`evidence-next-step${approved?' approved-claim-details':''}`} id="claim-availability"><strong>{approved ? 'Claim approval recorded' : canApprove ? 'Ready for your review' : 'Follow-up needs review'}</strong><p>{actions.approval.reason}</p><details><summary>What to do next</summary><p>{actions.approval.next}</p></details></div>{!approved&&<div className="claim-actions"><small>No email is sent.</small><button className="button primary" onClick={approve} disabled={!canApprove || loading} aria-describedby="claim-availability"><ShieldCheck size={15}/>Approve this version</button></div>}</div>}
            {detailTab === 'audit' && <div className="live-audit">{record.audit.map(event => <div key={event.hash}><span className="audit-node"><Check size={13}/></span><div><strong>{event.type === 'EVIDENCE_ANALYZED' ? 'Evidence analyzed' : 'Original claim approved'}</strong><p>{new Date(event.at).toLocaleString()}{event.payload.actor ? ` · ${event.payload.actor}` : ''}</p><code title={event.hash}>{event.hash.slice(0,20)}…</code></div></div>)}<p className="audit-note">Hash-linked local record. Export includes the original documents and exact approved draft. It detects changes relative to this chain; it does not authenticate the source or reviewer.</p></div>}
          </div>
          <div className="finding-footer"><span><ShieldCheck size={14}/>{approved ? 'Exact-draft approval preserved' : 'Downloads include review status'}</span><div><button className="button secondary" onClick={() => download(summaryCsv(record),'truthful-recovery.csv','text/csv;charset=utf-8')}>CSV<ArrowDownToLine size={14}/></button><button className="button secondary" onClick={() => download(JSON.stringify(packetFor(record),null,2),'truthful-evidence-packet.json')}><ArrowDownToLine size={15}/>Review record</button></div></div>
        </>}
      </section>
    </div>
    <div className="lab-footnote"><span><FlaskConical size={14}/>Local demo · text and CSV inputs · no connected inbox or payments.</span><button className="text-button" onClick={onWalkthrough}>View example story<ArrowRight size={13}/></button></div>
  </main>;
}
