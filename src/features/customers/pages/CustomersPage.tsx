import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { formatKoreanDateTime } from '../../application/utils/date'
import type { InsuranceApplicationRecord } from '../../application/domain/types'
import {
  deleteCustomer,
  listCustomerForms,
  listCustomers,
  updateCustomer,
} from '../api/customersApi'
import type { CustomerNote, CustomerRecord } from '../domain/types'
import { storeSelectedCustomer } from '../storage/selectedCustomerStorage'
import { getDDay, getDDayBadgeClass } from '../utils/dday'
import { generateCustomerText } from '../utils/customerText'
import { NOTE_MAX_LENGTH } from '../utils/insuranceInfo'
import { EXCEL_COLUMN_META, exportCustomersExcel } from '../utils/exportCustomersExcel'
import {
  CustomerForm,
  DetailInsurance,
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

export default function CustomersPage() {
  const navigate = useNavigate()
  const { user, token } = useAuth()
  const [customers, setCustomers] = useState<CustomerRecord[]>([])
  const [statusText, setStatusText] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [historyForms, setHistoryForms] = useState<InsuranceApplicationRecord[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<CustomerEditFormState | null>(null)
  const [tab, setTab] = useState<'create' | 'list'>('create')
  const [keyword, setKeyword] = useState('')
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

  const allVisibleIds = useMemo(() => sortedCustomers.map((c) => String(c.id)), [sortedCustomers])
  const allVisibleSelected =
    allVisibleIds.length > 0 && allVisibleIds.every((id) => selectedCustomerIds.includes(id))

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

  function addNoteDraft(
    draft: string,
    setNotes: (fn: (prev: CustomerNote[]) => CustomerNote[]) => void,
    clearDraft: () => void,
  ) {
    const trimmed = draft.trim()
    if (!trimmed) {
      return
    }
    if (trimmed.length > NOTE_MAX_LENGTH) {
      setStatusText(`메모는 ${NOTE_MAX_LENGTH}자 이하로 입력해주세요.`)
      return
    }
    const newNote: CustomerNote = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      content: trimmed,
      createdAt: new Date().toISOString(),
    }
    setNotes((prev) => [newNote, ...prev])
    clearDraft()
    setStatusText('')
  }

  async function copyCustomer(rec: CustomerRecord) {
    const text = generateCustomerText(rec)
    try {
      await navigator.clipboard.writeText(text)
      window.alert('복사되었습니다')
    } catch {
      setStatusText('복사에 실패했습니다.')
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
      setStatusText('다운로드할 고객을 선택해 주세요.')
      return
    }
    const idSet = new Set(selectedCustomerIds)
    const rows = sortedCustomers.filter((c) => idSet.has(String(c.id)))
    runExport(rows)
  }

  function handleDownloadAll() {
    runExport([...customers])
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
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: 4 }}>
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
                      value={editForm.ssn}
                      onChange={(e) => setEditForm({ ...editForm, ssn: e.target.value })}
                    />
                  </label>
                  <InsuranceInline ssn={editForm.ssn} />
                  <label className="field">
                    <span className="field__label">전화번호</span>
                    <input
                      className="field__control"
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    />
                  </label>
                  <label className="field field--wide">
                    <span className="field__label">주소</span>
                    <input
                      className="field__control"
                      value={editForm.address}
                      onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                    />
                  </label>
                  <label className="field">
                    <span className="field__label">키</span>
                    <input
                      className="field__control"
                      value={editForm.height}
                      onChange={(e) => setEditForm({ ...editForm, height: e.target.value })}
                    />
                  </label>
                  <label className="field">
                    <span className="field__label">몸무게</span>
                    <input
                      className="field__control"
                      value={editForm.weight}
                      onChange={(e) => setEditForm({ ...editForm, weight: e.target.value })}
                    />
                  </label>
                  <label className="field field--wide">
                    <span className="field__label">직업 / 회사명 등</span>
                    <input
                      className="field__control"
                      value={editForm.job}
                      onChange={(e) => setEditForm({ ...editForm, job: e.target.value })}
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
                        placeholder="예: 승용차, SUV, 1톤 트럭"
                        value={editForm.carType}
                        onChange={(e) => setEditForm({ ...editForm, carType: e.target.value })}
                      />
                    </label>
                  ) : null}
                  <label className="field field--wide">
                    <span className="field__label">5년 이내 진단·수술·치료 (건강 고지)</span>
                    <textarea
                      className="field__control"
                      rows={3}
                      value={editForm.medical}
                      onChange={(e) => setEditForm({ ...editForm, medical: e.target.value })}
                    />
                  </label>
                  <div className="field field--wide">
                    <span className="field__label">메모 (최대 {NOTE_MAX_LENGTH}자, Enter로 추가)</span>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 4 }}>
                      <input
                        className="field__control"
                        style={{ flex: '1 1 220px' }}
                        placeholder="메모 입력"
                        value={editForm.noteDraft}
                        maxLength={NOTE_MAX_LENGTH}
                        onChange={(e) =>
                          setEditForm({ ...editForm, noteDraft: e.target.value.slice(0, NOTE_MAX_LENGTH) })
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            addNoteDraft(
                              editForm.noteDraft,
                              (fn) => setEditForm((prev) => (prev ? { ...prev, notes: fn(prev.notes) } : prev)),
                              () => setEditForm((prev) => (prev ? { ...prev, noteDraft: '' } : prev)),
                            )
                          }
                        }}
                      />
                      <button
                        className="button button--secondary"
                        type="button"
                        onClick={() =>
                          addNoteDraft(
                            editForm.noteDraft,
                            (fn) => setEditForm((prev) => (prev ? { ...prev, notes: fn(prev.notes) } : prev)),
                            () => setEditForm((prev) => (prev ? { ...prev, noteDraft: '' } : prev)),
                          )
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
                              <small style={{ opacity: 0.75 }}>{new Date(note.createdAt).toLocaleString('ko-KR')}</small>
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
                      value={editForm.carNumber}
                      onChange={(e) => setEditForm({ ...editForm, carNumber: e.target.value })}
                    />
                  </label>
                  <label className="field">
                    <span className="field__label">차종</span>
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
                <DetailInsurance ssn={c.ssn} />
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
                  <strong>주소:</strong> {c.address || '—'}
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
                  <div style={{ marginTop: 8 }}>
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
        </div>
      </li>
    )
  }

  if (user?.role !== 'user') {
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
      className={`page customers-page${isSelectMode && tab === 'list' ? ' customers-page--excel-toolbar-pad' : ''}`}
    >
      {isSelectMode && tab === 'list' ? (
        <div className="customers-excel-toolbar" role="region" aria-label="엑셀 다운로드 선택">
          <p className="customers-excel-toolbar__status">엑셀 다운로드 모드 — 고객을 선택한 뒤 다운로드하세요</p>
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
            <button
              type="button"
              className="button button--secondary"
              onClick={() => setIsColumnPickerOpen(true)}
            >
              컬럼 선택
            </button>
            <button type="button" className="button button--primary" onClick={handleDownloadSelected}>
              선택 다운로드
            </button>
            <button type="button" className="button button--secondary" onClick={handleDownloadAll}>
              전체 다운로드
            </button>
            <button type="button" className="button button--secondary" onClick={exitExcelSelectMode}>
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
          <CustomerForm
            onStatusMessage={setStatusText}
            onInternalSaveSuccess={() => void loadCustomers()}
          />
        </section>
      ) : (
        <section className="list-section" style={{ marginTop: 0 }}>
          <div className="list-section-header-row">
            <h2 className="dashboard-section-title">저장된 고객</h2>
            {!isSelectMode ? (
              <button type="button" className="button button--secondary" onClick={enterExcelSelectMode}>
                엑셀 다운로드
              </button>
            ) : null}
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
