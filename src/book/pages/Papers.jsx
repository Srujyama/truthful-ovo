// Papers: every paper on file. The headline is how many; under it every paper is one
// small mark, grouped by what it is, then the same papers as a list.
//
//   #/papers                              the drawer  (?kind= ?company= ?q= ?copies=all ?by=YYYY-MM-DD)
//   #/papers/pipeline-promise@6           one paper at one copy; no @ → the newest copy
//   #/papers/credit:credit-nimbus-2000    one credit note
//
// The drawer's filters live in the address, so a filtered drawer can be linked to,
// reloaded, and come back to with "← All papers". The pure parts (what each kind is
// called, what lies in the drawer, which passages get the highlighter) are in
// ./papers/kinds.mjs; one paper is ./papers/Reading.jsx; a credit note is
// ./papers/CreditNote.jsx; a paper as a list row is ./papers/Thumb.jsx; the figure is ./papers/Figure.jsx.

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { evaluateWorkspace } from '../../assurance/index.mjs';
import { Btn, Empty, Filters, Find, Sheet, SheetHead } from '../shell/parts.jsx';
import { href, readPaperId } from '../shell/route.mjs';
import { shortDay, today } from '../shell/money.mjs';
import { companyCounts, drawerPapers, filterCounts, GROUPS, groupFor, nothingFound } from './papers/kinds.mjs';
import { PaperList, PaperMark, markItem } from './papers/Thumb.jsx';
import { PaperFigure } from './papers/Figure.jsx';
import Reading from './papers/Reading.jsx';
import CreditNote from './papers/CreditNote.jsx';
import './papers.css';

const PAGE = 30;                       // how many papers are laid out before "Earlier papers"
const isDay = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
/** Today on the reader's own calendar, the same day the dater stamp in the corner shows. */
function calendarDay() {
  const at = new Date();
  return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;
}

/** The drawer's filters, read from the address. Anything that makes no sense is no filter. */
function readFilters(query, view) {
  return {
    group: groupFor(query.kind),
    company: view.vendors.some(vendor => vendor.id === query.company) ? query.company : '',
    q: query.q || '',
    copies: query.copies === 'all',
    by: isDay(query.by) && query.by < calendarDay() ? query.by : '',
  };
}
const writeFilters = f => ({ kind: f.group, company: f.company, q: f.q, copies: f.copies ? 'all' : '', by: f.by });

// The drawer as the reader left it (its filters, how far down they were) is kept for the visit,
// so "← All papers" finds the same drawer even after a reload on a paper's own address.
const KEPT = 'truthful.papers.drawer';
function recall() {
  try {
    const kept = JSON.parse(sessionStorage.getItem(KEPT) || 'null');
    return { query: kept?.query && typeof kept.query === 'object' ? kept.query : {}, top: Number(kept?.top) || 0 };
  } catch { return { query: {}, top: 0 }; }
}
function keep(drawer) {
  try { sessionStorage.setItem(KEPT, JSON.stringify(drawer)); } catch { /* a private window: it lasts until the page is closed */ }
}

export default function Papers({ service, view, route, go, say, active }) {
  const target = readPaperId(route.id);
  const drawer = useRef(null);         // { query, top }: the drawer's filters and place, for the way back
  if (!drawer.current) drawer.current = recall();
  const last = useRef(route.id);
  const here = useRef(route.id);       // what is open right now, for listeners that outlive a render
  const root = useRef(null);
  here.current = route.id;
  if (!route.id) drawer.current.query = route.query;
  const back = href('papers', '', drawer.current.query);

  useEffect(() => {
    if (!active || route.id) return undefined;
    keep(drawer.current);
    const note = () => { if (!here.current) drawer.current.top = scrollY; };
    addEventListener('scroll', note, { passive: true });
    return () => { removeEventListener('scroll', note); keep(drawer.current); };
  }, [active, route.id, route.raw]);

  // Escape puts the paper back in the drawer, unless a dialog or a menu is open and wants the key.
  useEffect(() => {
    if (!active || !route.id) return undefined;
    const onKey = event => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if (document.querySelector('.bk-over, [aria-expanded="true"]')) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)) return;
      location.hash = back;
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [active, route.id, back]);

  // Opening a paper starts at its top; putting it back returns to the same place in the drawer,
  // with the paper you had out under your hand. Turning to another copy of the same paper stays put.
  useLayoutEffect(() => {
    if (!active || last.current === route.id) return;
    const was = last.current;
    last.current = route.id;
    if (!route.id) {
      scrollTo({ top: drawer.current.top });
      const home = readPaperId(was);
      const thumb = [...(root.current?.querySelectorAll('[data-paper]') || [])]
        .find(node => node.dataset.paper === was || (home?.sourceId && node.dataset.paper.startsWith(`${home.sourceId}@`)));
      thumb?.focus({ preventScroll: true });
    } else if (!was || readPaperId(was)?.sourceId !== target?.sourceId || target?.creditId) {
      scrollTo({ top: 0 });
    }
  }, [route.id, active]);

  if (!view) return null;
  return (
    <div ref={root}>
      {target?.creditId != null
        ? <CreditNote view={view} creditId={target.creditId} back={back} />
        : target
          ? <Reading view={view} target={target} back={back} say={say} />
          : <Drawer service={service} view={view} route={route} go={go} />}
    </div>
  );
}

const papersWord = n => `${n} ${n === 1 ? 'paper' : 'papers'}`;

