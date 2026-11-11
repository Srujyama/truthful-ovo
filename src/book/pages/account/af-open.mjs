// Which of the account page's forms is out on the sheet.
//
// The credit slips and the row of typed links at the foot of the sheet are two
// separate components, mounted side by side by ../Account.jsx. Only one form may
// be out at a time across both, so the one that is out is kept here, outside
// either of them, and both read it with useOpenForm().
//
//   const [open, show, close] = useOpenForm(commitment.id);
//   show({ kind: 'credit', job: 'register' })              the foot row's "Write in a credit"
//   show({ kind: 'credit', job: 'apply', creditId })       a slip's own link (apply | allocate | reverse)
//   show({ kind: 'sort', creditId, step })                 a note that could belong to two promises
//   show({ kind: 'terms' }) · show({ kind: 'copy' })       the other two links in the foot row
//   close()                                                puts it away; the link that opened it gets the focus back
//
// `open` is null on every promise but the one the form was opened on.

import { useSyncExternalStore } from 'react';

let state = { promise: '', form: null, opener: null };
const listeners = new Set();

function set(next) {
  state = next;
  for (const listener of listeners) listener();
}
function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
const read = () => state;

const same = (a, b) => Boolean(a && b) && a.kind === b.kind && a.job === b.job && a.creditId === b.creditId && a.step === b.step;

export function useOpenForm(promiseId) {
  const now = useSyncExternalStore(subscribe, read, read);
  const open = now.promise === promiseId ? now.form : null;

  /** Bring a form out. Asking for the one that is already out puts it away again. */
  function show(form) {
    if (same(open, form)) { close(); return; }
    const pressed = typeof document === 'undefined' ? null : document.activeElement;
    set({ promise: promiseId, form, opener: pressed && pressed !== document.body ? pressed : null });
  }
  /** Put it away. `refocus: false` when the page is about to move somewhere else. */
  function close({ refocus = true } = {}) {
    const opener = state.opener;
    set({ promise: '', form: null, opener: null });
    if (refocus && opener && opener.isConnected) requestAnimationFrame(() => { if (opener.isConnected && !opener.disabled) opener.focus({ preventScroll: true }); });
  }
  return [open, show, close];
}
