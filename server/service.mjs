import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createAuthorityManager } from './authority.mjs';

const COOKIE = 'truthful_demo_session';
const MAX_BODY = 256 * 1024;
const SESSION_MS = 8 * 60 * 60 * 1000;
const ROLES = Object.freeze({
  viewer: { id: 'demo-viewer', role: 'viewer', name: 'Audit observer' },
  analyst: { id: 'demo-analyst', role: 'analyst', name: 'Finance operator' },
  approver: { id: 'demo-approver', role: 'approver', name: 'Finance reviewer' },
  executor: { id: 'demo-executor', role: 'executor', name: 'Execution operator' },
  admin: { id: 'demo-admin', role: 'admin', name: 'Workspace administrator' },
});
const ROLE_ALIASES = { operator: 'analyst', reviewer: 'approver', auditor: 'viewer' };
const DEFAULT_ORIGINS = ['http://127.0.0.1:5173', 'http://localhost:5173', 'http://127.0.0.1:4173', 'http://localhost:4173', 'http://127.0.0.1:5174', 'http://localhost:5174'];
const NOTICE = 'Local demonstration identity, not production authentication. Hash verification checks consistency relative to this database/export; a person controlling the database can replace the entire history. No external message, purchase, renewal, or payment is sent.';

export class ServiceError extends Error {
  constructor(status, code, message, details) {
    super(message); this.name = 'ServiceError'; this.status = status; this.code = code; this.details = details;
  }
}

export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().filter(k => value[k] !== undefined).map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
const hash = value => createHash('sha256').update(typeof value === 'string' ? value : canonical(value)).digest('hex');
const clone = value => structuredClone(value);
const safeEqual = (a, b) => typeof a === 'string' && typeof b === 'string' && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const fail = (status, code, message, details) => { throw new ServiceError(status, code, message, details); };

function safeOrigin(value) {
  try { const url = new URL(value); return url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && url.origin === value; }
  catch { return false; }
}

function normalizeEngine(engine) {
  for (const name of ['createDemoWorkspace', 'reduceWorkspace', 'evaluateWorkspace']) if (typeof engine[name] !== 'function') throw new Error(`Assurance engine export ${name} is required.`);
  return engine;
}

function reduce(engine, state, command, actor, at) {
  const result = engine.reduceWorkspace(state, command, { actor, now: at });
  if (!result || !result.state) throw new Error('The assurance engine returned no state.');
  return result;
}

function applyStored(engine, state, initialWorkspace, command, actor, at) {
  if (command.type === '__DEMO_RESET__') return { state: clone(initialWorkspace), result: { reset: true, scope: 'Fictional demo workspace only' } };
  if (command.type === '__BATCH__') {
    let next = state;
    const results = [];
    for (const item of command.commands) {
      const result = reduce(engine, next, item, actor, at);
      next = result.state; results.push(result.result ?? null);
    }
    return { state: next, result: { batch: true, count: results.length, results } };
  }
  return reduce(engine, state, command, actor, at);
}

function storedCommand(command) {
  if (command.type === '__DEMO_RESET__') return command;
  if (command.type === '__BATCH__') return { type: '__BATCH__', commands: command.commands.map(item => ({ ...item, id: item.id || randomUUID() })) };
  return { ...command, id: command.id || randomUUID() };
}

function verifyHistory(initialWorkspace, workspace, entries, revision, engine) {
  try {
    let state = clone(initialWorkspace), previousHash = null, count = 0;
    for (const entry of entries) {
      const { hash: entryHash, ...unsigned } = entry;
      if (entry.sequence !== count + 1 || entry.beforeRevision !== count || entry.afterRevision !== count + 1 || entry.previousHash !== previousHash || hash(unsigned) !== entryHash || entry.beforeDigest !== hash(state)) return { valid: false, reason: 'Audit sequence or content digest differs.' };
      state = applyStored(engine, state, initialWorkspace, entry.command, entry.actor, entry.at).state;
      if (entry.afterDigest !== hash(state)) return { valid: false, reason: 'Command replay differs from the recorded result.' };
      previousHash = entryHash; count++;
    }
    if (count !== revision || hash(state) !== hash(workspace)) return { valid: false, reason: 'Workspace snapshot differs from the event history.' };
    return { valid: true, entries: count, headHash: previousHash, revision, scope: 'Internal database consistency; not independent source authenticity.' };
  } catch { return { valid: false, reason: 'Audit history cannot be replayed.' }; }
}

