import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {verifyAssurancePacket} from './verify-assurance-packet.mjs';
import {financialReport,reportCsv} from '../src/operations.mjs';
import {validateExpansionManifest} from './figma-expansion-manifest.mjs';
let packets=0;
for(const mode of ['server','browser']) {
 const report=JSON.parse(await readFile(`output/playwright/${mode}-workspace-report.json`,'utf8'));
 const resolution=JSON.parse(await readFile(`output/playwright/${mode}-workspace-resolution.json`,'utf8'));
 for(const packet of [report,resolution]){await verifyAssurancePacket(packet);assert.equal(packet.mode,mode);packets++;}
 const recomputed=financialReport(report.workspace,{asOf:report.view.asOf,knownAt:report.view.knownAt});
 assert.equal(await readFile(`output/playwright/${mode}-workspace-vendors.csv`,'utf8'),reportCsv(recomputed),'Downloaded CSV must equal the actual recorded projection, in exact cents.');
 assert.equal(report.view.totals.verifiedCents,90000);assert.equal(report.view.totals.recoverableCents,185000);
 const view=resolution.view,credit=view.credits.find(c=>c.id==='clarity-credit-shared');
 assert.equal(credit.amountCents,30000);assert.equal(credit.allocatedCents,10000);assert.equal(credit.unallocatedCents,20000);assert.equal(credit.quarantined,false);
 assert.deepEqual(credit.resolution.assignments,[{commitmentId:'clarity-a',limitCents:10000},{commitmentId:'clarity-b',limitCents:20000}]);
 assert.equal(view.commitments.find(c=>c.id==='clarity-a').outstandingCents,0);assert.equal(view.commitments.find(c=>c.id==='clarity-b').verifiedCents,0);
 const link=credit.resolution.sourceLinks[0];assert(view.sourceVersions.some(s=>s.id===link.sourceId&&s.revision===link.revision&&s.kind==='allocation_resolution'));
 assert(resolution.workspace.events.some(e=>e.type==='SOURCE_ADDED'&&e.payload.source.id===link.sourceId&&e.actor.role==='analyst'));
 assert(resolution.workspace.events.some(e=>e.type==='CREDIT_RESOLVED'&&e.payload.creditId===credit.id&&e.actor.role==='approver'));
}
const models=JSON.parse(await readFile('design/figma/generated/models.json','utf8')),record=JSON.parse(await readFile('design/figma/native-record.json','utf8')),manifest=JSON.parse(await readFile('design/figma/expansion-manifest.json','utf8'));
assert.equal(validateExpansionManifest({manifest,record,models}).length,60);
const geometry=JSON.parse(await readFile('output/figma-expansion/final-integration-report.json','utf8'));
assert(geometry.passed);assert.equal(geometry.screenCount,models.screens.length);assert.equal(geometry.boardCount,models.boards.length);
for(const key of ['clipping','frameOverflow','missingContent','missingActions','fontFailures'])assert.equal(geometry[key].length,0,key);
let assertions=0;
for(const name of ['browser-server','browser-static','preserved-server','preserved-static','cap-server','cap-static']) {
 const output=await readFile(`output/workspace-${name}.log`,'utf8'),match=output.match(/### Result\s*\n(\{[^\n]+\})/);assert(match,`${name}: missing real browser result`);assert(!output.includes('### Error'));
 const result=JSON.parse(match[1]);assert.equal(result.passed,result.checks.length);assert(result.passed>0);assertions+=result.passed;
}
console.log(`VALID: ${assertions} rendered assertions, ${packets} independently replayed UI packets, exact financial CSVs, ${models.screens.length} rendered source screens and ${models.boards.length} boards. Native persistence remains a separate gate.`);
