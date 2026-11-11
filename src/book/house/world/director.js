// The director: plays the replay's steps (story.mjs) on the live quarter.
//
// Everyone walks the roads. The map is read off the quarter itself: the ground's
// top voxel says whether a cell is road, paving, grass or water, and every piece
// of furniture, house and tree is in the way up to head height. A walk is the
// cheapest way over that map (roads are cheapest, grass dear, water and furniture
// impossible), pulled straight where the road allows. Walk frames follow distance,
// so feet never slide. Nothing appears in the open: papers come by courier,
// slips and coins are carried and set down, a letter goes out by hand.
//
//   const director = createDirector({ stage, scene, vendors, layer })
//   director.jump(state)            the quarter as a step leaves it, at once
//   await director.play(step, from) jump to `from`, then act the step out
//   director.idle(true)             everyone does their small job in place
//   director.destroy()

import { AGENTS, C, SPOTS, STATION, CLOCK, at as ground, agentFrames, vendorAt, post as postModel, bookStand, letterDesk, yourDesk } from "./world.js";
import { scaleBeam, tiltFor } from "./props.js";
import { Voxels, glow, mix } from "../craft/voxel.js";

// —— who works where
export const WHO = { post: "postmaster", read: "reader", book: "scribe", scale: "checker", letter: "writer" };
export const WHERE = Object.fromEntries(Object.entries(WHO).map(([k, v]) => [v, k]));
export const JOB = { postmaster: "the postmaster", reader: "the reader", scribe: "the scribe", checker: "the checker", writer: "the writer", courier: "the courier" };
// the way each faces at work (as the lead's still has them)
const HOME_TURN = { postmaster: 1, reader: 0, scribe: 3, checker: 1, writer: 2 };

const SPEED = { walk: 46, courier: 52 };      // voxels a second: at a run, so a paper's whole round reads in a few seconds
const STRIDE = 2.6;                           // voxels a walk frame carries a figure (frames follow distance)
const BEAT = { handover: 0.4, reply: 0.5, set: 0.35 };
const BUBBLE = 2.5;
const HEAD = 16;                              // a bubble's height over the feet
const CANCEL = Symbol("cancel");

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const tab = (i) => C.tabs[((i % C.tabs.length) + C.tabs.length) % C.tabs.length];
const near = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

// —— the map

const ROAD = new Set([...C.path, C.oak[0], C.oak[2]]);
const PAVED = new Set([...C.stone, C.joint]);

/** The walking map of a quarter: one cell per voxel column of its ground. */
export function walkMap(instances) {
  const groundInst = instances.find((i) => i.id === null && i.at[0] === 0 && i.at[2] === 0) ?? instances[0];
  const b = groundInst.model.bounds();
  const ox = b.x0, oz = b.z0, W = b.x1 - b.x0 + 1, H = b.z1 - b.z0 + 1;
  const top = new Int8Array(W * H).fill(-99);
  const cost = new Float32Array(W * H).fill(Infinity);
  groundInst.model.each((x, y, z, c) => {
    const i = (x - ox) + (z - oz) * W;
    if (y < top[i]) return;
    top[i] = y;
    const base = c & 0xffffff;
    cost[i] = y < 1 ? Infinity : ROAD.has(base) ? 1 : PAVED.has(base) ? 1.25 : 5;
  });
  const hard = new Uint8Array(W * H);
  for (const inst of instances) {
    if (inst === groundInst) continue;
    const [ax, , az] = inst.at;
    inst.model.each((x, y, z) => {
      if (y > 15) return;
      const gx = x + ax - ox, gz = z + az - oz;
      if (gx >= 0 && gz >= 0 && gx < W && gz < H) hard[gx + gz * W] = 1;
    });
  }
  // keep a figure's width clear of everything: cells beside furniture cost more, cells in it are shut
  const R = 2;
  const extra = new Float32Array(W * H);
  for (let z = 0; z < H; z += 1)
    for (let x = 0; x < W; x += 1) {
      if (!hard[x + z * W]) continue;
      for (let dz = -R; dz <= R; dz += 1)
        for (let dx = -R; dx <= R; dx += 1) {
          const nx = x + dx, nz = z + dz;
          if (nx >= 0 && nz >= 0 && nx < W && nz < H) extra[nx + nz * W] = 10;
        }
    }
  for (let i = 0; i < W * H; i += 1) cost[i] = hard[i] ? Infinity : cost[i] + extra[i];
  // the search's working buffers, kept between walks; a cell's entry counts only when stamped with this search's number
  const N = W * H;
  return { ox, oz, W, H, cost, hard, g: new Float32Array(N), came: new Int32Array(N), seen: new Uint32Array(N), shut: new Uint32Array(N), run: 0, cache: new Map() };
}

const inMap = (m, x, z) => x >= 0 && z >= 0 && x < m.W && z < m.H;

/** The nearest open cell to a world point. */
function openCell(m, x, z) {
  const cx = Math.round(x) - m.ox, cz = Math.round(z) - m.oz;
  for (let r = 0; r < 24; r += 1)
    for (let dz = -r; dz <= r; dz += 1)
      for (let dx = -r; dx <= r; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const nx = cx + dx, nz = cz + dz;
        if (inMap(m, nx, nz) && Number.isFinite(m.cost[nx + nz * m.W])) return [nx, nz];
      }
  return [clamp(cx, 0, m.W - 1), clamp(cz, 0, m.H - 1)];
}

