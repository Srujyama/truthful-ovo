// Truthful's counting house: the room the book of IOUs is kept in.
//
// What each thing stands for:
//   the scale            what they promised (left pan) against what has come off invoices (right pan).
//                        It hangs level only when nobody owes you anything.
//   a slip on the pan    one promise, with its company's colour on the edge
//   a coin on the pan    money that has actually shown up on an invoice
//   the book             every promise, written down (the IOUs)
//   the slot and tray    where an email, a contract or an invoice comes in
//   the paper drawers    every paper on file, one drawer per kind
//   the pigeonholes      one hole per company; a red flag up means it still owes
//   the blotter and pen  what is waiting for your say-so. The clerk never signs.
//   the day book         everything that happened, in order, under the clock
//   the calendar         the day the book is reading as of
//   the clerk            Truthful: files, writes down, checks, weighs. Wears a green eyeshade.
//
// y is up. The room's two walls stand along x (the "long wall", facing +z) and
// along z (the "side wall", facing +x), so from turn 0 you look into the corner.
// One voxel is about 10 cm.

import { Voxels, soft, glow, lamp, nocast, hash3, mix } from "../craft/voxel.js";

// —— palette. The page takes its paper, ink and red from here.
export const C = {
  paper: 0xdde8d0, page: 0xe8f0de, pageLine: 0xb4c8ab,
  ink: 0x1d2740, inkSoft: 0x3c4868,
  red: 0xc9361f, redDeep: 0x9f2a17,
  cream: 0xf6f1e2, creamShade: 0xe3dbc5,
  plaster: [0xdfd8bc, 0xe6dfc5, 0xece6cf],
  green: [0x21392c, 0x294636, 0x325441, 0x3c634d],
  baize: 0x3f7a55, baizeDeep: 0x2e5f43, baizeLight: 0x4d8c65,
  floor: [0x7f5231, 0x8c5c37, 0x99683f, 0xa57447],
  mahogany: [0x3a1c14, 0x4d2619, 0x613120, 0x783e29, 0x8f4f36],
  oak: [0x80592f, 0x956b3d, 0xab7f4b, 0xc0945c],
  brass: [0x8f6616, 0xb88822, 0xdcae38, 0xf4d672],
  iron: 0x2a2e36, ironLight: 0x474d58,
  sky: 0x9fcfe2, skyLight: 0xe2f2f4,
  glass: 0xffdf9a, shade: 0x2f8a5c,
  skin: 0xe6b58c, hair: 0x8c8a86,
  // one colour per company, as the index tabs of a ledger are coloured. Red is never one of them.
  tabs: [0x2f5fa8, 0x7a4b8c, 0xd98a2b, 0x2a8f7c, 0x8a6a3a, 0x4a7f3a],
};

export const ROOM = {
  W: 98, D: 58, H: 40,
  scale: [44, 1, 30],
  desk: [1, 1, 20], clerkStands: [27, 1, 40],
  tray: [1, 1, 42], slot: [0, 23, 48],
  owner: [68, 1, 44],
  holes: [50, 1, 0], drawers: [81, 1, 0],
  lectern: [1, 1, 4], clock: [0, 30, 9], calendar: [0, 19, 23],
};

const tone = (colors, x, y, z, bias = 1.5) => colors[Math.min(colors.length - 1, Math.floor(hash3(x, y, z) ** bias * colors.length))];
// Wood: mostly one tone, with the odd lighter or darker streak five voxels long along the grain.
const grain = (ramp, mid = 2, axis = "x") => (x, y, z) => {
  const h = axis === "x" ? hash3(Math.floor(x / 5), y, z) : axis === "z" ? hash3(x, y, Math.floor(z / 5)) : hash3(x, Math.floor(y / 5), z);
  return ramp[Math.max(0, Math.min(ramp.length - 1, mid + (h > 0.8 ? 1 : h < 0.14 ? -1 : 0)))];
};
const wood = (ramp) => grain(ramp, Math.min(2, ramp.length - 2), "y");
const M = C.mahogany;
const brass = (x, y, z) => (hash3(x, y, z) > 0.72 ? C.brass[3] : hash3(x + 3, y, z) > 0.75 ? C.brass[1] : C.brass[2]);

