// The foot of the account sheet: one row of typed links, each opening its form
// in place. Closed is how it rests.
//
//   Write in a credit        the credit form (CreditForm from ./CreditSlips.jsx, job 'register')
//   They changed the terms   the form in this file: a new offer, and the decision on it
//   A paper was replaced     ./NewerCopy.jsx
//
// Mounted by ../Account.jsx as <ChangedTerms view commitment service say go past />.
// Which form is out is kept in ./af-open.mjs and shared with the credit slips, so
// opening one puts the others away.
//
// "They changed the terms" is check-then-write through prepareAmendmentWorkflow
// (src/amendment-workflow.mjs): the paper, the offer and the decision on it go in
// as one stroke, and the page then turns to that decision.

import React, { useState } from 'react';
import { prepareAmendmentWorkflow } from '../../../amendment-workflow.mjs';
import { Field, Why } from '../../shell/parts.jsx';
import { day, dollars, ledger, today } from '../../shell/money.mjs';
import { whyNot } from '../../shell/roles.mjs';
import { plainReasons } from './acct-words.mjs';
import { useOpenForm } from './af-open.mjs';
import { Foot, FormSheet, PaperBlanks, Sum, useCheck } from './af-Form.jsx';
import { bareAmount, plainProblem, typedDollars } from './af-words.mjs';
import { CreditForm } from './CreditSlips.jsx';
import NewerCopy from './NewerCopy.jsx';
import './forms.css';

const WIDTH = 236;      // the decision slip's width, so a form sits square under it

export default function ChangedTerms({ view, commitment, service, say, go, past = false }) {
  const [open, show, close] = useOpenForm(commitment?.id || '');
  if (!view || !commitment) return null;

  const pen = { actor: service.actor };
  const why = whyNot(['REGISTER_CREDIT', 'PROPOSE_AMENDMENT', 'REVISE_SOURCE'], pen, { past });   // all three wait on the same pen
  const out = open?.kind === 'credit' && open.job === 'register' ? 'credit' : open?.kind === 'terms' || open?.kind === 'copy' ? open.kind : '';
  const link = (name, form) => ({
    type: 'button',
    className: 'bk-link',
    disabled: Boolean(why),
    'aria-expanded': out === name,
    onClick: () => show(form),
  });

  return (
    <section className="bk-part bk-af-foot" aria-label="Something changed">
      <div className="bk-af-row">
        <button {...link('credit', { kind: 'credit', job: 'register' })}>Write in a credit</button>
        <i aria-hidden="true">·</i>
        <button {...link('terms', { kind: 'terms' })}>They changed the terms</button>
        <i aria-hidden="true">·</i>
        <button {...link('copy', { kind: 'copy' })}>A paper was replaced</button>
      </div>
      <Why>{why}</Why>

      {out === 'credit' && (
        <CreditForm
          key={`credit:${commitment.id}`}
          view={view} commitment={commitment} service={service} say={say} past={past}
          job="register" w={WIDTH} onClose={() => close()}
        />
      )}
      {out === 'terms' && (
        <TermsForm
          key={`terms:${commitment.id}`}
          view={view} commitment={commitment} service={service} say={say} past={past}
          onClose={() => close()}
          onWritten={plan => { close({ refocus: false }); go('iou', commitment.id, { a: plan.actionId }); }}
        />
      )}
      {out === 'copy' && (
        <NewerCopy
          key={`copy:${commitment.id}`}
          view={view} commitment={commitment} service={service} say={say} past={past}
          w={WIDTH} onClose={() => close()}
        />
      )}
    </section>
  );
}

// ---- they changed the terms ----

const CHANGES = [
  ['promisedCents', 'The amount'],
  ['dueDate', 'The due date'],
  ['claimDeadline', 'The last day to claim'],
  ['conditions', 'Strings attached'],
];
const strings = list => (list?.length ? list.map(line => `“${String(line).trim().replace(/[.\s]+$/, '')}.”`).join(' ') : 'none');

