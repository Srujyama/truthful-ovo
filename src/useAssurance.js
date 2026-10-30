import { useEffect, useRef, useState } from 'react';
import { createDemoWorkspace, evaluateWorkspace, reduceWorkspace, validateWorkspace } from './assurance/index.mjs';

const KEY = 'truthful.assurance.v1';
const apiBase = `${import.meta.env.BASE_URL}api`;
const browserActor = role => ({ id: `browser-demo-${role}`, role, name: `Demo ${role}` });

function loadBrowser() {
  const raw = localStorage.getItem(KEY);
  if (!raw) return createDemoWorkspace();
  const parsed = JSON.parse(raw);
  const checked = validateWorkspace(parsed);
  if (!checked.valid) throw new Error(`Saved workspace failed validation: ${checked.violations.join(' ')}`);
  return parsed;
}

export default function useAssurance() {
  const [workspace, setWorkspace] = useState(null);
  const [mode, setMode] = useState('connecting');
  const [actor, setActor] = useState(browserActor('admin'));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [integrity, setIntegrity] = useState(null);
  const [selectedId, setSelectedId] = useState('pipeline-seats');
  const current = useRef({ workspace:null, mode:'connecting', revision:0, csrfToken:null, actor:browserActor('admin') });
  const operation = useRef(0);

  function adopt(next, options = {}) {
    current.current = { ...current.current, ...options, workspace:next };
    setWorkspace(next);
    if (options.mode) setMode(options.mode);
    if (options.actor) setActor(options.actor);
    if (options.integrity) setIntegrity(options.integrity);
  }

  async function request(path, options = {}) {
    const response = await fetch(`${apiBase}${path}`, {
      credentials:'same-origin', ...options,
      headers:{ 'Content-Type':'application/json', ...(current.current.csrfToken ? {'X-CSRF-Token':current.current.csrfToken} : {}), ...options.headers },
    });
    if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('The local service did not return a valid response.');
    const body = await response.json();
    if (!response.ok) {
      const detail = body.error?.message || body.message || `Request failed (${response.status}).`;
      const e = new Error(detail); e.code = body.error?.code || body.code; e.details = body.error?.details;
      throw e;
    }
    return body;
  }

  function useBrowser(message = '') {
    let next;
    try { next = loadBrowser(); }
    catch (e) { next = createDemoWorkspace(); setError(`${e.message} A fresh demo is open; the unreadable saved copy has not been overwritten.`); }
    adopt(next,{mode:'browser',actor:browserActor('admin'),revision:next.revision,csrfToken:null,integrity:validateWorkspace(next)});
    if (message) setError(message);
  }

  useEffect(() => {
    const controller = new AbortController();
    const ticket = ++operation.current;
    const timeout = setTimeout(() => controller.abort(),2000);
    (async () => {
      if(!import.meta.env.DEV && new URLSearchParams(location.search).get('service') !== 'local') {
        useBrowser(); clearTimeout(timeout); return;
      }
      try {
        const health = await fetch(`${apiBase}/health`,{signal:controller.signal});
        if (!health.ok || !health.headers.get('content-type')?.includes('application/json')) {
          if(ticket === operation.current) useBrowser();
          return;
        }
        let session = await request('/session',{signal:controller.signal});
        if (!session.actor) session = await request('/session',{method:'POST',body:JSON.stringify({role:'admin'}),signal:controller.signal});
        if(ticket !== operation.current) return;
        current.current.csrfToken = session.csrfToken;
        const result = await request('/workspace',{signal:controller.signal});
        if(ticket !== operation.current) return;
        adopt(result.workspace,{mode:'server',revision:result.revision,actor:session.actor,csrfToken:session.csrfToken,integrity:result.integrity});
      } catch (e) {
        if(ticket === operation.current) useBrowser(e.name === 'AbortError' ? 'Local service unavailable. Browser demo mode is active.' : 'Local service unavailable. Browser demo mode is active; no server data was replaced.');
      } finally { clearTimeout(timeout); }
    })();
    return () => { controller.abort(); clearTimeout(timeout); operation.current++; };
  },[]);

  async function refresh() {
    if(current.current.mode !== 'server') return current.current.workspace;
    const result = await request('/workspace');
    if(result.revision >= current.current.revision) adopt(result.workspace,{revision:result.revision,integrity:result.integrity});
    return current.current.workspace;
  }

  async function commands(batch) {
    if (current.current.pending || !current.current.workspace) throw new Error('Wait for the current operation to finish.');
    const ticket = ++operation.current;
    current.current.pending = true;
    setBusy(true); setError('');
    try {
      const live = current.current;
      let next, result;
      if(live.mode === 'server') {
        const endpoint = batch.length === 1 ? '/commands' : '/batch';
        const envelope = batch.length === 1 ? {command:batch[0],expectedRevision:live.revision} : {commands:batch,expectedRevision:live.revision};
        const reply = await request(endpoint,{method:'POST',headers:{'Idempotency-Key':crypto.randomUUID()},body:JSON.stringify(envelope)});
        if(ticket !== operation.current) return null;
        next = reply.workspace; result = reply.result;
        if(reply.revision >= current.current.revision) adopt(next,{revision:reply.revision,integrity:reply.integrity});
        next = current.current.workspace;
      } else {
        next = live.workspace;
        const now = new Date(Math.max(Date.now(),Date.parse(next.events.at(-1)?.observedAt || 0))).toISOString();
        for(const command of batch) {
          const reduced = reduceWorkspace(next,{...command,id:command.id || crypto.randomUUID()},{actor:live.actor,now});
          next = reduced.state; result = reduced.result;
        }
        // Persist only after the entire batch validates; failure leaves the prior workspace intact.
        try { localStorage.setItem(KEY,JSON.stringify(next)); }
        catch { setError('Browser storage is full or unavailable. The open workspace is intact; export it before leaving.'); }
        if(ticket !== operation.current) return null;
        adopt(next,{revision:next.revision,integrity:validateWorkspace(next)});
      }
      return {workspace:next,result};
    } catch(e) {
      if(ticket === operation.current) {
        setError(`${e.code ? `${e.code}: ` : ''}${e.message}`);
        if(e.code === 'STALE_REVISION' || e.code === 'REVISION_CONFLICT') { try { await refresh(); } catch(refreshError) { setError(`${e.message} Refresh failed: ${refreshError.message}`); } }
      }
      throw e;
    } finally { if(ticket === operation.current) { current.current.pending = false; setBusy(false); } }
  }

  async function changeRole(role) {
    if(current.current.pending) return;
    current.current.pending = true;
    setBusy(true); setError('');
    try {
      if(current.current.mode === 'server') {
        await request('/session',{method:'DELETE'});
        current.current.csrfToken = null;
        const session = await request('/session',{method:'POST',body:JSON.stringify({role})});
        current.current = {...current.current,actor:session.actor,csrfToken:session.csrfToken}; setActor(session.actor);
      } else { const next=browserActor(role); current.current.actor=next; setActor(next); }
    } catch(e) { setError(e.message); }
    finally { current.current.pending = false; setBusy(false); }
  }

  async function resetDemo() {
    if(current.current.pending) return;
    current.current.pending = true;
    setBusy(true); setError('');
    try {
      if(current.current.mode === 'server') {
        const reply = await request('/demo/reset',{method:'POST',headers:{'Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({confirm:'RESET_DEMO_WORKSPACE',expectedRevision:current.current.revision})});
        if(reply.revision >= current.current.revision) adopt(reply.workspace,{revision:reply.revision,integrity:reply.integrity});
      } else {
        if(current.current.actor.role !== 'admin') throw new Error('Use the demo admin role to reset the workspace.');
        const next=createDemoWorkspace(); localStorage.setItem(KEY,JSON.stringify(next));
        adopt(next,{revision:next.revision,integrity:validateWorkspace(next)});
      }
      setSelectedId('pipeline-seats');
    } catch(e) { setError(e.message); }
    finally { current.current.pending = false; setBusy(false); }
  }

  async function exportPacket(options = {}) {
    const live=current.current;
    if(!live.workspace) throw new Error('The workspace has not loaded.');
    const query = new URLSearchParams(Object.entries(options).filter(([,value])=>value != null));
    const server = live.mode === 'server' ? await request(`/export?${query}`) : null;
    const snapshot = server ? server.workspace : live.workspace;
    if(server && server.revision >= current.current.revision) adopt(snapshot,{revision:server.revision,integrity:server.integrity});
    return {
      format:'truthful-assurance-packet-v1', exportedAt:new Date().toISOString(),
      mode:live.mode, actor:live.actor, workspace:snapshot,
      view:evaluateWorkspace(snapshot,options), invariantCheck:validateWorkspace(snapshot,options),
      ...(server ? {serverRecord:server} : {}),
      notice:'Recorded evidence and authorized local simulation. No email, renewal, payment or vendor transaction was sent. Model checks and local hashes do not authenticate sources or prove feed completeness.',
    };
  }

  return {workspace,mode,actor,busy,error,setError,integrity,selectedId,setSelectedId,commands,command:command => commands([command]),changeRole,resetDemo,exportPacket,refresh};
}
