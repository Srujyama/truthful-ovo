// The test bench's words and small sums, kept out of the JSX so they can be read
// (and run in node) in one place.
//
// The engine decides everything: src/explorer runs the orderings, src/authority
// signs and checks the slips, src/assurance/scenarios.mjs runs the nine. This
// file only says what they answered to the person at the bench, and puts the
// engineering word beside it where an engineer would look for it.
//
//   setupWords(id)                  → { label, line, tech }    one of the five written set-ups
//   clerk(agentId)                  → "Clerk A" | "The bookkeeper" | the plan's own name
//   didWords(step, plan?)           → "Looks: is there $900 left on the note?"
//   saidWords(step, ctx)            → { text, tone: 'ok' | 'no' | 'wrong' }
//   pairOf(result)                  → the two orderings laid side by side, step by step
//   verdictOf(packet, kept)         → { stamp, ink, small, line }
//   figuresOf(scenario, kept)       → what the two figures that matter were before and after each step
//   factsOf(packet)                 → "19 states · 6 orderings · 2 finish clean"
//   trialWords(id), checkWords(check), trialStep(step)         the nine ways
//   slipTrouble(text), recordTrouble(verification), runTrouble(error)   refusals, as sentences

import { evaluateWorkspace } from '../../../assurance/index.mjs';
import { dollars, shortDay } from '../../shell/money.mjs';

const money = cents => (Number.isSafeInteger(cents) ? dollars(cents) : '');
/** "REVISE_SOURCE" → "revise source", for a command the bench has no sentence for. */
const bare = type => String(type || 'look').toLowerCase().replaceAll('_', ' ');
const plural = (n, one, many = `${one}s`) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;

// ————————————————————————————————————————————————— two clerks: the set-ups

const SETUPS = {
  'concurrent-credit': {
    label: 'Both give out the same $900 credit',
    line: 'Each clerk looks, sees $900 left on the note, then writes $900 against the promise.',
    tech: 'check-then-act race',
  },
  'stale-source': {
    label: 'One writes in a decision while its paper is replaced',
    line: 'The bookkeeper looks at an approved decision. The paper under it is replaced. The bookkeeper writes the decision in.',
    tech: 'stale approval',
  },
  'deadline-drift': {
    label: 'One writes in a claim while its window closes',
    line: 'The bookkeeper looks at an approved claim on Oct 29. The window closes Oct 30. The bookkeeper writes it in on Oct 31.',
    tech: 'deadline drift',
  },
  'competing-amendments': {
    label: 'One writes in an offer while a rival offer arrives',
    line: 'The bookkeeper looks at an approved offer. A second offer for the same promise is filed. The bookkeeper writes the first one in.',
    tech: 'competing amendments',
  },
  'benign-completion': {
    label: 'One writes in a decision and nobody interferes',
    line: 'An approved decision and nothing in its way. It should go straight in.',
    tech: 'benign completion',
  },
};

export function setupWords(id, fallback = {}) {
  return SETUPS[id] || { label: fallback.name || id, line: '', tech: id };
}

/** What a copy of one of the book's own decisions is raced against. */
export const MEANWHILE = [
  { id: 'none', label: 'Nothing else', line: 'A copy of this decision, with nobody in its way.' },
  { id: 'source_revision', label: 'One of its papers is replaced', line: 'A copy of this decision. One of the papers under it is replaced while the bookkeeper is writing.' },
  { id: 'deadline', label: 'The claim window closes', line: 'A copy of this decision. Its claim window closes while the bookkeeper is writing.' },
];

export const LIMITS = [
  { id: '2000', label: 'Every ordering up to 2,000 states' },
  { id: '300', label: 'Every ordering up to 300 states' },
  { id: '10', label: 'Only 10 states (it will run out of room)' },
];

// ————————————————————————————————————————————————— two clerks: who, what they did, what the ledger said

