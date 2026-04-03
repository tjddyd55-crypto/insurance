import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import './index.css'
import { appRouter } from './appRouter'
import { AuthProvider } from './features/auth/AuthProvider'
import { initColorScheme, subscribeSystemColorScheme } from './theme/colorScheme'

initColorScheme()
subscribeSystemColorScheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={appRouter} />
    </AuthProvider>
  </StrictMode>,
)
