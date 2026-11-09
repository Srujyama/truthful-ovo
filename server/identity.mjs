import {DatabaseSync} from 'node:sqlite';
import {createHash,randomBytes,randomUUID,scrypt,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {chmodSync,existsSync,mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';

const derive=promisify(scrypt);
const ROLES=new Set(['viewer','analyst','approver','executor','admin']);
const TOKEN=/^[a-f0-9]{64}$/;
const PASSWORD_OPTIONS={N:32768,r:8,p:1,maxmem:128*1024*1024};
const AUTH_MESSAGE='Email or password is incorrect, or authentication is temporarily unavailable.';
const digest=value=>createHash('sha256').update(value).digest('hex');
const token=()=>randomBytes(32).toString('hex');
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
export class IdentityError extends Error{
 constructor(status,code,message){super(message);this.name='IdentityError';this.status=status;this.code=code;}
}
const fail=(status,code,message)=>{throw new IdentityError(status,code,message);};
const authFailure=()=>fail(401,'AUTHENTICATION_FAILED',AUTH_MESSAGE);
function fields(value,allowed){
 if(!value||Array.isArray(value)||typeof value!=='object'||Object.keys(value).some(key=>!allowed.includes(key)))fail(400,'VALIDATION','Provide only the supported fields.');
 return value;
}
function label(value,name,max=120){
 if(typeof value!=='string'||!value.trim()||value.length>max||/[\u0000-\u001f\u007f]/.test(value))fail(400,'VALIDATION',`${name} must contain 1–${max} characters without control characters.`);
 return value.trim();
}
function email(value){
 if(typeof value!=='string'||value.length>254)fail(400,'VALIDATION','Provide a valid email address.');
 const normalized=value.trim().toLowerCase();
 if(!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(normalized)||normalized.split('@')[0].length>64||normalized.includes('..'))fail(400,'VALIDATION','Provide a valid email address.');
 return normalized;
}
function password(value){
 if(typeof value!=='string'||value.length<12||value.length>256||value.includes('\0')||Buffer.byteLength(value)>1024)fail(400,'VALIDATION','Use a password of 12–256 characters without NUL characters.');
 return value;
}
function role(value){if(!ROLES.has(value))fail(400,'VALIDATION','Choose a supported workspace role.');return value;}
async function hashPassword(value){
 const salt=randomBytes(16).toString('hex'),key=await derive(password(value),Buffer.from(salt,'hex'),64,PASSWORD_OPTIONS);
 return JSON.stringify({version:1,algorithm:'scrypt',N:32768,r:8,p:1,salt,key:key.toString('hex')});
}
async function checkPassword(value,serialized){
 let record;
 try{password(value);record=JSON.parse(serialized);if(record.version!==1||record.algorithm!=='scrypt'||record.N!==32768||record.r!==8||record.p!==1||!/^[a-f0-9]{32}$/.test(record.salt)||!/^[a-f0-9]{128}$/.test(record.key))return false;}
 catch{return false;}
 const calculated=await derive(value,Buffer.from(record.salt,'hex'),64,PASSWORD_OPTIONS);
 return timingSafeEqual(calculated,Buffer.from(record.key,'hex'));
}
const publicUser=row=>({id:row.id,email:row.email,name:row.name,systemAdmin:row.system_admin===1});
const publicMembership=row=>({workspaceId:row.workspace_id,userId:row.user_id,role:row.role,active:row.active===1});
const publicWorkspace=row=>({id:row.id,name:row.name});

/** Managed local identity foundation. No OIDC, MFA, email delivery or external
 * identity verification is implied. Use a separate database from finance. */
export function createIdentityStore({dbPath=':memory:',clock=()=>new Date().toISOString(),sessionMs=8*60*60*1000,idleMs=Math.min(sessionMs,30*60*1000),secureCookies=true,loginLimit=5,loginWindowMs=15*60*1000,loginBlockMs=15*60*1000}={}){
 for(const [name,value]of Object.entries({sessionMs,idleMs,loginLimit,loginWindowMs,loginBlockMs}))if(!Number.isSafeInteger(value)||value<1)throw new Error(`${name} must be a positive integer.`);
 if(sessionMs>30*24*60*60*1000||idleMs>sessionMs||loginLimit>100||loginWindowMs>24*60*60*1000||loginBlockMs>24*60*60*1000)throw new Error('Identity lifetime or throttle configuration exceeds its supported bounds.');
 if(typeof secureCookies!=='boolean')throw new Error('secureCookies must be boolean.');
 if(typeof dbPath!=='string'||!dbPath)throw new Error('Provide an identity database path.');
 const freshFile=dbPath!==':memory:'&&!existsSync(dbPath);
 if(dbPath!==':memory:')mkdirSync(dirname(resolve(dbPath)),{recursive:true,mode:0o700});
 const db=new DatabaseSync(dbPath);
 if(freshFile)chmodSync(dbPath,0o600);
 const tx=callback=>{
  const own=!db.isTransaction;if(own)db.exec('BEGIN IMMEDIATE');
  try{const result=callback();if(result&&typeof result.then==='function')throw new Error('Identity authorization callbacks must be synchronous.');if(own)db.exec('COMMIT');return result;}
  catch(error){if(own&&db.isTransaction)db.exec('ROLLBACK');throw error;}
 };
 try{
  db.exec('PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
  tx(()=>{
   const version=db.prepare('PRAGMA user_version').get().user_version;
   if(version!==0&&version!==1)throw new Error('Unsupported identity database schema version.');
   if(version===0){
    if(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().length)throw new Error('Refusing to initialize an unrelated database as an identity store.');
    db.exec(`CREATE TABLE identity_meta(id INTEGER PRIMARY KEY CHECK(id=1),purpose TEXT NOT NULL,last_clock INTEGER NOT NULL,dummy_hash TEXT NOT NULL) STRICT;
     CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,name TEXT NOT NULL,password_hash TEXT NOT NULL,password_version INTEGER NOT NULL,system_admin INTEGER NOT NULL CHECK(system_admin IN(0,1)),active INTEGER NOT NULL CHECK(active IN(0,1)),created_at INTEGER NOT NULL) STRICT;
     CREATE TABLE workspaces(id TEXT PRIMARY KEY,name TEXT NOT NULL,created_by TEXT NOT NULL REFERENCES users(id),created_at INTEGER NOT NULL) STRICT;
     CREATE TABLE memberships(workspace_id TEXT NOT NULL REFERENCES workspaces(id),user_id TEXT NOT NULL REFERENCES users(id),role TEXT NOT NULL CHECK(role IN('viewer','analyst','approver','executor','admin')),active INTEGER NOT NULL CHECK(active IN(0,1)),created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,PRIMARY KEY(workspace_id,user_id)) STRICT;
     CREATE TABLE invitations(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL REFERENCES workspaces(id),email TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN('viewer','analyst','approver','executor','admin')),name TEXT NOT NULL,token_hash TEXT NOT NULL UNIQUE,created_by TEXT NOT NULL REFERENCES users(id),created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,used_at INTEGER,revoked_at INTEGER) STRICT;
     CREATE INDEX invitation_email_workspace ON invitations(email,workspace_id);
     CREATE TABLE sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),active_workspace_id TEXT REFERENCES workspaces(id),csrf_token TEXT NOT NULL,password_version INTEGER NOT NULL,created_at INTEGER NOT NULL,last_seen_at INTEGER NOT NULL,expires_at INTEGER NOT NULL) STRICT;
     CREATE INDEX session_user ON sessions(user_id);
     CREATE TABLE login_throttle(scope TEXT NOT NULL,key_hash TEXT NOT NULL,window_start INTEGER NOT NULL,attempts INTEGER NOT NULL,blocked_until INTEGER NOT NULL,PRIMARY KEY(scope,key_hash)) STRICT;
     CREATE TABLE security_audit(sequence INTEGER PRIMARY KEY,at INTEGER NOT NULL,kind TEXT NOT NULL,actor_id TEXT,workspace_id TEXT,detail_json TEXT NOT NULL) STRICT;
     PRAGMA user_version=1;`);
    db.prepare('INSERT INTO identity_meta VALUES(1,?,0,?)').run('truthful-managed-identity-v1',JSON.stringify({version:1,algorithm:'scrypt',N:32768,r:8,p:1,salt:randomBytes(16).toString('hex'),key:randomBytes(64).toString('hex')}));
   }
   if(db.prepare('SELECT purpose FROM identity_meta WHERE id=1').get()?.purpose!=='truthful-managed-identity-v1')throw new Error('Identity database purpose mismatch.');
  });
 }catch(error){db.close();throw error;}
 let closed=false;
 const now=()=>{
  const value=clock(),raw=value instanceof Date?value.valueOf():typeof value==='number'?value:Date.parse(value);
  if(!Number.isSafeInteger(raw))throw new Error('Identity clock must return a valid time.');
  const prior=db.prepare('SELECT last_clock FROM identity_meta WHERE id=1').get().last_clock;
  const result=Math.max(raw,prior);if(result>prior)db.prepare('UPDATE identity_meta SET last_clock=? WHERE id=1').run(result);return result;
 };
 const event=(kind,actorId,workspaceId,detail={},at=now())=>{
  // Only hand-authored IDs, role labels and booleans enter this table. No
  // credential, token, digest, source text, email or network address is logged.
  db.prepare('INSERT INTO security_audit(at,kind,actor_id,workspace_id,detail_json) VALUES(?,?,?,?,?)').run(at,kind,actorId||null,workspaceId||null,JSON.stringify(detail));
 };
 const memberships=userId=>db.prepare('SELECT w.id,w.name,m.role FROM memberships m JOIN workspaces w ON w.id=m.workspace_id WHERE m.user_id=? AND m.active=1 ORDER BY w.created_at,w.id').all(userId);
 const loadSession=(hash,{touch=false}={})=>{
  if(!TOKEN.test(hash||''))return null;
  const row=db.prepare('SELECT * FROM sessions WHERE token_hash=?').get(hash);if(!row)return null;
  const at=now(),user=db.prepare('SELECT * FROM users WHERE id=?').get(row.user_id);
  if(!user||!user.active||user.password_version!==row.password_version||row.expires_at<=at||row.last_seen_at+idleMs<=at){db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hash);return null;}
  const all=memberships(user.id),workspace=all.find(item=>item.id===row.active_workspace_id)||null;
  if(row.active_workspace_id&&!workspace){db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hash);return null;}
  if(!workspace&&!user.system_admin){db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hash);return null;}
  if(touch&&at>row.last_seen_at)db.prepare('UPDATE sessions SET last_seen_at=? WHERE token_hash=?').run(at,hash);
  return {actor:{id:user.id,role:workspace?.role||'none',name:user.name},user:publicUser(user),workspace:workspace?publicWorkspace(workspace):null,workspaces:all.map(item=>({...publicWorkspace(item),role:item.role})),activeWorkspaceId:workspace?.id||null,csrfToken:row.csrf_token,csrf_token:row.csrf_token,token_hash:hash,createdAt:new Date(row.created_at).toISOString(),expiresAt:new Date(row.expires_at).toISOString(),lastSeenAt:new Date(touch?at:row.last_seen_at).toISOString()};
 };
 const requireSession=session=>{const result=loadSession(session?.token_hash);if(!result)fail(401,'SESSION_REQUIRED','Sign in with an active managed session.');return result;};
 const requireAdmin=(session,workspaceId)=>{
  const auth=requireSession(session),membership=db.prepare('SELECT * FROM memberships WHERE workspace_id=? AND user_id=? AND active=1').get(workspaceId,auth.user.id);
  if(!membership||membership.role!=='admin')fail(403,'FORBIDDEN','An active administrator of this workspace is required.');return auth;
 };
 const invalidateUser=userId=>db.prepare('DELETE FROM sessions WHERE user_id=?').run(userId);
 const invitationRow=(secret,at)=>{
  if(!TOKEN.test(secret||''))fail(400,'INVITATION_INVALID','This invitation is invalid, expired or already used.');
  const row=db.prepare('SELECT * FROM invitations WHERE token_hash=?').get(digest(secret));
  if(!row||row.used_at!=null||row.revoked_at!=null||row.expires_at<=at)fail(400,'INVITATION_INVALID','This invitation is invalid, expired or already used.');
  const creator=db.prepare("SELECT m.role,m.active,u.active AS user_active FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.workspace_id=? AND m.user_id=?").get(row.workspace_id,row.created_by);
  if(!creator||creator.role!=='admin'||!creator.active||!creator.user_active)fail(400,'INVITATION_INVALID','This invitation is invalid, expired or already used.');return row;
 };
 const publicInvitation=row=>({id:row.id,workspaceId:row.workspace_id,email:row.email,role:row.role,name:row.name,createdAt:new Date(row.created_at).toISOString(),expiresAt:new Date(row.expires_at).toISOString()});
 const throttleKeys=(address,ip)=>[{scope:'email',key:digest(address)},{scope:'ip',key:digest(typeof ip==='string'&&ip.length<=200?ip:'unknown')}];
 const reserveAttempt=(address,ip)=>tx(()=>{
  const at=now();db.prepare('DELETE FROM login_throttle WHERE blocked_until<=? AND window_start<=?').run(at,at-loginWindowMs);
  db.prepare('DELETE FROM sessions WHERE expires_at<=? OR last_seen_at<=?').run(at,at-idleMs);
  const keys=throttleKeys(address,ip);
  if(keys.some(({scope,key})=>(db.prepare('SELECT blocked_until FROM login_throttle WHERE scope=? AND key_hash=?').get(scope,key)?.blocked_until||0)>at))return false;
  for(const {scope,key}of keys){
   const prior=db.prepare('SELECT * FROM login_throttle WHERE scope=? AND key_hash=?').get(scope,key);
   if(!prior&&db.prepare('SELECT COUNT(*) AS count FROM login_throttle').get().count>=10000)return false;
   const attempts=prior&&prior.window_start+loginWindowMs>at?prior.attempts+1:1,windowStart=prior&&prior.window_start+loginWindowMs>at?prior.window_start:at;
   db.prepare('INSERT INTO login_throttle VALUES(?,?,?,?,?) ON CONFLICT(scope,key_hash) DO UPDATE SET window_start=excluded.window_start,attempts=excluded.attempts,blocked_until=excluded.blocked_until').run(scope,key,windowStart,attempts,attempts>=loginLimit?at+loginBlockMs:0);
  }
  return true;
 });
 const clearAttempts=(address,ip)=>{for(const {scope,key}of throttleKeys(address,ip))db.prepare('DELETE FROM login_throttle WHERE scope=? AND key_hash=?').run(scope,key);};

 const provisionWorkspace=(provision,workspace)=>{
  if(provision==null)return;
  const result=provision(Object.freeze({...workspace}));
  if(result&&typeof result.then==='function')throw new TypeError('Workspace provision callbacks must be synchronous.');
 };
 const validateProvision=provision=>{
  if(provision!=null&&(typeof provision!=='function'||provision.constructor?.name==='AsyncFunction'))throw new TypeError('Provide a synchronous workspace provision callback.');
 };
 async function bootstrap(input,{provision}={}){
  validateProvision(provision);
  fields(input,['email','password','name','workspaceName']);const address=email(input.email),name=label(input.name,'Name'),workspaceName=label(input.workspaceName,'Workspace name',160);
  if(db.prepare('SELECT COUNT(*) AS count FROM users').get().count)fail(409,'BOOTSTRAP_CLOSED','The identity store has already been initialized.');
  const encoded=await hashPassword(input.password);
  return tx(()=>{
   if(db.prepare('SELECT COUNT(*) AS count FROM users').get().count||db.prepare('SELECT COUNT(*) AS count FROM workspaces').get().count)fail(409,'BOOTSTRAP_CLOSED','The identity store has already been initialized.');
   const at=now(),userId=randomUUID(),workspaceId=randomUUID();
   db.prepare('INSERT INTO users VALUES(?,?,?,?,1,1,1,?)').run(userId,address,name,encoded,at);
   db.prepare('INSERT INTO workspaces VALUES(?,?,?,?)').run(workspaceId,workspaceName,userId,at);
   db.prepare("INSERT INTO memberships VALUES(?,?, 'admin',1,?,?)").run(workspaceId,userId,at,at);
   event('identity.bootstrapped',userId,workspaceId,{},at);
   provisionWorkspace(provision,{id:workspaceId,name:workspaceName});
   return {user:{id:userId,email:address,name,systemAdmin:true},workspace:{id:workspaceId,name:workspaceName}};
  });
 }
 async function login(input){
  fields(input,['email','password','ip']);let address;
  try{address=email(input.email);password(input.password);}catch{authFailure();}
  if(!reserveAttempt(address,input.ip))authFailure();
  const original=db.prepare('SELECT * FROM users WHERE email=?').get(address),encoded=original?.password_hash||db.prepare('SELECT dummy_hash FROM identity_meta WHERE id=1').get().dummy_hash;
  const valid=await checkPassword(input.password,encoded);
  const result=tx(()=>{
   const user=db.prepare('SELECT * FROM users WHERE email=?').get(address),at=now();
   if(!valid||!user?.active||!original||!same(user.password_hash,original.password_hash)){event('authentication.failed',user?.id,null,{},at);return {failed:true};}
   const all=memberships(user.id);if(!all.length&&!user.system_admin){event('authentication.failed',user.id,null,{},at);return {failed:true};}
   const secret=token(),csrf=token(),activeWorkspaceId=all[0]?.id||null;
   db.prepare('INSERT INTO sessions VALUES(?,?,?,?,?,?,?,?)').run(digest(secret),user.id,activeWorkspaceId,csrf,user.password_version,at,at,at+sessionMs);
   clearAttempts(address,input.ip);event('authentication.signed_in',user.id,activeWorkspaceId,{},at);
   return {token:secret,...loadSession(digest(secret))};
  });
  if(result.failed)authFailure();return result;
 }
 function resolveSession(secret,{touch=true}={}){if(!TOKEN.test(secret||''))return null;return tx(()=>loadSession(digest(secret),{touch}));}
 function logout(secret){
  if(!TOKEN.test(secret||''))return {signedOut:true};
  return tx(()=>{const auth=loadSession(digest(secret));db.prepare('DELETE FROM sessions WHERE token_hash=?').run(digest(secret));if(auth)event('authentication.signed_out',auth.user.id,auth.activeWorkspaceId);return {signedOut:true};});
 }
 function switchWorkspace(secret,workspaceId){
  if(!TOKEN.test(secret||''))fail(401,'SESSION_REQUIRED','Sign in with an active managed session.');
  return tx(()=>{
   const auth=loadSession(digest(secret));if(!auth)fail(401,'SESSION_REQUIRED','Sign in with an active managed session.');
   if(!auth.workspaces.some(item=>item.id===workspaceId))fail(403,'FORBIDDEN','An active membership of the selected workspace is required.');
   db.prepare('UPDATE sessions SET active_workspace_id=? WHERE token_hash=?').run(workspaceId,auth.token_hash);event('session.workspace_selected',auth.user.id,workspaceId);
   return loadSession(auth.token_hash,{touch:true});
  });
 }
 function createWorkspace(session,input,{provision}={}){
  validateProvision(provision);
  fields(input,['name']);const name=label(input.name,'Workspace name',160);
  return tx(()=>{
   const auth=requireSession(session);if(!auth.user.systemAdmin)fail(403,'FORBIDDEN','Only the system administrator may create a workspace.');
   const at=now(),workspaceId=randomUUID();db.prepare('INSERT INTO workspaces VALUES(?,?,?,?)').run(workspaceId,name,auth.user.id,at);
   db.prepare("INSERT INTO memberships VALUES(?,?, 'admin',1,?,?)").run(workspaceId,auth.user.id,at,at);event('workspace.created',auth.user.id,workspaceId,{},at);
   provisionWorkspace(provision,{id:workspaceId,name});
   return {workspace:{id:workspaceId,name},membership:{workspaceId,userId:auth.user.id,role:'admin',active:true}};
  });
 }
 function createInvitation(session,input){
  fields(input,['workspaceId','email','role','name','expiresAt']);const workspaceId=label(input.workspaceId,'Workspace identity',100),address=email(input.email),invitedRole=role(input.role),name=input.name==null?'Invited member':label(input.name,'Name');
  return tx(()=>{
   const auth=requireAdmin(session,workspaceId),at=now();
   let expires=at+7*24*60*60*1000;
   if(input.expiresAt!=null){if(typeof input.expiresAt!=='string'||!/T/.test(input.expiresAt)||!/(?:Z|[+-]\d{2}:\d{2})$/.test(input.expiresAt))fail(400,'VALIDATION','Use an expiry timestamp with a timezone.');expires=Date.parse(input.expiresAt);}
   if(!Number.isSafeInteger(expires)||expires<=at||expires>at+30*24*60*60*1000)fail(400,'VALIDATION','Invitation expiry must be in the next 30 days.');
   const existing=db.prepare('SELECT * FROM users WHERE email=?').get(address);
   if(existing&&db.prepare('SELECT active FROM memberships WHERE workspace_id=? AND user_id=?').get(workspaceId,existing.id)?.active)fail(409,'MEMBERSHIP_EXISTS','This user already has an active membership. Manage that membership explicitly.');
   db.prepare('UPDATE invitations SET revoked_at=? WHERE email=? AND workspace_id=? AND used_at IS NULL AND revoked_at IS NULL').run(at,address,workspaceId);
   const secret=token(),id=randomUUID();db.prepare('INSERT INTO invitations VALUES(?,?,?,?,?,?,?,?,?,NULL,NULL)').run(id,workspaceId,address,invitedRole,name,digest(secret),auth.user.id,at,expires);
   event('invitation.created',auth.user.id,workspaceId,{invitationId:id,role:invitedRole},at);
   return {invitation:publicInvitation(db.prepare('SELECT * FROM invitations WHERE id=?').get(id)),token:secret};
  });
 }
 async function acceptInvitation(input){
  fields(input,['token','password','name']);password(input.password);if(input.name!=null)label(input.name,'Name');
  // Enrollment credentials are checked outside SQLite write locks. Re-read
  // under the lock before enrollment so concurrent joins share one account.
  for(let attempt=0;attempt<3;attempt++){
   const invitation=tx(()=>invitationRow(input.token,now())),original=db.prepare('SELECT * FROM users WHERE email=?').get(invitation.email);
   if(!reserveAttempt(invitation.email,'invitation:'+invitation.email))authFailure();
   const valid=original?await checkPassword(input.password,original.password_hash):true;
   const encoded=original?null:await hashPassword(input.password);
   const result=tx(()=>{
    const current=invitationRow(input.token,now()),user=db.prepare('SELECT * FROM users WHERE email=?').get(current.email);
    if(Boolean(original)!==Boolean(user)||(original&&user&&!same(original.password_hash,user.password_hash)))return {retry:true};
    if(!valid||user&&!user.active)authFailure();
    if(user&&db.prepare('SELECT active FROM memberships WHERE workspace_id=? AND user_id=?').get(current.workspace_id,user.id)?.active)fail(409,'MEMBERSHIP_EXISTS','This account already belongs to the invited workspace.');
    const at=now(),userId=user?.id||randomUUID();
    if(!user)db.prepare('INSERT INTO users VALUES(?,?,?,?,1,0,1,?)').run(userId,current.email,input.name?.trim()||current.name,encoded,at);
    const prior=db.prepare('SELECT * FROM memberships WHERE workspace_id=? AND user_id=?').get(current.workspace_id,userId);
    db.prepare('INSERT INTO memberships VALUES(?,?,?,1,?,?) ON CONFLICT(workspace_id,user_id) DO UPDATE SET role=excluded.role,active=1,updated_at=excluded.updated_at').run(current.workspace_id,userId,current.role,at,at);
    if(prior)invalidateUser(userId);
    db.prepare('UPDATE invitations SET used_at=? WHERE id=? AND used_at IS NULL AND revoked_at IS NULL').run(at,current.id);
    clearAttempts(current.email,'invitation:'+current.email);event('invitation.accepted',userId,current.workspace_id,{invitationId:current.id,role:current.role},at);
    return {user:publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(userId)),workspace:publicWorkspace(db.prepare('SELECT * FROM workspaces WHERE id=?').get(current.workspace_id)),membership:{workspaceId:current.workspace_id,userId,role:current.role,active:true}};
   });
   if(!result.retry)return result;
  }
  fail(409,'AUTHENTICATION_CHANGED','Credentials changed during enrollment. Try the invitation again.');
 }
 function updateMembership(session,input){
  fields(input,['workspaceId','userId','role','active']);const workspaceId=label(input.workspaceId,'Workspace identity',100),userId=label(input.userId,'User identity',100);
  if(input.role==null&&input.active==null)fail(400,'VALIDATION','Provide a role or active membership state.');
  if(input.role!=null)role(input.role);if(input.active!=null&&typeof input.active!=='boolean')fail(400,'VALIDATION','Membership active state must be boolean.');
  return tx(()=>{
   const auth=requireAdmin(session,workspaceId),current=db.prepare('SELECT * FROM memberships WHERE workspace_id=? AND user_id=?').get(workspaceId,userId);
   if(!current)fail(404,'NOT_FOUND','The workspace membership was not found.');
   const nextRole=input.role??current.role,nextActive=input.active??Boolean(current.active);
   if(current.role==='admin'&&current.active&&(nextRole!=='admin'||!nextActive)&&db.prepare("SELECT COUNT(*) AS count FROM memberships WHERE workspace_id=? AND role='admin' AND active=1").get(workspaceId).count<=1)fail(409,'LAST_ADMIN','The last active workspace administrator cannot be removed or demoted.');
   const at=now();db.prepare('UPDATE memberships SET role=?,active=?,updated_at=? WHERE workspace_id=? AND user_id=?').run(nextRole,nextActive?1:0,at,workspaceId,userId);
   if(nextRole!==current.role||nextActive!==Boolean(current.active))invalidateUser(userId);
   if(current.role==='admin'&&(nextRole!=='admin'||!nextActive))db.prepare('UPDATE invitations SET revoked_at=? WHERE created_by=? AND workspace_id=? AND used_at IS NULL AND revoked_at IS NULL').run(at,userId,workspaceId);
   const target=db.prepare('SELECT email FROM users WHERE id=?').get(userId);db.prepare('UPDATE invitations SET revoked_at=? WHERE email=? AND workspace_id=? AND used_at IS NULL AND revoked_at IS NULL').run(at,target.email,workspaceId);
   event('membership.updated',auth.user.id,workspaceId,{userId,role:nextRole,active:nextActive},at);
   return {membership:{workspaceId,userId,role:nextRole,active:nextActive}};
  });
 }
 async function changePassword(session,input){
  fields(input,['currentPassword','newPassword']);password(input.currentPassword);password(input.newPassword);
  const auth=tx(()=>requireSession(session)),original=db.prepare('SELECT * FROM users WHERE id=?').get(auth.user.id);
  if(!reserveAttempt(original.email,'password-change:'+original.id))authFailure();
  const valid=await checkPassword(input.currentPassword,original.password_hash);if(!valid)authFailure();
  const encoded=await hashPassword(input.newPassword);
  return tx(()=>{
   const fresh=requireSession(session),user=db.prepare('SELECT * FROM users WHERE id=?').get(fresh.user.id);
   if(!same(user.password_hash,original.password_hash))authFailure();
   db.prepare('UPDATE users SET password_hash=?,password_version=password_version+1 WHERE id=?').run(encoded,user.id);invalidateUser(user.id);clearAttempts(user.email,'password-change:'+user.id);event('credentials.password_changed',user.id,auth.activeWorkspaceId);
   return {changed:true,sessionsRevoked:true};
  });
 }
 function audit(session,options={}){
  fields(options,['limit','after']);const limit=options.limit??50,after=options.after??0;
  if(!Number.isSafeInteger(limit)||limit<1||limit>200||!Number.isSafeInteger(after)||after<0)fail(400,'VALIDATION','Use a limit of 1–200 and a nonnegative audit cursor.');
  return tx(()=>{
   const auth=requireSession(session);if(!auth.user.systemAdmin&&auth.actor.role!=='admin')fail(403,'FORBIDDEN','Workspace administrator access is required for security audit records.');
   const rows=auth.user.systemAdmin?db.prepare('SELECT * FROM security_audit WHERE sequence>? ORDER BY sequence LIMIT ?').all(after,limit+1):db.prepare('SELECT * FROM security_audit WHERE sequence>? AND workspace_id=? ORDER BY sequence LIMIT ?').all(after,auth.activeWorkspaceId,limit+1);
   const events=rows.slice(0,limit).map(row=>({sequence:row.sequence,at:new Date(row.at).toISOString(),kind:row.kind,actorId:row.actor_id,workspaceId:row.workspace_id,detail:JSON.parse(row.detail_json)}));
   return {events,nextAfter:events.at(-1)?.sequence??after,hasMore:rows.length>limit};
  });
 }
 function withAuthorization(secret,workspaceId,callback){
  if(typeof callback!=='function'||callback.constructor?.name==='AsyncFunction')throw new TypeError('Provide a synchronous authorization callback.');
  if(!TOKEN.test(secret||''))fail(401,'SESSION_REQUIRED','Sign in with an active managed session.');
  return tx(()=>{
   const auth=loadSession(digest(secret),{touch:true});if(!auth)fail(401,'SESSION_REQUIRED','Sign in with an active managed session.');
   if(auth.activeWorkspaceId!==workspaceId||!auth.workspace)fail(403,'WORKSPACE_FORBIDDEN','Select an active membership of this exact workspace before continuing.');
   return callback(auth);
  });
 }
 return {bootstrap,login,resolveSession,logout,switchWorkspace,createWorkspace,createInvitation,acceptInvitation,updateMembership,changePassword,audit,withAuthorization,cookiePolicy:Object.freeze({httpOnly:true,sameSite:'Strict',secure:secureCookies}),close(){if(!closed){db.close();closed=true;}}};
}
