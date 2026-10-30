import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {screenModels} from './figma-screen-models.mjs';
import {palette,toJSX} from './build-figma-kit.mjs';
const spec=JSON.parse(await readFile('docs/FIGMA_SCREEN_MAP.json','utf8'));
const saved=JSON.parse(await readFile('design/figma/generated/models.json','utf8'));
const screens=screenModels(spec),ids=new Set(spec.screens.map(s=>s.id));
assert.equal(ids.size,spec.screens.length);
assert.deepEqual(saved.screens,screens,'Regenerate the kit after changing screen models.');
let textCount=0,hotspots=0,navigationLinks=0,noteLinks=0,menuOpeners=0;
const targetIds=new Set([...ids,...(spec.overlays||[]).map(o=>o.id)]);
for(const [i,screen] of screens.entries()){
 const source=spec.screens[i];assert.equal(screen.name,source.id);assert.equal(screen.props.w,source.viewport.width);assert.equal(screen.props.h,source.viewport.height);
 const found=[];let text='';
 function walk(n){assert.ok(['Frame','Text','Rectangle','Line'].includes(n.type));assert.ok(n.name);if(n.type==='Text'){textCount++;assert.ok(n.props.size>=12,n.name+' is smaller than12px');assert.equal(n.props.font,'Public Sans');assert.ok(n.props.w);text+=' '+n.text;}if(n.name.startsWith('hotspot:'))found.push(n.name.slice(8));for(const [k,v]of Object.entries(n.props)){if(typeof v==='number')assert.ok(Number.isFinite(v));if(typeof v==='string'&&v.startsWith('var:'))assert.ok(palette[v.slice(4)],'Missing token '+v);}for(const c of n.children||[])walk(c);}
 walk(screen);
 for(const action of source.actions){assert.ok(targetIds.has(action.targetId));assert.ok(found.includes(action.label),source.id+' lacks hotspot '+action.label);hotspots++;if(action.targetId===source.id)noteLinks++;else if(action.navigation==='overlay')menuOpeners++;else navigationLinks++;}
 if(source.status==='concept')assert.match(text,/CONCEPT/);
 if(source.id.startsWith('authority-')||source.id==='execution-receipt'||source.id==='mobile-receipt')assert.match(text,/isolated|separate synthetic workspace/i);
 assert.doesNotMatch(text,/sk-proj-|-----BEGIN .*PRIVATE KEY|<Image/i);
 assert.match(toJSX(screen),/^<Frame /);
}
for(const [name,models]of [['screens',saved.screens],['boards',saved.boards],['components',saved.components],['overlays',saved.overlays],['navigationOverlays',saved.navigationOverlays]])assert.deepEqual(JSON.parse(await readFile(`design/figma/generated/${name}.jsx.json`,'utf8')),models.map(toJSX));
assert.equal(saved.overlays.length,noteLinks);assert.equal(saved.boards.length,spec.sections.length);assert.equal(saved.components.length,12);
assert.equal(saved.navigationOverlays.length,(spec.overlays||[]).length);
for(const overlay of spec.overlays||[]){const model=saved.navigationOverlays.find(n=>n.name===overlay.id);assert.ok(model);for(const action of overlay.actions){assert.ok(ids.has(action.targetId));assert.ok(JSON.stringify(model).includes('hotspot:'+action.label));}}
const preview=await readFile('design/figma/generated/preview.html','utf8');
for(const id of ids)assert.ok(preview.includes(`id="${id}"`));
assert.ok(preview.includes('prefers-reduced-motion'));assert.ok(preview.includes('focus-visible'));assert.ok(preview.includes('Concept'));
console.log(`PASS ${screens.length} editable screen models; ${textCount} readable text layers; ${hotspots} declared hotspots (${navigationLinks} screen navigation links; ${menuOpeners} mobile menu openers); ${saved.boards.length} product boards; ${saved.components.length} component specimens; ${Object.keys(palette).length} defined color tokens. Native Figma persistence is a separate check.`);
