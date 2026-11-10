import {flushSync} from 'react-dom';
import {createHistoryCopy} from './history-copy.mjs';
import DocumentGraphic from './DocumentGraphic.jsx';
import DocumentReader from './DocumentReader.jsx';
import ReviewArtwork,{ReviewStages} from './ReviewArtwork.jsx';
import {reviewPresentation,readableReviewReason,reviewFiles} from './review-display.mjs';
import {formatMoney} from './correspondence.mjs';
import {documentReading} from './document-reading.mjs';
import {CorrespondenceIndex,PromisePapers,CaseExplanation,CompanyMark,caseTransitionName} from './CorrespondenceDesk.jsx';
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState, useId } from 'react';
import { Activity, ArrowDownToLine, ArrowRight, ArrowUpRight, Beaker, Check, CheckCheck, ChevronDown, ChevronRight, CircleHelp, Clock3, Database, FileCheck2, FileText, GitBranch, History, Layers3, LockKeyhole, Play, Plus, RefreshCw, RotateCcw, Search, ShieldCheck, ShieldX, Terminal, X, AlertTriangle } from 'lucide-react';
import { evaluateWorkspace, runScenario, scenarios, validateWorkspace } from './assurance/index.mjs';
import { moneyToCents } from './engine/index.mjs';
import { compareRenewal } from './economics.mjs';
import { batchMutationReason, mutationReason, originalReviewState, resolveEvidenceNode, selectDecisionAction } from './assurance-ui.mjs';
import './assurance.css';
import {followupFilters, followupSorts, selectFollowups} from './followups-ui.mjs';
import CreditWorkspace from './CreditWorkspace.jsx';
import AmendmentEditor from './AmendmentEditor.jsx';

const money = cents => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(cents/100);
const today = () => new Date().toISOString().slice(0,10);
const dateLabel = value => value ? new Date(`${value.slice(0,10)}T12:00:00Z`).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : 'No deadline';
const statusNames = {open:'Open',partial:'Partly applied',issued:'Issued, not applied',scheduled:'Not due yet',conditional:'Conditional',verified:'Applied',deadline_expired:'Deadline passed',proposed:'Needs approval',approved:'Approved',stale:'Approval out of date',blocked:'Blocked',executed:'Recorded'};
const actionNames = {prepare_claim:'Follow up on agreed credit',preserve_original:'Keep the original terms',accept_amendment:'Accept proposed changes'};
const commandName = type => type.toLowerCase().replaceAll('_',' ').replace(/^./,c=>c.toUpperCase());
const vendorFor = (view,c) => view.vendors.find(v=>v.id===c?.vendorId)?.name || 'Unknown vendor';

function download(value,filename) {
  const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function Status({value}) { return <span className={`assurance-status ${value}`}>{statusNames[value] || value}</span>; }
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
  const columns=[['Documents',['source']],['Terms',['commitment','amendment']],['Credits',['credit','allocation','reversal']],['Actions',['action','approval','decision']]];
  function label(node){
    if(node.kind==='commitment')return vendorFor(view,commitment);
    if(node.kind==='action')return actionNames[view.actions.find(a=>`action:${a.id}`===node.id)?.type] || 'Action';
    if(node.kind==='amendment')return view.amendments.find(a=>`amendment:${a.id}`===node.id)?.kind==='renewal'?'Renewal proposal':'Date proposal';
    if(node.kind==='approval')return node.stale?'Stale approval':'Exact-action approval';
    if(node.kind==='allocation')return 'Allocated credit';
    if(node.kind==='decision')return 'Alternative dismissed';
    return node.label;
  }
  return <section className="lineage-section"><div className="assurance-section-title"><h3>How the records connect</h3><span>{selected.nodes.length} records connected</span></div><div className="lineage-map" ref={container}>
    <svg className="lineage-connectors" aria-hidden="true"><defs><marker id="lineage-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="4" markerHeight="4" orient="auto"><path d="M 0 0 L 8 4 L 0 8" fill="#657d5c"/></marker></defs>{paths.map(p=><path key={p.id} d={p.d} fill="none" stroke="#657d5c" strokeWidth="1.4" markerEnd="url(#lineage-arrow)"><title>{p.relation.replaceAll('_',' ')}</title></path>)}</svg>
    {columns.map(([heading,kinds])=><div className="lineage-column" key={heading}><h4>{heading}</h4>{selected.nodes.filter(n=>kinds.includes(n.kind)).map(node=><button key={node.id} data-node={node.id} className={`lineage-node ${node.kind}`} onClick={()=>onSource(node)} title={label(node)}><span>{node.kind==='source'?<FileText size={14}/>:node.kind==='approval'?<ShieldCheck size={14}/>:node.kind==='credit'?<FileCheck2 size={14}/>:<GitBranch size={14}/>}</span><strong>{label(node)}</strong><small>{node.amountCents != null?money(node.amountCents):node.kind==='source'?`Source revision ${node.revision}`:node.status?statusNames[node.status]||node.status:node.kind==='amendment'?(view.amendments.find(a=>`amendment:${a.id}`===node.id)?.rejected?'Dismissed':view.amendments.find(a=>`amendment:${a.id}`===node.id)?.basisStale?'Basis out of date':node.accepted?'Accepted':'Not accepted'):'Recorded link'}</small></button>)}</div>)}
  </div><details className="graph-accessible"><summary>Read the relationships<ChevronDown size={13}/></summary><ul>{selected.edges.map(edge=><li key={edge.id}>{label(selected.nodes.find(n=>n.id===edge.from))} <span>{edge.relation.replaceAll('_',' ')}</span> {label(selected.nodes.find(n=>n.id===edge.to))}</li>)}</ul></details></section>;
}

