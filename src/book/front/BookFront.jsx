// The book of IOUs: the first page of Truthful after the cover.
//
//   import BookFront from './book/front/BookFront.jsx';
//   <BookFront service={assurance} onOpenCase={(commitmentId) => …} />
//
// service      (required) the object the app's one useAssurance hook returns.
//              The parent calls the hook and passes it down; nothing under
//              src/book/front calls it. The book reads service.workspace through
//              selectors.mjs and sends everything a visitor does to
//              service.commands as one batch (commands.mjs), so every other
//              screen sees the same records.
// onOpenCase   (required) onOpenCase(commitmentId): "Open its page" on an
//              opened promise, and "See what happened" on one whose time to
//              claim ran out. The commitment id is all that page needs.
// onGo, tabs, tools   accepted and not drawn: the shell's one top bar is the
//              way round the book on every page, this one included.
//
// What is on the page: the answer as the headline (what is still owed, of what
// was promised), a drop zone for a new paper, and the promises as a hairline
// list. Each row is a button that unfolds the promise under it: its coins
// (one per $100, src/book/ui/coins.js), what they said, the papers, what came
// in, the vendor's offers, and the letter you approve and send yourself.
// Motion only where something happens: coins turn over when money arrives, a
// row opens, a paid row goes down to the paid ones.
//
// The page is drawn in a shadow tree of its own under the element this renders
// (class "book-front"), so the styles of the pages around it do not reach it.
// The --t-* tokens and the Red Hat faces are declared on the document
// (src/book/ui/tokens.css) and inherit into it.
//
// For a screenshot of a state: ?open=<promise id>  and  &letter=1

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import tokensCss from '../ui/tokens.css?inline';
import bookCss from './book.css?inline';
import { Coin, CoinStrip } from '../ui/Coins.jsx';
import { href, paperId } from '../shell/route.mjs';
import { bookFor, keeperFor, money, figure, dateShort, dateDay } from './selectors.mjs';
import { acceptOfferCommands, approveLetterCommands, declineOfferCommands, nextInvoiceCommands, plainFailure, readDocument } from './commands.mjs';
import {
  approvedLine, askWords, coinsOf, coinsSaid, copyText, dayLabel, decidedLine, downloadLetter, fileProblem, isPaid, keepsText,
  offerWords, offersShown, orderOf, quoteParts, readLine, stillPlease, turnTime, wait, workingWords,
} from './book.js';

// The parts (.t-display, .t-box, .t-row …) are declared on the document; inside
// this tree they have to be said again. The faces stay on the document, where
// they work for this tree too.
const SHEET = `${tokensCss.replace(/@font-face\s*\{[^}]*\}/g, '')}\n${bookCss}`;

const FOLD = 380;          // a row or a letter unfolding, ms (book.css .f-fold)
const SLIDE = 400;         // a paid row going down to the paid ones, ms

// A demo workspace has made-up vendors and a lever that brings the next invoice in.
const isDemo = (service) => service.authMode !== 'managed-password';
// The app never writes a moment earlier than the last one it recorded.
const momentFor = (workspace) => {
  const now = new Date().toISOString();
  const last = workspace.events.at(-1)?.observedAt;
  return last && last > now ? last : now;
};
// The visitor's own date, for a paper the demo dates today.
const dayNow = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const readingOf = (service, workspace = service.workspace) => bookFor(workspace, { now: momentFor(workspace), keeper: keeperFor(service), demo: isDemo(service), day: dayNow() });

// What a visitor left open, kept while they look at a promise's page and come
// back. A reload opens the book fresh.
const kept = { open: null, letters: new Set(), drafts: new Map() };

// :: the host

export default function BookFront({ service, onOpenCase }) {
  const host = useRef(null);
  const [tree, setTree] = useState(null);
  useLayoutEffect(() => {
    const el = host.current;
    setTree(el.shadowRoot ?? el.attachShadow({ mode: 'open' }));
  }, []);
  return (
    <div className="book-front" ref={host} data-runtime={service.mode}>
      {tree && createPortal(
        <>
          <style>{SHEET}</style>
          <div className="book-front">
            <Front service={service} onOpenCase={onOpenCase} tree={tree} />
          </div>
        </>,
        tree,
      )}
    </div>
  );
}

// :: small things

