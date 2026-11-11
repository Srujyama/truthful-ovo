// The crowd: every promise in the book as coins, one per $100, and two ways to stand them.
//
//   crowdOf(view)            the coins and both sortings: by company, and by what each coin is
//   coinStates(commitment)   one promise's coins, in order: came in, a note covers it, still owed
//   pickPromise(view)        the promise that tells the story best (partly paid, money still owed)
//   bands / blocks / fit     where every coin stands, in whole squares (Crowd.jsx draws them)
//
// The two layouts share one coin size, so a coin keeps its size when the crowd re-sorts and
// only its place changes.

import { COIN } from './coins.js';
import { dateDay, isOffer, isOverdue, money, stillOwedCents } from '../front/selectors.mjs';

/** Squares between two coins, across and down. */
export const GAP = 3;
export const pitchOf = (u) => (COIN + GAP) * u;

const C100 = 10000;

/** What one coin is, in words. */
export const STATE_WORDS = {
  in: 'came in',
  owed: 'still owed',
  note: 'credit note, not on an invoice yet',
  offer: 'on offer',
};

/** The kinds of coin, in the order the sorted crowd stands them. */
export const KINDS = [
  ['in', 'Came in'],
  ['owed', 'Still owed'],
  ['note', 'Credit note only'],
  ['offer', 'On offer'],
];

/**
 * How much of one promise is in each state, in cents.
 * A credit note only covers what is still owed; an offer is all offer.
 */
export function partsOf(c) {
  if (isOffer(c)) return { in: 0, note: 0, owed: 0, offer: c.promisedCents };
  const owed = stillOwedCents(c);
  const note = Math.min(owed, Math.max(0, c.issuedCents ?? 0));
  return { in: c.verifiedCents, note, owed: owed - note, offer: 0 };
}

/**
 * One coin per $100 promised (a part of $100 is a coin too). What came in fills
 * coins from the left; what is owed is counted from the right, so a promise with
 * nothing owed is all filled in and one with $1 owed shows one ring.
 */
export function coinStates(c) {
  const total = Math.max(1, Math.ceil(c.promisedCents / C100));
  if (isOffer(c)) return Array(total).fill('offer');
  const parts = partsOf(c);
  const owedCoins = Math.min(total, Math.ceil((parts.owed + parts.note) / C100));
  const noteCoins = Math.min(owedCoins, Math.ceil(parts.note / C100));
  const came = total - owedCoins;
  return Array.from({ length: total }, (_, i) => (i < came ? 'in' : i < came + noteCoins ? 'note' : 'owed'));
}

const vendorOf = (view, c) => view.vendors.find((v) => v.id === c.vendorId)?.name ?? 'A company';

/** The line under a company's name: what this promise is waiting on. */
export function standingOf(view, c) {
  if (isOffer(c)) return /renew/i.test((c.conditions ?? []).join(' ')) ? 'only if you renew' : 'only if you agree to more';
  if (stillOwedCents(c) === 0) return 'paid in full';
  if (partsOf(c).note > 0) return 'credit note only, not on an invoice yet';
  if (isOverdue(view, c)) return `late since ${dateDay(c.dueDate)}`;
  return `due ${dateDay(c.dueDate)}`;
}

/** The same, short enough for a phone's list. */
export function shortStandingOf(view, c) {
  if (!isOffer(c) && stillOwedCents(c) > 0 && partsOf(c).note > 0) return 'only a credit note so far';
  return standingOf(view, c);
}

/** The figure beside a company's name: what is still owed, or what was promised when nothing is. */
export function figureOf(c) {
  const owed = stillOwedCents(c);
  return money(isOffer(c) || owed === 0 ? c.promisedCents : owed);
}

/**
 * Every coin in the book and both ways to stand them.
 * @returns {{ marks, byCompany, byKind, sums, count }}
 *   marks      [{ id, state, owner (commitment id), title }]
 *   byCompany  [{ key, label, figure, note, short, owed, ids }]   one group per promise
 *   byKind     [{ key, label, figure, cents, ids }]          one group per kind of coin
 *   sums       cents per kind: { in, owed, note, offer }
 */
export function crowdOf(view) {
  const marks = [];
  const byCompany = [];
  const kindIds = { in: [], owed: [], note: [], offer: [] };
  const sums = { in: 0, owed: 0, note: 0, offer: 0 };
  for (const c of view.commitments) {
    const vendor = vendorOf(view, c);
    const states = coinStates(c);
    const parts = partsOf(c);
    for (const k of Object.keys(sums)) sums[k] += parts[k];
    const ids = states.map((state, i) => {
      const id = `${c.id}:${i}`;
      marks.push({ id, state, owner: c.id, title: `${vendor} · $100 ${STATE_WORDS[state]}` });
      kindIds[state].push(id);
      return id;
    });
    byCompany.push({ key: c.id, label: vendor, figure: figureOf(c), note: standingOf(view, c), short: shortStandingOf(view, c), owed: stillOwedCents(c) > 0, ids });
  }
  const byKind = KINDS.filter(([k]) => kindIds[k].length).map(([k, label]) => ({ key: k, label, cents: sums[k], figure: money(sums[k]), ids: kindIds[k] }));
  return { marks, byCompany, byKind, sums, count: marks.length };
}

/** The promise that tells the story best: some came in and some is still owed; failing that, anything owed. */
export function pickPromise(view) {
  const real = view.commitments.filter((c) => !isOffer(c));
  return real.find((c) => c.verifiedCents > 0 && stillOwedCents(c) > 0)
    ?? real.find((c) => stillOwedCents(c) > 0 && !(c.issuedCents > 0))
    ?? real.find((c) => stillOwedCents(c) > 0)
    ?? real[0] ?? view.commitments[0] ?? null;
}