/** The figure's groups: by kind, or by company once one kind is picked (then kind says nothing). */
function figureGroups(view, items, byCompany) {
  const groups = byCompany
    ? [...new Set(items.map(item => item.vendorId))]
      .map(id => ({ key: `co:${id}`, label: items.find(item => item.vendorId === id).company }))
      .sort((a, b) => a.label.localeCompare(b.label))
    : GROUPS.map(group => ({ key: group.id, label: group.label }));
  return groups
    .map(group => ({ ...group, items: items.filter(item => (byCompany ? `co:${item.vendorId}` : item.group) === group.key).map(item => markItem(view, item)) }))
    .filter(group => group.items.length);
}

function Drawer({ service, view, route, go }) {
  const filters = readFilters(route.query, view);
  const [most, setMost] = useState(PAGE);
  const set = patch => { setMost(PAGE); go('papers', '', writeFilters({ ...filters, ...patch }), { replace: true }); };

  // "Papers received by" turns the drawer back: only what had come in by the end of that day.
  const then = useMemo(() => {
    if (!filters.by || !service.workspace) return view;
    try { return evaluateWorkspace(service.workspace, { asOf: today(), knownAt: `${filters.by}T23:59:59.999Z` }); } catch { return view; }
  }, [service.workspace, view, filters.by]);

  const onFile = useMemo(() => drawerPapers(then).length, [then]);
  const all = useMemo(() => drawerPapers(then, { query: filters.q, versions: filters.copies ? 'all' : 'current' }), [then, filters.q, filters.copies]);
  const ofCompany = all.filter(item => !filters.company || item.vendorId === filters.company);
  const ofGroup = all.filter(item => !filters.group || item.group === filters.group);
  const items = ofCompany.filter(item => !filters.group || item.group === filters.group);

  // A filter that is on stays on the page even when it holds nothing, so it can be taken off.
  const kinds = filterCounts(ofCompany);
  if (filters.group && !kinds.some(kind => kind.id === filters.group)) kinds.push({ id: filters.group, label: GROUPS.find(group => group.id === filters.group).label, count: 0 });
  const companies = companyCounts(then, ofGroup);
  const companyName = view.vendors.find(vendor => vendor.id === filters.company)?.name || '';
  if (filters.company && !companies.some(company => company.id === filters.company)) companies.push({ id: filters.company, label: companyName, count: 0 });

  const groups = figureGroups(then, items, Boolean(filters.group));
  const inks = new Set(groups.flatMap(group => group.items.map(item => item.ink)));
  const figureSaid = `${papersWord(items.length)}: ${groups.map(group => `${group.items.length} ${group.label.toLowerCase()}`).join(', ')}`;

  const nothingOnFile = !view.sourceVersions.length && !view.credits.length;
  return (
    <Sheet className="bk-pap-index">
      <SheetHead
        kicker="Papers"
        title={filters.by ? <>{papersWord(onFile)} had come in <i>by {shortDay(filters.by)}.</i></> : `${papersWord(onFile)} on file.`}
        lede="Each email, invoice and credit note a company sent, kept word for word."
      />
      {nothingOnFile ? (
        <Empty then={<>Drop the first one in the <a className="bk-link" href={href('tray')}>in-tray</a>.</>}>No papers on file yet.</Empty>
      ) : (
        <>
          <div className="bk-part bk-pap-sort">
            <div className="bk-pap-line">
              <span className="bk-label">show</span>
              <Filters label="Show" items={kinds} value={filters.group || 'all'} onChange={id => set({ group: id === 'all' ? '' : id })} />
            </div>
            <div className="bk-pap-line">
              <span className="bk-label">from</span>
              <Filters label="From" items={companies} value={filters.company || 'all'} onChange={id => set({ company: id === 'all' ? '' : id })} />
            </div>
          </div>

          {items.length > 0 && (
            <div className="bk-part bk-pap-figure">
              <PaperFigure groups={groups} label={figureSaid} />
              {(inks.has('waiting') || inks.has('offer') || inks.has('old')) && (
                <p className="bk-pap-key">
                  {inks.has('waiting') && <span><PaperMark mark="credit" ink="waiting" /> a credit note not on an invoice yet</span>}
                  {inks.has('offer') && <span><PaperMark mark="offer" ink="offer" /> an offer: yours only if you agree</span>}
                  {inks.has('old') && <span><PaperMark mark="letter" ink="old" /> an older copy, since replaced</span>}
                </p>
              )}
            </div>
          )}

          <div className="bk-part bk-pap-tools">
            <Find value={filters.q} onChange={q => set({ q })} placeholder="a company, a number, a word" />
            <label className="bk-check">
              <input type="checkbox" checked={filters.copies} onChange={event => set({ copies: event.target.checked })} />
              Older copies too
            </label>
            <label className="bk-pap-by">
              <span>received by</span>
              <input
                type="date"
                max={calendarDay()}
                value={filters.by || calendarDay()}
                onChange={event => set({ by: isDay(event.target.value) && event.target.value < calendarDay() ? event.target.value : '' })}
              />
            </label>
            {filters.by && <button type="button" className="bk-link" onClick={() => set({ by: '' })}>Back to today</button>}
            <span className="bk-pap-count">{papersWord(items.length)}</span>
          </div>

          {!items.length ? (
            <Empty then={<button type="button" className="bk-link" onClick={() => { setMost(PAGE); go('papers', '', null, { replace: true }); }}>Show every paper</button>}>
              {nothingFound({ group: filters.group, company: companyName, query: filters.q, by: filters.by })}
            </Empty>
          ) : (
            <>
              <PaperList view={then} items={items.slice(0, most)} label="Papers, newest first" />
              {items.length > most && (
                <div className="bk-part bk-pap-more">
                  <Btn quiet onClick={() => setMost(n => n + PAGE)}>Earlier papers</Btn>
                  <span className="bk-why">{items.length - most} more on file</span>
                </div>
              )}
            </>
          )}
        </>
      )}
    </Sheet>
  );
}
