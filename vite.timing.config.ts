// Temporary config for a timing run: same as vite.config.ts but on port 5174
// with /api proxied to the backend started on 8010 (8000 is occupied by an
// unrelated project). Delete after measuring.
import { defineConfig } from 'vite';
import path from 'path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5174,
    strictPort: true,
    proxy: {
      '/api': { target: 'http://localhost:8010', changeOrigin: true },
    },
  },
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  assetsInclude: ['**/*.svg', '**/*.csv'],
});
