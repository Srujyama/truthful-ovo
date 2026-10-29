import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { analyzeEvidence, extractPromise, moneyToCents, parseInvoiceCsv } from './index.mjs';

const fixture = name => readFileSync(new URL(`../../public/examples/${name}`, import.meta.url), 'utf8');
const HEADER = 'invoice_id,vendor,date,description,amount,currency,commitment_ref';
const promise = 'We will credit you USD 2,400 on your October 2026 invoice. Reference: PC-SEATS-2026. Due date: 2026-10-01. This does not require a renewal.';
const row = (overrides = {}) => ({ invoice_id: 'INV-1', vendor: 'Pipeline CRM', date: '2026-10-01', description: 'Seat adjustment', amount: '900.00', currency: 'USD', commitment_ref: 'PC-SEATS-2026', ...overrides });
const csv = (...rows) => [HEADER, ...rows.map(value => Object.values(value).join(','))].join('\n');
const analyze = (overrides = {}) => analyzeEvidence({ vendor: 'Pipeline CRM', promiseText: promise, invoiceCsv: csv(row()), asOf: '2026-10-28', ...overrides });

test('Pipeline source fixtures produce 2400 promised, 900 applied, 1500 outstanding, with two unrelated exclusions', () => {
  const report = analyze({ promiseText: fixture('pipeline-promise.txt'), invoiceCsv: fixture('pipeline-invoices.csv') });
  assert.equal(report.status, 'partial');
  assert.equal(report.promisedCents, 240000);
  assert.equal(report.appliedCents, 90000);
  assert.equal(report.verifiedCents, 90000);
  assert.equal(report.outstandingCents, 150000);
  assert.equal(report.invoiceMatches.length, 1);
  assert.equal(report.excludedRows.length, 2);
  assert.equal(report.condition, null);
  assert.match(report.draft, /\$1,500\.00 outstanding/);
  assert.deepEqual(report.errors, []);
});

test('all citations are exact source ranges, including CSV rows and multibyte text', () => {
  const report = analyze({ promiseText: `Hi Alex 👋\n${promise}`, replyText: fixture('pipeline-reply.txt') });
  const documents = { promise: report.documents.promiseText, invoice: report.documents.invoiceCsv, reply: report.documents.replyText };
  assert.ok(report.citations.length >= 5);
  for (const citation of report.citations) {
    assert.equal(documents[citation.source].slice(citation.start, citation.end), citation.quote);
    assert.ok(citation.quote.trim());
  }
  const ids = new Set(report.citations.map(citation => citation.id));
  for (const item of report.reasoning) for (const id of item.citationIds) assert.ok(ids.has(id));
});

test('a new renewal condition preserves the original money and demands a separate decision', () => {
  const report = analyze({ replyText: fixture('pipeline-reply.txt') });
  assert.equal(report.status, 'conditional');
  assert.equal(report.condition, null);
  assert.match(report.replyCondition, /if you renew/);
  assert.equal(report.appliedCents, 90000);
  assert.equal(report.outstandingCents, 150000);
  assert.match(report.draft, /not accepted the new condition/);
  assert.equal(report.requiresApproval, true);
});

test('an original conditional offer never creates verified savings', () => {
  const report = analyzeEvidence({ vendor: 'Orbit Design', promiseText: fixture('orbit-promise.txt'), invoiceCsv: fixture('orbit-invoices.csv'), asOf: '2026-11-01' });
  assert.equal(report.status, 'conditional');
  assert.equal(report.promisedCents, 48000);
  assert.equal(report.appliedCents, 0);
  assert.equal(report.verifiedCents, 0);
  assert.equal(report.invoiceMatches.length, 0);
  assert.match(report.excludedRows[0].reason, /conditional/);
  assert.equal(report.draft, '');
  assert.equal(report.requiresApproval, false);
});

