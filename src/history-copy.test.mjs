import test from 'node:test';
import assert from 'node:assert/strict';
import {createDemoWorkspace,evaluateWorkspace} from './assurance/index.mjs';
import {workspaceActivity} from './operations.mjs';
import {createHistoryCopy} from './history-copy.mjs';
const state=createDemoWorkspace();
const view=evaluateWorkspace(state,{asOf:'2026-11-09',knownAt:'2026-11-09T23:59:59.999Z'});
const events=workspaceActivity(state,view),copy=createHistoryCopy(state);
const event=(type,id)=>events.find(e=>e.type===type&&JSON.stringify(e.payload).includes(id));

test('history explains the particular proposed next step, not just its event type or opaque reference',()=>{
  const keep=copy(event('ACTION_PROPOSED','action-pipeline-preserve'));
  assert.equal(keep.title,'Prepared a review to keep Pipeline CRM’s original terms');
  assert(!keep.title.includes('PC-SEATS'));
  const renewal=copy(event('ACTION_PROPOSED','action-pipeline-renewal'));
  assert.equal(renewal.title,'Prepared a review of Pipeline CRM’s renewal offer');
  assert.match(renewal.detail,/\$1,500.*\$2,400/);assert.match(renewal.detail,/not been accepted/);
  const claim=copy(event('ACTION_PROPOSED','action-nimbus-claim'));
  assert.match(claim.title,/Nimbus Cloud’s \$2,000 claim/);assert.match(claim.detail,/No email was sent/);
});

test('history separates issued notes from invoice credits and does not call matching a note received money',()=>{
  const note=copy(event('CREDIT_REGISTERED','credit-nimbus-2000'));
  assert.equal(note.title,'Added Nimbus Cloud’s $2,000 credit note');
  assert.match(note.detail,/not a reduction confirmed/);
  const invoice=copy(event('CREDIT_REGISTERED','credit-pipeline-900'));
  assert.equal(invoice.title,'Added a $900 invoice credit for Pipeline CRM');
  const linked=copy(event('CREDIT_ALLOCATED','allocation-nimbus'));
  assert.match(linked.title,/Linked \$2,000.*note/);assert.match(linked.detail,/invoice is still needed/);
  assert.match(copy(event('CREDIT_ALLOCATED','allocation-pipeline')).title,/Matched \$900.*invoice credit/);
});

test('a later application never rewrites an earlier credit-note matching story',()=>{
  const source=event('CREDIT_ALLOCATED','allocation-nimbus');
  const later={sequence:1000,type:'CREDIT_APPLIED',payload:{creditId:'credit-nimbus-2000'}};
  const latestCopy=createHistoryCopy({...state,events:[...state.events,later]});
  assert.deepEqual(latestCopy(source),copy(source));
  assert.match(latestCopy(later).title,/invoice confirming Nimbus Cloud’s credit note/);
});

test('new terms explain the actual renewal cost or proposed date without saying acceptance occurred',()=>{
  const renewal=copy(event('AMENDMENT_PROPOSED','amendment-orbit-renewal'));
  assert.equal(renewal.title,'Recorded a renewal offer for Orbit Design');
  assert.match(renewal.detail,/\$2,400.*not been accepted/);
  const date=copy(event('AMENDMENT_PROPOSED','amendment-pipeline-date'));
  assert.equal(date.title,'Pipeline CRM proposed waiting until November 15');
  assert.match(date.detail,/original promise still applies/);
});

test('documents retain their real title as the explanation without exposing source IDs as the headline',()=>{
  const source=copy(event('SOURCE_ADDED','nimbus-memo'));
  assert.equal(source.title,'Added a credit note for Nimbus Cloud');
  assert.equal(source.detail,'Nimbus credit memo issued');
  const before=JSON.stringify(state);events.forEach(copy);assert.equal(JSON.stringify(state),before);
});

test('recording an approved step does not claim an email or recovered invoice money',()=>{
  const original=event('ACTION_PROPOSED','action-pipeline-preserve').payload.action;
  const executed={sequence:1001,type:'ACTION_EXECUTED',payload:{actionId:original.id},vendorNames:['Pipeline CRM']};
  const result=copy(executed);assert.equal(result.title,'Recorded the approved step for Pipeline CRM');assert.match(result.detail,/No vendor message or invoice credit was created/);
});
