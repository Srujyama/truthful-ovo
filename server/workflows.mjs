import { createHash, randomUUID } from 'node:crypto';
import { analyzeEvidence } from '../src/engine/index.mjs';
import { prepareEvidenceImport } from '../src/assuranceImport.mjs';
import { prepareCreditWorkflow } from '../src/credit-workflow.mjs';
import { prepareAmendmentWorkflow } from '../src/amendment-workflow.mjs';
import { prepareCreditResolution } from '../src/credit-resolution.mjs';
import { canonical, isDate } from '../src/assurance/index.mjs';

const MAX_JSON = 1024 * 1024;
const PREVIEW_MS = 10 * 60 * 1000;
const TYPES = ['evidence-import', 'credit', 'amendment', 'credit-resolution-evidence', 'credit-resolution'];
const ROLES = ['viewer', 'analyst', 'approver', 'executor', 'admin'];
const NOTICE = 'Supplied text and deterministic local financial records. No source authenticity, external message, accounting writeback or settlement is established.';
const hash = value => createHash('sha256').update(typeof value === 'string' ? value : canonical(value)).digest('hex');
const fail = (status, code, message, details) => { throw new WorkflowError(status, code, message, details); };
const check = (condition, status, code, message, details) => { if (!condition) fail(status, code, message, details); };
const same = (left, right) => canonical(left) === canonical(right);

export class WorkflowError extends Error {
  constructor(status, code, message, details) { super(message); this.name = 'WorkflowError'; this.status = status; this.code = code; this.details = details; }
}

function object(value, allowed, label) {
  check(value && typeof value === 'object' && !Array.isArray(value), 422, 'WORKFLOW_VALIDATION', `${label} must be an object.`);
  const unknown = Object.keys(value).filter(key => !allowed.includes(key));
  check(!unknown.length, 422, 'WORKFLOW_VALIDATION', `${label} contains unsupported fields.`, { fields: unknown });
  return value;
}
function identifier(value, label) {
  check(typeof value === 'string' && value.trim() && value.length <= 200, 422, 'WORKFLOW_VALIDATION', `${label} must contain 1–200 characters.`);
  return value.trim();
}
function integer(value, label) {
  check(Number.isSafeInteger(value) && value >= 0, 422, 'WORKFLOW_VALIDATION', `${label} must be a nonnegative safe integer.`);
  return value;
}
function actorOf(auth) {
  const actor = auth?.actor || auth;
  check(actor && ROLES.includes(actor.role) && typeof actor.id === 'string' && actor.id.trim() && actor.id.length <= 200, 401, 'SESSION_REQUIRED', 'Use a current recognized workspace identity.');
  return { id: actor.id, role: actor.role };
}
function requireRole(actor, allowed) { check(actor.role === 'admin' || allowed.includes(actor.role), 403, 'FORBIDDEN', `This workflow requires ${[...allowed, 'admin'].join(' or ')} role.`); }
function actorBinding(actor, row) { check(actor.id === row.actor_id && actor.role === row.actor_role, 403, 'PREVIEW_ACTOR_MISMATCH', 'This preview belongs to a different actor or role. Prepare a new review with the current identity.'); }
function budget(input) { check(Buffer.byteLength(JSON.stringify(input), 'utf8') <= MAX_JSON, 413, 'BODY_TOO_LARGE', 'Workflow input exceeds the 1 MiB aggregate JSON limit.'); }
function requestKey(req) {
  const key = req?.headers?.['idempotency-key'];
  check(typeof key === 'string' && /^[A-Za-z0-9._:-]{8,128}$/.test(key), 400, 'IDEMPOTENCY_KEY_REQUIRED', 'Use an 8–128 character Idempotency-Key for every workflow write.');
  return key;
}
function normalizeNow(now) {
  const value = now();
  const parsed = value instanceof Date ? value : new Date(value);
  check(Number.isFinite(parsed.valueOf()), 500, 'WORKFLOW_CLOCK', 'The workflow clock is invalid.');
  return parsed.toISOString();
}
function adapter(callback) {
  try { return callback(); }
  catch (error) {
    if (error instanceof WorkflowError) throw error;
    const statuses = { FORBIDDEN: 403, NOT_FOUND: 404, CONFLICT: 409, AMBIGUOUS: 409, STALE_APPROVAL: 409, POLICY_BLOCKED: 422, INSUFFICIENT_CREDIT: 422, ALREADY_EXECUTED: 409, VALIDATION: 422, INVARIANT: 422 };
    throw new WorkflowError(statuses[error.code] || 422, error.code || 'WORKFLOW_VALIDATION', error.message, error.details);
  }
}
const allowedInput = {
  'evidence-import': ['evidenceId', 'analysisVersion'],
  credit: ['operation', 'commitmentId', 'creditId', 'invoiceId', 'lineId', 'status', 'amount', 'allocationAmount', 'effectiveDate', 'sourceTitle', 'sourceText', 'allocationReversals'],
  amendment: ['commitmentId', 'changes', 'promisedAmount', 'dueDate', 'claimDeadline', 'conditions', 'effectiveDate', 'sourceTitle', 'sourceText', 'renewal', 'baselineAmount', 'incrementalAmount', 'baselineDescription'],
  'credit-resolution-evidence': ['operation', 'creditId', 'sourceTitle', 'sourceText', 'effectiveDate'],
  'credit-resolution': ['operation', 'creditId', 'sourceId', 'assignments', 'effectiveDate'],
};
function workflowInput(type, input) {
  check(TYPES.includes(type), 422, 'WORKFLOW_TYPE', 'Choose a supported finance workflow type.');
  object(input, allowedInput[type], 'Workflow input'); budget(input);
  const result = structuredClone(input);
  if (type === 'evidence-import') { result.evidenceId = identifier(result.evidenceId, 'Evidence ID'); result.analysisVersion = integer(result.analysisVersion, 'Analysis version'); check(result.analysisVersion > 0, 422, 'WORKFLOW_VALIDATION', 'Analysis version must be positive.'); }
  if (type.startsWith('credit-resolution')) {
    const operation = type === 'credit-resolution' ? 'resolve' : 'evidence';
    check(result.operation == null || result.operation === operation, 422, 'WORKFLOW_VALIDATION', 'The workflow type and resolution operation disagree.');
    result.operation = operation;
  }
  return result;
}
const workflowRoles = type => type === 'credit-resolution' ? ['approver'] : ['analyst'];

