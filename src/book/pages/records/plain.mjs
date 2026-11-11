// The words for the pages that read the book: To do, Companies, Day book, Balance.
//
// The engine names its work for an auditor. These say the same thing to the
// person at the desk, with the row's own company, money and dates.
//
//   todoLine(row, view?)          → { what, waitsOn, roles }   one To do row
//   todoLines(row, view?, kind?)  → that line, and whatever else the same promise needs
//   waitingOn(line, pen)          → "you" when the pen in your hand is the one it waits for
//   dayLine(event, view)          → "Pipeline CRM promised $2,400, due Oct 1."
//   dayKind(event)                → which of DAY_KINDS a day-book line belongs to
//   whoWrote(actor)               → "The demo book" | a name | "Approver"
//   standing(c, asOf), standingWords(c, asOf), standingLine(list, asOf)

import { dollars, shortDay } from '../../shell/money.mjs';
import { roleName } from '../../shell/roles.mjs';
import { EVENT_KIND, TITLE } from './engine.mjs';

const COUNT = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six'];
const countWord = n => COUNT[n] || String(n);
const money = cents => (Number.isSafeInteger(cents) ? dollars(cents) : '');

// ————————————————————————————————————————————————— To do

/** The kinds a To do line comes in, in the order the page lists them. */
export const TODO_KINDS = [
  { id: 'urgent', label: 'Running out of time' },
  { id: 'review', label: 'To decide' },
  { id: 'evidence', label: 'Missing a paper' },
  { id: 'claim', label: 'To chase' },
  { id: 'scheduled', label: 'Not due yet' },
];

const you = { waitsOn: 'you', roles: [] };
const paper = waitsOn => ({ waitsOn, roles: [] });
const pen = (waitsOn, ...roles) => ({ waitsOn, roles });

/** What two or more offers both try to change. */
function disagreeOn(c, view) {
  const offers = (view?.amendments || []).filter(a => c?.conflictingAmendmentIds?.includes(a.id));
  if (offers.length < 2) return '';
  const both = key => offers.every(a => a.patch && key in a.patch);
  if (both('dueDate')) return ' on the date';
  if (both('promisedCents')) return ' on the amount';
  return '';
}

const SAY = {
  [TITLE.expired]: ({ c }) => ({
    what: `Their claim window closed ${shortDay(c.deadline.date)}. ${money(c.outstandingCents)} is at stake.`,
    ...(c.issuedCents > 0 ? paper('their invoice') : you),
  }),
  [TITLE.competing]: ({ c, view }) => {
    const n = c.conflictingAmendmentIds.length;
    return {
      what: `${countWord(n)} offers disagree${disagreeOn(c, view)}. Take one or decline ${n === 2 ? 'both' : 'them all'}.`,
      ...pen('an approver', 'approver'),
    };
  },
  [TITLE.whichPromise]: () => ({
    what: 'A credit could cover more than one promise. Say which.',
    ...pen('an approver', 'approver'),
  }),
  [TITLE.unmatched]: ({ row }) => ({
    what: `A ${money(row.amountCents)} credit matches no promise. Find the one it covers.`,
    ...pen('an analyst', 'analyst'),
  }),
  [TITLE.newerCopy]: () => ({
    what: 'One of their papers has a newer copy. Read it against the promise.',
    ...you,
  }),
  [TITLE.prepareAgain]: () => ({
    what: 'The papers changed after the decision was prepared. Prepare it again.',
    ...pen('an analyst', 'analyst', 'approver'),
  }),
  [TITLE.stopped]: ({ row, c, view }) => {
    const why = String(row.reason || '');
    if (/deadline .*expired/i.test(why) && c.deadline?.date) {
      return { what: `The claim can’t go out. Their window closed ${shortDay(c.deadline.date)}.`, ...you };
    }
    if (/renewal|new contractual/i.test(why)) {
      const extra = view?.actions?.find(a => a.id === row.actionId)?.economics?.incrementalRenewalCostCents;
      const more = extra > 0 ? `spend ${money(extra)} more` : 'spend more';
      const credit = money(c.conditions?.length ? c.promisedCents : c.outstandingCents);
      return { what: `Their ${credit} comes only if you ${more}. The house rules say no.`, ...pen('the owner', 'admin') };
    }
    if (/conflict/i.test(why)) return { what: 'Another offer has to be declined first.', ...pen('an approver', 'approver') };
    return { what: 'The house rules stop this decision.', ...pen('the owner', 'admin') };
  },
  [TITLE.approved]: () => ({
    what: 'The decision is approved. Write it in the book.',
    ...pen('the bookkeeper', 'executor'),
  }),
  [TITLE.prepared]: ({ row, view }) => {
    const action = view?.actions?.find(a => a.id === row.actionId);
    const which = action?.type === 'prepare_claim' ? `The claim for ${money(action.amountCents)}`
      : action?.type === 'preserve_original' ? 'The decision to keep the original promise'
        : action?.type === 'accept_amendment' ? 'The decision to take their offer'
          : 'A decision';
    return { what: `${which} is prepared. It needs a yes.`, ...pen('an approver', 'approver') };
  },
  [TITLE.matchCredit]: () => ({
    what: 'A credit from them is on file. Match it to this promise.',
    ...pen('an analyst', 'analyst'),
  }),
  [TITLE.needsInvoice]: ({ c }) => ({
    what: `Add the invoice that shows the ${money(c.issuedCents)} credit.`,
    ...paper('their invoice'),
  }),
  [TITLE.strings]: ({ c }) => ({
    what: `Their ${money(c.promisedCents)} has strings attached. Take the offer or decline it.`,
    ...pen('an approver', 'approver'),
  }),
  [TITLE.chase]: ({ c }) => ({
    what: c.verifiedCents > 0
      ? `The invoice came ${money(c.outstandingCents)} short. Ask for the rest.`
      : `Nothing on an invoice yet. Ask for the ${money(c.outstandingCents)}.`,
    ...pen('an analyst', 'analyst', 'approver'),
  }),
  [TITLE.notDue]: ({ c }) => ({
    what: `Due ${shortDay(c.dueDate)}. Nothing to do until then.`,
    ...paper(shortDay(c.dueDate)),
  }),
};

