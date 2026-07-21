/* eslint-disable react-refresh/only-export-components */
import { useMemo, useState } from 'react'

import { useAuth } from '../../features/auth/AuthProvider'
import {
  AddressSearchField,
  FormButton,
  FormInput,
  FormTextarea,
  formatAddressForSave,
  type AddressSearchValue,
} from '../form'
import { resolveReferrerNameForSave } from '../../features/customers/config/customerInflowSource.config'
import CustomerInflowSourceFields from '../../features/customers/components/CustomerInflowSourceFields'

import { saveCustomer } from '../../features/customers/api/customersApi'
import { saveCustomerCarsForCustomer } from '../../features/customers/utils/customerCarsSaveUtils'

import type { SaveCustomerPayload } from '../../features/customers/api/customersApi'

import type { CustomerNote } from '../../features/customers/domain/types'
import { formatKstDateTimeDisplay } from '../../utils/displayDateTime'
import {
  buildCrmExtensionPayloadForSave,
  normalizeBirthDateForSaveApi,
} from '../../features/customers/domain/crmExtension'

import {

  NOTE_MAX_LENGTH,

  calculateInsuranceInfo,

  formatInsuranceUiDate,

} from '../../features/customers/utils/insuranceInfo'
import CustomerMedicalHistoryFields from '../../features/customers/components/CustomerMedicalHistoryFields'
import CustomerMobileCarrierSelect from '../../features/customers/components/CustomerMobileCarrierSelect'
import { normalizeCustomerCarrierForSave } from '../../features/customers/config/customerMobileCarrier.config'
import {
  CUSTOMER_INSURANCE_HISTORY_PLACEHOLDER,
} from '../../features/customers/utils/customerDisplayFormat'
import { buildLegacyMedicalColumnValue } from '../../features/customers/utils/customerMedicalHistory'
import { resolveGenderAfterSsnInput } from '../../features/customers/utils/inferGenderFromResidentNumberDigits'
import CustomerIndustryTemplateFields from '../../features/customers/components/CustomerIndustryTemplateFields'
import { CustomerCarsEditor } from '../../features/customers/components/CustomerCarsEditor'
import { CustomerSpecialDatesEditor } from '../../features/customers/components/CustomerSpecialDatesEditor'
import { CustomerDrivingRadioGroup } from '../../features/customers/components/CustomerDrivingRadioGroup'
import { CustomerFormSection } from '../../features/customers/components/CustomerFormSection'
import { CustomerAccountNumberField } from '../../features/customers/components/CustomerAccountNumberField'
import { CustomerSmsOptOutField } from '../../features/customers/components/CustomerSmsOptOutField'
import { useCustomerCrmIndustryContext } from '../../features/customers/hooks/useCustomerCrmIndustryContext'
import { getCustomerIndustryTemplateFormValidationError } from '../../features/customers/utils/customerIndustryTemplateFormValidation'
import type { CustomerCarFormItem } from '../../features/customers/types/customerCarForm'
import type { CustomerSpecialDateFormItem } from '../../features/customers/types/customerSpecialDateForm'
import {
  createEmptyCustomerCar,
  normalizeCustomerCarsForSave,
  pickPrimaryCustomerCar,
} from '../../features/customers/utils/customerCarFormUtils'
import { getCustomerSpecialDatesValidationError } from '../../features/customers/utils/customerSpecialDateFormUtils'
import { saveCustomerSpecialDatesForCustomer } from '../../features/customers/utils/customerSpecialDatesSaveUtils'



export function drivingText(isDriver: boolean | null): string {

  if (isDriver === true) {

    return '운전함'

  }

  if (isDriver === false) {

    return '운전 안함'

  }

  return ''

}



export function InsuranceInline({ ssn }: { ssn: string }) {

  const { age, nextAgeDate } = useMemo(() => calculateInsuranceInfo(ssn), [ssn])

  const ok = age != null && nextAgeDate != null && !Number.isNaN(nextAgeDate.getTime())

  return (

    <div className="field field--wide">

      <span className="field__label">보험나이 · 상령일 (자동)</span>

      <p className="customer-insurance-hint">

        {ok ? (

          <>

            보험나이: {age}세 · 상령일: {formatInsuranceUiDate(nextAgeDate)}

          </>

        ) : (

          <>보험나이: 계산 불가 · 상령일: 계산 불가</>

        )}

      </p>

    </div>

  )

}



