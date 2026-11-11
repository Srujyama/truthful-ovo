// The quarter's replay: the book's own history, one step at a time.
//
// Every step is a day (and a company) the day book records, said in one or two
// sentences built from the book, with the moves the agents make on the map:
//
//   { key, date, day, today, vendor, sentence, moves: [...], state: {...} }
//
// A move is one thing the director (director.js) knows how to show:
//
//   arrive   a vendor's courier brings a paper to the post      { vendor, carry, papers, say, reply }
//   pass     one agent walks a paper to the next one          { from, to, carry, say, reply }
//   file     the reader files the paper in a drawer
//   slip     the scribe lays a promise on the scale's left pan  { vendor }
//   coins    the checker lays what came in on the right pan     { cents }
//   hang     an offer with strings hangs off the stand        { vendor }
//   clip     a credit note is clipped beside the scale        { vendor }
//   draft    the writer writes a letter                       { letters }
//   deliver  the writer carries it to your desk               { say }
//   withdraw a letter that can no longer go comes off your desk
//   ring     the clock rings                                   { line }
//   call     your turn: the call over your desk
//   send     Truthful's courier takes a signed letter to the vendor  { vendor, say }
//
// `state` is how the quarter stands once the step is over (the scale, the tray,
// your desk), read from the book as it was then, so a step can be jumped to.

import { evaluateWorkspace } from '../../../assurance/index.mjs';
import { dateDay, isOffer, isOverdue, money, quoteFor, stillOwedCents, workingFor } from '../../front/selectors.mjs';

const NOUN = {
  email: 'email',
  invoice: 'invoice',
  credit_memo: 'credit note',
  contract: 'agreement',
  incident: 'service report',
  agent_conversation: 'message',
  proposed_terms: 'offer',
};
const noun = (kind) => NOUN[kind] ?? 'paper';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const COUNT = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
const counted = (n) => COUNT[n] ?? String(n);
const lowerFirst = (s) => (s ? s[0].toLowerCase() + s.slice(1) : s);
const possessive = (name) => `${name}’s`;
const dayOf = (instant) => String(instant ?? '').slice(0, 10);
const nextDay = (iso) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};
const byId = (list, id) => (list ?? []).find((item) => item.id === id) ?? null;

/** How many steps a long book replays: the latest ones, and today. */
export const MOST = 12;

/** The quarter as the book stands in `view`. Vendors are counted in the order of `order` (the book's own). */
export function stateOf(view, order = view.vendors) {
  const at = (vendorId) => Math.max(0, order.findIndex((v) => v.id === vendorId));
  const owed = view.commitments.filter((c) => !isOffer(c) && stillOwedCents(c) > 0);
  return {
    inTray: view.sources.length,
    slips: owed.map((c) => at(c.vendorId)),
    promisedCents: view.totals.promisedCents,
    creditedCents: view.totals.verifiedCents,
    owedCents: view.totals.outstandingCents,
    offers: view.commitments.filter((c) => isOffer(c)).map((c) => at(c.vendorId)),
    notes: view.credits.filter((c) => c.status === 'issued' && c.availableCents > 0).map((c) => at(c.vendorId)),
    waiting: view.actions.filter((a) => a.status === 'proposed').length,
    paid: view.commitments.filter((c) => !isOffer(c) && c.promisedCents > 0 && c.outstandingCents === 0).length,
    late: [...new Set(view.commitments.filter((c) => isOverdue(view, c)).map((c) => at(c.vendorId)))],
  };
}

/** The book as it stood after its first `count` events, on `asOf`. */
function viewAfter(workspace, count, asOf) {
  const events = workspace.events.slice(0, count);
  return evaluateWorkspace({ ...workspace, events, revision: events.length }, { asOf, knownAt: `${asOf}T23:59:59.999Z` });
}

