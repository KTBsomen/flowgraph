import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // server: {
  //   proxy: {
  //     '/api': {
  //       target: 'http://localhost:3000',
  //       changeOrigin: true
  //     }
  //   }
  // },
  build: {
    lib: {
      entry: resolve('./src/index.js'),
      name: 'FlowGraph',
      fileName: 'flowgraph',
      formats: ['es', 'umd']
    }
  }
});
