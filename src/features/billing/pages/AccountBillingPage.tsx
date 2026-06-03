import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FormButton } from '../../../components/form'
import { StatusMessage } from '../../../components/feedback'
import { useAuth } from '../../auth/AuthProvider'
import {
  BILLING_STATUS_LABEL,
  createBillingInvoice,
  fetchBillingInvoices,
  fetchBillingMe,
  formatBillingDate,
  formatWon,
  INVOICE_STATUS_LABEL,
  mockPayBillingInvoice,
  type BillingInvoice,
  type BillingMeResponse,
} from '../api/billingApi'
import { BILLING_PLANS, formatPricingBreakdown } from '../pricingPolicy'

export default function AccountBillingPage() {
  const { token } = useAuth()
  const [me, setMe] = useState<BillingMeResponse | null>(null)
  const [invoices, setInvoices] = useState<BillingInvoice[]>([])
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [actionInfo, setActionInfo] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!token?.trim()) return
    setLoadError('')
    try {
      const [billingMe, invoiceRes] = await Promise.all([fetchBillingMe(token), fetchBillingInvoices(token)])
      setMe(billingMe)
      setInvoices(invoiceRes.invoices)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : '결제 정보를 불러오지 못했습니다.')
    }
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  const onCreateInvoice = async () => {
    if (!token?.trim() || busy) return
    setBusy(true)
    setActionError('')
    setActionInfo('')
    try {
      const result = await createBillingInvoice(token)
      setActionInfo(
        `결제 요청이 생성되었습니다. 청구 금액 ${formatWon(result.invoice.finalAmount)} (VAT 포함 · 가상 결제 모드)`,
      )
      await load()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '결제 요청 생성에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const onMockPay = async (invoiceId: number) => {
    if (!token?.trim() || busy) return
    setBusy(true)
    setActionError('')
    setActionInfo('')
    try {
      await mockPayBillingInvoice(token, invoiceId)
      setActionInfo('가상 결제가 완료되었습니다.')
      await load()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '가상 결제 처리에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const pendingInvoice = invoices.find((row) => row.status === 'pending')
  const monthlyPriceNote =
    me?.standardPlan?.displayPriceWithVatNote ?? BILLING_PLANS.STANDARD_MONTHLY.displayPriceWithVatNote

  return (
    <main className="page page--with-back billing-page">
      <header className="page-header">
        <h1>결제 관리</h1>
        <p>월 이용료 구독 · 결제 내역</p>
        <p className="billing-page__price-note">{monthlyPriceNote}</p>
      </header>

      {me?.isVirtualMode ? (
        <section className="billing-page__notice" role="status">
          <strong>가상 결제 테스트 모드</strong>
          <p>실제 카드 승인 없이 결제 흐름을 검증합니다.</p>
        </section>
      ) : null}

      {loadError ? <StatusMessage tone="error" message={loadError} /> : null}

      {me ? (
        <section className="card auth-card billing-page__card">
          <h2 className="billing-page__section-title">현재 이용 상태</h2>
          <dl className="billing-page__meta">
            <dt>구독 상태</dt>
            <dd>{BILLING_STATUS_LABEL[me.subscriptionStatus] ?? me.subscriptionStatus}</dd>
            <dt>접근 플랜</dt>
            <dd>{me.accessPlan}</dd>
            <dt>이용기간</dt>
            <dd>
              {formatBillingDate(me.currentPeriodStart)} ~ {formatBillingDate(me.currentPeriodEnd)}
            </dd>
            <dt>다음 결제일</dt>
            <dd>{formatBillingDate(me.nextBillingAt)}</dd>
          </dl>
          <div className="billing-page__actions">
            <FormButton htmlType="button" variant="primary" disabled={busy || Boolean(pendingInvoice)} onClick={() => void onCreateInvoice()}>
              {pendingInvoice ? '결제 대기 중' : '결제 요청 생성'}
            </FormButton>
            {me.isVirtualMode && pendingInvoice ? (
              <FormButton
                htmlType="button"
                variant="secondary"
                disabled={busy}
                onClick={() => void onMockPay(pendingInvoice.id)}
              >
                가상 결제 완료 처리
              </FormButton>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="card auth-card billing-page__card">
        <h2 className="billing-page__section-title">결제 내역</h2>
        {invoices.length === 0 ? (
          <p className="status text-sm">결제 내역이 없습니다.</p>
        ) : (
          <ul className="billing-page__invoice-list">
            {invoices.map((row) => (
              <li key={row.id} className="billing-page__invoice-item">
                <div className="billing-page__invoice-head">
                  <strong>{formatWon(row.finalAmount)}</strong>
                  <span>{INVOICE_STATUS_LABEL[row.status] ?? row.status}</span>
                </div>
                <p className="billing-page__invoice-sub">
                  기본 {formatWon(row.baseAmount)} · 할인 {formatWon(row.discountAmount)} ·{' '}
                  {formatBillingDate(row.createdAt)}
                </p>
                {row.baseSupplyAmount != null && row.vatAmount != null ? (
                  <p className="billing-page__invoice-sub billing-page__invoice-sub--muted">
                    {formatPricingBreakdown({
                      supplyAmount: row.finalSupplyAmount ?? row.baseSupplyAmount,
                      vatAmount: row.vatAmount,
                      totalAmount: row.finalAmount,
                    })}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {me?.refundPolicyNotice?.length ? (
        <section className="card auth-card billing-page__card">
          <h2 className="billing-page__section-title">환불 안내</h2>
          <ul className="billing-page__policy-list">
            {me.refundPolicyNotice.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {actionInfo ? <StatusMessage message={actionInfo} /> : null}
      {actionError ? <StatusMessage tone="error" message={actionError} /> : null}

      <div className="switch-text">
        <Link to="/profile" className="switch-text__action">
          내 정보 관리로
        </Link>
      </div>
    </main>
  )
}
