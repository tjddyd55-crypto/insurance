import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { fetchBillingManageSummary } from '../api/insuranceBillingApi'
import '../insurance-billing.css'

export default function BillingManagePage() {
  const { token } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchBillingManageSummary>> | null>(null)

  useEffect(() => {
    if (!token?.trim()) return
    void (async () => {
      setLoading(true)
      try {
        setData(await fetchBillingManageSummary(token))
      } catch (e) {
        setError(e instanceof Error ? e.message : '결제 정보를 불러오지 못했습니다.')
      } finally {
        setLoading(false)
      }
    })()
  }, [token])

  const summary = data?.summary

  return (
    <main className="insurance-billing-page">
      <div className="insurance-billing-page__shell">
        <div className="insurance-billing-card">
          <h1>내 결제 상태</h1>
          {loading ? <p className="insurance-billing-plan-note">불러오는 중...</p> : null}
          {error ? <p className="insurance-billing-error">{error}</p> : null}
          {summary ? (
            <>
              <div className="insurance-billing-summary-row">
                <span>요금제</span>
                <span>{summary.plan?.name ?? '보험 CRM 베이직'}</span>
              </div>
              <div className="insurance-billing-summary-row">
                <span>구독 상태</span>
                <span>{summary.subscriptionStatus}</span>
              </div>
              <div className="insurance-billing-summary-row">
                <span>결제 주기</span>
                <span>{summary.billingCycle === 'yearly' ? '연간' : '월간'}</span>
              </div>
              {summary.trialEndsAt ? (
                <div className="insurance-billing-banner">
                  현재 무료 이용 중입니다.
                  <br />
                  무료 종료일: {summary.trialEndsAt.slice(0, 10)}
                  <br />
                  종료 후 계속 이용하려면 결제가 필요합니다.
                </div>
              ) : null}
            </>
          ) : null}
          <Link to="/billing/checkout" className="insurance-billing-cta">
            결제/요금제 변경
          </Link>
        </div>
      </div>
    </main>
  )
}