/** A figure that counts to its new value one coin ($100) at a time, in step with the coins turning over. */
function useCount(cents) {
  const [shown, setShown] = useState(cents);
  const at = useRef(cents);
  useEffect(() => {
    const from = at.current;
    if (from === cents) return undefined;
    if (stillPlease()) { at.current = cents; setShown(cents); return undefined; }
    const steps = Math.max(1, Math.round(Math.abs(cents - from) / 10000));
    const dir = Math.sign(cents - from);
    const start = performance.now();
    let raf = 0;
    const tick = (now) => {
      const n = Math.floor((now - start - 130) / 70) + 1;     // a coin shows its new face halfway through its turn
      const value = n >= steps ? cents : n <= 0 ? from : from + dir * n * 10000;
      at.current = value;
      setShown(value);
      if (value !== cents) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [cents]);
  return shown;
}

/** The page is a phone's width (book.css draws it in one column there). */
function useNarrow() {
  const query = '(max-width: 900px)';
  const [narrow, setNarrow] = useState(() => typeof matchMedia === 'function' && matchMedia(query).matches);
  useEffect(() => {
    const list = matchMedia(query);
    const change = () => setNarrow(list.matches);
    list.addEventListener('change', change);
    return () => list.removeEventListener('change', change);
  }, []);
  return narrow;
}

function Count({ cents, as = figure, className }) {
  return <span className={className}>{as(useCount(cents))}</span>;
}

/** Something that unfolds: its height opens and closes, and what is in it is only there while it shows. */
function Fold({ open, children, className = '' }) {
  const [there, setThere] = useState(open);
  const [shown, setShown] = useState(open);
  useEffect(() => {
    if (open) {
      setThere(true);
      const raf = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
      return () => cancelAnimationFrame(raf);
    }
    setShown(false);
    const t = setTimeout(() => setThere(false), stillPlease() ? 0 : FOLD);
    return () => clearTimeout(t);
  }, [open]);
  return (
    <div className={`f-fold${shown ? ' is-open' : ''} ${className}`} inert={!open ? true : undefined}>
      <div className="f-fold-in">{there && children}</div>
    </div>
  );
}

// Scroll just far enough that `el` is on screen, without losing `keep` off the top.
function reveal(el, keep) {
  if (!el) return;
  const top = (node) => node.getBoundingClientRect().top + window.scrollY;
  const want = top(el) + el.offsetHeight + 28 - window.innerHeight;
  const cap = (keep ? top(keep) : top(el)) - 84;
  const y = Math.max(window.scrollY, Math.min(want, cap));
  if (y > window.scrollY + 2) window.scrollTo({ top: y, behavior: stillPlease() ? 'auto' : 'smooth' });
}

// :: the page

function Front({ service, onOpenCase, tree }) {
  const live = useRef({ service, onOpenCase });
  live.current = { service, onOpenCase };
  const workspace = service.workspace;
  const book = useMemo(
    () => (workspace ? readingOf(live.current.service, workspace) : null),
    [workspace, service.authMode, service.actor?.id, service.session?.user?.name, service.session?.workspace?.name],
  );
  const bookNow = useRef(book);
  bookNow.current = book;

  const query = useMemo(() => new URLSearchParams(location.search), []);
  const [open, setOpenState] = useState(() => query.get('open') || kept.open);
  const openNow = useRef(open);
  const setOpen = (id) => { openNow.current = id; kept.open = id; setOpenState(id); };
  const [letters, setLetters] = useState(() => {
    if (query.get('open') && query.has('letter')) kept.letters.add(query.get('open'));
    return new Set(kept.letters);
  });
  const [busy, setBusy] = useState(null);         // what the app is writing down: a promise's id, or "read"
  const [said, setSaid] = useState({});           // a failure, by promise
  const [fresh, setFresh] = useState(null);       // a promise just read from a paper

  // ——— the order the rows stand in, and a paid row going down to the paid ones

  const list = useRef(null);
  const [order, setOrder] = useState(() => (book ? orderOf(book.promises) : []));
  const orderNow = useRef(order);
  orderNow.current = order;
  const before = useRef(null);
  const reorder = (next) => {
    if (next.join('|') === orderNow.current.join('|')) return;
    const rows = list.current ? [...list.current.querySelectorAll('[data-item]')] : [];
    const focused = tree.activeElement?.closest?.('[data-item]')?.dataset.item ?? null;
    before.current = { tops: new Map(rows.map((el) => [el.dataset.item, el.getBoundingClientRect().top])), focused };
    setOrder(next);
  };
  useLayoutEffect(() => {
    const first = before.current;
    before.current = null;
    if (!first || !list.current) return;
    for (const el of list.current.querySelectorAll('[data-item]')) {
      const was = first.tops.get(el.dataset.item);
      const dy = was == null ? 0 : was - el.getBoundingClientRect().top;
      if (Math.abs(dy) < 1 || stillPlease()) continue;
      el.classList.add('is-moving');
      el.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: dy < 0 ? SLIDE : SLIDE - 60, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)' })
        .finished.finally(() => el.classList.remove('is-moving'));
    }
    // moving a row in the page takes the focus off it; it goes back
    if (first.focused) list.current.querySelector(`[data-row="${CSS.escape(first.focused)}"]`)?.focus({ preventScroll: true });
  }, [order]);

  // When a promise has just been paid, its coins turn over where it stands; then
  // it folds up if it was open, and only then goes down to the paid ones.
  const paidBefore = useRef(null);
  const coinsBefore = useRef(new Map());
  const holds = useRef(0);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);
  useEffect(() => {
    if (!book) return;
    const paidNow = new Set(book.promises.filter(isPaid).map((p) => p.id));
    const newly = paidBefore.current ? [...paidNow].filter((id) => !paidBefore.current.has(id)) : [];
    paidBefore.current = paidNow;
    let turned = 0;
    for (const p of book.promises) {
      const now = coinsOf(p), was = coinsBefore.current.get(p.id);
      if (was && was.length === now.length) turned = Math.max(turned, now.filter((s, i) => s !== was[i]).length);
      coinsBefore.current.set(p.id, now);
    }
    if (!orderNow.current.length) { if (book.promises.length) setOrder(orderOf(book.promises)); return; }
    // a paid promise that is open folds up, and the focus waits on its row
    const fold = () => {
      const id = openNow.current;
      if (!newly.includes(id)) return false;
      const item = tree.querySelector(`[data-item="${CSS.escape(id)}"]`);
      if (item && (item.contains(tree.activeElement) || document.activeElement === document.body)) {
        item.querySelector('[data-row]')?.focus({ preventScroll: true });
      }
      setOpen(null);
      return true;
    };
    if (newly.length && !stillPlease()) {
      holds.current += 1;
      (async () => {
        await wait(turnTime(turned) + 520);
        if (alive.current && fold()) await wait(FOLD + 60);
        holds.current -= 1;
        if (alive.current && !holds.current) reorder(orderOf(bookNow.current.promises));
      })();
      return;
    }
    if (newly.length) fold();
    if (!holds.current) reorder(orderOf(book.promises));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book]);

  // a letter whose promise no longer has one (it was paid, or the window closed) is put away
  useEffect(() => {
    if (!book) return;
    for (const id of kept.letters) if (!book.promises.find((p) => p.id === id)?.letter) kept.letters.delete(id);
    if ([...letters].some((id) => !kept.letters.has(id))) setLetters(new Set(kept.letters));
    if (open && !book.promises.some((p) => p.id === open)) setOpen(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book]);

  // ——— asking the app

  // Send a batch to the app. What it writes comes back as a new reading of the workspace.
  async function record(build) {
    const app = live.current.service;
    if (!app.workspace) throw new Error('The book is still opening. Try again in a moment.');
    const context = { actor: app.actor, now: momentFor(app.workspace), day: dayNow() };
    try {
      const built = await build(app.workspace, context);
      const commands = Array.isArray(built) ? built : built.commands ?? [];
      if (commands.length) await app.commands(commands);
      return built;
    } catch (error) {
      throw new Error(plainFailure(error), { cause: error });
    }
  }

  async function act(id, build) {
    if (busy) return false;
    setBusy(id);
    setSaid((all) => ({ ...all, [id]: '' }));
    try {
      await record(build);
      return true;
    } catch (error) {
      setSaid((all) => ({ ...all, [id]: error.message }));
      return false;
    } finally {
      setBusy(null);
    }
  }

  const doings = {
    ask(p) {
      kept.letters.add(p.id);
      setLetters(new Set(kept.letters));
      setTimeout(() => {
        const box = tree.querySelector(`#f-letter-${CSS.escape(p.id)}`);
        reveal(box, box);
        box?.querySelector('textarea')?.focus({ preventScroll: true });
      }, stillPlease() ? 0 : FOLD + 20);
    },
    approve: (p) => act(p.id, (ws, context) => approveLetterCommands(ws, p.id, context)),
    take: (p, offer) => act(p.id, (ws, context) => acceptOfferCommands(ws, p.id, offer.id, context)),
    decline: (p, offer, reason) => act(p.id, () => declineOfferCommands(offer.id, reason)),
    async nextInvoice(p) {
      if (busy) return false;
      // the coins are where the money arrives: bring them on screen first
      const item = tree.querySelector(`[data-item="${CSS.escape(p.id)}"]`);
      const top = item ? item.getBoundingClientRect().top : 100;
      if (top < 72) {
        window.scrollBy({ top: top - 84, behavior: stillPlease() ? 'auto' : 'smooth' });
        if (!stillPlease()) await wait(420);
      }
      return act(p.id, (ws, context) => nextInvoiceCommands(ws, p.id, context));
    },
    openCase: (p) => live.current.onOpenCase?.(p.id),
  };

  async function read(text) {
    if (busy) return null;
    setBusy('read');
    try {
      const outcome = await record((ws, context) => readDocument(ws, text, context));
      if (outcome.kind === 'promise') {
        setFresh(outcome.commitmentId);
        setTimeout(() => setFresh((id) => (id === outcome.commitmentId ? null : id)), 2400);
      }
      return outcome;
    } finally {
      setBusy(null);
    }
  }

  function toggle(id) {
    const next = open === id ? null : id;
    setOpen(next);
    if (next) {
      setTimeout(() => {
        const item = tree.querySelector(`[data-item="${CSS.escape(next)}"]`);
        reveal(item, item);
      }, stillPlease() ? 0 : FOLD + 20);
    }
  }

  // Escape folds the open promise and puts you back on its row.
  useEffect(() => {
    const onKey = (event) => {
      if (event.key !== 'Escape' || event.defaultPrevented || !openNow.current) return;
      const id = openNow.current;
      setOpen(null);
      tree.querySelector(`[data-row="${CSS.escape(id)}"]`)?.focus({ preventScroll: true });
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!book) return <div className="f-page" aria-busy="true" />;

  const byId = new Map(book.promises.map((p) => [p.id, p]));
  const rows = [...order.filter((id) => byId.has(id)), ...book.promises.map((p) => p.id).filter((id) => !order.includes(id))].map((id) => byId.get(id));

  return (
    <div className="f-page">
      <Answer book={book} onRead={read} busy={busy} tree={tree} />

      <section className="f-list" aria-label="Promises">
        <p className="f-key t-label" aria-label="One coin is $100. Ink: it came in on an invoice. A red ring: still owed. A red ring with a grey coin: a credit note, not on an invoice yet. Dotted: only if you agree to more.">
          <span>one coin is $100</span>
          <span><Coin state="in" u={2} /> came in on an invoice</span>
          <span><Coin state="owed" u={2} /> still owed</span>
          <span><Coin state="note" u={2} /> credit note, not on an invoice yet</span>
          <span><Coin state="offer" u={2} /> only if you agree</span>
        </p>
        <div className="f-grid f-head t-label" aria-hidden="true">
          <span>company</span>
          <span>what they said</span>
          <span>due</span>
          <span className="f-coin-head">coins</span>
          <span className="is-num f-promised">promised</span>
          <span className="is-num">credited</span>
          <span className="is-num">still owed</span>
        </div>
        {book.promises.length === 0 && (
          <p className="f-empty">Nothing in the book yet. When a vendor promises you a credit, drop the email in.</p>
        )}
        <ul className="f-rows" ref={list}>
          {rows.map((p) => (
            <Row key={p.id} p={p} open={open === p.id} fresh={fresh === p.id} onToggle={() => toggle(p.id)}>
              <Opened
                p={p}
                demo={book.demo}
                busy={busy}
                said={said[p.id]}
                letterOut={letters.has(p.id) && Boolean(p.letter)}
                doings={doings}
              />
            </Row>
          ))}
        </ul>
        {book.promises.length > 0 && (
          <div className="f-grid f-total">
            <span className="t-label">total</span>
            <span />
            <span />
            <span />
            <Count className="f-num f-promised" cents={book.totals.promisedCents} />
            <Count className="f-num" cents={book.totals.creditedCents} />
            <span className="f-num"><Owed cents={book.totals.owedCents} /></span>
          </div>
        )}
      </section>

      <p className="f-notice t-small">
        {book.demo
          ? ''
          : 'Nothing is emailed from here. You copy the letter or download it, and send it yourself.'}
      </p>
    </div>
  );
}

// :: the answer, and the drop zone

function Answer({ book, onRead, busy, tree }) {
  const owed = useCount(book.totals.owedCents);
  const promised = book.totals.promisedCents;
  return (
    <header className="f-top">
      <div className="f-say">
        <p className="t-label f-asof">promises · {dayLabel(dayNow() <= book.today ? dayNow() : book.today)}</p>
        <h1 className="t-display f-answer">
          {book.promises.length === 0 ? 'No promises yet.'
            : owed > 0 ? (
              <>
                <span className="is-owed">{money(owed)} still owed.</span>
                <span className="is-quiet f-of">of {money(promised)} promised.</span>
              </>
            ) : 'Every promise paid.'}
        </h1>
        <p className="t-lead f-lede">Truthful keeps every credit a vendor promises you and checks each invoice until it is paid.</p>
      </div>
      <Drop onRead={onRead} busy={busy} tree={tree} />
    </header>
  );
}

function Drop({ onRead, busy, tree }) {
  const [mode, setMode] = useState('ask');        // ask | paste | reading
  const [text, setText] = useState('');
  const [line, setLine] = useState('');
  const [over, setOver] = useState(false);
  const [missed, setMissed] = useState(false);
  const file = useRef(null);
  const area = useRef(null);
  const timer = useRef(0);
  const readNow = useRef(null);

  const rest = (after = 0) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { setMode('ask'); setText(''); setLine(''); setMissed(false); }, after);
  };

  async function read(raw) {
    clearTimeout(timer.current);
    const clean = String(raw ?? '').replace(/\r\n?/g, '\n').trim();
    if (!clean || busy) return;
    setText(clean);
    setMode('reading');
    setMissed(false);
    setLine('Reading it…');
    let outcome;
    try {
      [outcome] = await Promise.all([onRead(clean), wait(stillPlease() ? 150 : 700)]);
    } catch (error) {
      setMode('ask');
      setLine(error.message);
      rest(7000);
      return;
    }
    if (!outcome) { setMode('ask'); setLine(''); return; }
    setLine(readLine(outcome));
    if (outcome.kind === 'missed') {
      setMissed(true);
      setText(keepsText(outcome) ? clean : '');
      setMode('paste');
      setTimeout(() => area.current?.focus({ preventScroll: true }), 0);
      return;
    }
    setMode('ask');
    setText('');
    rest(outcome.kind === 'promise' || outcome.kind === 'credit' ? 6000 : 7000);
  }
  readNow.current = read;

  function takeFile(f) {
    if (!f) return;
    const problem = fileProblem(f);
    if (problem) { setMode('paste'); setMissed(true); setLine(problem); return; }
    f.text().then((t) => readNow.current(t), () => { setMode('paste'); setLine('That file wouldn’t open. Paste the text instead.'); });
  }

  // A paper dropped anywhere on the page lands here; so does anything pasted while no field has the cursor.
  useEffect(() => {
    let depth = 0;
    const carries = (event) => event.dataTransfer?.types?.includes('Files') || event.dataTransfer?.types?.includes('text/plain');
    const enter = (event) => { if (carries(event)) { depth += 1; setOver(true); } };
    const leave = () => { depth = Math.max(0, depth - 1); if (!depth) setOver(false); };
    const overIt = (event) => event.preventDefault();
    const drop = (event) => {
      event.preventDefault();
      depth = 0;
      setOver(false);
      const f = event.dataTransfer?.files?.[0];
      if (f) { takeFile(f); return; }
      const t = event.dataTransfer?.getData('text/plain');
      if (t) readNow.current(t);
    };
    const paste = (event) => {
      const where = event.composedPath?.()[0] ?? event.target;
      if (where?.closest?.('input, textarea, [contenteditable]')) return;
      const t = event.clipboardData?.getData('text/plain');
      if (t?.trim()) { event.preventDefault(); readNow.current(t); }
    };
    const key = (event) => {
      if (event.key !== 'Escape' || !tree.querySelector('.f-drop')?.contains(tree.activeElement)) return;
      if (tree.querySelector('.f-drop.is-paste')) { event.preventDefault(); rest(); setTimeout(() => tree.querySelector('.f-drop-paste')?.focus(), 0); }
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragleave', leave);
    window.addEventListener('dragover', overIt);
    window.addEventListener('drop', drop);
    document.addEventListener('paste', paste);
    document.addEventListener('keydown', key, true);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('dragover', overIt);
      window.removeEventListener('drop', drop);
      document.removeEventListener('paste', paste);
      document.removeEventListener('keydown', key, true);
      clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ask = () => {
    clearTimeout(timer.current);
    setMode('paste');
    setLine('');
    setTimeout(() => area.current?.focus({ preventScroll: true }), 0);
  };

  return (
    <div className="f-drop-wrap">
      <div className={`f-drop is-${mode}${over ? ' is-over' : ''}${missed ? ' is-missed' : ''}`}>
        {mode === 'ask' && (
          <>
            <button type="button" className="f-drop-ask" onClick={() => file.current?.click()}>drop an email or an invoice</button>
            <button type="button" className="f-drop-paste" onClick={ask}>or paste the text</button>
          </>
        )}
        {mode === 'paste' && (
          <>
            <textarea
              ref={area}
              className="f-drop-area"
              aria-label="Paste the text here"
              placeholder="Paste it here"
              spellCheck="false"
              value={text}
              onChange={(event) => setText(event.target.value)}
              onPaste={() => setTimeout(() => { if (area.current?.value.trim()) read(area.current.value); }, 30)}
              onKeyDown={(event) => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) read(text); }}
            />
            <div className="f-drop-acts">
              <button type="button" className="f-btn is-quiet is-small" onClick={() => read(text)} disabled={!text.trim() || Boolean(busy)}>Read it</button>
              <button type="button" className="f-link" onClick={() => rest()}>never mind</button>
            </div>
          </>
        )}
        {mode === 'reading' && <pre className="f-drop-paper" aria-hidden="true">{text.slice(0, 280)}</pre>}
      </div>
      <p className="f-drop-line t-small" role="status" aria-live="polite">{line}</p>
      <input
        ref={file}
        type="file"
        hidden
        accept=".txt,.eml,.csv,.md,text/plain,text/csv,message/rfc822"
        onChange={(event) => { takeFile(event.target.files[0]); event.target.value = ''; }}
      />
    </div>
  );
}

// :: one promise in the list

// "12 days late", from the reader's own day
function lateWords(due) {
  const days = Math.round((Date.parse(`${dayNow()}T00:00:00Z`) - Date.parse(`${due}T00:00:00Z`)) / 86400000);
  return days > 0 ? `${days} ${days === 1 ? 'day' : 'days'} late` : 'late';
}

function dueWords(p) {
  if (!p.due) return 'no date';
  return dateShort(p.due);
}

function Row({ p, open, fresh, onToggle, children }) {
  // a row goes quiet once the last of what was owed has counted down, not before
  const owed = useCount(p.owedCents);
  const paid = isPaid(p) && owed === 0;
  const marks = [];
  if (p.closed) marks.push(<span key="closed" className="t-label is-late">too late to claim</span>);
  else if (p.overdue) marks.push(<span key="late" className="t-label is-late">{lateWords(p.due)}</span>);
  if (p.due && p.firstDue && p.due !== p.firstDue) marks.push(<span key="moved" className="t-label">was {dayLabel(p.firstDue)}</span>);
  if (p.letter?.approvedAt) marks.push(<span key="asked" className="t-label">asked {dayLabel(p.letter.approvedAt)}</span>);
  const who = p.offer ? `${p.vendor}: ${money(p.promisedCents)} on offer`
    : paid ? `${p.vendor}: paid, ${money(p.promisedCents)}`
      : `${p.vendor}: ${money(p.owedCents)} still owed${p.overdue ? ', late' : ''}`;
  return (
    <li className={`f-item${paid ? ' is-paid' : ''}${p.offer ? ' is-offer' : ''}${open ? ' is-open' : ''}${fresh ? ' is-new' : ''}`} data-item={p.id}>
      <button type="button" className="f-grid f-row" data-row={p.id} aria-expanded={open} aria-controls={`f-open-${p.id}`} aria-label={who} onClick={onToggle}>
        <span className="f-co">{p.vendor}</span>
        <span className="f-said">{p.quote ? `“${p.quote}”` : ''}</span>
        <span className="f-due">
          <span className="f-date">{dueWords(p)}</span>
          {marks.length > 0 && <span className="f-marks">{marks}</span>}
        </span>
        <span className="f-coins"><CoinStrip states={coinsOf(p)} u={2} gap={1} perRow={12} label={coinsSaid(p)} /></span>
        <span className="f-num f-promised">{p.offer ? '' : figure(p.promisedCents)}</span>
        <span className="f-num f-credited">{p.offer ? '' : <Count cents={p.creditedCents} />}</span>
        <span className="f-num f-owed">
          {p.offer ? <span className="t-label">on offer</span>
            : paid && !open ? <span className="t-label">paid</span>
              : <span className={owed > 0 ? 'is-owed' : 'f-none'}>{figure(owed)}</span>}
        </span>
      </button>
      <Fold open={open}>{children}</Fold>
    </li>
  );
}

function Owed({ cents }) {
  const shown = useCount(cents);
  return <span className={shown > 0 ? 'is-owed' : 'f-none'}>{figure(shown)}</span>;
}

// :: one promise, opened

const PAPER_WORD = { email: 'email', agreement: 'agreement', report: 'report', pasted: 'paper' };

function Opened({ p, demo, busy, said, letterOut, doings }) {
  const coins = coinsOf(p);
  const owed = useCount(p.owedCents);
  // while the coins turn over, the words say what the coins show
  const paid = isPaid(p) && owed === 0;
  const settled = owed === p.owedCents;
  const keyWas = useRef(new Set(coins));
  const states = settled ? new Set(coins) : new Set([...keyWas.current, ...coins]);
  if (settled) keyWas.current = states;
  const [before, mark, after] = quoteParts(p);
  const where = p.papers.promise[0];
  const offers = offersShown(p);
  const writing = busy === p.id;
  const notes = p.papers.notes.filter((note) => !note.onInvoice);
  const narrow = useNarrow();

  // the papers and lines that arrive while it is open come in, the rest are simply there
  const seen = useRef(null);
  const keys = [...p.papers.invoices.map((x) => `i:${x.id}`), ...p.papers.notes.map((x) => `n:${x.id}:${x.onInvoice}`)];
  if (!seen.current) seen.current = new Set(keys);
  const isNew = (key) => (seen.current.has(key) ? '' : ' is-new');
  useEffect(() => { for (const key of keys) seen.current.add(key); });

  const solid = !p.offer && p.owedCents > 0 && p.letter && !letterOut;
  return (
    <div className="f-open t-box" id={`f-open-${p.id}`} role="region" aria-label={p.vendor}>
      <div className="f-open-head">
        <CoinStrip className="f-big" states={coins} u={narrow ? 3 : 4} gap={narrow ? 1 : 2} perRow={narrow ? 10 : 12} label={coinsSaid(p)} />
        <div className="f-open-say">
          <h2 className="t-title">{p.vendor} <span className="t-label">{p.reference}</span></h2>
          <p className="t-lead f-open-sum">
            {p.offer ? <>{money(p.promisedCents)} on offer. <span className="is-quiet">Only if you agree.</span></>
              : paid ? <>All {money(p.promisedCents)} came in.</>
                : <><span className="is-owed">{money(owed)} still owed</span> <span className="is-quiet">of {money(p.promisedCents)}.</span></>}
          </p>
          <p className="f-key t-label">
            {states.has('in') && <span><Coin state="in" u={2} /> came in</span>}
            {states.has('note') && <span><Coin state="note" u={2} /> on a credit note</span>}
            {states.has('owed') && <span><Coin state="owed" u={2} /> still owed</span>}
            {states.has('offer') && <span><Coin state="offer" u={2} /> only if you agree</span>}
          </p>
        </div>
      </div>

      <dl className="f-facts">
        <div className="f-fact">
          <dt className="t-label">they said</dt>
          <dd>
            <blockquote className="f-quote">“{before}{mark && <mark>{mark}</mark>}{after}”</blockquote>
            {where && <p className="t-label f-source">{PAPER_WORD[where.kind] ?? 'paper'}{where.date ? `, ${dateShort(where.date).toLowerCase()}` : ''}</p>}
          </dd>
        </div>
        {p.offer && (
          <div className="f-fact">
            <dt className="t-label">only if</dt>
            <dd>{p.conditions.join(' ')} Not owed to you unless you agree.</dd>
          </div>
        )}
        {p.working && (
          <div className="f-fact">
            <dt className="t-label">the working</dt>
            <dd>
              {p.working.why && <p className="t-small">{p.working.why}</p>}
              <p className="t-row"><span>{workingWords(p.working)}</span><i className="t-dots" /><span>{money(p.promisedCents)}</span></p>
            </dd>
          </div>
        )}
        {!p.offer && (
          <div className="f-fact">
            <dt className="t-label">came in</dt>
            <dd>
              {p.papers.invoices.map((invoice) => (
                <p className={`t-row${isNew(`i:${invoice.id}`)}`} key={invoice.id}>
                  <span>Invoice {invoice.id}{invoice.date ? `, ${dateDay(invoice.date)}` : ''}</span><i className="t-dots" /><span>{figure(invoice.creditCents)}</span>
                </p>
              ))}
              {notes.map((note) => (
                <p className={`t-row is-note${isNew(`n:${note.id}:false`)}`} key={note.id}>
                  <span>Credit note {note.id}, not on an invoice yet</span><i className="t-dots" /><span>{figure(note.cents)}</span>
                </p>
              ))}
              {!p.papers.invoices.length && !notes.length && <p className="t-row is-none"><span>Nothing on an invoice yet</span><i className="t-dots" /><span>0.00</span></p>}
              <p className={`t-row is-sum${owed > 0 ? ' is-owing' : ''}`}>
                <span>Still owed</span><i className="t-dots" /><span>{figure(owed)}</span>
              </p>
            </dd>
          </div>
        )}
        {(p.closed || p.asides.length > 0 || (paid && p.paidNote)) && (
          <div className="f-fact">
            <dt className="t-label">note</dt>
            <dd className="f-notes">
              {p.closed && <p>{p.closed.line} There is no letter to send.</p>}
              {p.asides.map((line) => <p key={line}>{line}</p>)}
              {paid && p.paidNote && <p>{p.paidNote}</p>}
            </dd>
          </div>
        )}
        <div className="f-fact">
          <dt className="t-label">the papers</dt>
          <dd className="f-papers">
            {p.papers.promise.map((paper) => (
              <a key={`${paper.sourceId}@${paper.revision}`} className="f-link" href={href('papers', paperId(paper.sourceId, paper.revision))}>
                {PAPER_WORD[paper.kind] ?? 'paper'}{paper.date ? `, ${dayLabel(paper.date)}` : ''}
              </a>
            ))}
            {p.papers.notes.map((note) => note.sourceId && (
              <a key={`n:${note.id}`} className={`f-link${isNew(`n:${note.id}:${note.onInvoice}`)}`} href={href('papers', paperId(note.sourceId, note.revision))}>
                credit note {note.id}
              </a>
            ))}
            {p.papers.invoices.map((invoice) => invoice.sourceId && (
              <a key={`i:${invoice.id}`} className={`f-link${isNew(`i:${invoice.id}`)}`} href={href('papers', paperId(invoice.sourceId, invoice.revision))}>
                invoice {invoice.id}
              </a>
            ))}
          </dd>
        </div>
        {offers.length > 0 && (
          <div className="f-fact">
            <dt className="t-label">{p.offer ? 'saying yes' : 'they answered'}</dt>
            <dd className="f-offers">
              {offers.map((offer) => <Offer key={offer.id} p={p} offer={offer} busy={busy} doings={doings} />)}
            </dd>
          </div>
        )}
      </dl>

      <div className="f-acts">
        {solid && (p.letter.approvedAt
          ? <button type="button" className="f-btn is-quiet" onClick={() => doings.ask(p)}>See the approved letter</button>
          : <button type="button" className="f-btn" onClick={() => doings.ask(p)} disabled={writing}>{askWords(p)}</button>)}
        {p.closed && <button type="button" className="f-btn" onClick={() => doings.openCase(p)}>See what happened</button>}
        {demo && p.nextInvoice && p.owedCents > 0 && (
          <button type="button" className="f-btn is-quiet" onClick={() => doings.nextInvoice(p)} disabled={Boolean(busy)}>
            {writing ? 'The invoice is coming in…' : 'The next invoice arrives'}
          </button>
        )}
        {!p.closed && <button type="button" className="f-link" onClick={() => doings.openCase(p)}>open its page</button>}
      </div>
      {said && <p className="f-error" role="alert">{said}</p>}

      {p.letter && (
        <Fold open={letterOut} className="f-letter-fold">
          <Letter p={p} busy={busy} doings={doings} />
        </Fold>
      )}
    </div>
  );
}

// :: an offer

function Offer({ p, offer, busy, doings }) {
  const words = offerWords(p, offer);
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState('');
  const field = useRef(null);
  const decision = offer.decision;
  useEffect(() => { if (asking) field.current?.focus({ preventScroll: true }); }, [asking]);
  const go = async () => { if (await doings.decline(p, offer, reason)) setAsking(false); };
  const why = decision?.reason && decision.reason !== 'No reason given' ? decision.reason : '';
  return (
    <div className={`f-offer${decision ? ` is-${decision.type}` : ''}`}>
      <p className="f-offer-title">{words.title}</p>
      <p className="t-small">{words.text}</p>
      {!decision && !offer.canAccept && offer.why && <p className="t-small f-why">{offer.why}</p>}
      {!decision && !asking && (
        <div className="f-offer-acts">
          {offer.canAccept && <button type="button" className="f-btn is-quiet is-small" onClick={() => doings.take(p, offer)} disabled={Boolean(busy)}>Take</button>}
          <button type="button" className="f-btn is-quiet is-small" onClick={() => setAsking(true)} disabled={Boolean(busy)}>Decline</button>
        </div>
      )}
      {!decision && asking && (
        <div className="f-offer-why">
          <input
            ref={field}
            type="text"
            className="f-input"
            placeholder="Why? You can leave this empty."
            aria-label="Why you are declining"
            maxLength={200}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') { event.preventDefault(); go(); }
              if (event.key === 'Escape') { event.preventDefault(); setAsking(false); }
            }}
          />
          <div className="f-offer-acts">
            <button type="button" className="f-btn is-quiet is-small" onClick={go} disabled={Boolean(busy)}>Decline it</button>
            <button type="button" className="f-link" onClick={() => setAsking(false)}>keep it</button>
          </div>
        </div>
      )}
      {decision && <p className="t-label f-decided">{decidedLine(decision)}</p>}
      {why && <p className="t-small f-why">“{why}”</p>}
    </div>
  );
}