export function DetailInsurance({ ssn }: { ssn: string }) {

  const { age, nextAgeDate } = useMemo(() => calculateInsuranceInfo(ssn), [ssn])

  const ok = age != null && nextAgeDate != null && !Number.isNaN(nextAgeDate.getTime())

  if (ok) {

    return (

      <p>

        <strong>보험나이 · 상령일:</strong> {age}세 · {formatInsuranceUiDate(nextAgeDate)}

      </p>

    )

  }

  return (

    <p>

      <strong>보험나이 · 상령일:</strong> 계산 불가 · 계산 불가

    </p>

  )

}



export type CustomerFormState = {

  name: string

  gender: 'male' | 'female' | null

  ssn: string

  phone: string

  /** 통신사 등 — customers.carrier */
  carrier: string

  /** 생년월일 YYYY-MM-DD — customers.birth_date */
  birthDate: string

  /**
   * 기본주소 — 카카오(다음) 우편번호 서비스로 선택된 도로명/지번 주소.
   * 사용자가 타이핑으로 수정할 수 없도록 UI 에서 readonly 로 고정.
   */
  address: string

  /** 상세주소 — 동/호수 등 자유 입력. 저장 시 address 뒤에 공백으로 합친다. */
  addressDetail: string

  /** 우편번호(zonecode). 검색 결과로만 채워진다. */
  zonecode: string

  height: string

  weight: string

  job: string

  isDriver: boolean | null

  /** 레거시 DB 컬럼 — UI 제거, 신규 등록 시 빈 문자열 */
  carType: string

  cars: CustomerCarFormItem[]

  specialDates: CustomerSpecialDateFormItem[]

  treatmentHistoryNote: string

  medicationHistoryNote: string

  /** 보험가입내역 — notes.jsonb.insuranceHistory 로 저장 */
  insuranceHistory: string

  /** 계좌번호 — notes.jsonb.accountNumber 로 저장(자유 텍스트) */
  accountNumber: string

  notes: CustomerNote[]

  noteDraft: string

  /**
   * 업종 확장 저장소 — 서버 customers.crm_extension.fields (government / gym SSOT 키)
   */
  crmExtensionFields: Record<string, string>

  /** 유입 경로 — 빈 문자열은 미지정 */
  inflowSource: string

  /** 유입 경로 상세(소개자·이관한 사람) — referrer_name 재사용 */
  referrerName: string

  /** CRM 문자(단체/예약/자동) 수신거부 */
  smsOptOut: boolean

}



const EMPTY_FORM: CustomerFormState = {

  name: '',

  gender: null,

  ssn: '',

  phone: '',

  carrier: '',

  birthDate: '',

  address: '',

  addressDetail: '',

  zonecode: '',

  height: '',

  weight: '',

  job: '',

  isDriver: null,

  carType: '',

  cars: [],

  specialDates: [],

  treatmentHistoryNote: '',

  medicationHistoryNote: '',

  insuranceHistory: '',

  accountNumber: '',

  notes: [],

  noteDraft: '',

  crmExtensionFields: {},

  inflowSource: '',

  referrerName: '',

  smsOptOut: false,

}



export function createEmptyCustomerForm(): CustomerFormState {

  return {

    ...EMPTY_FORM,

    notes: [],

    noteDraft: '',

    cars: [{ ...createEmptyCustomerCar(), isPrimary: true }],

    specialDates: [],

  }

}

/** 보험 외 업종 신규 등록: 차량 기본 행 없음(레거시 API는 그대로, 차량 저장 스킵). */
export function createEmptyIndustryCustomerForm(): CustomerFormState {
  return {
    ...EMPTY_FORM,
    notes: [],
    noteDraft: '',
    cars: [],
  }
}



/** 저장/전송 전 검증 — 통과 시 null (필수: 이름만) */

export function getCustomerFormValidationError(form: CustomerFormState): string | null {
  if (!form.name?.trim()) {
    return '이름은 필수입니다.'
  }
  return getCustomerSpecialDatesValidationError(form.specialDates)
}



