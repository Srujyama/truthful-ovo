import { defineConfig } from 'vite';

// The book with no backend: `npx vite --config vite.browser.config.js`.
// There is no /api here, so the app keeps its book in the browser and every
// new browser window starts from the demo book's first page. Used for looking
// at pages and for click-through checks; `npm run dev` is the real thing.
export default defineConfig({
  server:{host:'127.0.0.1',port:5190,strictPort:true,hmr:{overlay:false},watch:{ignored:['**/design/figma/generated/**','**/output/**']}},
});
