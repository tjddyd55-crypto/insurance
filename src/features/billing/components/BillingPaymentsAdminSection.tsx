import { useCallback, useEffect, useState } from 'react'
import { FieldWrapper, FormSelect } from '../../../components/form'
import { StatusMessage } from '../../../components/feedback'
import { ConfirmDialog } from '../../../components/dialog/ConfirmDialog'
import Modal from '../../../components/ui/Modal'
import { AdminDataCard } from '../../admin/components/layout'
import {
  approveAdminBillingPayment,
  cancelAdminBillingPayment,
  fetchAdminBillingPaymentDetail,
  fetchAdminBillingPayments,
  type BillingPaymentAdminItem,
  type BillingPaymentStatusFilter,
} from '../../insurance-billing/api/insuranceBillingAdminApi'
import { formatBillingDate, formatWon } from '../api/billingApi'
import { formatPricingBreakdown } from '../pricingPolicy'

const STATUS_FILTER_OPTIONS: { value: BillingPaymentStatusFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'pending', label: '결제 대기' },
  { value: 'paid', label: '결제 완료' },
  { value: 'canceled', label: '취소됨' },
  { value: 'failed', label: '실패' },
]

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  pending: '결제 대기',
  paid: '결제 완료',
  canceled: '취소됨',
  failed: '실패',
}

const BILLING_CYCLE_LABEL: Record<string, string> = {
  monthly: '월간',
  yearly: '연간',
}

type Props = {
  token: string
  busy: boolean
  setBusy: (busy: boolean) => void
  onInfo: (message: string) => void
  onError: (message: string) => void
}

function PaymentStatusBadge({ status }: { status: string }) {
  const normalized = String(status ?? '').toLowerCase()
  const label = PAYMENT_STATUS_LABEL[normalized] ?? status
  return (
    <span className={`billing-payments-admin-status billing-payments-admin-status--${normalized}`}>{label}</span>
  )
}

function PaymentDetailBody({ item }: { item: BillingPaymentAdminItem }) {
  return (
    <dl className="billing-page__meta">
      <dt>요청일</dt>
      <dd>{formatBillingDate(item.createdAt)}</dd>
      <dt>사용자</dt>
      <dd>
        {item.userName} ({item.username})
      </dd>
      <dt>소속 GA</dt>
      <dd>{item.tenantName ?? '—'}</dd>
      <dt>요금제</dt>
      <dd>{item.planName}</dd>
      <dt>결제주기</dt>
      <dd>{BILLING_CYCLE_LABEL[item.billingCycle] ?? item.billingCycle}</dd>
      <dt>금액</dt>
      <dd>
        {formatPricingBreakdown({
          supplyAmount: item.amount,
          vatAmount: item.vatAmount,
          totalAmount: item.totalAmount,
        })}
      </dd>
      <dt>상태</dt>
      <dd>
        <PaymentStatusBadge status={item.status} />
      </dd>
      <dt>프로모션 코드</dt>
      <dd>{item.promotionCode ?? '—'}</dd>
      <dt>추천인 코드</dt>
      <dd>{item.referralCode ?? '—'}</dd>
      {item.paidAt ? (
        <>
          <dt>결제 완료일</dt>
          <dd>{formatBillingDate(item.paidAt)}</dd>
        </>
      ) : null}
      {item.canceledAt ? (
        <>
          <dt>취소일</dt>
          <dd>{formatBillingDate(item.canceledAt)}</dd>
        </>
      ) : null}
      {item.cancelReason ? (
        <>
          <dt>취소 사유</dt>
          <dd>{item.cancelReason}</dd>
        </>
      ) : null}
    </dl>
  )
}

