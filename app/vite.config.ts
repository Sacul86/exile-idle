import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// Builds into the repo root so GitHub Pages ("deploy from branch") serves it directly.
export default defineConfig({
  root: __dirname,
  base: './',
  plugins: [preact()],
  build: { outDir: '..', emptyOutDir: false, assetsDir: 'game', chunkSizeWarningLimit: 2000, target: 'es2020' },
  server: { host: true, port: 5173 },
});
