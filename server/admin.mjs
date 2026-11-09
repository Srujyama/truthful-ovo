#!/usr/bin/env node
import {createManagedService} from './managed.mjs';
import {backupManaged,restoreManaged} from './maintenance.mjs';
const [command,...args]=process.argv.slice(2);
if(!command||command==='--help'){
 console.log('Usage:\n  node server/admin.mjs bootstrap --data DIR < account.json\n  node server/admin.mjs verify --data DIR\n  node server/admin.mjs backup --data DIR --to NEW_DIR\n  node server/admin.mjs restore --snapshot DIR --to NEW_DIR\n\nBootstrap JSON: {email,password,name,workspaceName}. Read passwords from stdin, never command arguments.\nBackup/restore/verify are offline operations: stop the managed backend first. Restore revokes sessions, invitations, pending previews and unused grants.');process.exit(0);
}
const options={};for(let i=0;i<args.length;i+=2){if(!['--data','--to','--snapshot'].includes(args[i])||!args[i+1]||options[args[i]])throw new Error('Use --help for supported options.');options[args[i]]=args[i+1];}
try{
 if(command==='backup'){if(!options['--data']||!options['--to'])throw new Error('Provide --data and --to.');console.log(JSON.stringify(await backupManaged({dataDir:options['--data'],destination:options['--to']}),null,2));}
 else if(command==='restore'){if(!options['--snapshot']||!options['--to'])throw new Error('Provide --snapshot and --to.');console.log(JSON.stringify(await restoreManaged({snapshot:options['--snapshot'],destination:options['--to']}),null,2));}
 else if(['bootstrap','verify'].includes(command)){
  if(!options['--data'])throw new Error('Provide --data.');const service=await createManagedService({dataDir:options['--data']});
  try{if(command==='bootstrap'){let text='';for await(const chunk of process.stdin){text+=chunk;if(Buffer.byteLength(text)>65536)throw new Error('Bootstrap input exceeds 64 KiB.');}const result=await service.bootstrap(JSON.parse(text));console.log(JSON.stringify(result,null,2));}else console.log(JSON.stringify({ok:true,checks:await service.readiness()},null,2));}finally{await service.close();}
 }else throw new Error('Unknown command. Use --help.');
}catch(error){console.error(error.message);process.exitCode=1;}
