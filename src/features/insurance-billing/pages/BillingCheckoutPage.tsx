import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { resolveAuthLandingPath } from '../../auth/landing'
import useIsMobile from '../../../hooks/useIsMobile'
import { ApiError } from '../../../lib/apiClient'
import {
  applyBillingPromotionCode,
  fetchCheckoutSummary,
  requestBillingPayment,
  validateBillingPromotionCode,
  type CheckoutSummary,
} from '../api/insuranceBillingApi'
import { requestTossBillingAuth } from '../toss/requestTossBillingAuth'
import {
  canApplyPromotionCodeOnCheckout,
  resolveBillingCheckoutMode,
  type BillingCheckoutMode,
} from '../billingCheckoutViewState'
import {
  canReviewTenantStartCheckoutPayment,
} from '../../billing/storeReviewBillingAccess'
import {
  isApplyPromotionTrialingSuccess,
  resolveApplyPromotionTrialEndsAt,
} from '../billingApplyPromotion'
import '../insurance-billing.css'

function formatKrw(amount: number) {
  return `${amount.toLocaleString('ko-KR')}원`
}

function formatDateLabel(iso: string | null | undefined) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`
}

function addMonthsPreviewIso(months: number) {
  const d = new Date()
  d.setMonth(d.getMonth() + months)
  return d.toISOString()
}

function checkoutStatusBanner(mode: BillingCheckoutMode, summary: CheckoutSummary) {
  switch (mode) {
    case 'trialing':
      return (
        <div className="insurance-billing-banner">
          현재 무료 이용 중입니다.
          <br />
          무료 종료일: {formatDateLabel(summary.trialEndsAt)}
          <br />
          종료 후 계속 이용하려면 결제가 필요합니다.
        </div>
      )
    case 'active_paid':
      return (
        <div className="insurance-billing-notice">
          유료 이용 중입니다.
          {summary.nextBillingAt || summary.currentPeriodEnd ? (
            <>
              <br />
              다음 결제일: {formatDateLabel(summary.nextBillingAt ?? summary.currentPeriodEnd)}
            </>
          ) : null}
        </div>
      )
    case 'legacy_entitled':
      return (
        <div className="insurance-billing-notice insurance-billing-notice--muted">
          기존 이용자 활성 상태입니다.
          <br />
          결제 시스템 전환 안내: 아래에서 요금제를 확인하고 필요 시 결제수단을 등록할 수 있습니다.
        </div>
      )
    case 'pending_payment':
      return (
        <div className="insurance-billing-banner">
          서비스 이용을 위해 결제가 필요합니다.
        </div>
      )
    case 'payment_required':
      return (
        <div className="insurance-billing-banner">
          {summary.subscriptionStatus === 'expired'
            ? '무료 이용 기간이 종료되었습니다. 서비스를 계속 이용하려면 결제를 완료해 주세요.'
            : '서비스 이용을 위해 결제가 필요합니다.'}
        </div>
      )
    default:
      return null
  }
}

export default function BillingCheckoutPage() {
  const { token, user, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [summary, setSummary] = useState<CheckoutSummary | null>(null)
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly')
  const [promoCode, setPromoCode] = useState('')
  const [promoMessage, setPromoMessage] = useState('')
  const [promoValidated, setPromoValidated] = useState<{ freeMonths?: number; trialEndsAt?: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [summaryLoadError, setSummaryLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { replace: true, state: { from: '/billing/checkout' } })
    }
  }, [isAuthenticated, navigate])

  const load = useCallback(async () => {
    if (!token?.trim()) return
    setLoading(true)
    setError('')
    setSummaryLoadError(null)
    try {
      const data = await fetchCheckoutSummary(token)
      setSummary(data)
      setBillingCycle(data.billingCycle === 'yearly' ? 'yearly' : 'monthly')
    } catch (e) {
      const status = e instanceof ApiError ? e.status : undefined
      const code =
        e instanceof ApiError
          ? String(e.code ?? e.message ?? '').trim() || undefined
          : undefined
      console.error('[BillingCheckoutPage] checkout summary failed', { status, code, error: e })
      setSummary(null)
      setSummaryLoadError('결제 정보를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  const checkoutMode = useMemo(
    () => resolveBillingCheckoutMode(summary?.subscriptionStatus),
    [summary?.subscriptionStatus],
  )

  const promoAllowed = canApplyPromotionCodeOnCheckout(checkoutMode)
  const reviewCheckoutOpen = canReviewTenantStartCheckoutPayment(user)

  const displayAmount = useMemo(() => {
    if (promoValidated) return 0
    if (!summary?.plan) return billingCycle === 'yearly' ? 88000 : 8800
    return billingCycle === 'yearly' ? summary.plan.yearlyTotal : summary.plan.monthlyTotal
  }, [summary, billingCycle, promoValidated])

  const checkoutConfig = summary?.checkoutConfig
  // customerKey는 Toss auth 시 필요하지만, 버튼 노출 여부는 provider/enabled/clientKey로만 판단.
  // customerKey가 없어도 버튼은 노출하고, 클릭 시 fetch 혹은 에러를 처리한다.
  const canUseToss =
    !reviewCheckoutOpen &&
    checkoutConfig?.provider === 'toss' &&
    Boolean(checkoutConfig.enabled) &&
    Boolean(checkoutConfig.clientKey)
  const hasBillingKey = Boolean(checkoutConfig?.hasBillingKey)

  const isActiveEntitled = checkoutMode === 'legacy_entitled' || checkoutMode === 'active_paid'

  // 결제수단 등록/변경 버튼을 별도로 노출할지 여부 (Toss 사용 가능 + 기존 이용자)
  const showPaymentMethodBtn = isActiveEntitled && canUseToss && !reviewCheckoutOpen
  const paymentMethodBtnLabel = hasBillingKey ? '결제수단 변경' : '결제수단 등록'

  // primary CTA: 기존 이용자는 Toss 버튼을 별도 표시하므로 primary는 "내 결제 상태 보기"로만 처리
  const ctaLabel = useMemo(() => {
    if (reviewCheckoutOpen && isActiveEntitled) return '결제하기'
    if (isActiveEntitled) return '내 결제 상태 보기'
    if (checkoutMode === 'trialing') return hasBillingKey ? '결제하기' : '결제수단 등록'
    if (promoValidated?.freeMonths) return `${promoValidated.freeMonths}개월 무료로 시작하기`
    if (displayAmount === 0) return '무료로 시작하기'
    return '결제하기'
  }, [checkoutMode, promoValidated, displayAmount, reviewCheckoutOpen, isActiveEntitled, hasBillingKey])

  const handleValidatePromo = async () => {
    if (!token?.trim() || !promoCode.trim() || !promoAllowed) return
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
        setPromoValidated(null)
        return
      }
      if (result.type === 'free_months' && result.freeMonths) {
        const freeMonths = result.freeMonths
        setPromoValidated({ freeMonths, trialEndsAt: addMonthsPreviewIso(freeMonths) })
        setPromoMessage(
          `${freeMonths}개월 무료 이용권을 사용할 수 있습니다. 아래 "${freeMonths}개월 무료로 시작하기" 버튼을 눌러 적용해 주세요.`,
        )
        return
      }
      setPromoValidated(null)
      setPromoMessage(result.message ?? '사용 가능한 코드입니다.')
    } catch (e) {
      setError(e instanceof Error ? e.message : '코드 확인에 실패했습니다.')
    }
  }

  // 결제수단 등록/변경 버튼 핸들러 (기존 이용자 전용, charge 없음)
  const handlePaymentMethodAction = async () => {
    if (!token?.trim() || !checkoutConfig?.clientKey) return
    setSubmitting(true)
    setError('')
    try {
      // customerKey가 없으면 서버에서 할당받은 뒤 auth를 시작해야 하나,
      // checkoutConfig에 customerKey가 있으면 직접 사용한다.
      if (!checkoutConfig.customerKey) {
        setError('결제수단 등록을 위한 고객 키를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')
        return
      }
      await requestTossBillingAuth({
        clientKey: String(checkoutConfig.clientKey),
        customerKey: String(checkoutConfig.customerKey),
        intent: 'register',
        planCode: summary?.plan?.code ?? 'insurance_basic',
        billingCycle,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : '결제수단 등록 창을 열지 못했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  const handlePrimaryAction = async () => {
    if (!token?.trim()) return

    // 기존 이용자/유료 이용자: primary CTA는 manage로 이동 (결제수단은 별도 버튼)
    if (!reviewCheckoutOpen && isActiveEntitled) {
      navigate('/billing/manage')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      if (promoAllowed && promoValidated && promoCode.trim()) {
        const applied = await applyBillingPromotionCode(token, {
          code: promoCode.trim(),
          planCode: summary?.plan?.code ?? 'insurance_basic',
          billingCycle,
        })
        if (!isApplyPromotionTrialingSuccess(applied)) {
          setError(applied.message ?? '무료 이용권 적용이 완료되지 않았습니다.')
          return
        }
        const trialEndsAt = resolveApplyPromotionTrialEndsAt(applied)
        navigate('/billing/success', {
          replace: true,
          state: { mode: 'trial', trialEndsAt },
        })
        return
      }

      // trialing: 결제수단이 없으면 register 후 charge, 있으면 바로 charge
      const registerOnly = checkoutMode === 'trialing' && !reviewCheckoutOpen && !hasBillingKey
      const planCode = summary?.plan?.code ?? 'insurance_basic'

      if (canUseToss && !hasBillingKey) {
        await requestTossBillingAuth({
          clientKey: String(checkoutConfig!.clientKey),
          customerKey: String(checkoutConfig!.customerKey),
          intent: registerOnly ? 'register' : 'charge',
          planCode,
          billingCycle,
        })
        return
      }

      const result = await requestBillingPayment(token, {
        planCode,
        billingCycle,
        registerOnly,
      })
      if (result.needsBillingAuth && result.checkoutConfig?.clientKey && result.checkoutConfig.customerKey) {
        await requestTossBillingAuth({
          clientKey: result.checkoutConfig.clientKey,
          customerKey: result.checkoutConfig.customerKey,
          intent: registerOnly ? 'register' : 'charge',
          planCode,
          billingCycle,
        })
        return
      }
      if (result.subscriptionStatus === 'active_paid' || result.status === 'paid') {
        navigate('/billing/success', { replace: true, state: { mode: 'paid' } })
        return
      }
      if (result.registeredOnly || registerOnly) {
        navigate('/billing/manage', { replace: true })
        return
      }
      navigate('/billing/success', { replace: true, state: { mode: 'pending' } })
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : '요청 처리에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  const showPaymentSummary =
    checkoutMode === 'pending_payment' ||
    checkoutMode === 'payment_required' ||
    checkoutMode === 'trialing' ||
    reviewCheckoutOpen

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
        {summaryLoadError && !summary ? (
          <div className="insurance-billing-load-error">
            <p className="insurance-billing-error">{summaryLoadError}</p>
            <button
              type="button"
              className="insurance-billing-cta insurance-billing-cta--secondary"
              onClick={() => void load()}
            >
              다시 시도
            </button>
          </div>
        ) : null}
        {error ? <p className="insurance-billing-error">{error}</p> : null}

        {!loading && summary ? (
          <>
            {checkoutStatusBanner(checkoutMode, summary)}

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
                  {formatKrw(
                    billingCycle === 'yearly'
                      ? summary.plan?.yearlyPrice ?? 80000
                      : summary.plan?.monthlyPrice ?? 8000,
                  )}
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
                <h2>{isActiveEntitled ? '요금제 · 결제 관리' : '결제 요약'}</h2>

                {showPaymentMethodBtn ? (
                  <dl className="insurance-billing-manage-meta">
                    <div className="insurance-billing-manage-meta__row">
                      <dt>결제수단</dt>
                      <dd>
                        {hasBillingKey
                          ? [checkoutConfig?.cardCompany, checkoutConfig?.cardNumberMasked].filter(Boolean).join(' ') || '등록됨'
                          : '미등록'}
                      </dd>
                    </div>
                  </dl>
                ) : null}

                {promoAllowed ? (
                  <div className="insurance-billing-field">
                    <label htmlFor="billing-promo-code">무료/할인 코드</label>
                    <input
                      id="billing-promo-code"
                      value={promoCode}
                      onChange={(e) => {
                        setPromoCode(e.target.value.toUpperCase())
                        setPromoValidated(null)
                        setPromoMessage('')
                      }}
                      placeholder="무료 이용권이나 할인 코드 입력"
                    />
                    <button
                      type="button"
                      className="insurance-billing-cta insurance-billing-cta--secondary"
                      onClick={() => void handleValidatePromo()}
                    >
                      코드 확인
                    </button>
                    <p className="insurance-billing-plan-note">
                      무료 이용권이나 할인 코드를 가지고 있다면 결제 전에 입력해 주세요.
                    </p>
                    {promoMessage ? <p className="insurance-billing-notice">{promoMessage}</p> : null}
                  </div>
                ) : (
                  <p className="insurance-billing-plan-note">
                    {checkoutMode === 'trialing'
                      ? '무료 이용 중에는 추가 무료 코드를 적용할 수 없습니다.'
                      : '현재 이용 중인 요금제를 확인할 수 있습니다.'}
                  </p>
                )}

                {summary.referral ? (
                  <div className="insurance-billing-notice insurance-billing-notice--muted">
                    추천인 코드가 정상 등록되었습니다.
                    <br />
                    추천인 혜택은 추천받은 사용자가 유료 결제를 시작한 후 추천인에게 적용됩니다.
                  </div>
                ) : null}

                {showPaymentSummary ? (
                  <>
                    <div className="insurance-billing-summary-row">
                      <span>오늘 결제금액</span>
                      <span>{formatKrw(displayAmount)}</span>
                    </div>
                    <div className="insurance-billing-summary-row insurance-billing-summary-row--total">
                      <span>합계 (VAT 포함)</span>
                      <span>{formatKrw(displayAmount)}</span>
                    </div>
                  </>
                ) : null}

                {promoValidated?.trialEndsAt ? (
                  <div className="insurance-billing-notice">
                    {promoValidated.freeMonths ?? 1}개월 무료 이용권 미리보기
                    <br />
                    예상 무료 종료일: {formatDateLabel(promoValidated.trialEndsAt)}
                  </div>
                ) : null}

                {/* 결제수단 등록/변경: 기존 이용자 + Toss 사용 가능 시 최상단 */}
                {showPaymentMethodBtn ? (
                  <button
                    type="button"
                    className="insurance-billing-cta"
                    disabled={submitting}
                    onClick={() => void handlePaymentMethodAction()}
                  >
                    {paymentMethodBtnLabel}
                  </button>
                ) : null}

                {/* primary CTA: 결제 / 내 결제 상태 보기 / 무료 시작 등 */}
                <button
                  type="button"
                  className={showPaymentMethodBtn ? 'insurance-billing-cta insurance-billing-cta--secondary' : 'insurance-billing-cta'}
                  disabled={submitting}
                  onClick={() => void handlePrimaryAction()}
                >
                  {ctaLabel}
                </button>

                {isActiveEntitled && (
                  <Link
                    to={resolveAuthLandingPath(isMobile, user?.role)}
                    className="insurance-billing-cta insurance-billing-cta--secondary"
                  >
                    CRM으로 이동
                  </Link>
                )}
              </section>
            </div>
          </>
        ) : null}
      </div>
    </main>
  )
}
