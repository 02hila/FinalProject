/**
 * vite.config.js -- Vite Build Configuration
 *
 * Purpose:
 *   Configures the Vite dev server and production build for the React client.
 *
 * Key settings:
 *   - React plugin enabled (JSX transform, fast refresh).
 *   - Output directory: dist/ (cleared before each build).
 *   - Rollup output file names include a Date.now() timestamp alongside the
 *     content hash to aggressively bust CDN and browser caches on every deploy.
 *   - Dev server runs on port 3000.
 *   - Only environment variables prefixed with VITE_ are exposed to client code.
 *
 * Connections:
 *   - Referenced by the "dev" and "build" npm scripts in package.json.
 *   - Environment variables consumed by AuthContext (VITE_API_BASE_URL) and
 *     companyService (VITE_API_URL) are enabled via envPrefix.
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Append Date.now() to every asset filename to guarantee cache-busting on deploy
        entryFileNames: `assets/[name]-[hash]-${Date.now()}.js`,
        chunkFileNames: `assets/[name]-[hash]-${Date.now()}.js`,
        assetFileNames: `assets/[name]-[hash]-${Date.now()}.[ext]`
      }
    }
  },
  server: {
    port: 3000,
  },
  envPrefix: 'VITE_',
});
