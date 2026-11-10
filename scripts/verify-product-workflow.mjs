#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {verifyAssurancePacket} from './verify-assurance-packet.mjs';
import {verifyPacketInput} from '../server/packets.mjs';
import {verifyCase,emailFor} from '../src/recovery.mjs';
import {analyzeEvidence} from '../src/engine/index.mjs';
import {verifyEmailEvidence} from './verify-email-evidence.mjs';

const root=new URL('../output/playwright/',import.meta.url);
const json=async file=>JSON.parse(await readFile(new URL(file,root),'utf8'));
const result=await json('product-workflow-result.json');
assert.equal(result.ok,true);assert.deepEqual(result.errors,[]);assert.deepEqual(result.pageErrors,[]);
assert.equal(result.passed,result.checks.length);assert.equal(new Set(result.checks).size,result.passed);
for(const phrase of ['terminal state instead of asking for a fresh approval','removed from active review files','replaces its earlier version in active files','both their role restriction','real reasoned decline','Separate approver and executor','exactly one recorded execution','Repeated Add documents','exact unsaved message','rather than stale review A','only the exact approved B message','does not silently import','phone global Add documents'])assert(result.checks.some(check=>check.includes(phrase)),`Missing operated outcome: ${phrase}`);
const packet=await json('product-financial-record.json');
assert.deepEqual(packet,result.financialPacket);
const replay=await verifyAssurancePacket(packet);assert.equal(replay.valid,true,replay.reason);
const action=packet.view.actions.find(item=>item.id===result.reviewActionId);
assert(action);assert.equal(action.type,'preserve_original');assert.equal(action.executed,true);
assert.equal(action.approval.actor.role,'approver');assert.equal(action.execution.actor.role,'executor');
assert.notEqual(action.approval.actor.id,action.execution.actor.id);
const events=packet.workspace.events;
const approved=events.filter(event=>event.type==='ACTION_APPROVED'&&event.payload.actionId===action.id);
const executed=events.filter(event=>event.type==='ACTION_EXECUTED'&&event.payload.actionId===action.id);
assert.equal(approved.length,1);assert.equal(executed.length,1);assert(approved[0].sequence<executed[0].sequence);
const declined=events.filter(event=>event.type==='AMENDMENT_DISMISSED'&&event.payload.amendmentId==='amendment-pipeline-renewal');
assert.equal(declined.length,1);assert.equal(declined[0].payload.reason,'Keep the existing service price. Decline the extra-spending renewal.');
assert(declined[0].sequence<approved[0].sequence);
assert.equal(events.some(event=>event.type==='AMENDMENT_ACCEPTED'&&event.payload.amendmentId==='amendment-pipeline-renewal'),false);
const promise=packet.view.commitments.find(item=>item.id==='pipeline-seats');
assert.equal(promise.promisedCents,240000);assert.equal(promise.verifiedCents,90000);assert.equal(promise.outstandingCents,150000);
for(const [key,file] of Object.entries({a:'analysis-a',b:'analysis-b',restoredB:'restored-analysis-b',approvedB:'approved-analysis-b'})){
 const analysis=await json(`product-${file}.json`);assert.deepEqual(analysis,result.analyses[key]);
 assert.equal(await verifyCase(analysis),true);
 const verified=await verifyPacketInput({packet:analysis});assert.equal(verified.valid,true,verified.reason);
 assert.deepEqual(analyzeEvidence({vendor:analysis.report.vendor,asOf:analysis.report.asOf,...analysis.report.documents}),analysis.report);
 for(const citation of analysis.report.citations){const field={promise:'promiseText',invoice:'invoiceCsv',reply:'replyText'}[citation.source];assert.equal(analysis.report.documents[field].slice(citation.start,citation.end),citation.quote);}
}
const {a,b,restoredB,approvedB}=result.analyses;
assert.notEqual(a.id,b.id);assert.equal(a.report.vendor,'Pipeline CRM');assert.equal(b.report.vendor,'Meridian Tools');
assert.deepEqual(restoredB,b);assert.equal(b.report.promisedCents,12500);assert.equal(b.report.appliedCents,2500);assert.equal(b.report.outstandingCents,10000);
assert.equal(approvedB.id,b.id);assert.deepEqual(approvedB.report,b.report);
assert.equal(approvedB.audit.filter(event=>event.type==='CLAIM_APPROVED').length,1);
const email=await readFile(new URL('product-approved-message-b.eml',root),'utf8');
assert.equal(email,result.approvedEmail);assert.equal(email,emailFor(approvedB));assert.match(email,/^X-Unsent: 1\r?$/m);
assert.match(email,/PRODUCT-B exact approved wording/);assert.doesNotMatch(email,/PRODUCT-A unsaved review edit/);
verifyEmailEvidence(email,approvedB);
console.log(`VALID: ${result.passed} operated product outcomes; independently replayed decline, separate approval/execution, unchanged $2,400/$900/$1,500 case; exact A/B analysis restoration and source ranges; exact approved unsent B email. Visual quality requires rendered review separately.`);
