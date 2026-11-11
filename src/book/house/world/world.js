// Truthful's quarter: where the agents keep the book.
//
// The work, in reading order (the top row runs left to right, the road turns
// down, the bottom row runs back):
//
//   the post          papers come in: a vendor's email, a contract, an invoice
//   the reading desk  the reader finds the promise or the credit in it and marks the figure
//   the book          the scribe writes the promise down as an IOU
//   the scale         the checker weighs every invoice against the promise; what is light is owed
//   the letter desk   the writer drafts the letter asking for the rest
//   your desk         the letter waits for you. Nothing goes out until you sign.
//
// West, across the stream, the vendors' houses: one per company, in its own colour.
// Their couriers bring papers to the post; Truthful's courier takes signed letters back.
// In the middle of the square, the clock: it rings when a promise runs late.
//
// Positions are given in screen terms, as Nomen lays out its camp: sx runs right
// across the screen, sy runs down it. at(sx, sy) turns them into ground x, z.
// One voxel is about 10 cm.

import { Voxels, soft, glow, lamp, nocast, fade, hash3, mix } from "../craft/voxel.js";
import { C as P, desk, scaleStand, scaleBeam, trayTable, ownerDesk, drawers, pigeonholes, lectern, clock } from "./props.js";

export const C = {
  ...P,
  paper: 0xeef0ed,            // the isokra page the quarter sits on
  stone: [0xc9c4b6, 0xd3cfc2, 0xdcd8cc, 0xe4e0d5],
  joint: 0xb5afa0,
  path: [0xd2c6ae, 0xdacfb9, 0xe1d8c4],
  grass: [0x8aa36c, 0x9cb47a, 0xb0c48c],
  water: [0x5b8fa8, 0x6d9fb6, 0x86b3c6, 0xa9cad6],
  roof: 0x7a3f2c,
  ink: 0x11161a,
  red: 0xc9361f,
};

/** Ground point under a screen offset: sx = x - z, sy = (x + z) / 2. */
export const at = (sx, sy) => [Math.round(sy + sx / 2), Math.round(sy - sx / 2)];

const COL = 92, ROW = 50;
export const STATIONS = [
  { id: "post", name: "The post", job: "Papers come in", page: "tray", sx: -COL, sy: -ROW, r: 24 },
  { id: "read", name: "The reading desk", job: "Finds the figure", page: "papers", sx: 0, sy: -ROW, r: 22 },
  { id: "book", name: "The book", job: "Writes the promise down", page: "ious", sx: COL, sy: -ROW, r: 24 },
  { id: "scale", name: "The scale", job: "Weighs invoices against promises", page: "balance", sx: COL, sy: ROW, r: 27 },
  { id: "letter", name: "The letter desk", job: "Asks for the rest", page: "todo", sx: 0, sy: ROW, r: 22 },
  { id: "you", name: "Your desk", job: "Nothing goes out until you sign", page: "todo", sx: -COL, sy: ROW, r: 24 },
];
export const STATION = Object.fromEntries(STATIONS.map((s) => [s.id, { ...s, at: at(s.sx, s.sy) }]));
export const CLOCK = { sx: 0, sy: 0 };
/** Street lamps along the roads, where they turn. */
export const LAMPS = [[-COL + 30, -ROW + 4], [COL - 30, -ROW + 4], [COL - 30, ROW - 4], [-COL + 30, ROW - 4]];
export const VENDOR_SX = -COL - 104;
export const vendorAt = (i, n = 4) => at(VENDOR_SX - (i % 2) * 16, -ROW * 1.1 + (i * (ROW * 2.2)) / Math.max(1, n - 1));
export const STREAM_SX = -COL - 52;

const tone = (ramp, x, y, z, bias = 1.4) => ramp[Math.min(ramp.length - 1, Math.floor(hash3(x, y, z) ** bias * ramp.length))];

