import {createServer} from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,chmodSync,existsSync,rmSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {randomUUID,timingSafeEqual} from 'node:crypto';
import {createIdentityStore} from './identity.mjs';
import {createServiceSync,ServiceError} from './service.mjs';
import * as engine from '../src/assurance/index.mjs';
const {createWorkspace}=engine;
import {acquireDataLease} from './maintenance.mjs';

const COOKIE='truthful_session';
const fail=(status,code,message)=>{throw new ServiceError(status,code,message);};
const equal=(a,b)=>typeof a==='string'&&typeof b==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
export const sessionToken=req=>{const raw=req.headers.cookie||'';if(raw.length>8192)return null;const values=raw.split(';').map(v=>v.trim()).filter(v=>v.startsWith(`${COOKIE}=`));return values.length===1&&/^[a-f0-9]{64}$/.test(values[0].slice(COOKIE.length+1))?values[0].slice(COOKIE.length+1):null;};
export const publicSession=auth=>({actor:auth?.actor||null,user:auth?.user||null,workspace:auth?.workspace||null,workspaces:auth?.workspaces||[],csrfToken:auth?.csrf_token||auth?.csrfToken||null,authMode:'managed-password',roles:[],notice:'Workspace membership determines authority. Recorded evidence and local execution do not establish external delivery, settlement or savings.'});