function TermsForm({ view, commitment, service, say, past, onClose, onWritten }) {
  const company = view.vendors.find(vendor => vendor.id === commitment.vendorId)?.name || 'them';
  const [f, setF] = useState(() => ({
    changes: { promisedCents: false, dueDate: false, claimDeadline: false, conditions: false },
    amount: typedDollars(commitment.promisedCents),
    dueDate: commitment.dueDate,
    claimDeadline: commitment.claimDeadline || '',
    conditions: commitment.conditions.join('\n'),
    date: today(),
    renewal: false, payNow: '', extra: '', against: '',
    title: '', text: '',
  }));
  const fallbackTitle = `Changed terms from ${company}`;
  const input = () => ({
    commitmentId: commitment.id,
    changes: f.changes,
    promisedAmount: bareAmount(f.amount), dueDate: f.dueDate, claimDeadline: f.claimDeadline, conditions: f.conditions,
    effectiveDate: f.date,
    renewal: f.renewal, baselineAmount: bareAmount(f.payNow), incrementalAmount: bareAmount(f.extra), baselineDescription: f.against,
    sourceTitle: f.title.trim() || fallbackTitle, sourceText: f.text,
  });
  const checked = useCheck({
    service, say, past,
    prepare: () => {
      const plan = prepareAmendmentWorkflow(service.workspace, input(), { actor: service.actor, now: new Date().toISOString(), readOnly: past });
      // The paper and the offer are entered on the reader's own day. Left unsaid, the engine dates them by its UTC day, which is tomorrow on an American evening.
      return { ...plan, commands: plan.commands.map(command => ({ ...command, effectiveDate: today() })) };
    },
    words: error => plainProblem(error),
  });
  const set = (key, value) => { setF(old => ({ ...old, [key]: value })); checked.drop(); };
  const tick = (key, on) => set('changes', { ...f.changes, [key]: on });
  const why = whyNot(['ADD_SOURCE', 'PROPOSE_AMENDMENT', 'PROPOSE_ACTION'], { actor: service.actor }, { past });

  return (
    <FormSheet
      title="They changed the terms" kind="OFFER" w={WIDTH} onClose={onClose}
      said={`What ${company} wants to change about this promise. It goes in as an offer, with a decision for an approver.`}
    >
      <form noValidate onSubmit={event => { event.preventDefault(); checked.check(); }}>
        <fieldset className="bk-af-kind">
          <legend className="bk-label">What they changed</legend>
          {CHANGES.map(([key, label]) => (
            <label key={key} className="bk-check">
              <input type="checkbox" checked={f.changes[key]} onChange={event => tick(key, event.target.checked)} />
              {label}
            </label>
          ))}
        </fieldset>

        <div className="bk-fields bk-af-blanks">
          {f.changes.promisedCents && (
            <Field label="The new amount (USD)" hint={`It is ${dollars(commitment.promisedCents)} now.`}>
              <input inputMode="decimal" autoComplete="off" value={f.amount} onChange={event => set('amount', event.target.value)} />
            </Field>
          )}
          {f.changes.dueDate && (
            <Field label="The new due date" hint={`It is ${day(commitment.dueDate)} now.`}>
              <input type="date" value={f.dueDate} onChange={event => set('dueDate', event.target.value)} />
            </Field>
          )}
          {f.changes.claimDeadline && (
            <Field label="The new last day to claim" hint={commitment.claimDeadline ? `It is ${day(commitment.claimDeadline)} now. Leave it empty if there is no last day any more.` : 'There is none now.'}>
              <input type="date" value={f.claimDeadline} onChange={event => set('claimDeadline', event.target.value)} />
            </Field>
          )}
          <Field label="The date it takes effect" hint="If you take it. It may be a day that has not come yet.">
            <input type="date" value={f.date} onChange={event => set('date', event.target.value)} />
          </Field>
          {f.changes.conditions && (
            <Field label="The strings, one to a line" className="bk-af-wide" hint="Leave it empty if they dropped every string.">
              <textarea rows={3} maxLength={21000} value={f.conditions} onChange={event => set('conditions', event.target.value)} />
            </Field>
          )}
        </div>

        <label className="bk-check bk-af-renewal">
          <input type="checkbox" checked={f.renewal} onChange={event => set('renewal', event.target.checked)} />
          It comes with a renewal
        </label>
        {f.renewal && (
          <div className="bk-fields bk-af-blanks">
            <Field label="What you pay now (USD)" hint="For the same stretch of time.">
              <input inputMode="decimal" autoComplete="off" placeholder="0.00" value={f.payNow} onChange={event => set('payNow', event.target.value)} />
            </Field>
            <Field label="The extra it would cost (USD)" hint="On top of what you pay now.">
              <input inputMode="decimal" autoComplete="off" placeholder="0.00" value={f.extra} onChange={event => set('extra', event.target.value)} />
            </Field>
            <Field label="What the extra is measured against" className="bk-af-wide" hint="One line. For example: the same plan for 12 months at $6,000 a month.">
              <input maxLength={2000} value={f.against} onChange={event => set('against', event.target.value)} />
            </Field>
          </div>
        )}

        <div className="bk-fields bk-af-blanks">
          <PaperBlanks
            title={f.title} text={f.text}
            onTitle={value => set('title', value)} onText={value => set('text', value)}
            titleHolder={fallbackTitle}
            textHint="Paste what they wrote. It is kept as the paper behind the offer."
          />
        </div>

        {checked.plan && <TermsSum plan={checked.plan} view={view} commitment={commitment} />}
        <Foot
          plan={checked.plan} problem={checked.problem} stale={checked.stale} why={why} writing={checked.writing}
          onWrite={() => checked.write('Offer written in. It changes nothing until it is approved.', plan => onWritten(plan))}
          onClose={() => onClose()}
        />
      </form>
    </FormSheet>
  );
}

