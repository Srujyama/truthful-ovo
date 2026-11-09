import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {DatabaseSync} from 'node:sqlite';
import {Worker} from 'node:worker_threads';
import {once} from 'node:events';
import {createIdentityStore} from './identity.mjs';

const rootInput={email:'Owner@Example.test',password:'Root password is long!',name:'Root Operator',workspaceName:'Workspace Alpha'};
const memberPassword='Member password is long!';
async function fixture(t,extra={}){
 const directory=await mkdtemp(join(tmpdir(),'truthful-identity-')),dbPath=join(directory,'identity.sqlite');
 let at=Date.parse('2026-11-08T12:00:00.000Z');const stores=[];
 const open=()=>{const store=createIdentityStore({dbPath,clock:()=>new Date(at).toISOString(),...extra});stores.push(store);return store;};
 t.after(async()=>{for(const store of stores)store.close();await rm(directory,{recursive:true,force:true});});
 const store=open(),initial=await store.bootstrap(rootInput),root=await store.login({email:rootInput.email,password:rootInput.password,ip:'127.0.0.1'});
 return {store,initial,root,open,dbPath,directory,advance:ms=>{at+=ms;},clock:()=>new Date(at).toISOString()};
}
const isCode=code=>error=>error.code===code;
async function member(f,{address='member@example.test',role='analyst',workspaceId=f.initial.workspace.id,name='Member'}={}){
 const created=f.store.createInvitation(f.root,{workspaceId,email:address,role,name});
 const accepted=await f.store.acceptInvitation({token:created.token,password:memberPassword});
 const session=await f.store.login({email:address,password:memberPassword,ip:address});
 return {created,accepted,session};
}

test('bootstrap is one-time; credentials are salted scrypt, public identities contain no password or token hashes',async t=>{
 const f=await fixture(t);assert.equal(f.initial.user.email,'owner@example.test');assert.equal(f.root.actor.role,'admin');assert.equal(f.root.user.systemAdmin,true);
 assert.match(f.root.token,/^[a-f0-9]{64}$/);assert.match(f.root.csrfToken,/^[a-f0-9]{64}$/);assert.notEqual(f.root.token,f.root.csrfToken);
 await assert.rejects(f.store.bootstrap(rootInput),isCode('BOOTSTRAP_CLOSED'));
 assert.equal(f.store.resolveSession(f.root.token).actor.id,f.initial.user.id);
 const db=new DatabaseSync(f.dbPath,{readOnly:true});t.after(()=>db.close());
 const user=db.prepare('SELECT * FROM users').get(),encoded=JSON.parse(user.password_hash);
 assert.equal(encoded.algorithm,'scrypt');assert.equal(encoded.N,32768);assert.equal(encoded.r,8);assert.equal(encoded.p,1);assert.equal(encoded.salt.length,32);assert.equal(encoded.key.length,128);
 assert.equal(db.prepare('SELECT COUNT(*) AS count FROM sessions WHERE token_hash=?').get(f.root.token).count,0);
 assert.ok(!JSON.stringify(f.initial).includes('password'));assert.ok(!JSON.stringify(f.root.user).includes('hash'));
 assert.ok(!(await readFile(f.dbPath)).includes(Buffer.from(rootInput.password)));
});

test('workspace membership, not caller fields or global administration, controls permissions',async t=>{
 const f=await fixture(t),a=await member(f),beta=f.store.createWorkspace(f.root,{name:'Workspace Beta'}).workspace;
 assert.throws(()=>f.store.createInvitation({...a.session,actor:{role:'admin'},user:{systemAdmin:true}},{workspaceId:f.initial.workspace.id,email:'forged@example.test',role:'admin'}),isCode('FORBIDDEN'));
 assert.throws(()=>f.store.createWorkspace(a.session,{name:'Forbidden'}),isCode('FORBIDDEN'));
 const b=await member(f,{address:'beta-admin@example.test',role:'admin',workspaceId:beta.id});
 f.store.updateMembership(b.session,{workspaceId:beta.id,userId:f.initial.user.id,active:false});
 assert.equal(f.store.resolveSession(f.root.token),null,'membership mutation revokes affected user sessions');
 const root=await f.store.login({email:rootInput.email,password:rootInput.password,ip:'root-again'});
 assert.equal(root.user.systemAdmin,true);assert.ok(!root.workspaces.some(w=>w.id===beta.id));
 assert.throws(()=>f.store.switchWorkspace(root.token,beta.id),isCode('FORBIDDEN'));
 assert.throws(()=>f.store.createInvitation(root,{workspaceId:beta.id,email:'x@example.test',role:'admin'}),isCode('FORBIDDEN'));
 assert.throws(()=>f.store.createWorkspace(b.session,{name:'No global permission'}),isCode('FORBIDDEN'));
 const other=f.open();assert.equal(other.resolveSession(a.session.token).actor.role,'analyst');
 assert.throws(()=>other.withAuthorization(a.session.token,beta.id,()=>true),isCode('WORKSPACE_FORBIDDEN'));
});

