import react from '@vitejs/plugin-react-swc';
import path from 'path';
import { defineConfig } from 'vite';

// No dev proxy — axios talks to the backend directly via the absolute
// API_BASE_URL in src/ENV.ts. base_resource.py already sends a permissive
// CORS header (`Access-Control-Allow-Origin: *`), so this works without a
// proxy hop and DevTools shows the real upstream URL.
// Served at /coke-africa/: assets are relative ('./') and the region comes
// from the URL at runtime (src/lib/region.ts). Every route
// is one segment deep, so ./assets resolves under the region folder.
export default defineConfig({
  server: {
    host: '::',
    port: 5174,
  },
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