const WHO = {
  'consumer-a': 'Clerk A',
  'consumer-b': 'Clerk B',
  workflow: 'The bookkeeper',
  'evidence-feed': 'The filing clerk',
  'trusted-clock': 'The clock',
  'finance-resolution': 'The approver',
  'fresh-proposer': 'The analyst',
  'fresh-finance': 'The approver',
  'fresh-executor': 'The bookkeeper',
  'portfolio-action': 'The bookkeeper',
  'hypothetical-source-feed': 'The filing clerk',
  'hypothetical-clock': 'The clock',
};
const PEN = { viewer: 'reader', analyst: 'analyst', approver: 'approver', executor: 'bookkeeper', admin: 'owner' };

/** The name a participant goes by at the bench. A plan typed by hand keeps its own names. */
export function clerk(agentId) {
  return WHO[agentId] || String(agentId || 'Someone');
}
/** The engineer's word for the same participant: "consumer-a · analyst". */
export function clerkTech(agentId, actor) {
  return `${agentId} · ${PEN[actor?.role] || actor?.role || 'no pen'}`;
}

/** The command a step carries. A "commit" in a plan points back at the look it trusts. */
function commandOf(step, plan) {
  if (step.command) return step.command;
  if (step.checkId && plan) {
    for (const agent of plan.agents || []) {
      const looked = agent.steps.find(s => s.id === step.checkId);
      if (looked) return looked.command;
    }
  }
  return null;
}

/** What a clerk did at one step, as a short sentence. Works on a plan's step and on a step of a finished run. */
export function didWords(step, plan = null) {
  const command = commandOf(step, plan);
  const type = command?.type;
  const amount = money(command?.amountCents);
  if (step.kind === 'advanceTime') return `Runs forward to ${shortDay(step.now)}.`;
  if (step.kind === 'check') {
    if (type === 'ALLOCATE_CREDIT') return `Looks: is there ${amount} left on the note?`;
    if (type === 'EXECUTE_ACTION') return 'Looks: is the decision still approved?';
    return `Looks: would this go in? (${bare(type)})`;
  }
  const once = step.kind === 'atomic';
  if (type === 'ALLOCATE_CREDIT') return once ? `Looks and writes ${amount} against the promise, in one move.` : `Writes ${amount} against the promise.`;
  if (type === 'EXECUTE_ACTION') return once ? 'Looks and writes the decision in the book, in one move.' : 'Writes the decision in the book.';
  if (type === 'REVISE_SOURCE') return 'Replaces the paper the decision rests on.';
  if (type === 'PROPOSE_AMENDMENT') return 'Files a second offer for the same promise.';
  if (type === 'DISMISS_AMENDMENT') return 'Declines the second offer.';
  if (type === 'PROPOSE_ACTION') return 'Prepares the decision again.';
  if (type === 'APPROVE_ACTION') return 'Approves the new decision.';
  if (type === 'ADD_SOURCE') return 'Files a paper.';
  if (type === 'REGISTER_CREDIT') return `Files a credit note${amount ? ` for ${amount}` : ''}.`;
  if (type === 'APPLY_CREDIT') return 'Says the credit note is on an invoice.';
  if (type === 'REVERSE_CREDIT') return `Takes back ${amount || 'a credit'}.`;
  return `Sends “${bare(type)}”.`;
}

/** Why the ledger says no, in the reader's words. `clockMoved`: the day changed earlier in this ordering. */
export function whyNo(error, { clockMoved = false } = {}) {
  const code = error?.code;
  if (code === 'INSUFFICIENT_CREDIT') return 'There is not that much credit left on the note.';
  if (code === 'STALE_APPROVAL') return 'The book changed after it was approved.';
  if (code === 'POLICY_BLOCKED') return clockMoved ? 'Its claim window has closed.' : 'The house rules stop it now.';
  if (code === 'ALREADY_EXECUTED') return 'It is already in the book.';
  if (code === 'FORBIDDEN') return 'That pen may not write this.';
  if (code === 'AMBIGUOUS') return 'Two promises share that reference. Someone has to say which one it covers.';
  if (code === 'NOT_FOUND') return 'The book has no such thing.';
  return String(error?.message || 'The ledger said no.');
}

