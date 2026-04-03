import { useEffect, useMemo, useState } from 'react'
import { CompanyCard } from '../../company-registry/components/CompanyCard'
import { PageBackButton } from '../../../components/common/PageBackButton'
import { getCompanyRecentUpdates } from '../../company-registry/api/companyRegistryApi'
import { useAuth } from '../../auth/AuthProvider'
import type { CompanyUpdateHistoryItem } from '../../company-registry/domain/types'

function formatHistoryDate(isoDate: string): string {
  if (!isoDate || isoDate === '날짜 없음') {
    return isoDate || '날짜 없음'
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    const [y, m, d] = isoDate.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('ko-KR')
  }
  return isoDate
}

function groupHistoryByDate(items: CompanyUpdateHistoryItem[]) {
  const groups: { date: string; items: CompanyUpdateHistoryItem[] }[] = []
  for (const item of items) {
    const date = item.updatedAt || '날짜 없음'
    const last = groups[groups.length - 1]
    if (last && last.date === date) {
      last.items.push(item)
    } else {
      groups.push({ date, items: [item] })
    }
  }
  return groups
}

export function InsuranceUpdatesPage() {
  const { token } = useAuth()
  const [list, setList] = useState<CompanyUpdateHistoryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [statusText, setStatusText] = useState('')

  useEffect(() => {
    let active = true

    async function load() {
      if (!token) {
        if (active) {
          setIsLoading(false)
        }
        return
      }
      try {
        const result = await getCompanyRecentUpdates(token)
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
  }, [token])

  const grouped = useMemo(() => groupHistoryByDate(list), [list])

  return (
    <main className="page page--with-back contacts-page insurance-recent-updates-page insurance-contacts-view company-directory-read-ui">
      <PageBackButton />

      <header className="page-header">
        <h1>업데이트 현황</h1>
        <p>
          {statusText ||
            '원수사 연락처를 저장할 때마다 날짜·보험사별로 변경 요약이 쌓입니다. 빨간 글자는 직전 저장 대비 바뀐 값입니다.'}
        </p>
      </header>

      <section className="insurance-contacts-list-wrap" aria-live="polite">
        <h2 className="dashboard-section-title visually-hidden">변경 히스토리</h2>
        {isLoading ? (
          <p className="dashboard-empty">불러오는 중입니다…</p>
        ) : list.length === 0 ? (
          <div className="empty-box" role="status">
            📭 표시할 업데이트가 없습니다
          </div>
        ) : (
          <div className="update-history">
            {grouped.map((block) => (
              <div key={block.date} className="history-block">
                <div className="history-date">{formatHistoryDate(block.date)}</div>
                <div className="insurance-contacts-cards">
                  {block.items.map((item) => (
                    <CompanyCard
                      key={item.id}
                      variant="history"
                      companyName={item.companyName}
                      before={item.before}
                      after={item.after}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
