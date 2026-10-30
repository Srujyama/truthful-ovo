import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateSystem} from './verify-figma-system.mjs';

function fixture(){
 const sets=['Button','Status'].map(role=>({id:role,role,name:`Truthful / ${role}`,variants:(role==='Button'?['Primary','Secondary'].flatMap(Style=>['Default','Hover','Disabled'].map(State=>({Style,State}))):['Approved','Unsafe effect','Inconclusive','Needs approval','Consumed once','Stale approval'].map(State=>({State}))).map((properties,i)=>({id:role+i,properties,sourceName:role+i,labelProperty:role==='Button'?'Label#1':null}))}));
 const frames=Array.from({length:17},(_,i)=>({id:'screen'+i,nodeId:'screen'+i}));
 const instances=frames.map(f=>({id:'instance'+f.id,rootId:f.nodeId,componentId:'Button0'}));
 const variables=['space/0','space/4','space/8','space/12','space/16','space/20','space/24','space/32','radius/4','radius/6','radius/10'].map(name=>({id:name,name,value:Number(name.split('/')[1])}));
 const textStyles=Array.from({length:5},(_,i)=>({id:'style'+i,name:'style'+i,size:12+i}));
 const handoff={pageId:'handoff',frames:[1,2,3].map(id=>({id:'handoff'+id}))};
 const proofs={labelOverride:{passed:true},masterPropagation:{passed:true,before:6,observed:7},buttonResize:{passed:true},portfolioResize:{passed:true,width:1280,nestedClipCount:0,missingFonts:0},mobileResize:{passed:true,width:430,nestedClipCount:0,missingFonts:0},inheritedStyleSwap:{passed:true,swaps:[{passed:true},{passed:true}]},statusVariantSwap:{passed:true}};
 for(const name of ['masterPropagation','inheritedStyleSwap','statusVariantSwap'])proofs[name].sourceInstanceId=instances[0].id;
 Object.assign(proofs.statusVariantSwap,{beforeState:'Needs approval',targetState:'Approved',observed:'Approved'});
 const manifest={status:'verified-native-system',fileKey:'target',sets,instances,textStyles,numberVariables:variables,handoff,proofs};
 const record={status:'verified-native',fileKey:'target',frames};
 const live={marker:'truthful-ovo-design-v1:target',sets:sets.map(s=>({...s,type:'COMPONENT_SET',page:'Design system',children:s.variants.map(v=>({...v,type:'COMPONENT',fillSignature:v.properties.State==='Hover'?'hover':'default',definitions:v.labelProperty?{[v.labelProperty]:{type:'TEXT'}}:{},labelReference:v.labelProperty}))})),instances:instances.map(i=>({...i,type:'INSTANCE',properties:{'Label#1':{value:'Review'}},label:'Review'})),screens:frames.map(f=>({id:f.nodeId,textCount:10,styledCount:10,missingFonts:0,clipping:[],instanceIds:['instance'+f.id],spatialBindings:20,colorBoundNodes:10})),textStyles:textStyles.map(s=>({...s,family:'Public Sans'})),numberVariables:variables.map(v=>({...v,type:'FLOAT',collection:'Truthful · Layout'})),spatialBindings:200,colorBoundNodes:100,handoff:{type:'PAGE',name:'Handoff',frames:handoff.frames.map(f=>({...f,type:'FRAME',textLayers:3})),instances:3},libraryGuide:{type:'FRAME',textLayers:3},probePages:[]};
 return {manifest,record,live};
}
test('accepts native instances, coverage and explicit scoped proofs',()=>{const {manifest,record,live}=fixture();assert.equal(validateSystem(manifest,record,live).screens,17);});
const corruptions={
 'pending review cannot masquerade as verified':f=>f.manifest.status='native-system-pending-review',
 'wrong connected file marker':f=>f.live.marker='another file',
 'frame copies cannot masquerade as variant sets':f=>f.live.sets[0].type='FRAME',
 'duplicate Button catalog without Status':f=>{f.manifest.sets[1]=structuredClone(f.manifest.sets[0]);f.live.sets[1]=structuredClone(f.live.sets[0]);},
 'indistinguishable authored hover':f=>f.live.sets[0].children[1].fillSignature=f.live.sets[0].children[0].fillSignature,
 'missing variant combination':f=>f.manifest.sets[0].variants.pop(),
 'Label unbound from its component property':f=>f.live.sets[0].children[0].labelReference=null,
 'contradictory Status label override':f=>f.live.sets[1].children[0].labelReference='Label#bad',
 'detached instance':f=>f.live.instances[0].type='FRAME',
 'instance linked to wrong main component':f=>f.live.instances[0].componentId='Button1',
 'screen with no inherited controls':f=>f.live.screens[0].instanceIds=[],
 'screen silently losing typography styles':f=>f.live.screens[0].styledCount=0,
 'spatial token value drift':f=>f.live.numberVariables[1].value=5,
 'library bindings cannot hide unbound screens':f=>f.live.screens[0].spatialBindings=0,
 'library colors cannot hide unbound screens':f=>f.live.screens[0].colorBoundNodes=0,
 'nested clipping despite passed flag':f=>f.manifest.proofs.mobileResize.nestedClipCount=1,
 'unreviewed instance variant swapping':f=>f.manifest.proofs.inheritedStyleSwap.swaps[1].passed=false,
 'fresh specimen standing in for migrated instance proof':f=>f.manifest.proofs.masterPropagation.sourceInstanceId='synthetic',
 'no-op status swap':f=>f.manifest.proofs.statusVariantSwap.beforeState='Approved',
 'missing native handoff':f=>f.live.handoff=null,
 'temporary proof page left behind':f=>f.live.probePages=['probe'],
 'approved screen clips content':f=>f.live.screens[0].clipping.push({text:'text',ancestor:'frame'})
};
for(const [name,mutate]of Object.entries(corruptions))test('rejects '+name,()=>{const f=fixture();mutate(f);assert.throws(()=>validateSystem(f.manifest,f.record,f.live));});
