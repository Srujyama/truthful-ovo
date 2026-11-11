// The book. One desk, one set of index tabs, and a page under them.
//
// Every page gets the same props:
//   service   the one useAssurance() for the whole app (state, commands, who is signed in)
//   view      evaluateWorkspace(service.workspace) as of today; null until the book has loaded
//   route     { page, id, query } for this page (see route.mjs)
//   go        go(page, id?, query?) to move; href(page, id?, query?) from route.mjs for a real link
//   say       say('Posted.') puts a slip on the desk; say(text, { wrong: true }) for a failure
//   active    false while the page is kept in the drawer (mounted but hidden, so half-written forms survive)

import React, { useEffect, useMemo, useRef, useState } from 'react';
import '@fontsource-variable/besley/wght.css';
import '@fontsource-variable/besley/wght-italic.css';
import '@fontsource-variable/libre-franklin/wght.css';
import '@fontsource/courier-prime/400.css';
import '@fontsource/courier-prime/700.css';
import '../kit/paper.css';
import './book.css';
import useAssurance from '../../useAssurance.js';
import { evaluateWorkspace } from '../../assurance/index.mjs';
import { operationQueue } from '../../operations.mjs';
import { sound } from '../kit/paper.js';
import { Btn, Empty, Sheet, SheetHead, useToast } from './parts.jsx';
import { addPages, href, useRoute } from './route.mjs';
import { plainError } from './roles.mjs';
import { today } from './money.mjs';
import Plate from './Plate.jsx';
import FindOver from './Find.jsx';

// Each page is loaded on its own, so a page that fails to load or throws takes
// only itself down: the tabs and every other page keep working.
const PAGES = {
  ious: React.lazy(() => import('../pages/Ious.jsx')),
  iou: React.lazy(() => import('../pages/Account.jsx')),
  todo: React.lazy(() => import('../pages/ToDo.jsx')),
  papers: React.lazy(() => import('../pages/Papers.jsx')),
  companies: React.lazy(() => import('../pages/Companies.jsx')),
  daybook: React.lazy(() => import('../pages/DayBook.jsx')),
  balance: React.lazy(() => import('../pages/Balance.jsx')),
  tray: React.lazy(() => import('../pages/Tray.jsx')),
  bench: React.lazy(() => import('../pages/Bench.jsx')),
};

// The front page (the book of IOUs with its slips and its tray) is built in
// src/book/front. When that folder is here it is the IOUs page, and it takes
// this shell's tabs and tools into its own layout; until then, and if it ever
// fails to load, the plain list in ../pages/Ious.jsx stands in.
const frontFiles = import.meta.glob('../front/BookFront.jsx');
const BookFront = frontFiles['../front/BookFront.jsx'] ? React.lazy(frontFiles['../front/BookFront.jsx']) : null;

// The house (src/book/house, when it is in the tree) can add three things to the book without
// touching a page. Its index.js default-exports any of:
//   Home({ service, view, go, say })                     the book's cover, shown at "#/"
//   Station({ page, id, service, view, route, go })      a picture for the page you are on, drawn above its sheet
//   pages: [{ page, label, load: () => import(…) }]      more pages; each gets the props every page gets
// None of it is needed: with no house the book is exactly as it is.
const houseFiles = import.meta.glob('../house/index.js');
const loadHouse = houseFiles['../house/index.js'] || null;

class FrontGuard extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFail?.(); }
  render() { return this.state.failed ? null : this.props.children; }
}

class PageGuard extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <Sheet>
        <SheetHead title="This page tore." lede="The rest of the book is fine. Reload to try this page again." date={false} />
        <div className="bk-part">
          <Btn onClick={() => location.reload()}>Reload</Btn>
          <pre className="bk-typed bk-muted" style={{ marginTop: 14, whiteSpace: 'pre-wrap', fontSize: 13 }}>{String(this.state.error?.message || this.state.error)}</pre>
        </div>
      </Sheet>
    );
  }
}

// The tabs along the top of the page. `iou` (one account) lives behind the IOUs tab.
const TABS = [
  ['ious', 'IOUs'],
  ['todo', 'To do'],
  ['papers', 'Papers'],
  ['companies', 'Companies'],
  ['daybook', 'Day book'],
  ['balance', 'Balance'],
];
const tabOf = page => (page === 'iou' ? 'ious' : page);
const SOUND_KEY = 'truthful.sound';   // the same key the front page keeps its own switch in

