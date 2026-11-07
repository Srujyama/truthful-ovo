import { evaluateWorkspace, isDate, reduceWorkspace, validateWorkspace } from './assurance/index.mjs';
import { moneyToCents } from './engine/index.mjs';
import { mutationReason } from './assurance-ui.mjs';

const commandTypes = { register:'REGISTER_CREDIT', allocate:'ALLOCATE_CREDIT', apply:'APPLY_CREDIT', reverse:'REVERSE_CREDIT' };
const titles = { register:'Supplied credit record', allocate:'Supplied credit attribution', apply:'Supplied invoice application', reverse:'Supplied credit reversal' };
const requireValue = (condition, message) => { if (!condition) throw new Error(message); };

function amount(value, label, { optional = false } = {}) {
  if (optional && (value == null || (typeof value === 'string' && !value.trim()))) return 0;
  requireValue(typeof value === 'string', `${label}: enter a USD decimal amount.`);
  let result;
  try { result = moneyToCents(value); }
  catch (error) { throw new Error(`${label}: ${error.message}`); }
  requireValue(optional || result > 0, `${label} must be greater than zero.`);
  return result;
}

function identifier(value, label) {
  requireValue(typeof value === 'string' && value.trim() && value.length <= 200, `${label} must contain 1–200 characters.`);
  return value.trim();
}

/**
 * Prepare a source-backed local ledger batch and project its exact reducer effects.
 * This does not mutate the workspace or authenticate the supplied evidence. The
 * caller must commit the whole batch against the reviewed workspace revision.
 */
