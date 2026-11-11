// Truthful, hosted: one public HTTPS origin for the real, signed-in version.
//
//   node server/host.mjs
//
// The backend (server/start.mjs, managed mode) keeps its own rule of binding
// loopback only. This file is the one thing that faces the internet: it serves
// the built app (dist/) and forwards /api/* to the backend on 127.0.0.1, so the
// page and the API share one origin and the session cookie stays first-party.
//
// Environment:
//   PORT             public port (Fly sets it; default 8080)
//   PUBLIC_ORIGIN    exact public origin, e.g. https://truthful-ovo.fly.dev (required)
//   DATA_DIR         where the accounts and workspace databases live (default /data/managed)
//   OWNER_EMAIL, OWNER_PASSWORD, OWNER_NAME, WORKSPACE_NAME
//                    the first account, created once on a fresh data directory (kept as host secrets, never in Git)

import http from 'node:http';
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = resolve(root, 'dist');
const PORT = Number(process.env.PORT || 8080);
const ORIGIN = process.env.PUBLIC_ORIGIN;
const DATA = process.env.DATA_DIR || '/data/managed';
const INTERNAL = Number(process.env.BACKEND_PORT || 5174);

if (!ORIGIN) { console.error('PUBLIC_ORIGIN is required, e.g. https://truthful-ovo.fly.dev'); process.exit(1); }
mkdirSync(DATA, { recursive: true });

// —— the first account, once per data directory
if (process.env.OWNER_EMAIL && process.env.OWNER_PASSWORD) {
  const account = JSON.stringify({
    email: process.env.OWNER_EMAIL,
    password: process.env.OWNER_PASSWORD,
    name: process.env.OWNER_NAME || 'Owner',
    workspaceName: process.env.WORKSPACE_NAME || 'Finance',
  });
  const r = spawnSync(process.execPath, [join(root, 'server/admin.mjs'), 'bootstrap', '--data', DATA], { input: account, encoding: 'utf8' });
  const said = `${r.stdout || ''}${r.stderr || ''}`.trim().split('\n')[0];
  console.log(JSON.stringify({ event: 'bootstrap', status: r.status, said: said.replace(process.env.OWNER_PASSWORD, '***') }));
}

// —— the backend, on loopback
const backend = spawn(process.execPath, [join(root, 'server/start.mjs'), '--mode', 'managed', '--port', String(INTERNAL), '--data', DATA, '--origin', ORIGIN, '--secure-cookies'], { stdio: 'inherit' });
backend.on('exit', (code) => { console.error(`backend exited (${code})`); process.exit(code || 1); });
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { backend.kill(sig); process.exit(0); });

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain; charset=utf-8', '.csv': 'text/csv; charset=utf-8', '.ico': 'image/x-icon', '.map': 'application/json' };

function serveFile(res, file, status = 200) {
  const type = TYPES[extname(file)] || 'application/octet-stream';
  const headers = { 'content-type': type, 'x-content-type-options': 'nosniff', 'referrer-policy': 'same-origin' };
  headers['cache-control'] = file.includes(`${'/'}assets${'/'}`) ? 'public, max-age=31536000, immutable' : 'no-cache';
  res.writeHead(status, headers);
  createReadStream(file).pipe(res);
}

function proxy(req, res) {
  const headers = { ...req.headers, host: `127.0.0.1:${INTERNAL}`, 'x-forwarded-proto': 'https', 'x-forwarded-host': req.headers.host || '' };
  const upstream = http.request({ host: '127.0.0.1', port: INTERNAL, method: req.method, path: req.url, headers }, (up) => {
    res.writeHead(up.statusCode || 502, up.headers);
    up.pipe(res);
  });
  upstream.on('error', () => { if (!res.headersSent) res.writeHead(502, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: { code: 'BACKEND_UNAVAILABLE', message: 'The book is starting. Try again in a moment.' } })); });
  req.pipe(upstream);
}

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/healthz') { res.writeHead(200, { 'content-type': 'text/plain' }); res.end('ok'); return; }
  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) { proxy(req, res); return; }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return; }
  const path = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
  let file = join(dist, path);
  if (!file.startsWith(dist)) { res.writeHead(403); res.end(); return; }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (existsSync(file)) { serveFile(res, file); return; }
  serveFile(res, join(dist, 'index.html'));   // the book routes by #, so every other path is the app
}).listen(PORT, '0.0.0.0', () => console.log(`Truthful hosted on :${PORT} for ${ORIGIN}; backend on 127.0.0.1:${INTERNAL}; data in ${DATA}`));