test('future invoice evidence remains scheduled and contributes no verified amount', () => {
  const report = analyzeEvidence({ vendor: 'Parcel', promiseText: fixture('parcel-promise.txt'), invoiceCsv: fixture('parcel-invoices.csv'), asOf: '2026-10-28' });
  assert.equal(report.status, 'scheduled');
  assert.equal(report.appliedCents, 0);
  assert.equal(report.outstandingCents, 35000);
  assert.match(report.excludedRows[0].reason, /later/);
  assert.equal(report.draft, '');
  assert.equal(report.requiresApproval, false);
});

test('a matching invoice on the review date can complete a promise', () => {
  const input = { promiseText: fixture('pipeline-promise.txt'), invoiceCsv: fixture('pipeline-invoices-complete.csv') };
  assert.equal(analyze({ ...input, asOf: '2026-10-31' }).appliedCents, 90000);
  const report = analyze({ ...input, asOf: '2026-11-01' });
  assert.equal(report.status, 'verified');
  assert.equal(report.appliedCents, 240000);
  assert.equal(report.outstandingCents, 0);
  assert.equal(report.draft, '');
  assert.equal(report.requiresApproval, false);
});

test('vendor, currency and reference each must match; amount alone never establishes a match', () => {
  const report = analyze({ invoiceCsv: csv(
    row({ invoice_id: 'wrong-vendor', vendor: 'Other CRM', amount: '2400.00' }),
    row({ invoice_id: 'wrong-ref', commitment_ref: 'OTHER', amount: '2400.00' }),
    row({ invoice_id: 'wrong-currency', currency: 'CAD', amount: '2400.00' }),
  ) });
  assert.equal(report.appliedCents, 0);
  assert.equal(report.outstandingCents, 240000);
  assert.equal(report.excludedRows.length, 3);
  assert.notEqual(report.status, 'verified');
});

test('vendor comparison trims and case-normalizes, while commitment references are case sensitive', () => {
  assert.equal(analyze({ invoiceCsv: csv(row({ vendor: ' pipeline crm ' })) }).appliedCents, 90000);
  assert.equal(analyze({ invoiceCsv: csv(row({ commitment_ref: 'pc-seats-2026' })) }).appliedCents, 0);
});

test('identical duplicate credit rows count exactly once', () => {
  const report = analyze({ invoiceCsv: csv(row(), row(), row()) });
  assert.equal(report.appliedCents, 90000);
  assert.equal(report.invoiceMatches.length, 1);
  assert.ok(report.warnings.some(value => /Duplicate invoice/.test(value)));
});

test('conflicting rows with the same invoice ID require correction instead of double counting', () => {
  const report = analyze({ invoiceCsv: csv(row(), row({ amount: '1500.00' })) });
  assert.equal(report.status, 'unsupported');
  assert.equal(report.appliedCents, 0);
  assert.equal(report.invoiceMatches.length, 0);
  assert.ok(report.errors.some(value => /conflicting rows/.test(value)));
});

test('overcredits are visible but attributed savings cap at the promised amount', () => {
  const report = analyze({ invoiceCsv: csv(row({ amount: '2500.00' })) });
  assert.equal(report.appliedCents, 250000);
  assert.equal(report.verifiedCents, 240000);
  assert.equal(report.overappliedCents, 10000);
  assert.equal(report.outstandingCents, 0);
  assert.ok(report.warnings.some(value => /more credit/.test(value)));
});

test('a promise without invoice evidence never becomes verified', () => {
  const report = analyze({ invoiceCsv: '' });
  assert.equal(report.appliedCents, 0);
  assert.equal(report.verifiedCents, 0);
  assert.equal(report.status, 'needs_review');
  assert.ok(report.warnings.some(value => /promise alone/.test(value)));
});

test('ambiguous multiple credit amounts are refused', () => {
  const report = analyze({ promiseText: `${promise} We will credit you USD 100 for a second correction.` });
  assert.equal(report.status, 'unsupported');
  assert.equal(report.promisedCents, null);
  assert.equal(report.appliedCents, 0);
  assert.equal(report.draft, '');
});

