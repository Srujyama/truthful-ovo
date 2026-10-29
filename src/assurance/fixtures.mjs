import { createWorkspace, reduceWorkspace } from './core.mjs';

export const DEMO_IDS = Object.freeze({
  commitments: ['pipeline-seats','nimbus-sla','orbit-renewal','parcel-waiver'],
  credits: ['credit-pipeline-900','credit-nimbus-2000'],
  amendments: ['amendment-pipeline-date','amendment-pipeline-renewal','amendment-orbit-renewal'],
  actions: ['action-pipeline-preserve','action-pipeline-renewal','action-orbit-renewal','action-nimbus-claim'],
});
const source=(id,vendorId,title,kind,text)=>({type:'ADD_SOURCE',source:{id,vendorId,title,kind,text:`SYNTHETIC ASSURANCE EXAMPLE\n${text}`}});
const at=date=>`${date}T12:00:00.000Z`;
export const demoCommands = [
  ...[['pipeline','Pipeline CRM'],['nimbus','Nimbus Cloud'],['orbit','Orbit Design'],['parcel','Parcel']].map(([id,name])=>({at:at('2026-09-01'),command:{type:'ADD_VENDOR',vendor:{id,name}}})),
  {at:at('2026-09-01'),command:source('nimbus-contract','nimbus','Nimbus service agreement','contract','Reference NC-SLA-2026. Covered monthly service costs USD 8,000. Availability below 99% earns a 25% service credit. Claims are due October 30, 2026. A credit memo must reduce a subsequent invoice before it is applied savings.')},
  {at:at('2026-09-18'),command:source('pipeline-promise','pipeline','Original duplicate-seat correction','email','We will credit USD 2,400 on your October 1, 2026 invoice for duplicate seats. Reference PC-SEATS-2026. This correction does not require a renewal.')},
  {at:at('2026-09-18'),command:{type:'CREATE_COMMITMENT',commitment:{id:'pipeline-seats',vendorId:'pipeline',reference:'PC-SEATS-2026',currency:'USD',promisedCents:240000,dueDate:'2026-10-01',claimDeadline:null,conditions:[],sourceIds:['pipeline-promise']}}},
  {at:at('2026-09-28'),command:source('nimbus-incident','nimbus','Covered nine-hour outage','incident','The covered EU-West Compute service was unavailable for 540 of September’s 43,200 minutes: 98.75% availability. Under NC-SLA-2026 the 25% tier on USD 8,000 supports a USD 2,000 claim.')},
  {at:at('2026-09-28'),command:{type:'CREATE_COMMITMENT',commitment:{id:'nimbus-sla',vendorId:'nimbus',reference:'NC-SLA-2026',currency:'USD',promisedCents:200000,dueDate:'2026-10-01',claimDeadline:'2026-10-30',conditions:[],sourceIds:['nimbus-contract','nimbus-incident']}}},
  {at:at('2026-10-01'),command:source('pipeline-invoice','pipeline','October invoice: partial correction','invoice','Invoice INV-PC-1026, credit line CREDIT-PC-900: USD 900 applied for duplicate-seat correction PC-SEATS-2026. Gross USD 6,000 less USD 900 = USD 5,100 due. No other line applies to this reference.')},
  {at:at('2026-10-01'),command:{type:'REGISTER_CREDIT',credit:{id:'credit-pipeline-900',invoiceId:'INV-PC-1026',vendorId:'pipeline',currency:'USD',reference:'PC-SEATS-2026',amountCents:90000,status:'applied',sourceIds:['pipeline-invoice']}}},
  {at:at('2026-10-01'),command:{type:'ALLOCATE_CREDIT',allocationId:'allocation-pipeline',creditId:'credit-pipeline-900',commitmentId:'pipeline-seats',amountCents:90000}},
  {at:at('2026-10-20'),command:source('orbit-offer','orbit','Orbit renewal-linked offer','agent_conversation','We can credit USD 480 if you accept another 12-month subscription for USD 2,400. The explicit comparison baseline is cancellation/no future service at USD 0. No renewal has been accepted. Reference OD-RENEWAL-2026. Offer effective November 1, 2026.')},
  {at:at('2026-10-20'),command:{type:'CREATE_COMMITMENT',commitment:{id:'orbit-renewal',vendorId:'orbit',reference:'OD-RENEWAL-2026',currency:'USD',promisedCents:48000,dueDate:'2026-11-01',conditions:['Accept a new 12-month renewal.'],sourceIds:['orbit-offer']}}},
  {at:at('2026-10-20'),command:{type:'PROPOSE_AMENDMENT',amendment:{id:'amendment-orbit-renewal',commitmentId:'orbit-renewal',kind:'renewal',patch:{conditions:[]},effectiveDate:'2026-11-01',sourceIds:['orbit-offer'],baselineCostCents:0,incrementalRenewalCostCents:240000,baselineDescription:'Cancellation/no future service at USD 0; no value is assigned to additional service.',newCommitment:true}}},
  {at:at('2026-10-21'),command:source('parcel-promise','parcel','November setup-fee waiver','email','We will waive the USD 350 setup fee on the November 1, 2026 invoice. Reference PL-SETUP-2026. No minimum term or renewal is required. No invoice has arrived yet.')},
  {at:at('2026-10-21'),command:{type:'CREATE_COMMITMENT',commitment:{id:'parcel-waiver',vendorId:'parcel',reference:'PL-SETUP-2026',currency:'USD',promisedCents:35000,dueDate:'2026-11-01',conditions:[],sourceIds:['parcel-promise']}}},
  {at:at('2026-10-25'),command:source('nimbus-memo','nimbus','Nimbus credit memo issued','credit_memo','Credit memo CM-NC-204 issues USD 2,000 for NC-SLA-2026. This memo is issued, not applied. It does not show a reduced invoice balance.')},
  {at:at('2026-10-25'),command:{type:'REGISTER_CREDIT',credit:{id:'credit-nimbus-2000',invoiceId:'CM-NC-204',vendorId:'nimbus',currency:'USD',reference:'NC-SLA-2026',amountCents:200000,status:'issued',sourceIds:['nimbus-memo']}}},
  {at:at('2026-10-25'),command:{type:'ALLOCATE_CREDIT',allocationId:'allocation-nimbus',creditId:'credit-nimbus-2000',commitmentId:'nimbus-sla',amountCents:200000}},
  {at:at('2026-10-28'),command:source('pipeline-proposal','pipeline','Unaccepted date amendment','email','Proposal only: move the remaining USD 1,500 correction to November 15, 2026. The original October 1 promise stays in force until finance accepts this date amendment. Reference PC-SEATS-2026.')},
  {at:at('2026-10-28'),command:{type:'PROPOSE_AMENDMENT',amendment:{id:'amendment-pipeline-date',commitmentId:'pipeline-seats',kind:'date_change',patch:{dueDate:'2026-11-15'},effectiveDate:'2026-11-01',sourceIds:['pipeline-proposal'],baselineCostCents:0,incrementalRenewalCostCents:0,baselineDescription:'Existing agreement, no renewal or extra spend.',newCommitment:false}}},
  {at:at('2026-10-28'),command:source('pipeline-renewal','pipeline','Renewal counteroffer with explicit baseline','email','Instead, we offer the remaining USD 1,500 correction if you renew for 12 months at USD 6,200 per month. Counterfactual baseline: renew the same service for 12 months at USD 6,000 per month, not an already accepted future obligation. Proposed annual USD 74,400 minus baseline USD 72,000 = USD 2,400 incremental spend. The USD 900 already applied is not a new benefit. Reference PC-SEATS-2026.')},
  {at:at('2026-10-28'),command:{type:'PROPOSE_AMENDMENT',amendment:{id:'amendment-pipeline-renewal',commitmentId:'pipeline-seats',kind:'renewal',patch:{conditions:[],dueDate:'2026-11-01'},effectiveDate:'2026-11-01',sourceIds:['pipeline-renewal'],baselineCostCents:7200000,incrementalRenewalCostCents:240000,baselineDescription:'Hypothetically renew equivalent service for 12 months at USD 6,000/mo (USD 72,000 total); this is an explicit comparison assumption, not a recorded obligation.',newCommitment:true}}},
  ...[
    {id:'action-pipeline-preserve',commitmentId:'pipeline-seats',type:'preserve_original',payload:{}},
    {id:'action-pipeline-renewal',commitmentId:'pipeline-seats',type:'accept_amendment',payload:{amendmentId:'amendment-pipeline-renewal'}},
    {id:'action-orbit-renewal',commitmentId:'orbit-renewal',type:'accept_amendment',payload:{amendmentId:'amendment-orbit-renewal'}},
    {id:'action-nimbus-claim',commitmentId:'nimbus-sla',type:'prepare_claim',payload:{}},
  ].map(action=>({at:at('2026-10-28'),command:{type:'PROPOSE_ACTION',action}})),
];

export function createDemoWorkspace() {
  let state=createWorkspace({id:'truthful-assurance-demo'});
  for(const [index,step] of demoCommands.entries()) state=reduceWorkspace(state,{id:`seed-${index+1}`,...step.command},{actor:{id:'seed-curator',role:'admin'},now:step.at}).state;
  return state;
}
