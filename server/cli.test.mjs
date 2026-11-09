import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const password='CliWorkflowAccount123!';
function command(args,input){return new Promise((resolve,reject)=>{const child=spawn(process.execPath,args,{stdio:['pipe','pipe','pipe']});let stdout='',stderr='';child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);child.once('error',reject);child.once('exit',code=>resolve({code,stdout,stderr}));child.stdin.end(input);});}
test('documented CLI bootstraps from stdin, serves managed accounts, shuts down and verifies/backs up/restores offline',async t=>{
 const root=mkdtempSync(join(tmpdir(),'truthful-cli-test-')),dataDir=join(root,'data');let processHandle;
 t.after(()=>{processHandle?.kill('SIGTERM');rmSync(root,{recursive:true,force:true});});
 const bootstrap=await command(['server/admin.mjs','bootstrap','--data',dataDir],JSON.stringify({email:'cli@example.test',password,name:'CLI Admin',workspaceName:'Operations'}));assert.equal(bootstrap.code,0,bootstrap.stderr);assert(!bootstrap.stdout.includes(password));
 processHandle=spawn(process.execPath,['server/start.mjs','--mode','managed','--data',dataDir,'--port','0'],{stdio:['ignore','pipe','pipe']});let output='',errors='';processHandle.stderr.on('data',b=>errors+=b);
 const base=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Managed CLI did not become ready. '+errors)),10000);processHandle.stdout.on('data',b=>{output+=b;const found=output.match(/Truthful backend: (http:\/\/127\.0\.0\.1:\d+)/);if(found){clearTimeout(timer);resolve(found[1]);}});processHandle.once('exit',code=>{clearTimeout(timer);reject(new Error(`Managed CLI exited ${code}: ${errors}`));});});
 const live=await fetch(base+'/api/live');assert.equal(live.status,200);
 const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({email:'cli@example.test',password})});assert.equal(login.status,200,await login.text());
 const maintenanceWhileLive=await command(['server/admin.mjs','verify','--data',dataDir]);assert.equal(maintenanceWhileLive.code,1);assert.match(maintenanceWhileLive.stderr,/owned by process/);
 const exited=new Promise(resolve=>processHandle.once('exit',resolve));processHandle.kill('SIGTERM');assert.equal(await exited,0);processHandle=null;assert(!output.includes(password));
 const verified=await command(['server/admin.mjs','verify','--data',dataDir]);assert.equal(verified.code,0,verified.stderr);assert.equal(JSON.parse(verified.stdout).ok,true);
 const snapshot=join(root,'backup'),restored=join(root,'restored');const backup=await command(['server/admin.mjs','backup','--data',dataDir,'--to',snapshot]);assert.equal(backup.code,0,backup.stderr);
 const restore=await command(['server/admin.mjs','restore','--snapshot',snapshot,'--to',restored]);assert.equal(restore.code,0,restore.stderr);assert.equal(JSON.parse(restore.stdout).restored,true);
 const checked=await command(['server/admin.mjs','verify','--data',restored]);assert.equal(checked.code,0,checked.stderr);
});
