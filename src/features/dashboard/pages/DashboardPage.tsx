import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { InsuranceApplicationRecord } from '../../application/domain/types'
import {
  listApplications,
  listExpiringApplications,
} from '../../application/repository/applicationRepository'
import { useAuth } from '../../auth/AuthProvider'

function getDaysLeft(expiryDate: string): number {
  if (!expiryDate) {
    return Number.POSITIVE_INFINITY
  }

  const today = new Date()
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const target = new Date(`${expiryDate}T00:00:00`)
  if (Number.isNaN(target.getTime())) {
    return Number.POSITIVE_INFINITY
  }

  const diffMs = target.getTime() - startOfToday.getTime()
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000))
}

function getExpiryBadgeClassName(expiryDate: string): string {
  const daysLeft = getDaysLeft(expiryDate)
  if (daysLeft <= 7) {
    return 'expiry-badge expiry-badge--danger'
  }
  return 'expiry-badge expiry-badge--warning'
}

export function DashboardPage() {
  const navigate = useNavigate()
  const { user, token, logout } = useAuth()
  const [expiringRecords, setExpiringRecords] = useState<InsuranceApplicationRecord[]>([])
  const [recentRecords, setRecentRecords] = useState<InsuranceApplicationRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [statusText, setStatusText] = useState('')

  useEffect(() => {
    let active = true

    async function loadDashboard() {
      if (!token) {
        return
      }

      try {
        const [expiring, recent] = await Promise.all([
          listExpiringApplications(token),
          listApplications(token),
        ])
        if (!active) {
          return
        }
        setExpiringRecords(expiring)
        setRecentRecords(recent.slice(0, 5))
        setStatusText('')
      } catch (error) {
        if (!active) {
          return
        }
        setStatusText(error instanceof Error ? error.message : '대시보드 데이터를 불러오지 못했습니다.')
      } finally {
        if (active) {
          setIsLoading(false)
        }
      }
    }

    void loadDashboard()
    return () => {
      active = false
    }
  }, [token])

  const expiringTitle = useMemo(
    () => `📌 만기 임박 보험 (${expiringRecords.length})`,
    [expiringRecords.length],
  )

  return (
    <main className="page">
      <header className="page-header">
        <h1>대시보드</h1>
        <p>
          {statusText ||
            `${user?.username} 님, 만기 임박 보험과 최근 신청서를 확인하세요.`}
        </p>
      </header>

      <section className="card dashboard-expiring-card">
        <h2 className="dashboard-section-title">{expiringTitle}</h2>
        {isLoading ? (
          <p className="dashboard-empty">만기 데이터를 불러오는 중입니다...</p>
        ) : expiringRecords.length === 0 ? (
          <p className="dashboard-empty">30일 이내 만기 임박 보험이 없습니다.</p>
        ) : (
          <div className="dashboard-table-wrap">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>고객명</th>
                  <th>차량번호</th>
                  <th>만기일</th>
                  <th>상태</th>
                  <th>열기</th>
                </tr>
              </thead>
              <tbody>
                {expiringRecords.map((record) => (
                  <tr key={record.id}>
                    <td>{record.customerName || record.ownerName || '미입력'}</td>
                    <td>{record.carNumber || record.vehicleNumber || '미입력'}</td>
                    <td>{record.expiryDate || '-'}</td>
                    <td>
                      <span className={getExpiryBadgeClassName(record.expiryDate)}>
                        {getDaysLeft(record.expiryDate) <= 7 ? '🔴 7일 이내' : '🟡 30일 이내'}
                      </span>
                    </td>
                    <td>
                      <button
                        className="button button--small"
                        type="button"
                        onClick={() => navigate(`/form/${record.id}/edit?mode=readonly`)}
                      >
                        열기
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card dashboard-recent-card">
        <h2 className="dashboard-section-title">📌 최근 작성 신청서</h2>
        {isLoading ? (
          <p className="dashboard-empty">최근 신청서를 불러오는 중입니다...</p>
        ) : recentRecords.length === 0 ? (
          <p className="dashboard-empty">최근 작성한 신청서가 없습니다.</p>
        ) : (
          <ul className="dashboard-recent-list">
            {recentRecords.map((record) => (
              <li key={record.id} className="dashboard-recent-item">
                <div>
                  <strong>{record.customerName || record.ownerName || '미입력'}</strong>
                  <span>{record.carNumber || record.vehicleNumber || '미입력'}</span>
                </div>
                <button
                  className="button button--small"
                  type="button"
                  onClick={() => navigate(`/form/${record.id}/edit?mode=readonly`)}
                >
                  열기
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card dashboard-card">
        <h2 className="dashboard-section-title">📌 새 신청서 작성</h2>
        <button
          className="button button--primary button--full"
          type="button"
          onClick={() => navigate('/form/create')}
        >
          신청서 작성
        </button>
        <button className="button button--full" type="button" onClick={() => navigate('/my-forms')}>
          내 신청서 목록
        </button>
        <button
          className="button button--secondary button--full"
          type="button"
          onClick={() => {
            logout()
            navigate('/login', { replace: true })
          }}
        >
          로그아웃
        </button>
      </section>
    </main>
  )
}
