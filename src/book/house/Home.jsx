// The cover. Every promise in the book stands on it as coins, one per $100. At the top
// they stand by company, each with its name in the margin; scroll, and the same coins
// sort themselves by what they are. Under them, the answer: what is still owed.
// Then one promise set out large, with the lever that brings in its next invoice,
// and one closing line.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import './home.css';
import Crowd from '../ui/Crowd.jsx';
import { Coin, CoinStrip } from '../ui/Coins.jsx';
import { coinStates, crowdOf, partsOf, pickPromise, STATE_WORDS } from '../ui/crowd.js';
import { dateDay, dayFor, isOffer, money, nextInvoiceFor, papersFor, quoteFor, stillOwedCents } from '../front/selectors.mjs';
import { nextInvoiceCommands, plainFailure } from '../front/commands.mjs';
import { href } from '../shell/route.mjs';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const monthOf = (iso) => MONTHS[Number(String(iso).slice(5, 7)) - 1] ?? '';
const NUMBER = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const counted = (n) => NUMBER[n] ?? String(n);
const PAPER = { email: 'email', agreement: 'agreement', report: 'report', pasted: 'paper' };
const calmNow = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// The app never writes a moment earlier than the last one it recorded (as BookFront does).
const momentFor = (workspace) => {
  const now = new Date().toISOString();
  const last = workspace.events.at(-1)?.observedAt;
  return last && last > now ? last : now;
};
const dayNow = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

function useWidth() {
  const [width, setWidth] = useState(() => (typeof innerWidth === 'number' ? innerWidth : 1440));
  useEffect(() => {
    const read = () => setWidth(innerWidth);
    addEventListener('resize', read);
    return () => removeEventListener('resize', read);
  }, []);
  return width;
}

/** A link that moves the book with go(), so the page lands at its top. */
function GoLink({ go, page, id, className, children }) {
  return (
    <a className={className} href={href(page, id)} onClick={(event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.button) return;
      event.preventDefault();
      go(page, id);
    }}>{children}</a>
  );
}

/** The coin a group shows in a list: the one that says the most about it. */
function faceOf(ids, marks) {
  const states = new Set(ids.map((id) => marks.get(id)?.state));
  for (const s of ['offer', 'note', 'owed', 'in']) if (states.has(s)) return s;
  return 'in';
}

// · the crowd and the answer

