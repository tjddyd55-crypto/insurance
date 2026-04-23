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
