import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import './index.css'
import './dev/clickOverlayProbe'
import { appRouter } from './appRouter'
import { ElectronForceUpdateGate } from './components/ElectronForceUpdateGate'
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
        </ElectronForceUpdateGate>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
