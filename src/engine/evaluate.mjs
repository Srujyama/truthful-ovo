/** Authored fixture regression evaluation. This is not held-out customer validation. */
import { readFileSync } from 'node:fs';
import { analyzeEvidence } from './index.mjs';

const fixture = name => readFileSync(new URL(`../../public/examples/${name}`, import.meta.url), 'utf8');
const header = 'invoice_id,vendor,date,description,amount,currency,commitment_ref';
const promise = fixture('pipeline-promise.txt');
const invoice = (id, vendor, amount, ref, date = '2026-10-01', currency = 'USD') => `${id},${vendor},${date},Credit adjustment,${amount},${currency},${ref}`;
const csv = (...rows) => [header, ...rows].join('\n');
const base = { vendor: 'Pipeline CRM', promiseText: promise, invoiceCsv: fixture('pipeline-invoices.csv'), asOf: '2026-10-28' };
const cases = [
  { name: 'Partial email concession', group: 'supported', input: base, expected: { status: 'partial', promisedCents: 240000, appliedCents: 90000, outstandingCents: 150000 } },
  { name: 'Complete correction on the next invoice', group: 'supported', input: { ...base, invoiceCsv: fixture('pipeline-invoices-complete.csv'), asOf: '2026-11-01' }, expected: { status: 'verified', verifiedCents: 240000, outstandingCents: 0 } },
  { name: 'Fee waiver applied on due date', group: 'supported', input: { vendor: 'Parcel', promiseText: fixture('parcel-promise.txt'), invoiceCsv: fixture('parcel-invoices.csv'), asOf: '2026-11-01' }, expected: { status: 'verified', verifiedCents: 35000 } },
  { name: 'Integer-cent arithmetic', group: 'supported', input: { ...base, promiseText: promise.replace('2,400', '0.30'), invoiceCsv: csv(invoice('CENT-1', 'Pipeline CRM', '0.10', 'PC-SEATS-2026'), invoice('CENT-2', 'Pipeline CRM', '0.20', 'PC-SEATS-2026')) }, expected: { status: 'verified', verifiedCents: 30, outstandingCents: 0 } },
  { name: 'No invoice means no savings', group: 'supported', input: { ...base, invoiceCsv: '' }, expected: { status: 'needs_review', verifiedCents: 0 } },
  { name: 'Source-dated invoice month', group: 'supported', input: { ...base, promiseText: 'Date: 2026-09-18\nWe will credit you USD 2,400 on your October invoice. Reference: PC-SEATS-2026.' }, expected: { status: 'scheduled', dueDate: '2026-10-31', dueDatePrecision: 'month' } },
  { name: 'New condition retains original correction', group: 'mixed', input: { ...base, replyText: fixture('pipeline-reply.txt') }, expected: { status: 'conditional', promisedCents: 240000, verifiedCents: 90000, outstandingCents: 150000 } },
  { name: 'Original conditional offer is excluded', group: 'mixed', input: { vendor: 'Orbit Design', promiseText: fixture('orbit-promise.txt'), invoiceCsv: fixture('orbit-invoices.csv'), asOf: '2026-11-01' }, expected: { status: 'conditional', verifiedCents: 0 } },
  { name: 'Future credit is excluded', group: 'mixed', input: { vendor: 'Parcel', promiseText: fixture('parcel-promise.txt'), invoiceCsv: fixture('parcel-invoices.csv'), asOf: '2026-10-28' }, expected: { status: 'scheduled', verifiedCents: 0 } },
  { name: 'Exact duplicate is counted once', group: 'mixed', input: { ...base, invoiceCsv: csv(invoice('DUP', 'Pipeline CRM', '900.00', 'PC-SEATS-2026'), invoice('DUP', 'Pipeline CRM', '900.00', 'PC-SEATS-2026')) }, expected: { status: 'partial', appliedCents: 90000 } },
  { name: 'Overcredit attribution is capped', group: 'mixed', input: { ...base, invoiceCsv: csv(invoice('EXCESS', 'Pipeline CRM', '2600.00', 'PC-SEATS-2026')) }, expected: { status: 'verified', verifiedCents: 240000, overappliedCents: 20000, outstandingCents: 0 } },
  { name: 'Other-currency invoice is excluded', group: 'mixed', input: { ...base, invoiceCsv: csv(invoice('CAD', 'Pipeline CRM', '2400.00', 'PC-SEATS-2026', '2026-10-01', 'CAD')) }, expected: { status: 'needs_review', verifiedCents: 0 } },
  { name: 'Two promised amounts are ambiguous', group: 'adversarial', input: { ...base, promiseText: `${promise}\nWe will credit you USD 500 for a second issue.` }, expected: { status: 'unsupported', verifiedCents: 0 } },
  { name: 'Denied credit is not a promise', group: 'adversarial', input: { ...base, promiseText: promise.replace('will credit', 'will not credit') }, expected: { status: 'unsupported', verifiedCents: 0 } },
  { name: 'Foreign currency promise refuses USD match', group: 'adversarial', input: { ...base, promiseText: promise.replace('USD 2,400', 'CAD 2,400') }, expected: { status: 'unsupported', verifiedCents: 0 } },
  { name: 'Missing reference prevents matching', group: 'adversarial', input: { ...base, promiseText: promise.replace('Reference: PC-SEATS-2026', 'Case not referenced') }, expected: { status: 'unsupported', verifiedCents: 0 } },
  { name: 'Impossible invoice date fails closed', group: 'adversarial', input: { ...base, invoiceCsv: csv(invoice('BAD-DATE', 'Pipeline CRM', '2400.00', 'PC-SEATS-2026', '2026-02-30')) }, expected: { status: 'unsupported', verifiedCents: 0 } },
  { name: 'Conflicting duplicate invoice IDs fail closed', group: 'adversarial', input: { ...base, invoiceCsv: csv(invoice('DUP', 'Pipeline CRM', '900.00', 'PC-SEATS-2026'), invoice('DUP', 'Pipeline CRM', '1500.00', 'PC-SEATS-2026')) }, expected: { status: 'unsupported', verifiedCents: 0 } },
  { name: 'Equal amount at a different vendor is irrelevant', group: 'adversarial', input: { ...base, invoiceCsv: csv(invoice('OTHER', 'Unrelated CRM', '2400.00', 'PC-SEATS-2026')) }, expected: { status: 'needs_review', verifiedCents: 0 } },
  { name: 'Equal amount with a different reference is irrelevant', group: 'adversarial', input: { ...base, invoiceCsv: csv(invoice('OTHER-REF', 'Pipeline CRM', '2400.00', 'PC-OTHER-2026')) }, expected: { status: 'needs_review', verifiedCents: 0 } },
  { name: 'Tentative maximum is not guaranteed money', group: 'adversarial', input: { ...base, promiseText: promise.replace('credit you USD', 'credit you up to USD') }, expected: { status: 'unsupported', verifiedCents: 0 } },
  { name: 'Truncated CSV fails closed', group: 'adversarial', input: { ...base, invoiceCsv: `${header}\nINV-1,Pipeline CRM,2026-10-01` }, expected: { status: 'unsupported', verifiedCents: 0 } },
];

