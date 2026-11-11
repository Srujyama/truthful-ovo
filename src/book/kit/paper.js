// craft/kit/paper.js — what paper does when a hand touches it.
//
// paper.css draws the sheets. This file moves them and makes their noises:
//
//   sound            foley from one buffer of noise: thud, tick, tap, rustle, rip, unfold
//   stamp(el)        bring a rubber stamp down on its sheet: a drop, one bounce, a thud
//   makeStamp(text)  a .stamp element, tilted and worn a little differently each time
//   tally(el, opts)  a strip of boxes that get punched out in order, each with a tick
//   settle(el, from) slide a sheet in from somewhere and let it land
//   pickup(root)     pick any sheet up and move it: it swings from where it is held,
//                    slides a little when let go, and stays where it stops
//   tornEdge(opts)   an uneven clip-path for an edge torn by hand
//   paperClip()      an SVG of a wire clip, drawn the way one sits on a sheet
//   tagString(opts)  an SVG of twine from a tag's eyelet to wherever it is tied
//   reducedMotion()  true when the visitor asked for less motion
//
// Nothing here needs a build step or a library. Every function is safe to call
// in a browser that has no AudioContext, no Web Animations, or reduced motion on:
// the sheet still ends up in the right place, it just gets there at once.
//
// Techniques learned from Aiden Guan's portfolio-2 (MIT): the plate pinned at
// the hand and the exponential slide (components/mat/table.tsx:622, :652), the
// stamp's drop and the sheet's flinch (app/mat.css:3245), and making every
// sound from grains of one noise buffer (lib/riffle.ts:66). The code is this
// kit's own.

const hasWindow = typeof window !== "undefined";

