// One promise's account: what is still owed on it, everything that happened to
// it, what to do next, and the papers it rests on.
//
//   #/iou/<commitmentId>            the page
//   #/iou/<commitmentId>?a=<id>     the same page, with that decision's slip brought forward
//
// The lines of the ledger are built in ./account/entries.mjs (pure, tested).
// The offers, the decision slip and the house rules are ./account/acct-Next.jsx.

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { correspondenceDocuments } from '../../correspondence.mjs';
import { Cell, Ledger, Paper, Row, Sheet, SheetHead, Total, cx } from '../shell/parts.jsx';
import { Coin, CoinStrip } from '../ui/Coins.jsx';
import { href, paperId } from '../shell/route.mjs';
import { clock, day, dollars, ledger, shortDay } from '../shell/money.mjs';
import { standing, whatTheySaid } from './Ious.jsx';
import { accountEntries, localDay } from './account/entries.mjs';
import { paperLook, stripFor } from './account/acct-words.mjs';
import Next from './account/acct-Next.jsx';
import CreditSlips from './account/CreditSlips.jsx';
import ChangedTerms from './account/ChangedTerms.jsx';
import './account.css';

// The columns are set in account.css (--bk-acct-cols), so a narrow desk can pull them in.
const COLS = 'var(--bk-acct-cols)';
/** The column names never change. STILL OWED is printed in red only while money is owed. */
const head = owed => [
  null,
  { label: 'Date', rule: 'red' },
  { label: 'What happened' },
  { label: 'Paper' },
  { label: 'They promised', num: true, rule: 'double' },
  { label: 'Credited so far', num: true, rule: 'red' },
  { label: 'Still owed', num: true, owed, rule: 'red' },
  { label: '', rule: 'double' },
];

const backLink = <a className="bk-link bk-acct-back" href={href('ious')}>← all promises</a>;

export default function Account({ service, view, route, go, say, active }) {
  const commitment = view?.commitments.find(c => c.id === route.id) || null;
  const lines = useMemo(
    () => (commitment ? accountEntries(service.workspace, view, commitment) : []),
    [service.workspace, view, commitment],
  );
  if (!view) return null;

  if (!commitment) {
    return (
      <Sheet className="bk-acct">
        <SheetHead back={backLink} title="That promise isn’t in this book." />
        <div className="bk-part">
          <a className="bk-btn" href={href('ious')}>Back to all promises</a>
        </div>
      </Sheet>
    );
  }

  const company = view.vendors.find(v => v.id === commitment.vendorId)?.name || commitment.vendorId;
  const state = standing(commitment, view.asOf);
  const year = view.asOf.slice(0, 4);

  return (
    <>
      <Sheet className="bk-acct" data-standing={state}>
        <SheetHead
          back={backLink}
          title={<Answer commitment={commitment} state={state} company={company} />}
          lede={<><b className="bk-acct-co">{company}</b> <span className="bk-acct-said">“{whatTheySaid(view, commitment)}”</span></>}
        >
          <div className="bk-acct-top">
            <p className="bk-acct-due">{dueLine(commitment, state, year)}</p>
            <Coins commitment={commitment} state={state} />
          </div>
        </SheetHead>

        <Entries key={`lines:${commitment.id}`} lines={lines} commitment={commitment} state={state} year={year} />

        <Next key={`next:${commitment.id}`} service={service} view={view} commitment={commitment} state={state} say={say} wanted={route.query?.a || ''} active={active} />
        <CreditSlips view={view} commitment={commitment} service={service} say={say} past={false} />
        <ChangedTerms view={view} commitment={commitment} service={service} say={say} go={go} past={false} />
      </Sheet>

      <DeskPapers view={view} commitment={commitment} year={year} />
    </>
  );
}

// ---- the head ----

/** "due Oct 1, 2026 · overdue · PC-SEATS-2026", and the claim window when there is one. */
function dueLine(commitment, state, year) {
  const parts = [`${state === 'offer' ? 'only if you agree · from' : 'due'} ${day(commitment.dueDate)}`];
  if (commitment.originalDueDate && commitment.originalDueDate !== commitment.dueDate) parts[0] += ` (first promised for ${shortDay(commitment.originalDueDate, year)})`;
  const late = state === 'overdue' ? <b key="late" className="bk-acct-late">overdue</b> : null;
  const rest = [commitment.reference];
  const window = commitment.deadline;
  if (window?.date) rest.push(`${window.state === 'expired' ? 'claims closed' : 'claims close'} ${shortDay(window.date, year)}`);
  return <>{parts[0]}{late && <> · {late}</>} · {rest.join(' · ')}</>;
}

