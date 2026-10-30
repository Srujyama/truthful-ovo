import React, { useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowRight, Check, CheckCheck, ChevronDown, ChevronRight, Clock3, FileCheck2, FileText, FlaskConical, FolderOpen, Link2, Mail, Play, Search, ShieldCheck, Trash2, Upload, X, AlertTriangle } from 'lucide-react';
import { analyzeEvidence } from './engine/index.mjs';
import { createCase, approveCase, verifyCase, readCases, saveCase, packetFor, summaryCsv, emailFor, STORAGE_KEY } from './recovery.mjs';
import './workbench.css';

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

export default function Workbench({ notify, onWalkthrough, onPromote }) {
  const [form, setForm] = useState(initial);
  const [record, setRecord] = useState(null);
  const [draft, setDraft] = useState('');
  const [cases, setCases] = useState(() => { try { return readCases(localStorage); } catch { return []; } });
  const [error, setError] = useState(() => { try { readCases(localStorage); return ''; } catch { return 'Saved cases could not be read. Clear saved cases to start again.'; } });
  const [loading, setLoading] = useState(false);
  const [inputTab, setInputTab] = useState('promiseText');
  const [detailTab, setDetailTab] = useState('findings');
  const [citation, setCitation] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [exampleId, setExampleId] = useState('pipeline');
  const [storageError, setStorageError] = useState('');
  const fileInput = useRef(null), operation = useRef(0);
  useEffect(() => () => { operation.current++; }, []);
  const report = record?.report;
  const approved = record?.audit.some(event => event.type === 'CLAIM_APPROVED');
  const supported = report && report.status !== 'unsupported';
  const canApprove = supported && report.requiresApproval && !report.replyReviewRequired && !report.condition && report.outstandingCents > 0 && Boolean(draft.trim()) && !approved;
  const tabs = [['promiseText','Promise',Mail],['invoiceCsv','Invoice credits',FileText],['replyText','Vendor reply',Link2]];

  function update(key, value) {
    operation.current++; setLoading(false);
    setForm(current => ({ ...current, [key]: value }));
    setRecord(null); setCitation(null); setError('');
  }

  async function loadExample(id = exampleId) {
    const ticket = ++operation.current;
    setLoading(true); setError('');
    try {
      const paths = ['/examples/pipeline-promise.txt','/examples/pipeline-invoices.csv'];
      if (id === 'conditional') paths.push('/examples/pipeline-reply.txt');
      const contents = await Promise.all(paths.map(async path => { const r = await fetch(import.meta.env.BASE_URL + path.replace(/^\//,'')); if (!r.ok) throw new Error('Example files could not be loaded. Try importing your documents.'); return r.text(); }));
      if (ticket !== operation.current) return;
      let invoiceCsv = contents[1];
      if (id === 'unmatched') invoiceCsv = invoiceCsv.replaceAll('PC-SEATS-2026', 'UNRELATED-CREDIT');
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
      setRecord(next); setDraft(result.draft || ''); setDetailTab('findings');
      persist(next);
      notify(result.status === 'unsupported' ? 'Some evidence needs review. No recovery claim was created.' : 'Evidence reconciled. Review the sources before approval.');
    } catch (e) { if(ticket === operation.current) setError(e.message || 'Analysis failed. Check your documents and try again.'); }
    finally { if(ticket === operation.current) setLoading(false); }
  }

  async function addPortfolio(){setLoading(true);setError('');try{await onPromote(report);}catch(e){setError(e.message);}finally{setLoading(false);}}

  async function approve() {
    const ticket = ++operation.current;
    setLoading(true); setError('');
    try { const next = await approveCase(record, draft); if(ticket !== operation.current) return; setRecord(next); persist(next); notify('Original claim approved locally. No message sent.'); }
    catch (e) { if(ticket === operation.current) setError(e.message); } finally { if(ticket === operation.current) setLoading(false); }
  }

  async function openSaved(saved) {
    const ticket = ++operation.current; setLoading(false);
    const valid = await verifyCase(saved);
    if(ticket !== operation.current) return;
    if (!valid) { setError('This saved record failed its integrity check. Analyze the original documents again.'); return; }
    setRecord(saved); setForm({ vendor:saved.report.vendor, asOf:saved.report.asOf, ...saved.report.documents });
    setDraft(saved.audit.find(e => e.type === 'CLAIM_APPROVED')?.payload.draft || saved.report.draft || '');
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

  function clearCases() {
    operation.current++; setLoading(false);
    try { localStorage.removeItem(STORAGE_KEY); setCases([]); setError(''); setStorageError(''); notify('Saved cases cleared from this browser.'); }
    catch { setError('Browser storage is blocked. Allow local storage to clear saved cases.'); }
  }

  return <main className="lab-main">
    <div className="lab-heading"><div><h1>Evidence lab</h1><p>Reconcile a vendor promise against applied invoice credits.</p></div><button className="button secondary" onClick={onWalkthrough}><Play size={15}/>Guided demo</button></div>
    <div className="lab-toolbar"><div className="engine-status"><ShieldCheck size={15}/><span>Evidence stays on this device</span></div><button className="text-button" onClick={() => setHistoryOpen(!historyOpen)} aria-expanded={historyOpen}><FolderOpen size={15}/>Saved cases <span className="count-label">{cases.length}</span><ChevronDown size={14}/></button></div>
    {historyOpen && <section className="saved-cases" aria-label="Saved evidence cases"><div className="section-heading"><h2>Saved in this browser</h2><button className="text-button" onClick={clearCases}><Trash2 size={14}/>Clear saved cases</button></div>{cases.length ? cases.map(c => <button key={c.id} className="saved-case" onClick={() => openSaved(c)}><span><strong>{c.report.vendor}</strong><small>{new Date(c.createdAt).toLocaleString()} · {stateLabels[c.report.status]}</small></span><strong>{c.report.status !== 'unsupported' && c.report.outstandingCents != null ? money(c.report.outstandingCents) : '—'}</strong><ChevronRight size={16}/></button>) : <p>No saved cases. Analyze a document set to create one.</p>}</section>}
    {(error || storageError) && <div className="lab-error" role="alert"><AlertTriangle size={17}/><p>{error || storageError}</p><button className="icon-button" aria-label="Dismiss error" onClick={() => {setError('');setStorageError('');}}><X size={16}/></button></div>}
    <div className="lab-layout">
      <section className="evidence-input-panel" aria-label="Evidence input">
        <div className="lab-panel-heading"><h2>Source documents</h2><span>Text + CSV</span></div>
        <div className="example-picker"><label htmlFor="example-select">Try an example</label><div><select id="example-select" value={exampleId} onChange={e => setExampleId(e.target.value)}>{examples.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}</select><button className="button secondary" onClick={() => loadExample()} disabled={loading}>Load example<ArrowDownToLine size={14}/></button></div><p>{examples.find(e => e.id === exampleId).description}</p></div>
        <form onSubmit={analyze}>
          <div className="input-metadata"><label htmlFor="vendor">Vendor<input id="vendor" value={form.vendor} onChange={e => update('vendor',e.target.value)} maxLength={120} required/></label><label htmlFor="as-of">Reconcile as of<input type="date" id="as-of" value={form.asOf} onChange={e => update('asOf',e.target.value)} required/></label></div>
          <div className="document-tabs" role="tablist" aria-label="Input documents">{tabs.map(([key,label,Icon]) => <button type="button" key={key} role="tab" id={`input-${key}`} aria-controls="input-panel" tabIndex={inputTab === key ? 0 : -1} onKeyDown={e => switchTab(e,tabs.map(t => t[0]),inputTab,setInputTab,'input')} aria-selected={inputTab === key} onClick={() => setInputTab(key)}><Icon size={14}/>{label}{form[key] && <><span className="input-present" aria-hidden="true"/><span className="sr-only">Document loaded</span></>}</button>)}</div>
          <div className="input-document" id="input-panel" role="tabpanel" aria-labelledby={`input-${inputTab}`}><div className="input-document-label"><label htmlFor="document-text">{inputTab === 'promiseText' ? 'Original vendor promise' : inputTab === 'invoiceCsv' ? 'Invoice credit rows' : 'Later reply (optional)'}</label><button type="button" className="text-button" onClick={() => fileInput.current?.click()}><Upload size={13}/>Import</button></div><textarea id="document-text" value={form[inputTab]} onChange={e => update(inputTab,e.target.value)} placeholder={inputTab === 'promiseText' ? 'Paste the promise, including the credit amount, due date and commitment reference…' : inputTab === 'invoiceCsv' ? 'invoice_id,vendor,date,description,amount,currency,commitment_ref' : 'Paste a vendor reply to check for new conditions…'} spellCheck={false} maxLength={250000}/><input ref={fileInput} type="file" hidden accept=".txt,.csv,.eml" onChange={importFile}/></div>
          <details className="format-help"><summary>Supported document format<ChevronDown size={13}/></summary><p>Use an explicit USD credit, invoice month or date, and <b>Reference: YOUR-REF</b> in the promise. CSV credits are positive amounts with the seven columns shown in the invoice tab. Only exact vendor, currency and reference matches count.</p><a href={`${import.meta.env.BASE_URL}examples/pipeline-invoices.csv`} download>Download example CSV<ArrowDownToLine size={13}/></a><p>Rules-based extraction; unfamiliar terms are held for review. Examples are fictional.</p></details>
          <button className="button primary analyze-button" type="submit" disabled={loading || !form.promiseText.trim() || !form.invoiceCsv.trim() || !form.vendor.trim()}>{loading ? <span className="lab-spinner"/> : <Search size={17}/>} {loading ? 'Checking evidence…' : 'Analyze evidence'}<ArrowRight size={16}/></button>
        </form>
      </section>
      <section className={`finding-panel ${report ? 'has-report' : ''}`} aria-label="Analysis results" aria-live="polite" aria-busy={loading}>
        {!report ? <div className="lab-empty"><FileCheck2 size={24}/><h2>No analysis yet</h2><p>Load an example or add a promise and invoice credits, then select Analyze evidence.</p><button className="text-button" onClick={() => loadExample('pipeline')} disabled={loading}>Load the partial-credit example<ArrowRight size={15}/></button></div> : <>
          <div className="finding-header"><div><h2>{report.status === 'unsupported' ? 'More evidence needed.' : report.status === 'verified' ? 'The numbers agree.' : report.status === 'scheduled' ? 'Keep this on the radar.' : 'There’s a gap to close.'}</h2><span className="finding-vendor">{report.vendor}</span></div><span className={`finding-status ${report.status}`}><span/>{stateLabels[report.status] || report.status}</span></div>
          <div className="recovery-amount"><span>{report.status === 'unsupported' ? 'Unverified balance' : report.condition ? 'Conditional amount' : report.status === 'scheduled' ? 'Scheduled balance' : 'Still outstanding'}</span><strong>{supported ? money(report.outstandingCents) : '—'}</strong><small>{supported && report.dueDate ? `Due ${new Date(report.dueDate + 'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}` : 'No verified due date'}{supported && report.commitmentRef ? ` · ${report.commitmentRef}` : ''}</small></div>
          <div className="recovery-ledger"><div><span>Promised</span><strong>{supported ? money(report.promisedCents) : '—'}</strong></div><div><span>Verified applied</span><strong className="green">{supported ? money(report.verifiedCents) : '—'}</strong></div><div><span>Still open</span><strong>{supported ? money(report.outstandingCents) : '—'}</strong></div></div>
          {(report.condition || report.replyCondition) && <div className="terms-alert"><ShieldCheck size={19}/><div><strong>{report.replyCondition ? 'The reply adds a condition.' : 'This promise has a condition.'}</strong><p>{report.replyCondition || report.condition}</p><small>Renewal not accepted. No additional savings counted.</small></div></div>}
          <div className="finding-tabs" role="tablist" aria-label="Result details">{[['findings','Evidence'],['claim','Claim draft'],['audit','Audit trail']].map(([key,label]) => <button key={key} role="tab" id={`result-${key}`} aria-controls="result-panel" tabIndex={detailTab === key ? 0 : -1} onKeyDown={e => switchTab(e,['findings','claim','audit'],detailTab,setDetailTab,'result')} aria-selected={detailTab === key} onClick={() => setDetailTab(key)}>{label}{key === 'audit' && <span>{record.audit.length}</span>}</button>)}</div>
          <div className="finding-content" id="result-panel" role="tabpanel" aria-labelledby={`result-${detailTab}`}>
            {detailTab === 'findings' && <>{report.replyReviewRequired && <div className="terms-alert"><AlertTriangle size={18}/><p>The reply is outside the supported rules. Review its terms before preparing a claim.</p></div>}<div className="reasoning-list">{(report.reasoning || []).map((step,i) => <div className="reasoning-row" key={i}><span className={`reasoning-check ${supported ? "" : "needs-review"}`}>{supported ? <Check size={13}/> : <AlertTriangle size={13}/>}</span><div><strong>{step.label}</strong><p>{step.detail}</p><div className="citation-links">{(step.citationIds || []).map(id => { const cite = report.citations.find(c => c.id === id); return cite && <button key={id} onClick={() => setCitation(citation?.id === id ? null : cite)}><FileText size={11}/>{cite.label || cite.source}<ArrowRight size={11}/></button>; })}</div></div></div>)}</div>{(report.errors || []).map((warning,i) => <p className="finding-warning" key={`e${i}`}><AlertTriangle size={14}/>{typeof warning === 'string' ? warning : warning.message}</p>)}{(report.warnings || []).map((warning,i) => <p className="finding-warning" key={i}><AlertTriangle size={14}/>{typeof warning === 'string' ? warning : warning.message}</p>)}{citation && <div className="citation-detail"><div><strong>{citation.label || citation.source}</strong><button className="icon-button" aria-label="Close citation" onClick={() => setCitation(null)}><X size={14}/></button></div><blockquote>{citation.quote}</blockquote><small>Exact passage from the imported {citation.source}. Characters {citation.start}–{citation.end}.</small></div>}{report.invoiceMatches?.length > 0 && <details className="matched-invoices"><summary>{report.invoiceMatches.length} matched invoice {report.invoiceMatches.length === 1 ? 'credit' : 'credits'}<ChevronDown size={14}/></summary>{report.invoiceMatches.map((row,i) => <div key={i}><span><strong>{row.invoiceId}</strong><small>{row.description}</small></span><strong>{money(row.amountCents)}</strong></div>)}</details>}</>}
            {detailTab === 'claim' && <div className="live-claim"><p>Follow up under the original terms. Review the draft before recording approval.</p><label className="sr-only" htmlFor="live-draft">Follow-up draft</label><textarea id="live-draft" value={draft} disabled={!supported || approved || loading} onChange={e => setDraft(e.target.value)} placeholder="A supported, unconditional outstanding promise is needed for a draft."/><div className="claim-actions">{approved ? <><span><CheckCheck size={16}/>Approval recorded</span><button className="button secondary" onClick={() => download(emailFor(record),'truthful-claim.eml','message/rfc822')}><Mail size={15}/>Download draft</button></> : <><small>No email is sent.</small><button className="button primary" onClick={approve} disabled={!canApprove || loading}><ShieldCheck size={15}/>Approve claim</button></>}</div></div>}
            {detailTab === 'audit' && <div className="live-audit">{record.audit.map(event => <div key={event.hash}><span className="audit-node"><Check size={13}/></span><div><strong>{event.type === 'EVIDENCE_ANALYZED' ? 'Evidence analyzed' : 'Original claim approved'}</strong><p>{new Date(event.at).toLocaleString()}{event.payload.actor ? ` · ${event.payload.actor}` : ''}</p><code title={event.hash}>{event.hash.slice(0,20)}…</code></div></div>)}<p className="audit-note">Hash-linked local record. Export includes the original documents and exact approved draft. It detects changes relative to this chain; it does not authenticate the source or reviewer.</p></div>}
          </div>
          <div className="finding-footer">{onPromote&&supported&&!report.condition&&!report.replyCondition&&!report.replyReviewRequired&&<button className="button secondary" onClick={addPortfolio} disabled={loading}>Add to portfolio<ArrowRight size={14}/></button>}<span><ShieldCheck size={14}/>{approved ? 'Approval preserved' : 'Review before approval'}</span><div><button className="button secondary" onClick={() => download(summaryCsv(record),'truthful-recovery.csv','text/csv;charset=utf-8')}>CSV<ArrowDownToLine size={14}/></button><button className="button primary" onClick={() => download(JSON.stringify(packetFor(record),null,2),'truthful-evidence-packet.json')}><ArrowDownToLine size={15}/>Export evidence</button></div></div>
        </>}
      </section>
    </div>
    <div className="lab-footnote"><span><FlaskConical size={14}/>Rules-based extraction. Real calculations. No connected inbox or payments.</span><button className="text-button" onClick={onWalkthrough}>See the SLA story<ArrowRight size={13}/></button></div>
  </main>;
}