// :: the letter

function fit(area) {
  if (!area) return;
  area.style.height = 'auto';
  area.style.height = `${area.scrollHeight + 2}px`;
}

function Letter({ p, busy, doings }) {
  const L = p.letter;
  const locked = Boolean(L.approvedAt);
  const draft = () => ({ to: L.to, subject: L.subject, body: L.body, ...kept.drafts.get(L.key) });
  const [words, setWords] = useState(draft);
  const [copied, setCopied] = useState('');
  const body = useRef(null);
  const copy = useRef(null);
  const wasLocked = useRef(locked);

  // a letter for a different amount is a different letter
  useEffect(() => { setWords(draft()); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [L.key]);
  useLayoutEffect(() => { fit(body.current); });
  useEffect(() => {
    const onResize = () => fit(body.current);
    window.addEventListener('resize', onResize);
    document.fonts?.ready?.then(onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  useEffect(() => {
    if (locked && !wasLocked.current) copy.current?.focus({ preventScroll: true });
    wasLocked.current = locked;
  }, [locked]);

  const change = (key) => (event) => {
    const next = { ...words, [key]: event.target.value };
    setWords(next);
    kept.drafts.set(L.key, next);
  };
  const standing = locked ? '' : !L.canApprove ? L.why : L.lapsed ? 'The book changed after this was approved. Read it again, then approve it.' : '';
  const sent = { ...L, ...words };

  return (
    <div className={`f-letter t-box${locked ? ' is-approved' : ''}`} id={`f-letter-${p.id}`}>
      <span className="t-box-name">letter</span>
      <label className="f-field"><span className="t-label">to</span><input className="f-input" type="text" value={words.to} readOnly={locked} onChange={change('to')} /></label>
      <label className="f-field"><span className="t-label">subject</span><input className="f-input" type="text" value={words.subject} readOnly={locked} onChange={change('subject')} /></label>
      <textarea
        ref={body}
        className="f-body"
        rows={10}
        spellCheck="true"
        aria-label="Your letter"
        value={words.body}
        readOnly={locked}
        onChange={(event) => { change('body')(event); fit(event.target); }}
      />
      <div className="f-letter-foot">
        {locked ? (
          <div className="f-approved" key="approved">
            <p className="t-label f-approved-line">{approvedLine(L)}</p>
            <button
              ref={copy}
              type="button"
              className="f-btn is-quiet is-small"
              onClick={async () => {
                const ok = await copyText(`To: ${sent.to}\nSubject: ${sent.subject}\n\n${sent.body}`);
                setCopied(ok ? 'Copied' : 'Select the letter and copy it');
                setTimeout(() => setCopied(''), 1800);
              }}
            >{copied || 'Copy'}</button>
            <button type="button" className="f-btn is-quiet is-small" onClick={() => downloadLetter(p, sent)}>Download .eml</button>
          </div>
        ) : (
          <>
            {L.canApprove && (
              <button type="button" className="f-btn" onClick={() => doings.approve(p)} disabled={Boolean(busy)}>
                {busy === p.id ? 'Approving…' : 'Approve this letter'}
              </button>
            )}
            {standing && <p className="t-small f-standing">{standing}</p>}
          </>
        )}
      </div>
    </div>
  );
}
