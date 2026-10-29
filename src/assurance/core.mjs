/**
 * A bounded commitment-assurance model. All money is integer cents.
 * Replay establishes what these recorded sources imply, not source completeness,
 * vendor authenticity, settlement finality, or the truth of unobserved facts.
 */
export class DomainError extends Error {
  constructor(code, message, details = {}) { super(message); this.name = 'DomainError'; this.code = code; this.details = details; }
}
const fail = (code, message, details) => { throw new DomainError(code, message, details); };
const assert = (condition, message, details) => { if (!condition) fail('VALIDATION', message, details); };
const clone = value => structuredClone(value);
const ROLES = ['viewer', 'analyst', 'approver', 'executor', 'admin'];
const DAY = 86400000;
export const DEFAULT_POLICY = Object.freeze({ version: 'policy-1', claimLimitCents: 500000, renewalLimitCents: 0, allowNewCommitments: false });
export const ACTION_TYPES = ['prepare_claim', 'preserve_original', 'accept_amendment'];
export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().filter(k => value[k] !== undefined).map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
export function isDate(value) { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value; }
function instant(value) { assert(typeof value === 'string' && /T/.test(value) && /(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value)), 'Use an ISO instant with a time and timezone.'); return new Date(value).toISOString(); }
function string(value, label) { assert(typeof value === 'string' && value.trim().length > 0 && value.length <= 200, `${label} must be nonempty text of at most 200 characters.`); return value.trim(); }
function cents(value, label = 'Amount', zero = false) { assert(Number.isSafeInteger(value) && value >= (zero ? 0 : 1), `${label} must be ${zero ? 'nonnegative' : 'positive'} safe integer cents.`); return value; }
function sum(values) { let total = 0; for (const value of values) { total += value; assert(Number.isSafeInteger(total), 'Combined money exceeds the safe integer limit.'); } return total; }
function date(value, label) { assert(isDate(value), `${label} must be a real YYYY-MM-DD date.`); return value; }
function conditions(value = []) { assert(Array.isArray(value) && value.length <= 20 && value.every(x => typeof x === 'string' && x.trim() && x.length <= 1000), 'Conditions must be a list of nonempty strings.'); return value.map(x => x.trim()); }
function policy(value, version) {
  assert(value && typeof value === 'object', 'Provide a policy.');
  assert(typeof value.allowNewCommitments === 'boolean', 'Policy allowNewCommitments must be boolean.');
  return { version: version || string(value.version || 'policy-1', 'Policy version'), claimLimitCents: cents(value.claimLimitCents, 'Claim limit', true), renewalLimitCents: cents(value.renewalLimitCents, 'Renewal limit', true), allowNewCommitments: value.allowNewCommitments };
}
export function createWorkspace({ id = 'truthful-workspace', policy: initialPolicy = DEFAULT_POLICY } = {}) {
  return { schemaVersion: 1, id: string(id, 'Workspace ID'), revision: 0, basePolicy: policy(initialPolicy), events: [] };
}
function checkState(state) { assert(state?.schemaVersion === 1 && typeof state.id === 'string' && Array.isArray(state.events) && state.revision === state.events.length, 'Workspace schema or revision is invalid.'); }
function lookup(list, id, kind) { return list.find(item => item.id === id) || fail('NOT_FOUND', `${kind} ${id} was not found.`); }
function role(ctx, allowed) { if (ctx.actor.role !== 'admin' && !allowed.includes(ctx.actor.role)) fail('FORBIDDEN', `This command requires ${allowed.join(' or ')}.`, { role: ctx.actor.role }); }
function context(state, ctx = {}) {
  assert(ctx.actor && ROLES.includes(ctx.actor.role), 'Use an authenticated actor with a recognized role.');
  const actor = { id: string(ctx.actor.id, 'Actor ID'), role: ctx.actor.role };
  const now = instant(ctx.now);
  if (state.events.length && now < state.events.at(-1).observedAt) fail('VALIDATION', 'Observation time cannot move backward. Use replay options to inspect earlier knowledge.');
  return { actor, now };
}
function links(view, sourceIds, vendorId) {
  assert(Array.isArray(sourceIds) && sourceIds.length > 0 && new Set(sourceIds).size === sourceIds.length, 'Provide unique supporting source IDs.');
  return sourceIds.map(id => {
    const source = lookup(view.sources, id, 'Source');
    assert(!vendorId || source.vendorId === vendorId, 'Supporting source vendor must match the financial record.', { sourceId: id, vendorId });
    return { sourceId: id, revision: source.revision };
  });
}
function availableCredit(credit) { return credit.amountCents - credit.reversedCents; }

