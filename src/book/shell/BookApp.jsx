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
import { href, useRoute } from './route.mjs';
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
const SOUND_KEY = 'truthful.sounds';

export default function BookApp() {
  const service = useAssurance();
  const [route, go] = useRoute();
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
    const names = { ious: 'The book of IOUs', iou: 'An IOU', todo: 'To do', papers: 'Papers', companies: 'Companies', daybook: 'Day book', balance: 'Balance', tray: 'In-tray', bench: 'Test bench' };
    document.title = `${names[route.page]} · Truthful`;
  }, [route.page]);

  // A page is put in the drawer, not thrown away, when you turn to another: what you were typing is still there.
  // A different person or a different team gets a fresh desk.
  const scope = `${service.mode}:${service.session?.user?.id || 'demo'}:${service.session?.workspace?.id || service.workspace?.id || ''}`;
  const kept = useRef({ scope, routes: {} });
  if (kept.current.scope !== scope) kept.current = { scope, routes: {} };
  kept.current.routes[route.page] = route;

  const gate = gateFor(service);
  const managed = service.authMode === 'managed-password';

  return (
    <div className="bk" data-runtime={service.mode} data-page={route.page}>
      <header className="bk-top">
        <a className="bk-mark" href={href('ious')}>Truthful</a>
        <div className="bk-tools">
          <button type="button" className="bk-tool is-wide" aria-pressed={sounds} onClick={() => setSounds(on => !on)}>Paper sounds: {sounds ? 'on' : 'off'}</button>
          <button type="button" className="bk-tool" onClick={() => setFinding(true)} disabled={!view}>Find<kbd>/</kbd></button>
          <a className="bk-tool" href={href('tray')} aria-current={route.page === 'tray' ? 'page' : undefined} style={{ textDecoration: 'none' }}>In-tray</a>
          <Plate service={service} say={say} onReset={() => go('ious')} />
        </div>
      </header>

      <nav className="bk-tabs" aria-label="The book’s pages">
        {TABS.map(([page, label]) => (
          <a key={page} className="bk-tab" href={href(page)} aria-current={tabOf(route.page) === page ? 'page' : undefined}>
            {label}{page === 'todo' && waiting > 0 && <i aria-label={`${waiting} waiting`}>{waiting}</i>}
          </a>
        ))}
      </nav>

      <main>
        {gate || Object.entries(kept.current.routes).map(([page, last]) => {
          const Page = PAGES[page];
          const active = page === route.page;
          return (
            <div key={`${scope}:${page}`} hidden={!active} inert={!active ? true : undefined}>
              <PageGuard>
                <React.Suspense fallback={null}>
                  <Page service={service} view={view} route={active ? route : last} go={go} say={say} active={active} />
                </React.Suspense>
              </PageGuard>
            </div>
          );
        })}
      </main>

      <footer className="bk-foot">
        <span>{managed ? 'Your team’s book. Nothing is emailed or paid from here.' : 'This is a demo book. The vendors are made up and nothing gets emailed.'}</span>
        <span className="bk-actions">
          <a className="bk-link" href={href('bench')}>Test bench</a>
          <a className="bk-link" href="?view=team">The old screens</a>
        </span>
      </footer>

      {finding && view && <FindOver view={view} go={go} onClose={() => setFinding(false)} />}
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
