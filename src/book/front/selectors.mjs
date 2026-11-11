// What the book of IOUs shows, read from the app's own records.
//
// Every function here is a pure reading of the workspace the rest of the app
// runs on (src/assurance). Nothing is stored and nothing is decided here that
// the engine has not already decided: what is promised, what is on an invoice
// and what is still owed are the engine's numbers, in integer cents, and
// whether a letter may be approved or an offer accepted is the engine's answer.
//
// The pages behind the book can use the same readings:
//   stillOwedCents, creditedSoFarCents, isOffer, isOverdue   one promise's standing
//   quoteFor, workingFor                                     the sentence where they said it
//   papersFor                                                the papers clipped to a promise
//   offersFor                                                what the vendor answered with
//   letterFor                                                the follow-up, and whether it is approved
//   claimClosedOn                                            the engine will not let it be chased: the time to claim ran out
//   nextInvoiceFor                                           the invoice the demo can bring in
//   totalsFor, promiseFor, bookFor                           the whole page

import { evaluateWorkspace, simulateAction } from '../../assurance/index.mjs';
import { originalReviewState } from '../../assurance-ui.mjs';
import { extractPromise, moneyToCents, parseInvoiceCsv } from '../../engine/index.mjs';
import { formatMoney } from '../../correspondence.mjs';
import { sources as exampleSources } from '../../content.js';

// ————————————————————————————————————————————————————————— words for money and dates

