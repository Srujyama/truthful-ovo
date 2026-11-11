// The one form every credit entry on a promise goes through. Its title and its
// blanks follow the job:
//
//   register   a credit that is not in the book yet: a note they issued, or a credit already on an invoice
//   apply      the invoice that shows a note (the note counts from then on)
//   allocate   match a credit, or part of one, to this promise
//   reverse    they took some of it back
//
// Check it runs prepareCreditWorkflow (src/credit-workflow.mjs), which builds the
// commands and the book as it would stand after them, and writes nothing. The sum
// under the blanks is read off that. Write it in sends exactly those commands.

import React, { useId, useState } from 'react';
import { prepareCreditWorkflow } from '../../../credit-workflow.mjs';
import { Field } from '../../shell/parts.jsx';
import { day, dollars, ledger, shortDay, today } from '../../shell/money.mjs';
import { whyNot } from '../../shell/roles.mjs';
import { Foot, FormSheet, PaperBlanks, Sum, useCheck } from './af-Form.jsx';
import { centsTyped, paperTitle, plainProblem, typedAmount, typedDollars } from './af-words.mjs';

const COMMAND = { register: 'REGISTER_CREDIT', apply: 'APPLY_CREDIT', allocate: 'ALLOCATE_CREDIT', reverse: 'REVERSE_CREDIT' };
const KIND = { register: 'CREDIT', apply: 'INVOICE', allocate: 'MATCH', reverse: 'TAKEN BACK' };
const DONE = { register: 'Credit written in.', apply: 'Invoice added.', allocate: 'Matched to this promise.', reverse: 'Taken back.' };
const PASTE = {
  register: 'Paste the line from the invoice or the note. It is kept as the paper behind this entry.',
  apply: 'Paste the line of the invoice that shows it. It is kept as the paper behind this entry.',
  allocate: 'Paste what says this credit is for this promise. It is kept as the paper behind this entry.',
  reverse: 'Paste what they wrote when they took it back. It is kept as the paper behind this entry.',
};

