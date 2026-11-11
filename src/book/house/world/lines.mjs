// What each place in the quarter says, read from the book.
//
//   stationLine(id, view)   → { text, owed?, turn? }   the small tag beside a place
//   vendorLine(vendor, view) → { name, text, owedCents } the tag on a company's house
//   latestLine(view, workspace?) → "latest: Oct 28 · A decision was prepared: …"
//   stationNow(id, view)    → one sentence: what the place is doing now (the panel says it)
//
// The readings the tags and the panels share, so the two never disagree:
//   papersIn(view)          every paper in the drawer, newest first
//   lastRead(view)          the newest paper with a figure read in it, and what was read
//   letters(view)           letters on your desk, signed, and still to write
//   clockOf(view)           what is late, what closed, what is coming
//   promiseStanding(view,c) one promise in a few words
//   vendorOf(view, vendor)  one company: its promises, papers and what it owes
//
// ids: post, read, book, scale, letter, you, clock. view may be null: every
// reading then comes back empty. Nothing here is typed in: every figure, name
// and date is the book's.

import { dateDay, isOffer, isOverdue, money, paperText, stillOwedCents } from '../../front/selectors.mjs';
import { drawerPapers, findPassages, paperFacts, paperLook, whatItIs } from '../../pages/papers/kinds.mjs';
import { dayLine } from '../../pages/records/plain.mjs';
import { daysBetween } from '../../shell/money.mjs';
import { originalActionSpec } from '../../../assurance-ui.mjs';

