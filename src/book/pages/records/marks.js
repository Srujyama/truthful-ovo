// The day book's marks: one per entry, 5 squares by 5, in whole squares like the coins.
//
//   promises    a coin                       the promise of money
//   papers      a page with its corner turned
//   credits     a coin's rim                 money that came, or was matched
//   offers      a ring of dots, pale         only if you agree
//   decisions   a block with a hole          prepared, approved, written in
//   the rest    a small pale square          a company opened, the house rules

export const MARK = 5;

const INK = '#11161a';
const PALE = '#a3aba6';

const ART = {
  promises: ['.###.', '#####', '#####', '#####', '.###.'],
  papers: ['###..', '#.##.', '#...#', '#...#', '#####'],
  credits: ['.###.', '#...#', '#.#.#', '#...#', '.###.'],
  offers: ['.#.#.', '#...#', '.....', '#...#', '.#.#.'],
  decisions: ['#####', '#####', '##.##', '#####', '#####'],
  other: ['.....', '.###.', '.###.', '.###.', '.....'],
};
const COLOR = { offers: PALE, other: PALE };

export const artFor = kind => ART[kind] || ART.other;

/** Draw one entry's mark at (x, y), `u` pixels per square. */
export function drawEntry(ctx, x, y, u, kind) {
  const art = artFor(kind);
  ctx.fillStyle = COLOR[kind] || (ART[kind] ? INK : PALE);
  art.forEach((row, r) => [...row].forEach((ch, c) => { if (ch === '#') ctx.fillRect(x + c * u, y + r * u, u, u); }));
}

/** One mark as SVG, for the legend. */
export function entrySVG(kind, u = 2) {
  const fill = COLOR[kind] || (ART[kind] ? INK : PALE);
  let rects = '';
  artFor(kind).forEach((row, r) => [...row].forEach((ch, c) => { if (ch === '#') rects += `<rect x="${c * u}" y="${r * u}" width="${u}" height="${u}" fill="${fill}"/>`; }));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${MARK * u}" height="${MARK * u}" viewBox="0 0 ${MARK * u} ${MARK * u}" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`;
}
