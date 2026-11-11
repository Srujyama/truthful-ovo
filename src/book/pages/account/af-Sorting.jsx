// A note that could belong to more than one promise is sorted out in two steps,
// by two different pens:
//
//   paper    an analyst adds what settles it (a title, the text, the date): one paper on file
//   limits   an approver picks that paper and sets the most each promise may take from the note
//
// After that an analyst can match the note within those amounts, with the usual
// credit form. Both steps are check-then-write through prepareCreditResolution
// (src/credit-resolution.mjs).

import React, { useState } from 'react';
import { prepareCreditResolution } from '../../../credit-resolution.mjs';
import { Field } from '../../shell/parts.jsx';
import { day, dollars, ledger, shortDay, today } from '../../shell/money.mjs';
import { may, whyNot } from '../../shell/roles.mjs';
import { Foot, FormSheet, PaperBlanks, Sum, useCheck } from './af-Form.jsx';
import { paperTitle, plainProblem, typedAmount, typedDollars } from './af-words.mjs';

/** The papers on file that say which promise a company's credit is for, newest first. */
export function settlingPapers(view, credit) {
  return view.sources.filter(source => source.vendorId === credit.vendorId && source.kind === 'allocation_resolution').sort((a, b) => b.revision - a.revision);
}

/** What is matched to one promise from this note right now. */
const matchedTo = (credit, promiseId) => credit.allocations.filter(a => a.commitmentId === promiseId).reduce((n, a) => n + a.activeCents, 0);

