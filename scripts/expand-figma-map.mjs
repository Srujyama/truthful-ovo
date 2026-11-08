import {readFile,writeFile} from 'node:fs/promises';
import {expansionScreens,expansionBoards,expansionNavigation} from './figma-expansion-catalog.mjs';
const path='docs/FIGMA_SCREEN_MAP.json',spec=JSON.parse(await readFile(path,'utf8'));
const merge=(existing,added)=>[...existing.filter(s=>!added.some(a=>a.id===s.id)),...added];
spec.screens=merge(spec.screens,expansionScreens);spec.sections=merge(spec.sections,expansionBoards);spec.overlays=merge(spec.overlays||[],[expansionNavigation]);
for(const screen of spec.screens.filter(screen=>!screen.scene&&screen.viewport.width>=600))if(!screen.actions.some(action=>action.label==='Operations'))screen.actions.push({label:'Operations',targetId:'operations-queue'});
const legacyMenu=spec.overlays.find(overlay=>overlay.id==='mobile-navigation');if(legacyMenu&&!legacyMenu.actions.some(action=>action.label==='Operations')){legacyMenu.actions.unshift({label:'Operations',targetId:'operations-queue'});legacyMenu.viewport.height=400;}
spec.sourceVersion='v4 expanded finance workspace';
await writeFile(path,JSON.stringify(spec,null,2)+'\n');
console.log(`${spec.screens.length} total screens; ${expansionScreens.length} new financial states; ${spec.sections.length} boards.`);