test('role changes and deactivation revoke sessions, are visible across instances, and preserve the last administrator',async t=>{
 const f=await fixture(t),a=await member(f),other=f.open();
 assert.throws(()=>f.store.updateMembership(f.root,{workspaceId:f.initial.workspace.id,userId:f.root.user.id,role:'viewer'}),isCode('LAST_ADMIN'));
 assert.throws(()=>f.store.updateMembership(f.root,{workspaceId:f.initial.workspace.id,userId:f.root.user.id,active:false}),isCode('LAST_ADMIN'));
 other.updateMembership(f.root,{workspaceId:f.initial.workspace.id,userId:a.accepted.user.id,role:'viewer'});
 assert.equal(f.store.resolveSession(a.session.token),null);
 assert.throws(()=>f.store.withAuthorization(a.session.token,f.initial.workspace.id,()=>assert.fail('revoked session reached callback')),isCode('SESSION_REQUIRED'));
 const viewer=await f.store.login({email:a.accepted.user.email,password:memberPassword,ip:'viewer'});assert.equal(viewer.actor.role,'viewer');
 f.store.updateMembership(f.root,{workspaceId:f.initial.workspace.id,userId:a.accepted.user.id,active:false});
 assert.equal(other.resolveSession(viewer.token),null);
 await assert.rejects(other.login({email:a.accepted.user.email,password:memberPassword,ip:'inactive'}),isCode('AUTHENTICATION_FAILED'));
});

test('invitations bind exact role/email/workspace, are hash-only, expire, supersede old invites and cannot replay',async t=>{
 const f=await fixture(t);
 const first=f.store.createInvitation(f.root,{workspaceId:f.initial.workspace.id,email:'new@example.test',role:'executor',name:'Exact invite name'});
 assert.throws(()=>f.store.createInvitation(f.root,{workspaceId:f.initial.workspace.id,email:'new@example.test',role:'super-admin'}),isCode('VALIDATION'));
 await assert.rejects(f.store.acceptInvitation({token:first.token,password:memberPassword,role:'admin'}),isCode('VALIDATION'));
 const second=f.store.createInvitation(f.root,{workspaceId:f.initial.workspace.id,email:'new@example.test',role:'approver'});
 await assert.rejects(f.store.acceptInvitation({token:first.token,password:memberPassword}),isCode('INVITATION_INVALID'));
 const enrolled=await f.store.acceptInvitation({token:second.token,password:memberPassword,name:'Personal name'});
 assert.equal(enrolled.membership.role,'approver');assert.equal(enrolled.user.email,'new@example.test');assert.equal(enrolled.user.systemAdmin,false);
 await assert.rejects(f.store.acceptInvitation({token:second.token,password:memberPassword}),isCode('INVITATION_INVALID'));
 const db=new DatabaseSync(f.dbPath,{readOnly:true});t.after(()=>db.close());
 assert.equal(db.prepare('SELECT COUNT(*) AS count FROM invitations WHERE token_hash=?').get(second.token).count,0);
 const expiring=f.store.createInvitation(f.root,{workspaceId:f.initial.workspace.id,email:'expiring@example.test',role:'viewer',expiresAt:new Date(Date.parse(f.clock())+1000).toISOString()});
 f.advance(1001);await assert.rejects(f.store.acceptInvitation({token:expiring.token,password:memberPassword}),isCode('INVITATION_INVALID'));
 assert.throws(()=>f.store.createInvitation(f.root,{workspaceId:f.initial.workspace.id,email:'far@example.test',role:'viewer',expiresAt:'2027-01-01T00:00:00Z'}),isCode('VALIDATION'));
});

