import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {homedir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

// Native component architecture is applied after scene construction. Source names
// remain stable metadata; Figma variant names expose actual editable properties.
// Figma's native component-set names sit above the exported node bounds.
// Reserve an explicit editor-label band; PNG export geometry cannot see it.
export function layoutNativeLibrary(guide,groups){
  let cursor=guide.y+guide.height+32;
  const layout=[];
  for(const {role,node,heading}of groups){
    heading.x=24;heading.y=cursor;
    node.x=0;node.y=heading.y+heading.height+96;
    layout.push({role,setId:node.id,headingId:heading.id,headingY:heading.y,setY:node.y,editorLabelClearance:96});
    cursor=node.y+node.height+56;
  }
  return {editorLabelClearance:96,groups:layout};
}

async function nativeSystemProgram(config,layoutLibrary){
  const marker=config.marker;
  if(figma.root.getPluginData('truthful-design-kit')!==marker)throw new Error('Wrong connected kit');
  if(figma.fileKey&&figma.fileKey!==config.fileKey)throw new Error('Wrong native file key');
  await figma.loadAllPagesAsync();
  const systemPage=figma.root.children.find(p=>p.name==='Design system');
  systemPage.backgrounds=[{type:'SOLID',color:{r:247/255,g:248/255,b:250/255}}];
  const flow=figma.root.children.find(p=>p.name==='Product flow');
  if(!systemPage||!flow)throw new Error('Required kit pages missing');
  for(const style of ['Regular','Medium','SemiBold','Bold'])await figma.loadFontAsync({family:'Public Sans',style});
  const ownedRootNames=new Set(config.rootNames);
  const sourceName=n=>n.getPluginData('truthful-component-source')||n.name;
  const allComponents=systemPage.findAll(n=>n.type==='COMPONENT');
  const variants=[];
  const selectedVariable=(await figma.variables.getLocalVariablesAsync('COLOR')).find(v=>v.name==='selected');
  const colorExceptions=[];
  for(const expected of config.components){
    const found=allComponents.filter(n=>sourceName(n)===expected);
    if(found.length!==1)throw new Error('Missing/duplicate source component '+expected);
    const node=found[0];node.setPluginData('truthful-component-source',expected);
    let role,properties;
    if(expected.startsWith('Truthful Button')){
      const match=expected.match(/kind=(Primary|Secondary), state=(Default|Hover|Disabled)/);
      if(!match)throw new Error('Unknown Button source name');
      role='Button';properties={Style:match[1],State:match[2]};
    }else{
      role='Status';properties={State:expected.slice('Truthful State / '.length)};
    }
    if(role==='Button'&&properties.State==='Hover'){
      if(properties.Style==='Primary'){
        node.fills=[{type:'SOLID',color:{r:18/255,g:81/255,b:58/255}}];
        colorExceptions.push({componentId:node.id,field:'fills',literal:'#12513a',reason:'Existing forest-hover treatment; 13-color shared collection retained.'});
      }else{
        if(!selectedVariable)throw new Error('Selected color variable missing');
        node.fills=[figma.variables.setBoundVariableForPaint({type:'SOLID',color:{r:237/255,g:245/255,b:240/255}},'color',selectedVariable)];
      }
    }
    node.name=Object.entries(properties).map(([k,v])=>`${k}=${v}`).join(', ');
    node.setPluginData('truthful-system-owner',marker);
    node.description=role==='Button'?'Use Style for emphasis and State for the authored control state. Change Label from component properties. Screen reactions are review navigation, never financial execution.':'A named financial or authorization state. Keep its text explicit; color alone establishes no approval or savings.';
    const label=node.findOne(n=>n.type==='TEXT'&&n.name==='Label');
    if(!label)throw new Error('Component Label missing');
    const propertyOwner=node.parent?.type==='COMPONENT_SET'?node.parent:node;
    const existing=Object.entries(propertyOwner.componentPropertyDefinitions).find(([key,value])=>key.split('#')[0]==='Label'&&value.type==='TEXT');
    const labelProperty=role==='Button'?(existing?.[0]||propertyOwner.addComponentProperty('Label','TEXT',label.characters)):null;
    const references={...(label.componentPropertyReferences||{})};if(labelProperty)references.characters=labelProperty;else delete references.characters;label.componentPropertyReferences=references;
    node.layoutMode='HORIZONTAL';node.primaryAxisAlignItems='CENTER';node.counterAxisAlignItems='CENTER';
    node.primaryAxisSizingMode='FIXED';node.counterAxisSizingMode='AUTO';
    node.paddingTop=role==='Button'?10:8;node.paddingBottom=role==='Button'?10:8;
    node.paddingLeft=role==='Button'?14:12;node.paddingRight=node.paddingLeft;
    node.itemSpacing=0;node.minHeight=role==='Button'?40:30;
    label.layoutSizingHorizontal='FILL';label.textAutoResize='HEIGHT';
    if(role==='Button')label.fontSize=12;
    variants.push({node,role,properties,labelProperty,sourceName:expected});
  }
  const sets=[];
  for(const role of ['Button','Status']){
    const list=variants.filter(v=>v.role===role);
    let set=systemPage.findOne(n=>n.type==='COMPONENT_SET'&&n.getPluginData('truthful-system-role')===role);
    if(!set){set=figma.combineAsVariants(list.map(v=>v.node),systemPage);}
    for(const variant of list)if(variant.node.parent!==set)set.appendChild(variant.node);
    if(set.children.length!==list.length)throw new Error('Unexpected members in owned set');
    set.name=`Truthful / ${role}`;set.setPluginData('truthful-system-owner',marker);set.setPluginData('truthful-system-role',role);
    set.description=role==='Button'?'Primary and secondary buttons. State variants are explicit design states; no automatic hover interaction is asserted. Override Label without detaching the instance.':'Explicit financial and authorization states. Select the actual state; preserve written labels and financial meaning.';
    set.layoutMode='NONE';set.x=0;set.y=role==='Button'?200:500;
    list.forEach((v,i)=>{v.node.x=(i%3)*260+24;v.node.y=Math.floor(i/3)*90+40;});
    set.resize(800,240);
    if(role==='Status')for(const [property,value]of Object.entries(set.componentPropertyDefinitions))if(value.type==='TEXT'&&property.split('#')[0]==='Label')set.deleteComponentProperty(property);
    for(const variant of list)variant.labelProperty=role==='Button'?variant.node.findOne(n=>n.type==='TEXT'&&n.name==='Label').componentPropertyReferences.characters:null;
    sets.push({id:set.id,name:set.name,role,variants:list.map(v=>({id:v.node.id,sourceName:v.sourceName,properties:v.properties,labelProperty:v.labelProperty}))});
  }
  const rootFrames=figma.root.children.filter(p=>p!==systemPage).flatMap(p=>p.children).filter(n=>ownedRootNames.has(n.name));
  if(rootFrames.length!==config.rootNames.length)throw new Error('Owned scene roots changed');
  const variantFor=(role,properties)=>variants.find(v=>v.role===role&&Object.entries(properties).every(([k,value])=>v.properties[k]===value));
  const instances=[];
  // Delete only an incomplete owned migration when its untouched source remains.
  for(const instance of figma.root.findAll(n=>n.type==='INSTANCE'&&n.getPluginData('truthful-system-owner')===marker&&n.getPluginData('truthful-migration-source'))){
    const source=await figma.getNodeByIdAsync(instance.getPluginData('truthful-migration-source'));
    if(source&&!source.removed&&source.type==='FRAME')instance.remove();
  }
  async function configure(instance,variant,original){
    const metadata=instance.getPluginDataKeys().map(key=>[key,instance.getPluginData(key)]);instance.resetOverrides();for(const [key,value]of metadata)instance.setPluginData(key,value);instance.name=original.name;
    const mainLabel=variant.node.findOne(n=>n.type==='TEXT'&&n.name==='Label');
    if(original.name==='annotation-close'){for(const field of ['fontName','fontSize','lineHeight','letterSpacing','fills'])original.text[field]=JSON.parse(JSON.stringify(mainLabel[field]));original.fills=JSON.parse(JSON.stringify(instance.fills));original.strokes=JSON.parse(JSON.stringify(instance.strokes));}
    if(variant.labelProperty&&original.text.characters!==mainLabel.characters)instance.setProperties({[variant.labelProperty]:original.text.characters});
    instance.resize(original.w,original.h);instance.minHeight=original.h;instance.counterAxisSizingMode='AUTO';
    if(instance.paddingLeft!==original.paddingLeft)instance.paddingLeft=original.paddingLeft;if(instance.paddingRight!==original.paddingRight)instance.paddingRight=original.paddingRight;
    if(JSON.stringify(instance.fills)!==JSON.stringify(original.fills))instance.fills=original.fills;
    if(JSON.stringify(instance.strokes)!==JSON.stringify(original.strokes))instance.strokes=original.strokes;
    const text=instance.findOne(n=>n.type==='TEXT');
    for(const field of ['fontName','fontSize','lineHeight','letterSpacing','fills'])if(JSON.stringify(text[field])!==JSON.stringify(original.text[field]))text[field]=original.text[field];
    text.layoutSizingHorizontal='FILL';text.textAutoResize='HEIGHT';
    await instance.setReactionsAsync(original.reactions);
  }
  function snapshot(old){const oldText=old.findOne(n=>n.type==='TEXT');return {name:old.name,w:old.width,h:old.height,x:old.x,y:old.y,layoutSizingHorizontal:old.layoutSizingHorizontal,layoutGrow:old.layoutGrow,layoutAlign:old.layoutAlign,paddingLeft:old.paddingLeft,paddingRight:old.paddingRight,fills:JSON.parse(JSON.stringify(old.fills)),strokes:JSON.parse(JSON.stringify(old.strokes)),text:{characters:oldText.characters,fontName:oldText.fontName,fontSize:oldText.fontSize,lineHeight:oldText.lineHeight,letterSpacing:oldText.letterSpacing,fills:JSON.parse(JSON.stringify(oldText.fills))},reactions:JSON.parse(JSON.stringify(old.reactions))};}

  for(const root of rootFrames){
    // A helper button is a single-label control, unlike a navigation row or tab.
    const candidates=root.findAll(n=>n.type==='FRAME'&&n.children.length===1&&n.children[0].type==='TEXT'&&(n.children[0].name==='Button label'||n.name==='annotation-close'||n.name.startsWith('Named state: ')));
    for(const old of candidates){
      const oldText=old.children[0],isState=old.name.startsWith('Named state: ');
      let variant;
      if(isState)variant=variantFor('Status',{State:oldText.characters});
      else{
        const paint=Array.isArray(old.fills)?old.fills.find(p=>p.type==='SOLID'):null;
        const dark=paint&&paint.color.g<.65&&paint.color.r<.4;
        variant=variantFor('Button',{Style:dark?'Primary':'Secondary',State:'Default'});
      }
      if(!variant)continue;
      const original=snapshot(old),parent=old.parent,index=parent.children.indexOf(old),instance=variant.node.createInstance();
      instance.setPluginData('truthful-system-owner',marker);instance.setPluginData('truthful-migration-source',old.id);instance.setPluginData('truthful-system-source',variant.sourceName);instance.setPluginData('truthful-screen-root',root.id);
      try{
        parent.insertChild(index,instance);await configure(instance,variant,original);
        if(parent.layoutMode!=='NONE'){instance.layoutGrow=original.layoutGrow;instance.layoutAlign=original.layoutAlign;instance.layoutSizingHorizontal=original.layoutSizingHorizontal;}else{instance.x=original.x;instance.y=original.y;}
        old.remove();instance.setPluginData('truthful-migration-complete','true');
      }catch(error){if(!old.removed&&!instance.removed)instance.remove();throw error;}
    }
    for(const instance of root.findAll(n=>n.type==='INSTANCE'&&n.getPluginData('truthful-system-owner')===marker)){
      const main=await instance.getMainComponentAsync();
      if(!main)throw new Error('Detached system instance');
      instance.setPluginData('truthful-system-source',sourceName(main));instance.setPluginData('truthful-screen-root',root.id);
      const variant=variants.find(v=>v.node.id===main.id),original=snapshot(instance);await configure(instance,variant,original);instance.layoutSizingHorizontal=original.layoutSizingHorizontal;instance.layoutGrow=original.layoutGrow;instance.layoutAlign=original.layoutAlign;
      instances.push({id:instance.id,componentId:main.id,rootId:root.id,sourceName:sourceName(main)});
    }
  }
  // Fill relationships are introduced only where the authored dimensions
  // already equal available space. This keeps the approved reference sizes.
  let fillRelationships=0;
  function fluid(node){
    if(!node.children||!('layoutMode'in node)||node.layoutMode==='NONE')return;
    const available=node.width-(node.paddingLeft||0)-(node.paddingRight||0);
    const children=node.children.filter(n=>n.visible&&'layoutSizingHorizontal'in n);
    if(node.layoutMode==='VERTICAL'){
      for(const child of children)if(Math.abs(child.width-available)<4.5){child.layoutSizingHorizontal='FILL';fillRelationships++;}
    }else if(node.layoutMode==='HORIZONTAL'&&children.length>1){
      const total=children.reduce((sum,n)=>sum+n.width,0)+(node.itemSpacing||0)*(children.length-1);
      if(Math.abs(total-available)<4.5){
        const widths=children.map(n=>n.width),same=Math.max(...widths)-Math.min(...widths)<.5;
        const chosen=same?children:[children.reduce((a,b)=>a.width>b.width?a:b)];
        for(const child of chosen){child.layoutSizingHorizontal='FILL';fillRelationships++;}
      }
    }
    for(const child of children)if(child.type!=='INSTANCE')fluid(child);
  }
  for(const root of rootFrames)fluid(root);
  const collectionName='Truthful · Layout';
  let collection=(await figma.variables.getLocalVariableCollectionsAsync()).find(c=>c.name===collectionName);
  if(!collection)collection=figma.variables.createVariableCollection(collectionName);
  const currentVars=await figma.variables.getLocalVariablesAsync('FLOAT');
  const numberVariables=[];
  for(const [prefix,values]of [['space',[0,4,8,12,16,20,24,32]],['radius',[4,6,10]]])for(const value of values){
    const name=`${prefix}/${value}`;
    let variable=currentVars.find(v=>v.variableCollectionId===collection.id&&v.name===name);
    if(!variable)variable=figma.variables.createVariable(name,collection,'FLOAT');
    variable.setValueForMode(collection.modes[0].modeId,value);
    variable.description=prefix==='space'?'Shared spacing in logical pixels; applied only where the existing authored value matches.':'Shared corner treatment in logical pixels.';
    numberVariables.push({id:variable.id,name,value});
  }
  let spatialBindings=0;
  const variableByName=new Map(numberVariables.map(v=>[v.name,v]));
  const ownNodes=[...rootFrames,...rootFrames.flatMap(n=>n.findAll()),...variants.map(v=>v.node),...variants.flatMap(v=>v.node.findAll())];
  for(const node of ownNodes){
    let ancestor=node,insideInstance=false;while(ancestor&&ancestor.type!=='PAGE'){if(ancestor.type==='INSTANCE'){insideInstance=true;break;}ancestor=ancestor.parent;}if(insideInstance)continue;
    if('layoutMode'in node&&node.layoutMode!=='NONE')for(const field of ['itemSpacing','paddingLeft','paddingRight','paddingTop','paddingBottom']){
      const variable=variableByName.get(`space/${node[field]}`);if(variable){node.setBoundVariable(field,await figma.variables.getVariableByIdAsync(variable.id));spatialBindings++;}
    }
    if('cornerRadius'in node&&typeof node.cornerRadius==='number'){
      const variable=variableByName.get(`radius/${node.cornerRadius}`);if(variable){node.setBoundVariable('cornerRadius',await figma.variables.getVariableByIdAsync(variable.id));spatialBindings++;}
    }
  }
  const textNodes=ownNodes.filter(n=>n.type==='TEXT'),groups=new Map();
  for(const text of textNodes){
    if(text.fontName===figma.mixed||text.fontSize===figma.mixed)throw new Error('Unexpected mixed native text');
    const key=JSON.stringify({size:text.fontSize,style:text.fontName.style,line:text.lineHeight,tracking:text.letterSpacing,case:text.textCase,decoration:text.textDecoration});
    if(!groups.has(key))groups.set(key,[]);groups.get(key).push(text);
  }
  const localStyles=await figma.getLocalTextStylesAsync(),textStyles=[];
  for(const [key,texts]of groups){
    if(texts.length<3)continue;
    const sample=texts[0],role=sample.fontSize>=32?'Display':sample.fontSize>=24?'Heading':sample.fontSize>=17?'Title':sample.fontSize>=13?'Body':'Label';
    const name=`Truthful / ${role} / ${sample.fontSize} ${sample.fontName.style}`;
    let style=localStyles.find(s=>s.getPluginData('truthful-text-key')===key);
    if(!style)style=figma.createTextStyle();
    style.name=name;style.setPluginData('truthful-text-key',key);style.setPluginData('truthful-system-owner',marker);
    style.fontName={family:'Public Sans',style:sample.fontName.style};style.fontSize=sample.fontSize;style.lineHeight=sample.lineHeight;style.letterSpacing=sample.letterSpacing;style.textCase=sample.textCase;style.textDecoration=sample.textDecoration;
    style.description='Shared interface typography. Color remains a semantic bound paint, separate from this text style.';
    for(const text of texts)await text.setTextStyleIdAsync(style.id);
    textStyles.push({id:style.id,name:style.name,size:style.fontSize,fontStyle:style.fontName.style,usage:texts.length});
  }
  // Clone-only probes exercise editor operations and resize behavior, then leave
  // no temporary pages, instances, modified master values, or synthetic receipts.
  const probePage=figma.createPage();probePage.name='Truthful · native system probes';probePage.setPluginData('truthful-system-owner',marker);
  const proofs={};
  try{
    const variant=variantFor('Button',{Style:'Primary',State:'Default'}),actual=rootFrames.flatMap(r=>r.findAll(n=>n.type==='INSTANCE')).find(n=>n.getPluginData('truthful-system-source')===variant.sourceName),probe=actual.clone();probePage.appendChild(probe);
    const originalLabel=probe.findOne(n=>n.type==='TEXT').characters;
    const swaps=[];
    for(const properties of [{Style:'Secondary',State:'Default'},{Style:'Primary',State:'Disabled'}]){
      probe.setProperties(properties);const main=await probe.getMainComponentAsync(),text=probe.findOne(n=>n.type==='TEXT'),expected=main.findOne(n=>n.type==='TEXT');
      swaps.push({properties,componentId:main.id,passed:JSON.stringify(text.fills)===JSON.stringify(expected.fills)&&JSON.stringify(probe.fills)===JSON.stringify(main.fills)&&JSON.stringify(text.fontName)===JSON.stringify(expected.fontName)&&text.fontSize===expected.fontSize&&text.characters===originalLabel});
    }
    proofs.inheritedStyleSwap={passed:swaps.every(s=>s.passed),sourceInstanceId:actual.id,swaps};probe.setProperties({Style:'Primary',State:'Default'});
    const statusActual=rootFrames.flatMap(r=>r.findAll(n=>n.type==='INSTANCE')).find(n=>n.getPluginData('truthful-system-source').startsWith('Truthful State'));
    const beforeState=statusActual.variantProperties.State,targetState=beforeState==='Approved'?'Inconclusive':'Approved';
    const statusProbe=statusActual.clone();probePage.appendChild(statusProbe);statusProbe.setProperties({State:targetState});
    proofs.statusVariantSwap={passed:statusProbe.findOne(n=>n.type==='TEXT').characters===targetState,sourceInstanceId:statusActual.id,beforeState,targetState,observed:statusProbe.findOne(n=>n.type==='TEXT').characters};
    proofs.inheritedStyleSwap.statusStateSwap=proofs.statusVariantSwap;proofs.inheritedStyleSwap.passed=proofs.inheritedStyleSwap.passed&&proofs.statusVariantSwap.passed;
    const labelValue='Review this exact action';probe.setProperties({[variant.labelProperty]:labelValue});
    proofs.labelOverride={passed:probe.findOne(n=>n.type==='TEXT').characters===labelValue,componentId:variant.node.id,property:variant.labelProperty};
    const originalRadius=variant.node.cornerRadius;
    const originalBound=variant.node.boundVariables.cornerRadius;
    try{
      variant.node.setBoundVariable('cornerRadius',null);variant.node.cornerRadius=originalRadius+1;
      const observed=probe.cornerRadius;
      proofs.masterPropagation={passed:observed===originalRadius+1,componentId:variant.node.id,property:'cornerRadius',sourceInstanceId:actual.id,before:originalRadius,observed};
    }finally{
      variant.node.cornerRadius=originalRadius;if(originalBound)variant.node.setBoundVariable('cornerRadius',await figma.variables.getVariableByIdAsync(originalBound.id));
    }
    probe.resize(164,40);probe.counterAxisSizingMode='AUTO';probe.minHeight=40;
    probe.setProperties({[variant.labelProperty]:'Review the exact action and supporting evidence'});
    const label=probe.findOne(n=>n.type==='TEXT');
    proofs.buttonResize={passed:label.x>=0&&label.y>=0&&label.x+label.width<=probe.width+.5&&label.y+label.height<=probe.height+.5,width:probe.width,height:probe.height,labelHeight:label.height};
    function outside(root){const clips=[];for(const text of root.findAll(n=>n.type==='TEXT')){const b=text.absoluteBoundingBox;let parent=text.parent;while(parent&&parent.type!=='PAGE'){if(parent===root||parent.clipsContent){const box=parent.absoluteBoundingBox;if(!b||!box||b.x<box.x-.5||b.y<box.y-.5||b.x+b.width>box.x+box.width+.5||b.y+b.height>box.y+box.height+.5)clips.push({name:text.name,ancestor:parent.name});}if(parent===root)break;parent=parent.parent;}}return clips;}
    for(const [name,width]of [['portfolio',1280],['mobile-approval',430]]){
      const source=rootFrames.find(n=>n.name===name),clone=source.clone();probePage.appendChild(clone);clone.resize(width,source.height);
      const clipped=outside(clone);proofs[name==='portfolio'?'portfolioResize':'mobileResize']={passed:clipped.length===0&&!clone.findAll(n=>n.type==='TEXT').some(n=>n.hasMissingFont),originalWidth:source.width,width,height:clone.height,nestedClipCount:clipped.length,clipping:clipped,missingFonts:clone.findAll(n=>n.type==='TEXT'&&n.hasMissingFont).length};
    }
  }finally{
    await figma.setCurrentPageAsync(systemPage);probePage.remove();
  }
  for(const [name,proof]of Object.entries(proofs))if(!proof.passed)throw new Error('Native system probe failed: '+name+' '+JSON.stringify(proof));
  let guide=systemPage.children.find(n=>n.name==='Library / Editing guide'&&n.getPluginData('truthful-system-owner')===marker);
  if(!guide){guide=figma.createFrame();systemPage.appendChild(guide);}
  for(const child of [...guide.children])child.remove();
  guide.name='Library / Editing guide';guide.setPluginData('truthful-system-owner',marker);guide.layoutMode='VERTICAL';guide.primaryAxisSizingMode='AUTO';guide.counterAxisSizingMode='FIXED';guide.itemSpacing=12;guide.paddingLeft=24;guide.paddingRight=24;guide.paddingTop=24;guide.paddingBottom=24;guide.resize(800,100);guide.x=0;guide.y=0;guide.fills=[{type:'SOLID',color:{r:1,g:1,b:1}}];
  for(const [characters,size,style]of [['Truthful component library',24,'SemiBold'],['For Buttons, set Style and State, then edit Label. For Status, choose State; its wording follows. Keep instances attached.',14,'Regular'],['Button states are authored variants. Prototype clicks belong to each review control; they execute no financial command.',12,'Regular']]){
    const text=figma.createText();text.fontName={family:'Public Sans',style};text.fontSize=size;text.characters=characters;guide.appendChild(text);text.layoutSizingHorizontal='FILL';text.textAutoResize='HEIGHT';text.fills=[{type:'SOLID',color:{r:32/255,g:37/255,b:43/255}}];text.name=characters=== 'Truthful component library'?'Library title':'Usage guidance';
  }
  guide.primaryAxisSizingMode='AUTO';
  const libraryLabels=[];
  for(const [name,characters,y]of [['Library / Button variant key','BUTTONS · columns Default / Hover / Disabled · rows Primary / Secondary',170],['Library / Status variant key','STATUS · explicit financial and authorization states',470]]){
    let text=systemPage.children.find(n=>n.name===name&&n.getPluginData('truthful-system-owner')===marker);if(!text){text=figma.createText();systemPage.appendChild(text);}text.name=name;text.setPluginData('truthful-system-owner',marker);text.fontName={family:'Public Sans',style:'SemiBold'};text.fontSize=12;text.characters=characters;text.textAutoResize='WIDTH_AND_HEIGHT';text.fills=[{type:'SOLID',color:{r:32/255,g:37/255,b:43/255}}];text.x=24;text.y=y;const style=textStyles.find(s=>s.size===12&&s.fontStyle==='SemiBold');if(style)await text.setTextStyleIdAsync(style.id);libraryLabels.push(text.id);
  }
  const libraryLayout=layoutLibrary(guide,sets.map(s=>({role:s.role,node:systemPage.findOne(n=>n.id===s.id),heading:systemPage.children.find(n=>libraryLabels.includes(n.id)&&n.name===`Library / ${s.role} variant key`)})));
  const handoff={pageId:null,frames:[]};
  if(config.handoff){
    let page=figma.root.children.find(p=>p.name==='Handoff'&&p.getPluginData('truthful-system-owner')===marker);
    if(!page){if(figma.root.children.some(p=>p.name==='Handoff'))throw new Error('Unowned Handoff page');page=figma.createPage();page.name='Handoff';page.setPluginData('truthful-system-owner',marker);}
    handoff.pageId=page.id;
    const colorVars=await figma.variables.getLocalVariablesAsync('COLOR');
    const ink=colorVars.find(v=>v.name==='ink'),paper=colorVars.find(v=>v.name==='paper');
    async function addText(parent,name,characters,size,weight){
      const text=figma.createText();text.name=name;text.fontName={family:'Public Sans',style:weight};text.fontSize=size;text.lineHeight={unit:'PERCENT',value:145};text.characters=characters;parent.appendChild(text);text.layoutSizingHorizontal='FILL';text.textAutoResize='HEIGHT';
      text.fills=[{type:'SOLID',color:{r:32/255,g:37/255,b:43/255}}];if(ink)text.fills=[figma.variables.setBoundVariableForPaint(text.fills[0],'color',ink)];
      const style=textStyles.find(s=>s.size===size&&s.fontStyle===weight);if(style)await text.setTextStyleIdAsync(style.id);return text;
    }
    async function frame(name,index){
      let root=page.children.find(n=>n.name===name&&n.getPluginData('truthful-system-owner')===marker);if(!root){root=figma.createFrame();page.appendChild(root);}for(const child of [...root.children])child.remove();
      root.name=name;root.setPluginData('truthful-system-owner',marker);root.layoutMode='VERTICAL';root.primaryAxisSizingMode='AUTO';root.counterAxisSizingMode='FIXED';root.itemSpacing=24;root.paddingLeft=40;root.paddingRight=40;root.paddingTop=40;root.paddingBottom=40;root.resize(800,200);root.x=index*860;root.y=0;root.fills=[{type:'SOLID',color:{r:1,g:1,b:1}}];if(paper)root.fills=[figma.variables.setBoundVariableForPaint(root.fills[0],'color',paper)];return root;
    }
    for(let index=0;index<config.handoff.frames.length;index++){
      const spec=config.handoff.frames[index],root=await frame(spec.name,index);
      await addText(root,'Frame title',spec.title,28,'SemiBold');
      for(const section of spec.sections){const group=figma.createFrame();group.name=section.heading;root.appendChild(group);group.layoutMode='VERTICAL';group.primaryAxisSizingMode='AUTO';group.counterAxisSizingMode='FIXED';group.layoutSizingHorizontal='FILL';group.itemSpacing=8;group.fills=[];await addText(group,'Section heading',section.heading,17,'SemiBold');await addText(group,'Instruction',section.body,14,'Regular');}
      if(index===0)for(const source of config.handoff.sources||[])await addText(root,'Source · '+source.title,source.title+' — '+source.url,12,'Regular');
      root.primaryAxisSizingMode='AUTO';
      handoff.frames.push({id:root.id,name:root.name,textLayers:root.findAll(n=>n.type==='TEXT').length});
    }
    const example=await frame('Handoff · Component properties',config.handoff.frames.length);
    await addText(example,'Frame title','Edit properties. Keep the instance connected.',28,'SemiBold');
    await addText(example,'Usage guidance','Select the example below. Edit Label, choose Style, then select an authored State. The main component controls shared treatment. These are library examples, with no financial action or prototype interaction.',14,'Regular');
    for(const [style,state,label]of [['Primary','Default','Review supporting evidence'],['Secondary','Default','Return to commitment'],['Primary','Disabled','Approval not yet available']]){
      const variant=variantFor('Button',{Style:style,State:state}),instance=variant.node.createInstance();example.appendChild(instance);instance.setProperties({[variant.labelProperty]:label});instance.name=`Example / ${style} / ${state}`;instance.resize(360,44);instance.counterAxisSizingMode='AUTO';instance.setPluginData('truthful-system-owner',marker);instance.setPluginData('truthful-screen-root',example.id);instances.push({id:instance.id,componentId:variant.node.id,rootId:example.id,sourceName:variant.sourceName,example:true});
    }
    await addText(example,'State guidance','Status variants describe financial or authorization facts. Choose the real named state and retain explicit wording; do not use color as a substitute for meaning.',14,'Regular');
    example.primaryAxisSizingMode='AUTO';
    handoff.frames.push({id:example.id,name:example.name,textLayers:example.findAll(n=>n.type==='TEXT').length});
  }
  const summary={colorBoundNodes:ownNodes.filter(n=>{const vars=n.boundVariables||{};return vars.fills||vars.strokes||Array.isArray(n.fills)&&n.fills.some(p=>p.boundVariables?.color)||Array.isArray(n.strokes)&&n.strokes.some(p=>p.boundVariables?.color);}).length,spatialBindings,styledTextNodes:textStyles.reduce((sum,s)=>sum+s.usage,0),fillRelationships};
  return {schemaVersion:1,status:'native-system-pending-review',fileKey:config.fileKey,sets,instances,textStyles,numberVariables,colorExceptions,bindingsSummary:summary,proofs,handoff,libraryGuideId:guide.id,libraryLabels,libraryLayout,notice:'Explicit variant states, linked instances and clone-only editing/resize proofs. Resize checks cover the recorded representative widths, not arbitrary responsive parity for every screen.'};
}

export async function invalidateNativeSystem(fileKey){
  await writeFile('design/figma/native-system.json',JSON.stringify({schemaVersion:1,status:'native-system-pending-review',fileKey,invalidatedAt:new Date().toISOString(),proofs:null},null,2)+'\n');
}

export async function applyNativeSystem({evaluate,marker,fileKey}){
  await invalidateNativeSystem(fileKey);
  const models=JSON.parse(await readFile('design/figma/generated/models.json','utf8'));
  const rootNames=[...models.screens,...models.boards,...models.overlays,...(models.navigationOverlays||[])].map(n=>n.name);
  let handoff=null;try{handoff=JSON.parse(await readFile('design/figma/handoff.json','utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
  const result=await evaluate(`return await (${nativeSystemProgram.toString()})(${JSON.stringify({marker,fileKey,rootNames,components:models.components.map(n=>n.name),handoff})},${layoutNativeLibrary.toString()});`);
  await writeFile('design/figma/native-system.json',JSON.stringify(result,null,2)+'\n');
  return result;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const cli=process.env.FIGMA_CLI_JS||join(homedir(),'Downloads/Coding/claude-tools/figma-cli/src/index.js'),exec=promisify(execFile);
  const evaluate=async code=>{const {stdout}=await exec(process.execPath,[cli,'eval',`(async () => {try{${code}}catch(e){return {error:String(e)};}})()`],{timeout:90000,maxBuffer:2500000});const s=stdout.replace(/\u001b\[[0-9;]*m/g,'');assert.ok(!s.includes('✗'),s);const result=JSON.parse(s.slice(s.indexOf('{'),s.lastIndexOf('}')+1));assert.ok(!result.error,result.error);return result;};
  const record=JSON.parse(await readFile('design/figma/native-record.json','utf8')),marker=`truthful-ovo-design-v1:${record.fileKey}`;
  await mkdir('output/figma-system',{recursive:true});
  const restore=await evaluate(`if(figma.root.getPluginData('truthful-design-kit')!==${JSON.stringify(marker)})throw new Error('Wrong kit');return {version:await figma.saveVersionHistoryAsync('Before Figma system architecture','Restore point before component, typography and spatial binding work.')};`);
  await writeFile(`output/figma-system/native-record-before-${Date.now()}.json`,JSON.stringify(record,null,2)+'\n');
  await writeFile('design/figma/native-record.json',JSON.stringify({...record,status:'native-system-pending-review',previousCloudVersion:record.cloudVersion||record.previousCloudVersion,restoreVersion:restore.version,cloudVersion:null,visualReview:null,prototypePlayback:null,nativeApiVerification:null,geometryVerification:null,fontMapping:null,manualPlaybackAttempt:null,interactionInventory:null,verifiedAt:null,nativeSystem:null},null,2)+'\n');
  await invalidateNativeSystem(record.fileKey);
  const result=await applyNativeSystem({evaluate,marker,fileKey:record.fileKey});
  const pending=JSON.parse(await readFile('design/figma/native-record.json','utf8'));
  await writeFile('design/figma/native-record.json',JSON.stringify({...pending,nativeSystem:{manifest:'design/figma/native-system.json',sets:result.sets.length,instances:result.instances.length}},null,2)+'\n');
  console.log(JSON.stringify({sets:result.sets.length,instances:result.instances.length,textStyles:result.textStyles.length,numberVariables:result.numberVariables.length,bindingsSummary:result.bindingsSummary,proofs:result.proofs},null,2));
}
