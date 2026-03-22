import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve('./src/index.js'),
      name: 'FlowGraph',
      fileName: 'flowgraph',
      formats: ['es', 'umd']
    }
  }
});
