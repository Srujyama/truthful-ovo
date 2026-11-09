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
    const replay=await verifyAssurancePacket(packet);assert.equal(replay.valid,true,`${path}: ${replay.reason}`);
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
for(const mode of ['server','browser']) {
  for(const kind of ['workflow','recovery']) {
    const path=`output/playwright/${mode}-credit-${kind}-result.json`,report=JSON.parse(await readFile(path,'utf8'));
    assert.equal(report.mode,mode);assert.equal(report.ok,true,JSON.stringify(report.errors));assert.deepEqual(report.errors,[]);assert.deepEqual(report.pageErrors,[]);
    assert(report.checks.length>=30,`${path}: the full operated journey must finish`);assert.equal(report.passed,report.checks.length);
    for(const phrase of kind==='workflow'?['Issued-credit preview does not count applied value','Role changes discard the prior credit review','Causal reversal exposes both separate attribution records','Renewal-only proposal exposes the actual mandate refusal']:['Assignment limits above the shared credit capacity','Returning to approver cannot revive','Completed fulfillment persists after reload','Downloaded resolution evidence conserves'])assert(report.checks.some(item=>item.includes(phrase)),`${path}: missing required outcome ${phrase}`);
    console.log(`${mode} credit ${kind}: ${report.passed} rendered browser outcomes`);
  }
  const path=`output/playwright/${mode}-credit-resolved.json`,packet=JSON.parse(await readFile(path,'utf8'));
  const replay=await verifyAssurancePacket(packet);assert.equal(replay.valid,true,`${path}: ${replay.reason}`);assert.equal(packet.mode,mode);
  const credit=packet.view.credits.find(c=>c.id==='clarity-credit-shared'),orphan=packet.view.credits.find(c=>c.id==='clarity-credit-orphan');
  assert(credit&&orphan);assert.equal(credit.availableCents,30000);assert.equal(credit.allocatedCents,10000);assert.equal(credit.unallocatedCents,20000);assert.equal(credit.quarantined,false);
  assert.deepEqual(credit.resolution.assignments,[{commitmentId:'clarity-a',limitCents:10000},{commitmentId:'clarity-b',limitCents:20000}]);
  assert.equal(packet.view.commitments.find(c=>c.id==='clarity-a').verifiedCents,10000);assert.equal(packet.view.commitments.find(c=>c.id==='clarity-b').verifiedCents,0);assert.equal(orphan.quarantined,true);assert.equal(orphan.unallocatedCents,5000);
  const link=credit.resolution.sourceLinks[0],source=packet.view.sourceVersions.find(s=>s.id===link.sourceId&&s.revision===link.revision);assert(source);assert.equal(source.kind,'allocation_resolution');
  assert(packet.workspace.events.some(e=>e.type==='SOURCE_ADDED'&&e.payload.source.id===link.sourceId&&e.actor.role==='analyst'));
  assert(packet.workspace.events.some(e=>e.type==='CREDIT_RESOLVED'&&e.payload.creditId===credit.id&&e.actor.role==='approver'));
  packets++;
}
console.log(`VALID: ${packets} actual UI packets independently replayed in SQLite and browser-local runtimes; exact lifecycle, reversal, separate role approval/execution, fulfillment and source-backed ambiguity resolution agree.`);
