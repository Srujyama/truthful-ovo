import assert from 'node:assert/strict';

export function expectedRoots(models){
 return [['boards','Read me','FRAME'],['components','Design system','COMPONENT'],['screens','Product flow','FRAME'],['overlays','Product flow','FRAME'],['navigationOverlays','Product flow','FRAME']].flatMap(([group,page,type])=>(models[group]||[]).map(n=>({name:n.name,page,type})));
}

// Existing identities come from a reviewed record, never a current name match.
// Legacy board identities require an explicitly reviewed audit of this file.
export function bootstrapInventory({record,system,reviewedBoards}){
 if(record.rootInventory){assert.equal(record.rootInventory.fileKey,record.fileKey,'Root inventory belongs to another file');return record.rootInventory;}
 assert.equal(system.fileKey,record.fileKey,'Component inventory belongs to another file');
 assert.equal(system.status,'verified-native-system','Bootstrap requires the reviewed component system');
 assert.equal(reviewedBoards.fileKey,record.fileKey,'Board inventory belongs to another file');
 assert.equal(reviewedBoards.status,'reviewed-root-identities','Legacy board IDs require review');
 const roots=[
  ...record.frames.map(n=>({name:n.id,id:n.nodeId,page:'Product flow',type:'FRAME'})),
  ...(record.overlays||[]).map(n=>({name:n.name,id:n.nodeId,page:'Product flow',type:'FRAME'})),
  ...(record.navigationOverlays||[]).map(n=>({name:n.name,id:n.nodeId,page:'Product flow',type:'FRAME'})),
  ...system.sets.flatMap(s=>s.variants.map(n=>({name:n.sourceName,id:n.id,page:'Design system',type:'COMPONENT'}))),
  ...reviewedBoards.roots.map(n=>({...n,page:'Read me',type:'FRAME'})),
 ];
 assert.equal(new Set(roots.map(n=>n.name)).size,roots.length,'Duplicate reviewed root name');assert.equal(new Set(roots.map(n=>n.id)).size,roots.length,'Duplicate reviewed root ID');
 return {schemaVersion:1,fileKey:record.fileKey,roots};
}

export function validateRootInventory({expected,allowedNewNames,inventory,live,marker}){
 const known=new Map(inventory.roots.map(n=>[n.name,n]));
 assert.equal(known.size,inventory.roots.length,'Duplicate inventoried root name');assert.equal(new Set(inventory.roots.map(n=>n.id)).size,inventory.roots.length,'Duplicate inventoried root ID');
 const allowed=new Set(allowedNewNames),resolved=[];
 for(const wanted of expected){
  const matches=live.filter(n=>n.name===wanted.name),recorded=known.get(wanted.name);
  assert.ok(matches.length<=1,'Duplicate live root: '+wanted.name);
  if(recorded){
   assert.equal(matches.length,1,'Recorded root missing: '+wanted.name);
   const node=matches[0];assert.equal(node.id,recorded.id,'Recorded root ID replaced: '+wanted.name);assert.equal(node.type,wanted.type,'Recorded root type changed: '+wanted.name);assert.equal(node.page,wanted.page,'Recorded root page changed: '+wanted.name);
   if(recorded.ownerRequired)assert.ok(node.owner===marker&&node.sourceRoot===wanted.name,'Owned root marker changed: '+wanted.name);
   resolved.push({...wanted,id:node.id,...(recorded.ownerRequired?{ownerRequired:true}:{})});
  }else{
   assert.ok(allowed.has(wanted.name),'Unrecorded root is not an allowed new note: '+wanted.name);
   if(!matches.length)continue;
   const node=matches[0];assert.equal(node.type,wanted.type,'New root type mismatch');assert.equal(node.page,wanted.page,'New root page mismatch');assert.ok(node.owner===marker&&node.sourceRoot===wanted.name,'New root name collision or wrong owner: '+wanted.name);
   resolved.push({...wanted,id:node.id,ownerRequired:true});
  }
 }
 return {schemaVersion:1,fileKey:inventory.fileKey,roots:resolved};
}

// Executed inside the native plugin. This function is deliberately self-contained.
export async function snapshotRootCatalog(){
 await figma.loadAllPagesAsync();
 return {roots:figma.root.children.filter(p=>!p.getPluginData('truthful-staging-owner')).flatMap(p=>[...new Map([...p.children,...p.findAll(n=>n.type==='COMPONENT')].map(n=>[n.id,n])).values()].map(n=>({id:n.id,name:n.getPluginData('truthful-component-source')||n.name,type:n.type,page:p.name,owner:n.getPluginData('truthful-owned-root'),sourceRoot:n.getPluginData('truthful-source-root')})))};
}

export function validateExistingPushRecord(fileKey,record){
 assert.ok(record,'Existing marked target has no matching local record. Recover its trusted root inventory or use the guarded updater for a reviewed target.');
 assert.equal(record.fileKey,fileKey,'Existing-target recovery required: local record belongs to another Figma file. No mutation was made.');
 assert.ok(record.rootInventory,'Existing-target recovery required: no trusted root inventory. Use the guarded updater to bootstrap reviewed identities.');
 assert.equal(record.rootInventory.fileKey,fileKey,'Existing-target recovery required: root inventory belongs to another Figma file. No mutation was made.');
 return record;
}
