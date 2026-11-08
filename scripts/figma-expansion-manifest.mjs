import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {expectedRoots} from './figma-root-inventory.mjs';

const normalize=value=>value&&typeof value==='object'?Array.isArray(value)?value.map(normalize):Object.fromEntries(Object.keys(value).sort().map(k=>[k,normalize(value[k])])):value;
const canonical=value=>JSON.stringify(normalize(value));
export const expansionDigest=value=>createHash('sha256').update(canonical(value)).digest('hex');
const ordered=roots=>roots.map(root=>({...root})).sort((a,b)=>a.name.localeCompare(b.name));
const descriptor=root=>({name:root.name,page:root.page,type:root.type});

function checkModels(models,expected){
 const derived=expectedRoots(models);
 assert.deepEqual(ordered(expected).map(descriptor),ordered(derived).map(descriptor),'Expected roots disagree with exact model groups');
 assert.equal(new Set(expected.map(n=>n.name)).size,expected.length,'Duplicate expected root name');
 const all=['boards','components','screens','overlays','navigationOverlays'].flatMap(group=>models[group]||[]);
 assert.equal(new Set(all.map(n=>n.name)).size,all.length,'Duplicate model root name');
 return new Map(all.map(n=>[n.name,n]));
}
function checkInventory(record){
 assert.ok(record?.fileKey&&record.rootInventory,'Expansion requires a trusted root inventory');
 assert.equal(record.rootInventory.fileKey,record.fileKey,'Inventory belongs to another file');
 const roots=record.rootInventory.roots;
 assert.ok(Array.isArray(roots),'Missing inventoried roots');
 assert.equal(new Set(roots.map(n=>n.name)).size,roots.length,'Duplicate inventoried root name');
 assert.equal(new Set(roots.map(n=>n.id)).size,roots.length,'Duplicate inventoried root ID');
 for(const root of roots)assert.ok(root.name&&root.id&&root.page&&root.type,'Incomplete inventoried root identity');
 return ordered(roots);
}

/** A deterministic scope declaration for the current user-requested expansion,
 * not an operator attestation or independent proof of native file identity. */
export function createExpansionManifest({record,models,expected=expectedRoots(models)}){
 const baselineRoots=checkInventory(record),modelByName=checkModels(models,expected),byName=new Map(expected.map(n=>[n.name,n]));
 for(const root of baselineRoots)assert.deepEqual(descriptor(byName.get(root.name)||{}),descriptor(root),'Expansion must retain every original root name/page/type: '+root.name);
 const known=new Set(baselineRoots.map(n=>n.name));
 return {schemaVersion:1,kind:'truthful-append-only-design-expansion',fileKey:record.fileKey,
  baselineInventoryDigest:expansionDigest({schemaVersion:record.rootInventory.schemaVersion,fileKey:record.fileKey,roots:baselineRoots}),baselineRoots,
  modelsDigest:expansionDigest(models),newRoots:ordered(expected.filter(n=>!known.has(n.name))).map(n=>({...descriptor(n),modelDigest:expansionDigest(modelByName.get(n.name))}))};
}

export function validateExpansionManifest({manifest,record,models,expected=expectedRoots(models)}){
 const current=checkInventory(record),modelByName=checkModels(models,expected);
 assert.equal(manifest?.schemaVersion,1,'Unsupported expansion manifest');
 assert.equal(manifest.kind,'truthful-append-only-design-expansion','Unsupported expansion scope');
 assert.equal(manifest.fileKey,record.fileKey,'Expansion belongs to another file');
 assert.ok(Array.isArray(manifest.baselineRoots)&&Array.isArray(manifest.newRoots),'Expansion identities missing');
 const baseline=ordered(manifest.baselineRoots);
 assert.equal(new Set(baseline.map(n=>n.name)).size,baseline.length,'Duplicate baseline root name');
 assert.equal(new Set(baseline.map(n=>n.id)).size,baseline.length,'Duplicate baseline root ID');
 assert.equal(manifest.baselineInventoryDigest,expansionDigest({schemaVersion:record.rootInventory.schemaVersion,fileKey:record.fileKey,roots:baseline}),'Stale expansion baseline digest');
 assert.equal(manifest.modelsDigest,expansionDigest(models),'Expansion models changed');
 const currentByName=new Map(current.map(n=>[n.name,n])),wantedByName=new Map(expected.map(n=>[n.name,n]));
 for(const root of baseline){
  assert.deepEqual(currentByName.get(root.name),root,'Expansion baseline identity changed: '+root.name);
  assert.deepEqual(descriptor(wantedByName.get(root.name)||{}),descriptor(root),'Original root omitted or moved: '+root.name);
 }
 const baselineNames=new Set(baseline.map(n=>n.name));
 const additions=ordered(expected.filter(n=>!baselineNames.has(n.name))).map(n=>({...descriptor(n),modelDigest:expansionDigest(modelByName.get(n.name))}));
 assert.deepEqual(manifest.newRoots,additions,'Undeclared or changed expansion roots');
 const newByName=new Map(additions.map(n=>[n.name,n]));
 for(const root of current.filter(n=>!baselineNames.has(n.name))){
  assert.ok(newByName.has(root.name),'Inventory includes an undeclared expansion root: '+root.name);
  assert.deepEqual(descriptor(root),descriptor(newByName.get(root.name)),'Adopted expansion root moved');
  assert.equal(root.ownerRequired,true,'Adopted expansion root lost ownership requirement');
 }
 return additions.map(n=>n.name);
}
