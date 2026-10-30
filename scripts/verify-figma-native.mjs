import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {palette} from './build-figma-kit.mjs';
let record;
try{record=JSON.parse(await readFile('design/figma/native-record.json','utf8'));}
catch{console.error('NOT VERIFIED: native Figma import has no completed record. Connect the CLI bridge in the reviewed target document with editor/plugin access; local scene-model checks do not prove native creation.');process.exit(1);}
assert.equal(record.status,'verified-native','Native frames must be exported, visually inspected and recorded as verified-native before this gate passes.');
const spec=JSON.parse(await readFile('docs/FIGMA_SCREEN_MAP.json','utf8'));
const models=JSON.parse(await readFile('design/figma/generated/models.json','utf8'));
assert.equal(record.frames.length,spec.screens.length);assert.equal(new Set(record.frames.map(f=>f.id)).size,spec.screens.length);
for(const s of spec.screens)assert.ok(record.frames.some(f=>f.id===s.id),'Review record lacks '+s.id);
const cli=process.env.FIGMA_CLI_JS||join(homedir(),'Downloads/Coding/claude-tools/figma-cli/src/index.js');
const code=`(async () => {await figma.loadAllPagesAsync();const p=figma.root.children.find(p=>p.name==='Product flow');if(!p)throw new Error('Product flow missing');const c=(await figma.variables.getLocalVariableCollectionsAsync()).find(c=>c.name==='Truthful');return {marker:figma.root.getPluginData('truthful-design-kit'),frames:p.children.filter(n=>n.type==='FRAME').map(n=>({name:n.name,id:n.id,width:n.width,height:n.height,text:n.findAll(x=>x.type==='TEXT').length,fonts:[...new Set(n.findAll(x=>x.type==='TEXT').map(x=>x.fontName===figma.mixed?'MIXED':x.fontName.family))],controls:n.findAll(x=>x.name.startsWith('hotspot:')||x.name==='annotation-close').map(x=>({name:x.name,reactions:x.reactions.map(r=>({trigger:r.trigger&&r.trigger.type,actions:(r.actions||(r.action?[r.action]:[])).map(a=>({type:a.type,navigation:a.navigation,destinationId:a.destinationId}))}))}))})),components:figma.root.findAll(n=>n.type==='COMPONENT').map(n=>({name:n.name,id:n.id})),colors:c?(await figma.variables.getLocalVariablesAsync('COLOR')).filter(v=>v.variableCollectionId===c.id).map(v=>({name:v.name,value:v.valuesByMode[c.modes[0].modeId]})):[]};})()`;
const {stdout}=await promisify(execFile)(process.execPath,[cli,'eval',code],{timeout:60000,maxBuffer:1000000});
const raw=stdout.replace(/\u001b\[[0-9;]*m/g,'');assert.ok(!raw.includes('✗'),raw);
const live=JSON.parse(raw.slice(raw.indexOf('{'),raw.lastIndexOf('}')+1));
assert.equal(live.marker,`truthful-ovo-design-v1:${record.fileKey}`);
function textCount(n){return (n.type==='Text'?1:0)+(n.children||[]).reduce((sum,c)=>sum+textCount(c),0);}
for(const source of spec.screens){
 const expected=record.frames.find(f=>f.id===source.id),actuals=live.frames.filter(f=>f.name===source.id);assert.equal(actuals.length,1,'Duplicate/missing '+source.id);const actual=actuals[0];
 assert.equal(actual.id,expected.nodeId);assert.equal(actual.width,source.viewport.width);assert.equal(actual.height,source.viewport.height);assert.equal(actual.text,textCount(models.screens.find(n=>n.name===source.id)));assert.deepEqual(actual.fonts,['Manrope']);
 for(const action of source.actions){
  const controls=actual.controls.filter(c=>c.name==='hotspot:'+action.label);assert.ok(controls.length,'Missing hotspot '+source.id+': '+action.label);
  const isNote=action.targetId===source.id;
  const destination=isNote?record.overlays.find(f=>f.name===`review-note:${source.id}:${action.label}`).nodeId:record.frames.find(f=>f.id===action.targetId).nodeId;
  for(const control of controls)assert.deepEqual(control.reactions,[{trigger:'ON_CLICK',actions:[{type:'NODE',navigation:isNote?'OVERLAY':'NAVIGATE',destinationId:destination}]}],'Incorrect prototype destination or action: '+source.id+' / '+action.label);
 }
}
assert.equal(record.overlays.length,models.overlays.length);
for(const model of models.overlays){const expected=record.overlays.find(o=>o.name===model.name);assert.ok(expected);const actual=live.frames.find(f=>f.name===model.name);assert.ok(actual);assert.equal(actual.id,expected.nodeId);assert.equal(actual.width,model.props.w);assert.equal(actual.height,model.props.h);assert.equal(actual.text,textCount(model));const close=actual.controls.find(c=>c.name==='annotation-close');assert.ok(close);assert.deepEqual(close.reactions,[{trigger:'ON_CLICK',actions:[{type:'CLOSE'}]}]);}
for(const model of models.components)assert.equal(live.components.filter(c=>c.name===model.name).length,1,'Missing/duplicate native component '+model.name);
for(const [name,hex]of Object.entries(palette)){const matches=live.colors.filter(c=>c.name===name);assert.equal(matches.length,1,'Missing/duplicate Truthful variable '+name);const rgb=matches[0].value;assert.ok(rgb&&typeof rgb==='object');for(const [i,k]of ['r','g','b'].entries())assert.ok(Math.abs(rgb[k]-parseInt(hex.slice(1+i*2,3+i*2),16)/255)<.001,'Incorrect color '+name);}
console.log(`PASS actual Figma document: ${record.frames.length} native screen IDs, dimensions, text layers, prototype links, color variables and reusable components match the reviewed record.`);