/**
 * What the ledger answered at one step of a finished run.
 * ctx: { wrong: the engine marked this step as written when it should not have been, clockMoved }
 */
export function saidWords(step, { wrong = false, clockMoved = false } = {}) {
  const type = step.command?.type;
  const ctx = { clockMoved };
  if (wrong) return { tone: 'wrong', text: `Written in anyway. ${whyNo(step.oracle?.error, ctx)}` };
  switch (step.status) {
    case 'check_passed': {
      if (type === 'ALLOCATE_CREDIT') {
        const note = step.before?.credits?.find(c => c.id === step.command.creditId);
        return { tone: 'ok', text: note ? `Yes. ${money(note.unallocatedCents)} is left.` : 'Yes.' };
      }
      return { tone: 'ok', text: type === 'EXECUTE_ACTION' ? 'Yes. It is approved.' : 'Yes.' };
    }
    case 'check_rejected': return { tone: 'no', text: `No. ${whyNo(step.error, ctx)}` };
    case 'effect_committed': return { tone: 'ok', text: type === 'REVISE_SOURCE' || type === 'PROPOSE_AMENDMENT' || type === 'ADD_SOURCE' ? 'Filed.' : 'Written in.' };
    case 'commit_blocked': return { tone: 'no', text: 'Left out. The earlier look had already said no.' };
    case 'commit_rejected': return { tone: 'no', text: `Refused. ${whyNo(step.error, ctx)}` };
    case 'idempotent': return { tone: 'ok', text: 'Already in the book. Nothing is written twice.' };
    case 'clock_advanced': return { tone: 'ok', text: `It is now ${shortDay(step.now)}.` };
    default: return { tone: 'ok', text: 'Looked.' };
  }
}

// ————————————————————————————————————————————————— two clerks: the two orderings side by side

const sameOrder = (a, b) => Boolean(a && b) && a.schedule.length === b.schedule.length && a.schedule.every((id, i) => id === b.schedule[i]);

/**
 * The two orderings the page lays side by side: the same run under two rules.
 *   once   checking once, then trusting it   (the engine's "naive" mode)
 *   again  checking again at the moment of writing (its "guarded" mode: the real ledger)
 * When checking once goes wrong, the right-hand side is the very same ordering replayed under the
 * real ledger (the engine keeps that pairing itself). Otherwise each side shows the ordering it kept.
 * kind: 'wrong' | 'finish' | 'refusal' | 'none'  (what the left-hand ordering is)
 */
export function pairOf(result) {
  const naive = result?.naive, guarded = result?.guarded;
  if (!naive || !guarded) return { once: null, again: null, kind: 'none', rows: [], same: false };
  const once = naive.shortestWitness || naive.completionTrace || naive.guardedRejection || null;
  let again;
  if (naive.shortestWitness) again = naive.sameScheduleGuardedReplay || guarded.guardedRejection || guarded.completionTrace || null;
  else again = [guarded.completionTrace, guarded.guardedRejection].find(kept => sameOrder(kept, once)) || guarded.guardedRejection || guarded.completionTrace || null;
  const kind = naive.shortestWitness ? 'wrong' : naive.completionTrace ? 'finish' : once ? 'refusal' : again ? 'finish' : 'none';
  const rows = rowsOf(once, again);
  return { once, again, kind, rows, same: sameOrder(once, again) };
}

function stepView(kept, index) {
  const step = kept?.trace[index];
  if (!step) return null;
  const wrong = kept.unsafeEffects.some(effect => effect.stepId === step.stepId);
  const clockMoved = kept.trace.slice(0, index + 1).some(s => s.kind === 'advanceTime');
  return { step, wrong, ...saidWords(step, { wrong, clockMoved }) };
}