export function customerFormStateToSavePayload(form: CustomerFormState): SaveCustomerPayload {

  const name = form.name.trim()

  const birthDateOpt = normalizeBirthDateForSaveApi(form.birthDate)

  const extOpt = buildCrmExtensionPayloadForSave(form.crmExtensionFields)

  /*
   * 서버 스키마의 customers.address 는 단일 문자열 컬럼이다. UI 는 "우편번호 / 기본주소 / 상세주소"
   * 로 분리 입력을 받지만, 직렬화 단계에서 formatAddressForSave 로 "(zip) 기본주소 상세주소"
   * 단일 문자열로 합쳐 보낸다. 향후 스키마가 분리되면 이 한 줄만 바꾸면 된다.
   */
  const mergedAddress = formatAddressForSave({
    zonecode: form.zonecode,
    baseAddress: form.address,
    detailAddress: form.addressDetail,
  })

  const normalizedCars = normalizeCustomerCarsForSave(form.cars)
  const primaryCar = pickPrimaryCustomerCar(normalizedCars)

  return {

    name,

    ssn: form.ssn,

    phone: form.phone,

    carrier: normalizeCustomerCarrierForSave(form.carrier),

    address: mergedAddress,

    height: form.height,

    weight: form.weight,

    job: form.job,

    driving: drivingText(form.isDriver),

    medical: buildLegacyMedicalColumnValue(form.treatmentHistoryNote, form.medicationHistoryNote),

    gender: form.gender,

    isDriver: form.isDriver,

    carType: form.carType.trim(),

    carNumber: (primaryCar?.carNumber ?? '').trim(),

    carModel: (primaryCar?.carModel ?? '').trim(),

    carYear: (primaryCar?.carYear ?? '').trim(),

    renewalDate: (primaryCar?.renewalDate ?? '').trim(),

    cars: normalizedCars,

    notes: {
      items: form.notes,
      insuranceHistory: form.insuranceHistory.trim(),
      accountNumber: form.accountNumber.trim(),
      treatmentHistoryNote: form.treatmentHistoryNote.trim(),
      medicationHistoryNote: form.medicationHistoryNote.trim(),
    },

    ...(birthDateOpt != null ? { birthDate: birthDateOpt } : {}),

    ...(extOpt ? { crmExtension: extOpt } : {}),

    inflowSource: form.inflowSource.trim() || null,

    referrerName: resolveReferrerNameForSave(form.inflowSource, form.referrerName),

    smsOptOut: form.smsOptOut === true,

  }

}



export type CustomerFormFieldsProps = {

  form: CustomerFormState

  onFormChange: (next: CustomerFormState) => void

  radioSuffix: string

  onStatusMessage?: (message: string) => void

}



