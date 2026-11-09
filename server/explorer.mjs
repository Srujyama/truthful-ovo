import { createHash, randomUUID } from 'node:crypto';
import { compareScenario, createScenario, explorePlan, scenarioCatalog, verifyExplorationPacket } from '../src/explorer/index.mjs';
import { createPortfolioScenario } from '../src/explorer/portfolio.mjs';
import { canonical } from '../src/assurance/index.mjs';

export const EXPLORER_BOUNDS = Object.freeze({ maxDepth:12, maxStates:2000, maxTransitions:6000, maxTimeMs:2000 });
const DEFAULT_BOUNDS = Object.freeze({ maxDepth:12, maxStates:300, maxTransitions:1000, maxTimeMs:1500 });
const NOTICE = 'Bounded contained-model analysis only. Scripted actors and adversarial inputs are hypothetical; no financial workspace mutation, approval, grant or external transaction occurs. A cutoff is inconclusive, not proof of safety.';
const hash=value=>createHash('sha256').update(typeof value==='string'?value:canonical(value)).digest('hex');
const fail=(status,code,message,details)=>{const error=new Error(message);Object.assign(error,{status,code,details});throw error;};
const check=(value,status,code,message,details)=>{if(!value)fail(status,code,message,details);};
const object=(value,keys,label)=>{check(value&&typeof value==='object'&&!Array.isArray(value),422,'EXPLORER_VALIDATION',`${label} must be an object.`);const unknown=Object.keys(value).filter(key=>!keys.includes(key));check(!unknown.length,422,'EXPLORER_VALIDATION',`${label} contains unsupported fields.`,{fields:unknown});return value;};
const id=(value,label)=>{check(typeof value==='string'&&value.trim()&&value.length<=200,422,'EXPLORER_VALIDATION',`${label} must contain1–200characters.`);return value.trim();};
const actorOf=auth=>{const actor=auth?.actor||auth;check(actor&&['viewer','analyst','approver','executor','admin'].includes(actor.role)&&typeof actor.id==='string'&&actor.id.trim()&&actor.id.length<=200,401,'SESSION_REQUIRED','Use a current workspace identity.');return {id:actor.id,role:actor.role};};
const computeRole=actor=>check(actor.role!=='viewer',403,'FORBIDDEN','A read-only identity may inspect reports but cannot start exploration or verification computation.');
const keyOf=req=>{const key=req?.headers?.['idempotency-key'];check(typeof key==='string'&&/^[A-Za-z0-9._:-]{8,128}$/.test(key),400,'IDEMPOTENCY_KEY_REQUIRED','Use an8–128character Idempotency-Key for exploration computation.');return key;};
const boundedJson=(value,max,label)=>check(Buffer.byteLength(JSON.stringify(value),'utf8')<=max,413,'EXPLORER_INPUT_LIMIT',`${label} exceeds the supported serialized size.`);
const instant=value=>{check(typeof value==='string'&&/T/.test(value)&&/(?:Z|[+-]\d{2}:\d{2})$/.test(value)&&Number.isFinite(Date.parse(value)),422,'EXPLORER_TIME','Use an ISO simulation time with a timezone.');return new Date(value).toISOString();};
function boundsFor(value={}) {
  object(value,Object.keys(EXPLORER_BOUNDS),'Exploration bounds');
  const bounds={...DEFAULT_BOUNDS,...value};
  for(const [key,limit] of Object.entries(EXPLORER_BOUNDS))check(Number.isSafeInteger(bounds[key])&&bounds[key]>=1&&bounds[key]<=limit,422,'EXPLORER_BOUND',`${key} must be an integer from1 to${limit}.`,{field:key,max:limit});
  return bounds;
}
function packetSummary(packet){return {mode:packet.mode,status:packet.status,digest:packet.digest,stats:packet.stats,goalCompletion:packet.goalCompletion};}

