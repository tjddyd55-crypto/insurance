import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { isCarInsuranceFeatureEnabledForGa } from '../../dashboard/gaTenantMenu'
import { formatKoreanDateTime } from '../../application/utils/date'
import type { InsuranceApplicationRecord } from '../../application/domain/types'
import {
  deleteCustomer,
  listCustomerForms,
  listCustomers,
  updateCustomer,
} from '../api/customersApi'
import type { CustomerNote, CustomerRecord } from '../domain/types'
import { getDDay, getDDayBadgeClass } from '../utils/dday'
import { buildKakaoCustomerCopyText } from '../utils/customerText'
import { calculateInsuranceAgeFromRrn, formatLocalYmd } from '../utils/insuranceAge'
import { formatDateYmdInput, NOTE_MAX_LENGTH } from '../utils/insuranceInfo'
import { EXCEL_COLUMN_META, exportCustomersExcel } from '../utils/exportCustomersExcel'
import {
  CustomerForm,
  InsuranceInline,
  drivingText,
} from '../../../components/customer/CustomerForm'
import { PageBackButton } from '../../../components/common/PageBackButton'

function CustomerDDayBadge({ renewalDate }: { renewalDate: string }) {
  const dday = getDDay(renewalDate)
  if (dday === null) {
    return null
  }
  return <span className={getDDayBadgeClass(dday)}>{`D-${dday}`}</span>
}

/** 상령일까지 남은 일수 — 30일 이내 임박 시 강조 */
function MaturityDdayBadge({ maturityYmd }: { maturityYmd: string | null }) {
  if (!maturityYmd) {
    return null
  }
  const dday = getDDay(maturityYmd)
  if (dday === null) {
    return null
  }
  const hot = dday >= 0 && dday <= 30
  const label = hot ? `🔥 D-${dday}` : `D-${dday}`
  return (
    <span className={hot ? getDDayBadgeClass(dday) : 'customer-dday'} style={{ marginLeft: 4 }}>
      ({label})
    </span>
  )
}

function inferIsDriverFromDriving(driving: string): boolean | null {
  const t = String(driving ?? '').trim()
  if (!t) {
    return null
  }
  if (t.includes('운전 안함') || t.includes('안 함')) {
    return false
  }
  if (t.startsWith('운전함') || t === '운전') {
    return true
  }
  return null
}

type CustomerListMetrics = {
  insuranceAge: number | null
  maturityYmd: string | null
}

function getCustomerListMetrics(c: CustomerRecord): CustomerListMetrics {
  const computed = calculateInsuranceAgeFromRrn(c.ssn ?? '')
  if (computed) {
    return {
      insuranceAge: computed.insuranceAge,
      maturityYmd: formatLocalYmd(computed.maturityDate),
    }
  }
  if (c.insuranceAge != null && c.nextAgeDate) {
    const ymd = formatDateYmdInput(c.nextAgeDate)
    return {
      insuranceAge: c.insuranceAge,
      maturityYmd: ymd !== '-' ? ymd : null,
    }
  }
  return { insuranceAge: null, maturityYmd: null }
}

function customerInsuranceDisplay(c: CustomerRecord): {
  ageText: string
  dateText: string
  maturityYmd: string | null
  insuranceAgeNum: number | null
} {
  const m = getCustomerListMetrics(c)
  return {
    ageText: m.insuranceAge != null ? `${m.insuranceAge}세` : '—',
    dateText: m.maturityYmd ?? '—',
    maturityYmd: m.maturityYmd,
    insuranceAgeNum: m.insuranceAge,
  }
}

function genderSummaryLabel(c: CustomerRecord): string {
  if (c.gender === 'male') {
    return '남'
  }
  if (c.gender === 'female') {
    return '여'
  }
  return '—'
}

type CustomerAdvancedFilters = {
  minInsuranceAge: string
  maxInsuranceAge: string
  gender: '' | 'male' | 'female'
  maturityFrom: string
  maturityTo: string
  carExpireFrom: string
  carExpireTo: string
}

const EMPTY_ADVANCED_FILTERS: CustomerAdvancedFilters = {
  minInsuranceAge: '',
  maxInsuranceAge: '',
  gender: '',
  maturityFrom: '',
  maturityTo: '',
  carExpireFrom: '',
  carExpireTo: '',
}


function parseOptionalInt(s: string): number | null {
  const t = s.trim()
  if (!t) {
    return null
  }
  const n = Number.parseInt(t, 10)
  return Number.isFinite(n) ? n : null
}

function customerRenewalYmd(c: CustomerRecord): string | null {
  const raw = (c.renewalDate ?? '').trim().slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null
}

function customerPassesAdvancedFilters(c: CustomerRecord, filters: CustomerAdvancedFilters): boolean {
  const metrics = getCustomerListMetrics(c)

  if (filters.gender === 'male' || filters.gender === 'female') {
    if (c.gender !== filters.gender) {
      return false
    }
  }

  const minA = parseOptionalInt(filters.minInsuranceAge)
  if (minA != null) {
    if (metrics.insuranceAge == null || metrics.insuranceAge < minA) {
      return false
    }
  }

  const maxA = parseOptionalInt(filters.maxInsuranceAge)
  if (maxA != null) {
    if (metrics.insuranceAge == null || metrics.insuranceAge > maxA) {
      return false
    }
  }

  const matFrom = filters.maturityFrom.trim()
  if (matFrom) {
    if (!metrics.maturityYmd || metrics.maturityYmd < matFrom) {
      return false
    }
  }
  const matTo = filters.maturityTo.trim()
  if (matTo) {
    if (!metrics.maturityYmd || metrics.maturityYmd > matTo) {
      return false
    }
  }

  const renewalYmd = customerRenewalYmd(c)
  const carFrom = filters.carExpireFrom.trim()
  if (carFrom) {
    if (!renewalYmd || renewalYmd < carFrom) {
      return false
    }
  }
  const carTo = filters.carExpireTo.trim()
  if (carTo) {
    if (!renewalYmd || renewalYmd > carTo) {
      return false
    }
  }

  return true
}