// —— the ground: paved plots, earth roads between them, a stream to the west, grass at the edges
export function ground(vendors = 4) {
  const v = new Voxels({ jitter: 0.03 });
  const plots = [
    ...STATIONS.map((s) => ({ c: at(s.sx, s.sy), r: s.r, kind: "stone" })),
    { c: at(CLOCK.sx, CLOCK.sy), r: 12, kind: "stone" },
    ...Array.from({ length: vendors }, (_, i) => ({ c: vendorAt(i, vendors), r: 15, kind: "grass" })),
  ];
  // roads: the ring of stations, the clock to the ring, the post to every vendor
  const seg = [];
  const ring = ["post", "read", "book", "scale", "letter", "you", "post"];
  for (let i = 0; i < ring.length - 1; i += 1) seg.push([STATION[ring[i]].at, STATION[ring[i + 1]].at, 3.2]);
  seg.push([at(CLOCK.sx, CLOCK.sy), STATION.read.at, 2.2], [at(CLOCK.sx, CLOCK.sy), STATION.letter.at, 2.2]);
  for (let i = 0; i < vendors; i += 1) seg.push([vendorAt(i, vendors), STATION.post.at, 2.6]);
  const toSeg = (x, z, [a, b]) => {
    const dx = b[0] - a[0], dz = b[1] - a[1], L = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / L));
    return Math.hypot(x - (a[0] + dx * t), z - (a[1] + dz * t));
  };
  // the stream runs front to back, west of the post; a footbridge carries every vendor road over it
  // it rises and runs out within the quarter's height, so the picture is no taller than the plots
  const STREAM_TOP = -92, STREAM_END = 82;
  const stream = (x, z) => {
    const sy = (x + z) / 2;
    if (sy < STREAM_TOP || sy > STREAM_END) return Infinity;
    const taper = Math.min(sy - STREAM_TOP, STREAM_END - sy) < 10 ? 3 : 0;   // narrower where it starts and ends
    return Math.abs((x - z) - STREAM_SX - Math.sin((x + z) * 0.05) * 6) + taper;
  };
  const xs = plots.flatMap((p) => [p.c[0] - p.r - 14, p.c[0] + p.r + 14]), zs = plots.flatMap((p) => [p.c[1] - p.r - 14, p.c[1] + p.r + 14]);
  const [x0, x1, z0, z1] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
  v.terrain(x0, z0, x1, z1, (x, z) => {
    let best = Infinity, kind = null;
    for (const p of plots) {
      const wob = (hash3(Math.floor(x / 3), 0, Math.floor(z / 3)) - 0.5) * 3;
      const d = Math.hypot(x - p.c[0], z - p.c[1]) - p.r + wob;
      if (d < best) { best = d; kind = p.kind; }
    }
    let road = Infinity;
    for (const s of seg) road = Math.min(road, toSeg(x, z, s) - s[2]);
    const w = stream(x, z);
    if (w < 7 && road > 0) return 0;                       // water sits a step down
    if (best < 0 || road < 0) return 1;
    if (best < 9 || road < 4) return 1;                    // a fringe of grass that thins into the page
    return null;
  }, (x, y, z) => {
    let best = Infinity, kind = "stone";
    for (const p of plots) {
      const wob = (hash3(Math.floor(x / 3), 0, Math.floor(z / 3)) - 0.5) * 3;
      const d = Math.hypot(x - p.c[0], z - p.c[1]) - p.r + wob;
      if (d < best) { best = d; kind = p.kind; }
    }
    let road = Infinity;
    for (const s of seg) road = Math.min(road, toSeg(x, z, s) - s[2]);
    const w = stream(x, z);
    if (y === 0 && w < 7) return soft(w < 2.5 ? C.water[0] : w < 4.5 ? C.water[1] : hash3(x, 1, z) > 0.6 ? C.water[2] : C.water[3]);
    if (w < 9.5 && road < 0) return C.oak[(x + z) % 3 === 0 ? 0 : 2];   // the footbridge's planks
    if (best < 0 && kind === "stone") {
      // flagstones, 4 by 4, with joints
      const joint = (x + 400) % 5 === 0 || (z + 400) % 5 === 0;
      return soft(joint ? C.joint : tone(C.stone, Math.floor(x / 5), 1, Math.floor(z / 5)));
    }
    if (road < 0) return soft(tone(C.path, x, 2, z, 1.2));
    // grass, thinning to nothing at the edge
    const edge = Math.min(best, road + 5);
    const f = Math.max(0, Math.min(1, edge / 9));
    const c = soft(tone(C.grass, x, 3, z, 1.1));
    return f > 0.15 ? fade(c, Math.min(7, Math.round(f * 7 + (hash3(x, 9, z) - 0.5) * 2.4))) : c;
  });
  return v;
}

