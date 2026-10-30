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
const response = body => ({
  ok: true, headers: {get: () => 'application/json'}, json: async () => body,
});
const envelope = (workspace, revision, result = {}) => ({workspace, revision, result, integrity: {valid: true}});

async function harness(t, {commandReply, resetReply, refreshReply = envelope(newerWorkspace, 2), stallAt = null, expectedMode = 'server'} = {}) {
  const states = [], effects = [], calls = [], ready = deferred();
  let stateIndex = 0, workspaceReads = 0;
  const mock = {
    useState(initial) {
      const index = stateIndex++;
      states[index] = initial;
      return [initial, next => {
        states[index] = typeof next === 'function' ? next(states[index]) : next;
        if (index === 0 && states[index]) ready.resolve();
      }];
    },
    useRef: current => ({current}),
    useEffect: effect => {effects.push(effect);},
    location: {search: ''},
    localStorage: {getItem: () => null, setItem: () => assert.fail('Server-mode test wrote browser storage.')},
    async fetch(url, options = {}) {
      calls.push({url, options});
      if(stallAt && url.endsWith(stallAt)) return new Promise((resolve,reject)=>{
        if(options.signal?.aborted) reject(new DOMException('Request aborted','AbortError'));
        else options.signal?.addEventListener('abort',()=>reject(new DOMException('Request aborted','AbortError')),{once:true});
      });
      if (url.endsWith('/health')) return response({ok: true});
      if (url.endsWith('/session')) return response({actor: context.actor, csrfToken: 'review-csrf'});
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
    .replaceAll('import.meta.env', "({BASE_URL:'/',DEV:true})");
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
  return {api, calls, workspace: () => states[0]};
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
