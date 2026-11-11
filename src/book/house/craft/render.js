// craft/kit/render.js — draw voxel models small, the way pixel art is drawn.
//
// Everything here runs on the CPU with typed arrays, so the same code makes a
// PNG in Node (for an agent to look at) and a live canvas in the browser.
//
//   camera      an orthographic view. `pixelCamera` is the classic 2:1 pixel-art
//               projection, where every voxel lands on whole pixels.
//   draw        rasterises each exposed face as a small parallelogram into a
//               target: colour, sun term, corner occlusion, depth, object id.
//   shadowMap   the same rasteriser seen from the sun, depth only.
//   shade       sun + sky + shadows + lamps → linear light per pixel.
//
// The pixel-art look itself (levels, dither, rims) is in post.js.

import { FACE_KINDS } from "./voxel.js";

const AO_LEVELS = [1, 0.82, 0.68, 0.54];
const EPS = 1e-6;

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

function invert3(m) {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C;
  return [A / det, -(b * i - c * h) / det, (b * f - c * e) / det, B / det, (a * i - c * g) / det, -(a * f - c * d) / det, C / det, -(a * h - b * g) / det, (a * e - b * d) / det];
}

function finishCamera(cam, center) {
  cam.ox = Math.round(cam.w / 2 - dot(cam.m0, center));
  cam.oy = Math.round(cam.h / 2 - dot(cam.m1, center));
  cam.inv = invert3([...cam.m0, ...cam.m1, ...cam.d]);
  cam.center = [...center];
  return cam;
}

/**
 * The pixel-art camera. One voxel is `unit * 2` pixels wide, its top is `unit`
 * pixels tall and its sides are `rise` pixels tall, so edges run in clean 2:1
 * steps. `turn` (0–3) looks from each of the four corners.
 * unit 2 is a wide shot; 3 or 4 is a close one. Keep it a whole number.
 */
export function pixelCamera({ width, height, unit = 2, rise = unit, turn = 0, center = [0, 0, 0] }) {
  const t = ((turn % 4) + 4) % 4;
  const c = [1, 0, -1, 0][t], s = [0, 1, 0, -1][t];
  const cam = {
    w: width, h: height, unit, rise, turn: t, kind: "pixel",
    m0: [unit * (c + s), 0, unit * (s - c)],
    m1: [(unit / 2) * (c - s), -rise, (unit / 2) * (s + c)],
    d: norm([-(c - s), -unit / rise, -(s + c)]),
  };
  return finishCamera(cam, center);
}

/** A free orthographic camera: yaw and pitch in degrees, zoom in pixels per voxel. Softer edges than pixelCamera. */
export function freeCamera({ width, height, yaw = 45, pitch = 30, zoom = 3, center = [0, 0, 0] }) {
  const y = (yaw * Math.PI) / 180, p = (pitch * Math.PI) / 180;
  const right = [Math.cos(y), 0, -Math.sin(y)];
  const up = [-Math.sin(y) * Math.sin(p), Math.cos(p), -Math.cos(y) * Math.sin(p)];
  const cam = {
    w: width, h: height, unit: zoom, kind: "free",
    m0: right.map((v) => v * zoom),
    m1: up.map((v) => -v * zoom),
    d: [-Math.sin(y) * Math.cos(p), -Math.sin(p), -Math.cos(y) * Math.cos(p)],
  };
  return finishCamera(cam, center);
}

/** Move a camera to look at another point without rebuilding it. */
export function lookAt(cam, center) {
  return finishCamera(cam, center);
}

/** Where a world point lands on screen: [x, y, depth]. */
export function project(cam, p) {
  return [dot(cam.m0, p) + cam.ox, dot(cam.m1, p) + cam.oy, dot(cam.d, p)];
}

/** The world point under a screen pixel at a given depth. */
export function unproject(cam, sx, sy, depth) {
  const a = sx - cam.ox, b = sy - cam.oy, i = cam.inv;
  return [i[0] * a + i[1] * b + i[2] * depth, i[3] * a + i[4] * b + i[5] * depth, i[6] * a + i[7] * b + i[8] * depth];
}

