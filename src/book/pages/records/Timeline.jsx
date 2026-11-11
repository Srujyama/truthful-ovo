// The day book as a thin timeline: one small mark per entry, on the day it went in,
// stacked when a day holds more than one, the first at the foot. The months are marked
// under the line. Entries the filters leave out fade back; when the page opens the
// entries go in one after another, oldest first. A mark under the pointer is underlined
// and its line shown; pressed, it opens that entry. With reduced motion nothing moves.
//
//   <Timeline entries={[{ seq, day, kind, said }]} lit={Set of seq} open={seq} end="2026-11-10" onOpen={seq => …} />

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { reducedMotion } from '../../kit/paper.js';
import { daysBetween, shortDay } from '../../shell/money.mjs';
import { MARK, drawEntry } from './marks.js';

const TOP = 6;
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
/** Pixels per square: 3 on a wide page, 2 on a phone. A mark is 5 squares; stacks and columns keep a gap. */
const sizes = width => {
  const U = width >= 700 ? 3 : 2;
  const W = MARK * U;
  return { U, W, STEP: W + U + 1, PITCH: W + U };
};

/** Where every mark goes on a line `width` pixels long. */
export function placeEntries(entries, width, end) {
  const { U, W, STEP, PITCH } = sizes(width);
  const days = [...new Set(entries.map(entry => entry.day))].sort();
  if (!days.length) return { at: new Map(), ticks: [], height: 0, base: 0, U, W };
  const start = days[0];
  const last = end && end > days.at(-1) ? end : days.at(-1);
  const span = Math.max(1, daysBetween(start, last));
  const usable = Math.max(W, width - W);
  const want = days.map(d => Math.round((daysBetween(start, d) / span) * usable));
  // days too close to tell apart are pushed along, then the whole line is kept inside the frame
  const x = [...want];
  for (let i = 1; i < x.length; i += 1) x[i] = Math.max(x[i], x[i - 1] + STEP);
  if (x.at(-1) > usable) {
    x[x.length - 1] = usable;
    for (let i = x.length - 2; i >= 0; i -= 1) x[i] = Math.min(x[i], x[i + 1] - STEP);
  }
  const column = new Map(days.map((d, i) => [d, x[i]]));
  const stacks = new Map();
  for (const entry of [...entries].sort((a, b) => a.seq - b.seq)) {
    const list = stacks.get(entry.day) || [];
    list.push(entry);
    stacks.set(entry.day, list);
  }
  const tallest = Math.max(...[...stacks.values()].map(list => list.length));
  const base = TOP + tallest * PITCH;
  const at = new Map();
  for (const [d, list] of stacks) list.forEach((entry, k) => at.set(entry.seq, { entry, x: column.get(d), y: base - (k + 1) * PITCH + U }));

  // the first of each month on the line, and the last day
  const ticks = [];
  const [y0, m0] = start.split('-').map(Number);
  for (let y = y0, m = m0; ; m += 1) {
    if (m > 12) { m = 1; y += 1; }
    const first = `${y}-${String(m).padStart(2, '0')}-01`;
    if (first > last) break;
    if (first >= start) ticks.push({ key: first, x: Math.round((daysBetween(start, first) / span) * usable), label: MONTHS[m - 1] });
  }
  if (!ticks.length || ticks[0].key !== start) ticks.unshift({ key: start, x: 0, label: shortDay(start).toLowerCase() });
  const endX = usable + W;
  if (endX - ticks.at(-1).x > 70) ticks.push({ key: `end:${last}`, x: endX, label: shortDay(last).toLowerCase(), end: true });
  return { at, ticks, base, height: base + 34, U, W };
}

