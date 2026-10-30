import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Activity, ArrowDownToLine, ArrowRight, ArrowUpRight, Beaker, Check, CheckCheck, ChevronDown, ChevronRight, CircleHelp, Clock3, Database, FileCheck2, FileText, GitBranch, History, Layers3, LockKeyhole, Play, Plus, RefreshCw, RotateCcw, Search, ShieldCheck, ShieldX, Terminal, X, AlertTriangle } from 'lucide-react';
import { evaluateWorkspace, runScenario, scenarios, validateWorkspace } from './assurance/index.mjs';
import { moneyToCents } from './engine/index.mjs';
import { compareRenewal } from './economics.mjs';
import {ResponsiveDetails} from './ui.jsx';
import { batchMutationReason, mutationReason, originalReviewState, resolveEvidenceNode, selectDecisionAction } from './assurance-ui.mjs';
import './assurance.css';

const money = cents => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(cents/100);
const today = () => new Date().toISOString().slice(0,10);
const dateLabel = value => value ? new Date(`${value.slice(0,10)}T12:00:00Z`).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : 'No deadline';
const statusNames = {open:'Open',partial:'Partly applied',issued:'Issued, not applied',scheduled:'Not due yet',conditional:'Conditional',verified:'Applied',deadline_expired:'Deadline passed',proposed:'Needs approval',approved:'Approved',stale:'Approval out of date',blocked:'Blocked',executed:'Recorded'};
const actionNames = {prepare_claim:'Prepare original claim',preserve_original:'Preserve original terms',accept_amendment:'Accept proposed amendment'};
const commandName = type => type.toLowerCase().replaceAll('_',' ').replace(/^./,c=>c.toUpperCase());
const vendorFor = (view,c) => view.vendors.find(v=>v.id===c?.vendorId)?.name || 'Unknown vendor';

