import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createDemoWorkspace, reduceWorkspace} from './assurance/index.mjs';

// Exercise the actual hook's transport/adoption code with controlled response
// ordering. Only React scheduling and browser I/O are replaced; no server,
// DOM, production source changes, or extra test dependencies are required.
const source = await readFile(new URL('./useAssurance.js', import.meta.url), 'utf8');
const initialWorkspace = createDemoWorkspace();
const context = {actor: {id: 'review-finance', role: 'admin'}, now: '2026-10-29T12:00:00.000Z'};
const commandWorkspace = reduceWorkspace(initialWorkspace, {
  id: 'review-approve-pipeline', type: 'APPROVE_ACTION', actionId: 'action-pipeline-preserve',
}, context).state;
const newerWorkspace = reduceWorkspace(commandWorkspace, {
  id: 'review-approve-nimbus', type: 'APPROVE_ACTION', actionId: 'action-nimbus-claim',
}, context).state;

const deferred = () => {
  let resolve;
  const promise = new Promise(accept => {resolve = accept;});
  return {promise, resolve};
};
const response = (body,status=200) => ({
  ok: status<400,status, headers: {get: () => 'application/json'}, json: async () => body,
});
const envelope = (workspace, revision, result = {}) => ({workspace, revision, result, integrity: {valid: true}});

async function harness(t, {commandReply, resetReply, refreshReply = envelope(newerWorkspace, 2), stallAt = null, expectedMode = 'server', initialSession, handleRequest, expectedStatus, production=false} = {}) {
  const states = [], effects = [], calls = [], ready = deferred();
  let stateIndex = 0, workspaceReads = 0;
  const mock = {
    useState(initial) {
      const index = stateIndex++;
      states[index] = initial;
      return [initial, next => {
        states[index] = typeof next === 'function' ? next(states[index]) : next;
        if (index === 0 && states[index]) ready.resolve();
        if(index===10 && expectedStatus===states[index]) ready.resolve();
      }];
    },
    useRef: current => ({current}),
    useEffect: effect => {effects.push(effect);},
    location: {search: ''},
    localStorage: {getItem: () => null, setItem: () => assert.fail('Server-mode test wrote browser storage.')},
    async fetch(url, options = {}) {
      calls.push({url, options});
      const custom=await handleRequest?.(url,options);
      if(custom) return custom;
      if(stallAt && url.endsWith(stallAt)) return new Promise((resolve,reject)=>{
        if(options.signal?.aborted) reject(new DOMException('Request aborted','AbortError'));
        else options.signal?.addEventListener('abort',()=>reject(new DOMException('Request aborted','AbortError')),{once:true});
      });
      if (url.endsWith('/health')) return response({ok: true});
      if (url.endsWith('/session')) return response(initialSession||{actor: context.actor, csrfToken: 'review-csrf'});
      if (url.endsWith('/workspace')) return response(++workspaceReads === 1 ? envelope(initialWorkspace, 0) : refreshReply);
      if (url.endsWith('/commands')) return response(await commandReply());
      if (url.endsWith('/demo/reset')) return response(await resetReply());
      assert.fail(`Unexpected request: ${url}`);
    },
  };
  const key = `truthful-hook-review-${crypto.randomUUID()}`;
  const reactImport = "import { useEffect, useRef, useState } from 'react';";
  const domainImport = "from './assurance/index.mjs'";
  assert.ok(source.includes(reactImport) && source.includes(domainImport) && source.includes('import.meta.env'), 'Hook harness imports/environment must match the actual source.');
  const transformed = `const {fetch,localStorage,location,useEffect,useRef,useState}=globalThis[${JSON.stringify(key)}];\n` + source
    .replace(reactImport, '')
    .replace(domainImport, `from ${JSON.stringify(new URL('./assurance/index.mjs', import.meta.url).href)}`)
    .replaceAll('import.meta.env', `({BASE_URL:'/',DEV:${!production}})`);
  globalThis[key] = mock;
  let useAssurance;
  try {
    ({default: useAssurance} = await import(`data:text/javascript;base64,${Buffer.from(transformed).toString('base64')}`));
  } finally {
    delete globalThis[key];
  }
  const api = useAssurance();
  assert.equal(effects.length, 1);
  const cleanup = effects[0]();
  t.after(cleanup);
  await ready.promise;
  assert.equal(states[1], expectedMode);
  return {api, calls, workspace: () => states[0],state:index=>states[index]};
}

