import { FieldWrapper, FormButton, FormInput, FormSelect } from '../../../components/form'
import {
  BILLING_PROMOTION_APPLY_TARGET_LABEL,
  BILLING_PROMOTION_DEFAULT_FREE_MONTHS,
  BILLING_PROMOTION_DISCOUNT_UI_LABEL,
  BILLING_PROMOTION_FREE_MONTHS_MAX,
  BILLING_PROMOTION_FREE_MONTHS_MIN,
  buildBillingPromotionCreatePreview,
  needsBillingPromotionAmountField,
  needsBillingPromotionFreeMonthsField,
  needsBillingPromotionPercentField,
  normalizeBillingPromotionCodeInput,
  type BillingPromotionApplyTarget,
  type BillingPromotionDiscountUiType,
  type BillingPromotionFormValues,
} from '../../insurance-billing/billingPromotionAdminForm'

const DISCOUNT_TYPE_OPTIONS = (
  Object.keys(BILLING_PROMOTION_DISCOUNT_UI_LABEL) as BillingPromotionDiscountUiType[]
).map((value) => ({
  value,
  label: BILLING_PROMOTION_DISCOUNT_UI_LABEL[value],
}))

const APPLY_TARGET_OPTIONS = (
  Object.keys(BILLING_PROMOTION_APPLY_TARGET_LABEL) as BillingPromotionApplyTarget[]
).map((value) => ({
  value,
  label: BILLING_PROMOTION_APPLY_TARGET_LABEL[value],
}))

type Props = {
  mode: 'create' | 'edit'
  values: BillingPromotionFormValues
  busy: boolean
  isGeneratingCode?: boolean
  codeReadOnly?: boolean
  onChange: (next: BillingPromotionFormValues) => void
  onGenerateCode?: () => void
  onSubmit: () => void
}

export default function PromotionCodeForm({
  mode,
  values,
  busy,
  isGeneratingCode = false,
  codeReadOnly = false,
  onChange,
  onGenerateCode,
  onSubmit,
}: Props) {
  const previewText = buildBillingPromotionCreatePreview(values)
  const freeMonthsPreview =
    values.discountType === 'free_months'
      ? `${Math.min(BILLING_PROMOTION_FREE_MONTHS_MAX, Math.max(BILLING_PROMOTION_FREE_MONTHS_MIN, Math.floor(values.freeMonths) || BILLING_PROMOTION_DEFAULT_FREE_MONTHS))}개월 무료`
      : ''

  return (
    <div className="promotion-code-form-grid">
      <FieldWrapper label="코드" className="promotion-code-field">
        <div className="promotion-code-input-row">
          <FormInput
            value={values.code}
            readOnly={codeReadOnly}
            onChange={(e) =>
              onChange({ ...values, code: normalizeBillingPromotionCodeInput(e.target.value) })
            }
            placeholder="예: YJASSET-FREE-3M"
          />
          {onGenerateCode && !codeReadOnly ? (
            <FormButton
              htmlType="button"
              variant="secondary"
              disabled={isGeneratingCode || busy}
              onClick={onGenerateCode}
            >
              {isGeneratingCode ? '생성 중…' : '자동생성'}
            </FormButton>
          ) : null}
        </div>
      </FieldWrapper>
      <FieldWrapper label="코드 이름" className="promotion-code-field">
        <FormInput
          value={values.name}
          onChange={(e) => onChange({ ...values, name: e.target.value })}
          placeholder="예: 영진에셋 3개월 무료"
        />
      </FieldWrapper>
      <FieldWrapper label="혜택 유형" className="promotion-code-field">
        <FormSelect
          value={values.discountType}
          options={DISCOUNT_TYPE_OPTIONS}
          onChange={(e) =>
            onChange({ ...values, discountType: e.target.value as BillingPromotionDiscountUiType })
          }
        />
      </FieldWrapper>
      {needsBillingPromotionAmountField(values.discountType) ? (
        <FieldWrapper label="할인 금액(공급가)" className="promotion-code-field">
          <FormInput
            inputMode="numeric"
            value={values.discountAmount}
            onChange={(e) => onChange({ ...values, discountAmount: Number(e.target.value) || 0 })}
          />
        </FieldWrapper>
      ) : null}
      {needsBillingPromotionPercentField(values.discountType) ? (
        <FieldWrapper label="할인율(%)" className="promotion-code-field">
          <FormInput
            inputMode="numeric"
            value={values.discountPercent}
            onChange={(e) => onChange({ ...values, discountPercent: Number(e.target.value) || 0 })}
          />
        </FieldWrapper>
      ) : null}
      {needsBillingPromotionFreeMonthsField(values.discountType) ? (
        <FieldWrapper label="무료 개월 수" className="promotion-code-field">
          <FormInput
            inputMode="numeric"
            min={BILLING_PROMOTION_FREE_MONTHS_MIN}
            max={BILLING_PROMOTION_FREE_MONTHS_MAX}
            value={values.freeMonths}
            onChange={(e) => onChange({ ...values, freeMonths: Number(e.target.value) || 0 })}
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
          value={values.maxRedemptions ?? ''}
          onChange={(e) =>
            onChange({
              ...values,
              maxRedemptions: e.target.value.trim() === '' ? null : Number(e.target.value),
            })
          }
        />
      </FieldWrapper>
      <FieldWrapper label="적용 대상" className="promotion-code-field">
        <FormSelect
          value={values.applyTarget}
          options={APPLY_TARGET_OPTIONS}
          onChange={(e) =>
            onChange({ ...values, applyTarget: e.target.value as BillingPromotionApplyTarget })
          }
        />
      </FieldWrapper>
      <FieldWrapper label="메모" className="promotion-code-field promotion-code-field--full">
        <FormInput value={values.memo} onChange={(e) => onChange({ ...values, memo: e.target.value })} />
      </FieldWrapper>
      {previewText ? (
        <p className="promotion-code-preview promotion-code-field--full status">{previewText}</p>
      ) : null}
      <div className="promotion-code-actions promotion-code-field--full">
        <FormButton htmlType="button" variant="primary" disabled={busy} onClick={onSubmit}>
          {mode === 'create' ? '생성' : '저장'}
        </FormButton>
      </div>
    </div>
  )
}
