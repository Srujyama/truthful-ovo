import {canonical,reduceWorkspace,evaluateWorkspace,validateWorkspace} from '../assurance/core.mjs';
import {createScenario,scenarioCatalog,actors} from './scenarios.mjs';
export {scenarioCatalog,createScenario};
const clone=x=>structuredClone(x);
export const DEFAULT_BOUNDS=Object.freeze({maxDepth:12,maxStates:2000,maxTransitions:6000,maxTimeMs:1500});
const PROPERTY_VERSION='effect-boundary-v1';
const limits='Finite authored model and supplied schedules only. No formal proof, live LLM benchmark, authenticated evidence, source completeness or external-service guarantee.';
async function digest(value){const data=new TextEncoder().encode(canonical(value));const bytes=await globalThis.crypto.subtle.digest('SHA-256',data);return [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');}
function resolve(input){return typeof input==='string'?createScenario(input):clone(input);}
function validatePlan(s){
 if(s?.schemaVersion!==1||!Array.isArray(s.agents)||s.agents.length<1||s.agents.length>8)throw new Error('Invalid bounded plan.');
 if(canonical(s.properties)!==canonical(['credit-conservation','current-authorization-at-effect']))throw new Error('Unsupported property set.');
 const ids=new Set();for(const a of s.agents){if(!a.actor||!['analyst','approver','executor','admin','viewer'].includes(a.actor.role)||typeof a.actor.id!=='string'||!Array.isArray(a.steps)||a.steps.length>30)throw new Error('Invalid agent.');for(const x of a.steps){if(typeof x.id!=='string'||!x.id||ids.has(x.id)||!['check','commit','command','advanceTime','atomic'].includes(x.kind))throw new Error('Invalid or duplicate step.');ids.add(x.id);}}
 for(const a of s.agents)for(const x of a.steps)for(const dep of x.after||[])if(!ids.has(dep))throw new Error('Unknown step dependency.');
 if(!['credit_allocated','action_executed'].includes(s.goal?.type))throw new Error('Unsupported goal.');
 if(s.goal.type==='action_executed'&&typeof s.goal.actionId!=='string')throw new Error('Action goal needs an actionId.');
 if(s.goal.type==='credit_allocated'&&(typeof s.goal.creditId!=='string'||!Number.isSafeInteger(s.goal.amountCents)||s.goal.amountCents<1))throw new Error('Credit goal needs a creditId and positive integer cents.');
 if(!Array.isArray(s.initialState?.events)||s.initialState.events.length>100||canonical(s).length>250000)throw new Error('Plan exceeds the supported 100 initial events or 250 KB input limit.');
 if(!validateWorkspace(s.initialState).valid)throw new Error('Invalid initial workspace.');
}
function initial(s){return {workspace:clone(s.initialState),now:s.initialNow,pc:s.agents.map(()=>0),cache:{},history:[],unsafeEffects:[],trace:[]};}
function context(a,n){return {actor:a.actor,now:n.now};}
function attempt(state,command,ctx){try{const result=reduceWorkspace(state,command,ctx);return {allowed:true,state:result.state,result:result.result};}catch(e){return {allowed:false,error:{code:e.code||'ERROR',message:e.message}};}}
function summary(n){const v=evaluateWorkspace(n.workspace,{asOf:n.now.slice(0,10),knownAt:n.now});return {now:n.now,revision:n.workspace.revision,materialRevision:v.materialRevision,credits:v.credits.map(c=>({id:c.id,availableCents:c.availableCents,allocatedCents:c.allocatedCents,unallocatedCents:c.unallocatedCents})),actions:v.actions.map(a=>({id:a.id,status:a.status,executed:a.executed})),amendments:v.amendments.map(a=>({id:a.id,accepted:a.accepted,rejected:a.rejected,conflictingAmendmentIds:a.conflictingAmendmentIds})),violations:validateWorkspace(n.workspace,{asOf:v.asOf,knownAt:n.now}).violations};}
function goal(s,n){const v=evaluateWorkspace(n.workspace,{asOf:n.now.slice(0,10),knownAt:n.now});return s.goal.type==='action_executed'?Boolean(v.actions.find(a=>a.id===s.goal.actionId)?.executed):v.credits.find(c=>c.id===s.goal.creditId)?.allocatedCents===s.goal.amountCents;}
function enabled(s,n,i){const x=s.agents[i].steps[n.pc[i]];return x&&(x.after||[]).every(id=>n.history.some(h=>h.stepId===id));}
function advance(s,node,i,mode){
 const n=clone(node),a=s.agents[i],x=a.steps[n.pc[i]],before=summary(n);let out={status:'observed'},command=x.command||null,oracle=null,effects=[];
 if(x.kind==='advanceTime'){if(x.now<n.now)throw new Error('Clock cannot move backwards.');n.now=x.now;out={status:'clock_advanced'};}
 else if(x.kind==='check'){
 const r=attempt(n.workspace,command,context(a,n));n.cache[x.id]={command,actor:a.actor,allowed:r.allowed,error:r.error||null,events:r.allowed?r.state.events.slice(n.workspace.events.length):[]};out=r.allowed?{status:'check_passed'}:{status:'check_rejected',error:r.error};
 } else {
 let cached=null;
 if(x.kind==='commit'){cached=n.cache[x.checkId];if(!cached)throw new Error('Commit needs a prior check.');command=cached.command;if(canonical(a.actor)!==canonical(cached.actor))throw new Error('A cached check cannot transfer actor authority.');}
 const r=attempt(n.workspace,command,context(a,n));oracle={allowed:r.allowed,error:r.error||null};
 if(mode==='naive'&&cached){
 if(cached.allowed){
 effects=cached.events.map((e,k)=>({...clone(e),id:`event-${n.workspace.revision+k+1}`,sequence:n.workspace.revision+k+1,observedAt:n.now,effectiveDate:e.type==='AMENDMENT_ACCEPTED'?e.effectiveDate:n.now.slice(0,10)}));
 n.workspace={...n.workspace,events:[...n.workspace.events,...effects],revision:n.workspace.revision+effects.length};out={status:'effect_committed',cachedCheck:true};
 }else out={status:'commit_blocked',error:cached.error};
 }else if(r.allowed){effects=r.state.events.slice(n.workspace.events.length);n.workspace=r.state;out={status:effects.length?'effect_committed':'idempotent',cachedCheck:false};}
 else out={status:'commit_rejected',error:r.error};
 if(effects.length&&!r.allowed)n.unsafeEffects.push({stepId:x.id,property:'current-authorization-at-effect',reason:r.error.code,events:effects.map(e=>e.id)});
 const invariant=validateWorkspace(n.workspace,{asOf:n.now.slice(0,10),knownAt:n.now});
 if(effects.length&&!invariant.valid)n.unsafeEffects.push({stepId:x.id,property:'credit-conservation',reason:invariant.violations.join('; '),events:effects.map(e=>e.id)});
 }
 n.pc[i]++;const entry={agentId:a.id,stepId:x.id,kind:x.kind,actor:clone(a.actor),now:n.now,command:clone(command),...out,oracle,effects:clone(effects),before,after:summary(n)};
 n.history.push({agentId:a.id,stepId:x.id,status:out.status,error:out.error||null});n.trace.push(entry);return n;
}
function replay(s,schedule,mode){let n=initial(s);for(const id of schedule){const i=s.agents.findIndex((a,j)=>enabled(s,n,j)&&a.steps[n.pc[j]].id===id);if(i<0)throw new Error('Schedule violates program order or dependencies.');n=advance(s,n,i,mode);}return n;}
function retained(n){return n?{schedule:n.trace.map(x=>x.stepId),trace:n.trace,finalState:n.workspace,unsafeEffects:n.unsafeEffects}:null;}
function validateRetained(s,w,mode){if(!w)return;const n=replay(s,w.schedule,mode);if(canonical(retained(n))!==canonical(w))throw new Error('Trace, state or effect does not match independent schedule replay.');return n;}
export async function explorePlan(input,options={}){return explore(input,options);}
async function explore(input,{mode='guarded',bounds={}}={},replayPrefix=null){
 const scenario=resolve(input);validatePlan(scenario);if(!['naive','guarded'].includes(mode))throw new Error('Unknown execution mode.');
 const b={...DEFAULT_BOUNDS,...bounds};const caps={maxDepth:40,maxStates:10000,maxTransitions:30000,maxTimeMs:10000};for(const k of Object.keys(DEFAULT_BOUNDS))if(!Number.isSafeInteger(b[k])||b[k]<1||b[k]>caps[k])throw new Error(`Invalid bound ${k}: use an integer from 1 to ${caps[k]}.`);
 const began=performance.now(),queue=[initial(scenario)],seen=new Set();let cursor=0,transitions=0,deduplicatedStates=0,terminalSchedules=0,goalSchedules=0,safeGoalSchedules=0,unsafeSchedules=0,rejectedEffectAttempts=0,committedEffectTransitions=0,unauthorizedEffectTransitions=0,deadlockedSchedules=0,cutoffReason=null,depthCutoff=false,witness=null,rejection=null,completion=null;
 while(cursor<queue.length){
 if(replayPrefix!==null&&cursor>=replayPrefix){cutoffReason='maxTimeMs';break;}
 if(performance.now()-began>=(replayPrefix===null?b.maxTimeMs:10000)){cutoffReason='maxTimeMs';break;}
 const node=queue[cursor++];
 const indices=scenario.agents.map((_,i)=>i).filter(i=>enabled(scenario,node,i));
 if(indices.length===0){terminalSchedules++;if(node.pc.some((pc,i)=>pc<scenario.agents[i].steps.length))deadlockedSchedules++;const g=goal(scenario,node);if(g){goalSchedules++;if(!completion)completion=node;if(!node.unsafeEffects.length)safeGoalSchedules++;}if(node.unsafeEffects.length)unsafeSchedules++;continue;}
 if(node.trace.length>=b.maxDepth){depthCutoff=true;continue;}
 for(const i of indices){
 if(transitions>=b.maxTransitions){cutoffReason='maxTransitions';break;}
 if(queue.length>=b.maxStates){cutoffReason='maxStates';break;}
 const next=advance(scenario,node,i,mode);transitions++;const last=next.trace.at(-1);if(last.status==='commit_rejected'||last.status==='commit_blocked')rejectedEffectAttempts++;if(last.effects.length)committedEffectTransitions++;if(next.unsafeEffects.length>node.unsafeEffects.length)unauthorizedEffectTransitions++;
 if(next.unsafeEffects.length&&!witness)witness=next;
 if(next.trace.at(-1).status==='commit_rejected'&&!rejection)rejection=next;
 // Full event history, observations, checks, clock, caches and PCs are retained;
 // no unsafe merging based only on balances or a truncated hash.
 const key=canonical({workspace:next.workspace,now:next.now,pc:next.pc,cache:next.cache,history:next.history,unsafeEffects:next.unsafeEffects});
 if(seen.has(key)){deduplicatedStates++;continue;}seen.add(key);queue.push(next);
 }
 if(cutoffReason)break;
 }
 if(!cutoffReason&&depthCutoff)cutoffReason='maxDepth';
 const exhaustiveWithinBounds=!cutoffReason;
 const packet={schemaVersion:1,kind:'truthful-bounded-exploration',propertyVersion:PROPERTY_VERSION,scenario,mode,bounds:b,baselineLabel:mode==='naive'?'Intentionally naive cached-check teaching harness':'Actual v3 assurance reducer at every effect',status:witness?'unsafe_effect_found':exhaustiveWithinBounds?'no_unsafe_effect_within_bounds':'inconclusive',shortestWitness:retained(witness),guardedRejection:retained(rejection),sameScheduleGuardedReplay:mode==='naive'&&witness?retained(replay(scenario,witness.trace.map(x=>x.stepId),'guarded')):null,completionTrace:retained(completion),stats:{exploredStates:cursor,discoveredStates:queue.length,transitions,deduplicatedStates,terminalSchedules,unsafeSchedules,rejectedEffectAttempts,committedEffectTransitions,unauthorizedEffectTransitions,deadlockedSchedules,frontierStates:queue.length-cursor,cutoffReason,exhaustiveWithinBounds,inconclusive:!exhaustiveWithinBounds},goalCompletion:{completedSchedules:goalSchedules,safeCompletedSchedules:safeGoalSchedules,blockedOrIncompleteSchedules:terminalSchedules-goalSchedules,terminalSchedules},claim:limits};
 if(packet.shortestWitness){const n=validateRetained(scenario,packet.shortestWitness,mode);if(!n.unsafeEffects.length)throw new Error('Witness has no actual unsafe effect.');}
 validateRetained(scenario,packet.sameScheduleGuardedReplay,'guarded');validateRetained(scenario,packet.guardedRejection,mode);validateRetained(scenario,packet.completionTrace,mode);
 packet.digest=await digest(packet);return packet;
}
export function repairPlan(input){
 const s=resolve(input);validatePlan(s);
 const metadata=scenarioCatalog.find(x=>x.id===s.id);if(!metadata)return null;
 const base=createScenario(s.id);
 if(s.repair){const expected=repairPlan(base);return canonical(s)===canonical(expected)?s:null;}
 if(canonical(s)!==canonical(base))return null;
 if(s.id==='concurrent-credit'){
 s.agents=s.agents.map(a=>({...a,steps:[{id:`atomic-${a.id}`,kind:'atomic',command:clone(a.steps.find(x=>x.kind==='check').command)}]}));s.repair={operation:'atomic_check_commit_preserving_distinct_intents',rationale:'Preserve both distinct allocation commands and IDs. Each current-state reducer call atomically checks capacity and commits; the first consumes USD 900 and the second is rejected. No intents are merged and no idempotency deduplication is assumed.'};
 }else if(s.id==='deadline-drift'){
 s.agents[0].steps=[{id:'atomic-execute',kind:'atomic',command:{id:'atomic-execute',type:'EXECUTE_ACTION',actionId:'action'}}];s.repair={operation:'atomic_commit_with_deadline_recheck',rationale:'The adversarial clock remains eligible in either order. Execution before expiry can complete; execution after expiry is rejected. This is partial completion, not a universal deadline repair, and no external event is reordered or deadline extended.'};
 }else if(s.id==='stale-source'||s.id==='competing-amendments'){
 const feed=s.agents[1];let after=feed.steps.at(-1).id;
 const additions=[];
 if(s.id==='competing-amendments'){additions.push({id:'finance-resolution',actor:actors.approver,steps:[{id:'dismiss-conflict',kind:'command',after:[after],command:{id:'dismiss-conflict',type:'DISMISS_AMENDMENT',amendmentId:'date-b',reason:'SYNTHETIC approver decision: decline the conflicting alternative and retain date-a.'}}]});after='dismiss-conflict';}
 additions.push({id:'fresh-proposer',actor:actors.analyst,steps:[{id:'fresh-proposal',kind:'command',after:[after],command:{id:'fresh-proposal',type:'PROPOSE_ACTION',action:{id:'fresh-action',commitmentId:'claim',type:s.id==='stale-source'?'prepare_claim':'accept_amendment',payload:s.id==='stale-source'?{}:{amendmentId:'date-a'}}}}]}, {id:'fresh-finance',actor:actors.approver,steps:[{id:'fresh-approval',kind:'command',after:['fresh-proposal'],command:{id:'fresh-approval',type:'APPROVE_ACTION',actionId:'fresh-action'}}]}, {id:'fresh-executor',actor:actors.executor,steps:[{id:'fresh-execution',kind:'atomic',after:['fresh-approval'],command:{id:'fresh-execution',type:'EXECUTE_ACTION',actionId:'fresh-action'}}]});
 s.agents=[feed,...additions];s.goal={type:'action_executed',actionId:'fresh-action'};s.repair={operation:'refresh_then_authorized_reapproval_and_atomic_commit',rationale:'Explicit fixture analyst proposes after the source change; the distinct fixture finance approver approves; executor commits through the current reducer. No executor approval or new vendor evidence is invented.'};
 }else {s.agents[0].steps=[{id:'atomic-execute',kind:'atomic',command:{id:'atomic-execute',type:'EXECUTE_ACTION',actionId:'action'}}];s.repair={operation:'atomic_check_commit',rationale:'Execute the unchanged approved action through the actual reducer.'};}
 s.name=`${s.name} — explicit repair`;return s;
}
export async function compareScenario(input,{bounds={}}={}){const scenario=resolve(input);const naive=await explorePlan(scenario,{mode:'naive',bounds});const guarded=await explorePlan(scenario,{mode:'guarded',bounds});const plan=repairPlan(scenario);const report=plan?await explorePlan(plan,{mode:'guarded',bounds}):null;return {scenario,naive,guarded,repair:plan?{plan,report}:null,repairReason:plan?null:'No template repair applies to this custom or modified plan. Explore and replay its proposed operations; an authorized actor must supply an explicit revised plan.'};}

function validateReportShape(p){
 const st=p.stats,g=p.goalCompletion,b=p.bounds;
 if(!st||!g||!b)throw new Error('Missing bounded exploration report.');
 const caps={maxDepth:40,maxStates:10000,maxTransitions:30000,maxTimeMs:10000};
 for(const [key,max] of Object.entries(caps))if(!Number.isSafeInteger(b[key])||b[key]<1||b[key]>max)throw new Error('Invalid resource bound.');
 for(const key of ['exploredStates','discoveredStates','transitions','deduplicatedStates','terminalSchedules','unsafeSchedules','rejectedEffectAttempts','committedEffectTransitions','unauthorizedEffectTransitions','deadlockedSchedules','frontierStates'])if(!Number.isSafeInteger(st[key])||st[key]<0)throw new Error('Invalid exploration count.');
 for(const key of ['completedSchedules','safeCompletedSchedules','blockedOrIncompleteSchedules','terminalSchedules'])if(!Number.isSafeInteger(g[key])||g[key]<0)throw new Error('Invalid goal count.');
 if(![null,'maxTimeMs','maxDepth','maxStates','maxTransitions'].includes(st.cutoffReason))throw new Error('Unknown cutoff reason.');
 const cut=st.cutoffReason!==null;
 if(st.inconclusive!==cut||st.exhaustiveWithinBounds===cut||typeof st.exhaustiveWithinBounds!=='boolean')throw new Error('Cutoff cannot establish exhaustive safety.');
 const status=p.shortestWitness?'unsafe_effect_found':cut?'inconclusive':'no_unsafe_effect_within_bounds';
 if(p.status!==status)throw new Error('Status contradicts witness or cutoff.');
 if(st.exploredStates>st.discoveredStates||st.discoveredStates>b.maxStates||st.transitions>b.maxTransitions||st.frontierStates!==st.discoveredStates-st.exploredStates||st.discoveredStates>st.transitions+1||st.terminalSchedules>st.exploredStates||st.unsafeSchedules>st.terminalSchedules)throw new Error('Counts exceed the declared bounded search.');
 if(g.terminalSchedules!==st.terminalSchedules||g.completedSchedules+g.blockedOrIncompleteSchedules!==st.terminalSchedules||g.safeCompletedSchedules>g.completedSchedules)throw new Error('Goal counts are inconsistent.');
 if(st.rejectedEffectAttempts>st.transitions||st.committedEffectTransitions>st.transitions||st.unauthorizedEffectTransitions>st.committedEffectTransitions)throw new Error('Effect counts are inconsistent.');
 if(Boolean(p.shortestWitness)!==Boolean(st.unauthorizedEffectTransitions))throw new Error('Unsafe-effect counts and witness disagree.');
 if(p.mode==='guarded'&&(st.unsafeSchedules||st.unauthorizedEffectTransitions))throw new Error('Guarded report claims an unsafe effect.');
 if(p.shortestWitness?.schedule.length>b.maxDepth)throw new Error('Witness exceeds depth bound.');
}

export async function verifyExplorationPacket(packet){
 const errors=[];try{
 if(packet?.kind!=='truthful-bounded-exploration'||packet.schemaVersion!==1||packet.propertyVersion!==PROPERTY_VERSION)throw new Error('Unsupported packet/property version.');
 const {digest:expected,...body}=packet;if(await digest(body)!==expected)throw new Error('Packet digest mismatch (plan, property, trace or report changed).');
 validatePlan(packet.scenario);
 if(!['naive','guarded'].includes(packet.mode))throw new Error('Unsupported packet execution mode.');
 validateReportShape(packet);
 for(const key of ['shortestWitness','guardedRejection','completionTrace'])validateRetained(packet.scenario,packet[key],packet.mode);validateRetained(packet.scenario,packet.sameScheduleGuardedReplay,'guarded');
 if(packet.shortestWitness&&!packet.shortestWitness.unsafeEffects.length)throw new Error('Unsafe witness lacks an unsafe effect.');
 if(packet.shortestWitness){const n=validateRetained(packet.scenario,packet.shortestWitness,packet.mode);if(!n.unsafeEffects.length)throw new Error('Witness is not an actual unsafe effect.');}
 if(packet.sameScheduleGuardedReplay&&(packet.sameScheduleGuardedReplay.unsafeEffects.length||canonical(packet.sameScheduleGuardedReplay.schedule)!==canonical(packet.shortestWitness?.schedule)))throw new Error('Paired guarded replay is unsafe or uses a different schedule.');
 if(packet.mode==='guarded'&&packet.shortestWitness)throw new Error('Guarded execution unexpectedly contains an unsafe effect.');
 // Replay the deterministic BFS prefix, including time-cutoff accounting.
 // Wall time determines how many whole states were expanded; that count is a
 // replayable prefix boundary, not permission to trust any claimed outcome.
 const prefix=packet.stats.cutoffReason==='maxTimeMs'?packet.stats.exploredStates:null;
 const rerun=await explore(packet.scenario,{mode:packet.mode,bounds:{...packet.bounds,maxTimeMs:prefix===null?10000:packet.bounds.maxTimeMs}},prefix);
 for(const key of ['status','baselineLabel','claim','shortestWitness','guardedRejection','sameScheduleGuardedReplay','completionTrace','stats','goalCompletion'])if(canonical(rerun[key])!==canonical(packet[key]))throw new Error(`Exploration report differs on ${key}.`);
 }catch(e){errors.push(e.message);}return {valid:errors.length===0,errors};
}
