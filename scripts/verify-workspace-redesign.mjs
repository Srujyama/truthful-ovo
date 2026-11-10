#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {verifyExportPacket} from '../server/service.mjs';
import {verifyPacketInput} from '../server/packets.mjs';
import {verifyCase,emailFor,digest} from '../src/recovery.mjs';
import {analyzeEvidence} from '../src/engine/index.mjs';
import {verifyAssurancePacket} from './verify-assurance-packet.mjs';
import {financialReport,reportCsv} from '../src/operations.mjs';

// These are outcomes of the actual browser journey, not a count of screenshots
// or a claim that compile success establishes interaction/visual quality.
const requiredChecks=[
 'Signed-out managed deep links show a sign-in gate and never mount protected archive reads',
 'Managed sign-out never silently becomes a fictional browser workspace',
 'Signed-in world uses the actual managed workspace name',
 'Fresh managed world starts with zero recorded balances',
 'Zoom reversal restores the same station anchor and camera framing',
 'A reversed normal-motion map drag returns the scene and DOM controls together',
 'Clicking the actual exchange building opens its real station inspector',
 'Cancelling a normal-motion drag releases the camera and avoids a stuck gesture',
 'Normal-motion scenery actually animates',
 'Pause freezes normal-motion scenery without changing records',
 'Camera and scenery controls produce no financial writes',
 ...['analyst','approver'].map(role=>`Admin creates an exact ${role} invitation through the real account UI`),
 ...['analyst','approver'].map(role=>`Invitation enrollment signs in the actual ${role} membership`),
 'Managed evidence archive is labeled as server-backed records',
 'Interrupted follow-up read retains the successfully saved analysis identity',
 'Recovering a saved analysis never creates a duplicate archive case',
 'Durable import preview leaves financial state unchanged',
 'Actual managed archive UI imports an exact source-backed promise without inventing applied credit',
 'World archive opens actual exact-revision evidence in the retained source library',
 'Analyst cannot approve their own saved claim draft',
 'Separate approver reviews the saved exact draft and downloads an unsent email through the UI',
 'A stale approval cannot silently export a different later draft',
 'Mobile world has no document-level horizontal overflow',
 'Mobile icon-only account keeps an accessible name and keyboard dismissal',
 'Office credits opens the complete credit list',
 'An actual recorded-event courier freezes mid-route while paused',
 'Resuming an actual recorded-event courier preserves its remaining route',
 'Execution building opens the exact approved financial action',
 'World and ledger navigation preserve the in-progress signed grant and its key',
 'Actual signed execution records one durable effect and accepts an identical retry',
 'Execution explorer records and independently replays a durable server run',
 'Workspace creation switches the world to a genuinely empty isolated ledger',
 'Switching workspaces restores only that workspace’s financial records',
 'Reduced-motion world remains still while every station remains operable',
 'All six stations have ordinary DOM controls on mobile and with reduced motion',
 'An unavailable exact action never substitutes another commitment or grants authority',
 'World, managed account, archive and claim journeys have no uncaught browser errors',
];
requiredChecks.push('Unsaved document input survives navigation to another workspace section','A permission and its private key survive navigation between workspace sections');
const root=new URL('../output/playwright/',import.meta.url);
const result=JSON.parse(await readFile(new URL('workspace-redesign-result.json',root),'utf8'));
assert(Array.isArray(result.checks)&&result.checks.every(item=>typeof item==='string'&&item.trim()),'Browser checks must contain named successful outcomes.');
assert(Number.isSafeInteger(result.passed)&&result.passed===result.checks.length&&result.passed>=requiredChecks.length,'The complete managed browser journey must finish every required check.');
assert.equal(new Set(result.checks).size,result.checks.length,'Repeated check names cannot inflate the completed check count.');
for(const label of requiredChecks)assert(result.checks.includes(label),`Required browser outcome missing: ${label}`);
if(Object.hasOwn(result,'errors'))assert.deepEqual(result.errors,[],'The browser journey reported errors.');
if(Object.hasOwn(result,'failed'))assert.equal(result.failed,0,'The browser journey reported failed assertions.');

