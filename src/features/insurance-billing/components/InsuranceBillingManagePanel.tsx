import { Link } from 'react-router-dom'
import type { BillingManagePayment, BillingManageSubscription } from '../billingManageViewUtils'
import {
  formatBillingCycleLabel,
  formatBillingDotDate,
  formatKrw,
  resolveNextBillingDate,
  resolvePaymentStatusLabel,
  resolvePaymentStatusTone,
  resolvePlanDisplayName,
  resolveSubscriptionStatusLabel,
  resolveSubscriptionStatusTone,
  resolveUsagePeriod,
} from '../billingManageViewUtils'
import type { CheckoutSummary } from '../api/insuranceBillingApi'

type Props = {
  summary: CheckoutSummary | null | undefined
  subscription: BillingManageSubscription | null | undefined
  payments: BillingManagePayment[]
  showCheckoutLink?: boolean
}

function StatusBadge({ label, tone }: { label: string; tone: string }) {
  return <span className={`insurance-billing-status-badge insurance-billing-status-badge--${tone}`}>{label}</span>
}

export default function InsuranceBillingManagePanel({
  summary,
  subscription,
  payments,
  showCheckoutLink = true,
}: Props) {
  const status = subscription?.status ?? summary?.status ?? summary?.subscriptionStatus ?? 'pending_payment'
  const statusLabel = resolveSubscriptionStatusLabel(status)
  const statusTone = resolveSubscriptionStatusTone(status)
  const planName = resolvePlanDisplayName(subscription, summary)
  const usagePeriod = resolveUsagePeriod(subscription, summary)
  const nextBillingDate = resolveNextBillingDate(subscription, summary)

  return (
    <>
      <section className="insurance-billing-card insurance-billing-manage-card">
        <h2>현재 이용 상태</h2>
        <dl className="insurance-billing-manage-meta">
          <div className="insurance-billing-manage-meta__row">
            <dt>현재 상태</dt>
            <dd>
              <StatusBadge label={statusLabel} tone={statusTone} />
            </dd>
          </div>
          <div className="insurance-billing-manage-meta__row">
            <dt>요금제</dt>
            <dd>{planName}</dd>
          </div>
          <div className="insurance-billing-manage-meta__row">
            <dt>이용기간</dt>
            <dd>{usagePeriod}</dd>
          </div>
          <div className="insurance-billing-manage-meta__row">
            <dt>다음 결제일</dt>
            <dd>{formatBillingDotDate(nextBillingDate)}</dd>
          </div>
        </dl>
        {showCheckoutLink ? (
          <Link to="/billing/checkout" className="insurance-billing-cta insurance-billing-cta--secondary">
            결제/요금제 변경
          </Link>
        ) : null}
      </section>

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
