import { createHash, generateKeyPairSync, createPrivateKey, createPublicKey, sign, verify, randomUUID } from 'node:crypto';
import { AUTHORITY_NOTICE, GRANT_PROFILE, RECEIPT_PROFILE, LIFECYCLE_PROFILE, CHECKPOINT_PROFILE, PACKET_FORMAT, canonical, publicKey, signingBytes, base64url, unbase64url, assertAuthority, validateGrant, validateRequest, validateEnvelope, strictObject, assertAttenuation, verifyAgentAuthorization, actionContent, financialSnapshot } from '../src/authority/index.mjs';

const digest = value => createHash('sha256').update(canonical(value)).digest('base64url');
const hexDigest = value => createHash('sha256').update(canonical(value)).digest('hex');
const CACHE_PROFILE = 'truthful-authority-request-cache-v1';
const integrityError = (message, details) => Object.assign(new Error(message),{status:503,code:'INTEGRITY_FAILURE',details});
const check = (condition, message) => { if (!condition) throw new Error(message); };
const same = (a,b) => canonical(a) === canonical(b);
const instant = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const noPrivateMaterial = value => {
  if (!value || typeof value !== 'object') return;
  check(!Object.hasOwn(value,'privateKey') && !(value.kty === 'OKP' && Object.hasOwn(value,'d')),'A public authority result contains private signing material.');
  for (const item of Object.values(value)) noPrivateMaterial(item);
};
const snapshotOptions = at => ({ asOf: at.slice(0,10), knownAt: at });
export function createAuthorityManager({ db, now, engine, read, requireIntegrity, write }) {
  db.exec(`CREATE TABLE IF NOT EXISTS authority_config (id INTEGER PRIMARY KEY CHECK(id=1), config_json TEXT NOT NULL) STRICT;
    CREATE TABLE IF NOT EXISTS authority_grants (grant_id TEXT PRIMARY KEY, grant_json TEXT NOT NULL, root_nonce TEXT UNIQUE NOT NULL, revoked_at TEXT, consumed_at TEXT) STRICT;
    CREATE TABLE IF NOT EXISTS authority_lifecycle (sequence INTEGER PRIMARY KEY, entry_json TEXT NOT NULL) STRICT;
    CREATE TABLE IF NOT EXISTS authority_executions (sequence INTEGER PRIMARY KEY, evidence_json TEXT NOT NULL) STRICT;
    CREATE TABLE IF NOT EXISTS authority_requests (actor_id TEXT NOT NULL, request_key TEXT NOT NULL, request_digest TEXT NOT NULL, response_json TEXT NOT NULL, PRIMARY KEY(actor_id,request_key)) STRICT;
    CREATE TABLE IF NOT EXISTS authority_cache_seals (actor_id TEXT NOT NULL, request_key TEXT NOT NULL, anchor_json TEXT NOT NULL, PRIMARY KEY(actor_id,request_key)) STRICT;
    CREATE TABLE IF NOT EXISTS authority_cache_baseline (id INTEGER PRIMARY KEY CHECK(id=1), baseline_json TEXT NOT NULL) STRICT;
    CREATE TABLE IF NOT EXISTS authority_cache_checkpoint (id INTEGER PRIMARY KEY CHECK(id=1), checkpoint_json TEXT NOT NULL) STRICT;`);
  if (!db.prepare('SELECT * FROM authority_config WHERE id=1').get()) {
    const pair = generateKeyPairSync('ed25519');
    db.prepare('INSERT INTO authority_config VALUES(1,?)').run(JSON.stringify({ issuer: `truthful-local:${randomUUID()}`, keyId: `issuer-${randomUUID()}`, workspaceId: `workspace-${randomUUID()}`, audience: 'truthful-local-execution', privateKey: pair.privateKey.export({ format: 'jwk' }), publicKey: publicKey(pair.publicKey.export({ format: 'jwk' })) }));
  }
  let config, privateKey;
  try { config = JSON.parse(db.prepare('SELECT config_json FROM authority_config WHERE id=1').get().config_json); privateKey = createPrivateKey({ key: config.privateKey, format: 'jwk' }); }
  catch { throw integrityError('Stored authority issuer configuration is invalid. Preserve the database for inspection.'); }
  const seal = payload => ({ payload, signature: base64url(sign(null, signingBytes(payload), privateKey)) });
  const infoUnchecked = () => ({ profile: GRANT_PROFILE, issuer: config.issuer, keyId: config.keyId, publicKey: config.publicKey, fingerprint: digest(config.publicKey), workspaceId: config.workspaceId, audience: config.audience, expectedRevision: read().revision, mode: 'local-sqlite', notice: AUTHORITY_NOTICE });
  const trust = [{ issuer: config.issuer, keyId: config.keyId, publicKey: config.publicKey }];
  const events = () => db.prepare('SELECT entry_json FROM authority_lifecycle ORDER BY sequence').all().map(r => JSON.parse(r.entry_json));
  const cacheRows = () => db.prepare('SELECT rowid AS cache_order,* FROM authority_requests ORDER BY rowid').all();
  const sealCache = row => seal({profile:CACHE_PROFILE,issuer:config.issuer,keyId:config.keyId,workspaceId:config.workspaceId,audience:config.audience,actorId:row.actor_id,requestKey:row.request_key,requestDigest:row.request_digest,responseDigest:digest(JSON.parse(row.response_json))});
  const checkpointCaches = () => {
    const seals=db.prepare('SELECT actor_id,request_key,anchor_json FROM authority_cache_seals ORDER BY actor_id,request_key').all().map(row=>({...row}));
    const checkpoint=seal({profile:'truthful-authority-cache-checkpoint-v1',issuer:config.issuer,keyId:config.keyId,workspaceId:config.workspaceId,audience:config.audience,count:seals.length,sealsDigest:digest(seals)});
    db.prepare('INSERT OR REPLACE INTO authority_cache_checkpoint VALUES(1,?)').run(JSON.stringify(checkpoint));
  };
  const signed = (envelope, key=config.publicKey) => {
    validateEnvelope(envelope);
    check(verify(null,signingBytes(envelope.payload),createPublicKey({key:publicKey(key),format:'jwk'}),unbase64url(envelope.signature)),'A stored authority signature is invalid.');
  };
  const identityMatches = p => p.issuer===config.issuer && p.keyId===config.keyId && p.workspaceId===config.workspaceId && p.audience===config.audience;
  let verifiedCache = null;
  const cacheKey = () => `${db.prepare('PRAGMA data_version').get().data_version}:${db.prepare('SELECT total_changes() AS n').get().n}:${db.isTransaction?1:0}`;
  function verifyIntegrity({force=false,allowLegacyUnsealed=false}={}) {
    const key=cacheKey();
    if(!force && !allowLegacyUnsealed && verifiedCache?.key===key)return verifiedCache.result;
    try {
      check(same(JSON.parse(db.prepare('SELECT config_json FROM authority_config WHERE id=1').get()?.config_json),config),'Issuer configuration changed after startup.');
      check(same(publicKey(createPublicKey(privateKey).export({format:'jwk'})),publicKey(config.publicKey)),'Issuer public and private keys differ.');
      for(const name of ['issuer','keyId','workspaceId','audience'])check(typeof config[name]==='string'&&config[name].length>0,'Issuer configuration identity is invalid.');
      const grants=new Map(),nonces=new Set(),uses=new Map(),revocations=new Map(),issuances=new Map();
      let previousDigest=null,previousAt=null;
      const lifecycle=db.prepare('SELECT sequence,entry_json FROM authority_lifecycle ORDER BY sequence').all();
      for(const [index,row] of lifecycle.entries()) {
        const entry=JSON.parse(row.entry_json),p=entry.payload;signed(entry);
        strictObject(p,['profile','issuer','keyId','workspaceId','audience','sequence','previousDigest','kind','at','detail'],'Stored lifecycle');
        check(p.profile===LIFECYCLE_PROFILE&&identityMatches(p)&&p.sequence===index+1&&row.sequence===p.sequence&&p.previousDigest===previousDigest,'Lifecycle sequence, scope or digest differs.');
        check(instant(p.at)&&(!previousAt||p.at>=previousAt),'Lifecycle observation order is invalid.');
        if(p.kind==='issued') {
          strictObject(p.detail,['grant','actor'],'Stored issuance');const grant=p.detail.grant,g=validateGrant(grant.payload);signed(grant);
          check(identityMatches(g)&&g.parentDigest===null&&!grants.has(g.grantId)&&!nonces.has(g.rootNonce)&&p.at<g.expiresAt&&['admin','approver'].includes(p.detail.actor?.role),'Stored grant issuance is repeated, expired or unauthorized.');
          grants.set(g.grantId,grant);nonces.add(g.rootNonce);issuances.set(g.grantId,p);
        } else if(p.kind==='revoked') {
          strictObject(p.detail,['grantId','reason','actor'],'Stored revocation');
          check(grants.has(p.detail.grantId)&&!revocations.has(p.detail.grantId)&&['admin','approver'].includes(p.detail.actor?.role)&&typeof p.detail.reason==='string'&&p.detail.reason.length>0,'Stored revocation is inconsistent.');
          revocations.set(p.detail.grantId,p);
        } else if(p.kind==='used') {
          strictObject(p.detail,['grantId','rootNonce','rootGrantDigest','grantDigest','requestDigest','receiptDigest','revision'],'Stored use');
          const grant=grants.get(p.detail.grantId);
          check(grant&&!revocations.has(p.detail.grantId)&&!uses.has(p.detail.grantId)&&p.detail.rootNonce===grant.payload.rootNonce&&p.detail.rootGrantDigest===digest(grant),'Stored root use is repeated, revoked or not issued.');
          uses.set(p.detail.grantId,p);
        } else throw new Error('Unknown stored authority lifecycle event.');
        previousDigest=digest(entry);previousAt=p.at;
      }
      const storedGrants=db.prepare('SELECT * FROM authority_grants ORDER BY grant_id').all();
      check(storedGrants.length===grants.size,'Grant registry and signed issuance count differ.');
      for(const row of storedGrants) {
        const grant=grants.get(row.grant_id);
        check(grant&&same(JSON.parse(row.grant_json),grant)&&row.root_nonce===grant.payload.rootNonce,'Grant registry differs from its signed issuance.');
        check(row.revoked_at===(revocations.get(row.grant_id)?.at||null)&&row.consumed_at===(uses.get(row.grant_id)?.at||null),'Mutable grant status differs from signed lifecycle evidence.');
      }
      const executions=db.prepare('SELECT sequence,evidence_json FROM authority_executions ORDER BY sequence').all();
      check(executions.length===uses.size,'Execution evidence and signed use count differ.');
      const executionsByRevision=new Map();
      for(const row of executions) {
        const ex=JSON.parse(row.evidence_json);strictObject(ex,['receipt','grants','request','beforeWorkspace','afterWorkspace','auditEvent'],'Stored execution evidence');
        signed(ex.receipt);const r=ex.receipt.payload;
        strictObject(r,['profile','issuer','keyId','receiptId','at','workspaceId','audience','rootNonce','grantDigests','requestDigest','command','actor','beforeRevision','afterRevision','beforeDigest','afterDigest','beforeFinancial','afterFinancial','result','auditHash'],'Stored execution receipt');
        check(r.profile===RECEIPT_PROFILE&&identityMatches(r)&&instant(r.at),'Stored receipt identity differs.');
        check(Array.isArray(ex.grants)&&ex.grants.length>=1&&ex.grants.length<=4,'Stored delegation chain is invalid.');
        for(const [index,grant] of ex.grants.entries()) {
          const g=validateGrant(grant.payload);signed(grant,index?ex.grants[index-1].payload.agentPublicKey:config.publicKey);
          if(index){assertAttenuation(ex.grants[index-1].payload,g);check(g.parentDigest===digest(ex.grants[index-1]),'Stored delegation parent digest differs.');}
          else check(g.parentDigest===null&&same(grants.get(g.grantId),grant),'Stored execution root was not issued.');
          check(Date.parse(r.at)>=Date.parse(g.notBefore)&&Date.parse(r.at)<Date.parse(g.expiresAt),'Recorded use was outside its grant lifetime.');
        }
        const root=ex.grants[0].payload,leaf=ex.grants.at(-1).payload,p=validateRequest(ex.request.payload);signed(ex.request,leaf.agentPublicKey);
        check(identityMatches(root)&&p.workspaceId===config.workspaceId&&p.audience===config.audience&&p.grantDigest===digest(ex.grants.at(-1))&&p.actionId===leaf.actionId&&p.commitmentId===leaf.commitmentId&&Date.parse(p.issuedAt)>=Date.parse(leaf.notBefore)&&Date.parse(p.issuedAt)<Date.parse(leaf.expiresAt)&&Date.parse(p.issuedAt)<=Date.parse(r.at)+30000,'Stored request is not bound to its scoped action and time.');
        const use=uses.get(root.grantId);
        check(use&&row.sequence===use.sequence&&r.rootNonce===root.rootNonce&&r.at===use.at&&use.detail.revision===r.afterRevision&&use.detail.grantDigest===digest(ex.grants.at(-1))&&use.detail.receiptDigest===digest(ex.receipt)&&use.detail.requestDigest===digest(ex.request),'Stored receipt and signed lifecycle differ.');
        check(same(r.grantDigests,ex.grants.map(digest))&&r.requestDigest===digest(ex.request)&&r.beforeDigest===digest(ex.beforeWorkspace)&&r.afterDigest===digest(ex.afterWorkspace),'Stored receipt snapshot or chain digest differs.');
        check(r.beforeRevision===p.expectedRevision&&r.afterRevision===r.beforeRevision+1&&same(r.actor,{id:`agent:${leaf.agentPublicKey.x}`,role:'executor',name:'Verified delegated agent'})&&same(r.command,{id:p.commandId,type:'EXECUTE_ACTION',actionId:leaf.actionId}),'Stored receipt actor, command or revision differs.');
        checkedAction(ex.beforeWorkspace,leaf,r.at);
        check(!ex.beforeWorkspace.events.some(event=>event.commandId===r.command.id),'A stored delegated command was already used.');
        const replay=engine.reduceWorkspace(ex.beforeWorkspace,r.command,{actor:r.actor,now:r.at});
        check(same(replay.state,ex.afterWorkspace)&&same(replay.result,r.result),'Stored delegated financial effect does not replay.');
        check(same(financialSnapshot(engine.evaluateWorkspace(ex.beforeWorkspace,snapshotOptions(r.at))),r.beforeFinancial)&&same(financialSnapshot(engine.evaluateWorkspace(ex.afterWorkspace,snapshotOptions(r.at))),r.afterFinancial),'Stored receipt economics differ.');
        const a=ex.auditEvent,{hash,...unsigned}=a;
        const storedAudit=db.prepare('SELECT entry_json FROM audit WHERE sequence=?').get(r.afterRevision);
        check(storedAudit&&same(JSON.parse(storedAudit.entry_json),a)&&hash===hexDigest(unsigned)&&hash===r.auditHash&&a.sequence===r.afterRevision&&a.beforeRevision===r.beforeRevision&&a.afterRevision===r.afterRevision&&a.beforeDigest===hexDigest(ex.beforeWorkspace)&&a.afterDigest===hexDigest(ex.afterWorkspace)&&same(a.command,r.command)&&same(a.actor,r.actor)&&same(a.result,r.result)&&a.at===r.at,'Stored execution financial audit anchor differs.');
        check(!executionsByRevision.has(r.afterRevision),'Several receipts claim the same financial revision.');executionsByRevision.set(r.afterRevision,ex);
      }
      const requests=cacheRows(),seals=db.prepare('SELECT actor_id,request_key,anchor_json FROM authority_cache_seals ORDER BY actor_id,request_key').all().map(row=>({...row}));
      const sealByKey=new Map(seals.map(row=>[canonical([row.actor_id,row.request_key]),row]));
      const issuedCached=new Set(),firstRevocationCache=new Set();
      for(const row of requests) {
        const response=JSON.parse(row.response_json);noPrivateMaterial(response);
        check(typeof row.request_digest==='string'&&/^[A-Za-z0-9_-]{43}$/.test(row.request_digest),'Stored authority request digest is invalid.');
        const anchor=sealByKey.get(canonical([row.actor_id,row.request_key]));
        if(anchor) {
          const envelope=JSON.parse(anchor.anchor_json);signed(envelope);const p=envelope.payload;
          strictObject(p,['profile','issuer','keyId','workspaceId','audience','actorId','requestKey','requestDigest','responseDigest'],'Authority cache seal');
          check(p.profile===CACHE_PROFILE&&identityMatches(p)&&p.actorId===row.actor_id&&p.requestKey===row.request_key&&p.requestDigest===row.request_digest&&p.responseDigest===digest(response),'Stored authority cache differs from its signed seal.');
        } else check(allowLegacyUnsealed,'Stored authority request has no signed baseline seal.');
        const expectedInfo=infoUnchecked();
        check(response.info&&same({...response.info,expectedRevision:expectedInfo.expectedRevision},expectedInfo)&&Number.isSafeInteger(response.info.expectedRevision)&&response.info.expectedRevision>=0&&response.info.expectedRevision<=expectedInfo.expectedRevision,'Cached public issuer information differs.');
        if(response.grant) {
          strictObject(response,['grant','info','expectedRevision'],'Cached issuance response');
          const grant=grants.get(response.grant.payload.grantId),issued=issuances.get(response.grant.payload.grantId);
          check(grant&&same(response.grant,grant)&&issued.detail.actor.id===row.actor_id&&response.expectedRevision===response.info.expectedRevision&&!issuedCached.has(grant.payload.grantId),'Cached issuance response differs from signed grant facts.');
          const g=grant.payload,base={actionId:g.actionId,maxAmountCents:g.maxAmountCents,maxObligationCents:g.maxObligationCents,notBefore:g.notBefore,expiresAt:g.expiresAt,expectedRevision:response.expectedRevision};
          const variants=[];
          for(const ext of [undefined,true,false])for(const alg of [undefined,'Ed25519','EdDSA'])for(const keyOps of [undefined,['verify']])variants.push({...g.agentPublicKey,...(ext===undefined?{}:{ext}),...(alg===undefined?{}:{alg}),...(keyOps===undefined?{}:{key_ops:keyOps})});
          check(variants.some(agentPublicKey=>digest({kind:'issue',input:{...base,agentPublicKey}})===row.request_digest),'Cached issuance request digest differs from reconstructible grant input.');
          issuedCached.add(g.grantId);
        } else {
          strictObject(response,['grantId','revokedAt','consumedAt','info'],'Cached revocation response');
          const revoked=revocations.get(response.grantId);
          check(revoked&&response.revokedAt===revoked.at&&response.consumedAt===(uses.get(response.grantId)?.at||null),'Cached revocation response differs from signed status facts.');
          if(!anchor&&!firstRevocationCache.has(response.grantId))check(revoked.detail.actor.id===row.actor_id&&row.request_digest===digest({kind:'revoke',input:{grantId:response.grantId,reason:revoked.detail.reason}}),'Legacy first revocation cache is inconsistent with its signed request facts.');
          firstRevocationCache.add(response.grantId);
        }
      }
      check(issuedCached.size===grants.size,'Signed issuance is missing its durable request result.');
      check(seals.every(row=>requests.some(request=>request.actor_id===row.actor_id&&request.request_key===row.request_key)),'An authority cache seal has no stored request.');
      const baselineRow=db.prepare('SELECT baseline_json FROM authority_cache_baseline WHERE id=1').get();
      const checkpointRow=db.prepare('SELECT checkpoint_json FROM authority_cache_checkpoint WHERE id=1').get();
      if(baselineRow){const envelope=JSON.parse(baselineRow.baseline_json);signed(envelope);check(envelope.payload.profile==='truthful-authority-cache-baseline-v1'&&identityMatches(envelope.payload)&&Number.isSafeInteger(envelope.payload.count),'Authority cache baseline is invalid.');}
      else check(allowLegacyUnsealed,'Authority cache baseline is absent.');
      if(checkpointRow){const envelope=JSON.parse(checkpointRow.checkpoint_json);signed(envelope);check(envelope.payload.profile==='truthful-authority-cache-checkpoint-v1'&&identityMatches(envelope.payload)&&envelope.payload.count===seals.length&&envelope.payload.sealsDigest===digest(seals),'Authority cache checkpoint differs.');}
      else check(allowLegacyUnsealed,'Authority cache checkpoint is absent.');
      const cacheMatches=new Map();
      for(const row of db.prepare('SELECT * FROM idempotency').all()) {
        const response=JSON.parse(row.response_json);
        if(!response.authority)continue;
        noPrivateMaterial(response);
        const ex=executionsByRevision.get(row.revision),r=ex?.receipt.payload;
        check(ex&&row.actor_id===r.actor.id&&row.response_digest===createHash('sha256').update(row.response_json).digest('hex')&&row.request_digest===digest({grants:ex.grants,request:ex.request}),'Delegated request cache has no matching execution evidence.');
        check(same(response.authority.receipt,ex.receipt)&&same(response.workspace,ex.afterWorkspace)&&response.revision===r.afterRevision&&same(response.result,r.result)&&response.audit?.hash===r.auditHash&&response.audit?.sequence===r.afterRevision,'Cached delegated result differs from its signed receipt.');
        strictObject(response.authority,['receipt','grantStatus','info'],'Cached delegated authority result');
        check(same(response.authority.info,{...infoUnchecked(),expectedRevision:r.afterRevision})&&same(response.authority.grantStatus,{grantId:ex.grants[0].payload.grantId,revokedAt:null,consumedAt:r.at,expiresAt:ex.grants[0].payload.expiresAt})&&response.domainRevision===ex.afterWorkspace.revision,'Cached delegated issuer, grant status or domain revision differs.');
        check(same(response.view,engine.evaluateWorkspace(ex.afterWorkspace,{asOf:response.view.asOf,knownAt:response.view.knownAt})),'Cached delegated financial projection differs.');
        check(!cacheMatches.has(row.revision),'One execution has several durable request results.');cacheMatches.set(row.revision,row);
      }
      check(cacheMatches.size===executions.length,'Signed execution is missing its durable request result.');
      const result={valid:true,grants:grants.size,lifecycleEntries:lifecycle.length,executions:executions.length,requestCaches:requests.length,legacyCacheBaseline:baselineRow?JSON.parse(baselineRow.baseline_json).payload.count:0};
      if(!allowLegacyUnsealed)verifiedCache={key:cacheKey(),result};
      return result;
    } catch(error) {
      verifiedCache=null;
      if(error.code==='INTEGRITY_FAILURE')throw error;
      throw integrityError('Stored authority failed its consistency check. Preserve the database for inspection.',{reason:error.message});
    }
  }
  const guard = () => { requireIntegrity(); return verifyIntegrity(); };
  const info = () => { guard(); return infoUnchecked(); };
  const append = (kind, detail, at = now()) => { const history = events(); const event = seal({ profile: LIFECYCLE_PROFILE, issuer: config.issuer, keyId: config.keyId, workspaceId: config.workspaceId, audience: config.audience, sequence: history.length + 1, previousDigest: history.length ? digest(history.at(-1)) : null, kind, at, detail }); db.prepare('INSERT INTO authority_lifecycle VALUES(?,?)').run(event.payload.sequence, JSON.stringify(event)); return event; };
  const privileged = actor => assertAuthority(['admin','approver'].includes(actor?.role), 'Only a demo approver or administrator may issue/revoke authority.', 'FORBIDDEN');
  const keyRequired = key => assertAuthority(typeof key === 'string' && /^[A-Za-z0-9._:-]{8,128}$/.test(key), 'An 8–128 character Idempotency-Key is required.');
  const mutate = (kind, input, actor, key, callback) => { privileged(actor); keyRequired(key); const requestDigest = digest({ kind, input }); db.exec('BEGIN IMMEDIATE'); try { guard(); const cached = db.prepare('SELECT * FROM authority_requests WHERE actor_id=? AND request_key=?').get(actor.id, key); if (cached) { assertAuthority(cached.request_digest === requestDigest, 'Idempotency key was used for different authority input.', 'IDEMPOTENCY_CONFLICT'); db.exec('COMMIT'); return JSON.parse(cached.response_json); } const result = callback(); const responseJson=JSON.stringify(result); db.prepare('INSERT INTO authority_requests VALUES(?,?,?,?)').run(actor.id, key, requestDigest, responseJson); db.prepare('INSERT INTO authority_cache_seals VALUES(?,?,?)').run(actor.id,key,JSON.stringify(sealCache({actor_id:actor.id,request_key:key,request_digest:requestDigest,response_json:responseJson}))); checkpointCaches(); verifyIntegrity({force:true}); db.exec('COMMIT'); return result; } catch (error) { db.exec('ROLLBACK'); throw error; } };
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
    const grant = seal(payload); db.prepare('INSERT INTO authority_grants VALUES(?,?,?,NULL,NULL)').run(payload.grantId, JSON.stringify(grant), payload.rootNonce); append('issued', { grant, actor }, at); return { grant, info: infoUnchecked(), expectedRevision: row.revision };
  });
  const revokeGrant = (input, { actor, idempotencyKey } = {}) => mutate('revoke', input, actor, idempotencyKey, () => {
    assertAuthority(Object.keys(input).every(k => ['grantId','reason'].includes(k)) && typeof input.reason === 'string' && input.reason.length > 0 && input.reason.length <= 500, 'Supply a grant and bounded revocation reason.');
    const grant = db.prepare('SELECT * FROM authority_grants WHERE grant_id=?').get(input.grantId); assertAuthority(grant, 'Grant not found.'); const at = now();
    if (!grant.revoked_at) { db.prepare('UPDATE authority_grants SET revoked_at=? WHERE grant_id=?').run(at, input.grantId); append('revoked', { grantId: input.grantId, reason: input.reason, actor }, at); }
    return { grantId: input.grantId, revokedAt: grant.revoked_at || at, consumedAt: grant.consumed_at, info: infoUnchecked() };
  });
  const statusUnchecked = grantId => { const row = db.prepare('SELECT * FROM authority_grants WHERE grant_id=?').get(grantId); return row ? { grantId, revokedAt: row.revoked_at, consumedAt: row.consumed_at, expiresAt: JSON.parse(row.grant_json).payload.expiresAt } : { grantId, missing: true }; };
  const status = grantId => { guard(); return statusUnchecked(grantId); };
  const revokeOutstandingForReset = (at, actor, reason='Demo workspace reset discarded the approval context; outstanding authority is permanently invalidated.') => {
    assertAuthority(db.isTransaction, 'Reset invalidation requires the financial write transaction.');
    for (const row of db.prepare('SELECT grant_id FROM authority_grants WHERE revoked_at IS NULL AND consumed_at IS NULL ORDER BY grant_id').all()) {
      db.prepare('UPDATE authority_grants SET revoked_at=? WHERE grant_id=?').run(at, row.grant_id);
      append('revoked', { grantId: row.grant_id, reason, actor }, at);
    }
  };
  const execute = async (req, data, url) => {
    guard();
    assertAuthority(Object.keys(data).length === 2 && Object.keys(data).every(k => ['grants','request'].includes(k)), 'Signed execution accepts only grants and request.');
    const verified = await verifyAgentAuthorization(data.grants, data.request, { trustedIssuers: trust, workspaceId: config.workspaceId, audience: config.audience });
    const request = data.request.payload, actor = { id: `agent:${verified.leaf.agentPublicKey.x}`, role: 'executor', name: 'Verified delegated agent' };
    const command = { id: request.commandId, type: 'EXECUTE_ACTION', actionId: request.actionId };
    return write(req, { actor }, { expectedRevision: request.expectedRevision }, command, url, {
      // This internal flag preserves the possession-derived agent actor after
      // the service freshly checks the caller's managed-account membership.
      preserveActor: true,
      requestDigest: digest(data),
      authorize(current, at) {
        verifyIntegrity();
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
        return { receipt, grantStatus: statusUnchecked(verified.root.grantId), info: infoUnchecked() };
      },
    });
  };
  const exportPacket = () => { guard(); const lifecycle = events(); return { format: PACKET_FORMAT, checkpoint: seal({ profile: CHECKPOINT_PROFILE, issuer: config.issuer, keyId: config.keyId, workspaceId: config.workspaceId, audience: config.audience, generatedAt: now(), count: lifecycle.length, headDigest: lifecycle.length ? digest(lifecycle.at(-1)) : null }), lifecycle, executions: db.prepare('SELECT evidence_json FROM authority_executions ORDER BY sequence').all().map(r => JSON.parse(r.evidence_json)), notice: AUTHORITY_NOTICE }; };
  // One explicit legacy baseline preserves old retry bytes. Signed facts and
  // reconstructible request inputs are checked before sealing any old row. This
  // anchor cannot establish authenticity of previously unsealed cache content.
  if(!db.prepare('SELECT id FROM authority_cache_baseline WHERE id=1').get()) {
    const own=!db.isTransaction;if(own)db.exec('BEGIN IMMEDIATE');
    try {
      const checked=verifyIntegrity({force:true,allowLegacyUnsealed:true});
      const rows=cacheRows();
      for(const row of rows)if(!db.prepare('SELECT 1 FROM authority_cache_seals WHERE actor_id=? AND request_key=?').get(row.actor_id,row.request_key))db.prepare('INSERT INTO authority_cache_seals VALUES(?,?,?)').run(row.actor_id,row.request_key,JSON.stringify(sealCache(row)));
      const baseline=seal({profile:'truthful-authority-cache-baseline-v1',issuer:config.issuer,keyId:config.keyId,workspaceId:config.workspaceId,audience:config.audience,version:1,count:rows.length,at:now(),lifecycleEntries:checked.lifecycleEntries,notice:'One-time baseline of previously unsealed cache content after signed-fact reconciliation; not proof of pre-migration cache authenticity.'});
      db.prepare('INSERT INTO authority_cache_baseline VALUES(1,?)').run(JSON.stringify(baseline));checkpointCaches();
      verifyIntegrity({force:true});if(own)db.exec('COMMIT');
    } catch(error) {if(own)db.exec('ROLLBACK');throw error;}
  }
  verifyIntegrity({force:true});
  return { info, issueGrant, revokeGrant, execute, status, exportPacket, revokeOutstandingForReset, verifyIntegrity };
}
