import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { formatKoreanDateTime } from '../../application/utils/date'
import type { InsuranceApplicationRecord } from '../../application/domain/types'
import {
  deleteCustomer,
  listCustomerForms,
  listCustomers,
  saveCustomer,
  updateCustomer,
} from '../api/customersApi'
import type { CustomerNote, CustomerRecord } from '../domain/types'
import { storeSelectedCustomer } from '../storage/selectedCustomerStorage'
import { getDDay, getDDayBadgeClass } from '../utils/dday'
import { generateCustomerText } from '../utils/customerText'
import {
  NOTE_MAX_LENGTH,
  calculateInsuranceInfo,
  formatDateYmdInput,
  formatRrnInput,
  nextAgeDateToIsoString,
} from '../utils/insuranceInfo'

function CustomerDDayBadge({ renewalDate }: { renewalDate: string }) {
  const dday = getDDay(renewalDate)
  if (dday === null) {
    return null
  }
  return <span className={getDDayBadgeClass(dday)}>{`D-${dday}`}</span>
}

type CustomerFormCore = {
  name: string
  gender: 'male' | 'female' | null
  rrn: string
  isDriver: boolean | null
  carType: string
  notes: CustomerNote[]
  noteDraft: string
}

type CustomerFormState = CustomerFormCore

type CustomerEditFormState = CustomerFormCore & {
  carNumber: string
  carModel: string
  carYear: string
  renewalDate: string
}

const EMPTY_FORM: CustomerFormState = {
  name: '',
  gender: null,
  rrn: '',
  isDriver: null,
  carType: '',
  notes: [],
  noteDraft: '',
}

function recordToEditForm(c: CustomerRecord): CustomerEditFormState {
  return {
    name: c.name ?? '',
    gender: c.gender ?? null,
    rrn: c.ssn ?? '',
    isDriver: c.isDriver ?? null,
    carType: c.carType ?? '',
    notes: Array.isArray(c.notes) ? [...c.notes] : [],
    noteDraft: '',
    carNumber: c.carNumber ?? '',
    carModel: c.carModel ?? '',
    carYear: c.carYear ?? '',
    renewalDate: c.renewalDate ?? '',
  }
}

function drivingText(isDriver: boolean | null): string {
  if (isDriver === true) {
    return '운전함'
  }
  if (isDriver === false) {
    return '운전 안함'
  }
  return ''
}

