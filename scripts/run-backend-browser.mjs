#!/usr/bin/env node
import {createService} from '../server/service.mjs';
import {createManagedService} from '../server/managed.mjs';
import {build,preview} from 'vite';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,mkdtemp,readFile,writeFile,rm,access} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {homedir} from 'node:os';
const product=process.argv.includes('--product'),examples=process.argv.includes('--examples'),records=process.argv.includes('--records'),redesign=process.argv.includes('--redesign')||process.argv.includes('--clearing-house'),creditRecovery=process.argv.includes('--credit-recovery'),creditWorkflow=creditRecovery||process.argv.includes('--credit-workflow'),browserLocal=process.argv.includes('--browser-local'),demo=records||creditWorkflow||examples||product;
if(browserLocal&&!creditWorkflow&&!examples)throw new Error('--browser-local is supported only for isolated credit/example workflows.');
const resultName=product?'product-workflow-result.json':examples?'workspace-examples-result.json':records?'workspace-records-result.json':creditRecovery?'credit-recovery-result.json':creditWorkflow?'credit-workflow-result.json':redesign?'workspace-redesign-result.json':'backend-browser-result.json',logName=product?'product-workflow-browser.log':examples?'workspace-examples-browser.log':records?'workspace-records-browser.log':creditRecovery?'credit-recovery-browser.log':creditWorkflow?'credit-workflow-browser.log':redesign?'workspace-redesign-browser.log':'backend-browser.log';
const run=promisify(execFile),root=resolve(new URL('..',import.meta.url).pathname),cli=process.env.PLAYWRIGHT_CLI||join(homedir(),'.codex/skills/playwright/scripts/playwright_cli.sh');
await access(cli).catch(()=>{throw new Error('Install the Playwright skill CLI or set PLAYWRIGHT_CLI to its wrapper path.');});
await mkdir(join(root,'output/playwright'),{recursive:true});const dataDir=await mkdtemp(join(root,'output/backend-browser-run-')),session=`backend-${process.pid}`;
const webPort=Number(process.env.TRUTHFUL_BROWSER_PORT||(demo?5415:5412)),backendPort=Number(process.env.TRUTHFUL_BROWSER_BACKEND_PORT||(demo?5414:5411));
let backend,web,opened=false;
try{
 backend=demo?await createService({dbPath:join(dataDir,'workspace.sqlite'),allowedOrigins:[`http://127.0.0.1:${webPort}`]}):await createManagedService({dataDir,allowedOrigins:[`http://127.0.0.1:${webPort}`]});
 if(!demo)await backend.bootstrap({email:'admin@hackathon.test',password:'BrowserWorkflow123!',name:'Finance Admin',workspaceName:'Hackathon Finance'});
 const {baseUrl}=await backend.listen({port:backendPort});
 await build({configFile:false,root,base:'/',build:{outDir:join(dataDir,'web'),emptyOutDir:true}});
 web=await preview({configFile:false,root,build:{outDir:join(dataDir,'web')},preview:{host:'127.0.0.1',port:webPort,strictPort:true,proxy:{'/api':{target:baseUrl,changeOrigin:true}}}});
 await rm(join(root,'output/playwright',resultName),{force:true});
 await run(cli,[`-s=${session}`,'open',`http://127.0.0.1:${webPort}`,'--headed'],{cwd:root,timeout:60000,maxBuffer:2000000});opened=true;
 if(browserLocal)await run(cli,[`-s=${session}`,'run-code',"async page => { await page.route('**/api/session', route => route.fulfill({status:404,contentType:'application/json',body:JSON.stringify({error:{message:'Isolated offline browser workflow'}})})); }"],{cwd:root,timeout:30000});
 const scripts=creditWorkflow?['scripts/browser-credit-workflow-check.js',...(creditRecovery?['scripts/browser-credit-recovery-check.js']:[])]:[product?'scripts/browser-product-workflow.js':examples?'scripts/browser-check.js':records?'scripts/browser-workspace-records.js':redesign?'scripts/browser-workspace-redesign.js':'scripts/browser-backend-workflow.js'];
 let log='';for(const script of scripts){
  const result=await run(cli,[`-s=${session}`,'run-code','--filename',script],{cwd:root,timeout:records||creditWorkflow||product?300000:180000,maxBuffer:2000000});log+=result.stdout;await writeFile(join(root,'output',logName),log);if(result.stdout.includes('### Error'))throw new Error(result.stdout.slice(0,3000));
  if(creditWorkflow){const name=script.includes('recovery')?'credit-recovery-result.json':'credit-workflow-result.json',raw=await readFile(join(root,'output/playwright',name),'utf8'),evidence=JSON.parse(raw);if(evidence.mode!==(browserLocal?'browser':'server')||evidence.ok!==true||evidence.errors?.length||!evidence.passed||evidence.passed!==evidence.checks?.length)throw new Error(JSON.stringify(evidence.errors||evidence,null,2));await writeFile(join(root,'output/playwright',`${evidence.mode}-${name}`),raw);}
 }
 const evidence=JSON.parse(await readFile(join(root,'output/playwright',resultName),'utf8'));
 if(evidence.ok===false||evidence.errors?.length)throw new Error(JSON.stringify(evidence.errors,null,2));
 console.log(`Real ${product?'product':examples?`${evidence.runtime} document/examples`:creditWorkflow?(browserLocal?'browser-local credit':'SQLite credit'):records?'records':'managed'} browser workflow: ${evidence.passed}/${evidence.checks.length} checks; isolated fresh workspace; retained screenshots and replay packet in output/playwright.`);
}catch(error){if(error.stdout)await writeFile(join(root,'output',logName),error.stdout);throw error;}
finally{
 if(opened)await run(cli,[`-s=${session}`,'close'],{cwd:root,timeout:30000}).catch(()=>{});
 if(web){web.httpServer.closeAllConnections?.();await new Promise(resolve=>web.httpServer.close(resolve));}await backend?.close();await rm(dataDir,{recursive:true,force:true});
}