function download(value,filename) {
  const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function Status({value}) { return <span className={`assurance-status ${value}`}><span/>{statusNames[value] || value}</span>; }
function MutationReason({children}) { return children ? <p className="mutation-reason" role="status">{children}</p> : null; }
const writeReason = (service, readOnly, type) => mutationReason(type, service.actor.role, {readOnly, busy:service.busy});

function EvidenceGraph({view,commitment,onSource}) {
  const container=useRef(null);
  const [paths,setPaths]=useState([]);
  const selected=useMemo(()=>{
    if(!commitment)return {nodes:[],edges:[]};
    const ids=new Set([`commitment:${commitment.id}`]);
    const relatedActions=view.actions.filter(a=>a.commitmentId===commitment.id);
    const relatedAmendments=view.amendments.filter(a=>a.commitmentId===commitment.id);
    const relatedCredits=view.credits.filter(c=>c.vendorId===commitment.vendorId&&c.reference===commitment.reference);
    for(const a of relatedActions){ids.add(`action:${a.id}`);if(a.approval)ids.add(`approval:${a.id}`);}
    for(const a of relatedAmendments){ids.add(`amendment:${a.id}`);if(a.dismissal)ids.add(`dismissal:${a.id}`);}
    for(const c of relatedCredits){ids.add(`credit:${c.id}`);for(const a of c.allocations)ids.add(`allocation:${a.id}`);}
    for(const edge of view.graph.edges)if(ids.has(edge.to)&&edge.from.startsWith('source:'))ids.add(edge.from);
    for(const edge of view.graph.edges)if(ids.has(edge.to)&&edge.from.startsWith('reversal:'))ids.add(edge.from);
    const nodes=view.graph.nodes.filter(n=>ids.has(n.id));
    return {nodes,edges:view.graph.edges.filter(e=>ids.has(e.from)&&ids.has(e.to))};
  },[view,commitment]);
  const signature=selected.nodes.map(n=>n.id).join('|')+selected.edges.length;
  useLayoutEffect(()=>{
    let frame;
    const measure=()=>{
      cancelAnimationFrame(frame);
      frame=requestAnimationFrame(()=>{
        if(!container.current)return;
        const parent=container.current.getBoundingClientRect(), positions=new Map();
        for(const element of container.current.querySelectorAll('[data-node]')){
          const r=element.getBoundingClientRect();positions.set(element.dataset.node,{x:r.x-parent.x,y:r.y-parent.y,w:r.width,h:r.height});
        }
        setPaths(selected.edges.flatMap(edge=>{
          const from=positions.get(edge.from),to=positions.get(edge.to);if(!from||!to)return [];
          const forward=to.x>=from.x;
          const x1=forward?from.x+from.w:from.x,x2=forward?to.x:to.x+to.w;
          const y1=from.y+from.h/2,y2=to.y+to.h/2,bend=(x2-x1)/2;
          return [{...edge,d:`M ${x1} ${y1} C ${x1+bend} ${y1}, ${x2-bend} ${y2}, ${x2} ${y2}`}];
        }));
      });
    };
    const observer=new ResizeObserver(measure);if(container.current)observer.observe(container.current);measure();
    return()=>{observer.disconnect();cancelAnimationFrame(frame);};
  },[signature]);
  const columns=[['Source',['source']],['Commitment',['commitment','amendment']],['Ledger',['credit','allocation','reversal']],['Authority',['action','approval','decision']]];
  function label(node){
    if(node.kind==='commitment')return vendorFor(view,commitment);
    if(node.kind==='action')return actionNames[view.actions.find(a=>`action:${a.id}`===node.id)?.type] || 'Action';
    if(node.kind==='amendment')return view.amendments.find(a=>`amendment:${a.id}`===node.id)?.kind==='renewal'?'Renewal proposal':'Date proposal';
    if(node.kind==='approval')return node.stale?'Stale approval':'Exact-action approval';
    if(node.kind==='allocation')return 'Allocated credit';
    if(node.kind==='decision')return 'Alternative dismissed';
    return node.label;
  }
  return <section className="lineage-section"><div className="assurance-section-title"><h3>Follow the evidence</h3><span>{selected.nodes.length} records connected</span></div><div className="lineage-map" ref={container}>
    <svg className="lineage-connectors" aria-hidden="true"><defs><marker id="lineage-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="4" markerHeight="4" orient="auto"><path d="M 0 0 L 8 4 L 0 8" fill="#657d5c"/></marker></defs>{paths.map(p=><path key={p.id} d={p.d} fill="none" stroke="#657d5c" strokeWidth="1.4" markerEnd="url(#lineage-arrow)"><title>{p.relation.replaceAll('_',' ')}</title></path>)}</svg>
    {columns.map(([heading,kinds])=><div className="lineage-column" key={heading}><h4>{heading}</h4>{selected.nodes.filter(n=>kinds.includes(n.kind)).map(node=><button key={node.id} data-node={node.id} className={`lineage-node ${node.kind}`} onClick={()=>onSource(node)} title={label(node)}><span>{node.kind==='source'?<FileText size={14}/>:node.kind==='approval'?<ShieldCheck size={14}/>:node.kind==='credit'?<FileCheck2 size={14}/>:<GitBranch size={14}/>}</span><strong>{label(node)}</strong><small>{node.amountCents != null?money(node.amountCents):node.kind==='source'?`Source revision ${node.revision}`:node.status?statusNames[node.status]||node.status:node.kind==='amendment'?(view.amendments.find(a=>`amendment:${a.id}`===node.id)?.rejected?'Dismissed':view.amendments.find(a=>`amendment:${a.id}`===node.id)?.basisStale?'Basis out of date':node.accepted?'Accepted':'Not accepted'):'Recorded link'}</small></button>)}</div>)}
  </div><details className="graph-accessible"><summary>Read the relationships<ChevronDown size={13}/></summary><ul>{selected.edges.map(edge=><li key={edge.id}>{label(selected.nodes.find(n=>n.id===edge.from))} <span>{edge.relation.replaceAll('_',' ')}</span> {label(selected.nodes.find(n=>n.id===edge.to))}</li>)}</ul></details></section>;
}

function SourceDetail({node,view,onClose,onSelect,service,readOnly,returnLabel}) {
  const source=node.kind==='source'?view.sourceVersions.find(s=>s.id===node.sourceId&&s.revision===node.revision):null;
  const latest=source?view.sources.find(s=>s.id===source.id):null;
  const isLatest=source?.revision===latest?.revision;
  const [text,setText]=useState(source?.text || '');
  const [editing,setEditing]=useState(false);
  const reason=writeReason(service,readOnly,'REVISE_SOURCE');
  async function save(){try{await service.command({type:'REVISE_SOURCE',sourceId:source.id,text});setEditing(false);onClose();}catch(e){service.setError(e.message);}}
  return <section className="assurance-source-detail" aria-label="Selected evidence record"><div className="assurance-section-title"><h3>{source?.title || node.label}</h3><button className="icon-button" aria-label="Close evidence record" onClick={onClose}><X size={17}/></button></div>
    {returnLabel&&<button className="text-button evidence-return" onClick={onClose}><ArrowRight size={13}/>{returnLabel}</button>}
    {source?<><div className="record-meta"><span>{source.kind.replaceAll('_',' ')}</span><span>Observed {dateLabel(source.observedAt)}</span><span>Revision {source.revision}</span></div>{editing?<><label htmlFor="source-revision">Revised source text</label><textarea id="source-revision" value={text} disabled={!!reason} onChange={e=>setText(e.target.value)} maxLength={250000}/><div className="assurance-inline-actions"><button className="button secondary" onClick={()=>setEditing(false)}>Cancel</button><button className="button primary" disabled={!!reason||!text.trim()} onClick={save}>Save source revision</button></div><MutationReason>{reason||(!text.trim()?'Enter supporting source text.':'')}</MutationReason></>:<><blockquote>{source.text}</blockquote>{isLatest&&<><button className="text-button" disabled={!!reason} onClick={()=>setEditing(true)}>Revise this source<ArrowRight size={13}/></button><MutationReason>{reason}</MutationReason></>}</>}{!isLatest&&latest&&<button className="text-button" onClick={()=>onSelect(`source:${latest.id}@${latest.revision}`)}>Open latest revision ({latest.revision})<ArrowRight size={13}/></button>}<p>A revision retains the earlier record and invalidates pending approvals that relied on the previous evidence.</p></>:node.kind==='source'?<p>This source revision is unavailable in this snapshot. Return to the review to select available evidence.</p>:<><pre>{JSON.stringify(node,null,2)}</pre><p>This is a recorded relationship. It does not authenticate the underlying document or counterparty.</p></>}
  </section>;
}

function RenewalComparison({economics}) {
  const [baseline,setBaseline]=useState(String((economics.baselineCostCents/1200).toFixed(2)));
  const [proposed,setProposed]=useState(String((economics.proposedRenewalCostCents/1200).toFixed(2)));
  const [months,setMonths]=useState('12');
  const comparison=useMemo(()=>{try{return compareRenewal({baselineMonthly:baseline,proposedMonthly:proposed,months,creditCents:economics.creditCents});}catch(error){return {error:error.message};}},[baseline,proposed,months,economics.creditCents]);
  return <details className="what-if"><summary>Change the comparison assumptions<ChevronDown size={14}/></summary><div className="what-if-inputs"><label>Baseline / month<input aria-label="Baseline monthly cost" inputMode="decimal" value={baseline} onChange={e=>setBaseline(e.target.value)}/></label><label>Offer / month<input aria-label="Proposed monthly cost" inputMode="decimal" value={proposed} onChange={e=>setProposed(e.target.value)}/></label><label>Months<input aria-label="Comparison months" inputMode="numeric" value={months} onChange={e=>setMonths(e.target.value)}/></label></div>{comparison.error?<p role="alert">{comparison.error}</p>:<div className="what-if-result"><span>Net value versus this baseline</span><strong className={comparison.netValueCents<0?'negative':'positive'}>{money(comparison.netValueCents)}</strong><small>{money(comparison.proposedCents)} proposed − {money(economics.creditCents)} credit versus {money(comparison.baselineCents)} baseline.</small></div>}<p>Scenario only. These inputs do not change the proposal, authorize a renewal, or forecast the value of additional service.</p></details>;
}

function DecisionRoom({view,service,readOnly,initialCommitment,initialAction,onPortfolio}) {
  const [selected,setSelected]=useState(initialAction || null);
  const [dismissalReason,setDismissalReason]=useState('');
  const [nodeId,setNodeId]=useState(null);
  const sourceOpener=useRef(null);
  const actions=view.actions.filter(a=>view.commitments.some(c=>c.id===a.commitmentId));
  const action=selectDecisionAction(view,{selectedActionId:selected,commitmentId:initialCommitment});
  const c=view.commitments.find(c=>c.id===(action?.commitmentId||initialCommitment)), amendment=view.amendments.find(m=>m.id===action?.payload.amendmentId);
  const alternatives=view.amendments.filter(m=>m.commitmentId===c?.id&&!m.accepted&&!m.rejected);
  const node=resolveEvidenceNode(view,nodeId);
  useLayoutEffect(()=>{if(nodeId&&!node)setNodeId(null);},[nodeId,node]);
  const proposalReason=writeReason(service,readOnly,'PROPOSE_ACTION');
  const dismissReason=writeReason(service,readOnly,'DISMISS_AMENDMENT');
  const operation=action?.approvalStale||action?.proposalStale?'PROPOSE_ACTION':action?.approval?'EXECUTE_ACTION':'APPROVE_ACTION';
  const actionReason=writeReason(service,readOnly,operation)||((operation!=='PROPOSE_ACTION'&&!action?.policyDecision.allowed)?action?.policyDecision.reasons.join(' '):'');
  const review=c?originalReviewState(service.workspace,view,c):null;
  function closeEvidence(){setNodeId(null);sourceOpener.current?.focus();}
  async function prepareOriginal(){try{const reply=await service.command({type:'PROPOSE_ACTION',action:review.specification});if(reply?.result?.actionId)setSelected(reply.result.actionId);}catch(e){service.setError(e.message);}}
  async function mutate(type){try{await service.command({type,actionId:action.id});}catch(e){service.setError(e.message);}}
  async function repropose(){try{const reply=await service.command({type:'PROPOSE_ACTION',action:{commitmentId:action.commitmentId,type:action.type,payload:action.payload}});if(reply?.result?.actionId)setSelected(reply.result.actionId);}catch(e){service.setError(e.message);}}
  async function reviewAmendment(id){try{const reply=await service.command({type:'PROPOSE_ACTION',action:{commitmentId:c.id,type:'accept_amendment',payload:{amendmentId:id}}});if(reply?.result?.actionId)setSelected(reply.result.actionId);}catch(e){service.setError(e.message);}}
  async function dismiss(id){try{await service.command({type:'DISMISS_AMENDMENT',amendmentId:id,reason:dismissalReason});setDismissalReason('');}catch(e){service.setError(e.message);}}
  return <div className="assurance-master-detail"><section className="assurance-register"><div className="assurance-section-title"><h2>Decision queue</h2><span>{view.actions.filter(a=>a.status!=='executed'&&view.commitments.some(c=>c.id===a.commitmentId)).length} open</span></div><label className="decision-record-picker">Selected action<select aria-label="Selected action" value={action?.id||''} disabled={!actions.length} onChange={event=>{setSelected(event.target.value);setNodeId(null);}}>{!action&&<option value="" disabled>{c?`No action prepared · ${vendorFor(view,c)} · ${c.reference}`:'Select an action'}</option>}{actions.map(candidate=>{const commitment=view.commitments.find(item=>item.id===candidate.commitmentId);return <option key={candidate.id} value={candidate.id}>{vendorFor(view,commitment)} · {commitment.reference} · {actionNames[candidate.type]} · {statusNames[candidate.status]||candidate.status}</option>;})}</select></label><div className="decision-rows">{actions.map(a=><button className={`decision-row ${action?.id===a.id?'selected':''}`} key={a.id} onClick={()=>{setSelected(a.id);setNodeId(null);}}><div><strong>{vendorFor(view,view.commitments.find(c=>c.id===a.commitmentId))}</strong><Status value={a.status}/></div><p>{actionNames[a.type]}</p><small>{a.economics?`${money(a.economics.netIncrementalValueCents)} net incremental value`:`${money(view.commitments.find(c=>c.id===a.commitmentId)?.outstandingCents||0)} original credit`}</small></button>)}</div><div className="register-explainer"><LockKeyhole size={17}/><p>Approval binds the exact action, evidence revisions, ledger, and policy. A changed basis requires a new review.</p></div></section>
    {!action?<article className="assurance-case decision-empty-case"><div className="assurance-empty"><ShieldCheck size={28}/><h2>{c?`No action prepared for ${vendorFor(view,c)}.`:'No action in this snapshot.'}</h2><p>{c?`${c.reference} · ${money(c.outstandingCents)} outstanding. Review the original terms before approving a local action.`:'Select a commitment from the portfolio to review its next action.'}</p>{c&&<><button className="button primary" disabled={!!proposalReason} onClick={prepareOriginal}>Review original claim<ArrowRight size={14}/></button><MutationReason>{proposalReason}</MutationReason></>}<button className="text-button" onClick={()=>onPortfolio(c?.id)}>Return to portfolio<ArrowRight size={13}/></button></div></article>:<article className="assurance-case decision-case"><header><div><h2>{actionNames[action.type]}</h2><p>{vendorFor(view,c)} · {c.reference}{amendment?` · ${amendment.kind.replaceAll('_',' ')}`:''}</p></div><Status value={action.status}/></header><div className="decision-body">
      <div className="decision-context"><span>{action.type==='accept_amendment'?'Review changed terms separately':'Review the original agreement'}</span><button className="text-button" onClick={()=>onPortfolio(c.id)}>Return to commitment<ArrowRight size={13}/></button></div>
      {action.economics?<section className="deal-economics"><div className="assurance-section-title"><h3>The credit has a cost.</h3><span>Explicit comparison</span></div><div className="economics-lines"><div><span>Contingent credit</span><strong>{money(action.economics.creditCents)}</strong></div><div><span>Incremental renewal cost</span><strong>−{money(action.economics.incrementalRenewalCostCents)}</strong></div><div className="economics-net"><span>Net incremental value</span><strong className={action.economics.netIncrementalValueCents<0?'negative':'positive'}>{money(action.economics.netIncrementalValueCents)}</strong></div></div><p className="baseline-note">{action.economics.baseline}</p><RenewalComparison key={action.id} economics={action.economics}/></section>:<section className="original-terms"><span>Original credit still outstanding</span><strong>{money(c?.outstandingCents||0)}</strong><p>{amendment?`Proposed due date: ${dateLabel(amendment.patch.dueDate)}. Original terms stay in force until an approved acceptance takes effect.`:'A follow-up preserves the original agreement. It creates no additional contractual obligation and records no savings.'}</p></section>}
      <section className={`policy-verdict ${action.policyDecision.allowed?'allowed':'denied'}`}>{action.policyDecision.allowed?<ShieldCheck size={22}/>:<ShieldX size={22}/>}<div><h3>{action.policyDecision.allowed?'Within the current mandate.':'Outside the current mandate.'}</h3>{action.policyDecision.reasons.length?<ul>{action.policyDecision.reasons.map(reason=><li key={reason}>{reason}</li>)}</ul>:<p>No new commitment. Amount and deadline satisfy the current policy.</p>}</div></section>
      {(action.approvalStale||action.proposalStale)&&<div className="assurance-warning"><AlertTriangle size={18}/><p>The evidence, ledger, terms, or policy changed after this action was prepared. Create a new proposal before approval or execution.</p></div>}
      {alternatives.length>0&&<details key={action.id} className="amendment-branches" open={action.type==='accept_amendment'&&amendment?.conflictIds.length>0||undefined}><summary>Review {alternatives.length} alternative terms<ChevronDown size={14}/></summary><p className="alternative-terms-context">Original terms stay in force; alternatives are not accepted.</p>{alternatives.map(candidate=><div className="amendment-branch" key={candidate.id}><div><strong>{candidate.kind==='renewal'?'Renewal counteroffer':'Schedule amendment'}</strong><Status value={candidate.basisStale?'stale':candidate.conflictIds.length?'blocked':'proposed'}/></div><p>{candidate.patch.dueDate?`Proposed due date ${dateLabel(candidate.patch.dueDate)}. `:''}{candidate.newCommitment?`${money(candidate.incrementalRenewalCostCents)} incremental obligation.`:'No additional contractual spend.'}</p>{candidate.conflictIds.length>0&&<small>Conflicts with another pending proposal. Neither changes the original agreement.</small>}<div className="branch-actions"><button className="text-button" disabled={!!proposalReason||candidate.basisStale} onClick={()=>reviewAmendment(candidate.id)}>Review {candidate.kind==='renewal'?'renewal':'date change'}<ArrowRight size={13}/></button><button className="text-button negative" disabled={!!dismissReason||!dismissalReason.trim()} onClick={()=>dismiss(candidate.id)}>Dismiss {candidate.kind==='renewal'?'renewal':'date change'}</button></div><MutationReason>{proposalReason||dismissReason||(candidate.basisStale?'This amendment basis is out of date; record a new proposal.':!dismissalReason.trim()?'Enter a reason to dismiss this alternative.':'')}</MutationReason></div>)}<label htmlFor="amendment-dismissal">Reason for dismissing an alternative</label><input id="amendment-dismissal" disabled={!!dismissReason} value={dismissalReason} onChange={e=>setDismissalReason(e.target.value)} maxLength={1000} placeholder="Explain why these terms should not be accepted"/><p className="branch-note">Dismissal is recorded with the actor and reason. It never deletes source history or accepts another proposal.</p></details>}
      <details className="approval-basis"><summary>Inspect the authorization basis<ChevronDown size={14}/></summary><dl><div><dt>Action reference</dt><dd>{action.id}</dd></div><div><dt>Policy</dt><dd>{action.basis.policyVersion}</dd></div><div><dt>Material revision</dt><dd>{action.basis.materialRevision}</dd></div><div><dt>Source revisions</dt><dd>{action.basis.sourceRevisions.length} bound</dd></div><div><dt>Approver</dt><dd>{action.approval?.actor.id || 'Not yet approved'}</dd></div><div><dt>Execution</dt><dd>{action.executed?'One local action recorded':'Not executed'}</dd></div></dl><p>An unrelated material update also invalidates the approval conservatively. The local demo roles are selectable; this is not production identity verification.</p></details>
      <details className="decision-source-list"><summary><FileText size={15}/>Review {action.basis.sourceRevisions.length} bound evidence revisions<ChevronDown size={14}/></summary><p>Approval binds every listed source revision, including records outside this commitment.</p>{action.basis.sourceRevisions.map(binding=>{const sourceNode=resolveEvidenceNode(view,`source:${binding.id}@${binding.revision}`);return <button className="source-button decision-source-button" key={`${binding.id}@${binding.revision}`} disabled={!sourceNode} onClick={event=>{sourceOpener.current=event.currentTarget;setNodeId(sourceNode.id);}}><FileText size={16}/><span><strong>{sourceNode?.label||binding.id}</strong><small>Bound revision {binding.revision}{!sourceNode?' · unavailable in this snapshot':''}</small></span><ArrowUpRight size={14}/></button>;})}</details>{node&&<SourceDetail key={node.id} node={node} view={view} onSelect={setNodeId} onClose={closeEvidence} returnLabel="Return to this action review" service={service} readOnly={readOnly}/>}<div className="decision-action-bar"><span><LockKeyhole size={15}/>No external transaction</span>{action.status==='executed'?<span className="completed-action"><CheckCheck size={17}/>Recorded once</span>:action.approvalStale||action.proposalStale?<button className="button primary" onClick={repropose} disabled={!!actionReason}><RefreshCw size={15}/>Create fresh proposal</button>:action.approval?<button className="button primary" onClick={()=>mutate('EXECUTE_ACTION')} disabled={!!actionReason}><Play size={15}/>Record approved action</button>:<button className="button primary" onClick={()=>mutate('APPROVE_ACTION')} disabled={!!actionReason}><ShieldCheck size={15}/>Approve exact action</button>}</div><MutationReason>{action.executed?'':actionReason}</MutationReason>
    </div></article>}</div>;
}

function LedgerEditor({view,commitment,service,readOnly}) {
  const credits=view.credits.filter(c=>c.vendorId===commitment.vendorId&&c.reference===commitment.reference);
  const [selected,setSelected]=useState('');
  const credit=credits.find(c=>c.id===selected)||credits[0];
  const [operation,setOperation]=useState('apply');
  const [amount,setAmount]=useState('300');
  const [evidence,setEvidence]=useState('');
  const reason=writeReason(service,readOnly,operation==='apply'?'APPLY_CREDIT':'REVERSE_CREDIT');
  const submitReason=reason||(!evidence.trim()?'Add the supporting source text.':operation==='apply'&&credit?.status==='applied'?'This credit is already applied. Choose a reversal only if supported by evidence.':'');
  async function record(event){
    event.preventDefault();
    try{
      const id=`source-${crypto.randomUUID()}`;
      const commands=[{type:'ADD_SOURCE',source:{id,vendorId:commitment.vendorId,title:operation==='apply'?'Supplied invoice application':'Supplied credit reversal',kind:operation==='apply'?'invoice':'credit_memo',text:evidence}}];
      if(operation==='apply')commands.push({type:'APPLY_CREDIT',creditId:credit.id,sourceIds:[id]});
      else commands.push({type:'REVERSE_CREDIT',creditId:credit.id,amountCents:moneyToCents(amount),sourceIds:[id]});
      await service.commands(commands);setEvidence('');
    }catch(e){service.setError(e.message);}
  }
  if(!credits.length)return null;
  return <details className="ledger-editor"><summary>Record invoice evidence or a reversal<ChevronDown size={14}/></summary><form onSubmit={record}><div className="ledger-fields"><label>Credit<select aria-label="Ledger credit" value={credit.id} onChange={e=>setSelected(e.target.value)}>{credits.map(c=><option key={c.id} value={c.id}>{c.invoiceId} · {money(c.availableCents)}</option>)}</select></label><label>Event<select aria-label="Ledger event" value={operation} onChange={e=>setOperation(e.target.value)}><option value="apply">Invoice application</option><option value="reverse">Credit reversal</option></select></label>{operation==='reverse'&&<label>Reversed USD<input aria-label="Reversal amount" disabled={!!reason} inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)}/></label>}</div><label htmlFor="ledger-evidence">Supporting source text</label><textarea id="ledger-evidence" value={evidence} disabled={!!reason} onChange={e=>setEvidence(e.target.value)} maxLength={250000} placeholder="Paste the invoice line or reversal notice, including its credit reference…" required/><div className="assurance-inline-actions"><small>Records supplied evidence locally; no issuer is contacted.</small><button className="button primary" disabled={!!submitReason} type="submit">{operation==='apply'?'Record application':'Record reversal'}<ArrowRight size={14}/></button></div><MutationReason>{submitReason}</MutationReason></form></details>;
}