export function createExplorerManager({db,now,read,engine,authorize=(_req,auth,callback)=>callback(auth)}) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS explorer_runs(id TEXT PRIMARY KEY,kind TEXT NOT NULL,origin TEXT NOT NULL,actor_json TEXT NOT NULL,input_json TEXT NOT NULL,scenario_json TEXT NOT NULL,server_revision INTEGER NOT NULL,domain_revision INTEGER NOT NULL,snapshot_digest TEXT,created_at TEXT NOT NULL,completed_at TEXT NOT NULL,report_json TEXT NOT NULL,record_digest TEXT NOT NULL) STRICT;
    CREATE TABLE IF NOT EXISTS explorer_verifications(id TEXT PRIMARY KEY,run_id TEXT,variant TEXT,actor_json TEXT NOT NULL,created_at TEXT NOT NULL,packet_json TEXT NOT NULL,result_json TEXT NOT NULL,record_digest TEXT NOT NULL) STRICT;
    CREATE TABLE IF NOT EXISTS explorer_requests(actor_id TEXT NOT NULL,request_key TEXT NOT NULL,request_digest TEXT NOT NULL,response_json TEXT NOT NULL,response_digest TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(actor_id,request_key)) STRICT;
    CREATE TABLE IF NOT EXISTS explorer_metadata(id TEXT PRIMARY KEY CHECK(id='runs'),revision INTEGER NOT NULL) STRICT;
    INSERT OR IGNORE INTO explorer_metadata VALUES('runs',0);
    CREATE TABLE IF NOT EXISTS explorer_lease(id INTEGER PRIMARY KEY CHECK(id=1),token TEXT NOT NULL,expires_at TEXT NOT NULL) STRICT;
  `);
  const clock=()=>{const value=now();return instant(value instanceof Date?value.toISOString():value);};
  const tx=callback=>{const own=!db.isTransaction;if(own)db.exec('BEGIN IMMEDIATE');try{const result=callback();if(own)db.exec('COMMIT');return result;}catch(error){if(own)db.exec('ROLLBACK');throw error;}};
  const authorized=(req,auth,callback)=>authorize(req,auth,active=>callback(active?.actor?active:{...auth,actor:active}));
  const sealed=row=>{const {record_digest,...content}=row;return hash(content);};
  function cached(actor,key,digest){const row=db.prepare('SELECT * FROM explorer_requests WHERE actor_id=? AND request_key=?').get(actor.id,key);if(!row)return null;check(row.request_digest===digest,409,'IDEMPOTENCY_CONFLICT','This exploration key was already used with different input or role.');check(hash(row.response_json)===row.response_digest,503,'EXPLORER_INTEGRITY','The stored exploration response changed.');return {response:JSON.parse(row.response_json),replayed:true};}
  function remember(actor,key,digest,response,at){const json=JSON.stringify(response);db.prepare('INSERT INTO explorer_requests VALUES(?,?,?,?,?,?)').run(actor.id,key,digest,json,hash(json),at);return {response,replayed:false};}
  function acquire(){const at=clock(),row=db.prepare('SELECT * FROM explorer_lease WHERE id=1').get();check(!row||row.expires_at<=at,429,'EXPLORER_BUSY','Another bounded exploration or verification is running. Retry after it completes.');const token=randomUUID();db.prepare('INSERT OR REPLACE INTO explorer_lease VALUES(1,?,?)').run(token,new Date(Date.parse(at)+60000).toISOString());return token;}
  const release=token=>tx(()=>db.prepare('DELETE FROM explorer_lease WHERE id=1 AND token=?').run(token));
  function verifiedRun(runId){const row=db.prepare('SELECT * FROM explorer_runs WHERE id=?').get(runId);check(row,404,'EXPLORATION_NOT_FOUND','The recorded exploration was not found.');try{check(sealed(row)===row.record_digest,503,'EXPLORER_INTEGRITY','The recorded exploration changed.');const report=JSON.parse(row.report_json),scenario=JSON.parse(row.scenario_json),input=JSON.parse(row.input_json);const packets=row.kind==='compare'?[report.naive,report.guarded,...(report.repair?[report.repair.report]:[])]:[report];for(const packet of packets){const {digest,...body}=packet;check(hash(body)===digest,503,'EXPLORER_INTEGRITY','An exploration packet digest changed.');}return {row,report,scenario,input};}catch(error){if(error.status)throw error;fail(503,'EXPLORER_INTEGRITY','The recorded exploration cannot be read.');}}
  function publicRun(value,{full=true}={}){const {row,report}=value,current=read();const liveSnapshotCurrent=row.origin==='portfolio'?hash(current.state)===row.snapshot_digest:null;return {runId:row.id,kind:row.kind,origin:row.origin,actor:JSON.parse(row.actor_json),recordedAt:row.created_at,completedAt:row.completed_at,capturedRevision:row.server_revision,capturedDomainRevision:row.domain_revision,snapshotDigest:row.snapshot_digest,currentRevision:current.revision,liveSnapshotCurrent,simulationInitialNow:value.scenario.initialNow,summary:row.kind==='compare'?{naive:packetSummary(report.naive),guarded:packetSummary(report.guarded),repair:report.repair?packetSummary(report.repair.report):null,repairReason:report.repairReason||null}:packetSummary(report),...(full?{scenario:value.scenario,report}:{}),notice:NOTICE};}
  function scenarioFor(input,current,at){
    const selectors=['scenarioId','plan','portfolio'].filter(key=>input[key]!==undefined);check(selectors.length===1,422,'EXPLORER_SELECTOR','Choose exactly one authored scenario, custom plan or portfolio action.');
    if(selectors[0]==='scenarioId'){const scenarioId=id(input.scenarioId,'Scenario ID');check(scenarioCatalog.some(item=>item.id===scenarioId),404,'SCENARIO_NOT_FOUND','The authored exploration scenario was not found.');return {origin:'authored',scenario:createScenario(scenarioId)};}
    if(selectors[0]==='portfolio'){
      object(input.portfolio,['actionId','adversary','now'],'Portfolio exploration');
      check(Number.isSafeInteger(input.expectedRevision)&&input.expectedRevision>=0,428,'REVISION_REQUIRED','Portfolio exploration requires the current server revision.');
      check(input.expectedRevision===current.revision,409,'REVISION_CONFLICT','The portfolio changed. Refresh before capturing the approved action.');
      const options={actionId:id(input.portfolio.actionId,'Action ID'),adversary:input.portfolio.adversary||'none',now:input.portfolio.now===undefined?at:instant(input.portfolio.now)};
      try{return {origin:'portfolio',scenario:createPortfolioScenario(current.state,options)};}catch(error){fail(error.code==='ACTION_NOT_FOUND'?404:error.code==='STALE_APPROVAL'?409:422,error.code||'EXPLORER_VALIDATION',error.message);}
    }
    check(input.plan&&typeof input.plan==='object'&&!Array.isArray(input.plan),422,'EXPLORER_VALIDATION','Supply a finite custom plan object.');boundedJson(input.plan,250000,'Custom plan');
    const scenario=structuredClone(input.plan);
    scenario.id=`custom:${typeof scenario.id==='string'?scenario.id.slice(0,120):'supplied-plan'}`;
    scenario.metadata={...(scenario.metadata&&typeof scenario.metadata==='object'&&!Array.isArray(scenario.metadata)?scenario.metadata:{}),origin:'user-supplied',assumptionNotice:'User-supplied contained premises. This is not asserted original portfolio state or authenticated authority.'};
    return {origin:'custom',scenario};
  }
  async function compute(kind,req,auth,input){
    object(input,['scenarioId','plan','portfolio','bounds','expectedRevision',...(kind==='run'?['mode']:[])],'Exploration request');boundedJson(input,1024*1024,'Exploration request');
    check(input.expectedRevision===undefined||(Number.isSafeInteger(input.expectedRevision)&&input.expectedRevision>=0),422,'EXPLORER_VALIDATION','Expected server revision must be a nonnegative safe integer.');
    const bounds=boundsFor(input.bounds),mode=kind==='run'?(input.mode||'guarded'):null;
    check(mode===null||['naive','guarded'].includes(mode),422,'EXPLORER_MODE','Choose naive or guarded execution.');
    const key=keyOf(req);
    const checkpoint=authorized(req,auth,active=>tx(()=>{
      const actor=actorOf(active);computeRole(actor);const digest=hash({operation:kind,input,actorRole:actor.role}),prior=cached(actor,key,digest);if(prior)return {cached:prior};
      const current=read(),at=clock(),selection=scenarioFor(input,current,at),lease=acquire();
      return {actor,digest,current,at,...selection,lease};
    }));
    if(checkpoint.cached)return checkpoint.cached;
    try{
      let report;
      try{report=kind==='compare'?await compareScenario(checkpoint.scenario,{bounds}):await explorePlan(checkpoint.scenario,{mode,bounds});}
      catch(error){fail(422,error.code||'EXPLORER_VALIDATION',error.message);}
      boundedJson(report,8*1024*1024,'Exploration report');
      return authorized(req,auth,active=>tx(()=>{
        const actor=actorOf(active);computeRole(actor);check(canonical(actor)===canonical(checkpoint.actor),403,'EXPLORER_ACTOR_CHANGED','The acting identity or role changed during exploration.');
        const prior=cached(actor,key,checkpoint.digest);if(prior)return prior;
        const runId=`exploration-${randomUUID()}`,completedAt=clock();
        const row={id:runId,kind,origin:checkpoint.origin,actor_json:JSON.stringify(actor),input_json:JSON.stringify({...input,bounds}),scenario_json:JSON.stringify(checkpoint.scenario),server_revision:checkpoint.current.revision,domain_revision:checkpoint.current.state.revision,snapshot_digest:checkpoint.origin==='portfolio'?hash(checkpoint.current.state):null,created_at:checkpoint.at,completed_at:completedAt,report_json:JSON.stringify(report)};
        db.prepare('INSERT INTO explorer_runs VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run(...Object.values(row),hash(row));
        db.prepare("UPDATE explorer_metadata SET revision=revision+1 WHERE id='runs'").run();
        const response=publicRun({row:{...row,record_digest:hash(row)},report,scenario:checkpoint.scenario,input});
        return remember(actor,key,checkpoint.digest,response,completedAt);
      }));
    }finally{release(checkpoint.lease);}
  }
  const run=(req,auth,input)=>compute('run',req,auth,input);
  const compare=(req,auth,input)=>compute('compare',req,auth,input);
  function scenarios(auth){actorOf(auth);return {items:scenarioCatalog.map(item=>({...item})),defaultBounds:DEFAULT_BOUNDS,maxBounds:EXPLORER_BOUNDS,limits:{maxInitialEvents:100,maxCustomPlanBytes:250000,maxConcurrentComputations:1},notice:NOTICE};}
  function getScenario(auth,scenarioId){actorOf(auth);scenarioId=id(scenarioId,'Scenario ID');check(scenarioCatalog.some(item=>item.id===scenarioId),404,'SCENARIO_NOT_FOUND','The authored exploration scenario was not found.');return {scenario:createScenario(scenarioId),origin:'authored',notice:NOTICE};}
  function get(auth,runId){actorOf(auth);return tx(()=>{const value=verifiedRun(id(runId,'Exploration ID'));const verifications=db.prepare('SELECT * FROM explorer_verifications WHERE run_id=? ORDER BY created_at DESC,id').all(runId).map(row=>{check(sealed(row)===row.record_digest,503,'EXPLORER_INTEGRITY','A stored replay result changed.');return {verificationId:row.id,variant:row.variant,verifiedAt:row.created_at,...JSON.parse(row.result_json)};});return {...publicRun(value),verifications};});}
  function list(auth,query=new URLSearchParams()){
    actorOf(auth);const values=query instanceof URLSearchParams?Object.fromEntries(query.entries()):query;object(values,['limit','cursor','kind','origin','actorId'],'Exploration list query');
    const limit=Number(values.limit??25);check(/^[1-9]\d*$/.test(String(values.limit??25))&&limit<=100,422,'EXPLORER_VALIDATION','Exploration page limit must be from1 to100.');
    const filters={kind:values.kind||'',origin:values.origin||'',actorId:values.actorId||''};
    check(!filters.kind||['run','compare'].includes(filters.kind),422,'EXPLORER_VALIDATION','Choose run or compare.');check(!filters.origin||['authored','custom','portfolio'].includes(filters.origin),422,'EXPLORER_VALIDATION','Choose authored, custom or portfolio origin.');check(typeof filters.actorId==='string'&&filters.actorId.length<=200,422,'EXPLORER_VALIDATION','Actor filter must be bounded text.');
    return tx(()=>{
      const revision=db.prepare("SELECT revision FROM explorer_metadata WHERE id='runs'").get().revision,filterDigest=hash(filters);let offset=0;
      if(values.cursor){try{check(typeof values.cursor==='string'&&values.cursor.length<=4096,422,'CURSOR_INVALID','The exploration cursor must be bounded text.');const cursor=JSON.parse(Buffer.from(values.cursor,'base64url').toString());object(cursor,['v','revision','filterDigest','offset'],'Exploration cursor');check(cursor.v===1&&Number.isSafeInteger(cursor.offset)&&cursor.offset>=0,422,'CURSOR_INVALID','The exploration cursor is invalid.');check(cursor.revision===revision&&cursor.filterDigest===filterDigest,409,'CURSOR_STALE','Exploration records or filters changed. Restart the list.');offset=cursor.offset;}catch(error){if(error.status)throw error;fail(422,'CURSOR_INVALID','The exploration cursor is invalid.');}}
      const rows=db.prepare('SELECT id,kind,origin,actor_json FROM explorer_runs ORDER BY created_at DESC,id').all().filter(row=>(!filters.kind||row.kind===filters.kind)&&(!filters.origin||row.origin===filters.origin)&&(!filters.actorId||JSON.parse(row.actor_json).id===filters.actorId));
      const items=rows.slice(offset,offset+limit).map(row=>publicRun(verifiedRun(row.id),{full:false}));
      const nextCursor=offset+limit<rows.length?Buffer.from(JSON.stringify({v:1,revision,filterDigest,offset:offset+limit})).toString('base64url'):null;
      return {items,nextCursor,revision,total:rows.length,limit,notice:NOTICE};
    });
  }
  function packet(auth,runId,{variant}={}){
    actorOf(auth);return tx(()=>{
      const value=verifiedRun(id(runId,'Exploration ID'));
      if(value.row.kind==='run'){check(!variant||variant===value.report.mode,422,'EXPLORER_VARIANT','This run contains one execution mode.');return value.report;}
      variant=variant||'guarded';check(['naive','guarded','repair'].includes(variant),422,'EXPLORER_VARIANT','Choose naive, guarded or repair.');
      const result=variant==='repair'?value.report.repair?.report:value.report[variant];check(result,404,'REPAIR_NOT_AVAILABLE','No automatic repair applies to this contained plan.');return result;
    });
  }
  async function verify(req,auth,input){
    object(input,['runId','variant','packet'],'Exploration verification');check((input.runId!==undefined)!==(input.packet!==undefined),422,'EXPLORER_SELECTOR','Choose one recorded run or one supplied exploration packet.');boundedJson(input,2*1024*1024,'Verification input');
    const key=keyOf(req);
    const checkpoint=authorized(req,auth,active=>tx(()=>{
      const actor=actorOf(active);computeRole(actor);const digest=hash({operation:'verify',input,actorRole:actor.role}),prior=cached(actor,key,digest);if(prior)return {cached:prior};
      const value=input.runId?packet(active,input.runId,{variant:input.variant}):structuredClone(input.packet);check(value&&typeof value==='object'&&!Array.isArray(value),422,'EXPLORER_VALIDATION','Supply an exploration packet object.');boundsFor(value.bounds);boundedJson(value,2*1024*1024,'Exploration packet');
      return {actor,digest,packet:value,lease:acquire(),at:clock()};
    }));
    if(checkpoint.cached)return checkpoint.cached;
    try{
      const result=await verifyExplorationPacket(checkpoint.packet);
      return authorized(req,auth,active=>tx(()=>{
        const actor=actorOf(active);computeRole(actor);check(canonical(actor)===canonical(checkpoint.actor),403,'EXPLORER_ACTOR_CHANGED','The acting identity or role changed during replay.');
        const prior=cached(actor,key,checkpoint.digest);if(prior)return prior;
        const verificationId=`verification-${randomUUID()}`,at=clock(),row={id:verificationId,run_id:input.runId||null,variant:input.variant||null,actor_json:JSON.stringify(actor),created_at:at,packet_json:JSON.stringify(checkpoint.packet),result_json:JSON.stringify(result)};
        db.prepare('INSERT INTO explorer_verifications VALUES(?,?,?,?,?,?,?,?)').run(...Object.values(row),hash(row));
        return remember(actor,key,checkpoint.digest,{verificationId,...(input.runId?{runId:input.runId}:{}),packetDigest:checkpoint.packet.digest||null,verifiedAt:at,...result,notice:'Digest, retained traces and bounded search replay only; supplied premises are not authenticated.'},at);
      }));
    }finally{release(checkpoint.lease);}
  }
  function verifyIntegrity(){try{return tx(()=>{
    const runs=db.prepare('SELECT id FROM explorer_runs').all();for(const row of runs)verifiedRun(row.id);
    const verifications=db.prepare('SELECT * FROM explorer_verifications').all();for(const row of verifications){check(sealed(row)===row.record_digest,503,'EXPLORER_INTEGRITY','A stored replay result changed.');JSON.parse(row.packet_json);JSON.parse(row.result_json);if(row.run_id)check(db.prepare('SELECT id FROM explorer_runs WHERE id=?').get(row.run_id),503,'EXPLORER_INTEGRITY','A replay lost its exploration record.');}
    const requests=db.prepare('SELECT * FROM explorer_requests').all();for(const row of requests){check(hash(row.response_json)===row.response_digest,503,'EXPLORER_INTEGRITY','A stored exploration response changed.');JSON.parse(row.response_json);}
    return {valid:true,runs:runs.length,verifications:verifications.length,cachedRequests:requests.length,scope:'Local record digests and packet consistency; independent bounded replay is an explicit verification operation.'};
  });}catch(error){return {valid:false,reason:error.message,code:error.code||'EXPLORER_INTEGRITY'};}}
  return {scenarios,getScenario,run,compare,get,list,packet,verify,verifyIntegrity};
}