/** $1,500 or $1,500.50: for a sentence. */
export const money = (cents) => formatMoney(cents);
/** 1,500.00: for a ledger column. */
export const figure = (cents) => (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** $1,500.00 or −$900.00: for a slip or an invoice line. */
export const price = (cents) => `${cents < 0 ? '−' : ''}$${figure(Math.abs(cents))}`;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const parts = (iso) => iso.slice(0, 10).split('-').map(Number);
/** Oct 1, 2026 */
export const dateShort = (iso) => { const [y, m, d] = parts(iso); return `${MONTHS[m - 1].slice(0, 3)} ${d}, ${y}`; };
/** Oct 1 */
export const dateDay = (iso) => { const [, m, d] = parts(iso); return `${MONTHS[m - 1].slice(0, 3)} ${d}`; };
/** October 1, 2026 */
export const dateLong = (iso) => { const [y, m, d] = parts(iso); return `${MONTHS[m - 1]} ${d}, ${y}`; };
/** October 1 */
const dateMonthDay = (iso) => { const [, m, d] = parts(iso); return `${MONTHS[m - 1]} ${d}`; };

// ————————————————————————————————————————————————————————— one promise's standing

/** An offer with strings attached: nothing is owed unless you agree to it. */
export const isOffer = (commitment) => (commitment.conditions?.length ?? 0) > 0;
/** What has shown up on an invoice and been matched to this promise. A credit note alone does not count. */
export const creditedSoFarCents = (commitment) => commitment.verifiedCents;
/** What the vendor still owes on this promise. An offer you have not agreed to owes nothing. */
export const stillOwedCents = (commitment) => (isOffer(commitment) ? 0 : commitment.outstandingCents);
/** Money is still owed and the date they gave has passed. */
export const isOverdue = (view, commitment) => stillOwedCents(commitment) > 0 && commitment.dueDate < view.asOf;

/** The three sums at the foot of the page. Offers with strings are in none of them. */
export const totalsFor = (view) => ({
  promisedCents: view.totals.promisedCents,
  creditedCents: view.totals.verifiedCents,
  owedCents: view.totals.outstandingCents,
});

const vendorName = (view, commitment) => view.vendors.find((vendor) => vendor.id === commitment.vendorId)?.name ?? 'A vendor';
const versionOf = (view, link) => view.sourceVersions.find((source) => source.id === link.sourceId && source.revision === link.revision) ?? null;

// The example documents open with a line that marks them as made up. The page
// says that once, at its foot, so the papers do not each repeat it.
const MARKER = /^(?:SYNTHETIC ASSURANCE EXAMPLE|FICTIONAL EXAMPLE[^\n]*)\n+/;
/** A document's words as they are printed on its paper. */
export const paperText = (text) => String(text ?? '').replace(MARKER, '').trim();

// ————————————————————————————————————————————————————————— the sentence where they said it

// A sentence ends at . ! or ? followed by a space, so "99.0%" and "$2,400.00" stay whole.
function sentencesOf(text) {
  const out = [];
  for (const match of text.matchAll(/[^\n]+?(?:[.!?](?=\s|$)|(?=\n|$))/g)) {
    const lead = match[0].length - match[0].trimStart().length;
    const body = match[0].trim();
    if (body) out.push({ text: body, start: match.index + lead, end: match.index + lead + body.length });
  }
  return out;
}

const MONEY = /(?:\bUSD\s*\$?\s*|\$\s*)(\d[\d,]*(?:\.\d{1,2})?)/gi;
function amountsIn(text) {
  const out = [];
  for (const match of text.matchAll(MONEY)) {
    try { out.push({ cents: moneyToCents(match[1]), at: match.index }); } catch { /* not an amount this book can read */ }
  }
  return out;
}

// The papers a promise was made in: the ones it was recorded with, not later offers.
function promiseSources(view, commitment) {
  const first = new Set(commitment.sourceIds ?? []);
  return (commitment.sourceLinks ?? [])
    .filter((link) => first.size === 0 || first.has(link.sourceId))
    .map((link) => versionOf(view, link))
    .filter(Boolean)
    .map((source) => ({ source, text: paperText(source.text) }));
}

/**
 * The sentence where the vendor said it, word for word, and which paper it is in.
 * The engine's own citation is used when it finds one; otherwise the first
 * sentence that speaks of a credit, preferring one that names the amount.
 * @returns {{ text, sourceId, revision, start, end } | null}  start/end index paperText(source.text)
 */
export function quoteFor(view, commitment) {
  const papers = promiseSources(view, commitment);
  for (const { source, text } of papers) {
    const cited = extractPromise(text).evidence.find((item) => item.label === 'Promised credit');
    if (cited) return { text: text.slice(cited.start, cited.end), sourceId: source.id, revision: source.revision, start: cited.start, end: cited.end };
  }
  let fallback = null;
  for (const { source, text } of papers) {
    for (const sentence of sentencesOf(text)) {
      if (!/\b(?:credit|waiv|refund|rebate|reimburs)/i.test(sentence.text)) continue;
      const found = { text: sentence.text, sourceId: source.id, revision: source.revision, start: sentence.start, end: sentence.end };
      if (amountsIn(sentence.text).some((amount) => amount.cents === commitment.promisedCents)) return found;
      fallback ??= found;
    }
  }
  return fallback;
}

/**
 * When the sentence gives a percentage and not an amount: what it is a
 * percentage of. Only returned when the sum comes out to the promised amount
 * exactly, so the page never shows arithmetic the engine does not agree with.
 * @returns {{ percent, ofCents, per, why } | null}
 */
export function workingFor(view, commitment, quote = quoteFor(view, commitment)) {
  if (!quote) return null;
  const percents = [...quote.text.matchAll(/(\d+(?:\.\d+)?)\s?%/g)].map((match) => Number(match[1]));
  if (!percents.length) return null;
  const papers = promiseSources(view, commitment);
  for (const percent of percents) {
    for (const { text } of papers) {
      for (const amount of amountsIn(text)) {
        if (amount.cents * percent !== commitment.promisedCents * 100) continue;
        const sentence = sentencesOf(text).find((item) => item.start <= amount.at && amount.at < item.end);
        const report = papers.find((paper) => paper.source.kind === 'incident');
        return { percent, ofCents: amount.cents, per: /\bmonth/i.test(sentence?.text ?? '') ? 'month' : null, why: report?.source.title ?? null };
      }
    }
  }
  return null;
}

// ————————————————————————————————————————————————————————— the papers

const PAPER_KIND = { email: 'email', agent_conversation: 'email', contract: 'agreement', incident: 'report' };

// Lines written out as "Team subscription: $6,000.00", one to a line.
function writtenLines(text) {
  const lines = [];
  let totalCents = null;
  for (const raw of text.split('\n')) {
    const match = raw.trim().match(/^(.{2,80}?):\s*([−–-])?\s?\$(\d[\d,]*\.\d{2})$/);
    if (!match) continue;
    let cents;
    try { cents = moneyToCents(match[3]); } catch { continue; }
    if (/\btotal\b/i.test(match[1])) { totalCents = cents; continue; }
    lines.push({ label: match[1].trim(), cents: match[2] ? -cents : cents, credit: Boolean(match[2]) });
  }
  return { lines, totalCents };
}

function creditsOf(view, commitment) {
  return view.credits.filter((credit) => credit.vendorId === commitment.vendorId && credit.currency === commitment.currency
    && (credit.reference === commitment.reference || credit.allocations?.some((allocation) => allocation.commitmentId === commitment.id)));
}
const matchedTo = (credit, commitment) => (credit.allocations ?? [])
  .filter((allocation) => allocation.commitmentId === commitment.id)
  .reduce((sum, allocation) => sum + allocation.activeCents, 0);

function invoicePaper(view, commitment, credit, creditCents) {
  const later = credit.applicationSourceLinks?.length > 0;      // a credit note that reached an invoice afterwards
  const links = later ? credit.applicationSourceLinks : credit.sourceLinks ?? [];
  const source = links.map((link) => versionOf(view, link)).find((item) => item?.kind === 'invoice') ?? versionOf(view, links[0] ?? {});
  const text = paperText(source?.text);
  const id = later ? text.match(/\bINV-[A-Z0-9][A-Z0-9-]*\b/)?.[0] ?? source?.title ?? credit.invoiceId : credit.invoiceId;
  const paper = {
    id, sourceId: source?.id ?? null, revision: source?.revision ?? null, title: source?.title ?? `Invoice ${id}`,
    date: credit.applicationDate ?? credit.issuedDate, creditCents, text,
    billedTo: text.match(/\bBilled to ([^.\n]+)\./)?.[1] ?? null,
    period: text.match(/\bService period: ([^.\n]+)\./)?.[1] ?? null,
    lines: [], totalCents: null, said: null,
  };
  // a credit spreadsheet: the engine's own reading of its rows
  const sheet = /^invoice_id\s*,/i.test(text) ? parseInvoiceCsv(source.text) : null;
  const rows = sheet && !sheet.errors.length ? sheet.rows.filter((row) => row.invoiceId === credit.invoiceId) : [];
  if (rows.length) {
    paper.lines = rows.map((row) => ({ label: row.description, cents: -row.amountCents, credit: row.commitmentRef === commitment.reference }));
    return paper;
  }
  const written = writtenLines(text);
  if (written.lines.some((line) => line.credit && -line.cents === credit.amountCents)) {
    paper.lines = written.lines;
    paper.totalCents = written.totalCents;
    return paper;
  }
  // an invoice kept as prose: the credit line is the engine's, and the invoice's own words go under it
  paper.lines = [{ label: `Credit for ${commitment.reference}`, cents: -creditCents, credit: true }];
  paper.said = text || null;
  return paper;
}

/**
 * The papers clipped to a promise.
 *   promise   where they said it (the first is the one the sentence is in)
 *   invoices  where money showed up: each invoice with a credit matched to this promise
 *   notes     credit notes: a credit on paper, which is not money off an invoice
 * @returns {{ promise: object[], invoices: object[], notes: object[] }}
 */
export function papersFor(view, commitment, quote = quoteFor(view, commitment)) {
  const vendor = vendorName(view, commitment);
  const promise = promiseSources(view, commitment).map(({ source, text }) => ({
    sourceId: source.id, revision: source.revision, kind: PAPER_KIND[source.kind] ?? 'pasted',
    title: source.title, from: vendor, date: source.effectiveDate ?? source.observedAt?.slice(0, 10) ?? null, text,
    quote: quote && quote.sourceId === source.id && quote.revision === source.revision ? { start: quote.start, end: quote.end } : null,
  })).sort((a, b) => Number(Boolean(b.quote)) - Number(Boolean(a.quote)));

  const invoices = [], notes = [];
  for (const credit of creditsOf(view, commitment)) {
    const mine = matchedTo(credit, commitment);
    if (credit.quarantined || mine <= 0) continue;
    const memo = (credit.sourceLinks ?? []).map((link) => versionOf(view, link)).find((source) => source?.kind === 'credit_memo');
    const applied = credit.status === 'applied';
    if (memo || !applied) {
      const source = memo ?? versionOf(view, credit.sourceLinks?.[0] ?? {});
      notes.push({ id: credit.invoiceId, sourceId: source?.id ?? null, revision: source?.revision ?? null, title: source?.title ?? `Credit note ${credit.invoiceId}`,
        date: credit.issuedDate, cents: mine, text: paperText(source?.text), onInvoice: applied });
    }
    if (applied) invoices.push(invoicePaper(view, commitment, credit, mine));
  }
  const byDate = (a, b) => (a.date ?? '').localeCompare(b.date ?? '') || String(a.id).localeCompare(String(b.id));
  return { promise, invoices: invoices.sort(byDate), notes: notes.sort(byDate) };
}

// ————————————————————————————————————————————————————————— why the engine said no, in plain words

// How the engine words the one refusal that leaves nothing to do: the time to claim ran out.
const CLAIM_CLOSED = /^Claim deadline (\d{4}-\d{2}-\d{2}) expired/;

/**
 * The engine explains a refusal in its own terms. This says the same thing the
 * way a person would. Anything it does not recognise gets the general line.
 */
export function plainReason(reasons = []) {
  for (const reason of reasons) {
    let found;
    if ((found = reason.match(CLAIM_CLOSED))) return `The window to claim this closed ${dateDay(found[1])}.`;
    if ((found = reason.match(/^The promise is not due until (\d{4}-\d{2}-\d{2})/))) return `It is not due until ${dateDay(found[1])}.`;
    if ((found = reason.match(/exceeds the (\d+)-cent approval limit/))) return `Your rules stop at ${money(Number(found[1]))} for one approval.`;
    if (/forbids new contractual commitments|renewal cost exceeds the policy limit/i.test(reason)) return 'Your rules do not allow taking on new spending.';
    if (/^Unresolved amendment conflict/.test(reason)) return 'Decline the other offer first. You can only take one.';
    if (/conflicts with accepted future terms/.test(reason)) return 'You have already agreed to something else.';
    if (/basis is stale/.test(reason)) return 'This offer was made before the terms changed. Ask them to send it again.';
    if (/No outstanding original credit remains/.test(reason)) return 'Nothing is owed on this any more.';
    if (/commitment is conditional/.test(reason)) return 'This is an offer with strings attached, not something they owe you yet.';
  }
  return reasons.length ? 'The rules for this book do not allow that yet. Open its page to see why.' : null;
}

// ————————————————————————————————————————————————————————— what they answered with

/**
 * The vendor's offers on a promise: a later date, a credit in exchange for a
 * renewal, or other changed terms. Each says whether it has been decided and,
 * if not, whether the engine would let it be accepted now.
 * @returns {{ id, kind: 'later'|'renew'|'terms', due, firstDue, creditCents, extraCents, costCents, promisedCents,
 *             decision: null | { type: 'accepted'|'declined', at, reason? }, canAccept, why }[]}
 */
export function offersFor(workspace, view, commitment) {
  return view.amendments.filter((amendment) => amendment.commitmentId === commitment.id && !amendment.superseded).map((amendment) => {
    const renew = amendment.newCommitment || amendment.incrementalRenewalCostCents > 0;
    const kind = renew ? 'renew' : amendment.patch?.dueDate ? 'later' : 'terms';
    const decision = amendment.accepted ? { type: 'accepted', at: amendment.acceptedAt }
      : amendment.rejected ? { type: 'declined', at: amendment.dismissal.observedAt, reason: amendment.dismissal.reason }
        : null;
    // The credit as it was offered. Today's remaining sum can differ once another invoice arrives.
    const asked = view.actions.findLast((action) => action.type === 'accept_amendment' && action.payload?.amendmentId === amendment.id && action.proposedEconomics);
    let creditCents = amendment.acceptedEconomics?.creditCents ?? asked?.proposedEconomics.creditCents ?? null;
    let canAccept = false, why = null;
    if (!decision) {
      const trial = simulateAction(workspace, { type: 'accept_amendment', commitmentId: commitment.id, payload: { amendmentId: amendment.id } }, { asOf: view.asOf, knownAt: view.knownAt });
      creditCents ??= trial.economics.creditCents;
      canAccept = trial.policyDecision.allowed;
      why = canAccept ? null : plainReason(trial.policyDecision.reasons);
    }
    creditCents ??= Math.max(0, (amendment.patch?.promisedCents ?? commitment.promisedCents) - commitment.verifiedCents);
    const extraCents = amendment.incrementalRenewalCostCents;
    return {
      id: amendment.id, kind, decision, canAccept, why,
      due: amendment.patch?.dueDate ?? null, firstDue: commitment.originalDueDate ?? commitment.dueDate,
      promisedCents: amendment.patch?.promisedCents ?? null,
      creditCents, extraCents, costCents: extraCents - creditCents,
    };
  });
}

// ————————————————————————————————————————————————————————— the follow-up letter

// The example workspace's own finance contact and company, as its documents
// address them ("Hi Alex", "Billed to Acme Labs" in src/content.js).
const EXAMPLE_KEEPER = { person: 'Alex', company: 'Acme Labs' };

/** Who keeps this book: the signed-in person and their workspace, or the example's own. */
export function keeperFor(service = {}) {
  const person = service.session?.user?.name || EXAMPLE_KEEPER.person;
  const company = service.session?.workspace?.name || EXAMPLE_KEEPER.company;
  return { person, company, signature: `${person} · ${company}`, actorId: service.actor?.id ?? null };
}

/**
 * The follow-up for a promise with money still owed, written from what the
 * records show, and where it stands with the engine:
 *   approvedAt   when the engine's action for this exact amount was approved (or null)
 *   canApprove   whether the engine would allow approving it now; `why` says why not
 *   lapsed       it was approved, then something in the records changed
 * The wording is this book's. The engine keeps the approval, not the words.
 * @returns {object | null}  null when nothing is owed or it is only an offer
 */
export function letterFor(workspace, view, commitment, keeper = keeperFor()) {
  const owed = stillOwedCents(commitment);
  if (owed <= 0) return null;
  const vendor = vendorName(view, commitment);
  const seen = creditedSoFarCents(commitment);
  const quote = quoteFor(view, commitment);
  const papers = papersFor(view, commitment, quote);
  const said = papers.promise[0];

  const review = originalReviewState(workspace, view, commitment);
  const action = review.action;
  const current = action && action.type === review.specification.type && !action.proposalStale && !action.approvalStale && action.amountCents === owed ? action : null;
  const approval = current?.approval ?? null;
  const why = review.simulation.policyDecision.allowed ? null : plainReason(review.simulation.policyDecision.reasons);

  const offers = view.amendments.filter((amendment) => amendment.commitmentId === commitment.id && !amendment.accepted && !amendment.superseded);
  const renewalOffered = offers.some((amendment) => amendment.newCommitment || amendment.incrementalRenewalCostCents > 0);
  const openNotes = papers.notes.filter((note) => !note.onInvoice);

  const opening = !quote ? `You promised us a ${money(commitment.promisedCents)} credit.`
    : said?.kind === 'agreement' ? `Our agreement says: “${quote.text}”`
      : `${said?.date ? `On ${dateLong(said.date)} you` : 'You'} wrote: “${quote.text}”`;
  const standing = [
    seen > 0 ? `${papers.invoices.length === 1 ? `Invoice ${papers.invoices[0].id} shows` : 'Our invoices show'} ${money(seen)} of that.`
      : openNotes.length ? null : 'None of it has shown up on an invoice.',
    ...openNotes.map((note) => `You sent credit note ${note.id} for ${money(note.cents)} on ${dateMonthDay(note.date)}, but it has not come off an invoice.`),
    `${money(owed)} is still owed${isOverdue(view, commitment) ? `, and it was due ${dateMonthDay(commitment.dueDate)}` : ''}.`,
  ].filter(Boolean).join(' ');
  const ask = [
    `Please put the ${seen > 0 ? 'remaining ' : ''}${money(owed)} on our next invoice and send us the credit reference.`,
    renewalOffered ? 'We are keeping to what was first agreed, without the renewal.' : null,
  ].filter(Boolean).join(' ');
  const attached = [
    said ? (said.kind === 'agreement' ? 'the agreement' : said.kind === 'report' ? 'the report' : 'your email') : null,
    ...papers.invoices.map((invoice) => `invoice ${invoice.id}`),
    ...papers.notes.map((note) => `credit note ${note.id}`),
  ].filter(Boolean);
  const list = attached.length > 1 ? `${attached.slice(0, -1).join(', ')} and ${attached.at(-1)}` : attached[0];

  return {
    key: [commitment.id, owed, commitment.dueDate, review.specification.type].join(':'),
    to: vendor,
    subject: seen > 0 ? `The remaining ${money(owed)} credit` : `The ${money(owed)} credit you promised`,
    body: ['Hi,', opening, standing, ask, list ? `Attached: ${list}.` : null, `Thank you,\n${keeper.signature}`].filter(Boolean).join('\n\n'),
    approvedAt: approval?.approvedAt ?? null,
    approvedByYou: Boolean(approval) && (!keeper.actorId || approval.actor?.id === keeper.actorId),
    canApprove: !why,
    why,
    lapsed: Boolean(!approval && action?.approval && !action.executed),
  };
}

/**
 * The day the time to claim a promise ran out, when that is why the engine
 * would refuse its follow-up. The answer is the engine's own: it is read from
 * the reasons it gives for turning down the action a letter needs, not worked
 * out from dates here. A promise like this has no letter to send; all that is
 * left is to look at what happened.
 * @returns {string | null}  YYYY-MM-DD, or null when the engine has no such objection
 */
export function claimClosedOn(workspace, view, commitment) {
  if (stillOwedCents(commitment) <= 0) return null;
  const { simulation } = originalReviewState(workspace, view, commitment);
  for (const reason of simulation.policyDecision.reasons) {
    const found = reason.match(CLAIM_CLOSED);
    if (found) return found[1];
  }
  return null;
}

// ————————————————————————————————————————————————————————— the next invoice (demo)

/**
 * The invoice the demo can bring in for a promise with money still owed: one
 * that shows the rest. Its number follows the examples' own pattern
 * (INV-PC-1026: the reference's prefix, then month and year). When the app's
 * example material has an invoice for this vendor showing exactly what is still
 * owed (src/content.js), its lines are used; otherwise it has the one credit line.
 * `day` is the date on it (YYYY-MM-DD); left out, it is the engine's today.
 * @returns {{ id, date, creditCents, title, text, lines, totalCents } | null}
 */
export function nextInvoiceFor(view, commitment, day = view.asOf) {
  const owed = stillOwedCents(commitment);
  if (owed <= 0) return null;
  const vendor = vendorName(view, commitment);
  const prefix = commitment.reference.split('-')[0].toUpperCase().replace(/[^A-Z0-9]/g, '') || 'X';
  const stem = `INV-${prefix}-${day.slice(5, 7)}${day.slice(2, 4)}`;
  const taken = (id) => view.credits.some((credit) => credit.vendorId === commitment.vendorId && credit.invoiceId === id)
    || view.sources.some((source) => source.vendorId === commitment.vendorId && new RegExp(`\\b${id}\\b`).test(source.text));
  let id = stem;
  for (let n = 2; taken(id); n += 1) id = `${stem}-${n}`;

  const example = Object.values(exampleSources)
    .filter((source) => source.kind === 'Invoice' && source.vendor === vendor)
    .map((source) => ({ source, ...writtenLines(source.paragraphs.join('\n')) }))
    .find((item) => item.lines.some((line) => line.credit && -line.cents === owed));
  const lines = example ? example.lines : [{ label: `Credit for ${commitment.reference}`, cents: -owed, credit: true }];
  const totalCents = example ? example.totalCents : null;
  const text = [
    `Invoice ${id}`,
    example ? example.source.paragraphs[0] : `${vendor}, ${dateLong(day)}.`,
    [...lines.map((line) => `${line.label}: ${price(line.cents)}`), Number.isSafeInteger(totalCents) ? `Invoice total: ${price(totalCents)}` : null].filter(Boolean).join('\n'),
    'Made up by the demo to show the rest arriving.',
  ].join('\n\n');
  return { id, date: day, creditCents: owed, title: `${vendor} invoice ${id}`, text, lines, totalCents };
}

// ————————————————————————————————————————————————————————— the page

/** One box on a slip's strip stands for this much: $100, or more when the promise is large. */
export function boxCentsFor(promisedCents) {
  for (const size of [10000, 25000, 50000, 100000, 250000, 500000, 1000000, 2500000, 5000000, 10000000]) {
    if (promisedCents <= size * 30) return size;
  }
  return Math.ceil(promisedCents / 30 / 10000000) * 10000000;
}

/**
 * Everything the book shows for one promise: its row, its slip, its papers,
 * the vendor's offers and the follow-up letter. A promise whose time to claim
 * ran out has `closed` ({ on, line }) and no letter.
 * `demo` adds the invoice the demo lever can bring in.
 */
export function promiseFor(workspace, view, commitment, { keeper = keeperFor(), demo = false, day = view.asOf } = {}) {
  const offer = isOffer(commitment);
  const owedCents = stillOwedCents(commitment);
  const quote = quoteFor(view, commitment);
  const papers = papersFor(view, commitment, quote);
  const asides = papers.notes.filter((note) => !note.onInvoice)
    .map((note) => `Credit note ${note.id} for ${money(note.cents)} came ${dateDay(note.date)}. It is not on an invoice yet.`);
  for (const credit of creditsOf(view, commitment)) {
    if (credit.status === 'applied' && credit.unallocatedCents > 0 && credit.reference === commitment.reference && owedCents > 0) {
      asides.push(`Invoice ${credit.invoiceId} shows ${money(credit.unallocatedCents)} that is not matched to this yet. Open its page to match it.`);
    }
  }
  const last = papers.invoices.at(-1);
  const closedOn = offer ? null : claimClosedOn(workspace, view, commitment);
  return {
    id: commitment.id,
    vendor: vendorName(view, commitment),
    reference: commitment.reference,
    offer,
    conditions: [...(commitment.conditions ?? [])],
    promisedCents: commitment.promisedCents,
    creditedCents: creditedSoFarCents(commitment),
    owedCents,
    due: commitment.dueDate,
    firstDue: commitment.originalDueDate ?? commitment.dueDate,
    overdue: isOverdue(view, commitment),
    // the time to claim it ran out: there is no letter to send, only what happened to look at
    closed: closedOn ? { on: closedOn, line: plainReason([`Claim deadline ${closedOn} expired`]) } : null,
    quote: quote?.text ?? '',
    working: workingFor(view, commitment, quote),
    asides,
    boxCents: boxCentsFor(commitment.promisedCents),
    papers,
    offers: offersFor(workspace, view, commitment),
    letter: offer || closedOn ? null : letterFor(workspace, view, commitment, keeper),
    nextInvoice: demo && !offer ? nextInvoiceFor(view, commitment, day) : null,
    paidNote: !offer && owedCents === 0 && last
      ? `Invoice ${last.id} shows the ${papers.invoices.length > 1 ? 'other' : 'whole'} ${money(last.creditCents)}. Paid in full.`
      : '',
  };
}

/**
 * The date to put on a paper made today. The engine keeps its days in UTC, and
 * late in the day that is already tomorrow in the Americas. The visitor's own
 * date is used when the engine will take it (it never takes a date after its own).
 */
export const dayFor = (view, day) => (typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day) && day <= view.asOf ? day : view.asOf);