/** Which company an event is about. */
function vendorOf(event, view) {
  const p = event.payload ?? {};
  const action = p.action ?? byId(view.actions, p.actionId);
  const amendment = p.amendment ?? byId(view.amendments, p.amendmentId ?? action?.payload?.amendmentId);
  const credit = p.credit ?? byId(view.credits, p.creditId ?? p.allocation?.creditId);
  const c = p.commitment ?? byId(view.commitments, p.commitmentId ?? p.allocation?.commitmentId ?? amendment?.commitmentId ?? action?.commitmentId);
  return p.vendor?.id ?? p.source?.vendorId ?? credit?.vendorId ?? c?.vendorId ?? null;
}

/** What a group of one day's entries for one company holds. */
function gather(events, view) {
  const g = { papers: [], promises: [], credits: [], notesApplied: [], offers: [], letters: [], approved: [], other: 0 };
  for (const e of events) {
    const p = e.payload ?? {};
    switch (e.type) {
      case 'SOURCE_ADDED':
      case 'SOURCE_REVISED':
        g.papers.push(p.source ?? {});
        break;
      case 'COMMITMENT_CREATED':
        g.promises.push(p.commitment?.id);
        break;
      case 'CREDIT_REGISTERED':
        g.credits.push(p.credit ?? {});
        break;
      case 'CREDIT_APPLIED':
        g.notesApplied.push(byId(view.credits, p.creditId) ?? { id: p.creditId });
        break;
      case 'AMENDMENT_PROPOSED':
        g.offers.push(p.amendment ?? {});
        break;
      case 'ACTION_PROPOSED':
        g.letters.push(p.action?.id);
        break;
      case 'ACTION_APPROVED':
        g.approved.push(p.actionId);
        break;
      default:
        if (e.type !== 'VENDOR_ADDED' && e.type !== 'CREDIT_ALLOCATED' && e.type !== 'ALLOCATION_CREATED') g.other += 1;
    }
  }
  return g;
}

/** "Pipeline CRM’s email comes in" / "Two papers from Nimbus Cloud come in". */
function arrival(name, papers) {
  if (papers.length === 1) return `${possessive(name)} ${noun(papers[0].kind)} comes in`;
  return `${counted(papers.length)} papers from ${name} come in`;
}

/** When a promise is due, said from the day of the step. */
function dueWords(c, on) {
  if (!c?.dueDate) return '';
  if (c.dueDate === on) return 'due today';
  if (c.dueDate < on) return `late since ${dateDay(c.dueDate)}`;
  return `due ${dateDay(c.dueDate)}`;
}

/** What an offer to change a promise asks: "to pay later", "the rest if you renew". */
function offerWords(a, c) {
  if (a.newCommitment || a.incrementalRenewalCostCents > 0) return c && c.verifiedCents > 0 ? 'the rest if you renew' : 'to pay if you renew';
  if (a.patch?.dueDate) return c && a.patch.dueDate < (c.originalDueDate ?? c.dueDate) ? 'to pay sooner' : 'to pay later';
  if (Number.isSafeInteger(a.patch?.promisedCents)) return `${money(a.patch.promisedCents)} instead`;
  return 'different terms';
}

/** The letters on your desk, in a few words: "$1,500 from Pipeline CRM, $2,000 from Nimbus Cloud". */
function letterList(actions, view) {
  return actions.map((a) => {
    const c = byId(view.commitments, a.commitmentId);
    const name = byId(view.vendors, c?.vendorId)?.name ?? 'them';
    return `${money(a.amountCents)} from ${name}`;
  }).join(', ');
}

