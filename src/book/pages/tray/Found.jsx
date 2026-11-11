// The box beside what was read: what stopped the reading, if anything, then the
// one thing to do next: write it in the book. When the papers could not be read
// at all, it says what to fix instead. The answer itself is the page's headline
// and the reasons are the rows (./Rows.jsx); this box is where they lead.

import React from 'react';
import { Btn, Paper } from '../../shell/parts.jsx';
import { href } from '../../shell/route.mjs';
import { whyNot } from '../../shell/roles.mjs';
import { asides, bookProblem, planSays, whatStopped } from './plain.mjs';

/** A run of columns with no spaces in it may break after any comma, and still copies as it was typed. */
const atCommas = text => text.split(/(?<=,)(?=\S)/).flatMap((piece, i) => (i ? [<wbr key={i} />, piece] : [piece]));

/**
 * book: { waits, checking, error, plan, twin } — what the book said when it was asked whether these papers may go in.
 * children: what sits at the foot of the box (the downloads, when there is no letter to approve first).
 */
export default function Found({ report, book, service, writing, onWrite, onBack, heading, children }) {
  const stopped = whatStopped(report);
  const notes = asides(report);
  const types = (book.plan?.commands || []).map(command => command.type);
  const already = Boolean(book.plan?.alreadyTracked);
  const blocked = book.waits || (book.error ? bookProblem(book.error) : '') || (!already && types.length ? whyNot(types, service) : '');
  const unread = stopped?.kind === 'unread';
  const title = unread ? 'Truthful couldn’t count this one.'
    : already ? 'This one is already in the book.'
    : stopped ? (stopped.kind === 'look' ? 'It waits on a person.' : 'It waits on a decision.')
    : 'Ready for the book.';

  return (
    <Paper as="aside" className="bk-form bk-tray-found" aria-label={unread ? 'What to fix' : 'Into the book'}>
      <span className="bk-tray-name" aria-hidden="true">{unread ? 'what to fix' : 'into the book'}</span>
      <h2 ref={heading} tabIndex={-1} className="bk-tray-found-h">{title}</h2>

      {unread && (
        <ul className="bk-tray-stops">
          {stopped.lines.map(line => <li key={line}>{atCommas(line)}</li>)}
        </ul>
      )}

      {stopped && !unread && (
        <div className="bk-tray-stop">
          <p>{stopped.said}</p>
          {stopped.quote && <blockquote>“{stopped.quote}”</blockquote>}
        </div>
      )}
      {notes.map(note => <p key={note} className="bk-tray-aside">{note}</p>)}

      {!unread && (
        <div className="bk-tray-book">
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
        {unread
          ? <Btn big onClick={onBack}>← Back to the tray</Btn>
          : <button type="button" className="bk-link" onClick={onBack}>← Back to the tray</button>}
        {children}
      </div>
    </Paper>
  );
}
