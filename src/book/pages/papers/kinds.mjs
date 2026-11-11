// The pure parts of the Papers page: what each kind of paper is called and what
// stock it is on, what lies in the drawer, which passages of a paper's own text
// hold the figures Truthful read, and where a credit note's money went.
//
// Nothing here touches the DOM or React, so the account page and the company
// page can draw a paper the same way the drawer does:
//
//   import { paperLook, paperTurn } from './papers/kinds.mjs';
//   const { noun, stock } = paperLook(source.kind);        // 'Letter', 'bond'
//   <Paper as="a" href={href('papers', paperId(source.id, source.revision))}
//          className="bk-doc bk-thumb" stock={stock} rot={paperTurn(source.id)}>…</Paper>
//
// (or use <PaperThumb> from ./Thumb.jsx, which is that with the print on it.)

import { sourceLibrary, sourceUsages } from '../../../operations.mjs';
import { documentReading } from '../../../document-reading.mjs';
import { day, dollars } from '../../shell/money.mjs';

// ————————————————————————————————————————————————— what a paper is called

/** The engine's source kinds as the book says them: a noun, a paper stock, a filter group. */
const KINDS = {
  email: { noun: 'Letter', stock: 'bond', group: 'letters' },
  invoice: { noun: 'Invoice', stock: 'cool', group: 'invoices' },
  credit_memo: { noun: 'Credit note', stock: 'carbon', group: 'credit-notes' },
  contract: { noun: 'Agreement', stock: 'laid', group: 'agreements' },
  agent_conversation: { noun: 'Offer', stock: 'manila', group: 'offers' },
  proposed_terms: { noun: 'Offer', stock: 'manila', group: 'offers' },
  incident: { noun: 'Service report', stock: 'cool', group: 'reports' },
  allocation_record: { noun: 'Note on file', stock: 'bond', group: 'notes' },
  allocation_resolution: { noun: 'Note on file', stock: 'bond', group: 'notes' },
};
const UNKNOWN = { noun: 'Paper', stock: 'bond', group: 'other' };

/** The filter groups, in the order they are offered. `some` is how a sentence names a few of them. */
export const GROUPS = [
  { id: 'letters', label: 'Letters', some: 'letters' },
  { id: 'invoices', label: 'Invoices', some: 'invoices' },
  { id: 'credit-notes', label: 'Credit notes', some: 'credit notes' },
  { id: 'agreements', label: 'Agreements', some: 'agreements' },
  { id: 'offers', label: 'Offers', some: 'offers' },
  { id: 'reports', label: 'Reports', some: 'reports' },
  { id: 'notes', label: 'Notes on file', some: 'notes' },
  { id: 'other', label: 'Other papers', some: 'other papers' },
];

/**
 * How to draw a paper of this kind.
 *   paperLook('email')    → { noun: 'Letter',  stock: 'bond',   group: 'letters' }
 *   paperLook('invoice')  → { noun: 'Invoice', stock: 'cool',   group: 'invoices' }
 *   paperLook('whatever') → { noun: 'Paper',   stock: 'bond',   group: 'other' }
 * `stock` is the `stock` prop of <Paper>; `group` is the id of the drawer filter it sits under.
 */
export function paperLook(kind) {
  return { ...(KINDS[kind] || UNKNOWN) };
}

/** `?kind=` may hold a group ('letters') or one of the engine's kinds ('email'). Anything else is no filter. */
export function groupFor(value) {
  if (!value) return '';
  if (GROUPS.some(group => group.id === value)) return value;
  return KINDS[value]?.group || '';
}

