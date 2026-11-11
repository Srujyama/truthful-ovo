// What each place in the quarter opens onto: the inside of the right-hand panel
// (the world draws the frame and the close button). In Nomen's order:
// a small picture of the thing, its name, its job, what it is doing now, the real
// records, and the way to its page.
//
//   <StationPanel station="scale" view={view} service={service} go={go} onClose={…} onApprove={id => …} />
//   <VendorPanel vendorId="pipeline" view={view} service={service} go={go} onClose={…} />
//
// station: post | read | book | scale | letter | you | clock. view may be null (nothing is drawn).
// onApprove(commitmentId) is the world's: your desk's Approve this letter calls it and waits.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import './panels.css';
import { Coin, CoinStrip } from '../../ui/Coins.jsx';
import { dateDay, isOffer, keeperFor, letterFor, money, stillOwedCents } from '../../front/selectors.mjs';
import { plainFailure } from '../../front/commands.mjs';
import { href, paperId } from '../../shell/route.mjs';
import { clock as clockTime } from '../../shell/money.mjs';
import { splitByPassages, waitingOnInvoice } from '../../pages/papers/kinds.mjs';
import { inkFor, markFor, markSVG } from '../../pages/papers/glyphs.js';
import { todoLines, waitingOn } from '../../pages/records/plain.mjs';
import { operationQueue } from '../../../operations.mjs';
import { C, STATION } from './world.js';
import {
  clockOf, lastRead, letters, papersIn, promiseParts, promiseStanding, stationNow, vendorNow, vendorOf,
} from './lines.mjs';

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const possessive = (name) => `${name}’${/s$/i.test(name) ? '' : 's'}`;
const hex = (n) => `#${Number(n).toString(16).padStart(6, '0')}`;

/** A company's colour: the roof of its house, in the order the book lists the companies. */
export function vendorColor(view, vendorId) {
  const i = Math.max(0, view?.vendors?.findIndex((v) => v.id === vendorId) ?? 0);
  return hex(C.tabs[i % C.tabs.length]);
}

// · the parts every panel is made of

/** A link that moves the book with go(), so the page lands at its top. */
function Go({ go, page, id = '', query = null, className = 'bk-link', children, label }) {
  return (
    <a className={className} href={href(page, id, query)} aria-label={label} onClick={(event) => {
      if (!go || event.metaKey || event.ctrlKey || event.shiftKey || event.button) return;
      event.preventDefault();
      go(page, id, query);
    }}>{children}</a>
  );
}

function Panel({ pic, who, name, job, now, children, foot }) {
  return (
    <div className="qp">
      <header className="qp-head">
        <div className="qp-pic" aria-hidden="true">{pic}</div>
        <div className="qp-id">
          <p className="t-label qp-who">{who}</p>
          <h2 className="qp-name" tabIndex={-1}>{name}</h2>
          {job && <p className="qp-job">{job}</p>}
        </div>
      </header>
      {now && <p className="qp-now">{now}</p>}
      {children}
      {foot && <footer className="qp-foot">{foot}</footer>}
    </div>
  );
}

function Part({ name, count, children, className = '' }) {
  return (
    <section className={`qp-part ${className}`}>
      <h3 className="t-label qp-part-name">{name}{count != null ? <span className="qp-count"> · {count}</span> : null}</h3>
      {children}
    </section>
  );
}

/** One leader row: what, the dots, the figure. A link when it has somewhere to go. */
function Row({ go, to, lead, small, value, owed = false, quiet = false, mark = null, label }) {
  const body = (
    <>
      <span className="qp-lead">
        {mark}
        <span className="qp-lead-words">
          <span className="qp-lead-name">{lead}</span>
          {small && <small className="qp-small">{small}</small>}
        </span>
      </span>
      <span className="t-dots" />
      <span className={`qp-fig${owed ? ' is-owed' : ''}${quiet ? ' is-quiet' : ''}`}>{value}</span>
    </>
  );
  return to
    ? <Go go={go} page={to[0]} id={to[1]} query={to[2]} className="t-row qp-row is-link" label={label}>{body}</Go>
    : <div className="t-row qp-row" aria-label={label}>{body}</div>;
}

function Mark({ mark, ink = 'ink', u = 2 }) {
  return <span className="qp-mark" aria-hidden="true" dangerouslySetInnerHTML={{ __html: markSVG(mark, ink, u) }} />;
}

// · coins

