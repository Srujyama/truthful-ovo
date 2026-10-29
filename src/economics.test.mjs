import test from 'node:test';
import assert from 'node:assert/strict';
import { compareRenewal } from './economics.mjs';

test('a $1,500 credit with $2,400 incremental renewal cost is $900 worse than the explicit baseline',()=>{
  assert.deepEqual(compareRenewal({baselineMonthly:'6000',proposedMonthly:'6200',months:12,creditCents:150000}),{baselineCents:7200000,proposedCents:7440000,incrementalCents:240000,netValueCents:-90000,netOutlayCents:7290000,months:12});
});
test('equivalent price, lower price, exact cents, and invalid periods are handled without invented assumptions',()=>{
  assert.equal(compareRenewal({baselineMonthly:'10.10',proposedMonthly:'10.20',months:3,creditCents:50}).netValueCents,20);
  assert.equal(compareRenewal({baselineMonthly:'6000',proposedMonthly:'6000',months:12,creditCents:150000}).netValueCents,150000);
  assert.equal(compareRenewal({baselineMonthly:'6000',proposedMonthly:'5900',months:12,creditCents:150000}).netValueCents,270000);
  for(const months of [0,121,1.5,Infinity]) assert.throws(()=>compareRenewal({baselineMonthly:'1',proposedMonthly:'2',months,creditCents:100}));
  assert.throws(()=>compareRenewal({baselineMonthly:'NaN',proposedMonthly:'2',months:12,creditCents:100}));
  assert.throws(()=>compareRenewal({baselineMonthly:'90071992547409.91',proposedMonthly:'0',months:1,creditCents:Number.MAX_SAFE_INTEGER-1}),/supported amount/);
});