/** One step of the replay for a group of one day's entries about one company. */
function paperStep({ date, vendorId, events, before, after, order, folded = [] }) {
  const name = byId(after.vendors, vendorId)?.name ?? 'A company';
  const vendor = Math.max(0, order.findIndex((v) => v.id === vendorId));
  const g = gather(events, after);
  const moves = [];
  const said = [];
  const papers = g.papers;
  const first = papers[0] ?? {};
  const promises = g.promises.map((id) => byId(after.commitments, id)).filter(Boolean);
  const applied = g.credits.filter((c) => c.status === 'applied');
  const issued = g.credits.filter((c) => c.status === 'issued');
  const changes = g.offers.filter((a) => !g.promises.includes(a.commitmentId));
  // the letters drafted today, for this company and for others the same day (folded in)
  const lettersToday = [...g.letters, ...folded.flatMap((f) => gather(f.events, after).letters)]
    .map((id) => byId(after.actions, id)).filter((a) => a && a.status === 'proposed');
  const carry = papers.some((s) => s.kind === 'invoice') ? 'invoice' : 'paper';

  if (papers.length) {
    moves.push({
      do: 'arrive', vendor, carry, papers: papers.length,
      say: papers.length === 1 ? `${possessive(name)} ${noun(first.kind)}.` : `${counted(papers.length)} papers from ${name}.`,
      reply: 'Thank you.',
    });
  }
  const read = (reply) => moves.push({ do: 'pass', from: 'postmaster', to: 'reader', carry, say: `From ${name}.`, reply });

  if (promises.length) {
    const c = promises[0];
    if (isOffer(c)) {
      const offer = g.offers.find((a) => a.commitmentId === c.id);
      const extra = offer?.incrementalRenewalCostCents ?? 0;
      said.push(extra > 0
        ? `${name} offers ${money(c.promisedCents)} if you renew, spending ${money(extra)} more.`
        : `${name} offers ${money(c.promisedCents)} with strings: “${c.conditions.join(' ')}”`);
      said.push('It comes only if you renew, so the scribe hangs it off the stand instead of laying it on a pan.');
      read(`${money(c.promisedCents)}, with strings.`);
      moves.push({ do: 'pass', from: 'reader', to: 'scribe', carry: 'paper', say: `${name} offers ${money(c.promisedCents)}.`, reply: 'Not a promise.' });
      moves.push({ do: 'hang', vendor });
    } else {
      const working = workingFor(after, c);
      const quote = working ? null : quoteFor(after, c);
      const due = dueWords(c, date);
      const claims = c.claimDeadline ? `, claims by ${dateDay(c.claimDeadline)}` : '';
      if (working) {
        const why = working.why ? `a ${lowerFirst(working.why)}` : 'a shortfall';
        said.push(`${name} reports ${why}: ${working.percent}% of the ${money(working.ofCents)}${working.per ? ` ${working.per}` : ''} is ${money(c.promisedCents)}.`);
      } else if (quote) {
        said.push(`${arrival(name, papers)}: “${quote.text.replace(/\s+$/, '')}”`);
      } else {
        said.push(`${arrival(name, papers)}: they promise ${money(c.promisedCents)}.`);
      }
      said.push(`The scribe writes down ${money(c.promisedCents)}, ${due}${claims}.`);
      read(`They promise ${money(c.promisedCents)}.`);
      moves.push({ do: 'pass', from: 'reader', to: 'scribe', carry: 'paper', say: `${name} promised ${money(c.promisedCents)}.`, reply: 'Written down.' });
      moves.push({ do: 'slip', vendor });
    }
  } else if (applied.length) {
    const cents = applied.reduce((sum, c) => sum + (c.amountCents ?? 0), 0);
    const month = MONTHS[Number(date.slice(5, 7)) - 1];
    const covers = (after.allocations ?? []).filter((a) => applied.some((c) => c.id === a.creditId)).map((a) => byId(after.commitments, a.commitmentId)).filter(Boolean);
    const c = covers[0];
    const owed = c ? stillOwedCents(c) : 0;
    said.push(`${possessive(name)} ${month} invoice takes off ${money(cents)}.`);
    if (c) said.push(owed > 0 ? `They still owe ${money(owed)}, ${dueWords(c, date)}.` : 'That is all of it: paid in full.');
    read(`It takes off ${money(cents)}.`);
    const coins = cents % 10000 === 0 ? cents / 10000 : 0;
    moves.push({ do: 'pass', from: 'reader', to: 'checker', carry: 'invoice', say: `${money(cents)} came off.`, reply: coins ? `${counted(coins)} ${coins === 1 ? 'coin' : 'coins'}.` : 'On the pan.' });
    moves.push({ do: 'coins', cents });
  } else if (g.notesApplied.length) {
    const credit = g.notesApplied[0];
    const cents = credit.amountCents ?? 0;
    said.push(`Credit note ${credit.invoiceId ?? ''} shows up on ${possessive(name)} invoice: ${money(cents)} came in.`.replace('  ', ' '));
    read(`It takes off ${money(cents)}.`);
    moves.push({ do: 'pass', from: 'reader', to: 'checker', carry: 'invoice', say: `${money(cents)} came off.`, reply: 'On the pan.' });
    moves.push({ do: 'coins', cents });
  } else if (issued.length) {
    const credit = issued[0];
    said.push(`${name} sends credit note ${credit.invoiceId} for ${money(credit.amountCents)}.`);
    said.push('A note is not money until it shows on an invoice, so the checker clips it beside the scale.');
    read(`A credit note for ${money(credit.amountCents)}.`);
    moves.push({ do: 'pass', from: 'reader', to: 'checker', carry: 'paper', say: `A credit note for ${money(credit.amountCents)}.`, reply: 'Not money yet.' });
    moves.push({ do: 'clip', vendor });
  } else if (changes.length || lettersToday.length) {
    const c = byId(after.commitments, changes[0]?.commitmentId ?? lettersToday[0]?.commitmentId);
    const asks = [...new Set(changes.map((a) => offerWords(a, c)))];
    if (asks.length) said.push(`${name} offers ${asks.join(', or ')}.`);
    else if (papers.length) said.push(`${arrival(name, papers)}.`);
    if (papers.length) read(asks.length ? `They offer ${asks[0]}.` : 'I’ll read it.');
    if (lettersToday.length) {
      const main = lettersToday.find((a) => byId(after.commitments, a.commitmentId)?.vendorId === vendorId) ?? lettersToday[0];
      said.push(lettersToday.length === 1
        ? `The writer drafts a letter for you to sign: ${letterList(lettersToday, after)}.`
        : `The writer drafts ${counted(lettersToday.length).toLowerCase()} letters for you to sign: ${letterList(lettersToday, after)}.`);
      if (papers.length) moves.push({ do: 'pass', from: 'reader', to: 'writer', carry: 'paper', say: asks.length ? `${name} offers ${asks[0]}.` : `From ${name}.`, reply: `I’ll ask for ${money(main.amountCents)}.` });
      moves.push({ do: 'draft', letters: lettersToday.length });
      moves.push({ do: 'deliver', letters: lettersToday.length, say: lettersToday.length === 1 ? 'One to sign.' : `${counted(lettersToday.length)} to sign.` });
    } else if (papers.length) {
      moves.push({ do: 'file' });
    }
  } else if (papers.length) {
    said.push(`${arrival(name, papers)}. It is read and kept with their papers.`);
    read('I’ll file it.');
    moves.push({ do: 'file' });
  }

  // letters drafted the same day for this company, after a promise or a credit
  if ((promises.length || applied.length || issued.length) && lettersToday.length) {
    said.push(lettersToday.length === 1 ? `A letter goes on your desk: ${letterList(lettersToday, after)}.` : `${counted(lettersToday.length)} letters go on your desk: ${letterList(lettersToday, after)}.`);
    moves.push({ do: 'draft', letters: lettersToday.length });
    moves.push({ do: 'deliver', letters: lettersToday.length, say: 'For you to sign.' });
  }

  // a letter you approved: Truthful's courier takes it to them
  if (g.approved.length) {
    said.push(`You approved the letter to ${name}. The courier takes it over the bridge.`);
    moves.push({ do: 'send', vendor, say: `A letter for ${name}.` });
  }

  if (!said.length) return null;
  return { date, vendorId, vendor, sentence: said.join(' '), moves, events: events.length };
}

