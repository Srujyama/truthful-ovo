import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {homedir} from 'node:os';
import {join,resolve} from 'node:path';
import {build} from './build-figma-kit.mjs';
import {validateTargetBinding} from './figma-target-binding.mjs';

// Drives the installed CLI. No desktop patch, credentials, or payment flow.
const exec=promisify(execFile);
const cli=process.env.FIGMA_CLI_JS||join(homedir(),'Downloads/Coding/claude-tools/figma-cli/src/index.js');
const args=process.argv.slice(2),url=args[args.indexOf('--file-url')+1];
if(!args.includes('--file-url')||!/^https:\/\/(www\.)?figma\.com\/design\/[A-Za-z0-9]+/.test(url||''))throw new Error('Supply --file-url with the exact empty target Design file opened in Figma Desktop.');
const fileKey=new URL(url).pathname.split('/')[2];
const marker=`truthful-ovo-design-v1:${fileKey}`;
await build();await mkdir('output/figma-native',{recursive:true});
if(args.includes('--plan')){console.log(JSON.stringify({fileUrl:url,method:'figma-cli plugin mode',pages:['Read me','Product flow','Design system'],screens:17,boards:7,componentSpecimens:12,colorVariables:13,nativeMutation:false},null,2));process.exit(0);}
async function run(commandArgs){
 const {stdout,stderr}=await exec(process.execPath,[cli,...commandArgs],{cwd:process.cwd(),env:process.env,timeout:90000,maxBuffer:2000000});
 const output=stdout.replace(/\u001b\[[0-9;]*m/g,'');
 if(output.includes('✗'))throw new Error(output.trim());
 await writeFile('output/figma-native/last-cli.log',stdout+stderr);
 return output;
}
async function evaluate(code){
 const raw=await run(['eval',`(async () => {${code}})()`]);
 const first=raw.indexOf('{'),last=raw.lastIndexOf('}');
 if(first<0||last<first)throw new Error('CLI returned no structured result: '+raw.slice(0,300));
 const result=JSON.parse(raw.slice(first,last+1));if(result.error)throw new Error(result.error);return result;
}
const initial=await evaluate(`await figma.loadAllPagesAsync();return {name:figma.root.name,documentId:figma.root.id,currentPageId:figma.currentPage.id,fileKey:figma.fileKey||null,marker:figma.root.getPluginData('truthful-design-kit'),pages:figma.root.children.map(p=>({name:p.name,count:p.children.length}))};`);
const attestationPath=args.includes('--target-attestation')?args[args.indexOf('--target-attestation')+1]:null;
const attestation=attestationPath?JSON.parse(await readFile(attestationPath,'utf8')):null;
const targetBinding=validateTargetBinding(initial,{fileUrl:url,attestation,now:new Date().toISOString()});
if(!initial.marker&&initial.pages.some(p=>p.count!==0))throw new Error('Target is not empty and was not created by this kit. Use a new blank file.');
await evaluate(`figma.root.setPluginData('truthful-design-kit',${JSON.stringify(marker)});if(figma.root.children.length===1&&figma.root.children[0].children.length===0)figma.root.children[0].name='Read me';return {prepared:true};`);
const models=JSON.parse(await readFile('design/figma/generated/models.json','utf8'));
const spec=JSON.parse(await readFile('docs/FIGMA_SCREEN_MAP.json','utf8'));
const existing=await evaluate(`await figma.loadAllPagesAsync();return {nodes:figma.root.children.flatMap(p=>p.children.map(n=>({name:n.name,type:n.type,page:p.name,id:n.id}))),collections:(await figma.variables.getLocalVariableCollectionsAsync()).map(c=>c.name)};`);
if(!existing.collections.includes('Truthful'))await run(['import',resolve('design/figma/generated/tokens.json'),'--collection','Truthful']);
for(const [type,page]of [['components','Design system'],['boards','Read me'],['screens','Product flow'],['overlays','Product flow'],['navigationOverlays','Product flow']]){
 const jsx=JSON.parse(await readFile(`design/figma/generated/${type}.jsx.json`,'utf8'));
 for(let i=0;i<jsx.length;i+=2){
  const batch=jsx.slice(i,i+2).filter((s,j)=>!existing.nodes.some(n=>n.page===page&&n.name===models[type][i+j].name));
  if(!batch.length)continue;
  const path=resolve(`output/figma-native/${type}-${i}.json`);await writeFile(path,JSON.stringify(batch));
  console.log(`Creating ${type} ${i+1}–${Math.min(i+2,jsx.length)} in ${page}…`);
  await evaluate(`if(figma.root.getPluginData('truthful-design-kit')!==${JSON.stringify(marker)})throw new Error('Wrong design document.');return {targetChecked:true};`);
  await run(['render-batch','--file',path,'--page',page,'--collection','Truthful',...(type==='components'?['--as-component']:[])]);
 }
}
// The CLI warns instead of throwing if an --as-component conversion fails.
// A retained owned Frame must be converted or rejected, never skipped forever.
for(const component of models.components){
 const found=await evaluate(`const p=figma.root.children.find(p=>p.name==='Design system');const ns=p.children.filter(n=>n.name===${JSON.stringify(component.name)});return {nodes:ns.map(n=>({id:n.id,type:n.type}))};`);
 if(found.nodes.length!==1)throw new Error('Expected one owned component specimen: '+component.name);
 if(found.nodes[0].type==='FRAME'){
  await evaluate(`if(figma.root.getPluginData('truthful-design-kit')!==${JSON.stringify(marker)})throw new Error('Wrong design document.');return {targetChecked:true};`);
  await run(['node','to-component',found.nodes[0].id]);
 }
 const repaired=await evaluate(`const p=figma.root.children.find(p=>p.name==='Design system');return {types:p.children.filter(n=>n.name===${JSON.stringify(component.name)}).map(n=>n.type)};`);
 if(repaired.types.length!==1||repaired.types[0]!=='COMPONENT')throw new Error('Component conversion remains incomplete: '+component.name);
}
// CLI2.2.5 requests "Semi Bold", while Public Sans uses "SemiBold".
// Normalize only text inside this kit's named roots, retaining semantic weight.
await evaluate(`
if(figma.root.getPluginData('truthful-design-kit')!==${JSON.stringify(marker)})throw new Error('Wrong design document.');
const mapping={regular:'Regular',medium:'Medium',semibold:'SemiBold',bold:'Bold'};
for(const style of Object.values(mapping))await figma.loadFontAsync({family:'Public Sans',style});
const key=s=>s.toLowerCase().replace(/[^a-z]/g,'');const names=new Set(${JSON.stringify([...models.screens,...models.boards,...models.components,...models.overlays,...(models.navigationOverlays||[])].map(n=>n.name))});let normalized=0;
for(const page of figma.root.children)for(const root of page.children.filter(n=>names.has(n.name)))for(const text of root.findAll(n=>n.type==='TEXT')){if(text.fontName===figma.mixed)throw new Error('Unexpected mixed-font text in owned root');if(text.fontName.family==='Public Sans'&&!text.hasMissingFont)continue;const style=mapping[key(text.fontName.style)];if(!style)throw new Error('No matching Public Sans native weight for '+text.fontName.style);text.fontName={family:'Public Sans',style};if(text.hasMissingFont)throw new Error('Public Sans native style is unavailable: '+style);normalized++;}return {normalizedFontAliases:normalized};`);
const wire=await evaluate(`
if(figma.root.getPluginData('truthful-design-kit')!==${JSON.stringify(marker)})throw new Error('Wrong design document.');
await figma.loadAllPagesAsync();const page=figma.root.children.find(p=>p.name==='Product flow');await figma.setCurrentPageAsync(page);
const specification=${JSON.stringify(spec.screens)};const frames=new Map(page.children.filter(n=>n.type==='FRAME').map(n=>[n.name,n]));let links=0;const notes=[];
for(let i=0;i<specification.length;i++){const s=specification[i],frame=frames.get(s.id);if(!frame)throw new Error('Missing frame '+s.id);frame.x=(i%3)*1540;frame.y=Math.floor(i/3)*1090;frame.setPluginData('truthful-screen',JSON.stringify({id:s.id,status:s.status,purpose:s.purpose,annotations:s.annotations}));for(const action of s.actions){const isNote=action.targetId===s.id;const destination=frames.get(isNote?'review-note:'+s.id+':'+action.label:action.targetId);if(!destination)throw new Error('Missing prototype destination');if(isNote){destination.x=4700+(notes.length%3)*600;destination.y=Math.floor(notes.length/3)*540;const close=destination.findOne(n=>n.name==='annotation-close');await close.setReactionsAsync([{trigger:{type:'ON_CLICK'},actions:[{type:'CLOSE'}]}]);notes.push({name:destination.name,nodeId:destination.id,width:destination.width,height:destination.height,textLayers:destination.findAll(n=>n.type==='TEXT').length});}const targets=frame.findAll(n=>n.name==='hotspot:'+action.label);if(!targets.length)throw new Error('Missing hotspot '+s.id+': '+action.label);for(const target of targets){await target.setReactionsAsync([{trigger:{type:'ON_CLICK'},actions:[{type:'NODE',destinationId:destination.id,navigation:isNote||action.navigation==='overlay'?'OVERLAY':'NAVIGATE',transition:{type:'DISSOLVE',easing:{type:'EASE_OUT'},duration:0.15},preserveScrollPosition:false}]}]);target.setPluginData('interaction-note',action.note||'Review-state navigation. This prototype executes no financial command.');}links++;}}
const navigationOverlays=[];for(const menu of ${JSON.stringify(spec.overlays||[])}){const root=frames.get(menu.id);root.x=6500;root.y=4300;for(const action of menu.actions){const control=root.findOne(n=>n.name==='hotspot:'+action.label),target=frames.get(action.targetId);if(!control||!target)throw new Error('Missing mobile menu destination');await control.setReactionsAsync([{trigger:{type:'ON_CLICK'},actions:[{type:'NODE',navigation:'NAVIGATE',destinationId:target.id,transition:{type:'DISSOLVE',easing:{type:'EASE_OUT'},duration:0.15},preserveScrollPosition:false}]}]);links++;}await root.findOne(n=>n.name==='annotation-close').setReactionsAsync([{trigger:{type:'ON_CLICK'},actions:[{type:'CLOSE'}]}]);navigationOverlays.push({name:root.name,nodeId:root.id,width:root.width,height:root.height,textLayers:root.findAll(n=>n.type==='TEXT').length});}
page.flowStartingPoints=[['evidence-input','Evidence to verified local effect'],['race-cutoff','Adverse state · bounded cutoff'],['race-repair','Authored repair · separate model'],['connected-handoff-concept','Concept · selected-case handoff'],['mobile-approval','Mobile review']].map(([id,name])=>({nodeId:frames.get(id).id,name}));
const readme=figma.root.children.find(p=>p.name==='Read me');for(let i=0;i<readme.children.length;i++){readme.children[i].x=(i%2)*1540;readme.children[i].y=Math.floor(i/2)*1060;}
await figma.setCurrentPageAsync(readme);figma.viewport.scrollAndZoomIntoView([readme.children[0]]);return {links,overlays:notes,navigationOverlays,frames:specification.map(s=>({id:s.id,nodeId:frames.get(s.id).id,width:frames.get(s.id).width,height:frames.get(s.id).height,textLayers:frames.get(s.id).findAll(n=>n.type==='TEXT').length}))};`);
const record={schemaVersion:1,status:'created-native-pending-visual-review',fileUrl:url,fileKey,targetBinding,createdAt:new Date().toISOString(),method:'figma-cli plugin mode',...wire};
await writeFile('design/figma/native-record.json',JSON.stringify(record,null,2)+'\n');
console.log(`Created ${wire.frames.length} native screen frames and ${wire.links} mapped review links. Export and inspect native frames before claiming the Figma build verified.`);
