import { formatBillingDotDate, formatBillingKoreanDate, formatKrw } from '../../billingManageViewUtils'
import type { BillingCheckoutViewProps } from './billingCheckoutViewProps'

function formatDateLabel(iso: string | null | undefined) {
  if (!iso) return '—'
  return formatBillingKoreanDate(iso)
}

export function CheckoutStatusBanner({ props }: { props: BillingCheckoutViewProps }) {
  const { checkoutMode, summary } = props
  if (checkoutMode === 'trialing') {
    return (
      <div className="insurance-billing-banner">
        현재 무료 이용 중입니다.
        <br />
        무료 종료일: {formatDateLabel(summary?.trialEndsAt)}
        <br />
        종료 후 계속 이용하려면 결제수단 등록이 필요합니다.
      </div>
    )
  }
  if (checkoutMode === 'active_paid') {
    return (
      <div className="insurance-billing-notice">
        유료 이용 중입니다. 요금제·자동결제·해지는 구독 관리에서 확인할 수 있습니다.
        {summary?.nextBillingAt || summary?.currentPeriodEnd ? (
          <>
            <br />
            다음 자동결제일: {formatDateLabel(summary.nextBillingAt ?? summary.currentPeriodEnd)}
          </>
        ) : null}
      </div>
    )
  }
  if (checkoutMode === 'legacy_entitled') {
    return (
      <div className="insurance-billing-notice insurance-billing-notice--muted">
        기존 이용자 활성 상태입니다. 필요 시 결제수단을 등록할 수 있습니다.
      </div>
    )
  }
  if (checkoutMode === 'payment_required') {
    return (
      <div className="insurance-billing-banner">
        {summary?.subscriptionStatus === 'expired'
          ? '무료 이용 기간이 종료되었습니다. 서비스를 계속 이용하려면 결제를 완료해 주세요.'
          : '서비스 이용을 위해 결제가 필요합니다.'}
      </div>
    )
  }
  return (
    <div className="insurance-billing-banner">서비스 이용을 위해 결제를 진행해 주세요.</div>
  )
}

export function CheckoutPlanSection({ props }: { props: BillingCheckoutViewProps }) {
  const { summary, billingCycle, onSelectCycle, isActiveEntitled } = props
  const plan = summary?.plan
  const monthlyTotal = plan?.monthlyTotal ?? 8800
  const yearlyTotal = plan?.yearlyTotal ?? 88000
  const yearlyMonthly = Math.round(yearlyTotal / 12)

  if (isActiveEntitled) {
    return (
      <section className="insurance-billing-card">
        <h2>현재 요금제</h2>
        <p className="insurance-billing-plan-price">
          {summary?.billingCycle === 'yearly' ? '연간' : '월간'} 이용 중
        </p>
        <p className="insurance-billing-plan-note">구독 변경은 구독 관리에서 할 수 있습니다.</p>
      </section>
    )
  }

  return (
    <section className="insurance-billing-card">
      <h2>① 요금제 선택</h2>
      <div className="insurance-billing-plan-cards">
        <button
          type="button"
          className={`insurance-billing-plan-card ${billingCycle === 'monthly' ? 'is-active' : ''}`}
          onClick={() => onSelectCycle('monthly')}
        >
          <span className="insurance-billing-plan-card__label">월간</span>
          <strong>{formatKrw(monthlyTotal)} / 월</strong>
          <span className="insurance-billing-plan-card__note">VAT 포함</span>
        </button>
        <button
          type="button"
          className={`insurance-billing-plan-card ${billingCycle === 'yearly' ? 'is-active' : ''}`}
          onClick={() => onSelectCycle('yearly')}
        >
          <span className="insurance-billing-plan-card__label">연간</span>
          <strong>{formatKrw(yearlyTotal)} / 년</strong>
          <span className="insurance-billing-plan-card__note">
            VAT 포함 · 월 환산 약 {formatKrw(yearlyMonthly)}
          </span>
        </button>
      </div>
    </section>
  )
}

export function CheckoutCouponSection({ props }: { props: BillingCheckoutViewProps }) {
  const {
    promoAllowed,
    promoCode,
    onPromoCodeChange,
    onApplyPromo,
    onClearPromo,
    promoMessage,
    quote,
    submitting,
  } = props
  if (!promoAllowed) {
    return (
      <section className="insurance-billing-card">
        <h2>② 쿠폰 및 할인</h2>
        <p className="insurance-billing-plan-note">현재 상태에서는 쿠폰을 적용할 수 없습니다.</p>
      </section>
    )
  }

  const applied = quote?.valid && quote.coupon

  return (
    <section className="insurance-billing-card">
      <h2>② 쿠폰 및 할인</h2>
      {applied ? (
        <div className="insurance-billing-coupon-applied">
          <p>
            ✓ {quote.coupon?.message || quote.coupon?.code}
            {quote.discountAmount > 0 ? (
              <>
                <br />
                할인금액 −{formatKrw(quote.discountAmount)}
              </>
            ) : null}
          </p>
          <button
            type="button"
            className="insurance-billing-cta insurance-billing-cta--secondary"
            disabled={submitting}
            onClick={onClearPromo}
          >
            적용 취소
          </button>
        </div>
      ) : (
        <>
          <div className="insurance-billing-coupon-row">
            <input
              id="billing-promo-code"
              value={promoCode}
              onChange={(e) => onPromoCodeChange(e.target.value)}
              placeholder="쿠폰 코드를 입력하세요"
              autoComplete="off"
            />
            <button
              type="button"
              className="insurance-billing-cta insurance-billing-cta--secondary"
              disabled={submitting || !promoCode.trim()}
              onClick={onApplyPromo}
            >
              적용
            </button>
          </div>
          <p className="insurance-billing-plan-note">쿠폰이 있다면 입력해 주세요.</p>
        </>
      )}
      {promoMessage ? <p className="insurance-billing-notice">{promoMessage}</p> : null}
    </section>
  )
}

