import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cwd=fileURLToPath(new URL('..',import.meta.url));
const children=[];
let closing=false,webStarted=false;
function stop(code=0) {
  if(closing)return;
  closing=true;
  for(const child of children)if(child.exitCode==null)child.kill('SIGTERM');
  process.exitCode=code;
}
function start(script,args=[]) {
  const child=spawn(process.execPath,[script,...args],{cwd,stdio:['inherit','pipe','inherit']});
  children.push(child);
  child.stdout.on('data',data=>process.stdout.write(data));
  child.on('error',error=>{process.stderr.write(`${error.message}\n`);stop(1);});
  child.on('exit',code=>{if(!closing)stop(code||1);});
  return child;
}
const server=start('--watch',['server/start.mjs']);
server.stdout.on('data',data=>{
  if(!webStarted&&data.toString().includes('Truthful local assurance service:')){
    webStarted=true;
    start('node_modules/vite/bin/vite.js',['--host','127.0.0.1','--port','5173','--strictPort']);
  }
});
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>stop(0));