/** One row per step. `once` and `again` are that step under each rule (null when that side is shorter). */
export function rowsOf(once, again) {
  const length = Math.max(once?.trace.length || 0, again?.trace.length || 0);
  return Array.from({ length }, (_, index) => {
    const left = stepView(once, index), right = stepView(again, index);
    const lead = left || right;
    return {
      index,
      id: lead.step.stepId,
      who: clerk(lead.step.agentId),
      whoTech: clerkTech(lead.step.agentId, lead.step.actor),
      did: didWords(lead.step),
      once: left,
      again: right,
      // the two sides took a different step here (only a plan typed by hand can do this)
      apart: Boolean(left && right && left.step.stepId !== right.step.stepId),
      againDid: right && left && left.step.stepId !== right.step.stepId ? `${clerk(right.step.agentId)}: ${didWords(right.step)}` : '',
    };
  });
}

/** "all 6 orderings", "both orderings", "the one ordering there is". */
export const everyOrdering = n => (n === 1 ? 'the one ordering there is' : n === 2 ? 'both orderings' : `all ${n.toLocaleString('en-US')} orderings`);

const CUTOFF = { maxStates: 'the state limit', maxTimeMs: 'the two-second limit', maxDepth: 'twelve steps deep', maxTransitions: 'the 6,000-move limit' };

/** The stamp and the one line for one side of the run. `kept` is the ordering shown on that side. */
export function verdictOf(packet, kept) {
  if (!packet) return { stamp: '', ink: 'blue', small: false, line: '' };
  if (packet.status === 'unsafe_effect_found') {
    const witness = packet.shortestWitness;
    const at = witness.trace.findIndex(step => witness.unsafeEffects.some(effect => effect.stepId === step.stepId));
    const step = witness.trace[at];
    const codes = witness.unsafeEffects.map(effect => effect.reason);
    const clockMoved = witness.trace.slice(0, at + 1).some(s => s.kind === 'advanceTime');
    const overdrawn = witness.unsafeEffects.some(effect => effect.property === 'credit-conservation') || codes.includes('INSUFFICIENT_CREDIT');
    let what = 'writes in something the ledger would refuse';
    if (overdrawn) what = `gives out ${money(step.command?.amountCents) || 'credit'} that is already gone`;
    else if (codes.includes('STALE_APPROVAL')) what = 'writes in a decision that was approved before the book changed';
    else if (codes.includes('POLICY_BLOCKED')) what = clockMoved ? 'writes in a claim after its window closed' : 'writes in a decision the house rules now stop';
    return { stamp: 'Goes wrong', ink: 'red', small: false, line: `Step ${at + 1} ${what}.` };
  }
  if (packet.status === 'inconclusive') {
    return { stamp: 'Ran out of room', ink: 'blue', small: true, line: `Looked at ${plural(packet.stats.exploredStates, 'state')} and stopped. That is not a pass.` };
  }
  const refusedAt = kept ? kept.trace.findIndex(step => step.status === 'commit_rejected') : -1;
  if (refusedAt >= 0) {
    const clockMoved = kept.trace.slice(0, refusedAt + 1).some(s => s.kind === 'advanceTime');
    return { stamp: 'Holds', ink: 'blue', small: false, line: `Step ${refusedAt + 1} is refused. ${whyNo(kept.trace[refusedAt].error, { clockMoved })}` };
  }
  return { stamp: 'Holds', ink: 'blue', small: false, line: `Tried ${everyOrdering(packet.stats.terminalSchedules)}. None goes wrong.` };
}

/** The counts under a side, typed small: what was tried and how it ended. */
export function factsOf(packet) {
  if (!packet) return '';
  const s = packet.stats, g = packet.goalCompletion;
  const parts = [plural(s.exploredStates, 'state'), plural(s.terminalSchedules, 'ordering')];
  if (s.terminalSchedules) parts.push(s.unsafeSchedules ? `${s.unsafeSchedules} ${s.unsafeSchedules === 1 ? 'goes' : 'go'} wrong` : `${g.safeCompletedSchedules} ${g.safeCompletedSchedules === 1 ? 'finishes' : 'finish'} clean`);
  if (s.cutoffReason) parts.push(`stopped at ${CUTOFF[s.cutoffReason] || s.cutoffReason}`);
  return parts.join(' · ');
}