/** The buffers a scene is drawn into. */
export function createTarget(width, height) {
  const n = width * height;
  return {
    w: width, h: height,
    rgb: new Float32Array(n * 3), // surface colour, linear
    lit: new Float32Array(n * 3), // after shade(): light leaving the surface, linear
    ndl: new Float32Array(n), // how squarely the surface faces the sun
    ao: new Float32Array(n), // corner occlusion
    depth: new Float32Array(n).fill(Infinity),
    id: new Uint16Array(n), // 1 + index into ids; 0 is nothing
    flag: new Uint8Array(n), // voxel flags; bit 7 = already shaded
    nid: new Uint8Array(n), // index into normals
    ids: [], // object ids, by index
    normals: [], // world normals met so far
    _idIndex: new Map(),
    _nIndex: new Map(),
  };
}

export function clearTarget(t) {
  t.depth.fill(Infinity);
  t.id.fill(0);
  t.flag.fill(0);
  return t;
}

/** Copy one target's picture into another of the same size (to draw moving things over a kept background). */
export function copyTarget(dst, src) {
  dst.rgb.set(src.rgb);
  dst.lit.set(src.lit);
  dst.ndl.set(src.ndl);
  dst.ao.set(src.ao);
  dst.depth.set(src.depth);
  dst.id.set(src.id);
  dst.flag.set(src.flag);
  dst.nid.set(src.nid);
  dst.ids = src.ids.slice();
  dst.normals = src.normals.slice();
  dst._idIndex = new Map(src._idIndex);
  dst._nIndex = new Map(src._nIndex);
  return dst;
}

function idIndex(t, id) {
  if (id === undefined || id === null) return 0;
  let i = t._idIndex.get(id);
  if (i === undefined) {
    t.ids.push(id);
    i = t.ids.length;
    t._idIndex.set(id, i);
  }
  return i;
}

function normalIndex(t, n) {
  const key = `${Math.round(n[0] * 64)},${Math.round(n[1] * 64)},${Math.round(n[2] * 64)}`;
  let i = t._nIndex.get(key);
  if (i === undefined) {
    t.normals.push(n);
    i = t.normals.length - 1;
    t._nIndex.set(key, i);
  }
  return i;
}

// a hash that holds still on the world, for dissolving edges
function hash2(x, y) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function basisOf(inst) {
  const s = inst.scale ?? 1;
  let c, sn;
  if (inst.yaw !== undefined) {
    c = Math.cos(inst.yaw);
    sn = Math.sin(inst.yaw);
  } else {
    const t = (((inst.turn ?? 0) % 4) + 4) % 4;
    c = [1, 0, -1, 0][t];
    sn = [0, 1, 0, -1][t];
  }
  return [[c * s, 0, -sn * s], [0, s, 0], [sn * s, 0, c * s]];
}

// Where the model's own origin goes. With a `pivot` (a point in the model, in
// voxels) the model turns about that point instead of its corner, so a figure
// that turns to face a new way stays standing where it was.
function placeOf(inst, basis) {
  const at = inst.at ?? [0, 0, 0];
  const p = inst.pivot;
  if (!p) return at;
  const s = inst.scale ?? 1;
  return [
    at[0] + p[0] * s - (p[0] * basis[0][0] + p[2] * basis[2][0]),
    at[1],
    at[2] + p[2] * s - (p[0] * basis[0][2] + p[2] * basis[2][2]),
  ];
}

/**
 * Draw one placed model into a target.
 * inst: { model, at: [x, y, z], scale?, turn? (quarter turns) | yaw? (radians), pivot? [x, y, z],
 *         id?, tint? [r, g, b], snap? }
 * sun: unit vector toward the sun (for the sun term). Pass `depthOnly` a
 * Float32Array to fill just depth (that is how shadow maps are made).
 */
