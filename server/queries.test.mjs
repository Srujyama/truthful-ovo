import test from 'node:test';
import assert from 'node:assert/strict';
import {createService} from './service.mjs';

async function harness(t){const service=await createService({clock:()=> '2026-11-08T12:00:00.000Z'});const {baseUrl}=await service.listen({port:0});t.after(()=>service.close());const login=await fetch(baseUrl+'/api/session',{method:'POST',headers:{Origin:baseUrl,'Content-Type':'application/json'},body:JSON.stringify({role:'admin'})}),auth=await login.json(),cookie=login.headers.get('set-cookie').split(';')[0];return {service,async get(path){const r=await fetch(baseUrl+path,{headers:{Cookie:cookie}});return {status:r.status,body:(r.headers.get('content-type')||'').includes('json')?await r.json():await r.text()};},async write(command){const r=await fetch(baseUrl+'/api/commands',{method:'POST',headers:{Cookie:cookie,Origin:baseUrl,'Content-Type':'application/json','X-CSRF-Token':auth.csrfToken,'Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({expectedRevision:service.operations.read().revision,command})});return {status:r.status,body:await r.json()};}};}
test('query endpoints paginate exact projections with opaque pinned cursors and reject modified filters or revisions',async t=>{
 const f=await harness(t),first=await f.get('/api/query/commitments?limit=1');assert.equal(first.status,200,JSON.stringify(first.body));assert.equal(first.body.items.length,1);assert(first.body.nextCursor);assert.match(first.body.projection.knownAt,/2026-11-08/);
 const second=await f.get('/api/query/commitments?limit=1&cursor='+encodeURIComponent(first.body.nextCursor));assert.equal(second.status,200);assert.notEqual(second.body.items[0].id,first.body.items[0].id);assert.deepEqual(second.body.projection,first.body.projection);
 assert.equal((await f.get('/api/query/commitments?limit=0')).status,400);assert.equal((await f.get('/api/query/credits?cursor='+encodeURIComponent(first.body.nextCursor))).status,400);
 assert.equal((await f.get('/api/query/commitments?cursor='+encodeURIComponent(first.body.nextCursor)+'&q=changed')).status,400);
 assert.equal((await f.get('/api/query/commitments?cursor=invalid.modified')).status,400);assert.equal((await f.get('/api/query/vendors?limit=1&limit=2')).status,400);
 assert.equal((await f.write({type:'ADD_VENDOR',vendor:{id:'new-query-vendor',name:'Added vendor'}})).status,200);
 assert.equal((await f.get('/api/query/commitments?cursor='+encodeURIComponent(first.body.nextCursor))).status,409);
});
test('all shipped workspace read models, exact source usages, temporal reports and CSV are available server-side',async t=>{
 const f=await harness(t);
 for(const resource of ['operations','vendors','commitments','credits','sources','activity','audit']){const r=await f.get('/api/query/'+resource);assert.equal(r.status,200,`${resource}: ${JSON.stringify(r.body)}`);assert(Array.isArray(r.body.items));assert(r.body.items.length<=25);}
 const sources=await f.get('/api/query/sources?versions=all'),source=sources.body.items[0];assert(!Object.hasOwn(source,'text'));const exact=await f.get(`/api/sources/${source.id}/revisions/${source.revision}`);assert.equal(exact.status,200);assert(exact.body.source.text);assert(Array.isArray(exact.body.usages));
 assert.equal((await f.get('/api/sources/unknown/revisions/1')).status,404);
 const report=await f.get('/api/reports/financial?asOf=2026-10-28&knownAt=2026-10-29T12:00:00.000Z');assert.equal(report.status,200,JSON.stringify(report.body));assert.equal(report.body.asOf,'2026-10-28');assert.equal(report.body.knownAt,'2026-10-29T12:00:00.000Z');
 assert.equal((await f.get('/api/reports/financial.csv')).status,200);
 const filter=await f.get('/api/query/activity?actor=nobody');assert.equal(filter.body.total,0);
});