export function CustomerFormFields({ form, onFormChange, radioSuffix, onStatusMessage }: CustomerFormFieldsProps) {

  function pushDraftNoteFixed(draft: string) {

    const trimmed = draft.trim()

    if (!trimmed) {

      return

    }

    if (trimmed.length > NOTE_MAX_LENGTH) {

      onStatusMessage?.(`메모는 ${NOTE_MAX_LENGTH}자 이하로 입력해주세요.`)

      return

    }

    const newNote: CustomerNote = {

      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,

      content: trimmed,

      createdAt: new Date().toISOString(),

    }

    onFormChange({

      ...form,

      notes: [newNote, ...form.notes],

      noteDraft: '',

    })

    onStatusMessage?.('')

  }



  return (

    <div className="field-grid-customers">

      <div className="customer-form-compact-grid field--wide">

      <label className="field">

        <span className="field__label">이름</span>

        <FormInput
          className="field__control"
          placeholder="이름"
          value={form.name}
          onChange={(e) => onFormChange({ ...form, name: e.target.value })}
        />

      </label>

      <div className="field customer-form-field--gender">

        <span className="field__label">성별</span>

        <div className="customer-form-gender-options" role="radiogroup" aria-label="성별">

          <label>

            <FormInput

              type="radio"

              name={`gender-${radioSuffix}`}

              checked={form.gender === 'male'}

              onChange={() => onFormChange({ ...form, gender: 'male' })}

            />{' '}

            남

          </label>

          <label>

            <FormInput

              type="radio"

              name={`gender-${radioSuffix}`}

              checked={form.gender === 'female'}

              onChange={() => onFormChange({ ...form, gender: 'female' })}

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
          value={form.ssn}
          onChange={(e) => {
            const next = e.target.value
            onFormChange({
              ...form,
              ssn: next,
              gender: resolveGenderAfterSsnInput(form.gender, next),
            })
          }}
        />

      </label>

      <label className="field">

        <span className="field__label">전화번호</span>

        <FormInput
          className="field__control"
          format="phone"
          value={form.phone}
          onChange={(e) => onFormChange({ ...form, phone: e.target.value })}
        />

      </label>

      <label className="field">
        <span className="field__label">통신사</span>
        <CustomerMobileCarrierSelect
          value={form.carrier}
          onChange={(value) => onFormChange({ ...form, carrier: value })}
        />
      </label>

      <CustomerSmsOptOutField
        checked={form.smsOptOut === true}
        onChange={(checked) => onFormChange({ ...form, smsOptOut: checked })}
      />

      <CustomerInflowSourceFields
        inflowSource={form.inflowSource}
        referrerName={form.referrerName}
        onInflowSourceChange={(value) =>
          onFormChange({
            ...form,
            inflowSource: value,
            referrerName: resolveReferrerNameForSave(value, form.referrerName) ? form.referrerName : '',
          })
        }
        onReferrerNameChange={(value) => onFormChange({ ...form, referrerName: value })}
      />

      <InsuranceInline ssn={form.ssn} />

      <label className="field">

        <span className="field__label">키</span>

        <FormInput
          className="field__control"
          placeholder="키"
          value={form.height}
          onChange={(e) => onFormChange({ ...form, height: e.target.value })}
        />

      </label>

      <label className="field">

        <span className="field__label">몸무게</span>

        <FormInput
          className="field__control"
          placeholder="몸무게"
          value={form.weight}
          onChange={(e) => onFormChange({ ...form, weight: e.target.value })}
        />

      </label>

      <label className="field field--wide">

        <span className="field__label">직업 / 회사명 / 하는 일 / 지역</span>

        <FormInput
          className="field__control"
          placeholder="직업·회사 등"
          value={form.job}
          onChange={(e) => onFormChange({ ...form, job: e.target.value })}
        />

      </label>

      <div className="field field--wide customer-form-field--driving">

        <span className="field__label">운전 여부</span>

        <CustomerDrivingRadioGroup
          name={`driver-${radioSuffix}`}
          value={form.isDriver}
          onChange={(next) => onFormChange({ ...form, isDriver: next })}
        />

      </div>

      </div>

      <div className="field field--wide">

        <span className="field__label">주소</span>

        <AddressSearchField
          className="address-search-field"
          value={{
            zonecode: form.zonecode,
            baseAddress: form.address,
            detailAddress: form.addressDetail,
          }}
          onChange={(next: AddressSearchValue) =>
            onFormChange({
              ...form,
              zonecode: next.zonecode,
              address: next.baseAddress,
              addressDetail: next.detailAddress,
            })
          }
        />

      </div>

      <CustomerCarsEditor

        cars={form.cars}

        onChange={(next) => onFormChange({ ...form, cars: next })}

      />

      <CustomerSpecialDatesEditor
        specialDates={form.specialDates}
        onChange={(next) => onFormChange({ ...form, specialDates: next })}
      />

      <CustomerMedicalHistoryFields
        treatmentHistoryNote={form.treatmentHistoryNote}
        medicationHistoryNote={form.medicationHistoryNote}
        onTreatmentChange={(value) => onFormChange({ ...form, treatmentHistoryNote: value })}
        onMedicationChange={(value) => onFormChange({ ...form, medicationHistoryNote: value })}
      />

      <CustomerFormSection title="보험가입내역" className="field field--wide">
        <label className="customer-form-section__solo">
          <FormTextarea

            className="field__control customer-form-textarea customer-form-textarea--large customer-textarea--insurance-history"

            rows={4}

            placeholder={CUSTOMER_INSURANCE_HISTORY_PLACEHOLDER}
            aria-label="보험가입내역"

            value={form.insuranceHistory}

            onChange={(e) => onFormChange({ ...form, insuranceHistory: e.target.value })}

          />
        </label>
      </CustomerFormSection>

      <CustomerFormSection title="계좌번호" className="field field--wide">
        <label className="customer-form-section__solo">
          <CustomerAccountNumberField
            value={form.accountNumber}
            onChange={(next) => onFormChange({ ...form, accountNumber: next })}
            idSuffix="create"
          />
        </label>
      </CustomerFormSection>

      <div className="field field--wide">

        <span className="field__label">메모 (최대 {NOTE_MAX_LENGTH}자, Enter로 추가)</span>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 4 }}>

          <FormInput
            className="field__control"
            style={{ flex: '1 1 220px' }}
            placeholder="메모 입력"
            value={form.noteDraft}
            maxLength={NOTE_MAX_LENGTH}
            onChange={(e) =>

              onFormChange({ ...form, noteDraft: e.target.value.slice(0, NOTE_MAX_LENGTH) })

            }

            onKeyDown={(e) => {

              if (e.key === 'Enter') {

                e.preventDefault()

                pushDraftNoteFixed(form.noteDraft)

              }

            }}
          />

          <FormButton
            className="filter-button"
            htmlType="button"
            variant="action"
            style={{ fontSize: '0.875rem', padding: '4px 10px' }}
            onClick={() => pushDraftNoteFixed(form.noteDraft)}
          >

            추가

          </FormButton>

        </div>

        {form.notes.length > 0 ? (

          <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0' }}>

            {form.notes.map((note) => (

              <li

                key={note.id}

                style={{

                  borderTop: '1px solid rgba(0,0,0,0.08)',

                  padding: '8px 0',

                  display: 'flex',

                  justifyContent: 'space-between',

                  gap: 8,

                  alignItems: 'flex-start',

                }}

              >

                <div>

                  <div>{note.content}</div>

                  <small style={{ opacity: 0.75 }}>{formatKstDateTimeDisplay(note.createdAt)}</small>

                </div>

                <FormButton
                  htmlType="button"
                  className="delete-btn"
                  variant="danger"
                  onClick={() =>

                    onFormChange({ ...form, notes: form.notes.filter((n) => n.id !== note.id) })

                  }
                >

                  삭제

                </FormButton>

              </li>

            ))}

          </ul>

        ) : null}

      </div>

    </div>

  )

}



