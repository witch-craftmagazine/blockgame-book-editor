import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  base: './',
  root: '.',
  publicDir: 'public',
  server: {
    fs: {
      allow: ['..'],
    },
  },
  resolve: {
    preserveSymlinks: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: './index.html',
        svelte: './index.svelte.html',
      },
    },
  },
});
