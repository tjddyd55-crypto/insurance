import { useMemo } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'

import { CustomerContextBar } from '../components/CustomerContextBar'
import { CoverageSimulatorLayout } from '../components/CoverageSimulatorLayout'
import { useCoverageSimulatorCustomer } from '../context/CoverageSimulatorCustomerContext'
import { useCoverageSimulatorScope } from '../CoverageSimulatorScope'
import { diseaseTypeTitle, isKnownDiseaseType } from '../domain/diseaseTypeLabels'
import { formatConsultationListDate } from '../domain/formatConsultationDate'
import { listConsultationsByDisease } from '../storage/scenarioRepository'

export function SimulationListPage() {
  const navigate = useNavigate()
  const { diseaseType: diseaseTypeParam } = useParams()
  const { basePath, userKey } = useCoverageSimulatorScope()
  const { draft: customerDraft } = useCoverageSimulatorCustomer()

  if (!diseaseTypeParam || !isKnownDiseaseType(diseaseTypeParam)) {
    return <Navigate to={basePath} replace />
  }

  const diseaseType = diseaseTypeParam
  const title = diseaseTypeTitle(diseaseType)

  const rows = useMemo(
    () => listConsultationsByDisease(userKey, diseaseType, customerDraft.customerId),
    [customerDraft.customerId, diseaseType, userKey],
  )

  return (
    <CoverageSimulatorLayout>
      <header className="coverage-simulator-appbar coverage-simulator-appbar--compact">
        <button type="button" className="coverage-simulator-icon-btn" onClick={() => navigate(basePath)} aria-label="뒤로">
          ←
        </button>
        <div className="coverage-simulator-appbar__title">{title}</div>
        <span />
      </header>
      <main className="coverage-simulator-content">
        <CustomerContextBar />
        <h2 className="cs-simulation-list__heading">저장된 시뮬레이션</h2>
        {rows.length === 0 ? (
          <p className="coverage-simulator-page-desc">저장된 시뮬레이션이 없습니다.</p>
        ) : (
          <div className="cs-simulation-list">
            {rows.map((row) => (
              <button
                key={row.id}
                type="button"
                className="cs-simulation-list__card"
                onClick={() => navigate(`${basePath}/scenarios/${row.id}`)}
              >
                <div className="cs-simulation-list__title">{row.title}</div>
                <div className="cs-simulation-list__meta">
                  작성 {formatConsultationListDate(row.createdAt)}
                </div>
                <div className="cs-simulation-list__meta">
                  수정 {formatConsultationListDate(row.updatedAt)}
                </div>
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          className="coverage-simulator-primary-btn cs-simulation-list__cta"
          onClick={() => navigate(`${basePath}/${diseaseType}/new`)}
        >
          + 새 시뮬레이션 만들기
        </button>
      </main>
    </CoverageSimulatorLayout>
  )
}