/** Project at financial time asOf using only facts observed by knownAt. */
export function evaluateWorkspace(state, options = {}) {
  checkState(state);
  const latest = state.events.at(-1)?.observedAt || '2026-10-28T12:00:00.000Z';
  const asOf = date(options.asOf || latest.slice(0, 10), 'asOf');
  const knownAt = options.knownAt ? instant(options.knownAt) : latest;
  const visible = state.events.filter(e => e.observedAt <= knownAt);
  const vendors = new Map(), sources = new Map(), commitments = new Map(), credits = new Map(), amendments = new Map(), actions = new Map(), allocations = new Map();
  let currentPolicy = clone(state.basePolicy), materialRevision = 0;
  const accepted = [], sourceVersions = [];
  for (const event of visible) {
    if (event.material) materialRevision = event.sequence;
    const p = event.payload, active = event.effectiveDate <= asOf;
    switch (event.type) {
      case 'VENDOR_ADDED': vendors.set(p.vendor.id, clone(p.vendor)); break;
      case 'SOURCE_ADDED':
      case 'SOURCE_REVISED': {
        const source = { ...clone(p.source), revision: event.sequence, observedAt: event.observedAt, effectiveDate: event.effectiveDate, eventId: event.id };
        sources.set(source.id, source); sourceVersions.push(source); break;
      }
      case 'COMMITMENT_CREATED': {
        const c = clone(p.commitment);
        if (active) commitments.set(c.id, { ...c, originalPromisedCents: c.promisedCents, originalDueDate: c.dueDate, revision: event.sequence, createdAt: event.observedAt, effectiveDate: event.effectiveDate, sourceLinks: clone(p.sourceLinks), acceptedAmendmentIds: [], incrementalObligationCents: 0, acceptedEconomics: [], lastAction: null });
        break;
      }
      case 'AMENDMENT_PROPOSED': amendments.set(p.amendment.id, { ...clone(p.amendment), sourceLinks: clone(p.sourceLinks), proposedAt: event.observedAt, accepted: false, rejected: false, dismissal: null, eventId: event.id }); break;
      case 'AMENDMENT_DISMISSED': if(amendments.has(p.amendmentId)) { const a=amendments.get(p.amendmentId); a.rejected=true; a.dismissal={reason:p.reason,actor:clone(event.actor),observedAt:event.observedAt,eventId:event.id}; } break;
      case 'AMENDMENT_ACCEPTED': {
        const amendment = amendments.get(p.amendmentId);
        if (amendment) { amendment.accepted = true; amendment.acceptedAt = event.observedAt; amendment.acceptedEventId = event.id; amendment.acceptedRevision = event.sequence; amendment.acceptedEconomics=clone(p.economics||null); accepted.push(amendment); }
        break;
      }
      case 'CREDIT_REGISTERED': if (active) credits.set(p.credit.id, { ...clone(p.credit), sourceLinks: clone(p.sourceLinks), status: p.credit.status, issuedDate: event.effectiveDate, applicationDate: p.credit.status === 'applied' ? event.effectiveDate : null, reversedCents: 0, resolution: null, revision: event.sequence }); break;
      case 'CREDIT_APPLIED': if (active && credits.has(p.creditId)) { const credit = credits.get(p.creditId); credit.status = 'applied'; credit.applicationDate = event.effectiveDate; credit.applicationSourceLinks = clone(p.sourceLinks); credit.revision = event.sequence; } break;
      case 'CREDIT_RESOLVED': if (active && credits.has(p.creditId)) credits.get(p.creditId).resolution = { assignments: clone(p.assignments), sourceLinks: clone(p.sourceLinks), eventId: event.id }; break;
      case 'CREDIT_ALLOCATED': if (active) allocations.set(p.allocation.id, { ...clone(p.allocation), revokedCents: 0, eventId: event.id }); break;
      case 'CREDIT_REVERSED': if (active && credits.has(p.creditId)) {
        credits.get(p.creditId).reversedCents += p.amountCents;
        for (const reversal of p.allocationReversals) if (allocations.has(reversal.allocationId)) allocations.get(reversal.allocationId).revokedCents += reversal.amountCents;
      } break;
      case 'POLICY_SET': currentPolicy = clone(p.policy); break;
      case 'ACTION_PROPOSED': actions.set(p.action.id, { ...clone(p.action), proposedAt: event.observedAt, proposedBy: clone(event.actor), approval: null, executed: false, execution: null, eventId: event.id }); break;
      case 'ACTION_APPROVED': if (actions.has(p.actionId)) actions.get(p.actionId).approval = { ...clone(p.approval), approvedAt: event.observedAt, eventId: event.id }; break;
      case 'ACTION_EXECUTED': if (actions.has(p.actionId)) { const action = actions.get(p.actionId); action.executed = true; action.execution = { ...clone(p.result), executedAt: event.observedAt, actor: clone(event.actor), eventId: event.id }; if (active && commitments.has(action.commitmentId)) commitments.get(action.commitmentId).lastAction = action.type; } break;
    }
  }
  // Only an explicit accepted replacement can suppress an already accepted future
  // schedule. Pending conflicts are resolved before acceptance, never by last write.
  for(const amendment of amendments.values()) {
    amendment.supersededByAmendmentIds=accepted.filter(a=>(a.supersedesAmendmentIds||[]).includes(amendment.id)).map(a=>a.id);
    amendment.superseded=amendment.supersededByAmendmentIds.some(id=>amendments.get(id).effectiveDate<=asOf);
  }
  for (const amendment of accepted.sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate) || a.acceptedRevision - b.acceptedRevision)) {
    const commitment = commitments.get(amendment.commitmentId);
    if (commitment && amendment.effectiveDate <= asOf && !amendment.superseded) {
      Object.assign(commitment, clone(amendment.patch));
      commitment.revision = amendment.acceptedRevision;
      commitment.acceptedAmendmentIds.push(amendment.id);
      commitment.sourceLinks.push(...clone(amendment.sourceLinks));
      if(amendment.newCommitment) { commitment.incrementalObligationCents=sum([commitment.incrementalObligationCents,amendment.incrementalRenewalCostCents]);commitment.acceptedEconomics.push({amendmentId:amendment.id,...clone(amendment.acceptedEconomics)}); }
    }
  }
  const quarantine = [];
  for (const allocation of allocations.values()) allocation.activeCents = allocation.amountCents - allocation.revokedCents;
  for (const credit of credits.values()) {
    credit.availableCents = availableCredit(credit);
    credit.allocations = [...allocations.values()].filter(a => a.creditId === credit.id);
    credit.allocatedCents = sum(credit.allocations.map(a => a.activeCents));
    credit.unallocatedCents = credit.availableCents - credit.allocatedCents;
    credit.candidateCommitmentIds = [...commitments.values()].filter(c => c.vendorId === credit.vendorId && c.currency === credit.currency && c.reference === credit.reference).map(c => c.id);
    credit.quarantined = credit.candidateCommitmentIds.length !== 1 && !credit.resolution;
    credit.quarantineReason = credit.quarantined ? credit.candidateCommitmentIds.length ? 'Multiple commitments share this vendor, currency and reference. An explicit source-backed resolution is required.' : 'No commitment has this exact vendor, currency and reference.' : null;
    if (credit.quarantined) quarantine.push({ creditId: credit.id, candidateCommitmentIds: clone(credit.candidateCommitmentIds), amountCents: credit.availableCents, reason: credit.quarantineReason });
  }
  for (const c of commitments.values()) {
    c.allocations = [...allocations.values()].filter(a => a.commitmentId === c.id);
    c.appliedCents = sum(c.allocations.filter(a => credits.get(a.creditId)?.status === 'applied' && !credits.get(a.creditId).quarantined).map(a => a.activeCents));
    c.issuedCents = sum(c.allocations.filter(a => credits.get(a.creditId)?.status === 'issued' && !credits.get(a.creditId).quarantined).map(a => a.activeCents));
    c.quarantinedAppliedCents = sum(c.allocations.filter(a => credits.get(a.creditId)?.status === 'applied' && credits.get(a.creditId).quarantined).map(a => a.activeCents));
    c.verifiedCents = c.conditions.length ? 0 : Math.min(c.promisedCents, c.appliedCents);
    c.outstandingCents = Math.max(0, c.promisedCents - c.verifiedCents);
    c.overappliedCents = Math.max(0, c.appliedCents - c.promisedCents);
    c.pendingAmendmentIds = [...amendments.values()].filter(a => a.commitmentId === c.id && !a.accepted && !a.rejected).map(a => a.id);
    c.futureAcceptedAmendmentIds = [...amendments.values()].filter(a => a.commitmentId === c.id && a.accepted && !a.superseded && a.effectiveDate > asOf).map(a => a.id);
    c.futureIncrementalObligationCents=sum([...amendments.values()].filter(a=>a.commitmentId===c.id&&a.accepted&&a.effectiveDate>asOf&&a.newCommitment).map(a=>a.incrementalRenewalCostCents));
    c.netVerifiedValueCents=c.verifiedCents-c.incrementalObligationCents;
    const remaining = c.claimDeadline ? Math.round((Date.parse(`${c.claimDeadline}T00:00:00Z`) - Date.parse(`${asOf}T00:00:00Z`)) / DAY) : null;
    c.deadline = { date: c.claimDeadline || null, daysRemaining: remaining, state: remaining == null ? 'none' : remaining < 0 ? 'expired' : remaining === 0 ? 'due_today' : 'open' };
    c.sourceChanged = c.sourceLinks.some(link => sources.get(link.sourceId)?.revision !== link.revision);
    c.status = c.conditions.length ? 'conditional' : c.outstandingCents === 0 ? 'verified' : c.deadline.state === 'expired' ? 'deadline_expired' : c.verifiedCents > 0 ? 'partial' : c.issuedCents > 0 ? 'issued' : c.dueDate > asOf ? 'scheduled' : 'open';
  }
  const view = {
    schemaVersion: 1, id: state.id, revision: state.revision, materialRevision, asOf, knownAt,
    policy: currentPolicy, vendors: [...vendors.values()], sources: [...sources.values()], sourceVersions,
    commitments: [...commitments.values()], credits: [...credits.values()], allocations: [...allocations.values()],
    amendments: [...amendments.values()], actions: [...actions.values()], quarantine,
    observationBoundary: { knownAt, assertion: 'Only recorded facts observed by this instant are included. Missing evidence is unknown; this is not a source-completeness or settlement-finality guarantee.' },
  };
  for(const amendment of view.amendments) {
    const c=view.commitments.find(c=>c.id===amendment.commitmentId);
    const acceptedBranch=view.amendments.filter(a=>a.commitmentId===amendment.commitmentId&&a.accepted).map(a=>a.id).sort();
    amendment.basisStale=Boolean(!amendment.accepted&&!amendment.rejected&&(!c||amendment.baseCommitmentRevision!==c.revision||canonical(amendment.baseAcceptedAmendmentIds||[])!==canonical(acceptedBranch)||amendment.sourceLinks.some(l=>sources.get(l.sourceId)?.revision!==l.revision)));
    amendment.conflictingAmendmentIds=amendment.accepted||amendment.rejected?[]:view.amendments.filter(other=>other.id!==amendment.id&&other.commitmentId===amendment.commitmentId&&!other.accepted&&!other.rejected&&amendmentsConflict(amendment,other)).map(a=>a.id);
    amendment.conflictIds=clone(amendment.conflictingAmendmentIds);
    amendment.conflictingAcceptedAmendmentIds=amendment.accepted||amendment.rejected?[]:view.amendments.filter(other=>other.commitmentId===amendment.commitmentId&&other.accepted&&!other.superseded&&other.effectiveDate>asOf&&!(amendment.supersedesAmendmentIds||[]).includes(other.id)&&amendmentsConflict(amendment,other)).map(a=>a.id);
  }
  for(const c of view.commitments)c.conflictingAmendmentIds=[...new Set(view.amendments.filter(a=>a.commitmentId===c.id&&a.conflictingAmendmentIds.length).flatMap(a=>[a.id,...a.conflictingAmendmentIds]))];
  for (const action of view.actions) {
    action.proposedPolicyDecision = clone(action.policyDecision);
    action.proposedEconomics = clone(action.economics);
    if(view.commitments.some(c=>c.id===action.commitmentId)) {
      const currentSimulation=simulationFor(view,action);
      action.policyDecision=currentSimulation.policyDecision;
      action.economics=currentSimulation.economics;
    } else action.policyDecision={allowed:false,reasons:['The commitment is not effective at this replay date.'],policyVersion:view.policy.version};
    action.proposalStale = Boolean(!action.executed && canonical(action.basis) !== canonical(basisFor(view, action)));
    action.approvalStale = Boolean(action.approval && !action.executed && canonical(action.approval.basis) !== canonical(basisFor(view, action)));
    action.status = action.executed ? 'executed' : action.proposalStale || action.approvalStale ? 'stale' : !action.policyDecision.allowed ? 'blocked' : action.approval ? 'approved' : 'proposed';
  }
  view.totals = {
    promisedCents: sum(view.commitments.map(c => c.conditions.length ? 0 : c.promisedCents)),
    verifiedCents: sum(view.commitments.map(c => c.verifiedCents)),
    outstandingCents: sum(view.commitments.filter(c => !c.conditions.length).map(c => c.outstandingCents)),
    recoverableCents: sum(view.commitments.filter(c => !c.conditions.length && c.dueDate <= asOf && c.deadline.state !== 'expired').map(c => c.outstandingCents)),
    conditionalCents: sum(view.commitments.filter(c => c.conditions.length).map(c => c.promisedCents)),
    issuedCents: sum(view.credits.filter(c => c.status === 'issued').map(c => c.availableCents)),
    ledgerAppliedCents: sum(view.credits.filter(c => c.status === 'applied').map(c => c.availableCents)),
    allocatedCents: sum(view.allocations.map(a => a.activeCents)),
    quarantinedCents: sum(quarantine.map(q => q.amountCents)),
    incrementalObligationCents:sum(view.commitments.map(c=>c.incrementalObligationCents)),
    netVerifiedValueCents:sum(view.commitments.map(c=>c.verifiedCents))-sum(view.commitments.map(c=>c.incrementalObligationCents)),
  };
  view.graph = graphFor(visible, view);
  return view;
}