test('a delayed command reply cannot replace a newer refreshed workspace', async t => {
  const delayed = deferred();
  const h = await harness(t, {commandReply: () => delayed.promise});
  const pending = h.api.command({type: 'APPROVE_ACTION', actionId: 'action-pipeline-preserve'});
  await h.api.refresh();
  assert.deepEqual(h.workspace(), newerWorkspace);
  const originalResult = {actionId: 'action-pipeline-preserve', accepted: true};
  delayed.resolve(envelope(commandWorkspace, 1, originalResult));
  const returned = await pending;
  assert.deepEqual(h.workspace(), newerWorkspace);
  assert.deepEqual(returned.workspace, newerWorkspace, 'Callers must receive the latest known workspace, not the delayed snapshot.');
  assert.deepEqual(returned.result, originalResult, 'The original command result remains available.');
});

const managedSession=(workspaceId='managed-a',role='admin')=>({
  authMode:'managed-password',actor:{id:'real-user',role,name:'Finance member'},
  user:{id:'real-user',name:'Finance member',email:'finance@example.test',systemAdmin:true},
  workspace:{id:workspaceId,name:workspaceId==='managed-a'?'Primary workspace':'Second workspace'},
  workspaces:[{id:'managed-a',name:'Primary workspace',role:'admin'},{id:'managed-b',name:'Second workspace',role:'analyst'}],
  csrfToken:`csrf-${workspaceId}`,roles:[],
});
const managedSignedOut={authMode:'managed-password',actor:null,user:null,workspace:null,workspaces:[],csrfToken:null};

test('production detects a signed-out managed service without creating a demo identity or browser workspace',async t=>{
  const h=await harness(t,{initialSession:managedSignedOut,expectedStatus:'signed-out',production:true});
  assert.equal(h.workspace(),null);
  assert.equal(h.state(8),'managed-password');
  assert.equal(h.state(2).role,'viewer');
  assert.equal(h.calls.length,1);
  assert.equal(h.calls[0].url,'/api/session');
  assert.equal(h.calls[0].options.method,undefined);
  await assert.rejects(h.api.command({type:'ADD_SOURCE'}),/Wait for the current operation/);
});

test('managed account failure retains managed mode and never opens a fictional ledger',async t=>{
  const h=await harness(t,{
    initialSession:managedSession(),expectedStatus:'error',
    handleRequest:url=>url.endsWith('/workspace')?response({error:{code:'INTEGRITY_FAILURE',message:'Workspace integrity needs repair.'}},503):null,
  });
  assert.equal(h.workspace(),null);
  assert.equal(h.state(8),'managed-password');
  assert.match(h.state(4),/integrity needs repair/);
  assert.equal(h.calls.some(call=>call.url.endsWith('/session')&&call.options.method==='POST'),false);
});

test('an available service reporting an initialization error cannot be bypassed by demo fallback',async t=>{
  const h=await harness(t,{expectedStatus:'error',handleRequest:url=>url.endsWith('/session')?response({error:{code:'INTEGRITY_FAILURE',message:'Identity service needs repair.'}},503):null});
  assert.equal(h.state(8),'service-error');
  assert.equal(h.workspace(),null);
  assert.equal(h.calls.length,1);
  assert.match(h.state(4),/needs repair/);
});

test('managed role attempts and demo reset preserve the authenticated session without HTTP mutation',async t=>{
  const h=await harness(t,{initialSession:managedSession()});
  const count=h.calls.length;
  assert.deepEqual(await h.api.changeRole('executor'),{changed:false});
  assert.deepEqual(await h.api.resetDemo(),{reset:false});
  assert.equal(h.calls.length,count);
  assert.equal(h.state(9).actor.id,'real-user');
  assert.equal(h.state(2).role,'admin');
  assert.deepEqual(h.workspace(),initialWorkspace);
});