/** The answer, as the headline: what is still owed, or that nothing is. */
function Answer({ commitment, state, company }) {
  const whose = <span className="sr-only"> on the promise from {company}</span>;
  if (state === 'offer') return <>On offer: {dollars(commitment.promisedCents)}{whose}</>;
  if (state === 'paid') return <>Paid in full.{whose}</>;
  return <><em>{dollars(commitment.outstandingCents)}</em> still owed{whose}.</>;
}

/** How wide a box is, kept up to date as the window changes. */
function useWidth(ref, fallback = 960) {
  const [width, setWidth] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const fit = () => setWidth(el.clientWidth || fallback);
    fit();
    const watch = typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : null;
    watch?.observe(el);
    return () => watch?.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return width;
}

const LEGEND = {
  in: 'came in on an invoice',
  note: 'a credit note, not on an invoice yet',
  owed: 'still owed',
  offer: 'on offer, only if you agree',
};

/**
 * The promise as coins, one for each $100 (more for a big promise), ten to a row.
 * Ink came in on an invoice, a red ring is still owed. When money arrives the coins turn over.
 */
function Coins({ commitment, state }) {
  const box = useRef(null);
  const width = useWidth(box);
  const { promisedCents, verifiedCents, outstandingCents, issuedCents = 0 } = commitment;
  const offer = state === 'offer', paid = state === 'paid';
  const strip = stripFor(promisedCents, offer ? 0 : verifiedCents, paid);
  const noted = offer || paid ? 0 : Math.max(0, Math.min(strip.count - strip.punched, Math.ceil(issuedCents / strip.boxCents - 1e-9)));
  const states = Array.from({ length: strip.count }, (_, i) => (offer ? 'offer' : i < strip.punched ? 'in' : i < strip.punched + noted ? 'note' : 'owed'));
  const u = [5, 4, 3].find(n => n * 108 <= width) || 2;
  const perRow = Math.max(1, Math.min(10, Math.floor((width + 2 * u) / (11 * u))));
  const shown = Object.keys(LEGEND).filter(key => states.includes(key));
  const coin = dollars(Math.min(strip.boxCents, promisedCents));
  const label = offer
    ? `${dollars(promisedCents)} on offer, in ${strip.count} coins`
    : `${dollars(verifiedCents)} of ${dollars(promisedCents)} came in. ${paid ? 'Nothing' : dollars(outstandingCents)} still owed.`;

  return (
    <div className="bk-acct-coins">
      <p className="bk-acct-legend">
        {shown.map(key => <span key={key}><Coin state={key} u={2} />{LEGEND[key]}</span>)}
        <span className="bk-acct-each">one coin is {coin}</span>
      </p>
      <div ref={box} className="bk-acct-strip">
        <CoinStrip key={`${commitment.id}-${strip.boxCents}-${strip.count}`} states={states} u={u} perRow={perRow} label={label} />
      </div>
      <p className="bk-acct-sum">
        {offer ? (
          <><span>{dollars(promisedCents)} on offer</span><i aria-hidden="true" /><b>nothing owed unless you take it</b></>
        ) : (
          <>
            <span>{dollars(promisedCents)} promised − {dollars(verifiedCents)} on {verifiedCents > 0 ? 'the invoice' : 'an invoice'}</span>
            <i aria-hidden="true" />
            {paid ? <b>= nothing owed</b> : <b className="is-owed">= {dollars(outstandingCents)} still owed</b>}
          </>
        )}
      </p>
      {!offer && !paid && issuedCents > 0 && (
        <p className="bk-acct-note">A {dollars(issuedCents)} credit note is in. A note is not money until it shows on an invoice.</p>
      )}
    </div>
  );
}

// ---- what happened ----

/** Whose pen, and when: under each line, small. */
function byline(line) {
  if (line.by === 'the demo book') return line.by;
  const written = localDay(line.at);
  if (written === line.date) return `${line.by}, ${clock(line.at)}`;
  return `${line.by}, written in ${shortDay(written)}`;
}