// ————————————————————————————————————————————————— two clerks: the figures that matter

const STANDING = { proposed: 'prepared', approved: 'approved', stale: 'out of date', blocked: 'stopped', executed: 'written in' };

/** The promise a plan is about: the one its decision belongs to, or the one its credit is written against. */
function promiseIdOf(scenario, view) {
  if (scenario.goal?.type === 'action_executed') {
    const action = view.actions.find(a => a.id === scenario.goal.actionId);
    if (action) return action.commitmentId;
  }
  for (const agent of scenario.agents || []) {
    for (const step of agent.steps) if (step.command?.commitmentId) return step.command.commitmentId;
  }
  return view.commitments[0]?.id || null;
}

function standingOf(scenario, events, now) {
  try {
    const view = evaluateWorkspace({ ...scenario.initialState, events, revision: events.length }, { asOf: now.slice(0, 10), knownAt: now });
    const promise = view.commitments.find(c => c.id === promiseIdOf(scenario, view));
    const decision = scenario.goal?.type === 'action_executed' ? view.actions.find(a => a.id === scenario.goal.actionId) : null;
    return {
      entries: events.length,
      // what is left on the credit notes to give out; negative when one has been given out twice
      creditLeftCents: view.credits.length ? view.credits.reduce((sum, c) => sum + c.unallocatedCents, 0) : null,
      owedCents: promise ? promise.outstandingCents : null,
      decision: decision ? STANDING[decision.status] || decision.status : null,
    };
  } catch {
    return { entries: events.length, creditLeftCents: null, owedCents: null, decision: null };
  }
}

/**
 * For each step of an ordering, the book just before it and just after it:
 *   [{ before, after }]  each { entries, creditLeftCents, owedCents, decision }
 * Rebuilt from the entries each step wrote, so it is the same book the engine was looking at.
 */
export function figuresOf(scenario, kept) {
  if (!scenario || !kept) return [];
  let events = scenario.initialState.events;
  let now = scenario.initialNow;
  return kept.trace.map(step => {
    const before = standingOf(scenario, events, step.before?.now || now);
    events = step.effects?.length ? [...events, ...step.effects] : events;
    now = step.now;
    return { before, after: standingOf(scenario, events, now) };
  });
}

// ————————————————————————————————————————————————— two clerks: a way that works

const FIX = {
  atomic_check_commit_preserving_distinct_intents: 'Each clerk looks and writes in one move. The first gets the $900. The second is told no.',
  atomic_commit_with_deadline_recheck: 'The bookkeeper looks and writes in one move. Before the window closes it goes in. After, it is refused, and the deadline stays where it was.',
  refresh_then_authorized_reapproval_and_atomic_commit: 'After the change, an analyst prepares the decision again, an approver approves it again, and the bookkeeper writes that one in.',
  atomic_check_commit: 'The bookkeeper looks and writes in one move.',
};

/** The engine's repaired steps, said plainly. */
export function fixWords(repair) {
  return FIX[repair?.plan?.repair?.operation] || 'The same steps, with each look and its writing done in one move.';
}

