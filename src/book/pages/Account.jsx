// One promise's account: what is still owed on it, everything that happened to
// it, what to do next, and the papers it rests on.
//
//   #/iou/<commitmentId>            the page
//   #/iou/<commitmentId>?a=<id>     the same page, with that decision's slip brought forward
//
// The lines of the ledger are built in ./account/entries.mjs (pure, tested).
// The offers, the decision slip and the house rules are ./account/acct-Next.jsx.

import React, { useEffect, useMemo, useRef } from 'react';
import { correspondenceDocuments } from '../../correspondence.mjs';
import { Cell, Ledger, Paper, Row, Sheet, SheetHead, Stamp, Tally, Total, cx } from '../shell/parts.jsx';
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

const backLink = <a className="bk-link bk-acct-back" href={href('ious')}>← All IOUs</a>;

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
        <SheetHead back={backLink} title="That IOU isn’t in this book." />
        <div className="bk-part">
          <a className="bk-btn" href={href('ious')}>Back to all IOUs</a>
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
          title={company}
          lede={<span className="bk-acct-said">“{whatTheySaid(view, commitment)}”</span>}
          side={<Owed commitment={commitment} state={state} />}
        >
          <p className="bk-acct-due">{dueLine(commitment, state, year)}</p>
          <Strip commitment={commitment} state={state} />
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

/** "due Oct 1, 2026 · PC-SEATS-2026", and the claim window when there is one. */
function dueLine(commitment, state, year) {
  const parts = [`${state === 'offer' ? 'on offer for' : 'due'} ${day(commitment.dueDate)}`];
  if (commitment.originalDueDate && commitment.originalDueDate !== commitment.dueDate) parts[0] += ` (first promised for ${shortDay(commitment.originalDueDate, year)})`;
  parts.push(commitment.reference);
  const window = commitment.deadline;
  if (window?.date) parts.push(`${window.state === 'expired' ? 'claims closed' : 'claims close'} ${shortDay(window.date, year)}`);
  return parts.join(' · ');
}

/** The figure this page is for, and the stamp that says where the promise stands. */
function Owed({ commitment, state }) {
  if (state === 'offer') {
    return (
      <div className="bk-acct-side">
        <span className="bk-owed-label is-none">On offer, not owed</span>
        <b className="bk-owed is-none">{ledger(commitment.promisedCents)}</b>
        <Stamp small seed={`only-if-${commitment.id}`}>Only if</Stamp>
      </div>
    );
  }
  const paid = state === 'paid';
  return (
    <div className="bk-acct-side">
      <span className={cx('bk-owed-label', paid && 'is-none')}>Still owed</span>
      <b className={cx('bk-owed', paid && 'is-none')}>{ledger(commitment.outstandingCents)}</b>
      {paid && <Stamp seed={`paid-${commitment.id}`}>Paid</Stamp>}
      {state === 'overdue' && <Stamp ink="red" seed={`overdue-${commitment.id}`}>Overdue</Stamp>}
    </div>
  );
}

/** The strip of boxes, punched as money reaches an invoice, and the sum under it. */
function Strip({ commitment, state }) {
  const { promisedCents, verifiedCents, outstandingCents, issuedCents } = commitment;
  const offer = state === 'offer', paid = state === 'paid';
  const strip = stripFor(promisedCents, offer ? 0 : verifiedCents, paid);
  const mark = i => {
    if (i === strip.count) return dollars(promisedCents);
    return i % 5 === 0 && strip.count - i >= 5 ? dollars(i * strip.boxCents) : '';
  };
  return (
    <div className="bk-acct-strip">
      <div className="bk-acct-strip-row">
        <div className={cx('paper bk-acct-slip', !offer && !paid && 'is-owed')} style={{ '--n': strip.count }}>
          <Tally key={`${commitment.id}-${strip.boxCents}-${promisedCents}`} boxes={strip.boxes} punched={strip.punched} mark={mark} seed={`acct-${commitment.id}`} />
        </div>
        <span className="bk-acct-box">one box is {dollars(Math.min(strip.boxCents, promisedCents))}</span>
      </div>
      <p className="bk-acct-sum">
        {offer ? (
          <>{dollars(promisedCents)} on offer. Nothing is owed unless you take it.</>
        ) : (
          <>
            {dollars(promisedCents)} promised − {dollars(verifiedCents)} on {verifiedCents > 0 ? 'the invoice' : 'an invoice'} ={' '}
            {paid ? <b>nothing owed</b> : <b className="is-owed">{dollars(outstandingCents)} still owed</b>}
          </>
        )}
        {!offer && !paid && issuedCents > 0 && (
          <span className="bk-acct-note"> A {dollars(issuedCents)} credit note is in. A note is not money until it shows on an invoice.</span>
        )}
      </p>
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

const TURNS = [-1.7, 1.1, -0.6, 1.9, -1.2, 0.7];

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
  const count = ['', 'The paper', 'The two papers', 'The three papers', 'The four papers', 'The five papers'][papers.length] || `The ${papers.length} papers`;
  return (
    <div className="bk-on-desk bk-acct-desk">
      <p className="bk-desk-said">{count} this promise rests on.</p>
      <div className="bk-desk-row bk-acct-fan">
        {papers.map((paper, i) => {
          const look = paperLook(paper, commitment);
          return (
            <Paper
              key={`${paper.sourceId}@${paper.revision}`}
              as="a"
              href={href('papers', paperId(paper.sourceId, paper.revision))}
              stock={look.stock}
              w={108}
              rot={TURNS[i % TURNS.length]}
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
    </div>
  );
}
