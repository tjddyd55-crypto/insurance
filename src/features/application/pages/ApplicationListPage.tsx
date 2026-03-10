import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { InsuranceApplicationRecord } from '../domain/types'
import { listApplications } from '../repository/applicationRepository'
import { formatKoreanDateTime } from '../utils/date'

export function ApplicationListPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [records, setRecords] = useState<InsuranceApplicationRecord[]>([])

  useEffect(() => {
    setRecords(listApplications())
  }, [location.key])

  return (
    <main className="page">
      <header className="page-header">
        <h1>자동차 보험 신청서</h1>
        <p>모바일에서 작성하고, 저장/불러오기/공유까지 처리합니다.</p>
      </header>

      <div className="card card--actions">
        <button
          className="button button--primary button--full"
          onClick={() => navigate('/applications/new')}
          type="button"
        >
          신규 작성
        </button>
      </div>

      <section className="list-section">
        <h2>저장된 신청서</h2>
        {records.length === 0 ? (
          <p className="empty-state">저장된 신청서가 없습니다.</p>
        ) : (
          <ul className="record-list">
            {records.map((record) => (
              <li key={record.id} className="record-card">
                <p className="record-card__title">{record.title}</p>
                <p className="record-card__meta">
                  수정일: {formatKoreanDateTime(record.updatedAt)}
                </p>
                <div className="record-card__actions">
                  <button
                    className="button button--secondary"
                    type="button"
                    onClick={() => navigate(`/applications/${record.id}/edit`)}
                  >
                    불러오기
                  </button>
                  <button
                    className="button"
                    type="button"
                    onClick={() => navigate(`/applications/${record.id}/result`)}
                  >
                    결과보기
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
