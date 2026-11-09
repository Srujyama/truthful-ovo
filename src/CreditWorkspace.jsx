import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, CheckCheck, ChevronDown, FileText, Plus, X } from 'lucide-react';
import { prepareCreditWorkflow } from './credit-workflow.mjs';
import { mutationReason } from './assurance-ui.mjs';
import { moneyToCents } from './engine/index.mjs';
import './credit-workspace.css';
import CreditResolution from './CreditResolution.jsx';

const money = cents => new Intl.NumberFormat('en-US', {style:'currency',currency:'USD'}).format(cents/100);
const today = () => new Date().toISOString().slice(0,10);
const names = {register:'Record a new credit',allocate:'Assign credit to this follow-up',apply:'Record invoice application',reverse:'Record a reversal'};
const commands = {register:'REGISTER_CREDIT',allocate:'ALLOCATE_CREDIT',apply:'APPLY_CREDIT',reverse:'REVERSE_CREDIT'};
const initial = () => ({operation:'register',creditId:'',invoiceId:'',lineId:'',status:'issued',amount:'',allocationAmount:'',effectiveDate:today(),sourceTitle:'',sourceText:'',allocationReversals:[]});

function CreditSources({credit,view,workspace}) {
  const seen = new Set();
  const reversals=workspace.events.filter(e=>e.type==='CREDIT_REVERSED'&&e.payload.creditId===credit.id&&e.observedAt<=view.knownAt&&e.effectiveDate<=view.asOf);
  const links = [...credit.sourceLinks,...(credit.applicationSourceLinks || []),...credit.allocations.flatMap(a=>a.sourceLinks||[]),...reversals.flatMap(e=>e.payload.sourceLinks)].filter(link => {
    const key=`${link.sourceId}@${link.revision}`;
    if(seen.has(key))return false;
    seen.add(key);return true;
  });
  return <details className="credit-sources"><summary><FileText size={13}/>Supporting documents<ChevronDown size={13}/></summary>{links.map(link=>{
    const source=view.sourceVersions.find(s=>s.id===link.sourceId&&s.revision===link.revision);
    return <section key={`${link.sourceId}@${link.revision}`}><h4>{source?.title || link.sourceId}</h4><small>Bound revision {link.revision} · Supplied evidence</small><pre>{source?.text || 'This source revision is unavailable in this snapshot.'}</pre></section>;
  })}</details>;
}

