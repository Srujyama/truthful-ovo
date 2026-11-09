#!/usr/bin/env node
import {fileURLToPath} from 'node:url';
import {createService} from './service.mjs';
import {createManagedService} from './managed.mjs';
const args=process.argv.slice(2);
if(args.includes('--help')){console.log('Usage: node server/start.mjs [--mode demo|managed] [--port 5174] [--db FILE] [--data DIR] [--origin EXACT_ORIGIN] [--secure-cookies]\nManaged mode requires an account initialized with server/admin.mjs bootstrap. Both modes bind loopback. No external vendor messages, payments or AI service is connected.');process.exit(0);}
const options={mode:'demo',port:5174,dbPath:fileURLToPath(new URL('./data/truthful.sqlite',import.meta.url)),dataDir:fileURLToPath(new URL('./data/managed',import.meta.url)),origins:[],secureCookies:false};
for(let i=0;i<args.length;i++){
 const arg=args[i];if(arg==='--secure-cookies'){options.secureCookies=true;continue;}const value=args[++i];
 if(arg==='--mode'&&['demo','managed'].includes(value))options.mode=value;
 else if(arg==='--port'&&/^\d+$/.test(value||'')&&Number(value)<=65535)options.port=Number(value);
 else if(arg==='--db'&&value)options.dbPath=value;
 else if(arg==='--data'&&value)options.dataDir=value;
 else if(arg==='--origin'&&value)options.origins.push(value);
 else throw new Error('Unknown or invalid option. Use --help.');
}
const allowedOrigins=options.origins.length?options.origins:['http://127.0.0.1:5173','http://localhost:5173','http://127.0.0.1:4173','http://localhost:4173'];
const service=options.mode==='managed'?await createManagedService({dataDir:options.dataDir,allowedOrigins,secureCookies:options.secureCookies,logger:entry=>console.log(JSON.stringify(entry))}):await createService({dbPath:options.dbPath,allowedOrigins});
const {baseUrl}=await service.listen({port:options.port});console.log(`Truthful backend: ${baseUrl} (${options.mode})`);
let stopping=false;for(const signal of ['SIGINT','SIGTERM'])process.once(signal,async()=>{if(stopping)return;stopping=true;try{await service.close();}catch(error){console.error(error.message);process.exitCode=1;}});
