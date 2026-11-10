import test from 'node:test';
import assert from 'node:assert/strict';
import {createDemoWorkspace,evaluateWorkspace,reduceWorkspace} from './assurance/index.mjs';
import {documentReading} from './document-reading.mjs';

const options={asOf:'2026-11-10',knownAt:'2026-11-10T23:59:59.999Z'};
const evaluate=state=>evaluateWorkspace(state,options);
const fixture=()=>evaluate(createDemoWorkspace());
const read=(view,id,revision)=>documentReading(view,view.sourceVersions.find(source=>source.id===id&&(revision===undefined||source.revision===revision)));

test('all nine supplied documents have a readable role without replacing immutable source text',()=>{
  const view=fixture(),before=JSON.stringify(view);
  const expected={
    'pipeline-renewal':'offer','pipeline-proposal':'date-change','nimbus-memo':'credit-note',
    'parcel-promise':'promise','orbit-offer':'offer','pipeline-invoice':'invoice',
    'nimbus-incident':'incident','pipeline-promise':'promise','nimbus-contract':'agreement',
  };
  assert.equal(view.sourceVersions.length,9);
  for(const source of view.sourceVersions){
    const result=documentReading(view,source);
    assert.equal(result.kind,expected[source.id]);
    assert.equal(result.sourceText,source.text);
    assert.equal(result.originalTitle,source.title);
    assert(result.caseLinks.length>0);
    assert.doesNotMatch(result.title,/explicit baseline|amendment|counterfactual|assurance/i);
    assert.equal(Object.hasOwn(result,'sentAt'),false);
    assert.equal(Object.hasOwn(result,'senderEmail'),false);
  }
  assert.equal(JSON.stringify(view),before);
});

test('renewal comparison uses frozen offered credit rather than a later remaining balance',()=>{
  const view=fixture();
  const action=view.actions.find(item=>item.id==='action-pipeline-renewal');
  action.economics.creditCents=0;action.economics.netIncrementalValueCents=-240000;
  view.commitments.find(item=>item.id==='pipeline-seats').outstandingCents=0;
  const result=read(view,'pipeline-renewal');
  assert.equal(result.visual.creditCents,150000);
  assert.equal(result.visual.extraCostCents,240000);
  assert.equal(result.visual.netCostCents,90000);
  assert.equal(result.visual.baselineCostCents,7200000);
  assert.equal(result.visual.proposedCostCents,7440000);
  assert.equal(result.visual.decision,'Not accepted');
  assert.deepEqual(result.caseLinks,[{commitmentId:'pipeline-seats',destination:'decisions',actionId:'action-pipeline-renewal',label:'Review the proposed terms'}]);
  delete action.proposedEconomics;
  assert.equal(read(view,'pipeline-renewal').visual.creditCents,null,'No snapshot must not fall back to current remaining money');
});

test('conditional offer remains a proposal with its actual extra spending and comparison',()=>{
  const result=read(fixture(),'orbit-offer');
  assert.equal(result.visual.creditCents,48000);
  assert.equal(result.visual.extraCostCents,240000);
  assert.equal(result.visual.netCostCents,192000);
  assert.equal(result.visual.baselineCostCents,0);
  assert.match(result.summary,/conditional on a renewal/);
  assert.doesNotMatch(result.summary,/owed|received|recovered|saved/i);
  assert.equal(result.caseLinks.length,1,'Commitment plus amendment must not duplicate the same case');
});

test('original note face and document kind survive partial assignment, reversal and later application',()=>{
  const view=fixture(),credit=view.credits.find(item=>item.id==='credit-nimbus-2000');
  credit.amountCents=30000;credit.availableCents=15000;credit.allocatedCents=10000;credit.reversedCents=15000;credit.status='applied';
  const result=read(view,'nimbus-memo');
  assert.equal(result.visual.kind,'credit-note');
  assert.equal(result.visual.faceCents,30000);
  assert.equal(result.visual.creditCents,30000);
  assert.match(result.summary,/\$300 credit note/);
  assert.match(result.sections[0].text,/does not by itself show a lower invoice/);
  assert.equal(result.facts.find(item=>item.label==='Credit note amount').value,'$300');
  assert(!result.facts.some(item=>item.value==='$100'||item.value==='$150'));
});