export default function Sorting({ view, commitment, credit, service, say, past = false, step, paperId = '', w, rot, onClose, onStep }) {
  const pen = { actor: service.actor };
  const papers = settlingPapers(view, credit);
  const candidates = view.commitments.filter(item => credit.candidateCommitmentIds.includes(item.id));
  const nameOf = promise => (promise.id === commitment.id ? 'this promise' : `the promise of ${dollars(promise.promisedCents)} due ${day(promise.dueDate)}`);
  const cap = text => text[0].toUpperCase() + text.slice(1);

  const [f, setF] = useState(() => ({
    title: '', text: '', date: today(),
    paper: paperId || papers[0]?.id || '',
    limits: Object.fromEntries(candidates.map(promise => {
      const set = credit.resolution?.assignments.find(row => row.commitmentId === promise.id)?.limitCents;
      const cents = set ?? matchedTo(credit, promise.id);
      return [promise.id, cents > 0 ? typedDollars(cents) : ''];
    })),
  }));
  const paper = papers.find(source => source.id === f.paper) || papers[0] || null;
  const fallbackTitle = paperTitle('settle', { number: credit.invoiceId });

  function input() {
    if (step === 'paper') return { operation: 'evidence', creditId: credit.id, sourceTitle: f.title.trim() || fallbackTitle, sourceText: f.text, effectiveDate: f.date };
    return {
      operation: 'resolve', creditId: credit.id, sourceId: paper?.id, effectiveDate: f.date,
      assignments: candidates.map(promise => ({ commitmentId: promise.id, amount: typedAmount(f.limits[promise.id]) })),
    };
  }
  const checked = useCheck({
    service, say, past,
    prepare: () => prepareCreditResolution(service.workspace, input(), { actor: service.actor, now: new Date().toISOString(), readOnly: past }),
    words: error => plainProblem(error, { credit }),
  });
  const set = (key, value) => { setF(old => ({ ...old, [key]: value })); checked.drop(); };

  if (step === 'paper') {
    return (
      <FormSheet
        title={`What settles ${credit.invoiceId}`} kind="SORTING OUT" w={w} rot={rot} onClose={onClose}
        said={`${credit.invoiceId} fits ${candidates.length === 2 ? 'two promises' : `${candidates.length} promises`}. Add what they wrote saying which one it is for.`}
      >
        <form noValidate onSubmit={event => { event.preventDefault(); checked.check(); }}>
          <div className="bk-fields bk-af-blanks">
            <Field label="The date on it" hint="Not later than today.">
              <input type="date" max={today()} value={f.date} onChange={event => set('date', event.target.value)} />
            </Field>
            <PaperBlanks
              title={f.title} text={f.text}
              onTitle={value => set('title', value)} onText={value => set('text', value)}
              titleHolder={fallbackTitle}
              textHint="Paste what they wrote saying which promise the credit is for. It goes on file for an approver."
            />
          </div>
          {checked.plan && (
            <div className="bk-af-check" role="group" aria-label="What it would change">
              <p className="bk-typed bk-af-then">One paper goes on file: “{checked.plan.commands[0].source.title}”, dated {day(f.date)}.</p>
              <p className="bk-typed bk-af-then">The note stays as it is until an approver sets how much each promise may take.</p>
            </div>
          )}
          <Foot
            plan={checked.plan} problem={checked.problem} stale={checked.stale} writing={checked.writing}
            why={whyNot('ADD_SOURCE', pen, { past })}
            onWrite={() => checked.write('Paper on file.', plan => (may('RESOLVE_CREDIT', service.actor?.role) ? onStep('limits', plan.sourceId) : onClose()))}
            onClose={() => onClose()}
          />
        </form>
      </FormSheet>
    );
  }

  const plan = checked.plan;
  const rows = plan ? limitRows(plan, credit, commitment, candidates, nameOf, cap) : [];
  const why = whyNot('RESOLVE_CREDIT', pen, { past }) || (papers.length ? '' : 'Waiting for an analyst to add the paper that settles it.');
  return (
    <FormSheet
      title={`How much each promise may take from ${credit.invoiceId}`} kind="SORTING OUT" w={w} rot={rot} onClose={onClose}
      said={`${credit.invoiceId} is worth ${dollars(credit.availableCents)}. A promise left empty may take nothing from it.`}
    >
      <form noValidate onSubmit={event => { event.preventDefault(); checked.check(); }}>
        <div className="bk-fields bk-af-blanks">
          <Field label="The paper that settles it" className="bk-af-wide" hint={paper ? `On file since ${shortDay(String(paper.observedAt).slice(0, 10))}.` : 'An analyst adds it first.'}>
            <select value={paper?.id || ''} disabled={!papers.length} onChange={event => set('paper', event.target.value)}>
              {!papers.length && <option value="">No paper on file yet</option>}
              {papers.map(source => <option key={source.id} value={source.id}>{source.title}</option>)}
            </select>
          </Field>
          {paper && <blockquote className="bk-typed bk-af-wide bk-af-quote">{paper.text}</blockquote>}
          {candidates.map(promise => (
            <Field key={promise.id} label={`The most ${nameOf(promise)} may take (USD)`} hint={`${dollars(matchedTo(credit, promise.id))} is matched to it now.`}>
              <input inputMode="decimal" autoComplete="off" placeholder="0.00" value={f.limits[promise.id] || ''} onChange={event => set('limits', { ...f.limits, [promise.id]: event.target.value })} />
            </Field>
          ))}
          <Field label="The date it holds from" hint={`Between ${shortDay(credit.issuedDate, view.asOf.slice(0, 4))}, the note’s date, and today.`}>
            <input type="date" min={credit.issuedDate} max={today()} value={f.date} onChange={event => set('date', event.target.value)} />
          </Field>
        </div>
        {plan && (
          <Sum rows={rows}>
            <p className="bk-typed bk-af-then">After this an analyst can match the note, up to those amounts.</p>
          </Sum>
        )}
        <Foot
          plan={plan} problem={checked.problem} stale={checked.stale} writing={checked.writing} why={why}
          onWrite={() => checked.write('Amounts set.', () => onClose())}
          onClose={() => onClose()}
        />
      </form>
    </FormSheet>
  );
}

/** The sum for the second step: what each promise may take, and what that does to this promise's figures. */
function limitRows(plan, credit, commitment, candidates, nameOf, cap) {
  const after = plan.after.credits.find(item => item.id === credit.id);
  const before = plan.before.credits.find(item => item.id === credit.id);
  const limit = (note, id) => {
    const row = note?.resolution?.assignments.find(item => item.commitmentId === id);
    return row ? ledger(row.limitCents) : note?.resolution ? 'nothing' : '—';
  };
  const rows = candidates.map(promise => ({ label: `${cap(nameOf(promise))} may take`, before: limit(before, promise.id), after: limit(after, promise.id) }));
  const was = plan.before.commitments.find(item => item.id === commitment.id);
  const will = plan.after.commitments.find(item => item.id === commitment.id);
  if (was && will) {
    rows.push({ label: 'Credited so far', before: ledger(was.verifiedCents), after: ledger(will.verifiedCents) });
    rows.push({ label: 'Still owed', before: ledger(was.outstandingCents), after: ledger(will.outstandingCents), owed: will.outstandingCents > 0 });
  }
  return rows;
}
