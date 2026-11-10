import {evaluateWorkspace} from '../assurance/index.mjs';
import {operationQueue,eventLabel} from '../operations.mjs';
import {reviewFiles} from '../review-display.mjs';

export const STATIONS=Object.freeze([
 {id:'archive',name:'Documents',short:'Archive',kind:'archive',x:250,y:245,description:'Original documents and their saved versions.',section:'library'},
 {id:'review',name:'Reviews',short:'Review',kind:'review',x:570,y:205,description:'Follow-ups waiting for a decision.',section:'assurance'},
 {id:'exchange',name:'Credits',short:'Credits',kind:'exchange',x:845,y:305,description:'Credit notes and invoice adjustments.',section:'assurance'},
 {id:'vault',name:'Completed',short:'Verified',kind:'vault',x:900,y:530,description:'Follow-ups fully covered by invoice credits.',section:'reports'},
 {id:'lab',name:'Workflow tests',short:'Execution',kind:'lab',x:580,y:525,description:'Approved actions and workflow checks.',section:'execution'},
 {id:'dispatch',name:'Tasks',short:'Dispatch',kind:'dispatch',x:285,y:485,description:'What needs your attention next.',section:'operations'},
]);
export const money=cents=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:cents%100?2:0,maximumFractionDigits:2}).format((cents||0)/100);
export const exactMoney=cents=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format((cents||0)/100);
export function eventRoute(event,view){
 if(!event)return null;
 const routes={SOURCE_ADDED:['archive','archive'],SOURCE_REVISED:['archive','review'],COMMITMENT_CREATED:['archive','dispatch'],AMENDMENT_PROPOSED:['archive','review'],AMENDMENT_ACCEPTED:['review','archive'],ACTION_PROPOSED:['dispatch','review'],ACTION_APPROVED:['review','lab'],ACTION_EXECUTED:['lab','review'],CREDIT_REGISTERED:['archive','exchange'],CREDIT_APPLIED:['exchange','exchange'],CREDIT_REVERSED:['vault','exchange']};
 let route=routes[event.type];
 if(event.type==='CREDIT_ALLOCATED'){const credit=view.credits.find(c=>c.id===event.payload.allocation.creditId);route=['exchange',credit?.status==='applied'&&!credit.quarantined?'vault':'exchange'];}
 return route?{from:STATIONS.find(s=>s.id===route[0]),to:STATIONS.find(s=>s.id===route[1]),eventId:event.id}:null;
}
export function deriveClearingHouse(workspace,context={}){
 if(!workspace)return {view:null,stations:STATIONS.map(s=>({...s,count:0,items:[],state:'empty'})),queue:[],activity:[],totals:null};
 const now=new Date().toISOString();
 const view=evaluateWorkspace(workspace,{asOf:now.slice(0,10),knownAt:`${now.slice(0,10)}T23:59:59.999Z`,...context}),queue=operationQueue(view);
 const vendor=id=>view.vendors.find(v=>v.id===id)?.name||'Unknown vendor';
 const commitment=id=>view.commitments.find(c=>c.id===id);
 const caseItem=(c,details={})=>({id:c.id,commitmentId:c.id,name:vendor(c.vendorId),reference:c.reference,amountCents:c.outstandingCents,destination:'portfolio',...details});
 const review=reviewFiles(view).filter(a=>!a.executed&&commitment(a.commitmentId)).map(a=>caseItem(commitment(a.commitmentId),{id:a.id,actionId:a.id,destination:'decisions',label:a.type.replaceAll('_',' '),state:a.status,reason:a.policyDecision.reasons.join(' ')}));
 const items={
  archive:view.sources.map(s=>({id:`${s.id}@${s.revision}`,sourceId:s.id,revision:s.revision,name:s.title,reference:`${vendor(s.vendorId)} · revision ${s.revision}`,destination:'evidence',commitmentId:view.commitments.find(c=>c.sourceLinks.some(l=>l.sourceId===s.id&&l.revision===s.revision))?.id||null})),
  review,
  exchange:view.credits.map(c=>({id:c.id,vendorId:c.vendorId,name:c.invoiceId,reference:`${vendor(c.vendorId)} · ${c.lineId||c.reference}`,amountCents:c.availableCents,creditId:c.id,state:c.quarantined?'Needs clarification':c.status==='issued'?'Issued, not applied':'Applied on invoice',commitmentIds:[...new Set([...c.allocations.map(a=>a.commitmentId),...c.candidateCommitmentIds])].filter(id=>commitment(id)),destination:'ledger'})),
  vault:view.commitments.filter(c=>c.status==='verified').map(c=>caseItem(c,{amountCents:c.verifiedCents,destination:'history',state:'Fulfilled'})),
  lab:view.actions.filter(a=>a.status==='approved').map(a=>caseItem(commitment(a.commitmentId),{id:a.id,actionId:a.id,destination:'execution',state:'Approved exact action'})),
  dispatch:queue.map(q=>({id:q.id,commitmentId:q.commitmentId,actionId:q.actionId,name:q.vendorName,reference:q.reference,amountCents:q.amountCents,label:q.title,reason:q.reason,destination:q.destination})),
 };
 const stations=STATIONS.map(s=>({...s,items:items[s.id],count:items[s.id].length,state:items[s.id].length?'recorded':'empty'}));
 const activity=workspace.events.filter(e=>e.observedAt<=view.knownAt).slice(-4).reverse().map(e=>({id:e.id,label:eventLabel(e.type),at:e.observedAt,actor:e.actor,financialDate:e.effectiveDate}));
 return {view,stations,queue,activity,totals:view.totals,transition:eventRoute(workspace.events.filter(e=>e.observedAt<=view.knownAt).at(-1),view)};
}
