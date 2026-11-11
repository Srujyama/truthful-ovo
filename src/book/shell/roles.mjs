// Who may write what in the book, said the way a person would say it.
//
// The engine decides every write (src/assurance/core.mjs). This only explains,
// next to a button, why it will not press and who it is waiting for.

/** What each role is called on the page, and what it does. `executor` is the engine's word for the bookkeeper. */
export const ROLES = [
  { id: 'viewer', name: 'Reader', does: 'Reads the book. Changes nothing.' },
  { id: 'analyst', name: 'Analyst', does: 'Files papers and prepares decisions.' },
  { id: 'approver', name: 'Approver', does: 'Says yes or no to a prepared decision.' },
  { id: 'executor', name: 'Bookkeeper', does: 'Writes an approved decision into the book.' },
  { id: 'admin', name: 'Owner', does: 'May do all of it.' },
];

export function roleName(id) {
  return ROLES.find(r => r.id === id)?.name || 'Reader';
}

// Which roles may send each command, besides the owner. Kept in step with assurance-ui.mjs.
const WHO = {
  ADD_VENDOR: ['analyst'], ADD_SOURCE: ['analyst'], REVISE_SOURCE: ['analyst'],
  CREATE_COMMITMENT: ['analyst'], PROPOSE_AMENDMENT: ['analyst'],
  REGISTER_CREDIT: ['analyst'], APPLY_CREDIT: ['analyst'], ALLOCATE_CREDIT: ['analyst'], REVERSE_CREDIT: ['analyst'],
  RESOLVE_CREDIT: ['approver'], DISMISS_AMENDMENT: ['approver'],
  PROPOSE_ACTION: ['analyst', 'approver'], APPROVE_ACTION: ['approver'], EXECUTE_ACTION: ['executor'],
  SET_POLICY: [], RESET_WORKSPACE: [],
};

const article = word => (/^[aeiou]/i.test(word) ? 'an' : 'a');

/** May this role send this command? */
export function may(type, role) {
  return role === 'admin' || (WHO[type] || []).includes(role);
}

/** "an analyst or an approver": who a blocked thing is waiting for. */
export function waitsFor(type) {
  const names = (WHO[type] || []).map(roleName);
  if (!names.length) return 'the owner';
  return names.map(n => `${article(n)} ${n.toLowerCase()}`).join(' or ');
}

/**
 * Why a write will not go through right now, or '' when it will.
 *   whyNot('APPROVE_ACTION', service)                    → "Waiting for an approver. You are signed in as analyst."
 *   whyNot(['ADD_SOURCE', 'REGISTER_CREDIT'], service)   → the first reason across a batch
 *   whyNot(type, service, { past: true })                → "You have turned the book back. Come back to today to change it."
 */
export function whyNot(type, service, { past = false } = {}) {
  if (past) return 'You have turned the book back. Come back to today to change it.';
  const role = service?.actor?.role || 'viewer';
  const types = Array.isArray(type) ? type : [type];
  const blocked = types.find(t => !may(t, role));
  if (blocked) return `Waiting for ${waitsFor(blocked)}. You are signed in as ${roleName(role).toLowerCase()}.`;
  if (service?.busy) return 'One second, the last entry is still going in.';
  return '';
}

/** The engine's error, as a sentence. service.error looks like "CODE: message". */
export function plainError(error) {
  const text = String(error?.message || error || '').trim();
  if (!text) return '';
  const hit = /^([A-Z_]+):\s*(.*)$/s.exec(text);
  const code = hit?.[1], rest = hit?.[2] || text;
  if (code === 'FORBIDDEN') return `That is not yours to do. ${rest}`;
  if (code === 'STALE_APPROVAL') return 'The papers changed after this was approved. Refresh the decision and approve it again.';
  if (code === 'STALE_REVISION' || code === 'REVISION_CONFLICT') return 'Someone else wrote in the book first. It has been reloaded; try again.';
  if (code === 'POLICY_BLOCKED') return `The house rules stop this. ${rest}`;
  if (code === 'ALREADY_EXECUTED') return 'That is already in the book.';
  if (code === 'INSUFFICIENT_CREDIT') return `There is not that much credit left on the note. ${rest}`;
  if (code === 'NOT_FOUND') return `Could not find that. ${rest}`;
  return rest;
}
