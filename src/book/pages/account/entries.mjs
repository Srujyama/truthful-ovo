// One promise's account, line by line.
//
// The book keeps everything that happened as a list of entries (workspace.events).
// This picks out the ones that touch one promise and says each the way a
// bookkeeper would write it, oldest first, with the money each one moved and
// what was still owed after it. No React in here: it runs in node for its test.

import { evaluateWorkspace } from '../../../assurance/index.mjs';
import { dollars, shortDay } from '../../shell/money.mjs';
import { roleName } from '../../shell/roles.mjs';

const pad = n => String(n).padStart(2, '0');

/** An instant → "2026-11-10", on the reader's own calendar. */
export function localDay(instant) {
  const at = new Date(instant);
  if (Number.isNaN(at.getTime())) return '';
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
}

/** Who wrote an entry. The made-up first pages of the demo were written by nobody on the team. */
export function whoWrote(actor) {
  if (!actor) return '';
  if (actor.id === 'seed-curator') return 'the demo book';
  return roleName(actor.role);
}

/** What a paper is called in a sentence, from the kind it was filed as. */
const PAPER_NOUN = {
  email: 'the email',
  invoice: 'the invoice',
  credit_memo: 'the credit note',
  contract: 'the agreement',
  incident: 'the report',
  agent_conversation: 'their reply',
  proposed_terms: 'their note',
  allocation_record: 'the matching note',
  allocation_resolution: 'the matching note',
};
export const paperNoun = kind => PAPER_NOUN[kind] || 'the paper';

/** The year a date may leave unsaid: the year the book is being read in. */
const yearOf = asOf => (asOf ? String(asOf).slice(0, 4) : undefined);
const bare = text => String(text || '').trim().replace(/[.\s]+$/, '');
const isRenewal = offer => Boolean(offer?.newCommitment || offer?.incrementalRenewalCostCents > 0);

/** Which sort of offer this is: 'renewal' | 'date' | 'amount' | 'strings' | 'terms'. */
export function offerKind(offer) {
  if (isRenewal(offer)) return 'renewal';
  if (offer?.patch?.dueDate) return 'date';
  if (Number.isSafeInteger(offer?.patch?.promisedCents)) return 'amount';
  if (offer?.patch?.conditions?.length) return 'strings';
  return 'terms';
}

/** The offer as the object of a sentence: "You declined the renewal". */
export function offerNoun(offer, standing = {}) {
  const kind = offerKind(offer);
  if (kind === 'renewal') return 'the renewal';
  if (kind === 'date') return standing.dueDate && offer.patch.dueDate < standing.dueDate ? 'the earlier date' : 'the later date';
  if (kind === 'amount') return 'the new amount';
  return 'their changed terms';
}

/**
 * The words on an offer's tag. `standing` is the promise as it stood: { promisedCents, verifiedCents, dueDate }.
 * A renewal says what it really costs: the extra spending less the credit it buys.
 */
export function offerWords(offer, standing = {}, asOf) {
  const kind = offerKind(offer);
  const short = value => shortDay(value, yearOf(asOf));
  if (kind === 'renewal') {
    const creditCents = Math.max(0, (offer.patch?.promisedCents ?? standing.promisedCents ?? 0) - (standing.verifiedCents ?? 0));
    const extraCents = offer.incrementalRenewalCostCents || 0;
    const costCents = extraCents - creditCents;
    return {
      kind, creditCents, extraCents, costCents,
      title: 'Only if you renew',
      said: `A ${dollars(creditCents)} credit if you spend ${dollars(extraCents)} more.`,
      cost: costCents > 0 ? `That costs you ${dollars(costCents)}.` : costCents < 0 ? `That leaves you ${dollars(-costCents)} ahead.` : 'The credit pays for the extra spending.',
    };
  }
  if (kind === 'date') {
    const sooner = standing.dueDate && offer.patch.dueDate < standing.dueDate;
    return {
      kind,
      title: sooner ? 'Pay sooner' : 'Pay later',
      said: standing.dueDate ? `${short(offer.patch.dueDate)} instead of ${short(standing.dueDate)}.` : `On ${short(offer.patch.dueDate)}.`,
    };
  }
  if (kind === 'amount') {
    return { kind, title: 'A different amount', said: `${dollars(offer.patch.promisedCents)} instead of ${dollars(standing.promisedCents ?? 0)}.` };
  }
  if (kind === 'strings') {
    return { kind, title: 'With a string attached', said: offer.patch.conditions.map(c => `“${bare(c)}.”`).join(' ') };
  }
  return { kind, title: 'Different terms', said: 'They want to change what they promised.' };
}