test('sign-in, authenticated API requests, workspace switch and logout use the managed contract',async t=>{
  const loginReply=managedSession(), switched=managedSession('managed-b','analyst');
  const h=await harness(t,{
    initialSession:managedSignedOut,expectedStatus:'signed-out',
    handleRequest:(url,options)=>{
      if(url.endsWith('/auth/login')) {assert.deepEqual(JSON.parse(options.body),{email:'finance@example.test',password:'correct-password'});return response(loginReply);}
      if(url.endsWith('/workspaces/switch')) {assert.equal(options.headers['X-CSRF-Token'],'csrf-managed-a');assert.deepEqual(JSON.parse(options.body),{workspaceId:'managed-b'});return response(switched);}
      if(url.endsWith('/evidence')) {assert.equal(options.headers['X-CSRF-Token'],'csrf-managed-a');assert.equal(options.headers['Idempotency-Key'],'explicit-retry');return response({record:{id:'evidence-1'}});}
      if(url.endsWith('/auth/logout')) {assert.equal(options.headers['X-CSRF-Token'],'csrf-managed-b');return response({signedOut:true});}
      return null;
    },
  });
  await h.api.login({email:'finance@example.test',password:'correct-password'});
  assert.equal(h.state(10),'ready');
  assert.equal(h.state(7),0,'Server revision is independent of the domain event revision.');
  assert.deepEqual(await h.api.apiRequest('/evidence',{method:'POST',headers:{'Idempotency-Key':'explicit-retry'},body:'{}'}),{record:{id:'evidence-1'}});
  await h.api.switchWorkspace('managed-b');
  assert.equal(h.state(9).workspace.id,'managed-b');
  assert.equal(h.state(2).role,'analyst');
  assert.equal(h.state(7),2);
  await h.api.logout();
  assert.equal(h.workspace(),null);
  assert.equal(h.state(10),'signed-out');
  assert.equal(h.state(9).csrfToken,null);
  assert.equal(h.calls.some(call=>call.url.endsWith('/session')&&call.options.method),false);
});

test('a late refresh from a previous workspace cannot replace the switched workspace',async t=>{
  const delayed=deferred();let workspaceReads=0;
  const h=await harness(t,{
    initialSession:managedSession(),
    handleRequest:(url)=>{
      if(url.endsWith('/workspaces/switch')) return response(managedSession('managed-b','analyst'));
      if(url.endsWith('/workspace')) {
        workspaceReads++;
        if(workspaceReads===2) return delayed.promise;
        if(workspaceReads===3) return response(envelope(commandWorkspace,0));
      }
      return null;
    },
  });
  const pending=h.api.refresh();
  await h.api.switchWorkspace('managed-b');
  assert.deepEqual(h.workspace(),commandWorkspace);
  delayed.resolve(response(envelope(newerWorkspace,100)));
  await pending;
  assert.deepEqual(h.workspace(),commandWorkspace);
  assert.equal(h.state(9).workspace.id,'managed-b');
  assert.equal(h.state(7),0);
});

test('an expired managed session clears its financial workspace and cannot silently switch to demo',async t=>{
  const h=await harness(t,{
    initialSession:managedSession(),
    handleRequest:url=>url.endsWith('/evidence')?response({error:{code:'SESSION_REQUIRED',message:'Session expired.'}},401):null,
  });
  await assert.rejects(h.api.apiRequest('/evidence'),error=>error.status===401&&error.code==='SESSION_REQUIRED');
  assert.equal(h.workspace(),null);
  assert.equal(h.state(8),'managed-password');
  assert.equal(h.state(10),'signed-out');
  assert.equal(h.state(2).role,'viewer');
});

test('invitation enrollment logs into the exact accepted workspace',async t=>{
  const h=await harness(t,{
    initialSession:managedSignedOut,expectedStatus:'signed-out',
    handleRequest:(url,options)=>{
      if(url.endsWith('/auth/invitations/accept')) {assert.deepEqual(JSON.parse(options.body),{token:'manual-token',password:'correct-password',name:'New member'});return response({user:{email:'new@example.test'},workspace:{id:'managed-b'}});}
      if(url.endsWith('/auth/login')) return response(managedSession());
      if(url.endsWith('/workspaces/switch')) return response(managedSession('managed-b','analyst'));
      return null;
    },
  });
  await h.api.acceptInvitation({token:'manual-token',password:'correct-password',name:'New member'});
  assert.equal(h.state(9).workspace.id,'managed-b');
  assert.equal(h.calls.find(call=>call.url.endsWith('/auth/login')).options.body,JSON.stringify({email:'new@example.test',password:'correct-password'}));
  assert.equal(h.calls.some(call=>call.url.includes('bootstrap')),false);
});