/**
 * One To do row, said to a person. `roles` are the pens that can do it (empty when it
 * waits on a paper, a date, or anyone at all). A title this does not know comes back as it is.
 */
export function todoLine(row, view = null) {
  const say = SAY[row?.title];
  const c = row?.commitment || null;
  if (!say || (!c && row.title !== TITLE.unmatched)) return { what: row?.title || 'Something needs a hand.', ...you };
  return say({ row, c, view });
}

/**
 * A row's main line, and under it whatever else the same promise needs.
 * With a kind picked, the line of that kind leads.
 */
export function todoLines(row, view = null, kind = '') {
  const issues = row.issues?.length ? row.issues : [row];
  const lead = (kind && row.category !== kind && issues.find(issue => issue.category === kind)) || issues[0];
  const main = todoLine({ ...row, ...lead }, view);
  const closed = issues.some(issue => issue.title === TITLE.expired);
  const said = new Set([main.what]);
  const also = [];
  for (const issue of issues) {
    if (issue === lead) continue;
    // The window closing is already the headline; the claim it stopped is the same news.
    if (closed && issue.title === TITLE.stopped && /deadline .*expired/i.test(issue.reason || '')) continue;
    const line = todoLine({ ...row, ...issue }, view);
    if (said.has(line.what)) continue;
    said.add(line.what);
    also.push({ ...line, category: issue.category, actionId: issue.actionId || null });
  }
  return { ...main, category: lead.category, actionId: lead.actionId ?? row.actionId ?? null, also };
}

/** "you" when the pen in your hand is one the line waits for; otherwise who or what it waits on. */
export function waitingOn(line, penRole) {
  if (!line.roles?.length) return line.waitsOn;
  return penRole === 'admin' || line.roles.includes(penRole) ? 'you' : line.waitsOn;
}

// ————————————————————————————————————————————————— where an IOU stands

/** offer | paid | closed (the claim window shut) | overdue | due */
export function standing(c, asOf) {
  if (c.conditions?.length) return 'offer';
  if (c.outstandingCents === 0) return 'paid';
  if (c.deadline?.state === 'expired') return 'closed';
  if (c.dueDate < asOf) return 'overdue';
  return 'due';
}

export function standingWords(c, asOf) {
  switch (standing(c, asOf)) {
    case 'offer': return 'an offer with strings attached';
    case 'paid': return 'paid in full';
    case 'closed': return `claim window closed ${shortDay(c.deadline.date)}`;
    case 'overdue': return `overdue since ${shortDay(c.dueDate)}${c.deadline?.date ? `, claim by ${shortDay(c.deadline.date)}` : ''}`;
    default: return c.dueDate === asOf ? 'due today' : `due ${shortDay(c.dueDate)}`;
  }
}

