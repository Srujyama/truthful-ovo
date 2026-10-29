import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { analyzeEvidence } from '../src/engine/index.mjs';

const text = await readFile(new URL('../docs/SUBMISSION.md',import.meta.url),'utf8');
const match = text.match(/## Architecture answer[^\n]*\n([\s\S]*?)(?=\n## )/);
assert.ok(match, 'Architecture answer is required.');
const words = match[1].trim().split(/\s+/).length;
assert.ok(words >= 200 && words <= 300, `Architecture must contain 200–300 words; got ${words}.`);
const [promiseText, invoiceCsv, replyText] = await Promise.all(['pipeline-promise.txt','pipeline-invoices.csv','pipeline-reply.txt'].map(n => readFile(new URL('../public/examples/'+n,import.meta.url),'utf8')));
const report = analyzeEvidence({vendor:'Pipeline CRM',promiseText,invoiceCsv,asOf:'2026-10-28'});
assert.equal(report.status,'partial');
assert.equal(report.promisedCents,240000);
assert.equal(report.appliedCents,90000);
assert.equal(report.outstandingCents,150000);
const changed = analyzeEvidence({vendor:'Pipeline CRM',promiseText,invoiceCsv:invoiceCsv.replace(',900.00,',',1000.00,'),asOf:'2026-10-28'});
assert.equal(changed.outstandingCents,140000,'Recorded changed-data demonstration must agree with shipped fixtures.');
const reply = analyzeEvidence({vendor:'Pipeline CRM',promiseText,invoiceCsv,replyText,asOf:'2026-10-28'});
assert.equal(reply.status,'conditional');
assert.equal(reply.appliedCents,90000);
for (const citation of report.citations) {
  const doc = citation.source === 'promise' ? promiseText : invoiceCsv;
  assert.equal(doc.slice(citation.start,citation.end),citation.quote);
}
console.log(`Submission verified: ${words}-word architecture; demo amounts, changed-input result, conditional reply, and exact citations agree with shipped code.`);
