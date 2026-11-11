// craft/kit/stage.js — a voxel scene, live in the browser.
//
// A stage owns one <canvas>. It draws the still part of the world once, keeps
// it, and each frame copies it and draws only what moves on top. The picture
// is made at a low "art" resolution and shown scaled up by a whole number of
// device pixels, so every art pixel is a crisp square on any screen.
//
// What it gives you:
//   drag to pan (it coasts), wheel / pinch / double-click to step the zoom
//   pick: which object is under the pointer; a rim eases round it on hover
//   actors: things that move, drawn on whole pixels, with a soft ground shadow
//   anchor(el, point): pin an ordinary DOM element to a place in the world
//   night: 0…1, eases daylight into moonlight, lamps and stars
//
// The world is the page's subject, not its wallpaper: keep labels and panels
// as real DOM elements over the canvas, so they are text a person can select,
// a screen reader can read and a keyboard can reach.

import { pixelCamera, createTarget, clearTarget, copyTarget, draw, shade, shadowMap, groundShadow, project, pick as pickAt, DAYLIGHT, MOONLIGHT, mixLight, sunFor, sceneBounds } from "./render.js";
import { post } from "./post.js";

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/**
 * @param {HTMLCanvasElement} canvas
 * @param {object} options
 *   scene        { instances, lamps? } — the part that holds still
 *   center       [x, y, z] to look at first
 *   turn         which corner to look from, 0–3 (or scene.turn)
 *   sun          direction toward the sun (or scene.sun); day / moon override the two lights
 *   unit         starting zoom: pixels per voxel half-width (2 wide, 3–4 close)
 *   units        the zoom steps allowed, e.g. [2, 3, 4]
 *   artWidth     roughly how many art pixels across (default 520); the stage
 *                picks the whole-number pixel size that gets closest
 *   background   0xRRGGBB | { top, bottom } | null (transparent)
 *   nightBackground  the same, for night
 *   night        0…1
 *   levels       colour steps (15)
 *   inset        { left, top, right, bottom } CSS pixels covered by a headline or panel;
 *                the scene centres in what is left
 *   bounds       { min: [x, z], max: [x, z] } the camera's centre may not leave
 *   onPick(id, info)   a click or tap on an object (id null = empty ground)
 *   onHover(id)
 *   pickable(id) → bool   which ids react (default: every id that is a string)
 */
