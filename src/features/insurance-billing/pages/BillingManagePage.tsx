import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { useConfirmDialog } from '../../../components/dialog'
import { ApiError } from '../../../lib/apiClient'
import {
  cancelBillingSubscription,
  changeBillingCycle,
  clearPendingBillingCycleChange,
  fetchBillingCheckoutConfig,
  fetchBillingManageSummary,
  resumeBillingSubscription,
  type BillingCheckoutConfig,
  type BillingManageSummaryResponse,
} from '../api/insuranceBillingApi'
import InsuranceBillingManagePanel from '../components/InsuranceBillingManagePanel'
import {
  formatBillingKoreanDate,
  formatChargePriceBreakdown,
  resolveNextBillingDate,
  resolveNextChargePreview,
} from '../billingManageViewUtils'
import { requestTossBillingAuth } from '../toss/requestTossBillingAuth'
import '../insurance-billing.css'

export default function BillingManagePage() {
  const { token } = useAuth()
  const navigate = useNavigate()
  const { confirm, confirmDialog } = useConfirmDialog()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [data, setData] = useState<BillingManageSummaryResponse | null>(null)
  const [checkoutConfig, setCheckoutConfig] = useState<BillingCheckoutConfig | null>(null)
  const [registeringMethod, setRegisteringMethod] = useState(false)
  const [registerError, setRegisterError] = useState('')
  const [actionBusy, setActionBusy] = useState(false)

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
        billingCycle: data?.subscription?.billingCycle ?? 'monthly',
      })
    } catch (e) {
      setRegisterError(e instanceof Error ? e.message : '결제수단 등록 창을 열지 못했습니다.')
    } finally {
      setRegisteringMethod(false)
    }
  }, [checkoutConfig, data?.subscription?.billingCycle])

  const handleChangeCycle = useCallback(
    async (cycle: 'monthly' | 'yearly') => {
      if (!token?.trim() || !data?.subscription) return
      const sub = data.subscription
      const plan = data.summary?.plan
      const applyDate = formatBillingKoreanDate(sub.nextBillingAt ?? sub.currentPeriodEnd)
      const amount =
        cycle === 'yearly' ? (plan?.yearlyTotal ?? 88000) : (plan?.monthlyTotal ?? 8800)
      const supply =
        cycle === 'yearly' ? (plan?.yearlyPrice ?? 80000) : (plan?.monthlyPrice ?? 8000)
      const vat = cycle === 'yearly' ? (plan?.yearlyVat ?? 8000) : (plan?.monthlyVat ?? 800)
      const price = formatChargePriceBreakdown({ total: amount, supply, vat, cycle })

      const confirmed = await confirm({
        title: cycle === 'yearly' ? '연간 요금제로 변경할까요?' : '월간 요금제로 변경할까요?',
        message: (
          <>
            현재 {sub.billingCycle === 'yearly' ? '연간' : '월간'} 이용기간은 {applyDate}까지 그대로
            유지됩니다.
            <br />
            <br />
            {applyDate}부터 {price.totalLabel}이 등록된 결제수단으로 자동결제됩니다.
            <br />
            {price.breakdownLabel}
          </>
        ),
        confirmLabel: cycle === 'yearly' ? '연간으로 변경' : '월간으로 변경',
        cancelLabel: '취소',
      })
      if (!confirmed) return

      setActionBusy(true)
      setActionMessage('')
      setError('')
      try {
        const result = await changeBillingCycle(token, cycle)
        if (result.subscription) {
          setData((prev) => (prev ? { ...prev, subscription: result.subscription! } : prev))
        } else {
          await load()
        }
        setActionMessage(
          result.noOp
            ? '현재 요금제와 동일합니다.'
            : `${cycle === 'yearly' ? '연간' : '월간'} 변경이 다음 자동결제일부터 예약되었습니다.`,
        )
      } catch (e) {
        setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : '요금제 변경에 실패했습니다.')
      } finally {
        setActionBusy(false)
      }
    },
    [token, data, confirm, load],
  )

  const handleClearPendingCycle = useCallback(async () => {
    if (!token?.trim()) return
    const confirmed = await confirm({
      title: '요금제 변경을 취소할까요?',
      message: '다음 자동결제일부터의 요금제 변경 예약이 취소됩니다. 현재 이용 중인 요금제는 그대로 유지됩니다.',
      confirmLabel: '변경 취소',
      cancelLabel: '돌아가기',
    })
    if (!confirmed) return

    setActionBusy(true)
    setActionMessage('')
    setError('')
    try {
      const result = await clearPendingBillingCycleChange(token)
      if (result.subscription) {
        setData((prev) => (prev ? { ...prev, subscription: result.subscription! } : prev))
      } else {
        await load()
      }
      setActionMessage('요금제 변경 예약이 취소되었습니다.')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : '변경 취소에 실패했습니다.')
    } finally {
      setActionBusy(false)
    }
  }, [token, confirm, load])

  const handleCancelAutoRenew = useCallback(async () => {
    if (!token?.trim() || !data?.subscription) return
    const endDate = formatBillingKoreanDate(
      data.subscription.currentPeriodEnd ?? data.subscription.nextBillingAt,
    )
    const confirmed = await confirm({
      title: '자동결제를 해지할까요?',
      message: (
        <>
          현재 이용기간은 {endDate}까지 유지됩니다.
          <br />
          <br />
          해지 후에는 다음 결제일부터 자동결제가 진행되지 않습니다.
          <br />
          이용기간 종료 전에는 언제든 자동결제를 다시 시작할 수 있습니다.
        </>
      ),
      confirmLabel: '자동결제 해지',
      cancelLabel: '돌아가기',
      tone: 'danger',
    })
    if (!confirmed) return

    setActionBusy(true)
    setActionMessage('')
    setError('')
    try {
      const result = await cancelBillingSubscription(token)
      if (result.subscription) {
        setData((prev) => (prev ? { ...prev, subscription: result.subscription! } : prev))
      } else {
        await load()
      }
      setActionMessage(`자동결제 해지가 예약되었습니다. ${endDate}까지 이용할 수 있습니다.`)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : '해지 예약에 실패했습니다.')
    } finally {
      setActionBusy(false)
    }
  }, [token, data, confirm, load])

  const handleResumeAutoRenew = useCallback(async () => {
    if (!token?.trim() || !data?.subscription) return
    const sub = data.subscription
    const hasCredential = Boolean(
      checkoutConfig?.hasBillingKey ?? sub.hasBillingCredential,
    )
    if (!hasCredential) {
      setError('등록된 결제수단이 없습니다. 결제수단을 등록한 후 다시 시도해 주세요.')
      navigate('/billing/checkout')
      return
    }

    const nextBillingDate = formatBillingKoreanDate(
      resolveNextBillingDate(sub, data.summary),
    )
    const chargePreview = resolveNextChargePreview(sub, data.summary)

    const confirmed = await confirm({
      title: '자동결제를 다시 시작할까요?',
      message: (
        <>
          해지 예약이 취소되고, 현재 등록된 결제수단으로 다음 결제일부터 자동결제가 다시 진행됩니다.
          <br />
          <br />
          오늘 추가 결제는 없습니다.
          <br />
          <br />
          다음 자동결제일: {nextBillingDate}
          <br />
          다음 결제금액: {chargePreview.totalLabel}
          <br />
          <span className="insurance-billing-manage-meta__muted">{chargePreview.breakdownLabel}</span>
        </>
      ),
      confirmLabel: '자동결제 다시 시작',
      cancelLabel: '취소',
    })
    if (!confirmed) return

    setActionBusy(true)
    setActionMessage('')
    setError('')
    try {
      const result = await resumeBillingSubscription(token)
      if (result.subscription) {
        setData((prev) => (prev ? { ...prev, subscription: result.subscription! } : prev))
      } else {
        await load()
      }
      setActionMessage(
        result.noOp ? '이미 자동결제가 사용 중입니다.' : '자동결제가 다시 시작되었습니다.',
      )
    } catch (e) {
      if (e instanceof ApiError && e.code === 'resume_requires_card') {
        setError('등록된 결제수단이 없습니다. 결제수단을 등록한 후 다시 시도해 주세요.')
        navigate('/billing/checkout')
        return
      }
      if (e instanceof ApiError && e.code === 'subscription_not_active_paid') {
        setError('현재 구독 상태에서는 자동결제를 다시 시작할 수 없습니다.')
        return
      }
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : '재시작에 실패했습니다.')
    } finally {
      setActionBusy(false)
    }
  }, [token, data, checkoutConfig, confirm, load, navigate])

  return (
    <main className="insurance-billing-page insurance-billing-manage-page">
      <div className="insurance-billing-page__shell">
        <div className="insurance-billing-page__title">
          <h1>구독 관리</h1>
          <p>요금제, 자동결제, 결제수단을 한곳에서 관리할 수 있습니다.</p>
        </div>
        {loading ? <p className="insurance-billing-plan-note">불러오는 중...</p> : null}
        {error ? <p className="insurance-billing-error">{error}</p> : null}
        {registerError ? <p className="insurance-billing-error">{registerError}</p> : null}
        {actionMessage ? <p className="insurance-billing-notice">{actionMessage}</p> : null}
        {!loading && data ? (
          <InsuranceBillingManagePanel
            summary={data.summary}
            subscription={data.subscription}
            payments={data.payments}
            showCheckoutLink={data.subscription?.status !== 'active_paid'}
            checkoutConfig={checkoutConfig}
            onRegisterMethod={
              checkoutConfig?.provider === 'toss' && Boolean(checkoutConfig.enabled)
                ? () => void handleRegisterMethod()
                : undefined
            }
            registeringMethod={registeringMethod}
            onChangeCycle={(cycle) => void handleChangeCycle(cycle)}
            onClearPendingCycle={() => void handleClearPendingCycle()}
            onCancelAutoRenew={() => void handleCancelAutoRenew()}
            onResumeAutoRenew={() => void handleResumeAutoRenew()}
            actionBusy={actionBusy}
          />
        ) : null}
      </div>
      {confirmDialog}
    </main>
  )
}