/** The cheapest way from one world point to another, as world points with the corners kept. */
export function findPath(m, from, to) {
  const [sx, sz] = openCell(m, from[0], from[2]);
  const [gx, gz] = openCell(m, to[0], to[2]);
  const start = sx + sz * m.W, goal = gx + gz * m.W;
  const key = `${start}>${goal}`;
  const known = m.cache.get(key);
  if (known) return known.map((pt) => [...pt]);
  const run = (m.run += 1);
  const { g, came, seen, shut } = m;
  const G = (i) => (seen[i] === run ? g[i] : Infinity);
  const heap = [], f = [];
  const push = (i, score) => {
    heap.push(i); f.push(score);
    let k = heap.length - 1;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (f[p] <= f[k]) break;
      [heap[p], heap[k]] = [heap[k], heap[p]];
      [f[p], f[k]] = [f[k], f[p]];
      k = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const lastI = heap.pop(), lastF = f.pop();
    if (heap.length) {
      heap[0] = lastI; f[0] = lastF;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1, r = l + 1;
        let s = k;
        if (l < heap.length && f[l] < f[s]) s = l;
        if (r < heap.length && f[r] < f[s]) s = r;
        if (s === k) break;
        [heap[s], heap[k]] = [heap[k], heap[s]];
        [f[s], f[k]] = [f[k], f[s]];
        k = s;
      }
    }
    return top;
  };
  const h = (i) => {
    const dx = Math.abs((i % m.W) - gx), dz = Math.abs(Math.floor(i / m.W) - gz);
    return Math.max(dx, dz) + 0.414 * Math.min(dx, dz);
  };
  g[start] = 0; seen[start] = run; came[start] = -1;
  push(start, h(start));
  const STEPS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
  let found = false;
  while (heap.length) {
    const i = pop();
    if (shut[i] === run) continue;
    if (i === goal) { found = true; break; }
    shut[i] = run;
    const x = i % m.W, z = Math.floor(i / m.W);
    for (const [dx, dz, len] of STEPS) {
      const nx = x + dx, nz = z + dz;
      if (!inMap(m, nx, nz)) continue;
      const j = nx + nz * m.W;
      const c = m.cost[j];
      if (!Number.isFinite(c) || shut[j] === run) continue;
      // no cutting a corner past something solid
      if (dx && dz && (!Number.isFinite(m.cost[nx + z * m.W]) || !Number.isFinite(m.cost[x + nz * m.W]))) continue;
      const next = g[i] + len * (c + m.cost[i]) * 0.5;
      if (next < G(j)) {
        g[j] = next;
        seen[j] = run;
        came[j] = i;
        push(j, next + h(j));
      }
    }
  }
  const cells = [];
  if (found) for (let i = goal; i !== -1; i = came[i]) cells.push(i);
  else cells.push(goal, start);
  cells.reverse();
  const out = smooth(m, cells).map((i) => [(i % m.W) + m.ox, 1, Math.floor(i / m.W) + m.oz]);
  if (m.cache.size > 400) m.cache.clear();
  m.cache.set(key, out);
  return out.map((pt) => [...pt]);
}

/** Pull a cell path straight wherever a straight line costs no more than the road it replaces. */
function smooth(m, cells) {
  if (cells.length < 3) return cells;
  const at = (i) => [i % m.W, Math.floor(i / m.W)];
  const clear = (a, b, limit) => {
    const [ax, az] = at(a), [bx, bz] = at(b);
    const n = Math.ceil(Math.hypot(bx - ax, bz - az) * 2);
    for (let k = 1; k < n; k += 1) {
      const x = Math.round(ax + ((bx - ax) * k) / n), z = Math.round(az + ((bz - az) * k) / n);
      const c = m.cost[x + z * m.W];
      if (!Number.isFinite(c) || c > limit + 0.01) return false;
    }
    return true;
  };
  const out = [cells[0]];
  let i = 0;
  while (i < cells.length - 1) {
    let best = i + 1, limit = Math.max(m.cost[cells[i]], m.cost[cells[i + 1]]);
    let worst = limit;
    for (let j = i + 2; j < cells.length; j += 1) {
      worst = Math.max(worst, m.cost[cells[j]]);
      if (clear(cells[i], cells[j], worst)) best = j;
      else if (j - best > 12) break;
    }
    out.push(cells[best]);
    i = best;
  }
  return out;
}

// —— small things the director carries about (the lead's models are the furniture)

