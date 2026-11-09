import {DatabaseSync,backup} from 'node:sqlite';
import {createHash,randomUUID} from 'node:crypto';
import {openSync,writeFileSync,readFileSync,closeSync,unlinkSync,existsSync,mkdirSync,readdirSync,chmodSync,copyFileSync,rmSync} from 'node:fs';
import {join,resolve,basename} from 'node:path';

const sha=file=>createHash('sha256').update(readFileSync(file)).digest('hex');
/** One owner for managed services and offline maintenance. A live process is
 * never displaced. Stale leases are reclaimed only after ESRCH. */
export function acquireDataLease(directory,purpose){
 mkdirSync(directory,{recursive:true,mode:0o700});const path=join(directory,'.backend-owner.json'),owner={pid:process.pid,nonce:randomUUID(),purpose,createdAt:new Date().toISOString()};
 for(let attempt=0;attempt<2;attempt++){
  try{const fd=openSync(path,'wx',0o600);try{writeFileSync(fd,JSON.stringify(owner));}finally{closeSync(fd);}return()=>{try{if(JSON.parse(readFileSync(path)).nonce===owner.nonce)unlinkSync(path);}catch{}};}
  catch(error){if(error.code!=='EEXIST')throw error;let previous;try{previous=JSON.parse(readFileSync(path));}catch{throw new Error('The backend ownership file is unreadable. Inspect it before maintenance.');}
   if(!Number.isSafeInteger(previous.pid)||previous.pid<1)throw new Error('The backend ownership file has an invalid process identity.');
   try{process.kill(previous.pid,0);throw new Error(`Backend data is owned by process ${previous.pid} (${previous.purpose}). Stop that service before maintenance.`);}catch(probe){if(probe.code!=='ESRCH')throw probe;unlinkSync(path);}
  }
 }
 throw new Error('Could not acquire backend maintenance ownership.');
}

async function inspectData(directory,{invalidate=false}={}){
 const identityPath=join(directory,'identity.sqlite');if(!existsSync(identityPath))throw new Error('No managed identity database exists.');
 const identity=new DatabaseSync(identityPath);
 let workspaces;
 try{
  if(identity.prepare('PRAGMA quick_check').get().quick_check!=='ok'||identity.prepare('PRAGMA user_version').get().user_version!==1)throw new Error('Identity database cannot be verified.');
  workspaces=identity.prepare('SELECT id FROM workspaces ORDER BY id').all();
  if(invalidate){identity.exec('BEGIN IMMEDIATE');try{identity.exec('DELETE FROM sessions; DELETE FROM invitations;');identity.exec('COMMIT');}catch(error){identity.exec('ROLLBACK');throw error;}}
 }finally{identity.close();}
 const {createService}=await import('./service.mjs');const checks=[];
 for(const {id}of workspaces){
  if(!/^[a-f0-9-]{36}$/.test(id))throw new Error('Workspace registry contains an invalid file identity.');
  const file=`workspace-${id}.sqlite`;if(!existsSync(join(directory,file)))throw new Error(`Missing financial database for workspace ${id}.`);
  const service=await createService({dbPath:join(directory,file)});
  try{
   if(service.operations.read().state.id!==id)throw new Error('Workspace file identity differs from the registry.');
   if(invalidate){const {db,authority,workflows}=service.operations;db.exec('BEGIN IMMEDIATE');try{authority.revokeOutstandingForReset(new Date().toISOString(),{id:'system:restore',role:'admin',name:'Restore operation'},'Verified backup restoration invalidated outstanding authority; obtain a fresh grant after reviewing the restored workspace.');workflows.invalidatePrepared();db.exec('COMMIT');}catch(error){db.exec('ROLLBACK');throw error;}}
   checks.push({workspaceId:id,file,revision:service.operations.read().revision,checks:service.operations.readiness({force:true})});
  }finally{await service.close();}
 }
 return checks;
}

export async function backupManaged({dataDir,destination}){
 dataDir=resolve(dataDir);destination=resolve(destination);if(existsSync(destination))throw new Error('Backup destination must be a new directory.');
 const release=acquireDataLease(dataDir,'backup');let created=false;
 try{
  const checks=await inspectData(dataDir);mkdirSync(destination,{recursive:true,mode:0o700});created=true;
  const files=['identity.sqlite',...checks.map(c=>c.file)],records=[];
  for(const file of files){const db=new DatabaseSync(join(dataDir,file));try{await backup(db,join(destination,file));chmodSync(join(destination,file),0o600);}finally{db.close();}records.push({file,sha256:sha(join(destination,file))});}
  const manifest={format:'truthful-managed-backup-v1',createdAt:new Date().toISOString(),files:records,workspaces:checks.map(({workspaceId,revision})=>({workspaceId,revision})),notice:'Contains account hashes, source evidence and private signing keys. Protect this directory. Checksums verify this snapshot; they are not independent authenticity.'};
  writeFileSync(join(destination,'manifest.json'),JSON.stringify(manifest,null,2),{mode:0o600});return manifest;
 }catch(error){if(created)rmSync(destination,{recursive:true,force:true});throw error;}finally{release();}
}

export async function restoreManaged({snapshot,destination}){
 snapshot=resolve(snapshot);destination=resolve(destination);if(existsSync(destination))throw new Error('Restore destination must be a new directory; existing data is never overwritten.');
 const manifest=JSON.parse(readFileSync(join(snapshot,'manifest.json')));
 if(manifest.format!=='truthful-managed-backup-v1'||!Array.isArray(manifest.files)||!Array.isArray(manifest.workspaces)||manifest.files.length!==manifest.workspaces.length+1)throw new Error('Unsupported or incomplete backup manifest.');
 const expected=new Set(['identity.sqlite',...manifest.workspaces.map(w=>`workspace-${w.workspaceId}.sqlite`)]);
 if(expected.size!==manifest.files.length)throw new Error('Backup has duplicate workspace entries.');
 for(const entry of manifest.files){if(!expected.delete(entry.file)||basename(entry.file)!==entry.file||!/^identity\.sqlite$|^workspace-[a-f0-9-]{36}\.sqlite$/.test(entry.file)||sha(join(snapshot,entry.file))!==entry.sha256)throw new Error('Backup file identity or checksum differs.');}
 mkdirSync(destination,{recursive:true,mode:0o700});const release=acquireDataLease(destination,'restore');
 try{
  for(const entry of manifest.files){copyFileSync(join(snapshot,entry.file),join(destination,entry.file));chmodSync(join(destination,entry.file),0o600);}
  const before=await inspectData(destination);for(const workspace of manifest.workspaces)if(!before.some(c=>c.workspaceId===workspace.workspaceId&&c.revision===workspace.revision))throw new Error('Backup revisions differ from its manifest.');
  const checks=await inspectData(destination,{invalidate:true});writeFileSync(join(destination,'restore-record.json'),JSON.stringify({format:'truthful-restore-v1',restoredAt:new Date().toISOString(),snapshotCreatedAt:manifest.createdAt,sessionsRevoked:true,invitationsRevoked:true,pendingPreviewsDiscarded:true,outstandingGrantsRevoked:true}),{mode:0o600});return {restored:true,workspaces:checks.length,sessionsRevoked:true,outstandingGrantsRevoked:true};
 }catch(error){release();rmSync(destination,{recursive:true,force:true});throw error;}finally{release();}
}
