// What Claude found in the papers, one line per figure. Each figure was checked on
// the server: its quote is in the paper word for word and the amount is in the
// quote. Hovering a line lights the same passage in the papers below.

import React from 'react';
import { cx } from '../../shell/parts.jsx';
import { day, dollars } from '../../shell/money.mjs';
import { claudeFigures, claudeLeftOut } from './claude.mjs';

const NOUN = { promise: 'promised', offer: 'offered, with strings', credit: 'credited' };
const PAPER = { promise: 'the promise', invoice: 'the invoices', reply: 'their reply' };

export default function ByClaude({ reading, lit, onHover }) {
  const figures = claudeFigures(reading);
  const leftOut = claudeLeftOut(reading);
  const failed = (reading?.papers || []).filter(p => p.error);
  return (
    <section className="bk-tray-papers bk-tray-claude" aria-labelledby="bk-tray-claude-h">
      <h2 className="bk-h2" id="bk-tray-claude-h">What Claude found <small>each figure is in the papers word for word</small></h2>
      {figures.length === 0 && failed.length === 0 && <p className="bk-tray-claude-none">Claude found no credits in these papers.</p>}
      {figures.length > 0 && (
        <ul className="bk-tray-claude-list">
          {figures.map(f => (
            <li
              key={f.id}
              className={cx('bk-tray-claude-fig', lit.includes(f.id) && 'is-lit')}
              onMouseEnter={() => onHover([f.id])}
              onMouseLeave={() => onHover(null)}
            >
              <span className="bk-tray-claude-sum">{dollars(f.amountCents)}</span>
              <span className="bk-tray-claude-what">
                {NOUN[f.kind]}
                {f.dueDate && <> · due {day(f.dueDate)}</>}
                {(f.reference || f.invoiceId) && <> · {[f.invoiceId, f.reference].filter(Boolean).join(' · ')}</>}
                {f.conditions?.length > 0 && <> · if {f.conditions.join('; ').replace(/^./, c => c.toLowerCase())}</>}
              </span>
              <q className="bk-tray-claude-quote"><mark className={cx('bk-hl', lit.includes(f.id) && 'is-lit')}>{f.quote}</mark></q>
            </li>
          ))}
        </ul>
      )}
      {leftOut.length > 0 && (
        <details className="bk-tray-claude-out">
          <summary>{leftOut.length === 1 ? 'One figure Claude gave isn’t in the papers, so it was left out.' : `${leftOut.length} figures Claude gave aren’t in the papers, so they were left out.`}</summary>
          <ul>{leftOut.map((r, i) => <li key={i}>{PAPER[r.source]}: {r.reason}</li>)}</ul>
        </details>
      )}
      {failed.map(p => <p key={p.key} className="bk-tray-claude-none">{PAPER[p.source]}: {p.error}</p>)}
      <p className="bk-tray-claude-by">read by {reading?.model || 'claude-opus-5-5'} · every figure checked against the text</p>
    </section>
  );
}
