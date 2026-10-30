import {canonical,evaluateWorkspace,reduceWorkspace,validateWorkspace} from '../assurance/core.mjs';

function fail(code,message){const error=new Error(message);error.code=code;throw error;}
function instant(value){
 if(typeof value!=='string'||!value.includes('T')||!/(Z|[+-]\d{2}:\d{2})$/.test(value)||!Number.isFinite(Date.parse(value)))fail('INVALID_TIME','Supply a valid simulation time with an explicit timezone.');
 return new Date(value).toISOString();
}

/** Build an inert finite exploration plan from an actual approved portfolio snapshot.
 * No reducer result is written back, no approval is created, and no API is called.
 */
export function createPortfolioScenario(workspace,{actionId,adversary='none',now}={}){
 if(!workspace||workspace.schemaVersion!==1||!Array.isArray(workspace.events))fail('INVALID_WORKSPACE','Select a valid portfolio workspace before building an exploration plan.');
 if(typeof actionId!=='string'||!actionId.trim())fail('INVALID_ACTION','Select an existing approved portfolio action.');
 if(!['none','source_revision','deadline'].includes(adversary))fail('INVALID_ADVERSARY','Choose none, source_revision, or deadline as the finite simulated adversary.');
 if(workspace.events.length>100)fail('PLAN_LIMIT','This bounded explorer supports at most 100 initial events; this portfolio snapshot exceeds that limit.');
 const latest=workspace.events.at(-1)?.observedAt;
 const initialNow=instant(now);
 if(latest&&initialNow<latest)fail('INCONSISTENT_TIME','Simulation time cannot precede the portfolio snapshot’s latest recorded observation.');
 const snapshot=structuredClone(workspace);
 const options={asOf:initialNow.slice(0,10),knownAt:initialNow};
 const invariant=validateWorkspace(snapshot,options);
 if(!invariant.valid)fail('INVALID_WORKSPACE',`The portfolio snapshot fails its accounting checks: ${invariant.violations.join('; ')}`);
 const view=evaluateWorkspace(snapshot,options),action=view.actions.find(a=>a.id===actionId);
 if(!action)fail('ACTION_NOT_FOUND',`Action ${actionId} does not belong to this portfolio snapshot.`);
 if(action.executed||action.status==='executed')fail('ACTION_EXECUTED','This action has already executed. Select an unexecuted approved action.');
 if(!action.approval)fail('ACTION_UNAPPROVED','Finance must approve the existing action in the portfolio before it can be explored as approved.');
 if(action.proposalStale||action.approvalStale||action.status==='stale')fail('STALE_APPROVAL','This action’s approval no longer matches the current portfolio basis. Refresh and obtain a real approval in the portfolio first.');
 const commitment=view.commitments.find(c=>c.id===action.commitmentId);
 if(!commitment)fail('ACTION_NOT_FOUND','The action’s commitment is not present in this portfolio snapshot.');
 if(adversary==='deadline'){
 if(action.type!=='prepare_claim')fail('DEADLINE_NOT_APPLICABLE','Deadline exploration requires a prepare_claim action; this action does not use the claim-deadline policy boundary.');
 if(!commitment.claimDeadline)fail('DEADLINE_UNAVAILABLE','This commitment has no recorded claim deadline; no deadline is invented for exploration.');
 if(commitment.deadline.state==='expired')fail('DEADLINE_EXPIRED','The actual claim deadline has already expired at the supplied simulation time.');
 }
 if(!action.policyDecision.allowed||action.status!=='approved')fail('POLICY_BLOCKED',`The approved action is not currently executable: ${action.policyDecision.reasons.join('; ')}`);
 const vendor=view.vendors.find(v=>v.id===commitment.vendorId);
 const used=new Set(snapshot.events.map(e=>e.commandId));
 const stem=`portfolio-sim-${snapshot.revision}-${actionId.replace(/[^a-zA-Z0-9_-]/g,'-').slice(0,70)}`;
 function commandId(label){let value=`${stem}-${label}`,suffix=0;while(used.has(value))value=`${stem}-${label}-${++suffix}`;used.add(value);return value;}
 const execute={id:commandId('execute'),type:'EXECUTE_ACTION',actionId};
 const executor={id:'hypothetical-portfolio-executor',role:'executor'};
 // The actual reducer is the authority on the approval/current-basis match.
 // This result is discarded; it only validates readiness on the cloned snapshot.
 try{reduceWorkspace(snapshot,execute,{actor:executor,now:initialNow});}
 catch(error){fail(error.code||'ACTION_NOT_EXECUTABLE',`The current reducer cannot execute this approval: ${error.message}`);}
 const agents=[{id:'portfolio-action',actor:executor,steps:[{id:'portfolio-check',kind:'check',command:execute},{id:'portfolio-commit',kind:'commit',command:null,checkId:'portfolio-check'}]}];
 let hypotheticalSource=null,deadlineAdvance=null;
 if(adversary==='source_revision'){
 const amendment=view.amendments.find(a=>a.id===action.payload?.amendmentId);
 const supportingIds=[...(amendment?.sourceLinks||[]),...(commitment.sourceLinks||[])].map(l=>l.sourceId);
 const source=view.sources.filter(s=>supportingIds.includes(s.id)).sort((a,b)=>b.revision-a.revision||a.id.localeCompare(b.id))[0];
 if(!source)fail('SOURCE_UNAVAILABLE','The action has no recorded supporting source to revise in the simulation copy.');
 const text=`HYPOTHETICAL SIMULATION ONLY: an adversarial source revision arrives after approval. This is not new vendor evidence and is never saved to the portfolio.\n\n${source.text}`;
 if(text.length>250000)fail('SOURCE_LIMIT','The selected source is too large to add the explicit hypothetical simulation label.');
 hypotheticalSource={id:source.id,revision:source.revision};
 agents.push({id:'hypothetical-source-feed',actor:{id:'hypothetical-portfolio-analyst',role:'analyst'},steps:[{id:'portfolio-source-revision',kind:'command',command:{id:commandId('source-revision'),type:'REVISE_SOURCE',sourceId:source.id,text}}]});
 }
 if(adversary==='deadline'){
 const date=new Date(`${commitment.claimDeadline}T00:00:00.000Z`);date.setUTCDate(date.getUTCDate()+1);
 deadlineAdvance=date.toISOString();
 if(!/^\d{4}-/.test(deadlineAdvance))fail('DEADLINE_LIMIT','This deadline cannot be advanced within the bounded model’s four-digit calendar.');
 if(deadlineAdvance<=initialNow)fail('INCONSISTENT_TIME','A deadline adversary must move the simulation clock forward beyond the actual claim deadline.');
 agents.push({id:'hypothetical-clock',actor:{id:'hypothetical-portfolio-clock',role:'analyst'},steps:[{id:'portfolio-deadline-advance',kind:'advanceTime',now:deadlineAdvance}]});
 }
 const sourceRevisionIds=view.sources.map(s=>({id:s.id,revision:s.revision})).sort((a,b)=>a.id.localeCompare(b.id));
 const assumptionNotice='Portfolio snapshot copy only. Existing recorded finance approval is reused without creating another approval. Executor and analyst roles are explicit hypothetical model assumptions, not authenticated grants. Source revisions and clock movement are hypothetical, finite simulation inputs; no source fact, message, payment, or live portfolio mutation is produced. Replay checks this contained state and supplied schedules, not source authenticity or completeness.';
 const scenario={
 schemaVersion:1,id:`portfolio-copy:${actionId}:${adversary}`,name:`Portfolio copy: ${vendor?.name||commitment.vendorId} / ${commitment.reference}`,
 description:`Explore the actual approved ${action.type} action against ${adversary==='none'?'no additional adversary':adversary==='deadline'?'a clock advance beyond its recorded deadline':'one explicitly hypothetical revision of a recorded supporting source'}.`,
 fixture:'Actual recorded portfolio snapshot; proposed execution and adversarial inputs are hypothetical simulation only.',
 initialState:snapshot,initialNow,agents,goal:{type:'action_executed',actionId},properties:['credit-conservation','current-authorization-at-effect'],
 metadata:{origin:'portfolio-copy',workspaceId:snapshot.id,actionId,actionType:action.type,vendorId:commitment.vendorId,vendorName:vendor?.name||commitment.vendorId,reference:commitment.reference,snapshotRevision:snapshot.revision,sourceRevisionIds,approvalBasis:structuredClone(action.approval.basis),hypotheticalSource,deadlineAdvance,assumptionNotice},
 };
 if(canonical(scenario).length>250000)fail('PLAN_LIMIT','This copied portfolio plan exceeds the explorer’s 250 KB finite-input limit.');
 return scenario;
}
