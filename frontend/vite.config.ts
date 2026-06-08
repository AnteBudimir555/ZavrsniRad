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
  build: {
    rollupOptions: {
      output: {
        // Split the big third-party libraries into their own chunks so they
        // cache independently of our app code: shipping a UI tweak doesn't force
        // the browser to re-download MUI/charts, and the heavy chart + grid
        // libraries stay out of the entry bundle.
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-mui': ['@mui/material', '@emotion/react', '@emotion/styled'],
          'vendor-grid': ['@mui/x-data-grid'],
          'vendor-charts': ['recharts'],
        },
      },
    },
  },
});
