import {createHash} from 'node:crypto';
import {verifyCase,canonical as recoveryCanonical} from '../src/recovery.mjs';
import {verifyAuthorityPacket,publicKey} from '../src/authority/index.mjs';
import {verifyExplorationPacket} from '../src/explorer/index.mjs';

export const packetLimits = Object.freeze({maxBytes:8*1024*1024,maxDepth:64,maxValues:150000,maxWorkspaceEvents:1000,maxAggregateWorkspaceEvents:5000,maxAuditEntries:1000,maxCommands:2000,maxLifecycleEntries:1000,maxExecutions:100,maxTrustedIssuers:16});
const scopes = {
 'truthful-evidence-packet-v1':'Recorded evidence and local audit hashes are internally consistent. This does not authenticate the vendor, reviewer, source documents or financial outcome; no email or payment is established.',
 'truthful-assurance-packet-v1':'Deterministic command replay and the selected financial/knowledge projection are internally consistent. This does not authenticate sources, actors, timestamps, feed completeness or external settlement.',
 'truthful-server-evidence-v1':'Recorded server audit, domain command replay and financial projection are internally consistent relative to the included starting history. This does not independently authenticate sources, identities or external settlement.',
 'truthful-authority-evidence-v1':'Verification uses only separately supplied issuer keys. Signatures and replay establish recorded authorization and local outcome, not current revocation, global unspentness, source authenticity, organizational identity or external settlement.',
 'truthful-bounded-exploration':'The bounded report and retained traces reproduce under their declared model. A valid packet may describe an unsafe effect or an inconclusive search; this is not a global safety proof or live-agent benchmark.',
};
const generalScope='Uploaded verification is read only. Packet contents cannot grant trust, authority or a financial effect.';
const fail=(code,message)=>{throw Object.assign(new Error(message),{code});};
const plain=value=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
const boundedText=(value,label)=>{if(typeof value!=='string'||!value.length||value.length>256||/[\u0000-\u001f]/.test(value))fail('TRUST_INVALID',`${label} must be bounded text without control characters.`);return value;};
const recoveryHash=value=>createHash('sha256').update(typeof value==='string'?value:recoveryCanonical(value)).digest('hex');
const recoveryCheck=(value,message)=>{if(!value)fail('RECOVERY_PACKET_INVALID',message);};
const recoveryTimestamp=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
const recoveryId=value=>typeof value==='string'&&value.trim().length>0&&value.length<=200&&!value.includes('\0');
const positiveVersion=value=>Number.isSafeInteger(value)&&value>0;
const digestString=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
function recoveryActor(actor,roles) {
 return plain(actor)&&Object.keys(actor).every(key=>['id','role','name'].includes(key))&&recoveryId(actor.id)&&roles.includes(actor.role)&&(actor.name===undefined||typeof actor.name==='string');
}
function verifyRecoveryWrapper(packet) {
 const wrapperKeys=['serverRecord','serverRecordDigest','packetDigest'];
 if(!wrapperKeys.some(key=>Object.hasOwn(packet,key)))return null;
 recoveryCheck(wrapperKeys.every(key=>Object.hasOwn(packet,key)),'A server recovery packet must include its complete metadata and both digests.');
 const {packetDigest,...completeBody}=packet;
 recoveryCheck(digestString(packetDigest)&&packetDigest===recoveryHash(completeBody),'The complete recovery packet digest differs.');
 const m=packet.serverRecord;
 const metadataFields=['format','caseId','draftVersion','createdAt','createdBy','evidenceId','analysisVersion','label','draft','draftDigest','recordDigest','approval','previousVersionDigest','versionDigest','latestVersion','latestAnalysisVersion','evidenceCurrent','approvalCurrent','historical','status','notice'];
 recoveryCheck(plain(m)&&Object.keys(m).length===metadataFields.length&&metadataFields.every(key=>Object.hasOwn(m,key))&&m.format==='truthful-server-recovery-v1','The server recovery metadata format or fields are invalid.');
 recoveryCheck(digestString(packet.serverRecordDigest)&&packet.serverRecordDigest===recoveryHash(m),'The server recovery metadata digest differs.');
 const record=Object.fromEntries(['schemaVersion','id','createdAt','report','audit'].map(key=>[key,packet[key]]));
 recoveryCheck(digestString(m.recordDigest)&&m.recordDigest===recoveryHash(record),'The server recovery report and audit do not match the legacy record.');
 recoveryCheck(recoveryId(m.caseId)&&recoveryId(m.evidenceId)&&recoveryId(m.label)&&positiveVersion(m.draftVersion)&&positiveVersion(m.analysisVersion)&&positiveVersion(m.latestVersion)&&positiveVersion(m.latestAnalysisVersion)&&m.latestVersion>=m.draftVersion&&m.latestAnalysisVersion>=m.analysisVersion,'The recovery case or evidence version metadata is invalid.');
 recoveryCheck(recoveryTimestamp(m.createdAt)&&Date.parse(m.createdAt)>=Date.parse(record.createdAt)&&recoveryActor(m.createdBy,['analyst','approver','admin']),'The recovery version creation metadata is invalid.');
 recoveryCheck(typeof m.draft==='string'&&m.draft.length<=100000&&!m.draft.includes('\0')&&digestString(m.draftDigest)&&m.draftDigest===recoveryHash(m.draft),'The server recovery draft digest differs.');
 recoveryCheck(m.draftVersion===1?m.previousVersionDigest===null:digestString(m.previousVersionDigest),'The recovery version predecessor digest is invalid.');
 const persistedFields=['caseId','draftVersion','createdAt','createdBy','evidenceId','analysisVersion','label','draft','draftDigest','recordDigest','approval','previousVersionDigest'];
 const storedBody={...Object.fromEntries(persistedFields.map(key=>[key,m[key]])),record};
 recoveryCheck(digestString(m.versionDigest)&&m.versionDigest===recoveryHash(storedBody),'The saved recovery version digest differs from its exact report, draft or evidence binding.');
 const approval=record.audit.find(event=>event.type==='CLAIM_APPROVED');
 recoveryCheck(Boolean(m.approval)===Boolean(approval),'Server recovery approval metadata differs from the legacy approval event.');
 if(approval) {
  const a=m.approval,fields=['actor','at','draftDigest','evidenceId','analysisVersion'];
  recoveryCheck(plain(a)&&Object.keys(a).length===fields.length&&fields.every(key=>Object.hasOwn(a,key))&&recoveryActor(a.actor,['approver','admin'])&&recoveryCanonical(a.actor)===recoveryCanonical(m.createdBy),'The recovery approver metadata is invalid.');
  recoveryCheck(a.at===approval.at&&a.at===m.createdAt&&a.draftDigest===m.draftDigest&&a.evidenceId===m.evidenceId&&a.analysisVersion===m.analysisVersion&&approval.payload.draft===m.draft&&approval.payload.draftDigest===m.draftDigest&&approval.payload.actor===a.actor.id&&approval.payload.actorRole===a.actor.role,'The approved draft, actor, time or evidence version differs from its exact legacy approval.');
 } else {
  recoveryCheck(m.approval===null&&recoveryActor(m.createdBy,['analyst','admin'])&&m.createdAt===record.createdAt,'An unapproved recovery draft has inconsistent creation or approval metadata.');
 }
 const evidenceCurrent=m.latestAnalysisVersion===m.analysisVersion,historical=m.latestVersion!==m.draftVersion,approvalCurrent=!historical&&evidenceCurrent&&Boolean(approval),status=!evidenceCurrent?'evidence_stale':approval?'approved':'draft';
 recoveryCheck(m.evidenceCurrent===evidenceCurrent&&m.historical===historical&&m.approvalCurrent===approvalCurrent&&m.status===status&&typeof m.notice==='string','Recovery freshness, approval or status metadata is inconsistent with its version bindings.');
 return {serverCaseId:m.caseId,draftVersion:m.draftVersion,analysisVersion:m.analysisVersion,historical,approvalCurrent};
}

