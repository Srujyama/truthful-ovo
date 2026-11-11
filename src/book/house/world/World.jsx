// The cover's first screen: Truthful's quarter, live.
//
// The still quarter (world.js) is drawn once; only the figures, the scale's beam
// and what they carry redraw. Over it, in the isokra system: the answer top left,
// the replay's card top centre, a tag beside every place and house (each a
// button that opens the place's panel), the latest line bottom left, zoom and
// night bottom right. On a phone the quarter follows one place at a time and the
// places are a strip of cards along the bottom.
//
// The replay plays the book's own history (story.mjs), a step every ~6 s until
// the visitor touches anything; its last step is today, and the quarter is live:
// approving the letter on your desk sends Truthful's courier over the bridge.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './world.css';
import { createStage } from '../craft/stage.js';
import { C, CLOCK, STATION, STATIONS, at as ground, quarter, vendorAt } from './world.js';
import { createDirector, quarterBox, WHERE } from './director.js';
import { liveStep, storyOf, todayStep } from './story.mjs';
import { latestLine, stationLine, vendorLine } from './lines.mjs';
import { StationPanel, VendorPanel } from './panels.jsx';
import { approveLetterCommands, plainFailure } from '../../front/commands.mjs';
import { dateDay, money } from '../../front/selectors.mjs';

const PHONE = '(max-width: 900px)';
const EMPTY = { inTray: 0, slips: [], promisedCents: 0, creditedCents: 0, owedCents: 0, offers: [], notes: [], waiting: 0, paid: 0, late: [] };
const NAMES = { ...Object.fromEntries(STATIONS.map((s) => [s.id, s.name.toLowerCase()])), clock: 'the clock' };
const PLACES = [...STATIONS.map((s) => s.id), 'clock'];
const calm = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const clockAt = ground(CLOCK.sx, CLOCK.sy);
/** The panel's width on a desk, as world.css sets it: clamp(380px, 28vw, 420px). */
const panelWidth = (w) => Math.min(Math.max(380, innerWidth * 0.28), 420, w - 32);

// The app never writes a moment earlier than the last one it recorded (as BookFront does).
const momentFor = (workspace) => {
  const now = new Date().toISOString();
  const last = workspace.events.at(-1)?.observedAt;
  return last && last > now ? last : now;
};

function useMedia(query) {
  const [on, setOn] = useState(() => typeof matchMedia === 'function' && matchMedia(query).matches);
  useEffect(() => {
    const m = matchMedia(query);
    const read = () => setOn(m.matches);
    m.addEventListener('change', read);
    return () => m.removeEventListener('change', read);
  }, [query]);
  return on;
}

/** Night by the reader's clock (20:00 to 06:00), or ?night=1 / ?night=0. */
function nightAtFirst() {
  const asked = new URLSearchParams(location.search).get('night') ?? new URLSearchParams(location.hash.split('?')[1] ?? '').get('night');
  if (asked === '1' || asked === '0') return asked === '1';
  const hour = new Date().getHours();
  return hour >= 20 || hour < 6;
}

// —— where each place's tag hangs: the top row's above it, the bottom row's below its paving
function placePoint(id) {
  if (id === 'clock') return { point: [clockAt[0], 31, clockAt[1]], alignX: '0%', alignY: '-50%', dx: 18 };
  const s = STATION[id];
  if (s.sy < 0) return { point: [s.at[0], { post: 30, read: 22, book: 28 }[id] ?? 26, s.at[1]], alignX: '-50%', alignY: '-100%', dy: -6 };
  const r = s.r * 0.78;
  return { point: [s.at[0] + r, 1, s.at[1] + r], alignX: '-50%', alignY: '0%', dy: 4 };
}
function housePoint(i, n) {
  const [x, z] = vendorAt(i, n);
  return { point: [x - 9, 6, z + 6], alignX: '-100%', alignY: '-50%', dx: -10 };
}
/** The ground point to look at for a place (the camera on a phone, the panel's glide). */
function lookPoint(id, n) {
  if (id === 'clock') return [clockAt[0], 14, clockAt[1]];
  if (id?.startsWith?.('vendor:')) { const [x, z] = vendorAt(Number(id.slice(7)), n); return [x, 0, z]; }
  const s = STATION[id];
  return s ? [s.at[0], 10, s.at[1]] : [0, 0, 0];
}

