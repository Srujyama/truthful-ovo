// Every paper in the drawer as one small mark, grouped by what it is, each group
// with its name and count over it. When a filter changes, the marks that stay move
// to their new places and the rest fade out, in a short tween; with reduced motion
// they are simply there. A mark under the pointer is underlined and named; pressed,
// it opens its paper. The list under the figure holds the same papers for the keyboard.
//
//   <PaperFigure groups={[{ key, label, items: [{ key, mark, ink, title, company, href }] }]} label="…" />

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { reducedMotion } from '../../kit/paper.js';
import { PAGE_H, PAGE_W, drawMark } from './glyphs.js';

const TWEEN = 380;
const LABEL = 30;          // room over a group for its name
const LINE_GAP = 26;       // between two lines of groups, when they wrap
const ease = t => 1 - (1 - t) ** 3;

/** Where every mark and every group name goes, for a frame `width` pixels wide. */
export function layOut(groups, width, u) {
  const pitchX = (PAGE_W + 3) * u, pitchY = (PAGE_H + 2) * u;
  const markW = PAGE_W * u, markH = PAGE_H * u;
  const filled = groups.filter(group => group.items.length);
  const largest = Math.max(1, ...filled.map(group => group.items.length));
  const rows = largest <= 6 ? 2 : largest <= 18 ? 3 : 4;
  const gap = Math.max(28, 6 * u);
  const blocks = filled.map(group => {
    const cols = Math.ceil(group.items.length / rows);
    const marks = cols * pitchX - 3 * u;
    // the name is set in the text face, the count in mono; neither may run into the next group
    const named = group.label.length * 7.4 + String(group.items.length).length * 7 + 10;
    return { group, cols, marks, w: Math.max(marks, Math.ceil(named)) };
  });

  // groups run left to right and wrap to a new line when the frame is full
  const lines = [];
  let line = null;
  for (const block of blocks) {
    if (!line || (line.x > 0 && line.x + block.w > width)) { line = { x: 0, blocks: [] }; lines.push(line); }
    block.x = line.x;
    line.blocks.push(block);
    line.x += block.w + gap;
  }

  const at = new Map(), names = [];
  let top = 0;
  for (const each of lines) {
    const tallest = Math.min(rows, Math.max(...each.blocks.map(block => block.group.items.length)));
    const body = tallest * pitchY - 2 * u;
    for (const block of each.blocks) {
      names.push({ key: block.group.key, label: block.group.label, count: block.group.items.length, x: block.x, y: top });
      block.group.items.forEach((item, i) => {
        const col = Math.floor(i / rows), row = i % rows;
        at.set(item.key, { item, x: block.x + col * pitchX, y: top + LABEL + body - (row + 1) * pitchY + 2 * u });
      });
    }
    top += LABEL + body + LINE_GAP;
  }
  return { at, names, markW, markH, height: Math.max(0, top - LINE_GAP + u * 2) };
}

