import { useCallback, useEffect, useMemo, useState } from 'react'
import { FieldWrapper, FormButton, FormInput, FormSelect } from '../../../components/form'
import { StatusMessage } from '../../../components/feedback'
import { ConfirmDialog } from '../../../components/dialog/ConfirmDialog'
import {
  activateAdminBillingPromotionCode,
  createAdminBillingPromotionCode,
  deactivateAdminBillingPromotionCode,
  deleteAdminBillingPromotionCode,
  fetchAdminBillingPromotionCodes,
  type BillingPromotionCodeAdminRow,
  type BillingPromotionListFilter,
} from '../../insurance-billing/api/insuranceBillingAdminApi'
import {
  BILLING_PROMOTION_DEFAULT_FREE_MONTHS,
  BILLING_PROMOTION_DISCOUNT_UI_LABEL,
  BILLING_PROMOTION_FREE_MONTHS_MAX,
  BILLING_PROMOTION_FREE_MONTHS_MIN,
  buildBillingPromotionCreatePayload,
  buildBillingPromotionCreatePreview,
  needsBillingPromotionAmountField,
  needsBillingPromotionFreeMonthsField,
  needsBillingPromotionPercentField,
  normalizeBillingPromotionCodeInput,
  type BillingPromotionCreateFormValues,
  type BillingPromotionDiscountUiType,
} from '../../insurance-billing/billingPromotionAdminForm'

const FILTER_OPTIONS: { value: BillingPromotionListFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'active', label: '활성' },
  { value: 'inactive', label: '비활성' },
  { value: 'deleted', label: '삭제됨' },
]

const DISCOUNT_TYPE_OPTIONS = (
  Object.keys(BILLING_PROMOTION_DISCOUNT_UI_LABEL) as BillingPromotionDiscountUiType[]
).map((value) => ({
  value,
  label: BILLING_PROMOTION_DISCOUNT_UI_LABEL[value],
}))

const EMPTY_FORM: BillingPromotionCreateFormValues = {
  code: '',
  name: '',
  discountType: 'free_months',
  discountAmount: 2000,
  discountPercent: 10,
  freeMonths: BILLING_PROMOTION_DEFAULT_FREE_MONTHS,
  maxRedemptions: null,
  appliesToPlanCode: 'insurance_basic',
}

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

function rowBenefitLabel(row: BillingPromotionCodeAdminRow) {
  if (row.type === 'free_months' && row.freeMonths != null) {
    return `${row.freeMonths}개월 무료`
  }
  if (row.type === 'amount_off') return '정액 할인'
  if (row.type === 'percent_off') return '정률 할인'
  return row.type
}

