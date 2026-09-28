import { useNavigate } from 'react-router-dom'

import { ScenarioSelectPreviewView } from '../components/ScenarioSelectPreviewView'
import { CoverageSimulatorLayout } from '../components/CoverageSimulatorLayout'
import { coverageSimulatorExitPath, useCoverageSimulatorScope } from '../CoverageSimulatorScope'

export function ScenarioSelectPage() {
  const navigate = useNavigate()
  const { basePath, layoutMode } = useCoverageSimulatorScope()
  const isPublicPreview = layoutMode === 'preview-pc' || layoutMode === 'preview-mobile'

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
        {layoutMode === 'preview-pc' ? (
          <>
            <h1 className="coverage-simulator-page-title">보장 시뮬레이션</h1>
            <p className="coverage-simulator-page-desc">상담할 시나리오를 선택하세요.</p>
          </>
        ) : null}
        <ScenarioSelectPreviewView />
      </main>
    </CoverageSimulatorLayout>
  )
}
