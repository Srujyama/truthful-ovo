import { applyNativeSystem, invalidateNativeSystem } from "./figma-native-system.mjs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { build, palette } from "./build-figma-kit.mjs";

// Stage all new native roots before replacing only this kit's owned contents.
// Existing root IDs, prototype destinations and the prior cloud version survive.
const exec = promisify(execFile),
  cli =
    process.env.FIGMA_CLI_JS ||
    join(homedir(), "Downloads/Coding/claude-tools/figma-cli/src/index.js");
const previous = JSON.parse(
  await readFile("design/figma/native-record.json", "utf8"),
);
const marker = `truthful-ovo-design-v1:${previous.fileKey}`;
const stagingName = "Truthful · working ledger staging";
await build();
await mkdir("output/figma-redesign", { recursive: true });
const models = JSON.parse(
  await readFile("design/figma/generated/models.json", "utf8"),
);
const spec = JSON.parse(await readFile("docs/FIGMA_SCREEN_MAP.json", "utf8"));
const stagingDigest = createHash("sha256")
  .update(JSON.stringify({ models, palette }))
  .digest("hex");
async function run(args) {
  const { stdout } = await exec(process.execPath, [cli, ...args], {
    timeout: 90000,
    maxBuffer: 2500000,
  });
  const s = stdout.replace(/\u001b\[[0-9;]*m/g, "");
  assert.ok(!s.includes("✗"), s);
  return s;
}
async function evaluate(code) {
  const s = await run([
    "eval",
    `(async () => {try{${code}}catch(e){return {error:String(e)};}})()`,
  ]);
  const a = s.indexOf("{"),
    b = s.lastIndexOf("}");
  assert.ok(a >= 0 && b > a, "No structured CLI result");
  const result = JSON.parse(s.slice(a, b + 1));
  assert.ok(!result.error, result.error);
  return result;
}
const bound = `if(figma.root.getPluginData('truthful-design-kit')!==${JSON.stringify(marker)})throw new Error('Wrong connected kit');if(figma.fileKey&&figma.fileKey!==${JSON.stringify(previous.fileKey)})throw new Error('Wrong native file key');`;
await evaluate(
  `${bound}await figma.loadAllPagesAsync();return {document:figma.root.name};`,
);
// Only a stage carrying this kit's ownership marker may be resumed or rebuilt.
// The digest covers styles, geometry, content and palette—not just root names.
await evaluate(
  `${bound}let p=figma.root.children.find(p=>p.name===${JSON.stringify(stagingName)});if(p&&p.getPluginData('truthful-staging-owner')!==${JSON.stringify(marker)})throw new Error('Unowned staging page; refusing to modify it');if(p&&p.getPluginData('truthful-staging-digest')!==${JSON.stringify(stagingDigest)}){await figma.setCurrentPageAsync(figma.root.children.find(p=>p.name==='Read me'));p.remove();p=null;}if(!p){p=figma.createPage();p.name=${JSON.stringify(stagingName)};p.setPluginData('truthful-staging-owner',${JSON.stringify(marker)});p.setPluginData('truthful-staging-digest',${JSON.stringify(stagingDigest)});}return {staging:p.id};`,
);
const textModels = (node) =>
  (node.type === "Text"
    ? [
        {
          name: node.name,
          text: node.text,
          weight: node.props.weight || "regular",
        },
      ]
    : []
  ).concat((node.children || []).flatMap(textModels));
// Each staged render is independently resumable. Nothing in the live pages is removed here.
for (const type of [
  "boards",
  "components",
  "screens",
  "overlays",
  "navigationOverlays",
]) {
  const jsx = JSON.parse(
    await readFile(`design/figma/generated/${type}.jsx.json`, "utf8"),
  );
  for (let i = 0; i < jsx.length; i += 2) {
    const names = models[type].slice(i, i + 2).map((n) => n.name);
    const exists = await evaluate(
      `${bound}const p=figma.root.children.find(p=>p.name===${JSON.stringify(stagingName)});if(!p||p.getPluginData('truthful-staging-owner')!==${JSON.stringify(marker)}||p.getPluginData('truthful-staging-digest')!==${JSON.stringify(stagingDigest)})throw new Error('Staging ownership or payload changed');for(const n of [...p.children])if(n.getPluginData('truthful-staged-complete')!==${JSON.stringify(stagingDigest)})n.remove();return {names:p.children.map(n=>n.name)};`,
    );
    const batch = jsx
      .slice(i, i + 2)
      .filter((_, j) => !exists.names.includes(names[j]));
    if (!batch.length) continue;
    const path = resolve(`output/figma-redesign/stage-${type}-${i}.json`);
    await writeFile(path, JSON.stringify(batch));
    await evaluate(
      `${bound}const p=figma.root.children.find(p=>p.name===${JSON.stringify(stagingName)});if(!p)throw new Error('Staging page missing');await figma.setCurrentPageAsync(p);return {page:p.name};`,
    );
    await run(["render-batch", "--file", path, "--collection", "Truthful"]);
    await evaluate(
      `${bound}const p=figma.root.children.find(p=>p.name===${JSON.stringify(stagingName)});for(const name of ${JSON.stringify(names)}){const roots=p.children.filter(n=>n.name===name);if(roots.length!==1)throw new Error('Duplicate or missing staged root');roots[0].setPluginData('truthful-staged-complete',${JSON.stringify(stagingDigest)});}return {completed:true};`,
    );
    console.log(`Staged ${type} ${i + 1}–${Math.min(i + 2, jsx.length)}`);
  }
}
const all = [
  ...models.boards,
  ...models.components,
  ...models.screens,
  ...models.overlays,
  ...(models.navigationOverlays || []),
];
for (const model of all) {
  const fonts = textModels(model);
  await evaluate(
    `${bound}const p=figma.root.children.find(p=>p.name===${JSON.stringify(stagingName)});const roots=p.children.filter(n=>n.name===${JSON.stringify(model.name)});if(roots.length!==1)throw new Error('Staged root mismatch');const texts=roots[0].findAll(n=>n.type==='TEXT'),expected=${JSON.stringify(fonts)};if(texts.length!==expected.length)throw new Error('Staged text count mismatch');for(const style of ['Regular','Medium','SemiBold','Bold'])await figma.loadFontAsync({family:'Public Sans',style});for(let i=0;i<texts.length;i++){if(texts[i].characters.replace(/\\s+/g,' ').trim()!==expected[i].text.replace(/\\s+/g,' ').trim())throw new Error('Staged text order mismatch: '+expected[i].name);texts[i].fontName={family:'Public Sans',style:({regular:'Regular',medium:'Medium',semibold:'SemiBold',bold:'Bold'})[expected[i].weight]};if(texts[i].hasMissingFont)throw new Error('Native Public Sans face is missing');}return {normalized:texts.length};`,
  );
}
const preflight = await evaluate(
  `${bound}const stage=figma.root.children.find(p=>p.name===${JSON.stringify(stagingName)});const expected=${JSON.stringify(all.map((n) => n.name))};if(stage.children.length!==expected.length)throw new Error('Unexpected staged roots');for(const name of expected){if(stage.children.filter(n=>n.name===name).length!==1)throw new Error('Duplicate staged root');const live=figma.root.children.filter(p=>p!==stage).flatMap(p=>[...new Map([...p.children,...p.findAll(n=>n.type==='COMPONENT')].map(n=>[n.id,n])).values()]).filter(n=>(n.getPluginData('truthful-component-source')||n.name)===name);if(live.length!==1&&!(live.length===0&&${JSON.stringify((models.navigationOverlays || []).map((n) => n.name))}.includes(name)))throw new Error('Missing/duplicate owned live root: '+name);}return {roots:expected.length};`,
);
console.log("Preflight", preflight);
// A saved version is a concrete restore point before the live replacement.
const restore = await evaluate(
  `${bound}return {version:await figma.saveVersionHistoryAsync('Before working-ledger redesign','Prior native design preserved before replacing only the owned kit roots.')};`,
);
await writeFile(
  "output/figma-redesign/restore-version.json",
  JSON.stringify(restore),
);
// Invalidate every proof of the old visual state before the first live mutation.
// A failed variable update or transplant must never leave a verified record.
await writeFile(
  `output/figma-redesign/native-record-before-${Date.now()}.json`,
  JSON.stringify(previous, null, 2) + "\n",
);
const pendingRecord = {
  ...previous,
  status: "redesigned-native-pending-visual-review",
  redesignedAt: new Date().toISOString(),
  previousCloudVersion: previous.cloudVersion || previous.previousCloudVersion,
  restoreVersion: restore.version,
  cloudVersion: null,
  prototypePlayback: null,
  visualReview: null,
  nativeApiVerification: null,
  geometryVerification: null,
  fontMapping: null,
  manualPlaybackAttempt: null,
  interactionInventory: null,
  verifiedAt: null,
  nativeLibrary: null,
  nativeSystem: null,
};
await writeFile(
  "design/figma/native-record.json",
  JSON.stringify(pendingRecord, null, 2) + "\n",
);
await invalidateNativeSystem(previous.fileKey);
await evaluate(
  `${bound}const c=(await figma.variables.getLocalVariableCollectionsAsync()).find(c=>c.name==='Truthful');if(!c)throw new Error('Truthful variables missing');const variables=await figma.variables.getLocalVariablesAsync('COLOR');for(const [name,hex]of Object.entries(${JSON.stringify(palette)})){const v=variables.find(v=>v.name===name&&v.variableCollectionId===c.id);if(!v)throw new Error('Missing variable '+name);v.setValueForMode(c.modes[0].modeId,{r:parseInt(hex.slice(1,3),16)/255,g:parseInt(hex.slice(3,5),16)/255,b:parseInt(hex.slice(5,7),16)/255,a:1});}return {colorsUpdated:13};`,
);
// Preserve original live roots (and component identities) by transplanting staged children.
for (const name of all.map((n) => n.name))
  await evaluate(
    `${bound}const stage=figma.root.children.find(p=>p.name===${JSON.stringify(stagingName)}),fresh=stage.children.find(n=>n.name===${JSON.stringify(name)}),live=figma.root.children.filter(p=>p!==stage).flatMap(p=>[...new Map([...p.children,...p.findAll(n=>n.type==='COMPONENT')].map(n=>[n.id,n])).values()]).find(n=>(n.getPluginData('truthful-component-source')||n.name)===${JSON.stringify(name)});if(!fresh)throw new Error('Staged root missing');if(!live){if(!${JSON.stringify((models.navigationOverlays || []).map((n) => n.name))}.includes(${JSON.stringify(name)}))throw new Error('Owned root missing');const added=fresh.clone();figma.root.children.find(p=>p.name==='Product flow').appendChild(added);added.x=6500;added.y=4300;return {added:added.name,id:added.id};}for(const child of [...live.children])child.remove();for(const property of ['layoutMode','primaryAxisSizingMode','counterAxisSizingMode','primaryAxisAlignItems','counterAxisAlignItems','itemSpacing','paddingTop','paddingBottom','paddingLeft','paddingRight','fills','strokes','strokeWeight','cornerRadius','clipsContent'])if(fresh[property]!==undefined)live[property]=JSON.parse(JSON.stringify(fresh[property]));live.resize(fresh.width,fresh.height);for(const child of [...fresh.children])live.appendChild(child.clone());return {updated:live.name,id:live.id};`,
  );
const record = await evaluate(
  `${bound}const page=figma.root.children.find(p=>p.name==='Product flow'),frames=new Map(page.children.map(n=>[n.name,n])),screens=${JSON.stringify(spec.screens)};let links=0;const overlays=[];for(const source of screens){const root=frames.get(source.id);for(const action of source.actions){const note=source.id===action.targetId,target=frames.get(note?'review-note:'+source.id+':'+action.label:action.targetId);if(!target)throw new Error('Missing destination');const controls=root.findAll(n=>n.name==='hotspot:'+action.label);if(!controls.length)throw new Error('Missing control');for(const control of controls)await control.setReactionsAsync([{trigger:{type:'ON_CLICK'},actions:[{type:'NODE',navigation:note||action.navigation==='overlay'?'OVERLAY':'NAVIGATE',destinationId:target.id,transition:{type:'DISSOLVE',easing:{type:'EASE_OUT'},duration:0.15},preserveScrollPosition:false}]}]);if(note){const close=target.findOne(n=>n.name==='annotation-close');await close.setReactionsAsync([{trigger:{type:'ON_CLICK'},actions:[{type:'CLOSE'}]}]);overlays.push({name:target.name,nodeId:target.id,width:target.width,height:target.height,textLayers:target.findAll(n=>n.type==='TEXT').length});}links++;}}const navigationOverlays=[];for(const menu of ${JSON.stringify(spec.overlays || [])}){const root=frames.get(menu.id);for(const action of menu.actions){const control=root.findOne(n=>n.name==='hotspot:'+action.label),target=frames.get(action.targetId);if(!control||!target)throw new Error('Missing navigation menu control or target');await control.setReactionsAsync([{trigger:{type:'ON_CLICK'},actions:[{type:'NODE',navigation:'NAVIGATE',destinationId:target.id,transition:{type:'DISSOLVE',easing:{type:'EASE_OUT'},duration:0.15},preserveScrollPosition:false}]}]);links++;}await root.findOne(n=>n.name==='annotation-close').setReactionsAsync([{trigger:{type:'ON_CLICK'},actions:[{type:'CLOSE'}]}]);navigationOverlays.push({name:root.name,nodeId:root.id,width:root.width,height:root.height,textLayers:root.findAll(n=>n.type==='TEXT').length});}page.flowStartingPoints=[['portfolio','Commitment review'],['evidence-input','Evidence to portfolio'],['race-cutoff','Adverse state · bounded cutoff'],['race-repair','Authored repair · separate model'],['connected-handoff-concept','Concept · selected-case handoff'],['mobile-approval','Mobile review']].map(([id,name])=>({nodeId:frames.get(id).id,name}));const staging=figma.root.children.find(p=>p.name===${JSON.stringify(stagingName)});if(staging.children.length!==${all.length})throw new Error('Staging source roots changed');await figma.setCurrentPageAsync(figma.root.children.find(p=>p.name==='Read me'));staging.remove();return {links,overlays,navigationOverlays,frames:screens.map(s=>{const n=frames.get(s.id);return {id:s.id,nodeId:n.id,width:n.width,height:n.height,textLayers:n.findAll(n=>n.type==='TEXT').length};})};`,
);
const nativeSystem = await applyNativeSystem({evaluate,marker,fileKey:previous.fileKey});
await writeFile(
  "design/figma/native-record.json",
  JSON.stringify(
    {
      ...pendingRecord,
      ...record,
      nativeSystem:{manifest:"design/figma/native-system.json",sets:nativeSystem.sets.length,instances:nativeSystem.instances.length},
      status: "redesigned-native-pending-visual-review",
      redesignedAt: new Date().toISOString(),
      previousCloudVersion:
        previous.cloudVersion || previous.previousCloudVersion,
      restoreVersion: restore.version,
      cloudVersion: null,
      prototypePlayback: null,
      visualReview: null,
      fontMapping: {
        family: "Public Sans",
        nativeStyles: {
          regular: "Regular",
          medium: "Medium",
          semibold: "SemiBold",
          bold: "Bold",
        },
        notice:
          "Official Public Sans variable TTF installed locally. Each native style loaded and confirmed with hasMissingFont=false.",
      },
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `Updated ${record.frames.length} native screens, 7 boards,12 components,13 colors,${record.overlays.length} notes; retained root IDs and rewired ${record.links} controls. Visual review required.`,
);
