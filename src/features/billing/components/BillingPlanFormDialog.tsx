import { useEffect, useMemo, useState } from 'react'
import { FieldWrapper, FormButton, FormInput, FormTextarea } from '../../../components/form'
import { FormDialog } from '../../../components/dialog/FormDialog'
import { DialogActions } from '../../../components/dialog/DialogActions'
import { calculateVatIncludedPrice, formatPricingBreakdown, VAT_RATE } from '../pricingPolicy'
import type { BillingPlanAdminRow } from '../api/billingApi'

const PLAN_CODE_PATTERN = /^[a-z0-9_]+$/

export type BillingPlanFormValues = {
  code: string
  name: string
  supplyAmount: string
  applyVat: boolean
  allowsReferralDiscount: boolean
  description: string
  isActive: boolean
}

type BillingPlanFormDialogProps = {
  open: boolean
  mode: 'create' | 'edit'
  initialPlan?: BillingPlanAdminRow | null
  busy: boolean
  error: string
  onClose: () => void
  onSubmit: (values: BillingPlanFormValues) => void | Promise<void>
}

const emptyValues: BillingPlanFormValues = {
  code: '',
  name: '',
  supplyAmount: '',
  applyVat: true,
  allowsReferralDiscount: true,
  description: '',
  isActive: true,
}

export function BillingPlanFormDialog({
  open,
  mode,
  initialPlan,
  busy,
  error,
  onClose,
  onSubmit,
}: BillingPlanFormDialogProps) {
  const [values, setValues] = useState<BillingPlanFormValues>(emptyValues)
  const [localError, setLocalError] = useState('')

  useEffect(() => {
    if (!open) return
    setLocalError('')
    if (mode === 'edit' && initialPlan) {
      setValues({
        code: initialPlan.dbCode,
        name: initialPlan.label,
        supplyAmount: String(initialPlan.supplyAmount),
        applyVat: initialPlan.applyVat,
        allowsReferralDiscount: initialPlan.allowsReferralDiscount,
        description: initialPlan.description ?? '',
        isActive: initialPlan.isActive,
      })
      return
    }
    setValues(emptyValues)
  }, [open, mode, initialPlan])

  const priced = useMemo(() => {
    const supply = Math.max(Math.round(Number(values.supplyAmount) || 0), 0)
    if (supply <= 0) {
      return null
    }
    if (!values.applyVat) {
      return { supplyAmount: supply, vatAmount: 0, totalAmount: supply }
    }
    return calculateVatIncludedPrice(supply, VAT_RATE)
  }, [values.applyVat, values.supplyAmount])

  const handleSubmit = () => {
    const code = values.code.trim().toLowerCase()
    const name = values.name.trim()
    const supplyAmount = Math.round(Number(values.supplyAmount))
    if (mode === 'create' && (!code || !PLAN_CODE_PATTERN.test(code))) {
      setLocalError('요금제 코드는 영문 소문자, 숫자, 밑줄(_)만 사용할 수 있습니다.')
      return
    }
    if (!name) {
      setLocalError('요금제명을 입력해 주세요.')
      return
    }
    if (!Number.isFinite(supplyAmount) || supplyAmount <= 0) {
      setLocalError('공급가는 1원 이상이어야 합니다.')
      return
    }
    setLocalError('')
    void onSubmit({ ...values, code, name, supplyAmount: String(supplyAmount) })
  }

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={mode === 'create' ? '요금제 추가' : '요금제 수정'}
      closeOnBackdrop={false}
      closeOnEsc={!busy}
      panelPreset="largeForm"
      usePortal
      overlayClassName="!z-[100100]"
      footer={
        <DialogActions>
          <FormButton htmlType="button" variant="secondary" disabled={busy} onClick={onClose}>
            취소
          </FormButton>
          <FormButton htmlType="button" variant="primary" disabled={busy} onClick={handleSubmit}>
            {busy ? '저장 중…' : '저장'}
          </FormButton>
        </DialogActions>
      }
    >
      <div className="billing-plan-form">
        {mode === 'create' ? (
          <FieldWrapper label="요금제 코드" helperText="예: monthly_special">
            <FormInput
              value={values.code}
              onChange={(e) => setValues((prev) => ({ ...prev, code: e.target.value }))}
              autoComplete="off"
              disabled={busy}
            />
          </FieldWrapper>
        ) : (
          <FieldWrapper label="요금제 코드">
            <p className="status text-sm">{values.code}</p>
          </FieldWrapper>
        )}
        <FieldWrapper label="요금제명">
          <FormInput
            value={values.name}
            onChange={(e) => setValues((prev) => ({ ...prev, name: e.target.value }))}
            disabled={busy}
          />
        </FieldWrapper>
        <FieldWrapper label="공급가 (원)">
          <FormInput
            type="number"
            min={1}
            value={values.supplyAmount}
            onChange={(e) => setValues((prev) => ({ ...prev, supplyAmount: e.target.value }))}
            disabled={busy}
          />
        </FieldWrapper>
        <label className="field">
          <span className="field__label">VAT 적용 (10%)</span>
          <input
            type="checkbox"
            checked={values.applyVat}
            onChange={(e) => setValues((prev) => ({ ...prev, applyVat: e.target.checked }))}
            disabled={busy}
          />
        </label>
        <label className="field">
          <span className="field__label">추천인 할인 적용</span>
          <input
            type="checkbox"
            checked={values.allowsReferralDiscount}
            onChange={(e) => setValues((prev) => ({ ...prev, allowsReferralDiscount: e.target.checked }))}
            disabled={busy}
          />
        </label>
        <FieldWrapper label="설명">
          <FormTextarea
            value={values.description}
            onChange={(e) => setValues((prev) => ({ ...prev, description: e.target.value }))}
            rows={3}
            disabled={busy}
          />
        </FieldWrapper>
        <label className="field">
          <span className="field__label">활성</span>
          <input
            type="checkbox"
            checked={values.isActive}
            onChange={(e) => setValues((prev) => ({ ...prev, isActive: e.target.checked }))}
            disabled={busy}
          />
        </label>
        {priced ? (
          <p className="billing-page__invoice-sub billing-page__invoice-sub--muted">
            {formatPricingBreakdown(priced)}
          </p>
        ) : (
          <p className="billing-page__invoice-sub billing-page__invoice-sub--muted">공급가를 입력하면 부가세·결제금액이 계산됩니다.</p>
        )}
        {localError ? <p className="status text-sm">{localError}</p> : null}
        {error ? <p className="status text-sm">{error}</p> : null}
        {mode === 'edit' ? (
          <p className="status text-sm">수정 내용은 다음 invoice 생성부터 적용됩니다. 기존 청구서 금액은 변경되지 않습니다.</p>
        ) : null}
      </div>
    </FormDialog>
  )
}

export function buildBillingPlanSelectOptions(
  plans: BillingPlanAdminRow[],
  selectedCodes: string[] = [],
) {
  const selected = new Set(selectedCodes.filter(Boolean))
  return plans
    .filter((plan) => plan.isActive || selected.has(plan.dbCode))
    .map((plan) => ({
      value: plan.dbCode,
      label: `${plan.label} (${plan.displayPriceWithVatNote})${plan.isActive ? '' : ' · 비활성'}`,
    }))
}
