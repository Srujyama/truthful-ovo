// A small copy of a paper, as it lies in the drawer: the right stock for its kind,
// turned a degree or two (always the same way for the same paper), its kind, title,
// company and date, then its real first lines running off the foot. A credit note is
// a pink slip with its number, its amount and its stamp. The whole thing is a link.
//
//   import { PaperThumb } from './papers/Thumb.jsx';
//   import { paperItem, noteItem } from './papers/kinds.mjs';
//   <PaperThumb item={paperItem(view, source)} />      // a letter, an invoice, an agreement…
//   <PaperThumb item={noteItem(view, credit)} />       // a credit note

import React from 'react';
import { Paper, Stamp, cx } from '../../shell/parts.jsx';
import { href } from '../../shell/route.mjs';
import { day, dollars, ledger, shortDay } from '../../shell/money.mjs';
import { paperTurn } from './kinds.mjs';
import '../papers.css';

export function PaperThumb({ item, className, ...rest }) {
  const shared = {
    as: 'a',
    w: 62,
    href: href('papers', item.address),
    stock: item.stock,
    rot: paperTurn(item.address),
    'data-paper': item.address,
    ...rest,
  };
  if (item.type === 'credit') {
    return (
      <Paper
        {...shared}
        edge="perf-left"
        className={cx('bk-doc bk-thumb bk-pap-thumb is-note', className)}
        aria-label={`${item.noun} ${item.title}, ${item.company}, ${dollars(item.amountCents)}, ${item.onInvoice ? 'on an invoice' : 'not on an invoice yet'}`}
      >
        <span className="bk-doc-kind">{item.noun}<i>No. {item.title}</i></span>
        <b className="bk-doc-title">{item.company}</b>
        <span className="bk-pap-sum">${ledger(item.amountCents)}</span>
        <span className="bk-pap-from">{day(item.date)}</span>
        <Stamp small seed={item.key}>{item.onInvoice ? 'On invoice' : 'Issued'}</Stamp>
      </Paper>
    );
  }
  return (
    <Paper
      {...shared}
      className={cx('bk-doc bk-thumb bk-pap-thumb', !item.current && 'is-old', className)}
      aria-label={`${item.noun}: ${item.title}, ${item.company}, ${day(item.date)}${item.current ? '' : `, an older copy replaced ${day(item.replacedOn)}`}`}
    >
      <span className="bk-doc-kind">{item.noun}</span>
      <b className="bk-doc-title">{item.title}</b>
      <span className="bk-pap-from">{item.company} · {day(item.date)}</span>
      {!item.current && <span className="bk-pap-old">replaced {shortDay(item.replacedOn)}</span>}
      <span className="bk-pap-lines">{item.lines}</span>
    </Paper>
  );
}

export default PaperThumb;
