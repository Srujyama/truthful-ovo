// A paper in a list: its mark in the margin, its title, the company, what kind of
// paper it is and its date, on one hairline row. The whole row is a link to it.
// A credit note is a row too: its number and amount, and whether it is on an invoice.
//
//   import { PaperList, PaperMark, markItem } from './papers/Thumb.jsx';
//   <PaperList view={view} items={drawerPapers(view)} />
//   <PaperList view={view} items={sources.map(source => paperItem(view, source))} head={false} />

import React from 'react';
import { Cell, Ledger, Row, cx } from '../../shell/parts.jsx';
import { href } from '../../shell/route.mjs';
import { day, dollars } from '../../shell/money.mjs';
import { inkFor, markFor, markSVG } from './glyphs.js';
import { waitingOnInvoice } from './kinds.mjs';
import '../papers.css';

/** One mark as SVG: `mark` and `ink` from glyphs.js. */
export function PaperMark({ mark, ink = 'ink', u = 2, className = '' }) {
  return <span className={cx('bk-pap-mark', className)} aria-hidden="true" dangerouslySetInnerHTML={{ __html: markSVG(mark, ink, u) }} />;
}

/** What the figure needs of one drawer item. */
export function markItem(view, item) {
  return {
    key: item.key,
    mark: markFor(item),
    ink: inkFor(item, waitingOnInvoice(view, item)),
    title: item.type === 'credit' ? `${item.noun} ${item.title}, ${dollars(item.amountCents)}` : item.title,
    company: item.company,
    href: href('papers', item.address),
  };
}

const COLS = 'var(--bk-lm) minmax(0, 2.6fr) minmax(0, 1fr) minmax(0, 0.8fr) 128px';
const HEAD = [null, { label: 'paper' }, { label: 'from' }, { label: 'kind' }, { label: 'date', num: true }];

export function PaperRow({ view, item }) {
  const look = markItem(view, item);
  const waiting = look.ink === 'waiting';
  const note = item.type === 'credit';
  const said = note
    ? `${item.noun} ${item.title}, ${item.company}, ${dollars(item.amountCents)}, ${item.onInvoice ? 'on an invoice' : 'not on an invoice yet'}`
    : `${item.noun}: ${item.title}, ${item.company}, ${day(item.date)}${item.current ? '' : `, an older copy replaced ${day(item.replacedOn)}`}`;
  return (
    <Row href={look.href} className={cx('bk-pap-row', !note && !item.current && 'is-old')} data-paper={item.address} aria-label={said}>
      <Cell className="bk-pap-at"><PaperMark mark={look.mark} ink={look.ink} /></Cell>
      <Cell className="bk-pap-title">
        {note ? <>No. {item.title} <span className="bk-pap-sum">{dollars(item.amountCents)}</span></> : item.title}
        {note
          ? <small className={cx(waiting && 'is-waiting')}>{item.onInvoice ? 'on an invoice' : 'not on an invoice yet'}</small>
          : !item.current && <small>replaced {day(item.replacedOn)}</small>}
      </Cell>
      <Cell label="from" className="bk-pap-co">{item.company}</Cell>
      <Cell label="kind" className="bk-pap-kind">{item.noun.toLowerCase()}</Cell>
      <Cell label="date" date className="bk-pap-date">{day(item.date)}</Cell>
    </Row>
  );
}

export function PaperList({ view, items, head = true, label = 'Papers', className }) {
  return (
    <Ledger cols={COLS} head={head ? HEAD : null} className={cx('bk-pap-list', !head && 'is-headless', className)} aria-label={label}>
      {items.map(item => <PaperRow key={item.key} view={view} item={item} />)}
    </Ledger>
  );
}

export default PaperRow;
