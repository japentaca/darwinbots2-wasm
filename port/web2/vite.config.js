// @ts-check
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';
import sitio from './vite-plugin-sitio.js';

export default defineConfig({
  base: './',
  plugins: [svelte(), sitio()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  // C3: worker clásico que carga dbcore.js con importScripts.
  worker: { format: 'iife' },
  // C4: id de build para el cache busting del wasm (?v=<id>).
  define: {
    __BUILD_ID__: JSON.stringify(process.env.DB_BUILD_ID || 'dev'),
  },
});