// —— a small tree, a hedge tuft
export function tree(seed = 1, h = 12) {
  const v = new Voxels({ jitter: 0.04 });
  v.limb(0, 0, 0, 0, h * 0.55, 0, 1.3, 0.8, (x, y, z) => (hash3(x, y, z) > 0.5 ? 0x6b4a2e : 0x7d5836));
  v.blob(0, h * 0.75, 0, 5.2, 4.4, 5.2, (x, y, z) => soft(C.grass[Math.min(2, Math.floor(hash3(x + seed, y, z) * 2.2 + (y - h * 0.6) / 8))]) , { fill: 0.8, seed });
  return v;
}

// —— a vendor's house: whitewashed walls, a roof in the company's colour, a door, a sign
export function vendorHouse(color = 0x2f5fa8, seed = 1) {
  const v = new Voxels({ jitter: 0.03 });
  const W = 14, D = 12, H = 9;
  v.box(0, 1, 0, W, H, D, (x, y, z) => (hash3(x, y, z + seed) > 0.88 ? 0xe9e4d6 : 0xf2eee3));
  v.box(0, 0, 0, W, 0, D, 0xb9b2a2);
  // a pitched roof, ridge along x
  for (let i = 0; i <= D / 2 + 1; i += 1) {
    v.box(-1, H + 1 + i, -1 + i, W + 1, H + 1 + i, -1 + i, (x) => (x % 3 === 0 ? mix(color, 0x000000, 0.18) : color));
    v.box(-1, H + 1 + i, D + 1 - i, W + 1, H + 1 + i, D + 1 - i, (x) => (x % 3 === 0 ? mix(color, 0x000000, 0.25) : mix(color, 0x000000, 0.08)));
  }
  for (let i = 0; i <= D / 2; i += 1) v.box(0, H + 1 + i, i, 0, H + 1 + i, D - i, 0xf2eee3).box(W, H + 1 + i, i, W, H + 1 + i, D - i, 0xf2eee3);
  // the door faces +x (toward the stream and the post), with a step
  v.carve(W, 1, 5, W, 6, 7);
  v.box(W - 1, 1, 5, W - 1, 6, 7, mix(color, 0x000000, 0.35));
  v.box(W + 1, 0, 4, W + 2, 0, 8, 0xb9b2a2);
  // windows, lit after dark
  for (const z of [2, 10]) v.box(W, 4, z - 1, W, 6, z, lamp(0xffd98a));
  for (const x of [3, 10]) v.box(x - 1, 4, D, x + 1, 6, D, lamp(0xffd98a));
  // a sign board on a post by the door: the company's colour band
  v.box(W + 4, 0, 10, W + 4, 6, 10, 0x6b4a2e);
  v.box(W + 4, 6, 8, W + 4, 9, 13, (x, y, z) => (y === 9 ? color : 0xf6f1e2));
  return v;
}

