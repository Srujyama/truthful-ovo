#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { verifyCase } from '../src/recovery.mjs';

try {
  if (!process.argv[2]) throw new Error('Usage: node scripts/verify-packet.mjs <exported-packet.json>');
  const packet = JSON.parse(await readFile(process.argv[2],'utf8'));
  if (!await verifyCase(packet)) throw new Error('INVALID: evidence or audit history changed relative to the recorded hashes.');
  console.log('VALID: evidence and local audit chain match. This does not independently authenticate the vendor, reviewer, or invoice.');
} catch(e) { console.error(e.message); process.exitCode = 1; }
