#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { createService } from './service.mjs';

const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log('Usage: node server/start.mjs [--port 5174] [--db server/data/truthful.sqlite]\nLocal demonstration service; binds 127.0.0.1 only. No live AI, vendor messages, or payments.');
  process.exit(0);
}
const options = { port: 5174, dbPath: fileURLToPath(new URL('./data/truthful.sqlite', import.meta.url)) };
for (let index = 0; index < args.length; index += 2) {
  if (args[index] === '--port' && /^\d+$/.test(args[index + 1] || '')) options.port = Number(args[index + 1]);
  else if (args[index] === '--db' && args[index + 1]) options.dbPath = args[index + 1];
  else throw new Error('Unknown option. Use --help.');
}
const service = await createService({ dbPath: options.dbPath });
const { baseUrl } = await service.listen({ port: options.port });
console.log(`Truthful local assurance service: ${baseUrl}\nSQLite persistence; explicit local demo identities. No external financial actions.`);
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await service.close(); process.exit(0); });