test('a newer unbound revision never inherits the original revision’s case or financial meaning',()=>{
  let workspace=createDemoWorkspace();
  workspace=reduceWorkspace(workspace,{type:'REVISE_SOURCE',sourceId:'pipeline-renewal',text:'A new message with no recorded amendment.'},{actor:{id:'reader-test',role:'admin'},now:'2026-11-09T12:00:00.000Z'}).state;
  const view=evaluate(workspace),versions=view.sourceVersions.filter(source=>source.id==='pipeline-renewal').sort((a,b)=>a.revision-b.revision);
  assert.equal(versions.length,2);
  const original=documentReading(view,versions[0]),latest=documentReading(view,versions[1]);
  assert.equal(original.visual.creditCents,150000);
  assert.equal(latest.kind,'document');
  assert.equal(latest.visual.kind,'text');
  assert.equal(latest.sourceText,'A new message with no recorded amendment.');
  assert.deepEqual(latest.facts,[]);
  assert.deepEqual(latest.caseLinks,[]);
});

test('unrelated action-basis inclusion and title words cannot manufacture a financial relationship',()=>{
  const view=fixture();
  const source={id:'unrelated',vendorId:'pipeline',revision:99,kind:'email',title:'Renewal amendment with a $99,999 credit',text:'This message contains no recorded financial terms.'};
  view.sourceVersions.push(source);view.sources.push(source);
  view.actions[0].basis.sourceRevisions.push({id:source.id,revision:source.revision});
  const result=documentReading(view,source);
  assert.equal(result.title,source.title);
  assert.equal(result.kind,'document');assert.equal(result.summary,'');
  assert.deepEqual(result.caseLinks,[]);assert.deepEqual(result.facts,[]);
});

test('generic CSV and contract documents preserve their actual title and text without invented amounts or terms',()=>{
  const view=fixture();
  for(const [kind,title,text] of [
    ['invoice','Imported statement','reference,amount\nEXAMPLE,63.15\n'],
    ['contract','Nondisclosure agreement','Both parties agree to keep this information confidential.'],
  ]){
    const source={id:`generic-${kind}`,revision:100,kind,title,text,vendorId:'pipeline'};
    view.sourceVersions.push(source);view.sources.push(source);
    const result=documentReading(view,source);
    assert.equal(result.title,title);assert.equal(result.sourceText,text);
    assert.equal(result.visual.kind,'text');assert.deepEqual(result.facts,[]);assert.deepEqual(result.caseLinks,[]);
  }
});

test('date proposal and original promise keep original terms separate from accepted current terms',()=>{
  const view=fixture(),commitment=view.commitments.find(item=>item.id==='pipeline-seats');
  commitment.promisedCents=50000;commitment.dueDate='2026-12-01';
  const promise=read(view,'pipeline-promise');
  assert.equal(promise.visual.faceCents,240000);assert.equal(promise.visual.expectedDate,'2026-10-01');
  const amendment=view.amendments.find(item=>item.id==='amendment-pipeline-date');
  amendment.accepted=true;amendment.effectiveDate='2026-12-01';
  const proposal=read(view,'pipeline-proposal');
  assert.equal(proposal.visual.oldDate,'2026-10-01');assert.equal(proposal.visual.newDate,'2026-11-15');
  assert.equal(proposal.visual.decision,'Accepted for a future date');
  assert.match(proposal.sections[0].text,/starts December 1, 2026/);
});

test('amendment link targets only its own accept action and otherwise opens its source case',()=>{
  const view=fixture();
  view.actions.push({id:'wrong-amendment-action',type:'prepare_claim',commitmentId:'pipeline-seats',payload:{amendmentId:'amendment-pipeline-renewal'}});
  assert.equal(read(view,'pipeline-renewal').caseLinks[0].actionId,'action-pipeline-renewal');
  view.actions=view.actions.filter(item=>item.id!=='action-pipeline-renewal');
  const link=read(view,'pipeline-renewal').caseLinks[0];
  assert.equal(link.commitmentId,'pipeline-seats');assert.equal(link.actionId,null);assert.equal(link.destination,'evidence');
  assert.notEqual(link.actionId,'action-pipeline-preserve');
});

test('missing source version cannot expose structured facts through a stale bound link',()=>{
  const view=fixture(),source=view.sourceVersions.find(item=>item.id==='pipeline-renewal');
  view.sourceVersions=view.sourceVersions.filter(item=>item!==source);
  const result=documentReading(view,source);
  assert.equal(result.visual.kind,'text');assert.deepEqual(result.facts,[]);assert.deepEqual(result.caseLinks,[]);
});
