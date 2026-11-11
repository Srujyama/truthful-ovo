// The slip beside the papers: what Truthful found. First the answer in one
// sentence with the real figures, then the reasons (press one and the passages it
// rests on light up on the papers), then what stopped it, then the one thing to
// do next: write it in the book.

import React from 'react';
import { Btn, Paper, Stamp, cx } from '../../shell/parts.jsx';
import { href } from '../../shell/route.mjs';
import { whyNot } from '../../shell/roles.mjs';
import { answer, asides, bookProblem, planSays, reasons, whatStopped } from './plain.mjs';

/** A run of columns with no spaces in it may break after any comma, and still copies as it was typed. */
const atCommas = text => text.split(/(?<=,)(?=\S)/).flatMap((piece, i) => (i ? [<wbr key={i} />, piece] : [piece]));

const STAMPS = { overdue: ['Overdue', 'red'], paid: ['Paid', 'blue'], 'only if': ['Only if', 'blue'] };

/**
 * book: { waits, checking, error, plan, twin } — what the book said when it was asked whether these papers may go in.
 * children: what sits at the foot of the slip (the downloads, when there is no letter to approve first).
 */
export default function Found({ report, lit, pressed, onHover, onPress, book, service, writing, onWrite, onBack, heading, children }) {
  const said = answer(report);
  const why = reasons(report);
  const stopped = whatStopped(report);
  const notes = asides(report);
  const stamp = STAMPS[said.stamp];
  const types = (book.plan?.commands || []).map(command => command.type);
  const already = Boolean(book.plan?.alreadyTracked);
  const blocked = book.waits || (book.error ? bookProblem(book.error) : '') || (!already && types.length ? whyNot(types, service) : '');

  return (
    <Paper as="aside" w={118} rot={0.7} className="bk-form bk-tray-found" aria-label="What Truthful found" data-arrives="9">
      <h2 ref={heading} tabIndex={-1} className="bk-form-title">What Truthful found</h2>
      <div className="bk-tray-said">
        <p className="bk-tray-answer">
          {said.lead}
          {said.owed && <> Still owed: <b className="bk-tray-owed">{said.owed}</b>.</>}
          {said.tail && ` ${said.tail}`}
        </p>
        {stamp && <Stamp small ink={stamp[1]} seed={`found-${report.id}-${said.stamp}`}>{stamp[0]}</Stamp>}
      </div>

      {stopped?.kind === 'unread' && (
        <ul className="bk-tray-stops">
          {stopped.lines.map(line => <li key={line}>{atCommas(line)}</li>)}
        </ul>
      )}

      {why.length > 0 && (
        <>
          <h3 className="bk-label">How it got there</h3>
          <ol className="bk-tray-reasons">
            {why.map(reason => {
              const on = reason.marks.some(id => lit.includes(id));
              const line = <span>{reason.text}{reason.owed && <> <b className="bk-tray-owed">{reason.owed}</b></>}</span>;
              return (
                <li key={reason.key}>
                  {reason.marks.length ? (
                    <button
                      type="button"
                      className={cx('bk-tray-reason', on && 'is-lit')}
                      aria-pressed={pressed === reason.key}
                      onClick={() => onPress(reason)}
                      onMouseEnter={() => onHover(reason.marks)}
                      onMouseLeave={() => onHover(null)}
                      onFocus={() => onHover(reason.marks)}
                      onBlur={() => onHover(null)}
                    >{line}</button>
                  ) : <div className="bk-tray-reason">{line}</div>}
                </li>
              );
            })}
          </ol>
        </>
      )}
      {notes.map(note => <p key={note} className="bk-tray-aside">{note}</p>)}

      {stopped && stopped.kind !== 'unread' && (
        <div className="bk-tray-stop">
          <p className="bk-hand">{stopped.said}</p>
          {stopped.quote && <blockquote>“{stopped.quote}”</blockquote>}
        </div>
      )}

      {stopped?.kind !== 'unread' && (
        <div className="bk-tray-book">
          {already && <p className="bk-hand">This one is already in the book.</p>}
          <div className="bk-actions">
            {already
              ? <Btn big onClick={onWrite}>Open its page</Btn>
              : <Btn big onClick={onWrite} why={blocked} busy={writing ? 'Writing it in…' : book.checking ? 'Asking the book…' : ''}>Write it in the book</Btn>}
            {book.twin && book.error && <a className="bk-link" href={href('iou', book.twin)}>Open its page</a>}
          </div>
          {!already && !blocked && !book.checking && <p className="bk-tray-goes">{planSays(book.plan, report)}</p>}
        </div>
      )}

      <div className="bk-actions bk-tray-foot">
        {stopped?.kind === 'unread'
          ? <Btn big onClick={onBack}>← Back to the tray</Btn>
          : <button type="button" className="bk-link" onClick={onBack}>← Back to the tray</button>}
        {children}
      </div>
    </Paper>
  );
}