function boundedJson(value) {
 let values=0,aggregateEvents=0,commands=0,estimatedBytes=0;
 const ancestors=new Set();
 function visit(item,depth) {
  if(++values>packetLimits.maxValues||depth>packetLimits.maxDepth)fail('PACKET_LIMIT','Packet structure exceeds the bounded value count or nesting depth.');
  if(item===null||typeof item==='boolean')return;
  if(typeof item==='string'){estimatedBytes+=Buffer.byteLength(item,'utf8');if(estimatedBytes>packetLimits.maxBytes)fail('PACKET_TOO_LARGE','Packet input exceeds 8 MiB.');return;}
  if(typeof item==='number'){if(!Number.isFinite(item))fail('PACKET_INPUT_INVALID','Packets must contain finite JSON numbers.');return;}
  if(typeof item!=='object'||(!Array.isArray(item)&&!plain(item)))fail('PACKET_INPUT_INVALID','Packets must contain plain JSON values only.');
  if(ancestors.has(item))fail('PACKET_INPUT_INVALID','Packet input cannot contain a circular reference.');
  ancestors.add(item);
  if(Array.isArray(item)) {
   if(item.length>packetLimits.maxValues||Object.keys(item).length!==item.length)fail('PACKET_LIMIT','Packet arrays must be dense JSON arrays within the value limit.');
   for(let i=0;i<item.length;i++){const property=Object.getOwnPropertyDescriptor(item,String(i));if(!property||!Object.hasOwn(property,'value'))fail('PACKET_INPUT_INVALID','Packet input cannot contain accessors.');visit(property.value,depth+1);}
  } else {
   const descriptors=Object.getOwnPropertyDescriptors(item);
   for(const [key,descriptor]of Object.entries(descriptors)){if(!Object.hasOwn(descriptor,'value')||!descriptor.enumerable)fail('PACKET_INPUT_INVALID','Packet input cannot contain accessors or hidden properties.');estimatedBytes+=Buffer.byteLength(key,'utf8');}
   if(Object.getOwnPropertySymbols(item).length)fail('PACKET_INPUT_INVALID','Packet input cannot contain symbol properties.');
   if(item.schemaVersion===1&&Array.isArray(item.events)&&Number.isSafeInteger(item.revision)) {
    if(item.events.length>packetLimits.maxWorkspaceEvents)fail('PACKET_LIMIT','A workspace exceeds the 1,000-domain-event replay limit.');
    aggregateEvents+=item.events.length;if(aggregateEvents>packetLimits.maxAggregateWorkspaceEvents)fail('PACKET_LIMIT','Combined workspace snapshots exceed the 5,000-event replay budget.');
   }
   if(Array.isArray(item.audit)&&item.audit.length>packetLimits.maxAuditEntries)fail('PACKET_LIMIT','A packet exceeds the 1,000-entry audit replay limit.');
   if(Array.isArray(item.commands)){commands+=item.commands.length;if(commands>packetLimits.maxCommands)fail('PACKET_LIMIT','Packet command batches exceed the replay budget.');}
   if(Array.isArray(item.lifecycle)&&item.lifecycle.length>packetLimits.maxLifecycleEntries)fail('PACKET_LIMIT','Authority lifecycle exceeds 1,000 entries.');
   if(Array.isArray(item.executions)&&item.executions.length>packetLimits.maxExecutions)fail('PACKET_LIMIT','Authority packet exceeds 100 execution replays.');
   for(const descriptor of Object.values(descriptors))visit(descriptor.value,depth+1);
  }
  ancestors.delete(item);
 }
 visit(value,0);
 const serialized=JSON.stringify(value);
 if(Buffer.byteLength(serialized,'utf8')>packetLimits.maxBytes)fail('PACKET_TOO_LARGE','Packet input exceeds 8 MiB.');
 return JSON.parse(serialized);
}