export async function verifyExportPacket(packet, { engine } = {}) {
  try {
    engine = normalizeEngine(engine || await import('../src/assurance/index.mjs'));
    if (packet?.format !== 'truthful-server-evidence-v1' || !Array.isArray(packet.audit)) return { valid: false, reason: 'Unsupported evidence packet.' };
    const { exportDigest, ...unsigned } = packet;
    if (exportDigest !== hash(unsigned)) return { valid: false, reason: 'Export content changed.' };
    const result = verifyHistory(packet.initialWorkspace, packet.workspace, packet.audit, packet.revision, engine);
    if (!result.valid) return result;
    if (canonical(packet.view) !== canonical(engine.evaluateWorkspace(packet.workspace, packet.projectionContext))) return { valid: false, reason: 'Export projection differs from the workspace.' };
    return result;
  } catch { return { valid: false, reason: 'Evidence packet cannot be verified.' }; }
}

export async function createService({ dbPath = ':memory:', clock = () => new Date().toISOString(), allowedOrigins = DEFAULT_ORIGINS, engine, initialWorkspace } = {}) {
  engine = normalizeEngine(engine || await import('../src/assurance/index.mjs'));
  const origins = new Set(allowedOrigins);
  for (const origin of origins) if (!safeOrigin(origin)) throw new Error('Demo service origins must be explicit HTTP loopback origins.');
  if (dbPath !== ':memory:') mkdirSync(dirname(resolve(dbPath)), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS workspace (id TEXT PRIMARY KEY CHECK(id='demo'), revision INTEGER NOT NULL, initial_json TEXT NOT NULL, state_json TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL) STRICT;
    CREATE TABLE IF NOT EXISTS audit (sequence INTEGER PRIMARY KEY, entry_json TEXT NOT NULL) STRICT;
    CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, actor_json TEXT NOT NULL, csrf_token TEXT NOT NULL, expires_at INTEGER NOT NULL) STRICT;
    CREATE TABLE IF NOT EXISTS idempotency (actor_id TEXT NOT NULL, request_key TEXT NOT NULL, request_digest TEXT NOT NULL, response_json TEXT NOT NULL, response_digest TEXT NOT NULL, revision INTEGER NOT NULL, PRIMARY KEY(actor_id,request_key)) STRICT;
  `);
  const now = () => {
    const value = clock();
    const date = value instanceof Date ? value : new Date(value);
    if (!Number.isFinite(date.valueOf())) throw new Error('Service clock returned an invalid time.');
    return date.toISOString();
  };
  const read = () => {
    const row = db.prepare("SELECT * FROM workspace WHERE id='demo'").get();
    return { ...row, initial: JSON.parse(row.initial_json), state: JSON.parse(row.state_json) };
  };
  const audit = () => db.prepare('SELECT entry_json FROM audit ORDER BY sequence').all().map(row => JSON.parse(row.entry_json));
  const readTransaction = callback => {
    const own = !db.isTransaction;
    if (own) db.exec('BEGIN');
    try { const result = callback(); if (own) db.exec('COMMIT'); return result; }
    catch (error) { if (own) db.exec('ROLLBACK'); throw error; }
  };
  const integrity = () => readTransaction(() => { const row = read(); return verifyHistory(row.initial, row.state, audit(), row.revision, engine); });
  const requireIntegrity = () => { const result = integrity(); if (!result.valid) fail(503, 'INTEGRITY_FAILURE', 'The stored workspace failed its consistency check. Preserve the database for inspection.', result); return result; };

  if (!db.prepare("SELECT id FROM workspace WHERE id='demo'").get()) {
    const seed = initialWorkspace || engine.createDemoWorkspace();
    const at = now();
    db.prepare('INSERT INTO workspace VALUES(?,?,?,?,?,?)').run('demo', 0, JSON.stringify(seed), JSON.stringify(seed), at, at);
  }
  try { requireIntegrity(); } catch (error) { db.close(); throw error; }

  const json = (res, status, body, extra = {}) => {
    const value = JSON.stringify(body);
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Length': Buffer.byteLength(value), ...extra }); res.end(value);
  };
  const body = async req => {
    if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) fail(415, 'JSON_REQUIRED', 'Use application/json for this request.');
    const chunks = [];
    await new Promise((resolve, reject) => {
      let size = 0;
      req.on('data', chunk => { size += chunk.length; if (size <= MAX_BODY) chunks.push(chunk); });
      req.once('error', reject);
      req.once('end', () => size > MAX_BODY ? reject(new ServiceError(413, 'BODY_TOO_LARGE', 'The request exceeds 256 KB.')) : resolve());
    });
    try { const result = JSON.parse(Buffer.concat(chunks).toString('utf8')); if (!result || Array.isArray(result) || typeof result !== 'object') throw new Error(); return result; }
    catch { fail(400, 'INVALID_JSON', 'Send one valid JSON object.'); }
  };
  const session = req => {
    const token = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
    const row = db.prepare('SELECT * FROM sessions WHERE token_hash=?').get(hash(token));
    if (!row || row.expires_at <= Date.parse(now())) return null;
    return { ...row, actor: JSON.parse(row.actor_json) };
  };
  const requireSession = req => { const value = session(req); if (!value) fail(401, 'SESSION_REQUIRED', 'Choose a local demo identity first.'); return value; };
  const requireOrigin = req => { if (!origins.has(req.headers.origin)) fail(403, 'ORIGIN_FORBIDDEN', 'Mutations require an allowed loopback application origin.'); };
  const requireCsrf = (req, auth) => { if (!safeEqual(req.headers['x-csrf-token'], auth.csrf_token)) fail(403, 'CSRF_INVALID', 'Refresh the demo session before retrying this action.'); };
  const context = url => ({ asOf: url.searchParams.get('asOf') || now().slice(0, 10), knownAt: url.searchParams.get('knownAt') || now() });
  const projection = (row, url) => ({ workspace: row.state, view: engine.evaluateWorkspace(row.state, context(url)), revision: row.revision, domainRevision: row.state.revision, integrity: requireIntegrity(), mode: 'local-sqlite', notice: NOTICE });
  const sessionPayload = auth => ({ actor: auth?.actor || null, csrfToken: auth?.csrf_token || null, authMode: 'local-demo', roles: Object.values(ROLES), notice: NOTICE });
  const expectedRevision = (req, data) => {
    let revision = data.expectedRevision;
    if (req.headers['if-match'] !== undefined) {
      const raw = String(req.headers['if-match']).replace(/^"|"$/g, '');
      if (!/^\d+$/.test(raw)) fail(400, 'INVALID_REVISION', 'If-Match must contain a nonnegative revision.');
      const headerRevision = Number(raw);
      if (revision !== undefined && revision !== headerRevision) fail(400, 'REVISION_MISMATCH', 'If-Match and expectedRevision disagree.');
      revision = headerRevision;
    }
    if (!Number.isSafeInteger(revision) || revision < 0) fail(428, 'REVISION_REQUIRED', 'Provide the current server revision through expectedRevision or If-Match.');
    return revision;
  };
  const write = (req, auth, data, command, url, authorityContext) => {
    if (['actor', 'role', 'userId'].some(key => Object.hasOwn(data, key))) fail(403, 'ACTOR_NOT_CLIENT_CONTROLLED', 'Actor and role come from the server session.');
    const expected = expectedRevision(req, data);
    const key = req.headers['idempotency-key'];
    if (typeof key !== 'string' || !/^[A-Za-z0-9._:-]{8,128}$/.test(key)) fail(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Use an 8–128 character Idempotency-Key for every write.');
    const requestDigest = authorityContext?.requestDigest || hash({ expectedRevision: expected, command });
    db.exec('BEGIN IMMEDIATE');
    try {
      requireIntegrity();
      const cached = db.prepare('SELECT * FROM idempotency WHERE actor_id=? AND request_key=?').get(auth.actor.id, key);
      if (cached) {
        if (cached.request_digest !== requestDigest) fail(409, 'IDEMPOTENCY_CONFLICT', 'This key was already used for different input.');
        if (cached.response_digest !== hash(cached.response_json)) fail(503, 'INTEGRITY_FAILURE', 'The stored idempotent result changed.');
        const response = JSON.parse(cached.response_json);
        const anchor = db.prepare('SELECT entry_json FROM audit WHERE sequence=?').get(cached.revision);
        if (!anchor || response.audit?.hash !== JSON.parse(anchor.entry_json).hash) fail(503, 'INTEGRITY_FAILURE', 'The stored response is not linked to its audit event.');
        db.exec('COMMIT'); return { response, replayed: true };
      }
      const current = read();
      if (expected !== current.revision) fail(409, 'REVISION_CONFLICT', 'The workspace changed. Refresh before approving or applying this action.', { expectedRevision: expected, currentRevision: current.revision });
      const at = now();
      authorityContext?.authorize(current, at);
      const persistedCommand = storedCommand(command);
      const reduced = applyStored(engine, current.state, current.initial, persistedCommand, auth.actor, at);
      const previous = db.prepare('SELECT entry_json FROM audit ORDER BY sequence DESC LIMIT 1').get();
      const revision = current.revision + 1;
      const unsigned = { sequence: revision, at, actor: auth.actor, command: persistedCommand, beforeRevision: current.revision, afterRevision: revision, beforeDigest: hash(current.state), afterDigest: hash(reduced.state), previousHash: previous ? JSON.parse(previous.entry_json).hash : null, result: reduced.result ?? null };
      const event = { ...unsigned, hash: hash(unsigned) };
      db.prepare('INSERT INTO audit VALUES(?,?)').run(revision, JSON.stringify(event));
      db.prepare("UPDATE workspace SET revision=?,state_json=?,updated_at=? WHERE id='demo'").run(revision, JSON.stringify(reduced.state), at);
      if (command.type === '__DEMO_RESET__') authority.revokeOutstandingForReset(at, auth.actor);
      const authorityResult = authorityContext?.afterWrite({ current, reduced, event, at, revision });
      const response = { ...projection({ state: reduced.state, revision }, url), result: reduced.result ?? null, audit: { sequence: event.sequence, hash: event.hash }, ...(authorityResult ? { authority: authorityResult } : {}) };
      const responseJson = JSON.stringify(response);
      db.prepare('INSERT INTO idempotency VALUES(?,?,?,?,?,?)').run(auth.actor.id, key, requestDigest, responseJson, hash(responseJson), revision);
      db.exec('COMMIT'); return { response, replayed: false };
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  };

  const authority = createAuthorityManager({ db, now, engine, read, requireIntegrity, write });

  const server = createServer(async (req, res) => {
    try {
      const host = req.headers.host || '';
      if (!/^(?:127\.0\.0\.1|localhost|\[::1\])(?::\d{1,5})?$/.test(host)) fail(403, 'HOST_FORBIDDEN', 'This demonstration service accepts loopback hosts only.');
      const origin = req.headers.origin;
      if (origin && origins.has(origin)) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Access-Control-Allow-Credentials', 'true'); res.setHeader('Vary', 'Origin'); }
      if (req.method === 'OPTIONS') {
        requireOrigin(req); res.writeHead(204, { 'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,X-CSRF-Token,Idempotency-Key,If-Match', 'Access-Control-Max-Age': '600' }); res.end(); return;
      }
      const url = new URL(req.url, `http://${host}`);
      if (req.method === 'GET' && url.pathname === '/api/health') { json(res, 200, { ok: true, mode: 'local-sqlite', authMode: 'local-demo', persistent: dbPath !== ':memory:', integrity: integrity(), externalActions: false }); return; }
      if (req.method === 'GET' && url.pathname === '/api/session') { json(res, 200, sessionPayload(session(req))); return; }
      if (req.method === 'POST' && url.pathname === '/api/session') {
        requireOrigin(req); const data = await body(req);
        const role = ROLE_ALIASES[data.role] || data.role;
        if (!Object.hasOwn(ROLES, role)) fail(400, 'INVALID_ROLE', 'Choose a listed local demonstration role.');
        const existing = session(req);
        if (existing) { if (existing.actor.role !== role) fail(403, 'ROLE_IMMUTABLE', 'A session cannot change its role. Sign out before selecting another local demo identity.'); json(res, 200, sessionPayload(existing)); return; }
        const token = randomBytes(32).toString('hex'), csrf = randomBytes(32).toString('hex');
        const auth = { actor: ROLES[role], csrf_token: csrf };
        db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(hash(token), JSON.stringify(auth.actor), csrf, Date.parse(now()) + SESSION_MS);
        json(res, 201, sessionPayload(auth), { 'Set-Cookie': `${COOKIE}=${token}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=${SESSION_MS / 1000}` }); return;
      }
      if (req.method === 'GET' && url.pathname === '/api/authority') { json(res, 200, authority.info()); return; }
      if (req.method === 'GET' && url.pathname === '/api/authority/status') { json(res, 200, authority.status(url.searchParams.get('grantId'))); return; }
      if (req.method === 'POST' && url.pathname === '/api/authority/execute') {
        requireOrigin(req); const result = await authority.execute(req, await body(req), url);
        json(res, 200, result.response, result.replayed ? { 'Idempotent-Replayed': 'true' } : {}); return;
      }
      const auth = requireSession(req);
      if (req.method === 'GET' && url.pathname === '/api/authority/export') { json(res, 200, readTransaction(() => { requireIntegrity(); return authority.exportPacket(); }), { 'Content-Disposition': 'attachment; filename="truthful-authority-evidence.json"' }); return; }
      if (req.method === 'POST' && ['/api/authority/grants', '/api/authority/revoke'].includes(url.pathname)) {
        requireOrigin(req); requireCsrf(req, auth); const input = await body(req);
        const options = { actor: auth.actor, idempotencyKey: req.headers['idempotency-key'] };
        json(res, 200, url.pathname.endsWith('/grants') ? authority.issueGrant(input, options) : authority.revokeGrant(input, options)); return;
      }
      if (req.method === 'DELETE' && url.pathname === '/api/session') {
        requireOrigin(req); requireCsrf(req, auth); db.prepare('DELETE FROM sessions WHERE token_hash=?').run(auth.token_hash);
        json(res, 200, { signedOut: true }, { 'Set-Cookie': `${COOKIE}=; Path=/api; HttpOnly; SameSite=Strict; Max-Age=0` }); return;
      }
      if (req.method === 'GET' && url.pathname === '/api/workspace') {
        const result = readTransaction(() => { const row = read(); return { response: projection(row, url), revision: row.revision }; });
        json(res, 200, result.response, { ETag: `"${result.revision}"` }); return;
      }
      if (req.method === 'GET' && url.pathname === '/api/events') {
        const result = readTransaction(() => ({ events: audit(), revision: read().revision, integrity: requireIntegrity() }));
        json(res, 200, result); return;
      }
      if (req.method === 'GET' && url.pathname === '/api/verify') { json(res, 200, { integrity: requireIntegrity(), notice: NOTICE }); return; }
      if (req.method === 'GET' && url.pathname === '/api/export') {
        const packet = readTransaction(() => {
          const checked = requireIntegrity(), row = read(), projectionContext = context(url);
          return { format: 'truthful-server-evidence-v1', generatedAt: now(), initialWorkspace: row.initial, workspace: row.state, revision: row.revision, domainRevision: row.state.revision, projectionContext, view: engine.evaluateWorkspace(row.state, projectionContext), audit: audit(), integrity: checked, notice: NOTICE };
        });
        json(res, 200, { ...packet, exportDigest: hash(packet) }, { 'Content-Disposition': 'attachment; filename="truthful-server-evidence.json"' }); return;
      }
      if (req.method === 'POST' && ['/api/commands', '/api/batch', '/api/demo/reset'].includes(url.pathname)) {
        requireOrigin(req); requireCsrf(req, auth); const data = await body(req); let command = data.command;
        if (url.pathname === '/api/demo/reset') {
          if (auth.actor.role !== 'admin') fail(403, 'FORBIDDEN', 'Only the local demo administrator can reset this fictional workspace.');
          if (data.confirm !== 'RESET_DEMO_WORKSPACE') fail(400, 'RESET_CONFIRMATION_REQUIRED', 'Confirm the fictional demo reset explicitly.');
          command = { type: '__DEMO_RESET__' };
        } else if (url.pathname === '/api/batch') {
          if (!Array.isArray(data.commands) || data.commands.length < 1 || data.commands.length > 200 || data.commands.some(item => !item || typeof item !== 'object' || Array.isArray(item) || typeof item.type !== 'string' || item.type.startsWith('__'))) fail(400, 'INVALID_BATCH', 'Supply 1–200 supported domain commands.');
          command = { type: '__BATCH__', commands: data.commands };
        } else if (!command || typeof command !== 'object' || Array.isArray(command) || typeof command.type !== 'string' || command.type.startsWith('__')) fail(400, 'INVALID_COMMAND', 'Supply one supported domain command.');
        const result = write(req, auth, data, command, url); json(res, 200, result.response, result.replayed ? { 'Idempotent-Replayed': 'true' } : {}); return;
      }
      fail(404, 'NOT_FOUND', 'No API route matches this request.');
    } catch (error) {
      const statuses = { FORBIDDEN: 403, NOT_FOUND: 404, CONFLICT: 409, AMBIGUOUS: 409, STALE_APPROVAL: 409, POLICY_BLOCKED: 422, INSUFFICIENT_CREDIT: 422, ALREADY_EXECUTED: 409, VALIDATION: 422 };
      const status = error.status || statuses[error.code] || 500;
      if (!res.headersSent) json(res, status, { error: { code: error.code || 'INTERNAL_ERROR', message: status === 500 ? 'The local service could not complete this request.' : error.message, ...(error.details ? { details: error.details } : {}) } });
      else res.end();
    }
  });
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  server.keepAliveTimeout = 1000;
  let listening = false;
  return {
    server,
    integrity,
    async listen({ port = 5174, host = '127.0.0.1' } = {}) {
      if (!['127.0.0.1', '::1', 'localhost'].includes(host)) throw new Error('The local demo service cannot bind a public interface.');
      await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, () => { server.off('error', reject); resolve(); }); }); listening = true;
      const address = server.address(); const baseUrl = `http://${address.family === 'IPv6' ? '[::1]' : '127.0.0.1'}:${address.port}`;
      origins.add(baseUrl); return { baseUrl, port: address.port };
    },
    async close() { if (listening) { await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())); listening = false; } db.close(); },
  };
}
