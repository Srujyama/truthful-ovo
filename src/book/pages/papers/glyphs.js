// A paper's mark: one small page, drawn the way the coins are (src/book/ui/coins.js):
// whole squares, flat ink, 7 squares wide and 9 tall, so it stays sharp at any size.
//
//   letter        a page with three lines of writing
//   invoice       a page of lines and figures, ruled off at the total
//   agreement     a page of writing, signed at the foot
//   report        a page with a small chart on it
//   memo          a credit note on paper: a page with a coin printed on it
//   credit        a credit line in the book: a short slip with a coin on it
//   offer         a page of dots: only if you agree (like the offer coin)
//   note          a note on file: a page with one line
//
// A credit not on an invoice yet is drawn the way a note coin is: a red ring with a
// pale coin inside. An older copy that was replaced is drawn pale all over.

export const PAGE_W = 7;
export const PAGE_H = 9;

const INK = '#11161a';
const RED = '#c9361f';
const PALE = '#a3aba6';

// '#' frame and writing, 'o' the coin printed on a credit, '.' nothing
const LETTER = [
  '#####..',
  '#...##.',
  '#....##',
  '#.###.#',
  '#.....#',
  '#.###.#',
  '#.....#',
  '#.##..#',
  '#######',
];
const ART = {
  letter: LETTER,
  invoice: [
    '#####..',
    '#...##.',
    '#....##',
    '#.#.#.#',
    '#.....#',
    '#.#.#.#',
    '#.....#',
    '#.###.#',
    '#######',
  ],
  agreement: [
    '#####..',
    '#...##.',
    '#....##',
    '#.###.#',
    '#.....#',
    '#.###.#',
    '#.....#',
    '#...###',
    '#######',
  ],
  report: [
    '#####..',
    '#...##.',
    '#....##',
    '#...#.#',
    '#...#.#',
    '#.#.#.#',
    '#.#.#.#',
    '#.#.#.#',
    '#######',
  ],
  memo: [
    '#####..',
    '#...##.',
    '#....##',
    '#.....#',
    '#..o..#',
    '#.ooo.#',
    '#..o..#',
    '#.....#',
    '#######',
  ],
  credit: [
    '.......',
    '.......',
    '#######',
    '#.....#',
    '#..o..#',
    '#.ooo.#',
    '#..o..#',
    '#.....#',
    '#######',
  ],
  // a letter in dots, every other square, the way the offer coin is drawn
  offer: LETTER,
  note: [
    '#####..',
    '#...##.',
    '#....##',
    '#.....#',
    '#.##..#',
    '#.....#',
    '#.##..#',
    '#.....#',
    '#######',
  ],
};

export const MARKS = Object.keys(ART);

/** Which mark a paper in the drawer gets (an item from kinds.mjs: paperItem or noteItem). */
export function markFor(item) {
  if (item.type === 'credit') return 'credit';
  switch (item.group) {
    case 'letters': return 'letter';
    case 'invoices': return 'invoice';
    case 'credit-notes': return 'memo';
    case 'agreements': return 'agreement';
    case 'offers': return 'offer';
    case 'reports': return 'report';
    default: return 'note';
  }
}

/** How a mark is inked: 'ink', 'waiting' (a credit not on an invoice yet), 'old' (a replaced copy), 'offer'. */
export function inkFor(item, waiting = false) {
  if (item.type === 'paper' && item.current === false) return 'old';
  if (item.group === 'offers') return 'offer';
  if (waiting) return 'waiting';
  return 'ink';
}

const cache = new Map();

/** The squares of one mark: [{ x, y, color }]. */
export function squares(mark = 'letter', ink = 'ink') {
  const key = `${mark}|${ink}`;
  if (cache.has(key)) return cache.get(key);
  const art = ART[mark] || ART.note;
  const out = [];
  art.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '.') return;
    if (mark === 'offer' && (x + y) % 2) return;
    let color = INK;
    if (ink === 'old' || ink === 'offer') color = PALE;
    else if (ink === 'waiting') color = ch === 'o' ? PALE : RED;
    out.push({ x, y, color });
  }));
  cache.set(key, out);
  return out;
}

/** Draw one mark at (x, y) in canvas pixels, `u` pixels per square. */
export function drawMark(ctx, x, y, u, mark, ink = 'ink') {
  for (const s of squares(mark, ink)) {
    ctx.fillStyle = s.color;
    ctx.fillRect(x + s.x * u, y + s.y * u, u, u);
  }
}

/** One mark as an SVG string, for a list row or a legend. */
export function markSVG(mark, ink = 'ink', u = 2) {
  const rects = squares(mark, ink).map(s => `<rect x="${s.x * u}" y="${s.y * u}" width="${u}" height="${u}" fill="${s.color}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE_W * u}" height="${PAGE_H * u}" viewBox="0 0 ${PAGE_W * u} ${PAGE_H * u}" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`;
}