export default function BookApp() {
  const service = useAssurance();
  const [route, go] = useRoute();
  // the house, if there is one
  const [house, setHouse] = useState(null);
  const morePages = useRef({});
  useEffect(() => {
    if (!loadHouse) return;
    let live = true;
    loadHouse().then(mod => {
      if (!live) return;
      const found = mod.default || mod;
      for (const extra of found.pages || []) morePages.current[extra.page] = React.lazy(extra.load);
      setHouse(found);
      addPages((found.pages || []).map(extra => extra.page));
    }).catch(() => { /* a house that will not load is no house: the book stands as it is */ });
    return () => { live = false; };
  }, []);
  // "#/" is the cover when the house has drawn one; otherwise it is the IOUs.
  const here = route.page === 'home' && !house?.Home ? { ...route, page: 'ious' } : route;

  const [toast, say] = useToast();
  const [finding, setFinding] = useState(false);
  const [sounds, setSounds] = useState(() => { try { return localStorage.getItem(SOUND_KEY) !== 'off'; } catch { return true; } });

  const view = useMemo(
    () => (service.workspace ? evaluateWorkspace(service.workspace, { asOf: today(), knownAt: new Date().toISOString() }) : null),
    [service.workspace],
  );
  const waiting = useMemo(() => (view ? operationQueue(view, {}).filter(row => row.category !== 'scheduled').length : 0), [view]);

  // Paper makes a sound when it lands. A browser only lets that start after a press.
  useEffect(() => {
    sound.setEnabled(sounds);
    try { localStorage.setItem(SOUND_KEY, sounds ? 'on' : 'off'); } catch { /* a private window: the choice lasts for this visit */ }
  }, [sounds]);
  // The front page has its own switch for the same sounds; pick up whatever it was left at.
  useEffect(() => { setSounds(sound.enabled); }, [here.page]);
  useEffect(() => {
    const unlock = () => sound.unlock();
    addEventListener('pointerdown', unlock, { once: true });
    return () => removeEventListener('pointerdown', unlock);
  }, []);

  // ?pen=approver opens the demo book already holding that pen, so a page can be looked at as any role.
  const penAsked = useRef(new URLSearchParams(location.search).get('pen'));
  useEffect(() => {
    const pen = penAsked.current;
    const demo = service.authMode === 'local-demo' || service.authMode === 'browser-local';
    if (!pen || !demo || !service.workspace || service.busy) return;
    penAsked.current = null;
    if (pen !== service.actor.role) service.changeRole(pen).catch(() => {});
  }, [service.authMode, service.workspace, service.busy, service.actor.role]);

  // "/" opens Find from anywhere you are not typing.
  useEffect(() => {
    const onKey = event => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable) return;
      event.preventDefault();
      setFinding(true);
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const names = { home: 'Truthful', ious: 'The book of IOUs', iou: 'An IOU', todo: 'To do', papers: 'Papers', companies: 'Companies', daybook: 'Day book', balance: 'Balance', tray: 'In-tray', bench: 'Test bench' };
    const name = names[here.page] || house?.pages?.find(extra => extra.page === here.page)?.label || 'Truthful';
    document.title = name === 'Truthful' ? name : `${name} · Truthful`;
  }, [here.page, house]);

  // A page is put in the drawer, not thrown away, when you turn to another: what you were typing is still there.
  // A different person or a different team gets a fresh desk.
  const scope = `${service.mode}:${service.session?.user?.id || 'demo'}:${service.session?.workspace?.id || service.workspace?.id || ''}`;
  const kept = useRef({ scope, routes: {} });
  if (kept.current.scope !== scope) kept.current = { scope, routes: {} };
  kept.current.routes[here.page] = here;

  const gate = gateFor(service);
  const [frontFailed, setFrontFailed] = useState(false);
  const frontSeen = useRef(false);
  if (here.page === 'ious') frontSeen.current = true;
  const managed = service.authMode === 'managed-password';

  // On the front page the tools sit in the front's own top bar, which already has its sound switch and its in-tray.
  const tools = slotted => (
    <div className={slotted ? 'bk-tools is-slotted' : 'bk-tools'}>
      {!slotted && <button type="button" className="bk-tool is-wide" aria-pressed={sounds} onClick={() => setSounds(on => !on)}>Paper sounds: {sounds ? 'on' : 'off'}</button>}
      <button type="button" className="bk-tool" onClick={() => setFinding(true)} disabled={!view}>Find<kbd>/</kbd></button>
      {!slotted && <a className="bk-tool" href={href('tray')} aria-current={here.page === 'tray' ? 'page' : undefined} style={{ textDecoration: 'none' }}>In-tray</a>}
      <Plate service={service} say={say} onReset={() => go('ious')} />
    </div>
  );
  const tabs = slotted => (
    <nav className={slotted ? 'bk-tabs is-slotted' : 'bk-tabs'} aria-label="The book’s pages">
      {TABS.map(([page, label]) => (
        <a key={page} className="bk-tab" href={href(page)} aria-current={tabOf(here.page) === page ? 'page' : undefined}>
          {label}{page === 'todo' && waiting > 0 && <i aria-label={`${waiting} waiting`}>{waiting}</i>}
        </a>
      ))}
    </nav>
  );
  const onFront = here.page === 'ious' && BookFront && !frontFailed && !gate;
  // The house's picture for this page. With stationAbove it stands behind the book, above the tabs;
  // otherwise it sits between the tabs and the sheet. If it throws, the page is simply without one.
  const station = house?.Station && !gate && !onFront && here.page !== 'home' && (
    <FrontGuard key={`station:${here.page}`}>
      <div className="bk-station"><house.Station page={here.page} id={here.id} service={service} view={view} route={here} go={go} /></div>
    </FrontGuard>
  );
  const foot = (
    <footer className="bk-foot">
      <span>{onFront ? '' : managed ? 'Your team’s book. Nothing is emailed or paid from here.' : 'This is a demo book. The vendors are made up and nothing gets emailed.'}</span>
      <span className="bk-actions">
        <a className="bk-link" href={href('bench')}>Test bench</a>
        <a className="bk-link" href="?view=team">The old screens</a>
      </span>
    </footer>
  );

  return (
    <div className="bk" data-runtime={service.mode} data-page={here.page} data-front={onFront ? '' : undefined}>
      {/* The front page brings its own desk top; the shell's tabs and tools go into its slots. */}
      {BookFront && !frontFailed && !gate && (
        <div hidden={!onFront} inert={!onFront ? true : undefined}>
          {(onFront || frontSeen.current) && (
            <FrontGuard onFail={() => setFrontFailed(true)}>
              <React.Suspense fallback={null}>
                <BookFront service={service} onOpenCase={id => go('iou', id)} onGo={page => go(page)} tabs={tabs(true)} tools={tools(true)} />
              </React.Suspense>
            </FrontGuard>
          )}
        </div>
      )}

      {!onFront && (
        <header className="bk-top">
          <a className="bk-mark" href={href('ious')}>Truthful</a>
          {tools(false)}
        </header>
      )}
      {house?.stationAbove && station}
      {!onFront && tabs(false)}

      <main hidden={onFront}>
        {/* the house's picture for this page, above its sheet; if it fails, the page is simply without one */}
        {!house?.stationAbove && station}
        {/* the cover */}
        {house?.Home && !gate && here.page === 'home' && (
          <PageGuard><house.Home service={service} view={view} go={go} say={say} /></PageGuard>
        )}
        {gate || Object.entries(kept.current.routes).map(([page, last]) => {
          if (page === 'ious' && BookFront && !frontFailed) return null;
          if (page === 'home') return null;
          const Page = PAGES[page] || morePages.current[page];
          if (!Page) return null;
          const active = page === here.page;
          return (
            <div key={`${scope}:${page}`} hidden={!active} inert={!active ? true : undefined}>
              <PageGuard>
                <React.Suspense fallback={null}>
                  <Page service={service} view={view} route={active ? here : last} go={go} say={say} active={active} />
                </React.Suspense>
              </PageGuard>
            </div>
          );
        })}
      </main>

      {foot}
      {finding && view && <FindOver view={view} go={go} more={house?.pages} onClose={() => setFinding(false)} />}
      {toast}
    </div>
  );
}

