// craft/kit/post.js — the pass that makes a small 3D render read as pixel art.
//
// Takes a lit target (render.js) and returns RGBA bytes. In order:
//   paper or sky where nothing was drawn (stars and a moon at night);
//   a darker rim on solid things where they stand in front of something far away;
//   a little more colour;
//   moonlight at night, except where something warm is lit;
//   colour snapped to a few levels with an ordered dither, anchored to the
//   world so it holds still as the camera moves;
//   a one-pixel ring around whatever is pointed at.
//
// The recipe is the one aidenguan.com's island uses in its fragment shader
// (portfolio-2/components/designer/scene/post.ts); this is our own CPU version.

// the 8×8 ordered-dither matrix, grown from 1×1 by the usual doubling
const BAYER8 = (() => {
  let m = [[0]];
  for (let n = 1; n < 8; n *= 2) {
    const next = Array.from({ length: n * 2 }, () => new Array(n * 2));
    for (let y = 0; y < n; y += 1)
      for (let x = 0; x < n; x += 1) {
        const v = m[y][x] * 4;
        next[y][x] = v;
        next[y][x + n] = v + 2;
        next[y + n][x] = v + 3;
        next[y + n][x + n] = v + 1;
      }
    m = next;
  }
  const out = new Float32Array(64);
  for (let y = 0; y < 8; y += 1) for (let x = 0; x < 8; x += 1) out[y * 8 + x] = (m[y][x] + 0.5) / 64;
  return out;
})();

/** The ordered-dither threshold (0…1) for a pixel. */
export const bayer = (x, y) => BAYER8[((y & 7) << 3) | (x & 7)];