function SourceDetail({node,view,onClose,onSelect,service,readOnly,returnLabel}) {
  const source=node.kind==='source'?view.sourceVersions.find(s=>s.id===node.sourceId&&s.revision===node.revision):null;
  const latest=source?view.sources.find(s=>s.id===source.id):null,isLatest=source?.revision===latest?.revision;
  const [text,setText]=useState(source?.text||''),[editing,setEditing]=useState(false);
  const heading=useRef(null),container=useRef(null),editorId=useId();
  useLayoutEffect(()=>{heading.current?.focus({preventScroll:true});container.current?.scrollIntoView({block:'start'});},[node.id]);
  const reason=writeReason(service,readOnly,'REVISE_SOURCE');
  async function save(){try{await service.command({type:'REVISE_SOURCE',sourceId:source.id,text});setEditing(false);onClose();}catch(e){service.setError(e.message);}}
  function downloadText(){const url=URL.createObjectURL(new Blob([source.text],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`truthful-source-${source.id.replace(/[^a-zA-Z0-9_-]/g,'_')}-revision-${source.revision}.txt`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  return <section ref={container} className="assurance-source-detail visual-source-detail" aria-label="Selected evidence record"><button className="source-close icon-button" aria-label="Close evidence record" onClick={onClose}><X size={17}/></button>
    {source?editing?<div className="source-revision-editor"><h3 ref={heading} tabIndex={-1}>Revise the supplied text</h3><label htmlFor={editorId}>Revised source text</label><textarea id={editorId} value={text} disabled={!!reason} onChange={e=>setText(e.target.value)} maxLength={250000}/><div className="assurance-inline-actions"><button className="button secondary" onClick={()=>setEditing(false)}>Cancel</button><button className="button primary" disabled={!!reason||!text.trim()} onClick={save}>Save source revision</button></div><MutationReason>{reason||(!text.trim()?'Enter supporting source text.':'')}</MutationReason></div>:<><DocumentReader embedded returnLabel={returnLabel||'Return to the case'} headingLevel={3} headingRef={heading} source={{...source,isCurrent:isLatest}} view={view} revisions={view.sourceVersions.filter(s=>s.id===source.id).sort((a,b)=>a.revision-b.revision)} onChooseRevision={version=>onSelect(`source:${version.id}@${version.revision}`)} onDownload={downloadText} onBack={onClose}/>{isLatest&&<div className="source-revision-action"><button className="text-button" disabled={!!reason} onClick={()=>setEditing(true)}>Revise this source</button><MutationReason>{reason}</MutationReason></div>}{!isLatest&&latest&&<button className="text-button" onClick={()=>onSelect(`source:${latest.id}@${latest.revision}`)}>Open latest revision ({latest.revision})</button>}</>:node.kind==='source'?<><h3 ref={heading} tabIndex={-1}>Document version unavailable</h3><p>This version is unavailable in this snapshot.</p><button className="text-button" onClick={onClose}>{returnLabel||'Return to the case'}</button></>:<><h3 ref={heading} tabIndex={-1}>{node.label}</h3><button className="text-button" onClick={onClose}>{returnLabel||'Return to the case'}</button><pre>{JSON.stringify(node,null,2)}</pre></>}
  </section>;
}

function RenewalComparison({economics}) {
  const [baseline,setBaseline]=useState(String((economics.baselineCostCents/1200).toFixed(2)));
  const [proposed,setProposed]=useState(String((economics.proposedRenewalCostCents/1200).toFixed(2)));
  const [months,setMonths]=useState('12');
  const comparison=useMemo(()=>{try{return compareRenewal({baselineMonthly:baseline,proposedMonthly:proposed,months,creditCents:economics.creditCents});}catch(error){return {error:error.message};}},[baseline,proposed,months,economics.creditCents]);
  return <details className="what-if"><summary>Change the comparison assumptions<ChevronDown size={14}/></summary><div className="what-if-inputs"><label>Baseline / month<input aria-label="Baseline monthly cost" inputMode="decimal" value={baseline} onChange={e=>setBaseline(e.target.value)}/></label><label>Offer / month<input aria-label="Proposed monthly cost" inputMode="decimal" value={proposed} onChange={e=>setProposed(e.target.value)}/></label><label>Months<input aria-label="Comparison months" inputMode="numeric" value={months} onChange={e=>setMonths(e.target.value)}/></label></div>{comparison.error?<p role="alert">{comparison.error}</p>:<div className="what-if-result"><span>Net value versus this baseline</span><strong className={comparison.netValueCents<0?'negative':'positive'}>{money(comparison.netValueCents)}</strong><small>{money(comparison.proposedCents)} proposed − {money(economics.creditCents)} credit versus {money(comparison.baselineCents)} baseline.</small></div>}<p>Scenario only. These inputs do not change the proposal, authorize a renewal, or forecast the value of additional service.</p></details>;
}

function DecisionRoom({view,service,readOnly,initialCommitment,initialAction,onPortfolio,onSelection}) {
  const [selected,setSelected]=useState(initialAction||null),[dismissalReason,setDismissalReason]=useState(''),[declining,setDeclining]=useState(null),[nodeId,setNodeId]=useState(null);
  const sourceOpener=useRef(null),alternativesHeading=useRef(null),reviewHeading=useRef(null);
  useLayoutEffect(()=>{setSelected(initialAction||null);setNodeId(null);setDeclining(null);setDismissalReason('');},[initialCommitment,initialAction]);
  const actions=view.actions.filter(a=>view.commitments.some(c=>c.id===a.commitmentId));
  const action=selectDecisionAction(view,{selectedActionId:selected,commitmentId:initialCommitment});
  const p=useMemo(()=>reviewPresentation(service.workspace,view,action),[service.workspace,view,action]);
  const c=p?.commitment,amendment=p?.amendment;
  useLayoutEffect(()=>{if(action&&document.activeElement?.tagName!=='SELECT'){reviewHeading.current?.closest('.decision-case')?.scrollIntoView({block:'start'});reviewHeading.current?.focus({preventScroll:true});}},[action?.id]);
  const alternatives=view.amendments.filter(m=>m.commitmentId===c?.id&&!m.accepted&&!m.rejected);
  const node=resolveEvidenceNode(view,nodeId);
  useLayoutEffect(()=>{if(nodeId&&!node)setNodeId(null);},[nodeId,node]);
  const proposalReason=writeReason(service,readOnly,'PROPOSE_ACTION'),dismissReason=writeReason(service,readOnly,'DISMISS_AMENDMENT');
  const operation=p?.stale?'PROPOSE_ACTION':action?.approval?'EXECUTE_ACTION':'APPROVE_ACTION';
  const permissionReason=writeReason(service,readOnly,operation);
  const actionReason=permissionReason||((operation!=='PROPOSE_ACTION'&&!action?.policyDecision.allowed)?action?.policyDecision.reasons.map(readableReviewReason).join(' '):'');
  const review=c?originalReviewState(service.workspace,view,c):initialCommitment?originalReviewState(service.workspace,view,view.commitments.find(c=>c.id===initialCommitment)):null;
  const reusableOriginal=review?.action&&!review.action.proposalStale&&!review.action.approvalStale&&!review.action.executed?review.action:null;
  function closeEvidence(){setNodeId(null);requestAnimationFrame(()=>sourceOpener.current?.focus());}
  function selectAction(id,commitmentId){setSelected(id);setNodeId(null);setDeclining(null);setDismissalReason('');const candidate=actions.find(a=>a.id===id);onSelection?.(commitmentId||candidate?.commitmentId||initialCommitment,id);}
  async function prepareOriginal(){if(reusableOriginal){selectAction(reusableOriginal.id,reusableOriginal.commitmentId);return;}try{const reply=await service.command({type:'PROPOSE_ACTION',action:review.specification});if(reply?.result?.actionId)selectAction(reply.result.actionId,review.specification.commitmentId);}catch(e){service.setError(e.message);}}
  async function mutate(type){try{await service.command({type,actionId:action.id});}catch(e){service.setError(e.message);}}
  async function repropose(){try{const reply=await service.command({type:'PROPOSE_ACTION',action:{commitmentId:action.commitmentId,type:action.type,payload:action.payload}});if(reply?.result?.actionId)selectAction(reply.result.actionId,action.commitmentId);}catch(e){service.setError(e.message);}}
  async function reviewAmendment(id){const existing=actions.findLast(a=>a.commitmentId===c.id&&a.payload?.amendmentId===id&&!a.proposalStale&&!a.approvalStale&&!a.executed);if(existing){selectAction(existing.id,c.id);return;}try{const reply=await service.command({type:'PROPOSE_ACTION',action:{commitmentId:c.id,type:'accept_amendment',payload:{amendmentId:id}}});if(reply?.result?.actionId)selectAction(reply.result.actionId,c.id);}catch(e){service.setError(e.message);}}
  async function dismiss(id){try{await service.command({type:'DISMISS_AMENDMENT',amendmentId:id,reason:dismissalReason});setDismissalReason('');setDeclining(null);}catch(e){service.setError(e.message);}}
  const isDeclined=a=>a.type==='accept_amendment'&&view.amendments.some(m=>m.id===a.payload?.amendmentId&&m.rejected);
  const displayStatus=a=>isDeclined(a)?'Declined':statusNames[a.status]||a.status;
  const files=reviewFiles({...view,actions});
  const displayAction=a=>{const proposal=view.amendments.find(m=>m.id===a.payload?.amendmentId);return a.type==='accept_amendment'?(proposal?.newCommitment||proposal?.incrementalRenewalCostCents>0?'Renewal offer':proposal?.patch.dueDate?'Date change':'Changed terms'):a.type==='preserve_original'?'Original terms':'Credit request';};
  return <div className="assurance-master-detail review-workspace"><section className="assurance-register review-register"><div className="assurance-section-title"><h2>Reviews</h2><span>{files.filter(a=>!a.executed).length} open</span></div><label className="decision-record-picker">Request to review<select aria-label="Request to review" value={action?.id||''} disabled={!actions.length} onChange={e=>selectAction(e.target.value)}>{!action&&<option value="" disabled>Choose a review</option>}{actions.map(a=><option key={a.id} value={a.id}>{vendorFor(view,view.commitments.find(c=>c.id===a.commitmentId))} · {displayAction(a)} · {displayStatus(a)}</option>)}</select></label><div className="decision-rows">{files.map(a=>{const terms=view.amendments.find(m=>m.id===a.payload?.amendmentId),source=terms?.sourceLinks.map(l=>view.sourceVersions.find(s=>s.id===l.sourceId&&s.revision===l.revision)).find(Boolean),e=a.executed?a.execution.economics:a.economics;return <button className={`decision-row ${action?.id===a.id?'selected':''}`} key={a.id} onClick={()=>selectAction(a.id,a.commitmentId)}>{source&&<span className="review-row-art"><DocumentGraphic reading={documentReading(view,source)} small/></span>}<div className="review-row-copy"><strong>{vendorFor(view,view.commitments.find(c=>c.id===a.commitmentId))}</strong><p>{displayAction(a)}</p><small>{e&&terms?.newCommitment?`${formatMoney(Math.abs(e.netIncrementalValueCents))} ${e.netIncrementalValueCents<0?'extra cost':'credit after extra cost'}`:statusNames[a.status]||a.status}</small></div></button>;})}</div></section>
    {!action?<article className="assurance-case decision-empty-case"><div className="assurance-empty"><h2>{initialCommitment?'No review prepared for this case':'Choose a review'}</h2>{review?.specification&&<button className="button primary" disabled={!!proposalReason} onClick={prepareOriginal}>Review follow-up</button>}<MutationReason>{proposalReason}</MutationReason><button className="text-button" onClick={()=>onPortfolio(initialCommitment)}>Back to the case</button></div></article>:<article className="assurance-case decision-case">
      <header><div><span className="review-company">{p.company}</span><h2 ref={reviewHeading} tabIndex={-1}>{p.label}</h2>{p.renewal&&p.costLabel&&<strong className="review-heading-result">{p.costLabel}<small>after the offered credit</small></strong>}{!p.renewal&&amendment?.patch.dueDate&&<strong className="review-heading-dates">{dateLabel(p.before.dueDate)} <span aria-hidden="true">→</span> {dateLabel(amendment.patch.dueDate)}</strong>}{!p.renewal&&amendment?.patch.conditions&&<p className="review-heading-conditions">{amendment.patch.conditions.length?amendment.patch.conditions.join(' '):'Removes the existing conditions.'}</p>}{p.recorded&&amendment&&<span className="review-recorded-date">Terms take effect {dateLabel(amendment.effectiveDate)}</span>}</div><button className="text-button" onClick={()=>onPortfolio(c.id)}>Back to the case</button></header>
      <div className="decision-action-bar"><div className="review-action-status"><strong>{p.recorded?'Decision recorded':p.declined?'Offer declined':p.stale?'The review needs updating':p.approved?'Approved, ready to record':action.policyDecision.allowed?'Ready for approval':'Needs attention'}</strong><span>{p.recorded?'Invoice credit is checked separately.':p.declined?'This offer did not change your agreement.':p.stale?'Documents, terms or review rules changed.':`Reviewing as ${service.actor.role}`}</span></div><div className="review-primary-actions">{action.type==='accept_amendment'&&!p.recorded&&<button className="button secondary review-original-button" disabled={!reusableOriginal&&!!proposalReason} onClick={prepareOriginal}>Keep original terms</button>}{p.recorded||p.declined?<button className="button primary" onClick={()=>onPortfolio(c.id)}>Check the case</button>:p.stale?<button className="button primary" disabled={!!actionReason} onClick={repropose}>Refresh review</button>:action.approval?<button className="button primary" disabled={!!actionReason} onClick={()=>mutate('EXECUTE_ACTION')}>Record decision</button>:<button className="button primary" disabled={!!actionReason} onClick={()=>mutate('APPROVE_ACTION')}>Approve decision</button>}</div></div>
      <div className="decision-body"><ReviewStages presentation={p}/>{p.declined&&<section className="review-declined-reason" aria-label="Recorded decline"><strong>Reason for declining</strong><p>{p.declineReason}</p></section>}
      {!p.recorded&&!p.declined&&(!action.policyDecision.allowed||permissionReason)&&<section className="review-attention" aria-label="Review restrictions"><h3>{permissionReason?'Your role needs another reviewer':'Before this can be approved'}</h3>{permissionReason&&<p>{permissionReason}</p>}{!action.policyDecision.allowed&&<ul>{[...new Set(action.policyDecision.reasons.map(readableReviewReason))].map(reason=><li key={reason}>{reason}</li>)}</ul>}{amendment?.conflictingAmendmentIds.length>0&&<button className="text-button review-choose-alternatives" onClick={()=>{alternativesHeading.current?.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});alternativesHeading.current?.focus({preventScroll:true});}}>Choose between the proposed changes</button>}</section>}
      {p.stale&&<p className="review-stale-note" role="status">The earlier review is out of date. Refresh it before approving or recording.</p>}
      <div className="review-main-art"><ReviewArtwork view={view} presentation={p}/></div>

      {p.renewal&&p.economics&&<details className="review-comparison-details"><summary>Comparison details</summary><p>{p.economics.baseline}</p><dl><div><dt>Comparison spending</dt><dd>{formatMoney(p.economics.baselineCostCents,p.currency)}</dd></div><div><dt>Proposed spending</dt><dd>{formatMoney(p.economics.proposedRenewalCostCents,p.currency)}</dd></div><div><dt>Offered credit</dt><dd>{formatMoney(p.economics.creditCents,p.currency)}</dd></div></dl><RenewalComparison key={action.id} economics={p.economics}/></details>}
      {alternatives.length>0&&!p.recorded&&<section className="amendment-branches review-alternatives" aria-label="Proposed alternatives"><h3 ref={alternativesHeading} tabIndex={-1}>{alternatives.length>1?'Choose which terms to keep':'The proposed terms'}</h3><div className="review-alternative-shelf">{alternatives.map(candidate=>{const source=candidate.sourceLinks.map(l=>view.sourceVersions.find(s=>s.id===l.sourceId&&s.revision===l.revision)).find(Boolean),kind=candidate.newCommitment||candidate.incrementalRenewalCostCents>0?'renewal':candidate.patch.dueDate?'date change':'change';return <section className={`amendment-branch ${candidate.id===amendment?.id?'current':''}`} key={candidate.id}>{source&&<div className="review-alternative-art"><DocumentGraphic reading={documentReading(view,source)} small/></div>}<h4>{kind==='renewal'?'Renewal offer':kind==='date change'?'Date change':'Changed terms'}</h4><p>{candidate.patch.dueDate?dateLabel(candidate.patch.dueDate):candidate.newCommitment?`${formatMoney(candidate.incrementalRenewalCostCents,c.currency)} extra spending`:'Original agreement stays until accepted'}</p><div className="branch-actions"><button className="text-button" disabled={!!proposalReason||candidate.basisStale} onClick={()=>reviewAmendment(candidate.id)}>Review {kind}</button><button className="text-button negative" disabled={!!dismissReason} onClick={()=>{setDeclining(candidate.id);setDismissalReason('');}}>Decline {kind}</button></div>{declining===candidate.id&&<form className="review-decline-form" onSubmit={e=>{e.preventDefault();if(dismissalReason.trim())dismiss(candidate.id);}}><label>Why decline this {kind}?<textarea aria-label="Reason for declining proposed terms" value={dismissalReason} onChange={e=>setDismissalReason(e.target.value)} maxLength={1000} autoFocus required/></label><div><button className="button secondary" type="button" onClick={()=>setDeclining(null)}>Cancel</button><button className="button primary" type="submit" disabled={!!dismissReason||!dismissalReason.trim()}>Record decline</button></div><MutationReason>{dismissReason}</MutationReason></form>}</section>;})}</div></section>}
      <details className="approval-basis"><summary>Approval details</summary><dl><div><dt>Action reference</dt><dd>{action.id}</dd></div><div><dt>Policy</dt><dd>{action.basis.policyVersion}</dd></div><div><dt>Material revision</dt><dd>{action.basis.materialRevision}</dd></div><div><dt>Approver</dt><dd>{action.approval?.actor.id||'Not yet approved'}</dd></div><div><dt>Execution</dt><dd>{action.executed?'One local action recorded':'Not recorded'}</dd></div></dl><details><summary>Exact review restrictions</summary><ul>{action.policyDecision.reasons.map(reason=><li key={reason}>{reason}</li>)}</ul></details></details>
      <details className="decision-source-list"><summary>Documents used in this review <span>{action.basis.sourceRevisions.length}</span></summary><p>The review includes all listed versions; inclusion alone does not establish support for every term.</p>{action.basis.sourceRevisions.map(binding=>{const sourceNode=resolveEvidenceNode(view,`source:${binding.id}@${binding.revision}`);return <button className="source-button decision-source-button" key={`${binding.id}@${binding.revision}`} disabled={!sourceNode} onClick={event=>{sourceOpener.current=event.currentTarget;setNodeId(sourceNode.id);}}><span><strong>{sourceNode?.label||binding.id}</strong><small>Version {binding.revision}</small></span></button>;})}</details>{node&&<SourceDetail key={node.id} node={node} view={view} onSelect={setNodeId} onClose={closeEvidence} returnLabel="Return to this action review" service={service} readOnly={readOnly}/>}<p className="review-local-outcome">{p.recorded?'This decision is in the local record.':'Approval and recording change the local record.'} No email is sent and no invoice credit is created.</p>
      </div></article>}
  </div>;
}

function Portfolio({view,service,readOnly,onDecisions,onImport,focusTarget,initialOpen=false,onSelectCase,onBackToList}) {
  const [search,setSearch]=useState('');
  const [filter,setFilter]=useState('all');
  const [sort,setSort]=useState('applied-desc');
  const [detail,setDetail]=useState('evidence');
  const [opened,setOpened]=useState(Boolean(focusTarget)||initialOpen);
  const [nodeId,setNode]=useState(null);
  const historyHeading=useRef(null), caseTransition=useRef(null), caseScroll=useRef(null);
  const detailHeading=useRef(null), caseOpener=useRef(null), sourceOpener=useRef(null), results=useRef(null), searchInput=useRef(null);
  const node=resolveEvidenceNode(view,nodeId);
  useEffect(()=>()=>caseTransition.current?.cancel(),[]);
  useEffect(()=>{if(focusTarget){setOpened(true);setDetail(['ledger','history','evidence'].includes(focusTarget.destination)?focusTarget.destination:'evidence');}else if(focusTarget===null){setOpened(false);setNode(null);}},[focusTarget]);
  useEffect(()=>{if(initialOpen)setOpened(true);},[initialOpen]);
  useLayoutEffect(()=>{if(nodeId&&!node)setNode(null);},[nodeId,node]);
  const selected=view.commitments.find(c=>c.id===service.selectedId)||(!focusTarget?view.commitments[0]:null);
  const readHistory=useMemo(()=>createHistoryCopy(service.workspace),[service.workspace]);
  const previousSelection=useRef({opened:false,id:null});
  useLayoutEffect(()=>{const previous=previousSelection.current;previousSelection.current={opened,id:selected?.id};if(opened&&(!previous.opened||previous.id!==selected?.id)){detailHeading.current?.focus();}else if(!opened&&previous.opened){const row=[...(results.current?.querySelectorAll('[data-case]')||[])].find(element=>element.dataset.case===selected?.id);(row||caseOpener.current||searchInput.current)?.focus();}},[opened,selected?.id]);
  const {rows:filtered,counts}=useMemo(()=>selectFollowups(view,{query:search,filter,sort}),[view,search,filter,sort]);
  const events=service.workspace.events.filter(e=>e.observedAt<=view.knownAt).filter(e=>e.payload.commitment?.id===selected?.id||e.payload.commitmentId===selected?.id||e.payload.amendment?.commitmentId===selected?.id||e.payload.action?.commitmentId===selected?.id||selected?.sourceLinks.some(l=>e.payload.source?.id===l.sourceId)||selected?.allocations.some(a=>e.payload.creditId===a.creditId||e.payload.credit?.id===a.creditId||e.payload.allocation?.creditId===a.creditId));
  const openAmendments=view.amendments.filter(a=>a.commitmentId===selected?.id&&!a.accepted&&!a.rejected);
  const adverseOffer=view.actions.find(a=>a.commitmentId===selected?.id&&a.economics?.netIncrementalValueCents<0&&!view.amendments.find(m=>m.id===a.payload.amendmentId)?.rejected);
  const review=selected?originalReviewState(service.workspace,view,selected):null;
  const proposalReason=writeReason(service,readOnly,'PROPOSE_ACTION');
  const relatedCredits=selected?view.credits.filter(c=>c.vendorId===selected.vendorId&&c.reference===selected.reference):[];
  const sourceLinks=selected?[...selected.sourceLinks,...view.amendments.filter(a=>a.commitmentId===selected.id).flatMap(a=>a.sourceLinks||[]),...relatedCredits.flatMap(c=>[...c.sourceLinks,...(c.applicationSourceLinks||[]),...c.allocations.flatMap(a=>a.sourceLinks||[])])]:[];
  const seenSources=new Set();
  const documents=sourceLinks.filter(link=>{const key=`${link.sourceId}@${link.revision}`;if(seenSources.has(key))return false;seenSources.add(key);return true;}).map(link=>({link,source:view.sourceVersions.find(s=>s.id===link.sourceId&&s.revision===link.revision)}));
  function openEvidence(id){sourceOpener.current=document.activeElement;setNode(id);}
  function closeEvidence(){setNode(null);requestAnimationFrame(()=>sourceOpener.current?.focus());}
  function visiblePart(id,part){return [...document.querySelectorAll(`[data-case-${part}]`)].find(element=>element.getAttribute(`data-case-${part}`)===id&&element.getClientRects().length&&getComputedStyle(element).visibility!=='hidden');}
  function changeCase(update,returning=false,id=selected?.id){
    const active=caseTransition.current;
    if(returning&&active&&!active.returning){
      active.returning=true;
      flushSync(update);scrollTo(active.scroll.x,active.scroll.y);
      for(const part of active.parts){const target=visiblePart(active.id,part.kind);if(target){active.hidden.push([target,target.style.visibility]);target.style.visibility='hidden';}}
      active.animations.forEach(animation=>animation.reverse());
      Promise.allSettled(active.animations.map(animation=>animation.finished)).then(active.cancel);return;
    }
    active?.cancel();
    const startScroll={x:scrollX,y:scrollY};
    const parts=['mark','title'].flatMap(kind=>{const element=visiblePart(id,kind);if(!element)return [];const rect=element.getBoundingClientRect();if(rect.bottom<0||rect.top>innerHeight)return [];const clone=element.cloneNode(true),style=getComputedStyle(element);clone.removeAttribute('id');clone.removeAttribute('data-case-mark');clone.removeAttribute('data-case-title');clone.removeAttribute('tabindex');clone.setAttribute('aria-hidden','true');clone.inert=true;clone.classList.add('case-moving-paper');Object.assign(clone.style,{position:'fixed',left:`${rect.left}px`,top:`${rect.top}px`,width:`${rect.width}px`,height:`${rect.height}px`,margin:'0',zIndex:'1000',pointerEvents:'none',transformOrigin:'top left',fontFamily:style.fontFamily,fontSize:style.fontSize,fontWeight:style.fontWeight,lineHeight:style.lineHeight,letterSpacing:style.letterSpacing,color:style.color,viewTransitionName:'none'});return [{kind,clone,rect,fontSize:parseFloat(style.fontSize)}];});
    flushSync(update);
    if(returning&&caseScroll.current)scrollTo(caseScroll.current.x,caseScroll.current.y);else caseScroll.current=startScroll;
    if(matchMedia('(prefers-reduced-motion: reduce)').matches||!parts.length)return;
    const hidden=[],animations=[];
    for(const part of parts){const target=visiblePart(id,part.kind);if(!target)continue;const end=target.getBoundingClientRect(),scale=part.kind==='title'?parseFloat(getComputedStyle(target).fontSize)/part.fontSize:end.width/part.rect.width;
      hidden.push([target,target.style.visibility]);target.style.visibility='hidden';document.body.append(part.clone);
      animations.push(part.clone.animate([{transform:'translate(0,0) scale(1)'},{transform:`translate(${end.left-part.rect.left}px,${end.top-part.rect.top}px) scale(${scale})`}],{duration:420,easing:'cubic-bezier(.2,.75,.25,1)',fill:'both'}));
    }
    const motion={id,parts,animations,hidden,scroll:startScroll,returning,disposed:false,cancel:()=>{if(motion.disposed)return;motion.disposed=true;animations.forEach(animation=>animation.cancel());parts.forEach(part=>part.clone.remove());hidden.forEach(([element,visibility])=>{element.style.visibility=visibility;});if(caseTransition.current===motion)caseTransition.current=null;}};
    caseTransition.current=motion;Promise.allSettled(animations.map(animation=>animation.finished)).then(()=>{if(!motion.returning)motion.cancel();});
  }
  function choose(id,opener){caseOpener.current=opener;changeCase(()=>{service.setSelectedId(id);setNode(null);setDetail('evidence');setOpened(true);onSelectCase?.(id);},false,id);}
  function backToResults(){changeCase(()=>{setOpened(false);setNode(null);onBackToList?.();},true);}
  useLayoutEffect(()=>{const cancel=event=>{if(event.key==='Escape'&&opened&&caseTransition.current&&detailHeading.current?.getClientRects().length&&!document.querySelector('dialog[open]')){event.preventDefault();backToResults();}};document.addEventListener('keydown',cancel);return()=>document.removeEventListener('keydown',cancel);},[opened]);
  async function reviewOriginal(){
    if(review.action){onDecisions(selected.id,review.action.id);return;}
    try{const reply=await service.command({type:'PROPOSE_ACTION',action:review.specification});if(reply?.result?.actionId)onDecisions(selected.id,reply.result.actionId);}catch(error){service.setError(error.message);}
  }
  const fulfilled=selected?.outstandingCents===0&&!selected?.conditions.length;
  const noteWaiting=selected?.issuedCents>0&&selected?.verifiedCents===0;
  const changesWaiting=openAmendments.length>0;
  const nextTitle=fulfilled?'The full credit is on an invoice':noteWaiting?'Check that the credit note reached your bill':changesWaiting?(selected.conditions.length?'Review the renewal offer':'They proposed changing the original promise'):review?.action?.executed?'The review was recorded':'Review a request for the promised credit';
  const nextDescription=fulfilled?'You can inspect the original documents and the record of changes.':noteWaiting?'Open the credit note, then add the invoice that shows the deduction.':changesWaiting?(adverseOffer?`${money(adverseOffer.economics.creditCents)} of credit comes with ${money(adverseOffer.economics.incrementalRenewalCostCents)} in extra spending. ${selected.conditions.length?'The offer has not been accepted.':'The original agreement still applies.'}`:'They proposed different terms. Check what would change before agreeing.'):review?.action?.executed?'The local step is recorded. An invoice is still needed to confirm the deduction.':'Check the exact request before recording approval. No email is sent here.';
  function nextStep(){if(noteWaiting){setDetail('ledger');return;}if(changesWaiting){onDecisions(selected.id,adverseOffer?.id||view.actions.findLast(a=>a.commitmentId===selected.id&&a.type==='accept_amendment')?.id);return;}reviewOriginal();}
  const nextLabel=noteWaiting?'Open the credit note':changesWaiting?(selected.conditions.length?'Review the offer':'Compare the proposed terms'):review?.action?.executed?'Read the recorded review':'Review requesting the credit';

  return <div className={`followups-layout assurance-master-detail ${opened?'case-open':'list-open'}`}>
    <section hidden={opened} className="followups-list assurance-register" aria-label="All follow-ups" ref={results}>
      <div className="casebook-opening"><div className="casebook-cover"><span className="cover-caption">The correspondence file</span><h2>Did they put it on the invoice?</h2><p>The promise. The bill. What still needs sorting.</p><PromisePapers view={view} commitment={view.commitments.find(c=>c.verifiedCents>0&&c.outstandingCents>0)||view.commitments.find(c=>!c.conditions.length)} onOpen={choose}/><span className="cover-note">Open a company to see the original documents.</span></div><div className="casebook-index"><div className="casebook-index-heading"><h3>Your conversations</h3><span>{view.commitments.length} companies</span></div>
      <div className="followups-results-toolbar"><label className="assurance-search"><Search size={17}/><input ref={searchInput} aria-label="Search follow-ups" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Find a company…"/></label><details className="casebook-filters"><summary>Filter & sort</summary><div className="followups-status-filters" role="group" aria-label="Filter follow-ups by status">{followupFilters.map(option=><button key={option.id} data-filter={option.id} aria-pressed={filter===option.id} onClick={()=>setFilter(option.id)}>{({all:'All conversations',owed:'Waiting on an invoice',issued:'Credit note received',conditional:'Offers to consider',completed:'Finished'})[option.id]}<span>{counts[option.id]}</span></button>)}</div><label className="followups-sort">Order<select aria-label="Sort follow-ups" value={sort} onChange={e=>setSort(e.target.value)}>{followupSorts.map(option=><option key={option.id} value={option.id}>{option.label}</option>)}</select></label></details></div>
      <CorrespondenceIndex view={view} rows={filtered} onOpen={choose}/>
      {!filtered.length&&<div className="assurance-empty followups-empty"><h2>{search||filter!=='all'?'No matching follow-ups':'No follow-ups yet'}</h2><p>{search||filter!=='all'?'Try a different company, reference, or status.':'Add an agreement or invoice to start tracking a credit.'}</p>{search||filter!=='all'?<button className="button secondary" onClick={()=>{setSearch('');setFilter('all');searchInput.current?.focus();}}>Clear filters</button>:<button className="button primary" onClick={onImport}>Add documents</button>}</div>}
      <div className="followups-results-footer"><span role="status">{filtered.length} conversations</span><button className="text-button" onClick={onImport}>Add a promise or invoice</button></div></div></div>
    </section>
    <div hidden={!opened}>{selected?<article className="followups-detail assurance-case">
      <div className="followup-back"><button className="text-button" onClick={backToResults}><ArrowRight size={14}/>Back to cases</button><span>{selected.reference}</span></div>
      <header><div><CompanyMark name={vendorFor(view,selected)} transitionId={selected.id}/><h2 ref={detailHeading} tabIndex={-1} data-case-title={selected.id} style={{viewTransitionName:`${caseTransitionName(selected.id)}-title`}}>{vendorFor(view,selected)}</h2><p>{selected.conditions.length?'Conditional credit offer':'Vendor credit'} · USD</p></div></header>
      <div className="portfolio-case-body">
        <section className="case-next-action" aria-label="Next action for selected commitment"><div className="case-next-action-copy"><h3>{nextTitle}</h3><p>{nextDescription}</p></div><div className="case-next-action-buttons">{fulfilled?<button className="button secondary" onClick={()=>{setDetail('history');requestAnimationFrame(()=>historyHeading.current?.focus());}}>View history</button>:<button className="button primary" disabled={!noteWaiting&&!changesWaiting&&!review.action&&!!proposalReason} onClick={nextStep}>{nextLabel}</button>}</div>{!noteWaiting&&!changesWaiting&&<MutationReason>{!review.action&&selected.outstandingCents>0?proposalReason:''}</MutationReason>}</section>
        <CaseExplanation view={view} commitment={selected}/>
        <details className="financial-record-details"><summary>Exact amounts & dates</summary><Status value={selected.status}/><dl className="case-financial-ledger"><div><dt>{selected.conditions.length?'Offer amount':selected.promisedCents!==selected.originalPromisedCents?'Accepted amount':'Agreed amount'}</dt><dd>{money(selected.promisedCents)}</dd>{selected.promisedCents!==selected.originalPromisedCents&&<small>Originally {money(selected.originalPromisedCents)}</small>}</div><div><dt>Applied to invoices</dt><dd>{money(selected.verifiedCents)}</dd></div><div><dt>Issued, not applied</dt><dd>{money(selected.issuedCents)}</dd></div></dl></details>

        {selected.sourceChanged&&<div className="assurance-warning"><AlertTriangle size={17}/><p>A document has a newer revision. Review it before acting.</p></div>}
        {(selected.incrementalObligationCents>0||selected.futureIncrementalObligationCents>0)&&<div className="assurance-warning"><AlertTriangle size={17}/><p>Additional accepted spend: {money(selected.incrementalObligationCents)} now; {money(selected.futureIncrementalObligationCents)} scheduled. Applied credit less additional spend: {money(selected.netVerifiedValueCents)}.</p></div>}
        {selected.futureAcceptedAmendmentIds.length>0&&<div className="historical-notice"><Clock3 size={16}/><p>Accepted changes take effect on a future date. Current terms still apply.</p></div>}

        <div className="assurance-detail-switch" role="group" aria-label="Case information"><button aria-pressed={detail==='evidence'} onClick={()=>setDetail('evidence')}><FileText size={15}/>Documents<span>{documents.length}</span></button><button aria-pressed={detail==='ledger'} onClick={()=>setDetail('ledger')}><FileCheck2 size={15}/>Credits<span>{relatedCredits.length}</span></button><button aria-pressed={detail==='history'} onClick={()=>setDetail('history')}><History size={15}/>History</button></div>
        <div hidden={detail!=='evidence'}><section className="followup-documents" aria-label="Case documents">{documents.map(({link,source})=><button className="followup-document" key={`${link.sourceId}@${link.revision}`} disabled={!source} onClick={()=>openEvidence(`source:${link.sourceId}@${link.revision}`)}>{source?<span className="case-source-art"><DocumentGraphic reading={documentReading(view,source)} small/></span>:<FileText size={20}/>}<span><strong>{source?documentReading(view,source).title:link.sourceId}</strong><small>{source?documentReading(view,source).label:'Unavailable'} · {dateLabel(source?.observedAt)}</small></span></button>)}{!documents.length&&<p className="followup-no-documents">No documents in this snapshot.</p>}</section>{node&&<SourceDetail key={node.id} node={node} view={view} onSelect={setNode} onClose={closeEvidence} returnLabel="Return to this document" service={service} readOnly={readOnly}/>}<details className="followup-terms"><summary>Agreed terms<ChevronDown size={14}/></summary><dl><div><dt>Due date</dt><dd>{dateLabel(selected.dueDate)}</dd></div><div><dt>Claim deadline</dt><dd>{dateLabel(selected.claimDeadline)}</dd></div><div><dt>Conditions</dt><dd>{selected.conditions.join('; ')||'None'}</dd></div></dl></details><details className="followup-relationships"><summary>Related records<ChevronDown size={14}/></summary><EvidenceGraph view={view} commitment={selected} onSource={openEvidence}/></details><AmendmentEditor key={`amendment-${selected.id}`} view={view} commitment={selected} service={service} readOnly={readOnly} onReview={onDecisions}/></div>
        <div hidden={detail!=='ledger'}><CreditWorkspace key={`credit-${selected.id}`} view={view} commitment={selected} service={service} readOnly={readOnly}/></div>
        <section hidden={detail!=='history'} className="assurance-history"><div className="assurance-section-title"><h3 ref={historyHeading} tabIndex={-1}>Recorded history</h3><span>{events.length} records</span></div>{events.slice().reverse().map(event=><div key={event.id}><span><Activity size={14}/></span><div><strong>{readHistory(event).title}</strong><p>{readHistory(event).detail}</p><details><summary>Exact event details</summary><small>{commandName(event.type)} · {event.id}</small><p>Effective {dateLabel(event.effectiveDate)}<span>Known {dateLabel(event.observedAt)}</span></p><small>{event.actor.role} · {event.actor.id}</small></details></div></div>)}{!events.length&&<p>No activity in this snapshot.</p>}</section>
      </div>
    </article>:<div className="assurance-empty"><h2>No follow-ups in this snapshot.</h2><p>Choose a later date to include newer records.</p><button className="button secondary" onClick={backToResults}>Back to cases</button></div>}</div>
  </div>;
}

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
  return <div className="failure-lab"><div className="failure-lab-intro"><div><h2>Workflow checks</h2><p>Run sample cases and inspect rejected actions.</p></div><button className="button primary" onClick={()=>run(true)} disabled={running}><Play size={15}/>{running?'Running cases…':'Run all cases'}</button></div><div className="failure-layout"><section className="scenario-list" aria-label="Failure scenarios">{scenarios.map(s=><button key={s.id} className={selected===s.id?'selected':''} onClick={()=>setSelected(s.id)}><span>{results[s.id]?results[s.id].passed?<CheckCheck size={17}/>:<AlertTriangle size={17}/>:<Beaker size={17}/>}</span><span><strong>{s.name}</strong><small>{results[s.id]?results[s.id].passed?'Checks passed':'Needs investigation':'Not run yet'}</small></span><ChevronRight size={15}/></button>)}</section><section className="scenario-result" aria-live="polite"><div className="assurance-section-title"><h3>{scenario?.name}</h3><button className="text-button" onClick={()=>run(false)} disabled={running}>Run case<Play size={13}/></button></div><p className="scenario-description">{scenario?.description}</p>{result?<><div className={`scenario-verdict ${result.passed?'passed':'failed'}`}>{result.passed?<ShieldCheck size={22}/>:<ShieldX size={22}/>}<span><strong>{result.passed?'The expected boundary held.':'A check failed.'}</strong><small>{result.checks.filter(c=>c.passed).length} of {result.checks.length} checks passed</small></span></div><div className="scenario-checks">{result.checks.map((check,i)=><div key={i}>{check.passed?<Check size={15}/>:<X size={15}/>}<div><strong>{check.name}</strong><p>{check.detail}</p></div></div>)}</div><details className="scenario-steps"><summary>Inspect {result.steps.length} executed steps<ChevronDown size={14}/></summary>{result.steps.map((step,i)=><div key={i}><span className={step.error?'rejected':'recorded'}>{step.error?'Blocked':'Recorded'}</span><div><strong>{commandName(step.command.type)}</strong><p>{step.error?`${step.error.code}: ${step.error.message}`:`Event revision ${step.revision}`}</p></div></div>)}</details></>:<div className="scenario-not-run"><Beaker size={28}/><p>Run this case to inspect the actual outcome and rejected commands.</p></div>}</section></div><div className="failure-lab-footer"><span>{Object.values(results).filter(r=>r.passed).length}/{scenarios.length} authored cases passed</span><p>Synthetic regression cases. These results are not held-out accuracy, a formal proof, or competitor performance.</p></div><details className="command-console"><summary><Terminal size={16}/>Advanced commands against this workspace<ChevronDown size={14}/></summary><form onSubmit={submit}><label>Command example<select aria-label="Command example" value={template} onChange={e=>{setTemplate(e.target.value);setCommand(JSON.stringify(commandExamples[e.target.value],null,2));}}>{Object.keys(commandExamples).map(name=><option key={name}>{name}</option>)}</select></label><label htmlFor="workspace-command">Structured command</label><textarea id="workspace-command" value={command} onChange={e=>setCommand(e.target.value)} maxLength={250000} spellCheck={false}/><div className="assurance-inline-actions"><small>Mutates the synthetic workspace through the same checked boundary.</small><button className="button primary" disabled={!!commandReason} type="submit">Run command<ArrowRight size={14}/></button></div><MutationReason>{commandReason}</MutationReason></form>{commandResult&&<div className={`command-result ${commandResult.ok?'allowed':'denied'}`} role="status"><strong>{commandResult.ok?'Recorded':'Rejected'}</strong><p>{commandResult.message}</p>{commandResult.result&&<pre>{JSON.stringify(commandResult.result,null,2)}</pre>}</div>}</details></div>;
}