const packet=result.packet;
assert.equal((await verifyExportPacket(packet)).valid,true,'The browser-exported server command history must independently replay.');
assert.equal((await verifyPacketInput({packet})).valid,true,'The shipped portable verifier must reproduce the finance packet.');
const commitment=packet.view.commitments.find(item=>item.id===result.commitmentId);
assert(commitment,'The browser-selected commitment must exist in the exported projection.');
assert.equal(commitment.currency,'USD');
assert.equal(commitment.promisedCents,35000);assert.equal(commitment.verifiedCents,0);assert.equal(commitment.outstandingCents,35000);
assert.equal(packet.view.totals.verifiedCents,0,'No screenshot or approval may invent applied credit.');
assert.equal(packet.view.credits.length,0,'The supplied invoice file contains no applied credit line.');
assert.equal(packet.view.allocations.length,0,'No synthetic attribution may be introduced.');
assert(commitment.sourceLinks.length>0,'The imported promise must retain exact source revision links.');
const bound=commitment.sourceLinks.map(link=>{
 const source=packet.view.sourceVersions.find(item=>item.id===link.sourceId&&item.revision===link.revision);
 assert(source,`Bound source revision is missing: ${link.sourceId}@${link.revision}`);return source;
});
assert(bound.some(source=>source.text.includes(commitment.reference)&&/\bUSD\s+350\b/.test(source.text)),'The retained original source must state the exact reference and USD350 promise.');
const commands=packet.audit.flatMap(entry=>(entry.command.type==='__BATCH__'?entry.command.commands:[entry.command]).map(command=>({command,actor:entry.actor,sequence:entry.sequence})));
const creation=commands.find(item=>item.command.type==='CREATE_COMMITMENT'&&item.command.commitment.id===commitment.id);
assert(creation,'The exact promise must be introduced by recorded reducer commands.');
assert.equal(creation.actor.role,'analyst');assert(!/^(?:browser-)?demo-/.test(creation.actor.id),'The imported promise must retain an actual managed analyst identity.');

const executions=commands.filter(item=>item.command.type==='EXECUTE_ACTION');
assert.equal(executions.length,1,'An identical delegated retry must not append a second financial execution.');
const execution=executions[0],action=packet.view.actions.find(item=>item.id===execution.command.actionId);
assert(action,'The delegated financial execution must retain its exact approved action.');
assert.equal(action.commitmentId,commitment.id);assert.equal(action.type,'prepare_claim');assert.equal(action.status,'executed');
const approvals=commands.filter(item=>item.command.type==='APPROVE_ACTION'&&item.command.actionId===action.id);
assert.equal(approvals.length,1,'The exact action must have one recorded approval before execution.');
const approval=approvals[0];assert(approval.sequence<execution.sequence);assert.equal(approval.actor.role,'admin');
assert(!/^(?:browser-)?demo-/.test(approval.actor.id),'The authority flow must use the managed administrator’s actual approval.');
assert.equal(action.approval.actor.id,approval.actor.id);assert.equal(action.approval.actor.role,'admin');
// Managed membership is checked at the gateway. The recorded domain executor
// remains the signed agent, rather than being relabeled as its admin caller.
assert.equal(execution.actor.role,'executor');assert.match(execution.actor.id,/^agent:[A-Za-z0-9_-]+$/);
assert.equal(action.execution.actor.id,execution.actor.id);
const effects=packet.workspace.events.filter(event=>event.type==='ACTION_EXECUTED'&&event.payload.actionId===action.id);
assert.equal(effects.length,1,'The exact reducer effect must be recorded once, including after retry.');
assert.equal(effects[0].actor.id,execution.actor.id);