test('a consumed invitation remains recoverable when the subsequent sign-in fails',async t=>{
  const h=await harness(t,{
    initialSession:managedSignedOut,expectedStatus:'signed-out',
    handleRequest:url=>{
      if(url.endsWith('/auth/invitations/accept')) return response({user:{email:'new@example.test'},workspace:{id:'managed-b'}});
      if(url.endsWith('/auth/login')) return response({error:{code:'AUTHENTICATION_FAILED',message:'Sign-in service unavailable.'}},503);
      return null;
    },
  });
  await assert.rejects(h.api.acceptInvitation({token:'manual-token',password:'correct-password'}),/Invitation accepted for new@example.test\. Use Sign in/);
  assert.match(h.state(4),/Invitation accepted/);
  assert.equal(h.state(10),'signed-out');
  assert.equal(h.workspace(),null);
  assert.equal(h.calls.filter(call=>call.url.endsWith('/auth/invitations/accept')).length,1);
});

test('a late unauthorized response from a different workspace cannot sign out the current workspace',async t=>{
  const delayed=deferred();
  const h=await harness(t,{
    initialSession:managedSession(),
    handleRequest:url=>url.endsWith('/evidence')?delayed.promise:url.endsWith('/workspaces/switch')?response(managedSession('managed-b','analyst')):null,
  });
  const request=h.api.apiRequest('/evidence');
  await h.api.switchWorkspace('managed-b');
  delayed.resolve(response({error:{code:'SESSION_REQUIRED',message:'Old request expired.'}},401));
  await assert.rejects(request,/Old request expired/);
  assert.equal(h.state(9).workspace.id,'managed-b');
  assert.equal(h.state(10),'ready');
  assert.deepEqual(h.workspace(),newerWorkspace);
});

test('workspace creation selects the new workspace; password change discards the revoked session',async t=>{
  const h=await harness(t,{
    initialSession:managedSession(),
    handleRequest:(url,options)=>{
      if(url.endsWith('/workspaces')) return response({workspace:{id:'managed-b',name:'Second workspace'}});
      if(url.endsWith('/workspaces/switch')) return response(managedSession('managed-b','admin'));
      if(url.endsWith('/invitations')) {assert.equal(JSON.parse(options.body).workspaceId,'managed-b');return response({token:'manual-only',invitation:{email:'invitee@example.test'}});}
      if(url.endsWith('/auth/password')) return response({changed:true,sessionsRevoked:true});
      return null;
    },
  });
  await h.api.createWorkspace({name:'Second workspace'});
  assert.equal(h.state(9).workspace.id,'managed-b');
  const invitation=await h.api.createInvitation({email:'invitee@example.test',role:'analyst'});
  assert.equal(invitation.token,'manual-only');
  await h.api.changePassword({currentPassword:'correct-password',newPassword:'replacement-password'});
  assert.equal(h.state(10),'signed-out');
  assert.equal(h.workspace(),null);
  assert.match(h.state(4),/Password changed/);
});

test('a delayed reset reply cannot replace a newer refreshed workspace', async t => {
  const delayed = deferred();
  const h = await harness(t, {resetReply: () => delayed.promise});
  const pending = h.api.resetDemo();
  await h.api.refresh();
  assert.deepEqual(h.workspace(), newerWorkspace);
  delayed.resolve(envelope(createDemoWorkspace(), 1));
  await pending;
  assert.deepEqual(h.workspace(), newerWorkspace);
});

test('normal command and reset replies still adopt their current snapshots', async t => {
  const h = await harness(t, {
    commandReply: () => envelope(commandWorkspace, 1, {actionId: 'action-pipeline-preserve'}),
    resetReply: () => envelope(initialWorkspace, 2),
  });
  const result = await h.api.command({type: 'APPROVE_ACTION', actionId: 'action-pipeline-preserve'});
  assert.deepEqual(h.workspace(), commandWorkspace);
  assert.deepEqual(result.workspace, commandWorkspace);
  await h.api.resetDemo();
  assert.deepEqual(h.workspace(), initialWorkspace);
  assert.equal(JSON.parse(h.calls.find(call => call.url.endsWith('/demo/reset')).options.body).expectedRevision, 1);
});

for (const stallAt of ['/session','/workspace']) test(`a stalled initialization ${stallAt} request falls back without replacing server data`, {timeout:5000}, async t => {
  const h = await harness(t,{stallAt,expectedMode:'browser'});
  const stalled = h.calls.find(c=>c.url.endsWith(stallAt));
  assert.ok(stalled.options.signal instanceof AbortSignal,'All initialization requests must share the timeout signal.');
  assert.equal(stalled.options.signal.aborted,true);
  assert.deepEqual(h.workspace(),initialWorkspace);
});
