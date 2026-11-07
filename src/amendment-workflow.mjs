import { canonical, evaluateWorkspace, isDate, reduceWorkspace } from './assurance/index.mjs';
import { mutationReason } from './assurance-ui.mjs';

const fields = ['promisedCents', 'dueDate', 'claimDeadline', 'conditions'];

function amount(value, label, allowZero = false) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text.length > 32 || !/^\d+(?:\.\d{1,2})?$/.test(text)) throw new Error(`${label} needs a USD amount with at most two decimal places.`);
  const [whole, fraction = ''] = text.split('.');
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (cents > BigInt(Number.MAX_SAFE_INTEGER) || cents < (allowZero ? 0n : 1n)) throw new Error(`${label} is outside the supported amount.`);
  return Number(cents);
}

/** Prepare source, proposal, and its review action as one checked, non-mutating batch. */
export function prepareAmendmentWorkflow(workspace, input, { actor, now, readOnly = false } = {}) {
  const reason = mutationReason('PROPOSE_AMENDMENT', actor?.role, { readOnly });
  if (reason) throw new Error(reason);
  if (!input || typeof input !== 'object') throw new Error('Provide the changed terms to review.');
  if (['vendorId', 'reference', 'currency', 'patch'].some(key => Object.hasOwn(input, key))) throw new Error('Vendor, reference and currency cannot be changed in this workflow.');
  if (typeof now !== 'string' || !/T/.test(now) || !/(?:Z|[+-]\d{2}:\d{2})$/.test(now) || !Number.isFinite(Date.parse(now))) throw new Error('Use an ISO observation time with a timezone.');
  now = new Date(now).toISOString();
  if (workspace?.events?.at(-1)?.observedAt > now) throw new Error('Observation time cannot precede the latest recorded evidence.');
  const before = evaluateWorkspace(workspace, { asOf: now.slice(0, 10), knownAt: now });
  const commitment = before.commitments.find(c => c.id === input.commitmentId);
  if (!commitment) throw new Error('Select a commitment in the current workspace.');
  if (!isDate(input.effectiveDate)) throw new Error('Choose a real amendment effective date.');
  if (input.renewal != null && typeof input.renewal !== 'boolean') throw new Error('Specify whether this proposal includes a renewal obligation.');
  const renewal = input.renewal === true;
  if (!input.changes || Object.keys(input.changes).some(key => !fields.includes(key)) || Object.values(input.changes).some(value => typeof value !== 'boolean')) throw new Error('Select the supported fields to change.');
  const patch = {};
  if (input.changes.promisedCents) patch.promisedCents = amount(input.promisedAmount, 'Amended promise');
  if (input.changes.dueDate) {
    if (!isDate(input.dueDate)) throw new Error('Choose a real amended due date.');
    patch.dueDate = input.dueDate;
  }
  if (input.changes.claimDeadline) {
    if (input.claimDeadline !== '' && !isDate(input.claimDeadline)) throw new Error('Choose a real claim deadline, or leave it empty to remove it.');
    patch.claimDeadline = input.claimDeadline || null;
  }
  if (input.changes.conditions) {
    if (typeof input.conditions !== 'string') throw new Error('Enter conditions as one condition per line.');
    patch.conditions = input.conditions.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    if (patch.conditions.length > 20 || patch.conditions.some(line => line.length > 1000)) throw new Error('Use at most 20 conditions, each at most 1,000 characters.');
  }
  const retainedFields = [];
  if (!Object.keys(patch).length) {
    if (!renewal) throw new Error('Select at least one term to change.');
    // The bounded reducer requires an explicit terms patch. Preserve the current
    // credit amount when only the new renewal obligation changes; this amount
    // is included in the returned amendment and preview rather than invented.
    patch.promisedCents = commitment.promisedCents;
    retainedFields.push('promisedCents');
  }
  if (!renewal && Object.entries(patch).every(([key, value]) => canonical(value) === canonical(commitment[key]))) throw new Error('The selected terms match the current agreement. Change a term before preparing a proposal.');
  if (typeof input.sourceText !== 'string' || !input.sourceText.trim() || input.sourceText.length > 250000) throw new Error('Add 1–250,000 characters of supporting source text.');
  if (input.sourceTitle != null && typeof input.sourceTitle !== 'string') throw new Error('Source title must be text.');
  const title = input.sourceTitle?.trim() || 'Supplied proposed terms';
  if (title.length > 200) throw new Error('Source title must be at most 200 characters.');
  const economics = renewal ? {
    newCommitment: true,
    baselineCostCents: amount(input.baselineAmount, 'Baseline cost', true),
    incrementalRenewalCostCents: amount(input.incrementalAmount, 'Incremental renewal cost', true),
    baselineDescription: typeof input.baselineDescription === 'string' ? input.baselineDescription.trim() : '',
  } : {};
  if (renewal && (!economics.baselineDescription || economics.baselineDescription.length > 2000)) throw new Error('Describe the explicit renewal baseline in 1–2,000 characters.');
  const sourceId = `source-${crypto.randomUUID()}`;
  const amendmentId = `amendment-${crypto.randomUUID()}`;
  const actionId = `action-${crypto.randomUUID()}`;
  const commands = [
    { type: 'ADD_SOURCE', source: { id: sourceId, vendorId: commitment.vendorId, title, kind: 'proposed_terms', text: input.sourceText } },
    { type: 'PROPOSE_AMENDMENT', amendment: { id: amendmentId, commitmentId: commitment.id, kind: renewal ? 'renewal' : 'terms_change', patch, effectiveDate: input.effectiveDate, sourceIds: [sourceId], ...economics } },
    { type: 'PROPOSE_ACTION', action: { id: actionId, commitmentId: commitment.id, type: 'accept_amendment', payload: { amendmentId } } },
  ];
  let afterState = workspace;
  for (const command of commands) afterState = reduceWorkspace(afterState, command, { actor, now }).state;
  const after = evaluateWorkspace(afterState, { asOf: now.slice(0, 10), knownAt: now });
  return {
    commands, amendmentId, actionId, before, after, retainedFields,
    previewNotice: retainedFields.length ? 'The current promise amount is retained explicitly. The proposed change is a new renewal obligation with the supplied baseline and incremental cost.' : '',
  };
}