function slipModel(color) {
  const v = new Voxels({ jitter: 0.02 });
  v.box(0, 0, 0, 4, 0, 2, (x, y, z) => (x === 4 ? color : z === 1 && x > 0 && x < 3 ? C.inkSoft : C.cream));
  return v;
}
function coinModel() {
  const v = new Voxels({ jitter: 0.02 });
  v.tube(0, 0, 0, 1.4, 1, (x, y, z) => (x === 0 && z === 0 ? C.brass[3] : C.brass[1]), { axis: "z" });
  return v;
}
function letterModel() {
  const v = new Voxels({ jitter: 0.02 });
  v.box(0, 0, 0, 3, 0, 2, (x, y, z) => (x === 1 && z === 1 ? C.red : C.cream));
  return v;
}
/** Offers with strings, hung from the scale's column by a thread: one card each, in the company's colour. */
function offerTags(colors) {
  const v = new Voxels({ jitter: 0.02 });
  colors.slice(0, 3).forEach((color, i) => {
    const x = 3 + i * 3, z = 2 - i;
    v.set(x - 1, 22, z, C.ink).set(x, 21, z, C.ink).set(x, 20, z, C.ink);
    v.box(x - 1, 14, z, x + 2, 19, z, (xx, y) => (y === 19 ? color : y === 17 && xx > x - 1 && xx < x + 2 ? C.inkSoft : y === 15 && xx === x ? C.inkSoft : C.cream));
  });
  return v;
}
/** Credit notes, clipped upright to a post beside the scale: not on a pan, because they are not money yet. */
function noteSpike(colors) {
  const v = new Voxels({ jitter: 0.02 });
  v.box(-1, 0, -1, 1, 0, 1, C.iron);
  v.box(0, 1, 0, 0, 11, 0, C.ironLight);
  colors.slice(0, 3).forEach((color, i) => {
    const y0 = 4 + i, z = 1 + i;
    v.box(-2, y0, z, 2, y0 + 5, z, (x, y) => (y === y0 + 5 ? color : (y === y0 + 3 || y === y0 + 1) && x > -2 && x < 2 ? C.inkSoft : i % 2 ? C.creamShade : C.cream));
    v.set(0, y0 + 6, z, C.brass[2]);
  });
  return v;
}
/** The clock's ring: short strokes of light either side of the bell. */
function ringModel(wide) {
  const v = new Voxels({ jitter: 0 });
  const o = wide ? 5 : 4;
  for (const s of [-1, 1]) {
    v.set(s * o, 37, -s * o, glow(0xfff0b8)).set(s * (o + 1), 38, -s * (o + 1), glow(0xfff0b8));
    v.set(s * o, 35, -s * o, glow(0xfff0b8));
  }
  return v;
}

// —— the director

/**
 * @param {object} o
 *   stage     createStage(...) over the quarter
 *   scene     the quarter(state) the stage holds still
 *   vendors   how many houses
 *   layer     the DOM element the stage's anchors live in (bubbles go there)
 *   reduce    no walks: the moves show as bubbles and the props change in place
 *   onSay(who, text)   for a screen reader's live region
 */