export async function createManagedService({dataDir,clock=()=>new Date().toISOString(),allowedOrigins=[],secureCookies=false,logger=()=>{},identityOptions={}}={}){
 if(!dataDir)throw new Error('Managed mode requires an explicit data directory.');
 dataDir=resolve(dataDir);mkdirSync(dataDir,{recursive:true,mode:0o700});chmodSync(dataDir,0o700);
 const release=acquireDataLease(dataDir,'managed-server');
 const origins=new Set(allowedOrigins),children=new Map();let closing=false,listening=false,activeHashes=0;
 for(const origin of origins){const u=new URL(origin);if(u.origin!==origin||!((u.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(u.hostname))||u.protocol==='https:')){release();throw new Error('Configure exact HTTPS or loopback origins.');}if(u.protocol==='https:'&&!secureCookies){release();throw new Error('HTTPS origins require secure cookies.');}}
 let identity,registry;
 try{identity=createIdentityStore({dbPath:join(dataDir,'identity.sqlite'),clock,secureCookies,...identityOptions});registry=new DatabaseSync(join(dataDir,'identity.sqlite'),{readOnly:true});}catch(error){identity?.close();release();throw error;}
 const cookie=(token,maxAge=8*60*60)=>`${COOKIE}=${token}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secureCookies?'; Secure':''}`;
 const json=(res,status,value,extra={})=>{const body=JSON.stringify(value);res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Length':Buffer.byteLength(body),...extra});res.end(body);};
 const requireOrigin=req=>{if(!origins.has(req.headers.origin))fail(403,'ORIGIN_FORBIDDEN','Use a configured application origin.');};
 const authFor=req=>identity.resolveSession(sessionToken(req));
 const requireAuth=req=>{const auth=authFor(req);if(!auth)fail(401,'SESSION_REQUIRED','Sign in before accessing a workspace.');return auth;};
 const csrf=(req,auth)=>{if(!equal(req.headers['x-csrf-token'],auth.csrf_token))fail(403,'CSRF_INVALID','Refresh your session before retrying.');};
 const body=async req=>{if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))fail(415,'JSON_REQUIRED','Use application/json.');let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size<=65536)chunks.push(chunk);}if(size>65536)fail(413,'BODY_TOO_LARGE','Account requests must fit within 64 KiB.');try{const value=JSON.parse(Buffer.concat(chunks));if(!value||typeof value!=='object'||Array.isArray(value))throw new Error();return value;}catch{fail(400,'INVALID_JSON','Send one JSON object.');}};
 const hashing=async callback=>{if(activeHashes>=4)fail(429,'AUTHENTICATION_BUSY','Authentication is busy. Retry shortly.');activeHashes++;try{return await callback();}finally{activeHashes--;}};
 const workspaceIds=()=>registry.prepare('SELECT id,name FROM workspaces ORDER BY id').all();
 const loadChild=(workspace,{create=false}={})=>{
  const path=join(dataDir,`workspace-${workspace.id}.sqlite`);
  if(children.has(workspace.id))return children.get(workspace.id);
  if(!create&&!existsSync(path))throw new Error(`Missing registered workspace database ${workspace.id}. Restore its verified backup; an empty ledger cannot replace it.`);
  if(create&&existsSync(path))throw new Error('New workspace storage already exists. Refusing to replace it.');
  const service=createServiceSync({engine,dbPath:path,clock,allowedOrigins:[...origins],allowHttpsOrigins:secureCookies,initialWorkspace:createWorkspace({id:workspace.id}),authProvider:{
   resolveSession(req){const auth=authFor(req);return auth?.workspace?.id===workspace.id?auth:null;},
   authorize(req,_auth,callback){return identity.withAuthorization(sessionToken(req),workspace.id,callback);},
   sessionPayload:publicSession,
  }});
  if(service.operations.read().state.id!==workspace.id){service.close();throw new Error('Financial workspace file identity differs from its registered workspace.');}
  chmodSync(path,0o600);children.set(workspace.id,service);return service;
 };
 const child=async workspace=>{
  if(!/^[a-f0-9-]{36}$/.test(workspace.id)||!registry.prepare('SELECT 1 FROM workspaces WHERE id=?').get(workspace.id))fail(404,'WORKSPACE_NOT_FOUND','Workspace is unavailable.');
  return loadChild(workspace);
 };
 const provisioned=async callback=>{
  let created;
  try{return await callback(workspace=>{if(existsSync(join(dataDir,`workspace-${workspace.id}.sqlite`)))throw new Error('New workspace storage already exists. Refusing to replace it.');created=workspace;loadChild(workspace,{create:true});});}
  catch(error){if(created){const service=children.get(created.id);if(service)await service.close();children.delete(created.id);for(const suffix of ['', '-wal','-shm'])rmSync(join(dataDir,`workspace-${created.id}.sqlite${suffix}`),{force:true});}throw error;}
 };
 const readiness=async()=>{if(registry.prepare('PRAGMA quick_check').get().quick_check!=='ok')fail(503,'IDENTITY_INTEGRITY_FAILURE','Identity database failed its structural check.');const checks=[];for(const workspace of workspaceIds()){const service=await child(workspace);checks.push({workspaceId:workspace.id,...service.operations.readiness({force:true})});}return checks;};
 const handle=async(req,res)=>{
  const requestId=randomUUID(),started=performance.now();res.setHeader('X-Request-Id',requestId);res.setHeader('Referrer-Policy','no-referrer');
  res.once('finish',()=>{try{logger({requestId,method:req.method,path:(req.url||'').split('?')[0].slice(0,200),status:res.statusCode,durationMs:Math.round(performance.now()-started)});}catch{}});
  try{
   if(closing)fail(503,'SHUTTING_DOWN','The backend is shutting down.');
   const host=req.headers.host||'';if(!/^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/.test(host))fail(403,'HOST_FORBIDDEN','Use the configured loopback backend host.');
   const url=new URL(req.url,`http://${host}`),path=url.pathname;
   if(origins.has(req.headers.origin)){res.setHeader('Access-Control-Allow-Origin',req.headers.origin);res.setHeader('Access-Control-Allow-Credentials','true');res.setHeader('Vary','Origin');}
   if(req.method==='OPTIONS'){requireOrigin(req);res.writeHead(204,{'Access-Control-Allow-Methods':'GET,POST,DELETE,OPTIONS','Access-Control-Allow-Headers':'Content-Type,X-CSRF-Token,Idempotency-Key,If-Match'});res.end();return;}
   if(req.method==='GET'&&path==='/api/live'){json(res,200,{ok:true,mode:'managed'});return;}
   if(req.method==='GET'&&path==='/api/session'){json(res,200,publicSession(authFor(req)));return;}
   if(req.method==='POST'&&path==='/api/session')fail(403,'DEMO_AUTH_DISABLED','Sign in using an account; roles cannot be selected.');
   if(req.method==='POST'&&path==='/api/auth/login'){
    requireOrigin(req);const input=await body(req);if(Object.keys(input).some(k=>!['email','password'].includes(k)))fail(400,'VALIDATION','Provide email and password only.');const auth=await hashing(()=>identity.login({...input,ip:req.socket.remoteAddress}));json(res,200,publicSession(auth),{'Set-Cookie':cookie(auth.token)});return;
   }
   if(req.method==='POST'&&path==='/api/auth/invitations/accept'){requireOrigin(req);const input=await body(req),result=await hashing(()=>identity.acceptInvitation(input));json(res,201,result);return;}
   const auth=requireAuth(req);
   if(req.method==='GET'&&path==='/api/workspaces'){json(res,200,{workspaces:auth.workspaces,activeWorkspaceId:auth.workspace?.id||null});return;}
   if(req.method==='GET'&&path==='/api/security/audit'){const params=Object.fromEntries(url.searchParams);if(Object.keys(params).some(k=>!['limit','after'].includes(k)))fail(400,'VALIDATION','Unsupported audit query.');json(res,200,identity.audit(auth,Object.fromEntries(Object.entries(params).map(([k,v])=>[k,Number(v)]))));return;}
   if(req.method==='GET'&&path==='/api/health'){if(!auth.workspace)fail(403,'WORKSPACE_REQUIRED','Select an active workspace.');const service=await child(auth.workspace),checks=service.operations.readiness();json(res,200,{ok:true,mode:'managed',authMode:'managed-password',integrity:checks.financial,externalActions:false});return;}
   if(req.method==='GET'&&path==='/api/ready'){if(!auth.user.systemAdmin)fail(403,'FORBIDDEN','System administrator access is required.');const checks=await readiness();json(res,200,{ok:true,mode:'managed',authMode:'managed-password',workspaces:checks.length,checks,externalActions:false});return;}
   const accountRoutes=['/api/auth/logout','/api/auth/password','/api/workspaces','/api/workspaces/switch','/api/invitations','/api/memberships'];
   if((req.method==='POST'&&accountRoutes.includes(path))||(req.method==='DELETE'&&path==='/api/session')){
    requireOrigin(req);csrf(req,auth);const input=await body(req);let result;
    if(path==='/api/auth/logout'||path==='/api/session'){if(Object.keys(input).length)fail(400,'VALIDATION','Logout takes no fields.');result=identity.logout(sessionToken(req));json(res,200,result,{'Set-Cookie':cookie('',0)});return;}
    if(path==='/api/auth/password'){result=await hashing(()=>identity.changePassword(auth,input));json(res,200,result,{'Set-Cookie':cookie('',0)});return;}
    if(path==='/api/workspaces'){result=await provisioned(provision=>identity.createWorkspace(auth,input,{provision}));json(res,201,result);return;}
    if(path==='/api/workspaces/switch'){if(Object.keys(input).some(k=>k!=='workspaceId'))fail(400,'VALIDATION','Provide workspaceId only.');result=identity.switchWorkspace(sessionToken(req),input.workspaceId);json(res,200,publicSession(result));return;}
    if(path==='/api/invitations')result=identity.createInvitation(auth,input);
    if(path==='/api/memberships')result=identity.updateMembership(auth,input);
    json(res,200,result);return;
   }
   if(!auth.workspace)fail(403,'WORKSPACE_REQUIRED','Choose a workspace with active membership.');
   const service=await child(auth.workspace);await service.handle(req,res);
  }catch(error){if(!res.headersSent)json(res,error.status||500,{error:{code:error.code||'INTERNAL_ERROR',message:error.status?error.message:'The backend could not complete the request.'},requestId});else res.end();}
 };
 const server=createServer(handle);server.requestTimeout=15000;server.headersTimeout=10000;server.keepAliveTimeout=1000;
 try{await readiness();}catch(error){await Promise.allSettled([...children.values()].map(async pending=>(await pending).close()));registry.close();identity.close();release();throw error;}
 return {server,identity,child,readiness,dataDir,
  async bootstrap(input){return provisioned(provision=>identity.bootstrap(input,{provision}));},
  async listen({port=5174,host='127.0.0.1'}={}){if(!['127.0.0.1','::1','localhost'].includes(host))throw new Error('Managed backend binds loopback; use an authenticated TLS reverse proxy for deployment.');await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,()=>{server.off('error',reject);resolve();});});listening=true;const address=server.address(),baseUrl=`http://${address.family==='IPv6'?'[::1]':'127.0.0.1'}:${address.port}`;origins.add(baseUrl);for(const pending of children.values())(await pending).addOrigin(baseUrl);return {baseUrl,port:address.port};},
  async close(){closing=true;if(listening){await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));listening=false;}await Promise.allSettled([...children.values()].map(async value=>(await value).close()));registry.close();identity.close();release();},
 };
}
