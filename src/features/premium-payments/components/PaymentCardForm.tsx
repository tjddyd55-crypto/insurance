import { FormInput } from '../../../components/form'
import type { CardFormState } from '../hooks/useCustomerPremiumPaymentsState'
import type { FormStateSetter } from './CardPaymentFormDialog'

type Props = {
  value: CardFormState
  onChange: FormStateSetter<CardFormState>
  editing: boolean
  ownerPlaceholder?: string
}

/** 카드정보 등록/수정 필드 그리드 */
export function PaymentCardForm({ value, onChange, editing, ownerPlaceholder }: Props) {
  return (
    <>
      <label className="premium-payments-field">
        <span className="premium-payments-field__label">카드 구분명</span>
        <FormInput
          value={value.label}
          onChange={(e) => onChange((prev) => ({ ...prev, label: e.target.value }))}
          placeholder="예: 본인카드"
        />
      </label>
      <label className="premium-payments-field">
        <span className="premium-payments-field__label">
          카드 소유주
          <span className="premium-payments-required" aria-hidden="true">
            *
          </span>
        </span>
        <FormInput
          value={value.cardOwnerName}
          onChange={(e) => onChange((prev) => ({ ...prev, cardOwnerName: e.target.value }))}
          placeholder={ownerPlaceholder || '카드 소유주 입력'}
          required
        />
      </label>
      <div className="premium-payments-form__card-number-row">
        <label className="premium-payments-field premium-payments-field--card-number">
          <span className="premium-payments-field__label">
            카드번호{editing ? ' (변경 시에만 입력)' : ''}
            {!editing ? (
              <span className="premium-payments-required" aria-hidden="true">
                *
              </span>
            ) : null}
          </span>
          <FormInput
            value={value.cardNumber}
            onChange={(e) => onChange((prev) => ({ ...prev, cardNumber: e.target.value }))}
            placeholder="숫자만 입력하거나 붙여넣기"
            required={!editing}
            autoComplete="off"
            inputMode="numeric"
          />
        </label>
        <label className="premium-payments-field premium-payments-field--expiry-month">
          <span className="premium-payments-field__label">
            유효기간 월
            <span className="premium-payments-required" aria-hidden="true">
              *
            </span>
          </span>
          <FormInput
            value={value.cardExpiryMonth}
            onChange={(e) => onChange((prev) => ({ ...prev, cardExpiryMonth: e.target.value }))}
            placeholder="MM"
            required
            inputMode="numeric"
            maxLength={2}
          />
        </label>
        <label className="premium-payments-field premium-payments-field--expiry-year">
          <span className="premium-payments-field__label">
            유효기간 연
            <span className="premium-payments-required" aria-hidden="true">
              *
            </span>
          </span>
          <FormInput
            value={value.cardExpiryYear}
            onChange={(e) => onChange((prev) => ({ ...prev, cardExpiryYear: e.target.value }))}
            placeholder="YYYY"
            required
            inputMode="numeric"
            maxLength={4}
          />
        </label>
      </div>
    </>
  )
}
