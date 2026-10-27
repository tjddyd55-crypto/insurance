import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { BaseDialog } from '../../../components/dialog/BaseDialog'
import { DialogActions } from '../../../components/dialog/DialogActions'
import { FieldWrapper, FormButton, FormInput, FormTextarea } from '../../../components/form'
import {
  ANNUAL_PAID_MONTHS,
  ANNUAL_USAGE_MONTHS,
  DEFAULT_REFERRAL_DISCOUNT_PER_USER,
  buildReferralPaymentPreview,
  computeAnnualAmounts,
  formatAmountInput,
  formatKrwTotal,
  isBlockedAmountKey,
  sanitizeAmountInput,
  splitVatInclusiveTotal,
} from '../pricingPolicy'
import type { BillingPlanAdminRow } from '../api/billingApi'
import './billing-plan-form-modal.css'

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
  /** 신규 요금제 기본 1명당 할인금액 — 서버 /admin/billing/referral-policy 값(서버 DEFAULT_REFERRAL_DISCOUNT_PER_USER) */
  defaultReferralDiscountPerUser?: number | null
}

const makeEmptyValues = (defaultPerUser: number): BillingPlanFormValues => ({
  code: '',
  name: '',
  totalAmount: '',
  applyVat: true,
  allowsReferralDiscount: true,
  referralDiscountStartCount: '1',
  referralDiscountUnitSupplyAmount: String(defaultPerUser),
  description: '',
  isActive: true,
})