/** 영업 연락 우선: 상령/만기 D-day가 이 값 이하이면 오늘 대상(경과 포함) */
const CONTACT_TARGET_DDAY_MAX = 30

function isYmdWithinContactDday(ymd: string | null): boolean {
  if (!ymd) {
    return false
  }
  const d = getDDay(ymd)
  return d !== null && d <= CONTACT_TARGET_DDAY_MAX
}

function customerIsTodayContactTarget(c: CustomerRecord): boolean {
  const mat = getCustomerListMetrics(c).maturityYmd
  const car = customerRenewalYmd(c)
  return isYmdWithinContactDday(mat) || isYmdWithinContactDday(car)
}

function ymdAscSortKey(ymd: string | null): string {
  return ymd ?? '9999-12-31'
}

function parseCreatedAtMs(iso: string | undefined | null): number {
  const t = Date.parse(String(iso ?? ''))
  return Number.isFinite(t) ? t : 0
}

type CustomerListSort = 'maturity_asc' | 'car_expire_asc' | 'recent'

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

type CustomerEditFormState = CustomerFormState & {
  carNumber: string
  carModel: string
  carYear: string
  renewalDate: string
}

function recordToEditForm(c: CustomerRecord): CustomerEditFormState {
  let isDriver = c.isDriver
  if (isDriver == null) {
    isDriver = inferIsDriverFromDriving(c.driving)
  }
  return {
    name: c.name ?? '',
    gender: c.gender ?? null,
    ssn: c.ssn ?? '',
    phone: c.phone ?? '',
    address: c.address ?? '',
    height: c.height ?? '',
    weight: c.weight ?? '',
    job: c.job ?? '',
    isDriver,
    carType: c.carType ?? '',
    medical: c.medical ?? '',
    notes: Array.isArray(c.notes) ? [...c.notes] : [],
    noteDraft: '',
    carNumber: c.carNumber ?? '',
    carModel: c.carModel ?? '',
    carYear: c.carYear ?? '',
    renewalDate: c.renewalDate ?? '',
  }
}

function appendCustomerNoteToForm(
  prev: CustomerEditFormState | null,
  onStatusMessage: (msg: string) => void,
): CustomerEditFormState | null {
  if (!prev) {
    return prev
  }
  const trimmed = prev.noteDraft.trim()
  if (!trimmed) {
    return prev
  }
  if (trimmed.length > NOTE_MAX_LENGTH) {
    onStatusMessage(`메모는 ${NOTE_MAX_LENGTH}자 이하로 입력해주세요.`)
    return prev
  }
  const newNote: CustomerNote = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    content: trimmed,
    createdAt: new Date().toISOString(),
  }
  onStatusMessage('')
  return { ...prev, notes: [newNote, ...prev.notes], noteDraft: '' }
}

type CustomerListCardProps = {
  customer: CustomerRecord
  duplicateCustomerNames: Set<string>
  isSelectMode: boolean
  selectedCustomerIds: string[]
  setSelectedCustomerIds: Dispatch<SetStateAction<string[]>>
  expandedId: number | null
  setExpandedId: Dispatch<SetStateAction<number | null>>
  editingId: number | null
  editForm: CustomerEditFormState | null
  setEditForm: Dispatch<SetStateAction<CustomerEditFormState | null>>
  onEditSubmit: (e: FormEvent<HTMLFormElement>) => void | Promise<void>
  onStatusMessage: (msg: string) => void
  carFeatureEnabled: boolean
  historyLoading: boolean
  historyForms: InsuranceApplicationRecord[]
  onCopyCustomer: (c: CustomerRecord) => void
  onStartEdit: (c: CustomerRecord) => void
  onCancelEdit: () => void
  onDeleteCustomer: (c: CustomerRecord) => void
  onNavigateToFormEdit: (formId: string) => void
}

