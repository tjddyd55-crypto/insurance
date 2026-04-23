/*
 * Uint8Array.prototype.{toHex,toBase64} / Uint8Array.fromBase64 폴리필.
 * Electron 35 (Chromium 134) 에는 해당 TC39 API 가 아직 없다. pdfjs 등 5.x
 * 라이브러리들이 런타임에 이 메서드를 호출하므로 최초 로드 시점에 한 번 심는다.
 * (네이티브가 있으면 덮어쓰지 않으므로, Chromium 136+ 환경에서는 아무 일도
 *  하지 않는다.)
 */
import './lib/polyfills/uint8ArrayBase'

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
