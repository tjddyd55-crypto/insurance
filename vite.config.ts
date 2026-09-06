import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const insurancePkg = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'package.json'), 'utf-8'),
) as { version: string }

/*
 * 매 빌드마다 유일한 식별자. JS 번들(__INSURANCE_WEB_BUILD_ID__)과 dist/version.json 에
 * 동일하게 박혀, 실행 중인 세션이 새 배포를 감지하는 기준이 된다.
 * (모바일 WebView 처럼 문서를 자동 reload 하지 않는 환경에서 "옛 번들 고착" 을 끊기 위함)
 */
const WEB_BUILD_ID = process.env.INSURANCE_WEB_BUILD_ID?.trim() || Date.now().toString()

/** dist/version.json 을 방출한다. 클라이언트는 이 파일을 polling 해 buildId 변화를 본다. */
function emitVersionManifest(buildId: string, version: string): Plugin {
  return {
    name: 'insurance-version-manifest',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ buildId, version }),
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  define: {
    __INSURANCE_WEB_APP_VERSION__: JSON.stringify(insurancePkg.version),
    __INSURANCE_WEB_BUILD_ID__: JSON.stringify(WEB_BUILD_ID),
  },
  // Web (Railway/Express): absolute /assets/... so deep routes like /customer/register work.
  // Desktop packaged build: use `npm run build:web -- --base ./` (see build:desktop script).
  base: '/',
  plugins: [react(), tailwindcss(), emitVersionManifest(WEB_BUILD_ID, insurancePkg.version)],
  build: {
    outDir: 'dist',
  },
  /*
   * pdfjs-dist@5.x 는 ESM 전용으로 배포되며 워커 소스(`pdf.worker.min.mjs`) 도
   * ES 모듈이다. Vite 의 워커 기본 포맷은 `iife` 이라, 이 상태로 번들하면
   * 워커 내부의 ESM 문법이 실행되지 못해 워커가 부팅 직후 조용히 실패한다.
   * 그 결과 `getDocument(...).promise` 가 `parse-failed` 로 reject 되어
   * "PDF 형식을 해석하지 못했습니다" 메시지가 떴다(Electron 에서 더 확실히 재현).
   *
   * 해결: 워커 청크를 ES 모듈(`new Worker(url, { type: 'module' })`) 로 번들.
   * 런타임 코드(`src/lib/pdfjs/setupWorker.ts`) 는 그대로 두고, 빌드 제약은
   * 빌드 설정에서 흡수한다(빌드/런타임 책임 분리).
   */
  worker: {
    format: 'es',
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
      '/uploads': 'http://localhost:3001',
    },
  },
  preview: {
    host: '0.0.0.0',
    allowedHosts: true,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: [
      'src/**/*.test.js',
      'src/features/billing/storeReviewBillingAccess.test.ts',
      'src/features/customer-app/pages/CustomerAppRequestComposePage.test.ts',
      'src/features/customers/config/customerInflowSource.config.test.ts',
      'src/features/customers/utils/customerSpecialDateFormUtils.test.ts',
      'src/features/insurer-news/utils/resolveNewsletterPostAuthorLabel.test.ts',
      'src/features/storage/utils/storageFolderTree.test.ts',
    ],
    passWithNoTests: false,
  },
})
