import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { resolveAuthLandingPath } from '../../auth/landing'
import useIsMobile from '../../../hooks/useIsMobile'
import {
  applyBillingPromotionCode,
  completeMockBillingPayment,
  fetchCheckoutSummary,
  validateBillingPromotionCode,
  type CheckoutSummary,
} from '../api/insuranceBillingApi'
import { isInsuranceBillingEntitledStatus } from '../insuranceBillingConfig'
import '../insurance-billing.css'

function formatKrw(amount: number) {
  return `${amount.toLocaleString('ko-KR')}원`
}

function formatTrialEndsAt(iso: string | null | undefined) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`
}

export default function BillingCheckoutPage() {
  const { token, user } = useAuth()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [summary, setSummary] = useState<CheckoutSummary | null>(null)
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly')
  const [promoCode, setPromoCode] = useState('')
  const [promoMessage, setPromoMessage] = useState('')
  const [promoApplied, setPromoApplied] = useState<{ freeMonths?: number; trialEndsAt?: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!token?.trim()) return
    setLoading(true)
    setError('')
    try {
      const data = await fetchCheckoutSummary(token)
      setSummary(data)
      setBillingCycle(data.billingCycle === 'yearly' ? 'yearly' : 'monthly')
      if (isInsuranceBillingEntitledStatus(data.subscriptionStatus)) {
        navigate(resolveAuthLandingPath(isMobile, user?.role), { replace: true })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '결제 정보를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [token, navigate, isMobile, user?.role])

  useEffect(() => {
    void load()
  }, [load])

  const displayAmount = useMemo(() => {
    if (promoApplied) return 0
    if (!summary?.plan) return billingCycle === 'yearly' ? 88000 : 8800
    return billingCycle === 'yearly' ? summary.plan.yearlyTotal : summary.plan.monthlyTotal
  }, [summary, billingCycle, promoApplied])

  const ctaLabel = promoApplied
    ? `${promoApplied.freeMonths ?? 3}개월 무료로 시작하기`
    : displayAmount === 0
      ? '무료로 시작하기'
      : '결제하기'

  const handleValidatePromo = async () => {
    if (!token?.trim() || !promoCode.trim()) return
    setError('')
    setPromoMessage('')
    try {
      const result = await validateBillingPromotionCode(token, {
        code: promoCode.trim(),
        planCode: summary?.plan?.code ?? 'insurance_basic',
        billingCycle,
      })
      if (!result.valid) {
        setPromoMessage(result.message ?? '유효하지 않은 코드입니다.')
        setPromoApplied(null)
        return
      }
      setPromoMessage(result.message ?? '사용 가능한 코드입니다.')
    } catch (e) {
      setError(e instanceof Error ? e.message : '코드 확인에 실패했습니다.')
    }
  }

  const handlePrimaryAction = async () => {
    if (!token?.trim()) return
    setSubmitting(true)
    setError('')
    try {
      if (promoCode.trim() && !promoApplied) {
        const applied = await applyBillingPromotionCode(token, {
          code: promoCode.trim(),
          planCode: summary?.plan?.code ?? 'insurance_basic',
          billingCycle,
        })
        if (applied.status === 'trialing') {
          setPromoApplied({ freeMonths: applied.freeMonths, trialEndsAt: applied.trialEndsAt })
          navigate('/billing/success', { replace: true, state: { mode: 'trial', trialEndsAt: applied.trialEndsAt } })
          return
        }
      }

      if (displayAmount === 0 || promoApplied) {
        navigate('/billing/success', { replace: true, state: { mode: 'trial' } })
        return
      }

      await completeMockBillingPayment(token, {
        planCode: summary?.plan?.code ?? 'insurance_basic',
        billingCycle,
      })
      navigate('/billing/success', { replace: true, state: { mode: 'paid' } })
    } catch (e) {
      navigate('/billing/fail', { replace: true })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="insurance-billing-page">
      <div className="insurance-billing-page__shell">
        <div className="insurance-billing-page__title">
          <h1>보험 CRM 이용을 시작해보세요</h1>
          <p>
            고객관리, 청구관리, 파일관리, 소식지, 고객앱 소통까지 보험 업무에 필요한 기능을 한 곳에서
            사용할 수 있습니다.
          </p>
        </div>

        {loading ? <p className="insurance-billing-plan-note">불러오는 중...</p> : null}
        {error ? <p className="insurance-billing-error">{error}</p> : null}

        {!loading && summary ? (
          <div className="insurance-billing-page__grid">
            <section className="insurance-billing-card">
              <h2>{summary.plan?.name ?? '보험 CRM 베이직'}</h2>
              <div className="insurance-billing-cycle-toggle">
                <button
                  type="button"
                  className={billingCycle === 'monthly' ? 'is-active' : ''}
                  onClick={() => setBillingCycle('monthly')}
                >
                  월간
                </button>
                <button
                  type="button"
                  className={billingCycle === 'yearly' ? 'is-active' : ''}
                  onClick={() => setBillingCycle('yearly')}
                >
                  연간
                </button>
              </div>
              <p className="insurance-billing-plan-price">
                {formatKrw(billingCycle === 'yearly' ? summary.plan?.yearlyPrice ?? 80000 : summary.plan?.monthlyPrice ?? 8000)}
              </p>
              <p className="insurance-billing-plan-note">VAT 별도</p>
              {billingCycle === 'yearly' ? (
                <p className="insurance-billing-plan-note">연간 결제 · 2개월 무료 혜택</p>
              ) : null}
              <ul className="insurance-billing-benefit-list">
                <li>고객관리 · 상담 · 파일 · 메모</li>
                <li>청구/개인메시지 · 고객앱 연동</li>
                <li>소식지 · 전자서명 · PDF 자동화</li>
              </ul>
            </section>

            <section className="insurance-billing-card">
              <h2>결제 요약</h2>
              <div className="insurance-billing-field">
                <label htmlFor="billing-promo-code">무료/할인 코드</label>
                <input
                  id="billing-promo-code"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  placeholder="무료 이용권이나 할인 코드 입력"
                />
                <button type="button" className="insurance-billing-cta insurance-billing-cta--secondary" onClick={() => void handleValidatePromo()}>
                  코드 확인
                </button>
                <p className="insurance-billing-plan-note">
                  무료 이용권이나 할인 코드를 가지고 있다면 결제 전에 입력해 주세요.
                </p>
                {promoMessage ? <p className="insurance-billing-notice">{promoMessage}</p> : null}
              </div>

              {summary.referral ? (
                <div className="insurance-billing-notice insurance-billing-notice--muted">
                  추천인 코드가 정상 등록되었습니다.
                  <br />
                  추천인 혜택은 추천받은 사용자가 유료 결제를 시작한 후 추천인에게 적용됩니다.
                </div>
              ) : null}

              <div className="insurance-billing-summary-row">
                <span>오늘 결제금액</span>
                <span>{formatKrw(displayAmount)}</span>
              </div>
              <div className="insurance-billing-summary-row insurance-billing-summary-row--total">
                <span>합계 (VAT 포함)</span>
                <span>{formatKrw(displayAmount)}</span>
              </div>

              {promoApplied?.trialEndsAt ? (
                <div className="insurance-billing-notice">
                  3개월 무료 이용권이 적용되었습니다.
                  <br />
                  무료 종료일: {formatTrialEndsAt(promoApplied.trialEndsAt)}
                </div>
              ) : null}

              <button
                type="button"
                className="insurance-billing-cta"
                disabled={submitting}
                onClick={() => void handlePrimaryAction()}
              >
                {ctaLabel}
              </button>
            </section>
          </div>
        ) : null}
      </div>
    </main>
  )
}