/** True when the visitor asked for less motion. Checked live, not cached. */
export function reducedMotion() {
  return hasWindow && typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// A small seeded generator, so a torn edge or a stamp's tilt is the same on
// every visit for the same seed, and different for a different one.
function seeded(seed) {
  let s = (typeof seed === "number" ? seed : hashText(String(seed))) >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}
function hashText(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

// ————————————————————————————————————————————————————————— sound

// Every impact is a low thud plus a high tick; weight is the thud's pitch.
// Moving sounds are short grains whose pitch and level follow the hand.
function makeSound() {
  let ctx = null;
  let noise = null;
  let out = null;
  let enabled = true;
  let lastRustle = 0;

  function ready() {
    if (!enabled || !hasWindow) return false;
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return false;
    if (!ctx) {
      try { ctx = new Audio(); } catch { return false; }
      const length = Math.floor(ctx.sampleRate * 0.08);
      noise = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
      out = ctx.createGain();
      out.gain.value = 0.55;
      out.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return ctx.state !== "closed";
  }

  // One grain: a slice of the noise through one filter, with a fast attack
  // and an exponential tail.
  function grain({ type = "lowpass", freq = 500, q = 0.7, length = 0.06, gain = 0.1, rate = 1, after = 0 }) {
    if (!ready()) return;
    const t = ctx.currentTime + after;
    const source = ctx.createBufferSource();
    source.buffer = noise;
    source.loop = length > 0.07;
    source.playbackRate.value = rate;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const level = ctx.createGain();
    level.gain.setValueAtTime(0.0001, t);
    level.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + Math.min(0.005, length / 4));
    level.gain.exponentialRampToValueAtTime(0.0001, t + length);
    source.connect(filter).connect(level).connect(out);
    source.start(t, Math.random() * 0.02);
    source.stop(t + length + 0.02);
  }

  return {
    get enabled() { return enabled; },
    /** Turn every sound on or off. */
    setEnabled(on) { enabled = Boolean(on); if (!enabled && ctx && ctx.state === "running") ctx.suspend().catch(() => {}); },
    /** Call from the first click or key press: browsers stay silent until then. */
    unlock() { ready(); },
    /** A rubber stamp coming down: heavy, short, with a faint kiss of ink. */
    thud(k = 1) {
      grain({ type: "lowpass", freq: 230, q: 0.9, length: 0.09, gain: 0.26 * k });
      grain({ type: "bandpass", freq: 1350, q: 1.1, length: 0.04, gain: 0.05 * k });
      grain({ type: "bandpass", freq: 3300, q: 2, length: 0.018, gain: 0.02 * k, after: 0.006 });
    },
    /** A hole punch going through one box. */
    tick(k = 1) {
      grain({ type: "lowpass", freq: 980 + Math.random() * 140, q: 1, length: 0.045, gain: 0.15 * k });
      grain({ type: "bandpass", freq: 5000 + Math.random() * 500, q: 3, length: 0.018, gain: 0.05 * k, after: 0.011 });
    },
    /** A sheet landing on the desk. k is 0…1: how hard. */
    tap(k = 0.5) {
      grain({ type: "lowpass", freq: 430 + Math.random() * 110, q: 0.6, length: 0.07, gain: 0.07 + 0.13 * k });
      grain({ type: "bandpass", freq: 2700, q: 1.2, length: 0.028, gain: 0.018 + 0.03 * k });
    },
    /** Paper sliding. Call it as often as you like while it moves; speed is px per second. */
    rustle(speed = 600) {
      if (speed < 70 || reducedMotion()) return;
      const now = hasWindow ? performance.now() : 0;
      const k = clamp(speed / 2400, 0, 1);
      if (now - lastRustle < Math.max(32, 92 - speed / 40)) return;
      lastRustle = now;
      grain({ type: "bandpass", freq: 1500 + 2500 * k + Math.random() * 600, q: 0.7, length: 0.05 + Math.random() * 0.03, gain: 0.012 + 0.05 * k, rate: 0.8 + Math.random() * 0.4 });
    },
    /** One long slide: a sheet drawn out from under another. */
    slide(length = 0.32) {
      if (reducedMotion()) return;
      const steps = Math.max(3, Math.round(length / 0.045));
      for (let i = 0; i < steps; i += 1) {
        const k = Math.sin((i / (steps - 1)) * Math.PI);
        grain({ type: "bandpass", freq: 1700 + 1500 * k + Math.random() * 500, q: 0.7, length: 0.07, gain: 0.014 + 0.03 * k, rate: 0.85 + Math.random() * 0.3, after: i * 0.045 });
      }
    },
    /** Something torn off: a string of bright cracks. */
    rip() {
      for (let i = 0; i < 9; i += 1) {
        grain({ type: "bandpass", freq: 2400 + Math.random() * 2400, q: 2, length: 0.03, gain: 0.05 + Math.random() * 0.04, after: i * 0.018 + Math.random() * 0.01 });
      }
    },
    /** A folded sheet opening. */
    unfold() {
      if (reducedMotion()) return;
      grain({ type: "bandpass", freq: 1850, q: 0.5, length: 0.16, gain: 0.04, rate: 0.7 });
      grain({ type: "lowpass", freq: 470, q: 0.6, length: 0.06, gain: 0.1, after: 0.2 });
    },
    /** A slip going onto a spike. */
    pierce() {
      grain({ type: "bandpass", freq: 3900, q: 2.4, length: 0.022, gain: 0.06 });
      grain({ type: "lowpass", freq: 620, q: 0.8, length: 0.055, gain: 0.12, after: 0.012 });
    },
  };
}

/** The desk's sounds. One shared instance: sound.setEnabled(false) silences everything. */
export const sound = makeSound();

// ————————————————————————————————————————————————————————— stamps

/**
 * A rubber stamp mark, ready to be put on a sheet.
 * @param {string} text            the word, e.g. "PAID"
 * @param {object} [options]
 *   sub      a second, smaller line (a date, a time)
 *   tilt     degrees; left out, it is picked from the seed, between 4 and 9 either way
 *   seed     anything; the same seed gives the same tilt and wear every time
 *   small    a smaller stamp, for a tag or a margin
 *   className  extra classes
 * @returns {HTMLSpanElement}
 */
export function makeStamp(text, { sub, tilt, seed = text, small = false, className = "" } = {}) {
  const rand = seeded(seed);
  const el = document.createElement("span");
  el.className = `stamp${small ? " is-small" : ""}${className ? ` ${className}` : ""}`;
  el.textContent = text;
  if (sub) {
    const line = document.createElement("small");
    line.textContent = sub;
    el.append(line);
  }
  const sign = rand() < 0.5 ? -1 : 1;
  const angle = tilt ?? sign * (4 + rand() * 5);
  el.style.setProperty("--tilt", `${angle.toFixed(1)}deg`);
  // each stamp tiles the wear at its own size and offset, so no two wear alike
  el.style.setProperty("--wear-size", `${Math.round(120 + rand() * 90)}px`);
  el.style.setProperty("--wear-at", `${Math.round(rand() * 200)}px ${Math.round(rand() * 200)}px`);
  return el;
}

/**
 * Bring a stamp down on the sheet it sits in. With reduced motion it is
 * simply there. Resolves when the mark has landed.
 * @param {HTMLElement} el   a .stamp inside a .paper
 * @param {object} [options] quiet: true for no sound; delay in ms
 */
export function stamp(el, { quiet = false, delay = 0 } = {}) {
  return new Promise((resolve) => {
    const land = () => {
      el.hidden = false;
      if (reducedMotion()) { resolve(); return; }
      const sheet = el.closest(".paper");
      el.classList.remove("is-landing");
      void el.offsetWidth;
      el.classList.add("is-landing");
      // the mark meets the paper a little under half way through the drop
      setTimeout(() => {
        if (!quiet) sound.thud();
        if (sheet) {
          sheet.classList.remove("is-struck");
          void sheet.offsetWidth;
          sheet.classList.add("is-struck");
        }
      }, 120);
      setTimeout(() => {
        el.classList.remove("is-landing");
        if (sheet) sheet.classList.remove("is-struck");
        resolve();
      }, 380);
    };
    if (delay > 0) setTimeout(land, delay); else land();
  });
}

// ————————————————————————————————————————————————————————— tally strip

/**
 * Build a strip of boxes inside `el` (give it class "tally" and put it where
 * the slip's foot is). One box per unit; punched boxes are real holes.
 *
 * @param {HTMLElement} el
 * @param {object} options
 *   boxes     how many units in all (may be fractional: 3.5 draws a half box last)
 *   punched   how many are already punched
 *   mark(i)   text to print above the right edge of box i (1-based), or nothing
 *   seed      keeps each hole's small wander the same between visits
 * @returns {{ el, count, punched, set(n), punchTo(n, opts): Promise<void> }}
 *   set(n)        show n boxes punched, at once
 *   punchTo(n)    punch up to n, one after another. opts: { gap: ms between boxes,
 *                 onPunch(i) }. Plays a tick for each. With reduced motion they
 *                 all go at once and one tick plays.
 */
export function tally(el, { boxes, punched = 0, mark, seed = "tally" } = {}) {
  const rand = seeded(seed);
  const whole = Math.floor(boxes + 1e-9);
  const rest = boxes - whole;
  const count = whole + (rest > 0.02 ? 1 : 0);
  el.classList.add("tally");
  el.replaceChildren();
  const cells = [];
  const scale = document.createElement("div");
  scale.className = "tally-scale";
  const row = document.createElement("div");
  row.className = "tally-row";
  let marked = false;
  for (let i = 0; i < count; i += 1) {
    const cell = document.createElement("span");
    cell.className = "tally-box";
    const part = i === whole ? Math.max(0.4, rest) : 1;
    cell.style.setProperty("--i", String(i));
    if (part !== 1) cell.style.setProperty("--part", part.toFixed(2));
    // a hand never punches dead centre
    cell.style.setProperty("--jx", `${((rand() - 0.5) * 1.6).toFixed(2)}px`);
    cell.style.setProperty("--jy", `${((rand() - 0.5) * 1.8).toFixed(2)}px`);
    cell.append(document.createElement("i"));
    row.append(cell);
    cells.push(cell);
    const label = mark?.(i + 1);
    const m = document.createElement("b");
    if (part !== 1) m.style.setProperty("--part", part.toFixed(2));
    if (label) { m.textContent = label; marked = true; }
    scale.append(m);
  }
  if (marked) el.append(scale);
  const shade = document.createElement("span");
  shade.className = "tally-shade";
  row.append(shade);
  el.append(row);
  let done = 0;
  const api = {
    el,
    count,
    cells,
    get punched() { return done; },
    set(n) {
      done = clamp(Math.round(n), 0, count);
      cells.forEach((cell, i) => cell.classList.toggle("is-punched", i < done));
    },
    punchTo(n, { gap = 78, onPunch } = {}) {
      const goal = clamp(Math.round(n), 0, count);
      if (goal <= done) { api.set(goal); return Promise.resolve(); }
      if (reducedMotion()) {
        api.set(goal);
        sound.tick();
        onPunch?.(goal);
        return Promise.resolve();
      }
      return new Promise((resolve) => {
        const step = () => {
          const cell = cells[done];
          cell.classList.add("is-punched");
          const chad = document.createElement("span");
          chad.className = "tally-chad";
          chad.style.left = `${cell.offsetLeft + cell.offsetWidth / 2}px`;
          row.append(chad);
          setTimeout(() => chad.remove(), 460);
          sound.tick(0.8 + Math.random() * 0.3);
          done += 1;
          onPunch?.(done);
          if (done < goal) setTimeout(step, gap + Math.random() * 26);
          else resolve();
        };
        step();
      });
    },
  };
  api.set(punched);
  return api;
}

// ————————————————————————————————————————————————————————— arriving

/**
 * Slide a sheet in from somewhere and let it land where CSS put it.
 * @param {HTMLElement} el      a .paper
 * @param {object} from         where it starts, relative to where it ends:
 *                              { x, y } in px, rotate in degrees (absolute), opacity
 * @param {object} [options]    duration ms (560), delay ms, lift 0…1 (how high it
 *                              rides on the way), quiet: no landing sound
 * @returns {Promise<void>}     resolves when it has landed
 */
export function settle(el, from = {}, { duration = 560, delay = 0, lift = 0.6, quiet = false, easing = "cubic-bezier(0.22, 0.8, 0.24, 1)" } = {}) {
  if (reducedMotion() || typeof el.animate !== "function") return Promise.resolve();
  const style = getComputedStyle(el);
  const endTranslate = style.translate && style.translate !== "none" ? style.translate : "0px 0px";
  const endRotate = style.rotate && style.rotate !== "none" ? style.rotate : "0deg";
  const [ex = "0px", ey = "0px"] = endTranslate.split(" ");
  const start = {
    translate: `calc(${ex} + ${from.x ?? 0}px) calc(${ey} + ${from.y ?? 0}px)`,
    rotate: from.rotate === undefined ? endRotate : `${from.rotate}deg`,
    "--lift": lift,
    ...(from.opacity === undefined ? {} : { opacity: from.opacity }),
  };
  const frames = [
    { ...start, offset: 0 },
    { "--lift": lift * 0.85, ...(from.opacity === undefined ? {} : { opacity: 1 }), offset: 0.62 },
    { translate: endTranslate, rotate: endRotate, "--lift": 0, offset: 1 },
  ];
  let animation;
  try {
    animation = el.animate(frames, { duration, delay, easing, fill: "backwards" });
  } catch {
    return Promise.resolve();
  }
  if (!quiet) setTimeout(() => sound.tap(0.35), delay + duration * 0.86);
  return animation.finished.then(() => {}, () => {});
}

/**
 * Send a sheet away to somewhere and resolve when it is there. The sheet is
 * left at its destination (fill forwards): remove or hide it afterwards.
 * @param {HTMLElement} el
 * @param {object} to   { x, y } px from where it is, rotate in degrees (absolute), opacity
 */
export function depart(el, to = {}, { duration = 460, delay = 0, lift = 0.5, easing = "cubic-bezier(0.5, 0, 0.75, 0.4)" } = {}) {
  if (reducedMotion() || typeof el.animate !== "function") return Promise.resolve();
  const style = getComputedStyle(el);
  const startTranslate = style.translate && style.translate !== "none" ? style.translate : "0px 0px";
  const startRotate = style.rotate && style.rotate !== "none" ? style.rotate : "0deg";
  const [sx = "0px", sy = "0px"] = startTranslate.split(" ");
  let animation;
  try {
    animation = el.animate([
      { translate: startTranslate, rotate: startRotate, "--lift": 0, offset: 0 },
      { "--lift": lift, offset: 0.3 },
      {
        translate: `calc(${sx} + ${to.x ?? 0}px) calc(${sy} + ${to.y ?? 0}px)`,
        rotate: to.rotate === undefined ? startRotate : `${to.rotate}deg`,
        "--lift": lift * 0.4,
        ...(to.opacity === undefined ? {} : { opacity: to.opacity }),
        offset: 1,
      },
    ], { duration, delay, easing, fill: "forwards" });
  } catch {
    return Promise.resolve();
  }
  return animation.finished.then(() => {}, () => {});
}

// ————————————————————————————————————————————————————————— picking up

/**
 * Let a visitor pick up the sheets inside `root` and move them.
 *
 * A sheet is a plate pinned where the hand holds it: the desk drags at its
 * middle, so held by a corner it swings round to trail behind the hand, and
 * held by the middle it does not turn. Let go and it slides a short way,
 * turning a little, and stays where it stops. The page works without any of
 * this; it is here because paper that cannot be moved is a picture of paper.
 *
 * Mark each sheet with data-pick. Buttons, links, fields and anything inside
 * [data-nopick] never start a drag. A mouse drags after 4 px; a finger must
 * rest 340 ms first, so a swipe still scrolls the page.
 *
 * @param {HTMLElement} root
 * @param {object} [options]
 *   selector   which elements are sheets (default "[data-pick]")
 *   keepIn     an element the sheet's middle may not leave (default: root)
 *   onPick(el), onDrop(el)
 * @returns {{ release(): void, reset(el?): void }}
 *   reset() puts one sheet, or all of them, back where CSS has them.
 */
export function pickup(root, { selector = "[data-pick]", keepIn, onPick, onDrop } = {}) {
  const DRAG = 9;            // how hard the desk pulls at a moving sheet's middle
  const SWING_DAMP = 3.4;    // 1/s
  const FRICTION = 5.4;      // 1/s: a flick travels about v / FRICTION px
  const SPIN_FRICTION = 6.8;
  const bodies = new Map();
  const NEVER = "button, a, input, textarea, select, label, [contenteditable], [data-nopick]";
  let held = null;           // { body, lx, ly, px, py, vx, vy, lastX, lastY, lastT }
  let pending = null;        // a press that is not a drag yet
  let frame = 0;
  let last = 0;
  let swallowClick = false;

  const bodyOf = (el) => {
    let body = bodies.get(el);
    if (!body) {
      body = { el, x: 0, y: 0, a: 0, vx: 0, vy: 0, va: 0, lift: 0, sliding: false };
      bodies.set(el, body);
    }
    return body;
  };
  const baseTurn = (el) => {
    const value = getComputedStyle(el).getPropertyValue("--rot").trim();
    const n = parseFloat(value);
    return Number.isFinite(n) ? (n * Math.PI) / 180 : 0;
  };
  const write = (body) => {
    const s = body.el.style;
    s.setProperty("--px", `${body.x.toFixed(1)}px`);
    s.setProperty("--py", `${body.y.toFixed(1)}px`);
    s.setProperty("--pa", `${((body.a * 180) / Math.PI).toFixed(2)}deg`);
    s.setProperty("--lift", body.lift.toFixed(3));
  };
  const centreOf = (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2 + window.scrollX, y: r.top + r.height / 2 + window.scrollY };
  };

  function take(body, pageX, pageY) {
    const c = centreOf(body.el);
    const turn = baseTurn(body.el) + body.a;
    const dx = pageX - c.x, dy = pageY - c.y;
    // the held point, in the sheet's own frame
    const lx = dx * Math.cos(-turn) - dy * Math.sin(-turn);
    const ly = dx * Math.sin(-turn) + dy * Math.cos(-turn);
    body.home = { x: c.x - body.x, y: c.y - body.y };
    body.w = body.el.offsetWidth;
    body.h = body.el.offsetHeight;
    body.vx = 0; body.vy = 0; body.va = 0; body.sliding = false;
    held = { body, lx, ly, px: pageX, py: pageY, vx: 0, vy: 0 };
    body.el.classList.add("is-held");
    body.el.classList.remove("is-sliding");
    onPick?.(body.el);
    wake();
  }

  function letGo() {
    if (!held) return;
    const { body } = held;
    const speed = Math.hypot(held.vx, held.vy);
    body.el.classList.remove("is-held");
    if (reducedMotion() || speed < 40) {
      body.vx = 0; body.vy = 0; body.va *= 0.4;
      sound.tap(0.3);
    } else {
      const cap = Math.min(1, 2400 / speed);
      body.vx = held.vx * cap; body.vy = held.vy * cap;
    }
    body.sliding = true;
    body.el.classList.add("is-sliding");
    held = null;
    onDrop?.(body.el);
    wake();
  }

  function step(now) {
    frame = 0;
    const dt = clamp((now - last) / 1000, 1 / 240, 1 / 30);
    last = now;
    let busy = false;
    const still = reducedMotion();

    if (held) {
      busy = true;
      const { body } = held;
      const turn = baseTurn(body.el) + body.a;
      const rx = held.lx * Math.cos(turn) - held.ly * Math.sin(turn);
      const ry = held.lx * Math.sin(turn) + held.ly * Math.cos(turn);
      if (!still) {
        // velocity of the sheet's middle, the desk's drag on it, the turn that makes
        const mx = held.vx + body.va * ry;
        const my = held.vy - body.va * rx;
        const fx = -DRAG * mx, fy = -DRAG * my;
        const torque = -rx * fy + ry * fx;
        const inertia = (body.w * body.w + body.h * body.h) / 12 + rx * rx + ry * ry;
        body.va += (torque / inertia) * dt;
        body.va *= Math.exp(-SWING_DAMP * dt);
        body.va = clamp(body.va, -8, 8);
        body.a += body.va * dt;
      }
      const t2 = baseTurn(body.el) + body.a;
      const cx = held.px - (held.lx * Math.cos(t2) - held.ly * Math.sin(t2));
      const cy = held.py - (held.lx * Math.sin(t2) + held.ly * Math.cos(t2));
      body.x = cx - body.home.x;
      body.y = cy - body.home.y;
      body.lift += (1 - body.lift) * Math.min(1, dt * 14);
      sound.rustle(Math.hypot(held.vx, held.vy) * 0.8);
      // a hand that has stopped is not still moving the sheet
      held.vx *= Math.exp(-10 * dt);
      held.vy *= Math.exp(-10 * dt);
      write(body);
    }

    for (const body of bodies.values()) {
      if (!body.sliding) continue;
      busy = true;
      const k = Math.exp(-FRICTION * dt);
      body.vx *= k; body.vy *= k;
      body.va *= Math.exp(-SPIN_FRICTION * dt);
      body.x += body.vx * dt;
      body.y += body.vy * dt;
      body.a += body.va * dt;
      body.lift += (0 - body.lift) * Math.min(1, dt * 11);
      // keep the middle of the sheet on the desk
      const fence = (keepIn ?? root).getBoundingClientRect();
      if (body.home) {
        const cx = body.home.x + body.x - window.scrollX;
        const cy = body.home.y + body.y - window.scrollY;
        const pad = 24;
        if (cx < fence.left + pad) { body.x += fence.left + pad - cx; body.vx = Math.abs(body.vx) * 0.3; }
        if (cx > fence.right - pad) { body.x -= cx - (fence.right - pad); body.vx = -Math.abs(body.vx) * 0.3; }
        if (cy < fence.top + pad) { body.y += fence.top + pad - cy; body.vy = Math.abs(body.vy) * 0.3; }
        if (cy > fence.bottom - pad) { body.y -= cy - (fence.bottom - pad); body.vy = -Math.abs(body.vy) * 0.3; }
      }
      const speed = Math.hypot(body.vx, body.vy);
      sound.rustle(speed * 0.7);
      if (speed < 6 && Math.abs(body.va) < 0.03 && body.lift < 0.01) {
        body.vx = 0; body.vy = 0; body.va = 0; body.lift = 0; body.sliding = false;
        body.el.classList.remove("is-sliding");
      }
      write(body);
    }

    if (busy) frame = requestAnimationFrame(step);
  }
  function wake() {
    if (frame) return;
    last = performance.now();
    frame = requestAnimationFrame(step);
  }

  function onDown(event) {
    if (event.button !== undefined && event.button !== 0) return;
    const el = event.target.closest?.(selector);
    if (!el || !root.contains(el) || event.target.closest(NEVER)) return;
    const body = bodyOf(el);
    pending = { body, x: event.pageX, y: event.pageY, id: event.pointerId, touch: event.pointerType === "touch", timer: 0 };
    if (pending.touch) {
      const mine = pending;
      mine.timer = setTimeout(() => {
        if (pending !== mine) return;
        pending = null;
        try { navigator.vibrate?.(6); } catch { /* not allowed here */ }
        take(body, mine.x, mine.y);
        swallowClick = true;
      }, 340);
    }
  }
  function onMove(event) {
    if (held) {
      const now = performance.now();
      const dt = Math.max(0.004, (now - (held.lastT ?? now - 16)) / 1000);
      const nvx = (event.pageX - held.px) / dt, nvy = (event.pageY - held.py) / dt;
      const mix = Math.min(1, dt * 18);
      held.vx += (nvx - held.vx) * mix;
      held.vy += (nvy - held.vy) * mix;
      held.px = event.pageX; held.py = event.pageY; held.lastT = now;
      wake();
      return;
    }
    if (!pending) return;
    const moved = Math.hypot(event.pageX - pending.x, event.pageY - pending.y);
    if (pending.touch) {
      if (moved > 10) { clearTimeout(pending.timer); pending = null; }
      return;
    }
    if (moved > 4) {
      const p = pending;
      pending = null;
      take(p.body, p.x, p.y);
      held.px = event.pageX; held.py = event.pageY;
      swallowClick = true;
      try { root.setPointerCapture?.(p.id); } catch { /* the pointer is already gone */ }
    }
  }
  function onUp() {
    if (pending) { clearTimeout(pending.timer); pending = null; }
    if (held) letGo();
  }
  function onClick(event) {
    if (!swallowClick) return;
    swallowClick = false;
    event.stopPropagation();
    event.preventDefault();
  }
  function onTouchMove(event) {
    if (held) event.preventDefault();
  }
  function onBlur() { if (held) letGo(); pending = null; }

  root.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);
  root.addEventListener("click", onClick, true);
  root.addEventListener("touchmove", onTouchMove, { passive: false });
  window.addEventListener("blur", onBlur);

  return {
    /** Stop listening. Sheets stay where they are. */
    release() {
      root.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      root.removeEventListener("click", onClick, true);
      root.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("blur", onBlur);
      if (frame) cancelAnimationFrame(frame);
    },
    /** Put one sheet, or every sheet, back where CSS has it. */
    reset(el) {
      for (const body of el ? [bodies.get(el)].filter(Boolean) : bodies.values()) {
        body.x = 0; body.y = 0; body.a = 0; body.vx = 0; body.vy = 0; body.va = 0; body.lift = 0; body.sliding = false;
        for (const name of ["--px", "--py", "--pa", "--lift"]) body.el.style.removeProperty(name);
        body.el.classList.remove("is-held", "is-sliding");
      }
    },
  };
}

