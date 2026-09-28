import { resolve } from 'node:path';
import { readdirSync } from 'node:fs';
import { defineConfig } from 'vite';

const root = import.meta.dirname;
const posts = Object.fromEntries(
  readdirSync(resolve(root, 'writing'))
    .filter((f) => f.endsWith('.html'))
    .map((f) => [`writing/${f.replace('.html', '')}`, resolve(root, 'writing', f)])
);

export default defineConfig({
  build: {
    target: 'es2022',
    assetsDir: 'static',
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      input: {
        index: resolve(root, 'index.html'),
        writing: resolve(root, 'writing.html'),
        imprint: resolve(root, 'imprint.html'),
        ...posts,
      },
    },
  },
});