/** One company's IOUs in a few words: the one it has, or how many and how many are late. */
export function standingLine(commitments, asOf) {
  if (!commitments?.length) return 'nothing promised yet';
  if (commitments.length === 1) return standingWords(commitments[0], asOf);
  const late = commitments.filter(c => ['overdue', 'closed'].includes(standing(c, asOf))).length;
  return `${commitments.length} IOUs${late ? `, ${late} overdue` : ''}`;
}

// ————————————————————————————————————————————————— the day book

/** The kinds a day-book line comes in. */
export const DAY_KINDS = [
  { id: 'promises', label: 'Promises' },
  { id: 'papers', label: 'Papers' },
  { id: 'credits', label: 'Credits' },
  { id: 'offers', label: 'Offers' },
  { id: 'decisions', label: 'Decisions' },
  { id: 'companies', label: 'Companies' },
  { id: 'rules', label: 'House rules' },
  { id: 'other', label: 'Other' },
];

export const dayKind = event => EVENT_KIND[event?.type] || 'other';

/** Who wrote a line: a name when the book has one, otherwise the pen they held. */
export function whoWrote(actor) {
  if (!actor) return 'Nobody';
  if (actor.id === 'seed-curator') return 'The demo book';
  if (actor.name && !/^Demo /i.test(actor.name)) return actor.name;
  return roleName(actor.role);
}

// The same nouns the Papers drawer prints on each kind (./papers/kinds.mjs), in lower case.
const PAPER_NOUN = {
  email: 'letter',
  invoice: 'invoice',
  credit_memo: 'credit note',
  contract: 'agreement',
  incident: 'service report',
  agent_conversation: 'offer',
  proposed_terms: 'offer',
  allocation_record: 'note on file',
  allocation_resolution: 'note on file',
};
export const paperNoun = kind => PAPER_NOUN[kind] || 'paper';

const byId = (list, id) => (list || []).find(item => item.id === id) || null;

/** "credit note CM-NC-204" or "invoice INV-PC-1026": a note stays a note after it reaches an invoice. */
function creditName(credit) {
  if (!credit) return 'a credit';
  const note = credit.status === 'issued' || credit.applicationSourceLinks?.length;
  return `${note ? 'credit note' : 'invoice'} ${credit.invoiceId}`;
}

/** An offer, in the words that follow "their": "offer to pay later", "renewal offer", "offer". */
function offerNoun(amendment, c) {
  if (!amendment) return 'offer';
  if (amendment.newCommitment || amendment.incrementalRenewalCostCents > 0) return 'renewal offer';
  if (amendment.patch?.dueDate) return c && amendment.patch.dueDate < c.originalDueDate ? 'offer of an earlier date' : 'offer to pay later';
  return 'offer of different terms';
}

/** What a decision does, to follow "A decision was prepared:". */
function decisionWords(action, view, company) {
  if (!action) return 'the next step';
  const c = byId(view?.commitments, action.commitmentId);
  if (action.type === 'preserve_original') return `keep the original promise and ask for ${money(action.amountCents)}`;
  if (action.type === 'prepare_claim') return `ask ${company || 'them'} for ${money(action.amountCents)}`;
  if (action.type === 'accept_amendment') {
    const amendment = byId(view?.amendments, action.payload?.amendmentId);
    const extra = action.economics?.incrementalRenewalCostCents ?? amendment?.incrementalRenewalCostCents;
    if (extra > 0) return `take the renewal offer and spend ${money(extra)} more`;
    if (amendment?.patch?.dueDate) return `take the ${c && amendment.patch.dueDate < c.originalDueDate ? 'earlier' : 'later'} date, ${shortDay(amendment.patch.dueDate)}`;
    return 'take their offer';
  }
  return 'the next step';
}

/**
 * One line of the day book, written from what the entry holds.
 * `event` is a raw event or a workspaceActivity row; `view` gives the names behind its ids.
 */