// —— the room: a floor, two walls cut off clean at the top, a window, and what hangs on the walls
export function room() {
  const v = new Voxels({ jitter: 0.03 });
  const { W, D, H } = ROOM;

  // floorboards run along x, three voxels wide, with staggered ends
  v.box(0, -2, 0, W, 0, D, (x, y, z) => {
    if (y < 0) return y === -1 ? C.mahogany[1] : C.mahogany[0];
    const row = Math.floor(z / 3);
    const board = Math.floor((x + row * 11) / 17);
    const joint = z % 3 === 0 || (x + row * 11) % 17 === 0;
    const t = C.floor[Math.floor(hash3(board, 2, row) * C.floor.length)];
    return soft(joint ? mix(t, 0x000000, 0.2) : t);
  });

  // a wall, by how far along it you are and how high: skirting, panelled wainscot, a rail, plaster, a picture rail
  const wall = (a, y) => {
    if (y <= 0) return C.mahogany[0];
    if (y <= 2) return C.mahogany[2];
    if (y <= 13) {
      const p = ((a % 10) + 10) % 10;
      if (p === 0 || y === 3 || y === 13) return C.green[0];
      const groove = ((p === 2 || p === 8) && y >= 5 && y <= 11) || ((y === 5 || y === 11) && p >= 2 && p <= 8);
      return groove ? C.green[0] : hash3(a, y, 4) > 0.8 ? C.green[2] : C.green[1];
    }
    if (y === 14) return C.oak[2];
    if (y === H - 5) return C.oak[1];
    return tone(C.plaster, a, y, 7, 1.2);
  };
  v.box(-2, -2, -2, W, H, -1, (x, y) => (y === H || x === W ? C.ink : wall(x, y)));
  v.box(-2, -2, -2, -1, H, D, (x, y, z) => (y === H || z === D ? C.ink : wall(z, y)));

  // the window, in the long wall: sky, a cloud, a cross of glazing bars, a sill
  const [wx0, wx1, wy0, wy1] = [6, 28, 16, 34];
  v.carve(wx0, wy0, -1, wx1, wy1, -1);
  v.box(wx0, wy0, -2, wx1, wy1, -2, (x, y) => {
    const cloud = ((x - 12) / 5) ** 2 + ((y - 21) / 1.8) ** 2 < 1 || ((x - 23) / 4) ** 2 + ((y - 23) / 1.6) ** 2 < 1;
    return nocast(soft(cloud ? 0xffffff : mix(C.sky, C.skyLight, (y - wy0) / (wy1 - wy0) * 0.5)));
  });
  for (const x of [wx0, 17, wx1]) v.box(x, wy0, -1, x, wy1, -1, C.cream);
  for (const y of [wy0, 25, wy1]) v.box(wx0, y, -1, wx1, y, -1, C.cream);
  v.box(wx0 - 1, wy0 - 1, -1, wx1 + 1, wy0 - 1, 0, C.oak[2]);
  // a blind, a third of the way down, the colour of the ledger
  v.box(wx0 + 1, wy1 - 5, -1, wx1 - 1, wy1 - 1, -1, (x, y) => (y === wy1 - 5 ? C.oak[1] : C.pageLine));

  // two wall lights on the long wall, either side of the pigeonholes
  for (const x of [47, 79]) {
    v.box(x, 27, 0, x, 28, 0, C.brass[1]).set(x, 28, 1, C.brass[2]);
    v.box(x, 29, 1, x, 31, 1, lamp(C.glass));
  }

  // the house rules, framed, over the drawers
  v.box(33, 23, 0, 43, 34, 0, (x, y) => {
    if (x === 33 || x === 43 || y === 23 || y === 34) return C.oak[1];
    if (y === 32 && x >= 35 && x <= 41) return C.ink;
    if (y <= 30 && y >= 26 && y % 2 === 0 && x >= 35 && x <= 41 - (y % 4)) return C.inkSoft;
    return C.cream;
  });
  v.set(41, 25, 0, C.red);

  // the letter slot, in the side wall: a brass plate with a dark mouth
  const [, sy, sz] = ROOM.slot;
  v.box(0, sy - 1, sz - 4, 0, sy + 2, sz + 4, (x, y, z) => (y === sy || y === sy + 1 ? (z > sz - 4 && z < sz + 4 ? 0x15110f : C.brass[1]) : brass(x, y, z)));
  return v;
}