export function draw(target, cam, inst, sun = [0, 1, 0], depthOnly = null) {
  const mesh = inst.model.faces();
  if (!mesh.count) return;
  const basis = basisOf(inst);
  const scale = inst.scale ?? 1;
  const at = placeOf(inst, basis);
  const w = cam.w, h = cam.h;
  const S = basis.map((b) => [dot(cam.m0, b), dot(cam.m1, b), dot(cam.d, b)]);
  let o0 = dot(cam.m0, at) + cam.ox, o1 = dot(cam.m1, at) + cam.oy;
  const o2 = dot(cam.d, at);
  // something that moves is drawn on whole pixels, so it steps instead of shimmering
  if (inst.snap) {
    o0 = Math.round(o0);
    o1 = Math.round(o1);
  }
  const zbuf = depthOnly ?? target.depth;
  const objectId = depthOnly ? 0 : idIndex(target, inst.id);
  const tint = inst.tint;

  // what's the same for every face of one kind
  const kinds = FACE_KINDS.map((f) => {
    const n = basis[f.a].map((v) => (v / scale) * f.s);
    const e1 = S[f.t1], e2 = S[f.t2];
    const det = e1[0] * e2[1] - e1[1] * e2[0];
    return {
      f,
      visible: dot(n, cam.d) < -EPS && Math.abs(det) > 1e-9,
      ndl: Math.max(0, dot(n, sun)),
      nid: depthOnly ? 0 : normalIndex(target, n),
      e1, e2,
      i00: e2[1] / det, i01: -e2[0] / det, i10: -e1[1] / det, i11: e1[0] / det,
    };
  });

  const { pos, kind, rgb, ao, flag, count } = mesh;
  const sx = S[0], sy = S[1], sz = S[2];
  for (let i = 0; i < count; i += 1) {
    const K = kinds[kind[i]];
    if (!K.visible) continue;
    const bits = flag[i];
    if (depthOnly && bits & 8) continue; // NOCAST
    let fx = pos[i * 3], fy = pos[i * 3 + 1], fz = pos[i * 3 + 2];
    if (K.f.s > 0) {
      if (K.f.a === 0) fx += 1;
      else if (K.f.a === 1) fy += 1;
      else fz += 1;
    }
    const px0 = o0 + fx * sx[0] + fy * sy[0] + fz * sz[0];
    const py0 = o1 + fx * sx[1] + fy * sy[1] + fz * sz[1];
    const z0 = o2 + fx * sx[2] + fy * sy[2] + fz * sz[2];
    const e1 = K.e1, e2 = K.e2;
    const minX = px0 + Math.min(0, e1[0], e2[0], e1[0] + e2[0]);
    const maxX = px0 + Math.max(0, e1[0], e2[0], e1[0] + e2[0]);
    const minY = py0 + Math.min(0, e1[1], e2[1], e1[1] + e2[1]);
    const maxY = py0 + Math.max(0, e1[1], e2[1], e1[1] + e2[1]);
    const xa = Math.max(0, Math.ceil(minX - 0.5)), xb = Math.min(w - 1, Math.floor(maxX - 0.5));
    const ya = Math.max(0, Math.ceil(minY - 0.5)), yb = Math.min(h - 1, Math.floor(maxY - 0.5));
    if (xa > xb || ya > yb) continue;
    const faded = (bits >> 4) & 7;
    for (let py = ya; py <= yb; py += 1) {
      const dy = py + 0.5 - py0;
      for (let px = xa; px <= xb; px += 1) {
        const dx = px + 0.5 - px0;
        const u = dx * K.i00 + dy * K.i01;
        if (u < -EPS || u > 1 + EPS) continue;
        const v = dx * K.i10 + dy * K.i11;
        if (v < -EPS || v > 1 + EPS) continue;
        const depth = z0 + u * e1[2] + v * e2[2];
        const at2 = py * w + px;
        if (depth >= zbuf[at2]) continue;
        if (faded && hash2(px - cam.ox, py - cam.oy) < faded / 8) continue;
        zbuf[at2] = depth;
        if (depthOnly) continue;
        const a = ao[i];
        const a00 = AO_LEVELS[a & 3], a10 = AO_LEVELS[(a >> 2) & 3], a11 = AO_LEVELS[(a >> 4) & 3], a01 = AO_LEVELS[(a >> 6) & 3];
        target.ao[at2] = (1 - u) * (1 - v) * a00 + u * (1 - v) * a10 + u * v * a11 + (1 - u) * v * a01;
        const c3 = at2 * 3;
        if (tint) {
          target.rgb[c3] = rgb[i * 3] * tint[0];
          target.rgb[c3 + 1] = rgb[i * 3 + 1] * tint[1];
          target.rgb[c3 + 2] = rgb[i * 3 + 2] * tint[2];
        } else {
          target.rgb[c3] = rgb[i * 3];
          target.rgb[c3 + 1] = rgb[i * 3 + 1];
          target.rgb[c3 + 2] = rgb[i * 3 + 2];
        }
        target.ndl[at2] = K.ndl;
        target.id[at2] = objectId;
        target.flag[at2] = bits & 15; // clears "already shaded"
        target.nid[at2] = K.nid;
      }
    }
  }
}

