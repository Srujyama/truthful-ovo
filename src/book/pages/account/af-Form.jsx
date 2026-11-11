// What the account page's forms share: the sheet of bond a form is printed on,
// the check that comes before every write, the small ruled sum that shows what
// the write would change, the two blanks for the paper behind an entry, and the
// foot with its one button.
//
// Every write on these forms is check-then-write. The pure function builds the
// plan (the commands and the book before and after them); the person reads the
// sum; only then is the plan sent. A check is thrown away the moment the book,
// the pen or the day changes, so nobody writes in something they checked
// against a different book.

import React, { useEffect, useRef, useState } from 'react';
import { reducedMotion } from '../../kit/paper.js';
import { Btn, Field, Paper, cx } from '../../shell/parts.jsx';
import { today } from '../../shell/money.mjs';
import { plainError } from '../../shell/roles.mjs';

/** The form itself: a white box with the kind of form set in its top edge, then a title. Escape puts it away. */
export function FormSheet({ title, kind, said, onClose, className, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const sheet = ref.current;
    if (!sheet) return;
    sheet.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
    sheet.querySelector('.bk-form-title')?.focus({ preventScroll: true });
  }, []);
  function onKeyDown(event) {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    event.preventDefault();
    event.stopPropagation();
    onClose();
  }
  return (
    <Paper ref={ref} as="section" className={cx('bk-form bk-af-form bk-arrive', className)} aria-label={title} onKeyDown={onKeyDown}>
      <span className="bk-af-name" aria-hidden="true">{String(kind || '').toLowerCase()}</span>
      <h3 className="bk-form-title" tabIndex={-1}>{title}</h3>
      {said && <p className="bk-af-said">{said}</p>}
      {children}
    </Paper>
  );
}

/**
 * Check, then write.
 *   const { plan, problem, stale, writing, check, write, drop } = useCheck({ service, say, past, prepare, words });
 * prepare()  runs the pure function and returns its plan, or throws with the reason.
 * words(e)   says that reason to a person.
 * check()    keeps the plan for the book, the pen and the day it was made on.
 * write()    runs the check once more against the book as it is this second, then sends the plan.
 * drop()     throws the check away (a blank was changed).
 */
export function useCheck({ service, say, past, prepare, words }) {
  const [held, setHeld] = useState(null);
  const [problem, setProblem] = useState('');
  const [writing, setWriting] = useState(false);
  const sending = useRef(false);
  const actor = service.actor || {};

  useEffect(() => { setHeld(null); }, [service.workspace, actor.id, actor.role, past]);
  const fresh = held && held.workspace === service.workspace && held.actorId === actor.id && held.role === actor.role && held.date === today() && !past;
  const plan = fresh ? held.plan : null;

  function drop() {
    if (held) setHeld(null);
    if (problem) setProblem('');
  }
  function check() {
    try {
      const next = prepare();
      setHeld({ plan: next, workspace: service.workspace, actorId: actor.id, role: actor.role, date: today() });
      setProblem('');
      return next;
    } catch (error) {
      setHeld(null);
      setProblem(words(error));
      return null;
    }
  }
  async function write(done, then) {
    if (!plan || sending.current) return;
    sending.current = true;
    setWriting(true);
    try {
      prepare();
      const reply = await service.commands(plan.commands);
      if (reply) { say(done); then?.(plan, reply); }
    } catch (error) {
      const raw = String(error?.message || error || '');
      const said = words(error);
      const text = said !== raw ? said : plainError(error?.code ? `${error.code}: ${raw}` : error) || raw;
      setHeld(null);
      setProblem(text);
      say(text, { wrong: true });
      service.setError?.('');
    } finally {
      sending.current = false;
      setWriting(false);
    }
  }
  return { plan, problem, stale: Boolean(held) && !fresh, writing, check, write, drop };
}

/**
 * What the write would change, as a small ruled sum.
 * rows: [{ label, before, after, owed }]. `owed` prints the figure after in red (money still owed).
 * words: the sum holds dates and sentences as well as figures, so its columns are set as text and may run over a line.
 */
export function Sum({ rows, heads = ['Now', 'After'], words = false, children }) {
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus({ preventScroll: true }); }, []);
  const lines = rows.filter(Boolean);
  return (
    <div ref={ref} className="bk-af-check" tabIndex={-1} role="group" aria-label="What it would change">
      {lines.length > 0 && <div className={cx('bk-af-sum', words && 'is-words')} role="table">
        <div className="bk-af-sum-head" role="row">
          <span role="columnheader" />
          <span role="columnheader">{heads[0]}</span>
          <span role="columnheader" aria-hidden="true" />
          <span role="columnheader">{heads[1]}</span>
        </div>
        {lines.map(row => (
          <div key={row.label} className="bk-af-sum-row" role="row">
            <span role="rowheader">{row.label}</span>
            <span role="cell" className="is-before">{row.before}</span>
            <span role="cell" className="is-to" aria-hidden="true">→</span>
            <span role="cell" className={cx('is-after', row.owed && 'is-owed')}>{row.after}</span>
          </div>
        ))}
      </div>}
      {children}
    </div>
  );
}

/** The paper behind an entry: its title (optional) and its text (always). beside: the title shares a line with the blank before it. */
export function PaperBlanks({ title, text, onTitle, onText, titleHolder, textHint, textHolder, beside = false }) {
  return (
    <>
      <Field label="The paper’s title" className={beside ? 'bk-af-rest' : 'bk-af-wide'}>
        <input value={title} maxLength={200} autoComplete="off" placeholder={titleHolder} onChange={event => onTitle(event.target.value)} />
      </Field>
      <Field label="The paper’s text" hint={textHint} className="bk-af-wide">
        <textarea rows={4} value={text} maxLength={250000} placeholder={textHolder} onChange={event => onText(event.target.value)} />
      </Field>
    </>
  );
}

/**
 * The foot of a form: the problem, if the check found one, then the one button.
 * Before a check it is Check it (the form's submit); after one it is Write it in.
 */
export function Foot({ plan, problem, stale, why, writing, onWrite, onClose, writeLabel = 'Write it in', writingLabel = 'Writing it in…', checkLabel = 'Check it' }) {
  return (
    <>
      {problem && <p className="bk-af-problem" role="alert">{problem}</p>}
      {stale && !problem && <p className="bk-af-problem" role="status">The book changed since you checked this. Check it again.</p>}
      <div className="bk-actions bk-af-footline">
        {plan
          ? <Btn onClick={onWrite} why={why} busy={writing ? writingLabel : ''}>{writeLabel}</Btn>
          : <Btn as="button" type="submit" why={why}>{checkLabel}</Btn>}
        <button type="button" className="bk-link" onClick={onClose}>Put it away <kbd>esc</kbd></button>
      </div>
    </>
  );
}