// —— the wall clock (side wall). It shows the time you give it.
export function clock(hours = 10, minutes = 10) {
  const v = new Voxels({ jitter: 0 });
  v.tube(0, 0, 0, 6.4, 1, (x, y, z) => (y * y + z * z > 29 ? M[2] : C.cream), { axis: "x" });
  for (let k = 0; k < 12; k += 1) {
    const a = (k / 12) * Math.PI * 2;
    v.set(0, Math.round(Math.cos(a) * 4.5), Math.round(Math.sin(a) * 4.5), k % 3 === 0 ? C.ink : C.creamShade);
  }
  // hands: z runs to the viewer's left on this wall, so clockwise is toward −z
  const hand = (turns, length, colour) => {
    const a = turns * Math.PI * 2;
    v.limb(1, 0, 0, 1, Math.cos(a) * length, -Math.sin(a) * length, 0.5, 0.5, colour);
  };
  hand(((hours % 12) + minutes / 60) / 12, 2.4, C.ink);
  hand(minutes / 60, 4, C.inkSoft);
  v.set(1, 0, 0, C.red);
  return v;
}

// —— the calendar (side wall): a red band, and today's number in ink
const DIGITS = {
  0: ["###", "#.#", "#.#", "#.#", "###"], 1: [".#.", "##.", ".#.", ".#.", "###"], 2: ["###", "..#", "###", "#..", "###"],
  3: ["###", "..#", ".##", "..#", "###"], 4: ["#.#", "#.#", "###", "..#", "..#"], 5: ["###", "#..", "###", "..#", "###"],
  6: ["###", "#..", "###", "#.#", "###"], 7: ["###", "..#", ".#.", ".#.", ".#."], 8: ["###", "#.#", "###", "#.#", "###"],
  9: ["###", "#.#", "###", "..#", "###"],
};
export function calendar(day = 10) {
  const v = new Voxels({ jitter: 0 });
  // z runs right to left on this wall, so draw mirrored: column 0 is the highest z
  v.box(0, 0, 0, 0, 12, 10, (x, y) => (y >= 10 ? C.red : y === 0 ? C.creamShade : C.cream));
  v.set(0, 12, 2, C.iron).set(0, 12, 8, C.iron);
  const text = String(day).padStart(2, "0");
  [...text].forEach((ch, i) => {
    DIGITS[ch].forEach((row, r) => [...row].forEach((bit, c) => {
      if (bit === "#") v.set(0, 7 - r, 9 - (i * 4 + c + 1), C.ink);
    }));
  });
  return v;
}

// —— the pigeonholes (long wall). holes: [{ papers, owes, tab }] fills from the top row, left to right.
export function pigeonholes(holes = []) {
  const v = new Voxels({ jitter: 0.03 });
  const W = 26, H = 27, Dp = 4;
  v.box(0, 0, 0, W, H, Dp, (x, y, z) => (y === H || y === 0 ? M[1] : (x - 1) % 6 === 0 || (y - 6) % 5 === 0 ? M[2] : grain(M, 3, "y")(x, y, z)));
  v.box(-1, H, 0, W + 1, H, Dp + 1, C.mahogany[1]);
  // the cupboard underneath: two doors with brass knobs
  v.box(1, 1, Dp, W - 1, 5, Dp, (x, y) => (x === 13 || y === 1 || y === 5 || x === 1 || x === W - 1 ? C.mahogany[0] : C.mahogany[3]));
  v.set(11, 3, Dp + 1, C.brass[2]).set(15, 3, Dp + 1, C.brass[2]);
  let n = 0;
  for (let r = 3; r >= 0; r -= 1)
    for (let c = 0; c < 4; c += 1) {
      const x0 = 2 + c * 6, y0 = 7 + r * 5;
      v.carve(x0, y0, 2, x0 + 4, y0 + 3, Dp);
      v.box(x0, y0, 1, x0 + 4, y0 + 3, 1, 0x21100b);
      const hole = holes[n];
      n += 1;
      if (!hole) continue;
      const tall = Math.max(1, Math.min(3, Math.ceil(hole.papers / 2)));
      v.box(x0, y0, 2, x0 + 4, y0 + tall - 1, Dp, (x, y, z) => (z === Dp && x === x0 + 1 ? hole.tab : (y + x) % 2 ? C.cream : C.creamShade));
      v.box(x0 + 1, y0 - 1, Dp, x0 + 3, y0 - 1, Dp, C.brass[2]);       // the name plate
      if (hole.owes) v.box(x0 + 4, y0 + 2, Dp + 1, x0 + 4, y0 + 3, Dp + 1, C.red);   // the flag
    }
  return v;
}

