import { Link } from 'react-router-dom'
import type { BillingManagePayment, BillingManageSubscription } from '../billingManageViewUtils'
import {
  formatBillingCycleLabel,
  formatBillingDotDate,
  formatBillingKoreanDate,
  formatChargePriceBreakdown,
  formatKrw,
  resolveAutoRenewLabel,
  resolveManageCheckoutCtaLabel,
  resolveNextBillingDate,
  resolveNextChargePreview,
  resolvePaymentStatusLabel,
  resolvePaymentStatusTone,
  resolvePlanDisplayName,
  resolveSubscriptionStatusLabel,
  resolveSubscriptionStatusTone,
  resolveUsagePeriod,
} from '../billingManageViewUtils'
import type { BillingCheckoutConfig, CheckoutSummary } from '../api/insuranceBillingApi'

type Props = {
  summary: CheckoutSummary | null | undefined
  subscription: BillingManageSubscription | null | undefined
  payments: BillingManagePayment[]
  showCheckoutLink?: boolean
  checkoutConfig?: BillingCheckoutConfig | null
  onRegisterMethod?: () => void
  registeringMethod?: boolean
  onChangeCycle?: (cycle: 'monthly' | 'yearly') => void
  onClearPendingCycle?: () => void
  onCancelAutoRenew?: () => void
  onResumeAutoRenew?: () => void
  actionBusy?: boolean
}

function StatusBadge({ label, tone }: { label: string; tone: string }) {
  return <span className={`insurance-billing-status-badge insurance-billing-status-badge--${tone}`}>{label}</span>
}

