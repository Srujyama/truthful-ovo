// Many coins on one canvas: the cover's crowd, and any page that wants every promise at once.
//
//   <Crowd marks={crowd.marks}
//          sorts={[{ mode: 'bands', groups: crowd.byCompany }, { mode: 'blocks', groups: crowd.byKind }]}
//          at={0} height={420} label="…" />
//
// marks   [{ id, state: 'in'|'owed'|'note'|'offer', owner, title }]   one per $100 (see crowd.js)
// sorts   the ways to stand them. `at` picks one; change it and every coin walks to its new place.
//         bands: a band of rows per group, its name in the margin on a dotted leader
//         blocks: a pile per group, its name above it
// labels  false on a phone: no names on the sheet (the page lists them under it)
// side    room kept each side of the bands for their names
// onOpen  onOpen(owner) when a coin is pressed
//
// A coin turns as the pointer passes it, and now and then one glints. A coin whose
// state changes turns over to its new face. With reduced motion (or `still`) nothing
// turns and nothing walks: it is simply in its place.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { COIN, drawCoin } from './coins.js';
import { fit } from './crowd.js';

const MOVE_MS = 560;
const TURN_MS = 380;          // one turn: face on, to the edge, and back
const REST_MS = 650;          // a coin that just turned waits this long before the pointer turns it again
const BLEED = 8;              // room round the sheet so a ring round an edge coin is not cut off
const ease = (t) => 1 - (1 - t) ** 3;
const calmNow = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const sprites = new Map();
function sprite(state, frame, square) {
  const key = `${state}|${frame}|${square}`;
  let canvas = sprites.get(key);
  if (canvas) return canvas;
  canvas = document.createElement('canvas');
  canvas.width = canvas.height = COIN * square;
  drawCoin(canvas.getContext('2d'), 0, 0, square, state, frame);
  if (sprites.size > 400) sprites.clear();
  sprites.set(key, canvas);
  return canvas;
}

const CSS = `
.t-crowd { position: relative; width: 100%; }
.t-crowd canvas { position: absolute; top: 0; display: block; image-rendering: pixelated; }
.t-crowd.is-open canvas { cursor: default; }
.t-crowd.is-open.is-on-coin canvas { cursor: pointer; }
.t-crowd-note {
  position: absolute; display: flex; align-items: flex-start; gap: 10px; width: max-content;
  font: 400 var(--t-s-small) / 1.35 var(--t-text); color: var(--t-muted); text-decoration: none;
  animation: t-crowd-in 0.5s var(--t-ease) 0.25s backwards;
}
.t-crowd-note.is-left { text-align: right; }
.t-crowd-note > span { display: block; }
.t-crowd-note strong {
  display: block; font: 500 var(--t-s-body) / 1.3 var(--t-text); color: var(--t-ink);
}
.t-crowd-note strong em {
  margin-left: 6px; font: 400 var(--t-s-label) / 1 var(--t-mono); font-style: normal;
  font-variant-numeric: tabular-nums; color: var(--t-muted);
}
.t-crowd-note.t-crowd-owes strong em { color: var(--t-red-ink); }
a.t-crowd-note:hover strong span, a.t-crowd-note:focus-visible strong span { text-decoration: underline; text-underline-offset: 3px; }
.t-crowd-note i {
  flex: none; width: 26px; height: 1px; margin-top: 10px;
  background-image: linear-gradient(90deg, var(--t-ink) 2px, transparent 2px); background-size: 5px 1px;
}
.t-crowd-name {
  position: absolute; top: 0; left: 0; display: flex; align-items: baseline; gap: 7px; white-space: nowrap;
  font: 500 var(--t-s-small) / 1.2 var(--t-text); color: var(--t-ink);
  animation: t-crowd-in 0.5s var(--t-ease) 0.3s backwards;
}
.t-crowd-name em { font: 400 var(--t-s-label) / 1 var(--t-mono); font-style: normal; font-variant-numeric: tabular-nums; color: var(--t-muted); }
.t-crowd-name.t-crowd-owes em { color: var(--t-red-ink); }
.t-crowd-tip {
  position: absolute; top: 0; left: 0; z-index: 3; padding: 5px 8px; border-radius: 2px;
  background: var(--t-ink); color: var(--t-paper); font: 400 var(--t-s-label) / 1.35 var(--t-mono);
  white-space: nowrap; pointer-events: none;
}
@keyframes t-crowd-in { from { opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .t-crowd-note, .t-crowd-name { animation: none; } }
`;
function useCrowdStyles() {
  useEffect(() => {
    let node = document.querySelector('style[data-t-crowd]');
    if (!node) {
      node = document.createElement('style');
      node.setAttribute('data-t-crowd', '');
      document.head.append(node);
    }
    if (node.textContent !== CSS) node.textContent = CSS;
  }, []);
}