/** The eight corners of a placed model, in world space. */
function cornersOf(inst) {
  const b = inst.model.faces().bounds;
  if (!b || b.empty) return [];
  const basis = basisOf(inst), at = placeOf(inst, basis);
  const out = [];
  for (const x of [b.x0, b.x1 + 1])
    for (const y of [b.y0, b.y1 + 1])
      for (const z of [b.z0, b.z1 + 1])
        out.push([
          at[0] + x * basis[0][0] + y * basis[1][0] + z * basis[2][0],
          at[1] + x * basis[0][1] + y * basis[1][1] + z * basis[2][1],
          at[2] + x * basis[0][2] + y * basis[1][2] + z * basis[2][2],
        ]);
  return out;
}

/** The box that holds every instance: { min: [x, y, z], max: [x, y, z] }. */
export function sceneBounds(instances) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const inst of instances)
    for (const p of cornersOf(inst))
      for (let i = 0; i < 3; i += 1) {
        if (p[i] < min[i]) min[i] = p[i];
        if (p[i] > max[i]) max[i] = p[i];
      }
  return { min, max };
}

/**
 * What the sun can see: a depth picture of the scene from the sun's side.
 * `texels` is its resolution in texels per voxel; 2 gives crisp pixel shadows.
 */
export function shadowMap(instances, sun, { texels = 2, max = 2048 } = {}) {
  const L = norm(sun);
  const lu = norm(cross(Math.abs(L[1]) > 0.99 ? [1, 0, 0] : [0, 1, 0], L));
  const lv = cross(L, lu);
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  const casters = instances.filter((i) => i.cast !== false);
  for (const inst of casters)
    for (const p of cornersOf(inst)) {
      const u = dot(lu, p), v = dot(lv, p);
      if (u < u0) u0 = u;
      if (u > u1) u1 = u;
      if (v < v0) v0 = v;
      if (v > v1) v1 = v;
    }
  if (!Number.isFinite(u0)) return null;
  let k = texels;
  k = Math.min(k, (max - 4) / Math.max(1, u1 - u0), (max - 4) / Math.max(1, v1 - v0));
  const w = Math.ceil((u1 - u0) * k) + 4, h = Math.ceil((v1 - v0) * k) + 4;
  const cam = { w, h, m0: lu.map((x) => x * k), m1: lv.map((x) => x * k), d: [-L[0], -L[1], -L[2]], ox: 2 - u0 * k, oy: 2 - v0 * k };
  const depth = new Float32Array(w * h).fill(Infinity);
  for (const inst of casters) draw(null, cam, inst, L, depth);
  return { cam, depth, w, h };
}

/** 0 (in shadow) … 1 (in the sun) at a world point with normal n. */
export function sunlit(shadow, p, n) {
  if (!shadow) return 1;
  const c = shadow.cam;
  // step off the surface first, so a face never shadows itself
  const x = p[0] + n[0] * 0.6, y = p[1] + n[1] * 0.6, z = p[2] + n[2] * 0.6;
  const su = c.m0[0] * x + c.m0[1] * y + c.m0[2] * z + c.ox - 0.5;
  const sv = c.m1[0] * x + c.m1[1] * y + c.m1[2] * z + c.oy - 0.5;
  const sd = c.d[0] * x + c.d[1] * y + c.d[2] * z - 0.3;
  const iu = Math.floor(su), iv = Math.floor(sv);
  let lit = 0;
  for (let j = 0; j < 2; j += 1)
    for (let i = 0; i < 2; i += 1) {
      const xx = iu + i, yy = iv + j;
      if (xx < 0 || yy < 0 || xx >= shadow.w || yy >= shadow.h) lit += 1;
      else if (sd <= shadow.depth[yy * shadow.w + xx]) lit += 1;
    }
  return lit / 4;
}

/**
 * Where the sun should stand for each corner you can look from, so that of the
 * two walls you can see, one is lit and one is in shade. (With one sun for all
 * four corners, two of them show both walls equally bright and the scene goes flat.)
 */
