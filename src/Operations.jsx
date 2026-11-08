import React, { useMemo, useRef, useState } from 'react';
import { Activity, ArrowDownToLine, ArrowRight, Building2, CheckCheck, ChevronLeft, ChevronRight, Clock3, FileText, History, Layers3, RefreshCw, Search, ShieldCheck, AlertTriangle } from 'lucide-react';
import { evaluateWorkspace, isDate } from './assurance/index.mjs';
import { eventLabel, financialReport, operationQueue, reportCsv, sourceKey, sourceLibrary, sourceUsages, vendorSummaries, workspaceActivity } from './operations.mjs';
import './operations.css';

const today = () => new Date().toISOString().slice(0, 10);
const endOf = date => `${date}T23:59:59.999Z`;
const money = cents => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
const statusLabels = { open: 'Open', partial: 'Partly applied', verified: 'Applied', issued: 'Issued, not applied', scheduled: 'Not due yet', conditional: 'Conditional', deadline_expired: 'Deadline passed', stale: 'Out of date', blocked: 'Blocked', approved: 'Approved', proposed: 'Needs approval', executed: 'Recorded' };
const categoryLabels = { urgent: 'Time sensitive', review: 'Finance review', evidence: 'Evidence needed', claim: 'Follow-up ready', scheduled: 'Scheduled' };
const definitions = {
  operations: ['Operations queue', 'Prioritize the next step across your recorded commitments.'],
  vendors: ['Vendor directory', 'Inspect each vendor’s commitments, credits and supporting evidence.'],
  library: ['Evidence library', 'Inspect the exact text and revision behind a recorded financial fact.'],
  audit: ['Workspace activity', 'Follow every recorded transition, its actor and its effective date.'],
  reports: ['Financial reports', 'Separate what applied financially from what was known at the time.'],
};