export default function Timeline({ entries, lit, open, end, onOpen, label }) {
  const frame = useRef(null), canvas = useRef(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState(null);
  const alpha = useRef(new Map());     // seq → how strongly it is drawn now
  const raf = useRef(0);
  const born = useRef(false);

  useLayoutEffect(() => {
    const el = frame.current;
    if (!el) return undefined;
    const read = () => setWidth(Math.floor(el.getBoundingClientRect().width));
    read();
    const watch = new ResizeObserver(read);
    watch.observe(el);
    return () => watch.disconnect();
  }, []);

  const placed = useMemo(() => (width ? placeEntries(entries, width, end) : null), [entries, width, end]);
  const litKey = entries.map(entry => (lit.has(entry.seq) ? 1 : 0)).join('');

  function paint(lift = hover) {
    const el = canvas.current;
    if (!el || !placed) return;
    const dpr = window.devicePixelRatio || 1;
    if (el.width !== Math.round(width * dpr) || el.height !== Math.round(placed.height * dpr)) {
      el.width = Math.round(width * dpr);
      el.height = Math.round(placed.height * dpr);
      el.style.width = `${width}px`;
      el.style.height = `${placed.height}px`;
    }
    const ctx = el.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, width, placed.height);
    // the line of days, and a short tick at each month
    ctx.fillStyle = '#bfc6c1';
    ctx.fillRect(0, placed.base + 5, width, 1);
    for (const tick of placed.ticks) ctx.fillRect(Math.min(width - 1, tick.x), placed.base + 5, 1, 5);
    const { U, W } = placed;
    for (const [seq, p] of placed.at) {
      const a = alpha.current.get(seq) ?? 0;
      if (a <= 0.01) continue;
      ctx.globalAlpha = a;
      drawEntry(ctx, p.x, p.y, U, p.entry.kind);
      if (seq === lift || seq === open) {
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#11161a';
        ctx.fillRect(p.x, p.y + W + 1, W, U > 2 ? 2 : 1);
      }
    }
    ctx.globalAlpha = 1;
  }

  // how strongly each mark is drawn: the ones the filters keep, fully; the rest, faintly
  useEffect(() => {
    if (!placed) return undefined;
    cancelAnimationFrame(raf.current);
    const target = new Map(entries.map(entry => [entry.seq, lit.has(entry.seq) ? 1 : 0.16]));
    if (reducedMotion()) {
      alpha.current = target;
      born.current = true;
      paint();
      return undefined;
    }
    const from = new Map(alpha.current);
    const first = !born.current;
    born.current = true;
    const order = [...entries].sort((a, b) => a.seq - b.seq).map(entry => entry.seq);
    const length = first ? 760 : 220;
    const start = performance.now();
    const tick = now => {
      const t = Math.min(1, (now - start) / length);
      for (const [seq, to] of target) {
        if (first) {
          // the book being written: each entry goes in after the one before it
          const k = Math.min(1, Math.max(0, t * (order.length + 6) - order.indexOf(seq)) / 6);
          alpha.current.set(seq, to * k);
        } else {
          const was = from.get(seq) ?? to;
          alpha.current.set(seq, was + (to - was) * (1 - (1 - t) ** 3));
        }
      }
      paint();
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placed, litKey]);

  useEffect(() => { paint(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [hover, open]);

  function hit(event) {
    const box = canvas.current?.getBoundingClientRect();
    if (!box || !placed) return null;
    const x = event.clientX - box.left, y = event.clientY - box.top, { W } = placed;
    for (const [seq, p] of placed.at) if (x >= p.x - 2 && x <= p.x + W + 2 && y >= p.y - 1 && y <= p.y + W + 2) return seq;
    return null;
  }

  const shown = hover != null && placed?.at.get(hover);
  const flip = shown && shown.x > width - 360;
  return (
    <div ref={frame} className="bk-rec-tl" style={{ height: placed ? placed.height : 80 }}>
      <canvas
        ref={canvas}
        role="img"
        aria-label={label}
        style={{ cursor: shown ? 'pointer' : 'default' }}
        onPointerMove={event => setHover(hit(event))}
        onPointerLeave={() => setHover(null)}
        onClick={event => { const seq = hit(event); if (seq != null) onOpen(seq); }}
      />
      {placed?.ticks.map(tick => (
        <span key={tick.key} className={`bk-rec-tl-tick${tick.end ? ' is-end' : ''}`} style={{ translate: `${tick.x}px ${placed.base + 14}px` }}>{tick.label}</span>
      ))}
      {shown && (
        <span className={`bk-rec-tl-tip${flip ? ' is-left' : ''}`} style={{ translate: `${flip ? shown.x + placed.W : shown.x}px ${shown.y - 8}px` }} aria-hidden="true">
          <b>{shortDay(shown.entry.day)}</b> {shown.entry.said}
        </span>
      )}
    </div>
  );
}