/** The engine's view of the workspace as of today, knowing everything recorded so far. */
export function viewFor(workspace, now = new Date().toISOString()) {
  const last = workspace.events.at(-1)?.observedAt;
  const knownAt = last && last > now ? last : now;
  return evaluateWorkspace(workspace, { asOf: knownAt.slice(0, 10), knownAt });
}

/**
 * The whole book: every promise in the workspace in the order it was written
 * down, and the totals.
 * @param {object} workspace   the assurance workspace (`workspace` on the app's useAssurance hook)
 * @param {object} [options]   now: ISO instant; keeper: keeperFor(service); demo: show the demo lever;
 *                             day: the visitor's own date, for papers the demo dates today
 * @returns {{ stamp, today, keeper, demo, promises, totals } | null}
 */
export function bookFor(workspace, { now = new Date().toISOString(), keeper = keeperFor(), demo = false, day } = {}) {
  if (!workspace) return null;
  const view = viewFor(workspace, now);
  day = dayFor(view, day);
  return {
    stamp: [workspace.id, workspace.revision, view.asOf, keeper.signature, keeper.actorId, demo].join('|'),
    today: view.asOf,
    keeper,
    demo,
    promises: view.commitments.map((commitment) => promiseFor(workspace, view, commitment, { keeper, demo, day })),
    totals: totalsFor(view),
  };
}
