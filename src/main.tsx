import './lib/polyfills/uint8ArrayBase'
import './lib/polyfills/mapUpsert'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import './index.css'
import './features/customers/customer-mobile-readability.css'
import './ui-polish.css'
import './ui-polish-fix.css'
import './mobile-claim-ui-fix.css'
import './mobile-claim-detail-fix.css'
import './mobile-personal-message-fix.css'
import './mobile-all-news-fix.css'
import './mobile-ui-foundation.css'
import './features/customer-app/customer-app-news.css'
import './features/customer-app/customer-app-claims.css'
import './features/claim-requests/claim-inbox.css'
import './features/claim-requests/claim-inbox-panel-fix.css'
import './features/claim-requests/claim-requests-desktop-scroll.css'
import './features/claim-requests/claim-inbox-modal.css'
import './features/storage/storage-usage-manager.css'
import './features/customers/customer-workspace-recent.css'
import './features/customers/customer-workspace-close-button.css'
import './features/customers/customer-workspace-action-button.css'
import './features/storage/storage-folder-create-modal.css'
import './features/customers/customer-relations-mobile-ui.css'
import './features/customers/customer-pc-filter-buttons.css'
import './features/user-ui/user-mobile-layout-ssot.css'
import { appRouter } from './appRouter'
import { ElectronForceUpdateGate } from './components/ElectronForceUpdateGate'
import { DesktopUpdateDialog } from './features/desktop-update/DesktopUpdateDialog'
import { WebAppUpdateBanner } from './features/web-update/WebAppUpdateBanner'
import { AuthProvider } from './features/auth/AuthProvider'
import { initColorScheme } from './theme/colorScheme'

initColorScheme()

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/customer-app-sw.js').catch(() => {})
  })
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60000,
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
          <DesktopUpdateDialog />
          <WebAppUpdateBanner />
        </ElectronForceUpdateGate>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