const C100 = 10000;
/** One coin is $100, unless the promise is so large its coins would not fit; then the smallest round sum that keeps it to 45. */
function coinWorth(cents) {
  for (const each of [C100, 25000, 50000, 100000, 250000, 500000, 1000000, 2500000, 5000000]) if (Math.ceil(cents / each) <= 45) return each;
  return Math.ceil(cents / 45 / 1000000) * 1000000;
}
function coinsOf(c, each = coinWorth(c.promisedCents)) {
  const total = Math.max(1, Math.ceil(c.promisedCents / each));
  if (isOffer(c)) return Array(total).fill('offer');
  const parts = promiseParts(c);
  const owing = Math.min(total, Math.ceil((parts.owed + parts.note) / each));
  const noted = Math.min(owing, Math.ceil(parts.note / each));
  const came = total - owing;
  return Array.from({ length: total }, (_, i) => (i < came ? 'in' : i < came + noted ? 'note' : 'owed'));
}
/** The coin that says the most about a promise. */
function faceOf(c) {
  const states = new Set(coinsOf(c));
  for (const s of ['offer', 'owed', 'note', 'in']) if (states.has(s)) return s;
  return 'in';
}
const LEGEND = { in: 'came in', owed: 'still owed', note: 'credit note only', offer: 'on offer' };

function Legend({ promises }) {
  const seen = new Set(promises.flatMap((c) => coinsOf(c)));
  const worths = new Set(promises.map((c) => coinWorth(c.promisedCents)));
  if (!seen.size) return null;
  return (
    <p className="qp-legend">
      {['in', 'owed', 'note', 'offer'].filter((s) => seen.has(s)).map((s) => (
        <span key={s} className="qp-legend-item"><Coin state={s} u={1} />{LEGEND[s]}</span>
      ))}
      <span className="qp-legend-item is-worth">{worths.size === 1 ? `one coin is ${money([...worths][0])}` : 'one coin is $100 or more'}</span>
    </p>
  );
}

function figureFor(c) {
  if (isOffer(c)) return { value: `${money(c.promisedCents)} on offer`, quiet: true };
  const owed = stillOwedCents(c);
  return owed > 0 ? { value: money(owed), owed: true } : { value: 'paid', quiet: true };
}

/** One promise: whose it is, its coins, what is still owed, where it stands. The whole block opens its page. */
function PromiseRow({ view, c, go, title, figure = null }) {
  const fig = figure ?? figureFor(c);
  const states = coinsOf(c);
  const parts = promiseParts(c);
  const said = `${title}: ${money(c.promisedCents)} promised, ${money(parts.in)} came in, ${isOffer(c) ? 'an offer' : `${money(stillOwedCents(c))} still owed`}`;
  return (
    <Go go={go} page="iou" id={c.id} className="qp-promise" label={said}>
      <span className="qp-promise-top">
        <span className="qp-promise-name">{title}</span>
        <span className="t-dots" />
        <span className={`qp-fig${fig.owed ? ' is-owed' : ''}${fig.quiet ? ' is-quiet' : ''}`}>{fig.value}</span>
      </span>
      <CoinStrip states={states} u={2} perRow={15} label={said} className="qp-strip" />
      <small className="qp-small">{promiseStanding(view, c)} · {c.reference}</small>
    </Go>
  );
}

// · papers

function PaperRows({ view, items, go }) {
  return items.map((item) => {
    const credit = item.type === 'credit';
    return (
      <Row
        key={item.key}
        go={go}
        to={['papers', item.address]}
        mark={<Mark mark={markFor(item)} ink={inkFor(item, waitingOnInvoice(view, item))} />}
        lead={credit ? `${item.noun} ${item.title}` : item.title}
        small={credit ? `${item.company} · ${money(item.amountCents)}${item.onInvoice ? '' : ', not on an invoice yet'}` : `${item.noun.toLowerCase()} from ${item.company}`}
        value={dateDay(item.date)}
        quiet
      />
    );
  });
}

// · the letter

function approvedWords(letter) {
  const at = new Date(letter.approvedAt);
  return `approved${letter.approvedByYou ? ' by you' : ''}, ${dateDay(letter.approvedAt)}, ${clockTime(at)}`;
}

function LetterSheet({ letter }) {
  return (
    <div className={`t-box qp-letter${letter.approvedAt ? ' is-approved' : ''}`}>
      <span className="t-box-name">letter</span>
      <p className="qp-letter-field"><span className="t-label">to</span><span>{letter.to}</span></p>
      <p className="qp-letter-field"><span className="t-label">subject</span><span>{letter.subject}</span></p>
      <div className="qp-letter-body">{letter.body}</div>
      {letter.approvedAt && <p className="t-label qp-approved">{approvedWords(letter)}</p>}
    </div>
  );
}

