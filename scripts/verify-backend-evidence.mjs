#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {verifyExportPacket} from '../server/service.mjs';
import {verifyPacketInput} from '../server/packets.mjs';

const result=JSON.parse(await readFile('output/playwright/backend-browser-result.json','utf8'));
assert(result.checks.length>=20&&result.passed===result.checks.length,'The real managed browser journey must complete all recorded checks.');
assert(result.checks.some(label=>label.includes('rather than browser fallback')),'Browser evidence must explicitly check managed SQLite mode.');
const packet=result.packet;
assert.equal((await verifyExportPacket(packet)).valid,true,'Browser-exported server audit must independently replay.');
assert.equal((await verifyPacketInput({packet})).valid,true,'Portable packet endpoint verifier must reproduce the actual browser record.');
assert.equal(packet.workspace.id,result.workspaceId);
const commitment=packet.view.commitments.find(c=>c.id===result.caseId);assert(commitment);
assert.equal(commitment.promisedCents,40000);assert.equal(commitment.verifiedCents,40000);assert.equal(commitment.outstandingCents,0);assert.equal(commitment.status,'verified');
const action=packet.view.actions.find(a=>a.id===result.actionId);assert.equal(action.status,'executed');
const approved=packet.audit.find(e=>e.command.type==='APPROVE_ACTION'&&e.command.actionId===result.actionId);
const executed=packet.audit.find(e=>e.command.type==='EXECUTE_ACTION'&&e.command.actionId===result.actionId);
assert.equal(approved.actor.role,'approver');assert.equal(executed.actor.role,'executor');assert.notEqual(approved.actor.id,executed.actor.id);
assert(![approved.actor.id,executed.actor.id].some(id=>id.startsWith('demo-')||id.startsWith('browser-demo-')),'Actual managed user identities must be retained.');
for(const file of ['backend-managed-portfolio.png','backend-managed-execution.png'])assert((await readFile('output/playwright/'+file)).length>10000,`Rendered ${file} is missing.`);
const log=await readFile('output/backend-browser.log','utf8');assert(!log.includes('### Error'),'Browser tool reported an unfinished journey.');
console.log(`VALID: ${result.passed} real managed-browser checks; exact source-backed USD400 promise completely fulfilled by USD400 applied attribution; distinct approver/executor; exported command history independently replayed.`);
