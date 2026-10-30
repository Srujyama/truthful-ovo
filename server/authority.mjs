import { createHash, generateKeyPairSync, createPrivateKey, sign, randomUUID } from 'node:crypto';
import { AUTHORITY_NOTICE, GRANT_PROFILE, RECEIPT_PROFILE, LIFECYCLE_PROFILE, CHECKPOINT_PROFILE, PACKET_FORMAT, canonical, publicKey, signingBytes, base64url, assertAuthority, validateGrant, verifyAgentAuthorization, actionContent, financialSnapshot } from '../src/authority/index.mjs';

const digest = value => createHash('sha256').update(canonical(value)).digest('base64url');
const snapshotOptions = at => ({ asOf: at.slice(0,10), knownAt: at });
export function createAuthorityManager({ db, now, engine, read, requireIntegrity, write }) {
  db.exec(`CREATE TABLE IF NOT EXISTS authority_config (id INTEGER PRIMARY KEY CHECK(id=1), config_json TEXT NOT NULL) STRICT;
    CREATE TABLE IF NOT EXISTS authority_grants (grant_id TEXT PRIMARY KEY, grant_json TEXT NOT NULL, root_nonce TEXT UNIQUE NOT NULL, revoked_at TEXT, consumed_at TEXT) STRICT;
    CREATE TABLE IF NOT EXISTS authority_lifecycle (sequence INTEGER PRIMARY KEY, entry_json TEXT NOT NULL) STRICT;
    CREATE TABLE IF NOT EXISTS authority_executions (sequence INTEGER PRIMARY KEY, evidence_json TEXT NOT NULL) STRICT;
    CREATE TABLE IF NOT EXISTS authority_requests (actor_id TEXT NOT NULL, request_key TEXT NOT NULL, request_digest TEXT NOT NULL, response_json TEXT NOT NULL, PRIMARY KEY(actor_id,request_key)) STRICT;`);
  if (!db.prepare('SELECT * FROM authority_config WHERE id=1').get()) {
    const pair = generateKeyPairSync('ed25519');
    db.prepare('INSERT INTO authority_config VALUES(1,?)').run(JSON.stringify({ issuer: `truthful-local:${randomUUID()}`, keyId: `issuer-${randomUUID()}`, workspaceId: `workspace-${randomUUID()}`, audience: 'truthful-local-execution', privateKey: pair.privateKey.export({ format: 'jwk' }), publicKey: publicKey(pair.publicKey.export({ format: 'jwk' })) }));
  }
  const config = JSON.parse(db.prepare('SELECT config_json FROM authority_config WHERE id=1').get().config_json), privateKey = createPrivateKey({ key: config.privateKey, format: 'jwk' });
  const seal = payload => ({ payload, signature: base64url(sign(null, signingBytes(payload), privateKey)) });
  const info = () => ({ profile: GRANT_PROFILE, issuer: config.issuer, keyId: config.keyId, publicKey: config.publicKey, fingerprint: digest(config.publicKey), workspaceId: config.workspaceId, audience: config.audience, expectedRevision: read().revision, mode: 'local-sqlite', notice: AUTHORITY_NOTICE });
  const trust = [{ issuer: config.issuer, keyId: config.keyId, publicKey: config.publicKey }];
  const events = () => db.prepare('SELECT entry_json FROM authority_lifecycle ORDER BY sequence').all().map(r => JSON.parse(r.entry_json));
  const append = (kind, detail, at = now()) => { const history = events(); const event = seal({ profile: LIFECYCLE_PROFILE, issuer: config.issuer, keyId: config.keyId, workspaceId: config.workspaceId, audience: config.audience, sequence: history.length + 1, previousDigest: history.length ? digest(history.at(-1)) : null, kind, at, detail }); db.prepare('INSERT INTO authority_lifecycle VALUES(?,?)').run(event.payload.sequence, JSON.stringify(event)); return event; };
  const privileged = actor => assertAuthority(['admin','approver'].includes(actor?.role), 'Only a demo approver or administrator may issue/revoke authority.', 'FORBIDDEN');
  const keyRequired = key => assertAuthority(typeof key === 'string' && /^[A-Za-z0-9._:-]{8,128}$/.test(key), 'An 8–128 character Idempotency-Key is required.');
  const mutate = (kind, input, actor, key, callback) => { privileged(actor); keyRequired(key); const requestDigest = digest({ kind, input }); db.exec('BEGIN IMMEDIATE'); try { requireIntegrity(); const cached = db.prepare('SELECT * FROM authority_requests WHERE actor_id=? AND request_key=?').get(actor.id, key); if (cached) { assertAuthority(cached.request_digest === requestDigest, 'Idempotency key was used for different authority input.', 'IDEMPOTENCY_CONFLICT'); db.exec('COMMIT'); return JSON.parse(cached.response_json); } const result = callback(); db.prepare('INSERT INTO authority_requests VALUES(?,?,?,?)').run(actor.id, key, requestDigest, JSON.stringify(result)); db.exec('COMMIT'); return result; } catch (error) { db.exec('ROLLBACK'); throw error; } };
  const checkedAction = (state, grant, at) => {
    const opts = snapshotOptions(at), view = engine.evaluateWorkspace(state, opts), action = view.actions.find(a => a.id === grant.actionId), commitment = view.commitments.find(c => c.id === grant.commitmentId);
    assertAuthority(action && commitment && action.commitmentId === grant.commitmentId && commitment.vendorId === grant.vendorId && commitment.currency === grant.currency, 'Commitment, vendor or currency differs.');
    assertAuthority(action.status === 'approved' && action.approval && !action.proposalStale && !action.approvalStale, 'Approval is stale or action is not approved.', 'STALE_APPROVAL');
    assertAuthority(digest(action.approval.basis) === grant.approvalBasisDigest && digest(action.approval) === grant.approvalDigest && digest(actionContent(action)) === grant.actionDigest, 'Approval event, basis or action differs.', 'STALE_APPROVAL');
    const simulation = engine.simulateAction(state, action, opts), obligation = simulation.economics?.incrementalRenewalCostCents || 0;
    assertAuthority(simulation.policyDecision.allowed, 'Current policy rejects this action.', 'POLICY_BLOCKED');
    assertAuthority(Number.isSafeInteger(simulation.amountCents) && simulation.amountCents >= 0 && Number.isSafeInteger(obligation) && obligation >= 0 && simulation.amountCents <= grant.maxAmountCents && obligation <= grant.maxObligationCents, 'Current amount or obligation exceeds delegated limits.');
    return { action, commitment, simulation };
  };
  const issueGrant = (input, { actor, idempotencyKey } = {}) => mutate('issue', input, actor, idempotencyKey, () => {
    const permitted = ['actionId','agentPublicKey','maxAmountCents','maxObligationCents','notBefore','expiresAt','expectedRevision']; assertAuthority(Object.keys(input).every(k => permitted.includes(k)), 'Unknown issuance fields.');
    const row = read(), at = now(); assertAuthority(input.expectedRevision === row.revision, 'Refresh the current revision before issuing authority.', 'REVISION_CONFLICT');
    const view = engine.evaluateWorkspace(row.state, snapshotOptions(at)), action = view.actions.find(a => a.id === input.actionId), commitment = view.commitments.find(c => c.id === action?.commitmentId);
    assertAuthority(action && commitment && action.status === 'approved', 'An approved current action is required.', 'STALE_APPROVAL');
    const payload = { profile: GRANT_PROFILE, issuer: config.issuer, keyId: config.keyId, grantId: randomUUID(), parentDigest: null, rootNonce: randomUUID(), workspaceId: config.workspaceId, audience: config.audience, action: 'EXECUTE_ACTION', actionId: action.id, commitmentId: commitment.id, vendorId: commitment.vendorId, currency: commitment.currency, agentPublicKey: publicKey(input.agentPublicKey), approvalBasisDigest: digest(action.approval.basis), approvalDigest: digest(action.approval), actionDigest: digest(actionContent(action)), maxAmountCents: input.maxAmountCents, maxObligationCents: input.maxObligationCents, notBefore: input.notBefore, expiresAt: input.expiresAt, caveats: [] };
    validateGrant(payload); assertAuthority(Date.parse(payload.expiresAt) > Date.parse(at), 'Cannot issue an already expired grant.'); checkedAction(row.state, payload, at);
    const grant = seal(payload); db.prepare('INSERT INTO authority_grants VALUES(?,?,?,NULL,NULL)').run(payload.grantId, JSON.stringify(grant), payload.rootNonce); append('issued', { grant, actor }, at); return { grant, info: info(), expectedRevision: row.revision };
  });
  const revokeGrant = (input, { actor, idempotencyKey } = {}) => mutate('revoke', input, actor, idempotencyKey, () => {
    assertAuthority(Object.keys(input).every(k => ['grantId','reason'].includes(k)) && typeof input.reason === 'string' && input.reason.length > 0 && input.reason.length <= 500, 'Supply a grant and bounded revocation reason.');
    const grant = db.prepare('SELECT * FROM authority_grants WHERE grant_id=?').get(input.grantId); assertAuthority(grant, 'Grant not found.'); const at = now();
    if (!grant.revoked_at) { db.prepare('UPDATE authority_grants SET revoked_at=? WHERE grant_id=?').run(at, input.grantId); append('revoked', { grantId: input.grantId, reason: input.reason, actor }, at); }
    return { grantId: input.grantId, revokedAt: grant.revoked_at || at, consumedAt: grant.consumed_at, info: info() };
  });
  const status = grantId => { const row = db.prepare('SELECT * FROM authority_grants WHERE grant_id=?').get(grantId); return row ? { grantId, revokedAt: row.revoked_at, consumedAt: row.consumed_at, expiresAt: JSON.parse(row.grant_json).payload.expiresAt } : { grantId, missing: true }; };
  const revokeOutstandingForReset = (at, actor) => {
    assertAuthority(db.isTransaction, 'Reset invalidation requires the financial write transaction.');
    for (const row of db.prepare('SELECT grant_id FROM authority_grants WHERE revoked_at IS NULL AND consumed_at IS NULL ORDER BY grant_id').all()) {
      db.prepare('UPDATE authority_grants SET revoked_at=? WHERE grant_id=?').run(at, row.grant_id);
      append('revoked', { grantId: row.grant_id, reason: 'Demo workspace reset discarded the approval context; outstanding authority is permanently invalidated.', actor }, at);
    }
  };
  const execute = async (req, data, url) => {
    assertAuthority(Object.keys(data).length === 2 && Object.keys(data).every(k => ['grants','request'].includes(k)), 'Signed execution accepts only grants and request.');
    const verified = await verifyAgentAuthorization(data.grants, data.request, { trustedIssuers: trust, workspaceId: config.workspaceId, audience: config.audience });
    const request = data.request.payload, actor = { id: `agent:${verified.leaf.agentPublicKey.x}`, role: 'executor', name: 'Verified delegated agent' };
    const command = { id: request.commandId, type: 'EXECUTE_ACTION', actionId: request.actionId };
    return write(req, { actor }, { expectedRevision: request.expectedRevision }, command, url, {
      requestDigest: digest(data),
      authorize(current, at) {
        // All live status, scope, economic and basis checks run under the SAME
        // BEGIN IMMEDIATE transaction as the domain effect and nonce consumption.
        for (const { payload } of data.grants) assertAuthority(Date.parse(at) >= Date.parse(payload.notBefore) && Date.parse(at) < Date.parse(payload.expiresAt), 'Grant is inactive or expired.', 'AUTHORITY_EXPIRED');
        assertAuthority(Date.parse(request.issuedAt) <= Date.parse(at) + 30000, 'Agent request is from the future.');
        const stored = db.prepare('SELECT * FROM authority_grants WHERE grant_id=?').get(verified.root.grantId);
        assertAuthority(stored && digest(JSON.parse(stored.grant_json)) === digest(data.grants[0]), 'Grant was not issued by this workspace.');
        assertAuthority(!stored.revoked_at && !stored.consumed_at, 'Authority is revoked or its root nonce was already consumed.', stored.revoked_at ? 'AUTHORITY_REVOKED' : 'AUTHORITY_CONSUMED');
        assertAuthority(!current.state.events.some(e => e.commandId === command.id), 'A command ID cannot bypass one-use authority.', 'AUTHORITY_COMMAND_REPLAY'); checkedAction(current.state, verified.leaf, at);
      },
      afterWrite({ current, reduced, event, at, revision }) {
        const changed = db.prepare('UPDATE authority_grants SET consumed_at=? WHERE grant_id=? AND consumed_at IS NULL AND revoked_at IS NULL').run(at, verified.root.grantId); assertAuthority(changed.changes === 1, 'Authority was consumed concurrently.');
        const receipt = seal({ profile: RECEIPT_PROFILE, issuer: config.issuer, keyId: config.keyId, receiptId: randomUUID(), at, workspaceId: config.workspaceId, audience: config.audience, rootNonce: verified.root.rootNonce, grantDigests: data.grants.map(digest), requestDigest: digest(data.request), command, actor, beforeRevision: current.revision, afterRevision: revision, beforeDigest: digest(current.state), afterDigest: digest(reduced.state), beforeFinancial: financialSnapshot(engine.evaluateWorkspace(current.state, snapshotOptions(at))), afterFinancial: financialSnapshot(engine.evaluateWorkspace(reduced.state, snapshotOptions(at))), result: reduced.result, auditHash: event.hash });
        const lifecycle = append('used', { grantId: verified.root.grantId, rootNonce: verified.root.rootNonce, rootGrantDigest: digest(data.grants[0]), grantDigest: digest(data.grants.at(-1)), requestDigest: digest(data.request), receiptDigest: digest(receipt), revision }, at);
        db.prepare('INSERT INTO authority_executions VALUES(?,?)').run(lifecycle.payload.sequence, JSON.stringify({ receipt, grants: data.grants, request: data.request, beforeWorkspace: current.state, afterWorkspace: reduced.state, auditEvent: event }));
        return { receipt, grantStatus: status(verified.root.grantId), info: info() };
      },
    });
  };
  const exportPacket = () => { const lifecycle = events(); return { format: PACKET_FORMAT, checkpoint: seal({ profile: CHECKPOINT_PROFILE, issuer: config.issuer, keyId: config.keyId, workspaceId: config.workspaceId, audience: config.audience, generatedAt: now(), count: lifecycle.length, headDigest: lifecycle.length ? digest(lifecycle.at(-1)) : null }), lifecycle, executions: db.prepare('SELECT evidence_json FROM authority_executions ORDER BY sequence').all().map(r => JSON.parse(r.evidence_json)), notice: AUTHORITY_NOTICE }; };
  return { info, issueGrant, revokeGrant, execute, status, exportPacket, revokeOutstandingForReset };
}
