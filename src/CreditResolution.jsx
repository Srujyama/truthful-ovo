import React, { useEffect, useId, useRef, useState } from 'react';
import { ArrowRight, ChevronDown, FileText, ShieldCheck } from 'lucide-react';
import { mutationReason } from './assurance-ui.mjs';
import { prepareCreditResolution } from './credit-resolution.mjs';
import './credit-resolution.css';

const today = () => new Date().toISOString().slice(0,10);
const money = value => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(value/100);

function BoundSource({ source, label = 'Inspect clarification source' }) {
  return source ? <details className="credit-resolution-source"><summary><FileText size={14}/>{label}<ChevronDown size={13}/></summary><strong>{source.title}</strong><p>Bound revision {source.revision}. Supplied text; authenticity is not established.</p><blockquote>{source.text}</blockquote></details> : <p className="credit-resolution-error">The bound source revision is unavailable in this view. Return to current records before resolving credit.</p>;
}

export default function CreditResolution({ view, credit, service, readOnly }) {
  const controlId = useId();
  const [sourceForm,setSourceForm] = useState({sourceTitle:'',sourceText:'',effectiveDate:today()});
  const [sourceId,setSourceId] = useState('');
  const [limits,setLimits] = useState({});
  const [effectiveDate,setEffectiveDate] = useState(today);
  const [preview,setPreview] = useState(null);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const [saving,setSaving] = useState(false);
  const submitting = useRef(false);
  const mounted = useRef(true);
  const activeCredit = useRef(credit.id);
  activeCredit.current = credit.id;
  const previewHeading = useRef(null);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  // A preview is discarded permanently when its authority or workspace changes.
  // A later return to the same role or current date must require a fresh review.
  useEffect(()=>setPreview(null),[service.workspace,service.actor?.id,service.actor?.role,readOnly]);
  // A parent normally keys this editor by credit. Protect unkeyed reuse as well.
  useEffect(()=>{setSourceForm({sourceTitle:'',sourceText:'',effectiveDate:today()});setSourceId('');setLimits({});setEffectiveDate(today());setPreview(null);setError('');setNotice('');},[credit.id]);
  const candidates = view.commitments.filter(c => credit.candidateCommitmentIds.includes(c.id));
  const sources = view.sources.filter(source => source.vendorId === credit.vendorId && source.kind === 'allocation_resolution');
  const selectedSource = sources.find(source => source.id === sourceId);
  const evidenceReason = mutationReason('ADD_SOURCE',service.actor?.role,{readOnly,busy:service.busy || saving});
  const resolveAccessReason = mutationReason('RESOLVE_CREDIT',service.actor?.role,{readOnly,busy:service.busy || saving});
  const resolveReason = resolveAccessReason || (!sources.length ? 'An analyst must record clarification evidence before an approver can set assignment limits.' : !selectedSource ? 'Select a clarification source present in current records.' : '');
  const currentPreview = preview && preview.workspace === service.workspace && preview.actorId === service.actor?.id && preview.role === service.actor?.role && preview.creditId === credit.id && preview.date === today() && !readOnly ? preview : null;
  const previewCredit = currentPreview?.plan.after.credits.find(c => c.id === credit.id);
  const previewSource = currentPreview?.plan.after.sources.find(s => s.id === currentPreview.plan.sourceId);
  const verifiedDelta = currentPreview ? currentPreview.plan.after.totals.verifiedCents-currentPreview.plan.before.totals.verifiedCents : 0;
  const existingBoundSources = (credit.resolution?.sourceLinks || []).map(link => view.sourceVersions.find(s => s.id === link.sourceId && s.revision === link.revision));
  function changed() { setPreview(null);setError('');setNotice(''); }
  function prepare(operation) {
    const input = operation === 'evidence' ? {operation,creditId:credit.id,...sourceForm} : {operation,creditId:credit.id,sourceId:selectedSource?.id,effectiveDate,assignments:candidates.map(c=>({commitmentId:c.id,amount:limits[c.id] || ''}))};
    return prepareCreditResolution(service.workspace,input,{actor:service.actor,now:new Date().toISOString(),readOnly});
  }
  function review(event,operation) {
    event.preventDefault();
    if (submitting.current || (operation === 'evidence' ? evidenceReason : resolveReason)) return;
    try {
      setPreview({plan:prepare(operation),operation,workspace:service.workspace,actorId:service.actor.id,role:service.actor.role,creditId:credit.id,date:today()});setError('');setNotice('');
      requestAnimationFrame(()=>previewHeading.current?.focus());
    } catch (e) { setPreview(null);setError(e.message); }
  }
  async function record() {
    if (!currentPreview || submitting.current || (currentPreview.operation === 'evidence' ? evidenceReason : resolveReason)) return;
    const reviewed = currentPreview;
    submitting.current=true;setSaving(true);
    try {
      prepare(reviewed.operation); // Revalidate role, source revision and current financial basis.
      const result = await service.commands(reviewed.plan.commands);
      if (!mounted.current || activeCredit.current !== reviewed.creditId || !result) return;
      setPreview(null);setError('');
      if (reviewed.operation === 'evidence') {
        setSourceId(reviewed.plan.sourceId);setSourceForm(old=>({...old,sourceText:'',sourceTitle:''}));
        setNotice('Clarification evidence recorded. An approver can now inspect it and set explicit assignment limits. Credit attribution is unchanged.');
      } else {
        setNotice('Assignment limits recorded. An analyst can attribute available credit within those limits. No new credit or invoice application was created.');
      }
    } catch (e) {
      if (mounted.current && activeCredit.current === reviewed.creditId) { setError(e.message);setPreview(null); }
    } finally { submitting.current=false;if (mounted.current) setSaving(false); }
  }
  return <details className="credit-resolution">
    <summary>{credit.resolution ? 'Review or update assignment limits' : 'Resolve credit attribution'}<ChevronDown size={14}/></summary>
    <div className="credit-resolution-body">
      <p>{credit.quarantined ? 'Several commitments may share this reference. Record the vendor clarification, then approve explicit limits before attributing this credit.' : 'A resolution assigns explicit limits to exact matching commitments. It cannot change vendor, currency, reference, or erase active attribution.'}</p>
      <dl className="credit-resolution-balance"><div><dt>Credit remaining</dt><dd>{money(credit.availableCents)}</dd></div><div><dt>Already attributed</dt><dd>{money(credit.allocatedCents)}</dd></div><div><dt>Exact candidates</dt><dd>{candidates.length}</dd></div></dl>
      {credit.resolution && <details className="credit-resolution-current"><summary>Recorded assignment and bound evidence<ChevronDown size={13}/></summary><ul>{credit.resolution.assignments.map(row=><li key={row.commitmentId}><span>{view.commitments.find(c=>c.id===row.commitmentId)?.reference || row.commitmentId}<small>{row.commitmentId}</small></span><strong>{money(row.limitCents)} maximum</strong></li>)}</ul>{existingBoundSources.map((source,index)=><BoundSource key={source?.id || index} source={source} label="Inspect recorded resolution evidence"/>)}</details>}
      <details className="credit-resolution-evidence">
        <summary>Record clarification evidence<ChevronDown size={13}/></summary>
        <form onSubmit={event=>review(event,'evidence')}>
          <p>An analyst records the supplied explanation. This step does not resolve ambiguity or change financial attribution.</p>
          <fieldset disabled={!!evidenceReason}>
            <div className="credit-resolution-fields"><label>Clarification title<input maxLength={200} value={sourceForm.sourceTitle} onChange={e=>{changed();setSourceForm(old=>({...old,sourceTitle:e.target.value}));}} placeholder="Vendor attribution clarification"/></label><label>Clarification effective date<input type="date" max={today()} value={sourceForm.effectiveDate} onChange={e=>{changed();setSourceForm(old=>({...old,effectiveDate:e.target.value}));}}/></label></div>
            <label>Clarification source text<textarea maxLength={250000} value={sourceForm.sourceText} onChange={e=>{changed();setSourceForm(old=>({...old,sourceText:e.target.value}));}} placeholder={`Paste the vendor’s explicit assignment of ${credit.invoiceId} under ${credit.reference}…`}/></label>
          </fieldset>
          {evidenceReason && <p className="mutation-reason">{evidenceReason}</p>}
          <div className="credit-resolution-actions"><small>Supplied evidence; no vendor is contacted.</small><button type="submit" className="button secondary" disabled={!!evidenceReason}>Preview clarification<ArrowRight size={14}/></button></div>
        </form>
      </details>
      <form className="credit-resolution-assignment" onSubmit={event=>review(event,'resolve')}>
        <h4>Approve explicit assignment limits</h4>
        {!sources.length && <p className="credit-resolution-empty">No clarification source is recorded for this vendor. An analyst can use Record clarification evidence above; then an approver can continue here.</p>}
        <fieldset disabled={!!resolveAccessReason}>
          <div className="credit-resolution-fields"><label>Resolution clarification source<select value={selectedSource?.id || ''} onChange={e=>{changed();setSourceId(e.target.value);}}><option value="" disabled>Choose recorded clarification</option>{sources.map(source=><option key={source.id} value={source.id}>{source.title} · Revision {source.revision}</option>)}</select></label><label>Resolution effective date<input type="date" max={today()} value={effectiveDate} onChange={e=>{changed();setEffectiveDate(e.target.value);}}/></label></div>
          <div className="credit-resolution-limits">{candidates.map(c=>{const allocated=credit.allocations.filter(a=>a.commitmentId===c.id).reduce((sum,a)=>sum+a.activeCents,0);return <label htmlFor={`${controlId}-${c.id}`} key={c.id}><span><strong>{c.reference}</strong><small>{c.id} · {money(allocated)} already attributed</small></span><span>Maximum USD<input id={`${controlId}-${c.id}`} aria-label={`Maximum assignment USD for ${c.id}`} inputMode="decimal" value={limits[c.id] || ''} onChange={e=>{changed();setLimits(old=>({...old,[c.id]:e.target.value}));}} placeholder="0.00"/></span></label>;})}</div>
          <p className="credit-resolution-help">Blank or zero leaves that commitment unassigned. Limits must fit within {money(credit.availableCents)} and preserve every active attribution. Unassigned capacity stays available; no attribution is created automatically.</p>
        </fieldset>
        {selectedSource && <BoundSource source={selectedSource} label="Inspect selected clarification"/>}
        {resolveReason && <p className="mutation-reason">{resolveReason}</p>}
        <div className="credit-resolution-actions"><small>Requires approver or admin role.</small><button type="submit" className="button secondary" disabled={!!resolveReason || !candidates.length}>Preview assignment limits<ArrowRight size={14}/></button></div>
      </form>
      {notice && <p className="credit-resolution-notice" role="status">{notice}</p>}
      {error && <p className="credit-resolution-error" role="alert">{error}</p>}
      {preview && !currentPreview && <p className="mutation-reason" role="status">The workspace, role, credit, or date changed. Preview this resolution again before recording.</p>}
      {currentPreview && <section className="credit-resolution-preview" aria-label="Credit resolution preview">
        <h4 tabIndex={-1} ref={previewHeading}><ShieldCheck size={16}/>{currentPreview.operation === 'evidence' ? 'Review clarification evidence' : 'Review explicit assignment limits'}</h4>
        {currentPreview.operation === 'evidence' ? <><BoundSource source={previewSource}/><p>Only this source will be recorded. The credit remains {credit.quarantined ? 'quarantined' : 'in its current attribution state'} until an approver records a resolution.</p></> : <><p>Effective {effectiveDate}. Quarantine {previewCredit.quarantined ? 'remains' : 'will be released'}. Existing verified applied value changes by {money(verifiedDelta)}; no new credit is recorded.</p><ul>{previewCredit.resolution.assignments.map(row=><li key={row.commitmentId}><span>{row.commitmentId}</span><strong>{money(row.limitCents)} maximum</strong></li>)}</ul><BoundSource source={previewSource}/><p>Unused credit remains unallocated. An analyst must separately record attribution within these limits.</p></>}
        <div className="credit-resolution-actions"><button type="button" className="text-button" disabled={saving} onClick={()=>setPreview(null)}>Edit resolution</button><button type="button" className="button primary" disabled={saving || service.busy || !!(currentPreview.operation === 'evidence' ? evidenceReason : resolveReason)} onClick={record}>{saving ? 'Recording…' : currentPreview.operation === 'evidence' ? 'Record clarification' : 'Record assignment limits'}<ArrowRight size={14}/></button></div>
      </section>}
    </div>
  </details>;
}