function download(contents, filename, type = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Empty({ title, children, onClear }) {
  return <div className="ops-empty"><FileText size={25}/><h2>{title}</h2><p>{children}</p>{onClear && <button className="text-button" onClick={onClear}>Clear filters</button>}</div>;
}
function Status({ value }) { return <span className={`ops-status ${value}`}>{statusLabels[value] || value}</span>; }
function SearchField({ value, onChange, label, placeholder }) {
  return <label className="ops-search"><Search size={15}/><input aria-label={label} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder}/></label>;
}
function VendorFilter({ view, value, onChange, label = 'Filter by vendor' }) {
  return <label>Vendor<select aria-label={label} value={value} onChange={event => onChange(event.target.value)}><option value="">All vendors</option>{view.vendors.map(vendor => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}</select></label>;
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

function Queue({ view, onOpen, onVendor, onSection }) {
  const [query, setQuery] = useState(''), [category, setCategory] = useState(''), [vendorId, setVendor] = useState(''), [selectedId, setSelected] = useState('');
  const all = operationQueue(view), items = operationQueue(view, { query, category, vendorId });
  const selected = items.find(item => item.id === selectedId) || items[0];
  const clear = () => { setQuery(''); setCategory(''); setVendor(''); };
  const open = item => item.commitmentId ? onOpen(item.commitmentId, item.destination, item.actionId) : onVendor(item.vendorId,'credits');
  return <>
    <div className="ops-context-line"><span><Layers3 size={15}/>{all.length} recorded work {all.length === 1 ? 'item' : 'items'}</span><button className="text-button" onClick={() => onSection('vendors')}>Vendor directory<ArrowRight size={13}/></button></div>
    <div className="ops-toolbar"><SearchField value={query} onChange={setQuery} label="Search operations" placeholder="Vendor, reference or next step"/><VendorFilter view={view} value={vendorId} onChange={setVendor}/><label>Work type<select aria-label="Filter operations by work type" value={category} onChange={event => setCategory(event.target.value)}><option value="">All work</option>{Object.entries(categoryLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label></div>
    <p className="ops-context-note">One row per commitment, ordered by recorded urgency. Ledger-only exceptions stay separate. Issued and conditional value are not verified applied value.</p>
    {!items.length ? <Empty title={all.length ? 'No matching work' : 'No pending work in this snapshot'} onClear={all.length ? clear : null}>{all.length ? 'Try another vendor or work type.' : 'A clear queue means no supported check currently requires a next step. It does not establish that all external evidence has arrived.'}</Empty> : <div className="ops-split ops-queue">
      <section className="ops-register" aria-label="Prioritized work"><div className="ops-register-title"><h2>Prioritized work</h2><span>{items.length}</span></div><label className="ops-mobile-picker">Selected work item<select aria-label="Selected work item" value={selected.id} onChange={event => setSelected(event.target.value)}>{items.map(item => <option key={item.id} value={item.id}>{item.vendorName} · {item.reference} · {item.title}</option>)}</select></label><div className="ops-desktop-list">{items.map(item => <button key={item.id} className={`ops-record ${item.id === selected.id ? 'selected' : ''}`} onClick={() => setSelected(item.id)} aria-pressed={item.id === selected.id}><span className="ops-record-heading"><strong>{item.vendorName}</strong><span className={`ops-priority ${item.category}`}>{categoryLabels[item.category]}</span></span><span>{item.title}</span><small>{item.reference}</small></button>)}</div></section>
      <article className="ops-detail" aria-label="Selected operations item"><header><div><p>{selected.vendorName} · {selected.reference}</p><h2>{selected.title}</h2></div><span className={`ops-priority ${selected.category}`}>{categoryLabels[selected.category]}</span></header><div className="ops-detail-body"><p className="ops-lead">{selected.reason}</p><dl className="ops-fact-list"><div><dt>{selected.commitmentId ? 'Unfulfilled promise' : 'Unmatched ledger value'}</dt><dd>{money(selected.amountCents)}</dd></div>{selected.commitment && <><div><dt>Verified applied</dt><dd>{money(selected.commitment.verifiedCents)}</dd></div><div><dt>Expected date</dt><dd>{selected.commitment.dueDate}</dd></div></>}</dl><button className="button primary" onClick={() => open(selected)}>{selected.commitmentId ? 'Open this work item' : 'Inspect vendor ledger'}<ArrowRight size={14}/></button>{selected.issues.length > 1 && <section className="ops-related"><h3>Other checks on this commitment</h3>{selected.issues.slice(1).map(issue => <div key={`${issue.category}-${issue.priority}`}><strong>{issue.title}</strong><p>{issue.reason}</p><button className="text-button" onClick={() => onOpen(selected.commitmentId, issue.destination, issue.actionId)}>Inspect this check<ArrowRight size={13}/></button></div>)}</section>}<p className="ops-trust-note">The queue describes recorded state. Opening a case does not approve, execute or contact a vendor.</p></div></article>
    </div>}
  </>;
}

function VendorDirectory({ view, initialVendorId, initialTab, onOpen, onLibrary }) {
  const [query, setQuery] = useState(''), [selectedId, setSelected] = useState(initialVendorId || ''), [tab, setTab] = useState(initialTab || 'commitments');
  const vendors = vendorSummaries(view, { query }), selected = vendors.find(vendor => vendor.id === selectedId) || vendors[0];
  return <>
    <div className="ops-toolbar"><SearchField label="Search vendor directory" value={query} onChange={setQuery} placeholder="Vendor name or commitment reference"/><span className="ops-result-count">{vendors.length} {vendors.length === 1 ? 'vendor' : 'vendors'}</span></div>
    {!vendors.length ? <Empty title={view.vendors.length ? 'No matching vendors' : 'No vendors recorded'} onClear={query ? () => setQuery('') : null}>{view.vendors.length ? 'Search a different name or reference.' : 'Add supported evidence to the portfolio to establish a vendor and its commitment.'}</Empty> : <div className="ops-split">
      <section className="ops-register" aria-label="Recorded vendors"><div className="ops-register-title"><h2>Recorded vendors</h2><Building2 size={16}/></div><label className="ops-mobile-picker">Selected vendor<select aria-label="Selected vendor" value={selected.id} onChange={event => setSelected(event.target.value)}>{vendors.map(vendor => <option key={vendor.id} value={vendor.id}>{vendor.name} · {vendor.commitments.length} commitments</option>)}</select></label><div className="ops-desktop-list">{vendors.map(vendor => <button className={`ops-record ${vendor.id === selected.id ? 'selected' : ''}`} key={vendor.id} onClick={() => setSelected(vendor.id)} aria-pressed={vendor.id === selected.id}><span className="ops-record-heading"><strong>{vendor.name}</strong><ChevronRight size={15}/></span><span>{money(vendor.totals.outstandingCents)} outstanding</span><small>{vendor.commitments.length} commitments · {vendor.credits.length} credit lines</small></button>)}</div></section>
      <article className="ops-detail" aria-label="Selected vendor"><header><div><h2>{selected.name}</h2><p>{selected.id} · Recorded USD commitments</p></div><Building2 size={19}/></header><div className="ops-detail-body"><dl className="ops-vendor-ledger"><div><dt>Unconditional outstanding</dt><dd>{money(selected.totals.outstandingCents)}</dd></div><div><dt>Verified applied</dt><dd>{money(selected.totals.verifiedCents)}</dd></div><div><dt>Issued, not applied</dt><dd>{money(selected.totals.issuedCents)}</dd></div><div><dt>Unattributed ledger value</dt><dd>{money(selected.totals.unallocatedCents)}</dd></div></dl>{selected.totals.conditionalCents > 0 && <p className="ops-warning">{money(selected.totals.conditionalCents)} in conditional offers is excluded from unconditional outstanding and recoverable value.</p>}<div className="ops-local-tabs" role="group" aria-label="Vendor records">{[['commitments', 'Commitments'], ['credits', 'Credit ledger'], ['sources', 'Evidence']].map(([id, name]) => <button key={id} onClick={() => setTab(id)} aria-pressed={tab === id}>{name}<span>{selected[id === 'sources' ? 'sources' : id].length}</span></button>)}</div>
        {tab === 'commitments' && <div className="ops-vendor-records">{selected.commitments.length ? selected.commitments.map(commitment => <div className="ops-vendor-line" key={commitment.id}><div><strong>{commitment.reference}</strong><small>Due {commitment.dueDate} · {money(commitment.promisedCents)} promised</small><Status value={commitment.status}/></div><div><strong>{money(commitment.outstandingCents)}</strong><CaseButton view={view} id={commitment.id} onOpen={onOpen}>Open commitment</CaseButton></div></div>) : <Empty title="No commitments recorded">This vendor may have ledger or evidence records without an active commitment.</Empty>}</div>}
        {tab === 'credits' && <div className="ops-vendor-records">{selected.credits.length ? selected.credits.map(credit => <div className="ops-vendor-credit" key={credit.id}><div className="ops-record-heading"><strong>{credit.invoiceId}</strong><Status value={credit.status}/></div><p>{credit.reference} · Line {credit.lineId}</p><dl className="ops-fact-list"><div><dt>Available after reversals</dt><dd>{money(credit.availableCents)}</dd></div><div><dt>Attributed across commitments</dt><dd>{money(credit.allocatedCents)}</dd></div><div><dt>Unattributed</dt><dd>{money(credit.unallocatedCents)}</dd></div></dl>{credit.quarantined && <p className="ops-warning">{credit.quarantineReason}</p>}<div className="ops-case-links">{[...new Set([...credit.candidateCommitmentIds, ...credit.allocations.map(a => a.commitmentId)])].map(id => <CaseButton key={id} view={view} id={id} destination="ledger" onOpen={onOpen}/>)}</div></div>) : <Empty title="No credit lines recorded">A promise or approved claim does not establish an issued or applied credit.</Empty>}</div>}
        {tab === 'sources' && <div className="ops-vendor-records">{selected.sources.length ? selected.sources.map(source => <button className="ops-source-link" key={source.id} onClick={() => onLibrary(selected.id, sourceKey(source))}><FileText size={17}/><span><strong>{source.title}</strong><small>{source.kind.replaceAll('_', ' ')} · Revision {source.revision}</small></span><ArrowRight size={14}/></button>) : <Empty title="No supporting sources recorded">Sources remain unknown until their text is recorded.</Empty>}</div>}
        <p className="ops-trust-note">Physical credit lines are counted once. Verified applied value is attributed to commitments and capped by their promises; ledger availability is a separate measure.</p>
      </div></article>
    </div>}
  </>;
}

function EvidenceLibrary({ workspace, initialVendorId, initialSourceKey, onOpen }) {
  const [query, setQuery] = useState(''), [vendorId, setVendor] = useState(initialVendorId || ''), [kind, setKind] = useState(''), [versions, setVersions] = useState('current'), [knownBy, setKnownBy] = useState(today), [selectedKey, setSelected] = useState(initialSourceKey || ''), [page, setPage] = useState(0);
  const projected = useMemo(() => {
    try {
      if (!isDate(knownBy) || knownBy > today()) throw new Error('Choose a knowledge date on or before today.');
      return { view: evaluateWorkspace(workspace, { asOf: today(), knownAt: endOf(knownBy) }) };
    } catch (error) { return { error: error.message }; }
  }, [workspace, knownBy]);
  const view = projected.view;
  const items = view ? sourceLibrary(view, { query, vendorId, kind, versions }) : [];
  const safePage = Math.min(page, Math.max(0, Math.ceil(items.length / 24) - 1)), shown = items.slice(safePage * 24, (safePage + 1) * 24);
  const selected = items.find(source => source.key === selectedKey) || shown[0];
  const update = setter => value => { setter(value); setPage(0); };
  const clear = () => { setQuery(''); setVendor(''); setKind(''); setVersions('current'); setPage(0); };
  const revisions = selected ? view.sourceVersions.filter(source => source.id === selected.id).sort((a, b) => a.revision - b.revision) : [];
  const usages = selected ? sourceUsages(view, selected.id, selected.revision) : [];
  function chooseRevision(source) { setVersions('all'); setQuery(''); setKind(''); setSelected(sourceKey(source)); setPage(0); }
  return <>
    <div className="ops-toolbar ops-library-toolbar"><SearchField value={query} onChange={update(setQuery)} label="Search evidence library" placeholder="Title, vendor, reference or source text"/>{view && <VendorFilter view={view} value={vendorId} onChange={update(setVendor)}/>}<label>Source kind<select aria-label="Filter evidence kind" value={kind} onChange={event => update(setKind)(event.target.value)}><option value="">All kinds</option>{[...new Set(view?.sourceVersions.map(source => source.kind) || [])].sort().map(value => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select></label><label>Revisions<select aria-label="Evidence revisions" value={versions} onChange={event => update(setVersions)(event.target.value)}><option value="current">Latest known only</option><option value="all">All known revisions</option></select></label><label>Known by<input type="date" aria-label="Evidence knowledge cutoff" max={today()} value={knownBy} onChange={event => { setKnownBy(event.target.value); setSelected(''); setPage(0); }}/></label></div>
    <p className="ops-context-note">“Latest known” follows the selected knowledge cutoff. Older bound revisions remain inspectable; a newer source never replaces their text.</p>
    {projected.error ? <div className="ops-error" role="alert"><AlertTriangle size={19}/><p>{projected.error}</p></div> : !items.length ? <Empty title="No matching source revisions" onClear={clear}>No source text matches these filters and the selected knowledge date. Unobserved evidence remains unknown.</Empty> : <div className="ops-split ops-library">
      <section className="ops-register" aria-label="Recorded evidence"><div className="ops-register-title"><h2>Source revisions</h2><span>{items.length}</span></div><label className="ops-mobile-picker">Selected evidence revision<select aria-label="Selected evidence revision" value={selected.key} onChange={event => setSelected(event.target.value)}>{items.map(source => <option key={source.key} value={source.key}>{source.vendorName} · {source.title} · Revision {source.revision}</option>)}</select></label><div className="ops-desktop-list">{shown.map(source => <button key={source.key} className={`ops-record ${source.key === selected.key ? 'selected' : ''}`} aria-pressed={source.key === selected.key} onClick={() => setSelected(source.key)}><strong>{source.title}</strong><span>{source.vendorName}</span><small>Revision {source.revision} · {source.isCurrent ? 'Latest known' : 'Earlier revision'}</small></button>)}</div><Pager page={safePage} total={items.length} onChange={value => { setPage(value); setSelected(''); }}/></section>
      <article className="ops-detail" aria-label="Exact source revision"><header><div><h2>{selected.title}</h2><p>{selected.vendorName} · {selected.kind.replaceAll('_', ' ')}</p></div><FileText size={20}/></header><div className="ops-detail-body"><dl className="ops-fact-list"><div><dt>Source identity</dt><dd>{selected.id}</dd></div><div><dt>Exact revision</dt><dd>{selected.revision} · {selected.isCurrent ? 'Latest known' : 'Earlier revision'}</dd></div><div><dt>Observed</dt><dd>{selected.observedAt}</dd></div><div><dt>Effective</dt><dd>{selected.effectiveDate}</dd></div></dl><div className="ops-source-revisions" role="group" aria-label="Known versions of this source">{revisions.map(source => <button key={source.revision} className="button secondary" aria-pressed={source.revision === selected.revision} onClick={() => chooseRevision(source)}>Revision {source.revision}</button>)}</div><pre className="ops-source-text" tabIndex={0} aria-label="Exact source text">{selected.text}</pre><button className="text-button" onClick={() => download(selected.text, `truthful-source-${selected.id.replace(/[^a-zA-Z0-9_-]/g, '_')}-revision-${selected.revision}.txt`)}><ArrowDownToLine size={14}/>Download exact text</button><section className="ops-source-usages"><h3>Records bound to this revision</h3>{usages.length ? usages.map((usage, index) => <div key={`${usage.kind}-${usage.id}-${index}`}><strong>{usage.label}</strong>{usage.kind === 'action' && <p>The workspace-wide authority basis includes this revision. This does not assert that the document supports every term of the action.</p>}<div className="ops-case-links">{usage.commitmentIds.map(id => <CaseButton key={id} view={view} id={id} destination={usage.destination} actionId={usage.actionId} onOpen={onOpen}/>)}</div></div>) : <p>No current recorded fact or authority basis is bound to this exact revision.</p>}</section><p className="ops-trust-note">This is supplied text recorded in the workspace. Internal lineage does not authenticate the issuer or establish evidence completeness.</p></div></article>
    </div>}
  </>;
}

function AuditActivity({ workspace, view, onOpen }) {
  const [query, setQuery] = useState(''), [vendorId, setVendor] = useState(''), [actorId, setActor] = useState(''), [type, setType] = useState(''), [fromDate, setFrom] = useState(''), [toDate, setTo] = useState(''), [selectedId, setSelected] = useState(''), [page, setPage] = useState(0);
  const all = workspaceActivity(workspace, view);
  const rangeError = fromDate && toDate && fromDate > toDate ? 'The recorded-from date must be on or before the through date.' : '';
  const events = rangeError ? [] : workspaceActivity(workspace, view, { query, vendorId, actorId, type, fromDate, toDate });
  const safePage = Math.min(page, Math.max(0, Math.ceil(events.length / 24) - 1)), shown = events.slice(safePage * 24, (safePage + 1) * 24);
  const selected = events.find(event => event.id === selectedId) || shown[0];
  const actors = [...new Map(all.map(event => [event.actor.id, event.actor])).values()].sort((a, b) => a.id.localeCompare(b.id));
  const update = setter => value => { setter(value); setPage(0); setSelected(''); };
  const clear = () => { setQuery(''); setVendor(''); setActor(''); setType(''); setFrom(''); setTo(''); setPage(0); setSelected(''); };
  return <>
    <div className="ops-toolbar ops-audit-toolbar"><SearchField label="Search workspace activity" value={query} onChange={update(setQuery)} placeholder="Record, reference, actor or transition"/><VendorFilter view={view} value={vendorId} onChange={update(setVendor)}/><label>Actor<select aria-label="Filter activity actor" value={actorId} onChange={event => update(setActor)(event.target.value)}><option value="">All actors</option>{actors.map(actor => <option key={actor.id} value={actor.id}>{actor.id} · {actor.role}</option>)}</select></label><label>Transition<select aria-label="Filter activity transition" value={type} onChange={event => update(setType)(event.target.value)}><option value="">All transitions</option>{[...new Set(all.map(event => event.type))].sort().map(value => <option key={value} value={value}>{eventLabel(value)}</option>)}</select></label><label>Recorded from<input type="date" aria-label="Activity recorded from" value={fromDate} onChange={event => update(setFrom)(event.target.value)}/></label><label>Through<input type="date" aria-label="Activity recorded through" value={toDate} onChange={event => update(setTo)(event.target.value)}/></label></div>
    <p className="ops-context-note">Filters use observation time. The effective date is shown separately. Associated case links use the currently recorded lineage.</p>
    {rangeError ? <div className="ops-error" role="alert"><AlertTriangle size={18}/><p>{rangeError}</p></div> : !events.length ? <Empty title="No matching recorded transitions" onClear={clear}>{all.length ? 'Try another actor, transition or observation date.' : 'This workspace has not recorded a transition yet.'}</Empty> : <div className="ops-split ops-audit">
      <section className="ops-register" aria-label="Recorded transitions"><div className="ops-register-title"><h2>Recorded transitions</h2><span>{events.length}</span></div><label className="ops-mobile-picker">Selected transition<select aria-label="Selected activity transition" value={selected.id} onChange={event => setSelected(event.target.value)}>{events.map(event => <option key={event.id} value={event.id}>{event.id} · {event.typeLabel} · {event.summary}</option>)}</select></label><div className="ops-desktop-list">{shown.map(event => <button key={event.id} className={`ops-record ${event.id === selected.id ? 'selected' : ''}`} aria-pressed={event.id === selected.id} onClick={() => setSelected(event.id)}><span className="ops-record-heading"><strong>{event.typeLabel}</strong><small>#{event.sequence}</small></span><span>{event.summary}</span><small>{event.observedAt.slice(0, 10)} · {event.actor.role}</small></button>)}</div><Pager page={safePage} total={events.length} onChange={value => { setPage(value); setSelected(''); }}/></section>
      <article className="ops-detail" aria-label="Exact recorded transition"><header><div><h2>{selected.typeLabel}</h2><p>{selected.id} · Sequence {selected.sequence}</p></div><Activity size={19}/></header><div className="ops-detail-body"><dl className="ops-fact-list"><div><dt>Recorded at</dt><dd>{selected.observedAt}</dd></div><div><dt>Financially effective</dt><dd>{selected.effectiveDate}</dd></div><div><dt>Actor</dt><dd>{selected.actor.id} · {selected.actor.role}</dd></div><div><dt>Vendor context</dt><dd>{selected.vendorNames.join(', ') || 'Workspace-wide'}</dd></div><div><dt>Material change</dt><dd>{selected.material ? 'Yes' : 'No · authority/lifecycle record'}</dd></div></dl><div className="ops-case-links">{selected.commitmentIds.map(id => <CaseButton key={id} view={view} id={id} destination="history" onOpen={onOpen}/>)}</div><h3 className="ops-payload-title">Recorded payload</h3><pre className="ops-event-json" tabIndex={0} aria-label="Exact recorded payload">{JSON.stringify(selected.payload, null, 2)}</pre><details className="ops-command-details"><summary>Command identity</summary><dl className="ops-fact-list"><div><dt>Command</dt><dd>{selected.commandId}</dd></div><div><dt>Event</dt><dd>{selected.id}</dd></div></dl><pre className="ops-event-json" tabIndex={0}>{selected.commandCanonical}</pre></details><p className="ops-trust-note">These records explain local model transitions. Actor labels are selectable demo identities; local consistency is not external source authenticity or financial settlement.</p></div></article>
    </div>}
  </>;
}

function FinancialReports({ workspace, service, onVendor }) {
  const [asOf, setAsOf] = useState(today), [knownBy, setKnownBy] = useState(today), [exporting, setExporting] = useState(false), [exportError, setExportError] = useState('');
  const reportState = useMemo(() => {
    try {
      if (!isDate(asOf) || !isDate(knownBy)) throw new Error('Choose a real financial date and knowledge cutoff.');
      if (knownBy > today()) throw new Error('The knowledge cutoff cannot be later than today.');
      return { report: financialReport(workspace, { asOf, knownAt: endOf(knownBy) }) };
    } catch (error) { return { error: error.message }; }
  }, [workspace, asOf, knownBy]);
  const report = reportState.report;
  const ticket = useRef(0);
  async function packet() {
    if (!report || exporting || service.busy) return;
    const operation = ++ticket.current;
    setExporting(true); setExportError('');
    try {
      const packet = await service.exportPacket({ asOf: report.asOf, knownAt: report.knownAt });
      if (operation === ticket.current) download(JSON.stringify(packet, null, 2), `truthful-report-${report.asOf}-known-${knownBy}.json`, 'application/json');
    } catch (error) { if (operation === ticket.current) setExportError(error.message); }
    finally { if (operation === ticket.current) setExporting(false); }
  }
  const measures = report && [
    ['Unconditional promised', report.totals.promisedCents, 'Original or accepted terms effective at the selected date.'],
    ['Verified applied', report.totals.verifiedCents, 'Applied, attributed and capped by each unconditional promise.'],
    ['Unconditional outstanding', report.totals.outstandingCents, 'Promised less verified applied; includes scheduled and expired claims.'],
    ['Recoverable at this date', report.totals.recoverableCents, 'Unconditional, due and within the recorded claim window.'],
    ['Issued, not applied', report.totals.issuedCents, 'Physical memo balance after reversals; excluded from verified applied.'],
    ['Conditional offers', report.totals.conditionalCents, 'Excluded from unconditional promised and recoverable value.'],
  ];
  return <>
    <div className="ops-toolbar ops-report-toolbar"><label>Financially effective on<input type="date" aria-label="Report financial effective date" value={asOf} onChange={event => setAsOf(event.target.value)}/></label><label>Known by<input type="date" aria-label="Report knowledge cutoff" value={knownBy} max={today()} onChange={event => setKnownBy(event.target.value)}/></label><button className="text-button" onClick={() => { setAsOf(today()); setKnownBy(today()); }}>Use current dates<ArrowRight size={13}/></button><div className="ops-report-exports"><button className="button secondary" disabled={!report || exporting} onClick={() => download(reportCsv(report), `truthful-vendor-report-${report.asOf}.csv`, 'text/csv;charset=utf-8')}><ArrowDownToLine size={14}/>Export CSV</button><button className="button secondary" disabled={!report || exporting || service.busy} onClick={packet}><ArrowDownToLine size={14}/>{exporting ? 'Preparing packet…' : 'Export audit packet'}</button></div></div>
    {reportState.error ? <div className="ops-error" role="alert"><AlertTriangle size={19}/><p>{reportState.error}</p></div> : <section className="ops-report" aria-label="Temporal financial report"><header><div><h2>Financial position on {report.asOf}</h2><p>Using evidence observed through {report.knownAt}. {report.observedEventCount} recorded transitions in this knowledge view.</p></div><History size={20}/></header><dl className="ops-report-measures">{measures.map(([label, value, explanation]) => <div key={label}><dt>{label}<small>{explanation}</small></dt><dd>{money(value)}</dd></div>)}</dl><div className="ops-report-table-heading"><h3>Vendor reconciliation</h3><span>USD · physical credits counted once</span></div><div className="ops-table-scroll" tabIndex={0} role="region" aria-label="Vendor financial reconciliation"><table><thead><tr><th scope="col">Vendor</th><th scope="col">Verified applied</th><th scope="col">Outstanding</th><th scope="col">Issued pending</th><th scope="col">Applied ledger</th><th scope="col">Unattributed</th><th scope="col">Conditional</th></tr></thead><tbody>{report.vendors.map(vendor => <tr key={vendor.id}><th scope="row"><button className="text-button" onClick={() => onVendor(vendor.id)}>{vendor.name}<ArrowRight size={12}/></button></th>{['verifiedCents', 'outstandingCents', 'issuedCents', 'ledgerAppliedCents', 'unallocatedCents', 'conditionalCents'].map(key => <td key={key}>{money(vendor.totals[key])}</td>)}</tr>)}</tbody><tfoot><tr><th scope="row">Workspace total</th>{['verifiedCents', 'outstandingCents', 'issuedCents', 'ledgerAppliedCents', 'unallocatedCents', 'conditionalCents'].map(key => <td key={key}>{money(report.totals[key])}</td>)}</tr></tfoot></table></div>{!report.vendors.length && <Empty title="No vendors known at this cutoff">Move the knowledge date forward to include later recorded evidence.</Empty>}<div className="ops-report-secondary"><h3>Ledger and obligation boundaries</h3><dl className="ops-fact-list"><div><dt>Attributed physical credit</dt><dd>{money(report.totals.allocatedCents)}</dd></div><div><dt>Quarantined credit balance</dt><dd>{money(report.totals.quarantinedCents)}</dd></div><div><dt>Effective incremental obligations</dt><dd>{money(report.totals.incrementalObligationCents)}</dd></div><div><dt>Accepted future incremental obligations</dt><dd>{money(report.totals.futureIncrementalObligationCents)}</dd></div><div><dt>Verified applied less effective incremental obligation</dt><dd>{money(report.totals.netVerifiedValueCents)}</dd></div></dl><p>Applied ledger can exceed attributed verified value when a credit is unallocated, quarantined, conditional or exceeds its promise. Those measures are related and must not be added together.</p></div><p className="ops-report-export-note">CSV amounts are exact integer cents with currency and both cutoffs. The audit packet includes the full recorded workspace plus this selected projection; its history can include evidence outside the projection’s knowledge cutoff.</p><p className="ops-trust-note">No report establishes source completeness, external settlement or realized customer savings. Renewal baselines remain explicit assumptions.</p></section>}
    {exportError && <div className="ops-error" role="alert"><AlertTriangle size={18}/><p>{exportError}</p></div>}
  </>;
}

export default function Operations({ service, section = 'operations', onOpenCommitment, onSection }) {
  const [context, setContext] = useState({ vendorId: '', sourceKey: '' }), [refreshing, setRefreshing] = useState(false), [refreshError, setRefreshError] = useState('');
  const date = today();
  const projection = useMemo(() => {
    try { return service.workspace ? { view: evaluateWorkspace(service.workspace, { asOf: date, knownAt: new Date().toISOString() }) } : {}; }
    catch (error) { return { error: error.message }; }
  }, [service.workspace, date]);
  const [title, description] = definitions[section] || definitions.operations;
  const goSection = next => { setContext({ vendorId: '', sourceKey: '' }); onSection(next); };
  const goVendor = (vendorId,vendorTab='commitments') => { setContext({ vendorId, vendorTab, sourceKey: '' }); onSection('vendors'); };
  const goLibrary = (vendorId, sourceKey) => { setContext({ vendorId, sourceKey }); onSection('library'); };
  async function refresh() {
    if (refreshing || service.busy) return;
    setRefreshing(true); setRefreshError('');
    try { await service.refresh(); }
    catch (error) { setRefreshError(error.message); }
    finally { setRefreshing(false); }
  }
  return <main className="operations-page"><div className="ops-page-heading"><div><h1>{title}</h1><p>{description}</p></div><div className="ops-page-utilities"><span><ShieldCheck size={14}/>{service.mode === 'server' ? 'Local SQLite records' : service.mode === 'connecting' ? 'Connecting workspace' : 'Browser-local records'}</span>{service.mode === 'server' && <button className="button secondary" onClick={refresh} disabled={refreshing || service.busy}><RefreshCw size={14}/>{refreshing ? 'Refreshing…' : 'Refresh'}</button>}</div></div>{(refreshError || service.error) && <div className="ops-error" role="alert"><AlertTriangle size={18}/><p>{refreshError || service.error}</p></div>}{projection.error ? <div className="ops-error" role="alert"><AlertTriangle size={19}/><p>{projection.error}</p></div> : !projection.view ? <div className="ops-empty" role="status"><Clock3 size={27}/><h2>Opening the shared workspace…</h2><p>Loading the recorded commitments and their evidence.</p></div> : section === 'vendors' ? <VendorDirectory view={projection.view} initialVendorId={context.vendorId} initialTab={context.vendorTab} onOpen={onOpenCommitment} onLibrary={goLibrary}/> : section === 'library' ? <EvidenceLibrary workspace={service.workspace} initialVendorId={context.vendorId} initialSourceKey={context.sourceKey} onOpen={onOpenCommitment}/> : section === 'audit' ? <AuditActivity workspace={service.workspace} view={projection.view} onOpen={onOpenCommitment}/> : section === 'reports' ? <FinancialReports workspace={service.workspace} service={service} onVendor={goVendor}/> : <Queue view={projection.view} onOpen={onOpenCommitment} onVendor={goVendor} onSection={goSection}/>}<footer className="ops-page-footer"><CheckCheck size={14}/>Read-only views of the shared financial model. Actions and approvals remain in their case workspace.</footer></main>;
}
