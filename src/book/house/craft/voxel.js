// craft/kit/voxel.js — models made of small coloured cubes, authored in code.
//
// A model is a sparse set of voxels. You build it with a handful of verbs
// (box, blob, limb, tube, sprite, column) and the renderer turns it into pixel
// art. Every voxel gets a hair of colour noise, so a flat colour still reads
// as a made thing at pixel size, and every exposed corner is darkened by the
// voxels around it, so shapes hold together without an outline.
//
// The idea (code-authored voxel models, drawn small and dithered) is the one
// behind the island on aidenguan.com: portfolio-2/components/designer/scene/voxels.ts.
// This file is our own implementation, written for a CPU renderer.

const OFF = 512; // coordinates run −512 … 511 on each axis
const SPAN = 1024;
const keyOf = (x, y, z) => ((x + OFF) * SPAN + (y + OFF)) * SPAN + (z + OFF);

// —— flags, carried in the bits above the colour
export const SOFT = 1 << 24; // no dark rim (foliage, cloud, ground, water)
export const GLOW = 1 << 25; // lit from inside: ignores the sun, shines at night
export const LAMP = 1 << 26; // dark glass by day, shines its own colour after dark (windows, lamp glass, signs)
export const NOCAST = 1 << 27; // throws no shadow (glass, light shafts)
const FADE_SHIFT = 28; // 3 bits: how far this voxel has dissolved, 0 solid … 7 nearly gone

/** Mark a colour: `soft(0x4f9336)` leaves no rim, `glow(0xffd27a)` always shines, `lamp(0xffd27a)` shines only at night. */
export const soft = (c) => c | SOFT;
export const glow = (c) => c | GLOW | SOFT;
export const lamp = (c) => c | LAMP;
export const nocast = (c) => c | NOCAST;
/** Dissolve a voxel a pixel at a time: level 0 (solid) … 7 (almost gone). */
export const fade = (c, level) => (c & ~(7 << FADE_SHIFT)) | (Math.max(0, Math.min(7, level | 0)) << FADE_SHIFT);

// —— colour helpers (0xRRGGBB integers)
export function hash3(x, y, z) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

export function mix(a, b, t) {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
}

/** Lighter (amount > 0) or darker (amount < 0). */
export const shade = (c, amount) => (amount >= 0 ? mix(c, 0xffffff, amount) : mix(c, 0x000000, -amount));

/** Pick from a ramp of colours by t in 0…1 (clamped). */
export const ramp = (colors, t) => colors[Math.max(0, Math.min(colors.length - 1, Math.floor(t * colors.length)))];

/** Parse "#rrggbb" or pass a number through. */
export const hex = (c) => (typeof c === "number" ? c : parseInt(String(c).replace("#", ""), 16));

const FACE = [
  // normal axis, sign, the two axes that span the face
  { a: 0, s: 1, t1: 1, t2: 2 }, // +X
  { a: 0, s: -1, t1: 1, t2: 2 }, // −X
  { a: 1, s: 1, t1: 0, t2: 2 }, // +Y (top)
  { a: 1, s: -1, t1: 0, t2: 2 }, // −Y
  { a: 2, s: 1, t1: 0, t2: 1 }, // +Z
  { a: 2, s: -1, t1: 0, t2: 1 }, // −Z
];
export const FACE_KINDS = FACE;

const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

export class Voxels {
  /** @param {{jitter?: number, seed?: number}} [options] jitter: colour noise per voxel, 0…0.1 */
  constructor({ jitter = 0.05, seed = 1 } = {}) {
    this.cells = new Map();
    this.jitter = jitter;
    this.seed = seed;
    this._mesh = null;
  }

  get size() {
    return this.cells.size;
  }

  set(x, y, z, color) {
    x = Math.round(x);
    y = Math.round(y);
    z = Math.round(z);
    if (color === null || color === undefined) this.cells.delete(keyOf(x, y, z));
    else this.cells.set(keyOf(x, y, z), color);
    this._mesh = null;
    return this;
  }

  get(x, y, z) {
    return this.cells.get(keyOf(Math.round(x), Math.round(y), Math.round(z)));
  }