function basisFor(view, action) {
  const c = view.commitments.find(item => item.id === action.commitmentId);
  return { materialRevision: view.materialRevision, policyVersion: view.policy.version, policyCanonical: canonical(view.policy), commitmentRevision: c?.revision ?? null, sourceRevisions: view.sources.map(s => ({ id: s.id, revision: s.revision })).sort((a,b) => a.id.localeCompare(b.id)), actionCanonical: canonical({ id: action.id, type: action.type, commitmentId: action.commitmentId, payload: action.payload }) };
}

function amendmentsConflict(a,b) {
  const overlapping=Object.keys(a.patch).filter(key=>Object.hasOwn(b.patch,key));
  if(overlapping.some(key=>canonical(a.patch[key])!==canonical(b.patch[key])))return true;
  if(a.newCommitment||b.newCommitment) return canonical({newCommitment:a.newCommitment,incremental:a.incrementalRenewalCostCents,baseline:a.baselineCostCents,description:a.baselineDescription})!==canonical({newCommitment:b.newCommitment,incremental:b.incrementalRenewalCostCents,baseline:b.baselineCostCents,description:b.baselineDescription});
  return false;
}

export function simulateAction(state, specification, options = {}) {
  const view = evaluateWorkspace(state, options);
  return simulationFor(view, specification);
}
function simulationFor(view, specification) {
  assert(specification && ACTION_TYPES.includes(specification.type), 'Use a supported action type.');
  const c = lookup(view.commitments, specification.commitmentId, 'Commitment');
  let economics = null, amountCents = c.outstandingCents, newCommitment = false, amendment = null;
  if (specification.type === 'accept_amendment') {
    amendment = lookup(view.amendments, specification.payload?.amendmentId, 'Amendment');
    assert(amendment.commitmentId === c.id, 'Amendment belongs to a different commitment.');
    amountCents = Math.max(0, (amendment.patch.promisedCents ?? c.promisedCents) - c.verifiedCents);
    const incrementalRenewalCostCents = amendment.incrementalRenewalCostCents;
    newCommitment = amendment.newCommitment || incrementalRenewalCostCents > 0;
    economics = {
      creditCents: amountCents, baselineCostCents: amendment.baselineCostCents,
      proposedRenewalCostCents: sum([amendment.baselineCostCents, incrementalRenewalCostCents]),
      incrementalRenewalCostCents, netIncrementalValueCents: amountCents - incrementalRenewalCostCents,
      baseline: amendment.baselineDescription,
      assumption: 'Credit is contingent value, not verified savings. Incremental renewal cost is measured against the explicitly stated baseline; no discount rate or unobserved benefit is assumed.',
    };
  }
  const reasons = [];
  if (specification.type !== 'accept_amendment' && c.conditions.length) reasons.push('The original commitment is conditional. Resolve its terms before preparing an unconditional claim.');
  if (specification.type === 'prepare_claim' && c.deadline.state === 'expired') reasons.push(`Claim deadline ${c.claimDeadline} expired as of ${view.asOf}.`);
  if (specification.type === 'prepare_claim' && c.dueDate > view.asOf) reasons.push(`The promise is not due until ${c.dueDate}.`);
  if (specification.type !== 'accept_amendment' && c.outstandingCents <= 0) reasons.push('No outstanding original credit remains.');
  if (amountCents > view.policy.claimLimitCents) reasons.push(`Action amount exceeds the ${view.policy.claimLimitCents}-cent approval limit.`);
  if (newCommitment && !view.policy.allowNewCommitments) reasons.push('Policy forbids new contractual commitments.');
  if (newCommitment && economics.incrementalRenewalCostCents > view.policy.renewalLimitCents) reasons.push('Incremental renewal cost exceeds the policy limit.');
  if (amendment?.accepted) reasons.push('This amendment has already been accepted.');
  if(amendment?.rejected) reasons.push(`This amendment was dismissed: ${amendment.dismissal.reason}`);
  if(amendment?.basisStale) reasons.push('The amendment accepted-term or source basis is stale. Record a new proposal against the current accepted branch.');
  if(amendment?.conflictingAmendmentIds.length) reasons.push(`Unresolved amendment conflict with ${amendment.conflictingAmendmentIds.join(', ')}. Finance must dismiss incompatible alternatives before accepting a branch.`);
  if(amendment?.conflictingAcceptedAmendmentIds.length) reasons.push(`This proposal conflicts with accepted future terms ${amendment.conflictingAcceptedAmendmentIds.join(', ')}. An explicit supported supersession is required.`);
  return { actionType: specification.type, commitmentId: c.id, amountCents, newCommitment, economics, policyDecision: { allowed: reasons.length === 0, reasons, policyVersion: view.policy.version }, outcome: specification.type === 'accept_amendment' ? 'Proposed terms would become accepted, with effect on the amendment effective date. No money is recovered by acceptance alone.' : 'A local action record would preserve the original claim. No email, renewal, payment, or vendor API call is performed.' };
}

