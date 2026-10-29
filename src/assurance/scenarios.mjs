import { createDemoWorkspace } from './fixtures.mjs';
import { evaluateWorkspace, reduceWorkspace, validateWorkspace, simulateAction } from './core.mjs';

const admin={id:'scenario-admin',role:'admin'};
export const scenarios = [
  {id:'double-allocation',name:'One credit, one conserved balance',description:'Try to reuse a fully allocated USD 900 credit. The second claim cannot consume it again.'},
  {id:'issued-not-applied',name:'A memo is not applied savings',description:'Keep the USD 2,000 memo pending, then add an invoice and observe verified value change only on application.'},
  {id:'credit-reversal',name:'A reversed credit reopens the promise',description:'Reverse the USD 900 applied credit. The original outstanding balance returns without negative money.'},
  {id:'stale-approval',name:'An approval belongs to one evidence revision',description:'Approve an original-terms action, change its source, and reject execution under the old approval.'},
  {id:'negative-renewal',name:'A credit can be an expensive deal',description:'Compare the remaining USD 1,500 benefit against USD 2,400 incremental renewal cost under an explicit annual baseline.'},
  {id:'late-amendment',name:'What was effective is not what was known',description:'A late-recorded accepted amendment changes a retrospective view only after its observation time.'},
  {id:'ambiguous-credit',name:'Quarantine an ambiguous reference',description:'Discover a second commitment sharing a reference. Require a source-backed resolution rather than choosing a match.'},
  {id:'deadline-drift',name:'Deadlines move with the replay date',description:'A still-open SLA claim expires after October 30, even if no new source event arrives.'},
  {id:'competing-amendments',name:'Competing branches need an explicit decision',description:'Quarantine incompatible date/renewal proposals. Dismiss one with a reason before accepting a current, approved alternative.'},
];