export function createDirector({ stage, scene, vendors = 4, names = [], layer, reduce = false, onSay = null, onFocus = null, onTaken = null }) {
  const map = walkMap(scene.instances);
  const S = STATION;
  const instanceOf = (id) => scene.instances.find((i) => i.id === id);
  const live = { token: 0, idle: true, time: 0, timers: [] };
  const framesCache = new Map();
  const framesFor = (key, look, carry) => {
    const k = `${key}|${carry ?? ""}`;
    if (!framesCache.has(k)) framesCache.set(k, agentFrames(look, carry));
    return framesCache.get(k);
  };

  // the director's clock runs with the stage: it stops when the stage does
  const sleep = (seconds) => new Promise((resolve) => live.timers.push({ at: live.time + Math.max(0, seconds), resolve }));
  // something changed outside a figure's own frame (a turn, what it holds): draw the next frame
  const poke = () => { live.dirty = true; };
  stage.add({
    model: new Voxels(), at: [0, -999, 0], visible: false, shadow: false,
    update(dt) {
      live.time += dt;
      if (live.timers.length) {
        const due = live.timers.filter((t) => t.at <= live.time);
        if (due.length) {
          live.timers = live.timers.filter((t) => t.at > live.time);
          for (const t of due) t.resolve();
        }
      }
      const dirty = live.dirty;
      live.dirty = false;
      return dirty;
    },
  });

  // —— the figures
  const people = new Map();
  function figure(name, { look, home, turn = 0, tool = null, key = name, id = `agent:${name}`, visible = true, job = JOB[name] }) {
    const p = {
      name, look, key, home: [...home], homeTurn: turn, tool, carry: tool, job,
      path: null, walked: 0, speed: SPEED.walk, arrive: null, idleAt: 2 + Math.random() * 5, idleUntil: 0, act: null,
      actor: { frames: framesFor(key, look, tool), frame: "stand", at: [...home], turn, id, pivot: [1.5, 0, 1], visible, shadowRadius: 1.7 },
      tag: null, bubble: null,
    };
    p.actor.update = (dt) => step(p, dt);
    stage.add(p.actor);
    people.set(name, p);
    return p;
  }
  const spot = (station) => {
    const sp = SPOTS[station];
    return [S[station].at[0] + sp.agent[0], 1, S[station].at[1] + sp.agent[2]];
  };
  for (const [station, name] of Object.entries(WHO)) figure(name, { look: AGENTS[name], home: spot(station), turn: HOME_TURN[name], tool: SPOTS[station].carry });

  // the vendors' couriers live in their houses; Truthful's waits by the post box
  const doors = Array.from({ length: vendors }, (_, i) => {
    const [x, z] = vendorAt(i, vendors);
    const [cx, cz] = openCell(map, x + 8, z);
    return { inside: [x + 3, 1, z], out: [cx + map.ox, 1, cz + map.oz] };
  });
  for (let i = 0; i < vendors; i += 1) {
    const look = { ...AGENTS.courier, hatColor: tab(i), vest: mix(tab(i), 0x000000, 0.35), bag: mix(tab(i), 0x000000, 0.5) };
    figure(`courier:${i}`, { look, home: doors[i].out, turn: 1, key: `courier${i}`, id: `courier:${i}`, visible: false, job: names[i] ? `${names[i]}’s courier` : "their courier" });
  }
  // Truthful's courier waits by your desk: what you sign, he takes
  const byYourDesk = (() => {
    const [cx, cz] = openCell(map, S.you.at[0] - 19, S.you.at[1] - 6);
    return [cx + map.ox, 1, cz + map.oz];
  })();
  figure("courier", { look: AGENTS.courier, home: byYourDesk, turn: 1, key: "truthful", id: "agent:courier" });

  function setCarry(p, carry) {
    if (p.carry === carry) return;
    p.carry = carry;
    p.actor.frames = framesFor(p.key, p.look, carry);
    poke();
  }

  function faceToward(p, point) {
    const dx = point[0] - p.actor.at[0], dz = point[2] - p.actor.at[2];
    if (Math.abs(dx) < 0.01 && Math.abs(dz) < 0.01) return;
    p.actor.turn = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 1 : 3) : dz > 0 ? 0 : 2;
    poke();
  }
  // face the way it walks, without flicking between two near-equal ways on a diagonal road
  const AXES = [[0, 1], [1, 0], [0, -1], [-1, 0]];
  function faceAlong(p, dx, dz) {
    const len = Math.hypot(dx, dz) || 1;
    const score = AXES.map(([ux, uz]) => (dx * ux + dz * uz) / len);
    let best = 0;
    for (let t = 1; t < 4; t += 1) if (score[t] > score[best]) best = t;
    if (score[p.actor.turn] < score[best] - 0.3) p.actor.turn = best;
  }

  // one frame of a figure: walking a path, or its small job in place
  function step(p, dt) {
    const a = p.actor;
    if (p.path && p.path.length) {
      let left = p.speed * dt;
      let moved = false;
      while (left > 0 && p.path.length) {
        const to = p.path[0];
        const dx = to[0] - a.at[0], dz = to[2] - a.at[2];
        const d = Math.hypot(dx, dz);
        if (d <= left) {
          a.at[0] = to[0]; a.at[2] = to[2];
          left -= d; p.walked += d;
          p.path.shift();
        } else {
          a.at[0] += (dx / d) * left; a.at[2] += (dz / d) * left;
          p.walked += left; left = 0;
          faceAlong(p, dx, dz);
        }
        moved = true;
      }
      a.frame = ["left", "stand", "right", "stand"][Math.floor(p.walked / STRIDE) % 4];
      if (!p.path.length) {
        p.path = null;
        a.frame = "stand";
        const done = p.arrive;
        p.arrive = null;
        done?.(true);
      }
      return moved;
    }
    return idleStep(p, dt);
  }

  // —— idle: each at their own job, small and slow, never in step
  function idleStep(p, dt) {
    if (reduce || !live.idle || p.busy || p.name.startsWith("courier")) return false;
    if (near(p.actor.at, p.home) > 0.5) return false;
    p.idleAt -= dt;
    const a = p.actor;
    if (p.act) {
      p.act.t += dt;
      const t = p.act.t;
      let changed = false;
      if (p.act.kind === "sort") {
        const want = t < 1.4 ? 2 : p.homeTurn;
        if (a.turn !== want) { a.turn = want; changed = true; }
        if (t > 1.6) p.act = null;
      } else if (p.act.kind === "page") {
        const want = t < 0.35 ? null : p.tool;
        if (p.carry !== want) { setCarry(p, want); changed = true; }
        if (t > 0.5) p.act = null;
      } else if (p.act.kind === "write") {
        const y = 1 + (Math.floor(t / 0.28) % 2 === 0 ? 0 : 1) * (t < 1.7 ? 1 : 0);
        if (a.at[1] !== y) { a.at[1] = y; changed = true; }
        if (t > 1.8) { a.at[1] = 1; p.act = null; changed = true; }
      } else if (p.act.kind === "coin") {
        // sets the coin down on the table's edge, and takes it up again
        const want = t < 0.9 ? null : p.tool;
        if (p.carry !== want) { setCarry(p, want); changed = true; }
        if (t > 1.0) p.act = null;
      }
      return changed;
    }
    if (p.idleAt <= 0) {
      p.idleAt = 4 + Math.random() * 4;
      const kind = { postmaster: "sort", reader: "page", scribe: "write", checker: "coin", writer: "write" }[p.name];
      if (kind) p.act = { kind, t: 0 };
    }
    return false;
  }

  function settle(p) {
    p.act = null;
    p.actor.at[1] = 1;
  }

  /** Walk a figure to a world point along the roads; stop `short` voxels before it. */
  // before / after: straight stretches off the map's roads (out of a doorway, back in through it)
  function walkTo(p, to, { short = 0, speed, before = [], after = [] } = {}) {
    settle(p);
    if (p.arrive) { const done = p.arrive; p.arrive = null; done(false); }
    if (reduce) {
      return Promise.resolve(true);
    }
    let path = findPath(map, before.at(-1) ?? p.actor.at, to);
    if (short > 0) path = cutShort(path, to, short);
    path = [...before, ...path, ...after];
    if (!path.length || (path.length === 1 && near(path[0], p.actor.at) < 0.3)) return Promise.resolve(true);
    p.path = path;
    p.speed = speed ?? (p.name.startsWith("courier") ? SPEED.courier : SPEED.walk);
    showJob(p, true);
    if (p.busy) onFocus?.(() => p.actor.at);
    return new Promise((resolve) => {
      p.arrive = (ok) => { showJob(p, false); resolve(ok); };
    });
  }
  function cutShort(path, to, short) {
    // walk back from the end until `short` voxels from the target
    const out = [];
    for (let i = 0; i < path.length; i += 1) {
      const pt = path[i];
      if (near(pt, to) > short) { out.push(pt); continue; }
      const prev = out.at(-1) ?? path[0];
      const d0 = near(prev, to), d1 = near(pt, to);
      if (d0 > short && d0 !== d1) {
        const t = (d0 - short) / (d0 - d1);
        out.push([prev[0] + (pt[0] - prev[0]) * t, 1, prev[2] + (pt[2] - prev[2]) * t]);
      }
      break;
    }
    return out.length ? out : [path[0]];
  }
  function goHome(p) {
    p.busy = false;
    const door = p.name.startsWith("courier:") ? doors[Number(p.name.slice(8))] : null;
    const out = p.inDoor ? { before: [p.inDoor.out] } : {};
    p.inDoor = null;
    return walkTo(p, p.home, door ? { after: [door.inside] } : out).then(() => {
      if (near(p.actor.at, p.home) < 1) {
        p.actor.at[0] = p.home[0]; p.actor.at[2] = p.home[2];
        p.actor.turn = p.homeTurn;
        if (!p.busy) setCarry(p, p.tool);
        if (p.name.startsWith("courier:")) p.actor.visible = false;
      } else if (door && near(p.actor.at, door.inside) < 1) {
        // home is through the door: once inside, out of sight
        p.actor.at = [...p.home];
        p.actor.visible = false;
        p.actor.turn = p.homeTurn;
        setCarry(p, p.tool);
      }
    });
  }

  // —— words over heads
  function showJob(p, on) {
    if (!layer || reduce) return;
    if (on && !p.tag) {
      const el = document.createElement("span");
      el.className = "qw-job";
      el.textContent = p.job;
      el.setAttribute("aria-hidden", "true");
      layer.append(el);
      p.tag = { el, off: stage.anchor(el, () => [p.actor.at[0], p.actor.at[1] + HEAD - 1, p.actor.at[2]], { alignY: "-100%" }) };
    }
    if (p.tag) p.tag.el.hidden = !on || Boolean(p.bubble);
    if (!on && p.tag) { p.tag.off(); p.tag.el.remove(); p.tag = null; }
  }
  // side: which way the bubble opens from the speaker, so two who talk face to face never cover each other
  function say(p, text, seconds = BUBBLE, side = "middle", raise = 0) {
    if (!text) return;
    onSay?.(p.job, text);
    if (!layer) return;
    clearBubble(p);
    const el = document.createElement("p");
    el.className = `qw-bubble is-${side}`;
    el.textContent = text;
    layer.append(el);
    const point = p.point ?? (() => [p.actor.at[0], p.actor.at[1] + HEAD, p.actor.at[2]]);
    const alignX = side === "left" ? "calc(-100% + 10px)" : side === "right" ? "-10px" : "-50%";
    p.bubble = { el, off: stage.anchor(el, point, { alignX, alignY: "-100%", dy: -raise }) };
    if (p.tag) p.tag.el.hidden = true;
    const mine = p.bubble;
    sleep(seconds).then(() => { if (p.bubble === mine) clearBubble(p); });
  }
  function clearBubble(p) {
    if (!p.bubble) return;
    p.bubble.off();
    p.bubble.el.remove();
    p.bubble = null;
    if (p.tag) p.tag.el.hidden = false;
  }
  // the clock speaks too, from over its bell
  const clockAt = ground(CLOCK.sx, CLOCK.sy);
  const clockVoice = { name: "clock", job: "the clock", point: () => [clockAt[0], 41, clockAt[1]], bubble: null, tag: null };

  // —— the props that change as things are delivered
  const props = { inTray: -1, paid: -1, drafts: -1, waiting: -1 };
  function setWorld(key, value) {
    if (props[key] === value) return;
    props[key] = value;
    const inst = instanceOf({ inTray: "post", paid: "book", drafts: "letter", waiting: "you" }[key]);
    if (!inst) return;
    inst.model = key === "inTray" ? postModel(value) : key === "paid" ? bookStand(value) : key === "drafts" ? letterDesk(value) : yourDesk(value);
    stage.refresh();
  }

  // the beam, swinging to what is owed with a slow, damped settle
  const beamAt = [S.scale.at[0], 1, S.scale.at[1]];
  const beamCache = new Map();
  const beam = {
    tilt: 0, speed: 0, goal: 0, slips: [], coins: 0, shown: null,
    actor: { model: scaleBeam({}), at: [...beamAt], id: "scale", shadow: false },
  };
  function beamModel() {
    const tilt = Math.round(beam.tilt * 4) / 4;
    const key = `${tilt}|${beam.slips.join(",")}|${beam.coins}`;
    if (beam.shown === key) return false;
    beam.shown = key;
    if (!beamCache.has(key)) {
      if (beamCache.size > 120) beamCache.clear();
      beamCache.set(key, scaleBeam({ tilt, slips: beam.slips.map(tab), coins: beam.coins / 22 }));
    }
    beam.actor.model = beamCache.get(key);
    return true;
  }
  beam.actor.update = (dt) => {
    if (reduce) { beam.tilt = beam.goal; beam.speed = 0; return beamModel(); }
    if (Math.abs(beam.goal - beam.tilt) > 0.002 || Math.abs(beam.speed) > 0.002) {
      const k = 16, c = 3.2;
      beam.speed += (-(beam.tilt - beam.goal) * k - beam.speed * c) * dt;
      beam.tilt += beam.speed * dt;
    } else { beam.tilt = beam.goal; beam.speed = 0; }
    return beamModel();
  };
  stage.add(beam.actor);
  const coinsFor = (state) => (state.promisedCents > 0 && state.creditedCents > 0 ? Math.max(2, Math.round((state.creditedCents / state.promisedCents) * 22)) : 0);
  const tiltOf = (state) => tiltFor(state.promisedCents, state.owedCents);

  // offers on a thread, notes on the spike, the clock's ring
  const offers = { list: [], actor: { model: offerTags([]), at: [...beamAt], id: "scale", shadow: false, visible: false } };
  const notesAt = (() => { const [cx, cz] = openCell(map, beamAt[0] + 9, beamAt[2] + 9); return [cx + map.ox, 1, cz + map.oz]; })();
  const notes = { list: [], actor: { model: noteSpike([]), at: [...notesAt], id: "scale", shadow: true, shadowRadius: 1.2, visible: false } };
  stage.add(offers.actor);
  stage.add(notes.actor);
  function setOffers(list) {
    const key = list.join(",");
    if (offers.list.join(",") === key) return;
    offers.list = [...list];
    offers.actor.model = offerTags(list.map(tab));
    offers.actor.visible = list.length > 0;
    poke();
  }
  function setNotes(list) {
    const key = list.join(",");
    if (notes.list.join(",") === key) return;
    notes.list = [...list];
    notes.actor.model = noteSpike(list.map(tab));
    notes.actor.visible = list.length > 0;
    poke();
  }
  const ring = { frames: { a: ringModel(false), b: ringModel(true) }, actor: null, until: 0 };
  ring.actor = {
    frames: ring.frames, frame: "a", at: [clockAt[0], 1, clockAt[1]], id: "clock", shadow: false, visible: false,
    update() {
      if (!ring.actor.visible) return false;
      if (live.time > ring.until) { ring.actor.visible = false; return true; }
      const f = Math.floor(live.time / 0.16) % 2 ? "b" : "a";
      if (f === ring.actor.frame) return false;
      ring.actor.frame = f;
      return true;
    },
  };
  stage.add(ring.actor);

  // something carried the last stretch through the air: set on a pan, dropped on a desk
  function toss(model, from, to, seconds = 0.4) {
    if (reduce) return Promise.resolve();
    return new Promise((resolve) => {
      let t = 0;
      const actor = {
        model, at: [...from], shadow: false,
        update(dt) {
          t += dt;
          const k = Math.min(1, t / seconds);
          actor.at[0] = from[0] + (to[0] - from[0]) * k;
          actor.at[2] = from[2] + (to[2] - from[2]) * k;
          actor.at[1] = from[1] + (to[1] - from[1]) * k + Math.sin(k * Math.PI) * 4;
          if (k >= 1) { stage.remove(actor); resolve(); }
          return true;
        },
      };
      stage.add(actor);
    });
  }
  const hand = (p) => [p.actor.at[0], 8, p.actor.at[2]];

  // —— jumping: the quarter as a step leaves it, everyone at their place
  function jump(state) {
    live.token += 1;
    for (const t of live.timers) t.resolve();
    live.timers = [];
    for (const p of people.values()) {
      if (p.arrive) { const done = p.arrive; p.arrive = null; done(false); }
      p.path = null; p.busy = false; p.inDoor = null; settle(p);
      p.actor.at = [...p.home];
      p.actor.turn = p.homeTurn;
      p.actor.frame = "stand";
      setCarry(p, p.tool);
      if (p.name.startsWith("courier:")) p.actor.visible = false;
      clearBubble(p);
      showJob(p, false);
    }
    clearBubble(clockVoice);
    ring.actor.visible = false;
    if (!state) return;
    setWorld("inTray", state.inTray);
    setWorld("paid", state.paid);
    setWorld("drafts", 0);
    setWorld("waiting", state.waiting);
    beam.slips = [...state.slips];
    beam.coins = coinsFor(state);
    beam.goal = beam.tilt = tiltOf(state);
    beam.speed = 0;
    setOffers(state.offers);
    setNotes(state.notes);
    poke();
  }

  // —— the moves
  const P = (name) => people.get(name);
  function check(token) { if (token !== live.token) throw CANCEL; }
  // the one further left on screen talks to the left
  const sides = (a, b) => ((a.actor.at[0] - a.actor.at[2]) <= (b.actor.at[0] - b.actor.at[2]) ? ["left", "right"] : ["right", "left"]);

  async function pass(token, m, state) {
    const A = P(m.from), B = P(m.to);
    A.busy = true; B.busy = true;
    settle(B);
    setCarry(A, m.carry);
    await walkTo(A, B.actor.at, { short: 5 });
    check(token);
    faceToward(A, B.actor.at); faceToward(B, A.actor.at);
    const [sa, sb] = sides(A, B);
    say(A, m.say, BUBBLE, sa);
    await sleep(BEAT.handover); check(token);
    say(B, m.reply, BUBBLE, sb, 30);
    setCarry(A, null);
    setCarry(B, m.carry);
    await sleep(BEAT.reply); check(token);
    goHome(A);
  }

  async function arrive(token, m, state) {
    const c = P(`courier:${m.vendor}`) ?? P("courier:0");
    const pm = P("postmaster");
    pm.busy = true;
    c.busy = true;
    const door = doors[m.vendor] ?? doors[0];
    // out of their own door: inside the house the walls hide them, the doorway shows them coming
    c.actor.at = reduce ? [...c.home] : [...door.inside];
    c.actor.turn = 1;
    c.actor.visible = true;
    setCarry(c, m.carry);
    await walkTo(c, pm.actor.at, { short: 5, before: [door.out] });
    check(token);
    faceToward(c, pm.actor.at); faceToward(pm, c.actor.at);
    const [sc, sp] = sides(c, pm);
    say(c, m.say, BUBBLE, sc);
    await sleep(BEAT.handover); check(token);
    say(pm, m.reply, BUBBLE, sp, 30);
    setCarry(c, null);
    setCarry(pm, m.carry);
    setWorld("inTray", Math.min(state.inTray, Math.max(0, props.inTray) + (m.papers ?? 1)));
    await sleep(BEAT.reply); check(token);
    goHome(c);
  }

  // beside a pan: the left holds the promises, the right what came in (the checker works at the left)
  const panSide = (side) => {
    const [cx, cz] = openCell(map, beamAt[0] + (side < 0 ? -15 : 14), beamAt[2] + (side < 0 ? 0 : -9));
    return [cx + map.ox, 1, cz + map.oz];
  };
  async function toPan(token, who, side) {
    const p = P(who);
    p.busy = true;
    await walkTo(p, panSide(side));
    check(token);
    faceToward(p, [beamAt[0] + side * 12, 1, beamAt[2] - side * 12]);
    return p;
  }

  async function slip(token, m, state) {
    const p = await toPan(token, "scribe", -1, state);
    const pan = [beamAt[0] - 12, 26, beamAt[2] + 12];
    setCarry(p, null);
    await toss(slipModel(tab(m.vendor)), hand(p), pan);
    check(token);
    beam.slips = [...state.slips];
    beam.goal = tiltOf(state);
    say(p, "On the pan.", 1.6);
    await sleep(BEAT.set); check(token);
    goHome(p);
  }

  async function coins(token, m, state) {
    const p = await toPan(token, "checker", 1, state);
    const pan = [beamAt[0] + 12, 26, beamAt[2] - 12];
    const goal = coinsFor(state);
    const start = beam.coins;
    for (let n = start; n < goal; n += 1) {
      setCarry(p, "coin");
      await sleep(0.12); check(token);
      setCarry(p, null);
      await toss(coinModel(), hand(p), pan, 0.3);
      check(token);
      beam.coins = n + 1;
      beam.goal = tiltFor(state.promisedCents, Math.round(state.promisedCents - (state.promisedCents * (n + 1)) / 22));
    }
    beam.coins = goal;
    beam.goal = tiltOf(state);
    setCarry(p, null);
    await sleep(BEAT.set); check(token);
    goHome(p);
  }

  async function hang(token, m, state) {
    const p = P("scribe");
    p.busy = true;
    await walkTo(p, [beamAt[0] + 13, 1, beamAt[2] + 5]);
    check(token);
    faceToward(p, beamAt);
    setCarry(p, null);
    await toss(slipModel(tab(m.vendor)), hand(p), [beamAt[0] + 4, 17, beamAt[2] + 3]);
    check(token);
    setOffers(state.offers);
    await sleep(BEAT.set); check(token);
    goHome(p);
  }

  async function clip(token, m, state) {
    const p = P("checker");
    p.busy = true;
    await walkTo(p, notesAt, { short: 4 });
    check(token);
    faceToward(p, notesAt);
    setCarry(p, null);
    await toss(slipModel(tab(m.vendor)), hand(p), [notesAt[0], 5, notesAt[2]], 0.3);
    check(token);
    setNotes(state.notes);
    await sleep(BEAT.set); check(token);
    goHome(p);
  }

  async function draft(token, m) {
    const p = P("writer");
    p.busy = true;
    setWorld("drafts", 1);
    for (let i = 0; i < 4 && !reduce; i += 1) {
      p.actor.at[1] = 2;
      await sleep(0.2); check(token);
      p.actor.at[1] = 1;
      await sleep(0.2); check(token);
    }
    await sleep(0.2); check(token);
  }

  const deskAt = () => spot("you");
  const deskTop = () => [S.you.at[0] - 1.5, 13, S.you.at[1]];

  async function deliver(token, m, state) {
    const p = P("writer");
    p.busy = true;
    setCarry(p, "letter");
    await walkTo(p, deskAt());
    check(token);
    faceToward(p, deskTop());
    setCarry(p, null);
    await toss(letterModel(), hand(p), deskTop(), 0.3);
    check(token);
    setWorld("drafts", 0);
    setWorld("waiting", state.waiting);
    say(p, m.say ?? "For you to sign.");
    await sleep(BEAT.reply); check(token);
    goHome(p);
  }

  async function withdraw(token, m, state) {
    const p = P("writer");
    p.busy = true;
    setCarry(p, null);
    await walkTo(p, deskAt());
    check(token);
    faceToward(p, deskTop());
    await sleep(0.3); check(token);
    setWorld("waiting", state.waiting);
    setCarry(p, "letter");
    say(p, "This one can’t go now.", 2);
    await sleep(BEAT.reply); check(token);
    goHome(p);
  }

  async function ringClock(token, m) {
    onFocus?.([clockAt[0], 1, clockAt[1]]);
    ring.actor.visible = !reduce;
    ring.until = live.time + 1.6;
    say(clockVoice, m.line, 3.6);
    await sleep(reduce ? 1.2 : 1.8); check(token);
  }

  async function send(token, m, state) {
    const c = P("courier");
    c.busy = true;
    setCarry(c, null);
    await walkTo(c, deskAt());
    check(token);
    faceToward(c, deskTop());
    await sleep(0.3); check(token);
    setWorld("waiting", state.waiting);
    setCarry(c, "letter");
    onTaken?.();
    await sleep(0.2); check(token);
    const door = doors[m.vendor] ?? doors[0];
    await walkTo(c, door.out);
    check(token);
    faceToward(c, door.inside);
    say(c, m.say);
    await sleep(0.7); check(token);
    // in through their door with it, and out again with empty hands
    if (!reduce) {
      c.inDoor = door;
      c.path = [[...door.inside]];
      await new Promise((resolve) => { c.arrive = resolve; });
      check(token);
    }
    setCarry(c, null);
    await sleep(0.5); check(token);
    goHome(c);
  }

  const ACT = { arrive, pass, slip, coins, hang, clip, draft, deliver, withdraw, ring: ringClock, send, file, call: async () => {} };
  async function file(token) {
    const p = P("reader");
    p.busy = true;
    settle(p);
    p.actor.turn = 3;
    await sleep(0.35); check(token);
    setCarry(p, null);
    await sleep(0.6); check(token);
    p.actor.turn = p.homeTurn;
    setCarry(p, p.tool);
    p.busy = false;
  }

  /**
   * Act out a step. Jumps first to `from` (the state the step starts from) when given.
   * Resolves true when it played to the end, false when something else took over.
   */
  async function play(step, from) {
    if (from !== undefined) jump(from);
    const token = ++live.token;
    try {
      for (const m of step.moves ?? []) {
        const act = ACT[m.do];
        if (!act) continue;
        await act(token, m, step.state);
        check(token);
      }
      // whatever the moves did, the step ends as the book stood
      if (step.state) {
        setWorld("inTray", step.state.inTray);
        setWorld("paid", step.state.paid);
        setWorld("waiting", step.state.waiting);
        setWorld("drafts", 0);
        beam.slips = [...step.state.slips];
        beam.coins = coinsFor(step.state);
        beam.goal = tiltOf(step.state);
        setOffers(step.state.offers);
        setNotes(step.state.notes);
      }
      return true;
    } catch (error) {
      if (error === CANCEL) return false;
      throw error;
    } finally {
      for (const p of people.values()) if (token === live.token && !p.path) p.busy = false;
    }
  }

  return {
    map,
    people,
    beamAt,
    doors,
    jump,
    play,
    idle(on) { live.idle = on; },
    /** Where a figure is now (for a tag that follows it). */
    where(name) { return people.get(name)?.actor.at ?? null; },
    stop() { live.token += 1; },
    destroy() {
      live.token += 1;
      for (const p of people.values()) { clearBubble(p); showJob(p, false); }
      clearBubble(clockVoice);
    },
  };
}

/**
 * How big the quarter is on screen at unit 1: its art-pixel box and the ground
 * point at its middle. Faded grass at the edges is left out.
 */
export function quarterBox(instances) {
  const e = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
  for (const inst of instances) {
    const [ax, ay, az] = inst.at;
    const ground = inst.id === null && ax === 0 && az === 0;
    inst.model.each((x, y, z, c) => {
      if (ground && ((c >>> 28) & 7) >= 4) return;
      const X = x + ax, Y = y + ay, Z = z + az;
      const sx = X - Z, sy = (X + Z) / 2 - Y;
      if (sx - 1 < e.x0) e.x0 = sx - 1;
      if (sx + 1 > e.x1) e.x1 = sx + 1;
      if (sy - 1 < e.y0) e.y0 = sy - 1;
      if (sy + 1 > e.y1) e.y1 = sy + 1;
    });
  }
  const cx = (e.x0 + e.x1) / 2, cy = (e.y0 + e.y1) / 2;
  return { ...e, w: e.x1 - e.x0, h: e.y1 - e.y0, center: [cy + cx / 2, 0, cy - cx / 2] };
}