const results = cases.map(({ name, group, input, expected }) => {
  const report = analyzeEvidence(input);
  const failures = Object.entries(expected).filter(([key, value]) => report[key] !== value).map(([key, value]) => `${key}: expected ${JSON.stringify(value)}, got ${JSON.stringify(report[key])}`);
  const sources = { promise: input.promiseText || '', invoice: input.invoiceCsv || '', reply: input.replyText || '' };
  const citationIntegrity = report.citations.every(citation => sources[citation.source].slice(citation.start, citation.end) === citation.quote);
  if (!citationIntegrity) failures.push('A citation does not match its source range.');
  return { name, group, passed: failures.length === 0, failures, citationIntegrity, verifiedCents: report.verifiedCents };
});
const groups = [...new Set(results.map(item => item.group))].map(group => ({ group, passed: results.filter(item => item.group === group && item.passed).length, total: results.filter(item => item.group === group).length }));
const summary = {
  evaluation: 'Authored synthetic fixture regression; not held-out validation or real-world accuracy.',
  total: results.length, passed: results.filter(item => item.passed).length,
  groups,
  adversarialFalseVerified: results.filter(item => item.group === 'adversarial' && item.verifiedCents > 0).length,
  citationIntegrityCases: results.filter(item => item.citationIntegrity).length,
  results,
};
if (process.argv.includes('--json')) console.log(JSON.stringify(summary, null, 2));
else {
  console.log(summary.evaluation);
  for (const group of groups) console.log(`${group.group}: ${group.passed}/${group.total} fixtures passed`);
  console.log(`Adversarial fixtures with false verified savings: ${summary.adversarialFalseVerified}`);
  console.log(`Exact source-range integrity: ${summary.citationIntegrityCases}/${summary.total} cases`);
  for (const result of results.filter(item => !item.passed)) console.error(`${result.name}: ${result.failures.join('; ')}`);
  console.log(`${summary.passed}/${summary.total} fixture cases passed.`);
}
if (summary.passed !== summary.total) process.exitCode = 1;