// —— the post: a little post office open at the front. Red tile roof, the pigeonholes on its back wall,
// a counter with the tray where papers land, and a red post box at the road's end.
export function post(waiting = 0) {
  const v = new Voxels({ jitter: 0.03 });
  const plaster = (x, y, z) => (y <= 2 ? 0xb8553d : hash3(x, y, z) > 0.88 ? 0xe9e4d6 : 0xf2eee3);
  v.box(-15, 1, -12, 15, 16, -11, plaster);                     // back wall
  v.box(-15, 1, -12, -14, 16, 6, plaster);                      // side walls
  v.box(14, 1, -12, 15, 16, 6, plaster);
  v.box(-14, 0, -11, 14, 0, 6, 0xc9b38f);                       // a wooden floor
  // the roof: tiles stepping down to the front
  for (let i = 0; i < 10; i += 1) v.box(-17, 17 + Math.floor((9 - i) / 2), -14 + i * 2, 17, 17 + Math.floor((9 - i) / 2), -13 + i * 2, (x) => ((x + i) % 3 === 0 ? 0x8e3b25 : 0xa9472c));
  v.box(-16, 16, 6, 16, 16, 7, 0x8e3b25);
  // a low sorting rack on the back wall: one hole per company, papers in them
  v.box(-12, 1, -10, 12, 12, -8, (x, y, z) => (y === 12 || y === 1 ? C.mahogany[1] : C.mahogany[2]));
  for (let c = 0; c < 4; c += 1) for (let r = 0; r < 2; r += 1) {
    const x0 = -10 + c * 6, y0 = 3 + r * 4;
    v.carve(x0, y0, -8, x0 + 4, y0 + 2, -8);
    v.box(x0, y0, -9, x0 + 4, y0 + 2, -9, 0x21100b);
    if ((c + r) % 2 === 0) v.box(x0, y0, -8, x0 + 4, y0, -8, (x) => (x === x0 + 1 ? C.tabs[c] : 0xf6f1e2));
  }
  // the counter, with the brass tray on it
  v.box(-9, 1, 3, 9, 6, 5, (x, y, z) => (y === 6 ? C.oak[2] : x % 4 === 0 ? C.oak[0] : C.oak[1]));
  v.box(2, 7, 3, 8, 7, 5, (x, y, z) => (x === 2 || x === 8 ? C.brass[2] : C.brass[1]));
  for (let i = 0; i < Math.min(4, waiting); i += 1) v.box(3, 8 + i, 3, 7, 8 + i, 5, i % 2 ? 0xe9e1cc : 0xfbfaf4);
  // a red post box on its post, by the road
  v.box(-20, 0, 9, -20, 8, 9, 0x3a3a3a);
  v.box(-22, 8, 7, -18, 13, 11, (x, y, z) => (y === 13 ? mix(C.red, 0x000000, 0.25) : y === 11 && x === -18 && z >= 8 && z <= 10 ? 0x15110f : C.red));
  return v;
}

// —— the reading desk: a lean-to shed with a slate roof over the drawers of papers read,
// the lectern in front where the reader works, a lens on a stand.
export function readingDesk() {
  const v = new Voxels({ jitter: 0.03 });
  const board = (x, y, z) => ((x + 20) % 3 === 0 ? 0x6b5a48 : 0x7d6a55);
  v.box(-14, 1, -12, 12, 15, -11, board);
  v.box(-14, 1, -12, -13, 15, -7, board);
  for (let i = 0; i < 4; i += 1) v.box(-16, 16 - i, -14 + i * 2, 14, 16 - i, -13 + i * 2, (x) => ((x + i) % 4 === 0 ? 0x4a5560 : 0x5c6873));
  v.stamp(drawers(1), -11, 1, -10);
  v.stamp(lectern(), 6, 0, -2);
  v.box(13, 0, 8, 13, 7, 8, C.brass[1]);
  v.tube(13, 8, 8, 2.2, 1, (x, y, z) => (x * x + z * z < 2 ? nocast(0xcfe6ee) : C.brass[2]));
  return v;
}

