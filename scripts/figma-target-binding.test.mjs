import test from 'node:test';
import assert from 'node:assert/strict';
import {validateTargetBinding} from './figma-target-binding.mjs';

const fileUrl='https://www.figma.com/design/AbC123/Truthful';
const now='2026-10-30T03:00:00.000Z';
const marker='truthful-ovo-design-v1:AbC123';
const empty={fileKey:null,marker:'',documentId:'0:0',currentPageId:'0:1',pages:[{name:'Page 1',count:0}]};
const valid={fileUrl,operatorVerified:true,method:'native-file-url-and-plugin-context',documentId:'0:0',currentPageId:'0:1',observedAt:'2026-10-30T02:45:00.000Z'};
const check=(initial=empty,attestation=valid,time=now,url=fileUrl)=>validateTargetBinding(initial,{fileUrl:url,attestation,now:time});

test('an empty connected document cannot self-attest the supplied file URL',()=>{
 assert.throws(()=>validateTargetBinding(empty,{fileUrl,now}),/separately supplied operator UI attestation/);
 assert.equal(empty.marker,'');
});
test('known native file key must match even when a correct-looking marker exists',()=>{
 assert.throws(()=>check({...empty,fileKey:'OtherFile',marker}),/native file key differs/);
 assert.throws(()=>check({...empty,fileKey:''}),/native file key differs/);
 const result=check({...empty,fileKey:'AbC123'},null);
 assert.equal(result.method,'native-file-key');assert.equal(result.evidence.nativeFileKey,'AbC123');
});
test('a different persistent marker always rejects, including with a matching API key or attestation',()=>{
 assert.throws(()=>check({...empty,marker:'truthful-ovo-design-v1:OtherFile'}),/different design-kit marker/);
 assert.throws(()=>check({...empty,fileKey:'AbC123',marker:'other-kit'}),/different design-kit marker/);
});
test('a correct persistent marker resumes an already bound nonempty kit without a new attestation',()=>{
 const result=check({...empty,marker,pages:[{name:'Product flow',count:17}]},null);
 assert.equal(result.method,'persistent-kit-marker');assert.equal(result.evidence.marker,marker);
 assert.match(result.evidence.notice,/not independent cryptographic proof/);
});
test('a recent explicit operator attestation binds URL and native plugin context without mutation',()=>{
 const initial=structuredClone(empty),attestation=structuredClone(valid);
 const result=check(initial,attestation);
 assert.equal(result.method,'operator-ui-attestation');assert.equal(result.evidence.fileKey,'AbC123');
 assert.equal(result.evidence.ageMs,15*60*1000);assert.equal(result.evidence.observedAt,valid.observedAt);
 assert.match(result.evidence.notice,/Trusted operator UI attestation, not cryptographic proof/);
 assert.deepEqual(initial,empty);assert.deepEqual(attestation,valid);
});
test('attested target key, operator verification and method are required exactly',()=>{
 assert.throws(()=>check(empty,{...valid,fileUrl:'https://www.figma.com/design/OtherFile/Truthful'}),/different target file URL/);
 for(const delta of [{operatorVerified:false},{operatorVerified:'true'},{method:'automatic-file-guess'}, {method:null}])assert.throws(()=>check(empty,{...valid,...delta}),/operator attestation is required/);
 const sameKey=check(empty,{...valid,fileUrl:'https://figma.com/design/AbC123/Other-title?node-id=0-1'});
 assert.equal(sameKey.method,'operator-ui-attestation');
});
test('the attestation must match both current native context identifiers',()=>{
 assert.throws(()=>check(empty,{...valid,documentId:'different-doc'}),/does not match/);
 assert.throws(()=>check(empty,{...valid,currentPageId:'different-page'}),/does not match/);
 assert.throws(()=>check({...empty,documentId:null}),/Connected document ID is required/);
 assert.throws(()=>check({...empty,currentPageId:''}),/Connected current page ID is required/);
});
test('freshness window includes thirty minutes and one minute of future clock skew only',()=>{
 assert.equal(check(empty,{...valid,observedAt:'2026-10-30T02:30:00.000Z'}).method,'operator-ui-attestation');
 assert.throws(()=>check(empty,{...valid,observedAt:'2026-10-30T02:29:59.999Z'}),/stale/);
 assert.equal(check(empty,{...valid,observedAt:'2026-10-30T03:01:00.000Z'}).method,'operator-ui-attestation');
 assert.throws(()=>check(empty,{...valid,observedAt:'2026-10-30T03:01:00.001Z'}),/more than one minute in the future/);
});
test('invalid or missing observed/current clocks fail closed instead of using system time',()=>{
 for(const observedAt of ['invalid','2026-10-30','2026-10-30T02:45:00',null,Date.parse(now)])assert.throws(()=>check(empty,{...valid,observedAt}),/observedAt timestamp/);
 assert.throws(()=>validateTargetBinding(empty,{fileUrl,attestation:valid}),/explicit valid current time/);
 assert.throws(()=>check(empty,valid,'invalid'),/explicit valid current time/);
 assert.equal(check(empty,valid,Date.parse(now)).method,'operator-ui-attestation');
 assert.equal(check(empty,valid,new Date(now)).method,'operator-ui-attestation');
});
test('target URLs reject lookalike hosts, credentials, schemes and non-Design paths',()=>{
 for(const url of ['https://figma.com.evil.example/design/AbC123','http://figma.com/design/AbC123','https://figma.com/file/AbC123','https://figma.com/design/AbC123.evil','https://user:pass@figma.com/design/AbC123','https://figma.com:444/design/AbC123','not-a-url'])assert.throws(()=>check(empty,valid,now,url),/Figma Design/);
});