export default function InsuranceBillingManagePanel({
  summary,
  subscription,
  payments,
  showCheckoutLink = true,
  checkoutConfig = null,
  onRegisterMethod,
  registeringMethod = false,
  onChangeCycle,
  onClearPendingCycle,
  onCancelAutoRenew,
  onResumeAutoRenew,
  actionBusy = false,
}: Props) {
  const status = subscription?.status ?? summary?.status ?? summary?.subscriptionStatus ?? 'pending_payment'
  const statusLabel = resolveSubscriptionStatusLabel(status)
  const statusTone = resolveSubscriptionStatusTone(status)
  const planName = resolvePlanDisplayName(subscription, summary)
  const usagePeriod = resolveUsagePeriod(subscription, summary)
  const nextBillingDate = resolveNextBillingDate(subscription, summary)
  const checkoutCtaLabel = resolveManageCheckoutCtaLabel(status)
  const isActivePaid = String(status).toLowerCase() === 'active_paid'
  const billingCycle = subscription?.billingCycle ?? 'monthly'
  const pendingCycle = subscription?.pendingBillingCycle ?? null
  const autoRenewStatus = subscription?.autoRenewStatus ?? 'INACTIVE'
  const cancelAt = subscription?.cancelAt ?? null

  const canUseToss =
    checkoutConfig?.provider === 'toss' &&
    Boolean(checkoutConfig.enabled) &&
    Boolean(checkoutConfig.clientKey) &&
    Boolean(checkoutConfig.customerKey)
  const hasBillingKey = Boolean(checkoutConfig?.hasBillingKey ?? subscription?.hasBillingCredential)
  const cardLabel =
    hasBillingKey
      ? [checkoutConfig?.cardCompany, checkoutConfig?.cardNumberMasked].filter(Boolean).join(' ') || '등록됨'
      : '미등록'

  const nextChargeCycle = subscription?.nextChargeBillingCycle ?? pendingCycle ?? billingCycle
  const nextChargeTotal = subscription?.nextChargeAmount ?? null
  const plan = summary?.plan
  const fallbackTotal =
    nextChargeCycle === 'yearly' ? (plan?.yearlyTotal ?? 88000) : (plan?.monthlyTotal ?? 8800)
  const fallbackSupply =
    nextChargeCycle === 'yearly' ? (plan?.yearlyPrice ?? 80000) : (plan?.monthlyPrice ?? 8000)
  const fallbackVat =
    nextChargeCycle === 'yearly' ? (plan?.yearlyVat ?? 8000) : (plan?.monthlyVat ?? 800)
  const chargeBreakdown =
    autoRenewStatus === 'AUTO_RENEW_ACTIVE' || pendingCycle
      ? formatChargePriceBreakdown({
          total: nextChargeTotal ?? fallbackTotal,
          supply: subscription?.nextChargeSupplyAmount ?? fallbackSupply,
          vat: subscription?.nextChargeVatAmount ?? fallbackVat,
          cycle: nextChargeCycle,
        })
      : null
  const cancelScheduledEndDate = cancelAt ?? subscription?.currentPeriodEnd ?? null
  const resumeChargePreview =
    autoRenewStatus === 'CANCEL_SCHEDULED'
      ? resolveNextChargePreview(subscription, summary)
      : null

  const oppositeCycle = billingCycle === 'yearly' ? 'monthly' : 'yearly'
  const showChangeCycle =
    isActivePaid && autoRenewStatus === 'AUTO_RENEW_ACTIVE' && !pendingCycle && Boolean(onChangeCycle)
  const showClearPending = isActivePaid && Boolean(pendingCycle) && Boolean(onClearPendingCycle)
  const showCancel = isActivePaid && autoRenewStatus === 'AUTO_RENEW_ACTIVE' && Boolean(onCancelAutoRenew)
  const showResume = isActivePaid && autoRenewStatus === 'CANCEL_SCHEDULED' && Boolean(onResumeAutoRenew)

  return (
    <>
      <section className="insurance-billing-card insurance-billing-manage-card">
        <h2>현재 구독</h2>
        <dl className="insurance-billing-manage-meta">
          <div className="insurance-billing-manage-meta__row">
            <dt>상태</dt>
            <dd>
              <StatusBadge label={statusLabel} tone={statusTone} />
            </dd>
          </div>
          <div className="insurance-billing-manage-meta__row">
            <dt>현재 요금제</dt>
            <dd>
              {formatBillingCycleLabel(billingCycle)}
              <span className="insurance-billing-manage-meta__muted"> · {planName}</span>
            </dd>
          </div>
          {pendingCycle ? (
            <div className="insurance-billing-manage-meta__row">
              <dt>변경 예정</dt>
              <dd>
                {formatBillingCycleLabel(pendingCycle)}
                <span className="insurance-billing-manage-meta__muted">
                  {' '}
                  · 적용일 {formatBillingDotDate(nextBillingDate)}
                </span>
              </dd>
            </div>
          ) : null}
          <div className="insurance-billing-manage-meta__row">
            <dt>이용기간</dt>
            <dd>{usagePeriod}</dd>
          </div>
          <div className="insurance-billing-manage-meta__row">
            <dt>자동결제</dt>
            <dd>{resolveAutoRenewLabel(autoRenewStatus)}</dd>
          </div>
          {autoRenewStatus === 'CANCEL_SCHEDULED' ? (
            <div className="insurance-billing-manage-meta__row">
              <dt>이용 종료일</dt>
              <dd>{formatBillingDotDate(cancelScheduledEndDate)}</dd>
            </div>
          ) : null}
          {autoRenewStatus === 'CANCEL_SCHEDULED' && resumeChargePreview ? (
            <>
              <div className="insurance-billing-manage-meta__row">
                <dt>다음 자동결제일</dt>
                <dd>{formatBillingDotDate(nextBillingDate)}</dd>
              </div>
              <div className="insurance-billing-manage-meta__row">
                <dt>다음 결제금액</dt>
                <dd>
                  <strong>{resumeChargePreview.totalLabel}</strong>
                  <span className="insurance-billing-manage-meta__muted">
                    {' '}
                    {resumeChargePreview.breakdownLabel}
                  </span>
                </dd>
              </div>
            </>
          ) : null}
          {autoRenewStatus === 'AUTO_RENEW_ACTIVE' || pendingCycle ? (
            <>
              <div className="insurance-billing-manage-meta__row">
                <dt>다음 자동결제일</dt>
                <dd>{formatBillingDotDate(nextBillingDate)}</dd>
              </div>
              {chargeBreakdown ? (
                <div className="insurance-billing-manage-meta__row">
                  <dt>다음 결제금액</dt>
                  <dd>
                    <strong>{chargeBreakdown.totalLabel}</strong>
                    <span className="insurance-billing-manage-meta__muted"> {chargeBreakdown.breakdownLabel}</span>
                  </dd>
                </div>
              ) : null}
            </>
          ) : null}
          {autoRenewStatus === 'AUTO_RENEW_ACTIVE' ? (
            <p className="insurance-billing-plan-note">
              다음 결제일에 등록된 카드로 자동결제됩니다.
            </p>
          ) : null}
          {autoRenewStatus === 'CANCEL_SCHEDULED' ? (
            <div className="insurance-billing-cancel-scheduled-notice">
              <p>현재 이용기간까지는 정상적으로 이용할 수 있습니다.</p>
              <p>이용 종료일 전까지 자동결제를 다시 시작할 수 있습니다.</p>
              <p className="insurance-billing-cancel-scheduled-notice__hint">
                해지 예약이 취소되면 {formatBillingKoreanDate(nextBillingDate)}부터{' '}
                {resumeChargePreview?.totalLabel ?? '정상 요금'}이 자동결제됩니다.
              </p>
            </div>
          ) : null}
        </dl>

        <div className="insurance-billing-manage-actions">
          {showChangeCycle ? (
            <button
              type="button"
              className="insurance-billing-cta insurance-billing-cta--primary"
              disabled={actionBusy}
              onClick={() => onChangeCycle?.(oppositeCycle)}
            >
              {oppositeCycle === 'yearly' ? '연간으로 변경' : '월간으로 변경'}
            </button>
          ) : null}
          {showClearPending ? (
            <button
              type="button"
              className="insurance-billing-cta insurance-billing-cta--secondary"
              disabled={actionBusy}
              onClick={() => onClearPendingCycle?.()}
            >
              요금제 변경 취소
            </button>
          ) : null}
          {showResume ? (
            <button
              type="button"
              className="insurance-billing-cta insurance-billing-cta--primary"
              disabled={actionBusy}
              onClick={() => onResumeAutoRenew?.()}
            >
              자동결제 다시 시작
            </button>
          ) : null}
        </div>
      </section>

      <section className="insurance-billing-card insurance-billing-manage-card">
        <h2>결제수단</h2>
        <dl className="insurance-billing-manage-meta">
          <div className="insurance-billing-manage-meta__row">
            <dt>등록 카드</dt>
            <dd>{canUseToss ? cardLabel : '—'}</dd>
          </div>
        </dl>
        {canUseToss && onRegisterMethod ? (
          <button
            type="button"
            className="insurance-billing-cta insurance-billing-cta--secondary"
            disabled={registeringMethod || actionBusy}
            onClick={onRegisterMethod}
          >
            {hasBillingKey ? '결제수단 변경' : '결제수단 등록'}
          </button>
        ) : null}
        {showCheckoutLink && !isActivePaid ? (
          <Link to="/billing/checkout" className="insurance-billing-cta insurance-billing-cta--primary">
            {checkoutCtaLabel}
          </Link>
        ) : null}
      </section>

      {isActivePaid && showCancel ? (
        <section className="insurance-billing-card insurance-billing-manage-card">
          <h2>구독 관리</h2>
          <button
            type="button"
            className="insurance-billing-cta insurance-billing-cta--quiet"
            disabled={actionBusy}
            onClick={() => onCancelAutoRenew?.()}
          >
            자동결제 해지
          </button>
        </section>
      ) : null}

      <section className="insurance-billing-card insurance-billing-manage-card">
        <h2>결제 내역</h2>
        {payments.length === 0 ? (
          <p className="insurance-billing-plan-note">결제 내역이 없습니다.</p>
        ) : (
          <ul className="insurance-billing-payment-list">
            {payments.map((payment) => {
              const paymentLabel = resolvePaymentStatusLabel(payment.status)
              const paymentTone = resolvePaymentStatusTone(payment.status)
              const paidOrCreated = payment.paidAt ?? payment.createdAt
              return (
                <li key={payment.id} className="insurance-billing-payment-item">
                  <div className="insurance-billing-payment-item__head">
                    <strong>{formatKrw(payment.totalAmount)}</strong>
                    <StatusBadge label={paymentLabel} tone={paymentTone} />
                  </div>
                  <p className="insurance-billing-payment-item__sub">
                    {formatBillingDotDate(paidOrCreated)} · {payment.planName || planName} ·{' '}
                    {formatBillingCycleLabel(payment.billingCycle)}
                  </p>
                  <p className="insurance-billing-payment-item__muted">
                    공급가 {formatKrw(payment.amount)} · 부가세 {formatKrw(payment.vatAmount)}
                  </p>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </>
  )
}
