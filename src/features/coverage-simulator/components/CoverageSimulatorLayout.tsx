import { useEffect } from 'react'

import { useCoverageSimulatorScope } from '../CoverageSimulatorScope'
import '../styles/coverage-simulator.css'

export function CoverageSimulatorLayout({
  children,
  shellClassName = '',
  mobileTimelineChrome = false,
}: {
  children: React.ReactNode
  shellClassName?: string
  /** CRM 편집기가 preview-mobile과 같은 타임라인 크롬을 쓸 때 */
  mobileTimelineChrome?: boolean
}) {
  const { isPublicPreview, layoutMode } = useCoverageSimulatorScope()
  const useMobilePreviewChrome = layoutMode === 'preview-mobile' || mobileTimelineChrome
  const useCrmEditorChrome = layoutMode === 'crm' && mobileTimelineChrome
  const embeddedInWorkspace = layoutMode === 'crm' && !isPublicPreview

  useEffect(() => {
    if (isPublicPreview || embeddedInWorkspace) {
      return undefined
    }
    document.body.classList.add('coverage-simulator-immersive')
    return () => {
      document.body.classList.remove('coverage-simulator-immersive')
    }
  }, [embeddedInWorkspace, isPublicPreview])

  return (
    <div
      className={[
        'coverage-simulator-root',
        layoutMode === 'preview-pc' ? 'coverage-simulator-root--pc-preview' : '',
        useMobilePreviewChrome ? 'coverage-simulator-root--mobile-preview' : '',
        useCrmEditorChrome ? 'coverage-simulator-root--crm-editor' : '',
        embeddedInWorkspace ? 'coverage-simulator-root--crm' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-testid="coverage-simulator-root"
    >
      <div className={['coverage-simulator-shell', shellClassName].filter(Boolean).join(' ')}>{children}</div>
    </div>
  )
}
