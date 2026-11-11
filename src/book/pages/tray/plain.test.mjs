import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { analyzeEvidence } from '../../../engine/index.mjs';
import {
  EXAMPLES, answer, asides, bookWaits, companyIn, couldRead, cutPaper, engineDay, fileName, fileProblem, letterFor, marksFor,
  pileSlip, planSays, problems, reasons, sortFiles, whatStopped, whyLeftOut,
} from './plain.mjs';

const example = name => readFileSync(new URL(`../../../../public/examples/${name}`, import.meta.url), 'utf8');
const papers = (over = {}) => ({ vendor: 'Pipeline CRM', asOf: '2026-11-10', promiseText: example('pipeline-promise.txt'), invoiceCsv: example('pipeline-invoices.csv'), replyText: '', ...over });
const read = over => analyzeEvidence(papers(over));
const spelled = (lines, id) => lines.map(line => line.parts.filter(part => part.marks.some(mark => mark.id === id)).map(part => part.text).join('')).filter(Boolean).join('\n');

test('the highlighter covers the characters the engine cited and no others', () => {
  for (const over of [{}, { replyText: example('pipeline-reply.txt') }, { vendor: 'Orbit Design', promiseText: example('orbit-promise.txt'), invoiceCsv: example('orbit-invoices.csv') }]) {
    const report = read(over);
    assert.ok(report.citations.length > 3);
    for (const [source, key] of [['promise', 'promiseText'], ['invoice', 'invoiceCsv'], ['reply', 'replyText']]) {
      const text = report.documents[key];
      const lines = cutPaper(text, marksFor(report, source));
      assert.equal(lines.map(line => line.parts.map(part => part.text).join('')).join('\n'), text.replace(/\n$/, ''));
      for (const cite of report.citations.filter(item => item.source === source)) {
        assert.equal(spelled(lines, cite.id), cite.quote);
        assert.equal(text.slice(cite.start, cite.end), cite.quote);
      }
    }
  }
});

test('two marks on the same sentence both keep every character of it', () => {
  const report = read({ vendor: 'Orbit Design', promiseText: example('orbit-promise.txt'), invoiceCsv: example('orbit-invoices.csv') });
  const twins = report.citations.filter(cite => cite.label === 'Promised credit' || cite.label === 'Original condition');
  assert.equal(twins.length, 2);
  const lines = cutPaper(report.documents.promiseText, marksFor(report, 'promise'));
  for (const cite of twins) assert.equal(spelled(lines, cite.id), cite.quote);
});

test('a mark that runs over a line end is cut at the line, and a bad mark is dropped', () => {
  const lines = cutPaper('ab\ncd\n', [{ id: 'm', start: 1, end: 4 }, { id: 'bad', start: 3, end: 99 }]);
  assert.deepEqual(lines.map(line => line.parts.map(part => [part.text, part.marks.map(mark => mark.id).join('')])), [[['a', ''], ['b', 'm']], [['c', 'm'], ['d', '']]]);
  assert.deepEqual(cutPaper('', []).map(line => line.parts), [[]]);
});

test('rows left out are struck on the invoices and each says why', () => {
  const report = read();
  const out = marksFor(report, 'invoice').filter(mark => mark.out);
  assert.deepEqual(out.map(mark => mark.out), ['Left out. Its reference is PC-ONBOARDING-2026.', 'Left out. It is from Orbit Design.']);
  for (const [i, row] of report.excludedRows.entries()) assert.equal(report.documents.invoiceCsv.slice(out[i].start, out[i].end), row.quote);
  assert.equal(whyLeftOut({ reason: 'Invoice is later than the review date.' }, { asOf: '2026-10-28' }), `Left out. It is dated after Oct 28${new Date().getFullYear() === 2026 ? '' : ', 2026'}.`);
});