function Entries({ lines, commitment, state, year }) {
  // A line that arrives while you are looking is typed in; the ones already there are just there.
  const seen = useRef(null);
  const fresh = seen.current ? lines.filter(line => !seen.current.has(line.id)).map(line => line.id) : [];
  useEffect(() => {
    const ids = new Set(lines.map(line => line.id));
    const timer = setTimeout(() => { seen.current = ids; }, seen.current ? 900 : 0);
    return () => clearTimeout(timer);
  }, [lines]);

  const offer = state === 'offer';
  // Red is what is owed today: the last balance in the column, and the foot. Earlier balances are history.
  const owing = !offer && commitment.outstandingCents > 0;
  const standingLine = owing ? lines.findLast(line => line.owedCents != null)?.id : null;
  const total = (
    <Total
      cells={[
        null,
        { label: 'As it stands', span: 3 },
        { value: offer ? `(${ledger(commitment.promisedCents)})` : ledger(commitment.promisedCents), rule: 'double' },
        { value: ledger(commitment.verifiedCents), rule: 'red' },
        { value: offer ? '—' : ledger(commitment.outstandingCents), owed: owing, rule: 'red' },
        null,
      ]}
    />
  );
  return (
    <Ledger className="bk-acct-ledger" cols={COLS} head={head(owing)} total={total} aria-label="What happened">
      {lines.map((line, i) => (
        <Row key={line.id} lines={Math.max(2, line.papers.length)} className={cx(fresh.includes(line.id) && 'bk-acct-new')}>
          <Cell no>{i + 1}</Cell>
          <Cell date rule="red" label="Date">{shortDay(line.date, year)}</Cell>
          <Cell className="bk-acct-what">
            <span className={cx('bk-acct-text', fresh.includes(line.id) && 'bk-written')}>{line.text}</span>
            <small>{byline(line)}</small>
          </Cell>
          <Cell label={line.papers.length ? 'Paper' : undefined}>
            {line.papers.length > 0 && (
              <span className="bk-acct-plinks">
                {line.papers.map(paper => (
                  <a key={`${paper.sourceId}@${paper.revision}`} className="bk-link bk-acct-plink" href={href('papers', paperId(paper.sourceId, paper.revision))}>{paper.label}</a>
                ))}
              </span>
            )}
          </Cell>
          <Cell num rule="double" label="They promised">
            {line.promisedCents != null ? (line.offer ? <span className="bk-muted">({ledger(line.promisedCents)})</span> : ledger(line.promisedCents)) : null}
          </Cell>
          <Cell num rule="red" label="Credited so far">{line.creditedCents != null ? ledger(line.creditedCents) : null}</Cell>
          <Cell num rule="red" owed={line.id === standingLine && line.owedCents > 0} label="Still owed">{line.owedCents != null ? ledger(line.owedCents) : null}</Cell>
          <Cell rule="double" />
        </Row>
      ))}
    </Ledger>
  );
}

// ---- the papers the promise rests on ----

/** A paper's own text. The sentence with the money in it is run over with the highlighter. */
function PaperText({ text }) {
  const rows = String(text || '').split('\n').filter(row => row.trim());
  let lit = false;
  return rows.map((row, i) => {
    if (/^[A-Z][A-Z ]{11,}$/.test(row.trim())) return <p key={i} className="bk-acct-paper-mark">{row.trim()}</p>;
    const sentences = row.match(/[^.!?]+(?:[.](?=\d)[^.!?]*)*[.!?]+\s*|[^.!?]+$/g) || [row];
    return (
      <p key={i}>
        {sentences.map((sentence, j) => {
          if (lit || !/(USD|\$)\s?\d/.test(sentence)) return sentence;
          lit = true;
          return <span key={j} className="bk-hl">{sentence.trimEnd()}</span>;
        }).flatMap((part, j) => (typeof part === 'string' ? [part] : [part, ' ']))}
      </p>
    );
  });
}

function DeskPapers({ view, commitment, year }) {
  // In the order they were written: the promise, then what came after it.
  const papers = useMemo(
    () => correspondenceDocuments(view, commitment)
      .filter(paper => paper.available)
      .sort((a, b) => String(a.source.effectiveDate).localeCompare(String(b.source.effectiveDate)) || a.revision - b.revision),
    [view, commitment],
  );
  if (!papers.length) return null;
  return (
    <section className="bk-part bk-acct-desk" aria-labelledby="bk-acct-desk-h">
      <h2 className="bk-h2" id="bk-acct-desk-h">{papers.length === 1 ? 'The paper it rests on' : 'The papers it rests on'} <small>{papers.length}</small></h2>
      <div className="bk-acct-fan">
        {papers.map(paper => {
          const look = paperLook(paper, commitment);
          return (
            <Paper
              key={`${paper.sourceId}@${paper.revision}`}
              as="a"
              href={href('papers', paperId(paper.sourceId, paper.revision))}
              className="bk-doc bk-acct-paper"
              aria-label={`${look.name}: ${paper.title}`}
            >
              <span className="bk-doc-kind">{look.name} · {shortDay(paper.source?.effectiveDate || paper.observedAt, year)}</span>
              <h2 className="bk-doc-title">{paper.title}</h2>
              <PaperText text={paper.text} />
            </Paper>
          );
        })}
      </div>
    </section>
  );
}