// —— the book: the high desk with the ledger open, under a small canopy
export function bookStand(paid = 0) {
  const v = new Voxels({ jitter: 0.03 });
  v.stamp(desk({ paid }), -5, 0, -9);
  // canopy on four posts
  for (const [x, z] of [[-9, -13], [14, -13], [-9, -3], [14, -3]]) v.box(x, 0, z, x, 22, z, C.oak[0]);
  v.box(-10, 23, -14, 15, 23, -2, (x, y, z) => ((x + 30) % 4 < 2 ? 0x2e5f43 : 0xf2eee3));
  v.box(-10, 22, -1, 15, 22, -1, (x, y, z) => ((x + 30) % 4 < 2 ? 0x2e5f43 : null));   // a scalloped front edge
  return v;
}

// —— the scale, as a built object (the beam is a separate model so it can swing)
export function scaleBase() { return scaleStand(); }
export { scaleBeam };

// —— the letter desk: a writing desk with envelopes and a candle
export function letterDesk(drafts = 0) {
  const v = new Voxels({ jitter: 0.03 });
  const T = 8;
  for (const [x, z] of [[0, 0], [14, 0], [0, 8], [14, 8]]) v.box(x, 0, z, x, T - 1, z, C.mahogany[1]);
  v.box(-1, T, -1, 15, T, 9, (x, y, z) => (hash3(x, 0, z) > 0.8 ? C.mahogany[3] : C.mahogany[2]));
  // envelopes in a rack, a sheet being written, the ink pot, a candle that lights at night
  for (let i = 0; i < 4; i += 1) v.box(1 + i, T + 1, 1, 1 + i, T + 4, 4, i % 2 ? 0xf6f1e2 : 0xe9e1cc);
  v.box(6, T + 1, 3, 11, T + 1, 7, (x, y, z) => (z === 5 && x < 10 ? C.inkSoft : 0xfbfaf4));
  if (drafts) v.box(6, T + 2, 3, 11, T + 2, 7, (x, y, z) => (x === 11 && z === 3 ? C.red : 0xfbfaf4));
  v.box(13, T + 1, 6, 14, T + 2, 7, C.ink);
  v.box(13, T + 1, 1, 13, T + 4, 1, 0xf6f1e2).set(13, T + 5, 1, glow(0xffc65a));
  // a stool
  v.box(6, 0, 11, 9, 4, 13, (x, y, z) => (y === 4 ? C.oak[2] : x === 6 || x === 9 ? C.oak[0] : null));
  // a parasol, cream and plum, so the desk can be told from across the square
  v.box(-3, 0, 4, -3, 21, 4, 0x6b4a2e);
  for (let k = 0; k < 3; k += 1) v.tube(-3, 21 + k, 4, 11 - k * 3.6, 1, (x, y, z) => {
    const a = Math.atan2(z - 4, x + 3);
    return Math.floor(((a + Math.PI) / (Math.PI * 2)) * 8) % 2 ? 0x6e4a7e : 0xf2eee3;
  });
  return v;
}

// —— your desk: the blotter, what waits for you, the pen, the empty chair
export function yourDesk(waiting = 0) {
  const v = new Voxels({ jitter: 0.03 });
  v.box(-6, 0, -10, 26, 0, 16, (x, y, z) => ((z + 40) % 3 === 0 ? C.oak[0] : C.oak[(x + z) % 5 === 0 ? 1 : 2]));
  v.box(0, 1, -2, 20, 1, 14, (x, y, z) => soft(x === 0 || x === 20 || z === -2 || z === 14 ? 0x7a3f2c : hash3(x, 1, z) > 0.8 ? 0x2e5f43 : 0x3f7a55));
  v.stamp(ownerDesk(waiting), 0, 1, 0);
  for (const [x, z] of [[-4, -8], [24, -8]]) {
    v.box(x - 1, 1, z - 1, x + 1, 3, z + 1, 0xb8553d);
    v.blob(x, 6, z, 2.4, 3.2, 2.4, (px, py, pz) => soft(C.grass[Math.floor(hash3(px, py, pz) * 3)]), { fill: 0.85 });
  }
  return v;
}