function PolicyPanel({view,service,readOnly}) {
  const [claimLimit,setClaimLimit]=useState(String(view.policy.claimLimitCents/100));
  const [renewalLimit,setRenewalLimit]=useState(String(view.policy.renewalLimitCents/100));
  const [allow,setAllow]=useState(view.policy.allowNewCommitments);
  const reason=writeReason(service,readOnly,'SET_POLICY');
  async function save(event){event.preventDefault();try{await service.command({type:'SET_POLICY',policy:{claimLimitCents:moneyToCents(claimLimit),renewalLimitCents:moneyToCents(renewalLimit),allowNewCommitments:allow}});}catch(e){service.setError(e.message);}}
  return <details className="policy-panel"><summary><ShieldCheck size={16}/><span>Approval policy: {view.policy.allowNewCommitments?'new obligations need a bounded approval':'no new contractual obligations'}</span><ChevronDown size={14}/></summary><form onSubmit={save}><div className="policy-inputs"><label>Claim limit, USD<input aria-label="Claim approval limit" disabled={!!reason} value={claimLimit} inputMode="decimal" onChange={e=>setClaimLimit(e.target.value)}/></label><label>Incremental renewal limit, USD<input aria-label="Renewal approval limit" disabled={!!reason} value={renewalLimit} inputMode="decimal" onChange={e=>setRenewalLimit(e.target.value)}/></label></div><label className="policy-checkbox"><input type="checkbox" disabled={!!reason} checked={allow} onChange={e=>setAllow(e.target.checked)}/>Allow proposals with new contractual obligations</label><div className="assurance-inline-actions"><p>A changed policy invalidates pending approvals. Only a workspace administrator can change this policy.</p><button className="button secondary" disabled={!!reason} type="submit">Save approval policy</button></div><MutationReason>{reason}</MutationReason></form></details>;
}

