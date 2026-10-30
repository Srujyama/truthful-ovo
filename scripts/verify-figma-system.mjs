import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {homedir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

// The manifest records reviewed IDs; this gate independently reads their current
// native types, inheritance, bindings and coverage. Recorded counts are no proof.
export function validateSystem(manifest,record,live){
 assert.equal(manifest.status,'verified-native-system','System review is pending');
 assert.equal(record.status,'verified-native','Screen review is pending');
 assert.equal(manifest.fileKey,record.fileKey);
 assert.equal(live.marker,`truthful-ovo-design-v1:${record.fileKey}`,'Wrong target marker');
 const declared=new Map();
 assert.equal(manifest.sets.length,2);
 assert.deepEqual([...new Set(manifest.sets.map(s=>s.role))].sort(),['Button','Status'],'Exactly one Button and Status set required');
 assert.equal(new Set(manifest.sets.map(s=>s.id)).size,2,'Duplicate set identity');
 for(const expected of manifest.sets){
  const actual=live.sets.find(s=>s.id===expected.id);
  assert.equal(actual?.type,'COMPONENT_SET','Missing native component set');
  assert.equal(actual.name,`Truthful / ${expected.role}`);
  assert.equal(actual.page,'Design system');
  assert.equal(actual.children.length,6);
  const combinations=expected.role==='Button'?['Primary','Secondary'].flatMap(Style=>['Default','Hover','Disabled'].map(State=>({Style,State}))):['Approved','Unsafe effect','Inconclusive','Needs approval','Consumed once','Stale approval'].map(State=>({State}));
  assert.equal(expected.variants.length,6);
  for(const properties of combinations){
   const variant=expected.variants.find(v=>JSON.stringify(v.properties)===JSON.stringify(properties));
   assert.ok(variant,'Missing variant combination');
   const node=actual.children.find(n=>n.id===variant.id);
   assert.equal(node?.type,'COMPONENT');assert.deepEqual(node.properties,properties);
   assert.equal(node.sourceName,variant.sourceName);
   if(expected.role==='Button'){
    assert.equal(node.labelReference,variant.labelProperty,'Unbound Label property');
    assert.equal(node.definitions[variant.labelProperty]?.type,'TEXT','Missing editable Label');
   }else{assert.equal(variant.labelProperty,null,'Status labels must follow State');assert.ok(!node.labelReference,'Status label must not allow contradictory overrides');}
   declared.set(variant.id,variant);
  }
  if(expected.role==='Button')for(const Style of ['Primary','Secondary']){
   const byState=State=>actual.children.find(v=>v.properties.Style===Style&&v.properties.State===State);
   assert.notEqual(byState('Default').fillSignature,byState('Hover').fillSignature,'Hover must be visually distinct: '+Style);
  }
 }
 assert.ok(manifest.instances.length>=17,'Insufficient linked instances');
 assert.equal(new Set(manifest.instances.map(i=>i.id)).size,manifest.instances.length);
 for(const expected of manifest.instances){
  const actual=live.instances.find(i=>i.id===expected.id);
  assert.equal(actual?.type,'INSTANCE','Detached or missing instance');
  assert.ok(declared.has(actual.componentId),'Unknown main component');
  assert.equal(actual.componentId,expected.componentId);assert.equal(actual.rootId,expected.rootId);
  const variant=declared.get(actual.componentId);
  assert.equal(actual.label,variant.labelProperty?actual.properties[variant.labelProperty]?.value:variant.properties.State,'Component text contradicts its property');
 }
 for(const screen of record.frames){
  const actual=live.screens.find(s=>s.id===screen.nodeId);assert.ok(actual,'Missing screen');
  assert.ok(actual.instanceIds.length>0,'Screen has no linked system instance: '+screen.id);
  for(const id of actual.instanceIds)assert.ok(live.instances.some(i=>i.id===id&&declared.has(i.componentId)),'Undeclared screen instance');
  assert.ok(actual.textCount>0&&actual.styledCount/actual.textCount>=.8,'Shared typography coverage too low: '+screen.id);
  assert.equal(actual.missingFonts,0);assert.equal(actual.clipping.length,0,'Clipped text: '+screen.id);
  assert.ok(actual.spatialBindings>0&&actual.colorBoundNodes>0,'Screen lost shared variable bindings: '+screen.id);
 }
 assert.ok(manifest.textStyles.length>=5);
 for(const expected of manifest.textStyles){const actual=live.textStyles.find(s=>s.id===expected.id);assert.ok(actual);assert.equal(actual.name,expected.name);assert.equal(actual.family,'Public Sans');assert.equal(actual.size,expected.size);}
 const expectedVariables=[...['space/0','space/4','space/8','space/12','space/16','space/20','space/24','space/32'],...['radius/4','radius/6','radius/10']];
 assert.equal(manifest.numberVariables.length,expectedVariables.length);
 for(const name of expectedVariables){const expected=manifest.numberVariables.find(v=>v.name===name),actual=live.numberVariables.find(v=>v.id===expected?.id);assert.ok(actual,'Missing spatial variable');assert.equal(actual.name,name);assert.equal(actual.type,'FLOAT');assert.equal(actual.collection,'Truthful · Layout');assert.equal(actual.value,Number(name.split('/')[1]));}
 assert.ok(live.screens.reduce((sum,s)=>sum+s.spatialBindings,0)>=50,'Spatial variables are not used on screens');
 assert.equal(live.handoff?.type,'PAGE');assert.equal(live.handoff.name,'Handoff');
 assert.equal(manifest.handoff.frames.length,3);
 for(const frame of manifest.handoff.frames){const actual=live.handoff.frames.find(f=>f.id===frame.id);assert.equal(actual?.type,'FRAME');assert.ok(actual.textLayers>0);}
 assert.ok(live.handoff.instances>=3,'Handoff needs editable examples');
 assert.equal(live.libraryGuide?.type,'FRAME');assert.ok(live.libraryGuide.textLayers>=3);
 assert.deepEqual(live.probePages,[],'Temporary proof pages remain');
 for(const name of ['labelOverride','masterPropagation','buttonResize','portfolioResize','mobileResize','inheritedStyleSwap','statusVariantSwap'])assert.equal(manifest.proofs?.[name]?.passed,true,'Failed or absent native probe: '+name);
 assert.equal(manifest.proofs.masterPropagation.observed,manifest.proofs.masterPropagation.before+1);
 assert.equal(manifest.proofs.portfolioResize.width,1280);assert.equal(manifest.proofs.mobileResize.width,430);
 for(const name of ['portfolioResize','mobileResize']){assert.equal(manifest.proofs[name].nestedClipCount,0);assert.equal(manifest.proofs[name].missingFonts,0);}
 assert.equal(manifest.proofs.inheritedStyleSwap.swaps.length,2);assert.ok(manifest.proofs.inheritedStyleSwap.swaps.every(s=>s.passed));
 for(const name of ['masterPropagation','inheritedStyleSwap','statusVariantSwap'])assert.ok(manifest.instances.some(i=>i.id===manifest.proofs[name].sourceInstanceId),'Probe did not exercise an actual migrated instance');
 const stateProof=manifest.proofs.statusVariantSwap;assert.notEqual(stateProof.beforeState,stateProof.targetState,'Status swap cannot be a no-op');assert.equal(stateProof.observed,stateProof.targetState);
 return {screens:record.frames.length,instances:manifest.instances.length,sets:manifest.sets.length,textStyles:manifest.textStyles.length,spatialBindings:live.screens.reduce((sum,s)=>sum+s.spatialBindings,0)};
}

export async function collectSystem(cli,manifest,record){
 const config={setIds:manifest.sets.map(s=>s.id),instanceIds:manifest.instances.map(i=>i.id),screenIds:record.frames.map(f=>f.nodeId),rootIds:[...new Set(manifest.instances.map(i=>i.rootId))],handoff:manifest.handoff,libraryGuideId:manifest.libraryGuideId,styleIds:manifest.textStyles.map(s=>s.id),variableIds:manifest.numberVariables.map(v=>v.id)};
 const codeFor=(section,start=0)=>`(async () => {
 await figma.loadAllPagesAsync();const c=${JSON.stringify({...config,section,start})};
 const get=id=>figma.getNodeByIdAsync(id);const page=n=>{while(n&&n.type!=='PAGE')n=n.parent;return n?.name;};
 const defs=n=>n.parent?.type==='COMPONENT_SET'?n.parent.componentPropertyDefinitions:n.componentPropertyDefinitions;
 const sets=[];for(const id of c.setIds){const n=await get(id);sets.push(n?{id,type:n.type,name:n.name,page:page(n),children:n.children.map(v=>({id:v.id,type:v.type,properties:v.variantProperties,fillSignature:JSON.stringify(v.fills.map(p=>({type:p.type,color:p.color,opacity:p.opacity??1,visible:p.visible!==false}))),sourceName:v.getPluginData('truthful-component-source'),definitions:defs(v),labelReference:v.findOne(x=>x.type==='TEXT'&&x.name==='Label')?.componentPropertyReferences?.characters}))}:{id});}
 const instances=[];for(const id of c.instanceIds){const n=await get(id);if(!n){instances.push({id});continue;}let ancestor=n;while(ancestor&&!c.rootIds.includes(ancestor.id))ancestor=ancestor.parent;instances.push({id,type:n.type,rootId:ancestor?.id,componentId:n.type==='INSTANCE'?(await n.getMainComponentAsync())?.id:null,properties:n.componentProperties,label:n.findOne(x=>x.type==='TEXT')?.characters});}
 function clips(root){const bad=[];for(const t of root.findAll(n=>n.type==='TEXT')){const b=t.absoluteBoundingBox;let p=t.parent;while(p&&p.type!=='PAGE'){if(p===root||p.clipsContent){const a=p.absoluteBoundingBox;if(!b||!a||b.x<a.x-.5||b.y<a.y-.5||b.x+b.width>a.x+a.width+.5||b.y+b.height>a.y+a.height+.5)bad.push({text:t.id,ancestor:p.id});}if(p===root)break;p=p.parent;}}return bad;}
 const screens=[];for(const id of c.screenIds){const n=await get(id);if(!n)continue;const texts=n.findAll(x=>x.type==='TEXT');let spatialBindings=0,colorBoundNodes=0;for(const x of [n,...n.findAll()]){const b=x.boundVariables||{};for(const field of ['itemSpacing','paddingLeft','paddingRight','paddingTop','paddingBottom','cornerRadius'])if(c.variableIds.includes(b[field]?.id))spatialBindings++;if(b.fills||b.strokes||Array.isArray(x.fills)&&x.fills.some(p=>p.boundVariables?.color)||Array.isArray(x.strokes)&&x.strokes.some(p=>p.boundVariables?.color))colorBoundNodes++;}screens.push({id,textCount:texts.length,styledCount:texts.filter(t=>c.styleIds.includes(t.textStyleId)).length,missingFonts:texts.filter(t=>t.hasMissingFont).length,clipping:clips(n),instanceIds:n.findAll(x=>x.type==='INSTANCE').map(x=>x.id),spatialBindings,colorBoundNodes});}
 const textStyles=(await figma.getLocalTextStylesAsync()).map(s=>({id:s.id,name:s.name,family:s.fontName.family,size:s.fontSize}));
 const collections=await figma.variables.getLocalVariableCollectionsAsync();const numberVariables=(await figma.variables.getLocalVariablesAsync('FLOAT')).map(v=>{const col=collections.find(x=>x.id===v.variableCollectionId);return {id:v.id,name:v.name,type:v.resolvedType,collection:col?.name,value:v.valuesByMode[col?.modes[0].modeId]};});

 const h=await get(c.handoff.pageId),g=await get(c.libraryGuideId);const handoff=h?{type:h.type,name:h.name,frames:[],instances:h.findAll(x=>x.type==='INSTANCE').length}:null;if(h)for(const frame of c.handoff.frames){const f=await get(frame.id);handoff.frames.push({id:frame.id,type:f?.type,textLayers:f?.findAll(x=>x.type==='TEXT').length});}
 const result={marker:figma.root.getPluginData('truthful-design-kit'),sets,instances,screens,textStyles,numberVariables,handoff,libraryGuide:g?{type:g.type,textLayers:g.findAll(x=>x.type==='TEXT').length}:null,probePages:figma.root.children.filter(p=>/native system probes/.test(p.name)).map(p=>p.id)};return c.section==='instances'?{instances:instances.slice(c.start,c.start+20)}:Object.fromEntries(c.section.map(k=>[k,result[k]]));
 })()`;
 const live={instances:[]};
 // The bridge limits one evaluation's output. Bounded read batches prevent a
 // truncated JSON result from concealing missing native nodes.
 const groups=[[['marker','sets'],0],[['screens','textStyles','numberVariables','handoff','libraryGuide','probePages'],0],...Array.from({length:Math.ceil(config.instanceIds.length/20)},(_,i)=>['instances',i*20])];
 for(const [section,start]of groups){
  const {stdout}=await promisify(execFile)(process.execPath,[cli,'eval',codeFor(section,start)],{timeout:60000,maxBuffer:1000000});
  const raw=stdout.replace(/\u001b\[[0-9;]*m/g,'');assert.ok(!raw.includes('✗'),raw);const result=JSON.parse(raw.slice(raw.indexOf('{'),raw.lastIndexOf('}')+1));
  if(section==='instances')live.instances.push(...result.instances);else Object.assign(live,result);
 }
 return live;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const manifest=JSON.parse(await readFile('design/figma/native-system.json','utf8')),record=JSON.parse(await readFile('design/figma/native-record.json','utf8'));
 assert.equal(manifest.status,'verified-native-system','System review is pending');
 assert.equal(record.status,'verified-native','Screen review is pending');
 const cli=process.env.FIGMA_CLI_JS||join(homedir(),'Downloads/Coding/claude-tools/figma-cli/src/index.js');
 const live=await collectSystem(cli,manifest,record);
 console.log('PASS native Figma system',JSON.stringify(validateSystem(manifest,record,live)));
}