// —— the paper drawers (long wall): six, one per kind of paper. `open` pulls one out.
export function drawers(open = -1) {
  const v = new Voxels({ jitter: 0.03 });
  const W = 16, H = 17, Dp = 5;
  v.box(0, 0, 0, W, H, Dp, (x, y, z) => (y === H ? M[1] : grain(M, 2, "y")(x, y, z)));
  v.box(-1, H, 0, W + 1, H, Dp + 1, C.mahogany[1]);
  let n = 0;
  for (let r = 2; r >= 0; r -= 1)
    for (let c = 0; c < 2; c += 1) {
      const x0 = 1 + c * 8, y0 = 2 + r * 5, out = n === open ? 4 : 0;
      n += 1;
      const front = (x, y) => {
        if (y === y0 + 2 && x >= x0 + 2 && x <= x0 + 4) return C.cream;                 // the label
        if (y === y0 + 2 && (x === x0 + 1 || x === x0 + 5)) return C.brass[1];
        if (y === y0 && x === x0 + 3) return C.brass[2];                                 // the pull
        return x === x0 || x === x0 + 6 || y === y0 || y === y0 + 3 ? C.mahogany[2] : C.mahogany[4];
      };
      if (out) {
        v.box(x0, y0, Dp + 1, x0 + 6, y0 + 3, Dp + out, (x, y, z) => (z === Dp + out ? front(x, y) : y === y0 + 3 ? (x % 2 ? C.cream : C.creamShade) : C.mahogany[2]));
        v.box(x0 + 1, y0 + 4, Dp + 1, x0 + 5, y0 + 4, Dp + out - 1, (x) => (x % 2 ? C.page : C.cream));
      } else v.box(x0, y0, Dp, x0 + 6, y0 + 3, Dp, (x, y) => front(x, y));
    }
  return v;
}

// —— the scale. The table and column hold still; the beam is its own model so it can swing.
export const SCALE = { L: 12, Y: 37, drop: 13, pan: 5.6 };
export function scaleStand() {
  const v = new Voxels({ jitter: 0.025 });
  v.tube(0, 0, 0, 5.2, 1, M[1]);
  v.limb(0, 1, 0, 0, 5, 0, 2.2, 1.6, grain(M, 2, "y"));
  v.tube(0, 6, 0, 10.4, 2, (x, y, z) => (y === 7 && x * x + z * z < 84 ? soft(hash3(x, 1, z) > 0.82 ? C.baizeLight : C.baize) : M[2]));
  v.tube(0, 8, 0, 4.4, 1, M[3]);
  v.tube(0, 9, 0, 3.2, 1, brass);
  v.tube(0, 10, 0, 2.2, 1, C.brass[1]);
  v.limb(0, 11, 0, 0, SCALE.Y, 0, 1.5, 1.1, brass);
  v.tube(0, 22, 0, 2.2, 1, C.brass[1]);
  v.blob(0, SCALE.Y + 2.5, 0, 2, 2, 2, brass);
  return v;
}

/**
 * The beam, the chains, the pans and what is on them.
 * tilt: −4…4, positive when the promises outweigh the credits (the left pan drops).
 * slips: one colour per promise still on the pan. coins: 0…1, how much of what was promised has come in.
 */