function Portfolio({view,service,readOnly,onDecisions,onImport}) {
  const [search,setSearch]=useState('');
  const [detail,setDetail]=useState('evidence');
  const [nodeId,setNode]=useState(null);
  const node=resolveEvidenceNode(view,nodeId);
  useLayoutEffect(()=>{if(nodeId&&!node)setNode(null);},[nodeId,node]);
  const selected=view.commitments.find(c=>c.id===service.selectedId)||view.commitments[0];
  const filtered=view.commitments.filter(c=>`${vendorFor(view,c)} ${c.reference}`.toLowerCase().includes(search.toLowerCase()));
  const events=service.workspace.events.filter(e=>e.observedAt<=view.knownAt).filter(e=>e.payload.commitment?.id===selected?.id||e.payload.commitmentId===selected?.id||e.payload.amendment?.commitmentId===selected?.id||e.payload.action?.commitmentId===selected?.id||selected?.sourceLinks.some(l=>e.payload.source?.id===l.sourceId)||selected?.allocations.some(a=>e.payload.creditId===a.creditId||e.payload.credit?.id===a.creditId||e.payload.allocation?.creditId===a.creditId));
  const openAmendments=view.amendments.filter(a=>a.commitmentId===selected?.id&&!a.accepted&&!a.rejected);
  const adverseOffer=view.actions.find(a=>a.commitmentId===selected?.id&&a.economics?.netIncrementalValueCents<0&&!view.amendments.find(m=>m.id===a.payload.amendmentId)?.rejected);
  const review=selected?originalReviewState(service.workspace,view,selected):null;
  const proposalReason=writeReason(service,readOnly,'PROPOSE_ACTION');
  const selectedCredits=view.credits.filter(c=>c.vendorId===selected?.vendorId&&c.reference===selected?.reference);
  async function reviewOriginal(){
    if(review.action){onDecisions(selected.id,review.action.id);return;}
    try{const reply=await service.command({type:'PROPOSE_ACTION',action:review.specification});if(reply?.result?.actionId)onDecisions(selected.id,reply.result.actionId);}catch(error){service.setError(error.message);}
  }
  return <div className="assurance-master-detail"><section className="assurance-register"><div className="assurance-section-title"><h2>Commitment portfolio</h2><span>{view.commitments.length}</span></div><label className="assurance-search"><Search size={15}/><input aria-label="Search portfolio" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Find a vendor or reference"/></label><label className="mobile-record-picker">Selected commitment<select aria-label="Selected commitment" value={selected?.id||''} onChange={e=>{service.setSelectedId(e.target.value);setNode(null);}}>{view.commitments.map(c=><option key={c.id} value={c.id}>{vendorFor(view,c)} · {c.reference} · {money(c.outstandingCents)}</option>)}</select></label><div className="portfolio-rows">{filtered.map(c=><button key={c.id} className={`portfolio-row ${selected?.id===c.id?'selected':''}`} onClick={()=>{service.setSelectedId(c.id);setNode(null);}}><span className="portfolio-row-identity"><span className="portfolio-vendor-symbol"><Layers3 size={18}/></span><span><strong className="portfolio-row-vendor">{vendorFor(view,c)}</strong><small className="portfolio-row-reference">{c.reference}</small></span><ChevronRight size={15}/></span><span className="portfolio-row-financial"><span className="portfolio-row-status"><Status value={c.status}/></span><strong className="portfolio-row-amount">{money(c.outstandingCents)}</strong></span><small className="portfolio-row-deadline">{c.deadline.state==='expired'?'Claim window passed':c.deadline.date?`Claim by ${dateLabel(c.deadline.date)}`:`Due ${dateLabel(c.dueDate)}`}</small></button>)}</div>{!filtered.length&&<div className="assurance-empty small"><p>No matching commitments.</p><button className="text-button" onClick={()=>setSearch('')}>Clear search</button></div>}<button className="import-portfolio-button" onClick={onImport}><Plus size={16}/>Analyze new evidence<ArrowRight size={14}/></button><div className="register-explainer"><GitBranch size={18}/><p>Credits share one ledger. A single applied dollar cannot be attributed to two promises.</p></div></section>
    {selected?<article className="assurance-case"><header><div><h2>{vendorFor(view,selected)}</h2><p>{selected.reference} · USD</p></div><Status value={selected.status}/></header><div className="portfolio-case-body"><div className="assurance-amount"><span>{selected.conditions.length?'Conditional offer':'Credit still outstanding'}</span><strong>{money(selected.outstandingCents)}</strong><small>{selected.conditions.length?'Excluded from recoverable and verified totals.':selected.deadline.date?`Claim deadline ${dateLabel(selected.deadline.date)}${selected.deadline.daysRemaining>=0?` · ${selected.deadline.daysRemaining} days left`:''}`:`Expected by ${dateLabel(selected.dueDate)}`}</small></div><div className="case-financial-ledger"><div><span>Original promise</span><strong>{money(selected.originalPromisedCents)}</strong></div><div><span>Verified applied</span><strong className="positive">{money(selected.verifiedCents)}</strong></div><div><span>Issued, pending</span><strong>{money(selected.issuedCents)}</strong></div></div>
      <section className="case-next-action" aria-label="Next action for selected commitment"><div className="case-next-action-copy"><h3>{review.action?.executed?'Original action recorded':review.action?.approvalStale||review.action?.proposalStale?'Refresh the original claim review':review.action?.approval?'Record the approved original action':review.action?'Review the original claim':'Prepare the original claim for review'}</h3><p>{review.action?.executed?'A local action was recorded; no credit application is implied.':review.simulation.policyDecision.allowed?'Keep the original terms and review the exact evidence before approval.':review.simulation.policyDecision.reasons.join(' ')}</p></div><div className="case-next-action-buttons"><button className="button primary" disabled={!review.action&&!!proposalReason} onClick={reviewOriginal}>{review.action?.executed?'Review recorded action':review.action?'Review next action':'Review original claim'}<ArrowRight size={14}/></button></div><MutationReason>{!review.action?proposalReason:''}</MutationReason></section>
      {selected.sourceChanged&&<div className="assurance-warning"><AlertTriangle size={17}/><p>A supporting source has a newer revision. Review its relationship to the recorded terms before acting.</p></div>}
      {(selected.incrementalObligationCents>0||selected.futureIncrementalObligationCents>0)&&<div className="assurance-warning"><AlertTriangle size={17}/><p>Accepted incremental obligation: {money(selected.incrementalObligationCents)} effective, {money(selected.futureIncrementalObligationCents)} scheduled. Current net verified value: {money(selected.netVerifiedValueCents)}.</p></div>}
      {selected.futureAcceptedAmendmentIds.length>0&&<div className="historical-notice"><Clock3 size={16}/><p>An accepted amendment has a future effective date. Current terms remain until that date.</p></div>}
      {openAmendments.length>0&&<button className="pending-change" onClick={()=>onDecisions(selected.id,adverseOffer?.id||view.actions.findLast(a=>a.commitmentId===selected.id&&a.type==='accept_amendment'&&!view.amendments.find(m=>m.id===a.payload.amendmentId)?.rejected)?.id)}><span><ShieldCheck size={19}/><span><strong>{adverseOffer?`Renewal offer: ${money(Math.abs(adverseOffer.economics.netIncrementalValueCents))} worse than baseline`:`${openAmendments.length} proposed ${openAmendments.length===1?'change':'changes'} awaiting a decision`}</strong><small>{adverseOffer?`${money(adverseOffer.economics.creditCents)} credit against ${money(adverseOffer.economics.incrementalRenewalCostCents)} incremental spend.`:'The original agreement remains in force.'}</small></span></span><ArrowRight size={16}/></button>}
      <div className="assurance-detail-switch" role="group" aria-label="Case information"><button aria-pressed={detail==='evidence'} onClick={()=>setDetail('evidence')}><GitBranch size={14}/>Evidence graph</button><button aria-pressed={detail==='ledger'} onClick={()=>setDetail('ledger')}><Database size={14}/>Shared ledger</button><button aria-pressed={detail==='history'} onClick={()=>setDetail('history')}><History size={14}/>History</button></div>
      {detail==='evidence'&&<><EvidenceGraph view={view} commitment={selected} onSource={setNode}/>{node&&<SourceDetail key={node.id} node={node} view={view} onSelect={setNode} onClose={()=>setNode(null)} service={service} readOnly={readOnly}/>}</>}
      {detail==='ledger'&&<section className="shared-ledger"><div className="assurance-section-title"><h3>One credit. One conserved balance.</h3><span>Across all commitments</span></div>{!selectedCredits.length&&<div className="ledger-empty-state"><FileText size={22}/><h3>No issued or applied credit recorded.</h3><p>The promise remains outstanding until matching invoice evidence is recorded and attributed. Reviewing a claim does not create a credit or verify savings.</p><button className="button secondary" onClick={onImport}>Analyze invoice evidence<ArrowRight size={14}/></button><button className="text-button" onClick={()=>setDetail('evidence')}>Inspect the promise evidence<ArrowRight size={13}/></button></div>}{selectedCredits.map(credit=><div className="ledger-credit" key={credit.id}><div><strong>{credit.invoiceId}</strong><Status value={credit.status==='applied'?'verified':'issued'}/></div><dl><div><dt>Ledger value</dt><dd>{money(credit.availableCents)}</dd></div><div><dt>Allocated across cases</dt><dd>{money(credit.allocatedCents)}</dd></div><div><dt>Still available</dt><dd>{money(credit.unallocatedCents)}</dd></div></dl>{credit.quarantined&&<p className="negative"><AlertTriangle size={14}/>{credit.quarantineReason}</p>}{credit.allocations.map(a=><p key={a.id}><LinkLabel/> {a.commitmentId===selected.id?'This commitment':'Another commitment'}: {money(a.activeCents)} attributed{a.revokedCents?`, ${money(a.revokedCents)} reversed`:''}</p>)}</div>)}<LedgerEditor key={selected.id} view={view} commitment={selected} service={service} readOnly={readOnly}/></section>}
      {detail==='history'&&<section className="assurance-history"><div className="assurance-section-title"><h3>When it happened. When we knew.</h3><span>{events.length} records</span></div>{events.slice().reverse().map(event=><div key={event.id}><span><Activity size={14}/></span><div><strong>{commandName(event.type)}</strong><p>Effective {dateLabel(event.effectiveDate)}<span>Observed {dateLabel(event.observedAt)}</span></p><small>{event.actor.role} · {event.actor.id}</small></div></div>)}</section>}
    </div></article>:<div className="assurance-empty"><h2>No commitments in this snapshot.</h2><p>Move the dates forward to include later recorded evidence.</p></div>}
  </div>;
}

