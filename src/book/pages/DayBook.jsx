// The day book: everything that happened, newest first, one line each.
// A line opens the entry in full on a slip, with the raw entry behind a disclosure.

import React, { useEffect, useMemo, useState } from 'react';
import { isDate } from '../../assurance/index.mjs';
import { workspaceActivity } from '../../operations.mjs';
import { Btn, Cell, Close, Dater, Empty, Filters, Find, Ledger, Over, Paper, Row, Sheet } from '../shell/parts.jsx';
import { href, paperId } from '../shell/route.mjs';
import { clock, day, dollars, shortDay } from '../shell/money.mjs';
import { DAY_KINDS, dayKind, dayLine, whoWrote } from './records/plain.mjs';
import './records.css';

const PER_PAGE = 24;
const COLS = 'var(--bk-lm) 92px 100px minmax(152px, 0.55fr) minmax(280px, 3fr) minmax(130px, 0.8fr) 34px';
const HEAD = [
  null,
  { label: 'Date', rule: 'red' },
  { label: 'Time' },
  { label: 'Who' },
  { label: 'What happened' },
  { label: 'Company' },
  { label: '', rule: 'double' },
];

const on = instant => String(instant).slice(0, 10);
/** "One. Two." → ["One.", "Two."], so the newest line can set each sentence on its own rule. */
const sentences = text => String(text).split(/(?<=[.!?])\s+/).filter(Boolean);

export default function DayBook({ service, view, route, go, active }) {
  const q = route.query;
  const f = {
    q: q.q || '',
    co: q.co || '',
    who: q.who || '',
    kind: q.kind || '',
    from: isDate(q.from) ? q.from : '',
    to: isDate(q.to) ? q.to : '',
  };
  const [openNo, setOpenNo] = useState(() => Number(q.e) || 0);
  // A slip left open would keep the desk dimmed after you turn to another page.
  useEffect(() => { if (!active) setOpenNo(0); }, [active]);

  const all = useMemo(() => {
    if (!service.workspace || !view) return [];
    return workspaceActivity(service.workspace, view, {}).map(event => {
      const line = dayLine(event, view);
      const who = whoWrote(event.actor);
      return { event, line, who, kind: dayKind(event), text: `${line} ${who} ${event.vendorNames.join(' ')} ${event.references.join(' ')} ${event.summary}`.toLowerCase() };
    });
  }, [service.workspace, view]);
  if (!view) return null;

  const needle = f.q.trim().toLowerCase();
  const pass = (row, skip) => (
    (skip === 'co' || !f.co || row.event.vendorIds.includes(f.co))
    && (skip === 'who' || !f.who || row.event.actor.id === f.who)
    && (skip === 'kind' || !f.kind || row.kind === f.kind)
    && (!f.from || on(row.event.observedAt) >= f.from)
    && (!f.to || on(row.event.observedAt) <= f.to)
    && (!needle || row.text.includes(needle))
  );
  const rows = all.filter(row => pass(row));
  const pages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const page = Math.min(pages - 1, Math.max(0, (Number(q.p) || 1) - 1));
  const shown = rows.slice(page * PER_PAGE, (page + 1) * PER_PAGE);
  const left = rows.length - (page + 1) * PER_PAGE;
  const open = openNo ? all.find(row => row.event.sequence === openNo) : null;

  const address = patch => {
    const next = { ...f, ...patch };
    return { q: next.q, co: next.co, who: next.who, kind: next.kind, from: next.from, to: next.to, p: next.p > 1 ? next.p : null };
  };
  const set = patch => go('daybook', '', address({ ...patch, p: 1 }), { replace: true });

  // Each filter says how many lines it would leave, with the other filters as they are.
  const count = (skip, test) => all.filter(row => pass(row, skip) && test(row)).length;
  const companies = [
    { id: '', label: 'Every company', count: count('co', () => true) },
    ...view.vendors.map(v => ({ id: v.id, label: v.name, count: count('co', row => row.event.vendorIds.includes(v.id)) })),
  ];
  const people = [...new Map(all.map(row => [row.event.actor.id, row.who])).entries()];
  const whos = [
    { id: '', label: 'Everyone', count: count('who', () => true) },
    ...people.map(([id, name]) => ({ id, label: name, count: count('who', row => row.event.actor.id === id) })),
  ];
  const kinds = [
    { id: '', label: 'Everything', count: count('kind', () => true) },
    ...DAY_KINDS.map(k => ({ ...k, count: count('kind', row => row.kind === k.id) })).filter(k => k.count > 0 || k.id === f.kind),
  ];

  return (
    <Sheet>
      <header className="bk-rec-top">
        <div className="bk-rec-top-row">
          <h1 className="bk-rec-title">Day book</h1>
          <Dater style={{ marginLeft: 'auto' }} />
        </div>
        {all.length > 0 && (
          <>
            <div className="bk-rec-tools">
              <Find value={f.q} onChange={text => set({ q: text })} placeholder="a company, an invoice number, a word" />
              <div className="bk-rec-span">
                <label>from <input className="bk-input" type="date" value={f.from} max={f.to || undefined} onChange={e => set({ from: e.target.value })} /></label>
                <label>to <input className="bk-input" type="date" value={f.to} min={f.from || undefined} onChange={e => set({ to: e.target.value })} /></label>
              </div>
            </div>
            <div className="bk-rec-pick"><span className="bk-label">Company</span><Filters items={companies} value={f.co} label="Which company" onChange={id => set({ co: id })} /></div>
            <div className="bk-rec-pick"><span className="bk-label">Who</span><Filters items={whos} value={f.who} label="Who wrote it" onChange={id => set({ who: id })} /></div>
            <div className="bk-rec-pick"><span className="bk-label">Kind</span><Filters items={kinds} value={f.kind} label="Which kind" onChange={id => set({ kind: id })} /></div>
          </>
        )}
      </header>

      {!all.length ? (
        <Empty then="The first line is written when a paper goes in the in-tray.">Nothing has happened yet.</Empty>
      ) : !rows.length ? (
        <Empty then={<a className="bk-link" href={href('daybook')}>Back to all {all.length} lines</a>}>
          {f.from && f.to && f.from > f.to ? 'Those two dates are the wrong way round.' : 'No line in the day book matches that.'}
        </Empty>
      ) : (
        <Ledger cols={COLS} head={HEAD} className="bk-rec-days">
          {shown.map(({ event, line, who }, i) => (
            <Row
              key={event.id}
              onClick={() => setOpenNo(event.sequence)}
              open={openNo === event.sequence}
              className={page === 0 && i === 0 ? 'bk-rec-day bk-rec-first' : 'bk-rec-day'}
              aria-haspopup="dialog"
            >
              <Cell no>{event.sequence}</Cell>
              <Cell date rule="red" label="Date">{shortDay(event.observedAt)}</Cell>
              <Cell date quiet label="Time">{clock(event.observedAt)}</Cell>
              <Cell label="Who">{who}</Cell>
              <Cell className="bk-rec-said">{page === 0 && i === 0 ? sentences(line).map(part => <span key={part}>{part} </span>) : line}</Cell>
              <Cell label="Company" className="bk-rec-co">{event.vendorNames.join(', ')}</Cell>
              <Cell rule="double" />
            </Row>
          ))}
        </Ledger>
      )}

      {rows.length > 0 && (left > 0 || page > 0) && (
        <div className="bk-part bk-rec-turnpage">
          <div className="bk-actions">
            {left > 0 && <Btn onClick={() => go('daybook', '', address({ p: page + 2 }))}>Earlier entries</Btn>}
            {left > 0 && <span className="bk-why">{left} more, back to {shortDay(rows[rows.length - 1].event.observedAt)}</span>}
            {page > 0 && <Btn quiet onClick={() => go('daybook', '', address({ p: 1 }))}>Back to the newest</Btn>}
          </div>
        </div>
      )}

      {open && <Entry row={open} view={view} onClose={() => setOpenNo(0)} />}
    </Sheet>
  );
}