// —— the tour's card: where the replay is, what happens there, and the arrows

function TourCard({ step, steps, auto, onBack, onNext, onReplay }) {
  if (!step) return null;
  const n = step.n, N = steps.length;
  const last = n >= N;
  return (
    <section className="qw-tour t-box" aria-label="The book’s history, step by step" aria-live="polite">
      <div className="qw-tour-head">
        <span className="qw-tour-count t-mono">how it got here · {n} of {N}</span>
        <span className="qw-tour-day t-mono">{step.day}</span>
        <span className="qw-tour-btns">
          <button type="button" className="qw-btn" onClick={onBack} disabled={n <= 1} aria-label="Back a step" title="Back (←)">←</button>
          {last
            ? <button type="button" className="qw-btn is-quiet" onClick={onReplay}>Replay</button>
            : <button type="button" className="qw-btn is-ink" onClick={onNext} title="Next (→)">Next →</button>}
        </span>
      </div>
      <p className="qw-tour-said">{step.sentence}</p>
      <span className="qw-tour-line" aria-hidden="true">
        <span key={`${n}:${auto ? 'a' : 'm'}`} className={auto && !last ? 'is-running' : ''} style={{ '--from': `${((n - 1) / N) * 100}%`, '--to': `${(n / N) * 100}%` }} />
      </span>
    </section>
  );
}

// —— the quarter