test('existing users must authenticate their current password to join another workspace; concurrent same-email joins never reset credentials',async t=>{
 const f=await fixture(t),beta=f.store.createWorkspace(f.root,{name:'Beta'}).workspace;
 const a=f.store.createInvitation(f.root,{workspaceId:f.initial.workspace.id,email:'shared@example.test',role:'analyst'}),b=f.store.createInvitation(f.root,{workspaceId:beta.id,email:'shared@example.test',role:'viewer'});
 const other=f.open();const joined=await Promise.all([f.store.acceptInvitation({token:a.token,password:memberPassword}),other.acceptInvitation({token:b.token,password:memberPassword})]);
 assert.equal(joined[0].user.id,joined[1].user.id);assert.equal(joined[0].membership.role,'analyst');assert.equal(joined[1].membership.role,'viewer');
 const shared=await f.store.login({email:'shared@example.test',password:memberPassword,ip:'shared'});assert.equal(shared.workspaces.length,2);
 const gamma=f.store.createWorkspace(f.root,{name:'Gamma'}).workspace,invite=f.store.createInvitation(f.root,{workspaceId:gamma.id,email:'shared@example.test',role:'executor'});
 await assert.rejects(f.store.acceptInvitation({token:invite.token,password:'A different long password!'}),isCode('AUTHENTICATION_FAILED'));
 const joinedAgain=await f.store.acceptInvitation({token:invite.token,password:memberPassword,name:'Do not replace existing name'});
 assert.equal(joinedAgain.user.id,shared.user.id);assert.equal(joinedAgain.user.name,shared.user.name);
 await assert.rejects(f.store.login({email:'shared@example.test',password:'A different long password!',ip:'wrong'}),isCode('AUTHENTICATION_FAILED'));
 const switched=f.store.switchWorkspace(shared.token,beta.id);assert.equal(switched.actor.role,'viewer');assert.equal(switched.activeWorkspaceId,beta.id);
});

test('absolute/idle session expiry persist across restart; logout and password changes revoke all sessions',async t=>{
 const f=await fixture(t,{sessionMs:10000,idleMs:3000}),a=await member(f);let other=f.open();
 f.store.close();other.close();f.store=f.open();other=f.open();
 f.advance(2000);assert.ok(other.resolveSession(a.session.token));
 f.advance(2000);assert.ok(f.store.resolveSession(a.session.token));
 f.advance(3001);assert.equal(other.resolveSession(a.session.token),null,'idle expiry follows last touch');
 const fresh=await f.store.login({email:a.accepted.user.email,password:memberPassword,ip:'new'});
 const another=await other.login({email:a.accepted.user.email,password:memberPassword,ip:'another'});
 await f.store.changePassword(fresh,{currentPassword:memberPassword,newPassword:'The replacement password!'});
 assert.equal(other.resolveSession(fresh.token),null);assert.equal(other.resolveSession(another.token),null);
 await assert.rejects(other.login({email:a.accepted.user.email,password:memberPassword,ip:'old-password'}),isCode('AUTHENTICATION_FAILED'));
 const replacement=await other.login({email:a.accepted.user.email,password:'The replacement password!',ip:'updated'});
 assert.ok(f.store.resolveSession(replacement.token));f.store.logout(replacement.token);assert.equal(other.resolveSession(replacement.token),null);
 const absolute=await other.login({email:a.accepted.user.email,password:'The replacement password!',ip:'absolute'});
 for(let i=0;i<4;i++){f.advance(2000);assert.ok(other.resolveSession(absolute.token));}
 f.advance(2001);assert.equal(other.resolveSession(absolute.token),null,'touch cannot extend absolute expiry');
});

