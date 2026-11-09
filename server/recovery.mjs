import {createHash,randomUUID} from 'node:crypto';
import {createCase,approveCase,packetFor,emailFor,canonical,verifyCase} from '../src/recovery.mjs';
import {evidenceActions} from '../src/evidence-ui.mjs';
import {csvCell} from '../src/operations.mjs';

const hash=value=>createHash('sha256').update(typeof value==='string'?value:canonical(value)).digest('hex');
const NOTICE='Approval binds the exact supplied evidence and claim draft. No email, vendor action, renewal or payment is sent. Evidence and hash links establish internal consistency, not external authenticity.';
const ROLES=['viewer','analyst','approver','executor','admin'];
export class RecoveryError extends Error{constructor(status,code,message){super(message);this.name='RecoveryError';this.status=status;this.code=code;}}
const check=(ok,status,code,message)=>{if(!ok)throw new RecoveryError(status,code,message);};
function object(value,allowed){check(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(key=>allowed.includes(key)),422,'RECOVERY_VALIDATION','Provide only supported recovery fields.');return value;}
function id(value,label='Case identity'){check(typeof value==='string'&&value.trim()&&value.length<=200&&!value.includes('\0'),422,'RECOVERY_VALIDATION',`${label} must contain 1–200 characters.`);return value.trim();}
function version(value){check(Number.isSafeInteger(value)&&value>0,422,'RECOVERY_VALIDATION','Use a positive exact version.');return value;}
function draft(value){check(typeof value==='string'&&value.length<=100000&&!value.includes('\0'),422,'RECOVERY_VALIDATION','Draft text must contain at most 100,000 characters without NUL characters.');return value;}
function actorOf(auth){const a=auth?.actor||auth;check(a&&typeof a.id==='string'&&a.id&&ROLES.includes(a.role),401,'SESSION_REQUIRED','Use a current workspace session.');return {id:a.id,role:a.role,...(typeof a.name==='string'?{name:a.name}:{})};}
function requireRole(actor,roles){check(actor.role==='admin'||roles.includes(actor.role),403,'FORBIDDEN',`This recovery action requires ${[...roles,'admin'].join(' or ')} role.`);}
function key(req){const value=req?.headers?.['idempotency-key'];check(typeof value==='string'&&/^[A-Za-z0-9._:-]{8,128}$/.test(value),400,'IDEMPOTENCY_KEY_REQUIRED','Use an 8–128 character Idempotency-Key for each recovery write.');return value;}
function validLegacy(record){
 try{
  if(record?.schemaVersion!==1||typeof record.id!=='string'||!Number.isFinite(Date.parse(record.createdAt))||!record.report||!Array.isArray(record.audit)||!record.audit.length||record.audit.length>2)return false;
  let previous=null;
  for(const [index,item]of record.audit.entries()){
   const {hash:signature,...event}=item;
   if(event.sequence!==index+1||event.previousHash!==previous||signature!==hash(event)||!Number.isFinite(Date.parse(event.at))||Date.parse(event.at)<Date.parse(record.createdAt))return false;
   if(!index&&(event.type!=='EVIDENCE_ANALYZED'||event.payload.caseId!==record.id||event.payload.createdAt!==record.createdAt||event.at!==record.createdAt||event.payload.reportDigest!==hash(record.report)))return false;
   if(index&&(event.type!=='CLAIM_APPROVED'||event.payload.reportDigest!==hash(record.report)||event.payload.draftDigest!==hash(event.payload.draft)))return false;
   previous=signature;
  }return true;
 }catch{return false;}
}

/** Workspace-local recovery records. readEvidence is a synchronous authoritative
 * getEvidence(auth,id,{analysisVersion}) callback; authorize is the same fresh
 * synchronous identity guard used by the financial writer. */