/** What stands in for the page while the book cannot be read: loading, unreachable, or not signed in. */
function gateFor(service) {
  if (service.authMode === 'detecting' || service.mode === 'connecting' || (service.authMode === 'managed-password' && service.authStatus === 'checking')) {
    return <Sheet><SheetHead title="Opening the book…" date={false} /><Empty>One second.</Empty></Sheet>;
  }
  if (service.authMode === 'service-error' || service.authStatus === 'error') {
    return (
      <Sheet>
        <SheetHead title="The book won’t open." lede={plainError(service.error) || 'Couldn’t reach the server that keeps it. Is it still running?'} date={false} />
        <div className="bk-part"><Btn onClick={() => service.refreshSession()} busy={service.busy ? 'Trying…' : ''}>Try again</Btn></div>
      </Sheet>
    );
  }
  if (service.authMode === 'managed-password' && !service.workspace) {
    const signedIn = Boolean(service.session?.user);
    return (
      <Sheet>
        <SheetHead
          title={signedIn ? 'You’re not on a team yet.' : 'This book belongs to a team.'}
          lede={signedIn ? 'Ask an admin to invite you, or start a team book of your own from the name plate, top right.' : 'Sign in from the name plate, top right, or join with an invitation code.'}
          date={false}
        />
      </Sheet>
    );
  }
  return null;
}