function NotesEditor({
  notes,
  noteDraft,
  onDraftChange,
  onAdd,
  onDelete,
}: {
  notes: CustomerNote[]
  noteDraft: string
  onDraftChange: (v: string) => void
  onAdd: () => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="field field--wide">
      <span className="field__label">메모 (최대 {NOTE_MAX_LENGTH}자, Enter로 추가)</span>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          className="field__control"
          style={{ flex: '1 1 200px' }}
          placeholder="메모 입력"
          value={noteDraft}
          maxLength={NOTE_MAX_LENGTH}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              onAdd()
            }
          }}
        />
        <button className="button button--secondary" type="button" onClick={onAdd}>
          + 추가
        </button>
      </div>
      <div className="mt-4 space-y-2" style={{ marginTop: '12px' }}>
        {notes.map((note) => (
          <div key={note.id} className="border rounded p-3" style={{ border: '1px solid #ccc', borderRadius: 8, padding: 12 }}>
            <div>{note.content}</div>
            <div className="text-sm text-gray-500 mt-1" style={{ fontSize: '0.85rem', opacity: 0.8, marginTop: 4 }}>
              {new Date(note.createdAt).toLocaleString('ko-KR')}
            </div>
            <button type="button" className="delete-btn" style={{ marginTop: 8 }} onClick={() => onDelete(note.id)}>
              삭제
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function InsuranceDisplay({ rrn }: { rrn: string }) {
  const { age, nextAgeDate } = useMemo(() => calculateInsuranceInfo(rrn), [rrn])
  const ymd = nextAgeDateToIsoString(nextAgeDate)
  if (age != null && ymd) {
    return (
      <p>
        <strong>보험나이:</strong> {age}세 (상령일: {formatDateYmdInput(ymd)})
      </p>
    )
  }
  return (
    <>
      <p>
        <strong>보험나이:</strong> 계산 불가
      </p>
      <p>
        <strong>상령일:</strong> 계산 불가
      </p>
    </>
  )
}

export default function CustomersPage() {
  const navigate = useNavigate()
  const { user, token } = useAuth()
  const [customers, setCustomers] = useState<CustomerRecord[]>([])
  const [form, setForm] = useState<CustomerFormState>(EMPTY_FORM)
  const [statusText, setStatusText] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [historyForms, setHistoryForms] = useState<InsuranceApplicationRecord[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<CustomerEditFormState | null>(null)
  const [tab, setTab] = useState<'create' | 'list'>('create')
  const [keyword, setKeyword] = useState('')

  const createInsurance = useMemo(() => calculateInsuranceInfo(form.rrn), [form.rrn])
  const createNextYmd = useMemo(
    () => nextAgeDateToIsoString(createInsurance.nextAgeDate),
    [createInsurance.nextAgeDate],
  )

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

  const filteredCustomers = useMemo(() => {
    const q = keyword.trim()
    if (!q) {
      return customers
    }
    return customers.filter((c) => c.name.includes(q) || (c.phone ?? '').includes(q))
  }, [customers, keyword])

  const sortedCustomers = useMemo(
    () => [...filteredCustomers].sort((a, b) => a.name.localeCompare(b.name, 'ko')),
    [filteredCustomers],
  )

  const loadCustomers = useCallback(async () => {
    if (!token || user?.role !== 'user') {
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
    if (user?.role !== 'user') {
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
  }, [expandedId, token])

  function addNoteCore(
    draft: string,
    setNotes: (fn: (prev: CustomerNote[]) => CustomerNote[]) => void,
    clearDraft: () => void,
  ) {
    const content = draft.trim()
    if (!content) {
      return
    }
    if (content.length > NOTE_MAX_LENGTH) {
      setStatusText(`메모는 ${NOTE_MAX_LENGTH}자 이하로 입력해주세요.`)
      return
    }
    const newNote: CustomerNote = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      content,
      createdAt: new Date().toISOString(),
    }
    setNotes((prev) => [newNote, ...prev])
    clearDraft()
    setStatusText('')
  }

  async function handleSaveCustomer() {
    if (!token || user?.role !== 'user') {
      return
    }
    const name = form.name.trim()
    if (!name) {
      setStatusText('이름은 필수입니다.')
      return
    }
    if (form.gender == null) {
      setStatusText('성별을 선택해주세요.')
      return
    }
    const rrnDigits = form.rrn.replace(/\D/g, '')
    if (rrnDigits.length < 7) {
      setStatusText('주민번호 앞 7자리 이상 입력해주세요.')
      return
    }
    if (form.isDriver == null) {
      setStatusText('운전 여부를 선택해주세요.')
      return
    }
    if (form.isDriver === true && !form.carType.trim()) {
      setStatusText('차종을 입력해주세요.')
      return
    }
    try {
      await saveCustomer(token, {
        name,
        ssn: formatRrnInput(form.rrn),
        gender: form.gender,
        isDriver: form.isDriver,
        carType: form.isDriver === true ? form.carType.trim() : '',
        notes: form.notes,
        phone: '',
        carrier: '',
        address: '',
        height: '',
        weight: '',
        job: '',
        driving: drivingText(form.isDriver),
        medical: '',
      })
      window.alert('저장 완료')
      setForm(EMPTY_FORM)
      setStatusText('저장했습니다.')
      await loadCustomers()
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : '저장에 실패했습니다.')
    }
  }

  async function copyCustomer(rec: CustomerRecord) {
    const text = generateCustomerText(rec)
    try {
      await navigator.clipboard.writeText(text)
      window.alert('복사 완료 → 카톡 붙여넣기')
    } catch {
      setStatusText('클립보드 복사에 실패했습니다.')
    }
  }

  function goToCarEdit(c: CustomerRecord) {
    storeSelectedCustomer(c)
    navigate('/customer-car')
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
    if (!token || user?.role !== 'user' || editingId == null || !editForm) {
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
    const rrnDigits = editForm.rrn.replace(/\D/g, '')
    if (rrnDigits.length < 7) {
      setStatusText('주민번호 앞 7자리 이상 입력해주세요.')
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
        ssn: formatRrnInput(editForm.rrn),
        gender: editForm.gender,
        isDriver: editForm.isDriver,
        carType: editForm.isDriver === true ? editForm.carType.trim() : '',
        notes: editForm.notes,
        driving: drivingText(editForm.isDriver),
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

  async function handleDeleteCustomer(c: CustomerRecord) {
    if (!token || user?.role !== 'user') {
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

  function CustomerCard({ data: c }: { data: CustomerRecord }) {
    return (
      <li className="record-card customer-expand-card">
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
            {c.phone || '—'}
            {' / '}
            {c.ssn || '—'} <CustomerDDayBadge renewalDate={c.renewalDate} />
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
                <div className="field-grid-customers">
                  <label className="field">
                    <span className="field__label">이름</span>
                    <input
                      className="field__control"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    />
                  </label>
                  <div className="field field--wide">
                    <span className="field__label">성별</span>
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                      <label>
                        <input
                          type="radio"
                          name={`gender-edit-${c.id}`}
                          checked={editForm.gender === 'male'}
                          onChange={() => setEditForm({ ...editForm, gender: 'male' })}
                        />{' '}
                        남
                      </label>
                      <label>
                        <input
                          type="radio"
                          name={`gender-edit-${c.id}`}
                          checked={editForm.gender === 'female'}
                          onChange={() => setEditForm({ ...editForm, gender: 'female' })}
                        />{' '}
                        여
                      </label>
                    </div>
                  </div>
                  <label className="field">
                    <span className="field__label">주민번호</span>
                    <input
                      className="field__control"
                      placeholder="000000-0000000"
                      value={editForm.rrn}
                      onChange={(e) => setEditForm({ ...editForm, rrn: formatRrnInput(e.target.value) })}
                    />
                  </label>
                  <div className="field field--wide">
                    {(() => {
                      const { age, nextAgeDate } = calculateInsuranceInfo(editForm.rrn)
                      const ymd = nextAgeDateToIsoString(nextAgeDate)
                      if (age != null && ymd) {
                        return (
                          <p style={{ margin: 0 }}>
                            <strong>보험나이:</strong> {age}세 (상령일: {formatDateYmdInput(ymd)})
                          </p>
                        )
                      }
                      return (
                        <p style={{ margin: 0 }}>
                          <strong>보험나이:</strong> 계산 불가 · <strong>상령일:</strong> 계산 불가
                        </p>
                      )
                    })()}
                  </div>
                  <div className="field field--wide">
                    <span className="field__label">운전 여부</span>
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                      <label>
                        <input
                          type="radio"
                          name={`driver-edit-${c.id}`}
                          checked={editForm.isDriver === true}
                          onChange={() => setEditForm({ ...editForm, isDriver: true })}
                        />{' '}
                        운전함
                      </label>
                      <label>
                        <input
                          type="radio"
                          name={`driver-edit-${c.id}`}
                          checked={editForm.isDriver === false}
                          onChange={() => setEditForm({ ...editForm, isDriver: false, carType: '' })}
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
                        placeholder="예: SUV, 1톤 트럭"
                        value={editForm.carType}
                        onChange={(e) => setEditForm({ ...editForm, carType: e.target.value })}
                      />
                    </label>
                  ) : null}
                  <NotesEditor
                    notes={editForm.notes}
                    noteDraft={editForm.noteDraft}
                    onDraftChange={(v) =>
                      setEditForm({ ...editForm, noteDraft: v.slice(0, NOTE_MAX_LENGTH) })
                    }
                    onAdd={() =>
                      addNoteCore(
                        editForm.noteDraft,
                        (fn) => setEditForm((prev) => (prev ? { ...prev, notes: fn(prev.notes) } : prev)),
                        () => setEditForm((prev) => (prev ? { ...prev, noteDraft: '' } : prev)),
                      )
                    }
                    onDelete={(id) =>
                      setEditForm((prev) => (prev ? { ...prev, notes: prev.notes.filter((n) => n.id !== id) } : prev))
                    }
                  />
                  <label className="field">
                    <span className="field__label">차량번호</span>
                    <input
                      className="field__control"
                      value={editForm.carNumber}
                      onChange={(e) => setEditForm({ ...editForm, carNumber: e.target.value })}
                    />
                  </label>
                  <label className="field">
                    <span className="field__label">차종(등록차량)</span>
                    <input
                      className="field__control"
                      value={editForm.carModel}
                      onChange={(e) => setEditForm({ ...editForm, carModel: e.target.value })}
                    />
                  </label>
                  <label className="field">
                    <span className="field__label">연식</span>
                    <input
                      className="field__control"
                      value={editForm.carYear}
                      onChange={(e) => setEditForm({ ...editForm, carYear: e.target.value })}
                    />
                  </label>
                  <label className="field">
                    <span className="field__label">만기(갱신)일</span>
                    <input
                      className="field__control"
                      type="date"
                      value={editForm.renewalDate ? editForm.renewalDate.slice(0, 10) : ''}
                      onChange={(e) => setEditForm({ ...editForm, renewalDate: e.target.value })}
                    />
                  </label>
                </div>
                <div className="customer-edit-actions">
                  <button className="button-save" type="button" onClick={() => void handleUpdateCustomer()}>
                    수정 저장
                  </button>
                  <button className="button-cancel" type="button" onClick={cancelEdit}>
                    취소
                  </button>
                </div>
              </>
            ) : (
              <>
                <p>
                  <strong>성별:</strong>{' '}
                  {c.gender === 'male' ? '남' : c.gender === 'female' ? '여' : '—'}
                </p>
                <InsuranceDisplay rrn={c.ssn} />
                <p>
                  <strong>운전여부:</strong>{' '}
                  {c.isDriver === true
                    ? `운전함${c.carType ? ` (${c.carType})` : ''}`
                    : c.isDriver === false
                      ? '운전 안함'
                      : c.driving || '—'}
                </p>
                <p>
                  <strong>주민번호:</strong> {c.ssn || '—'}
                </p>
                <p>
                  <strong>차량번호:</strong> {c.carNumber || '—'}
                </p>
                <p>
                  <strong>차종·연식:</strong> {c.carModel || '—'} / {c.carYear || '—'}
                </p>
                <p>
                  <strong>만기(갱신)일:</strong> {c.renewalDate || '—'}
                </p>
                {c.notes && c.notes.length > 0 ? (
                  <div style={{ marginTop: 12 }}>
                    <strong>메모</strong>
                    <ul>
                      {c.notes.map((n) => (
                        <li key={n.id}>{n.content}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <div className="customer-actions">
                  <button className="kakao-btn" type="button" onClick={() => void copyCustomer(c)}>
                    카톡 복사
                  </button>
                  <button className="car-btn" type="button" onClick={() => goToCarEdit(c)}>
                    자동차 입력
                  </button>
                  <button className="edit-btn" type="button" onClick={() => startEdit(c)}>
                    ✏ 수정
                  </button>
                  <button className="delete-btn" type="button" onClick={() => void handleDeleteCustomer(c)}>
                    삭제
                  </button>
                </div>
              </>
            )}

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
                        onClick={() => navigate(`/form/${row.id}/edit`)}
                      >
                        열기
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}
      </li>
    )
  }

  if (user?.role !== 'user') {
    return (
      <main className="page">
        <header className="page-header">
          <h1>고객 관리</h1>
          <p>접근 권한 없음</p>
        </header>
        <button className="button button--full" type="button" onClick={() => navigate('/dashboard')}>
          메뉴로
        </button>
      </main>
    )
  }

  return (
    <main className="page customers-page">
      <header className="page-header">
        <h1>고객 관리</h1>
        <p>{statusText || '고객을 등록하고 목록에서 카톡용 문구를 복사할 수 있습니다.'}</p>
      </header>

      <nav className="card dashboard-menu-card" aria-label="고객 관리 내 네비게이션">
        <button className="button button--secondary button--full" type="button" onClick={() => navigate('/dashboard')}>
          메뉴
        </button>
      </nav>

      <div className="tab-container" role="tablist" aria-label="고객 관리 구역">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'create'}
          className={tab === 'create' ? 'active' : ''}
          onClick={() => setTab('create')}
        >
          고객 등록
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'list'}
          className={tab === 'list' ? 'active' : ''}
          onClick={() => setTab('list')}
        >
          고객 조회
        </button>
      </div>

      {tab === 'create' ? (
        <section className="card" style={{ marginTop: 0 }}>
          <h2 className="dashboard-section-title">신규 고객</h2>
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
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                <label>
                  <input
                    type="radio"
                    name="gender-create"
                    checked={form.gender === 'male'}
                    onChange={() => setForm({ ...form, gender: 'male' })}
                  />{' '}
                  남
                </label>
                <label>
                  <input
                    type="radio"
                    name="gender-create"
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
                placeholder="000000-0000000"
                value={form.rrn}
                onChange={(e) => setForm({ ...form, rrn: formatRrnInput(e.target.value) })}
              />
            </label>
            <div className="field field--wide">
              {createInsurance.age != null && createNextYmd ? (
                <p style={{ margin: 0 }}>
                  <strong>보험나이:</strong> {createInsurance.age}세 (상령일: {formatDateYmdInput(createNextYmd)})
                </p>
              ) : (
                <p style={{ margin: 0 }}>
                  <strong>보험나이:</strong> 계산 불가 · <strong>상령일:</strong> 계산 불가
                </p>
              )}
            </div>
            <div className="field field--wide">
              <span className="field__label">운전 여부</span>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                <label>
                  <input
                    type="radio"
                    name="driver-create"
                    checked={form.isDriver === true}
                    onChange={() => setForm({ ...form, isDriver: true })}
                  />{' '}
                  운전함
                </label>
                <label>
                  <input
                    type="radio"
                    name="driver-create"
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
                  placeholder="예: SUV, 1톤 트럭"
                  value={form.carType}
                  onChange={(e) => setForm({ ...form, carType: e.target.value })}
                />
              </label>
            ) : null}
            <NotesEditor
              notes={form.notes}
              noteDraft={form.noteDraft}
              onDraftChange={(v) => setForm({ ...form, noteDraft: v.slice(0, NOTE_MAX_LENGTH) })}
              onAdd={() =>
                addNoteCore(
                  form.noteDraft,
                  (fn) => setForm((prev) => ({ ...prev, notes: fn(prev.notes) })),
                  () => setForm((prev) => ({ ...prev, noteDraft: '' })),
                )
              }
              onDelete={(id) => setForm((prev) => ({ ...prev, notes: prev.notes.filter((n) => n.id !== id) }))}
            />
          </div>
          <button className="button button--primary button--full" type="button" onClick={() => void handleSaveCustomer()}>
            저장
          </button>
        </section>
      ) : (
        <section className="list-section" style={{ marginTop: 0 }}>
          <h2 className="dashboard-section-title">저장된 고객</h2>
          <input
            className="search-input"
            type="search"
            placeholder="이름 / 전화번호 검색"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            autoComplete="off"
            aria-label="이름 또는 전화번호 검색"
          />
          {isLoading ? (
            <p>불러오는 중…</p>
          ) : customers.length === 0 ? (
            <p className="empty-state">등록된 고객이 없습니다.</p>
          ) : sortedCustomers.length === 0 ? (
            <p className="empty-state">검색과 일치하는 고객이 없습니다.</p>
          ) : (
            <ul className="record-list customer-expand-list customer-list">
              {sortedCustomers.map((c) => (
                <CustomerCard key={c.id} data={c} />
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  )
}