/** The book's letter for a promise, as its page shows it. Needs the workspace the view was read from. */
function useLetter(service, view, commitment) {
  return useMemo(() => {
    if (!service?.workspace || !commitment) return null;
    try { return letterFor(service.workspace, view, commitment, keeperFor(service)); } catch { return null; }
  }, [service?.workspace, view, commitment, service?.session, service?.actor?.id]);
}

// · the stations

const JOB = {
  post: 'Papers come in here: emails, agreements, invoices. The postmaster hands each one to the reader.',
  read: 'The reader finds the promise or the credit in each paper and marks the figure.',
  book: 'The scribe writes each promise down as an IOU.',
  scale: 'The checker weighs every invoice against the promise. The light side is what is still owed.',
  letter: 'The writer drafts the letter asking for the rest.',
  you: 'Nothing goes out until you sign it.',
  clock: 'Due dates and windows to claim. It rings when one passes and money is still owed.',
};
const WHO = { post: 'the postmaster', read: 'the reader', book: 'the scribe', scale: 'the checker', letter: 'the writer', you: 'you', clock: 'in the square' };
const nameOf = (station) => STATION[station]?.name ?? (station === 'clock' ? 'The clock' : '');

function Post({ view, go }) {
  const papers = papersIn(view);
  const shown = papers.slice(0, 6);
  return (
    <Panel
      pic={papers.length ? (
        <span className="qp-pile">{papers.slice(0, 4).map((item) => <Mark key={item.key} mark={markFor(item)} ink={inkFor(item, waitingOnInvoice(view, item))} u={3} />)}</span>
      ) : <Mark mark="letter" ink="old" u={5} />}
      who={WHO.post}
      name={nameOf('post')}
      job={JOB.post}
      now={stationNow('post', view)}
      foot={<Go go={go} page="tray">Add what they sent you →</Go>}
    >
      {shown.length > 0 && (
        <Part name="newest first" count={papers.length}>
          <PaperRows view={view} items={shown} go={go} />
          {papers.length > shown.length && <p className="qp-more"><Go go={go} page="papers" className="bk-link qp-more-link">All {papers.length} in Papers →</Go></p>}
        </Part>
      )}
    </Panel>
  );
}

function Read({ view, go }) {
  const read = lastRead(view);
  const parts = read ? splitByPassages(read.text, read.passages) : [];
  return (
    <Panel
      pic={read ? <mark className="qp-hl qp-pic-figure">{read.figure}</mark> : <Mark mark="letter" ink="old" u={5} />}
      who={WHO.read}
      name={nameOf('read')}
      job={JOB.read}
      now={stationNow('read', view)}
      foot={read
        ? <Go go={go} page="papers" id={paperId(read.source.id, read.source.revision)}>Open it in Papers →</Go>
        : <Go go={go} page="papers">Open Papers →</Go>}
    >
      {read && (
        <>
          <div className="t-box qp-paper">
            <span className="t-box-name">{read.noun.toLowerCase()} · {read.company} · {dateDay(read.date)}</span>
            <p className="qp-paper-title">{read.source.title}</p>
            <p className="qp-paper-text">
              {parts.map((part, i) => (part.passage ? <mark key={i} className="qp-hl">{part.text}</mark> : <React.Fragment key={i}>{part.text}</React.Fragment>))}
            </p>
          </div>
          <Part name="what was read" count={read.facts.length}>
            {read.facts.map((fact, i) => {
              const printed = !fact.worked && read.passages.some((p) => p.facts.includes(i));
              return <Row key={`${fact.label}-${i}`} lead={fact.label} small={fact.worked ? 'worked out' : null} value={printed ? <mark className="qp-hl">{fact.value}</mark> : fact.value} />;
            })}
          </Part>
        </>
      )}
    </Panel>
  );
}

function Book({ view, go }) {
  const promises = view.commitments;
  return (
    <Panel
      pic={promises.length
        ? <CoinStrip states={promises.slice(0, 4).map(faceOf)} u={3} perRow={2} label="" />
        : <Coin state="offer" u={5} />}
      who={WHO.book}
      name={nameOf('book')}
      job={JOB.book}
      now={stationNow('book', view)}
      foot={<Go go={go} page="ious">Open the book →</Go>}
    >
      {promises.length > 0 && (
        <Part name="promises" count={promises.length}>
          <Legend promises={promises} />
          {promises.map((c) => {
            const vendor = view.vendors.find((v) => v.id === c.vendorId)?.name ?? c.reference;
            return <PromiseRow key={c.id} view={view} c={c} go={go} title={vendor} />;
          })}
        </Part>
      )}
    </Panel>
  );
}