function trustRoots(value) {
 if(value===undefined)return [];
 if(!Array.isArray(value)||value.length>packetLimits.maxTrustedIssuers)fail('TRUST_INVALID','Supply at most 16 separately pinned issuer keys.');
 const seen=new Set();
 return value.map(item=>{
  if(!plain(item)||Object.keys(item).length!==3||!['issuer','keyId','publicKey'].every(key=>Object.hasOwn(item,key)))fail('TRUST_INVALID','Each trusted issuer must contain issuer, keyId and a publicKey only.');
  const issuer=boundedText(item.issuer,'Issuer'),keyId=boundedText(item.keyId,'Key ID'),tag=JSON.stringify([issuer,keyId]);
  if(seen.has(tag))fail('TRUST_INVALID','Pin each issuer and key ID only once.');seen.add(tag);
  let normalized;
  try{normalized=publicKey(item.publicKey);}catch{fail('TRUST_INVALID','A separately pinned Ed25519 public JWK is required; private keys are not accepted.');}
  return {issuer,keyId,publicKey:normalized};
 });
}

/** Verify any shipped portable format without trusting or mutating its contents. */
export async function verifyPacketInput(input) {
 let format=null;
 try {
  if(!plain(input)||Object.keys(input).some(key=>!['packet','trustedIssuers'].includes(key))||!Object.hasOwn(input,'packet'))fail('PACKET_INPUT_INVALID','Provide packet and, optionally, separately pinned trustedIssuers.');
  const detached=boundedJson(input),packet=detached.packet;
  if(!plain(packet))fail('PACKET_INPUT_INVALID','The uploaded packet must be a JSON object.');
  const declaredFormat=packet.format??(packet.kind==='truthful-bounded-exploration'?packet.kind:null);
  format=typeof declaredFormat==='string'?declaredFormat:null;
  if(!Object.hasOwn(scopes,format))fail('PACKET_FORMAT_UNSUPPORTED','Choose a shipped recovery, assurance, server, authority or bounded-exploration packet.');
  const trustedIssuers=trustRoots(detached.trustedIssuers);
  let result,summary={};
  if(format==='truthful-evidence-packet-v1') {
   result={valid:await verifyCase(packet)};
   summary={caseId:packet.id,auditEntries:packet.audit?.length||0,claimApproved:packet.audit?.some(event=>event.type==='CLAIM_APPROVED')||false};
   if(result.valid){const metadata=verifyRecoveryWrapper(packet);if(metadata)summary={...summary,...metadata};}
  } else if(format==='truthful-assurance-packet-v1'||format==='truthful-server-evidence-v1') {
   // This module exports a guarded CLI main and primary pure verification API.
   // Load lazily so the service endpoint does not create an import cycle at boot.
   const {verifyAssurancePacket}=await import('../scripts/verify-assurance-packet.mjs');
   result=await verifyAssurancePacket(packet);
   summary=Object.fromEntries(['mode','commands','events','serverAuditEntries','asOf','knownAt'].filter(key=>result[key]!==undefined).map(key=>[key,result[key]]));
  } else if(format==='truthful-authority-evidence-v1') {
   result=await verifyAuthorityPacket(packet,{trustedIssuers});
   summary={trustedIssuerCount:trustedIssuers.length,...Object.fromEntries(['executions','lifecycleEntries','generatedAt'].filter(key=>result[key]!==undefined).map(key=>[key,result[key]]))};
  } else {
   if(Object.hasOwn(packet,'format'))fail('PACKET_FORMAT_UNSUPPORTED','Bounded-exploration packets use their declared kind and property version, without another format.');
   result=await verifyExplorationPacket(packet);
   summary={mode:packet.mode,status:packet.status,inconclusive:packet.stats?.inconclusive===true,hasUnsafeWitness:!!packet.shortestWitness};
  }
  const errors=result.valid?[]:Array.isArray(result.errors)&&result.errors.length?result.errors:[result.reason||'Packet evidence, hashes, signatures or replay do not match.'];
  const scope=scopes[format]+(summary.serverCaseId?' Server metadata hashes and exact draft/approval bindings also match; live server freshness is not checked.':'');
  return {valid:result.valid===true,format,errors,scope,...(result.valid?{summary}:{code:result.code||'PACKET_INVALID'})};
 } catch(error) {
  return {valid:false,format,errors:[error.message||'The packet could not be verified.'],scope:Object.hasOwn(scopes,format)?scopes[format]:generalScope,code:error.code||'PACKET_INPUT_INVALID'};
 }
}