const toSRGB = (c) => (c <= 0 ? 0 : c >= 1 ? 1 : c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

// bright things ease into white instead of clipping, and keep their colour
function shoulder(c) {
  return c <= 0.88 ? c : 0.88 + 0.12 * (1 - Math.exp(-(c - 0.88) / 0.12));
}

function hash(x, y) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

const rgbOf = (c) => (Array.isArray(c) ? c : [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255]);

/**
 * @param target  a lit target from render.js
 * @param options
 *   levels      colour steps per channel (15 is smooth, 6 is crunchy, 3 is poster)
 *   dither      0…1, how much of the ordered pattern to use (0 = hard bands)
 *   rim         how dark the rim on solid things is (0.6 = 40% darker; 1 = none)
 *   rimDepth    how far behind (in voxels) something must be to earn a rim
 *   saturate    colour boost (1.12 by default)
 *   night       0 (day) … 1 (night): moonlight grade, stars, moon, light spill
 *   background  0xRRGGBB, or { top, bottom } for a gradient, or null for transparent
 *   stars       draw stars and a moon at night (default true)
 *   hover       an object id to ring;  ring: its colour;  hoverAmount 0…1
 *   offset      [x, y] camera offset in pixels, so the dither holds still on the world
 */
export function post(target, options = {}) {
  const {
    levels = 15,
    dither = 1,
    rim = 0.6,
    rimDepth = 1.4,
    saturate = 1.12,
    night = 0,
    background = 0xf4f1ea,
    stars = true,
    hover = null,
    ring = 0xfff3c4,
    hoverAmount = 1,
    offset = [0, 0],
    time = 0,
    out = new Uint8ClampedArray(target.w * target.h * 4),
  } = options;
  const { w, h, lit, depth, flag, id } = target;
  const bgTop = background === null ? null : rgbOf(background.top ?? background);
  const bgBottom = background === null ? null : rgbOf(background.bottom ?? background);
  // flat paper is written exactly as given; only a gradient needs the dither
  const flatPaper = bgTop !== null && night <= 0.01 && bgTop.every((v, k) => v === bgBottom[k]);
  const hoverIndex = hover === null || hover === undefined ? 0 : (target._idIndex.get(hover) ?? 0);
  const ringRGB = rgbOf(ring);
  const ox = offset[0] | 0, oy = offset[1] | 0;

  // light that lit-from-inside things throw onto the pixels around them at night
  let spill = null;
  if (night > 0.01) {
    spill = new Float32Array(w * h * 3);
    const R = 4;
    for (let y = 0; y < h; y += 1)
      for (let x = 0; x < w; x += 1) {
        const i = y * w + x;
        if (!(flag[i] & 6) || depth[i] === Infinity) continue;
        const r = lit[i * 3], g = lit[i * 3 + 1], b = lit[i * 3 + 2];
        const m = Math.max(r, g, b);
        if (m < 0.6) continue;
        for (let dy = -R; dy <= R; dy += 1) {
          const yy = y + dy;
          if (yy < 0 || yy >= h) continue;
          for (let dx = -R; dx <= R; dx += 1) {
            const xx = x + dx;
            if (xx < 0 || xx >= w) continue;
            const d = Math.hypot(dx, dy);
            if (d > R || d === 0) continue;
            const k = (1 - d / (R + 0.2)) ** 2 * 0.05 * night;
            const j = (yy * w + xx) * 3;
            spill[j] += (r / m) * k;
            spill[j + 1] += (g / m) * k;
            spill[j + 2] += (b / m) * k;
          }
        }
      }
  }

  const moonX = Math.round(w * 0.82), moonY = Math.round(h * 0.2), moonR = Math.max(6, Math.round(h * 0.034));

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = y * w + x;
      const o = i * 4;
      const threshold = bayer(x - ox, y - oy);
      let r, g, b, a = 255;
      const z = depth[i];

      if (z === Infinity) {
        if (bgTop === null) {
          out[o] = out[o + 1] = out[o + 2] = out[o + 3] = 0;
          if (hoverIndex && ringAround(id, w, h, x, y, hoverIndex)) {
            out[o] = ringRGB[0] * 255; out[o + 1] = ringRGB[1] * 255; out[o + 2] = ringRGB[2] * 255; out[o + 3] = 255 * hoverAmount;
          }
          continue;
        }
        if (flatPaper) {
          out[o] = bgTop[0] * 255; out[o + 1] = bgTop[1] * 255; out[o + 2] = bgTop[2] * 255; out[o + 3] = 255;
          if (hoverIndex && ringAround(id, w, h, x, y, hoverIndex)) {
            const k = 0.92 * hoverAmount;
            out[o] += (ringRGB[0] * 255 - out[o]) * k; out[o + 1] += (ringRGB[1] * 255 - out[o + 1]) * k; out[o + 2] += (ringRGB[2] * 255 - out[o + 2]) * k;
          }
          continue;
        }
        const t = Math.min(1, Math.max(0, (y / h - 0.0) / 0.75));
        r = bgTop[0] + (bgBottom[0] - bgTop[0]) * t;
        g = bgTop[1] + (bgBottom[1] - bgTop[1]) * t;
        b = bgTop[2] + (bgBottom[2] - bgTop[2]) * t;
        if (night > 0.01 && stars) {
          const s = hash(x - ox + 7, y - oy + 3);
          const above = Math.min(1, Math.max(0, (0.72 - y / h) / 0.2));
          const twinkle = 0.62 + 0.38 * Math.sin(time * (0.7 + s * 2.4) + s * 50);
          const faint = s > 0.9925 ? 0.25 + 0.25 * ((s * 97) % 1) : 0;
          const bright = s > 0.99935 ? 1 : 0;
          const k = Math.max(faint, bright) * twinkle * above * night;
          r += (1 - r) * k; g += (0.97 - g) * k; b += (0.88 - b) * k;
          const d = Math.hypot(x + 0.5 - moonX, y + 0.5 - moonY);
          const bite = Math.hypot(x + 0.5 - (moonX + moonR * 0.42), y + 0.5 - (moonY - moonR * 0.3));
          if (d < moonR * 2.8 && d >= moonR) {
            const halo = 1 - (d - moonR) / (moonR * 1.8);
            if (bayer(x, y) + 0.02 < halo * 0.5) { r += (0.36 - r) * 0.45 * night; g += (0.44 - g) * 0.45 * night; b += (0.7 - b) * 0.45 * night; }
          }
          if (d < moonR && bite > moonR * 0.9) { r += (1 - r) * night; g += (0.95 - g) * night; b += (0.8 - b) * night; }
        }
        if (spill) {
          const j = i * 3;
          const m = spill[j] + spill[j + 1] + spill[j + 2];
          if (m > 0.004 && threshold + 0.001 < Math.min(m * 3, 0.6)) {
            const mm = Math.max(spill[j], spill[j + 1], spill[j + 2]) || 1;
            r = Math.max(r, toSRGB(spill[j] / mm) * 0.8); g = Math.max(g, toSRGB(spill[j + 1] / mm) * 0.8); b = Math.max(b, toSRGB(spill[j + 2] / mm) * 0.8);
          }
        }
        // a hair of grain so a big flat sky still dithers
        const n = (hash(x - ox, y - oy) - 0.5) * (2 / 255);
        r += n; g += n; b += n;
      } else {
        const c3 = i * 3;
        let lr = lit[c3], lg = lit[c3 + 1], lb = lit[c3 + 2];
        if (spill) { lr += spill[c3]; lg += spill[c3 + 1]; lb += spill[c3 + 2]; }
        r = toSRGB(shoulder(lr)); g = toSRGB(shoulder(lg)); b = toSRGB(shoulder(lb));

        // a darker rim where a solid thing stands in front of something far away
        if (rim < 1 && !(flag[i] & 1)) {
          const l = x > 0 ? depth[i - 1] : Infinity, rr = x < w - 1 ? depth[i + 1] : Infinity;
          const u = y > 0 ? depth[i - w] : Infinity, d = y < h - 1 ? depth[i + w] : Infinity;
          const far = Math.max(l, rr, u, d) - z;
          if (far > rimDepth) { const k = rim - 0.05 * night; r *= k; g *= k; b *= k; }
        }
        const luma = r * 0.299 + g * 0.587 + b * 0.114;
        r = luma + (r - luma) * saturate; g = luma + (g - luma) * saturate; b = luma + (b - luma) * saturate;
        if (night > 0.01) {
          const l2 = Math.max(0, r * 0.299 + g * 0.587 + b * 0.114);
          const warm = Math.min(1, Math.max(0, (r - b) * 2.5)) * Math.min(1, Math.max(0, (l2 - 0.1) / 0.2));
          const k = 0.45 * night * (1 - warm);
          r += (l2 * 0.74 - r) * k; g += (l2 * 0.88 + 0.012 - g) * k; b += (l2 * 1.22 + 0.035 - b) * k;
        }
      }

      // snap to a few levels; the dither draws the ramps between them
      if (levels > 0) {
        const t = dither > 0 ? 0.5 + (threshold - 0.5) * dither : 0.5;
        r = Math.floor(Math.min(1, Math.max(0, r)) * levels + t) / levels;
        g = Math.floor(Math.min(1, Math.max(0, g)) * levels + t) / levels;
        b = Math.floor(Math.min(1, Math.max(0, b)) * levels + t) / levels;
      }

      if (hoverIndex) {
        if (id[i] === hoverIndex) {
          r += (1 - r) * 0.07 * hoverAmount; g += (1 - g) * 0.07 * hoverAmount; b += (1 - b) * 0.07 * hoverAmount;
        } else if (ringAround(id, w, h, x, y, hoverIndex)) {
          const k = 0.92 * hoverAmount;
          r += (ringRGB[0] - r) * k; g += (ringRGB[1] - g) * k; b += (ringRGB[2] - b) * k;
        }
      }

      out[o] = r * 255;
      out[o + 1] = g * 255;
      out[o + 2] = b * 255;
      out[o + 3] = a;
    }
  }
  return out;
}

