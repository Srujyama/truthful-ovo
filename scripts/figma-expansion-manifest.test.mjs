import test from 'node:test';
import assert from 'node:assert/strict';
import {createExpansionManifest,validateExpansionManifest} from './figma-expansion-manifest.mjs';
import {expectedRoots,validateRootInventory} from './figma-root-inventory.mjs';
import {applyNativeSystem} from './figma-native-system.mjs';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

function fixture(){
 const record={fileKey:'target',rootInventory:{schemaVersion:1,fileKey:'target',roots:[{name:'portfolio',id:'old:1',page:'Product flow',type:'FRAME'},{name:'board-start',id:'old:2',page:'Read me',type:'FRAME'}]}};
 const models={boards:[{name:'board-start',children:[]},{name:'board-credit',children:[{type:'Text',text:'Credit lifecycle'}]}],screens:[{name:'portfolio',children:[]},{name:'credit-preview',children:[{type:'Text',text:'Issued credit is not applied'}]}],components:[],overlays:[],navigationOverlays:[]};
 const expected=expectedRoots(models),manifest=createExpansionManifest({record,models,expected});return {record,models,expected,manifest};
}
test('exact deterministic expansion declares both screen and board pages without invented attestation',()=>{
 const f=fixture();assert.deepEqual(createExpansionManifest(f),f.manifest);
 assert.deepEqual(validateExpansionManifest(f),['board-credit','credit-preview']);
 assert.equal(f.manifest.newRoots[0].page,'Read me');assert.equal(f.manifest.newRoots[1].page,'Product flow');
 assert.equal(Object.hasOwn(f.manifest,'operatorVerified'),false);
});
test('wrong file, stale baseline identities, and stale baseline hash are refused',()=>{
 for(const mutate of [f=>f.record.fileKey='other',f=>f.record.rootInventory.roots[0].id='replaced',f=>f.manifest.baselineInventoryDigest='wrong']){const f=fixture();mutate(f);assert.throws(()=>validateExpansionManifest(f));}
});
test('an original root cannot be deleted or moved in expected models',()=>{
 for(const mutate of [f=>f.models.screens.shift(),f=>{f.expected[0].page='Product flow';},f=>f.record.rootInventory.roots.pop()]){const f=fixture();mutate(f);assert.throws(()=>validateExpansionManifest(f));}
 const f=fixture();f.models.screens.shift();assert.throws(()=>createExpansionManifest({...f,expected:expectedRoots(f.models)}),/retain every original/);
});
test('undeclared additions, changed root content, wrong page and model digest are refused',()=>{
 for(const mutate of [f=>f.manifest.newRoots.pop(),f=>f.manifest.newRoots[0].page='Product flow',f=>f.manifest.newRoots[0].modelDigest='wrong',f=>f.models.screens[1].children[0].text='Changed financial assertion',f=>f.models.screens.push({name:'unknown-screen',children:[]})]){const f=fixture();mutate(f);assert.throws(()=>validateExpansionManifest(f));}
});
test('same owned added roots resume under the unchanged baseline; foreign same-name native roots fail',()=>{
 const f=fixture(),marker='truthful-ovo-design-v1:target';
 const allowedNewNames=validateExpansionManifest(f),old=f.record.rootInventory.roots;
 const live=[...old,...f.manifest.newRoots.map((n,i)=>({...n,id:'new:'+i,owner:marker,sourceRoot:n.name}))];
 const resolved=validateRootInventory({expected:f.expected,allowedNewNames,inventory:f.record.rootInventory,live,marker});
 f.record.rootInventory=resolved;assert.deepEqual(validateExpansionManifest(f),allowedNewNames);
 assert.equal(f.manifest.baselineRoots.length,2);
 const next=validateRootInventory({expected:f.expected,allowedNewNames,inventory:resolved,live,marker});assert.deepEqual(next,resolved);
 live.at(-1).owner='foreign';assert.throws(()=>validateRootInventory({expected:f.expected,allowedNewNames,inventory:resolved,live,marker}),/marker changed/);
});
test('unowned retries and undeclared inventory expansion fail',()=>{
 const f=fixture();f.record.rootInventory.roots.push({name:'credit-preview',id:'added',page:'Product flow',type:'FRAME'});assert.throws(()=>validateExpansionManifest(f),/ownership/);
 f.record.rootInventory.roots.at(-1).ownerRequired=true;assert.doesNotThrow(()=>validateExpansionManifest(f));
 f.record.rootInventory.roots.push({name:'foreign',id:'foreign',page:'Read me',type:'FRAME',ownerRequired:true});assert.throws(()=>validateExpansionManifest(f),/undeclared/);
});

test('large native system manifests round-trip through bounded owned chunks without losing instances or proofs',async()=>{
 const cwd=process.cwd(),directory=await mkdtemp(join(tmpdir(),'truthful-system-spool-'));
 try{
  await mkdir(join(directory,'design/figma/generated'),{recursive:true});
  await writeFile(join(directory,'design/figma/generated/models.json'),JSON.stringify({screens:[],boards:[],overlays:[],components:[]}));
  process.chdir(directory);
  const marker='truthful-ovo-design-v1:target',store=new Map([['truthful-design-kit',marker]]);
  const figma={root:{getPluginData:key=>store.get(key)||'',setPluginData:(key,value)=>value?store.set(key,value):store.delete(key)},fileKey:'target'};
  const manifest={fileKey:'target',instances:Array.from({length:1000},(_,i)=>({id:'instance-'+i,label:'Supplied label "quoted" \n '+i})),proofs:{allRetained:true}};
  let reads=0,maxOutput=0;
  const evaluate=async code=>{
   let result;
   if(code.includes('const result=await (')){
    // The real architecture mutation/probes are outside this offline test.
    // Execute the exact spool writer suffix against its completed manifest.
    const suffix=code.slice(code.indexOf('const data=JSON.stringify(result)'));
    result=await new Function('figma','result',`return (async()=>{${suffix}})();`)(figma,manifest);
   }else{reads++;result=await new Function('figma',`return (async()=>{${code}})();`)(figma);}
   maxOutput=Math.max(maxOutput,JSON.stringify(result).length);return result;
  };
  const result=await applyNativeSystem({evaluate,marker,fileKey:'target'});
  assert.deepEqual(result,manifest);assert.ok(reads>20,'Large manifests need multiple reads');assert.ok(maxOutput<20000,'Each response stays below bridge clipping');
  assert.deepEqual(JSON.parse(await readFile('design/figma/native-system.json','utf8')),manifest);
  assert.deepEqual([...store.keys()],['truthful-design-kit'],'Owned transient spool is cleared');
 }finally{process.chdir(cwd);await rm(directory,{recursive:true,force:true});}
});
