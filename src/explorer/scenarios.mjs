import {createWorkspace,reduceWorkspace} from '../assurance/core.mjs';
const start='2026-10-29T12:00:00.000Z';
export const actors={analyst:{id:'fixture-analyst',role:'analyst'},approver:{id:'fixture-finance',role:'approver'},executor:{id:'fixture-executor',role:'executor'}};
const command=(id,type,fields={})=>({id,type,...fields});
const step=(id,kind,cmd,extra={})=>({id,kind,command:cmd,...extra});
const agent=(id,actor,steps)=>({id,actor:actors[actor],steps});
function fixture({credit=false,deadline=false,amendment=false}={}) {
 let state=createWorkspace({id:'synthetic-exploration'});
 const commands=[{type:'ADD_VENDOR',vendor:{id:'vendor',name:'SYNTHETIC vendor'}},{type:'ADD_SOURCE',source:{id:'source',vendorId:'vendor',title:'SYNTHETIC fixture evidence',kind:'invoice',text:'SYNTHETIC: promise and applied invoice, USD 900. Not authenticated vendor evidence.'}},{type:'CREATE_COMMITMENT',commitment:{id:'claim',vendorId:'vendor',reference:'SYNTH-900',currency:'USD',promisedCents:90000,dueDate:'2026-10-01',claimDeadline:deadline?'2026-10-30':null,conditions:[],sourceIds:['source']}}];
 if(credit) commands.push({type:'REGISTER_CREDIT',credit:{id:'credit',invoiceId:'invoice',vendorId:'vendor',currency:'USD',reference:'SYNTH-900',amountCents:90000,status:'applied',sourceIds:['source']}});
 else {
 if(amendment)commands.push({type:'PROPOSE_AMENDMENT',amendment:{id:'date-a',commitmentId:'claim',kind:'date_change',patch:{dueDate:'2026-11-15'},effectiveDate:'2026-10-29',sourceIds:['source']}});
 commands.push({type:'PROPOSE_ACTION',action:{id:'action',commitmentId:'claim',type:amendment?'accept_amendment':'prepare_claim',payload:amendment?{amendmentId:'date-a'}:{}}},{type:'APPROVE_ACTION',actionId:'action'});
 }
 commands.forEach((c,i)=>{state=reduceWorkspace(state,{id:`fixture-${i}`,...c},{actor:{id:'synthetic-fixture-curator',role:'admin'},now:start}).state;});
 return state;
}
export const scenarioCatalog=[
{id:'concurrent-credit',name:'Two consumers, one credit',description:'Two scripted analysts cache the same available balance, then attempt separate allocations.'},
{id:'stale-source',name:'Approval versus changed evidence',description:'A cached execution check races a source revision.'},
{id:'deadline-drift',name:'Authorization crosses a deadline',description:'A checked claim races an advance of the trusted simulation clock.'},
{id:'competing-amendments',name:'A competing amendment arrives',description:'A cached acceptance races a conflicting proposal against the same accepted terms.'},
{id:'benign-completion',name:'Legitimate completion',description:'An unchanged, approved claim executes successfully.'},
];
export function createScenario(id) {
 const metadata=scenarioCatalog.find(s=>s.id===id);if(!metadata)throw new Error(`Unknown exploration scenario: ${id}`);
 let initialState,agents,goal;
 if(id==='concurrent-credit') {
 initialState=fixture({credit:true});agents=['a','b'].map(key=>agent(`consumer-${key}`,'analyst',[step(`check-${key}`,'check',command(`allocation-${key}`,'ALLOCATE_CREDIT',{allocationId:`allocation-${key}`,creditId:'credit',commitmentId:'claim',amountCents:90000})),step(`commit-${key}`,'commit',null,{checkId:`check-${key}`})]));goal={type:'credit_allocated',creditId:'credit',amountCents:90000};
 } else {
 initialState=fixture({deadline:id==='deadline-drift',amendment:id==='competing-amendments'});
 agents=[agent('workflow','executor',[step('check-action','check',command('execute','EXECUTE_ACTION',{actionId:'action'})),step('commit-action','commit',null,{checkId:'check-action'})])];goal={type:'action_executed',actionId:'action'};
 if(id==='stale-source') agents.push(agent('evidence-feed','analyst',[step('source-change','command',command('source-change','REVISE_SOURCE',{sourceId:'source',text:'SYNTHETIC changed evidence; the prior approval must be refreshed.'}))]));
 if(id==='deadline-drift')agents.push(agent('trusted-clock','analyst',[{id:'clock-change',kind:'advanceTime',now:'2026-10-31T12:00:00.000Z'}]));
 if(id==='competing-amendments') agents.push(agent('evidence-feed','analyst',[step('competing-proposal','command',command('competing-proposal','PROPOSE_AMENDMENT',{amendment:{id:'date-b',commitmentId:'claim',kind:'date_change',patch:{dueDate:'2026-12-15'},effectiveDate:'2026-10-29',sourceIds:['source']}}))]));
 }
 return {...metadata,schemaVersion:1,fixture:'Authored synthetic evidence and scripted proposers; no LLM or external transaction.',initialState,initialNow:start,agents,goal,properties:['credit-conservation','current-authorization-at-effect']};
}
