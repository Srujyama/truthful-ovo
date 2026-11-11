// Where you are in the book. The address is the part after the #, so the back
// button, a reload and a pasted link all land on the same page.
//
//   #/ious                      the book of IOUs (the front)
//   #/iou/<commitmentId>        one promise's account page   (?a=<actionId> opens that decision)
//   #/todo                      what needs a hand
//   #/papers                    every paper on file          (?kind=, ?company=)
//   #/papers/<sourceId>@<rev>   one paper, at one version
//   #/papers/credit:<creditId>  one credit note
//   #/companies                 the index
//   #/companies/<vendorId>      one company
//   #/daybook                   everything that happened, in order
//   #/balance                   the totals as of a date
//   #/tray                      the in-tray: drop papers in to be read
//   #/bench                     the test bench (for engineers)

import { useEffect, useState } from 'react';

export const PAGES = ['ious', 'iou', 'todo', 'papers', 'companies', 'daybook', 'balance', 'tray', 'bench'];

export function parseHash(hash) {
  const raw = String(hash || '').replace(/^#\/?/, '');
  const [path, search = ''] = raw.split('?');
  const [page = '', ...rest] = path.split('/');
  const query = Object.fromEntries(new URLSearchParams(search));
  const id = rest.length ? decodeURIComponent(rest.join('/')) : '';
  return { page: PAGES.includes(page) ? page : 'ious', id, query, raw };
}

/** href('iou', 'pipeline-seats', {a: 'action-1'}) → "#/iou/pipeline-seats?a=action-1" */
export function href(page, id = '', query = null) {
  const search = query ? new URLSearchParams(Object.entries(query).filter(([, v]) => v != null && v !== '')).toString() : '';
  return `#/${page}${id ? `/${encodeURIComponent(id).replace(/%40/g, '@').replace(/%3A/g, ':')}` : ''}${search ? `?${search}` : ''}`;
}

/** The address of one paper at one version. */
export const paperId = (sourceId, revision) => `${sourceId}@${revision}`;
export function readPaperId(id) {
  if (!id) return null;
  if (id.startsWith('credit:')) return { creditId: id.slice(7) };
  const at = id.lastIndexOf('@');
  return at > 0 ? { sourceId: id.slice(0, at), revision: Number(id.slice(at + 1)) } : { sourceId: id, revision: null };
}

export function useRoute() {
  const [route, setRoute] = useState(() => parseHash(location.hash));
  useEffect(() => {
    const read = () => setRoute(parseHash(location.hash));
    addEventListener('hashchange', read);
    return () => removeEventListener('hashchange', read);
  }, []);
  /** go('iou', id, {a}) moves there; go(..., {replace: true}) as a 4th argument does not add a step to Back. */
  function go(page, id = '', query = null, { replace = false } = {}) {
    const next = href(page, id, query);
    if (next === location.hash) return;
    if (replace) {
      history.replaceState(history.state, '', location.pathname + location.search + next);
      setRoute(parseHash(next));
    } else {
      location.hash = next;
    }
    scrollTo({ top: 0 });
  }
  return [route, go];
}