export function CheckoutPaymentMethodSection({ props }: { props: BillingCheckoutViewProps }) {
  const { canUseToss, hasBillingKey, checkoutConfig, onRegisterCard, submitting, isActiveEntitled } = props
  const cardLabel = hasBillingKey
    ? [checkoutConfig?.cardCompany, checkoutConfig?.cardNumberMasked].filter(Boolean).join(' ') || '등록됨'
    : '등록된 결제수단이 없습니다.'

  return (
    <section className="insurance-billing-card">
      <h2>③ 결제수단</h2>
      <dl className="insurance-billing-manage-meta">
        <div className="insurance-billing-manage-meta__row">
          <dt>등록 카드</dt>
          <dd>{canUseToss ? cardLabel : '—'}</dd>
        </div>
      </dl>
      {canUseToss ? (
        <button
          type="button"
          className="insurance-billing-cta insurance-billing-cta--secondary"
          disabled={submitting}
          onClick={onRegisterCard}
        >
          {hasBillingKey ? '변경' : '카드 등록하기'}
        </button>
      ) : null}
      {!hasBillingKey && !isActiveEntitled ? (
        <p className="insurance-billing-plan-note">카드 등록 후 최종 금액을 확인하고 결제합니다.</p>
      ) : null}
    </section>
  )
}

export function CheckoutSummaryPanel({ props }: { props: BillingCheckoutViewProps }) {
  const {
    quote,
    quoteLoading,
    billingCycle,
    summary,
    ctaLabel,
    ctaDisabled,
    onPrimaryAction,
    submitting,
    isActiveEntitled,
    onGoManage,
    onGoCrm,
    canRunTestCharge,
    qaTestCode,
    onQaTestCodeChange,
    onTestCharge,
  } = props

  if (isActiveEntitled) {
    return (
      <section className="insurance-billing-card insurance-billing-checkout-summary">
        <h2>구독 관리</h2>
        <p className="insurance-billing-plan-note">이미 유료 이용 중입니다.</p>
        <button type="button" className="insurance-billing-cta" onClick={onGoManage}>
          구독 관리
        </button>
        <button type="button" className="insurance-billing-cta insurance-billing-cta--secondary" onClick={onGoCrm}>
          CRM으로 이동
        </button>
      </section>
    )
  }

  const base = quote?.baseAmount ?? (billingCycle === 'yearly' ? summary?.plan?.yearlyTotal ?? 88000 : summary?.plan?.monthlyTotal ?? 8800)
  const discount = quote?.discountAmount ?? 0
  const today = quote?.todayChargeAmount ?? base
  const next = quote?.nextChargeAmount ?? base

  return (
    <section className="insurance-billing-card insurance-billing-checkout-summary">
      <h2>④ 결제금액</h2>
      {quoteLoading ? <p className="insurance-billing-plan-note">금액 계산 중...</p> : null}
      <div className="insurance-billing-summary-row">
        <span>{billingCycle === 'yearly' ? '연간 이용권' : '월간 이용권'}</span>
        <span>{formatKrw(base)}</span>
      </div>
      <div className="insurance-billing-summary-row">
        <span>쿠폰 할인</span>
        <span>{discount > 0 ? `−${formatKrw(discount)}` : formatKrw(0)}</span>
      </div>
      <div className="insurance-billing-summary-row insurance-billing-summary-row--total">
        <span>오늘 결제금액</span>
        <span>{formatKrw(today)}</span>
      </div>
      <div className="insurance-billing-checkout-next">
        <div className="insurance-billing-summary-row">
          <span>다음 자동결제일</span>
          <span>{formatBillingDotDate(quote?.nextBillingAt)}</span>
        </div>
        <div className="insurance-billing-summary-row">
          <span>다음 자동결제금액</span>
          <span>{formatKrw(next)}</span>
        </div>
      </div>
      {quote?.summaryMessage ? (
        <p className="insurance-billing-plan-note insurance-billing-checkout-auto-note">{quote.summaryMessage}</p>
      ) : null}

      {canRunTestCharge ? (
        <div className="insurance-billing-test-qa-section">
          <p className="insurance-billing-test-qa-section__title">[TEST] Toss 결제 QA</p>
          <input
            value={qaTestCode}
            onChange={(e) => onQaTestCodeChange(e.target.value)}
            placeholder="빈 값이면 정상 결제"
          />
          <button type="button" className="insurance-billing-cta insurance-billing-cta--test" disabled={submitting} onClick={onTestCharge}>
            TEST 결제 실행
          </button>
        </div>
      ) : null}

      <button
        type="button"
        className="insurance-billing-cta"
        disabled={ctaDisabled}
        onClick={onPrimaryAction}
      >
        {submitting ? '처리 중...' : ctaLabel}
      </button>
    </section>
  )
}