/** A decision as the end of a sentence: "Approved: keep the original promise and ask for the rest, $1,500." */
export function decisionSays(action, offer, standing = {}, asOf) {
  if (!action) return '';
  const amount = dollars(action.amountCents);
  if (action.type === 'preserve_original') return `keep the original promise and ask for the rest, ${amount}`;
  if (action.type === 'prepare_claim') return `ask them for the ${amount}`;
  const kind = offerKind(offer);
  if (kind === 'renewal') return 'take the renewal';
  if (kind === 'date') return `take ${offerNoun(offer, standing)}, ${shortDay(offer.patch.dueDate, yearOf(asOf))}`;
  return `take ${offerNoun(offer, standing)}`;
}

/** The promise's figures as the book stood once `events` were in it. */
function figuresAfter(workspace, view, commitmentId, events) {
  try {
    const then = evaluateWorkspace({ ...workspace, events, revision: events.length }, { asOf: view.asOf, knownAt: view.knownAt });
    const c = then.commitments.find(item => item.id === commitmentId);
    if (!c) return null;
    return { promisedCents: c.promisedCents, verifiedCents: c.verifiedCents, owedCents: c.outstandingCents, dueDate: c.dueDate, offer: c.conditions.length > 0 };
  } catch {
    return null;
  }
}

/**
 * The lines of one promise's account, oldest first.
 *
 * Each line: { id, sequence, type, date, at, by, text, papers[], promisedCents, creditedCents, owedCents, offer }
 *   date            the day it happened ("YYYY-MM-DD")
 *   at, by          when it was written in the book, and whose pen wrote it
 *   papers          [{ sourceId, revision, label }] the paper(s) the line rests on
 *   promisedCents   what this line added to THEY PROMISED, or null
 *   creditedCents   what this line added to CREDITED SO FAR (negative when taken back), or null
 *   owedCents       STILL OWED after this line, or null when the line moved no money
 *   offer           true while the promise is only an offer (it has strings attached): nothing is owed yet
 */