export function runScenario(id) {
  const scenario=scenarios.find(s=>s.id===id); if(!scenario)throw new Error(`Unknown authored scenario ${id}.`);
  let workspace=createDemoWorkspace(); const steps=[],checks=[];
  let tick=0;
  const command=(value,{actor=admin,now='2026-10-29T12:00:00.000Z',expectError=null}={})=>{
    const input={id:`scenario-${id}-${++tick}`,...value};
    try { const result=reduceWorkspace(workspace,input,{actor,now});workspace=result.state;steps.push({command:input,result:result.result,revision:workspace.revision});if(expectError)checks.push({name:`Expected ${expectError}`,passed:false,detail:'Command unexpectedly succeeded.'}); }
    catch(error) {steps.push({command:input,error:{code:error.code||'ERROR',message:error.message},revision:workspace.revision});checks.push({name:`Expected ${expectError||'success'}`,passed:error.code===expectError,detail:error.message});}
  };
  const check=(name,passed,detail)=>checks.push({name,passed:Boolean(passed),detail});
  const current=()=>evaluateWorkspace(workspace,{asOf:id==='deadline-drift'?'2026-10-31':'2026-10-29',knownAt:'2026-11-10T23:59:59.000Z'});
  const commitment=id=>current().commitments.find(c=>c.id===id);
  if(id==='double-allocation') {
    command({type:'ALLOCATE_CREDIT',allocationId:'duplicate-attempt',creditId:'credit-pipeline-900',commitmentId:'pipeline-seats',amountCents:90000},{expectError:'INSUFFICIENT_CREDIT'});
    check('Verified cents unchanged',commitment('pipeline-seats').verifiedCents===90000,'USD 900 remains the only applied allocation.');
  }
  if(id==='issued-not-applied') {
    check('Memo contributes zero verified cents',commitment('nimbus-sla').verifiedCents===0,'Issued and applied are different states.');
    command({type:'APPLY_CREDIT',creditId:'credit-nimbus-2000',sourceIds:['nimbus-memo']},{expectError:'VALIDATION'});
    command({type:'ADD_SOURCE',source:{id:'nimbus-final-invoice',vendorId:'nimbus',title:'Applied SLA credit invoice',kind:'invoice',text:'SYNTHETIC invoice INV-NC-1029 applies CM-NC-204 / NC-SLA-2026: USD 2,000 reduces the amount due.'}});
    command({type:'APPLY_CREDIT',creditId:'credit-nimbus-2000',sourceIds:['nimbus-final-invoice']});
    check('Invoice application verifies USD 2,000',commitment('nimbus-sla').verifiedCents===200000,'The preexisting allocation becomes applied only after invoice evidence.');
  }
  if(id==='credit-reversal') {
    command({type:'ADD_SOURCE',source:{id:'pipeline-reversal',vendorId:'pipeline',title:'Invoice correction reversal',kind:'reversal',text:'SYNTHETIC: credit CREDIT-PC-900 reversed in full. USD 900 is no longer applied.'}});
    command({type:'REVERSE_CREDIT',creditId:'credit-pipeline-900',amountCents:90000,sourceIds:['pipeline-reversal']});
    check('Original balance reopened',commitment('pipeline-seats').outstandingCents===240000&&commitment('pipeline-seats').verifiedCents===0,'Outstanding returns to USD 2,400.');
  }
  if(id==='stale-approval') {
    command({type:'APPROVE_ACTION',actionId:'action-pipeline-preserve'});
    command({type:'REVISE_SOURCE',sourceId:'pipeline-promise',text:'SYNTHETIC revised source content: further review required.'});
    command({type:'EXECUTE_ACTION',actionId:'action-pipeline-preserve'},{expectError:'STALE_APPROVAL'});
    check('Stale state is visible',current().actions.find(a=>a.id==='action-pipeline-preserve').status==='stale','The old approval does not authorize the revised record.');
  }
  if(id==='negative-renewal') {
    const result=simulateAction(workspace,{commitmentId:'pipeline-seats',type:'accept_amendment',payload:{amendmentId:'amendment-pipeline-renewal'}});
    check('Renewal economics uses incremental cost',result.economics.creditCents===150000&&result.economics.incrementalRenewalCostCents===240000&&result.economics.netIncrementalValueCents===-90000,'USD 1,500 remaining benefit minus USD 2,400 extra annual cost = negative USD 900.');
    command({type:'APPROVE_ACTION',actionId:'action-pipeline-renewal'},{expectError:'POLICY_BLOCKED'});
    check('Original promise unchanged',commitment('pipeline-seats').promisedCents===240000,'A counteroffer does not replace accepted terms.');
  }
  if(id==='late-amendment') {
    const now='2026-11-05T12:00:00.000Z';
    command({type:'DISMISS_AMENDMENT',amendmentId:'amendment-pipeline-renewal',reason:'Keep this temporal scenario on the original agreement; decline the renewal alternative.'},{now});
    command({type:'PROPOSE_AMENDMENT',amendment:{id:'late-date-change',commitmentId:'pipeline-seats',kind:'date_change',patch:{dueDate:'2026-11-15'},effectiveDate:'2026-10-15',sourceIds:['pipeline-proposal']}},{now});
    command({type:'PROPOSE_ACTION',action:{id:'late-date-action',commitmentId:'pipeline-seats',type:'accept_amendment',payload:{amendmentId:'late-date-change'}}},{now});
    command({type:'APPROVE_ACTION',actionId:'late-date-action'},{now});
    command({type:'EXECUTE_ACTION',actionId:'late-date-action'},{now});
    const earlier=evaluateWorkspace(workspace,{asOf:'2026-10-29',knownAt:'2026-10-29T23:59:59.000Z'}),later=evaluateWorkspace(workspace,{asOf:'2026-10-29',knownAt:'2026-11-06T00:00:00.000Z'});
    check('No hindsight in earlier knowledge view',earlier.commitments.find(c=>c.id==='pipeline-seats').dueDate==='2026-10-01','The later observation cannot leak backward.');
    check('Late knowledge changes retrospective interpretation',later.commitments.find(c=>c.id==='pipeline-seats').dueDate==='2026-11-15','Effective October 15, observed November 5.');
  }
  if(id==='ambiguous-credit') {
    command({type:'CREATE_COMMITMENT',commitment:{id:'pipeline-second',vendorId:'pipeline',reference:'PC-SEATS-2026',currency:'USD',promisedCents:90000,dueDate:'2026-10-01',conditions:[],sourceIds:['pipeline-promise']}});
    check('Ambiguity quarantined',current().quarantine.some(q=>q.creditId==='credit-pipeline-900'),'Two exact candidates require finance evidence.');
    command({type:'ALLOCATE_CREDIT',allocationId:'ambiguous-allocation',creditId:'credit-pipeline-900',commitmentId:'pipeline-second',amountCents:100},{expectError:'AMBIGUOUS'});
    command({type:'RESOLVE_CREDIT',creditId:'credit-pipeline-900',assignments:[{commitmentId:'pipeline-seats',limitCents:90000}],sourceIds:['pipeline-invoice']});
    check('Resolution restores unique attribution',!current().credits.find(c=>c.id==='credit-pipeline-900').quarantined&&commitment('pipeline-seats').verifiedCents===90000,'The recorded source-backed mapping preserves the original allocation.');
  }
  if(id==='deadline-drift') {
    const before=evaluateWorkspace(workspace,{asOf:'2026-10-29'}),after=evaluateWorkspace(workspace,{asOf:'2026-10-31'});
    check('Deadline state recalculated',before.commitments.find(c=>c.id==='nimbus-sla').deadline.state==='open'&&after.commitments.find(c=>c.id==='nimbus-sla').deadline.state==='expired','No new source is needed for time to pass.');
    command({type:'APPROVE_ACTION',actionId:'action-nimbus-claim'},{now:'2026-10-29T12:00:00.000Z'});
    command({type:'EXECUTE_ACTION',actionId:'action-nimbus-claim'},{now:'2026-10-31T12:00:00.000Z',expectError:'POLICY_BLOCKED'});
  }
  if(id==='competing-amendments') {
    const original=commitment('pipeline-seats').dueDate;
    check('Pending branches conflict',current().amendments.find(a=>a.id==='amendment-pipeline-date').conflictingAmendmentIds.includes('amendment-pipeline-renewal'),'The date amendment and renewal imply different due dates and economics.');
    command({type:'PROPOSE_ACTION',action:{id:'conflicted-date',commitmentId:'pipeline-seats',type:'accept_amendment',payload:{amendmentId:'amendment-pipeline-date'}}});
    command({type:'APPROVE_ACTION',actionId:'conflicted-date'},{expectError:'POLICY_BLOCKED'});
    command({type:'DISMISS_AMENDMENT',amendmentId:'amendment-pipeline-renewal',reason:'Decline the annual renewal; keep the original contractual obligation.'});
    command({type:'PROPOSE_ACTION',action:{id:'resolved-date',commitmentId:'pipeline-seats',type:'accept_amendment',payload:{amendmentId:'amendment-pipeline-date'}}});
    command({type:'APPROVE_ACTION',actionId:'resolved-date'});
    command({type:'EXECUTE_ACTION',actionId:'resolved-date'});
    check('Rejection retained without rewriting original',current().amendments.find(a=>a.id==='amendment-pipeline-renewal').rejected&&commitment('pipeline-seats').dueDate===original,'The accepted date amendment still waits until November 1.');
    const future=evaluateWorkspace(workspace,{asOf:'2026-11-02',knownAt:'2026-11-10T23:59:59.000Z'});
    check('Chosen branch takes effect',future.commitments.find(c=>c.id==='pipeline-seats').dueDate==='2026-11-15','Only the explicitly chosen schedule becomes effective.');
  }
  const view=current(),invariants=validateWorkspace(workspace,{asOf:view.asOf,knownAt:view.knownAt});
  check('Global accounting invariants hold',invariants.valid,invariants.violations.join('; ')||'Conserved credits, nonnegative balances, valid identity and graph lineage.');
  return {...scenario,passed:checks.every(c=>c.passed),steps,checks,workspace,view};
}
export const runScenarios=()=>scenarios.map(s=>runScenario(s.id));