export function proposeAction(state, specification, ctx) { return reduceWorkspace(state, { type: 'PROPOSE_ACTION', action: specification }, ctx); }

export function reduceWorkspace(state, command, suppliedContext) {
  checkState(state);
  assert(command && typeof command === 'object' && typeof command.type === 'string', 'Provide a typed command.');
  const ctx = context(state, suppliedContext);
  const commandId = string(command.id || command.commandId || `implicit-${state.revision + 1}`, 'Command ID');
  const commandCanonical = canonical(command);
  const prior = state.events.find(e => e.commandId === commandId);
  if (prior) {
    if (prior.commandCanonical !== commandCanonical) fail('CONFLICT', 'An idempotency key was reused with a different command.');
    return { state, result: { idempotent: true, commandId, eventIds: state.events.filter(e => e.commandId === commandId).map(e => e.id) } };
  }
  const view = evaluateWorkspace(state, { asOf: ctx.now.slice(0, 10), knownAt: ctx.now });
  // These commands record already effective ledger facts/identities. Reserving future
  // allocations would need a separate capacity model; only accepted amendments are scheduled.
  if(['CREATE_COMMITMENT','REGISTER_CREDIT','APPLY_CREDIT','ALLOCATE_CREDIT','REVERSE_CREDIT','RESOLVE_CREDIT','SET_POLICY','DISMISS_AMENDMENT'].includes(command.type)) {
    const effective=command.effectiveDate||ctx.now.slice(0,10);
    date(effective,'Effective date');
    assert(effective<=ctx.now.slice(0,10),'This command records an effective fact and cannot be future-dated. Use a proposed amendment for future terms.');
  }
  const queued = [];
  function emit(type, payload, { material = true, effectiveDate = command.effectiveDate || ctx.now.slice(0, 10) } = {}) {
    date(effectiveDate, 'Effective date');
    const sequence = state.revision + queued.length + 1;
    queued.push({ id: `event-${sequence}`, sequence, commandId, commandCanonical, type, payload: clone(payload), actor: clone(ctx.actor), observedAt: ctx.now, effectiveDate, material });
  }
  const unique = (list, id, kind) => { string(id, `${kind} ID`); if (list.some(item => item.id === id)) fail('CONFLICT', `${kind} ${id} already exists.`); };
  let result = {};
  switch (command.type) {
    case 'ADD_VENDOR': {
      role(ctx, ['analyst']); const v = command.vendor; assert(v, 'Provide a vendor.'); unique(view.vendors, v.id, 'Vendor');
      emit('VENDOR_ADDED', { vendor: { id: v.id, name: string(v.name, 'Vendor name') } }); result = { vendorId: v.id }; break;
    }
    case 'ADD_SOURCE': {
      role(ctx, ['analyst']); const s = command.source; assert(s, 'Provide a source.'); unique(view.sources, s.id, 'Source'); lookup(view.vendors, s.vendorId, 'Vendor');
      assert(typeof s.text === 'string' && s.text.trim() && s.text.length <= 250000, 'Source text must contain 1–250,000 characters.');
      emit('SOURCE_ADDED', { source: { id: s.id, vendorId: s.vendorId, title: string(s.title, 'Source title'), kind: string(s.kind || 'document', 'Source kind'), text: s.text } }, { effectiveDate: s.effectiveDate || command.effectiveDate || ctx.now.slice(0,10) }); result = { sourceId: s.id }; break;
    }
    case 'REVISE_SOURCE': {
      role(ctx, ['analyst']); const s = lookup(view.sources, command.sourceId, 'Source'); assert(typeof command.text === 'string' && command.text.trim() && command.text.length <= 250000, 'Revised source text must contain 1–250,000 characters.');
      emit('SOURCE_REVISED', { source: { id: s.id, vendorId: s.vendorId, title: s.title, kind: s.kind, text: command.text } }); result = { sourceId: s.id }; break;
    }
    case 'CREATE_COMMITMENT': {
      role(ctx, ['analyst']); const c = command.commitment; assert(c, 'Provide a commitment.'); unique(view.commitments, c.id, 'Commitment'); lookup(view.vendors, c.vendorId, 'Vendor');
      assert(c.currency === 'USD', 'This bounded workspace supports USD commitments only.');
      const normalized = { id: c.id, vendorId: c.vendorId, reference: string(c.reference, 'Commitment reference'), currency: c.currency, promisedCents: cents(c.promisedCents, 'Promised amount'), dueDate: date(c.dueDate, 'Due date'), claimDeadline: c.claimDeadline == null ? null : date(c.claimDeadline, 'Claim deadline'), conditions: conditions(c.conditions), sourceIds: clone(c.sourceIds) };
      emit('COMMITMENT_CREATED', { commitment: normalized, sourceLinks: links(view, c.sourceIds, c.vendorId) }); result = { commitmentId: c.id }; break;
    }
    case 'PROPOSE_AMENDMENT': {
      role(ctx, ['analyst']); const a = command.amendment; assert(a, 'Provide an amendment.'); unique(view.amendments, a.id, 'Amendment'); const c = lookup(view.commitments, a.commitmentId, 'Commitment');
      assert(a.patch && Object.keys(a.patch).length > 0 && Object.keys(a.patch).every(k => ['promisedCents','dueDate','claimDeadline','conditions'].includes(k)), 'Amend only amount, dates, or conditions. Vendor, reference and currency are immutable.');
      const patch = {};
      if ('promisedCents' in a.patch) patch.promisedCents = cents(a.patch.promisedCents, 'Amended promised amount');
      if ('dueDate' in a.patch) patch.dueDate = date(a.patch.dueDate, 'Amended due date');
      if ('claimDeadline' in a.patch) patch.claimDeadline = a.patch.claimDeadline == null ? null : date(a.patch.claimDeadline, 'Amended claim deadline');
      if ('conditions' in a.patch) patch.conditions = conditions(a.patch.conditions);
      const incremental = cents(a.incrementalRenewalCostCents ?? 0, 'Incremental renewal cost', true), baseline = cents(a.baselineCostCents ?? 0, 'Baseline cost', true);
      const newCommitment = a.kind === 'renewal' || a.newCommitment === true || incremental > 0;
      if (newCommitment) assert(typeof a.baselineDescription === 'string' && a.baselineDescription.trim() && 'baselineCostCents' in a, 'A renewal proposal needs an explicit baseline cost and description.');
      const supersedes=a.supersedesAmendmentIds||[];
      assert(Array.isArray(supersedes)&&new Set(supersedes).size===supersedes.length,'Superseded amendment IDs must be unique.');
      for(const id of supersedes) { const target=lookup(view.amendments,id,'Superseded amendment'); assert(target.commitmentId===c.id&&target.accepted&&!target.superseded&&target.effectiveDate>view.asOf,'Explicit supersession supports only accepted, not-yet-effective amendments on this commitment.');assert(!target.newCommitment&&!newCommitment,'Cancellation or replacement of renewal obligations is outside this bounded schedule-supersession model.');assert(Object.keys(target.patch).every(key=>Object.hasOwn(patch,key)),'A replacement patch must explicitly cover every field of the superseded future schedule.'); }
      const normalized = { id: a.id, commitmentId: c.id, kind: a.kind || 'terms_change', patch, effectiveDate: date(a.effectiveDate, 'Amendment effective date'), incrementalRenewalCostCents: incremental, baselineCostCents: baseline, baselineDescription: a.baselineDescription || 'Existing agreement; no incremental renewal obligation.', newCommitment, sourceIds: clone(a.sourceIds), baseCommitmentRevision:c.revision,baseAcceptedAmendmentIds:view.amendments.filter(x=>x.commitmentId===c.id&&x.accepted).map(x=>x.id).sort(),supersedesAmendmentIds:clone(supersedes) };
      emit('AMENDMENT_PROPOSED', { amendment: normalized, sourceLinks: links(view, a.sourceIds, c.vendorId) }); result = { amendmentId: a.id }; break;
    }
    case 'DISMISS_AMENDMENT': {
      role(ctx,['approver']); const a=lookup(view.amendments,command.amendmentId,'Amendment');
      if(a.accepted)fail('CONFLICT','An accepted amendment cannot be dismissed as an unaccepted proposal.');
      if(a.rejected)fail('CONFLICT','This amendment was already dismissed.');
      const reason=string(command.reason,'Dismissal reason');
      emit('AMENDMENT_DISMISSED',{amendmentId:a.id,reason});result={amendmentId:a.id,rejected:true,reason};break;
    }
    case 'REGISTER_CREDIT': {
      role(ctx, ['analyst']); const c = command.credit; assert(c, 'Provide a credit.'); unique(view.credits, c.id, 'Credit'); lookup(view.vendors, c.vendorId, 'Vendor');
      assert(c.currency === 'USD', 'Only USD credits are supported.'); assert(['issued','applied'].includes(c.status), 'A credit is issued or applied; the states are not interchangeable.');
      assert((command.effectiveDate || ctx.now.slice(0,10)) <= ctx.now.slice(0,10), 'A future invoice cannot establish already applied credit.');
      const normalized = { id: c.id, lineId: string(c.lineId || c.id, 'Ledger line ID'), invoiceId: string(c.invoiceId, 'Invoice ID'), vendorId: c.vendorId, currency: c.currency, reference: string(c.reference, 'Credit reference'), amountCents: cents(c.amountCents, 'Credit amount'), status: c.status, sourceIds: clone(c.sourceIds) };
      if(view.credits.some(x=>x.vendorId===normalized.vendorId&&x.invoiceId===normalized.invoiceId&&x.lineId===normalized.lineId))fail('CONFLICT','This vendor invoice line is already registered under a credit ID.');
      const sourceLinks=links(view,c.sourceIds,c.vendorId);
      if(c.status==='applied') assert(c.sourceIds.some(id=>lookup(view.sources,id,'Source').kind==='invoice'),'Applied credit requires an invoice source; an issued memo is insufficient.');
      emit('CREDIT_REGISTERED', { credit: normalized, sourceLinks }); result = { creditId: c.id }; break;
    }
    case 'APPLY_CREDIT': {
      role(ctx, ['analyst']); const c = lookup(view.credits, command.creditId, 'Credit'); if (c.status === 'applied') fail('CONFLICT', 'This credit is already applied.');
      assert(Array.isArray(command.sourceIds)&&command.sourceIds.some(id=>lookup(view.sources,id,'Source').kind==='invoice'),'Application requires a separate invoice source; a credit memo alone is not applied savings.');
      const effective = command.effectiveDate || ctx.now.slice(0,10); assert(effective >= c.issuedDate && effective <= ctx.now.slice(0,10), 'Application date must follow issuance and cannot be in the future.');
      emit('CREDIT_APPLIED', { creditId: c.id, sourceLinks: links(view, command.sourceIds, c.vendorId) }); result = { creditId: c.id }; break;
    }
    case 'RESOLVE_CREDIT': {
      role(ctx, ['approver']); const credit = lookup(view.credits, command.creditId, 'Credit'); assert(Array.isArray(command.assignments) && command.assignments.length > 0, 'Provide explicit source-backed credit assignments.');
      const assignments = command.assignments.map(a => { const c = lookup(view.commitments, a.commitmentId, 'Commitment'); assert(c.vendorId === credit.vendorId && c.currency === credit.currency && c.reference === credit.reference, 'A resolution cannot override vendor, currency or commitment-reference identity.'); return { commitmentId: c.id, limitCents: cents(a.limitCents, 'Assignment limit') }; });
      assert(new Set(assignments.map(a=>a.commitmentId)).size === assignments.length, 'Resolve each commitment once.'); assert(sum(assignments.map(a=>a.limitCents)) <= credit.availableCents, 'Resolution limits exceed available credit.');
      for(const commitmentId of new Set(credit.allocations.map(a=>a.commitmentId))) assert((assignments.find(a=>a.commitmentId===commitmentId)?.limitCents || 0) >= sum(credit.allocations.filter(a=>a.commitmentId===commitmentId).map(a=>a.activeCents)), 'Resolution cannot erase an existing active allocation.');
      emit('CREDIT_RESOLVED', { creditId: credit.id, assignments, sourceLinks: links(view, command.sourceIds, credit.vendorId) }); result = { creditId: credit.id }; break;
    }
    case 'ALLOCATE_CREDIT': {
      role(ctx, ['analyst']); unique(view.allocations, command.allocationId, 'Allocation'); const credit = lookup(view.credits, command.creditId, 'Credit'), c = lookup(view.commitments, command.commitmentId, 'Commitment');
      const amount = cents(command.amountCents, 'Allocation amount');
      const effective = command.effectiveDate || ctx.now.slice(0,10); assert(effective >= credit.issuedDate && effective >= c.effectiveDate, 'Allocation cannot predate its credit or commitment.');
      assert(c.vendorId === credit.vendorId && c.currency === credit.currency && c.reference === credit.reference, 'Credit and commitment must have identical vendor ID, currency and reference.');
      if (credit.quarantined) fail('AMBIGUOUS', credit.quarantineReason, { creditId: credit.id, candidates: credit.candidateCommitmentIds });
      if (amount > credit.unallocatedCents) fail('INSUFFICIENT_CREDIT', 'This credit is already allocated or the requested allocation exceeds its remaining value.', { availableCents: credit.unallocatedCents });
      const existing = sum(credit.allocations.filter(a=>a.commitmentId===c.id).map(a=>a.activeCents));
      if (credit.resolution) assert(existing + amount <= (credit.resolution.assignments.find(a=>a.commitmentId===c.id)?.limitCents || 0), 'Allocation exceeds the explicit resolution limit.');
      emit('CREDIT_ALLOCATED', { allocation: { id: command.allocationId, creditId: credit.id, commitmentId: c.id, amountCents: amount } }); result = { allocationId: command.allocationId }; break;
    }
    case 'REVERSE_CREDIT': {
      role(ctx, ['analyst']); const credit = lookup(view.credits, command.creditId, 'Credit'), amount = cents(command.amountCents, 'Reversal amount');
      assert((command.effectiveDate||ctx.now.slice(0,10))>=credit.issuedDate,'A reversal cannot predate its credit.');
      assert(amount <= credit.availableCents, 'Cannot reverse more than the remaining credit.');
      const needed = Math.max(0, credit.allocatedCents - (credit.availableCents - amount));
      let allocationReversals = command.allocationReversals;
      const active = credit.allocations.filter(a=>a.activeCents>0);
      if (!allocationReversals) {
        if (needed === 0) allocationReversals = [];
        else if (needed === credit.allocatedCents) allocationReversals = active.map(a=>({allocationId:a.id,amountCents:a.activeCents}));
        else if (active.length === 1) allocationReversals = [{allocationId:active[0].id,amountCents:needed}];
        else fail('AMBIGUOUS', 'A partial reversal spanning several claims needs explicit allocationReversals.');
      }
      assert(Array.isArray(allocationReversals) && new Set(allocationReversals.map(a=>a.allocationId)).size === allocationReversals.length, 'Reversal allocations must be unique.');
      allocationReversals = allocationReversals.map(a=>{ const target = lookup(active,a.allocationId,'Active allocation'); const value=cents(a.amountCents,'Allocation reversal'); assert(value<=target.activeCents,'Cannot reverse more than the allocated amount.'); return {allocationId:target.id,amountCents:value}; });
      assert(sum(allocationReversals.map(a=>a.amountCents)) === needed, 'Allocation reversal amounts must equal the portion that no longer has ledger backing.', { neededCents:needed });
      emit('CREDIT_REVERSED', { creditId: credit.id, amountCents: amount, allocationReversals, sourceLinks: links(view,command.sourceIds,credit.vendorId) }); result = { creditId:credit.id,reopenedCents:needed }; break;
    }
    case 'SET_POLICY': {
      role(ctx, []); const next = policy(command.policy, `policy-${state.revision+1}`); emit('POLICY_SET',{policy:next}); result={policy:next}; break;
    }
    case 'PROPOSE_ACTION': {
      role(ctx, ['analyst','approver']); const raw=command.action; assert(raw,'Provide an action.'); const id=raw.id||`action-${state.revision+1}`; unique(view.actions,id,'Action');
      const specification={id,commitmentId:raw.commitmentId,type:raw.type,payload:clone(raw.payload||{})}; const simulation=simulationFor(view,specification);
      const action={...specification,...simulation}; action.basis=basisFor(view,action);
      emit('ACTION_PROPOSED',{action},{material:false}); result={actionId:id,action}; break;
    }
    case 'APPROVE_ACTION': {
      role(ctx, ['approver']); const action=lookup(view.actions,command.actionId,'Action'); if(action.executed)fail('ALREADY_EXECUTED','This action was already executed.'); if(action.approval)fail('CONFLICT','This action already has an approval; stale actions need a new proposal.');
      if(canonical(action.basis)!==canonical(basisFor(view,action)))fail('STALE_APPROVAL','Evidence, ledger, terms or policy changed after this proposal. Create a new proposal.');
      const current=simulationFor(view,action); if(!current.policyDecision.allowed)fail('POLICY_BLOCKED','The action is blocked by policy.',{reasons:current.policyDecision.reasons});
      const approval={actor:clone(ctx.actor),basis:basisFor(view,action)}; emit('ACTION_APPROVED',{actionId:action.id,approval},{material:false}); result={actionId:action.id,approval}; break;
    }
    case 'EXECUTE_ACTION': {
      role(ctx, ['executor']); const action=lookup(view.actions,command.actionId,'Action'); if(action.executed)fail('ALREADY_EXECUTED','Approved actions are one-use. This action was already executed.'); if(!action.approval)fail('FORBIDDEN','An approver must approve this exact action first.');
      if(canonical(action.approval.basis)!==canonical(basisFor(view,action)))fail('STALE_APPROVAL','The approval no longer matches the evidence, ledger, terms or policy revision.');
      const current=simulationFor(view,action); if(!current.policyDecision.allowed)fail('POLICY_BLOCKED','The action is blocked by current policy.',{reasons:current.policyDecision.reasons});
      if(action.type==='accept_amendment') { const a=lookup(view.amendments,action.payload.amendmentId,'Amendment'); emit('AMENDMENT_ACCEPTED',{amendmentId:a.id,actionId:action.id,economics:current.economics},{effectiveDate:a.effectiveDate}); }
      const outcome={mode:'local_simulation',type:action.type,commitmentId:action.commitmentId,notice:'No email, payment, renewal API call or vendor transaction was sent.',economics:current.economics};
      emit('ACTION_EXECUTED',{actionId:action.id,result:outcome},{material:false}); result={actionId:action.id,...outcome}; break;
    }
    default: fail('VALIDATION',`Unknown command type ${command.type}.`);
  }
  const next={...state,events:[...state.events,...queued],revision:state.revision+queued.length};
  const invariant=validateWorkspace(next,{asOf:ctx.now.slice(0,10),knownAt:ctx.now});
  if(!invariant.valid)fail('INVARIANT','Command would violate a financial invariant.',{violations:invariant.violations});
  return {state:next,result:{...result,commandId,eventIds:queued.map(e=>e.id)}};
}