// —— the clock in the square: a post with a clock face both ways and a bell
export function clockPost(hours = 5, minutes = 10) {
  const v = new Voxels({ jitter: 0.02 });
  v.box(-1, 0, -1, 1, 0, 1, C.ink);
  v.box(0, 1, 0, 0, 22, 0, 0x2a2e36);
  v.box(-3, 22, -3, 3, 23, 3, 0x2a2e36);
  v.stamp(clock(hours, minutes), 1, 28, 0);
  v.stamp(clock(hours, minutes), -1, 28, 0, { turn: 2 });
  v.box(-2, 34, -2, 2, 34, 2, C.brass[1]);
  v.blob(0, 36, 0, 2, 2, 2, C.brass[2]);
  return v;
}

// —— a street lamp (lit after dark) and a bench, for the square
export function lampPost() {
  const v = new Voxels({ jitter: 0.02 });
  v.box(-1, 0, -1, 1, 0, 1, 0x2a2e36);
  v.box(0, 1, 0, 0, 15, 0, 0x2a2e36);
  v.box(-1, 16, -1, 1, 18, 1, (x, y, z) => (y === 18 ? 0x2a2e36 : lamp(0xffd98a)));
  return v;
}
export const LAMP_TOP = 17;
export function bench() {
  const v = new Voxels({ jitter: 0.03 });
  v.box(0, 0, 0, 0, 2, 0, 0x2a2e36).box(8, 0, 0, 8, 2, 0, 0x2a2e36).box(0, 0, 2, 0, 2, 2, 0x2a2e36).box(8, 0, 2, 8, 2, 2, 0x2a2e36);
  v.box(0, 3, 0, 8, 3, 2, (x) => (x % 2 ? C.oak[1] : C.oak[2]));
  v.box(0, 4, 0, 8, 6, 0, (x, y) => (y === 5 ? null : x % 2 ? C.oak[1] : C.oak[2]));
  return v;
}

// —— Truthful's agents. One figure, dressed for the job, with the thing they work with.
// look: { vest, hat, hatColor, hair, skin, carry, prop }  step: stand | left | right
export const AGENTS = {
  postmaster: { vest: 0x7a3f2c, hat: "cap", hatColor: 0x2a2e36, hair: 0x3a2a1e, skin: 0xe6b58c },
  reader: { vest: 0x3d5a80, hat: null, hair: 0x8c8a86, skin: 0xd9a37a, glasses: true },
  scribe: { vest: 0x11161a, hat: "shade", hatColor: 0x2f8a5c, hair: 0x5a3b26, skin: 0xe6b58c },
  checker: { vest: 0x6a5a2c, hat: null, hair: 0x1e1814, skin: 0xb07a52 },
  writer: { vest: 0x5b4a7a, hat: null, hair: 0xb9874f, skin: 0xf0c9a6, long: true },
  courier: { vest: 0x2a2e36, hat: "cap", hatColor: 0xc9361f, hair: 0x2a1d17, skin: 0xc98b62, bag: 0x8a5a36 },
};

