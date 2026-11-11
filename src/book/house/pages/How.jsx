// How it works. The four kinds of coin, one open at a time, and the life of one
// promise told by the book itself: each day something happened, and its coins that day.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import '../home.css';
import './how.css';
import { evaluateWorkspace } from '../../../assurance/index.mjs';
import { Coin, CoinStrip } from '../../ui/Coins.jsx';
import { coinStates, crowdOf, pickPromise } from '../../ui/crowd.js';
import { claimClosedOn, dateDay, isOffer, keeperFor, letterFor, money, offersFor, papersFor, quoteFor, stillOwedCents } from '../../front/selectors.mjs';
import { href } from '../../shell/route.mjs';

const calmNow = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const monthOf = (iso) => MONTHS[Number(String(iso).slice(5, 7)) - 1] ?? '';
const NUMBER = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];

// What each kind of coin is, from the book's own rules (the engine decides; these are its rules in words).
const KIND = {
  in: {
    name: 'Came in',
    means: 'Money that came off an invoice and was matched to the promise.',
    needs: 'An invoice from the same company with the credit on it, under the promise’s reference. A matching amount alone is not enough.',
    not: 'That they paid you cash. It came off what you owe them.',
    answers: [['Yes.'], ['Yes. An invoice shows it.'], ['No.']],
  },
  owed: {
    name: 'Still owed',
    means: 'Promised in writing, and no invoice shows it yet.',
    needs: 'A promise in writing: who, how much, by when, and the reference it will come under.',
    not: 'That they said no. Truthful drafts a letter asking for it, and nothing goes out until you approve it.',
    answers: [['Yes.'], ['Not yet.'], ['Yes.', true]],
  },
  note: {
    name: 'Credit note only',
    means: 'They sent a credit note for it, but no invoice has taken it off yet.',
    needs: 'A credit note from the company, matched to the promise.',
    not: 'That you have it. A credit note is not money until it shows on an invoice.',
    answers: [['Yes.'], ['Only on a credit note.'], ['Yes.', true]],
  },
  offer: {
    name: 'On offer',
    means: 'A credit they offer only if you agree to more, like a renewal.',
    needs: 'Your yes, inside the house rules: one person prepares it, one approves it, one writes it in.',
    not: 'That they owe it. Nothing is owed unless you agree.',
    answers: [['Only if you agree.'], ['No.'], ['No.']],
  },
};
const ORDER = ['in', 'owed', 'note', 'offer'];
const QUESTIONS = ['Did they promise it?', 'Did it come in?', 'Is it still owed?'];

