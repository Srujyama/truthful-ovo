// This boundary augments new service writes. It does not change the reducer or
// reinterpret older accepted audit profiles during historical replay.
export const validationProfile = 'truthful-financial-transition-v2';

const recognized = new Set(['CREATE_COMMITMENT','REGISTER_CREDIT','APPLY_CREDIT','ALLOCATE_CREDIT','REVERSE_CREDIT','RESOLVE_CREDIT','PROPOSE_AMENDMENT','EXECUTE_ACTION']);
const flatten = commands => (Array.isArray(commands) ? commands : [commands]).flatMap(command => command?.type === '__BATCH__' ? flatten(command.commands) : command ? [command] : []);
const failure = (message, details) => { throw Object.assign(new Error(message), { name:'FinancialHistoryError', status:422, code:'FINANCIAL_HISTORY_INVALID', details:{ profile:validationProfile, ...details } }); };

function violations(state, asOf, now, engine) {
  const out = [];
  let view;
  try { view = engine.evaluateWorkspace(state,{asOf,knownAt:now}); }
  catch (error) { return [{kind:'PROJECTION_INVALID',asOf,message:error.message}]; }
  if (!Array.isArray(view.credits)) return [];
  for (const credit of view.credits) {
    if (![credit.availableCents,credit.allocatedCents,credit.unallocatedCents].every(Number.isSafeInteger) || credit.availableCents < 0 || credit.allocatedCents < 0 || credit.unallocatedCents < 0 || credit.availableCents !== credit.allocatedCents+credit.unallocatedCents) out.push({kind:'CREDIT_CONSERVATION',asOf,creditId:credit.id,message:'Physical credit capacity is not conserved.'});
    const totals = new Map();
    for (const allocation of credit.allocations || []) {
      if (![allocation.amountCents,allocation.revokedCents,allocation.activeCents].every(Number.isSafeInteger) || allocation.activeCents < 0 || allocation.revokedCents < 0 || allocation.amountCents !== allocation.activeCents+allocation.revokedCents) out.push({kind:'ALLOCATION_CONSERVATION',asOf,creditId:credit.id,allocationId:allocation.id,message:'Attribution capacity is not conserved.'});
      totals.set(allocation.commitmentId,(totals.get(allocation.commitmentId)||0)+allocation.activeCents);
    }
    // Limits are authorization maxima, not reservations. A later reversal can
    // reduce physical capacity without rewriting a previously approved maximum.
    if (credit.resolution) for (const [commitmentId,activeCents] of totals) {
      const limitCents = credit.resolution.assignments.find(row=>row.commitmentId===commitmentId)?.limitCents || 0;
      if (activeCents > limitCents) out.push({kind:'RESOLUTION_ACTIVE_CAP',asOf,creditId:credit.id,commitmentId,activeCents,limitCents,message:'Active attribution exceeds the resolution effective at this financial date.'});
    }
  }
  if (typeof engine.validateWorkspace === 'function') {
    const checked = engine.validateWorkspace(state,{asOf,knownAt:now});
    for (const message of checked.violations || []) if (!out.some(item=>item.message===message)) out.push({kind:'MODEL_INVARIANT',asOf,message});
  }
  return out;
}

