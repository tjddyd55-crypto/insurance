import { useCallback, useEffect, useState } from 'react'
import { FieldWrapper, FormButton, FormSelect } from '../../../components/form'
import { StatusMessage } from '../../../components/feedback'
import { ConfirmDialog } from '../../../components/dialog/ConfirmDialog'
import {
  activateAdminBillingPromotionCode,
  createAdminBillingPromotionCode,
  deactivateAdminBillingPromotionCode,
  deleteAdminBillingPromotionCode,
  fetchAdminBillingPromotionCodeStats,
  fetchAdminBillingPromotionCodes,
  updateAdminBillingPromotionCode,
  type BillingPromotionCodeAdminRow,
  type BillingPromotionCodeStatsResponse,
  type BillingPromotionListFilter,
} from '../../insurance-billing/api/insuranceBillingAdminApi'
import {
  BILLING_PROMOTION_APPLY_TARGET_LABEL,
  BILLING_PROMOTION_FREE_MONTHS_MAX,
  BILLING_PROMOTION_FREE_MONTHS_MIN,
  billingPromotionRowToFormValues,
  buildBillingPromotionCreatePayload,
  EMPTY_BILLING_PROMOTION_FORM,
  formatBillingPromotionBenefitLabel,
  generateBillingPromotionCodeCandidate,
  type BillingPromotionApplyTarget,
  type BillingPromotionFormValues,
} from '../../insurance-billing/billingPromotionAdminForm'
import { AdminDataCard } from '../../admin/components/layout'
import PromotionCodeForm from './PromotionCodeForm'

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