/** One big coin that turns over to its new face when the kind changes. */
function TurningCoin({ state, u }) {
  const [face, setFace] = useState({ state, frame: 0 });
  const timer = useRef(0);
  useEffect(() => {
    if (state === face.state && face.frame === 0) return undefined;
    if (calmNow()) { setFace({ state, frame: 0 }); return undefined; }
    const steps = [[face.state, 1], [face.state, 2], [face.state, 3], [state, 3], [state, 2], [state, 1], [state, 0]];
    let i = 0;
    const next = () => {
      setFace({ state: steps[i][0], frame: steps[i][1] });
      i += 1;
      if (i < steps.length) timer.current = setTimeout(next, 42);
    };
    next();
    return () => clearTimeout(timer.current);
    // only a new kind starts a turn
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  return <Coin state={face.state} u={u} frame={face.frame} />;
}

function Kinds({ view, narrow }) {
  const crowd = useMemo(() => crowdOf(view), [view]);
  const [kind, setKind] = useState('owed');
  const entry = KIND[kind];
  const coins = (k) => crowd.marks.filter((m) => m.state === k).length;
  const keys = (event) => {
    const step = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = ORDER[(ORDER.indexOf(kind) + step + ORDER.length) % ORDER.length];
    setKind(next);
    event.currentTarget.querySelector(`[data-kind="${next}"]`)?.focus();
  };
  return (
    <section className="hw-kinds" aria-label="The four kinds of coin">
      <div className="hw-list" role="radiogroup" aria-label="Kind of coin" onKeyDown={keys}>
        {ORDER.map((k) => (
          <button key={k} type="button" role="radio" aria-checked={k === kind} tabIndex={k === kind ? 0 : -1} data-kind={k}
            aria-label={`${KIND[k].name}: ${money(crowd.sums[k])} in this book`} onClick={() => setKind(k)}>
            <Coin state={k} u={3} />
            <span className="hw-list-name">{KIND[k].name}</span>
            <span className={`hw-list-figure${(k === 'owed' || k === 'note') && crowd.sums[k] > 0 ? ' is-owed' : ''}`}>{money(crowd.sums[k])}</span>
          </button>
        ))}
      </div>
      <div className="hw-one">
        <div className="hw-one-head">
          <TurningCoin state={kind} u={narrow ? 14 : 20} />
          <div>
            <h2 className="t-title">{entry.name} <span className="t-label">{coins(kind)} {coins(kind) === 1 ? 'coin' : 'coins'} in this book</span></h2>
            <p className="t-lead" aria-live="polite">{entry.means}</p>
          </div>
        </div>
        <dl className="hw-takes">
          <div><dt className="t-label">it needs</dt><dd>{entry.needs}</dd></div>
          <div><dt className="t-label">it doesn’t mean</dt><dd>{entry.not}</dd></div>
        </dl>
        <dl className="cv-answers">
          {QUESTIONS.map((q, i) => (
            <div key={q}>
              <dt>{q}</dt>
              <dd className={entry.answers[i][1] ? 'is-owed' : undefined}>{entry.answers[i][0]}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

// · one promise, start to now

const NOUN = { email: 'an email', agreement: 'their agreement', report: 'a service report', pasted: 'writing' };

function offerWords(o) {
  if (o.kind === 'later') return o.due ? `pay the rest on ${dateDay(o.due)}` : 'pay the rest later';
  if (o.kind === 'renew') return 'the rest only if you renew';
  return 'different terms';
}

/** Each day something happened to one promise, in order, with its coins as they stood that day. */
function lifeOf(service, view, c) {
  const workspace = service.workspace;
  const vendor = view.vendors.find((v) => v.id === c.vendorId)?.name ?? 'A company';
  const quote = quoteFor(view, c);
  const papers = papersFor(view, c, quote);
  const coinsOn = (day) => {
    try {
      // as the book stood on that day, read with everything it knows now (a day is a UTC day to the engine, not the reader's)
      const then = evaluateWorkspace(workspace, { asOf: day, knownAt: view.knownAt });
      const found = then.commitments.find((x) => x.id === c.id);
      return found ? coinStates(found) : null;
    } catch { return null; }
  };
  const rows = [];
  const said = papers.promise[0];
  const first = said?.date ?? c.effectiveDate;
  const promised = c.originalPromisedCents ?? c.promisedCents;
  rows.push({
    day: first,
    text: isOffer(c)
      ? `${vendor} offered ${money(promised)}, but only if you agree to more.`
      : `${vendor} promised ${money(promised)}${said ? ` in ${NOUN[said.kind] ?? 'writing'}` : ''}.`,
  });
  const invoiceMonths = papers.invoices.map((inv) => monthOf(inv.date));
  for (const inv of papers.invoices) {
    const twice = invoiceMonths.filter((m) => m === monthOf(inv.date)).length > 1;
    rows.push({ day: inv.date, text: `${twice ? `Invoice ${inv.id}` : `The ${monthOf(inv.date)} invoice`} took off ${money(inv.creditCents)}.` });
  }
  for (const note of papers.notes) {
    rows.push({ day: note.date, text: `Credit note ${note.id} came for ${money(note.cents)}.${note.onInvoice ? '' : ' It is not on an invoice yet.'}` });
  }
  const offers = offersFor(workspace, view, c);
  const byDay = new Map();
  for (const o of offers) {
    const day = (view.amendments.find((a) => a.id === o.id)?.proposedAt ?? '').slice(0, 10) || view.asOf;
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(o);
    if (o.decision) {
      rows.push({ day: String(o.decision.at).slice(0, 10), text: o.decision.type === 'accepted' ? `You took their offer: ${offerWords(o)}.` : `You turned down their offer: ${offerWords(o)}.` });
    }
  }
  for (const [day, list] of byDay) {
    const words = list.map(offerWords);
    const lead = list.length === 1 ? 'One offer' : `${NUMBER[list.length] ?? list.length} offers`;
    rows.push({ day, text: `${lead}: ${words.length > 1 ? `${words.slice(0, -1).join(', ')}, or ${words.at(-1)}` : words[0]}. An offer is not a promise.` });
  }
  rows.sort((a, b) => a.day.localeCompare(b.day));

  const owed = stillOwedCents(c);
  let now;
  if (isOffer(c)) now = 'Nothing is owed unless you agree to more.';
  else if (owed === 0) now = 'Paid in full.';
  else {
    const closed = claimClosedOn(workspace, view, c);
    const letter = closed ? null : letterFor(workspace, view, c, keeperFor(service));
    now = `${money(owed)} still owed.${closed ? ` The window to claim it closed ${dateDay(closed)}.`
      : letter?.approvedAt ? ` You approved a letter asking for it on ${dateDay(letter.approvedAt)}.`
        : letter ? ' A letter asking for it waits for your approval.' : ''}`;
  }
  rows.push({ day: view.asOf, today: true, text: now });
  for (const row of rows) row.coins = row.today ? coinStates(c) : coinsOn(row.day);
  return { vendor, promised, rows, letter: !isOffer(c) && owed > 0 };
}

// The promise with the most to tell: money that came in, offers, and still something owed.
function richest(view) {
  const score = (c) => (c.verifiedCents > 0 ? 2 : 0) + (stillOwedCents(c) > 0 ? 1 : 0)
    + view.amendments.filter((a) => a.commitmentId === c.id).length;
  const real = view.commitments.filter((c) => !isOffer(c));
  return real.length ? real.reduce((best, c) => (score(c) > score(best) ? c : best)) : pickPromise(view);
}

function Life({ service, view, go, narrow }) {
  const c = richest(view);
  if (!c || !service.workspace) return null;
  const life = lifeOf(service, view, c);
  return (
    <section className="hw-life" aria-labelledby="hw-life-title">
      <div className="hw-life-name"><p className="t-label">one promise, start to now</p></div>
      <div className="hw-life-body">
        <h2 className="t-title" id="hw-life-title">What happened to {life.vendor}’s {money(life.promised)}.</h2>
        <ol className="hw-rows">
          {life.rows.map((row, i) => (
            <li key={`${row.day}:${i}`} className={row.today ? 'is-today' : undefined}>
              <span className="hw-day">{row.today ? 'today' : dateDay(row.day)}</span>
              <p>{row.text}</p>
              {row.coins && <CoinStrip states={row.coins} u={2} gap={2} perRow={narrow ? 12 : 12} label={`Its coins ${row.today ? 'today' : `on ${dateDay(row.day)}`}`} />}
            </li>
          ))}
        </ol>
        {life.letter && <p className="hw-foot">Nothing goes out until you approve it, and then you send it yourself.</p>}
        <a className="cv-more" href={href('iou', c.id)} onClick={(event) => { if (event.metaKey || event.ctrlKey || event.shiftKey || event.button) return; event.preventDefault(); go('iou', c.id); }}>Open its page</a>
      </div>
    </section>
  );
}

function useNarrow() {
  const [narrow, setNarrow] = useState(() => typeof innerWidth === 'number' && innerWidth < 720);
  useEffect(() => {
    const read = () => setNarrow(innerWidth < 720);
    addEventListener('resize', read);
    return () => removeEventListener('resize', read);
  }, []);
  return narrow;
}

export default function How({ service, view, go }) {
  const narrow = useNarrow();
  return (
    <div className="hw">
      <header className="hw-head">
        <p className="t-label">how it works</p>
        <h1 className="t-display">Promised. Came in. <span className="is-quiet">Still owed.</span></h1>
        <p className="t-lead">One coin is $100 a vendor promised you. It fills in only when an invoice shows it.</p>
      </header>
      {view ? (
        <>
          <Kinds view={view} narrow={narrow} />
          <Life service={service} view={view} go={go} narrow={narrow} />
        </>
      ) : <p className="t-label hw-wait">opening the book…</p>}
      <section className="cv-close hw-close" aria-label="Open the book">
        <h2 className="t-display">Keep yours.</h2>
        <a className="bk-btn is-big" href={href('ious')} onClick={(event) => { if (event.metaKey || event.ctrlKey || event.shiftKey || event.button) return; event.preventDefault(); go('ious'); }}>Open the book</a>
      </section>
    </div>
  );
}