/** Validate one already-reduced transaction before any persistent effect commits. */
export function validateFinancialTransition({ before, after, commands, now, engine }) {
  const batch = flatten(commands);
  if (!engine || typeof engine.evaluateWorkspace !== 'function' || typeof now !== 'string' || !Number.isFinite(Date.parse(now)) || new Date(now).toISOString() !== now) failure('The financial validation context is unavailable.',{kind:'VALIDATION_CONTEXT'});
  const probe = engine.evaluateWorkspace(after,{asOf:now.slice(0,10),knownAt:now});
  if (!Array.isArray(probe.credits)) {
    if (batch.some(command=>recognized.has(command.type))) failure('The selected engine does not expose financial validation.',{kind:'UNSUPPORTED_FINANCIAL_ENGINE'});
    return {profile:validationProfile,valid:true,applicable:false,reason:'No financial projection is exposed for these nonfinancial transport commands.'};
  }
  const reset = batch.length === 1 && batch[0].type === '__DEMO_RESET__';
  const newEvents = reset ? [] : (after.events || []).slice((before.events || []).length);
  if (!reset && JSON.stringify((after.events || []).slice(0,(before.events || []).length)) !== JSON.stringify(before.events || [])) failure('A new transaction cannot rewrite previously recorded financial events.',{kind:'HISTORY_PREFIX_CHANGED'});
  const dates = [...new Set([now.slice(0,10), ...(before.events || []).map(event=>event.effectiveDate), ...(after.events || []).map(event=>event.effectiveDate)].filter(date=>typeof date==='string' && date<=now.slice(0,10)))].sort();
  const beforeViolations = dates.flatMap(asOf=>violations(before,asOf,now,engine));
  const afterViolations = dates.flatMap(asOf=>violations(after,asOf,now,engine));
  if (beforeViolations.length && !reset) failure('The existing financial history requires inspection before another write can be accepted.',{kind:'PREEXISTING_HISTORY_INVALID',violations:beforeViolations});
  if (afterViolations.length) failure('This transaction would introduce an inconsistent financial history.',{kind:'TRANSITION_HISTORY_INVALID',violations:afterViolations});
  const atCurrent = engine.evaluateWorkspace(after,{asOf:now.slice(0,10),knownAt:now});
  const sourceVersions = atCurrent.sourceVersions || [];
  const issueDates = new Map((after.events || []).filter(event=>event.type==='CREDIT_REGISTERED').map(event=>[event.payload.credit.id,event.effectiveDate]));
  for (const event of newEvents) {
    const p = event.payload || {}, creditId = p.creditId || p.credit?.id || p.allocation?.creditId;
    if (['CREDIT_REGISTERED','CREDIT_APPLIED','CREDIT_ALLOCATED','CREDIT_REVERSED','CREDIT_RESOLVED','COMMITMENT_CREATED'].includes(event.type) && event.effectiveDate > now.slice(0,10)) failure('New financial facts cannot be future-dated.',{kind:'FUTURE_FINANCIAL_FACT',eventId:event.id,effectiveDate:event.effectiveDate});
    if (['CREDIT_APPLIED','CREDIT_RESOLVED','CREDIT_REVERSED'].includes(event.type) && event.effectiveDate < issueDates.get(creditId)) failure('A credit effect cannot predate its issuance.',{kind:'EFFECT_BEFORE_ISSUANCE',eventId:event.id,creditId,effectiveDate:event.effectiveDate,issuedDate:issueDates.get(creditId)});
    if (event.type === 'CREDIT_REVERSED') for (const reversed of p.allocationReversals || []) {
      const original = after.events.find(entry=>entry.type==='CREDIT_ALLOCATED' && entry.payload.allocation.id===reversed.allocationId);
      if (!original || original.effectiveDate > event.effectiveDate) failure('A reversal cannot predate a causal attribution it removes.',{kind:'REVERSAL_BEFORE_ATTRIBUTION',eventId:event.id,allocationId:reversed.allocationId,effectiveDate:event.effectiveDate,allocationEffectiveDate:original?.effectiveDate});
    }
    const credit = atCurrent.credits.find(item=>item.id===creditId);
    const commitmentId = p.commitment?.id || p.amendment?.commitmentId || p.allocation?.commitmentId;
    const vendorId = p.credit?.vendorId || p.commitment?.vendorId || credit?.vendorId || atCurrent.commitments.find(item=>item.id===commitmentId)?.vendorId;
    const links = p.sourceLinks || p.allocation?.sourceLinks || [];
    for (const link of links) {
      const source = sourceVersions.find(item=>item.id===link.sourceId && item.revision===link.revision);
      const currentWhenBound = sourceVersions.filter(item=>item.id===link.sourceId && item.revision<event.sequence).sort((a,b)=>b.revision-a.revision)[0];
      if (!source || source.vendorId !== vendorId || currentWhenBound?.revision !== link.revision) failure('Financial source lineage differs from its exact vendor or bound revision.',{kind:'SOURCE_BINDING_INVALID',eventId:event.id,sourceId:link.sourceId,revision:link.revision,vendorId});
      if (event.type === 'CREDIT_RESOLVED' && source.kind !== 'allocation_resolution') failure('New credit resolutions require recorded allocation-resolution clarification evidence.',{kind:'RESOLUTION_SOURCE_KIND',eventId:event.id,sourceId:source.id,sourceKind:source.kind});
    }
    if (event.type === 'CREDIT_RESOLVED') {
      const effective = engine.evaluateWorkspace(after,{asOf:event.effectiveDate,knownAt:now}).credits.find(item=>item.id===p.creditId);
      const total = p.assignments.reduce((sum,item)=>sum+item.limitCents,0);
      if (!effective || !Number.isSafeInteger(total) || total>effective.availableCents) failure('New assignment limits exceed available credit at their effective date.',{kind:'RESOLUTION_TOTAL_CAP',eventId:event.id,creditId:p.creditId,effectiveDate:event.effectiveDate,totalLimitCents:total,availableCents:effective?.availableCents});
    }
  }
  return {profile:validationProfile,valid:true,applicable:true,effectiveBoundaries:dates.length,newEvents:newEvents.length,...(reset && beforeViolations.length ? {preservedPreexistingViolations:beforeViolations} : {})};
}
