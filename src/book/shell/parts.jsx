// The parts every page of the book is made from. Build a page out of these and
// it sits on the same desk, in the same ink, as the front page.
//
//   <Sheet>            a ledger page (green stock, three binder holes)
//   <SheetHead>        its heading: kicker, title, one sentence, the dater stamp
//   <Ledger>/<Row>/<Cell>/<Total>   the ruled table; rows are buttons or links
//   <Paper>            any other piece of paper: a letter, an invoice, a form, a tag
//   <Stamp>            a rubber stamp, crooked and worn, that can land with a thud
//   <Tally>            the strip of boxes that get punched as money arrives
//   <Btn>/<Why>        a button, and the reason it will not press
//   <Filters>          words with counts
//   <Field>            a labelled blank on a form
//   <Empty>/<Notice>   an empty page; the one honest line
//   <Over>             a paper brought forward over the desk (a dialog)
//   useToast()         a slip that says what just happened
//
// The CSS is ./book.css; the paper itself (stocks, shadow, stamps) is ../kit/paper.css.

import React, { useEffect, useId, useRef, useState } from 'react';
import { reducedMotion, sound } from '../kit/paper.js';
import { CoinStrip } from '../ui/Coins.jsx';
import { stampDay } from './money.mjs';

const cx = (...names) => names.filter(Boolean).join(' ');

