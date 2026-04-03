import { useMemo, useState } from 'react'
import { useAuth } from '../../features/auth/AuthProvider'
import { saveCustomer, saveCustomerExternal } from '../../features/customers/api/customersApi'
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

type CustomerFormState = {
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

export type CustomerFormProps = {
  mode: 'internal' | 'external'
  refUserId?: string
  onStatusMessage?: (message: string) => void
  onInternalSaveSuccess?: () => void
}

export function CustomerForm({ mode, refUserId = '', onStatusMessage, onInternalSaveSuccess }: CustomerFormProps) {
  const { token } = useAuth()
  const [form, setForm] = useState<CustomerFormState>(EMPTY_FORM)

  const radioSuffix = mode === 'internal' ? 'internal' : 'external'

  function pushDraftNote(
    draft: string,
    setNotes: (fn: (prev: CustomerNote[]) => CustomerNote[]) => void,
    clearDraft: () => void,
  ) {
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
    setNotes((prev) => [newNote, ...prev])
    clearDraft()
    onStatusMessage?.('')
  }

  async function submit() {
    const name = form.name.trim()
    if (!name) {
      onStatusMessage?.('이름은 필수입니다.')
      return
    }
    if (form.gender == null) {
      onStatusMessage?.('성별을 선택해주세요.')
      return
    }
    if (form.isDriver == null) {
      onStatusMessage?.('운전 여부를 선택해주세요.')
      return
    }
    if (form.isDriver === true && !form.carType.trim()) {
      onStatusMessage?.('차종을 입력해주세요.')
      return
    }

    const payload = {
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

    try {
      if (mode === 'internal') {
        if (!token) {
          onStatusMessage?.('로그인이 필요합니다.')
          return
        }
        await saveCustomer(token, payload)
        window.alert('저장 완료')
        setForm(EMPTY_FORM)
        onStatusMessage?.('저장했습니다.')
        onInternalSaveSuccess?.()
      } else {
        const ref = refUserId.trim()
        if (!ref) {
          onStatusMessage?.('유효하지 않은 링크입니다.')
          return
        }
        await saveCustomerExternal(ref, payload)
        window.alert('전송이 완료되었습니다.')
        setForm(EMPTY_FORM)
        onStatusMessage?.('정보가 전송되었습니다.')
      }
    } catch (e) {
      onStatusMessage?.(e instanceof Error ? e.message : mode === 'internal' ? '저장에 실패했습니다.' : '전송에 실패했습니다.')
    }
  }

  return (
    <>
      {mode === 'internal' ? <h2 className="dashboard-section-title">신규 고객</h2> : null}
      <div className="field-grid-customers">
        <label className="field">
          <span className="field__label">이름</span>
          <input
            className="field__control"
            placeholder="이름"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
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
                onChange={() => setForm({ ...form, gender: 'male' })}
              />{' '}
              남
            </label>
            <label>
              <input
                type="radio"
                name={`gender-${radioSuffix}`}
                checked={form.gender === 'female'}
                onChange={() => setForm({ ...form, gender: 'female' })}
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
            onChange={(e) => setForm({ ...form, ssn: e.target.value })}
          />
        </label>
        <InsuranceInline ssn={form.ssn} />
        <label className="field">
          <span className="field__label">전화번호</span>
          <input
            className="field__control"
            placeholder="전화번호"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </label>
        <label className="field field--wide">
          <span className="field__label">주소</span>
          <input
            className="field__control"
            placeholder="주소"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
        </label>
        <label className="field">
          <span className="field__label">키</span>
          <input
            className="field__control"
            placeholder="키"
            value={form.height}
            onChange={(e) => setForm({ ...form, height: e.target.value })}
          />
        </label>
        <label className="field">
          <span className="field__label">몸무게</span>
          <input
            className="field__control"
            placeholder="몸무게"
            value={form.weight}
            onChange={(e) => setForm({ ...form, weight: e.target.value })}
          />
        </label>
        <label className="field field--wide">
          <span className="field__label">직업 / 회사명 / 하는 일 / 지역</span>
          <input
            className="field__control"
            placeholder="직업·회사 등"
            value={form.job}
            onChange={(e) => setForm({ ...form, job: e.target.value })}
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
                onChange={() => setForm({ ...form, isDriver: true })}
              />{' '}
              운전함
            </label>
            <label>
              <input
                type="radio"
                name={`driver-${radioSuffix}`}
                checked={form.isDriver === false}
                onChange={() => setForm({ ...form, isDriver: false, carType: '' })}
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
              onChange={(e) => setForm({ ...form, carType: e.target.value })}
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
            onChange={(e) => setForm({ ...form, medical: e.target.value })}
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
                setForm({ ...form, noteDraft: e.target.value.slice(0, NOTE_MAX_LENGTH) })
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  pushDraftNote(
                    form.noteDraft,
                    (fn) => setForm((prev) => ({ ...prev, notes: fn(prev.notes) })),
                    () => setForm((prev) => ({ ...prev, noteDraft: '' })),
                  )
                }
              }}
            />
            <button
              className="button button--secondary"
              type="button"
              onClick={() =>
                pushDraftNote(
                  form.noteDraft,
                  (fn) => setForm((prev) => ({ ...prev, notes: fn(prev.notes) })),
                  () => setForm((prev) => ({ ...prev, noteDraft: '' })),
                )
              }
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
                      setForm((prev) => ({ ...prev, notes: prev.notes.filter((n) => n.id !== note.id) }))
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
      <button className="button button--primary button--full" type="button" onClick={() => void submit()}>
        {mode === 'external' ? '전송' : '저장'}
      </button>
    </>
  )
}
