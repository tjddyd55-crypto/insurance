import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { BaseDialog } from '../../../components/dialog/BaseDialog'
import { DialogActions } from '../../../components/dialog/DialogActions'
import { FieldWrapper, FormButton, FormInput, FormTextarea } from '../../../components/form'
import { calculateVatIncludedPrice, formatPricingBreakdown, VAT_RATE } from '../pricingPolicy'
import { formatWon } from '../api/billingApi'
import type { BillingPlanAdminRow } from '../api/billingApi'
import './billing-plan-form-modal.css'

const PLAN_CODE_PATTERN = /^[a-z0-9_]+$/

export type BillingPlanFormValues = {
  code: string
  name: string
  supplyAmount: string
  applyVat: boolean
  allowsReferralDiscount: boolean
  referralDiscountStartCount: string
  referralDiscountUnitSupplyAmount: string
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
  referralDiscountStartCount: '1',
  referralDiscountUnitSupplyAmount: '1000',
  description: '',
  isActive: true,
}

function CheckboxField({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string
  description?: string
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="billing-plan-form-modal__check-row">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="billing-plan-form-modal__check-copy">
        <span className="billing-plan-form-modal__check-label">{label}</span>
        {description ? <span className="billing-plan-form-modal__check-desc">{description}</span> : null}
      </span>
    </label>
  )
}