/** job: 'register' | 'apply' | 'allocate' | 'reverse'. credit: the note the job is done to (none for register). */
export default function CreditForm({ view, commitment, service, say, past = false, job, credit = null, w, rot, onClose, onDone }) {
  const kindName = useId();
  const [f, setF] = useState(() => ({
    status: 'issued', number: '', line: '', match: '', takes: {}, title: '', text: '',
    amount: job === 'allocate' ? typedDollars(credit.unallocatedCents) : '',
    date: today(),
  }));
  const company = view.vendors.find(vendor => vendor.id === commitment.vendorId)?.name || 'their';
  const promiseName = id => {
    if (id === commitment.id) return 'this promise';
    const other = view.commitments.find(item => item.id === id);
    return other ? `the promise of ${dollars(other.promisedCents)} due ${day(other.dueDate)}` : 'another promise';
  };

  // A take-back comes off the part that is not matched first; the rest has to come off the matches.
  const matches = job === 'reverse' ? credit.allocations.filter(a => a.activeCents > 0) : [];
  const takenCents = job === 'reverse' ? centsTyped(f.amount) : null;
  const neededCents = takenCents == null ? 0 : Math.max(0, takenCents - credit.unallocatedCents);
  function takes() {
    if (matches.length === 1) return neededCents > 0 ? [{ allocationId: matches[0].id, amount: typedDollars(neededCents) }] : [];
    return matches.map(a => ({ allocationId: a.id, amount: typedAmount(f.takes[a.id]) }));
  }

  const number = job === 'register' ? f.number.trim() : credit.invoiceId;
  const fallbackTitle = paperTitle(job, { number, kind: f.status });
  function input() {
    const base = {
      operation: job, commitmentId: commitment.id, creditId: credit?.id, effectiveDate: f.date,
      sourceTitle: f.title.trim() || fallbackTitle, sourceText: f.text,
    };
    if (job === 'register') return { ...base, status: f.status, invoiceId: f.number, lineId: f.line.trim() || f.number, amount: typedAmount(f.amount), allocationAmount: typedAmount(f.match) };
    if (job === 'allocate') return { ...base, amount: typedAmount(f.amount) };
    if (job === 'reverse') return { ...base, amount: typedAmount(f.amount), allocationReversals: takes() };
    return base;
  }

  const checked = useCheck({
    service, say, past,
    prepare: () => prepareCreditWorkflow(service.workspace, input(), { actor: service.actor, now: new Date().toISOString(), readOnly: past }),
    words: error => plainProblem(error, { credit, neededCents: job === 'reverse' ? neededCents : null, noteCents: job === 'register' ? centsTyped(f.amount) : null }),
  });
  const set = (key, value) => { setF(old => ({ ...old, [key]: value })); checked.drop(); };
  const why = whyNot(['ADD_SOURCE', COMMAND[job]], { actor: service.actor }, { past });

  const title = job === 'register' ? 'Write in a credit'
    : job === 'apply' ? `The invoice that shows ${credit.invoiceId}`
    : job === 'allocate' ? `Match ${credit.invoiceId} to this promise`
    : `Money taken back from ${credit.invoiceId}`;
  const said = job === 'register' ? `It goes in under ${commitment.reference}, ${company}’s reference for this promise.`
    : job === 'apply' ? `${credit.invoiceId} is a note for ${dollars(credit.availableCents)}. It counts once an invoice shows it.`
    : job === 'allocate' ? `${dollars(credit.unallocatedCents)} of it is not matched to a promise yet.`
    : `${credit.invoiceId} is worth ${dollars(credit.availableCents)} now, and ${dollars(credit.allocatedCents)} of that is matched.`;

  return (
    <FormSheet title={title} kind={KIND[job]} said={said} w={w} rot={rot} onClose={onClose}>
      <form noValidate onSubmit={event => { event.preventDefault(); checked.check(); }}>
        {job === 'register' && (
          <fieldset className="bk-af-kind">
            <legend className="bk-label">What it is</legend>
            <label className="bk-check">
              <input type="radio" name={kindName} checked={f.status === 'issued'} onChange={() => set('status', 'issued')} />
              A note they issued
            </label>
            <label className="bk-check">
              <input type="radio" name={kindName} checked={f.status === 'applied'} onChange={() => set('status', 'applied')} />
              A credit already on an invoice
            </label>
          </fieldset>
        )}

        <div className="bk-fields bk-af-blanks">
          {job === 'register' && (
            <>
              <Field label={f.status === 'applied' ? 'The invoice’s number' : 'The note’s number'} hint="As their paper prints it.">
                <input value={f.number} maxLength={200} autoComplete="off" spellCheck={false} onChange={event => set('number', event.target.value)} />
              </Field>
              <Field label="The line’s own reference" hint="Leave it empty when the paper has one credit line.">
                <input value={f.line} maxLength={200} autoComplete="off" spellCheck={false} onChange={event => set('line', event.target.value)} />
              </Field>
            </>
          )}
          {job !== 'apply' && (
            <Field
              label={job === 'register' ? 'The amount (USD)' : job === 'allocate' ? 'How much to match (USD)' : 'How much they took back (USD)'}
              hint={job === 'allocate' ? `${dollars(commitment.outstandingCents)} is still owed on this promise.` : undefined}
            >
              <input inputMode="decimal" autoComplete="off" placeholder="0.00" value={f.amount} onChange={event => set('amount', event.target.value)} />
            </Field>
          )}
          <Field
            label={job === 'apply' ? 'The invoice’s date' : job === 'reverse' ? 'The date they took it back' : 'The date it took effect'}
            hint={job === 'apply' ? `Between ${shortDay(credit.issuedDate, view.asOf.slice(0, 4))}, the note’s date, and today.` : 'Not later than today.'}
          >
            <input type="date" max={today()} min={job === 'apply' ? credit.issuedDate : undefined} value={f.date} onChange={event => set('date', event.target.value)} />
          </Field>
          {job === 'register' && (
            <Field label="Match right away (USD)" hint={`To this promise, which is still owed ${dollars(commitment.outstandingCents)}. Leave it empty to match it later.`}>
              <input inputMode="decimal" autoComplete="off" placeholder="0.00" value={f.match} onChange={event => set('match', event.target.value)} />
            </Field>
          )}
          {matches.length > 1 && matches.map(a => (
            <Field key={a.id} label={`Take from ${promiseName(a.commitmentId)} (USD)`} hint={`${dollars(a.activeCents)} is matched there.`}>
              <input inputMode="decimal" autoComplete="off" placeholder="0.00" value={f.takes[a.id] || ''} onChange={event => set('takes', { ...f.takes, [a.id]: event.target.value })} />
            </Field>
          ))}
          {job === 'reverse' && takenCents > 0 && (
            <p className="bk-typed bk-af-wide bk-af-aside">
              {neededCents === 0
                ? 'It all comes off the part that is not matched yet.'
                : matches.length === 1
                  ? `${dollars(neededCents)} of it comes off what is matched to ${promiseName(matches[0].commitmentId)}.`
                  : `The part that is not matched goes first. ${dollars(neededCents)} has to come off the matches.`}
            </p>
          )}
          <PaperBlanks
            title={f.title} text={f.text}
            onTitle={value => set('title', value)} onText={value => set('text', value)}
            titleHolder={fallbackTitle} textHint={PASTE[job]} beside={job === 'apply'}
          />
        </div>

        {checked.plan && <CreditSum plan={checked.plan} view={view} commitment={commitment} job={job} promiseName={promiseName} />}
        <Foot
          plan={checked.plan} problem={checked.problem} stale={checked.stale} why={why} writing={checked.writing}
          onWrite={() => checked.write(DONE[job], plan => { onDone?.(job, plan); onClose({ written: true }); })}
          onClose={() => onClose()}
        />
      </form>
    </FormSheet>
  );
}