// Recovery metadata is separate from the financial export. Do not substitute a
// browser check label for the saved source-bound approval record.
const approved=result.approvedClaimPacket;
assert(approved,'The browser artifact must retain approvedClaimPacket captured before the later edit.');
assert.equal((await verifyPacketInput({packet:approved})).valid,true,'The exact approved claim packet and its server metadata must verify.');
assert.equal(await verifyCase(approved),true);
const metadata=approved.serverRecord;
assert.equal(metadata.caseId,result.claimId);assert.equal(metadata.approvalCurrent,true);assert.equal(metadata.historical,false);
assert.equal(metadata.approval.actor.role,'approver');assert.notEqual(metadata.approval.actor.id,creation.actor.id,'A separate managed approver must review the analyst’s claim.');
assert(!/^(?:browser-)?demo-/.test(metadata.approval.actor.id),'The reviewer must be a managed account.');
assert.equal(approved.report.commitmentRef,commitment.reference);assert.equal(approved.report.promisedCents,35000);assert.equal(approved.report.appliedCents,0);assert.equal(approved.report.outstandingCents,35000);
assert(bound.some(source=>source.text===approved.report.documents.promiseText),'The approved claim must use the same exact source as the ledger promise.');
assert.deepEqual(analyzeEvidence({vendor:approved.report.vendor,asOf:approved.report.asOf,...approved.report.documents}),approved.report,'The retained original documents must independently reproduce the approved source analysis.');
for(const citation of approved.report.citations){const field={promise:'promiseText',invoice:'invoiceCsv',reply:'replyText'}[citation.source];assert(field);assert.equal(approved.report.documents[field].slice(citation.start,citation.end),citation.quote,'Every citation must retain its exact original UTF-16 range.');}
const eml=await readFile(new URL('clearing-claim-approved.eml',root),'utf8');
assert.match(eml,/^X-Unsent: 1\r?$/m);assert.match(eml,/\$350\.00/);
assert.equal(eml,emailFor(approved),'The downloaded unsent email must equal the exact saved approved draft, including its original-dollar amount.');
const latest=result.latestClaim;
assert(latest,'The browser artifact must retain latestClaim after the analyst’s later edit.');
assert.equal(latest.caseId,result.claimId);assert.equal(latest.draftVersion,metadata.draftVersion+1);assert.equal(latest.previousVersionDigest,metadata.versionDigest);
assert.equal(latest.approval,null);assert.equal(latest.approvalCurrent,false);assert.equal(latest.historical,false);assert.equal(latest.status,'draft');
assert.equal(latest.createdBy.role,'analyst');assert.equal(latest.createdBy.id,creation.actor.id);assert.notEqual(latest.draft,metadata.draft);
assert.equal(latest.record.audit.some(event=>event.type==='CLAIM_APPROVED'),false);assert.equal(await verifyCase(latest.record),true);
const storedKeys=['caseId','draftVersion','createdAt','createdBy','evidenceId','analysisVersion','label','draft','draftDigest','record','recordDigest','approval','previousVersionDigest'];
assert.equal(latest.versionDigest,await digest(Object.fromEntries(storedKeys.map(key=>[key,latest[key]]))),'The edited draft must remain bound to its exact saved version digest.');

for(const [file,width,minHeight] of [['clearing-world-desktop-final.png',1440,1000],['clearing-world-mobile-final.png',390,844],['clearing-managed-claim-desktop.png',1440,1000],['clearing-managed-execution-desktop.png',1440,1000]]){
 const png=await readFile(new URL(file,root));
 assert(png.length>10000,`Required rendered screenshot is empty or too small: ${file}`);
 assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a',`${file} is not a PNG screenshot.`);
 assert.equal(png.toString('ascii',12,16),'IHDR');assert(Math.abs(png.readUInt32BE(16)-width)<=20,`${file} must match the requested viewport within its native scrollbar gutter.`);assert(png.readUInt32BE(20)>=minHeight,`${file} has an incomplete viewport height.`);
}
console.log(`VALID: ${result.passed} named managed-browser outcomes; replayed USD350 source-backed promise with zero verified credit; managed-admin approval and exactly one signed-agent action effect after retry; independently verified separate claim approval, exact unsent email and later approval invalidation; desktop/mobile PNG artifacts present. Screenshots still require human visual review; local consistency does not authenticate vendor evidence or establish external sending/settlement.`);