// · where the coins stand

/**
 * By company: each promise is a band of whole rows, one under another, with a little
 * air between bands. Bands take turns standing at the left and the right of the field
 * so each one's name can sit in the margin beside it; two short bands share a row.
 * `side` is the room kept each side for the names (0 on a phone: names go under, and with
 * `alternate` false every band stands at the left).
 * Returns null when it does not fit at this size (unless `force`).
 */
export function bands(groups, width, height, u, { side = 0, minCols = 5, alternate = true, force = false } = {}) {
  const p = pitchOf(u);
  const filled = groups.filter((g) => g.ids.length);
  const largest = Math.max(1, ...filled.map((g) => g.ids.length));
  const field = Math.max(p, width - side * 2);
  const cols = Math.min(largest, Math.floor((field + GAP * u) / p));
  if (cols < Math.min(minCols, largest) && !force) return null;
  const C = Math.max(1, cols);
  const air = Math.round(p / 2 / u) * u;
  const fieldW = C * p - GAP * u;
  const x0 = Math.floor((width - fieldW) / 2 / u) * u;
  const at = new Map();
  const anchors = [];
  let y = 0;
  for (let i = 0; i < filled.length; i += 1) {
    const g = filled[i];
    const next = filled[i + 1];
    const rows = Math.ceil(g.ids.length / C);
    const sideOf = alternate && anchors.length % 2 === 1 ? 'right' : 'left';
    // two one-row bands, left then right, share a row when there is room for both and two empty columns
    if (alternate && sideOf === 'left' && rows === 1 && next && Math.ceil(next.ids.length / C) === 1 && g.ids.length + next.ids.length + 2 <= C) {
      g.ids.forEach((id, k) => at.set(id, { x: x0 + k * p, y }));
      next.ids.forEach((id, k) => at.set(id, { x: x0 + (C - next.ids.length + k) * p, y }));
      anchors.push({ key: g.key, side: 'left', x: x0, y });
      anchors.push({ key: next.key, side: 'right', x: x0 + fieldW, y });
      y += p + air;
      i += 1;
      continue;
    }
    g.ids.forEach((id, k) => {
      const row = Math.floor(k / C);
      const inRow = Math.min(C, g.ids.length - row * C);
      const col = k % C;   // rows read left to right, like text, whichever side the name is on
      at.set(id, { x: x0 + col * p, y: y + row * p });
    });
    anchors.push({ key: g.key, side: sideOf, x: sideOf === 'left' ? x0 : x0 + fieldW, y });
    y += rows * p + air;
  }
  const tall = Math.max(0, y - air - GAP * u);
  if (tall > height && !force) return null;
  return { mode: 'bands', u, pitch: p, coin: COIN * u, cols: C, x0, fieldW, width: fieldW, height: tall, at, anchors, blocks: [] };
}

/**
 * By kind: each kind is a block of coins stacked in columns from one floor, the way
 * coins are piled, side by side with its name above it. The fewest rows that fit the width.
 */
export function blocks(groups, width, height, u, { top = 30, minRows = 3, force = false } = {}) {
  const p = pitchOf(u);
  const filled = groups.filter((g) => g.ids.length);
  const largest = Math.max(1, ...filled.map((g) => g.ids.length));
  const gap = width < 520 ? 7 * u : 9 * u;
  const usable = Math.max(p, height - top);
  const most = Math.max(1, Math.floor((usable + GAP * u) / p));
  let rows = 0;
  for (let r = Math.min(minRows, most); r <= most; r += 1) {
    const cols = filled.reduce((n, g) => n + Math.ceil(g.ids.length / r), 0);
    if (cols * p - GAP * u + (filled.length - 1) * gap <= width) { rows = r; break; }
  }
  if (!rows) {
    if (!force) return null;
    rows = most;
  }
  rows = Math.min(rows, largest);
  const bodyH = rows * p - GAP * u;
  const at = new Map();
  const out = [];
  let x = 0;
  for (const g of filled) {
    const cols = Math.ceil(g.ids.length / rows);
    const used = Math.min(rows, g.ids.length);
    g.ids.forEach((id, i) => {
      const col = Math.floor(i / rows), row = i % rows;
      at.set(id, { x: x + col * p, y: top + bodyH - (row + 1) * p + GAP * u });
    });
    const w = cols * p - GAP * u;
    out.push({ key: g.key, x, y: top + bodyH - (used * p - GAP * u), w });
    x += w + gap;
  }
  const total = Math.max(0, x - gap);
  const shift = Math.max(0, Math.floor((width - total) / 2 / u) * u);
  for (const pos of at.values()) pos.x += shift;
  for (const b of out) b.x += shift;
  return { mode: 'blocks', u, pitch: p, coin: COIN * u, x0: shift, width: total, height: top + bodyH, top, at, anchors: [], blocks: out };
}

/**
 * Lay out every sorting at the largest coin that fits them all, so the coins keep
 * one size while they move between them.
 * sorts: [{ mode: 'bands' | 'blocks', groups }]
 */
export function fit(sorts, width, height, { maxU = 6, minU = 2, side = 0, top = 30, alternate = true } = {}) {
  if (!width || !height) return null;
  const one = (s, u, force) => (s.mode === 'bands'
    ? bands(s.groups, width, height, u, { side, alternate, force })
    : blocks(s.groups, width, height, u, { top, force }));
  for (let u = maxU; u >= minU; u -= 1) {
    const laid = sorts.map((s) => one(s, u, false));
    if (laid.every(Boolean)) return laid;
  }
  return sorts.map((s) => one(s, minU, true));
}
