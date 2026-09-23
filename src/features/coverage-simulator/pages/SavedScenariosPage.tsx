import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '../../auth/AuthProvider'
import { CoverageSimulatorLayout } from '../components/CoverageSimulatorLayout'
import type { DiseaseType } from '../domain/types'
import { filterSavedByDisease, listSavedScenarios } from '../storage/scenarioRepository'

const FILTERS: { id: DiseaseType | 'all'; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'cancer', label: '암' },
  { id: 'cerebrovascular', label: '뇌혈관' },
  { id: 'heart', label: '심장' },
  { id: 'care-dementia', label: '간병' },
]

export function SavedScenariosPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const userKey = user?.id ?? 'guest'
  const [filter, setFilter] = useState<DiseaseType | 'all'>('all')

  const rows = useMemo(() => {
    const all = listSavedScenarios(userKey)
    return filterSavedByDisease(all, filter)
  }, [filter, userKey])

  return (
    <CoverageSimulatorLayout>
      <header className="coverage-simulator-appbar">
        <button type="button" className="coverage-simulator-icon-btn" onClick={() => navigate('/coverage-simulator')}>
          ←
        </button>
        <div className="coverage-simulator-appbar__title">저장된 상담</div>
        <span />
      </header>
      <main className="coverage-simulator-content">
        <div className="coverage-simulator-saved-filter">
          {FILTERS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={`coverage-simulator-tab${filter === entry.id ? ' coverage-simulator-tab--active' : ''}`}
              onClick={() => setFilter(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </div>
        {rows.length === 0 ? (
          <p className="coverage-simulator-page-desc">저장된 상담이 없습니다.</p>
        ) : (
          rows.map((row) => (
            <button
              key={row.id}
              type="button"
              className="coverage-simulator-saved-row"
              onClick={() => navigate(`/coverage-simulator/scenarios/${row.id}`)}
            >
              <div>
                <div className="coverage-simulator-saved-row__title">
                  {row.customerName ? `${row.customerName} · ` : ''}
                  {row.title}
                </div>
                <div className="coverage-simulator-saved-row__meta">
                  상담일 {row.consultationDate} · 수정 {new Date(row.updatedAt).toLocaleString('ko-KR')}
                </div>
              </div>
              <span aria-hidden="true">⋯</span>
            </button>
          ))
        )}
      </main>
    </CoverageSimulatorLayout>
  )
}
