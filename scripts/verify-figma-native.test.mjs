import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {palette} from './build-figma-kit.mjs';

// Exercise the real verifier executable with an offline CLI-response fixture.
// These tests establish rejection behavior; they make no native Figma claim.
const exec=promisify(execFile);
const verifier=fileURLToPath(new URL('./verify-figma-native.mjs',import.meta.url));
const spec=JSON.parse(await readFile(new URL('../docs/FIGMA_SCREEN_MAP.json',import.meta.url),'utf8'));
const models=JSON.parse(await readFile(new URL('../design/figma/generated/models.json',import.meta.url),'utf8'));
const countText=node=>(node.type==='Text'?1:0)+(node.children||[]).reduce((sum,child)=>sum+countText(child),0);
function fixture(){
 const frames=spec.screens.map((screen,i)=>({id:screen.id,nodeId:`55:${i+1}`,width:screen.viewport.width,height:screen.viewport.height}));
 const record={schemaVersion:1,status:'verified-native',fileKey:'MockTruthful',fileUrl:'https://www.figma.com/design/MockTruthful/Offline-test',frames,links:spec.screens.reduce((sum,screen)=>sum+screen.actions.length,0)};
 const live={marker:'truthful-ovo-design-v1:MockTruthful',frames:spec.screens.map(screen=>{
  const model=models.screens.find(n=>n.name===screen.id),controls=[];
  function visit(node){
   if(node.name.startsWith('hotspot:')){
    const action=screen.actions.find(a=>node.name==='hotspot:'+a.label);
    assert.ok(action,'Fixture model includes an undeclared hotspot');
    controls.push({name:node.name,reactions:[{trigger:'ON_CLICK',actions:[{type:'NODE',navigation:'NAVIGATE',destinationId:frames.find(f=>f.id===action.targetId).nodeId}]}]});
   }
   for(const child of node.children||[])visit(child);
  }
  visit(model);
  return {name:screen.id,id:frames.find(f=>f.id===screen.id).nodeId,width:screen.viewport.width,height:screen.viewport.height,text:countText(model),fonts:['Manrope'],controls};
 }),components:models.components.map((n,i)=>({name:n.name,id:`66:${i+1}`})),colors:Object.entries(palette).map(([name,hex])=>({name,value:{r:parseInt(hex.slice(1,3),16)/255,g:parseInt(hex.slice(3,5),16)/255,b:parseInt(hex.slice(5,7),16)/255,a:1}}))};
 return {record,live};
}
async function harness(t,mutate=()=>{}){
 const directory=await mkdtemp(join(tmpdir(),'truthful-native-verifier-'));
 t.after(()=>rm(directory,{recursive:true,force:true}));
 const {record,live}=fixture();mutate({record,live});
 await mkdir(join(directory,'design/figma/generated'),{recursive:true});
 await mkdir(join(directory,'docs'),{recursive:true});
 for(const [path,value] of [['design/figma/native-record.json',record],['design/figma/generated/models.json',models],['docs/FIGMA_SCREEN_MAP.json',spec],['mock-response.json',live]])await writeFile(join(directory,path),JSON.stringify(value));
 const mockCli=join(directory,'mock-cli.mjs');
 await writeFile(mockCli,"import{readFile}from'node:fs/promises';if(process.argv[2]!=='eval')throw new Error('Unexpected CLI command');console.log(await readFile('mock-response.json','utf8'));\n");
 return ()=>exec(process.execPath,[verifier],{cwd:directory,env:{...process.env,FIGMA_CLI_JS:mockCli},timeout:10000,maxBuffer:1000000});
}

test('offline full valid fixture verifies 17 frames, 41 declared links, 13 colors and 12 components',async t=>{
 const {record,live}=fixture();
 assert.equal(record.frames.length,17);assert.equal(record.links,41);assert.equal(live.colors.length,13);assert.equal(live.components.length,12);
 const run=await harness(t);const {stdout}=await run();
 assert.match(stdout,/PASS actual Figma document: 17 native screen IDs/);
});
test('an incorrect NODE destination is rejected despite retaining every control and reaction',async t=>{
 const run=await harness(t,({live})=>{live.frames[0].controls[0].reactions[0].actions[0].destinationId=live.frames.at(-1).id;});
 await assert.rejects(run(),error=>{assert.equal(error.code,1);assert.match(error.stderr,/Incorrect prototype destination or action/);return true;});
});
test('a URL action cannot stand in for the expected internal NODE navigation',async t=>{
 const run=await harness(t,({live})=>{live.frames[0].controls[0].reactions[0].actions=[{type:'URL',url:'https://example.invalid/'}];});
 await assert.rejects(run(),error=>{assert.equal(error.code,1);assert.match(error.stderr,/Incorrect prototype destination or action/);return true;});
});
test('a missing declared hotspot is rejected instead of being hidden by other reaction counts',async t=>{
 const run=await harness(t,({live})=>{const label='hotspot:'+spec.screens[0].actions[0].label;live.frames[0].controls=live.frames[0].controls.filter(control=>control.name!==label);});
 await assert.rejects(run(),error=>{assert.equal(error.code,1);assert.match(error.stderr,/Missing hotspot evidence-input/);return true;});
});