/** A line for a run that could not start or finish. */
export function runTrouble(error) {
  const code = error?.code, text = String(error?.message || error || '');
  if (error instanceof SyntaxError || /JSON/.test(text)) return 'Those steps are not valid JSON. Fix them, or put the written steps back.';
  if (code === 'EXPLORER_BUSY') return 'Another run is still going. Try again in a moment.';
  if (code === 'REVISION_CONFLICT' || code === 'STALE_REVISION') return 'The book changed while this was starting. Run it again.';
  if (code === 'DEADLINE_NOT_APPLICABLE') return 'This decision has no claim window to close. Race it against something else.';
  if (code === 'DEADLINE_UNAVAILABLE') return 'This promise has no claim deadline to run past.';
  if (code === 'DEADLINE_EXPIRED') return 'Its claim window has already closed.';
  if (code === 'ACTION_UNAPPROVED') return 'This decision is not approved yet. Approve it on its IOU page first.';
  if (code === 'STALE_APPROVAL') return 'The papers changed after this decision was approved. Prepare and approve it again on its IOU page.';
  if (code === 'POLICY_BLOCKED') return 'The house rules stop this decision today, so there is nothing to race.';
  if (code === 'ACTION_EXECUTED') return 'This decision is already written in the book.';
  if (code === 'ACTION_NOT_FOUND') return 'That decision is not in this book any more.';
  if (code === 'SOURCE_UNAVAILABLE') return 'This decision rests on no paper that could be replaced.';
  if (code === 'PLAN_LIMIT') return 'This book is too long for the bench: it takes at most 100 entries.';
  if (code === 'FORBIDDEN') return 'A reader may look at runs but not start one.';
  if (/Invalid bounded plan|Invalid agent|Invalid or duplicate step|Unknown step dependency|Unsupported/.test(text)) return `The bench cannot run those steps: ${text}`;
  return text || 'The run stopped.';
}

// ————————————————————————————————————————————————— nine ways it could go wrong

const TRIALS = {
  'double-allocation': { name: 'Use the same $900 credit twice', line: 'The $900 on Pipeline CRM’s invoice is already matched to its promise. Match it again.' },
  'issued-not-applied': { name: 'Count a credit note as money', line: 'Nimbus sent a $2,000 note. Call it credited with no invoice, then add the invoice.' },
  'credit-reversal': { name: 'Take a credit back', line: 'Pipeline CRM reverses its $900. The promise should go back to $2,400 still owed.' },
  'stale-approval': { name: 'Write in a decision after its paper changed', line: 'Approve a decision, replace the email under it, then write the decision in.' },
  'negative-renewal': { name: 'Approve a renewal that costs more than it gives', line: 'A $1,500 credit for $2,400 of extra spending. Approve it.' },
  'late-amendment': { name: 'Let the book know something before it was told', line: 'A change dated Oct 15 is filed on Nov 5. Ask the book what it knew on Oct 20.' },
  'ambiguous-credit': { name: 'Match a credit when two promises share a reference', line: 'A second promise turns up with the same reference. Match the credit to it without proof.' },
  'deadline-drift': { name: 'Claim after the window has closed', line: 'Nimbus’s claim window closed Oct 30. Approve the claim before, write it in after.' },
  'competing-amendments': { name: 'Approve one of two rival offers', line: 'Two offers move the same date. Approve one while the other is still open.' },
};

export function trialWords(scenario) {
  return TRIALS[scenario.id] || { name: scenario.name, line: scenario.description };
}

const CHECKS = {
  'Global accounting invariants hold': 'The book still adds up.',
  'Verified cents unchanged': 'Still $900 credited, and not a cent more.',
  'Memo contributes zero verified cents': 'The note alone counts for nothing.',
  'Invoice application verifies USD 2,000': 'With the invoice, the $2,000 counts.',
  'Original balance reopened': 'Back to $2,400 still owed.',
  'Stale state is visible': 'The decision shows as out of date.',
  'Renewal economics uses incremental cost': '$1,500 of credit less $2,400 of extra spending is $900 lost.',
  'Original promise unchanged': 'The original promise is untouched.',
  'No hindsight in earlier knowledge view': 'On Oct 20 the book did not know yet.',
  'Late knowledge changes retrospective interpretation': 'From Nov 5 the book knows, and dates it Oct 15.',
  'Ambiguity quarantined': 'The credit is held until someone says which promise it covers.',
  'Deadline state recalculated': 'The window shows as closed, and no new paper was needed.',
  'Pending branches conflict': 'The two offers are marked as rivals.',
  'Rejection retained without rewriting original': 'The declined offer stays on file.',
  'Chosen branch takes effect': 'Only the chosen offer takes effect.',
  'Scenario execution': 'The trial itself broke before it could finish.',
};
const REFUSAL = {
  INSUFFICIENT_CREDIT: 'that credit is already used up',
  VALIDATION: 'a credit note needs an invoice before it counts',
  STALE_APPROVAL: 'the paper changed after the approval',
  POLICY_BLOCKED: 'the house rules stop it',
  AMBIGUOUS: 'two promises share that reference',
  FORBIDDEN: 'that pen may not write this',
};

