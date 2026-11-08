import {readFile,writeFile} from 'node:fs/promises';
import {createExpansionManifest} from './figma-expansion-manifest.mjs';
const record=JSON.parse(await readFile('design/figma/native-record.json','utf8'));
const models=JSON.parse(await readFile('design/figma/generated/models.json','utf8'));
const manifest=createExpansionManifest({record,models});
await writeFile('design/figma/expansion-manifest.json',JSON.stringify(manifest,null,2)+'\n');
console.log(`Prepared an append-only migration for ${manifest.newRoots.length} exact new roots in ${manifest.fileKey}. No native mutation performed.`);