export function validateWorkspace(state, options={}) {
  const violations=[];
  try {
    checkState(state);
    for(let i=0;i<state.events.length;i++) { const e=state.events[i]; if(e.sequence!==i+1 || e.id!==`event-${i+1}`)violations.push('Event sequence is not contiguous.'); if(i>0&&e.observedAt<state.events[i-1].observedAt)violations.push('Knowledge time moved backward.'); }
    const view=evaluateWorkspace(state,options);
    for(const credit of view.credits) {
      if(credit.availableCents<0||credit.allocatedCents<0||credit.allocatedCents>credit.availableCents)violations.push(`Credit ${credit.id} is overallocated or over-reversed.`);
      if(credit.availableCents!==credit.allocatedCents+credit.unallocatedCents)violations.push(`Credit ${credit.id} does not conserve cents.`);
    }
    for(const a of view.allocations) {
      if(a.activeCents<0||a.revokedCents<0||a.activeCents+a.revokedCents!==a.amountCents)violations.push(`Allocation ${a.id} is not conserved.`);
      const c=view.commitments.find(c=>c.id===a.commitmentId),credit=view.credits.find(c=>c.id===a.creditId);
      if(!c||!credit||c.vendorId!==credit.vendorId||c.currency!==credit.currency||c.reference!==credit.reference)violations.push(`Allocation ${a.id} has inconsistent identity or lineage.`);
    }
    for(const c of view.commitments)if(c.verifiedCents<0||c.verifiedCents>c.promisedCents||c.outstandingCents<0||c.verifiedCents+c.outstandingCents!==c.promisedCents)violations.push(`Commitment ${c.id} violates promise accounting.`);
    if(view.totals.verifiedCents>view.totals.ledgerAppliedCents)violations.push('Attributed verified money exceeds the applied ledger.');
    const ids=new Set(view.graph.nodes.map(n=>n.id)); for(const edge of view.graph.edges)if(!ids.has(edge.from)||!ids.has(edge.to))violations.push('Evidence graph contains a dangling edge.');
  } catch(error) { violations.push(error.message); }
  return {valid:violations.length===0,violations};
}

