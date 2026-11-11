// Reads KEY=value lines from the repo's .env into process.env, once, if the file
// exists. Values already in the environment win. No dependency; .env is ignored by Git.

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function parseEnv(source) {
  const out = {};
  for (const line of String(source).split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let value = m[2];
    if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1);
    else value = value.replace(/\s+#.*$/, '');
    out[m[1]] = value;
  }
  return out;
}

export function loadEnvFile(file = fileURLToPath(new URL('../.env', import.meta.url)), env = process.env) {
  if (!existsSync(file)) return [];
  const loaded = [];
  for (const [key, value] of Object.entries(parseEnv(readFileSync(file, 'utf8')))) {
    if (env[key] === undefined || env[key] === '') { env[key] = value; loaded.push(key); }
  }
  return loaded;
}
