// Truthful's deliberately small, custom profile. This is not AP2/UCP conformance.
export const GRANT_PROFILE = 'truthful-delegated-execution-v1';
export const REQUEST_PROFILE = 'truthful-agent-request-v1';
export const RECEIPT_PROFILE = 'truthful-execution-receipt-v1';
export const LIFECYCLE_PROFILE = 'truthful-authority-lifecycle-v1';
export const CHECKPOINT_PROFILE = 'truthful-authority-checkpoint-v1';
export const PACKET_FORMAT = 'truthful-authority-evidence-v1';
export const AUTHORITY_NOTICE = 'Custom Truthful Ed25519 profile; local demo identities and local simulated financial effects. Pinned-key signatures and replay verify recorded authorization and outcome, not source truth, current revocation, global unspentness, external settlement, or production identity.';
export { createMemoryAuthority } from './memory.mjs';
const encoder = new TextEncoder();
export class AuthorityError extends Error { constructor(code, message) { super(message); this.code = code; this.status = code === 'AUTHORITY_INVALID' ? 422 : ['FORBIDDEN','AUTHORITY_SIGNATURE','AUTHORITY_UNTRUSTED'].includes(code) ? 403 : 409; } }
export function assertAuthority(condition, message, code = 'AUTHORITY_INVALID') { if (!condition) throw new AuthorityError(code, message); }
export function canonical(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') { assertAuthority(Number.isSafeInteger(value), 'Only safe integer numbers are permitted in signed data.'); return JSON.stringify(value); }
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  assertAuthority(value && Object.getPrototypeOf(value) === Object.prototype, 'Signed data must contain JSON values.');
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
}
export function base64url(bytes) { let s = ''; for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b); return btoa(s).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, ''); }
export function unbase64url(value) { assertAuthority(typeof value === 'string' && /^[A-Za-z0-9_-]+$/.test(value), 'Invalid base64url.'); const s = atob(value.replaceAll('-', '+').replaceAll('_', '/')); const bytes = Uint8Array.from(s, c => c.charCodeAt(0)); assertAuthority(base64url(bytes) === value, 'Noncanonical base64url.'); return bytes; }
export const signingBytes = payload => encoder.encode(`TRUTHFUL-AUTHORITY\u0000${payload.profile}\u0000${canonical(payload)}`);
export async function digest(value) { return base64url(await crypto.subtle.digest('SHA-256', encoder.encode(canonical(value)))); }
export async function digestHex(value) { return Array.from(unbase64url(await digest(value)), b => b.toString(16).padStart(2, '0')).join(''); }
export const grantDigest = digest;
export function strictObject(value, keys, label) { assertAuthority(value && !Array.isArray(value) && typeof value === 'object', `${label} must be an object.`); assertAuthority(Object.keys(value).length === keys.length && Object.keys(value).every(key => keys.includes(key)), `${label} contains missing or unknown fields.`); }
export function publicKey(value) {
  assertAuthority(value && value.kty === 'OKP' && value.crv === 'Ed25519' && typeof value.x === 'string' && unbase64url(value.x).length === 32 && !value.d && Object.keys(value).every(k => ['kty', 'crv', 'x', 'ext', 'key_ops', 'alg'].includes(k)) && (!Object.hasOwn(value,'alg') || ['Ed25519','EdDSA'].includes(value.alg)) && (!Object.hasOwn(value,'ext') || typeof value.ext === 'boolean') && (!Object.hasOwn(value,'key_ops') || (Array.isArray(value.key_ops) && value.key_ops.length === 1 && value.key_ops[0] === 'verify')), 'An Ed25519 public JWK is required.');
  return { kty: 'OKP', crv: 'Ed25519', x: value.x };
}
const text = (value, label) => assertAuthority(typeof value === 'string' && value.length >= 1 && value.length <= 256 && !/[\u0000-\u001f]/.test(value), `${label} must be a bounded string.`);
const cents = (value, label) => assertAuthority(Number.isSafeInteger(value) && value >= 0, `${label} must be nonnegative safe integer cents.`);
const timestamp = (value, label) => { assertAuthority(typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value, `${label} must be a canonical UTC timestamp.`); return Date.parse(value); };
export const GRANT_FIELDS = ['profile','issuer','keyId','grantId','parentDigest','rootNonce','workspaceId','audience','action','actionId','commitmentId','vendorId','currency','agentPublicKey','approvalBasisDigest','approvalDigest','actionDigest','maxAmountCents','maxObligationCents','notBefore','expiresAt','caveats'];
export function validateGrant(payload) {
  strictObject(payload, GRANT_FIELDS, 'Grant');
  assertAuthority(payload.profile === GRANT_PROFILE && payload.action === 'EXECUTE_ACTION', 'Unsupported grant domain or action.');
  for (const key of ['issuer','keyId','grantId','rootNonce','workspaceId','audience','actionId','commitmentId','vendorId','approvalBasisDigest','approvalDigest','actionDigest']) text(payload[key], key);
  assertAuthority(payload.parentDigest === null || typeof payload.parentDigest === 'string', 'Invalid parent digest.');
  assertAuthority(/^[A-Z]{3}$/.test(payload.currency), 'Currency must be a three-letter uppercase code.'); publicKey(payload.agentPublicKey);
  cents(payload.maxAmountCents, 'Amount limit'); cents(payload.maxObligationCents, 'Obligation limit');
  assertAuthority(timestamp(payload.notBefore, 'notBefore') < timestamp(payload.expiresAt, 'expiresAt'), 'Grant validity window is empty.');
  assertAuthority(Array.isArray(payload.caveats) && payload.caveats.length === 0, 'Unknown caveats fail closed.'); return payload;
}
export function validateRequest(payload) {
  strictObject(payload, ['profile','workspaceId','audience','grantDigest','actionId','commitmentId','expectedRevision','commandId','nonce','issuedAt'], 'Agent request');
  assertAuthority(payload.profile === REQUEST_PROFILE, 'Unsupported request domain.');
  for (const key of ['workspaceId','audience','grantDigest','actionId','commitmentId','commandId','nonce']) text(payload[key], key);
  cents(payload.expectedRevision, 'Expected revision'); timestamp(payload.issuedAt, 'issuedAt'); return payload;
}
export function validateEnvelope(envelope) { strictObject(envelope, ['payload','signature'], 'Signed envelope'); assertAuthority(unbase64url(envelope.signature).length === 64, 'An Ed25519 signature is required.'); return envelope; }
export async function generateAgentKey() { const pair = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign','verify']); return { privateKey: pair.privateKey, publicKey: publicKey(await crypto.subtle.exportKey('jwk', pair.publicKey)) }; }
export async function signEnvelope(payload, privateKey) { canonical(payload); return { payload, signature: base64url(await crypto.subtle.sign('Ed25519', privateKey, signingBytes(payload))) }; }
export async function verifyEnvelope(envelope, key) { validateEnvelope(envelope); const imported = await crypto.subtle.importKey('jwk', publicKey(key), 'Ed25519', false, ['verify']); assertAuthority(await crypto.subtle.verify('Ed25519', imported, unbase64url(envelope.signature), signingBytes(envelope.payload)), 'Signature verification failed.', 'AUTHORITY_SIGNATURE'); return true; }
export async function signAgentRequest(payload, privateKey) { validateRequest(payload); return signEnvelope(payload, privateKey); }
export function assertAttenuation(parent, child) {
  validateGrant(parent); validateGrant(child);
  for (const key of GRANT_FIELDS.filter(k => !['grantId','parentDigest','agentPublicKey','maxAmountCents','maxObligationCents','notBefore','expiresAt'].includes(k))) assertAuthority(canonical(parent[key]) === canonical(child[key]), `Delegation cannot expand or alter ${key}.`);
  assertAuthority(child.grantId !== parent.grantId && child.maxAmountCents <= parent.maxAmountCents && child.maxObligationCents <= parent.maxObligationCents && Date.parse(child.notBefore) >= Date.parse(parent.notBefore) && Date.parse(child.expiresAt) <= Date.parse(parent.expiresAt), 'Delegation must only narrow authority.');
}
export async function delegateGrant(parent, changes, agentPrivateKey) { const payload = { ...parent.payload, ...changes, parentDigest: await digest(parent) }; assertAttenuation(parent.payload, payload); return signEnvelope(payload, agentPrivateKey); }
export async function verifyGrantChain(grants, { trustedIssuers, now, workspaceId, audience } = {}) {
  assertAuthority(Array.isArray(grants) && grants.length >= 1 && grants.length <= 4, 'Supply a root and at most three child grants.');
  const root = validateGrant(grants[0].payload);
  const trust = trustedIssuers?.find(item => item.issuer === root.issuer && item.keyId === root.keyId);
  assertAuthority(trust, 'Issuer is not in the independently supplied trust store.', 'AUTHORITY_UNTRUSTED');
  await verifyEnvelope(grants[0], trust.publicKey); assertAuthority(root.parentDigest === null, 'The root must have no parent.');
  for (let i = 1; i < grants.length; i++) { const parent = grants[i - 1], child = grants[i]; assertAttenuation(parent.payload, child.payload); assertAuthority(child.payload.parentDigest === await digest(parent), 'Parent grant binding differs.'); await verifyEnvelope(child, parent.payload.agentPublicKey); }
  const leaf = grants.at(-1).payload;
  if (now !== undefined) { const at = timestamp(now, 'Verification time'); for (const { payload } of grants) assertAuthority(at >= Date.parse(payload.notBefore) && at < Date.parse(payload.expiresAt), 'Grant is not active or has expired.', 'AUTHORITY_EXPIRED'); }
  if (workspaceId !== undefined) assertAuthority(leaf.workspaceId === workspaceId, 'Workspace binding differs.');
  if (audience !== undefined) assertAuthority(leaf.audience === audience, 'Audience binding differs.');
  return { root, leaf };
}
export async function verifyAgentAuthorization(grants, request, options) {
  const chain = await verifyGrantChain(grants, options); validateRequest(request.payload); await verifyEnvelope(request, chain.leaf.agentPublicKey);
  const p = request.payload, g = chain.leaf;
  assertAuthority(p.grantDigest === await digest(grants.at(-1)) && p.workspaceId === g.workspaceId && p.audience === g.audience && p.actionId === g.actionId && p.commitmentId === g.commitmentId, 'Request is not bound to this grant/action/workspace.');
  assertAuthority(Date.parse(p.issuedAt) >= Date.parse(g.notBefore) && Date.parse(p.issuedAt) < Date.parse(g.expiresAt), 'Request time is outside the grant window.');
  if (options?.now) assertAuthority(Date.parse(p.issuedAt) <= Date.parse(options.now) + 30000, 'Request time is in the future.');
  return chain;
}
export const actionContent = action => ({ id: action.id, type: action.type, commitmentId: action.commitmentId, payload: action.payload });
export const financialSnapshot = view => ({ totals: view.totals, commitments: view.commitments.map(c => ({ id: c.id, currency: c.currency, promisedCents: c.promisedCents, verifiedCents: c.verifiedCents, outstandingCents: c.outstandingCents, incrementalObligationCents: c.incrementalObligationCents })) });
export async function assertCurrentAuthority(state, grant, { engine, now } = {}) {
  const options = { asOf: now.slice(0,10), knownAt: now }, view = engine.evaluateWorkspace(state, options), action = view.actions.find(a => a.id === grant.actionId), commitment = view.commitments.find(c => c.id === grant.commitmentId);
  assertAuthority(action && commitment && action.commitmentId === grant.commitmentId && commitment.vendorId === grant.vendorId && commitment.currency === grant.currency, 'Current commitment/payee/currency binding differs.');
  assertAuthority(action.status === 'approved' && action.approval && !action.approvalStale && !action.proposalStale, 'Approval basis is stale or action is not approved.', 'STALE_APPROVAL');
  assertAuthority(await digest(action.approval.basis) === grant.approvalBasisDigest && await digest(action.approval) === grant.approvalDigest && await digest(actionContent(action)) === grant.actionDigest, 'Current approval or action differs.', 'STALE_APPROVAL');
  const simulation = engine.simulateAction(state, action, options);
  assertAuthority(simulation.policyDecision.allowed, 'Current policy blocks execution.', 'POLICY_BLOCKED');
  cents(simulation.amountCents, 'Actual amount'); const obligation = simulation.economics?.incrementalRenewalCostCents || 0; cents(obligation, 'Actual obligation');
  assertAuthority(simulation.amountCents <= grant.maxAmountCents && obligation <= grant.maxObligationCents, 'Current economics exceed delegated limits.');
  return { action, commitment, simulation, view };
}

export async function verifyAuthorityPacket(packet, { trustedIssuers, engine } = {}) {
  try {
    strictObject(packet, ['format','checkpoint','lifecycle','executions','notice'], 'Authority packet'); assertAuthority(packet.format === PACKET_FORMAT && packet.notice === AUTHORITY_NOTICE, 'Unsupported authority evidence format or scope notice.');
    engine ||= await import('../assurance/index.mjs');
    const checkpoint = packet.checkpoint.payload;
    strictObject(checkpoint, ['profile','issuer','keyId','workspaceId','audience','generatedAt','count','headDigest'], 'Authority checkpoint');
    timestamp(checkpoint.generatedAt, 'Checkpoint time'); cents(checkpoint.count, 'Lifecycle count');
    const trust = trustedIssuers?.find(t => t.issuer === checkpoint.issuer && t.keyId === checkpoint.keyId);
    assertAuthority(trust, 'Checkpoint issuer is not independently trusted.', 'AUTHORITY_UNTRUSTED'); await verifyEnvelope(packet.checkpoint, trust.publicKey);
    assertAuthority(checkpoint.profile === CHECKPOINT_PROFILE && packet.lifecycle.length === checkpoint.count, 'Checkpoint lifecycle count differs.');
    assertAuthority(Array.isArray(packet.lifecycle) && Array.isArray(packet.executions), 'Lifecycle and executions must be arrays.');
    let previousDigest = null, previousTime = null; const issued = new Map(), revoked = new Set(), issuedNonces = new Set(), used = new Set(), uses = [];
    for (const [i, entry] of packet.lifecycle.entries()) {
      await verifyEnvelope(entry, trust.publicKey); const p = entry.payload;
      strictObject(p, ['profile','issuer','keyId','workspaceId','audience','sequence','previousDigest','kind','at','detail'], 'Lifecycle entry');
      timestamp(p.at, 'Lifecycle time'); assertAuthority((previousTime === null || p.at >= previousTime) && p.at <= checkpoint.generatedAt, 'Lifecycle timestamps are out of order.'); previousTime = p.at;
      assertAuthority(p.profile === LIFECYCLE_PROFILE && p.issuer === checkpoint.issuer && p.keyId === checkpoint.keyId && p.workspaceId === checkpoint.workspaceId && p.audience === checkpoint.audience && p.sequence === i + 1 && p.previousDigest === previousDigest, 'Lifecycle order or identity differs.');
      if (p.kind === 'issued') { strictObject(p.detail, ['grant','actor'], 'Issuance evidence'); const g = p.detail.grant; await verifyGrantChain([g], { trustedIssuers, workspaceId: checkpoint.workspaceId, audience: checkpoint.audience }); assertAuthority(!issued.has(g.payload.grantId) && !issuedNonces.has(g.payload.rootNonce) && p.at < g.payload.expiresAt && ['admin','approver'].includes(p.detail.actor?.role), 'Duplicate, expired or unauthorized grant issuance.'); issued.set(g.payload.grantId, await digest(g)); issuedNonces.add(g.payload.rootNonce); }
      else if (p.kind === 'revoked') { strictObject(p.detail, ['grantId','reason','actor'], 'Revocation evidence'); assertAuthority(issued.has(p.detail.grantId) && !revoked.has(p.detail.grantId) && ['admin','approver'].includes(p.detail.actor?.role), 'Revocation precedes issuance, repeats or lacks authority.'); revoked.add(p.detail.grantId); }
      else if (p.kind === 'used') { strictObject(p.detail, ['grantId','rootNonce','rootGrantDigest','grantDigest','requestDigest','receiptDigest','revision'], 'Use evidence'); assertAuthority(issued.get(p.detail.grantId) === p.detail.rootGrantDigest && !revoked.has(p.detail.grantId) && !used.has(p.detail.rootNonce), 'Use is revoked, repeated or not issued.'); used.add(p.detail.rootNonce); uses.push(entry); }
      else assertAuthority(false, 'Unknown lifecycle event.'); previousDigest = await digest(entry);
    }
    assertAuthority(previousDigest === checkpoint.headDigest && packet.executions.length === uses.length, 'Lifecycle checkpoint or execution count differs.');
    for (const [i, execution] of packet.executions.entries()) {
      strictObject(execution, ['receipt','grants','request','beforeWorkspace','afterWorkspace','auditEvent'], 'Execution evidence');
      const r = execution.receipt.payload, event = uses[i].payload;
      strictObject(r, ['profile','issuer','keyId','receiptId','at','workspaceId','audience','rootNonce','grantDigests','requestDigest','command','actor','beforeRevision','afterRevision','beforeDigest','afterDigest','beforeFinancial','afterFinancial','result','auditHash'], 'Execution receipt');
      await verifyEnvelope(execution.receipt, trust.publicKey); assertAuthority(r.profile === RECEIPT_PROFILE && r.issuer === checkpoint.issuer && r.keyId === checkpoint.keyId, 'Invalid receipt identity/domain.');
      const { root, leaf } = await verifyAgentAuthorization(execution.grants, execution.request, { trustedIssuers, now: r.at, workspaceId: checkpoint.workspaceId, audience: checkpoint.audience });
      assertAuthority(r.workspaceId === checkpoint.workspaceId && r.audience === checkpoint.audience && r.rootNonce === root.rootNonce && r.at === event.at && event.detail.revision === r.afterRevision && event.detail.grantDigest === await digest(execution.grants.at(-1)) && event.detail.receiptDigest === await digest(execution.receipt) && event.detail.rootGrantDigest === await digest(execution.grants[0]) && event.detail.grantId === root.grantId && event.detail.rootNonce === root.rootNonce, 'Receipt lifecycle binding differs.');
      assertAuthority(canonical(r.grantDigests) === canonical(await Promise.all(execution.grants.map(digest))) && r.requestDigest === await digest(execution.request) && event.detail.requestDigest === r.requestDigest, 'Receipt request/grant binding differs.');
      assertAuthority(r.beforeDigest === await digest(execution.beforeWorkspace) && r.afterDigest === await digest(execution.afterWorkspace), 'Financial snapshot digest differs.');
      assertAuthority(r.beforeRevision === execution.request.payload.expectedRevision && r.afterRevision === r.beforeRevision + 1 && canonical(r.actor) === canonical({ id: `agent:${leaf.agentPublicKey.x}`, role:'executor', name:'Verified delegated agent' }) && canonical(r.command) === canonical({ id: execution.request.payload.commandId, type: 'EXECUTE_ACTION', actionId: leaf.actionId }), 'Receipt command, actor or revision differs.');
      await assertCurrentAuthority(execution.beforeWorkspace, leaf, { engine, now: r.at });
      assertAuthority(!execution.beforeWorkspace.events.some(e => e.commandId === r.command.id), 'Command ID was already used.');
      const replay = engine.reduceWorkspace(execution.beforeWorkspace, r.command, { actor: r.actor, now: r.at });
      assertAuthority(canonical(replay.state) === canonical(execution.afterWorkspace) && canonical(replay.result) === canonical(r.result), 'Financial effect replay differs.');
      assertAuthority(engine.validateWorkspace(execution.beforeWorkspace, { asOf: r.at.slice(0,10), knownAt: r.at }).valid && engine.validateWorkspace(replay.state, { asOf: r.at.slice(0,10), knownAt: r.at }).valid, 'Financial invariants fail.');
      assertAuthority(canonical(financialSnapshot(engine.evaluateWorkspace(execution.beforeWorkspace, { asOf: r.at.slice(0,10), knownAt: r.at }))) === canonical(r.beforeFinancial) && canonical(financialSnapshot(engine.evaluateWorkspace(replay.state, { asOf: r.at.slice(0,10), knownAt: r.at }))) === canonical(r.afterFinancial), 'Recorded economics differ.');
      const a = execution.auditEvent, { hash:aHash, ...unsignedAudit } = a;
      assertAuthority(aHash === await digestHex(unsignedAudit) && aHash === r.auditHash && a.sequence === r.afterRevision && a.beforeRevision === r.beforeRevision && a.afterRevision === r.afterRevision && a.beforeDigest === await digestHex(execution.beforeWorkspace) && a.afterDigest === await digestHex(execution.afterWorkspace) && canonical(a.command) === canonical(r.command) && canonical(a.actor) === canonical(r.actor) && canonical(a.result) === canonical(r.result) && a.at === r.at, 'Audit anchor differs.');
    }
    return { valid: true, executions: uses.length, lifecycleEntries: packet.lifecycle.length, generatedAt: checkpoint.generatedAt, scope: AUTHORITY_NOTICE };
  } catch (error) { return { valid: false, code: error.code || 'AUTHORITY_INVALID', reason: error.message }; }
}
