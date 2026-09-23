import { useNavigate } from 'react-router-dom'

import { CoverageSimulatorLayout } from '../components/CoverageSimulatorLayout'
import { SCENARIO_TYPE_CARDS } from '../domain/templates'

export function ScenarioSelectPage() {
  const navigate = useNavigate()

  return (
    <CoverageSimulatorLayout>
      <header className="coverage-simulator-appbar">
        <button type="button" className="coverage-simulator-icon-btn" onClick={() => navigate('/dashboard')}>
          ←
        </button>
        <div className="coverage-simulator-appbar__title">보장 시뮬레이션</div>
        <span />
      </header>
      <main className="coverage-simulator-content">
        <h1 className="coverage-simulator-page-title">보장 시뮬레이션</h1>
        <p className="coverage-simulator-page-desc">상담할 시나리오를 선택하세요.</p>
        {SCENARIO_TYPE_CARDS.map((card) => (
          <button
            key={card.diseaseType}
            type="button"
            className={`coverage-simulator-scenario-card${card.enabled ? '' : ' coverage-simulator-scenario-card--disabled'}`}
            disabled={!card.enabled}
            onClick={() => navigate(`/coverage-simulator/${card.diseaseType}`)}
          >
            <div className="coverage-simulator-scenario-card__title">{card.title}</div>
            <div className="coverage-simulator-scenario-card__desc">{card.description}</div>
          </button>
        ))}
        <button
          type="button"
          className="coverage-simulator-primary-btn"
          style={{ width: '100%', marginTop: 8 }}
          onClick={() => navigate('/coverage-simulator/saved')}
        >
          저장된 상담 불러오기
        </button>
      </main>
    </CoverageSimulatorLayout>
  )
}
