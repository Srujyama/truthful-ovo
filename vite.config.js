import { defineConfig } from 'vite';

const proxy = { '/api':{target:'http://127.0.0.1:5174',changeOrigin:true} };
export default defineConfig({
  server:{host:'127.0.0.1',port:5173,strictPort:true,proxy,watch:{ignored:['**/design/figma/generated/**','**/output/**']}},
  preview:{host:'127.0.0.1',port:4173,proxy},
});
