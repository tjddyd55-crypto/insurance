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
import type { CustomerRecord } from '../domain/types'
import { storeSelectedCustomer } from '../storage/selectedCustomerStorage'
import { getDDay, getDDayBadgeClass } from '../utils/dday'
import { generateCustomerText } from '../utils/customerText'

type CustomerFormState = {
  name: string
  ssn: string
  phone: string
  carrier: string
  address: string
  height: string
  weight: string
  job: string
  driving: string
  medical: string
}

function CustomerDDayBadge({ renewalDate }: { renewalDate: string }) {
  const dday = getDDay(renewalDate)
  if (dday === null) {
    return null
  }
  return <span className={getDDayBadgeClass(dday)}>{`D-${dday}`}</span>
}

const EMPTY_FORM: CustomerFormState = {
  name: '',
  ssn: '',
  phone: '',
  carrier: '',
  address: '',
  height: '',
  weight: '',
  job: '',
  driving: '',
  medical: '',
}

type CustomerEditFormState = CustomerFormState & {
  carNumber: string
  carModel: string
  carYear: string
  renewalDate: string
}

function recordToEditForm(c: CustomerRecord): CustomerEditFormState {
  return {
    name: c.name ?? '',
    ssn: c.ssn ?? '',
    phone: c.phone ?? '',
    carrier: c.carrier ?? '',
    address: c.address ?? '',
    height: c.height ?? '',
    weight: c.weight ?? '',
    job: c.job ?? '',
    driving: c.driving ?? '',
    medical: c.medical ?? '',
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
  const [form, setForm] = useState<CustomerFormState>(EMPTY_FORM)
  const [statusText, setStatusText] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [historyForms, setHistoryForms] = useState<InsuranceApplicationRecord[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<CustomerEditFormState | null>(null)

  const duplicateCustomerNames = useMemo(() => {
    const counts = new Map<string, number>()
    for (const c of customers) {
      const key = c.name.trim()
      if (!key) {
        continue
      }
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return new Set(
      [...counts.entries()].filter(([, n]) => n > 1).map(([name]) => name),
    )
  }, [customers])

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

  async function handleSaveCustomer() {
    if (!token || user?.role !== 'user') {
      return
    }
    const name = form.name.trim()
    if (!name) {
      setStatusText('이름은 필수입니다.')
      return
    }
    try {
      await saveCustomer(token, {
        name,
        ssn: form.ssn,
        phone: form.phone,
        carrier: form.carrier,
        address: form.address,
        height: form.height,
        weight: form.weight,
        job: form.job,
        driving: form.driving,
        medical: form.medical,
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
    try {
      await updateCustomer(token, editingId, {
        name,
        ssn: editForm.ssn,
        phone: editForm.phone,
        carrier: editForm.carrier,
        address: editForm.address,
        height: editForm.height,
        weight: editForm.weight,
        job: editForm.job,
        driving: editForm.driving,
        medical: editForm.medical,
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
    <main className="page">
      <header className="page-header">
        <h1>고객 관리</h1>
        <p>{statusText || '고객을 등록하고 목록에서 카톡용 문구를 복사할 수 있습니다.'}</p>
      </header>

      <nav className="card dashboard-menu-card" aria-label="고객 관리 내 네비게이션">
        <button className="button button--secondary button--full" type="button" onClick={() => navigate('/dashboard')}>
          메뉴
        </button>
      </nav>

      <section className="card" style={{ marginTop: 14 }}>
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
          <label className="field">
            <span className="field__label">주민번호</span>
            <input
              className="field__control"
              placeholder="주민번호"
              value={form.ssn}
              onChange={(e) => setForm({ ...form, ssn: e.target.value })}
            />
          </label>
          <label className="field">
            <span className="field__label">전화번호</span>
            <input
              className="field__control"
              placeholder="전화번호"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </label>
          <label className="field">
            <span className="field__label">통신사</span>
            <input
              className="field__control"
              placeholder="통신사"
              value={form.carrier}
              onChange={(e) => setForm({ ...form, carrier: e.target.value })}
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
          <label className="field">
            <span className="field__label">운전 여부</span>
            <input
              className="field__control"
              placeholder="운전 여부"
              value={form.driving}
              onChange={(e) => setForm({ ...form, driving: e.target.value })}
            />
          </label>
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
        </div>
        <button className="button button--primary button--full" type="button" onClick={() => void handleSaveCustomer()}>
          저장
        </button>
      </section>

      <section className="list-section" style={{ marginTop: 18 }}>
        <h2>저장된 고객</h2>
        {isLoading ? (
          <p>불러오는 중…</p>
        ) : customers.length === 0 ? (
          <p className="empty-state">등록된 고객이 없습니다.</p>
        ) : (
          <ul className="record-list customer-expand-list">
            {customers.map((c) => (
              <li key={c.id} className="record-card customer-expand-card">
                <button
                  type="button"
                  className="customer-expand-summary"
                  aria-expanded={expandedId === c.id}
                  onClick={() => setExpandedId((prev) => (prev === c.id ? null : c.id))}
                >
                  <span className="customer-expand-summary__title">
                    <span style={{ color: duplicateCustomerNames.has(c.name.trim()) ? '#c00' : 'inherit' }}>
                      {c.name}
                    </span>
                    {' / '}
                    {c.phone || '—'}
                    {' / '}
                    {c.ssn || '—'}{' '}
                    <CustomerDDayBadge renewalDate={c.renewalDate} />
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
                          <label className="field">
                            <span className="field__label">주민번호</span>
                            <input
                              className="field__control"
                              value={editForm.ssn}
                              onChange={(e) => setEditForm({ ...editForm, ssn: e.target.value })}
                            />
                          </label>
                          <label className="field">
                            <span className="field__label">전화번호</span>
                            <input
                              className="field__control"
                              value={editForm.phone}
                              onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                            />
                          </label>
                          <label className="field">
                            <span className="field__label">통신사</span>
                            <input
                              className="field__control"
                              value={editForm.carrier}
                              onChange={(e) => setEditForm({ ...editForm, carrier: e.target.value })}
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
                          <label className="field">
                            <span className="field__label">운전 여부</span>
                            <input
                              className="field__control"
                              value={editForm.driving}
                              onChange={(e) => setEditForm({ ...editForm, driving: e.target.value })}
                            />
                          </label>
                          <label className="field field--wide">
                            <span className="field__label">건강 고지</span>
                            <textarea
                              className="field__control"
                              rows={3}
                              value={editForm.medical}
                              onChange={(e) => setEditForm({ ...editForm, medical: e.target.value })}
                            />
                          </label>
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
                          <button
                            className="button-save"
                            type="button"
                            onClick={() => void handleUpdateCustomer()}
                          >
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
                          <button
                            className="delete-btn"
                            type="button"
                            onClick={() => void handleDeleteCustomer(c)}
                          >
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
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