  has(x, y, z) {
    return this.cells.has(keyOf(Math.round(x), Math.round(y), Math.round(z)));
  }

  _paint(paint, x, y, z) {
    return typeof paint === "function" ? paint(x, y, z) : paint;
  }

  /** A filled box between two corners (inclusive). `paint` is a colour or (x, y, z) => colour | null. */
  box(x0, y0, z0, x1, y1, z1, paint) {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x += 1)
      for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y += 1)
        for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z += 1) {
          const c = this._paint(paint, x, y, z);
          if (c !== null && c !== undefined) this.set(x, y, z, c);
        }
    return this;
  }

  /** The shell of a box: walls, floor and lid `thick` voxels deep. `open: "top"`, `"bottom"` or `"top bottom"` leaves those out; cut doors and windows with carve(). */
  shell(x0, y0, z0, x1, y1, z1, paint, { thick = 1, open = "" } = {}) {
    const lo = [Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1)];
    const hi = [Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1)];
    this.box(x0, y0, z0, x1, y1, z1, (x, y, z) => {
      const inX = x >= lo[0] + thick && x <= hi[0] - thick;
      const inY = y >= lo[1] + thick && y <= hi[1] - thick;
      const inZ = z >= lo[2] + thick && z <= hi[2] - thick;
      if (inX && inY && inZ) return null;
      if (open.includes("top") && y > hi[1] - thick && inX && inZ) return null;
      if (open.includes("bottom") && y < lo[1] + thick && inX && inZ) return null;
      return this._paint(paint, x, y, z);
    });
    return this;
  }

  /** Empty a box. */
  carve(x0, y0, z0, x1, y1, z1) {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x += 1)
      for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y += 1)
        for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z += 1) this.cells.delete(keyOf(x, y, z));
    this._mesh = null;
    return this;
  }

  /** An ellipsoid. `fill` < 1 leaves it airy (foliage, clouds, smoke). */
  blob(cx, cy, cz, rx, ry, rz, paint, { fill = 1, seed = 0 } = {}) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x += 1)
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y += 1)
        for (let z = Math.floor(cz - rz); z <= Math.ceil(cz + rz); z += 1) {
          const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2;
          if (d > 1) continue;
          // the airy part is the outside; the core stays whole so it never looks hollow
          if (fill < 1 && hash3(x + seed, y * 3, z - seed) > fill + (1 - d) * 0.25) continue;
          const c = this._paint(paint, x, y, z);
          if (c !== null && c !== undefined) this.set(x, y, z, c);
        }
    return this;
  }

  /** A thick segment from a to b whose radius tapers from r0 to r1: trunks, arms, pipes, ropes. */
  limb(ax, ay, az, bx, by, bz, r0, r1, paint) {
    const length = Math.hypot(bx - ax, by - ay, bz - az);
    const steps = Math.max(1, Math.ceil(length * 2));
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const x = ax + (bx - ax) * t, y = ay + (by - ay) * t, z = az + (bz - az) * t;
      const r = r0 + (r1 - r0) * t;
      const reach = Math.ceil(r);
      for (let dx = -reach; dx <= reach; dx += 1)
        for (let dy = -reach; dy <= reach; dy += 1)
          for (let dz = -reach; dz <= reach; dz += 1) {
            if (dx * dx + dy * dy + dz * dz > r * r + 0.35) continue;
            const vx = Math.round(x + dx), vy = Math.round(y + dy), vz = Math.round(z + dz);
            const c = this._paint(paint, vx, vy, vz);
            if (c !== null && c !== undefined) this.set(vx, vy, vz, c);
          }
    }
    return this;
  }

  /** An upright cylinder (or a ring, with `inner`): wells, barrels, towers, coins, wheels on their side with axis "x"/"z". */
  tube(cx, y0, cz, r, height, paint, { inner = 0, axis = "y" } = {}) {
    const reach = Math.ceil(r);
    for (let a = -reach; a <= reach; a += 1)
      for (let b = -reach; b <= reach; b += 1) {
        const d = a * a + b * b;
        if (d > r * r + 0.3 || (inner > 0 && d < inner * inner - 0.3)) continue;
        for (let h = 0; h < height; h += 1) {
          const [x, y, z] = axis === "y" ? [cx + a, y0 + h, cz + b] : axis === "x" ? [cx + h, y0 + a, cz + b] : [cx + a, y0 + b, cz + h];
          const c = this._paint(paint, x, y, z);
          if (c !== null && c !== undefined) this.set(x, y, z, c);
        }
      }
    return this;
  }

  /**
   * Pixel art drawn on a plane: rows top to bottom, one character per voxel,
   * looked up in `palette` ('.' or ' ' is empty). `axis` is the plane's width
   * direction; height is always +y. `depth` extrudes it.
   */
  sprite(rows, palette, x, y, z, { axis = "x", depth = 1 } = {}) {
    rows.forEach((row, r) => {
      [...row].forEach((ch, c) => {
        const color = palette[ch];
        if (color === undefined || color === null) return;
        const vy = y + rows.length - 1 - r;
        for (let d = 0; d < depth; d += 1) {
          if (axis === "x") this.set(x + c, vy, z + d, color);
          else this.set(x + d, vy, z + c, color);
        }
      });
    });
    return this;
  }

  /** The same idea lying flat: rows run back to front, drawn `thick` voxels tall at height y. A rug, a sign on the ground, a map. */
  decal(rows, palette, x, y, z, { thick = 1 } = {}) {
    rows.forEach((row, r) => {
      [...row].forEach((ch, c) => {
        const color = palette[ch];
        if (color === undefined || color === null) return;
        for (let t = 0; t < thick; t += 1) this.set(x + c, y + t, z + r, color);
      });
    });
    return this;
  }

  /**
   * Ground from a height function. Only the skin is stored (the top voxel of
   * each column and the sides a neighbour leaves showing), so a big island
   * costs thousands of voxels, not millions.
   * `height(x, z)` returns the top y or null for no ground there.
   * `paint(x, y, z, top)` colours it; top is the column's top y.
   */
  terrain(x0, z0, x1, z1, height, paint, { floor = -Infinity } = {}) {
    const h = (x, z) => {
      if (x < x0 || x > x1 || z < z0 || z > z1) return null;
      const v = height(x, z);
      return v === null || v === undefined ? null : Math.round(v);
    };
    for (let x = x0; x <= x1; x += 1)
      for (let z = z0; z <= z1; z += 1) {
        const top = h(x, z);
        if (top === null) continue;
        let low = top;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const n = h(x + dx, z + dz);
          low = Math.min(low, n === null ? Math.max(floor, top - 3) : n + 1);
        }
        for (let y = Math.max(low, floor === -Infinity ? low : floor); y <= top; y += 1) {
          const c = this._paint((px, py, pz) => paint(px, py, pz, top), x, y, z);
          if (c !== null && c !== undefined) this.set(x, y, z, c);
        }
      }
    return this;
  }

  /** Copy another model in, shifted, optionally turned in quarter turns about the y axis. */
  stamp(other, dx = 0, dy = 0, dz = 0, { turn = 0 } = {}) {
    other.each((x, y, z, c) => {
      let rx = x, rz = z;
      for (let i = 0; i < ((turn % 4) + 4) % 4; i += 1) [rx, rz] = [-rz, rx];
      this.set(rx + dx, y + dy, rz + dz, c);
    });
    return this;
  }

  each(fn) {
    for (const [k, c] of this.cells) {
      const z = (k % SPAN) - OFF;
      const y = (Math.floor(k / SPAN) % SPAN) - OFF;
      const x = Math.floor(k / (SPAN * SPAN)) - OFF;
      fn(x, y, z, c);
    }
    return this;
  }

  /** Repaint every voxel: fn(x, y, z, colour) => colour | null. */
  recolor(fn) {
    const next = new Map();
    this.each((x, y, z, c) => {
      const v = fn(x, y, z, c);
      if (v !== null && v !== undefined) next.set(keyOf(x, y, z), v);
    });
    this.cells = next;
    this._mesh = null;
    return this;
  }

  clone() {
    const v = new Voxels({ jitter: this.jitter, seed: this.seed });
    v.cells = new Map(this.cells);
    return v;
  }

  bounds() {
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    this.each((x, y, z) => {
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      if (z < z0) z0 = z;
      if (z > z1) z1 = z;
    });
    return { x0, y0, z0, x1, y1, z1, empty: !this.cells.size };
  }

  /**
   * The faces that touch air, ready to draw. Cached until the model changes.
   * pos: voxel coordinates; kind: which of the six faces; rgb: linear colour
   * with the voxel's noise in it; ao: four corner occlusion levels packed two
   * bits each; flag: the bits above the colour.
   */
  faces() {
    if (this._mesh) return this._mesh;
    const b = this.bounds();
    if (b.empty) return (this._mesh = { count: 0, pos: new Int16Array(0), kind: new Uint8Array(0), rgb: new Float32Array(0), ao: new Uint8Array(0), flag: new Uint8Array(0), bounds: b });

    // a dense grid one voxel wider all round, so each neighbour test is an index
    const sx = b.x1 - b.x0 + 3, sy = b.y1 - b.y0 + 3, sz = b.z1 - b.z0 + 3;
    const dense = sx * sy * sz <= 1 << 26;
    let solid;
    if (dense) {
      const grid = new Uint8Array(sx * sy * sz);
      this.each((x, y, z) => {
        grid[((x - b.x0 + 1) * sy + (y - b.y0 + 1)) * sz + (z - b.z0 + 1)] = 1;
      });
      solid = (x, y, z) => grid[((x - b.x0 + 1) * sy + (y - b.y0 + 1)) * sz + (z - b.z0 + 1)] === 1;
    } else {
      solid = (x, y, z) => this.cells.has(keyOf(x, y, z));
    }

    const pos = [], kind = [], rgb = [], ao = [], flag = [];
    const p = [0, 0, 0], out = [0, 0, 0], q = [0, 0, 0];
    this.each((x, y, z, color) => {
      p[0] = x; p[1] = y; p[2] = z;
      const noise = 1 + (hash3(x + this.seed, y, z) - 0.5) * 2 * this.jitter;
      const r = srgbToLinear(Math.min(1, (((color >> 16) & 255) / 255) * noise));
      const g = srgbToLinear(Math.min(1, (((color >> 8) & 255) / 255) * noise));
      const bl = srgbToLinear(Math.min(1, ((color & 255) / 255) * noise));
      const bits = (color >>> 24) & 127;
      for (let k = 0; k < 6; k += 1) {
        const f = FACE[k];
        out[0] = x; out[1] = y; out[2] = z;
        out[f.a] += f.s;
        if (solid(out[0], out[1], out[2])) continue;
        // corner occlusion from the eight neighbours in the layer just outside the face
        let packed = 0;
        for (let corner = 0; corner < 4; corner += 1) {
          const cu = corner === 1 || corner === 2 ? 1 : -1;
          const cv = corner >= 2 ? 1 : -1;
          q[0] = out[0]; q[1] = out[1]; q[2] = out[2];
          q[f.t1] += cu;
          const side1 = solid(q[0], q[1], q[2]);
          q[f.t2] += cv;
          const both = solid(q[0], q[1], q[2]);
          q[f.t1] -= cu;
          const side2 = solid(q[0], q[1], q[2]);
          const level = side1 && side2 ? 3 : Number(side1) + Number(side2) + Number(both);
          packed |= level << (corner * 2);
        }
        pos.push(x, y, z);
        kind.push(k);
        rgb.push(r, g, bl);
        ao.push(packed);
        flag.push(bits);
      }
    });

    this._mesh = {
      count: kind.length,
      pos: Int16Array.from(pos),
      kind: Uint8Array.from(kind),
      rgb: Float32Array.from(rgb),
      ao: Uint8Array.from(ao),
      flag: Uint8Array.from(flag),
      bounds: b,
    };
    return this._mesh;
  }
}

/** Shorthand: `model(v => { v.box(...) })` returns the built Voxels. */
export function model(build, options) {
  const v = new Voxels(options);
  build(v);
  return v;
}