function LinkLabel(){return <GitBranch size={13} aria-hidden="true"/>;}

const commandExamples={
  'Attempt duplicate allocation':{type:'ALLOCATE_CREDIT',allocationId:'attempt-duplicate',creditId:'credit-pipeline-900',commitmentId:'pipeline-seats',amountCents:90000},
  'Prepare a fresh original claim':{type:'PROPOSE_ACTION',action:{commitmentId:'pipeline-seats',type:'preserve_original',payload:{}}},
  'Apply remaining Pipeline credit':[
    {type:'ADD_SOURCE',source:{id:'source-pipeline-extra',vendorId:'pipeline',title:'Synthetic remaining-credit invoice',kind:'invoice',text:'SYNTHETIC DEMO. Invoice INV-PC-EXTRA applies the remaining USD 1,500 credit for PC-SEATS-2026. This is a separate credit line from the USD 900 October correction.'}},
    {type:'REGISTER_CREDIT',credit:{id:'credit-pipeline-extra',lineId:'line-extra',invoiceId:'INV-PC-EXTRA',vendorId:'pipeline',currency:'USD',reference:'PC-SEATS-2026',amountCents:150000,status:'applied',sourceIds:['source-pipeline-extra']}},
    {type:'ALLOCATE_CREDIT',allocationId:'allocation-pipeline-extra',creditId:'credit-pipeline-extra',commitmentId:'pipeline-seats',amountCents:150000},
  ],
};