const records=JSON.parse(await readFile(new URL('workspace-records-result.json',root),'utf8'));
assert.equal(records.ok,true,JSON.stringify(records.errors));assert.deepEqual(records.errors,[]);assert.deepEqual(records.pageErrors,[]);assert.equal(records.passed,records.checks.length);assert(records.passed>=30,'Whole-workspace operation must include real record/filter/export/navigation journeys, not only captures.');assert.equal(new Set(records.checks).size,records.checks.length);
for(const requirement of ['financial revision and event history unchanged','All routes and operated journeys produce zero uncaught browser exceptions','Browser Back restores the filtered results and selected row focus','An unsaved credit draft survives returning to results','A phone source link reveals and focuses its source','Phone browser Forward restores the same credit detail','Opening a different case review replaces the previously retained approval action','Switching the active role discards the previous role’s unsaved credit draft','Returning to a credit preserves its invoice filter','Case History explains the actual company, offer and spending instead of a raw event name','The existing Nimbus credit note leads to an invoice check rather than an expired new claim','Nimbus task distinguishes the real new-claim deadline from the expected invoice date','The renewal illustration explains real $2,400 spending, $1,500 offered credit and $900 extra cost without accepting the offer','Only the actual $900 applied invoice carries its invoice-confirmation marker','Phone offer shows the $900 extra cost before the illustration and inside its first viewport','Phone document review action is reachable before the large illustration','Phone date change shows both original and proposed dates before the artwork','Phone case action appears before the reconciliation graphic and inside the first viewport','Case artwork separates the existing matched note from actual invoice credit','Phone introduction and conversation paper never overlap','The first complete company story and next action fit in the phone’s first viewport','The case file opens with four conversations instead of an unexplained KPI taxonomy or accounting table','Pipeline’s opening visual pairs the invoice preview with exact promised, applied and missing amounts','Nimbus’s opening story distinguishes the existing credit note from a reduced invoice','The selected case object moves through an actual normal-motion intermediate state','Returning mid-open reverses the same case object from its current position','Interrupted case opening restores its originating company and keyboard focus','Reduced motion opens the complete case without moving paper'])assert(records.checks.some(item=>item.includes(requirement)),`Missing whole-workspace outcome: ${requirement}`);
assert(records.screenshots.length>=27,'Every main screen needs wide, intermediate and phone captures.');for(const item of records.screenshots){const path=typeof item==='string'?item:item.path;assert(path&&/\.png$/.test(path));const png=await readFile(path);assert(png.length>5000);assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');}
for(const route of ['followups','credits','tasks','companies','documents','activity','reports','workflow-tests','document-review'])for(const size of ['desktop','intermediate','mobile'])assert(records.screenshots.includes(`output/playwright/redesign-${route}-${size}.png`),`Missing rendered route: ${route} at ${size}`);
assert(records.downloads.length>=3,'The source text, financial CSV and full record downloads must be operated.');
const recordPacket=JSON.parse(await readFile(new URL('workspace-records-audit-packet.json',root),'utf8'));
const replay=await verifyAssurancePacket(recordPacket);assert.equal(replay.valid,true,replay.reason);
assert.equal(recordPacket.view.totals.verifiedCents,90000);assert.equal(recordPacket.view.credits.length,2);assert.equal(recordPacket.view.commitments.length,4);
const csv=await readFile(new URL('workspace-records-report.csv',root),'utf8');
assert.equal(csv,reportCsv(financialReport(recordPacket.workspace,{asOf:recordPacket.view.asOf,knownAt:recordPacket.view.knownAt})),'Downloaded CSV must independently reproduce the exact dates and cents in the downloaded full record.');
const exactSource=recordPacket.view.sourceVersions.find(item=>item.id==='pipeline-promise'&&item.revision===6);assert(exactSource);
assert.equal(await readFile(new URL('workspace-exact-source.txt',root),'utf8'),exactSource.text,'The source download must retain the exact bound text.');
console.log(`VALID: full redesigned workspace, ${records.passed} operated record/navigation/export outcomes plus ${result.passed} managed workflow outcomes. Visual quality is reviewed against the user request separately.`);

await import('./verify-credit-workflows.mjs');

const examples=JSON.parse(await readFile(new URL('workspace-examples-result.json',root),'utf8'));
assert.equal(examples.ok,true,JSON.stringify(examples.errors));assert.equal(examples.runtime,'browser');assert.deepEqual(examples.errors,[]);assert.deepEqual(examples.pageErrors,[]);assert.equal(examples.passed,examples.checks.length);assert(examples.passed>=30);
for(const outcome of ['Reload preserves exact approved draft and audit record','Wrong reference cannot count an equal-sized credit','Changed input recalculates $1,000 applied and $1,400 outstanding','New condition keeps original verified credits and adds no savings','Issued credit does not increase savings','Applied credit increases verified savings to $2,900','Phone source dismissal returns keyboard focus'])assert(examples.checks.some(label=>label.includes(outcome)),`Missing browser document/example outcome: ${outcome}`);
for(const name of ['approved-evidence-packet','wrong-reference','recalculated-credit','new-condition']){
 const packet=examples.packets[name];assert(packet);assert.equal(await verifyCase(packet),true);const replay=await verifyPacketInput({packet});assert.equal(replay.valid,true,replay.reason);
 const report=packet.report;assert.deepEqual(analyzeEvidence({vendor:report.vendor,asOf:report.asOf,...report.documents}),report,'Downloaded document review must reproduce from its original inputs.');
 assert.deepEqual(JSON.parse(await readFile(new URL(`browser-examples-${name}.json`,root),'utf8')),packet,'Structured result must retain the actual exported review.');
}
assert.equal(await readFile(new URL('browser-examples-approved-claim.eml',root),'utf8'),emailFor(examples.packets['approved-evidence-packet']));
assert.equal(examples.packets['wrong-reference'].report.verifiedCents,0);assert.equal(examples.packets['recalculated-credit'].report.verifiedCents,100000);assert.equal(examples.packets['new-condition'].report.verifiedCents,90000);
for(const file of ['document-review-desktop','document-review-mobile','guided-pipeline-desktop','guided-pipeline-mobile','source-modal-mobile']){const path=`output/playwright/browser-examples-${file}.png`;assert(examples.screenshots.includes(path));const png=await readFile(path);assert(png.length>5000);assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');}
console.log(`VALID: ${examples.passed} browser-local document and guided-example outcomes, four independently reproduced source analyses and exact approved unsent email.`);
