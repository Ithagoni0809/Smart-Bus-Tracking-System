// vite.config.js
// ─────────────────────────────────────────────────────────────
// WHY THIS FILE EXISTS:
//   Vite is the build tool and dev server. This config:
//   1. Registers the @vitejs/plugin-react plugin (enables JSX + Fast Refresh)
//   2. Sets up a dev proxy so requests to /api in dev automatically forward
//      to the backend on port 5000 — avoiding CORS issues during development
//      without needing to change any code when deploying to production.
// ─────────────────────────────────────────────────────────────

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Any request starting with /api gets forwarded to backend
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});