export const SUN_FOR_TURN = [
  [-0.42, 0.78, 0.46],
  [0.4, 0.78, 0.48],
  [0.42, 0.78, -0.46],
  [-0.4, 0.78, -0.48],
];
export const sunFor = (turn = 0) => SUN_FOR_TURN[((turn % 4) + 4) % 4];

/** A late-afternoon sun and a cool sky: the default light. */
export const DAYLIGHT = {
  sun: [-0.42, 0.78, 0.46], // toward the sun: up, from the left and the front
  sunColor: [1.0, 0.94, 0.82],
  sunPower: 0.74,
  skyColor: [0.8, 0.88, 1.0],
  skyPower: 0.5,
  glow: 1.0, // how bright lit-from-inside voxels are
  night: 0, // 0 day … 1 night: turns lamps and windows on
};

/** Moonlight: dim and blue, with lamps and windows doing the work. */
export const MOONLIGHT = {
  sun: [-0.42, 0.78, 0.46],
  sunColor: [0.55, 0.68, 1.0],
  sunPower: 0.2,
  skyColor: [0.42, 0.5, 0.82],
  skyPower: 0.2,
  glow: 2.4,
  night: 1,
};

/** Blend two lights (for dusk, or easing day into night): t = 0 is a, 1 is b. */
export function mixLight(a, b, t) {
  const m = (x, y) => x + (y - x) * t;
  const m3 = (x, y) => [m(x[0], y[0]), m(x[1], y[1]), m(x[2], y[2])];
  return { sun: norm(m3(a.sun, b.sun)), sunColor: m3(a.sunColor, b.sunColor), sunPower: m(a.sunPower, b.sunPower), skyColor: m3(a.skyColor, b.skyColor), skyPower: m(a.skyPower, b.skyPower), glow: m(a.glow, b.glow), night: m(a.night ?? 0, b.night ?? 0) };
}

/**
 * Light every pixel that has not been lit yet.
 * lamps: [{ at: [x, y, z], color: [r, g, b], radius, power }] — small local lights.
 */
export function shade(target, cam, light = DAYLIGHT, shadow = null, lamps = []) {
  const { w, h, rgb, lit, ndl, ao, depth, flag, nid, normals } = target;
  const sc = light.sunColor, kc = light.skyColor, sp = light.sunPower, kp = light.skyPower;
  const nightAmount = light.night ?? 0;
  const i = cam.inv;
  for (let py = 0; py < h; py += 1) {
    for (let px = 0; px < w; px += 1) {
      const at = py * w + px;
      const z = depth[at];
      if (z === Infinity || flag[at] & 128) continue;
      const c3 = at * 3;
      if (flag[at] & 2) {
        // lit from inside
        lit[c3] = rgb[c3] * light.glow;
        lit[c3 + 1] = rgb[c3 + 1] * light.glow;
        lit[c3 + 2] = rgb[c3 + 2] * light.glow;
      } else if (flag[at] & 4) {
        // a lamp or a window: dark glass under the sun, its own colour after dark
        const day = (0.16 + 0.2 * ndl[at]) * (1 - nightAmount);
        const on = nightAmount * 2.1;
        lit[c3] = rgb[c3] * on + (rgb[c3] * 0.5 + kc[0] * 0.5) * day;
        lit[c3 + 1] = rgb[c3 + 1] * on + (rgb[c3 + 1] * 0.5 + kc[1] * 0.5) * day;
        lit[c3 + 2] = rgb[c3 + 2] * on + (rgb[c3 + 2] * 0.5 + kc[2] * 0.5) * day;
      } else {
        let s = ndl[at];
        if (s > 0 && shadow) {
          const a = px + 0.5 - cam.ox, b = py + 0.5 - cam.oy;
          const p = [i[0] * a + i[1] * b + i[2] * z, i[3] * a + i[4] * b + i[5] * z, i[6] * a + i[7] * b + i[8] * z];
          s *= sunlit(shadow, p, normals[nid[at]]);
        }
        const o = ao[at];
        lit[c3] = rgb[c3] * o * (kc[0] * kp + sc[0] * sp * s);
        lit[c3 + 1] = rgb[c3 + 1] * o * (kc[1] * kp + sc[1] * sp * s);
        lit[c3 + 2] = rgb[c3 + 2] * o * (kc[2] * kp + sc[2] * sp * s);
      }
      flag[at] |= 128;
    }
  }
  for (const lamp of lamps) addLamp(target, cam, lamp);
  return target;
}