function Scale({ view, go }) {
  const t = view.totals;
  const owing = view.vendors
    .map((v) => ({ v, cents: view.commitments.filter((c) => c.vendorId === v.id).reduce((sum, c) => sum + stillOwedCents(c), 0) }))
    .filter((item) => item.cents > 0);
  const notes = view.credits.filter((credit) => credit.status === 'issued' && credit.availableCents > 0);
  const offers = view.commitments.filter(isOffer);
  const vendorName = (id) => view.vendors.find((v) => v.id === id)?.name ?? 'A company';
  return (
    <Panel
      pic={<Coin state={t.outstandingCents > 0 ? 'owed' : t.promisedCents > 0 ? 'in' : 'offer'} u={6} />}
      who={WHO.scale}
      name={nameOf('scale')}
      job={JOB.scale}
      now={stationNow('scale', view)}
      foot={<Go go={go} page="balance">Open the balance →</Go>}
    >
      {t.promisedCents > 0 && (
        <div className="qp-sum" role="group" aria-label={`${money(t.outstandingCents)} still owed: ${money(t.promisedCents)} promised, less ${money(t.verifiedCents)} credited so far`}>
          <Row lead={<><i className="qp-op" aria-hidden="true" />they promised</>} value={money(t.promisedCents)} />
          <Row lead={<><i className="qp-op" aria-hidden="true">−</i>credited so far</>} value={money(t.verifiedCents)} />
          <Row lead={<><i className="qp-op" aria-hidden="true">=</i>still owed</>} value={money(t.outstandingCents)} owed={t.outstandingCents > 0} />
        </div>
      )}
      {owing.length > 0 && (
        <Part name="on the light side" count={owing.length}>
          {owing.map(({ v, cents }) => <Row key={v.id} go={go} to={['companies', v.id]} mark={<i className="qp-tab" style={{ background: vendorColor(view, v.id) }} aria-hidden="true" />} lead={v.name} value={money(cents)} owed />)}
        </Part>
      )}
      {(notes.length > 0 || offers.length > 0) && (
        <Part name="not on the scale">
          {notes.map((credit) => (
            <Row key={credit.id} go={go} to={['papers', `credit:${credit.id}`]} lead={`credit note ${credit.invoiceId}`}
              small={`From ${vendorName(credit.vendorId)}. A note is not money until it shows on an invoice.`} value={money(credit.availableCents)} quiet />
          ))}
          {offers.map((c) => (
            <Row key={c.id} go={go} to={['iou', c.id]} lead={`${possessive(vendorName(c.vendorId))} offer`}
              small={`Yours ${promiseStanding(view, c)}.`} value={money(c.promisedCents)} quiet />
          ))}
        </Part>
      )}
    </Panel>
  );
}

function LetterDesk({ view, service, go }) {
  const l = letters(view);
  const first = l.waiting[0] ?? l.signed.at(-1) ?? null;
  const letter = useLetter(service, view, first?.commitment);
  return (
    <Panel
      pic={<Mark mark="letter" ink={l.waiting.length || l.signed.length ? 'ink' : 'old'} u={5} />}
      who={WHO.letter}
      name={nameOf('letter')}
      job={JOB.letter}
      now={stationNow('letter', view)}
      foot={<Go go={go} page="todo">Open To do →</Go>}
    >
      {letter && <LetterSheet letter={letter} />}
      {l.waiting.length > 1 && (
        <Part name="also drafted" count={l.waiting.length - 1}>
          {l.waiting.slice(1).map((item) => <Row key={item.commitment.id} go={go} to={['iou', item.commitment.id]} lead={item.vendor} small={promiseStanding(view, item.commitment)} value={money(item.owedCents)} owed />)}
        </Part>
      )}
      {l.toWrite.length > 0 && (
        <Part name="still to write" count={l.toWrite.length}>
          {l.toWrite.map((item) => <Row key={item.commitment.id} go={go} to={['iou', item.commitment.id]} lead={item.vendor} small={promiseStanding(view, item.commitment)} value={money(item.owedCents)} owed />)}
        </Part>
      )}
    </Panel>
  );
}