function ringAround(id, w, h, x, y, index) {
  return (x > 0 && id[y * w + x - 1] === index) || (x < w - 1 && id[y * w + x + 1] === index) || (y > 0 && id[(y - 1) * w + x] === index) || (y < h - 1 && id[(y + 1) * w + x] === index);
}

/** Scale RGBA up by a whole number, nearest neighbour: pixel art stays crisp. */
export function upscale(data, w, h, n) {
  if (n === 1) return { data, w, h };
  const W = w * n, H = h * n;
  const out = new Uint8ClampedArray(W * H * 4);
  const src = new Uint32Array(data.buffer, data.byteOffset, w * h);
  const dst = new Uint32Array(out.buffer);
  for (let y = 0; y < H; y += 1) {
    const sy = (y / n) | 0;
    for (let x = 0; x < W; x += 1) dst[y * W + x] = src[sy * w + ((x / n) | 0)];
  }
  return { data: out, w: W, h: H };
}

/** Snap RGBA to a fixed palette (array of 0xRRGGBB), dithering between the two nearest colours. */
export function toPalette(data, w, h, palette, { dither = 1, offset = [0, 0] } = {}) {
  const pal = palette.map((c) => {
    const [r, g, b] = rgbOf(c);
    return [r * 255, g * 255, b * 255, toLinear(r), toLinear(g), toLinear(b)];
  });
  for (let y = 0; y < h; y += 1)
    for (let x = 0; x < w; x += 1) {
      const o = (y * w + x) * 4;
      if (data[o + 3] === 0) continue;
      const r = toLinear(data[o] / 255), g = toLinear(data[o + 1] / 255), b = toLinear(data[o + 2] / 255);
      let best = 0, second = 0, bd = Infinity, sd = Infinity;
      for (let p = 0; p < pal.length; p += 1) {
        const dr = pal[p][3] - r, dg = pal[p][4] - g, db = pal[p][5] - b;
        const d = dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11;
        if (d < bd) { sd = bd; second = best; bd = d; best = p; }
        else if (d < sd) { sd = d; second = p; }
      }
      const mixAt = Math.sqrt(bd) / (Math.sqrt(bd) + Math.sqrt(sd) || 1); // 0 = on best, 0.5 = halfway
      const use = dither > 0 && mixAt * dither > bayer(x - offset[0], y - offset[1]) * 0.5 + 0.25 * (1 - dither) ? second : best;
      data[o] = pal[use][0];
      data[o + 1] = pal[use][1];
      data[o + 2] = pal[use][2];
    }
  return data;
}
