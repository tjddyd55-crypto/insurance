import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { resolveAuthLandingPath } from '../../auth/landing'
import useIsMobile from '../../../hooks/useIsMobile'
import { ApiError } from '../../../lib/apiClient'
import {
  applyBillingPromotionCode,
  fetchCheckoutQuote,
  fetchCheckoutSummary,
  requestBillingPayment,
  type CheckoutQuote,
  type CheckoutSummary,
} from '../api/insuranceBillingApi'
import { requestTossBillingAuth } from '../toss/requestTossBillingAuth'
import {
  canApplyPromotionCodeOnCheckout,
  canRunTestCharge as resolveCanRunTestCharge,
  resolveBillingCheckoutMode,
} from '../billingCheckoutViewState'
import {
  isApplyPromotionTrialingSuccess,
  resolveApplyPromotionTrialEndsAt,
} from '../billingApplyPromotion'
import type { BillingCheckoutViewProps } from '../pages/checkout/billingCheckoutViewProps'

function formatKrw(amount: number) {
  return `${amount.toLocaleString('ko-KR')}원`
}

export function useBillingCheckoutState(): BillingCheckoutViewProps & {
  crmPath: string
} {
  const { token, user, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [summary, setSummary] = useState<CheckoutSummary | null>(null)
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly')
  const [promoCode, setPromoCode] = useState('')
  const [appliedPromoCode, setAppliedPromoCode] = useState<string | null>(null)
  const [promoMessage, setPromoMessage] = useState('')
  const [quote, setQuote] = useState<CheckoutQuote | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [summaryLoadError, setSummaryLoadError] = useState<string | null>(null)
  const [qaTestCode, setQaTestCode] = useState('')

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
      console.error('[BillingCheckout] summary failed', e)
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
  const checkoutConfig = summary?.checkoutConfig
  const canUseToss =
    checkoutConfig?.provider === 'toss' &&
    Boolean(checkoutConfig.enabled) &&
    Boolean(checkoutConfig.clientKey)
  const hasBillingKey = Boolean(checkoutConfig?.hasBillingKey)
  const isActiveEntitled =
    checkoutMode === 'legacy_entitled' ||
    checkoutMode === 'active_paid' ||
    checkoutMode === 'trialing' ||
    Boolean(summary?.isEntitled)
  const canRunTestCharge = resolveCanRunTestCharge(checkoutConfig, hasBillingKey)
  const planCode = summary?.plan?.code ?? 'insurance_basic'

  const refreshQuote = useCallback(
    async (cycle: 'monthly' | 'yearly', promotionCode: string | null) => {
      if (!token?.trim() || isActiveEntitled) {
        setQuote(null)
        return
      }
      setQuoteLoading(true)
      try {
        const { quote: next } = await fetchCheckoutQuote(token, {
          planCode,
          billingCycle: cycle,
          promotionCode,
        })
        setQuote(next)
        if (!next.valid && promotionCode) {
          setPromoMessage(next.message ?? '사용할 수 없는 쿠폰입니다.')
          setAppliedPromoCode(null)
        }
      } catch (e) {
        setQuote(null)
        setError(e instanceof Error ? e.message : '결제 금액을 계산하지 못했습니다.')
      } finally {
        setQuoteLoading(false)
      }
    },
    [token, planCode, isActiveEntitled],
  )

  useEffect(() => {
    if (loading || !summary || isActiveEntitled) return
    void refreshQuote(billingCycle, appliedPromoCode)
  }, [loading, summary, billingCycle, appliedPromoCode, isActiveEntitled, refreshQuote])

  const todayAmount = quote?.todayChargeAmount ?? (billingCycle === 'yearly' ? 88000 : 8800)

  const ctaLabel = useMemo(() => {
    if (isActiveEntitled) return '구독 관리'
    if (checkoutMode === 'trialing') return hasBillingKey ? '결제하기' : '결제수단 등록'
    if (quote?.benefitKind === 'free_months' && quote.coupon?.freeMonths) {
      return `${quote.coupon.freeMonths}개월 무료로 시작하기`
    }
    if (todayAmount === 0) return '무료 이용 시작하기'
    return `${formatKrw(todayAmount)} 결제하기`
  }, [isActiveEntitled, checkoutMode, hasBillingKey, quote, todayAmount])

  const ctaDisabled =
    submitting ||
    loading ||
    (!isActiveEntitled &&
      (quoteLoading ||
        !quote ||
        !quote.valid ||
        (quote.benefitKind !== 'free_months' && !canUseToss)))

  const onSelectCycle = (cycle: 'monthly' | 'yearly') => {
    setBillingCycle(cycle)
    setError('')
  }

  const onApplyPromo = async () => {
    if (!token?.trim() || !promoCode.trim() || !promoAllowed) return
    setError('')
    setPromoMessage('')
    try {
      const { quote: next } = await fetchCheckoutQuote(token, {
        planCode,
        billingCycle,
        promotionCode: promoCode.trim(),
      })
      setQuote(next)
      if (!next.valid) {
        setAppliedPromoCode(null)
        setPromoMessage(next.message ?? '사용할 수 없는 쿠폰입니다.')
        return
      }
      setAppliedPromoCode(String(next.coupon?.code ?? promoCode.trim()).toUpperCase())
      setPromoMessage(next.coupon?.message ?? '쿠폰이 적용되었습니다.')
    } catch (e) {
      setError(e instanceof Error ? e.message : '쿠폰 확인에 실패했습니다.')
    }
  }

  const onClearPromo = () => {
    setAppliedPromoCode(null)
    setPromoCode('')
    setPromoMessage('')
    void refreshQuote(billingCycle, null)
  }

  const startTossAuth = async (intent: 'register' | 'charge') => {
    if (!checkoutConfig?.clientKey || !checkoutConfig.customerKey) {
      setError('결제수단 등록을 위한 정보를 불러오지 못했습니다.')
      return
    }
    await requestTossBillingAuth({
      clientKey: String(checkoutConfig.clientKey),
      customerKey: String(checkoutConfig.customerKey),
      intent,
      planCode,
      billingCycle,
      promotionCode: appliedPromoCode,
    })
  }

  const onRegisterCard = async () => {
    setSubmitting(true)
    setError('')
    try {
      await startTossAuth('register')
    } catch (e) {
      setError(e instanceof Error ? e.message : '결제수단 등록 창을 열지 못했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  const onPrimaryAction = async () => {
    if (!token?.trim()) return
    if (isActiveEntitled) {
      navigate('/billing/manage')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      if (promoAllowed && quote?.benefitKind === 'free_months' && appliedPromoCode) {
        const applied = await applyBillingPromotionCode(token, {
          code: appliedPromoCode,
          planCode,
          billingCycle,
        })
        if (!isApplyPromotionTrialingSuccess(applied)) {
          setError(applied.message ?? '무료 이용권 적용이 완료되지 않았습니다.')
          return
        }
        navigate('/billing/success', {
          replace: true,
          state: {
            mode: 'trial',
            trialEndsAt: resolveApplyPromotionTrialEndsAt(applied),
            quote,
          },
        })
        return
      }

      if (checkoutMode === 'trialing' && !hasBillingKey) {
        await startTossAuth('register')
        return
      }

      if (!hasBillingKey) {
        await startTossAuth('charge')
        return
      }

      const result = await requestBillingPayment(token, {
        planCode,
        billingCycle,
        promotionCode: appliedPromoCode ?? undefined,
        registerOnly: false,
      })
      if (result.status === 'paid' || result.subscriptionStatus === 'active_paid') {
        navigate('/billing/success', {
          replace: true,
          state: { mode: 'paid', quote },
        })
        return
      }
      if (result.needsBillingAuth && result.checkoutConfig?.clientKey && result.checkoutConfig.customerKey) {
        await requestTossBillingAuth({
          clientKey: result.checkoutConfig.clientKey,
          customerKey: result.checkoutConfig.customerKey,
          intent: 'charge',
          planCode,
          billingCycle,
          promotionCode: appliedPromoCode,
        })
        return
      }
      navigate('/billing/success', { replace: true, state: { mode: 'paid', quote } })
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : '결제 처리에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  const onTestCharge = async () => {
    if (!token?.trim() || !canRunTestCharge) return
    setSubmitting(true)
    setError('')
    try {
      const result = await requestBillingPayment(token, {
        planCode,
        billingCycle,
        promotionCode: appliedPromoCode ?? undefined,
        registerOnly: false,
        testCode: qaTestCode.trim() || null,
      })
      if (result.status === 'paid' || result.subscriptionStatus === 'active_paid') {
        navigate('/billing/success', { replace: true, state: { mode: 'paid', quote } })
        return
      }
      navigate('/billing/success', { replace: true, state: { mode: 'paid', quote } })
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : '결제 처리에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  const crmPath = resolveAuthLandingPath(isMobile, user?.role)

  return {
    loading,
    summaryLoadError,
    error,
    summary,
    checkoutMode,
    billingCycle,
    onSelectCycle,
    promoAllowed,
    promoCode,
    onPromoCodeChange: (value) => setPromoCode(value.toUpperCase()),
    onApplyPromo: () => void onApplyPromo(),
    onClearPromo,
    promoMessage,
    quote,
    quoteLoading,
    checkoutConfig,
    hasBillingKey,
    canUseToss,
    isActiveEntitled,
    submitting,
    ctaLabel,
    ctaDisabled: Boolean(ctaDisabled),
    onRegisterCard: () => void onRegisterCard(),
    onPrimaryAction: () => void onPrimaryAction(),
    onGoManage: () => navigate('/billing/manage'),
    onGoCrm: () => navigate(crmPath),
    canRunTestCharge,
    qaTestCode,
    onQaTestCodeChange: setQaTestCode,
    onTestCharge: () => void onTestCharge(),
    variant: isMobile ? 'mobile' : 'pc',
    crmPath,
  }
}
