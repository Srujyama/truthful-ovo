import { GRANT_PROFILE, RECEIPT_PROFILE, LIFECYCLE_PROFILE, CHECKPOINT_PROFILE, PACKET_FORMAT, AUTHORITY_NOTICE, generateAgentKey, publicKey, digest, digestHex, canonical, signEnvelope, validateGrant, verifyAgentAuthorization, assertCurrentAuthority, actionContent, financialSnapshot, assertAuthority } from './index.mjs';
import * as defaultEngine from '../assurance/index.mjs';

// Isolated browser demonstration. Nothing here persists keys or reaches a vendor.
export async function createMemoryAuthority({ workspace, clock = () => new Date().toISOString(), issuer = `truthful-memory:${crypto.randomUUID()}`, audience = 'truthful-memory-execution', engine = defaultEngine } = {}) {
  assertAuthority(workspace, 'An isolated synthetic workspace is required.');
  let state = structuredClone(workspace), revision = 0, lifecycle = [], executions = [], audit = [], queue = Promise.resolve();
  const pair = await generateAgentKey(), keyId = `memory-${crypto.randomUUID()}`, workspaceId = `memory-workspace-${crypto.randomUUID()}`, fingerprint = await digest(pair.publicKey), roots = new Map(), idempotency = new Map();
  const now = () => new Date(clock()).toISOString(), opts = at => ({ asOf: at.slice(0,10), knownAt: at });
  const seal = payload => signEnvelope(payload, pair.privateKey), trust = [{ issuer, keyId, publicKey: pair.publicKey }];
  const info = () => ({ profile: GRANT_PROFILE, issuer, keyId, publicKey: pair.publicKey, fingerprint, workspaceId, audience, expectedRevision: revision, mode: 'isolated-memory', notice: AUTHORITY_NOTICE });
  const snapshot = () => ({ workspace: structuredClone(state), view: engine.evaluateWorkspace(state, opts(now())), revision });
  const serial = callback => { const result = queue.then(callback); queue = result.catch(() => {}); return result; };
  const append = async (kind, detail, at) => { const entry = await seal({ profile: LIFECYCLE_PROFILE, issuer, keyId, workspaceId, audience, sequence: lifecycle.length + 1, previousDigest: lifecycle.length ? await digest(lifecycle.at(-1)) : null, kind, at, detail }); lifecycle.push(entry); return entry; };
  const privilege = actor => assertAuthority(['admin','approver'].includes(actor?.role), 'A local demo approver/admin must issue or revoke authority.', 'FORBIDDEN');
  const issueGrant = (input, { actor } = {}) => serial(async () => {
    privilege(actor); assertAuthority(Object.keys(input).every(k => ['actionId','agentPublicKey','maxAmountCents','maxObligationCents','notBefore','expiresAt','expectedRevision'].includes(k)), 'Unknown issuance fields.'); assertAuthority(input.expectedRevision === revision, 'Workspace revision differs.', 'REVISION_CONFLICT');
    const at = now(), view = engine.evaluateWorkspace(state, opts(at)), action = view.actions.find(a => a.id === input.actionId), commitment = view.commitments.find(c => c.id === action?.commitmentId);
    assertAuthority(action && commitment && action.status === 'approved', 'An approved current action is required.', 'STALE_APPROVAL');
    const payload = { profile: GRANT_PROFILE, issuer, keyId, grantId: crypto.randomUUID(), parentDigest: null, rootNonce: crypto.randomUUID(), workspaceId, audience, action: 'EXECUTE_ACTION', actionId: action.id, commitmentId: commitment.id, vendorId: commitment.vendorId, currency: commitment.currency, agentPublicKey: publicKey(input.agentPublicKey), approvalBasisDigest: await digest(action.approval.basis), approvalDigest: await digest(action.approval), actionDigest: await digest(actionContent(action)), maxAmountCents: input.maxAmountCents, maxObligationCents: input.maxObligationCents, notBefore: input.notBefore, expiresAt: input.expiresAt, caveats: [] };
    validateGrant(payload); assertAuthority(Date.parse(payload.expiresAt) > Date.parse(at), 'Cannot issue expired authority.'); await assertCurrentAuthority(state, payload, { engine, now: at });
    const grant = await seal(payload); await append('issued', { grant, actor }, at); roots.set(payload.grantId, { grant, revokedAt: null, consumedAt: null }); return { grant, info: info(), expectedRevision: revision };
  });
  const revokeGrant = (input, { actor } = {}) => serial(async () => { privilege(actor); assertAuthority(Object.keys(input).every(k => ['grantId','reason'].includes(k)) && typeof input.reason === 'string' && input.reason.length > 0 && input.reason.length <= 500, 'Supply grant ID and reason.'); const root = roots.get(input.grantId); assertAuthority(root, 'Grant not found.'); const at = now(); if (!root.revokedAt) { await append('revoked', { grantId: input.grantId, reason: input.reason, actor }, at); root.revokedAt = at; } return { grantId: input.grantId, revokedAt: root.revokedAt, consumedAt: root.consumedAt, info: info() }; });
  const status = grantId => { const root = roots.get(grantId); return root ? { grantId, revokedAt: root.revokedAt, consumedAt: root.consumedAt, expiresAt: root.grant.payload.expiresAt } : { grantId, missing: true }; };
  const execute = ({ grants, request, idempotencyKey }) => serial(async () => {
    assertAuthority(typeof idempotencyKey === 'string' && /^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey), 'A durable request key is required.');
    const { root, leaf } = await verifyAgentAuthorization(grants, request, { trustedIssuers: trust, workspaceId, audience });
    const requestDigest = await digest({ grants, request }), cacheKey = `${leaf.agentPublicKey.x}:${idempotencyKey}`, cached = idempotency.get(cacheKey);
    if (cached) { assertAuthority(cached.requestDigest === requestDigest, 'Idempotency key conflicts with previous input.', 'IDEMPOTENCY_CONFLICT'); return structuredClone(cached.response); }
    const at = now(), registered = roots.get(root.grantId); assertAuthority(registered && await digest(registered.grant) === await digest(grants[0]), 'Grant was not issued by this authority.');
    assertAuthority(!registered.revokedAt && !registered.consumedAt, 'Grant is revoked or consumed.', registered.revokedAt ? 'AUTHORITY_REVOKED' : 'AUTHORITY_CONSUMED');
    for (const { payload } of grants) assertAuthority(Date.parse(at) >= Date.parse(payload.notBefore) && Date.parse(at) < Date.parse(payload.expiresAt), 'Grant expired or is not active.', 'AUTHORITY_EXPIRED');
    assertAuthority(Date.parse(request.payload.issuedAt) <= Date.parse(at) + 30000, 'Request is from the future.'); assertAuthority(request.payload.expectedRevision === revision, 'Workspace changed.', 'REVISION_CONFLICT');
    assertAuthority(!state.events.some(e => e.commandId === request.payload.commandId), 'Command ID cannot bypass one-use authority.', 'AUTHORITY_COMMAND_REPLAY'); await assertCurrentAuthority(state, leaf, { engine, now: at });
    const before = state, actor = { id: `agent:${leaf.agentPublicKey.x}`, role: 'executor', name: 'Verified delegated agent' }, command = { id: request.payload.commandId, type: 'EXECUTE_ACTION', actionId: leaf.actionId };
    const reduced = engine.reduceWorkspace(before, command, { actor, now: at }), beforeDigest = await digest(before), afterDigest = await digest(reduced.state);
    const unsigned = { sequence: revision + 1, at, actor, command, beforeRevision: revision, afterRevision: revision + 1, beforeDigest:await digestHex(before), afterDigest:await digestHex(reduced.state), previousHash: audit.at(-1)?.hash || null, result: reduced.result };
    const event = { ...unsigned, hash: await digestHex(unsigned) };
    const receipt = await seal({ profile: RECEIPT_PROFILE, issuer, keyId, receiptId: crypto.randomUUID(), at, workspaceId, audience, rootNonce: root.rootNonce, grantDigests: await Promise.all(grants.map(digest)), requestDigest: await digest(request), command, actor, beforeRevision: revision, afterRevision: revision + 1, beforeDigest, afterDigest, beforeFinancial: financialSnapshot(engine.evaluateWorkspace(before, opts(at))), afterFinancial: financialSnapshot(engine.evaluateWorkspace(reduced.state, opts(at))), result: reduced.result, auditHash: event.hash });
    await append('used', { grantId: root.grantId, rootNonce: root.rootNonce, rootGrantDigest: await digest(grants[0]), grantDigest: await digest(grants.at(-1)), requestDigest: await digest(request), receiptDigest: await digest(receipt), revision: revision + 1 }, at);
    executions.push({ receipt, grants, request, beforeWorkspace: before, afterWorkspace: reduced.state, auditEvent: event }); state = reduced.state; revision++; audit.push(event); registered.consumedAt = at;
    const response = { ...snapshot(), result: reduced.result, audit: { sequence: event.sequence, hash: event.hash }, authority: { receipt, grantStatus: status(root.grantId), info: info() } }; idempotency.set(cacheKey, { requestDigest, response: structuredClone(response) }); return response;
  });
  const command = (command, { actor } = {}) => serial(async () => { const reduced = engine.reduceWorkspace(state, command, { actor, now: now() }); state = reduced.state; revision++; return { ...snapshot(), result: reduced.result }; });
  const exportPacket = () => serial(async () => ({ format: PACKET_FORMAT, checkpoint: await seal({ profile: CHECKPOINT_PROFILE, issuer, keyId, workspaceId, audience, generatedAt: now(), count: lifecycle.length, headDigest: lifecycle.length ? await digest(lifecycle.at(-1)) : null }), lifecycle: structuredClone(lifecycle), executions: structuredClone(executions), notice: AUTHORITY_NOTICE }));
  return { info, issueGrant, revokeGrant, execute, exportPacket, snapshot, command, status, get workspace() { return structuredClone(state); } };
}