export type CustomerFormProps = {

  onStatusMessage?: (message: string) => void

  onInternalSaveSuccess?: () => void

}



export function CustomerForm({ onStatusMessage, onInternalSaveSuccess }: CustomerFormProps) {

  const { token } = useAuth()
  const industryCtx = useCustomerCrmIndustryContext()

  const [form, setForm] = useState<CustomerFormState>(() =>
    industryCtx.isInsuranceLayout ? createEmptyCustomerForm() : createEmptyIndustryCustomerForm(),
  )



  async function handleSubmit() {

    const err = industryCtx.isInsuranceLayout
      ? getCustomerFormValidationError(form)
      : getCustomerIndustryTemplateFormValidationError(form, industryCtx.resolvedTemplate)

    if (err) {

      onStatusMessage?.(err)

      return

    }



    const payload = customerFormStateToSavePayload(form)



    try {

      if (!token) {

        onStatusMessage?.('로그인이 필요합니다.')

        return

      }

      const created = await saveCustomer(token, payload)

      if (industryCtx.isInsuranceLayout) {
        try {
          await saveCustomerCarsForCustomer({
            token,
            customerId: created.id,
            formCars: form.cars,
          })
        } catch {
          onStatusMessage?.(
            '고객 정보를 저장했습니다. 자동차 정보 일부 저장에 실패했습니다. 고객 수정 화면에서 다시 확인해 주세요.',
          )
          setForm(createEmptyCustomerForm())
          onInternalSaveSuccess?.()
          return
        }
        try {
          await saveCustomerSpecialDatesForCustomer({
            token,
            customerId: created.id,
            formItems: form.specialDates,
          })
        } catch {
          onStatusMessage?.(
            '고객 정보를 저장했습니다. 기념일 일부 저장에 실패했습니다. 고객 수정 화면에서 다시 확인해 주세요.',
          )
          setForm(createEmptyCustomerForm())
          onInternalSaveSuccess?.()
          return
        }
      }

      setForm(
        industryCtx.isInsuranceLayout ? createEmptyCustomerForm() : createEmptyIndustryCustomerForm(),
      )

      onStatusMessage?.('저장했습니다.')

      onInternalSaveSuccess?.()

    } catch (e) {

      onStatusMessage?.(e instanceof Error ? e.message : '저장에 실패했습니다.')

    }

  }



  return (
    <form
      className="customer-form-internal"
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        void handleSubmit()
      }}
    >
      <h2 className="dashboard-section-title">신규 고객</h2>

      {industryCtx.isInsuranceLayout ? (
        <CustomerFormFields
          form={form}
          onFormChange={setForm}
          radioSuffix="internal"
          onStatusMessage={onStatusMessage}
        />
      ) : (
        <CustomerIndustryTemplateFields
          template={industryCtx.resolvedTemplate}
          variant="create"
          radioSuffix="internal"
          value={form}
          onPatch={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
          onStatusMessage={onStatusMessage}
        />
      )}

      <FormButton className="button button--primary button--full" htmlType="submit" variant="primary">
        저장
      </FormButton>
    </form>
  )

}


