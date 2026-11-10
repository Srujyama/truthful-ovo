import React,{useEffect,useLayoutEffect,useRef} from 'react';
import {createPortal} from 'react-dom';
import {X} from 'lucide-react';
import DocumentReader from '../DocumentReader.jsx';
import './team-source-panel.css';

/** Exact evidence inspection stays beside the team; it never substitutes a source. */
export default function TeamSourcePanel({view,source,selection,onClose,onOpenPage}){
 const panel=useRef(null),heading=useRef(null),body=useRef(null),close=useRef(onClose);
 close.current=onClose;
 const exact=source&&view&&source.id===selection?.sourceId&&source.revision===Number(selection?.revision)?{...source,isCurrent:view.sources.some(item=>item.id===source.id&&item.revision===source.revision)}:null;
 const identity=`${selection?.sourceId||''}@${selection?.revision??''}`;
 useEffect(()=>{
  const overflow=document.body.style.overflow;
  document.body.style.overflow='hidden';
  const controls=()=>[...panel.current.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])')].filter(node=>node.getClientRects().length&&!node.closest('[hidden],[inert]'));
  const keydown=event=>{
   if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close.current?.();return;}
   if(event.key!=='Tab')return;
   const nodes=controls(),first=nodes[0],last=nodes.at(-1);
   if(!first){event.preventDefault();panel.current?.focus();return;}
   if(event.shiftKey&&(document.activeElement===first||!panel.current.contains(document.activeElement))){event.preventDefault();last.focus();}
   else if(!event.shiftKey&&(document.activeElement===last||!panel.current.contains(document.activeElement))){event.preventDefault();first.focus();}
  };
  const focusin=event=>{if(!panel.current?.contains(event.target))(controls()[0]||panel.current)?.focus();};
  document.addEventListener('keydown',keydown,true);document.addEventListener('focusin',focusin);
  return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',keydown,true);document.removeEventListener('focusin',focusin);};
 },[]);
 useLayoutEffect(()=>{
  body.current?.scrollTo({top:0});
  (heading.current||panel.current)?.focus({preventScroll:true});
 },[identity]);
 function download(){
  if(!exact)return;
  const url=URL.createObjectURL(new Blob([exact.text],{type:'text/plain;charset=utf-8'})),link=document.createElement('a');
  link.href=url;link.download=`${exact.id.replace(/[^A-Za-z0-9._-]/g,'-')}-v${exact.revision}.txt`;link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 return createPortal(<div className="team-source-layer">
  <button className="team-source-scrim" tabIndex={-1} aria-label="Close source document backdrop" onClick={()=>close.current?.()}/>
  <section className="team-source-panel" ref={panel} role="dialog" aria-modal="true" aria-label="Team source document" tabIndex={-1} data-source-id={selection?.sourceId} data-source-revision={selection?.revision}>
   <header className="team-source-nav"><span>Case document</span><div>{onOpenPage&&<button className="team-source-open-page" onClick={()=>onOpenPage(selection)}>Open in Documents</button>}<button className="team-source-close" aria-label="Close team source document" onClick={()=>close.current?.()}><X size={18}/></button></div></header>
   <div className="team-source-body" ref={body}>
    {exact?<DocumentReader key={identity} source={exact} view={view} revisions={[exact]} onChooseRevision={()=>{}} onDownload={download} onBack={()=>close.current?.()} headingRef={heading} embedded returnLabel="Return to teammate" headingLevel={3}/>:<section className="team-source-unavailable"><h2 ref={heading} tabIndex={-1}>This exact document is unavailable</h2><p>The selected version is not in this case’s visible records.</p><dl><div><dt>Source</dt><dd>{selection?.sourceId||'Not supplied'}</dd></div><div><dt>Version</dt><dd>{selection?.revision??'Not supplied'}</dd></div></dl><button onClick={()=>close.current?.()}>Return to teammate</button></section>}
   </div>
  </section>
 </div>,document.body);
}