export function scaleBeam({ tilt = 0, slips = [], coins = 0 } = {}) {
  const v = new Voxels({ jitter: 0.02 });
  const { L, Y, drop, pan } = SCALE;
  // the beam runs corner to corner of the grid, so on screen it lies level; two voxels fill each step
  for (let i = -L - 1; i <= L + 1; i += 1) {
    const y = Y + Math.round((tilt * i) / L);
    for (const dz of [0, 1]) v.box(i, y - 1, -i + dz, i, y, -i + dz, (x, yy) => (yy === y ? C.brass[3] : C.brass[2]));
  }
  v.blob(0, Y, 0, 2, 2, 2, C.brass[1]);
  for (const s of [-1, 1]) {
    const ex = s * L, ey = Y + s * tilt, ez = -s * L, py = ey - drop;
    v.blob(ex, ey, ez, 1.3, 1.3, 1.3, C.brass[1]);
    // three chains: every other link drawn, so they read as chain and not as a cone
    for (const [dx, dz] of [[-4, 1], [4, -1], [1, 4], [-1, -4]]) {
      const steps = drop - 2;
      for (let k = 0; k <= steps; k += 1) {
        if (k % 2) continue;
        const t = k / steps;
        v.set(Math.round(ex + dx * t), Math.round(ey - 1 - (drop - 2) * t), Math.round(ez + dz * t), C.brass[0]);
      }
    }
    v.tube(ex, py, ez, pan, 1, brass);
    v.tube(ex, py + 1, ez, pan, 1, C.brass[1], { inner: pan - 0.7 });
    if (s === -1) {
      // the promises: slips fanned out so every company's colour shows along one edge
      slips.slice(0, 7).forEach((tab, i) => {
        const x1 = ex + 3 - i, x0 = x1 - 6;
        v.box(x0, py + 1 + i, ez - 2, x1, py + 1 + i, ez + 2, (x, y, z) => (x === x1 ? tab : z === ez && x > x0 && x < x1 - 1 ? C.inkSoft : i % 2 ? C.creamShade : C.cream));
      });
    } else if (coins > 0) {
      // the credits: coins, stacked
      const total = Math.max(2, Math.round(coins * 22));
      const stacks = [[-1, 2, Math.ceil(total * 0.45)], [2, -1, Math.round(total * 0.33)], [-2, -2, Math.floor(total * 0.22)]];
      for (const [dx, dz, h] of stacks) if (h > 0) v.tube(ex + dx, py + 1, ez + dz, 1.6, h, (x, y) => (y % 2 ? C.brass[3] : C.brass[0]));
    }
  }
  return v;
}

// —— the clerk's desk, against the side wall: the book open on it, a spike, an inkwell, a lamp
export function desk({ paid = 0 } = {}) {
  const v = new Voxels({ jitter: 0.03 });
  const Dp = 9, W = 17, T = 10;                        // depth along x, width along z
  for (const [x, z] of [[0, 0], [Dp, 0], [0, W], [Dp, W]]) v.box(x, 0, z, x, T - 2, z, C.oak[0]);
  v.box(Dp, 3, 0, Dp, 3, W, C.oak[0]);
  v.box(-1, T - 1, -1, Dp + 1, T, W + 1, (x, y, z) => (y === T ? grain(C.oak, 2, "z")(x, 0, z) : C.oak[0]));
  // the book: navy boards, pale green pages ruled darker, one red rule down each page, a red ribbon
  v.box(1, T + 1, 2, 8, T + 1, 15, C.ink);
  v.box(2, T + 2, 3, 7, T + 2, 14, (x, y, z) => {
    if (z === 8 || z === 9) return C.pageLine;
    if (z === 5 || z === 12) return 0xe3aa9b;
    return x % 2 ? C.page : mix(C.page, C.pageLine, 0.5);
  });
  v.box(8, T + 2, 9, 10, T + 2, 9, C.red);
  // the spike, with a slip for each promise paid in full
  v.set(8, T + 1, 17, C.iron).box(8, T + 2, 17, 8, T + 7, 17, C.ironLight);
  for (let i = 0; i < Math.min(4, paid); i += 1) v.box(7, T + 2 + i, 16, 9, T + 2 + i, 18, i % 2 ? C.cream : C.creamShade);
  // inkwell and a quill
  v.box(7, T + 1, 0, 8, T + 2, 1, (x, y) => (y === T + 2 ? C.brass[2] : C.ink));
  v.limb(7, T + 3, 1, 5, T + 7, 2, 0.4, 0.4, C.cream);
  // a lamp on a brass arm at the back, with a green glass shade
  v.box(0, T + 1, 16, 0, T + 7, 16, C.brass[1]);
  v.box(0, T + 8, 14, 2, T + 8, 17, lamp(0x8fe0a8));
  v.box(0, T + 9, 14, 2, T + 9, 17, C.shade);
  return v;
}
export const DESK_LAMP = [3, 17, 15];

// —— the tray table (side wall, under the slot): one brass tray with what just came in
export function trayTable(waiting = 0) {
  const v = new Voxels({ jitter: 0.03 });
  for (const [x, z] of [[0, 0], [8, 0], [0, 12], [8, 12]]) v.box(x, 0, z, x, 6, z, M[1]);
  v.box(-1, 7, -1, 9, 8, 13, (x, y, z) => (y === 8 ? grain(M, 3, "z")(x, 0, z) : M[1]));
  v.box(1, 9, 1, 7, 9, 11, (x, y, z) => ((x + z) % 2 ? C.brass[1] : C.brass[0]));
  v.box(1, 10, 1, 7, 10, 11, (x, y, z) => (x === 1 || x === 7 || z === 1 || z === 11 ? C.brass[2] : null));
  for (let i = 0; i < Math.min(4, waiting); i += 1)
    v.box(2 + (i % 2), 10 + i, 2, 6, 10 + i, 10 - (i % 2), (x, y, z) => (i === Math.min(4, waiting) - 1 && x % 2 && z > 3 && z < 9 ? C.inkSoft : i % 2 ? C.creamShade : C.cream));
  return v;
}

