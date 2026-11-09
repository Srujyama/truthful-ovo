import React,{useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {ArrowUpRight,BookOpen,Pause,Play,Plus,Minus,Maximize2,Search,X,FileText,ShieldCheck,Landmark,FlaskConical,Inbox,LibraryBig} from 'lucide-react';
import {deriveClearingHouse,STATIONS,money,exactMoney} from './state.mjs';
import {bakeWorld,cameraFor,paintWorld,screenPoint,createSceneClock} from './renderer.mjs';
import WorkspaceAccount from '../WorkspaceAccount.jsx';
import './clearing-house.css';

const icons={archive:LibraryBig,review:ShieldCheck,exchange:BookOpen,vault:Landmark,lab:FlaskConical,dispatch:Inbox};
function useReducedMotion(){const [reduced,setReduced]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);useEffect(()=>{const m=matchMedia('(prefers-reduced-motion: reduce)'),change=()=>setReduced(m.matches);m.addEventListener('change',change);return()=>m.removeEventListener('change',change);},[]);return reduced;}

function WorldMap({selected,onSelect,stations,revision,transition}){
 const host=useRef(null),canvas=useRef(null),cache=useRef(null),drag=useRef(null),lastRevision=useRef(revision),courier=useRef(null),sceneClock=useRef(createSceneClock()),reduced=useReducedMotion();
 const [size,setSize]=useState({width:1000,height:650}),[zoom,setZoom]=useState(1),[pan,setPan]=useState({x:0,y:0}),[paused,setPaused]=useState(false);
 useLayoutEffect(()=>{const observer=new ResizeObserver(([entry])=>setSize({width:entry.contentRect.width,height:entry.contentRect.height}));observer.observe(host.current);return()=>observer.disconnect();},[]);
 const focus=size.width<650?STATIONS.find(s=>s.id===selected):null;
 const camera=cameraFor(size.width,size.height,{zoom:zoom*(focus?3:1),focus:focus?{x:focus.x,y:focus.y-25}:null,pan});
 useEffect(()=>{setPan({x:0,y:0});},[selected]);
 useEffect(()=>{if(lastRevision.current!==revision&&lastRevision.current!=null&&transition)courier.current={elapsed:0,...transition};lastRevision.current=revision;},[revision,transition]);
 useEffect(()=>{
  if(!cache.current)cache.current=bakeWorld();const element=canvas.current,ctx=element.getContext('2d');let raf=0,alive=true;
  sceneClock.current.suspend();const resolution=2;element.width=Math.ceil(size.width/resolution);element.height=Math.ceil(size.height/resolution);
  const paint=time=>{if(!alive)return;const delta=sceneClock.current.step(time,!paused&&!reduced&&!document.hidden);if(courier.current)courier.current.elapsed+=delta;const c={scale:camera.scale/resolution,x:camera.x/resolution,y:camera.y/resolution};const elapsed=courier.current?courier.current.elapsed/1900:null;if(elapsed>=1)courier.current=null;element.dataset.courierProgress=courier.current?String(elapsed):'';
   paintWorld(ctx,cache.current,element.width,element.height,c,{selected,time:reduced?0:sceneClock.current.elapsed/1000,reduced:reduced||paused,courier:elapsed!==null&&!reduced&&courier.current?{...courier.current,progress:elapsed}:null});
   if(!reduced&&!paused&&!document.hidden)raf=requestAnimationFrame(paint);
  };
  const resume=()=>{cancelAnimationFrame(raf);sceneClock.current.suspend();paint(performance.now());};document.addEventListener('visibilitychange',resume);paint(performance.now());
  return()=>{alive=false;cancelAnimationFrame(raf);document.removeEventListener('visibilitychange',resume);};
 },[size.width,size.height,camera.scale,camera.x,camera.y,selected,reduced,paused,revision]);
 const fit=()=>{setZoom(1);setPan({x:0,y:0});};
 return <div className="clearing-map" ref={host} aria-label="Financial clearing house map">
  <canvas ref={canvas} aria-hidden="true" onPointerDown={e=>{if(e.button!==0)return;drag.current={x:e.clientX,y:e.clientY,pan};e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{if(drag.current)setPan({x:drag.current.pan.x+e.clientX-drag.current.x,y:drag.current.pan.y+e.clientY-drag.current.y});}} onPointerUp={e=>{const start=drag.current;drag.current=null;if(!start||Math.hypot(e.clientX-start.x,e.clientY-start.y)>5)return;const box=host.current.getBoundingClientRect(),x=(e.clientX-box.left-camera.x)/camera.scale,y=(e.clientY-box.top-camera.y)/camera.scale;const hit=STATIONS.filter(s=>Math.abs(x-s.x)<75&&y>s.y-160&&y<s.y+15).sort((a,b)=>Math.hypot(x-a.x,y-a.y+65)-Math.hypot(x-b.x,y-b.y+65))[0];if(hit)onSelect(hit.id);}} onPointerCancel={()=>drag.current=null}/>
  <div className="station-anchors">{stations.map(s=>{const position=screenPoint({x:s.x,y:s.y+28},camera),Icon=icons[s.id],visible=position.x>55&&position.x<size.width-55&&position.y>0&&position.y<size.height-70;return <button key={s.id} className={`station-anchor ${selected===s.id?'selected':''}`} style={{left:position.x,top:position.y,visibility:visible?'visible':'hidden'}} tabIndex={visible?0:-1} aria-hidden={!visible} aria-label={`${s.name}, ${s.count} ${s.id==='vault'?'fulfilled cases':'records'}`} aria-pressed={selected===s.id} onClick={()=>onSelect(s.id)}><span className="station-anchor-title"><Icon size={13}/>{s.name}</span><span>{s.id==='vault'?`${s.count} fulfilled`:s.id==='archive'?`${s.count} source records`:s.id==='review'?`${s.count} open actions`:s.id==='exchange'?`${s.count} credit lines`:s.id==='lab'?`${s.count} approved actions`:`${s.count} next steps`}</span></button>;})}</div>
  <div className="map-controls" role="group" aria-label="Map controls"><button aria-label="Zoom out" onClick={()=>setZoom(v=>Math.max(.7,v-.2))} disabled={zoom<=.7}><Minus size={17}/></button><button aria-label="Zoom in" onClick={()=>setZoom(v=>Math.min(2.2,v+.2))} disabled={zoom>=2.2}><Plus size={17}/></button><button aria-label="Fit map" onClick={fit}><Maximize2 size={16}/></button><button aria-label={paused?'Resume scenery':'Pause scenery'} onClick={()=>setPaused(v=>!v)}>{paused?<Play size={16}/>:<Pause size={16}/>}</button></div>
  <p className="map-navigation-note">Drag to explore. Choose a building to inspect its records.</p>
 </div>;
}

function StationInspector({station,model,onOpenCommitment,onSection,onSearch,onExecution}){
 const [query,setQuery]=useState('');useEffect(()=>setQuery(''),[station.id]);
 const items=station.items.filter(i=>`${i.name} ${i.reference} ${i.label||''}`.toLowerCase().includes(query.toLowerCase()));
 const action=()=>station.id==='exchange'?onSection('credits'):onSection(station.id==='archive'?'library':station.id==='review'?'assurance':station.section);
 const open=item=>{
  if(item.sourceId){onSearch({sourceId:item.sourceId,revision:item.revision});return;}
  if(item.creditId){onSection('credits',null,{creditId:item.creditId});return;}
  if(station.id==='lab'){onExecution(item.actionId,item.commitmentId);return;}
  if(item.commitmentId)onOpenCommitment(item.commitmentId,item.destination,item.actionId);else if(item.commitmentIds?.length===1)onOpenCommitment(item.commitmentIds[0],'ledger');else onSection('vendors');
 };
 return <aside className="station-inspector" aria-label={`${station.name} records`}>
  <div className="inspector-heading"><span className="inspector-seal" aria-hidden="true">{React.createElement(icons[station.id],{size:24})}</span><div><h2>{station.name}</h2><p>{station.description}</p></div></div>
  {station.id==='vault'&&<div className="vault-total"><span>On invoices</span><strong>{exactMoney(model.totals?.verifiedCents)}</strong><small>Includes partial credits. Credit notes awaiting an invoice are excluded.</small></div>}
  {station.id==='review'&&<p className="inspector-principle">Review the documents before approving a change.</p>}
  {station.id==='lab'&&<div className="inspector-principle"><strong>Try a workflow before running it.</strong><p>Test runs use a copy of your records.</p></div>}
  <div className="inspector-list-heading"><h3>{station.id==='archive'?'Documents':station.id==='review'?'Waiting for review':station.id==='exchange'?'Credit notes':station.id==='vault'?'Completed follow-ups':station.id==='lab'?'Approved actions':'Up next'}</h3><span>{station.count}</span></div>
  {station.count>4&&<label className="world-search"><Search size={15}/><input aria-label={`Search ${station.name.toLowerCase()}`} placeholder="Find a vendor or record" value={query} onChange={e=>setQuery(e.target.value)}/></label>}
  <div className="inspector-records">{items.length?items.map(item=><button className="world-record" key={item.id} onClick={()=>open(item)}><span className="world-record-top"><strong>{item.name}</strong>{item.amountCents!=null&&<span>{exactMoney(item.amountCents)}</span>}</span><small>{item.reference}</small>{item.label&&<span className="world-record-task">{item.label}</span>}{item.state&&<span className={`world-record-state ${/blocked|stale|clarification/i.test(item.state)?'attention':''}`}>{item.state.replaceAll('_',' ')}</span>}</button>):<div className="world-empty"><FileText size={25}/><h3>{query?'No matching records':station.id==='vault'?'The vault is waiting':station.id==='lab'?'No current approved action':'Nothing here yet'}</h3><p>{query?'Try another vendor, invoice or reference.':station.id==='vault'?'A promise reaches this station when applied credit fulfills it.':station.id==='lab'?'Approve an exact action in Review hall, or explore one of the authored scenarios.':'Add documents or choose another building.'}</p>{query&&<button className="world-text-button" onClick={()=>setQuery('')}>Clear search</button>}</div>}</div>
  <button className="world-primary inspector-open" onClick={action}>{station.id==='archive'?'Open documents':station.id==='review'?'Open approvals':station.id==='exchange'?'Open all credits':station.id==='vault'?'Open reports':station.id==='lab'?'Open workflow tests':'Open tasks'}</button>
 </aside>;
}

export default function FinanceWorld({service,onSection,onLedger,onOpenCommitment,onSource,onExecution,station:initialStation='review',onStation}){
 const [selected,setSelected]=useState(initialStation),[showActivity,setShowActivity]=useState(false);
 useEffect(()=>setSelected(initialStation),[initialStation]);
 const model=useMemo(()=>deriveClearingHouse(service.workspace),[service.workspace]);
 const station=model.stations.find(s=>s.id===selected)||model.stations[1];
 const select=id=>{setSelected(id);onStation?.(id);};
 const signedOut=service.authMode==='managed-password'&&service.authStatus!=='ready';
 return <main className="clearing-house" data-runtime={service.mode}>
  <header className="clearing-header"><button className="clearing-wordmark" aria-label="Truthful office" onClick={()=>select('review')}><span className="pixel-mark" aria-hidden="true"/>truthful<span className="wordmark-dot">.</span></button><div className="clearing-header-divider"/><span className="clearing-workspace-name">{service.session?.workspace?.name||'Example workspace'}<small>{service.authMode==='managed-password'?'Team workspace':'Example data'}</small></span><nav aria-label="Workspace presentation"><button className="selected" aria-current="page">Office</button><button onClick={onLedger}>Workspace</button><button onClick={()=>onSection('operations')}>Tasks</button></nav><WorkspaceAccount service={service}/></header>
  <div className="clearing-introduction"><div><h1>Office map</h1><p>Choose a building to open its records.</p></div><button className="world-primary" onClick={()=>onSection('evidence')} disabled={signedOut||service.mode==='connecting'}><Plus size={17}/>Add documents</button></div>
  {service.error&&<div className="world-error" role="alert"><strong>Workspace needs attention</strong><p>{service.error}</p><button onClick={()=>service.refresh().catch(()=>{})}>Retry workspace</button></div>}
  <div className="clearing-body">
   <section className="clearing-world" aria-label="Explore the financial workflow"><WorldMap stations={model.stations} selected={selected} onSelect={select} revision={service.workspace?.revision} transition={model.transition}/>
    {(!model.view||signedOut)&&<div className="world-loading" role="status"><h2>{signedOut?'Your workspace is behind these doors.':'Opening the clearing house…'}</h2><p>{signedOut?'Sign in using the account menu to open your recorded workspace.':'Loading recorded evidence, terms and credit balances.'}</p>{signedOut&&<WorkspaceAccount service={service}/>}</div>}
    <div className="world-balance-strip" aria-label="Recorded financial balances"><div><span>To follow up</span><strong>{model.totals?money(model.totals.recoverableCents):'—'}</strong></div><div><span>Waiting for invoice</span><strong>{model.totals?money(model.totals.issuedCents):'—'}</strong></div><div><span>On invoices</span><strong className="world-verified">{model.totals?money(model.totals.verifiedCents):'—'}</strong></div></div>
  <nav className="world-station-dock" aria-label="Office buildings">{model.stations.map(s=>{const Icon=icons[s.id];return <button key={s.id} className={selected===s.id?'selected':''} aria-pressed={selected===s.id} onClick={()=>select(s.id)}><Icon size={17}/><span>{s.short}</span><small>{s.count}</small></button>;})}</nav>
   </section>
   <StationInspector station={station} model={model} onSection={(id,destination)=>id==='assurance'&&station.id==='review'?onSection('assurance','decisions'):onSection(id,destination)} onOpenCommitment={onOpenCommitment} onSearch={onSource} onExecution={onExecution}/>
  </div>

  <footer className="clearing-footer"><button className="world-activity-toggle" aria-expanded={showActivity} onClick={()=>setShowActivity(v=>!v)}>Latest activity <span>{model.activity[0]?.label||'No activity yet'}</span></button><button className="world-refresh" disabled={service.busy||!service.workspace} onClick={()=>service.refresh().catch(()=>{})}>Refresh</button><p>{service.authMode==='managed-password'?'Managed records':service.mode==='server'?'Local SQLite records':'Browser-local records'} · Map illustration. Open a record to make changes.</p><a href="https://github.com/aiden-guan/Nomen" target="_blank" rel="noreferrer">Inspired by Nomen</a></footer>
  {showActivity&&<section className="world-dispatches" aria-label="Latest activity"><header><h2>Latest activity</h2><button aria-label="Close dispatches" onClick={()=>setShowActivity(false)}><X size={18}/></button></header>{model.activity.length?model.activity.map(a=><div key={a.id}><strong>{a.label}</strong><span>{a.actor.role} · {new Date(a.at).toLocaleDateString()}</span></div>):<p>No recorded events yet.</p>}<button className="world-text-button" onClick={()=>onSection('audit')}>Open full activity</button></section>}
 </main>;
}
