import { useEffect, useState } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import { fetchBillingManageSummary, type BillingManageSummaryResponse } from '../api/insuranceBillingApi'
import InsuranceBillingManagePanel from '../components/InsuranceBillingManagePanel'
import '../insurance-billing.css'

export default function BillingManagePage() {
  const { token } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [data, setData] = useState<BillingManageSummaryResponse | null>(null)

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

  return (
    <main className="insurance-billing-page insurance-billing-manage-page">
      <div className="insurance-billing-page__shell">
        <div className="insurance-billing-page__title">
          <h1>내 결제 상태</h1>
          <p>구독 상태와 결제 내역을 확인할 수 있습니다.</p>
        </div>
        {loading ? <p className="insurance-billing-plan-note">불러오는 중...</p> : null}
        {error ? <p className="insurance-billing-error">{error}</p> : null}
        {!loading && data ? (
          <InsuranceBillingManagePanel
            summary={data.summary}
            subscription={data.subscription}
            payments={data.payments}
          />
        ) : null}
      </div>
    </main>
  )
}