function FailureLab({service,readOnly}) {
  const [selected,setSelected]=useState(scenarios[0]?.id);
  const [results,setResults]=useState({});
  const [running,setRunning]=useState(false);
  const [template,setTemplate]=useState(Object.keys(commandExamples)[0]);
  const [command,setCommand]=useState(JSON.stringify(commandExamples[template],null,2));
  const [commandResult,setCommandResult]=useState(null);
  let commandReason;
  try{const parsed=JSON.parse(command);commandReason=batchMutationReason(Array.isArray(parsed)?parsed:[parsed],service.actor.role,{readOnly,busy:service.busy});}catch{commandReason='Enter valid JSON before running a command.';}
  const result=results[selected];
  const scenario=scenarios.find(s=>s.id===selected);
  async function run(all=false){
    setRunning(true);
    await new Promise(resolve=>requestAnimationFrame(resolve));
    try{
      const next={...results};
      for(const sample of all?scenarios:[scenario]){
        try{next[sample.id]=runScenario(sample.id);}catch(error){next[sample.id]={passed:false,checks:[{name:'Scenario execution',passed:false,detail:error.message}],steps:[]};}
      }
      setResults(next);
    }finally{setRunning(false);}
  }
  async function submit(event){event.preventDefault();setCommandResult(null);try{const input=JSON.parse(command);const reply=Array.isArray(input)?await service.commands(input):await service.command(input);setCommandResult({ok:true,message:`Recorded against the actual ${service.mode} workspace.`,result:reply?.result});}catch(error){setCommandResult({ok:false,message:error.message});}}
  return <div className="failure-lab"><div className="failure-lab-intro"><div><h2>Make the system earn your trust.</h2><p>Each case executes the real reducer, including the actions that should fail.</p></div><button className="button primary" onClick={()=>run(true)} disabled={running}><Play size={15}/>{running?'Running cases…':'Run all cases'}</button></div><div className="failure-layout"><section className="scenario-list" aria-label="Failure scenarios">{scenarios.map(s=><button key={s.id} className={selected===s.id?'selected':''} onClick={()=>setSelected(s.id)}><span>{results[s.id]?results[s.id].passed?<CheckCheck size={17}/>:<AlertTriangle size={17}/>:<Beaker size={17}/>}</span><span><strong>{s.name}</strong><small>{results[s.id]?results[s.id].passed?'Checks passed':'Needs investigation':'Not run yet'}</small></span><ChevronRight size={15}/></button>)}</section><section className="scenario-result" aria-live="polite"><div className="assurance-section-title"><h3>{scenario?.name}</h3><button className="text-button" onClick={()=>run(false)} disabled={running}>Run case<Play size={13}/></button></div><p className="scenario-description">{scenario?.description}</p>{result?<><div className={`scenario-verdict ${result.passed?'passed':'failed'}`}>{result.passed?<ShieldCheck size={22}/>:<ShieldX size={22}/>}<span><strong>{result.passed?'The expected boundary held.':'A check failed.'}</strong><small>{result.checks.filter(c=>c.passed).length} of {result.checks.length} checks passed</small></span></div><div className="scenario-checks">{result.checks.map((check,i)=><div key={i}>{check.passed?<Check size={15}/>:<X size={15}/>}<div><strong>{check.name}</strong><p>{check.detail}</p></div></div>)}</div><details className="scenario-steps"><summary>Inspect {result.steps.length} executed steps<ChevronDown size={14}/></summary>{result.steps.map((step,i)=><div key={i}><span className={step.error?'rejected':'recorded'}>{step.error?'Blocked':'Recorded'}</span><div><strong>{commandName(step.command.type)}</strong><p>{step.error?`${step.error.code}: ${step.error.message}`:`Event revision ${step.revision}`}</p></div></div>)}</details></>:<div className="scenario-not-run"><Beaker size={28}/><p>Run this case to inspect the actual outcome and rejected commands.</p></div>}</section></div><div className="failure-lab-footer"><span>{Object.values(results).filter(r=>r.passed).length}/{scenarios.length} authored cases passed</span><p>Synthetic regression cases. These results are not held-out accuracy, a formal proof, or competitor performance.</p></div><details className="command-console"><summary><Terminal size={16}/>Advanced commands against this workspace<ChevronDown size={14}/></summary><form onSubmit={submit}><label>Command example<select aria-label="Command example" value={template} onChange={e=>{setTemplate(e.target.value);setCommand(JSON.stringify(commandExamples[e.target.value],null,2));}}>{Object.keys(commandExamples).map(name=><option key={name}>{name}</option>)}</select></label><label htmlFor="workspace-command">Structured command</label><textarea id="workspace-command" value={command} onChange={e=>setCommand(e.target.value)} maxLength={250000} spellCheck={false}/><div className="assurance-inline-actions"><small>Mutates the synthetic workspace through the same checked boundary.</small><button className="button primary" disabled={!!commandReason} type="submit">Run command<ArrowRight size={14}/></button></div><MutationReason>{commandReason}</MutationReason></form>{commandResult&&<div className={`command-result ${commandResult.ok?'allowed':'denied'}`} role="status"><strong>{commandResult.ok?'Recorded':'Rejected'}</strong><p>{commandResult.message}</p>{commandResult.result&&<pre>{JSON.stringify(commandResult.result,null,2)}</pre>}</div>}</details></div>;
}

