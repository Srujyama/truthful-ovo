#!/usr/bin/env node
import {createManagedService} from '../server/managed.mjs';
import {build,preview} from 'vite';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,mkdtemp,readFile,writeFile,rm,access} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {homedir} from 'node:os';
const clearing=process.argv.includes('--clearing-house'),resultName=clearing?'clearing-house-browser-result.json':'backend-browser-result.json',logName=clearing?'clearing-house-browser.log':'backend-browser.log';
const run=promisify(execFile),root=resolve(new URL('..',import.meta.url).pathname),cli=process.env.PLAYWRIGHT_CLI||join(homedir(),'.codex/skills/playwright/scripts/playwright_cli.sh');
await access(cli).catch(()=>{throw new Error('Install the Playwright skill CLI or set PLAYWRIGHT_CLI to its wrapper path.');});
await mkdir(join(root,'output/playwright'),{recursive:true});const dataDir=await mkdtemp(join(root,'output/backend-browser-run-')),session=`backend-${process.pid}`;
let backend,web,opened=false;
try{
 backend=await createManagedService({dataDir,allowedOrigins:['http://127.0.0.1:5194']});
 await backend.bootstrap({email:'admin@hackathon.test',password:'BrowserWorkflow123!',name:'Finance Admin',workspaceName:'Hackathon Finance'});
 const {baseUrl}=await backend.listen({port:5185});
 await build({configFile:false,root,base:'/',build:{outDir:join(dataDir,'web'),emptyOutDir:true}});
 web=await preview({configFile:false,root,build:{outDir:join(dataDir,'web')},preview:{host:'127.0.0.1',port:5194,strictPort:true,proxy:{'/api':{target:baseUrl,changeOrigin:true}}}});
 await rm(join(root,'output/playwright',resultName),{force:true});
 await run(cli,[`-s=${session}`,'open','http://127.0.0.1:5194','--headed'],{cwd:root,timeout:60000,maxBuffer:2000000});opened=true;
 const result=await run(cli,[`-s=${session}`,'run-code','--filename',clearing?'scripts/browser-clearing-house.js':'scripts/browser-backend-workflow.js'],{cwd:root,timeout:180000,maxBuffer:2000000});
 await writeFile(join(root,'output',logName),result.stdout);
 if(result.stdout.includes('### Error'))throw new Error(result.stdout.slice(0,2000));
 const evidence=JSON.parse(await readFile(join(root,'output/playwright',resultName),'utf8'));
 console.log(`Real managed browser workflow: ${evidence.passed}/${evidence.checks.length} checks; separate accounts; fresh empty workspace; retained screenshots and replay packet in output/playwright.`);
}catch(error){if(error.stdout)await writeFile(join(root,'output',logName),error.stdout);throw error;}
finally{
 if(opened)await run(cli,[`-s=${session}`,'close'],{cwd:root,timeout:30000}).catch(()=>{});
 if(web)await new Promise(resolve=>web.httpServer.close(resolve));await backend?.close();await rm(dataDir,{recursive:true,force:true});
}
