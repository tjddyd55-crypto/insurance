import { useMemo, useState } from 'react'

import { useAuth } from '../../features/auth/AuthProvider'

import { saveCustomer } from '../../features/customers/api/customersApi'

import type { SaveCustomerPayload } from '../../features/customers/api/customersApi'

import type { CustomerNote } from '../../features/customers/domain/types'

import {

  NOTE_MAX_LENGTH,

  calculateInsuranceInfo,

  formatInsuranceUiDate,

} from '../../features/customers/utils/insuranceInfo'



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

      <p className="customer-insurance-hint" style={{ margin: '4px 0 0' }}>

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

  address: string

  height: string

  weight: string

  job: string

  isDriver: boolean | null

  carType: string

  medical: string

  notes: CustomerNote[]

  noteDraft: string

}



const EMPTY_FORM: CustomerFormState = {

  name: '',

  gender: null,

  ssn: '',

  phone: '',

  address: '',

  height: '',

  weight: '',

  job: '',

  isDriver: null,

  carType: '',

  medical: '',

  notes: [],

  noteDraft: '',

}



export function createEmptyCustomerForm(): CustomerFormState {

  return {

    ...EMPTY_FORM,

    notes: [],

    noteDraft: '',

  }

}



/** 저장/전송 전 검증 — 통과 시 null (필수: 이름, 주민번호만) */

export function getCustomerFormValidationError(form: CustomerFormState): string | null {
  if (!form.name?.trim()) {
    return '이름을 입력해주세요'
  }
  if (!form.ssn?.trim()) {
    return '주민번호를 입력해주세요'
  }
  return null
}



export function customerFormStateToSavePayload(form: CustomerFormState): SaveCustomerPayload {

  const name = form.name.trim()

  return {

    name,

    ssn: form.ssn,

    phone: form.phone,

    carrier: '',

    address: form.address,

    height: form.height,

    weight: form.weight,

    job: form.job,

    driving: drivingText(form.isDriver),

    medical: form.medical,

    gender: form.gender,

    isDriver: form.isDriver,

    carType: form.isDriver === true ? form.carType.trim() : '',

    notes: form.notes,

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

      <label className="field">

        <span className="field__label">이름</span>

        <input

          className="field__control"

          placeholder="이름"

          value={form.name}

          onChange={(e) => onFormChange({ ...form, name: e.target.value })}

        />

      </label>

      <div className="field field--wide">

        <span className="field__label">성별</span>

        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: 4 }}>

          <label>

            <input

              type="radio"

              name={`gender-${radioSuffix}`}

              checked={form.gender === 'male'}

              onChange={() => onFormChange({ ...form, gender: 'male' })}

            />{' '}

            남

          </label>

          <label>

            <input

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

        <input

          className="field__control"

          placeholder="주민번호"

          value={form.ssn}

          onChange={(e) => onFormChange({ ...form, ssn: e.target.value })}

        />

      </label>

      <InsuranceInline ssn={form.ssn} />

      <label className="field">

        <span className="field__label">전화번호</span>

        <input

          className="field__control"

          placeholder="전화번호"

          value={form.phone}

          onChange={(e) => onFormChange({ ...form, phone: e.target.value })}

        />

      </label>

      <label className="field field--wide">

        <span className="field__label">주소</span>

        <input

          className="field__control"

          placeholder="주소"

          value={form.address}

          onChange={(e) => onFormChange({ ...form, address: e.target.value })}

        />

      </label>

      <label className="field">

        <span className="field__label">키</span>

        <input

          className="field__control"

          placeholder="키"

          value={form.height}

          onChange={(e) => onFormChange({ ...form, height: e.target.value })}

        />

      </label>

      <label className="field">

        <span className="field__label">몸무게</span>

        <input

          className="field__control"

          placeholder="몸무게"

          value={form.weight}

          onChange={(e) => onFormChange({ ...form, weight: e.target.value })}

        />

      </label>

      <label className="field field--wide">

        <span className="field__label">직업 / 회사명 / 하는 일 / 지역</span>

        <input

          className="field__control"

          placeholder="직업·회사 등"

          value={form.job}

          onChange={(e) => onFormChange({ ...form, job: e.target.value })}

        />

      </label>

      <div className="field field--wide">

        <span className="field__label">운전 여부</span>

        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: 4 }}>

          <label>

            <input

              type="radio"

              name={`driver-${radioSuffix}`}

              checked={form.isDriver === true}

              onChange={() => onFormChange({ ...form, isDriver: true })}

            />{' '}

            운전함

          </label>

          <label>

            <input

              type="radio"

              name={`driver-${radioSuffix}`}

              checked={form.isDriver === false}

              onChange={() => onFormChange({ ...form, isDriver: false, carType: '' })}

            />{' '}

            운전 안함

          </label>

        </div>

      </div>

      {form.isDriver === true ? (

        <label className="field field--wide">

          <span className="field__label">차종</span>

          <input

            className="field__control"

            type="text"

            placeholder="예: 승용차, SUV, 1톤 트럭"

            value={form.carType}

            onChange={(e) => onFormChange({ ...form, carType: e.target.value })}

          />

        </label>

      ) : null}

      <label className="field field--wide">

        <span className="field__label">5년 이내 진단·수술·치료 (건강 고지)</span>

        <textarea

          className="field__control"

          rows={3}

          placeholder="내용"

          value={form.medical}

          onChange={(e) => onFormChange({ ...form, medical: e.target.value })}

        />

      </label>

      <div className="field field--wide">

        <span className="field__label">메모 (최대 {NOTE_MAX_LENGTH}자, Enter로 추가)</span>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 4 }}>

          <input

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

          <button

            className="button button--secondary"

            type="button"

            onClick={() => pushDraftNoteFixed(form.noteDraft)}

          >

            추가

          </button>

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

                  <small style={{ opacity: 0.75 }}>{new Date(note.createdAt).toLocaleString('ko-KR')}</small>

                </div>

                <button

                  type="button"

                  className="delete-btn"

                  onClick={() =>

                    onFormChange({ ...form, notes: form.notes.filter((n) => n.id !== note.id) })

                  }

                >

                  삭제

                </button>

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

  const [form, setForm] = useState<CustomerFormState>(() => createEmptyCustomerForm())



  async function handleSubmit() {

    const err = getCustomerFormValidationError(form)

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

      await saveCustomer(token, payload)

      window.alert('저장 완료')

      setForm(createEmptyCustomerForm())

      onStatusMessage?.('저장했습니다.')

      onInternalSaveSuccess?.()

    } catch (e) {

      onStatusMessage?.(e instanceof Error ? e.message : '저장에 실패했습니다.')

    }

  }



  return (

    <>

      <h2 className="dashboard-section-title">신규 고객</h2>

      <CustomerFormFields

        form={form}

        onFormChange={setForm}

        radioSuffix="internal"

        onStatusMessage={onStatusMessage}

      />

      <button className="button button--primary button--full" type="button" onClick={handleSubmit}>

        저장

      </button>

    </>

  )

}