function Story({ view, go, width, onTry }) {
  const phone = width < 720;
  const crowd = useMemo(() => crowdOf(view), [view]);
  const markById = useMemo(() => new Map(crowd.marks.map((m) => [m.id, m])), [crowd]);
  const companies = useMemo(() => crowd.byCompany.map((g) => ({ ...g, href: href('iou', g.key) })), [crowd]);
  const sorts = useMemo(() => [{ mode: 'bands', groups: companies }, { mode: 'blocks', groups: crowd.byKind }], [companies, crowd]);
  const section = useRef(null);
  const frame = useRef(null);
  const [step, setStep] = useState(0);
  const [tall, setTall] = useState(0);
  const [bar, setBar] = useState({ top: 64, height: 64 });

  useEffect(() => {
    const read = () => {
      const node = section.current;
      const stick = node?.firstElementChild;
      if (!node || !stick) return;
      const travel = node.offsetHeight - stick.offsetHeight;
      const top = parseFloat(getComputedStyle(stick).top) || 0;
      const done = travel > 0 ? (top - node.getBoundingClientRect().top) / travel : 0;
      setStep(done > 0.28 ? 1 : 0);
    };
    // The story stands under the book's top bar: as tall as the window less the bar, and held under it.
    const measure = () => {
      const top = document.querySelector('.bk-top');
      const height = top ? Math.round(top.getBoundingClientRect().height) : 0;
      const held = top && /sticky|fixed/.test(getComputedStyle(top).position);
      setBar((now) => (now.height === height && now.top === (held ? height : 0) ? now : { height, top: held ? height : 0 }));
      setTall(frame.current?.clientHeight ?? 0);
      read();
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (frame.current) observer.observe(frame.current);
    addEventListener('scroll', read, { passive: true });
    addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      removeEventListener('scroll', read);
      removeEventListener('resize', measure);
    };
  }, []);

  const totals = view.totals;
  const promises = view.commitments.length;
  const sums = crowd.sums;
  const owed = totals.outstandingCents;
  const side = phone ? 0 : Math.round(Math.min(260, Math.max(176, width * 0.16)));
  const groupsNow = step ? crowd.byKind : companies;

  const answer = step === 0 ? (
    <>
      <p className="cv-ask t-label">{promises} {promises === 1 ? 'promise' : 'promises'}, as of {dateDay(view.asOf)}</p>
      <h1 className="t-display">
        {totals.promisedCents === 0 ? (
          <>Nothing promised<br /><span className="is-quiet">yet.</span></>
        ) : owed > 0 ? (
          <><span className="is-owed">{money(owed)} still owed</span><br /><span className="is-quiet">of {money(totals.promisedCents)} promised.</span></>
        ) : (
          <>Nothing owed.<br /><span className="is-quiet">All {money(totals.promisedCents)} came in.</span></>
        )}
      </h1>
      <p className="t-lead">Truthful keeps every credit a vendor promises you and checks each invoice until it is paid.</p>
    </>
  ) : (
    <>
      <p className="cv-ask t-label">what each $100 is</p>
      <h1 className="t-display">
        {money(sums.in)} came in.<br />
        {owed > 0 ? <span className="is-owed">{money(owed)} has not.</span> : <span className="is-quiet">All of it.</span>}
      </h1>
      <p className="t-lead">
        {[
          sums.note > 0 ? 'A credit note is not money until it shows on an invoice.' : null,
          sums.offer > 0 ? `The ${money(sums.offer)} on offer is not owed unless you agree to more.` : null,
          sums.note === 0 && sums.offer === 0 ? 'A coin fills in when an invoice shows it.' : null,
        ].filter(Boolean).join(' ')}
      </p>
    </>
  );

  return (
    <section className="cv-story" ref={section} aria-label="Every promise in the book, one coin for each $100"
      style={{ '--cv-top': `${bar.top}px`, '--cv-bar': `${bar.height}px` }}>
      <div className="cv-stick">
        <div className="cv-frame" ref={frame}>
          {tall > 0 && (
            <Crowd
              marks={crowd.marks}
              sorts={sorts}
              at={step}
              height={tall}
              side={side}
              labels={!phone}
              maxU={phone ? 4 : 6}
              top={30}
              onOpen={(id) => id && go('iou', id)}
              label={`${crowd.count} coins, one for each $100 promised. ${groupsNow.map((g) => `${g.label}: ${g.figure}${g.note ? `, ${g.note}` : ''}`).join('. ')}.`}
            />
          )}
        </div>
        {phone && (
          <ul className="cv-key" aria-hidden="true">
            {groupsNow.map((g) => (
              <li key={`${step}:${g.key}`}>
                <Coin state={step ? g.key : faceOf(g.ids, markById)} u={2} />
                <span className="cv-key-name">{g.label}</span>
                <b className={g.owed || g.key === 'owed' || g.key === 'note' ? 'is-owed' : undefined}>{g.figure}</b>
                {(g.short || g.note) && <span className="cv-key-note">{g.short || g.note}</span>}
              </li>
            ))}
          </ul>
        )}
        <div className="cv-foot">
          <div className="cv-say" aria-live="polite"><React.Fragment key={step}>{answer}</React.Fragment></div>
          <div className="cv-act">
            <div className="cv-btns">
              <GoLink go={go} page="ious" className="bk-btn is-big">Open the book</GoLink>
              <button type="button" className="bk-btn is-big is-quiet" onClick={onTry}>Try one invoice <kbd aria-hidden="true">↓</kbd></button>
            </div>
            <p className="t-label">{step ? 'One coin is $100 of a promise.' : 'One coin is $100. Scroll, and they sort themselves.'}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

// · one promise, one invoice

function cameIn(c, papers) {
  if (isOffer(c)) return 'No. It is only an offer.';
  const got = c.verifiedCents;
  if (got <= 0) return papers.notes.some((note) => !note.onInvoice) ? 'Not yet. Only a credit note.' : 'Not yet.';
  const where = papers.invoices.length === 1 ? `on the ${monthOf(papers.invoices[0].date)} invoice` : `on ${counted(papers.invoices.length)} invoices`;
  return got >= c.promisedCents ? `All of it, ${where}.` : `${money(got)} of it, ${where}.`;
}

function TryOne({ service, view, go, width, place }) {
  const phone = width < 720;
  const demo = service.authMode !== 'managed-password';
  const [id, setId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState('');
  const [failed, setFailed] = useState('');
  const [sim, setSim] = useState(null);     // a team's book is never written from the cover: the invoice is only shown here

  useEffect(() => {
    if (!id || !view.commitments.some((c) => c.id === id)) setId(pickPromise(view)?.id ?? null);
  }, [view, id]);

  const real = view.commitments.find((c) => c.id === id);
  if (!real) return null;
  const c = sim ? { ...real, verifiedCents: real.promisedCents, outstandingCents: 0, issuedCents: 0 } : real;
  const vendor = view.vendors.find((v) => v.id === c.vendorId)?.name ?? 'A company';
  const quote = quoteFor(view, real);
  const papers = papersFor(view, real, quote);
  if (sim) papers.invoices = [...papers.invoices, { id: sim.id, date: sim.date, creditCents: sim.creditCents }];
  const first = papers.promise[0];
  const promisedOn = first?.date ?? real.effectiveDate;
  const owed = stillOwedCents(c);
  const states = coinStates(c);
  const parts = partsOf(c);
  const last = papers.invoices.at(-1);
  const lever = !isOffer(c) && owed > 0;

  const still = last ? `Nothing has come in since ${dateDay(last.date)}.` : papers.notes.length ? 'Only a credit note so far. No invoice shows it.' : 'Nothing has come in yet.';
  const line = failed || said || (owed > 0 ? still : last ? `Paid in full on ${dateDay(last.date)}.` : '');

  async function arrive() {
    setFailed('');
    if (!demo) {
      const invoice = nextInvoiceFor(view, real, view.asOf);
      if (!invoice) return;
      setSim(invoice);
      setSaid(`${invoice.id} would take off ${money(invoice.creditCents)}. Only here: your team’s book is as it was.`);
      return;
    }
    setBusy(true);
    try {
      const workspace = service.workspace;
      const built = nextInvoiceCommands(workspace, real.id, { actor: service.actor, now: momentFor(workspace), day: dayFor(view, dayNow()) });
      if (built.commands.length) await service.commands(built.commands);
      setSaid(`${built.invoice.id} took off ${money(built.invoice.creditCents)}. ${vendor} is paid in full.`);
    } catch (error) {
      setSaid('');
      setFailed(plainFailure(error));
    } finally {
      setBusy(false);
    }
  }

  const legend = [['in', parts.in], ['note', parts.note], ['owed', parts.owed], ['offer', parts.offer]].filter(([, cents]) => cents > 0);

  return (
    <section className="cv-one" id="cv-one" ref={place} aria-labelledby="cv-one-title">
      <div className="cv-one-coins">
        <CoinStrip states={states} u={phone ? 4 : 6} gap={2} perRow={6} label={`${vendor}: ${money(c.verifiedCents)} of ${money(c.promisedCents)} came in`} />
        <p className="cv-one-name">{vendor} <span className="t-label">{real.reference}</span></p>
        <ul className="cv-one-key">
          {legend.map(([state, cents]) => (
            <li key={state}>
              <Coin state={state} u={2} />
              <span>{STATE_WORDS[state]}</span>
              <span className="t-dots" aria-hidden="true" />
              <b className={state === 'owed' || state === 'note' ? 'is-owed' : undefined}>{money(cents)}</b>
            </li>
          ))}
        </ul>
      </div>
      <div className="cv-one-body">
        <p className="t-label">try one invoice</p>
        <h2 className="t-title" id="cv-one-title">
          {owed > 0 ? <>{vendor} still owes you <span className="is-owed">{money(owed)}</span>.</> : isOffer(c) ? <>{vendor} offers {money(c.promisedCents)}, with strings.</> : <>{vendor} has paid all {money(c.promisedCents)}.</>}
        </h2>
        {quote && (
          <figure className="t-box cv-one-said">
            <span className="t-box-name">their {PAPER[first?.kind] ?? 'paper'}, {dateDay(promisedOn)}</span>
            <blockquote>“{quote.text}”</blockquote>
          </figure>
        )}
        <div className="cv-one-act">
          {lever && (
            <button type="button" className="bk-btn is-big" disabled={busy || service.busy} onClick={() => void arrive()}>
              {busy ? 'The invoice is arriving…' : 'The next invoice arrives'}
            </button>
          )}
          <p className={`cv-one-line${failed ? ' is-wrong' : ''}`} role="status">{line}</p>
        </div>
        <dl className="cv-answers">
          <div>
            <dt>Did they promise it?</dt>
            <dd>{isOffer(c) ? 'Only if you agree to more.' : `Yes. In writing, ${dateDay(promisedOn)}.`}</dd>
          </div>
          <div>
            <dt>Did it come in?</dt>
            <dd>{cameIn(c, papers)}</dd>
          </div>
          <div>
            <dt>What is still owed?</dt>
            <dd className={owed > 0 ? 'is-owed' : undefined}>{owed > 0 ? `${money(owed)}.` : 'Nothing.'}</dd>
          </div>
        </dl>
        <GoLink go={go} page="iou" id={real.id} className="cv-more">Open its page</GoLink>
      </div>
    </section>
  );
}

// · the cover

export default function Home({ service, view, go }) {
  const width = useWidth();
  const one = useRef(null);
  if (!view) return <section className="cv cv-wait"><p className="t-label">opening the book…</p></section>;
  // to the top of the next part, just under the book's top bar
  const toOne = () => {
    const node = one.current;
    if (!node) return;
    const bar = document.querySelector('.bk-top');
    const held = bar && /sticky|fixed/.test(getComputedStyle(bar).position) ? bar.getBoundingClientRect().height : 0;
    scrollTo({ top: node.getBoundingClientRect().top + scrollY - held, behavior: calmNow() ? 'auto' : 'smooth' });
  };
  return (
    <div className="cv">
      <Story view={view} go={go} width={width} onTry={toOne} />
      <TryOne service={service} view={view} go={go} width={width} place={one} />
      <section className="cv-close" aria-label="Open the book">
        <h2 className="t-display">Keep yours.</h2>
        <GoLink go={go} page="ious" className="bk-btn is-big">Open the book</GoLink>
      </section>
    </div>
  );
}