export function dayLine(event, view) {
  const p = event?.payload || {};
  const action = p.action || byId(view?.actions, p.actionId);
  const amendment = p.amendment || byId(view?.amendments, p.amendmentId || action?.payload?.amendmentId);
  const credit = p.credit || byId(view?.credits, p.creditId || p.allocation?.creditId);
  const c = p.commitment || byId(view?.commitments, p.commitmentId || p.allocation?.commitmentId || amendment?.commitmentId || action?.commitmentId);
  const vendorId = p.vendor?.id || p.source?.vendorId || credit?.vendorId || c?.vendorId;
  const company = p.vendor?.name || byId(view?.vendors, vendorId)?.name || event?.vendorNames?.[0] || 'A company';

  switch (event?.type) {
    case 'VENDOR_ADDED':
      return `Opened a page for ${company}.`;
    case 'SOURCE_ADDED':
      return `Filed ${company}’s ${paperNoun(p.source?.kind)}, “${p.source?.title || 'untitled'}”.`;
    case 'SOURCE_REVISED':
      return `Filed a newer copy of ${company}’s ${paperNoun(p.source?.kind)}, “${p.source?.title || 'untitled'}”.`;
    case 'COMMITMENT_CREATED':
      if (c?.conditions?.length) return `${company} offered ${money(c.promisedCents)} with strings attached: “${c.conditions.join(' ')}”`;
      return `${company} promised ${money(c?.promisedCents)}, due ${shortDay(c?.dueDate)}.${c?.claimDeadline ? ` Claims close ${shortDay(c.claimDeadline)}.` : ''}`;
    case 'CREDIT_REGISTERED':
      return credit?.status === 'issued'
        ? `${company} sent credit note ${credit.invoiceId} for ${money(credit.amountCents)}.`
        : `Invoice ${credit?.invoiceId} took off ${money(credit?.amountCents)}.`;
    case 'CREDIT_APPLIED':
      return credit ? `Credit note ${credit.invoiceId} showed up on an invoice.` : 'A credit note showed up on an invoice.';
    case 'CREDIT_ALLOCATED':
    case 'ALLOCATION_CREATED':
      return `Matched ${money(p.allocation?.amountCents ?? p.amountCents)} of ${creditName(credit)} to ${c ? `the ${money(c.promisedCents)} promise` : 'a promise'}.`;
    case 'CREDIT_REVERSED':
      return `Took back ${money(p.amountCents)} of ${creditName(credit)}.`;
    case 'CREDIT_RESOLVED': {
      const n = p.assignments?.length || 0;
      return `Said which ${n > 1 ? `${countWord(n).toLowerCase()} promises` : 'promise'} ${creditName(credit)} may cover.`;
    }
    case 'AMENDMENT_PROPOSED': {
      if (amendment?.newCommitment || amendment?.incrementalRenewalCostCents > 0) {
        const offered = c ? money(Math.max(0, (amendment.patch?.promisedCents ?? c.promisedCents) - (c.verifiedCents || 0))) : 'a credit';
        return `They offered ${offered} if you renew. That means spending ${money(amendment.incrementalRenewalCostCents)} more.`;
      }
      if (amendment?.patch?.dueDate) return `They offered to pay ${c && amendment.patch.dueDate < c.originalDueDate ? 'sooner' : 'later'}: ${shortDay(amendment.patch.dueDate)}.`;
      if (Number.isSafeInteger(amendment?.patch?.promisedCents)) return `They offered a different amount: ${money(amendment.patch.promisedCents)}.`;
      return 'They offered different terms.';
    }
    case 'AMENDMENT_ACCEPTED': {
      const extra = p.economics?.incrementalRenewalCostCents ?? amendment?.incrementalRenewalCostCents;
      if (extra > 0) return `Took their renewal offer. It adds ${money(extra)} of spending.`;
      if (amendment?.patch?.dueDate) return `Took their ${offerNoun(amendment, c)}: ${shortDay(amendment.patch.dueDate)}.`;
      return `Took their ${offerNoun(amendment, c)}.`;
    }
    case 'AMENDMENT_DISMISSED':
      return `Declined their ${offerNoun(amendment, c)}${p.reason ? `: “${String(p.reason).trim().replace(/\.+$/, '')}”` : ''}.`;
    case 'POLICY_SET': {
      const rules = p.policy || {};
      return `Set the house rules: a claim may be up to ${money(rules.claimLimitCents)}, a renewal may add up to ${money(rules.renewalLimitCents)}, and an offer ${rules.allowNewCommitments ? 'may' : 'may not'} add a new obligation.`;
    }
    case 'ACTION_PROPOSED':
      return `A decision was prepared: ${decisionWords(action, view, company)}.`;
    case 'ACTION_APPROVED':
      return `Approved: ${decisionWords(action, view, company)}.`;
    case 'ACTION_EXECUTED':
      return `Written in the book: ${decisionWords(action, view, company)}.`;
    case 'WORKSPACE_RESET':
      return 'The demo book went back to its first page.';
    default:
      return `Something else went in the book: ${String(event?.type || 'an entry').toLowerCase().replaceAll('_', ' ')}.`;
  }
}
