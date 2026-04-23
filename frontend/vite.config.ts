// WHY THIS FILE EXISTS
// --------------------
// Vite config. The 'server.proxy' block makes `npm run dev` feel just like the
// nginx setup in production: hitting http://localhost:5173/api/* is forwarded
// to the Spring Boot backend, so the React app uses the same relative URLs
// ("/api/...") in dev and in prod.

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
});
