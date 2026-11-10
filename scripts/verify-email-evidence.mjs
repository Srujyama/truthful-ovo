import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

/** Use the standard-library MIME parser independently of the app's encoder. */
export function verifyEmailEvidence(email,record){
 const decoded=JSON.parse(execFileSync('python3',['-c',`
import sys,json,email.policy
from email.parser import BytesParser
m=BytesParser(policy=email.policy.default).parsebytes(sys.stdin.buffer.read())
print(json.dumps({'defects':[str(x) for x in m.defects], 'unsent':m['X-Unsent'], 'body':m.get_body(preferencelist=('plain',)).get_content(), 'files':{p.get_filename():p.get_payload(decode=True).decode('utf-8') for p in m.iter_attachments()}}))
`],{input:email,encoding:'utf8'}));
 assert.deepEqual(decoded.defects,[]);assert.equal(decoded.unsent,'1');
 const approval=record.audit.find(event=>event.type==='CLAIM_APPROVED');assert(approval);
 assert.equal(decoded.body.replace(/\r\n/g,'\n').replace(/\n$/,''),approval.payload.draft.replace(/\r\n/g,'\n').replace(/\n$/,''));
 const expected=Object.fromEntries([['promiseText','original-promise.txt'],['invoiceCsv','invoice-credits.csv'],['replyText','vendor-reply.txt']].filter(([key])=>record.report.documents?.[key]?.length).map(([key,name])=>[name,record.report.documents[key]]));
 assert.deepEqual(decoded.files,expected,'MIME attachments must contain the exact approved analysis originals, including Unicode and original line endings.');
 return decoded;
}