function PolicyPanel({view,service,readOnly}) {
  const [claimLimit,setClaimLimit]=useState(String(view.policy.claimLimitCents/100));
  const [renewalLimit,setRenewalLimit]=useState(String(view.policy.renewalLimitCents/100));
  const [allow,setAllow]=useState(view.policy.allowNewCommitments);
  const reason=writeReason(service,readOnly,'SET_POLICY');
  async function save(event){event.preventDefault();try{await service.command({type:'SET_POLICY',policy:{claimLimitCents:moneyToCents(claimLimit),renewalLimitCents:moneyToCents(renewalLimit),allowNewCommitments:allow}});}catch(e){service.setError(e.message);}}
  return <details className="policy-panel"><summary><ShieldCheck size={16}/><span>Current mandate: {view.policy.allowNewCommitments?'new obligations need a bounded approval':'no new contractual obligations'}</span><ChevronDown size={14}/></summary><form onSubmit={save}><div className="policy-inputs"><label>Claim limit, USD<input aria-label="Claim approval limit" disabled={!!reason} value={claimLimit} inputMode="decimal" onChange={e=>setClaimLimit(e.target.value)}/></label><label>Incremental renewal limit, USD<input aria-label="Renewal approval limit" disabled={!!reason} value={renewalLimit} inputMode="decimal" onChange={e=>setRenewalLimit(e.target.value)}/></label></div><label className="policy-checkbox"><input type="checkbox" disabled={!!reason} checked={allow} onChange={e=>setAllow(e.target.checked)}/>Allow proposals with new contractual obligations</label><div className="assurance-inline-actions"><p>A changed policy invalidates pending approvals. Only the demo admin can change this mandate.</p><button className="button secondary" disabled={!!reason} type="submit">Update mandate</button></div><MutationReason>{reason}</MutationReason></form></details>;
}