// The same "no" means something different in each trial: say which rule it was.
const REFUSAL_IN = {
  'deadline-drift': { POLICY_BLOCKED: 'its claim window has closed' },
  'competing-amendments': { POLICY_BLOCKED: 'the two offers still disagree' },
  'negative-renewal': { POLICY_BLOCKED: 'the house rules say no to a renewal like this' },
};
const refusal = (code, trialId) => REFUSAL_IN[trialId]?.[code] || REFUSAL[code];

/** One check of a trial, as a short typed line. { text, tech, passed } */
export function checkWords(check, trialId = '') {
  const expected = /^Expected ([A-Z_]+)$/.exec(check.name);
  if (expected) {
    const why = refusal(expected[1], trialId) || 'it is against the rules';
    return { passed: check.passed, tech: expected[1], text: check.passed ? `The ledger said no: ${why}.` : `The ledger should have said no (${why}) and let it through.` };
  }
  const said = CHECKS[check.name] || (/^Resolution restores unique/.test(check.name) ? 'With its invoice as proof, it goes back to the right promise.' : '');
  return { passed: check.passed, tech: '', text: said || `${check.name}. ${check.detail}` };
}

/** One step of a trial: what was tried, and what the ledger answered. { did, said, refused, tech } */
export function trialStep(step, trialId = '') {
  const c = step.command, amount = money(c.amountCents);
  const did = {
    ALLOCATE_CREDIT: `Match ${amount} of the credit to a promise.`,
    APPLY_CREDIT: 'Say the credit note is on an invoice.',
    ADD_SOURCE: `File a paper: ${c.source?.title || 'a paper'}.`,
    REVERSE_CREDIT: `Take back ${amount} of the credit.`,
    APPROVE_ACTION: 'Approve the decision.',
    REVISE_SOURCE: 'Replace a paper.',
    EXECUTE_ACTION: 'Write the decision in the book.',
    DISMISS_AMENDMENT: 'Decline an offer.',
    PROPOSE_AMENDMENT: 'File an offer.',
    PROPOSE_ACTION: 'Prepare a decision.',
    CREATE_COMMITMENT: 'Write in a second promise with the same reference.',
    RESOLVE_CREDIT: 'Say which promise the credit covers, with its invoice.',
  }[c.type] || `Send “${bare(c.type)}”.`;
  if (step.error) return { did, refused: true, said: `Refused: ${refusal(step.error.code, trialId) || String(step.error.message).replace(/\.$/, '')}.`, tech: step.error.code };
  return { did, refused: false, said: `Written in. The book is at entry ${step.revision}.`, tech: c.type };
}

/** The stamp a finished trial earns. A refusal is the pass; "Holds" is a pass where nothing needed refusing. */
export function trialStamp(result) {
  if (!result) return null;
  if (!result.passed) return { word: 'Got through', ink: 'red' };
  return result.steps.some(step => step.error) ? { word: 'Refused', ink: 'blue' } : { word: 'Holds', ink: 'blue' };
}

// ————————————————————————————————————————————————— permission slips

/** "3f9ac01b…": enough of a key or a number to tell two apart. */
export function short(value, keep = 8) {
  const text = String(value || '');
  return text.length > keep + 1 ? `${text.slice(0, keep)}…` : text;
}

/** "1:47" from milliseconds; "0:00" once it has run out. */
export function timeLeft(ms) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export const HANDS = ['first', 'second', 'third', 'fourth'];

