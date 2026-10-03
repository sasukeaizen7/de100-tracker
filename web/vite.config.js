import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Same-origin API in dev, so the refresh cookie stays first-party (SameSite=Strict).
    proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: false } },
  },
});