function Desk({ view, service, go, onApprove, want = null }) {
  const l = letters(view);
  const [pick, setPick] = useState(null);
  // asked for one promise's letter (the demo): drafted from the book as it stands, even when an earlier draft lapsed
  const wanted = useMemo(() => {
    if (!want || l.waiting.some((w) => w.commitment.id === want)) return null;
    const c = view.commitments.find((x) => x.id === want);
    return c ? { commitment: c, vendor: view.vendors.find((v) => v.id === c.vendorId)?.name ?? '', owedCents: stillOwedCents(c) } : null;
  }, [want, view, l.waiting]);
  const item = l.waiting.find((w) => w.commitment.id === (pick ?? want)) ?? wanted ?? l.waiting[0] ?? null;
  const signed = item ? null : l.signed.at(-1) ?? null;
  const letter = useLetter(service, view, (item ?? signed)?.commitment);
  const [busy, setBusy] = useState('');
  const [wrong, setWrong] = useState('');
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);
  useEffect(() => { setWrong(''); }, [item?.commitment.id]);

  async function approve() {
    if (!item || !onApprove || busy) return;
    setBusy(item.commitment.id);
    setWrong('');
    try {
      await onApprove(item.commitment.id);
    } catch (error) {
      if (alive.current) setWrong(plainFailure(error));
    } finally {
      if (alive.current) setBusy('');
    }
  }

  const queue = item ? [] : operationQueue(view, {}).filter((row) => row.category !== 'scheduled').slice(0, 5);
  const role = service?.actor?.role;
  const target = item ?? signed;
  return (
    <Panel
      pic={<span className="qp-count-pic"><b>{l.waiting.length + (wanted && !letter?.approvedAt ? 1 : 0)}</b><span className="t-label">to sign</span></span>}
      who={WHO.you}
      name={nameOf('you')}
      job={JOB.you}
      now={wanted && !letter?.approvedAt ? `A letter to ${wanted.vendor} asking for ${money(wanted.owedCents)}, for you to sign.` : stationNow('you', view)}
      foot={target
        ? <Go go={go} page="iou" id={target.commitment.id}>Open {possessive(target.vendor)} promise →</Go>
        : <Go go={go} page="todo">Open To do →</Go>}
    >
      {letter && <LetterSheet letter={letter} />}
      {item && !letter?.approvedAt && (
        <div className="qp-act">
          <button type="button" className="bk-btn" onClick={() => void approve()} disabled={Boolean(busy) || Boolean(service?.busy) || letter?.canApprove === false || !onApprove}>
            {busy ? 'Approving…' : 'Approve this letter'}
          </button>
          {letter?.canApprove === false && letter.why && <p className="qp-why">{letter.why}</p>}
          {letter?.lapsed && <p className="qp-why">The book changed after this was approved. Read it again, then approve it.</p>}
          {wrong && <p className="qp-why" role="alert">{wrong}</p>}
        </div>
      )}
      {signed && letter?.approvedAt && (
        <p className="qp-more"><Go go={go} page="iou" id={signed.commitment.id} className="bk-link qp-more-link">Copy or download it →</Go></p>
      )}
      {l.waiting.length > 1 && (
        <Part name="also on your desk" count={l.waiting.length - 1}>
          {l.waiting.filter((w) => w !== item).map((w) => (
            <button key={w.commitment.id} type="button" className="t-row qp-row is-link qp-pick" onClick={() => setPick(w.commitment.id)}>
              <span className="qp-lead"><span className="qp-lead-words"><span className="qp-lead-name">{w.vendor}</span><small className="qp-small">read this one</small></span></span>
              <span className="t-dots" />
              <span className="qp-fig is-owed">{money(w.owedCents)}</span>
            </button>
          ))}
        </Part>
      )}
      {queue.length > 0 && (
        <Part name="what the book waits on" count={queue.length}>
          {queue.map((row) => {
            const line = todoLines(row, view);
            const who = waitingOn(line, role);
            return <Row key={row.id} go={go} to={row.commitmentId ? ['iou', row.commitmentId] : ['todo']} lead={row.vendorName} small={line.what} value={who === 'you' ? 'you' : who} quiet={who !== 'you'} />;
          })}
        </Part>
      )}
    </Panel>
  );
}