test('unrelated dollar values do not become credit promises', () => {
  const report = analyze({ promiseText: 'Your subscription costs USD 2,400. Reference: PC-SEATS-2026. Due date: 2026-10-01.' });
  assert.equal(report.status, 'unsupported');
  assert.equal(report.promisedCents, null);
});

test('unsupported, requested, tentative and negated language never becomes verified', () => {
  for (const sentence of [
    'Can you credit us USD 2,400?',
    'We will not credit you USD 2,400.',
    'We will credit you up to USD 2,400.',
    'We might credit you USD 2,400.',
    'The customer requested a credit of USD 2,400.',
    'Credit received: USD 2,400.',
  ]) {
    const report = analyze({ promiseText: `${sentence} Reference: PC-SEATS-2026. Due date: 2026-10-01.` });
    assert.equal(report.status, 'unsupported', sentence);
    assert.equal(report.appliedCents, 0, sentence);
  }
});

test('foreign currency or mixed currencies in the promise require correction', () => {
  for (const amount of ['CAD 2,400', 'C$2,400', 'USD 2,400 / EUR 2,100', '£2,400']) {
    const report = analyze({ promiseText: `We will credit you ${amount}. Reference: PC-SEATS-2026. Due date: 2026-10-01.` });
    assert.equal(report.status, 'unsupported', amount);
  }
});

test('bare dollars carry a USD assumption warning', () => {
  const report = analyze({ promiseText: promise.replace('USD 2,400', '$2,400') });
  assert.equal(report.promisedCents, 240000);
  assert.equal(report.status, 'partial');
  assert.ok(report.warnings.some(value => /unqualified \$/.test(value)));
});

test('missing or multiple references prevent amount-only matching', () => {
  for (const text of [promise.replace('Reference: PC-SEATS-2026.', ''), `${promise} Reference: OTHER-2026.`]) {
    const report = analyze({ promiseText: text });
    assert.equal(report.status, 'unsupported');
    assert.equal(report.appliedCents, 0);
    assert.equal(report.commitmentRef, null);
  }
});

test('all values use exact integer cents instead of float summation', () => {
  const report = analyze({ promiseText: promise.replace('2,400', '0.30'), invoiceCsv: csv(row({ amount: '0.10' }), row({ invoice_id: 'INV-2', amount: '0.20' })) });
  assert.equal(report.promisedCents, 30);
  assert.equal(report.appliedCents, 30);
  assert.equal(report.outstandingCents, 0);
  assert.equal(report.status, 'verified');
});

test('money parser validates precision, grouping, sign and safe integer range', () => {
  assert.equal(moneyToCents('8,000.02'), 800002);
  assert.equal(moneyToCents('0.1'), 10);
  for (const value of ['-1', '+1', '1.001', '1,00', '01', 'NaN', 'Infinity', '1e3', '9007199254740991']) assert.throws(() => moneyToCents(value), RangeError, value);
});

test('malformed CSV never partially counts an otherwise valid invoice', () => {
  for (const bad of [
    csv(row(), row({ invoice_id: 'INV-2', amount: '-100' })),
    csv(row(), row({ invoice_id: 'INV-2', date: '2026-02-30' })),
    `${csv(row())}\nINV-2,Missing columns`,
    `${HEADER}\n"INV-1,Pipeline CRM,2026-10-01,Seat,900,USD,PC-SEATS-2026`,
  ]) {
    const report = analyze({ invoiceCsv: bad });
    assert.equal(report.status, 'unsupported');
    assert.equal(report.appliedCents, 0);
    assert.ok(report.errors.length);
  }
});

test('quoted CSV descriptions support commas, escaped quotes, newlines and CRLF without breaking citations', () => {
  const text = `${HEADER}\r\nINV-1,Pipeline CRM,2026-10-01,"Seat adjustment, \"\"verified\"\"\nsecond line",900.00,USD,PC-SEATS-2026\r\n`;
  const parsed = parseInvoiceCsv(text);
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.rows[0].description, 'Seat adjustment, "verified"\nsecond line');
  const report = analyze({ invoiceCsv: text });
  assert.equal(report.appliedCents, 90000);
  const citation = report.citations.find(item => item.source === 'invoice');
  assert.equal(text.slice(citation.start, citation.end), citation.quote);
});

