#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { analyzeEvidence } from '../src/engine/index.mjs';
import { createCase, packetFor } from '../src/recovery.mjs';

const args = process.argv.slice(2);
const usage = 'node scripts/analyze.mjs --vendor "Pipeline CRM" --promise public/examples/pipeline-promise.txt --invoices public/examples/pipeline-invoices.csv [--reply FILE] [--as-of YYYY-MM-DD] [--out FILE]';
if (args.includes('--help')) { console.log(usage); process.exit(0); }
try {
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!['--vendor','--promise','--invoices','--reply','--as-of','--out'].includes(args[i]) || !args[i + 1] || args[i+1].startsWith('--')) throw new Error(usage);
    options[args[i].slice(2)] = args[i+1];
  }
  if (!options.vendor || !options.promise || !options.invoices) throw new Error(usage);
  const report = analyzeEvidence({
    vendor: options.vendor, promiseText: await readFile(options.promise,'utf8'),
    invoiceCsv: await readFile(options.invoices,'utf8'),
    replyText: options.reply ? await readFile(options.reply,'utf8') : '',
    asOf: options['as-of'] || '2026-10-28',
  });
  const output = JSON.stringify(packetFor(await createCase(report)),null,2) + '\n';
  if (options.out) { await writeFile(options.out,output); console.log(`Evidence packet written to ${options.out}`); }
  else process.stdout.write(output);
  if (report.errors.length) { console.error(report.errors.join('\n')); process.exitCode = 2; }
} catch(e) { console.error(e.message); process.exitCode = 1; }