export default function CreditWorkspace({view,commitment,service,readOnly}) {
  const credits=view.credits.filter(c=>c.vendorId===commitment.vendorId&&c.reference===commitment.reference&&c.currency===commitment.currency);
  const [form,setForm]=useState(initial);
  const [preview,setPreview]=useState(null);
  const [error,setError]=useState('');
  const [success,setSuccess]=useState('');
  const [saving,setSaving]=useState(false);
  const editor=useRef(null), first=useRef(null), previewHeading=useRef(null), ledgerHeading=useRef(null), submitting=useRef(false);
  useEffect(()=>setPreview(null),[service.workspace,service.actor.id,service.actor.role,readOnly]);
  const credit=credits.find(c=>c.id===form.creditId);
  const reason=mutationReason(commands[form.operation],service.actor.role,{readOnly,busy:service.busy||saving}) || mutationReason('ADD_SOURCE',service.actor.role,{readOnly,busy:service.busy||saving});
  const currentPreview=preview&&preview.workspace===service.workspace&&preview.role===service.actor.role&&preview.actorId===service.actor.id&&preview.date===today()&&!readOnly;
  let reversalBacking=0;
  try { if(form.operation==='reverse'&&credit&&form.amount.trim()) reversalBacking=Math.max(0,moneyToCents(form.amount)-credit.unallocatedCents); } catch { /* Validation is shown on preview. */ }

  function change(key,value) { setForm(f=>({...f,[key]:value,...(key==='creditId'?{allocationReversals:[]}: {})}));setPreview(null);setError('');setSuccess(''); }
  function open(operation,creditId='') {
    setForm({...initial(),operation,creditId});setPreview(null);setError('');setSuccess('');
    editor.current.open=true;
    requestAnimationFrame(()=>{first.current?.focus();editor.current?.scrollIntoView({block:'nearest',behavior:'instant'});});
  }
  function inspect(event) {
    event.preventDefault();setError('');setPreview(null);
    try {
      const result=prepareCreditWorkflow(service.workspace,{...form,commitmentId:commitment.id},{actor:service.actor,now:new Date().toISOString(),readOnly});
      setPreview({...result,workspace:service.workspace,role:service.actor.role,actorId:service.actor.id,date:today()});
      requestAnimationFrame(()=>previewHeading.current?.focus());
    } catch(e) { setError(e.message); }
  }
  async function record() {
    if(submitting.current||reason)return;
    if(!currentPreview){setError('The workspace or role changed. Preview the current evidence again before recording.');return;}
    submitting.current=true;setSaving(true);setError('');
    try {
      // Fresh reducer validation precedes the service's own atomic, revision-checked write.
      const fresh=prepareCreditWorkflow(service.workspace,{...form,commitmentId:commitment.id},{actor:service.actor,now:new Date().toISOString(),readOnly});
      const reply=await service.commands(preview.commands);
      if(!reply)throw new Error('No change was recorded. Refresh the workspace and preview again.');
      const delta=fresh.effects.verifiedDeltaCents;
      setSuccess(`${names[form.operation]} recorded. ${delta===0?'Applied amount is unchanged.':`Applied amount ${delta>0?'increased':'decreased'} by ${money(Math.abs(delta))}.`} No vendor transaction was sent.`);
      setForm(initial());setPreview(null);editor.current.open=false;
      requestAnimationFrame(()=>ledgerHeading.current?.focus());
    } catch(e) { setError(e.message);setPreview(null); }
    finally { submitting.current=false;setSaving(false); }
  }
  const recordLabel=form.operation==='register'?`Record ${form.status} credit`:form.operation==='allocate'?'Record assignment':form.operation==='apply'?'Record application':'Record reversal';
  return <section className="shared-ledger credit-workspace" aria-label="Credits workspace">
    <div className="credit-ledger-heading"><div><h3 ref={ledgerHeading} tabIndex={-1}>Credits</h3><p>Issued credits count as applied only when an invoice confirms them.</p></div><button className="button secondary" disabled={service.busy||saving} onClick={()=>open('register')}><Plus size={14}/>Record credit</button></div>
    {success&&<p className="credit-success" role="status"><CheckCheck size={17}/>{success}</p>}
    {!credits.length&&<div className="ledger-empty-state"><FileText size={22}/><h3>No credit recorded yet.</h3><p>Add a credit memo or invoice line to track fulfillment.</p></div>}
    {credits.map(c=><article className="ledger-credit" key={c.id}>
      <div className="credit-record-heading"><span><strong>{c.invoiceId}</strong><small>Line {c.lineId}</small></span><span className={`assurance-status ${c.status==='applied'?'verified':'issued'}`}>{c.status==='applied'?'Applied to invoice':'Issued, not applied'}</span></div>
      <p className="credit-line-id">{c.reference}</p>
      <dl className="credit-record-amounts"><div><dt>Recorded credit</dt><dd>{money(c.amountCents)}</dd></div>{c.reversedCents>0&&<div><dt>Reversed</dt><dd>{money(c.reversedCents)}</dd></div>}<div><dt>Credit remaining</dt><dd>{money(c.availableCents)}</dd></div><div><dt>Assigned to follow-ups</dt><dd>{money(c.allocatedCents)}</dd></div><div><dt>Available to assign</dt><dd>{money(c.unallocatedCents)}</dd></div></dl>
      {c.quarantined&&<p className="credit-warning">{c.quarantineReason} An approver must confirm how this credit can be assigned.</p>}
      {c.allocations.map(a=><p key={a.id}>{view.commitments.find(x=>x.id===a.commitmentId)?.reference || a.commitmentId}: {money(a.activeCents)} assigned{a.revokedCents>0?`, ${money(a.revokedCents)} reversed`:''}</p>)}
      {(c.quarantined||c.resolution)&&<CreditResolution key={c.id} view={view} credit={c} service={service} readOnly={readOnly}/>}
      <CreditSources credit={c} view={view} workspace={service.workspace}/>
      <div className="credit-row-actions"><button className="text-button" disabled={service.busy||saving||c.quarantined||c.unallocatedCents===0} onClick={()=>open('allocate',c.id)}>Assign to follow-up<ArrowRight size={13}/></button>{c.status==='issued'&&<button className="text-button" disabled={service.busy||saving} onClick={()=>open('apply',c.id)}>Add invoice evidence<ArrowRight size={13}/></button>}<button className="text-button" disabled={service.busy||saving||c.availableCents===0} onClick={()=>open('reverse',c.id)}>Reverse credit<ArrowRight size={13}/></button></div>
    </article>)}
    <details ref={editor} className="credit-editor">
      <summary>Add or update a credit<ChevronDown size={14}/></summary>
      <form onSubmit={inspect}>
        <div className="credit-form-heading"><h3>{names[form.operation]}</h3><button type="button" className="icon-button" aria-label="Close credit editor" disabled={saving} onClick={()=>{editor.current.open=false;ledgerHeading.current?.focus();}}><X size={15}/></button></div>
        <p className="credit-context">{commitment.reference} · USD. This follow-up’s company and reference are fixed.</p>
        {reason&&<p className="credit-warning" role="status">{reason}</p>}
        <fieldset disabled={!!reason}>
          <div className="credit-fields"><label>Operation<select ref={first} aria-label="Credit operation" value={form.operation} onChange={e=>change('operation',e.target.value)}>{Object.entries(names).map(([value,label])=><option key={value} value={value} disabled={value!=='register'&&!credits.length}>{label}</option>)}</select></label>
          {form.operation!=='register'?<label>Credit line<select aria-label="Credit line" value={form.creditId} onChange={e=>change('creditId',e.target.value)} required><option value="">Choose an exact credit line</option>{credits.map(c=><option key={c.id} value={c.id}>{c.invoiceId} / {c.lineId} · {money(c.availableCents)}</option>)}</select></label>:<label>Credit status<select aria-label="Credit status" value={form.status} onChange={e=>change('status',e.target.value)}><option value="issued">Issued memo — not applied</option><option value="applied">Applied invoice credit</option></select></label>}
          {form.operation==='register'&&<><label>Invoice or memo reference<input aria-label="Credit invoice reference" value={form.invoiceId} onChange={e=>change('invoiceId',e.target.value)} maxLength={200} required/></label><label>Credit line reference<input aria-label="Credit line identity" value={form.lineId} onChange={e=>change('lineId',e.target.value)} maxLength={200} required/></label></>}
          {form.operation!=='apply'&&<label>{form.operation==='register'?'Credit amount (USD)':form.operation==='allocate'?'Amount to assign (USD)':'Reversal amount (USD)'}<input aria-label={form.operation==='reverse'?'Reversal amount':'Credit amount'} inputMode="decimal" value={form.amount} onChange={e=>change('amount',e.target.value)} placeholder="0.00" required/></label>}
          <label>Effective date<input aria-label="Credit effective date" type="date" max={today()} value={form.effectiveDate} onChange={e=>change('effectiveDate',e.target.value)} required/></label>
          {form.operation==='register'&&<label>Assign to this follow-up (USD, optional)<input aria-label="Initial credit attribution" inputMode="decimal" value={form.allocationAmount} onChange={e=>change('allocationAmount',e.target.value)} placeholder="0.00"/><small>Leave blank to keep the entire credit available.</small></label>}</div>
          {form.operation==='register'&&<p className="credit-help">Use the invoice and line references exactly as supplied. Duplicate lines are rejected.</p>}
          {form.operation==='reverse'&&credit&&<div className="credit-reversal"><h4>Choose which assignments to reverse</h4><p>{money(reversalBacking)} in assignments must be removed. Enter the amount for each record below; unassigned credit is reversed first.</p>{credit.allocations.filter(a=>a.activeCents>0).map(a=><label key={a.id}>{view.commitments.find(c=>c.id===a.commitmentId)?.reference || a.commitmentId} · {money(a.activeCents)} assigned<input aria-label={`Reverse attribution ${a.id}`} inputMode="decimal" value={form.allocationReversals.find(x=>x.allocationId===a.id)?.amount || ''} onChange={e=>change('allocationReversals',[...form.allocationReversals.filter(x=>x.allocationId!==a.id),{allocationId:a.id,amount:e.target.value}])} placeholder="0.00"/></label>)}</div>}
          <label>Document title<input aria-label="Credit source title" value={form.sourceTitle} onChange={e=>change('sourceTitle',e.target.value)} maxLength={200} placeholder="For example, November credit memo"/></label>
          <label>Document text<textarea aria-label="Supporting credit source text" value={form.sourceText} onChange={e=>change('sourceText',e.target.value)} maxLength={250000} placeholder="Paste the memo, invoice line, assignment instruction, or reversal notice. Include references and amount." required/></label>
          <p className="credit-help">Document text is stored as supplied. {form.operation==='apply'?'Adding an invoice confirms this credit; it creates no second credit.':''}</p>
          <button className="button secondary" type="submit">Review change<ArrowRight size={14}/></button>
        </fieldset>
      </form>
      {error&&<p className="credit-error" role="alert">{error}</p>}
      {preview&&!currentPreview&&<p className="credit-warning" role="status">The workspace, date, or role changed. Preview again before recording.</p>}
      {currentPreview&&<section className="credit-preview" aria-label="Credit change preview"><h3 ref={previewHeading} tabIndex={-1}>Review the credit change</h3><p>Confirm the amounts before recording.</p><div className="credit-preview-values">{[['Applied amount change',preview.effects.verifiedDeltaCents],['Amount owed change',preview.effects.outstandingDeltaCents],['Issued amount change',preview.effects.issuedDeltaCents]].map(([label,value])=><div key={label}><span>{label}</span><strong>{value>0?'+':''}{money(value)}</strong></div>)}</div><dl><div><dt>Credit remaining after this change</dt><dd>{money(preview.effects.creditAvailableAfterCents)}</dd></div><div><dt>Available to assign after this change</dt><dd>{money(preview.effects.unallocatedAfterCents)}</dd></div></dl>{preview.effects.affectedCommitments.map(c=><p key={c.id}>{c.reference}: verified {money(c.beforeVerifiedCents)} → {money(c.afterVerifiedCents)}; outstanding {money(c.beforeOutstandingCents)} → {money(c.afterOutstandingCents)}.</p>)}<p className="credit-help">Effective {form.effectiveDate}. This records the supplied document; the vendor is not contacted.</p><button type="button" className="button primary" disabled={!!reason} onClick={record}>{saving?'Recording…':recordLabel}<ArrowRight size={14}/></button></section>}
    </details>
  </section>;
}