test('durable throttle is shared by email and IP with indistinguishable public authentication failure',async t=>{
 const f=await fixture(t,{loginLimit:3,loginWindowMs:1000,loginBlockMs:2000}),messages=[];let other=f.open();
 for(let i=0;i<3;i++)try{await other.login({email:'absent@example.test',password:memberPassword,ip:'same-ip'});}catch(error){assert.equal(error.code,'AUTHENTICATION_FAILED');messages.push(error.message);}
 f.store.close();other.close();f.store=f.open();other=f.open();
 await assert.rejects(f.store.login({email:rootInput.email,password:rootInput.password,ip:'same-ip'}),error=>error.code==='AUTHENTICATION_FAILED'&&error.message===messages[0]);
 assert.equal(new Set(messages).size,1);
 f.advance(2001);assert.ok(await other.login({email:rootInput.email,password:rootInput.password,ip:'same-ip'}));
 for(let i=0;i<3;i++)await assert.rejects(f.store.login({email:rootInput.email,password:memberPassword,ip:'ip-'+i}),isCode('AUTHENTICATION_FAILED'));
 await assert.rejects(other.login({email:rootInput.email,password:rootInput.password,ip:'fresh-ip'}),isCode('AUTHENTICATION_FAILED'));
});

test('security audit is scoped, paginated and durable without passwords, emails, credential hashes or tokens',async t=>{
 const f=await fixture(t),a=await member(f,{role:'admin'}),b=f.store.createWorkspace(f.root,{name:'Beta'}).workspace;
 f.store.createInvitation(f.root,{workspaceId:b.id,email:'secret-recipient@example.test',role:'viewer'});
 await assert.rejects(f.store.login({email:'absent@example.test',password:memberPassword,ip:'audit-failure'}),isCode('AUTHENTICATION_FAILED'));
 const first=f.store.audit(f.root,{limit:2}),next=f.open().audit(f.root,{limit:200,after:first.nextAfter});assert.equal(first.events.length,2);assert.equal(first.hasMore,true);assert.ok(next.events.every(e=>e.sequence>first.nextAfter));
 const all=f.store.audit(f.root,{limit:200}).events;assert.ok(all.some(e=>e.kind==='authentication.failed'));
 const scoped=f.store.audit(a.session,{limit:200}).events;assert.ok(scoped.every(e=>e.workspaceId===f.initial.workspace.id));assert.ok(!scoped.some(e=>e.workspaceId===b.id));
 const text=JSON.stringify(all);for(const secret of [rootInput.password,memberPassword,f.root.token,f.root.csrfToken,a.created.token,a.session.token,'secret-recipient@example.test'])assert.ok(!text.includes(secret));
 assert.ok(!/password_hash|token_hash|csrf_token|salt|key_hash/.test(text));
 assert.throws(()=>f.store.audit(f.root,{limit:201}),isCode('VALIDATION'));
});

test('authorization callbacks use fresh membership inside an identity write lock and reject forged sessions or asynchronous callbacks',async t=>{
 const f=await fixture(t),a=await member(f),other=f.open();
 const result=f.store.withAuthorization(a.session.token,f.initial.workspace.id,auth=>({role:auth.actor.role,id:auth.user.id}));assert.deepEqual(result,{role:'analyst',id:a.accepted.user.id});
 assert.throws(()=>f.store.withAuthorization(a.session.token,f.initial.workspace.id,async()=>true),/synchronous/);
 assert.throws(()=>f.store.createWorkspace({token_hash:'0'.repeat(64),actor:{role:'admin'},user:{systemAdmin:true}},{name:'Forgery'}),isCode('SESSION_REQUIRED'));
 other.updateMembership(f.root,{workspaceId:f.initial.workspace.id,userId:a.accepted.user.id,role:'viewer'});
 assert.throws(()=>f.store.withAuthorization(a.session.token,f.initial.workspace.id,()=>true),isCode('SESSION_REQUIRED'));
});

