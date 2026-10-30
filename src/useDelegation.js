import {useEffect,useRef,useState} from 'react';
import {createDemoWorkspace} from './assurance/index.mjs';
import {createMemoryAuthority,generateAgentKey,signAgentRequest,delegateGrant,grantDigest,REQUEST_PROFILE,verifyAuthorityPacket} from './authority/index.mjs';
import {moneyToCents} from './engine/index.mjs';

const actor={id:'browser-lab-finance',role:'admin'};
const apiBase=`${import.meta.env.BASE_URL}api`;
export default function useDelegation(service){
  const runtime=useRef(null),agent=useRef(null),lastRequest=useRef(null),pending=useRef(false),generation=useRef(0);
  const [snapshot,setSnapshot]=useState(null),[info,setInfo]=useState(null),[grant,setGrant]=useState(null),[chain,setChain]=useState([]),[receipt,setReceipt]=useState(null),[grantStatus,setGrantStatus]=useState(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[actionId,setActionId]=useState('action-pipeline-preserve'),[pinned,setPinned]=useState(null);
  const [packetText,setPacketText]=useState(''),[verification,setVerification]=useState(null);
  const memory=service.mode==='browser';
  async function request(path,options={}){
    const session=options.method&&options.method!=='GET'&&path!=='/authority/execute'?await fetch(`${apiBase}/session`,{credentials:'same-origin'}).then(r=>r.json()):null;
    const response=await fetch(`${apiBase}${path}`,{credentials:'same-origin',...options,headers:{'Content-Type':'application/json',...(session?.csrfToken?{'X-CSRF-Token':session.csrfToken}:{}),...options.headers}});
    const body=await response.json();
    if(!response.ok){const e=new Error(body.error?.message||body.message||body.error||'Local authority request failed.');e.code=body.error?.code||body.code;throw e;}
    return body;
  }
  async function refresh(grantId=grant?.payload.grantId){
    if(memory){setSnapshot(runtime.current.snapshot());setInfo(runtime.current.info());if(grantId)setGrantStatus(runtime.current.status(grantId));}
    else{const [next,authority]=await Promise.all([request('/workspace'),request('/authority')]);setSnapshot(next);setInfo(authority);if(grantId)setGrantStatus(await request(`/authority/status?grantId=${encodeURIComponent(grantId)}`));}
  }
  useEffect(()=>{
    if(!['browser','server'].includes(service.mode))return;
    const ticket=++generation.current;
    (async()=>{
      try{
        if(memory){const next=await createMemoryAuthority({workspace:createDemoWorkspace()});if(ticket!==generation.current)return;runtime.current=next;setInfo(next.info());setSnapshot(next.snapshot());}
        else{const [next,authority]=await Promise.all([request('/workspace'),request('/authority')]);if(ticket!==generation.current)return;setSnapshot(next);setInfo(authority);}
      }catch(e){if(ticket===generation.current)setError(e.message);}
    })();
    return()=>{generation.current++;};
  },[service.mode]);
  async function run(fn){
    if(pending.current)return null;
    pending.current=true;setBusy(true);setError('');setMessage('');
    try{return await fn();}catch(e){setError(`${e.code?`${e.code}: `:''}${e.message}`);return null;}finally{pending.current=false;setBusy(false);}
  }
  async function command(command){
    if(memory)return runtime.current.command(command,{actor});
    await service.refresh();const result=await service.command(command);return result;
  }
  const selected=snapshot?.view.actions.find(a=>a.id===actionId);
  const commitment=snapshot?.view.commitments.find(c=>c.id===selected?.commitmentId);
  const fresh=()=>run(async()=>{
    const id=`delegated-${crypto.randomUUID()}`;
    await command({type:'PROPOSE_ACTION',action:{id,commitmentId:'pipeline-seats',type:'preserve_original',payload:{}}});setActionId(id);agent.current=null;lastRequest.current=null;setGrant(null);setChain([]);setGrantStatus(null);setReceipt(null);setPacketText('');setVerification(null);await refresh(null);setMessage('Fresh original-terms action prepared. Finance approval is still required.');
  });
  const approve=()=>run(async()=>{await command({type:'APPROVE_ACTION',actionId});await refresh();setMessage('Exact current action approved by the selected demo finance identity.');});
  const issue=(amount,lifetime)=>run(async()=>{
    const pair=await generateAgentKey();
    const at=Date.now(),seconds=Number(lifetime);
    if(!Number.isSafeInteger(seconds)||seconds<15||seconds>600)throw new Error('Use a grant lifetime of 15–600 seconds.');
    const input={actionId,agentPublicKey:pair.publicKey,maxAmountCents:moneyToCents(amount),maxObligationCents:0,notBefore:new Date(at-1000).toISOString(),expiresAt:new Date(at+seconds*1000).toISOString(),expectedRevision:snapshot.revision};
    const reply=memory?await runtime.current.issueGrant(input,{actor}):await request('/authority/grants',{method:'POST',headers:{'Idempotency-Key':crypto.randomUUID()},body:JSON.stringify(input)});
    agent.current=pair;lastRequest.current=null;setGrant(reply.grant);setChain([reply.grant]);setReceipt(null);setGrantStatus(null);setInfo(reply.info||info);setVerification(null);setPacketText('');await refresh(reply.grant.payload.grantId);setMessage('Signed scope issued to an ephemeral agent key. Its private key stays in this tab.');return reply;
  });
  const delegate=(amount)=>run(async()=>{
    if(!chain.length||!agent.current)throw new Error('Issue a grant first.');
    const pair=await generateAgentKey(),parent=chain.at(-1);
    const expiresAt=new Date(Math.min(Date.parse(parent.payload.expiresAt),Date.now()+60000)).toISOString();
    const child=await delegateGrant(parent,{grantId:crypto.randomUUID(),agentPublicKey:pair.publicKey,maxAmountCents:moneyToCents(amount),expiresAt},agent.current.privateKey);
    setChain([...chain,child]);agent.current=pair;lastRequest.current=null;setMessage('Child delegation signed. Amount and lifetime cannot exceed the parent scope.');
  });
  const execute=(retry=false)=>run(async()=>{
    if(!chain.length||!agent.current)throw new Error('Issue a grant first.');
    let prepared=retry?lastRequest.current:null;
    if(retry&&!prepared)throw new Error('There is no earlier signed request to retry.');
    if(!prepared){const payload={profile:REQUEST_PROFILE,workspaceId:info.workspaceId,audience:info.audience,grantDigest:await grantDigest(chain.at(-1)),actionId:chain.at(-1).payload.actionId,commitmentId:chain.at(-1).payload.commitmentId,expectedRevision:snapshot.revision,commandId:crypto.randomUUID(),nonce:crypto.randomUUID(),issuedAt:new Date().toISOString()};prepared={grants:chain,request:await signAgentRequest(payload,agent.current.privateKey),idempotencyKey:crypto.randomUUID()};lastRequest.current=prepared;}
    const reply=memory?await runtime.current.execute(prepared):await request('/authority/execute',{method:'POST',headers:{'Idempotency-Key':prepared.idempotencyKey},body:JSON.stringify({grants:prepared.grants,request:prepared.request})});
    setReceipt(reply.authority.receipt);setGrantStatus(reply.authority.grantStatus);if(reply.revision>=snapshot.revision){setSnapshot(reply);setInfo(reply.authority.info);}await refresh(grant?.payload.grantId);if(!memory)await service.refresh();setMessage(retry?'The identical request returned its prior receipt. No second effect was recorded.':'Agent possession and current authority checked. One local action recorded with a signed receipt.');return reply;
  });
  const revoke=()=>run(async()=>{
    if(!grant)throw new Error('Issue a grant first.');
    const input={grantId:grant.payload.grantId,reason:'Finance revoked this synthetic delegation in the execution lab.'};
    const reply=memory?await runtime.current.revokeGrant(input,{actor}):await request('/authority/revoke',{method:'POST',headers:{'Idempotency-Key':crypto.randomUUID()},body:JSON.stringify(input)});
    setGrantStatus(reply);setMessage('Root grant revoked. A new execution under any child must be refused.');
  });
  const changeSource=()=>run(async()=>{
    const source=snapshot.view.sources.find(s=>s.id==='pipeline-promise');
    await command({type:'REVISE_SOURCE',sourceId:source.id,text:source.text+`\nSYNTHETIC lab revision ${crypto.randomUUID()}: finance received newer evidence.`});await refresh();setMessage('Source revision recorded. An earlier signed grant cannot revive its stale approval.');
  });
  const exportEvidence=()=>run(async()=>{
    const packet=memory?await runtime.current.exportPacket():await request('/authority/export');setPacketText(JSON.stringify(packet,null,2));setVerification(null);return packet;
  });
  const verify=()=>run(async()=>{
    const result=await verifyAuthorityPacket(JSON.parse(packetText),{trustedIssuers:pinned?[pinned]:[]});setVerification(result);return result;
  });
  const pin=()=>{setPinned({issuer:info.issuer,keyId:info.keyId,publicKey:info.publicKey});setVerification(null);setMessage('This lab issuer is explicitly pinned for verification in this tab. This does not establish a real organization’s identity.');};
  const tamper=()=>{try{const p=JSON.parse(packetText),s=p.checkpoint.signature;p.checkpoint.signature=(s[0]==='A'?'B':'A')+s.slice(1);setPacketText(JSON.stringify(p,null,2));setVerification(null);}catch(e){setError(e.message);}};
  return {mode:memory?'isolated-memory':'server',snapshot,info,grant,chain,receipt,grantStatus,selected,commitment,busy,error,message,pinned,packetText,setPacketText:value=>{setPacketText(value);setVerification(null);},verification,refresh,fresh,approve,issue,delegate,execute,revoke,changeSource,exportEvidence,verify,pin,tamper};
}