export function createRecoveryManager({db,now=()=>new Date().toISOString(),readEvidence,authorize=(_req,auth,callback)=>callback(auth)}){
 check(db&&typeof readEvidence==='function'&&typeof authorize==='function',500,'RECOVERY_CONFIGURATION','Provide recovery storage, evidence lookup and authorization.');
 db.exec(`CREATE TABLE IF NOT EXISTS recovery_meta(id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER NOT NULL) STRICT;
  INSERT OR IGNORE INTO recovery_meta VALUES(1,0);
  CREATE TABLE IF NOT EXISTS recovery_cases(id TEXT PRIMARY KEY,latest_version INTEGER NOT NULL,updated_sequence INTEGER NOT NULL) STRICT;
  CREATE TABLE IF NOT EXISTS recovery_versions(case_id TEXT NOT NULL REFERENCES recovery_cases(id),version INTEGER NOT NULL,body_json TEXT NOT NULL,version_digest TEXT NOT NULL,previous_digest TEXT,PRIMARY KEY(case_id,version)) STRICT;
  CREATE TABLE IF NOT EXISTS recovery_requests(actor_id TEXT NOT NULL,request_key TEXT NOT NULL,request_digest TEXT NOT NULL,response_json TEXT NOT NULL,response_digest TEXT NOT NULL,PRIMARY KEY(actor_id,request_key)) STRICT;`);
 const clock=()=>{const at=new Date(now());check(Number.isFinite(at.valueOf()),500,'RECOVERY_CLOCK','The recovery clock is invalid.');return at.toISOString();};
 const transaction=callback=>{const own=!db.isTransaction;if(own)db.exec('BEGIN IMMEDIATE');try{const result=callback();check(!result||typeof result.then!=='function',500,'RECOVERY_CONFIGURATION','Recovery transaction callbacks must be synchronous.');if(own)db.exec('COMMIT');return result;}catch(error){if(own&&db.isTransaction)db.exec('ROLLBACK');throw error;}};
 const evidence=(auth,evidenceId,analysisVersion,{latest=false}={})=>{
  const value=readEvidence(auth,id(evidenceId,'Evidence identity'),{analysisVersion:version(analysisVersion)});
  check(value&&typeof value.then!=='function'&&value.evidenceId===evidenceId&&value.analysisVersion===analysisVersion&&value.analysis,503,'RECOVERY_EVIDENCE_INTEGRITY','The exact server evidence analysis is unavailable.');
  check(value.analysisDigest===hash(value.analysis),503,'RECOVERY_EVIDENCE_INTEGRITY','The server evidence analysis digest differs.');
  if(latest)check(value.latestAnalysisVersion===analysisVersion,409,'EVIDENCE_VERSION_CHANGED','Newer evidence exists. Explicitly rebind a new draft to its current analysis.');
  return value;
 };
 const stored=(caseId,requestedVersion)=>{
  const root=db.prepare('SELECT * FROM recovery_cases WHERE id=?').get(id(caseId));check(root,404,'RECOVERY_NOT_FOUND','The recovery case was not found.');
  const target=requestedVersion==null?root.latest_version:version(requestedVersion);
  check(target<=root.latest_version,404,'RECOVERY_VERSION_NOT_FOUND','The recovery draft version was not found.');
  const rows=db.prepare('SELECT * FROM recovery_versions WHERE case_id=? AND version<=? ORDER BY version').iterate(caseId,target);let previous=null,body,count=0;
  for(const row of rows){
   const index=count++;
   try{body=JSON.parse(row.body_json);}catch{check(false,503,'RECOVERY_INTEGRITY','The recovery version cannot be read.');}
   check(row.version===index+1&&body.caseId===caseId&&body.draftVersion===row.version&&row.previous_digest===previous&&body.previousVersionDigest===previous&&row.version_digest===hash(body)&&validLegacy(body.record)&&body.recordDigest===hash(body.record)&&body.draftDigest===hash(body.draft),503,'RECOVERY_INTEGRITY','The saved recovery draft, evidence or version chain changed.');
   const approval=body.record.audit.find(event=>event.type==='CLAIM_APPROVED');
   check(Boolean(body.approval)===Boolean(approval)&&(!approval||approval.payload.draft===body.draft&&body.approval.actor?.role&&['approver','admin'].includes(body.approval.actor.role)&&approval.payload.actor===body.approval.actor.id&&body.approval.draftDigest===body.draftDigest&&body.approval.evidenceId===body.evidenceId&&body.approval.analysisVersion===body.analysisVersion),503,'RECOVERY_INTEGRITY','The exact draft approval differs from its record.');previous=row.version_digest;
  }
  check(count===target,503,'RECOVERY_INTEGRITY','The recovery history has missing versions.');
  return {root,body,versionDigest:previous};
 };
 const cache=(actor,requestKey,requestDigest)=>{
  const row=db.prepare('SELECT * FROM recovery_requests WHERE actor_id=? AND request_key=?').get(actor.id,requestKey);if(!row)return null;
  check(row.request_digest===requestDigest,409,'IDEMPOTENCY_CONFLICT','The recovery idempotency key was used for different input.');
  check(row.response_digest===hash(row.response_json),503,'RECOVERY_INTEGRITY','The stored recovery response changed.');
  const response=JSON.parse(row.response_json),linked=stored(response.caseId,response.draftVersion);check(linked.versionDigest===response.versionDigest,503,'RECOVERY_INTEGRITY','The recovery response no longer links to its saved version.');
  return {response,replayed:true};
 };
 const saveResponse=(actor,requestKey,requestDigest,response)=>{const encoded=JSON.stringify(response);db.prepare('INSERT INTO recovery_requests VALUES(?,?,?,?,?)').run(actor.id,requestKey,requestDigest,encoded,hash(encoded));return {response,replayed:false};};
 function response(auth,entry){
  const {body,root,versionDigest}=entry,value=evidence(auth,body.evidenceId,body.analysisVersion),evidenceCurrent=value.latestAnalysisVersion===body.analysisVersion,current=body.draftVersion===root.latest_version;
  check(hash(value.analysis)===hash(body.record.report),503,'RECOVERY_EVIDENCE_INTEGRITY','The saved report differs from its exact server evidence version.');
  return {...structuredClone(body),versionDigest,latestVersion:root.latest_version,latestAnalysisVersion:value.latestAnalysisVersion,evidenceCurrent,approvalCurrent:current&&evidenceCurrent&&Boolean(body.approval),historical:!current,status:!evidenceCurrent?'evidence_stale':body.approval?'approved':'draft',notice:NOTICE};
 }
 function append(caseId,body){
  const encoded=JSON.stringify(body),versionDigest=hash(body);
  db.prepare('INSERT INTO recovery_versions VALUES(?,?,?,?,?)').run(caseId,body.draftVersion,encoded,versionDigest,body.previousVersionDigest);
  const revision=db.prepare('SELECT revision FROM recovery_meta WHERE id=1').get().revision+1;db.prepare('UPDATE recovery_meta SET revision=? WHERE id=1').run(revision);
  db.prepare('UPDATE recovery_cases SET latest_version=?,updated_sequence=? WHERE id=?').run(body.draftVersion,revision,caseId);
  return versionDigest;
 }
 function checkpoint(req,auth,operation,input,roles,caseId=null){
  const requestKey=key(req);
  return authorize(req,auth,active=>transaction(()=>{
   const actor=actorOf(active);requireRole(actor,roles);const requestDigest=hash({operation,caseId,input,actorRole:actor.role}),prior=cache(actor,requestKey,requestDigest);
   return prior?{prior}:{actor,requestKey,requestDigest,auth:active,at:clock(),...(caseId?{entry:stored(caseId)}:{})};
  }));
 }
 function persist(req,auth,point,operation,input,roles,prepared){
  return authorize(req,auth,active=>transaction(()=>{
   const actor=actorOf(active);requireRole(actor,roles);check(actor.id===point.actor.id&&actor.role===point.actor.role,403,'RECOVERY_ACTOR_CHANGED','The identity changed during draft preparation.');
   const prior=cache(actor,point.requestKey,point.requestDigest);if(prior)return prior;
   check(clock().slice(0,10)===point.at.slice(0,10),409,'RECOVERY_DATE_CHANGED','The financial date changed. Review the draft again.');
   const latest=evidence(active,prepared.evidenceId,prepared.analysisVersion,{latest:true});check(hash(latest.analysis)===hash(prepared.record.report),409,'EVIDENCE_VERSION_CHANGED','The evidence changed during draft preparation.');
   if(operation==='create')db.prepare('INSERT INTO recovery_cases VALUES(?,0,0)').run(prepared.caseId);
   else{const current=stored(prepared.caseId);check(current.root.latest_version===input.expectedVersion&&current.versionDigest===point.entry.versionDigest,409,'RECOVERY_VERSION_CONFLICT','The draft changed. Reload its current version before editing or approving.');}
   append(prepared.caseId,prepared);return saveResponse(actor,point.requestKey,point.requestDigest,response(active,stored(prepared.caseId)));
  }));
 }
 async function create(req,auth,input){
  object(input,['evidenceId','analysisVersion','label']);id(input.evidenceId,'Evidence identity');version(input.analysisVersion);if(input.label!=null)id(input.label,'Case label');
  const point=checkpoint(req,auth,'create',input,['analyst']);if(point.prior)return point.prior;
  const value=evidence(point.auth,input.evidenceId,input.analysisVersion,{latest:true}),record=await createCase(value.analysis,point.at);check(await verifyCase(record),503,'RECOVERY_INTEGRITY','The prepared evidence record failed verification.');
  const body={caseId:`recovery-${randomUUID()}`,draftVersion:1,createdAt:point.at,createdBy:point.actor,evidenceId:input.evidenceId,analysisVersion:input.analysisVersion,label:input.label?.trim()||value.label||value.analysis.vendor,draft:draft(value.analysis.draft||''),draftDigest:hash(value.analysis.draft||''),record,recordDigest:hash(record),approval:null,previousVersionDigest:null};
  return persist(req,auth,point,'create',input,['analyst'],body);
 }
 async function update(req,auth,caseId,input){
  object(input,['expectedVersion','draft','label','evidenceId','analysisVersion']);id(caseId);version(input.expectedVersion);draft(input.draft);if(input.label!=null)id(input.label,'Case label');
  check((input.evidenceId==null)===(input.analysisVersion==null),422,'RECOVERY_VALIDATION','Rebinding requires both an evidence identity and exact analysis version.');
  const point=checkpoint(req,auth,'update',input,['analyst'],caseId);if(point.prior)return point.prior;
  check(point.entry.root.latest_version===input.expectedVersion,409,'RECOVERY_VERSION_CONFLICT','The draft changed. Reload before editing.');
  const previous=point.entry.body,evidenceId=input.evidenceId??previous.evidenceId,analysisVersion=input.analysisVersion??previous.analysisVersion,value=evidence(point.auth,evidenceId,analysisVersion,{latest:true});
  const record=await createCase(value.analysis,point.at);check(await verifyCase(record),503,'RECOVERY_INTEGRITY','The prepared evidence record failed verification.');
  const body={...previous,draftVersion:previous.draftVersion+1,createdAt:point.at,createdBy:point.actor,evidenceId,analysisVersion,label:input.label?.trim()||previous.label,draft:input.draft,draftDigest:hash(input.draft),record,recordDigest:hash(record),approval:null,previousVersionDigest:point.entry.versionDigest};
  return persist(req,auth,point,'update',input,['analyst'],body);
 }
 async function approve(req,auth,caseId,input){
  object(input,['expectedVersion']);id(caseId);version(input.expectedVersion);const point=checkpoint(req,auth,'approve',input,['approver'],caseId);if(point.prior)return point.prior;
  check(point.entry.root.latest_version===input.expectedVersion,409,'RECOVERY_VERSION_CONFLICT','The draft changed. Review its current version.');
  const previous=point.entry.body;check(!previous.approval,409,'RECOVERY_ALREADY_APPROVED','This exact draft is already approved.');evidence(point.auth,previous.evidenceId,previous.analysisVersion,{latest:true});
  const report=previous.record.report,availability=evidenceActions(report,{draft:previous.draft,today:point.at.slice(0,10)}).approval;
  check(availability.allowed&&report.asOf<=point.at.slice(0,10)&&(!report.dueDate||report.dueDate<=point.at.slice(0,10)),422,'RECOVERY_NOT_APPROVABLE',availability.allowed?'Future evidence cannot authorize a current recovery draft.':availability.reason);
  let record;try{record=await approveCase(previous.record,previous.draft,point.at);}catch(error){throw new RecoveryError(422,'RECOVERY_NOT_APPROVABLE',error.message);}
  // Preserve the portable v1 record while replacing its demonstration reviewer
  // label with the actual server actor, inside the event's hash-linked payload.
  const approvalEvent=record.audit.at(-1);approvalEvent.payload.actor=point.actor.id;approvalEvent.payload.actorRole=point.actor.role;
  const {hash:oldHash,...unsignedApproval}=approvalEvent;approvalEvent.hash=hash(unsignedApproval);
  check(await verifyCase(record),503,'RECOVERY_INTEGRITY','The approved record failed verification.');
  const body={...previous,draftVersion:previous.draftVersion+1,createdAt:point.at,createdBy:point.actor,record,recordDigest:hash(record),approval:{actor:point.actor,at:point.at,draftDigest:previous.draftDigest,evidenceId:previous.evidenceId,analysisVersion:previous.analysisVersion},previousVersionDigest:point.entry.versionDigest};
  return persist(req,auth,point,'approve',input,['approver'],body);
 }
 function get(auth,caseId,options={}){actorOf(auth);object(options,['version']);return transaction(()=>response(auth,stored(caseId,options.version)));}
 function list(auth,query=new URLSearchParams()){
  actorOf(auth);const values=query instanceof URLSearchParams?Object.fromEntries(query):query;object(values,['limit','cursor','q','status']);const limit=Number(values.limit??25);check(Number.isSafeInteger(limit)&&limit>0&&limit<=100,422,'RECOVERY_VALIDATION','Use a recovery page limit from 1 to 100.');
  for(const name of ['q','status'])check(values[name]==null||typeof values[name]==='string'&&values[name].length<=200,422,'RECOVERY_VALIDATION','Recovery filters must be bounded text.');
  check(!values.status||['draft','approved','evidence_stale'].includes(values.status),422,'RECOVERY_VALIDATION','Choose a supported draft status.');
  return transaction(()=>{
   const revision=db.prepare('SELECT revision FROM recovery_meta WHERE id=1').get().revision,filters={q:values.q||'',status:values.status||''};let offset=0,cursor;
   if(values.cursor){try{check(typeof values.cursor==='string'&&values.cursor.length<=2000,400,'RECOVERY_CURSOR','Use a bounded recovery cursor.');cursor=JSON.parse(Buffer.from(values.cursor,'base64url').toString());}catch{check(false,400,'RECOVERY_CURSOR','The recovery cursor is invalid.');}check(cursor.revision===revision&&cursor.filterDigest===hash(filters)&&Number.isSafeInteger(cursor.offset)&&cursor.offset>=0,409,'RECOVERY_CURSOR_STALE','The case list or filters changed. Start again.');offset=cursor.offset;}
   const items=[],basis=createHash('sha256');let total=0;
   for(const row of db.prepare('SELECT id FROM recovery_cases ORDER BY updated_sequence DESC,id').iterate()){
    const value=response(auth,stored(row.id));basis.update(canonical([row.id,value.draftVersion,value.latestAnalysisVersion]));
    if(filters.status&&value.status!==filters.status||filters.q&&!`${value.label} ${value.record.report.vendor} ${value.caseId}`.toLowerCase().includes(filters.q.trim().toLowerCase()))continue;
    const index=total++;if(index<offset||items.length>=limit)continue;
    const {caseId,draftVersion,label,evidenceId,analysisVersion,status,evidenceCurrent,approvalCurrent,createdAt,createdBy,versionDigest,record}=value;
    items.push({caseId,draftVersion,label,evidenceId,analysisVersion,status,evidenceCurrent,approvalCurrent,createdAt,createdBy,versionDigest,vendor:record.report.vendor,outstandingCents:record.report.outstandingCents});
   }
   const evidenceBasis=basis.digest('hex');check(!cursor||cursor.evidenceBasis===evidenceBasis,409,'RECOVERY_CURSOR_STALE','The bound evidence changed. Start the recovery list again.');
   return {items,total,revision,nextCursor:offset+items.length<total?Buffer.from(JSON.stringify({revision,evidenceBasis,filterDigest:hash(filters),offset:offset+items.length})).toString('base64url'):null,notice:NOTICE};
  });
 }
 function packet(auth,caseId,options={}){
  const value=get(auth,caseId,options),{record,...metadata}=value,result={...packetFor(record),serverRecord:{format:'truthful-server-recovery-v1',...metadata}};
  const body={...result,serverRecordDigest:hash(result.serverRecord)};return {...body,packetDigest:hash(body)};
 }
 function email(auth,caseId,options={}){const value=get(auth,caseId,options);check(!value.historical&&value.approvalCurrent,409,'RECOVERY_APPROVAL_REQUIRED','Approve the current exact draft against current evidence before downloading its unsent email.');return {content:emailFor(value.record),contentType:'message/rfc822',filename:`truthful-claim-${value.caseId}-v${value.draftVersion}.eml`,notice:NOTICE};}
 function csv(auth,caseId,options={}){
  const value=get(auth,caseId,options),r=value.record.report;const rows=[['case_id','draft_version','vendor','currency','promised_cents','applied_cents','outstanding_cents','analysis_status','claim_approval_current'],[value.caseId,value.draftVersion,r.vendor,r.currency,...['promisedCents','appliedCents','outstandingCents'].map(k=>Number.isSafeInteger(r[k])?r[k]:''),r.status,value.approvalCurrent?'yes':'no']];
  return {content:rows.map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n',contentType:'text/csv;charset=utf-8',filename:`truthful-recovery-${value.caseId}-v${value.draftVersion}.csv`};
 }
 function verifyIntegrity(){try{return transaction(()=>{let versions=0,requests=0;for(const root of db.prepare('SELECT * FROM recovery_cases').all()){stored(root.id);versions+=root.latest_version;}for(const row of db.prepare('SELECT * FROM recovery_requests').all()){check(hash(row.response_json)===row.response_digest,503,'RECOVERY_INTEGRITY','Recovery retry response changed.');const response=JSON.parse(row.response_json);check(stored(response.caseId,response.draftVersion).versionDigest===response.versionDigest,503,'RECOVERY_INTEGRITY','Recovery retry linkage changed.');requests++;}return {valid:true,cases:db.prepare('SELECT COUNT(*) AS count FROM recovery_cases').get().count,versions,cachedRequests:requests,notice:NOTICE};});}catch(error){return {valid:false,reason:error.message};}}
 return {create,update,approve,get,list,packet,email,csv,verifyIntegrity};
}