test('a second process cannot revoke membership between a fresh authorization check and its synchronous financial callback',async t=>{
 const f=await fixture(t),a=await member(f),shared=new Int32Array(new SharedArrayBuffer(4));
 const worker=new Worker(`const {parentPort,workerData}=require('node:worker_threads');(async()=>{const {createIdentityStore}=await import(workerData.module);const store=createIdentityStore({dbPath:workerData.dbPath,clock:()=>workerData.at});const flag=new Int32Array(workerData.shared);parentPort.postMessage('ready');parentPort.once('message',()=>{try{Atomics.store(flag,0,1);Atomics.notify(flag,0);store.updateMembership(workerData.session,{workspaceId:workerData.workspaceId,userId:workerData.userId,active:false});Atomics.store(flag,0,2);parentPort.postMessage('done');}catch(error){parentPort.postMessage({error:error.message});}finally{store.close();}});})();`,{eval:true,workerData:{module:new URL('./identity.mjs',import.meta.url).href,dbPath:f.dbPath,at:f.clock(),shared:shared.buffer,session:f.root,workspaceId:f.initial.workspace.id,userId:a.accepted.user.id}});
 t.after(()=>worker.terminate());assert.equal((await once(worker,'message'))[0],'ready');
 const completion=once(worker,'message');
 f.store.withAuthorization(a.session.token,f.initial.workspace.id,auth=>{
  assert.equal(auth.actor.role,'analyst');worker.postMessage('revoke');
  Atomics.wait(shared,0,0,2000);assert.equal(Atomics.load(shared,0),1);
  Atomics.wait(shared,0,1,100);assert.equal(Atomics.load(shared,0),1,'revocation must wait until the authorized callback releases its lock');
  assert.equal(f.store.withAuthorization(a.session.token,f.initial.workspace.id,inner=>inner.actor.role),'analyst','nested authorization keeps the same lock');
 });
 assert.equal((await completion)[0],'done');assert.equal(f.store.resolveSession(a.session.token),null);
});

test('concurrent bootstrap permits one owner; malformed and oversized inputs cannot assign credentials or roles',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'truthful-bootstrap-race-')),dbPath=join(directory,'identity.sqlite'),a=createIdentityStore({dbPath}),b=createIdentityStore({dbPath});
 t.after(async()=>{a.close();b.close();await rm(directory,{recursive:true,force:true});});
 const result=await Promise.allSettled([a.bootstrap(rootInput),b.bootstrap({...rootInput,email:'other@example.test'})]);assert.equal(result.filter(r=>r.status==='fulfilled').length,1);assert.equal(result.find(r=>r.status==='rejected').reason.code,'BOOTSTRAP_CLOSED');
 for(const bad of ['short','x'.repeat(257),'valid length\0password'])await assert.rejects(a.login({email:rootInput.email,password:bad,ip:'invalid'}),isCode('AUTHENTICATION_FAILED'));
 await assert.rejects(a.login({email:rootInput.email,password:rootInput.password,role:'admin'}),isCode('VALIDATION'));
});

test('revoking an administrator invalidates outstanding invitations they issued in that workspace',async t=>{
 const f=await fixture(t),admin=await member(f,{address:'admin@example.test',role:'admin'});
 const invite=f.store.createInvitation(admin.session,{workspaceId:f.initial.workspace.id,email:'pending@example.test',role:'approver'});
 f.open().updateMembership(f.root,{workspaceId:f.initial.workspace.id,userId:admin.accepted.user.id,role:'viewer'});
 await assert.rejects(f.store.acceptInvitation({token:invite.token,password:memberPassword}),isCode('INVITATION_INVALID'));
});

test('membership revocation during asynchronous password hashing prevents credential changes at commit',async t=>{
 const f=await fixture(t),a=await member(f),other=f.open();
 const pending=f.store.changePassword(a.session,{currentPassword:memberPassword,newPassword:'Replacement must not commit!'});
 other.updateMembership(f.root,{workspaceId:f.initial.workspace.id,userId:a.accepted.user.id,active:false});
 await assert.rejects(pending,isCode('SESSION_REQUIRED'));
 f.store.updateMembership(f.root,{workspaceId:f.initial.workspace.id,userId:a.accepted.user.id,active:true});
 assert.ok(await other.login({email:a.accepted.user.email,password:memberPassword,ip:'old-password-kept'}));
 await assert.rejects(other.login({email:a.accepted.user.email,password:'Replacement must not commit!',ip:'rejected-password'}),isCode('AUTHENTICATION_FAILED'));
});

