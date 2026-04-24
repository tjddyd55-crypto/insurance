/*
 * 최신 TC39 제안 API 폴리필 — Electron 35 (Chromium 134) 대응.
 *
 * Chromium 134 에는 Uint8Array 의 hex/base64 메서드(Stage-3)와 Map/WeakMap 의
 * Upsert 메서드(Stage-3)가 아직 없다. pdfjs-dist 5.x 가 이 API 들을 적극 사용
 * 하므로 앱 부팅 최초 시점에 폴리필을 심어 둔다.
 *
 * 각 폴리필은 "네이티브가 있으면 덮어쓰지 않는" 가드를 포함하므로,
 * Chromium 업그레이드 후에는 자연스럽게 네이티브로 복귀한다.
 *
 * 폴리필 추가 시엔 `src/lib/pdfjs/pdfWorkerEntry.ts` 의 import 도 함께
 * 맞춰 갱신한다(워커 realm 은 메인과 분리되어 있다).
 */
import './lib/polyfills/uint8ArrayBase'
import './lib/polyfills/mapUpsert'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import './index.css'
import { appRouter } from './appRouter'
import { ElectronForceUpdateGate } from './components/ElectronForceUpdateGate'
import { DesktopUpdateDialog } from './features/desktop-update/DesktopUpdateDialog'
import { AuthProvider } from './features/auth/AuthProvider'
import { initColorScheme } from './theme/colorScheme'

initColorScheme()

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/customer-app-sw.js').catch(() => {
      // 서비스워커 등록 실패는 앱 동작을 막지 않는다.
    })
  })
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ElectronForceUpdateGate>
          <RouterProvider router={appRouter} />
          {/*
           * 전역 업데이트 안내 모달 — 로그인 여부·현재 라우트와 무관하게 떠야 한다.
           * 내부에서 Electron 여부를 체크하므로 웹에서는 자동으로 null.
           * 강제 업데이트(ElectronForceUpdateGate.blocked=true) 시엔 children 이
           * 렌더되지 않으므로 이중 모달이 생기지 않는다.
           */}
          <DesktopUpdateDialog />
        </ElectronForceUpdateGate>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
