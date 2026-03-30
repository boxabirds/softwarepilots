import { defineConfig } from 'astro/config';

const PREVIEW_PORT = 4173;

export default defineConfig({
  outDir: 'dist',
  server: { port: PREVIEW_PORT },
});
