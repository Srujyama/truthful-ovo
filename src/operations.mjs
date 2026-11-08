import { evaluateWorkspace } from './assurance/index.mjs';

const sum = (items, field) => items.reduce((total, item) => {
  const next = total + item[field];
  if (!Number.isSafeInteger(next)) throw new Error('The report exceeds the supported money range.');
  return next;
}, 0);
const matches = (text, query) => !query || String(text).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
const nameFor = (view, id) => view.vendors.find(vendor => vendor.id === id)?.name || 'Unknown vendor';
export const sourceKey = source => JSON.stringify([source.id, source.revision]);
export const eventLabel = type => type.toLowerCase().replaceAll('_', ' ').replace(/^./, character => character.toUpperCase());

/** Aggregate each physical credit once, independently of its commitment attribution. */
export function vendorSummaries(view, { query = '' } = {}) {
  return view.vendors.map(vendor => {
    const commitments = view.commitments.filter(item => item.vendorId === vendor.id);
    const credits = view.credits.filter(item => item.vendorId === vendor.id);
    const sources = view.sources.filter(item => item.vendorId === vendor.id);
    const unconditional = commitments.filter(item => !item.conditions.length);
    const recoverable = unconditional.filter(item => item.dueDate <= view.asOf && item.deadline.state !== 'expired');
    const totals = {
      promisedCents: sum(unconditional, 'promisedCents'),
      conditionalCents: sum(commitments.filter(item => item.conditions.length), 'promisedCents'),
      verifiedCents: sum(commitments, 'verifiedCents'),
      outstandingCents: sum(unconditional, 'outstandingCents'),
      recoverableCents: sum(recoverable, 'outstandingCents'),
      issuedCents: sum(credits.filter(item => item.status === 'issued'), 'availableCents'),
      ledgerAppliedCents: sum(credits.filter(item => item.status === 'applied'), 'availableCents'),
      availableCents: sum(credits, 'availableCents'),
      allocatedCents: sum(credits, 'allocatedCents'),
      unallocatedCents: sum(credits, 'unallocatedCents'),
      quarantinedCents: sum(credits.filter(item => item.quarantined), 'availableCents'),
      incrementalObligationCents: sum(commitments, 'incrementalObligationCents'),
      futureIncrementalObligationCents: sum(commitments, 'futureIncrementalObligationCents'),
      netVerifiedValueCents: sum(commitments, 'netVerifiedValueCents'),
    };
    return { ...vendor, commitments, credits, sources, totals };
  }).filter(vendor => matches(`${vendor.name} ${vendor.id} ${vendor.commitments.map(c => c.reference).join(' ')}`, query))
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

/** One prioritized work item per commitment; ledger-only exceptions stay separate. */
export function operationQueue(view, { query = '', category = '', vendorId = '' } = {}) {
  const queue = [];
  for (const commitment of view.commitments) {
    const issues = [];
    const actions = view.actions.filter(action => action.commitmentId === commitment.id && !action.executed);
    const latestAction = actions.at(-1);
    const relatedCredits = view.credits.filter(credit => credit.vendorId === commitment.vendorId && credit.currency === commitment.currency && credit.reference === commitment.reference);
    const issue = (priority, category, title, reason, destination, actionId = null) => issues.push({ priority, category, title, reason, destination, actionId });
    if (commitment.outstandingCents > 0 && !commitment.conditions.length && commitment.deadline.state === 'expired') issue(0, 'urgent', 'Review expired claim window', `The claim deadline was ${commitment.deadline.date}. Outstanding value is not a current authorized claim.`, 'decisions', latestAction?.id || null);
    if (commitment.conflictingAmendmentIds.length) {
      const action = actions.findLast(item => commitment.conflictingAmendmentIds.includes(item.payload.amendmentId));
      issue(1, 'review', 'Resolve competing terms', `${commitment.conflictingAmendmentIds.length} incompatible proposed changes remain. The original agreement stays in force.`, 'decisions', action?.id || null);
    }
    const quarantined = relatedCredits.filter(credit => credit.quarantined && credit.availableCents > 0);
    if (quarantined.length) issue(2, 'evidence', 'Resolve credit attribution', `${quarantined.length} credit ${quarantined.length === 1 ? 'line needs' : 'lines need'} explicit source-backed identity resolution before attribution.`, 'ledger');
    if (commitment.sourceChanged) issue(3, 'review', 'Review revised evidence', 'A supporting source has a newer revision than the terms bound to this commitment.', 'evidence');
    if (latestAction?.approvalStale || latestAction?.proposalStale) issue(4, 'review', 'Refresh the action review', 'The latest pending action is bound to older evidence, policy, terms or ledger state. Its prior approval cannot authorize a current effect.', 'decisions', latestAction.id);
    else if (latestAction && !latestAction.policyDecision.allowed) issue(5, 'review', 'Inspect a blocked action', latestAction.policyDecision.reasons.join(' '), 'decisions', latestAction.id);
    else if (latestAction?.approval) issue(6, 'review', 'Record the approved action', 'The exact current action has approval and is waiting for an authorized local execution. Recording it does not imply invoice application.', 'decisions', latestAction.id);
    else if (latestAction) issue(7, 'review', 'Review the prepared action', 'An exact action is prepared and needs a current finance review before it can be approved.', 'decisions', latestAction.id);
    const unallocated = relatedCredits.filter(credit => {
      if (credit.quarantined || credit.unallocatedCents <= 0 || commitment.outstandingCents <= 0) return false;
      if (!credit.resolution) return true;
      const limit=credit.resolution.assignments.find(row=>row.commitmentId===commitment.id)?.limitCents || 0;
      const attributed=credit.allocations.filter(row=>row.commitmentId===commitment.id).reduce((sum,row)=>sum+row.activeCents,0);
      return limit>attributed;
    });
    if (unallocated.length) issue(8, 'evidence', 'Attribute available credit', `${unallocated.length} exact-reference credit ${unallocated.length === 1 ? 'line has' : 'lines have'} value that has not been attributed to a commitment.`, 'ledger');
    const issued = relatedCredits.filter(credit => credit.status === 'issued' && credit.availableCents > 0);
    if (issued.length) issue(9, 'evidence', 'Obtain invoice application evidence', 'An issued memo is recorded. A separate invoice is needed to establish application; issued value is excluded from verified applied value.', 'ledger');
    if (commitment.conditions.length && commitment.outstandingCents > 0) issue(10, 'review', 'Review conditional terms', 'This promise has unresolved conditions. Its amount is excluded from unconditional recoverable value.', 'decisions', latestAction?.id || null);
    if (!commitment.conditions.length && commitment.outstandingCents > 0 && commitment.deadline.state !== 'expired') {
      if (commitment.dueDate > view.asOf) issue(12, 'scheduled', 'Await the promised date', `The credit is expected by ${commitment.dueDate}. It is not yet overdue at this financial date.`, 'portfolio');
      else issue(11, 'claim', 'Follow up the outstanding promise', `The promise was due ${commitment.dueDate}. Inspect the original terms and current authority before preparing a follow-up.`, 'decisions', latestAction?.id || null);
    }
    if (!issues.length) continue;
    issues.sort((a, b) => a.priority - b.priority);
    queue.push({ id: `commitment:${commitment.id}`, commitmentId: commitment.id, vendorId: commitment.vendorId, vendorName: nameFor(view, commitment.vendorId), reference: commitment.reference, amountCents: commitment.outstandingCents, commitment, issues, ...issues[0] });
  }
  for (const credit of view.credits.filter(item => item.quarantined && item.availableCents > 0 && !item.candidateCommitmentIds.length)) {
    queue.push({ id: `credit:${credit.id}`, commitmentId: null, creditId: credit.id, vendorId: credit.vendorId, vendorName: nameFor(view, credit.vendorId), reference: credit.reference, amountCents: credit.availableCents, priority: 2, category: 'evidence', title: 'Inspect an unmatched credit', reason: credit.quarantineReason, destination: 'vendors', actionId: null, issues: [] });
  }
  return queue.filter(item => (!vendorId || item.vendorId === vendorId) && (!category || item.category === category || item.issues.some(issue => issue.category === category)) && matches(`${item.vendorName} ${item.reference} ${item.title} ${item.reason}`, query))
    .sort((a, b) => a.priority - b.priority || b.amountCents - a.amountCents || a.id.localeCompare(b.id));
}

const bound = (links, id, revision) => (links || []).some(link => link.sourceId === id && link.revision === revision);

/** An exact revision lookup; a new revision never inherits the old revision's usages. */
export function sourceUsages(view, sourceId, revision) {
  if (!view.sourceVersions.some(source => source.id === sourceId && source.revision === revision)) return [];
  const usages = [];
  const commitmentIdsForCredit = credit => [...new Set([...credit.allocations.map(item => item.commitmentId), ...credit.candidateCommitmentIds])].filter(id => view.commitments.some(c => c.id === id));
  for (const commitment of view.commitments) if (bound(commitment.sourceLinks, sourceId, revision)) usages.push({ kind: 'commitment', id: commitment.id, label: `Recorded terms · ${commitment.reference}`, commitmentIds: [commitment.id], destination: 'evidence' });
  for (const amendment of view.amendments) if (bound(amendment.sourceLinks, sourceId, revision)) usages.push({ kind: 'amendment', id: amendment.id, label: `${amendment.accepted ? 'Accepted' : amendment.rejected ? 'Dismissed' : 'Proposed'} change · ${amendment.id}`, commitmentIds: view.commitments.some(c => c.id === amendment.commitmentId) ? [amendment.commitmentId] : [], destination: 'decisions', actionId: view.actions.findLast(action => action.payload.amendmentId === amendment.id)?.id || null });
  for (const credit of view.credits) {
    if (bound(credit.sourceLinks, sourceId, revision)) usages.push({ kind: 'credit', id: credit.id, label: `Credit registration · ${credit.invoiceId}`, commitmentIds: commitmentIdsForCredit(credit), destination: 'ledger' });
    if (bound(credit.applicationSourceLinks, sourceId, revision)) usages.push({ kind: 'application', id: credit.id, label: `Invoice application · ${credit.invoiceId}`, commitmentIds: commitmentIdsForCredit(credit), destination: 'ledger' });
    if (bound(credit.resolution?.sourceLinks, sourceId, revision)) usages.push({ kind: 'resolution', id: credit.id, label: `Attribution resolution · ${credit.invoiceId}`, commitmentIds: commitmentIdsForCredit(credit), destination: 'ledger' });
  }
  for (const allocation of view.allocations) if (bound(allocation.sourceLinks, sourceId, revision)) usages.push({ kind: 'allocation', id: allocation.id, label: `Attribution · ${allocation.id}`, commitmentIds: [allocation.commitmentId], destination: 'ledger' });
  for (const action of view.actions) {
    const basis = (action.approval?.basis || action.basis)?.sourceRevisions;
    if (basis?.some(link => link.id === sourceId && link.revision === revision)) usages.push({ kind: 'action', id: action.id, label: `${action.approval ? 'Approval' : 'Proposal'} basis · ${eventLabel(action.type)}`, commitmentIds: view.commitments.some(c => c.id === action.commitmentId) ? [action.commitmentId] : [], destination: 'decisions', actionId: action.id });
  }
  for (const edge of view.graph.edges.filter(edge => edge.from === `source:${sourceId}@${revision}` && edge.to.startsWith('reversal:'))) {
    const creditEdge = view.graph.edges.find(item => item.from === edge.to && item.relation === 'reverses');
    const credit = creditEdge && view.credits.find(item => `credit:${item.id}` === creditEdge.to);
    usages.push({ kind: 'reversal', id: edge.to, label: `Credit reversal · ${credit?.invoiceId || edge.eventId}`, commitmentIds: credit ? commitmentIdsForCredit(credit) : [], destination: 'ledger' });
  }
  return usages;
}

export function sourceLibrary(view, { query = '', vendorId = '', kind = '', versions = 'current' } = {}) {
  const current = new Map(view.sources.map(source => [source.id, source.revision]));
  return (versions === 'all' ? view.sourceVersions : view.sources)
    .filter(source => (!vendorId || source.vendorId === vendorId) && (!kind || source.kind === kind) && matches(`${source.title} ${source.id} ${source.kind} ${nameFor(view, source.vendorId)} ${source.text}`, query))
    .map(source => ({ ...source, key: sourceKey(source), vendorName: nameFor(view, source.vendorId), isCurrent: current.get(source.id) === source.revision }))
    .sort((a, b) => b.revision - a.revision || a.id.localeCompare(b.id));
}

function activityContext(workspace, view) {
  const events = workspace.events.filter(event => event.observedAt <= view.knownAt);
  const commitments = new Map(), credits = new Map(), amendments = new Map(), actions = new Map(), allocations = new Map();
  for (const { payload } of events) {
    if (payload.commitment) commitments.set(payload.commitment.id, payload.commitment);
    if (payload.credit) credits.set(payload.credit.id, payload.credit);
    if (payload.amendment) amendments.set(payload.amendment.id, payload.amendment);
    if (payload.action) actions.set(payload.action.id, payload.action);
    if (payload.allocation) allocations.set(payload.allocation.id, payload.allocation);
  }
  return { events, commitments, credits, amendments, actions, allocations };
}

export function workspaceActivity(workspace, view, { query = '', vendorId = '', actorId = '', type = '', fromDate = '', toDate = '' } = {}) {
  const context = activityContext(workspace, view);
  return context.events.map(event => {
    const p = event.payload, commitmentIds = new Set(), vendorIds = new Set();
    const addCommitment = id => { const c = context.commitments.get(id); if (c) { commitmentIds.add(c.id); vendorIds.add(c.vendorId); } };
    const addCredit = id => {
      const credit = context.credits.get(id);
      if (!credit) return;
      vendorIds.add(credit.vendorId);
      for (const allocation of context.allocations.values()) if (allocation.creditId === credit.id) addCommitment(allocation.commitmentId);
    };
    if (p.vendor) vendorIds.add(p.vendor.id);
    if (p.source) vendorIds.add(p.source.vendorId);
    if (p.commitment) addCommitment(p.commitment.id);
    if (p.commitmentId) addCommitment(p.commitmentId);
    if (p.credit) addCredit(p.credit.id);
    if (p.creditId) addCredit(p.creditId);
    if (p.amendment) addCommitment(p.amendment.commitmentId);
    if (p.amendmentId) addCommitment(context.amendments.get(p.amendmentId)?.commitmentId);
    if (p.action) addCommitment(p.action.commitmentId);
    if (p.actionId) addCommitment(context.actions.get(p.actionId)?.commitmentId);
    if (p.allocation) { addCommitment(p.allocation.commitmentId); addCredit(p.allocation.creditId); }
    if (p.source) for (const usage of sourceUsages(view, p.source.id, event.sequence).filter(item => item.kind !== 'action')) for (const id of usage.commitmentIds) addCommitment(id);
    const references = [...commitmentIds].map(id => context.commitments.get(id).reference);
    const vendorNames = [...vendorIds].map(id => nameFor(view, id));
    const summary = p.source?.title || p.commitment?.reference || p.credit?.invoiceId || p.amendment?.kind?.replaceAll('_', ' ') || (p.amountCents != null ? `${p.amountCents} cents` : references.join(', ') || (p.policy ? `Policy ${p.policy.version}` : 'Workspace record'));
    return { ...event, typeLabel: eventLabel(event.type), summary, vendorIds: [...vendorIds], vendorNames, commitmentIds: [...commitmentIds], references };
  }).filter(event => (!vendorId || event.vendorIds.includes(vendorId)) && (!actorId || event.actor.id === actorId) && (!type || event.type === type) && (!fromDate || event.observedAt.slice(0, 10) >= fromDate) && (!toDate || event.observedAt.slice(0, 10) <= toDate) && matches(`${event.id} ${event.typeLabel} ${event.summary} ${event.vendorNames.join(' ')} ${event.references.join(' ')} ${event.actor.id} ${event.actor.role}`, query))
    .sort((a, b) => b.sequence - a.sequence);
}

export function financialReport(workspace, { asOf, knownAt } = {}) {
  const view = evaluateWorkspace(workspace, { asOf, knownAt });
  const vendors = vendorSummaries(view);
  return { view, asOf: view.asOf, knownAt: view.knownAt, totals: { ...view.totals, unallocatedCents: sum(vendors.map(vendor => vendor.totals), 'unallocatedCents'), futureIncrementalObligationCents: sum(view.commitments, 'futureIncrementalObligationCents') }, vendors, observedEventCount: workspace.events.filter(event => event.observedAt <= view.knownAt).length };
}

/** Quote every text cell and neutralize spreadsheet formulas, including whitespace prefixes. */
export function csvCell(value) {
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) throw new Error('CSV financial values must be safe integer cents.');
    return String(value);
  }
  let text = String(value ?? '');
  if (/^[\s\u0000-\u001F\uFEFF]*[=+\-@]/.test(text) || /^[\u0000-\u001F]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function reportCsv(report) {
  const columns = ['promisedCents', 'conditionalCents', 'verifiedCents', 'outstandingCents', 'recoverableCents', 'issuedCents', 'ledgerAppliedCents', 'allocatedCents', 'unallocatedCents', 'quarantinedCents', 'incrementalObligationCents', 'futureIncrementalObligationCents', 'netVerifiedValueCents'];
  const rows = [['financial_effective_on', 'known_by', 'vendor', 'vendor_id', 'currency', ...columns.map(key => key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`))]];
  for (const vendor of report.vendors) rows.push([report.asOf, report.knownAt, vendor.name, vendor.id, 'USD', ...columns.map(key => vendor.totals[key])]);
  rows.push([report.asOf, report.knownAt, 'WORKSPACE TOTAL', '', 'USD', ...columns.map(key => report.totals[key])]);
  return `${rows.map(row => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}