export default function BillingPaymentsAdminSection({ token, busy, setBusy, onInfo, onError }: Props) {
  const [statusFilter, setStatusFilter] = useState<BillingPaymentStatusFilter>('pending')
  const [items, setItems] = useState<BillingPaymentAdminItem[]>([])
  const [loadError, setLoadError] = useState('')
  const [detailItem, setDetailItem] = useState<BillingPaymentAdminItem | null>(null)
  const [approveTarget, setApproveTarget] = useState<BillingPaymentAdminItem | null>(null)
  const [cancelTarget, setCancelTarget] = useState<BillingPaymentAdminItem | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)

  const load = useCallback(async () => {
    if (!token.trim()) return
    setLoadError('')
    try {
      const data = await fetchAdminBillingPayments(token, { status: statusFilter, limit: 50 })
      setItems(data.items)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : '결제 요청 목록을 불러오지 못했습니다.')
    }
  }, [token, statusFilter])

  useEffect(() => {
    void load()
  }, [load])

  const openDetail = async (row: BillingPaymentAdminItem) => {
    if (!token.trim() || busy) return
    setBusy(true)
    try {
      const data = await fetchAdminBillingPaymentDetail(token, row.paymentId)
      setDetailItem(data.item)
    } catch (e) {
      onError(e instanceof Error ? e.message : '상세 정보를 불러오지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const onConfirmApprove = async () => {
    if (!token.trim() || !approveTarget || confirmBusy) return
    setConfirmBusy(true)
    try {
      await approveAdminBillingPayment(token, approveTarget.paymentId)
      onInfo('결제 요청을 승인했습니다.')
      setApproveTarget(null)
      await load()
    } catch (e) {
      onError(e instanceof Error ? e.message : '승인 처리에 실패했습니다.')
    } finally {
      setConfirmBusy(false)
    }
  }

  const onConfirmCancel = async () => {
    if (!token.trim() || !cancelTarget || confirmBusy) return
    setConfirmBusy(true)
    try {
      await cancelAdminBillingPayment(token, cancelTarget.paymentId)
      onInfo('결제 요청을 취소했습니다.')
      setCancelTarget(null)
      await load()
    } catch (e) {
      onError(e instanceof Error ? e.message : '취소 처리에 실패했습니다.')
    } finally {
      setConfirmBusy(false)
    }
  }

  return (
    <div className="billing-payments-admin-section">
      <AdminDataCard
        title="결제 요청/청구 내역"
        actions={
          <FieldWrapper label="상태 필터" className="billing-payments-admin-section__filter">
            <FormSelect
              value={statusFilter}
              options={STATUS_FILTER_OPTIONS}
              onChange={(e) => setStatusFilter(e.target.value as BillingPaymentStatusFilter)}
            />
          </FieldWrapper>
        }
      >
        {loadError ? <StatusMessage tone="error" message={loadError} /> : null}

        {items.length === 0 ? (
          <p className="billing-payments-admin-section__empty">표시할 결제 내역이 없습니다.</p>
        ) : (
          <div className="admin-data-table-wrap">
            <table className="admin-data-table">
              <thead>
                <tr>
                  <th>요청일</th>
                  <th>사용자명</th>
                  <th>아이디</th>
                  <th>소속 GA</th>
                  <th>요금제</th>
                  <th>결제주기</th>
                  <th>결제금액</th>
                  <th>상태</th>
                  <th className="admin-table-cell--actions">액션</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.paymentId}>
                    <td>{formatBillingDate(row.createdAt)}</td>
                    <td>{row.userName}</td>
                    <td>{row.username}</td>
                    <td>{row.tenantName ?? '—'}</td>
                    <td>{row.planName}</td>
                    <td>{BILLING_CYCLE_LABEL[row.billingCycle] ?? row.billingCycle}</td>
                    <td>
                      <strong className="billing-payments-admin-section__amount">{formatWon(row.totalAmount)}</strong>
                      <span className="billing-payments-admin-section__amount-sub">
                        공급가 {formatWon(row.amount)} · VAT {formatWon(row.vatAmount)}
                      </span>
                    </td>
                    <td>
                      <PaymentStatusBadge status={row.status} />
                    </td>
                    <td className="admin-table-cell--actions">
                      <div className="admin-table-actions billing-payments-admin-section__actions">
                        {row.status === 'pending' ? (
                          <>
                            <button
                              type="button"
                              className="billing-payments-admin-btn billing-payments-admin-btn--approve"
                              disabled={busy}
                              onClick={() => setApproveTarget(row)}
                            >
                              승인
                            </button>
                            <button
                              type="button"
                              className="billing-payments-admin-btn billing-payments-admin-btn--cancel"
                              disabled={busy}
                              onClick={() => setCancelTarget(row)}
                            >
                              취소
                            </button>
                          </>
                        ) : null}
                        <button
                          type="button"
                          className="billing-payments-admin-btn billing-payments-admin-btn--detail"
                          disabled={busy}
                          onClick={() => void openDetail(row)}
                        >
                          상세
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminDataCard>

      <Modal
        open={Boolean(detailItem)}
        ariaLabel="결제 요청 상세"
        panelClassName="max-w-2xl"
        onClose={() => {
          if (busy) return
          setDetailItem(null)
        }}
      >
        {detailItem ? (
          <>
            <h2 className="billing-page__section-title">결제 요청 상세</h2>
            <PaymentDetailBody item={detailItem} />
          </>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(approveTarget)}
        title="결제 요청 승인"
        message="이 결제 요청을 승인하시겠습니까? 승인하면 사용자의 구독 상태가 유료 이용 중으로 변경됩니다."
        confirmLabel="승인"
        busy={confirmBusy}
        onConfirm={() => void onConfirmApprove()}
        onCancel={() => {
          if (confirmBusy) return
          setApproveTarget(null)
        }}
      />

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        title="결제 요청 취소"
        message="이 결제 요청을 취소하시겠습니까? 취소 후 사용자는 다시 결제 요청을 생성할 수 있습니다."
        confirmLabel="취소"
        tone="danger"
        busy={confirmBusy}
        onConfirm={() => void onConfirmCancel()}
        onCancel={() => {
          if (confirmBusy) return
          setCancelTarget(null)
        }}
      />
    </div>
  )
}
