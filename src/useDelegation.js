import {useEffect,useRef,useState} from 'react';
import {createDemoWorkspace,simulateAction} from './assurance/index.mjs';
import {createMemoryAuthority,generateAgentKey,signAgentRequest,delegateGrant,grantDigest,REQUEST_PROFILE,verifyAuthorityPacket} from './authority/index.mjs';
import {moneyToCents} from './engine/index.mjs';

const browserActor={id:'browser-lab-finance',role:'admin'};
const apiBase=`${import.meta.env.BASE_URL}api`;
const cancelled=()=>Object.assign(new Error('The selected workspace or action changed. Retry on the current selection.'),{code:'SELECTION_CHANGED'});
export default function useDelegation(service,{actionId:requestedActionId,commitmentId:requestedCommitmentId}={}){
  const memory=service.mode==='browser';
  const scopeKey=JSON.stringify([service.mode,service.authMode,service.session?.workspace?.id,service.session?.user?.id,service.actor?.id,service.actor?.role]);
  const runtime=useRef(null),agent=useRef(null),lastRequest=useRef(null),pending=useRef(false),generation=useRef(0),verificationEpoch=useRef(0),scope=useRef(scopeKey),live=useRef(null);
  if(scope.current!==scopeKey){scope.current=scopeKey;generation.current++;pending.current=false;runtime.current=null;agent.current=null;lastRequest.current=null;}
  const [snapshot,setSnapshot]=useState(null),[info,setInfo]=useState(null),[grant,setGrant]=useState(null),[chain,setChain]=useState([]),[receipt,setReceipt]=useState(null),[grantStatus,setGrantStatus]=useState(null);
  const [loadedScope,setLoadedScope]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[actionId,setActionId]=useState(null),[commitmentId,setCommitmentId]=useState(null),[pinned,setPinned]=useState(null);
  const [packetText,setPacketText]=useState(''),[verification,setVerification]=useState(null);
  const activeSnapshot=loadedScope===scopeKey?snapshot:null;
  const selected=activeSnapshot?.view.actions.find(a=>a.id===actionId);
  const commitment=activeSnapshot?.view.commitments.find(c=>c.id===(selected?.commitmentId||commitmentId));
  const currentActor=memory?browserActor:service.actor;
  live.current={service,memory,scopeKey,snapshot:activeSnapshot,info,selected,commitment,grant,chain,actor:currentActor};
  function check(ticket){if(ticket!==generation.current)throw cancelled();}
  function clearAuthority(){verificationEpoch.current++;agent.current=null;lastRequest.current=null;setGrant(null);setChain([]);setReceipt(null);setGrantStatus(null);setPacketText('');setVerification(null);}
  function selectAction(id){generation.current++;pending.current=false;setBusy(false);clearAuthority();setActionId(id||null);const action=live.current.snapshot?.view.actions.find(a=>a.id===id);if(action)setCommitmentId(action.commitmentId);setError('');setMessage('');}
  function selectCommitment(id){generation.current++;pending.current=false;setBusy(false);clearAuthority();setActionId(null);setCommitmentId(id);setError('');setMessage('');}
  function requestedSelection(view){
    if(!requestedActionId&&!requestedCommitmentId)return null;
    if(memory)return {error:'The requested action is not available in browser examples. Choose an example below, or open a shared workspace.'};
    const action=requestedActionId?view.actions.find(a=>a.id===requestedActionId):null;
    const target=requestedCommitmentId?view.commitments.find(c=>c.id===requestedCommitmentId):null;
    if(requestedActionId&&!action)return {error:`Requested action ${requestedActionId} is unavailable in this workspace. Select an existing action to continue.`};
    if(requestedCommitmentId&&!target)return {error:`Requested commitment ${requestedCommitmentId} is unavailable in this workspace. Select an existing commitment to continue.`};
    if(action&&target&&action.commitmentId!==target.id)return {error:'The requested action belongs to a different commitment. Select a matching action and commitment to continue.'};
    const commitment=target||view.commitments.find(c=>c.id===action?.commitmentId);
    return {commitment,action:action||view.actions.find(a=>a.commitmentId===commitment?.id&&!a.executed)||null};
  }
  async function request(path,options={}){
    if(service.apiRequest)return service.apiRequest(path,options);
    const session=options.method&&options.method!=='GET'&&path!=='/authority/execute'?await fetch(`${apiBase}/session`,{credentials:'same-origin'}).then(r=>r.json()):null;
    const response=await fetch(`${apiBase}${path}`,{credentials:'same-origin',...options,headers:{'Content-Type':'application/json',...(session?.csrfToken?{'X-CSRF-Token':session.csrfToken}:{}),...options.headers}});
    const body=await response.json();if(!response.ok)throw Object.assign(new Error(body.error?.message||body.message||'Authority request failed.'),{code:body.error?.code||body.code});return body;
  }
  async function load(ticket,grantId=null){
    const [next,authority]=memory?[runtime.current.snapshot(),runtime.current.info()]:await Promise.all([request('/workspace'),request('/authority')]);check(ticket);
    setSnapshot(old=>!old||next.revision>=old.revision?next:old);setInfo(authority);setLoadedScope(scopeKey);
    if(grantId){const status=memory?runtime.current.status(grantId):await request(`/authority/status?grantId=${encodeURIComponent(grantId)}`);check(ticket);setGrantStatus(status);}
    return next;
  }
  useEffect(()=>{
    const ticket=++generation.current;pending.current=false;setBusy(false);setSnapshot(null);setInfo(null);setLoadedScope(null);setPinned(null);setError('');setMessage('');clearAuthority();
    if(!['browser','server'].includes(service.mode))return;
    (async()=>{try{
      if(memory){const next=await createMemoryAuthority({workspace:createDemoWorkspace()});check(ticket);runtime.current=next;}
      const next=await load(ticket);check(ticket);
      const target=requestedSelection(next.view);
      if(target?.error){setActionId(null);setCommitmentId(null);setError(target.error);return;}
      const initial=target?target.action:next.view.actions.find(a=>!a.executed)||next.view.actions[0];
      setActionId(initial?.id||null);setCommitmentId(initial?.commitmentId||target?.commitment?.id||(!target?next.view.commitments[0]?.id:null)||null);
    }catch(e){if(ticket===generation.current)setError(e.message);}})();
    return()=>{generation.current++;};
  },[scopeKey]);
  const requested=useRef(null);
  useEffect(()=>{
    const key=JSON.stringify([scopeKey,requestedActionId,requestedCommitmentId]);if(!activeSnapshot||requested.current===key)return;requested.current=key;
    const target=requestedSelection(activeSnapshot.view);if(!target)return;
    if(target.error){generation.current++;pending.current=false;setBusy(false);clearAuthority();setActionId(null);setCommitmentId(null);setError(target.error);setMessage('');return;}
    // Navigation to the already selected action preserves its ephemeral signing key and retry request.
    if(target.action?.id===live.current.selected?.id&&target.commitment?.id===live.current.commitment?.id)return;
    if(!target.action&&!live.current.selected&&target.commitment?.id===live.current.commitment?.id)return;
    if(target.action)selectAction(target.action.id);else selectCommitment(target.commitment.id);
  },[scopeKey,memory,requestedActionId,requestedCommitmentId,activeSnapshot]);
  // A workspace refresh updates current eligibility without replacing the private key or selected action.
  useEffect(()=>{if(memory||!activeSnapshot||!service.workspace)return;const ticket=generation.current;load(ticket,live.current.grant?.payload.grantId).catch(e=>{if(ticket===generation.current)setError(e.message);});},[service.workspace]);
  async function run(fn,{requiresSnapshot=true}={}){
    if(pending.current)return null;const ticket=generation.current;const context=live.current;if(requiresSnapshot&&!context.snapshot){setError('Wait for the current workspace to load.');return null;}
    pending.current=true;setBusy(true);setError('');setMessage('');
    try{return await fn(ticket,context);}catch(e){if(ticket===generation.current)setError(`${e.code?`${e.code}: `:''}${e.message}`);return null;}finally{if(ticket===generation.current){pending.current=false;setBusy(false);}}
  }
  async function command(value,ticket,expectedRevision){check(ticket);if(memory){if(expectedRevision!==undefined&&runtime.current.snapshot().revision!==expectedRevision)throw new Error('The workspace changed. Refresh before recording this action.');const reply=await runtime.current.command(value,{actor:browserActor});check(ticket);return reply;}
    const result=await request('/commands',{method:'POST',headers:{'Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({command:value,expectedRevision})});check(ticket);await service.refresh();check(ticket);return result;
  }
  const refresh=()=>run(async ticket=>{if(memory&&!runtime.current){const next=await createMemoryAuthority({workspace:createDemoWorkspace()});check(ticket);runtime.current=next;}return load(ticket,live.current.grant?.payload.grantId);},{requiresSnapshot:false});
  const fresh=()=>run(async(ticket,ctx)=>{
    if(!ctx.commitment)throw new Error('Select an existing commitment first.');
    const next=await load(ticket),c=next.view.commitments.find(c=>c.id===ctx.commitment.id);if(!c)throw new Error('The selected commitment is no longer available.');
    const type=next.view.amendments.some(a=>a.commitmentId===c.id&&!a.accepted&&!a.rejected)?'preserve_original':'prepare_claim';
    const id=`delegated-${crypto.randomUUID()}`;await command({type:'PROPOSE_ACTION',action:{id,commitmentId:c.id,type,payload:{}}},ticket,next.revision);await load(ticket);check(ticket);clearAuthority();setActionId(id);setCommitmentId(c.id);setMessage('Fresh action proposed against the selected commitment. Current finance approval is still required.');
  });
  const approve=()=>run(async(ticket,ctx)=>{if(!ctx.selected)throw new Error('Select an existing action.');const next=await load(ticket);await command({type:'APPROVE_ACTION',actionId:ctx.selected.id},ticket,next.revision);await load(ticket);setMessage(`Exact current action approved by ${ctx.actor.id} (${ctx.actor.role}).`);});
  const issue=(amount,lifetime,obligation)=>run(async(ticket,ctx)=>{
    if(!ctx.selected)throw new Error('Select an approved action.');const seconds=Number(lifetime);if(!Number.isSafeInteger(seconds)||seconds<15||seconds>600)throw new Error('Use a grant lifetime of 15–600 seconds.');
    const pair=await generateAgentKey();check(ticket);const next=await load(ticket),at=Date.now();
    const action=next.view.actions.find(a=>a.id===ctx.selected.id);if(!action)throw new Error('The selected action is no longer available.');
    const simulation=simulateAction(next.workspace,action,{asOf:new Date(at).toISOString().slice(0,10),knownAt:new Date(at).toISOString()});
    if(obligation===undefined&&simulation.economics?.incrementalRenewalCostCents)throw new Error('Enter an explicit incremental obligation limit for this renewal.');
    const input={actionId:action.id,agentPublicKey:pair.publicKey,maxAmountCents:moneyToCents(amount),maxObligationCents:moneyToCents(obligation??'0'),notBefore:new Date(at-1000).toISOString(),expiresAt:new Date(at+seconds*1000).toISOString(),expectedRevision:next.revision};check(ticket);
    const reply=memory?await runtime.current.issueGrant(input,{actor:browserActor}):await request('/authority/grants',{method:'POST',headers:{'Idempotency-Key':crypto.randomUUID()},body:JSON.stringify(input)});check(ticket);
    agent.current=pair;lastRequest.current=null;setGrant(reply.grant);setChain([reply.grant]);setReceipt(null);setGrantStatus(null);setVerification(null);setPacketText('');await load(ticket,reply.grant.payload.grantId);setMessage('Signed scope issued to an ephemeral agent key. Its private key stays in this tab.');return reply;
  });
  const delegate=(amount,obligation)=>run(async(ticket,ctx)=>{
    if(!ctx.chain.length||!agent.current)throw new Error('Issue a grant first.');const signingKey=agent.current.privateKey;
    const pair=await generateAgentKey();check(ticket);const parent=ctx.chain.at(-1),expiresAt=new Date(Math.min(Date.parse(parent.payload.expiresAt),Date.now()+60000)).toISOString();
    const child=await delegateGrant(parent,{grantId:crypto.randomUUID(),agentPublicKey:pair.publicKey,maxAmountCents:moneyToCents(amount),maxObligationCents:moneyToCents(obligation??String(parent.payload.maxObligationCents/100)),expiresAt},signingKey);check(ticket);
    setChain([...ctx.chain,child]);agent.current=pair;lastRequest.current=null;setMessage('Child delegation signed. Amount, obligation and lifetime cannot exceed the parent scope.');
  });
  const execute=(retry=false)=>run(async(ticket,ctx)=>{
    if(!ctx.chain.length||!agent.current)throw new Error('Issue a grant first.');let prepared=retry?lastRequest.current:null;
    if(retry&&!prepared)throw new Error('There is no earlier signed request to retry.');
    if(!prepared){const next=await load(ticket);const leaf=ctx.chain.at(-1),key=agent.current.privateKey;const digest=await grantDigest(leaf);check(ticket);const payload={profile:REQUEST_PROFILE,workspaceId:ctx.info.workspaceId,audience:ctx.info.audience,grantDigest:digest,actionId:leaf.payload.actionId,commitmentId:leaf.payload.commitmentId,expectedRevision:next.revision,commandId:crypto.randomUUID(),nonce:crypto.randomUUID(),issuedAt:new Date().toISOString()};const signed=await signAgentRequest(payload,key);check(ticket);prepared={grants:ctx.chain,request:signed,idempotencyKey:crypto.randomUUID()};lastRequest.current=prepared;}
    check(ticket);const reply=memory?await runtime.current.execute(prepared):await request('/authority/execute',{method:'POST',headers:{'Idempotency-Key':prepared.idempotencyKey},body:JSON.stringify({grants:prepared.grants,request:prepared.request})});check(ticket);
    setReceipt(reply.authority.receipt);setGrantStatus(reply.authority.grantStatus);await load(ticket,ctx.grant?.payload.grantId);if(!memory){await service.refresh();check(ticket);}setMessage(retry?'The identical request returned its prior receipt. No second effect was recorded.':'Agent possession and current authority checked. One local action recorded with a signed receipt.');return reply;
  });
  const revoke=()=>run(async(ticket,ctx)=>{
    if(!ctx.grant)throw new Error('Issue a grant first.');const input={grantId:ctx.grant.payload.grantId,reason:'Finance revoked the selected action delegation from the execution lab.'};
    const reply=memory?await runtime.current.revokeGrant(input,{actor:browserActor}):await request('/authority/revoke',{method:'POST',headers:{'Idempotency-Key':crypto.randomUUID()},body:JSON.stringify(input)});check(ticket);setGrantStatus(reply);setMessage('Root grant revoked. New execution under any child must be refused.');
  });
  let simulation=null;try{if(selected)simulation=simulateAction(activeSnapshot.workspace,selected,{asOf:new Date().toISOString().slice(0,10),knownAt:new Date().toISOString()});}catch{}
  const amendment=activeSnapshot?.view.amendments.find(a=>a.id===selected?.payload?.amendmentId);
  const sourceLinks=amendment?.sourceLinks||commitment?.sourceLinks||[];
  const boundSource=sourceLinks.map(link=>activeSnapshot?.view.sources.find(s=>s.id===(link.sourceId||link.id)&&s.revision===link.revision)).find(Boolean)||null;
  const changeSource=text=>run(async(ticket,ctx)=>{
    if(!boundSource)throw new Error('No current exact supporting source revision is bound to the selected action.');
    if(typeof text!=='string'||!text.trim()||text===boundSource.text)throw new Error('Supply changed source text before recording a revision.');
    const next=await load(ticket),current=next.view.sources.find(s=>s.id===boundSource.id);if(!current||current.revision!==boundSource.revision)throw new Error('The source changed. Reload its current text before revising it.');
    if(!ctx.selected||ctx.selected.id!==selected?.id)throw cancelled();await command({type:'REVISE_SOURCE',sourceId:boundSource.id,text},ticket,next.revision);await load(ticket,ctx.grant?.payload.grantId);setMessage('Supplied source revision recorded. Earlier approval and signed grants remain subject to stale-basis refusal. No external authenticity is asserted.');
  });
  const exportEvidence=()=>run(async ticket=>{const packet=memory?await runtime.current.exportPacket():await request('/authority/export');check(ticket);verificationEpoch.current++;setPacketText(JSON.stringify(packet,null,2));setVerification(null);return packet;});
  const verify=()=>run(async ticket=>{const epoch=verificationEpoch.current;const result=await verifyAuthorityPacket(JSON.parse(packetText),{trustedIssuers:pinned?[pinned]:[]});check(ticket);if(epoch!==verificationEpoch.current)return null;setVerification(result);return result;});
  const pin=()=>{if(!info)return;verificationEpoch.current++;setPinned({issuer:info.issuer,keyId:info.keyId,publicKey:info.publicKey});setVerification(null);setMessage('This issuer is explicitly pinned in this tab. The key alone does not establish an organization’s identity.');};
  const tamper=()=>{verificationEpoch.current++;try{const p=JSON.parse(packetText),s=p.checkpoint.signature;p.checkpoint.signature=(s[0]==='A'?'B':'A')+s.slice(1);setPacketText(JSON.stringify(p,null,2));setVerification(null);}catch(e){setError(e.message);}};
  return {mode:memory?'isolated-memory':'server',scopeKey,snapshot:activeSnapshot,info:activeSnapshot?info:null,grant,chain,receipt,grantStatus,selected,commitment,simulation,boundSource,actor:currentActor,canPrepare:['analyst','approver','admin'].includes(currentActor?.role),canApprove:['approver','admin'].includes(currentActor?.role),canRevise:['analyst','admin'].includes(currentActor?.role),actionId,commitmentId,selectAction,selectCommitment,busy,error,message,pinned,packetText,setPacketText:value=>{verificationEpoch.current++;setPacketText(value);setVerification(null);},verification,refresh,fresh,approve,issue,delegate,execute,revoke,changeSource,exportEvidence,verify,pin,tamper};
}
