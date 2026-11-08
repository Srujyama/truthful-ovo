import { evaluateWorkspace, isDate, reduceWorkspace, validateWorkspace } from './assurance/index.mjs';
import { moneyToCents } from './engine/index.mjs';
import { mutationReason } from './assurance-ui.mjs';

const requireValue = (value, message) => { if (!value) throw new Error(message); };
const text = (value, label) => {
  requireValue(typeof value === 'string' && value.trim() && value.length <= 200, `${label} must contain 1–200 characters.`);
  return value.trim();
};

/** Record clarification separately from the approval that binds its exact revision. */
export function prepareCreditResolution(workspace, input, { actor, now, readOnly = false } = {}) {
  requireValue(input && ['evidence', 'resolve'].includes(input.operation), 'Choose clarification evidence or a credit resolution.');
  const reason = mutationReason(input.operation === 'evidence' ? 'ADD_SOURCE' : 'RESOLVE_CREDIT', actor?.role, { readOnly });
  requireValue(!reason, reason);
  requireValue(typeof now === 'string' && /T/.test(now) && /(?:Z|[+-]\d{2}:\d{2})$/.test(now) && Number.isFinite(Date.parse(now)), 'Provide the current ISO observation time with a timezone.');
  now = new Date(now).toISOString();
  requireValue(!workspace?.events?.length || now >= workspace.events.at(-1).observedAt, 'Observation time cannot move backward. Refresh current records before continuing.');
  requireValue(isDate(input.effectiveDate), 'Use a real effective date in YYYY-MM-DD format.');
  requireValue(input.effectiveDate <= now.slice(0,10), 'A resolution or evidence record cannot be future-dated.');
  const projection = { asOf:now.slice(0,10), knownAt:now };
  const before = evaluateWorkspace(workspace,projection);
  const credit = before.credits.find(c => c.id === input.creditId);
  requireValue(credit, 'Choose a credit present in current records.');
  let command, sourceId;
  if (input.operation === 'evidence') {
    requireValue(typeof input.sourceText === 'string' && input.sourceText.trim() && input.sourceText.length <= 250000, 'Add clarification source text of 1–250,000 characters.');
    sourceId = `source-${crypto.randomUUID()}`;
    command = { type:'ADD_SOURCE', source:{ id:sourceId, vendorId:credit.vendorId, kind:'allocation_resolution',
      title:input.sourceTitle == null || input.sourceTitle === '' ? `Credit clarification: ${credit.invoiceId}`.slice(0,200) : text(input.sourceTitle,'Clarification title'), text:input.sourceText } };
  } else {
    requireValue(input.effectiveDate >= credit.issuedDate, 'A resolution cannot take effect before the credit is issued.');
    const source = before.sources.find(s => s.id === input.sourceId);
    requireValue(source && source.vendorId === credit.vendorId && source.kind === 'allocation_resolution', 'Choose a recorded credit clarification source for this exact vendor. An analyst must record clarification evidence before approval.');
    sourceId = source.id;
    requireValue(Array.isArray(input.assignments) && input.assignments.length > 0, 'Set at least one explicit positive assignment limit.');
    const seen = new Set();
    const assignments = input.assignments.map(row => {
      requireValue(row && typeof row === 'object', 'Provide a commitment and a USD limit for each assignment.');
      const commitmentId = text(row.commitmentId,'Commitment reference');
      requireValue(!seen.has(commitmentId), 'List each commitment only once, including unused limits.');
      seen.add(commitmentId);
      const commitment = before.commitments.find(c => c.id === commitmentId);
      requireValue(commitment && credit.candidateCommitmentIds.includes(commitmentId), 'Every assignment must match the credit’s exact vendor, currency and reference.');
      requireValue(row.amount == null || typeof row.amount === 'string', 'Enter assignment limits as USD decimal amounts.');
      let limitCents = 0;
      if (row.amount?.trim()) {
        try { limitCents = moneyToCents(row.amount); }
        catch (error) { throw new Error(`Assignment limit: ${error.message}`); }
      }
      return { commitmentId, limitCents };
    }).filter(row => row.limitCents > 0);
    requireValue(assignments.length > 0, 'Set at least one explicit positive assignment limit. Blank or zero limits leave a commitment unassigned.');
    command = { type:'RESOLVE_CREDIT', creditId:credit.id, sourceIds:[source.id], assignments };
  }
  command.id = `credit-resolution-${crypto.randomUUID()}`;
  command.effectiveDate = input.effectiveDate;
  const next = reduceWorkspace(workspace,command,{actor,now}).state;
  const dates = new Set([projection.asOf,input.effectiveDate,...next.events.map(e=>e.effectiveDate).filter(date=>date>=input.effectiveDate && date<=projection.asOf)]);
  for (const asOf of dates) {
    const integrity = validateWorkspace(next,{asOf,knownAt:now});
    requireValue(integrity.valid, `This resolution would leave an inconsistent ledger on ${asOf}: ${integrity.violations.join(' ')}`);
    if (input.operation === 'resolve') {
      // Today's active amounts can be smaller after a later reversal. Binding a
      // new, smaller limit before that reversal must not rewrite its earlier
      // backing. Conservation alone does not check resolution assignment caps.
      const projected = evaluateWorkspace(next,{asOf,knownAt:now}).credits.find(item=>item.id===credit.id);
      if (!projected?.resolution) continue;
      const assignments = projected.resolution.assignments;
      requireValue(assignments.reduce((sum,row)=>sum+row.limitCents,0) <= projected.availableCents, `Assignment limits exceed available credit on ${asOf}. Choose a later effective date or reduce the limits.`);
      const activeByCommitment = new Map();
      for (const allocation of projected.allocations) activeByCommitment.set(allocation.commitmentId,(activeByCommitment.get(allocation.commitmentId)||0)+allocation.activeCents);
      for (const [commitmentId,activeCents] of activeByCommitment) {
        const limit = assignments.find(row=>row.commitmentId===commitmentId)?.limitCents || 0;
        requireValue(limit >= activeCents, `The assignment limit for ${commitmentId} would be below its active attribution on ${asOf}. Choose a later effective date or retain the earlier attributed amount.`);
      }
    }
  }
  return { commands:[command], before, after:evaluateWorkspace(next,projection), creditId:credit.id, sourceId };
}