test('the answer carries the real figures, and only money still owed is the red one', () => {
  const half = answer(read());
  assert.match(half.lead, /^A promise: \$2,400 from Pipeline CRM, due Oct 1(, 2026)?\. On the invoices: \$900\.$/);
  assert.equal(half.owed, '$1,500');
  assert.equal(half.stamp, 'overdue');
  const paid = answer(read({ invoiceCsv: example('pipeline-invoices-complete.csv') }));
  assert.deepEqual([paid.owed, paid.tail, paid.stamp], ['', 'Paid in full.', 'paid']);
  const offer = answer(read({ vendor: 'Orbit Design', promiseText: example('orbit-promise.txt'), invoiceCsv: example('orbit-invoices.csv') }));
  assert.match(offer.lead, /^An offer: \$480 from Orbit Design, .*with strings attached\.$/);
  assert.deepEqual([offer.owed, offer.stamp], ['', 'only if']);
  const notYet = answer(read({ vendor: 'Parcel', asOf: '2026-10-28', promiseText: example('parcel-promise.txt'), invoiceCsv: example('parcel-invoices.csv') }));
  assert.match(notYet.lead, /On the invoices: nothing yet\.$/);
  assert.deepEqual([notYet.owed, notYet.stamp], ['$350', null]);
  assert.equal(answer(read({ promiseText: 'thanks for lunch' })).lead, 'Couldn’t read these.');
});

test('every reason points at passages that are on the papers', () => {
  for (const over of [{}, { replyText: example('pipeline-reply.txt') }, { invoiceCsv: example('pipeline-invoices-complete.csv') }]) {
    const report = read(over);
    const known = new Set(['promise', 'invoice', 'reply'].flatMap(source => marksFor(report, source).map(mark => mark.id)));
    const list = reasons(report);
    assert.ok(list.length >= 5);
    for (const reason of list) for (const id of reason.marks) assert.ok(known.has(id), `${reason.key} → ${id}`);
    assert.ok(report.citations.every(cite => list.some(reason => reason.marks.includes(cite.id))), 'every highlighted passage has a reason');
  }
  const sum = reasons(read()).find(reason => reason.key === 'sum');
  assert.deepEqual([sum.text, sum.owed], ['$2,400 − $900 =', '$1,500 still owed.']);
  assert.equal(reasons(read({ promiseText: 'thanks for lunch' })).length, 0);
});

test('what stopped it is said by what kind of stop it is', () => {
  assert.equal(whatStopped(read()), null);
  const strings = whatStopped(read({ replyText: example('pipeline-reply.txt') }));
  assert.equal(strings.kind, 'strings');
  assert.equal(strings.quote, 'We will apply the remaining USD 1,500 credit if you renew for another year.');
  assert.equal(whatStopped(read({ replyText: 'Thanks, noted.' })).kind, 'look');
  const unread = whatStopped(read({ promiseText: 'thanks for lunch', invoiceCsv: 'a,b\n1,2' }));
  assert.equal(unread.kind, 'unread');
  assert.equal(unread.lines[0], 'Couldn’t find a promise in that. Paste the sentence where they said it.');
  assert.equal(unread.lines.filter(line => /first line/.test(line)).length, 1);
  assert.ok(unread.lines.every(line => !/CSV|commitment reference|header|supported|explicit/i.test(line.replace('commitment_ref', ''))), unread.lines.join(' | '));
  assert.deepEqual(problems(read({ vendor: 'Pipeline West' })), ['The promise says it is from Pipeline CRM, and you wrote Pipeline West. Make them the same.']);
});

test('the book is not asked for papers with strings, and says what a write would add', () => {
  assert.equal(bookWaits(read()), '');
  assert.match(bookWaits(read({ replyText: example('pipeline-reply.txt') })), /strings attached/);
  assert.match(bookWaits(read({ replyText: 'Thanks, noted.' })), /Waiting on a person/);
  assert.ok(!couldRead(read({ promiseText: '' })));
  const plan = { commands: [{ type: 'ADD_VENDOR' }, { type: 'ADD_SOURCE' }, { type: 'CREATE_COMMITMENT' }, { type: 'ADD_SOURCE' }, { type: 'REGISTER_CREDIT' }, { type: 'ALLOCATE_CREDIT' }] };
  assert.equal(planSays(plan, { vendor: 'Pipeline West' }), 'Goes in: Pipeline West as a new company, the promise, one invoice.');
  assert.equal(planSays({ commands: [] }, {}), '');
});