export default function World({ service, view, go }) {
  const phone = useMedia(PHONE);
  const reduce = useMemo(calm, []);
  const vendors = view?.vendors ?? [];
  const n = vendors.length;

  // the replay, as the book stood when the cover opened; today's step follows the book
  const workspace = service.workspace;
  const recorded = useRef(null);
  if (!recorded.current || recorded.current.id !== workspace?.id || (workspace?.events.length ?? 0) < recorded.current.count) {
    const s = storyOf(workspace, view);
    recorded.current = { id: workspace?.id, count: workspace?.events.length ?? 0, story: s, shown: workspace?.events.length ?? 0 };
  }
  const story = recorded.current.story;
  const steps = useMemo(() => {
    if (story.empty || !view) return [];
    const head = story.steps.slice(0, -1);
    return [...head, { ...todayStep(view), n: head.length + 1, of: head.length + 1 }];
  }, [story, view]);
  const lastIndex = steps.length - 1;

  const [index, setIndex] = useState(0);
  const [run, setRun] = useState(0);              // bumps to play the same step again (Replay)
  const [auto, setAuto] = useState(true);
  const [done, setDone] = useState(false);        // the current step has played to its end
  const [shown, setShown] = useState(null);       // the book as the tags read it
  const [panel, setPanel] = useState(null);       // { kind: 'station' | 'vendor', id }
  const [night, setNight] = useState(nightAtFirst);
  const [touched, setTouched] = useState(false);
  const [focus, setFocus] = useState('post');     // the place a phone looks at
  const [heard, setHeard] = useState('');         // what the figures said, for a screen reader
  const [ready, setReady] = useState(false);
  const [acting, setActing] = useState(null);     // something written in the book since the cover opened, being acted out

  const section = useRef(null);
  const holder = useRef(null);
  const canvas = useRef(null);
  const layer = useRef(null);
  const topBar = useRef(null);
  const panelRef = useRef(null);
  const opener = useRef(null);
  const tags = useRef(new Map());
  const stageRef = useRef(null);
  const directorRef = useRef(null);
  const optionsRef = useRef(null);
  const fitRef = useRef(null);
  const queue = useRef([]);
  const playing = useRef(false);
  const follow = useRef(null);
  const phoneRef = useRef(phone);
  phoneRef.current = phone;
  const viewRef = useRef(view);
  viewRef.current = view;

  const step = steps[index] ?? null;
  const readView = story.empty ? view : shown;

  // —— the stage and its director: made once per quarter (a new company adds a house)
  const scene = useMemo(() => {
    const s = quarter({ vendors: vendors.map((v, i) => ({ color: C.tabs[i % C.tabs.length] })) });
    s.background = C.paper;
    return s;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n]);
  const box = useMemo(() => quarterBox(scene.instances), [scene]);

  useEffect(() => {
    if (!canvas.current) return undefined;
    const units = [2, 3, 4];
    const options = {
      scene,
      center: box.center,
      unit: 2,
      units,
      artWidth: 900,
      background: C.paper,
      nightBackground: { top: 0x0f141b, bottom: 0x1a2330 },
      night: night ? 1 : 0,
      ring: 0xfff6e2,
      levels: 15,
      inset: {},
      // the page scrolls past the quarter with the wheel (zoom is the buttons or a pinch);
      // on a phone a swipe scrolls the page too, and the strip moves the camera
      zoom: false,
      pan: !phone,
      pickable: (id) => typeof id === 'string',
      onPick: (id) => pick(id),
      onHover: () => {},
    };
    optionsRef.current = options;
    const stage = createStage(canvas.current, options);
    stageRef.current = stage;
    const director = createDirector({ stage, scene, vendors: n, names: vendors.map((v) => v.name), layer: layer.current, reduce, onSay: (who, text) => setHeard(`${who}: ${text}`), onFocus: (f) => { if (phoneRef.current) follow.current = f; }, onTaken: () => setShown(viewRef.current) });
    directorRef.current = director;
    const off = stage.on('frame', () => {
      const f = follow.current;
      if (!f) return;
      const p = typeof f === 'function' ? f() : f;
      const c = stage.center;
      if (p && Math.hypot(p[0] - c[0], p[2] - c[2]) > 3) stage.lookAt([p[0], 0, p[2]]);
    });
    setReady(true);
    return () => {
      off();
      director.destroy();
      stage.destroy();
      stageRef.current = null;
      directorRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, phone]);

  // —— fitting: the whole quarter in the view on a desk, one place at a time on a phone.
  // Art pixels are whole device pixels; the zoom is a whole number.
  const fit = useCallback(() => {
    const stage = stageRef.current, options = optionsRef.current, el = holder.current;
    if (!stage || !options || !el) return;
    const rect = el.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const deviceW = Math.round(rect.width * dpr);
    if (phone) {
      const pixel = Math.max(1, Math.round(deviceW / 300));
      options.artWidth = deviceW / pixel;
      options.units.splice(0, options.units.length, 2, 3, 4);
      fitRef.current = { unit: 2, pixel, phone: true };
      stage.setInset({ left: 0, right: 0, top: 0, bottom: panel ? Math.round(rect.height * 0.55) : 96 });
      stage.renderNow();
      stage.lookAt(lookPoint(panel?.id ?? focus, n), { jump: true, unit: 2 });
      return;
    }
    const top = topBar.current ? Math.round(topBar.current.getBoundingClientRect().bottom - rect.top) + 10 : 120;
    const bottom = 52;
    const right = panel ? panelWidth(rect.width) + 32 : 0;
    const availW = (rect.width - right) * 0.96, availH = rect.height - top - bottom;
    let best = { unit: 2, pixel: 1, k: 2 / dpr };
    for (let unit = 2; unit <= 6; unit += 1)
      for (let pixel = 1; pixel <= 6; pixel += 1) {
        const k = (unit * pixel) / dpr;
        // too many art pixels to redraw every frame at 60 fps
        if ((deviceW / pixel) * ((rect.height * dpr) / pixel) > 1.6e6) continue;
        if (box.w * k > availW || box.h * k > availH * 1.03) continue;
        if (k > best.k + 1e-6 || (Math.abs(k - best.k) < 1e-6 && pixel > best.pixel)) best = { unit, pixel, k };
      }
    options.artWidth = deviceW / best.pixel;
    options.units.splice(0, options.units.length, best.unit, best.unit + 1, best.unit + 2);
    fitRef.current = { ...best, top, bottom, right };
    stage.setInset({ left: 0, right, top, bottom });
    stage.renderNow();
    stage.lookAt(box.center, { jump: true, unit: best.unit });
  }, [phone, panel, focus, n, box]);

  const fitNow = useRef(fit);
  fitNow.current = fit;
  useEffect(() => {
    if (!ready) return undefined;
    fitNow.current();
    const ro = new ResizeObserver(() => fitNow.current());
    if (holder.current) ro.observe(holder.current);
    if (topBar.current) ro.observe(topBar.current);
    return () => ro.disconnect();
    // only refit for size; the panel and phone focus glide instead
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, phone]);

  // the shell's top bar: the world stands under it, as tall as the window less the bar
  useEffect(() => {
    const measure = () => {
      const bar = document.querySelector('.bk-top');
      const h = bar ? Math.round(bar.getBoundingClientRect().height) : 64;
      section.current?.style.setProperty('--qw-bar', `${h}px`);
    };
    measure();
    addEventListener('resize', measure);
    return () => removeEventListener('resize', measure);
  }, []);

  // —— night
  useEffect(() => { stageRef.current?.setNight(night ? 1 : 0); }, [night, ready]);

  // —— the tags: pinned beside each place and house
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;
    const offs = [];
    for (const [key, el] of tags.current) {
      if (!el) continue;
      const spec = key.startsWith('vendor:') ? housePoint(Number(key.slice(7)), n) : placePoint(key);
      offs.push(stage.anchor(el, spec.point, { alignX: spec.alignX, alignY: spec.alignY, dx: spec.dx ?? 0, dy: spec.dy ?? 0 }));
    }
    return () => offs.forEach((off) => off());
  }, [ready, n, phone]);

  // —— the replay: play a step from where the one before left the quarter
  const playStep = useCallback(async (i) => {
    const director = directorRef.current;
    const s = steps[i];
    if (!director || !s) return;
    setDone(false);
    setShown(i > 0 ? steps[i - 1].view ?? null : null);
    playing.current = true;
    const ok = await director.play(s, i > 0 ? steps[i - 1].state : EMPTY);
    if (!ok) return;
    playing.current = false;
    setShown(s.view ?? view);
    setDone(true);
    // what happened in the book since: play it now
    while (i === lastIndex && queue.current.length) {
      const next = queue.current.shift();
      playing.current = true;
      setActing(next);
      const fine = await director.play(next);
      playing.current = false;
      setActing(null);
      if (!fine) return;
      setShown(next.view ?? view);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps, lastIndex, phone, n]);

  useEffect(() => {
    if (!ready || !steps.length) return;
    playStep(index);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, index, run, steps.length]);

  // a step every ~6 s, until the visitor touches anything
  const startedAt = useRef(0);
  useEffect(() => { startedAt.current = performance.now(); }, [index, run]);
  useEffect(() => {
    if (!auto || !done || index >= lastIndex) return undefined;
    const spent = (performance.now() - startedAt.current) / 1000;
    const wait = Math.max(1.4, 6 - spent) * 1000;
    const t = setTimeout(() => setIndex((i) => Math.min(lastIndex, i + 1)), wait);
    return () => clearTimeout(t);
  }, [auto, done, index, lastIndex]);

  const touch = useCallback(() => {
    setAuto(false);
    setTouched(true);
  }, []);
  const next = useCallback(() => { touch(); setActing(null); setIndex((i) => Math.min(lastIndex, i + 1)); }, [touch, lastIndex]);
  const back = useCallback(() => { touch(); setActing(null); setIndex((i) => Math.max(0, i - 1)); }, [touch]);
  const replay = useCallback(() => { setAuto(true); setTouched(true); queue.current = []; setIndex(0); setRun((r) => r + 1); }, []);

  // —— what is written in the book from here on plays live
  useEffect(() => {
    const rec = recorded.current;
    const ws = service.workspace;
    if (!ws || !view || !rec || ws.events.length <= rec.shown) return;
    const s = liveStep(ws, view, rec.shown);
    rec.shown = ws.events.length;
    if (!s) { setShown(view); return; }
    queue.current.push(s);
    if (index !== lastIndex) { setAuto(false); setIndex(lastIndex); return; }
    if (done && !playing.current) {
      // the quarter is already live: act it out now
      const director = directorRef.current;
      const nextUp = queue.current.shift();
      playing.current = true;
      setActing(nextUp);
      director?.play(nextUp).then((ok) => { playing.current = false; setActing(null); if (ok) setShown(view); });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service.workspace, view]);

  // —— panels
  const openPanel = useCallback((next) => {
    touch();
    if (!next) return;
    opener.current = document.activeElement;
    setPanel(next);
  }, [touch]);
  const closePanel = useCallback(() => {
    setPanel(null);
    const back = opener.current;
    opener.current = null;
    if (back && typeof back.focus === 'function' && document.contains(back)) back.focus({ preventScroll: true });
  }, []);

  const pick = (id) => {
    if (!id) return;
    if (id.startsWith('vendor:')) { const v = vendors[Number(id.slice(7))]; if (v) openPanel({ kind: 'vendor', id: v.id, key: id }); return; }
    if (id.startsWith('courier:')) { const v = vendors[Number(id.slice(8))]; if (v) openPanel({ kind: 'vendor', id: v.id, key: `vendor:${id.slice(8)}` }); return; }
    if (id.startsWith('agent:')) { const who = id.slice(6); openPanel({ kind: 'station', id: who === 'courier' ? 'you' : WHERE[who] ?? 'post' }); return; }
    if (PLACES.includes(id)) openPanel({ kind: 'station', id });
  };
  const pickRef = useRef(pick);
  pickRef.current = pick;
  useEffect(() => { if (optionsRef.current) optionsRef.current.onPick = (id) => pickRef.current(id); }, [ready]);

  // the panel takes the right side (a sheet on a phone): the quarter makes room
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !ready) return;
    if (phone) {
      const h = holder.current?.getBoundingClientRect().height ?? 600;
      stage.setInset({ bottom: panel ? Math.round(h * 0.55) : 96 });
      if (panel) stage.lookAt(lookPoint(panel.key ?? panel.id, n));
      return;
    }
    const w = holder.current?.getBoundingClientRect().width ?? 1440;
    const right = panel ? panelWidth(w) + 32 : 0;
    stage.setInset({ right });
    stage.lookAt(box.center);
  }, [panel, ready, phone, n, box]);

  useEffect(() => {
    if (!panel) return;
    const el = panelRef.current?.querySelector('.qw-close');
    el?.focus({ preventScroll: true });
  }, [panel]);

  // keys: ← → walk the replay; Escape closes the panel
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && panel) { e.preventDefault(); closePanel(); return; }
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target;
      if (t && (t.closest?.('input, textarea, select, [contenteditable="true"]') || t.closest?.('.qw-panel'))) return;
      const r = section.current?.getBoundingClientRect();
      if (!r || r.bottom < 80 || r.top > innerHeight * 0.5) return;
      e.preventDefault();
      if (e.key === 'ArrowLeft') back(); else next();
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [panel, closePanel, back, next]);

  // —— approving the letter on your desk
  const onApprove = useCallback(async (commitmentId) => {
    touch();
    const ws = service.workspace;
    if (!ws) throw new Error('The book is still opening. Try again in a moment.');
    try {
      const commands = approveLetterCommands(ws, commitmentId, { now: momentFor(ws) });
      if (commands.length) await service.commands(commands);
    } catch (error) {
      throw new Error(plainFailure(error), { cause: error });
    }
  }, [service, touch]);

  // —— the phone's strip: one place at a time
  const strip = useRef(null);
  const onStrip = useCallback(() => {
    const el = strip.current;
    if (!el) return;
    const mid = el.scrollLeft + el.clientWidth / 2;
    let best = null, gap = Infinity;
    for (const card of el.children) {
      const d = Math.abs(card.offsetLeft + card.offsetWidth / 2 - mid);
      if (d < gap) { gap = d; best = card.dataset.place; }
    }
    if (best && best !== focus) {
      setFocus(best);
      follow.current = null;
      stageRef.current?.lookAt(lookPoint(best, n));
    }
  }, [focus, n]);

  // the latest line and the answer
  const latest = useMemo(() => (readView ? latestLine(readView, workspace) : ''), [readView, workspace]);
  const totals = view?.totals;
  const demo = service.authMode !== 'managed-password';
  const owed = totals?.outstandingCents ?? 0;
  const fresh = !touched && !panel;
  const turn = stationLine('you', readView)?.turn;

  const tagFor = (id) => {
    const line = stationLine(id, readView) ?? { text: '' };
    return (
      <button
        key={id}
        type="button"
        ref={(el) => { if (el) tags.current.set(id, el); else tags.current.delete(id); }}
        className={`qw-tag${line.owed ? ' is-owed' : ''}${line.turn ? ' is-turn' : ''}${panel?.kind === 'station' && panel.id === id ? ' is-open' : ''}`}
        onClick={() => openPanel({ kind: 'station', id })}
        onMouseEnter={() => stageRef.current?.setHover(id)}
        onMouseLeave={() => stageRef.current?.setHover(null)}
        onFocus={() => stageRef.current?.setHover(id)}
        onBlur={() => stageRef.current?.setHover(null)}
      >
        {line.turn && <span className="qw-call" aria-hidden="true" />}
        <span className="qw-tag-name">{NAMES[id]}</span>
        {line.text && <span className="qw-tag-line">{line.text}</span>}
      </button>
    );
  };

  return (
    <section
      ref={section}
      className={`qw${phone ? ' is-phone' : ''}${night ? ' is-night' : ''}${panel ? ' has-panel' : ''}`}
      aria-label="Truthful’s quarter: the agents carry every company’s papers from the post to the book, weigh each invoice on the scale, and leave a letter on your desk to sign."
      onPointerDownCapture={(e) => { if (!e.target.closest?.('.qw-tour, .qw-panel')) touch(); }}
    >
      <div className="qw-top" ref={topBar}>
        <header className="qw-answer">
          <p className="t-label">{demo ? 'the demo book' : 'your book'} · {view ? dateDay(view.asOf).toLowerCase() : ''}</p>
          <h1 className="qw-head">
            {!totals || totals.promisedCents === 0 ? <>Nothing promised<br /><span className="is-quiet">yet.</span></>
              : owed > 0 ? <><span className="is-owed">{money(owed)} still owed</span><br /><span className="is-quiet">of {money(totals.promisedCents)} promised.</span></>
                : <>Nothing owed.<br /><span className="is-quiet">All {money(totals.promisedCents)} came in.</span></>}
          </h1>
        </header>
        {story.empty
          ? <p className="qw-tour qw-tour-empty t-box">{story.line}</p>
          : <TourCard step={acting && step?.today ? { ...step, sentence: acting.sentence } : step} steps={steps} auto={auto} onBack={back} onNext={next} onReplay={replay} />}
      </div>

      <div className="qw-stage" ref={holder}>
        <canvas ref={canvas} className="qw-canvas" aria-hidden="true" />
        <div className="qw-layer" ref={layer}>
          {!phone && PLACES.map(tagFor)}
          {vendors.map((v, i) => {
            const line = vendorLine(v, readView);
            const key = `vendor:${i}`;
            return (
              <button
                key={key}
                type="button"
                ref={(el) => { if (el) tags.current.set(key, el); else tags.current.delete(key); }}
                className={`qw-tag is-house${line.owedCents > 0 ? ' is-owed' : ''}${panel?.kind === 'vendor' && panel.id === v.id ? ' is-open' : ''}`}
                style={{ '--tab': `#${C.tabs[i % C.tabs.length].toString(16).padStart(6, '0')}` }}
                onClick={() => openPanel({ kind: 'vendor', id: v.id, key })}
                onMouseEnter={() => stageRef.current?.setHover(key)}
                onMouseLeave={() => stageRef.current?.setHover(null)}
                onFocus={() => stageRef.current?.setHover(key)}
                onBlur={() => stageRef.current?.setHover(null)}
              >
                <span className="qw-tag-name">{v.name}</span>
                {line.text && <span className="qw-tag-line">{line.text}</span>}
              </button>
            );
          })}
        </div>

        {latest && !phone && <p className="qw-latest t-label">{latest}</p>}
        <div className="qw-tools">
          <button type="button" className="qw-btn" aria-label="Zoom out" title="Zoom out" onClick={() => { touch(); stageRef.current?.zoom(-1); }}>−</button>
          <button type="button" className="qw-btn" aria-label="Zoom in" title="Zoom in" onClick={() => { touch(); stageRef.current?.zoom(1); }}>+</button>
          <button type="button" className="qw-btn" aria-pressed={night} aria-label={night ? 'Day' : 'Night'} title={night ? 'Day' : 'Night'} onClick={() => { touch(); setNight((v) => !v); }}>{night ? '☀' : '☾'}</button>
        </div>
        {fresh && !phone && <p className="qw-hint t-label">click anything · drag to look around</p>}
        {turn && phone && <p className="qw-turn-note t-label">your turn: a letter to sign</p>}

        {phone && (
          <div className="qw-strip" ref={strip} onScroll={onStrip}>
            {PLACES.map((id) => {
              const line = stationLine(id, readView) ?? { text: '' };
              return (
                <button key={id} type="button" data-place={id} className={`qw-card${focus === id ? ' is-here' : ''}${line.owed ? ' is-owed' : ''}`}
                  onClick={(e) => {
                    touch();
                    if (focus === id) { openPanel({ kind: 'station', id }); return; }
                    e.currentTarget.scrollIntoView({ inline: 'center', block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
                    setFocus(id);
                    follow.current = null;
                    stageRef.current?.lookAt(lookPoint(id, n));
                  }}>
                  <span className="qw-tag-name">{NAMES[id]}</span>
                  <span className="qw-tag-line">{line.text || ' '}</span>
                </button>
              );
            })}
          </div>
        )}

        {panel && view && (
          <aside className="qw-panel" ref={panelRef} role="dialog" aria-label={panel.kind === 'vendor' ? (vendors.find((v) => v.id === panel.id)?.name ?? 'A company') : NAMES[panel.id]}>
            <button type="button" className="qw-close" aria-label="Close" onClick={closePanel}>×</button>
            {panel.kind === 'vendor'
              ? <VendorPanel vendorId={panel.id} view={view} service={service} go={go} onClose={closePanel} />
              : <StationPanel station={panel.id} view={view} service={service} go={go} onClose={closePanel} onApprove={onApprove} />}
          </aside>
        )}
      </div>
      <p className="sr-only" aria-live="polite">{heard}</p>
    </section>
  );
}
