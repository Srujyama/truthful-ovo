import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import * as engine from '../src/assurance/index.mjs';
import {createQueryManager} from './queries.mjs';

function harness(t){
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());
 const controls={state:engine.createDemoWorkspace(),revision:0};
 const audit=[
  {sequence:1,at:'2026-10-29T12:00:00.000Z',actor:{id:'operator',role:'analyst'},command:{type:'ADD_VENDOR'},beforeRevision:0,afterRevision:1,hash:'first',previousHash:null},
  {sequence:2,at:'2026-10-30T12:00:00.000Z',actor:{id:'reviewer',role:'approver'},command:{type:'APPROVE_ACTION'},beforeRevision:1,afterRevision:2,hash:'second',previousHash:'first'},
 ];
 const manager=createQueryManager({db,now:()=> '2026-11-08T12:00:00.000Z',read:()=>controls,engine,audit:()=>audit});
 const url=query=>new URL('http://127.0.0.1/api/read'+(query?'?'+query:''));
 return {manager,url,controls};
}

test('financial report refuses unsupported vendor scope instead of silently returning global totals',t=>{
 const {manager,url}=harness(t);
 assert.throws(()=>manager.report(url('vendorId=pipeline')),error=>error.status===400&&error.code==='INVALID_QUERY');
 assert.throws(()=>manager.report(url('status=verified'),true),error=>error.status===400&&error.code==='INVALID_QUERY');
});

test('accepted-command audit filtering returns only the requested command type',t=>{
 const {manager,url}=harness(t);
 const result=manager.query('audit',url('type=ADD_VENDOR'));
 assert.equal(result.total,1);
 assert.ok(result.items.every(item=>item.type==='ADD_VENDOR'));
 const actor=manager.query('audit',url('actor=approver'));
 assert.equal(actor.total,1);assert.equal(actor.items[0].type,'APPROVE_ACTION');
});

test('activity observation-date filters reject malformed and reversed ranges',t=>{
 const {manager,url}=harness(t);
 for(const query of ['from=not-a-date','through=2026-02-30','from=2026-11-08&through=2026-10-01']){
  assert.throws(()=>manager.query('activity',url(query)),error=>error.status===400&&error.code==='INVALID_QUERY',query);
 }
 const empty=manager.query('activity',url('from=2026-11-01&through=2026-11-08'));
 assert.equal(empty.total,0,'a valid empty range remains distinct from malformed filters');
});

test('exact revision reads and server report rollups preserve the recorded temporal boundary',t=>{
 const {manager,url,controls}=harness(t);
 const before=engine.evaluateWorkspace(controls.state).sources.find(source=>source.id==='pipeline-promise');
 controls.state=engine.reduceWorkspace(controls.state,{id:'read-boundary-revision',type:'REVISE_SOURCE',sourceId:'pipeline-promise',text:'LATER UNOBSERVED SOURCE TEXT'},{actor:{id:'read-boundary-analyst',role:'analyst'},now:'2026-11-08T12:00:00.000Z'}).state;controls.revision++;
 const known='asOf=2026-11-08&knownAt=2026-10-28T23%3A59%3A59.999Z';
 const old=manager.source(before.id,String(before.revision),url(known));assert.equal(old.source.text,before.text);
 const latest=engine.evaluateWorkspace(controls.state).sources.find(source=>source.id===before.id);
 assert.throws(()=>manager.source(before.id,String(latest.revision),url(known)),error=>error.status===404);
 const report=manager.report(url(known));
 assert.equal(report.vendors.reduce((total,vendor)=>total+vendor.totals.verifiedCents,0),report.totals.verifiedCents);
 assert.ok(!JSON.stringify(report).includes('LATER UNOBSERVED SOURCE TEXT'));
});