function Clock({ view, go }) {
  const clock = clockOf(view);
  const [, m, d] = view.asOf.split('-').map(Number);
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const coming = [
    ...clock.soon.map((item) => ({ key: `soon:${item.commitment.id}`, item, small: `${money(item.owedCents)} still owed · last day to claim`, value: dateDay(item.by), when: item.by })),
    ...clock.due.map((item) => ({ key: `due:${item.commitment.id}`, item, small: `${money(item.owedCents)} due`, value: dateDay(item.due), when: item.due })),
  ].sort((a, b) => a.when.localeCompare(b.when));
  return (
    <Panel
      pic={<span className="qp-day"><span className="t-label">{months[m - 1]}</span><b>{d}</b></span>}
      who={WHO.clock}
      name={nameOf('clock')}
      job={JOB.clock}
      now={stationNow('clock', view)}
      foot={<Go go={go} page="todo">Open To do →</Go>}
    >
      {clock.late.length > 0 && (
        <Part name="late" count={clock.late.length}>
          {[...clock.late].reverse().map((item) => (
            <Row key={item.commitment.id} go={go} to={['iou', item.commitment.id]} lead={item.vendor}
              small={<><span className="qp-red">{money(item.owedCents)}</span> still owed · due {dateDay(item.since)}</>} value={plural(item.days, 'day')} />
          ))}
        </Part>
      )}
      {clock.closed.length > 0 && (
        <Part name="window to claim closed" count={clock.closed.length}>
          {clock.closed.map((item) => (
            <Row key={item.commitment.id} go={go} to={['iou', item.commitment.id]} lead={item.vendor}
              small={<><span className="qp-red">{money(item.owedCents)}</span> still owed</>} value={dateDay(item.on)} />
          ))}
        </Part>
      )}
      {coming.length > 0 && (
        <Part name="coming up" count={coming.length}>
          {coming.map(({ key, item, small, value }) => <Row key={key} go={go} to={['iou', item.commitment.id]} lead={item.vendor} small={small} value={value} quiet />)}
        </Part>
      )}
    </Panel>
  );
}

const BODIES = { post: Post, read: Read, book: Book, scale: Scale, letter: LetterDesk, you: Desk, clock: Clock };

/** The inside of a station's panel. */
export function StationPanel({ station, view, service, go, onClose, onApprove, want }) {
  const Body = BODIES[station];
  if (!view || !Body) return null;
  return <Body view={view} service={service} go={go} onClose={onClose} onApprove={onApprove} want={want} />;
}

// · a company's house

/** The inside of a company's panel. */
export function VendorPanel({ vendorId, view, service, go, onClose }) {
  const v = view ? vendorOf(view, vendorId) : null;
  if (!v) return null;
  const faces = new Set(v.promises.map(faceOf));
  const face = ['owed', 'note', 'offer', 'in'].find((s) => faces.has(s)) ?? 'offer';
  const standing = v.state === 'owes' ? <span className="qp-red">owes {money(v.owedCents)}</span>
    : v.state === 'lost' ? <span className="qp-red">owes {money(v.owedCents)}, too late to claim</span>
      : v.state === 'paid' ? 'paid in full'
        : v.state === 'offer' ? `on offer: ${money(v.offerCents)}`
          : 'nothing promised yet';
  return (
    <div className="qp is-vendor">
      <header className="qp-head">
        <div className="qp-pic qp-house" aria-hidden="true">
          <i className="qp-roof" style={{ background: vendorColor(view, v.id) }} />
          <Coin state={face} u={3} />
        </div>
        <div className="qp-id">
          <p className="t-label qp-who">a company · {plural(v.papers.length, 'paper')}</p>
          <h2 className="qp-name" tabIndex={-1}>{v.name}</h2>
          <p className="qp-standing">{standing}</p>
        </div>
      </header>
      <p className="qp-now">{vendorNow(view, v.id)}</p>
      {v.promises.length > 0 && (
        <Part name="promises" count={v.promises.length}>
          <Legend promises={v.promises} />
          {v.promises.map((c) => (
            <PromiseRow key={c.id} view={view} c={c} go={go}
              title={`${money(c.promisedCents)} ${isOffer(c) ? 'offered' : 'promised'} ${dateDay(c.effectiveDate || c.createdAt)}`}
              figure={isOffer(c) ? { value: 'on offer', quiet: true } : null} />
          ))}
        </Part>
      )}
      {v.papers.length > 0 && (
        <Part name="papers" count={v.papers.length}>
          <PaperRows view={view} items={v.papers} go={go} />
        </Part>
      )}
      <footer className="qp-foot"><Go go={go} page="companies" id={v.id}>Open {v.name} →</Go></footer>
    </div>
  );
}