export default function Assurance({service,onImport}) {
  const [tab,setTab]=useState('portfolio');
  const [asOf,setAsOf]=useState(today);
  const [knownDate,setKnownDate]=useState(today);
  const [showGuide,setShowGuide]=useState(false);
  const [confirmReset,setConfirmReset]=useState(false);
  const [decisionAction,setDecisionAction]=useState(null);
  const historyToggle=useRef(null);
  const workspaceOptions=useRef(null);
  const resetConfirmation=useRef(null);
  useEffect(()=>{
    function closeOptions(event){
      const disclosure=workspaceOptions.current;
      if(!disclosure?.open)return;
      const escape=event.type==='keydown'&&event.key==='Escape';
      if(event.type==='keydown'&&!escape)return;
      if(!escape&&disclosure.contains(event.target))return;
      if(escape||disclosure.contains(document.activeElement))disclosure.querySelector('summary')?.focus();
      disclosure.open=false;
      if(escape)event.preventDefault();
    }
    document.addEventListener('pointerdown',closeOptions);
    document.addEventListener('keydown',closeOptions);
    return()=>{document.removeEventListener('pointerdown',closeOptions);document.removeEventListener('keydown',closeOptions);};
  },[]);
  const view=useMemo(()=>{try{return service.workspace?evaluateWorkspace(service.workspace,{asOf,knownAt:`${knownDate}T23:59:59.999Z`}):null;}catch(error){return {error:error.message};}},[service.workspace,asOf,knownDate]);
  const readOnly=asOf!==today()||knownDate!==today();
  const resetReason=writeReason(service,readOnly,'RESET_WORKSPACE');
  async function exportEvidence(){try{download(await service.exportPacket({asOf,knownAt:`${knownDate}T23:59:59.999Z`}),'truthful-assurance-evidence.json');}catch(e){service.setError(e.message);}}
  if(!view)return <main className="assurance"><div className="assurance-loading"><Database size={26}/><h1>Opening the commitment workspace…</h1><p>Checking the local service and recorded evidence.</p></div></main>;
  if(view.error)return <main className="assurance"><div className="assurance-error" role="alert"><AlertTriangle size={20}/><p>{view.error}</p><button className="button secondary" onClick={()=>{setAsOf(today());setKnownDate(today());}}>Use latest dates</button></div></main>;
  return <main className="assurance"><div className="assurance-page-heading"><div><h1>Commitment portfolio</h1><p>Review outstanding value, changed terms, and authorized actions.</p></div><details ref={workspaceOptions} className="workspace-options"><summary>Workspace options<ChevronDown size={14}/></summary><div className="workspace-options-body"><div className="portfolio-workspace-actions"><button className="button secondary" onClick={()=>{setShowGuide(!showGuide);workspaceOptions.current.open=false;workspaceOptions.current.querySelector("summary")?.focus();}} aria-expanded={showGuide}><CircleHelp size={15}/>Explore the mechanism</button><button className="button secondary" onClick={exportEvidence} disabled={service.busy}><ArrowDownToLine size={15}/>Export audit packet</button><button className="text-button" onClick={()=>{setConfirmReset(!confirmReset);workspaceOptions.current.open=false;requestAnimationFrame(()=>resetConfirmation.current?.focus());}} disabled={!!resetReason}><RotateCcw size={13}/>Reset demo workspace</button><MutationReason>{resetReason}</MutationReason></div><div className="assurance-runtime"><div><span className={`runtime-indicator ${service.mode}`}/><strong>{service.mode==='server'?'Local SQLite service':'Browser workspace'}</strong><small>{service.mode==='server'?'Durable writes and server-enforced roles':'Local records; no server authority'}</small></div><label>Demo role<select aria-label="Demo actor role" value={service.actor.role} disabled={service.busy} onChange={e=>service.changeRole(e.target.value)}>{[['admin','Admin'],['analyst','Analyst'],['approver','Approver'],['executor','Executor'],['viewer','Read only']].map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label></div></div></details></div>

    <ResponsiveDetails className="portfolio-overview" label="Portfolio overview"><div className="assurance-totals" aria-label="Assurance portfolio totals">{[['Recoverable now',view.totals.recoverableCents,'Original terms, within claim window'],['Verified applied',view.totals.verifiedCents,'Conserved across the shared ledger'],['Issued, not applied',view.totals.issuedCents,'Excluded from verified savings'],['Conditional offers',view.totals.conditionalCents,'Excluded until terms are resolved']].map(([label,amount,detail])=><div key={label}><span>{label}</span><strong className={label==='Verified applied'?'positive':''}>{money(amount)}</strong><small>{detail}</small></div>)}</div></ResponsiveDetails>
    {showGuide&&<section className="mechanism-guide"><div><h2>One promise. Several ways to get it wrong.</h2><button className="icon-button" aria-label="Close mechanism guide" onClick={()=>setShowGuide(false)}><X size={17}/></button></div><ol><li>Open Pipeline’s proposed renewal. A $1,500 credit can cost $2,400 in incremental spend.</li><li>Approve an original-terms action, then revise a supporting source or change the mandate. The approval becomes unusable.</li><li>Move “Known by” backward to replay what the system could have known before later evidence arrived.</li><li>Run the failure cases: duplicate allocation, late evidence, policy changes, reversals, and one-use execution.</li></ol><p>All counterparties and sources are synthetic. Actions record local state; no vendor transaction is performed.</p></section>}
    {service.error&&<div className="assurance-error" role="alert"><AlertTriangle size={18}/><p>{service.error}</p><button className="icon-button" aria-label="Dismiss workspace error" onClick={()=>service.setError('')}><X size={16}/></button></div>}

    <div className="assurance-navigation"><div role="group" aria-label="Assurance views">{[['portfolio',Layers3,'Portfolio'],['decisions',ShieldCheck,'Decision room'],['lab',Beaker,'Failure lab']].map(([id,Icon,label])=><button key={id} aria-pressed={tab===id} onClick={()=>{if(id==='decisions')setDecisionAction(null);setTab(id);}}><Icon size={16}/>{label}{id==='decisions'&&<span>{view.actions.filter(a=>a.status!=='executed'&&view.commitments.some(c=>c.id===a.commitmentId)).length}</span>}</button>)}</div></div>
    {confirmReset&&<div className="assurance-warning reset-confirmation"><AlertTriangle size={18}/><div><strong>Restore the synthetic starting workspace?</strong><p>Export your current records first. Local service audit history is retained; browser records are replaced.</p></div><button className="button secondary" onClick={()=>setConfirmReset(false)}>Cancel</button><button className="button primary" ref={resetConfirmation} onClick={async()=>{try{await service.resetDemo();setConfirmReset(false);workspaceOptions.current?.querySelector("summary")?.focus();}catch(error){service.setError(error.message);}}} disabled={!!resetReason}>Confirm reset</button><MutationReason>{resetReason}</MutationReason></div>}
    {tab!=='lab'&&<details className="history-disclosure" open={readOnly||undefined}><summary ref={historyToggle}><span><History size={15}/>Historical view</span><span>{readOnly?'Historical comparison':'Current records'}<ChevronDown size={14}/></span></summary><div className="replay-controls"><div><History size={16}/><span>Replay the recorded evidence</span></div><label>Effective on<input type="date" aria-label="Financial effective date" value={asOf} onChange={e=>setAsOf(e.target.value)}/></label><label>Known by<input type="date" aria-label="Knowledge cutoff date" value={knownDate} onChange={e=>setKnownDate(e.target.value)}/></label>{readOnly&&<button className="text-button" onClick={()=>{setAsOf(today());setKnownDate(today());historyToggle.current?.focus();}}>Return to latest<ArrowRight size={13}/></button>}</div></details>}
    {readOnly&&tab!=='lab'&&<div className="historical-notice"><Clock3 size={15}/>Historical comparison. Write actions are disabled. Unobserved evidence remains unknown.</div>}
    {tab==='portfolio'?<Portfolio view={view} service={service} readOnly={readOnly} onImport={onImport} onDecisions={(id,actionId)=>{service.setSelectedId(id);setDecisionAction(actionId||null);setTab('decisions');}}/>:tab==='decisions'?<DecisionRoom view={view} service={service} readOnly={readOnly} initialCommitment={service.selectedId} initialAction={decisionAction} onPortfolio={id=>{if(id)service.setSelectedId(id);setTab('portfolio');}}/>:<FailureLab service={service} readOnly={readOnly}/>}
    {tab!=='lab'&&<PolicyPanel key={view.policy.version} view={view} service={service} readOnly={readOnly}/>}
    <footer className="assurance-footnote"><span><ShieldCheck size={14}/>{validateWorkspace(service.workspace).valid?'Financial invariants hold in this recorded model.':'Recorded model requires investigation.'}</span><p>Structured USD evidence. Selectable demo identities. No live model, inbox, payment, or vendor transaction.</p></footer>
  </main>;
}