test('CSV headers require all documented columns and unique names', () => {
  assert.ok(parseInvoiceCsv('invoice_id,amount\nINV-1,900').errors.some(value => /missing/.test(value)));
  assert.ok(parseInvoiceCsv(`${HEADER},amount\n`).errors.some(value => /unique/.test(value)));
  assert.deepEqual(parseInvoiceCsv(`\uFEFF${HEADER}\n`).errors, []);
});

test('date validation rejects impossible and malformed review dates', () => {
  for (const asOf of ['2026-02-30', 'tomorrow', '2026-1-01', '']) {
    assert.equal(analyze({ asOf }).status, 'unsupported', asOf);
  }
});

test('an invalid due date is not silently repaired', () => {
  const report = analyze({ promiseText: promise.replace('2026-10-01', '2026-02-30') });
  assert.equal(report.status, 'unsupported');
  assert.equal(report.dueDate, null);
});

test('invoice month/year uses month-end with explicit precision and schedule reasoning', () => {
  const report = analyze({ promiseText: promise.replace('Due date: 2026-10-01.', ''), asOf: '2026-10-28' });
  assert.equal(report.dueDate, '2026-10-31');
  assert.equal(report.dueDatePrecision, 'month');
  assert.equal(report.status, 'scheduled');
  assert.ok(report.reasoning.some(value => /month end/.test(value.detail)));
});

test('month without a year requires an explicit source Date header', () => {
  const withoutYear = promise.replace('October 2026', 'October').replace('Due date: 2026-10-01.', '');
  assert.equal(analyze({ promiseText: withoutYear }).status, 'unsupported');
  assert.equal(analyze({ promiseText: `Date: 2026-09-18\n${withoutYear}` }).dueDate, '2026-10-31');
  assert.equal(analyze({ promiseText: `Date: September 18, 2026\n${withoutYear}` }).dueDate, '2026-10-31');
});

test('a source date anchors a future January invoice across the year boundary', () => {
  const parsed = extractPromise('Date: 2026-12-18\nWe will credit you USD 100 on your January invoice. Reference: YEAR-END.');
  assert.equal(parsed.dueDate, '2027-01-31');
  assert.deepEqual(parsed.errors, []);
});

test('explicitly negated renewal terms do not invent a condition', () => {
  for (const phrase of ['This does not require a renewal.', 'No renewal is required.', 'This is without a renewal.', 'There is no minimum-term commitment.']) {
    const report = analyze({ promiseText: `${promise.replace('This does not require a renewal.', '')} ${phrase}` });
    assert.equal(report.condition, null, phrase);
  }
});

test('supported condition forms are visible and excluded from verified savings', () => {
  for (const condition of ['if you renew for another year', 'subject to a 12-month renewal', 'in exchange for another year', 'only after finance approval', 'after your annual renewal', 'renewal is required']) {
    const report = analyze({ promiseText: `${promise.replace('This does not require a renewal.', '')} The offer is ${condition}.` });
    assert.equal(report.status, 'conditional', condition);
    assert.equal(report.appliedCents, 0, condition);
    assert.ok(report.condition, condition);
  }
});

test('input objects are not mutated and reports are deterministic and serializable', () => {
  const input = Object.freeze({ vendor: 'Pipeline CRM', promiseText: promise, invoiceCsv: csv(row()), asOf: '2026-10-28' });
  const first = analyzeEvidence(input), second = analyzeEvidence(input);
  assert.deepEqual(first, second);
  assert.deepEqual(JSON.parse(JSON.stringify(first)), first);
  assert.notEqual(first, second);
});

test('a selected vendor conflicting with explicit promise provenance is refused', () => {
  const report = analyze({ promiseText: `Vendor: Other CRM\n${promise}` });
  assert.equal(report.status, 'unsupported');
  assert.equal(report.sourceVendor, 'Other CRM');
  assert.equal(report.appliedCents, 0);
  assert.ok(report.errors.some(value => /does not match the Vendor/.test(value)));
});