/** The same seed gives the same small numbers every time, so a stamp keeps its tilt between visits. */
function seeded(seed) {
  let h = 2166136261;
  for (const ch of String(seed)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ————————————————————————————————————————————————— sheets

export function Sheet({ children, className, holes = true, ...rest }) {
  return (
    <article className={cx('paper bk-sheet', className)} {...rest}>
      <div className="paper-face stock-ledger">
        {holes && <><i className="bk-hole" /><i className="bk-hole" /><i className="bk-hole" /></>}
        {children}
      </div>
    </article>
  );
}

/** kicker: a short noun for the kind of page. side: what sits on the right (a figure, a stamp). */
export function SheetHead({ kicker, back, title, lede, side, date = true, children }) {
  return (
    <header className="bk-head">
      {(kicker || back || date) && (
        <div className="bk-kicker">
          {back}
          {kicker && <span>{kicker}</span>}
          {date && <Dater style={{ marginLeft: 'auto' }} />}
        </div>
      )}
      <h1>{title}</h1>
      {side && <div className="bk-head-side">{side}</div>}
      {lede && <p className="bk-lede">{lede}</p>}
      {children}
    </header>
  );
}

/** The date this page was opened, from a dater stamp. */
export function Dater({ date, className, ...rest }) {
  // With no date given it is today where the reader is sitting, not the engine's UTC day.
  const at = new Date();
  const local = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;
  return <span className={cx('bk-dater', className)} {...rest}>{stampDay(date || local)}</span>;
}

// ————————————————————————————————————————————————— the ruled ledger

/**
 * cols: the grid, e.g. "var(--bk-lm) 1.2fr 2fr 124px 140px". The first column is the margin.
 * head: [{ label, num, owed, rule: 'red' | 'double' | 'none' }], one per column, the margin included.
 */
export function Ledger({ cols, head, children, total, className, ...rest }) {
  return (
    <div className={cx('bk-ledger', className)} style={{ '--cols': cols }} role="table" {...rest}>
      {head && (
        <div className="bk-lhead" role="row">
          {head.map((h, i) => (
            <span key={i} role="columnheader" className={cx(h?.num && 'is-num', h?.owed && 'is-owed', h?.rule && `r-${h.rule}`)}>{h?.label ?? ''}</span>
          ))}
        </div>
      )}
      <div className="bk-lrows" role="rowgroup">{children}</div>
      {total}
    </div>
  );
}

/** A line in the ledger. Give it onClick or href and the whole line can be pressed. lines: how many rules tall. */
export function Row({ children, onClick, href, lines = 1, open, className, ...rest }) {
  const names = cx('bk-lrow', lines === 2 && 'is-tall', lines >= 3 && 'is-taller', open && 'is-open', className);
  const style = lines > 3 ? { minHeight: `calc(var(--bk-rule) * ${lines})` } : undefined;
  if (href) return <a className={names} style={style} href={href} role="row" {...rest}>{children}</a>;
  if (onClick) return <button type="button" className={names} style={style} onClick={onClick} role="row" {...rest}>{children}</button>;
  return <div className={names} style={style} role="row" {...rest}>{children}</div>;
}

/** label is what the phone prints beside the value, since the column heads are gone there. */
export function Cell({ children, label, no, name, text, num, date, owed, quiet, rule, className, ...rest }) {
  return (
    <span
      role="cell"
      data-label={label}
      className={cx('bk-cell', no && 'is-no', name && 'is-name', text && 'is-text', num && 'is-num', date && 'is-date', owed && 'is-owed', quiet && 'is-quiet', rule && `r-${rule}`, className)}
      {...rest}
    >{children}</span>
  );
}

/** The foot of a ledger: cells: [{ label } | { value, owed, rule, says } | null], one per column.
 *  `says` is what the phone prints beside the figure, since the column heads are gone there. */
export function Total({ cells }) {
  return (
    <div className="bk-ltotal" role="row">
      {cells.map((c, i) => {
        if (!c) return <span key={i} className="r-none" />;
        if (c.label) return <span key={i} className="is-label r-none" style={c.span ? { gridColumn: `span ${c.span}` } : undefined}>{c.label}</span>;
        return <span key={i} data-label={c.says} className={cx('is-num', c.owed && 'is-owed', c.rule && `r-${c.rule}`)}><b>{c.value}</b></span>;
      })}
    </div>
  );
}

// ————————————————————————————————————————————————— paper

/**
 * Any piece of paper. w is its width in millimetres; rot its resting turn in degrees.
 * stock: bond | cool | laid | ledger | manila | carbon.  edge: perf-left | perf-right | perf-top | perf-bottom.
 * as: 'article' by default; pass 'button' or 'a' (with href) to make the whole sheet pressable.
 */
export function Paper({ as: Tag = 'article', w, rot = 0, stock = 'bond', edge, className, faceClassName, style, children, ...rest }) {
  return (
    <Tag className={cx('paper', className)} style={{ ...(w ? { '--W': w } : null), '--rot': `${rot}deg`, ...style }} {...rest}>
      <div className={cx('paper-face', `stock-${stock}`, edge && `edge-${edge}`, faceClassName)}>{children}</div>
    </Tag>
  );
}

/**
 * A rubber stamp. Its tilt and wear come from `seed`, so the same stamp looks the same on every visit
 * and no two are alike. ink: 'blue' | 'red' (red only for money still owed: OVERDUE).
 * land: bring it down with a thud when it first appears (an approval just given, a PAID just earned).
 */
export function Stamp({ children, sub, seed, small, ink = 'blue', tilt, land = false, className, style, ...rest }) {
  const ref = useRef(null);
  const rand = seeded(seed ?? String(children));
  const sign = rand() < 0.5 ? -1 : 1;
  const angle = tilt ?? sign * (4 + rand() * 5);
  const wearSize = Math.round(120 + rand() * 90);
  const wearAt = `${Math.round(rand() * 200)}px ${Math.round(rand() * 200)}px`;
  useEffect(() => {
    const el = ref.current;
    if (!land || !el || reducedMotion()) return undefined;
    el.classList.add('is-landing');
    const sheet = el.closest('.paper');
    const hit = setTimeout(() => { sound.thud(); sheet?.classList.add('is-struck'); }, 120);
    const done = setTimeout(() => { el.classList.remove('is-landing'); sheet?.classList.remove('is-struck'); }, 380);
    return () => { clearTimeout(hit); clearTimeout(done); el.classList.remove('is-landing'); sheet?.classList.remove('is-struck'); };
  }, [land]);
  return (
    <span
      ref={ref}
      className={cx('stamp', small && 'is-small', `is-${ink}`, className)}
      style={{ '--tilt': `${angle.toFixed(1)}deg`, '--wear-size': `${wearSize}px`, '--wear-at': wearAt, ...style }}
      {...rest}
    >
      {children}{sub && <small>{sub}</small>}
    </span>
  );
}

/**
 * A promise's coins: one per $100 (`boxes` of them), the first `punched` came in on an invoice,
 * the rest are still owed. When `punched` goes up the new coins turn over one after another.
 * (The name is the book's old one: it used to be a strip of boxes punched out.)
 */
export function Tally({ boxes, punched = 0, className, u = 3, perRow = 0, offer = false }) {
  const total = Math.max(0, Math.ceil(boxes || 0));
  const came = Math.max(0, Math.min(total, Math.floor(punched || 0)));
  const states = Array.from({ length: total }, (_, i) => (offer ? 'offer' : i < came ? 'in' : 'owed'));
  return (
    <CoinStrip
      states={states}
      u={u}
      perRow={perRow}
      className={cx('bk-coins', className)}
      label={`${came} of ${total} coins came in`}
    />
  );
}

// ————————————————————————————————————————————————— controls

/**
 * why: the reason this will not press. When it is not empty the button is disabled and the
 * reason is printed next to it, in words ("Waiting for an approver. You are signed in as analyst.").
 * busy: the same act, in progress ("Posting…").
 */
export function Btn({ children, quiet, big, why, busy, className, as: Tag = 'button', ...rest }) {
  const button = (
    <Tag
      type={Tag === 'button' ? 'button' : undefined}
      className={cx('bk-btn', quiet && 'is-quiet', big && 'is-big', className)}
      aria-busy={busy ? true : undefined}
      {...rest}
      disabled={Tag === 'button' ? Boolean(why) || Boolean(busy) || Boolean(rest.disabled) : undefined}
    >{busy || children}</Tag>
  );
  if (!why) return button;
  return <span className="bk-actions">{button}<Why>{why}</Why></span>;
}

export function Why({ children }) {
  return children ? <span className="bk-why">{children}</span> : null;
}

/** items: [{ id, label, count }]. A filter says how many it holds before you press it. */
export function Filters({ items, value, onChange, label = 'Show', className }) {
  return (
    <div className={cx('bk-filters', className)} role="group" aria-label={label}>
      {items.map(item => (
        <button key={item.id} type="button" className="bk-filter" aria-pressed={value === item.id} onClick={() => onChange(item.id)}>
          <b>{item.label}</b>{item.count != null && <i>{item.count}</i>}
        </button>
      ))}
    </div>
  );
}

/** A labelled blank. Put the input, select or textarea inside. hint sits under it; wrong turns the rule red. */
export function Field({ label, hint, wrong, children, className }) {
  const id = useId();
  const child = React.isValidElement(children) ? React.cloneElement(children, { id: children.props.id || id, 'aria-invalid': wrong ? true : undefined }) : children;
  return (
    <div className={cx('bk-field', wrong && 'is-wrong', className)}>
      <label htmlFor={React.isValidElement(children) ? (children.props.id || id) : undefined}>{label}</label>
      {child}
      {(wrong || hint) && <small>{wrong || hint}</small>}
    </div>
  );
}

/** A search line: "Find" then what you type. */
export function Find({ value, onChange, placeholder, label = 'Find' }) {
  const id = useId();
  return (
    <div className="bk-find">
      <label htmlFor={id}>{label}</label>
      <input id={id} type="search" value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} autoComplete="off" spellCheck={false} />
    </div>
  );
}

/** An empty page says why it is empty, then what fills it. */
export function Empty({ children, then }) {
  return (
    <div className="bk-empty">
      <p>{children}</p>
      {then && <p>{then}</p>}
    </div>
  );
}

export function Notice({ children }) {
  return <p className="bk-notice">{children}</p>;
}

// ————————————————————————————————————————————————— a paper brought forward

/**
 * A dialog: the desk dims and one paper comes forward. Escape, the Close link or a click on
 * the desk puts it back, and the focus returns to whatever opened it.
 * Children should be a single <Paper>; a Close link is added to its corner.
 */
export function Over({ onClose, label, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const opener = document.activeElement;
    const root = ref.current;
    const focusable = () => [...root.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')].filter(n => n.getClientRects().length);
    (root.querySelector('[data-autofocus]') || focusable()[0])?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = event => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }
      if (event.key !== 'Tab') return;
      const all = focusable();
      if (!all.length) return;
      const first = all[0], last = all[all.length - 1];
      if (event.shiftKey && (document.activeElement === first || !root.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !root.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
      if (opener instanceof HTMLElement && document.contains(opener)) opener.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div ref={ref} className="bk-over" role="dialog" aria-modal="true" aria-label={label} onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      {children}
    </div>
  );
}

/** The Close link for the corner of a paper inside <Over>. */
export function Close({ onClose, children = 'Put it back' }) {
  return <button type="button" className="bk-close" onClick={onClose}>{children}</button>;
}

// ————————————————————————————————————————————————— what just happened

/**
 * const [toast, say] = useToast();  say('Posted. Nobody was emailed.');  say('That did not save: …', { wrong: true });
 * Render {toast} once, anywhere in the page.
 */
export function useToast(ms = 4200) {
  const [note, setNote] = useState(null);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  function say(text, { wrong = false } = {}) {
    clearTimeout(timer.current);
    setNote({ text, wrong, key: Date.now() });
    timer.current = setTimeout(() => setNote(null), wrong ? ms * 1.8 : ms);
  }
  const toast = note && (
    <Paper key={note.key} as="div" className={cx('bk-toast', note.wrong && 'is-wrong')} role={note.wrong ? 'alert' : 'status'}>
      {note.text}
    </Paper>
  );
  return [toast, say];
}

export { cx };