export function prepareCreditWorkflow(workspace, input, { actor, now, readOnly = false } = {}) {
  requireValue(input && Object.hasOwn(commandTypes, input.operation), 'Choose a supported credit operation.');
  const restriction = mutationReason(commandTypes[input.operation], actor?.role, { readOnly });
  requireValue(!restriction, restriction);
  requireValue(typeof now === 'string' && /T/.test(now) && /(?:Z|[+-]\d{2}:\d{2})$/.test(now) && Number.isFinite(Date.parse(now)), 'Provide the current ISO observation time with a timezone.');
  now = new Date(now).toISOString();
  requireValue(!workspace?.events?.length || now >= workspace.events.at(-1).observedAt, 'Observation time cannot move backward. Refresh the workspace before recording evidence.');
  requireValue(isDate(input.effectiveDate), 'Use a real effective date in YYYY-MM-DD format.');
  requireValue(input.effectiveDate <= now.slice(0, 10), 'Evidence cannot establish a future ledger fact. Choose today or an earlier effective date.');
  requireValue(typeof input.sourceText === 'string' && input.sourceText.trim() && input.sourceText.length <= 250000, 'Add supporting source text of 1–250,000 characters.');
  const sourceTitle = input.sourceTitle == null || input.sourceTitle === '' ? titles[input.operation] : identifier(input.sourceTitle, 'Source title');
  const projection = { asOf:now.slice(0, 10), knownAt:now };
  const before = evaluateWorkspace(workspace, projection);
  const commitment = before.commitments.find(c => c.id === input.commitmentId);
  requireValue(commitment, 'The selected commitment is not present in current records. Return to latest records and select it again.');
  let credit = null;
  if (input.operation !== 'register') {
    credit = before.credits.find(c => c.id === input.creditId);
    requireValue(credit, 'Choose a credit from the current shared ledger.');
    requireValue(credit.vendorId === commitment.vendorId && credit.currency === commitment.currency && credit.reference === commitment.reference, 'Credit and selected commitment must have the same vendor, currency and exact reference.');
  }
  const sourceId = `source-${crypto.randomUUID()}`;
  const creditId = credit?.id || `credit-${crypto.randomUUID()}`;
  const commands = [{
    type:'ADD_SOURCE', source:{ id:sourceId, vendorId:commitment.vendorId, title:sourceTitle,
      kind:input.operation === 'apply' || (input.operation === 'register' && input.status === 'applied') ? 'invoice' : input.operation === 'allocate' ? 'allocation_record' : 'credit_memo', text:input.sourceText },
  }];
  if (input.operation === 'register') {
    requireValue(['issued','applied'].includes(input.status), 'Choose whether the credit is issued or applied on an invoice.');
    const amountCents = amount(input.amount, 'Credit amount');
    const allocationCents = amount(input.allocationAmount, 'Attribution amount', { optional:true });
    commands.push({ type:'REGISTER_CREDIT', credit:{ id:creditId, vendorId:commitment.vendorId, currency:'USD', reference:commitment.reference,
      invoiceId:identifier(input.invoiceId, 'Invoice or memo reference'), lineId:identifier(input.lineId, 'Credit line reference'), amountCents, status:input.status, sourceIds:[sourceId] } });
    if (allocationCents) commands.push({ type:'ALLOCATE_CREDIT', allocationId:`allocation-${crypto.randomUUID()}`, creditId, commitmentId:commitment.id, amountCents:allocationCents, sourceIds:[sourceId] });
  } else if (input.operation === 'allocate') {
    commands.push({ type:'ALLOCATE_CREDIT', allocationId:`allocation-${crypto.randomUUID()}`, creditId, commitmentId:commitment.id, amountCents:amount(input.amount, 'Attribution amount'), sourceIds:[sourceId] });
  } else if (input.operation === 'apply') {
    requireValue(credit.availableCents > 0, 'This credit has no remaining value to apply.');
    commands.push({ type:'APPLY_CREDIT', creditId, sourceIds:[sourceId] });
  } else {
    const amountCents = amount(input.amount, 'Reversal amount');
    const neededCents = Math.max(0, amountCents - credit.unallocatedCents);
    requireValue(input.allocationReversals == null || Array.isArray(input.allocationReversals), 'Provide a list of the attributed amounts to reverse.');
    const allocationReversals = (input.allocationReversals || []).map(row => ({ allocationId:identifier(row?.allocationId, 'Allocation reference'), amountCents:amount(row?.amount, 'Attributed reversal amount', { optional:true }) })).filter(row => row.amountCents > 0);
    requireValue(neededCents === 0 || allocationReversals.length > 0, `Choose explicit attributed reversals totaling USD ${(neededCents / 100).toFixed(2)}. Unattributed value is removed first.`);
    for (const row of allocationReversals) {
      const event = workspace.events.find(e => e.type === 'CREDIT_ALLOCATED' && e.payload.allocation.id === row.allocationId);
      requireValue(!event || event.effectiveDate <= input.effectiveDate, 'A reversal cannot predate an attribution it removes. Choose the attribution date or a later effective date.');
    }
    commands.push({ type:'REVERSE_CREDIT', creditId, amountCents, sourceIds:[sourceId], allocationReversals });
  }
  for (const command of commands) { command.id = `credit-workflow-${crypto.randomUUID()}`; command.effectiveDate = input.effectiveDate; }
  let next = workspace;
  for (const command of commands) next = reduceWorkspace(next, command, { actor, now }).state;
  // A backdated reversal must conserve the ledger at every intervening financial
  // boundary, not only at today's projection. No past allocation may lose backing.
  const dates = new Set([input.effectiveDate, projection.asOf, ...next.events.map(e => e.effectiveDate).filter(date => date >= input.effectiveDate && date <= projection.asOf)]);
  for (const asOf of dates) {
    const integrity = validateWorkspace(next, { asOf, knownAt:now });
    requireValue(integrity.valid, `This effective date would leave an inconsistent ledger on ${asOf}: ${integrity.violations.join(' ')}`);
  }
  const after = evaluateWorkspace(next, projection);
  const updatedCredit = after.credits.find(c => c.id === creditId);
  const affectedCommitments = after.commitments.map(c => {
    const previous = before.commitments.find(old => old.id === c.id);
    return { id:c.id, reference:c.reference, beforeVerifiedCents:previous.verifiedCents, afterVerifiedCents:c.verifiedCents,
      beforeOutstandingCents:previous.outstandingCents, afterOutstandingCents:c.outstandingCents };
  }).filter(c => c.id === commitment.id || c.beforeVerifiedCents !== c.afterVerifiedCents || c.beforeOutstandingCents !== c.afterOutstandingCents);
  return { commands, before, after, creditId, commitmentId:commitment.id, effects:{
    verifiedDeltaCents:after.totals.verifiedCents - before.totals.verifiedCents,
    outstandingDeltaCents:after.commitments.reduce((n,c) => n + c.outstandingCents, 0) - before.commitments.reduce((n,c) => n + c.outstandingCents, 0),
    issuedDeltaCents:after.totals.issuedCents - before.totals.issuedCents,
    creditAvailableBeforeCents:credit?.availableCents || 0, creditAvailableAfterCents:updatedCredit.availableCents,
    unallocatedAfterCents:updatedCredit.unallocatedCents, affectedCommitments,
  } };
}