function addLamp(target, cam, lamp) {
  const { w, h, rgb, lit, depth, flag, nid, normals } = target;
  const [sx, sy] = project(cam, lamp.at);
  const reach = lamp.radius * Math.hypot(cam.m0[0], cam.m0[2]) * 0.75 + 2;
  const xa = Math.max(0, Math.floor(sx - reach)), xb = Math.min(w - 1, Math.ceil(sx + reach));
  const ya = Math.max(0, Math.floor(sy - reach)), yb = Math.min(h - 1, Math.ceil(sy + reach));
  const power = lamp.power ?? 1, col = lamp.color ?? [1, 0.82, 0.5];
  for (let py = ya; py <= yb; py += 1)
    for (let px = xa; px <= xb; px += 1) {
      const at = py * w + px;
      const z = depth[at];
      if (z === Infinity || flag[at] & 6) continue;
      const p = unproject(cam, px + 0.5, py + 0.5, z);
      const dx = lamp.at[0] - p[0], dy = lamp.at[1] - p[1], dz = lamp.at[2] - p[2];
      const dist = Math.hypot(dx, dy, dz);
      if (dist >= lamp.radius) continue;
      const n = normals[nid[at]];
      const facing = Math.max(0, (n[0] * dx + n[1] * dy + n[2] * dz) / (dist || 1));
      const fall = (1 - dist / lamp.radius) ** 1.5;
      const k = power * fall * (0.35 + 0.65 * facing);
      const c3 = at * 3;
      lit[c3] += rgb[c3] * col[0] * k;
      lit[c3 + 1] += rgb[c3 + 1] * col[1] * k;
      lit[c3 + 2] += rgb[c3 + 2] * col[2] * k;
    }
}

/**
 * Darken the ground in a soft patch: the shadow under something that moves.
 * Cheaper than redrawing the sun's view every frame.
 */
export function groundShadow(target, cam, at, radius = 2, strength = 0.32) {
  const { w, h, lit, depth, flag } = target;
  const [sx, sy] = project(cam, at);
  const reach = radius * Math.hypot(cam.m0[0], cam.m0[2]) + 2;
  const xa = Math.max(0, Math.floor(sx - reach)), xb = Math.min(w - 1, Math.ceil(sx + reach));
  const ya = Math.max(0, Math.floor(sy - reach)), yb = Math.min(h - 1, Math.ceil(sy + reach));
  for (let py = ya; py <= yb; py += 1)
    for (let px = xa; px <= xb; px += 1) {
      const i = py * w + px;
      const z = depth[i];
      if (z === Infinity || flag[i] & 2) continue;
      const p = unproject(cam, px + 0.5, py + 0.5, z);
      if (Math.abs(p[1] - at[1]) > 1.2) continue;
      const d = Math.hypot(p[0] - at[0], p[2] - at[2]) / radius;
      if (d >= 1) continue;
      const k = 1 - strength * (1 - d * d);
      lit[i * 3] *= k;
      lit[i * 3 + 1] *= k;
      lit[i * 3 + 2] *= k;
    }
}

/**
 * Draw a whole scene in one go.
 * scene: { instances, light?, lamps?, shadows? (default true) }
 * Returns the lit target; hand it to post() for the pixel-art pass.
 */
export function renderScene(scene, cam, target = createTarget(cam.w, cam.h)) {
  const light = scene.light ?? DAYLIGHT;
  clearTarget(target);
  for (const inst of scene.instances) if (inst.visible !== false) draw(target, cam, inst, norm(light.sun));
  const shadow = scene.shadows === false ? null : (scene._shadow ??= shadowMap(scene.instances, light.sun));
  shade(target, cam, light, shadow, scene.lamps ?? []);
  target.shadow = shadow;
  return target;
}

/** Which object is under a pixel (or null). */
export function pick(target, px, py) {
  if (px < 0 || py < 0 || px >= target.w || py >= target.h) return null;
  const i = target.id[(py | 0) * target.w + (px | 0)];
  return i ? target.ids[i - 1] : null;
}
