// The book of IOUs: one line per promise, and what is still owed on it.
// (The full front page, with the slip that slides out and the in-tray, is
// src/book/front. This is the plain page that stands here until it is merged,
// and what the IOUs tab falls back to.)

import React, { useMemo } from 'react';
import { correspondenceDocuments } from '../../correspondence.mjs';
import { Cell, Empty, Ledger, Row, Sheet, SheetHead, Stamp, Total } from '../shell/parts.jsx';
import { href } from '../shell/route.mjs';
import { day, dollars, ledger, today } from '../shell/money.mjs';

const COLS = 'var(--bk-lm) minmax(170px, 0.9fr) minmax(220px, 2.1fr) 136px 140px 156px minmax(190px, 0.8fr) 34px';
const HEAD = [
  null,
  { label: 'Vendor', rule: 'red' },
  { label: 'They said' },
  { label: 'Due' },
  { label: 'They promised', num: true, rule: 'double' },
  { label: 'Credited so far', num: true, rule: 'red' },
  { label: 'Still owed', num: true, owed: true, rule: 'red' },
  { label: '', rule: 'double' },
];

/** The sentence the promise was made in: the first real sentence of the paper it came from. */
export function whatTheySaid(view, commitment) {
  const papers = correspondenceDocuments(view, commitment);
  const promise = papers.find(p => p.roles?.includes('promise') && p.available) || papers.find(p => p.available);
  const text = String(promise?.text || '').split('\n').filter(line => line.trim() && !/^[A-Z ]{12,}$/.test(line.trim())).join(' ');
  const sentences = text.match(/[^.!?]+(?:\.\d+[^.!?]*)*[.!?]+/g)?.map(s => s.trim()) || [text];
  const first = sentences.find(s => /credit|waive|refund/i.test(s)) || sentences.find(s => /\$|USD/.test(s)) || sentences[0] || '';
  return first.length > 150 ? `${first.slice(0, 147)}…` : first;
}

export function standing(commitment, asOf = today()) {
  if (commitment.conditions?.length) return 'offer';
  if (commitment.outstandingCents === 0) return 'paid';
  if (commitment.dueDate < asOf) return 'overdue';
  return 'due';
}

export default function Ious({ view }) {
  const rows = useMemo(() => (view ? [...view.commitments].sort((a, b) => b.outstandingCents - a.outstandingCents) : []), [view]);
  if (!view) return null;
  const company = id => view.vendors.find(v => v.id === id)?.name || id;
  const owed = rows.filter(c => !c.conditions?.length);
  const sum = key => owed.reduce((n, c) => n + c[key], 0);
  return (
    <Sheet>
      <SheetHead
        title={<>Vendors promise. <br />Invoices forget.</>}
        lede="Truthful writes down what each vendor promised, then checks every invoice until you have been paid."
      />
      {rows.length ? (
        <Ledger
          cols={COLS}
          head={HEAD}
          total={<Total cells={[null, { label: 'Total', span: 3 }, { value: ledger(sum('promisedCents')), rule: 'double', says: 'They promised' }, { value: ledger(sum('verifiedCents')), rule: 'red', says: 'Credited so far' }, { value: ledger(sum('outstandingCents')), owed: true, rule: 'red', says: 'Still owed' }, null]} />}
        >
          {rows.map((c, i) => {
            const state = standing(c, view.asOf);
            return (
              <Row key={c.id} href={href('iou', c.id)} lines={2} aria-label={`${company(c.vendorId)}: ${dollars(c.outstandingCents)} still owed`}>
                <Cell no>{i + 1}</Cell>
                <Cell name rule="red">{company(c.vendorId)}</Cell>
                <Cell label="They said">“{whatTheySaid(view, c)}”</Cell>
                <Cell date label="Due">
                  {day(c.dueDate)}
                  {state === 'overdue' && <Stamp small ink="red" seed={`overdue-${c.id}`} style={{ marginTop: -2 }}>Overdue</Stamp>}
                </Cell>
                <Cell num rule="double" label="They promised">{state === 'offer' ? <span className="bk-muted">({ledger(c.promisedCents)})</span> : ledger(c.promisedCents)}</Cell>
                <Cell num rule="red" label="Credited so far">{ledger(c.verifiedCents)}</Cell>
                <Cell num owed={state !== 'paid' && state !== 'offer'} rule="red" label="Still owed">
                  {state === 'paid'
                    ? <Stamp small seed={`paid-${c.id}`}>Paid</Stamp>
                    : state === 'offer'
                      ? <small>an offer, with strings</small>
                      : ledger(c.outstandingCents)}
                </Cell>
                <Cell rule="double" />
              </Row>
            );
          })}
        </Ledger>
      ) : (
        <Empty then="Drop its email in the in-tray.">Nothing owed. The next promise goes here.</Empty>
      )}
    </Sheet>
  );
}