// —— your desk: a blotter, what is waiting for your say-so, the pen. The chair is empty; it is yours.
export function ownerDesk(waiting = 0) {
  const v = new Voxels({ jitter: 0.03 });
  const W = 20, Dp = 10, T = 9;
  // two pedestals of drawers and a kneehole
  for (const x0 of [0, W - 5]) {
    v.box(x0, 0, 0, x0 + 5, T - 1, Dp, (x, y, z) => {
      if (z === Dp && x > x0 && x < x0 + 5 && (y === 3 || y === 6)) return C.mahogany[0];
      if (z === Dp && x === x0 + 3 && (y === 2 || y === 5 || y === 8)) return C.brass[2];
      return grain(M, 2, "y")(x, y, z);
    });
  }
  v.box(-1, T, -1, W + 1, T + 1, Dp + 1, (x, y, z) => (y === T + 1 ? grain(M, 3, "x")(x, 0, z) : M[0]));
  // the blotter: green leather with a dark edge
  v.box(4, T + 2, 2, 15, T + 2, 8, (x, y, z) => soft(x === 4 || x === 15 || z === 2 || z === 8 ? C.baizeDeep : C.baize));
  // what is waiting, squared up on the blotter with a red tab on each
  for (let i = 0; i < Math.min(5, waiting); i += 1)
    v.box(6, T + 3 + i, 3, 11, T + 3 + i, 7, (x, y, z) => (x === 11 && z === 4 + (i % 3) ? C.red : z === 5 && x < 10 && i === Math.min(5, waiting) - 1 ? C.inkSoft : i % 2 ? C.creamShade : C.cream));
  // the pen in its stand
  v.box(17, T + 2, 7, 18, T + 2, 8, C.brass[1]);
  v.limb(17.5, T + 3, 7.5, 16, T + 7, 6, 0.4, 0.4, C.ink);
  // a banker's lamp
  v.box(17, T + 2, 1, 19, T + 2, 2, C.brass[1]).box(18, T + 3, 1, 18, T + 6, 1, C.brass[2]);
  v.box(15, T + 7, 1, 19, T + 7, 3, lamp(0x8fe0a8));
  v.box(15, T + 8, 1, 19, T + 8, 3, C.shade);
  // the chair, behind the desk, facing you
  v.box(7, 0, -6, 7, 4, -6, C.mahogany[0]).box(12, 0, -6, 12, 4, -6, C.mahogany[0]).box(7, 0, -3, 7, 4, -3, C.mahogany[0]).box(12, 0, -3, 12, 4, -3, C.mahogany[0]);
  v.box(7, 5, -6, 12, 5, -3, soft(C.baize));
  v.box(7, 6, -6, 12, 14, -6, (x, y) => (y === 14 || x === 7 || x === 12 ? C.mahogany[1] : soft(C.baizeDeep)));
  return v;
}
export const OWNER_LAMP = [17, 16, 3];

// —— the day book, on a stand under the clock (side wall)
export function lectern() {
  const v = new Voxels({ jitter: 0.03 });
  v.box(1, 0, 1, 5, 1, 9, C.oak[0]);
  v.box(2, 2, 4, 4, 9, 6, wood(C.oak));
  v.box(0, 10, 0, 6, 10, 10, wood(C.oak));
  v.box(1, 11, 1, 5, 11, 9, C.red === 0 ? null : C.inkSoft);
  v.box(1, 12, 2, 5, 12, 8, (x, y, z) => (z === 5 ? C.creamShade : x % 2 ? C.cream : mix(C.cream, C.inkSoft, 0.18)));
  v.box(6, 12, 5, 7, 12, 5, C.red);
  return v;
}

