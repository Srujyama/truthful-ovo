// What the book asks the app to do, as the app's own commands.
//
// Each function here turns one thing a visitor does on the book into a batch
// for the assurance workspace (the `commands` of the app's useAssurance hook). None of them changes
// anything: the reducer in src/assurance decides whether the batch is allowed,
// and every other screen reads the result from the same workspace.
//
//   approveLetterCommands    Approve this letter        PROPOSE_ACTION (when needed) + APPROVE_ACTION
//   declineOfferCommands     Decline                    DISMISS_AMENDMENT
//   acceptOfferCommands      Accept                     PROPOSE_ACTION + APPROVE_ACTION + EXECUTE_ACTION
//   nextInvoiceCommands      The next invoice arrives   ADD_SOURCE + REGISTER_CREDIT + ALLOCATE_CREDIT,
//                                                       or ADD_SOURCE + APPLY_CREDIT for a credit note
//   readDocument             a paper dropped in the tray, read by the app's document engine

import { reduceWorkspace } from '../../assurance/index.mjs';
import { originalReviewState } from '../../assurance-ui.mjs';
import { prepareCreditWorkflow } from '../../credit-workflow.mjs';
import { prepareEvidenceImport } from '../../assuranceImport.mjs';
import { analyzeEvidence, parseInvoiceCsv } from '../../engine/index.mjs';
import { dayFor, isOffer, nextInvoiceFor, plainReason, stillOwedCents, viewFor } from './selectors.mjs';

/**
 * When the app turns a batch down, it says so in its own terms. This is the
 * same answer in words for the page.
 */
export function plainFailure(error) {
  if (error?.code === 'POLICY_BLOCKED') return plainReason(error.details?.reasons?.length ? error.details.reasons : ['blocked']);
  if (error?.code === 'FORBIDDEN') return 'Your sign-in is not allowed to do that. Open its page and ask someone who can approve.';
  if (['STALE_APPROVAL', 'STALE_REVISION', 'REVISION_CONFLICT', 'CONFLICT'].includes(error?.code)) return 'The book changed while you were reading. Look again, then try once more.';
  if (/Wait for the current operation/.test(error?.message ?? '')) return 'The book is still writing the last thing down. Try again in a moment.';
  if (/still opening|not in the book any more|Nothing is owed/.test(error?.message ?? '')) return error.message;
  return 'That did not go through. Open its page to see why.';
}

const fresh = (kind) => `${kind}-${crypto.randomUUID()}`;
const decimal = (cents) => (cents / 100).toFixed(2);
const same = (a, b) => a.normalize('NFC').trim().toLowerCase() === b.normalize('NFC').trim().toLowerCase();

function commitmentIn(view, id) {
  const commitment = view.commitments.find((item) => item.id === id);
  if (!commitment) throw new Error('That promise is not in the book any more.');
  return commitment;
}

/**
 * Approve the follow-up for a promise. The engine's action for it is "keep the
 * original terms" while an offer is on the table and "ask for the credit"
 * otherwise. An action already waiting, and still matching the records, is
 * approved as it is; otherwise a new one is recorded and approved together.
 */
export function approveLetterCommands(workspace, commitmentId, { now } = {}) {
  const view = viewFor(workspace, now);
  const commitment = commitmentIn(view, commitmentId);
  const review = originalReviewState(workspace, view, commitment);
  const action = review.action;
  const usable = action && action.type === review.specification.type && !action.executed && !action.proposalStale && !action.approvalStale
    && action.amountCents === stillOwedCents(commitment);
  if (usable && action.approval) return [];
  if (usable) return [{ type: 'APPROVE_ACTION', actionId: action.id }];
  const id = fresh('action');
  return [
    { type: 'PROPOSE_ACTION', action: { id, ...review.specification } },
    { type: 'APPROVE_ACTION', actionId: id },
  ];
}

/** Decline an offer. The engine keeps a reason with every refusal; an empty one is recorded as "No reason given". */
export function declineOfferCommands(amendmentId, reason = '') {
  return [{ type: 'DISMISS_AMENDMENT', amendmentId, reason: reason.trim().slice(0, 200) || 'No reason given' }];
}

/** Accept an offer: the engine's review of it is recorded if it is not there, approved, and carried out. */
export function acceptOfferCommands(workspace, commitmentId, amendmentId, { now } = {}) {
  const view = viewFor(workspace, now);
  commitmentIn(view, commitmentId);
  const waiting = view.actions.findLast((action) => action.commitmentId === commitmentId && action.type === 'accept_amendment'
    && action.payload?.amendmentId === amendmentId && !action.executed && !action.proposalStale && !action.approvalStale);
  if (waiting) return [...(waiting.approval ? [] : [{ type: 'APPROVE_ACTION', actionId: waiting.id }]), { type: 'EXECUTE_ACTION', actionId: waiting.id }];
  const id = fresh('action');
  return [
    { type: 'PROPOSE_ACTION', action: { id, commitmentId, type: 'accept_amendment', payload: { amendmentId } } },
    { type: 'APPROVE_ACTION', actionId: id },
    { type: 'EXECUTE_ACTION', actionId: id },
  ];
}

/**
 * The demo's next invoice: the rest of what is owed shows up on one.
 * A credit note already matched to the promise is applied by the invoice;
 * anything not covered by a note is a new credit line on it. The batch is the
 * one the app's own credit editor would record (src/credit-workflow.mjs).
 * `day` is the visitor's own date for the invoice, used when the engine will take it.
 * @returns {{ commands: object[], invoice: object }}
 */