/** What the plan would change: this promise's two figures, the note's, and any other promise it touches. */
function CreditSum({ plan, view, commitment, job, promiseName }) {
  const mine = plan.effects.affectedCommitments.find(item => item.id === commitment.id);
  const was = plan.before.credits.find(item => item.id === plan.creditId) || null;
  const will = plan.after.credits.find(item => item.id === plan.creditId);
  const rows = [
    { label: 'Credited so far', before: ledger(mine.beforeVerifiedCents), after: ledger(mine.afterVerifiedCents) },
    { label: 'Still owed', before: ledger(mine.beforeOutstandingCents), after: ledger(mine.afterOutstandingCents), owed: mine.afterOutstandingCents > 0 },
  ];
  if (!was || was.availableCents !== will.availableCents) {
    rows.push({ label: `${will.invoiceId} is worth`, before: was ? ledger(was.availableCents) : '—', after: ledger(will.availableCents) });
  }
  rows.push({ label: `Left on ${will.invoiceId} to match`, before: was ? ledger(was.unallocatedCents) : '—', after: ledger(will.unallocatedCents) });
  for (const other of plan.effects.affectedCommitments) {
    if (other.id === commitment.id) continue;
    rows.push({ label: `Still owed on ${promiseName(other.id)}`, before: ledger(other.beforeOutstandingCents), after: ledger(other.afterOutstandingCents), owed: other.afterOutstandingCents > 0 });
  }

  const lines = [];
  if (will.quarantined) lines.push('It could belong to more than one promise. None of it counts until an approver says which.');
  else if (will.status === 'issued' && job !== 'reverse') lines.push('It stays a note. A note is not money until it shows on an invoice.');
  if (mine.beforeOutstandingCents > 0 && mine.afterOutstandingCents === 0) lines.push('That pays this promise in full.');
  const open = view.actions.some(action => action.commitmentId === commitment.id && !action.executed && !(action.proposalStale || action.approvalStale));
  if (open) lines.push('The decision prepared on this promise will have to be prepared again.');

  return (
    <Sum rows={rows}>
      {lines.map(line => <p key={line} className="bk-typed bk-af-then">{line}</p>)}
    </Sum>
  );
}
