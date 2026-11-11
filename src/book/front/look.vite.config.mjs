// Serve this checkout so the book can be looked at on its own:
//
//   npx vite --config src/book/front/look.vite.config.mjs
//   then open http://127.0.0.1:5311/
//
// The repo's own vite.config.js sends /api to the local service on port 5174.
// When another checkout's service is running there, the book would write its
// approvals and invoices into that checkout's records. This one has no /api,
// so the app falls back to its browser demo and keeps everything in this
// browser's own storage for 127.0.0.1:5311.
//
// Vite's working files go in this checkout's own .vite folder (git ignores it).
// The default is node_modules/.vite, and node_modules here can be a link to
// another checkout's, whose running server would then share them.
// For the same reason the font files may live outside this folder, so the
// server is told it may hand out what node_modules really points at.
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const root = fileURLToPath(new URL('../../..', import.meta.url));

export default defineConfig({
  root,
  cacheDir: `${root}.vite/look`,
  server: { host: '127.0.0.1', port: 5311, strictPort: true, fs: { allow: [root, realpathSync(`${root}node_modules`)] } },
});
