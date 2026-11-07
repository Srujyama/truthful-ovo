#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { verifyAssurancePacket } from './verify-assurance-packet.mjs';

// These packets are downloaded by the real rendered browser journeys, not fixtures.
let packets=0;
for(const mode of ['server','browser']) {
  for(const stage of ['lifecycle','amended','completed']) {
    const path=`output/playwright/${mode}-credit-${stage}.json`;
    const packet=JSON.parse(await readFile(path,'utf8'));
    await verifyAssurancePacket(packet);
    assert.equal(packet.mode,mode,`${path}: expected runtime boundary`);
    const c=packet.view.commitments.find(c=>c.reference==='NR-CREDIT-2026');
    assert(c,`${path}: imported case retained`);
    assert.equal(c.originalPromisedCents,35000);
    assert.equal(c.promisedCents,stage==='lifecycle'?35000:40000);
    assert.equal(c.verifiedCents,stage==='completed'?40000:15000);
    assert.equal(c.outstandingCents,stage==='lifecycle'?20000:stage==='amended'?25000:0);
    const credits=packet.view.credits.filter(credit=>credit.vendorId===c.vendorId);
    assert.equal(credits.length,stage==='completed'?3:1,`${path}: exact physical identities`);
    const first=credits.find(credit=>credit.invoiceId==='NR-MEMO-001');
    assert.equal(first.amountCents,30000);assert.equal(first.status,'applied');
    assert.equal(first.reversedCents,15000);assert.equal(first.allocatedCents,15000);
    assert.equal(first.allocations.length,2);assert.equal(first.unallocatedCents,0);
    assert(first.allocations.every(a=>a.sourceLinks?.length===1),`${path}: attribution evidence bound`);
    for(const allocation of first.allocations) {
      const link=allocation.sourceLinks[0];
      assert(packet.view.graph.edges.some(edge=>edge.from===`source:${link.sourceId}@${link.revision}`&&edge.to===`allocation:${allocation.id}`&&edge.relation==='supports'),`${path}: exact attribution source appears in graph`);
    }
    if(stage!=='lifecycle') {
      const amendment=packet.view.amendments.find(a=>a.commitmentId===c.id&&a.accepted);
      assert(amendment,`${path}: accepted amendment retained`);
      assert(packet.workspace.events.some(e=>e.type==='ACTION_APPROVED'&&e.actor.role==='approver'),`${path}: separate approval role`);
      assert(packet.workspace.events.some(e=>e.type==='AMENDMENT_ACCEPTED'&&e.actor.role==='executor'),`${path}: separate execution role`);
    }
    if(stage==='completed')assert.equal(c.status,'verified');
    packets++;
  }
}
for(const name of ['browser-server','browser-static','browser-recovery','browser-browser-completion','preserved-server','preserved-static']) {
  const output=await readFile(`output/credit-${name}.log`,'utf8');
  const result=output.match(/### Result\s*\n(\{[^\n]+\})/);
  assert(result,`${name}: real browser result is missing`);
  const report=JSON.parse(result[1]);
  assert(report.checks.length>0);assert.equal(report.passed,report.checks.length);
  assert(!output.includes('### Error'),`${name}: browser command failed`);
  console.log(`${name}: ${report.passed} rendered browser checks`);
}
console.log(`VALID: ${packets} real UI packets independently replayed; exact credit lifecycle, separate approval/execution, and complete fulfillment agree in both runtimes.`);
