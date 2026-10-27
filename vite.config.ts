import { resolve } from 'node:path';
import { readdirSync } from 'node:fs';
import { defineConfig } from 'vite';

const root = import.meta.dirname;
const pagesIn = (dir: string) =>
  Object.fromEntries(
    readdirSync(resolve(root, dir))
      .filter((f) => f.endsWith('.html'))
      .map((f) => [`${dir}/${f.replace('.html', '')}`, resolve(root, dir, f)])
  );
const posts = pagesIn('writing');
const projects = pagesIn('projects');

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
        studio: resolve(root, 'minirt-studio.html'),
        ...posts,
        ...projects,
      },
    },
  },
});