/** One entry in full, on a slip of bond brought forward over the desk. */
function Entry({ row, view, onClose }) {
  const { event, line, who } = row;
  const p = event.payload || {};
  const company = id => view.vendors.find(v => v.id === id)?.name || 'A company';
  const ious = event.commitmentIds.map(id => view.commitments.find(c => c.id === id)).filter(Boolean);
  const creditId = p.credit?.id || p.creditId || p.allocation?.creditId;
  const credit = creditId && view.credits.find(c => c.id === creditId);
  const paper = p.source && view.sourceVersions.find(s => s.id === p.source.id && s.revision === event.sequence);
  return (
    <Over onClose={onClose} label={`Entry ${event.sequence} in full`}>
      <Paper w={152} rot={-0.5} className="bk-form bk-rec-slip">
        <Close onClose={onClose} />
        <span className="bk-doc-kind">Day book · line {event.sequence}</span>
        <h2 className="bk-rec-slip-said">{line}</h2>

        <div className="bk-boxes bk-rec-facts">
          <div className="bk-box"><span>Took effect</span><b>{day(event.effectiveDate)}</b></div>
          <div className="bk-box"><span>Written in</span><b>{day(event.observedAt)}, {clock(event.observedAt)}</b></div>
          <div className="bk-box"><span>Written by</span><b className="is-hand">{who}</b></div>
          <div className="bk-box"><span>Company</span><b>{event.vendorNames.join(', ') || 'The whole book'}</b></div>
        </div>

        {(ious.length > 0 || credit || paper) && (
          <ul className="bk-rec-slip-links">
            {ious.map(c => (
              <li key={c.id}>
                <a className="bk-link" href={href('iou', c.id)} onClick={onClose}>
                  {company(c.vendorId)}’s {dollars(c.promisedCents)} {c.conditions?.length ? 'offer' : 'IOU'}
                </a>
              </li>
            ))}
            {credit && (
              <li>
                <a className="bk-link" href={href('papers', `credit:${credit.id}`)} onClick={onClose}>
                  {credit.status === 'issued' || credit.applicationSourceLinks?.length ? 'Credit note' : 'Invoice'} {credit.invoiceId}
                </a>
              </li>
            )}
            {paper && <li><a className="bk-link" href={href('papers', paperId(paper.id, paper.revision))} onClick={onClose}>The paper itself</a></li>}
          </ul>
        )}

        <details className="bk-rec-raw">
          <summary>The raw entry</summary>
          <dl>
            <div><dt>Entry</dt><dd>{event.id}</dd></div>
            <div><dt>Command</dt><dd>{event.commandId}</dd></div>
            <div><dt>Sequence</dt><dd>{event.sequence}</dd></div>
            <div><dt>Type</dt><dd>{event.type}</dd></div>
          </dl>
          <pre tabIndex={0}>{JSON.stringify(p, null, 2)}</pre>
        </details>
      </Paper>
    </Over>
  );
}