export function agent(look = {}, step = "stand", carry = null) {
  const v = new Voxels({ jitter: 0.03 });
  const swing = step === "left" ? 1 : step === "right" ? -1 : 0;
  const { vest = 0x11161a, shirt = 0xf6f1e2, trousers = 0x3c3a36, skin = 0xe6b58c, hair = 0x3a2a1e, hat = null, hatColor = 0x2a2e36, glasses = false, long = false, bag = null } = look;
  for (const [x, s] of [[0, swing], [2, -swing]]) {
    v.box(x, 0, s, x, 0, 1 + s, 0x1a1512);
    v.box(x, 1, s, x, 3, 1 + s, trousers);
  }
  v.box(0, 4, 0, 2, 4, 1, trousers);
  v.box(0, 5, 0, 2, 8, 1, (x, y, z) => (z === 1 && x === 1 && y > 6 ? shirt : vest));
  for (const [x, s] of [[-1, -swing], [3, swing]]) {
    if (carry && x === 3) continue;
    v.box(x, 6, s, x, 8, 1 + s, vest);
    v.box(x, 5, s, x, 5, 1 + s, skin);
  }
  if (carry) {
    // the right arm held forward, the thing held clear of the body, in colours the body does not have
    v.box(3, 7, 0, 3, 8, 1, vest).box(3, 6, 1, 3, 6, 2, vest).set(3, 6, 3, skin);
    if (carry === "paper") v.box(2, 6, 3, 5, 10, 3, (x, y) => (y === 10 ? 0xe9e1cc : y % 2 && x > 2 && x < 5 ? 0x3c4868 : 0xfbfaf4));
    else if (carry === "invoice") v.box(2, 6, 3, 5, 10, 3, (x, y) => (y === 10 ? 0x9fb6c9 : y % 2 && x > 2 && x < 5 ? 0x3c4868 : 0xeef4f8));
    else if (carry === "letter") v.box(2, 6, 3, 5, 9, 3, (x, y) => (x === 3 && y === 7 ? C.red : y === 9 ? 0xe9e1cc : 0xf6f1e2));
    else if (carry === "coin") v.tube(3, 7, 3, 1.4, 1, (x, y, z) => (x === 0 && z === 0 ? C.brass[3] : C.brass[1]), { axis: "z" });
    else if (carry === "quill") v.limb(3, 6, 3, 4, 11, 2, 0.4, 0.4, 0xfbfaf4);
  }
  if (bag) v.box(-2, 3, 0, -2, 5, 1, bag).set(-2, 6, 0, mix(bag, 0x000000, 0.3));
  // head
  v.box(-1, 9, 0, 3, 12, 2, skin);
  v.set(0, 10, 2, 0x11161a).set(2, 10, 2, 0x11161a);
  if (glasses) v.box(-1, 10, 3, 3, 10, 3, (x) => (x === 1 ? null : x === -1 || x === 3 ? 0x2a2e36 : nocast(0xcfe6ee)));
  v.box(-1, 13, 0, 3, 13, 2, hair).box(-1, 9, 0, 3, 12, 0, hair);
  v.box(-1, 11, 1, -1, 12, 1, hair).box(3, 11, 1, 3, 12, 1, hair);
  if (long) v.box(-1, 6, -1, 3, 9, -1, hair);
  if (hat === "cap") { v.box(-1, 13, 0, 3, 14, 2, hatColor); v.box(-1, 13, 3, 3, 13, 4, hatColor); }
  if (hat === "shade") { v.box(-1, 12, 2, 3, 12, 2, hatColor); v.box(-1, 12, 3, 3, 12, 4, nocast(hatColor)); }
  return v;
}
export const agentFrames = (look, carry = null) => ({ stand: agent(look, "stand", carry), left: agent(look, "left", carry), right: agent(look, "right", carry) });

/** Where each station's agent stands to work, and where the station's props sit, relative to its centre. */
export const SPOTS = {
  post: { agent: [-2, 0, 6], carry: null },
  read: { agent: [6, 0, 8], carry: "paper" },
  book: { agent: [7, 0, 4], carry: "quill" },
  scale: { agent: [-10, 0, 12], carry: "coin" },
  letter: { agent: [8, 0, 14], carry: "letter" },
  you: { agent: [14, 0, 14], carry: null },
};

/**
 * The still quarter. state:
 *   vendors: [{ color }]       one house each, west of the stream
 *   waiting: things on your desk     inTray: papers at the post     paid: promises paid in full
 */
