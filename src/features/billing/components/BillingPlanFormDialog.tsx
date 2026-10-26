import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { BaseDialog } from '../../../components/dialog/BaseDialog'
import { DialogActions } from '../../../components/dialog/DialogActions'
import { FieldWrapper, FormButton, FormInput, FormTextarea } from '../../../components/form'
import {
  ANNUAL_PAID_MONTHS,
  ANNUAL_USAGE_MONTHS,
  DEFAULT_REFERRAL_DISCOUNT_PER_USER,
  calculateFreeReferralCount,
  computeAnnualAmounts,
  computeReferralPayment,
  formatAmountInput,
  formatKrwTotal,
  isBlockedAmountKey,
  sanitizeAmountInput,
  splitVatInclusiveTotal,
} from '../pricingPolicy'
import type { BillingPlanAdminRow } from '../api/billingApi'
import './billing-plan-form-modal.css'

const PLAN_CODE_PATTERN = /^[a-z0-9_]+$/

export type BillingPlanFormValues = {
  code: string
  name: string
  /** VAT 포함 최종 결제금액 */
  totalAmount: string
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
  totalAmount: '',
  applyVat: true,
  allowsReferralDiscount: true,
  referralDiscountStartCount: '1',
  referralDiscountUnitSupplyAmount: String(DEFAULT_REFERRAL_DISCOUNT_PER_USER),
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
        {/* 표시는 천 단위 콤마, 상태/API 값은 숫자 문자열(콤마 없음). -, . 입력 차단 */}
        <FormInput
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={formatAmountInput(value)}
          disabled={disabled}
          onKeyDown={(e) => {
            if (isBlockedAmountKey(e.key)) e.preventDefault()
          }}
          onChange={(e) => onChange(sanitizeAmountInput(e.target.value))}
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
        totalAmount: String(initialPlan.totalAmount),
        applyVat: initialPlan.applyVat,
        allowsReferralDiscount: initialPlan.allowsReferralDiscount,
        referralDiscountStartCount: String(initialPlan.referralDiscountStartCount ?? 1),
        referralDiscountUnitSupplyAmount: String(initialPlan.referralDiscountUnitSupplyAmount ?? DEFAULT_REFERRAL_DISCOUNT_PER_USER),
        description: initialPlan.description ?? '',
        isActive: initialPlan.isActive,
      })
      return
    }
    setValues(emptyValues)
  }, [open, mode, initialPlan])

  const priced = useMemo(() => {
    const raw = Number(values.totalAmount)
    if (!Number.isInteger(raw) || raw <= 0) {
      return null
    }
    return splitVatInclusiveTotal(raw, values.applyVat)
  }, [values.applyVat, values.totalAmount])

  const annual = useMemo(
    () => (priced ? computeAnnualAmounts(priced.totalAmount, values.applyVat) : null),
    [priced, values.applyVat],
  )

  const perUser = useMemo(() => {
    const raw = values.referralDiscountUnitSupplyAmount
    if (!/^\d+$/.test(raw)) return null
    return Number(raw)
  }, [values.referralDiscountUnitSupplyAmount])

  const freeReferralCount = useMemo(() => {
    if (!priced || perUser == null) return null
    return calculateFreeReferralCount({
      allowsReferralDiscount: values.allowsReferralDiscount,
      totalAmount: priced.totalAmount,
      referralDiscountUnitSupplyAmount: perUser,
    })
  }, [priced, perUser, values.allowsReferralDiscount])

  const referralRows = useMemo(() => {
    if (!priced || perUser == null || freeReferralCount == null) return []
    const rows = []
    for (let n = 0; n <= Math.min(freeReferralCount, 50); n += 1) {
      rows.push({ count: n, ...computeReferralPayment(priced.totalAmount, n, perUser) })
    }
    return rows
  }, [priced, perUser, freeReferralCount])

  const handleSubmit = () => {
    const code = values.code.trim().toLowerCase()
    const name = values.name.trim()
    const totalRaw = values.totalAmount.trim()
    const totalAmount = Number(totalRaw)
    if (mode === 'create' && (!code || !PLAN_CODE_PATTERN.test(code))) {
      setLocalError('요금제 코드는 영문 소문자, 숫자, 밑줄(_)만 사용할 수 있습니다.')
      return
    }
    if (!name) {
      setLocalError('요금제명을 입력해 주세요.')
      return
    }
    if (!/^\d+$/.test(totalRaw) || !Number.isInteger(totalAmount) || totalAmount <= 0) {
      setLocalError('최종 결제금액은 1원 이상의 정수(음수·소수 불가)로 입력해 주세요.')
      return
    }
    if (values.allowsReferralDiscount && !/^\d+$/.test(values.referralDiscountUnitSupplyAmount.trim())) {
      setLocalError('유료 추천 1명당 월 할인금액은 0원 이상의 정수로 입력해 주세요.')
      return
    }
    setLocalError('')
    void onSubmit({ ...values, code, name, totalAmount: String(totalAmount) })
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

          <FormSection title="월 이용료">
            <AmountInput
              label="월 이용료 (VAT 포함 최종 결제금액)"
              helperText="고객이 매월 실제로 결제하는 금액을 입력합니다. 공급가·부가세는 자동 역산됩니다."
              value={values.totalAmount}
              disabled={busy}
              onChange={(next) => setValues((prev) => ({ ...prev, totalAmount: next }))}
            />
            <CheckboxField
              label="VAT 적용"
              description="체크 시 입력 금액에 부가세(10%)가 포함된 것으로 보고 공급가·부가세를 나눕니다."
              checked={values.applyVat}
              disabled={busy}
              onChange={(applyVat) => setValues((prev) => ({ ...prev, applyVat }))}
            />
            <div className="billing-plan-form-modal__price-preview">
              <p className="billing-plan-form-modal__price-preview-title">월 결제 미리보기</p>
              {priced ? (
                <dl>
                  <dt>월 결제금액</dt>
                  <dd className="billing-plan-form-modal__price-total">{formatKrwTotal(priced.totalAmount)}</dd>
                  <dt>공급가</dt>
                  <dd>{formatKrwTotal(priced.supplyAmount)}</dd>
                  <dt>부가세</dt>
                  <dd>{formatKrwTotal(priced.vatAmount)}</dd>
                </dl>
              ) : (
                <p className="billing-plan-form-modal__hint">월 이용료를 입력하면 공급가·부가세가 계산됩니다.</p>
              )}
            </div>
          </FormSection>

          <FormSection title="연간 결제">
            <div className="billing-plan-form-modal__price-preview" data-testid="annual-preview">
              {annual ? (
                <dl>
                  <dt>연간 결제금액</dt>
                  <dd className="billing-plan-form-modal__price-total">{formatKrwTotal(annual.annualTotal)}</dd>
                  <dt>정상 {ANNUAL_USAGE_MONTHS}개월 금액</dt>
                  <dd>{formatKrwTotal(annual.regularTotal)}</dd>
                  <dt>연간 할인</dt>
                  <dd>{formatKrwTotal(annual.annualDiscount)}</dd>
                  <dt>공급가</dt>
                  <dd>{formatKrwTotal(annual.supplyAmount)}</dd>
                  <dt>부가세</dt>
                  <dd>{formatKrwTotal(annual.vatAmount)}</dd>
                </dl>
              ) : (
                <p className="billing-plan-form-modal__hint">월 이용료를 입력하면 연간 금액이 자동 계산됩니다.</p>
              )}
              <p className="billing-plan-form-modal__hint">
                {ANNUAL_USAGE_MONTHS}개월 이용 / {ANNUAL_PAID_MONTHS}개월분 결제 → {ANNUAL_USAGE_MONTHS - ANNUAL_PAID_MONTHS}개월 무료
              </p>
            </div>
          </FormSection>

          <FormSection title="추천 할인">
            <CheckboxField
              label="추천 할인 적용"
              description="유료 이용 중인 추천회원 1명당 매월 설정 금액 할인"
              checked={values.allowsReferralDiscount}
              disabled={busy}
              onChange={(allowsReferralDiscount) =>
                setValues((prev) => ({ ...prev, allowsReferralDiscount }))
              }
            />
            {values.allowsReferralDiscount ? (
              <>
                <AmountInput
                  label="유료 추천 1명당 월 할인금액"
                  helperText="0원 이상 정수. 변경 시 다음 결제 계산부터 적용됩니다(과거 결제 재계산 없음)."
                  value={values.referralDiscountUnitSupplyAmount}
                  disabled={busy}
                  onChange={(next) =>
                    setValues((prev) => ({ ...prev, referralDiscountUnitSupplyAmount: next }))
                  }
                />
                {referralRows.length > 0 ? (
                  <table className="billing-plan-form-modal__referral-table" data-testid="referral-table">
                    <thead>
                      <tr>
                        <th>유료 추천</th>
                        <th>할인</th>
                        <th>예상 월 결제금액</th>
                      </tr>
                    </thead>
                    <tbody>
                      {referralRows.map((row) => (
                        <tr key={row.count}>
                          <td>
                            {row.count}명{row.count === freeReferralCount ? ' 이상' : ''}
                          </td>
                          <td>{formatKrwTotal(row.appliedReferralDiscount)}</td>
                          <td>{formatKrwTotal(row.paymentTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : null}
                {freeReferralCount != null ? (
                  <p className="billing-plan-form-modal__hint">
                    유료 추천 {freeReferralCount}명 이상 유지 시 월 이용료 0원
                  </p>
                ) : perUser === 0 ? (
                  <p className="billing-plan-form-modal__hint">1명당 할인금액이 0원이면 무료 조건이 없습니다.</p>
                ) : null}
              </>
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
          <FormSection title="현재 요금제 요약">
            <dl className="billing-plan-form-modal__summary" data-testid="plan-summary">
              <dt>월 이용료</dt>
              <dd>{priced ? formatKrwTotal(priced.totalAmount) : '—'}</dd>
              <dt>연간 이용료</dt>
              <dd>
                {annual
                  ? `${formatKrwTotal(annual.annualTotal)} (${ANNUAL_USAGE_MONTHS}개월 이용 / ${ANNUAL_USAGE_MONTHS - ANNUAL_PAID_MONTHS}개월 무료)`
                  : '—'}
              </dd>
              <dt>추천 할인</dt>
              <dd>
                {values.allowsReferralDiscount
                  ? perUser != null
                    ? `유료 추천 1명당 월 ${formatKrwTotal(perUser)}`
                    : '—'
                  : '미적용'}
              </dd>
              <dt>무료 이용 조건</dt>
              <dd>
                {values.allowsReferralDiscount && freeReferralCount != null
                  ? `유료 추천 ${freeReferralCount}명 이상 유지`
                  : '없음'}
              </dd>
            </dl>
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
