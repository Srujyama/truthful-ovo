import {createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import {operationQueue,vendorSummaries,sourceLibrary,sourceUsages,workspaceActivity,financialReport,reportCsv} from '../src/operations.mjs';
import {isDate} from '../src/assurance/index.mjs';

const fail=(status,code,message)=>{throw Object.assign(new Error(message),{status,code});};
const allowed=new Set(['cursor','limit','asOf','knownAt','q','vendorId','category','kind','versions','actor','type','from','through','status','reference']);
const pageFields=['cursor','limit','asOf','knownAt'];
const fieldsByKind={operations:[...pageFields,'q','vendorId','category'],vendors:[...pageFields,'q','vendorId'],commitments:[...pageFields,'q','vendorId','status','reference'],credits:[...pageFields,'q','vendorId','status','reference'],sources:[...pageFields,'q','vendorId','kind','versions'],activity:[...pageFields,'q','vendorId','actor','type','from','through'],audit:[...pageFields,'q','actor','type','from','through'],'source-detail':['asOf','knownAt'],'financial-report':['asOf','knownAt']};
const search=(text,q)=>!q||String(text).toLowerCase().includes(q.toLowerCase());

export function createQueryManager({db,now,read,engine,audit}) {
 db.exec('CREATE TABLE IF NOT EXISTS backend_settings (key TEXT PRIMARY KEY,value TEXT NOT NULL) STRICT');
 db.prepare('INSERT OR IGNORE INTO backend_settings VALUES(?,?)').run('cursor-key',randomBytes(32).toString('hex'));
 const key=Buffer.from(db.prepare('SELECT value FROM backend_settings WHERE key=?').get('cursor-key').value,'hex');
 const sign=text=>createHmac('sha256',key).update(text).digest('base64url');
 const encode=value=>{const data=Buffer.from(JSON.stringify(value)).toString('base64url');return `${data}.${sign(data)}`;};
 const decode=value=>{
  if(typeof value!=='string'||value.length>5000)fail(400,'INVALID_CURSOR','Use the opaque cursor returned by this workspace.');
  const [data,signature,...extra]=value.split('.'),expected=sign(data||'');
  if(extra.length||!signature||Buffer.byteLength(signature)!==Buffer.byteLength(expected)||!timingSafeEqual(Buffer.from(signature),Buffer.from(expected)))fail(400,'INVALID_CURSOR','Cursor signature is invalid for this workspace.');
   try{const parsed=JSON.parse(Buffer.from(data,'base64url').toString());if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Error();return parsed;}catch{fail(400,'INVALID_CURSOR','Cursor content is invalid.');}
 };
 const filters=(url,kind)=>{
  const permitted=new Set(fieldsByKind[kind]||[]),seen=new Set();for(const [name,value]of url.searchParams){if(!allowed.has(name)||!permitted.has(name)||seen.has(name)||value.length>5000)fail(400,'INVALID_QUERY','Query fields must be unique, bounded and supported for this resource.');seen.add(name);}
  const input=Object.fromEntries([...url.searchParams].filter(([name])=>!['cursor','limit'].includes(name)));
  for(const [name,value]of Object.entries(input))if(value.length>200)fail(400,'INVALID_QUERY',`${name} is too long.`);
  if(input.versions&&!['current','all'].includes(input.versions))fail(400,'INVALID_QUERY','Revisions must be current or all.');
  for(const name of ['from','through'])if(input[name]&&!isDate(input[name]))fail(400,'INVALID_QUERY','Activity and audit ranges require real YYYY-MM-DD dates.');
  if(input.from&&input.through&&input.from>input.through)fail(400,'INVALID_QUERY','The range start must be on or before its end.');
  return input;
 };
 function context(url,kind){
  const requested=filters(url,kind),row=read();let filter=requested,offset=0;
  if(url.searchParams.has('cursor')){
   const cursor=decode(url.searchParams.get('cursor'));
   if(cursor.v!==1||cursor.kind!==kind||cursor.workspaceId!==row.state.id||!Number.isSafeInteger(cursor.offset)||cursor.offset<0||!cursor.filters||typeof cursor.filters!=='object')fail(400,'INVALID_CURSOR','Cursor belongs to a different query or workspace.');
   if(cursor.revision!==row.revision)fail(409,'CURSOR_STALE','The workspace changed. Restart this query from its first page.');
   for(const [name,value]of Object.entries(requested))if(cursor.filters[name]!==value)fail(400,'CURSOR_FILTER_MISMATCH','Do not change filters while continuing a cursor.');
   filter=cursor.filters;offset=cursor.offset;
  } else filter={...filter,asOf:filter.asOf||now().slice(0,10),knownAt:filter.knownAt||now()};
  const raw=url.searchParams.get('limit')||'25';if(!/^\d+$/.test(raw)||Number(raw)<1||Number(raw)>100)fail(400,'INVALID_LIMIT','Choose a limit from 1 to 100.');
  const view=engine.evaluateWorkspace(row.state,{asOf:filter.asOf,knownAt:filter.knownAt});
  return{row,view,filter,offset,limit:Number(raw)};
 }
 const pages=(items,c,kind)=>{
  const result=items.slice(c.offset,c.offset+c.limit),next=c.offset+result.length;
  return{items:result,total:items.length,nextCursor:next<items.length?encode({v:1,kind,workspaceId:c.row.state.id,revision:c.row.revision,filters:c.filter,offset:next}):null,revision:c.row.revision,domainRevision:c.row.state.revision,projection:{asOf:c.view.asOf,knownAt:c.view.knownAt},scope:'Recorded workspace projection. No external source authentication or settlement.'};
 };
 function query(kind,url){
  const c=context(url,kind),{view,filter:f}=c;let items;
  switch(kind){
   case 'operations':items=operationQueue(view,{query:f.q,vendorId:f.vendorId,category:f.category});break;
   case 'vendors':items=vendorSummaries(view,{query:f.q}).filter(v=>!f.vendorId||v.id===f.vendorId);break;
   case 'commitments':items=view.commitments.filter(v=>(!f.vendorId||v.vendorId===f.vendorId)&&(!f.status||v.status===f.status)&&(!f.reference||v.reference===f.reference)&&search(`${v.id} ${v.reference}`,f.q));break;
   case 'credits':items=view.credits.filter(v=>(!f.vendorId||v.vendorId===f.vendorId)&&(!f.status||v.status===f.status)&&(!f.reference||v.reference===f.reference)&&search(`${v.id} ${v.invoiceId} ${v.reference}`,f.q)).map(v=>({id:v.id,vendorId:v.vendorId,invoiceId:v.invoiceId,lineId:v.lineId,reference:v.reference,currency:v.currency,status:v.status,amountCents:v.amountCents,availableCents:v.availableCents,allocatedCents:v.allocatedCents,unallocatedCents:v.unallocatedCents,reversedCents:v.reversedCents,quarantined:v.quarantined,candidateCommitmentIds:v.candidateCommitmentIds}));break;
   case 'sources':items=sourceLibrary(view,{query:f.q,vendorId:f.vendorId,kind:f.kind,versions:f.versions||'current'}).map(s=>({id:s.id,key:s.key,vendorId:s.vendorId,title:s.title,kind:s.kind,revision:s.revision,observedAt:s.observedAt,effectiveDate:s.effectiveDate,characters:s.text.length}));break;
   case 'activity':items=workspaceActivity(c.row.state,view,{query:f.q,vendorId:f.vendorId,actorId:f.actor,type:f.type,fromDate:f.from,toDate:f.through});break;
   case 'audit':items=audit().filter(e=>e.at<=view.knownAt&&(!f.actor||e.actor.role===f.actor||e.actor.id===f.actor)&&(!f.type||e.command.type===f.type||e.command.commands?.some(c=>c.type===f.type))&&(!f.from||e.at.slice(0,10)>=f.from)&&(!f.through||e.at.slice(0,10)<=f.through)&&search(`${e.command.type} ${e.actor.id} ${e.actor.role} ${e.actor.name||''}`,f.q)).map(e=>({sequence:e.sequence,at:e.at,actor:e.actor,type:e.command.type,beforeRevision:e.beforeRevision,afterRevision:e.afterRevision,hash:e.hash,previousHash:e.previousHash}));break;
   default:fail(404,'NOT_FOUND','No query matches this resource.');
  }
  if(!['operations','activity','audit'].includes(kind))items.sort((a,b)=>String(a.id).localeCompare(String(b.id))||(a.revision||0)-(b.revision||0));
  return pages(items,c,kind);
 }
 function source(id,revision,url){
  if(typeof id!=='string'||id.length>200||!/^\d+$/.test(revision))fail(400,'INVALID_SOURCE_REFERENCE','Use an exact source ID and positive revision.');
  const c=context(url,'source-detail'),s=c.view.sourceVersions.find(s=>s.id===id&&s.revision===Number(revision));
  if(!s)fail(404,'NOT_FOUND','That exact source revision is not known at this cutoff.');
  return{source:s,usages:sourceUsages(c.view,s.id,s.revision),revision:c.row.revision,projection:{asOf:c.view.asOf,knownAt:c.view.knownAt}};
 }
 function report(url,csv=false){
  const c=context(url,'financial-report'),report=financialReport(c.row.state,{asOf:c.view.asOf,knownAt:c.view.knownAt});
  return csv?reportCsv(report):{...report,revision:c.row.revision,domainRevision:c.row.state.revision,notice:'Related financial measures must not be added together. Missing evidence is unknown; no external settlement or customer savings is established.'};
 }
 return{query,source,report};
}