function summarize(view) {
  return {
    asOf: view.asOf, knownAt: view.knownAt, totals: view.totals, policy: view.policy,
    commitments: view.commitments.map(c => ({ id: c.id, vendorId: c.vendorId, reference: c.reference, status: c.status, promisedCents: c.promisedCents, verifiedCents: c.verifiedCents, outstandingCents: c.outstandingCents, issuedCents: c.issuedCents, conditions: c.conditions, dueDate: c.dueDate, claimDeadline: c.claimDeadline })),
    credits: view.credits.map(c => ({ id: c.id, invoiceId: c.invoiceId, lineId: c.lineId, vendorId: c.vendorId, reference: c.reference, status: c.status, amountCents: c.amountCents, availableCents: c.availableCents, allocatedCents: c.allocatedCents, unallocatedCents: c.unallocatedCents, quarantined: c.quarantined, resolution: c.resolution })),
  };
}

export function createWorkflowManager({ db, now, engine, read, write, authorize = (_req, auth, callback) => callback(auth) }) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS workflow_metadata (id TEXT PRIMARY KEY CHECK(id='evidence'), revision INTEGER NOT NULL) STRICT;
    INSERT OR IGNORE INTO workflow_metadata VALUES('evidence',0);
    CREATE TABLE IF NOT EXISTS workflow_preview_metadata (id TEXT PRIMARY KEY CHECK(id='previews'), revision INTEGER NOT NULL) STRICT;
    INSERT OR IGNORE INTO workflow_preview_metadata VALUES('previews',0);
    CREATE TABLE IF NOT EXISTS workflow_evidence (id TEXT PRIMARY KEY, latest_version INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, updated_sequence INTEGER NOT NULL) STRICT;
    CREATE TABLE IF NOT EXISTS workflow_evidence_versions (evidence_id TEXT NOT NULL REFERENCES workflow_evidence(id), version INTEGER NOT NULL, created_at TEXT NOT NULL, actor_json TEXT NOT NULL, input_json TEXT NOT NULL, input_digest TEXT NOT NULL, documents_digest TEXT NOT NULL, analysis_json TEXT NOT NULL, analysis_digest TEXT NOT NULL, status TEXT NOT NULL, vendor TEXT NOT NULL, label TEXT NOT NULL, record_digest TEXT NOT NULL, PRIMARY KEY(evidence_id,version)) STRICT;
    CREATE TABLE IF NOT EXISTS workflow_previews (id TEXT PRIMARY KEY, type TEXT NOT NULL, actor_id TEXT NOT NULL, actor_role TEXT NOT NULL, input_json TEXT NOT NULL, input_digest TEXT NOT NULL, commands_json TEXT NOT NULL, commands_digest TEXT NOT NULL, plan_json TEXT NOT NULL, plan_digest TEXT NOT NULL, workspace_digest TEXT NOT NULL, server_revision INTEGER NOT NULL, domain_revision INTEGER NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('prepared','consumed','discarded')), consumed_at TEXT, consumed_revision INTEGER, consumed_hash TEXT, evidence_id TEXT, analysis_version INTEGER, record_digest TEXT NOT NULL) STRICT;
    CREATE TABLE IF NOT EXISTS workflow_evidence_promotions (preview_id TEXT PRIMARY KEY REFERENCES workflow_previews(id), evidence_id TEXT NOT NULL, analysis_version INTEGER NOT NULL, commitment_id TEXT NOT NULL, server_revision INTEGER NOT NULL, audit_hash TEXT NOT NULL, recorded_at TEXT NOT NULL) STRICT;
    CREATE TABLE IF NOT EXISTS workflow_requests (actor_id TEXT NOT NULL, request_key TEXT NOT NULL, request_digest TEXT NOT NULL, response_json TEXT NOT NULL, response_digest TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(actor_id,request_key)) STRICT;
  `);
  const clock = () => normalizeNow(now);
  const transaction = callback => {
    const own = !db.isTransaction;
    if (own) db.exec('BEGIN IMMEDIATE');
    try { const result = callback(); if (own) db.exec('COMMIT'); return result; }
    catch (error) { if (own) db.exec('ROLLBACK'); throw error; }
  };
  const authorized = (req, auth, callback) => authorize(req, auth, active => callback(active?.actor ? active : { ...auth, actor: active }));
  const metadataRevision = () => db.prepare("SELECT revision FROM workflow_metadata WHERE id='evidence'").get().revision;
  const bumpPreviewRevision = () => db.prepare("UPDATE workflow_preview_metadata SET revision=revision+1 WHERE id='previews'").run();
  const previewRecordDigest = row => { const {record_digest,...content}=row;return hash(content); };
  const sealPreview = id => { const row=db.prepare('SELECT * FROM workflow_previews WHERE id=?').get(id);db.prepare('UPDATE workflow_previews SET record_digest=? WHERE id=?').run(previewRecordDigest(row),id); };
  const cache = (actor, key, digest) => {
    const row = db.prepare('SELECT * FROM workflow_requests WHERE actor_id=? AND request_key=?').get(actor.id, key);
    if (!row) return null;
    check(row.request_digest === digest, 409, 'IDEMPOTENCY_CONFLICT', 'This workflow key was used for different input or a different role.');
    check(hash(row.response_json) === row.response_digest, 503, 'WORKFLOW_INTEGRITY', 'The stored workflow response changed.');
    return { response: JSON.parse(row.response_json), replayed: true };
  };
  const storeResponse = (actor, key, digest, response, at) => {
    const json = JSON.stringify(response);
    db.prepare('INSERT INTO workflow_requests VALUES(?,?,?,?,?,?)').run(actor.id, key, digest, json, hash(json), at);
    return { response, replayed: false };
  };
  function verifiedVersion(evidenceId, version) {
    const record = db.prepare('SELECT * FROM workflow_evidence WHERE id=?').get(evidenceId);
    check(record, 404, 'EVIDENCE_NOT_FOUND', 'The evidence case was not found.');
    const row = db.prepare('SELECT * FROM workflow_evidence_versions WHERE evidence_id=? AND version=?').get(evidenceId, version ?? record.latest_version);
    check(row, 404, 'EVIDENCE_VERSION_NOT_FOUND', 'The exact evidence analysis version was not found.');
    try {
      const input = JSON.parse(row.input_json), analysis = JSON.parse(row.analysis_json);
      const documents = { promiseText: input.promiseText, invoiceCsv: input.invoiceCsv, replyText: input.replyText };
      check(hash(input) === row.input_digest && hash(documents) === row.documents_digest && hash(analysis) === row.analysis_digest, 503, 'WORKFLOW_INTEGRITY', 'The stored evidence content or analysis changed.');
      const recordDigest=hash({evidenceId:row.evidence_id,analysisVersion:row.version,createdAt:row.created_at,actor:JSON.parse(row.actor_json),label:row.label,status:row.status,vendor:row.vendor,inputDigest:row.input_digest,documentsDigest:row.documents_digest,analysisDigest:row.analysis_digest});
      check(recordDigest===row.record_digest,503,'WORKFLOW_INTEGRITY','The immutable evidence metadata changed.');
      check(same(analyzeEvidence(input), analysis), 503, 'WORKFLOW_INTEGRITY', 'The stored analysis does not reproduce from its original documents.');
      return { record, row, input, analysis };
    } catch (error) { if (error instanceof WorkflowError) throw error; fail(503, 'WORKFLOW_INTEGRITY', 'The stored evidence cannot be read or reproduced.'); }
  }
  function verifiedPreview(id) {
    const row = db.prepare('SELECT * FROM workflow_previews WHERE id=?').get(id);
    check(row, 404, 'PREVIEW_NOT_FOUND', 'The workflow preview was not found.');
    try {
      check(previewRecordDigest(row)===row.record_digest,503,'WORKFLOW_INTEGRITY','The workflow actor, basis, dates or lifecycle metadata changed.');
      const input = JSON.parse(row.input_json), commands = JSON.parse(row.commands_json), plan = JSON.parse(row.plan_json);
      check(hash(input) === row.input_digest && hash(commands) === row.commands_digest && hash(plan) === row.plan_digest, 503, 'WORKFLOW_INTEGRITY', 'The stored workflow preview changed.');
      check(TYPES.includes(row.type) && Array.isArray(commands) && commands.length <= 200, 503, 'WORKFLOW_INTEGRITY', 'The stored workflow preview has an invalid shape.');
      return { row, input, commands, plan };
    } catch (error) { if (error instanceof WorkflowError) throw error; fail(503, 'WORKFLOW_INTEGRITY', 'The stored workflow preview cannot be read.'); }
  }
  function evidenceForInput(input) {
    const value = verifiedVersion(input.evidenceId, input.analysisVersion);
    check(value.record.latest_version === input.analysisVersion, 409, 'EVIDENCE_REVISION_CHANGED', 'Newer evidence is recorded. Review its current analysis before importing.');
    return value;
  }
  function syncPlan(type, state, input, actor, at) {
    const options = { actor, now: at };
    if (type === 'credit') return adapter(() => prepareCreditWorkflow(state, input, options));
    if (type === 'amendment') return adapter(() => prepareAmendmentWorkflow(state, input, options));
    if (type.startsWith('credit-resolution')) return adapter(() => prepareCreditResolution(state, input, options));
    return null;
  }
  async function compile(type, state, input, actor, at) {
    let plan;
    if (type === 'evidence-import') {
      const evidence = evidenceForInput(input);
      try { plan = await prepareEvidenceImport(state, evidence.analysis, at); }
      catch (error) { adapter(() => { throw error; }); }
    } else plan = syncPlan(type, state, input, actor, at);
    const commands = plan.commands.map(command => ({ ...command, id: command.id || `workflow-${randomUUID()}` }));
    check(commands.length <= 200, 422, 'WORKFLOW_LIMIT', 'This import exceeds the bounded 200-command atomic workflow limit. Split the supplied invoice evidence into smaller document sets.');
    let next = state;
    for (const command of commands) next = adapter(() => engine.reduceWorkspace(next, command, { actor, now: at }).state);
    const options = { asOf: at.slice(0, 10), knownAt: at };
    const before = engine.evaluateWorkspace(state, options), after = engine.evaluateWorkspace(next, options);
    const used = new Set();
    const collect = value => { if (!value || typeof value !== 'object') return; for (const [key, nested] of Object.entries(value)) if (key === 'sourceIds' && Array.isArray(nested)) nested.forEach(id => used.add(id)); else if (nested && typeof nested === 'object') collect(nested); };
    commands.forEach(collect);
    const sourceBindings = [...used].map(id => {
      const source = after.sources.find(source => source.id === id);
      check(source, 500, 'WORKFLOW_PLAN', 'A prepared workflow source is missing.');
      return { sourceId: source.id, revision: source.revision, vendorId: source.vendorId, title: source.title, kind: source.kind, text: source.text, newlyRecorded: !before.sources.some(previous => previous.id === source.id) };
    });
    const responsePlan = { before: summarize(before), after: summarize(after), commandTypes: commands.map(command => command.type), sourceBindings,
      ...(plan.effects ? { effects: plan.effects } : {}),
      ...Object.fromEntries(['commitmentId', 'creditId', 'amendmentId', 'actionId', 'sourceId', 'alreadyTracked', 'retainedFields', 'previewNotice'].filter(key => plan[key] !== undefined).map(key => [key, plan[key]])) };
    return { commands, plan: responsePlan };
  }
  function previewResponse(row, plan) {
    return { previewId: row.id, type: row.type, status: row.status, actor: { id: row.actor_id, role: row.actor_role }, expectedRevision: row.server_revision, domainRevision: row.domain_revision, createdAt: row.created_at, expiresAt: row.expires_at, ...(row.evidence_id ? { evidenceId: row.evidence_id, analysisVersion: row.analysis_version } : {}), plan, notice: NOTICE };
  }

  function intake(req, auth, input) {
    object(input, ['vendor', 'promiseText', 'invoiceCsv', 'replyText', 'asOf', 'label', 'evidenceId', 'expectedEvidenceVersion'], 'Evidence intake'); budget(input);
    const key = requestKey(req);
    return authorized(req, auth, active => transaction(() => {
      const actor = actorOf(active); requireRole(actor, ['analyst']);
      const digest = hash({ operation: 'intake', role: actor.role, input });
      const prior = cache(actor, key, digest); if (prior) return prior;
      const at = clock(), normalized = { vendor: identifier(input.vendor, 'Vendor'), promiseText: input.promiseText, invoiceCsv: input.invoiceCsv, replyText: input.replyText ?? '', asOf: input.asOf ?? at.slice(0, 10) };
      for (const field of ['promiseText', 'invoiceCsv', 'replyText']) check(typeof normalized[field] === 'string' && normalized[field].length <= 250000, 422, 'WORKFLOW_VALIDATION', `${field} must be supplied text of at most 250,000 characters.`, { field });
      check(isDate(normalized.asOf), 422, 'WORKFLOW_VALIDATION', 'Evidence review date must be a real YYYY-MM-DD date.');
      const label = input.label == null ? normalized.vendor : identifier(input.label, 'Evidence label');
      const analysis = adapter(() => analyzeEvidence(normalized));
      let id = input.evidenceId == null ? `evidence-${randomUUID()}` : identifier(input.evidenceId, 'Evidence ID'), version = 1;
      if (input.evidenceId != null) {
        const existing = verifiedVersion(id);
        check(integer(input.expectedEvidenceVersion, 'Expected evidence version') === existing.record.latest_version, 409, 'EVIDENCE_REVISION_CHANGED', 'The evidence case changed. Reload its latest version before recording another analysis.');
        version = existing.record.latest_version + 1;
      } else check(input.expectedEvidenceVersion === undefined, 422, 'WORKFLOW_VALIDATION', 'Expected evidence version is only used when appending to an existing evidence case.');
      const sequence = metadataRevision() + 1;
      if (version === 1) db.prepare('INSERT INTO workflow_evidence VALUES(?,?,?,?,?)').run(id, version, at, at, sequence);
      else db.prepare('UPDATE workflow_evidence SET latest_version=?,updated_at=?,updated_sequence=? WHERE id=?').run(version, at, sequence, id);
      const documentsDigest = hash(analysis.documents), analysisDigest = hash(analysis);
      const status = analysis.errors.length || analysis.condition || analysis.replyCondition || analysis.replyReviewRequired ? 'needs_review' : 'analyzed';
      const recordDigest=hash({evidenceId:id,analysisVersion:version,createdAt:at,actor,label,status,vendor:normalized.vendor,inputDigest:hash(normalized),documentsDigest,analysisDigest});
      db.prepare('INSERT INTO workflow_evidence_versions VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id, version, at, JSON.stringify(actor), JSON.stringify(normalized), hash(normalized), documentsDigest, JSON.stringify(analysis), analysisDigest, status, normalized.vendor, label,recordDigest);
      db.prepare("UPDATE workflow_metadata SET revision=? WHERE id='evidence'").run(sequence);
      return storeResponse(actor, key, digest, { evidenceId: id, analysisVersion: version, evidenceRevision: sequence, status, createdAt: at, actor, label, documentsDigest, analysisDigest, analysis, notice: NOTICE }, at);
    }));
  }

  async function preview(req, auth, envelope) {
    object(envelope, ['type', 'input', 'expectedRevision'], 'Workflow preview'); budget(envelope);
    const type = envelope.type, input = workflowInput(type, envelope.input), expected = integer(envelope.expectedRevision, 'Expected server revision'), key = requestKey(req);
    const checkpoint = authorized(req, auth, active => transaction(() => {
      const actor = actorOf(active); requireRole(actor, workflowRoles(type));
      const digest = hash({ operation: 'preview', actorRole: actor.role, envelope });
      const prior = cache(actor, key, digest); if (prior) return { cached: prior };
      const current = read();
      check(current.revision === expected, 409, 'REVISION_CONFLICT', 'The financial workspace changed. Refresh before preparing this workflow.');
      if (type === 'evidence-import') evidenceForInput(input);
      return { current, actor, digest, at: clock(), stateDigest: hash(current.state) };
    }));
    if (checkpoint.cached) return checkpoint.cached;
    const compiled = await compile(type, checkpoint.current.state, input, checkpoint.actor, checkpoint.at);
    return authorized(req, auth, active => transaction(() => {
      const actor = actorOf(active); requireRole(actor, workflowRoles(type));
      check(same(actor, checkpoint.actor), 403, 'PREVIEW_ACTOR_MISMATCH', 'The acting identity or role changed while this workflow was prepared.');
      const prior = cache(actor, key, checkpoint.digest); if (prior) return prior;
      const current = read(), at = clock();
      check(current.revision === expected && hash(current.state) === checkpoint.stateDigest, 409, 'REVISION_CONFLICT', 'The financial workspace changed while this workflow was prepared.');
      check(at.slice(0, 10) === checkpoint.at.slice(0, 10), 409, 'PREVIEW_DATE_CHANGED', 'The financial date changed during preparation. Prepare a new preview.');
      if (type === 'evidence-import') evidenceForInput(input);
      const row = { id: `preview-${randomUUID()}`, type, actor_id: actor.id, actor_role: actor.role, server_revision: expected, domain_revision: current.state.revision, created_at: at, expires_at: new Date(Date.parse(at) + PREVIEW_MS).toISOString(), status: 'prepared', evidence_id: type === 'evidence-import' ? input.evidenceId : null, analysis_version: type === 'evidence-import' ? input.analysisVersion : null };
      const inputJson = JSON.stringify(input), commandsJson = JSON.stringify(compiled.commands), planJson = JSON.stringify(compiled.plan);
      db.prepare('INSERT INTO workflow_previews VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(row.id, type, actor.id, actor.role, inputJson, hash(input), commandsJson, hash(compiled.commands), planJson, hash(compiled.plan), checkpoint.stateDigest, expected, current.state.revision, at, row.expires_at, 'prepared', null, null, null, row.evidence_id, row.analysis_version,'');
      sealPreview(row.id);
      bumpPreviewRevision();
      return storeResponse(actor, key, checkpoint.digest, previewResponse(row, compiled.plan), at);
    }));
  }

  async function commit(req, auth, input, url) {
    object(input, ['previewId', 'expectedRevision'], 'Workflow commit');
    const id = identifier(input.previewId, 'Preview ID'), expected = integer(input.expectedRevision, 'Expected server revision'); requestKey(req);
    const checkpoint = authorized(req, auth, active => transaction(() => {
      const actor = actorOf(active), preview = verifiedPreview(id); actorBinding(actor, preview.row);
      return { ...preview, current: read(), actor, at: clock() };
    }));
    // A consumed preview deliberately reaches the writer's replay cache without
    // recompilation. An exact retry must work after later writes and expiry.
    if (checkpoint.row.status === 'prepared') {
      check(checkpoint.row.server_revision === expected, 409, 'PREVIEW_BASIS_CHANGED', 'Use the server revision bound to the reviewed preview.');
      check(checkpoint.row.expires_at > checkpoint.at, 409, 'PREVIEW_EXPIRED', 'This preview expired. Prepare and review the workflow again.');
      check(checkpoint.current.revision === expected && hash(checkpoint.current.state) === checkpoint.row.workspace_digest, 409, 'REVISION_CONFLICT', 'The financial workspace changed after this preview. Prepare a new review.');
      await compile(checkpoint.row.type, checkpoint.current.state, checkpoint.input, checkpoint.actor, checkpoint.at);
    }
    const digest = hash({ operation: 'workflow-commit', input, actorRole: checkpoint.actor.role });
    return write(req, auth, input, null, url, {
      requestDigest: digest, responseKey: 'workflow',
      prepare(current, at, activeAuth = auth) {
        const actor = actorOf(activeAuth), fresh = verifiedPreview(id); actorBinding(actor, fresh.row);
        check(fresh.row.status === 'prepared', 409, fresh.row.status === 'consumed' ? 'PREVIEW_CONSUMED' : 'PREVIEW_DISCARDED', 'This preview is no longer available for a new execution. Retry the original idempotency key or prepare a new review.');
        check(fresh.row.expires_at > at, 409, 'PREVIEW_EXPIRED', 'This preview expired. Prepare and review the workflow again.');
        check(fresh.row.server_revision === expected && current.revision === expected && hash(current.state) === fresh.row.workspace_digest && hash(current.state) === hash(checkpoint.current.state), 409, 'REVISION_CONFLICT', 'The financial workspace changed after this preview.');
        check(at.slice(0, 10) === fresh.row.created_at.slice(0, 10) && at.slice(0, 10) === checkpoint.at.slice(0, 10), 409, 'PREVIEW_DATE_CHANGED', 'The financial date changed after this preview. Prepare a current review.');
        requireRole(actor, workflowRoles(fresh.row.type));
        if (fresh.row.type === 'evidence-import') evidenceForInput(fresh.input);
        else syncPlan(fresh.row.type, current.state, fresh.input, actor, at);
        // Re-reduce the ORIGINAL exact commands, not the compiler's new IDs.
        let state = current.state;
        for (const command of fresh.commands) state = adapter(() => engine.reduceWorkspace(state, command, { actor, now: at }).state);
        return fresh.commands.length === 1 ? fresh.commands[0] : { type: '__BATCH__', commands: fresh.commands };
      },
      afterWrite({ event, at, revision }) {
        const fresh = verifiedPreview(id);
        const changed = db.prepare("UPDATE workflow_previews SET status='consumed',consumed_at=?,consumed_revision=?,consumed_hash=? WHERE id=? AND status='prepared'").run(at, revision, event.hash, id);
        check(changed.changes === 1, 409, 'PREVIEW_CONSUMED', 'This preview was already consumed.');
        sealPreview(id);
        bumpPreviewRevision();
        if (fresh.row.evidence_id) db.prepare('INSERT INTO workflow_evidence_promotions VALUES(?,?,?,?,?,?,?)').run(id, fresh.row.evidence_id, fresh.row.analysis_version, fresh.plan.commitmentId, revision, event.hash, at);
        return { previewId: id, type: fresh.row.type, status: 'consumed', ...Object.fromEntries(['commitmentId', 'creditId', 'amendmentId', 'actionId', 'sourceId', 'alreadyTracked'].filter(key => fresh.plan[key] !== undefined).map(key => [key, fresh.plan[key]])), ...(fresh.row.evidence_id ? { evidenceId: fresh.row.evidence_id, analysisVersion: fresh.row.analysis_version } : {}), notice: NOTICE };
      },
    });
  }

  function discard(req, auth, input) {
    object(input, ['previewId'], 'Discard preview'); const id = identifier(input.previewId, 'Preview ID'), key = requestKey(req);
    return authorized(req, auth, active => transaction(() => {
      const actor = actorOf(active), digest = hash({ operation: 'discard-preview', input, actorRole: actor.role });
      const prior = cache(actor, key, digest); if (prior) return prior;
      const value = verifiedPreview(id); actorBinding(actor, value.row);
      check(value.row.status !== 'consumed', 409, 'PREVIEW_CONSUMED', 'An executed preview cannot be discarded.');
      const changed=db.prepare("UPDATE workflow_previews SET status='discarded' WHERE id=? AND status='prepared'").run(id);
      sealPreview(id);
      if(changed.changes)bumpPreviewRevision();
      return storeResponse(actor, key, digest, { previewId: id, status: 'discarded', notice: NOTICE }, clock());
    }));
  }
  function getPreview(auth,id) {
    const actor=actorOf(auth);id=identifier(id,'Preview ID');
    return transaction(()=>{
      const value=verifiedPreview(id);
      check(actor.role==='admin'||(actor.id===value.row.actor_id&&actor.role===value.row.actor_role),403,'PREVIEW_ACTOR_MISMATCH','Only the bound identity or a workspace admin may inspect this preview.');
      const current=read(),at=clock(),basisCurrent=current.revision===value.row.server_revision&&hash(current.state)===value.row.workspace_digest;
      const expired=value.row.expires_at<=at,dateCurrent=value.row.created_at.slice(0,10)===at.slice(0,10);
      let evidenceCurrent=true;
      if(value.row.evidence_id)evidenceCurrent=verifiedVersion(value.row.evidence_id,value.row.analysis_version).record.latest_version===value.row.analysis_version;
      return {...previewResponse(value.row,value.plan),currentRevision:current.revision,basisCurrent,evidenceCurrent,expired,availableForCommit:actor.id===value.row.actor_id&&actor.role===value.row.actor_role&&value.row.status==='prepared'&&basisCurrent&&evidenceCurrent&&!expired&&dateCurrent,consumedAt:value.row.consumed_at,consumedRevision:value.row.consumed_revision};
    });
  }
  function invalidatePrepared() {
    return transaction(()=>{
      const ids=db.prepare("SELECT id FROM workflow_previews WHERE status='prepared'").all();
      for(const {id} of ids){verifiedPreview(id);db.prepare("UPDATE workflow_previews SET status='discarded' WHERE id=?").run(id);sealPreview(id);}
      if(ids.length)bumpPreviewRevision();
      return ids.length;
    });
  }
  function listPreviews(auth,query=new URLSearchParams()) {
    const actor=actorOf(auth),values=query instanceof URLSearchParams?Object.fromEntries(query.entries()):query;
    object(values,['limit','cursor','status','type','actorId'],'Preview list query');
    const rawLimit=values.limit??'25';check(/^[1-9]\d*$/.test(String(rawLimit))&&Number(rawLimit)<=100,422,'WORKFLOW_VALIDATION','Preview page limit must be between1 and100.');
    const limit=Number(rawLimit),filters={status:values.status||'',type:values.type||'',actorId:values.actorId||actor.id};
    check(!filters.status||['prepared','consumed','discarded','expired','stale'].includes(filters.status),422,'WORKFLOW_VALIDATION','Choose a supported preview status.');
    check(!filters.type||TYPES.includes(filters.type),422,'WORKFLOW_TYPE','Choose a supported workflow type.');
    check(typeof filters.actorId==='string'&&filters.actorId.length<=200,422,'WORKFLOW_VALIDATION','Preview actor filter must be bounded text.');
    check(actor.role==='admin'||filters.actorId===actor.id,403,'FORBIDDEN','Only an admin may list previews for another actor.');
    check(values.cursor==null||(typeof values.cursor==='string'&&values.cursor.length<=4096),422,'CURSOR_INVALID','The preview cursor must be bounded text.');
    return transaction(()=>{
      const revision=db.prepare("SELECT revision FROM workflow_preview_metadata WHERE id='previews'").get().revision;
      const filterDigest=hash({...filters,readerId:actor.id,readerRole:actor.role});let offset=0,observedAt=clock();
      if(values.cursor){try{const cursor=JSON.parse(Buffer.from(values.cursor,'base64url').toString());object(cursor,['v','revision','filterDigest','offset','observedAt'],'Preview cursor');check(cursor.v===1&&Number.isSafeInteger(cursor.offset)&&cursor.offset>=0&&typeof cursor.observedAt==='string'&&Number.isFinite(Date.parse(cursor.observedAt)),422,'CURSOR_INVALID','The preview cursor is invalid.');check(cursor.revision===revision&&cursor.filterDigest===filterDigest,409,'CURSOR_STALE','Previews or filters changed. Restart the list.');offset=cursor.offset;observedAt=cursor.observedAt;}catch(error){if(error instanceof WorkflowError)throw error;fail(422,'CURSOR_INVALID','The preview cursor is invalid.');}}
      const current=read(),stateDigest=hash(current.state);
      const rows=db.prepare('SELECT id FROM workflow_previews ORDER BY created_at DESC,id').all().map(({id})=>verifiedPreview(id)).filter(value=>filters.actorId==='*'||value.row.actor_id===filters.actorId).filter(value=>!filters.type||value.row.type===filters.type);
      const projected=rows.map(value=>{
        const row=value.row,basisCurrent=row.server_revision===current.revision&&row.workspace_digest===stateDigest,expired=row.expires_at<=observedAt;
        const evidenceCurrent=!row.evidence_id||verifiedVersion(row.evidence_id,row.analysis_version).record.latest_version===row.analysis_version;
        const stale=!basisCurrent||!evidenceCurrent||row.created_at.slice(0,10)!==observedAt.slice(0,10);
        return {previewId:row.id,type:row.type,status:row.status,actor:{id:row.actor_id,role:row.actor_role},createdAt:row.created_at,expiresAt:row.expires_at,expectedRevision:row.server_revision,domainRevision:row.domain_revision,basisCurrent,evidenceCurrent,expired,stale,availableForCommit:actor.id===row.actor_id&&actor.role===row.actor_role&&row.status==='prepared'&&!stale&&!expired,...Object.fromEntries(['commitmentId','creditId','actionId','amendmentId'].filter(key=>value.plan[key]!==undefined).map(key=>[key,value.plan[key]])),...(row.evidence_id?{evidenceId:row.evidence_id,analysisVersion:row.analysis_version}:{})};
      }).filter(value=>!filters.status||(filters.status==='expired'?value.status==='prepared'&&value.expired:filters.status==='stale'?value.status==='prepared'&&value.stale:value.status===filters.status));
      const nextCursor=offset+limit<projected.length?Buffer.from(JSON.stringify({v:1,revision,filterDigest,offset:offset+limit,observedAt})).toString('base64url'):null;
      return {items:projected.slice(offset,offset+limit),nextCursor,previewRevision:revision,currentRevision:current.revision,observedAt,total:projected.length,limit,notice:NOTICE};
    });
  }
  function getEvidence(auth, id, options = {}) {
    actorOf(auth); identifier(id, 'Evidence ID'); object(options, ['analysisVersion'], 'Evidence version query');
    if (options.analysisVersion !== undefined) { integer(options.analysisVersion, 'Analysis version'); check(options.analysisVersion > 0, 422, 'WORKFLOW_VALIDATION', 'Analysis version must be positive.'); }
    return transaction(() => {
      const value = verifiedVersion(id, options.analysisVersion);
      const versions = db.prepare('SELECT version,created_at,status,label FROM workflow_evidence_versions WHERE evidence_id=? ORDER BY version DESC').all(id);
      const promotions = db.prepare('SELECT preview_id,analysis_version,commitment_id,server_revision,recorded_at FROM workflow_evidence_promotions WHERE evidence_id=? ORDER BY server_revision DESC').all(id);
      return { evidenceId: id, analysisVersion: value.row.version, latestAnalysisVersion: value.record.latest_version, createdAt: value.row.created_at, createdBy: JSON.parse(value.row.actor_json), label: value.row.label, status: value.row.status, input: value.input, documentsDigest: value.row.documents_digest, analysisDigest: value.row.analysis_digest, analysis: value.analysis, versions: versions.map(row => ({ analysisVersion: row.version, createdAt: row.created_at, status: row.status, label: row.label })), promotions: promotions.map(row => ({ previewId: row.preview_id, analysisVersion: row.analysis_version, commitmentId: row.commitment_id, revision: row.server_revision, recordedAt: row.recorded_at })), notice: NOTICE };
    });
  }
  function listEvidence(auth, query = new URLSearchParams()) {
    actorOf(auth);
    const values = query instanceof URLSearchParams ? Object.fromEntries(query.entries()) : query;
    object(values, ['limit', 'cursor', 'status', 'vendor', 'q'], 'Evidence list query');
    const rawLimit = values.limit ?? '25';
    check(/^[1-9]\d*$/.test(String(rawLimit)) && Number(rawLimit) <= 100, 422, 'WORKFLOW_VALIDATION', 'Evidence page limit must be between 1 and 100.');
    const limit = Number(rawLimit), filters = { status: values.status || '', vendor: values.vendor || '', q: values.q || '' };
    check(values.cursor==null||(typeof values.cursor==='string'&&values.cursor.length<=4096),422,'CURSOR_INVALID','The evidence cursor must be bounded text.');
    check(!filters.status || ['analyzed', 'needs_review'].includes(filters.status), 422, 'WORKFLOW_VALIDATION', 'Choose a supported evidence status.');
    for (const value of Object.values(filters)) check(typeof value === 'string' && value.length <= 200, 422, 'WORKFLOW_VALIDATION', 'Evidence filter text must be at most 200 characters.');
    return transaction(() => {
      const revision = metadataRevision(), filterDigest = hash(filters); let offset = 0;
      if (values.cursor) {
        try {
          const cursor = JSON.parse(Buffer.from(values.cursor, 'base64url').toString());
          object(cursor, ['v', 'revision', 'filterDigest', 'offset'], 'Evidence cursor');
          check(cursor.v === 1 && Number.isSafeInteger(cursor.offset) && cursor.offset >= 0, 422, 'CURSOR_INVALID', 'The evidence cursor is invalid.');
          check(cursor.revision === revision && cursor.filterDigest === filterDigest, 409, 'CURSOR_STALE', 'Evidence or filters changed. Restart the paginated list.'); offset = cursor.offset;
        } catch (error) { if (error instanceof WorkflowError) throw error; fail(422, 'CURSOR_INVALID', 'The evidence cursor is invalid.'); }
      }
      const records = db.prepare('SELECT e.id,e.latest_version,e.created_at,e.updated_at,e.updated_sequence,v.status,v.vendor,v.label,v.analysis_digest,v.documents_digest FROM workflow_evidence e JOIN workflow_evidence_versions v ON v.evidence_id=e.id AND v.version=e.latest_version ORDER BY e.updated_sequence DESC,e.id').all();
      const lower = value => value.normalize('NFC').toLowerCase();
      const filtered = records.filter(row => (!filters.status || row.status === filters.status) && (!filters.vendor || lower(row.vendor) === lower(filters.vendor)) && (!filters.q || lower(`${row.vendor} ${row.label} ${row.id}`).includes(lower(filters.q))));
      const items = filtered.slice(offset, offset + limit).map(row => ({ evidenceId: row.id, analysisVersion: row.latest_version, createdAt: row.created_at, updatedAt: row.updated_at, status: row.status, vendor: row.vendor, label: row.label, analysisDigest: row.analysis_digest, documentsDigest: row.documents_digest }));
      const nextCursor = offset + limit < filtered.length ? Buffer.from(JSON.stringify({ v: 1, revision, filterDigest, offset: offset + limit })).toString('base64url') : null;
      return { items, nextCursor, evidenceRevision: revision, total: filtered.length, limit, notice: NOTICE };
    });
  }
  function verifyIntegrity() {
    try {
      return transaction(() => {
        let versions = 0, previews = 0, promotions = 0, requests = 0;
        for (const record of db.prepare('SELECT * FROM workflow_evidence').all()) {
          const rows = db.prepare('SELECT version FROM workflow_evidence_versions WHERE evidence_id=? ORDER BY version').all(record.id);
          check(rows.length === record.latest_version && rows.every((row, index) => row.version === index + 1), 503, 'WORKFLOW_INTEGRITY', 'The evidence revision sequence changed.');
          for (const row of rows) { verifiedVersion(record.id, row.version); versions++; }
        }
        for (const row of db.prepare('SELECT id FROM workflow_previews').all()) {
          const value = verifiedPreview(row.id); previews++;
          if (value.row.status === 'consumed') {
            const stored = db.prepare('SELECT entry_json FROM audit WHERE sequence=?').get(value.row.consumed_revision);
            check(stored, 503, 'WORKFLOW_INTEGRITY', 'A consumed workflow has no financial audit anchor.');
            const event = JSON.parse(stored.entry_json), expected = value.commands.length === 1 ? value.commands[0] : { type: '__BATCH__', commands: value.commands };
            check(event.hash === value.row.consumed_hash && same(event.command, expected), 503, 'WORKFLOW_INTEGRITY', 'A consumed workflow differs from its financial audit command.');
          }
        }
        for (const promotion of db.prepare('SELECT * FROM workflow_evidence_promotions').all()) {
          const preview = verifiedPreview(promotion.preview_id);
          verifiedVersion(promotion.evidence_id, promotion.analysis_version);
          check(preview.row.status === 'consumed' && preview.row.evidence_id === promotion.evidence_id && preview.row.analysis_version === promotion.analysis_version && preview.row.consumed_revision === promotion.server_revision && preview.row.consumed_hash === promotion.audit_hash && preview.plan.commitmentId === promotion.commitment_id, 503, 'WORKFLOW_INTEGRITY', 'An evidence promotion differs from its consumed financial workflow.'); promotions++;
        }
        for (const request of db.prepare('SELECT * FROM workflow_requests').all()) { check(hash(request.response_json) === request.response_digest, 503, 'WORKFLOW_INTEGRITY', 'A stored workflow response changed.'); JSON.parse(request.response_json); requests++; }
        check(versions===metadataRevision(),503,'WORKFLOW_INTEGRITY','The evidence metadata revision differs from its immutable analyses.');
        return { valid: true, evidenceVersions: versions, previews, promotions, cachedRequests: requests, scope: 'Internal metadata checksums, deterministic analysis reproduction and financial audit linkage; not external authenticity.' };
      });
    } catch (error) { return { valid: false, reason: error.message, code: error.code || 'WORKFLOW_INTEGRITY' }; }
  }
  return { intake, preview, commit, discard, getPreview, listPreviews, listEvidence, getEvidence, invalidatePrepared, verifyIntegrity };
}