export function createStage(canvas, options = {}) {
  const ctx = canvas.getContext("2d", { alpha: options.background === null });
  const scene = options.scene ?? { instances: [] };
  const reduce = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const units = options.units ?? [2, 3, 4];
  const state = {
    unit: options.unit ?? units[0],
    center: [...(options.center ?? [0, 0, 0])],
    goal: null,
    velocity: [0, 0],
    night: options.night ?? 0,
    nightGoal: options.night ?? 0,
    hover: null,
    hoverAmount: 0,
    time: 0,
  };
  const actors = [];
  const anchors = [];
  const inset = { left: 0, top: 0, right: 0, bottom: 0, ...(options.inset ?? {}) };
  const listeners = { frame: [] };
  const pickable = options.pickable ?? ((id) => typeof id === "string");

  let cam, kept, frame, image, shadow = null, shadowFor = null;
  let pixel = 1; // device pixels per art pixel
  let dirtyWorld = true, dirtyFrame = true, running = true, visible = true, raf = 0, last = 0;

  // —— size: art pixels are whole device pixels
  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const deviceW = Math.max(1, Math.round(rect.width * dpr)), deviceH = Math.max(1, Math.round(rect.height * dpr));
    pixel = Math.max(1, Math.round(deviceW / (options.artWidth ?? 520)));
    const w = Math.max(16, Math.ceil(deviceW / pixel)), h = Math.max(16, Math.ceil(deviceH / pixel));
    if (!cam || cam.w !== w || cam.h !== h) {
      canvas.width = w;
      canvas.height = h;
      kept = createTarget(w, h);
      frame = createTarget(w, h);
      image = ctx.createImageData(w, h);
      cam = pixelCamera({ width: w, height: h, unit: state.unit, turn: options.turn ?? scene.turn ?? 0, center: state.center });
      dirtyWorld = true;
    }
    canvas.style.imageRendering = "pixelated";
  }

  // options.sun (or scene.sun) turns the daylight to suit the corner you look from
  const sun = options.sun ?? scene.sun ?? sunFor(options.turn ?? scene.turn ?? 0);
  const dayLight = { ...DAYLIGHT, ...(options.day ?? {}), sun };
  const nightLight = { ...MOONLIGHT, ...(options.moon ?? {}), sun };
  function light() {
    return mixLight(dayLight, nightLight, state.night);
  }

  function drawWorld() {
    cam = pixelCamera({ width: cam.w, height: cam.h, unit: state.unit, turn: options.turn ?? scene.turn ?? 0, center: state.center });
    // leave room for whatever lies over the picture: the look point sits in
    // the middle of what is left, not the middle of the canvas
    const k = (window.devicePixelRatio || 1) / pixel;
    cam.ox += Math.round(((inset.left - inset.right) / 2) * k);
    cam.oy += Math.round(((inset.top - inset.bottom) / 2) * k);
    const L = light();
    if (!shadow || shadowFor !== scene.instances) {
      shadow = shadowMap(scene.instances, L.sun);
      shadowFor = scene.instances;
    }
    clearTarget(kept);
    for (const inst of scene.instances) if (inst.visible !== false) draw(kept, cam, inst, L.sun);
    shade(kept, cam, L, shadow, state.night > 0.3 ? (scene.lamps ?? []).map((l) => ({ ...l, power: (l.power ?? 1) * state.night })) : []);
    dirtyWorld = false;
    dirtyFrame = true;
  }

  function drawFrame() {
    const L = light();
    copyTarget(frame, kept);
    for (const a of actors) if (a.visible !== false && a.shadow !== false) groundShadow(frame, cam, a.at, a.shadowRadius ?? 1.8, 0.3 * (1 - state.night * 0.6));
    for (const a of actors) {
      if (a.visible === false) continue;
      draw(frame, cam, { ...a, model: a.frames ? a.frames[a.frame ?? "stand"] ?? a.model : a.model, snap: true }, L.sun);
    }
    shade(frame, cam, L, shadow);
    const bg = state.night > 0.5 && options.nightBackground !== undefined ? options.nightBackground : (options.background === undefined ? 0xf4f1ea : options.background);
    post(frame, { night: state.night, background: bg, levels: options.levels ?? 15, hover: state.hover, hoverAmount: state.hoverAmount, ring: options.ring ?? 0xfff3c4, offset: [cam.ox, cam.oy], time: state.time, out: image.data });
    ctx.putImageData(image, 0, 0);
    dirtyFrame = false;
    placeAnchors();
    for (const fn of listeners.frame) fn(api);
  }

  // —— DOM elements pinned to the world
  function placeAnchors() {
    const dpr = window.devicePixelRatio || 1;
    const k = pixel / dpr;
    for (const a of anchors) {
      const p = typeof a.point === "function" ? a.point() : a.point;
      if (!p) continue;
      const [sx, sy] = project(cam, p);
      const x = Math.round(sx * k + (a.dx ?? 0)), y = Math.round(sy * k + (a.dy ?? 0));
      a.el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(${a.alignX ?? "-50%"}, ${a.alignY ?? "-100%"})`;
      const off = sx < -40 || sy < -40 || sx > cam.w + 40 || sy > cam.h + 40;
      a.el.style.visibility = off ? "hidden" : "";
    }
  }

  // —— pointer: art pixel under a client point
  function artPoint(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return [((clientX - rect.left) / rect.width) * cam.w, ((clientY - rect.top) / rect.height) * cam.h];
  }

  function idAt(clientX, clientY) {
    const [x, y] = artPoint(clientX, clientY);
    // a thing two pixels wide is hard to hit: look a little around the point too
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2]]) {
      const id = pickAt(frame, Math.floor(x + dx), Math.floor(y + dy));
      if (id !== null && pickable(id)) return id;
    }
    return null;
  }

  // screen pixels → a shift of the camera's centre along the ground
  function panBy(dxArt, dyArt) {
    const u = state.unit;
    // invert the 2:1 projection on the ground plane (y fixed)
    const a = dxArt / u, b = (dyArt * 2) / u;
    const t = cam.turn ?? 0;
    const c = [1, 0, -1, 0][t], s = [0, 1, 0, -1][t];
    const xr = (a + b) / 2, zr = (b - a) / 2; // in the camera's turned frame
    const dx = c * xr - s * zr, dz = s * xr + c * zr;
    state.center[0] -= dx;
    state.center[2] -= dz;
    limitCenter();
    dirtyWorld = true;
  }

  function limitCenter() {
    const b = options.bounds;
    if (!b) return;
    state.center[0] = clamp(state.center[0], b.min[0], b.max[0]);
    state.center[2] = clamp(state.center[2], b.min[1], b.max[1]);
  }

  const drag = { on: false, moved: 0, x: 0, y: 0, t: 0, id: 0 };
  const touches = new Map();
  let pinchStart = 0;

  function onDown(e) {
    canvas.setPointerCapture?.(e.pointerId);
    touches.set(e.pointerId, [e.clientX, e.clientY]);
    if (touches.size === 2) {
      const [a, b] = [...touches.values()];
      pinchStart = Math.hypot(a[0] - b[0], a[1] - b[1]);
      drag.on = false;
      return;
    }
    drag.on = true;
    drag.moved = 0;
    drag.x = e.clientX;
    drag.y = e.clientY;
    drag.t = performance.now();
    drag.id = e.pointerId;
    state.goal = null;
    state.velocity = [0, 0];
  }

  function onMove(e) {
    if (touches.has(e.pointerId)) touches.set(e.pointerId, [e.clientX, e.clientY]);
    if (touches.size === 2 && pinchStart) {
      const [a, b] = [...touches.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (d > pinchStart * 1.35) { stepZoom(1); pinchStart = d; }
      else if (d < pinchStart * 0.74) { stepZoom(-1); pinchStart = d; }
      return;
    }
    if (drag.on && e.pointerId === drag.id) {
      const rect = canvas.getBoundingClientRect();
      const k = cam.w / rect.width;
      const dx = (e.clientX - drag.x) * k, dy = (e.clientY - drag.y) * k;
      drag.moved += Math.abs(dx) + Math.abs(dy);
      if (options.pan !== false && drag.moved > 2) {
        const now = performance.now(), dt = Math.max(1, now - drag.t);
        panBy(dx, dy);
        state.velocity = [(dx / dt) * 16, (dy / dt) * 16];
        drag.t = now;
        canvas.style.cursor = "grabbing";
      }
      drag.x = e.clientX;
      drag.y = e.clientY;
      return;
    }
    if (e.pointerType === "mouse") setHover(idAt(e.clientX, e.clientY));
  }

  function onUp(e) {
    touches.delete(e.pointerId);
    if (touches.size < 2) pinchStart = 0;
    if (!drag.on || e.pointerId !== drag.id) return;
    drag.on = false;
    canvas.style.cursor = state.hover ? "pointer" : options.pan === false ? "" : "grab";
    if (drag.moved <= 4) {
      state.velocity = [0, 0];
      const id = idAt(e.clientX, e.clientY);
      options.onPick?.(id, { clientX: e.clientX, clientY: e.clientY });
    } else if (reduce) state.velocity = [0, 0];
  }

  function setHover(id) {
    if (id === state.hover) return;
    state.hover = id;
    state.hoverAmount = reduce ? 1 : 0;
    canvas.style.cursor = id ? "pointer" : options.pan === false ? "" : "grab";
    options.onHover?.(id);
    dirtyFrame = true;
  }

  function stepZoom(direction) {
    const i = units.indexOf(state.unit);
    const next = units[clamp((i < 0 ? 0 : i) + direction, 0, units.length - 1)];
    if (next === state.unit) return;
    state.unit = next;
    dirtyWorld = true;
  }

  let wheelSum = 0;
  function onWheel(e) {
    if (options.zoom === false) return;
    e.preventDefault();
    wheelSum += e.deltaY;
    if (Math.abs(wheelSum) > 60) {
      stepZoom(wheelSum < 0 ? 1 : -1);
      wheelSum = 0;
    }
  }

  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  canvas.addEventListener("pointerleave", () => setHover(null));
  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("dblclick", () => options.zoom !== false && stepZoom(1));
  canvas.style.touchAction = options.pan === false ? "pan-y" : "none";
  canvas.style.cursor = options.pan === false ? "" : "grab";

  const resizer = typeof ResizeObserver === "function" ? new ResizeObserver(() => { resize(); }) : null;
  resizer?.observe(canvas);
  const watcher = typeof IntersectionObserver === "function" ? new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) kick(); }) : null;
  watcher?.observe(canvas);
  const onVisibility = () => { if (!document.hidden) kick(); };
  document.addEventListener("visibilitychange", onVisibility);

  function tick(now) {
    raf = 0;
    if (!running) return;
    const dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    state.time += dt;

    // coast after a throw
    if (!drag.on && (Math.abs(state.velocity[0]) > 0.05 || Math.abs(state.velocity[1]) > 0.05)) {
      panBy(state.velocity[0], state.velocity[1]);
      const k = Math.exp(-dt * 6);
      state.velocity[0] *= k;
      state.velocity[1] *= k;
    }
    // glide to a place
    if (state.goal) {
      const g = state.goal, k = reduce ? 1 : 1 - Math.exp(-dt * 7);
      state.center[0] += (g[0] - state.center[0]) * k;
      state.center[1] += (g[1] - state.center[1]) * k;
      state.center[2] += (g[2] - state.center[2]) * k;
      if (Math.hypot(g[0] - state.center[0], g[1] - state.center[1], g[2] - state.center[2]) < 0.05) {
        state.center = [...g];
        state.goal = null;
      }
      dirtyWorld = true;
    }
    if (state.night !== state.nightGoal) {
      const step = reduce ? 1 : dt / 1.2;
      state.night = Math.abs(state.nightGoal - state.night) <= step ? state.nightGoal : state.night + Math.sign(state.nightGoal - state.night) * step;
      dirtyWorld = true;
    }
    if (state.hover && state.hoverAmount < 1) {
      state.hoverAmount = Math.min(1, state.hoverAmount + dt * 8);
      dirtyFrame = true;
    }
    let moving = false;
    for (const a of actors) {
      if (a.update && a.update(dt, state.time, a) !== false) moving = true;
    }
    if (moving || (state.night > 0.01 && options.twinkle !== false)) dirtyFrame = true;

    if (dirtyWorld) drawWorld();
    if (dirtyFrame) drawFrame();
    kick();
  }

  function kick() {
    if (!raf && running && visible && !document.hidden) raf = requestAnimationFrame(tick);
  }

  const api = {
    canvas,
    get camera() { return cam; },
    get night() { return state.night; },
    get unit() { return state.unit; },
    get center() { return [...state.center]; },
    /** Ease to day (0) or night (1). */
    setNight(n) { state.nightGoal = clamp(n, 0, 1); kick(); },
    /** Glide the camera to a world point (or jump, with { jump: true }). */
    lookAt(point, { jump = false, unit } = {}) {
      if (unit && unit !== state.unit) { state.unit = unit; dirtyWorld = true; }
      if (jump || reduce) { state.center = [...point]; state.goal = null; dirtyWorld = true; }
      else state.goal = [...point];
      state.velocity = [0, 0];
      kick();
    },
    zoom(direction) { stepZoom(direction); kick(); },
    /** Room (in CSS pixels) taken by things lying over the picture: a headline, an open panel. The scene centres in what is left. */
    setInset(next) { Object.assign(inset, next); dirtyWorld = true; kick(); },
    /** Add something that moves: { model | frames, at, turn?, id?, update?(dt, time, actor) }. */
    add(actor) { actors.push(actor); dirtyFrame = true; kick(); return actor; },
    remove(actor) { const i = actors.indexOf(actor); if (i >= 0) actors.splice(i, 1); dirtyFrame = true; kick(); },
    get actors() { return actors; },
    /** Pin a DOM element to a world point (or a function returning one). It must be absolutely positioned at left:0; top:0 inside the canvas's parent. */
    anchor(el, point, opts = {}) { const a = { el, point, ...opts }; anchors.push(a); dirtyFrame = true; kick(); return () => { const i = anchors.indexOf(a); if (i >= 0) anchors.splice(i, 1); }; },
    /** Where a world point is, in CSS pixels from the canvas's top-left. */
    screenOf(point) { const [x, y] = project(cam, point); const k = pixel / (window.devicePixelRatio || 1); return [x * k, y * k]; },
    /** The world changed (a model was edited, an instance moved): draw it again. */
    refresh({ shadows = false } = {}) { if (shadows) shadow = null; dirtyWorld = true; kick(); },
    setHover,
    on(name, fn) { listeners[name]?.push(fn); return () => { const i = listeners[name].indexOf(fn); if (i >= 0) listeners[name].splice(i, 1); }; },
    /** Stop everything and let go of the canvas. */
    destroy() {
      running = false;
      cancelAnimationFrame(raf);
      resizer?.disconnect();
      watcher?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("wheel", onWheel);
    },
    /** Draw one frame now (for tests and screenshots). */
    renderNow() { resize(); drawWorld(); drawFrame(); },
  };

  resize();
  kick();
  return api;
}

/**
 * Walk an actor along a path of world points, facing where it goes and
 * cycling its frames ("left", "stand", "right", "stand"). Returns the update
 * function; set it as actor.update. `ground(x, z)` gives the y to stand on.
 * speed is voxels per second; stride is voxels per walk frame. When the path ends: loop, ping-pong, or call done.
 */
export function walk(points, { speed = 4, ground = null, loop = "pingpong", pause = 0, done = null, stride = 1.3 } = {}) {
  // `stride` is how far (in voxels) one frame of the walk carries the figure:
  // frames follow distance, not the clock, so feet never slide
  let i = 0, dir = 1, wait = 0, walked = 0, finished = false;
  return (dt, _time, actor) => {
    if (finished) return false;
    if (wait > 0) {
      wait -= dt;
      actor.frame = "stand";
      return false;
    }
    const to = points[i];
    const dx = to[0] - actor.at[0], dz = to[2] - actor.at[2];
    const dist = Math.hypot(dx, dz);
    const step = speed * dt;
    if (dist <= step) {
      actor.at[0] = to[0];
      actor.at[2] = to[2];
      if (i + dir >= points.length || i + dir < 0) {
        if (loop === "pingpong") dir = -dir;
        else if (loop === "loop") { i = -1; }
        else { finished = true; actor.frame = "stand"; done?.(actor); return true; }
      }
      i += dir;
      wait = pause;
    } else {
      actor.at[0] += (dx / dist) * step;
      actor.at[2] += (dz / dist) * step;
      // face the way it is going: +z is turn 0, +x is 1, −z is 2, −x is 3
      actor.turn = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 1 : 3) : dz > 0 ? 0 : 2;
      walked += step;
      actor.frame = ["left", "stand", "right", "stand"][Math.floor(walked / stride) % 4];
    }
    if (ground) actor.at[1] = ground(actor.at[0], actor.at[2]);
    return true;
  };
}

/** A gentle bob in place: something idling, floating or breathing. */
export function bob({ height = 1, period = 2.4, phase = 0 } = {}) {
  let base = null;
  return (_dt, time, actor) => {
    if (base === null) base = actor.at[1];
    const y = base + Math.round(Math.sin(((time + phase) / period) * Math.PI * 2) * height * 0.5 + height * 0.5);
    if (y === actor.at[1]) return false;
    actor.at[1] = y;
    return true;
  };
}

export { sceneBounds };
