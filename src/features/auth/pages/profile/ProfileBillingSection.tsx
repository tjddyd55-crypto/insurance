import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  fetchBillingCheckoutConfig,
  fetchBillingManageSummary,
  type BillingCheckoutConfig,
  type BillingManageSummaryResponse,
} from '../../../insurance-billing/api/insuranceBillingApi'
import {
  formatBillingDotDate,
  resolveNextBillingDate,
  resolveSubscriptionStatusLabel,
} from '../../../insurance-billing/billingManageViewUtils'
import { resolveInsuranceBillingProfileEntryPath } from '../../../insurance-billing/insuranceBillingLanding'

type Props = {
  token: string
}

export default function ProfileBillingSection({ token }: Props) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [data, setData] = useState<BillingManageSummaryResponse | null>(null)
  const [checkoutConfig, setCheckoutConfig] = useState<BillingCheckoutConfig | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!token.trim()) return
      setLoading(true)
      setError('')
      try {
        const [summary, config] = await Promise.all([
          fetchBillingManageSummary(token),
          fetchBillingCheckoutConfig(token).catch(() => null),
        ])
        if (cancelled) return
        setData(summary)
        setCheckoutConfig(config)
      } catch {
        if (cancelled) return
        setData(null)
        setCheckoutConfig(null)
        setError('결제 정보를 불러오지 못했습니다.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [token])

  const status = data?.subscription?.status ?? data?.summary?.subscriptionStatus ?? ''
  const statusLabel = status ? resolveSubscriptionStatusLabel(status) : '—'
  const nextBilling = formatBillingDotDate(resolveNextBillingDate(data?.subscription, data?.summary))
  const hasBillingKey = Boolean(checkoutConfig?.hasBillingKey)
  const paymentMethodLabel = hasBillingKey
    ? [checkoutConfig?.cardCompany, checkoutConfig?.cardNumberMasked].filter(Boolean).join(' ') || '등록됨'
    : '미등록'
  const entryPath = resolveInsuranceBillingProfileEntryPath({
    hasBillingKey,
    subscriptionStatus: status,
    trialEndsAt: data?.subscription?.trialEndsAt ?? data?.summary?.trialEndsAt ?? null,
    currentPeriodEnd:
      data?.subscription?.currentPeriodEnd ?? data?.summary?.currentPeriodEnd ?? null,
    isEntitled: data?.summary?.isEntitled,
  })

  return (
    <section className="profile-page__section profile-billing-section">
      <h2 className="profile-page__section-title">결제 및 구독</h2>
      <p className="profile-page__section-desc">이용 상태와 결제수단을 확인하고 결제를 관리할 수 있습니다.</p>
      {loading ? (
        <p className="profile-page__status profile-page__status--muted">결제 정보를 불러오는 중…</p>
      ) : null}
      {error ? (
        <p className="profile-page__status profile-page__status--error" role="alert">
          {error}
        </p>
      ) : null}
      {!loading && !error ? (
        <dl className="profile-billing-meta">
          <dt>현재 이용 상태</dt>
          <dd>{statusLabel}</dd>
          <dt>다음 결제일</dt>
          <dd>{nextBilling}</dd>
          <dt>결제수단</dt>
          <dd>{paymentMethodLabel}</dd>
        </dl>
      ) : null}
      <Link to={entryPath} className="profile-page__btn button button--secondary button--full profile-page__section-action">
        결제 관리
      </Link>
    </section>
  )
}