export function quarter(state = {}) {
  const { vendors = C.tabs.slice(0, 4).map((color) => ({ color })), waiting = 0, inTray = 0, paid = 0, drafts = 0 } = state;
  const S = STATION;
  const off = (s, dx, dz) => [s.at[0] + dx, 1, s.at[1] + dz];
  const inst = [
    { model: ground(vendors.length), at: [0, 0, 0], id: null },
    { model: post(inTray), at: off(S.post, 0, 0), id: "post" },
    { model: readingDesk(), at: off(S.read, 0, 0), id: "read" },
    { model: bookStand(paid), at: off(S.book, 0, 0), id: "book" },
    { model: scaleBase(), at: off(S.scale, 0, 0), id: "scale" },
    { model: letterDesk(drafts), at: off(S.letter, -7, -4), id: "letter" },
    { model: yourDesk(waiting), at: off(S.you, -10, -6), id: "you" },
    { model: clockPost(5, 10), at: [...at(CLOCK.sx, CLOCK.sy)].reduce((a, c, i) => (i === 0 ? [c, 1] : [...a, c]), []), id: "clock" },
    ...vendors.map((vd, i) => { const [x, z] = vendorAt(i, vendors.length); return { model: vendorHouse(vd.color, i + 1), at: [x - 9, 1, z - 6], id: `vendor:${i}` }; }),
    { model: tree(3, 13), at: off(S.post, -20, -18), id: null },
    { model: tree(7, 11), at: off(S.book, 22, -14), id: null },
    { model: tree(11, 12), at: off(S.scale, 26, 4), id: null },
    { model: tree(5, 10), at: off(S.you, -22, 16), id: null },
    { model: tree(9, 12), at: off(S.read, -6, -24), id: null },
    ...LAMPS.map(([sx, sy]) => { const [x, z] = at(sx, sy); return { model: lampPost(), at: [x, 1, z], id: null }; }),
    { model: bench(), at: [at(CLOCK.sx, CLOCK.sy)[0] + 5, 1, at(CLOCK.sx, CLOCK.sy)[1] + 6], id: null, turn: 1 },
  ];
  return {
    turn: 0,
    instances: inst,
    lamps: [
      ...LAMPS.map(([sx, sy]) => { const [x, z] = at(sx, sy); return { at: [x, LAMP_TOP + 1, z], color: [1, 0.78, 0.45], radius: 26, power: 2.2 }; }),
      { at: [S.book.at[0] - 2, 18, S.book.at[1] - 7], color: [0.75, 1, 0.8], radius: 16, power: 1.8 },
      { at: [S.you.at[0] + 7, 16, S.you.at[1] - 2], color: [0.75, 1, 0.8], radius: 16, power: 1.8 },
      { at: [S.letter.at[0] + 6, 14, S.letter.at[1] - 3], color: [1, 0.8, 0.45], radius: 12, power: 1.6 },
    ],
  };
}

// For `craft render`: the quarter on an ordinary afternoon, one of everyone at work.
export default function preview() {
  const s = quarter({ waiting: 3, inTray: 2, drafts: 1 });
  const S = STATION;
  const put = (look, where, carry, turn = 0) => ({ model: agent(AGENTS[look], "stand", carry), at: where, id: look, turn, pivot: [1.5, 0, 1] });
  const spot = (id) => { const sp = SPOTS[id]; return [S[id].at[0] + sp.agent[0], 1, S[id].at[1] + sp.agent[2]]; };
  s.instances.push(
    { model: scaleBeam({ tilt: 3, slips: C.tabs.slice(0, 4), coins: 0.19 }), at: [S.scale.at[0], 1, S.scale.at[1]], id: "scale" },
    put("postmaster", spot("post"), null, 1),
    put("reader", spot("read"), "paper", 0),
    put("scribe", spot("book"), "quill", 3),
    put("checker", spot("scale"), "coin", 1),
    put("writer", spot("letter"), "letter", 2),
  );
  // a vendor's courier on the road to the post, an invoice in hand
  const [vx, vz] = vendorAt(0); const [px, pz] = S.post.at;
  s.instances.push({ model: agent({ ...AGENTS.courier, hatColor: C.tabs[0] }, "left", "invoice"), at: [Math.round((vx + px) / 2), 1, Math.round((vz + pz) / 2)], id: "courier", turn: 1, pivot: [1.5, 0, 1] });
  s.background = C.paper;
  return s;
}
