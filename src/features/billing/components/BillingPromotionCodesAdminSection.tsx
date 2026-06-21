import { useCallback, useEffect, useState } from 'react'
import { FieldWrapper, FormButton, FormSelect } from '../../../components/form'
import { StatusMessage } from '../../../components/feedback'
import { ConfirmDialog } from '../../../components/dialog/ConfirmDialog'
import {
  activateAdminBillingPromotionCode,
  deactivateAdminBillingPromotionCode,
  deleteAdminBillingPromotionCode,
  fetchAdminBillingPromotionCodes,
  type BillingPromotionCodeAdminRow,
  type BillingPromotionListFilter,
} from '../../insurance-billing/api/insuranceBillingAdminApi'

const FILTER_OPTIONS: { value: BillingPromotionListFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'active', label: '활성' },
  { value: 'inactive', label: '비활성' },
  { value: 'deleted', label: '삭제됨' },
]

type Props = {
  token: string
  busy: boolean
  setBusy: (busy: boolean) => void
  onInfo: (message: string) => void
  onError: (message: string) => void
}

function statusLabel(row: BillingPromotionCodeAdminRow) {
  if (row.deletedAt) return '삭제됨'
  return row.isActive ? '활성' : '비활성'
}

export default function BillingPromotionCodesAdminSection({ token, busy, setBusy, onInfo, onError }: Props) {
  const [filter, setFilter] = useState<BillingPromotionListFilter>('all')
  const [rows, setRows] = useState<BillingPromotionCodeAdminRow[]>([])
  const [loadError, setLoadError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<BillingPromotionCodeAdminRow | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  const load = useCallback(async () => {
    if (!token.trim()) return
    setLoadError('')
    try {
      const data = await fetchAdminBillingPromotionCodes(token, filter)
      setRows(data.rows)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'CRM 무료 코드 목록을 불러오지 못했습니다.')
    }
  }, [token, filter])

  useEffect(() => {
    void load()
  }, [load])

  const onActivate = async (row: BillingPromotionCodeAdminRow) => {
    setBusy(true)
    onError('')
    try {
      await activateAdminBillingPromotionCode(token, row.id)
      onInfo(`${row.code} 코드를 활성화했습니다.`)
      await load()
    } catch (e) {
      onError(e instanceof Error ? e.message : '활성화에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const onDeactivate = async (row: BillingPromotionCodeAdminRow) => {
    setBusy(true)
    onError('')
    try {
      await deactivateAdminBillingPromotionCode(token, row.id)
      onInfo(`${row.code} 코드를 비활성화했습니다.`)
      await load()
    } catch (e) {
      onError(e instanceof Error ? e.message : '비활성화에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const onConfirmDelete = async () => {
    if (!deleteTarget) return
    setDeleteBusy(true)
    setBusy(true)
    onError('')
    try {
      await deleteAdminBillingPromotionCode(token, deleteTarget.id)
      onInfo(`${deleteTarget.code} 코드를 삭제했습니다.`)
      setDeleteTarget(null)
      await load()
    } catch (e) {
      onError(e instanceof Error ? e.message : '삭제에 실패했습니다.')
    } finally {
      setDeleteBusy(false)
      setBusy(false)
    }
  }

  return (
    <div className="promotion-code-panel">
      <section className="card auth-card billing-page__card promotion-code-card">
        <div className="promotion-code-card-header billing-page__section-head">
          <h2 className="billing-page__section-title">보험 CRM 무료 코드</h2>
        </div>
        <p className="billing-page__invoice-sub billing-page__invoice-sub--muted">
          결제단(billing_promotion_codes) 무료 이용권 코드입니다. 삭제는 soft delete이며 사용 이력은 보존됩니다.
        </p>

        <FieldWrapper label="목록 필터">
          <FormSelect
            value={filter}
            options={FILTER_OPTIONS}
            onChange={(e) => setFilter(e.target.value as BillingPromotionListFilter)}
          />
        </FieldWrapper>

        {loadError ? <StatusMessage tone="error" message={loadError} /> : null}

        {rows.length === 0 ? (
          <p className="status text-sm">표시할 코드가 없습니다.</p>
        ) : (
          <ul className="billing-page__invoice-list">
            {rows.map((row) => (
              <li key={row.id} className="billing-page__invoice-item">
                <div className="billing-page__invoice-head">
                  <strong>
                    {row.code} · {row.name}
                  </strong>
                  <span>{statusLabel(row)}</span>
                </div>
                <p className="billing-page__invoice-sub">
                  {row.type === 'free_months' && row.freeMonths != null
                    ? `${row.freeMonths}개월 무료`
                    : row.type}
                  {' · '}
                  사용 {row.usedCount}
                  {row.maxRedemptions != null ? ` / ${row.maxRedemptions}` : ''}
                </p>
                {!row.deletedAt ? (
                  <div className="billing-page__actions">
                    {row.isActive ? (
                      <FormButton
                        htmlType="button"
                        variant="secondary"
                        disabled={busy}
                        onClick={() => void onDeactivate(row)}
                      >
                        비활성화
                      </FormButton>
                    ) : (
                      <FormButton
                        htmlType="button"
                        variant="secondary"
                        disabled={busy}
                        onClick={() => void onActivate(row)}
                      >
                        활성화
                      </FormButton>
                    )}
                    <FormButton
                      htmlType="button"
                      variant="danger"
                      disabled={busy}
                      onClick={() => setDeleteTarget(row)}
                    >
                      삭제
                    </FormButton>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="프로모션 코드 삭제"
        message={
          deleteTarget
            ? `이 프로모션 코드를 삭제하시겠습니까?\n\n코드: ${deleteTarget.code}\n\n삭제 후에는 사용자가 이 코드를 적용할 수 없습니다.\n기존 사용 이력은 보존됩니다.`
            : ''
        }
        confirmLabel="삭제하기"
        cancelLabel="취소"
        tone="danger"
        busy={deleteBusy}
        onCancel={() => {
          if (deleteBusy) return
          setDeleteTarget(null)
        }}
        onConfirm={() => void onConfirmDelete()}
      />
    </div>
  )
}
