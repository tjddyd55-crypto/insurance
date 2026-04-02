import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCompanyRecentUpdates } from '../../company-registry/api/companyRegistryApi'
import type { CompanyRecentUpdate } from '../../company-registry/domain/types'

export function InsuranceUpdatesPage() {
  const navigate = useNavigate()
  const [list, setList] = useState<CompanyRecentUpdate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [statusText, setStatusText] = useState('')

  useEffect(() => {
    let active = true

    async function load() {
      try {
        const result = await getCompanyRecentUpdates()
        if (!active) {
          return
        }
        setList(result)
      } catch (error) {
        if (!active) {
          return
        }
        setStatusText(error instanceof Error ? error.message : '목록을 불러오지 못했습니다.')
      } finally {
        if (active) {
          setIsLoading(false)
        }
      }
    }

    void load()
    return () => {
      active = false
    }
  }, [])

  return (
    <main className="page contacts-page insurance-recent-updates-page">
      <header className="page-header">
        <h1>업데이트 현황</h1>
        <p>
          {statusText || '보험사 연락처(마스터)가 최근 저장·갱신된 순입니다. 등록 시각 기준입니다.'}
        </p>
      </header>

      <section className="card contacts-toolbar">
        <div className="contacts-toolbar__actions">
          <button className="button" type="button" onClick={() => navigate('/insurance/contacts')}>
            연락처 조회
          </button>
          <button className="button" type="button" onClick={() => navigate('/insurance/company-registry')}>
            연락처 입력/관리
          </button>
          <button className="button" type="button" onClick={() => navigate('/dashboard')}>
            메뉴
          </button>
        </div>
      </section>

      <section className="card" aria-live="polite">
        <h2 className="dashboard-section-title">최근 업데이트</h2>
        {isLoading ? (
          <p className="dashboard-empty">불러오는 중입니다…</p>
        ) : list.length === 0 ? (
          <div className="empty-box" role="status">
            📭 표시할 업데이트가 없습니다
            <br />
            연락처를 저장하면 최근 순으로 나타납니다
          </div>
        ) : (
          <ul className="recent-updates-list">
            {list.map((item) => (
              <li key={item.id} className="record-card recent-updates-list__item">
                <div className="recent-updates-list__title">{item.companyName}</div>
                <div className="recent-updates-list__meta">
                  <span className="recent-updates-list__date">{item.updatedAt}</span>
                  {item.updatedBy ? (
                    <>
                      <span aria-hidden="true"> · </span>
                      <span>{item.updatedBy}</span>
                    </>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