/** The clock's lines for a day: what fell due or closed, unpaid. */
function clockLines(date, list, view) {
  const lines = [];
  for (const { c, kind } of list) {
    const name = byId(view.vendors, c.vendorId)?.name ?? 'A company';
    if (kind === 'claim') lines.push({ vendorId: c.vendorId, line: `${possessive(name)} window to claim the ${money(stillOwedCents(c))} closes.` });
    else lines.push({ vendorId: c.vendorId, line: `${possessive(name)} ${money(stillOwedCents(c))} falls due, and no invoice shows it.` });
  }
  return lines;
}

/**
 * The replay of a book.
 * @param {object} workspace  service.workspace (its events)
 * @param {object} view       evaluateWorkspace(workspace) as of today
 * @returns {{ steps: Array, empty: boolean, line: string }}
 */
export function storyOf(workspace, view) {
  if (!workspace || !view) return { steps: [], empty: true, line: 'Nothing in the book yet.' };
  const events = [...(workspace.events ?? [])].sort((a, b) => a.sequence - b.sequence);
  const order = view.vendors;
  const today = view.asOf;
  const story = [];

  // the day book's entries, by day and company, in the order they were written
  const groups = [];
  const index = new Map();
  events.forEach((e, i) => {
    const date = dayOf(e.observedAt);
    if (!date || date > today) return;
    const vendorId = vendorOf(e, view);
    const key = `${date}|${vendorId}`;
    let g = index.get(key);
    if (!g) {
      g = { key, date, vendorId, events: [], last: i };
      index.set(key, g);
      groups.push(g);
    }
    g.events.push(e);
    g.last = Math.max(g.last, i);
  });

  // a day's entries with no paper of their own (a letter drafted for another company) ride with that day's paper
  const hasPaper = (g) => g.events.some((e) => e.type === 'SOURCE_ADDED' || e.type === 'SOURCE_REVISED' || e.type === 'COMMITMENT_CREATED' || e.type === 'CREDIT_REGISTERED' || e.type === 'CREDIT_APPLIED' || e.type === 'ACTION_APPROVED');
  const folded = new Map();
  const standing = [];
  for (const g of groups) {
    if (hasPaper(g)) { standing.push(g); continue; }
    const host = [...standing].reverse().find((h) => h.date === g.date) ?? groups.find((h) => h !== g && h.date === g.date && hasPaper(h));
    if (host) {
      if (!folded.has(host.key)) folded.set(host.key, []);
      folded.get(host.key).push(g);
      host.last = Math.max(host.last, g.last);
    } else if (g.events.some((e) => e.type === 'ACTION_PROPOSED' || e.type === 'AMENDMENT_PROPOSED')) {
      standing.push(g);
    }
  }

  for (const g of standing) {
    const isToday = g.date === today;
    const after = isToday && g.last === events.length - 1 ? view : viewAfter(workspace, g.last + 1, g.date);
    const step = paperStep({ date: g.date, vendorId: g.vendorId, events: g.events, after, order, folded: folded.get(g.key) ?? [] });
    if (!step) continue;
    step.key = g.key;
    step.state = stateOf(after, order);
    step.view = after;
    step.count = g.last + 1;
    story.push(step);
  }

  // the clock: what fell due unpaid, and claim windows that closed, before today
  const clock = new Map();
  for (const c of view.commitments) {
    if (isOffer(c)) continue;
    if (c.dueDate && c.dueDate < today) {
      const then = viewAfter(workspace, events.filter((e) => dayOf(e.observedAt) <= c.dueDate).length, c.dueDate);
      const was = byId(then.commitments, c.id);
      if (was && stillOwedCents(was) > 0) (clock.get(c.dueDate) ?? clock.set(c.dueDate, []).get(c.dueDate)).push({ c: was, kind: 'due' });
    }
    if (c.claimDeadline && c.claimDeadline < today) {
      const then = viewAfter(workspace, events.filter((e) => dayOf(e.observedAt) <= c.claimDeadline).length, c.claimDeadline);
      const was = byId(then.commitments, c.id);
      if (was && stillOwedCents(was) > 0) (clock.get(c.claimDeadline) ?? clock.set(c.claimDeadline, []).get(c.claimDeadline)).push({ c: was, kind: 'claim' });
    }
  }
  for (const [date, list] of [...clock.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const count = events.filter((e) => dayOf(e.observedAt) <= date).length;
    const then = viewAfter(workspace, count, date);
    const lines = clockLines(date, list, then);
    const host = story.find((s) => s.date === date);
    if (host) {
      // the day already has a step: the clock rings at its end, for the others
      const rest = lines.filter((l) => l.vendorId !== host.vendorId);
      if (rest.length) host.moves.push({ do: 'ring', line: rest.map((l) => l.line.replace(/ falls due, and no invoice shows it\.$/, ' is due today.')).join(' ') });
      continue;
    }
    // a window that closes today has shut by tomorrow: the step ends as the book stands then
    const closes = list.some((x) => x.kind === 'claim');
    const end = closes ? viewAfter(workspace, events.filter((e) => dayOf(e.observedAt) <= nextDay(date)).length, nextDay(date) <= today ? nextDay(date) : today) : then;
    const moves = [{ do: 'ring', line: lines.map((l) => l.line).join(' ') }];
    const said = lines.map((l) => l.line);
    const stateNow = stateOf(end, order);
    const stateBefore = stateOf(then, order);
    if (stateNow.waiting < stateBefore.waiting) {
      moves.push({ do: 'withdraw', letters: stateBefore.waiting - stateNow.waiting });
      said.push(stateBefore.waiting - stateNow.waiting === 1 ? 'The clock rings, and its letter comes off your desk.' : 'The clock rings, and their letters come off your desk.');
    } else said.push('The clock rings.');
    const first = list[0].c;
    story.push({
      key: `${date}|clock`, date, vendorId: first.vendorId, vendor: Math.max(0, order.findIndex((v) => v.id === first.vendorId)),
      sentence: said.join(' '), moves, state: stateNow, view: end, count,
    });
  }

  story.sort((a, b) => (a.date === b.date ? a.count - b.count : a.date < b.date ? -1 : 1));

  if (!story.length && !view.commitments.length) return { steps: [], empty: true, line: 'Nothing in the book yet.' };

  const steps = [...story.slice(-(MOST - 1)), todayStep(view)].map((s, i, all) => ({ ...s, n: i + 1, of: all.length, day: s.today ? 'today' : dateDay(s.date) }));
  return { steps, empty: false, line: '' };
}

/** The last step: today, what is owed and what waits for you. */
export function todayStep(view) {
  const now = stateOf(view, view.vendors);
  const waiting = now.waiting;
  const head = view.totals.promisedCents === 0 ? 'Nothing promised yet.' : view.totals.outstandingCents > 0 ? `${money(view.totals.outstandingCents)} still owed.` : 'Nothing owed.';
  const wait = waiting === 0 ? 'Nothing waits for you.' : waiting === 1 ? 'A letter waits for your signature.' : `${counted(waiting)} letters wait for your signature.`;
  return { key: 'today', date: view.asOf, day: 'today', today: true, vendorId: null, vendor: -1, sentence: `${head} ${wait}`, moves: waiting ? [{ do: 'call' }] : [], state: now, view, count: view.revision ?? 0 };
}

/**
 * The moves for entries written since the replay was made (an approval, an invoice
 * that just arrived), to play live on the quarter. `from` is how many events the
 * quarter has already shown.
 */
export function liveStep(workspace, view, from) {
  const events = [...(workspace?.events ?? [])].sort((a, b) => a.sequence - b.sequence);
  if (!view || events.length <= from) return null;
  const fresh = events.slice(from);
  const byVendor = new Map();
  for (const e of fresh) {
    const id = vendorOf(e, view);
    if (!byVendor.has(id)) byVendor.set(id, []);
    byVendor.get(id).push(e);
  }
  const moves = [];
  const said = [];
  for (const [vendorId, list] of byVendor) {
    const step = paperStep({ date: view.asOf, vendorId, events: list, after: view, order: view.vendors });
    if (!step) continue;
    moves.push(...step.moves);
    said.push(step.sentence);
  }
  if (!moves.length) return null;
  return { key: `live-${events.length}`, date: view.asOf, day: 'today', today: true, sentence: said.join(' '), moves, state: stateOf(view, view.vendors), view, count: events.length };
}
