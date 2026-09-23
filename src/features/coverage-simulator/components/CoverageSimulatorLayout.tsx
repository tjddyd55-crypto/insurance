import { useEffect } from 'react'

import { useCoverageSimulatorScope } from '../CoverageSimulatorScope'
import '../styles/coverage-simulator.css'

export function CoverageSimulatorLayout({ children }: { children: React.ReactNode }) {
  const { isPublicPreview } = useCoverageSimulatorScope()

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
    <div className="coverage-simulator-root" data-testid="coverage-simulator-root">
      <div className="coverage-simulator-shell">{children}</div>
    </div>
  )
}