export function nextInvoiceCommands(workspace, commitmentId, { actor, now, day }) {
  const view = viewFor(workspace, now);
  const today = dayFor(view, day);
  const commitment = commitmentIn(view, commitmentId);
  const invoice = nextInvoiceFor(view, commitment, today);
  if (!invoice) throw new Error('Nothing is owed on this any more.');
  const context = { actor, now };
  const paper = { commitmentId, effectiveDate: today, sourceText: invoice.text, sourceTitle: invoice.title };
  const commands = [];
  let state = workspace, left = invoice.creditCents;
  const record = (plan) => {
    commands.push(...plan.commands);
    for (const command of plan.commands) state = reduceWorkspace(state, command, context).state;
  };
  for (const credit of view.credits) {
    const matched = (credit.allocations ?? []).filter((allocation) => allocation.commitmentId === commitmentId).reduce((sum, allocation) => sum + allocation.activeCents, 0);
    if (credit.status !== 'issued' || credit.quarantined || matched <= 0 || left <= 0) continue;
    record(prepareCreditWorkflow(state, { ...paper, operation: 'apply', creditId: credit.id }, context));
    left -= matched;
  }
  if (left > 0) {
    record(prepareCreditWorkflow(state, {
      ...paper, operation: 'register', status: 'applied', invoiceId: invoice.id, lineId: `${invoice.id}-credit`,
      amount: decimal(left), allocationAmount: decimal(left),
    }, context));
  }
  return { commands, invoice };
}

// Lines of a credit spreadsheet (invoice_id, vendor, date, description, amount,
// currency, commitment_ref) that belong to a promise in the book.
function creditRows(workspace, text, { actor, now }) {
  const today = now.slice(0, 10);
  const context = { actor, now };
  const sheet = parseInvoiceCsv(text);
  if (sheet.errors.length || !sheet.rows.length) return { kind: 'missed', why: 'sheet' };
  let view = viewFor(workspace, now), state = workspace, known = 0, total = 0;
  const commands = [], vendors = new Set(), commitmentIds = new Set();
  for (const row of sheet.rows) {
    const vendor = view.vendors.find((item) => same(item.name, row.vendor));
    const commitment = vendor && view.commitments.find((item) => item.vendorId === vendor.id && item.reference === row.commitmentRef && item.currency === row.currency);
    if (!commitment || isOffer(commitment)) continue;
    if (view.credits.some((credit) => credit.vendorId === vendor.id && credit.invoiceId === row.invoiceId)) { known += 1; continue; }
    if (row.date > today || row.date < commitment.effectiveDate || stillOwedCents(commitment) === 0) continue;
    const plan = prepareCreditWorkflow(state, {
      operation: 'register', status: 'applied', commitmentId: commitment.id, effectiveDate: row.date,
      invoiceId: row.invoiceId, lineId: `${row.invoiceId}-line-${row.rowNumber}`,
      amount: decimal(row.amountCents), allocationAmount: decimal(row.amountCents),
      sourceText: text, sourceTitle: `${vendor.name} invoice ${row.invoiceId}`,
    }, context);
    commands.push(...plan.commands);
    for (const command of plan.commands) state = reduceWorkspace(state, command, context).state;
    view = viewFor(state, now);
    total += row.amountCents;
    vendors.add(vendor.name);
    commitmentIds.add(commitment.id);
  }
  if (!commands.length) return { kind: known ? 'known-invoice' : 'no-match' };
  return { kind: 'credit', commands, cents: total, vendors: [...vendors], commitmentIds: [...commitmentIds] };
}

/**
 * Read a paper dropped in the tray with the app's document engine
 * (src/engine) and say what it is:
 *   promise        a new promise: { commands, commitmentId, vendor, cents }
 *   credit         credit lines for promises in the book: { commands, cents, vendors, commitmentIds }
 *   known          that promise is already in the book: { commitmentId }
 *   known-invoice  that invoice is already in the book
 *   no-match       an invoice, but for nothing in the book
 *   offer          a credit with strings attached
 *   missed         not readable as a promise: { why: 'vendor' | 'reference' | 'date' | 'sheet' | 'sentence' }
 * `commands` go to the hook's `commands` as one batch.
 */
export async function readDocument(workspace, raw, { actor, now }) {
  const text = String(raw ?? '').replace(/\r\n?/g, '\n').trim();
  const today = now.slice(0, 10);
  if (/^﻿?\s*"?invoice_id"?\s*,/i.test(text)) return creditRows(workspace, text, { actor, now });

  const view = viewFor(workspace, now);
  const named = analyzeEvidence({ vendor: '', promiseText: text, asOf: today }).sourceVendor
    ?? view.vendors.find((vendor) => text.toLowerCase().includes(vendor.name.toLowerCase()))?.name;
  const report = analyzeEvidence({ vendor: named ?? 'A vendor', promiseText: text, asOf: today });
  if (report.condition) return { kind: 'offer' };
  if (report.promisedCents == null) return { kind: 'missed', why: 'sentence' };
  if (!named) return { kind: 'missed', why: 'vendor', cents: report.promisedCents };
  if (!report.commitmentRef) return { kind: 'missed', why: 'reference', cents: report.promisedCents };
  if (!report.dueDate) return { kind: 'missed', why: 'date', cents: report.promisedCents };
  if (report.errors.length) return { kind: 'missed', why: 'sentence' };
  let plan;
  try { plan = await prepareEvidenceImport(workspace, report, now); } catch { return { kind: 'missed', why: 'differs', cents: report.promisedCents }; }
  if (plan.alreadyTracked) return { kind: 'known', commitmentId: plan.commitmentId };
  return { kind: 'promise', commands: plan.commands, commitmentId: plan.commitmentId, vendor: report.vendor, cents: report.promisedCents };
}