/** What the hook reports when a step fails ("CODE: message"), said as a sentence. */
export function slipTrouble(text) {
  const raw = String(text || '').trim();
  if (!raw) return '';
  const hit = /^([A-Z_]{4,}):\s*(.*)$/s.exec(raw);
  const code = hit?.[1], rest = hit?.[2] ?? raw;
  if (code === 'SELECTION_CHANGED') return '';
  if (code === 'AUTHORITY_CONSUMED' || /revoked or consumed/.test(rest)) return 'The ledger refused. This slip was already used once, and once is all it is good for.';
  if (code === 'AUTHORITY_REVOKED') return 'The ledger refused. This slip was taken back.';
  if (code === 'AUTHORITY_EXPIRED' || /outside the grant window/.test(rest)) return 'The ledger refused. This slip has run out.';
  if (code === 'STALE_APPROVAL') return 'The ledger refused. The papers under this decision changed after it was approved.';
  if (code === 'POLICY_BLOCKED') return 'The ledger refused. The house rules stop this decision.';
  if (code === 'REVISION_CONFLICT' || /workspace changed|revision differs/i.test(rest)) return 'The book moved on while this was being written. Try again.';
  if (code === 'FORBIDDEN') return 'That takes an approver’s pen, or the owner’s.';
  if (code === 'AUTHORITY_COMMAND_REPLAY' || code === 'IDEMPOTENCY_CONFLICT') return 'The ledger refused. It has seen that very request before, with different contents.';
  if (code === 'ALREADY_EXECUTED') return 'That decision is already written in the book.';
  if (/only narrow authority/.test(rest)) return 'A slip handed on can only be narrower: the same limits or smaller, and no longer-lasting.';
  if (/cannot expand or alter/.test(rest)) return 'A slip handed on is for the same decision. Only its limits can shrink.';
  if (/exceed delegated limits/.test(rest)) return 'The ledger refused. The decision moves more than this slip allows.';
  if (/at most three child/.test(rest)) return 'Four hands is as far as one slip goes.';
  if (/lifetime of 15/.test(rest)) return 'A slip lasts between 15 and 600 seconds.';
  if (/nonnegative decimal amount/.test(rest)) return 'Type the limits as dollars, like 1,500 or 1,500.00.';
  if (/Enter an explicit incremental obligation/.test(rest)) return 'This is a renewal. Say how much extra spending the slip may bring.';
  if (/expired authority/.test(rest)) return 'That slip would have run out before it was written.';
  if (/approved current action is required|Select an approved action/.test(rest)) return 'A slip can only be written for an approved decision.';
  if (/source changed/i.test(rest)) return 'Someone else replaced that paper first. Read the book again.';
  if (/Supply changed source text/.test(rest)) return 'Change the paper’s text first.';
  if (/not available in browser examples/.test(rest)) return 'That decision is in your own book. The bench practises on a separate copy: pick a decision below.';
  if (/is unavailable in this workspace/.test(rest)) return 'That decision is not in this book any more. Pick another below.';
  if (/belongs to a different commitment/.test(rest)) return 'That decision belongs to another promise. Pick one below.';
  if (/Failed to fetch|NetworkError|Load failed/.test(rest)) return 'Couldn’t reach the server that keeps the book. Is it still running?';
  return rest;
}

/** What a failed check of the record says. */
export function recordTrouble(verification) {
  if (!verification || verification.valid) return '';
  const code = verification.code, reason = String(verification.reason || '');
  if (code === 'AUTHORITY_UNTRUSTED') return 'Nobody here has said they trust this signer. Trust the signer, then check again.';
  if (code === 'AUTHORITY_SIGNATURE') return 'A signature does not match what it signed. This record was changed after it was signed.';
  if (/Unexpected token|JSON/.test(reason)) return 'That JSON doesn’t parse. Paste the whole record as it was downloaded.';
  return `The record does not check out: ${reason}`;
}
