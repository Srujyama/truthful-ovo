import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { request as httpRequest } from 'node:http';
import { createService, verifyExportPacket } from './service.mjs';

// This small deterministic engine isolates HTTP/storage guarantees. A separate test
// below runs the real financial engine; this stub is not financial validation.
const engine = {
  createDemoWorkspace: () => ({ schemaVersion: 1, id: 'transport-test', revision: 0, events: [], value: 0 }),
  reduceWorkspace(state, command, ctx) {
    if (!['analyst', 'admin'].includes(ctx.actor.role)) throw Object.assign(new Error('This actor cannot modify the workspace.'), { code: 'FORBIDDEN' });
    if (command.type !== 'INCREMENT' || !Number.isSafeInteger(command.amount) || command.amount < 1) throw Object.assign(new Error('Use a positive integer increment.'), { code: 'VALIDATION' });
    const event = { command, actor: ctx.actor, at: ctx.now };
    return { state: { ...state, revision: state.revision + 1, value: state.value + command.amount, events: [...state.events, event] }, result: { acceptedBy: ctx.actor.id } };
  },
  evaluateWorkspace: state => ({ value: state.value, events: state.events.length }),
};
const at = '2026-11-01T12:00:00.000Z';

async function harness(t, { dbPath = ':memory:', useEngine = engine, clock = () => at } = {}) {
  const service = await createService({ dbPath, engine: useEngine, clock });
  const { baseUrl } = await service.listen({ port: 0 });
  let cookie = '', csrf = '';
  const request = async (path, options = {}) => {
    const { json: payload, origin = baseUrl, withSession = true, headers = {}, ...rest } = options;
    const response = await fetch(baseUrl + path, {
      ...rest,
      headers: { ...(origin ? { Origin: origin } : {}), ...(withSession && cookie ? { Cookie: cookie } : {}), ...(payload !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
      ...(payload !== undefined ? { body: JSON.stringify(payload) } : {}),
    });
    const text = await response.text();
    return { status: response.status, headers: response.headers, body: text ? JSON.parse(text) : null };
  };
  const login = async role => {
    const result = await request('/api/session', { method: 'POST', json: { role } });
    if (result.headers.get('set-cookie')) cookie = result.headers.get('set-cookie').split(';')[0];
    if (result.body.csrfToken) csrf = result.body.csrfToken;
    return result;
  };
  const command = async (amount = 1, revision = 0, key = 'request-0001', extra = {}) => request('/api/commands', {
    method: 'POST', json: { command: { type: 'INCREMENT', amount }, expectedRevision: revision, ...extra },
    headers: { 'X-CSRF-Token': csrf, 'Idempotency-Key': key },
  });
  const close = () => service.close();
  t.after(close);
  return { service, request, login, command, baseUrl, close, get cookie() { return cookie; }, set cookie(value) { cookie = value; }, get csrf() { return csrf; }, set csrf(value) { csrf = value; } };
}

test('local service health, explicit demo session and protected workspace use actual HTTP', async t => {
  const app = await harness(t);
  const health = await app.request('/api/health');
  assert.equal(health.status, 200);
  assert.equal(health.body.mode, 'local-sqlite');
  assert.equal(health.body.externalActions, false);
  assert.equal((await app.request('/api/workspace')).status, 401);
  const signed = await app.login('operator');
  assert.equal(signed.status, 201);
  assert.equal(signed.body.actor.role, 'analyst');
  assert.match(signed.headers.get('set-cookie'), /HttpOnly/);
  assert.match(signed.headers.get('set-cookie'), /SameSite=Strict/);
  const workspace = await app.request('/api/workspace');
  assert.equal(workspace.status, 200);
  assert.equal(workspace.body.revision, 0);
  assert.equal(workspace.headers.get('etag'), '"0"');
  assert.equal(workspace.body.integrity.valid, true);
  assert.match(workspace.body.notice, /not production authentication/);
});

test('roles come from immutable sessions; body role and command actor cannot elevate them', async t => {
  const app = await harness(t);
  await app.login('viewer');
  assert.equal((await app.login('admin')).body.error.code, 'ROLE_IMMUTABLE');
  const forbidden = await app.command(100, 0, 'request-viewer');
  assert.equal(forbidden.status, 403);
  const forged = await app.command(100, 0, 'request-forged', { actor: { id: 'admin', role: 'admin' } });
  assert.equal(forged.status, 403);
  assert.equal(forged.body.error.code, 'ACTOR_NOT_CLIENT_CONTROLLED');
  const commandActor = await app.request('/api/commands', { method: 'POST', json: { command: { type: 'INCREMENT', amount: 100, actor: { role: 'admin' } }, expectedRevision: 0 }, headers: { 'X-CSRF-Token': app.csrf, 'Idempotency-Key': 'request-nested-forge' } });
  assert.equal(commandActor.status, 403);
  assert.equal((await app.request('/api/workspace')).body.workspace.value, 0);
  assert.equal((await app.request('/api/session', { method: 'DELETE', headers: { 'X-CSRF-Token': app.csrf } })).status, 200);
  app.cookie = '';
  assert.equal((await app.login('admin')).body.actor.role, 'admin');
  const success = await app.command(1, 0, 'request-admin');
  assert.equal(success.body.workspace.value, 1);
});

test('origin, CSRF, host, content-type and malformed JSON fail before commands execute', async t => {
  const app = await harness(t);
  const foreign = await app.request('/api/session', { method: 'POST', origin: 'https://attacker.example', json: { role: 'admin' } });
  assert.equal(foreign.status, 403);
  assert.equal(foreign.headers.get('access-control-allow-origin'), null);
  assert.equal((await app.request('/api/session', { method: 'POST', origin: null, json: { role: 'admin' } })).status, 403);
  await app.login('analyst');
  assert.equal((await app.request('/api/commands', { method: 'POST', json: { command: { type: 'INCREMENT', amount: 1 }, expectedRevision: 0 }, headers: { 'Idempotency-Key': 'missing-csrf' } })).status, 403);
  assert.equal((await app.request('/api/commands', { method: 'POST', body: '{', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': app.csrf } })).status, 400);
  assert.equal((await app.request('/api/commands', { method: 'POST', body: '{}', headers: { 'X-CSRF-Token': app.csrf } })).status, 415);
  const badHost = await new Promise((resolve, reject) => {
    const req = httpRequest(app.baseUrl + '/api/health', { headers: { Host: 'rebinding.example' } }, response => { response.resume(); response.on('end', () => resolve(response.statusCode)); });
    req.on('error', reject); req.end();
  });
  assert.equal(badHost, 403);
  const preflight = await app.request('/api/commands', { method: 'OPTIONS' });
  assert.equal(preflight.status, 204);
  assert.match(preflight.headers.get('access-control-allow-headers'), /X-CSRF-Token/);
});

test('oversized JSON is rejected with a bounded error response', async t => {
  const app = await harness(t); await app.login('analyst');
  const response = await app.request('/api/commands', { method: 'POST', json: { command: { type: 'INCREMENT', amount: 1, content: 'x'.repeat(300_000) }, expectedRevision: 0 }, headers: { 'X-CSRF-Token': app.csrf, 'Idempotency-Key': 'oversized-request' } });
  assert.equal(response.status, 413);
  assert.equal((await app.request('/api/workspace')).body.revision, 0);
});

test('atomic batch either commits all commands once or rolls back everything', async t => {
  const app = await harness(t); await app.login('analyst');
  const send = (commands, key) => app.request('/api/batch', { method: 'POST', json: { commands, expectedRevision: 0 }, headers: { 'X-CSRF-Token': app.csrf, 'Idempotency-Key': key } });
  const invalid = await send([{ type: 'INCREMENT', amount: 10 }, { type: 'UNKNOWN' }], 'invalid-batch');
  assert.equal(invalid.status, 422);
  const unchanged = (await app.request('/api/workspace')).body;
  assert.equal(unchanged.workspace.value, 0);
  assert.equal(unchanged.revision, 0);
  assert.equal((await app.request('/api/events')).body.events.length, 0);
  const commands = [{ type: 'INCREMENT', amount: 10 }, { type: 'INCREMENT', amount: 2 }];
  const first = await send(commands, 'valid-batch');
  assert.equal(first.status, 200);
  assert.equal(first.body.workspace.value, 12);
  assert.equal(first.body.revision, 1);
  assert.equal(first.body.domainRevision, 2);
  assert.equal(first.body.result.count, 2);
  const retried = await send(commands, 'valid-batch');
  assert.deepEqual(retried.body, first.body);
  assert.equal((await app.request('/api/events')).body.events.length, 1);
  assert.equal((await app.request('/api/verify')).body.integrity.valid, true);
});

test('writes require current revision, honor If-Match, and atomically reject concurrent stale writers', async t => {
  const app = await harness(t);
  await app.login('analyst');
  const results = await Promise.all([app.command(5, 0, 'concurrent-one'), app.command(7, 0, 'concurrent-two')]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
  const current = (await app.request('/api/workspace')).body;
  assert.equal(current.revision, 1);
  assert.ok([5, 7].includes(current.workspace.value));
  const matched = await app.request('/api/commands', { method: 'POST', json: { command: { type: 'INCREMENT', amount: 2 } }, headers: { 'X-CSRF-Token': app.csrf, 'Idempotency-Key': 'if-match-request', 'If-Match': '"1"' } });
  assert.equal(matched.status, 200);
  assert.equal(matched.body.revision, 2);
  assert.equal((await app.request('/api/commands', { method: 'POST', json: { command: { type: 'INCREMENT', amount: 2 } }, headers: { 'X-CSRF-Token': app.csrf, 'Idempotency-Key': 'missing-revision' } })).status, 428);
  assert.equal((await app.request('/api/commands', { method: 'POST', json: { command: { type: 'INCREMENT', amount: 2 }, expectedRevision: 2 }, headers: { 'X-CSRF-Token': app.csrf, 'Idempotency-Key': 'conflict-headers', 'If-Match': '"1"' } })).status, 400);
});

test('durable idempotency returns the original result and rejects changed input', async t => {
  const app = await harness(t);
  await app.login('analyst');
  const first = await app.command(3, 0, 'durable-request');
  await app.command(4, 1, 'second-request');
  const retried = await app.command(3, 0, 'durable-request');
  assert.equal(retried.status, 200);
  assert.deepEqual(retried.body, first.body);
  assert.equal(retried.headers.get('idempotent-replayed'), 'true');
  const reused = await app.command(500, 0, 'durable-request');
  assert.equal(reused.status, 409);
  assert.equal(reused.body.error.code, 'IDEMPOTENCY_CONFLICT');
  const events = (await app.request('/api/events')).body.events;
  assert.equal(events.length, 2);
  assert.equal(events[1].previousHash, events[0].hash);
});

test('two service instances share SQLite revision and idempotency enforcement', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'truthful-concurrent-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const dbPath = join(dir, 'workspace.sqlite');
  const first = await harness(t, { dbPath }), second = await harness(t, { dbPath });
  await first.login('analyst'); await second.login('analyst');
  const raced = await Promise.all([first.command(3, 0, 'instance-one'), second.command(4, 0, 'instance-two')]);
  assert.deepEqual(raced.map(result => result.status).sort(), [200, 409]);
  const original = raced.find(result => result.status === 200).body;
  const amount = original.workspace.value, key = amount === 3 ? 'instance-one' : 'instance-two';
  const retryOther = await (amount === 3 ? second : first).command(amount, 0, key);
  assert.deepEqual(retryOther.body, original);
  for (const instance of [first, second]) {
    const current = await instance.request('/api/workspace');
    assert.equal(current.body.revision, 1);
    assert.equal(current.body.integrity.valid, true);
    assert.equal(current.headers.get('etag'), '"1"');
    assert.equal((await verifyExportPacket((await instance.request('/api/export')).body, { engine })).valid, true);
  }
});

test('file-backed workspace, sessions, audit replay and idempotency survive service restart', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'truthful-http-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const dbPath = join(dir, 'workspace.sqlite');
  const first = await createService({ dbPath, engine, clock: () => at });
  const firstAddress = await first.listen({ port: 0 });
  const signIn = await fetch(firstAddress.baseUrl + '/api/session', { method: 'POST', headers: { Origin: firstAddress.baseUrl, 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'analyst' }) });
  const cookie = signIn.headers.get('set-cookie').split(';')[0], identity = await signIn.json();
  const payload = { command: { type: 'INCREMENT', amount: 41 }, expectedRevision: 0 };
  const requestHeaders = { Cookie: cookie, Origin: firstAddress.baseUrl, 'Content-Type': 'application/json', 'X-CSRF-Token': identity.csrfToken, 'Idempotency-Key': 'persisted-request' };
  const written = await (await fetch(firstAddress.baseUrl + '/api/commands', { method: 'POST', headers: requestHeaders, body: JSON.stringify(payload) })).json();
  await first.close();
  const second = await harness(t, { dbPath });
  second.cookie = cookie;
  assert.equal((await second.request('/api/workspace')).body.workspace.value, 41);
  const restored = await second.request('/api/session');
  assert.equal(restored.body.actor.id, identity.actor.id);
  second.csrf = restored.body.csrfToken;
  const retried = await second.command(41, 0, 'persisted-request');
  assert.deepEqual(retried.body, written);
  assert.equal((await second.request('/api/verify')).body.integrity.valid, true);
});

test('export packet binds sources, state, projection and command audit; altered packet fails', async t => {
  const app = await harness(t);
  await app.login('analyst');
  await app.command(9, 0, 'export-request');
  const response = await app.request('/api/export');
  assert.match(response.headers.get('content-disposition'), /attachment/);
  assert.equal((await verifyExportPacket(response.body, { engine })).valid, true);
  for (const mutate of [p => p.workspace.value++, p => p.audit[0].actor.id = 'forged', p => p.view.value++, p => p.initialWorkspace.value++]) {
    const packet = structuredClone(response.body); mutate(packet);
    assert.equal((await verifyExportPacket(packet, { engine })).valid, false);
  }
});

test('database snapshot tampering is detected on the next read and service restart', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'truthful-integrity-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const dbPath = join(dir, 'workspace.sqlite');
  const service = await createService({ dbPath, engine, clock: () => at });
  const { baseUrl } = await service.listen({ port: 0 });
  const login = await fetch(baseUrl + '/api/session', { method: 'POST', headers: { Origin: baseUrl, 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'analyst' }) });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const direct = new DatabaseSync(dbPath);
  direct.prepare("UPDATE workspace SET state_json=? WHERE id='demo'").run(JSON.stringify({ ...engine.createDemoWorkspace(), value: 999 }));
  direct.close();
  const check = await fetch(baseUrl + '/api/workspace', { headers: { Cookie: cookie } });
  assert.equal(check.status, 503);
  assert.equal((await check.json()).error.code, 'INTEGRITY_FAILURE');
  await service.close();
  await assert.rejects(createService({ dbPath, engine, clock: () => at }), /consistency check/);
});

test('reset is explicitly scoped to the fictional workspace, administrator-only, and keeps audit history', async t => {
  const app = await harness(t);
  await app.login('analyst');
  await app.command(6, 0, 'before-reset');
  const reset = role => app.request('/api/demo/reset', { method: 'POST', json: { confirm: 'RESET_DEMO_WORKSPACE', expectedRevision: 1, role }, headers: { 'X-CSRF-Token': app.csrf, 'Idempotency-Key': 'reset-attempt' } });
  assert.equal((await reset('admin')).status, 403);
  await app.request('/api/session', { method: 'DELETE', headers: { 'X-CSRF-Token': app.csrf } }); app.cookie = '';
  await app.login('admin');
  const missing = await app.request('/api/demo/reset', { method: 'POST', json: { expectedRevision: 1 }, headers: { 'X-CSRF-Token': app.csrf, 'Idempotency-Key': 'reset-missing-confirm' } });
  assert.equal(missing.status, 400);
  const restored = await app.request('/api/demo/reset', { method: 'POST', json: { confirm: 'RESET_DEMO_WORKSPACE', expectedRevision: 1 }, headers: { 'X-CSRF-Token': app.csrf, 'Idempotency-Key': 'reset-authorized' } });
  assert.equal(restored.status, 200);
  assert.equal(restored.body.workspace.value, 0);
  assert.equal(restored.body.revision, 2);
  assert.equal((await app.request('/api/events')).body.events.length, 2);
  assert.equal((await app.request('/api/verify')).body.integrity.valid, true);
});

test('session expiration and refusal to bind a public interface are enforced', async t => {
  let current = at;
  const app = await harness(t, { clock: () => current });
  await app.login('analyst');
  current = '2026-11-02T12:00:00.000Z';
  assert.equal((await app.request('/api/workspace')).status, 401);
  const other = await createService({ engine });
  await assert.rejects(other.listen({ host: '0.0.0.0', port: 0 }), /cannot bind a public/);
  await other.close();
  await assert.rejects(createService({ engine, allowedOrigins: ['https://public.example'] }), /loopback origins/);
});