export function accountEntries(workspace, view, commitment) {
  if (!workspace?.events || !view || !commitment) return [];
  const id = commitment.id;
  const company = view.vendors?.find(v => v.id === commitment.vendorId)?.name || 'They';
  const asOf = view.asOf;
  const short = value => shortDay(value, yearOf(asOf));
  const known = workspace.events.filter(e => !view.knownAt || e.observedAt <= view.knownAt);
  const kindOf = link => view.sourceVersions?.find(s => s.id === link.sourceId && s.revision === link.revision)?.kind;
  const papersFrom = (links, label) => (links || []).map(link => ({ sourceId: link.sourceId, revision: link.revision, label: label || paperNoun(kindOf(link)) }));

  // First pass: which offers, decisions and credit notes belong to this promise.
  const offers = new Map(), decisions = new Map(), notes = new Map();
  const mine = new Set(), myAllocations = new Set(), paperIds = new Set((commitment.sourceLinks || []).map(l => l.sourceId));
  for (const e of known) {
    const p = e.payload || {};
    if (e.type === 'AMENDMENT_PROPOSED' && p.amendment?.commitmentId === id) {
      offers.set(p.amendment.id, { ...p.amendment, sourceLinks: p.sourceLinks || [] });
      for (const link of p.sourceLinks || []) paperIds.add(link.sourceId);
    }
    if (e.type === 'ACTION_PROPOSED' && p.action?.commitmentId === id) decisions.set(p.action.id, p.action);
    if (e.type === 'CREDIT_REGISTERED' && p.credit) {
      notes.set(p.credit.id, { ...p.credit, sourceLinks: p.sourceLinks || [], registeredAt: e.observedAt });
      if (p.credit.vendorId === commitment.vendorId && p.credit.reference === commitment.reference && p.credit.currency === commitment.currency) mine.add(p.credit.id);
    }
    if (e.type === 'CREDIT_ALLOCATED' && p.allocation?.commitmentId === id) { mine.add(p.allocation.creditId); myAllocations.add(p.allocation.id); }
    if (e.type === 'CREDIT_RESOLVED' && p.assignments?.some(a => a.commitmentId === id)) mine.add(p.creditId);
  }
  for (const creditId of mine) for (const link of notes.get(creditId)?.sourceLinks || []) paperIds.add(link.sourceId);
  const matchedInOneSitting = credit => known.some(e => e.type === 'CREDIT_ALLOCATED' && e.payload.allocation?.creditId === credit.id && e.payload.allocation.commitmentId === id && e.observedAt === credit.registeredAt);

  const lines = [];
  let before = null;                       // the promise's figures after the last line written
  const onInvoice = new Set();             // credit notes that have reached an invoice so far
  known.forEach((e, index) => {
    const p = e.payload || {};
    let text = '', papers = [], decided = false;
    const figures = () => figuresAfter(workspace, view, id, known.slice(0, index + 1));

    switch (e.type) {
      case 'COMMITMENT_CREATED': {
        if (p.commitment?.id !== id) return;
        const c = p.commitment;
        text = c.conditions?.length
          ? `${company} offered ${dollars(c.promisedCents)} with ${c.conditions.length > 1 ? 'strings' : 'a string'} attached: ${c.conditions.map(x => `“${bare(x)}.”`).join(' ')}`
          : `${company} promised ${dollars(c.promisedCents)}, due ${short(c.dueDate)}.`;
        papers = papersFrom(p.sourceLinks);
        break;
      }
      case 'CREDIT_REGISTERED': {
        if (p.credit?.status === 'applied') onInvoice.add(p.credit.id);
        if (!mine.has(p.credit?.id)) return;
        const note = notes.get(p.credit.id);
        if (matchedInOneSitting(note)) return;          // the matching line right after it tells the whole thing
        text = p.credit.status === 'applied'
          ? `Invoice ${p.credit.invoiceId} came in with a ${dollars(p.credit.amountCents)} credit.`
          : `Credit note ${p.credit.invoiceId} came in for ${dollars(p.credit.amountCents)}.`;
        papers = papersFrom(p.sourceLinks);
        break;
      }
      case 'CREDIT_ALLOCATED': {
        if (p.allocation?.commitmentId !== id) return;
        const note = notes.get(p.allocation.creditId);
        const number = note?.invoiceId || 'An invoice';
        text = onInvoice.has(p.allocation.creditId)
          ? `Invoice ${number} took off ${dollars(p.allocation.amountCents)}.`
          : `Credit note ${number} for ${dollars(p.allocation.amountCents)}. It is not on an invoice yet.`;
        papers = papersFrom(p.allocation.sourceLinks?.length ? p.allocation.sourceLinks : note?.sourceLinks);
        break;
      }
      case 'CREDIT_APPLIED': {
        onInvoice.add(p.creditId);
        if (!mine.has(p.creditId)) return;
        const now = figures();
        const gained = now && before ? now.verifiedCents - before.verifiedCents : 0;
        text = `Credit note ${notes.get(p.creditId)?.invoiceId || ''} showed up on an invoice.${gained > 0 ? ` That took off ${dollars(gained)}.` : ''}`.replace(/\s+/g, ' ');
        papers = papersFrom(p.sourceLinks, 'the invoice');
        break;
      }
      case 'CREDIT_REVERSED': {
        if (!mine.has(p.creditId)) return;
        const here = (p.allocationReversals || []).filter(r => myAllocations.has(r.allocationId)).reduce((n, r) => n + r.amountCents, 0);
        text = `They took back ${dollars(here || p.amountCents)} of ${notes.get(p.creditId)?.invoiceId || 'the credit'}.`;
        papers = papersFrom(p.sourceLinks);
        break;
      }
      case 'CREDIT_RESOLVED': {
        const limit = p.assignments?.find(a => a.commitmentId === id);
        if (!limit) return;
        text = `${notes.get(p.creditId)?.invoiceId || 'The credit'} may cover up to ${dollars(limit.limitCents)} of this promise.`;
        papers = papersFrom(p.sourceLinks);
        decided = true;
        break;
      }
      case 'AMENDMENT_PROPOSED': {
        if (p.amendment?.commitmentId !== id) return;
        const offer = offers.get(p.amendment.id);
        const standing = before || {};
        const words = offerWords(offer, standing, asOf);
        if (words.kind === 'renewal') {
          text = standing.offer
            ? `The renewal they want is ${dollars(words.extraCents)} more spending.`
            : `They offered ${dollars(words.creditCents)} if you renew. That is ${dollars(words.extraCents)} more spending.`;
        } else if (words.kind === 'date') {
          text = `They offered to pay ${words.title === 'Pay sooner' ? 'sooner' : 'later'}: ${words.said}`;
        } else if (words.kind === 'amount') {
          text = `They offered ${words.said}`;
        } else if (words.kind === 'strings') {
          text = `They added ${offer.patch.conditions.length > 1 ? 'strings' : 'a string'}: ${words.said}`;
        } else {
          text = 'They offered different terms.';
        }
        papers = papersFrom(p.sourceLinks, 'their note');
        break;
      }
      case 'AMENDMENT_DISMISSED': {
        const offer = offers.get(p.amendmentId);
        if (!offer) return;
        text = `You declined ${offerNoun(offer, before || {})}: ‘${bare(p.reason)}’.`;
        papers = papersFrom(offer.sourceLinks, 'their note');
        decided = true;
        break;
      }
      case 'AMENDMENT_ACCEPTED': {
        const offer = offers.get(p.amendmentId);
        if (!offer) return;
        const kind = offerKind(offer);
        text = `You took ${offerNoun(offer, before || {})}.`;
        if (kind === 'date') text += ` It is due ${short(offer.patch.dueDate)} now.`;
        if (kind === 'renewal') text += ` ${dollars(offer.incrementalRenewalCostCents)} more spending comes with it.`;
        papers = papersFrom(offer.sourceLinks, 'their note');
        decided = true;
        break;
      }
      case 'ACTION_APPROVED': {
        const action = decisions.get(p.actionId);
        if (!action) return;
        text = `Approved: ${decisionSays(action, offers.get(action.payload?.amendmentId), before || {}, asOf)}.`;
        decided = true;
        break;
      }
      case 'ACTION_EXECUTED': {
        const action = decisions.get(p.actionId);
        if (!action) return;
        if (action.type === 'accept_amendment') return;   // "You took the later date." was written by the same stroke
        text = `Written in the book: ${decisionSays(action, null, before || {}, asOf)}.`;
        decided = true;
        break;
      }
      case 'SOURCE_REVISED': {
        if (!paperIds.has(p.source?.id)) return;
        const noun = paperNoun(p.source.kind);
        text = `${noun[0].toUpperCase()}${noun.slice(1)} was replaced with a newer copy.`;
        papers = [{ sourceId: p.source.id, revision: e.sequence, label: 'the new copy' }];
        break;
      }
      default:
        return;
    }

    const now = figures();
    const line = {
      id: e.id, sequence: e.sequence, type: e.type,
      date: decided ? localDay(e.observedAt) : e.effectiveDate,
      at: e.observedAt, by: whoWrote(e.actor),
      text, papers,
      promisedCents: null, creditedCents: null, owedCents: null,
      offer: Boolean(now?.offer),
    };
    if (now) {
      const promised = now.promisedCents - (before?.promisedCents ?? 0);
      const credited = now.verifiedCents - (before?.verifiedCents ?? 0);
      const moved = !before || promised !== 0 || credited !== 0 || now.owedCents !== before.owedCents || now.offer !== before.offer;
      if (promised !== 0) line.promisedCents = promised;
      if (credited !== 0) line.creditedCents = credited;
      if (moved && !now.offer) line.owedCents = now.owedCents;
      before = now;
    }
    lines.push(line);
  });
  return lines;
}

/** What the lines add up to. It has to match the promise's own figures, or a line is missing. */
export function footing(lines) {
  const sum = key => lines.reduce((n, line) => n + (line[key] || 0), 0);
  const last = lines.findLast(line => line.owedCents != null);
  return { promisedCents: sum('promisedCents'), creditedCents: sum('creditedCents'), owedCents: last ? last.owedCents : null };
}