test('new identity files are private and unrelated/unsupported databases are not silently migrated',async t=>{
 const f=await fixture(t);assert.equal((await stat(f.dbPath)).mode&0o777,0o600);
 const foreignPath=join(f.directory,'foreign.sqlite'),foreign=new DatabaseSync(foreignPath);foreign.exec('CREATE TABLE external_data(value TEXT);');foreign.close();
 assert.throws(()=>createIdentityStore({dbPath:foreignPath}),/unrelated database/);
 const verify=new DatabaseSync(foreignPath);assert.equal(verify.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE name='users'").get().count,0);verify.close();
 const futurePath=join(f.directory,'future.sqlite'),future=new DatabaseSync(futurePath);future.exec('PRAGMA user_version=99;');future.close();
 assert.throws(()=>createIdentityStore({dbPath:futurePath}),/Unsupported identity database/);
});

test('bootstrap provisions inside its identity transaction and a failed child initialization leaves enrollment reusable',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'truthful-provision-bootstrap-')),dbPath=join(directory,'identity.sqlite'),store=createIdentityStore({dbPath});
 t.after(async()=>{store.close();await rm(directory,{recursive:true,force:true});});
 let failedId;
 await assert.rejects(store.bootstrap(rootInput,{provision:workspace=>{failedId=workspace.id;assert.equal(workspace.name,rootInput.workspaceName);assert.ok(Object.isFrozen(workspace));throw new Error('child initialization failed');}}),/child initialization failed/);
 const inspect=new DatabaseSync(dbPath,{readOnly:true});t.after(()=>inspect.close());
 for(const table of ['users','workspaces','memberships','security_audit'])assert.equal(inspect.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count,0,table+' rolls back');
 await assert.rejects(store.login({email:rootInput.email,password:rootInput.password,ip:'failed-owner'}),isCode('AUTHENTICATION_FAILED'));
 let provisioned;
 const initial=await store.bootstrap(rootInput,{provision:workspace=>{provisioned=workspace;assert.equal(inspect.prepare('SELECT COUNT(*) AS count FROM workspaces').get().count,0,'uncommitted identity is not externally registered');}});
 assert.deepEqual(provisioned,initial.workspace);assert.notEqual(initial.workspace.id,failedId);
 assert.equal((await store.login({email:rootInput.email,password:rootInput.password,ip:'successful-owner'})).user.id,initial.user.id);
});

test('workspace provisioning failures roll back registry, membership and audit and synchronous retry can succeed',async t=>{
 const f=await fixture(t),before=f.store.audit(f.root,{limit:200}).events.length;let failedId;
 assert.throws(()=>f.store.createWorkspace(f.root,{name:'New workspace'},{provision:workspace=>{failedId=workspace.id;throw new Error('disk initialization failed');}}),/disk initialization failed/);
 assert.equal(f.open().resolveSession(f.root.token).workspaces.length,1);assert.equal(f.store.audit(f.root,{limit:200}).events.length,before);
 const inspect=new DatabaseSync(f.dbPath,{readOnly:true});t.after(()=>inspect.close());
 assert.equal(inspect.prepare('SELECT COUNT(*) AS count FROM workspaces WHERE id=?').get(failedId).count,0);assert.equal(inspect.prepare('SELECT COUNT(*) AS count FROM memberships WHERE workspace_id=?').get(failedId).count,0);
 let seen;const result=f.store.createWorkspace(f.root,{name:'New workspace'},{provision:workspace=>{seen=workspace;assert.equal(inspect.prepare('SELECT COUNT(*) AS count FROM workspaces WHERE id=?').get(workspace.id).count,0);}});
 assert.deepEqual(seen,result.workspace);assert.equal(f.store.resolveSession(f.root.token).workspaces.length,2);
});

test('provision hooks reject async functions and thenables without committing bootstrap or workspace registry',async t=>{
 const store=createIdentityStore();t.after(()=>store.close());let invoked=false;
 await assert.rejects(store.bootstrap(rootInput,{provision:async()=>{invoked=true;}}),/synchronous/);assert.equal(invoked,false);
 await assert.rejects(store.bootstrap(rootInput,{provision:()=>Promise.resolve()}),/synchronous/);
 const initial=await store.bootstrap(rootInput),root=await store.login({email:rootInput.email,password:rootInput.password});
 assert.throws(()=>store.createWorkspace(root,{name:'Async child'},{provision:async()=>{invoked=true;}}),/synchronous/);assert.equal(invoked,false);
 assert.throws(()=>store.createWorkspace(root,{name:'Thenable child'},{provision:()=>({then(){}})}),/synchronous/);
 assert.equal(store.resolveSession(root.token).workspaces.length,1);assert.equal(store.resolveSession(root.token).workspace.id,initial.workspace.id);
 await assert.rejects(store.bootstrap({...rootInput,provision:()=>{}}),isCode('VALIDATION'));
 assert.throws(()=>store.createWorkspace(root,{name:'Public hook injection',provision:()=>{}}),isCode('VALIDATION'));
});