// ————————————————————————————————————————————————————————— edges and fittings

/**
 * A clip-path for a sheet with one edge torn by hand: uneven, never the same
 * tooth twice. Put it on .paper-face (not .paper, or the shadow is clipped off).
 * @param {object} [options]
 *   side    "bottom" | "top" | "left" | "right"
 *   depth   how far the tear wanders into the sheet, in px (default 5)
 *   steps   how many points along the edge (default 44)
 *   seed    the same seed tears the same way every time
 * @returns {string} a CSS polygon(), for style.clipPath
 */
export function tornEdge({ side = "bottom", depth = 5, steps = 44, seed = "tear" } = {}) {
  const rand = seeded(seed);
  const points = [];
  let drift = 0;
  for (let i = 0; i <= steps; i += 1) {
    drift = clamp(drift + (rand() - 0.5) * 0.9, -1, 1);
    const along = (i / steps) * 100 + (i > 0 && i < steps ? (rand() - 0.5) * (60 / steps) : 0);
    const into = Math.max(0, depth * (0.5 + 0.32 * drift + (rand() - 0.5) * 0.55));
    points.push([clamp(along, 0, 100), into]);
  }
  const p = (a, d) => {
    if (side === "bottom") return `${a.toFixed(2)}% calc(100% - ${d.toFixed(1)}px)`;
    if (side === "top") return `${a.toFixed(2)}% ${d.toFixed(1)}px`;
    if (side === "left") return `${d.toFixed(1)}px ${a.toFixed(2)}%`;
    return `calc(100% - ${d.toFixed(1)}px) ${a.toFixed(2)}%`;
  };
  const torn = points.map(([a, d]) => p(a, d));
  if (side === "bottom") return `polygon(0 0, 100% 0, ${torn.reverse().join(", ")})`;
  if (side === "top") return `polygon(${torn.join(", ")}, 100% 100%, 0 100%)`;
  if (side === "left") return `polygon(${torn.join(", ")}, 100% 100%, 100% 0)`;
  return `polygon(0 0, ${torn.join(", ")}, 0 100%)`;
}

