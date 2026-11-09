import { useEffect, useRef, useState } from 'react';
import { createDemoWorkspace, evaluateWorkspace, reduceWorkspace, validateWorkspace } from './assurance/index.mjs';

const KEY = 'truthful.assurance.v1';
const apiBase = `${import.meta.env.BASE_URL}api`;
const browserActor = role => ({ id: `browser-demo-${role}`, role, name: `Demo ${role}` });
const signedOutActor = () => ({id:'signed-out',role:'viewer',name:'Signed out'});

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
  const [actor, setActor] = useState(signedOutActor());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [integrity, setIntegrity] = useState(null);
  const [selectedId, updateSelectedId] = useState('pipeline-seats');
  const [serverRevision, setServerRevision] = useState(0);
  const [authMode, setAuthMode] = useState('detecting');
  const [session, setSession] = useState(null);
  const [authStatus, setAuthStatus] = useState('checking');
  const current = useRef({workspace:null,mode:'connecting',revision:0,csrfToken:null,actor:signedOutActor(),authMode:'detecting',session:null,authStatus:'checking',selectedId:'pipeline-seats',pending:false});
  const operation = useRef(0);
  const scope = useRef(0);
  const connection = useRef(null);

  function setSelectedId(id) { current.current.selectedId=id; updateSelectedId(id); }

  function adopt(next, options = {}) {
    current.current = { ...current.current, ...options, workspace:next };
    setWorkspace(next);
    if (Object.hasOwn(options,'mode')) setMode(options.mode);
    if (Object.hasOwn(options,'actor')) setActor(options.actor);
    if (Object.hasOwn(options,'integrity')) setIntegrity(options.integrity);
    if (Object.hasOwn(options,'revision')) setServerRevision(options.revision);
    if (Object.hasOwn(options,'authMode')) setAuthMode(options.authMode);
    if (Object.hasOwn(options,'session')) setSession(options.session);
    if (Object.hasOwn(options,'authStatus')) setAuthStatus(options.authStatus);
    if(next) {
      const commitments=evaluateWorkspace(next).commitments;
      if(!commitments.some(item=>item.id===current.current.selectedId)) setSelectedId(commitments[0]?.id||'');
    }
  }

  function clearManaged(message='',{cancel=false}={}) {
    scope.current++;
    if(cancel) { operation.current++; current.current.pending=false; setBusy(false); }
    adopt(null,{mode:'server',authMode:'managed-password',authStatus:'signed-out',actor:signedOutActor(),session:{authMode:'managed-password',actor:null,user:null,workspace:null,workspaces:[],csrfToken:null},csrfToken:null,revision:0,integrity:null});
    setSelectedId(''); setError(message);
  }

  async function request(path, options = {}) {
    const {suppressAuthReset=false,...fetchOptions}=options;
    const epoch=scope.current, managed=current.current.authMode==='managed-password';
    const response = await fetch(`${apiBase}${path}`, {
      credentials:'same-origin', ...fetchOptions,
      headers:{ 'Content-Type':'application/json', ...(current.current.csrfToken ? {'X-CSRF-Token':current.current.csrfToken} : {}), ...options.headers },
    });
    if (!response.headers.get('content-type')?.includes('application/json')) {
      const e=new Error('The workspace service did not return a valid response.');e.status=response.status;throw e;
    }
    const body = await response.json();
    if (!response.ok) {
      const detail = body.error?.message || body.message || `Request failed (${response.status}).`;
      const e = new Error(detail); e.code = body.error?.code || body.code; e.details = body.error?.details; e.status=response.status;
      if(response.status===401 && managed && !suppressAuthReset && epoch===scope.current) clearManaged('Your session ended. Sign in again to continue.',{cancel:true});
      throw e;
    }
    return body;
  }

  function useBrowser(message = '') {
    let next,storageError='';
    try { next = loadBrowser(); }
    catch (e) { next = createDemoWorkspace(); storageError=`${e.message} A fresh demo is open; the unreadable saved copy has not been overwritten.`; }
    scope.current++;
    const demoActor=browserActor('admin');
    adopt(next,{mode:'browser',authMode:'browser-local',authStatus:'ready',actor:demoActor,session:{authMode:'browser-local',actor:demoActor,user:null,workspace:null,workspaces:[]},revision:next.revision,csrfToken:null,integrity:validateWorkspace(next)});
    if (message||storageError) setError([message,storageError].filter(Boolean).join(' '));
  }

  function acceptSession(value) {
    const nextMode=value.authMode==='managed-password'?'managed-password':'local-demo';
    const prior=current.current;
    const changed=prior.authMode!==nextMode || prior.actor.id!==value.actor?.id || prior.actor.role!==value.actor?.role || prior.session?.workspace?.id!==value.workspace?.id;
    if(changed) { scope.current++; setSelectedId(''); }
    adopt(changed?null:prior.workspace,{mode:'server',authMode:nextMode,authStatus:value.actor?'checking':'signed-out',session:value,actor:value.actor||signedOutActor(),csrfToken:value.csrfToken||null,...(changed?{revision:0,integrity:null}:{})});
  }

  async function loadSessionWorkspace(value,options={}) {
    acceptSession(value);
    if(!value.actor || (value.authMode==='managed-password' && !value.workspace)) {
      adopt(null,{authStatus:value.actor?'ready':'signed-out'}); return null;
    }
    const epoch=scope.current, result=await request('/workspace',options);
    if(epoch!==scope.current) return null;
    if(result.revision>=current.current.revision) adopt(result.workspace,{revision:result.revision,integrity:result.integrity,authStatus:'ready'});
    return current.current.workspace;
  }

  async function connect() {
    connection.current?.abort();
    const controller = new AbortController();
    connection.current=controller;
    const ticket = ++operation.current;
    current.current.pending=true; setBusy(true); setError('');
    adopt(current.current.workspace,{authStatus:'checking'});
    const timeout = setTimeout(() => controller.abort(),2000);
    try {
      // Session is public in managed mode; health intentionally requires a membership.
      // Always discover the backend before selecting a demo, including production builds.
      let value=await request('/session',{signal:controller.signal});
      if(ticket!==operation.current) return;
      if(value.authMode==='managed-password' || current.current.authMode==='managed-password') {
        value={...value,authMode:'managed-password'};
        acceptSession(value); // Remember managed mode even if its workspace read fails.
      } else if(!value.actor) {
        value=await request('/session',{method:'POST',body:JSON.stringify({role:'admin'}),signal:controller.signal});
      }
      if(ticket!==operation.current) return;
      await loadSessionWorkspace(value,{signal:controller.signal});
    } catch(e) {
      if(ticket===operation.current) {
        if(current.current.authMode==='managed-password') {
          adopt(current.current.workspace,{mode:'server',authStatus:'error'});
          setError(e.name==='AbortError'?'The workspace service did not respond. Retry the connection; your account remains in managed mode.':e.message);
        } else if(e.status>=400 && e.status!==404) {
          adopt(null,{mode:'server',authMode:'service-error',authStatus:'error'});setError(e.message);
        } else useBrowser('Local service unavailable. Browser demo mode is active; no server data was replaced.');
      }
    } finally {
      clearTimeout(timeout);
      if(ticket===operation.current) { current.current.pending=false; setBusy(false); }
    }
  }

  useEffect(() => {
    connect();
    return () => { connection.current?.abort(); operation.current++; scope.current++; };
  },[]);

  async function refresh() {
    if(current.current.mode !== 'server' || !current.current.session?.actor) return current.current.workspace;
    const epoch=scope.current;
    const result = await request('/workspace');
    if(epoch!==scope.current) return current.current.workspace;
    if(result.revision >= current.current.revision) adopt(result.workspace,{revision:result.revision,integrity:result.integrity,authStatus:'ready'});
    return current.current.workspace;
  }

  async function commands(batch) {
    if (current.current.pending || !current.current.workspace) throw new Error('Wait for the current operation to finish.');
    const ticket = ++operation.current;
    const epoch=scope.current;
    current.current.pending = true;
    setBusy(true); setError('');
    try {
      const live = current.current;
      let next, result;
      if(live.mode === 'server') {
        const endpoint = batch.length === 1 ? '/commands' : '/batch';
        const envelope = batch.length === 1 ? {command:batch[0],expectedRevision:live.revision} : {commands:batch,expectedRevision:live.revision};
        const reply = await request(endpoint,{method:'POST',headers:{'Idempotency-Key':crypto.randomUUID()},body:JSON.stringify(envelope)});
        if(ticket !== operation.current || epoch!==scope.current) return null;
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
        if(ticket !== operation.current || epoch!==scope.current) return null;
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
    if(current.current.authMode==='managed-password') { setError('Your workspace membership determines your role. Switching demo roles does not change a managed account.'); return {changed:false}; }
    if(!['local-demo','browser-local'].includes(current.current.authMode)) { setError('Demo roles are available only after a demo workspace connects.'); return {changed:false}; }
    if(current.current.pending) return;
    current.current.pending = true;
    setBusy(true); setError('');
    try {
      if(current.current.mode === 'server') {
        await request('/session',{method:'DELETE'});
        current.current.csrfToken = null;
        const value = await request('/session',{method:'POST',body:JSON.stringify({role})});
        acceptSession(value); adopt(current.current.workspace,{authStatus:'ready'});
        await refresh();
      } else { const next=browserActor(role); scope.current++; adopt(current.current.workspace,{actor:next,session:{...current.current.session,actor:next}}); }
    } catch(e) { setError(e.message); }
    finally { current.current.pending = false; setBusy(false); }
  }

  async function resetDemo() {
    if(current.current.authMode==='managed-password') { setError('Demo reset is unavailable for a managed workspace.'); return {reset:false}; }
    if(!['local-demo','browser-local'].includes(current.current.authMode)) { setError('Connect to a demo workspace before resetting it.'); return {reset:false}; }
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

  async function accountAction(action) {
    if(current.current.authMode!=='managed-password') throw new Error('Connect to the managed service to use account controls.');
    if(current.current.pending) throw new Error('Wait for the current operation to finish.');
    const ticket=++operation.current;
    current.current.pending=true; setBusy(true); setError('');
    try { return await action(); }
    catch(e) {
      if(ticket===operation.current) {
        setError(e.message);
        if(current.current.session?.actor && !current.current.workspace) adopt(null,{authStatus:'error'});
      }
      throw e;
    } finally { if(ticket===operation.current) { current.current.pending=false; setBusy(false); } }
  }
  const post=(path,input,options={})=>request(path,{method:'POST',body:JSON.stringify(input),...options});
  const login=(input,password)=>accountAction(async()=>{
    const value=await post('/auth/login',typeof input==='string'?{email:input,password}:input,{suppressAuthReset:true});
    await loadSessionWorkspace(value); return value;
  });
  const logout=()=>accountAction(async()=>{ const result=await post('/auth/logout',{}); clearManaged(); return result; });
  const switchWorkspace=workspaceId=>accountAction(async()=>{ const value=await post('/workspaces/switch',{workspaceId}); await loadSessionWorkspace(value); return value; });
  const createWorkspace=input=>accountAction(async()=>{
    const result=await post('/workspaces',input);
    try {
      const value=await post('/workspaces/switch',{workspaceId:result.workspace.id});
      await loadSessionWorkspace(value); return result;
    } catch(e) {
      e.message=`Workspace “${result.workspace.name||input.name}” was created. Retry the connection and select it; do not create a duplicate. ${e.message}`;throw e;
    }
  });
  const createInvitation=input=>accountAction(()=>post('/invitations',{workspaceId:current.current.session?.workspace?.id,...input}));
  const acceptInvitation=input=>accountAction(async()=>{
    const result=await post('/auth/invitations/accept',input,{suppressAuthReset:true});
    try {
      let value=await post('/auth/login',{email:result.user.email,password:input.password},{suppressAuthReset:true});
      acceptSession(value);
      if(value.workspace?.id!==result.workspace.id) value=await post('/workspaces/switch',{workspaceId:result.workspace.id});
      await loadSessionWorkspace(value); return {...result,session:value};
    } catch(e) {
      e.message=`Invitation accepted for ${result.user.email}. Use Sign in with your account password, then select the invited workspace. ${e.message}`;throw e;
    }
  });
  const changePassword=input=>accountAction(async()=>{const result=await post('/auth/password',input); clearManaged('Password changed. Sign in with your new password.'); return result;});
  const refreshSession=()=>{
    if(current.current.pending) return Promise.reject(new Error('Wait for the current operation to finish.'));
    return connect();
  };

  async function exportPacket(options = {}) {
    const live=current.current;
    const epoch=scope.current;
    if(!live.workspace) throw new Error('The workspace has not loaded.');
    const query = new URLSearchParams(Object.entries(options).filter(([,value])=>value != null));
    const server = live.mode === 'server' ? await request(`/export?${query}`) : null;
    const snapshot = server ? server.workspace : live.workspace;
    if(epoch!==scope.current) throw new Error('The account or workspace changed during export. Export again from the current workspace.');
    if(server && server.revision >= current.current.revision) adopt(snapshot,{revision:server.revision,integrity:server.integrity});
    return {
      format:'truthful-assurance-packet-v1', exportedAt:new Date().toISOString(),
      mode:live.mode, actor:live.actor, workspace:snapshot,
      view:evaluateWorkspace(snapshot,options), invariantCheck:validateWorkspace(snapshot,options),
      ...(server ? {serverRecord:server} : {}),
      notice:'Recorded evidence and authorized local simulation. No email, renewal, payment or vendor transaction was sent. Model checks and local hashes do not authenticate sources or prove feed completeness.',
    };
  }

  return {workspace,mode,actor,busy,error,setError,integrity,selectedId,setSelectedId,commands,command:command => commands([command]),changeRole,resetDemo,exportPacket,refresh,authMode,session,authStatus,serverRevision,login,logout,switchWorkspace,createWorkspace,createInvitation,acceptInvitation,changePassword,refreshSession,apiRequest:request};
}