function AmountInput({
  label,
  helperText,
  value,
  disabled,
  onChange,
}: {
  label: string
  helperText?: string
  value: string
  disabled?: boolean
  onChange: (value: string) => void
}) {
  return (
    <FieldWrapper label={label} helperText={helperText}>
      <div className="billing-plan-form-modal__input-suffix-wrap">
        <FormInput
          type="number"
          min={1}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
        <span className="billing-plan-form-modal__input-suffix">원</span>
      </div>
    </FieldWrapper>
  )
}

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="billing-plan-form-modal__section">
      <h3 className="billing-plan-form-modal__section-title">{title}</h3>
      {children}
    </section>
  )
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
        referralDiscountStartCount: String(initialPlan.referralDiscountStartCount ?? 1),
        referralDiscountUnitSupplyAmount: String(initialPlan.referralDiscountUnitSupplyAmount ?? 1000),
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

  const referralUnitPreview = useMemo(() => {
    const amount = Math.round(Number(values.referralDiscountUnitSupplyAmount) || 0)
    if (!values.allowsReferralDiscount || amount <= 0) return ''
    return `1명당 ${formatWon(amount)} 할인`
  }, [values.allowsReferralDiscount, values.referralDiscountUnitSupplyAmount])

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
    const referralDiscountStartCount = Math.round(Number(values.referralDiscountStartCount))
    const referralDiscountUnitSupplyAmount = Math.round(Number(values.referralDiscountUnitSupplyAmount))
    if (values.allowsReferralDiscount) {
      if (!Number.isFinite(referralDiscountStartCount) || referralDiscountStartCount < 1) {
        setLocalError('할인 시작 추천인 수는 1 이상이어야 합니다.')
        return
      }
      if (!Number.isFinite(referralDiscountUnitSupplyAmount) || referralDiscountUnitSupplyAmount < 1) {
        setLocalError('1명당 할인 공급가는 1원 이상이어야 합니다.')
        return
      }
    }
    setLocalError('')
    void onSubmit({ ...values, code, name, supplyAmount: String(supplyAmount) })
  }

  const displayError = localError || error

  return (
    <BaseDialog
      open={open}
      onClose={onClose}
      ariaLabel={mode === 'create' ? '요금제 추가' : '요금제 수정'}
      panelPreset="largeForm"
      panelClassName="billing-plan-form-modal-panel"
      closeOnBackdrop={false}
      closeOnEsc={!busy}
      usePortal
      overlayClassName="!z-[100100]"
    >
      <div className="billing-plan-form-modal__shell">
        <header className="billing-plan-form-modal__header">
          <div className="billing-plan-form-modal__header-copy">
            <h2 className="billing-plan-form-modal__title">
              {mode === 'create' ? '요금제 추가' : '요금제 수정'}
            </h2>
            <p className="billing-plan-form-modal__subtitle">
              수정 내용은 다음 invoice 생성분부터 적용됩니다. 기존 청구서 금액은 변경되지 않습니다.
            </p>
          </div>
          <button
            type="button"
            className="billing-plan-form-modal__close"
            aria-label="닫기"
            disabled={busy}
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="billing-plan-form-modal__body">
          {displayError ? <p className="billing-plan-form-modal__error">{displayError}</p> : null}

          <FormSection title="기본 정보">
            <div className="billing-plan-form-modal__grid-2">
              {mode === 'create' ? (
                <FieldWrapper label="요금제 코드" helperText="예: monthly_special">
                  <FormInput
                    value={values.code}
                    onChange={(e) => setValues((prev) => ({ ...prev, code: e.target.value }))}
                    autoComplete="off"
                    disabled={busy}
                    placeholder="monthly_discount"
                  />
                </FieldWrapper>
              ) : (
                <FieldWrapper label="요금제 코드">
                  <p className="billing-plan-form-modal__code-readonly">{values.code}</p>
                </FieldWrapper>
              )}
              <FieldWrapper label="요금제명">
                <FormInput
                  value={values.name}
                  onChange={(e) => setValues((prev) => ({ ...prev, name: e.target.value }))}
                  disabled={busy}
                  placeholder="할인 이용료"
                />
              </FieldWrapper>
            </div>
          </FormSection>

          <FormSection title="가격 설정">
            <AmountInput
              label="공급가"
              value={values.supplyAmount}
              disabled={busy}
              onChange={(next) => setValues((prev) => ({ ...prev, supplyAmount: next }))}
            />
            <CheckboxField
              label="VAT 적용"
              description="체크 시 공급가에 10% 부가세가 적용됩니다."
              checked={values.applyVat}
              disabled={busy}
              onChange={(applyVat) => setValues((prev) => ({ ...prev, applyVat }))}
            />
            <div className="billing-plan-form-modal__price-preview">
              <p className="billing-plan-form-modal__price-preview-title">가격 미리보기</p>
              {priced ? (
                <dl>
                  <dt>공급가</dt>
                  <dd>{formatWon(priced.supplyAmount)}</dd>
                  <dt>부가세</dt>
                  <dd>{formatWon(priced.vatAmount)}</dd>
                  <dt>결제금액</dt>
                  <dd className="billing-plan-form-modal__price-total">{formatWon(priced.totalAmount)}</dd>
                </dl>
              ) : (
                <p className="billing-plan-form-modal__hint">공급가를 입력하면 부가세·결제금액이 계산됩니다.</p>
              )}
              {priced ? (
                <p className="billing-plan-form-modal__hint">{formatPricingBreakdown(priced)}</p>
              ) : null}
            </div>
          </FormSection>

          <FormSection title="추천 할인">
            <CheckboxField
              label="추천 할인 적용"
              description="추천 유료 가입자 수에 따라 월 이용료를 할인합니다."
              checked={values.allowsReferralDiscount}
              disabled={busy}
              onChange={(allowsReferralDiscount) =>
                setValues((prev) => ({ ...prev, allowsReferralDiscount }))
              }
            />
            {values.allowsReferralDiscount ? (
              <div className="billing-plan-form-modal__grid-2">
                <FieldWrapper label="할인 시작 추천 수" helperText="monthly_basic=1, monthly_discount=4">
                  <FormInput
                    type="number"
                    min={1}
                    value={values.referralDiscountStartCount}
                    onChange={(e) =>
                      setValues((prev) => ({ ...prev, referralDiscountStartCount: e.target.value }))
                    }
                    disabled={busy}
                    placeholder="4"
                  />
                </FieldWrapper>
                <div>
                  <AmountInput
                    label="1명당 할인 공급가"
                    value={values.referralDiscountUnitSupplyAmount}
                    disabled={busy}
                    onChange={(next) =>
                      setValues((prev) => ({ ...prev, referralDiscountUnitSupplyAmount: next }))
                    }
                  />
                  {referralUnitPreview ? (
                    <p className="billing-plan-form-modal__hint">{referralUnitPreview}</p>
                  ) : null}
                </div>
              </div>
            ) : null}
          </FormSection>

          <FormSection title="상태 및 설명">
            <CheckboxField
              label="활성"
              description="비활성화된 요금제는 신규 적용 대상에서 제외됩니다."
              checked={values.isActive}
              disabled={busy}
              onChange={(isActive) => setValues((prev) => ({ ...prev, isActive }))}
            />
            <FieldWrapper label="설명">
              <FormTextarea
                value={values.description}
                onChange={(e) => setValues((prev) => ({ ...prev, description: e.target.value }))}
                rows={4}
                disabled={busy}
                placeholder="요금제 설명을 입력하세요."
              />
            </FieldWrapper>
          </FormSection>
        </div>

        <footer className="billing-plan-form-modal__footer">
          <DialogActions className="billing-plan-form-modal__actions">
            <FormButton htmlType="button" variant="secondary" disabled={busy} onClick={onClose}>
              취소
            </FormButton>
            <FormButton
              htmlType="button"
              variant="primary"
              className="billing-plan-form-modal__save-btn"
              disabled={busy}
              loading={busy}
              loadingText="저장 중..."
              onClick={handleSubmit}
            >
              저장
            </FormButton>
          </DialogActions>
        </footer>
      </div>
    </BaseDialog>
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
