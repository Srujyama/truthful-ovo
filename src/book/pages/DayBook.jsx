// The day book: everything that happened. The headline is how much ("28 entries since
// Sep 1."); under it a thin timeline with one mark per entry, then the filters and the
// list, newest first, one line each. A line (or its mark) opens the entry on a slip,
// with the raw entry behind a disclosure.

import React, { useEffect, useMemo, useState } from 'react';
import { isDate } from '../../assurance/index.mjs';
import { workspaceActivity } from '../../operations.mjs';
import { Btn, Cell, Close, Empty, Filters, Find, Ledger, Over, Paper, Row, Sheet, SheetHead } from '../shell/parts.jsx';
import { href, paperId } from '../shell/route.mjs';
import { clock, day, dollars, shortDay } from '../shell/money.mjs';
import { DAY_KINDS, dayKind, dayLine, whoWrote } from './records/plain.mjs';
import { entrySVG } from './records/marks.js';
import Timeline from './records/Timeline.jsx';
import './records.css';

const PER_PAGE = 24;
const COLS = 'var(--bk-lm) 84px 92px minmax(120px, 0.55fr) minmax(260px, 3fr) minmax(120px, 0.8fr)';
const HEAD = [
  null,
  { label: 'date' },
  { label: 'time' },
  { label: 'who' },
  { label: 'what happened' },
  { label: 'company' },
];

const on = instant => String(instant).slice(0, 10);
// The day an instant fell on in the reader's own time zone, to match the clock printed beside it.
const localDay = instant => { const at = new Date(instant); return Number.isNaN(at.getTime()) ? '' : `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`; };
const entriesWord = n => `${n} ${n === 1 ? 'entry' : 'entries'}`;

/** The marks the legend explains: the kinds on the timeline, in the filter's order. */
function Legend({ kinds }) {
  const named = { promises: 'a promise', papers: 'a paper filed', credits: 'a credit', offers: 'an offer', decisions: 'a decision' };
  const shown = DAY_KINDS.filter(kind => kinds.has(kind.id) && named[kind.id]);
  if (!shown.length) return null;
  return (
    <p className="bk-rec-key">
      {shown.map(kind => <span key={kind.id}><span className="bk-rec-mark" aria-hidden="true" dangerouslySetInnerHTML={{ __html: entrySVG(kind.id) }} />{named[kind.id]}</span>)}
      {[...kinds].some(kind => !named[kind]) && <span><span className="bk-rec-mark" aria-hidden="true" dangerouslySetInnerHTML={{ __html: entrySVG('other') }} />the rest</span>}
    </p>
  );
}

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
  const entries = useMemo(() => all.map(row => ({ seq: row.event.sequence, day: on(row.event.observedAt), kind: row.kind, said: row.line })), [all]);
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

  const lit = new Set(rows.map(row => row.event.sequence));
  const first = all.length ? all[all.length - 1].event.observedAt : '';
  const newest = all.length ? all[0] : null;
  const timelineSaid = `${entriesWord(all.length)} from ${shortDay(first)} to ${shortDay(newest?.event.observedAt)}${rows.length < all.length ? `, ${rows.length} of them shown` : ''}`;

  return (
    <Sheet className="bk-rec-daybook">
      <SheetHead
        kicker="history"
        title={all.length ? `${entriesWord(all.length)} since ${shortDay(first)}.` : 'Nothing written yet.'}
        lede={newest ? `The last went in on ${shortDay(newest.event.observedAt)}. ${newest.line}` : null}
      />

      {all.length > 0 && (
        <>
          <div className="bk-part bk-rec-figure">
            <Timeline entries={entries} lit={lit} open={openNo} end={view.asOf} onOpen={setOpenNo} label={timelineSaid} />
            <Legend kinds={new Set(all.map(row => row.kind))} />
          </div>

          <div className="bk-part bk-rec-picks">
            <div className="bk-rec-pick"><span className="bk-label">kind</span><Filters items={kinds} value={f.kind} label="Which kind" onChange={id => set({ kind: id })} /></div>
            <div className="bk-rec-pick"><span className="bk-label">company</span><Filters items={companies} value={f.co} label="Which company" onChange={id => set({ co: id })} /></div>
            <div className="bk-rec-pick"><span className="bk-label">who</span><Filters items={whos} value={f.who} label="Who wrote it" onChange={id => set({ who: id })} /></div>
          </div>

          <div className="bk-part bk-rec-tools">
            <Find value={f.q} onChange={text => set({ q: text })} placeholder="a company, an invoice number, a word" />
            <div className="bk-rec-span">
              <label><span>from</span><input className="bk-rec-date" type="date" value={f.from} max={f.to || undefined} onChange={e => set({ from: e.target.value })} /></label>
              <label><span>to</span><input className="bk-rec-date" type="date" value={f.to} min={f.from || undefined} onChange={e => set({ to: e.target.value })} /></label>
            </div>
            <span className="bk-rec-count">{rows.length === all.length ? entriesWord(all.length) : `${rows.length} of ${all.length}`}</span>
          </div>
        </>
      )}

      {!all.length ? (
        <Empty then="The first line is written when a paper goes in the in-tray.">Nothing has happened yet.</Empty>
      ) : !rows.length ? (
        <Empty then={<a className="bk-link" href={href('daybook')}>Back to all {all.length} lines</a>}>
          {f.from && f.to && f.from > f.to ? 'Those two dates are the wrong way round.' : 'No line in the day book matches that.'}
        </Empty>
      ) : (
        <Ledger cols={COLS} head={HEAD} className="bk-rec-days">
          {shown.map(({ event, line, who }) => (
            <Row
              key={event.id}
              onClick={() => setOpenNo(event.sequence)}
              open={openNo === event.sequence}
              className="bk-rec-day"
              aria-haspopup="dialog"
            >
              <Cell no>{event.sequence}</Cell>
              <Cell date label="date">{shortDay(localDay(event.observedAt))}</Cell>
              <Cell date quiet label="time">{clock(event.observedAt)}</Cell>
              <Cell label="who" className="bk-rec-who">{who}</Cell>
              <Cell className="bk-rec-said">{line}</Cell>
              <Cell label="company" className="bk-rec-co">{event.vendorNames.join(', ')}</Cell>
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

/** One entry in full, on a white slip brought forward over the page. */
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
      <Paper w={152} className="bk-rec-slip" faceClassName="t-box">
        <span className="t-box-name">day book · entry {event.sequence}</span>
        <Close onClose={onClose} />
        <h2 className="bk-rec-slip-said">{line}</h2>

        <dl className="bk-rec-rows">
          <div className="t-row"><dt>took effect</dt><i className="t-dots" /><dd>{day(event.effectiveDate)}</dd></div>
          <div className="t-row"><dt>written in</dt><i className="t-dots" /><dd>{day(event.observedAt)}, {clock(event.observedAt)}</dd></div>
          <div className="t-row"><dt>written by</dt><i className="t-dots" /><dd>{who}</dd></div>
          <div className="t-row"><dt>company</dt><i className="t-dots" /><dd>{event.vendorNames.join(', ') || 'The whole book'}</dd></div>
        </dl>

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
          <summary>the raw entry</summary>
          <dl>
            <div><dt>entry</dt><dd>{event.id}</dd></div>
            <div><dt>command</dt><dd>{event.commandId}</dd></div>
            <div><dt>sequence</dt><dd>{event.sequence}</dd></div>
            <div><dt>type</dt><dd>{event.type}</dd></div>
          </dl>
          <pre tabIndex={0}>{JSON.stringify(p, null, 2)}</pre>
        </details>
      </Paper>
    </Over>
  );
}