export const STATION_IDS = ['post', 'read', 'book', 'scale', 'letter', 'you', 'clock'];

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const word = (n) => WORDS[n] ?? String(n);
const nameOf = (view, vendorId) => view?.vendors?.find((v) => v.id === vendorId)?.name ?? 'A company';
const possessive = (name) => `${name}’${/s$/i.test(name) ? '' : 's'}`;
const list = (items) => (items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items.at(-1)}` : items[0] ?? '');
const seq = (eventId) => Number(String(eventId ?? '').replace(/^event-/, '')) || 0;

// · the post: papers in

/** Every paper in the drawer, newest first: the papers on file and the credit notes. */
export function papersIn(view) {
  if (!view) return [];
  return drawerPapers(view);
}

// · the reading desk: what was read

const PAPER_NOUN = { email: 'letter', invoice: 'invoice', credit_memo: 'credit note', contract: 'agreement', incident: 'service report', agent_conversation: 'offer', proposed_terms: 'offer' };

/** What a paper is called on a tag: its number when it has one (INV-PC-1026), otherwise whose it is. */
export function paperName(view, source) {
  if (!source) return '';
  const text = String(source.text ?? '');
  if (source.kind === 'invoice') {
    const number = text.match(/\bINV-[A-Z0-9][A-Z0-9-]*\b/)?.[0];
    if (number) return number;
  }
  if (source.kind === 'credit_memo') {
    const credit = view.credits.find((c) => (c.sourceLinks ?? []).some((link) => link.sourceId === source.id));
    if (credit?.invoiceId) return credit.invoiceId;
  }
  return `${possessive(nameOf(view, source.vendorId))} ${PAPER_NOUN[source.kind] ?? paperLook(source.kind).noun.toLowerCase()}`;
}

/**
 * The newest paper the reader found a figure in: the paper, its name, its date, what was
 * read from it ({ label, value, worked? }), where each figure is printed, and the first figure.
 * @returns {{ source, name, date, company, noun, said, text, facts, passages, figure } | null}
 */
export function lastRead(view) {
  if (!view) return null;
  const newest = [...view.sources].sort((a, b) => b.revision - a.revision);
  for (const source of newest) {
    const facts = paperFacts(view, source);
    const text = paperText(source.text);
    const passages = findPassages(text, facts);
    if (!passages.length) continue;
    return {
      source,
      name: paperName(view, source),
      date: source.effectiveDate || String(source.observedAt ?? '').slice(0, 10),
      company: nameOf(view, source.vendorId),
      noun: paperLook(source.kind).noun,
      said: whatItIs(view, source),
      text,
      facts,
      passages,
      figure: text.slice(passages[0].start, passages[0].end),
    };
  }
  return null;
}

// · the letters

/**
 * The letters, as the book has them:
 *   waiting   prepared, waiting for your yes (the engine's action is prepared and allowed)
 *   signed    approved (or written in): the letter can go
 *   toWrite   money is owed and due, the window is open, and nothing is prepared yet
 * Each is { commitment, vendor, owedCents, action? }. A letter is the one the book page would
 * show for the promise (letterFor in front/selectors.mjs reads the same action).
 */
export function letters(view) {
  const out = { waiting: [], signed: [], toWrite: [] };
  if (!view) return out;
  for (const c of view.commitments) {
    const owedCents = stillOwedCents(c);
    if (owedCents <= 0) continue;
    const spec = originalActionSpec(view, c);
    const action = view.actions.filter((a) => a.commitmentId === c.id && a.type !== 'accept_amendment').at(-1) ?? null;
    const current = action && action.type === spec.type && !action.proposalStale && !action.approvalStale && action.amountCents === owedCents ? action : null;
    const item = { commitment: c, vendor: nameOf(view, c.vendorId), owedCents, action: current };
    if (current?.approval) out.signed.push(item);
    else if (current?.status === 'proposed') out.waiting.push(item);
    else if (!current && c.deadline?.state !== 'expired' && c.dueDate <= view.asOf) out.toWrite.push(item);
  }
  return out;
}

// · the clock

/**
 * What the clock knows, each list in the order it happened:
 *   late     money still owed and the date they gave has passed: { commitment, vendor, owedCents, since, days }
 *   closed   the window to claim has closed: { commitment, vendor, owedCents, on }
 *   soon     still owed, the window to claim still open: { commitment, vendor, owedCents, by, daysLeft }
 *   due      still owed, not due yet: { commitment, vendor, owedCents, due, daysLeft }
 *   urgent   the one the clock rings for: a window about to close, else the latest thing that went wrong
 */
export function clockOf(view) {
  const out = { late: [], closed: [], soon: [], due: [], urgent: null };
  if (!view) return out;
  for (const c of view.commitments) {
    const owedCents = stillOwedCents(c);
    if (owedCents <= 0) continue;
    const vendor = nameOf(view, c.vendorId);
    if (c.deadline?.state === 'expired') { out.closed.push({ commitment: c, vendor, owedCents, on: c.deadline.date }); continue; }
    if (isOverdue(view, c)) out.late.push({ commitment: c, vendor, owedCents, since: c.dueDate, days: daysBetween(c.dueDate, view.asOf) });
    else out.due.push({ commitment: c, vendor, owedCents, due: c.dueDate, daysLeft: daysBetween(view.asOf, c.dueDate) });
    if (c.deadline?.date && (c.deadline.state === 'open' || c.deadline.state === 'due_today')) {
      out.soon.push({ commitment: c, vendor, owedCents, by: c.deadline.date, daysLeft: daysBetween(view.asOf, c.deadline.date) });
    }
  }
  out.late.sort((a, b) => a.since.localeCompare(b.since));
  out.closed.sort((a, b) => a.on.localeCompare(b.on));
  out.soon.sort((a, b) => a.by.localeCompare(b.by));
  out.due.sort((a, b) => a.due.localeCompare(b.due));

  const closing = out.soon.find((item) => item.daysLeft <= 7);
  if (closing) out.urgent = { kind: 'closing', ...closing };
  else {
    const last = [
      ...out.late.map((item) => ({ kind: 'late', when: item.since, ...item })),
      ...out.closed.map((item) => ({ kind: 'closed', when: item.on, ...item })),
    ].sort((a, b) => b.when.localeCompare(a.when))[0];
    out.urgent = last ?? null;
  }
  return out;
}

/** The clock's news about one promise, in a few words: "9 days late", "window closed Oct 30". */
export function clockWords(item) {
  if (!item) return '';
  if (item.kind === 'closing') return item.daysLeft === 0 ? `${item.vendor}: last day to claim` : `${item.vendor}: ${plural(item.daysLeft, 'day')} left to claim`;
  if (item.kind === 'closed') return `${possessive(item.vendor)} window closed ${dateDay(item.on)}`;
  return `${item.vendor} is ${plural(item.days, 'day')} late`;
}

// · one promise, one company

/** How much of one promise is a credit note not on an invoice yet. */
const noteCents = (c) => (isOffer(c) ? 0 : Math.min(stillOwedCents(c), Math.max(0, c.issuedCents ?? 0)));

/** One promise in a few words: "late since Oct 1", "window to claim closed Oct 30", "only if you renew". */
export function promiseStanding(view, c) {
  if (isOffer(c)) return /renew/i.test((c.conditions ?? []).join(' ')) ? 'only if you renew' : 'only if you agree to more';
  if (stillOwedCents(c) === 0) return 'paid in full';
  if (c.deadline?.state === 'expired') return `window to claim closed ${dateDay(c.deadline.date)}`;
  if (noteCents(c) > 0) return 'credit note only, not on an invoice yet';
  if (isOverdue(view, c)) return `late since ${dateDay(c.dueDate)}`;
  return c.dueDate === view.asOf ? 'due today' : `due ${dateDay(c.dueDate)}`;
}

/** What one promise is made of, in cents: came in, a credit note covers it, still owed, on offer. */
export function promiseParts(c) {
  if (isOffer(c)) return { in: 0, note: 0, owed: 0, offer: c.promisedCents };
  const note = noteCents(c);
  return { in: c.verifiedCents, note, owed: stillOwedCents(c) - note, offer: 0 };
}

const vendorKey = (vendor) => (typeof vendor === 'string' ? vendor : vendor?.id);

/**
 * One company as the quarter shows it.
 * @returns {{ id, name, promises, papers, owedCents, promisedCents, inCents, offerCents, noteCents, state } | null}
 *   state: 'owes' | 'lost' (owed, but every window to claim closed and no note covers it) | 'paid' | 'offer' | 'none'
 */
export function vendorOf(view, vendor) {
  const id = vendorKey(vendor);
  const found = view?.vendors?.find((v) => v.id === id);
  if (!found) return null;
  const promises = view.commitments.filter((c) => c.vendorId === id);
  const papers = papersIn(view).filter((item) => item.vendorId === id);
  const owing = promises.filter((c) => stillOwedCents(c) > 0);
  const sum = (key) => promises.reduce((total, c) => total + promiseParts(c)[key], 0);
  const owedCents = owing.reduce((total, c) => total + stillOwedCents(c), 0);
  const firm = promises.filter((c) => !isOffer(c));
  const lost = owing.length > 0 && owing.every((c) => c.deadline?.state === 'expired' && noteCents(c) === 0);
  const state = owedCents > 0 ? (lost ? 'lost' : 'owes') : firm.length ? 'paid' : promises.length ? 'offer' : 'none';
  return {
    id, name: found.name, promises, papers, owedCents,
    promisedCents: firm.reduce((total, c) => total + c.promisedCents, 0),
    inCents: sum('in'), noteCents: sum('note'), offerCents: sum('offer'),
    state,
  };
}

// · the tags

/** The tag on a company's house: "owes $1,500", "paid", "on offer: $480", "too late to claim". */
export function vendorLine(vendor, view) {
  const name = typeof vendor === 'string' ? nameOf(view, vendor) : vendor?.name ?? '';
  const v = view ? vendorOf(view, vendor) : null;
  if (!v) return { name, text: '', owedCents: 0 };
  const text = v.state === 'owes' ? `owes ${money(v.owedCents)}`
    : v.state === 'lost' ? 'too late to claim'
      : v.state === 'paid' ? 'paid'
        : v.state === 'offer' ? `on offer: ${money(v.offerCents)}`
          : 'nothing promised yet';
  return { name: v.name, text, owedCents: v.owedCents };
}

/** The tag beside a place in the quarter. */
export function stationLine(stationId, view) {
  if (!view) return { text: '' };
  switch (stationId) {
    case 'post': {
      const n = papersIn(view).length;
      return { text: n ? `${plural(n, 'paper')} in` : 'no papers yet' };
    }
    case 'read': {
      const read = lastRead(view);
      return { text: read ? `last read: ${read.name}` : 'nothing read yet' };
    }
    case 'book': {
      const n = view.commitments.length;
      return { text: n ? plural(n, 'promise') : 'no promises yet' };
    }
    case 'scale': {
      const owed = view.totals.outstandingCents;
      if (owed > 0) return { text: `${money(owed)} short`, owed: true };
      return { text: view.totals.promisedCents > 0 ? 'level' : 'nothing on it' };
    }
    case 'letter': {
      const l = letters(view);
      if (l.waiting.length) return { text: `${plural(l.waiting.length, 'letter')} drafted` };
      if (l.toWrite.length) return { text: `${plural(l.toWrite.length, 'letter')} to write` };
      return { text: 'no letters to write' };
    }
    case 'you': {
      const n = letters(view).waiting.length;
      return n ? { text: `Your turn: ${plural(n, 'letter')} to sign`, turn: true } : { text: 'nothing to sign' };
    }
    case 'clock': {
      const { urgent } = clockOf(view);
      return { text: urgent ? clockWords(urgent) : 'nothing is late' };
    }
    default:
      return { text: '' };
  }
}

/** One sentence for a place's panel: what it is doing now, from the book. */
export function stationNow(stationId, view) {
  if (!view) return '';
  switch (stationId) {
    case 'post': {
      const papers = papersIn(view);
      if (!papers.length) return 'Nothing has come in yet. Add an email, an agreement or an invoice they sent you.';
      return `${plural(papers.length, 'paper')} in. The newest came ${dateDay(papers[0].date)} from ${papers[0].company}.`;
    }
    case 'read': {
      const read = lastRead(view);
      if (!read) return 'Nothing to read yet. When a paper comes in, the reader marks the figure in it.';
      return `Last read ${read.name}, ${dateDay(read.date)}.${read.said ? ` ${read.said}` : ''}`;
    }
    case 'book': {
      const all = view.commitments;
      if (!all.length) return 'Nothing written down yet. A promise goes in when a paper with one comes in.';
      const n = all.length;
      const owing = all.filter((c) => stillOwedCents(c) > 0).length;
      const paid = all.filter((c) => !isOffer(c) && stillOwedCents(c) === 0).length;
      const offers = all.filter(isOffer).length;
      const bits = [];
      if (owing) bits.push(n === 1 ? 'money is still owed on it' : `money is still owed on ${owing === n ? 'all' : word(owing)} of them`);
      if (paid) bits.push(n === 1 ? 'it is paid in full' : `${word(paid)} ${paid === 1 ? 'is' : 'are'} paid in full`);
      if (offers) bits.push(n === 1 ? 'it is an offer with strings attached' : `${word(offers)} ${offers === 1 ? 'is an offer' : 'are offers'} with strings attached`);
      return `${plural(n, 'promise')} written down${bits.length ? `: ${list(bits)}` : ''}.`;
    }
    case 'scale': {
      const { promisedCents, verifiedCents, outstandingCents } = view.totals;
      if (!promisedCents) return 'Nothing on it yet.';
      if (!outstandingCents) return `Level: all ${money(promisedCents)} promised came in.`;
      return `${money(outstandingCents)} still owed of ${money(promisedCents)} promised. ${verifiedCents ? `${money(verifiedCents)} came in on invoices.` : 'None of it has come in on an invoice.'}`;
    }
    case 'letter': {
      const l = letters(view);
      const first = l.waiting[0];
      const parts = [];
      if (first) {
        parts.push(l.waiting.length === 1
          ? `A letter is drafted, to ${first.vendor}, asking for ${money(first.owedCents)}. It waits on your desk.`
          : `${l.waiting.length} letters are drafted, to ${list(l.waiting.map((item) => item.vendor))}. They wait on your desk.`);
      }
      if (!first && l.signed.length) parts.push(`You signed the letter to ${list(l.signed.map((item) => item.vendor))}.`);
      if (l.toWrite.length) parts.push(`${list(l.toWrite.map((item) => possessive(item.vendor)))} ${l.toWrite.length === 1 ? 'letter is' : 'letters are'} not drafted yet.`);
      if (parts.length) return parts.join(' ');
      return view.totals.outstandingCents > 0 ? 'No letters to write.' : 'No letters to write. Nobody owes you anything.';
    }
    case 'you': {
      const l = letters(view);
      if (l.waiting.length) return `Your turn: the letter to ${l.waiting[0].vendor} asking for ${money(l.waiting[0].owedCents)}.`;
      if (l.signed.length) {
        const at = l.signed.at(-1).action.approval.approvedAt;
        return `Nothing to sign. You signed the letter to ${l.signed.at(-1).vendor} on ${dateDay(at)}.`;
      }
      return 'Nothing to sign.';
    }
    case 'clock': {
      const clock = clockOf(view);
      if (!clock.urgent) return clock.due.length ? `Nothing is late. The next date is ${dateDay(clock.due[0].due)}, for ${clock.due[0].vendor}.` : 'Nothing is late.';
      const same = (item) => item.commitment.id === clock.urgent.commitment.id;
      const late = clock.late.filter((item) => !same(item) || clock.urgent.kind !== 'late');
      const closed = clock.closed.filter((item) => !same(item) || clock.urgent.kind !== 'closed');
      const more = [
        ...(late.length > 2 ? [`${late.length} more promises are late.`] : late.map((item) => `${item.vendor} has been late since ${dateDay(item.since)}.`)),
        ...(closed.length > 2 ? [`${closed.length} windows to claim have closed.`] : closed.map((item) => `${possessive(item.vendor)} window to claim closed ${dateDay(item.on)}.`)),
      ];
      return [`${clockWords(clock.urgent)}.`.replace(/^./, (ch) => ch.toUpperCase()), ...more].join(' ');
    }
    default:
      return '';
  }
}

/** One sentence about a company for its panel. */
export function vendorNow(view, vendor) {
  const v = view ? vendorOf(view, vendor) : null;
  if (!v) return '';
  if (v.state === 'none') return `Nothing promised yet. ${v.papers.length ? `${plural(v.papers.length, 'paper')} on file.` : ''}`.trim();
  if (v.state === 'offer') {
    const offer = v.promises.find(isOffer);
    return `${v.name} offers ${money(v.offerCents)}, ${promiseStanding(view, offer)}. Nothing is owed unless you agree.`;
  }
  if (v.state === 'paid') return `All ${money(v.promisedCents)} ${v.name} promised came in. Paid in full.`;
  const owing = v.promises.filter((c) => stillOwedCents(c) > 0);
  const closed = owing.find((c) => c.deadline?.state === 'expired');
  const late = owing.filter((c) => c.deadline?.state !== 'expired' && isOverdue(view, c)).sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  const s = [`${v.name} promised ${money(v.promisedCents)}.`];
  if (v.inCents > 0) s.push(`${money(v.inCents)} came in on an invoice. ${money(v.owedCents)} is still owed${late ? `, late since ${dateDay(late.dueDate)}` : ''}.`);
  else if (v.noteCents === 0) s.push(`None of it has come in on an invoice${late ? `, and it was due ${dateDay(late.dueDate)}` : ''}.`);
  if (v.noteCents > 0) s.push(v.inCents === 0 && v.noteCents === v.owedCents ? 'They sent a credit note for all of it, but it is not on an invoice yet.' : `A credit note for ${money(v.noteCents)} is not on an invoice yet.`);
  if (closed) s.push(`The window to claim closed ${dateDay(closed.deadline.date)}.`);
  return s.join(' ');
}

// · the latest line

// The day book's entries, rebuilt from what the view keeps: each with the number of the
// event that wrote it, so the newest can be found without the raw events.
function entriesOf(view) {
  const out = [];
  const add = (n, day, event) => { if (n > 0) out.push({ n, day: String(day ?? '').slice(0, 10), event }); };
  const firstCopy = new Map();
  for (const s of view.sourceVersions) if (!firstCopy.has(s.id) || s.revision < firstCopy.get(s.id)) firstCopy.set(s.id, s.revision);
  for (const s of view.sourceVersions) add(s.revision, s.effectiveDate || s.observedAt, { type: firstCopy.get(s.id) === s.revision ? 'SOURCE_ADDED' : 'SOURCE_REVISED', payload: { source: s } });
  for (const c of view.commitments) add(c.revision, c.effectiveDate || c.createdAt, { type: 'COMMITMENT_CREATED', payload: { commitmentId: c.id } });
  for (const credit of view.credits) {
    add(credit.revision, credit.issuedDate, { type: 'CREDIT_REGISTERED', payload: { creditId: credit.id } });
    const applied = Math.max(0, ...(credit.applicationSourceLinks ?? []).map((link) => link.revision));
    if (applied) add(applied + 0.5, credit.applicationDate, { type: 'CREDIT_APPLIED', payload: { creditId: credit.id } });
  }
  for (const a of view.allocations) {
    const credit = view.credits.find((item) => item.id === a.creditId);
    add(seq(a.eventId), credit?.applicationDate || credit?.issuedDate, { type: 'CREDIT_ALLOCATED', payload: { allocation: a } });
  }
  for (const a of view.amendments) {
    add(seq(a.eventId), a.proposedAt || a.effectiveDate, { type: 'AMENDMENT_PROPOSED', payload: { amendmentId: a.id } });
    if (a.accepted) add(seq(a.acceptedEventId), a.acceptedAt, { type: 'AMENDMENT_ACCEPTED', payload: { amendmentId: a.id, economics: a.acceptedEconomics } });
    if (a.rejected && a.dismissal) add(seq(a.dismissal.eventId), a.dismissal.observedAt, { type: 'AMENDMENT_DISMISSED', payload: { amendmentId: a.id, reason: a.dismissal.reason } });
  }
  for (const a of view.actions) {
    add(seq(a.eventId), a.proposedAt, { type: 'ACTION_PROPOSED', payload: { actionId: a.id } });
    if (a.approval) add(seq(a.approval.eventId), a.approval.approvedAt, { type: 'ACTION_APPROVED', payload: { actionId: a.id } });
    if (a.execution) add(seq(a.execution.eventId), a.execution.executedAt, { type: 'ACTION_EXECUTED', payload: { actionId: a.id } });
  }
  return out.sort((a, b) => a.n - b.n);
}

/**
 * The newest line of the day book: "latest: Oct 28 · A decision was prepared: …".
 * Pass the workspace (service.workspace) to read its own last event; without it the line is
 * rebuilt from the view. Either way nothing after the view's moment is counted.
 */
export function latestLine(view, workspace = null) {
  if (!view) return '';
  const events = (workspace?.events ?? []).filter((event) => !view.knownAt || event.observedAt <= view.knownAt);
  const last = events.at(-1);
  if (last) return `latest: ${dateDay(last.effectiveDate || last.observedAt)} · ${dayLine(last, view)}`;
  const entry = entriesOf(view).at(-1);
  if (!entry || !entry.day) return '';
  return `latest: ${dateDay(entry.day)} · ${dayLine(entry.event, view)}`;
}
