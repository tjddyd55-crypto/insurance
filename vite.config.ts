import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const insurancePkg = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'package.json'), 'utf-8'),
) as { version: string }

// https://vite.dev/config/
export default defineConfig({
  define: {
    __INSURANCE_WEB_APP_VERSION__: JSON.stringify(insurancePkg.version),
  },
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
