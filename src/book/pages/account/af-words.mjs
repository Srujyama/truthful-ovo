// What the account page's forms say when a check finds a problem, and the small
// things they need to turn what was typed into what the checking functions want.
//
// The checking functions (src/credit-workflow.mjs, credit-resolution.mjs,
// amendment-workflow.mjs) and the engine under them answer in their own words.
// plainProblem() says the same thing to a person and keeps their figures.
// No React in here.

import { day, dollars } from '../../shell/money.mjs';

/** What was typed in a money blank, as the credit functions want it: " $1,500.50 " → "1,500.50". */
export const typedAmount = text => String(text ?? '').trim().replace(/^\$\s*/, '');

/** The same without its commas, for the one function that refuses them: "1,800" → "1800". */
export function bareAmount(text) {
  const typed = typedAmount(text);
  return /^\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?$/.test(typed) ? typed.replaceAll(',', '') : typed;
}

/** Cents as they are typed into a form: 150000 → "1,500", 1250 → "12.50". */
export const typedDollars = cents => dollars(cents).replace(/^\$/, '');

/** What someone typed in a money blank → cents, or null when it is not an amount. */
export function centsTyped(text) {
  const hit = /^(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?$/.exec(typedAmount(text));
  if (!hit) return null;
  const cents = Number(hit[1].replaceAll(',', '')) * 100 + Number((hit[2] || '').padEnd(2, '0') || 0);
  return Number.isSafeInteger(cents) ? cents : null;
}

/** The title a paper gets when the title blank is left empty. */
export function paperTitle(job, { number = '', kind = 'issued' } = {}) {
  if (job === 'register') return kind === 'applied' ? `Invoice ${number}`.trim() : `Credit note ${number}`.trim();
  if (job === 'apply') return `Invoice that shows ${number}`;
  if (job === 'allocate') return `Which promise ${number} covers`;
  if (job === 'reverse') return `Money taken back from ${number}`;
  if (job === 'settle') return `What settles ${number}`;
  return 'What they wrote';
}

const AMOUNTS = {
  'Credit amount': 'The amount',
  'Attribution amount': 'The amount to match',
  'Reversal amount': 'The amount to take back',
  'Attributed reversal amount': 'The amount to take from a match',
  'Assignment limit': 'The most a promise may take',
  'Amended promise': 'The new amount',
  'Baseline cost': 'What you pay now',
  'Incremental renewal cost': 'The extra it would cost',
};
const amountLabel = new RegExp(`^(${Object.keys(AMOUNTS).join('|')})\\b`);

/**
 * A problem found by a check, as a sentence.
 *   plainProblem(error, { credit, neededCents, noteCents })
 * `credit` is the note the form is about, when it has one; `noteCents` the amount typed for a new one;
 * `neededCents` is how much of a take-back has to come off the matches.
 */
export function plainProblem(error, { credit = null, neededCents = null, noteCents = null } = {}) {
  // The engine's own name for the problem, when it leads the message ("CONFLICT: …"), is dropped.
  const text = String(error?.message || error || '').trim().replace(/^[A-Z][A-Z_]{3,}:\s+/, '');
  if (!text) return 'That did not go through. Check it again.';
  const starts = start => text.startsWith(start);
  const has = part => text.includes(part);

  // who, and when
  if (starts('Requires ') || starts('This command requires')) return 'That is not yours to write with this pen.';
  if (starts('Historical view')) return 'You have turned the book back. Come back to today to change it.';
  if (has('Observation time') || has('ISO observation time')) return 'This computer’s clock is behind the book’s last entry. Set the clock and check it again.';
  if (starts('Wait for the current operation')) return 'One second, the last entry is still going in.';

  // dates
  if (has('future ledger fact') || has('cannot be future-dated') || has('cannot establish already applied credit')) return 'That date has not come yet. Use today or an earlier day.';
  if (starts('Use a real effective date') || starts('Effective date must be')) return 'Give the date it took effect.';
  if (starts('Application date must follow issuance')) return credit?.issuedDate ? `The invoice cannot be dated before the note itself, ${day(credit.issuedDate)}.` : 'The invoice cannot be dated before the note itself.';
  if (starts('Allocation cannot predate')) return 'That date is before the credit or before the promise. Use a later day.';
  if (starts('A reversal cannot predate an attribution')) return 'That date is before the match it undoes. Use the day of the match or a later one.';
  if (starts('A reversal cannot predate its credit')) return 'That date is before the note itself. Use a later day.';
  if (starts('A resolution cannot take effect before')) return credit?.issuedDate ? `That date is before the note itself, ${day(credit.issuedDate)}. Use a later day.` : 'That date is before the note itself. Use a later day.';
  if (has('would leave an inconsistent ledger on')) {
    const on = /inconsistent ledger on (\d{4}-\d{2}-\d{2})/.exec(text)?.[1];
    return `With that date the book would not add up on ${day(on)}. Use a later day.`;
  }
  if (starts('Assignment limits exceed available credit on')) return `On ${day(/on (\d{4}-\d{2}-\d{2})/.exec(text)?.[1])} the note was not worth that much. Use a later day or smaller amounts.`;
  if (has('would be below its active attribution on')) return 'A promise already has more matched to it than that. Give it at least what is matched.';
  if (starts('Choose a real amendment effective date')) return 'Give the date the change takes effect.';
  if (starts('Choose a real amended due date')) return 'Give the new due date.';
  if (starts('Choose a real claim deadline')) return 'Give the new last day to claim, or leave it empty if there is no last day any more.';

  // the paper behind the entry
  if (has('supporting source text') || has('clarification source text') || has('Source text must contain')) {
    return 'Paste the paper’s text. Every entry needs the paper behind it.';
  }
  if (starts('Source title') || starts('Clarification title')) return 'The paper’s title can be 200 characters at most.';

  // the credit itself
  if (starts('Choose whether the credit is issued')) return 'Say which it is: a note they issued, or a credit already on an invoice.';
  if (starts('Invoice or memo reference') || starts('Invoice ID')) return 'Give the number printed on the invoice or the note.';
  if (starts('Credit line reference') || starts('Ledger line ID')) return 'Give the line’s own reference, 200 characters at most.';
  if (starts('This vendor invoice line is already registered')) return 'That line of that invoice is already in the book.';
  if (starts('Choose a credit from') || starts('Choose a credit present') || /^Credit .+ was not found/.test(text)) return 'That credit is no longer in the book.';
  if (starts('The selected commitment is not present') || starts('Select a commitment')) return 'This promise is no longer in the book.';
  if (starts('Credit and selected commitment must have') || starts('Credit and commitment must have')) return 'That credit carries a different reference. It belongs to another promise.';
  if (starts('This credit has no remaining value')) return 'All of this note was taken back. Nothing is left to show on an invoice.';
  if (starts('This credit is already applied')) return 'This note is already on an invoice.';
  if (starts('No commitment has this exact vendor')) return 'No promise in the book carries this credit’s reference.';
  if (starts('Multiple commitments share') || has('source-backed resolution is required')) return 'This note could belong to more than one promise. An approver has to say which before any of it is matched.';
  if (starts('This credit is already allocated or')) {
    if (credit) return `Only ${dollars(credit.unallocatedCents)} of ${credit.invoiceId} is left to match.`;
    return Number.isSafeInteger(noteCents) ? `The credit is ${dollars(noteCents)}. Match that much of it or less.` : 'That is more than the credit has left to match.';
  }
  if (starts('Allocation exceeds the explicit resolution limit')) return 'That is more than an approver said this promise may take from the note.';

  // taking it back
  if (starts('Choose explicit attributed reversals') || starts('Allocation reversal amounts must equal') || starts('A partial reversal spanning')) {
    const stated = /USD ([\d.]+)/.exec(text)?.[1];
    const cents = Number.isSafeInteger(neededCents) ? neededCents : stated ? Math.round(Number(stated) * 100) : null;
    return cents != null ? `${dollars(cents)} of that has to come off what is matched. The amounts taken from the matches must add up to it.` : 'The amounts taken from the matches must add up to what the note can no longer cover.';
  }
  if (starts('Cannot reverse more than the remaining credit')) return credit ? `${credit.invoiceId} is only worth ${dollars(credit.availableCents)} now. Take back that much or less.` : 'That is more than the note is still worth.';
  if (starts('Cannot reverse more than the allocated amount')) return 'That is more than is matched there.';
  if (starts('Reversal allocations must be unique') || /^Active allocation .+ was not found/.test(text)) return 'That match is no longer in the book. Check it again.';

  // sorting out which promise a note covers
  if (starts('Choose a recorded credit clarification source')) return 'Choose the paper that settles it. An analyst adds one first.';
  if (starts('Set at least one explicit positive assignment limit')) return 'Give at least one promise an amount. A promise left empty may take nothing from the note.';
  if (starts('Resolution limits exceed available credit')) return credit ? `Those add up to more than ${credit.invoiceId} is worth, ${dollars(credit.availableCents)}.` : 'Those add up to more than the note is worth.';
  if (starts('Resolution cannot erase an existing active allocation')) return 'A promise already has more matched to it than that. Give it at least what is matched, or take the match back first.';
  if (starts('Every assignment must match') || starts('A resolution cannot override')) return 'One of those promises carries a different reference. The note cannot cover it.';

  // changed terms
  if (starts('Select at least one term to change') || starts('Select the supported fields')) return 'Tick what they changed.';
  if (starts('The selected terms match the current agreement')) return 'That is what the promise already says. Change one of the things you ticked.';
  if (starts('Use at most 20 conditions')) return 'Twenty strings at most, each 1,000 characters or shorter.';
  if (starts('Enter conditions as one condition per line')) return 'Write the strings one to a line.';
  if (/^(?:Describe the|A renewal proposal needs an) explicit (?:renewal )?baseline/.test(text)) return 'Say what the extra is measured against, in a line. Something like: the same plan for 12 months at $6,000 a month.';

  // amounts, whichever blank they were typed in
  const which = amountLabel.exec(text)?.[1];
  if (which) {
    const label = AMOUNTS[which];
    if (has('greater than zero') || has('outside the supported amount')) return `${label} has to be more than zero.`;
    if (has('safe integer')) return `${label} is too large for the book.`;
    return `${label} goes in as dollars, like 600 or 600.50.`;
  }
  if (starts('Command would violate a financial invariant')) return 'The book would not add up after that, so nothing was written.';
  return text;
}
