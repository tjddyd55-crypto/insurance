import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import {
  fetchBillingCheckoutConfig,
  fetchBillingManageSummary,
  type BillingCheckoutConfig,
  type BillingManageSummaryResponse,
} from '../api/insuranceBillingApi'
import InsuranceBillingManagePanel from '../components/InsuranceBillingManagePanel'
import { requestTossBillingAuth } from '../toss/requestTossBillingAuth'
import '../insurance-billing.css'

export default function BillingManagePage() {
  const { token } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [data, setData] = useState<BillingManageSummaryResponse | null>(null)
  const [checkoutConfig, setCheckoutConfig] = useState<BillingCheckoutConfig | null>(null)
  const [registeringMethod, setRegisteringMethod] = useState(false)
  const [registerError, setRegisterError] = useState('')

  const load = useCallback(async () => {
    if (!token?.trim()) return
    setLoading(true)
    setError('')
    try {
      const [summary, config] = await Promise.all([
        fetchBillingManageSummary(token),
        fetchBillingCheckoutConfig(token).catch(() => null),
      ])
      setData(summary)
      setCheckoutConfig(config)
    } catch (e) {
      setError(e instanceof Error ? e.message : '결제 정보를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  const handleRegisterMethod = useCallback(async () => {
    if (!checkoutConfig?.clientKey || !checkoutConfig.customerKey) return
    setRegisteringMethod(true)
    setRegisterError('')
    try {
      await requestTossBillingAuth({
        clientKey: checkoutConfig.clientKey,
        customerKey: checkoutConfig.customerKey,
        intent: 'register',
        planCode: 'insurance_basic',
        billingCycle: 'monthly',
      })
    } catch (e) {
      setRegisterError(e instanceof Error ? e.message : '결제수단 등록 창을 열지 못했습니다.')
    } finally {
      setRegisteringMethod(false)
    }
  }, [checkoutConfig])

  return (
    <main className="insurance-billing-page insurance-billing-manage-page">
      <div className="insurance-billing-page__shell">
        <div className="insurance-billing-page__title">
          <h1>내 결제 상태</h1>
          <p>구독 상태와 결제 내역을 확인할 수 있습니다.</p>
        </div>
        {loading ? <p className="insurance-billing-plan-note">불러오는 중...</p> : null}
        {error ? <p className="insurance-billing-error">{error}</p> : null}
        {registerError ? <p className="insurance-billing-error">{registerError}</p> : null}
        {!loading && data ? (
          <InsuranceBillingManagePanel
            summary={data.summary}
            subscription={data.subscription}
            payments={data.payments}
            checkoutConfig={checkoutConfig}
            onRegisterMethod={
              checkoutConfig?.provider === 'toss' && Boolean(checkoutConfig.enabled)
                ? () => void handleRegisterMethod()
                : undefined
            }
            registeringMethod={registeringMethod}
          />
        ) : null}
      </div>
    </main>
  )
}
