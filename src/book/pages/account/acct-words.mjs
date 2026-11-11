// Words and small sums the account page needs, kept out of the JSX so they can be read in one place.

import { dollars, shortDay } from '../../shell/money.mjs';

const HOUSE_RULES = [
  'Policy forbids new contractual commitments.',
  'Incremental renewal cost exceeds the policy limit.',
];

/** Is this one of the three house rules (the ones the owner can change), or a fact about the promise? */
export function isHouseRule(reason) {
  return HOUSE_RULES.includes(reason) || String(reason).startsWith('Action amount exceeds');
}

/**
 * Why a decision is stopped, said to a person. `reason` is one of the engine's sentences
 * (action.policyDecision.reasons); the figures come from the decision and the rules in force.
 */
export function plainReason(reason, { action, policy, asOf } = {}) {
  const text = String(reason || '');
  const year = asOf ? String(asOf).slice(0, 4) : undefined;
  const dateIn = () => shortDay(/\d{4}-\d{2}-\d{2}/.exec(text)?.[0], year);
  if (text === 'Policy forbids new contractual commitments.') return 'The house rules say no to an offer that ties you to something new.';
  if (text === 'Incremental renewal cost exceeds the policy limit.') {
    const extra = action?.economics?.incrementalRenewalCostCents;
    const limit = policy?.renewalLimitCents;
    const allowed = limit > 0 ? `only ${dollars(limit)}` : 'none';
    return Number.isSafeInteger(extra) ? `It brings ${dollars(extra)} of extra spending. The house rules allow ${allowed}.` : `It brings more extra spending than the house rules allow (${allowed}).`;
  }
  if (text.startsWith('Action amount exceeds')) {
    return `It is for ${dollars(action?.amountCents)}. The house rules stop at ${dollars(policy?.claimLimitCents)}.`;
  }
  if (text.startsWith('Unresolved amendment conflict')) return 'Their two offers disagree. Decline the other one first.';
  if (text.startsWith('Claim deadline ')) return `Their window for claims closed ${dateIn()}.`;
  if (text.startsWith('The promise is not due until')) return `It is not due until ${dateIn()}.`;
  if (text.startsWith('The original commitment is conditional')) return 'This is an offer with strings. Take it or decline it first.';
  if (text === 'No outstanding original credit remains.') return 'It is paid in full. Nothing is left to ask for.';
  if (text === 'This amendment has already been accepted.') return 'You already took this offer.';
  if (text.startsWith('This amendment was dismissed:')) return `You declined this offer: ‘${text.slice('This amendment was dismissed:'.length).trim().replace(/\.$/, '')}’.`;
  if (text.startsWith('The amendment accepted-term or source basis is stale')) return 'The promise changed after they made this offer. Ask them to make it again.';
  if (text.startsWith('This proposal conflicts with accepted future terms')) return 'It clashes with terms you already took, which start later.';
  if (text.startsWith('The commitment is not effective')) return 'This promise had not started by that date.';
  return text;
}

/** The reasons a decision is stopped, in plain words, each said once. */
export function plainReasons(action, context) {
  const reasons = action?.policyDecision?.allowed === false ? action.policyDecision.reasons : [];
  return [...new Set(reasons.map(reason => plainReason(reason, { ...context, action })))];
}

/** "5,000" or "5,000.50": cents as they are typed into a form. */
export function typedDollars(cents) {
  return dollars(cents).replace(/^\$/, '');
}

/** What someone typed in a money blank → cents, or null when it is not an amount. */
export function centsFrom(text) {
  const hit = /^\$?\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?$/.exec(String(text || '').trim());
  if (!hit) return null;
  const cents = Number(hit[1].replace(/,/g, '')) * 100 + Number((hit[2] || '').padEnd(2, '0') || 0);
  return Number.isSafeInteger(cents) ? cents : null;
}

/** Which stock a paper is on and what it is called, from how it was filed and what it is to this promise. */
export function paperLook(paper, commitment) {
  const kind = paper.kind;
  const isOffer = paper.roles?.includes('changed-terms') || kind === 'proposed_terms' || (paper.roles?.includes('promise') && commitment?.conditions?.length > 0);
  if (isOffer) return { stock: 'manila', name: 'Offer' };
  if (kind === 'invoice') return { stock: 'cool', name: 'Invoice' };
  if (kind === 'credit_memo') return { stock: 'carbon', name: 'Credit note' };
  if (kind === 'contract') return { stock: 'laid', name: 'Agreement' };
  if (kind === 'incident') return { stock: 'bond', name: 'Report' };
  if (kind === 'allocation_record' || kind === 'allocation_resolution') return { stock: 'bond', name: 'Matching note' };
  return { stock: 'bond', name: 'Letter' };
}

/**
 * The strip of boxes for a promise: how much one box is worth, how many there are,
 * and how many are punched (money that reached an invoice).
 * One box is $100 up to $4,000; above that, the smallest round value that keeps it to 40 boxes.
 */
export function stripFor(promisedCents, creditedCents, paid = false) {
  let boxCents = 10000;
  if (promisedCents > 400000) {
    search: for (let scale = 10000; ; scale *= 10) {
      for (const step of [1, 2, 2.5, 5]) {
        boxCents = step * scale;
        if (promisedCents / boxCents <= 40) break search;
      }
    }
  }
  const boxes = Math.max(promisedCents / boxCents, 0.4);
  const count = Math.floor(boxes + 1e-9) + (boxes - Math.floor(boxes + 1e-9) > 0.02 ? 1 : 0);
  const punched = paid ? count : Math.min(count, Math.floor(creditedCents / boxCents + 1e-9));
  return { boxCents, boxes, count, punched };
}
