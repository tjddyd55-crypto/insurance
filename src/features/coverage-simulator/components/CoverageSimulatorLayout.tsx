import { useEffect } from 'react'

import { CoverageSimulatorCustomerProvider } from '../context/CoverageSimulatorCustomerContext'
import { useCoverageSimulatorScope } from '../CoverageSimulatorScope'
import '../styles/coverage-simulator.css'

export function CoverageSimulatorLayout({ children }: { children: React.ReactNode }) {
  const { isPublicPreview, layoutMode } = useCoverageSimulatorScope()

  useEffect(() => {
    if (isPublicPreview) {
      return undefined
    }
    document.body.classList.add('coverage-simulator-immersive')
    return () => {
      document.body.classList.remove('coverage-simulator-immersive')
    }
  }, [isPublicPreview])

  return (
    <div
      className={[
        'coverage-simulator-root',
        layoutMode === 'preview-pc' ? 'coverage-simulator-root--pc-preview' : '',
        layoutMode === 'preview-mobile' ? 'coverage-simulator-root--mobile-preview' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-testid="coverage-simulator-root"
    >
      <div className="coverage-simulator-shell">
        <CoverageSimulatorCustomerProvider>{children}</CoverageSimulatorCustomerProvider>
      </div>
    </div>
  )
}