let clipCount = 0;

/**
 * A wire paper clip as it sits on a sheet: the long loop lies on the front,
 * the bend goes over the top edge, and the short loop is behind the paper,
 * so you do not see it. Drawn in millimetres: 9 wide, 34 long, and the
 * sheet's edge is 4.6 mm down from the top of the drawing.
 * Wrap it in <span class="paper-clip"> inside a .paper (see paper.css).
 * @returns {string} SVG markup
 */
export function paperClip() {
  clipCount += 1;
  const id = `paper-clip-${clipCount}`;
  const front = "M1.5 9.2 L1.5 29.3 A3.05 3.05 0 0 0 7.6 29.3 L7.6 3 A2.3 2.3 0 0 0 3 3 L3 4.7";
  return `<svg viewBox="0 0 9 34" aria-hidden="true" focusable="false">
  <defs>
    <filter id="${id}" x="-40%" y="-10%" width="200%" height="130%"><feGaussianBlur stdDeviation="0.38"/></filter>
    <clipPath id="${id}-on"><rect x="-3" y="4.6" width="16" height="32"/></clipPath>
  </defs>
  <path d="${front}" fill="none" stroke="#000" stroke-opacity="0.34" stroke-width="1" stroke-linecap="round" transform="translate(0.55 0.75)" filter="url(#${id})" clip-path="url(#${id}-on)"/>
  <path d="${front}" fill="none" stroke="#59606d" stroke-width="1.02" stroke-linecap="round"/>
  <path d="${front}" fill="none" stroke="#b4bbc6" stroke-width="0.74" stroke-linecap="round"/>
  <path d="${front}" fill="none" stroke="#f6f8fb" stroke-width="0.24" stroke-linecap="round" transform="translate(-0.13 -0.1)"/>
</svg>`;
}