function graphFor(events,view) {
  const nodes=new Map(),edges=[];
  const node=(id,kind,label,extra={})=>{if(!nodes.has(id))nodes.set(id,{id,kind,label,...extra});return id;};
  const edge=(from,to,relation,eventId)=>edges.push({id:`edge-${edges.length+1}`,from,to,relation,eventId});
  for(const vendor of view.vendors)node(`vendor:${vendor.id}`,'vendor',vendor.name);
  for(const source of view.sourceVersions) { const id=node(`source:${source.id}@${source.revision}`,'source',source.title,{sourceId:source.id,revision:source.revision,text:source.text,observedAt:source.observedAt});edge(`vendor:${source.vendorId}`,id,'provided',source.eventId); }
  for(const c of view.commitments) { const id=node(`commitment:${c.id}`,'commitment',c.reference,{amountCents:c.promisedCents,status:c.status}); for(const l of c.sourceLinks)edge(`source:${l.sourceId}@${l.revision}`,id,'supports',null); }
  for(const a of view.amendments)node(`amendment:${a.id}`,'amendment',a.id,{accepted:a.accepted,rejected:a.rejected,conflictIds:clone(a.conflictingAmendmentIds),basisStale:a.basisStale,effectiveDate:a.effectiveDate});
  for(const a of view.amendments) { const id=`amendment:${a.id}`; if(view.commitments.some(c=>c.id===a.commitmentId))edge(id,`commitment:${a.commitmentId}`,a.accepted?'amends':a.rejected?'dismissed_proposal':'proposes_change',a.eventId);for(const l of a.sourceLinks)edge(`source:${l.sourceId}@${l.revision}`,id,'supports',a.eventId);for(const target of a.supersedesAmendmentIds||[])edge(id,`amendment:${target}`,a.accepted?'explicitly_replaces':'proposes_replacement',a.acceptedEventId||a.eventId);for(const other of a.conflictingAmendmentIds)if(a.id<other)edge(id,`amendment:${other}`,'conflicts_with',null);if(a.dismissal){const dismissalId=node(`dismissal:${a.id}`,'decision',a.dismissal.reason,{actor:a.dismissal.actor,observedAt:a.dismissal.observedAt});edge(dismissalId,id,'dismisses',a.dismissal.eventId);} }
  for(const c of view.credits) { const id=node(`credit:${c.id}`,'credit',c.invoiceId,{amountCents:c.availableCents,status:c.status});for(const l of [...c.sourceLinks,...(c.applicationSourceLinks||[])])edge(`source:${l.sourceId}@${l.revision}`,id,'evidences',null); }
  for(const a of view.allocations) { const id=node(`allocation:${a.id}`,'allocation',a.id,{amountCents:a.activeCents}); if(view.credits.some(c=>c.id===a.creditId))edge(`credit:${a.creditId}`,id,'funds',a.eventId);if(view.commitments.some(c=>c.id===a.commitmentId))edge(id,`commitment:${a.commitmentId}`,'applies_to',a.eventId); }
  for(const a of view.actions) { const id=node(`action:${a.id}`,'action',a.type,{status:a.status});if(view.commitments.some(c=>c.id===a.commitmentId))edge(id,`commitment:${a.commitmentId}`,'acts_on',a.eventId);if(a.payload.amendmentId&&view.amendments.some(m=>m.id===a.payload.amendmentId))edge(id,`amendment:${a.payload.amendmentId}`,'considers',a.eventId);if(a.approval){const aid=node(`approval:${a.id}`,'approval',a.approval.actor.id,{stale:a.approvalStale});edge(aid,id,'authorizes',a.approval.eventId);} }
  for(const event of events.filter(e=>e.type==='CREDIT_REVERSED')) { const id=node(`reversal:${event.id}`,'reversal','Credit reversal',{amountCents:event.payload.amountCents,effectiveDate:event.effectiveDate,observedAt:event.observedAt});if(view.credits.some(c=>c.id===event.payload.creditId))edge(id,`credit:${event.payload.creditId}`,'reverses',event.id);for(const l of event.payload.sourceLinks)edge(`source:${l.sourceId}@${l.revision}`,id,'supports',event.id); }
  return {nodes:[...nodes.values()],edges,semantics:'Edges carry recorded causal support and authorization. They do not establish authenticity or completeness of sources.'};
}