test('files: what the tray takes, and where each one goes', () => {
  assert.equal(fileProblem({ name: 'promise.txt', size: 900 }), '');
  assert.match(fileProblem({ name: 'scan.pdf', size: 900 }), /is a PDF/);
  assert.match(fileProblem({ name: 'big.csv', size: 412000 }), /412 KB\. The tray takes files under 250 KB\.$/);
  assert.match(fileProblem({ name: 'README', size: 10 }), /isn’t plain text/);
  const blank = { promiseText: '', invoiceCsv: '', replyText: '' };
  const files = [{ name: 'a.eml' }, { name: 'b.csv' }, { name: 'c.txt' }];
  assert.deepEqual(sortFiles(files, 'replyText', blank).map(([slot, file]) => [slot, file.name]), [['replyText', 'a.eml'], ['invoiceCsv', 'b.csv'], ['promiseText', 'c.txt']]);
  assert.deepEqual(sortFiles([{ name: 'a.txt' }], 'invoiceCsv', { ...blank, promiseText: 'x' }).map(([slot]) => slot), ['replyText']);
});

test('small things: the company a promise names, the engine’s day, a slip in the pile, a file name', () => {
  assert.equal(companyIn(example('pipeline-promise.txt')), 'Pipeline CRM');
  assert.equal(companyIn('Vendor: A\nVendor: B'), '');
  assert.equal(engineDay('2026-11-11', new Date('2026-11-10T23:00:00Z')), '2026-11-10');
  assert.equal(engineDay('2026-11-09', new Date('2026-11-10T23:00:00Z')), '2026-11-09');
  const slip = pileSlip({ id: 'r1', createdAt: '2026-11-10T12:00:00.000Z', report: read(), audit: [{ type: 'EVIDENCE_ANALYZED' }] });
  assert.deepEqual([slip.company, slip.owed, slip.said, slip.approved], ['Pipeline CRM', '$1,500', 'still owed', false]);
  assert.equal(fileName('letter', 'Pipeline CRM', 'eml'), 'truthful-letter-pipeline-crm.eml');
  assert.equal(EXAMPLES.length, 3);
  assert.deepEqual(asides(read({ invoiceCsv: '' })), ['There were no invoices in the tray, so nothing shows as credited.']);
});

test('the letter asks for the rest in plain words, and only when the engine has something to ask for', () => {
  const half = letterFor(read());
  assert.ok(half.startsWith('Hi Pipeline CRM billing team,\n\nOn Sep 18, 2026 you promised us a $2,400 credit (reference PC-SEATS-2026), due Oct 1, 2026. So far $900 of it has shown up on our invoices, which leaves $1,500 still owed as of Nov 10, 2026.'), half);
  assert.ok(half.endsWith('Your original email and our invoice rows are attached.\n\nThank you,\nFinance'));
  assert.ok(!/commitment|outstanding|evidence|matched/i.test(half));
  assert.match(letterFor(read({ replyText: example('pipeline-reply.txt') })), /We have not agreed to the new terms in your later note\./);
  assert.match(letterFor(read({ invoiceCsv: '' })), /None of it has shown up on our invoices yet, which leaves \$2,400 still owed.*\n\nPlease.*\n\nYour original email is attached\./s);
  for (const over of [{ invoiceCsv: example('pipeline-invoices-complete.csv') }, { replyText: 'Thanks, noted.' }, { promiseText: 'thanks for lunch' }, { vendor: 'Orbit Design', promiseText: example('orbit-promise.txt'), invoiceCsv: example('orbit-invoices.csv') }]) {
    const report = read(over);
    assert.equal(report.draft, '');
    assert.equal(letterFor(report), '');
  }
});
