// The demo player: plays SCENES (script.mjs) across the real book, hands off.
//
// Started by ?demo in the address (BookApp.jsx mounts it). It starts the demo book again,
// then each scene goes to a page, presses the real buttons and points at what matters,
// while the caption bar says the narrator's line.
//   Space pauses · → next scene · ← the scene before · Esc leaves the demo
//   ?demo&rec   recording: no key hints, a clean 1.2 s first frame
// For a recorder, <html data-demo-scene="i"> is set as each scene starts, and
// <html data-demo-done="1"> once the closing frame has held.

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './demo.css';
import { SCENES, TOTAL_SECONDS, secondsFor } from './script.mjs';
import { CoinStrip } from '../../ui/Coins.jsx';
import { quoteFor } from '../../front/selectors.mjs';
import { paperId } from '../../shell/route.mjs';

const STOP = Symbol('demo stopped');
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const words = (el) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
const shown = (el) => el && el.getClientRects().length > 0 && !el.closest('[hidden]');
const asked = () => new URLSearchParams(location.search);
const BEFORE = SCENES.map((_, i) => SCENES.slice(0, i).reduce((sum, s) => sum + secondsFor(s), 0));
const html = document.documentElement;

function unionOf(rects) {
  const list = rects.filter((r) => r && r.width + r.height > 0);
  if (!list.length) return null;
  const left = Math.min(...list.map((r) => r.left)), top = Math.min(...list.map((r) => r.top));
  const right = Math.max(...list.map((r) => r.right)), bottom = Math.max(...list.map((r) => r.bottom));
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

export default function DemoPlayer({ service, view, go }) {
  const rec = useRef(asked().has('rec') || asked().has('talk')).current;
  const talk = useRef(asked().has('talk')).current;   // presenter mode: you set the pace and do the voice
  const [intro, setIntro] = useState(talk);
  const introOn = useRef(talk);
  introOn.current = intro;
  // presenter mode: the page is the picture; no captions, no history card, you talk over it
  useEffect(() => { if (talk) html.dataset.demoTalk = '1'; return () => { delete html.dataset.demoTalk; }; }, [talk]);
  const live = useRef({});
  live.current = { service, view, go };

  const [phase, setPhase] = useState('prep');      // prep · play · end · gone
  const [index, setIndex] = useState(0);
  const [run, setRun] = useState(0);              // bumps to play the same scene again
  const [paused, setPaused] = useState(false);
  const [, setTick] = useState(0);
  const ctl = useRef({ token: 0, paused: false, elapsed: 0, phase: 'prep' });
  ctl.current.paused = paused;
  ctl.current.phase = phase;

  const bar = useRef(null);
  const ring = useRef(null);
  const mark = useRef(null);
  const aim = useRef(null);                       // { rect: () => rect, on: bool }

  // —— the clock: a scene's time only runs while it plays
  useEffect(() => {
    let last = performance.now();
    const t = setInterval(() => {
      const now = performance.now();
      if (ctl.current.phase === 'play' && !ctl.current.paused) ctl.current.elapsed += now - last;
      last = now;
      setTick((n) => (n + 1) % 1e6);
    }, 100);
    return () => clearInterval(t);
  }, []);

  // —— the pointer and the outline follow their target every frame (the page may scroll under them)
  useEffect(() => {
    let raf = 0, at = null;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const a = aim.current, r = a?.rect();
      const m = mark.current, g = ring.current;
      if (!m || !g) return;
      if (!r) { m.style.opacity = '0'; if (!a) g.style.opacity = '0'; return; }
      const pad = 7;
      m.style.transform = `translate(${r.left - pad}px, ${r.top - pad}px)`;
      m.style.width = `${r.width + pad * 2}px`;
      m.style.height = `${r.height + pad * 2}px`;
      m.style.opacity = a.fading ? '0' : '1';
      // the ring stands beside what it shows, never on it; on a button it goes in to press
      // (just off its top left corner, in the gap between rows; a press sits on a button's lower right corner, so its label still reads)
      let x, y;
      if (a.on) { x = r.right - 4; y = r.bottom - 3; }
      else if (r.left - 22 >= 24) { x = r.left - 22; y = r.top - 14; }
      else { x = r.left + 22; y = r.bottom + 30; }
      if (!at || Math.abs(at[0] - x) > 0.5 || Math.abs(at[1] - y) > 0.5) {
        at = [x, y];
        g.style.transform = `translate(${x - 14}px, ${y - 14}px)`;
      }
      g.style.opacity = '1';
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  // —— the hand the scenes use
  function hand(token) {
    const check = () => { if (ctl.current.token !== token) throw STOP; };
    const wait = async (ms) => {
      let left = ms, last = performance.now();
      while (left > 0) {
        await sleep(Math.min(40, left));
        check();
        const now = performance.now();
        if (!ctl.current.paused) left -= now - last;
        last = now;
      }
    };
    const roots = (front) => {
      const tree = document.querySelector('.book-front')?.shadowRoot;
      return front ? (tree ? [tree] : []) : [document];
    };
    const query = (selector, { front, text } = {}) => {
      const out = [];
      for (const root of roots(front)) {
        for (const el of root.querySelectorAll(selector)) if (shown(el) && (!text || words(el).includes(text))) out.push(el);
      }
      return out;
    };
    const until = async (test, timeout = 3000) => {
      const end = performance.now() + timeout;
      for (;;) {
        const got = test();
        if (got) return got;
        if (performance.now() > end) return null;
        await wait(70);
      }
    };
    const safe = () => {
      const top = (document.querySelector('.bk-top')?.getBoundingClientRect().bottom ?? 0) + 24;
      const bottom = (bar.current?.getBoundingClientRect().top ?? innerHeight) - 28;
      return { top, bottom };
    };
    async function bring(rect) {
      const { top, bottom } = safe();
      // the cover's quarter fills the window as it stands: it is never scrolled
      if (document.querySelector('.bk')?.dataset.page === 'home') return;
      if (!rect || (rect.top >= top && rect.bottom <= bottom)) return;
      const room = bottom - top;
      const want = rect.height > room ? rect.top - top : rect.top - (top + (room - rect.height) * 0.4);
      const max = document.documentElement.scrollHeight - innerHeight;
      const y = Math.max(0, Math.min(max, scrollY + want));
      if (Math.abs(y - scrollY) < 4) return;
      scrollTo({ top: y, behavior: 'smooth' });
      await wait(Math.min(900, 380 + Math.abs(y - scrollY) * 0.5));
    }
    const rectFor = (target) => {
      if (!target) return null;
      if (Array.isArray(target)) return unionOf(target.map((el) => el?.getBoundingClientRect?.()));
      if (typeof target.getBoundingClientRect === 'function') return target.isConnected ? target.getBoundingClientRect() : null;
      return { ...target, width: target.right - target.left, height: target.bottom - target.top };
    };
    async function aimAt(target, { on = false, scroll = true } = {}) {
      check();
      if (scroll) await bring(rectFor(target));
      check();
      const before = aim.current;
      if (before && !before.on) { before.fading = true; await wait(160); }
      aim.current = { rect: () => rectFor(target), on };
      await wait(440);
    }
    return {
      wait,
      until,
      findAll: async (selector, opts = {}) => (await until(() => { const all = query(selector, opts); return all.length ? all : null; }, opts.timeout ?? 4000)) ?? [],
      find: async (selector, opts = {}) => until(() => query(selector, opts)[0], opts.timeout ?? 4000),
      async go(page, id = '', q = null, opts) {
        check();
        live.current.go(page, id, q, opts);
        await until(() => document.querySelector('.bk')?.dataset.page === page, 3000);
        await wait(380);
      },
      async point(el, { box, scroll = true } = {}) {
        if (!el) return;
        await aimAt(box ? box(el) : el, { scroll });
      },
      async click(el) {
        if (!el) return;
        await aimAt(el, { on: true });
        ring.current?.classList.add('is-press');
        await wait(170);
        ring.current?.classList.remove('is-press');
        check();
        // the hand stays where it pressed, and the outline fades: what was pressed often moves or goes
        const pressed = rectFor(el);
        el.click();
        aim.current = { rect: () => pressed, on: true, fading: true };
        await wait(260);
      },
      /** Rest the hand on something that lights up under a mouse or a keyboard (a figure and its words). */
      async hover(el, opts) {
        if (!el) return;
        await aimAt(el, opts);
        el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, composed: true, relatedTarget: document.body }));
        el.focus?.({ preventScroll: true });
      },
      async type(el, text) {
        if (!el) return;
        await aimAt(el, { on: true });
        el.focus({ preventScroll: true });
        const set = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set;
        for (let i = 1; i <= text.length; i += 1) {
          set.call(el, text.slice(0, i));
          el.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
          await wait(32);
        }
      },
      async scrollTo(y) {
        check();
        if (Math.abs(scrollY - y) < 4) return;
        scrollTo({ top: y, behavior: 'smooth' });
        await wait(Math.min(900, 380 + Math.abs(scrollY - y) * 0.5));
      },
      /** Walk the cover's replay to step n (counting from 1), by its own arrows. */
      async tour(n) {
        for (let k = 0; k < 40; k += 1) {
          const m = /(\d+) of (\d+)/.exec(document.querySelector('.qw-tour-count')?.textContent ?? '');
          if (!m) { await wait(100); continue; }
          const now = Number(m[1]);
          if (now === Math.min(n, Number(m[2]))) return;
          const btn = now < n ? document.querySelector('.qw-tour .qw-btn.is-ink') : document.querySelector('.qw-tour .qw-btn[aria-label="Back a step"]');
          if (!btn || btn.disabled) return;
          btn.click();
          await wait(70);
        }
      },
      lastTourStep() {
        const m = /(\d+) of (\d+)/.exec(document.querySelector('.qw-tour-count')?.textContent ?? '');
        return m ? Number(m[2]) : 99;
      },
      /** The object on the quarter above a bottom-row tag (the scale, your desk), sized by the quarter's own spacing. */
      above(name) {
        const tag = query('.qw-tag', { text: name })[0];
        const a = query('.qw-tag', { text: 'the reading desk' })[0], b = query('.qw-tag', { text: 'the letter desk' })[0];
        if (!tag || !a || !b) return tag ?? null;
        const span = b.getBoundingClientRect().top - a.getBoundingClientRect().top;
        const r = tag.getBoundingClientRect();
        const cx = (r.left + r.right) / 2, cy = r.top - span * 0.27;
        return { left: cx - span * 0.24, right: cx + span * 0.24, top: cy - span * 0.17, bottom: cy + span * 0.15 };
      },
      /** The address of the paper a promise was read from. */
      paperOf(commitmentId) {
        const v = live.current.view;
        const c = v?.commitments.find((item) => item.id === commitmentId);
        const quote = c && quoteFor(v, c);
        return quote?.sourceId ? paperId(quote.sourceId, quote.revision) : '';
      },
    };
  }

  // —— start the demo book again, so every take is the same
  useEffect(() => {
    if (phase !== 'prep') return undefined;
    const token = ++ctl.current.token;
    const d = hand(token);
    (async () => {
      try {
        await d.until(() => { const s = live.current.service; return s.workspace && !s.busy && s.authMode !== 'detecting'; }, 15000);
        const s = live.current.service;
        if (s.authMode === 'local-demo' || s.authMode === 'browser-local') {
          if (s.actor.role !== 'admin') {
            await s.changeRole('admin');
            await d.until(() => live.current.service.actor.role === 'admin' && !live.current.service.busy, 3000);
          }
          await live.current.service.resetDemo();
          await d.until(() => !live.current.service.busy, 3000);
        }
        live.current.go('home');
        scrollTo({ top: 0 });
        await d.wait(1200);
        while (introOn.current) await d.wait(120);
        await d.wait(400);
        setIndex(0);
        setRun((r) => r + 1);
        setPhase('play');
      } catch (error) {
        if (error !== STOP) throw error;
      }
    })();
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // —— play one scene, hold it for its length, then the next
  useEffect(() => {
    if (phase !== 'play') return;
    const token = ++ctl.current.token;
    const scene = SCENES[index];
    const d = hand(token);
    ctl.current.elapsed = 0;
    html.dataset.demoScene = String(index);
    delete html.dataset.demoDone;
    (async () => {
      try {
        try { await scene.run(d); } catch (error) { if (error === STOP) throw error; /* a scene that trips goes on with the film */ }
        if (talk) { for (;;) await d.wait(250); }   // held until → moves on
        const need = secondsFor(scene) * 1000;
        while (ctl.current.elapsed < need) await d.wait(40);
        if (index < SCENES.length - 1) { setIndex(index + 1); return; }
        await d.wait(4000);
        html.dataset.demoDone = '1';
        aim.current = null;
        setPhase('end');
      } catch (error) {
        if (error !== STOP) throw error;
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, index, run]);

  // —— keys: Space, ←, →, Esc. Taken before the page sees them (the quarter and the bench use the arrows too).
  useEffect(() => {
    if (phase === 'gone') return undefined;
    const to = (i) => {
      const next = Math.max(0, Math.min(SCENES.length - 1, i));
      setPaused(false);
      setIndex(next);
      setRun((r) => r + 1);
      setPhase('play');
    };
    const onKey = (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key;
      if (![' ', 'ArrowRight', 'ArrowLeft', 'Escape', 'Enter'].includes(key)) return;
      if (key === 'Enter' && !introOn.current) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.type !== 'keydown' || event.repeat) return;
      if (introOn.current) { if (key !== 'ArrowLeft' && key !== 'Escape') setIntro(false); return; }
      if (key === ' ') { if (ctl.current.phase === 'play') setPaused((p) => !p); return; }
      if (key === 'Escape') { leave(); return; }
      if (ctl.current.phase === 'prep') return;
      const now = ctl.current.phase === 'end' ? SCENES.length : index;
      to(key === 'ArrowRight' ? now + 1 : now - 1);
    };
    addEventListener('keydown', onKey, true);
    addEventListener('keyup', onKey, true);
    return () => { removeEventListener('keydown', onKey, true); removeEventListener('keyup', onKey, true); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, index]);

  function leave() {
    ctl.current.token += 1;
    aim.current = null;
    delete html.dataset.demoScene;
    delete html.dataset.demoDone;
    const q = asked();
    q.delete('demo');
    q.delete('rec');
    const search = q.toString();
    history.replaceState(history.state, '', location.pathname + (search ? `?${search}` : '') + location.hash);
    setPhase('gone');
  }

  useEffect(() => () => { delete html.dataset.demoScene; delete html.dataset.demoDone; }, []);

  if (phase === 'gone') return null;
  const scene = SCENES[index];
  const ended = phase === 'end';
  const spent = phase === 'prep' ? 0 : ended ? TOTAL_SECONDS * 1000 : BEFORE[index] * 1000 + Math.min(ctl.current.elapsed, secondsFor(scene) * 1000);
  const n = SCENES.length;
  const count = phase === 'prep' ? `00 / ${n}` : `${String(index + 1).padStart(2, '0')} / ${n}`;
  const said = phase === 'prep' ? 'Starting the demo book from its first page.' : scene.narration;

  return createPortal(
    <div className={`dm${rec ? ' is-rec' : ''}${talk ? ' is-talk' : ''}${paused ? ' is-paused' : ''}`} data-phase={phase}>
      {intro && (
        <section className="dm-intro" aria-label="Background" onClick={() => setIntro(false)}>
          <p className="t-label">bbs × ramp · team ovo · truthful</p>
          <h1 className="dm-intro-h">Vendors promise credits.<br /><span>Invoices forget them.</span></h1>
          <div className="dm-intro-coins"><CoinStrip states={Array.from({ length: 24 }, (_, i) => (i < 9 ? 'in' : 'owed'))} u={5} perRow={12} label="$2,400 promised, $900 came in" /><span className="t-label">$2,400 promised · $900 came in · $1,500 never showed up</span></div>
          <ol className="dm-intro-steps">
            <li><b>01</b><span>A vendor promises a credit in an email.</span></li>
            <li><b>02</b><span>Someone copies it into a spreadsheet and checks every invoice against it by hand.</span></li>
            <li><b>03</b><span>When the money never shows up, someone has to notice, find the email, and write to ask for it.</span></li>
          </ol>
          <p className="dm-intro-then">Truthful does all of it: it reads the papers, keeps every promise, weighs every invoice against it, and drafts the letter. You approve.</p>
        </section>
      )}
      <div className="dm-mark" ref={mark} aria-hidden="true" />
      <div className="dm-ring" ref={ring} aria-hidden="true"><i /></div>
      <section className="dm-bar" ref={bar} aria-label="The demo" aria-live="polite">
        <div className="dm-head">
          <span className="dm-count">
            {count}<span className="dm-title"> · {phase === 'prep' ? 'starting' : ended ? 'the end' : scene.title}</span>
            {paused && <b className="dm-paused"> · paused</b>}
          </span>
          <span className="dm-note">
            replaying the demo book · nothing is sent
            {!rec && <span className="dm-keys"> · space pause · ← → scene · esc leave</span>}
          </span>
        </div>
        <p className="dm-say" key={`${phase}:${index}`}>{said}</p>
        <div className="dm-line" aria-hidden="true">
          <span className="dm-fill" style={{ transform: `scaleX(${Math.min(1, spent / (TOTAL_SECONDS * 1000))})` }} />
          {BEFORE.slice(1).map((s, i) => <i key={i} style={{ left: `${(s / TOTAL_SECONDS) * 100}%` }} />)}
        </div>
      </section>
    </div>,
    document.body,
  );
}