test('matching vendor header and source date are retained and cited', () => {
  const report = analyze({ promiseText: `Date: September 18, 2026\nVendor: pipeline crm\n${promise}` });
  assert.equal(report.status, 'partial');
  assert.equal(report.promiseDate, '2026-09-18');
  assert.equal(report.sourceVendor, 'pipeline crm');
  for (const label of ['Source vendor', 'Promise date']) {
    const citation = report.citations.find(item => item.label === label);
    assert.ok(citation);
    assert.equal(report.documents.promiseText.slice(citation.start, citation.end), citation.quote);
  }
});

test('credits predating a dated promise cannot fulfill that promise', () => {
  const report = analyze({ promiseText: `Date: 2026-09-18\n${promise}`, invoiceCsv: csv(row({ date: '2026-09-01' }), row({ invoice_id: 'INV-2', date: '2026-10-01', amount: '100.00' })) });
  assert.equal(report.appliedCents, 10000);
  assert.equal(report.excludedRows.length, 1);
  assert.match(report.excludedRows[0].reason, /predates/);
});

test('invalid, conflicting or future promise provenance fails closed', () => {
  for (const header of ['Date: 2026-02-30', 'Date: 2027-01-01', 'Date: 2026-09-18\nDate: 2026-09-19', 'Vendor: Pipeline CRM\nVendor: Other CRM']) {
    const report = analyze({ promiseText: `${header}\n${promise}` });
    assert.equal(report.status, 'unsupported', header);
    assert.equal(report.appliedCents, 0, header);
  }
});

test('absence of promise date warns about the missing lower date bound', () => {
  const report = analyze();
  assert.equal(report.promiseDate, null);
  assert.ok(report.warnings.some(value => /No promise Date/.test(value)));
});

test('an unrecognized reply requires manual review and never claims all terms are understood', () => {
  const report = analyze({ replyText: 'Our billing specialist will review your message; more details will follow.' });
  assert.equal(report.replyReviewRequired, true);
  assert.equal(report.replyCondition, null);
  assert.equal(report.status, 'needs_review');
  assert.equal(report.appliedCents, 90000);
  assert.equal(report.draft, '');
  assert.equal(report.requiresApproval, false);
  assert.ok(report.warnings.some(value => /does not establish acceptance/.test(value)));
});

test('a possible offer and malformed monetary suffixes are not confirmed credit amounts', () => {
  for (const sentence of ['We can credit you USD 2,400.', 'We will credit you $24.00.01.', 'We will credit you $2400abc.']) {
    const report = analyze({ promiseText: `${sentence} Reference: PC-SEATS-2026. Due date: 2026-10-01.` });
    assert.equal(report.status, 'unsupported', sentence);
    assert.equal(report.requiresApproval, false, sentence);
  }
});

test('a period after the amount is sentence punctuation, not a malformed decimal', () => {
  for (const amount of ['USD 2,400', '$2,400.00', '$2400']) {
    const report = analyze({ promiseText: `We will credit you ${amount}. Reference: PC-SEATS-2026. Due date: 2026-10-01.` });
    assert.equal(report.status, 'partial', amount);
    assert.equal(report.promisedCents, 240000, amount);
  }
});

test('invalid types and oversized inputs return actionable unsupported reports', () => {
  assert.equal(analyzeEvidence(null).status, 'unsupported');
  assert.equal(analyzeEvidence('not an object').status, 'unsupported');
  assert.equal(analyzeEvidence({ vendor: null, promiseText: 42, invoiceCsv: {}, asOf: undefined }).status, 'unsupported');
  assert.equal(analyze({ promiseText: 'x'.repeat(250001) }).status, 'unsupported');
  assert.equal(analyze({ invoiceCsv: 'x'.repeat(250001) }).status, 'unsupported');
  assert.equal(analyze({ replyText: 'x'.repeat(250001) }).status, 'unsupported');
});
