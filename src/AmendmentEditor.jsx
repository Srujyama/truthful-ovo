import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, ChevronDown, FileText } from 'lucide-react';
import { prepareAmendmentWorkflow } from './amendment-workflow.mjs';
import { mutationReason } from './assurance-ui.mjs';
import './amendment-editor.css';

const money = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value / 100);
const initialForm = commitment => ({
  commitmentId: commitment.id, changes: { promisedCents: false, dueDate: false, claimDeadline: false, conditions: false },
  promisedAmount: (commitment.promisedCents / 100).toFixed(2), dueDate: commitment.dueDate,
  claimDeadline: commitment.claimDeadline || '', conditions: commitment.conditions.join('\n'),
  effectiveDate: new Date().toISOString().slice(0, 10), sourceTitle: '', sourceText: '',
  renewal: false, baselineAmount: '', incrementalAmount: '', baselineDescription: '',
});

export default function AmendmentEditor({ view, commitment, service, readOnly, onReview }) {
  const [form, setForm] = useState(() => initialForm(commitment));
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);
  const mounted = useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  const previewHeading = useRef(null);
  useEffect(()=>setPreview(null),[service.workspace,service.actor?.id,service.actor?.role,readOnly]);
  const reason = mutationReason('PROPOSE_AMENDMENT', service.actor?.role, { readOnly, busy: service.busy || saving });
  const currentPreview = preview && preview.workspace === service.workspace && preview.role === service.actor?.role && preview.actorId === service.actor?.id && preview.date === new Date().toISOString().slice(0,10) && !readOnly ? preview : null;
  const amendment = currentPreview?.plan.after.amendments.find(a => a.id === currentPreview.plan.amendmentId);
  const action = currentPreview?.plan.after.actions.find(a => a.id === currentPreview.plan.actionId);
  const change = (key, value) => { setForm(old => ({ ...old, [key]: value })); setPreview(null); setError(''); };
  const selectField = (key, value) => change('changes', { ...form.changes, [key]: value });
  const prepare = () => prepareAmendmentWorkflow(service.workspace, form, { actor: service.actor, now: new Date().toISOString(), readOnly });
  function review(event) {
    event.preventDefault();
    if (reason) return;
    try {
      setPreview({ plan: prepare(), workspace: service.workspace, role: service.actor.role, actorId:service.actor.id, date:new Date().toISOString().slice(0,10) }); setError('');
      requestAnimationFrame(() => previewHeading.current?.focus());
    } catch (e) { setError(e.message); setPreview(null); }
  }
  async function record() {
    if (!currentPreview || reason || submitting.current) return;
    submitting.current=true;setSaving(true);
    try {
      // Recheck dates, role and the current basis at the action boundary.
      prepare();
      const result = await service.commands(currentPreview.plan.commands);
      if (!result || !mounted.current) return;
      setPreview(null); setError('');
      onReview(commitment.id, currentPreview.plan.actionId);
    } catch (e) { setError(e.message); setPreview(null); }
    finally { submitting.current=false;setSaving(false); }
  }
  return <details className="amendment-editor">
    <summary>Propose changed terms<ChevronDown size={14}/></summary>
    <form onSubmit={review}>
      <p>Record a vendor proposal against {commitment.reference}. The current agreement stays in force until an exact action is approved and recorded.</p>
      <fieldset disabled={!!reason}>
        <legend>Terms to change</legend>
        <div className="amendment-field">
          <label className="amendment-check"><input type="checkbox" checked={form.changes.promisedCents} onChange={e => selectField('promisedCents', e.target.checked)}/>Promise amount</label>
          {form.changes.promisedCents && <label>Amended promise USD<input inputMode="decimal" value={form.promisedAmount} onChange={e => change('promisedAmount', e.target.value)}/></label>}
        </div>
        <div className="amendment-field">
          <label className="amendment-check"><input type="checkbox" checked={form.changes.dueDate} onChange={e => selectField('dueDate', e.target.checked)}/>Due date</label>
          {form.changes.dueDate && <label>Amended due date<input type="date" value={form.dueDate} onChange={e => change('dueDate', e.target.value)}/></label>}
        </div>
        <div className="amendment-field">
          <label className="amendment-check"><input type="checkbox" checked={form.changes.claimDeadline} onChange={e => selectField('claimDeadline', e.target.checked)}/>Claim deadline</label>
          {form.changes.claimDeadline && <label>Amended claim deadline<input aria-label="Amended claim deadline" type="date" value={form.claimDeadline} onChange={e => change('claimDeadline', e.target.value)}/><small>Leave empty to remove the deadline.</small></label>}
        </div>
        <div className="amendment-field">
          <label className="amendment-check"><input type="checkbox" checked={form.changes.conditions} onChange={e => selectField('conditions', e.target.checked)}/>Conditions</label>
          {form.changes.conditions && <label>Amended conditions<textarea aria-label="Amended conditions" value={form.conditions} onChange={e => change('conditions', e.target.value)} maxLength={21000}/><small>One condition per line. Leave empty for unconditional terms.</small></label>}
        </div>
        <div className="amendment-two-fields">
          <label>Amendment effective date<input aria-label="Amendment effective date" type="date" value={form.effectiveDate} onChange={e => change('effectiveDate', e.target.value)}/><small>Future terms take effect only on this date after acceptance.</small></label>
          <label>Proposal source title<input value={form.sourceTitle} onChange={e => change('sourceTitle', e.target.value)} maxLength={200} placeholder="Vendor email or proposed agreement"/></label>
        </div>
        <label className="amendment-check"><input type="checkbox" checked={form.renewal} onChange={e => change('renewal', e.target.checked)}/>Includes a new renewal obligation</label>
        {form.renewal && <div className="amendment-renewal-fields">
          <div className="amendment-two-fields"><label>Baseline total USD<input inputMode="decimal" value={form.baselineAmount} onChange={e => change('baselineAmount', e.target.value)}/></label><label>Incremental renewal cost USD<input inputMode="decimal" value={form.incrementalAmount} onChange={e => change('incrementalAmount', e.target.value)}/></label></div>
          <label>Renewal baseline description<textarea aria-label="Renewal baseline description" value={form.baselineDescription} onChange={e => change('baselineDescription', e.target.value)} maxLength={2000}/><small>State the comparison period and assumed alternative. Incremental cost is additional spend above that baseline.</small></label>
        </div>}
        <label>Proposed terms source text<textarea value={form.sourceText} onChange={e => change('sourceText', e.target.value)} maxLength={250000} placeholder="Paste the exact proposed changes and any conditions…"/></label>
      </fieldset>
      {reason && <p className="mutation-reason">{reason}</p>}
      {error && <p className="amendment-error" role="alert">{error}</p>}
      {preview && !currentPreview && <p className="mutation-reason" role="status">The workspace, date, or role changed. Preview the proposed terms again before recording.</p>}
      {!currentPreview && <div className="amendment-form-actions"><small>Supplied text is recorded as evidence; its authenticity is not established.</small><button className="button secondary" type="submit" disabled={!!reason}>Preview changed terms<ArrowRight size={14}/></button></div>}
      {currentPreview && <section className="amendment-preview" aria-label="Changed terms preview">
        <h3 ref={previewHeading} tabIndex={-1}><FileText size={17}/>Review the proposed changes</h3>
        <dl>{Object.entries(amendment.patch).map(([key, value]) => <div key={key}><dt>{{promisedCents:'Promise',dueDate:'Due date',claimDeadline:'Claim deadline',conditions:'Conditions'}[key]}</dt><dd><span>{key === 'promisedCents' ? money(commitment[key]) : key === 'conditions' ? commitment.conditions.join('; ') || 'Unconditional' : commitment[key] || 'None'}</span><ArrowRight size={13}/><strong>{key === 'promisedCents' ? money(value) : key === 'conditions' ? value.join('; ') || 'Unconditional' : value || 'None'}</strong></dd></div>)}</dl>
        <p>Effective {amendment.effectiveDate} if accepted. Original terms remain active. Preparing this proposal does not recover money or accept an obligation.</p>
        {currentPreview.plan.previewNotice && <p>{currentPreview.plan.previewNotice}</p>}
        {form.renewal && <p>Baseline {money(action.economics.baselineCostCents)} plus {money(action.economics.incrementalRenewalCostCents)} incremental spend. Contingent net value: {money(action.economics.netIncrementalValueCents)}.</p>}
        {!action.policyDecision.allowed && <div className="amendment-policy"><strong>Acceptance is currently blocked</strong>{action.policyDecision.reasons.map(reason => <p key={reason}>{reason}</p>)}<p>The proposal can be recorded for review; conflicting alternatives must be resolved before approval.</p></div>}
        <div className="amendment-form-actions"><button className="text-button" type="button" onClick={() => setPreview(null)}>Edit proposal</button><button className="button primary" type="button" disabled={!!reason} onClick={record}>Record proposal<ArrowRight size={14}/></button></div>
      </section>}
    </form>
  </details>;
}
