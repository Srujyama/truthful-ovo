import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {createManagedService} from './managed.mjs';
export const TEST_TIME='2026-11-08T12:00:00.000Z';
export const TEST_PASSWORD='HackathonWorkflow123!';
export function testDocuments(patch={}){return {vendor:'Pipeline CRM',promiseText:readFileSync(new URL('../public/examples/pipeline-promise.txt',import.meta.url),'utf8'),invoiceCsv:readFileSync(new URL('../public/examples/pipeline-invoices.csv',import.meta.url),'utf8'),asOf:'2026-11-08',...patch};}
export async function managedHarness(t,{clock=()=>TEST_TIME}={}){
 const directory=mkdtempSync(join(tmpdir(),'truthful-managed-test-'));let service=await createManagedService({dataDir:directory,clock});
 const initial=await service.bootstrap({email:'admin@example.test',password:TEST_PASSWORD,name:'Workspace Admin',workspaceName:'Finance Operations'});
 let {baseUrl}=await service.listen({port:0}),closed=false;
 const call=async(path,{auth,payload,key=randomUUID(),method=payload?'POST':'GET',origin=baseUrl,headers={}}={})=>{
  const response=await fetch(baseUrl+path,{method,headers:{Origin:origin,...(auth?{Cookie:auth.cookie,'X-CSRF-Token':auth.csrfToken}:{}),...(payload?{'Content-Type':'application/json','Idempotency-Key':key}:{}),...headers},...(payload?{body:JSON.stringify(payload)}:{})});
  const type=response.headers.get('content-type')||'',body=type.includes('application/json')?await response.json():await response.text();return {status:response.status,body,replayed:response.headers.get('idempotent-replayed'),cookie:response.headers.get('set-cookie'),headers:response.headers};
 };
 const login=async(email='admin@example.test')=>{const result=await call('/api/auth/login',{payload:{email,password:TEST_PASSWORD}});assert.equal(result.status,200,JSON.stringify(result.body));return {...result.body,cookie:result.cookie.split(';')[0]};};
 const admin=await login();
 const invite=async(role,email=`${role}@example.test`,workspaceId=initial.workspace.id)=>{
  const invitation=await call('/api/invitations',{auth:admin,payload:{email,role,workspaceId,name:role}});assert.equal(invitation.status,200,JSON.stringify(invitation.body));
  const accepted=await call('/api/auth/invitations/accept',{payload:{token:invitation.body.token,password:TEST_PASSWORD,name:role}});assert.equal(accepted.status,201,JSON.stringify(accepted.body));return login(email);
 };
 const workflow=async(auth,type,input,key=randomUUID())=>{
  const state=await call('/api/workspace',{auth});assert.equal(state.status,200,JSON.stringify(state.body));
  const plan=await call('/api/workflows/preview',{auth,payload:{type,input,expectedRevision:state.body.revision}});assert.equal(plan.status,200,JSON.stringify(plan.body));
  const payload={previewId:plan.body.previewId,expectedRevision:plan.body.expectedRevision};
  const result=await call('/api/workflows/commit',{auth,payload,key});assert.equal(result.status,200,JSON.stringify(result.body));return {plan:plan.body,...result,payload,key};
 };
 const close=async()=>{if(!closed){await service.close();closed=true;}};
 t.after(async()=>{await close();rmSync(directory,{recursive:true,force:true});});
 return {directory,initial,admin,call,login,invite,workflow,close,get service(){return service;},get baseUrl(){return baseUrl;},async restart(){await close();service=await createManagedService({dataDir:directory,clock});({baseUrl}=await service.listen({port:0}));closed=false;}};
}
