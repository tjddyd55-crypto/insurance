import { useNavigate } from 'react-router-dom'

import useIsMobile from '../../../hooks/useIsMobile'
import { CustomerContextBar } from '../components/CustomerContextBar'
import { ScenarioLibrarySelectView } from '../components/ScenarioLibrarySelectView'
import { CoverageSimulatorLayout } from '../components/CoverageSimulatorLayout'
import { coverageSimulatorExitPath, useCoverageSimulatorScope } from '../CoverageSimulatorScope'
import { CoverageThreePaneWorkspacePage } from './CoverageThreePaneWorkspacePage'

export function ScenarioSelectPage() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const { basePath, layoutMode } = useCoverageSimulatorScope()
  const isPublicPreview = layoutMode === 'preview-pc' || layoutMode === 'preview-mobile'

  if (!isMobile && (layoutMode === 'crm' || layoutMode === 'preview-pc')) {
    return <CoverageThreePaneWorkspacePage />
  }

  const libraryLayoutMode =
    layoutMode === 'preview-pc'
      ? 'preview-pc'
      : layoutMode === 'preview-mobile'
        ? 'preview-mobile'
        : 'crm'

  return (
    <CoverageSimulatorLayout>
      <header
        className={`coverage-simulator-appbar${isPublicPreview && layoutMode === 'preview-mobile' ? ' coverage-simulator-appbar--compact' : ''}`}
      >
        {isPublicPreview ? (
          <span className="coverage-simulator-icon-btn" aria-hidden="true" />
        ) : (
          <button
            type="button"
            className="coverage-simulator-icon-btn"
            onClick={() => navigate(coverageSimulatorExitPath(basePath))}
          >
            ←
          </button>
        )}
        <div className="coverage-simulator-appbar__title">보장 시뮬레이션</div>
        <span />
      </header>
      <main
        className={`coverage-simulator-content${layoutMode === 'preview-pc' ? ' coverage-simulator-content--pc-select' : ''}`}
      >
        {isPublicPreview && layoutMode === 'preview-pc' ? (
          <>
            <h1 className="coverage-simulator-page-title">보장 시뮬레이션</h1>
            <p className="coverage-simulator-page-desc">상담할 시나리오를 선택하세요.</p>
          </>
        ) : null}
        {libraryLayoutMode === 'crm' ? <CustomerContextBar /> : null}
        <ScenarioLibrarySelectView layoutMode={libraryLayoutMode} />
      </main>
    </CoverageSimulatorLayout>
  )
}