function CheckboxField({
  label,
  description,
  checked,
  disabled,
  testId,
  onChange,
}: {
  label: string
  description?: string
  checked: boolean
  disabled?: boolean
  testId?: string
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="billing-plan-form-modal__check-row">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        data-testid={testId}
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
  testId,
  onChange,
}: {
  label: string
  helperText?: string
  value: string
  disabled?: boolean
  testId?: string
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
          data-testid={testId}
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
  defaultReferralDiscountPerUser,
}: BillingPlanFormDialogProps) {
  // 서버 기본값 우선, 미수신 시에만 공용 상수(서버 SSOT 미러) 사용
  const defaultPerUser =
    typeof defaultReferralDiscountPerUser === 'number' && Number.isInteger(defaultReferralDiscountPerUser) && defaultReferralDiscountPerUser >= 0
      ? defaultReferralDiscountPerUser
      : DEFAULT_REFERRAL_DISCOUNT_PER_USER
  const [values, setValues] = useState<BillingPlanFormValues>(() => makeEmptyValues(defaultPerUser))
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
        referralDiscountUnitSupplyAmount: String(initialPlan.referralDiscountUnitSupplyAmount ?? defaultPerUser),
        description: initialPlan.description ?? '',
        isActive: initialPlan.isActive,
      })
      return
    }
    setValues(makeEmptyValues(defaultPerUser))
  }, [open, mode, initialPlan, defaultPerUser])

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

  // 체크 해제 시에도 values.referralDiscountUnitSupplyAmount 는 지우지 않음 → 재체크 시 그대로 복원
  const preview = useMemo(
    () => (priced && perUser != null ? buildReferralPaymentPreview(priced.totalAmount, perUser) : null),
    [priced, perUser],
  )
  const freeReferralCount = values.allowsReferralDiscount ? (preview?.freeReferralCount ?? null) : null
  const referralRows = preview?.rows ?? []

  const handleSubmit = () => {
    const code = values.code.trim().toLowerCase()
    const name = values.name.trim()
    const totalRaw = values.totalAmount.trim()
    const totalAmount = Number(totalRaw)
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
    void onSubmit({ ...values, code: mode === 'edit' ? code : '', name, totalAmount: String(totalAmount) })
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
            <div className={mode === 'create' ? '' : 'billing-plan-form-modal__grid-2'}>
              {mode === 'edit' ? (
                <FieldWrapper label="요금제 코드">
                  <p className="billing-plan-form-modal__code-readonly">{values.code}</p>
                </FieldWrapper>
              ) : null}
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

          <div className="billing-plan-form-modal__pricing-grid" data-testid="pricing-flow">
            <div className="billing-plan-form-modal__pricing-col">
              <FormSection title="① 월 최종 결제금액">
                <AmountInput
                  label="월 이용료 (VAT 포함 최종 결제금액)"
                  helperText="고객이 매월 실제 결제하는 금액. 공급가·부가세는 자동 역산됩니다."
                  value={values.totalAmount}
                  disabled={busy}
                  testId="monthly-total-input"
                  onChange={(next) => setValues((prev) => ({ ...prev, totalAmount: next }))}
                />
                <CheckboxField
                  label="VAT 적용"
                  description="입력 금액에 부가세(10%)가 포함된 것으로 보고 나눕니다."
                  checked={values.applyVat}
                  disabled={busy}
                  onChange={(applyVat) => setValues((prev) => ({ ...prev, applyVat }))}
                />
                <div className="billing-plan-form-modal__price-preview" data-testid="monthly-preview">
                  {priced ? (
                    <dl>
                      <dt>월 결제금액</dt>
                      <dd className="billing-plan-form-modal__price-total">{formatKrwTotal(priced.totalAmount)}</dd>
                      <dt>공급가 / 부가세</dt>
                      <dd>
                        {formatKrwTotal(priced.supplyAmount)} / {formatKrwTotal(priced.vatAmount)}
                      </dd>
                    </dl>
                  ) : (
                    <p className="billing-plan-form-modal__hint">월 이용료를 입력하면 공급가·부가세가 계산됩니다.</p>
                  )}
                </div>
              </FormSection>

              <FormSection title="② 연간 결제금액 (자동 계산)">
                <div className="billing-plan-form-modal__price-preview" data-testid="annual-preview">
                  {annual ? (
                    <dl>
                      <dt>연간 결제금액</dt>
                      <dd className="billing-plan-form-modal__price-total" data-testid="annual-total">
                        {formatKrwTotal(annual.annualTotal)}
                      </dd>
                      <dt>정상 {ANNUAL_USAGE_MONTHS}개월 / 할인</dt>
                      <dd>
                        {formatKrwTotal(annual.regularTotal)} / -{formatKrwTotal(annual.annualDiscount)}
                      </dd>
                      <dt>공급가 / 부가세</dt>
                      <dd>
                        {formatKrwTotal(annual.supplyAmount)} / {formatKrwTotal(annual.vatAmount)}
                      </dd>
                    </dl>
                  ) : (
                    <p className="billing-plan-form-modal__hint">월 이용료를 입력하면 연간 금액이 자동 계산됩니다.</p>
                  )}
                  <p className="billing-plan-form-modal__hint">
                    {ANNUAL_USAGE_MONTHS}개월 이용 / {ANNUAL_PAID_MONTHS}개월분 결제 ({ANNUAL_USAGE_MONTHS - ANNUAL_PAID_MONTHS}개월 무료)
                  </p>
                </div>
              </FormSection>
            </div>

            <div className="billing-plan-form-modal__pricing-col">
              <FormSection title="추천 할인">
                <CheckboxField
                  label="추천 할인 적용"
                  description="유료 이용 중인 추천회원 1명당 매월 설정 금액 할인"
                  checked={values.allowsReferralDiscount}
                  disabled={busy}
                  testId="referral-enabled-checkbox"
                  onChange={(allowsReferralDiscount) =>
                    setValues((prev) => ({ ...prev, allowsReferralDiscount }))
                  }
                />
                <div
                  className={`billing-plan-form-modal__referral-body${values.allowsReferralDiscount ? '' : ' is-disabled'}`}
                  data-testid="referral-body"
                  aria-disabled={!values.allowsReferralDiscount}
                >
                  <AmountInput
                    label="③ 유료 추천 1명당 월 할인금액"
                    helperText="0원 이상 정수. 변경 시 다음 결제 계산부터 적용(과거 결제 재계산 없음)."
                    value={values.referralDiscountUnitSupplyAmount}
                    disabled={busy || !values.allowsReferralDiscount}
                    testId="referral-discount-per-user-input"
                    onChange={(next) =>
                      setValues((prev) => ({ ...prev, referralDiscountUnitSupplyAmount: next }))
                    }
                  />
                  <p className="billing-plan-form-modal__subhead">④ 현재 설정 기준 예상 결제금액</p>
                  {values.allowsReferralDiscount && referralRows.length > 0 ? (
                    <table className="billing-plan-form-modal__referral-table" data-testid="referral-table">
                      <thead>
                        <tr>
                          <th>유료 추천</th>
                          <th>할인</th>
                          <th>월 결제금액</th>
                        </tr>
                      </thead>
                      <tbody>
                        {referralRows.map((row) => (
                          <tr key={row.count} data-testid={`referral-row-${row.count}`}>
                            <td>
                              {row.count}명{row.isFreeRow ? ' 이상' : ''}
                            </td>
                            <td>{formatKrwTotal(row.appliedReferralDiscount)}</td>
                            <td>{formatKrwTotal(row.paymentTotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="billing-plan-form-modal__hint">
                      {values.allowsReferralDiscount ? '월 이용료와 할인금액을 입력하면 표시됩니다.' : '추천 할인 미적용'}
                    </p>
                  )}
                  {freeReferralCount != null ? (
                    <p className="billing-plan-form-modal__free-note" data-testid="referral-free-count">
                      유료 추천 {freeReferralCount}명 이상 유지 시 월 이용료 0원
                    </p>
                  ) : values.allowsReferralDiscount && perUser === 0 ? (
                    <p className="billing-plan-form-modal__hint">1명당 할인금액이 0원이면 무료 조건이 없습니다.</p>
                  ) : null}
                </div>
              </FormSection>
            </div>
          </div>

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
            {priced ? (
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
            ) : (
              <p className="billing-plan-form-modal__hint" data-testid="plan-summary-empty">
                월 이용료를 입력하면 요약이 표시됩니다.
              </p>
            )}
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
      label: `${plan.label} ${plan.totalAmount.toLocaleString('ko-KR')}원 / 월 (${plan.applyVat === false ? 'VAT 미적용' : 'VAT 포함'})${plan.isActive ? '' : ' · 비활성'}`,
    }))
}