export default function Assurance({service,onImport,target,onSelectCase,onSelectAction,onBackToList}) {
  const [tab,setTab]=useState('portfolio');
  useLayoutEffect(()=>{if(target){service.setSelectedId(target.commitmentId);setDecisionAction(target.actionId||null);setTab(target.destination==='decisions'?'decisions':'portfolio');}else if(target===null){setDecisionAction(null);setCaseOpen(false);setTab('portfolio');}},[target]);
  const [asOf,setAsOf]=useState(today);
  const [knownDate,setKnownDate]=useState(today);
  const [showGuide,setShowGuide]=useState(false);
  const [confirmReset,setConfirmReset]=useState(false);
  const [decisionAction,setDecisionAction]=useState(null);
  const [caseOpen,setCaseOpen]=useState(Boolean(target));
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
  const managed=service.authMode==='managed-password';
  const resetReason=writeReason(service,readOnly,'RESET_WORKSPACE');
  async function exportEvidence(){try{download(await service.exportPacket({asOf,knownAt:`${knownDate}T23:59:59.999Z`}),'truthful-assurance-evidence.json');}catch(e){service.setError(e.message);}}
  if(!view)return <main className="assurance followups-page"><div className="assurance-loading"><Database size={26}/><h1>Opening follow-ups…</h1><p>Checking the local service and recorded evidence.</p></div></main>;
  if(view.error)return <main className="assurance followups-page"><div className="assurance-error" role="alert"><AlertTriangle size={20}/><p>{view.error}</p><button className="button secondary" onClick={()=>{setAsOf(today());setKnownDate(today());}}>Use latest dates</button></div></main>;
  return <main data-section={tab} className="assurance followups-page"><div className="assurance-page-heading"><div><h1>Cases</h1><p>Your promises, invoices and replies.</p></div><details ref={workspaceOptions} className="workspace-options"><summary>File options<ChevronDown size={14}/></summary><div className="workspace-options-body"><div className="portfolio-workspace-actions">{!managed&&<button className="button secondary" onClick={()=>{setShowGuide(!showGuide);workspaceOptions.current.open=false;workspaceOptions.current.querySelector("summary")?.focus();}} aria-expanded={showGuide}><CircleHelp size={15}/>How this demo works</button>}<button className="button secondary" onClick={exportEvidence} disabled={service.busy}><ArrowDownToLine size={15}/>Export records</button>{!managed&&<><button className="text-button" onClick={()=>{setConfirmReset(!confirmReset);workspaceOptions.current.open=false;requestAnimationFrame(()=>resetConfirmation.current?.focus());}} disabled={!!resetReason}><RotateCcw size={13}/>Reset demo workspace</button><MutationReason>{resetReason}</MutationReason></>}</div><div className="assurance-runtime">{managed?<div><span>Your role</span><strong>{service.actor.role}</strong></div>:<label>Demo role<select aria-label="Demo actor role" value={service.actor.role} disabled={service.busy} onChange={e=>service.changeRole(e.target.value)}>{[['admin','Admin'],['analyst','Analyst'],['approver','Approver'],['executor','Executor'],['viewer','Read only']].map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>}</div></div></details></div>

    {showGuide&&!managed&&<section className="mechanism-guide"><div><h2>One promise. Several ways to get it wrong.</h2><button className="icon-button" aria-label="Close mechanism guide" onClick={()=>setShowGuide(false)}><X size={17}/></button></div><ol><li>Open Pipeline’s proposed renewal. A $1,500 credit can cost $2,400 in incremental spend.</li><li>Approve an original-terms action, then revise a supporting source or change the approval policy. The approval becomes unusable.</li><li>Move “Known by” backward to replay what the system could have known before later evidence arrived.</li><li>Run the failure cases: duplicate allocation, late evidence, policy changes, reversals, and one-use execution.</li></ol><p>All counterparties and sources are synthetic. Actions record local state; no vendor transaction is performed.</p></section>}
    {service.error&&<div className="assurance-error" role="alert"><AlertTriangle size={18}/><p>{service.error}</p><button className="icon-button" aria-label="Dismiss workspace error" onClick={()=>service.setError('')}><X size={16}/></button></div>}

    <div className="assurance-navigation"><div role="group" aria-label="Follow-up views">{[['portfolio',Layers3,'Conversations'],['decisions',ShieldCheck,'Reviews']].map(([id,Icon,label])=><button key={id} aria-pressed={tab===id} onClick={()=>{if(id==='decisions'){setDecisionAction(null);onSelectAction?.(service.selectedId,null);}else if(caseOpen||target){onSelectCase?.(service.selectedId);}else onBackToList?.();setTab(id);}}><Icon size={16}/>{label}{id==='decisions'&&<span>{reviewFiles(view).filter(a=>!a.executed&&view.commitments.some(c=>c.id===a.commitmentId)).length}</span>}</button>)}</div><details className="followups-more"><summary>More<ChevronDown size={14}/></summary><button onClick={event=>{setTab('lab');event.currentTarget.parentElement.open=false;}}>Run checks</button></details></div>
    {confirmReset&&!managed&&<div className="assurance-warning reset-confirmation"><AlertTriangle size={18}/><div><strong>Restore the synthetic starting workspace?</strong><p>Export your current records first. Local service audit history is retained; browser records are replaced.</p></div><button className="button secondary" onClick={()=>setConfirmReset(false)}>Cancel</button><button className="button primary" ref={resetConfirmation} onClick={async()=>{try{await service.resetDemo();setConfirmReset(false);workspaceOptions.current?.querySelector("summary")?.focus();}catch(error){service.setError(error.message);}}} disabled={!!resetReason}>Confirm reset</button><MutationReason>{resetReason}</MutationReason></div>}
    {tab!=='lab'&&<details className="history-disclosure" open={readOnly||undefined}><summary ref={historyToggle}><span><History size={15}/>View past records</span><span>{readOnly?'Historical comparison':'Current records'}<ChevronDown size={14}/></span></summary><div className="replay-controls"><div><History size={16}/><span>Replay the recorded evidence</span></div><label>Effective on<input type="date" aria-label="Financial effective date" value={asOf} onChange={e=>setAsOf(e.target.value)}/></label><label>Known by<input type="date" aria-label="Knowledge cutoff date" value={knownDate} onChange={e=>setKnownDate(e.target.value)}/></label>{readOnly&&<button className="text-button" onClick={()=>{setAsOf(today());setKnownDate(today());historyToggle.current?.focus();}}>Return to latest<ArrowRight size={13}/></button>}</div></details>}
    {readOnly&&tab!=='lab'&&<div className="historical-notice"><Clock3 size={15}/>Past records are read only. Later documents are excluded.</div>}
    <div hidden={tab!=='portfolio'}><Portfolio view={view} onSelectCase={onSelectCase} onBackToList={onBackToList} initialOpen={caseOpen} focusTarget={target} service={service} readOnly={readOnly} onImport={onImport} onDecisions={(id,actionId)=>{setCaseOpen(true);service.setSelectedId(id);setDecisionAction(actionId||null);setTab('decisions');onSelectAction?.(id,actionId||null);}}/></div>
    {tab==='decisions'&&<DecisionRoom view={view} service={service} readOnly={readOnly} initialCommitment={service.selectedId} initialAction={target?.destination==='decisions'?target.actionId:decisionAction} onSelection={onSelectAction} onPortfolio={id=>{setCaseOpen(Boolean(id));if(id){service.setSelectedId(id);onSelectCase?.(id);}else onBackToList?.();setTab('portfolio');}}/>}
    {tab==='lab'&&<FailureLab service={service} readOnly={readOnly}/>}
    {tab!=='lab'&&<details className="record-tools"><summary>Review rules</summary><PolicyPanel key={view.policy.version} view={view} service={service} readOnly={readOnly}/></details>}
    {(!managed||!validateWorkspace(service.workspace).valid)&&<footer className="assurance-footnote"><span><ShieldCheck size={14}/>{validateWorkspace(service.workspace).valid?'Demo data':'Credit balances need review.'}</span>{!managed&&<p>Actions stay in this demo workspace.</p>}</footer>}
  </main>;
}
