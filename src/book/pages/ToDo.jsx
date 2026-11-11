// To do: how many things wait for you, as the headline, then one row per thing:
// what, for which company, the amount, and who it waits on. The first row is the
// one to do first. A row opens the place to do it (the IOU at the right decision).

import React, { useMemo } from 'react';
import { operationQueue } from '../../operations.mjs';
import { Cell, Empty, Filters, Ledger, Row, Sheet, SheetHead, cx } from '../shell/parts.jsx';
import { href } from '../shell/route.mjs';
import { dollars, ledger } from '../shell/money.mjs';
import { TODO_KINDS, todoLines, waitingOn } from './records/plain.mjs';
import './todo.css';

const COLS = 'var(--bk-lm) minmax(0, 3fr) minmax(130px, 1fr) minmax(130px, 0.9fr) 150px 52px';
const HEAD = [
  null,
  { label: 'What to do' },
  { label: 'Company' },
  { label: 'Waits on' },
  { label: 'Amount', num: true },
  { label: '' },
];
const NONE_OF = {
  urgent: 'Nothing is running out of time.',
  review: 'Nothing to decide.',
  evidence: 'No paper is missing.',
  claim: 'Nothing to chase.',
  scheduled: 'Nothing is waiting on a date.',
};
const WORDS = ['Nothing', 'One thing', 'Two things', 'Three things', 'Four things', 'Five things', 'Six things', 'Seven things', 'Eight things', 'Nine things'];
const things = n => WORDS[n] || `${n} things`;

/** "4 things wait for you." and, in grey, how many wait on someone else. */
function headline(mine, others) {
  const rest = others ? <i> {others === 1 ? 'One waits on someone else.' : `${things(others)} wait on someone else.`}</i> : null;
  if (!mine) return <>Nothing waits for you.{rest}</>;
  return <>{things(mine)} {mine === 1 ? 'waits' : 'wait'} for you.{rest}</>;
}

export default function ToDo({ service, view, route, go }) {
  const kind = TODO_KINDS.some(k => k.id === route.query.kind) ? route.query.kind : '';
  const all = useMemo(() => (view ? operationQueue(view, {}) : []), [view]);
  const rows = useMemo(
    () => (view ? operationQueue(view, { category: kind }).map(row => ({ row, line: todoLines(row, view, kind) })) : []),
    [view, kind],
  );
  const pen = service.actor?.role || 'viewer';
  const count = useMemo(() => {
    if (!view) return { mine: 0, others: 0 };
    const now = all.map(row => todoLines(row, view)).filter(line => line.category !== 'scheduled');
    const mine = now.filter(line => waitingOn(line, pen) === 'you').length;
    return { mine, others: now.length - mine };
  }, [all, view, pen]);
  if (!view) return null;

  const holds = id => all.filter(row => row.category === id || row.issues.some(issue => issue.category === id)).length;
  const filters = [{ id: '', label: 'All', count: all.length }, ...TODO_KINDS.map(k => ({ ...k, count: holds(k.id) }))];
  const owedNow = all.filter(row => row.commitment && !row.commitment.conditions?.length).reduce((n, row) => n + (row.amountCents || 0), 0);

  return (
    <Sheet className="bk-todo">
      <SheetHead
        kicker="to do"
        title={headline(count.mine, count.others)}
        lede={all.length
          ? <>{owedNow > 0 && <><b className="bk-todo-owed">{dollars(owedNow)}</b> is still owed on them. </>}Start at the top.</>
          : 'Nothing needs a hand yet. A promise that comes due, an offer or a missing paper will land here.'}
      >
        {all.length > 0 && (
          <div className="bk-todo-filters">
            <Filters items={filters} value={kind} label="Which kind" onChange={id => go('todo', '', id ? { kind: id } : null, { replace: true })} />
          </div>
        )}
      </SheetHead>

      {!all.length ? null : !rows.length ? (
        <Empty then={<a className="bk-link" href={href('todo')}>Back to all {all.length}</a>}>{NONE_OF[kind]}</Empty>
      ) : (
        <Ledger cols={COLS} head={HEAD} className="bk-todo-list">
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
                className={cx('bk-arrive', later && 'is-later')}
                style={{ '--i': i }}
                aria-label={`${row.vendorName}: ${line.what} Waits on ${who}. ${dollars(row.amountCents)}.`}
              >
                <Cell no>{i + 1}</Cell>
                <Cell className="bk-todo-what">
                  <b>{line.what}</b>
                  {line.also.map(more => <small key={more.what}>also: {more.what}</small>)}
                </Cell>
                <Cell label="Company" className="bk-todo-co">{row.vendorName}</Cell>
                <Cell label="Waits on" className={cx('bk-todo-who', who === 'you' && 'is-you')}>{who}</Cell>
                <Cell num owed={owed} label={offer ? 'On offer' : 'Amount'}>
                  {offer ? <span className="bk-muted">({ledger(row.amountCents)})</span> : ledger(row.amountCents)}
                </Cell>
                <Cell className="bk-todo-go" aria-hidden="true">→</Cell>
              </Row>
            );
          })}
        </Ledger>
      )}
    </Sheet>
  );
}