/** The promise as it stands and as it would stand if the offer were taken, and what the offer leaves alone. */
function TermsSum({ plan, view, commitment }) {
  const offer = plan.after.amendments.find(item => item.id === plan.amendmentId);
  const action = plan.after.actions.find(item => item.id === plan.actionId);
  const was = plan.before.commitments.find(item => item.id === commitment.id);
  const changed = Object.keys(offer.patch).filter(key => !plan.retainedFields.includes(key));
  const rows = [
    changed.includes('promisedCents') && { label: 'They promised', before: ledger(was.promisedCents), after: ledger(offer.patch.promisedCents) },
    changed.includes('dueDate') && { label: 'Due', before: day(was.dueDate), after: day(offer.patch.dueDate) },
    changed.includes('claimDeadline') && { label: 'Last day to claim', before: was.claimDeadline ? day(was.claimDeadline) : 'none', after: offer.patch.claimDeadline ? day(offer.patch.claimDeadline) : 'none' },
    changed.includes('conditions') && { label: 'Strings attached', before: strings(was.conditions), after: strings(offer.patch.conditions) },
  ];
  const stays = [
    !changed.includes('promisedCents') && `the amount, ${dollars(was.promisedCents)}`,
    !changed.includes('dueDate') && `the due date, ${day(was.dueDate)}`,
    !changed.includes('claimDeadline') && was.claimDeadline && `the last day to claim, ${day(was.claimDeadline)}`,
    !changed.includes('conditions') && was.conditions.length > 0 && 'the strings attached',
  ].filter(Boolean);

  const sums = action?.economics;
  const extra = sums?.incrementalRenewalCostCents || 0;
  const cost = extra - (sums?.creditCents || 0);
  const stopped = action ? plainReasons(action, { policy: plan.after.policy, asOf: view.asOf }) : [];

  return (
    <Sum rows={rows} heads={['Now', 'If you take it']} words>
      {stays.length > 0 && <p className="bk-typed bk-af-then">Stays as it was: {stays.join('; ')}.</p>}
      {offer.newCommitment && (
        <p className="bk-typed bk-af-then">
          The renewal is {dollars(extra)} of extra spending for a {dollars(sums.creditCents)} credit.{' '}
          {cost > 0 ? `That costs you ${dollars(cost)}.` : cost < 0 ? `That leaves you ${dollars(-cost)} ahead.` : 'The credit pays for the extra spending.'}
        </p>
      )}
      <p className="bk-typed bk-af-then">It takes effect {day(offer.effectiveDate)} if you take it. It changes nothing until it is approved.</p>
      {stopped.length > 0 && (
        <div className="bk-af-stopped">
          <p className="bk-label">As the book stands, nobody can approve it</p>
          <ul>{stopped.map(reason => <li key={reason}>{reason}</li>)}</ul>
        </div>
      )}
    </Sum>
  );
}