// —— the clerk. Green eyeshade, navy waistcoat, sleeves held up with brass bands.
// step: "stand" | "left" | "right". carry: null | "paper" | "coin".
export function clerk(step = "stand", carry = null) {
  const v = new Voxels({ jitter: 0.03 });
  const swing = step === "left" ? 1 : step === "right" ? -1 : 0;
  const trousers = 0x4a4038, shirt = C.cream, vest = C.ink;
  for (const [x, s] of [[0, swing], [2, -swing]]) {
    v.box(x, 0, s, x, 0, 1 + s, 0x1a1512);
    v.box(x, 1, s, x, 3, 1 + s, trousers);
  }
  v.box(0, 4, 0, 2, 4, 1, trousers);
  v.box(0, 5, 0, 2, 8, 1, (x, y, z) => (z === 1 && x === 1 ? shirt : vest));
  v.set(1, 8, 1, C.red);                                   // a red bow tie, one voxel
  for (const [x, s] of [[-1, -swing], [3, swing]]) {
    if (carry && x === 3) continue;
    v.box(x, 6, s, x, 8, 1 + s, (px, y) => (y === 7 ? C.brass[2] : shirt));
    v.box(x, 5, s, x, 5, 1 + s, C.skin);
  }
  if (carry) {
    v.box(3, 7, 0, 3, 8, 1, shirt).box(3, 6, 1, 3, 6, 2, shirt).set(3, 6, 3, C.skin);
    if (carry === "paper") v.box(2, 7, 3, 5, 10, 3, (x, y) => (y === 10 ? C.creamShade : y % 2 && x > 2 && x < 5 ? C.inkSoft : C.cream));
    else v.tube(3, 7, 3, 1.3, 1, brass, { axis: "z" });
  }
  v.box(-1, 9, 0, 3, 12, 2, C.skin);
  v.set(0, 10, 2, C.ink).set(2, 10, 2, C.ink);
  v.box(-1, 13, 0, 3, 13, 2, C.hair).box(-1, 9, 0, 3, 12, 0, C.hair);
  v.box(-1, 11, 1, -1, 12, 1, C.hair).box(3, 11, 1, 3, 12, 1, C.hair);
  // the eyeshade: a band round the head and a green peak
  v.box(-1, 12, 2, 3, 12, 2, C.shade);
  v.box(-1, 12, 3, 3, 12, 4, nocast(C.shade));
  return v;
}
export const clerkFrames = (carry = null) => ({ stand: clerk("stand", carry), left: clerk("left", carry), right: clerk("right", carry) });

// —— a paper on its way down from the slot, and a rug
export function sheet() {
  const v = new Voxels({ jitter: 0 });
  v.box(0, 0, 0, 0, 5, 3, (x, y, z) => (y % 2 && z > 0 && z < 3 && y < 5 ? C.inkSoft : C.cream));
  return v;
}
export function rug() {
  const v = new Voxels({ jitter: 0.02 });
  v.tube(0, 0, 0, 15.4, 1, (x, y, z) => {
    const d = Math.hypot(x, z);
    return soft(d > 14.4 ? C.green[0] : d > 13 ? C.brass[1] : d > 12.2 ? C.green[0] : hash3(x, 0, z) > 0.82 ? C.green[2] : C.green[1]);
  });
  return v;
}

