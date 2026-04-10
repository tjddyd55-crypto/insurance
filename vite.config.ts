import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  // Web (Railway/Express): absolute /assets/... so deep routes like /customer/register work.
  // Desktop packaged build: use `npm run build:web -- --base ./` (see build:desktop script).
  base: '/',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist',
  },
  resolve: {
    alias: {
      '@insurance-shared': path.resolve(__dirname, 'shared'),
    },
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
    allowedHosts: true,
    proxy: {
      '/api': 'http://localhost:3001',
      '/backend': 'http://localhost:3001',
    },
  },
  preview: {
    host: '0.0.0.0',
    allowedHosts: true,
  },
})