export default function PromotionCodesAdminSection({ token, busy, setBusy, onInfo, onError }: Props) {
  const [filter, setFilter] = useState<BillingPromotionListFilter>('all')
  const [rows, setRows] = useState<BillingPromotionCodeAdminRow[]>([])
  const [loadError, setLoadError] = useState('')
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [editingRow, setEditingRow] = useState<BillingPromotionCodeAdminRow | null>(null)
  const [formValues, setFormValues] = useState<BillingPromotionFormValues>(EMPTY_BILLING_PROMOTION_FORM)
  const [statsTarget, setStatsTarget] = useState<BillingPromotionCodeStatsResponse | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<BillingPromotionCodeAdminRow | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  const load = useCallback(async () => {
    if (!token.trim()) return
    setLoadError('')
    try {
      const data = await fetchAdminBillingPromotionCodes(token, filter)
      setRows(data.rows)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : '프로모션 코드 목록을 불러오지 못했습니다.')
    }
  }, [token, filter])

  useEffect(() => {
    void load()
  }, [load])

  const openCreate = () => {
    setFormMode('create')
    setEditingRow(null)
    setFormValues(EMPTY_BILLING_PROMOTION_FORM)
  }

  const openEdit = (row: BillingPromotionCodeAdminRow) => {
    setFormMode('edit')
    setEditingRow(row)
    setFormValues(billingPromotionRowToFormValues(row))
  }

  const handleGenerateCode = () => {
    setFormValues((prev) => ({ ...prev, code: generateBillingPromotionCodeCandidate() }))
  }

  const onSubmit = async () => {
    if (!token.trim() || busy) return
    if (!formValues.code.trim()) {
      onError('코드를 입력해 주세요.')
      return
    }
    if (!formValues.name.trim()) {
      onError('코드 이름을 입력해 주세요.')
      return
    }
    if (formValues.discountType === 'free_months') {
      const months = Math.floor(Number(formValues.freeMonths))
      if (!Number.isFinite(months) || months < BILLING_PROMOTION_FREE_MONTHS_MIN) {
        onError('무료 개월 수는 1 이상이어야 합니다.')
        return
      }
      if (months > BILLING_PROMOTION_FREE_MONTHS_MAX) {
        onError('무료 개월 수는 12 이하여야 합니다.')
        return
      }
    }

    setBusy(true)
    onError('')
    try {
      const payload = buildBillingPromotionCreatePayload(formValues)
      if (formMode === 'create') {
        await createAdminBillingPromotionCode(token, payload)
        onInfo(`${payload.code} 프로모션 코드가 생성되었습니다.`)
      } else if (editingRow) {
        await updateAdminBillingPromotionCode(token, editingRow.id, payload)
        onInfo(`${payload.code} 프로모션 코드가 수정되었습니다.`)
      }
      openCreate()
      await load()
    } catch (e) {
      onError(e instanceof Error ? e.message : '저장에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const onShowStats = async (row: BillingPromotionCodeAdminRow) => {
    if (!token.trim() || busy) return
    setBusy(true)
    onError('')
    try {
      const stats = await fetchAdminBillingPromotionCodeStats(token, row.id)
      setStatsTarget(stats)
    } catch (e) {
      onError(e instanceof Error ? e.message : '통계를 불러오지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

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
      if (editingRow?.id === deleteTarget.id) {
        openCreate()
      }
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
      <AdminDataCard
        className="promotion-code-card"
        title="프로모션 코드"
        actions={
          <FormButton htmlType="button" variant="secondary" disabled={busy} onClick={openCreate}>
            새 코드
          </FormButton>
        }
      >
        <p className="billing-page__invoice-sub billing-page__invoice-sub--muted">
          보험 CRM checkout(billing_promotion_codes) 기준 코드입니다. 무료/할인 코드 생성·수정·삭제는 이 탭에서
          통합 관리합니다. soft delete 정책과 기존 사용 이력은 유지됩니다.
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
          <p className="status text-sm">표시할 프로모션 코드가 없습니다.</p>
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
                  {formatBillingPromotionBenefitLabel(row)}
                  {' · '}
                  적용 대상{' '}
                  {BILLING_PROMOTION_APPLY_TARGET_LABEL[row.applyScope as BillingPromotionApplyTarget] ?? row.applyScope}
                  {' · '}
                  사용 {row.usedCount}
                  {row.maxRedemptions != null ? ` / ${row.maxRedemptions}` : ''}
                </p>
                <div className="billing-page__actions">
                  {!row.deletedAt ? (
                    <>
                      <FormButton htmlType="button" variant="secondary" disabled={busy} onClick={() => openEdit(row)}>
                        수정
                      </FormButton>
                      <FormButton
                        htmlType="button"
                        variant="secondary"
                        disabled={busy}
                        onClick={() => void onShowStats(row)}
                      >
                        통계
                      </FormButton>
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
                    </>
                  ) : (
                    <FormButton
                      htmlType="button"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => void onShowStats(row)}
                    >
                      통계
                    </FormButton>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </AdminDataCard>

      <AdminDataCard className="promotion-code-card" title={formMode === 'create' ? '코드 생성' : '코드 수정'}>
        <PromotionCodeForm
          mode={formMode}
          values={formValues}
          busy={busy}
          codeReadOnly={formMode === 'edit'}
          onChange={setFormValues}
          onGenerateCode={formMode === 'create' ? handleGenerateCode : undefined}
          onSubmit={() => void onSubmit()}
        />
      </AdminDataCard>

      {statsTarget ? (
        <AdminDataCard className="promotion-code-card" title={`통계 · ${statsTarget.promotion.code}`}>
          <dl className="billing-page__meta">
            <dt>적용 계정</dt>
            <dd>{statsTarget.accountCount}명</dd>
            <dt>코드 사용</dt>
            <dd>{statsTarget.redemptionCount}건</dd>
            <dt>혜택</dt>
            <dd>{formatBillingPromotionBenefitLabel(statsTarget.promotion)}</dd>
          </dl>
          {statsTarget.recentRedemptions.length > 0 ? (
            <ul className="billing-page__policy-list">
              {statsTarget.recentRedemptions.map((item) => (
                <li key={item.id}>
                  {item.userId} · {item.redeemedAt ?? ''}
                  {item.freeEndsAt ? ` · 무료 종료 ${item.freeEndsAt}` : ''}
                </li>
              ))}
            </ul>
          ) : (
            <p className="status text-sm">사용 내역이 없습니다.</p>
          )}
          <FormButton htmlType="button" variant="secondary" onClick={() => setStatsTarget(null)}>
            닫기
          </FormButton>
        </AdminDataCard>
      ) : null}

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
