import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5174 },
  // PGlite ships its own WASM + data files; pre-bundling breaks their URLs.
  optimizeDeps: { exclude: ['@electric-sql/pglite'] },
});
