import type { Dispatch, SetStateAction } from 'react'
import { InsuranceInline } from '../../../../components/customer/CustomerForm'
import {
  AddressSearchField,
  FormInput,
  FormTextarea,
  type AddressSearchValue,
} from '../../../../components/form'
import { resolveReferrerNameForSave } from '../../config/customerInflowSource.config'
import { CUSTOMER_INSURANCE_HISTORY_PLACEHOLDER } from '../../utils/customerDisplayFormat'
import type { CustomerBasicCoreFormDraft } from '../../utils/customerBasicCoreSaveUtils'
import { resolveGenderAfterSsnInput } from '../../utils/inferGenderFromResidentNumberDigits'
import { CustomerAccountNumberField } from '../CustomerAccountNumberField'
import CustomerInflowSourceFields from '../CustomerInflowSourceFields'
import CustomerMedicalHistoryFields from '../CustomerMedicalHistoryFields'
import CustomerMobileCarrierSelect from '../CustomerMobileCarrierSelect'
import { CustomerDrivingRadioGroup } from '../CustomerDrivingRadioGroup'
import { CustomerFormSection } from '../CustomerFormSection'
import { CustomerSmsOptOutField } from '../CustomerSmsOptOutField'

export type CustomerBasicCoreEditFieldsProps = {
  customerId: number
  draft: CustomerBasicCoreFormDraft
  setDraft: Dispatch<SetStateAction<CustomerBasicCoreFormDraft>>
  addressValue: AddressSearchValue
  onAddressChange: (next: AddressSearchValue) => void
  disabled?: boolean
  inline?: boolean
}

export function CustomerBasicCoreEditFields({
  customerId,
  draft,
  setDraft,
  addressValue,
  onAddressChange,
  disabled = false,
  inline = false,
}: CustomerBasicCoreEditFieldsProps) {
  const patch = (next: Partial<CustomerBasicCoreFormDraft>) => {
    setDraft((prev) => ({ ...prev, ...next }))
  }

  return (
    <div
      className={`customer-basic-core-edit-fields${
        inline ? ' customer-basic-core-edit-fields--inline' : ' customer-quick-form-dialog__fields'
      }`}
    >
      <div className="customer-form-compact-grid field--wide">
        <label className="field">
          <span className="field__label">이름</span>
          <FormInput
            className="field__control"
            value={draft.name}
            disabled={disabled}
            onChange={(e) => patch({ name: e.target.value })}
          />
        </label>
        <div className="field customer-form-field--gender">
          <span className="field__label">성별</span>
          <div className="customer-form-gender-options" role="radiogroup" aria-label="성별">
            <label>
              <FormInput
                type="radio"
                name={`gender-basic-${customerId}`}
                checked={draft.gender === 'male'}
                disabled={disabled}
                onChange={() => patch({ gender: 'male' })}
              />{' '}
              남
            </label>
            <label>
              <FormInput
                type="radio"
                name={`gender-basic-${customerId}`}
                checked={draft.gender === 'female'}
                disabled={disabled}
                onChange={() => patch({ gender: 'female' })}
              />{' '}
              여
            </label>
          </div>
        </div>
        <label className="field">
          <span className="field__label">주민번호</span>
          <FormInput
            className="field__control"
            format="residentNumber"
            value={draft.ssn}
            disabled={disabled}
            onChange={(e) => {
              const next = e.target.value
              patch({
                ssn: next,
                gender: resolveGenderAfterSsnInput(draft.gender, next),
              })
            }}
          />
        </label>
        <label className="field">
          <span className="field__label">전화번호</span>
          <FormInput
            className="field__control"
            format="phone"
            value={draft.phone}
            disabled={disabled}
            onChange={(e) => patch({ phone: e.target.value })}
          />
        </label>
        <label className="field">
          <span className="field__label">통신사</span>
          <CustomerMobileCarrierSelect
            value={draft.carrier}
            onChange={(value) => patch({ carrier: value })}
          />
        </label>
        <CustomerSmsOptOutField
          checked={draft.smsOptOut === true}
          onChange={(checked) => patch({ smsOptOut: checked })}
        />
        <CustomerInflowSourceFields
          inflowSource={draft.inflowSource}
          referrerName={draft.referrerName}
          onInflowSourceChange={(value) =>
            patch({
              inflowSource: value,
              referrerName: resolveReferrerNameForSave(value, draft.referrerName)
                ? draft.referrerName
                : '',
            })
          }
          onReferrerNameChange={(value) => patch({ referrerName: value })}
        />
        <InsuranceInline ssn={draft.ssn} />
        <label className="field">
          <span className="field__label">키</span>
          <FormInput
            className="field__control"
            value={draft.height}
            disabled={disabled}
            onChange={(e) => patch({ height: e.target.value })}
          />
        </label>
        <label className="field">
          <span className="field__label">몸무게</span>
          <FormInput
            className="field__control"
            value={draft.weight}
            disabled={disabled}
            onChange={(e) => patch({ weight: e.target.value })}
          />
        </label>
        <label className="field field--wide">
          <span className="field__label">직업 / 회사명 / 하는 일 / 지역</span>
          <FormInput
            className="field__control"
            value={draft.job}
            disabled={disabled}
            onChange={(e) => patch({ job: e.target.value })}
          />
        </label>
        <div className="field field--wide customer-form-field--driving">
          <span className="field__label">운전 여부</span>
          <CustomerDrivingRadioGroup
            name={`driver-basic-${customerId}`}
            value={draft.isDriver}
            disabled={disabled}
            onChange={(next) => patch({ isDriver: next })}
          />
        </div>
      </div>
      <label className="field field--wide">
        <span className="field__label">주소</span>
        <AddressSearchField
          className="address-search-field"
          value={addressValue}
          disabled={disabled}
          onChange={onAddressChange}
        />
      </label>
      <CustomerFormSection title="건강/보험 참고" className="field field--wide">
        <CustomerMedicalHistoryFields
          treatmentHistoryNote={draft.treatmentHistoryNote}
          medicationHistoryNote={draft.medicationHistoryNote}
          onTreatmentChange={(value) => patch({ treatmentHistoryNote: value })}
          onMedicationChange={(value) => patch({ medicationHistoryNote: value })}
        />
      </CustomerFormSection>
      <CustomerFormSection title="보험 가입" className="field field--wide">
        <FormTextarea
          className="field__control customer-form-textarea customer-form-textarea--large customer-textarea--insurance-history"
          rows={4}
          placeholder={CUSTOMER_INSURANCE_HISTORY_PLACEHOLDER}
          aria-label="보험가입내역"
          value={draft.insuranceHistory}
          disabled={disabled}
          onChange={(e) => patch({ insuranceHistory: e.target.value })}
        />
      </CustomerFormSection>
      <CustomerFormSection title="계좌" className="field field--wide">
        <CustomerAccountNumberField
          value={draft.accountNumber}
          disabled={disabled}
          onChange={(next) => patch({ accountNumber: next })}
          idSuffix={`basic-${customerId}`}
        />
      </CustomerFormSection>
    </div>
  )
}