export function PaperFigure({ groups, label, className = '' }) {
  const frame = useRef(null), canvas = useRef(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState(null);
  const shown = useRef(new Map());           // key → { item, x, y, a }: what is on the canvas now
  const raf = useRef(0);
  const plan = useRef(null);

  useLayoutEffect(() => {
    const el = frame.current;
    if (!el) return undefined;
    const read = () => setWidth(Math.floor(el.getBoundingClientRect().width));
    read();
    const watch = new ResizeObserver(read);
    watch.observe(el);
    return () => watch.disconnect();
  }, []);

  const u = !width || width >= 900 ? 7 : width >= 560 ? 6 : 4;
  const laid = width ? layOut(groups, width, u) : null;
  plan.current = laid;
  const signature = laid ? [...laid.at.entries()].map(([key, p]) => `${key}:${p.x},${p.y}:${p.item.ink}`).join('|') : '';

  function paint(marks, height, lit) {
    const el = canvas.current;
    if (!el || !laid) return;
    const dpr = window.devicePixelRatio || 1;
    const w = width, h = Math.max(1, Math.ceil(height));
    if (el.width !== Math.round(w * dpr) || el.height !== Math.round(h * dpr)) {
      el.width = Math.round(w * dpr);
      el.height = Math.round(h * dpr);
      el.style.width = `${w}px`;
      el.style.height = `${h}px`;
    }
    const ctx = el.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, w, h);
    for (const [key, m] of marks) {
      if (m.a <= 0.01) continue;
      ctx.globalAlpha = m.a;
      const x = Math.round(m.x), y = Math.round(m.y);
      drawMark(ctx, x, y, u, m.item.mark, m.item.ink);
      if (key === lit) {
        ctx.fillStyle = '#11161a';
        ctx.fillRect(x, y + laid.markH + u, laid.markW, Math.max(2, u / 2));
      }
    }
    ctx.globalAlpha = 1;
  }

  // a new arrangement: tween from where everything is now
  useEffect(() => {
    if (!laid) return undefined;
    cancelAnimationFrame(raf.current);
    const from = new Map(shown.current);
    const to = new Map();
    for (const [key, p] of laid.at) to.set(key, { item: p.item, x: p.x, y: p.y, a: 1 });
    for (const [key, m] of from) if (!to.has(key)) to.set(key, { ...m, a: 0 });
    const still = reducedMotion() || !from.size;
    const height = Math.max(laid.height, still ? 0 : (canvas.current?.clientHeight || 0));
    if (still) {
      shown.current = new Map([...to].filter(([, m]) => m.a > 0));
      paint(shown.current, laid.height, hover);
      return undefined;
    }
    const start = performance.now();
    const tick = now => {
      const t = Math.min(1, (now - start) / TWEEN), k = ease(t);
      const marks = new Map();
      for (const [key, end] of to) {
        const begin = from.get(key) || { ...end, a: 0 };
        marks.set(key, { item: end.item, x: begin.x + (end.x - begin.x) * k, y: begin.y + (end.y - begin.y) * k, a: begin.a + (end.a - begin.a) * k });
      }
      shown.current = new Map([...marks].filter(([, m]) => t < 1 || m.a > 0));
      paint(marks, t < 1 ? height : laid.height, null);
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, width]);

  // the mark under the pointer is underlined
  useEffect(() => {
    if (laid && shown.current.size) paint(shown.current, laid.height, hover);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hover]);

  function hit(event) {
    const box = canvas.current?.getBoundingClientRect();
    if (!box || !plan.current) return null;
    const x = event.clientX - box.left, y = event.clientY - box.top;
    for (const [key, p] of plan.current.at) {
      if (x >= p.x - u && x <= p.x + plan.current.markW + u && y >= p.y - u && y <= p.y + plan.current.markH + 2 * u) return key;
    }
    return null;
  }

  const lit = hover && laid?.at.get(hover);
  return (
    <div ref={frame} className={`bk-pap-fig ${className}`} style={{ height: laid ? laid.height : undefined }}>
      {laid?.names.map(name => (
        <span key={name.key} className="bk-pap-fig-name" style={{ translate: `${name.x}px ${name.y}px` }}>
          {name.label}<i>{name.count}</i>
        </span>
      ))}
      <canvas
        ref={canvas}
        role="img"
        aria-label={label}
        style={{ top: 0, cursor: lit ? 'pointer' : 'default' }}
        onPointerMove={event => setHover(hit(event))}
        onPointerLeave={() => setHover(null)}
        onClick={event => { const key = hit(event); const p = key && plan.current.at.get(key); if (p) location.hash = p.item.href; }}
      />
      {lit && (
        <span
          className={`bk-pap-fig-tip${lit.x > width - 280 ? ' is-left' : ''}`}
          style={{ translate: `${lit.x > width - 280 ? lit.x + laid.markW : lit.x}px ${lit.y + laid.markH + u * 3}px` }}
          aria-hidden="true"
        >
          <b>{lit.item.title}</b> {lit.item.company}
        </span>
      )}
    </div>
  );
}

export default PaperFigure;