/**
 * Twine from a tag's eyelet up to where it is tied. Drawn in the tag's own
 * millimetres; the eyelet is the origin.
 * @param {object} [options]
 *   dx, dy   where the far end is, in mm from the eyelet (default up and left)
 *   sag      how much the twine bows, in mm
 * @returns {string} SVG markup for a <svg class="tag-string">
 */
export function tagString({ dx = -6, dy = -16, sag = 5 } = {}) {
  const mx = dx / 2 + sag, my = dy / 2 + sag * 0.3;
  const d = `M0 0 Q${mx.toFixed(1)} ${my.toFixed(1)} ${dx} ${dy}`;
  const loop = "M0 0 q-1.6 -1.1 -3.2 0.2 q1.7 1.5 3.2 -0.2";
  const pad = 4;
  const x0 = Math.min(0, dx, mx) - pad, y0 = Math.min(0, dy, my) - pad;
  const w = Math.max(0, dx, mx) - x0 + pad, h = Math.max(0, dy, my) - y0 + pad;
  return `<svg class="tag-string" viewBox="${x0.toFixed(1)} ${y0.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}" style="left: calc(var(--u) * ${(5.2 + x0).toFixed(1)}); top: calc(50% + var(--u) * ${y0.toFixed(1)}); width: calc(var(--u) * ${w.toFixed(1)}); height: calc(var(--u) * ${h.toFixed(1)});" aria-hidden="true" focusable="false">
  <path d="${d}" fill="none" stroke="#000" stroke-opacity="0.22" stroke-width="0.7" stroke-linecap="round" transform="translate(0.6 0.9)"/>
  <path d="${d} ${loop}" fill="none" stroke="#c9b68d" stroke-width="0.62" stroke-linecap="round"/>
  <path d="${d} ${loop}" fill="none" stroke="#8f7a50" stroke-width="0.62" stroke-linecap="butt" stroke-dasharray="0.7 1.3"/>
</svg>`;
}
