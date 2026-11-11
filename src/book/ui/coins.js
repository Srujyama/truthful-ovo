// Truthful's mark: one coin is $100 of a promise.
//
//   in      it came in on an invoice           a solid ink coin
//   owed    it is still owed                   a red ring: the hole where the coin should be
//   note    a credit note covers it, but it is not on an invoice yet
//                                              a red ring with a pale coin inside it
//   offer   offered only if you agree to more  a pale ring, every other square
//
// A coin is 9 by 9 squares. It can turn: frame 0 is face on; frames 1–4 narrow it
// toward its edge, so a coin can spin when it changes or when the pointer passes.
// Everything is drawn in whole squares, so it stays sharp at any size.

export const COIN = 9;
export const STATES = ['in', 'owed', 'note', 'offer'];

export const INK = {
  ink: '#11161a',
  red: '#c9361f',
  pale: '#a3aba6',
  paper: '#eef0ed',
  white: '#fbfcfa',
  rim: '#3a4247',
};

const P = { none: 0, ink: 1, red: 2, pale: 3, white: 4, rim: 5 };
const COLOR = [null, INK.ink, INK.red, INK.pale, INK.white, INK.rim];

// half-widths of the coin at each turn: face on, then narrower toward the edge
const HALF = [4.5, 3.6, 2.6, 1.6, 0.8];

const cache = new Map();

/** The squares of one coin: a Uint8Array of COIN×COIN paint indices (see P). */
export function coin(state = 'in', frame = 0) {
  const key = `${state}|${frame}`;
  if (cache.has(key)) return cache.get(key);
  const out = new Uint8Array(COIN * COIN);
  const a = HALF[Math.max(0, Math.min(HALF.length - 1, frame))];
  const b = 4.5;
  for (let y = 0; y < COIN; y += 1)
    for (let x = 0; x < COIN; x += 1) {
      const dx = x - 4, dy = y - 4;
      const d = (dx / a) ** 2 + (dy / b) ** 2;
      if (d > 1.02) continue;
      // the rim: inside the outer edge but outside an inner one, one square thick
      const ia = Math.max(0.01, a - 1.15), ib = b - 1.15;
      const rim = (dx / ia) ** 2 + (dy / ib) ** 2 > 1;
      const i = y * COIN + x;
      if (state === 'in') {
        // solid ink, with a lighter ring set one square in, and a glint
        const inner = (dx / Math.max(0.01, a - 2.1)) ** 2 + (dy / (b - 2.1)) ** 2;
        out[i] = rim ? P.ink : inner > 1 && inner < 1.9 && frame < 3 ? P.rim : P.ink;
        if (frame === 0 && x === 3 && y === 2) out[i] = P.rim;
      } else if (state === 'owed') {
        out[i] = rim ? P.red : P.none;
      } else if (state === 'note') {
        const inner = (dx / Math.max(0.01, a - 2.2)) ** 2 + (dy / (b - 2.2)) ** 2;
        out[i] = rim ? P.red : inner <= 1 ? P.pale : P.none;
      } else {
        // an offer: a pale ring, every other square
        out[i] = rim && (x + y) % 2 === 0 ? P.pale : P.none;
      }
    }
  cache.set(key, out);
  return out;
}

/** Draw one coin at (x, y) in canvas pixels, `u` pixels per square. */
export function drawCoin(ctx, x, y, u, state = 'in', frame = 0) {
  const squares = coin(state, frame);
  for (let row = 0; row < COIN; row += 1) {
    let run = 0, paint = 0;
    for (let col = 0; col <= COIN; col += 1) {
      const p = col < COIN ? squares[row * COIN + col] : 0;
      if (p === paint && col < COIN) { run += 1; continue; }
      if (paint) {
        ctx.fillStyle = COLOR[paint];
        ctx.fillRect(x + (col - run) * u, y + row * u, run * u, u);
      }
      paint = p;
      run = 1;
    }
  }
}

/** The coins for one promise, in order: what came in first, then what is owed.
 *  Counted from what is still owed, so a promise paid in full is all ink and
 *  a cent still owed is a whole red ring. */
export function coinsFor({ promisedCents = 0, creditedCents = 0, noteCents = 0, offer = false } = {}) {
  const total = Math.ceil(promisedCents / 10000);
  const short = Math.min(total, Math.ceil(Math.max(0, promisedCents - creditedCents) / 10000));
  const came = total - short;
  const noted = Math.min(short, Math.ceil(Math.max(0, noteCents) / 10000));
  const out = [];
  for (let i = 0; i < total; i += 1) {
    if (offer) out.push('offer');
    else if (i < came) out.push('in');
    else if (i < came + noted) out.push('note');
    else out.push('owed');
  }
  return out;
}

/** An SVG string of one coin, for places a canvas is too much (a list row, a legend). */
export function coinSVG(state = 'in', u = 2, frame = 0) {
  const squares = coin(state, frame);
  let rects = '';
  for (let i = 0; i < squares.length; i += 1) {
    if (!squares[i]) continue;
    rects += `<rect x="${(i % COIN) * u}" y="${Math.floor(i / COIN) * u}" width="${u}" height="${u}" fill="${COLOR[squares[i]]}"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${COIN * u}" height="${COIN * u}" viewBox="0 0 ${COIN * u} ${COIN * u}" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`;
}