function CustomerListCard({
  customer: c,
  duplicateCustomerNames,
  isSelectMode,
  selectedCustomerIds,
  setSelectedCustomerIds,
  expandedId,
  setExpandedId,
  editingId,
  editForm,
  setEditForm,
  onEditSubmit,
  onStatusMessage,
  carFeatureEnabled,
  historyLoading,
  historyForms,
  onCopyCustomer,
  onStartEdit,
  onCancelEdit,
  onDeleteCustomer,
  onNavigateToFormEdit,
}: CustomerListCardProps) {
  const ins = customerInsuranceDisplay(c)
  return (
    <li
      className={`record-card customer-expand-card${isSelectMode ? ' customer-expand-card--select-mode' : ''}`}
    >
      {isSelectMode ? (
        <div className="customer-expand-card__select">
          <input
            type="checkbox"
            checked={selectedCustomerIds.includes(String(c.id))}
            onChange={() => {
              const id = String(c.id)
              setSelectedCustomerIds((prev) =>
                prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
              )
            }}
            onClick={(e) => e.stopPropagation()}
            aria-label={`${c.name} 선택`}
          />
        </div>
      ) : null}
      <div className="customer-expand-card__main">
        <button
          type="button"
          className="customer-expand-summary"
          aria-expanded={expandedId === c.id}
          onClick={() => setExpandedId((prev) => (prev === c.id ? null : c.id))}
        >
          <span className="customer-expand-summary__title">
            <span
              className={duplicateCustomerNames.has(c.name.trim()) ? 'customer-hit-name--duplicate' : undefined}
            >
              {c.name}
            </span>
            {' / '}
            {genderSummaryLabel(c)}
            {' / '}
            보험나이 {ins.ageText}
            {' / '}
            상령일 {ins.dateText}
          </span>
          <span className="customer-expand-summary__hint">{expandedId === c.id ? '접기' : '펼치기'}</span>
        </button>

        {expandedId === c.id ? (
          <div className="customer-expand-detail">
            {editingId === c.id && editForm ? (
              <>
                <div className="customer-edit-banner" role="status">
                  ✏ 고객 정보 수정 중
                </div>
                <form
                  className="customer-edit-form"
                  onSubmit={(e) => {
                    void onEditSubmit(e)
                  }}
                >
                  <div className="field-grid-customers">
                    <label className="field">
                      <span className="field__label">이름</span>
                      <input
                        className="field__control"
                        name="customer-name"
                        autoComplete="name"
                        value={editForm.name ?? ''}
                        onChange={(e) =>
                          setEditForm((prev) => (prev ? { ...prev, name: e.target.value } : prev))
                        }
                      />
                    </label>
                    <div className="field field--wide">
                      <span className="field__label">성별</span>
                      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: 4 }}>
                        <label>
                          <input
                            type="radio"
                            name={`gender-edit-${c.id}`}
                            checked={editForm.gender === 'male'}
                            onChange={() =>
                              setEditForm((prev) => (prev ? { ...prev, gender: 'male' } : prev))
                            }
                          />{' '}
                          남
                        </label>
                        <label>
                          <input
                            type="radio"
                            name={`gender-edit-${c.id}`}
                            checked={editForm.gender === 'female'}
                            onChange={() =>
                              setEditForm((prev) => (prev ? { ...prev, gender: 'female' } : prev))
                            }
                          />{' '}
                          여
                        </label>
                      </div>

                    </div>
                    <label className="field">
                      <span className="field__label">주민번호</span>
                      <input
                        className="field__control"
                        name="customer-ssn"
                        autoComplete="off"
                        value={editForm.ssn ?? ''}
                        onChange={(e) =>
                          setEditForm((prev) => (prev ? { ...prev, ssn: e.target.value } : prev))
                        }
                      />
                    </label>
                    <InsuranceInline ssn={editForm.ssn ?? ''} />
                    <label className="field">
                      <span className="field__label">전화번호</span>
                      <input
                        className="field__control"
                        name="customer-phone"
                        autoComplete="tel"
                        value={editForm.phone ?? ''}
                        onChange={(e) =>
                          setEditForm((prev) => (prev ? { ...prev, phone: e.target.value } : prev))
                        }
                      />
                    </label>
                    <label className="field field--wide">
                      <span className="field__label">주소</span>
                      <input
                        className="field__control"
                        name="customer-address"
                        autoComplete="street-address"
                        value={editForm.address ?? ''}
                        onChange={(e) =>
                          setEditForm((prev) => (prev ? { ...prev, address: e.target.value } : prev))
                        }
                      />
                    </label>
                    <label className="field">
                      <span className="field__label">키</span>
                      <input
                        className="field__control"
                        value={editForm.height ?? ''}
                        onChange={(e) =>
                          setEditForm((prev) => (prev ? { ...prev, height: e.target.value } : prev))
                        }
                      />
                    </label>
                    <label className="field">
                      <span className="field__label">몸무게</span>
                      <input
                        className="field__control"
                        value={editForm.weight ?? ''}
                        onChange={(e) =>
                          setEditForm((prev) => (prev ? { ...prev, weight: e.target.value } : prev))
                        }
                      />
                    </label>
                    <label className="field field--wide">
                      <span className="field__label">직업 / 회사명 등</span>
                      <input
                        className="field__control"
                        value={editForm.job ?? ''}
                        onChange={(e) =>
                          setEditForm((prev) => (prev ? { ...prev, job: e.target.value } : prev))
                        }
                      />
                    </label>
                    <div className="field field--wide">
                      <span className="field__label">운전 여부</span>
                      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: 4 }}>
                        <label>
                          <input
                            type="radio"
                            name={`driver-edit-${c.id}`}
                            checked={editForm.isDriver === true}
                            onChange={() =>
                              setEditForm((prev) => (prev ? { ...prev, isDriver: true } : prev))
                            }
                          />{' '}
                          운전함
                        </label>
                        <label>
                          <input
                            type="radio"
                            name={`driver-edit-${c.id}`}
                            checked={editForm.isDriver === false}
                            onChange={() =>
                              setEditForm((prev) =>
                                prev ? { ...prev, isDriver: false, carType: '' } : prev,
                              )
                            }
                          />{' '}
                          운전 안함
                        </label>
                      </div>
                    </div>
                    {editForm.isDriver === true ? (
                      <label className="field field--wide">
                        <span className="field__label">차종</span>
                        <input
                          className="field__control"
                          type="text"
                          placeholder="예: 승용차, SUV, 1톤 트럭"
                          value={editForm.carType ?? ''}
                          onChange={(e) =>
                            setEditForm((prev) => (prev ? { ...prev, carType: e.target.value } : prev))
                          }
                        />
                      </label>
                    ) : null}
                    <label className="field field--wide">
                      <span className="field__label">5년 이내 진단·수술·치료 (건강 고지)</span>
                      <textarea
                        className="field__control"
                        name="customer-medical"
                        rows={3}
                        value={editForm.medical ?? ''}
                        onChange={(e) =>
                          setEditForm((prev) => (prev ? { ...prev, medical: e.target.value } : prev))
                        }
                      />
                    </label>
                    <div className="field field--wide">
                      <span className="field__label">메모 (최대 {NOTE_MAX_LENGTH}자, Enter로 추가)</span>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 4 }}>
                        <input
                          className="field__control"
                          style={{ flex: '1 1 220px' }}
                          placeholder="메모 입력"
                          value={editForm.noteDraft ?? ''}
                          maxLength={NOTE_MAX_LENGTH}
                          onChange={(e) =>
                            setEditForm((prev) =>
                              prev
                                ? { ...prev, noteDraft: e.target.value.slice(0, NOTE_MAX_LENGTH) }
                                : prev,
                            )
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              setEditForm((prev) => appendCustomerNoteToForm(prev, onStatusMessage))
                            }
                          }}
                        />
                        <button
                          className="button button--secondary"
                          type="button"
                          onClick={() =>
                            setEditForm((prev) => appendCustomerNoteToForm(prev, onStatusMessage))
                          }
                        >
                          추가
                        </button>
                      </div>
                      {editForm.notes.length > 0 ? (
                        <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0' }}>
                          {editForm.notes.map((note) => (
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
                                <small style={{ opacity: 0.75 }}>
                                  {new Date(note.createdAt).toLocaleString('ko-KR')}
                                </small>
                              </div>
                              <button
                                type="button"
                                className="delete-btn"
                                onClick={() =>
                                  setEditForm((prev) =>
                                    prev ? { ...prev, notes: prev.notes.filter((n) => n.id !== note.id) } : prev,
                                  )
                                }
                              >
                                삭제
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                    <label className="field">
                      <span className="field__label">차량번호</span>
                      <input
                        className="field__control"
                        value={editForm.carNumber ?? ''}
                        onChange={(e) =>
                          setEditForm((prev) => (prev ? { ...prev, carNumber: e.target.value } : prev))
                        }
                      />
                    </label>
                    <label className="field">
                      <span className="field__label">차종</span>
                      <input
                        className="field__control"
                        value={editForm.carModel ?? ''}
                        onChange={(e) =>
                          setEditForm((prev) => (prev ? { ...prev, carModel: e.target.value } : prev))
                        }
                      />
                    </label>
                    <label className="field">
                      <span className="field__label">연식</span>
                      <input
                        className="field__control"
                        value={editForm.carYear ?? ''}
                        onChange={(e) =>
                          setEditForm((prev) => (prev ? { ...prev, carYear: e.target.value } : prev))
                        }
                      />
                    </label>
                    <label className="field">
                      <span className="field__label">만기(갱신)일</span>
                      <input
                        className="field__control"
                        type="date"
                        value={editForm.renewalDate ? editForm.renewalDate.slice(0, 10) : ''}
                        onChange={(e) =>
                          setEditForm((prev) => (prev ? { ...prev, renewalDate: e.target.value } : prev))
                        }
                      />
                    </label>
                  </div>
                  <div className="customer-edit-actions">
                    <button className="button-save" type="submit">
                      수정 저장
                    </button>
                    <button className="button-cancel" type="button" onClick={onCancelEdit}>
                      취소
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <>
                <div className="customer-detail-read">
                  <p>
                    <strong>이름:</strong> {c.name}
                  </p>
                  <p>
                    <strong>주민번호:</strong> {c.ssn || '—'}
                  </p>
                  <p style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 24px', alignItems: 'center' }}>
                    <span>
                      <strong>보험나이:</strong> {ins.ageText}
                    </span>
                    <span style={{ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
                      <strong>상령일:</strong> {ins.dateText}
                      <MaturityDdayBadge maturityYmd={ins.maturityYmd} />
                    </span>
                  </p>
                  <p>
                    <strong>핸드폰번호:</strong> {c.phone || '—'}
                  </p>
                  <p>
                    <strong>주소:</strong> {c.address || '—'}
                  </p>
                  <p>
                    <strong>키/몸무게:</strong>{' '}
                    {c.height?.trim() || c.weight?.trim()
                      ? `${c.height?.trim() || '—'}/${c.weight?.trim() || '—'}`
                      : '—'}
                  </p>
                  <p>
                    <strong>직업/회사명/하는일/지역:</strong> {c.job?.trim() || '—'}
                  </p>
                  <p>
                    <strong>운전여부:</strong>{' '}
                    {c.isDriver === true
                      ? '운전함'
                      : c.isDriver === false
                        ? '운전 안함'
                        : c.driving || '—'}
                  </p>
                  <p>
                    <strong>차종:</strong> {c.carType.trim() || '—'}
                  </p>
                  <p>
                    <strong>5년 이내 진단, 수술, 치료:</strong> {c.medical?.trim() || '—'}
                  </p>
                  <hr style={{ border: 'none', borderTop: '1px solid rgba(0,0,0,0.1)', margin: '12px 0' }} />
                  <p style={{ marginBottom: 8 }}>
                    <strong>[자동차정보]</strong>
                  </p>
                  <p>
                    <strong>차량번호:</strong> {c.carNumber || '—'}
                  </p>
                  <p style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 24px' }}>
                    <span>
                      <strong>차종:</strong> {c.carModel || '—'}
                    </span>
                    <span>
                      <strong>연식:</strong> {c.carYear || '—'}
                    </span>
                  </p>
                  <p>
                    <strong>만기(갱신일):</strong> {c.renewalDate || '—'}{' '}
                    <CustomerDDayBadge renewalDate={c.renewalDate} />
                  </p>
                  <hr style={{ border: 'none', borderTop: '1px solid rgba(0,0,0,0.1)', margin: '12px 0' }} />
                  {c.notes && c.notes.length > 0 ? (
                    <div style={{ marginTop: 4 }}>
                      <strong>메모</strong>
                      <ul style={{ margin: '6px 0 0', paddingLeft: '1.2em' }}>
                        {c.notes.map((n) => (
                          <li key={n.id}>{n.content}</li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p>
                      <strong>메모:</strong> —
                    </p>
                  )}
                </div>
                <div className="customer-actions">
                  <button className="kakao-btn" type="button" onClick={() => void onCopyCustomer(c)}>
                    카톡 복사
                  </button>
                  <button className="edit-btn" type="button" onClick={() => onStartEdit(c)}>
                    ✏ 수정
                  </button>
                  <button className="delete-btn" type="button" onClick={() => void onDeleteCustomer(c)}>
                    삭제
                  </button>
                </div>
              </>
            )}

            {carFeatureEnabled ? (
              <div className="customer-form-history">
                <h3 className="customer-form-history__title">연결된 신청서</h3>
                {historyLoading ? (
                  <p className="customer-form-history__status">불러오는 중…</p>
                ) : historyForms.length === 0 ? (
                  <p className="customer-form-history__status">이 고객 ID로 연결된 신청서가 없습니다.</p>
                ) : (
                  <ul className="customer-form-history__list">
                    {historyForms.map((row) => (
                      <li key={row.id} className="customer-form-history__item">
                        <div>
                          <strong>{row.title}</strong>
                          <span className="customer-form-history__meta">
                            저장: {formatKoreanDateTime(row.updatedAt)} · 만기 {row.expiryDate || '—'}
                          </span>
                        </div>
                        <button
                          className="button button--secondary"
                          type="button"
                          onClick={() => onNavigateToFormEdit(row.id)}
                        >
                          열기
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  )
}

export default function CustomersPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user, token } = useAuth()
  const carFeatureEnabled = isCarInsuranceFeatureEnabledForGa(user?.gaCode)
  const [customers, setCustomers] = useState<CustomerRecord[]>([])
  const [statusText, setStatusText] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [historyForms, setHistoryForms] = useState<InsuranceApplicationRecord[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<CustomerEditFormState | null>(null)
  const tab = searchParams.get('mode') === 'create' ? 'create' : 'list'
  const [keyword, setKeyword] = useState('')
  const [listSort, setListSort] = useState<CustomerListSort>('maturity_asc')
  const [advancedFilters, setAdvancedFilters] = useState<CustomerAdvancedFilters>(() => ({
    ...EMPTY_ADVANCED_FILTERS,
  }))
  const [isSelectMode, setIsSelectMode] = useState(false)
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([])
  const [selectedColumns, setSelectedColumns] = useState<string[]>([])
  const [isColumnPickerOpen, setIsColumnPickerOpen] = useState(false)
  const selectAllRef = useRef<HTMLInputElement>(null)

  const duplicateCustomerNames = useMemo(() => {
    const counts = new Map<string, number>()
    for (const c of customers) {
      const key = c.name.trim()
      if (!key) {
        continue
      }
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return new Set([...counts.entries()].filter(([, n]) => n > 1).map(([name]) => name))
  }, [customers])

  const keywordFilteredCustomers = useMemo(() => {
    const q = keyword.trim()
    if (!q) {
      return customers
    }
    return customers.filter((c) => c.name.includes(q) || (c.phone ?? '').includes(q))
  }, [customers, keyword])

  const filteredCustomers = useMemo(
    () => keywordFilteredCustomers.filter((c) => customerPassesAdvancedFilters(c, advancedFilters)),
    [keywordFilteredCustomers, advancedFilters],
  )

  const todayContactTargets = useMemo(
    () => filteredCustomers.filter((c) => customerIsTodayContactTarget(c)),
    [filteredCustomers],
  )

  const advancedFiltersActive = useMemo(() => {
    const f = advancedFilters
    return !!(
      f.minInsuranceAge.trim() ||
      f.maxInsuranceAge.trim() ||
      f.gender ||
      f.maturityFrom.trim() ||
      f.maturityTo.trim() ||
      f.carExpireFrom.trim() ||
      f.carExpireTo.trim()
    )
  }, [advancedFilters])

  const sortedCustomers = useMemo(() => {
    const copy = [...filteredCustomers]
    const tieName = (a: CustomerRecord, b: CustomerRecord) => a.name.localeCompare(b.name, 'ko')

    if (listSort === 'maturity_asc') {
      copy.sort((a, b) => {
        const ka = ymdAscSortKey(getCustomerListMetrics(a).maturityYmd)
        const kb = ymdAscSortKey(getCustomerListMetrics(b).maturityYmd)
        const cmp = ka.localeCompare(kb)
        return cmp !== 0 ? cmp : tieName(a, b)
      })
    } else if (listSort === 'car_expire_asc') {
      copy.sort((a, b) => {
        const ka = ymdAscSortKey(customerRenewalYmd(a))
        const kb = ymdAscSortKey(customerRenewalYmd(b))
        const cmp = ka.localeCompare(kb)
        return cmp !== 0 ? cmp : tieName(a, b)
      })
    } else {
      copy.sort((a, b) => {
        const ta = parseCreatedAtMs(a.createdAt)
        const tb = parseCreatedAtMs(b.createdAt)
        if (tb !== ta) {
          return tb - ta
        }
        return tieName(a, b)
      })
    }
    return copy
  }, [filteredCustomers, listSort])

  const allVisibleIds = useMemo(() => sortedCustomers.map((c) => String(c.id)), [sortedCustomers])
  const allVisibleSelected =
    allVisibleIds.length > 0 && allVisibleIds.every((id) => selectedCustomerIds.includes(id))

  const loadCustomers = useCallback(async () => {
    if (!token || user?.role !== 'USER') {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    try {
      const rows = await listCustomers(token)
      setCustomers(rows)
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : '목록을 불러오지 못했습니다.')
    } finally {
      setIsLoading(false)
    }
  }, [token, user?.role])

  useEffect(() => {
    if (user?.role !== 'USER') {
      setIsLoading(false)
      return
    }
    void loadCustomers()
  }, [user?.role, loadCustomers])

  useEffect(() => {
    if (editingId != null && expandedId !== editingId) {
      setEditingId(null)
      setEditForm(null)
    }
  }, [expandedId, editingId])

  useEffect(() => {
    if (expandedId == null) {
      setHistoryForms([])
      return
    }
    if (!carFeatureEnabled) {
      setHistoryForms([])
      return
    }
    if (!token) {
      return
    }
    setHistoryForms([])
    let cancelled = false
    setHistoryLoading(true)
    void listCustomerForms(token, expandedId)
      .then((rows) => {
        if (!cancelled) {
          setHistoryForms(rows)
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setStatusText(error instanceof Error ? error.message : '히스토리를 불러오지 못했습니다.')
          setHistoryForms([])
        }
      })
      .finally(() => {
        if (!cancelled) {
          setHistoryLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [expandedId, token, carFeatureEnabled])

  useEffect(() => {
    const el = selectAllRef.current
    if (!el) {
      return
    }
    const n = selectedCustomerIds.filter((id) => allVisibleIds.includes(id)).length
    el.indeterminate = n > 0 && n < allVisibleIds.length
  }, [selectedCustomerIds, allVisibleIds])

  useEffect(() => {
    if (tab !== 'list' && isSelectMode) {
      setIsSelectMode(false)
      setSelectedCustomerIds([])
      setSelectedColumns([])
      setIsColumnPickerOpen(false)
    }
  }, [tab, isSelectMode])

  async function copyCustomer(rec: CustomerRecord) {
    const text = buildKakaoCustomerCopyText(rec)
    try {
      await navigator.clipboard.writeText(text)
      window.alert('복사되었습니다')
    } catch {
      setStatusText('복사에 실패했습니다.')
    }
  }

  function applyQuickFilter(type: 'AGE_UNDER_30_MALE' | 'AGE_OVER_40_FEMALE' | 'MATURITY_30' | 'CAR_EXPIRE_30') {
    const today = new Date()
    const future30 = new Date(today)
    future30.setDate(future30.getDate() + 30)
    const fmt = formatLocalYmd

    if (type === 'AGE_UNDER_30_MALE') {
      setAdvancedFilters({
        ...EMPTY_ADVANCED_FILTERS,
        maxInsuranceAge: '30',
        gender: 'male',
      })
    } else if (type === 'AGE_OVER_40_FEMALE') {
      setAdvancedFilters({
        ...EMPTY_ADVANCED_FILTERS,
        minInsuranceAge: '40',
        gender: 'female',
      })
    } else if (type === 'MATURITY_30') {
      setAdvancedFilters({
        ...EMPTY_ADVANCED_FILTERS,
        maturityFrom: fmt(today),
        maturityTo: fmt(future30),
      })
    } else {
      setAdvancedFilters({
        ...EMPTY_ADVANCED_FILTERS,
        carExpireFrom: fmt(today),
        carExpireTo: fmt(future30),
      })
    }
  }

  function startEdit(c: CustomerRecord) {
    setExpandedId(c.id)
    setEditingId(c.id)
    setEditForm(recordToEditForm(c))
  }

  function cancelEdit() {
    setEditingId(null)
    setEditForm(null)
  }

  async function handleUpdateCustomer() {
    if (!token || user?.role !== 'USER' || editingId == null || !editForm) {
      return
    }
    const name = editForm.name.trim()
    if (!name) {
      setStatusText('이름은 필수입니다.')
      return
    }
    if (editForm.gender == null) {
      setStatusText('성별을 선택해주세요.')
      return
    }
    if (editForm.isDriver == null) {
      setStatusText('운전 여부를 선택해주세요.')
      return
    }
    if (editForm.isDriver === true && !editForm.carType.trim()) {
      setStatusText('차종을 입력해주세요.')
      return
    }
    try {
      await updateCustomer(token, editingId, {
        name,
        ssn: editForm.ssn,
        phone: editForm.phone,
        carrier: '',
        address: editForm.address,
        height: editForm.height,
        weight: editForm.weight,
        job: editForm.job,
        driving: drivingText(editForm.isDriver),
        medical: editForm.medical,
        gender: editForm.gender,
        isDriver: editForm.isDriver,
        carType: editForm.isDriver === true ? editForm.carType.trim() : '',
        notes: editForm.notes,
        carNumber: editForm.carNumber,
        carModel: editForm.carModel,
        carYear: editForm.carYear,
        renewalDate: editForm.renewalDate,
      })
      setStatusText('고객 정보를 수정했습니다.')
      cancelEdit()
      await loadCustomers()
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : '수정에 실패했습니다.')
    }
  }

  async function handleEditFormSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    console.log('고객 수정 폼 submit', { editingId, name: editForm?.name })
    await handleUpdateCustomer()
  }

  function enterExcelSelectMode() {
    setExpandedId(null)
    setEditingId(null)
    setEditForm(null)
    setIsSelectMode(true)
    setSelectedCustomerIds([])
    setSelectedColumns(['name'])
    setIsColumnPickerOpen(false)
    setStatusText('')
  }

  function exitExcelSelectMode() {
    setIsSelectMode(false)
    setSelectedCustomerIds([])
    setSelectedColumns([])
    setIsColumnPickerOpen(false)
  }

  function runExport(rows: CustomerRecord[]) {
    try {
      exportCustomersExcel(rows, selectedColumns)
      setStatusText('엑셀 파일을 저장했습니다.')
    } catch (e) {
      setStatusText(e instanceof Error ? e.message : '다운로드에 실패했습니다.')
    }
  }

  function handleDownloadSelected() {
    if (selectedCustomerIds.length === 0) {
      window.alert('고객을 선택해주세요')
      setStatusText('다운로드할 고객을 선택해 주세요.')
      return
    }
    const idSet = new Set(selectedCustomerIds)
    const rows = sortedCustomers.filter((c) => idSet.has(String(c.id)))
    runExport(rows)
  }

  /** 현재 검색·정렬된 목록 전체 (필터 반영) */
  function handleDownloadListAll() {
    if (sortedCustomers.length === 0) {
      window.alert('다운로드할 고객이 없습니다.')
      setStatusText('목록에 표시된 고객이 없습니다.')
      return
    }
    runExport([...sortedCustomers])
  }

  function toggleExcelColumn(id: string) {
    setSelectedColumns((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  async function copyExternalInputLink() {
    if (!user?.id) {
      return
    }
    const link = `${window.location.origin}/customer/input?ref=${encodeURIComponent(user.id)}`
    try {
      await navigator.clipboard.writeText(link)
      window.alert('복사되었습니다')
    } catch {
      setStatusText('복사에 실패했습니다.')
    }
  }

  async function handleDeleteCustomer(c: CustomerRecord) {
    if (!token || user?.role !== 'USER') {
      return
    }
    if (
      !window.confirm(
        `고객 "${c.name}"(번호 ${c.id})를 목록에서 삭제할까요? 기존 신청서의 고객 연결(customer_id)은 유지됩니다.`,
      )
    ) {
      return
    }
    try {
      await deleteCustomer(token, c.id)
      if (expandedId === c.id) {
        setExpandedId(null)
      }
      if (editingId === c.id) {
        cancelEdit()
      }
      setStatusText('고객을 삭제했습니다.')
      await loadCustomers()
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : '삭제에 실패했습니다.')
    }
  }


  if (user?.role !== 'USER') {
    return (
      <main className="page page--with-back">
        <PageBackButton />
        <header className="page-header">
          <h1>고객 관리</h1>
          <p>접근 권한 없음</p>
        </header>
      </main>
    )
  }

  return (
    <main
      className={`page customers-page page--with-back${
        isSelectMode && tab === 'list' ? ' customers-page--excel-toolbar-pad' : ''
      }`}
    >
      <PageBackButton />
      {isSelectMode && tab === 'list' ? (
        <div className="customers-excel-toolbar" role="region" aria-label="엑셀 다운로드 선택">
          <p className="customers-excel-toolbar__status">
            엑셀 선택 중 —「선택 다운로드」는 체크한 고객,「목록 전체 다운로드」는 지금 검색·필터·정렬된 목록만
          </p>
          <div className="customers-excel-toolbar__row">
            <label className="customers-excel-toolbar__select-all">
              <input
                ref={selectAllRef}
                type="checkbox"
                checked={allVisibleSelected}
                onChange={() => {
                  if (allVisibleSelected) {
                    setSelectedCustomerIds((prev) => prev.filter((id) => !allVisibleIds.includes(id)))
                  } else {
                    setSelectedCustomerIds((prev) => [...new Set([...prev, ...allVisibleIds])])
                  }
                }}
              />
              전체 선택
            </label>
            <button type="button" className="filter-button" onClick={() => setIsColumnPickerOpen(true)}>
              컬럼 선택
            </button>
            <button type="button" className="cta-button" onClick={handleDownloadSelected}>
              선택 다운로드
            </button>
            <button type="button" className="cta-button" onClick={handleDownloadListAll}>
              목록 전체 다운로드
            </button>
            <button type="button" className="filter-button" onClick={exitExcelSelectMode}>
              취소
            </button>
          </div>
        </div>
      ) : null}
      <header className="page-header">
        <div className="page-title-with-action">
          <h1>고객 관리</h1>
          <button type="button" className="link-btn" onClick={() => void copyExternalInputLink()}>
            링크
          </button>
        </div>
        {statusText ? <p>{statusText}</p> : null}
      </header>

      {tab === 'create' ? (
        <>
          <section className="card" style={{ marginTop: 0 }}>
            <CustomerForm
              onStatusMessage={setStatusText}
              onInternalSaveSuccess={() => void loadCustomers()}
            />
          </section>
        </>
      ) : (
        <section className="list-section" style={{ marginTop: 0 }}>
          <div className="list-section-header-row">
            <h2 className="dashboard-section-title">저장된 고객</h2>
            <div className="list-section-header-actions">
              {!isSelectMode ? (
                <>
                  <button type="button" className="cta-button" onClick={() => setSearchParams({ mode: 'create' })}>
                    고객 등록
                  </button>
                  <button type="button" className="cta-button" onClick={enterExcelSelectMode}>
                    엑셀 다운로드
                  </button>
                </>
              ) : null}
            </div>
          </div>
          <input
            className="search-input"
            type="search"
            placeholder="이름 / 전화번호 검색"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            autoComplete="off"
            aria-label="이름 또는 전화번호 검색"
          />

          {!isLoading && customers.length > 0 ? (
            <div className="customers-today-targets" role="status">
              <p className="customers-today-targets__title">
                🔥 오늘 연락 대상 (<strong>{todayContactTargets.length}</strong>명)
              </p>
              <p className="customers-today-targets__hint">
                상령일 또는 자동차 만기 D-{CONTACT_TARGET_DDAY_MAX} 이하(임박·경과) — 현재 검색·필터 범위 기준
              </p>
            </div>
          ) : null}

          <div className="customers-sort-row" role="group" aria-label="목록 정렬">
            <span className="customers-sort-row__label">정렬:</span>
            <div className="customers-sort-row__buttons filter-group">
              <button
                type="button"
                className={`filter-button${listSort === 'maturity_asc' ? ' active' : ''}`}
                onClick={() => setListSort('maturity_asc')}
              >
                상령일 빠른순
              </button>
              <button
                type="button"
                className={`filter-button${listSort === 'car_expire_asc' ? ' active' : ''}`}
                onClick={() => setListSort('car_expire_asc')}
              >
                자동차 만기순
              </button>
              <button
                type="button"
                className={`filter-button${listSort === 'recent' ? ' active' : ''}`}
                onClick={() => setListSort('recent')}
              >
                최근등록
              </button>
            </div>
          </div>

          <div className="customers-advanced-filters" role="search" aria-label="고급 검색">
            <div className="customers-advanced-filters__grid">
              <label className="customers-advanced-filters__field">
                <span>보험나이 최소</span>
                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={advancedFilters.minInsuranceAge}
                  onChange={(e) => setAdvancedFilters((f) => ({ ...f, minInsuranceAge: e.target.value }))}
                />
              </label>
              <label className="customers-advanced-filters__field">
                <span>보험나이 최대</span>
                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={advancedFilters.maxInsuranceAge}
                  onChange={(e) => setAdvancedFilters((f) => ({ ...f, maxInsuranceAge: e.target.value }))}
                />
              </label>
              <label className="customers-advanced-filters__field">
                <span>성별</span>
                <select
                  value={advancedFilters.gender}
                  onChange={(e) =>
                    setAdvancedFilters((f) => ({
                      ...f,
                      gender: e.target.value as CustomerAdvancedFilters['gender'],
                    }))
                  }
                >
                  <option value="">전체</option>
                  <option value="male">남</option>
                  <option value="female">여</option>
                </select>
              </label>
              <label className="customers-advanced-filters__field">
                <span>상령일 시작</span>
                <input
                  type="date"
                  value={advancedFilters.maturityFrom}
                  onChange={(e) => setAdvancedFilters((f) => ({ ...f, maturityFrom: e.target.value }))}
                />
              </label>
              <label className="customers-advanced-filters__field">
                <span>상령일 종료</span>
                <input
                  type="date"
                  value={advancedFilters.maturityTo}
                  onChange={(e) => setAdvancedFilters((f) => ({ ...f, maturityTo: e.target.value }))}
                />
              </label>
              <label className="customers-advanced-filters__field">
                <span>자동차 만기 시작</span>
                <input
                  type="date"
                  value={advancedFilters.carExpireFrom}
                  onChange={(e) => setAdvancedFilters((f) => ({ ...f, carExpireFrom: e.target.value }))}
                />
              </label>
              <label className="customers-advanced-filters__field">
                <span>자동차 만기 종료</span>
                <input
                  type="date"
                  value={advancedFilters.carExpireTo}
                  onChange={(e) => setAdvancedFilters((f) => ({ ...f, carExpireTo: e.target.value }))}
                />
              </label>
            </div>
            <div className="customers-advanced-filters__quick filter-group">
              <button type="button" className="filter-button" onClick={() => applyQuickFilter('AGE_UNDER_30_MALE')}>
                30세 이하 남성
              </button>
              <button type="button" className="filter-button" onClick={() => applyQuickFilter('AGE_OVER_40_FEMALE')}>
                40세 이상 여성
              </button>
              <button type="button" className="filter-button" onClick={() => applyQuickFilter('MATURITY_30')}>
                상령일 30일 이내
              </button>
              <button type="button" className="filter-button" onClick={() => applyQuickFilter('CAR_EXPIRE_30')}>
                자동차 만기 30일 이내
              </button>
              {advancedFiltersActive ? (
                <button
                  type="button"
                  className="filter-button"
                  onClick={() => setAdvancedFilters({ ...EMPTY_ADVANCED_FILTERS })}
                >
                  필터 초기화
                </button>
              ) : null}
            </div>
          </div>

          {!isLoading && customers.length > 0 ? (
            <p className="customers-filter-result" role="status">
              검색·필터 결과: <strong>{sortedCustomers.length}</strong>명
            </p>
          ) : null}

          {isLoading ? (
            <p>불러오는 중…</p>
          ) : customers.length === 0 ? (
            <p className="empty-state">등록된 고객이 없습니다.</p>
          ) : sortedCustomers.length === 0 ? (
            <p className="empty-state">
              {keyword.trim() || advancedFiltersActive
                ? '검색·필터 조건에 맞는 고객이 없습니다.'
                : '고객이 없습니다.'}
            </p>
          ) : (
            <ul className="record-list customer-expand-list customer-list">
              {sortedCustomers.map((c) => (
                <CustomerListCard
                  key={c.id}
                  customer={c}
                  duplicateCustomerNames={duplicateCustomerNames}
                  isSelectMode={isSelectMode}
                  selectedCustomerIds={selectedCustomerIds}
                  setSelectedCustomerIds={setSelectedCustomerIds}
                  expandedId={expandedId}
                  setExpandedId={setExpandedId}
                  editingId={editingId}
                  editForm={editForm}
                  setEditForm={setEditForm}
                  onEditSubmit={handleEditFormSubmit}
                  onStatusMessage={setStatusText}
                  carFeatureEnabled={carFeatureEnabled}
                  historyLoading={historyLoading}
                  historyForms={historyForms}
                  onCopyCustomer={copyCustomer}
                  onStartEdit={startEdit}
                  onCancelEdit={cancelEdit}
                  onDeleteCustomer={handleDeleteCustomer}
                  onNavigateToFormEdit={(formId) => navigate(`/form/${formId}/edit`)}
                />
              ))}
            </ul>
          )}
        </section>
      )}

      {isColumnPickerOpen ? (
        <div
          className="modal-overlay"
          role="presentation"
          onClick={() => setIsColumnPickerOpen(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setIsColumnPickerOpen(false)
            }
          }}
        >
          <div
            className="modal modal-excel-columns"
            role="dialog"
            aria-modal="true"
            aria-labelledby="excel-columns-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="excel-columns-title">엑셀에 포함할 항목</h3>
            <div className="modal-body">
              <ul className="modal-excel-columns__list">
                {EXCEL_COLUMN_META.map((col) => (
                  <li key={col.id} className="modal-excel-columns__item">
                    <label>
                      <input
                        type="checkbox"
                        checked={selectedColumns.includes(col.id)}
                        onChange={() => toggleExcelColumn(col.id)}
                      />
                      {col.label}
                    </label>
                  </li>
                ))}
              </ul>
            </div>
            <div className="modal-actions">
              <button type="button" className="confirm" onClick={() => setIsColumnPickerOpen(false)}>
                닫기
              </button>
            </div>
          </div>
        </div>
      ) : null}

    </main>
  )
}