export default function Crowd({ marks, sorts, at = 0, height, label, labels = true, side = 0, maxU = 6, minU = 2, top = 30, onOpen, still = false }) {
  useCrowdStyles();
  const wrap = useRef(null);
  const canvas = useRef(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState(null);
  const bodies = useRef(new Map());
  const frame = useRef(0);
  const hoverRef = useRef(null);
  hoverRef.current = hover;

  useEffect(() => {
    const node = wrap.current;
    const measure = () => setWidth(Math.floor(node.clientWidth));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const laidAll = useMemo(
    () => (width && height ? fit(sorts, width, height, { maxU, minU, side, top: labels ? top : 0, alternate: labels }) : null),
    [sorts, width, height, maxU, minU, side, top, labels],
  );
  const laid = laidAll ? laidAll[Math.max(0, Math.min(laidAll.length - 1, at))] : null;
  const offsetY = laid ? Math.max(0, Math.floor((height - laid.height) / 2 / laid.u) * laid.u) : 0;
  const byId = useMemo(() => new Map(marks.map((m) => [m.id, m])), [marks]);
  const calm = still || calmNow();

  const latest = useRef(() => {});
  const draw = useCallback((now) => {
    frame.current = 0;
    const node = canvas.current;
    if (!node || !laid) return;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const w = width + BLEED * 2, h = height + BLEED * 2;
    if (node.width !== Math.round(w * dpr) || node.height !== Math.round(h * dpr)) {
      node.width = Math.round(w * dpr);
      node.height = Math.round(h * dpr);
    }
    const ctx = node.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.translate(BLEED, BLEED);
    ctx.imageSmoothingEnabled = false;
    const { u, coin } = laid;
    const square = Math.max(1, Math.round(u * dpr));
    let busy = false;
    for (const mark of marks) {
      const body = bodies.current.get(mark.id);
      if (!body) continue;
      const t = Math.min(1, Math.max(0, (now - body.start) / MOVE_MS));
      if (t < 1) busy = true;
      const k = ease(t);
      body.x = body.fromX + (body.toX - body.fromX) * k;
      body.y = body.fromY + (body.toY - body.fromY) * k;
      // while walking, a coin keeps to whole squares, so it never smears between pixels
      const snap = t < 1 ? u : 1;
      const x = Math.round(body.x / snap) * snap, y = Math.round(body.y / snap) * snap;
      const appear = Math.min(1, Math.max(0, (now - body.born) / 240));
      if (appear < 1) busy = true;
      let face = body.face, turn = 0;
      if (body.turn) {
        const phase = (now - body.turn) / TURN_MS;
        if (phase >= 1) {
          body.turn = 0;
          body.rested = now;
          body.face = body.next;
          face = body.face;
        } else if (phase >= 0) {
          const edge = phase < 0.5 ? phase * 2 : (1 - phase) * 2;
          turn = Math.min(3, Math.round(edge * 3));
          face = phase < 0.5 ? body.face : body.next;
          busy = true;
        } else busy = true;
      }
      ctx.globalAlpha = appear;
      ctx.drawImage(sprite(face, turn, square), x, y, coin, coin);
      if (mark.id === hoverRef.current) {
        ctx.globalAlpha = 1;
        ctx.strokeStyle = '#7d8682';
        ctx.lineWidth = 1;
        const pad = Math.max(3, u);
        ctx.strokeRect(x - pad + 0.5, y - pad + 0.5, coin + pad * 2 - 1, coin + pad * 2 - 1);
      }
    }
    ctx.globalAlpha = 1;
    if (busy) frame.current = requestAnimationFrame((next) => latest.current(next));
  }, [laid, marks, width, height]);
  latest.current = draw;
  const kick = useCallback(() => {
    if (!frame.current) frame.current = requestAnimationFrame((now) => latest.current(now));
  }, []);

  // A new layout: every coin keeps who it is and walks to its new place.
  // A coin whose state changed turns over to its new face.
  useEffect(() => {
    if (!laid) return;
    const now = performance.now();
    const seen = new Set();
    let n = 0;
    for (const mark of marks) {
      const to = laid.at.get(mark.id);
      if (!to) continue;
      seen.add(mark.id);
      const toX = to.x, toY = to.y + offsetY;
      const body = bodies.current.get(mark.id);
      if (!body) {
        bodies.current.set(mark.id, {
          x: toX, y: toY, fromX: toX, fromY: toY, toX, toY, start: now - MOVE_MS,
          born: calm ? now - 1000 : now + Math.min(n * 9, 520),
          face: mark.state, next: mark.state, turn: 0, rested: 0,
        });
      } else {
        if (body.toX !== toX || body.toY !== toY) {
          body.fromX = calm ? toX : body.x;
          body.fromY = calm ? toY : body.y;
          body.toX = toX;
          body.toY = toY;
          body.start = calm ? now - MOVE_MS : now + Math.min(n * 7, 300);
        }
        if (body.next !== mark.state) {
          if (calm) { body.face = body.next = mark.state; body.turn = 0; }
          else { if (body.turn) body.face = body.next; body.next = mark.state; body.turn = now + n * 22; }
        }
      }
      n += 1;
    }
    for (const id of [...bodies.current.keys()]) if (!seen.has(id)) bodies.current.delete(id);
    kick();
  }, [laid, marks, offsetY, calm, kick]);

  useEffect(() => { kick(); }, [hover, draw, kick]);
  useEffect(() => () => { if (frame.current) cancelAnimationFrame(frame.current); frame.current = 0; }, []);

  // The pointer turns the coins it passes. Now and then one glints.
  useEffect(() => {
    if (calm || !laid) return undefined;
    const turnOne = (body, now) => {
      if (body.turn || now - body.rested < REST_MS) return false;
      body.next = body.face;
      body.turn = now;
      return true;
    };
    const move = (event) => {
      const node = canvas.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const px = event.clientX - rect.left - BLEED, py = event.clientY - rect.top - BLEED;
      if (px < -laid.pitch || py < -laid.pitch || px > width + laid.pitch || py > height + laid.pitch) return;
      const reach = laid.pitch * 0.8;
      const now = performance.now();
      let any = false;
      for (const body of bodies.current.values()) {
        const dx = px - (body.x + laid.coin / 2), dy = py - (body.y + laid.coin / 2);
        if (dx * dx + dy * dy < reach * reach && turnOne(body, now)) any = true;
      }
      if (any) kick();
    };
    addEventListener('pointermove', move, { passive: true });
    const glint = setInterval(() => {
      const node = canvas.current;
      if (document.hidden || !node) return;
      const rect = node.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > innerHeight) return;
      const all = [...bodies.current.values()];
      const body = all[Math.floor(Math.random() * all.length)];
      if (body && turnOne(body, performance.now())) kick();
    }, 1300);
    return () => { removeEventListener('pointermove', move); clearInterval(glint); };
  }, [calm, laid, width, height, kick]);

  const hit = (clientX, clientY) => {
    if (!laid || !canvas.current) return null;
    const rect = canvas.current.getBoundingClientRect();
    const x = clientX - rect.left - BLEED, y = clientY - rect.top - BLEED;
    const pad = (laid.pitch - laid.coin) / 2;
    for (const mark of marks) {
      const to = laid.at.get(mark.id);
      if (!to) continue;
      const cy = to.y + offsetY;
      if (x >= to.x - pad && x < to.x + laid.coin + pad && y >= cy - pad && y < cy + laid.coin + pad) return mark.id;
    }
    return null;
  };

  const tipMark = hover ? byId.get(hover) : null;
  const tipAt = hover && laid ? laid.at.get(hover) : null;
  const groupsNow = sorts[Math.max(0, Math.min(sorts.length - 1, at))]?.groups ?? [];
  const groupOf = (key) => groupsNow.find((g) => g.key === key);

  return (
    <div ref={wrap} className={`t-crowd${onOpen ? ' is-open' : ''}${hover ? ' is-on-coin' : ''}`} style={{ height }} role="group" aria-label={label}>
      <canvas
        ref={canvas}
        aria-hidden="true"
        style={{ left: -BLEED, top: -BLEED, width: width + BLEED * 2, height: height + BLEED * 2 }}
        onPointerMove={(event) => { const id = hit(event.clientX, event.clientY); if (id !== hover) setHover(id); }}
        onPointerLeave={() => setHover(null)}
        onClick={(event) => { const id = hit(event.clientX, event.clientY); if (id && onOpen) onOpen(byId.get(id)?.owner); }}
      />
      {labels && laid?.mode === 'bands' && laid.anchors.map((anchor) => {
        const g = groupOf(anchor.key);
        if (!g) return null;
        const mid = anchor.y + offsetY + laid.coin / 2 - 11;
        const left = anchor.side === 'left';
        const room = left ? anchor.x - 18 : width - anchor.x - 18;
        const style = left
          ? { top: mid, right: `calc(100% - ${anchor.x - 12}px)`, maxWidth: Math.max(80, room) }
          : { top: mid, left: anchor.x + 12, maxWidth: Math.max(80, room) };
        const body = (
          <span>
            <strong><span>{g.label}</span><em>{g.figure}</em></strong>
            {g.note}
          </span>
        );
        const cls = `t-crowd-note ${left ? 'is-left' : 'is-right'}${g.owed ? ' t-crowd-owes' : ''}`;
        const inner = left ? <>{body}<i aria-hidden="true" /></> : <><i aria-hidden="true" />{body}</>;
        return g.href
          ? <a key={`${at}:${g.key}`} className={cls} style={style} href={g.href}>{inner}</a>
          : <p key={`${at}:${g.key}`} className={cls} style={style}>{inner}</p>;
      })}
      {labels && laid?.mode === 'blocks' && laid.blocks.map((block, n) => {
        const g = groupOf(block.key);
        if (!g) return null;
        const next = laid.blocks[n + 1];
        // every name sits on one line, above the tallest pile
        const line = Math.min(...laid.blocks.map((b) => b.y)) + offsetY - 26;
        return (
          <p key={`${at}:${g.key}`} className={`t-crowd-name${g.key === 'owed' || g.key === 'note' ? ' t-crowd-owes' : ''}`}
            style={{ transform: `translate(${block.x}px, ${line}px)`, maxWidth: Math.max(60, (next ? next.x : width) - block.x - 10) }}>
            <span>{g.label}</span><em>{g.figure}</em>
          </p>
        );
      })}
      {tipMark && tipAt && laid && (
        <div className="t-crowd-tip" style={{ transform: `translate(${Math.min(Math.max(0, tipAt.x - 8), Math.max(0, width - 240))}px, ${tipAt.y + offsetY + laid.coin + 10}px)` }}>
          {tipMark.title}
        </div>
      )}
    </div>
  );
}
