// To do: one line per thing that needs a hand, and who it waits on.
// The first line is the one to do first. A line opens the IOU at the right decision.

import React, { useMemo } from 'react';
import { operationQueue } from '../../operations.mjs';
import { Cell, Dater, Empty, Filters, Ledger, Row, Sheet } from '../shell/parts.jsx';
import { href } from '../shell/route.mjs';
import { dollars, ledger } from '../shell/money.mjs';
import { TODO_KINDS, todoLines, waitingOn } from './records/plain.mjs';
import './records.css';

const COLS = 'var(--bk-lm) minmax(300px, 3.2fr) minmax(140px, 0.9fr) minmax(120px, 0.7fr) minmax(166px, 0.75fr) 34px';
const HEAD = [
  null,
  { label: 'What to do', rule: 'red' },
  { label: 'Company' },
  { label: 'Waiting on' },
  { label: 'Amount', num: true, rule: 'double' },
  { label: '', rule: 'double' },
];
const NONE_OF = {
  urgent: 'Nothing is running out of time.',
  review: 'Nothing to decide.',
  evidence: 'No paper is missing.',
  claim: 'Nothing to chase.',
  scheduled: 'Nothing is waiting on a date.',
};

/** "One. Two." → ["One.", "Two."], so the first line can set each sentence on its own rule. */
const sentences = text => String(text).split(/(?<=[.!?])\s+/).filter(Boolean);

export default function ToDo({ service, view, route, go }) {
  const kind = TODO_KINDS.some(k => k.id === route.query.kind) ? route.query.kind : '';
  const all = useMemo(() => (view ? operationQueue(view, {}) : []), [view]);
  const rows = useMemo(
    () => (view ? operationQueue(view, { category: kind }).map(row => ({ row, line: todoLines(row, view, kind) })) : []),
    [view, kind],
  );
  if (!view) return null;

  const holds = id => all.filter(row => row.category === id || row.issues.some(issue => issue.category === id)).length;
  const filters = [{ id: '', label: 'All', count: all.length }, ...TODO_KINDS.map(k => ({ ...k, count: holds(k.id) }))];
  const pen = service.actor?.role || 'viewer';

  return (
    <Sheet>
      <header className="bk-rec-top">
        <div className="bk-rec-top-row">
          <h1 className="bk-rec-title">To do</h1>
          <Dater style={{ marginLeft: 'auto' }} />
        </div>
        {all.length > 0 && (
          <Filters items={filters} value={kind} label="Which kind" onChange={id => go('todo', '', id ? { kind: id } : null, { replace: true })} />
        )}
      </header>

      {!all.length ? (
        <Empty then="Nothing needs a hand today.">Desk clear.</Empty>
      ) : !rows.length ? (
        <Empty then={<a className="bk-link" href={href('todo')}>Back to all {all.length}</a>}>{NONE_OF[kind]}</Empty>
      ) : (
        <Ledger cols={COLS} head={HEAD} className="bk-rec-todo">
          {rows.map(({ row, line }, i) => {
            const offer = Boolean(row.commitment?.conditions?.length);
            const owed = Boolean(row.commitment) && !offer && row.amountCents > 0;
            const to = row.commitmentId
              ? href('iou', row.commitmentId, line.actionId ? { a: line.actionId } : null)
              : href('papers', `credit:${row.creditId}`);
            const who = waitingOn(line, pen);
            const later = line.category === 'scheduled';
            return (
              <Row
                key={row.id}
                href={to}
                lines={2}
                className={i === 0 ? 'bk-rec-first' : undefined}
                aria-label={`${row.vendorName}: ${line.what} Waiting on ${who}. ${dollars(row.amountCents)}.`}
              >
                <Cell no>{i + 1}</Cell>
                <Cell rule="red" quiet={later} className="bk-rec-what">
                  <b>{i === 0 ? sentences(line.what).map(part => <span key={part}>{part} </span>) : line.what}</b>
                  {line.also.map(more => <small key={more.what}>Also: {more.what}</small>)}
                </Cell>
                <Cell label="Company" quiet={later} className="bk-rec-co">{row.vendorName}</Cell>
                <Cell label="Waiting on" quiet={later} className={who === 'you' ? 'bk-rec-you' : undefined}>{who}</Cell>
                <Cell num owed={owed} quiet={later} rule="double" label={offer ? 'On offer' : 'Amount'}>
                  {offer ? <span className="bk-muted">({ledger(row.amountCents)})</span> : ledger(row.amountCents)}
                </Cell>
                <Cell rule="double" />
              </Row>
            );
          })}
        </Ledger>
      )}
    </Sheet>
  );
}