function hash(seed) {
  let h = 2166136261;
  for (const ch of String(seed)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  // stir it once more, or ids that end alike ("…@21", "…@23") come out turned alike
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/** A paper's resting turn in degrees, from its id: between 0.6 and 2.3 either way, the same on every visit. */
export function paperTurn(seed) {
  const h = hash(seed);
  const size = 0.6 + ((h >>> 8) % 1000) / 1000 * 1.7;
  return Number(((h & 1 ? 1 : -1) * size).toFixed(2));
}

/** How far down the row a paper has slid, in px: 0 to 18, from its id. */
export function paperDrop(seed) {
  return hash(`${seed}:drop`) % 19;
}

/** The first lines of a paper for a small copy of it. A heading line in capitals at the very top is left off. */
export function openingLines(text, most = 420) {
  const lines = String(text ?? '').split('\n');
  while (lines.length > 1 && (!lines[0].trim() || /^[A-Z0-9][A-Z0-9 .:·&-]{7,}$/.test(lines[0].trim()))) lines.shift();
  return lines.join('\n').slice(0, most);
}

// ————————————————————————————————————————————————— what lies in the drawer

const companyOf = (view, id) => view.vendors.find(vendor => vendor.id === id)?.name || 'A company not in the book';
const has = (text, query) => !query.trim() || String(text).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
const same = (link, source) => link.sourceId === source.id && link.revision === source.revision;

/** What a credit is called: a credit note when one was sent, a credit on an invoice when it only ever was a line. */
export function creditNoun(view, credit) {
  const kinds = (credit.sourceLinks || []).map(link => view.sourceVersions.find(source => same(link, source))?.kind);
  return !kinds.includes('credit_memo') && kinds.includes('invoice') ? 'Invoice credit' : 'Credit note';
}

/** One paper as the drawer shows it. `address` is what goes after #/papers/. */
export function paperItem(view, source) {
  const look = paperLook(source.kind);
  const copies = view.sourceVersions.filter(item => item.id === source.id).sort((a, b) => a.revision - b.revision);
  const next = copies.find(item => item.revision > source.revision);
  return {
    key: `paper:${source.id}@${source.revision}`,
    type: 'paper',
    address: `${source.id}@${source.revision}`,
    sourceId: source.id,
    revision: source.revision,
    ...look,
    title: source.title || look.noun,
    vendorId: source.vendorId,
    company: companyOf(view, source.vendorId),
    date: source.effectiveDate || String(source.observedAt || '').slice(0, 10),
    lines: openingLines(source.text),
    order: source.revision,
    current: !next,
    replacedOn: next ? String(next.observedAt || next.effectiveDate || '').slice(0, 10) : '',
  };
}

/** One credit note as the drawer shows it. */
export function noteItem(view, credit) {
  return {
    key: `credit:${credit.id}`,
    type: 'credit',
    address: `credit:${credit.id}`,
    creditId: credit.id,
    noun: creditNoun(view, credit),
    stock: 'carbon',
    group: 'credit-notes',
    title: credit.invoiceId,
    reference: credit.reference,
    vendorId: credit.vendorId,
    company: companyOf(view, credit.vendorId),
    date: credit.issuedDate || '',
    amountCents: credit.amountCents,
    onInvoice: credit.status === 'applied',
    order: credit.revision,
    current: true,
    replacedOn: '',
  };
}

/**
 * Every paper in the drawer, newest first: the papers on file and the credit notes.
 * query: what was typed after Find. versions: 'current' (the copy on file) or 'all' (older copies too).
 */
export function drawerPapers(view, { query = '', versions = 'current' } = {}) {
  const papers = sourceLibrary(view, { query, versions }).map(source => paperItem(view, source));
  const notes = view.credits
    .filter(credit => has(`${companyOf(view, credit.vendorId)} ${credit.invoiceId} ${credit.reference} ${credit.lineId || ''} credit note`, query))
    .map(credit => noteItem(view, credit));
  return [...papers, ...notes].sort((a, b) => b.order - a.order || a.key.localeCompare(b.key));
}

/**
 * A credit note not on an invoice yet: a credit line still only issued, or a credit-note paper
 * whose every credit is. The figure draws these like a note coin, in a red ring.
 */
export function waitingOnInvoice(view, item) {
  if (item.type === 'credit') return !item.onInvoice;
  if (item.group !== 'credit-notes') return false;
  const credits = view.credits.filter(credit => (credit.sourceLinks || []).some(link => link.sourceId === item.sourceId));
  return credits.length > 0 && credits.every(credit => credit.status !== 'applied');
}

/** Filter words with counts, All first. A group with nothing in it is not offered. The counts add up to All. */
export function filterCounts(items) {
  const counts = GROUPS.map(group => ({ id: group.id, label: group.label, count: items.filter(item => item.group === group.id).length }));
  return [{ id: 'all', label: 'All', count: items.length }, ...counts.filter(group => group.count > 0)];
}

/** The same for companies, by name. */
export function companyCounts(view, items) {
  const counts = view.vendors
    .map(vendor => ({ id: vendor.id, label: vendor.name, count: items.filter(item => item.vendorId === vendor.id).length }))
    .filter(vendor => vendor.count > 0)
    .sort((a, b) => a.label.localeCompare(b.label));
  return [{ id: 'all', label: 'Every company', count: items.length }, ...counts];
}

/** What to say when a filter finds nothing: what was looked for, in one sentence. */
export function nothingFound({ group = '', company = '', query = '', by = '' } = {}) {
  const what = GROUPS.find(item => item.id === group)?.some || 'papers';
  const from = company ? ` from ${company}` : '';
  const word = query.trim();
  if (by) return `No ${what}${from}${word ? ` that mention “${word}”` : ''} had come in by ${day(by)}.`;
  if (word) return `No ${what}${from} mention “${word}”.`;
  return `No ${what}${from} on file yet.`;
}

// ————————————————————————————————————————————————— what Truthful read in a paper

// The reading module's labels, said the way the book says them. `worked` marks a
// line Truthful worked out or decided: it is not a figure printed in the paper,
// so it is never looked for in the text.
const FACT_WORDS = {
  Decision: { label: 'Where it stands', worked: true },
  'Credit offered': { label: 'They offer' },
  'Offer amount': { label: 'They offer' },
  'Extra spending': { label: 'Extra you’d pay' },
  'Extra cost after credit': { label: 'That costs you', worked: true },
  'Comparison spending': { label: 'You’d pay otherwise' },
  'Proposed spending': { label: 'Their new price' },
  'Proposed date': { label: 'They ask to pay on' },
  'Original date': { label: 'First promised for' },
  'Proposed amount': { label: 'New amount they ask for' },
  'Takes effect': { label: 'Starts' },
  'Credit note amount': { label: 'Credit' },
  'Invoice credit': { label: 'Credit on this invoice' },
  Invoice: { label: 'Invoice number' },
  Reference: { label: 'Their reference' },
  'Current case claim deadline': { label: 'Claim by' },
  'Related agreement': { label: 'Under agreement' },
  'Originally promised': { label: 'They promised' },
  'Expected on': { label: 'Due' },
};
const STANDING = {
  'Not accepted': 'Waiting for your answer',
  'Replaced by a later proposal': 'Replaced by a later offer',
  'Accepted for a future date': 'Accepted, starts later',
};

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTH = 'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?';
const WHOLE = String.raw`\d{1,3}(?:,\d{3})+|\d+`;
const monthIndex = name => MONTHS.indexOf(name.slice(0, 3).toLowerCase()) + 1;

/** "$2,400" → 240000, "$12.50" → 1250; anything else → null. */
function centsOf(value) {
  const hit = new RegExp(String.raw`^[−-]?\$\s?(${WHOLE})(?:\.(\d{2}))?$`).exec(String(value).trim());
  return hit ? Number(hit[1].replaceAll(',', '')) * 100 + Number(hit[2] || 0) : null;
}

/** "October 1, 2026", "Oct 1, 2026" or "2026-10-01" → { y, m, d }; anything else → null. */
function dateOf(value) {
  const text = String(value).trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (iso) return { y: Number(iso[1]), m: Number(iso[2]), d: Number(iso[3]) };
  const named = new RegExp(String.raw`^(${MONTH})\.?\s+(\d{1,2}),?\s+(\d{4})$`, 'i').exec(text);
  return named ? { y: Number(named[3]), m: monthIndex(named[1]), d: Number(named[2]) } : null;
}

/** Every place the text names an amount of money: "USD 2,400", "$900", "1,500.00 USD", a bare "900.00". */
function moneyMentions(text) {
  const found = [];
  const add = (hit, whole, part) => {
    if (found.some(m => hit.index < m.end && hit.index + hit[0].length > m.start)) return;
    found.push({ start: hit.index, end: hit.index + hit[0].length, cents: Number(whole.replaceAll(',', '')) * 100 + Number((part || '').padEnd(2, '0')) });
  };
  for (const hit of text.matchAll(new RegExp(String.raw`(?:USD|US\$|\$)\s?(${WHOLE})(?:\.(\d{1,2})(?!\d))?`, 'gi'))) add(hit, hit[1], hit[2]);
  for (const hit of text.matchAll(new RegExp(String.raw`(?<![\w.])(${WHOLE})(?:\.(\d{1,2}))?\s?(?:USD|dollars)\b`, 'gi'))) add(hit, hit[1], hit[2]);
  for (const hit of text.matchAll(new RegExp(String.raw`(?<![\w.])(${WHOLE})\.(\d{2})(?![\d%])`, 'g'))) add(hit, hit[1], hit[2]);
  return found;
}

/** Every place the text names a day: "October 1, 2026", "Oct 1", "1 October 2026", "2026-10-01". */
function dateMentions(text) {
  const found = [];
  const add = (hit, y, m, d) => {
    if (!m || found.some(item => hit.index < item.end && hit.index + hit[0].length > item.start)) return;
    found.push({ start: hit.index, end: hit.index + hit[0].length, y: y ? Number(y) : null, m, d: Number(d) });
  };
  for (const hit of text.matchAll(new RegExp(String.raw`\b(${MONTH})\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?!\d)(?:,?\s+(\d{4})(?!\d))?`, 'gi'))) add(hit, hit[3], monthIndex(hit[1]), hit[2]);
  for (const hit of text.matchAll(new RegExp(String.raw`\b(\d{1,2})(?:st|nd|rd|th)?\s+(${MONTH})\b\.?(?:,?\s+(\d{4})(?!\d))?`, 'gi'))) add(hit, hit[3], monthIndex(hit[2]), hit[1]);
  for (const hit of text.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) add(hit, hit[1], Number(hit[2]), hit[3]);
  return found;
}

function literalMentions(text, value) {
  const needle = String(value).trim().toLowerCase();
  const found = [];
  if (needle.length < 3) return found;
  const hay = text.toLowerCase();
  for (let at = hay.indexOf(needle); at >= 0; at = hay.indexOf(needle, at + needle.length)) found.push({ start: at, end: at + needle.length });
  return found;
}

/**
 * Where, in a paper's own text, each fact was printed.
 *   findPassages(source.text, [{ label: 'They promised', value: '$2,400' }, { label: 'Due', value: 'Oct 1, 2026' }])
 *   → [{ start: 43, end: 52, facts: [0] }, { start: 61, end: 76, facts: [1] }]
 * The text is never changed: start and end are positions in the original string. A fact that
 * reads as money is matched by its amount, however the paper wrote it ("USD 2,400", "$2,400.00");
 * a date by its day ("October 1, 2026", "2026-10-01"); anything else by its own letters.
 * A fact marked `worked` was worked out, not printed, and is never matched.
 * Two facts that are the same figure share one passage. Passages come back in order and never overlap.
 */
export function findPassages(text, facts) {
  const source = String(text ?? '');
  const money = moneyMentions(source), dates = dateMentions(source);
  const marks = new Map();
  const mark = (mention, index) => {
    const key = `${mention.start}:${mention.end}`;
    const found = marks.get(key) || { start: mention.start, end: mention.end, facts: [] };
    if (!found.facts.includes(index)) found.facts.push(index);
    marks.set(key, found);
  };
  (facts || []).forEach((fact, index) => {
    if (!fact || fact.worked || fact.value == null || fact.value === '') return;
    const cents = centsOf(fact.value), date = dateOf(fact.value);
    if (cents != null) money.filter(m => m.cents === cents).forEach(m => mark(m, index));
    else if (date) dates.filter(d => d.m === date.m && d.d === date.d && (d.y == null || d.y === date.y)).forEach(d => mark(d, index));
    else literalMentions(source, fact.value).forEach(m => mark(m, index));
  });
  const kept = [];
  for (const passage of [...marks.values()].sort((a, b) => a.start - b.start || b.end - a.end)) {
    if (!kept.length || passage.start >= kept.at(-1).end) kept.push(passage);
  }
  return kept;
}

/** The text cut at its passages, for printing: [{ text, passage | null }]. Joined back together it is the text. */
export function splitByPassages(text, passages) {
  const source = String(text ?? '');
  const parts = [];
  let at = 0;
  for (const passage of passages) {
    if (passage.start > at) parts.push({ text: source.slice(at, passage.start), passage: null });
    parts.push({ text: source.slice(passage.start, passage.end), passage });
    at = passage.end;
  }
  if (at < source.length) parts.push({ text: source.slice(at), passage: null });
  return parts;
}

const shortDate = value => {
  const date = dateOf(value);
  return date ? day(`${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`) : value;
};

/**
 * What Truthful read in one paper: [{ label, value, worked? }], in the book's words.
 * It starts from documentReading's facts, then adds the amount, the dates and the
 * reference of a promise this paper is behind when the paper itself prints them.
 */
export function paperFacts(view, source) {
  const reading = documentReading(view, source);
  const facts = [];
  const add = (label, value, worked = false) => {
    if (value == null || value === '') return;
    if (facts.some(fact => fact.value === value && (fact.label === label || !worked))) return;
    facts.push(worked ? { label, value, worked: true } : { label, value });
  };
  for (const fact of reading.facts) {
    const words = FACT_WORDS[fact.label] || { label: fact.label };
    add(words.label, words.worked ? (STANDING[fact.value] || fact.value) : shortDate(fact.value), Boolean(words.worked));
  }
  for (const section of reading.sections) if (/condition/i.test(section.label)) add('Only if', section.text);

  const text = String(source.text ?? '');
  const printed = (label, value) => { if (value && findPassages(text, [{ label, value }]).length) add(label, value); };
  const behind = view.commitments.filter(commitment => (commitment.sourceLinks || []).some(link => same(link, source)));
  for (const commitment of behind) {
    printed(source.kind === 'incident' ? 'Supports a claim of' : commitment.conditions?.length ? 'They offer' : 'They promised', dollars(commitment.originalPromisedCents ?? commitment.promisedCents));
    printed('Due', day(commitment.originalDueDate ?? commitment.dueDate));
    printed('Claim by', day(commitment.claimDeadline));
  }
  const changed = view.amendments.filter(amendment => (amendment.sourceLinks || []).some(link => same(link, source))).map(amendment => view.commitments.find(commitment => commitment.id === amendment.commitmentId));
  for (const commitment of [...behind, ...changed]) if (commitment) printed('Their reference', commitment.reference);
  return facts;
}

/** One line, as the bookkeeper would note it on the slip: what this paper is. '' when it is only a paper. */
export function whatItIs(view, source) {
  const { kind, visual } = documentReading(view, source);
  const sum = cents => (Number.isSafeInteger(cents) ? dollars(cents) : '');
  if (kind === 'promise') return `A promise of ${sum(visual.faceCents)}, due ${day(visual.expectedDate)}.`;
  if (kind === 'offer') {
    const amount = sum(visual.faceCents ?? visual.creditCents);
    return amount ? `An offer of ${amount}, with strings attached.` : 'An offer with strings attached.';
  }
  if (kind === 'date-change') return `They ask to pay on ${day(visual.newDate)} instead.`;
  if (kind === 'changed-terms') return 'They ask to change what they promised.';
  if (kind === 'credit-note') return `A credit note for ${sum(visual.creditCents)}.`;
  if (kind === 'invoice') return `An invoice that takes off ${sum(visual.creditCents)}.`;
  if (kind === 'agreement') return 'The agreement a promise rests on.';
  if (kind === 'incident') return 'The report a claim rests on.';
  if (kind === 'correction') return 'A correction to a credit note.';
  if (kind === 'matching') return 'A note saying which promise a credit covers.';
  return '';
}

// ————————————————————————————————————————————————— where a paper is used

const DECISIONS = {
  prepare_claim: action => `The decision to ask for ${dollars(action.amountCents)}`,
  preserve_original: () => 'The decision to keep the original promise',
};
const OFFERS = { renewal: 'renewal offer', date_change: 'ask to pay later' };

/** One use of a paper, as a line and a place to go: { label, to: [page, id, query] } for href(...to). */
function describeUse(view, usage) {
  const commitment = view.commitments.find(item => item.id === usage.commitmentIds[0]);
  const company = commitment ? companyOf(view, commitment.vendorId) : '';
  const account = query => (commitment ? ['iou', commitment.id, query || null] : null);
  if (usage.kind === 'commitment') {
    return commitment && { label: `${company}’s ${commitment.conditions?.length ? 'offer' : 'promise'} of ${dollars(commitment.originalPromisedCents ?? commitment.promisedCents)}`, to: account() };
  }
  if (usage.kind === 'amendment') {
    const amendment = view.amendments.find(item => item.id === usage.id);
    const what = OFFERS[amendment?.kind] || 'changed terms';
    const state = amendment?.accepted ? ', accepted' : amendment?.rejected ? ', declined' : '';
    return commitment && { label: `${company}’s ${what}${state}`, to: account(usage.actionId ? { a: usage.actionId } : null) };
  }
  if (usage.kind === 'action') {
    const action = view.actions.find(item => item.id === usage.id);
    if (!action || !commitment) return null;
    const amendment = action.payload?.amendmentId && view.amendments.find(item => item.id === action.payload.amendmentId);
    const label = DECISIONS[action.type]?.(action) || `The decision on their ${OFFERS[amendment?.kind] || 'changed terms'}`;
    return { label, to: account({ a: action.id }) };
  }
  if (usage.kind === 'allocation') {
    const allocation = view.allocations.find(item => item.id === usage.id);
    return commitment && { label: `${dollars(allocation?.activeCents ?? allocation?.amountCents ?? 0)} matched to ${company}’s promise`, to: account() };
  }
  const creditId = usage.kind === 'reversal'
    ? view.graph.edges.find(edge => edge.from === usage.id && edge.relation === 'reverses')?.to.replace(/^credit:/, '')
    : usage.id;
  const credit = view.credits.find(item => item.id === creditId);
  if (!credit) return account() && { label: `${company}’s promise`, to: account() };
  const note = `${creditNoun(view, credit).toLowerCase()} ${credit.invoiceId}`;
  const label = usage.kind === 'credit' ? `${note[0].toUpperCase()}${note.slice(1)} for ${dollars(credit.amountCents)}`
    : usage.kind === 'application' ? `The invoice that shows ${note}`
    : usage.kind === 'resolution' ? `Which promise ${note} covers`
    : `Money taken back from ${note}`;
  return { label, to: ['papers', `credit:${credit.id}`, null] };
}

/**
 * Where one copy of a paper is used: the promises, offers, credit notes and decisions that rest on it.
 * A decision is listed only when it is about a promise this paper is behind. (The engine notes every
 * paper on file against every decision; that would put a Parcel email under a Nimbus claim.)
 */
export function paperUses(view, sourceId, revision) {
  const all = sourceUsages(view, sourceId, revision);
  const direct = all.filter(usage => usage.kind !== 'action');
  const own = new Set(direct.flatMap(usage => usage.commitmentIds));
  const decisions = all.filter(usage => usage.kind === 'action' && usage.commitmentIds.some(id => own.has(id)));
  const uses = [], seen = new Set();
  for (const usage of [...direct, ...decisions]) {
    const use = describeUse(view, usage);
    const key = use && JSON.stringify(use.to);
    if (!use || seen.has(key)) continue;
    seen.add(key);
    uses.push(use);
  }
  return uses;
}

/** Every copy of a paper, newest first: [{ revision, receivedAt, current, replacedAt }]. */
export function paperCopies(view, sourceId) {
  const copies = view.sourceVersions.filter(source => source.id === sourceId).sort((a, b) => b.revision - a.revision);
  return copies.map((source, index) => ({
    revision: source.revision,
    receivedAt: source.observedAt || source.effectiveDate || '',
    current: index === 0,
    replacedAt: index === 0 ? '' : copies[index - 1].observedAt || copies[index - 1].effectiveDate || '',
  }));
}

// ————————————————————————————————————————————————— a credit note

/** Where a credit note's money went, in its own figures. The three add up to the note. */
export function creditMoney(credit) {
  return {
    noteCents: credit.amountCents || 0,
    matchedCents: credit.allocatedCents || 0,
    takenBackCents: credit.reversedCents || 0,
    unmatchedCents: credit.unallocatedCents || 0,
  };
}

/** The promises a credit note is matched to, one line per promise: [{ commitmentId, amountCents }]. */
export function creditMatches(credit) {
  const byPromise = new Map();
  for (const allocation of credit.allocations || []) {
    if (allocation.activeCents > 0) byPromise.set(allocation.commitmentId, (byPromise.get(allocation.commitmentId) || 0) + allocation.activeCents);
  }
  return [...byPromise].map(([commitmentId, amountCents]) => ({ commitmentId, amountCents }));
}

/** The papers behind a credit note, each once, oldest first: the note, its invoice, who it was matched by, what took money back. */
export function creditPapers(view, credit) {
  const takenBack = view.graph.edges.filter(edge => edge.relation === 'reverses' && edge.to === `credit:${credit.id}`).map(edge => edge.from);
  const links = [
    ...(credit.sourceLinks || []),
    ...(credit.applicationSourceLinks || []),
    ...(credit.resolution?.sourceLinks || []),
    ...(credit.allocations || []).flatMap(allocation => allocation.sourceLinks || []),
  ].map(link => `${link.sourceId}@${link.revision}`);
  for (const edge of view.graph.edges) if (takenBack.includes(edge.to) && edge.from.startsWith('source:')) links.push(edge.from.slice(7));
  return [...new Set(links)]
    .map(address => view.sourceVersions.find(source => `${source.id}@${source.revision}` === address))
    .filter(Boolean)
    .sort((a, b) => a.revision - b.revision);
}