// —— a corner of the room, for a close-up: floorboards, and the panelled wall behind (and to the left)
// w along x, d along z, h tall. walls: "back" (along x), "left" (along z), or "both".
// The far edges end in a dark band, like the cut edge of a model, so it sits on any page.
export function corner({ w = 40, d = 26, h = 30, walls = "both", window: win = false } = {}) {
  const v = new Voxels({ jitter: 0.03 });
  v.box(0, -2, 0, w, 0, d, (x, y, z) => {
    if (y < 0) return y === -1 ? C.mahogany[1] : C.mahogany[0];
    const row = Math.floor(z / 3);
    const joint = z % 3 === 0 || (x + row * 11) % 17 === 0;
    const t = C.floor[Math.floor(hash3(Math.floor((x + row * 11) / 17), 2, row) * C.floor.length)];
    return soft(joint ? mix(t, 0x000000, 0.2) : t);
  });
  const wall = (a, y) => {
    if (y <= 0) return C.mahogany[0];
    if (y <= 2) return C.mahogany[2];
    if (y <= 13) {
      const p = ((a % 10) + 10) % 10;
      if (p === 0 || y === 3 || y === 13) return C.green[0];
      const groove = ((p === 2 || p === 8) && y >= 5 && y <= 11) || ((y === 5 || y === 11) && p >= 2 && p <= 8);
      return groove ? C.green[0] : hash3(a, y, 4) > 0.8 ? C.green[2] : C.green[1];
    }
    if (y === 14) return C.oak[2];
    if (y === h - 5) return C.oak[1];
    return tone(C.plaster, a, y, 7, 1.2);
  };
  if (walls === "back" || walls === "both") v.box(-2, -2, -2, w, h, -1, (x, y) => (y === h || x === w ? C.ink : wall(x, y)));
  if (walls === "left" || walls === "both") v.box(-2, -2, -2, -1, h, d, (x, y, z) => (y === h || z === d ? C.ink : wall(z, y)));
  if (win && (walls === "back" || walls === "both")) {
    const [wx0, wx1, wy0, wy1] = [Math.round(w * 0.55), Math.round(w * 0.55) + 12, 16, Math.min(h - 6, 30)];
    v.carve(wx0, wy0, -1, wx1, wy1, -1);
    v.box(wx0, wy0, -2, wx1, wy1, -2, (x, y) => nocast(soft(mix(C.sky, C.skyLight, ((y - wy0) / (wy1 - wy0)) * 0.5))));
    for (const x of [wx0, wx0 + 6, wx1]) v.box(x, wy0, -1, x, wy1, -1, C.cream);
    for (const y of [wy0, wy1]) v.box(wx0, y, -1, wx1, y, -1, C.cream);
  }
  return v;
}

// —— how far the beam tips, from the book's own totals
export const tiltFor = (promisedCents, owedCents) => (promisedCents > 0 ? Math.max(0, Math.min(4, Math.round((owedCents / promisedCents) * 4))) : 0);

/**
 * The still room. state:
 *   companies: [{ papers, owes }]  in the order the book lists them
 *   waiting: how many things wait for your say-so      inTray: papers not yet read
 *   paid: promises paid in full                        openDrawer: −1 or 0…5
 */
export function house(state = {}) {
  const { companies = [], waiting = 0, inTray = 0, paid = 0, openDrawer = -1 } = state;
  const R = ROOM;
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  return {
    turn: 0,
    instances: [
      { model: room(), at: [0, 0, 0], id: null },
      { model: rug(), at: [R.scale[0], 1, R.scale[2]], id: null },
      { model: pigeonholes(companies.map((c, i) => ({ ...c, tab: C.tabs[i % C.tabs.length] }))), at: R.holes, id: "companies" },
      { model: drawers(openDrawer), at: R.drawers, id: "papers" },
      { model: lectern(), at: R.lectern, id: "daybook" },
      { model: trayTable(inTray), at: R.tray, id: "tray" },
      { model: desk({ paid }), at: R.desk, id: "ious" },
      { model: ownerDesk(waiting), at: R.owner, id: "todo" },
      { model: scaleStand(), at: R.scale, id: "balance" },
    ],
    lamps: [
      { at: add(R.desk, DESK_LAMP), color: [0.75, 1, 0.8], radius: 16, power: 1.9 },
      { at: add(R.owner, OWNER_LAMP), color: [0.75, 1, 0.8], radius: 18, power: 2.1 },
      { at: [47, 30, 3], color: [1, 0.8, 0.5], radius: 30, power: 2.2 },
      { at: [79, 30, 3], color: [1, 0.8, 0.5], radius: 30, power: 2.2 },
      { at: [R.scale[0], 26, R.scale[2]], color: [1, 0.86, 0.6], radius: 26, power: 1.5 },
    ],
    center: [46, 12, 27],
  };
}

// For `craft render`: the demo book's room on an ordinary afternoon.
export default function preview() {
  const s = house({
    companies: [{ papers: 5, owes: true }, { papers: 4, owes: true }, { papers: 1, owes: false }, { papers: 1, owes: true }],
    waiting: 4, inTray: 2, paid: 0,
  });
  const R = ROOM;
  s.instances.push({ model: scaleBeam({ tilt: tiltFor(475000, 385000), slips: C.tabs.slice(0, 4), coins: 90000 / 475000 }), at: R.scale, id: "balance" });
  s.instances.push({ model: clock(5, 14), at: R.clock, id: "daybook" });
  s.instances.push({ model: calendar(10), at: R.calendar, id: null });
  s.instances.push({ model: clerk("left", "paper"), at: R.clerkStands, id: "clerk", pivot: [1.5, 0, 1], turn: 1 });
  s.background = C.paper;
  return s;
}