export default function BillingPromotionCodesAdminSection({ token, busy, setBusy, onInfo, onError }: Props) {
  const [filter, setFilter] = useState<BillingPromotionListFilter>('all')
  const [rows, setRows] = useState<BillingPromotionCodeAdminRow[]>([])
  const [loadError, setLoadError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<BillingPromotionCodeAdminRow | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [formValues, setFormValues] = useState<BillingPromotionCreateFormValues>(EMPTY_FORM)

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

  const previewText = useMemo(() => buildBillingPromotionCreatePreview(formValues), [formValues])

  const freeMonthsPreview =
    formValues.discountType === 'free_months'
      ? `${Math.min(BILLING_PROMOTION_FREE_MONTHS_MAX, Math.max(BILLING_PROMOTION_FREE_MONTHS_MIN, Math.floor(formValues.freeMonths) || BILLING_PROMOTION_DEFAULT_FREE_MONTHS))}개월 무료`
      : ''

  const onCreate = async () => {
    if (!token.trim() || busy) return
    if (!formValues.code.trim()) {
      onError('코드를 입력해 주세요.')
      return
    }
    if (!formValues.name.trim()) {
      onError('코드 이름을 입력해 주세요.')
      return
    }
    if (needsBillingPromotionFreeMonthsField(formValues.discountType)) {
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
      await createAdminBillingPromotionCode(token, payload)
      onInfo(`${payload.code} 코드가 생성되었습니다.`)
      setFormValues(EMPTY_FORM)
      await load()
    } catch (e) {
      onError(e instanceof Error ? e.message : '코드 생성에 실패했습니다.')
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
          <h2 className="billing-page__section-title">코드 생성</h2>
        </div>
        <p className="billing-page__invoice-sub billing-page__invoice-sub--muted">
          보험 CRM 결제단 무료/할인 코드를 생성합니다. N개월 무료는 결제 없이 trialing 상태로 시작합니다.
        </p>
        <div className="promotion-code-form-grid">
          <FieldWrapper label="코드" className="promotion-code-field">
            <FormInput
              value={formValues.code}
              onChange={(e) =>
                setFormValues((prev) => ({ ...prev, code: normalizeBillingPromotionCodeInput(e.target.value) }))
              }
              placeholder="예: YJASSET-FREE-3M"
            />
          </FieldWrapper>
          <FieldWrapper label="코드 이름" className="promotion-code-field">
            <FormInput
              value={formValues.name}
              onChange={(e) => setFormValues((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="예: 영진에셋 3개월 무료"
            />
          </FieldWrapper>
          <FieldWrapper label="할인 유형" className="promotion-code-field">
            <FormSelect
              value={formValues.discountType}
              options={DISCOUNT_TYPE_OPTIONS}
              onChange={(e) =>
                setFormValues((prev) => ({
                  ...prev,
                  discountType: e.target.value as BillingPromotionDiscountUiType,
                }))
              }
            />
          </FieldWrapper>
          {needsBillingPromotionAmountField(formValues.discountType) ? (
            <FieldWrapper label="할인 금액(공급가)" className="promotion-code-field">
              <FormInput
                inputMode="numeric"
                value={formValues.discountAmount}
                onChange={(e) =>
                  setFormValues((prev) => ({ ...prev, discountAmount: Number(e.target.value) || 0 }))
                }
              />
            </FieldWrapper>
          ) : null}
          {needsBillingPromotionPercentField(formValues.discountType) ? (
            <FieldWrapper label="할인율(%)" className="promotion-code-field">
              <FormInput
                inputMode="numeric"
                value={formValues.discountPercent}
                onChange={(e) =>
                  setFormValues((prev) => ({ ...prev, discountPercent: Number(e.target.value) || 0 }))
                }
              />
            </FieldWrapper>
          ) : null}
          {needsBillingPromotionFreeMonthsField(formValues.discountType) ? (
            <FieldWrapper label="무료 개월 수" className="promotion-code-field">
              <FormInput
                inputMode="numeric"
                min={BILLING_PROMOTION_FREE_MONTHS_MIN}
                max={BILLING_PROMOTION_FREE_MONTHS_MAX}
                value={formValues.freeMonths}
                onChange={(e) =>
                  setFormValues((prev) => ({ ...prev, freeMonths: Number(e.target.value) || 0 }))
                }
                placeholder="예: 3"
              />
              {freeMonthsPreview ? (
                <p className="billing-page__invoice-sub billing-page__invoice-sub--muted">{freeMonthsPreview}</p>
              ) : null}
            </FieldWrapper>
          ) : null}
          <FieldWrapper label="최대 사용 횟수 (비우면 무제한)" className="promotion-code-field">
            <FormInput
              inputMode="numeric"
              value={formValues.maxRedemptions ?? ''}
              onChange={(e) =>
                setFormValues((prev) => ({
                  ...prev,
                  maxRedemptions: e.target.value.trim() === '' ? null : Number(e.target.value),
                }))
              }
            />
          </FieldWrapper>
          {previewText ? (
            <p className="promotion-code-preview promotion-code-field--full status">{previewText}</p>
          ) : null}
          <div className="promotion-code-actions promotion-code-field--full">
            <FormButton htmlType="button" variant="primary" disabled={busy} onClick={() => void onCreate()}>
              생성
            </FormButton>
          </div>
        </div>
      </section>

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
                  {rowBenefitLabel(row)}
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
