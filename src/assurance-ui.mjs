import { simulateAction } from './assurance/index.mjs';

// Keep these affordances aligned with core.mjs; the reducer authorizes every write.
const commandRoles = {
  ADD_VENDOR: ['analyst'], ADD_SOURCE: ['analyst'], REVISE_SOURCE: ['analyst'],
  CREATE_COMMITMENT: ['analyst'], PROPOSE_AMENDMENT: ['analyst'],
  REGISTER_CREDIT: ['analyst'], APPLY_CREDIT: ['analyst'], ALLOCATE_CREDIT: ['analyst'], REVERSE_CREDIT: ['analyst'],
  RESOLVE_CREDIT: ['approver'], DISMISS_AMENDMENT: ['approver'],
  PROPOSE_ACTION: ['analyst', 'approver'], APPROVE_ACTION: ['approver'], EXECUTE_ACTION: ['executor'],
  SET_POLICY: [], RESET_WORKSPACE: [],
};

export function mutationReason(type, actorRole, { readOnly = false, busy = false } = {}) {
  if (readOnly) return 'Historical view is read only. Return to latest records to make changes.';
  const roles = Object.hasOwn(commandRoles, type) ? commandRoles[type] : null;
  if (!roles) return 'Choose a supported command before recording a change.';
  if (actorRole !== 'admin' && !roles.includes(actorRole)) {
    return `Requires ${[...roles, 'admin'].join(' or ')} role. Current role: ${actorRole || 'unknown'}.`;
  }
  return busy ? 'Wait for the current operation to finish.' : '';
}

export function batchMutationReason(commands, actorRole, options) {
  if (!Array.isArray(commands) || !commands.length) return 'Provide at least one supported command.';
  return commands.map(command => mutationReason(command?.type, actorRole, options)).find(Boolean) || '';
}

export function resolveEvidenceNode(view, selection) {
  const id = typeof selection === 'string' ? selection : selection?.id;
  return view.graph.nodes.find(node => node.id === id) || null;
}

export function selectDecisionAction(view, { selectedActionId, commitmentId } = {}) {
  const actions = view.actions.filter(action => view.commitments.some(c => c.id === action.commitmentId));
  if (selectedActionId) return actions.find(action => action.id === selectedActionId) || null;
  // An explicit case must never silently open another vendor's action.
  if (commitmentId) return actions.findLast(action => action.commitmentId === commitmentId) || null;
  return actions[0] || null;
}

export function originalActionSpec(view, commitment) {
  if (!commitment) return null;
  const pendingTerms = view.amendments.some(a => a.commitmentId === commitment.id && !a.accepted && !a.rejected);
  return { commitmentId: commitment.id, type: pendingTerms ? 'preserve_original' : 'prepare_claim', payload: {} };
}

export function originalReviewState(workspace, view, commitment) {
  const specification = originalActionSpec(view, commitment);
  if (!specification) return { specification: null, action: null, simulation: null };
  const originalActions = view.actions.filter(action => action.commitmentId === commitment.id && action.type !== 'accept_amendment');
  const action = originalActions.findLast(action => !action.executed && !action.proposalStale && !action.approvalStale)
    || originalActions.findLast(action => !action.executed)
    || originalActions.findLast(action => action.executed) || null;
  const simulation = simulateAction(workspace, specification, { asOf: view.asOf, knownAt: view.knownAt });
  return { specification, action, simulation };
}
